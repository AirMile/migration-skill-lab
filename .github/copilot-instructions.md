# Migration skill execution

When a project migration skill actually runs, silently note concrete evidence
that the skill instructions caused friction, waste, ambiguity, or an execution
failure. Finish the skill's primary workflow and result first, then follow that
skill's post-run observation-capture protocol.

Do not treat static preferences, product defects, expected blockers, missing
Angular conventions, or unproven causality as skill-improvement evidence. An
observation is evidence for a later audit, not permission to edit a skill.

## Commits and runtime skills

Before a coherent, reviewable change grows into a larger mixed change, propose
an explicit commit point to the user. Never create that commit without the
user's approval.

After every commit, inspect its changed paths. For each changed project skill
under `.github\skills\<skill-name>\`, synchronize that complete skill directory
to `~\.copilot\skills\<skill-name>\`. Do not copy unrelated skills or overwrite
a runtime skill whose source directory was not part of the commit. Verify every
copied file by hash and report the synchronization result. If the commit changes
no project skill, state that no Copilot runtime skill update was needed.
