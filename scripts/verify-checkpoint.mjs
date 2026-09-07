import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

const validationStatuses = new Set([
  "passed",
  "failed",
  "blocked",
  "not-run",
]);
const deltaIsolationStates = new Set([
  "proven",
  "not-needed",
]);
const commitConventionKinds = new Set([
  "ticket-prefix",
  "freeform",
]);
const ticketTokenFormats = new Set([
  "compact",
  "hyphen",
]);
const ticketTokenEnclosures = new Set([
  "plain",
  "brackets",
]);
const sensitiveBasenames = new Map([
  [".npmrc", "credential file"],
  [".yarnrc", "credential file"],
  [".yarnrc.yml", "credential file"],
  [".pypirc", "credential file"],
  [".netrc", "credential file"],
  [".git-credentials", "credential file"],
  ["credentials.json", "credential file"],
  ["service-account.json", "credential file"],
]);
const sensitiveDirectories = new Set([
  ".ssh",
  ".aws",
  "certs",
  "certificates",
  "keys",
  "private-keys",
]);

class ExplicitError extends Error {
  constructor(message, errors = [], result = {}) {
    super(message);
    this.name = "ExplicitError";
    this.errors = errors;
    this.result = result;
  }
}

const toPosix = value => value.replaceAll("\\", "/");

const uniqueSorted = values => [...new Set(values)].sort((left, right) =>
  left.localeCompare(right, "en"));

const hashText = value => createHash("sha256").update(value).digest("hex");

const normalizeRelativePathText = (value, label) => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must be a non-empty path.`);
  }

  const normalized = path.posix.normalize(
    toPosix(trimmed).replace(/^\.\/+/, ""),
  );

  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    throw new Error(`${label} must stay inside repositoryRoot.`);
  }

  return normalized === "" ? "." : normalized;
};

const normalizeRepoRelativePath = (repositoryRoot, value, label) => {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string path.`);
  }

  const absolutePath = path.isAbsolute(value) ?
    path.resolve(value) :
    path.resolve(repositoryRoot, value);
  const relativePath = path.relative(repositoryRoot, absolutePath);
  const normalizedRelative = normalizeRelativePathText(relativePath || ".", label);

  if (
    normalizedRelative === ".." ||
    normalizedRelative.startsWith("../")
  ) {
    throw new Error(`${label} must stay inside repositoryRoot.`);
  }

  return normalizedRelative;
};

const pathCovers = (basePath, candidatePath) => {
  if (basePath === ".") return true;
  return candidatePath === basePath || candidatePath.startsWith(`${basePath}/`);
};

const pathsIntersect = (leftPath, rightPath) =>
  pathCovers(leftPath, rightPath) || pathCovers(rightPath, leftPath);

const isCoveredByAny = (candidatePath, allowedPaths) =>
  allowedPaths.some(allowedPath => pathCovers(allowedPath, candidatePath));

const describePathList = paths => uniqueSorted(paths).join(", ");

const parseTicketReference = value => {
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^([A-Za-z]{2,10})-?(\d+)$/);
  if (!match) return null;

  return {
    prefix: match[1].toUpperCase(),
    digits: match[2],
  };
};

const detectTicketPattern = (subjects, externalRef) => {
  const preferredPrefix = parseTicketReference(externalRef)?.prefix ?? null;
  const matches = [];

  for (const subject of subjects) {
    const match = subject.match(
      /^(?:\[(?<bracketPrefix>[A-Z]{2,10})(?<bracketHyphen>-?)(?<bracketDigits>\d+)\]|(?<plainPrefix>[A-Z]{2,10})(?<plainHyphen>-?)(?<plainDigits>\d+))(?<separator>:\s+|\s+-\s+|\s+)/,
    );

    if (!match?.groups) continue;

    const prefix = match.groups.bracketPrefix ?? match.groups.plainPrefix;
    const hyphen = match.groups.bracketHyphen ?? match.groups.plainHyphen;
    const enclosure = match.groups.bracketPrefix ? "brackets" : "plain";

    matches.push({
      prefix,
      tokenFormat: hyphen === "-" ? "hyphen" : "compact",
      enclosure,
      subjectSeparator: match.groups.separator,
    });
  }

  const relevantMatches = preferredPrefix ?
    matches.filter(match => match.prefix === preferredPrefix) :
    matches;
  const pool = relevantMatches.length > 0 ? relevantMatches : matches;

  if (pool.length < 2) return null;

  const counts = new Map();
  for (const match of pool) {
    const signature = JSON.stringify({
      tokenFormat: match.tokenFormat,
      enclosure: match.enclosure,
      subjectSeparator: match.subjectSeparator,
    });
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  const [winningSignature, winningCount] = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en"),
  )[0];

  if (winningCount < 2) return null;

  return JSON.parse(winningSignature);
};

const renderTicketToken = (externalRef, convention) => {
  const parsedReference = parseTicketReference(externalRef);
  if (!parsedReference) return externalRef.trim();

  const baseToken = convention.tokenFormat === "hyphen" ?
    `${parsedReference.prefix}-${parsedReference.digits}` :
    `${parsedReference.prefix}${parsedReference.digits}`;

  return convention.enclosure === "brackets" ? `[${baseToken}]` : baseToken;
};

const buildChangeSummary = candidatePaths => {
  const paths = uniqueSorted(candidatePaths);

  if (paths.length === 0) return "update approved files";
  if (paths.length === 1) return `update ${paths[0]}`;
  return `update ${paths[0]} (+${paths.length - 1} more)`;
};

const buildCommitSubject = (externalRef, convention, candidatePaths) => {
  const changeSummary = buildChangeSummary(candidatePaths);

  if (convention.kind === "ticket-prefix") {
    const ticketToken = renderTicketToken(externalRef, convention);
    return `${ticketToken}${convention.subjectSeparator}checkpoint: ${changeSummary}`;
  }

  return `checkpoint: ${externalRef} ${changeSummary}`;
};

const buildCommitSubjectPrefix = (externalRef, convention) => {
  if (convention.kind === "ticket-prefix") {
    return `${renderTicketToken(externalRef, convention)}${convention.subjectSeparator}`;
  }

  return `checkpoint: ${externalRef} `;
};

