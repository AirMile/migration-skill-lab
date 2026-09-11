import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Every phase opened by reading Git state and deriving the same values in
// prose: the run directory, the runId, which package scripts terminate, which
// earlier handoff to build on. They are facts about the file system.

const usage = `Usage: node scripts/run-context.mjs --product-root <dir> [options]

Prints the run's starting facts as JSON: the product HEAD, branch and
Git-visible status, plus whatever the options ask for.

Options:
  --lab-root <dir>       migration-skill-lab root; needed with --flow-id
  --flow-id <id>         the next baseline run directory and runId, and this
                         flow's earlier runs, work-item handoffs and saved
                         continuation prompts
  --run-dir <dir>        the files and saved prompts in one run directory
  --commands             classify the product's package.json scripts and
                         suggest terminating test, typecheck and build commands
  --save-status [file]   also write the product status, with content hashes of
                         every changed file, for a later --compare; without a
                         file it goes to a temp file keyed by the product root,
                         so a run writes nothing extra into its run directory
  --compare [file]       report what changed since a saved status; without a
                         file it reads that same temp file
  --contract <file>      a flow-contract.json: list every Git-visible path
                         outside its scope.allowedWritePaths, and with
                         --compare every path that changed or was committed
                         outside it since the saved status
  --self-test            run the built-in checks
`;

const git = (root, args, input) =>
  spawnSync("git", ["-C", root, ...args], { encoding: "utf8", input });

const localDate = () => {
  const now = new Date();
  const pad = number => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const readProductState = root => {
  const head = git(root, ["rev-parse", "HEAD"]);
  if (head.status !== 0) {
    throw new Error(`${root} is not a Git repository with a commit: ${head.stderr.trim()}`);
  }
  const branch = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const status = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (status.status !== 0) {
    throw new Error(`git status failed in ${root}: ${status.stderr.trim()}`);
  }

  const tokens = status.stdout.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const code = tokens[index].slice(0, 2);
    const filePath = tokens[index].slice(3);
    const renamedFrom = /[RC]/.test(code[0]) ? tokens[++index] : undefined;
    entries.push({ code, path: filePath, renamedFrom });
  }

  // A file that was already dirty keeps the same status line when it changes
  // again, so the content hash is what shows the second change.
  const hashable = entries.filter(entry => !entry.code.includes("D"));
  const blobs = {};
  if (hashable.length > 0) {
    const hashed = git(
      root,
      ["hash-object", "--stdin-paths"],
      hashable.map(entry => entry.path).join("\n"),
    );
    if (hashed.status === 0) {
      hashed.stdout.trim().split(/\r?\n/).forEach((blob, index) => {
        blobs[hashable[index].path] = blob;
      });
    }
  }

  return {
    root: path.resolve(root),
    head: head.stdout.trim(),
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    clean: entries.length === 0,
    status: entries.map(entry =>
      `${entry.code} ${entry.path}${entry.renamedFrom ? ` <- ${entry.renamedFrom}` : ""}`),
    blobs,
  };
};

const compareStatus = (saved, current) => {
  const before = new Set(saved.status);
  const after = new Set(current.status);
  const added = current.status.filter(entry => !before.has(entry));
  const removed = saved.status.filter(entry => !after.has(entry));
  const contentChanged = Object.keys(current.blobs).filter(filePath =>
    Object.hasOwn(saved.blobs ?? {}, filePath) &&
    saved.blobs[filePath] !== current.blobs[filePath]);
  return {
    changed: added.length > 0 || removed.length > 0 || contentChanged.length > 0 ||
      saved.head !== current.head || saved.branch !== current.branch,
    headBefore: saved.head,
    headAfter: current.head,
    branchBefore: saved.branch,
    branchAfter: current.branch,
    added,
    removed,
    contentChanged,
  };
};

// The cover rule verify-checkpoint.mjs and validate-handoff.mjs apply.
const pathCovers = (basePath, candidatePath) =>
  basePath === "." || candidatePath === basePath || candidatePath.startsWith(`${basePath}/`);

const normalizeAllowedPath = value =>
  value.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "") || ".";

const statusPaths = entry => entry.slice(3).split(" <- ");

const outsideAllowlist = (paths, allowed) =>
  [...new Set(paths)]
    .filter(filePath => !allowed.some(basePath => pathCovers(basePath, filePath)))
    .sort();

const committedPaths = (root, fromHead, toHead) => {
  if (!fromHead || fromHead === toHead) return [];
  const diff = git(root, ["diff", "--name-only", "-z", fromHead, toHead]);
  if (diff.status !== 0) {
    throw new Error(`git diff ${fromHead} ${toHead} failed in ${root}: ${diff.stderr.trim()}`);
  }
  return diff.stdout.split("\0").filter(Boolean);
};

