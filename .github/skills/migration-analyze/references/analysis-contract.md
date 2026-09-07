# Analysis Contract

Read this reference for every `migration-analyze` run.

## Hard Gates

A run fails immediately if it:

1. changes product files, Git state, dependencies, configuration, external
   systems, or the skill itself;
2. states an Angular target convention as fact without an approved source;
3. makes a `Confirmed` repository claim without a file and line citation;
4. silently omits a required report section;
5. stores credentials, tokens, private URLs, full source copies, or
   unnecessary personal data;
6. continues after discovering a materially ambiguous feature boundary.

On failure, stop, identify the failed gate, preserve evidence, and do not
invent a success-shaped fallback.

## Input and Scope Contract

The run requires:

- one explicit feature, flow, component boundary, or named behavior;
- one confirmed repository root;
- one approved report target or an explicit chat-only result;
- a scope checkpoint that states inclusions, exclusions, start state, end
  state, and boundary confidence.

Ask only when ambiguity materially changes the analysis.

## Read Contract

Use progressive disclosure:

1. relevant enforced configuration;
2. feature entry points and direct consumers;
3. executable tests;
4. stories and feature documentation;
5. dependencies that contribute to selected behavior or risk.

Search for every direct in-repository consumer. For each consumer, trace at
most one upstream producer when it determines a visible input, variant, or
mode. Do not expand into excluded parent behavior.

When tests are relevant, include their runner, environment, setup, and required
providers in the dependency map. Static test source confirms that assertions
exist; only observed successful execution confirms that tests pass.

For current behavior, executable tests and enforced configuration outrank
prose. Report contradictions instead of silently choosing one source.

Inventory Lely Markdown filenames only when needed. Read the three approved
core migration documents and other files or sections only when demonstrably
relevant. Do not load the whole vault.

Record pointers, line citations, short summaries, and hashes where useful.
Never copy full source files into reports or checkpoints.

## Write and Side-Effect Contract

The product repository is read-only. Do not create, change, delete, rename,
format, generate, stage, commit, stash, or check out anything there.

Do not install dependencies, update lockfiles, create environments, modify
environment files, start persistent services, or make external writes.

The approved canonical report folder is:

`C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses`

Name persisted reports:

`YYYY-MM-DD-<feature-id>-migration-analyze-v0.1.0.md`

Retain reports until a human explicitly approves cleanup. Compact,
non-sensitive benchmark metrics or checkpoints may be written under the
ignored `C:\Project\migration-skill-lab\runs` folder only when the benchmark
declares them. A normal analysis run writes no benchmark state.

If persistence is unavailable or fails, return the report in chat and record
persistence as an `Open question`. Never report a failed write as successful.

## Evidence Labels

Every material statement uses exactly one label:

- `Confirmed`: directly supported by cited source, configuration, test, or
  observed run evidence.
- `Inference`: reasoned conclusion with supporting citations and an explicit
  validation step.
- `Open question`: unknown with owner, impact, required evidence, and blocker
  phase.

List contradictory evidence in its own subsection.

For negative claims such as "no state", "no line-height", or "no side
effects", cite the complete relevant component or style definition. If the
inspected evidence cannot establish absence, use `Inference` and give a
validation step.

Do not use ignored dependency contents as revision-stable evidence. Cite the
tracked theme mapping, manifest, or lockfile and keep unresolved package
behavior explicit.

## Evidence Ledger Discipline

Build the compact evidence register before drafting other sections. Give each
material repository claim one stable ID and a direct citation.

In all other sections:

- refer to that evidence ID as `Confirmed [C#]` instead of introducing a new
  confirmed claim;
- use `Confirmed (input)` only for user-provided scope facts;
- use `Confirmed (observed run evidence)` only for evidence shown in the
  report, such as revision and fingerprints;
- label recommendations as recommendations, not `Confirmed`;
- use `Inference [I#]` with citations and a validation step for conclusions.

Do not output a "pre-delivery passed" checklist. Perform the audit silently.

## Required Report Order

### 1. Scope and feature boundary

Include:

- user-visible goal;
- start and end state;
- included entry points and code areas;
- explicit exclusions;
- boundary confidence.

### 2. Behavior baseline

Cover where applicable:

- happy path;
- validation and error paths;
- loading, empty, offline, retry, and recovery behavior;
- keyboard and interaction behavior;
- state mutations and persistence;
- side effects and cleanup;
- observable REST, SignalR, Maui, Auth0, routing, storage, SVG/DOM, and
  undo/redo effects;
- fallback and default branches for runtime inputs;
- relevant empty, boundary, negative, fractional, and non-finite input
  behavior when the public type permits those values;
- variant-specific visible typography, shape, stroke, and positioning;
- known existing defects, separate from desired behavior.

