---
document: orchestrator-decomposition-followup-prompt
version: 0.1.0
status: draft
date: 2026-09-11
---

# Follow-up research prompt: the counts the first run skipped

Run this in a fresh Copilot CLI chat. Claude Sonnet 5 is enough: the work is
measurement, not synthesis. Start it the same way as the flow skills and type:

`Read C:\Project\migration-skill-lab\docs\orchestrator-decomposition-followup-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this run exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

The first decomposition run is
`C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\2026-09-11-codebase-decomposition-research.md`,
with its script and output in
`<lab>\runs\2026-09-11-decomposition-research-1\`. Its conclusions stand. Its
numbers do not yet, for three reasons:

- the script has two measurement faults, listed under Script fixes;
- its shared-infrastructure list mixes enums, types and constants that Angular
  can import as they are with React components that need a decision;
- it did not count how many candidate slices use each shared component. That
  count decides whether the migration rebuilds those components inside every
  slice or builds one shared Angular version first.

This run fixes the script, reruns it and measures those things. It opens no
new research question and does not revisit the first report's recommendation.

## Read first, once

- The `Boundaries` section of
  `<lab>\docs\orchestrator-decomposition-research-prompt.md`. It applies
  unchanged.
- Sections 2, 3, 4 and 8 of the first report, which hold the numbers this run
  replaces.
- `<lab>\runs\2026-09-11-decomposition-research-1\analyze-decomposition.mjs`.

Leave the first run directory and the first report untouched: they are the
evidence this run is compared against. Work in
`<lab>\runs\<YYYY-MM-DD>-decomposition-research-2\`.

## Script fixes

Copy the script into the new run directory and fix it there:

1. **Type-only imports.** `import type ... from`, `export type ... from` and a
   named import whose every specifier is marked `type` vanish at compile time.
   They must not make a file React-bound, and they are counted separately from
   value imports wherever the script counts edges or importers. A mixed import
   such as `import { type A, B }` stays a value import.
2. **React-boundness.** The recursive walk caches a file inside an import cycle
   as agnostic before the cycle finishes: in `A -> B -> A` with `A -> react`,
   `B` comes out agnostic. Replace it with a breadth-first walk from every
   directly React-bound file over the reverse value-import graph. That walk is
   correct for cycles by construction.
3. **Tests and stories** (`*.test.*`, `__tests__\`, `*.stories.*`) are left out
   of every count, including as importers, and reported as their own totals.
   A test that imports a file does not make that file shared infrastructure.

Add a `--self-test` that builds a small fixture tree in a temporary directory
with the cycle case, a type-only import of a `.tsx` file and a mixed import,
and asserts the outcome of each. The lab's other scripts all have one, and
these are the two faults that went unnoticed.

## Measurements

### A. What changes

Rerun every count the first report cites with the fixed script. Give one table
of old value and new value for: the framework-agnostic share, overall and per
unit; the cross-unit edges of the three sample features; and the top shared
files. Then list each statement in the first report whose number or conclusion
changes, with its section. A change under five percent needs no comment.

### B. Shared infrastructure, split

Take every non-test file with 10 or more cross-unit value importers. For each,
give whether it is React-bound, directly or only transitively. Files that are
not React-bound are reusable as they are: list them, and do not classify them
further. Classify the React-bound ones into the first report's four classes,
with the count per class.

### C. Shared components per candidate slice

A candidate slice is a directory the first report named as one:

- every form directory under `features\floorPlanCreator\detailDrawer\`;
- every form under `features\editPage\routeActionForms\`, including
  `wallFollowForm\`;
- the `overviewPage` candidates from section 3.3 of the first report.

For each candidate, take the union of the value imports of every non-test file
inside its directory, and list which React-bound files outside that directory
it imports. Show a matrix of candidates against those files, with a total per
file across all candidates. Mark the files the finished `lineForm` slice
already rebuilt in Angular (`FocusNumberInput` and the radio family, per the
first report's section 4). Name every file that 5 or more candidates use.

### D. What makes code React-bound

For every directly React-bound file outside `features\*`, count how many other
files are React-bound only through it: files that would become agnostic if
that one file were not. List the top ten. Then answer for `modules\drawlib`:
how many of its files are directly React-bound, how many only transitively,
through which files, and how much of drawlib would be agnostic if
`state\FloorPlanStores.ts` were not React-bound.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-codebase-decomposition-research-2.md`
   with sections A to D and method notes, which name the fixed script's
   self-test result and the start and end product status.
2. In the run directory: the fixed script, its JSON output and the product
   status.
3. In the chat: section A's list of changed statements and the files section C
   names as used by 5 or more candidates, nothing else.

Before delivering, check that every number comes from the fixed script, the
self-test passes, the first run's files are unchanged and the product status
is unchanged. Correct every failure first.
