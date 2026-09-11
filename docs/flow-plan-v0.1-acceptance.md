---
document: skill-acceptance-criteria
skill: flow-plan
targetVersion: 0.1.0
status: experimental
date: 2026-09-11
---

# `flow-plan` v0.1.0 acceptance criteria

## Hard gates

A run fails immediately when it writes inside the product repository, chooses
the next slice without the user, marks a slice landed without a `PASS`
verification-result, places an Angular counterpart anywhere but the project
constants' location, updates Targetprocess, starts `flow-baseline` in its own
chat or modifies skill source during its own run.

## Required output

- A `migration-map.json` in `runs\<date>-migration-map-<N>\` that validates
  with `validate-handoff.mjs`, seeded from the previous map when one exists.
- The `migration-metrics.json` it points to, written by
  `migration-map.mjs --measure` after the map's last change.
- A two- or three-option recommendation with the user's choice recorded.
- One review summary rendered from the validated map.
- A continuation into a fresh `/flow-baseline` carrying the map and the chosen
  `flowId`, through the three routes the other flow skills offer.
- A schema-valid observation sidecar with status `mapped`, `blocked` or
  `failed`.

## Acceptance check

The source is acceptable when:

1. the run directory, runId and previous map come from
   `run-context.mjs --map`, never from a directory listing read by hand;
2. a previous map is carried forward with `migration-map.mjs --seed`, which
   sets `supersedes` and lands every slice with a `PASS` for its `flowId`; a
   first map comes from `--init`;
3. every count the run cites, from file totals to how many slices share a
   file, comes from `--measure` output or the metrics file, and the metrics
   are measured after the map's last change;
4. new candidate slices are cut only for the feature being worked on, leaf
   first, with a parent's `dependsOn` naming every child slice;
5. every candidate records all four `flow-baseline` criteria with a verdict
   and a note, and `unknown` is used where only a survey could tell;
6. every `unmappedShared` file becomes a prerequisite of kind
   `shared-component` or `adapter`, and each existing Angular file is matched
   as `built` beside its React original or recorded as a copy;
7. the recommendation offers only candidates whose dependencies have landed,
   ranked by reuse of built counterparts, prerequisites left to build, size
   and risk, and names every prerequisite the option would build;
8. a flow the user names instead of an offered one joins the map as a slice
   and becomes the choice;
9. a feature's external ID comes from a baseline work-item snapshot or the
   user, never from invention;
10. the worktree comparison is `run-context.mjs --compare`, and a delta stops
    the run without a revert;
11. the summary is rendered from the validated map, is not a gate and asks
    for nothing;
12. the continuation comes from `continuation.mjs --next flow-baseline` with
    `--flow`, `--flow-id` and the map, and is performed only through the
    route the user chose;
13. artifact shapes come from `print-shape.mjs` on
    `examples\migration-map\demo\migration-map.json`, and
    `references/migration-map.md` is read at the write step, not at the
    start;
14. the observation sidecar comes from `new-observations.mjs --primary` on the
    map.
