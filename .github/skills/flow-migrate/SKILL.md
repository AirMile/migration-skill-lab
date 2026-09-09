---
name: flow-migrate
description: Migrate one React-to-Angular flow within the write scope its Flow Contract declares. Use only with /flow-migrate.
---

# Flow Migrate

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the second stage and the only one that writes product code.

Skill version: `0.11.0`.

Recommended model: Claude Sonnet 5, or Opus 5 when the slice touches
drawlib, history or the host boundary.

Implement one bounded Angular migration inside the paths its Flow Contract
allows. That allowlist is the boundary: write no file outside it, and stop
rather than widening it.

## Required inputs

Confirm all inputs before any product write:

- path to a valid `flow-contract.json`;
- a validating `flow-contract.json` for the `flowId` you were asked to migrate;
- migration-skill-lab root containing the validator and schemas;
- product root and declared branch/worktree;
- the contract's `targetArchitecture`, which carries the boundary,
  typed adapter, lifecycle and styling rules; ask the user only for what the
  contract leaves open, and never re-invent a design it already states;
- the contract's `openQuestions`. Each one names something the baseline could
  not settle. Check every one against the slice you are about to write, and
  report `BLOCKED` on any that prevents implementing instead of deciding it
  here; the baseline is where a resolved question gets recorded;
- the contract's `testGaps`. They say which evidence does not exist yet and how
  to measure safely. A command named there as unsafe for the product worktree
  is one not to run, and a gap that stays unmeasurable is a limitation to
  record rather than to leave silent;
- `<migration-skill-lab-root>\docs\project-constants.md`. It carries the
  project's settled decisions: framework version and why, the exact packages,
  how the framework is compiled and mounted, the change-detection strategy, the
  install command, where tests live and how coverage is measured. Read it, and
  treat anything on it as decided rather than as a convention to invent;
- any convention evidence neither the contract nor that page covers;
- exact allowed product write paths, matching the contract;
- `targetArchitecture.dependencyChanges`. When `required` is true it names the
  exact `packages` and the `paths` they change, and `validationPlan` carries the
  `installCommand` that applies them. A general note about needing the framework
  is not that: report `BLOCKED` rather than choosing versions here;
- test, typecheck and build commands. Check that each one terminates before
  relying on it; a watch-mode script recorded as a test command stalls this
  run indefinitely. Report `BLOCKED` rather than editing the contract to fix
  it;
- rollback instructions;
- declared run-artifact directory.
- path to the corresponding `work-item-baseline.json`;
- the actual manual-application outcome of the previous Targetprocess proposal;
- the checkpoint policy, expected branch and external reference from the
  Flow Contract.

Run `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
"<flow-contract.json>" "<work-item-baseline.json>"` before using the
artifacts. Stop and report `BLOCKED`
when an input, validation command or rollback plan is absent or ambiguous, or
when an open question in the contract prevents implementing. Record a missing
convention as a limitation; do not present a provisional convention as an
established Lely standard.

## Workflow

1. Read `references/migration-execution-contract.md`.
2. Record the product revision and Git-visible worktree status. Preserve all
   pre-existing changes.
3. Confirm each requested file change is inside `allowedWritePaths`.
4. Compare the contract's `renderedSurfaceInventory` with the current React
   render tree before replacing anything. Read the cited source for each
   surface rather than trusting a remembered description: the inventory says
   which surfaces this slice owns, the source says how they behave today.
   A partial Angular mount must not return early from, replace or hide a
   parent form that still owns
   `retain-react` controls. The comparison covers visual style (icon, label
   placement, border, radius, color tokens) and layout fit (padding, margin
   and width parity with retained sibling sections) for any migrated field
   with a directly comparable retained React counterpart, not only whether a
   control or branch is present. Walk the contract's `visualParity` list and
   produce one verdict per declared surface; `deviates` and `not-checked` are
   honest outcomes that block a `completed` result, so resolve them rather
   than restate them.
5. Add or update only the React characterizing tests required by the approved
   scenarios. Run them against the existing React implementation before
   changing the selected behavior.
   Every `characterizationRequired` entry is one of those tests and it comes
   first: it records a hypothesis the baseline could not prove, so replacing
   the behavior it names before settling it means migrating a guess. Record the
   outcome, including a hypothesis the test disproves.
   Include one rendered test that proves every retained control remains visible
   across the relevant conditional capability branches.
