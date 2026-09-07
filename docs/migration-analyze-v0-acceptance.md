---
document: skill-acceptance-criteria
skill: migration-analyze
targetVersion: 0.1.0
status: approved
date: 2026-09-02
---

# `migration-analyze` v0 acceptance criteria

These criteria were approved before the skill source was created. They define
the expected behavior of the skill, not its implementation.

## Hard gates

A run fails acceptance immediately when any of these conditions occurs:

1. The skill changes the product repository, Git state, dependencies,
   configuration, external systems, or a skill during its own run.
2. The skill presents an Angular target convention as fact without an
   approved Angular source.
3. A `Confirmed` repository claim has no file and line citation.
4. The report silently omits a required output section.
5. The report stores credentials, tokens, private URLs, full source copies,
   or unnecessary personal data.
6. The feature boundary is ambiguous and the skill continues without asking
   the user one focused question.

## Input contract

### AC-IN-001: Explicit feature

The run has one user-selected feature, user flow, component boundary, or
named behavior to analyze.

### AC-IN-002: Explicit repository root

The product repository root is known and confirmed. The default candidate is
`C:\Project\frontend`, but the skill must not guess when multiple roots are
plausible.

### AC-IN-003: Approved report target

Before writing a report or checkpoint, the skill knows an approved location
outside the product repository. If no location is approved, it returns the
report in chat and records report persistence as an `Open question`.

### AC-IN-004: Scope checkpoint

The skill restates the proposed feature boundary and material exclusions
before deep analysis. It asks only when the ambiguity changes the result.

## Read contract

### AC-READ-001: Progressive repository reads

The skill starts with relevant configuration, entry points, tests, stories,
and documentation. It follows dependencies only when they contribute to the
selected feature's behavior or risk.

### AC-READ-002: Targeted Lely context

The skill may inventory Lely Markdown filenames, but reads only the three
approved core migration documents plus other files or sections that are
demonstrably relevant to the selected feature or an open question.

### AC-READ-003: No broad context copy

The skill records file pointers, line citations, short summaries, and hashes
where useful. It does not copy complete source files into state or reports.

### AC-READ-004: Source priority

For current application behavior, executable tests and enforced
configuration outrank prose documentation. Contradictions are reported
rather than silently resolved.

## Write and side-effect contract

### AC-SAFE-001: Product repository is read-only

No file under the product repository may be created, changed, deleted,
renamed, formatted, generated, staged, committed, stashed, or checked out.

### AC-SAFE-002: No package or environment changes

The skill does not install dependencies, update lockfiles, create virtual
environments, modify environment files, or start persistent services.

### AC-SAFE-003: No external writes

The skill does not create issues, repositories, branches, pull requests,
comments, pushes, uploads, or other external mutations.

### AC-SAFE-004: Approved artifact writes only

If report persistence is approved, the skill writes only the declared report
and compact checkpoint files in that target. It must surface a failed write;
it may not pretend persistence succeeded.

### AC-SAFE-005: No self-modification

The skill never edits its own `SKILL.md`, references, scripts, source
repository, or installed snapshot during a run.

## Required output

The report uses this order and labels omissions explicitly.

### AC-OUT-001: Scope and feature boundary

- user-visible goal;
- start and end state;
- included entry points and code areas;
- explicit exclusions;
- boundary confidence.

### AC-OUT-002: Behavior baseline

- happy path;
- validation and error paths;
- loading, empty, offline, retry, and recovery behavior where applicable;
- keyboard and interaction behavior;
- state mutations and persistence;
- side effects and cleanup;
- observable REST, SignalR, Maui, Auth0, routing, storage, SVG/DOM, or
  undo/redo effects where applicable;
- known existing defects separated from desired behavior.

### AC-OUT-003: Dependency map

For each relevant edge:

- source and target;
- dependency type;
- direction;
- purpose;
- evidence citation;
- confidence;
- whether it crosses the feature boundary.

The report distinguishes compile-time, runtime, state, event, host, network,
storage, visual, and test dependencies.

### AC-OUT-004: Evidence overview

Every material statement is one of:

- `Confirmed`: directly supported by cited source, configuration, test, or
  observed run evidence;
- `Inference`: a reasoned conclusion with supporting citations and an
  explicit validation step;
- `Open question`: unknown, owner, impact, and next evidence needed.

Contradictory evidence is listed in its own subsection.

### AC-OUT-005: Test coverage and gaps

- existing relevant tests and what behavior they prove;
- behavior not covered by automated tests;
- manual checks that are still required;
- tests that appear stale, skipped, contradictory, or too implementation
  coupled;
- recommended evidence priority, without writing tests.