const readAllowlist = async contractPath => {
  const contract = JSON.parse(
    (await readFile(path.resolve(contractPath), "utf8")).replace(/^\uFEFF/, ""),
  );
  const allowed = contract.scope?.allowedWritePaths;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new Error(`${contractPath} carries no scope.allowedWritePaths.`);
  }
  return allowed.map(normalizeAllowedPath);
};

const classifySegment = segment => {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  const offset = words[0] === "npx" ? 1 : 0;
  const tool = words[offset];
  const rest = words.slice(offset + 1);
  const has = flag => rest.includes(flag);
  if (!tool) return null;
  if (tool === "vitest") {
    return ["run", "bench"].includes(rest[0]) || has("--run") || has("--watch=false")
      ? null
      : "vitest watches unless it is given run";
  }
  if (tool === "jest") {
    return has("--watch") || has("--watchAll") ? "jest --watch never exits" : null;
  }
  if (tool === "vite") {
    return ["build", "optimize"].includes(rest[0]) ? null : "vite starts a dev or preview server";
  }
  if (tool === "storybook" && rest[0] === "dev") return "storybook dev starts a server";
  if (tool === "next" && ["dev", "start"].includes(rest[0])) return "next starts a server";
  if (tool === "ng" && rest[0] === "serve") return "ng serve starts a server";
  if (tool === "ng" && rest[0] === "test" && !has("--watch=false")) {
    return "ng test watches unless it is given --watch=false";
  }
  if (["nodemon", "webpack-dev-server", "http-server", "serve"].includes(tool)) {
    return `${tool} starts a server`;
  }
  if (has("--watch") || has("-w")) return `${tool} --watch never exits`;
  return null;
};

const classifyScript = command => {
  const segments = command.split(/&&|\|\||;/);
  const reasons = segments.map(classifySegment).filter(Boolean);
  const writesToWorktree = segments.some(segment =>
    /--coverage\b|--outputFile\b|--reporter[= ]junit/.test(segment));
  return {
    command,
    terminates: reasons.length === 0,
    ...(reasons.length > 0 ? { reason: reasons.join("; ") } : {}),
    ...(writesToWorktree ? { writesToWorktree: true } : {}),
  };
};

const readCommands = async productRoot => {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(productRoot, "package.json"), "utf8"));
  } catch (error) {
    return { error: `Cannot read package.json: ${error.message}` };
  }
  const scripts = manifest.scripts ?? {};
  const classified = Object.fromEntries(
    Object.entries(scripts).map(([name, command]) => [name, classifyScript(command)]),
  );

  const suggested = {};
  const testName = ["test", "test:unit", "unit"].find(name => scripts[name]);
  if (testName && !classified[testName].writesToWorktree) {
    if (classified[testName].terminates) {
      suggested.test = `npm run ${testName} -- <test file>`;
    } else if (/\bvitest\b/.test(scripts[testName])) {
      suggested.test = `npm run ${testName} -- run <test file>`;
    }
  }
  const typecheckName = ["typecheck", "type-check", "check-types", "types", "tsc"]
    .find(name => scripts[name] && classified[name].terminates);
  if (typecheckName) {
    suggested.typecheck = `npm run ${typecheckName}`;
  } else if (await exists(path.join(productRoot, "tsconfig.json"))) {
    suggested.typecheck = "npx tsc --noEmit";
  }
  if (scripts.build && classified.build.terminates) suggested.build = "npm run build";

  return { scripts: classified, suggested };
};

