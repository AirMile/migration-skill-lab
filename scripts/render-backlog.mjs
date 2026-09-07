import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backlogPath = path.join(rootDirectory, "backlog", "backlog.json");
const schemaPath = path.join(rootDirectory, "schemas", "backlog.schema.json");
const outputPath = path.join(rootDirectory, "backlog", "backlog.html");
const phaseOrder = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3],
]);

const readJson = async (filePath, label) => {
  const raw = await readFile(filePath, "utf8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
};

const describeType = value => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
};

const matchesType = (value, expectedType) => {
  switch (expectedType) {
    case "array":
      return Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    default:
      return typeof value === expectedType;
  }
};

const isValidDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const validateSchemaNode = (value, schema, location, errors) => {
  if ("const" in schema && value !== schema.const) {
    errors.push(`${location} must equal ${JSON.stringify(schema.const)}.`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(
      `${location} must be one of: ${schema.enum.map(entry => JSON.stringify(entry)).join(", ")}.`,
    );
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(
      `${location} must be ${schema.type}, received ${describeType(value)}.`,
    );
    return;
  }

  if (schema.type === "object") {
    for (const requiredKey of schema.required ?? []) {
      if (!Object.hasOwn(value, requiredKey)) {
        errors.push(`${location}.${requiredKey} is required.`);
      }
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties ?? {}));

      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          errors.push(`${location}.${key} is not allowed.`);
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        validateSchemaNode(value[key], propertySchema, `${location}.${key}`, errors);
      }
    }
  }

  if (schema.type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${location} must contain at least ${schema.minItems} item(s).`);
    }

    if (schema.uniqueItems) {
      const serialized = value.map(entry => JSON.stringify(entry));

      if (new Set(serialized).size !== serialized.length) {
        errors.push(`${location} must contain unique items.`);
      }
    }

    if (schema.items) {
      value.forEach((entry, index) => {
        validateSchemaNode(entry, schema.items, `${location}[${index}]`, errors);
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

    if (schema.format === "date" && !isValidDate(value)) {
      errors.push(`${location} must be a real date in YYYY-MM-DD format.`);
    }
  }
};

const findDuplicates = values => {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates];
};

const findDependencyCycles = itemById => {
  const state = new Map();
  const stack = [];
  const cycles = [];

  const visit = itemId => {
    const currentState = state.get(itemId);

    if (currentState === "visited") return;
    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(itemId);
      cycles.push([...stack.slice(cycleStart), itemId]);
      return;
    }

    state.set(itemId, "visiting");
    stack.push(itemId);

    for (const dependencyId of itemById.get(itemId).dependencies) {
      if (itemById.has(dependencyId)) visit(dependencyId);
    }

    stack.pop();
    state.set(itemId, "visited");
  };

  for (const itemId of itemById.keys()) visit(itemId);

  return cycles;
};

const validateRelationships = data => {
  const errors = [];
  const sourceIds = data.sources.map(source => source.id);
  const itemIds = data.items.map(item => item.id);
  const sourceIdSet = new Set(sourceIds);
  const itemById = new Map(data.items.map(item => [item.id, item]));

  for (const duplicate of findDuplicates(sourceIds)) {
    errors.push(`Duplicate source id: ${duplicate}.`);
  }

  for (const duplicate of findDuplicates(itemIds)) {
    errors.push(`Duplicate backlog item id: ${duplicate}.`);
  }

  for (const item of data.items) {
    for (const sourceId of item.sourceIds) {
      if (!sourceIdSet.has(sourceId)) {
        errors.push(`${item.id} references unknown source ${sourceId}.`);
      }
    }

    for (const dependencyId of item.dependencies) {
      const dependency = itemById.get(dependencyId);

      if (!dependency) {
        errors.push(`${item.id} depends on unknown item ${dependencyId}.`);
        continue;
      }

      if (dependencyId === item.id) {
        errors.push(`${item.id} cannot depend on itself.`);
      }

      if (phaseOrder.get(dependency.phase) > phaseOrder.get(item.phase)) {
        errors.push(
          `${item.id} (${item.phase}) depends on later-phase item ${dependencyId} (${dependency.phase}).`,
        );
      }
    }

    if (["ready", "in-progress", "done"].includes(item.status)) {
      const incompleteDependencies = item.dependencies.filter(
        dependencyId => itemById.get(dependencyId)?.status !== "done",
      );

      if (incompleteDependencies.length > 0) {
        errors.push(
          `${item.id} is ${item.status} but has incomplete dependencies: ${incompleteDependencies.join(", ")}.`,
        );
      }
    }
  }

  for (const cycle of findDependencyCycles(itemById)) {
    errors.push(`Dependency cycle: ${cycle.join(" -> ")}.`);
  }

  return errors;
};

const validateBacklog = (data, schema) => {
  const errors = [];
  validateSchemaNode(data, schema, "$", errors);

  if (errors.length === 0) {
    errors.push(...validateRelationships(data));
  }

  if (errors.length > 0) {
    throw new Error(`Backlog validation failed:\n- ${errors.join("\n- ")}`);
  }
};

const runSelfTest = (data, schema) => {
  const cases = [
    {
      name: "unknown schemaVersion",
      expected: "$.schemaVersion must equal 1",
      mutate: candidate => {
        candidate.schemaVersion = 2;
      },
    },
    {
      name: "missing required field",
      expected: "$.items[0].status is required",
      mutate: candidate => {
        delete candidate.items[0].status;
      },
    },
    {
      name: "duplicate item id",
      expected: "Duplicate backlog item id",
      mutate: candidate => {
        candidate.items.push(structuredClone(candidate.items[0]));
      },
    },
    {
      name: "unknown dependency",
      expected: "depends on unknown item",
      mutate: candidate => {
        candidate.items[2].dependencies = ["missing-item"];
      },
    },
    {
      name: "dependency cycle",
      expected: "Dependency cycle",
      mutate: candidate => {
        const firstItem = candidate.items.find(
          item => item.id === "approve-storage-architecture",
        );
        firstItem.dependencies = ["build-lab-foundation"];
        firstItem.status = "blocked";
      },
    },
  ];

  validateBacklog(data, schema);

  for (const testCase of cases) {
    const candidate = structuredClone(data);
    testCase.mutate(candidate);

    let validationError;

    try {
      validateBacklog(candidate, schema);
    } catch (error) {
      validationError = error;
    }

    if (!validationError) {
      throw new Error(`Self-test "${testCase.name}" unexpectedly passed.`);
    }

    if (!validationError.message.includes(testCase.expected)) {
      throw new Error(
        `Self-test "${testCase.name}" failed for the wrong reason: ${validationError.message}`,
      );
    }
  }

  console.log(`Backlog validator self-test passed (${cases.length} negative cases).`);
};

const escapeHtml = value =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderList = (values, emptyLabel) => {
  if (values.length === 0) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;

  return `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
};

