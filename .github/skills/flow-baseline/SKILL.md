---
name: flow-baseline
description: Establish a reviewable behavior and test-evidence baseline for one human-selected React-to-Angular migration flow. Use only with /flow-baseline.
---

# Flow Baseline

Skill version: `0.5.2`.

Analyze one explicitly selected flow or component boundary. Produce a
human-readable behavior baseline, a bounded target-architecture proposal and
a draft `flow-contract.json` for a later approved migration. Do not implement
Angular code or present the proposal as an approved team standard.

## Required inputs

Confirm before deep analysis:

- one human-selected `flowId` and user-visible goal;
- migration-skill-lab root containing the validator and schemas;
- product repository root;
- included boundary, exclusions, start state and end state;
- approved baseline-report destination;
- declared run-artifact directory;
- whether existing coverage evidence is available or a measurement command is
  explicitly approved.
- current Epic, Feature and User Story IDs, titles, parent relations, state,
  progress and description content, including whether a new item is requested;
- current User Story Tasks, or approval to propose stakeholder-readable Tasks
  for baseline, implementation and independent verification;
- declared work-item handoff JSON and rendered Markdown destinations;
- checkpoint mode, expected product branch, external work-item reference and
  push policy that a human may approve for the later migration.
- proposed targeted test, typecheck and build commands, required manual host
  scenario and rollback; leave unresolved draft fields absent rather than
  inventing them.
- current external board state/progress separately from any proposed
  Task-derived state/progress.

Ask one focused question and stop if scope or report destination is materially
ambiguous. Never choose the flow automatically.

## Workflow

1. Read `references/flow-contract.md`.
2. Capture the product revision and Git-visible worktree status. A dirty
   worktree is evidence, not permission to change it.
3. Read only relevant configuration, entry points, direct consumers, tests,
   stories and documentation. Follow dependencies only when they determine the
   selected flow's behavior or risk.
   Create a rendered-surface inventory for the selected route: every visible
   control, conditional capability branch, child component and action must be
   marked as `migrate`, `retain-react` or `excluded`.
4. Label material conclusions `Confirmed`, `Inference` or `Open question`.
   Cite every confirmed repository claim with file and line.
5. Inventory existing relevant tests and map them to behavior. Use existing
   coverage artifacts when available. Do not generate coverage output inside
   the product repository. If approved measurement is unavailable, state the
   coverage gap and required safe measurement instead of guessing.
6. Add a focused target-architecture proposal for only the selected flow:
   Angular component boundary, typed React/drawlib adapter, state ownership,
   mount/unmount lifecycle, styling, browser tests, Maui smoke validation and
   any required dependency/build paths. Preserve current boundaries where they
   are sound; do not mirror React mechanically or redesign the whole app.
   Capture observable visual parity (including layout insets, spacing, input
   containment and a reference screenshot when available). Mark every
   unapproved choice as proposed or open.
   A partial Angular mount may replace only inventory items marked `migrate`;
   it must remain inside the existing parent form when siblings are marked
   `retain-react`.
7. When current behavior differs from a plausible improvement, do not choose
   silently. Ask one focused product question with these routes:
   - preserve current behavior for migration;
   - include the improvement in this Story and revise its acceptance criteria;
   - preserve current behavior and propose a separate follow-up Story.
   Keep the contract pending until the answer is recorded.
8. Write the human-readable report in the approved reports location and a
   draft `flow-contract.json` in the declared run directory. Validate the JSON
   with `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<flow-contract.json>"`.
9. Set contract `status` and `approval.status` to `draft` and `pending`.
   Only a human may approve the scope and write allowlist for `migrate-flow`.
   Record checkpoint mode as `disabled` until the human explicitly approves
   `auto-local`, its expected branch, external reference and push policy.
   An approved contract requires concrete test, typecheck, build, manual-host
   and rollback values; a draft records missing values as open questions.
   The draft report, contract and work-item baseline are immutable historical
   evidence: never remove their pending or open wording after approval.
   A later approved contract and matching baseline handoff must be separate
   artifacts, include the human's `approvedDecisions`, and replace resolved
   pending items only in that successor artifact.
10. Write `work-item-baseline.json` after the Flow Contract. Populate the
   Epic, Feature and User Story templates from cited baseline evidence, use
   `create`, `update` or `no-change` honestly, and keep
   `manualApplication.status` at `copy-ready` or `not-applied`. Propose a new
   story only when the user requests it or evidence shows the selected scope
   does not responsibly fit the existing story.
11. Create or update stakeholder-readable User Story Tasks for target
   architecture/contract approval, bounded implementation and
   independent/browser/host verification. Assign
   explicit contribution percentages totaling 100 and derive User Story
   progress from Task progress. Link checkpoint milestone IDs to the
   implementation Task; do not create one Task per commit.
12. Keep confirmed current board values separate from proposed calculated
    values. A copy-ready proposal does not change current progress.
13. Add a daily standup block with completed work, next steps, blockers and
    both current and proposed User Story progress. Keep it short enough to say
    aloud.
14. Validate the Flow Contract and work-item snapshot together. Render the
   snapshot with `render-work-item-handoff.mjs`. Tell the user exactly what to
   copy into the sprint backlog; never claim that it was applied.
15. Capture the product Git-visible worktree status again. If it changed, stop,
   report the delta and do not revert or attribute it without evidence.
16. End with one focused user question offering a fresh `/migrate-flow` chat
   when an approved successor contract is available. Do not start a subagent
   or reuse this chat as the implementation run.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out files in
  the product repository;
- write tests or product code;
- install dependencies, alter lockfiles, configuration or environment files;
- start persistent services or make external writes;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data in reports or artifacts;
- edit this skill, its references or any installed skill snapshot during a run;
- present unapproved Angular conventions as target requirements.
- update Targetprocess through a browser, API or other external write;
- create an external work-item ID or mark a handoff `confirmed-applied`
  without the user's confirmation;
- invent Task progress independently of the validated weighted calculation;
- create one board Task per technical commit instead of grouping checkpoints
  under a stakeholder-readable delivery Task;
- silently convert a possible UX improvement into accepted migration behavior;
- create an empty or product checkpoint commit during this read-only phase.

## Handoff

The contract must contain the scope, behavior scenarios, evidence pointers,
test gaps, open questions, allowed product write paths, Epic/Feature/Story
context, checkpoint policy and a human approval record.
`work-item-baseline.json` contains the copy/paste hierarchy, Tasks and daily
standup proposal. Both are machine-readable inputs to `migrate-flow`; do not
rely on prior chat context.

The terminal handoff opens a fresh chat only after the user confirms it. A
draft baseline instead directs the user to approve or reject the contract first.

The report must carry the rendered-surface inventory into the migration
handoff. A scenario list alone is not permission to replace a parent component
that renders retained controls.

## Post-run observation capture

During the run, silently retain concrete evidence of user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted, or output mismatches. Do not interrupt or
reprioritize the baseline workflow to analyze these signals.

After the primary report and draft Flow Contract are complete, or after the
final `BLOCKED` or failed response when those artifacts cannot be produced:

1. Exclude product defects, expected precondition blockers, missing Angular
   conventions themselves, executor noise, preferences and static speculation.
2. Deduplicate semantically equivalent signals from this run and preserve their
   occurrence count. Do not cap the number of material observations.
3. Write `<run-artifact-directory>\skill-run-observations.json`, including an
   empty `observations` list when no signal qualifies.
4. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations.json>"`.
5. Report a capture or validation failure separately without changing the
   primary Flow Contract status.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
