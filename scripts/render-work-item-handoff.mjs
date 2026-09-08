import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const validatorPath = path.join(
  rootDirectory,
  "scripts",
  "validate-handoff.mjs",
);

const validateSnapshot = snapshotPath => {
  const result = spawnSync(
    process.execPath,
    [validatorPath, "--schema-only", snapshotPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`Work-item handoff validation failed:\n${detail}`);
  }
};

const readSnapshot = async snapshotPath => {
  const absolutePath = path.resolve(snapshotPath);
  validateSnapshot(absolutePath);
  const value = JSON.parse(await readFile(absolutePath, "utf8"));

  if (value.artifactType !== "work-item-handoff") {
    throw new Error(`${absolutePath} is not a work-item-handoff artifact.`);
  }

  return { absolutePath, value };
};

const renderBullets = values =>
  values.map(value => `- ${value}`).join("\n");

const renderEpic = epic => `## Epic

**Action:** ${epic.action}
**External ID:** ${epic.externalId ?? "Assign after creation"}
**Title:** ${epic.title}
**Current state:** ${epic.currentState}
**Current board progress:** ${epic.currentProgress}%
**Proposed state:** ${epic.proposedState}
**Proposed progress:** ${epic.proposedProgress}%

### Who is the user and what situation or problem are they experiencing?

${epic.fields.currentSituation}

### What outcome or experience should the user have when this is done?

${epic.fields.desiredOutcome}

### Why does this matter?

${epic.fields.whyMatters}

### How will we know it is successful?

${renderBullets(epic.fields.successCriteria)}

### Rich Release Notes

${epic.fields.richReleaseNotes}

### Suggested structure comment

\`\`\`text
${epic.structureComment}
\`\`\``;

const renderFeature = feature => `## Feature

**Action:** ${feature.action}
**External ID:** ${feature.externalId ?? "Assign after creation"}
**Parent Epic ID:** ${feature.parentEpicExternalId ?? "Use the new Epic"}
**Title:** ${feature.title}
**Current state:** ${feature.currentState}
**Current board progress:** ${feature.currentProgress}%
**Proposed state:** ${feature.proposedState}
**Proposed progress:** ${feature.proposedProgress}%

### Who is the user and what situation or problem are they experiencing?

${feature.fields.currentSituation}

### What outcome or experience should the user have when this is done?

${feature.fields.desiredOutcome}

### Why does this matter?

${feature.fields.whyMatters}

### How will we know it is successful?

${renderBullets(feature.fields.successCriteria)}

### Rich Release Notes

${feature.fields.richReleaseNotes}`;

const renderTask = (task, index) => `### Task ${index + 1}: ${task.title}

**Action:** ${task.action}
**External ID:** ${task.externalId ?? "Assign after creation"}
**Parent User Story ID:** ${task.parentStoryExternalId ?? "Use the new User Story"}
**Task type:** ${task.kind}
**Owner role:** ${task.ownerRole}
**Contribution to story progress:** ${task.contributionPercent}%
**Current state:** ${task.currentState}
**Current board progress:** ${task.currentProgress}%
**Proposed state:** ${task.proposedState}
**Proposed progress:** ${task.proposedProgress}%

${task.description}

#### Done when

${renderBullets(task.doneWhen)}

#### Checkpoint milestones

${task.checkpointMilestones.length > 0
    ? renderBullets(task.checkpointMilestones)
    : "- None; this is a read-only or coordination task."}

#### Evidence

${renderBullets(task.evidence)}

#### Blockers

${task.blockers.length > 0 ? renderBullets(task.blockers) : "- None."}`;

