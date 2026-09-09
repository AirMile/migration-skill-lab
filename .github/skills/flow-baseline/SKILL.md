---
name: flow-baseline
description: Establish a reviewable behavior and test-evidence baseline for one human-selected React-to-Angular migration flow. Use only with /flow-baseline.
---

# Flow Baseline

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the first stage: it produces the contract every later stage reads.

Skill version: `0.17.0`.

Recommended model: Claude Opus 5. This phase writes the contract that every
later phase depends on.

Analyze one explicitly selected flow. Survey its rendered surfaces, let the
user choose a boundary from evidence rather than up front, then produce a final
`flow-contract.json` carrying the behavior baseline, the surface inventory and
a bounded target-architecture proposal, plus a short review summary in this
chat. Do not implement Angular code or present the proposed architecture as an
established team standard.

The contract is the only durable analysis artifact. Do not write a separate
prose report: everything a later skill needs belongs in the contract, and a
second copy in Markdown drifts out of date the moment either side is edited.

## Required inputs

Confirm before deep analysis:

- one human-selected flow and its user-visible goal;
- migration-skill-lab root containing the validator and schemas;
- product repository root;
- the most recent validated work-item handoff for this `flowId`, when one
  exists; it supplies the Epic, Feature and User Story identity, parent
  relations and field text, so ask for those only when no such snapshot exists;
- whether a new Epic, Feature or User Story is requested;
- current User Story Tasks, when any exist; otherwise propose the three
  stakeholder-readable Tasks the handoff protocol fixes;
- nothing about checkpoints. Record `mode: disabled` with `pushPolicy: never`
  and say so in one line. Only a user who asks for `auto-local` unprompted
  changes that, and then the expected branch and external reference are theirs
  to supply. Do not put the choice to them: the validator refuses `auto-local`
  without those two, `confirm-after-pass` beside a disabled mode reads like a
  standing authorization, and offering a mode whose inputs do not exist yet
  invites a placeholder that reads like a real value.
- the manual verification scenarios and the rollback. Verification is manual:
  do not propose browser automation, a runner, or an owner to assign it to.
  The environment is not an input; it is a project constant, read below.

Read `<migration-skill-lab-root>\docs\project-constants.md` before the survey. It
carries the facts that do not change per flow, and every one of them was once a
question a run asked or an open question that blocked a later phase: the Angular
version and why that version, the exact packages, how Angular is compiled and
mounted, the change-detection strategy, the install command, where tests live,
how coverage is measured, and the environment a person verifies in. State in one
line that you read it. Never ask the user for anything on that page, and never
put one of its answers in `openQuestions`.

The file is the reason a contract can be complete. Without it the mount
mechanism and the dependency set are open questions, `flow-migrate` reports
`BLOCKED` on them, and the pipeline never reaches product code. If the file is
absent, say so and record that single gap as the open question; do not
reconstruct its content per run.

