import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

// Facts about the lab's runs directory that more than one script reads. No
// CLI: run-context.mjs and migration-map.mjs import it.

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readJson = async filePath =>
  JSON.parse((await readFile(filePath, "utf8")).replace(/^﻿/, ""));

// The run directories named <date>-<stem>-<N>, oldest first, and the next N.
export const listNumberedRuns = async (runsDirectory, stem) => {
  let directories = [];
  try {
    directories = (await readdir(runsDirectory, { withFileTypes: true }))
      .filter(entry => entry.isDirectory());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const pattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escapeRegex(stem)}-(\\d+)$`);
  const runs = directories
    .filter(entry => pattern.test(entry.name))
    .map(entry => ({ name: entry.name, number: Number(pattern.exec(entry.name)[1]) }))
    .sort((left, right) => left.number - right.number);
  return { runs, next: (runs.at(-1)?.number ?? 0) + 1 };
};

// A contract that migrated part of its map slice names what is still React;
// its PASS keeps the slice open.
const readRemainder = async directoryPath => {
  try {
    const remainder = (await readJson(path.join(directoryPath, "flow-contract.json"))).planSlice?.remainder;
    return typeof remainder === "string" && remainder.trim() ? remainder : null;
  } catch {
    return null;
  }
};

// The newest PASS verification-result per flowId, with the remainder its
// contract records, and every flowId with a flow-contract, across all run
// directories.
export const scanRuns = async labRoot => {
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
        value = await readJson(filePath);
      } catch {
        continue;
      }
      if (isVerification && value.artifactType === "verification-result" && value.status === "PASS") {
        const modified = (await stat(filePath)).mtimeMs;
        const previous = passes.get(value.flowId);
        if (!previous || previous.modified < modified) {
          passes.set(value.flowId, { filePath, modified, remainder: await readRemainder(directoryPath) });
        }
      }
      if (value.artifactType === "flow-contract") started.add(value.flowId);
    }
  }
  return { passes, started };
};

// A baseline run directory is open, a claim some chat still holds, until it
// carries the contract or the sidecar a finished or failed baseline writes.
const closesBaseline = file =>
  file === "flow-contract.json" ||
  /^skill-run-observations(?:-flow-baseline)?\.json$/.test(file);

export const baselineRuns = async (labRoot, flowId) => {
  const runsDirectory = path.resolve(labRoot, "runs");
  const { runs, next } = await listNumberedRuns(runsDirectory, `${flowId}-baseline`);
  return {
    next,
    runs: await Promise.all(runs.map(async run => {
      const directory = path.join(runsDirectory, run.name);
      const files = (await readdir(directory)).sort();
      const passed = (await Promise.all(files
        .filter(file => /^verification-result(?:-\d+)?\.json$/.test(file))
        .map(file => readJson(path.join(directory, file)).then(value => value.status === "PASS", () => false))))
        .some(Boolean);
      return {
        directory,
        number: run.number,
        files,
        open: !files.some(closesBaseline),
        contract: files.includes("flow-contract.json"),
        pass: passed ? { remainder: await readRemainder(directory) } : null,
      };
    })),
  };
};
