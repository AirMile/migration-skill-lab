---
document: skill-acceptance-criteria
skill: flow-baseline
targetVersion: 0.31.0
status: experimental
date: 2026-09-15
---

# `flow-baseline` v0.31.0 acceptance criteria

## Hard gates

A run fails immediately if it changes the product repository, invents a
selected flow, omits a material uncertainty, makes an uncited confirmed
repository claim, writes a contract as approved without human approval, starts
an implementation run the user did not choose, puts a path in the write
allowlist the slice does not need, or stores sensitive content.

## Required output

- Without a migration map, two or three candidate boundaries put to the user
  after the survey, each with
  its migrate set, retained neighbours, external importers, conditional branches
  and existing test evidence, judged against the four slice criteria.
- The chosen boundary with explicit exclusions and confidence, recorded as a
  `decisions` entry naming the rejected candidates.
- A behavior baseline covering applicable success, error, state, side-effect
  and cleanup behavior.
- A cited evidence ledger with `Confirmed`, `Inference` and `Open question`.
- Existing relevant tests, their proved behavior and prioritized evidence gaps.
- One `flow-contract.json` at schemaVersion 8 that validates against the
  handoff schema, carrying `renderedSurfaceInventory`, `targetArchitecture`,
  `userStory` and per `visualParity` entry the `styleSources` and
  `sharedComponents` from `style-sources.mjs`, with no `status`, no `approval`, no
  `targetArchitecture.status` and no `workItemContext`.
- No analysis report, no User Story file and no other file beyond the
  contract and the observation artifact, in
  the run directory `run-context.mjs --claim` created at the start.
- A before/after Git-visible product worktree comparison.
- A schema-valid observation artifact written after the primary artifacts,
  including an empty observation list when no concrete skill signal occurred.
- The slice's User Story, printed by `render-user-story.mjs` from the
  validated contract and pasted into a chat message, not left in collapsed
  tool output.
- A bounded Detail Drawer target-architecture proposal that does not mirror
  React mechanically or redesign the full frontend.
- A disabled or explicitly human-approved checkpoint policy with exact branch,
  external reference and push policy.
- A machine-readable validation plan and rollback; approval is impossible
  while required test, typecheck, build or host details are absent.
- One review summary: the review facts `render-user-story.mjs` prints after
  the Story (partial mount, remainder, surface inventory, scenarios, required
  characterization, visual-parity surfaces, the write allowlist verbatim,
  validation commands, manual verification, rollback, checkpoint policy,
  decisions and open questions), pasted in the same message, plus the
  architecture boundary and adapter in a few lines. It asks for no reply,
  authorizes nothing, and restates no confirmed behavior, because a citation
  is checked by opening it.
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
9. it never updates Targetprocess;
10. it records no board ID, Epic, Feature, Task, board state or progress, and
    asks for none;
11. it creates no product or empty checkpoint commit in the read-only phase;
12. it builds the review summary from the review facts `render-user-story.mjs`
    prints from validated contract fields rather than from prose;
13. it never sets or claims to set the host plan mode, and defers its artifact
    writes until plan mode is exited when the session already runs in it;
14. it opens a `flow-migrate` chat only on the user's explicit route choice and
    never continues or delegates the migration itself.
15. it proposes one User Story per slice and no Tasks, so technical
    checkpoints never reach the board;
16. the User Story's acceptance criteria come from the contract's scenarios
    and visual parity entries, never typed separately;
17. the User Story's attention points come from the characterization
    hypotheses, open questions, the slice remainder and the manual
    verification environment;
18. browser automation and Maui host smoke validation stay separate.
19. a possible behavior improvement triggers one explicit preserve/include/
    follow-up choice and remains open until answered.
20. it never edits an earlier run's artifacts; a changed boundary, allowlist or
    scenario is a new run.
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
25. it shows `render-user-story.mjs` output verbatim in the chat rather than a
    paraphrase, so the Story comes from the validated contract;
26. it declares `scope.partialMount` explicitly from schemaVersion 4, including
    a deliberate `nested: false`, rather than omitting the field;
27. `userStory` holds only the prose the script cannot derive: a title, the
    user value, and the current and desired behavior, without citations;
28. a rerun for the same flow writes a new contract with its own `userStory`
    rather than editing the earlier run's;
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
33. the User Story describes the slice, not the run: what this run did belongs
    in the review summary.
34. it writes the contract and the observation artifact and nothing else, and never a prose document that duplicates a
    validated artifact;
35. the target architecture reaches `flow-migrate` inside the contract rather
    than being re-elicited from the user;
36. confirmed current behavior is cited, not restated, so the contract cannot
    silently disagree with the source it describes.
37. every validation command it records terminates; a watch-mode script is
    never recorded as a test command;