Coverage is on that page too, so do not ask about it. CI measures it; a run
records per-flow figures as not retrieved rather than as unavailable, and never
runs the product's own coverage script, which writes an ungitignored
`coverage\` tree and `junit.xml` into the worktree this run must leave untouched.

Derive the test, typecheck and build commands from the product's own
`package.json` rather than asking for them, and verify each one terminates. A
script such as `"test": "vitest"` starts a watcher, so `npm run test -- <file>`
never returns and would hang `flow-migrate`; the run-once form is what belongs
in `validationPlan`. Confirm the derived commands with the user in one line.

Derive the `flowId` and the run directory rather than asking for them. The
`flowId` is the selected flow as a slug; when an earlier artifact for this flow
exists, reuse its exact `flowId` so `supersedes` and `--since` still match. The
run directory is `<migration-skill-lab-root>\runs\<date>-<flowId>-baseline-<n>`.
State both in one line and continue. Ask only when the derived directory already
exists or the flow maps to more than one plausible id.

These are the questions this run does not ask, because it has already answered
them: where to write either artifact, which run directory to use, what the
`flowId` is, which test, typecheck and build commands to run, which checkpoint
mode to record, anything on the project-constants page, and whether some
component is off limits, which step 4 asks against a concrete allowlist instead. State each derived value in one line and continue.
A question whose answer is in the product repository, in this skill or in the
run directory pattern costs the user a turn to tell you something you knew, and
it is the failure this skill is asked about most.

Also confirm:

- current external board state/progress separately from any proposed
  Task-derived state/progress.

Ask one focused question and stop if the scope is materially ambiguous. Never
choose the flow automatically.

Every question this run asks must have answerable options. Do not offer a route
the validator rejects, a command this skill's own safety boundary forbids, or a
value the run can derive. Resolving that before asking is this skill's job, not
the reader's.

## Workflow

1. Read `references/flow-contract.md`.
2. Capture the product revision and Git-visible worktree status. A dirty
   worktree is evidence, not permission to change it.
3. Read only relevant configuration, entry points, direct consumers, tests,
   stories and documentation. Follow dependencies only when they determine the
   selected flow's behavior or risk.
   Record a rendered-surface inventory for the selected route in the contract
   as `renderedSurfaceInventory`: every visible control, conditional capability
   branch, child component and action gets an `id`, a `surface` name, a status
   of `migrate`, `retain-react` or `excluded`, and a `reference` citation. Give
   the classification, not the mechanics: the condition under which a control
   renders is in the cited source, and a prose copy of it goes stale as soon as
   that source changes. `flow-migrate` compares this list against the real
   render tree, so a surface missing here is a surface nobody checks.
   This list is also the only place an exclusion is recorded. A surface this
   slice deliberately leaves alone is a `retain-react` or `excluded` entry with
   its citation, not a path in a separate exclusion list: a bare path says a
   file was thought about, an inventory entry says which surface it renders and
   what happens to it.
   For every surface rendered by its own component, search the product for
   importers outside this flow's directory and cite them. One search per
   component, and it is the single fact that makes a boundary judgeable: a
   control with a dozen external importers is shared infrastructure wherever it
   happens to sit on screen. Leave the counts out of the contract; they are
   reproducible from the source, and the boundary decision carries the
   conclusion.
4. Put two or three materially different boundaries to the user and let them
   choose. Scope is not an input to this run: the evidence that decides where to
   cut only exists once step 3 is done, so asking for it up front makes the
   human decide blind and forces this skill to reopen the question halfway.
   Give each candidate its `migrate` set, its `retain-react` neighbours, the
   external importer count for every component its write allowlist would touch,
   the conditional branches it takes on, and what existing test evidence covers
   it. Cite the counts as numbers, not as "widely used": the number is what
   separates two candidates, and step 3 has already searched for it. Judge each
   one against four criteria, in writing, and say plainly where it fails:
   - one owner: every migrated surface belongs to this flow rather than to
     several object types;
   - no shared infrastructure in the write allowlist: a component with external
     importers does not belong inside the cut;
   - a measurable neighbour: a nested mount needs a `retain-react` sibling to
     compare visual parity against;
   - bounded branches: count capability gates and mode branches, because each
     one doubles the surface a later verification has to cover.
   Answer every one of the four for every candidate. A candidate presented
   without its measurable neighbour named, or without the test evidence that
   covers it, is not a candidate the user can weigh.
   Show the chosen candidate's write allowlist with the question, and ask in the
   same breath whether anything in it is off limits. That is the only form in
   which the question is answerable: asked before the survey it means "is
   anything anywhere sacred", which has never once produced an entry in a
   contract. Honour a constraint the user gives and never widen a boundary they
   ruled out.
   Write the question as plain text. Escaped newline sequences reach the user
   literally and make a three-candidate comparison unreadable.
   This is the one question this skill may ask that it could partly answer
   itself. It is a real trade-off, and it arrives with the evidence rather than
   before it.
   Record the outcome as a `decisions` entry: `topic` the slice boundary,
   `decision` the chosen candidate, `rationale` why, and `followUp` naming what
   a later slice picks up. The rejected candidates then live in the record
   instead of in chat history.
5. Label material conclusions `Confirmed`, `Inference` or `Open question`.
   Cite every confirmed repository claim with file and line.
6. Inventory existing relevant tests and map them to behavior. Use existing
   coverage artifacts when available. Do not generate coverage output inside
   the product repository. If approved measurement is unavailable, state the
   coverage gap and required safe measurement instead of guessing.
7. Record a focused target-architecture proposal for only the selected flow in
   the contract as `targetArchitecture`: `boundary.angularOwns` and
   `boundary.reactRetains`, the typed `adapter` with its `inputs`, `commands`,
   `events`, `nonSuccessOutcome` and `forbiddenAccess`, the `lifecycle` rules
   for mount, unmount and cancellation, the `styling` rules, and
   `dependencyChanges`. `boundary.angularOwns`, `boundary.reactRetains`,
   `adapter.inputs`, `adapter.commands`, `adapter.events`,
   `adapter.forbiddenAccess`, `lifecycle` and `styling` are each an array of
   strings; `adapter.nonSuccessOutcome` is one string; `dependencyChanges` is an
   object with a boolean `required`, a `packages` array of exact
   `name@version` strings, a `paths` array of repository-relative paths, and an
   optional `note`.
   The mount mechanism, the compilation strategy, the change-detection
   strategy, the framework version and the package set come from the
   project-constants page, not from this run's judgement. Transcribe them and
   cite the page. What this run decides is the boundary, the adapter, the
   lifecycle and the styling for this slice.
   Preserve current boundaries where they are sound; do not mirror React
   mechanically or redesign the whole app.
   Name where the new Angular code lands, and put that path in
   `scope.allowedWritePaths`. A contract that describes a component without a
   directory to create it in cannot be implemented: `flow-migrate` refuses every
   write outside the allowlist, so the design would be recorded and then
   immediately unimplementable.
   This is the one part of the analysis that is not recoverable from the
   product source, because the Angular side does not exist yet. Left out of the
   contract it is simply lost, and `flow-migrate` asks a human to invent it a
   second time.
   Read the product's dependency manifest before filling in
   `dependencyChanges`, and cite it. When the target framework is absent there,
   `required` is `true`, `packages` carries the exact `name@version` set from
   the project constants, and every file that set changes belongs in `paths`;
   a first slice cannot mount a framework the product does not have. Never write
   `required: false` on the assumption that earlier slices already added it:
   that is a claim about the codebase, and an unchecked claim here hides the
   largest decision the migration needs.
   Write `paths` repository-relative, the way `scope.allowedWritePaths` is
   written, and put every one of them in that allowlist. The validator rejects a
   contract that requires a change to a file its own allowlist forbids, because
   that contract asks for work it has already made impossible. Record
   `validationPlan.installCommand` from the constants page in the same breath:
   without it `flow-migrate` edits a manifest and then typechecks against
   packages it never installed.
   The mount or embedding mechanism is part of `targetArchitecture`, not a
   detail under it, and it is settled on the project-constants page. It is an
   open question only when that page is missing, and then the missing page is
   the question. Do not reopen a decision that page already records.
   Capture observable visual parity (including layout insets, spacing, input
   containment and a reference screenshot when available). Mark every
   unresolved choice as an open question.
   Check whether the product already has a component-rendering harness, such as
   Storybook or an existing end-to-end runner, and name it in
   `validationPlan.browserValidation` when it does. An existing harness needs no
   owner and no tooling decision, so proposing an unassigned browser runner
   beside one is a gap this skill created rather than found. Verification is
   manual, so record what a person walks through rather than a command to
   automate it.
   A partial Angular mount may replace only inventory items marked `migrate`;
   it must remain inside the existing parent form when siblings are marked
   `retain-react`. Record that shape in the contract as
   `scope.partialMount`: set `nested: true` with the `retainedParent` and the
   `siblingSections` a migrated field must visually match. This field is what
   later makes real-host evidence mandatory for `flow-migrate` and
   `flow-verify`, so an omitted or wrongly `false` value silently weakens both.
   From schemaVersion 4 `scope.partialMount` is required: declaring
   `nested: false` is a deliberate statement, not something to leave out.
   Record every migrated surface in `visualParity` with its `id`, the retained
   `counterpart` it must look like, the concrete `appearance` requirements
   (border, radius, icon and label placement, trailing unit, design tokens
   rather than literal values) and the `layout` requirements (width, alignment
   and spacing against the retained sibling sections). Cite the counterpart
   with file and line in `reference` when one exists. Appearance that is not
   declared here cannot be verified later, so anything a user would notice
   belongs in this list. Every `migrate` inventory id needs a `visualParity`
   entry with the same id, and no other id may appear there; the validator
   enforces both directions.
   Record a reasoned-but-unproven risk as a `characterizationRequired` entry
   with its `id`, its `hypothesis`, the `proveBefore` behavior it blocks and its
   `evidence`, which is an array of citations even when there is one. A hypothesis that took cross-file reasoning to reach is not
   something a later skill re-derives by reading one file, so it belongs in the
   contract rather than in a sentence buried among test gaps.
   Record a resolved conflict between sources as a `decisions` entry with its
   `topic`, `decision`, `rationale` and any `followUp`. An open conflict stays
   an open question instead.
8. When current behavior differs from a plausible improvement, do not choose
   silently. Ask one focused product question with these routes:
   - preserve current behavior for migration;
   - include the improvement in this Story and revise its acceptance criteria;
   - preserve current behavior and propose a separate follow-up Story.
   Keep the contract pending until the answer is recorded.
9. Write `flow-contract.json` in the declared run directory at schemaVersion 6
   and validate it
   with `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<flow-contract.json>"`. Write no analysis report, and no other file in
   the product repository or the notes vault.
   Copy each block's shape from `examples\handoff\` before writing it. Every field
   this skill names in prose has an exact shape there, and the last two runs
   each spent a repair pass discovering one of them from a validator error.
