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
how many slices share one, and where each file's Angular counterpart goes. A
count retyped into the map is stale the moment the code moves; the metrics are
measured again on every run.

## Fields

- `schemaVersion`: written by `--init` and `--seed`, always the newest; a map
  written under an older version stays valid at it.
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
    exactly the prerequisites the measure finds the slice importing, its
    `impliedRequires` in the metrics. From schemaVersion 2 the validator
    rejects a `requires` that differs, because the recommendation ranks on it.
  - `criteria` hold the four `flow-baseline` criteria. A verdict is the
    planning view; `flow-baseline` decides the boundary and records a
    correction in its contract's `decisions`.
  - `status`: `candidate` until a flow-contract exists, `in-progress` after,
    `landed` only from a `PASS`, with `evidence` pointing at it, and
    `blocked` when a chain ended without one and needs a human decision.
    Only `--seed` and `--land` move a slice to `in-progress` or `landed`; only
    a `candidate` may be offered in `recommendation`.
- `prerequisites`: a React file that two or more slices import and no slice
  owns.
  - `kind` is `shared-component` for UI and `adapter` for state, a context or
    a host bridge.
  - `angular` is `none` until a counterpart exists at the prerequisite's
    `target` in the metrics, then `built` with its `path` and the slice that
    built it (`builtBy`). The validator checks that the path lies under the
    measured Angular root.
  - `copies` are counterparts built elsewhere, inside one slice, such as the
    first slice's local rebuild. A slice that builds the shared counterpart
    leaves each copy for a later consolidation, so no landed slice changes
    without its own verification.
- `recommendation`: the options this run put to the user, up to five with a
  reason each, and the `queue` the user approved from them, in order. Each
  `flow-baseline` chat claims the first queued slice still available, so a
  queue lets baselines run side by side. `--seed` empties both, because a
  ranking describes the map it was made from. Before schemaVersion 2 one
  `chosen` slice stood where the queue is.
- `decisions`: a choice that shapes the map, such as why a boundary was cut
  where it was or why a copy is left for later.
- `openQuestions`: only what this run could not settle.