const exists = async filePath => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readFlow = async (labRoot, flowId) => {
  const runsDirectory = path.resolve(labRoot, "runs");
  let directories = [];
  try {
    directories = (await readdir(runsDirectory, { withFileTypes: true }))
      .filter(entry => entry.isDirectory());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const pattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escapeRegex(flowId)}-baseline-(\\d+)$`);
  const runs = directories
    .filter(entry => pattern.test(entry.name))
    .map(entry => ({ name: entry.name, number: Number(pattern.exec(entry.name)[1]) }))
    .sort((left, right) => left.number - right.number);
  const next = (runs.at(-1)?.number ?? 0) + 1;

  const handoffs = [];
  const promptFiles = [];
  for (const run of runs) {
    const directory = path.join(runsDirectory, run.name);
    for (const file of await readdir(directory)) {
      const filePath = path.join(directory, file);
      if (/^work-item-.*\.json$/.test(file)) {
        try {
          const value = JSON.parse(await readFile(filePath, "utf8"));
          if (value.artifactType === "work-item-handoff" && value.flowId === flowId) {
            handoffs.push({
              path: filePath,
              handoffPhase: value.handoffPhase,
              runId: value.runId,
              modified: (await stat(filePath)).mtime.toISOString(),
            });
          }
        } catch {
          handoffs.push({ path: filePath, unreadable: true });
        }
      } else if (file.startsWith(`${flowId}-`) && file.endsWith("-prompt.md")) {
        promptFiles.push(filePath);
      }
    }
  }
  handoffs.sort((left, right) => (right.modified ?? "").localeCompare(left.modified ?? ""));

  return {
    flowId,
    runs: runs.map(run => path.join(runsDirectory, run.name)),
    nextRunDirectory: path.join(runsDirectory, `${localDate()}-${flowId}-baseline-${next}`),
    nextRunId: `${flowId}-baseline-${next}`,
    handoffs,
    promptFiles,
  };
};

const readRunDirectory = async directory => {
  const absolute = path.resolve(directory);
  const files = (await readdir(absolute, { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();
  return {
    path: absolute,
    files,
    promptFiles: files.filter(file => file.endsWith("-prompt.md")),
  };
};

const defaultStatusPath = productRoot =>
  path.join(
    os.tmpdir(),
    `run-context-${createHash("sha256").update(productRoot.toLowerCase()).digest("hex").slice(0, 12)}.json`,
  );

const collectContext = async options => {
  if (!options["product-root"]) throw new Error(`--product-root is required.\n\n${usage}`);
  if (options["flow-id"] && !options["lab-root"]) {
    throw new Error("--flow-id needs --lab-root, where the runs directory lives.");
  }

  const state = readProductState(options["product-root"]);
  const { blobs, ...product } = state;
  const context = { product };

  if (options["flow-id"]) context.flow = await readFlow(options["lab-root"], options["flow-id"]);
  if (options["run-dir"]) context.runDirectory = await readRunDirectory(options["run-dir"]);
  if (options.commands) context.commands = await readCommands(state.root);
  const allowed = options.contract ? await readAllowlist(options.contract) : null;
  if (allowed) {
    context.allowlist = {
      allowedWritePaths: allowed,
      outside: outsideAllowlist(state.status.flatMap(statusPaths), allowed),
    };
  }
  const statusPath = option =>
    option === true ? defaultStatusPath(state.root) : path.resolve(option);
  if (options.compare) {
    const saved = JSON.parse(await readFile(statusPath(options.compare), "utf8"));
    context.comparison = compareStatus(saved, state);
    if (allowed) {
      const { added, removed, contentChanged } = context.comparison;
      context.comparison.outsideAllowlist = outsideAllowlist([
        ...[...added, ...removed].flatMap(statusPaths),
        ...contentChanged,
        ...committedPaths(state.root, saved.head, state.head),
      ], allowed);
    }
  }
  if (options["save-status"]) {
    const savedPath = statusPath(options["save-status"]);
    await writeFile(
      savedPath,
      `${JSON.stringify({ capturedAt: new Date().toISOString(), ...state }, null, 2)}\n`,
    );
    context.savedStatus = savedPath;
  }
  return context;
};

const parseArguments = argumentsList => {
  const options = {};
  const valued = new Set([
    "product-root", "lab-root", "flow-id", "run-dir", "save-status", "compare",
    "contract",
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (["--self-test", "--help", "--commands"].includes(argument)) {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--") || !valued.has(name)) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      if (name === "save-status" || name === "compare") {
        options[name] = true;
        continue;
      }
      throw new Error(`${argument} needs a value.\n\n${usage}`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Run context self-test failed: ${message}`);
};

