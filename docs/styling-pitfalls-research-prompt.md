---
document: styling-pitfalls-research-prompt
version: 0.1.0
status: draft
date: 2026-09-15
---

# Research prompt: styling patterns and pitfalls, and whether the flow is armed

Run this in a fresh Copilot CLI chat, started the same way as the flow skills
so it can read both the product and the lab, by typing:

`Read C:\Project\migration-skill-lab\docs\styling-pitfalls-research-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this research exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

The chain `detail-drawer-straight-strip-form-baseline-1` migrated one field,
the straight strip's Length, into an Angular island inside the retained React
drawer. All five behaviour scenarios passed, yet it needed two verify and debug
rounds, both on styling:

1. the icon SVG was bound as a string through `[innerHTML]` and the sanitizer
   emptied it;
2. the value sat below the field's centre, because the component stacked the
   label above the value. The contract described it that way and cited
   `NumberInput.tsx`, while the floating label and the 56px centred row are
   declared two components deeper, in `HoverInput.tsx`.

The lab answered with four changes, designed without access to the product:

- `scripts\style-sources.mjs` walks the render tree from a surface's component
  and prints the styled templates, inline styles and stylesheets that paint
  it, plus the migration-map prerequisites it renders through;
- a flow contract at schemaVersion 8 records that output per `visualParity`
  entry as `styleSources` and `sharedComponents`. `flow-migrate` ports from the
  cited templates, and the validator makes a slice build every unbuilt shared
  component at its measured target instead of copying it;
- `docs\project-constants.md#Styling` says how a styled template ports and
  that markup never goes through `[innerHTML]`;
- `scripts\angular-conventions.mjs` reports `[innerHTML]` and
  `bypassSecurityTrust*` as `inner-html`.

Those changes rest on assumptions about how the product styles its UI: that
styling is styled-components templates reached by relative imports, and that
these two defects are typical. Your job is to replace the assumptions with
evidence. Inventory the styling patterns and Angular-island pitfalls this
product actually has, test the lab's instruments against real surfaces, and
judge per pattern whether the flow would catch it. You are not changing the
skills and not migrating anything.

## Read first, once

- `<lab>\docs\project-constants.md`, especially Compilation, Embedding,
  Change detection, Styling and Manual verification environment. They are
  decided; never reopen them, but report where the evidence says one of them
  cannot hold.
