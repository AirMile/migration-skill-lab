import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const schemaByArtifactType = {
  "flow-contract": "flow-contract.schema.json",
  "migration-result": "migration-result.schema.json",
  "verification-result": "verification-result.schema.json",
  "debug-handoff": "debug-handoff.schema.json",
  "debug-result": "debug-result.schema.json",
  "work-item-handoff": "work-item-handoff.schema.json",
  "skill-run-observations": "skill-run-observations.schema.json",
};
const handoffArtifactTypes = new Set([
  "flow-contract",
  "migration-result",
  "verification-result",
  "debug-handoff",
  "debug-result",
]);
const pathCovers = (basePath, candidatePath) => {
  const normalizedBase = basePath.replaceAll("\\", "/").replace(/\/+$/, "");
  const normalizedCandidate = candidatePath.replaceAll("\\", "/");
  return normalizedCandidate === normalizedBase ||
    normalizedCandidate.startsWith(`${normalizedBase}/`);
};

const describeType = value => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
};

const matchesType = (value, expectedType) => {
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  if (expectedType === "integer") return Number.isInteger(value);
  return typeof value === expectedType;
};

const readJson = async filePath => {
  const raw = await readFile(filePath, "utf8");

  try {
    return { raw, value: JSON.parse(raw) };
  } catch (error) {
    throw new Error(`${filePath} is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
};

const validateNode = (value, schema, location, errors) => {
  if ("const" in schema && value !== schema.const) {
    errors.push(`${location} must equal ${JSON.stringify(schema.const)}.`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${location} must be one of: ${schema.enum.join(", ")}.`);
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(
      `${location} must be ${schema.type}, received ${describeType(value)}.`,
    );
    return;
  }

  if (schema.type === "object") {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${location}.${key} is required.`);
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));

      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${location}.${key} is not allowed.`);
      }
    }

    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        validateNode(value[key], childSchema, `${location}.${key}`, errors);
      }
    }
  }

  if (schema.type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${location} must contain at least ${schema.minItems} item(s).`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${location} must contain at most ${schema.maxItems} item(s).`);
    }

    if (schema.uniqueItems) {
      const entries = value.map(entry => JSON.stringify(entry));
      if (new Set(entries).size !== entries.length) {
        errors.push(`${location} must contain unique items.`);
      }
    }

    if (schema.items) {
      value.forEach((entry, index) => {
        validateNode(entry, schema.items, `${location}[${index}]`, errors);
      });
    }
  }

  if (schema.type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${location} must contain at least ${schema.minLength} character(s).`);
    }

    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${location} must match ${schema.pattern}.`);
    }
  }

  if (schema.type === "integer" &&
    schema.minimum !== undefined &&
    value < schema.minimum) {
    errors.push(`${location} must be at least ${schema.minimum}.`);
  }

  if (schema.type === "integer" &&
    schema.maximum !== undefined &&
    value > schema.maximum) {
    errors.push(`${location} must be at most ${schema.maximum}.`);
  }
};

