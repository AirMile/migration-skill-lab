---
document: migration-skill-audit-report
target: flow-baseline
targetVersion: 0.32.0
auditRunId: 2026-09-15-flow-baseline-audit-1
date: 2026-09-15
status: applied
---

# Migration skill audit — flow-baseline

## 1. Scope, target version, mode, evidence inputs

- Target skill: `flow-baseline`, version `0.32.0` (C:\Users\miles.zeilstra\.copilot\skills\flow-baseline\SKILL.md).
- Trigger: user-reported gap — the flow-baseline run for `detail-drawer-astronaut-form`
  (this same chat, 2026-09-15) never pasted the User Story or the User path into
  a chat message, even though the skill produced them.
- No run of `flow-baseline` is active. Confirmed: the astronaut-form run closed
  with a `draft` observation sidecar and handed off to a separate `flow-migrate`
  chat; no other flow-baseline run is in progress.
- Evidence modes used: **trace** (this conversation, for the astronaut-form run
  in full) and **artifact** (four validated `skill-run-observations-flow-baseline.json`
  sidecars, one per run below). Trace evidence is treated as authoritative where
  it conflicts with anything summarized elsewhere in this chat.

| Run | Skill version | Sidecar | sha256 recheck |
|---|---|---|---|
| detail-drawer-line-edit-baseline-1 (2026-09-09) | 0.17.0 | runs\2026-09-09-detail-drawer-line-edit-baseline-1\skill-run-observations-flow-baseline.json | match |
| drawer-straight-strip-form-baseline-1 (2026-09-14, archived) | 0.23.0 | runs\_archive\2026-09-14-drawer-straight-strip-form-baseline-1\skill-run-observations-flow-baseline.json | match |
| detail-drawer-straight-strip-form-baseline-1 (2026-09-14) | 0.27.0 | runs\flows\detail-drawer-straight-strip-form\2026-09-14-detail-drawer-straight-strip-form-baseline-1\skill-run-observations-flow-baseline.json | match |
| detail-drawer-astronaut-form-baseline-1 (2026-09-15, this chat) | 0.32.0 | runs\flows\detail-drawer-astronaut-form\2026-09-15-detail-drawer-astronaut-form-baseline-1\skill-run-observations-flow-baseline.json | match |

All four sidecars validated against `validate-handoff.mjs` and declare
`"skill": "flow-baseline"`. Each `primaryOutcome.sha256` was recomputed with
`hash-artifact.mjs` against its `artifactPath` and matched.

## 2. Deterministic checks

| # | Check | Result |
|---|---|---|
| 1 | Frontmatter name matches folder; description has an explicit trigger | Pass — `name: flow-baseline`, description ends "Use only with /flow-baseline." |
| 2 | SKILL.md and referenced files exist; no orphaned Markdown | Pass — only reference is `references/flow-contract.md`, which exists and is used |
| 3 | SKILL.md version matches produced examples | Pass for the current version (0.32.0, matches this run's contract/sidecar `skillVersion`). Older runs (0.17.0/0.23.0/0.27.0) are historical and not a mismatch. |
| 4 | Every named script/schema/example/downstream skill exists | Pass — run-context.mjs, slice-worktree.mjs, style-sources.mjs, print-shape.mjs, validate-handoff.mjs, render-user-story.mjs, continuation.mjs, new-observations.mjs and `examples\handoff\detail-drawer-line-edit\flow-contract.json` all exist and ran successfully in this run; downstream skill `flow-migrate` exists (SKILL.md + references\checkpoints.md) |
| 5 | Observation artifacts validate and target the audited skill; sha256 recheck | Pass — see table in §1 |
| 6 | Safety boundaries, primary artifacts and post-run capture stay separate | Pass — `flow-contract.json` and `skill-run-observations-flow-baseline.json` are separate files; safety boundary section names a narrow, single exception |
| 7 | Every named command runs within the declared write boundary | Fail once — `slice-worktree.mjs --create` could not run until `migration/angular` was created by hand outside any script the skill names (see Finding F4) |

## 3. Ranked finding summary

| # | Finding | Dimension(s) | Occurrences | Evidence class |
|---|---|---|---|---|
| F1 | Step 9's mandatory verbatim paste of the User Story/review facts was skipped entirely in this run | Execution adherence, User experience | 1 confirmed (this run); skill's own wording ("a run once showed neither") indicates the failure mode recurred at least once before | trace, confirmed |
| F2 | `references/flow-contract.md` tells the agent to omit `dependencyChanges.packages`/`paths` when `required: false`, but the schema rejects an empty `packages` array regardless — contradicting, uncorrected guidance | Correctness/artifact integrity, Maintainability | 2 confirmed, independent runs | artifact, confirmed |
| F3 | `planSlice`'s exact shape (the `map.sha256` requirement via `hash-artifact.mjs`, no `flowId` nested under `map`, and that the write-allowlist ceiling is validated per prerequisite's own measured target folder) is not learnable from `print-shape.mjs` on the canonical example, forcing reconstruction from validator errors (and, once, from reading `validate-handoff.mjs` source directly) | Context and tool cost | 2 confirmed, independent runs | artifact + trace, confirmed |
| F4 | The skill assumes the `migration/angular` integration branch already exists; when it does not, `slice-worktree.mjs --create` fails and the skill gives no sanctioned recovery, forcing a manual `git branch` command in the shared integration checkout outside any script the safety boundary names | Safety and scope control, Failure handling | 1 confirmed | trace, confirmed |
| F5 (historical, no action proposed) | Pre-`print-shape.mjs` run (v0.17.0) had to read `schemas\*.json` directly because the only example was schema-version 4 and stale | Context and tool cost | 1, superseded | artifact, confirmed but stale |

