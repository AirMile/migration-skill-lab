---
document: skill-source-reference
skill: migration-analyze
skillVersion: 0.1.0
status: preserved-benchmark-reference
recordedAt: 2026-09-04
---

# `migration-analyze` v0.1.0 source reference

`migration-analyze` v0.1.0 remains unchanged as the read-only benchmark
reference. New flow-analysis behavior is developed in the separate
`flow-baseline` skill; it must not silently alter this version's benchmark
meaning.

## Scope

- Product repository: `C:\Project\frontend` remains read-only for this skill.
- Canonical reports: `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses`.
- Runtime publication remains separately reviewed and is not performed by this
  reference record.

## Recorded source hashes

| Path | SHA-256 |
|---|---|
| `.github\skills\migration-analyze\SKILL.md` | `d49c78bd1a0654e97340bbc53c821dd225f90d49d613fb74d656d6fe7f52d195` |
| `.github\skills\migration-analyze\references\analysis-contract.md` | `3b0c5cb160487b08e0a54a6445f8fc0609d8c821f6c4c6eb2f40e86a454f404b` |
| `.github\skills\migration-analyze\references\current-react-review-criteria.md` | `721a1cb30542e2302bc4ea8b29d466d540fde9fc398540087f042b8d554e1a73` |
| `.github\skills\migration-analyze\references\post-run-improvement.md` | `bd5a4c1c008d14ad50fd80a539690c98d1d29ea5e81f6ad5567ea8c9fc69e8e7` |
| `.github\skills\migration-analyze\references\target-angular-architecture-and-structure.md` | `fed6f46bad1e7db70f8e1e3125cf925314962ec71e814e3697958d06f917f308` |
| `.github\skills\migration-analyze\references\target-angular-state-management.md` | `86a035a0b453b3b6b8cf527f725106e2beb6c19086ac0827bb5bd55ee27cb8da` |
| `.github\skills\migration-analyze\references\target-angular-testing-conventions.md` | `31606c947d7399cfeaa05035229903f93435955fa599d0651d9e9334909f7c47` |
| `.github\skills\migration-analyze\references\target-angular-ui-component-conventions.md` | `175cd932cd28a27a30b71dfd499b01c1763d74732470ff3f3b10eb03930b469c` |

## Relationship to the active workflow

The workflow adds `flow-baseline`, `migrate-flow`, `debug-flow`, and
`verify-flow`.
`flow-baseline` supersedes `migration-analyze` only for new POC work; the
v0.1 source above remains the comparison point for earlier benchmark results.
