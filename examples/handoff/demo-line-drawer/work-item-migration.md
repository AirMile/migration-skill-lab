# Sprint backlog handoff

**Flow:** demo-line-drawer
**Phase:** migration
**Producer:** migrate-flow 0.5.0
**Manual application:** copy-ready
**Previous handoff application:** confirmed-applied

> This is a copy/paste proposal. It is not proof that TopDesk was updated.

## Epic

**Action:** update
**External ID:** 522482
**Title:** Migration from React to Angular using AI (internship)
**Current state:** Open
**Current board progress:** 0%
**Proposed state:** Open
**Proposed progress:** 5%

### Who is the user and what situation or problem are they experiencing?

The first bounded Angular slice is implemented locally with validated checkpoint evidence.

### What outcome or experience should the user have when this is done?

Complete independent verification before using the POC as evidence for the wider migration.

### Why does this matter?

Verified bounded delivery demonstrates whether the migration method is safe and reusable.

### How will we know it is successful?

- The Detail Drawer POC passes independent verification.
- The team reviews the evidence before selecting another slice.

### Rich Release Notes

First bounded implementation completed locally; verification remains.

### Suggested structure comment

```text
EPIC - Migrate frontend from React to Angular
|
+-- Feature - Map Making
    |
    +-- User Story - Detail drawer
    +-- User Story - Right side drawer / toolbox
    +-- User Story - Line drawing
    +-- User Story - Add objects
    +-- User Story - Lidar image overlay
```

## Feature

**Action:** update
**External ID:** 522511
**Parent Epic ID:** 522482
**Title:** Migrate Map Making Page
**Current state:** In Progress
**Current board progress:** 0%
**Proposed state:** In Progress
**Proposed progress:** 35%

### Who is the user and what situation or problem are they experiencing?

The first bounded Angular slice is implemented behind the approved React boundary.

### What outcome or experience should the user have when this is done?

Complete independent verification before treating the Detail Drawer slice as done.

### Why does this matter?

Checkpointed implementation evidence preserves progress without overstating completion.

### How will we know it is successful?

- The Detail Drawer implementation passes its targeted checks.
- Independent verification and host validation still complete the exit gate.

### Rich Release Notes

Detail Drawer implementation checkpoint created; independent verification remains.

## User Story 1

**Action:** update
**External ID:** 522512
**Parent Feature ID:** 522511
**Title:** Migrate Detail Drawer
**Current state:** In development
**Current board progress:** 20%
**Proposed state:** In development
**Proposed progress:** 75%

### User Value (As ... I want ... so that ...)

As a map editor, I want to edit a selected line in an Angular drawer so that the map updates without losing existing behavior.

### Current behavior or functionality (Initial State)

The bounded Angular drawer implementation and targeted tests are present.

### Desired behavior or functionality (Target state)

The same scenarios must pass independent verification and host validation.

### Acceptance criteria

- The drawer shows the selected line identifier, length and angle.
- Valid edits update the SVG and preserve undo and redo.
- Invalid edits show the agreed visible validation outcome.
- Closing and reopening does not retain stale state or duplicate listeners.

### Attention points for reproduction and testing

- The local checkpoint is not proof of independent verification.
- Push only after complete PASS and explicit confirmation.

### Attachment information

Reference the migration result and checkpoint SHA; do not attach source copies.

### Rich Release Notes

Implementation completed locally and stored in a validated scoped checkpoint.

### Tasks

### Task 1: Establish Detail Drawer behavior baseline

**Action:** update
**External ID:** 700001
**Parent User Story ID:** 522512
**Task type:** baseline
**Owner role:** Engineer
**Contribution to story progress:** 20%
**Current state:** Done
**Current board progress:** 100%
**Proposed state:** Done
**Proposed progress:** 100%

Document current behavior, acceptance scenarios, evidence gaps, scope and approval requirements.

#### Done when

- The baseline report and approved Flow Contract validate.
- Acceptance scenarios and decisions are visible.

#### Checkpoint milestones

- None; this is a read-only or coordination task.

#### Evidence

- Approved Flow Contract validated.

#### Blockers

- None.

### Task 2: Implement the bounded Angular Detail Drawer

**Action:** update
**External ID:** 700002
**Parent User Story ID:** 522512
**Task type:** implementation
**Owner role:** Engineer
**Contribution to story progress:** 55%
**Current state:** To Do
**Current board progress:** 0%
**Proposed state:** Done
**Proposed progress:** 100%

Add missing React characterization evidence and implement the approved Angular slice with scoped checkpoints.

#### Done when

- Required React behavior evidence passes.
- The Angular slice and matching tests pass.
- Every product checkpoint is allowlisted and verified.

#### Checkpoint milestones

- react-characterization
- angular-drawer

#### Evidence

- Scoped checkpoint abcdef1234567890abcdef1234567890abcdef12.
- Declared implementation validation passed.

#### Blockers

- None.

### Task 3: Verify the Detail Drawer migration

**Action:** update
**External ID:** 700003
**Parent User Story ID:** 522512
**Task type:** verification
**Owner role:** Engineer and host tester
**Contribution to story progress:** 25%
**Current state:** To Do
**Current board progress:** 0%
**Proposed state:** To Do
**Proposed progress:** 0%

Independently verify all contract scenarios and the required host scenario before proposing Done.

#### Done when

- Every contract scenario passes independently.
- The required host validation passes.
- The verified branch push outcome is recorded.

#### Checkpoint milestones

- None; this is a read-only or coordination task.

#### Evidence

- Verification has not started.

#### Blockers

- None.

## Daily standup

**Date:** 2026-09-07
**User Story:** #522512
**Current board progress:** 20%
**Proposed progress after applying this handoff:** 75%

### Completed since previous update

- Completed the bounded Angular implementation and stored it in a verified scoped checkpoint.

### Next

- Run independent scenario and host verification.

### Blockers

- None.

### Short spoken update

Detail Drawer is at 75%: baseline and implementation are complete. Next is independent and host verification.

## Evidence

- Targeted drawer test passed.
- Scoped checkpoint abcdef1234567890abcdef1234567890abcdef12.

## Open questions

- None.

## Manual application checklist

- Copy only the fields and state/progress changes you reviewed.
- Create items only when their action is `create`.
- Keep the Feature linked to the listed parent Epic.
- Keep every User Story linked to the listed parent Feature.
- Keep every Task linked to the listed parent User Story.
- Do not mark a proposal as applied until TopDesk shows the change.
- Record the confirmation in the next immutable handoff snapshot.

**Application summary:** Copy the factual Epic-to-Task implementation progress and standup update into TopDesk and confirm what was applied.