const getDenylistReasons = relativePath => {
  const normalizedPath = relativePath.toLowerCase();
  const segments = normalizedPath.split("/");
  const basename = segments[segments.length - 1];
  const reasons = [];

  if (/^\.env(?:\.|$)/.test(basename)) {
    reasons.push("environment file");
  }

  if (sensitiveBasenames.has(basename)) {
    reasons.push(sensitiveBasenames.get(basename));
  }

  if (
    /\.(pem|p12|pfx|crt|cer|key|jks|keystore|der|p7b)$/i.test(basename) ||
    /^id_[a-z0-9_-]+$/i.test(basename)
  ) {
    reasons.push("key or certificate file");
  }

  for (const segment of segments.slice(0, -1)) {
    if (sensitiveDirectories.has(segment)) {
      reasons.push(`sensitive directory "${segment}"`);
    }
  }

  return uniqueSorted(reasons);
};

const runGit = (repositoryRoot, args, options = {}) => {
  const result = spawnSync(
    "git",
    ["-C", repositoryRoot, ...args],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.error) {
    throw new Error(
      `Failed to run git ${args.join(" ")}: ${result.error.message}`,
      { cause: result.error },
    );
  }

  if (!options.allowFailure && result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim();
    throw new Error(
      `git ${args.join(" ")} failed with exit code ${result.status}: ${output || "no output"}.`,
    );
  }

  return result;
};

const parseNullSeparatedPaths = (stdout, label) => uniqueSorted(
  stdout
    .split("\u0000")
    .filter(entry => entry.length > 0)
    .map(entry => normalizeRelativePathText(entry, label)),
);

const parseStatusEntries = stdout => {
  const entries = [];
  let index = 0;

  while (index < stdout.length) {
    const x = stdout[index];
    const y = stdout[index + 1];

    if (x === undefined || y === undefined) {
      throw new Error("git status --porcelain returned a truncated status entry.");
    }

    if (stdout[index + 2] !== " ") {
      throw new Error("git status --porcelain returned an unexpected entry format.");
    }

    const pathStart = index + 3;
    const pathEnd = stdout.indexOf("\u0000", pathStart);
    if (pathEnd === -1) {
      throw new Error("git status --porcelain returned an unterminated path entry.");
    }

    const rawPath = stdout.slice(pathStart, pathEnd);
    const paths = [
      normalizeRelativePathText(rawPath, "git status path"),
    ];
    index = pathEnd + 1;

    if (x === "R" || x === "C" || y === "R" || y === "C") {
      const renamedPathEnd = stdout.indexOf("\u0000", index);
      if (renamedPathEnd === -1) {
        throw new Error("git status --porcelain returned an incomplete rename entry.");
      }

      const renamedPath = stdout.slice(index, renamedPathEnd);
      paths.push(normalizeRelativePathText(renamedPath, "git status rename path"));
      index = renamedPathEnd + 1;
    }

    entries.push({
      code: `${x}${y}`,
      paths: uniqueSorted(paths),
    });
  }

  return entries;
};

