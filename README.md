# Migration Skill Lab

Local, experimental source repository for a Copilot-native
React-to-Angular migration research workflow.

## Current scope

This lab contains:

- the preserved source reference for `migration-analyze` v0.1.0;
- experimental `flow-baseline` v0.20.0, `flow-migrate` v0.14.0 and
  `flow-verify` v0.11.0 source skills;
- experimental `flow-debug` v0.4.0 source skill;
- experimental `migration-skill-audit` v0.1.0 source skill;
- versioned functional and work-item handoff schemas, examples and a
  dependency-free validator, including `examples\handoff\detail-drawer-line-edit`:
  a complete chain from a run that passed end to end, at the versions in force,
  which is the shape reference every skill copies from;
- `scripts\hash-artifact.mjs`, which prints the path-and-sha256 pointer block
  one artifact needs to reference another;
- the deterministic steps every flow skill used to do by hand, each with
  `--help` and `--self-test`: `run-context.mjs` (product status and its later
  comparison, run directory, runId, earlier handoffs, terminating commands),
  `print-shape.mjs` (a compact skeleton of an example artifact instead of the
  whole file), `seed-work-item.mjs` (the next work-item snapshot from the
  previous one, and `--finalize` for progress and actions),
  `continuation.mjs` (the next phase's invocation) and `new-observations.mjs`
  (the observation sidecar);
- `docs\flow-work-item-steps.md` and `docs\flow-observation-capture.md`, the
  steps the flow skills share and read only when they reach them;
- dependency-free sprint-backlog Markdown rendering and scoped checkpoint
  preflight;
- schema-valid post-run observation sidecars for later skill audits;
- acceptance criteria and targeted references for each experimental skill;
- a versioned JSON backlog;
- `docs\project-constants.md`, the settled per-project decisions every
  skill reads instead of asking: framework version, package set, compilation
  and mount mechanism, install command, test location, coverage and the manual
  verification environment;
- a dependency-free renderer for a standalone, read-only HTML backlog;
- an approved report contract for confidential analyses outside the product
  repository.

Reviewed personal runtime snapshots are installed under `~\.copilot\skills`;
the repository remains their versioned source of truth. The representative POC
remains open until its conventions, validation plan and runtime publication
have been separately reviewed.

## Safety boundary

- Treat `C:\Project\frontend` as read-only.
- Do not install dependencies in the product repository.
- Do not create product branches, commits, pushes, merges, or external
  writes.
- Do not store credentials, tokens, private URLs, full source copies, or
  unnecessary personal data.
- Keep Lely-specific material in approved internal storage.
- Do not configure a remote until repository ownership, namespace,
  visibility, and access have been approved.
- Never update a skill during its own run. Capture concrete run evidence and
  require a separate audit plus human approval before changing skill source.

## Backlog

`backlog\backlog.json` is the canonical backlog. `backlog\backlog.html` is
generated output for people and must not be edited manually.

Generate or refresh the standalone viewer:

```powershell
node .\scripts\render-backlog.mjs
```

Check that the generated viewer matches the canonical JSON:

```powershell
node .\scripts\render-backlog.mjs --check
```

Validate a handoff chain:

```powershell
node .\scripts\validate-handoff.mjs `
  .\examples\handoff\demo-line-drawer\flow-contract.json `
  .\examples\handoff\demo-line-drawer\migration-result.json `
  .\examples\handoff\demo-line-drawer\verification-result.json `
  .\examples\handoff\demo-line-drawer\work-item-baseline.json `
  .\examples\handoff\demo-line-drawer\work-item-migration.json `
  .\examples\handoff\demo-line-drawer\work-item-verification.json
node .\scripts\validate-handoff.mjs `
  .\examples\observations\demo-line-drawer\migrate-flow-observations.json
node .\scripts\validate-handoff.mjs --self-test
node .\scripts\verify-checkpoint.mjs --self-test
node .\scripts\render-work-item-handoff.mjs --self-test
node .\scripts\render-work-item-handoff.mjs --check `
  .\examples\handoff\demo-line-drawer\work-item-baseline.json `
  .\examples\handoff\demo-line-drawer\work-item-migration.json `
  .\examples\handoff\demo-line-drawer\work-item-verification.json
```

Validate the repair and independent re-verification examples:

```powershell
node .\scripts\validate-handoff.mjs `
  .\examples\handoff\demo-line-drawer\flow-contract.json `
  .\examples\handoff\demo-line-drawer\migration-result.json `
  .\examples\debug\demo-line-drawer\failed-verification-result.json `
  .\examples\debug\demo-line-drawer\debug-handoff.json `
  .\examples\debug\demo-line-drawer\debug-result.json
node .\scripts\validate-handoff.mjs `
  .\examples\handoff\demo-line-drawer\flow-contract.json `
  .\examples\handoff\demo-line-drawer\migration-result.json `
  .\examples\debug\demo-line-drawer\debug-result.json `
  .\examples\debug\demo-line-drawer\reverified-verification-result.json
```

For a real approved milestone, use `verify-checkpoint.mjs --prepare`, stage
only its returned paths, then use `--verify-staged` before commit and
`--verify-commit` after commit. The script is read-only outside its isolated
self-test repository.

The HTML embeds a snapshot of the JSON and has no server, fetch request,
external script, font, CDN, or other network dependency. It can be opened
on its own, but it remains confidential when its backlog contains
Lely-specific information.

## Intended skill lifecycle

1. Author and review source in this repository.
2. Run the acceptance and benchmark checks.
3. After explicit approval, copy a reviewed snapshot to the matching folder
   under `~\.copilot\skills`.
4. Keep source and runtime snapshot versions explicit.

Do not use a live symlink to a public or personal repository.

## Model per skill

Copilot has no `model:` frontmatter; the model is chosen per chat. Because
every phase already runs in a fresh chat, set it deliberately when opening
that chat.

| Skill | Model | Why |
|---|---|---|
| `flow-baseline` | Claude Opus 5 | Heaviest reasoning. It reads unfamiliar React, inventories every rendered control and conditional branch, and writes the contract everything downstream depends on. An error here poisons all later phases. |
| `flow-migrate` | Claude Sonnet 5; Opus 5 for a risky slice | Code generation inside a tight allowlist plus test authoring. Use Opus 5 when the slice touches drawlib, history or the host boundary. |
| `flow-verify` | GPT-6 Astra or GPT-5.5 — deliberately a different family than `flow-migrate` used | This is where the flow actually failed. Finding V1 shows the verifier silently skipped a requirement its own contract stated. A different model family does not inherit the migrator's blind spot. |
| `flow-debug` | Claude Sonnet 5 or GPT-5.3-Codex | A bounded tier machine: reproduce, hypothesize, smallest patch. |
| `migration-skill-audit` | Claude Opus 5 | Meta-reasoning over instruction text and spotting structural gaps, which is what produced M1 and V1. |

Do not use Haiku 4.5, Gemini Flash, GPT-5 mini, GPT-5.4 mini or
MAI-Code-1.1-Flash for any flow skill. They are too light for contract-grade
reasoning, and the mechanical steps are already scripts.

## Migration workflow

1. `flow-baseline` is read-only for the product repository. It surveys the
   selected flow's rendered surfaces, puts two or three candidate boundaries to
   the user with what each one costs, and then creates one final
   `flow-contract.json` carrying the chosen scope, surface inventory, target
   architecture, scenarios and open questions. It writes no report: a prose copy
   of a validated artifact drifts, and no later skill reads it.
2. `flow-baseline` ends at one review summary, which is the review surface in
   place of a report. It renders scope, the surface inventory, the architecture,
   scenario summaries, required characterization, the write allowlist,
   validation commands, rollback, checkpoint policy, decisions and open
   questions from the validated contract. There is no approval gate: from
   schemaVersion 6 a contract has no `status` and no `approval`, and what bounds
   the next phase is `scope.allowedWritePaths`. The user then picks one
   continuation: open a fresh `flow-migrate` chat now, paste the invocation into
   a chat of their own, or save it in the run directory. Plan mode is the user's
   to enable; when a session already runs in it, the artifacts are written after
   it is exited.
3. `flow-migrate` writes only inside `scope.allowedWritePaths`. It proves
   missing React behavior first, then implements the smallest Angular slice,
   creates scoped local checkpoints and writes `migration-result.json`.
4. `flow-verify` is read-only for product code. It independently evaluates the
   same contract and writes `verification-result.json` with `PASS`, `FAIL` or
   `BLOCKED`. After full PASS it may offer one confirmed featurebranch push.
5. On local repairable FAIL/BLOCKED, `flow-verify` writes a debug handoff and
   asks the user before opening a fresh `flow-debug` chat. It selects one
   `immediate`, `light` or `heavy` attempt at a time, parks after a failed
   heavy attempt, and hands repaired candidates to a user-confirmed fresh
   independent `flow-verify` chat.
6. After its primary output, each skill writes a
   `skill-run-observations-<skill>.json` sidecar with
   `scripts\new-observations.mjs`. An empty observation list proves that
   capture ran without inventing feedback.

Each phase also writes an immutable work-item snapshot and deterministic
copy/paste content for manual Targetprocess updates. The work tracker is
Targetprocess at `lely.tpondemand.com`; run artifacts created before
2026-09-08 still name it "TopDesk" and are left unchanged as historical
evidence. A snapshot covers Epic, Feature, User Story, stakeholder-readable
Tasks and a daily standup update. Story progress is validated from weighted
Task progress; checkpoint commits are evidence for the implementation Task,
not separate Tasks. The skills never update Targetprocess directly or claim
that copy-ready content was applied.

See `docs\skill-handoff-protocol-v0.8.md`. Skills exchange artifacts through
the ignored `runs\` directory; they must not rely on prior chat context.

## Improvement lifecycle

Observation capture runs after every flow-skill result. It records only
concrete execution evidence and never changes the primary result or skill
source. Run `migration-skill-audit` after a complete slice, after concrete user
feedback, or when observations recur. Do not run a full audit automatically
after every skill invocation.

The audit validates its evidence, reads the complete target skill surface,
retains all material findings, and applies only numbered changes selected by a
human. Observation artifacts remain immutable. Missing Angular conventions are
not skill defects unless a skill handles their absence incorrectly.

## Design sources

- Internal migration research dated 2 September 2026.
- GitHub Copilot agent-skills documentation.
- `AirMile/claude-config` `core-audit` at commit
  `1205499dfec8ae2498d68c1a65d9ae0d25c1b327`, used only as read-only
  design inspiration. Claude-specific tools, storage and plan-mode behavior are
  not runtime dependencies.
