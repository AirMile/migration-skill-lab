import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  integrationBranch,
  outsideAllowlist,
  readAllowlist,
  readProductState,
  sliceBranch,
  statusPaths,
} from "./run-context.mjs";

const sha256 = raw => createHash("sha256").update(raw).digest("hex");

// A slice-branch or `feature/migrate-<flowId>` name, never `main` or a bare word.
const featureBranch = flowId => `feature/migrate-${flowId}`;

// Every slice used to migrate in the one product checkout, beside every
// earlier slice nobody had committed, so the allowlist check could no longer
// tell this run's writes from theirs. Each baseline run now gets its own
// branch and worktree off the integration branch, and its work reaches that
// branch only by a merge after its PASS.

const usage = `Usage: node scripts/slice-worktree.mjs <action> --product-root <dir> [options]

--product-root is the integration checkout: the product repository with
${integrationBranch} checked out.

Actions:
  --create --run-id <id>   branch ${sliceBranch("<id>")} off ${integrationBranch} into the
                           worktree <product-root>-slices\\<id>, then npm ci
                           there when it has a package-lock.json; prints the
                           worktree, the product root of every later phase
  --land --run-dir <dir>   after a PASS: commit the worktree's changes, only when
                           every one is inside the contract's
                           scope.allowedWritePaths, merge the branch into the
                           integration checkout with --no-ff and remove the
                           worktree; the branch stays; writes land-receipt.json
                           in the run directory, the fact migration-map.mjs and
                           run-context.mjs read back for "landed"
  --remove --run-id <id>   remove an abandoned claim's clean worktree, and its
                           branch when that holds no commit of its own
  --publish --run-dir <dir>
                           after a land-receipt.json: branch
                           feature/migrate-<flowId> off the integration
                           checkout's current HEAD and push it to origin; never
                           pushes ${integrationBranch} or main, never merges,
                           never force-pushes, never opens a merge request

Options:
  --no-install             skip npm ci on --create
  --self-test              run the built-in checks

It never pushes ${integrationBranch} or main, never stages a path outside the
allowlist and never forces.
`;

const git = (root, args) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });

const gitOrThrow = (root, args) => {
  const result = git(root, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${root}: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
};

const branchExists = (root, branch) =>
  git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;

const ownCommits = (root, branch) =>
  Number(gitOrThrow(root, ["rev-list", "--count", `${integrationBranch}..${branch}`]));

const exists = async filePath => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const readJson = async filePath =>
  JSON.parse((await readFile(filePath, "utf8")).replace(/^﻿/, ""));

const requireRunId = runId => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-baseline-[1-9]\d*$/.test(runId ?? "")) {
    throw new Error(`--run-id must be a baseline runId such as charger-form-baseline-1, not ${runId}.`);
  }
};

// Beside the product checkout rather than inside it, where every worktree
// would show up as untracked files.
export const worktreePath = (productRoot, runId) =>
  path.join(`${path.resolve(productRoot)}-slices`, runId);

const createWorktree = async ({ productRoot, runId, install }) => {
  requireRunId(runId);
  const root = readProductState(productRoot).root;
  if (!branchExists(root, integrationBranch)) {
    throw new Error(
      `${root} has no ${integrationBranch} branch. Create it once, from the revision the runs were ` +
        "measured on, before a slice claims a worktree.",
    );
  }
  const branch = sliceBranch(runId);
  if (branchExists(root, branch)) {
    throw new Error(`${branch} already exists; land it with --land or remove an abandoned claim with --remove.`);
  }
  const worktree = worktreePath(root, runId);
  if (await exists(worktree)) throw new Error(`${worktree} already exists.`);

  await mkdir(path.dirname(worktree), { recursive: true });
  gitOrThrow(root, ["worktree", "add", "-q", "-b", branch, worktree, integrationBranch]);

  // A fresh worktree has no node_modules, and ci installs the lockfile
  // exactly instead of rewriting it.
  let installed = false;
  if (install && await exists(path.join(worktree, "package-lock.json"))) {
    const npm = spawnSync("npm", ["ci"], {
      cwd: worktree,
      stdio: ["ignore", 2, 2],
      shell: process.platform === "win32",
    });
    if (npm.status !== 0) {
      throw new Error(`npm ci failed in ${worktree}; fix the cause and rerun it there, or --remove the worktree.`);
    }
    installed = true;
  }
  return {
    runId,
    branch,
    base: integrationBranch,
    worktree,
    head: gitOrThrow(worktree, ["rev-parse", "HEAD"]),
    installed,
  };
};

