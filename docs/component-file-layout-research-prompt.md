---
document: component-file-layout-research-prompt
version: 0.1.0
status: draft
date: 2026-09-17
---

# Research prompt: how many files a component is

Run this in a fresh Copilot CLI chat, started the same way as the flow skills
so it can read both the product and the lab, by typing:

`Read C:\Project\migration-skill-lab\docs\component-file-layout-research-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this research exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

`docs\angular-target-structure-research-prompt.md` settled *where* an Angular
file goes, and `scripts\angular-structure.mjs` computes that today. It never
settled *how many files a component is*. A code-quality review of the
`detail-drawer-astronaut-form` slice decided that per slice, on the size of the
component: it recommended against separate `.html` and `.css` files because the
component was small. Size is a judgement, so two slices reviewed a week apart
come out differently and nothing in the lab can check either answer.

Three claims from the lab make the decision unsafe to take from memory. Each is
an `Inference` until you confirm or refute it:

1. **The lab contradicts itself.** `docs\project-constants.md:106` says
   "`templateUrl` and `styleUrl` work; splitting a large component's template
   or styles into files is a per-component call", and
   `docs\project-constants-history.md:54-60` says the old mandatory-inline
   constraint "is gone". Yet the flow contracts still carry "Templates are
   inline in @Component, never a separate .html file, per
   docs\project-constants.md#Compilation", including the baseline for this very
   slice and both examples under `examples\handoff\`.
2. **A harder constraint may be unwritten.** `docs\project-constants.md:103-105`
   says the Angular plugin is off under Vitest and that tests mount through the
   runtime-JIT `createApplication()`/`createComponent()` path;
   `docs\project-constants-history.md:54-57` says an external template under
   pure JIT needs a custom `resourceLoader` that never existed. If both hold,
   `templateUrl`/`styleUrl` compile in the build and break every component
   spec.
3. **No rule exists to follow.** Nothing in
   `.github\skills\migration-analyze\references\` mentions template or style
   file layout, while `scripts\angular-structure.mjs:119` already maps a React
   `X.styles.ts` to `x.component.css` — a separate file. The engine and the
   contract prose therefore point in opposite directions.

Your job is to replace the three claims with evidence, describe how the product
lays out a component today, and recommend one rule. You are not changing any
skill, script, constant or contract, and you are not migrating anything.

## Read first, once

- `<lab>\docs\project-constants.md`, especially Compilation, Embedding and
  Styling, and `docs\project-constants-history.md:44-60`. They are decided;
  never reopen them, but report where the evidence says one of them cannot hold
  as written.
- `<lab>\scripts\angular-structure.mjs`: `angularize()` at lines 104-154 and
  its `expectTarget` self-tests at lines 503-560.
- The `targetArchitecture` bullet in
  `<lab>\.github\skills\flow-baseline\references\flow-contract.md:71-85`, which
  is what puts a styling rule into a contract.
- `<lab>\.github\skills\migration-analyze\references\target-angular-architecture-and-structure.md`
  and `target-angular-ui-component-conventions.md`.

Open anything else only where it decides a specific claim.

## Boundaries

- The product is read-only: no edits, installs, builds, test runs, branches,
  stashes or commits. Record `git rev-parse HEAD` and `git status --porcelain`
  at start and end and report any delta without reverting it.
- Do not edit any skill, reference, script, schema or constant. Proposals go in
  the report.
- Write only the report named under Deliverables and files under
  `<lab>\runs\<YYYY-MM-DD>-component-file-layout-research-1\`.
- Label every claim `Confirmed`, `Observed`, `Inference` or `Open question`,
  and cite every `Confirmed` and `Observed` product claim with file and line.
  Copy no source text longer than a short quotation.
- Keep external sources (Angular 19 documentation at `v19.angular.dev`)
  separate from product evidence, and label them as external.

## Part A: how the React product lays out a component today

Search all of `src`, with tests and stories counted separately. For every item
give an approximate count, two or three representative citations, and where it
concentrates, looking hardest at `src\features\floorPlanCreator\detailDrawer`,
since the next slices come from there.

1. **Style files beside a component.** How many `.tsx` components have a
   sibling style file, and how many declare their styling inside the `.tsx`
   itself. Give the exact naming forms in use — `X.styles.ts`, `styles.ts`,
   `X.styled.ts`, `.css`, `.scss`, a `styles\` folder, anything else — with a
   count each. `splitBase` in `angular-structure.mjs:91-100` recognises only
   the `styles` marker, so say which of the forms you found that rule reaches
   and which it does not.
2. **Size.** The line-count distribution of component `.tsx` files: median, the
   ten largest, and the same two figures restricted to the detail-drawer
   surfaces still to migrate. Separately, the line count of the styled-template
   and inline-style block inside those files, since that is what would become
   an Angular `styles` literal. This is the only evidence that could justify a
   size threshold; if the distribution has no natural break, say so plainly.
3. **Splitting markup.** Does the team ever move markup out of a `.tsx` into
   sub-component files or render helpers, and at what size does that happen?
   That is the granularity they already treat as too big for one file.
4. **Co-located types.** Is `X.types.ts` a product convention, and how many
   components have one? The migrated slice carries `astronaut-model.types.ts`,
   while `angular-structure.mjs` maps a type file to `models\x.model.ts`
   (`expectTarget` at line 514). Say which form the product actually supports.

## Part B: what the Angular side already does, and what it can do

Cite every file under a folder named `angular`, and the Angular 19
documentation as an external source.

1. **The three existing components.** For
   `lineForm\angular\line-fields.component.ts`, the straight-strip component
   and the astronaut-model component: inline `template`/`styles` or
   `templateUrl`/`styleUrl`, and the line count of each literal. Is the
   de-facto convention the same across all three? If the astronaut-model files
   are not in this checkout, say so.
2. **The decisive question: does a split component survive `vitest`?**
   `vite.config.ts` guards the Analog plugin with `process.env.VITEST`, so a
   spec compiles its component through runtime JIT, where an external template
   or stylesheet needs `resolveComponentResources` or a custom
   `resourceLoader`. Establish from `vite.config.ts`, `tsconfig.app.json`, the
   spec setup files and the Angular documentation whether any such resolution
   exists on the test path. Report `Confirmed` only with the configuration
   lines that prove it. If it can be settled only by running a spec, say so and
   stop: the product is read-only and this research does not run tests.
3. **The build path.** Does `styleUrl` resolve under the `transformFilter`
   scoped to `*/angular/*.component.ts` (`project-constants.md:93-98`)? A
   `.css` sibling is not itself matched by that filter; say what resolves it.
4. **Encapsulation.** Does emulated view encapsulation behave identically for
   `styles` and `styleUrl` here, so that moving styles between the two cannot
   change rendering?

## Part C: confirm or refute the lab's three claims

One verdict each — `Confirmed`, `Refuted` or `Open question` — with citations.

1. Does any generated contract still assert "never a separate .html file" while
   `project-constants.md#Compilation` no longer supports it? List every file
   under `<lab>\examples\handoff\` and `<lab>\runs\` that carries the sentence,
   with its date, and say whether the newest ones inherited it from the
   examples.
2. Does `project-constants.md:106` hold for the test path as well as the build
   path, per Part B.2? If not, the constant is wrong as written; give the
   qualifier it needs, as a proposal.
3. Do `angular-structure.mjs:119` and the contract's inline-only styling rule
   contradict each other in practice — that is, would the engine ever produce a
   `.component.css` target that a contract forbids? Name a real product path
   where that happens, or say the case does not arise.

## Part D: recommend the line

One table, one row per option below. Columns: what it costs on the next ten
detail-drawer surfaces in
`<lab>\runs\2026-09-14-migration-map-2\migration-map.json`; whether the
evidence in Parts A and B permits it at all; and what would have to change in
the lab to adopt it.

- **A. Source-mirroring.** The template stays inline because the JSX had no
  file of its own; a `.component.css` appears only where the React source had
  its own style file, exactly as `angular-structure.mjs:119` already maps.
- **B. Always split.** A `.html` and a `.css` for every Angular component.
- **C. Always inline.** What the contracts say today.
- **D. Size threshold.** Split above N template lines, with N justified by the
  Part A.2 distribution. If that distribution gives no defensible N, drop the
  option and say why.

Close with one recommendation and the smallest change that adopts it, ordered
script rule first, then constant, then one skill sentence.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-component-file-layout-research.md`:
   a summary of at most fifteen lines; Part A as the inventory; Part B with the
   test-path answer stated first; Part C as three verdicts; Part D as the table
   followed by the recommendation; open questions; method notes.
2. In the run directory: the line-count data behind Part A.2 in a form the lab
   can re-read, and the product `git rev-parse HEAD` and
   `git status --porcelain` from start and end.
3. In the chat: the summary, the Part B.2 answer and the Part D table, nothing
   else.

Before delivering, check that every Part A item has a count and a citation,
that Part B.2 is either answered with configuration evidence or explicitly
reported as blocked, that each Part C claim has a verdict, that every Part D
row names a concrete smallest change or says none is needed, that external
sources are labelled apart from product evidence, and that the product status
is unchanged. Correct every failure first.