const validateArtifactRules = (value, errors) => {
  if (value.artifactType === "flow-contract") {
    const approval = value.approval;
    const hasApprovalEvidence =
      Object.hasOwn(approval, "approvedByRole") ||
      Object.hasOwn(approval, "approvedAt") ||
      Object.hasOwn(approval, "approvedDecisions");

    if (approval.status === "approved") {
      if (!approval.approvedByRole || !approval.approvedAt ||
        !approval.approvedDecisions?.length) {
        errors.push(
          "$.approval approver, date and approved decisions are required when status is approved.",
        );
      }
    } else if (hasApprovalEvidence) {
      errors.push(
        "$.approval evidence is allowed only when status is approved.",
      );
    }

    const checkpointPolicy = value.checkpointPolicy;
    const hasCheckpointAuthorization =
      Object.hasOwn(checkpointPolicy, "authorizedByRole") ||
      Object.hasOwn(checkpointPolicy, "authorizedAt");
    if (checkpointPolicy.mode === "auto-local") {
      if (!checkpointPolicy.authorizedByRole ||
        !checkpointPolicy.authorizedAt) {
        errors.push(
          "$.checkpointPolicy authorization is required for auto-local mode.",
        );
      }
      if (approval.status !== "approved" || value.status !== "approved") {
        errors.push(
          "$.checkpointPolicy auto-local mode requires an approved Flow Contract.",
        );
      }
    } else if (hasCheckpointAuthorization) {
      errors.push(
        "$.checkpointPolicy authorization is allowed only for auto-local mode.",
      );
    }

    if (value.status === "approved" || approval.status === "approved") {
      if (value.status !== "approved" || approval.status !== "approved") {
        errors.push("$.status and $.approval.status must both be approved.");
      }
      if (value.validationPlan.testCommands.length === 0 ||
        !value.validationPlan.typecheckCommand ||
        !value.validationPlan.buildCommand) {
        errors.push(
          "$.validationPlan requires test, typecheck and build commands before approval.",
        );
      }
      const manualValidation = value.validationPlan.manualValidation;
      const browserValidation = value.validationPlan.browserValidation;
      if (browserValidation.required &&
        (!browserValidation.owner ||
          !browserValidation.command ||
          browserValidation.scenarios.length === 0)) {
        errors.push(
          "$.validationPlan.browserValidation requires command, owner and scenarios before approval.",
        );
      }
      if (manualValidation.required &&
        (!manualValidation.owner ||
          !manualValidation.environment ||
          !manualValidation.scenario)) {
        errors.push(
          "$.validationPlan.manualValidation requires owner, environment and scenario before approval.",
        );
      }
    }

    const partialMount = value.scope.partialMount;
    if (partialMount?.nested === true &&
      (!partialMount.retainedParent ||
        !partialMount.siblingSections?.length)) {
      errors.push(
        "$.scope.partialMount requires retainedParent and siblingSections when nested.",
      );
    }
    if (partialMount && partialMount.nested === false &&
      (Object.hasOwn(partialMount, "retainedParent") ||
        Object.hasOwn(partialMount, "siblingSections"))) {
      errors.push(
        "$.scope.partialMount may not carry retainedParent or siblingSections when it is not nested.",
      );
    }

    if (value.schemaVersion >= 4) {
      if (!partialMount) {
        errors.push(
          "$.scope.partialMount is required from schemaVersion 4; declare nested false explicitly rather than omitting it.",
        );
      }
      if (!value.visualParity?.length) {
        errors.push(
          "$.visualParity is required from schemaVersion 4; every migrated surface needs a declared appearance baseline.",
        );
      }
    }

    if (value.visualParity) {
      const visualIds = value.visualParity.map(entry => entry.id);
      if (new Set(visualIds).size !== visualIds.length) {
        errors.push("$.visualParity must use unique ids.");
      }

      if (partialMount?.nested === true) {
        for (const entry of value.visualParity) {
          if (entry.layout.length === 0) {
            errors.push(
              `$.visualParity ${entry.id} requires layout parity against the retained sibling sections when the mount is nested.`,
            );
          }
        }
      }
    }
    return;
  }

  if (value.artifactType === "migration-result") {
    const committedShas = [];

    for (const [index, checkpoint] of value.checkpoints.entries()) {
      const location = `$.checkpoints[${index}]`;

      if (checkpoint.status === "committed") {
        if (!checkpoint.commitSha) {
          errors.push(`${location}.commitSha is required when status is committed.`);
        } else {
          committedShas.push(checkpoint.commitSha);
        }

        if (!checkpoint.subject) {
          errors.push(`${location}.subject is required when status is committed.`);
        }

        if (checkpoint.paths.length === 0) {
          errors.push(`${location}.paths must not be empty when status is committed.`);
        }
      } else if (checkpoint.commitSha || checkpoint.subject) {
        errors.push(
          `${location} cannot contain commitSha or subject unless status is committed.`,
        );
      }
    }

    if (new Set(committedShas).size !== committedShas.length) {
      errors.push("$.checkpoints must use unique commitSha values.");
    }

    const surfaces = value.renderedSurfaceComparison?.surfaces;
    if (surfaces) {
      const surfaceIds = surfaces.map(surface => surface.visualParityId);
      if (new Set(surfaceIds).size !== surfaceIds.length) {
        errors.push(
          "$.renderedSurfaceComparison.surfaces must use unique visualParityId values.",
        );
      }
    }
    return;
  }

  if (value.artifactType === "verification-result") {
    const push = value.push;
    const hasConfirmation = Object.hasOwn(push, "confirmedByRole") ||
      Object.hasOwn(push, "confirmedAt");

    if (push.status === "pushed") {
      if (!push.confirmedByRole || !push.confirmedAt) {
        errors.push(
          "$.push.confirmedByRole and $.push.confirmedAt are required when pushed.",
        );
      }

      if (push.commitShas.length === 0) {
        errors.push("$.push.commitShas must not be empty when pushed.");
      }
    } else if (hasConfirmation) {
      errors.push("$.push confirmation fields are allowed only when status is pushed.");
    }
    const hasDebugResult = Object.hasOwn(value, "debugResult");
    if (value.verificationAttempt === 1 && hasDebugResult) {
      errors.push("$.debugResult is not allowed on verification attempt 1.");
    }
    if (value.verificationAttempt > 1 && !hasDebugResult) {
      errors.push("$.debugResult is required after verification attempt 1.");
    }

    if (value.visualCriteria) {
      const visualIds = value.visualCriteria.map(
        criterion => criterion.visualParityId,
      );
      if (new Set(visualIds).size !== visualIds.length) {
        errors.push("$.visualCriteria must use unique visualParityId values.");
      }

      for (const criterion of value.visualCriteria) {
        if (criterion.status === "PASS" &&
          criterion.evidenceSource === "not-run") {
          errors.push(
            `$.visualCriteria ${criterion.visualParityId} cannot pass without rendered evidence.`,
          );
        }
      }
    }
    return;
  }

  if (value.artifactType === "debug-handoff") {
    const failureIds = value.failures.map(failure => failure.id);
    if (new Set(failureIds).size !== failureIds.length) {
      errors.push("$.failures must use unique ids.");
    }

    for (const [index, failure] of value.failures.entries()) {
      if (failure.source === "scenario" && !failure.scenarioId) {
        errors.push(
          `$.failures[${index}].scenarioId is required for a scenario failure.`,
        );
      }
      if (failure.source === "visual-parity" && !failure.visualParityId) {
        errors.push(
          `$.failures[${index}].visualParityId is required for a visual-parity failure.`,
        );
      }
    }

    if (value.status === "repairable" &&
      !value.failures.some(failure => failure.candidatePaths.length > 0)) {
      errors.push(
        "$.failures requires at least one candidate path for repairable status.",
      );
    }
    return;
  }

  if (value.artifactType === "debug-result") {
    const tierOrder = new Map([
      ["immediate", 0],
      ["light", 1],
      ["heavy", 2],
    ]);
    const tiers = value.attempts.map(attempt => attempt.tier);
    if (new Set(tiers).size !== tiers.length) {
      errors.push("$.attempts cannot repeat a debug tier.");
    }
    if (tiers[0] !== value.selectedStartTier) {
      errors.push("$.attempts[0].tier must match $.selectedStartTier.");
    }
    for (let index = 1; index < tiers.length; index += 1) {
      if (tierOrder.get(tiers[index]) <= tierOrder.get(tiers[index - 1])) {
        errors.push("$.attempts must escalate monotonically.");
      }
    }
    const repairedIndexes = value.attempts
      .map((attempt, index) => attempt.status === "repaired" ? index : -1)
      .filter(index => index >= 0);
    if (repairedIndexes.some(index => index !== value.attempts.length - 1)) {
      errors.push("$.attempts cannot continue after a repaired attempt.");
    }
    const finalAttempt = value.attempts[value.attempts.length - 1];
    if (value.status === "repaired") {
      if (finalAttempt.status !== "repaired" ||
        value.nextAction !== "reverify") {
        errors.push(
          "A repaired debug-result requires a repaired final attempt and reverify.",
        );
      }
      if (finalAttempt.validation.some(result => result.status !== "passed")) {
        errors.push(
          "A repaired debug-result requires every final validation to pass.",
        );
      }
    } else if (value.nextAction !== "park") {
      errors.push("A non-repaired debug-result must use nextAction park.");
    }
    if (value.status === "parked" &&
      (finalAttempt.tier !== "heavy" || finalAttempt.status !== "failed")) {
      errors.push(
        "A parked debug-result requires one failed final heavy attempt.",
      );
    }
    return;
  }

  if (value.artifactType === "work-item-handoff") {
    const expectedByPhase = {
      baseline: {
        skill: "flow-baseline",
        primaryArtifactType: "flow-contract",
      },
      migration: {
        skill: "migrate-flow",
        primaryArtifactType: "migration-result",
      },
      verification: {
        skill: "verify-flow",
        primaryArtifactType: "verification-result",
      },
    };
    const expected = expectedByPhase[value.handoffPhase];

    if (expected && value.skill !== expected.skill) {
      errors.push(`$.skill must equal ${expected.skill} for ${value.handoffPhase}.`);
    }

    if (expected &&
      value.primaryArtifact.artifactType !== expected.primaryArtifactType) {
      errors.push(
        "$.primaryArtifact.artifactType does not match $.handoffPhase.",
      );
    }

    if (value.handoffPhase === "baseline" &&
      Object.hasOwn(value, "previousHandoff")) {
      errors.push("$.previousHandoff is not allowed for a baseline handoff.");
    }
    if (value.handoffPhase === "baseline" &&
      Object.hasOwn(value, "previousApplication")) {
      errors.push("$.previousApplication is not allowed for a baseline handoff.");
    }

    if (value.handoffPhase !== "baseline" &&
      !Object.hasOwn(value, "previousHandoff")) {
      errors.push("$.previousHandoff is required after the baseline phase.");
    }
    if (value.handoffPhase !== "baseline" &&
      !Object.hasOwn(value, "previousApplication")) {
      errors.push("$.previousApplication is required after the baseline phase.");
    }
    if (value.previousHandoff && value.previousApplication &&
      value.previousApplication.handoffSha256 !==
        value.previousHandoff.sha256) {
      errors.push(
        "$.previousApplication.handoffSha256 must match $.previousHandoff.sha256.",
      );
    }

    const manualApplication = value.manualApplication;
    const hasConfirmation =
      Object.hasOwn(manualApplication, "confirmedByRole") ||
      Object.hasOwn(manualApplication, "confirmedAt");

    if (manualApplication.status === "confirmed-applied") {
      if (!manualApplication.confirmedByRole || !manualApplication.confirmedAt) {
        errors.push(
          "$.manualApplication confirmation fields are required when confirmed-applied.",
        );
      }
    } else if (hasConfirmation) {
      errors.push(
        "$.manualApplication confirmation fields are allowed only when confirmed-applied.",
      );
    }

    const epic = value.epic;
    const epicHasExternalId = Object.hasOwn(epic, "externalId");
    if (epic.action === "create" && epicHasExternalId) {
      errors.push("$.epic.externalId is not allowed for a create proposal.");
    }
    if (epic.action !== "create" && !epicHasExternalId) {
      errors.push("$.epic.externalId is required for update or no-change.");
    }

    const feature = value.feature;
    const featureHasExternalId = Object.hasOwn(feature, "externalId");
    if (feature.action === "create" && featureHasExternalId) {
      errors.push("$.feature.externalId is not allowed for a create proposal.");
    }
    if (feature.action !== "create" && !featureHasExternalId) {
      errors.push("$.feature.externalId is required for update or no-change.");
    }
    if (feature.parentEpicLocalId !== epic.localId) {
      errors.push("$.feature.parentEpicLocalId must match $.epic.localId.");
    }
    if (epicHasExternalId &&
      feature.parentEpicExternalId !== epic.externalId) {
      errors.push(
        "$.feature.parentEpicExternalId must match $.epic.externalId.",
      );
    }
    if (!epicHasExternalId &&
      Object.hasOwn(feature, "parentEpicExternalId")) {
      errors.push(
        "$.feature.parentEpicExternalId is not allowed for a new Epic.",
      );
    }

    const storyLocalIds = [];
    const storyExternalIds = [];
    const taskLocalIds = [];
    const taskExternalIds = [];
    for (const [index, story] of value.stories.entries()) {
      const location = `$.stories[${index}]`;
      const hasExternalId = Object.hasOwn(story, "externalId");
      const hasParentExternalId =
        Object.hasOwn(story, "parentFeatureExternalId");
      storyLocalIds.push(story.localId);
      if (hasExternalId) storyExternalIds.push(story.externalId);

      if (story.action === "create" && hasExternalId) {
        errors.push(`${location}.externalId is not allowed for a create proposal.`);
      }
      if (story.action !== "create" && !hasExternalId) {
        errors.push(
          `${location}.externalId is required for update or no-change.`,
        );
      }
      if (story.parentFeatureLocalId !== feature.localId) {
        errors.push(`${location}.parentFeatureLocalId must match $.feature.localId.`);
      }
      if (featureHasExternalId &&
        story.parentFeatureExternalId !== feature.externalId) {
        errors.push(
          `${location}.parentFeatureExternalId must match $.feature.externalId.`,
        );
      }
      if (!featureHasExternalId && hasParentExternalId) {
        errors.push(
          `${location}.parentFeatureExternalId is not allowed for a new feature.`,
        );
      }

      let contributionTotal = 0;
      let weightedProgress = 0;
      const taskKinds = [];
      for (const [taskIndex, task] of story.tasks.entries()) {
        const taskLocation = `${location}.tasks[${taskIndex}]`;
        const taskHasExternalId = Object.hasOwn(task, "externalId");
        const taskHasParentExternalId =
          Object.hasOwn(task, "parentStoryExternalId");
        taskLocalIds.push(task.localId);
        taskKinds.push(task.kind);
        if (taskHasExternalId) taskExternalIds.push(task.externalId);

        if (task.action === "create" && taskHasExternalId) {
          errors.push(
            `${taskLocation}.externalId is not allowed for a create proposal.`,
          );
        }
        if (task.action !== "create" && !taskHasExternalId) {
          errors.push(
            `${taskLocation}.externalId is required for update or no-change.`,
          );
        }
        if (task.parentStoryLocalId !== story.localId) {
          errors.push(
            `${taskLocation}.parentStoryLocalId must match ${location}.localId.`,
          );
        }
        if (hasExternalId &&
          task.parentStoryExternalId !== story.externalId) {
          errors.push(
            `${taskLocation}.parentStoryExternalId must match ${location}.externalId.`,
          );
        }
        if (!hasExternalId && taskHasParentExternalId) {
          errors.push(
            `${taskLocation}.parentStoryExternalId is not allowed for a new story.`,
          );
        }

        const taskIsDone = task.proposedState.toLowerCase() === "done";
        if (taskIsDone !== (task.proposedProgress === 100)) {
          errors.push(
            `${taskLocation} must use state Done exactly when progress is 100.`,
          );
        }
        if (task.kind !== "implementation" &&
          task.checkpointMilestones.length > 0) {
          errors.push(
            `${taskLocation}.checkpointMilestones are allowed only for the implementation Task.`,
          );
        }
        contributionTotal += task.contributionPercent;
        weightedProgress +=
          task.contributionPercent * task.proposedProgress;
      }

      if (contributionTotal !== 100) {
        errors.push(
          `${location}.tasks contributionPercent values must total 100.`,
        );
      }
      const expectedTaskKinds = ["baseline", "implementation", "verification"];
      if (taskKinds.length !== expectedTaskKinds.length ||
        expectedTaskKinds.some(kind =>
          taskKinds.filter(taskKind => taskKind === kind).length !== 1)) {
        errors.push(
          `${location}.tasks must contain exactly one baseline, implementation and verification Task.`,
        );
      }
      const calculatedProgress = Math.round(weightedProgress / 100);
      if (story.proposedProgress !== calculatedProgress) {
        errors.push(
          `${location}.proposedProgress must equal task-weighted progress ${calculatedProgress}.`,
        );
      }
      if (story.proposedState.toLowerCase() === "done" &&
        story.tasks.some(task => task.proposedState.toLowerCase() !== "done")) {
        errors.push(
          `${location} cannot be Done while one or more Tasks are not Done.`,
        );
      }
    }

    if (new Set(storyLocalIds).size !== storyLocalIds.length) {
      errors.push("$.stories must use unique localId values.");
    }
    if (new Set(storyExternalIds).size !== storyExternalIds.length) {
      errors.push("$.stories must use unique externalId values.");
    }
    if (new Set(taskLocalIds).size !== taskLocalIds.length) {
      errors.push("$.stories tasks must use unique localId values.");
    }
    if (new Set(taskExternalIds).size !== taskExternalIds.length) {
      errors.push("$.stories tasks must use unique externalId values.");
    }

    const standupStory = value.stories.find(
      story => story.localId === value.standup.storyLocalId,
    );
    if (!standupStory) {
      errors.push("$.standup.storyLocalId must identify a handoff story.");
    } else {
      if (standupStory.externalId !== value.standup.storyExternalId) {
        errors.push(
          "$.standup.storyExternalId must match the selected story externalId.",
        );
      }
      if (standupStory.currentProgress !==
        value.standup.currentBoardProgress) {
        errors.push(
          "$.standup.currentBoardProgress must match the selected story currentProgress.",
        );
      }
      if (standupStory.proposedProgress !==
        value.standup.proposedBoardProgress) {
        errors.push(
          "$.standup.proposedBoardProgress must match the selected story proposedProgress.",
        );
      }
    }

    const proposesDone = [epic, feature, ...value.stories].some(
      item => item.proposedState.toLowerCase() === "done",
    );
    if (proposesDone && value.handoffPhase !== "verification") {
      errors.push("Only a verification handoff may propose state Done.");
    }
    return;
  }

  if (value.artifactType !== "skill-run-observations") return;

  const primaryOutcome = value.primaryOutcome;
  const hasArtifactPath = Object.hasOwn(primaryOutcome, "artifactPath");
  const hasSha256 = Object.hasOwn(primaryOutcome, "sha256");

  if (hasArtifactPath !== hasSha256) {
    errors.push(
      "$.primaryOutcome.artifactPath and $.primaryOutcome.sha256 " +
        "must be provided together.",
    );
  }

  const allowedStatusBySkill = {
    "flow-baseline": new Set(["draft", "failed", "blocked"]),
    "migrate-flow": new Set(["completed", "failed", "blocked"]),
    "verify-flow": new Set(["PASS", "FAIL", "BLOCKED"]),
    "debug-flow": new Set(["repaired", "blocked", "parked"]),
  };
  const allowedStatuses = allowedStatusBySkill[value.skill];

  if (allowedStatuses && !allowedStatuses.has(primaryOutcome.status)) {
    errors.push(
      `$.primaryOutcome.status is not valid for ${value.skill}.`,
    );
  }

  const observationIds = value.observations.map(observation => observation.id);
  if (new Set(observationIds).size !== observationIds.length) {
    errors.push("$.observations must use unique ids.");
  }
};

