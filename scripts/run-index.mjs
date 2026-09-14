import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

// Facts about the lab's runs directory that more than one script reads. No
// CLI: run-context.mjs and migration-map.mjs import it.

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readJson = async filePath =>
  JSON.parse((await readFile(filePath, "utf8")).replace(/^﻿/, ""));

const readDirectories = async directoryPath => {
  try {
    return (await readdir(directoryPath, { withFileTypes: true }))
      .filter(entry => entry.isDirectory());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return [];
  }
};

const numberedRuns = async (directories, stem) => {
  const pattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escapeRegex(stem)}-(\\d+)$`);
  const runs = directories.flatMap(({ directory, entries }) => entries
    .filter(entry => pattern.test(entry.name))
    .map(entry => ({
      name: entry.name,
      number: Number(pattern.exec(entry.name)[1]),
      directory: path.join(directory, entry.name),
    })))
    .sort((left, right) => left.number - right.number || left.directory.localeCompare(right.directory));
  const duplicate = runs.find((run, index) => index > 0 && run.number === runs[index - 1].number);
  if (duplicate) {
    throw new Error(`Duplicate ${stem}-${duplicate.number} run directories: ${runs
      .filter(run => run.number === duplicate.number).map(run => run.directory).join(", ")}.`);
  }
  return { runs, next: (runs.at(-1)?.number ?? 0) + 1 };
};

// The run directories named <date>-<stem>-<N>, oldest first, and the next N.
// Map runs remain flat; flow runs use flowRunDirectories for legacy + nested discovery.
export const listNumberedRuns = async (runsDirectory, stem) =>
  numberedRuns([{ directory: runsDirectory, entries: await readDirectories(runsDirectory) }], stem);

const flowRoot = (labRoot, flowId) =>
  path.join(path.resolve(labRoot), "runs", "flows", flowId);

const flowRunDirectories = async (labRoot, flowId) => {
  const runsDirectory = path.join(path.resolve(labRoot), "runs");
  return [
    { directory: runsDirectory, entries: await readDirectories(runsDirectory) },
    { directory: flowRoot(labRoot, flowId), entries: await readDirectories(flowRoot(labRoot, flowId)) },
  ];
};

const allFlowRunDirectories = async labRoot => {
  const runsDirectory = path.join(path.resolve(labRoot), "runs");
  const nestedRoot = path.join(runsDirectory, "flows");
  const flowDirectories = await readDirectories(nestedRoot);
  return [
    { directory: runsDirectory, entries: await readDirectories(runsDirectory) },
    ...(await Promise.all(flowDirectories.map(async entry => ({
      directory: path.join(nestedRoot, entry.name),
      entries: await readDirectories(path.join(nestedRoot, entry.name)),
    })))),
  ];
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
  const passes = new Map();
  const started = new Set();
  const locations = await allFlowRunDirectories(labRoot);
  for (const { directory, entries } of locations) {
    for (const entry of entries) {
      const directoryPath = path.join(directory, entry.name);
      const details = await stat(directoryPath);
      if (!details.isDirectory()) continue;
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
  }
  return { passes, started };
};

// Every readable work-item snapshot in every flow run directory, newest first.
export const workItemSnapshots = async labRoot => {
  const snapshots = [];
  for (const { directory, entries } of await allFlowRunDirectories(labRoot)) {
    for (const entry of entries) {
      const directoryPath = path.join(directory, entry.name);
      for (const file of await readdir(directoryPath)) {
        if (!/^work-item-.*\.json$/.test(file)) continue;
        const filePath = path.join(directoryPath, file);
        try {
          const value = await readJson(filePath);
          if (value.artifactType !== "work-item-handoff") continue;
          snapshots.push({ path: filePath, value, modified: (await stat(filePath)).mtimeMs });
        } catch {
          continue;
        }
      }
    }
  }
  return snapshots.sort((left, right) => right.modified - left.modified);
};

// A baseline run directory is open, a claim some chat still holds, until it
// carries the contract or the sidecar a finished or failed baseline writes.
const closesBaseline = file =>
  file === "flow-contract.json" ||
  /^skill-run-observations(?:-flow-baseline)?\.json$/.test(file);

export const baselineRuns = async (labRoot, flowId) => {
  const { runs, next } = await numberedRuns(
    await flowRunDirectories(labRoot, flowId),
    `${flowId}-baseline`,
  );
  return {
    next,
    runs: await Promise.all(runs.map(async run => {
      const directory = run.directory;
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
