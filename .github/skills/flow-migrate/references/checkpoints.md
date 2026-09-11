# Checkpoints

Read this only when the contract's `checkpointPolicy.mode` is `auto-local`.
That policy is the authorization: every green milestone it lists is committed
without asking again.

1. Freeze HEAD, branch and Git-visible status before the first product write.
2. After each coherent milestone whose checks pass, write a checkpoint manifest
   and run `node "<lab>\scripts\verify-checkpoint.mjs" --prepare <manifest.json>`.
   Continue only when it confirms the branch, HEAD, operation state, path
   denylist, `allowedWritePaths`, clean baseline ownership and validations. It
   blocks active Git operations, denylisted credential paths, paths outside the
   allowlist, failed validation, concurrent changes and a pre-existing dirty
   file whose new delta is not proven; never bypass a block.
3. Stage only the paths it returns, never `git add -A`, and run
   `verify-checkpoint.mjs --verify-staged <manifest.json>` to prove the staged
   path set and diff match the scoped delta.
4. Commit with a subject in the repository's own convention, read from its
   history, carrying the contract's external reference. A hook failure stops
   the checkpoint: never `--no-verify`, amend or an empty commit.
5. Run `verify-checkpoint.mjs --verify-commit <manifest.json> <sha>` and record
   the SHA, subject, paths, diff hash and validation summary in
   `migration-result.json`.

A dependency, lockfile or configuration change gets its own checkpoint, and
visual parity gets its own after the functional slice. Milestones attach to the
implementation Task, never one Task per commit. `flow-migrate` never pushes.
