---
document: project-constants
version: 0.3.0
status: decided
date: 2026-09-11
---

# Project constants

Facts about this migration that do not change per flow. A skill reads this file
once per run and states what it found; it never asks the user for anything on
this page.

Every entry here was a question a run used to ask, or an open question that
blocked a later phase. Changing one is a deliberate project decision, not a
per-run choice: edit this file, and the next run picks it up.

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

Superseded on 2026-09-11: the previous decision (pure JIT, no build tooling)
rested on "Vite 8.2.1 is too recent for a build-time compiler", which was
factually wrong — `@analogjs/vite-plugin-angular@2.7.2` officially supports
Vite `^6 || ^7 || ^8` and Angular `19..22`, confirmed via npm and proven with
a live spike against the first migrated slice
(`lineForm/angular/line-fields.component.ts`) before adopting it for real.

The plugin runs `fastCompile: true` with `disableTypeChecking: true`: the
default (non-fast) AOT path silently emitted an empty transform for this
component instead of a working error, and no working configuration was found
in the time spent on the live migration. `fastCompile` is documented by
`@analogjs/vite-plugin-angular` as skipping Angular's template type-checking
in exchange for a working single-pass compile; the plugin's own docs suggest
running `ngc -p tsconfig.app.json --noEmit` as a separate check, but that path
picked up pre-existing, unrelated TypeScript errors elsewhere in the repo
(outside `tsconfig.app.json`'s intended scope) and was not pursued further.
This is a known gap: Angular template type errors in a migrated component are
not caught before Vitest/manual testing catches them. Revisit if this proves
costly in practice.

The Angular plugin is disabled during Vitest runs (`process.env.VITEST`
guard in `vite.config.ts`): enabling it there broke 8 unrelated tests in
`src/state/__tests__/EditorSettingsManager.test.ts` (`TypeError: Cannot
redefine property: window`), a side effect of the plugin's own Vitest
integration path, unrelated to any migrated component. Tests do not need the
plugin: they exercise the same runtime-JIT `createApplication()`/
`createComponent()` mount path described under Embedding below, which stays
in the bundle regardless of the build-time compiler.

Consequences for how components are written:

- `styles` (and `template`, if ever moved out of the same literal) must be a
  statically analyzable string literal — no `${...}` JS interpolation.
  Design-token values that used to be interpolated directly into `styles` are
  now exposed as CSS custom properties (`var(--foo)`) in the static `styles`
  string, with their actual values supplied at runtime through a
  `host: { "[style]": "hostTokenStyle" }` binding (host bindings may be
  dynamic; `styles`/`template` may not). See
  `lineForm/angular/line-fields.component.ts` for a full example
  (`hostTokenStyle`);
- dependencies still come from `inject()`, never constructor parameters — this
  was a JIT-only requirement previously, but is kept as the project's DI style
  regardless;
- inputs and outputs still use the signal forms `input()` and `output()`,
  never the `@Input()`/`@Output()` field decorators — same reasoning as above,
  kept as a style choice independent of the compiler.

Previously inline templates were mandatory (`.html` files needed a custom
`resourceLoader` under pure JIT, which never existed). That constraint is
gone: `templateUrl`/`styleUrl` now work like any Angular CLI project, because
the build-time compiler statically resolves and inlines them at compile time.
Splitting a large component's template/styles into separate files is a
reasonable readability improvement going forward, but is not mandated by this
document; it is a per-component call.

### Passing inputs to a mounted component

`componentRef.setInput()` was previously broken here because signal-based
`input()` fields never receive `ɵcmp.inputs` metadata under pure JIT, which
build-time compilation now emits. This has not yet been re-verified end to
end on the existing mount code
(`lineForm/angular/mount-line-fields.ts`'s `setAdapterInputs()` workaround);
treat `setInput()` as newly *possible*, not yet *confirmed*, until a slice
tries it and the workaround is removed or kept on its own merits.

## TypeScript configuration

One line in `tsconfig.json`:

```json
"experimentalDecorators": true
```

`@Component` is a legacy TypeScript decorator and does not compile without it.
Nothing else in `tsconfig.json` changes, and `vite.config.ts` is not touched, so
the dependency surface of an Angular slice is `package.json`,
`package-lock.json` and `tsconfig.json`.

## Embedding

Angular mounts inside the retained React parent through `createApplication()`
plus `createComponent()`, called from a React effect on a `ref`. The effect
destroys the application on unmount.

Not Angular Elements: registering custom elements adds a layer of plumbing
between React and the component for no gain when React already owns the host
node.

## Angular counterpart location

An Angular file lives in an `angular\` folder beside the React file it
replaces or mirrors. A slice's own components sit beside the React component
they mount in, as `lineForm\angular\` does. A shared component or state
adapter sits beside its React original, such as
`src\components\radioButton\angular\`, where every later slice that needs it
finds the one counterpart instead of building its own.

Provisional until the Frontend Chapter chooses the Angular target structure.
Moving the `angular\` folders there is then a relocation, not a rewrite.

## Change detection

Zoneless, through `provideExperimentalZonelessChangeDetection()` in the
application providers. On Angular 19 that is still the experimental name; the
stable `provideZonelessChangeDetection()` arrives in Angular 20.

zone.js patches `setTimeout`, `addEventListener` and `Promise` globally. In an
application that stays React for years, that reaches every other screen, not
just the migrated fields.

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
