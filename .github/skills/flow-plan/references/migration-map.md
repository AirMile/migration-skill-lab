# Migration map fields

Read this at step 8 of `flow-plan`. It says what each field carries and when
it goes stale. Copy each field's exact shape from `print-shape.mjs` on
`examples\migration-map\demo\migration-map.json` and let `validate-handoff.mjs`
name anything missing.

## Carry or measure

Carry in the map what is judgement: which slices exist, how they depend on
each other, how they fare against the four criteria, which shared files are
prerequisites and of what kind, and what the user chose. Leave to the metrics
what the script counts: file totals, importers, which files a slice imports,
how many slices share one. A count retyped into the map is stale the moment
the code moves; the metrics are measured again on every run.

## Fields

- `repository` and `metrics`: written by `--measure`, never by hand.
- `supersedes`: written by `--seed`; it chains every map to the one before.
- `features`: one per folder under `src\features` that holds source, with a
  readable `title`. `externalId` is the Targetprocess Feature, only when a
  baseline work-item snapshot or the user supplies it.
- `slices`: one per candidate, each a Story-sized
  baseline-migrate-verify chain.
  - `flowId` is the slice's name for good: `flow-baseline` names its runs and
    artifacts after it, and `--seed` finds a `PASS` by it.
  - `paths` are product-relative, a folder or single files, and bound what the
    measure counts as the slice's own.
  - `dependsOn` names the child slices a parent waits for; `requires` names
    the prerequisites the slice imports.
  - `criteria` hold the four `flow-baseline` criteria. A verdict is the
    planning view; `flow-baseline` decides the boundary and records a
    correction in its contract's `decisions`.
  - `status`: `candidate` until a flow-contract exists, `in-progress` after,
    `landed` only from a `PASS`, with `evidence` pointing at it, and
    `blocked` when a chain ended without one and needs a human decision.
- `prerequisites`: a React file that two or more slices import and no slice
  owns.
  - `kind` is `shared-component` for UI and `adapter` for state, a context or
    a host bridge.
  - `angular` is `none` until a counterpart exists beside `reactSource`, then
    `built` with its `path` and the slice that built it (`builtBy`). The
    validator checks the location against the project constant.
  - `copies` are counterparts built elsewhere, inside one slice, such as the
    first slice's local rebuild. A slice that builds the shared counterpart
    leaves each copy for a later consolidation, so no landed slice changes
    without its own verification.
- `recommendation`: the options this run put to the user, with a reason each,
  and the `chosen` one. `--seed` empties it, because a ranking describes the
  map it was made from.
- `decisions`: a choice that shapes the map, such as why a boundary was cut
  where it was or why a copy is left for later.
- `openQuestions`: only what this run could not settle.
