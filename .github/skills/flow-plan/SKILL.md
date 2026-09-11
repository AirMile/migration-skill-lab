---
name: flow-plan
description: Keep the migration map of features, candidate slices and the shared components and state adapters they depend on, and propose the next React-to-Angular slice for flow-baseline. Use only with /flow-plan.
---

# Flow Plan

Pipeline: `/flow-plan` -> `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`,
with `/flow-debug` as the repair loop back into a fresh `/flow-verify`, and a
`PASS` back into `/flow-plan`.
This skill holds the overview: it decides nothing about one slice's behavior,
only which slice goes next and what it can build on.

Skill version: `0.2.0`.

Recommended model: Claude Opus 5. Cutting candidate slices and weighing them is
judgement every later chain inherits.

Keep one `migration-map.json`: the features, the candidate slices in each with
their dependencies and the four slice criteria, and the shared components and
state adapters those slices import, with whether an Angular counterpart exists.
Then let the user choose the next slice and hand it to `flow-baseline`. The
product stays read-only.

The map is the only durable artifact. Write no prose report: a second copy
drifts, and no later skill reads it.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

Ask the user only for what nobody else holds:

- which slice goes next, from the options this run proposes. A flow the user
  names instead joins the map as a slice;
- which feature to cut into slices, when no mapped candidate is workable;
- a feature's Targetprocess ID when no baseline work-item snapshot under
  `<lab>\runs\` carries it.

Derive everything else, state each value in one line and continue:

- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --lab-root <lab> --map --save-status`.
  It gives the product revision and status, `map.previousMap`,
  `map.nextRunDirectory` and `map.nextRunId`.
- An invocation that names a `verification-result.json` comes from a `PASS`:
  that slice lands in the seed step. Say so in one line.
- Read `<lab>\docs\project-constants.md` and say that you did. Its Angular
  target structure puts every prerequisite's counterpart at the `target` the
  measure records for it; never propose another place.
- The four slice criteria are `flow-baseline`'s, in workflow step 3 of
  `<lab>\.github\skills\flow-baseline\SKILL.md`. Read them there, once.

## Workflow

1. Take the product revision and status from `run-context.mjs`. A dirty
   worktree is evidence, not permission to change it.
2. **Seed.** With a previous map, run
   `node "<lab>\scripts\migration-map.mjs" --seed --previous <map.previousMap> --out <map.nextRunDirectory>\migration-map.json --run-id <map.nextRunId> --skill-version 0.2.0 --lab-root <lab>`.
   It carries every field, lands each slice with a `PASS` verification-result
   and moves each started candidate to `in-progress`; report both lists in one
   line. Without one, run `--init --product-root <product>` with the same
   `--out`, `--run-id` and `--skill-version`: one feature per folder under
   `src\features`, no slices yet.
3. **Measure.** Run
   `node "<lab>\scripts\migration-map.mjs" --measure --product-root <product> --map <migration-map.json> --lab-root <lab>`.
   Run it again after every change to slices or prerequisites, and last before
   validating, since the metrics describe the map as it stood when measured.
   When its `structure` counts an unmatched file or a collision, stop and
   report the metrics' `structure.unmatched` and `structure.collisions`: a
   missing or clashing rule is a project decision for
   `<lab>\docs\angular-structure.json`, not for this run.
4. **Features.** Add one for each `featureDirectoriesNotInMap` entry. Take a
   feature's `externalId` from a baseline work-item snapshot that names it, or
   from the user; never invent one.
5. **Slices.** Cut new candidates only for the feature being worked on: the
   one whose slice just landed, or the one the user names. Leave a feature
   alone while it still holds two workable candidates. Read its component tree
   breadth first, down to where controls render, and open a file only where it
   decides a boundary. Cut leaf first: a parent is its own slice whose
   `dependsOn` names every child slice, because `flow-migrate` never replaces
   a parent while a child it renders is still React. Give each candidate a
   `flowId` that stays its name for good, since `flow-baseline` names its runs
   after it, and judge all four criteria with a one-line note; `unknown` is
   the honest verdict where only `flow-baseline`'s survey can tell. Fix every
   slice the measure lists under `slicesWithMissingPaths`.
6. **Prerequisites.** Every `unmappedShared` file from the measure becomes a
   prerequisite: `shared-component` when it renders, `adapter` when a slice
   reads or writes state, a context or a host bridge through it. Match the
   measure's `angularFiles` against each prerequisite's `target` in the
   metrics: a counterpart at its target is `built`, with the slice that built
   it; one anywhere else, a `driftedPrerequisites` entry included, is a
   `copies` entry, since no later slice looks for it there. Add each
   prerequisite to the `requires` of every slice that imports it. A
   classification carries forward; judge only new files.
7. **Recommend.** Offer two or three candidates whose `dependsOn` have all
   landed, ranked in this order: reuses `built` counterparts; leaves the
   fewest prerequisites to build, naming each one it would build, a `copies`
   entry included; smaller, by the measured file count; lower risk, naming
   any drawlib, history or host-boundary contact. Put them to the user as
   plain text and record `options` and `chosen`. A flow the user names
   instead is added as a slice and becomes `chosen`.
8. **Write and validate.** Copy any block's shape from
   `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\migration-map\demo\migration-map.json" [--block <name>]`
   and read `references/migration-map.md` for what each field carries. Measure
   once more, then run `node "<lab>\scripts\validate-handoff.mjs" <migration-map.json>`.
9. **Worktree check.** Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare`.
   If anything changed, stop and report the delta; do not revert it.
10. **Summary.** Render one screen from the validated map, never from memory:
    what landed since the previous map; per worked feature, its slices with
    status; each prerequisite with its counterpart status and how many slices
    need it, from the metrics; the chosen slice with its `requires`; open
    questions. It is not a gate and asks for nothing.
11. **Continuation.** Build the invocation with
    `node "<lab>\scripts\continuation.mjs" --next flow-baseline --flow "<chosen title>" --flow-id <chosen flowId> --lab-root <lab> --product-root <product> --run-dir <run-dir> <migration-map.json>`,
    then offer exactly three routes and perform only the chosen one:
    1. a fresh chat opened now through the host's own mechanism, carrying only
       the invocation. Never start a second terminal window;
    2. the invocation shown here, to paste into a chat the user opens;
    3. the same command with `--save`, a checkpoint rather than an
       abandonment, since every phase reads only artifacts.
    Never start the baseline in this chat or delegate it to a background
    agent, which cannot ask the user what it needs.
12. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
    it with `--primary <migration-map.json> --status mapped`, or `failed` or
    `blocked` when no map could be written.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out product
  files, install anything, or start a persistent service;
- write a file other than the map, its metrics and the observation sidecar in
  the run directory;
- choose the next slice for the user, or cut slices for a feature nobody is
  working on;
- mark a slice `landed` by hand: only the seed does, from a `PASS`;
- change the Angular target structure, or place a counterpart anywhere but
  its measured target;
- update Targetprocess, or invent an external ID;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data;
- edit this skill, its references or an installed snapshot during a run;
- start `flow-baseline` in this chat, in a background agent or by a route the
  user did not choose.

## Reading discipline

Context is spent once; every re-read pays again for nothing.

- Read a file once, at the range you need, and never re-read a range you hold.
- Widen or narrow a search instead of repeating it in other words.
- Take counts from the measure's output and the metrics file, never by
  counting imports yourself.
- Learn an artifact's shape from `print-shape.mjs`, never from `schemas\`,
  `scripts\` or a whole example file; write the artifact and act on the
  validator's errors.
