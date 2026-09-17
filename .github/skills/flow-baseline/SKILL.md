---
name: flow-baseline
description: Establish a reviewable behavior and test-evidence baseline for one human-selected React-to-Angular migration flow. Requires a high-capability reasoning model. Use only with /flow-baseline.
---

# Flow Baseline

Pipeline: `/flow-plan` -> `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`,
with `/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the first stage of a slice's chain: it produces the contract
every later stage reads.

Skill version: `0.35.0`.

Recommended model: Claude Sonnet 5. This phase writes the contract that every
later phase depends on.

Analyze one explicitly selected flow: survey its rendered surfaces, settle a
boundary from that evidence, write a final `flow-contract.json`
with the behavior baseline, the surface inventory and a bounded
target-architecture proposal, then the slice's User Story and a short review
summary in this chat. Do not implement Angular code or present the proposed
architecture as an established team standard.

The contract is the only durable analysis artifact. Write no prose report and
no User Story file: a second persisted copy drifts the moment either side is
edited, and no later skill reads it.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

Ask the user only for what nobody else holds: the flow and its user-visible
goal. Never choose it yourself; when the scope is materially ambiguous, ask one
focused question and stop.

- When the invocation names no flow, run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --lab-root <lab> --ready [<migration-map.json>]`,
  the map only when the invocation names one, and put its `available` slices
  to the user, queued ones first, each with its `reason`, the unbuilt
  prerequisites in `sharesUnbuiltWithActive`, since a slice on another branch
  builds those too and whichever lands second meets a merge conflict, its
  `remainder` and whether `productMoved`. Wait for
  the choice even when one slice is queued. When it reports `replan`, say
  `/flow-plan` runs first, with its `replanReason`, and stop. A confirmed
  entry with a `remainder` continues an earlier chain: this run cuts from
  that remainder.

Derive everything else, state each value in one line and continue. A question
whose answer is in the product repository, this skill or the lab costs the user
a turn to tell you something you knew; it is the failure this skill is asked
about most.

- Once the flow is settled and before the survey, run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --lab-root <lab> --flow-id <slug> --claim --commands`,
  where `<product>` is still the integration checkout the invocation names.
  Without a map, the `flowId` is the flow as a slug; reuse an earlier
  artifact's exact `flowId` so its earlier runs and saved prompts still match. Ask
  only when the flow maps to more than one plausible id. `--claim` creates
  this run's directory so no other chat takes the same slice:
  `flow.claimed.directory` and `flow.claimed.runId` are this run's, and
  `flow.nextRunDirectory` then points past it. A refused claim means another
  chat holds the flow; offer the next available slice. The output also gives
  this flow's saved prompts and the package scripts.
- Right after the claim, run
  `node "<lab>\scripts\slice-worktree.mjs" --create --product-root <product> --run-id <flow.claimed.runId>`.
  It branches this run off the integration branch into its own worktree, so
  the slice never shares a working tree with another slice's uncommitted work.
  From here on `<product>` is its `worktree`: the survey, `repository.root`,
  every later command and the continuation. Take the product revision and
  status from
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --save-status`
  in that worktree. A refused create releases the claim and reports why. When it
  instead reports the integration branch itself missing, create that one branch
  once, in the integration checkout, with
  `git branch migration/angular <revision>` using the fixed revision
  `docs\project-constants.md` names — a branch pointer only, never a checkout,
  reset or commit — then retry `--create`.
- An invocation that names a `migration-map.json` comes from `flow-plan`,
  where the user queued this slice. The `flowId` is that slice's `flowId`
  verbatim, from the invocation or the `--ready` entry the user confirmed,
  never a slug of its title: `--ready`, the claim and the seed match on it.
  Read only that slice's entry and the prerequisites in its `requires`, and
  from the metrics it points to that slice's `angularTargets` and those
  prerequisites' `target`. Its `paths` are the ceiling step 3 cuts within,
  and its criteria verdicts the planning view. A prerequisite marked `built`
  is reused unchanged; one this slice builds lands at its measured `target`,
  whose folder joins the allowlist.
- A saved `<flowId>-<skill>-prompt.md` means an earlier phase chose to continue
  later: say so in one line and resume from the artifacts it names, exactly as
  if the phases had run back to back.
- Board IDs, Epics, Features, Tasks and board state are never a question and
  never recorded: the user places the Story on the board.
