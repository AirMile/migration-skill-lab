---
document: test-compilation-probe-prompt
version: 0.1.0
status: draft
date: 2026-09-17
---

# Probe: can the test path compile components the way the build does?

Run this in a fresh Copilot CLI chat, started the same way as the flow skills
so it can read both the product and the lab, by typing:

`Read C:\Project\migration-skill-lab\docs\test-compilation-probe-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this probe exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

The Angular v19 style guide, Style 05-04, says "Do extract templates and
styles into a separate file, when more than 3 lines", at the strongest
recommendation level it has. This project does the opposite everywhere, and
the probe of 2026-09-17 (`docs\split-resource-probe-prompt.md`) showed why it
has to: both `templateUrl` and `styleUrl` fail under Vitest with
`Component ... is not resolved: Did you run and wait for
'resolveComponentResources()'?`, while the inline control passes.

That was read as "stay inline". It is the wrong conclusion to stop on. The
failure is not a limit of Angular; it is a hole in this project's test setup,
and the hole is small. `docs\project-constants-history.md:35-42` records that
the Angular compiler plugin is disabled under Vitest because enabling it broke
**eight tests in one file**, `src\state\__tests__\EditorSettingsManager.test.ts`,
with `TypeError: Cannot redefine property: window`, described there as a side
effect of the plugin's own Vitest integration and unrelated to any migrated
component. That measurement has not been retried since.

Letting a test-setup workaround decide the file layout of every future
component is backwards, and the file layout is only the visible symptom. The
deeper issue is that components are compiled one way in tests and another way
in the build, so a spec does not exercise what ships. There may be other
consequences nobody has hit yet.

Two routes could close this. Part A is contained and test-only. Part B is the
real fix and may or may not be cheap. Measure both, recommend one. You are not
adopting either: no skill, script, constant or contract changes in this run.

## Read first, once

- `<lab>\docs\project-constants.md`, Compilation and Embedding.
- `<lab>\docs\project-constants-history.md:20-42`. It records both why
  `fastCompile` was chosen and why the plugin is off under Vitest, including
  the known gap that template type errors are not caught before testing.
- The report
  `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\2026-09-17-split-resource-probe.md`.
- In `<lab>\runs\2026-09-17-split-resource-probe-1\`: `probe-inline.component.ts`,
  `probe-template.component.ts`, `probe-style.component.ts`,
  `split-probe-template.component.html`, `split-probe-style.component.css`,
  `__tests__\split-probe.component.spec.ts` and `vitest-output.txt`. These are
  the known-failing case you re-run.
- In the product: `vite.config.ts`, `test\setup.ts`,
  `src\state\__tests__\EditorSettingsManager.test.ts`, and
  `src\angular\domains\floor-plan\pages\floor-plan-creator\detail-drawer\straight-strip-form\__tests__\straight-strip-length.component.spec.ts`.

## Boundaries

This probe changes shared configuration, because that configuration is the
subject. Every change is temporary and every change is reverted.

- You may temporarily modify `vite.config.ts` and the test setup, and you must
  restore them before finishing.
- You may create `src\angular\__scratch__\split-probe\` with the saved probe
  files, and you must delete it.
- You may run targeted Vitest commands. You may not commit, branch, stash,
  install, or run a production build.
- Do not modify any existing component, spec or shipped source file other than
  the configuration named above.
- Record `git rev-parse HEAD` and `git status --porcelain` at the start and
  again after cleanup. **The final status must be empty.** If it is not, say so
  in the first line of the report and list exactly what is left over; do not
  quietly force it clean.
- If a route only works through a change that cannot be cleanly reverted, that
  is a finding to report, not a change to keep.
- Label every claim `Confirmed`, `Observed`, `Inference` or `Open question`.
- Keep external sources (Angular 19 documentation at `v19.angular.dev`,
  `@analogjs/vite-plugin-angular` documentation) separate from product
  evidence and label them as external.

## Part A: the contained route, resource resolution on the test path

Restore the three probe components and their spec from
`<lab>\runs\2026-09-17-split-resource-probe-1\` into
`src\angular\__scratch__\split-probe\`, unchanged, so this is a like-for-like
re-run of a case already known to fail.

Then add resource resolution to the test path only, using Angular's own
`resolveComponentResources`, awaited before any component is created, with a
loader that reads the referenced file in the Vitest environment. Try the
cheapest place first — the mount path the specs already share — and only then
a global setup file. Report which one worked and why the other did not, if you
tried both.

Re-run `npx vitest run src/angular/__scratch__/split-probe` and report per
`it()` block: pass or fail, with the exact error text on failure. Assert on
rendered content, as the original spec does; a template that fails to load can
render empty without throwing, and a stylesheet that fails to load never
throws at all.

Then answer three things:

1. Is the change test-only, or does any shipped file change?
2. Does `straight-strip-length.component.spec.ts` still pass with the resolver
   in place?
3. Does the resolver need to be repeated per spec, or does it apply once
   globally? That decides whether it is a one-line setup change or a thing
   every future spec must remember.

## Part B: the deeper route, run the build compiler in tests

Temporarily remove the `process.env.VITEST` guard in `vite.config.ts` so the
Angular plugin runs under Vitest. Then, in this order:

1. Run `src\state\__tests__\EditorSettingsManager.test.ts` alone. Capture the
   exact failure, including the stack frame that redefines `window`, and how
   many of its tests fail. State whether the eight-test figure from
   `project-constants-history.md:35-42` still reproduces.
2. Judge whether it is a small fix — a Vitest environment option, a mock or
   import ordering issue, a plugin option, a newer plugin version — or a
   genuine incompatibility. Give evidence, not an impression. Check the
   plugin's own documentation and changelog as an external source; the pin is
   `@analogjs/vite-plugin-angular@2.7.2`.
3. Run the existing Angular component specs with the plugin on, and report
   whether they still pass. If the plugin compiles them differently, that is
   the point of the exercise: say what changed.
4. Re-run the Part A probes with the plugin on and the Part A resolver
   removed. The plugin may inline external resources itself, which would make
   the resolver unnecessary and settle 05-04 outright.

Then restore the guard and confirm with `git status --porcelain`.

## Part C: recommend a route

One table with three rows — Part A, Part B, and staying inline. Columns: does
the evidence show it works; what it costs; what it unlocks; what risk it
carries.

Say explicitly whether either route makes the project compliant with Style
05-04, and whether Part B closes the wider gap that specs do not currently
compile components the way the build does.

Recommend one route and give the smallest change that adopts it, naming
concrete files, ordered configuration first, then constant, then one skill
sentence. Propose, do not apply.

If the recommendation is that neither route is worth it, say what the inline
rule should then cite as its reason, so the next team reads a measured
decision rather than an unexplained convention.

## Cleanup

Delete `src\angular\__scratch__\split-probe\`, and `__scratch__` if it is now
empty. Restore `vite.config.ts` and the test setup. Run
`git status --porcelain` in the product and paste the result; it must be
empty.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-test-compilation-probe.md`:
   the recommendation in one line first; then Part A and Part B with their
   results and error text; then the Part C table; then the start and end
   `git rev-parse HEAD` and `git status --porcelain`.
2. In `<lab>\runs\<YYYY-MM-DD>-test-compilation-probe-1\`: every probe,
   resolver and modified configuration file as it was actually run, and the
   raw Vitest output of each run, so the experiment can be repeated.
3. In the chat: the recommendation and the Part C table, nothing else.

Before delivering, check that each Part A block has a stated result, that Part
B question 2 is answered with evidence rather than impression, that every
assertion was on rendered content rather than the absence of an error, that
the Part C recommendation names concrete files, and that the product is back
to an empty `git status`. Correct every failure first.
