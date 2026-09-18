---
name: flow-verify
description: Independently verify one migrated React-to-Angular flow against its Flow Contract and report PASS, FAIL or BLOCKED. Requires a high-capability model from a different family than flow-migrate. Use only with /flow-verify.
---

# Flow Verify

Pipeline: `/flow-plan` -> `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`,
with `/flow-debug` as the repair loop back into a fresh `/flow-verify`, and a
`PASS` back into `/flow-plan`.
This skill is the third stage and judges the second one's work independently.

Skill version: `0.27.0`.

Recommended model: a different model family than `flow-migrate` used for this
flow, for example GPT-5.6-Terra or GPT-5.5 when `flow-migrate` ran on Gemini
or Claude, so the verifier does not inherit the migrator's blind spot.

Independently verify one bounded migration against the same contract that
constrained `flow-migrate`. Never repair product code, alter skill source or
decide that a failed criterion is acceptable.

`<lab>` is the migration-skill-lab root. Its `scripts\` perform the
deterministic steps; never do one of them by hand.

## Inputs

The invocation names `flow-contract.json`, `migration-result.json`, `<lab>`,
the product root and the run directory, and on every attempt after a repair
also `debug-result.json`.

- Validate first:
  `node "<lab>\scripts\validate-handoff.mjs" <flow-contract.json> <migration-result.json>`,
  adding `debug-result.json` when there is one. Stop with `BLOCKED` when an
  artifact is missing, incompatible, inconsistent or outside the declared flow.
- Run
  `node "<lab>\scripts\run-context.mjs" --product-root <product> --run-dir <run-dir> --save-status --contract <flow-contract.json>`.
  A saved `<flowId>-flow-verify-prompt.md`, or `-prompt-<N>.md` on attempt N
  below, means an earlier phase chose to continue later: say so in one line
  and resume from the artifacts it names. Another attempt's prompt is spent.
- From the contract: `scenarios`, `visualParity`, `renderedSurfaceInventory`,
  `characterizationRequired`, `scope`, the test, typecheck and build commands, `checkpointPolicy` and
  `validationPlan.manualValidation`. The walkthrough's items are the
  `scenarios` and `visualParity` entries themselves; `manualValidation` gives
  the environment it runs in and the route through them, with the concrete
  test data. There is no owner to look for: the person in this chat is the
  tester, and this skill leads them.
- **Attempt.** Without a debug result this is attempt 1, with the file names
  used below. After a repair it is one more than the attempt the debug result
  answers: `debug-result.json` answers 1, `debug-result-<N>.json` answers N.
  Attempt N from 2 on records `verificationAttempt` N and adds `-<N>` to every
  file it writes, such as `verification-result-2.json` and
  `debug-handoff-2.json`, because the debug artifacts hash the earlier
  attempt's files.

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

1. Take the product status from `run-context.mjs`; change nothing. Then run
   `node "<lab>\scripts\baseline-freshness.mjs" --contract <run-dir>\flow-contract.json --product-root <product> --run-dir <run-dir>`.
   This repeats `flow-migrate`'s first step on purpose: the integration branch
   can move while a migration is in progress, and this skill judges against the
   contract, so it must know the contract still describes today's React. On
   `STALE` the contract's React sources changed after the baseline was
   measured, so both the scenarios and the visual baseline describe code that
   no longer exists; the result is `BLOCKED` with the changed paths named, never
   a `PASS` and never a `FAIL`, because the migration is not what went wrong.
   `INVALID` is `BLOCKED` too: an unanswerable freshness question is not a
   fresh baseline. Pass `--run-dir` so an already-landed slice is recognized as
   a call made out of order rather than measured.
2. **Automated evidence.** Run the declared targeted test, typecheck and build;
   expand only with a reason recorded in the result. Take the allowlist check
   from `allowlist.outside` in the `run-context.mjs` output, never by hand: a
   path there is `FAIL` unless the user confirms it was dirty before the
   migration. Each `angularConventions` finding there is `FAIL` too, with its
   `rule` and `constant` as the diagnosis. Check that the migration result reports failed or blocked
   validation honestly. Check coverage only for this flow,
   only through the safe measurement the contract's `testGaps` names, and
   record a figure CI measures as not retrieved; a percentage supports, never
   proves.
3. **Map every scenario** to direct evidence from tests, the migration result
   or the manual walkthrough. Compare the rendered drawer with
   `renderedSurfaceInventory`: an omitted retained control, action or
   conditional branch is `FAIL`, even when the migrated fields pass.
   Every hypothesis `migration-result.characterization` records as
   `disproved` was migrated on a corrected assumption: test each scenario its
   contract entry names in `proveBefore` explicitly, never by the hypothesis
   it replaced.
4. **Lead the manual walkthrough** in `manualValidation.environment`, along
   its route. Do not ask whether someone did it already; conducting it is this
   skill's work. The desktop app shows whichever checkout serves the local
   frontend, so before the first item the tester starts it from `<product>`,
   this slice's worktree, and stops any other slice's. Build each item from its `scenarios` or `visualParity` entry,
   never from a retelling of it, and treat the entries in
   `migration-result.limitations` as places a difference is already expected.
   Present one item at a time:
   - name each item by its contract `visualParityId` and `surface` text, never
     by invented shorthand such as "V1";
   - a `visualParity` item asks about each element its `styleSources` paint
     (icon, label, value, unit, border, spacing) against the counterpart in the
     same view, so one pass finds every deviation and one debug handoff
     carries them all;
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
5. **Visual evidence.** Measure before you judge. When the run directory holds
   a `visual-selectors.json`, run
   `node "<lab>\scripts\visual-measure.mjs" --spec <run-dir>\visual-selectors.json --label after --out <run-dir> [--port <n>]`
   against the real host, then, when `visual-measurement-before.json` exists
   too, `node "<lab>\scripts\visual-measure.mjs" --compare <run-dir>\visual-measurement-before.json <run-dir>\visual-measurement-after.json`.
   The label is a file name, so attempt N from 2 on measures as `after-<N>` and
   compares that file instead; a plain `after` would overwrite the measurement
   and the screenshots the earlier attempt failed on. The `before` is measured
   once and every attempt compares against it.
   Its `evidence` strings are already written for this field: paste the ones
   for a surface into that surface's `evidence` verbatim rather than
   summarizing them, because a number a reader can check is the point. The
   script exits non-zero when a surface could not be measured or compared, so
   treat a non-zero exit as a result to act on, not as noise; `--allow-missing`
   is for ad-hoc diagnosis and has no place in this step. When it refuses
   because the host shows a robot the spec did not record, load the robot the
   baseline named and measure again: that is a wrongly prepared host, not a
   finding about the migration. Weigh the four
   deviation classes differently: `introducedByMigration` is this slice's
   doing, `changedExistingDeviation` is a deviation React already had that
   this slice then altered — also this slice's doing — while
   `preExistingDeviation` is unchanged inherited debt, and failing a surface
   for it sends `flow-debug` after a defect this migration did not create.
   `unmeasuredBefore` means the before run never measured that property, so
   nothing can be concluded about cause. When `beforeCounterpartStatus` is not
   `measured` the classification could not be made at all, so say in
   `diagnosis` that the cause is unproven rather than assuming either way.
   A surface whose `status` is `counterpart-not-found` lost the sibling it is
   compared against between the runs: no parity comparison exists for it, so
   it is `BLOCKED`, never a `PASS`. Read the `screenshot` block too: matching
   numbers with differing pixels is a real finding — a wrong icon or glyph
   moves no computed property — so open both PNGs before calling such a
   surface a `PASS`. A surface that came back `found: false` while the host
   answered is a selector that no longer matches the migrated DOM, and a
   `matches` above one is a selector that matches several elements and so
   cannot identify anything. Neither is repaired by quietly editing the
   selector: the before run measured the old one, and a comparison across two
   different selectors is reported as `selector-changed` and is worthless.
   Re-measure only when the baseline's selector is provably the same element;
   otherwise that surface is `BLOCKED`. Read
   `fingerprint.status` first. On `incompatible` the two runs saw different
   robots: capability gates add and remove whole sections, so the runs
   described different forms and nothing in the comparison means anything.
   Every surface is `BLOCKED`, never a `PASS` and never a `FAIL`; say in
   `diagnosis` which robots the two runs saw, and re-measure the after under
   the robot the baseline used. On `drifted` the two runs saw different window
   sizes, so treat every before/after difference as indicative and say so in
   `diagnosis` instead of failing the surface on it; differences against the
   retained counterpart in the same run stay authoritative. A missing
   before-measurement is not a blocker here — the counterpart comparison still
   measures — but say in `diagnosis` that it was absent. When no host answers,
   the measurement was not performed, and a surface that needed it is
   `BLOCKED`, never a `PASS` from reading the code.
   Write one `visualCriteria` entry per `visualParity`
   surface with its own status, evidence source, evidence and diagnosis,
   measured against that surface's declared `appearance` and `layout`, not
   against a fresh reading of the React source. The verdict is assigned here,
   never carried over from the migration result. Record comparable visual
   evidence or observed layout values from the actual drawer, including a
   migrated field's width, alignment and spacing against its retained
   siblings; a field-presence check alone is not a `PASS`.
   Report every deviation the pass found, not the first: a measured run that
   names one difference and stops sends `flow-debug` back for a second round it
   could have avoided.
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
8. **Write `verification-result.json`.** Scaffold it with
   `node "<lab>\scripts\new-result.mjs" --artifact verification-result --status <PASS|FAIL|BLOCKED> --skill-version <this skill's version> --run-dir <run-dir> <flow-contract.json> <migration-result.json> [<debug-result.json>]`.
   It names the file for the attempt, hashes the artifacts it consumed and
   writes one criterion per scenario and per `visualParity` surface. Replace
   every `TODO` with this run's evidence and diagnosis, then confirm none is
   left with `--check`. Write no prose report: the JSON is canonical. In the
   chat, show one line per scenario and per visual criterion and the overall
   status.
