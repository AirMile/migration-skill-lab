---
name: migration-skill-audit
description: Audit observed execution evidence for one migration flow skill and apply only explicitly approved improvements. Use only with /migration-skill-audit.
---

# Migration Skill Audit

Skill version: `0.1.0`.

Audit one of `flow-baseline`, `flow-migrate`, `flow-debug` or `flow-verify` independently of
its active run. Use persisted observations and the complete source surface to
find evidence-backed improvements. Never infer that audit approval authorizes
product writes, publication or unrelated skill changes.

## Required inputs

Confirm before analysis:

- one target migration skill;
- migration-skill-lab root;
- one or more `skill-run-observations.json` paths, unless the user explicitly
  requests a static-only audit;
- an approved audit-report destination;
- confirmation that no run of the target skill is still active.

Ask one focused question and stop when the target, evidence paths, report
destination or active-run status is ambiguous.

## Workflow

1. Read `references/audit-contract.md`.
2. Validate every observation artifact separately with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations.json>"`. Reject an artifact whose `skill` does not
   match the target.
3. Select the evidence mode without asking:
   - `trace` when the target skill's real execution is visible in this chat;
   - `artifact` when valid persisted observations are available;
   - `static` only after an explicit static-only request.
4. Load the complete target surface: `SKILL.md`, every Markdown reference, its
   acceptance criteria, and an inventory of scripts, schemas and examples it
   invokes. Do not load unrelated product source.
5. Run the deterministic checks and evidence analysis from the audit contract.
   Keep `Confirmed`, `Inference` and `Open question` distinct.
6. Deduplicate only semantically equivalent observations. Preserve source
   artifact, observation ID and summed occurrence count.
7. Rank findings by safety and correctness impact, then recurrence, cost,
   clarity and user experience. Do not cap material findings.
8. Write the audit report to the approved destination before proposing source
   edits. Surface a failed write.
9. If no source change is justified, stop after the report. Otherwise present
   numbered significant changes and one optional minor bundle with target
   locations, evidence, expected effect and regression risk.
10. Obtain one explicit human selection. Apply only selected changes, including
    their declared dependencies. A rejected change remains open.
11. Bump the changed skill's minor version for behavior or structure changes,
    or patch version for wording-only changes. Re-run its acceptance checks and
    all earlier applicable regression cases.
12. Update the audit report with applied and rejected items and actual
    validation outcomes. Do not rewrite immutable observation artifacts.

## Safety boundary

Never:

- run an audit against a target skill that is still active;
- edit product code, tests, configuration or generated product artifacts;
- treat an observation as proof without checking its evidence and causality;
- turn a product issue or missing Angular convention into a skill finding;
- modify unselected files or apply an unapproved improvement;
- publish, install, commit, push or transfer internal evidence;
- copy credentials, private URLs, source code or unnecessary personal data;
- recursively audit or modify `migration-skill-audit` during a target audit.

## Result

Report the mode, artifacts used, deterministic checks, ranked findings,
proposed changes, approval selection, changed paths, version transition,
validation evidence and unresolved observations. An audit can improve a skill;
it cannot certify the migrated product flow.
