# Post-Run Skill Improvement

Run this protocol only after the skill's primary output is complete.

During the skill run, silently collect a maximum of three concrete
observations. Valid observations include user friction, an ambiguous or
skippable instruction, an unused reference, missing failure handling,
unnecessary context loading, unsuitable delegation, or a deterministic
manual task that should be scripted.

After the main report:

1. If there is no concrete observation, say nothing about skill feedback.
2. If there are observations, propose at most three concise improvements.
   For each one, state the observed effect, the proposed change, and the
   exact skill file or resource it concerns.
3. Append each proposed observation to
   `~/.copilot/skill-feedback.md`. Before appending, inspect existing
   entries for the same skill and observation. Increment its `Seen` count
   instead of adding a duplicate.
4. Do not edit the skill, its resources, or a source repository. A
   proposal becomes work only after the user explicitly approves it in
   the current session.

Use this record format:

```markdown
## YYYY-MM-DD — skill-name

- Seen: 1
  Observation: What concretely happened.
  Proposal: What should change.
  Location: relative/path/to/file.md
```
