# Target Angular State Management

Read this reference only when a run compares current React state management
(Context API, `useSyncExternalStore`, custom providers) against a possible
Angular target, or reports on Angular state-management conventions.

## Approval Status

This reference summarizes Angular guidance and code patterns found across
other Lely repositories on 4 September 2026. It has **not** been confirmed by
Bernhard or a representative Angular team. Treat every item below as
evidence-based research, not an approved target standard, until that review
happens. State management is the area with the weakest documented guidance
of all areas researched; do not fill that gap with confident recommendations.

## Confirmed: No Documented Mandate

- `folder-structure-en.md` describes the `store/` technical folder only as
  "State management (NgRx, Signals store, etc.)", without choosing a tool.
  Source: `C:\Project\lely-angular-research\horizon-documentation\Horizon\Docs\guides\folder-structure-en.md:95-96`.
- `HorizonUICodeReview.md` requires every subscription to be cleaned up
  (`takeUntil` or `AsyncPipe`), which presumes RxJS observables are in use
  somewhere, but does not mandate a store architecture.
  Source: `HorizonUICodeReview.md:216-220`.
- `HorizonUICodeReview.md` requires that "state management changes" be
  agreed with the Frontend Chapter before implementation, implying no
  single mandated approach exists yet, only a change-control gate.
  Source: `HorizonUICodeReview.md:188-190`.

## Confirmed Documented Contradiction

- `HorizonUICodeReview.md`'s own illustrative folder-structure example gives
  `core/store/` an NgRx-shaped substructure: `actions/`, `reducers/`,
  `effects/`, `selectors/`.
  Source: `HorizonUICodeReview.md:107-111`.
- No inspected Angular codebase has an `@ngrx/*` dependency:
  - Hub Dashboard UI's `package.json` dependencies and devDependencies list
    no `@ngrx/*` package (full dependency list reviewed).
    Source: `C:\Project\lely-angular-research\hub-dashboard-ui\package.json:18-72`.
  - Horizon Architecture Demo's `package.json` dependencies and
    devDependencies list no `@ngrx/*` package either.
    Source: `C:\Project\lely-angular-research\horizon-architecture-demo\package.json:44-91`.
- Do not treat the documented NgRx-shaped folder example as evidence that
  NgRx is the actual or intended target pattern; treat it as an unresolved
  contradiction between one illustrative document and all inspected code.

## Confirmed Observed Patterns (Real Code)

Only 2 independent Angular codebases were inspected. Treat any single-app
pattern as illustrative, not as a project-wide convention.

- Hub Dashboard UI (Angular 19, production app) uses Angular Signals
  (`signal()`, `computed()`) combined with `inject()` for internal
  component/service state, and keeps RxJS only at the boundary with
  Auth0's observable-based SDK (`ReplaySubject`, `shareReplay`). This is a
  **hybrid** pattern, not pure-Signals and not pure-RxJS.
  Source: `C:\Project\lely-angular-research\hub-dashboard-ui\facets\hub-dashboard-ui\src\lib\services\ciam-auth\ciam-auth.service.ts:1` (imports `signal`, `computed`, `inject`),
  `ciam-auth.service.ts:10,12-13` (`@Injectable({ providedIn: 'root' })`, `inject()`),
  `ciam-auth.service.ts:30-31,33,47-51` (`signal`/`computed` state and derived values),
  `ciam-auth.service.ts:51,53,55` (`ReplaySubject`, `shareReplay` for Auth0 observables).
- Horizon Architecture Demo (Angular 17, reference/demo app) uses a plain
  RxJS-adjacent pattern with `localStorage` as the backing store for feature
  flags, no Signals, accessed through a functional route guard using
  `inject()`.
  Source: `C:\Project\lely-angular-research\horizon-architecture-demo\projects\core-components\src\guards\feature.guard.ts:1-3` (imports),
  `feature.guard.ts:5-9,11-17` (`@Injectable({ providedIn: 'root' })`, `localStorage` read/write),
  `feature.guard.ts:42-50` (`FeatureGuard.on`/`off` as `CanActivateFn` using `inject(SplitService)`).
- Both apps use `@Injectable({ providedIn: 'root' })` for singleton services
  and the `inject()` function rather than constructor injection at the
  points sampled.
  Source: `ciam-auth.service.ts:10,12-13`; `feature.guard.ts:5-7,44,48`.

## Open Questions

- Which pattern is the sanctioned target for a new domain application such
  as the Route Assistant migration: the Signals-hybrid approach seen in the
  newer production app, the RxJS/localStorage approach seen in the older
  demo app, or NgRx as implied by one illustrative folder tree? Only 2
  example apps of differing Angular versions (17 vs. 19) and differing
  purposes (internal ops dashboard vs. architecture demo) were available;
  this is not enough to establish a project-wide convention per the
  evidentiary bar used elsewhere in this research.
- `@lely/foundation` (`hub-dashboard-ui\package.json:30`, version `^2.0.2`)
  is present as a dependency but its internal source is not inspectable
  locally. Whether it provides shared state-management utilities, base
  service classes, or store scaffolding relevant to a migration target is
  unresolved.
- No React-side equivalent comparison has been made yet in this file (the
  current React Context/`useSyncExternalStore` pattern is documented
  separately in `current-react-review-criteria.md` and the earlier
  inventory report); a side-by-side mapping from React Context providers to
  an Angular target pattern should not be attempted until the target
  pattern question above is resolved.