const renderStory = (story, index) => `## User Story ${index + 1}

**Action:** ${story.action}
**External ID:** ${story.externalId ?? "Assign after creation"}
**Parent Feature ID:** ${story.parentFeatureExternalId ?? "Use the new Feature"}
**Title:** ${story.title}
**Current state:** ${story.currentState}
**Current board progress:** ${story.currentProgress}%
**Proposed state:** ${story.proposedState}
**Proposed progress:** ${story.proposedProgress}%

### User Value (As ... I want ... so that ...)

${story.fields.userValue}

### Current behavior or functionality (Initial State)

${story.fields.currentBehavior}

### Desired behavior or functionality (Target state)

${story.fields.desiredBehavior}

### Acceptance criteria

${renderBullets(story.fields.acceptanceCriteria)}

### Attention points for reproduction and testing

${story.fields.attentionPoints.length > 0
    ? renderBullets(story.fields.attentionPoints)
    : "- None recorded."}

### Attachment information

${story.fields.attachmentInformation}

### Rich Release Notes

${story.fields.richReleaseNotes}

### Tasks

${story.tasks.map(renderTask).join("\n\n")}`;

const renderStandup = standup => `## Daily standup

**Date:** ${standup.date}
**User Story:** #${standup.storyExternalId}
**Current board progress:** ${standup.currentBoardProgress}%
**Proposed progress after applying this handoff:** ${standup.proposedBoardProgress}%

### Completed since previous update

${renderBullets(standup.completedSincePreviousUpdate)}

### Next

${renderBullets(standup.next)}

### Blockers

${standup.blockers.length > 0 ? renderBullets(standup.blockers) : "- None."}

### Short spoken update

${standup.summary}`;

const renderSnapshot = value => `# Sprint backlog handoff

**Flow:** ${value.flowId}
**Phase:** ${value.handoffPhase}
**Producer:** ${value.skill} ${value.skillVersion}
**Manual application:** ${value.manualApplication.status}
${value.previousApplication ?
    `**Previous handoff application:** ${value.previousApplication.status}` :
    ""}

> This is a copy/paste proposal. It is not proof that Targetprocess was updated.

${renderEpic(value.epic)}

${renderFeature(value.feature)}

${value.stories.map(renderStory).join("\n\n")}

${renderStandup(value.standup)}

## Evidence

${renderBullets(value.evidence)}

## Open questions

${value.openQuestions.length > 0
    ? renderBullets(value.openQuestions)
    : "- None."}

## Manual application checklist

- Copy only the fields and state/progress changes you reviewed.
- Create items only when their action is \`create\`.
- Keep the Feature linked to the listed parent Epic.
- Keep every User Story linked to the listed parent Feature.
- Keep every Task linked to the listed parent User Story.
- Do not mark a proposal as applied until Targetprocess shows the change.
- Record the confirmation in the next immutable handoff snapshot.

**Application summary:** ${value.manualApplication.summary}
`;

const defaultOutputPath = snapshotPath =>
  snapshotPath.replace(/\.json$/i, ".md");

const epicFeatureFieldLabels = [
  ["currentSituation", "Who is the user and what situation or problem are they experiencing?"],
  ["desiredOutcome", "What outcome or experience should the user have when this is done?"],
  ["whyMatters", "Why does this matter?"],
  ["successCriteria", "How will we know it is successful?"],
  ["richReleaseNotes", "Rich Release Notes"],
];

const storyFieldLabels = [
  ["userValue", "User Value (As ... I want ... so that ...)"],
  ["currentBehavior", "Current behavior or functionality (Initial State)"],
  ["desiredBehavior", "Desired behavior or functionality (Target state)"],
  ["acceptanceCriteria", "Acceptance criteria"],
  ["attentionPoints", "Attention points for reproduction and testing"],
  ["attachmentInformation", "Attachment information"],
  ["richReleaseNotes", "Rich Release Notes"],
];

const taskFieldLabels = [
  ["description", "Description"],
  ["doneWhen", "Done when"],
  ["checkpointMilestones", "Checkpoint milestones"],
  ["evidence", "Evidence"],
  ["blockers", "Blockers"],
];

const fieldValue = value =>
  Array.isArray(value)
    ? (value.length > 0 ? renderBullets(value) : "- None.")
    : String(value);

