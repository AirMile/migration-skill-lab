---
document: angular-best-practices-audit-research-prompt
version: 0.1.0
status: draft
date: 2026-09-14
---

# Research prompt: auditing and completing the Angular best-practices references

Run this in a fresh Copilot CLI chat with Claude Opus 5, started the same way
as the flow skills so it can read the product, the lab and
`C:\Project\lely-angular-research`, by typing:

`Read C:\Project\migration-skill-lab\docs\angular-best-practices-audit-research-prompt.md and carry out everything below its first horizontal rule.`

Use a web-research tool (for example a Gemini-based research assistant, or
your own web search) for Part B only, as described there. Give that tool the
Part B questions and the product stack from `<lab>\docs\project-seed.md`, never
this whole prompt: without file access it invents the Part A audit and the
product citations (it did on 2026-09-14, see
`<lab>\runs\2026-09-14-angular-best-practices-audit-1\`).

---

## Why this research exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`; the Angular reference material is
`C:\Project\lely-angular-research`.

`migration-analyze` already carries four target-Angular reference files under
`<lab>\.github\skills\migration-analyze\references\`:
`target-angular-architecture-and-structure.md`,
`target-angular-state-management.md`, `target-angular-testing-conventions.md`,
and `target-angular-ui-component-conventions.md`. Each one already states, in
its own "Approval Status" section, that it summarizes evidence gathered on 4
September 2026 from only two external codebases
(`hub-dashboard-ui`, `horizon-architecture-demo`) and two documentation
guides, that it has not been confirmed by the Frontend Chapter, and in
several places names its own open questions and at least one documented
contradiction (an NgRx-shaped folder example with no NgRx dependency in
either inspected codebase).

Two things are still missing before these files can be trusted as skill
input:

1. Nobody has re-checked whether that evidence still holds: whether the
   source files changed since 4 September 2026, whether "Confirmed" labels
   are still justified, and whether the two-codebase evidentiary bar these
   files themselves set is actually met everywhere it is claimed.
2. The four files only cover what was asked at the time: structure, state
   management, testing, and UI/component conventions. They do not claim to
   cover Angular best practices in general (RxJS usage, performance,
   accessibility, dependency-injection strategy beyond `inject()`, error
   handling, forms, routing/lazy-loading, i18n, security), and it is not
   documented which of those areas actually matter for this migration.

Your job is two things, kept separate: audit what exists (Part A), then find
and propose what is missing (Part B), always anchored in what the React
codebase in `C:\Project\frontend` actually does, since a best practice this
migration does not need is not worth adding.

## Read first, once

- `<lab>\docs\project-constants.md`: settled decisions, including Angular
  19.2.25, AOT through `@analogjs/vite-plugin-angular` with a path-based
  `transformFilter`, zoneless, and islands mounted through
  `createApplication()` plus `createComponent()` from a React effect. Never
  reopen them.
- The four existing reference files listed above, in full. Note every
  "Confirmed", "Observed", "Open Questions", and "Confirmed Documented
  Contradiction" section and the exact file-and-line citations behind them.
- `<lab>\.github\skills\migration-analyze\references\current-react-review-criteria.md`
  and `analysis-contract.md`: how the current React conventions are sourced
  and prioritized, and what a `migration-analyze` run is contractually
  expected to read and report.
- `<lab>\.github\skills\migration-analyze\references\post-run-improvement.md`:
  the format the lab uses to log skill-improvement observations, in case this
  research surfaces one.
- `C:\Obsidian\Notes 2025\Lely\Angular migratie - conventions onderzoek.md`:
  the status-label vocabulary (`Enforced`, `Documented`, `Observed`, `Team
  input`, `Proposed`, `Approved`, `Open question`) and the three-layer split
  (current React conventions / Lely Angular conventions / migration
  rulebook) this research must keep using.

Open a Horizon guide, a reference-repository file, or an external Angular
documentation source only where it decides a specific rule, and cite it by
file and line (or URL and section for external sources).

## Boundaries

- The product and `C:\Project\lely-angular-research` are read-only: no edits,
  installs, builds, test runs, branches or commits. Record the product's
  `git rev-parse HEAD` and `git status --porcelain` at start and end and
  report any delta without reverting it.
- Do not edit the four existing `target-angular-*.md` files or any other
  skill file. This research produces a report and proposals; applying them to
  the skill is a separate, later, human-approved step.
- Write only the report named under Deliverables and files under
  `<lab>\runs\<YYYY-MM-DD>-angular-best-practices-audit-1\`.
- Label every claim `Confirmed`, `Observed`, `Team input`, `Proposed`, or
  `Open question` per the vocabulary above; cite every `Confirmed` and
  `Observed` claim with file and line (or URL and section); copy no source
  text longer than a short quotation into the report.
- Keep external, non-Lely Angular best-practice sources (official Angular
  docs, `angular.dev`, widely cited style guides, Gemini/web research output)
  clearly separated from Lely-internal evidence in every section. Never let
  an external source silently outrank `HorizonUICodeReview.md` or the two
  inspected Lely codebases; if they conflict, report the conflict.

## Part A: quality audit of the four existing reference files

For each of the four `target-angular-*.md` files, answer:

1. **Currency**: using `git log` / file timestamps in
   `C:\Project\lely-angular-research`, has any cited source file changed
   since 4 September 2026? List every citation whose underlying file or line
   range no longer matches what the reference claims.
2. **Evidentiary bar**: the files' own source-priority order requires ≥2
   independent codebases before a pattern is treated as more than
   illustrative. For every claim labeled as if it were a multi-codebase
   pattern, verify it was actually checked in both `hub-dashboard-ui` and
   `horizon-architecture-demo`, not just one. Flag any claim that overstates
   its evidence.
3. **Contradictions still open**: re-verify the NgRx-folder-example
   contradiction (state-management and architecture files) and any other
   documented contradiction. Are they still unresolved? Has the Frontend
   Chapter recorded a decision anywhere since (check
   `<lab>\docs\project-seed.md` and the Obsidian analyses folder for a later
   approval)?
4. **Internal consistency across the four files**: do any two of the four
   files make claims about the same topic (for example, folder location of
   state, or test file location) that are not identical or explicitly
   cross-referenced? List every mismatch.
5. **Read-when scope**: each file opens with a one-line "read this only
   when..." scope note. Does the file's actual content stay inside that
   scope, or does it drift into territory another file already owns?

Score each file `Still accurate`, `Partially stale`, or `Needs re-research`,
with the specific reason.

## Part B: gap analysis against general Angular best practices

1. Build a checklist of Angular best-practice areas the four files do not
   claim to cover, at minimum: RxJS usage patterns and subscription hygiene
   beyond what testing-conventions already notes; performance
   (`OnPush`/zoneless-specific pitfalls, given this project is zoneless per
   `project-constants.md`, not the general Angular default); accessibility;
   dependency-injection strategy beyond observed `inject()` usage
   (multi-provider, injection tokens, hierarchical injectors); error
   handling and HTTP interceptors; reactive vs. template-driven forms;
   routing and lazy-loading/guards beyond the one guard example already
   observed; internationalization; template security (sanitization,
   `bypassSecurityTrust*`). Add any other area the evidence suggests.
2. For each area, first check whether `C:\Project\lely-angular-research`
   already has undiscovered evidence (search before assuming it is absent).
   If none exists there, use external, authoritative Angular sources
   (official `angular.dev` guidance first, then widely cited community best
   practices) via web research, and label every such claim `Observed`
   (external) with its source, never `Confirmed` against Lely.
3. For each area, check relevance against the React codebase in
   `C:\Project\frontend`: does the current app actually do something this
   area would replace or constrain (for example, its `styled-components`
   usage relative to Angular styling conventions and the `.scss`/no-hardcoded
   -values rule already in `target-angular-ui-component-conventions.md`; its
   Context/`useSyncExternalStore` state relative to the state-management
   file; its current form handling; its current routing setup; any
   `dangerouslySetInnerHTML`-equivalent or sanitization gap). Cite the
   product file and line for every such claim. Mark an area `Low relevance`
   if the React codebase has no comparable concern, and say why, rather than
   researching it in depth.
4. For every area kept as relevant, recommend whether it becomes a new
   reference file or a section appended to one of the four existing files,
   and give a one-paragraph justification.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-angular-best-practices-audit.md`:
   a summary in at most fifteen lines; Part A as one subsection per file with
   its score; Part B as one subsection per best-practice area with its
   relevance verdict and recommendation; open questions; method notes
   (what was re-checked, what web research was used and how it was kept
   separate from Lely evidence).
2. In the run directory: any intermediate notes, the start and end product
   `git rev-parse HEAD` / `git status --porcelain` output.
3. In the chat: the summary, the Part A scores table, and the Part B
   recommendations table, nothing else.

Before delivering, check that every existing reference file has a score and
a reason, every claimed multi-codebase pattern was actually checked in both
codebases, every external best-practice claim is labeled and sourced
separately from Lely evidence, every kept-relevant gap area cites a specific
React product file and line, and the product status is unchanged. Correct
every failure first.
