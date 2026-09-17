import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// What a surface looks like is not judgement either: it is the computed style
// the host actually paints. flow-baseline measures it while React still owns
// the surface, flow-verify measures it again once Angular does, and the
// difference is evidence a reader can check instead of a recollection.
//
// The lab installs nothing, so this speaks the Chrome DevTools Protocol over
// the fetch and WebSocket globals Node ships with: /json/list names the page
// target, Runtime.evaluate reads getComputedStyle and Page.captureScreenshot
// clips the element. WebView2 is Edge, so the same calls drive the Route
// Assistant desktop application the constants name as the verification host.

const usage = `Usage:
  node scripts/visual-measure.mjs --spec <spec.json> --label <before|after> --out <dir> [--port <n>]
  node scripts/visual-measure.mjs --selector <css> [--counterpart <css>] [--property <name>...] [--port <n>]
  node scripts/visual-measure.mjs --compare <before.json> <after.json>
  node scripts/visual-measure.mjs --self-test

Measures a surface in the running host and prints JSON.

--spec runs every surface a spec file names and, with --out, writes
visual-measurement-<label>.json and one PNG per surface beside it. The spec is
flow-baseline's sidecar: { flowId, surfaces: [ { visualParityId, selector,
counterpartSelector?, properties? } ] }. Without --out the measurement only
goes to stdout.

--selector measures one surface ad hoc, which is how a run checks a selector
before a baseline commits to it.

--compare reads two measurements and prints, per surface, the properties that
changed and the ones that differ from their retained counterpart, plus an
"evidence" array of one-line strings a verification-result copies verbatim into
visualCriteria.evidence, and a fingerprint verdict. A measurement pair taken at
different window sizes or pixel ratios is reported as "drifted": the comparison
is then indicative, never authoritative, because layout values are not
comparable across viewports.

Never writes to the product repository. A missing element is recorded as
found: false, never as a zero measurement.

Options:
  --port        CDP port of the host, by default 9123
  --host        CDP host, by default 127.0.0.1
  --timeout     milliseconds to wait for the host, by default 10000
  --help        print this text
  --self-test   run the built-in checks
`;

const defaultProperties = [
  "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
  "marginLeft", "marginRight", "marginTop", "marginBottom",
  "width", "height",
  "borderRadius", "borderWidth", "borderStyle", "borderColor",
  "color", "backgroundColor",
  "fontSize", "fontWeight", "fontFamily", "lineHeight",
  "display", "alignItems", "justifyContent", "gap", "textAlign",
  "visibility", "opacity",
];

const fingerprintKeys = ["innerWidth", "innerHeight", "devicePixelRatio"];

// ---------------------------------------------------------------- CDP client

const listTargets = async (host, port, timeout) => {
  const response = await fetch(`http://${host}:${port}/json/list`, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    throw new Error(`http://${host}:${port}/json/list returned ${response.status}.`);
  }
  return response.json();
};

const openSession = (url, timeout) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`The debugger socket did not open within ${timeout}ms.`));
    }, timeout);
    let nextId = 0;

    socket.addEventListener("message", event => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`Could not reach the debugger socket at ${url}.`));
    });
    socket.addEventListener("close", () => {
      for (const waiter of pending.values()) {
        waiter.reject(new Error("The debugger socket closed while waiting."));
      }
      pending.clear();
    });
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            nextId += 1;
            pending.set(nextId, { resolve: res, reject: rej });
            socket.send(JSON.stringify({ id: nextId, method, params }));
          }),
        close: () => socket.close(),
      });
    });
  });

const connect = async ({ host, port, timeout }) => {
  let targets;
  try {
    targets = await listTargets(host, port, timeout);
  } catch (error) {
    throw new Error(
      `No host answered on ${host}:${port} (${error.message}). Start the ` +
      "application with remote debugging on that port first; this script " +
      "never starts it.",
    );
  }
  const page = targets.find(
    target => target.type === "page" && target.webSocketDebuggerUrl,
  );
  if (!page) {
    throw new Error(
      `${host}:${port} has no page target with a debugger url; it exposed ` +
      `${targets.length} target(s).`,
    );
  }
  const session = await openSession(page.webSocketDebuggerUrl, timeout);
  return { session, target: { title: page.title, url: page.url } };
};

// ------------------------------------------------------------------ measuring