const pathExists = async candidatePath => {
  try {
    await access(candidatePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const getStagedPaths = repositoryRoot => parseNullSeparatedPaths(
  runGit(
    repositoryRoot,
    ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACDMRTUXB"],
  ).stdout,
  "staged path",
);

const getStagedDiffText = repositoryRoot => runGit(
  repositoryRoot,
  [
    "diff",
    "--cached",
    "--binary",
    "--full-index",
    "--no-color",
    "--no-ext-diff",
    "--src-prefix=a/",
    "--dst-prefix=b/",
  ],
).stdout;

const getCommitSubject = (repositoryRoot, commitSha) => runGit(
  repositoryRoot,
  ["show", "--quiet", "--format=%s", commitSha],
).stdout.trim();

const getCommitChangedPaths = (repositoryRoot, commitSha) => parseNullSeparatedPaths(
  runGit(
    repositoryRoot,
    ["show", "--format=", "--name-only", "-z", "--diff-filter=ACDMRTUXB", commitSha],
  ).stdout,
  "commit path",
);

const getRepositoryState = async repositoryRoot => {
  const repositoryCheck = runGit(
    repositoryRoot,
    ["rev-parse", "--is-inside-work-tree"],
    { allowFailure: true },
  );

  if (repositoryCheck.status !== 0 || repositoryCheck.stdout.trim() !== "true") {
    throw new Error(`${repositoryRoot} is not a Git working tree.`);
  }

  const gitDirectoryOutput = runGit(
    repositoryRoot,
    ["rev-parse", "--git-dir"],
  ).stdout.trim();
  const gitDirectory = path.isAbsolute(gitDirectoryOutput) ?
    path.resolve(gitDirectoryOutput) :
    path.resolve(repositoryRoot, gitDirectoryOutput);
  const currentBranchResult = runGit(
    repositoryRoot,
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    { allowFailure: true },
  );
  const currentHead = runGit(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD"],
  ).stdout.trim();
  const statusEntries = parseStatusEntries(
    runGit(
      repositoryRoot,
      ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    ).stdout,
  );
  const currentChangedPaths = uniqueSorted(
    statusEntries.flatMap(entry => entry.paths),
  );
  const recentSubjects = runGit(
    repositoryRoot,
    ["log", "--format=%s", "-n", "20"],
  ).stdout
    .split(/\r?\n/)
    .map(subject => subject.trim())
    .filter(subject => subject.length > 0);
  const activeOperations = [];

  for (const [label, markerPath] of [
    ["merge", "MERGE_HEAD"],
    ["rebase", "rebase-merge"],
    ["rebase", "rebase-apply"],
    ["rebase", "REBASE_HEAD"],
    ["cherry-pick", "CHERRY_PICK_HEAD"],
  ]) {
    if (await pathExists(path.join(gitDirectory, markerPath))) {
      activeOperations.push(label);
    }
  }

  return {
    activeOperations: uniqueSorted(activeOperations),
    currentBranch: currentBranchResult.status === 0 ?
      currentBranchResult.stdout.trim() :
      null,
    currentChangedPaths,
    currentHead,
    recentSubjects,
    statusEntries,
  };
};

const readJsonFile = async filePath => {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");

  try {
    return {
      absolutePath,
      value: JSON.parse(raw),
    };
  } catch (error) {
    throw new Error(`${absolutePath} is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
};

const normalizeCommitConvention = value => {
  if (value === undefined) return null;

  if (typeof value === "string") {
    if (!commitConventionKinds.has(value)) {
      throw new Error("commitConvention must be ticket-prefix or freeform.");
    }

    return { kind: value };
  }

  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("commitConvention must be a string or object.");
  }

  if (!commitConventionKinds.has(value.kind)) {
    throw new Error("commitConvention.kind must be ticket-prefix or freeform.");
  }

  const normalized = {
    kind: value.kind,
  };

  if (Object.hasOwn(value, "subjectSeparator")) {
    if (
      typeof value.subjectSeparator !== "string" ||
      value.subjectSeparator.length === 0
    ) {
      throw new Error("commitConvention.subjectSeparator must be a non-empty string.");
    }

    normalized.subjectSeparator = value.subjectSeparator;
  }

  if (Object.hasOwn(value, "tokenFormat")) {
    if (!ticketTokenFormats.has(value.tokenFormat)) {
      throw new Error("commitConvention.tokenFormat must be compact or hyphen.");
    }

    normalized.tokenFormat = value.tokenFormat;
  }

  if (Object.hasOwn(value, "enclosure")) {
    if (!ticketTokenEnclosures.has(value.enclosure)) {
      throw new Error("commitConvention.enclosure must be plain or brackets.");
    }

    normalized.enclosure = value.enclosure;
  }

  return normalized;
};

const normalizeManifest = (manifest, manifestPath) => {
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    throw new ExplicitError(
      "Manifest validation failed.",
      ["Manifest root must be a JSON object."],
      { manifestPath },
    );
  }

  const errors = [];
  const manifestDirectory = path.dirname(manifestPath);
  let repositoryRoot = null;

  if (typeof manifest.repositoryRoot !== "string" || manifest.repositoryRoot.trim() === "") {
    errors.push("repositoryRoot must be a non-empty string.");
  } else {
    repositoryRoot = path.resolve(manifestDirectory, manifest.repositoryRoot);
  }

  const normalized = {
    manifestPath,
    repositoryRoot,
  };

  if (typeof manifest.expectedBranch !== "string" || manifest.expectedBranch.trim() === "") {
    errors.push("expectedBranch must be a non-empty string.");
  } else {
    normalized.expectedBranch = manifest.expectedBranch.trim();
  }

  if (typeof manifest.baselineHead !== "string" || !/^[a-f0-9]{7,64}$/i.test(manifest.baselineHead)) {
    errors.push("baselineHead must be a 7-64 character Git commit id.");
  } else {
    normalized.baselineHead = manifest.baselineHead.trim();
  }

  if (typeof manifest.externalRef !== "string" || manifest.externalRef.trim() === "") {
    errors.push("externalRef must be a non-empty string.");
  } else {
    normalized.externalRef = manifest.externalRef.trim();
  }

  try {
    normalized.commitConvention = normalizeCommitConvention(manifest.commitConvention);
  } catch (error) {
    errors.push(error.message);
  }

  const normalizePathCollection = (value, label, mapper) => {
    if (!Array.isArray(value)) {
      errors.push(`${label} must be an array.`);
      return [];
    }

    return value.flatMap((entry, index) => {
      try {
        return [mapper(entry, `${label}[${index}]`)];
      } catch (error) {
        errors.push(error.message);
        return [];
      }
    });
  };

  if (repositoryRoot) {
    normalized.allowedWritePaths = normalizePathCollection(
      manifest.allowedWritePaths,
      "allowedWritePaths",
      (entry, label) => normalizeRepoRelativePath(repositoryRoot, entry, label),
    );
    normalized.baselineStatus = normalizePathCollection(
      manifest.baselineStatus,
      "baselineStatus",
      (entry, label) => {
        if (typeof entry === "string") {
          return {
            path: normalizeRepoRelativePath(repositoryRoot, entry, `${label}.path`),
            status: null,
          };
        }

        if (
          entry === null ||
          typeof entry !== "object" ||
          Array.isArray(entry)
        ) {
          throw new Error(`${label} must be a string or object.`);
        }

        if (typeof entry.path !== "string" || entry.path.trim() === "") {
          throw new Error(`${label}.path must be a non-empty string.`);
        }

        if (
          Object.hasOwn(entry, "status") &&
          typeof entry.status !== "string"
        ) {
          throw new Error(`${label}.status must be a string when provided.`);
        }

        return {
          path: normalizeRepoRelativePath(repositoryRoot, entry.path, `${label}.path`),
          status: entry.status ?? null,
        };
      },
    );
    normalized.candidatePaths = normalizePathCollection(
      manifest.candidatePaths,
      "candidatePaths",
      (entry, label) => {
        if (typeof entry === "string") {
          return {
            path: normalizeRepoRelativePath(repositoryRoot, entry, `${label}.path`),
            deltaIsolation: null,
          };
        }

        if (
          entry === null ||
          typeof entry !== "object" ||
          Array.isArray(entry)
        ) {
          throw new Error(`${label} must be a string or object.`);
        }

        if (typeof entry.path !== "string" || entry.path.trim() === "") {
          throw new Error(`${label}.path must be a non-empty string.`);
        }

        if (
          Object.hasOwn(entry, "deltaIsolation") &&
          !deltaIsolationStates.has(entry.deltaIsolation)
        ) {
          throw new Error(
            `${label}.deltaIsolation must be proven or not-needed when provided.`,
          );
        }

        return {
          path: normalizeRepoRelativePath(repositoryRoot, entry.path, `${label}.path`),
          deltaIsolation: entry.deltaIsolation ?? null,
        };
      },
    );
    normalized.expectedCommittedPaths = manifest.expectedCommittedPaths === undefined ?
      null :
      normalizePathCollection(
        manifest.expectedCommittedPaths,
        "expectedCommittedPaths",
        (entry, label) => normalizeRepoRelativePath(repositoryRoot, entry, label),
      );
  } else {
    normalized.allowedWritePaths = [];
    normalized.baselineStatus = [];
    normalized.candidatePaths = [];
    normalized.expectedCommittedPaths = null;
  }

  const validationEntries = manifest.validations ?? manifest.validation;
  normalized.validations = normalizePathCollection(
    validationEntries,
    "validations",
    (entry, label) => {
      if (
        entry === null ||
        typeof entry !== "object" ||
        Array.isArray(entry)
      ) {
        throw new Error(`${label} must be an object.`);
      }

      if (typeof entry.name !== "string" || entry.name.trim() === "") {
        throw new Error(`${label}.name must be a non-empty string.`);
      }

      if (!validationStatuses.has(entry.status)) {
        throw new Error(
          `${label}.status must be passed, failed, blocked, or not-run.`,
        );
      }

      if (
        Object.hasOwn(entry, "required") &&
        typeof entry.required !== "boolean"
      ) {
        throw new Error(`${label}.required must be boolean when provided.`);
      }

      return {
        name: entry.name.trim(),
        required: entry.required ?? true,
        status: entry.status,
      };
    },
  );

  if (normalized.allowedWritePaths.length === 0) {
    errors.push("allowedWritePaths must contain at least one path.");
  }

  if (normalized.candidatePaths.length === 0) {
    errors.push("candidatePaths must contain at least one path.");
  }

  if (normalized.validations.length === 0) {
    errors.push("validations must contain at least one entry.");
  }

  if (errors.length > 0) {
    throw new ExplicitError(
      "Manifest validation failed.",
      errors,
      {
        manifestPath,
        repositoryRoot,
      },
    );
  }

  normalized.allowedWritePaths = uniqueSorted(normalized.allowedWritePaths);
  normalized.baselineStatus = normalized.baselineStatus.sort((left, right) =>
    left.path.localeCompare(right.path, "en"));
  normalized.candidatePaths = normalized.candidatePaths.sort((left, right) =>
    left.path.localeCompare(right.path, "en"));

  return normalized;
};

const resolveCommitConvention = (manifestConvention, recentSubjects, externalRef) => {
  const detectedPattern = detectTicketPattern(recentSubjects, externalRef);

  if (manifestConvention?.kind === "ticket-prefix") {
    return {
      kind: "ticket-prefix",
      source: "manifest",
      tokenFormat: manifestConvention.tokenFormat ??
        detectedPattern?.tokenFormat ??
        (parseTicketReference(externalRef) ? "compact" : "compact"),
      enclosure: manifestConvention.enclosure ??
        detectedPattern?.enclosure ??
        "plain",
      subjectSeparator: manifestConvention.subjectSeparator ??
        detectedPattern?.subjectSeparator ??
        " ",
    };
  }

  if (manifestConvention?.kind === "freeform") {
    return {
      kind: "freeform",
      source: "manifest",
    };
  }

  if (detectedPattern && parseTicketReference(externalRef)) {
    return {
      kind: "ticket-prefix",
      source: "git-history",
      tokenFormat: detectedPattern.tokenFormat,
      enclosure: detectedPattern.enclosure,
      subjectSeparator: detectedPattern.subjectSeparator,
    };
  }

  return {
    kind: "freeform",
    source: "fallback",
  };
};

const verifyCheckpointManifest = async normalizedManifest => {
  const repositoryState = await getRepositoryState(normalizedManifest.repositoryRoot);
  const errors = [];
  const baselinePaths = uniqueSorted(
    normalizedManifest.baselineStatus.map(entry => entry.path),
  );
  const candidatePaths = uniqueSorted(
    normalizedManifest.candidatePaths.map(entry => entry.path),
  );
  const preExistingDirtyCandidates = [];

  if (repositoryState.activeOperations.length > 0) {
    errors.push(
      `Active Git operation detected: ${repositoryState.activeOperations.join(", ")}.`,
    );
  }

  if (!repositoryState.currentBranch) {
    errors.push("HEAD is detached; an explicit branch is required.");
  } else if (repositoryState.currentBranch !== normalizedManifest.expectedBranch) {
    errors.push(
      `Expected branch ${normalizedManifest.expectedBranch} but found ${repositoryState.currentBranch}.`,
    );
  }

  if (repositoryState.currentHead !== normalizedManifest.baselineHead) {
    errors.push(
      `Expected HEAD ${normalizedManifest.baselineHead} but found ${repositoryState.currentHead}.`,
    );
  }

  for (const candidateEntry of normalizedManifest.candidatePaths) {
    if (!isCoveredByAny(candidateEntry.path, normalizedManifest.allowedWritePaths)) {
      errors.push(
        `Candidate path ${candidateEntry.path} is outside allowedWritePaths (${describePathList(normalizedManifest.allowedWritePaths)}).`,
      );
    }

    const denylistReasons = getDenylistReasons(candidateEntry.path);
    if (denylistReasons.length > 0) {
      errors.push(
        `Candidate path ${candidateEntry.path} is denylisted (${denylistReasons.join(", ")}).`,
      );
    }

    const intersectsDirtyBaseline = normalizedManifest.baselineStatus.some(
      baselineEntry => pathsIntersect(candidateEntry.path, baselineEntry.path),
    );

    if (intersectsDirtyBaseline && candidateEntry.deltaIsolation !== "proven") {
      preExistingDirtyCandidates.push(candidateEntry.path);
    }
  }

  if (preExistingDirtyCandidates.length > 0) {
    errors.push(
      `Pre-existing dirty candidate paths require deltaIsolation: proven (${describePathList(preExistingDirtyCandidates)}).`,
    );
  }

  for (const validationEntry of normalizedManifest.validations) {
    if (validationEntry.required && validationEntry.status !== "passed") {
      errors.push(
        `Required validation ${validationEntry.name} is ${validationEntry.status}.`,
      );
    }
  }

  const unexpectedChangedPaths = repositoryState.currentChangedPaths.filter(
    currentPath =>
      !isCoveredByAny(currentPath, baselinePaths) &&
      !isCoveredByAny(currentPath, candidatePaths),
  );

  if (unexpectedChangedPaths.length > 0) {
    errors.push(
      `Unexpected changed paths outside baselineStatus plus candidatePaths (${describePathList(unexpectedChangedPaths)}).`,
    );
  }

  const denylistedCurrentCandidatePaths = repositoryState.currentChangedPaths.filter(
    currentPath =>
      isCoveredByAny(currentPath, candidatePaths) &&
      getDenylistReasons(currentPath).length > 0,
  );

  if (denylistedCurrentCandidatePaths.length > 0) {
    errors.push(
      `Current candidate changes include denylisted paths (${describePathList(denylistedCurrentCandidatePaths)}).`,
    );
  }

  const proposedStagingPaths = uniqueSorted(
    repositoryState.currentChangedPaths.filter(
      currentPath => isCoveredByAny(currentPath, candidatePaths),
    ),
  );
  const resolvedCommitConvention = resolveCommitConvention(
    normalizedManifest.commitConvention,
    repositoryState.recentSubjects,
    normalizedManifest.externalRef,
  );
  const commitSubject = buildCommitSubject(
    normalizedManifest.externalRef,
    resolvedCommitConvention,
    proposedStagingPaths.length > 0 ? proposedStagingPaths : candidatePaths,
  );
  const result = {
    baselineHead: normalizedManifest.baselineHead,
    baselinePaths,
    currentBranch: repositoryState.currentBranch,
    currentChangedPaths: repositoryState.currentChangedPaths,
    currentHead: repositoryState.currentHead,
    errors,
    expectedBranch: normalizedManifest.expectedBranch,
    externalRef: normalizedManifest.externalRef,
    manifestPath: normalizedManifest.manifestPath,
    mode: "prepare",
    ok: errors.length === 0,
    proposedCommitSubject: commitSubject,
    proposedStagingPaths,
    repositoryRoot: normalizedManifest.repositoryRoot,
    resolvedCommitConvention,
  };

  if (errors.length > 0) {
    throw new ExplicitError(
      "Checkpoint preflight failed.",
      errors,
      result,
    );
  }

  return result;
};

const prepareFromManifestPath = async manifestPath => {
  const { absolutePath, value } = await readJsonFile(manifestPath);
  const normalizedManifest = normalizeManifest(value, absolutePath);
  return verifyCheckpointManifest(normalizedManifest);
};

const verifyStagedManifest = async normalizedManifest => {
  const preflightResult = await verifyCheckpointManifest(normalizedManifest);
  const stagedPaths = getStagedPaths(normalizedManifest.repositoryRoot);
  const errors = [];

  for (const stagedPath of stagedPaths) {
    if (!isCoveredByAny(stagedPath, preflightResult.proposedStagingPaths)) {
      errors.push(
        `Staged path ${stagedPath} is outside proposedStagingPaths (${describePathList(preflightResult.proposedStagingPaths)}).`,
      );
    }

    if (!isCoveredByAny(stagedPath, normalizedManifest.candidatePaths.map(
      candidateEntry => candidateEntry.path,
    ))) {
      errors.push(`Staged path ${stagedPath} is outside candidatePaths.`);
    }

    if (!isCoveredByAny(stagedPath, normalizedManifest.allowedWritePaths)) {
      errors.push(`Staged path ${stagedPath} is outside allowedWritePaths.`);
    }

    const denylistReasons = getDenylistReasons(stagedPath);
    if (denylistReasons.length > 0) {
      errors.push(
        `Staged path ${stagedPath} is denylisted (${denylistReasons.join(", ")}).`,
      );
    }
  }

  if (
    describePathList(stagedPaths) !==
    describePathList(preflightResult.proposedStagingPaths)
  ) {
    errors.push(
      `Staged paths must exactly equal proposedStagingPaths (${describePathList(preflightResult.proposedStagingPaths)}), found ${describePathList(stagedPaths)}.`,
    );
  }

  const stagedDiffText = getStagedDiffText(normalizedManifest.repositoryRoot);
  const stagedDiffSha256 = hashText(JSON.stringify({
    diff: stagedDiffText,
    stagedPaths,
  }));
  const result = {
    ...preflightResult,
    errors,
    mode: "verify-staged",
    ok: errors.length === 0,
    stagedDiffSha256,
    stagedPaths,
  };

  if (errors.length > 0) {
    throw new ExplicitError(
      "Staged checkpoint verification failed.",
      errors,
      result,
    );
  }

  return result;
};

const resolveExpectedCommittedPaths = async normalizedManifest => {
  if (normalizedManifest.expectedCommittedPaths !== null) {
    return {
      paths: uniqueSorted(normalizedManifest.expectedCommittedPaths),
      source: "manifest",
    };
  }

  const repositoryState = await getRepositoryState(normalizedManifest.repositoryRoot);
  const candidatePaths = normalizedManifest.candidatePaths.map(
    candidateEntry => candidateEntry.path,
  );
  const proposedPaths = uniqueSorted(
    repositoryState.currentChangedPaths.filter(
      currentPath => isCoveredByAny(currentPath, candidatePaths),
    ),
  );

  if (proposedPaths.length === 0) {
    throw new ExplicitError(
      "Commit verification requires explicit committed paths.",
      [
        "expectedCommittedPaths is required when the current worktree no longer exposes proposed candidate changes.",
      ],
      {
        mode: "verify-commit",
        ok: false,
      },
    );
  }

  return {
    paths: proposedPaths,
    source: "current-proposed",
  };
};

const verifyCommitManifest = async (normalizedManifest, commitSha) => {
  if (!/^[a-f0-9]{7,64}$/i.test(commitSha)) {
    throw new ExplicitError(
      "Commit verification failed.",
      ["commit-sha must be a 7-64 character Git commit id."],
      {
        commitSha,
        mode: "verify-commit",
        ok: false,
      },
    );
  }

  const normalizedCommitSha = commitSha.trim();
  const errors = [];
  const repositoryState = await getRepositoryState(normalizedManifest.repositoryRoot);
  const expectedCommitted = await resolveExpectedCommittedPaths(normalizedManifest);
  const candidatePaths = normalizedManifest.candidatePaths.map(
    candidateEntry => candidateEntry.path,
  );
  const resolvedCommitConvention = resolveCommitConvention(
    normalizedManifest.commitConvention,
    repositoryState.recentSubjects,
    normalizedManifest.externalRef,
  );
  const subjectPrefix = buildCommitSubjectPrefix(
    normalizedManifest.externalRef,
    resolvedCommitConvention,
  );
  const commitExists = runGit(
    normalizedManifest.repositoryRoot,
    ["cat-file", "-e", `${normalizedCommitSha}^{commit}`],
    { allowFailure: true },
  );

  if (commitExists.status !== 0) {
    errors.push(`Commit ${normalizedCommitSha} does not exist.`);
  }

  const branchExists = runGit(
    normalizedManifest.repositoryRoot,
    ["rev-parse", "--verify", `refs/heads/${normalizedManifest.expectedBranch}`],
    { allowFailure: true },
  );

  if (branchExists.status !== 0) {
    errors.push(`Expected branch ${normalizedManifest.expectedBranch} does not exist.`);
  }

  if (errors.length === 0) {
    const commitOnBranch = runGit(
      normalizedManifest.repositoryRoot,
      [
        "merge-base",
        "--is-ancestor",
        normalizedCommitSha,
        `refs/heads/${normalizedManifest.expectedBranch}`,
      ],
      { allowFailure: true },
    );

    if (commitOnBranch.status !== 0) {
      errors.push(
        `Commit ${normalizedCommitSha} is not reachable from ${normalizedManifest.expectedBranch}.`,
      );
    }

    if (normalizedCommitSha === normalizedManifest.baselineHead) {
      errors.push("Commit to verify must not equal baselineHead.");
    }

    const descendedFromBaseline = runGit(
      normalizedManifest.repositoryRoot,
      [
        "merge-base",
        "--is-ancestor",
        normalizedManifest.baselineHead,
        normalizedCommitSha,
      ],
      { allowFailure: true },
    );

    if (descendedFromBaseline.status !== 0) {
      errors.push(
        `Commit ${normalizedCommitSha} is not descended from baselineHead ${normalizedManifest.baselineHead}.`,
      );
    }
  }

  const commitSubject = errors.length === 0 ?
    getCommitSubject(normalizedManifest.repositoryRoot, normalizedCommitSha) :
    "";
  const committedPaths = errors.length === 0 ?
    getCommitChangedPaths(normalizedManifest.repositoryRoot, normalizedCommitSha) :
    [];

  for (const committedPath of committedPaths) {
    if (!isCoveredByAny(committedPath, candidatePaths)) {
      errors.push(`Committed path ${committedPath} is outside candidatePaths.`);
    }

    if (!isCoveredByAny(committedPath, normalizedManifest.allowedWritePaths)) {
      errors.push(`Committed path ${committedPath} is outside allowedWritePaths.`);
    }

    const denylistReasons = getDenylistReasons(committedPath);
    if (denylistReasons.length > 0) {
      errors.push(
        `Committed path ${committedPath} is denylisted (${denylistReasons.join(", ")}).`,
      );
    }
  }

  if (describePathList(committedPaths) !== describePathList(expectedCommitted.paths)) {
    errors.push(
      `Committed paths must exactly equal expected committed paths (${describePathList(expectedCommitted.paths)}), found ${describePathList(committedPaths)}.`,
    );
  }

  if (commitSubject.length > 0 && !commitSubject.startsWith(subjectPrefix)) {
    errors.push(
      `Commit subject must start with ${JSON.stringify(subjectPrefix)}, found ${JSON.stringify(commitSubject)}.`,
    );
  }

  for (const validationEntry of normalizedManifest.validations) {
    if (validationEntry.required && validationEntry.status !== "passed") {
      errors.push(
        `Required validation ${validationEntry.name} is ${validationEntry.status}.`,
      );
    }
  }

  const result = {
    baselineHead: normalizedManifest.baselineHead,
    commitSha: normalizedCommitSha,
    committedPaths,
    errors,
    expectedBranch: normalizedManifest.expectedBranch,
    expectedCommittedPaths: expectedCommitted.paths,
    expectedCommittedPathsSource: expectedCommitted.source,
    externalRef: normalizedManifest.externalRef,
    manifestPath: normalizedManifest.manifestPath,
    mode: "verify-commit",
    ok: errors.length === 0,
    proposedCommitSubject: buildCommitSubject(
      normalizedManifest.externalRef,
      resolvedCommitConvention,
      expectedCommitted.paths,
    ),
    repositoryRoot: normalizedManifest.repositoryRoot,
    resolvedCommitConvention,
    verifiedCommitSubject: commitSubject,
  };

  if (errors.length > 0) {
    throw new ExplicitError(
      "Committed checkpoint verification failed.",
      errors,
      result,
    );
  }

  return result;
};

const writeRepoFile = async (repositoryRoot, relativePath, content) => {
  const normalizedRelativePath = normalizeRelativePathText(relativePath, "self-test path");
  const absolutePath = path.join(
    repositoryRoot,
    ...normalizedRelativePath.split("/"),
  );

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
};

const commitAll = (repositoryRoot, subject) => {
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, [
    "-c",
    "user.name=Verify Checkpoint Self Test",
    "-c",
    "user.email=verify-checkpoint-self-test@example.invalid",
    "commit",
    "-m",
    subject,
  ]);
};

const createSelfTestRepository = async repositoryRoot => {
  await mkdir(repositoryRoot, { recursive: true });
  runGit(repositoryRoot, ["init"]);
  await writeRepoFile(repositoryRoot, "README.md", "# Self test\n");
  await writeRepoFile(repositoryRoot, "src/feature.txt", "baseline feature\n");
  await writeRepoFile(repositoryRoot, "docs/notes.md", "baseline notes\n");
  commitAll(repositoryRoot, "TP522001 Seed self-test repo");
  runGit(repositoryRoot, ["branch", "-M", "main"]);
  runGit(repositoryRoot, ["checkout", "-b", "feature/tp522512"]);
  await writeRepoFile(repositoryRoot, "src/feature.txt", "branch baseline\n");
  commitAll(repositoryRoot, "TP522002 Establish migration baseline");

  return {
    baselineHead: runGit(repositoryRoot, ["rev-parse", "--verify", "HEAD"]).stdout.trim(),
    expectedBranch: "feature/tp522512",
  };
};

const expectSuccess = async (name, manifestFactory, assertion) => {
  const manifest = await manifestFactory();
  const normalizedManifest = normalizeManifest(manifest, manifest.__manifestPath);
  const result = await verifyCheckpointManifest(normalizedManifest);
  await assertion(result);
  return {
    error: null,
    name,
    ok: true,
  };
};

const expectFailure = async (name, manifestFactory, expectedMessage) => {
  const manifest = await manifestFactory();

  try {
    const normalizedManifest = normalizeManifest(manifest, manifest.__manifestPath);
    await verifyCheckpointManifest(normalizedManifest);
  } catch (error) {
    const errors = error instanceof ExplicitError ?
      error.errors :
      [error.message];

    if (!errors.some(message => message.includes(expectedMessage))) {
      throw new Error(
        `${name} failed for the wrong reason: ${errors.join(" | ")}`,
      );
    }

    return {
      error: null,
      name,
      ok: true,
    };
  }

  throw new Error(`${name} unexpectedly passed.`);
};

const expectSuccessFromCallback = async (name, callback) => {
  await callback();
  return {
    error: null,
    name,
    ok: true,
  };
};

const runSelfTest = async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "verify-checkpoint-self-test-"),
  );

  try {
    const caseRoot = path.join(temporaryRoot, "cases");
    const safeCase = async () => {
      const repositoryRoot = path.join(caseRoot, "safe-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "docs/notes.md", "baseline notes changed\n");
      await writeRepoFile(repositoryRoot, "src/feature.txt", "candidate delta\n");

      return {
        __manifestPath: path.join(repositoryRoot, "safe-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [
          { path: "docs/notes.md", status: " M" },
        ],
        candidatePaths: [
          { path: "src/feature.txt" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const denylistedCase = async () => {
      const repositoryRoot = path.join(caseRoot, "denylisted-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, ".env.local", "SECRET=value\n");

      return {
        __manifestPath: path.join(repositoryRoot, "denylisted-case.manifest.json"),
        allowedWritePaths: ["."],
        baselineHead,
        baselineStatus: [],
        candidatePaths: [
          { path: ".env.local" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const outsideAllowlistCase = async () => {
      const repositoryRoot = path.join(caseRoot, "outside-allowlist-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "scripts/helper.js", "console.log('x');\n");

      return {
        __manifestPath: path.join(repositoryRoot, "outside-allowlist-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [],
        candidatePaths: [
          { path: "scripts/helper.js" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const dirtyCandidateCase = async () => {
      const repositoryRoot = path.join(caseRoot, "dirty-candidate-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "src/feature.txt", "dirty before migration\n");

      return {
        __manifestPath: path.join(repositoryRoot, "dirty-candidate-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [
          { path: "src/feature.txt", status: " M" },
        ],
        candidatePaths: [
          { path: "src/feature.txt" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const failedValidationCase = async () => {
      const repositoryRoot = path.join(caseRoot, "failed-validation-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "src/feature.txt", "candidate delta\n");

      return {
        __manifestPath: path.join(repositoryRoot, "failed-validation-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [],
        candidatePaths: [
          { path: "src/feature.txt" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "failed" },
        ],
      };
    };
    const wrongBranchCase = async () => {
      const repositoryRoot = path.join(caseRoot, "wrong-branch-case");
      const { baselineHead } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "src/feature.txt", "candidate delta\n");

      return {
        __manifestPath: path.join(repositoryRoot, "wrong-branch-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [],
        candidatePaths: [
          { path: "src/feature.txt" },
        ],
        expectedBranch: "feature/other-ticket",
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const stagedPassCase = async () => {
      const repositoryRoot = path.join(caseRoot, "staged-pass-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "docs/notes.md", "baseline notes changed\n");
      await writeRepoFile(repositoryRoot, "src/feature.txt", "candidate staged delta\n");
      runGit(repositoryRoot, ["add", "src/feature.txt"]);

      return {
        __manifestPath: path.join(repositoryRoot, "staged-pass-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [
          { path: "docs/notes.md", status: " M" },
        ],
        candidatePaths: [
          { path: "src/feature.txt" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const stagedFailCase = async () => {
      const repositoryRoot = path.join(caseRoot, "staged-fail-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "docs/notes.md", "baseline notes changed\n");
      await writeRepoFile(repositoryRoot, "src/feature.txt", "candidate staged delta\n");
      runGit(repositoryRoot, ["add", "src/feature.txt", "docs/notes.md"]);

      return {
        __manifestPath: path.join(repositoryRoot, "staged-fail-case.manifest.json"),
        allowedWritePaths: ["src"],
        baselineHead,
        baselineStatus: [
          { path: "docs/notes.md", status: " M" },
        ],
        candidatePaths: [
          { path: "src/feature.txt" },
        ],
        expectedBranch,
        externalRef: "TP522512",
        repositoryRoot,
        validations: [
          { name: "targeted-tests", required: true, status: "passed" },
        ],
      };
    };
    const commitPassCase = async () => {
      const repositoryRoot = path.join(caseRoot, "commit-pass-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "src/feature.txt", "committed candidate delta\n");
      runGit(repositoryRoot, ["add", "src/feature.txt"]);
      commitAll(
        repositoryRoot,
        "TP522512 checkpoint: update src/feature.txt",
      );

      return {
        commitSha: runGit(
          repositoryRoot,
          ["rev-parse", "--verify", "HEAD"],
        ).stdout.trim(),
        manifest: {
          __manifestPath: path.join(repositoryRoot, "commit-pass-case.manifest.json"),
          allowedWritePaths: ["src"],
          baselineHead,
          baselineStatus: [],
          candidatePaths: [
            { path: "src" },
          ],
          expectedBranch,
          expectedCommittedPaths: [
            "src/feature.txt",
          ],
          externalRef: "TP522512",
          repositoryRoot,
          validations: [
            { name: "targeted-tests", required: true, status: "passed" },
          ],
        },
      };
    };
    const commitFailCase = async () => {
      const repositoryRoot = path.join(caseRoot, "commit-fail-case");
      const { baselineHead, expectedBranch } = await createSelfTestRepository(repositoryRoot);
      await writeRepoFile(repositoryRoot, "src/feature.txt", "committed candidate delta\n");
      runGit(repositoryRoot, ["add", "src/feature.txt"]);
      commitAll(
        repositoryRoot,
        "checkpoint: TP522512 update src/feature.txt",
      );

      return {
        commitSha: runGit(
          repositoryRoot,
          ["rev-parse", "--verify", "HEAD"],
        ).stdout.trim(),
        manifest: {
          __manifestPath: path.join(repositoryRoot, "commit-fail-case.manifest.json"),
          allowedWritePaths: ["src"],
          baselineHead,
          baselineStatus: [],
          candidatePaths: [
            { path: "src" },
          ],
          expectedBranch,
          expectedCommittedPaths: [
            "src/feature.txt",
          ],
          externalRef: "TP522512",
          repositoryRoot,
          validations: [
            { name: "targeted-tests", required: true, status: "passed" },
          ],
        },
      };
    };

    const caseResults = [];
    caseResults.push(await expectSuccess(
      "safe case",
      safeCase,
      async result => {
        if (result.proposedStagingPaths.join(",") !== "src/feature.txt") {
          throw new Error(
            `safe case returned unexpected staging paths: ${result.proposedStagingPaths.join(", ")}`,
          );
        }

        if (result.resolvedCommitConvention.kind !== "ticket-prefix") {
          throw new Error("safe case did not detect ticket-prefix commit convention.");
        }

        if (result.proposedCommitSubject !== "TP522512 checkpoint: update src/feature.txt") {
          throw new Error(
            `safe case returned unexpected commit subject: ${result.proposedCommitSubject}`,
          );
        }
      },
    ));
    caseResults.push(await expectFailure(
      "denylisted case",
      denylistedCase,
      "denylisted",
    ));
    caseResults.push(await expectFailure(
      "outside allowlist case",
      outsideAllowlistCase,
      "outside allowedWritePaths",
    ));
    caseResults.push(await expectFailure(
      "pre-existing dirty candidate case",
      dirtyCandidateCase,
      "Pre-existing dirty candidate paths require deltaIsolation: proven",
    ));
    caseResults.push(await expectFailure(
      "failed validation case",
      failedValidationCase,
      "Required validation targeted-tests is failed",
    ));
    caseResults.push(await expectFailure(
      "wrong branch case",
      wrongBranchCase,
      "Expected branch feature/other-ticket but found feature/tp522512",
    ));
    caseResults.push(await expectSuccessFromCallback(
      "verify-staged pass case",
      async () => {
        const manifest = await stagedPassCase();
        const normalizedManifest = normalizeManifest(
          manifest,
          manifest.__manifestPath,
        );
        const result = await verifyStagedManifest(normalizedManifest);

        if (result.stagedPaths.join(",") !== "src/feature.txt") {
          throw new Error(
            `verify-staged pass case returned unexpected staged paths: ${result.stagedPaths.join(", ")}`,
          );
        }

        if (!/^[a-f0-9]{64}$/.test(result.stagedDiffSha256)) {
          throw new Error("verify-staged pass case returned an invalid SHA-256.");
        }
      },
    ));
    caseResults.push(await expectSuccessFromCallback(
      "verify-staged fail case",
      async () => {
        const manifest = await stagedFailCase();
        const normalizedManifest = normalizeManifest(
          manifest,
          manifest.__manifestPath,
        );

        try {
          await verifyStagedManifest(normalizedManifest);
        } catch (error) {
          const errors = error instanceof ExplicitError ? error.errors : [error.message];
          if (!errors.some(message => message.includes("Staged paths must exactly equal proposedStagingPaths"))) {
            throw new Error(
              `verify-staged fail case failed for the wrong reason: ${errors.join(" | ")}`,
            );
          }
          return;
        }

        throw new Error("verify-staged fail case unexpectedly passed.");
      },
    ));
    caseResults.push(await expectSuccessFromCallback(
      "verify-commit pass case",
      async () => {
        const { commitSha, manifest } = await commitPassCase();
        const normalizedManifest = normalizeManifest(
          manifest,
          manifest.__manifestPath,
        );
        const result = await verifyCommitManifest(normalizedManifest, commitSha);

        if (result.committedPaths.join(",") !== "src/feature.txt") {
          throw new Error(
            `verify-commit pass case returned unexpected committed paths: ${result.committedPaths.join(", ")}`,
          );
        }

        if (result.expectedCommittedPathsSource !== "manifest") {
          throw new Error("verify-commit pass case did not use manifest committed paths.");
        }
      },
    ));
    caseResults.push(await expectSuccessFromCallback(
      "verify-commit fail case",
      async () => {
        const { commitSha, manifest } = await commitFailCase();
        const normalizedManifest = normalizeManifest(
          manifest,
          manifest.__manifestPath,
        );

        try {
          await verifyCommitManifest(normalizedManifest, commitSha);
        } catch (error) {
          const errors = error instanceof ExplicitError ? error.errors : [error.message];
          if (!errors.some(message => message.includes("Commit subject must start with"))) {
            throw new Error(
              `verify-commit fail case failed for the wrong reason: ${errors.join(" | ")}`,
            );
          }
          return;
        }

        throw new Error("verify-commit fail case unexpectedly passed.");
      },
    ));

    return {
      cases: caseResults,
      cleanup: "completed",
      mode: "self-test",
      ok: true,
    };
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
};

const printJson = value => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const runCli = async argumentsList => {
  if (argumentsList.length === 1 && argumentsList[0] === "--self-test") {
    return runSelfTest();
  }

  if (argumentsList.length === 2 && argumentsList[0] === "--prepare") {
    return prepareFromManifestPath(argumentsList[1]);
  }

  if (argumentsList.length === 2 && argumentsList[0] === "--verify-staged") {
    const { absolutePath, value } = await readJsonFile(argumentsList[1]);
    const normalizedManifest = normalizeManifest(value, absolutePath);
    return verifyStagedManifest(normalizedManifest);
  }

  if (argumentsList.length === 3 && argumentsList[0] === "--verify-commit") {
    const { absolutePath, value } = await readJsonFile(argumentsList[1]);
    const normalizedManifest = normalizeManifest(value, absolutePath);
    return verifyCommitManifest(normalizedManifest, argumentsList[2]);
  }

  throw new ExplicitError(
    "Usage validation failed.",
    [
      "Usage: node .\\scripts\\verify-checkpoint.mjs --prepare <manifest.json>",
      "   or: node .\\scripts\\verify-checkpoint.mjs --verify-staged <manifest.json>",
      "   or: node .\\scripts\\verify-checkpoint.mjs --verify-commit <manifest.json> <commit-sha>",
      "   or: node .\\scripts\\verify-checkpoint.mjs --self-test",
    ],
    {
      mode: "usage",
      ok: false,
    },
  );
};

try {
  const result = await runCli(process.argv.slice(2));
  printJson(result);
} catch (error) {
  const failure = {
    errors: error instanceof ExplicitError ? error.errors : [error.message],
    mode: error instanceof ExplicitError ?
      error.result.mode ?? "prepare" :
      "prepare",
    ok: false,
    ...(
      error instanceof ExplicitError ?
        error.result :
        {}
    ),
  };

  printJson(failure);
  process.exitCode = 1;
}
