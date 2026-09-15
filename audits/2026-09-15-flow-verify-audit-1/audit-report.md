---
document: migration-skill-audit-report
target: flow-verify
targetVersion: 0.21.0
auditRunId: 2026-09-15-flow-verify-audit-1
date: 2026-09-15
status: applied
---

# Migration skill audit — flow-verify

## 1. Scope, target version, mode, evidence inputs

- Target skill: `flow-verify`, version `0.21.0`
  (`C:\Users\miles.zeilstra\.copilot\skills\flow-verify\SKILL.md`).
- Trigger: user-initiated `/migration-skill-audit` immediately after this same
  chat completed a full `flow-verify` attempt 1 run for
  `detail-drawer-astronaut-form-baseline-1`.
- No run of `flow-verify` is active. Confirmed via `list_sessions`: the only
  other in-progress sessions are a `flow-baseline` chat (different skill,
  different flow) and the `flow-debug` chat this run's `FAIL` handed off to
  (different skill).
- Evidence modes used: **trace** (this conversation, for the astronaut-form
  verification run in full — authoritative where it conflicts with anything
  else) and **artifact** (one validated
  `skill-run-observations-flow-verify.json` sidecar, user-scoped to this run
  only; two other flow-verify sidecars exist elsewhere in the lab but the user
  declined to include them this pass).

| Sidecar | skill | sha256 recheck of `primaryOutcome` |
|---|---|---|
| `runs\flows\detail-drawer-astronaut-form\2026-09-15-detail-drawer-astronaut-form-baseline-1\skill-run-observations-flow-verify.json` | `flow-verify` | match (`09ac572bb53157b886f87346742e7857c03ea9767d94c48392aaeae25a51b6e9`, recomputed with `hash-artifact.mjs` against `verification-result.json`) |

## 2. Deterministic checks

