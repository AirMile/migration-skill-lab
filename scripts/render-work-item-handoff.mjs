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

> This is a copy/paste proposal. It is not proof that TopDesk was updated.

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
- Do not mark a proposal as applied until TopDesk shows the change.
- Record the confirmation in the next immutable handoff snapshot.

**Application summary:** ${value.manualApplication.summary}
`;

const defaultOutputPath = snapshotPath =>
  snapshotPath.replace(/\.json$/i, ".md");

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
    "not proof that TopDesk was updated",
  ];
  for (const text of requiredText) {
    if (!first.includes(text)) {
      throw new Error(`Renderer self-test is missing ${JSON.stringify(text)}.`);
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