const measureExpression = (selector, properties) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  const view = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };
  if (!element) return JSON.stringify({ found: false, view });
  const computed = getComputedStyle(element);
  const styles = {};
  for (const name of ${JSON.stringify(properties)}) styles[name] = computed[name];
  const box = element.getBoundingClientRect();
  return JSON.stringify({
    found: true,
    view,
    styles,
    rect: {
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
      width: box.width,
      height: box.height,
    },
    text: (element.textContent ?? "").trim().slice(0, 120),
  });
})()`;

const measureSelector = async (session, selector, properties) => {
  const evaluated = await session.send("Runtime.evaluate", {
    expression: measureExpression(selector, properties),
    returnByValue: true,
  });
  if (evaluated.exceptionDetails) {
    throw new Error(
      `Measuring ${selector} threw: ${evaluated.exceptionDetails.text}`,
    );
  }
  return JSON.parse(evaluated.result.value);
};

const captureElement = async (session, rect) => {
  const shot = await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: rect.x,
      y: rect.y,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
      scale: 1,
    },
  });
  return Buffer.from(shot.data, "base64");
};

const measureSurfaces = async (options, surfaces) => {
  const { session, target } = await connect(options);
  const measured = [];
  let fingerprint = null;
  try {
    for (const surface of surfaces) {
      const properties = surface.properties?.length
        ? surface.properties
        : defaultProperties;
      const own = await measureSelector(session, surface.selector, properties);
      fingerprint ??= own.view;

      const entry = {
        visualParityId: surface.visualParityId,
        selector: surface.selector,
        found: own.found,
        styles: own.styles ?? null,
        rect: own.rect ?? null,
        text: own.text ?? null,
      };

      if (surface.counterpartSelector) {
        const other = await measureSelector(
          session, surface.counterpartSelector, properties,
        );
        entry.counterpart = {
          selector: surface.counterpartSelector,
          found: other.found,
          styles: other.styles ?? null,
          rect: other.rect ?? null,
        };
      }

      if (own.found && options.outDirectory) {
        const file = `${surface.visualParityId}-${options.label}.png`;
        await writeFile(
          path.join(options.outDirectory, file),
          await captureElement(session, own.rect),
        );
        entry.screenshot = file;
      }
      measured.push(entry);
    }
  } finally {
    session.close();
  }
  return { target, fingerprint, surfaces: measured };
};

// ----------------------------------------------------------------- comparing

const compareFingerprints = (before, after) => {
  if (!before || !after) {
    return { status: "unknown", differences: ["a measurement carries no fingerprint"] };
  }
  const differences = fingerprintKeys
    .filter(key => before[key] !== after[key])
    .map(key => `${key} ${before[key]} -> ${after[key]}`);
  return {
    status: differences.length === 0 ? "stable" : "drifted",
    differences,
  };
};

const compareStyles = (before, after) => {
  const names = [...new Set([
    ...Object.keys(before ?? {}), ...Object.keys(after ?? {}),
  ])].sort();
  return names
    .filter(name => (before ?? {})[name] !== (after ?? {})[name])
    .map(name => ({
      property: name,
      before: (before ?? {})[name] ?? null,
      after: (after ?? {})[name] ?? null,
    }));
};

const compareMeasurements = (before, after) => {
  const fingerprint = compareFingerprints(before.fingerprint, after.fingerprint);
  const afterById = new Map(after.surfaces.map(s => [s.visualParityId, s]));
  const evidence = [];
  const surfaces = [];

  for (const earlier of before.surfaces) {
    const later = afterById.get(earlier.visualParityId);
    const id = earlier.visualParityId;

    if (!later) {
      surfaces.push({ visualParityId: id, status: "missing-after", changed: [] });
      evidence.push(`${id}: measured before but not after`);
      continue;
    }
    if (!earlier.found || !later.found) {
      const which = !earlier.found && !later.found
        ? "before and after"
        : (!earlier.found ? "before" : "after");
      surfaces.push({ visualParityId: id, status: "not-found", changed: [] });
      evidence.push(`${id}: element not found in ${which} (${earlier.selector})`);
      continue;
    }

    const changed = compareStyles(earlier.styles, later.styles);
    const againstCounterpart = later.counterpart?.found
      ? compareStyles(later.counterpart.styles, later.styles)
      : [];

    surfaces.push({
      visualParityId: id,
      status: changed.length === 0 ? "identical" : "changed",
      changed,
      againstCounterpart,
    });

    if (changed.length === 0) {
      evidence.push(`${id}: every measured property identical before and after`);
    } else {
      for (const item of changed) {
        evidence.push(
          `${id}: ${item.property} ${item.before} -> ${item.after} (changed by migration)`,
        );
      }
    }
    for (const item of againstCounterpart) {
      evidence.push(
        `${id}: ${item.property} ${item.after} vs counterpart ${item.before} (differs from retained sibling)`,
      );
    }
  }

  for (const later of after.surfaces) {
    if (!before.surfaces.some(s => s.visualParityId === later.visualParityId)) {
      surfaces.push({
        visualParityId: later.visualParityId,
        status: "missing-before",
        changed: [],
      });
      evidence.push(`${later.visualParityId}: measured after but not before`);
    }
  }

  if (fingerprint.status === "drifted") {
    evidence.push(
      `fingerprint drifted (${fingerprint.differences.join("; ")}): layout ` +
      "values are indicative, not authoritative",
    );
  }

  const anyChange = surfaces.some(s => s.status !== "identical");
  return {
    artifactType: "visual-comparison",
    fingerprint,
    outcome: anyChange ? "differences-found" : "no-differences",
    surfaces,
    evidence,
  };
};

// ----------------------------------------------------------------- arguments

const parseArguments = argumentsList => {
  const options = {
    host: "127.0.0.1",
    port: 9123,
    timeout: 10000,
    properties: [],
    compare: [],
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "--self-test") {
      options[argument.slice(2)] = true;
      continue;
    }
    if (argument === "--compare") {
      const first = argumentsList[index + 1];
      const second = argumentsList[index + 2];
      if (!first || !second || first.startsWith("--") || second.startsWith("--")) {
        throw new Error(`--compare needs two files.\n\n${usage}`);
      }
      options.compare = [first, second];
      index += 2;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
    }
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} needs a value.\n\n${usage}`);
    }
    index += 1;
    switch (argument) {
      case "--spec": options.spec = value; break;
      case "--label": options.label = value; break;
      case "--out": options.outDirectory = value; break;
      case "--selector": options.selector = value; break;
      case "--counterpart": options.counterpartSelector = value; break;
      case "--property": options.properties.push(value); break;
      case "--host": options.host = value; break;
      case "--port":
      case "--timeout": {
        const numeric = Number(value);
        if (!Number.isInteger(numeric) || numeric < 1) {
          throw new Error(`${argument} must be a positive integer.`);
        }
        options[argument === "--port" ? "port" : "timeout"] = numeric;
        break;
      }
      default: throw new Error(`Unknown option ${argument}.\n\n${usage}`);
    }
  }
  return options;
};

