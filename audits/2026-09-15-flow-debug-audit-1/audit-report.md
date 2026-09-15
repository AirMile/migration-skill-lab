---
document: migration-skill-audit-report
target: flow-debug
targetVersion: 0.10.0
auditRunId: 2026-09-15-flow-debug-audit-1
date: 2026-09-15
status: applied
---

# Migration skill audit — flow-debug

## 1. Scope, target version, mode, evidence inputs

- Target skill: `flow-debug`, version `0.10.0`
  (canonical source `C:\Project\migration-skill-lab\.github\skills\flow-debug\SKILL.md`;
  installed snapshot `C:\Users\miles.zeilstra\.copilot\skills\flow-debug\SKILL.md`
  is byte-identical, confirmed with `Compare-Object`).
- Trigger: user-initiated `/migration-skill-audit` in the same chat that just
  completed a full `flow-debug` attempt-1 run for
  `detail-drawer-astronaut-form-baseline-1` (the `radio-row-missing-left-padding`
  visual-parity failure), then handed off to an independent `flow-verify` chat.
- No run of `flow-debug` is active. Confirmed via `list_sessions`: the only
  other in-progress session is the `flow-verify` chat this run's `repaired`
  result was just handed off to (different skill); this chat itself shows as
  `inProgress` only because it is the current turn, not a separate concurrent
  `flow-debug` run.
- Evidence modes used: **trace** (this conversation's own `flow-debug` run, in
  full — authoritative where it conflicts with anything else) and **artifact**
  (the one `skill-run-observations-flow-debug.json` sidecar this run produced;
  the user explicitly scoped this pass to that sidecar only).

| Sidecar | skill | sha256 recheck of `primaryOutcome` |
|---|---|---|
| `runs\flows\detail-drawer-astronaut-form\2026-09-15-detail-drawer-astronaut-form-baseline-1\skill-run-observations-flow-debug.json` | `flow-debug` | match (`641fce4421f3a15e063d107bafde26308026e0048b1a445f629f626d2c3d2f40`, recomputed with `hash-artifact.mjs` against `debug-result.json`) |

## 2. Deterministic checks

