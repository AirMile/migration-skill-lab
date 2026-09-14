import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { baselineRuns, listNumberedRuns, scanRuns } from "./run-index.mjs";

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
  --map                  the latest earlier migration-map.json and the next
                         map run directory and runId; needs --lab-root
  --ready [map]          the slices of a migration map, the latest without a
                         file, that a new baseline may take: open slices whose
                         dependencies landed, in the map or by a PASS not yet
                         seeded, with no baseline run in flight and either no
                         run yet or a PASS that left a remainder; queued ones
                         first, each with its reason, remainder and the unbuilt
                         prerequisites it shares with slices a baseline is
                         already working on, plus each unbuilt prerequisite
                         two or more available slices share, and replan when
                         no slice is available; needs --lab-root
  --claim                create the next baseline run directory for --flow-id,
                         refused while the flow has an open run; mkdir is
                         atomic, so two chats cannot claim one run
  --release              remove the flow's open baseline run directory, only
                         when it is empty: an abandoned claim
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

// continuation.mjs --save names a prompt for the attempt it starts, with -<N>
// from verification attempt 2 on.
const promptFilePattern = /-prompt(?:-\d+)?\.md$/;

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

const readMap = async labRoot => {
  const runsDirectory = path.resolve(labRoot, "runs");
  const { runs, next } = await listNumberedRuns(runsDirectory, "migration-map");
  let previousMap = null;
  for (const run of [...runs].reverse()) {
    const candidate = path.join(runsDirectory, run.name, "migration-map.json");
    if (await exists(candidate)) {
      previousMap = candidate;
      break;
    }
  }
  return {
    runs: runs.map(run => path.join(runsDirectory, run.name)),
    previousMap,
    nextRunDirectory: path.join(runsDirectory, `${localDate()}-migration-map-${next}`),
    nextRunId: `migration-map-${next}`,
  };
};

