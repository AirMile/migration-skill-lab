# Target Angular UI and Component Conventions

Read this reference only when a run compares current React component/UI
patterns against a possible Angular target, or reports on Angular component
conventions.

## Approval Status

This reference summarizes Angular guidance and code patterns found across
other Lely repositories on 4 September 2026. It has **not** been confirmed by
Bernhard or a representative Angular team. Treat every item below as
evidence-based research, not an approved target standard, until that review
happens.

## Confirmed Documented Guidance (`HorizonUICodeReview.md`)

Binding merge-request review checklist, source:
`C:\Project\lely-angular-research\horizon-documentation\Development\HorizonUICodeReview.md`.

- New Angular control-flow syntax (`@if`, `@for`, `@switch`) is required
  instead of `*ngIf`, `*ngFor`, `*ngSwitch`; templates hold only presentation
  logic, complex logic lives in the component class.
  Source: `HorizonUICodeReview.md:24-31`.
- All newly created components are standalone by default; no unnecessary
  `NgModule`; components hold UI logic only, business logic belongs in
  services; selectors must be unique app-wide with a project prefix where
  applicable; components are split by business capability, not technical
  layer.
  Source: `HorizonUICodeReview.md:36-46`.
- All variables, parameters, and return types are explicitly typed; `any` is
  avoided, `unknown` with narrowing is preferred.
  Source: `HorizonUICodeReview.md:206-208`.
- Every subscription is cleaned up in `ngOnDestroy`; preferred patterns are
  `takeUntil` with a destroy subject, or `AsyncPipe` in the template.
  Source: `HorizonUICodeReview.md:216-220`.
- Curly braces are mandatory for all `if`/`for`/conditional blocks, even
  single-line; no unsafe expressions (untrusted HTML binding, `eval`-like
  patterns); newly added npm packages must use exact, fixed versions
  (`^`/`~` are not allowed).
  Source: `HorizonUICodeReview.md:227-236`.
- No `this.` in templates; no `href="javascript:;"` (use
  `<button type="button">`); styles are `.scss`; no hardcoded values (raw hex
  colors, raw `px`); design tokens come from `@lely/tokens`; overriding
  global utility classes is **strictly forbidden**; `::ng-deep` is
  **forbidden**.
  Source: `HorizonUICodeReview.md:240-247`.
- Minimum 70% test coverage for new/changed code; short, single-responsibility
  methods; low branch count per method; one behavior per test with
  Arrange/Act/Assert.
  Source: `HorizonUICodeReview.md:256-268`.
- Code follows the Google TypeScript Style Guide as the main reference.
  Source: `HorizonUICodeReview.md:198-199`.
- The "No `this.` in templates" and other template-level rules above were
  read directly from the guideline text; they were not independently
  verified against real `.html` template files in this pass. Treat their
  enforcement in practice as an open question, not confirmed.

## Confirmed Documented Contradiction (Tooling vs. Guideline)

- The guideline says `any` is avoided (`HorizonUICodeReview.md:208`), but Hub
  Dashboard UI's own ESLint flat config explicitly turns the rule off:
  `'@typescript-eslint/no-explicit-any': 'off'`.
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\eslint.config.mjs:36`.
  Do not call the documented rule tool-enforced in this repository.

## Confirmed Observed Patterns (Real Code, ≥2 codebases unless noted)

- 100% standalone components in every component sampled across both
  Angular reference codebases (no `standalone: true` flag needed under
  Angular 19 defaults, but no `NgModule`-declared components were found
  either).
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\facets\hub-dashboard-ui\src\lib\components\lely-ds-sidebar\lely-ds-sidebar.component.ts:10-16`,
  `...\components\kpi-card\kpi-card.component.ts:12-18`,
  `C:\Project\lely-angular-research\horizon-architecture-demo\projects\core-components\src\components\lely-card\lely-card.component.ts:1-15` (delegated review, not re-opened this pass).