10. The contract is final when you write it. schemaVersion 6 has no `status`,
   no `approval` and no `targetArchitecture.status`, and the validator rejects
   them; there is no draft state and no approval gate to wait for. What bounds
   the next phase is `scope.allowedWritePaths`, so that list carries the weight
   the gate used to: every path in it has been checked for consumers outside
   this flow, and nothing is in it that the slice does not need.
   The allowlist covers three kinds of write, and a contract missing any one of
   them describes work it has forbidden: the directory the new Angular code
   lands in, the test directory the `characterizationRequired` entries need
   (the project constants name where tests live), and every path
   `targetArchitecture.dependencyChanges.paths` names. Check the list against
   all three before writing the contract; the validator enforces the third.
   Before recording `scope.allowedWritePaths`, check each existing file for
   consumers outside this flow. A component that other forms import is shared
   infrastructure, and putting it in the allowlist authorizes changes whose
   blast radius reaches surfaces this contract marks `retain-react`. Either
   leave it out, or record a `decisions` entry saying which consumers were
   considered and why the risk is accepted. Apply this to every path, not only
   to the one control that prompted the question.
   `scope` carries the start state, the end state and that allowlist, and
   nothing else. schemaVersion 6 has no `includedPaths` and no `excludedPaths`,
   and the validator rejects them: three path lists said the same thing, the
   inventory already names every surface with a citation, and no later skill
   ever read the other two.
   Record checkpoint mode as `disabled` unless the user asks for `auto-local`,
   which then needs its expected branch and external reference. The contract
   carries concrete test, typecheck and build commands and a rollback; those are
   what `flow-migrate` runs, so an absent one is a missing input rather than an
   open question. An `openQuestions` entry is something this run could not
   determine: a technical unknown, or a choice that needs information nobody in
   this run holds. A choice this run could have made is not one of them. Decide
   it, or put it to the user at the step that raises it, and record the answer
   as a `decisions` entry; parking it instead spends a `flow-migrate` run on a
   `BLOCKED` report about something no one is waiting on. `flow-migrate` reports
   `BLOCKED` on the entries that remain, so each one has to be worth stopping a
   migration for.
   Write `rollback` as the concrete undo for this slice: which files return to
   which state, and what a revert must not disturb. "Revert the checkpoints
   `migration-result.json` records" is not a rollback plan; it restates how the
   pipeline works to a skill that already knows, and leaves the one question a
   rollback exists to answer unanswered.