const itemFields = entry => {
  const { item, kind } = entry;
  if (kind === "Task") {
    return taskFieldLabels.map(([key, label]) => [label, fieldValue(item[key])]);
  }
  const labels = kind === "User Story" ? storyFieldLabels : epicFeatureFieldLabels;
  const fields = labels.map(([key, label]) => [label, fieldValue(item.fields[key])]);
  if (kind === "Epic" && item.structureComment) {
    fields.push(["Suggested structure comment", item.structureComment]);
  }
  return fields;
};

const itemLabel = entry => {
  const { item, kind } = entry;
  const identity = item.externalId ? `#${item.externalId}` : "(new)";
  return `${kind} ${identity} — ${item.title}`;
};

const collectInlineItems = snapshot => {
  const entries = [];
  entries.push({ localId: snapshot.epic.localId, kind: "Epic", item: snapshot.epic });
  entries.push({
    localId: snapshot.feature.localId,
    kind: "Feature",
    item: snapshot.feature,
    parent: snapshot.feature.parentEpicExternalId,
  });
  for (const story of snapshot.stories) {
    entries.push({
      localId: story.localId,
      kind: "User Story",
      item: story,
      parent: story.parentFeatureExternalId,
    });
    for (const task of story.tasks) {
      entries.push({
        localId: task.localId,
        kind: "Task",
        item: task,
        parent: task.parentStoryExternalId,
      });
    }
  }
  return entries;
};

const changedFields = (entry, previousEntry) => {
  const previousFields = new Map(itemFields(previousEntry));
  return itemFields(entry).filter(([label, value]) => previousFields.get(label) !== value);
};

const renderFieldBlocks = fields =>
  fields
    .map(([label, value]) => `\`\`\`text\n${label}\n\n${value}\n\`\`\``)
    .join("\n\n");

const renderInline = (snapshot, previousSnapshot) => {
  const entries = collectInlineItems(snapshot);
  const previousEntries = previousSnapshot
    ? new Map(collectInlineItems(previousSnapshot).map(entry => [entry.localId, entry]))
    : new Map();

  const created = [];
  const createdRepeat = [];
  const changed = [];
  const unchanged = [];

  for (const entry of entries) {
    const previousEntry = previousEntries.get(entry.localId);
    if (entry.item.action === "create") {
      const repeated = previousEntry &&
        previousEntry.item.action === "create" &&
        changedFields(entry, previousEntry).length === 0 &&
        entry.item.proposedState === previousEntry.item.proposedState &&
        entry.item.proposedProgress === previousEntry.item.proposedProgress;
      (repeated ? createdRepeat : created).push(entry);
      continue;
    }
    if (!previousEntry) {
      changed.push({ entry, fields: itemFields(entry) });
      continue;
    }
    const fields = changedFields(entry, previousEntry);
    const stateMoved =
      entry.item.proposedState !== previousEntry.item.proposedState ||
      entry.item.proposedProgress !== previousEntry.item.proposedProgress;
    if (fields.length === 0 && !stateMoved) {
      unchanged.push(entry);
      continue;
    }
    changed.push({ entry, fields, previousEntry, stateMoved });
  }

  const sections = [];

  sections.push(`# Inline handoff — ${snapshot.flowId} / ${snapshot.handoffPhase}

Producer: ${snapshot.skill} ${snapshot.skillVersion}
Manual application: ${snapshot.manualApplication.status}${snapshot.previousApplication
    ? `\nPrevious handoff application: ${snapshot.previousApplication.status}`
    : ""}

> Proposal only. Nothing here changed Targetprocess.`);

  sections.push(`## Change in Targetprocess (${changed.length})

${changed.length === 0
    ? "Nothing to change in this phase."
    : changed
      .map(({ entry, fields, previousEntry, stateMoved }) => {
        const lines = [`### ${itemLabel(entry)}`, ""];
        const move = (label, previousValue, value, suffix = "") => {
          if (!previousEntry) return `${label}: ${value}${suffix}`;
          return previousValue === value
            ? `${label}: ${value}${suffix} (unchanged)`
            : `${label}: ${previousValue}${suffix} -> ${value}${suffix}`;
        };
        lines.push(
          move(
            "State",
            previousEntry?.item.proposedState,
            entry.item.proposedState,
          ),
          move(
            "Progress",
            previousEntry?.item.proposedProgress,
            entry.item.proposedProgress,
            "%",
          ),
        );
        lines.push(`Confirmed on the board now: ${entry.item.currentState} / ${entry.item.currentProgress}%`);
        if (fields.length > 0) {
          lines.push("", renderFieldBlocks(fields));
        } else {
          lines.push("", "No field text changed; only state and progress.");
        }
        return lines.join("\n");
      })
      .join("\n\n")}`);

  sections.push(`## Create (${created.length})

