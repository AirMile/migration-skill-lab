---
name: flow-baseline
description: Establish a reviewable behavior and test-evidence baseline for one human-selected React-to-Angular migration flow. Use only with /flow-baseline.
---

# Flow Baseline

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the first stage: it produces the contract every later stage reads.

Skill version: `0.19.0`.

Recommended model: Claude Opus 5. This phase writes the contract that every
later phase depends on.

Analyze one explicitly selected flow: survey its rendered surfaces, let the
user choose a boundary from that evidence, write a final `flow-contract.json`
with the behavior baseline, the surface inventory and a bounded
target-architecture proposal, then `work-item-baseline.json`, then a short
review summary in this chat. Do not implement Angular code or present the
proposed architecture as an established team standard.

The contract is the only durable analysis artifact. Write no prose report and
no rendered work-item Markdown: a second copy drifts the moment either side is
edited, and no later skill reads it.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

Ask the user only for what nobody else holds:

- the flow and its user-visible goal. Never choose it yourself; when the scope
  is materially ambiguous, ask one focused question and stop;
- whether a new Epic, Feature or User Story is requested, and the real external
  ID of any that already exists on the board;
- the current external board state and progress, kept separate from the
  proposed, Task-derived values.

Derive everything else, state each value in one line and continue. A question
whose answer is in the product repository, this skill or the lab costs the user
a turn to tell you something you knew; it is the failure this skill is asked
about most.

- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --lab-root <lab> --flow-id <slug> --commands --save-status`.
  The `flowId` is the flow as a slug; reuse an earlier artifact's exact
  `flowId` so `supersedes` and `--since` still match. The output gives the
  product revision and status, `flow.nextRunDirectory` and `flow.nextRunId`,
  this flow's earlier work-item handoffs and saved prompts, and the package
  scripts. Ask only when the flow maps to more than one plausible id.
- A saved `<flowId>-<skill>-prompt.md` means an earlier phase chose to continue
  later: say so in one line and resume from the artifacts it names, exactly as
  if the phases had run back to back.
- The latest earlier baseline handoff for this flow supplies the Epic, Feature
  and Story identity, parents and field text; build on it instead of asking.
- The test, typecheck and build commands are `commands.suggested`: run-once
  forms, never a script marked `terminates: false`, which would hang
  `flow-migrate`, or `writesToWorktree`. Confirm them in one line.
- Read `<lab>\docs\project-constants.md` before the survey and say that you did.
  It settles the framework version, packages, compilation and mount mechanism,
  change detection, install command, test location, coverage and the manual
  verification environment. Never ask about anything on it and never put it in
  `openQuestions`; if the file is absent, record that single gap as the open
  question instead of reconstructing it.
- Coverage is measured in CI: record per-flow figures as not retrieved, never
  as unavailable, and never run the product's coverage script, which writes an
  ungitignored `coverage\` and `junit.xml` into the worktree.
- Checkpoint mode is `disabled` with `pushPolicy: never`; say so in one line
  and never offer the choice. Only a user who asks for `auto-local` unprompted
  changes it, and then supplies the expected branch and external reference.
- Verification is manual, in the environment the constants name. Propose the
  scenarios a person walks through; never browser automation, a runner or an
  owner.

Every question this run asks has answerable options: no route the validator
rejects, no command the safety boundary forbids, no value the run can derive.

## Workflow

1. Take the product revision and status from `run-context.mjs`. A dirty
   worktree is evidence, not permission to change it.
2. **Survey.** Read only the relevant configuration, entry points, direct
   consumers, tests, stories and documentation; follow a dependency only when
   it determines the flow's behavior or risk. Record
   `renderedSurfaceInventory`: every visible control, conditional branch, child
   component and action, with an `id`, a `surface`, a status (`migrate`,
   `retain-react` or `excluded`) and a `reference` citation. Classify only; the
   condition under which a control renders is in the cited source. An
   exclusion is recorded here and nowhere else, as a cited entry.
   For every surface rendered by its own component, run one search for
   importers outside this flow's directory and cite them: a control with a
   dozen external importers is shared infrastructure wherever it sits on
   screen. The counts stay out of the contract; the boundary decision carries
   the conclusion.
3. **Boundary.** Only now, with the evidence in hand, put two or three
   materially different candidates to the user. For each, give its `migrate`
   set, its `retain-react` neighbours, the external importer count, as a
   number, of every component its allowlist would touch, the conditional
   branches it takes on and the existing test evidence that covers it. Judge
   every candidate in writing against all four criteria and say plainly where
   it fails:
   - one owner: every migrated surface belongs to this flow;
   - no shared infrastructure in the write allowlist;
   - a measurable neighbour: a nested mount needs a `retain-react` sibling to
     compare visual parity against;
   - bounded branches: every capability gate or mode branch doubles what
     verification must cover.
   Show the preferred candidate's write allowlist in the same question and ask
   whether anything in it is off limits; honour a constraint and never widen a
   boundary the user ruled out. Write the question as plain text, since escaped
   newlines reach the user literally. Record the outcome as a `decisions` entry
   whose rationale names the rejected candidates and whose `followUp` names
   what a later slice picks up.
4. **Evidence.** Label material conclusions `Confirmed`, `Inference` or
   `Open question`, and cite every confirmed claim with file and line. Map the
   existing tests to behavior, using existing coverage artifacts only; never
   generate coverage output in the product repository.
5. **Scenarios.** Write each as a Given/When/Then outcome that names the
   behavior and cites the line proving it. Do not restate the mechanism:
   `flow-migrate` opens that source anyway, and a copy goes stale. Name
   concrete values a tester can act on, never a category: not "a robot with
   FeedPush capability" but the robot type the source registry names. Record a
   reasoned-but-unproven risk as a `characterizationRequired` entry.
   When current behavior differs from a plausible improvement, never choose
   silently: ask one product question with three routes (preserve current
   behavior; include the improvement in this Story and revise its acceptance
   criteria; preserve it and propose a follow-up Story) and write no contract
   until the answer is recorded.
6. **Contract content.** Read `references/flow-contract.md` now, and record
   `targetArchitecture`, `scope` with `partialMount` and the write allowlist,
   `visualParity`, `decisions`, `testGaps`, `openQuestions`,
   `workItemContext`, `checkpointPolicy`, `validationPlan` and `rollback` as it
   specifies.
7. **Write and validate** `flow-contract.json` at schemaVersion 6 in the run
   directory. Copy each block's shape from
   `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\handoff\detail-drawer-line-edit\flow-contract.json" [--block <name>]`,
   a real chain that passed end to end at the versions in force, then run
   `node "<lab>\scripts\validate-handoff.mjs" <contract>`. The contract is
   final when written: schemaVersion 6 has no `status`, `approval` or
   `targetArchitecture.status`, no draft state and no approval gate. When the
   host already runs in plan mode, write the artifacts after the user has
   exited it; a skill never enters or leaves plan mode.
