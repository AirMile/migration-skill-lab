---
document: skill-acceptance-criteria
skill: flow-plan
targetVersion: 0.6.0
status: experimental
date: 2026-09-18
---

# `flow-plan` v0.6.0 acceptance criteria

## Hard gates

A run fails immediately when it writes inside the product repository, chooses
or queues a slice without the user, marks a slice landed without a `PASS`
verification-result, places an Angular counterpart anywhere but its measured
target, changes the Angular target structure, updates Targetprocess, starts `flow-baseline` in its own
chat or modifies skill source during its own run.

## Required output

- A `migration-map.json` in `runs\<date>-migration-map-<N>\` that validates
  with `validate-handoff.mjs`, seeded from the previous map when one exists.
- The `migration-metrics.json` it points to, written by
  `migration-map.mjs --measure` after the map's last change.
- A recommendation of up to five ranked options recorded, with the queue the
  user approved, in order; the user-facing offer itself leads with the
  top-ranked pick and at most two runner-ups, each with its reason, never a
  flat list of every recorded option.
- One review summary rendered from the validated map.
- A continuation into fresh `/flow-baseline` chats carrying the map and no
  slice, through the three routes the other flow skills offer.
- A schema-valid observation sidecar with status `mapped`, `blocked` or
  `failed`.

## Acceptance check

The source is acceptable when:

1. the run directory, runId and previous map come from
   `run-context.mjs --map`, never from a directory listing read by hand;
2. a previous map is carried forward with `migration-map.mjs --seed`, which
   sets `supersedes` and lands every slice with a `PASS` for its `flowId`
   whose contract leaves no remainder, while a `PASS` with a remainder keeps
   its slice `in-progress`; a first map comes from `--init`;
3. every count the run cites, from file totals to how many slices share a
   file, comes from `--measure` output or the metrics file, and the metrics
   are measured after the map's last change;
4. new candidate slices are cut only for the feature being worked on, leaf
   first, with a parent's `dependsOn` naming every child slice;
5. every candidate records all four `flow-baseline` criteria with a verdict
   and a note, `unknown` is used where only a survey could tell, and
   `boundedBranches.note` carries `robot-context.mjs` output over the
   candidate's `paths` rather than a judgement made by reading, since the gate
   that decides the rendering is often a capability the file receives instead
   of one it names;
6. every `unmappedShared` file becomes a prerequisite of kind
   `shared-component` or `adapter`, and each existing Angular file is matched
   as `built` at the prerequisite's measured target or recorded as a copy, a
   drifted counterpart included;
7. the recommendation offers only slices `run-context.mjs --ready` marks
   `available`, ranked by reuse of built counterparts, prerequisites left to
   build, size and risk, robot dependence included, and names every
   prerequisite the option would build and every unbuilt one it shares with an
   active or another offered slice, and says which robots differ for a
   robot-dependent option; up to five ranked candidates are recorded in
   `options`, but the question put to the user leads with the top-ranked pick
   and at most two runner-ups, each with its reason stated in the question,
   and names any further candidates only as available on request;
8. a flow the user names instead of an offered one joins the map as a slice
   and the queue;
9. it records no board ID for a feature and asks for none;
10. the worktree comparison is `run-context.mjs --compare`, and a delta stops
    the run without a revert, unless it is the user's change that settled a
    structure collision;
11. the summary is rendered from the validated map, is not a gate and asks
    for nothing;
12. the continuation comes from `continuation.mjs --next flow-baseline` with
    the map and no `--flow`, so every chat it opens claims its own queued
    slice, and is performed only through the route the user chose;
13. artifact shapes come from `print-shape.mjs` on
    `examples\migration-map\demo\migration-map.json`, and
    `references/migration-map.md` is read at the write step, not at the
    start;
14. the observation sidecar comes from `new-observations.mjs --primary` on the
    map;
15. a measure whose `structure` lists an unmatched file or a collision is
    reported with that list and the run goes no further until it is settled,
    because a missing or clashing rule in `docs\angular-structure.json`, or a
    clashing product file, is a project decision, never one a run works
    around or makes;
16. every Angular target the run cites, a prerequisite's or a slice's, comes
    from the metrics, never from applying the structure's rules by hand;
17. every slice's `requires` equals its `impliedRequires` in the metrics,
    taken from `slicesWithIncompleteRequires` and never typed from the run's
    own reading, and a map written at schemaVersion 2 validates on it;
18. after slices are cut, `migration-map.mjs --land` runs, so a slice cut in
    this run that already has a `PASS` lands instead of staying open;
19. a structure collision or unmatched file makes the run wait, not end: it is
    settled outside the run, the run measures again and continues, and it is
    `blocked` only when it ends without a map;
20. the observation sidecar is written once, at the end of the run;
21. only a slice with status `candidate` is offered in the recommendation, and
    a map at schemaVersion 2 records `queue`, never `chosen`;
22. `migration-map.mjs --measure` names a block missing a field instead of
    failing with a bare type error.
