---
name: flow-verify
description: Independently verify one approved React-to-Angular migration flow against its Flow Contract and report PASS, FAIL or BLOCKED. Use only with /flow-verify.
---

# Flow Verify

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the third stage and judges the second one's work independently.

Skill version: `0.10.0`.

Recommended model: a different model family than `flow-migrate` used for this
flow, for example GPT-6 Astra or GPT-5.5, so the verifier does not inherit the
migrator's blind spot.

Independently verify one bounded migration against the same contract that
constrained `flow-migrate`. Never repair product code, alter skill source or
decide that a failed criterion is acceptable.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

The invocation names `flow-contract.json`, `migration-result.json`, both
work-item snapshots, `<lab>`, the product root and the run directory, and on
every attempt after a repair also `debug-result.json`.

- Validate first:
  `node "<lab>\scripts\validate-handoff.mjs" <flow-contract.json> <migration-result.json> <work-item-baseline.json> <work-item-migration.json>`,
  adding `debug-result.json` when there is one. Stop with `BLOCKED` when an
  artifact is missing, incompatible, inconsistent or outside the declared flow.
- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --run-dir <run-dir> --save-status`.
  A saved `<flowId>-flow-verify-prompt.md` means an earlier phase chose to
  continue later: say so in one line and resume from the artifacts it names.
- From the contract: `scenarios`, `visualParity`, `renderedSurfaceInventory`,
  `scope`, the test, typecheck and build commands, `checkpointPolicy` and
  `validationPlan.manualValidation`, whose scenario and environment are the
  whole manual instruction. There is no owner to look for: the person in this
  chat is the tester, and this skill leads them.
- The previous proposal's outcome is already in `work-item-migration.json`:
  quote it and ask whether it still holds, as a confirmation.

## Criterion status

| Status | Meaning |
|---|---|
| `PASS` | Direct evidence shows the agreed observable outcome. |
| `FAIL` | Direct evidence contradicts it. |
| `BLOCKED` | Required evidence could not be produced or reviewed. |

Every scenario and every `visualParity` surface gets its own status. Overall
`PASS` needs every one of them to pass; any `FAIL` makes the overall result
`FAIL`, and otherwise any `BLOCKED` makes it `BLOCKED`. A criterion whose
evidence is absent, contradicted or failed is never `PASS`, and coverage alone
never passes one. For each criterion record its id, the evidence, the command
status where relevant and, when it does not pass, the expected and actual
outcome, a diagnosis and the next action.

## Workflow

1. Take the product status from `run-context.mjs`; change nothing.
2. **Automated evidence.** Run the declared targeted test, typecheck and build;
   expand only with a reason recorded in the result. Check that the changed
   paths stay within the allowlist and that the migration result reports
   failed or blocked validation honestly. Check coverage only for this flow and
   only where measurement is approved; a percentage supports, never proves.
3. **Map every scenario** to direct evidence from tests, the migration result
   or the manual walkthrough. Compare the rendered drawer with
   `renderedSurfaceInventory`: an omitted retained control, action or
   conditional branch is `FAIL`, even when the migrated fields pass.
4. **Lead the manual walkthrough** in the environment the contract names. Do
   not ask whether someone did it already; conducting it is this skill's work.
   Build it from `scenarios` and `visualParity`, and treat the entries in
   `migration-result.limitations` as places a difference is already expected.
   Present one item at a time:
   - name each item by its contract `visualParityId` and `surface` text, never
     by invented shorthand such as "V1";
   - a step names the control, not the outcome: the button, the field by its
     visible label, the menu path, the keystroke. "Click the field labelled
     Length", not "check the length input". Use the real label, `dataTestId`
     and tab order from the source, and never a control you have not found
     there;
   - state the expected result verbatim inside the question: a modal covers the
     chat the moment it opens;
   - after ordinary steps ask for `ok`; after a step later steps depend on, ask
     for the concrete value the tester now sees, never one your own step
     supplied. Never ask for an observation a person cannot make, such as
     watching for a change without a known starting value or picking one row
     out of hundreds;
   - record one verdict per item before moving on: pass, fail, tweak (works,
     but I want it different) or cannot test. A bare "yes it works" earns one
     clarifying question, not a pass, and an item that already has a verdict is
     never asked again, so an interrupted walkthrough resumes where it stopped.
5. **Visual evidence.** Write one `visualCriteria` entry per `visualParity`
   surface with its own status, evidence source, evidence and diagnosis,
   measured against that surface's declared `appearance` and `layout`, not
   against a fresh reading of the React source. The verdict is assigned here,
   never carried over from the migration result. Record comparable visual
   evidence or observed layout values from the actual drawer, including a
   migrated field's width, alignment and spacing against its retained
   siblings; a field-presence check alone is not a `PASS`.
   Write `browserValidation.evidenceSource` as what you actually did. Under
   `scope.partialMount.nested` only `real-host-layout`, the real drawer reached
   through the product's own navigation, supports a `PASS`; an isolated fixture
   is supporting evidence at most. A shortcut recorded honestly yields
   `BLOCKED`; one recorded as real-host evidence is a false verification.
   A deviation the user would see is a `FAIL` on its own criterion: calling it
   a styling limitation describes it, it does not excuse it. A required manual
   host scenario that was not performed is `BLOCKED`.
6. **Non-PASS.** For an overall `FAIL` or `BLOCKED`, read
   `references/debug-handoff.md` and write `debug-handoff.json` as it says.
7. **Checkpoints and push.** When `migration-result.json` records committed
   checkpoints or `pushPolicy` is `confirm-after-pass`, read
   `references/push.md`. Otherwise record `push` as `not-requested` with the
   reason.
8. **Write `verification-result.json`** in the run directory, copying the shape
   from `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\handoff\detail-drawer-line-edit\verification-result.json"`.
   It references the exact hashes of the consumed contract and migration
   result. `push` always carries `remote`, `branch`, `commitShas` and
   `upstreamSet`, even with nothing to push, and `browserValidation.status`
   has `not-run`, not `not-applicable`. Write no prose report: the JSON is
   canonical. In the chat, show one line per scenario and per visual criterion
   and the overall status.
