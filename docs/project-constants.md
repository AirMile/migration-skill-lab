---
document: project-constants
version: 0.6.0
status: decided
date: 2026-09-14
---

# Project constants

Facts about this migration that do not change per flow. A skill reads this file
once per run and states what it found; it never asks the user for anything on
this page.

Every entry here was a question a run used to ask, or an open question that
blocked a later phase. Changing one is a deliberate project decision, not a
per-run choice: edit this file, and the next run picks it up. Why each entry
was decided, and what it replaced, is in `project-constants-history.md`; no run
needs it.

Product repository: `C:\Project\frontend`.

## Angular version

`19.2.25`, pinned across every `@angular/*` package.

The version is decided by the product's TypeScript, not by preference. The
repository is on TypeScript `5.6.3`, and the Angular peer ranges are:

| Angular | TypeScript |
|---|---|
| 19.2.25 | `>=5.5 <5.9` |
| 20.3.30 | `>=5.8 <6.0` |
| 22.1.5 | `>=6.0 <6.1` |

Only 19 fits without upgrading TypeScript first, and a TypeScript upgrade is a
separate change with its own blast radius across the existing React code.
Raising Angular later means raising TypeScript first, in its own flow.

## Packages

Added to `dependencies`:

- `@angular/core@19.2.25`
- `@angular/common@19.2.25`
- `@angular/compiler@19.2.25`
- `@angular/platform-browser@19.2.25`

Build tooling, pinned exactly in the product's `package.json`:

- `@analogjs/vite-plugin-angular@2.7.2`
- `@angular/build`, a 19.x version; the pin in `package.json` is the exact one

`rxjs` and `tslib` arrive as transitive dependencies and are already present in
`node_modules`. `zone.js` is a peer dependency of `@angular/core@19` and will be
installed; it is never imported, because change detection is zoneless. Do not
add it to `dependencies` and do not import it anywhere.

Install command: `npm install`.

## Compilation

Build-time (AOT), through `@analogjs/vite-plugin-angular@2.7.2` +
`@angular/build@19` in `vite.config.ts`, scoped by `transformFilter` to
`*/angular/*.component.ts` files only; the rest of the app keeps using the
plain React/Vite pipeline untouched. A separate `tsconfig.app.json` at the
repository root feeds the plugin the file set to compile
(`src/**/angular/**/*.ts`).

- The plugin runs `fastCompile: true` with `disableTypeChecking: true`, the
  only configuration that compiled the first slice, so Angular template type
  errors are caught by tests, not by the build.
- The plugin is off under Vitest (`process.env.VITEST` guard in
  `vite.config.ts`), because it broke unrelated tests; tests mount through the
  same runtime `createApplication()`/`createComponent()` path as Embedding.
- `templateUrl` and `styleUrl` work; splitting a large component's template or
  styles into files is a per-component call.
- `componentRef.setInput()` is possible under build-time compilation but not
  yet confirmed: `lineForm/angular/mount-line-fields.ts` keeps its
  `setAdapterInputs()` workaround until a slice settles it.

Consequences for how components are written:

- `styles` and `template` are static literals without `${...}`, because the
  compiler analyzes them. Token values arrive as CSS custom properties set
  through a dynamic `host: { "[style]": ... }` binding, as `hostTokenStyle` in
  `lineForm/angular/line-fields.component.ts` shows;
- dependencies come from `inject()`, never constructor parameters, and inputs
  and outputs are `input()` and `output()`, never `@Input()`/`@Output()`:
  both are the project's style.

## TypeScript configuration

One line in `tsconfig.json`:

```json
"experimentalDecorators": true
```

`@Component` is a legacy TypeScript decorator and does not compile without it.
`vite.config.ts` carries the Analog plugin and its `transformFilter`, and
`tsconfig.app.json` gives the plugin its files, as Compilation describes. All
three are in place in the product; a slice changes none of them.

## Embedding

Angular mounts inside the retained React parent through `createApplication()`
plus `createComponent()`, called from a React effect on a `ref`. The effect
destroys the application on unmount.

Not Angular Elements: registering custom elements adds a layer of plumbing
between React and the component for no gain when React already owns the host
node.

## Angular target structure

Decided by the project on 2026-09-11 and held as rules in
`docs\angular-structure.json`. `scripts\migration-map.mjs --measure` applies
them to every product file, so a run reads a file's Angular target from the
metrics and never derives a path by hand.

