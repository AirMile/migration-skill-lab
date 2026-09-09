---
name: flow-verify
description: Independently verify one approved React-to-Angular migration flow against its Flow Contract and report PASS, FAIL or BLOCKED. Use only with /flow-verify.
---

# Flow Verify

Pipeline: `/flow-baseline` -> `/flow-migrate` -> `/flow-verify`, with
`/flow-debug` as the repair loop back into a fresh `/flow-verify`.
This skill is the third stage and judges the second one's work independently.

Skill version: `0.9.0`.

Recommended model: a different model family than `flow-migrate` used for this
flow, for example GPT-6 Astra or GPT-5.5, so the verifier does not inherit the
migrator's blind spot.

Independently verify one bounded migration. Do not repair product code, alter
skill source or decide that a failed criterion is acceptable.

## Required inputs

Confirm before verification:

- path to the approved `flow-contract.json`;
- path to the corresponding `migration-result.json`;
- migration-skill-lab root containing the validator and schemas;
- product root and expected worktree/revision;
- declared test, typecheck and build commands;
- the run-artifact directory;
- the contract's required manual validation scenario and its environment. There
  is no separate owner to look for: the person in this chat is the tester, and
  this skill leads them through it.
- baseline and migration work-item handoff paths and the real manual
  application outcome of the latest proposal;
- checkpoint and push policy from the approved Flow Contract.
- optional repaired `debug-result.json` for every verification attempt after
  the first.

Run `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
"<flow-contract.json>" "<migration-result.json>"
"<work-item-baseline.json>" "<work-item-migration.json>"` first. Stop and record
`BLOCKED` if artifacts are missing, incompatible, unapproved, inconsistent or
outside the declared flow.

## Workflow

1. Read `references/verification-contract.md`.
2. Capture Git-visible product status without changing it.
3. Map every Flow Contract scenario to direct evidence from tests, the
   migration result or declared manual validation.
   Compare the rendered product drawer with the baseline rendered-surface
   inventory. An omitted control or conditional branch is `FAIL`, even when
   migrated fields themselves pass. Also compare a migrated field's width,
   alignment and spacing against its retained sibling sections in the same
   drawer whenever the flow contract's scope implies a shared drawer layout;
   a field-presence check alone is not sufficient for `PASS`. Status every
   surface the contract declares in `visualParity` on its own; appearance is a
   criterion here, never a footnote to a functional scenario.
4. Run the declared targeted test, typecheck and build commands. Do not expand
   to unrelated validation without a reason recorded in the result.
5. Check that changed paths stay within the approved allowlist and that the
   migration result accurately reports failed or blocked validation.
6. Check coverage only for the selected flow and only where measurement is
   approved. Treat a percentage as supporting evidence, never as scenario
   parity by itself.
7. Lead the manual validation. Do not ask whether someone has already done it:
   the person in this chat is the tester, the environment is on the project
   constants page, and conducting the walkthrough is this skill's work.
   Build it from the contract's `scenarios` and `visualParity`, and add the
   entries in `migration-result.limitations` as places a difference is already
   expected. Present one item at a time.
   A step names the control, not the outcome: the button, the field by its
   visible label, the menu path, the keystroke. "Click the field labelled
   Length" and not "check the length input". You have read the source, so use
   the real label, the real `dataTestId` and the real tab order, and never name
   a control you have not found there.
   State the expected result verbatim in the question itself. A modal covers
   the chat the moment it opens, so anything left outside the question is
   unreadable exactly when it is needed.
   After a run of ordinary steps ask for `ok`. After a step later steps depend
   on, ask for the concrete value the tester now sees, never for a repeat of a
   number your own step supplied.
   Name every item by its contract `visualParityId` and `surface` text. Invented
   shorthand such as "V1" means the tester is answering about something the
   artifacts do not contain.
   Never ask for an observation a person cannot make: no "watch for a change"
   without the tester knowing the starting value, and no picking one row out of
   hundreds.
   Collect one verdict per item and record it before moving on: pass, fail,
   tweak (works, but I want it different), or cannot test this. A verdict never
   comes from inference. A bare "yes it works" without an observation earns one
   clarifying question, not a pass.
   An item that already carries a verdict is never asked again, so a
   walkthrough interrupted halfway resumes where it stopped.
   Record a comparable visual artifact or explicit observed layout values for
   the actual drawer; a fixture for the isolated custom element is supporting
   evidence only. For any scenario with a directly comparable retained React
   counterpart, explicitly record whether the rendered evidence came from the
   real host layout (a real selected element reached through the product's
   real navigation flow) or an isolated fixture, and require the former as
   primary evidence whenever the flow contract's scope includes a partial
   Angular mount nested inside a retained React parent.
   Write that choice into `browserValidation.evidenceSource`. When the
   contract sets `scope.partialMount.nested`, the validator refuses an overall
   `PASS` on anything but `real-host-layout`, so record what you actually did
   rather than what the contract asks for.
   Record one `visualCriteria` entry per declared `visualParity` id with its
   own status, evidence source, evidence and diagnosis. Compare the observed
   appearance and layout against that surface's declared requirements, not
   against your own reading of the React source.
