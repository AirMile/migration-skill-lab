import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The observation sidecar has had a scaffold since new-observations.mjs, and no
// run has recorded an output-mismatch for it. The four artifacts below had
// none, and every output-mismatch a run recorded is one of them: a repository
// root retyped from the command line, two pointer hashes transposed, a
// validation entry the contract never declared, a checkpoint block written
// while checkpoints are disabled. None of that is judgement. The run's judgement
// is the diagnosis, the evidence and the verdict; the envelope around it is
// derivable from the artifacts it already consumes.

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const validatorPath = path.join(rootDirectory, "scripts", "validate-handoff.mjs");

const usage = `Usage:
  node scripts/new-result.mjs --artifact <type> --status <status> --skill-version <x.y.z> <upstream.json>... [options]
  node scripts/new-result.mjs --check <artifact.json>

Writes the next artifact in the chain with every derivable field filled and
every judgement field left as a placeholder, so it validates on the first pass
and the run only has to say what it found. Never overwrites.

Artifacts and the upstream files each one needs:
  migration-result      flow-contract
  debug-handoff         flow-contract, migration-result, verification-result
  debug-result          flow-contract, migration-result, verification-result,
                        debug-handoff
  verification-result   flow-contract, migration-result, and debug-result after
                        a repair

Upstream files are recognized by their own artifactType, so their order does not
matter. Derived from them: the schemaVersion, the artifact type, skill and ids,
every pointer with its sha256, repository.root copied from the contract, one
validation entry per command the contract declares and nothing else, one
criterion per scenario, one visual criterion per visualParity surface, one
characterization entry per hypothesis, the attempt number with the -<N> file
name that goes with it, and a checkpoint block only when the contract asks for
one.

Placeholders are the string TODO and the revision 0000000. --check lists the
ones an artifact still carries; the validator accepts them, so a placeholder
left behind is a claim nobody made.

Options:
  --artifact <type>        which artifact to write
  --status <status>        its outcome; each artifact takes its own set
  --skill-version <x.y.z>  the writing skill's version
  --run-dir <dir>          where to write it (default: the contract's directory)
  --revision-before <sha>  the product revision before the work
  --revision-after <sha>   the product revision after it
  --out <file>             write here instead of the derived name
  --check <artifact.json>  list the placeholders an artifact still carries
  --self-test              run the built-in checks
`;

const TODO = "TODO";
const NO_REVISION = "0000000";

// The validator couples some values to the outcome: a completed migration may
// not leave a hypothesis not-run or a surface unaddressed, and a repaired debug
// result may not leave a validation that never ran. The scaffold fills them the
// only way that outcome allows, which makes them the run's claim to check.
const assertedByStatus = {
  "migration-result": {
    completed: "every validation passed, every hypothesis confirmed, every visual surface addressed",
  },
  "verification-result": {
    PASS: "every scenario and visual criterion passed, and every validation passed",
  },
  "debug-result": {
    repaired: "every validation passed and the attempt repaired the failure",
  },
};

const specifications = {
  "migration-result": {
    schemaVersion: 5,
    skill: "flow-migrate",
    statuses: ["completed", "failed", "blocked"],
    needs: ["flow-contract"],
    fileName: "migration-result",
  },
  "verification-result": {
    schemaVersion: 4,
    skill: "flow-verify",
    statuses: ["PASS", "FAIL", "BLOCKED"],
    needs: ["flow-contract", "migration-result"],
    optional: ["debug-result"],
    fileName: "verification-result",
  },
  "debug-handoff": {
    schemaVersion: 2,
    skill: "flow-verify",
    statuses: ["repairable", "external-blocked"],
    needs: ["flow-contract", "migration-result", "verification-result"],
    fileName: "debug-handoff",
  },
  "debug-result": {
    schemaVersion: 1,
    skill: "flow-debug",
    statuses: ["repaired", "parked", "blocked"],
    needs: ["flow-contract", "migration-result", "verification-result", "debug-handoff"],
    fileName: "debug-result",
  },
};

const pointerTo = source => ({
  path: path.relative(process.cwd(), source.absolute) || path.basename(source.absolute),
  sha256: source.sha256,
});