const loadArtifact = async filePath => {
  const absolutePath = path.resolve(filePath);
  const { raw, value } = await readJson(absolutePath);
  const schemaFile = schemaByArtifactType[value.artifactType];

  if (!schemaFile) {
    throw new Error(`${absolutePath} has an unknown artifactType.`);
  }

  const schemaPath = path.join(rootDirectory, "schemas", schemaFile);
  const { value: schema } = await readJson(schemaPath);
  const errors = [];
  validateNode(value, schema, "$", errors);
  validateArtifactRules(value, errors);

  if (errors.length > 0) {
    throw new Error(`${absolutePath} failed schema validation:\n- ${errors.join("\n- ")}`);
  }

  if (value.artifactType === "flow-contract") {
    const reportPath = path.isAbsolute(value.baselineReport.path) ?
      value.baselineReport.path :
      path.resolve(path.dirname(absolutePath), value.baselineReport.path);
    let report;
    try {
      report = await readFile(reportPath);
    } catch (error) {
      throw new Error(
        `${absolutePath} baseline report cannot be read at ${reportPath}: ${error.message}`,
        { cause: error },
      );
    }
    const reportSha256 = createHash("sha256").update(report).digest("hex");
    if (reportSha256 !== value.baselineReport.sha256) {
      throw new Error(`${absolutePath} baseline report hash does not match.`);
    }
  }

  return {
    absolutePath,
    sha256: createHash("sha256").update(raw).digest("hex"),
    value,
  };
};

const collectWorkItemsByLocalId = snapshot => {
  const items = new Map();
  const add = (item, kind) => items.set(item.localId, { item, kind });
  add(snapshot.epic, "Epic");
  add(snapshot.feature, "Feature");
  for (const story of snapshot.stories) {
    add(story, "User Story");
    for (const task of story.tasks) add(task, "Task");
  }
  return items;
};

const workItemContentEquals = (current, previous) =>
  current.proposedState === previous.proposedState &&
  current.proposedProgress === previous.proposedProgress &&
  JSON.stringify(current.fields ?? null) ===
    JSON.stringify(previous.fields ?? null);

