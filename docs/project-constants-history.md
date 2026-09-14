---
document: project-constants-history
date: 2026-09-14
---

# Project constants: history and reasoning

Why entries in `project-constants.md` were decided the way they were, and what
they replaced. No run reads this file; the constants page carries every rule a
run acts on. Moved here on 2026-09-14 so each skill that reads the constants
spends its context on the rules only.

## Compilation

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
`createComponent()` mount path described under Embedding, which stays in the
bundle regardless of the build-time compiler.

Static `styles`: design-token values that used to be interpolated directly
into `styles` are now exposed as CSS custom properties (`var(--foo)`) in the
static `styles` string, with their actual values supplied at runtime through a
`host: { "[style]": "hostTokenStyle" }` binding (host bindings may be dynamic;
`styles`/`template` may not).

`inject()` instead of constructor parameters, and `input()`/`output()` instead
of the field decorators, were JIT-only requirements at first; both are kept as
the project's style independent of the compiler.

Previously inline templates were mandatory (`.html` files needed a custom
`resourceLoader` under pure JIT, which never existed). That constraint is
gone: `templateUrl`/`styleUrl` now work like any Angular CLI project, because
the build-time compiler statically resolves and inlines them at compile time.
Splitting a large component's template/styles into separate files is a
reasonable readability improvement going forward, but is not mandated; it is a
per-component call.

### Passing inputs to a mounted component

`componentRef.setInput()` was previously broken here because signal-based
`input()` fields never receive `ɵcmp.inputs` metadata under pure JIT, which
build-time compilation now emits. This has not yet been re-verified end to
end on the existing mount code
(`lineForm/angular/mount-line-fields.ts`'s `setAdapterInputs()` workaround);
treat `setInput()` as newly *possible*, not yet *confirmed*, until a slice
tries it and the workaround is removed or kept on its own merits.

## Change detection

API status on Angular 19 was checked on 2026-09-14 against the `v19.angular.dev`
guides `experimental/zoneless`, `signals`, `signals/linked-signal`,
`signals/resource` and `ecosystem/rxjs-interop`. The rules came from a Gemini
best-practices report whose other proposals did not hold for Angular 19 or for
islands without SSR, routing or HttpClient; the evaluation is in
`runs\2026-09-14-angular-best-practices-audit-1\`.
