import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkStructure, createResolver, loadStructure } from "./angular-structure.mjs";

// Which slices to cut is judgement; which files a slice leans on is not. This
// script owns the second half, so flow-plan counts the same way on every run
// and flow-baseline starts from numbers nobody retyped.

const labDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const usage = `Usage:
  node scripts/migration-map.mjs --init --product-root <dir> --out <map.json> --run-id <id> --skill-version <x.y.z>
  node scripts/migration-map.mjs --seed --previous <map.json> --out <map.json> --run-id <id> --skill-version <x.y.z> --lab-root <dir>
  node scripts/migration-map.mjs --measure --product-root <dir> --map <map.json> [--lab-root <dir>] [--out <metrics.json>] [--structure <angular-structure.json>] [--threshold <n>] [--react-packages <a,b>]

Init writes a first migration-map.json with one feature per folder under
src/features that holds source other than tests and stories, and no slices.

Seed writes the next map from the previous one: every field carried over,
supersedes pointing at the previous map, the recommendation emptied and the
metrics pointer removed until --measure runs. A slice with a PASS
verification-result for its flowId under <lab-root>\\runs becomes landed with
that file as evidence; a candidate with a flow-contract there becomes
in-progress.

Measure reads the product once, value imports only, tests and stories left
out. It writes migration-metrics.json beside the map, or --out: per unit the
file counts and framework-agnostic share, every file with --threshold (10) or
more importers from other units and whether it is React-bound, and per mapped
slice the React-bound files outside its paths that it imports, each with the
prerequisite and Angular counterpart the map records for it, and every file
under an angular folder. It applies the Angular target structure, by default
docs\\angular-structure.json in this lab, to every file under src, tests
included, and records the structure file, the files no rule matches and the
targets two or more files move to; per prerequisite its target and whether a
built counterpart drifted from it; per slice the Angular folders its files move
to. It then points the map's metrics and repository at what it measured, and
prints the unmapped feature folders, the slices whose paths match nothing, the
React-bound files two or more slices share that the map records as no
prerequisite and no slice owns, the Angular files, the count of unmatched files
and collisions, and the drifted prerequisites.

A file is React-bound when it is .tsx, value-imports a --react-packages
package (react, react-dom, styled-components, @auth0/auth0-react) or
value-imports a React-bound file; a test or story is React-bound when a file
it value-imports is. Product paths are relative with forward slashes; a
pointer is relative to --lab-root when its file lies inside it.

Never writes inside the product. Init and seed never overwrite.

Options:
  --self-test   run the built-in checks
`;

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
const defaultReactPackages = ["react", "react-dom", "styled-components", "@auth0/auth0-react"];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^\d+\.\d+\.\d+$/;

// A test or story that imports a file does not make it shared infrastructure.
const isTestOrStory = file =>
  /\.(test|spec|stories)\.[tj]sx?$/.test(file) || /[\\/]__tests__[\\/]/.test(file);

const toProductPath = value =>
  value.replaceAll("\\", "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "");

const covers = (basePath, candidatePath) =>
  candidatePath === basePath || candidatePath.startsWith(`${basePath}/`);

const sha256 = raw => createHash("sha256").update(raw).digest("hex");

const readJsonFile = async filePath =>
  JSON.parse((await readFile(filePath, "utf8")).replace(/^﻿/, ""));

const exists = async filePath => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const walk = (directory, files = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (sourceExtensions.includes(path.extname(entry.name))) files.push(full);
  }
  return files;
};

