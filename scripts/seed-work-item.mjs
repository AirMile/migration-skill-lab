import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Every phase rebuilt the next snapshot by hand: it retyped settled field text,
// which came back reworded and forced update, hashed files, and reasoned out
// each action. All of that is deterministic. Deciding what moved is the only
// judgement left, so it is the only thing this leaves to the run.

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const validatorPath = path.join(rootDirectory, "scripts", "validate-handoff.mjs");

const usage = `Usage:
  node scripts/seed-work-item.mjs --previous <snapshot.json> --primary <artifact.json> --out <snapshot.json> [--applied <status>] [--created <localId>=<externalId>]...
  node scripts/seed-work-item.mjs --inherit <snapshot.json> --primary <flow-contract.json> --out <snapshot.json> [--epic-only]
  node scripts/seed-work-item.mjs --finalize <snapshot.json> [--previous <snapshot.json>]

Seed writes the next work-item snapshot from the previous one. Every Epic,
Feature, Story and Task keeps its field text byte for byte and starts as
no-change, or create while it has no external ID. Phase, skill version, runId
and flowId come from the primary artifact; pointers and hashes are filled in.
The standup and top-level evidence start empty, so the snapshot does not
validate until this run has written them.

  --previous <file>   the previous phase's snapshot; for a baseline rerun, the
                      earlier baseline snapshot this one supersedes
  --primary <file>    this phase's flow-contract, migration-result or
                      verification-result
  --out <file>        where to write the new snapshot; never overwrites
  --applied <status>  not-applied or confirmed-applied, as the user confirmed
                      the previous proposal; required after the baseline
  --created <id=ext>  the external ID Targetprocess gave an item the previous
                      snapshot proposed to create; repeatable, and only with
                      --applied confirmed-applied

Inherit starts a first baseline for a new flow from a sibling flow's snapshot,
the one run-context.mjs reports as flow.board. It copies the Epic and, without
--epic-only, the Feature byte for byte with their external IDs and recorded
board values, proposes no movement on them and leaves stories empty for this
run's own Story and Tasks.

Finalize runs after the edits. It sets each Story's proposedProgress from its
Tasks, copies that into the standup, and sets every action: create without an
external ID, otherwise update when fields, proposedState or proposedProgress
differ from --previous and no-change when they do not. Without --previous it
reads the snapshot's own previousHandoff or supersedes path.
`;

const phaseByPrimaryType = {
  "flow-contract": "baseline",
  "migration-result": "migration",
  "verification-result": "verification",
};
const skillByPhase = {
  baseline: "flow-baseline",
  migration: "flow-migrate",
  verification: "flow-verify",
};
const previousPhaseOf = {
  baseline: "baseline",
  migration: "baseline",
  verification: "migration",
};
const parentKeys = {
  feature: ["parentEpicLocalId", "parentEpicExternalId"],
  story: ["parentFeatureLocalId", "parentFeatureExternalId"],
  task: ["parentStoryLocalId", "parentStoryExternalId"],
};

const loadJson = async filePath => {
  const absolute = path.resolve(filePath);
  const raw = await readFile(absolute);
  return {
    absolute,
    pointerPath: path.relative(process.cwd(), absolute) || path.basename(absolute),
    sha256: createHash("sha256").update(raw).digest("hex"),
    value: JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")),
  };
};

const writeNew = async (filePath, value) => {
  try {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`${filePath} already exists; a snapshot is never overwritten.`);
    }
    throw error;
  }
};