const readFlow = async (labRoot, flowId) => {
  const runsDirectory = path.resolve(labRoot, "runs");
  const { runs, next } = await listNumberedRuns(runsDirectory, `${flowId}-baseline`);

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
      } else if (file.startsWith(`${flowId}-`) && promptFilePattern.test(file)) {
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

const readReady = async (labRoot, mapFile, productHead) => {
  const mapPath = mapFile ? path.resolve(mapFile) : (await readMap(labRoot)).previousMap;
  if (!mapPath) {
    return { map: null, queue: [], active: [], slices: [], replan: true, replanReason: "no migration map; run /flow-plan" };
  }
  const map = JSON.parse((await readFile(mapPath, "utf8")).replace(/^﻿/, ""));
  if (map.artifactType !== "migration-map") throw new Error(`${mapPath} is not a migration-map.`);

  const { passes } = await scanRuns(labRoot);
  const landed = new Set(map.slices
    .filter(slice => slice.status === "landed" ||
      (passes.has(slice.flowId) && passes.get(slice.flowId).remainder === null))
    .map(slice => slice.flowId));
  const unbuilt = new Set(map.prerequisites
    .filter(prerequisite => prerequisite.angular?.status !== "built")
    .map(prerequisite => prerequisite.id));
  const runStates = new Map();
  for (const slice of map.slices) {
    const { runs } = await baselineRuns(labRoot, slice.flowId);
    const pass = passes.get(slice.flowId);
    const passRun = runs.find(run => pass && run.directory === path.dirname(pass.filePath)) ??
      runs.findLast(run => run.pass);
    runStates.set(slice.flowId, {
      count: runs.length,
      inFlight: runs.some(run => run.open || (run.contract && !run.pass)),
      remainder: pass?.remainder ?? null,
      laterRuns: Boolean(passRun) && runs.some(run => run.number > passRun.number),
    });
  }
  // Queued slices, from schemaVersion 2; before it the one chosen slice.
  const queue = map.schemaVersion >= 2 ?
    map.recommendation?.queue ?? [] :
    map.recommendation?.chosen ? [map.recommendation.chosen] : [];
  const options = map.recommendation?.options ?? [];

  const sharedUnbuilt = (slice, others) => others
    .filter(other => other.flowId !== slice.flowId)
    .map(other => ({
      flowId: other.flowId,
      prerequisites: slice.requires.filter(id => unbuilt.has(id) && other.requires.includes(id)),
    }))
    .filter(entry => entry.prerequisites.length > 0);

  const active = map.slices.filter(slice => !landed.has(slice.flowId) && runStates.get(slice.flowId).inFlight);
  const candidates = map.slices
    .filter(slice => !landed.has(slice.flowId) && ["candidate", "in-progress"].includes(slice.status))
    .map(slice => {
      const openDependencies = slice.dependsOn.filter(id => !landed.has(id));
      const { count, inFlight, remainder, laterRuns } = runStates.get(slice.flowId);
      // Any run after the partial PASS, a failed or blocked one included, needs a person.
      return {
        slice,
        openDependencies,
        available: openDependencies.length === 0 && !inFlight &&
          (count === 0 || (remainder !== null && !laterRuns)),
      };
    });
  const available = candidates.filter(entry => entry.available).map(entry => entry.slice);

  const rank = flowId => {
    const queued = queue.indexOf(flowId);
    if (queued !== -1) return queued;
    const offered = options.findIndex(option => option.flowId === flowId);
    return offered !== -1 ? queue.length + offered : queue.length + options.length;
  };
  const slices = candidates
    .map((entry, order) => ({ ...entry, order }))
    .sort((left, right) => rank(left.slice.flowId) - rank(right.slice.flowId) || left.order - right.order)
    .map(({ slice, openDependencies, available: isAvailable }) => ({
      flowId: slice.flowId,
      title: slice.title,
      queuePosition: queue.includes(slice.flowId) ? queue.indexOf(slice.flowId) + 1 : null,
      reason: options.find(option => option.flowId === slice.flowId)?.reason ?? null,
      openDependencies,
      baselineRuns: runStates.get(slice.flowId).count,
      inFlight: runStates.get(slice.flowId).inFlight,
      remainder: runStates.get(slice.flowId).remainder,
      available: isAvailable,
      ...(isAvailable ? { sharesUnbuiltWithActive: sharedUnbuilt(slice, active) } : {}),
    }));

  // Per prerequisite rather than per pair: within one feature most slices
  // share the same few, and a pairwise list grows with the square.
  const unbuiltSharedByAvailable = [...unbuilt]
    .map(id => ({ prerequisite: id, slices: available.filter(slice => slice.requires.includes(id)).map(slice => slice.flowId) }))
    .filter(entry => entry.slices.length >= 2)
    .sort((left, right) => right.slices.length - left.slices.length || left.prerequisite.localeCompare(right.prerequisite));

  return {
    map: {
      path: mapPath,
      runId: map.runId,
      schemaVersion: map.schemaVersion,
      revision: map.repository?.revision ?? null,
      productMoved: Boolean(map.repository?.revision) && map.repository.revision !== productHead,
    },
    queue,
    active: active.map(slice => slice.flowId),
    slices,
    unbuiltSharedByAvailable,
    replan: available.length === 0,
    replanReason: available.length === 0 ? "no slice is available; run /flow-plan" : null,
  };
};

// Claimed at the start of a baseline, so a second chat never takes the same
// slice. The empty directory is the claim; the contract closes it.
const claimRun = async (labRoot, flowId) => {
  const { runs } = await baselineRuns(labRoot, flowId);
  const open = runs.filter(run => run.open);
  if (open.length > 0) {
    throw new Error(
      `${flowId} already has an open baseline run at ${open.map(run => run.directory).join(", ")}: ` +
        "another chat holds it, or an abandoned claim can be removed with --release.",
    );
  }
  const flow = await readFlow(labRoot, flowId);
  await mkdir(path.dirname(flow.nextRunDirectory), { recursive: true });
  try {
    await mkdir(flow.nextRunDirectory);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`${flow.nextRunDirectory} was claimed by another chat a moment ago.`);
    }
    throw error;
  }
  return { directory: flow.nextRunDirectory, runId: flow.nextRunId };
};

const releaseRun = async (labRoot, flowId) => {
  const open = (await baselineRuns(labRoot, flowId)).runs.filter(run => run.open);
  if (open.length === 0) throw new Error(`${flowId} has no open baseline run to release.`);
  const holding = open.filter(run => run.files.length > 0);
  if (holding.length > 0) {
    throw new Error(
      holding.map(run => `${run.directory} holds ${run.files.join(", ")}`).join("; ") +
        "; a run that wrote something is not an abandoned claim and is not removed.",
    );
  }
  // rmdir refuses a directory that is not empty, even if one fills meanwhile.
  for (const run of open) await rmdir(run.directory);
  return open.map(run => run.directory);
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
    promptFiles: files.filter(file => promptFilePattern.test(file)),
  };
};

