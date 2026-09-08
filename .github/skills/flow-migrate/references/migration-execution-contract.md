# Migration execution contract

Read this reference for every `flow-migrate` run.

## Preconditions

The migration may start only when:

- `flow-contract.json` validates and is human-approved;
- all product paths to change are explicitly listed in
  `scope.allowedWritePaths`;
- the user explicitly authorizes product writes for this run;
- available Angular convention evidence and POC design choices are cited;
- unresolved conventions are recorded as limitations and are not presented as
  approved Lely standards;
- every required dependency, lockfile, TypeScript and Vite change is explicit
  in the approved target architecture and `allowedWritePaths`;
- validation commands and rollback instructions are concrete.
- the baseline work-item handoff validates and its manual application outcome
  is stated without assuming that copy-ready content was applied;
- checkpoint mode, expected branch, external reference and push policy match
  the approved Flow Contract.

An analysis report or a previous successful run is not implementation
approval. Stop with `BLOCKED` if any precondition is missing.

## Required implementation order

1. Keep the existing behavior executable as the comparison baseline.
2. Add only the missing React characterizing tests that prove approved
   scenarios.
3. Run those tests before the Angular implementation.
4. Compare the rendered-surface inventory with the React tree; preserve every
   retained child and conditional branch when mounting a partial Angular slice.
   The inventory comparison covers visual style (icon, label placement,
   border, radius, color tokens) and layout fit (padding, margin and width
   parity with retained sibling sections) for any migrated field or slice
   with a directly comparable retained React counterpart, not only whether a
   control or branch is present. Compare against the contract's declared
   `visualParity` requirements and return one verdict per surface.
5. Implement the smallest bounded Angular slice.
6. Add Angular tests for those same scenarios.
7. Bring every declared visual parity surface onto its `appearance` and
   `layout` requirements as a separate coherent milestone, once the functional
   slice is green. Behavior and appearance then carry separate evidence and
   separate checkpoints inside one flow.
8. Run targeted tests, typecheck and build.
   Leave manual browser-flow and Maui-WebView verification to `flow-verify`.
   When the migrated slice is a partial Angular mount nested inside a
   retained React parent, at least one authored or updated automated UI test
   must render it through that real parent component tree, not only as a
   standalone element attached directly to the document; an isolated
   custom-element fixture may remain as an additional unit-level test but
   must not be the sole basis for a claim about drawer padding, spacing or
   input containment.
9. Run the checkpoint preflight for every coherent green milestone and, when
   `auto-local` is approved, commit only the exact allowlisted scoped delta.
10. Create a compact `migration-result.json` and Epic/Feature/Story/Task
   progress handoff with a daily standup block, without source copies.

## Result constraints

The result must validate against
`schemas/migration-result.schema.json`. `changedPaths` must be a subset of
the approved write allowlist. When the contract sets
`scope.partialMount.nested`, the result must carry
`renderedSurfaceComparison` with `evidenceSource: "real-parent-tree"`, the
retained sibling sections compared against, and the concrete style and layout
observations from step 4. The validator rejects a completed nested migration
without it, so the step-4 comparison can no longer be silently skipped.

Whenever the contract declares `visualParity`, `renderedSurfaceComparison`
must also carry one `surfaces` entry per declared id, each with its verdict
and observations. A `completed` result cannot skip a declared surface or leave
one on `deviates` or `not-checked`; those verdicts are honest outcomes that
belong in a `blocked` result or in a further milestone, not in a completed
one.

A failed or blocked validation command must be
reported with that status and diagnosis; it cannot be recorded as completed.
Manual browser and host outcomes are verification evidence and must not appear
as migration-pass evidence.

`validation` is therefore a closed list: the contract's declared test,
typecheck and build commands plus `verify-checkpoint.mjs` invocations, and
nothing else. The validator rejects any other entry, including free-text ones
like `Manual browser flow` or `Manual Maui-WebView smoke`. The boundary is
that `flow-migrate` runs checks as a gate on its own work — may I checkpoint,
may I call this `completed` — while `flow-verify` owns evidence and the
verdict. Keep each `summary` to what ran and whether it passed; a summary that
says what a green command proves about a contract scenario is a verification
claim made in the wrong artifact.

## Checkpoint constraints

Use `scripts/verify-checkpoint.mjs --prepare <manifest.json>` before staging.
Freeze HEAD, branch and Git-visible status before product writes. Never use
`git add -A`; stage only the returned paths and compare the staged path set
with the manifest by running `verify-checkpoint.mjs --verify-staged` before
committing. After commit, run `verify-checkpoint.mjs --verify-commit` with the
same manifest and new SHA. Record its changed paths, subject and diff hash.

The preflight blocks active Git operations, denylisted credential paths,
outside-allowlist paths, failed required validation, unexpected concurrent
changes and pre-existing dirty candidate files whose new delta is not proven.
Do not bypass a block. Flow Contract approval for `auto-local` authorizes all
listed green milestones without a per-commit prompt. Hook failure stops the
checkpoint; never use `--no-verify` or amend.

Detect the message convention from repository history and use the approved
external reference. Record commit SHA, subject, paths and validation summary.
Attach checkpoint milestones to the stakeholder-readable implementation Task;
do not create one Task per commit or calculate progress from commit count. Do
not create empty commits. `flow-migrate` never pushes.

Failures returned by independent verification are not a new normal migration
attempt. `flow-verify` writes a debug handoff and a fresh `flow-debug` agent
owns bounded repair. A changed contract or expanded scope returns to
`flow-baseline`.

## Dependency and host boundaries

Dependency, lockfile and build-configuration changes are permitted only when
the bounded target architecture approves the exact change, path, validation
and rollback. Put them in a separate coherent checkpoint. Missing approval is
a blocker; it is not permission to expand the slice.

Backend, Maui and Auth0 contract changes remain outside the Detail Drawer POC
unless a renewed Flow Contract explicitly changes that boundary.
