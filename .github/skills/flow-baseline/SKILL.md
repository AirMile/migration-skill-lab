---
name: flow-baseline
description: Establish a reviewable behavior and test-evidence baseline for one human-selected React-to-Angular migration flow. Use only with /flow-baseline.
---

# Flow Baseline

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the first stage: it produces the contract every later stage reads.

Skill version: `0.9.0`.

Recommended model: Claude Opus 5. This phase writes the contract that every
later phase depends on.

Analyze one explicitly selected flow or component boundary. Produce a draft
`flow-contract.json` carrying the behavior baseline, the surface inventory and
a bounded target-architecture proposal, plus a short review summary in this
chat. Do not implement Angular code or present the proposal as an approved
team standard.

The contract is the only durable analysis artifact. Do not write a separate
prose report: everything a later skill needs belongs in the contract, and a
second copy in Markdown drifts out of date the moment either side is edited.

## Required inputs

Confirm before deep analysis:

- one human-selected `flowId` and user-visible goal;
- migration-skill-lab root containing the validator and schemas;
- product repository root;
- included boundary, exclusions, start state and end state;
- declared run-artifact directory;
- whether existing coverage evidence is available or a measurement command is
  explicitly approved.
- the most recent validated work-item handoff for this `flowId`, when one
  exists; it supplies the Epic, Feature and User Story identity, parent
  relations and field text, so ask for those only when no such snapshot exists;
- whether a new Epic, Feature or User Story is requested;
- current User Story Tasks, or approval to propose stakeholder-readable Tasks
  for baseline, implementation and independent verification;
- declared work-item handoff JSON destination;
- checkpoint mode, expected product branch, external work-item reference and
  push policy that a human may approve for the later migration.
- proposed targeted test, typecheck and build commands, required manual host
  scenario and rollback; leave unresolved draft fields absent rather than
  inventing them.
- current external board state/progress separately from any proposed
  Task-derived state/progress.

Ask one focused question and stop if the scope or the run directory is
materially ambiguous. Never choose the flow automatically.

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
4. Label material conclusions `Confirmed`, `Inference` or `Open question`.
   Cite every confirmed repository claim with file and line.
5. Inventory existing relevant tests and map them to behavior. Use existing
   coverage artifacts when available. Do not generate coverage output inside
   the product repository. If approved measurement is unavailable, state the
   coverage gap and required safe measurement instead of guessing.
6. Record a focused target-architecture proposal for only the selected flow in
   the contract as `targetArchitecture`: `boundary.angularOwns` and
   `boundary.reactRetains`, the typed `adapter` with its `inputs`, `commands`,
   `events`, `nonSuccessOutcome` and `forbiddenAccess`, the `lifecycle` rules
   for mount, unmount and cancellation, the `styling` rules, and
   `dependencyChanges`. Preserve current boundaries where they are sound; do
   not mirror React mechanically or redesign the whole app.
   This is the one part of the analysis that is not recoverable from the
   product source, because the Angular side does not exist yet. Left out of the
   contract it is simply lost, and `flow-migrate` asks a human to invent it a
   second time. Keep `targetArchitecture.status` at `proposed` until a human
   approves the contract.
   Capture observable visual parity (including layout insets, spacing, input
   containment and a reference screenshot when available). Mark every
   unapproved choice as proposed or open.
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
   with its `hypothesis`, the `proveBefore` behavior it blocks and its
   `evidence`. A hypothesis that took cross-file reasoning to reach is not
   something a later skill re-derives by reading one file, so it belongs in the
   contract rather than in a sentence buried among test gaps.
   Record a resolved conflict between sources as a `decisions` entry with its
   `topic`, `decision`, `rationale` and any `followUp`. An open conflict stays
   an open question instead.
7. When current behavior differs from a plausible improvement, do not choose
   silently. Ask one focused product question with these routes:
   - preserve current behavior for migration;
   - include the improvement in this Story and revise its acceptance criteria;
   - preserve current behavior and propose a separate follow-up Story.
   Keep the contract pending until the answer is recorded.
8. Write the draft `flow-contract.json` in the declared run directory at
   schemaVersion 5 and validate it
   with `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<flow-contract.json>"`. Write no analysis report, and no other file in
   the product repository or the notes vault.
9. Set contract `status` and `approval.status` to `draft` and `pending`.
   Only a human may approve the scope and write allowlist for `flow-migrate`.
   Record checkpoint mode as `disabled` until the human explicitly approves
   `auto-local`, its expected branch, external reference and push policy.
   An approved contract requires concrete test, typecheck, build, manual-host
   and rollback values; a draft records missing values as open questions.
   The draft contract and work-item baseline are immutable historical
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
14. Validate the Flow Contract and work-item snapshot together, passing the
   superseded baseline handoff as well when this run declares `supersedes`.
   Run `render-work-item-handoff.mjs --inline`, adding
   `--since <previous-handoff.json>` when a predecessor exists, and show its
   output verbatim in this chat as the handoff for this step. Do not also write
   the full Markdown render: it is derivable from the validated snapshot at any
   time, so writing it during the run only creates a second file to keep in
   step. Do not paraphrase, summarize or reformat it; its value is
   that it is generated from the validated snapshot rather than from prose.
   Items the snapshot marks `no-change` are listed by identity only; do not
   restate their field text in chat to be helpful. Never claim that anything
   was applied.