- One Angular root, `src\angular\`; React keeps `src\app\`.
- Inside it `core\`, `shared\` and `domains\`, as `HorizonUICodeReview.md`
  lays out, with four domains: `floor-plan`, `route`, `package` and
  `platform`.
- One component per file; tests as Test location says.
- The compiler's `transformFilter` and the `tsconfig.app.json` include are
  anchored to `src/angular/` (`buildScoping` in the structure file).
- Framework-agnostic code stays where it is and Angular imports it: drawlib,
  the REST and socket services, `StoreWrapper`, enums and types.

State and hooks are placed by usage. A store or service that one domain uses
lives in that domain's `store\` or `services\`; one that several domains use,
or only the shell, lives in `core\store\` or `shared\services\`. Usage is
found by walking a file's importers up until each path reaches a file with a
domain; `src\app\App.tsx` and `main.tsx` only compose providers and do not
count.

A prerequisite's Angular counterpart is built at its measured target, where
every later slice that needs it finds the one counterpart.

The first slice still sits in `lineForm\angular\`, under the provisional rule
this replaces. Its relocation to the target (`firstSliceRelocation` in the
structure file), with the filter and include re-anchored, is pending in the
product; until then Compilation describes the configuration as it stands.

## Change detection

Zoneless, through `provideExperimentalZonelessChangeDetection()` in the
application providers. On Angular 19 that is still the experimental name; the
stable `provideZonelessChangeDetection()` arrives in Angular 20.

zone.js patches `setTimeout`, `addEventListener` and `Promise` globally. In an
application that stays React for years, that reaches every other screen, not
just the migrated fields.

Consequences for how components are written:

- a view re-renders only when a signal its template reads changes, a template
  or host listener fires, `setInput()` is called, or `markForCheck()` runs. A
  value that arrives from outside Angular — a store subscription, a SignalR or
  socket event, a REST promise, a `setTimeout` such as `FocusNumberInput`'s
  debounce — is written into a signal, or the view stays stale without an
  error;
- every migrated component uses `ChangeDetectionStrategy.OnPush`: Angular's
  zoneless guide recommends it, and Hub Dashboard UI already uses it;
- state derived from other state is a `computed()`. `effect()` only pushes
  state out to something imperative (drawlib, SVG.js, `localStorage`), never
  into another signal, which Angular warns causes
  `ExpressionChangedAfterItHasBeenChecked` errors and update loops;
- a subscription a component opens is released through
  `inject(DestroyRef).onDestroy()`, because the application is destroyed on
  unmount (Embedding) and a live subscription would outlive it;
- only stable APIs: on 19, `linkedSignal` and `@angular/core/rxjs-interop`
  (`toSignal`, `takeUntilDestroyed`) are developer preview, `resource` and
  `httpResource` are experimental, and Signal Forms do not exist yet.

`scripts\angular-conventions.mjs` checks the rules a pattern can find, on both
this section and Compilation, and `run-context.mjs --contract` reports them as
`angularConventions`.

## Timing

Behaviour that a migrated field inherits from its React counterpart is
preserved exactly, including `FocusNumberInput`'s 300 ms debounce and its
suspension of global keyboard shortcuts while focused. Angular's own timing is
not a substitute: the premise of every migration in this project is that
behaviour does not change, and a characterization test cannot state what it
proves if the target timing is open.

## Test location

`<feature directory>\__tests__\`, beside the code it covers, matching the
existing `lineForm\__tests__\LineForm.functions.test.ts`. A write allowlist
that requires characterization tests must contain this directory.

An Angular test is `__tests__\<name>.spec.ts` beside the Angular file it
tests, named after that file: `juno-settings.store.spec.ts`, not
`use-juno-settings.spec.ts`. The measured target of the file it tests sets the
folder.

## Coverage

CI measures it. `.gitlab-ci.yml` runs `npm run test:ci` with coverage, keeps
`coverage/` as a build artifact, and uploads `coverage/lcov.info` to SonarQube
project `Lely-Route-Assistant-Frontend` on merge requests.

A run does not reproduce this and does not ask about it. Per-flow figures that
were not fetched are recorded as not retrieved, never as unavailable: the
measurement exists, the retrieval did not happen. Never run `test:ci` in the
product repository; it writes `coverage/` and `junit.xml`, neither of which is
gitignored.

## Manual verification environment

The Route Assistant desktop application, running the local frontend and the
local backend. Its title bar carries `localhost` and `react mode: development`
badges beside the version string.

Not a standalone browser tab and not Storybook. The drawer renders inside the
application's WebView at the application's window size, so padding, spacing and
input containment are only measurable there, and keyboard shortcut behaviour is
host behaviour.
