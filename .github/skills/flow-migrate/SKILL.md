---
name: flow-migrate
description: Migrate one React-to-Angular flow within the write scope its Flow Contract declares. Requires a high-capability coding model. Use only with /flow-migrate.
---

# Flow Migrate

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the second stage and the only one that writes product code.

Skill version: `0.23.0`.

Recommended model: Claude Sonnet 5.

Implement one bounded Angular migration inside the paths its Flow Contract
allows. That allowlist is the boundary: write no file outside it, and stop
rather than widening it. Invoking `/flow-migrate` with a validated contract is
the user's authorization to write inside that allowlist; an analysis report or
an earlier successful run is not.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

The invocation names `flow-contract.json`, `<lab>`, the product root and the
run directory. Everything else comes from those:

- Validate first:
  `node "<lab>\scripts\validate-handoff.mjs" <flow-contract.json>`.
- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --run-dir <run-dir> --save-status`.
  A saved `<flowId>-flow-migrate-prompt.md` in the run directory means an
  earlier phase chose to continue later: say so in one line and resume from
  the artifacts it names.
- Read `<lab>\docs\project-constants.md`: framework version, packages,
  compilation and mount, change detection, install command, test location and
  coverage. Treat it as decided, never as a convention to invent, and cite any
  convention evidence that neither it nor the contract covers.
- From the contract: `targetArchitecture` (never re-invent a design it states;
  ask only for what it leaves open), `scope.allowedWritePaths`,
  `dependencyChanges` with `validationPlan.installCommand`, the test, typecheck
  and build commands, `rollback`, `checkpointPolicy`, `testGaps` (a command it
  names as unsafe is never run) and `openQuestions`.

Report `BLOCKED` instead of deciding anything here when:

- an input, a validation command or the rollback is absent or ambiguous;
- an `openQuestions` entry prevents implementing this slice. Check every one;
  the baseline is where a question gets resolved;
- a test command does not terminate, since a watch-mode script stalls the run.
  Never edit the contract to fix it;
- `dependencyChanges.required` is true without exact `packages` and `paths`.
  Never choose a version here;
- the product root is not the contract's `repository.root`, or that root is a
  slice worktree (`...-slices\<runId>`) and `product.branch` is not
  `migration/<runId>`. Migrating in the integration checkout mixes this slice
  with every other.

Record a missing convention as a limitation; never present a provisional one
as an established Lely standard.

## Workflow

1. Take the product revision and status from `run-context.mjs` and preserve
   every pre-existing change. Confirm each planned file change is inside
   `allowedWritePaths`. Then check the baseline still describes today's React
   with
   `node "<lab>\scripts\baseline-freshness.mjs" --contract <run-dir>\flow-contract.json --product-root <product> [--run-dir <run-dir>]`.
   On `STALE` someone changed a React source this contract relies on after the
   baseline was measured: stop and report which paths, because building against
   a description of code that no longer exists produces a `PASS` about the wrong
   thing. `INVALID` means the check could not be made at all and is equally a
   stop. Only `FRESH` continues. This runs here, before any Angular is written,
   so a stale contract costs a report rather than a migration.
2. **Compare the inventory with the render tree** before replacing anything.
   Read the cited source for each `renderedSurfaceInventory` surface: the
   inventory says which surfaces this slice owns, the source says how they
   behave today. The comparison covers the presence of every control and
   branch, visual style (icon, label placement, border, radius, color tokens)
   and layout fit (padding, margin and width against the retained siblings) for
   every surface with a comparable retained counterpart, one per declared
   `visualParity` id. A partial mount never returns early from, replaces or
   hides a parent form that still owns `retain-react` controls.
3. **Characterize first**, keeping the existing behavior executable as the
   comparison baseline. Add only the React characterizing tests the scenarios
   need and run them against the React code before changing behavior. Every
   `characterizationRequired` entry is one of them and comes first: replacing
   the behavior it names before settling it migrates a guess. Record each
   outcome as a `characterization` entry: `confirmed` or `disproved` with the
   test that settled it, or `not-run`, which keeps the result from
   `completed`. A disproved hypothesis is a finding, not a failure. Include
   one rendered test
   proving every retained control stays visible across the relevant capability
   branches.
4. **Dependencies.** When `dependencyChanges.required` is true, apply it first
   and exactly: the `packages` at their pinned versions and no file outside
   `paths`. Then run `validationPlan.installCommand` and record it in
   `validation` with its outcome; typechecking against packages that were
   never installed reports a defect that does not exist.
5. **Implement** the smallest Angular change that meets the same scenarios,
   then add Angular tests for the same behavior. A `visualParity`
   `sharedComponents` entry is reused when its counterpart is built and
   otherwise built at its measured target, never re-created inside the slice's
   own folder, where every copy drifts from the others. When the slice is nested in a
   retained React parent, at least one test renders it through that real parent
   tree; an isolated custom-element fixture may remain as a unit test but is
   never the sole basis for a claim about padding, spacing or containment.
6. **Iterate with the targeted test alone.** Run typecheck and build once per
   coherent milestone, not after every edit: they are the largest cost in this
   phase, and a repeat proves nothing the final run does not. These checks gate
   your own work and `flow-verify` reruns them as evidence, so skip none.
   Record what ran and whether it passed, never what a green command proves
   about a scenario. Never run, solicit or record the manual browser flow or
   Maui-WebView smoke: that is `flow-verify`'s evidence, and the validator
   accepts in `validation` only the declared commands plus
   `verify-checkpoint.mjs` invocations.
7. **Visual parity** is its own milestone once the functional slice is green:
   port every declared surface from the templates its `styleSources` cite, as
   the project constants' Styling says, then check it against its `appearance`
   and `layout`. A layout rebuilt from the prose instead lost a floating label.
   Rerun the checks and record it separately, so behavior and appearance carry
   separate evidence.
8. **Checkpoints.** When `checkpointPolicy.mode` is `auto-local`, read
   `references/checkpoints.md` and checkpoint each green milestone as it says.
   When it is `disabled`, commit nothing.
9. **Coverage** only through the safe measurement `testGaps` names; a gap that
   stays unmeasurable is a limitation.
10. **Worktree check.** Run
    `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare --contract <flow-contract.json>`
    and report the final status and its delta. A path under
    `comparison.outsideAllowlist` is a write outside the boundary: report it,
    and the result cannot be `completed`. Fix every `angularConventions`
    finding by the project-constants heading it names and run the check
    again; one that remains keeps the result from `completed`. Never merge, push or
    publish.
11. **Write `migration-result.json`.** Scaffold it with
    `node "<lab>\scripts\new-result.mjs" --artifact migration-result --status <completed|failed|blocked> --skill-version <this skill's version> --run-dir <run-dir> --revision-before <sha> --revision-after <sha> <flow-contract.json>`,
    which fills every field that follows from the contract and leaves a `TODO`
    wherever this run has to say what it found. Replace each one, then run it
    again with `--check <migration-result.json>`: a placeholder left behind is a
    claim nobody made. Validate it together with the contract; it never
    validates alone.
    What is left is judgement, and the scaffold states the outcome it assumed:
    a `characterization` outcome is `disproved` where the test disproved it, and
    a disproved hypothesis is a finding, not a failure. A `surfaces` verdict
    records what you rendered and saw, never `matches`: the visual verdict is
    `flow-verify`'s, and jsdom evidence is disqualified for a nested mount. Use
    `completed`, `failed` or `blocked` honestly.