const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const localDate = () => {
  const now = new Date();
  const pad = number => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Rebuilds the object with key right after anchor, so an assigned ID lands
// where a reader expects it rather than at the end of the item.
const placeAfter = (object, anchor, key, value) => {
  const result = {};
  let placed = false;
  for (const [existingKey, existingValue] of Object.entries(object)) {
    if (existingKey === key) continue;
    result[existingKey] = existingValue;
    if (existingKey === anchor) {
      result[key] = value;
      placed = true;
    }
  }
  if (!placed) result[key] = value;
  return result;
};

const withoutKey = (object, key) => {
  const { [key]: _removed, ...rest } = object;
  return rest;
};

const syncParentId = (item, kind, parent) => {
  const keys = parentKeys[kind];
  if (!keys) return item;
  const [localKey, externalKey] = keys;
  return Object.hasOwn(parent, "externalId")
    ? placeAfter(item, localKey, externalKey, parent.externalId)
    : withoutKey(item, externalKey);
};

const mapWorkItems = (snapshot, transform) => {
  const epic = transform(snapshot.epic, "epic");
  const feature = transform(snapshot.feature, "feature", epic);
  const stories = snapshot.stories.map(story => {
    const mappedStory = transform(story, "story", feature);
    return {
      ...mappedStory,
      tasks: story.tasks.map(task => transform(task, "task", mappedStory)),
    };
  });
  return { epic, feature, stories };
};

const collectByLocalId = snapshot => {
  const items = new Map();
  items.set(snapshot.epic.localId, snapshot.epic);
  items.set(snapshot.feature.localId, snapshot.feature);
  for (const story of snapshot.stories) {
    items.set(story.localId, story);
    for (const task of story.tasks) items.set(task.localId, task);
  }
  return items;
};

// The same comparison validate-handoff.mjs applies, so an action set here is
// one the validator accepts.
const contentEquals = (current, previous) =>
  current.proposedState === previous.proposedState &&
  current.proposedProgress === previous.proposedProgress &&
  JSON.stringify(current.fields ?? null) === JSON.stringify(previous.fields ?? null);

const taskWeightedProgress = tasks =>
  Math.round(
    tasks.reduce(
      (total, task) => total + task.contributionPercent * task.proposedProgress,
      0,
    ) / 100,
  );

const parseCreated = entries => {
  const created = new Map();
  for (const entry of entries ?? []) {
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)=([0-9]+)$/.exec(entry);
    if (!match) {
      throw new Error(`--created ${entry} must look like <localId>=<numeric externalId>.`);
    }
    created.set(match[1], match[2]);
  }
  return created;
};