// The validator builds this same list to check it, so building it here is not a
// second opinion about which commands may appear: it is the same one.
const declaredCommands = contract => {
  const plan = contract.validationPlan ?? {};
  return [
    ...(plan.testCommands ?? []),
    plan.typecheckCommand,
    plan.buildCommand,
  ].filter(Boolean);
};

// A successful outcome and a validation that never ran contradict each other,
// and the validator rejects the pair. The run asserts the outcome on the
// command line, so the entries follow from it; the summary stays the run's to
// write.
const validationEntries = (contract, succeeded) =>
  declaredCommands(contract).map(command => ({
    command,
    status: succeeded ? "passed" : "not-run",
    summary: TODO,
  }));

const checkpointsDisabled = contract =>
  (contract.checkpointPolicy?.mode ?? "disabled") === "disabled";

const attemptOf = source => {
  const match = /-(\d+)\.json$/.exec(path.basename(source.absolute));
  return match ? Number(match[1]) : 1;
};

const buildMigrationResult = (sources, options) => {
  const contract = sources["flow-contract"].value;
  const document = {
    schemaVersion: specifications["migration-result"].schemaVersion,
    artifactType: "migration-result",
    skill: "flow-migrate",
    skillVersion: options["skill-version"],
    runId: contract.runId,
    flowId: contract.flowId,
    status: options.status,
    flowContract: pointerTo(sources["flow-contract"]),
    repository: {
      // The contract owns this, and a run that retyped the --product-root path
      // here had its chain rejected.
      root: contract.repository.root,
      revisionBefore: options["revision-before"] ?? NO_REVISION,
      revisionAfter: options["revision-after"] ?? NO_REVISION,
    },
    changedPaths: [],
    validation: validationEntries(contract, options.status === "completed"),
    coverageDelta: { status: "not-measured", summary: TODO },
    rollback: { status: "available", instructions: TODO },
    limitations: [],
  };
  const hypotheses = contract.characterizationRequired ?? [];
  if (hypotheses.length > 0) {
    // A hypothesis left not-run keeps the result from completed, so a completed
    // run has settled every one. Which way it settled is the run's finding:
    // a disproved hypothesis is a finding, not a failure, and saying so is what
    // sends flow-verify back to the scenarios behind it.
    const settled = options.status === "completed";
    document.characterization = hypotheses.map(entry => ({
      id: entry.id,
      outcome: settled ? "confirmed" : "not-run",
      // A settled hypothesis has to name the test that settled it.
      ...(settled ? { test: TODO } : {}),
      note: TODO,
    }));
  }
  if (contract.scope?.partialMount?.nested) {
    document.renderedSurfaceComparison = {
      evidenceSource: "real-parent-tree",
      comparedAgainst: contract.scope.partialMount.siblingSections?.length
        ? [...contract.scope.partialMount.siblingSections]
        : [TODO],
      observations: [TODO],
      // A completed result may not leave a surface unaddressed, so the verdict
      // follows the outcome the run asserts. It is never "matches": the visual
      // verdict is flow-verify's.
      surfaces: (contract.visualParity ?? []).map(surface => ({
        visualParityId: surface.id,
        verdict: options.status === "completed" ? "addressed" : "not-addressed",
        observations: [TODO],
      })),
    };
  }
  // Present and empty when checkpoints are off: the key is required, and a
  // placeholder checkpoint object is what the schema rejects.
  document.checkpoints = [];
  return document;
};

