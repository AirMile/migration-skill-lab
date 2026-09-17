# Flow Contract fields

Read this at step 6 of `flow-baseline`, when the run starts recording the
contract. It says what each field carries. Copy each field's exact shape from
`print-shape.mjs` on `examples\handoff\detail-drawer-line-edit\flow-contract.json`
and let `validate-handoff.mjs` name anything missing.

## Carry or cite

Carry in the contract what a later reader cannot recover from the product
source: the write allowlist with the start and end state; the rendered-surface
classification, which is a choice about this slice rather than a fact about
the code; the target architecture, because the Angular side does not exist yet;
the visual-parity requirements; the scenarios as the behavior this migration
promises; hypotheses that took cross-file reasoning; decisions and open
questions; validation commands, rollback and checkpoint policy.

Cite what the product source already holds: how a control behaves today (the
conversion arithmetic, the debounce window, the history rule, the tab order,
the spacing tokens) and which controls render under which condition. A
restated mechanism silently disagrees with the source the day someone edits
it; a citation cannot go stale unnoticed. Never copy application source into
the contract.

## Fields

- `repository`: the inspected root and revision.
- `scope`: `startState`, `endState` and `allowedWritePaths`, and nothing else;
  schemaVersion 6 rejects `includedPaths` and `excludedPaths`. The start and
  end state describe the chosen slice, not the whole route.
  The allowlist is the only thing bounding `flow-migrate`'s writes, and it
  holds exactly four kinds of path: the folders the new Angular code lands
  in, since a design with nowhere to land cannot be implemented, which are the
  slice's measured `angularTargets` when a migration map proposed it; the
  folder of the measured `target` of each prerequisite this slice builds; the
  test directory the `characterizationRequired` entries need, which the
  project constants name; and every `dependencyChanges.paths` entry, which the
  validator enforces.
  Check every existing file in it for consumers outside this flow: shared
  infrastructure stays out, or a `decisions` entry names the consumers
  considered and why the risk is accepted. That holds for an Angular
  counterpart another slice built as much as for React code: reuse it
  unchanged, and when it must change, the migration map names its consumers.
  Nothing goes in that the slice does not need.
- `scope.partialMount`: required. `nested: true` with `retainedParent` and
  `siblingSections` when the slice mounts inside a retained React parent;
  `nested: false` is a deliberate statement, not an omission. Both downstream
  skills read it to decide whether real-host evidence is mandatory. A partial
  mount replaces only `migrate` items and stays inside the parent form while
  siblings are `retain-react`.
- `planSlice`: present exactly when a migration map proposed the slice. `map`
  is the map's pointer from `hash-artifact.mjs` with its `runId`, and
  `flowId` is the map slice's, which the validator checks against the
  contract's. `remainder` names the surfaces inside the slice's `paths` that
  stay React after this chain, or is `null` when the whole slice migrates;
  `--ready` offers a slice with a remainder again, so the next chain cuts
  from it. The slice is the allowlist's ceiling: the validator rejects a path
  outside its `paths`, their `__tests__` folders, its measured
  `angularTargets` and the target folders of the prerequisites it `requires`.
  `map` is an object with exactly `path`, `sha256` (run
  `hash-artifact.mjs <migration-map.json>` to get it, never compute it by
  hand) and `runId`; `flowId` sits directly under `planSlice`, not under `map`.
  Each prerequisite's ceiling folder is its own measured `target` from the
  map or `style-sources.mjs`, never a broader folder shared by several
  prerequisites: list the exact target string the tooling printed.
- `renderedSurfaceInventory`: one cited entry per visible control, conditional
  branch, child component and action, each `migrate`, `retain-react` or
  `excluded`. It binds the migration: no component may replace a parent whose
  `retain-react` items it would hide, whatever the scenario list says.
- `targetArchitecture`: `boundary.angularOwns` and `boundary.reactRetains`; the
  `adapter` with `inputs`, `commands`, `events`, `nonSuccessOutcome` and
  `forbiddenAccess`; `lifecycle` rules for mount, unmount and cancellation;
  `styling` rules; and `dependencyChanges`. Every one of these is an array of
  strings except `nonSuccessOutcome`, which is one string, and
  `dependencyChanges`. Transcribe the mount mechanism, compilation and
  change-detection strategy, framework version and package set from
  `docs\project-constants.md` and cite it; this run decides only the boundary,
  adapter, lifecycle and styling of the slice. Change detection is zoneless,
  so give every value the slice receives from outside Angular (a store
  subscription, a socket event, a timer, a promise) one `lifecycle` rule
  naming its source and the signal it is written into; the survey already
  found them, and `flow-migrate` then need not trace them again. Preserve
  boundaries that are sound; do not mirror React mechanically or redesign the
  app.
