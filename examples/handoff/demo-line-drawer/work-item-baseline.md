# Sprint backlog handoff

**Flow:** demo-line-drawer
**Phase:** baseline
**Producer:** flow-baseline 0.7.0
**Manual application:** copy-ready


> This is a copy/paste proposal. It is not proof that Targetprocess was updated.

## Epic

**Action:** update
**External ID:** 522482
**Title:** Migration from React to Angular using AI (internship)
**Current state:** Open
**Current board progress:** 0%
**Proposed state:** Open
**Proposed progress:** 0%

### Who is the user and what situation or problem are they experiencing?

The frontend is implemented in React and the migration work needs a reviewable hierarchy and evidence-driven delivery flow.

### What outcome or experience should the user have when this is done?

Migrate bounded frontend features to Angular with reusable AI-assisted analysis, implementation and verification evidence.

### Why does this matter?

The internship must prove a safe migration approach while keeping stakeholders informed about scope, progress and risk.

### How will we know it is successful?

- Each Feature and User Story has a clear bounded outcome.
- Progress is derived from completed stakeholder-visible Tasks.
- Verified migration evidence supports the decision for each next slice.

### Rich Release Notes

Epic hierarchy and first bounded migration workflow prepared.

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
**Proposed progress:** 0%

### Who is the user and what situation or problem are they experiencing?

The map-making experience is implemented in React and direct drawlib integrations.

### What outcome or experience should the user have when this is done?

Migrate bounded map-making slices to Angular while preserving observable behavior.

### Why does this matter?

A bounded migration reduces integration risk and produces reusable migration evidence.

### How will we know it is successful?

- The approved Detail Drawer slice preserves its agreed scenarios.
- React retains application and canvas ownership during the POC.

### Rich Release Notes

Baseline prepared for the first bounded Angular migration slice.

## User Story 1

**Action:** update
**External ID:** 522512
**Parent Feature ID:** 522511
**Title:** Migrate Detail Drawer
**Current state:** In development
**Current board progress:** 0%
**Proposed state:** In development
**Proposed progress:** 20%

### User Value (As ... I want ... so that ...)

As a map editor, I want to edit a selected line in an Angular drawer so that the map updates without losing existing behavior.

### Current behavior or functionality (Initial State)

React owns the drawer and updates the selected drawlib line.

### Desired behavior or functionality (Target state)

Angular owns only the drawer and communicates through typed inputs, commands and events.

### Acceptance criteria

- The drawer shows the selected line identifier, length and angle.
- Valid edits update the SVG and preserve undo and redo.
- Invalid edits show the agreed visible validation outcome.
- Closing and reopening does not retain stale state or duplicate listeners.

### Attention points for reproduction and testing

- Validate one representative scenario in the required host environment.
- Do not expand ownership to routing, Auth0, Maui or the canvas container.

### Attachment information

Attach the approved baseline report and Flow Contract references; do not attach source copies.

### Rich Release Notes

Behavior baseline and acceptance criteria prepared; implementation has not started.

### Tasks

### Task 1: Establish Detail Drawer behavior baseline

**Action:** create
**External ID:** Assign after creation
**Parent User Story ID:** 522512
**Task type:** baseline
**Owner role:** Engineer
**Contribution to story progress:** 20%
**Current state:** Not created
**Current board progress:** 0%
**Proposed state:** Done
**Proposed progress:** 100%

Document current behavior, acceptance scenarios, evidence gaps, scope and approval requirements.

#### Done when

- The baseline report and draft Flow Contract validate.
- Acceptance scenarios and open decisions are visible.

#### Checkpoint milestones

- None; this is a read-only or coordination task.

#### Evidence

- Validated baseline report and draft Flow Contract.

#### Blockers

- None.

### Task 2: Implement the bounded Angular Detail Drawer

**Action:** create
**External ID:** Assign after creation
**Parent User Story ID:** 522512
**Task type:** implementation
**Owner role:** Engineer
**Contribution to story progress:** 55%
**Current state:** Not created
**Current board progress:** 0%
**Proposed state:** To Do
**Proposed progress:** 0%

Add missing React characterization evidence and implement the approved Angular slice with scoped checkpoints.

#### Done when

- Required React behavior evidence passes.
- The Angular slice and matching tests pass.
- Every product checkpoint is allowlisted and verified.

#### Checkpoint milestones

- react-characterization
- angular-drawer

#### Evidence

- Implementation has not started.

#### Blockers

- Flow Contract and Angular conventions require approval.

### Task 3: Verify the Detail Drawer migration

**Action:** create
**External ID:** Assign after creation
**Parent User Story ID:** 522512
**Task type:** verification
**Owner role:** Engineer and host tester
**Contribution to story progress:** 25%
**Current state:** Not created
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

- A host validation owner and environment must be assigned.

## Daily standup

**Date:** 2026-09-07
**User Story:** #522512
**Current board progress:** 0%
**Proposed progress after applying this handoff:** 20%

### Completed since previous update

- Prepared and validated the Detail Drawer behavior baseline and draft Flow Contract.

### Next

- Review the open product and Angular decisions before implementation approval.

### Blockers

- Invalid-input behavior, Angular conventions and host validation ownership are not approved.

### Short spoken update

Detail Drawer is at 20%: the baseline is complete. Next is contract approval; implementation is blocked by the open product, Angular and host decisions.

## Evidence

- Sanitized example Flow Contract scenarios.
- Canonical selected-line Detail Drawer POC boundary.

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

**Application summary:** Copy the proposed Epic, Feature, User Story, Tasks and standup update into Targetprocess and confirm what was applied.