12. **Continuation.** Build the invocation with
    `node "<lab>\scripts\continuation.mjs" --next flow-verify --lab-root <lab> --product-root <product> --run-dir <run-dir> <flow-contract.json> <migration-result.json>`,
    then offer exactly three routes and perform only the chosen one:
    1. a fresh chat opened now through the host's own mechanism, carrying only
       the invocation. Never start a second terminal window;
    2. the invocation shown here, to paste into a chat the user opens;
    3. the same command with `--save`, a checkpoint rather than an
       abandonment, since every phase reads only artifacts.
    A declined verification is pending verification, not a verified migration.
    Never verify in this chat, spawn a verifier subagent or delegate to a
    background agent.
13. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
    it with `--primary <migration-result.json> --status completed`, `failed` or
    `blocked`.

## Safety boundary

Never:

- widen `scope.allowedWritePaths`, infer permission for a path from a prior
  chat, or change a path outside it;
- add a dependency, change a lockfile or alter build configuration unless the
  exact change is part of `targetArchitecture` and the allowlist. When it is,
  applying it and running `installCommand` is the work, not a boundary to ask
  about;
- create branches, stashes, remotes, pull requests or external writes; commit
  while checkpoint mode is disabled; push, amend, rewrite history, bypass hooks
  or use `git add -A`. The slice's branch exists already, and it lands by
  `slice-worktree.mjs --land` after its PASS;
- alter backend, Maui, Auth0 or other host contracts beyond what
  `targetArchitecture` declares; a changed contract or wider scope returns to
  `flow-baseline`;
- replace a parent React form unless every one of its rendered children is
  marked `migrate`;
- make an unapproved Angular convention a target rule;
- edit this skill, its references or an installed snapshot during a run;
- hide a failed validation or return a success-shaped result after an error;
- update Targetprocess;
- repair failures returned by `flow-verify`, which belong to `flow-debug`, or
  treat browser or Maui-WebView confirmation as verification.

## Reading discipline

Context is spent once; every re-read pays again for nothing.

- Read a file once, at the range you need, and never re-read a range you hold.
- Widen or narrow a search instead of repeating it in other words.
- Learn an artifact's shape from `print-shape.mjs`, never from `schemas\`,
  `scripts\` or a whole example file; write the artifact and act on the
  validator's errors. Read the validator's rule only when an error names no
  fix and one retry fails, and record that as an observation.
- Resolve a module path, barrel or single file, before reading it.
