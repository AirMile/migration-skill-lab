---
document: project-seed
version: 0.1.0
status: approved-for-foundation
date: 2026-09-02
---

# React-to-Angular Migration Skill Lab

## One-line pitch

Build a small, evidence-first Copilot workflow that can establish what an
existing React feature does before anyone plans or implements its Angular
replacement.

## Problem

The React application is large and contains coupled state, SVG/DOM ownership,
Maui host integration, Auth0, SignalR, custom forms, routing, persistence, and
undo/redo behavior. A migration can look correct while losing side effects,
error paths, shortcuts, cleanup, or host contracts.

The public `AirMile/claude-config` repository contains useful workflow ideas,
but its broad project, dashboard, worktree, orchestration, and merge behavior
is not a safe runtime dependency for this internal migration research.

The immediate need is therefore not a general development platform. It is a
small, versioned research workflow that produces reviewable evidence without
changing the product repository.

## Desired outcome

The first future skill, `migration-analyze` v0, analyzes one user-selected
feature and returns:

1. the feature boundary;
2. the existing behavior baseline;
3. a dependency map;
4. an evidence and contradiction overview;
5. test gaps;
6. a risk classification;
7. open questions and required owners.

The output must be useful as input for a later migration decision, plan, and
behavior-parity check. It is not an implementation plan by itself.

## Users

- Primary: the migration researcher performing the Lely internship.
- Reviewers: React developers, Angular developers, testers, and the stage
  supervisor.
- Later consumers: `migration-plan`, `migration-review`, and only after
  explicit approval a tightly scoped implementation workflow.

## Confirmed context

- The product uses React 18, TypeScript, Vite, Vitest, Testing Library,
  Storybook, `styled-components`, Auth0, SignalR, SVG.js, and a Maui host
  integration.
  Source: `C:\Project\frontend\package.json`,
  `C:\Project\frontend\vite.config.ts`.
- The build command performs TypeScript checking before the Vite build.
  Source: `C:\Project\frontend\package.json`.
- The repository has React conventions enforced or documented through
  TypeScript, ESLint, Prettier, tests, and contributing documentation.
  Source: `C:\Project\frontend\tsconfig.json`,
  `C:\Project\frontend\.eslintrc.cjs`,
  `C:\Project\frontend\.prettierrc`,
  `C:\Project\frontend\docs\contributing.md`.
- React-team input dated 2 September 2026 contains five concrete provisional
  review rules and a separate set of general review questions.
  Source:
  `C:\Obsidian\Notes 2025\Lely\Angular migratie - conventions onderzoek.md`.
- Angular target conventions have not yet been confirmed by Bernhard or a
  representative Angular team.
- GitHub Copilot supports project skills in repository skill directories and
  personal skills in `~/.copilot/skills`.
  Source:
  `https://docs.github.com/copilot/concepts/agents/about-agent-skills`.

## Principles

### Evidence before design

The workflow first proves current behavior. It must not invent an Angular
target design to fill a knowledge gap.

### Breadth first, then targeted depth

Start with the selected user flow and its boundary. Follow only relevant
UI, state, service, host, contract, and test edges. Do not load the whole
repository or the full Lely vault by default.

### Progressive disclosure

Keep the future `SKILL.md` small. Load a reference only when its topic is
needed. Point to source files and lines instead of copying full code into
run state.

### Human gates

Humans approve scope, conventions, benchmark interpretation, skill changes,
and every transition to a writing workflow.

### Explicit contracts

Every skill version declares:

- trigger and required inputs;
- files and sources it may read;
- locations it may write;
- output schema;
- forbidden side effects;
- stop conditions;
- acceptance and benchmark criteria.

## Current implementation status

`migration-analyze` v0.1.0 remains preserved as a reviewed read-only benchmark
reference. The source repository also contains experimental `flow-plan`
v0.4.0, `flow-baseline` v0.31.0, `flow-migrate` v0.21.0, `flow-verify` v0.21.0,
`flow-debug` v0.10.0 and `migration-skill-audit` v0.1.0, with versioned
handoff schemas, scoped checkpoint preflight, examples and the scripts that
perform the deterministic steps of a run. The flow skills are installed as
personal runtime snapshots under `~\.copilot\skills`.

