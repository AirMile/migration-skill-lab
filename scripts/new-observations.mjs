import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Each run looked up the sidecar's shape in an example, worked out its own
// filename and status set, and hashed its primary artifact by hand. The
// observations are the run's to write; the envelope around them is not.

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const validatorPath = path.join(rootDirectory, "scripts", "validate-handoff.mjs");

const usage = `Usage:
  node scripts/new-observations.mjs --primary <artifact.json> --status <status> --summary <text> [--run-dir <dir>]
  node scripts/new-observations.mjs --skill <name> --skill-version <x.y.z> --run-id <id> --flow-id <id> --run-dir <dir> --status <status> --summary <text> [--attempt <n>]

Writes <run-dir>\\skill-run-observations-<skill>.json with an empty
observations list and the primary outcome filled in. With --primary, the skill,
version, runId, flowId, pointer and sha256 come from the primary artifact and
the run directory defaults to its directory. Without a primary artifact, for a
run that could not produce one, pass the identity flags. Never overwrites.

A verification attempt N from 2 on, and the repair answering it, add -<N> to
every file they write. The sidecar takes N from a primary artifact named
verification-result-<N>.json or debug-result-<N>.json, or from --attempt.

Statuses: flow-baseline draft|failed|blocked; flow-migrate completed|failed|blocked;
flow-verify PASS|FAIL|BLOCKED; flow-debug repaired|blocked|parked.
`;

const statusesBySkill = {
  "flow-baseline": ["draft", "failed", "blocked"],
  "flow-migrate": ["completed", "failed", "blocked"],
  "flow-verify": ["PASS", "FAIL", "BLOCKED"],
  "flow-debug": ["repaired", "blocked", "parked"],
};
const skillAliases = {
  "migrate-flow": "flow-migrate",
  "verify-flow": "flow-verify",
  "debug-flow": "flow-debug",
};
const identityFlags = ["skill", "skill-version", "run-id", "flow-id"];

const entryShape = `Add one entry per check that fired:
  {
    "id": "kebab-case-id",
    "category": "unnecessary-context-load | skill-caused-tool-failure | deterministic-step-candidate | user-correction | ambiguous-instruction | output-mismatch | instruction-deviation | missing-failure-handling | unsuitable-delegation",
    "observation": "what happened",
    "effect": "safety | correctness | cost | clarity | user-experience",
    "evidence": ["concrete tool call, message or error"],
    "skillLocations": ["SKILL.md step or reference section"],
    "causality": "confirmed | inferred",
    "occurrenceCount": 1
  }`;

const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const createSidecar = async options => {
  for (const name of ["status", "summary"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }

  let identity;
  let pointer = {};
  let runDirectory = options["run-dir"];
  let attempt = options.attempt;
  if (options.primary) {
    const given = [...identityFlags, "attempt"].filter(name => options[name]);
    if (given.length > 0) {
      throw new Error(
        `--${given[0]} comes from the primary artifact; pass it only when there is no --primary.`,
      );
    }
    const absolute = path.resolve(options.primary);
    const raw = await readFile(absolute);
    const primary = JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, ""));
    identity = {
      skill: skillAliases[primary.skill] ?? primary.skill,
      skillVersion: primary.skillVersion,
      runId: primary.runId,
      flowId: primary.flowId,
    };
    pointer = {
      artifactPath: path.relative(process.cwd(), absolute) || path.basename(absolute),
      sha256: createHash("sha256").update(raw).digest("hex"),
    };
    runDirectory ??= path.dirname(absolute);
    attempt = /^(?:verification|debug)-result-(\d+)\.json$/.exec(path.basename(absolute))?.[1];
  } else {
    const missing = [...identityFlags, "run-dir"].filter(name => !options[name]);
    if (missing.length > 0) {
      throw new Error(
        `Without --primary, pass ${missing.map(name => `--${name}`).join(", ")}.\n\n${usage}`,
      );
    }
    identity = {
      skill: skillAliases[options.skill] ?? options.skill,
      skillVersion: options["skill-version"],
      runId: options["run-id"],
      flowId: options["flow-id"],
    };
  }

  const allowed = statusesBySkill[identity.skill];
  if (!allowed) {
    throw new Error(
      `${identity.skill} is not a flow skill; expected ${Object.keys(statusesBySkill).join(", ")}.`,
    );
  }
  if (!allowed.includes(options.status)) {
    throw new Error(
      `${options.status} is not a ${identity.skill} outcome; use ${allowed.join(", ")}.`,
    );
  }

  if (attempt !== undefined && !/^[1-9]\d*$/.test(attempt)) {
    throw new Error(`--attempt must be a positive integer, not ${attempt}.`);
  }
  const sidecarPath = path.join(
    path.resolve(runDirectory),
    `skill-run-observations-${identity.skill}${attempt > 1 ? `-${attempt}` : ""}.json`,
  );
  const sidecar = {
    schemaVersion: 1,
    artifactType: "skill-run-observations",
    ...identity,
    capturedAt: timestamp(),
    primaryOutcome: {
      status: options.status,
      summary: options.summary,
      ...pointer,
    },
    observations: [],
  };
  try {
    await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`${sidecarPath} already exists; a sidecar is never overwritten.`);
    }
    throw error;
  }
  return sidecarPath;
};