const readRevision = productRoot => {
  const head = spawnSync("git", ["-C", productRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (head.status !== 0) {
    throw new Error(`${productRoot} is not a Git repository with a commit: ${head.stderr.trim()}`);
  }
  return head.stdout.trim();
};

// Regular expressions, not a TypeScript parser: the lab installs nothing. A
// statement marked type, or a braced clause whose every name is marked type,
// is erased at compile time and so creates no runtime edge.
const extractSpecifiers = text => {
  const value = new Set();
  const typeOnly = new Set();
  for (const pattern of [
    /import\s+["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of text.matchAll(pattern)) value.add(match[1]);
  }
  for (const match of text.matchAll(
    /\b(?:import|export)\s+(type\s+)?([^;]*?)\sfrom\s+["']([^"']+)["']/gs,
  )) {
    const [, typeKeyword, clause, specifier] = match;
    const braced = clause.trim();
    const names = braced.startsWith("{") && braced.endsWith("}") ?
      braced.slice(1, -1).split(",").map(name => name.trim()).filter(Boolean) :
      [];
    if (typeKeyword || (names.length > 0 && names.every(name => /^type\s+\S/.test(name)))) {
      typeOnly.add(specifier);
    } else {
      value.add(specifier);
    }
  }
  for (const specifier of value) typeOnly.delete(specifier);
  return { value: [...value], typeOnly: [...typeOnly] };
};

const resolveInternal = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...sourceExtensions.map(extension => `${base}${extension}`),
    ...sourceExtensions.map(extension => path.join(base, `index${extension}`)),
  ];
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
};

// A unit is a folder under src/features or src/modules, or any other
// top-level folder under src.
const unitOf = productPath => {
  const parts = productPath.split("/").slice(1);
  if (parts.length === 1) return "(src)";
  if (["features", "modules"].includes(parts[0])) {
    return parts.length > 2 ? `${parts[0]}/${parts[1]}` : `${parts[0]}/(loose)`;
  }
  return parts[0];
};

const analyzeProduct = (productRoot, reactPackages) => {
  const sourceRoot = path.join(productRoot, "src");
  const allFiles = walk(sourceRoot);
  const sourceFiles = allFiles.filter(file => !isTestOrStory(file));
  const sourceSet = new Set(sourceFiles);
  const productPath = file => toProductPath(path.relative(productRoot, file));

  const fileData = new Map();
  let typeOnlyImports = 0;
  let unresolvedImports = 0;
  for (const file of sourceFiles) {
    const { value, typeOnly } = extractSpecifiers(readFileSync(file, "utf8"));
    typeOnlyImports += typeOnly.length;
    const internal = new Set();
    const packages = new Set();
    for (const specifier of value) {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveInternal(file, specifier);
        if (!resolved) unresolvedImports += 1;
        else if (sourceSet.has(resolved)) internal.add(resolved);
      } else {
        packages.add(specifier.startsWith("@") ?
          specifier.split("/").slice(0, 2).join("/") :
          specifier.split("/")[0]);
      }
    }
    fileData.set(file, { internal, packages });
  }

  const importedBy = new Map(sourceFiles.map(file => [file, new Set()]));
  for (const [file, data] of fileData) {
    for (const dependency of data.internal) importedBy.get(dependency).add(file);
  }

  // A breadth-first walk from the directly bound files over the reverse graph
  // settles an import cycle correctly whatever order it is entered in.
  const directlyBound = new Set(sourceFiles.filter(file =>
    file.endsWith(".tsx") ||
    [...fileData.get(file).packages].some(name => reactPackages.includes(name))));
  const bound = new Set(directlyBound);
  const queue = [...directlyBound];
  for (let index = 0; index < queue.length; index += 1) {
    for (const importer of importedBy.get(queue[index])) {
      if (!bound.has(importer)) {
        bound.add(importer);
        queue.push(importer);
      }
    }
  }

  return {
    allFiles,
    sourceFiles,
    testAndStoryFileCount: allFiles.length - sourceFiles.length,
    typeOnlyImports,
    unresolvedImports,
    fileData,
    importedBy,
    directlyBound,
    bound,
    productPath,
  };
};

const listFeatureDirectories = (productRoot, graph) => {
  const featuresRoot = path.join(productRoot, "src", "features");
  let entries = [];
  try {
    entries = readdirSync(featuresRoot, { withFileTypes: true }).filter(entry => entry.isDirectory());
  } catch {
    return [];
  }
  const sourcePaths = graph ?
    graph.sourceFiles.map(graph.productPath) :
    walk(featuresRoot)
      .filter(file => !isTestOrStory(file))
      .map(file => toProductPath(path.relative(productRoot, file)));
  return entries
    .map(entry => `src/features/${entry.name}`)
    .filter(directory => sourcePaths.some(file => covers(directory, file)))
    .sort();
};

// What the structure engine needs to know about the product, over every file
// tests included. A test or story is outside the graph, so it takes the
// boundness of the files it imports, which is its subject's.
const structureFacts = graph => {
  const { allFiles, sourceFiles, importedBy, bound, productPath } = graph;
  const fileByProductPath = new Map(allFiles.map(file => [productPath(file), file]));
  const sourceSet = new Set(sourceFiles);
  const filesByFolder = new Map();
  for (const filePath of fileByProductPath.keys()) {
    const folder = path.posix.dirname(filePath);
    if (!filesByFolder.has(folder)) filesByFolder.set(folder, []);
    filesByFolder.get(folder).push(filePath);
  }
  const testBound = new Map();
  return {
    isReactBound: filePath => {
      const file = fileByProductPath.get(filePath);
      if (!file) return false;
      if (sourceSet.has(file)) return bound.has(file);
      if (!testBound.has(file)) {
        const { value } = extractSpecifiers(readFileSync(file, "utf8"));
        testBound.set(file, value.some(specifier =>
          (specifier.startsWith(".") || specifier.startsWith("/")) && bound.has(resolveInternal(file, specifier))));
      }
      return testBound.get(file);
    },
    importersOf: filePath => [...importedBy.get(fileByProductPath.get(filePath)) ?? []].map(productPath),
    siblingsOf: filePath => filesByFolder.get(path.posix.dirname(filePath)) ?? [],
  };
};

const buildMetrics = (graph, map, options) => {
  const { sourceFiles, fileData, importedBy, directlyBound, bound, productPath } = graph;
  const resolver = createResolver(options.structure.spec, structureFacts(graph));
  const allPaths = graph.allFiles.map(productPath);
  const structure = checkStructure(resolver, allPaths);
  const placedInRoot = placed =>
    (placed.outcome === "move" || placed.outcome === "merge") && covers(resolver.root, placed.target);
  // The folders a slice's files move to, a folder inside another left out.
  const angularTargets = sliceBases => {
    const folders = [...new Set(allPaths
      .filter(filePath => sliceBases.some(base => covers(base, filePath)))
      .map(resolver.resolve)
      .filter(placedInRoot)
      .map(placed => path.posix.dirname(placed.target)))].sort();
    return folders.filter(folder => !folders.some(other => other !== folder && covers(other, folder)));
  };
  const unitByFile = new Map(sourceFiles.map(file => [file, unitOf(productPath(file))]));
  const fileByProductPath = new Map(sourceFiles.map(file => [productPath(file), file]));

  const units = new Map();
  const unitEntry = unit => {
    if (!units.has(unit)) {
      units.set(unit, { unit, files: 0, tsxFiles: 0, agnosticFiles: 0, importsIn: 0, importsOut: 0 });
    }
    return units.get(unit);
  };
  for (const file of sourceFiles) {
    const entry = unitEntry(unitByFile.get(file));
    entry.files += 1;
    if (file.endsWith(".tsx")) entry.tsxFiles += 1;
    if (!bound.has(file)) entry.agnosticFiles += 1;
    for (const dependency of fileData.get(file).internal) {
      if (unitByFile.get(dependency) === unitByFile.get(file)) continue;
      entry.importsOut += 1;
      unitEntry(unitByFile.get(dependency)).importsIn += 1;
    }
  }

  const reactBinding = file =>
    directlyBound.has(file) ? "direct" : bound.has(file) ? "transitive" : "none";
  const prerequisiteBySource = new Map(map.prerequisites.map(prerequisite =>
    [toProductPath(prerequisite.reactSource), prerequisite]));
  const counterpart = filePath => {
    const prerequisite = prerequisiteBySource.get(filePath);
    if (!prerequisite) return { prerequisite: null, angular: null };
    const angular = prerequisite.angular.status === "built" ?
      "built" :
      prerequisite.copies.length > 0 ? "copy" : "none";
    return { prerequisite: prerequisite.id, angular };
  };

  const sharedFiles = sourceFiles
    .map(file => {
      const importingUnits = new Set();
      let importers = 0;
      for (const importer of importedBy.get(file)) {
        if (unitByFile.get(importer) === unitByFile.get(file)) continue;
        importers += 1;
        importingUnits.add(unitByFile.get(importer));
      }
      return { file, importers, importingUnits: importingUnits.size };
    })
    .filter(row => row.importers >= options.threshold)
    .sort((left, right) => right.importers - left.importers)
    .map(row => ({
      file: productPath(row.file),
      crossUnitImporters: row.importers,
      importingUnits: row.importingUnits,
      reactBound: reactBinding(row.file),
      ...counterpart(productPath(row.file)),
    }));

  // A file inside another slice's paths is that slice's work, reached through
  // dependsOn, not a prerequisite.
  const ownerOf = filePath =>
    map.slices.find(slice => slice.paths.some(base => covers(toProductPath(base), filePath)))
      ?.flowId ?? null;

  const importingSlices = new Map();
  const slices = map.slices.map(slice => {
    const sliceBases = slice.paths.map(toProductPath);
    const own = sourceFiles.filter(file => sliceBases.some(base => covers(base, productPath(file))));
    const ownSet = new Set(own);
    const imported = new Set();
    for (const file of own) {
      for (const dependency of fileData.get(file).internal) {
        if (!ownSet.has(dependency) && bound.has(dependency)) imported.add(dependency);
      }
    }
    const reactBoundImports = [...imported].map(productPath).sort().map(filePath => {
      if (!importingSlices.has(filePath)) importingSlices.set(filePath, []);
      importingSlices.get(filePath).push(slice.flowId);
      return { file: filePath, ownedBy: ownerOf(filePath), ...counterpart(filePath) };
    });
    return {
      flowId: slice.flowId,
      files: own.length,
      missingPaths: sliceBases.filter(base =>
        !sourceFiles.some(file => covers(base, productPath(file)))),
      angularTargets: angularTargets(sliceBases),
      reactBoundImports,
    };
  });

  const sharedAcrossSlices = [...importingSlices.entries()]
    .filter(([, flowIds]) => flowIds.length >= 2)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([file, flowIds]) => ({
      file,
      sliceCount: flowIds.length,
      slices: flowIds,
      ownedBy: ownerOf(file),
      reactBound: reactBinding(fileByProductPath.get(file)),
      ...counterpart(file),
    }));

  const mappedFeaturePaths = map.features.flatMap(feature => feature.paths.map(toProductPath));

  return {
    generatedAt: new Date().toISOString(),
    productRoot: path.resolve(options.productRoot),
    revision: options.revision,
    reactPackages: options.reactPackages,
    threshold: options.threshold,
    fileTotals: {
      sourceFiles: sourceFiles.length,
      testAndStoryFiles: graph.testAndStoryFileCount,
      reactBoundFiles: bound.size,
      typeOnlyImports: graph.typeOnlyImports,
      unresolvedImports: graph.unresolvedImports,
    },
    structure: {
      path: pointerPath(options.structure.file, options.labRoot),
      sha256: sha256(options.structure.raw),
      root: resolver.root,
      counts: structure.counts,
      unmatched: structure.unmatched,
      collisions: structure.collisions,
    },
    units: [...units.values()]
      .sort((left, right) => left.unit.localeCompare(right.unit))
      .map(({ agnosticFiles, ...entry }) => ({
        ...entry,
        agnosticShare: entry.files ? Number((agnosticFiles / entry.files).toFixed(3)) : 0,
      })),
    featureDirectoriesNotInMap: listFeatureDirectories(options.productRoot, graph)
      .filter(directory => !mappedFeaturePaths.some(base => covers(base, directory) || covers(directory, base))),
    angularFiles: sourceFiles.map(productPath).filter(filePath => filePath.includes("/angular/")).sort(),
    sharedFiles,
    slices,
    sharedAcrossSlices,
    // A built counterpart away from its target drifted: the structure moved,
    // or the counterpart was built before it was decided.
    prerequisites: map.prerequisites.map(prerequisite => {
      const placed = resolver.resolve(toProductPath(prerequisite.reactSource));
      const target = placedInRoot(placed) ? placed.target : null;
      return {
        id: prerequisite.id,
        reactSource: toProductPath(prerequisite.reactSource),
        outcome: placed.outcome,
        target,
        drift: prerequisite.angular.status === "built" && toProductPath(prerequisite.angular.path) !== target,
      };
    }),
  };
};

