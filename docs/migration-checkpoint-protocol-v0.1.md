---
document: migration-checkpoint-protocol
version: 0.1.0
status: experimental
date: 2026-09-07
---

# Migration checkpoint protocol v0.1

## Design source

The safety design adapts the public `AirMile/claude-config` `core-commit`
skill at commit `1205499dfec8ae2498d68c1a65d9ae0d25c1b327`. It reuses
pre-flight, denylist, convention-detection, validation and integrity
principles. The migration contract remains stricter: the approved
`allowedWritePaths` is always controlling.

## Authorization

The approved Flow Contract records:

- `mode`: `auto-local` or `disabled`;
- exact expected branch;
- external work-item reference;
- approving role and date;
- push policy: `confirm-after-pass` or `never`.

Approval of `auto-local` is one batch authorization for coherent green
milestones. It is not permission to branch, stash, amend, push or bypass hooks.

## Preflight

Create a compact manifest and run:

```powershell
node .\scripts\verify-checkpoint.mjs --prepare <manifest.json>
```

Manifest shape:

```json
{
  "repositoryRoot": "C:\\Project\\frontend",
  "expectedBranch": "feature/migrate-detail-drawer",
  "baselineHead": "<current-head>",
  "baselineStatus": [],
  "allowedWritePaths": ["src/approved-slice"],
  "candidatePaths": [
    {
      "path": "src/approved-slice/detail-drawer.ts",
      "deltaIsolation": "not-needed"
    }
  ],
  "validations": [
    {
      "name": "targeted-tests",
      "required": true,
      "status": "passed"
    }
  ],
  "externalRef": "TP522512"
}
```

The read-only verifier checks:

- repository, branch and expected HEAD;
- active merge, rebase or cherry-pick state;
- credential/environment/key/certificate path denylist;
- candidate coverage by `allowedWritePaths`;
- required validation outcomes;
- unexpected changed paths;
- pre-existing dirty candidate paths and declared delta isolation;
- deterministic staging paths and repository-style subject.

Failure blocks the checkpoint. Never turn it into a success-shaped result.

## Staging and commit

Never use `git add -A`. Stage only the exact returned paths. Before committing,
run:

```powershell
node .\scripts\verify-checkpoint.mjs --verify-staged <manifest.json>
```

This requires the staged path set to match exactly and returns a SHA-256 of the
staged diff. A pre-existing dirty candidate file needs exact isolation; if that
proof or mechanism is unavailable, stop rather than stage the whole file.

Do not create an empty commit. Do not bypass hooks or amend after failure.
After commit, run:

```powershell
node .\scripts\verify-checkpoint.mjs --verify-commit `
  <manifest.json> <commit-sha>
```

This verifies ancestry, expected branch, exact committed paths, allowlist,
denylist and external-reference subject. Record each committed, skipped or
blocked milestone in `migration-result.json`.

## Push gate

`migrate-flow` never pushes. After independent overall `PASS` and passed
required host validation, `verify-flow`:

1. verifies the checkpoint SHAs and a clean worktree;
2. displays remote name, branch and commit list;
3. asks one explicit confirmation;
4. pushes only the approved featurebranch and sets upstream only when needed;
5. records the real result without storing a private remote URL.

Never force-push, push tags or push on `FAIL` or `BLOCKED`.