- The test, typecheck and build commands are `commands.suggested`: run-once
  forms, never a script marked `terminates: false`, which would hang
  `flow-migrate`, or `writesToWorktree`. Confirm them in one line.
- Read `<lab>\docs\project-constants.md` before the survey and say that you did.
  It settles the framework version, packages, compilation and mount mechanism,
  the Angular target structure, change detection, install command, test
  location, coverage and the manual verification environment. Never ask about
  anything on it and never put it in `openQuestions`; if the file is absent,
  record that single gap as the open question instead of reconstructing it.
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

## Progress tracking

When the host offers a session todo list, seed it before step 1 with the
numbered Workflow steps below, in order and named as they are named here, and
move each one to in_progress when it starts and to done or blocked when it
ends. It exists so the user can see where a long run stands and which step
stopped it.

A todo is a progress marker and never evidence: it stands in for no citation,
no validated contract and no reporting step, an unfinished step is never
closed to keep the list tidy, and a host without the feature changes nothing
about this workflow.

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
   importers outside this flow's directory, tests and stories left out as
   `migration-map.mjs` leaves them out, and cite them: a control with a dozen
   external importers is shared infrastructure wherever it sits on screen. The counts stay out of the contract; the boundary decision carries
   the conclusion.
   For every `migrate` surface, run
   `node "<lab>\scripts\style-sources.mjs" --product-root <product> --entry <component file>[:<start>-<end>]`,
   the line range when the surface is part of a file and `--map <migration-map.json>`
   when the invocation names one. It walks the render tree down to the
   templates that paint the surface, which a description misses: a label's
   technique was two components deeper than the field. Read what it lists
   under `unparsed`, `unresolved`, `unfollowed` and `packages`, and each
   `icons` entry without a `source`, by hand. An `angularMounts` entry means
   that part already runs in Angular and has nothing left to cite.
   While reading entry points, note whichever router, menu or navigation
   configuration mounts the surveyed surface, cited, for
   `validationPlan.manualValidation.userPath` later: the screen, menu or tab a
   tester opens to see the surface running today. Leave it for step 6 when no
   citable route turns up; never guess one.
3. **Boundary.** Only now, with the evidence in hand, weigh materially
   different candidates. Judge every candidate in writing against all four
   criteria and say plainly where it fails:
   - one owner: every migrated surface belongs to this flow;
   - no shared infrastructure in the write allowlist;
   - a measurable neighbour: a nested mount needs a `retain-react` sibling to
     compare visual parity against;
   - bounded branches: every capability gate or mode branch doubles what
     verification must cover.
   A slice from a map is a ceiling: ask nothing, choose the largest cut within
   its `paths` that meets all four, never a broader one, and set `planSlice`.
   Parallel baselines then stay in the lanes `flow-plan` drew, and what the
   cut leaves is picked up by the next chain instead of a new plan run.
   Without a map, put two or three candidates to the user. For each, give its
   `migrate` set, its `retain-react` neighbours, the external importer count,
   as a number, of every component its allowlist would touch, the conditional
   branches it takes on and the existing test evidence that covers it. Show
   the preferred candidate's write allowlist in the same question and ask
   whether anything in it is off limits; honour a constraint and never widen a
   boundary the user ruled out. Write the question as plain text, since
   escaped newlines reach the user literally. Either way, record the outcome
   as a `decisions` entry whose rationale names the rejected candidates and
   whose `followUp` names what a later slice picks up.
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
   `visualParity`, `decisions`, `testGaps`, `openQuestions`, `userStory`,
   `checkpointPolicy`, `validationPlan` and `rollback` as it specifies.
7. **Write and validate** `flow-contract.json` at schemaVersion 8 in the run
   directory. Copy each block's shape from
   `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\handoff\detail-drawer-line-edit\flow-contract.json" [--block <name>]`,
   a real chain that passed end to end at schemaVersion 6, then leave out its
   `workItemContext` and add `userStory`. Run
   `node "<lab>\scripts\validate-handoff.mjs" <contract>`. The contract is
   final when written: it has no `status`, `approval` or
   `targetArchitecture.status`, no draft state and no approval gate. When the
   host already runs in plan mode, write the artifacts after the user has
   exited it; a skill never enters or leaves plan mode.