const buildVerificationResult = (sources, options) => {
  const contract = sources["flow-contract"].value;
  const debugResult = sources["debug-result"];
  const attempt = debugResult ? attemptOf(debugResult) + 1 : 1;
  const passing = options.status === "PASS";
  const document = {
    schemaVersion: specifications["verification-result"].schemaVersion,
    artifactType: "verification-result",
    skill: "flow-verify",
    skillVersion: options["skill-version"],
    runId: contract.runId,
    flowId: contract.flowId,
    verificationAttempt: attempt,
    status: options.status,
    flowContract: pointerTo(sources["flow-contract"]),
    migrationResult: pointerTo(sources["migration-result"]),
    ...(debugResult ? { debugResult: pointerTo(debugResult) } : {}),
    criteria: (contract.scenarios ?? []).map(scenario => ({
      scenarioId: scenario.id,
      status: "BLOCKED",
      evidence: [],
      diagnosis: TODO,
    })),
    validation: validationEntries(contract, passing),
    coverageDelta: { status: "not-measured", summary: TODO },
    manualValidation: { status: "not-run", summary: TODO },
    browserValidation: {
      status: "not-run",
      summary: TODO,
      evidenceSource: "not-run",
    },
    diagnosis: [],
    push: {
      policy: contract.checkpointPolicy?.pushPolicy ?? "never",
      status: "not-requested",
      // Required even with nothing to push, which a run had to be told twice.
      remote: "origin",
      branch: contract.checkpointPolicy?.expectedBranch ?? "none",
      commitShas: [],
      upstreamSet: false,
      summary: TODO,
    },
  };
  const surfaces = contract.visualParity ?? [];
  if (surfaces.length > 0) {
    // The validator checks both directions, so one entry per declared surface
    // and no other id.
    document.visualCriteria = surfaces.map(surface => ({
      visualParityId: surface.id,
      status: "BLOCKED",
      evidenceSource: "not-run",
      evidence: [],
      diagnosis: TODO,
    }));
  }
  if (passing) {
    for (const criterion of document.criteria) criterion.status = "PASS";
    for (const criterion of document.visualCriteria ?? []) criterion.status = "PASS";
  }
  return document;
};

const buildDebugHandoff = (sources, options) => {
  const contract = sources["flow-contract"].value;
  const verification = sources["verification-result"].value;
  const failing = criterion => criterion.status === "FAIL" || criterion.status === "BLOCKED";
  // One failure per criterion the verification did not pass: the run diagnoses
  // them, it does not have to find them again.
  const failures = [
    ...(verification.criteria ?? []).filter(failing).map(criterion => ({
      id: criterion.scenarioId,
      source: "scenario",
      scenarioId: criterion.scenarioId,
    })),
    ...(verification.visualCriteria ?? []).filter(failing).map(criterion => ({
      id: criterion.visualParityId,
      source: "visual-parity",
      visualParityId: criterion.visualParityId,
    })),
  ].map(failure => ({
    ...failure,
    expected: TODO,
    actual: TODO,
    evidence: [TODO],
    reproduction: [TODO],
    suspectedBoundary: TODO,
    candidatePaths: [...(contract.scope?.allowedWritePaths ?? [])],
    recommendedStartTier: "light",
    recommendationReason: TODO,
  }));
  return {
    schemaVersion: specifications["debug-handoff"].schemaVersion,
    artifactType: "debug-handoff",
    skill: "flow-verify",
    skillVersion: options["skill-version"],
    runId: contract.runId,
    flowId: contract.flowId,
    status: options.status,
    flowContract: pointerTo(sources["flow-contract"]),
    migrationResult: pointerTo(sources["migration-result"]),
    verificationResult: pointerTo(sources["verification-result"]),
    failures: failures.length > 0 ? failures : [{
      id: TODO.toLowerCase(),
      source: "scenario",
      expected: TODO,
      actual: TODO,
      evidence: [TODO],
      reproduction: [TODO],
      suspectedBoundary: TODO,
      candidatePaths: [...(contract.scope?.allowedWritePaths ?? [])],
      recommendedStartTier: "light",
      recommendationReason: TODO,
    }],
    summary: TODO,
  };
};