const validateArtifactLinks = artifacts => {
  const byType = new Map();

  for (const artifact of artifacts) {
    const type = artifact.value.artifactType;
    if (!handoffArtifactTypes.has(type)) continue;
    if (byType.has(type)) throw new Error(`Only one ${type} artifact is allowed.`);
    byType.set(type, artifact);
  }

  const contract = byType.get("flow-contract");
  const migration = byType.get("migration-result");
  const verification = byType.get("verification-result");
  const debugHandoff = byType.get("debug-handoff");
  const debugResult = byType.get("debug-result");
  const workItemHandoffs = artifacts.filter(
    artifact => artifact.value.artifactType === "work-item-handoff",
  );

  if (migration && !contract) {
    throw new Error("A migration-result requires a flow-contract artifact.");
  }

  if (verification && (!contract || !migration)) {
    throw new Error(
      "A verification-result requires flow-contract and migration-result artifacts.",
    );
  }
  if (verification && verification.value.status !== "PASS" && !debugHandoff) {
    throw new Error(
      "A non-PASS verification-result requires a debug-handoff artifact.",
    );
  }

  if (debugHandoff && (!contract || !migration || !verification)) {
    throw new Error(
      "A debug-handoff requires flow-contract, migration-result and verification-result artifacts.",
    );
  }

  if (debugResult && (!contract || !migration || !verification)) {
    throw new Error(
      "A debug-result requires flow-contract, migration-result and verification-result artifacts.",
    );
  }
  if (debugResult && verification?.value.verificationAttempt === 1 &&
    !debugHandoff) {
    throw new Error(
      "A debug-result source chain requires its debug-handoff artifact.",
    );
  }

  if (migration && contract) {
    if (contract.value.status !== "approved" ||
      contract.value.approval.status !== "approved") {
      throw new Error("migrate-flow requires a human-approved flow contract.");
    }

    if (migration.value.flowId !== contract.value.flowId) {
      throw new Error("migration-result flowId does not match flow-contract flowId.");
    }

    if (migration.value.repository.root !== contract.value.repository.root) {
      throw new Error("migration-result repository root does not match flow-contract.");
    }

    if (migration.value.flowContract.sha256 !== contract.sha256) {
      throw new Error("migration-result flow-contract hash does not match the artifact.");
    }

    const expectedValidationCommands = [
      ...contract.value.validationPlan.testCommands,
      contract.value.validationPlan.typecheckCommand,
      contract.value.validationPlan.buildCommand,
    ].filter(Boolean);
    const migrationCommands = new Set(
      migration.value.validation.map(result => result.command),
    );
    const missingMigrationCommands = expectedValidationCommands.filter(
      command => !migrationCommands.has(command),
    );
    if (missingMigrationCommands.length > 0) {
      throw new Error(
        `migration-result is missing declared validation commands: ${missingMigrationCommands.join(", ")}.`,
      );
    }

    const automatedCommands = new Set(expectedValidationCommands);
    const unownedMigrationCommands = [...migrationCommands].filter(
      command =>
        !automatedCommands.has(command) &&
        !command.includes("verify-checkpoint"),
    );
    if (unownedMigrationCommands.length > 0) {
      throw new Error(
        "migration-result may only record the contract's automated test, typecheck, " +
          "build and checkpoint commands; browser-flow and host evidence belongs to " +
          `verify-flow. Unowned: ${unownedMigrationCommands.join(", ")}.`,
      );
    }

    const allowedWritePaths = contract.value.scope.allowedWritePaths;
    const changedPaths = new Set(migration.value.changedPaths);
    for (const changedPath of changedPaths) {
      if (!allowedWritePaths.some(allowedPath =>
        pathCovers(allowedPath, changedPath))) {
        throw new Error(
          "migration-result changedPath is outside flow-contract allowedWritePaths.",
        );
      }
    }
    for (const checkpoint of migration.value.checkpoints) {
      if (!contract.value.checkpointPolicy.milestones.includes(
        checkpoint.milestone,
      )) {
        throw new Error(
          `checkpoint milestone ${checkpoint.milestone} is not approved by the Flow Contract.`,
        );
      }
      for (const changedPath of checkpoint.paths) {
        if (!changedPaths.has(changedPath)) {
          throw new Error("checkpoint path is not present in migration-result changedPaths.");
        }
        if (!allowedWritePaths.some(allowedPath =>
          pathCovers(allowedPath, changedPath))) {
          throw new Error("checkpoint path is outside flow-contract allowedWritePaths.");
        }
      }
    }

    const committed = migration.value.checkpoints.filter(
      checkpoint => checkpoint.status === "committed",
    );
    if (contract.value.checkpointPolicy.mode === "auto-local" &&
      migration.value.changedPaths.length > 0 &&
      committed.length === 0) {
      throw new Error(
        "auto-local checkpoint policy requires a committed checkpoint for product changes.",
      );
    }
    if (contract.value.checkpointPolicy.mode === "disabled" &&
      committed.length > 0) {
      throw new Error("disabled checkpoint policy cannot contain committed checkpoints.");
    }

    if (migration.value.status === "completed" &&
      migration.value.validation.some(result => result.status !== "passed")) {
      throw new Error(
        "A completed migration-result requires every validation command to pass.",
      );
    }

    if (migration.value.status === "completed" &&
      contract.value.scope.partialMount?.nested === true) {
      const comparison = migration.value.renderedSurfaceComparison;
      if (!comparison) {
        throw new Error(
          "A completed migration-result for a nested partial mount requires renderedSurfaceComparison.",
        );
      }
      if (comparison.evidenceSource !== "real-parent-tree") {
        throw new Error(
          "renderedSurfaceComparison for a nested partial mount requires real-parent-tree evidence.",
        );
      }
    }

    const contractVisualIds = (contract.value.visualParity ?? []).map(
      entry => entry.id,
    );
    if (migration.value.status === "completed" && contractVisualIds.length > 0) {
      const surfaces = migration.value.renderedSurfaceComparison?.surfaces;
      if (!surfaces) {
        throw new Error(
          "A completed migration-result requires renderedSurfaceComparison.surfaces for every declared visual parity surface.",
        );
      }

      const coveredIds = new Set(surfaces.map(surface => surface.visualParityId));
      for (const visualId of contractVisualIds) {
        if (!coveredIds.has(visualId)) {
          throw new Error(
            `renderedSurfaceComparison does not cover the declared visual parity surface ${visualId}.`,
          );
        }
      }
      for (const surface of surfaces) {
        if (!contractVisualIds.includes(surface.visualParityId)) {
          throw new Error(
            `renderedSurfaceComparison names visual parity surface ${surface.visualParityId}, which the flow-contract does not declare.`,
          );
        }
        if (surface.verdict !== "matches") {
          throw new Error(
            `A completed migration-result cannot leave visual parity surface ${surface.visualParityId} on verdict ${surface.verdict}.`,
          );
        }
      }
    }
  }

  if (verification && contract && migration) {
    if (verification.value.flowId !== contract.value.flowId ||
      verification.value.flowId !== migration.value.flowId) {
      throw new Error("verification-result flowId does not match the handoff artifacts.");
    }

    if (verification.value.flowContract.sha256 !== contract.sha256) {
      throw new Error("verification-result flow-contract hash does not match the artifact.");
    }

    if (verification.value.migrationResult.sha256 !== migration.sha256) {
      throw new Error(
        "verification-result migration-result hash does not match the artifact.",
      );
    }

    if (verification.value.verificationAttempt > 1) {
      if (!debugResult) {
        throw new Error(
          "A re-verification result requires its debug-result artifact.",
        );
      }
      if (verification.value.debugResult.sha256 !== debugResult.sha256) {
        throw new Error(
          "verification-result debug-result hash does not match the artifact.",
        );
      }
      if (debugResult.value.status !== "repaired" ||
        debugResult.value.nextAction !== "reverify") {
        throw new Error(
          "Re-verification requires a repaired debug-result with reverify action.",
        );
      }
    }

    const expectedValidationCommands = [
      ...contract.value.validationPlan.testCommands,
      contract.value.validationPlan.typecheckCommand,
      contract.value.validationPlan.buildCommand,
    ].filter(Boolean);
    const verificationCommands = new Set(
      verification.value.validation.map(result => result.command),
    );
    const missingVerificationCommands = expectedValidationCommands.filter(
      command => !verificationCommands.has(command),
    );
    if (missingVerificationCommands.length > 0) {
      throw new Error(
        `verification-result is missing declared validation commands: ${missingVerificationCommands.join(", ")}.`,
      );
    }

    const hasNonPassingCriterion = verification.value.criteria.some(
      criterion => criterion.status !== "PASS",
    );
    if (verification.value.status === "PASS" && hasNonPassingCriterion) {
      throw new Error("A PASS verification-result cannot contain FAIL or BLOCKED criteria.");
    }
    if (verification.value.status === "PASS" &&
      verification.value.validation.some(result => result.status !== "passed")) {
      throw new Error(
        "A PASS verification-result requires every validation command to pass.",
      );
    }
    if (verification.value.status === "PASS" &&
      contract.value.validationPlan.browserValidation.required &&
      verification.value.browserValidation.status !== "passed") {
      throw new Error(
        "A PASS verification-result requires passed browser validation.",
      );
    }
    if (verification.value.status === "PASS" &&
      contract.value.validationPlan.manualValidation.required &&
      verification.value.manualValidation.status !== "passed") {
      throw new Error(
        "A PASS verification-result requires passed manual validation.",
      );
    }
    if (verification.value.status === "PASS" &&
      contract.value.scope.partialMount?.nested === true &&
      verification.value.browserValidation.evidenceSource !==
        "real-host-layout") {
      throw new Error(
        "A PASS verification-result for a nested partial mount requires real-host-layout browser evidence.",
      );
    }

    const contractVisualParity = contract.value.visualParity ?? [];
    if (contractVisualParity.length > 0) {
      const visualCriteria = verification.value.visualCriteria;
      if (!visualCriteria) {
        throw new Error(
          "A verification-result requires visualCriteria for every declared visual parity surface.",
        );
      }

      const criterionById = new Map(
        visualCriteria.map(criterion => [criterion.visualParityId, criterion]),
      );
      for (const entry of contractVisualParity) {
        if (!criterionById.has(entry.id)) {
          throw new Error(
            `visualCriteria does not cover the declared visual parity surface ${entry.id}.`,
          );
        }
      }
      for (const criterion of visualCriteria) {
        if (!contractVisualParity.some(
          entry => entry.id === criterion.visualParityId)) {
          throw new Error(
            `visualCriteria names visual parity surface ${criterion.visualParityId}, which the flow-contract does not declare.`,
          );
        }
      }

      if (verification.value.status === "PASS") {
        for (const criterion of visualCriteria) {
          if (criterion.status !== "PASS") {
            throw new Error(
              `A PASS verification-result cannot contain a ${criterion.status} visual parity criterion (${criterion.visualParityId}).`,
            );
          }
          if (contract.value.scope.partialMount?.nested === true &&
            criterion.evidenceSource !== "real-host-layout") {
            throw new Error(
              `A PASS visual parity criterion for a nested partial mount requires real-host-layout evidence (${criterion.visualParityId}).`,
            );
          }
        }
      }
    }

    if (verification.value.push.policy !==
      contract.value.checkpointPolicy.pushPolicy) {
      throw new Error("verification push policy does not match flow-contract.");
    }
    if (verification.value.push.branch !==
      contract.value.checkpointPolicy.expectedBranch) {
      throw new Error("verification push branch does not match flow-contract.");
    }
    if (verification.value.push.status === "pushed") {
      if (verification.value.status !== "PASS" ||
        verification.value.manualValidation.status !== "passed") {
        throw new Error(
          "A push requires overall PASS and passed manual validation.",
        );
      }
      if (verification.value.push.policy !== "confirm-after-pass") {
        throw new Error("A pushed result requires confirm-after-pass policy.");
      }
    }
    if (verification.value.push.policy === "never" &&
      verification.value.push.status !== "not-requested") {
      throw new Error("Push status must be not-requested when push policy is never.");
    }

    const debugCommitShas = debugResult ?
      debugResult.value.attempts
        .filter(attempt => attempt.checkpoint)
        .map(attempt => attempt.checkpoint.commitSha) :
      [];
    const committedShas = [
      ...migration.value.checkpoints
      .filter(checkpoint => checkpoint.status === "committed")
      .map(checkpoint => checkpoint.commitSha),
      ...debugCommitShas,
    ];
    if (verification.value.push.status === "pushed" &&
      (verification.value.push.commitShas.length !== committedShas.length ||
        verification.value.push.commitShas.some(
          commitSha => !committedShas.includes(commitSha),
        ))) {
      throw new Error(
        "pushed commitShas must match committed migration and debug checkpoints.",
      );
    }
  }

  if (debugHandoff && contract && migration && verification) {
    if (debugHandoff.value.flowId !== contract.value.flowId) {
      throw new Error("debug-handoff flowId does not match flow-contract.");
    }
    if (debugHandoff.value.flowContract.sha256 !== contract.sha256 ||
      debugHandoff.value.migrationResult.sha256 !== migration.sha256 ||
      debugHandoff.value.verificationResult.sha256 !== verification.sha256) {
      throw new Error("debug-handoff artifact hashes do not match.");
    }
    if (verification.value.status === "PASS") {
      throw new Error("A PASS verification-result cannot produce a debug-handoff.");
    }
    if (debugHandoff.value.status === "repairable" &&
      !debugHandoff.value.failures.every(failure =>
        failure.candidatePaths.length === 0 ||
        failure.candidatePaths.every(candidatePath =>
          contract.value.scope.allowedWritePaths.some(allowedPath =>
            pathCovers(allowedPath, candidatePath))))) {
      throw new Error(
        "A repairable debug-handoff requires allowlisted candidate paths.",
      );
    }

    const declaredVisualIds = new Set(
      (contract.value.visualParity ?? []).map(entry => entry.id),
    );
    for (const failure of debugHandoff.value.failures) {
      if (failure.source !== "visual-parity") continue;
      if (!declaredVisualIds.has(failure.visualParityId)) {
        throw new Error(
          `debug-handoff visual-parity failure names ${failure.visualParityId}, which the flow-contract does not declare.`,
        );
      }
    }
  }

  if (debugResult && contract && migration && verification) {
    if (debugHandoff && debugHandoff.value.status !== "repairable") {
      throw new Error("debug-flow cannot run for an external-blocked handoff.");
    }
    if (debugResult.value.flowId !== contract.value.flowId ||
      debugResult.value.repository.root !== contract.value.repository.root) {
      throw new Error("debug-result does not match the approved flow.");
    }
    if (debugResult.value.flowContract.sha256 !== contract.sha256 ||
      debugResult.value.migrationResult.sha256 !== migration.sha256) {
      throw new Error("debug-result artifact hashes do not match.");
    }
    if (debugHandoff &&
      (debugResult.value.verificationResult.sha256 !== verification.sha256 ||
        debugResult.value.debugHandoff.sha256 !== debugHandoff.sha256)) {
      throw new Error("debug-result source artifact hashes do not match.");
    }

    const allowedWritePaths = contract.value.scope.allowedWritePaths;
    for (const attempt of debugResult.value.attempts) {
      for (const changedPath of attempt.changedPaths) {
        if (!allowedWritePaths.some(allowedPath =>
          pathCovers(allowedPath, changedPath))) {
          throw new Error("debug attempt changedPath is outside allowedWritePaths.");
        }
      }
      if (attempt.checkpoint) {
        if (contract.value.checkpointPolicy.mode !== "auto-local") {
          throw new Error(
            "A debug checkpoint requires auto-local checkpoint policy.",
          );
        }
        if (attempt.checkpoint.paths.length !== attempt.changedPaths.length ||
          attempt.checkpoint.paths.some(changedPath =>
            !attempt.changedPaths.includes(changedPath))) {
          throw new Error(
            "debug checkpoint paths must match its attempt changedPaths.",
          );
        }
      }
    }

    const finalAttempt =
      debugResult.value.attempts[debugResult.value.attempts.length - 1];
    if (debugResult.value.status === "repaired" &&
      finalAttempt.changedPaths.length > 0 &&
      contract.value.checkpointPolicy.mode === "auto-local" &&
      !finalAttempt.checkpoint) {
      throw new Error(
        "A repaired auto-local debug attempt requires checkpoint evidence.",
      );
    }
  }

  if (workItemHandoffs.length > 0) {
    const handoffByPhase = new Map();
    const primaryArtifactByType = new Map(
      artifacts
        .filter(artifact => handoffArtifactTypes.has(artifact.value.artifactType))
        .map(artifact => [artifact.value.artifactType, artifact]),
    );

    for (const handoff of workItemHandoffs) {
      const phase = handoff.value.handoffPhase;
      if (handoffByPhase.has(phase)) {
        throw new Error(`Only one ${phase} work-item handoff is allowed.`);
      }
      handoffByPhase.set(phase, handoff);

      const primary = primaryArtifactByType.get(
        handoff.value.primaryArtifact.artifactType,
      );
      if (!primary) {
        throw new Error(
          `${phase} work-item handoff requires its primary artifact.`,
        );
      }
      if (handoff.value.primaryArtifact.sha256 !== primary.sha256) {
        throw new Error(`${phase} work-item primary artifact hash does not match.`);
      }
      if (handoff.value.flowId !== primary.value.flowId) {
        throw new Error(`${phase} work-item flowId does not match its primary artifact.`);
      }
      if (handoff.value.skillVersion !== primary.value.skillVersion) {
        throw new Error(
          `${phase} work-item skillVersion does not match its primary artifact.`,
        );
      }

      if (phase === "baseline") {
        if (handoff.value.epic.externalId !==
          primary.value.workItemContext.epicExternalId) {
          throw new Error(
            "baseline work-item Epic ID does not match flow-contract context.",
          );
        }
        if (handoff.value.feature.externalId !==
          primary.value.workItemContext.featureExternalId) {
          throw new Error(
            "baseline work-item Feature ID does not match flow-contract context.",
          );
        }
        const storyIds = handoff.value.stories.map(story => story.externalId);
        if (storyIds.length !== primary.value.workItemContext.storyExternalIds.length ||
          storyIds.some(storyId =>
            !primary.value.workItemContext.storyExternalIds.includes(storyId))) {
          throw new Error(
            "baseline work-item Story IDs do not match flow-contract context.",
          );
        }
      }
    }

    const phaseOrder = ["baseline", "migration", "verification"];
    for (let index = 1; index < phaseOrder.length; index += 1) {
      const current = handoffByPhase.get(phaseOrder[index]);
      const previous = handoffByPhase.get(phaseOrder[index - 1]);
      if (!current) continue;
      if (!previous) {
        throw new Error(
          `${phaseOrder[index]} work-item handoff requires the previous phase handoff.`,
        );
      }
      if (current.value.previousHandoff.sha256 !== previous.sha256) {
        throw new Error(
          `${phaseOrder[index]} work-item previous handoff hash does not match.`,
        );
      }

      const phase = phaseOrder[index];
      const currentItems = collectWorkItemsByLocalId(current.value);
      const previousItems = collectWorkItemsByLocalId(previous.value);
      const application = current.value.previousApplication;
      const createdExternalIds = application.createdExternalIds ?? [];

      if (createdExternalIds.length > 0 &&
        application.status !== "confirmed-applied") {
        throw new Error(
          `${phase} work-item createdExternalIds requires a confirmed-applied previous application.`,
        );
      }

      for (const created of createdExternalIds) {
        const previousEntry = previousItems.get(created.localId);
        if (!previousEntry) {
          throw new Error(
            `${phase} work-item createdExternalIds names unknown local ID ${created.localId}.`,
          );
        }
        if (previousEntry.item.action !== "create") {
          throw new Error(
            `${phase} work-item createdExternalIds names ${created.localId}, which the previous snapshot did not propose to create.`,
          );
        }
        const currentEntry = currentItems.get(created.localId);
        if (!currentEntry) {
          throw new Error(
            `${phase} work-item snapshot no longer contains created item ${created.localId}.`,
          );
        }
        if (currentEntry.item.action === "create") {
          throw new Error(
            `${phase} work-item ${created.localId} already exists externally and must not be proposed as create again.`,
          );
        }
        if (currentEntry.item.externalId !== created.externalId) {
          throw new Error(
            `${phase} work-item ${created.localId} does not carry the confirmed external ID ${created.externalId}.`,
          );
        }
      }

      for (const [localId, entry] of currentItems) {
        if (entry.item.action !== "update") continue;
        const previousEntry = previousItems.get(localId);
        if (!previousEntry) continue;
        if (previousEntry.item.action === "create") continue;
        if (workItemContentEquals(entry.item, previousEntry.item)) {
          throw new Error(
            `${phase} work-item ${entry.kind} ${localId} is unchanged and must use action no-change.`,
          );
        }
      }
    }

    const verificationHandoff = handoffByPhase.get("verification");
    if (verificationHandoff && verification) {
      const proposesDone = [
        verificationHandoff.value.epic,
        verificationHandoff.value.feature,
        ...verificationHandoff.value.stories,
      ].some(item => item.proposedState.toLowerCase() === "done");
      if (proposesDone &&
        (verification.value.status !== "PASS" ||
          verification.value.manualValidation.status !== "passed")) {
        throw new Error(
          "A Done proposal requires overall PASS and passed manual validation.",
        );
      }
    }

    const migrationHandoff = handoffByPhase.get("migration");
    if (migrationHandoff && migration) {
      const taskMilestones = new Set(
        migrationHandoff.value.stories.flatMap(story =>
          story.tasks
            .filter(task => task.kind === "implementation")
            .flatMap(task => task.checkpointMilestones)),
      );
      for (const checkpoint of migration.value.checkpoints) {
        if (!taskMilestones.has(checkpoint.milestone)) {
          throw new Error(
            `migration checkpoint ${checkpoint.milestone} is not assigned to a work-item Task.`,
          );
        }
      }
    }
  }
};

