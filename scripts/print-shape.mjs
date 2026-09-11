import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs read whole example artifacts to copy one block's shape, and the
// detail-drawer contract alone is 24 KB. The shape was all they needed.

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const usage = `Usage: node scripts/print-shape.mjs <artifact.json> [options]

Prints a compact skeleton of a JSON artifact: every key the file uses, one
element per array with the keys of all its elements folded in, and long strings
shortened. Copy an artifact's shape from this instead of reading the file.

Options:
  --block <path>     print only this block, e.g. targetArchitecture or
                     stories.0.tasks (dot-separated; numbers index arrays)
  --max-string <n>   shorten strings longer than n characters (default 60)
  --self-test        run the built-in checks
`;

const isPlainObject = value =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Folds every element of an object array into one, so a key that only a later
// element carries still appears in the single element the skeleton keeps.
const mergeObjects = objects => {
  const merged = {};
  for (const object of objects) {
    for (const [key, child] of Object.entries(object)) {
      if (!Object.hasOwn(merged, key)) {
        merged[key] = child;
      } else if (isPlainObject(merged[key]) && isPlainObject(child)) {
        merged[key] = mergeObjects([merged[key], child]);
      } else if (Array.isArray(merged[key]) && Array.isArray(child)) {
        if (merged[key].length === 0) {
          merged[key] = child;
        } else if ([...merged[key], ...child].every(isPlainObject)) {
          merged[key] = [...merged[key], ...child];
        }
      }
    }
  }
  return merged;
};

const shapeOf = (value, maxString) => {
  if (typeof value === "string") {
    return value.length > maxString ? `${value.slice(0, maxString)}…` : value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const first = value.every(isPlainObject) ? mergeObjects(value) : value[0];
    const shaped = [shapeOf(first, maxString)];
    if (value.length > 1) shaped.push(`…(+${value.length - 1} more)`);
    return shaped;
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, shapeOf(child, maxString)]),
    );
  }
  return value;
};

const selectBlock = (value, blockPath) => {
  let current = value;
  let location = "$";
  for (const segment of blockPath.split(".")) {
    if (Array.isArray(current) && /^\d+$/.test(segment) &&
      Number(segment) < current.length) {
      current = current[Number(segment)];
    } else if (isPlainObject(current) && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      const available = isPlainObject(current)
        ? Object.keys(current).join(", ")
        : Array.isArray(current)
          ? `indexes 0-${current.length - 1}`
          : "nothing; it is a scalar";
      throw new Error(`${location} has no "${segment}". Available: ${available}.`);
    }
    location = `${location}.${segment}`;
  }
  return current;
};

const renderShape = (value, maxString) =>
  `${JSON.stringify(shapeOf(value, maxString), null, 2)}\n`;

const keyPaths = (value, prefix = "$", paths = new Set()) => {
  if (Array.isArray(value)) {
    for (const item of value) keyPaths(item, `${prefix}[]`, paths);
  } else if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      paths.add(`${prefix}.${key}`);
      keyPaths(child, `${prefix}.${key}`, paths);
    }
  }
  return paths;
};

const parseArguments = argumentsList => {
  const options = { positional: [], maxString: 60 };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--self-test" || argument === "--help") {
      options[argument.slice(2)] = true;
    } else if (argument === "--block" || argument === "--max-string") {
      const value = argumentsList[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${argument} needs a value.\n\n${usage}`);
      }
      index += 1;
      if (argument === "--block") {
        options.block = value;
      } else {
        options.maxString = Number(value);
        if (!Number.isInteger(options.maxString) || options.maxString < 1) {
          throw new Error("--max-string must be a positive integer.");
        }
      }
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option ${argument}.\n\n${usage}`);
    } else {
      options.positional.push(argument);
    }
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Shape printer self-test failed: ${message}`);
};

const runSelfTest = async () => {
  const sample = {
    title: "x".repeat(100),
    items: [
      { id: "a", tags: [] },
      { id: "b", optional: true, tags: ["one", "two"] },
      { id: "c", nested: [{ deep: 1 }, { deeper: 2 }] },
    ],
    tags: ["one", "two", "three"],
    empty: [],
    count: 3,
    flag: false,
    nothing: null,
  };
  const shape = shapeOf(sample, 60);

  assert(shape.title.length === 61 && shape.title.endsWith("…"),
    "a long string is not shortened");
  assert(shape.items.length === 2 && shape.items[1] === "…(+2 more)",
    "an object array does not keep one element plus a count");
  assert(shape.items[0].optional === true,
    "a key carried only by a later element is lost");
  assert(Object.hasOwn(shape.items[0].nested[0], "deep") &&
    Object.hasOwn(shape.items[0].nested[0], "deeper"),
    "keys of nested object arrays are not folded together");
  assert(shape.items[0].tags[0] === "one",
    "an empty array hides a later element's values");
  assert(shape.tags[0] === "one" && shape.tags[1] === "…(+2 more)",
    "a string array does not keep one element plus a count");
  assert(Array.isArray(shape.empty) && shape.empty.length === 0,
    "an empty array is not kept empty");
  assert(shape.count === 3 && shape.flag === false && shape.nothing === null,
    "a scalar changed");
  assert(selectBlock(sample, "items.1.optional") === true,
    "a dotted block path with an index does not resolve");

  let missingBlockError;
  try {
    selectBlock(sample, "items.9");
  } catch (error) {
    missingBlockError = error.message;
  }
  assert(missingBlockError?.includes("indexes 0-2"),
    "a missing block does not name what is available");

  const examplePath = path.join(
    rootDirectory,
    "examples",
    "handoff",
    "detail-drawer-line-edit",
    "flow-contract.json",
  );
  const example = JSON.parse(await readFile(examplePath, "utf8"));
  const rendered = renderShape(example, 60);
  const expectedPaths = [...keyPaths(example)].sort();
  const actualPaths = [...keyPaths(JSON.parse(rendered))].sort();
  assert(JSON.stringify(expectedPaths) === JSON.stringify(actualPaths),
    "the example contract skeleton does not carry every key of the contract");
  assert(Buffer.byteLength(rendered) < 8000,
    `the example contract skeleton is ${Buffer.byteLength(rendered)} bytes, not under 8000`);

  console.log("Shape printer self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  if (options.help || options.positional.length !== 1) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const raw = await readFile(path.resolve(options.positional[0]), "utf8");
  const value = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const block = options.block ? selectBlock(value, options.block) : value;
  process.stdout.write(renderShape(block, options.maxString));
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
