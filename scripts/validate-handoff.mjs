import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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
  "skill-run-observations": "skill-run-observations.schema.json",
  "migration-map": "migration-map.schema.json",
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
  if (Array.isArray(expectedType)) {
    return expectedType.some(candidate => matchesType(value, candidate));
  }
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
      `${location} must be ${[schema.type].flat().join(" or ")}, received ${describeType(value)}.`,
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

// The pipeline skills were renamed into one flow-* family. Artifacts already
// written carry the old names and are immutable evidence, so both spellings
// resolve to one identity instead of the history being rewritten.
const skillAliases = {
  "migrate-flow": "flow-migrate",
  "verify-flow": "flow-verify",
  "debug-flow": "flow-debug",
};

const canonicalSkill = skill => skillAliases[skill] ?? skill;

const normalizeProductPath = value =>
  value.replaceAll("\\", "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "");

// The map is read by flow-baseline and by the next flow-plan run, so a
// reference that points nowhere fails here instead of in a later chat.
const validateMigrationMapRules = (value, errors) => {
  const productPaths = [
    ...value.features.flatMap((feature, index) =>
      feature.paths.map(entry => [`$.features[${index}].paths`, entry])),
    ...value.slices.flatMap((slice, index) =>
      slice.paths.map(entry => [`$.slices[${index}].paths`, entry])),
    ...value.prerequisites.flatMap((prerequisite, index) => [
      [`$.prerequisites[${index}].reactSource`, prerequisite.reactSource],
      ...(prerequisite.angular.path ?
        [[`$.prerequisites[${index}].angular.path`, prerequisite.angular.path]] :
        []),
      ...prerequisite.copies.map(copy => [`$.prerequisites[${index}].copies`, copy.path]),
    ]),
  ];
  for (const [location, entry] of productPaths) {
    if (/^([A-Za-z]:|[\\/])/.test(entry)) {
      errors.push(`${location} must be relative to the product root: ${entry}.`);
    }
  }

  const requireUnique = (location, ids) => {
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${location} repeats ${id}.`);
      seen.add(id);
    }
    return seen;
  };
  const featureIds = requireUnique("$.features", value.features.map(feature => feature.id));
  const slicesById = new Map(value.slices.map(slice => [slice.flowId, slice]));
  requireUnique("$.slices", value.slices.map(slice => slice.flowId));
  const prerequisiteIds = requireUnique(
    "$.prerequisites",
    value.prerequisites.map(prerequisite => prerequisite.id),
  );

  value.slices.forEach((slice, index) => {
    const location = `$.slices[${index}]`;
    if (!featureIds.has(slice.featureId)) {
      errors.push(`${location}.featureId ${slice.featureId} is not in $.features.`);
    }
    for (const dependency of slice.dependsOn) {
      if (dependency === slice.flowId) {
        errors.push(`${location}.dependsOn names the slice itself.`);
      } else if (!slicesById.has(dependency)) {
        errors.push(`${location}.dependsOn ${dependency} is not in $.slices.`);
      }
    }
    for (const requirement of slice.requires) {
      if (!prerequisiteIds.has(requirement)) {
        errors.push(`${location}.requires ${requirement} is not in $.prerequisites.`);
      }
    }
    // Only a PASS verification lands a slice; anything else is still open.
    if (slice.status === "landed" && !slice.evidence) {
      errors.push(`${location} is landed without an evidence pointer to its PASS verification-result.`);
    }
    if (slice.status !== "landed" && slice.evidence) {
      errors.push(`${location}.evidence is only for a landed slice.`);
    }
  });

  // A dependency cycle would leave every slice in it waiting on another.
  const visiting = new Set();
  const finished = new Set();
  const visit = flowId => {
    if (finished.has(flowId) || !slicesById.has(flowId)) return;
    if (visiting.has(flowId)) {
      errors.push(`$.slices dependsOn forms a cycle through ${flowId}.`);
      return;
    }
    visiting.add(flowId);
    for (const dependency of slicesById.get(flowId).dependsOn) visit(dependency);
    visiting.delete(flowId);
    finished.add(flowId);
  };
  for (const flowId of slicesById.keys()) visit(flowId);

  value.prerequisites.forEach((prerequisite, index) => {
    const location = `$.prerequisites[${index}]`;
    const { angular } = prerequisite;
    if (angular.status === "built" && (!angular.path || !angular.builtBy)) {
      errors.push(`${location}.angular is built and needs path and builtBy.`);
    }
    if (angular.status === "none" && (angular.path || angular.builtBy)) {
      errors.push(`${location}.angular has no Angular counterpart yet, so it has no path or builtBy.`);
    }
    for (const builder of [angular.builtBy, ...prerequisite.copies.map(copy => copy.builtBy)]) {
      if (builder && !slicesById.has(builder)) {
        errors.push(`${location} names builder ${builder}, which is not in $.slices.`);
      }
    }
  });

  const optionIds = value.recommendation.options.map(option => option.flowId);
  requireUnique("$.recommendation.options", optionIds);
  for (const flowId of optionIds) {
    const slice = slicesById.get(flowId);
    if (!slice) errors.push(`$.recommendation.options names ${flowId}, which is not in $.slices.`);
    else if (slice.status === "landed") {
      errors.push(`$.recommendation.options names ${flowId}, which has already landed.`);
    } else if (slice.status !== "candidate") {
      errors.push(`$.recommendation.options names ${flowId}, which is ${slice.status}; only a candidate can be offered.`);
    }
  }
  // From schemaVersion 2 the user approves an ordered queue that parallel
  // baselines claim from; before it one slice was chosen.
  if (value.schemaVersion >= 2) {
    if (Object.hasOwn(value.recommendation, "chosen")) {
      errors.push("$.recommendation.chosen is not used from schemaVersion 2; record the approved slices, in order, in $.recommendation.queue.");
    }
    if (!Array.isArray(value.recommendation.queue)) {
      errors.push("$.recommendation.queue is required from schemaVersion 2.");
    }
    for (const flowId of value.recommendation.queue ?? []) {
      if (!optionIds.includes(flowId)) {
        errors.push(`$.recommendation.queue names ${flowId}, which is not one of $.recommendation.options.`);
      }
    }
  } else {
    if (Object.hasOwn(value.recommendation, "queue")) {
      errors.push("$.recommendation.queue requires schemaVersion 2.");
    }
    if (value.recommendation.chosen && !optionIds.includes(value.recommendation.chosen)) {
      errors.push("$.recommendation.chosen must be one of $.recommendation.options.");
    }
  }
};

// Pointers in a map are lab-relative, the form hash-artifact.mjs prints from
// the lab root. Each is checked against the file it names.
const readLabPointer = async (ownerPath, label, pointer) => {
  const target = path.isAbsolute(pointer.path) ?
    pointer.path :
    path.resolve(rootDirectory, pointer.path);
  let raw;
  try {
    raw = await readFile(target);
  } catch (error) {
    throw new Error(`${ownerPath} ${label} cannot be read at ${target}: ${error.message}`, {
      cause: error,
    });
  }
  if (createHash("sha256").update(raw).digest("hex") !== pointer.sha256) {
    throw new Error(`${ownerPath} ${label} hash does not match ${target}.`);
  }
  return JSON.parse(raw.toString("utf8").replace(/^﻿/, ""));
};

// A map slice is the ceiling of a baseline chain: its paths, the tests beside
// its files, the Angular folders they move to and the targets of the
// prerequisites it requires.
const validatePlanSlice = async (absolutePath, contract) => {
  const { planSlice } = contract;
  const map = await readLabPointer(absolutePath, "planSlice map", planSlice.map);
  if (map.artifactType !== "migration-map" || map.runId !== planSlice.map.runId) {
    throw new Error(`${absolutePath} planSlice map is not the migration-map of run ${planSlice.map.runId}.`);
  }
  const slice = (map.slices ?? []).find(entry => entry.flowId === planSlice.flowId);
  if (!slice) {
    throw new Error(`${absolutePath} planSlice ${planSlice.flowId} is not a slice of map ${planSlice.map.runId}.`);
  }
  if (!map.metrics) {
    throw new Error(`${absolutePath} planSlice map ${planSlice.map.runId} carries no metrics pointer; measure it with migration-map.mjs.`);
  }
  const metrics = await readLabPointer(absolutePath, "planSlice map metrics", map.metrics);
  const measured = (metrics.slices ?? []).find(entry => entry.flowId === slice.flowId);
  const slicePaths = slice.paths.map(normalizeProductPath);
  const ceiling = [...new Set([
    ...slicePaths,
    ...slicePaths.filter(entry => path.posix.extname(entry)).map(entry => `${path.posix.dirname(entry)}/__tests__`),
    ...(measured?.angularTargets ?? []).map(normalizeProductPath),
    ...(metrics.prerequisites ?? [])
      .filter(prerequisite => slice.requires.includes(prerequisite.id) && prerequisite.target)
      .map(prerequisite => path.posix.dirname(normalizeProductPath(prerequisite.target))),
  ])];
  for (const entry of contract.scope.allowedWritePaths.map(normalizeProductPath)) {
    if (!ceiling.some(base => pathCovers(base, entry))) {
      throw new Error(
        `${absolutePath} $.scope.allowedWritePaths entry ${entry} is outside slice ${planSlice.flowId}; ` +
          `the slice allows ${ceiling.join(", ")}.`,
      );
    }
  }
  return ceiling;
};

const validateMigrationMapPointers = async (absolutePath, value) => {
  const readPointer = (label, pointer) => readLabPointer(absolutePath, label, pointer);

  // The measured structure names the Angular root; a counterpart outside it
  // was built somewhere no later slice looks.
  const metrics = await readPointer("metrics", value.metrics);
  const built = value.prerequisites.filter(prerequisite => prerequisite.angular.status === "built");
  const root = metrics.structure?.root;
  if (built.length > 0 && !root) {
    throw new Error(`${absolutePath} metrics carry no structure root; measure again with migration-map.mjs.`);
  }
  for (const prerequisite of built) {
    if (!pathCovers(root, normalizeProductPath(prerequisite.angular.path))) {
      throw new Error(
        `${absolutePath} prerequisite ${prerequisite.id} is built at ${prerequisite.angular.path}, ` +
          `outside the Angular root ${root}.`,
      );
    }
  }

  // From schemaVersion 2 requires is what the measure found a slice importing.
  // Typed by hand it dropped prerequisites, and the recommendation ranks on it.
  if (value.schemaVersion >= 2) {
    const implied = new Map((metrics.slices ?? []).map(slice => [slice.flowId, slice.impliedRequires]));
    const problems = [];
    for (const slice of value.slices) {
      const expected = implied.get(slice.flowId);
      if (!Array.isArray(expected)) {
        problems.push(`${slice.flowId} has no impliedRequires in the metrics`);
        continue;
      }
      const missing = expected.filter(id => !slice.requires.includes(id));
      const extra = slice.requires.filter(id => !expected.includes(id));
      if (missing.length > 0) problems.push(`${slice.flowId} requires is missing ${missing.join(", ")}`);
      if (extra.length > 0) problems.push(`${slice.flowId} requires names ${extra.join(", ")}, which it does not import`);
    }
    if (problems.length > 0) {
      throw new Error(
        `${absolutePath} requires does not match the measured imports; measure again with migration-map.mjs and take requires from slicesWithIncompleteRequires:\n- ${problems.join("\n- ")}`,
      );
    }
  }

  if (value.supersedes) {
    const previous = await readPointer("supersedes", value.supersedes);
    if (previous.artifactType !== "migration-map" || previous.runId !== value.supersedes.runId) {
      throw new Error(`${absolutePath} supersedes is not the migration-map of run ${value.supersedes.runId}.`);
    }
    if (value.supersedes.runId === value.runId) {
      throw new Error(`${absolutePath} supersedes its own run.`);
    }
  }

  for (const slice of value.slices.filter(entry => entry.evidence)) {
    const verification = await readPointer(`${slice.flowId} evidence`, slice.evidence);
    if (verification.artifactType !== "verification-result" ||
      verification.status !== "PASS" ||
      verification.flowId !== slice.flowId) {
      throw new Error(
        `${absolutePath} ${slice.flowId} evidence is not a PASS verification-result for that flow.`,
      );
    }
  }
};

const validateArtifactRules = (value, errors) => {
  if (value.artifactType === "flow-contract") {
    const isFinalContract = value.schemaVersion >= 6;

    if (value.planSlice) {
      if (value.planSlice.flowId !== value.flowId) {
        errors.push(`$.planSlice.flowId ${value.planSlice.flowId} must equal $.flowId ${value.flowId}.`);
      }
      if (typeof value.planSlice.remainder === "string" && !value.planSlice.remainder.trim()) {
        errors.push("$.planSlice.remainder must name what stays React, or be null when nothing does.");
      }
    }

    if (isFinalContract) {
      for (const field of ["status", "approval"]) {
        if (Object.hasOwn(value, field)) {
          errors.push(
            `$.${field} is not used from schemaVersion 6; a contract is final when it is written.`,
          );
        }
      }
      if (value.targetArchitecture &&
        Object.hasOwn(value.targetArchitecture, "status")) {
        errors.push(
          "$.targetArchitecture.status is not used from schemaVersion 6; the architecture it records is the one being implemented.",
        );
      }
      // Three path lists said the same thing. The allowlist is the boundary and
      // the inventory says, with a citation, which surfaces this slice owns and
      // which it leaves alone; a separate included/excluded list restated both,
      // and no downstream skill ever read it.
      for (const field of ["includedPaths", "excludedPaths"]) {
        if (Object.hasOwn(value.scope, field)) {
          errors.push(
            `$.scope.${field} is not used from schemaVersion 6; $.renderedSurfaceInventory records what this slice owns and leaves alone, and $.scope.allowedWritePaths is the boundary.`,
          );
        }
      }
      if (Object.hasOwn(value, "baselineReport")) {
        errors.push(
          "$.baselineReport is not used from schemaVersion 6; the contract is the only durable baseline artifact.",
        );
      }
      const dependencyChanges = value.targetArchitecture?.dependencyChanges;
      if (dependencyChanges?.required) {
        if (!dependencyChanges.packages?.length) {
          errors.push(
            "$.targetArchitecture.dependencyChanges.packages is required when a dependency change is required; a prose note does not tell flow-migrate what to install.",
          );
        }
        if (!dependencyChanges.paths?.length) {
          errors.push(
            "$.targetArchitecture.dependencyChanges.paths is required when a dependency change is required.",
          );
        }
        if (!value.validationPlan.installCommand) {
          errors.push(
            "$.validationPlan.installCommand is required when a dependency change is required; without it flow-migrate edits a manifest and then typechecks against packages it never installed.",
          );
        }
        // A contract that requires a change to a file its own allowlist
        // forbids has asked for work it made impossible.
        for (const dependencyPath of dependencyChanges.paths ?? []) {
          if (!value.scope.allowedWritePaths.some(allowedPath =>
            pathCovers(allowedPath, dependencyPath))) {
            errors.push(
              `$.targetArchitecture.dependencyChanges.paths entry ${dependencyPath} is outside $.scope.allowedWritePaths. Record it repository-relative, the way $.scope.allowedWritePaths does, and put it in that allowlist.`,
            );
          }
        }
      }
      if (value.validationPlan.testCommands.length === 0 ||
        !value.validationPlan.typecheckCommand ||
        !value.validationPlan.buildCommand) {
        errors.push(
          "$.validationPlan requires test, typecheck and build commands; a final contract carries the commands flow-migrate will run.",
        );
      }
      for (const [name, plan] of [
        ["browserValidation", value.validationPlan.browserValidation],
        ["manualValidation", value.validationPlan.manualValidation],
      ]) {
        if (plan?.required && !plan.scenarios?.length && !plan.scenario) {
          errors.push(
            `$.validationPlan.${name} requires a scenario when it is required.`,
          );
        }
      }
      // Verification is a person walking through the flow. Nobody is assigned
      // to it, so the scenario and the place to run it are the whole
      // instruction; an environment left blank makes the scenario unrunnable.
      if (value.validationPlan.manualValidation?.required &&
        !value.validationPlan.manualValidation.environment) {
        errors.push(
          "$.validationPlan.manualValidation requires an environment when it is required; a scenario with nowhere to run it cannot be walked through.",
        );
      }
    } else {
      for (const field of ["status", "approval"]) {
        if (!Object.hasOwn(value, field)) {
          errors.push(`$.${field} is required below schemaVersion 6.`);
        }
      }
      if (value.targetArchitecture &&
        !Object.hasOwn(value.targetArchitecture, "status")) {
        errors.push(
          "$.targetArchitecture.status is required below schemaVersion 6.",
        );
      }
      for (const field of ["includedPaths", "excludedPaths"]) {
        if (!Object.hasOwn(value.scope, field)) {
          errors.push(`$.scope.${field} is required below schemaVersion 6.`);
        }
      }
    }

    const approval = value.approval ?? {};
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
      if (!isFinalContract &&
        (approval.status !== "approved" || value.status !== "approved")) {
        errors.push(
          "$.checkpointPolicy auto-local mode requires an approved Flow Contract.",
        );
      }
      if (isFinalContract &&
        (!checkpointPolicy.expectedBranch || !checkpointPolicy.externalRef)) {
        errors.push(
          "$.checkpointPolicy auto-local mode requires expectedBranch and externalRef.",
        );
      }
    } else if (hasCheckpointAuthorization) {
      errors.push(
        "$.checkpointPolicy authorization is allowed only for auto-local mode.",
      );
    }

    // A draft states what it knows. Forcing a branch, board reference and
    // milestone list before any of them exist only produces placeholders that
    // read like real values.
    if (checkpointPolicy.mode === "auto-local" &&
      !checkpointPolicy.milestones?.length) {
      errors.push(
        "$.checkpointPolicy.milestones is required for auto-local mode.",
      );
    }
    if (checkpointPolicy.mode === "disabled" &&
      checkpointPolicy.pushPolicy !== "never") {
      errors.push(
        "$.checkpointPolicy.pushPolicy must be never while mode is disabled; without checkpoints the pipeline creates no commit it could push.",
      );
    }

    if (!isFinalContract && value.status === "approved") {
      if (!checkpointPolicy.expectedBranch) {
        errors.push(
          "$.checkpointPolicy.expectedBranch is required for an approved contract.",
        );
      }
      if (!checkpointPolicy.externalRef) {
        errors.push(
          "$.checkpointPolicy.externalRef is required for an approved contract.",
        );
      }
    }

    if (!isFinalContract &&
      (value.status === "approved" || approval.status === "approved")) {
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

    if (value.schemaVersion >= 5) {
      // From schemaVersion 5 the contract is the only durable artifact, so the
      // design and the surface classification live in it rather than in a
      // human-readable report that no later skill reads.
      if (!value.renderedSurfaceInventory?.length) {
        errors.push(
          "$.renderedSurfaceInventory is required from schemaVersion 5; flow-migrate compares it against the real render tree.",
        );
      }
      if (!value.targetArchitecture) {
        errors.push(
          "$.targetArchitecture is required from schemaVersion 5; without it flow-migrate has to re-elicit the design it was handed.",
        );
      }
    }

    // From schemaVersion 7 a baseline hands the board one User Story instead
    // of tracking Epic, Feature, Story and Task IDs through every phase.
    if (value.schemaVersion >= 7) {
      if (!value.userStory) {
        errors.push(
          "$.userStory is required from schemaVersion 7; render-user-story.mjs prints the board's User Story from it.",
        );
      }
      if (Object.hasOwn(value, "workItemContext")) {
        errors.push(
          "$.workItemContext is not used from schemaVersion 7; the flow skills no longer track board IDs.",
        );
      }
    } else if (!Object.hasOwn(value, "workItemContext")) {
      errors.push("$.workItemContext is required below schemaVersion 7.");
    }

    if (value.targetArchitecture &&
      !isFinalContract &&
      value.status === "approved" &&
      value.targetArchitecture.status !== "approved") {
      errors.push(
        "$.targetArchitecture.status must be approved when the contract is approved.",
      );
    }

    if (value.renderedSurfaceInventory) {
      const inventoryIds = value.renderedSurfaceInventory.map(entry => entry.id);
      if (new Set(inventoryIds).size !== inventoryIds.length) {
        errors.push("$.renderedSurfaceInventory must use unique ids.");
      }

      // A migrated surface without a parity entry cannot fail downstream, and a
      // parity entry for a retained surface asks flow-verify to judge something
      // this slice never touches.
      const migrateIds = new Set(
        value.renderedSurfaceInventory
          .filter(entry => entry.status === "migrate")
          .map(entry => entry.id),
      );
      for (const id of migrateIds) {
        if (!value.visualParity?.some(entry => entry.id === id)) {
          errors.push(
            `$.renderedSurfaceInventory declares ${id} as migrate without a matching $.visualParity entry.`,
          );
        }
      }
      for (const entry of value.visualParity ?? []) {
        if (!migrateIds.has(entry.id)) {
          errors.push(
            `$.visualParity declares ${entry.id}, which $.renderedSurfaceInventory does not mark migrate.`,
          );
        }
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
    // A disproved hypothesis tells flow-verify which scenarios to re-examine,
    // so from the array form every entry has to name a declared scenario.
    const scenarioIds = new Set((value.scenarios ?? []).map(scenario => scenario.id));
    for (const entry of value.characterizationRequired ?? []) {
      const location = `$.characterizationRequired ${entry.id}.proveBefore`;
      if (typeof entry.proveBefore === "string") {
        if (entry.proveBefore.trim().length === 0) {
          errors.push(`${location} must not be empty.`);
        }
        continue;
      }
      if (!Array.isArray(entry.proveBefore)) continue;
      if (entry.proveBefore.length === 0) {
        errors.push(`${location} must name at least one scenario id.`);
      }
      if (new Set(entry.proveBefore).size !== entry.proveBefore.length) {
        errors.push(`${location} must use unique scenario ids.`);
      }
      for (const scenarioId of entry.proveBefore) {
        if (!scenarioIds.has(scenarioId)) {
          errors.push(`${location} names ${scenarioId}, which $.scenarios does not declare.`);
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
      // The party that wrote the code records what it did; flow-verify decides
      // whether it matches. Before schemaVersion 4 migrate judged its own work
      // from evidence the contract disqualifies for a nested mount.
      const recordsWork = value.schemaVersion >= 4;
      const allowed = recordsWork
        ? ["addressed", "not-addressed"]
        : ["matches", "deviates", "not-checked"];
      for (const surface of surfaces) {
        if (!allowed.includes(surface.verdict)) {
          errors.push(
            `$.renderedSurfaceComparison.surfaces ${surface.visualParityId} uses verdict ${surface.verdict}; from schemaVersion 4 a migration-result records addressed or not-addressed and flow-verify owns matches or deviates.`,
          );
        }
      }
    }
    if (value.schemaVersion >= 5 && !Array.isArray(value.characterization)) {
      errors.push(
        "$.characterization is required from schemaVersion 5; record the outcome of every characterizationRequired hypothesis, not-run included.",
      );
    }
    const characterization = value.characterization ?? [];
    const characterizationIds = characterization.map(entry => entry.id);
    if (new Set(characterizationIds).size !== characterizationIds.length) {
      errors.push("$.characterization must use unique ids.");
    }
    for (const entry of characterization) {
      if (entry.outcome !== "not-run" && !entry.test) {
        errors.push(`$.characterization ${entry.id} needs the test that ${entry.outcome} it.`);
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

  if (value.artifactType === "migration-map") {
    validateMigrationMapRules(value, errors);
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
    "flow-migrate": new Set(["completed", "failed", "blocked"]),
    "flow-verify": new Set(["PASS", "FAIL", "BLOCKED"]),
    "flow-debug": new Set(["repaired", "blocked", "parked"]),
    "flow-plan": new Set(["mapped", "blocked", "failed"]),
  };
  const allowedStatuses = allowedStatusBySkill[canonicalSkill(value.skill)];

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

  // The flow skills stopped tracking the board phase by phase; a baseline now
  // prints one User Story. Archived snapshots remain evidence, not input.
  if (value.artifactType === "work-item-handoff") {
    throw new Error(
      `${absolutePath} is a retired work-item-handoff snapshot; validate the chain without it.`,
    );
  }
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

  if (value.artifactType === "migration-map") {
    await validateMigrationMapPointers(absolutePath, value);
  }

  if (value.artifactType === "flow-contract" && value.planSlice) {
    await validatePlanSlice(absolutePath, value);
  }

  // A baseline report is optional from schemaVersion 5: the contract itself is
  // the durable artifact. When an older contract still points at one, its hash
  // is still proof that the pointer and the file agree.
  if (value.artifactType === "flow-contract" && value.baselineReport) {
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

// A later verification attempt and the repair that answers it add -<N> to
// every file they write, so no attempt overwrites a file an earlier pointer
// hashes. Names outside that family, such as the examples', are not checked.
const requireAttemptName = (artifact, stem, attempt) => {
  if (!artifact.absolutePath) return;
  const name = path.basename(artifact.absolutePath);
  if (!new RegExp(`^${stem}(?:-\\d+)?\\.json$`).test(name)) return;
  const expected = attempt === 1 ? `${stem}.json` : `${stem}-${attempt}.json`;
  if (name !== expected) {
    throw new Error(`${name} belongs to verification attempt ${attempt}; name it ${expected}.`);
  }
};

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
  // After a repair the set carries the debug-result this attempt consumed,
  // not one answering it, beside this attempt's own debug-handoff.
  const debugResultIsPrevious = Boolean(debugResult) &&
    verification?.value.debugResult?.sha256 === debugResult.sha256;

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
    if (contract.value.approval &&
      (contract.value.status !== "approved" ||
        contract.value.approval.status !== "approved")) {
      throw new Error("flow-migrate requires a human-approved flow contract.");
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
    // Permitted, never required: only a slice that changes dependencies runs it.
    if (contract.value.validationPlan.installCommand) {
      automatedCommands.add(contract.value.validationPlan.installCommand);
    }
    const unownedMigrationCommands = [...migrationCommands].filter(
      command =>
        !automatedCommands.has(command) &&
        !command.includes("verify-checkpoint"),
    );
    if (unownedMigrationCommands.length > 0) {
      throw new Error(
        "migration-result may only record the contract's automated test, typecheck, " +
          "build and checkpoint commands; browser-flow and host evidence belongs to " +
          `flow-verify. Unowned: ${unownedMigrationCommands.join(", ")}.`,
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
    const approvedMilestones =
      contract.value.checkpointPolicy.milestones ?? [];
    for (const checkpoint of migration.value.checkpoints) {
      if (!approvedMilestones.includes(checkpoint.milestone)) {
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
        const settled = migration.value.schemaVersion >= 4
          ? "addressed"
          : "matches";
        if (surface.verdict !== settled) {
          throw new Error(
            `A completed migration-result cannot leave visual parity surface ${surface.visualParityId} on verdict ${surface.verdict}.`,
          );
        }
      }
    }

    // Replacing the behavior a hypothesis names before settling it migrates a
    // guess, so every hypothesis carries an outcome from schemaVersion 5.
    if (migration.value.schemaVersion >= 5) {
      const hypothesisIds = (contract.value.characterizationRequired ?? []).map(
        entry => entry.id,
      );
      const outcomes = new Map(
        (migration.value.characterization ?? []).map(entry => [entry.id, entry]),
      );
      for (const id of hypothesisIds) {
        if (!outcomes.has(id)) {
          throw new Error(
            `migration-result does not record an outcome for the characterizationRequired hypothesis ${id}.`,
          );
        }
      }
      for (const [id, entry] of outcomes) {
        if (!hypothesisIds.includes(id)) {
          throw new Error(
            `migration-result records characterization ${id}, which the flow-contract does not declare.`,
          );
        }
        if (migration.value.status === "completed" && entry.outcome === "not-run") {
          throw new Error(
            `A completed migration-result cannot leave the characterizationRequired hypothesis ${id} not-run.`,
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
    const pushWasAttempted = verification.value.push.status !== "not-requested" &&
      contract.value.checkpointPolicy.mode !== "disabled";
    if (pushWasAttempted &&
      verification.value.push.branch !==
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
    if (debugHandoff && !debugResultIsPrevious &&
      debugHandoff.value.status !== "repairable") {
      throw new Error("flow-debug cannot run for an external-blocked handoff.");
    }
    if (debugResult.value.flowId !== contract.value.flowId ||
      debugResult.value.repository.root !== contract.value.repository.root) {
      throw new Error("debug-result does not match the approved flow.");
    }
    if (debugResult.value.flowContract.sha256 !== contract.sha256 ||
      debugResult.value.migrationResult.sha256 !== migration.sha256) {
      throw new Error("debug-result artifact hashes do not match.");
    }
    if (debugHandoff && !debugResultIsPrevious &&
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

  if (verification) {
    const attempt = verification.value.verificationAttempt;
    requireAttemptName(verification, "verification-result", attempt);
    if (debugHandoff) requireAttemptName(debugHandoff, "debug-handoff", attempt);
    if (debugResult) {
      requireAttemptName(
        debugResult,
        "debug-result",
        debugResultIsPrevious ? attempt - 1 : attempt,
      );
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
  const reverifyArtifacts = await validateFiles(debugReverifyFiles);
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
      "flow-debug cannot run for an external-blocked handoff",
    );
  }
  if (!externalBlockedFailed) {
    throw new Error(
      "Handoff validator self-test allowed debug for an external blocker.",
    );
  }

  // A failed second attempt validates with the debug-result it consumed beside
  // its own debug-handoff, and every per-attempt file is named for its attempt.
  const linkError = set => {
    try {
      validateArtifactLinks(set);
      return "";
    } catch (error) {
      return error.message;
    }
  };
  const renamed = (artifact, name) => ({
    ...structuredClone(artifact),
    absolutePath: path.join(path.dirname(artifact.absolutePath), name),
  });
  const replaceAt = (set, index, artifact) =>
    set.map((entry, position) => (position === index ? artifact : entry));
  const [debugContract, debugMigration, failedVerification, firstHandoff, firstDebugResult] =
    debugArtifacts.map(artifact => structuredClone(artifact));
  const secondAttempt = renamed(failedVerification, "verification-result-2.json");
  secondAttempt.sha256 = "2".repeat(64);
  secondAttempt.value.verificationAttempt = 2;
  secondAttempt.value.debugResult = structuredClone(reverifyArtifacts[3].value.debugResult);
  const secondHandoff = renamed(firstHandoff, "debug-handoff-2.json");
  secondHandoff.value.verificationResult.sha256 = secondAttempt.sha256;
  const secondChain = [
    debugContract, debugMigration, secondAttempt, secondHandoff, firstDebugResult,
  ];
  const secondChainError = linkError(secondChain);
  if (secondChainError) {
    throw new Error(
      `Handoff validator self-test rejected a failed second attempt: ${secondChainError}`,
    );
  }
  for (const [set, expected, description] of [
    [
      replaceAt(secondChain, 3, renamed(secondHandoff, "debug-handoff.json")),
      "name it debug-handoff-2.json",
      "a second attempt's debug-handoff under attempt 1's name",
    ],
    [
      replaceAt(reverifyArtifacts, 3, renamed(reverifyArtifacts[3], "verification-result.json")),
      "name it verification-result-2.json",
      "a re-verification that takes attempt 1's name",
    ],
  ]) {
    if (!linkError(set).includes(expected)) {
      throw new Error(`Handoff validator self-test did not reject ${description}.`);
    }
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

  // From schemaVersion 4 a migration-result records what it addressed; the
  // verdict is flow-verify's. Both vocabularies stay valid under their own
  // version so archived runs keep validating.
  const migrationVerdictCase = (schemaVersion, verdict) => {
    const migration = structuredClone(
      artifacts.find(
        artifact => artifact.value.artifactType === "migration-result",
      ).value,
    );
    migration.schemaVersion = schemaVersion;
    for (const surface of migration.renderedSurfaceComparison.surfaces) {
      surface.verdict = verdict;
    }
    const migrationErrors = [];
    validateArtifactRules(migration, migrationErrors);
    return migrationErrors;
  };

  if (migrationVerdictCase(4, "addressed").length > 0) {
    throw new Error(
      "Handoff validator self-test rejected a schemaVersion 4 migration-result recording addressed surfaces.",
    );
  }
  if (!migrationVerdictCase(4, "matches").some(error =>
    error.includes("flow-verify owns matches or deviates"))) {
    throw new Error(
      "Handoff validator self-test did not reject a schemaVersion 4 migration-result judging its own visual parity.",
    );
  }
  if (!migrationVerdictCase(3, "addressed").some(error =>
    error.includes("uses verdict addressed"))) {
    throw new Error(
      "Handoff validator self-test did not reject a schemaVersion 3 migration-result using the newer verdict vocabulary.",
    );
  }

  const typeListErrors = [];
  validateNode(["valid-length-edit"], { type: ["string", "array"] }, "$", typeListErrors);
  validateNode("valid-length-edit", { type: ["string", "array"] }, "$", typeListErrors);
  const wrongTypeErrors = [];
  validateNode(3, { type: ["string", "array"] }, "$", wrongTypeErrors);
  if (typeListErrors.length > 0 ||
    !wrongTypeErrors.some(error => error.includes("must be string or array"))) {
    throw new Error("Handoff validator self-test did not apply a list of accepted types.");
  }

  const exampleContract = artifacts.find(
    artifact => artifact.value.artifactType === "flow-contract",
  ).value;
  const scenarioIds = exampleContract.scenarios.map(scenario => scenario.id);
  const hypotheses = ["first-hypothesis", "second-hypothesis"].map(id => ({
    id,
    hypothesis: `A reasoned but unproven claim (${id}) about behavior a scenario promises.`,
    proveBefore: [scenarioIds[0]],
    evidence: ["src/example.ts:1"],
  }));
  const proveBeforeErrors = proveBefore => {
    const contract = structuredClone(exampleContract);
    contract.characterizationRequired = structuredClone(hypotheses);
    contract.characterizationRequired[0].proveBefore = proveBefore;
    const contractErrors = [];
    validateArtifactRules(contract, contractErrors);
    return contractErrors.filter(error => error.includes("proveBefore"));
  };
  if (proveBeforeErrors(scenarioIds.slice(0, 2)).length > 0) {
    throw new Error(
      "Handoff validator self-test rejected a proveBefore array of declared scenario ids.",
    );
  }
  if (!proveBeforeErrors([scenarioIds[0], "undeclared-scenario"]).some(error =>
    error.includes("names undeclared-scenario, which $.scenarios does not declare"))) {
    throw new Error(
      "Handoff validator self-test did not reject a proveBefore id that names no scenario.",
    );
  }

  // From schemaVersion 5 a migration-result records what each hypothesis turned
  // out to be; archived runs at 4 keep validating without it.
  const hypothesisIds = hypotheses.map(entry => entry.id);
  const settledCharacterization = hypothesisIds.map(id => ({
    id,
    outcome: "confirmed",
    test: "src/features/floorPlanCreator/detailDrawer/lineForm/__tests__/LineForm.functions.test.ts",
    note: "The characterizing test passed against the React implementation.",
  }));
  const asSchemaVersion5 = (migration, characterization = settledCharacterization) => {
    migration.schemaVersion = 5;
    for (const surface of migration.renderedSurfaceComparison?.surfaces ?? []) {
      surface.verdict = "addressed";
    }
    migration.characterization = structuredClone(characterization);
  };
  const characterizationRuleErrors = mutate => {
    const migration = structuredClone(
      artifacts.find(artifact => artifact.value.artifactType === "migration-result").value,
    );
    asSchemaVersion5(migration);
    mutate(migration);
    const migrationErrors = [];
    validateArtifactRules(migration, migrationErrors);
    return migrationErrors.filter(error => error.includes("characterization"));
  };
  if (characterizationRuleErrors(() => {}).length > 0) {
    throw new Error(
      "Handoff validator self-test rejected a schemaVersion 5 migration-result with settled characterization.",
    );
  }
  if (!characterizationRuleErrors(migration => {
    delete migration.characterization;
  }).some(error => error.includes("$.characterization is required from schemaVersion 5"))) {
    throw new Error(
      "Handoff validator self-test did not reject a schemaVersion 5 migration-result without characterization.",
    );
  }
  if (!characterizationRuleErrors(migration => {
    delete migration.characterization[0].test;
  }).some(error => error.includes("needs the test that confirmed it"))) {
    throw new Error(
      "Handoff validator self-test did not reject a confirmed hypothesis without its test.",
    );
  }

  const settledLinks = structuredClone(artifacts);
  for (const artifact of settledLinks) {
    if (artifact.value.artifactType === "flow-contract") {
      artifact.value.characterizationRequired = structuredClone(hypotheses);
    }
    if (artifact.value.artifactType === "migration-result") {
      asSchemaVersion5(artifact.value);
    }
  }
  validateArtifactLinks(settledLinks);

  expectLinkRejection(
    ({ contract, migration }) => {
      contract.characterizationRequired = structuredClone(hypotheses);
      asSchemaVersion5(migration, settledCharacterization.slice(1));
    },
    `does not record an outcome for the characterizationRequired hypothesis ${hypothesisIds[0]}`,
    "a schemaVersion 5 migration-result that skipped a hypothesis",
  );

  expectLinkRejection(
    ({ contract, migration }) => {
      contract.characterizationRequired = structuredClone(hypotheses);
      asSchemaVersion5(migration, [
        ...settledCharacterization,
        {
          id: "undeclared-hypothesis",
          outcome: "disproved",
          test: "src/undeclared.test.ts",
          note: "A hypothesis the contract never raised.",
        },
      ]);
    },
    "records characterization undeclared-hypothesis, which the flow-contract does not declare",
    "a characterization outcome for a hypothesis the contract does not declare",
  );

  expectLinkRejection(
    ({ contract, migration }) => {
      contract.characterizationRequired = structuredClone(hypotheses);
      asSchemaVersion5(migration);
      migration.characterization[0].outcome = "not-run";
      delete migration.characterization[0].test;
    },
    `cannot leave the characterizationRequired hypothesis ${hypothesisIds[0]} not-run`,
    "a completed migration resting on a hypothesis nobody tested",
  );

  // A disabled checkpoint policy has no branch to push to, and a contract that
  // approved no milestones is a rejection rather than a crash.
  const noPushLinks = structuredClone(artifacts);
  for (const artifact of noPushLinks) {
    if (artifact.value.artifactType === "flow-contract") {
      artifact.value.checkpointPolicy = { mode: "disabled", pushPolicy: "never" };
    }
    if (artifact.value.artifactType === "migration-result") {
      artifact.value.checkpoints = [];
    }
    if (artifact.value.artifactType === "verification-result") {
      artifact.value.push = {
        policy: "never",
        status: "not-requested",
        remote: "origin",
        branch: "N/A",
        commitShas: [],
        upstreamSet: false,
        summary: "Nothing to push: checkpoints are disabled for this flow.",
      };
    }
  }
  validateArtifactLinks(noPushLinks);

  expectLinkRejection(
    ({ contract, migration }) => {
      delete contract.checkpointPolicy.milestones;
      migration.checkpoints = [
        {
          milestone: "unapproved-milestone",
          status: "committed",
          paths: [...migration.changedPaths],
          summary: "A checkpoint whose milestone no contract approved.",
        },
      ];
    },
    "is not approved by the Flow Contract",
    "a checkpoint against a contract that approved no milestones",
  );

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
    "browser-flow and host evidence belongs to flow-verify",
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

  const contractV6 = mutate => {
    const contract = structuredClone(
      artifacts.find(artifact => artifact.value.artifactType === "flow-contract")
        .value,
    );
    contract.schemaVersion = 6;
    delete contract.status;
    delete contract.approval;
    delete contract.baselineReport;
    delete contract.scope.includedPaths;
    delete contract.scope.excludedPaths;
    contract.renderedSurfaceInventory = contract.visualParity.map(entry => ({
      id: entry.id,
      surface: entry.surface,
      status: "migrate",
    }));
    contract.targetArchitecture = {
      boundary: {
        angularOwns: ["The migrated selected-line controls only."],
        reactRetains: ["Selection, drawlib, history and host integration."],
      },
      adapter: {
        inputs: ["Line identity and current values."],
        commands: ["Request a value change."],
        events: ["Accepted snapshot."],
        nonSuccessOutcome: "The adapter reports an explicit rejection.",
      },
      lifecycle: ["Unmount cancels pending timers."],
      styling: ["Use existing design tokens rather than literal values."],
    };
    mutate(contract);
    return contract;
  };

  const cleanV6Errors = [];
  validateArtifactRules(contractV6(() => {}), cleanV6Errors);
  if (cleanV6Errors.length > 0) {
    throw new Error(
      `Handoff validator self-test rejected a valid schemaVersion 6 contract: ${cleanV6Errors.join(", ")}`,
    );
  }

  const expectV6Rejection = (mutate, expected, description) => {
    const contractErrors = [];
    validateArtifactRules(contractV6(mutate), contractErrors);
    if (!contractErrors.some(error => error.includes(expected))) {
      throw new Error(
        `Handoff validator self-test did not reject ${description}.`,
      );
    }
  };

  expectV6Rejection(
    contract => {
      contract.approval = { status: "pending" };
    },
    "$.approval is not used from schemaVersion 6",
    "a schemaVersion 6 contract still carrying an approval block",
  );

  expectV6Rejection(
    contract => {
      delete contract.workItemContext;
    },
    "$.workItemContext is required below schemaVersion 7",
    "a schemaVersion 6 contract without its work-item context",
  );

  const toV7 = contract => {
    contract.schemaVersion = 7;
    delete contract.workItemContext;
    contract.userStory = {
      title: "Migrate the line edit fields",
      userValue: "As a map editor, I want to edit a line's length so that the map stays accurate.",
      currentBehavior: "React renders the length field.",
      desiredBehavior: "Angular renders the length field with the same behavior.",
    };
  };
  const cleanV7 = contractV6(toV7);
  const cleanV7Errors = [];
  validateNode(cleanV7, schema, "$", cleanV7Errors);
  validateArtifactRules(cleanV7, cleanV7Errors);
  if (cleanV7Errors.length > 0) {
    throw new Error(
      `Handoff validator self-test rejected a valid schemaVersion 7 contract: ${cleanV7Errors.join(", ")}`,
    );
  }
  expectV6Rejection(
    contract => {
      toV7(contract);
      delete contract.userStory;
    },
    "$.userStory is required from schemaVersion 7",
    "a schemaVersion 7 contract without its User Story",
  );
  expectV6Rejection(
    contract => {
      toV7(contract);
      contract.workItemContext = {};
    },
    "$.workItemContext is not used from schemaVersion 7",
    "a schemaVersion 7 contract still carrying work-item context",
  );

  expectV6Rejection(
    contract => {
      contract.status = "draft";
    },
    "$.status is not used from schemaVersion 6",
    "a schemaVersion 6 contract still carrying a draft status",
  );

  expectV6Rejection(
    contract => {
      contract.targetArchitecture.status = "proposed";
    },
    "$.targetArchitecture.status is not used from schemaVersion 6",
    "a schemaVersion 6 architecture still carrying a proposed status",
  );

  expectV6Rejection(
    contract => {
      contract.validationPlan.typecheckCommand = "";
    },
    "a final contract carries the commands flow-migrate will run",
    "a schemaVersion 6 contract without a typecheck command",
  );

  expectV6Rejection(
    contract => {
      delete contract.approval;
      contract.schemaVersion = 5;
    },
    "$.approval is required below schemaVersion 6",
    "a schemaVersion 5 contract without an approval block",
  );

  expectV6Rejection(
    contract => {
      delete contract.validationPlan.manualValidation.environment;
    },
    "$.validationPlan.manualValidation requires an environment",
    "a schemaVersion 6 contract requiring manual validation with no environment",
  );

  expectV6Rejection(
    contract => {
      contract.scope.includedPaths = ["src/features/example/Example.tsx"];
    },
    "$.scope.includedPaths is not used from schemaVersion 6",
    "a schemaVersion 6 contract restating its paths as an included list",
  );

  expectV6Rejection(
    contract => {
      contract.scope.excludedPaths = ["src/modules/drawlib"];
    },
    "$.scope.excludedPaths is not used from schemaVersion 6",
    "a schemaVersion 6 contract restating its exclusions as a path list",
  );

  const withDependencyChanges = contract => {
    contract.scope.allowedWritePaths = [
      ...contract.scope.allowedWritePaths,
      "package.json",
      "tsconfig.json",
    ];
    contract.validationPlan.installCommand = "npm install";
    contract.targetArchitecture.dependencyChanges = {
      required: true,
      packages: ["@angular/core@19.2.25"],
      paths: ["package.json", "tsconfig.json"],
    };
  };

  const cleanDependencyErrors = [];
  validateArtifactRules(contractV6(withDependencyChanges), cleanDependencyErrors);
  if (cleanDependencyErrors.length > 0) {
    throw new Error(
      `Handoff validator self-test rejected a valid dependency-changing contract: ${cleanDependencyErrors.join(", ")}`,
    );
  }

  expectV6Rejection(
    contract => {
      withDependencyChanges(contract);
      delete contract.targetArchitecture.dependencyChanges.packages;
    },
    "$.targetArchitecture.dependencyChanges.packages is required",
    "a contract requiring dependency changes without naming the packages",
  );

  expectV6Rejection(
    contract => {
      withDependencyChanges(contract);
      delete contract.validationPlan.installCommand;
    },
    "$.validationPlan.installCommand is required",
    "a contract requiring dependency changes without an install command",
  );

  expectV6Rejection(
    contract => {
      withDependencyChanges(contract);
      contract.targetArchitecture.dependencyChanges.paths.push("vite.config.ts");
    },
    "vite.config.ts is outside $.scope.allowedWritePaths",
    "a contract requiring a dependency change to a path its allowlist forbids",
  );

  expectV6Rejection(
    contract => {
      contract.baselineReport = {
        path: "baseline-report.md",
        sha256: "a".repeat(64),
      };
    },
    "$.baselineReport is not used from schemaVersion 6",
    "a schemaVersion 6 contract pointing at a separate prose report",
  );

  expectV6Rejection(
    contract => {
      contract.schemaVersion = 5;
      contract.status = "draft";
      contract.approval = { status: "pending" };
      contract.targetArchitecture.status = "proposed";
    },
    "$.scope.includedPaths is required below schemaVersion 6",
    "a schemaVersion 5 contract without its included path list",
  );

  const contractV5 = () => {
    const contract = structuredClone(
      artifacts.find(artifact => artifact.value.artifactType === "flow-contract")
        .value,
    );
    contract.schemaVersion = 5;
    delete contract.baselineReport;
    contract.renderedSurfaceInventory = contract.visualParity.map(entry => ({
      id: entry.id,
      surface: entry.surface,
      status: "migrate",
    }));
    contract.renderedSurfaceInventory.push({
      id: "retained-risk-card",
      surface: "Line risk card",
      status: "retain-react",
    });
    contract.targetArchitecture = {
      status: contract.status === "approved" ? "approved" : "proposed",
      boundary: {
        angularOwns: ["The migrated selected-line controls only."],
        reactRetains: ["Selection, drawlib, history and host integration."],
      },
      adapter: {
        inputs: ["Line identity and current values."],
        commands: ["Request a value change."],
        events: ["Accepted snapshot."],
        nonSuccessOutcome: "The adapter reports an explicit rejection.",
      },
      lifecycle: ["Unmount cancels pending timers."],
      styling: ["Use existing design tokens rather than literal values."],
    };
    return contract;
  };

  const expectContractRejection = (mutate, expected, description) => {
    const contract = contractV5();
    mutate(contract);
    const contractErrors = [];
    validateArtifactRules(contract, contractErrors);
    if (!contractErrors.some(error => error.includes(expected))) {
      throw new Error(
        `Handoff validator self-test did not reject ${description}.`,
      );
    }
  };

  const cleanV5Errors = [];
  validateArtifactRules(contractV5(), cleanV5Errors);
  if (cleanV5Errors.length > 0) {
    throw new Error(
      `Handoff validator self-test rejected a valid schemaVersion 5 contract: ${cleanV5Errors.join(", ")}`,
    );
  }

  expectContractRejection(
    contract => {
      delete contract.renderedSurfaceInventory;
    },
    "$.renderedSurfaceInventory is required from schemaVersion 5",
    "a schemaVersion 5 contract without a rendered-surface inventory",
  );

  expectContractRejection(
    contract => {
      delete contract.targetArchitecture;
    },
    "$.targetArchitecture is required from schemaVersion 5",
    "a schemaVersion 5 contract without a target architecture",
  );

  expectContractRejection(
    contract => {
      contract.status = "approved";
      contract.targetArchitecture.status = "proposed";
    },
    "$.targetArchitecture.status must be approved when the contract is approved",
    "an approved contract whose target architecture is still proposed",
  );

  expectContractRejection(
    contract => {
      contract.renderedSurfaceInventory.push({
        id: "undeclared-surface",
        surface: "A migrated control nobody declared parity for",
        status: "migrate",
      });
    },
    "as migrate without a matching $.visualParity entry",
    "a migrated surface with no declared visual parity",
  );

  expectContractRejection(
    contract => {
      contract.renderedSurfaceInventory[0].status = "retain-react";
    },
    "which $.renderedSurfaceInventory does not mark migrate",
    "a visual-parity entry for a surface this slice retains",
  );

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

  const mapExamplePath = path.join(
    rootDirectory, "examples", "migration-map", "demo", "migration-map.json",
  );
  const mapArtifact = await loadArtifact(mapExamplePath);
  const expectMapRejection = (mutate, expectedMessage, label) => {
    const candidate = structuredClone(mapArtifact.value);
    mutate(candidate);
    const errors = [];
    validateArtifactRules(candidate, errors);
    if (!errors.some(error => error.includes(expectedMessage))) {
      throw new Error(`Handoff validator self-test did not reject ${label}.`);
    }
  };
  expectMapRejection(
    map => { map.slices[1].featureId = "unknown-feature"; },
    "is not in $.features",
    "a slice in a feature the map does not list",
  );
  expectMapRejection(
    map => { map.slices[0].dependsOn = ["demo-line-drawer-parent"]; },
    "dependsOn forms a cycle",
    "slices that wait on each other",
  );
  expectMapRejection(
    map => { delete map.slices[0].evidence; },
    "is landed without an evidence pointer",
    "a landed slice without its PASS verification",
  );
  expectMapRejection(
    map => { map.slices[1].evidence = structuredClone(map.slices[0].evidence); },
    "evidence is only for a landed slice",
    "evidence on a slice that has not landed",
  );
  expectMapRejection(
    map => { map.recommendation.options.push({ flowId: "demo-line-drawer", reason: "Again." }); },
    "has already landed",
    "a recommendation of a landed slice",
  );
  expectMapRejection(
    map => { map.slices[1].status = "in-progress"; },
    "only a candidate can be offered",
    "a recommendation of a slice already in progress",
  );
  expectMapRejection(
    map => { map.recommendation.queue.push("demo-line-drawer-parent"); },
    "is not one of $.recommendation.options",
    "a queued slice that was never offered",
  );
  expectMapRejection(
    map => { map.recommendation.chosen = "demo-charger-form"; },
    "$.recommendation.chosen is not used from schemaVersion 2",
    "a schemaVersion 2 map that still records one chosen slice",
  );
  expectMapRejection(
    map => { delete map.recommendation.queue; },
    "$.recommendation.queue is required from schemaVersion 2",
    "a schemaVersion 2 map without a queue",
  );
  expectMapRejection(
    map => {
      map.schemaVersion = 1;
      delete map.recommendation.queue;
      map.recommendation.chosen = "demo-line-drawer-parent";
    },
    "$.recommendation.chosen must be one of",
    "a schemaVersion 1 chosen slice that was never offered",
  );
  expectMapRejection(
    map => { map.slices[1].paths = ["C:\\Project\\demo-product\\src"]; },
    "must be relative to the product root",
    "an absolute product path",
  );

  const expectMapPointerRejection = async (mutate, expectedMessage, label) => {
    const candidate = structuredClone(mapArtifact.value);
    await mutate(candidate);
    try {
      await validateMigrationMapPointers(mapExamplePath, candidate);
    } catch (error) {
      if (error.message.includes(expectedMessage)) return;
      throw error;
    }
    throw new Error(`Handoff validator self-test did not reject ${label}.`);
  };
  await expectMapPointerRejection(
    map => { map.metrics.sha256 = "0".repeat(64); },
    "metrics hash does not match",
    "a metrics pointer whose hash does not match",
  );
  await expectMapPointerRejection(
    map => { map.prerequisites[2].angular.path = "src/state/angular/line-store.adapter.ts"; },
    "outside the Angular root",
    "a built counterpart outside the measured Angular root",
  );
  await expectMapPointerRejection(
    async map => {
      // Any hashed file without a structure stands in for metrics measured before one.
      const unstructured = path.join(debugExampleDirectory, "failed-verification-result.json");
      map.metrics = {
        path: path.relative(rootDirectory, unstructured),
        sha256: createHash("sha256").update(await readFile(unstructured)).digest("hex"),
      };
    },
    "metrics carry no structure root",
    "a built counterpart with metrics that name no Angular root",
  );
  await expectMapPointerRejection(
    async map => {
      const failedPath = path.join(debugExampleDirectory, "failed-verification-result.json");
      map.slices[0].evidence = {
        path: path.relative(rootDirectory, failedPath),
        sha256: createHash("sha256").update(await readFile(failedPath)).digest("hex"),
      };
    },
    "is not a PASS verification-result",
    "a landed slice whose evidence is a failed verification",
  );
  await expectMapPointerRejection(
    map => { map.slices[1].requires = map.slices[1].requires.filter(id => id !== "text"); },
    "demo-charger-form requires is missing text",
    "a slice whose requires drops a prerequisite it imports",
  );
  await expectMapPointerRejection(
    map => { map.slices[3].requires.push("line-store"); },
    "which it does not import",
    "a slice whose requires names a prerequisite it does not import",
  );
  const olderRequires = structuredClone(mapArtifact.value);
  olderRequires.schemaVersion = 1;
  olderRequires.slices[1].requires = olderRequires.slices[1].requires.filter(id => id !== "text");
  await validateMigrationMapPointers(mapExamplePath, olderRequires);

  const predatingDirectory = await mkdtemp(path.join(os.tmpdir(), "validate-handoff-map-"));
  try {
    await expectMapPointerRejection(
      async map => {
        const metrics = JSON.parse(
          (await readFile(path.resolve(rootDirectory, map.metrics.path), "utf8")).replace(/^﻿/, ""),
        );
        for (const slice of metrics.slices) delete slice.impliedRequires;
        const raw = `${JSON.stringify(metrics, null, 2)}\n`;
        const metricsPath = path.join(predatingDirectory, "migration-metrics.json");
        await writeFile(metricsPath, raw);
        map.metrics = { path: metricsPath, sha256: createHash("sha256").update(raw).digest("hex") };
      },
      "has no impliedRequires in the metrics",
      "a schemaVersion 2 map whose metrics predate impliedRequires",
    );
  } finally {
    await rm(predatingDirectory, { recursive: true, force: true });
  }

  const planDirectory = await mkdtemp(path.join(os.tmpdir(), "validate-handoff-plan-"));
  try {
    const hashed = raw => createHash("sha256").update(raw).digest("hex");
    const metricsRaw = `${JSON.stringify({
      slices: [{ flowId: "demo-line-drawer", angularTargets: ["src/angular/domains/demo/pages/line-drawer"] }],
      prerequisites: [
        { id: "line-store", target: "src/angular/core/store/line.store.ts" },
        { id: "unrequired", target: "src/angular/shared/unrequired.component.ts" },
        { id: "unplaced", target: null },
      ],
    })}\n`;
    const metricsPath = path.join(planDirectory, "migration-metrics.json");
    await writeFile(metricsPath, metricsRaw);
    const mapRaw = `${JSON.stringify({
      artifactType: "migration-map",
      runId: "migration-map-7",
      metrics: { path: metricsPath, sha256: hashed(metricsRaw) },
      slices: [{
        flowId: "demo-line-drawer",
        paths: ["src/features/demo-line-drawer/LineDrawer.tsx"],
        requires: ["line-store", "unplaced"],
      }],
    })}\n`;
    const planMapPath = path.join(planDirectory, "migration-map.json");
    await writeFile(planMapPath, mapRaw);

    const plannedContract = () => {
      const planned = structuredClone(
        artifacts.find(artifact => artifact.value.artifactType === "flow-contract").value,
      );
      planned.planSlice = {
        map: { path: planMapPath, sha256: hashed(mapRaw), runId: "migration-map-7" },
        flowId: planned.flowId,
        remainder: "the line colour picker",
      };
      planned.scope.allowedWritePaths = [
        "src/features/demo-line-drawer/LineDrawer.tsx",
        "src\\features\\demo-line-drawer\\__tests__\\",
        "src/angular/domains/demo/pages/line-drawer/",
        "src/angular/core/store/line.store.ts",
      ];
      return planned;
    };

    const planSchemaErrors = [];
    validateNode(plannedContract(), schema, "$", planSchemaErrors);
    validateArtifactRules(plannedContract(), planSchemaErrors);
    if (planSchemaErrors.length > 0) {
      throw new Error(`Handoff validator self-test rejected a valid planSlice: ${planSchemaErrors.join(", ")}`);
    }
    await validatePlanSlice(contractPath, plannedContract());

    const expectPlanRejection = async (mutate, expectedMessage, label) => {
      const candidate = plannedContract();
      mutate(candidate);
      try {
        await validatePlanSlice(contractPath, candidate);
      } catch (error) {
        if (error.message.includes(expectedMessage)) return;
        throw error;
      }
      throw new Error(`Handoff validator self-test did not reject ${label}.`);
    };
    await expectPlanRejection(
      contract => { contract.scope.allowedWritePaths.push("src/angular/shared"); },
      "entry src/angular/shared is outside slice demo-line-drawer",
      "an allowlist entry outside the slice ceiling",
    );
    await expectPlanRejection(
      contract => { contract.planSlice.flowId = "absent-slice"; },
      "planSlice absent-slice is not a slice of map migration-map-7",
      "a planSlice naming a slice the map does not hold",
    );
    await expectPlanRejection(
      contract => { contract.planSlice.map.runId = "migration-map-8"; },
      "is not the migration-map of run migration-map-8",
      "a planSlice map pointer naming another run",
    );

    const expectPlanRuleRejection = (mutate, expectedMessage, label) => {
      const candidate = plannedContract();
      mutate(candidate);
      const planErrors = [];
      validateArtifactRules(candidate, planErrors);
      if (!planErrors.some(error => error.includes(expectedMessage))) {
        throw new Error(`Handoff validator self-test did not reject ${label}.`);
      }
    };
    expectPlanRuleRejection(
      contract => { contract.planSlice.flowId = "demo-charger-form"; },
      "$.planSlice.flowId demo-charger-form must equal $.flowId",
      "a planSlice for another flow",
    );
    expectPlanRuleRejection(
      contract => { contract.planSlice.remainder = "  "; },
      "$.planSlice.remainder must name what stays React",
      "a blank remainder",
    );

    const unplanned = plannedContract();
    delete unplanned.planSlice;
    const unplannedErrors = [];
    validateArtifactRules(unplanned, unplannedErrors);
    if (unplannedErrors.some(error => error.includes("planSlice"))) {
      throw new Error(`Handoff validator self-test applied planSlice rules without one: ${unplannedErrors.join(", ")}`);
    }
  } finally {
    await rm(planDirectory, { recursive: true, force: true });
  }

  console.log(
    "Handoff validator self-test passed " +
      "(handoff chain, observation and migration-map edge cases).",
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
