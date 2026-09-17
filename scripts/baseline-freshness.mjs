import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { integrationBranch } from "./run-context.mjs";

// A baseline records how the React UI behaves at one product revision, in
// flow-contract.json. flow-migrate then writes Angular and flow-verify checks
// it against that contract. If someone else changed the React source on the
// integration branch in between, the contract describes code that no longer
// exists, so a PASS is about the wrong thing. This guard answers one question:
// have the React sources this baseline relied on changed on the integration
// branch since the baseline was taken? Anything it cannot answer is INVALID,
// never a quiet "fresh", because a false fresh is the one outcome that lets a
// stale PASS through.

const usage = `Usage: node scripts/baseline-freshness.mjs --contract <file> --product-root <dir> [options]

Reports whether the React sources a flow-contract.json relied on changed on
the integration branch since the baseline revision it names.

Options:
  --contract <file>        the flow-contract.json to check (required)
  --product-root <dir>     the React product Git repository (required)
  --integration-ref <ref>  branch or ref to compare against
                           (default ${integrationBranch})
  --run-dir <dir>          a run directory; a land-receipt.json in it means the
                           slice already merged, so freshness is meaningless
  --json                   print the machine-readable result
  --self-test              run the built-in checks
`;

const git = (root, args, input) =>
  spawnSync("git", ["-C", root, ...args], { encoding: "utf8", input });

// The baseline names its sources three ways, all lossy: scope.includedPaths is
// rejected by the validator from schemaVersion 6, renderedSurfaceInventory
// references are optional and free-form and miss real dependencies a slice
// leans on (LineForm.functions.ts appears only in prose; FocusNumberInput.tsx
// lives a directory above the slice). So the footprint is every src path-like
// string in the whole raw contract text, wherever it hides.
const footprintPattern =
  /[A-Za-z0-9_\\/.:-]*?(src[\\/][A-Za-z0-9_\\/.-]+\.(?:tsx?|css|scss))/g;

// JSON writes Windows paths as C:\\Project\\...\\src\\... and, when a contract
// used forward slashes, escapes them so the raw text carries src\/app or the
// doubled src//app//providers//useRobotManager.tsx. One normal form settles
// all of it: slashes forward, runs collapsed, everything before src/ dropped.
const normalisePath = hit => {
  const forward = hit.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const start = forward.indexOf("src/");
  return start === -1 ? forward : forward.slice(start);
};