const buildDebugResult = (sources, options) => {
  const contract = sources["flow-contract"].value;
  const handoff = sources["debug-handoff"].value;
  const tier = handoff.failures?.[0]?.recommendedStartTier ?? "light";
  const attempt = {
    tier,
    status: options.status === "repaired" ? "repaired" : "failed",
    hypothesis: TODO,
    reproductionEvidence: [TODO],
    changedPaths: [],
    validation: validationEntries(contract, options.status === "repaired"),
    summary: TODO,
  };
  // The key is only allowed with all four commit-manifest fields, so while
  // checkpoints are disabled it is left out rather than filled in.
  if (!checkpointsDisabled(contract)) {
    attempt.checkpoint = {
      commitSha: NO_REVISION,
      subject: TODO,
      paths: [TODO],
      stagedDiffSha256: "0".repeat(64),
    };
  }
  return {
    schemaVersion: specifications["debug-result"].schemaVersion,
    artifactType: "debug-result",
    skill: "flow-debug",
    skillVersion: options["skill-version"],
    runId: contract.runId,
    flowId: contract.flowId,
    status: options.status,
    flowContract: pointerTo(sources["flow-contract"]),
    migrationResult: pointerTo(sources["migration-result"]),
    verificationResult: pointerTo(sources["verification-result"]),
    debugHandoff: pointerTo(sources["debug-handoff"]),
    repository: {
      root: contract.repository.root,
      revisionBefore: options["revision-before"] ?? NO_REVISION,
      revisionAfter: options["revision-after"] ?? NO_REVISION,
    },
    selectedStartTier: tier,
    selectionReason: TODO,
    attempts: [attempt],
    nextAction: options.status === "repaired" ? "reverify" : "park",
    limitations: [],
  };
};

const builders = {
  "migration-result": buildMigrationResult,
  "verification-result": buildVerificationResult,
  "debug-handoff": buildDebugHandoff,
  "debug-result": buildDebugResult,
};

const loadSource = async file => {
  const absolute = path.resolve(file);
  const raw = await readFile(absolute);
  const value = JSON.parse(raw.toString("utf8").replace(/^﻿/, ""));
  return {
    absolute,
    value,
    sha256: createHash("sha256").update(raw).digest("hex"),
    artifactType: value.artifactType,
  };
};

// A verification attempt from 2 on, and the repair answering it, add -<N> to
// every file they write, because the artifacts hash the earlier attempt's files.
const attemptSuffixFor = (artifact, sources, document) => {
  if (artifact === "verification-result") {
    return document.verificationAttempt > 1 ? `-${document.verificationAttempt}` : "";
  }
  const verification = sources["verification-result"];
  if (!verification) return "";
  const attempt = verification.value.verificationAttempt ?? attemptOf(verification);
  return attempt > 1 ? `-${attempt}` : "";
};