6. Implement the smallest Angular change that meets the same scenarios.
   When `targetArchitecture.dependencyChanges.required` is true, apply that
   change first and exactly as the contract states it: the packages in
   `packages` at their pinned versions, and no file outside `paths`. The
   contract carries an exact set because a version chosen here is an
   unapproved convention.
7. Run `validationPlan.installCommand` after any manifest or configuration
   change, before the checks below. A slice that adds packages and then
   typechecks without installing them fails on missing modules and reports a
   defect that does not exist. Record the install like any other command, with
   what ran and whether it passed; the validator permits it in `validation`
   when the contract declares it, and requires nothing when it does not.
   Then add Angular tests for the same behavior and run the declared targeted
   test, typecheck and build commands.
   Do not execute, solicit or record the contract's manual browser flow or
   Maui-WebView smoke as migration verification; `flow-verify` owns that
   independent evidence. The validator enforces this: `migration-result`
   `validation` may contain only the contract's declared test, typecheck and
   build commands plus `verify-checkpoint.mjs` invocations. A free-text entry
   such as `Manual browser flow` is rejected, so do not ask the user to
   confirm host behavior in order to record it here.
   These checks are a gate on your own work, not evidence of correctness.
   Record what ran and whether it passed; do not describe what a green
   command proves about a contract scenario. An automated test that mounts an
   isolated fixture is not evidence about drawer padding, spacing or input
   containment, and a summary must not imply otherwise.
   When the migrated slice is a partial Angular mount nested inside a
   retained React parent, at least one authored or updated automated UI test
   must render it through that real parent component tree, not only as a
   standalone element attached directly to the document; an isolated
   custom-element fixture may remain as an additional unit-level test but
   must not be the sole basis for a claim about drawer padding, spacing or
   input containment.
8. Treat visual parity as its own coherent milestone once the functional
   slice is green: bring every declared surface onto its `appearance` and
   `layout` requirements, rerun the declared checks, and checkpoint that as a
   separate scoped delta. Behavior and appearance then carry separate evidence
   and separate commits inside one flow, instead of appearance riding along
   unrecorded.
9. After each coherent product milestone whose relevant checks pass, create a
   checkpoint manifest and run `verify-checkpoint.mjs --prepare`. Continue
   only when it confirms the branch, HEAD, operation state, path denylist,
   `allowedWritePaths`, clean baseline ownership and validations.
10. When checkpoint mode is `auto-local`, stage only the verifier's explicit
   paths, then run `verify-checkpoint.mjs --verify-staged` to prove the staged
   path set and diff match the expected scoped delta. Create the local commit
   with its deterministic repository-style subject and run
   `verify-checkpoint.mjs --verify-commit` against the new SHA. Do not ask
   again: the contract's checkpoint policy is the authorization. Do not bypass
   hooks, amend or create an empty commit.
11. Record coverage only through a command and output location explicitly
   approved for this run. Remove only generated artifacts that the approval
   identifies. Use the safe measurement the contract's `testGaps` names; the
   baseline already established which script would dirty the product worktree.
12. Write `migration-result.json` in the declared run directory, including
    it in the same validator invocation as the Flow Contract every time: a
    `migration-result` never validates alone, and neither does a work-item
    handoff without its primary artifact. Include
    every committed, skipped or blocked checkpoint. When the contract sets
   `scope.partialMount.nested`, record the step 4 comparison in
   `renderedSurfaceComparison`: the `evidenceSource` you actually used, the
   retained sibling sections you compared against, and the concrete style and
   layout observations. Only `real-parent-tree` is accepted for a completed
   nested migration; an isolated fixture is not sufficient. Record one
   `surfaces` entry per declared `visualParity` id with its verdict and
   observations; the validator refuses a `completed` result that skips a
   declared surface or leaves one on `deviates` or `not-checked`. It must
   validate with the handoff validator together with the Flow Contract.
