---
document: skill-acceptance-criteria
skill: flow-baseline
targetVersion: 0.24.0
status: experimental
date: 2026-09-14
---

# `flow-baseline` v0.24.0 acceptance criteria

## Hard gates

A run fails immediately if it changes the product repository, invents a
selected flow, omits a material uncertainty, makes an uncited confirmed
repository claim, writes a contract as approved without human approval, starts
an implementation run the user did not choose, puts a path in the write
allowlist the slice does not need, or stores sensitive content.

## Required output

- Two or three candidate boundaries put to the user after the survey, each with
  its migrate set, retained neighbours, external importers, conditional branches
  and existing test evidence, judged against the four slice criteria.
- The chosen boundary with explicit exclusions and confidence, recorded as a
  `decisions` entry naming the rejected candidates.
- A behavior baseline covering applicable success, error, state, side-effect
  and cleanup behavior.
- A cited evidence ledger with `Confirmed`, `Inference` and `Open question`.
- Existing relevant tests, their proved behavior and prioritized evidence gaps.
- One `flow-contract.json` at schemaVersion 6 that validates against the
  handoff schema, carrying `renderedSurfaceInventory` and `targetArchitecture`,
  with no `status`, no `approval` and no `targetArchitecture.status`.
- No analysis report, no rendered work-item Markdown and no other file beyond
  the contract, the work-item snapshot and the observation artifact, in the
  run directory `run-context.mjs --claim` created at the start.
- A before/after Git-visible product worktree comparison.
- A schema-valid observation artifact written after the primary artifacts,
  including an empty observation list when no concrete skill signal occurred.
- A schema-valid baseline work-item snapshot with Epic/Feature/Story/Task
  identity, fields, state and progress, shown inline rather than written twice.
- Items that did not move marked `no-change` with their previous field text
  copied verbatim, rendered as an identification line rather than restated.
- Task contribution weights totaling 100, calculated Story progress and a
  concise daily standup block with separate current/proposed percentages.
- A bounded Detail Drawer target-architecture proposal that does not mirror
  React mechanically or redesign the full frontend.
- A disabled or explicitly human-approved checkpoint policy with exact branch,
  external reference and push policy.
- A machine-readable validation plan and rollback; approval is impossible
  while required test, typecheck, build or host details are absent.
- One review summary rendered from the validated contract, covering scope,
  partial mount, the surface inventory, the architecture, scenario summaries,
  required characterization, visual-parity surfaces, the write allowlist,
  validation commands, rollback, checkpoint policy, decisions and open
  questions. It asks for no reply, authorizes nothing, and restates no confirmed
  behavior, because a citation is checked by opening it.
- Exactly one user-chosen continuation: a fresh `flow-migrate` chat opened now,
  the invocation shown for pasting, or the invocation saved in the run
  directory.

## Acceptance check

The source is acceptable when:

1. it requires a human-selected flow and the migration-skill-lab root, and
   derives the run location instead of asking for it; a flow is human-selected
   when the invocation names it or the user confirms it from the slices
   `run-context.mjs --ready` marks available;
2. it cannot write product code or tests;
3. it produces a final Flow Contract that is never self-approved and carries no
   approval state;
4. it refuses unsupported Angular target claims;
5. its example artifact validates with `validate-handoff.mjs`;
6. its source does not alter `migration-analyze` v0.1.
7. it excludes product findings, expected blockers, convention gaps and
   unproven causality from skill observations;
8. an observation-capture failure is visible but does not rewrite the Flow
   Contract status.
9. it never updates Targetprocess or presents `copy-ready` as externally
   applied;
10. it proposes a new story only after explicit request or evidence-backed
    scope splitting and never invents an external ID;
11. it creates no product or empty checkpoint commit in the read-only phase;
12. it builds the review summary from validated contract fields rather than
    from prose;
13. it never sets or claims to set the host plan mode, and defers its artifact
    writes until plan mode is exited when the session already runs in it;
14. it opens a `flow-migrate` chat only on the user's explicit route choice and
    never continues or delegates the migration itself.
15. it groups technical checkpoints under stakeholder-readable Tasks instead
    of creating one Task per commit;
16. Story progress is derived from Task contributions, never guessed.
17. current board progress is never overwritten by a copy-ready proposal;
18. browser automation and Maui host smoke validation stay separate.
19. a possible behavior improvement triggers one explicit preserve/include/
    follow-up choice and remains open until answered.
20. it never edits an earlier run's artifacts; a changed boundary, allowlist or
    scenario is a new run that declares `supersedes`.
21. it records visual parity requirements, including drawer insets and input
    containment, for independent browser verification.
22. it ends by offering a user-confirmed fresh `/flow-migrate` chat rather than
    starting an implementation subagent.
23. it inventories every rendered child control and conditional branch as
    `migrate`, `retain-react` or `excluded` before proposing a partial mount.
