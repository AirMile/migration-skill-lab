---
document: orchestrator-decomposition-research-prompt
version: 0.1.0
status: draft
date: 2026-09-11
---

# Research prompt: dividing the codebase for the orchestrator

Run this in a fresh Copilot CLI chat with Claude Opus 5, started the same way
as the flow skills so it can read both the product and the lab, by typing:

`Read C:\Project\migration-skill-lab\docs\orchestrator-decomposition-research-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this research exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

The lab has four skills that migrate one bounded slice at a time:
`flow-baseline` -> `flow-migrate` -> `flow-verify`, with `flow-debug` as the
repair loop. Each chain starts with a person naming "the flow". Nothing holds
the whole application yet: what the units of work are, which shared
infrastructure blocks them, and in what order they can land. A new read-only
skill, the orchestrator, will hold that overview and hand `flow-baseline` its
next slice. `flow-verify` already ends a `PASS` by asking for the next flow;
the orchestrator is what answers.

Your job is to produce the evidence that skill will be designed from. You are
not designing the skill and not planning the whole migration. You answer: what
is the best way to divide this codebase into units of migration work, how that
division can be derived repeatably, and what the orchestrator must know to
keep it current.

A working hypothesis to test, not to confirm:

- Epic: the whole migration (Targetprocess 522482).
- Feature: one page or route. The board already has Feature 522511, "Migrate
  Map Making Page".
- Slice, which is one User Story: one baseline-migrate-verify chain that
  mounts one Angular island inside a retained React parent. Story 522512,
  "Migrate Detail Drawer", is the only finished one: the LineForm Length, Angle
  and Fence offset fields.
- Task: baseline, implementation and verification per Story.

Targetprocess has only Feature and User Story between Epic and Task, so any
extra level the code needs has to fit inside those two.

The hypothesis is vertical: every unit is a piece of user-visible behaviour.
The alternative is horizontal, with units by kind of code (components, hooks,
state, services, utilities) and possibly a pipeline per kind, or a mix of the
two. Nobody has compared them, and only one slice has been done, so treat all
three as open.

## Read first, once

- `<lab>\docs\project-constants.md`: settled decisions, including Angular
  19.2.25, JIT, zoneless change detection and islands mounted through
  `createApplication()` plus `createComponent()` from a React effect. Never
  reopen them.
- `<lab>\.github\skills\flow-baseline\SKILL.md`, workflow steps 2 and 3: the
  rendered-surface inventory and the four slice criteria (one owner, no shared
  infrastructure in the write allowlist, a measurable `retain-react`
  neighbour, bounded branches). Every slice you propose must be able to pass
  them.
- Only the `scope` and `decisions` blocks of
  `<lab>\examples\handoff\detail-drawer-line-edit\flow-contract.json`: the one
  slice done so far, the candidates it rejected and what it left for later.
- `<lab>\.github\skills\migration-analyze\references\target-angular-architecture-and-structure.md`:
  the target folder structure is unresolved and belongs to the Frontend
  Chapter. Its open question stays open.

## Boundaries

- The product repository is read-only: no edits, generated files, installs,
  builds, test or coverage runs, branches, stashes or commits. Record
  `git rev-parse HEAD` and `git status --porcelain` at the start and the end,
  and report any delta without reverting it.
- Write only the report named under Deliverables and files under
  `<lab>\runs\<YYYY-MM-DD>-decomposition-research-1\`.
- Take counts over many files (importers per module, imports that cross a
  feature border, routes) from one dependency-free Node script you write in
  that run directory, never from counting by hand: a hand count over hundreds
  of files is not repeatable, and the orchestrator will need the same numbers
  on every run. Resolve the `tsconfig` path aliases. Use no npm packages. Keep
  the script and its JSON output; it is a candidate lab script.
- Cite file and line for every confirmed claim and label each conclusion
  `Confirmed`, `Inference` or `Open question`. Copy no source into the report.
- Decide nothing the Frontend Chapter owns: Angular folder structure,
  state-management tooling, shared-library location. Name the question and
  move on.
- Work breadth first. Read entry points, the router, top-level folders and
  directory listings; open a file only where it decides a boundary. Go deep
  only in the three sample features of question 3.

## Research questions

### 1. Architecture map

How the application is layered: entry point, providers (Auth0, SignalR, the
Maui host bridge, theming, i18n), router and route table, top-level folder
structure, state (stores, contexts and hooks that own data), data access, and
the cross-cutting modules the project seed calls risky: SVG and drawlib
ownership, history and undo-redo, persistence, keyboard shortcuts and custom
forms. Give one diagram (Mermaid is fine) and one table of module, role and
citation.

### 2. Decomposition axis

Compare these ways to divide the application, plus any the code suggests:

- vertical: by route or page, by top-level source folder, by business domain;
- horizontal: by kind of code, such as components, hooks, state, services and
  utilities;
- hybrid: vertical slices as the main unit, with some horizontal kinds of work
  planned as their prerequisites.

For each, from the script's output:

- the unit list and each unit's size in files and rendered components;
- coupling: imports that cross unit borders, and state sources shared between
  units;
- verifiability: whether each unit can be proven on its own and by what
  evidence (a walkthrough in the real host, a side-by-side in Storybook,
  tests), or only once a later unit uses it;
- ownership: whether each unit maps to one owner and one Targetprocess
  Feature;
- whether a unit is so large that its slices need a grouping between Feature
  and Story, and how that would sit on a board that has no such level.

Also measure how much of the code is framework-agnostic: files that import
nothing React-bound (`react`, `react-dom`, `styled-components` or any other UI
package), directly or through their own imports. Angular can import such code
as it is, so it may need no migration at all; say whether that holds here and
how large the share is.

Recommend one axis and say why each rejected axis lost.

### 3. Slices inside a feature

Take three features: one simple, one stateful and one high-risk (drawlib,
history or the host boundary). Make the Map Making Page one of them unless the
evidence argues against it, because it already has a finished slice. For each:

- the containment tree down to where controls render: the component tree, not
  the file tree;
- the candidate slices, each checked against the four `flow-baseline` criteria,
  saying where it fails;
- the order they must land in. `flow-migrate` never replaces a React parent
  until every child it renders is migrated, so migration runs leaf first and a
  parent becomes its own slice once its children are Angular. Describe what
  that parent step involves: several islands, each its own
  `createApplication()`, collapsing into one Angular component tree;
- a workable slice size in surfaces, branches and files, using the Detail
  Drawer slice as the reference point.

### 4. Shared infrastructure

List the modules imported by two or more features, above a threshold you
justify. The first slice found `FocusNumberInput` with 12 external importers
and the RadioButton family with 26. Classify each as a design-system
primitive, shared hook or utility, state source or host bridge. For each
class, weigh three options with evidence:

- reimplement its appearance and behaviour inside every slice that needs it,
  as the first slice did;
- give it a dedicated slice that builds one Angular counterpart in a new
  shared location;
- keep it React until last.

Count how many of question 3's candidate slices need each primitive: that
count decides whether duplication is tolerable.

### 5. Adapters and state across slices

Every slice declares an adapter (inputs, commands, events) to the React state
it reads and writes. Find the state sources that several candidate slices
would touch. Check whether islands on one page would each need their own
bridge to the same store. Name the adapters the orchestrator should plan once,
before the first slice that needs them, instead of letting each slice invent
its own.

### 6. High-risk concerns

For drawlib and SVG, history, the Maui host, Auth0, SignalR, routing and
persistence: which features touch it, whether a slice that touches it can stay
bounded, and whether it needs its own prerequisite track.

### 7. End state

What stays React longest: the shell, the router and the providers. What must
be true before routing can move to Angular, and what the last slices look
like. This only needs to show that the orchestrator's final phase exists and
what it contains; do not plan it.

### 8. Kinds of work

From questions 2 to 7, list the kinds of work the migration contains: at least
flow slices, shared primitives, adapters to shared state, framework-agnostic
code and the shell and router, plus any others you found. For each kind:

- how many units it has, from the script;
- how it is proven: the evidence that shows it works, and whether that
  evidence exists before a flow slice uses it;
- whether the four flow phases fit it as they are, fit with a variant (for
  example a contract that declares its kind and swaps the verification
  evidence), or need a pipeline of their own. Say which phase differs and
  how: a kind that differs only in its evidence is a variant, not a new
  pipeline.

Base every answer on this codebase and the one finished slice, and label as
`Inference` what only a real attempt could settle.

### 9. What the orchestrator needs

Derive this from questions 1 to 8:

- the decomposition method as ordered steps, each marked deterministic (a
  script can do it) or judgement (the model or the user);
- which kinds of work it plans, and where each lands relative to the flow
  slices that depend on it;
- what it must persist per unit of work so that `flow-baseline`
  starts from it instead of rediscovering it, and which of those fields go
  stale as slices land or the code moves (a verification `PASS`, a new
  importer, a renamed route);
- how it learns what has landed from the lab's artifacts, such as a `PASS` in
  `verification-result.json`, and what those artifacts cannot tell it;
- which choices only a person can make, and so must be asked;
- the smallest first version worth building.

## Deliverables

1. The report, at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-codebase-decomposition-research.md`,
   the approved place for confidential analyses. Sections in this order: a
   summary of what you recommend in at most ten lines; questions 1 to 9, one
   section each; open questions; method notes covering what you read, what the
   script measured, what you sampled instead of reading, and what you would do
   differently next time.
2. In the run directory: the script, its JSON output and the start and end
   product status.
3. In the chat: the summary and section 9, nothing else.

Before delivering, check that every `Confirmed` claim has a citation, every
count comes from the script, the horizontal and hybrid axes were measured
rather than dismissed, no Frontend Chapter decision is presented as made, the
product status is unchanged and no source was copied. Correct every failure
first.