13. Write and validate `work-item-migration.json`, pointing to the exact
    migration result and previous work-item handoff hashes. Render the
    copy/paste Markdown with factual progress and no unverified completion,
    then run `render-work-item-handoff.mjs --inline <snapshot> --since
    <work-item-baseline.json>` and show its output verbatim in this chat as the
    handoff for this step. Do not paraphrase or reformat it.
    Record the user's applied/not-applied confirmation for the baseline in
    `previousApplication`, including the external IDs Targetprocess assigned to
    any created item in `createdExternalIds`; never modify the baseline
    snapshot.
    `no-change` and `update` both require the item's `externalId`, so an item
    that is not on the board yet cannot use either. When
    `previousApplication.status` is `not-applied`, every item the baseline
    proposed to `create` stays `create` here, whatever this phase learned about
    it; only a confirmed application, with the external IDs it assigned, moves
    an item off `create`.
    Copy each unchanged `fields` value from the baseline handoff byte for byte
    and mark that item `no-change`. Rewording settled text forces `update`,
    re-emits the whole item and asks a reader to re-review something this phase
    did not touch; the validator rejects both a no-op `update` and a
    `no-change` that hides a real change. Implementation normally moves the
    Story and its implementation Task, not the Epic or Feature.
    `richReleaseNotes` describes what changed about its own item, not what this
    run did in general, so do not refresh it on an item this phase left alone.
14. Update the implementation Task with the validated checkpoint milestones
   and actual completed work. Recalculate User Story progress from all Task
   contributions; never equate commit count with progress.
15. Add a concise daily standup block with completed work, next verification
   step, blockers and the same calculated User Story progress.
16. Record the final worktree status. Do not merge, push, publish or update the
   skill.
17. End with one focused user question offering a fresh `/flow-verify` chat
   with only the declared artifact paths and product root. Do not spawn a
   verifier subagent or perform verification in this chat.

## Safety boundary

Never:

- widen `scope.allowedWritePaths`, or infer permission for a path from a prior
  chat;
- change a path outside the contract allowlist;
- add a dependency, change a lockfile or alter build/configuration unless the
  exact files and changes are part of the target architecture, allowlist and
  rollback. When they are, applying them and running the contract's
  `installCommand` is the work, not a boundary to ask about;
- create branches, stashes, remotes, pull requests or external writes;
- commit when checkpoint mode is disabled, validation is not green, the
  branch differs, a candidate path is denylisted/outside the allowlist, or a
  pre-existing dirty change cannot be isolated exactly;
- use `git add -A`, bypass hooks, amend, rewrite history or push;
- alter backend, Maui, Auth0 or other host contracts outside the approved
  scope;
- make an unapproved Angular convention a target rule;
- edit this skill, its references or an installed snapshot during a run;
- hide failed validation or return a success-shaped result after an error.
- update Targetprocess or claim a copy-ready proposal was applied without
  explicit confirmation.
- create one Task per checkpoint commit or report progress that is not derived
  from the Task contribution model.
- repair failures returned by `flow-verify`; those belong to `flow-debug`.
- treat browser-flow or Maui-WebView confirmation as independent verification;
  preserve those scenarios for the fresh `flow-verify` chat.
- replace a parent React form unless every one of its rendered children is
  explicitly marked `migrate` in the approved rendered-surface inventory.

## Handoff

`migration-result.json` must include the contract content hash, changed paths,
validation outcomes, checkpoint evidence, coverage status, rollback
instructions and limitations. `work-item-migration.json` contains the
copy/paste Epic/Feature/Story/Task and standup progress update. Use
`completed`, `failed` or `blocked` honestly. `flow-verify` consumes both
artifacts and must not rely on earlier chat context.

After writing the handoff, ask the user whether to open the fresh
`/flow-verify` chat. A declined handoff is recorded as pending verification,
not as a verified migration.

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
reprioritize the migration workflow to analyze these signals.

After `migration-result.json` is complete, or after the final `BLOCKED` or
failed response when that artifact cannot be produced:

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
4. Write `<run-artifact-directory>\skill-run-observations-flow-migrate.json`. The
   filename carries the skill because phases of one flow share a run directory,
   and a bare `skill-run-observations.json` means the second skill to finish
   silently overwrites the first one's evidence.
   Copy the shape from `examples\handoff\` rather than writing it from this
   description: an entry needs `id`, `category`, `observation`, `effect`,
   `evidence`, `skillLocations`, `causality` and `occurrenceCount`, and
   `primaryOutcome.status` is `completed`, `failed` or `blocked` for this skill. An empty
   `observations` list is a claim that every check in step 1 was evaluated and
   none fired; write it only when that is true.
5. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations-flow-migrate.json>"`.
6. Report a capture or validation failure separately without changing the
   primary migration result.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