const validateFiles = async (filePaths, validateLinks = true) => {
  const artifacts = await Promise.all(filePaths.map(loadArtifact));
  if (validateLinks) validateArtifactLinks(artifacts);
  return artifacts;
};

const exampleDirectory = path.join(
  rootDirectory,
  "examples",
  "handoff",
  "demo-line-drawer",
);
const exampleFiles = [
  path.join(exampleDirectory, "flow-contract.json"),
  path.join(exampleDirectory, "migration-result.json"),
  path.join(exampleDirectory, "verification-result.json"),
  path.join(exampleDirectory, "work-item-baseline.json"),
  path.join(exampleDirectory, "work-item-migration.json"),
  path.join(exampleDirectory, "work-item-verification.json"),
];
const debugExampleDirectory = path.join(
  rootDirectory,
  "examples",
  "debug",
  "demo-line-drawer",
);
const debugSourceFiles = [
  path.join(exampleDirectory, "flow-contract.json"),
  path.join(exampleDirectory, "migration-result.json"),
  path.join(debugExampleDirectory, "failed-verification-result.json"),
  path.join(debugExampleDirectory, "debug-handoff.json"),
  path.join(debugExampleDirectory, "debug-result.json"),
];
const debugReverifyFiles = [
  path.join(exampleDirectory, "flow-contract.json"),
  path.join(exampleDirectory, "migration-result.json"),
  path.join(debugExampleDirectory, "debug-result.json"),
  path.join(debugExampleDirectory, "reverified-verification-result.json"),
];
const observationExamplePath = path.join(
  rootDirectory,
  "examples",
  "observations",
  "demo-line-drawer",
  "migrate-flow-observations.json",
);

