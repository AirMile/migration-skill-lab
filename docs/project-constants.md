---
document: project-constants
version: 0.1.0
status: decided
date: 2026-09-09
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

JIT. `@angular/compiler` ships in the bundle and compiles components while the
application runs.

There is no Angular Vite plugin and `vite.config.ts` is not touched. A
build-time compiler would have to support Vite `8.2.1`, which is recent, and a
run that stalls on build tooling has failed for a reason that has nothing to do
with the migration. The compiler in the bundle is the price, and it is a code
quality concern to revisit later; swapping to build-time compilation does not
change a single component.

Consequences for how components are written:

- templates are inline in `@Component`, never a separate `.html` file;
- dependencies come from `inject()`, never from constructor parameters, because
  constructor injection needs decorator metadata that JIT does not emit here;
- inputs and outputs use the signal forms `input()` and `output()`, never the
  `@Input()` and `@Output()` field decorators. `useDefineForClassFields` is
  `true` in this repository and field decorators conflict with it.

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
