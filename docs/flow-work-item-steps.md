---
document: flow-work-item-steps
version: 0.2.0
status: experimental
date: 2026-09-11
---

# Work-item snapshot steps

Every flow phase reads this file when it reaches its work-item step. The
validator enforces the rules; this page is the order to apply them in.

| Phase | Snapshot | Previous snapshot | Primary artifact |
|---|---|---|---|
| `flow-baseline`, first run for the flow | `work-item-baseline.json` | none | `flow-contract.json` |
| `flow-baseline`, rerun | `work-item-baseline.json` | the latest earlier baseline, as `supersedes` | `flow-contract.json` |
| `flow-migrate` | `work-item-migration.json` | `work-item-baseline.json` | `migration-result.json` |
| `flow-verify`, attempt 1 | `work-item-verification.json` | `work-item-migration.json` | `verification-result.json` |
| `flow-verify`, attempt N after a repair | `work-item-verification-<N>.json` | `work-item-migration.json` | `verification-result-<N>.json` |

1. **Start from the previous snapshot, never from memory.** When one exists,
   run
   `node "<lab>\scripts\seed-work-item.mjs" --previous <previous> --primary <primary> --out <snapshot> [--applied <status>] [--created <localId>=<externalId>]...`.
   It copies every field byte for byte, starts each item as `no-change`, or
   `create` while it has no external ID, and fills every pointer and hash.
   Never retype a field this phase did not move: retyped text comes back
   reworded, and a wording difference reads as a change.
   A first baseline has no predecessor. Copy its shape from
   `node "<lab>\scripts\print-shape.mjs" "<lab>\examples\handoff\detail-drawer-line-edit\work-item-baseline.json"`
   and fill the Epic, Feature and Story templates from cited contract evidence.
2. **Record the previous proposal's outcome** (every phase after the baseline).
   Quote the outcome the previous snapshot recorded and ask the user whether it
   still holds: a confirmation, not an open question. Pass the answer as
   `--applied not-applied|confirmed-applied`, and every external ID
   Targetprocess assigned to a created item as `--created`. Only a confirmed
   application moves an item off `create`: `no-change` and `update` need a real
   external ID, and a placeholder ID is never written.
3. **Change only what moved**: the fields, `proposedState` and
   `proposedProgress` of each item this phase actually moved, and say in its
   `evidence` what moved it. Implementation normally moves the Story and its
   implementation Task; verification moves the Story, its verification Task
   and, on a complete `PASS`, possibly the Feature. `richReleaseNotes`
   describes what changed about its own item, so it is refreshed only on an
   item that moved; the run's general news belongs in the standup. On a
   baseline rerun, also replace every `currentState` and `currentProgress` with
   the board as the user confirmed it for this run: they are never carried
   forward.
4. **Tasks.** Each Story has exactly one stakeholder-readable `baseline`,
   `implementation` and `verification` Task, with `contributionPercent` values
   totalling 100; propose the weights rather than asking whether to create the
   Tasks. Checkpoint milestones belong on the implementation Task: never one
   Task per commit, never progress from commit count. A Task is `Done` exactly
   at 100%, a Story only when all its Tasks are, and only a verification
   snapshot proposes `Done`. One finished Story does not finish its Feature or
   Epic.
5. **Standup and evidence.** Write `standup.completedSincePreviousUpdate`,
   `standup.next`, `standup.blockers` and a `standup.summary` short enough to
   say aloud, and the top-level `evidence`. Keep confirmed board values
   separate from proposed ones: a copy-ready proposal changes no current value.
6. **Finalize** with `node "<lab>\scripts\seed-work-item.mjs" --finalize <snapshot>`.
   It derives each Story's `proposedProgress` from its Tasks, copies it into the
   standup, and sets every action by comparing with the previous snapshot the
   way the validator does. Run it after every edit to the snapshot.
7. **Validate the chain** in one `validate-handoff.mjs` invocation: every
   primary artifact and every snapshot so far, plus the superseded baseline on
   a rerun. A work-item snapshot never validates alone.
8. **Show the handoff.** Run
   `node "<lab>\scripts\render-work-item-handoff.mjs" --inline <snapshot> [--since <previous>]`;
   the flag comes before the path. Show its output verbatim: it is generated
   from the validated snapshot, and a paraphrase reintroduces the drift the
   JSON prevents. Write no full Markdown render and do not restate a
   `no-change` item's fields. `manualApplication` stays `copy-ready` or
   `not-applied`: never update Targetprocess, and never claim that anything
   was applied.