8. **Visual baseline.** React still owns the surface here, and only here, so
   this is the one phase that can record what the host paints before the
   migration. Write `visual-selectors.json` in the run directory: `flowId`,
   then one `surfaces` entry per `visualParity` id, each with that `id` as
   `visualParityId`, the `selector` that finds the surface in the running host
   and the `counterpartSelector` of the retained sibling the entry already
   names in `counterpart`. Prefer a `data-testid` over a generated class, which
   changes between builds. Then run
   `node "<lab>\scripts\visual-measure.mjs" --spec <run-dir>\visual-selectors.json --label before --out <run-dir> [--port <n>]`
   with the manual verification environment running, and check each surface
   came back `found: true`: a selector that matches nothing is a selector to
   fix now, not a measurement. The sidecar and its
   `visual-measurement-before.json` are found by name in the run directory,
   not by a contract pointer, because the contract schema is closed.
   When no host answers, say so in one line and continue. The contract does not
   wait for it: `flow-verify` then compares the migrated surface against its
   retained counterpart alone and records that the before-measurement was
   never taken, which is weaker evidence but still measured.
9. **Worktree check.** Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare`.
   If anything changed, stop and report the delta; do not revert it or
   attribute it without evidence.
10. **User Story and review summary.** Run
    `node "<lab>\scripts\render-user-story.mjs" <flow-contract.json>`. Your next
    chat message pastes its whole output verbatim, the Story the user copies
    onto the board followed by the review facts, because the host collapses
    tool output and a run once showed neither. Paraphrasing drifts from what
    `flow-verify` checks. When the output is too large for inline display and
    is instead saved to a file, open that file and copy its exact text into the
    chat message; never substitute a summary, a translation or a bullet recap
    for it, in that message or a later one — a run once did, and the User Story
    never reached the user at all. After it, add in your own words only the
    `targetArchitecture` boundary and adapter in a few lines, and end by naming
    what would need a new run to change: the boundary, the write allowlist or a
    scenario. Neither part is a gate, asks for anything or changes the board.
11. **Continuation.** Build the invocation with
    `node "<lab>\scripts\continuation.mjs" --next flow-migrate --lab-root <lab> --product-root <product> --run-dir <run-dir> <flow-contract.json>`,
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
11. **Observations.** Last, after the chosen route, so a skipped step can still
    be recorded: read `<lab>\docs\flow-observation-capture.md` and follow it
    with `--primary <flow-contract.json> --status draft`, or `failed` or
    `blocked` when no contract could be written. Either sidecar closes the
    claim. A run left before it wrote anything frees its slice with
    `run-context.mjs --product-root <integration checkout> --lab-root <lab> --flow-id <flowId> --release`,
    which removes only an empty run directory, then
    `slice-worktree.mjs --remove --product-root <integration checkout> --run-id <runId>`,
    which removes only a clean worktree and a branch without commits.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out product
  files; write tests or product code; install dependencies or alter lockfiles,
  configuration or environment files; start persistent services; or create any
  checkpoint commit in this read-only phase. The exceptions are the branch,
  worktree and `npm ci` that `slice-worktree.mjs --create` makes for this run,
  and, only when that command reports the integration branch missing, the one
  `git branch migration/angular <revision>` pointer creation named in Inputs;
- write a file other than the contract and the observation sidecar in the run
  directory, which `--claim` creates at the start;
- take a slice the user did not confirm, or survey one before its claim
  succeeded;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data;
- edit this skill, its references or an installed snapshot during a run;
- present unapproved Angular conventions as target requirements;
- update Targetprocess;
- silently turn a possible UX improvement into accepted migration behavior;
- enter, leave or simulate a host plan mode, or present the review summary as
  a gate;
- put a path in `scope.allowedWritePaths` that the chosen slice does not need
  or that lies outside the map slice's ceiling;
- start the migration in this chat, in a background agent or by a route the
  user did not choose.

`flow-migrate` reads only the contract; nothing from this chat reaches it.

## Reading discipline

Context is spent once; every re-read pays again for nothing.

- Read a file once, at the range you need, and never re-read a range you hold.
- Widen or narrow a search instead of repeating it in other words.
- Learn an artifact's shape from `print-shape.mjs`, never from `schemas\`,
  `scripts\` or a whole example file; write the artifact and act on the
  validator's errors. Read the validator's rule only when an error names no
  fix and one retry fails, and record that as an observation.
- Resolve a module path, barrel or single file, before reading it.