## 4. Complete finding ledger

### F1 — Verbatim User Story/review-facts paste skipped
- Classification: prescribed step skipped (not weakened — the action did not
  happen at all).
- Location: `SKILL.md` step 9 (lines 199–207): *"Your next chat message pastes
  its whole output verbatim, the Story the user copies onto the board followed
  by the review facts, because the host collapses tool output and a run once
  showed neither. Paraphrasing drifts from what `flow-verify` checks."*
- Evidence: in this same conversation, `render-user-story.mjs` was run and its
  output exceeded the inline display threshold, so the CLI saved it to a
  temporary file with only a preview. The full text was then read into context
  with two `view` calls, but the next chat message to the user skipped straight
  to the continuation-route question; the final summary message claimed
  *"User Story + review-samenvatting hierboven geplakt"* even though the literal
  text was never pasted anywhere in the chat. The user's follow-up ("ik mis
  zelf de user story en de user path van de baseline") confirms the effect.
- Effect: user-experience and correctness — the one artifact a human is meant
  to lift verbatim onto the board (per the skill's own stated purpose,
  "Paraphrasing drifts from what `flow-verify` checks") was not delivered in
  usable form; the user had to notice the gap and ask for it explicitly.
- Occurrence count: 1 confirmed directly; the skill's own text acknowledges the
  same failure shape happened at least once before ("a run once showed
  neither"), which is corroborating but not independently verifiable from a
  sidecar.
- Confidence: high (directly observed in this conversation's own tool-call and
  message history).

### F2 — `dependencyChanges` guidance contradicts the schema
- Classification: output mismatch, caused by acting on the reference doc as
  written.
- Location: `references/flow-contract.md` lines 79–87, specifically line 86:
  *"With `required: false`, leave `packages` and `paths` out and cite the
  manifest in `note`, since listed packages read as work to do."*
- Evidence:
  - `runs\_archive\2026-09-14-drawer-straight-strip-form-baseline-1\skill-run-observations-flow-baseline.json`,
    finding `dependency-changes-requires-nonempty-packages-when-false`:
    *"validate-handoff.mjs rejected it because packages must contain at least 1
    item regardless of required's value."*
  - `runs\flows\detail-drawer-straight-strip-form\2026-09-14-detail-drawer-straight-strip-form-baseline-1\skill-run-observations-flow-baseline.json`,
    finding `dependency-changes-packages-min-items`: the same schema error,
    five days later, same root cause, same fix (list the already-installed
    packages anyway).
- Effect: two independent runs spent a validation round-trip on guidance that
  is still wrong today; a third run could hit it again since the doc is
  unchanged.
- Occurrence count: 2 confirmed (2026-09-14 archived run, 2026-09-14
  straight-strip-form run). Not hit in this chat's astronaut-form run only
  because `required: false` was written with `packages`/`paths` populated
  anyway, matching the empirically-correct behavior rather than the doc's
  literal instruction.
- Confidence: high (two independent, matching validator error transcripts).

### F3 — `planSlice` shape not learnable from `print-shape.mjs`
- Classification: reference/context-cost gap; deterministic manual work
  (reading validator source or trial-and-error against the validator) in place
  of the sanctioned shape-discovery path.
- Location: `references/flow-contract.md` lines 51–59 (the `planSlice` field
  description) and the workflow's own reading discipline, which says to learn
  shapes from `print-shape.mjs`, never from `schemas\`/`scripts\` source.
- Evidence:
  - `detail-drawer-straight-strip-form-baseline-1` sidecar, finding
    `planslice-shape-not-in-example`: *"the planSlice shape (map/flowId/remainder)
    had to be learned by reading validate-handoff.mjs's self-test fixture
    directly instead of from print-shape.mjs."*
  - This chat's astronaut-form run: the first contract draft nested `flowId`
    under `planSlice.map` (not allowed) and omitted `map.sha256` (required);
    both were only discovered from `validate-handoff.mjs`'s error text, then a
    second validator error revealed that `allowedWritePaths`' ceiling is
    checked per prerequisite's own measured target folder, not a broader
    shared parent folder guessed from the map.
- Effect: cost — both runs spent one or two extra validate/fix round-trips on a
  field the skill's own sanctioned shape-discovery tool cannot show, because
  the canonical example (`examples\handoff\detail-drawer-line-edit\flow-contract.json`)
  predates `planSlice`.
- Occurrence count: 2 confirmed, independent runs, five days apart — the first
  occurrence did not lead to a fix.
- Confidence: high.

### F4 — No sanctioned recovery when `migration/angular` is missing
- Classification: missing failure handling; a deterministic step (creating a
  fixed-revision integration branch) done by hand because no script or
  instruction covers it.
- Location: `SKILL.md` step 1 (the `--claim`/worktree-creation steps) and the
  safety boundary's single stated exception, *"the branch, worktree and `npm
  ci` that `slice-worktree.mjs --create` makes for this run"* — which does not
  cover creating the base integration branch itself.
- Evidence (this chat, trace): `slice-worktree.mjs --create` failed with
  *"C:\Project\frontend has no migration/angular branch. Create it once, from
  the revision the runs were measured on, before a slice claims a worktree."*
  `docs\project-constants.md` documents `migration/angular` as a
  precondition ("checked out in C:\Project\frontend... starts at 03bb7e9") but
  neither it nor `SKILL.md` says what to do when it is absent. The recovery
  (`git branch migration/angular 03bb7e90a09b1e56b75801d03d7eb349828f0b59`) was
  constructed by hand, directly in the shared integration checkout, using a
  plain `git branch` command not named anywhere in the skill or its safety
  boundary.
- Effect: safety/scope-control — an unsanctioned git write, even a narrowly
  scoped one (branch-pointer creation only, no checkout/reset/commit), happened
  in a checkout other sessions also use, because the skill offers no sanctioned
  path.
- Occurrence count: 1 confirmed. Plausibly latent since 2026-09-14 (both
  straight-strip-form runs' worktrees exist, so `migration/angular` must have
  already existed or been created by a prior, unrecorded manual step by the
  time this chat ran) — recorded as an open question, not a second confirmed
  occurrence.
- Confidence: high for this run; the prior history is inferred only.

### F5 — Stale example forced a schema read (historical, no action proposed)
- Classification: unnecessary-context-load, from `detail-drawer-line-edit-baseline-1`
  (skill version 0.17.0).
- Evidence: sidecar finding `stale-example-forced-schema-read`.
- Assessment: the current version (0.32.0) resolves this by way of
  `print-shape.mjs`, used successfully in both the 0.27.0 and 0.32.0 runs
  audited here. No further action proposed; kept in the ledger only for
  completeness, per the instruction not to discard lower-ranked material
  findings.

## 5. Proposed changes

| # | Change | Addresses | Dependencies | Regression risk |
|---|---|---|---|---|
| 1 | Strengthen `SKILL.md` step 9: when `render-user-story.mjs`'s output is too large for inline display and the host saves it to a file, explicitly instruct opening that file and copying its literal text into the chat message — never a summary, translation, or bullet recap, in that message or a later one. | F1 | None | Low — adds an explicit branch to existing step 9 wording; does not change any script, schema or field. |
| 2 | Correct `references/flow-contract.md`'s `dependencyChanges` guidance (line 86): remove "leave `packages` and `paths` out" and replace with instructions to always list at least one package (the already-installed set when `required: false`, the set to add when `required: true`), matching the schema's `minItems: 1`. | F2 | None | Low — brings the doc in line with already-confirmed, already-applied validator behavior; two prior runs already converged on this fix independently. |
| 3 | Extend `references/flow-contract.md`'s `planSlice` field description with the exact shape (`map.path`, `map.sha256` from `hash-artifact.mjs`, `map.runId`; `flowId` at the top level of `planSlice`, not under `map`) and one sentence stating the allowlist ceiling is validated per prerequisite's own measured target folder, not a broader shared parent folder. | F3 | None | Low — documentation-only; does not change the schema or validator, only makes an existing rule discoverable without reading validator source. |
| 4 | Add one sentence to `SKILL.md` step 1 (or the worktree-claim step): if `slice-worktree.mjs --create` reports the integration branch missing, create it once with `git branch migration/angular <revision>` (branch-pointer only, never checkout/reset/commit) in the integration checkout, using the revision `docs\project-constants.md` names, then retry `--create`. | F4 | None | Low-medium — adds a narrowly scoped, explicitly bounded git command to the skill text; does not touch the safety boundary's existing single exception, only documents a second, equally narrow one. |

No change is proposed for F5 (historical, already superseded) or for anything
below dimension score 4 without a confirmed finding.

## 6. Approval and applied-change record

The user selected **all four** proposed changes. All four were applied,
identically, to both the repository source
(`C:\Project\migration-skill-lab\.github\skills\flow-baseline\`, the versioned
source of truth per `README.md` §"Publishing to `~\.copilot\skills`") and the
installed runtime snapshot (`~\.copilot\skills\flow-baseline\`), which had been
edited first and was then brought back in sync with the source.

| # | Change | File(s) | Status |
|---|---|---|---|
| 1 | Step 9 verbatim-paste strengthening | `SKILL.md` (both copies) | Applied |
| 2 | `dependencyChanges` doc correction | `references/flow-contract.md` (both copies) | Applied |
| 3 | `planSlice` shape documentation | `references/flow-contract.md` (both copies) | Applied |
| 4 | `migration/angular` recovery path | `SKILL.md` Inputs + Safety boundary (both copies) | Applied |

Skill version bumped `0.32.0` → `0.33.0` (minor: all four changes affect
prescribed agent behavior or documented field shape, not wording alone) in
both copies' "Skill version" line.

The Safety boundary section was also updated (beyond the four numbered
changes) to name the new `git branch migration/angular <revision>` exception
explicitly, so change #4 does not read as an undocumented boundary exception
on a future audit.

## 7. Validation outcomes

- `node scripts\render-user-story.mjs --self-test` → `User Story self-test
  passed.` (unaffected by the doc-only changes; re-run as the applicable
  regression case for anything touching User Story rendering).
- `node scripts\validate-handoff.mjs --self-test` → `Handoff validator
  self-test passed (handoff chain, observation and migration-map edge
  cases).` (re-run as the applicable regression case for the `planSlice`/
  `dependencyChanges` doc changes, since neither the schema nor the validator
  itself changed — only the prose describing them).
- Re-checked `docs\flow-baseline-v0.32-acceptance.md` for conflicts: item 25
  ("it shows `render-user-story.mjs` output verbatim in the chat rather than a
  paraphrase") already states the rule change #1 reinforces — no acceptance
  text contradicted the applied changes, so no acceptance-doc edit was needed.
- Re-diffed the repository source against the installed runtime snapshot for
  both changed files after applying all four changes: 0 lines different in
  either file, confirming they are back in sync.
- This audit did not re-run a full `flow-baseline` execution end-to-end (that
  would require claiming a new flow slice, out of scope for an audit); the
  verbatim-paste change (#1) will only be fully exercised by the next real
  `flow-baseline` run.

## 8. Unresolved observations and open questions

- Whether `migration/angular` already existed before this chat's run (created
  by an earlier, unrecorded manual step during one of the 2026-09-14
  straight-strip-form runs) or was missing from the very first Angular slice
  onward is an open question; no sidecar or contract from those runs mentions
  creating it.
- Whether the skill's own text ("a run once showed neither") refers to a run
  that predates the sidecar convention, or one whose sidecar simply did not
  capture the miss, is an open question — no matching sidecar entry was found
  across the four audited runs.