- `targetArchitecture.dependencyChanges`: a boolean `required`, `packages` as
  exact `name@version` strings, `paths` repository-relative, and an optional
  `note`. Read the product's dependency manifest first and cite it. When the
  framework is absent there, `required` is `true`, with the constants' package
  set and every file that set changes (manifest, lockfile, TypeScript
  configuration). Never write `false` on the assumption that an earlier slice
  added it: that unchecked claim hides the migration's largest decision. The
  schema requires at least one entry in both `packages` and `paths` regardless
  of `required`'s value, so never leave either empty: with `required: false`,
  list the already-installed package set the constants name and `paths: ["package.json"]`,
  and cite the manifest showing they are already there in `note`; with
  `required: true`, list the set to add and every file it changes.
- `scenarios`: Given/When/Then observable outcomes, each with evidence pointers
  and concrete values a tester can act on.
- `visualParity`: one entry per `migrate` inventory id and no other id (the
  validator checks both directions), with the retained `counterpart`, the
  `appearance` requirements (border, radius, icon and label placement,
  trailing unit, design tokens rather than literal values), the `layout`
  requirements (width, alignment and spacing against the retained sibling
  sections, drawer insets, input containment) and a `reference` citing the
  counterpart. Add a reference screenshot when one is available. Write each
  `appearance` and `layout` requirement as something a machine can read back
  where the surface allows it — `paddingLeft: 16px`, or `paddingLeft matches
  counterpart` when the value belongs to a token rather than the surface —
  because step 8 measures those exact property names in the running host and
  `flow-verify` compares the numbers. Prose such as "aligns neatly" survives
  as a note, never as the whole requirement. A surface
  that is not declared here can never fail downstream, so anything a user
  would notice belongs here. `appearance` and `layout` say what a tester
  compares; `styleSources` and `sharedComponents` say where the rules live,
  and are the `contract` block `style-sources.mjs` printed for the surface,
  copied verbatim, since `flow-migrate` ports from those citations and not
  from the prose. A shared component whose counterpart is not built is built
  by this slice at its measured `target`, which joins the allowlist: a
  restyled copy inside the slice drifts from the component it copies, and the
  validator rejects a contract that leaves the target out. Both fields are
  new at schemaVersion 8, so `print-shape.mjs` cannot show them.
- `characterizationRequired`: `id`, `hypothesis`, `proveBefore` as an array of
  the scenario ids it blocks, and `evidence`, an array even for one citation.
  `flow-migrate` records an outcome per id and `flow-verify` re-examines the
  scenarios behind a disproved one, so `proveBefore` names ids the validator
  can check, never prose.
- `decisions`: `topic`, `decision`, `rationale` and `followUp`, for a choice that
  shapes what the contract says: the boundary with its rejected candidates, an
  accepted shared-path risk, a resolved conflict between sources. An open
  conflict stays an open question, and why an earlier run was discarded goes
  to the observation sidecar.
- `testGaps`: only behavior without adequate evidence, with the safe
  measurement it would need. Coverage is evidence about executed code, never a
  per-flow baseline on its own, and a figure CI already measures is recorded
  as not retrieved, with where it lives.
- `openQuestions`: only what this run could not determine. `flow-migrate`
  reports `BLOCKED` on each one, so a choice this run could make is decided or
  put to the user instead. The mount mechanism is an open question only when
  the project-constants page is missing, and then the missing page is the
  question.
- `userStory`: the prose `render-user-story.mjs` cannot derive, in plain words
  a stakeholder reads, without citations: a `title` naming the slice, a
  `userValue` as "As ... I want ... so that ...", the `currentBehavior` React
  gives today and the `desiredBehavior` once Angular owns the slice. Acceptance
  criteria and attention points come from `scenarios`, `visualParity`,
  `characterizationRequired`, `openQuestions`, `planSlice` and the manual
  validation environment, so none of them is repeated here. Record no board
  IDs. These four strings are the whole block, and the schemaVersion 6
  example has none, so `print-shape.mjs` cannot show it.
- `checkpointPolicy`: `mode: disabled` with `pushPolicy: never`. Only a user who
  asks for `auto-local` unprompted changes that, and supplies
  `expectedBranch`, `externalRef` and `milestones`; `authorizedByRole` and
  `authorizedAt` exist only then. Leave an unassigned value absent rather than
  filling it with a placeholder.
- `validationPlan`: test commands that terminate, `typecheckCommand`,
  `buildCommand`, `installCommand` from the constants, `browserValidation`
  naming an existing component-rendering harness such as Storybook when the
  product has one, and `manualValidation` with the `environment` from the
  constants and a `scenario` that gives the walkthrough's route: the order in
  which a person takes the scenario and `visualParity` ids, and the concrete
  data each needs, such as which line to select and which robot type to
  choose. Name the ids rather than retelling them: `flow-verify` builds every
  item from the entry itself, and a retold scenario is a second copy that
  drifts. Nobody is assigned to it, so the route and the environment are the
  whole instruction. `userPath` is optional: the screen, menu or tab a tester
  opens to see the surveyed surface running today, so they can check current
  behavior and visuals without reading source. Write it only from a citable
  router, menu or navigation configuration the survey found; leave it out
  rather than guess one. Not in the canonical example, so `print-shape.mjs`
  cannot show it.
- `rollback`: which files return to which state, and what a revert must not
  disturb. Restating that `migration-result.json` records the checkpoint SHAs
  answers nothing.