${created.length === 0
    ? "Nothing to create in this phase."
    : created
      .map(entry => [
        `### ${entry.kind} — ${entry.item.title}`,
        "",
        `Parent: ${entry.parent ? `#${entry.parent}` : "use the new parent above"}`,
        `State: ${entry.item.proposedState}`,
        `Progress: ${entry.item.proposedProgress}%`,
        "",
        renderFieldBlocks(itemFields(entry)),
      ].join("\n"))
      .join("\n\n")}`);

  if (createdRepeat.length > 0) {
    sections.push(`## Still to create — unchanged since the previous handoff (${createdRepeat.length})

These were already proposed and are repeated here only because they have not
been created yet. Their fields are identical to the previous handoff, so use
that one rather than re-reading them:

${renderBullets(createdRepeat.map(entry =>
      `${entry.kind} — ${entry.item.title} (parent ${entry.parent ? `#${entry.parent}` : "above"})`))}`);
  }

  sections.push(`## Unchanged — do not touch (${unchanged.length})

${unchanged.length === 0
    ? "- None."
    : renderBullets(unchanged.map(itemLabel))}`);

  if (created.length + createdRepeat.length > 0) {
    sections.push(`## Report back

After creating the items above, report the IDs Targetprocess assigned so the
next snapshot records them instead of proposing the same items again:

\`\`\`json
"createdExternalIds": [
${[...created, ...createdRepeat]
      .map(entry => `  { "localId": "${entry.localId}", "externalId": "<id>" }`)
      .join(",\n")}
]
\`\`\``);
  }

  const standup = snapshot.standup;
  sections.push(`## Standup

\`\`\`text
${standup.date} — User Story #${standup.storyExternalId}
Board now: ${standup.currentBoardProgress}% · proposed after this handoff: ${standup.proposedBoardProgress}%

Completed since previous update
${renderBullets(standup.completedSincePreviousUpdate)}

Next
${renderBullets(standup.next)}

Blockers
${standup.blockers.length > 0 ? renderBullets(standup.blockers) : "- None."}

${standup.summary}
\`\`\``);

  return `${sections.join("\n\n")}\n`;
};

const runSelfTest = async () => {
  const examplePath = path.join(
    rootDirectory,
    "examples",
    "handoff",
    "demo-line-drawer",
    "work-item-baseline.json",
  );
  const { value } = await readSnapshot(examplePath);
  const first = renderSnapshot(value);
  const second = renderSnapshot(structuredClone(value));

  if (first !== second) {
    throw new Error("Renderer self-test produced non-deterministic output.");
  }

  const requiredText = [
    "## Epic",
    "## Feature",
    "## User Story 1",
    "### Tasks",
    "## Daily standup",
    "Current board progress",
    "Proposed progress after applying this handoff",
    "### Acceptance criteria",
    "## Manual application checklist",
    "not proof that Targetprocess was updated",
  ];
  for (const text of requiredText) {
    if (!first.includes(text)) {
      throw new Error(`Renderer self-test is missing ${JSON.stringify(text)}.`);
    }
  }

  const handoffDirectory = path.dirname(examplePath);
  const { value: migrationSnapshot } = await readSnapshot(
    path.join(handoffDirectory, "work-item-migration.json"),
  );
  const { value: verificationSnapshot } = await readSnapshot(
    path.join(handoffDirectory, "work-item-verification.json"),
  );

  const inline = renderInline(verificationSnapshot, migrationSnapshot);
  if (inline !== renderInline(verificationSnapshot, migrationSnapshot)) {
    throw new Error("Inline renderer self-test produced non-deterministic output.");
  }

  for (const text of [
    "# Inline handoff",
    "## Change in Targetprocess (4)",
    "## Unchanged — do not touch (2)",
    "Task #700001",
    "## Standup",
    "Nothing here changed Targetprocess",
  ]) {
    if (!inline.includes(text)) {
      throw new Error(`Inline renderer self-test is missing ${JSON.stringify(text)}.`);
    }
  }

  if (inline.includes("Acceptance criteria")) {
    throw new Error(
      "Inline renderer self-test emitted an unchanged field as a change.",
    );
  }
  if (inline.length >= renderSnapshot(verificationSnapshot).length) {
    throw new Error(
      "Inline renderer self-test produced no reduction over the full render.",
    );
  }

  const baselineInline = renderInline(value, undefined);
  for (const text of [
    "## Create (3)",
    "## Report back",
    "\"localId\": \"detail-drawer-baseline\"",
  ]) {
    if (!baselineInline.includes(text)) {
      throw new Error(
        `Inline renderer self-test is missing ${JSON.stringify(text)} for a first-phase snapshot.`,
      );
    }
  }

  console.log("Work-item renderer self-test passed.");
};

const checkOutputs = async snapshotPaths => {
  for (const snapshotPath of snapshotPaths) {
    const { absolutePath, value } = await readSnapshot(snapshotPath);
    const outputPath = defaultOutputPath(absolutePath);
    const expected = renderSnapshot(value);
    const actual = await readFile(outputPath, "utf8");

    if (actual !== expected) {
      throw new Error(`${outputPath} does not match its canonical JSON snapshot.`);
    }
  }

  console.log(`Checked ${snapshotPaths.length} rendered work-item handoff(s).`);
};

const argumentsList = process.argv.slice(2);

if (argumentsList.length === 1 && argumentsList[0] === "--self-test") {
  await runSelfTest();
} else if (argumentsList[0] === "--inline") {
  const snapshotPath = argumentsList[1];
  if (!snapshotPath) {
    throw new Error(
      "Usage: node .\\scripts\\render-work-item-handoff.mjs --inline <snapshot.json> [--since <previous-snapshot.json>]",
    );
  }

  let previousSnapshot;
  if (argumentsList[2]) {
    if (argumentsList[2] !== "--since" || !argumentsList[3]) {
      throw new Error(
        "Usage: node .\\scripts\\render-work-item-handoff.mjs --inline <snapshot.json> [--since <previous-snapshot.json>]",
      );
    }
    previousSnapshot = (await readSnapshot(argumentsList[3])).value;
  }

  const { value } = await readSnapshot(snapshotPath);
  if (previousSnapshot && previousSnapshot.flowId !== value.flowId) {
    throw new Error("The --since snapshot belongs to a different flow.");
  }
  process.stdout.write(renderInline(value, previousSnapshot));
} else if (argumentsList[0] === "--check") {
  const snapshotPaths = argumentsList.slice(1);
  if (snapshotPaths.length === 0) {
    throw new Error(
      "Usage: node .\\scripts\\render-work-item-handoff.mjs --check <snapshot.json> [...]",
    );
  }
  await checkOutputs(snapshotPaths);
} else {
  if (argumentsList.length < 1 || argumentsList.length > 2) {
    throw new Error(
      "Usage: node .\\scripts\\render-work-item-handoff.mjs <snapshot.json> [output.md]",
    );
  }

  const { absolutePath, value } = await readSnapshot(argumentsList[0]);
  const outputPath = path.resolve(
    argumentsList[1] ?? defaultOutputPath(absolutePath),
  );
  await writeFile(outputPath, renderSnapshot(value), "utf8");
  console.log(`Rendered ${outputPath}.`);
}
