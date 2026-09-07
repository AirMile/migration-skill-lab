---
name: migration-analyze
description: Establish the evidence-backed behavior of one existing React feature before an Angular migration is planned. Use only with /migration-analyze.
---

# Migration Analyze

Skill version: `0.1.0`.

Analyze one approved feature boundary in an existing React repository. Produce
a reviewable behavior baseline and uncertainty record without designing or
implementing the Angular target.

## Required Inputs

Before deep analysis, confirm:

- one feature, user flow, component boundary, or named behavior;
- the product repository root;
- the proposed boundary and material exclusions;
- the report target, or that output must remain in chat.

For this internal v0, the approved product root is
`C:\Project\frontend` and the approved report folder is
`C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses`.

If multiple roots or materially different boundaries remain plausible, stop
and ask one focused question. Do not guess.

## Workflow

1. Read `references/analysis-contract.md` before analyzing code.
2. Capture the product revision and exact worktree status before reads. A
   pre-existing dirty worktree is a baseline, not permission to change it.
3. Restate the boundary, exclusions, start state, end state, and confidence.
4. Start with relevant configuration, entry points, tests, stories, and
   documentation. Follow only dependencies that affect behavior or risk.
   Find every direct in-repository consumer, then trace one upstream edge when
   it determines a visible prop or mode. Stop before excluded parent behavior.
   A direct consumer renders the analyzed component; importing only its enum
   or types does not make a file a consumer.
5. Read `references/current-react-review-criteria.md` when assessing current
   conventions. Never turn React criteria into Angular target rules.
6. When a run compares current React behavior against a possible Angular
   target, or reports on Angular architecture, UI/component conventions,
   state management, or testing conventions, read the matching
   `references/target-angular-*.md` file(s) first. Each of those files
   carries its own approval-status disclaimer: none of them represent an
   Angular target approved by Bernhard or a representative Angular team.
   Cite them the same way as any other source and keep every unresolved
   item labeled `Open question`; do not upgrade a `target-angular-*.md`
   item to a confirmed target design decision.
7. Label every material statement `Confirmed`, `Inference`, or
   `Open question`. Give every `Confirmed` repository claim a file and line
   citation.
   Static test source confirms that an assertion exists, not that the test
   passed. Support absence claims with the complete relevant definition.
8. Produce every report section in the order defined by the analysis
   contract. Mark a non-applicable section explicitly rather than omitting it.
   Complete the contract's pre-delivery audit and correct every failure before
   returning or persisting the report.
9. Persist only the declared report when the target is approved. Surface a
   failed write; never claim that persistence succeeded when it did not.
10. Capture the product worktree status again. If it differs from the
    baseline, stop, report the delta, and do not revert or attribute it
    without evidence.

Describe operational evidence narrowly. Git evidence can confirm Git-visible
state, not unrelated external systems or actions that the run did not observe.

Prefer static evidence. Do not run commands that are known or likely to write
inside the product repository. If runtime evidence is materially necessary,
ask one focused question before running it.

## Safety Boundary

Never:

- create, edit, delete, rename, format, generate, stage, commit, stash, or
  check out anything in the product repository;
- install or update dependencies, lockfiles, environments, or configuration;
- start a persistent service;
- make external writes;
- store credentials, tokens, private URLs, full source copies, or unnecessary
  personal data;
- modify this skill, its references, its source repository, or an installed
  snapshot during a run;
- present an Angular convention or target design as fact without an approved
  Angular source.

Missing Angular conventions do not block analysis of current React behavior.
They do block unsupported target-design claims.

## Post-Run Improvement

After delivering the primary output, and only then, read
`references/post-run-improvement.md`. Do not run this review during an
ordinary chat or before the main workflow is complete.

The analysis write contract remains controlling. Do not append to a personal
feedback file unless the user separately approves that write; otherwise return
an improvement proposal in chat only.