- The `visualParity` bullet in
  `<lab>\.github\skills\flow-baseline\references\flow-contract.md`, survey
  step 2 in `flow-baseline\SKILL.md`, steps 5 and 7 in `flow-migrate\SKILL.md`,
  steps 4 and 5 in `flow-verify\SKILL.md` and step 5 in `flow-debug\SKILL.md`,
  all under `<lab>\.github\skills\`. These are the defences you evaluate.
- In `<lab>\runs\flows\detail-drawer-straight-strip-form\2026-09-14-detail-drawer-straight-strip-form-baseline-1\`:
  `flow-contract.json` (its `visualParity` and `targetArchitecture.styling`),
  `verification-result.json`, `verification-result-2.json` and
  `debug-result-2.json`. They are the known ground truth.
- `node "<lab>\scripts\style-sources.mjs" --help`.

Open anything else only where it decides a specific claim.

## Boundaries

- The product is read-only: no edits, installs, builds, test runs, branches,
  stashes or commits. Record `git rev-parse HEAD` and
  `git status --porcelain` at start and end and report any delta without
  reverting it.
- Two lab scripts may run against the product, because they never write:
  `style-sources.mjs`, and `run-context.mjs --product-root <product> --contract <flow-contract.json>`
  without `--save-status` or `--claim`.
- Do not edit any skill, reference, script, schema or constant. Proposals go
  in the report.
- Write only the report named under Deliverables and files under
  `<lab>\runs\<YYYY-MM-DD>-styling-pitfalls-research-1\`.
- Label every claim `Confirmed`, `Observed`, `Inference` or `Open question`,
  and cite every `Confirmed` and `Observed` product claim with file and line.
  Copy no source text longer than a short quotation.
- Keep external sources (Angular 19 documentation at `v19.angular.dev`,
  styled-components documentation) separate from product evidence, and label
  them as external.

## Part A: how the product styles its UI

Search all of `src`, with tests and stories counted separately. For every item
give an approximate count, two or three representative citations, and where it
concentrates, looking hardest at `src\features\floorPlanCreator\detailDrawer`,
since the next slices come from there.

1. **Mechanisms.** Every styled-components form in use: `styled.tag`,
   `styled(Component)`, `.attrs()`, `.withConfig()`, generics, the `css`
   helper, `keyframes`, `createGlobalStyle`, object styles
   (`styled.div({...})`), the `as` and `forwardedAs` props, transient `$props`,
   `shouldForwardProp`. Component selectors (`${Child}` inside a parent
   template), `&` nesting, pseudo-classes and pseudo-elements, media queries.
   Inline `style={{...}}`. CSS or SCSS files. Global class names. Any
   third-party UI library and its styling API.
2. **Theme and tokens.** Where the `ThemeProvider` and the theme shape live
   (radius, `EColors`, spacing, typography); where `@lely/tokens` or other CSS
   custom properties are already used; literal values next to tokens; props
   that compute styles, such as conditions or pixel arithmetic.
3. **Layout techniques** on drawer-like surfaces: flex and grid,
   `justify-content` and `align-items` centring, absolute positioning with
   transforms such as floating labels, fixed heights, negative margins,
   `calc()`, `gap` against margins, `box-sizing`, overflow and ellipsis,
   z-index and portals, and widths that rely on a block-level parent.
4. **SVG and icons.** How icons render: the `Icon` component, SVG imported as a
   React component (for example `?react` through svgr), SVG as an `<img>` URL,
   raw SVG strings, `dangerouslySetInnerHTML`, sprites with `<use>`. How icon
   size and colour are set (`currentColor`, fill props, width and height props,
   CSS). Name the drawlib and SVG.js canvas as a boundary only.
5. **Global and inherited styles.** Resets, fonts, `box-sizing`, base font size
   and line height on `body` or on drawer ancestors, all of which an Angular
   island inherits. Parent templates that style descendants by element or
   structure (`input {}`, `& > *`, `label + input`), which also hit
   Angular-rendered DOM or stop matching when its markup differs.
6. **States.** Hover, focus, focus-visible, disabled, error and active styles,
   transitions and animations, and whether each is driven by CSS or by
   JavaScript state.

## Part B: pitfalls of an Angular island in this product

For each pitfall, say whether it applies here and how. Cite the React side, the
Angular code already in the product (every file under a folder named
`angular`, such as `lineForm\angular\line-fields.component.ts` and the
straight-strip component) and, as an external source, the Angular 19
documentation.

1. **The host element.** An Angular component's host element is `display:
   inline` unless its styles say otherwise, and the React host `<div ref>` that
   `createComponent` mounts into is a box of its own. Inside a flex or grid
   parent, or where a width is expected, both change layout. How do the
   existing components set `:host`, and does the mount wrapper break the
   parent's gap or alignment?
2. **View encapsulation.** Angular's emulated encapsulation scopes the island's
   styles to it, but React parent templates that select descendants still
   reach its DOM. Which parent templates in the drawer target descendants, and
   does any existing island use `::ng-deep`, `ViewEncapsulation.None` or global
   styles?
3. **Sanitization.** Beyond `[innerHTML]`: `[style]` bindings with `url()`,
   `[attr.href]` and `xlink:href` on SVG `<use>`, and what Angular 19 strips or
   warns about.
4. **Static styles.** Compilation requires static `styles`. List every kind of
   dynamic interpolation in the drawer's styled templates and its Angular
   equivalent: a class binding, `[style.prop]` or a host custom property.
5. **Tokens.** Does every theme value a drawer template reads have a CSS
   custom property, or does each island need a `hostTokenStyle`-like mapping?
   List the theme values without one.
6. **The desktop WebView.** Differences in default font size, rem base,
   scrollbar width or device pixel ratio that make a style correct in a browser
   tab and wrong in the Route Assistant desktop application.
7. **Measured layout.** Styles that depend on measured sizes (`ResizeObserver`,
   `useLayoutEffect`, `getBoundingClientRect`), which a CSS port cannot carry.
8. Anything else the evidence shows.

## Part C: test the lab's instruments on real surfaces

1. Choose five surfaces: the straight strip's `StraightStripLength.tsx` as the
   known case, and four migrate candidates from the detail-drawer slices in
   `<lab>\runs\2026-09-14-migration-map-2\migration-map.json`, varied in
   mechanism (one with an icon, one with conditional styling, one using a
   third-party or shared layout component). For each, run
   `node "<lab>\scripts\style-sources.mjs" --product-root C:\Project\frontend --entry <component file> --map "<lab>\runs\2026-09-14-migration-map-2\migration-map.json"`
   and save the output as `style-sources-<surface>.json` in the run directory.
2. Trace each surface's render tree by hand and write the ground truth to
   `ground-truth-<surface>.md`: every template, inline style and stylesheet
   that paints it, and every shared prerequisite it renders through. Compare
   it with the script's output: sources it missed, with the reason (an alias
   import, a barrel form, the `as` prop, a component passed as a prop, a
   higher-order component, `React.lazy`, a default-export form), sources it
   added that do not paint the surface, wrong line ranges, and
   `unparsed` or `unresolved` entries that were parseable after all. For the
   known case, confirm it reaches `HoverInput.tsx` and the icon component.
3. Count the rendering imports that use a `tsconfig` path alias rather than a
   relative path. The script follows only relative imports.
4. Run
   `node "<lab>\scripts\run-context.mjs" --product-root C:\Project\frontend --contract "<lab>\runs\flows\detail-drawer-straight-strip-form\2026-09-14-detail-drawer-straight-strip-form-baseline-1\flow-contract.json"`
   and report the `angularConventions` findings. Say whether the
   straight-strip component, as it now stands, still binds markup with
   `[innerHTML]` or `bypassSecurityTrustHtml`. If its Angular files are not in
   this checkout, say so.

## Part D: is the flow armed?

Write one row per pattern from Part A and pitfall from Part B that occurs in
the product, with these columns:

- the pattern, with its count and a citation;
- **contract**: does `style-sources.mjs` put it in `styleSources` or
  `sharedComponents`, or does the baseline's prose ask for it?
- **migrate**: does Styling or Compilation in the project constants tell
  `flow-migrate` how to port it correctly?
- **verify**: would the walkthrough's element-by-element visual item make a
  tester notice it in the desktop application?
- **deterministic check**: could a rule in `angular-conventions.mjs` or an
  extension of `style-sources.mjs` catch it, and what would that rule match?
- a verdict: `Armed`, `Partly armed` or `Not armed`;
- the smallest change that arms it: a script rule first, then a constant, then
  one skill sentence.

Rank the proposals by how many upcoming detail-drawer surfaces each protects,
per unit of change.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-styling-pitfalls-research.md`:
   a summary of at most fifteen lines; Part A as the inventory; Part B with a
   verdict per pitfall; Part C as one table per surface (found, missed, extra,
   wrong range) plus the alias count and the convention findings; Part D as
   the armed table followed by the ranked proposals; open questions; method
   notes.
2. In the run directory: every `style-sources-*.json`, every
   `ground-truth-*.md`, and the start and end product `git rev-parse HEAD` and
   `git status --porcelain` output.
3. In the chat: the summary, the Part C results per surface and the Part D
   table, nothing else.

Before delivering, check that every Part A item has a count and a citation,
every Part B pitfall has a verdict with product evidence or a stated absence,
every surface in Part C has both the script output and a hand-traced ground
truth, every Part D row names a concrete smallest change or says none is
needed, external sources are labelled apart from product evidence, and the
product status is unchanged. Correct every failure first.