8. **Work-item snapshot.** Read `<lab>\docs\flow-work-item-steps.md` and follow
   it for `work-item-baseline.json`. Populate the templates from cited contract
   evidence, and propose a new Story only on request or when evidence shows the
   slice does not responsibly fit the existing one. The baseline Task is
   complete once the contract validates.
9. **Worktree check.** Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare`.
   If anything changed, stop and report the delta; do not revert it or
   attribute it without evidence.
10. **Review summary.** Render one screen from the validated contract, never
    from memory, with only what a reader could disagree with:
    - the `flowId`, the boundary and the `scope.partialMount` shape;
    - `renderedSurfaceInventory`, one line per surface with its status;
    - the `targetArchitecture` boundary and adapter in a few lines;
    - each scenario id with a one-line summary;
    - every `characterizationRequired` hypothesis;
    - each `visualParity` id with its counterpart;
    - `allowedWritePaths` verbatim, the test, typecheck and build commands, the
      manual scenario and its environment, the rollback and the checkpoint
      policy;
    - every open question and decision.
    Do not restate confirmed behavior or its citations. The summary is not a
    gate and asks for nothing: end it by naming what would need a new run to
    change, which is the boundary, the write allowlist or a scenario.
11. **Continuation.** Build the invocation with
    `node "<lab>\scripts\continuation.mjs" --next flow-migrate --lab-root <lab> --product-root <product> --run-dir <run-dir> <flow-contract.json> <work-item-baseline.json>`,
    then offer exactly three routes and perform only the chosen one:
    1. a fresh chat opened now through the host's own mechanism, carrying only
       the invocation. Never start a second terminal window: a skill cannot
       start a terminal, and `wt.exe` cannot start `copilot.cmd`;
    2. the invocation shown here, to paste into a chat the user opens;
    3. the same command with `--save`, which writes
       `<flowId>-flow-migrate-prompt.md` in the run directory. Say that this is
       a checkpoint, not an abandonment: every phase reads only artifacts, so
       it runs correctly days later.
    Never continue the migration in this chat or delegate it to a background
    agent, which cannot ask the user what it needs.
12. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
    it with `--primary <flow-contract.json> --status draft`, or `failed` or
    `blocked` when no contract could be written.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out product
  files; write tests or product code; install dependencies or alter lockfiles,
  configuration or environment files; start persistent services; or create any
  checkpoint commit in this read-only phase;
- write a file other than the contract, the work-item snapshot and the
  observation sidecar in the run directory;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data;
- edit this skill, its references or an installed snapshot during a run;
- present unapproved Angular conventions as target requirements;
- update Targetprocess, invent an external ID or a progress value, or mark
  anything applied without the user's confirmation;
- silently turn a possible UX improvement into accepted migration behavior;
- enter, leave or simulate a host plan mode, or present the review summary as
  a gate;
- put a path in `scope.allowedWritePaths` that the chosen slice does not need;
- start the migration in this chat, in a background agent or by a route the
  user did not choose.

`flow-migrate` reads only the contract and the work-item snapshot; nothing from
this chat reaches it.

## Reading discipline

Context is spent once; every re-read pays again for nothing.

- Read a file once, at the range you need, and never re-read a range you hold.
- Widen or narrow a search instead of repeating it in other words.
- Learn an artifact's shape from `print-shape.mjs`, never from `schemas\`,
  `scripts\` or a whole example file; write the artifact and act on the
  validator's errors. Read the validator's rule only when an error names no
  fix and one retry fails, and record that as an observation.
- Resolve a module path, barrel or single file, before reading it.