Explicitly mark each non-applicable category, including validation/errors,
loading, empty, offline, retry, recovery, keyboard interaction, mutation,
persistence, side effects, and cleanup.

### 3. Dependency map

For every relevant edge, record:

- source and target;
- dependency type;
- direction and purpose;
- evidence citation;
- confidence;
- whether it crosses the feature boundary.

Distinguish compile-time, runtime, state, event, host, network, storage,
visual, and test dependencies.

Include test runner/environment edges and the one-step upstream producer of a
visible consumer prop when those are present.

Use one source-target edge per row. Do not combine targets that have different
types, purposes, confidence, or boundary-crossing status. Distinguish
type-only imports, JSX runtime, test runtime, preview runtime, and providers.

Mark an edge as crossing the feature boundary when its target is outside the
approved production code area, including external packages and test or
Storybook runtimes. Evidence files that are in scope do not make their external
runtimes part of the production feature.

### 4. Evidence and contradictions

Provide the authoritative compact evidence register used by every other
section. Keep `Confirmed`, `Inference`, and contradiction counts consistent
with the final summary.

### 5. Test coverage and gaps

Identify:

- existing relevant test assertions and, only when observed, passing test
  execution;
- behavior not covered by automated tests;
- remaining manual checks;
- stale, skipped, contradictory, or implementation-coupled tests;
- recommended evidence priority without writing tests.

### 6. Risk classification

Give an overall `low`, `medium`, `high`, or `critical` risk. Score and explain:

- state and lifecycle;
- external or host integration;
- DOM/SVG ownership;
- behavior and interaction complexity;
- test evidence quality;
- convention uncertainty;
- blast radius and shared dependencies.

Base each score on evidence. File count alone is not a risk model.

State the rule used to derive overall risk from the dimensions. Do not invent a
numeric aggregate unless category thresholds are defined. A lower overall
category than the highest material dimension requires an explicit containment
or evidence-based reason.

Every risk statement labeled `Inference` requires supporting citations and an
explicit validation step.

### 7. Open questions

Use a table with one row per open question and these columns:

- question;
- why it matters;
- owner or role;
- evidence needed;
- whether it blocks analysis, planning, or implementation.

Missing Angular conventions do not block current React behavior analysis.

### 8. Compact machine-readable summary

End with valid JSON containing exactly these required fields:

```json
{
  "schemaVersion": 1,
  "skillVersion": "0.1.0",
  "featureId": "feature-id",
  "repositoryRevision": "revision",
  "boundaryConfidence": "low|medium|high",
  "risk": "low|medium|high|critical",
  "evidenceCounts": {
    "confirmed": 0,
    "inference": 0,
    "contradictions": 0
  },
  "testGapCount": 0,
  "openQuestionCount": 0,
  "reportLocation": null
}
```

Use the persisted absolute path for `reportLocation` after a successful write;
otherwise use `null`. The summary contains counts and pointers, not source
copies or prose evidence.

## Worktree Verification

Before and after analysis, capture:

- repository revision;
- Git porcelain status including all untracked files;
- a fingerprint of the staged and unstaged tracked diff without recording its
  content.

Compare against the initial snapshots, not against an assumed clean worktree.
Also review the run's own tool actions for write-capable operations targeting
the product repository.

State conclusions narrowly. Identical Git evidence confirms unchanged
Git-visible state; it does not prove that ignored files or external systems
were unchanged. The observed action log can confirm that the run did not issue
a write-capable product or external action.

If the snapshots differ:

- fail the no-side-effect gate;
- show the delta without exposing sensitive content;
- do not revert it;
- do not claim the skill caused it unless evidence proves causation.

## Pre-Delivery Audit

Before returning or persisting the report, verify:

1. Every material `Confirmed` repository claim, including table rows and test
   gaps, has its own direct file and line citation.
2. Every `Inference` has supporting citations and an explicit validation step.
3. Every absence or "no test" claim cites the complete relevant definition or
   test file. Narrow the claim when any covered passthrough or behavior exists.
4. Static test source is described as assertions, never as a passing result.
5. Public input domains include relevant empty, boundary, negative,
   fractional, and non-finite behavior.
6. Every direct consumer is present and visible placement or mode is recorded;
   relevant prop producers are traced one step.
   Count only files that render the analyzed component as consumers; keep
   enum/type-only importers and upstream producers separate.
7. Dependency rows contain one edge and one boundary status each. Type-only,
   JSX, production, test, preview, provider, and external edges are not merged.
8. Visual statements distinguish dot, count, and label variants.
9. Risk inferences have citations, validation steps, and an explicit overall
   aggregation rule without an undefined numeric total.
10. Operational claims do not exceed Git fingerprints and observed tool
    evidence included in the report.
11. Evidence counts, test-gap count, open-question count, risk, revision, and
    report location match the JSON summary.
12. All eight sections and every required non-applicable behavior category are
    explicit.