const defaultStatusPath = productRoot =>
  path.join(
    os.tmpdir(),
    `run-context-${createHash("sha256").update(productRoot.toLowerCase()).digest("hex").slice(0, 12)}.json`,
  );

const collectContext = async options => {
  if (!options["product-root"]) throw new Error(`--product-root is required.\n\n${usage}`);
  for (const name of ["flow-id", "map", "ready"]) {
    if (options[name] && !options["lab-root"]) {
      throw new Error(`--${name} needs --lab-root, where the runs directory lives.`);
    }
  }
  for (const name of ["claim", "release"]) {
    if (options[name] && !options["flow-id"]) throw new Error(`--${name} needs --flow-id.`);
  }
  if (options.claim && options.release) throw new Error("--claim and --release cannot be combined.");

  const state = readProductState(options["product-root"]);
  const { blobs, ...product } = state;
  const context = { product };

  const claimed = options.claim ? await claimRun(options["lab-root"], options["flow-id"]) : null;
  const released = options.release ? await releaseRun(options["lab-root"], options["flow-id"]) : null;
  if (options["flow-id"]) {
    context.flow = await readFlow(options["lab-root"], options["flow-id"]);
    if (claimed) context.flow.claimed = claimed;
    if (released) context.flow.released = released;
  }
  if (options.map) context.map = await readMap(options["lab-root"]);
  if (options.ready) {
    context.ready = await readReady(options["lab-root"], options.ready === true ? null : options.ready, state.head);
  }
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
    "contract", "ready",
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (["--self-test", "--help", "--commands", "--map", "--claim", "--release"].includes(argument)) {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--") || !valued.has(name)) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      if (name === "save-status" || name === "compare" || name === "ready") {
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
    await writeFile(path.join(firstRun, "demo-flow-flow-verify-prompt-2.md"), "/flow-verify\n");

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
    assert(context.flow.handoffs.length === 1 && context.flow.promptFiles.length === 2,
      "the flow's earlier handoff or a saved prompt, attempt-numbered ones included, was not found");
    assert(context.runDirectory.promptFiles.length === 2, "the run directory's prompts were not listed");

    // A map run that stopped before writing its map does not hide the one before it.
    const firstMapRun = path.join(lab, "runs", "2026-01-01-migration-map-1");
    await mkdir(firstMapRun);
    await writeFile(path.join(firstMapRun, "migration-map.json"), "{}\n");
    await mkdir(path.join(lab, "runs", "2026-01-02-migration-map-2"));
    const mapContext = await collectContext({ "product-root": product, "lab-root": lab, map: true });
    assert(mapContext.map.previousMap === path.join(firstMapRun, "migration-map.json") &&
      mapContext.map.nextRunId === "migration-map-3",
      `the map context is ${JSON.stringify(mapContext.map)}`);
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

    // A map queues slices and each baseline claims one, so parallel chats
    // never take the same slice.
    const queuedMapPath = path.join(lab, "runs", "2026-01-03-migration-map-3", "migration-map.json");
    await mkdir(path.dirname(queuedMapPath), { recursive: true });
    const slice = (flowId, extra = {}) => ({
      flowId, featureId: "demo", title: flowId, paths: [`src/${flowId}`],
      dependsOn: [], requires: [], criteria: {}, status: "candidate", ...extra,
    });
    const queuedMap = {
      schemaVersion: 2,
      artifactType: "migration-map",
      runId: "migration-map-3",
      repository: { root: product, revision: "0".repeat(40) },
      slices: [
        slice("alpha", { requires: ["p1", "p2"] }),
        slice("beta", { requires: ["p1"] }),
        slice("gamma", { dependsOn: ["delta"] }),
        slice("delta", { status: "in-progress" }),
        slice("epsilon", { dependsOn: ["zeta"], requires: ["p1"] }),
        slice("zeta", { requires: ["p1"] }),
      ],
      prerequisites: [
        { id: "p1", angular: { status: "none" } },
        { id: "p2", angular: { status: "built" } },
      ],
      recommendation: {
        options: [
          { flowId: "alpha", reason: "First." },
          { flowId: "beta", reason: "Second." },
          { flowId: "gamma", reason: "Third." },
        ],
        queue: ["alpha", "beta"],
      },
    };
    await writeFile(queuedMapPath, JSON.stringify(queuedMap));
    const deltaRun = path.join(lab, "runs", "2026-01-03-delta-baseline-1");
    await mkdir(deltaRun);
    await writeFile(path.join(deltaRun, "verification-result.json"),
      JSON.stringify({ artifactType: "verification-result", status: "PASS", flowId: "delta" }));

    const expectRefusal = async (options, text, message) => {
      try {
        await collectContext(options);
      } catch (error) {
        assert(error.message.includes(text), `${message}: ${error.message}`);
        return;
      }
      assert(false, message);
    };
    const inLab = { "product-root": product, "lab-root": lab };

    const claimedBeta = await collectContext({ ...inLab, "flow-id": "beta", claim: true });
    assert(claimedBeta.flow.claimed.runId === "beta-baseline-1" &&
      (await stat(claimedBeta.flow.claimed.directory)).isDirectory(),
      "a claim did not create the flow's next baseline run directory");
    await expectRefusal({ ...inLab, "flow-id": "beta", claim: true }, "already has an open baseline run",
      "a second claim on an open run was not refused");

    const { ready } = await collectContext({ ...inLab, ready: queuedMapPath });
    const byFlow = new Map(ready.slices.map(entry => [entry.flowId, entry]));
    assert(JSON.stringify(ready.slices.map(entry => entry.flowId)) ===
      JSON.stringify(["alpha", "beta", "gamma", "epsilon", "zeta"]),
      `ready slices are not ordered queue, options, map: ${ready.slices.map(entry => entry.flowId)}`);
    assert(byFlow.get("alpha").available && byFlow.get("alpha").queuePosition === 1,
      "a queued, unclaimed slice is not available first");
    assert(!byFlow.get("beta").available && byFlow.get("beta").baselineRuns === 1,
      "a claimed slice is still offered");
    assert(byFlow.get("gamma").available,
      "a dependency landed by a PASS the map has not seeded still blocks its parent");
    assert(!byFlow.get("epsilon").available &&
      JSON.stringify(byFlow.get("epsilon").openDependencies) === JSON.stringify(["zeta"]),
      "an open dependency does not block a slice");
    assert(JSON.stringify(ready.active) === JSON.stringify(["beta"]),
      `active slices are ${JSON.stringify(ready.active)}`);
    assert(JSON.stringify(byFlow.get("alpha").sharesUnbuiltWithActive) ===
      JSON.stringify([{ flowId: "beta", prerequisites: ["p1"] }]),
      `alpha's overlap with active slices is ${JSON.stringify(byFlow.get("alpha").sharesUnbuiltWithActive)}`);
    assert(JSON.stringify(ready.unbuiltSharedByAvailable) ===
      JSON.stringify([{ prerequisite: "p1", slices: ["alpha", "zeta"] }]),
      `unbuilt prerequisites shared by available slices are ${JSON.stringify(ready.unbuiltSharedByAvailable)}`);
    assert((await collectContext({ ...inLab, ready: true })).ready.map.path === queuedMapPath,
      "--ready without a file does not read the latest map");

    const v1Path = path.join(path.dirname(queuedMapPath), "v1-map.json");
    await writeFile(v1Path, JSON.stringify({
      ...queuedMap,
      schemaVersion: 1,
      recommendation: { options: queuedMap.recommendation.options, chosen: "gamma" },
    }));
    assert(JSON.stringify((await collectContext({ ...inLab, ready: v1Path })).ready.queue) === JSON.stringify(["gamma"]),
      "a schemaVersion 1 map's chosen slice is not read as its queue");
    assert(ready.replan === false && ready.replanReason === null, "a map with an available slice asks to replan");

    // A PASS on part of a slice hands the rest to the next chain; a contract
    // that has not passed yet is still in flight.
    const writeRun = async (name, files) => {
      const directory = path.join(lab, "runs", name);
      await mkdir(directory);
      for (const [file, value] of Object.entries(files)) {
        await writeFile(path.join(directory, file), JSON.stringify(value));
      }
    };
    const contractFor = (flowId, remainder) => ({
      artifactType: "flow-contract", flowId,
      ...(remainder === undefined ? {} : { planSlice: { map: {}, flowId, remainder } }),
    });
    const passFor = flowId => ({ artifactType: "verification-result", status: "PASS", flowId });
    await writeRun("2026-01-04-eta-baseline-1", {
      "flow-contract.json": contractFor("eta", "the angle field"),
      "verification-result.json": passFor("eta"),
    });
    await writeRun("2026-01-04-theta-baseline-1", { "flow-contract.json": contractFor("theta") });
    const partialMapPath = path.join(path.dirname(queuedMapPath), "partial-map.json");
    await writeFile(partialMapPath, JSON.stringify({
      ...queuedMap,
      slices: [
        slice("eta", { status: "in-progress" }),
        slice("theta"),
        slice("iota", { dependsOn: ["eta"] }),
      ],
      recommendation: { options: [], queue: [] },
    }));
    const partialReady = (await collectContext({ ...inLab, ready: partialMapPath })).ready;
    const partialByFlow = new Map(partialReady.slices.map(entry => [entry.flowId, entry]));
    assert(partialByFlow.get("eta")?.available && partialByFlow.get("eta").remainder === "the angle field" &&
      !partialByFlow.get("eta").inFlight && !partialReady.active.includes("eta"),
      `a slice whose PASS left a remainder is not offered again: ${JSON.stringify(partialByFlow.get("eta"))}`);
    assert(partialByFlow.get("theta").inFlight && !partialByFlow.get("theta").available &&
      JSON.stringify(partialReady.active) === JSON.stringify(["theta"]),
      `a contract without a PASS is not in flight: ${JSON.stringify(partialByFlow.get("theta"))}`);
    assert(JSON.stringify(partialByFlow.get("iota").openDependencies) === JSON.stringify(["eta"]),
      "a dependency with only a partial PASS counts as landed");
    assert(partialReady.replan === false, "a map with a partial slice available asks to replan");

    await writeRun("2026-01-04-kappa-baseline-1", {
      "flow-contract.json": contractFor("kappa", "the distances"),
      "verification-result.json": passFor("kappa"),
    });
    await writeRun("2026-01-05-kappa-baseline-2", {
      "skill-run-observations-flow-baseline.json": { artifactType: "skill-run-observations" },
    });
    const blockedMapPath = path.join(path.dirname(queuedMapPath), "blocked-map.json");
    await writeFile(blockedMapPath, JSON.stringify({
      ...queuedMap, slices: [slice("kappa", { status: "in-progress" })], recommendation: { options: [], queue: [] },
    }));
    const blockedKappa = (await collectContext({ ...inLab, ready: blockedMapPath })).ready.slices[0];
    assert(blockedKappa.remainder === "the distances" && !blockedKappa.inFlight && !blockedKappa.available,
      `a partial slice whose later run closed without a contract is offered again: ${JSON.stringify(blockedKappa)}`);

    const stuckMapPath = path.join(path.dirname(queuedMapPath), "stuck-map.json");
    await writeFile(stuckMapPath, JSON.stringify({
      ...queuedMap,
      slices: [slice("theta"), slice("iota", { dependsOn: ["theta"] })],
      recommendation: { options: [], queue: [] },
    }));
    const stuckReady = (await collectContext({ ...inLab, ready: stuckMapPath })).ready;
    assert(stuckReady.replan === true && stuckReady.replanReason.includes("/flow-plan"),
      `a map with no available slice does not ask to replan: ${JSON.stringify(stuckReady)}`);

    const releasedBeta = await collectContext({ ...inLab, "flow-id": "beta", release: true });
    assert(releasedBeta.flow.released.length === 1 && !(await exists(claimedBeta.flow.claimed.directory)),
      "an abandoned, empty claim was not released");
    const reclaimed = await collectContext({ ...inLab, "flow-id": "beta", claim: true });
    await writeFile(path.join(reclaimed.flow.claimed.directory, "notes.txt"), "draft\n");
    await expectRefusal({ ...inLab, "flow-id": "beta", release: true }, "is not an abandoned claim",
      "a run that wrote a file was released");
    assert(await exists(reclaimed.flow.claimed.directory), "a refused release removed the run anyway");
    await writeFile(path.join(reclaimed.flow.claimed.directory, "flow-contract.json"), "{}\n");
    assert((await collectContext({ ...inLab, "flow-id": "beta", claim: true })).flow.claimed.runId === "beta-baseline-2",
      "a finished baseline run blocked a rerun's claim");
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