11. Write `work-item-baseline.json` after the Flow Contract. Populate the
   Epic, Feature and User Story templates from cited baseline evidence, use
   `create`, `update` or `no-change` honestly, and keep
   `manualApplication.status` at `copy-ready` or `not-applied`. Propose a new
   story only when the user requests it or evidence shows the selected scope
   does not responsibly fit the existing story.
   An item that is not on the board yet uses `create` and carries no external
   ID, and the contract's `workItemContext` omits it on that side too; the
   standup then omits `storyExternalId` as well. Never invent a placeholder such
   as `"0"` to satisfy a required field: a validated artifact that names a
   Targetprocess ID which does not exist is worse than one that says the item is
   still a proposal. Ask for the real ID when the item does exist.
   When a previous validated handoff exists for this `flowId`, copy each
   unchanged `fields` value from it byte for byte and set that item's action to
   `no-change`. Rewriting settled text produces a wording difference that is
   indistinguishable from a real change, which forces `update`, re-emits the
   whole item and asks a reader to re-review something that did not move. Use
   `update` only for an item whose content, proposed state or proposed progress
   actually moved, and say in `evidence` what moved it. Record the earlier
   snapshot in `supersedes` with its path, sha256 and `runId`, and set
   `schemaVersion` 4 when you do; the validator then rejects both a no-op
   `update` and a `no-change` that hides a real change. A first baseline for a
   flow has no predecessor and omits `supersedes`.
   `currentState` and `currentProgress` are never carried forward. They are the
   external board as the user confirmed it for this run.
   Run narrative belongs to the item that actually moved. `richReleaseNotes`
   describes what changed about that item, not what this run did in general, so
   an Epic or Feature whose scope did not change keeps its previous notes and
   stays `no-change`. Rewriting them anyway forces `update` and re-emits the
   whole item, which is the same waste by another route. The Story, its Tasks
   and the standup carry this run's news.
