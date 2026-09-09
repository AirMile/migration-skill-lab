---
document: skill-acceptance-criteria
skill: flow-baseline
targetVersion: 0.11.0
status: experimental
date: 2026-09-08
---

# `flow-baseline` v0.11.0 acceptance criteria

## Hard gates

A run fails immediately if it changes the product repository, invents a
selected flow, omits a material uncertainty, makes an uncited confirmed
repository claim, writes a contract as approved without human approval, starts
an implementation run the user did not choose, or stores sensitive content.

## Required output

- A feature boundary with explicit exclusions and confidence.
- A behavior baseline covering applicable success, error, state, side-effect
  and cleanup behavior.
- A cited evidence ledger with `Confirmed`, `Inference` and `Open question`.
- Existing relevant tests, their proved behavior and prioritized evidence gaps.
- A draft `flow-contract.json` at schemaVersion 5 that validates against the
  handoff schema, carrying `renderedSurfaceInventory` and `targetArchitecture`.
- No analysis report, no rendered work-item Markdown and no other file beyond
  the contract, the work-item snapshot and the observation artifact.
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
- One approval checkpoint rendered from the validated contract, covering scope,
  partial mount, the surface inventory, the proposed architecture, scenario
  summaries, required characterization, visual-parity surfaces, write allowlist,
  validation commands, rollback, checkpoint policy, decisions and open
  questions, with approve, reject and ask-a-question as the only replies. It
  restates no confirmed behavior, because a citation is checked by opening it.
- An approved successor contract and work-item handoff written only after an
  explicit approval, leaving the draft pair unchanged.
- Exactly one user-chosen continuation: a fresh `flow-migrate` chat opened now,
  the invocation shown for pasting, or the invocation saved beside the report.

## Acceptance check

The source is acceptable when:

1. it requires a human-selected flow, migration-skill-lab root and explicit
   report/run locations;
2. it cannot write product code or tests;
3. it produces a draft, never self-approved, Flow Contract;
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
12. it builds the approval checkpoint from validated contract fields rather
    than report prose, and withholds the approve option while a blocking open
    question is unresolved;
13. it never sets or claims to set the host plan mode, and defers its artifact
    writes until after approval when the session already runs in plan mode;
14. it opens a `flow-migrate` chat only on the user's explicit route choice and
    never continues or delegates the migration itself.
15. it groups technical checkpoints under stakeholder-readable Tasks instead
    of creating one Task per commit;
16. Story progress is derived from Task contributions, never guessed.
17. current board progress is never overwritten by a copy-ready proposal;
18. browser automation and Maui host smoke validation stay separate.
19. a possible behavior improvement triggers one explicit preserve/include/
    follow-up choice and remains open until answered.
20. it preserves draft pending/open wording as immutable history and requires a
    separate approved successor artifact with resolved decisions.
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
42. the approval checkpoint offers a change request as well as approve, reject
    and ask, and a change request produces a successor draft rather than an
    edit to the existing one.
43. `dependencyChanges` follows from the product's own dependency manifest, and
    a missing target framework yields `required: true` with the manifest,
    lockfile, build-config and TypeScript paths;
44. an existing component-rendering harness is named in the validation plan
    rather than an unassigned browser runner proposed beside it.
