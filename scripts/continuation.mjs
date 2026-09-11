import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// The same one-line invocation was assembled by hand at the end of every
// phase, and the rules for it drifted apart between skill and reference.

const usage = `Usage: node scripts/continuation.mjs --next <skill> --lab-root <dir> --product-root <dir> --run-dir <dir> [--flow <text>] [--save] [--flow-id <id>] <artifact>...

Prints the one-line invocation that starts the next phase in a fresh chat:
/<skill>, then --flow text when given, every artifact, the lab root, the
product root and the run directory, all as absolute paths. Every path must
exist. --save also writes it to <run-dir>\\<flowId>-<skill>-prompt.md, taking
flowId from the first artifact unless --flow-id is given; it never overwrites.

The artifacts must be the set the next phase validates first, or nothing is
printed: flow-migrate takes the contract and the baseline work-item snapshot;
flow-verify the contract, the migration result and both earlier snapshots,
plus debug-result after a repair; flow-debug the contract, the migration and
verification results, the debug handoff and both earlier snapshots.

Skills: flow-baseline, flow-migrate, flow-verify, flow-debug.
`;

const nextSkills = ["flow-baseline", "flow-migrate", "flow-verify", "flow-debug"];

// An invocation missing one of these reaches a chat that can only stop.
const artifactSets = {
  "flow-migrate": {
    required: ["flow-contract", "work-item-handoff:baseline"],
    optional: [],
  },
  "flow-verify": {
    required: [
      "flow-contract", "migration-result",
      "work-item-handoff:baseline", "work-item-handoff:migration",
    ],
    optional: ["debug-result"],
  },
  "flow-debug": {
    required: [
      "flow-contract", "migration-result", "verification-result", "debug-handoff",
      "work-item-handoff:baseline", "work-item-handoff:migration",
    ],
    optional: [],
  },
};

const artifactKind = async absolute => {
  let value;
  try {
    value = JSON.parse((await readFile(absolute, "utf8")).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${absolute} is not a JSON artifact.`);
  }
  return value.artifactType === "work-item-handoff"
    ? `work-item-handoff:${value.handoffPhase}`
    : String(value.artifactType);
};

const checkArtifactSet = async (next, artifacts) => {
  const expected = artifactSets[next];
  if (!expected) return;
  const remaining = await Promise.all(artifacts.map(artifactKind));
  const missing = [];
  for (const kind of expected.required) {
    const index = remaining.indexOf(kind);
    if (index === -1) missing.push(kind);
    else remaining.splice(index, 1);
  }
  const unexpected = remaining.filter(kind => !expected.optional.includes(kind));
  if (missing.length === 0 && unexpected.length === 0) return;
  const accepted = [
    ...expected.required,
    ...expected.optional.map(kind => `${kind} (optional)`),
  ];
  const problems = [
    ...(missing.length > 0 ? [`missing ${missing.join(", ")}`] : []),
    ...(unexpected.length > 0 ? [`unexpected ${unexpected.join(", ")}`] : []),
  ];
  throw new Error(`/${next} validates ${accepted.join(", ")}: ${problems.join(" and ")}.`);
};

const quote = value => (/\s/.test(value) ? `"${value}"` : value);

const requireExisting = async (value, kind) => {
  const absolute = path.resolve(value);
  let details;
  try {
    details = await stat(absolute);
  } catch {
    throw new Error(`No ${kind} at ${absolute}.`);
  }
  if (kind === "artifact" ? !details.isFile() : !details.isDirectory()) {
    throw new Error(`${absolute} is not a ${kind === "artifact" ? "file" : "directory"}.`);
  }
  return absolute;
};

const buildContinuation = async options => {
  if (!nextSkills.includes(options.next)) {
    throw new Error(`--next must be one of ${nextSkills.join(", ")}.\n\n${usage}`);
  }
  for (const name of ["lab-root", "product-root", "run-dir"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }

  const artifacts = [];
  for (const artifact of options.positional) {
    artifacts.push(await requireExisting(artifact, "artifact"));
  }
  await checkArtifactSet(options.next, artifacts);
  const labRoot = await requireExisting(options["lab-root"], "directory");
  const productRoot = await requireExisting(options["product-root"], "directory");
  const runDirectory = await requireExisting(options["run-dir"], "directory");

  const parts = [
    `/${options.next}`,
    ...(options.flow ? [options.flow] : []),
    ...artifacts,
    labRoot,
    productRoot,
    runDirectory,
  ];
  for (const part of parts) {
    // A pasted line is often relaunched through a shell, where ; splits it and
    // a quote inside a value ends the argument early.
    if (/[;"]/.test(part)) {
      throw new Error(`${part} contains ; or ", which breaks a pasted invocation.`);
    }
  }
  const invocation = parts.map(quote).join(" ");

  let savedPath;
  if (options.save) {
    let flowId = options["flow-id"];
    if (!flowId && artifacts.length > 0) {
      flowId = JSON.parse(
        (await readFile(artifacts[0], "utf8")).replace(/^\uFEFF/, ""),
      ).flowId;
    }
    if (!flowId) {
      throw new Error("--save needs a flowId: pass --flow-id or an artifact that carries one.");
    }
    savedPath = path.join(runDirectory, `${flowId}-${options.next}-prompt.md`);
    const content = [
      `# Resume ${flowId} with /${options.next}`,
      "",
      "Paste this line into a fresh chat. Every input is an artifact on disk, so",
      "it runs the same way whenever the chat is opened.",
      "",
      invocation,
      "",
    ].join("\n");
    try {
      await writeFile(savedPath, content, { flag: "wx" });
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error(`${savedPath} already exists; it is never overwritten.`);
      }
      throw error;
    }
  }
  return { invocation, savedPath };
};