24. it declares `scope.partialMount` with `retainedParent` and
    `siblingSections` whenever the proposed slice mounts inside a retained
    React parent, because both downstream skills read that flag to decide
    whether real-host evidence is mandatory.
25. it shows the generated `--inline` handoff verbatim in the chat rather than
    a paraphrase, so the copy/paste content comes from the validated snapshot;
26. it declares `scope.partialMount` explicitly from schemaVersion 4, including
    a deliberate `nested: false`, rather than omitting the field;
27. it copies unchanged Epic, Feature, Story and Task field text from the
    previous handoff for this flow byte for byte and marks those items
    `no-change`, so a rerun reports what moved instead of a reworded copy of
    what did not;
28. it declares `supersedes` when an earlier baseline for this flow exists, and
    never carries `currentState` or `currentProgress` forward from it;
29. it declares one `visualParity` entry per migrated surface with the retained
    counterpart, the concrete appearance requirements and the layout
    requirements against the retained sibling sections;
30. an appearance difference a user would notice is declared as a contract
    requirement rather than left to report prose, because an undeclared
    surface can never fail downstream.
31. it reads a file once at the range it needs, repeats no near-identical
    search, and reads no schema or script source in place of running the
    validator;
32. observation capture evaluates the countable checks against this run's own
    tool history, and an empty list means every check was evaluated and none
    fired rather than that none was looked for;
33. `richReleaseNotes` is refreshed only on an item the run actually moved,
    so per-run narrative cannot force an unchanged Epic or Feature into
    `update`.
34. it writes the contract, the work-item snapshot and the observation
    artifact and nothing else, and never a prose document that duplicates a
    validated artifact;
35. the target architecture reaches `flow-migrate` inside the contract rather
    than being re-elicited from the user;
36. confirmed current behavior is cited, not restated, so the contract cannot
    silently disagree with the source it describes.
37. every validation command it records terminates; a watch-mode script is
    never recorded as a test command;
38. `scope.allowedWritePaths` contains a location for the new Angular code, and
    every existing path in it was checked for consumers outside this flow;
39. an item that is not on the board uses `create` with no external ID on
    either side, and no placeholder ID is ever written;
40. `checkpointPolicy` records only what is assigned: a draft carries `mode`
    and `pushPolicy`, and never a placeholder branch, reference or milestone;
41. every question it asks has answerable options, and it offers no route the
    validator rejects, no command the safety boundary forbids and no value the
    run can derive;
42. a wish to change the boundary, the write allowlist or a scenario is answered
    with a new run, never with an edit to the written contract.
43. `dependencyChanges` follows from the product's own dependency manifest, and
    a missing target framework yields `required: true` with the manifest,
    lockfile, build-config and TypeScript paths;
44. an existing component-rendering harness is named in the validation plan
    rather than an unassigned browser runner proposed beside it.
45. the boundary is chosen during the run from surveyed evidence, never taken
    as an input before the survey can show what each candidate costs;
46. every surface rendered by its own component has its importers outside this
    flow searched and cited, because that is what makes a boundary judgeable;
47. the chosen and rejected candidates are recorded in `decisions`, so a later
    reader can see which cuts were considered and why one won.
48. an unresolved mount or embedding mechanism is recorded as an open question
    that `flow-migrate` reports `BLOCKED` on, and is never described away as
    covering only the behavior baseline;
49. the baseline Task is complete when the analysis is, because no gate is left
    for it to hold open;
50. `pushPolicy` is `never` whenever the checkpoint mode is `disabled`.
51. the contract is final when written: no `status`, no `approval`, no
    `targetArchitecture.status`, and no successor pair;
52. the review summary asks for no reply and is never presented as a gate;
53. verification is recorded as manual scenarios, never as a browser runner,
    automation command or an owner to assign one to;
54. `scope.allowedWritePaths` carries the weight the gate used to: it contains
    nothing the chosen slice does not need.
55. `scope` carries the start state, the end state and that write allowlist and
    nothing else; a schemaVersion 6 contract carrying `includedPaths`,
    `excludedPaths` or `baselineReport` is rejected;
56. a surface the slice leaves alone is a cited `retain-react` or `excluded`
    inventory entry, never a bare path in a separate exclusion list;
57. `decisions` records only choices that shape what this contract says; why an
    earlier run was discarded goes to `skill-run-observations.json`;
58. `rollback` names which files return to which state and what a revert must
    not disturb, instead of restating that `migration-result.json` records the
    checkpoint SHAs;
59. required manual validation names the environment and the walkthrough's
    route: the order of scenario and `visualParity` ids and the concrete test
    data each needs, never a retelling of the scenarios, because `flow-verify`
    builds every item from the entry itself and no owner is assigned to work
    it out;