8. Record `PASS`, `FAIL` or `BLOCKED` for every scenario and every visual
   parity surface, then the overall result. A passing overall result requires
   every scenario and every visual parity criterion to pass. A deviation the
   user would see is a `FAIL` on its own criterion; "a styling limitation, not
   a functional regression" is a description, not a reason to pass.
9. For non-PASS results, write `debug-handoff.json` after
   `verification-result.json`. Mark it `repairable` only for a local,
   reproducible failure with allowlisted candidate paths; otherwise mark it
   `external-blocked`. Include expected/actual behavior, evidence,
   reproduction, suspected boundary and a tier recommendation. Do not repair.
10. For a `repairable` result, ask one focused user question offering a fresh
    `/flow-debug` chat with only the declared artifact paths and product root.
    Never spawn a debug subagent. A `repaired` debug result must return to a
    new independent verification chat; never reuse debug context as proof.
11. Reconcile every committed checkpoint with the current branch. When and
   only when all scenarios and required manual validation pass and policy is
   `confirm-after-pass`, show remote name, exact branch and commit list, then
   ask one explicit push confirmation. Push only that branch; set upstream
   only after showing that this is the first push. Record decline or failure
   honestly.
12. Write `verification-result.json`, including the push outcome, in the run
   directory. Write no prose report: the JSON is canonical, and a second copy
   in Markdown drifts the moment either side is edited. Show a short summary in
   this chat instead, one line per scenario and per visual criterion, with the
   overall status.
   `push` always requires `remote`, `branch`, `commitShas` and `upstreamSet`,
   including for a flow with nothing to push; record `not-requested` with the
   reason. `browserValidation.status` has no `not-applicable`, only `not-run`.
13. Write `work-item-verification.json`, pointing to the exact verification
    result and migration handoff hashes, taken from
    `node "<migration-skill-lab-root>\scripts\hash-artifact.mjs" <file>...`
    rather than computed by hand. Propose User Story `Done` only for
    overall `PASS` with passed required host validation. Render the final
    copy/paste Markdown, then run `render-work-item-handoff.mjs --inline
    <snapshot> --since <work-item-migration.json>` and show its output verbatim
    in this chat as the handoff for this step. Do not paraphrase or reformat
    it.
    Record the user's applied/not-applied confirmation for the migration
    handoff in `previousApplication`, including the external IDs Targetprocess
    assigned to any created item in `createdExternalIds`; never update
    Targetprocess directly or rewrite an earlier snapshot.
    Ask this as a confirmation, not as an open question. The migration handoff
    already recorded an outcome minutes earlier, so quote it and ask whether it
    still holds. A user who has answered the same question in every phase of
    one afternoon is being asked to restate what the artifacts already say.
    Copy each unchanged `fields` value from the migration handoff byte for byte
    and mark that item `no-change`. Rewording settled text forces `update`,
    re-emits the whole item and asks a reader to re-review something this phase
    did not touch; the validator rejects both a no-op `update` and a
    `no-change` that hides a real change. A verified result normally moves the
    Story, its verification Task and, on a complete PASS, the Feature.
    `richReleaseNotes` describes what changed about its own item, not what this
    run did in general, so do not refresh it on an item this phase left alone.
14. Update the verification Task with criterion, browser, host and push
    evidence.
    Recalculate User Story progress from all Task contributions. A Story may
    be `Done` only when every Task is `Done`; keep the broader Feature and Epic
    open when their other Stories remain.
15. Add a concise daily standup block with the verified result, next
    stakeholder action, blockers and separate current/proposed Story progress.
16. Validate the complete functional, debug and work-item artifact chains with
    `validate-handoff.mjs`.
17. Compare product status after validation with the initial status and report
   any delta. Return repairable diagnoses to `flow-migrate`; do not fix them.
18. For an overall `PASS`, ask one focused user question about the
   continuation. The next phase is a fresh `/flow-baseline` for a separately
   selected next flow, so offer it only once the user has named that flow;
   without one, report the PASS and stop.
   Offer exactly three routes and perform only the chosen one:
   1. open a fresh chat for `/flow-baseline` now, carrying only the artifact paths
      and the product root. Use whatever mechanism this host has for opening a
      chat; never start a second terminal window for it;
   2. show the invocation here for the user to paste into a chat they open
      themselves;
   3. stop here and save the invocation in the run directory as
      `<flowId>-<next-skill>-prompt.md`.
   Route 3 is a checkpoint, not an abandonment, and say so when you offer it:
   every phase reads its inputs from the artifacts and never from this chat, so
   the saved invocation still runs correctly days later.
   Never continue the next phase in this chat, and never delegate it to a
   background agent, which cannot ask the user the questions it needs
   answered.
   Return a `FAIL` or `BLOCKED` to `flow-debug` instead, through the same three
   routes.

## Safety boundary

Never:

- edit, generate, format, stage, commit, stash, reset or check out product
  files;