export const extractFootprint = contractText => {
  const paths = new Set();
  for (const match of contractText.matchAll(footprintPattern)) {
    const candidate = normalisePath(match[1]);
    // An angular path segment is the migration's own output, not a React
    // baseline source, so it is never part of the footprint. This is a segment
    // test on purpose: it drops src/angular/... and a co-located
    // .../lineForm/angular/... but keeps AngularAstronautModelHost.tsx, the
    // React host whose name only happens to start with Angular.
    if (/(^|\/)angular\//.test(candidate)) continue;
    paths.add(candidate);
  }
  return [...paths].sort();
};

const resolveCommit = (root, ref) => {
  const result = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return result.status === 0 ? result.stdout.trim() : null;
};

const pathExistsAt = (root, revision, filePath) =>
  git(root, ["cat-file", "-e", `${revision}:${filePath}`]).status === 0;

// scope.allowedWritePaths names what flow-migrate may create or edit, including
// files that do not exist yet and whole directories. A footprint path is
// covered when it equals an entry or sits under one, matched on a segment
// boundary so .../astronautForm covers .../astronautForm/__tests__/... but not
// a sibling .../astronautFormExtra.tsx.
const isCovered = (filePath, allowedWritePaths) =>
  allowedWritePaths.some(entry => filePath === entry || filePath.startsWith(`${entry}/`));

// A snapshot comparison, not a history walk: git diff asks whether the two
// endpoints differ, so a file changed and then reverted reads as unchanged and
// the baseline stays valid. git log would flag that reverted file, which is
// why it is the wrong tool here.
const diffFootprint = (root, revision, integrationRef, footprint) => {
  const result = git(root, [
    "diff", "--name-status", "--find-renames",
    revision, integrationRef, "--", ...footprint,
  ]);
  if (result.status !== 0) {
    throw new Error(`git diff failed: ${result.stderr.trim()}`);
  }
  const changed = [];
  for (const line of result.stdout.split("\n").filter(Boolean)) {
    const fields = line.split("\t");
    const change = fields[0][0];
    // A rename or copy prints old path then new; the old path (fields[1]) is
    // the footprint entry that moved, and it is what a reader needs named. A
    // plain change prints just its path in the same field.
    changed.push({ path: fields[1], change });
  }
  // The slice branch is deliberately not excluded with ^<branch>. When landing
  // conflicts, the workflow merges the integration branch into the slice
  // branch, so ^slice would then hide exactly the foreign commits this check
  // exists to find; and verification runs before landing, so the migration's
  // own commits are not on the integration branch to confuse the diff anyway.
  return changed.sort((a, b) => a.path.localeCompare(b.path));
};

// How far the integration ref sits from its own upstream, as honesty rather
// than a gate. Never fetch: reaching the network is a human's call, so a ref
// behind its upstream is reported, not corrected. A ref with no upstream is a
// normal local branch, not an error.
const upstreamWarnings = (root, integrationRef) => {
  const counts = git(root, [
    "rev-list", "--left-right", "--count",
    `${integrationRef}...${integrationRef}@{upstream}`,
  ]);
  if (counts.status !== 0) {
    return [`${integrationRef} has no configured upstream; ` +
      "remote drift was not checked and no fetch was performed."];
  }
  const [ahead, behind] = counts.stdout.trim().split(/\s+/).map(Number);
  const warnings = [];
  if (behind > 0) {
    warnings.push(`${integrationRef} is ${behind} commit(s) behind its ` +
      "upstream; newer commits may exist locally unseen (no fetch performed).");
  }
  if (ahead > 0) {
    warnings.push(`${integrationRef} is ${ahead} commit(s) ahead of its upstream.`);
  }
  return warnings;
};

const invalid = (warnings, extra = {}) => ({
  status: "INVALID",
  baselineRevision: null,
  integrationRevision: null,
  checkedPaths: [],
  changedPaths: [],
  droppedPaths: [],
  warnings,
  ...extra,
});

export const evaluateFreshness = async options => {
  const productRoot = options["product-root"];
  const integrationRef = options["integration-ref"] ?? integrationBranch;

  // An already-landed slice means the caller ran this out of order: the slice
  // merged into the integration branch, so its baseline sources by definition
  // moved and there is nothing left to keep fresh.
  if (options["run-dir"]) {
    const receiptPath = path.join(options["run-dir"], "land-receipt.json");
    let receiptText;
    try {
      receiptText = await readFile(receiptPath, "utf8");
    } catch {
      receiptText = null;
    }
    if (receiptText !== null) {
      let merged = "unknown";
      try {
        merged = JSON.parse(receiptText.replace(/^\uFEFF/, "")).merged ?? "unknown";
      } catch {
        // A receipt that will not parse is still proof the slice landed.
      }
      return invalid([
        `A land-receipt.json in ${options["run-dir"]} shows this slice already ` +
        `merged into the integration branch at commit ${merged}. Freshness is ` +
        "meaningless after landing; this check was called out of order.",
      ]);
    }
  }

  let contractText;
  try {
    contractText = await readFile(options.contract, "utf8");
  } catch (error) {
    return invalid([`The contract ${options.contract} could not be read: ${error.message}`]);
  }

  let contract;
  try {
    contract = JSON.parse(contractText.replace(/^\uFEFF/, ""));
  } catch (error) {
    return invalid([`The contract ${options.contract} is not valid JSON: ${error.message}`]);
  }
  const revision = contract.repository?.revision;
  if (!revision) {
    return invalid(["The contract names no repository.revision to use as the baseline."]);
  }
  const allowedWritePaths = Array.isArray(contract.scope?.allowedWritePaths)
    ? contract.scope.allowedWritePaths.map(entry => entry.replace(/\\/g, "/").replace(/\/+$/, ""))
    : [];

  const footprint = extractFootprint(contractText);
  if (footprint.length === 0) {
    return invalid([
      "No React src paths were found in the contract, so there is no footprint " +
      "to compare. A baseline with no traceable sources cannot be trusted fresh.",
    ]);
  }

  const baselineRevision = resolveCommit(productRoot, revision);
  if (!baselineRevision) {
    return invalid(
      [`The baseline revision ${revision} does not resolve to a commit in ${productRoot}.`],
      { checkedPaths: footprint },
    );
  }

  const integrationRevision = resolveCommit(productRoot, integrationRef);
  if (!integrationRevision) {
    return invalid(
      [`The integration ref ${integrationRef} does not resolve to a commit in ${productRoot}.`],
      { baselineRevision, checkedPaths: footprint },
    );
  }

  const missing = footprint.filter(filePath => !pathExistsAt(productRoot, baselineRevision, filePath));

  // A missing path is only trustworthy when the contract planned it: a path
  // covered by allowedWritePaths is migration output flow-migrate has yet to
  // write, so it is dropped from the footprint, not treated as a broken
  // reference. A missing path outside the allowlist names a source that never
  // existed, which is a genuinely untrustworthy contract and stays INVALID.
  const droppedPaths = missing.filter(filePath => isCovered(filePath, allowedWritePaths));
  const brokenPaths = missing.filter(filePath => !isCovered(filePath, allowedWritePaths));
  if (brokenPaths.length > 0) {
    return invalid(
      [`These footprint paths do not exist at the baseline revision ${revision} and are ` +
        `not planned migration output in scope.allowedWritePaths, so the contract cannot ` +
        `be trusted: ${brokenPaths.join(", ")}.`],
      { baselineRevision, integrationRevision, checkedPaths: footprint, droppedPaths },
    );
  }

  const checkedPaths = footprint.filter(filePath => !droppedPaths.includes(filePath));
  if (checkedPaths.length === 0) {
    return invalid(
      ["Every footprint path is planned migration output not yet on the baseline, so " +
        "there is nothing to compare and freshness cannot be established."],
      { baselineRevision, integrationRevision, droppedPaths },
    );
  }

  const changedPaths = diffFootprint(productRoot, baselineRevision, integrationRef, checkedPaths);
  const warnings = upstreamWarnings(productRoot, integrationRef);
  if (droppedPaths.length > 0) {
    warnings.push(
      `${droppedPaths.length} footprint path(s) were skipped as planned migration output ` +
      `absent at the baseline (covered by scope.allowedWritePaths): ${droppedPaths.join(", ")}.`);
  }

  return {
    // A deletion or rename of a footprint file is a change like any other: the
    // baseline still describes a file the integration branch no longer has.
    status: changedPaths.length > 0 ? "STALE" : "FRESH",
    baselineRevision,
    integrationRevision,
    checkedPaths,
    changedPaths,
    droppedPaths,
    warnings,
  };
};

const parseArguments = argumentsList => {
  const options = {};
  const valued = new Set(["contract", "product-root", "integration-ref", "run-dir"]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (["--self-test", "--help", "--json"].includes(argument)) {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--") || !valued.has(name)) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} needs a value.\n\n${usage}`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
};

const printHuman = result => {
  const lines = [`status: ${result.status}`];
  if (result.baselineRevision) lines.push(`baseline revision:    ${result.baselineRevision}`);
  if (result.integrationRevision) lines.push(`integration revision: ${result.integrationRevision}`);
  if (result.checkedPaths.length > 0) {
    lines.push(`checked ${result.checkedPaths.length} path(s):`);
    for (const filePath of result.checkedPaths) lines.push(`  ${filePath}`);
  }
  if (result.changedPaths.length > 0) {
    lines.push("changed since the baseline:");
    for (const entry of result.changedPaths) lines.push(`  ${entry.change} ${entry.path}`);
  }
  if (result.droppedPaths && result.droppedPaths.length > 0) {
    lines.push("skipped as planned migration output (in scope.allowedWritePaths):");
    for (const filePath of result.droppedPaths) lines.push(`  ${filePath}`);
  }
  if (result.warnings.length > 0) {
    lines.push("warnings:");
    for (const warning of result.warnings) lines.push(`  - ${warning}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Baseline freshness self-test failed: ${message}`);
};

const runSelfTest = async () => {
  // Footprint extraction is pure text, so it is checked without any repository:
  // doubled slashes, backslashes, angular segments dropped, a prose-only path
  // found, and duplicates collapsed.
  const sample = [
    '"C:\\\\Project\\\\frontend\\\\src\\\\features\\\\lineForm\\\\LineForm.tsx:80"',
    '"src//app//providers//useRobotManager.tsx"',
    "bound to (src/features/lineForm/LineForm.functions.ts:37)",
    '"src\\\\features\\\\lineForm\\\\LineForm.tsx:121"',
    '"src/angular/App.tsx"',
    '"src/features/lineForm/angular/LineFormHost.tsx"',
    '"src/features/lineForm/AngularHost.tsx"',
  ].join("\n");
  const footprint = extractFootprint(sample);
  assert(footprint.includes("src/app/providers/useRobotManager.tsx"),
    "a doubled-slash path was not collapsed");
  assert(footprint.includes("src/features/lineForm/LineForm.tsx"),
    "a backslash Windows path was not normalised");
  assert(footprint.includes("src/features/lineForm/LineForm.functions.ts"),
    "a prose-only .ts path was not extracted");
  assert(footprint.includes("src/features/lineForm/AngularHost.tsx"),
    "a React host whose name starts with Angular was wrongly dropped");
  assert(!footprint.some(p => /(^|\/)angular\//.test(p)),
    "an angular path segment leaked into the footprint");
  assert(footprint.filter(p => p === "src/features/lineForm/LineForm.tsx").length === 1,
    "a duplicate path was not collapsed");

  const temporary = await mkdtemp(path.join(os.tmpdir(), "baseline-freshness-"));
  const runGit = (root, args) => {
    const result = git(root, [
      "-c", "user.name=Baseline Freshness Self Test",
      "-c", "user.email=baseline-freshness-self-test@example.invalid",
      ...args,
    ]);
    assert(result.status === 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  };
  const write = async (root, relative, content) => {
    const full = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  };
  const contractFor = (root, revision, paths, allowedWritePaths = []) => {
    const references = paths.map(p => `"${root.replace(/\\/g, "\\\\")}\\\\${p.replace(/\//g, "\\\\")}:1"`);
    const contract = {
      schemaVersion: 8,
      artifactType: "flow-contract",
      repository: { root, revision },
      scope: { allowedWritePaths },
      renderedSurfaceInventory: references.map((_, index) => ({ id: `s${index}` })),
    };
    const text = JSON.stringify(contract);
    // The references carry the paths as raw Windows strings, exactly as a real
    // contract does, so extraction is exercised on genuine text.
    return `${text.slice(0, -1)},"refs":[${references.join(",")}]}`;
  };

  try {
    const product = path.join(temporary, "product");
    await mkdir(product);
    runGit(product, ["init", "-q", "-b", "main"]);
    await write(product, "src/keep.tsx", "v1\n");
    await write(product, "src/mod.tsx", "v1\n");
    await write(product, "src/gone.tsx", "v1\n");
    await write(product, "src/revert.tsx", "v1\n");
    runGit(product, ["add", "."]);
    runGit(product, ["commit", "-q", "-m", "baseline"]);
    const baseline = git(product, ["rev-parse", "HEAD"]).stdout.trim();

    runGit(product, ["checkout", "-q", "-b", integrationBranch]);
    await write(product, "src/mod.tsx", "v2\n");
    await write(product, "src/revert.tsx", "v2\n");
    runGit(product, ["rm", "-q", path.join("src", "gone.tsx")]);
    runGit(product, ["add", "."]);
    runGit(product, ["commit", "-q", "-m", "integration drift"]);
    await write(product, "src/revert.tsx", "v1\n");
    runGit(product, ["add", "."]);
    runGit(product, ["commit", "-q", "-m", "revert revert.tsx to its baseline content"]);

    const contractsDir = path.join(temporary, "contracts");
    await mkdir(contractsDir);
    const writeContract = async (name, revision, paths, allowedWritePaths = []) => {
      const file = path.join(contractsDir, name);
      await writeFile(file, contractFor(product, revision, paths, allowedWritePaths));
      return file;
    };

    const freshContract = await writeContract("fresh.json", baseline,
      ["src/keep.tsx", "src/revert.tsx"]);
    const fresh = await evaluateFreshness({ contract: freshContract, "product-root": product });
    assert(fresh.status === "FRESH",
      `unchanged and reverted sources were not FRESH: ${JSON.stringify(fresh)}`);
    assert(!fresh.changedPaths.some(entry => entry.path === "src/revert.tsx"),
      "a changed-then-reverted file was flagged; git diff, not git log, must be used");

    const staleContract = await writeContract("stale.json", baseline,
      ["src/keep.tsx", "src/mod.tsx", "src/gone.tsx", "src/revert.tsx"]);
    const stale = await evaluateFreshness({ contract: staleContract, "product-root": product });
    assert(stale.status === "STALE", `a changed source was not STALE: ${JSON.stringify(stale)}`);
    const modEntry = stale.changedPaths.find(entry => entry.path === "src/mod.tsx");
    assert(modEntry && modEntry.change === "M", "a modified source was not reported with M");
    const goneEntry = stale.changedPaths.find(entry => entry.path === "src/gone.tsx");
    assert(goneEntry && goneEntry.change === "D", "a deleted source was not reported with D");
    assert(!stale.changedPaths.some(entry => entry.path === "src/revert.tsx"),
      "a reverted source made a STALE contract; git diff must ignore it");

    const emptyContract = path.join(contractsDir, "empty.json");
    await writeFile(emptyContract, JSON.stringify({ repository: { root: product, revision: baseline } }));
    const empty = await evaluateFreshness({ contract: emptyContract, "product-root": product });
    assert(empty.status === "INVALID", "an empty footprint was not INVALID");

    const missingContract = await writeContract("missing.json", baseline,
      ["src/keep.tsx", "src/never.tsx"]);
    const missing = await evaluateFreshness({ contract: missingContract, "product-root": product });
    assert(missing.status === "INVALID" && missing.warnings.some(w => w.includes("src/never.tsx")),
      "a footprint path missing at the baseline was not INVALID");

    // A missing path covered by allowedWritePaths is planned migration output:
    // it drops out of the footprint, the remaining sources still give a real
    // verdict, and the drop is reported. The allowlist entry here is a
    // directory (__tests__), so this also exercises the segment-boundary prefix
    // match on the directory variant.
    const plannedContract = await writeContract("planned.json", baseline,
      ["src/keep.tsx", "src/astronautForm/__tests__/Host.test.tsx"],
      ["src/astronautForm/__tests__"]);
    const planned = await evaluateFreshness({ contract: plannedContract, "product-root": product });
    assert(planned.status === "FRESH",
      `a covered missing path did not leave a real verdict: ${JSON.stringify(planned)}`);
    assert(planned.droppedPaths.includes("src/astronautForm/__tests__/Host.test.tsx"),
      "a covered missing path was not recorded in droppedPaths");
    assert(planned.checkedPaths.includes("src/keep.tsx") &&
      !planned.checkedPaths.includes("src/astronautForm/__tests__/Host.test.tsx"),
      "a covered missing path was still checked");
    assert(planned.warnings.some(w => w.includes("src/astronautForm/__tests__/Host.test.tsx")),
      "a dropped path was not surfaced in warnings");

    // The allowlist entry .../astronautForm must not cover a sibling
    // .../astronautFormExtra.tsx: prefix matching is on a segment boundary, so
    // this missing, uncovered source stays INVALID.
    const siblingContract = await writeContract("sibling.json", baseline,
      ["src/keep.tsx", "src/astronautFormExtra.tsx"], ["src/astronautForm"]);
    const sibling = await evaluateFreshness({ contract: siblingContract, "product-root": product });
    assert(sibling.status === "INVALID" &&
      sibling.warnings.some(w => w.includes("src/astronautFormExtra.tsx")),
      "a sibling path outside the allowlist segment boundary was wrongly covered");

    // Every footprint path being planned output leaves nothing to compare.
    const allPlannedContract = await writeContract("all-planned.json", baseline,
      ["src/astronautForm/__tests__/Only.test.tsx"], ["src/astronautForm/__tests__"]);
    const allPlanned = await evaluateFreshness({ contract: allPlannedContract, "product-root": product });
    assert(allPlanned.status === "INVALID" &&
      allPlanned.droppedPaths.includes("src/astronautForm/__tests__/Only.test.tsx"),
      "a footprint emptied entirely by drops was not INVALID with the drop recorded");

    const badRevision = await writeContract("bad-revision.json",
      "0000000000000000000000000000000000000000", ["src/keep.tsx"]);
    const unresolved = await evaluateFreshness({ contract: badRevision, "product-root": product });
    assert(unresolved.status === "INVALID", "an unresolvable baseline revision was not INVALID");

    const badRef = await evaluateFreshness({
      contract: freshContract, "product-root": product, "integration-ref": "migration/does-not-exist",
    });
    assert(badRef.status === "INVALID", "an unresolvable integration ref was not INVALID");

    const runDir = path.join(temporary, "run");
    await mkdir(runDir);
    await writeFile(path.join(runDir, "land-receipt.json"),
      JSON.stringify({ merged: "abc123def", integrationBranch }));
    const landed = await evaluateFreshness({
      contract: freshContract, "product-root": product, "run-dir": runDir,
    });
    assert(landed.status === "INVALID" && landed.warnings.some(w => w.includes("abc123def")),
      "a present land-receipt did not make the run INVALID naming its merged commit");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Baseline freshness self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  if (options.help || !options.contract || !options["product-root"]) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const result = await evaluateFreshness(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printHuman(result);
  }
  // Only a proven-fresh baseline exits clean. STALE and INVALID both stop a
  // caller that would otherwise trust a contract describing code that moved.
  if (result.status !== "FRESH") process.exitCode = 1;
};

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