const readSpec = async specPath => {
  const raw = await readFile(path.resolve(specPath), "utf8");
  const spec = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!Array.isArray(spec.surfaces) || spec.surfaces.length === 0) {
    throw new Error(`${specPath} carries no surfaces array.`);
  }
  for (const surface of spec.surfaces) {
    if (!surface.visualParityId || !surface.selector) {
      throw new Error(
        `${specPath} has a surface without visualParityId or selector.`,
      );
    }
  }
  return spec;
};

// ----------------------------------------------------------------- self-test

const assert = (condition, message) => {
  if (!condition) throw new Error(`Visual measure self-test failed: ${message}`);
};

const runSelfTest = async () => {
  const options = parseArguments([
    "--spec", "s.json", "--label", "before", "--port", "9222",
    "--property", "paddingLeft",
  ]);
  assert(options.port === 9222 && options.label === "before",
    "arguments do not parse");
  assert(options.properties[0] === "paddingLeft",
    "--property does not collect");

  let rejected;
  try {
    parseArguments(["--port", "zero"]);
  } catch (error) {
    rejected = error.message;
  }
  assert(rejected?.includes("positive integer"),
    "a non-numeric port is accepted");

  const expression = measureExpression("#a", ["paddingLeft"]);
  assert(expression.includes('"#a"') && expression.includes('"paddingLeft"'),
    "the measuring expression does not carry its selector and properties");

  const before = {
    fingerprint: { innerWidth: 1258, innerHeight: 675, devicePixelRatio: 1.25 },
    surfaces: [
      {
        visualParityId: "row-a",
        selector: "#a",
        found: true,
        styles: { paddingLeft: "16px", color: "rgb(51, 51, 51)" },
      },
      { visualParityId: "row-b", selector: "#b", found: true, styles: { width: "10px" } },
    ],
  };
  const after = {
    fingerprint: { innerWidth: 1258, innerHeight: 675, devicePixelRatio: 1.25 },
    surfaces: [
      {
        visualParityId: "row-a",
        selector: "#a",
        found: true,
        styles: { paddingLeft: "0px", color: "rgb(51, 51, 51)" },
        counterpart: { found: true, styles: { paddingLeft: "16px", color: "rgb(51, 51, 51)" } },
      },
      { visualParityId: "row-b", selector: "#b", found: true, styles: { width: "10px" } },
    ],
  };

  const comparison = compareMeasurements(before, after);
  assert(comparison.outcome === "differences-found",
    "a changed property does not surface as a difference");
  assert(comparison.fingerprint.status === "stable",
    "an identical fingerprint is not reported stable");

  const rowA = comparison.surfaces.find(s => s.visualParityId === "row-a");
  assert(rowA.status === "changed" && rowA.changed.length === 1,
    "the changed property is not isolated");
  assert(rowA.changed[0].before === "16px" && rowA.changed[0].after === "0px",
    "the before and after values are not carried");
  assert(rowA.againstCounterpart.length === 1,
    "a difference from the retained counterpart is not reported");

  const rowB = comparison.surfaces.find(s => s.visualParityId === "row-b");
  assert(rowB.status === "identical",
    "an unchanged surface is not reported identical");
  assert(comparison.evidence.some(line => line.includes("every measured property identical")),
    "an unchanged surface produces no evidence line");
  assert(comparison.evidence.every(line => typeof line === "string" && line.length > 0),
    "evidence is not an array of non-empty strings");

  const drifted = compareMeasurements(before, {
    ...after,
    fingerprint: { innerWidth: 900, innerHeight: 675, devicePixelRatio: 2 },
  });
  assert(drifted.fingerprint.status === "drifted" &&
    drifted.fingerprint.differences.length === 2,
    "a changed viewport is not reported as drift");
  assert(drifted.evidence.some(line => line.includes("indicative, not authoritative")),
    "drift does not warn that the comparison is indicative");

  const missing = compareMeasurements(before, {
    fingerprint: after.fingerprint,
    surfaces: [{ visualParityId: "row-a", selector: "#a", found: false }],
  });
  const missingRowA = missing.surfaces.find(s => s.visualParityId === "row-a");
  assert(missingRowA.status === "not-found",
    "an element missing after is not reported as not-found");
  assert(missing.surfaces.some(s => s.status === "missing-after"),
    "a surface absent from the later measurement is not reported");
  assert(!missing.evidence.some(line => line.includes("0px")),
    "a missing element produces a measured-looking value");

  console.log("Visual measure self-test passed.");
};

