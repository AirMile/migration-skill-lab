---
document: flow-observation-capture
version: 0.1.0
status: experimental
date: 2026-09-11
---

# Post-run observation capture

Every flow skill reads this file once, after its primary artifact is written,
or after its final `BLOCKED`, failed or parked response when none can be
produced. It lives here rather than in each skill so the four cannot drift
apart, and a run reads it at the end because nothing in it is needed earlier.

During the run, retain concrete evidence silently: user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted and output mismatches. Never interrupt or
reprioritize the primary workflow to analyze them.

1. Evaluate this run's own tool history against these checks and record every
   one that fired. They are countable, so answer from the history, not from
   impression:
   - the same file read more than twice, or re-read over a range already held:
     `unnecessary-context-load`;
   - two or more searches whose patterns differ only in alternation, wording or
     case: `unnecessary-context-load`;
   - a schema, validator or renderer source, or a whole example artifact, read
     instead of running the command or `print-shape.mjs`:
     `unnecessary-context-load`;
   - a tool call that failed because the skill named a path, command or flag
     that does not exist or does not behave as written:
     `skill-caused-tool-failure`;
   - a step done by hand that a script in `scripts\` already performs:
     `deterministic-step-candidate`;
   - a user correction, a restated instruction, or the same question asked
     twice: `user-correction` or `ambiguous-instruction`;
   - an artifact that needed a repair pass before it validated:
     `output-mismatch`.
2. Exclude product defects, external and expected precondition blockers,
   missing Angular conventions themselves, preferences and static speculation.
   Executor noise is a host or transport failure unrelated to the skill; a
   tool call the skill's own wording caused is never executor noise.
3. Deduplicate semantically equivalent signals and keep their
   `occurrenceCount`. Do not cap the number of material observations.
4. Create the sidecar with
   `node "<lab>\scripts\new-observations.mjs" --primary <primary artifact> --status <status> --summary "<one sentence>"`,
   or with `--skill`, `--skill-version`, `--run-id`, `--flow-id` and `--run-dir`
   when no primary artifact exists. It names the file
   `skill-run-observations-<skill>.json`, so phases sharing a run directory
   never overwrite each other's evidence, rejects a status that does not belong
   to the skill, and prints the entry shape. Add one entry per check that fired.
   An empty `observations` list claims every check was evaluated and none
   fired; leave it empty only when that is true.
5. Validate it with `node "<lab>\scripts\validate-handoff.mjs" <sidecar>`.
6. Report a capture or validation failure separately; it never changes the
   primary status.

The sidecar is evidence for a later `migration-skill-audit`, not a change
proposal or an authorization. Never edit skill source during a run.