const renderItem = (item, itemById, sourceById) => {
  const dependencies = item.dependencies.map(dependencyId => {
    const dependency = itemById.get(dependencyId);
    return `${dependencyId}: ${dependency.title}`;
  });
  const sources = item.sourceIds.map(sourceId => {
    const source = sourceById.get(sourceId);
    return `${sourceId}: ${source.label}`;
  });

  return `
    <article class="card">
      <div class="card-heading">
        <div>
          <p class="eyebrow">${escapeHtml(item.id)}</p>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <span class="badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <p>${escapeHtml(item.description)}</p>
      <dl class="metadata">
        <div><dt>Type</dt><dd>${escapeHtml(item.type)}</dd></div>
        <div><dt>Risk</dt><dd>${escapeHtml(item.risk)}</dd></div>
        <div><dt>Evidence value</dt><dd>${escapeHtml(item.evidenceValue)}</dd></div>
      </dl>
      <details>
        <summary>Dependencies (${item.dependencies.length})</summary>
        ${renderList(dependencies, "No dependencies.")}
      </details>
      <details>
        <summary>Acceptance criteria (${item.acceptanceCriteria.length})</summary>
        ${renderList(item.acceptanceCriteria, "No acceptance criteria.")}
      </details>
      <details${item.openQuestions.length > 0 ? " open" : ""}>
        <summary>Open questions (${item.openQuestions.length})</summary>
        ${renderList(item.openQuestions, "No open questions.")}
      </details>
      <details>
        <summary>Sources (${item.sourceIds.length})</summary>
        ${renderList(sources, "No sources.")}
      </details>
    </article>`;
};

