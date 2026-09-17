import { readFile } from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The rendered DOM of this product depends on which robot is loaded: a
// capability gate adds and removes whole sections, and a robot-type branch
// picks a different icon or label. visual-measure refuses a before/after pair
// measured under different robots, which protects the comparison after the
// fact. This answers the question before it: does this set of files render
// differently per robot, so that a baseline has to pin the robot down at all?
//
// Regular expressions, not a TypeScript parser: the lab installs nothing.

const usage = `Usage:
  node scripts/robot-context.mjs --product-root <dir> --path <p> [--path ...] [--json]
  node scripts/robot-context.mjs --self-test

Reports whether the given product files render differently per robot.

The paths are product-relative. flow-plan passes a candidate slice's paths;
flow-baseline passes the files style-sources walked, which is wider on purpose:
a gate often sits in a component the slice renders rather than in the slice
itself.

Two forms count, because only one of them is obvious:
- a capability gate, hasCapability(ERobotCapability.X), which is resolved
  through ROBOT_REGISTRY into the robots that have X and the ones that do not;
- a robot-type branch, activeRobotType or ERobotType.X used in the file, which
  changes what renders without naming a capability at all.

Output:
  robotSensitive  whether anything here renders per robot
  gates           per file, the line and what it branches on
  robotsDiffer    the robot types whose rendering differs, when a capability
                  gate makes that knowable
  note            one line to copy into a migration map's
                  criteria.boundedBranches.note
  indicatorNames  the display names RobotIndicator can show, which is the
                  vocabulary a baseline's expectedRobot has to use

It never names an expectedRobot. The display name depends on robot settings,
not on the type alone -- one ERobotType.Juno shows as Juno Basic or Juno Flex
-- so the only trustworthy source is what the running host displays. A baseline
reads that from its own measurement rather than from a guess made here.

Options:
  --product-root <dir>  the React product repository (required)
  --path <p>            a product-relative file to scan; repeatable (required)
  --json                print the machine-readable result
  --help                print this text
  --self-test           run the built-in checks
`;

const typesFile = "src/shared/types/ERobotType.ts";
const registryFile = "src/app/providers/useRobotManager.tsx";
const indicatorFile = "src/features/navbar/RobotIndicator.tsx";

const readIfPresent = async file => {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
};

// A capability set is written as new Set([...]) and may spread a shared
// constant: Brownie130 and Brownie160 both spread BROWNIE_SHARED_CAPABILITIES.
// Resolving the spread matters, because an unresolved one makes a Brownie look
// like it has no capabilities, which would silently rule out every difference
// between it and a Collector.
const membersOf = (body, sharedSets) => {
  const members = new Set();
  for (const match of body.matchAll(/ERobotCapability\.([A-Za-z0-9_]+)/g)) {
    members.add(match[1]);
  }
  for (const match of body.matchAll(/\.\.\.([A-Z][A-Z0-9_]*)/g)) {
    for (const inherited of sharedSets.get(match[1]) ?? []) members.add(inherited);
  }
  return members;
};

export const parseRobotModel = (typesText, registryText) => {
  const sharedSets = new Map();
  // A shared set is a module-level const holding new Set([...]). It has to be
  // read before the registry, which spreads it.
  for (const match of typesText.matchAll(
    /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*:[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/g)) {
    sharedSets.set(match[1], [...membersOf(match[2], new Map())]);
  }

  const displayNames = [];
  const displayEnum = typesText.match(/export enum ERobotDisplayName\s*\{([\s\S]*?)\}/);
  if (displayEnum) {
    for (const match of displayEnum[1].matchAll(/[A-Za-z0-9_]+\s*=\s*"([^"]*)"/g)) {
      displayNames.push(match[1]);
    }
  }

  const robots = new Map();
  for (const match of registryText.matchAll(
    /\[ERobotType\.([A-Za-z0-9_]+)\]:\s*\{([\s\S]*?)\n\t\}/g)) {
    const body = match[2];
    const capabilities = body.match(/capabilities:\s*new Set\(\[([\s\S]*?)\]\)/);
    robots.set(match[1], capabilities ? [...membersOf(capabilities[1], sharedSets)].sort() : []);
  }

  return { robots, displayNames, sharedSets };
};

