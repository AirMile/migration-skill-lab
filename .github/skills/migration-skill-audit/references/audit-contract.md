# Migration skill audit contract

Read this reference for every `migration-skill-audit` run.

## Evidence modes

| Mode | Evidence | Constraint |
|---|---|---|
| `trace` | Current conversation and valid artifacts | Report only events that actually occurred. |
| `artifact` | Valid observation artifacts | Preserve artifact and observation IDs. |
| `static` | Skill surface and acceptance criteria | Label runtime effects as Inference. |

Trace evidence outranks artifact summaries when they conflict. Artifact evidence
outranks static predictions. A contradiction remains visible; do not silently
choose the more convenient source.

## Deterministic checks

Record raw outcomes before judging them:

1. Frontmatter name matches the folder and the description has an explicit
   trigger.
2. `SKILL.md` and each referenced file exist; identify unreferenced Markdown
   resources.
3. The version in `SKILL.md` matches relevant acceptance documentation and
   produced examples where an exact target version is required.
4. Every named script, schema, example and downstream skill exists.
5. The observation artifact validates and targets the audited skill.
   Recompute a declared `primaryOutcome.sha256` from its artifact path before
   treating the sidecar as linked evidence.
6. Safety boundaries, primary artifacts and post-run capture remain separate.
7. Every command named by the skill or its acceptance criteria exists and can
   run within the declared write boundary.

Do not convert a deterministic check failure into a source edit until its
impact and smallest safe repair are established.

## Runtime evidence

For trace or artifact evidence, classify:

- prescribed steps skipped, weakened, reordered or improvised;
- user corrections and avoidable clarification prompts;
- skill-caused failed tool calls and retry loops;
- references or context loaded without affecting the result;
- output fields that could not be populated as prescribed;
- missing or misleading failure handling;
- deterministic manual work suitable for an existing or small local script.

Exclude:

- expected stops at documented approval or safety gates;
- product defects and product test failures correctly reported by the skill;
- the absence of Angular-team conventions;
- transient executor or infrastructure noise not caused by the skill;
- preferences without an observed effect;
- hypothetical failures presented as if they occurred.

## Analysis dimensions

Score each dimension from `1` to `5`; `5` means no finding, `4` means minor
findings only, and `3` or lower requires a significant finding:

1. Safety and scope control.
2. Behavioral correctness and artifact integrity.
3. Failure handling and repeat safety.
4. Execution adherence.
5. Context and tool cost.
6. User experience and approval clarity.
7. Maintainability and reference integrity.
8. Evidence capture quality.

Every score below `5` needs a cited finding. Every proposed source change needs
at least one confirmed finding or a static deterministic failure. Static
preferences alone never justify an edit.

## Deduplication and ranking

Merge observations only when actor, cause, affected instruction and effect are
materially the same. Sum `occurrenceCount` and retain every source ID. Similar
symptoms with different causes remain separate.

Rank in this order:

1. safety;
2. correctness and artifact integrity;
3. recurrence;
4. avoidable cost;
5. clarity and user experience.

Do not discard lower-ranked material findings. The report may summarize the
highest priorities first while retaining the complete finding ledger.

## Required report

Use this order:

1. Audit scope, target version, mode and evidence inputs.
2. Deterministic check results.
3. Ranked finding summary.
4. Complete finding ledger with classification, evidence, location, occurrence
   count, effect and confidence.
5. Proposed changes with dependencies and regression risk.
6. Approval and applied-change record.
7. Validation outcomes.
8. Unresolved observations and Open questions.

The report is an internal audit artifact. It must contain concise evidence
pointers, not conversation transcripts or product source copies.
