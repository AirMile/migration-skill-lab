---
name: migrate-flow
description: Migrate one explicitly approved React-to-Angular flow within a declared product write scope, using a versioned Flow Contract. Use only with /migrate-flow.
---

# Migrate Flow

Skill version: `0.7.0`.

Implement one bounded Angular migration only after a human has approved the
Flow Contract, available convention evidence, allowed paths, validation
commands and rollback. Write no code outside that agreement.

## Required inputs

Confirm all inputs before any product write:

- path to a valid `flow-contract.json`;
- explicit human implementation approval for its `flowId`;
- contract `status: approved` and `approval.status: approved`;
- migration-skill-lab root containing the validator and schemas;
- product root and declared branch/worktree;
- available Angular convention evidence and explicit POC design choices;
- exact allowed product write paths, matching the contract;
- exact approved dependency, lockfile, TypeScript and Vite changes required by
  the bounded target architecture, or explicit evidence that none are needed;
- test, typecheck and build commands;
- rollback instructions;
- declared run-artifact directory.
- path to the corresponding `work-item-baseline.json`;
- the actual manual-application outcome of the previous Targetprocess proposal;
- approved checkpoint policy, expected branch and external reference from the
  Flow Contract.

Run `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
"<flow-contract.json>" "<work-item-baseline.json>"` before using the
artifacts. Stop and report `BLOCKED`
when an input, approval, validation command or rollback plan is absent or
ambiguous. Record missing convention approval as a limitation; do not present a
provisional convention as an approved Lely standard.

## Workflow

1. Read `references/migration-execution-contract.md`.
2. Record the product revision and Git-visible worktree status. Preserve all
   pre-existing changes.
3. Confirm each requested file change is inside `allowedWritePaths`.
4. Compare the approved rendered-surface inventory with the current React
   render tree before replacing anything. A partial Angular mount must not
   return early from, replace or hide a parent form that still owns
   `retain-react` controls. The comparison covers visual style (icon, label
   placement, border, radius, color tokens) and layout fit (padding, margin
   and width parity with retained sibling sections) for any migrated field
   with a directly comparable retained React counterpart, not only whether a
   control or branch is present.
5. Add or update only the React characterizing tests required by the approved
   scenarios. Run them against the existing React implementation before
   changing the selected behavior.
   Include one rendered test that proves every retained control remains visible
   across the relevant conditional capability branches.
6. Implement the smallest Angular change that meets the same scenarios.
7. Add Angular tests for the same behavior and run the declared targeted test,
   typecheck and build commands.
   Do not execute, solicit or record the contract's manual browser flow or
   Maui-WebView smoke as migration verification; `verify-flow` owns that
   independent evidence.
   When the migrated slice is a partial Angular mount nested inside a
   retained React parent, at least one authored or updated automated UI test
   must render it through that real parent component tree, not only as a
   standalone element attached directly to the document; an isolated
   custom-element fixture may remain as an additional unit-level test but
   must not be the sole basis for a claim about drawer padding, spacing or
   input containment.
8. After each coherent product milestone whose relevant checks pass, create a
   checkpoint manifest and run `verify-checkpoint.mjs --prepare`. Continue
   only when it confirms the branch, HEAD, operation state, path denylist,
   `allowedWritePaths`, clean baseline ownership and validations.
9. When checkpoint mode is `auto-local`, stage only the verifier's explicit
   paths, then run `verify-checkpoint.mjs --verify-staged` to prove the staged
   path set and diff match the expected scoped delta. Create the local commit
   with its deterministic repository-style subject and run
   `verify-checkpoint.mjs --verify-commit` against the new SHA. Do not ask
   again: Flow Contract approval is the batch authorization. Do not bypass
   hooks, amend or create an empty commit.
10. Record coverage only through a command and output location explicitly
   approved for this run. Remove only generated artifacts that the approval
   identifies.
11. Write `migration-result.json` in the declared run directory, including
    every committed, skipped or blocked checkpoint. When the contract sets
   `scope.partialMount.nested`, record the step 4 comparison in
   `renderedSurfaceComparison`: the `evidenceSource` you actually used, the
   retained sibling sections you compared against, and the concrete style and
   layout observations. Only `real-parent-tree` is accepted for a completed
   nested migration; an isolated fixture is not sufficient. It must
   validate with the handoff validator together with the Flow Contract.
12. Write and validate `work-item-migration.json`, pointing to the exact
    migration result and previous work-item handoff hashes. Render the
    copy/paste Markdown with factual progress and no unverified completion,
    then run `render-work-item-handoff.mjs --inline <snapshot> --since
    <work-item-baseline.json>` and show its output verbatim in this chat as the
    handoff for this step. Do not paraphrase or reformat it.
    Record the user's applied/not-applied confirmation for the baseline in
    `previousApplication`, including the external IDs Targetprocess assigned to
    any created item in `createdExternalIds`; never modify the baseline
    snapshot.
13. Update the implementation Task with the validated checkpoint milestones
   and actual completed work. Recalculate User Story progress from all Task
   contributions; never equate commit count with progress.
14. Add a concise daily standup block with completed work, next verification
   step, blockers and the same calculated User Story progress.
15. Record the final worktree status. Do not merge, push, publish or update the
   skill.
16. End with one focused user question offering a fresh `/verify-flow` chat
   with only the declared artifact paths and product root. Do not spawn a
   verifier subagent or perform verification in this chat.

## Safety boundary

Never:

- infer approval from a prior chat or a draft contract;
- change a path outside the contract allowlist;
- add a dependency, change a lockfile or alter build/configuration unless the
  exact files and changes are part of the approved target architecture,
  allowlist and rollback;
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
- repair failures returned by `verify-flow`; those belong to `debug-flow`.
- treat browser-flow or Maui-WebView confirmation as independent verification;
  preserve those scenarios for the fresh `verify-flow` chat.
- replace a parent React form unless every one of its rendered children is
  explicitly marked `migrate` in the approved rendered-surface inventory.

## Handoff

`migration-result.json` must include the contract content hash, changed paths,
validation outcomes, checkpoint evidence, coverage status, rollback
instructions and limitations. `work-item-migration.json` contains the
copy/paste Epic/Feature/Story/Task and standup progress update. Use
`completed`, `failed` or `blocked` honestly. `verify-flow` consumes both
artifacts and must not rely on earlier chat context.

After writing the handoff, ask the user whether to open the fresh
`/verify-flow` chat. A declined handoff is recorded as pending verification,
not as a verified migration.

## Post-run observation capture

During the run, silently retain concrete evidence of user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted, or output mismatches. Do not interrupt or
reprioritize the migration workflow to analyze these signals.

After `migration-result.json` is complete, or after the final `BLOCKED` or
failed response when that artifact cannot be produced:

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
   primary migration result.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