const runSelfTest = async () => {
  const artifacts = await validateFiles(exampleFiles);
  const debugArtifacts = await validateFiles(debugSourceFiles);
  await validateFiles(debugReverifyFiles);
  const observationArtifact = await loadArtifact(observationExamplePath);

  const contractPath = exampleFiles[0];
  const { value: contract } = await readJson(contractPath);
  const invalid = structuredClone(contract);
  delete invalid.flowId;

  const schemaPath = path.join(rootDirectory, "schemas", "flow-contract.schema.json");
  const { value: schema } = await readJson(schemaPath);
  const errors = [];
  validateNode(invalid, schema, "$", errors);
  const validationFailed = errors.some(error => error.includes("$.flowId is required."));

  if (!validationFailed) {
    throw new Error("Handoff validator self-test did not reject a missing flowId.");
  }

  const invalidLinks = structuredClone(artifacts);
  const migration = invalidLinks.find(
    artifact => artifact.value.artifactType === "migration-result",
  );
  migration.value.flowContract.sha256 = "0".repeat(64);

  let linkValidationFailed = false;
  try {
    validateArtifactLinks(invalidLinks);
  } catch (error) {
    linkValidationFailed = error.message.includes(
      "migration-result flow-contract hash does not match",
    );
  }

  if (!linkValidationFailed) {
    throw new Error("Handoff validator self-test did not reject a mismatched hash.");
  }

  const invalidWorkItemLinks = structuredClone(artifacts);
  const migrationWorkItem = invalidWorkItemLinks.find(
    artifact =>
      artifact.value.artifactType === "work-item-handoff" &&
      artifact.value.handoffPhase === "migration",
  );
  migrationWorkItem.value.previousHandoff.sha256 = "0".repeat(64);

  let workItemLinkValidationFailed = false;
  try {
    validateArtifactLinks(invalidWorkItemLinks);
  } catch (error) {
    workItemLinkValidationFailed = error.message.includes(
      "migration work-item previous handoff hash does not match",
    );
  }

  if (!workItemLinkValidationFailed) {
    throw new Error(
      "Handoff validator self-test did not reject a mismatched work-item hash.",
    );
  }

  const verificationWorkItemOnly = artifacts.filter(
    artifact =>
      artifact.value.artifactType === "work-item-handoff" &&
      artifact.value.handoffPhase === "verification",
  );
  let missingCompanionFailed = false;
  try {
    validateArtifactLinks(verificationWorkItemOnly);
  } catch (error) {
    missingCompanionFailed = error.message.includes(
      "verification work-item handoff requires its primary artifact",
    );
  }

  if (!missingCompanionFailed) {
    throw new Error(
      "Handoff validator self-test did not reject a missing companion artifact.",
    );
  }

  const invalidCompletedMigration = structuredClone(artifacts);
  const completedMigration = invalidCompletedMigration.find(
    artifact => artifact.value.artifactType === "migration-result",
  );
  completedMigration.value.validation[0].status = "failed";
  let completedMigrationFailed = false;
  try {
    validateArtifactLinks(invalidCompletedMigration);
  } catch (error) {
    completedMigrationFailed = error.message.includes(
      "completed migration-result requires every validation command to pass",
    );
  }

  if (!completedMigrationFailed) {
    throw new Error(
      "Handoff validator self-test accepted completed migration with failed validation.",
    );
  }

  const invalidDebugAttempts = structuredClone(debugArtifacts);
  const invalidDebugResult = invalidDebugAttempts.find(
    artifact => artifact.value.artifactType === "debug-result",
  );
  invalidDebugResult.value.attempts.push(
    structuredClone(invalidDebugResult.value.attempts[0]),
  );
  const debugResultSchemaPath = path.join(
    rootDirectory,
    "schemas",
    "debug-result.schema.json",
  );
  const { value: debugResultSchema } = await readJson(debugResultSchemaPath);
  const invalidDebugAttemptErrors = [];
  validateNode(
    invalidDebugResult.value,
    debugResultSchema,
    "$",
    invalidDebugAttemptErrors,
  );
  validateArtifactRules(
    invalidDebugResult.value,
    invalidDebugAttemptErrors,
  );
  if (!invalidDebugAttemptErrors.some(error =>
    error.includes("cannot repeat a debug tier"))) {
    throw new Error(
      "Handoff validator self-test did not reject a repeated debug tier.",
    );
  }

  const externalBlockedDebug = structuredClone(debugArtifacts);
  const externalBlockedHandoff = externalBlockedDebug.find(
    artifact => artifact.value.artifactType === "debug-handoff",
  );
  externalBlockedHandoff.value.status = "external-blocked";
  let externalBlockedFailed = false;
  try {
    validateArtifactLinks(externalBlockedDebug);
  } catch (error) {
    externalBlockedFailed = error.message.includes(
      "debug-flow cannot run for an external-blocked handoff",
    );
  }
  if (!externalBlockedFailed) {
    throw new Error(
      "Handoff validator self-test allowed debug for an external blocker.",
    );
  }

  const workItemSchemaPath = path.join(
    rootDirectory,
    "schemas",
    "work-item-handoff.schema.json",
  );
  const { value: workItemSchema } = await readJson(workItemSchemaPath);
  const invalidCreateProposal = structuredClone(migrationWorkItem.value);
  invalidCreateProposal.stories[0].action = "create";
  const invalidCreateErrors = [];
  validateNode(invalidCreateProposal, workItemSchema, "$", invalidCreateErrors);
  validateArtifactRules(invalidCreateProposal, invalidCreateErrors);

  if (!invalidCreateErrors.some(error =>
    error.includes("externalId is not allowed for a create proposal"))) {
    throw new Error(
      "Handoff validator self-test did not reject a create proposal with external ID.",
    );
  }

  const invalidConfirmation = structuredClone(migrationWorkItem.value);
  invalidConfirmation.manualApplication.status = "confirmed-applied";
  const invalidConfirmationErrors = [];
  validateNode(
    invalidConfirmation,
    workItemSchema,
    "$",
    invalidConfirmationErrors,
  );
  validateArtifactRules(invalidConfirmation, invalidConfirmationErrors);

  if (!invalidConfirmationErrors.some(error =>
    error.includes("confirmation fields are required"))) {
    throw new Error(
      "Handoff validator self-test did not reject unproven manual application.",
    );
  }

  const invalidWeightedProgress = structuredClone(migrationWorkItem.value);
  invalidWeightedProgress.stories[0].proposedProgress -= 1;
  const invalidWeightedProgressErrors = [];
  validateNode(
    invalidWeightedProgress,
    workItemSchema,
    "$",
    invalidWeightedProgressErrors,
  );
  validateArtifactRules(
    invalidWeightedProgress,
    invalidWeightedProgressErrors,
  );

  if (!invalidWeightedProgressErrors.some(error =>
    error.includes("proposedProgress must equal task-weighted progress"))) {
    throw new Error(
      "Handoff validator self-test did not reject guessed Story progress.",
    );
  }

  const invalidCurrentBoardProgress = structuredClone(
    migrationWorkItem.value,
  );
  invalidCurrentBoardProgress.standup.currentBoardProgress += 1;
  const invalidCurrentBoardProgressErrors = [];
  validateNode(
    invalidCurrentBoardProgress,
    workItemSchema,
    "$",
    invalidCurrentBoardProgressErrors,
  );
  validateArtifactRules(
    invalidCurrentBoardProgress,
    invalidCurrentBoardProgressErrors,
  );
  if (!invalidCurrentBoardProgressErrors.some(error =>
    error.includes(
      "currentBoardProgress must match the selected story currentProgress",
    ))) {
    throw new Error(
      "Handoff validator self-test did not reject mismatched current board progress.",
    );
  }

  const incompleteDoneStory = structuredClone(migrationWorkItem.value);
  incompleteDoneStory.stories[0].proposedState = "Done";
  const incompleteDoneStoryErrors = [];
  validateNode(
    incompleteDoneStory,
    workItemSchema,
    "$",
    incompleteDoneStoryErrors,
  );
  validateArtifactRules(incompleteDoneStory, incompleteDoneStoryErrors);

  if (!incompleteDoneStoryErrors.some(error =>
    error.includes("cannot be Done while one or more Tasks are not Done"))) {
    throw new Error(
      "Handoff validator self-test did not reject Done with incomplete Tasks.",
    );
  }

  const invalidCheckpointTask = structuredClone(migrationWorkItem.value);
  const implementationTask = invalidCheckpointTask.stories[0].tasks.find(
    task => task.kind === "implementation",
  );
  const verificationTask = invalidCheckpointTask.stories[0].tasks.find(
    task => task.kind === "verification",
  );
  verificationTask.checkpointMilestones =
    implementationTask.checkpointMilestones;
  implementationTask.checkpointMilestones = [];
  const invalidCheckpointTaskErrors = [];
  validateNode(
    invalidCheckpointTask,
    workItemSchema,
    "$",
    invalidCheckpointTaskErrors,
  );
  validateArtifactRules(invalidCheckpointTask, invalidCheckpointTaskErrors);

  if (!invalidCheckpointTaskErrors.some(error =>
    error.includes(
      "checkpointMilestones are allowed only for the implementation Task",
    ))) {
    throw new Error(
      "Handoff validator self-test did not reject checkpoints on the wrong Task.",
    );
  }

  const invalidDoneLinks = structuredClone(artifacts);
  const invalidDoneVerification = invalidDoneLinks.find(
    artifact => artifact.value.artifactType === "verification-result",
  );
  invalidDoneVerification.value.status = "BLOCKED";
  invalidDoneVerification.value.criteria[0].status = "BLOCKED";
  invalidDoneVerification.value.manualValidation.status = "blocked";
  invalidDoneVerification.value.push.status = "not-requested";
  invalidDoneVerification.value.push.commitShas = [];
  invalidDoneVerification.value.push.upstreamSet = false;
  delete invalidDoneVerification.value.push.confirmedByRole;
  delete invalidDoneVerification.value.push.confirmedAt;
  const invalidDoneDebugHandoff = structuredClone(debugArtifacts.find(
    artifact => artifact.value.artifactType === "debug-handoff",
  ));
  invalidDoneDebugHandoff.value.verificationResult.sha256 =
    invalidDoneVerification.sha256;
  invalidDoneLinks.push(invalidDoneDebugHandoff);
  const invalidDoneWorkItem = invalidDoneLinks.find(
    artifact =>
      artifact.value.artifactType === "work-item-handoff" &&
      artifact.value.handoffPhase === "verification",
  );
  invalidDoneWorkItem.value.epic.proposedState = "Done";
  invalidDoneWorkItem.value.feature.proposedState = "In Progress";
  invalidDoneWorkItem.value.stories[0].proposedState = "In development";

  let doneValidationFailed = false;
  try {
    validateArtifactLinks(invalidDoneLinks);
  } catch (error) {
    doneValidationFailed = error.message.includes(
      "A Done proposal requires overall PASS and passed manual validation",
    );
  }

  if (!doneValidationFailed) {
    throw new Error(
      "Handoff validator self-test did not reject Done without host validation.",
    );
  }

  const observationSchemaPath = path.join(
    rootDirectory,
    "schemas",
    "skill-run-observations.schema.json",
  );
  const { value: observationSchema } = await readJson(observationSchemaPath);
  const emptyObservationArtifact = structuredClone(observationArtifact.value);
  emptyObservationArtifact.observations = [];
  const emptyObservationErrors = [];
  validateNode(
    emptyObservationArtifact,
    observationSchema,
    "$",
    emptyObservationErrors,
  );
  validateArtifactRules(emptyObservationArtifact, emptyObservationErrors);

  if (emptyObservationErrors.length > 0) {
    throw new Error(
      "Handoff validator self-test rejected a valid empty observation list.",
    );
  }

  const invalidObservationArtifact = structuredClone(observationArtifact.value);
  invalidObservationArtifact.observations[0].occurrenceCount = 0;
  const invalidObservationErrors = [];
  validateNode(
    invalidObservationArtifact,
    observationSchema,
    "$",
    invalidObservationErrors,
  );
  validateArtifactRules(invalidObservationArtifact, invalidObservationErrors);

  if (!invalidObservationErrors.some(error =>
    error.includes("$.observations[0].occurrenceCount must be at least 1."))) {
    throw new Error(
      "Handoff validator self-test did not reject an invalid occurrence count.",
    );
  }

  const wrongSkillObservationArtifact = structuredClone(observationArtifact.value);
  wrongSkillObservationArtifact.skill = "migration-analyze";
  const wrongSkillErrors = [];
  validateNode(
    wrongSkillObservationArtifact,
    observationSchema,
    "$",
    wrongSkillErrors,
  );
  validateArtifactRules(wrongSkillObservationArtifact, wrongSkillErrors);

  if (!wrongSkillErrors.some(error =>
    error.includes("$.skill must be one of"))) {
    throw new Error(
      "Handoff validator self-test did not reject an unsupported target skill.",
    );
  }

  const incompletePointerArtifact = structuredClone(observationArtifact.value);
  delete incompletePointerArtifact.primaryOutcome.sha256;
  const incompletePointerErrors = [];
  validateNode(
    incompletePointerArtifact,
    observationSchema,
    "$",
    incompletePointerErrors,
  );
  validateArtifactRules(incompletePointerArtifact, incompletePointerErrors);

  if (!incompletePointerErrors.some(error =>
    error.includes("artifactPath and $.primaryOutcome.sha256"))) {
    throw new Error(
      "Handoff validator self-test did not reject an incomplete artifact pointer.",
    );
  }

  const expectLinkRejection = (mutate, expected, description) => {
    const mutated = structuredClone(artifacts);
    mutate({
      contract: mutated.find(
        artifact => artifact.value.artifactType === "flow-contract",
      ).value,
      migration: mutated.find(
        artifact => artifact.value.artifactType === "migration-result",
      ).value,
      verification: mutated.find(
        artifact => artifact.value.artifactType === "verification-result",
      ).value,
      handoffs: Object.fromEntries(
        mutated
          .filter(artifact => artifact.value.artifactType === "work-item-handoff")
          .map(artifact => [artifact.value.handoffPhase, artifact.value]),
      ),
    });

    let rejected = false;
    try {
      validateArtifactLinks(mutated);
    } catch (error) {
      rejected = error.message.includes(expected);
    }
    if (!rejected) {
      throw new Error(`Handoff validator self-test did not reject ${description}.`);
    }
  };

  expectLinkRejection(
    ({ migration }) => {
      migration.renderedSurfaceComparison.evidenceSource = "isolated-fixture";
    },
    "requires real-parent-tree evidence",
    "an isolated-fixture rendered-surface comparison for a nested partial mount",
  );

  expectLinkRejection(
    ({ migration }) => {
      delete migration.renderedSurfaceComparison;
    },
    "requires renderedSurfaceComparison",
    "a completed nested partial mount without a rendered-surface comparison",
  );

  expectLinkRejection(
    ({ migration }) => {
      migration.validation.push({
        command: "Manual Maui-WebView smoke",
        status: "passed",
        summary: "The host smoke was confirmed during the migration run.",
      });
    },
    "browser-flow and host evidence belongs to verify-flow",
    "a migration-result recording host evidence as its own validation",
  );

  expectLinkRejection(
    ({ verification }) => {
      verification.browserValidation.evidenceSource = "isolated-fixture";
    },
    "requires real-host-layout browser evidence",
    "a PASS on isolated-fixture browser evidence for a nested partial mount",
  );

  expectLinkRejection(
    ({ handoffs }) => {
      const task = handoffs.verification.stories[0].tasks.find(
        candidate => candidate.localId === "detail-drawer-baseline",
      );
      task.action = "update";
    },
    "must use action no-change",
    "an unchanged work item still proposed as an update",
  );

  expectLinkRejection(
    ({ handoffs }) => {
      handoffs.migration.previousApplication.status = "not-applied";
    },
    "requires a confirmed-applied previous application",
    "created external IDs without a confirmed application",
  );

  expectLinkRejection(
    ({ handoffs }) => {
      handoffs.migration.previousApplication.createdExternalIds[0].externalId =
        "999999";
    },
    "does not carry the confirmed external ID",
    "a created external ID the snapshot does not carry",
  );

  expectLinkRejection(
    ({ migration }) => {
      migration.renderedSurfaceComparison.surfaces =
        migration.renderedSurfaceComparison.surfaces.filter(
          surface => surface.visualParityId !== "angle-field",
        );
    },
    "does not cover the declared visual parity surface angle-field",
    "a completed migration that skipped a declared visual parity surface",
  );

  expectLinkRejection(
    ({ migration }) => {
      migration.renderedSurfaceComparison.surfaces[0].verdict = "deviates";
    },
    "cannot leave visual parity surface length-field on verdict deviates",
    "a completed migration with an unresolved visual parity deviation",
  );

  expectLinkRejection(
    ({ migration }) => {
      delete migration.renderedSurfaceComparison.surfaces;
    },
    "requires renderedSurfaceComparison.surfaces",
    "a completed migration without any per-surface visual parity verdict",
  );

  expectLinkRejection(
    ({ verification }) => {
      verification.visualCriteria[0].status = "FAIL";
    },
    "cannot contain a FAIL visual parity criterion",
    "an overall PASS that hides a failed visual parity criterion",
  );

  expectLinkRejection(
    ({ verification }) => {
      verification.visualCriteria[0].evidenceSource = "isolated-fixture";
    },
    "requires real-host-layout evidence",
    "a visual parity PASS on isolated-fixture evidence for a nested partial mount",
  );

  expectLinkRejection(
    ({ verification }) => {
      delete verification.visualCriteria;
    },
    "requires visualCriteria",
    "a verification that never statused the declared visual parity surfaces",
  );

  const visualDebug = structuredClone(debugArtifacts);
  visualDebug
    .find(artifact => artifact.value.artifactType === "debug-handoff")
    .value.failures.find(failure => failure.source === "visual-parity")
    .visualParityId = "undeclared-field";
  let visualDebugRejected = false;
  try {
    validateArtifactLinks(visualDebug);
  } catch (error) {
    visualDebugRejected = error.message.includes(
      "which the flow-contract does not declare",
    );
  }
  if (!visualDebugRejected) {
    throw new Error(
      "Handoff validator self-test did not reject a visual-parity failure for an undeclared surface.",
    );
  }

  const versionedContract = structuredClone(
    artifacts.find(artifact => artifact.value.artifactType === "flow-contract")
      .value,
  );
  delete versionedContract.scope.partialMount;
  delete versionedContract.visualParity;
  const versionedErrors = [];
  validateArtifactRules(versionedContract, versionedErrors);
  for (const expected of [
    "$.scope.partialMount is required from schemaVersion 4",
    "$.visualParity is required from schemaVersion 4",
  ]) {
    if (!versionedErrors.some(error => error.includes(expected))) {
      throw new Error(
        `Handoff validator self-test did not reject a schemaVersion 4 contract missing ${expected}.`,
      );
    }
  }

  const flatVisualContract = structuredClone(
    artifacts.find(artifact => artifact.value.artifactType === "flow-contract")
      .value,
  );
  flatVisualContract.visualParity[0].layout = [];
  const flatVisualErrors = [];
  validateArtifactRules(flatVisualContract, flatVisualErrors);
  if (!flatVisualErrors.some(error =>
    error.includes("requires layout parity against the retained sibling sections"))) {
    throw new Error(
      "Handoff validator self-test did not reject a nested visual parity surface without layout requirements.",
    );
  }

  const nestedContract = structuredClone(
    artifacts.find(artifact => artifact.value.artifactType === "flow-contract")
      .value,
  );
  delete nestedContract.scope.partialMount.siblingSections;
  const nestedErrors = [];
  validateArtifactRules(nestedContract, nestedErrors);
  if (!nestedErrors.some(error =>
    error.includes("requires retainedParent and siblingSections"))) {
    throw new Error(
      "Handoff validator self-test did not reject an incomplete nested partial mount.",
    );
  }

  console.log(
    "Handoff validator self-test passed " +
      "(handoff chain and observation edge cases).",
  );
};

const argumentsList = process.argv.slice(2);

if (argumentsList.length === 1 && argumentsList[0] === "--self-test") {
  await runSelfTest();
} else {
  const schemaOnly = argumentsList[0] === "--schema-only";
  const artifactPaths = schemaOnly ? argumentsList.slice(1) : argumentsList;
  if (artifactPaths.length === 0) {
    throw new Error(
      "Usage: node .\\scripts\\validate-handoff.mjs [--schema-only] <artifact.json> [...artifact.json]",
    );
  }

  const artifacts = await validateFiles(artifactPaths, !schemaOnly);
  console.log(`Validated ${artifacts.length} artifact(s).`);
}
