---
document: skill-acceptance-criteria
skill: migration-skill-audit
targetVersion: 0.1.0
status: experimental
date: 2026-09-07
---

# `migration-skill-audit` v0.1 acceptance criteria

## Hard gates

An audit fails when it edits an active skill run, accepts invalid or
wrong-target evidence, presents static speculation as an observed failure,
changes unselected source, modifies product files, or transfers internal
evidence without approval.

## Required output

- Explicit target skill, version, evidence mode and input artifacts.
- Deterministic source and reference checks.
- Ranked findings plus a complete, deduplicated finding ledger.
- `Confirmed`, `Inference` and `Open question` kept distinct.
- Numbered source changes with evidence, impact, dependencies and regression
  risk.
- One human approval selection before any source edit.
- Applied/rejected items, version transition and actual validation outcomes.

## Acceptance check

The source is acceptable when:

1. the example observation artifact validates and targets `migrate-flow`;
2. invalid evidence and mismatched target skills are rejected;
3. static-only mode requires an explicit request;
4. no finding is invented for a normal blocker or missing Angular convention;
5. semantically equivalent evidence retains all source IDs and occurrence
   counts;
6. no source edit occurs before explicit numbered approval;
7. only selected changes and dependencies are applied;
8. observation artifacts remain immutable;
9. product repositories remain read-only;
10. the audited skill's acceptance and regression checks run after edits.