12. Create or update stakeholder-readable User Story Tasks for the behavior
   baseline, bounded implementation and independent manual verification. Assign
   explicit contribution percentages totaling 100 and derive User Story
   progress from Task progress. Link checkpoint milestone IDs to the
   implementation Task; do not create one Task per commit.
   The baseline Task is complete when the contract validates and its scenarios
   and decisions are visible; there is no approval gate left for it to hold
   open. The three Task kinds and
   the requirement that their weights total 100 are fixed by the handoff
   protocol, so propose the weights rather than asking whether to create the
   Tasks at all.
13. Keep confirmed current board values separate from proposed calculated
    values. A copy-ready proposal does not change current progress.
14. Add a daily standup block with completed work, next steps, blockers and
    both current and proposed User Story progress. Keep it short enough to say
    aloud.
15. Validate the Flow Contract and work-item snapshot together, passing the
   superseded baseline handoff as well when this run declares `supersedes`.
   A work-item handoff never validates alone: it needs its primary artifact in
   the same invocation, so pass the Flow Contract with it every time.
   Run
   `node "<migration-skill-lab-root>\scripts\render-work-item-handoff.mjs" --inline "<snapshot.json>"`,
   appending `--since "<previous-handoff.json>"` when a predecessor exists. The
   flag comes before the path; the reverse order makes the script look for a
   file named `--inline`. Show its
   output verbatim in this chat as the handoff for this step. Do not also write
   the full Markdown render: it is derivable from the validated snapshot at any
   time, so writing it during the run only creates a second file to keep in
   step. Do not paraphrase, summarize or reformat it; its value is
   that it is generated from the validated snapshot rather than from prose.
   Items the snapshot marks `no-change` are listed by identity only; do not
   restate their field text in chat to be helpful. Never claim that anything
   was applied.
16. Capture the product Git-visible worktree status again. If it changed, stop,
   report the delta and do not revert or attribute it without evidence.