const buildHtml = data => {
  const canonicalJson = `${JSON.stringify(data, null, 2)}\n`;
  const checksum = createHash("sha256").update(canonicalJson).digest("hex");
  const itemById = new Map(data.items.map(item => [item.id, item]));
  const sourceById = new Map(data.sources.map(source => [source.id, source]));
  const statusCounts = data.items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const phases = [...phaseOrder.keys()]
    .map(phase => ({
      phase,
      items: data.items.filter(item => item.phase === phase),
    }))
    .filter(group => group.items.length > 0);
  const embeddedJson = escapeHtml(canonicalJson);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
  >
  <meta name="backlog-schema-version" content="${data.schemaVersion}">
  <meta name="backlog-sha256" content="${checksum}">
  <title>${escapeHtml(data.project.name)} backlog</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0b1020;
      color: #e7ecf7;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b1020; color: #e7ecf7; }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 72px; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: clamp(2rem, 6vw, 4rem); line-height: 1; max-width: 900px; }
    h2 { margin: 44px 0 18px; font-size: 1.6rem; }
    h3 { margin-bottom: 10px; font-size: 1.1rem; }
    a { color: inherit; }
    .hero { padding: 28px; border: 1px solid #293452; border-radius: 20px; background: #111932; }
    .hero p { max-width: 800px; color: #bac5dc; }
    .notice {
      margin-top: 20px;
      padding: 14px 16px;
      border-left: 4px solid #65d1ff;
      background: #101c33;
      color: #c9d8f0;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }
    .metric { padding: 16px; border: 1px solid #293452; border-radius: 14px; background: #0d1529; }
    .metric strong { display: block; font-size: 1.7rem; }
    .metric span, .muted, footer { color: #93a2c1; }
    .phase-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .card { padding: 20px; border: 1px solid #293452; border-radius: 16px; background: #111932; }
    .card-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .eyebrow { margin-bottom: 6px; color: #8fa5d2; font: 600 0.75rem ui-monospace, SFMono-Regular, Consolas, monospace; }
    .badge { flex: none; padding: 5px 9px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
    .status-done { background: #173d2b; color: #8ff0bb; }
    .status-ready { background: #123b4e; color: #7ce4ff; }
    .status-in-progress { background: #3c3210; color: #ffe17a; }
    .status-blocked { background: #47222c; color: #ff9caf; }
    .status-deferred, .status-proposed { background: #2a3040; color: #bbc5da; }
    .metadata { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 18px 0; }
    .metadata div { padding: 10px; border-radius: 10px; background: #0d1529; }
    dt { margin-bottom: 4px; color: #8090b0; font-size: 0.7rem; text-transform: uppercase; }
    dd { margin: 0; }
    details { border-top: 1px solid #293452; padding-top: 10px; margin-top: 10px; }
    summary { cursor: pointer; font-weight: 650; }
    li { margin: 6px 0; color: #c7d0e3; }
    .sources, .snapshot { margin-top: 44px; padding: 20px; border: 1px solid #293452; border-radius: 16px; }
    .source { padding: 10px 0; border-top: 1px solid #293452; }
    .source:first-of-type { border-top: 0; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    pre { max-height: 520px; overflow: auto; padding: 16px; border-radius: 10px; background: #070b16; white-space: pre-wrap; }
    footer { margin-top: 28px; font-size: 0.85rem; overflow-wrap: anywhere; }
    @media (max-width: 640px) {
      main { width: min(100% - 20px, 1180px); padding-top: 20px; }
      .hero, .card { padding: 16px; }
      .metadata { grid-template-columns: 1fr; }
      .card-heading { display: block; }
      .badge { display: inline-block; margin-bottom: 10px; }
    }
    @media (prefers-color-scheme: light) {
      :root, body { background: #f4f6fa; color: #172033; }
      .hero, .card, .metric { background: #ffffff; border-color: #d8dfeb; }
      .hero p, li { color: #44526b; }
      .notice { background: #eaf7fc; color: #24445b; }
      .metadata div { background: #f2f5f9; }
      details, .source, .sources, .snapshot { border-color: #d8dfeb; }
      pre { background: #edf1f7; }
    }
  </style>
</head>
<body>
  <!-- Generated from backlog/backlog.json. Do not edit this file manually. -->
  <main>
    <section class="hero">
      <p class="eyebrow">READ-ONLY BACKLOG SNAPSHOT</p>
      <h1>${escapeHtml(data.project.name)}</h1>
      <p>${escapeHtml(data.project.objective)}</p>
      <div class="notice">
        This standalone file is generated output. Update
        <code>backlog/backlog.json</code> and run the renderer instead of editing this HTML.
      </div>
      <div class="summary">
        <div class="metric"><strong>${data.items.length}</strong><span>Total items</span></div>
        <div class="metric"><strong>${statusCounts.done ?? 0}</strong><span>Done</span></div>
        <div class="metric"><strong>${(statusCounts.ready ?? 0) + (statusCounts["in-progress"] ?? 0)}</strong><span>Ready or active</span></div>
        <div class="metric"><strong>${statusCounts.blocked ?? 0}</strong><span>Blocked</span></div>
        <div class="metric"><strong>${statusCounts.deferred ?? 0}</strong><span>Deferred</span></div>
      </div>
    </section>

    ${phases
      .map(
        group => `
    <section>
      <h2>${group.phase} <span class="muted">(${group.items.length})</span></h2>
      <div class="phase-grid">
        ${group.items.map(item => renderItem(item, itemById, sourceById)).join("")}
      </div>
    </section>`,
      )
      .join("")}

    <section class="sources">
      <h2>Sources</h2>
      ${data.sources
        .map(
          source => `
      <div class="source">
        <strong>${escapeHtml(source.id)}</strong> - ${escapeHtml(source.label)}
        <div class="muted">${escapeHtml(source.location)}${source.revision ? ` @ ${escapeHtml(source.revision)}` : ""}</div>
      </div>`,
        )
        .join("")}
    </section>

    <details class="snapshot">
      <summary>Embedded canonical JSON snapshot</summary>
      <pre id="backlog-data" data-format="application/json">${embeddedJson}</pre>
    </details>

    <footer>
      Updated ${escapeHtml(data.updatedAt)} |
      schemaVersion ${data.schemaVersion} |
      source backlog/backlog.json |
      sha256 ${checksum}
    </footer>
  </main>
</body>
</html>
`;
};

const main = async () => {
  const argumentsList = process.argv.slice(2);
  const supportedArguments = new Set(["--check", "--self-test"]);
  const unknownArguments = argumentsList.filter(
    argument => !supportedArguments.has(argument),
  );

  if (unknownArguments.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}.`);
  }

  if (argumentsList.includes("--check") && argumentsList.includes("--self-test")) {
    throw new Error("--check and --self-test cannot be combined.");
  }

  const [data, schema] = await Promise.all([
    readJson(backlogPath, "Backlog"),
    readJson(schemaPath, "Backlog schema"),
  ]);

  validateBacklog(data, schema);

  if (argumentsList.includes("--self-test")) {
    runSelfTest(data, schema);
    return;
  }

  const expectedHtml = buildHtml(data);

  if (argumentsList.includes("--check")) {
    const currentHtml = await readFile(outputPath, "utf8");

    if (currentHtml !== expectedHtml) {
      throw new Error(
        "backlog/backlog.html is stale. Run node .\\scripts\\render-backlog.mjs.",
      );
    }

    console.log("Backlog HTML is valid and up to date.");
    return;
  }

  await writeFile(outputPath, expectedHtml, "utf8");
  console.log(`Generated ${path.relative(rootDirectory, outputPath)}.`);
};

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
