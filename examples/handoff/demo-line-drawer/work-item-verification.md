# Sprint backlog handoff

**Flow:** demo-line-drawer
**Phase:** verification
**Producer:** verify-flow 0.5.0
**Manual application:** copy-ready
**Previous handoff application:** confirmed-applied

> This is a copy/paste proposal. It is not proof that Targetprocess was updated.

## Epic

**Action:** update
**External ID:** 522482
**Title:** Migration from React to Angular using AI (internship)
**Current state:** Open
**Current board progress:** 5%
**Proposed state:** Open
**Proposed progress:** 10%

### Who is the user and what situation or problem are they experiencing?

The first bounded Detail Drawer POC passed independent and host verification.

### What outcome or experience should the user have when this is done?

Review the verified POC and choose the next bounded migration slice.

### Why does this matter?

The first complete evidence chain establishes whether the migration method can be reused.

### How will we know it is successful?

- Stakeholders review the verified Detail Drawer result.
- The next slice receives a separate bounded Story and approval.

### Rich Release Notes

First bounded Angular POC completed and verified.

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
**Current board progress:** 35%
**Proposed state:** In Progress
**Proposed progress:** 40%

### Who is the user and what situation or problem are they experiencing?

The Detail Drawer slice passed independent verification and was pushed after confirmation.

### What outcome or experience should the user have when this is done?

Use the verified POC evidence to select and approve the next bounded map-making slice.

### Why does this matter?

The Feature remains broader than the completed Detail Drawer User Story.

### How will we know it is successful?

- The verified Detail Drawer evidence is reviewed.
- The next slice receives a separate approved boundary.

### Rich Release Notes

First bounded Detail Drawer POC passed; the broader Map Making Page migration continues.

## User Story 1

**Action:** update
**External ID:** 522512
**Parent Feature ID:** 522511
**Title:** Migrate Detail Drawer
**Current state:** In development
**Current board progress:** 75%
**Proposed state:** Done
**Proposed progress:** 100%

### User Value (As ... I want ... so that ...)

As a map editor, I can edit a selected line in an Angular drawer without losing the agreed behavior.

### Current behavior or functionality (Initial State)

All contract scenarios and the representative host validation passed.

### Desired behavior or functionality (Target state)

The verified Angular drawer remains the bounded owner of the selected-line editing UI.

### Acceptance criteria

- The drawer shows the selected line identifier, length and angle.
- Valid edits update the SVG and preserve undo and redo.
- Invalid edits show the agreed visible validation outcome.
- Closing and reopening does not retain stale state or duplicate listeners.

### Attention points for reproduction and testing

- Monitor follow-up slices for reuse of the typed adapter and cleanup pattern.

### Attachment information

Reference the verification result and pushed commit SHA; do not attach source copies.

### Rich Release Notes

Detail Drawer POC passed automated and host verification and was pushed after confirmation.

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
**Current state:** Done
**Current board progress:** 100%
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
**Proposed state:** Done
**Proposed progress:** 100%

Independently verify all contract scenarios and the required host scenario before proposing Done.

#### Done when

- Every contract scenario passes independently.
- The required host validation passes.
- The verified branch push outcome is recorded.

#### Checkpoint milestones

- None; this is a read-only or coordination task.

#### Evidence

- Overall verification PASS.
- Representative host validation passed.
- Verified branch push recorded.

#### Blockers

- None.

## Daily standup

**Date:** 2026-09-07
**User Story:** #522512
**Current board progress:** 75%
**Proposed progress after applying this handoff:** 100%

### Completed since previous update

- Completed independent and host verification and recorded the confirmed branch push.

### Next

- Review the POC evidence and select the next bounded Map Making Story.

### Blockers

- None.

### Short spoken update

Detail Drawer is at 100% and verified. Next is stakeholder review and selection of the next bounded Map Making Story.

## Evidence

- Overall verification PASS.
- Representative host validation passed.
- Verified checkpoint pushed after explicit confirmation.

## Open questions

- None.

## Manual application checklist

- Copy only the fields and state/progress changes you reviewed.
- Create items only when their action is `create`.
- Keep the Feature linked to the listed parent Epic.
- Keep every User Story linked to the listed parent Feature.
- Keep every Task linked to the listed parent User Story.
- Do not mark a proposal as applied until Targetprocess shows the change.
- Record the confirmation in the next immutable handoff snapshot.

**Application summary:** Copy the verified Epic-to-Task final state and standup update into Targetprocess and confirm what was applied.