const seed = async (options, { quiet = false } = {}) => {
  for (const name of ["previous", "primary", "out"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }
  const previous = await loadJson(options.previous);
  const primary = await loadJson(options.primary);

  if (previous.value.artifactType !== "work-item-handoff") {
    throw new Error(`${previous.pointerPath} is not a work-item-handoff snapshot.`);
  }
  const phase = phaseByPrimaryType[primary.value.artifactType];
  if (!phase) {
    throw new Error(
      `${primary.pointerPath} is a ${primary.value.artifactType}; the primary artifact is a flow-contract, migration-result or verification-result.`,
    );
  }
  if (previous.value.handoffPhase !== previousPhaseOf[phase]) {
    throw new Error(
      `A ${phase} snapshot follows a ${previousPhaseOf[phase]} snapshot, but ${previous.pointerPath} is a ${previous.value.handoffPhase} snapshot.`,
    );
  }
  if (previous.value.flowId !== primary.value.flowId) {
    throw new Error(
      `${previous.pointerPath} is for flow ${previous.value.flowId}, but ${primary.pointerPath} is for ${primary.value.flowId}.`,
    );
  }

  const rerun = phase === "baseline";
  const created = parseCreated(options.created);
  if (rerun) {
    if (primary.value.runId === previous.value.runId) {
      throw new Error(
        `A baseline rerun needs its own runId; ${primary.value.runId} is the run it supersedes.`,
      );
    }
    if (options.applied || created.size > 0) {
      throw new Error(
        "--applied and --created belong to a later phase; a baseline rerun records the board as the user confirmed it instead.",
      );
    }
  } else if (!["not-applied", "confirmed-applied"].includes(options.applied)) {
    throw new Error(
      "--applied not-applied|confirmed-applied is required: it is the user's answer about the previous proposal.",
    );
  }
  if (created.size > 0 && options.applied !== "confirmed-applied") {
    throw new Error("--created needs --applied confirmed-applied.");
  }

  const previousItems = collectByLocalId(previous.value);
  for (const localId of created.keys()) {
    const item = previousItems.get(localId);
    if (!item) throw new Error(`--created names unknown local ID ${localId}.`);
    if (item.action !== "create") {
      throw new Error(
        `--created names ${localId}, which ${previous.pointerPath} did not propose to create.`,
      );
    }
  }

  const applied = options.applied === "confirmed-applied";
  const items = mapWorkItems(previous.value, (item, kind, parent) => {
    let next = structuredClone(item);
    if (created.has(item.localId)) {
      next = placeAfter(next, "localId", "externalId", created.get(item.localId));
    }
    next = syncParentId(next, kind, parent);
    if (applied) {
      next.currentState = next.proposedState;
      next.currentProgress = next.proposedProgress;
    }
    next.action = Object.hasOwn(next, "externalId") ? "no-change" : "create";
    return next;
  });

  const standupStory =
    items.stories.find(story => story.localId === previous.value.standup.storyLocalId) ??
    items.stories[0];

  const snapshot = {
    schemaVersion: rerun
      ? Math.max(previous.value.schemaVersion, 4)
      : previous.value.schemaVersion,
    artifactType: "work-item-handoff",
    handoffPhase: phase,
    skill: skillByPhase[phase],
    skillVersion: primary.value.skillVersion,
    runId: primary.value.runId,
    flowId: primary.value.flowId,
    primaryArtifact: {
      artifactType: primary.value.artifactType,
      path: primary.pointerPath,
      sha256: primary.sha256,
    },
  };
  if (rerun) {
    snapshot.supersedes = {
      path: previous.pointerPath,
      sha256: previous.sha256,
      runId: previous.value.runId,
    };
  } else {
    const assigned = [...created]
      .map(([localId, externalId]) => `${localId}=${externalId}`)
      .join(", ");
    snapshot.previousHandoff = { path: previous.pointerPath, sha256: previous.sha256 };
    snapshot.previousApplication = {
      handoffSha256: previous.sha256,
      status: options.applied,
      recordedByRole: "user",
      recordedAt: timestamp(),
      summary: applied
        ? `The user confirmed the ${previous.value.handoffPhase} proposal was applied in Targetprocess${assigned ? `; assigned IDs ${assigned}` : ""}.`
        : `The user confirmed the ${previous.value.handoffPhase} proposal was not applied in Targetprocess.`,
      ...(created.size > 0
        ? {
            createdExternalIds: [...created].map(([localId, externalId]) => ({
              localId,
              externalId,
            })),
          }
        : {}),
    };
  }
  Object.assign(snapshot, items, {
    standup: {
      date: localDate(),
      storyLocalId: standupStory.localId,
      ...(Object.hasOwn(standupStory, "externalId")
        ? { storyExternalId: standupStory.externalId }
        : {}),
      currentBoardProgress: standupStory.currentProgress,
      proposedBoardProgress: standupStory.proposedProgress,
      completedSincePreviousUpdate: [],
      next: [],
      blockers: [],
      summary: "",
    },
    manualApplication: {
      status: "copy-ready",
      summary:
        "Copy the changed items and the standup update into Targetprocess and confirm what was applied.",
    },
    evidence: [],
    openQuestions: [...previous.value.openQuestions],
  });

  const outPath = path.resolve(options.out);
  await writeNew(outPath, snapshot);

  if (!quiet) {
    const actions = [...collectByLocalId(snapshot).values()].map(item => item.action);
    const count = action => actions.filter(value => value === action).length;
    const lines = [
      `Wrote ${outPath}: ${phase} snapshot, ${count("no-change")} no-change and ${count("create")} create.`,
      "Field text is the previous snapshot's, byte for byte. Still to write:",
      "  - standup.completedSincePreviousUpdate, standup.next and standup.summary (standup.blockers may stay empty);",
      "  - evidence;",
      "  - the fields, proposedState and proposedProgress of each item this phase moved, and nothing else.",
    ];
    if (rerun) {
      lines.push(
        "  - currentState and currentProgress only where the user corrected the board unprompted; otherwise they stay as the superseded snapshot recorded them.",
      );
    }
    if (applied) {
      lines.push(
        "currentState and currentProgress now equal what the applied proposal set.",
      );
    }
    lines.push(`Then run: node "${path.join(rootDirectory, "scripts", "seed-work-item.mjs")}" --finalize "${outPath}"`);
    console.log(lines.join("\n"));
  }
  return outPath;
};

const inherit = async (options, { quiet = false } = {}) => {
  for (const name of ["primary", "out"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }
  if (options.previous || options.applied || options.created.length > 0) {
    throw new Error(
      "--inherit starts a flow's first baseline; --previous, --applied and --created belong to a flow's own chain.",
    );
  }
  const source = await loadJson(options.inherit);
  const primary = await loadJson(options.primary);
  if (source.value.artifactType !== "work-item-handoff") {
    throw new Error(`${source.pointerPath} is not a work-item-handoff snapshot.`);
  }
  if (primary.value.artifactType !== "flow-contract") {
    throw new Error(`${primary.pointerPath} is a ${primary.value.artifactType}; --inherit seeds a baseline from its flow-contract.`);
  }
  if (source.value.flowId === primary.value.flowId) {
    throw new Error(
      `${source.pointerPath} is this flow's own snapshot; a rerun seeds from it with --previous.`,
    );
  }

  // Inheriting proposes nothing: current values stay as the source recorded
  // them, and the proposal equals them until this run moves an item.
  const settle = item => {
    const next = structuredClone(item);
    next.proposedState = next.currentState;
    next.proposedProgress = next.currentProgress;
    next.action = Object.hasOwn(next, "externalId") ? "no-change" : "create";
    return next;
  };
  const epic = settle(source.value.epic);
  const items = { epic };
  if (!options["epic-only"]) items.feature = syncParentId(settle(source.value.feature), "feature", epic);
  const inherited = options["epic-only"] ? "Epic" : "Epic and Feature";

  const snapshot = {
    schemaVersion: source.value.schemaVersion,
    artifactType: "work-item-handoff",
    handoffPhase: "baseline",
    skill: "flow-baseline",
    skillVersion: primary.value.skillVersion,
    runId: primary.value.runId,
    flowId: primary.value.flowId,
    primaryArtifact: {
      artifactType: primary.value.artifactType,
      path: primary.pointerPath,
      sha256: primary.sha256,
    },
    ...items,
    stories: [],
    standup: {
      date: localDate(),
      storyLocalId: "",
      currentBoardProgress: 0,
      proposedBoardProgress: 0,
      completedSincePreviousUpdate: [],
      next: [],
      blockers: [],
      summary: "",
    },
    manualApplication: {
      status: "copy-ready",
      summary: `Copy the proposed User Story, its Tasks and the standup update into Targetprocess under the existing ${inherited}, and confirm what was applied.`,
    },
    evidence: [
      `${inherited} identity, field text and board values copied from ${source.pointerPath} (flow ${source.value.flowId}).`,
    ],
    openQuestions: [],
  };

  const outPath = path.resolve(options.out);
  await writeNew(outPath, snapshot);
  if (!quiet) {
    const ids = [epic, items.feature].filter(Boolean)
      .map(item => `${item.localId}${item.externalId ? ` #${item.externalId}` : ""}`).join(", ");
    console.log([
      `Wrote ${outPath}: first baseline inheriting ${ids} from flow ${source.value.flowId}.`,
      "Still to write:",
      ...(options["epic-only"] ? ["  - the Feature, from the print-shape template and cited contract evidence;"] : []),
      "  - this flow's Story with its baseline, implementation and verification Tasks;",
      "  - standup.storyLocalId, completedSincePreviousUpdate, next and summary (blockers may stay empty);",
      "  - further evidence, and fields, proposedState or proposedProgress only on an inherited item this slice moves.",
      `Then run: node "${path.join(rootDirectory, "scripts", "seed-work-item.mjs")}" --finalize "${outPath}"`,
    ].join("\n"));
  }
  return outPath;
};

const finalize = async (options, { quiet = false } = {}) => {
  const target = path.resolve(options.finalize);
  const snapshot = JSON.parse(
    (await readFile(target, "utf8")).replace(/^\uFEFF/, ""),
  );

  let previousItems = new Map();
  const previousPath =
    options.previous ?? snapshot.previousHandoff?.path ?? snapshot.supersedes?.path;
  if (previousPath) {
    try {
      previousItems = collectByLocalId((await loadJson(previousPath)).value);
    } catch (error) {
      throw new Error(
        options.previous
          ? `Cannot read --previous ${previousPath}: ${error.message}`
          : `Cannot read the previous snapshot at ${previousPath}, taken from the snapshot's own pointer relative to the current directory; pass --previous.`,
      );
    }
  }

  const changes = [];
  const items = mapWorkItems(snapshot, (item, kind) => {
    const next = { ...item };
    if (kind === "story") {
      const progress = taskWeightedProgress(item.tasks);
      if (progress !== item.proposedProgress) {
        changes.push(`Story ${item.localId} proposedProgress ${item.proposedProgress} -> ${progress}`);
      }
      next.proposedProgress = progress;
    }
    let action;
    if (!Object.hasOwn(next, "externalId")) {
      action = "create";
    } else if (previousItems.has(next.localId)) {
      action = contentEquals(next, previousItems.get(next.localId)) ? "no-change" : "update";
    } else {
      action = next.action === "create" ? "update" : next.action;
    }
    if (action !== item.action) {
      changes.push(`${kind} ${item.localId} action ${item.action} -> ${action}`);
    }
    next.action = action;
    return next;
  });
  Object.assign(snapshot, items);

  const standupStory = snapshot.standup.storyLocalId
    ? snapshot.stories.find(story => story.localId === snapshot.standup.storyLocalId)
    : snapshot.stories[0];
  if (standupStory) {
    let standup = { ...snapshot.standup, storyLocalId: standupStory.localId };
    standup = Object.hasOwn(standupStory, "externalId")
      ? placeAfter(standup, "storyLocalId", "storyExternalId", standupStory.externalId)
      : withoutKey(standup, "storyExternalId");
    standup.currentBoardProgress = standupStory.currentProgress;
    standup.proposedBoardProgress = standupStory.proposedProgress;
    snapshot.standup = standup;
  }

  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`);
  if (!quiet) {
    console.log(
      changes.length > 0
        ? `Finalized ${target}:\n${changes.map(change => `  - ${change}`).join("\n")}`
        : `Finalized ${target}: no progress or action changed.`,
    );
  }
};

const parseArguments = argumentsList => {
  const options = { created: [] };
  const valued = new Set(["previous", "primary", "out", "applied", "created", "finalize", "inherit"]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (["--self-test", "--help", "--epic-only"].includes(argument)) {
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
    index += 1;
    if (name === "created") options.created.push(value);
    else options[name] = value;
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Work-item seed self-test failed: ${message}`);
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

const validate = files =>
  spawnSync(process.execPath, [validatorPath, ...files], { encoding: "utf8" });

const runSelfTest = async () => {
  const example = name =>
    path.join(rootDirectory, "examples", "handoff", "detail-drawer-line-edit", name);
  const contractPath = example("flow-contract.json");
  const migrationResultPath = example("migration-result.json");
  const baselinePath = example("work-item-baseline.json");
  const baseline = await loadJson(baselinePath);
  const migrationResult = await loadJson(migrationResultPath);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "seed-work-item-"));
  const readJson = async filePath => JSON.parse(await readFile(filePath, "utf8"));

  try {
    const seededPath = path.join(temporary, "work-item-migration.json");
    await seed(
      {
        previous: baselinePath,
        primary: migrationResultPath,
        out: seededPath,
        applied: "not-applied",
      },
      { quiet: true },
    );
    const seeded = await readJson(seededPath);
    const seededItems = collectByLocalId(seeded);
    for (const [localId, item] of collectByLocalId(baseline.value)) {
      const current = seededItems.get(localId);
      assert(current, `item ${localId} was dropped`);
      assert(JSON.stringify(current.fields) === JSON.stringify(item.fields),
        `the fields of ${localId} were not copied byte for byte`);
      assert(current.action === (item.externalId ? "no-change" : "create"),
        `${localId} did not start as no-change or create`);
      assert(current.currentProgress === item.currentProgress,
        `a not-applied proposal changed the current progress of ${localId}`);
    }
    assert(seeded.previousHandoff.sha256 === baseline.sha256 &&
      seeded.previousApplication.handoffSha256 === baseline.sha256,
      "the previous-handoff pointers do not carry the baseline hash");
    assert(seeded.primaryArtifact.sha256 === migrationResult.sha256 &&
      seeded.skillVersion === migrationResult.value.skillVersion &&
      seeded.runId === migrationResult.value.runId,
      "the primary artifact identity was not taken from migration-result.json");

    await expectFailure(
      () => seed({ previous: baselinePath, primary: migrationResultPath, out: seededPath, applied: "not-applied" }, { quiet: true }),
      "already exists",
      "an existing snapshot was overwritten",
    );
    await expectFailure(
      () => seed({ previous: baselinePath, primary: migrationResultPath, out: path.join(temporary, "x.json") }, { quiet: true }),
      "--applied",
      "a later phase was seeded without the application outcome",
    );
    await expectFailure(
      () => seed({ previous: baselinePath, primary: migrationResultPath, out: path.join(temporary, "y.json"), applied: "not-applied", created: ["detail-drawer-baseline=900001"] }, { quiet: true }),
      "confirmed-applied",
      "created IDs were accepted for a not-applied proposal",
    );
    await expectFailure(
      () => seed({ previous: baselinePath, primary: contractPath, out: path.join(temporary, "z.json") }, { quiet: true }),
      "its own runId",
      "a baseline rerun reused the runId it supersedes",
    );

    const chain = [contractPath, migrationResultPath, baselinePath];
    assert(validate([...chain, seededPath]).status !== 0,
      "a snapshot with an unwritten standup validated");

    seeded.standup.completedSincePreviousUpdate = ["Implemented the slice."];
    seeded.standup.next = ["Verify the slice."];
    seeded.standup.summary = "Implementation is done; verification is next.";
    seeded.evidence = ["Validated migration-result.json."];
    const implementation = seeded.stories[0].tasks.find(task => task.kind === "implementation");
    implementation.proposedState = "Done";
    implementation.proposedProgress = 100;
    await writeFile(seededPath, JSON.stringify(seeded, null, 2));
    await finalize({ finalize: seededPath, previous: baselinePath }, { quiet: true });

    const finalized = await readJson(seededPath);
    assert(finalized.stories[0].proposedProgress === 75 &&
      finalized.standup.proposedBoardProgress === 75,
      "Story progress was not derived from the Task weights");
    assert(finalized.stories[0].action === "update" && finalized.epic.action === "no-change",
      "finalize did not set update for the moved Story and no-change for the Epic");
    const accepted = validate([...chain, seededPath]);
    assert(accepted.status === 0,
      `the finalized migration snapshot does not validate:\n${accepted.stderr || accepted.stdout}`);

    const appliedPath = path.join(temporary, "work-item-migration-applied.json");
    await seed(
      {
        previous: baselinePath,
        primary: migrationResultPath,
        out: appliedPath,
        applied: "confirmed-applied",
        created: [
          "detail-drawer-baseline=900001",
          "detail-drawer-implementation=900002",
          "detail-drawer-verification=900003",
        ],
      },
      { quiet: true },
    );
    const applied = await readJson(appliedPath);
    const baselineTask = applied.stories[0].tasks.find(task => task.kind === "baseline");
    assert(baselineTask.externalId === "900001" &&
      baselineTask.parentStoryExternalId === applied.stories[0].externalId &&
      baselineTask.action === "no-change",
      "a created ID was not carried onto its Task");
    assert(baselineTask.currentState === baselineTask.proposedState,
      "an applied proposal did not become the current board state");
    applied.standup.completedSincePreviousUpdate = ["Applied the baseline proposal."];
    applied.standup.next = ["Implement the slice."];
    applied.standup.summary = "The baseline is on the board.";
    applied.evidence = ["Validated migration-result.json."];
    await writeFile(appliedPath, JSON.stringify(applied, null, 2));
    await finalize({ finalize: appliedPath, previous: baselinePath }, { quiet: true });
    const appliedResult = validate([...chain, appliedPath]);
    assert(appliedResult.status === 0,
      `the applied migration snapshot does not validate:\n${appliedResult.stderr || appliedResult.stdout}`);

    const siblingContractPath = path.join(temporary, "sibling-flow-contract.json");
    const siblingContract = structuredClone((await loadJson(contractPath)).value);
    siblingContract.flowId = "demo-sibling";
    siblingContract.runId = "demo-sibling-baseline-1";
    delete siblingContract.workItemContext.storyExternalIds;
    await writeFile(siblingContractPath, JSON.stringify(siblingContract, null, 2));
    await expectFailure(
      () => inherit({ inherit: baselinePath, primary: contractPath, out: path.join(temporary, "own.json"), created: [] }, { quiet: true }),
      "this flow's own snapshot",
      "a flow inherited from its own snapshot instead of seeding a rerun",
    );
    const inheritedPath = path.join(temporary, "work-item-baseline-sibling.json");
    await inherit(
      { inherit: appliedPath, primary: siblingContractPath, out: inheritedPath, created: [] },
      { quiet: true },
    );
    const inherited = await readJson(inheritedPath);
    const source = await readJson(appliedPath);
    assert(inherited.epic.externalId === source.epic.externalId &&
      inherited.feature.externalId === source.feature.externalId &&
      JSON.stringify(inherited.feature.fields) === JSON.stringify(source.feature.fields) &&
      inherited.epic.action === "no-change" && inherited.stories.length === 0,
      "the Epic and Feature were not inherited byte for byte as no-change");
    const story = structuredClone(baseline.value.stories[0]);
    delete story.externalId;
    story.localId = "migrate-demo-sibling";
    story.currentState = "Not created";
    for (const task of story.tasks) {
      task.localId = `demo-sibling-${task.kind}`;
      task.parentStoryLocalId = story.localId;
      delete task.parentStoryExternalId;
      delete task.externalId;
    }
    inherited.stories = [story];
    inherited.standup.completedSincePreviousUpdate = ["Established the sibling baseline."];
    inherited.standup.next = ["Implement the sibling slice."];
    inherited.standup.summary = "The sibling baseline is ready.";
    await writeFile(inheritedPath, JSON.stringify(inherited, null, 2));
    await finalize({ finalize: inheritedPath }, { quiet: true });
    const finalizedInherited = await readJson(inheritedPath);
    assert(finalizedInherited.standup.storyLocalId === story.localId &&
      finalizedInherited.stories[0].action === "create" &&
      finalizedInherited.feature.action === "no-change",
      "finalize did not adopt the inherited baseline's only Story into the standup");
    const inheritedResult = validate([siblingContractPath, inheritedPath]);
    assert(inheritedResult.status === 0,
      `the inherited baseline snapshot does not validate:\n${inheritedResult.stderr || inheritedResult.stdout}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Work-item seed self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
  } else if (options.help || process.argv.length <= 2) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
  } else if (options.finalize) {
    await finalize(options);
  } else if (options.inherit) {
    await inherit(options);
  } else {
    await seed(options);
  }
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
