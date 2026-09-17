---
document: split-resource-probe-prompt
version: 0.1.0
status: draft
date: 2026-09-17
---

# Probe: can a split component run under Vitest?

Run this in a fresh Copilot CLI chat, started the same way as the flow skills
so it can read both the product and the lab, by typing:

`Read C:\Project\migration-skill-lab\docs\split-resource-probe-prompt.md and carry out everything below its first horizontal rule.`

---

## Why this probe exists

`<lab>` is `C:\Project\migration-skill-lab`; the product is
`C:\Project\frontend`.

The Angular v19 style guide, Style 05-04, says "Do extract templates and
styles into a separate file, when more than 3 lines", at the strongest
recommendation level the guide has, and gives readability and editor support
as the reasons. The migrated components in this product do the opposite: all
of them keep `template` and `styles` inline.

`docs\component-file-layout-research-prompt.md` and its report of 2026-09-17
established why, and where the evidence stops. The Analog plugin is off under
Vitest (`vite.config.ts`), so a component spec compiles its component through
runtime JIT, and nothing in the test setup configures
`resolveComponentResources` or a `ResourceLoader`. That makes external
`templateUrl`/`styleUrl` resources *unproven* on the test path — not proven
broken. The research could not settle it, because the product was read-only
there.

Everything downstream waits on that one fact:

- if external resources load, the project can follow 05-04 and split;
- if they do not, inline stays as a deliberate, evidence-backed deviation from
  05-04, with the reason written into the project constants instead of the
  obsolete one the flow contracts carry today.

Do not reason the answer out. Vite resolves `.css` natively but does not treat
`.html` as a module, so the template and the stylesheet can behave
differently. Probe them separately.

## Read first, once

- `<lab>\docs\project-constants.md`, especially Compilation and Embedding.
- The report
  `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\2026-09-17-component-file-layout-research.md`,
  Part B in particular.
- In the product: `vite.config.ts`, `test\setup.ts`, and the existing spec
  `src\angular\domains\floor-plan\pages\floor-plan-creator\detail-drawer\straight-strip-form\__tests__\straight-strip-length.component.spec.ts`.
  That spec is the mount pattern you copy.

## Boundaries

This prompt is the exception to the lab's read-only rule, and the exception is
narrow. Read it as a whitelist: anything not named here is forbidden.

