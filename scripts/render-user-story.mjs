import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The board needs one User Story per slice, not an Epic, Feature, Story and
// Task chain tracked through every phase. The prose comes from the contract's
// userStory block; acceptance criteria and attention points come from the
// scenarios and risks the contract already records, so the Story never drifts
// from what flow-verify checks.

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = path.join(rootDirectory, "scripts", "validate-handoff.mjs");

const usage = `Usage: node scripts/render-user-story.mjs <flow-contract.json>

Validates a schemaVersion 7 flow-contract and prints its User Story as
copy/paste text blocks: title, user value, current and desired behavior,
acceptance criteria from the scenarios and visual parity surfaces, and
attention points from the characterization hypotheses, open questions, the
map slice remainder and the manual verification environment. Citations are
left out; the contract keeps them. Writes nothing.
`;

const readContract = async contractPath => {
  const absolute = path.resolve(contractPath);
  const validation = spawnSync(process.execPath, [validatorPath, absolute], { encoding: "utf8" });
  if (validation.status !== 0) {
    throw new Error(`${absolute} does not validate:\n${(validation.stderr || validation.stdout).trim()}`);
  }
  const contract = JSON.parse((await readFile(absolute, "utf8")).replace(/^﻿/, ""));
  if (contract.artifactType !== "flow-contract") {
    throw new Error(`${absolute} is a ${contract.artifactType}, not a flow-contract.`);
  }
  if (!contract.userStory) {
    throw new Error(`${absolute} is schemaVersion ${contract.schemaVersion} and carries no userStory; a User Story is rendered from schemaVersion 7.`);
  }
  return contract;
};

// "(LineForm.tsx:128-145)" and similar file:line references read as noise on
// a board; the contract keeps every citation.
const withoutCitations = text =>
  text.replace(/\s*\((?:[^()]*?[\w-]+\.[a-z]+:\d[^()]*)\)/gi, "").trim();

const sentence = text => {
  const trimmed = withoutCitations(text).replace(/\s+$/, "");
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};
const clause = text => sentence(text).replace(/\.$/, "");
const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);

const acceptanceCriteria = contract => [
  ...contract.scenarios.map(scenario =>
    `Given ${lowerFirst(clause(scenario.given))}, when ${lowerFirst(clause(scenario.when))}, then ${scenario.then.map(outcome => lowerFirst(clause(outcome))).join("; ")}.`),
  ...(contract.visualParity ?? []).map(entry =>
    `${clause(entry.surface)} looks and sits the same as ${lowerFirst(clause(entry.counterpart))}.`),
];

const attentionPoints = contract => [
  ...(contract.characterizationRequired ?? []).map(entry => `To prove first: ${sentence(entry.hypothesis)}`),
  ...contract.openQuestions.map(question => `Open question: ${sentence(question)}`),
  ...(contract.planSlice?.remainder ? [`Stays React for a later Story: ${sentence(contract.planSlice.remainder)}`] : []),
  ...(contract.validationPlan.manualValidation?.environment
    ? [`Verify manually in: ${sentence(contract.validationPlan.manualValidation.environment)}`]
    : []),
];

const block = (label, value) => {
  const body = Array.isArray(value)
    ? (value.length > 0 ? value.map(item => `- ${item}`).join("\n") : "- None.")
    : value;
  return `\`\`\`text\n${label}\n\n${body}\n\`\`\``;
};

export const renderUserStory = contract => [
  `# User Story — ${contract.userStory.title}`,
  "",
  "> Proposal only. Nothing here changed Targetprocess.",
  "",
  block("User Value (As ... I want ... so that ...)", contract.userStory.userValue),
  "",
  block("Current behavior or functionality (Initial State)", contract.userStory.currentBehavior),
  "",
  block("Desired behavior or functionality (Target state)", contract.userStory.desiredBehavior),
  "",
  block("Acceptance criteria", acceptanceCriteria(contract)),
  "",
  block("Attention points for reproduction and testing", attentionPoints(contract)),
  "",
].join("\n");

const assert = (condition, message) => {
  if (!condition) throw new Error(`User Story self-test failed: ${message}`);
};

const runSelfTest = async () => {
  const examplePath = path.join(rootDirectory, "examples", "handoff", "detail-drawer-line-edit", "flow-contract.json");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "render-user-story-"));
  try {
    let refused = "";
    try {
      await readContract(examplePath);
    } catch (error) {
      refused = error.message;
    }
    assert(refused.includes("carries no userStory"), `a schemaVersion 6 contract was rendered: ${refused}`);

    const contract = JSON.parse((await readFile(examplePath, "utf8")).replace(/^﻿/, ""));
    contract.schemaVersion = 7;
    delete contract.workItemContext;
    contract.userStory = {
      title: "Migrate the Detail Drawer line fields",
      userValue: "As a map editor, I want to edit a line's Length and Angle so that the map matches the site.",
      currentBehavior: "React's LineForm renders the Length, Angle and Fence offset fields.",
      desiredBehavior: "Angular renders those fields inside the retained React drawer with the same behavior.",
    };
    const contractPath = path.join(temporary, "flow-contract.json");
    await writeFile(contractPath, JSON.stringify(contract, null, 2));

    const story = renderUserStory(await readContract(contractPath));
    assert(story.startsWith("# User Story — Migrate the Detail Drawer line fields"), "the title is not the heading");
    assert(!/\.tsx?:\d/.test(story), "a file:line citation reached the Story");
    assert(story.includes("- Given a line is selected and the Length field shows its current real length, when "),
      "a scenario is not rendered as a Given/When/Then acceptance criterion");
    assert(contract.scenarios.every(scenario => story.includes(lowerFirst(clause(scenario.when)))),
      "a scenario is missing from the acceptance criteria");
    assert(contract.characterizationRequired.every(entry => story.includes(sentence(entry.hypothesis))),
      "a characterization hypothesis is missing from the attention points");
    assert(story.includes("Verify manually in: Route Assistant desktop application"),
      "the manual verification environment is missing");

    delete contract.userStory.title;
    await writeFile(contractPath, JSON.stringify(contract, null, 2));
    let invalid = "";
    try {
      await readContract(contractPath);
    } catch (error) {
      invalid = error.message;
    }
    assert(invalid.includes("does not validate"), "a contract that fails validation was rendered");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.log("User Story self-test passed.");
};

const main = async () => {
  const [argument] = process.argv.slice(2);
  if (argument === "--self-test") {
    await runSelfTest();
  } else if (!argument || argument === "--help") {
    process.stdout.write(usage);
    process.exitCode = argument ? 0 : 1;
  } else {
    process.stdout.write(renderUserStory(await readContract(argument)));
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