17. Present one review summary. This block replaces the analysis report, so it
   has one job: let the reader see whether the analysis is right. It is not a
   gate and it authorizes nothing; the contract is already final and the write
   allowlist is what bounds `flow-migrate`. Render it from the validated
   contract, never from remembered prose, and include only what a reader could
   disagree with:
   - the `flowId`, boundary and `scope.partialMount` shape;
   - `renderedSurfaceInventory` as one line per surface with its status, since
     a control classified wrongly is the cheapest error to catch here and the
     most expensive to catch later;
   - `targetArchitecture` boundary and adapter in a few lines;
   - each scenario id with a one-line summary, so the reader sees which
     behaviors are being promised;
   - every `characterizationRequired` hypothesis, because an inference is where
     this analysis is most likely to be wrong;
   - `allowedWritePaths`, because that list is the only thing that bounds the
     next phase's writes, plus the test, typecheck and build commands, the
     manual verification scenarios, rollback and checkpoint policy;
   - every open question and decision.
   Do not restate confirmed behavior or its citations: a reader checks those by
   opening the cited line, and repeating them here only buries the parts that
   need judgment. Do not ask the reader to approve anything. Keep the block
   short enough to read in one screen, and end it by naming what would need a
   new run to change: the boundary, the write allowlist, or a scenario. Wanting
   any of those different is a reason to run the baseline again, not a reply to
   collect here.
   When the host already runs this session in plan mode, that mode forbids
   repository writes until it is exited, so the artifacts are written after it
   is. Their content and validation do not change; only their position in the
   run does. A skill cannot set the session mode: never enter or leave plan mode
   on the user's behalf.
18. Ask which continuation the user wants and perform only the chosen one:
   open a fresh interactive `/flow-migrate` chat now, show the invocation here
   for the user to paste into a chat they open themselves, or save it in the
   run directory for later. All three routes carry the same invocation,
   built from the contract path, the work-item handoff path,
   the migration-skill-lab root, the product root and the run directory; see
   `references/flow-contract.md`.
   A fresh chat is `/new` in this same CLI, followed by the invocation. A skill
   cannot type a slash command on the user's behalf any more than it can enter
   plan mode, so the first route is "run `/new`, then paste this" and not a
   launch that promises what it cannot perform. Do not open a second terminal
   window for it.
   Never continue the migration in this chat and never delegate it to a
   background agent, which cannot ask the user the questions `flow-migrate`
   needs answered.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out files in
  the product repository;
- write tests or product code;
- install dependencies, alter lockfiles, configuration or environment files;
- start persistent services or make external writes;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data in artifacts;
- write an analysis report, a rendered work-item Markdown file or any other
  file besides the contract, the work-item snapshot and the observation
  artifact in the declared run directory;
- edit this skill, its references or any installed skill snapshot during a run;
- present unapproved Angular conventions as target requirements.
- update Targetprocess through a browser, API or other external write;
- create an external work-item ID or mark a handoff `confirmed-applied`
  without the user's confirmation;
- invent Task progress independently of the validated weighted calculation;
- create one board Task per technical commit instead of grouping checkpoints
  under a stakeholder-readable delivery Task;
- silently convert a possible UX improvement into accepted migration behavior;
- create an empty or product checkpoint commit during this read-only phase;
- enter, leave or simulate a host plan mode;
- present the review summary as a gate, or ask the reader to approve anything;
- put a path in `scope.allowedWritePaths` that the chosen slice does not need:
  that list is the only thing bounding the next phase's writes;
- start the migration in this chat, in a background agent, or through any
  route the user did not choose;
- reword settled Epic, Feature, User Story or Task text that no evidence in
  this run shows changed, or restate a `no-change` item's fields in chat;
- carry a previous snapshot's `currentState` or `currentProgress` forward as
  if it were a fresh read of the external board.

## Handoff

The contract must contain the scope, rendered-surface inventory, target
architecture, behavior scenarios, visual parity, required characterization,
evidence pointers, test gaps, decisions, open questions, allowed product write
paths, Epic/Feature/Story context and checkpoint policy.
`work-item-baseline.json` contains the copy/paste hierarchy, Tasks and
daily standup proposal. Both are machine-readable inputs to `flow-migrate`; do
not rely on prior chat context or on a document a later skill cannot read.