38. `scope.allowedWritePaths` contains a location for the new Angular code, and
    every existing path in it was checked for consumers outside this flow;
39. the contract carries no `workItemContext` and no board ID of any kind;
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
    as an input before the survey can show what each candidate costs; a map
    slice supplies only its ceiling;
46. every surface rendered by its own component has its importers outside this
    flow searched and cited, because that is what makes a boundary judgeable;
47. the chosen and rejected candidates are recorded in `decisions`, so a later
    reader can see which cuts were considered and why one won.
48. an unresolved mount or embedding mechanism is recorded as an open question
    that `flow-migrate` reports `BLOCKED` on, and is never described away as
    covering only the behavior baseline;
49. the baseline is complete when the analysis is, because no gate is left to
    hold it open;
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
71. without a migration map, the boundary question shows the chosen
    candidate's write allowlist and asks in the same breath whether anything
    in it is off limits;
72. the observation sidecar is named `skill-run-observations-flow-baseline.json`
    so a later phase in the same run directory cannot overwrite it;
73. the continuation offers exactly three routes — open the next phase now
    using the host's own mechanism, show the invocation to paste, or save it in
    the run directory as a resumable checkpoint — and never opens a second
    terminal window;
74. a scenario names concrete values a tester can act on, never a category such
    as "a robot with FeedPush capability" that a later phase has to resolve;
75. artifact pointers come from a script (`new-observations.mjs` or
    `hash-artifact.mjs`), never from digests computed by hand;
76. a saved continuation prompt found in the run directory is reported in one
    line and resumed from, not treated as a second run.
77. the flowId, run directory, runId, saved prompts, product
    status and terminating commands come from `run-context.mjs`, not from hand
    derivation, and the run directory and runId are the `flow.claimed` ones
    `--claim` returns;
78. artifact shapes come from `print-shape.mjs` on the example chain; no whole
    example file and no schema is read to learn a shape;
79. `references/flow-contract.md` is read when the contract content is recorded,
    and `docs\flow-observation-capture.md` at its own step, never both at the
    start;
80. the User Story comes from `render-user-story.mjs`, so its acceptance
    criteria and attention points are never typed by hand;
81. the continuation invocation comes from `continuation.mjs` and the
    observation sidecar from `new-observations.mjs`;
82. the worktree comparison is `run-context.mjs --compare`, which also catches a
    further change to a file that was already dirty, and it writes nothing into
    the run directory;
83. every `characterizationRequired` entry names the scenarios it blocks as a
    `proveBefore` array of declared scenario ids.
84. an invocation that names a `migration-map.json` reads only that slice's
    entry and the prerequisites it requires; the map's cut is the ceiling of
    the boundary, never the boundary itself;
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
    one slice is queued; when it reports `replan` it names `/flow-plan` and
    stops;
89. every run claims its slice with `run-context.mjs --claim` after the user
    confirmed it and before the survey, a flow the user named included, so two
    chats never baseline one slice; a refused claim offers the next available
    slice rather than taking the held one;
90. a run abandoned before it wrote anything frees its slice with `--release`,
    which removes only an empty run directory.
91. a slice from a migration map, named by the invocation or confirmed from
    `--ready`, keeps the map slice's `flowId` verbatim, never a slug of its
    title, because `--ready`, the claim and the seed match on it;
92. when a map names the slice, no boundary question is asked, and the cut is
    the largest within the slice's ceiling that meets all four criteria,
    never a broader one;
93. `planSlice` is recorded whenever the slice comes from a map, and its
    `remainder` is `null` only when the whole slice migrates;
94. a run on a slice whose `--ready` entry carries a `remainder` cuts from
    that remainder;
95. no board ID, Epic, Feature, Task, board state or progress reaches the user
    as a question.
96. the observation sidecar is written last, after the chosen continuation
    route, so it can record a step the run skipped.
97. every value the slice receives from outside Angular (a store subscription,
    a socket event, a timer, a promise) has one `targetArchitecture.lifecycle`
    rule naming its source and the signal it is written into.
98. right after its claim it makes the run's branch and worktree with
    `slice-worktree.mjs --create`, and every later step, `repository.root`
    and the continuation use that worktree as the product root, never the
    integration checkout;
99. an abandoned claim releases both the run directory and the clean worktree
    and branch, and a worktree holding changes is never removed.
100. every `migrate` surface's `visualParity` entry carries the `contract`
     block `style-sources.mjs` printed for that surface, verbatim, with its
     `unparsed`, `unresolved` and `packages` entries read by hand, and never
     style citations or shared components typed from its own reading;
101. a shared component a migrated surface renders through is reused when its
     counterpart is built and otherwise built by the slice at its measured
     target, which the allowlist covers; the slice never re-creates it in its
     own folder.
