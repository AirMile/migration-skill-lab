# Migration Skill Lab

Local, experimental source repository for a Copilot-native
React-to-Angular migration research workflow.

## Current scope

This lab contains:

- the preserved source reference for `migration-analyze` v0.1.0;
- experimental `flow-baseline` v0.7.0, `migrate-flow` v0.9.0 and
  `verify-flow` v0.8.0 source skills;
- experimental `debug-flow` v0.2.0 source skill;
- experimental `migration-skill-audit` v0.1.0 source skill;
- versioned functional and work-item handoff schemas, examples and a
  dependency-free validator;
- dependency-free sprint-backlog Markdown rendering and scoped checkpoint
  preflight;
- schema-valid post-run observation sidecars for later skill audits;
- acceptance criteria and targeted references for each experimental skill;
- a versioned JSON backlog;
- a dependency-free renderer for a standalone, read-only HTML backlog;
- an approved report contract for confidential analyses outside the product
  repository.

Reviewed personal runtime snapshots are installed under `~\.copilot\skills`;
the repository remains their versioned source of truth. The representative POC
remains blocked until its conventions, product-write approval, validation plan
and runtime publication have been separately reviewed and approved.

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
| `migrate-flow` | Claude Sonnet 5; Opus 5 for a risky slice | Code generation inside a tight allowlist plus test authoring. Use Opus 5 when the slice touches drawlib, history or the host boundary. |
| `verify-flow` | GPT-6 Astra or GPT-5.5 — deliberately a different family than `migrate-flow` used | This is where the flow actually failed. Finding V1 shows the verifier silently skipped a requirement its own contract stated. A different model family does not inherit the migrator's blind spot. |
| `debug-flow` | Claude Sonnet 5 or GPT-5.3-Codex | A bounded tier machine: reproduce, hypothesize, smallest patch. |
| `migration-skill-audit` | Claude Opus 5 | Meta-reasoning over instruction text and spotting structural gaps, which is what produced M1 and V1. |

Do not use Haiku 4.5, Gemini Flash, GPT-5 mini, GPT-5.4 mini or
MAI-Code-1.1-Flash for any flow skill. They are too light for contract-grade
reasoning, and the mechanical steps are already scripts.

## Migration workflow

1. `flow-baseline` is read-only for the product repository. It creates a
   human-readable behavior baseline and a draft `flow-contract.json` for one
   human-selected flow.
2. A human explicitly approves the contract, write allowlist, target
   conventions, validation commands and rollback before any product write.
3. `migrate-flow` writes only inside that approved scope. It proves missing
   React behavior first, then implements the smallest Angular slice, creates
   approved scoped local checkpoints and writes `migration-result.json`.
4. `verify-flow` is read-only for product code. It independently evaluates the
   same contract and writes `verification-result.json` with `PASS`, `FAIL` or
   `BLOCKED`. After full PASS it may offer one confirmed featurebranch push.
5. On local repairable FAIL/BLOCKED, `verify-flow` writes a debug handoff and
   asks the user before opening a fresh `debug-flow` chat. It selects one
   `immediate`, `light` or `heavy` attempt at a time, parks after a failed
   heavy attempt, and hands repaired candidates to a user-confirmed fresh
   independent `verify-flow` chat.
6. After its primary output, each skill writes a
   `skill-run-observations.json` sidecar. An empty observation list proves that
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

See `docs\skill-handoff-protocol-v0.6.md`. Skills exchange artifacts through
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
