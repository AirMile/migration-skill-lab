import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crc32, deflateSync, inflateSync } from "node:zlib";
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
changed, the ones that differ from their retained counterpart, and a pixel
comparison of the two screenshots, plus an
"evidence" array of one-line strings a verification-result copies verbatim into
visualCriteria.evidence, and a fingerprint verdict. A measurement pair taken at
different window sizes or pixel ratios is reported as "drifted": the comparison
is then indicative, never authoritative, because layout values are not
comparable across viewports.

A deviation from the counterpart is split in two, because React may have
deviated in the same way before anything was migrated: "introducedByMigration"
is what the before run did not show, "preExistingDeviation" is what it did.
Only the first is this slice's doing. Without a before-measurement of the
counterpart the split cannot be made, and the evidence says the cause is
unproven rather than assuming it.

Never writes to the product repository. A missing element is recorded as
found: false, never as a zero measurement.

Options:
  --port        CDP port of the host, by default 9123
  --host        CDP host, by default 127.0.0.1
  --target      substring of the page url or title to measure, needed only
                when the host exposes more than one page
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
            const id = nextId;
            // The open handshake had a timeout; a command needs its own, or a
            // host that accepts the socket and never answers hangs the skill
            // step that called it with no error to report.
            const commandTimer = setTimeout(() => {
              pending.delete(id);
              rej(new Error(`${method} did not answer within ${timeout}ms.`));
            }, timeout);
            const settle = handler => value => {
              clearTimeout(commandTimer);
              handler(value);
            };
            pending.set(id, { resolve: settle(res), reject: settle(rej) });
            socket.send(JSON.stringify({ id, method, params }));
          }),
        close: () => socket.close(),
      });
    });
  });

const internalSchemes = ["devtools://", "chrome://", "edge://", "about:"];

const connect = async ({ host, port, timeout, target: wanted }) => {
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
  // Taking the first page target once measured a browser sign-in dialog and
  // reported the real surface as missing. A host's own internal pages are
  // never the surface, and when more than one candidate is left the run says
  // so instead of guessing which one the contract meant.
  let candidates = targets.filter(
    item => item.type === "page" && item.webSocketDebuggerUrl &&
      !internalSchemes.some(scheme => (item.url ?? "").startsWith(scheme)),
  );
  if (wanted) {
    const needle = wanted.toLowerCase();
    candidates = candidates.filter(
      item => (item.url ?? "").toLowerCase().includes(needle) ||
        (item.title ?? "").toLowerCase().includes(needle),
    );
  }
  if (candidates.length === 0) {
    const seen = targets
      .map(item => `${item.type} ${item.url ?? "(no url)"}`)
      .join("; ") || "nothing";
    throw new Error(
      `${host}:${port} exposed no measurable page target${wanted ? ` matching ${wanted}` : ""}. ` +
      `It offered: ${seen}.`,
    );
  }
  if (candidates.length > 1) {
    const seen = candidates.map(item => item.url ?? "(no url)").join("; ");
    throw new Error(
      `${host}:${port} exposed ${candidates.length} page targets, so the one ` +
      `to measure is ambiguous: ${seen}. Re-run with --target <substring of ` +
      "the url or title>.",
    );
  }
  const [page] = candidates;
  const session = await openSession(page.webSocketDebuggerUrl, timeout);
  return { session, target: { title: page.title, url: page.url } };
};

// ------------------------------------------------------------------- images