// The newest attempt decides: a PASS after a repair loop lands, a FAIL after
// an earlier PASS does not.
const latestVerification = async runDirectory => {
  const attempts = [];
  for (const file of await readdir(runDirectory)) {
    if (!/^verification-result(?:-[1-9]\d*)?\.json$/.test(file)) continue;
    const value = await readJson(path.join(runDirectory, file));
    attempts.push({ file: path.join(runDirectory, file), value });
  }
  attempts.sort((left, right) => (left.value.verificationAttempt ?? 0) - (right.value.verificationAttempt ?? 0));
  if (attempts.length === 0) throw new Error(`${runDirectory} holds no verification-result; only a verified slice lands.`);
  return attempts.at(-1);
};

// A path already staged in full, a staged rename or deletion among them, is
// no longer in the worktree for git add to match.
const pathsToStage = status => status
  .filter(entry => !(entry[0] !== " " && entry[0] !== "?" && entry[1] === " "))
  .map(entry => statusPaths(entry)[0]);

const landWorktree = async ({ productRoot, runDirectory }) => {
  const contractPath = path.join(path.resolve(runDirectory), "flow-contract.json");
  const contract = await readJson(contractPath);
  const { runId, flowId } = contract;
  requireRunId(runId);
  const allowed = await readAllowlist(contractPath);

  const verification = await latestVerification(path.resolve(runDirectory));
  if (verification.value.status !== "PASS" || verification.value.runId !== runId) {
    throw new Error(
      `${verification.file} is ${verification.value.status} for ${verification.value.runId}, ` +
        `not a PASS for ${runId}; only a verified slice lands.`,
    );
  }

  const integration = readProductState(productRoot);
  const root = integration.root;
  const worktree = path.resolve(contract.repository?.root ?? "");
  if (worktree.toLowerCase() === root.toLowerCase()) {
    throw new Error(`${runId} migrated in the integration checkout itself, before slice worktrees; commit it by hand.`);
  }
  if (integration.branch !== integrationBranch) {
    throw new Error(`${root} has ${integration.branch ?? "a detached HEAD"} checked out, not ${integrationBranch}.`);
  }
  if (!integration.clean) {
    throw new Error(`${root} has uncommitted changes (${integration.status.join(", ")}); the merge needs a clean checkout.`);
  }

  const branch = sliceBranch(runId);
  const slice = readProductState(worktree);
  if (slice.branch !== branch) {
    throw new Error(`${worktree} has ${slice.branch ?? "a detached HEAD"} checked out, not ${branch}.`);
  }
  const outside = outsideAllowlist(slice.status.flatMap(statusPaths), allowed);
  if (outside.length > 0) {
    throw new Error(`${worktree} changed paths outside scope.allowedWritePaths: ${outside.join(", ")}; nothing was committed.`);
  }

  let commit = null;
  if (!slice.clean) {
    const staged = pathsToStage(slice.status);
    if (staged.length > 0) gitOrThrow(worktree, ["add", "--", ...staged]);
    gitOrThrow(worktree, ["commit", "-q", "-m", `Migrate ${flowId} (${runId})`]);
    commit = gitOrThrow(worktree, ["rev-parse", "HEAD"]);
  }
  if (ownCommits(root, branch) === 0) throw new Error(`${branch} holds nothing to land.`);

  // Three dots: only what the slice changed since it last met the integration
  // branch, so merging that branch in to resolve a conflict does not count.
  const committed = gitOrThrow(root, ["diff", "--name-only", "-z", `${integrationBranch}...${branch}`])
    .split("\0").filter(Boolean);
  const committedOutside = outsideAllowlist(committed, allowed);
  if (committedOutside.length > 0) {
    throw new Error(`${branch} commits paths outside scope.allowedWritePaths: ${committedOutside.join(", ")}; nothing was merged.`);
  }

  const merge = git(root, ["merge", "--no-ff", "-q", "-m", `Land ${runId}`, branch]);
  if (merge.status !== 0) {
    git(root, ["merge", "--abort"]);
    throw new Error(
      `Merging ${branch} into ${integrationBranch} conflicts and was aborted: ${(merge.stdout + merge.stderr).trim()}. ` +
        `${integrationBranch} is unchanged and the slice's commit stays on ${branch}. Merge ` +
        `${integrationBranch} into ${branch} in ${worktree}, resolve, commit, and land again.`,
    );
  }

  const merged = gitOrThrow(root, ["rev-parse", "HEAD"]);

  // Written once the merge itself succeeded, so a receipt only ever attests a
  // fact this function just made true; a failed or missing worktree removal
  // below (a running dev server holds files open on Windows) does not undo it.
  const receipt = {
    schemaVersion: 1,
    artifactType: "land-receipt",
    runId,
    flowId,
    branch,
    integrationBranch,
    commit,
    merged,
    verification: { path: path.basename(verification.file), sha256: sha256(await readFile(verification.file)) },
    landedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(path.resolve(runDirectory), "land-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );

  // A running dev server holds files open on Windows; the merge stands either way.
  const removal = git(root, ["worktree", "remove", worktree]);
  return {
    runId,
    branch,
    commit,
    merged,
    worktreeRemoved: removal.status === 0,
    ...(removal.status === 0 ? {} : { worktreeRemoval: (removal.stderr || removal.stdout).trim() }),
  };
};

// A slice only publishes once its land-receipt exists: that is the one fact
// --land itself produced, unlike a PASS file anyone could copy in by hand.
const publishBranch = async ({ productRoot, runDirectory }) => {
  const runDirectoryPath = path.resolve(runDirectory);
  const receiptPath = path.join(runDirectoryPath, "land-receipt.json");
  if (!(await exists(receiptPath))) {
    throw new Error(`${runDirectoryPath} holds no land-receipt.json; land the slice with --land before publishing it.`);
  }
  const receipt = await readJson(receiptPath);
  if (receipt.artifactType !== "land-receipt") throw new Error(`${receiptPath} is not a land-receipt.`);
  const { runId, flowId } = receipt;
  requireRunId(runId);

  const integration = readProductState(productRoot);
  const root = integration.root;
  if (integration.branch !== integrationBranch) {
    throw new Error(`${root} has ${integration.branch ?? "a detached HEAD"} checked out, not ${integrationBranch}.`);
  }
  if (!integration.clean) {
    throw new Error(`${root} has uncommitted changes (${integration.status.join(", ")}); publishing needs a clean checkout.`);
  }
  if (git(root, ["merge-base", "--is-ancestor", receipt.merged, "HEAD"]).status !== 0) {
    throw new Error(`${root}'s HEAD no longer contains ${receipt.merged}; ${integrationBranch} moved since the land, check it before publishing.`);
  }

  const branch = featureBranch(flowId);
  if (branchExists(root, branch)) {
    throw new Error(`${branch} already exists; a slice publishes once. Remove it by hand to republish.`);
  }
  const remoteHead = git(root, ["ls-remote", "--exit-code", "--heads", "origin", branch]);
  if (remoteHead.status === 0) {
    throw new Error(`origin already has ${branch}; a slice publishes once. Remove it there to republish.`);
  }

  const head = gitOrThrow(root, ["rev-parse", "HEAD"]);
  gitOrThrow(root, ["branch", branch, head]);
  const push = git(root, ["push", "-u", "origin", branch]);
  if (push.status !== 0) {
    gitOrThrow(root, ["branch", "-D", branch]);
    throw new Error(`git push -u origin ${branch} failed: ${(push.stderr || push.stdout).trim()}`);
  }

  return { runId, flowId, branch, remote: "origin", commit: head, pushed: true };
};

const removeWorktree = async ({ productRoot, runId }) => {
  requireRunId(runId);
  const root = readProductState(productRoot).root;
  const worktree = worktreePath(root, runId);
  const branch = sliceBranch(runId);
  let worktreeRemoved = false;
  if (await exists(worktree)) {
    const state = readProductState(worktree);
    if (!state.clean) {
      throw new Error(`${worktree} has changes (${state.status.join(", ")}); an abandoned claim has none, so it stays.`);
    }
    gitOrThrow(root, ["worktree", "remove", worktree]);
    worktreeRemoved = true;
  }
  let branchRemoved = false;
  if (branchExists(root, branch)) {
    const own = ownCommits(root, branch);
    if (own > 0) throw new Error(`${branch} holds ${own} commit(s) of its own; it is not an abandoned claim.`);
    // -D because -d asks whether the current HEAD contains it; the count above
    // already proved the branch adds nothing to the integration branch.
    gitOrThrow(root, ["branch", "-D", branch]);
    branchRemoved = true;
  }
  if (!worktreeRemoved && !branchRemoved) throw new Error(`${runId} has no worktree or branch to remove.`);
  return { runId, worktree, worktreeRemoved, branch, branchRemoved };
};

const parseArguments = argumentsList => {
  const options = { install: true };
  const flags = new Set(["--self-test", "--help", "--create", "--land", "--remove", "--publish", "--no-install"]);
  const valued = new Set(["product-root", "run-id", "run-dir"]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (flags.has(argument)) {
      if (argument === "--no-install") options.install = false;
      else options[argument.slice(2)] = true;
      continue;
    }
    const name = argument.slice(2);
    if (!argument.startsWith("--") || !valued.has(name)) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} needs a value.\n\n${usage}`);
    options[name] = value;
    index += 1;
  }
  return options;
};

const run = async options => {
  const actions = ["create", "land", "remove", "publish"].filter(name => options[name]);
  if (actions.length !== 1) throw new Error(`Name exactly one of --create, --land, --publish and --remove.\n\n${usage}`);
  if (!options["product-root"]) throw new Error(`--product-root is required.\n\n${usage}`);
  const [action] = actions;
  if (action === "land") {
    if (!options["run-dir"]) throw new Error("--land needs --run-dir.");
    return landWorktree({ productRoot: options["product-root"], runDirectory: options["run-dir"] });
  }
  if (action === "publish") {
    if (!options["run-dir"]) throw new Error("--publish needs --run-dir.");
    return publishBranch({ productRoot: options["product-root"], runDirectory: options["run-dir"] });
  }
  const input = { productRoot: options["product-root"], runId: options["run-id"], install: options.install };
  return action === "create" ? createWorktree(input) : removeWorktree(input);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Slice worktree self-test failed: ${message}`);
};

const expectRefusal = async (action, text, message) => {
  try {
    await action();
  } catch (error) {
    assert(error.message.includes(text), `${message}: ${error.message}`);
    return;
  }
  assert(false, message);
};

const runSelfTest = async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "slice-worktree-"));
  // Commits in the throwaway repository must not depend on the user's Git
  // identity or signing setup.
  Object.assign(process.env, {
    GIT_AUTHOR_NAME: "Slice Worktree Self Test",
    GIT_AUTHOR_EMAIL: "slice-worktree-self-test@example.invalid",
    GIT_COMMITTER_NAME: "Slice Worktree Self Test",
    GIT_COMMITTER_EMAIL: "slice-worktree-self-test@example.invalid",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "commit.gpgsign",
    GIT_CONFIG_VALUE_0: "false",
  });
  try {
    const product = path.join(temporary, "product");
    const origin = path.join(temporary, "origin.git");
    await mkdir(path.join(product, "src"), { recursive: true });
    gitOrThrow(product, ["init", "-q"]);
    gitOrThrow(temporary, ["init", "-q", "--bare", "origin.git"]);
    gitOrThrow(product, ["remote", "add", "origin", origin]);
    await writeFile(path.join(product, ".gitignore"), "node_modules/\n");
    await writeFile(path.join(product, "src", "a.txt"), "base\n");
    await writeFile(path.join(product, "README.md"), "demo\n");
    gitOrThrow(product, ["add", "."]);
    gitOrThrow(product, ["commit", "-q", "-m", "init"]);

    const create = runId => run({ create: true, "product-root": product, "run-id": runId, install: false });
    await expectRefusal(() => create("demo-baseline-1"), `no ${integrationBranch} branch`,
      "a worktree was made without the integration branch");
    gitOrThrow(product, ["checkout", "-q", "-b", integrationBranch]);
    await expectRefusal(() => create("Demo"), "--run-id must be", "a runId that is not a baseline run was accepted");

    // An abandoned claim goes; ignored files such as node_modules do not keep it.
    const first = await create("demo-baseline-1");
    assert(first.worktree === path.join(`${product}-slices`, "demo-baseline-1") &&
      readProductState(first.worktree).branch === sliceBranch("demo-baseline-1") && !first.installed,
      `the worktree was not made on its branch: ${JSON.stringify(first)}`);
    await expectRefusal(() => create("demo-baseline-1"), "already exists", "a second worktree for one run was made");
    await mkdir(path.join(first.worktree, "node_modules"));
    await writeFile(path.join(first.worktree, "node_modules", "x.js"), "x\n");
    const removed = await run({ remove: true, "product-root": product, "run-id": "demo-baseline-1" });
    assert(removed.worktreeRemoved && removed.branchRemoved && !(await exists(first.worktree)) &&
      !branchExists(product, sliceBranch("demo-baseline-1")),
      `an abandoned claim was not removed: ${JSON.stringify(removed)}`);

    const second = await create("demo-baseline-2");
    const runDirectory = path.join(temporary, "run");
    await mkdir(runDirectory);
    await writeFile(path.join(runDirectory, "flow-contract.json"), JSON.stringify({
      artifactType: "flow-contract",
      runId: "demo-baseline-2",
      flowId: "demo",
      repository: { root: second.worktree, revision: second.head },
      scope: { allowedWritePaths: ["src\\"] },
    }));
    const verification = (attempt, status) => writeFile(
      path.join(runDirectory, attempt === 1 ? "verification-result.json" : `verification-result-${attempt}.json`),
      JSON.stringify({ artifactType: "verification-result", runId: "demo-baseline-2", status, verificationAttempt: attempt }),
    );
    const land = () => run({ land: true, "product-root": product, "run-dir": runDirectory });

    await writeFile(path.join(second.worktree, "src", "a.txt"), "slice\n");
    await writeFile(path.join(second.worktree, "src", "b.txt"), "new\n");
    await verification(1, "FAIL");
    await expectRefusal(land, "not a PASS", "a failed slice landed");
    await expectRefusal(() => run({ remove: true, "product-root": product, "run-id": "demo-baseline-2" }),
      "has changes", "a worktree with migrated work was removed as an abandoned claim");

    await verification(2, "PASS");
    await writeFile(path.join(second.worktree, "srcfile.txt"), "outside\n");
    await expectRefusal(land, "outside scope.allowedWritePaths: srcfile.txt", "a write outside the allowlist landed");
    assert(ownCommits(product, sliceBranch("demo-baseline-2")) === 0, "a refused land still committed");

    await rm(path.join(second.worktree, "srcfile.txt"));
    await writeFile(path.join(product, "README.md"), "dirty\n");
    await expectRefusal(land, "uncommitted changes", "a land merged into a dirty integration checkout");
    gitOrThrow(product, ["checkout", "--", "README.md"]);

    await mkdir(path.join(second.worktree, "node_modules"));
    await writeFile(path.join(second.worktree, "node_modules", "x.js"), "x\n");
    const landed = await land();
    assert(landed.commit && landed.worktreeRemoved && !(await exists(second.worktree)) &&
      gitOrThrow(product, ["show", `${integrationBranch}:src/b.txt`]) === "new" &&
      branchExists(product, sliceBranch("demo-baseline-2")) &&
      gitOrThrow(product, ["log", "-1", "--format=%s", integrationBranch]) === "Land demo-baseline-2",
      `a verified slice did not land: ${JSON.stringify(landed)}`);

    // --land wrote the one fact --publish trusts; a run with no receipt never
    // publishes, and a run that already published never does so twice.
    const receipt = JSON.parse(await readFile(path.join(runDirectory, "land-receipt.json"), "utf8"));
    assert(receipt.artifactType === "land-receipt" && receipt.runId === "demo-baseline-2" &&
      receipt.flowId === "demo" && receipt.branch === sliceBranch("demo-baseline-2") &&
      receipt.merged === landed.merged && receipt.commit === landed.commit,
      `--land did not write a matching land-receipt.json: ${JSON.stringify(receipt)}`);

    const publish = () => run({ publish: true, "product-root": product, "run-dir": runDirectory });
    const noReceiptDirectory = path.join(temporary, "no-receipt-run");
    await mkdir(noReceiptDirectory);
    await expectRefusal(() => run({ publish: true, "product-root": product, "run-dir": noReceiptDirectory }),
      "holds no land-receipt.json", "a slice published without a land-receipt");

    const published = await publish();
    assert(published.branch === "feature/migrate-demo" && published.remote === "origin" && published.pushed &&
      branchExists(product, "feature/migrate-demo") &&
      gitOrThrow(origin, ["rev-parse", "feature/migrate-demo"]) === published.commit,
      `a landed slice was not published: ${JSON.stringify(published)}`);
    await expectRefusal(publish, "already exists", "a slice published a second time");
    assert(!branchExists(product, integrationBranch.replace("migration", "main")) &&
      git(origin, ["rev-parse", "--verify", "--quiet", "refs/heads/main"]).status !== 0,
      "publishing pushed something to main");

    // Two slices that touch the same file: the second merge conflicts, aborts
    // and leaves the integration branch as it was.
    const third = await create("demo-baseline-3");
    await writeFile(path.join(runDirectory, "flow-contract.json"), JSON.stringify({
      artifactType: "flow-contract",
      runId: "demo-baseline-3",
      flowId: "demo",
      repository: { root: third.worktree, revision: third.head },
      scope: { allowedWritePaths: ["src"] },
    }));
    for (const file of await readdir(runDirectory)) {
      if (file.startsWith("verification-result")) await rm(path.join(runDirectory, file));
    }
    await writeFile(path.join(runDirectory, "verification-result.json"), JSON.stringify({
      artifactType: "verification-result", runId: "demo-baseline-3", status: "PASS", verificationAttempt: 1,
    }));
    await writeFile(path.join(third.worktree, "src", "a.txt"), "third slice\n");
    await writeFile(path.join(product, "src", "a.txt"), "landed meanwhile\n");
    gitOrThrow(product, ["commit", "-q", "-am", "another slice"]);
    const before = gitOrThrow(product, ["rev-parse", "HEAD"]);
    await expectRefusal(land, "conflicts and was aborted", "a conflicting merge was not aborted");
    assert(gitOrThrow(product, ["rev-parse", "HEAD"]) === before && readProductState(product).clean &&
      ownCommits(product, sliceBranch("demo-baseline-3")) === 1 && readProductState(third.worktree).clean,
      "an aborted merge left the integration checkout changed or lost the slice's commit");
  } finally {
    const product = path.join(temporary, "product");
    if (await exists(product)) git(product, ["worktree", "prune"]);
    await rm(`${product}-slices`, { recursive: true, force: true });
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Slice worktree self-test passed.");
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
  console.log(JSON.stringify(await run(options), null, 2));
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