### AC-OUT-006: Risk classification

The report gives an overall `low`, `medium`, `high`, or `critical` risk and
scores these dimensions:

- state and lifecycle;
- external or host integration;
- DOM/SVG ownership;
- behavior and interaction complexity;
- test evidence quality;
- convention uncertainty;
- blast radius and shared dependencies.

Each score includes evidence and a reason. Risk is not inferred from file
count alone.

### AC-OUT-007: Open questions

Each open question includes:

- the unanswered question;
- why it matters;
- the owner or role most likely to answer;
- the evidence needed;
- whether it blocks analysis, planning, or implementation.

Missing Angular conventions do not block analysis of current React behavior.

### AC-OUT-008: Compact machine-readable summary

The report ends with a small versioned summary containing:

- schema version;
- skill version;
- feature ID and repository revision;
- risk;
- evidence counts;
- test-gap count;
- open-question count;
- report location when persisted.

It contains pointers and counts, not source copies.

## Convention acceptance

### AC-CONV-001: Concrete React criteria

Treat these 2 September 2026 React-team inputs as provisional `Team input`,
not approved Angular target rules:

- precise, self-documenting parameter names and types;
- new robot types do not require hardcoded JSX branches in existing forms;
- relevant forms work with keyboard navigation and applicable
  `Tab`, `Enter`, and `Escape` behavior;
- no new `any`;
- no `@ts-ignore`.

### AC-CONV-002: General React review questions

Keep architecture, maintainability, extensibility, state locality,
performance, resilience, and testability as review questions unless a
concrete, sourced rule exists.

### AC-CONV-003: Tooling contradictions

Report that current tooling permits some constructs that the provisional
team input rejects, such as explicit `any` and `@ts-ignore`. Do not claim
that the stricter input is tool-enforced.

### AC-CONV-004: Angular unknowns

Do not map React rules to Angular structure, signals, services, forms,
routing, styling, or testing conventions without approved Angular evidence.
Return missing choices as `Open question`.

## Benchmark cases

The exact feature names are deliberately unset until selected with the user.

| Case | Required characteristics | Primary failure to detect |
|---|---|---|
| Simple | Small boundary, mostly pure or stateless, existing tests | Over-analysis, missed basic behavior, weak citations |
| Stateful | Shared or persistent state, events, recovery or cleanup | Hidden mutations, stale state, lifecycle gaps |
| High-risk | Maui, Auth0, SignalR, SVG/DOM, external store, or undo/redo | Cross-boundary contracts, cleanup, parity blind spots |

### Benchmark procedure

1. Create a human reference analysis before or independently of the skill
   output.
2. Run one case at a time.
3. Confirm the product Git worktree is byte-for-byte unchanged by the run.
4. Review every `Confirmed` claim against its citation.
5. Search for important behavior present in the human reference but absent
   from the skill report.
6. Review all inferences for unsupported target assumptions.
7. Confirm unknowns are visible and assigned an impact.
8. Record retries, loaded context, elapsed time, human review time, and
   corrections.
9. Propose improvements only after the primary report is complete.
10. Re-run all earlier cases after an approved skill change.

## Benchmark score

Score each dimension `0`, `1`, or `2`.

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Citations | Missing or wrong | Minor gaps | All material confirmed claims verified |
| Behavior completeness | Critical paths missed | Non-critical gaps | Reference behavior covered |
| Dependency map | Material edges missed | Small gaps | Relevant cross-boundary edges covered |
| Unknown handling | Guesses or hidden gaps | Some impact missing | Unknowns explicit with owner and impact |
| Test-gap analysis | Misleading | Partial | Existing proof and gaps accurately separated |
| Risk classification | Unsupported | Plausible | Evidence-based and dimensioned |

Acceptance per case:

- no hard-gate failure;
- at least `10/12`;
- no dimension scores `0`;
- human reviewer accepts the report as a planning input.

Acceptance for v0:

- all three cases pass;
- no product changes occurred;
- no unsupported Angular target claims remain;
- earlier passing cases still pass after approved changes.

## Improvement proposal contract

After the primary report, the run may propose at most three improvements:

```text
Observation: concrete failure or friction seen in this run
Effect: how it reduced safety, correctness, cost, or clarity
Proposal: one specific change
Location: exact skill file or resource
Seen: occurrence count across runs
```

The proposal is not authorization. A human must approve it in a later
authoring session before any skill source or installed snapshot changes.

## Definition of ready to author

The skill may be created only after:

- these criteria are reviewed;
- report storage is decided;
- the output summary schema is approved;
- one simple benchmark feature is selected;
- source and runtime versioning is agreed.