A representative POC slice, the Detail Drawer LineForm Length, Angle and Fence
offset fields, ran baseline, migrate and verify end to end on 2026-09-09 with
an overall `PASS`; its artifact chain is `examples\handoff\detail-drawer-line-edit\`.
Use `backlog\backlog.json` for current item status.

## Scope of the original foundation

- A local, internal Git repository at
  `C:\Project\migration-skill-lab`.
- No remote and no commits.
- This seed and prior acceptance criteria.
- A canonical, versioned backlog.
- A standalone, generated, read-only HTML backlog snapshot.
- A pinned record of the read-only upstream design source.

## Non-goals of the original foundation

- At foundation time, do not create `migration-analyze` yet.
- Do not create or migrate multiple skills.
- Do not implement or migrate product features.
- Do not modify `C:\Project\frontend`.
- Do not install dependencies.
- Do not build a server, editable dashboard, database, or sync service.
- Do not configure model routing, hooks, worktrees, automatic commits,
  merges, or publication.
- Do not extrapolate Angular conventions from React rules.

## Proposed architecture

### Source of truth

The local lab repository owns versioned source, schemas, acceptance criteria,
and the research backlog.

### Runtime publication

After a future skill passes review, copy a pinned snapshot to its matching
skill folder:

`C:\Users\miles.zeilstra\.copilot\skills\<skill-name>`

Do not use a live symlink. Record the source version in both locations.

### Product repository

`C:\Project\frontend` remains a separate read-only analysis target for
`migration-analyze`. The skill must never create state or artifacts there.

### Confidential run reports

`flow-baseline` writes no report; its contract is the durable artifact and
its review summary in the chat is the review surface. Canonical confidential
reports from the phases that still produce one are stored under:

`C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses`

Reports are retained until explicit human cleanup. The ignored local `runs\`
folder may contain only compact, non-sensitive benchmark metrics and
checkpoints. The product repository never stores analysis artifacts.

## Convention model

Keep three layers separate:

1. current React conventions;
2. confirmed Lely Angular conventions;
3. an approved migration rulebook.

For the current React layer, distinguish:

- concrete provisional rules that can be checked;
- general review questions that require judgment;
- unknown or contradictory rules that need an owner.

Until Angular input is confirmed, missing target rules remain
`Open question`. This must not block a read-only baseline of current React
behavior, but it does block target-design claims.

## Backlog model

`backlog\backlog.json` is canonical. Each item has:

- a stable ID;
- type, status, and phase;
- a testable description;
- dependencies;
- evidence value and delivery risk;
- acceptance criteria;
- source references;
- explicit open questions.

`backlog\backlog.html` is generated from that JSON. It is a standalone
read-only snapshot for people, not a second editable source.

## Why there is no backlog server

The useful pattern from `AirMile/claude-config` is separation between data
and presentation. Its server, dashboard editing, copy actions, status
transitions, and broader project runtime solve a larger problem than this
research needs today.

A static viewer:

- opens offline;
- can be shared through approved internal channels as one file;
- has no long-running process or network surface;
- does not require dependencies;
- can be replaced later without changing the canonical JSON.

## Experimental skill sequence

### 0. `flow-plan`

Read-only for the product repository. It keeps the migration map: features,
candidate slices with their dependencies, and the shared components and state
adapters those slices import, measured by a script rather than counted by
hand. It proposes the next slice for the user to choose and hands it to
`flow-baseline`; a `PASS` from `flow-verify` comes back to it. It moves no
board item.

### 1. `flow-baseline`

Read-only for the product repository. It establishes a behavior baseline and
draft Flow Contract for one human-selected flow. `migration-analyze` v0.1.0 is
retained as the earlier benchmark reference. It also shows the slice's User
Story for the board and records any explicitly approved checkpoint policy.

### 2. `flow-migrate`

May write only within a human-approved Flow Contract. It first adds missing
React characterization tests, then implements the smallest Angular slice and
records its result. Approved `auto-local` mode creates only green, scoped
local checkpoint commits and never pushes. Missing target conventions are
recorded as limitations;
missing explicit scope, write allowlist, rollback or validation commands block
the run.

### 3. `flow-verify`

Read-only independent verification of the same Flow Contract. It reports
`PASS`, `FAIL` or `BLOCKED` per criterion and returns diagnoses to
`flow-migrate`; it never repairs product code itself. After complete PASS and
required host validation, it may offer one explicitly confirmed push of the
approved featurebranch. No phase tracks board state or progress; the user
moves the Story.

### 4. `flow-debug`

Consumes a repairable verification failure in a fresh context, selects the
cheapest valid `immediate`, `light` or `heavy` route, uses at most one attempt
per tier and returns repaired candidates to a new independent verification.
It never debugs external blockers or declares PASS.

## Decision gates

### Gate 0: Foundation accepted

- Repository boundaries are explicit.
- Backlog and viewer validate.
- No product or external writes occurred.

### Gate 1: Analyze contract accepted

- Inputs, reads, writes, output schema, stop conditions, and acceptance
  criteria are reviewed.
- Run-report storage is approved.

### Gate 2: Three benchmarks pass

- One simple, one stateful, and one high-risk case meet the score threshold.
- Human review finds no unsupported Angular assumptions.
- All confirmed repository claims have source citations.

### Gate 3: Plan skill justified

- Analyze output is stable enough to act as an input contract.
- Angular target conventions needed for the selected slice are approved or
  explicitly unresolved.

### Gate 4: Writing workflow justified

- Behavior parity, rollback, allowed files, validation commands, and human
  review are agreed.
- The team explicitly permits product writes.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Broad Claude port hides unsafe assumptions | Port only proven primitives and rewrite for Copilot |
| Personal skill drifts from source | Publish reviewed, versioned snapshots only |
| Backlog HTML and JSON drift | Generate HTML and verify checksum with `--check` |
| Missing Angular conventions become guesses | Force `Open question`; block target claims |
| Analysis loads too much confidential context | Progressive, feature-scoped reads |
| Reports copy source code | Store citations and short evidence summaries only |
| Skill optimizes itself during a run | Propose improvements; require later human approval |
| Visual backlog becomes a product project | No server or editing until usage proves the need |

## Open questions

1. Who owns the future private Lely remote and which namespace is approved?
2. Which stateful and high-risk features will be benchmarked after the simple
   case?
3. Which Angular teams and repositories are representative?
4. Which Angular conventions are organization-wide and which are team-local?
5. Is an additional VS Code skill location approved in the Lely environment?
6. Which cost, token, and human-review metrics can be measured reliably?

## Upstream design pin

Read-only design source:

`https://github.com/AirMile/claude-config/tree/a25190fb494efa37ce09f3377cae994d33db9529`

Patterns considered:

- `project-seed`: scope, assumptions, critique, human decision;
- `project-plan`: dependency graph, priority, coverage checks;
- `dev-ship`: explicit contracts, checkpoints, separated verification;
- `dev-manual`: durable manual-verification handoff;
- `core-setup` mature/audit: existing-project discovery and non-destructive
  findings.

Not adopted:

- Claude-specific task and workflow tools;
- automatic decisions in place of material user choices;
- worktrees, commits, merges, finalize flows, and publication;
- dependency and configuration installation;
- local backlog server and editable dashboard;
- Unix-specific paths and model routing.
