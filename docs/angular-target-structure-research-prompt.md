---
document: angular-target-structure-research-prompt
version: 0.1.0
status: draft
date: 2026-09-11
---

# Research prompt: the Angular target structure

Run this in a fresh Copilot CLI chat with Claude Opus 5, started the same way
as the flow skills so it can read the product, the lab and
`C:\Project\lely-angular-research`, by typing:

`Read C:\Project\migration-skill-lab\docs\angular-target-structure-research-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this research exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`; the Angular reference material is
`C:\Project\lely-angular-research`.

The migration runs in place: each slice mounts Angular inside the retained
React app and is verified there. Where the Angular files go is decided for now
by a provisional rule: an `angular\` folder beside the React original. That
works while both live side by side, but it copies the React layout, and the
finished Angular app will almost certainly be organized differently. Every
file would then move a second time.

The goal is to choose the target structure now, so every slice builds straight
into it. It has to fit Angular and the Lely guidance, and map cleanly from how
the React code is organized today. You propose it; the Frontend Chapter
reviews it. `flow-plan` will then compute every Angular file's location from
your mapping instead of deciding it per case.

## Read first, once

- `<lab>\docs\project-constants.md`: settled decisions, including Angular
  19.2.25, AOT through `@analogjs/vite-plugin-angular` with a path-based
  `transformFilter`, zoneless, and islands mounted through
  `createApplication()` plus `createComponent()` from a React effect. Never
  reopen them.
- `<lab>\.github\skills\migration-analyze\references\target-angular-architecture-and-structure.md`:
  its source priority, the two Horizon folder guides and where they conflict,
  and the patterns observed in Hub Dashboard UI and Horizon Architecture Demo.
  Read `target-angular-state-management.md` and
  `target-angular-testing-conventions.md` beside it only for where state and
  tests live.
- The two decomposition reports in
  `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\`
  (`2026-09-11-codebase-decomposition-research.md`, sections 1, 2, 4 and 5,
  and `-research-2.md`, sections B and C): the product's layers, its 17
  feature folders, the shared components and state sources slices lean on.
- `<lab>\.github\skills\flow-plan\references\migration-map.md`: how the map
  records a slice and a prerequisite, which is what your mapping will feed.

Open a Horizon guide or reference repository file only where it decides a
rule, and cite it by file and line.

## Boundaries

- The product and `C:\Project\lely-angular-research` are read-only: no edits,
  installs, builds, test runs, branches or commits. Record the product's
  `git rev-parse HEAD` and `git status --porcelain` at start and end and
  report any delta without reverting it.
- Write only the report named under Deliverables and files under
  `<lab>\runs\<YYYY-MM-DD>-angular-structure-research-1\`.
- Label conclusions `Confirmed`, `Inference` or `Open question`, cite every
  confirmed claim with file and line, and copy no source into the report.
- Follow the source priority the architecture reference sets: the binding
  review guideline first, then the dedicated guides, then patterns seen in two
  or more codebases. Where you depart from a higher source, say which rule and
  why.

## Research questions

### 1. Candidates

Compare at least these structures, plus any the evidence suggests:

- `core/`, `shared/`, `domains/<domain>/` with `pages/`, `services/`,
  `models/`, per the review guideline;
- `core/`, `user/`, `farm/<subdomain>/`, per the folder-structure guide;
- one library per feature in a workspace, as Horizon Architecture Demo does;
- a flat technical layout, as Hub Dashboard UI does;
- the current provisional rule, an `angular\` folder beside each React
  original, as the baseline to beat.

### 2. Criteria

Judge every candidate against each of these, in writing, saying where it
fails:

- **Lely guidance:** how many binding review rules it satisfies, and which it
  breaks.
- **Deterministic mapping:** every React folder has one obvious target,
  expressible as a rule a script can apply. A mapping that needs a person per
  file fails.
- **Coexistence:** the compiler filter selects Angular files by path, so the
  Angular root must not overlap any React folder. Note that `src\app` is
  already taken by the React entry, providers and routes. React must be able
  to import each island's mount function, and Angular must be able to import
  the framework-agnostic code (`services\restApi`, `modules\drawlib`, the
  `StoreWrapper` stores) where it already lives.
- **Ownership:** one owning team per domain folder, as the review guideline
  requires.
- **End state:** once React is gone, nothing moves again, and there is a
  place for the shell, router and providers that migrate last.
- **Slice fit:** a slice's own files, and each prerequisite it builds, land
  in one folder the write allowlist can name.

Recommend one and say why each other candidate lost.

### 3. The mapping

For the recommended structure, define:

- the Angular root folder and why it cannot collide with React;
- how each React feature folder maps to a domain and a feature folder. List
  every folder under `src\features` from a directory listing, not from
  memory, and give each its domain;
- where design-system components go (`Text`, the radio family,
  `NumberInput`), where React-bound shared hooks and utilities go, where
  adapters over React state go, and where a slice's own components go while
  their React parent is still React;
- where each island's mount code goes: the file React imports to mount a
  component;
- file and folder naming, one component per folder or not, and the test
  location for Angular code;
- what `transformFilter` and `tsconfig.app.json`'s include become;
- what stays outside the Angular root, because it is framework-agnostic and
  Angular imports it as it is;
- where the first slice's files, now under
  `features\floorPlanCreator\detailDrawer\lineForm\angular\`, move to, as a
  one-off relocation while it is the only slice.

### 4. Proof the mapping holds

Write the mapping as an ordered rule list in `angular-structure.json`, first
match wins, with a placeholder per path segment it carries over. Then write
one dependency-free Node script in the run directory that applies it to every
React file path in
`<lab>\runs\2026-09-11-decomposition-research-2\measurements-bcd.json`: the 25
candidate slices' files and every shared file. Report the files no rule
matches and any two files that land on the same Angular path. Both lists must
be empty before you deliver.

### 5. For the Frontend Chapter

List only the choices the Chapter has to confirm, at most five, each with
your proposed answer and the evidence for it, so the review is a yes or a
counterproposal rather than an open question.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-angular-target-structure.md`:
   a summary of the recommendation with its folder tree in at most fifteen
   lines; questions 1 to 5, one section each; open questions; method notes
   covering what you read, what the proof script found, and what you would
   do differently.
2. In the run directory: `angular-structure.json`, the proof script, its
   output and the start and end product status.
3. In the chat: the summary, the mapping table and section 5, nothing else.

Before delivering, check that every React top-level folder and every feature
folder has a rule, the proof script reports no unmatched file and no
collision, every `Confirmed` claim has a citation, no rule depends on a
per-file human choice, and the product status is unchanged. Correct every
failure first.
