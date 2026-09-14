import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The Angular rules in docs\project-constants.md that a pattern finds without
// guessing. run-context.mjs runs them over a contract's write allowlist, so
// flow-migrate, flow-debug and flow-verify read findings instead of rereading
// the rules, and a clean slice costs one empty array.

const usage = `Usage:
  node scripts/angular-conventions.mjs --self-test
  import { checkAngularSource, scanAngularConventions } from "./angular-conventions.mjs";

checkAngularSource(source, filePath) returns one { path, line, rule, constant }
per finding; constant names the project-constants heading that holds the rule.
scanAngularConventions(productRoot, allowedPaths) checks every .ts file under
the allowed paths that sits in a folder named angular, except tests, stories and
declaration files, and returns the findings sorted by path and line.

Rules: on-push, signal-io, inject, zoneless, stable-api, static-styles.
`;

const CHANGE_DETECTION = "Change detection";
const COMPILATION = "Compilation";

// APIs that are developer preview or experimental on Angular 19, by module.
const unstableImports = {
  "@angular/core": ["linkedSignal", "resource"],
  "@angular/common/http": ["httpResource"],
};
const unstableModules = ["@angular/core/rxjs-interop", "@angular/forms/signals"];

// Blank comments while keeping every newline, so indexes still map to lines.
const withoutComments = source =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, comment => " ".repeat(comment.length));

const lineOf = (source, index) => source.slice(0, index).split("\n").length;