| # | Check | Result |
|---|---|---|
| 1 | Frontmatter name matches folder; description has an explicit trigger | Pass — `name: flow-verify`, description ends "Use only with /flow-verify." |
| 2 | `SKILL.md` and referenced files exist; no orphaned Markdown | Pass — `references/debug-handoff.md` and `references/push.md` both exist and were both read/used this run (debug-handoff.md because the result was `FAIL`; push.md was read only now, during this audit's target-surface load, not during the original run, correctly, since `checkpointPolicy.mode` was `disabled` and `migration-result.checkpoints` was empty) |
| 3 | `SKILL.md` version matches acceptance documentation and produced artifacts | Pass — `0.21.0` matches `docs\flow-verify-v0.21-acceptance.md`'s `targetVersion` and this run's own `verification-result.json`/`debug-handoff.json`/sidecar `skillVersion` fields |
| 4 | Every named script, schema, example and downstream skill exists | Pass, with a related gap — `validate-handoff.mjs`, `run-context.mjs`, `print-shape.mjs`, `continuation.mjs`, `docs\flow-observation-capture.md`, `new-observations.mjs`, `examples\handoff\detail-drawer-line-edit\verification-result.json`, and downstream skills `flow-debug`/`flow-plan` all exist and ran successfully. `hash-artifact.mjs` also exists and was used successfully, but `SKILL.md` never names it even though `verification-result.json`/`debug-handoff.json` require exact `sha256` pointers and the acceptance criteria (item 35) mandate that script or `new-observations.mjs` as the only sanctioned source — see Finding F2. |
| 5 | Observation artifact validates and targets the audited skill; `sha256` recheck | Pass — see table in §1 |
| 6 | Safety boundaries, primary artifacts and post-run capture remain textually separate | Pass — distinct sections in `SKILL.md`; the run's actual output kept `verification-result.json`, `debug-handoff.json` and the sidecar as three separate files |
| 7 | Every command named by the skill or its acceptance criteria exists and runs within the declared write boundary | Pass for existence/execution. One named sub-instruction was never invoked this run (see Finding F3) — that is a runtime-adherence gap, not a missing or broken command. |

## 3. Ranked finding summary

| # | Finding | Dimension(s) | Occurrences | Evidence class |
|---|---|---|---|---|
| F1 | This run copied `.env` (containing Auth0 domain/client-ID configuration) from the integration checkout into the slice worktree, unilaterally and without asking the tester first, to unblock login — an action that reads as "change configuration," which the skill's own safety boundary prohibits outright, and every future slice worktree will hit the same missing-file blocker since `.env` is gitignored by design | Safety and scope control | 1 confirmed this run; structurally certain to recur on every future slice-worktree manual validation | trace, confirmed |
| F2 | `SKILL.md` never names `hash-artifact.mjs`, even though `verification-result.json` and `debug-handoff.json` require exact `sha256` pointers for every consumed artifact and the acceptance criteria (item 35) name that script (or `new-observations.mjs`) as the only sanctioned source, "never digests computed by hand" | Correctness/artifact integrity, Maintainability | 1 confirmed (this run relied on independently-recalled knowledge of the script, not on `SKILL.md`'s own text) | trace + static, confirmed |
| F3 | Step 9's second sub-instruction — `run-context.mjs --product-root <product> --compare`, to "report any delta" — was never run this attempt, even though the first sub-instruction in the same numbered step (`validate-handoff.mjs` on the full chain) was | Execution adherence | 1 confirmed | trace, confirmed |
| F4 | Advised the tester to create a `Juno`-type map before checking the source for which robot capability gates the Astronaut object (`ERobotCapability.CollectorMapMaking`, Collector-only), costing one avoidable extra map-creation round trip once the wrong toolbar was discovered | User experience, avoidable cost | 1 confirmed | trace, confirmed |
| F5 | Reading-discipline deviations: `schemas\debug-handoff.schema.json` was read in full after `print-shape.mjs` truncated the enum values needed, without first attempting a write-and-validate retry as the "Reading discipline" section prescribes; and two file ranges (`flow-contract.json`, `migration-result.json`) were each re-read over a span already held | Context and tool cost | 3 (1 schema-read + 2 overlapping re-reads), already logged in this run's own sidecar | trace + artifact, confirmed |
| F6 (minor, optional) | Step 2's "check that the migration result reports failed or blocked validation honestly" does not literally cover a claimed-vs-actual count mismatch inside a `passed` validation entry (this run found `migration-result.json` claiming "8 tests" for a file that runs 6); the run still caught and reported it correctly, so this is a wording-breadth suggestion, not a defect | Behavioral correctness (wording only) | 1 confirmed | trace, confirmed |
| F7 | The tester-reported friction ("het voelt niet fijn") confirms F1's root cause is broader than `.env`: step 4 tells the tester to "start it from `<product>`... and stop any other slice's" but the skill never hands over the exact `cd`/`npm run dev` commands, so the tester started the dev server from the wrong checkout first (discovered only via a screenshot) before being walked, turn by turn, through stopping it, `cd`-ing, restarting, and then separately discovering and fixing the missing `.env` | Execution adherence, User experience | 1 confirmed this run; user independently reported the same friction from their own experience | trace + user-reported, confirmed |
| F8 | The tester also reported missing guidance for the app-level navigation itself (which page, which menu entry, which toolbar category to reach the Astronaut object) — step 4 only requires naming a control once a walkthrough item is reached, with no requirement to pre-trace the full navigation path (and its preconditions, such as the robot-type gate behind F4) from source before the walkthrough's first message | Execution adherence, User experience | 1 confirmed this run; user independently reported wanting this "voorgekauwd" | trace + user-reported, confirmed |

## 4. Complete finding ledger

### F1 — Local configuration file copied into the slice worktree without the tester's own action or confirmation
- Classification: safety-boundary-adjacent action, self-initiated rather than
  handed to the tester.
- Location: `SKILL.md` step 4 (manual walkthrough) and the Safety boundary
  section's "Never: ... install dependencies, change configuration or start a
  persistent service."
- Evidence: after the tester restarted `npm run dev` in the slice worktree
  (`C:\Project\frontend-slices\detail-drawer-astronaut-form-baseline-1`), the
  Maui app showed "Auth0 is not configured. Add VITE_AUTH0_DOMAIN and
  VITE_AUTH0_CLIENT_ID to .env, then restart the dev server." This run then
  ran `Test-Path`/`Get-Content .gitignore` to confirm `.env` is gitignored,
  and ran `Copy-Item "C:\Project\frontend\.env"
  "C:\Project\frontend-slices\...\.env"` directly, narrating "Ik kopieer het
  over" without first asking the tester to do it or confirming the action —
  before asking the tester to restart the dev server again.
- Effect: safety and process — a configuration file carrying Auth0 client
  credentials was copied by the agent, not the tester, contradicting the
  skill's own "the person in this chat is the tester, and this skill leads
  them" model and its explicit "Never: ... change configuration" boundary.
  Every future slice worktree (created fresh by `slice-worktree.mjs
  --create` per `docs\project-constants.md`) will lack the same gitignored
  files, so this is not a one-off: it is the default state of every manual
  validation this skill will ever lead.
- Occurrence count: 1 directly observed; structurally guaranteed to recur.
- Confidence: high (directly observed in this conversation's own tool-call
  history).

### F2 — `hash-artifact.mjs` required by the acceptance criteria but never named in `SKILL.md`
- Classification: missing reference / maintainability gap.
- Location: `SKILL.md` step 8 ("It references the exact hashes of the
  consumed contract and migration result") and the Inputs section; compare
  `docs\flow-verify-v0.21-acceptance.md` item 35: "artifact pointers come
  from a script (`new-observations.mjs` or `hash-artifact.mjs`), never from
  digests computed by hand."
- Evidence: `grep -n "hash-artifact|sha256|hashes" SKILL.md` returns only the
  one prose mention of "hashes" in step 8; the script name itself appears
  nowhere in `SKILL.md`. This run used `hash-artifact.mjs` correctly (for
  `flow-contract.json`, `migration-result.json` and, for the `debug-handoff`,
  `verification-result.json`), but only because of prior familiarity with the
  lab's conventions, not because `SKILL.md` said so.
- Effect: correctness/artifact-integrity risk — a run without that prior
  familiarity has no textual instruction pointing it at the one sanctioned
  hashing script, and acceptance item 35 explicitly forbids the alternative
  (hand-computed digests).
- Occurrence count: 1 confirmed this run (static gap, would recur every run).
- Confidence: high.

### F3 — `run-context.mjs --compare` never run
- Classification: prescribed step skipped.
- Location: `SKILL.md` step 9: "Validate the complete chain, debug artifacts
  included, with `validate-handoff.mjs`. Run `node "<lab>\scripts\run-context.mjs"
  --product-root <product> --compare` and report any delta."
- Evidence: this run's tool history shows `validate-handoff.mjs` invoked
  against the full four-artifact chain (contract, migration result,
  verification result, debug handoff) and succeeding, but no corresponding
  `run-context.mjs --compare` call anywhere in the transcript.
- Effect: execution adherence — bundling two required actions into one
  numbered step, with the second introduced only by "Run ... and report any
  delta" after a full sentence about the first, makes it easy to treat the
  step as done once the first action succeeds.
- Occurrence count: 1 confirmed.
- Confidence: high.

### F4 — Robot-type precondition guessed before checking source
- Classification: avoidable manual-walkthrough setup cost.
- Location: `SKILL.md` step 4's own principle of never asking about "a
  control you have not found there" extends naturally to preconditions for
  reaching a control at all.
- Evidence: this run told the tester to create a `Juno Flex` map (matching
  the precedent visible in the canonical example's manual-validation summary,
  which used "Juno Flex robot"), then discovered from the rendered toolbar
  screenshot that Astronaut objects were absent, and only then grepped the
  source (`floorPlanElementsList\index.tsx`, `ERobotCapability.CollectorMapMaking`)
  to find the actual precondition (a `Collector` map), requiring the tester
  to redo the "New route package" step.
- Effect: user experience/avoidable cost — one redundant round trip with the
  human tester.
- Occurrence count: 1 confirmed.
- Confidence: high.

### F5 — Reading-discipline deviations
- Classification: unnecessary context load (already captured in this run's
  own sidecar as `schema-source-read-after-print-shape-truncation` and
  `reread-overlapping-contract-ranges`).
- Location: `SKILL.md`'s "Reading discipline" section: "Learn an artifact's
  shape from `print-shape.mjs`, never from `schemas\`... Read the validator's
  rule only when an error names no fix and one retry fails" and "never
  re-read a range you hold."
- Evidence: `schemas\debug-handoff.schema.json` was opened in full with
  `view` after `print-shape.mjs` truncated its `enum` arrays (shown as
  `"…(+1 more)"`), without first writing a draft and letting
  `validate-handoff.mjs` name the fix; `flow-contract.json` was read at
  `[120,320]` then again at `[246,371]`, and `migration-result.json` at
  `[1,120]` then again at `[80,220]`.
  Sidecar cross-reference: `skill-run-observations-flow-verify.json` entries
  `schema-source-read-after-print-shape-truncation` (count 1) and
  `reread-overlapping-contract-ranges` (count 2).
- Effect: context/tool cost, minor. `SKILL.md`'s own wording already
  correctly prohibits both behaviors; this is an execution lapse against
  already-correct text, not a wording gap, so no source change is proposed
  for this finding (see audit-contract: a deterministic check failure needs
  an established impact and repair before becoming an edit).
- Occurrence count: 3 (1 + 2).
- Confidence: high.

### F6 — Validation-honesty wording scope (minor, optional)
- Classification: wording-breadth suggestion.
- Location: `SKILL.md` step 2: "Check that the migration result reports
  failed or blocked validation honestly."
- Evidence: `migration-result.json`'s validation entry for
  `AngularAstronautModelHost.test.tsx` claimed "8 tests" while the file
  contains and runs 6; the entry's `status` was still accurately `passed`.
  This run caught and reported the mismatch in `verification-result.json`'s
  `validation[0].summary` and top-level `diagnosis`, going beyond the literal
  instruction (which only names "failed or blocked" honesty, not count
  accuracy within a passing entry).
- Effect: none this run (already handled correctly); a future, less careful
  run has no explicit instruction to compare a claimed count against the
  actual test output when the status itself is `passed`.
- Occurrence count: 1.
- Confidence: high for the observation; the fix itself is a discretionary
  wording broadening, not a correction of an error.

### F7 — Dev-server switch handed to the tester piecemeal, without the concrete commands
- Classification: prescribed step underspecified; avoidable multi-turn cost.
- Location: `SKILL.md` step 4's opening clause on starting the app "from
  `<product>`, this slice's worktree, and stops any other slice's."
- Evidence: the tester's first screenshot showed `npm run dev` running from
  `C:\Project\frontend` (confirmed by the visible prompt path and `fd`
  history), not the slice worktree; this was only caught because the tester
  shared a terminal screenshot. The tester then had to be asked, in a
  separate turn, to Ctrl+C and re-run `npm run dev` from the exact worktree
  path — a command this run could have supplied as literal, ready-to-paste
  text in its very first message on this topic, alongside the reminder to
  stop the old one. The user independently confirmed this "voelt niet fijn"
  and proposed the skill either always give the exact commands, or — with a
  confirmation question — perform the stop/start itself.
- Effect: user experience and avoidable cost (one extra full round trip); a
  secondary safety question the proposed fix must resolve explicitly, since
  `SKILL.md`'s own boundary reads "Never: ... start a persistent service,"
  and `npm run dev` is exactly that.
- Occurrence count: 1 confirmed this run, corroborated by direct user report.
- Confidence: high.

### F8 — No pre-walkthrough navigation-path research requirement
- Classification: prescribed step underspecified.
- Location: `SKILL.md` step 4's per-item instruction ("a step names the
  control... and never a control you have not found there") has no
  counterpart requiring the *complete* navigation path — from app launch to
  the first walkthrough item — to be traced from source and presented before
  the first action is requested.
- Evidence: this run asked the tester "moet ik een juno of collecor of
  brownie kiezen bij create ne wmap?" and "hoe kom ik daar bij robot
  selecteren?" reactively, discovering the robot-type precondition
  (`ERobotCapability.CollectorMapMaking`, see F4) and the Objects-toolbar
  location only after the tester was already navigating blind. The user
  independently confirmed they wanted this pre-chewed (`ik wil dat
  voorgekauwd hebben`).
- Effect: user experience — the tester acted as a co-debugger discovering the
  path live instead of following a pre-verified sequence; directly caused
  the F4 round trip and several clarifying questions that a source trace
  (e.g. `floorPlanElementsList\index.tsx`, `RobotSelection.tsx`,
  `ERobotType.ts`) would have avoided.
- Occurrence count: 1 confirmed this run, corroborated by direct user report.
- Confidence: high.

## 5. Proposed changes

1. **(Significant, safety)** Add an explicit line to `SKILL.md` step 4, right
   after "the tester starts it from `<product>`, this slice's worktree, and
   stops any other slice's," stating that a freshly created slice worktree
   lacks the checkout's gitignored local files (naming `.env` as the known
   example), that the **tester** copies these from the integration checkout
   themselves when the app reports a missing configuration value, and that
   the skill never copies, generates or edits a configuration/environment
   file itself, per the safety boundary's "change configuration" prohibition.
   - Depends on: nothing.
   - Regression risk: very low — additive guidance, changes no existing
     validated behavior or artifact shape.

2. **(Significant, correctness)** Name `hash-artifact.mjs` explicitly in
   `SKILL.md`, in the Inputs section or step 8, as the required source for
   every `sha256` pointer `verification-result.json` and `debug-handoff.json`
   need (contract, migration result, and — on a non-`PASS` result — the
   verification result itself), matching acceptance item 35's "never from
   digests computed by hand."
   - Depends on: nothing.
   - Regression risk: very low — names an already-existing, already-used
     script; does not change validation logic or file shapes.

3. **(Significant, execution adherence)** Split step 9 into two explicit,
   separately actionable sentences (or two bullet points under the same
   numbered step) so `validate-handoff.mjs` and `run-context.mjs --compare`
   read as two required actions rather than one action with a trailing
   clause, reducing the chance the second is skipped once the first
   succeeds.
   - Depends on: nothing.
   - Regression risk: very low — wording/formatting only, no behavior change.

4. **(Significant, UX/process — needs deliberate sign-off)** Replace step 4's
   bare "the tester starts it from `<product>`... and stops any other
   slice's" with the concrete, ready-to-paste commands (`cd <product>` then
   `npm run dev`) in the same message that asks the tester to switch, plus the
   `.env` check from change 1, so the whole environment switch is one
   complete instruction instead of a discovered-in-pieces sequence.
   Two ways to close the loop the user's own report raised; pick one:
   - **4a (recommended, no boundary change):** the skill always hands the
     tester the exact commands to run themselves and waits for confirmation;
     the tester remains the one who stops/starts the process, so nothing in
     the safety boundary changes.
   - **4b (boundary change, needs explicit sign-off):** add a narrow,
     named exception to the safety boundary allowing the skill itself to
     stop the currently running local frontend dev server and start
     `npm run dev` in the slice worktree, but only after one explicit
     per-action confirmation naming the exact commands about to run. This
     directly contradicts the current "Never: ... start a persistent
     service" line, so it must be adopted (or rejected) as its own
     deliberate decision, not bundled silently with 4a.
   - Depends on: nothing (4a); a boundary-wording change (4b).
   - Regression risk: very low (4a, wording only); moderate (4b — the skill
     would gain the ability to run/kill a long-lived local process, which is
     exactly what the boundary was written to prevent, even though scoped
     narrowly to this one dev-server command).

5. **(Significant, execution adherence)** Add a requirement to step 4, before
   the walkthrough's first message, to trace the concrete navigation path
   from the product's own routing/menu/toolbar source (start page → the
   specific menu entry, required preconditions such as a robot-type gate,
   and the toolbar category) and present it as one complete sequence of
   named steps, rather than relying only on the per-item "name the control"
   rule once each walkthrough item is reached.
   - Depends on: nothing.
   - Regression risk: low — adds a research sub-step before the walkthrough
     starts; does not change any artifact shape or scenario evaluation.

### Optional minor bundle

- Broaden step 2's honesty check to "Check that the migration result reports
  validation outcomes — including any claimed test count — honestly, not
  only whether it is failed or blocked." (Addresses F6.)

F5 (schema/range re-reads) remains a documented finding with no proposed
source change: it is an execution lapse against text that is already
correct, not a wording gap.

### Out-of-scope observation (not proposed here)

`docs\flow-verify-v0.21-acceptance.md` item 20 — "it shows the generated
`--inline` handoff verbatim in the chat and marks an item that did not move as
`no-change` rather than a no-op `update`" — names concepts (`--inline`
handoff, board-style `no-change`/`update` states) that appear nowhere in
`flow-verify`'s own `SKILL.md` or workflow. This looks like a leftover from a
different skill's acceptance template. It is flagged here as an **Open
question** for whoever owns `docs\` in the lab, not corrected in this audit:
the acceptance document is shared lab documentation outside `flow-verify`'s
own editable surface (`SKILL.md` + its two `references\` files), and
correcting a skill's own yardstick from inside that skill's audit is a
conflict of interest this audit avoids.

## 6. Approval and applied-change record

User selection: apply changes 1, 2, 3, 4a and 5, plus the optional minor
bundle (F6). Change 4b (letting the skill itself stop/start the dev server)
was explicitly not selected and remains unapplied, per its own "needs
deliberate sign-off" framing in §5.

Applied to `C:\Users\miles.zeilstra\.copilot\skills\flow-verify\SKILL.md`:

| # | Change | Location edited |
|---|---|---|
| 1 | Tester copies missing gitignored config (`.env`) themselves; skill never touches configuration files | Step 4, manual-walkthrough paragraph |
| 2 | `hash-artifact.mjs` named as the required `sha256` source | Inputs section, new bullet |
| 3 | Step 9 split into "validate" and "also run --compare" sub-bullets | Step 9 |
| 4a | Exact `cd`/`npm run dev` commands handed to the tester in one message; tester always runs them | Step 4, manual-walkthrough paragraph (same edit as #1) |
| 5 | Pre-walkthrough navigation-path tracing from routing/menu/toolbar source, presented as one ordered sequence | Step 4, manual-walkthrough paragraph (same edit as #1/#4a) |
| F6 | Step 2's honesty check broadened to cover claimed test counts, not only failed/blocked status | Step 2 |

Version bumped `0.21.0` → `0.22.0` (minor: changes 1, 4a and 5 add required
behavior, not only wording; change 2 and F6 are additive/wording).

## 7. Validation outcomes

- `node "<lab>\scripts\validate-handoff.mjs"` re-run against this run's own
  four-artifact chain (`flow-contract.json`, `migration-result.json`,
  `verification-result.json`, `debug-handoff.json`) after the `SKILL.md`
  edits: **Validated 4 artifact(s)** — no regression, as expected, since the
  edits only change future-run instructions, not any schema or already-written
  artifact.
- `node "<lab>\scripts\validate-handoff.mjs"` re-run against
  `skill-run-observations-flow-verify.json`: **Validated 1 artifact(s)**.
- No automated test suite exists for `flow-verify` itself (a prompt-only
  skill); "re-running acceptance checks" here means the deterministic checks
  in §2 were re-confirmed to still pass after editing, and the full,
  post-edit `SKILL.md` was re-read end to end (§ "Complete finding ledger"
  evidence trail) to confirm step numbering, cross-references and the safety
  boundary stayed internally consistent.

## 8. Unresolved observations and Open questions

- Open question: `docs\flow-verify-v0.21-acceptance.md` item 20 appears to
  reference another skill's concepts (see §5). Recommend a separate,
  dedicated pass over the acceptance document itself, owned by whoever
  maintains shared `docs\` content, not this single-skill audit.
- Unresolved: two other `flow-verify` observation sidecars exist in the lab
  (`runs\2026-09-09-detail-drawer-line-edit-baseline-1\skill-run-observations-flow-verify.json`
  and
  `runs\flows\detail-drawer-straight-strip-form\2026-09-14-detail-drawer-straight-strip-form-baseline-1\skill-run-observations-flow-verify.json`
  plus its `-2` attempt) that the user chose to exclude from this pass. A
  follow-up audit could fold them in to check whether F1–F6 recur across
  those runs too.
