---
name: flow-plan
description: Keep the migration map of features, candidate slices and the shared components and state adapters they depend on, and queue the next React-to-Angular slices for flow-baseline. Requires a high-capability reasoning model. Use only with /flow-plan.
---

# Flow Plan

Pipeline: `/flow-plan` -> `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`,
with `/flow-debug` as the repair loop back into a fresh `/flow-verify`, and a
`PASS` back into `/flow-plan`.
This skill holds the overview: it decides nothing about one slice's behavior,
only which slices go next and what they can build on.

Skill version: `0.5.0`.

Recommended model: Claude Sonnet 5. Cutting candidate slices and weighing them is
judgement every later chain inherits.

Keep one `migration-map.json`: the features, the candidate slices in each with
their dependencies and the four slice criteria, and the shared components and
state adapters those slices import, with whether an Angular counterpart exists.
Then let the user queue the next slices for `flow-baseline`, where each chat
claims one, so baselines can run side by side. The product stays read-only.

The map is the only durable artifact. Write no prose report: a second copy
drifts, and no later skill reads it.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

Ask the user only for what nobody else holds:

- which slices to queue, in order, from the options this run proposes. A flow
  the user names instead joins the map as a slice and the queue;
- which feature to cut into slices, when no mapped candidate is workable.

Derive everything else, state each value in one line and continue:

- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --lab-root <lab> --map --save-status`.
  It gives the product revision and status, `map.previousMap`,
  `map.nextRunDirectory` and `map.nextRunId`.
- An invocation that names a `verification-result.json` comes from a `PASS`:
  the seed step lands that slice unless its contract leaves a remainder. Say
  so in one line.
- Read `<lab>\docs\project-constants.md` and say that you did. Its Angular
  target structure puts every prerequisite's counterpart at the `target` the
  measure records for it; never propose another place.
- The four slice criteria are `flow-baseline`'s, in workflow step 3 of
  `<lab>\.github\skills\flow-baseline\SKILL.md`. Read them there, once.

## Workflow

1. Take the product revision and status from `run-context.mjs`. A dirty
   worktree is evidence, not permission to change it.
2. **Seed.** With a previous map, run
   `node "<lab>\scripts\migration-map.mjs" --seed --previous <map.previousMap> --out <map.nextRunDirectory>\migration-map.json --run-id <map.nextRunId> --skill-version <this skill's version> --lab-root <lab>`.
   It carries every field, lands each slice with a `PASS` **and** a matching
   `land-receipt.json` (only `slice-worktree.mjs --land` writes one), and moves
   each started candidate to `in-progress`; report the landed, in-progress,
   `partial` and `awaitingLand` lists in one line. A flow in `awaitingLand` has
   a `PASS` nobody has landed yet: tell the user to run
   `node "<lab>\scripts\slice-worktree.mjs" --land --product-root <product> --run-dir <run-dir>`
   for it before this map can treat it as landed, since a hand merge or an
   uncommitted worktree both look unlanded until that command runs. Without a
   previous map, run `--init --product-root <product>` with the same `--out`,
   `--run-id` and `--skill-version`: one feature per folder under
   `src\features`, no slices yet.
3. **Measure.** Run
   `node "<lab>\scripts\migration-map.mjs" --measure --product-root <product> --map <migration-map.json> --lab-root <lab>`.
   Run it again after every change to slices or prerequisites, and last before
   validating, since the metrics describe the map as it stood when measured.
   When its `structure` counts an unmatched file or a collision, report the
   metrics' `structure.unmatched` and `structure.collisions` and wait: a
   missing or clashing rule, or a product file that clashes, is a project
   decision made outside this run. Once the user says it is settled, measure
   again and go on; the run is `blocked` only when it ends without a map.
4. **Features.** Add one for each `featureDirectoriesNotInMap` entry, with no
   board ID.
5. **Slices.** Cut new candidates only for the feature being worked on: the
   one whose slice just landed, or the one the user names. Leave a feature
   alone while it still holds two workable candidates. Read its component tree
   breadth first, down to where controls render, and open a file only where it
   decides a boundary. Cut leaf first: a parent is its own slice whose
   `dependsOn` names every child slice, because `flow-migrate` never replaces
   a parent while a child it renders is still React. Give each candidate a
   `flowId` that stays its name for good, since `flow-baseline` names its runs
   after it, and judge all four criteria with a one-line note; `unknown` is
   the honest verdict where only `flow-baseline`'s survey can tell. For
   `boundedBranches`, do not judge by reading: run
   `node "<lab>\scripts\robot-context.mjs" --product-root <product> --path <p> [--path ...]`
   over the candidate's `paths` and copy its `note` into
   `criteria.boundedBranches.note`. The rendering of this product depends on
   the loaded robot, and the gate that decides it is often a capability the
   file receives rather than one it names, so a reading misses it. Two thirds
   of the robot-dependent files branch on the robot type without naming a
   capability at all, which is why the script looks for both. A `robotSensitive`
   candidate is not `fail` on that ground alone — it is a slice whose
   measurement has to pin the robot down, which step 7 ranks on and
   `flow-baseline` records. Fix every
   slice the measure lists under `slicesWithMissingPaths`. Then run
   `node "<lab>\scripts\migration-map.mjs" --land --map <migration-map.json> --lab-root <lab>`:
   a slice cut now may already have a `PASS` the seed could not see.