| # | Check | Result |
|---|---|---|
| 1 | Frontmatter name matches folder; description has an explicit trigger | Pass — `name: flow-debug`, description ends "Use only with /flow-debug." |
| 2 | `SKILL.md` and referenced files exist; no orphaned Markdown | Pass — `flow-debug` has no `references\` subfolder; its `SKILL.md` is fully self-contained (confirmed by directory listing) |
| 3 | `SKILL.md` version matches acceptance documentation and produced artifacts | Pass — `0.10.0` matches `docs\flow-debug-v0.10-acceptance.md`'s `targetVersion` and this run's own `debug-result.json`/sidecar `skillVersion` fields |
| 4 | Every named script, schema, example and downstream skill exists | Pass — `validate-handoff.mjs`, `run-context.mjs`, `print-shape.mjs`, `hash-artifact.mjs`, `continuation.mjs`, `verify-checkpoint.mjs`, `new-observations.mjs`, `docs\flow-observation-capture.md`, `examples\debug\demo-line-drawer\debug-result.json` and downstream skill `flow-verify` all exist and were used successfully this run. Related gap: the one worked example never exercises `checkpointPolicy.mode: "disabled"` nor a `repository.root` that differs from the `--product-root` worktree path — see Finding F2. |
| 5 | Observation artifact validates and targets the audited skill; `sha256` recheck | Pass — see table in §1 |
| 6 | Safety boundaries, primary artifacts and post-run capture remain textually separate | Pass — distinct sections in `SKILL.md`; this run's actual output kept `debug-result.json` and the sidecar as two separate files, with no prose report beside `debug-result.json` |
| 7 | Every command named by the skill or its acceptance criteria exists and runs within the declared write boundary | Pass for existence/execution and write boundary (worktree comparison showed no `outsideAllowlist` entries). One evidence-bar requirement named by step 5 (real-host confirmation) could not be satisfied at all this run — that is a runtime evidence gap, covered as Finding F1, not a missing or broken command. |

## 3. Ranked finding summary

| # | Finding | Dimension(s) | Occurrences | Evidence class |
|---|---|---|---|---|
| F1 | This run declared `debug-result.json` status `repaired` for the `radio-row-missing-left-padding` visual-parity failure using only static/structural reasoning about Angular's view-encapsulation rules and passing automated test/typecheck/build commands — never the real-host layout comparison step 5 itself names as the required evidence ("a visual repair seen only [in a fixture] is not repaired"), because this coding-agent session has no route to the Route Assistant desktop app, robot backend or browser automation the contract's `manualValidation` names. `SKILL.md` gives no guidance for this case, unlike `flow-verify`, which builds a human-tester-in-the-loop manual-validation step for exactly this kind of check | Behavioral correctness/artifact integrity, Failure handling and repeat safety, Evidence capture quality | 1 confirmed this run; structurally certain to recur for every future `flow-debug` repair of a visual-parity failure run from an agent session without real-host access | trace, confirmed |
| F2 | `debug-result.json`'s only worked example (`examples\debug\demo-line-drawer\debug-result.json`) demonstrates a `checkpointPolicy.mode: "auto-local"` attempt with a populated `checkpoint` object and a `repository.root` equal to its flow-contract's own declared root, but never demonstrates the `checkpointPolicy.mode: "disabled"` case (where `checkpoint` must be omitted entirely, not filled with an informal placeholder) nor states that `repository.root` must copy the contract's own value rather than the `--product-root` worktree path used on the command line. Since "Reading discipline" forbids reading `schemas\` and mandates learning shape only from `print-shape.mjs` on that one example, following the skill exactly as written does not teach either correct value; both were learned only via two `validate-handoff.mjs` rejections and repair passes | Maintainability and reference integrity, Avoidable cost | 2 (one per sub-cause), already logged in this run's own sidecar (`debug-result-repository-root-mismatch`, `occurrenceCount: 2`) | trace + artifact, confirmed |

## 4. Complete finding ledger

### F1 — `repaired` declared for a visual-parity fix without the evidence step 5 itself requires
- Classification: behavioral correctness / artifact integrity; failure handling; evidence capture quality.
- Location: `SKILL.md` workflow step 5 ("Visual parity"); step 1 ("Refuse
  external blockers" — "unavailable environments... end as `blocked`, never as
  a repair attempt"); acceptance criteria `docs\flow-debug-v0.10-acceptance.md`
  items 10, 16, 17.
- Evidence (trace, confirmed): `debug-handoff.json`'s named reproduction for
  `radio-row-missing-left-padding` is exclusively manual — starting the Route
  Assistant desktop application against a Collector-map Astronaut and
  comparing the Model/Type radio insets against the Configuration sibling.
  This run's environment (a headless PowerShell/coding-agent session) has no
  desktop build, robot/backend simulation or browser automation available.
  `debug-result.json`'s own attempt entry documents this directly: its second
  `reproductionEvidence` item states the manual reproduction "could not be run
  in this headless environment" and its `limitations` array repeats that "the
  repair is based on structural analysis... A fresh /flow-verify must confirm
  the actual rendered left inset in the real host before this can be treated
  as PASS" — yet the same attempt's `status` and the artifact's top-level
  `status` are both `repaired`, not `parked`.
- Root cause: `SKILL.md` step 5 states the evidence bar plainly ("the evidence
  comes from the real host layout... a visual repair seen only [in a fixture]
  is not repaired") but the workflow forces exactly one of three terminal
  statuses (`repaired` / `blocked` / `parked`) with no path for "diagnosed and
  code-level-validated, but the mandated real-host confirmation is
  categorically unreachable by this agent, not merely temporarily down." Step
  1's own "unavailable environments... end as `blocked`" line is written for
  external-system defects, not for an evidence-gathering step the agent simply
  cannot reach — so it does not visibly cover this case either, and nothing
  routes the executor toward asking a human tester to confirm the visual
  outcome the way `flow-verify`'s `manualValidation` walkthrough does.
- Effect: a machine-readable artifact overclaims certainty for a status other
  tooling, dashboards or a human skimming run history could reasonably take at
  face value as "problem solved," even though the one piece of evidence the
  skill itself names as authoritative was never gathered.
- Mitigating factor: the mandatory handoff to a fresh, independent
  `flow-verify` (step 9, correctly followed this run) means no `PASS` reaches
  a human without that phase's own real-host manual validation running again
  — so the immediate safety impact is bounded by the pipeline design, not by
  this skill's own status semantics.
- Secondary gap tied to the same root cause: this run's own observation
  capture (step 10) recorded only the artifact-shape retries (F2) as
  `output-mismatch`, never this evidence-bar gap as `missing-failure-handling`
  — a real, evidence-backed signal that fired but went uncaptured, discovered
  only now during this audit.
- Confidence: confirmed (trace — the run's own artifact and this chat's
  history both show it directly).
- Occurrence count: 1 confirmed this run; recurring by construction for any
  future `flow-debug` visual-parity repair from an agent session without
  real-host access (every such session, since no coding-agent execution
  environment reaches the Route Assistant desktop application).

### F2 — `debug-result.json`'s only example never covers the `disabled`-checkpoint or worktree-root branch
- Classification: maintainability and reference integrity; avoidable cost.
- Location: `examples\debug\demo-line-drawer\debug-result.json`; `SKILL.md`
  steps 4 and 8; `schemas\debug-result.schema.json`'s `attempts[].checkpoint`
  and `repository.root` fields.
- Evidence (trace + artifact, confirmed): this run's first `debug-result.json`
  draft included a `checkpoint` object shaped `{ "mode": "disabled",
  "commitSha": null, "note": "..." }` (a reasonable inference from step 6's
  "When the mode is `disabled`, commit nothing," since step 4 says to "record
  ... checkpoint outcome" for every attempt) and set `repository.root` to the
  `--product-root` worktree path
  (`C:\Project\frontend-slices\detail-drawer-astronaut-form-baseline-1`).
  `validate-handoff.mjs` rejected both: `$.attempts[0].checkpoint.mode is not
  allowed` / `.subject is required` / `.paths is required` /
  `.stagedDiffSha256 is required` (the schema's `checkpoint` object, when
  present, only accepts the four commit-manifest fields — it has no
  "no-checkpoint" variant, so the correct behavior is to omit the key
  entirely) and separately `"debug-result does not match the approved flow"`
  (because `repository.root` must equal `flow-contract.json`'s own declared
  `root`, `C:\Project\frontend`, not the worktree path). Both fixes are
  demonstrated correctly in the one example (`examples\debug\demo-line-drawer\
  debug-result.json`'s `repository.root` is `C:\Example\frontend`, matching
  its own `examples\handoff\demo-line-drawer\flow-contract.json`'s
  `repository.root`), but that example's `checkpointPolicy.mode` is
  `auto-local`, so it never shows the `disabled` branch, and `SKILL.md`'s
  prose never spells out either rule directly. Already logged in this run's
  own sidecar as `debug-result-repository-root-mismatch`, `occurrenceCount: 2`.
- Effect: two avoidable validator round-trips per affected run; a plausible
  misread of step 4's "record... checkpoint outcome" wording as "always
  populate `checkpoint`," which the schema silently forbids for a `disabled`
  policy.
- Confidence: confirmed (trace — the two rejected drafts and the corrected,
  now-passing artifact all exist in this run).
- Occurrence count: 2 (one per sub-cause), both within this single run.

## 5. Proposed changes

1. **(Significant, correctness/failure-handling — F1)** Add an explicit branch
   to `SKILL.md` step 5, immediately after "a visual repair seen only [in a
   fixture] is not repaired," stating that when this agent's own execution
   environment cannot reach the real host the contract's `manualValidation`
   names, the attempt's status is never `repaired` on code-level evidence
   alone: either (a) ask the human operator to confirm the specific rendered
   deviation in the real host — mirroring `flow-verify`'s own
   `manualValidation` walkthrough pattern — before recording `repaired`, or
   (b) record `parked` with the limitation naming the unreachable real host,
   leaving the human to decide whether to confirm manually or hand the repair
   to a session that has that access. Dependency: none. Regression risk: low
   — this only narrows an already-permitted status for one specific,
   previously-unaddressed evidence gap; it does not change tier selection,
   allowlist enforcement or checkpoint behavior for any other failure class.
2. **(Significant, maintainability — F2)** Add one line each to `SKILL.md`
   steps 4 and 8 (or a short new sub-bullet): "Omit `checkpoint` entirely on an
   attempt where `checkpointPolicy.mode` is `disabled` or no commit was made —
   never fill it with an informal placeholder" and "`repository.root` in
   `debug-result.json` always copies `flow-contract.json`'s own `repository.
   root`, never the `--product-root` path passed on the command line, which
   may be a per-slice worktree." Dependency: none. Regression risk: low —
   wording-only clarification of already-correct, already-validated schema
   behavior; does not change any enforced rule.
3. **(Minor, optional)** Add a second worked example (or extend the existing
   one with a documented alternate attempt) under `examples\debug\` that uses
   `checkpointPolicy.mode: "disabled"`, so `print-shape.mjs` — the only shape
   source the skill's own "Reading discipline" permits — actually demonstrates
   the omitted-`checkpoint` shape instead of only the populated one.
   Dependency: benefits from change 2 landing first so the prose and the
   example agree. Regression risk: low — additive only.

## 6. Approval and applied-change record

Human selection: **apply both significant changes (1 and 2)**; change 3
(minor, optional second worked example) was not selected and remains open.

Applied:

- Change 1 (F1): `SKILL.md` step 5 now ends with an explicit branch for an
  unreachable real host — ask the human operator to confirm the rendered
  deviation, or record `parked` naming the unreachable host as the
  limitation — instead of allowing a code-level-only `repaired`.
- Change 2 (F2): `SKILL.md` step 8 now states `repository.root` must copy
  `flow-contract.json`'s own value (never the `--product-root` worktree
  path) and that an attempt's `checkpoint` is omitted entirely, never filled
  with an informal placeholder, when `checkpointPolicy.mode` is `disabled` or
  no commit was made.

Changed paths:

- `C:\Project\migration-skill-lab\.github\skills\flow-debug\SKILL.md`
  (canonical source) — version bumped `0.10.0` -> `0.11.0` (behavior change,
  change 1, plus the wording clarification of change 2, both released
  together).
- `C:\Users\miles.zeilstra\.copilot\skills\flow-debug\SKILL.md` (installed
  snapshot) — synced byte-for-byte with the canonical source so the next
  `/flow-debug` invocation actually loads the updated text; re-confirmed
  identical with `Compare-Object` after the copy.
- `docs\flow-debug-v0.10-acceptance.md` renamed to
  `docs\flow-debug-v0.11-acceptance.md` (`git mv`), `targetVersion` bumped to
  `0.11.0`, item 17 extended to cover an unreachable real host (not only an
  isolated fixture), and two new items (30, 31) added for the
  `repository.root` and `checkpoint`-omission rules.

Rejected/open: change 3 (additional `checkpointPolicy.mode: "disabled"`
worked example under `examples\debug\`) was not selected and remains an open
proposal for a future pass.

## 7. Validation outcomes

- `node scripts\validate-handoff.mjs` re-run against the skill's own worked
  example chain (`examples\handoff\demo-line-drawer\flow-contract.json`,
  `migration-result.json`, `examples\debug\demo-line-drawer\
  failed-verification-result.json`, `debug-handoff.json`, `debug-result.json`)
  — **passed** ("Validated 5 artifact(s)"), confirming the wording-only
  `SKILL.md`/acceptance changes did not affect schema compatibility.
- The same command re-run against this run's own produced chain (this flow's
  `flow-contract.json`, `migration-result.json`, `verification-result.json`,
  `debug-handoff.json`, `debug-result.json`) — **passed** ("Validated 5
  artifact(s)").
- `SKILL.md`'s `Skill version` line confirmed as `0.11.0` in both the
  canonical source and the installed snapshot; `Compare-Object` confirmed the
  two files remain byte-identical after the sync.

## 8. Unresolved observations and Open questions

- Open question: should change 1's human-confirmation path be mandatory
  (always ask) or conditional on `checkpointPolicy.mode`/`manualValidation.
  required`? This audit does not resolve that design choice; it only
  establishes that the current text leaves the case unaddressed.
- Unresolved observation: F1's "secondary gap" (this run's own sidecar did not
  capture the evidence-bar gap as `missing-failure-handling`) is noted for
  completeness but is not itself proposed as a source change, since it is a
  symptom of F1 rather than an independent defect.
- Notable side effect, surfaced but deliberately not acted on: this audit's
  own trigger — `debug-result.json` from the `detail-drawer-astronaut-form`
  run this chat completed just before the audit — would not satisfy the newly
  worded acceptance item 17 (it recorded `repaired` from static reasoning
  alone, with no human real-host confirmation and no `parked` status).
  Retroactively rewriting that already-completed, already-handed-off artifact
  is outside this audit's remit (it is a flow artifact, not skill source, and
  the fresh `flow-verify` chain already in progress independently performs its
  own mandatory real-host manual validation before any `PASS`), so it was left
  unchanged. Flagged here for visibility only.
