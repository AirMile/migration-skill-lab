---
document: skill-acceptance-criteria
skill: flow-verify
targetVersion: 0.18.0
status: experimental
date: 2026-09-14
---

# `flow-verify` v0.18.0 acceptance criteria

## Hard gates

A run fails immediately when it repairs product code, accepts invalid or
incompatible handoff artifacts, reports a passing criterion without evidence,
silently omits required host validation, or modifies a skill during its own
run.

## Required output

- Validated Flow Contract and migration result inputs.
- A criterion-by-criterion `PASS`, `FAIL` or `BLOCKED` result.
- Declared test, typecheck and build outcomes.
- Coverage evidence for the selected flow through the safe measurement the
  contract's `testGaps` names, or a CI figure recorded as not retrieved.
- Manual/Maui validation status and explicit blockers.
- A schema-valid `verification-result.json`, or `verification-result-<N>.json`
  on attempt N after a repair, and an inline summary, with no prose report.
- A concrete repair diagnosis for every `FAIL` or repairable `BLOCKED`.
- A schema-valid observation artifact written after the verification outputs,
  including an empty observation list when no concrete skill signal occurred.
- Reconciled checkpoint SHAs and an explicit push outcome.
- No work-item snapshot and no board update or progress proposal.
- A schema-valid debug handoff for every non-PASS result, classified as local
  repairable or external-blocked.

## Acceptance check

The source is acceptable when:

1. it requires the validator root and does not write product code or skill
   source;
2. it rejects a result whose flow ID or content hash does not match;
3. it rejects overall `PASS` when any scenario is not `PASS`;
4. it treats missing required manual host validation as `BLOCKED`;
5. it produces a schema-valid verification result for the example handoff.
6. it does not record product failures, expected blockers or missing convention
   evidence as skill defects;
7. observation capture cannot change the overall verification status.
8. push is impossible without overall PASS, passed required host validation,
   matching checkpoint SHAs, the contract's expected branch and explicit
   confirmation;
9. it never force-pushes, pushes tags or pushes another branch;
10. it proposes no board state, `Done` included, for any outcome;
11. it never updates Targetprocess.
12. it asks nothing about the board, such as whether a proposal was applied;
13. the invocation it accepts names no work-item snapshot.
14. regular-browser automation and required Maui host validation are reported
    separately and both pass before overall PASS when required;
15. repairable failures offer a user-confirmed fresh `/flow-debug` chat and external
    blockers do not;
16. a repaired result is always followed by a new independent verification
    attempt.
17. visual drawer parity is evaluated as a browser criterion, including the
    declared insets, spacing and input containment.
18. the actual drawer is compared with the rendered-surface inventory, and any
    missing retained control or conditional branch produces `FAIL`.
19. it records `browserValidation.evidenceSource` honestly, and never reaches
    overall `PASS` on `isolated-fixture` evidence when the contract declares
    a nested partial mount.
20. it shows the generated `--inline` handoff verbatim in the chat and marks
    an item that did not move as `no-change` rather than a no-op `update`;
21. it records one `visualCriteria` entry per surface the contract declares in
    `visualParity`, with its own status, evidence source, evidence and
    diagnosis;
22. overall `PASS` requires every visual parity criterion to pass, and a visual
    `PASS` under a nested partial mount requires `real-host-layout` evidence;
23. a visible appearance deviation is recorded as a `FAIL` on its own
    criterion rather than dismissed as a styling limitation.
24. it reads a file once at the range it needs, repeats no near-identical
    search, and reads no schema or script source in place of running the
    validator;
25. observation capture evaluates the countable checks against this run's own
    tool history, and an empty list means every check was evaluated and none
    fired rather than that none was looked for;
26. it conducts the manual validation instead of asking whether someone has
    performed it; there is no owner to look for, and the person in the chat is
    the tester;
27. a walkthrough step names the control — the button, the field by its visible
    label, the menu path, the keystroke — and never only the outcome, and never
    a control the source does not contain;
28. the expected result is stated verbatim inside the question, because a modal
    covers the chat the moment it opens;
29. items are named by their contract `visualParityId` and `surface` text, never
    by invented shorthand;
30. one verdict per item is recorded before moving on, a verdict never comes
    from inference, and an item that already carries one is not asked again;
31. it writes no prose report: `verification-result.json` is canonical and the
    summary is inline;
32. the visual verdict is assigned here, from the manual evidence, not carried
    over from the migration result;
33. the continuation offers exactly three routes — open the next phase now
    using the host's own mechanism, show the invocation to paste, or save it in
    the run directory as a resumable checkpoint — and never opens a second
    terminal window;
34. it writes no work-item snapshot;
35. artifact pointers come from a script (`new-observations.mjs` or
    `hash-artifact.mjs`), never from digests computed by hand;
36. `references/debug-handoff.md` is read only for a non-PASS result, and
    `references/push.md` only when checkpoints were committed or the push policy
    is `confirm-after-pass`;
37. the manual verification environment comes from the contract's
    `validationPlan`, not from a separate read of the project constants;
38. the chain it validates is the contract, the migration result and, after a
    repair, the debug result;
39. a `FAIL` or repairable `BLOCKED` hands off to `flow-debug`, which owns the
    repair; nothing is returned to `flow-migrate`.
40. every walkthrough item is built from its own `scenarios` or `visualParity`
    entry; `manualValidation` supplies the environment and the route through
    them, never a second description of the scenarios;
41. the continuation to `flow-debug` carries the contract, the migration and
    verification results and the debug handoff, every artifact it validates;
42. the allowlist check comes from `allowlist.outside` in the
    `run-context.mjs --contract` output, never from a comparison made by hand;
43. every scenario a `disproved` hypothesis names in `proveBefore` is tested
    explicitly, because it was migrated on a corrected assumption.
44. attempt N after a repair, one more than the attempt its debug result
    answers, records `verificationAttempt` N and adds `-<N>` to every file it
    writes, so it never overwrites the failed attempt's evidence or a file a
    debug artifact hashes.
45. only a saved prompt named for this attempt, `<flowId>-flow-verify-prompt.md`
    on attempt 1 and `-prompt-<N>.md` on attempt N, is treated as this run's
    continuation; an earlier attempt's prompt names no debug-result and is
    never resumed from.
46. a `PASS` continues into a fresh `/flow-plan` that carries the
    verification result, through the same three routes, instead of waiting
    for the user to name a next flow.