// ---------------------------------------------------------------------- main

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  if (options.compare.length === 2) {
    const [before, after] = await Promise.all(
      options.compare.map(async file =>
        JSON.parse((await readFile(path.resolve(file), "utf8")).replace(/^\uFEFF/, ""))),
    );
    process.stdout.write(`${JSON.stringify(compareMeasurements(before, after), null, 2)}\n`);
    return;
  }

  if (!options.spec && !options.selector) {
    process.stdout.write(usage);
    process.exitCode = 1;
    return;
  }

  const spec = options.spec
    ? await readSpec(options.spec)
    : {
      flowId: null,
      surfaces: [{
        visualParityId: "ad-hoc",
        selector: options.selector,
        counterpartSelector: options.counterpartSelector,
        properties: options.properties,
      }],
    };

  options.label ??= "measurement";
  if (options.outDirectory) {
    options.outDirectory = path.resolve(options.outDirectory);
    await mkdir(options.outDirectory, { recursive: true });
  }

  const measured = await measureSurfaces(options, spec.surfaces);
  const result = {
    artifactType: "visual-measurement",
    label: options.label,
    flowId: spec.flowId ?? null,
    capturedAt: new Date().toISOString(),
    host: `${options.host}:${options.port}`,
    target: measured.target,
    fingerprint: measured.fingerprint,
    surfaces: measured.surfaces,
  };

  if (options.outDirectory) {
    const file = path.join(
      options.outDirectory, `visual-measurement-${options.label}.json`,
    );
    await writeFile(file, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