6. **Prerequisites.** Every `unmappedShared` file from the measure becomes a
   prerequisite: `shared-component` when it renders, `adapter` when a slice
   reads or writes state, a context or a host bridge through it. Match the
   measure's `angularFiles` against each prerequisite's `target` in the
   metrics: a counterpart at its target is `built`, with the slice that built
   it; one anywhere else, a `driftedPrerequisites` entry included, is a
   `copies` entry, since no later slice looks for it there. Measure, then make
   each slice's `requires` match `slicesWithIncompleteRequires`: add every
   `missing`, drop every `extra`, and never type it from your own reading,
   because step 7 ranks on it. A classification carries forward; judge only
   new files. Record a choice that shapes the map, such as a boundary or a
   copy left for later, as a `decisions` entry.
7. **Queue.** Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --lab-root <lab> --ready <migration-map.json>`
   and offer only slices it marks `available`: a baseline in another chat may
   already hold one, and its dependencies may have landed since the seed. Rank
   them in this order: reuses `built` counterparts; leaves the fewest
   prerequisites to build, naming each one it would build, a `copies` entry
   included; smaller, by the measured file count; lower risk, naming any
   drawlib, history or host-boundary contact, and any robot dependence
   `boundedBranches.note` records. A robot-dependent slice ranks below an
   equivalent neutral one because its before and after have to be measured
   under the same robot, which `visual-measure` enforces and a reader has to
   arrange; say which robots differ when you offer it, so the user chooses
   with that cost in view rather than meeting it at verification. Put up to five to the user as
   plain text, each with the unbuilt prerequisites it shares with an `active`
   slice or, from `unbuiltSharedByAvailable`, with another one offered, since
   two baselines that build one counterpart side by side collide at its
   target. The user approves an ordered queue of one or more; record
   `options` and `queue`. A flow the user names instead is added as a slice
   and joins the queue.
8. **Write and validate.** Copy any block's shape from
   `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\migration-map\demo\migration-map.json" [--block <name>]`
   and read `references/migration-map.md` for what each field carries. Measure,
   then run `node "<lab>\scripts\validate-handoff.mjs" <migration-map.json>`.
9. **Worktree check.** Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare`.
   Report any delta and never revert it. A change the user made outside this
   run to settle step 3 is named as that and the run goes on; any other change
   stops it.
10. **Summary.** Render one screen from the validated map, never from memory:
    what landed since the previous map; any slice still `awaitingLand` from
    step 2, named with the `--land` command it needs; per worked feature, its
    slices with status; each prerequisite with its counterpart status and how
    many slices' `requires` name it; the queue, each slice with its
    `requires`; open questions. It is not a gate and asks for nothing. For a
    slice the user asks to publish, and only then, show
    `node "<lab>\scripts\slice-worktree.mjs" --publish --product-root <product> --run-dir <run-dir>`:
    it branches `feature/migrate-<flowId>` off `migration/angular` and pushes
    it, once per slice, never to `migration/angular` or `main` and never as a
    merge; opening the merge request stays the user's own action on the
    team's Git host.
11. **Continuation.** Build the invocation with
    `node "<lab>\scripts\continuation.mjs" --next flow-baseline --lab-root <lab> --product-root <product> --run-dir <run-dir> <migration-map.json>`.
    It names no slice: each chat it starts offers the queue and claims the
    slice the user confirms, so the same invocation opens one baseline per
    queued slice. Offer exactly three routes and perform only the chosen one:
    1. fresh chats opened now through the host's own mechanism, as many as the
       user asks for, each carrying only the invocation. Never start a second
       terminal window;
    2. the invocation shown here, to paste into chats the user opens;
    3. the same command with `--save --flow-id <map runId>`, a checkpoint
       rather than an abandonment, since every phase reads only artifacts.
    Never start the baseline in this chat or delegate it to a background
    agent, which cannot ask the user what it needs.
12. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
    it once, at the end, with `--primary <migration-map.json> --status mapped`,
    or `failed` or `blocked` when no map could be written. A wait at step 3 is
    not an end.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out product
  files, install anything, or start a persistent service;
- run `slice-worktree.mjs --land` or `--publish` itself, or push anything to a
  remote; only show the command for the user to run in their own terminal;
- write a file other than the map, its metrics and the observation sidecar in
  the run directory;
- choose or queue a slice for the user, or cut slices for a feature nobody is
  working on;
- mark a slice `landed` by hand: only `--seed` or `--land` does, from a `PASS`;
- change the Angular target structure, or place a counterpart anywhere but
  its measured target;
- update Targetprocess;
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