15. Capture the product Git-visible worktree status again. If it changed, stop,
   report the delta and do not revert or attribute it without evidence.
16. Present one approval checkpoint. This block replaces the analysis report,
   so it has one job: let the reader judge whether the analysis is right before
   anything is built on it. Render it from the validated contract, never from
   remembered prose, and include only what a reader could disagree with:
   - the `flowId`, boundary and `scope.partialMount` shape;
   - `renderedSurfaceInventory` as one line per surface with its status, since
     a control classified wrongly is the cheapest error to catch here and the
     most expensive to catch later;
   - `targetArchitecture` boundary and adapter in a few lines, marked proposed;
   - each scenario id with a one-line summary, so the reader sees which
     behaviors are being promised;
   - every `characterizationRequired` hypothesis, because an inference is where
     this analysis is most likely to be wrong;
   - `allowedWritePaths`, the test, typecheck and build commands, the browser
     and manual host scenarios, rollback and checkpoint policy;
   - every open question and decision.
   Do not restate confirmed behavior or its citations: a reader checks those by
   opening the cited line, and repeating them here only buries the parts that
   need judgment. Say what approval authorizes and keep the block short enough
   to read in one screen. Offer exactly three replies: approve the contract as
   rendered, reject it, or ask a question first. Do not offer approval while an
   open question that blocks writing is unresolved.
   When the host already runs this session in plan mode, request the same
   decision through its plan-approval mechanism and read approval, feedback and
   exit-without-acting as those same three replies. That mode forbids
   repository writes before approval, so run steps 8 to 14 after the approval
   instead of before it; the artifacts themselves do not change. A skill cannot
   set the session mode: never enter or leave plan mode on the user's behalf
   and never describe a checkpoint answer as a plan-mode approval it was not.
17. On approval, write the approved contract and its matching baseline
   work-item handoff as new artifacts beside the draft, with `status` and
   `approval.status` `approved`, the approver role, the approval date and the
   decisions the user actually stated in `approvedDecisions`. Leave the draft
   pair and its pending or open wording untouched. Validate the successor pair
   with `validate-handoff.mjs` before offering any continuation. A rejection,
   an unresolved blocking question or no answer ends the run with the draft as
   the only contract.
18. Ask which continuation the user wants and perform only the chosen one:
   open a fresh interactive `/flow-migrate` chat now, show the invocation here
   for the user to paste into a chat they open themselves, or save it in the
   run directory for later. All three routes carry the same invocation,
   built from the approved contract path, the approved work-item handoff path,
   the migration-skill-lab root, the product root and the run directory; see
   `references/flow-contract.md`. Launch a chat only on that explicit choice,
   and report a refused or failed launch instead of describing the migration as
   started. Never continue the migration in this chat and never delegate it to
   a background agent, which cannot ask the user for the approvals
   `flow-migrate` requires.

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
- enter, leave or simulate a host plan mode, or record a plan-mode approval
  the user did not give;
- write an approved contract from anything other than the user's explicit
  answer at the checkpoint;
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
paths, Epic/Feature/Story context, checkpoint policy and a human approval
record. `work-item-baseline.json` contains the copy/paste hierarchy, Tasks and
daily standup proposal. Both are machine-readable inputs to `flow-migrate`; do
not rely on prior chat context or on a document a later skill cannot read.

Carry decisions, agreements and unproven hypotheses; cite everything else.
Confirmed current behavior lives in the product source, so a scenario names the
behavior and points at the file and line that proves it. Restating the
mechanism in the contract creates a copy that is wrong the moment the source
changes, and `flow-migrate` has to open that source anyway to write the code.

The run ends at one approval checkpoint rather than a summary. Rejection, a
remaining blocking open question or no answer leaves the draft contract as the
only artifact. Approval produces the approved successor pair and then exactly
one continuation the user picks: a fresh `/flow-migrate` chat opened now, the
invocation shown for pasting, or the invocation saved in the run directory for
later.

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
  missing far more cheaply than a schema read does.
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
4. Write `<run-artifact-directory>\skill-run-observations.json`. An empty
   `observations` list is a claim that every check in step 1 was evaluated and
   none fired; write it only when that is true.
5. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations.json>"`.
6. Report a capture or validation failure separately without changing the
   primary Flow Contract status.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