- You may create exactly one folder, `src\angular\__scratch__\split-probe\`,
  and files inside it. Nothing else in the product may be created, edited,
  renamed or deleted.
- You may run exactly one kind of command against the product:
  `npx vitest run src/angular/__scratch__/split-probe`. No installs, no build,
  no branches, no stashes, no commits, no other test run.
- Do not change `vite.config.ts`, `tsconfig*.json`, `package.json`,
  `test\setup.ts` or any existing component or spec. If the probe would only
  pass after such a change, that is a finding to report, not a change to make.
- Record `git rev-parse HEAD` and `git status --porcelain` at the start, and
  again after cleanup. The final status must be empty. If it is not, say so at
  the top of the report and list what is left over.
- Do not edit any skill, reference, script, schema or constant in the lab.
  Proposals go in the report.
- Label every claim `Confirmed`, `Observed`, `Inference` or `Open question`.

## Part A: build the probe

Three components, so that a template failure and a stylesheet failure cannot
be mistaken for each other. Use a distinct colour per component, so the report
can say which stylesheet actually applied.

1. **Control, everything inline.** Selector `probe-inline`, standalone,
   `template` rendering `<p class="probe">inline-ok</p>`, `styles` setting
   `.probe { color: rgb(1, 2, 3); }`.
2. **External template only.** Selector `probe-template`, standalone,
   `templateUrl: "./split-probe-template.component.html"` containing
   `<p class="probe">template-url-ok</p>`, and inline `styles` setting
   `.probe { color: rgb(4, 5, 6); }`.
3. **External stylesheet only.** Selector `probe-style`, standalone, inline
   `template` rendering `<p class="probe">style-url-probe</p>`, and
   `styleUrl: "./split-probe-style.component.css"` containing
   `.probe { color: rgb(7, 8, 9); }`.

Then one spec, `__tests__\split-probe.component.spec.ts`.

Do not invent a mount harness. Copy the mount pattern from
`straight-strip-length.component.spec.ts` exactly — the same
`createApplication()`/`createComponent()` path, the same zoneless providers,
the same teardown — and swap in each probe component. The question is about
that path; a different harness answers a different question.

Give each probe its own `it()` block so one failure cannot hide the other two
answers, and assert on rendered content, never merely on the absence of a
thrown error:

- control: the host contains the text `inline-ok`, and
  `getComputedStyle` of the `p` reports `rgb(1, 2, 3)`;
- template: the host contains the text `template-url-ok`;
- stylesheet: `getComputedStyle` of the `p` reports `rgb(7, 8, 9)`.

A template that fails to load can render as an empty component without
throwing, and a stylesheet that fails to load never throws at all. A probe
that only checks for errors returns a false green.

## Part B: run it and record what happened

Run `npx vitest run src/angular/__scratch__/split-probe` once. Report, per
`it()` block: pass or fail, and on failure the exact error text, trimmed to
the part that names the cause.

If the run hangs, that is itself a finding and it matches an earlier report of
a targeted Vitest run hanging past two minutes on this project. Wait at least
three minutes before stopping it, then report how long you waited, what output
had appeared, and that no probe result was obtained. Leave no background
process running.

## Part C: read the outcome

State which row you landed on, with the evidence from Part B.

| Outcome | Meaning |
|---|---|
| All three pass | Splitting is available; the project can follow 05-04. |
| Control and stylesheet pass, template fails | Hybrid: stylesheet to its own file, template stays inline. |
| Control passes, the other two fail | Inline stays, as a documented deviation from 05-04. |
| Control fails | The harness is wrong; nothing is proven about splitting. |
| Run hangs | Nothing is proven; the hang becomes the next question. |

Then give the smallest lab change the outcome implies, ordered script rule
first, then constant, then one skill sentence. Name in particular what
`scripts\angular-structure.mjs:119` should map an `X.styles.ts` to under this
outcome, and what the styling sentence in the flow contracts should say and
cite. Propose, do not apply.

## Part D, optional: does setInput() work yet?

Only if Part B produced a result and time allows, and in a separate spec file
so the Part A probes stay clean. `docs\project-constants.md:108-110` records
`componentRef.setInput()` as newly possible but unconfirmed, with
`mount-line-fields.ts`'s `setAdapterInputs()` workaround still in place.
Mount a probe component with one signal `input()` through the same harness,
call `setInput()`, and report whether the value arrives. This decides whether
the imperative `@ViewChild` and `ngAfterViewChecked()` wiring in the migrated
components is still necessary — the larger readability question of the two.

## Cleanup

Delete `src\angular\__scratch__\split-probe\` and the `__scratch__` folder if
it is now empty. Then run `git status --porcelain` in the product and paste
the result. It must be empty. The probe is an experiment, not a contribution.

## Deliverables

1. A report at
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\<YYYY-MM-DD>-split-resource-probe.md`:
   the outcome row first, in one line; then the per-block results with error
   text; then the proposed smallest lab change; then Part D if run; then the
   start and end `git rev-parse HEAD` and `git status --porcelain`.
2. In `<lab>\runs\<YYYY-MM-DD>-split-resource-probe-1\`: the probe source
   files as they were run, so the experiment can be repeated, and the raw
   Vitest output.
3. In the chat: the outcome row and the proposed lab change, nothing else.

Before delivering, check that each of the three probes has a stated result or
a stated reason why it has none, that every assertion was on rendered content
rather than on the absence of an error, that the proposed change names a
concrete file, and that the product is back to an empty `git status`. Correct
every failure first.