const parseArguments = argumentsList => {
  const options = { positional: [] };
  const valued = new Set(["next", "lab-root", "product-root", "run-dir", "flow", "flow-id"]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (["--self-test", "--help", "--save"].includes(argument)) {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      options.positional.push(argument);
      continue;
    }
    if (!valued.has(name)) throw new Error(`Unknown option ${argument}.\n\n${usage}`);
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} needs a value.\n\n${usage}`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Continuation self-test failed: ${message}`);
};

const expectFailure = async (action, text, message) => {
  try {
    await action();
  } catch (error) {
    assert(error.message.includes(text), `${message} (got: ${error.message})`);
    return;
  }
  assert(false, message);
};

const runSelfTest = async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "continuation-"));
  try {
    const productRoot = path.join(temporary, "product root");
    const runDirectory = path.join(temporary, "run");
    const semicolonDirectory = path.join(temporary, "a;b");
    for (const directory of [productRoot, runDirectory, semicolonDirectory]) {
      await mkdir(directory);
    }
    const writeArtifact = async (name, value) => {
      const artifactPath = path.join(runDirectory, name);
      await writeFile(artifactPath, JSON.stringify({ flowId: "demo-flow", ...value }));
      return artifactPath;
    };
    const contract = await writeArtifact("flow-contract.json", { artifactType: "flow-contract" });
    const baselineSnapshot = await writeArtifact("work-item-baseline.json", {
      artifactType: "work-item-handoff",
      handoffPhase: "baseline",
    });
    const migrationSnapshot = await writeArtifact("work-item-migration.json", {
      artifactType: "work-item-handoff",
      handoffPhase: "migration",
    });
    const migrationResult = await writeArtifact("migration-result.json", {
      artifactType: "migration-result",
    });
    const debugResult = await writeArtifact("debug-result.json", { artifactType: "debug-result" });

    const options = {
      next: "flow-migrate",
      "lab-root": temporary,
      "product-root": productRoot,
      "run-dir": runDirectory,
      positional: [contract, baselineSnapshot],
      save: true,
    };
    const { invocation, savedPath } = await buildContinuation(options);
    assert(invocation.startsWith(`/flow-migrate ${contract} `),
      "the invocation does not start with the skill and its artifact");
    assert(invocation.includes(`"${productRoot}"`),
      "a path with a space is not quoted");
    assert(!invocation.includes("\n"), "the invocation spans more than one line");
    assert(path.basename(savedPath) === "demo-flow-flow-migrate-prompt.md",
      "the saved prompt is not named <flowId>-<skill>-prompt.md");
    assert((await readFile(savedPath, "utf8")).includes(invocation),
      "the saved prompt does not carry the invocation");

    await expectFailure(() => buildContinuation(options), "already exists",
      "a saved prompt was overwritten");
    await expectFailure(
      () => buildContinuation({ ...options, save: false, "run-dir": semicolonDirectory }),
      "contains ;",
      "a path with a semicolon was accepted");
    await expectFailure(
      () => buildContinuation({ ...options, save: false, positional: [path.join(runDirectory, "missing.json")] }),
      "No artifact",
      "a missing artifact was accepted");
    await expectFailure(
      () => buildContinuation({ ...options, save: false, next: "flow-deploy" }),
      "--next must be one of",
      "an unknown skill was accepted");
    await expectFailure(
      () => buildContinuation({
        ...options,
        save: false,
        next: "flow-verify",
        positional: [contract, migrationResult, baselineSnapshot],
      }),
      "missing work-item-handoff:migration",
      "a flow-verify invocation without the migration snapshot was accepted");
    await expectFailure(
      () => buildContinuation({
        ...options,
        save: false,
        positional: [contract, baselineSnapshot, migrationResult],
      }),
      "unexpected migration-result",
      "an artifact the next phase does not validate was accepted");
    const reverification = await buildContinuation({
      ...options,
      save: false,
      next: "flow-verify",
      positional: [contract, migrationResult, baselineSnapshot, migrationSnapshot, debugResult],
    });
    assert(reverification.invocation.startsWith("/flow-verify "),
      "a re-verification after a repair was refused");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Continuation self-test passed.");
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
  const { invocation, savedPath } = await buildContinuation(options);
  console.log(invocation);
  if (savedPath) console.log(`\nSaved to ${savedPath}.`);
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
