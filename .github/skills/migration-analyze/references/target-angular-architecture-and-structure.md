# Target Angular Architecture and Structure

Read this reference only when a run compares current React structure against
a possible Angular target, or reports on Angular project/folder architecture.

## Approval Status

This reference summarizes Angular guidance and code patterns found across
other Lely repositories on 4 September 2026. It has **not** been confirmed by
Bernhard or a representative Angular team (the same open item recorded in
`docs/project-seed.md`). Treat every item below as evidence-based research,
not an approved target standard, until that review happens. Do not present
any item in this file as an approved design decision.

## Source Priority

For target Angular conventions, use this order and report conflicts rather
than silently promoting a lower-priority source:

1. binding review guidelines maintained by the Frontend Chapter;
2. dedicated migration/architecture guides;
3. patterns actually observed in 2 or more independent Angular codebases;
4. a pattern observed in only 1 codebase (state this explicitly, do not
   generalize it);
5. inference.

## Confirmed Documented Guidance

- `HorizonUICodeReview.md` is a binding merge-request review checklist for
  Horizon UI code, not a general architecture proposal.
  Source: `C:\Project\lely-angular-research\horizon-documentation\Development\HorizonUICodeReview.md:1-3`.
- Its folder-structure section prescribes a `core/` (app-wide singletons,
  including a `store/` with `actions/reducers/effects/selectors`
  subfolders), `shared/` (reusable across the app), and `domains/`
  (business domains, each with its own `pages/`, `services/`, `models/`,
  and `<domain>.routes.ts`) split. Interfaces, enums, models, and helpers
  must not be declared in the same file as a component.
  Source: `HorizonUICodeReview.md:48-162`.
- Each domain folder (`feeding`, `farm`, `health`, `manure`, `milking`,
  `platform`, `reproduction`) has one owning team, and any architectural
  change (shared abstractions, state management, routing strategy, build
  setup) or cross-team change must be agreed with the **Frontend Chapter**
  before implementation.
  Source: `HorizonUICodeReview.md:164-194`.
- A separate, dedicated guide (`folder-structure-en.md`) defines a
  domain-driven structure with 3 top-level domains: `core/` (technical
  infrastructure only, no domain knowledge), `user/` (logged-in user
  operations), and `farm/` (main domain, with `management/staff`,
  `management/operations`, `animals/`, `devices/`, `manure/`, `tasks/`,
  `reports/` subdomains).
  Source: `C:\Project\lely-angular-research\horizon-documentation\Horizon\Docs\guides\folder-structure-en.md:9,16-46`.
- The same guide lists 14 standard technical folders and their rules, notably:
  `models/` splits into `models/dto/*.dto.model.ts` (backend response shapes)
  and flat `*.model.ts` (frontend domain models); `services/` splits into
  `*.api.service.ts` (HTTP/API calls only) and `*.service.ts` (state, events,
  business logic); `store/` is explicitly described as generic
  ("State management (NgRx, Signals store, etc.)") without mandating a tool;
  `module/` exists "only required for components where standalone migration
  has not yet been completed."
  Source: `folder-structure-en.md:65-78,95-96,117-118`.
- Structural rules: `shared/` and `composites/` may reuse the same technical
  folder structure; not every technical folder is required per leaf;
  business group folders (e.g. `management/`, `operations/`) never contain
  technical folders directly, only named leaf folders; component names in
  the example tree are illustrative only.
  Source: `folder-structure-en.md:122-127`.
- A separate `standalone-migration-en.md` guide defines a 9-step conversion
  process (convert template dependencies first, add an `imports` array,
  replace `*ngIf`/`*ngFor`/`*ngSwitch` with `@if`/`@for` via
  `ng generate @angular/core:control-flow`, remove from `NgModule`
  declarations, check service providers, replace `loadChildren` with
  `loadComponent`, build-verify, update tests, final checks) and names the
  highest risk as silently dropped routes when `RouterModule.forChild([...])`
  is removed without every route moving to `loadComponent` or a standalone
  `routes` array.
  Source: `standalone-migration-en.md:1-4,9-66` (steps), and the
  previously delegated review of this same file for the routing-risk section
  (not re-opened in this pass).

## Confirmed Documented Contradiction

- `folder-structure-en.md` explicitly refuses to mandate a state-management
  tool for `store/` (`folder-structure-en.md:95-96`), while
  `HorizonUICodeReview.md`'s own illustrative folder tree gives `core/store/`
  an NgRx-shaped substructure (`actions/`, `reducers/`, `effects/`,
  `selectors/`) with no equivalent caveat that the substructure itself is
  illustrative only (`HorizonUICodeReview.md:107-111`). No inspected Angular
  codebase in this research (Hub Dashboard UI, Horizon Architecture Demo) has
  an NgRx dependency (see `target-angular-state-management.md`). Do not
  treat the NgRx-shaped example as a confirmed target choice.

## Confirmed Observed Patterns (Real Code)

- Hub Dashboard UI's reusable library (`facets/hub-dashboard-ui/src/lib/`)
  uses a flat technical-folder layout: `components/`, `constants/`,
  `directives/`, `enums/`, `factories/`, `guards/`, `hooks/`, `models/`,
  `pages/`, `pipes/`, `services/`, `styles/`, `testing/`, `tokens/`,
  `types/`, `utils/`. It does **not** have `core/`, `user/`, `farm/`, or
  `domains/` folders, and its `models/` folder has no `dto/` subfolder (all
  models are flat `*.model.ts`).
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\facets\hub-dashboard-ui\src\lib` (directory listing),
  `...\lib\models` (directory listing, e.g. `device.model.ts`, `system-info.model.ts`).
- The `*.api.service.ts` / `*.service.ts` split from `folder-structure-en.md`
  is not applied everywhere: the `devices` service folder contains only
  `devices.service.ts`, no separate API service file. Only 1 example checked
  in depth; do not treat the split's absence as project-wide, but also do not
  treat its presence in the guide as a confirmed universal convention.
  Source: `...\lib\services\devices` (directory listing).
- Horizon Architecture Demo is structured as an Angular CLI multi-project
  workspace (6 projects: 1 application, 1 shared `core-components` library,
  4 feature libraries `app-dashboard`/`app-health`/`app-login`/`app-milking`/
  `app-tasks`), each independently buildable via `ng build <project>`, which
  is a materially different structural pattern from both documented guides
  above (domain-folders-in-one-app vs. one-library-per-feature monorepo).
  Source: `C:\Project\lely-angular-research\horizon-architecture-demo\package.json:28-38` (build scripts),
  `C:\Project\lely-angular-research\horizon-architecture-demo\angular.json` (previously delegated review of
  project list, not re-opened in this pass).

## Open Questions

- Which structural pattern applies to a new domain application such as the
  Route Assistant migration target: the `core/user/farm` domain guide, the
  `core/shared/domains` guide, or the library-per-feature monorepo pattern
  observed in Horizon Architecture Demo? `HorizonUICodeReview.md:188-190`
  requires Frontend Chapter agreement for this kind of architectural choice;
  no record of that agreement exists in the material reviewed here.
- Hub Dashboard UI is an operations/administration dashboard, not a
  farm-domain application. Its folder layout may not be a representative
  analogue for a farm/robot-domain migration target like Route Assistant.
  This is a reasoning caveat, not a resolved fact.
- Whether the two documented folder guides (`folder-structure-en.md` and
  `HorizonUICodeReview.md`) are meant to compose (e.g. one governs top-level
  domains, the other governs per-domain internals) or represent superseding,
  inconsistent guidance was not resolved by either document; neither
  cross-references the other.
