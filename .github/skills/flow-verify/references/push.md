# Checkpoint reconciliation and push

Read this only when `migration-result.json` records committed checkpoints or
the contract's `pushPolicy` is `confirm-after-pass`.

Every committed checkpoint must exist on the expected branch and contain only
its recorded paths, and the push policy must match the contract.

Push is a release gate, not verification evidence. Push only when all of these
hold: an overall `PASS`, passed required host validation,
`confirm-after-pass`, a clean worktree, matching checkpoint SHAs, and one
explicit confirmation given after you show the remote name, the exact branch
and the commit list. Push only that branch, and set upstream only after showing
that this is the first push. Never force-push or push tags.

Record `pushed`, `declined`, `blocked` or `not-requested` honestly; `pushed`
needs the confirmation evidence and the exact committed SHAs. A failed or
declined push never rewrites scenario results and stays visible in
`verification-result.json`.