export const checkAngularSource = (source, filePath) => {
  const code = withoutComments(source.replace(/\r\n/g, "\n"));
  const findings = [];
  const add = (index, rule, constant) =>
    findings.push({ path: filePath, line: lineOf(code, index), rule, constant });

  // A decorator's arguments run up to the class it decorates.
  for (const match of code.matchAll(/@Component\s*\(/g)) {
    const classAt = code.slice(match.index).search(/\bclass\s+\w/);
    const decorator = classAt === -1 ? code.slice(match.index) : code.slice(match.index, match.index + classAt);
    if (!/ChangeDetectionStrategy\.OnPush\b/.test(decorator)) add(match.index, "on-push", CHANGE_DETECTION);
    for (const literal of decorator.matchAll(/\b(?:styles|template)\s*:\s*\[?\s*`((?:[^`\\]|\\.)*)`/g)) {
      if (literal[1].includes("${")) add(match.index + literal.index, "static-styles", COMPILATION);
    }
  }

  for (const match of code.matchAll(/@(?:Input|Output)\s*\(/g)) add(match.index, "signal-io", COMPILATION);

  if (/@(?:Component|Directive|Injectable|Pipe)\s*\(/.test(code)) {
    for (const match of code.matchAll(/\bconstructor\s*\(\s*[^)\s]/g)) add(match.index, "inject", COMPILATION);
  }

  for (const match of code.matchAll(/\bimport\s+(?:[^"';]*?\bfrom\s+)?["']zone\.js(?:\/[^"']*)?["']|\bNgZone\b/g)) {
    add(match.index, "zoneless", CHANGE_DETECTION);
  }

  for (const match of code.matchAll(/\bimport\s+(?:type\s+)?([^"';]*?)\s*\bfrom\s+["']([^"']+)["']/g)) {
    const [, clause, moduleName] = match;
    const named = (/\{([^}]*)\}/.exec(clause)?.[1] ?? "")
      .split(",")
      .map(entry => entry.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0])
      .filter(Boolean);
    if (unstableModules.includes(moduleName) ||
      named.some(name => unstableImports[moduleName]?.includes(name))) {
      add(match.index, "stable-api", CHANGE_DETECTION);
    }
  }

  return findings.sort((left, right) => left.line - right.line);
};

const isAngularSource = relativePath => {
  const segments = relativePath.split("/");
  const name = segments.at(-1);
  return segments.slice(0, -1).includes("angular") &&
    !segments.includes("__tests__") &&
    name.endsWith(".ts") &&
    !/\.(?:spec|test|stories|d)\.ts$/.test(name);
};

const skippedFolders = new Set([".git", "node_modules", "dist", "coverage"]);

const collectFiles = async (root, relativePath, files) => {
  const absolute = path.join(root, relativePath);
  const entry = await stat(absolute).catch(() => null);
  if (!entry) return;
  if (entry.isFile()) {
    files.add(relativePath);
    return;
  }
  if (!entry.isDirectory()) return;
  for (const child of await readdir(absolute, { withFileTypes: true })) {
    if (child.isDirectory() && skippedFolders.has(child.name)) continue;
    await collectFiles(root, relativePath === "." ? child.name : `${relativePath}/${child.name}`, files);
  }
};

export const scanAngularConventions = async (productRoot, allowedPaths) => {
  const files = new Set();
  for (const allowed of allowedPaths) await collectFiles(productRoot, allowed, files);
  const findings = [];
  for (const file of [...files].filter(isAngularSource).sort()) {
    findings.push(...checkAngularSource(await readFile(path.join(productRoot, file), "utf8"), file));
  }
  return findings;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Angular conventions self-test failed: ${message}`);
};

const rulesOf = findings => findings.map(finding => `${finding.rule}:${finding.line}`).join(",");

const runSelfTest = () => {
  const clean = [
    'import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from "@angular/core";',
    'import { DestroyRef } from "@angular/core";',
    "",
    "// @Input() in a comment is not a finding, nor is NgZone.",
    "@Component({",
    '  selector: "ra-line-fields",',
    "  changeDetection: ChangeDetectionStrategy.OnPush,",
    "  styles: `:host { color: var(--line-color); }`,",
    "  template: `<span>{{ length() }}</span>`,",
    "})",
    "export class LineFieldsComponent {",
    "  private readonly destroyRef = inject(DestroyRef);",
    "  readonly length = input<number>(0);",
    "  readonly changed = output<number>();",
    "  constructor() {}",
    "}",
  ].join("\r\n");
  assert(checkAngularSource(clean, "a.ts").length === 0,
    `a component that follows every rule has findings ${rulesOf(checkAngularSource(clean, "a.ts"))}`);

  const broken = [
    'import { Component, Input, NgZone, linkedSignal } from "@angular/core";',
    'import { toSignal } from "@angular/core/rxjs-interop";',
    'import { httpResource as load } from "@angular/common/http";',
    'import "zone.js";',
    "@Component({",
    '  selector: "ra-broken",',
    "  styles: [`:host { color: ${color}; }`],",
    "})",
    "export class BrokenComponent {",
    "  @Input() length = 0;",
    "  constructor(private readonly zone: NgZone) {}",
    "}",
  ].join("\n");
  const found = rulesOf(checkAngularSource(broken, "b.ts"));
  const expected = [
    "zoneless:1", "stable-api:1", "stable-api:2", "stable-api:3", "zoneless:4",
    "on-push:5", "static-styles:7", "signal-io:10", "inject:11", "zoneless:11",
  ];
  for (const entry of expected) assert(found.split(",").includes(entry), `missing ${entry} in ${found}`);
  assert(found.split(",").length === expected.length, `unexpected findings in ${found}`);

  const service = 'import { Injectable } from "@angular/core";\nexport const resource = () => 1;\n@Injectable({ providedIn: "root" })\nexport class S {}\n';
  assert(checkAngularSource(service, "c.ts").length === 0,
    "a local function named resource, not imported from @angular/core, is a finding");

  assert(isAngularSource("src/angular/domains/route/line.component.ts") &&
    isAngularSource("src/app/lineForm/angular/mount-line-fields.ts") &&
    !isAngularSource("src/angular/domains/route/__tests__/line.component.spec.ts") &&
    !isAngularSource("src/angular/shared/line.stories.ts") &&
    !isAngularSource("src/app/angularish/line.ts") &&
    !isAngularSource("src/angular/README.md"),
    "the Angular file filter selects the wrong files");

  console.log("Angular conventions self-test passed.");
};

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length === 1 && argumentsList[0] === "--self-test") {
    try {
      runSelfTest();
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  } else {
    process.stdout.write(usage);
    process.exitCode = argumentsList.length === 1 && argumentsList[0] === "--help" ? 0 : 1;
  }
}