// Computed styles miss anything that is painted rather than declared: a wrong
// icon, a wrong glyph, a missing background image. The screenshots already
// exist, so they are compared too. PNG is decoded here rather than by a
// library, because the lab installs nothing: CDP emits non-interlaced 8-bit
// RGB or RGBA, and anything else is refused instead of silently mis-read.
const decodePng = buffer => {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("not a PNG");
  }
  let header = null;
  const parts = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") parts.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!header) throw new Error("PNG carries no header");
  if (header.bitDepth !== 8 || header.interlace !== 0) {
    throw new Error(
      `unsupported PNG (bit depth ${header.bitDepth}, interlace ${header.interlace})`,
    );
  }
  const channels = { 2: 3, 6: 4 }[header.colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${header.colorType}`);

  const raw = inflateSync(Buffer.concat(parts));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(header.height * stride);
  for (let row = 0; row < header.height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const target = pixels.subarray(row * stride, (row + 1) * stride);
    const above = row === 0 ? null : pixels.subarray((row - 1) * stride, row * stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? target[index - channels] : 0;
      const up = above ? above[index] : 0;
      const upLeft = above && index >= channels ? above[index - channels] : 0;
      let value = source[index];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const dl = Math.abs(estimate - left);
        const du = Math.abs(estimate - up);
        const dul = Math.abs(estimate - upLeft);
        value += (dl <= du && dl <= dul) ? left : (du <= dul ? up : upLeft);
      } else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      target[index] = value & 0xff;
    }
  }
  return { ...header, channels, pixels, stride };
};

// Antialiasing moves a channel by a point or two between otherwise identical
// renders, so a pixel counts as different only past a tolerance; the largest
// channel delta is reported alongside, because that is what separates "the
// text shifted" from "the icon is a different icon".
const diffImages = (beforeBuffer, afterBuffer, tolerance = 4) => {
  let before;
  let after;
  try {
    before = decodePng(beforeBuffer);
    after = decodePng(afterBuffer);
  } catch (error) {
    return { status: "unreadable", reason: error.message };
  }
  if (before.width !== after.width || before.height !== after.height) {
    return {
      status: "different-size",
      before: `${before.width}x${before.height}`,
      after: `${after.width}x${after.height}`,
    };
  }
  const total = before.width * before.height;
  let differing = 0;
  let maxChannelDelta = 0;
  for (let pixel = 0; pixel < total; pixel += 1) {
    let worst = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const at = pixel * before.channels + channel;
      const delta = Math.abs(before.pixels[at] - after.pixels[at]);
      if (delta > worst) worst = delta;
    }
    if (worst > maxChannelDelta) maxChannelDelta = worst;
    if (worst > tolerance) differing += 1;
  }
  return {
    status: differing === 0 ? "identical" : "different",
    width: before.width,
    height: before.height,
    differingPixels: differing,
    totalPixels: total,
    percentage: Number(((differing / total) * 100).toFixed(2)),
    maxChannelDelta,
  };
};

const sha256 = buffer => createHash("sha256").update(buffer).digest("hex");

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
        const image = await captureElement(session, own.rect);
        await writeFile(path.join(options.outDirectory, file), image);
        entry.screenshot = file;
        entry.screenshotSha256 = sha256(image);
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

const compareMeasurements = (before, after, imageDiffs = new Map()) => {
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

    // A surface can differ from its retained sibling without the migration
    // having caused it: React may have differed in exactly the same way. The
    // before run measured that counterpart too, so the deviation the migration
    // introduced is the one that was not there before. Reporting every
    // deviation as the migration's doing sends flow-debug after a defect it
    // did not create.
    const nowAgainstCounterpart = later.counterpart?.found
      ? compareStyles(later.counterpart.styles, later.styles)
      : [];
    const baselineKnown = Boolean(earlier.counterpart?.found);
    const wasDeviating = new Set(
      baselineKnown
        ? compareStyles(earlier.counterpart.styles, earlier.styles)
          .map(item => item.property)
        : [],
    );
    const introduced = baselineKnown
      ? nowAgainstCounterpart.filter(item => !wasDeviating.has(item.property))
      : [];
    const preExisting = baselineKnown
      ? nowAgainstCounterpart.filter(item => wasDeviating.has(item.property))
      : [];

    const image = imageDiffs.get(id) ?? null;

    surfaces.push({
      visualParityId: id,
      status: changed.length === 0 ? "identical" : "changed",
      changed,
      againstCounterpart: nowAgainstCounterpart,
      counterpartBaseline: baselineKnown ? "measured" : "unknown",
      introducedByMigration: introduced,
      preExistingDeviation: preExisting,
      screenshot: image,
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
    for (const item of introduced) {
      evidence.push(
        `${id}: ${item.property} ${item.after} vs counterpart ${item.before} ` +
        "(deviation introduced by this migration; React matched its sibling here)",
      );
    }
    for (const item of preExisting) {
      evidence.push(
        `${id}: ${item.property} ${item.after} vs counterpart ${item.before} ` +
        "(React deviated here too; pre-existing, not caused by this migration)",
      );
    }
    if (!baselineKnown) {
      for (const item of nowAgainstCounterpart) {
        evidence.push(
          `${id}: ${item.property} ${item.after} vs counterpart ${item.before} ` +
          "(differs from retained sibling; no before-measurement of the " +
          "counterpart, so whether the migration caused it is unproven)",
        );
      }
    }
    if (image) {
      if (image.status === "identical") {
        evidence.push(`${id}: rendered pixels identical before and after`);
      } else if (image.status === "different") {
        evidence.push(
          `${id}: ${image.differingPixels} of ${image.totalPixels} pixels ` +
          `differ (${image.percentage}%, largest channel delta ` +
          `${image.maxChannelDelta}) — open ${id}-before.png and ${id}-after.png`,
        );
      } else if (image.status === "different-size") {
        evidence.push(
          `${id}: rendered box resized ${image.before} -> ${image.after}`,
        );
      } else {
        evidence.push(`${id}: screenshots could not be compared (${image.reason})`);
      }
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

  const anyChange = surfaces.some(
    s => s.status !== "identical" ||
      s.introducedByMigration?.length ||
      (s.screenshot && s.screenshot.status !== "identical"),
  );
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
      case "--target": options.target = value; break;
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
        counterpart: { found: true, styles: { paddingLeft: "16px", color: "rgb(0, 0, 0)" } },
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
        counterpart: { found: true, styles: { paddingLeft: "16px", color: "rgb(0, 0, 0)" } },
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
  assert(rowA.againstCounterpart.length === 2,
    "a difference from the retained counterpart is not reported");
  assert(rowA.counterpartBaseline === "measured",
    "a measured before-counterpart is not recognised");
  assert(rowA.introducedByMigration.length === 1 &&
    rowA.introducedByMigration[0].property === "paddingLeft",
    "the deviation this migration introduced is not isolated");
  assert(rowA.preExistingDeviation.length === 1 &&
    rowA.preExistingDeviation[0].property === "color",
    "a deviation React already had is blamed on the migration");
  assert(comparison.evidence.some(line => line.includes("pre-existing, not caused")),
    "a pre-existing deviation is not labelled as such");

  const noBaseline = compareMeasurements(
    {
      ...before,
      surfaces: [{ ...before.surfaces[0], counterpart: undefined }, before.surfaces[1]],
    },
    after,
  );
  const unproven = noBaseline.surfaces.find(s => s.visualParityId === "row-a");
  assert(unproven.counterpartBaseline === "unknown" &&
    unproven.introducedByMigration.length === 0,
    "a missing before-counterpart still asserts migration blame");
  assert(noBaseline.evidence.some(line => line.includes("unproven")),
    "a missing before-counterpart does not say the cause is unproven");

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

  // A PNG built here rather than fetched, so the decoder is checked against
  // bytes whose every pixel is known.
  const buildPng = (width, height, paint) => {
    const stride = width * 3;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y += 1) {
      raw[y * (stride + 1)] = 0;
      for (let x = 0; x < width; x += 1) {
        const [r, g, b] = paint(x, y);
        const at = y * (stride + 1) + 1 + x * 3;
        raw[at] = r; raw[at + 1] = g; raw[at + 2] = b;
      }
    }
    const chunk = (type, data) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([length, body, crc]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8; header[9] = 2; header[10] = 0; header[11] = 0; header[12] = 0;
    return Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  };

  const plain = buildPng(4, 3, () => [10, 20, 30]);
  const decoded = decodePng(plain);
  assert(decoded.width === 4 && decoded.height === 3 && decoded.channels === 3,
    "the PNG header does not decode");
  assert(decoded.pixels[0] === 10 && decoded.pixels[1] === 20 && decoded.pixels[2] === 30,
    "the PNG pixels do not decode");

  assert(diffImages(plain, plain).status === "identical",
    "a PNG does not compare equal to itself");

  const nudged = buildPng(4, 3, () => [12, 20, 30]);
  const withinTolerance = diffImages(plain, nudged);
  assert(withinTolerance.status === "identical" &&
    withinTolerance.maxChannelDelta === 2,
    "antialiasing-sized noise is reported as a difference");

  const repainted = buildPng(4, 3, (x, y) => (x === 0 && y === 0 ? [200, 0, 0] : [10, 20, 30]));
  const oneChanged = diffImages(plain, repainted);
  assert(oneChanged.status === "different" && oneChanged.differingPixels === 1,
    "a repainted pixel is not counted");
  assert(diffImages(plain, buildPng(5, 3, () => [10, 20, 30])).status === "different-size",
    "a resized capture is not reported");
  assert(diffImages(Buffer.from("not a png"), plain).status === "unreadable",
    "unreadable image data is not reported as such");

  const withImages = compareMeasurements(before, after, new Map([
    ["row-a", oneChanged],
  ]));
  assert(withImages.evidence.some(line => line.includes("of 12 pixels differ")),
    "a pixel difference produces no evidence line");

  const pixelsOnly = compareMeasurements(
    { ...before, surfaces: [before.surfaces[1]] },
    { ...after, surfaces: [after.surfaces[1]] },
    new Map([["row-b", oneChanged]]),
  );
  assert(pixelsOnly.outcome === "differences-found",
    "a surface whose styles match but whose pixels differ is called unchanged");

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
    const files = options.compare.map(file => path.resolve(file));
    const [before, after] = await Promise.all(
      files.map(async file =>
        JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""))),
    );
    // The PNGs sit beside the measurement that names them, so a comparison
    // reads them from each file's own directory rather than the working one.
    const imageDiffs = new Map();
    for (const earlier of before.surfaces) {
      const later = after.surfaces.find(
        s => s.visualParityId === earlier.visualParityId,
      );
      if (!earlier.screenshot || !later?.screenshot) continue;
      try {
        const [earlierImage, laterImage] = await Promise.all([
          readFile(path.join(path.dirname(files[0]), earlier.screenshot)),
          readFile(path.join(path.dirname(files[1]), later.screenshot)),
        ]);
        imageDiffs.set(earlier.visualParityId, diffImages(earlierImage, laterImage));
      } catch (error) {
        imageDiffs.set(earlier.visualParityId, {
          status: "unreadable", reason: error.message,
        });
      }
    }
    process.stdout.write(
      `${JSON.stringify(compareMeasurements(before, after, imageDiffs), null, 2)}\n`,
    );
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
