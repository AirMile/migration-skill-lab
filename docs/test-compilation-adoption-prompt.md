---
document: test-compilation-adoption-prompt
version: 0.1.0
status: draft
date: 2026-09-17
---

# Adopt: run the Angular compiler under Vitest

Run this in a fresh Copilot CLI chat, started the same way as the flow skills
so it can read both the product and the lab, by typing:

`Read C:\Project\migration-skill-lab\docs\test-compilation-adoption-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this change

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

Unlike the two probes that came before it, **this prompt keeps its changes.**
It is an adoption, not a measurement.

The measurements are done and you do not need to repeat them. From
`C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\2026-09-17-test-compilation-probe.md`:

- With the Analog plugin enabled under Vitest, all three external-resource
  probes pass and all 15 existing Angular tests pass.
- The only breakage is eight tests in one file,
  `src\state\__tests__\EditorSettingsManager.test.ts`, failing with
  `TypeError: Cannot redefine property: window`. The cause is line 9 of that
  file, `vi.stubGlobal("window", {...})`, which replaces the entire `window`
  global rather than the parts the test uses.
- The contained alternative is dead: Angular 19.2.25 declares
  `resolveComponentResources` but does not export it at runtime.

So one over-broad test mock is why the Angular compiler is switched off during
tests, and why every migrated component keeps its template and styles inline
against the Angular v19 style guide, Style 05-04. Removing it lets components
follow the guide, and closes a wider gap: today a spec compiles its component
differently from the way the build does, so the test does not exercise what
ships.

## Read first, once

- `<lab>\docs\project-constants.md`, Compilation and Embedding.
- `<lab>\docs\project-constants-history.md:20-42`, which records both the
  `fastCompile` trade-off and the original eight-test measurement.
- The probe report named above.
- In the product: `src\state\__tests__\EditorSettingsManager.test.ts`,
  `vite.config.ts` and `test\setup.ts`.

## Boundaries

- You may change exactly two files: `src\state\__tests__\EditorSettingsManager.test.ts`
  and `vite.config.ts`. Nothing else in the product may be created, edited,
  renamed or deleted.
- Do not commit, branch, stash, install or run a production build.
- Do not edit any skill, reference, script, schema or constant in the lab. The
  lab-side change is a separate step that happens after this one is green.
- At the end, `git status --porcelain` must show exactly those two files and
  nothing else. Record `git rev-parse HEAD` and `git status --porcelain` at
  the start too.
- Label every claim `Confirmed`, `Observed`, `Inference` or `Open question`.

## Step 1: baseline the full suite before touching anything

Run the **whole** Vitest suite as it stands and record the file and test
counts, and the wall-clock duration. Without this number, "nothing else
broke" is not a claim you can make. Save the raw output.

## Step 2: fix the mock

Rework the mock in `EditorSettingsManager.test.ts` so it replaces only the
surface the tests actually use — the `window` listener registration the suite
exercises — instead of substituting the whole global.

Two constraints, and they matter more than the technique:

1. **All eight tests keep asserting the same behaviour.** This is a change to
   how the test sets up its world, not to what it checks. Do not delete a
   test, weaken an assertion, loosen a matcher, or mark anything skipped to
   get to green. That would trade eight real tests for eight that prove
   nothing.
2. **If a behaviour genuinely cannot be tested without replacing `window`**,
   stop and report that as a finding, with the specific test named. Do not
   work around it.

Run that file alone and report all eight passing, with the output.

## Step 3: remove the guard

Remove the `process.env.VITEST` guard in `vite.config.ts` so the Angular
plugin runs under Vitest as well as in the build. Change nothing else in that
file.

## Step 4: run the full suite again

Run the whole suite and compare against the Step 1 baseline:

- file and test counts, before and after;
- any test that passed before and fails now, named individually — this is the
  point of the exercise and the probe could not see it, because it only
  measured four files;
- wall-clock duration, before and after. The probe measured about 59 seconds
  for 15 Angular tests with the plugin on. If the full suite slows
  materially, report the number plainly; that is a trade-off for the user to
  weigh, not something to absorb quietly.

**If there are casualties beyond the eight tests you fixed**, do not leave the
repository in that state. Revert both files, confirm a clean
`git status --porcelain`, and report what broke. A red suite is a worse
outcome than an inline template.

## Step 5: confirm what this unlocks

With both changes in place and the suite green, restore the three probe
components and their spec from
`<lab>\runs\2026-09-17-split-resource-probe-1\` into a temporary
`src\angular\__scratch__\split-probe\`, run them, and confirm all three pass
with no resolver of any kind. Then delete that scratch folder again.

This is the proof that external templates and stylesheets now work on the test
path. Confirm the final `git status --porcelain` still shows only the two
intended files.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-test-compilation-adoption.md`:
   whether the suite is green, in one line, first; then the before and after
   counts and durations; then what changed in the mock and why it is
   equivalent; then the Step 5 result; then the start and end
   `git rev-parse HEAD` and `git status --porcelain`.
2. In `<lab>\runs\<YYYY-MM-DD>-test-compilation-adoption-1\`: the raw output of
   every run, the before and after versions of both changed files, and the
   probe output from Step 5.
3. In the chat: the one-line verdict, the before and after test counts and
   durations, and anything you reverted.

Before delivering, check that the eight tests assert what they asserted
before, that the full-suite comparison names any individual regression rather
than reporting only totals, that Step 5 ran without a resolver, and that the
product contains exactly the two intended changes and no scratch folder.
Correct every failure first.
