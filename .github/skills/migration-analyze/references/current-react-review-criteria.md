# Current React Review Criteria

Read this reference only when a run assesses current React conventions or
contradictions. These rules do not define an Angular target.

## Source Priority

For current application behavior and conventions, use this order:

1. executable tests and enforced configuration;
2. observed source behavior;
3. maintained repository documentation;
4. provisional team input;
5. inference.

Report conflicts rather than silently promoting a lower-priority source.

## Confirmed Enforced Configuration

- TypeScript has `strict: true`, while `noImplicitAny` is explicitly `false`.
  Source: `C:\Project\frontend\tsconfig.json:15`,
  `C:\Project\frontend\tsconfig.json:20`.
- The build runs `tsc --noEmit` before Vite.
  Source: `C:\Project\frontend\package.json:8`.
- Vitest and Testing Library are configured project tools.
  Source: `C:\Project\frontend\package.json:9`,
  `C:\Project\frontend\package.json:29`.
- Prettier uses tabs with width four, double quotes, semicolons, and a print
  width of 120.
  Source: `C:\Project\frontend\.prettierrc:1`.
- ESLint requires double quotes and semicolons and sets a maximum code length
  of 250 for the covered cases.
  Source: `C:\Project\frontend\.eslintrc.cjs:19`,
  `C:\Project\frontend\.eslintrc.cjs:23`,
  `C:\Project\frontend\.eslintrc.cjs:27`.
- ESLint explicitly disables the bans on TypeScript comments and explicit
  `any`.
  Source: `C:\Project\frontend\.eslintrc.cjs:42`.

## Confirmed Documented Guidance

Repository documentation says to:

- avoid `any`, define prop interfaces, and use strict TypeScript;
- use functional components and hooks;
- keep components focused and extract reusable logic;
- use `styled-components` and theme values;
- test interactions, error states, and edge cases;
- provide Storybook stories for new components;
- use semantic HTML, appropriate ARIA labels, keyboard navigation, screen
  reader checks, and color-contrast checks.

Source:

- `C:\Project\frontend\docs\contributing.md:83`
- `C:\Project\frontend\docs\contributing.md:115`
- `C:\Project\frontend\docs\contributing.md:155`
- `C:\Project\frontend\docs\contributing.md:203`
- `C:\Project\frontend\docs\contributing.md:246`
- `C:\Project\frontend\docs\contributing.md:340`

Treat documentation as review evidence, not proof that every rule is enforced
or consistently followed.

## Provisional Team Input

Keep these five 2 September 2026 rules separate and label them `Team input`
until their owner and original source are confirmed:

1. `REACT-READ-001`: function parameters are named and typed precisely enough
   that their purpose is clear without a comment.
2. `REACT-EXT-001`: supporting a new robot type does not require hardcoded
   `robotType` branches in existing form JSX; use configuration or
   composition.
3. `REACT-A11Y-001`: relevant forms work with keyboard navigation and
   applicable `Tab`, `Enter`, and `Escape` behavior.
4. `REACT-TYPE-001`: new code introduces no `any`.
5. `REACT-TYPE-002`: new code introduces no `@ts-ignore`; resolve the type
   error instead.

Source:

`C:\Obsidian\Notes 2025\Lely\Angular migratie - conventions onderzoek.md:62`

## General Review Questions

Keep these as questions unless a concrete sourced rule exists:

- architecture, single responsibility, maintainability, and readability;
- extensibility, configuration, composition, and feature flags;
- state locality and justified shared-state mechanisms;
- expensive calculations, rerenders, memoization, and hook dependencies;
- resilience, loading, fallback, and understandable error behavior;
- component testability without hard API coupling.

Source:

`C:\Obsidian\Notes 2025\Lely\Angular migratie - conventions onderzoek.md:76`

## Required Contradictions

When current conventions are assessed, report the status of all three baseline
tensions. If a construct does not occur in the scoped code, say that separately
from the repository-wide tooling permission:

- tooling permits explicit `any`, while repository documentation discourages
  it and provisional team input rejects new uses;
- tooling permits `@ts-ignore`, while provisional team input rejects new
  uses;
- Prettier uses width 120, while ESLint allows covered code up to 250.

Do not call the stricter team input tool-enforced.

## Angular Unknowns

Approved Angular target conventions are absent. Do not map React rules to
Angular components, signals, services, forms, routing, styling, or tests.

Record missing target choices as `Open question`. They do not block a
read-only React behavior baseline, but they block unsupported target-design
claims.