9. **Work-item snapshot.** Read `<lab>\docs\flow-work-item-steps.md` and follow
   it for `work-item-verification.json`, putting criterion, browser, host and
   push evidence on the verification Task. Propose Story `Done` only for an
   overall `PASS` with passed required host validation and every Task `Done`;
   keep the Feature and Epic open while their other Stories remain.
10. Validate the complete chain, debug artifacts included, with
    `validate-handoff.mjs`. Run
    `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare`
    and report any delta.
11. **Continuation.** A `FAIL` or repairable `BLOCKED` goes to a fresh
    `/flow-debug`:
    `node "<lab>\scripts\continuation.mjs" --next flow-debug --lab-root <lab> --product-root <product> --run-dir <run-dir> <flow-contract.json> <migration-result.json> <verification-result.json> <debug-handoff.json>`.
    A `PASS` leads to a fresh `/flow-baseline` for a next flow, offered only
    once the user has named that flow, with `--next flow-baseline --flow "<flow>"`;
    without one, report the `PASS` and stop. Offer exactly three routes and
    perform only the chosen one:
    1. a fresh chat opened now through the host's own mechanism, carrying only
       the invocation. Never start a second terminal window;
    2. the invocation shown here, to paste into a chat the user opens;
    3. the same command with `--save`, a checkpoint rather than an
       abandonment, since every phase reads only artifacts.
    Never continue in this chat, spawn a debug subagent or delegate to a
    background agent. A repaired result always returns to a new independent
    verification chat; debug context is never proof.
12. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
    it with `--primary <verification-result.json> --status PASS`, `FAIL` or
    `BLOCKED`.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out product
  files, or edit a skill, reference, schema or installed snapshot;
- install dependencies, change configuration or start a persistent service;
- replace a required manual or Maui validation with an unrecorded assumption,
  or mark a criterion `PASS` without direct evidence;
- publish, merge, create a pull request, force-push, push tags, push any branch
  but the approved one, or push without every condition in
  `references/push.md`;
- update Targetprocess or mark a proposal applied without the user's
  confirmation, mark a Story `Done` while a Task is incomplete, or derive
  progress from commit count;
- edit product code, choose a debug tier or treat a repair candidate as
  `PASS`;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data.

## Reading discipline

Context is spent once; every re-read pays again for nothing.

- Read a file once, at the range you need, and never re-read a range you hold.
- Widen or narrow a search instead of repeating it in other words.
- Learn an artifact's shape from `print-shape.mjs`, never from `schemas\`,
  `scripts\` or a whole example file; write the artifact and act on the
  validator's errors. Read the validator's rule only when an error names no
  fix and one retry fails, and record that as an observation.
- Resolve a module path, barrel or single file, before reading it.