const stripComments = text =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// A type annotation is not a branch. A bare ": ERobotType" never matches the
// pattern below anyway, but a type map key does: ROBOT_REGISTRY and
// RobotSettingsByType both write "[ERobotType.X]:" to declare a shape, which
// decides nothing at render time. Anything else that mentions a robot type
// counts, which is the safe direction: a missed gate produces an invalid
// comparison, while a false one only lowers a slice's rank.
const typeUsePattern =
  /(activeRobotType|ERobotType\.[A-Za-z0-9_]+|getRobotDisplayName)/;
const typeMapKeyPattern = /\[ERobotType\.[A-Za-z0-9_]+\]\s*:/;

export const scanFile = (relativePath, text) => {
  const gates = [];
  const lines = stripComments(text).split("\n");
  lines.forEach((line, index) => {
    const number = index + 1;
    for (const match of line.matchAll(/hasCapability\(\s*ERobotCapability\.([A-Za-z0-9_]+)/g)) {
      gates.push({ path: relativePath, line: number, kind: "capability", name: match[1] });
    }
    if (/hasCapability\(/.test(line) && !/ERobotCapability\./.test(line)) {
      gates.push({ path: relativePath, line: number, kind: "capability", name: null });
    }
    if (typeUsePattern.test(line) && !typeMapKeyPattern.test(line)) {
      gates.push({ path: relativePath, line: number, kind: "robot-type", name: null });
    }
  });
  return gates;
};

// Which robots a capability actually separates. A capability every robot has,
// or none has, branches nothing: reporting it would be noise that trains a
// reader to skim the note.
const splitByCapability = (capability, robots) => {
  const withIt = [];
  const withoutIt = [];
  for (const [robot, capabilities] of robots) {
    if (robot === "None") continue;
    (capabilities.includes(capability) ? withIt : withoutIt).push(robot);
  }
  return { withIt: withIt.sort(), withoutIt: withoutIt.sort() };
};

export const buildResult = (scanned, model) => {
  const gates = scanned.flat();
  const capabilityNames = [...new Set(
    gates.filter(gate => gate.kind === "capability" && gate.name).map(gate => gate.name))].sort();

  const capabilities = capabilityNames.map(name => {
    const known = [...model.robots.values()].some(list => list.includes(name));
    return { name, known, ...splitByCapability(name, model.robots) };
  });

  const differing = new Set();
  for (const entry of capabilities) {
    if (entry.withIt.length > 0 && entry.withoutIt.length > 0) {
      for (const robot of [...entry.withIt, ...entry.withoutIt]) differing.add(robot);
    }
  }

  const typeGateFiles = [...new Set(
    gates.filter(gate => gate.kind === "robot-type").map(gate => gate.path))].sort();
  const unresolved = capabilities.filter(entry => !entry.known).map(entry => entry.name);
  const robotSensitive = gates.length > 0;

  return {
    robotSensitive,
    gates,
    capabilities,
    robotsDiffer: [...differing].sort(),
    typeGateFiles,
    unresolvedCapabilities: unresolved,
    indicatorNames: model.displayNames,
    note: buildNote({ robotSensitive, capabilities, differing, typeGateFiles, unresolved }),
  };
};

const buildNote = ({ robotSensitive, capabilities, differing, typeGateFiles, unresolved }) => {
  if (!robotSensitive) {
    return "No capability gate or robot-type branch in these files, so the " +
      "rendering does not depend on the loaded robot.";
  }
  const parts = [];
  const splitting = capabilities.filter(entry => entry.withIt.length > 0 && entry.withoutIt.length > 0);
  if (splitting.length > 0) {
    parts.push(`Capability gates split the rendering: ${splitting
      .map(entry => `${entry.name} (have: ${entry.withIt.join(", ")}; ` +
        `lack: ${entry.withoutIt.join(", ")})`)
      .join("; ")}.`);
  }
  const uniform = capabilities.filter(entry =>
    entry.known && (entry.withIt.length === 0 || entry.withoutIt.length === 0));
  if (uniform.length > 0) {
    parts.push(`Gated on ${uniform.map(entry => entry.name).join(", ")}, which ` +
      "every robot has or none has, so it branches nothing here.");
  }
  if (unresolved.length > 0) {
    parts.push(`${unresolved.join(", ")} is gated on but absent from ` +
      "ROBOT_REGISTRY, so which robots it separates is unknown.");
  }
  if (typeGateFiles.length > 0) {
    parts.push(`Robot-type branches in ${typeGateFiles.join(", ")} change the ` +
      "rendering without naming a capability.");
  }
  if (differing.size > 0) {
    parts.push(`Measure under one robot and record which: ${[...differing].sort().join(", ")} ` +
      "render this differently.");
  } else {
    parts.push("Record the robot the baseline measured under, because the " +
      "rendering is robot-dependent even where the split is not knowable here.");
  }
  return parts.join(" ");
};

export const evaluateRobotContext = async options => {
  const productRoot = options["product-root"];
  const typesText = await readIfPresent(path.join(productRoot, typesFile));
  const registryText = await readIfPresent(path.join(productRoot, registryFile));
  if (typesText === null || registryText === null) {
    throw new Error(
      `The robot model could not be read from ${productRoot}: ${typesFile} and ` +
      `${registryFile} must both exist. Without them a capability cannot be ` +
      "resolved to robots, and a silent empty model would report every slice " +
      "as robot-neutral.");
  }

  const model = parseRobotModel(typesText, registryText);
  if (model.robots.size === 0) {
    throw new Error(
      `No robots were parsed from ${registryFile}. The registry shape changed, ` +
      "and guessing past it would report every slice as robot-neutral.");
  }

  const scanned = [];
  const missing = [];
  for (const relativePath of options.path) {
    const text = await readIfPresent(path.join(productRoot, relativePath));
    if (text === null) {
      missing.push(relativePath);
      continue;
    }
    scanned.push(scanFile(relativePath.replace(/\\/g, "/"), text));
  }

  const result = buildResult(scanned, model);
  result.missingPaths = missing;
  result.scannedPaths = options.path.length - missing.length;
  return result;
};

const parseArguments = argumentsList => {
  const options = { path: [] };
  const valued = new Set(["product-root", "path"]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const name = argument.slice(2);
    if (["--self-test", "--help", "--json"].includes(argument)) {
      options[name] = true;
      continue;
    }
    if (!argument.startsWith("--") || !valued.has(name)) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} needs a value.\n\n${usage}`);
    }
    if (name === "path") options.path.push(value);
    else options[name] = value;
    index += 1;
  }
  return options;
};

const printHuman = result => {
  const lines = [`robot sensitive: ${result.robotSensitive ? "yes" : "no"}`,
    `scanned ${result.scannedPaths} file(s)`];
  if (result.gates.length > 0) {
    lines.push(`${result.gates.length} gate(s):`);
    for (const gate of result.gates) {
      lines.push(`  ${gate.path}:${gate.line}  ${gate.kind}` +
        `${gate.name ? ` ${gate.name}` : ""}`);
    }
  }
  if (result.robotsDiffer.length > 0) {
    lines.push(`robots that render this differently: ${result.robotsDiffer.join(", ")}`);
  }
  if (result.missingPaths.length > 0) {
    lines.push(`not found, so not scanned: ${result.missingPaths.join(", ")}`);
  }
  lines.push(`indicator vocabulary: ${result.indicatorNames.join(" | ")}`);
  lines.push("note:");
  lines.push(`  ${result.note}`);
  return lines.join("\n");
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`Robot context self-test failed: ${message}`);
    process.exit(1);
  }
};

const selfTest = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "robot-context-"));
  try {
    const write = async (relativePath, text) => {
      const file = path.join(root, relativePath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    };

    await write(typesFile, `
export enum ERobotCapability {
\tFeedPush = "FeedPush",
\tWallTurn = "WallTurn",
\tDetectableUndetectableWalls = "DetectableUndetectableWalls",
\tSpray = "Spray",
}
export enum ERobotDisplayName {
\tCollector = "Collector",
\tBrownies130 = "Brownies 130",
\tJunoBasic = "Juno Basic",
\tJunoFlex = "Juno Flex",
}
export const BROWNIE_SHARED_CAPABILITIES: ReadonlySet<ERobotCapability> = new Set([
\tERobotCapability.DetectableUndetectableWalls,
\tERobotCapability.Spray,
]);
`);

    await write(registryFile, `
const ROBOT_REGISTRY = {
\t[ERobotType.None]: {
\t\ttype: ERobotType.None,
\t\tcapabilities: new Set(),
\t},
\t[ERobotType.Collector]: {
\t\ttype: ERobotType.Collector,
\t\tcapabilities: new Set([
\t\t\tERobotCapability.DetectableUndetectableWalls,
\t\t\tERobotCapability.WallTurn,
\t\t\tERobotCapability.Spray,
\t\t]),
\t},
\t[ERobotType.Brownie130]: {
\t\ttype: ERobotType.Brownie130,
\t\tcapabilities: new Set([
\t\t\t...BROWNIE_SHARED_CAPABILITIES,
\t\t\tERobotCapability.WallTurn,
\t\t]),
\t},
\t[ERobotType.Juno]: {
\t\ttype: ERobotType.Juno,
\t\tcapabilities: new Set([
\t\t\tERobotCapability.FeedPush,
\t\t\tERobotCapability.WallTurn,
\t\t]),
\t},
};
`);

    const model = parseRobotModel(
      await readFile(path.join(root, typesFile), "utf8"),
      await readFile(path.join(root, registryFile), "utf8"));

    // The spread has to be resolved, or a Brownie looks capability-less and
    // every difference between it and a Collector disappears.
    assert(model.robots.get("Brownie130").includes("DetectableUndetectableWalls") &&
      model.robots.get("Brownie130").includes("Spray"),
      `a spread capability set was not resolved: ${JSON.stringify(model.robots.get("Brownie130"))}`);
    assert(model.robots.get("Brownie130").includes("WallTurn"),
      "a capability listed beside a spread was lost");
    assert(model.displayNames.includes("Juno Flex") && model.displayNames.includes("Collector"),
      `the indicator vocabulary was not read: ${JSON.stringify(model.displayNames)}`);

    await write("src/features/neutral/Plain.tsx",
      "export const Plain = () => <div>nothing robot specific here</div>;");
    await write("src/features/gated/Capability.tsx", `
export const Gated = () => (
\t<div>{hasCapability(ERobotCapability.DetectableUndetectableWalls) && <Radio />}</div>
);
`);
    // The form that 39 of 62 product files use: a robot-type branch with no
    // capability anywhere. A scan that only looks for hasCapability misses it.
    await write("src/features/typed/TypeBranch.tsx", `
export const TypeBranch = () => {
\tconst { activeRobotType } = useRobotManager();
\treturn <Icon name={pickIcon(activeRobotType)} />;
};
`);
    await write("src/features/annotated/Annotated.tsx", `
export const describe = (robotType: ERobotType): string => String(robotType);
`);
    // A type map key declares a shape and renders nothing. ROBOT_REGISTRY and
    // RobotSettingsByType are both written this way, so scanning either would
    // otherwise report them as robot-dependent rendering.
    await write("src/features/shapes/Shapes.ts", `
export type RobotSettingsByType = {
\t[ERobotType.None]: NoneRobot;
\t[ERobotType.Juno]: JunoRobot;
};
`);
    await write("src/features/uniform/Uniform.tsx", `
export const Uniform = () => <div>{hasCapability(ERobotCapability.WallTurn) && <Turn />}</div>;
`);
    await write("src/features/unknown/Unknown.tsx", `
export const Unknown = () => <div>{hasCapability(ERobotCapability.Imaginary) && <X />}</div>;
`);
    await write("src/features/commented/Commented.tsx", `
// hasCapability(ERobotCapability.FeedPush) was removed here
export const Commented = () => <div>plain</div>;
`);

    const neutral = await evaluateRobotContext({
      "product-root": root, path: ["src/features/neutral/Plain.tsx"],
    });
    assert(neutral.robotSensitive === false && neutral.gates.length === 0,
      `a neutral file was reported robot sensitive: ${JSON.stringify(neutral.gates)}`);
    assert(/does not depend on the loaded robot/.test(neutral.note),
      `the neutral note does not say so: ${neutral.note}`);

    const gated = await evaluateRobotContext({
      "product-root": root, path: ["src/features/gated/Capability.tsx"],
    });
    assert(gated.robotSensitive === true, "a capability gate was not detected");
    assert(gated.robotsDiffer.includes("Collector") && gated.robotsDiffer.includes("Juno"),
      `the split robots are ${JSON.stringify(gated.robotsDiffer)}`);
    assert(!gated.robotsDiffer.includes("None"),
      "the None robot was reported as a rendering difference");
    assert(/have: Brownie130, Collector/.test(gated.note) && /lack: Juno/.test(gated.note),
      `the note does not name who has the capability: ${gated.note}`);

    const typed = await evaluateRobotContext({
      "product-root": root, path: ["src/features/typed/TypeBranch.tsx"],
    });
    assert(typed.robotSensitive === true,
      "a robot-type branch without any capability was missed, which is the form " +
      "most product files use");
    assert(typed.typeGateFiles.includes("src/features/typed/TypeBranch.tsx"),
      "the robot-type branch was not attributed to its file");
    assert(typed.robotsDiffer.length === 0,
      "a robot-type branch claimed to know which robots differ");
    assert(/Record the robot the baseline measured under/.test(typed.note),
      `the note does not ask for the robot to be recorded: ${typed.note}`);

    const annotated = await evaluateRobotContext({
      "product-root": root, path: ["src/features/annotated/Annotated.tsx"],
    });
    assert(annotated.robotSensitive === false,
      "a type annotation was counted as a branch");

    const shapes = await evaluateRobotContext({
      "product-root": root, path: ["src/features/shapes/Shapes.ts"],
    });
    assert(shapes.robotSensitive === false,
      `a type map key was counted as a render branch: ${JSON.stringify(shapes.gates)}`);

    const uniform = await evaluateRobotContext({
      "product-root": root, path: ["src/features/uniform/Uniform.tsx"],
    });
    assert(uniform.robotsDiffer.length === 0,
      "a capability every robot has was reported as a rendering difference");
    assert(/branches nothing here/.test(uniform.note),
      `the note does not say the gate branches nothing: ${uniform.note}`);

    const unknown = await evaluateRobotContext({
      "product-root": root, path: ["src/features/unknown/Unknown.tsx"],
    });
    assert(unknown.unresolvedCapabilities.includes("Imaginary"),
      "a capability absent from the registry was silently resolved");
    assert(/absent from ROBOT_REGISTRY/.test(unknown.note),
      `the note hides an unresolvable capability: ${unknown.note}`);

    const commented = await evaluateRobotContext({
      "product-root": root, path: ["src/features/commented/Commented.tsx"],
    });
    assert(commented.robotSensitive === false,
      "a gate inside a comment was counted as a live branch");

    const absent = await evaluateRobotContext({
      "product-root": root, path: ["src/features/gone/Missing.tsx"],
    });
    assert(absent.missingPaths.includes("src/features/gone/Missing.tsx") &&
      absent.scannedPaths === 0,
      "a path that does not exist was not reported as unscanned");

    // A model that cannot be read must throw rather than report every slice as
    // robot-neutral, which is the one wrong answer that reads as good news.
    const bare = await mkdtemp(path.join(os.tmpdir(), "robot-context-bare-"));
    let threw = false;
    try {
      await evaluateRobotContext({ "product-root": bare, path: ["src/x.tsx"] });
    } catch {
      threw = true;
    }
    await rm(bare, { recursive: true, force: true });
    assert(threw, "a missing robot model was treated as an empty one");

    console.log("Robot context self-test passed.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }
  if (options["self-test"]) {
    await selfTest();
    return;
  }
  if (!options["product-root"] || options.path.length === 0) {
    throw new Error(`--product-root and at least one --path are required.\n\n${usage}`);
  }
  const result = await evaluateRobotContext(options);
  console.log(options.json ? JSON.stringify(result, null, 2) : printHuman(result));
};

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