- edit a skill, reference, schema or installed snapshot during a run;
- install dependencies, change configuration or start a persistent service;
- replace a required manual/Maui validation with an unrecorded assumption;
- mark a criterion `PASS` when its evidence is absent, contradicted or failed;
- publish, merge or create a pull request;
- push without `confirm-after-pass`, complete `PASS`, passed required host
  validation, a clean worktree, matching checkpoint SHAs and one explicit
  confirmation;
- force-push, push tags or push any branch other than the approved feature
  branch;
- update Targetprocess or mark a work-item proposal applied without explicit
  user confirmation;
- mark a Story Done while any of its Tasks remains incomplete or derive
  progress from commit count;
- edit product code, choose a debug tier or treat a repair candidate as PASS;
- store source copies, credentials, tokens, private URLs or unnecessary
  personal data in reports or artifacts.

## Diagnosis handoff

For `FAIL` or repairable `BLOCKED`, include the failed scenario, command or
manual observation, expected behavior, actual evidence, suspected boundary and
the smallest recommended next action. `flow-migrate` owns repairs. A contract
change requires `flow-baseline` and renewed human approval.

The verifier owns the manual evidence and conducts the walkthrough that
produces it. It may open a fresh `/flow-debug` chat only after the user
confirms a repairable handoff.

## Push and backlog handoff

Push is a release gate, not verification evidence. A failed or declined push
does not rewrite scenario results, but must remain visible in
`verification-result.json`. The verification work-item handoff derives its
state from verified evidence: never propose `Done` for `FAIL`, `BLOCKED` or
missing required manual validation. Keep Epic and Feature progress independent
from one completed child Story and include the generated standup update.

## Reading discipline

Context is a budget this run spends once, and every re-read of the same bytes
is paid again for nothing.

- Read a file once, at the range you need. Return to it only for a range you
  have not read; never re-read it whole after reading part of it, and never
  request a range overlapping one you already hold.
- Widen or narrow a search rather than repeating it. Two patterns that differ
  only in alternation, wording or case return mostly the same hits, so the
  second one buys nothing.
- Do not read `schemas\` or `scripts\` source to learn an artifact's shape.
  Copy the shape from `examples\handoff\detail-drawer-line-edit\`, write the artifact, run
  `validate-handoff.mjs` and act on its errors; the validator names what is
  missing far more cheaply than a schema read does. When an error names a rule
  but not the fix, and one more attempt does not resolve it, reading the rule in
  `scripts\validate-handoff.mjs` is the cheaper route: record it as an
  observation so the message gets improved instead of the next run guessing too.
- Resolve a module path before reading it. A directory may be a barrel or a
  single file, so check which exists instead of guessing and failing.

## Post-run observation capture

During the run, silently retain concrete evidence of user corrections,
instruction deviations, skill-caused tool failures, ambiguous instructions,
missing failure handling, unused context, unsuitable delegation, deterministic
steps that should be scripted, or output mismatches. Do not interrupt or
reprioritize the verification workflow to analyze these signals.

After the verification report and `verification-result.json` are complete, or
after the final `BLOCKED` or failed response when those artifacts cannot be
produced:

1. Evaluate this run's own tool history against these checks and record every
   one that fired. They are countable, so answer them from the history rather
   than from impression:
   - the same file read more than twice, or re-read over a range already
     held: `unnecessary-context-load`;
   - two or more searches whose patterns differ only in alternation, wording
     or case: `unnecessary-context-load`;
   - a schema, validator or renderer source read instead of running the
     command: `unnecessary-context-load`;
   - a tool call that failed because this skill named a path, command or flag
     that does not exist or does not behave as written:
     `skill-caused-tool-failure`;
   - a step performed by hand that a script in `scripts\` already performs:
     `deterministic-step-candidate`;
   - a user correction, a restated instruction, or the same question asked
     twice: `user-correction` or `ambiguous-instruction`;
   - an artifact that needed a repair pass before it validated:
     `output-mismatch`.
2. Exclude product defects, expected precondition blockers, missing Angular
   conventions themselves, preferences and static speculation. Executor noise
   means a host or transport failure unrelated to this skill; a tool call this
   skill's own wording caused is never executor noise.
3. Deduplicate semantically equivalent signals from this run and preserve their
   occurrence count. Do not cap the number of material observations.
4. Write `<run-artifact-directory>\skill-run-observations-flow-verify.json`. The
   filename carries the skill because phases of one flow share a run directory,
   and a bare `skill-run-observations.json` means the second skill to finish
   silently overwrites the first one's evidence.
   Copy the shape from `examples\handoff\detail-drawer-line-edit\` rather than writing it from this
   description: an entry needs `id`, `category`, `observation`, `effect`,
   `evidence`, `skillLocations`, `causality` and `occurrenceCount`, and
   `primaryOutcome.status` is `PASS`, `FAIL` or `BLOCKED` for this skill. An empty
   `observations` list is a claim that every check in step 1 was evaluated and
   none fired; write it only when that is true.
5. Validate it with
   `node "<migration-skill-lab-root>\scripts\validate-handoff.mjs"
   "<skill-run-observations-flow-verify.json>"`.
6. Report a capture or validation failure separately without changing the
   primary verification status.

The artifact is evidence for a later `migration-skill-audit`, not a change
proposal or authorization. Never edit skill source during this run.