const runSelfTest = async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "run-context-"));
  const runGit = (root, args) => {
    const result = git(root, [
      "-c", "user.name=Run Context Self Test",
      "-c", "user.email=run-context-self-test@example.invalid",
      ...args,
    ]);
    assert(result.status === 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  };

  try {
    const product = path.join(temporary, "product");
    await mkdir(product);
    runGit(product, ["init", "-q"]);
    await writeFile(path.join(product, "README.md"), "demo\n");
    await writeFile(path.join(product, "tsconfig.json"), "{}\n");
    await writeFile(path.join(product, "package.json"), JSON.stringify({
      scripts: {
        dev: "vite",
        build: "tsc --noEmit && vite build",
        test: "vitest",
        "test:ci": "vitest run --coverage --reporter=junit --outputFile=junit.xml",
      },
    }));
    runGit(product, ["add", "."]);
    runGit(product, ["commit", "-q", "-m", "init"]);

    const lab = path.join(temporary, "lab");
    const firstRun = path.join(lab, "runs", "2026-01-01-demo-flow-baseline-1");
    await mkdir(firstRun, { recursive: true });
    await mkdir(path.join(lab, "runs", "2026-01-02-demo-flow-extra-baseline-4"));
    await writeFile(path.join(firstRun, "work-item-baseline.json"), JSON.stringify({
      artifactType: "work-item-handoff",
      handoffPhase: "baseline",
      runId: "demo-flow-baseline-1",
      flowId: "demo-flow",
    }));
    await writeFile(path.join(firstRun, "demo-flow-flow-migrate-prompt.md"), "/flow-migrate\n");

    const savedStatus = path.join(temporary, "status.json");
    const context = await collectContext({
      "product-root": product,
      "lab-root": lab,
      "flow-id": "demo-flow",
      "run-dir": firstRun,
      commands: true,
      "save-status": savedStatus,
    });

    assert(context.product.clean && /^[0-9a-f]{40}$/.test(context.product.head),
      "a clean repository is not reported with its HEAD");
    assert(!Object.hasOwn(context.product, "blobs"), "content hashes leak into the output");
    assert(context.flow.nextRunId === "demo-flow-baseline-2",
      `the next runId is ${context.flow.nextRunId}; another flow's runs were counted`);
    assert(context.flow.handoffs.length === 1 && context.flow.promptFiles.length === 1,
      "the flow's earlier handoff or saved prompt was not found");
    assert(context.runDirectory.promptFiles.length === 1, "the run directory's prompt was not listed");
    const { scripts, suggested } = context.commands;
    assert(!scripts.test.terminates && !scripts.dev.terminates && scripts.build.terminates,
      "watch and server scripts are not told apart from terminating ones");
    assert(scripts["test:ci"].writesToWorktree, "a coverage script is not flagged as writing files");
    assert(suggested.test === "npm run test -- run <test file>" &&
      suggested.typecheck === "npx tsc --noEmit" && suggested.build === "npm run build",
      `unexpected suggestions ${JSON.stringify(suggested)}`);

    await writeFile(path.join(product, "README.md"), "changed\n");
    const firstChange = await collectContext({
      "product-root": product,
      compare: savedStatus,
      "save-status": savedStatus,
    });
    assert(firstChange.comparison.changed &&
      firstChange.comparison.added.includes(" M README.md"),
      "a newly modified file is not reported");

    await writeFile(path.join(product, "README.md"), "changed again\n");
    const secondChange = await collectContext({ "product-root": product, compare: savedStatus });
    assert(secondChange.comparison.changed &&
      secondChange.comparison.contentChanged.includes("README.md"),
      "a further change to an already dirty file is not reported");

    const unchanged = await collectContext({
      "product-root": product,
      compare: path.join(temporary, "status.json"),
    });
    assert(unchanged.comparison.contentChanged.length === 1,
      "the comparison is not stable across calls");

    const defaultSaved = await collectContext({ "product-root": product, "save-status": true });
    await writeFile(path.join(product, "extra.txt"), "new\n");
    const defaultCompared = await collectContext({ "product-root": product, compare: true });
    await rm(defaultSaved.savedStatus, { force: true });
    assert(path.dirname(defaultSaved.savedStatus) === os.tmpdir() &&
      defaultCompared.comparison.added.includes("?? extra.txt"),
      "the default status file does not round-trip through the temp directory");

    const contractPath = path.join(temporary, "flow-contract.json");
    await writeFile(contractPath, JSON.stringify({ scope: { allowedWritePaths: ["src\\"] } }));
    const allowlistSaved = path.join(temporary, "allowlist-status.json");
    await collectContext({ "product-root": product, "save-status": allowlistSaved });
    await mkdir(path.join(product, "src"));
    await writeFile(path.join(product, "src", "inside.txt"), "in\n");
    await writeFile(path.join(product, "srcfile.txt"), "out\n");
    await mkdir(path.join(product, "docs"));
    await writeFile(path.join(product, "docs", "committed.md"), "out\n");
    runGit(product, ["add", "docs/committed.md"]);
    runGit(product, ["commit", "-q", "-m", "outside"]);
    const checked = await collectContext({
      "product-root": product,
      contract: contractPath,
      compare: allowlistSaved,
    });
    assert(checked.allowlist.outside.includes("srcfile.txt") &&
      !checked.allowlist.outside.includes("src/inside.txt"),
      "a path that only shares the allowlist's prefix is treated as inside it");
    assert(JSON.stringify(checked.comparison.outsideAllowlist) ===
      JSON.stringify(["docs/committed.md", "srcfile.txt"]),
      `unexpected changes outside the allowlist ${JSON.stringify(checked.comparison.outsideAllowlist)}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Run context self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  if (options.help || process.argv.length <= 2) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
    return;
  }
  console.log(JSON.stringify(await collectContext(options), null, 2));
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