60. the run asks nothing it has already answered: neither artifact's
    destination, the run directory, the `flowId`, the validation commands nor
    the checkpoint mode reaches the user as a question;
61. the checkpoint mode is recorded as `disabled` with `pushPolicy: never` and
    stated in one line; `auto-local` is never offered as a choice;
62. the CI configuration is read before any claim about coverage, and a
    measurement CI already takes is recorded as not retrieved for this run
    rather than as unavailable;
63. the manual-validation environment is transcribed from the project
    constants, never asked;
64. every `openQuestions` entry is something this run could not determine; a
    choice it could have made is decided or put to the user, never parked for
    `flow-migrate` to report `BLOCKED` on;
65. a fresh chat is opened through the host's own mechanism, never through a
    second terminal window;
66. `docs\project-constants.md` is read before the survey and the run states
    that it did; nothing on that page reaches the user as a question or lands
    in `openQuestions`;
67. `targetArchitecture` transcribes the framework version, package set,
    compilation and mount mechanism from that page rather than deciding them,
    so a contract carries no blocking open question about how the framework is
    embedded;
68. `dependencyChanges` carries exact `name@version` packages and
    repository-relative `paths`, and `validationPlan.installCommand` says how
    they are applied;
69. `scope.allowedWritePaths` covers all three kinds of write the contract
    asks for: the new framework code, the test directory the
    `characterizationRequired` entries need, and every path
    `dependencyChanges.paths` names;
70. every candidate boundary carries its external importer counts as numbers,
    all four criteria answered in writing, its measurable neighbour and its
    existing test evidence, in plain text with no escaped newlines;
71. the boundary question shows the chosen candidate's write allowlist and asks
    in the same breath whether anything in it is off limits;
72. the observation sidecar is named `skill-run-observations-flow-baseline.json`
    so a later phase in the same run directory cannot overwrite it;
73. the continuation offers exactly three routes — open the next phase now
    using the host's own mechanism, show the invocation to paste, or save it in
    the run directory as a resumable checkpoint — and never opens a second
    terminal window;
74. a scenario names concrete values a tester can act on, never a category such
    as "a robot with FeedPush capability" that a later phase has to resolve;
75. artifact pointers come from a script (`seed-work-item.mjs`,
    `new-observations.mjs` or `hash-artifact.mjs`), never from digests computed
    by hand;
76. a saved continuation prompt found in the run directory is reported in one
    line and resumed from, not treated as a second run.
77. the flowId, run directory, runId, earlier handoffs, saved prompts, product
    status and terminating commands come from `run-context.mjs`, not from hand
    derivation, and the run directory and runId are the `flow.claimed` ones
    `--claim` returns;
78. artifact shapes come from `print-shape.mjs` on the example chain; no whole
    example file and no schema is read to learn a shape;
79. `references/flow-contract.md` is read when the contract content is recorded,
    and `docs\flow-work-item-steps.md` and `docs\flow-observation-capture.md`
    at their own steps, never all at the start;
80. a rerun's work-item snapshot is seeded with `seed-work-item.mjs` and
    finalized with its `--finalize`, so settled text is never retyped and
    actions and Story progress are never set by hand;
81. the continuation invocation comes from `continuation.mjs` and the
    observation sidecar from `new-observations.mjs`;
82. the worktree comparison is `run-context.mjs --compare`, which also catches a
    further change to a file that was already dirty, and it writes nothing into
    the run directory;
83. every `characterizationRequired` entry names the scenarios it blocks as a
    `proveBefore` array of declared scenario ids.
84. an invocation that names a `migration-map.json` takes the `flowId` from it
    and reads only that slice's entry and the prerequisites it requires; the
    map's cut is one of the boundary candidates, never the boundary itself,
    and choosing another is recorded in `decisions`;
85. a prerequisite the map marks `built` is reused unchanged, and one this
    slice builds lands at its measured `target`, whose folder the allowlist
    then contains;
86. importer searches leave tests and stories out, as `migration-map.mjs`
    does, so the contract and the map count the same way;
87. when a migration map proposed the slice, the allowlist's folders for the
    new Angular code are the slice's measured `angularTargets`, taken from the
    map's metrics rather than derived from the structure's rules by hand;
88. an invocation that names no flow runs `run-context.mjs --ready` and puts
    the available slices to the user, queued ones first, with each one's
    reason, the unbuilt prerequisites it shares with an active slice and
    whether the product moved since the map, and waits for a choice even when
    one slice is queued; with none available it names `/flow-plan` and stops;
89. every run claims its slice with `run-context.mjs --claim` after the user
    confirmed it and before the survey, a flow the user named included, so two
    chats never baseline one slice; a refused claim offers the next available
    slice rather than taking the held one;
90. a run abandoned before it wrote anything frees its slice with `--release`,
    which removes only an empty run directory.