Carry decisions, agreements and unproven hypotheses; cite everything else.
A `decisions` entry records a choice that shapes what this contract says: a
boundary, an accepted shared-path risk, a resolved conflict between sources.
`flow-migrate` reads none of it; it is the record that explains the contract to
a later reader, so what does not explain this contract does not belong there.
Why an earlier run was discarded is one of those: that is evidence about a
skill, and it goes in this run's observation sidecar.
Confirmed current behavior lives in the product source, so a scenario names the
behavior and points at the file and line that proves it. Restating the
mechanism in the contract creates a copy that is wrong the moment the source
changes, and `flow-migrate` has to open that source anyway to write the code.

The run ends at one review summary and then exactly one continuation the user
picks: a fresh `/flow-migrate` chat opened now, the invocation shown for
pasting, or the invocation saved in the run directory for later. The summary
authorizes nothing, because the contract it renders is already final. What
bounds the next phase is `scope.allowedWritePaths`; wanting the boundary, that
allowlist or a scenario different is a reason to run the baseline again.

A scenario list alone is not permission to replace a parent component that
renders retained controls; `renderedSurfaceInventory` is what carries that
limit into the migration.

## Reading discipline

Context is a budget this run spends once, and every re-read of the same bytes
is paid again for nothing.

- Read a file once, at the range you need. Return to it only for a range you
  have not read; never re-read it whole after reading part of it, and never
  request a range overlapping one you already hold.
- Widen or narrow a search rather than repeating it. Two patterns that differ
  only in alternation, wording or case return mostly the same hits, so the
  second one buys nothing.
- Do not read `schemas\` or `scripts\` source to learn an artifact's shape.
  Copy the shape from `examples\handoff\`, write the artifact, run
  `validate-handoff.mjs` and act on its errors; the validator names what is
  missing far more cheaply than a schema read does. When an error names a rule
  but not the fix, and one more attempt does not resolve it, reading the rule in
  `scripts\validate-handoff.mjs` is the cheaper route: record it as an
  observation so the message gets improved instead of the next run guessing too.
- Resolve a module path before reading it. A directory may be a barrel or a
  single file, so check which exists instead of guessing and failing.

## Post-run observation capture

During the run, silently retain concrete evidence of user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted, or output mismatches. Do not interrupt or
reprioritize the baseline workflow to analyze these signals.

After the draft Flow Contract and work-item snapshot are complete, or after the
final `BLOCKED` or failed response when those artifacts cannot be produced:

1. Evaluate this run's own tool history against these checks and record every
   one that fired. They are countable, so answer them from the history rather
   than from impression:
   - the same file read more than twice, or re-read over a range already
     held: `unnecessary-context-load`;
   - two or more searches whose patterns differ only in alternation, wording
     or case: `unnecessary-context-load`;
   - a schema, validator or renderer source read instead of running the
     command: `unnecessary-context-load`;
   - a tool call that failed because this skill named a path, command or flag
     that does not exist or does not behave as written:
     `skill-caused-tool-failure`;
   - a step performed by hand that a script in `scripts\` already performs:
     `deterministic-step-candidate`;
   - a user correction, a restated instruction, or the same question asked
     twice: `user-correction` or `ambiguous-instruction`;
   - an artifact that needed a repair pass before it validated:
     `output-mismatch`.
2. Exclude product defects, expected precondition blockers, missing Angular
   conventions themselves, preferences and static speculation. Executor noise
   means a host or transport failure unrelated to this skill; a tool call this
   skill's own wording caused is never executor noise.
3. Deduplicate semantically equivalent signals from this run and preserve their
   occurrence count. Do not cap the number of material observations.
4. Write `<run-artifact-directory>\skill-run-observations-flow-baseline.json`. The
   filename carries the skill because phases of one flow share a run directory,
   and a bare `skill-run-observations.json` means the second skill to finish
   silently overwrites the first one's evidence.
   Copy the shape from `examples\handoff\` rather than writing it from this
   description: an entry needs `id`, `category`, `observation`, `effect`,
   `evidence`, `skillLocations`, `causality` and `occurrenceCount`, and
   `primaryOutcome.status` is `draft`, `failed` or `blocked` for this skill and never `completed`. An empty
   `observations` list is a claim that every check in step 1 was evaluated and
   none fired; write it only when that is true.
5. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations-flow-baseline.json>"`.
6. Report a capture or validation failure separately without changing the
   primary Flow Contract status.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
