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

Validates a flow-contract from schemaVersion 7 on and prints its User Story as
copy/paste text blocks: title, user value, current and desired behavior,
acceptance criteria from the scenarios and visual parity surfaces, and
attention points from the characterization hypotheses, open questions, the
map slice remainder and the manual verification environment. Citations are
left out; the contract keeps them.

Then prints the review facts a reader could disagree with, verbatim from the
contract: partial mount, remainder, surfaces, scenarios, hypotheses, visual
parity, write allowlist, commands, manual verification, rollback, checkpoint
policy, decisions and open questions, ending with the optional user path when
the contract carries one. Writes nothing.
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
    throw new Error(`${absolute} is schemaVersion ${contract.schemaVersion} and carries no userStory; a User Story is rendered from schemaVersion 7 on.`);
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
// Only a leading article or determiner is lowered mid-sentence; a field label
// or identifier such as "Length" or "CanvasObjectAngleInput" keeps its case.
const lowerFirst = text =>
  /^(?:a|an|the|no|each|every|all|both|any|some|this|that|these|those|its|it|their|there|one|none)\b/i.test(text)
    ? text.charAt(0).toLowerCase() + text.slice(1)
    : text;

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

// A hand-written review summary once paraphrased these and dropped a write
// path, so they come from the contract rather than from memory.
const code = text => `\`${text}\``;
const section = (label, items) =>
  [`**${label}**`, "", ...(items.length > 0 ? items.map(item => `- ${item}`) : ["- None."]), ""];

export const renderReviewFacts = contract => {
  const { partialMount } = contract.scope;
  const { validationPlan } = contract;
  return [
    `# Review facts — ${code(contract.flowId)}`,
    "",
    ...section("Partial mount", [partialMount.nested
      ? `Nested in ${code(partialMount.retainedParent)}; retained siblings: ${partialMount.siblingSections.join(", ")}.`
      : "Not nested: the slice mounts on its own."]),
    ...section("Slice remainder", [contract.planSlice
      ? sentence(contract.planSlice.remainder)
      : "No migration map slice."]),
    ...section("Rendered surfaces", contract.renderedSurfaceInventory.map(entry => `${code(entry.id)} — ${entry.status}`)),
    ...section("Scenarios", contract.scenarios.map(scenario => `${code(scenario.id)} — when ${lowerFirst(clause(scenario.when))}`)),
    ...section("To prove first", (contract.characterizationRequired ?? []).map(entry =>
      `${code(entry.id)}, before ${code(entry.proveBefore)}: ${sentence(entry.hypothesis)}`)),
    ...section("Visual parity", (contract.visualParity ?? []).map(entry =>
      `${code(entry.id)} — compared with ${clause(entry.counterpart)}`)),
    ...section("Allowed write paths", contract.scope.allowedWritePaths.map(code)),
    ...section("Commands", [
      ...validationPlan.testCommands.map(command => `test: ${code(command)}`),
      `typecheck: ${code(validationPlan.typecheckCommand)}`,
      `build: ${code(validationPlan.buildCommand)}`,
      ...(contract.targetArchitecture.dependencyChanges?.required ? [`install: ${code(validationPlan.installCommand)}`] : []),
    ]),
    ...section("Manual verification", validationPlan.manualValidation.required
      ? [`Walkthrough: ${sentence(validationPlan.manualValidation.scenario ?? "not recorded")}`,
        `Environment: ${sentence(validationPlan.manualValidation.environment ?? "not recorded")}`]
      : ["Not required."]),
    ...section("Rollback", [sentence(contract.rollback)]),
    ...section("Checkpoint policy", [`${code(contract.checkpointPolicy.mode)}, push ${code(contract.checkpointPolicy.pushPolicy)}`]),
    ...section("Decisions", contract.decisions.map(entry => `${entry.topic}: ${sentence(entry.decision)}`)),
    ...section("Open questions", contract.openQuestions.map(sentence)),
    ...(validationPlan.manualValidation.userPath
      ? section("User path", [sentence(validationPlan.manualValidation.userPath)])
      : []),
  ].join("\n");
};

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
    contract.scenarios[0].then.push("Length keeps focus");
    contract.visualParity[0].counterpart = "CanvasObjectAngleInput's rendered FocusNumberInput";
    const contractPath = path.join(temporary, "flow-contract.json");
    await writeFile(contractPath, JSON.stringify(contract, null, 2));

    const story = renderUserStory(await readContract(contractPath));
    assert(story.includes("; Length keeps focus") && story.includes("the same as CanvasObjectAngleInput's rendered"),
      "a field label or identifier lost its capital letter");
    const review = renderReviewFacts(contract);
    assert([...contract.scope.allowedWritePaths, ...contract.validationPlan.testCommands].every(value => review.includes(`\`${value}\``)),
      "a write path or test command is not in the review facts verbatim");
    assert(contract.scenarios.every(scenario => review.includes(`\`${scenario.id}\``)) &&
      contract.decisions.every(entry => review.includes(entry.topic)),
      "a scenario id or decision is missing from the review facts");
    assert(!review.includes("**User path**"),
      "a User path section appeared for a contract with no manualValidation.userPath");
    const withUserPath = { ...contract, validationPlan: { ...contract.validationPlan, manualValidation: {
      ...contract.validationPlan.manualValidation, userPath: "Open the Floor Plan Creator and select a line.",
    } } };
    const reviewWithUserPath = renderReviewFacts(withUserPath);
    assert(reviewWithUserPath.includes("**User path**") &&
      reviewWithUserPath.indexOf("**User path**") > reviewWithUserPath.indexOf("**Open questions**") &&
      reviewWithUserPath.includes("Open the Floor Plan Creator and select a line."),
      "the optional User path section did not render last with its text");
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
    const contract = await readContract(argument);
    process.stdout.write(`${renderUserStory(contract)}\n${renderReviewFacts(contract)}`);
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