const placeholdersIn = (value, location = "$", found = []) => {
  if (typeof value === "string") {
    if (value === TODO || value === TODO.toLowerCase() || value === NO_REVISION ||
      value === "0".repeat(64)) {
      found.push(location);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => placeholdersIn(item, `${location}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      placeholdersIn(child, `${location}.${key}`, found);
    }
  }
  return found;
};

const createResult = async options => {
  const artifact = options.artifact;
  const specification = specifications[artifact];
  if (!specification) {
    throw new Error(
      `${artifact ?? "(none)"} is not an artifact this writes; use ${Object.keys(specifications).join(", ")}.`,
    );
  }
  for (const name of ["status", "skill-version"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }
  if (!specification.statuses.includes(options.status)) {
    throw new Error(
      `${options.status} is not a ${artifact} outcome; use ${specification.statuses.join(", ")}.`,
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(options["skill-version"])) {
    throw new Error(`--skill-version must be x.y.z, not ${options["skill-version"]}.`);
  }

  const loaded = await Promise.all(options.positional.map(loadSource));
  const sources = {};
  for (const source of loaded) {
    if (!source.artifactType) {
      throw new Error(`${source.absolute} names no artifactType.`);
    }
    sources[source.artifactType] = source;
  }
  const missing = specification.needs.filter(name => !sources[name]);
  if (missing.length > 0) {
    throw new Error(`${artifact} needs ${missing.join(", ")}; pass ${missing.length === 1 ? "that file" : "those files"} too.`);
  }
  const accepted = new Set([...specification.needs, ...(specification.optional ?? [])]);
  const extra = Object.keys(sources).filter(name => !accepted.has(name));
  if (extra.length > 0) {
    throw new Error(`${artifact} does not read ${extra.join(", ")}.`);
  }

  const document = builders[artifact](sources, options);
  const suffix = attemptSuffixFor(artifact, sources, document);
  const resultPath = options.out
    ? path.resolve(options.out)
    : path.join(
      path.resolve(options["run-dir"] ?? path.dirname(sources["flow-contract"].absolute)),
      `${specification.fileName}${suffix}.json`,
    );
  try {
    await writeFile(resultPath, `${JSON.stringify(document, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`${resultPath} already exists; a result is never overwritten.`);
    }
    throw error;
  }
  return { resultPath, document };
};

const parseArguments = argumentsList => {
  const options = { positional: [] };
  const valued = new Set([
    "artifact", "status", "skill-version", "run-dir",
    "revision-before", "revision-after", "out", "check",
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (argument === "--self-test" || argument === "--help") {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      options.positional.push(argument);
      continue;
    }
    if (!valued.has(name)) {
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

const assert = (condition, message) => {
  if (!condition) throw new Error(`Result scaffold self-test failed: ${message}`);
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
  const example = path.join(rootDirectory, "examples", "handoff", "detail-drawer-astronaut-form");
  const contract = path.join(example, "flow-contract.json");
  const migration = path.join(example, "migration-result.json");
  const contractValue = JSON.parse(await readFile(contract, "utf8"));
  const temporary = await mkdtemp(path.join(os.tmpdir(), "new-result-"));

  // The whole chain, not --schema-only: the rules that cost a run a repair pass
  // are the links between artifacts, and a schema check never reaches them.
  const validates = (file, ...upstream) => {
    const run = spawnSync(process.execPath, [validatorPath, ...upstream, file], { encoding: "utf8" });
    return { ok: run.status === 0, output: run.stderr || run.stdout };
  };

  try {
    const migrationResult = await createResult({
      artifact: "migration-result",
      status: "completed",
      "skill-version": "0.21.0",
      "run-dir": temporary,
      positional: [contract],
    });
    const migrationValidation = validates(migrationResult.resultPath, contract);
    assert(migrationValidation.ok,
      `a scaffolded migration-result does not validate:\n${migrationValidation.output}`);
    assert(migrationResult.document.repository.root === contractValue.repository.root,
      "the migration-result does not copy the contract's repository root");
    assert(!Object.hasOwn(migrationResult.document, "checkpoints") === false &&
      migrationResult.document.checkpoints.length === 0,
      "the migration-result does not leave checkpoints empty while they are disabled");
    const expectedCommands = declaredCommands(contractValue);
    assert(migrationResult.document.validation.length === expectedCommands.length &&
      migrationResult.document.validation.every((entry, index) =>
        entry.command === expectedCommands[index]),
      "the migration-result's validation entries are not the contract's declared commands");
    assert(migrationResult.document.characterization?.length ===
      (contractValue.characterizationRequired ?? []).length,
      "the migration-result does not carry one characterization entry per hypothesis");

    const verificationResult = await createResult({
      artifact: "verification-result",
      status: "FAIL",
      "skill-version": "0.22.0",
      "run-dir": temporary,
      positional: [contract, migration],
    });
    assert(verificationResult.document.verificationAttempt === 1 &&
      path.basename(verificationResult.resultPath) === "verification-result.json",
      "a first attempt is not numbered 1");
    assert(verificationResult.document.visualCriteria.length ===
      contractValue.visualParity.length,
      "the verification-result does not carry one visual criterion per declared surface");
    assert(verificationResult.document.push.remote &&
      verificationResult.document.push.branch &&
      Array.isArray(verificationResult.document.push.commitShas) &&
      verificationResult.document.push.upstreamSet === false,
      "the verification-result's push block leaves out a field it always carries");

    // A non-PASS verification is only a complete chain together with the debug
    // handoff it hands on, which is how flow-verify writes the pair.
    const debugHandoff = await createResult({
      artifact: "debug-handoff",
      status: "repairable",
      "skill-version": "0.22.0",
      "run-dir": temporary,
      positional: [contract, migration, verificationResult.resultPath],
    });
    const failingChain = [contract, migration, verificationResult.resultPath];
    const handoffValidation = validates(debugHandoff.resultPath, ...failingChain);
    assert(handoffValidation.ok,
      `a scaffolded verification-result and debug-handoff do not validate:
${handoffValidation.output}`);
    const unpassed = [
      ...verificationResult.document.criteria,
      ...(verificationResult.document.visualCriteria ?? []),
    ].filter(criterion => criterion.status !== "PASS").length;
    assert(debugHandoff.document.failures.length === unpassed,
      "the debug-handoff does not carry one failure per criterion the verification did not pass");
    assert(debugHandoff.document.failures.every(failure =>
      failure.source === "scenario" || failure.source === "visual-parity"),
    "the debug-handoff uses a source the schema does not allow");

    const debugResult = await createResult({
      artifact: "debug-result",
      status: "repaired",
      "skill-version": "0.11.0",
      "run-dir": temporary,
      positional: [...failingChain, debugHandoff.resultPath],
    });
    const debugValidation = validates(debugResult.resultPath, ...failingChain, debugHandoff.resultPath);
    assert(debugValidation.ok,
      `a scaffolded debug-result does not validate:\n${debugValidation.output}`);
    assert(debugResult.document.repository.root === contractValue.repository.root,
      "the debug-result does not copy the contract's repository root");
    assert(!Object.hasOwn(debugResult.document.attempts[0], "checkpoint"),
      "the debug-result writes a checkpoint while checkpoints are disabled");
    assert(debugResult.document.nextAction === "reverify",
      "a repaired result does not go back to verification");

    // Attempt 2 names every file it writes after the attempt.
    const secondVerification = await createResult({
      artifact: "verification-result",
      status: "PASS",
      "skill-version": "0.22.0",
      "run-dir": temporary,
      positional: [contract, migration, path.join(example, "debug-result.json")],
    });
    assert(path.basename(secondVerification.resultPath) === "verification-result-2.json" &&
      secondVerification.document.verificationAttempt === 2,
      "a verification after a repair is not the second attempt");
    assert(secondVerification.document.criteria.every(entry => entry.status === "PASS"),
      "a PASS does not set its criteria to PASS");

    assert(placeholdersIn(migrationResult.document).includes("$.coverageDelta.summary"),
      "--check does not find a placeholder the scaffold wrote");
    assert(placeholdersIn({ a: "measured" }).length === 0,
      "--check reports a placeholder where there is none");

    await expectFailure(
      () => createResult({
        artifact: "migration-result", status: "completed", "skill-version": "0.21.0",
        "run-dir": temporary, positional: [contract],
      }),
      "already exists",
      "an existing result was overwritten",
    );
    await expectFailure(
      () => createResult({
        artifact: "migration-result", status: "PASS", "skill-version": "0.21.0",
        "run-dir": temporary, positional: [contract],
      }),
      "not a migration-result outcome",
      "a status from another artifact was accepted",
    );
    await expectFailure(
      () => createResult({
        artifact: "debug-result", status: "repaired", "skill-version": "0.11.0",
        "run-dir": temporary, positional: [contract],
      }),
      "needs migration-result",
      "a missing upstream artifact was accepted",
    );
    await expectFailure(
      () => createResult({
        artifact: "migration-result", status: "completed", "skill-version": "0.21",
        "run-dir": temporary, positional: [contract],
      }),
      "must be x.y.z",
      "a malformed skill version was accepted",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Result scaffold self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  if (options.check) {
    const source = await loadSource(options.check);
    const found = placeholdersIn(source.value);
    if (found.length === 0) {
      console.log(`${options.check} carries no placeholder.`);
      return;
    }
    console.log(
      [
        `${options.check} still carries ${found.length} placeholder(s):`,
        ...found.map(location => `  ${location}`),
        "The validator accepts them, so each one is a claim nobody made.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  if (options.help || process.argv.length <= 2) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
    return;
  }
  const { resultPath, document } = await createResult(options);
  const found = placeholdersIn(document);
  const asserted = assertedByStatus[options.artifact]?.[options.status];
  console.log(
    [
      `Wrote ${resultPath}.`,
      found.length > 0
        ? `Replace ${found.length} placeholder(s) with what this run found:\n${found.map(location => `  ${location}`).join("\n")}`
        : "It carries no placeholder.",
      // These do not come from the artifacts; they follow from the outcome the
      // run asserted, and the validator would reject any other value beside it.
      // That makes them the run's claim, not the scaffold's.
      ...(asserted ? [`Derived from --status ${options.status}, so check each one against what actually happened: ${asserted}.`] : []),
      `Then validate the chain: node "${validatorPath}" <upstream artifacts> "${resultPath}"`,
    ].join("\n"),
  );
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