const parseArguments = argumentsList => {
  const options = {};
  const valued = new Set(["primary", "status", "summary", "run-dir", "attempt", ...identityFlags]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (argument === "--self-test" || argument === "--help") {
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

const assert = (condition, message) => {
  if (!condition) throw new Error(`Observation sidecar self-test failed: ${message}`);
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
  const primary = path.join(
    rootDirectory,
    "examples",
    "handoff",
    "detail-drawer-line-edit",
    "migration-result.json",
  );
  const temporary = await mkdtemp(path.join(os.tmpdir(), "new-observations-"));
  try {
    const sidecarPath = await createSidecar({
      primary,
      status: "completed",
      summary: "The slice is implemented.",
      "run-dir": temporary,
    });
    assert(path.basename(sidecarPath) === "skill-run-observations-flow-migrate.json",
      "the sidecar is not named after the skill");
    const sidecar = JSON.parse(await readFile(sidecarPath, "utf8"));
    const expectedSha256 = createHash("sha256").update(await readFile(primary)).digest("hex");
    assert(sidecar.primaryOutcome.sha256 === expectedSha256,
      "the primary outcome does not carry the artifact hash");
    const validation = spawnSync(process.execPath, [validatorPath, sidecarPath], { encoding: "utf8" });
    assert(validation.status === 0,
      `the sidecar does not validate:\n${validation.stderr || validation.stdout}`);

    await expectFailure(
      () => createSidecar({ primary, status: "completed", summary: "Again.", "run-dir": temporary }),
      "already exists",
      "an existing sidecar was overwritten",
    );
    await expectFailure(
      () => createSidecar({ primary, status: "PASS", summary: "Wrong.", "run-dir": temporary }),
      "not a flow-migrate outcome",
      "a status from another skill was accepted",
    );
    await expectFailure(
      () => createSidecar({ primary, skill: "flow-debug", status: "blocked", summary: "Mixed." }),
      "comes from the primary artifact",
      "an identity flag overrode the primary artifact",
    );

    const blockedPath = await createSidecar({
      skill: "flow-debug",
      "skill-version": "0.3.0",
      "run-id": "demo-flow-debug-1",
      "flow-id": "demo-flow",
      "run-dir": temporary,
      status: "parked",
      summary: "No safe local repair was found.",
    });
    const blocked = spawnSync(process.execPath, [validatorPath, blockedPath], { encoding: "utf8" });
    assert(blocked.status === 0,
      `a sidecar without a primary artifact does not validate:\n${blocked.stderr || blocked.stdout}`);

    const secondAttempt = path.join(temporary, "verification-result-2.json");
    await copyFile(
      path.join(rootDirectory, "examples", "debug", "demo-line-drawer", "reverified-verification-result.json"),
      secondAttempt,
    );
    const secondPath = await createSidecar({
      primary: secondAttempt,
      status: "PASS",
      summary: "The repair holds.",
    });
    assert(path.basename(secondPath) === "skill-run-observations-flow-verify-2.json",
      "a second verification attempt's sidecar does not carry the attempt suffix");
    const secondBlockedPath = await createSidecar({
      skill: "flow-debug",
      "skill-version": "0.3.0",
      "run-id": "demo-flow-debug-1",
      "flow-id": "demo-flow",
      "run-dir": temporary,
      attempt: "2",
      status: "blocked",
      summary: "The second repair needs a contract change.",
    });
    assert(path.basename(secondBlockedPath) === "skill-run-observations-flow-debug-2.json",
      "--attempt does not carry the attempt suffix");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Observation sidecar self-test passed.");
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
  const sidecarPath = await createSidecar(options);
  console.log(
    [
      `Wrote ${sidecarPath} with an empty observations list.`,
      entryShape,
      "An empty list claims every check was evaluated and none fired.",
      `Then validate: node "${validatorPath}" "${sidecarPath}"`,
    ].join("\n"),
  );
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