9. Validate the complete chain, debug artifacts included, with
   `validate-handoff.mjs`. Run
   `node "<lab>\scripts\run-context.mjs" --product-root <product> --compare`
   and report any delta.
10. **Continuation.** A `FAIL` or repairable `BLOCKED` goes to a fresh
    `/flow-debug`:
    `node "<lab>\scripts\continuation.mjs" --next flow-debug --lab-root <lab> --product-root <product> --run-dir <run-dir> <flow-contract.json> <migration-result.json> <verification-result.json> <debug-handoff.json>`.
    A `PASS` leads to a fresh `/flow-plan`, which lands this slice on the
    migration map and proposes the next:
    `node "<lab>\scripts\continuation.mjs" --next flow-plan --lab-root <lab> --product-root <product> --run-dir <run-dir> <verification-result.json>`.
    From a slice worktree it prints a `slice-worktree.mjs --land` command first.
    Show it for the user to run in a terminal before `/flow-plan`: it commits the
    slice, merges it into the integration branch and writes `land-receipt.json`,
    the fact `/flow-plan` treats as landed, none of which this skill ever does
    itself.
    Offer exactly three routes and perform only the chosen one:
    1. a fresh chat opened now through the host's own mechanism, carrying only
       the invocation. Open `flow-debug` as an `independent` session with its
       recommended model set explicitly when it differs in provider from this
       chat's, since a same-session chat only offers this chat's own
       provider's models; `flow-plan` can stay in this chat's provider, since
       its own recommendation (Claude Sonnet 5) is reasoning-, not
       family-diversity-driven. Never start a second terminal window;
    2. the invocation shown here, to paste into a chat the user opens;
    3. the same command with `--save`, a checkpoint rather than an
       abandonment, since every phase reads only artifacts.
    Never continue in this chat, spawn a debug subagent or delegate to a
    background agent. A repaired result always returns to a new independent
    verification chat; debug context is never proof.
11. **Observations.** Read `<lab>\docs\flow-observation-capture.md` and follow
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
  but the contract's `expectedBranch`, or push without every condition in
  `references/push.md`;
- update Targetprocess;
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