- `ChangeDetectionStrategy.OnPush` is used in the newer, production codebase
  (Hub Dashboard UI, Angular 19) but was **not** found in the older reference
  codebase (Horizon Architecture Demo, Angular 17, 0 of 3 components
  sampled). This is an emerging pattern in the newer/production app, not a
  documented mandate, and not followed everywhere.
  Source (present): `hub-dashboard-ui\...\lely-ds-sidebar.component.ts:11`,
  `...\kpi-card.component.ts:16`.
  Source (absent, delegated review not re-opened this pass): Horizon
  Architecture Demo `app.component.ts`, `lely-card.component.ts`,
  `lely-navigation.component.ts`.
- Component input/output style is **not unified** within Hub Dashboard UI
  itself: `lely-ds-sidebar.component.ts` uses the newer signal-based
  `input()`/`output()` functions (e.g. `menu = input<...>()`,
  `itemSelect = output<...>()`), while `kpi-card.component.ts` uses the
  legacy `@Input()` decorator (e.g. `@Input() heading = ''`,
  `@Input({ required: true }) iconClass = ''`) in the same application.
  Source: `...\lely-ds-sidebar.component.ts:1,20-29`,
  `...\kpi-card.component.ts:1,20-25`.
- Dependency injection uses the `inject()` function in both sampled
  codebases, including inside components (not only guards/services).
  Source: `...\lely-ds-sidebar.component.ts:19` (`inject(CIAMAuthService)`),
  `C:\Project\lely-angular-research\horizon-architecture-demo\projects\core-components\src\guards\feature.guard.ts:44,48` (`inject(SplitService)`).
- Component selector prefixes are **not consistent** within Hub Dashboard
  UI: observed prefixes include `lely-ds-` (design-system components, e.g.
  `lely-ds-sidebar`) and `ltc-svcm-` (feature components, e.g.
  `ltc-svcm-kpi-card`). Only 2 prefixes observed directly; do not treat
  either as the sole project convention.
  Source: `...\lely-ds-sidebar.component.ts:12`, `...\kpi-card.component.ts:13`.
- `@lely/ng-components` is a real, actively used dependency providing shared
  UI primitives (e.g. `AvatarComponent`, `DividerComponent`, `IconComponent`,
  `CardComponent`), imported directly into feature components.
  Source: `...\lely-ds-sidebar.component.ts:3` (imports),
  `...\kpi-card.component.ts:2` (imports),
  `C:\Project\lely-angular-research\hub-dashboard-ui\package.json:32` (dependency, version `^0.0.10`).

## Open Questions

- `@lely/ng-components` (dependency `^0.0.10`,
  `hub-dashboard-ui\package.json:32`) and `@lely/ng-components-po`
  (devDependency `^0.0.10`, `package.json:50`) are private packages;
  `node_modules` and any local source/typings/documentation for them are
  absent from this workspace. Their full component API surface, accepted
  inputs, accessibility contract, and theming rules cannot be verified
  locally. Ask for the authoritative source (repository or published docs)
  for `@lely/ng-components` before treating any component usage pattern as
  exhaustive.
- `@lely/foundation` (dependency `^2.0.2`, `hub-dashboard-ui\package.json:30`)
  is present but its internal source is likewise not inspectable locally.
  Whether it defines shared UI base classes, interceptors, or utilities
  relevant to a migration target is an open question.
- Whether the signal-based `input()`/`output()` style or the legacy
  `@Input()`/`@Output()` decorator style is the intended target convention
  is unresolved; both coexist in the same production codebase with no
  documented preference found.
- No accessibility-specific Angular guidance (ARIA, keyboard navigation,
  color contrast) was found in `HorizonUICodeReview.md` or the other
  documents reviewed; the React side has documented accessibility guidance
  (see the React reference file), so this is a asymmetry to flag, not a
  confirmed gap in target expectations.
