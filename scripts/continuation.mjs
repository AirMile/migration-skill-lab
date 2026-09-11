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
Like the files of the phase it starts, the name adds -<N> from verification
attempt 2 on, such as <flowId>-flow-verify-prompt-2.md: flow-debug takes N
from the verification-result's verificationAttempt, and flow-verify is one
more than the attempt its debug-result answers (debug-result.json answers 1,
debug-result-<N>.json answers N).

The artifacts must be the set the next phase validates first, or nothing is
printed: flow-migrate takes the contract and the baseline work-item snapshot;
flow-verify the contract, the migration result and both earlier snapshots,
plus debug-result after a repair; flow-debug the contract, the migration and
verification results, the debug handoff and both earlier snapshots;
flow-baseline nothing, or the migration-map that proposed its slice, with
--flow-id to save; flow-plan nothing, or the verification-result that passed.

Skills: flow-plan, flow-baseline, flow-migrate, flow-verify, flow-debug.
`;

const nextSkills = ["flow-plan", "flow-baseline", "flow-migrate", "flow-verify", "flow-debug"];

// An invocation missing one of these reaches a chat that can only stop.
const artifactSets = {
  "flow-plan": {
    required: [],
    optional: ["verification-result"],
  },
  "flow-baseline": {
    required: [],
    optional: ["migration-map"],
  },
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

const readArtifact = async absolute => {
  try {
    return JSON.parse((await readFile(absolute, "utf8")).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${absolute} is not a JSON artifact.`);
  }
};

const artifactKind = async absolute => {
  const value = await readArtifact(absolute);
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

// A later repair loop would otherwise meet the prompt an earlier attempt
// saved: refused as already existing, or resumed from as if it were its own.
const promptAttempt = async (next, artifacts) => {
  for (const absolute of artifacts) {
    const value = await readArtifact(absolute);
    if (next === "flow-debug" && value.artifactType === "verification-result") {
      const attempt = value.verificationAttempt;
      if (!Number.isInteger(attempt) || attempt < 1) {
        throw new Error(`${absolute} records no verificationAttempt to name the prompt by.`);
      }
      return attempt;
    }
    if (next === "flow-verify" && value.artifactType === "debug-result") {
      const answered = /^debug-result(?:-([1-9]\d*))?\.json$/.exec(path.basename(absolute));
      if (!answered) {
        throw new Error(
          `${absolute} does not name the verification attempt it answers: call it debug-result.json or debug-result-<N>.json.`,
        );
      }
      return Number(answered[1] ?? 1) + 1;
    }
  }
  return 1;
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
      flowId = (await readArtifact(artifacts[0])).flowId;
    }
    if (!flowId) {
      throw new Error("--save needs a flowId: pass --flow-id or an artifact that carries one.");
    }
    const attempt = await promptAttempt(options.next, artifacts);
    savedPath = path.join(
      runDirectory,
      `${flowId}-${options.next}-prompt${attempt > 1 ? `-${attempt}` : ""}.md`,
    );
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
    const verificationResult = await writeArtifact("verification-result.json", {
      artifactType: "verification-result",
      verificationAttempt: 1,
    });
    const debugHandoff = await writeArtifact("debug-handoff.json", { artifactType: "debug-handoff" });
    const secondVerification = await writeArtifact("verification-result-2.json", {
      artifactType: "verification-result",
      verificationAttempt: 2,
    });
    const secondHandoff = await writeArtifact("debug-handoff-2.json", { artifactType: "debug-handoff" });
    const secondDebugResult = await writeArtifact("debug-result-2.json", {
      artifactType: "debug-result",
    });
    const unnamedDebugResult = await writeArtifact("repair.json", { artifactType: "debug-result" });

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

    // Two repair loops save a prompt at every hand-over into one run directory,
    // each named for the attempt of the phase it starts.
    const verifyInputs = [contract, migrationResult, baselineSnapshot, migrationSnapshot];
    const debugInputs = (verification, handoff) =>
      [contract, migrationResult, verification, handoff, baselineSnapshot, migrationSnapshot];
    const loops = [
      ["flow-verify", verifyInputs, "demo-flow-flow-verify-prompt.md"],
      ["flow-debug", debugInputs(verificationResult, debugHandoff), "demo-flow-flow-debug-prompt.md"],
      ["flow-verify", [...verifyInputs, debugResult], "demo-flow-flow-verify-prompt-2.md"],
      ["flow-debug", debugInputs(secondVerification, secondHandoff), "demo-flow-flow-debug-prompt-2.md"],
      ["flow-verify", [...verifyInputs, secondDebugResult], "demo-flow-flow-verify-prompt-3.md"],
    ];
    for (const [next, positional, expected] of loops) {
      const saved = await buildContinuation({ ...options, next, positional });
      assert(saved.invocation.startsWith(`/${next} `), `a /${next} continuation was refused`);
      assert(path.basename(saved.savedPath) === expected,
        `the prompt ${expected} was saved as ${path.basename(saved.savedPath)}`);
    }
    await expectFailure(
      () => buildContinuation({
        ...options,
        next: "flow-verify",
        positional: [...verifyInputs, unnamedDebugResult],
      }),
      "does not name the verification attempt",
      "a prompt was saved for a debug-result whose attempt is unknown");

    // flow-plan hands flow-baseline the map and the flowId the user chose.
    const migrationMap = path.join(runDirectory, "migration-map.json");
    await writeFile(migrationMap, JSON.stringify({ artifactType: "migration-map" }));
    const baselineFromMap = await buildContinuation({
      ...options,
      next: "flow-baseline",
      flow: "Charger form",
      "flow-id": "charger-form",
      positional: [migrationMap],
    });
    assert(baselineFromMap.invocation.startsWith(`/flow-baseline "Charger form" ${migrationMap} `),
      "the flow-baseline invocation does not carry the flow text and the map");
    assert(path.basename(baselineFromMap.savedPath) === "charger-form-flow-baseline-prompt.md",
      "the flow-baseline prompt is not named for the chosen flowId");
    await expectFailure(
      () => buildContinuation({ ...options, save: false, next: "flow-baseline", positional: [contract] }),
      "unexpected flow-contract",
      "flow-baseline accepted an artifact other than the map");
    const planAfterPass = await buildContinuation({
      ...options,
      save: false,
      next: "flow-plan",
      positional: [verificationResult],
    });
    assert(planAfterPass.invocation.startsWith(`/flow-plan ${verificationResult} `),
      "a PASS does not continue into flow-plan with its verification-result");
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