// Top-level keys in the schema's order, so a rewritten map diffs cleanly.
const mapKeyOrder = [
  "schemaVersion", "artifactType", "skill", "skillVersion", "runId", "repository",
  "supersedes", "metrics", "features", "slices", "prerequisites", "recommendation",
  "decisions", "openQuestions",
];

const serializeMap = value => {
  const ordered = {};
  for (const key of mapKeyOrder) if (Object.hasOwn(value, key)) ordered[key] = value[key];
  for (const key of Object.keys(value)) if (!Object.hasOwn(ordered, key)) ordered[key] = value[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
};

const pointerPath = (filePath, labRoot) => {
  const absolute = path.resolve(filePath);
  if (!labRoot) return absolute;
  const relative = path.relative(path.resolve(labRoot), absolute);
  return relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative;
};

const writeNew = async (filePath, content) => {
  if (await exists(filePath)) throw new Error(`${filePath} already exists; a map is never overwritten.`);
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await writeFile(filePath, content);
};

const requireIdentity = options => {
  if (!slugPattern.test(options["run-id"] ?? "")) throw new Error("--run-id must be a lowercase slug.");
  if (!versionPattern.test(options["skill-version"] ?? "")) {
    throw new Error("--skill-version must look like 0.1.0.");
  }
};

const featureId = name =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase().replace(/^-+|-+$/g, "");

const initMap = async options => {
  requireIdentity(options);
  for (const name of ["product-root", "out"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }
  const productRoot = path.resolve(options["product-root"]);
  const features = listFeatureDirectories(productRoot)
    .map(directory => ({
      id: featureId(directory.split("/").at(-1)),
      title: directory.split("/").at(-1),
      paths: [directory],
    }))
    .filter(feature => feature.id);
  await writeNew(options.out, serializeMap({
    schemaVersion: 1,
    artifactType: "migration-map",
    skill: "flow-plan",
    skillVersion: options["skill-version"],
    runId: options["run-id"],
    repository: { root: productRoot, revision: readRevision(productRoot) },
    features,
    slices: [],
    prerequisites: [],
    recommendation: { options: [] },
    decisions: [],
    openQuestions: [],
  }));
  return { out: path.resolve(options.out), features: features.map(feature => feature.id) };
};

const scanRuns = async labRoot => {
  const runsDirectory = path.join(path.resolve(labRoot), "runs");
  const passes = new Map();
  const started = new Set();
  let directories = [];
  try {
    directories = (await readdir(runsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const directory of directories) {
    const directoryPath = path.join(runsDirectory, directory.name);
    for (const file of await readdir(directoryPath)) {
      const isVerification = /^verification-result(?:-\d+)?\.json$/.test(file);
      if (!isVerification && file !== "flow-contract.json") continue;
      const filePath = path.join(directoryPath, file);
      let value;
      try {
        value = await readJsonFile(filePath);
      } catch {
        continue;
      }
      if (isVerification && value.artifactType === "verification-result" && value.status === "PASS") {
        const modified = (await stat(filePath)).mtimeMs;
        const previous = passes.get(value.flowId);
        if (!previous || previous.modified < modified) passes.set(value.flowId, { filePath, modified });
      }
      if (value.artifactType === "flow-contract") started.add(value.flowId);
    }
  }
  return { passes, started };
};

const seedMap = async options => {
  requireIdentity(options);
  for (const name of ["previous", "out", "lab-root"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }
  const raw = await readFile(options.previous);
  const previous = JSON.parse(raw.toString("utf8").replace(/^﻿/, ""));
  if (previous.artifactType !== "migration-map") {
    throw new Error(`${options.previous} is not a migration-map.`);
  }
  if (previous.runId === options["run-id"]) throw new Error("--run-id must differ from the previous map's.");

  const next = structuredClone(previous);
  next.skillVersion = options["skill-version"];
  next.runId = options["run-id"];
  next.supersedes = {
    path: pointerPath(options.previous, options["lab-root"]),
    sha256: sha256(raw),
    runId: previous.runId,
  };
  delete next.metrics;
  next.recommendation = { options: [] };

  const { passes, started } = await scanRuns(options["lab-root"]);
  const landed = [];
  const inProgress = [];
  for (const slice of next.slices) {
    if (slice.status === "landed") continue;
    const pass = passes.get(slice.flowId);
    if (pass) {
      slice.status = "landed";
      slice.evidence = {
        path: pointerPath(pass.filePath, options["lab-root"]),
        sha256: sha256(await readFile(pass.filePath)),
      };
      landed.push(slice.flowId);
    } else if (slice.status === "candidate" && started.has(slice.flowId)) {
      slice.status = "in-progress";
      inProgress.push(slice.flowId);
    }
  }

  await writeNew(options.out, serializeMap(next));
  return { out: path.resolve(options.out), landed, inProgress };
};

const measureMap = async options => {
  for (const name of ["product-root", "map"]) {
    if (!options[name]) throw new Error(`--${name} is required.\n\n${usage}`);
  }
  const productRoot = path.resolve(options["product-root"]);
  const mapPath = path.resolve(options.map);
  const map = await readJsonFile(mapPath);
  if (map.artifactType !== "migration-map") throw new Error(`${mapPath} is not a migration-map.`);
  const threshold = options.threshold === undefined ? 10 : Number(options.threshold);
  if (!Number.isInteger(threshold) || threshold < 1) throw new Error("--threshold must be a positive integer.");
  const reactPackages = options["react-packages"] ?
    options["react-packages"].split(",").map(name => name.trim()).filter(Boolean) :
    defaultReactPackages;

  const structureFile = path.resolve(options.structure ?? path.join(labDirectory, "docs", "angular-structure.json"));
  const structure = { file: structureFile, raw: await readFile(structureFile), spec: loadStructure(structureFile) };

  const revision = readRevision(productRoot);
  const metrics = buildMetrics(analyzeProduct(productRoot, reactPackages), map, {
    productRoot,
    revision,
    reactPackages,
    threshold,
    structure,
    labRoot: options["lab-root"],
  });
  const metricsPath = path.resolve(options.out ?? path.join(path.dirname(mapPath), "migration-metrics.json"));
  const metricsRaw = `${JSON.stringify(metrics, null, 2)}\n`;
  await mkdir(path.dirname(metricsPath), { recursive: true });
  await writeFile(metricsPath, metricsRaw);

  map.repository = { root: productRoot, revision };
  map.metrics = { path: pointerPath(metricsPath, options["lab-root"]), sha256: sha256(metricsRaw) };
  await writeFile(mapPath, serializeMap(map));
  return {
    map: mapPath,
    metrics: metricsPath,
    featureDirectoriesNotInMap: metrics.featureDirectoriesNotInMap,
    slicesWithMissingPaths: metrics.slices.filter(slice => slice.missingPaths.length > 0).map(slice => slice.flowId),
    unmappedShared: metrics.sharedAcrossSlices
      .filter(entry => !entry.prerequisite && !entry.ownedBy)
      .map(({ file, sliceCount, slices }) => ({ file, sliceCount, slices })),
    angularFiles: metrics.angularFiles,
    structure: {
      unmatched: metrics.structure.unmatched.length,
      collisions: metrics.structure.collisions.length,
    },
    driftedPrerequisites: metrics.prerequisites.filter(entry => entry.drift).map(entry => entry.id),
  };
};

const parseArguments = argumentsList => {
  const options = {};
  const flags = new Set(["init", "seed", "measure", "self-test", "help"]);
  const valued = new Set([
    "product-root", "out", "run-id", "skill-version", "previous", "lab-root", "map",
    "threshold", "react-packages", "structure",
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (argument.startsWith("--") && flags.has(name)) {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--") || !valued.has(name)) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} needs a value.\n\n${usage}`);
    options[name] = value;
    index += 1;
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Migration map self-test failed: ${message}`);
};

const runSelfTest = async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "migration-map-"));
  const runGit = (root, args) => {
    const result = spawnSync("git", [
      "-C", root,
      "-c", "user.name=Migration Map Self Test",
      "-c", "user.email=migration-map-self-test@example.invalid",
      ...args,
    ], { encoding: "utf8" });
    assert(result.status === 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  };
  const write = async (root, relativePath, content) => {
    const filePath = path.join(root, ...relativePath.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  };

  try {
    const product = path.join(temporary, "product");
    const files = {
      "src/components/Text.tsx": "export const Text = () => null;\n",
      "src/components/Button.tsx": "export type Props = {};\nexport const useThing = () => 1;\n",
      // A -> B -> A with A -> React: B is bound whichever file is walked first.
      "src/shared/cycleA.ts": "import { b } from \"./cycleB\";\nimport { Text } from \"../components/Text\";\nexport const a = 1;\n",
      "src/shared/cycleB.ts": "import { a } from \"./cycleA\";\nexport const b = 2;\n",
      "src/shared/typeOnly.ts": "import type { Props } from \"../components/Button\";\nexport type Local = Props;\n",
      "src/shared/allTyped.ts": "import { type Props } from \"../components/Button\";\nexport const x = 1;\n",
      "src/shared/mixed.ts": "import { type Props, useThing } from \"../components/Button\";\nexport const y = useThing();\n",
      "src/shared/lonely.ts": "export const lonely = 1;\n",
      "src/shared/__tests__/lonely.test.ts": "import { lonely } from \"../lonely\";\n",
      // No file is named orphan, so this test takes the boundness of what it imports.
      "src/shared/__tests__/orphan.test.ts": "import { b } from \"../cycleB\";\n",
      "src/state/LineStore.ts": "import { useSyncExternalStore } from \"react\";\nexport const useLines = () => 1;\n",
      "src/state/Shared.ts": "import { useSyncExternalStore } from \"react\";\nexport const useShared = () => 1;\n",
      "src/angular/domains/north/store/line.store.ts": "export class LineStore {}\n",
      "src/features/alpha/AlphaForm.tsx": "import { Text } from \"../../components/Text\";\nimport { y } from \"../../shared/mixed\";\nimport { b } from \"../../shared/cycleB\";\nimport { useLines } from \"../../state/LineStore\";\nimport { useShared } from \"../../state/Shared\";\nexport const AlphaForm = () => null;\n",
      "src/components/angular/text.component.ts": "export class TextComponent {}\n",
      "src/features/beta/BetaForm.tsx": "import { Text } from \"../../components/Text\";\nimport { b } from \"../../shared/cycleB\";\nimport { useShared } from \"../../state/Shared\";\nexport const BetaForm = () => null;\n",
      "src/features/__test__/only.test.ts": "export {};\n",
    };
    for (const [relativePath, content] of Object.entries(files)) await write(product, relativePath, content);
    runGit(product, ["init", "-q"]);
    runGit(product, ["add", "."]);
    runGit(product, ["commit", "-q", "-m", "init"]);

    const graph = analyzeProduct(product, defaultReactPackages);
    const isBound = relativePath => graph.bound.has(path.join(product, ...relativePath.split("/")));
    assert(isBound("src/shared/cycleB.ts"), "a file inside an import cycle with React is not bound");
    assert(!isBound("src/shared/typeOnly.ts"), "an import type of a .tsx file makes a file bound");
    assert(!isBound("src/shared/allTyped.ts"), "a braced import whose every name is type makes a file bound");
    assert(isBound("src/shared/mixed.ts"), "a mixed type and value import does not make a file bound");
    assert(graph.importedBy.get(path.join(product, "src", "shared", "lonely.ts")).size === 0,
      "a test file counts as an importer");
    const facts = structureFacts(graph);
    assert(facts.isReactBound("src/shared/__tests__/orphan.test.ts") &&
      !facts.isReactBound("src/shared/__tests__/lonely.test.ts"),
      "a test does not take the boundness of the files it imports");

    const lab = path.join(temporary, "lab");
    const firstMap = path.join(lab, "runs", "2026-01-01-migration-map-1", "migration-map.json");
    const init = await initMap({
      "product-root": product, out: firstMap, "run-id": "migration-map-1", "skill-version": "0.1.0",
    });
    assert(JSON.stringify(init.features) === JSON.stringify(["alpha", "beta"]),
      `init found features ${JSON.stringify(init.features)}; a test-only folder counts as a feature`);
    let refused = false;
    try {
      await initMap({ "product-root": product, out: firstMap, "run-id": "migration-map-1", "skill-version": "0.1.0" });
    } catch (error) {
      refused = error.message.includes("never overwritten");
    }
    assert(refused, "init overwrote an existing map");

    const criterion = { verdict: "unknown", note: "Self-test." };
    const criteria = {
      oneOwner: criterion, noSharedInfrastructure: criterion, measurableNeighbour: criterion, boundedBranches: criterion,
    };
    const first = await readJsonFile(firstMap);
    first.slices = [
      { flowId: "alpha-form", featureId: "alpha", title: "Alpha form", paths: ["src/features/alpha"],
        dependsOn: [], requires: ["text"], criteria, status: "candidate" },
      { flowId: "beta-form", featureId: "beta", title: "Beta form", paths: ["src/features/beta"],
        dependsOn: [], requires: ["text"], criteria, status: "candidate" },
    ];
    first.prerequisites = [
      { id: "text", kind: "shared-component", reactSource: "src/components/Text.tsx",
        angular: { status: "built", path: "src/components/angular/text.component.ts", builtBy: "alpha-form" },
        copies: [] },
      { id: "line-store", kind: "adapter", reactSource: "src/state/LineStore.ts",
        angular: { status: "built", path: "src/angular/domains/north/store/line.store.ts", builtBy: "alpha-form" },
        copies: [] },
      { id: "shared-state", kind: "adapter", reactSource: "src/state/Shared.ts", angular: { status: "none" }, copies: [] },
    ];
    await writeFile(firstMap, serializeMap(first));
    await write(product, "src/features/gamma/Gamma.ts", "export const g = 1;\n");
    const structurePath = path.join(lab, "docs", "angular-structure.json");
    await write(lab, "docs/angular-structure.json", JSON.stringify({
      root: "src/angular",
      preprocess: { islandFolder: "angular" },
      tables: { featureDomain: { alpha: "north", beta: "south" } },
      rules: [
        { id: "state", match: "src/state/**", outcome: "move", nameStyle: "store",
          placeByUsage: { oneDomain: "{root}/domains/{domain}/store/{rest}", otherwise: "{root}/core/store/{rest}" } },
        { id: "components", match: "src/components/**", outcome: "move", target: "{root}/shared/components/{rest}" },
        { id: "shared-agnostic", match: "src/shared/**", when: { reactBound: false }, outcome: "stay" },
        { id: "shared", match: "src/shared/**", outcome: "move", target: "{root}/shared/{rest}" },
        { id: "features", match: "src/features/*/**", outcome: "move",
          domainFrom: { table: "featureDomain", keyFrom: "segment:2" },
          target: "{root}/domains/{domain}/pages/{feature}/{rest}" },
      ],
    }));

    const measured = await measureMap({
      "product-root": product, map: firstMap, "lab-root": lab, structure: structurePath,
    });
    const metrics = await readJsonFile(measured.metrics);
    const alpha = metrics.slices.find(slice => slice.flowId === "alpha-form");
    const beta = metrics.slices.find(slice => slice.flowId === "beta-form");
    assert(alpha.reactBoundImports.some(entry => entry.file === "src/components/Text.tsx" && entry.angular === "built"),
      "a slice's import of a built prerequisite is not marked built");
    assert(beta.reactBoundImports.some(entry => entry.file === "src/shared/cycleB.ts"),
      "a slice's import of a cycle-bound file is missing");
    const text = metrics.sharedAcrossSlices.find(entry => entry.file === "src/components/Text.tsx");
    assert(text?.sliceCount === 2 && text.prerequisite === "text",
      "a file two slices import is not counted as shared across slices");
    assert(JSON.stringify(metrics.featureDirectoriesNotInMap) === JSON.stringify(["src/features/gamma"]),
      `unmapped feature folders ${JSON.stringify(metrics.featureDirectoriesNotInMap)}`);
    assert(JSON.stringify(measured.unmappedShared.map(entry => entry.file)) ===
      JSON.stringify(["src/shared/cycleB.ts"]),
      `a shared file with no prerequisite is not reported, or a mapped one is: ${JSON.stringify(measured.unmappedShared)}`);
    assert(JSON.stringify(measured.angularFiles) === JSON.stringify([
      "src/angular/domains/north/store/line.store.ts", "src/components/angular/text.component.ts",
    ]), `the Angular files are ${JSON.stringify(measured.angularFiles)}`);
    assert(metrics.structure.path === path.join("docs", "angular-structure.json") &&
      metrics.structure.sha256 === sha256(await readFile(structurePath)) && metrics.structure.root === "src/angular",
      "the metrics do not point at the structure they applied");
    assert(JSON.stringify(metrics.structure.unmatched.map(entry => entry.file)) ===
      JSON.stringify(["src/features/__test__/only.test.ts", "src/features/gamma/Gamma.ts"]),
      `the unmatched files are ${JSON.stringify(metrics.structure.unmatched)}`);
    assert(metrics.structure.collisions.length === 1 &&
      metrics.structure.collisions[0].target === "src/angular/shared/components/text.component.ts",
      `the collisions are ${JSON.stringify(metrics.structure.collisions)}`);
    assert(measured.structure.unmatched === 2 && measured.structure.collisions === 1,
      "the unmatched and collision counts are not printed");
    const target = id => metrics.prerequisites.find(entry => entry.id === id);
    assert(target("text").drift && target("text").target === "src/angular/shared/components/text.component.ts",
      "a counterpart built away from its target does not drift");
    assert(!target("line-store").drift && target("line-store").target === "src/angular/domains/north/store/line.store.ts",
      "state one domain uses is not targeted at that domain's store, or its counterpart there drifts");
    assert(!target("shared-state").drift && target("shared-state").target === "src/angular/core/store/shared.store.ts",
      "state two domains use is not targeted at core");
    assert(JSON.stringify(measured.driftedPrerequisites) === JSON.stringify(["text"]),
      "the drifted prerequisites are not printed");
    assert(JSON.stringify(alpha.angularTargets) === JSON.stringify(["src/angular/domains/north/pages/alpha"]),
      `the alpha slice's Angular folders are ${JSON.stringify(alpha.angularTargets)}`);
    const measuredMap = await readJsonFile(firstMap);
    assert(measuredMap.metrics.path === path.join("runs", "2026-01-01-migration-map-1", "migration-metrics.json") &&
      measuredMap.metrics.sha256 === sha256(await readFile(measured.metrics)),
      "the map's metrics pointer is not lab-relative or does not match the file");
    assert(/^[0-9a-f]{40}$/.test(measuredMap.repository.revision), "the map's revision was not recorded");

    const passPath = path.join(lab, "runs", "2026-01-02-alpha-form-baseline-1", "verification-result.json");
    await write(lab, "runs/2026-01-02-alpha-form-baseline-1/verification-result.json",
      JSON.stringify({ artifactType: "verification-result", status: "PASS", flowId: "alpha-form" }));
    await write(lab, "runs/2026-01-03-beta-form-baseline-1/flow-contract.json",
      JSON.stringify({ artifactType: "flow-contract", flowId: "beta-form" }));
    const secondMap = path.join(lab, "runs", "2026-01-04-migration-map-2", "migration-map.json");
    const seeded = await seedMap({
      previous: firstMap, out: secondMap, "run-id": "migration-map-2", "skill-version": "0.1.0", "lab-root": lab,
    });
    const second = await readJsonFile(secondMap);
    const landed = second.slices.find(slice => slice.flowId === "alpha-form");
    assert(landed.status === "landed" && landed.evidence.sha256 === sha256(await readFile(passPath)),
      "a slice with a PASS verification-result did not land with that file as evidence");
    assert(second.slices.find(slice => slice.flowId === "beta-form").status === "in-progress",
      "a candidate with a flow-contract did not become in-progress");
    assert(second.supersedes.sha256 === sha256(await readFile(firstMap)) &&
      second.supersedes.runId === "migration-map-1",
      "supersedes does not point at the previous map");
    assert(!second.metrics && second.recommendation.options.length === 0,
      "a stale metrics pointer or recommendation was carried into the new map");
    assert(JSON.stringify(seeded.landed) === JSON.stringify(["alpha-form"]), "the landed slices were not reported");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Migration map self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  const modes = ["init", "seed", "measure"].filter(mode => options[mode]);
  if (options.help || modes.length !== 1) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
    return;
  }
  const run = { init: initMap, seed: seedMap, measure: measureMap }[modes[0]];
  console.log(JSON.stringify(await run(options), null, 2));
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
