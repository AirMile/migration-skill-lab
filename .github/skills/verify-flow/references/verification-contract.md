# Verification contract

Read this reference for every `verify-flow` run.

## Independence

The verifier is read-only for the product working tree and skill source. Its
purpose is evidence and diagnosis, not implementation. Its only permitted Git
write is the separately confirmed post-PASS featurebranch push. It must use
the same approved Flow Contract that constrained `migrate-flow`.

## Criterion status

| Status | Meaning |
|---|---|
| `PASS` | Direct evidence shows the scenario meets its agreed observable outcome. |
| `FAIL` | Direct evidence contradicts the agreed outcome. |
| `BLOCKED` | Required evidence could not be produced or reviewed. |

Overall `PASS` requires every scenario to be `PASS`. Overall `FAIL` applies
when any scenario fails. Overall `BLOCKED` applies when no scenario fails but
one or more required scenarios are blocked.

## Required evidence

For each scenario, record:

- scenario ID from the Flow Contract;
- executed automated-test or manual-validation evidence;
- test/build/typecheck status where relevant;
- expected and actual outcome when the result is not `PASS`;
- concise diagnosis and recommended next action.

Coverage can support confidence but cannot make a scenario pass by itself.

## Manual host validation

When the contract requires Maui-WebView validation, an unperformed manual
scenario is `BLOCKED`, not a pass. Record the owner, environment, expected
steps and observed outcome without credentials, private URLs or source copies.

## Browser and host layers

Use the regular browser for declared UI scenarios that do not depend on the
native socket or window lifecycle. This supports repeatable Playwright
automation against the Vite UI and localhost backend. Keep at least one
declared Maui-WebView smoke scenario for native `local.maui` navigation,
backend-to-WebView events and host lifecycle. Browser success is supporting
evidence, not a substitute for required host evidence.

Visual parity is a browser criterion: verify approved padding or margins,
spacing and input containment in the actual drawer as well as functional
edits. For any scenario whose rendered evidence has a directly comparable
retained React counterpart, record explicitly whether that evidence came
from the real host layout (the actual drawer reached through the product's
real navigation flow, with a realistic selected element) or from an
isolated/injected fixture. An isolated fixture is supporting evidence only;
the real host layout is required as primary evidence whenever the flow
contract's scope includes a partial Angular mount nested inside a retained
React parent.

Compare the actual drawer against the baseline rendered-surface inventory.
Any missing retained control, action or conditional capability branch is a
scenario failure, not a styling limitation. The comparison also includes
checking that a migrated field's width, alignment and spacing match its
retained sibling sections in the same drawer; a scenario is not `PASS` on a
field-presence check alone when the flow contract's scope implies a shared
drawer layout.

## Result constraints

`verification-result.json` must validate against
`schemas/verification-result.schema.json` and reference the exact content
hashes of the consumed Flow Contract and migration result. It must not report
an overall `PASS` when any criterion is `FAIL` or `BLOCKED`.

## Checkpoint and push reconciliation

Every committed checkpoint in the migration result must exist on the expected
branch and contain only its recorded paths. The push policy must match the
Flow Contract. Push only after overall `PASS`, passed required host validation
and one explicit confirmation that names remote, branch and commit list.
Never force-push, push tags or select another branch.

Record `not-requested`, `declined`, `pushed` or `blocked` honestly. A pushed
result requires confirmation evidence and the exact committed checkpoint
SHAs. Write the verification work-item handoff only after this result exists,
update the verification Task, and propose Story `Done` only when the PASS and
host-validation gates are met and every child Task is Done. Include a daily
standup block with the Task-derived Story progress. Do not infer Feature or
Epic completion from one Story.

## Debug handoff

For overall `FAIL` or repairable `BLOCKED`, write `debug-handoff.json` after
the verification result. It points to the exact consumed artifacts and
contains expected/actual behavior, reproduction, evidence, suspected boundary,
allowlisted candidate paths and a tier recommendation.

Use `repairable` only for a local product failure that a fresh `debug-flow`
agent can reproduce and change within the approved scope. Missing access,
environment, approval, dependency or host ownership is `external-blocked` and
must not start debug. `verify-flow` never chooses the final tier or repairs
code. A repaired debug result always starts a new verification attempt.
