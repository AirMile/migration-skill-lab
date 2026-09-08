---
document: skill-acceptance-criteria
skill: verify-flow
targetVersion: 0.5.2
status: experimental
date: 2026-09-04
---

# `verify-flow` v0.5.2 acceptance criteria

## Hard gates

A run fails immediately when it repairs product code, accepts unapproved or
incompatible handoff artifacts, reports a passing criterion without evidence,
silently omits required host validation, or modifies a skill during its own
run.

## Required output

- Validated Flow Contract and migration result inputs.
- A criterion-by-criterion `PASS`, `FAIL` or `BLOCKED` result.
- Declared test, typecheck and build outcomes.
- Coverage evidence for the selected flow when measurement is approved.
- Manual/Maui validation status and explicit blockers.
- A schema-valid `verification-result.json` and concise human-readable report.
- A concrete repair diagnosis for every `FAIL` or repairable `BLOCKED`.
- A schema-valid observation artifact written after the verification outputs,
  including an empty observation list when no concrete skill signal occurred.
- Reconciled checkpoint SHAs, an explicit push outcome and a schema-valid
  Epic/Feature/Story/Task verification snapshot plus deterministic Markdown.
- Verification Task evidence, calculated Story progress and a daily standup
  block with separate current/proposed percentages.
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
   matching checkpoint SHAs, the approved branch and explicit confirmation;
9. it never force-pushes, pushes tags or pushes another branch;
10. `Done` is not proposed for FAIL, BLOCKED or missing host evidence;
11. it never updates TopDesk or treats copy-ready output as applied.
12. a Story cannot be Done while any child Task is incomplete;
13. one completed Story does not imply its parent Feature or Epic is done.
14. regular-browser automation and required Maui host validation are reported
    separately and both pass before overall PASS when required;
15. repairable failures offer a user-confirmed fresh `/debug-flow` chat and external
    blockers do not;
16. a repaired result is always followed by a new independent verification
    attempt.
17. visual drawer parity is evaluated as a browser criterion, including approved
    insets, spacing and input containment.
18. the actual drawer is compared with the rendered-surface inventory, and any
    missing retained control or conditional branch produces `FAIL`.
