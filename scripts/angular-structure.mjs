import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Where a React file's Angular counterpart lives is a project decision, kept as
// data in docs\angular-structure.json. This module applies it, so every run
// reads one measured target instead of deriving a path by hand.

const usage = `Usage:
  node scripts/angular-structure.mjs --self-test
  import { loadStructure, createResolver, checkStructure } from "./angular-structure.mjs";

loadStructure(file) reads an angular-structure.json and refuses one whose rules
the engine cannot apply. createResolver(spec, { isReactBound, importersOf,
siblingsOf }) returns resolve(path), domainOf(path) and usageDomains(path) for
product paths, relative with forward slashes. The caller supplies the
product's facts: isReactBound(path) from its value-import graph,
importersOf(path) as the source files that value-import it, and
siblingsOf(path) as every file in the folder that holds path.
checkStructure(resolver, files) resolves every file and returns the count per
outcome, the files no rule matches, and each target two or more files move to.

Rules are ordered and the first match wins. A file already under the root is
Angular code in place. A rule with placeByUsage takes its oneDomain target when
every user of the file sits in one domain, found by walking importers up until
each path reaches a file with a domain. A test goes with the file it tests,
found by name in its own folder or in the parent of __tests__, as
<subject target folder>/__tests__/<subject target stem>.spec.ts, or takes that
file's stay or retire outcome; a test with no such file falls back to the rules.

scripts/migration-map.mjs --measure is the caller on a real product.

Options:
  --self-test   run the built-in checks
  --help        print this text
`;

const outcomes = new Set(["move", "stay", "retire", "merge"]);
const nameStyles = new Set(["auto", "service", "store", "page", "keep", "asis"]);
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];

const toProductPath = value =>
  value.replaceAll("\\", "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "");

const covers = (basePath, candidatePath) =>
  candidatePath === basePath || candidatePath.startsWith(`${basePath}/`);

const isTestFile = file => /\.(test|spec)\.[tj]sx?$/.test(file);

const kebab = name => name
  .replace(/[_\s]+/g, "-")
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
  .replace(/-+/g, "-")
  .toLowerCase();

const kebabDotted = value => value.split(".").map(kebab).join(".");

// The rules need three glob forms: ** across folders, * within one and {a,b}.
// The last capture is the remainder {rest} carries over.
const globToRegExp = glob => {
  let pattern = "";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === "{") {
      const end = glob.indexOf("}", index);
      const alternatives = glob.slice(index + 1, end).split(",")
        .map(alternative => alternative.replace(/[.+^$()|[\]\\]/g, "\\$&"));
      pattern += `(?:${alternatives.join("|")})`;
      index = end;
    } else if (character === "*" && glob[index + 1] === "*") {
      if (glob[index + 2] === "/") {
        pattern += "(?:(.*)/)?";
        index += 2;
      } else {
        pattern += "(.*)";
        index += 1;
      }
    } else if (character === "*") {
      pattern += "([^/]*)";
    } else if (".+^$()|[]\\".includes(character)) {
      pattern += `\\${character}`;
    } else {
      pattern += character;
    }
  }
  return new RegExp(`^${pattern}$`);
};

// `X.logic.ts` is stem X with marker logic; the `.d` of a `.d.ts` is no marker.
const splitBase = fileName => {
  const parts = fileName.split(".");
  if (parts.length === 1) return { stem: fileName, marker: "", isTsx: false };
  const extension = parts.at(-1);
  return {
    stem: parts[0],
    marker: parts.slice(1, -1).filter(part => part !== "d").join("."),
    isTsx: extension === "tsx" || extension === "jsx",
  };
};

// The carried-over remainder of a React path in its Angular shape: kebab-cased
// folders and a file renamed by the rule's nameStyle.
const angularize = (restSegments, nameStyle, siblingNames, parentName) => {
  const rawDirectories = restSegments.slice(0, -1);
  const fileName = restSegments.at(-1);
  const directories = rawDirectories.map(directory =>
    directory === "__test__" || directory === "__tests__" ? "__tests__" : kebab(directory));
  const parent = rawDirectories.length ? rawDirectories.at(-1) : parentName ?? "";
  const { stem, marker, isTsx } = splitBase(fileName);
  const markers = marker ? marker.split(".") : [];
  const lastMarker = markers.at(-1);

  if (nameStyle === "asis") return { directories, file: fileName };
  if (lastMarker === "test" || lastMarker === "spec") {
    if (directories.at(-1) !== "__tests__") directories.push("__tests__");
    return { directories, file: `${kebabDotted([stem, ...markers.slice(0, -1)].join("."))}.spec.ts` };
  }
  if (marker === "styles") return { directories, file: `${kebab(stem)}.component.css` };
  if (marker === "stories") return { directories, file: `${kebab(stem)}.stories.ts` };
  if (marker && marker !== "types") {
    return { directories: [...directories, "utils"], file: `${kebabDotted(`${stem}.${marker}`)}.ts` };
  }
  if (stem === "index") {
    const base = kebab(parent || "index");
    // Another file in the folder already carries its name: a re-export barrel.
    if (siblingNames.some(name => {
      const sibling = splitBase(name);
      return sibling.marker === "" && sibling.stem !== "index" && kebab(sibling.stem) === base;
    })) {
      return { directories, file: null, barrel: true };
    }
    if (isTsx) return { directories, file: `${base}.component.ts` };
    if (nameStyle === "service" || /^use[A-Z]/.test(parent)) {
      return { directories, file: `${kebab(parent.replace(/^use/, ""))}.service.ts` };
    }
    return { directories, file: `${base}.ts` };
  }
  if (nameStyle === "page") return { directories: [], file: `${kebab(stem.replace(/Page$/, ""))}.component.ts` };
  if (nameStyle === "keep") return { directories, file: `${kebab(stem)}.ts` };
  if (nameStyle === "store") {
    const base = stem.replace(/^use/, "").replace(/(Context|Provider|Store)$/, "");
    return { directories, file: `${kebab(base)}.store.ts` };
  }
  if (nameStyle === "service" || /^use[A-Z]/.test(stem)) {
    return { directories, file: `${kebab(stem.replace(/^use/, ""))}.service.ts` };
  }
  if (isTsx) return { directories, file: `${kebab(stem)}.component.ts` };
  if (marker === "types" || /^I[A-Z]/.test(stem) || /Types$/.test(stem)) {
    return { directories: [...directories, "models"], file: `${kebab(stem)}.model.ts` };
  }
  if (/^E[A-Z]/.test(stem)) return { directories: [...directories, "enums"], file: `${kebab(stem)}.enum.ts` };
  return { directories: [...directories, "utils"], file: `${kebab(stem)}.ts` };
};

const structureProblems = spec => {
  const problems = [];
  if (typeof spec?.root !== "string" || !spec.root) return ["root must name the Angular root folder."];
  if (!Array.isArray(spec.rules) || spec.rules.length === 0) return ["rules must be a non-empty list."];
  const tables = spec.tables ?? {};
  const ids = new Set();
  for (const [index, rule] of spec.rules.entries()) {
    const location = `rules[${index}]${rule?.id ? ` (${rule.id})` : ""}`;
    if (typeof rule?.id !== "string" || !rule.id) problems.push(`${location} needs an id.`);
    else if (ids.has(rule.id)) problems.push(`${location} repeats its id.`);
    ids.add(rule?.id);
    if (typeof rule?.match !== "string" || !rule.match) problems.push(`${location} needs a match glob.`);
    if (!outcomes.has(rule?.outcome)) problems.push(`${location}.outcome must be move, stay, retire or merge.`);
    const placesFile = rule?.outcome === "move" || rule?.outcome === "merge";
    const hasTarget = typeof rule?.target === "string";
    const byUsage = rule?.placeByUsage;
    if (placesFile && hasTarget === Boolean(byUsage)) {
      problems.push(`${location} needs exactly one of target and placeByUsage.`);
    }
    if (!placesFile && (hasTarget || byUsage)) problems.push(`${location} places no file, so it has no target.`);
    if (byUsage && (typeof byUsage.oneDomain !== "string" || typeof byUsage.otherwise !== "string")) {
      problems.push(`${location}.placeByUsage needs oneDomain and otherwise.`);
    }
    if (rule?.nameStyle !== undefined && !nameStyles.has(rule.nameStyle)) {
      problems.push(`${location}.nameStyle ${rule.nameStyle} is not one the engine knows.`);
    }
    if (rule?.when !== undefined && typeof rule.when?.reactBound !== "boolean") {
      problems.push(`${location}.when needs a boolean reactBound.`);
    }
    if (rule?.domainFrom) {
      if (!tables[rule.domainFrom.table]) problems.push(`${location}.domainFrom names no table ${rule.domainFrom.table}.`);
      if (!/^(basename|testSubject|segment:\d+)$/.test(rule.domainFrom.keyFrom ?? "")) {
        problems.push(`${location}.domainFrom.keyFrom must be basename, testSubject or segment:<n>.`);
      }
    }
  }
  if (spec.usage?.ignoreImporters !== undefined && !Array.isArray(spec.usage.ignoreImporters)) {
    problems.push("usage.ignoreImporters must be a list of product paths.");
  }
  return problems;
};

const assertUsable = (spec, label) => {
  const problems = structureProblems(spec);
  if (problems.length > 0) {
    throw new Error(`${label} is not a usable angular-structure:\n- ${problems.join("\n- ")}`);
  }
};

export const loadStructure = file => {
  const spec = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  assertUsable(spec, file);
  return spec;
};

export const createResolver = (spec, facts = {}) => {
  assertUsable(spec, "The structure");
  const isReactBound = facts.isReactBound ?? (file => /\.(tsx|jsx)$/.test(file));
  const importersOf = facts.importersOf ?? (() => []);
  const siblingsOf = facts.siblingsOf ?? (() => []);
  const root = toProductPath(spec.root);
  const rules = spec.rules.map(rule => ({ ...rule, pattern: globToRegExp(rule.match) }));
  const ignored = new Set((spec.usage?.ignoreImporters ?? []).map(toProductPath));
  const island = spec.preprocess?.islandFolder;
  const domainPattern = new RegExp(`^${root.replace(/[.+^$()|[\]\\]/g, "\\$&")}/domains/([^/]+)/`);
  const domainOfTarget = target => (target && domainPattern.exec(target)?.[1]) ?? null;
  const siblingNames = file => siblingsOf(file).map(sibling => path.posix.basename(toProductPath(sibling)));

  // usageDomains is null when resolving a user during the walk: a file placed
  // by usage has no domain of its own there, so the walk passes through it.
  const resolveByRules = (file, usageDomainsOf) => {
    let ruled = file;
    let forcedNameStyle = null;
    if (island) {
      const segments = file.split("/");
      const at = segments.lastIndexOf(island);
      if (at !== -1 && at < segments.length - 1) {
        const lifted = [...segments.slice(0, at), ...segments.slice(at + 1)].join("/");
        // A .tsx file in an island is the React host that mounts it.
        if (/\.(tsx|jsx)$/.test(file)) {
          return { rule: "island-react-host", outcome: "move", target: lifted, domain: null };
        }
        ruled = lifted;
        forcedNameStyle = "asis";
      }
    }
    for (const rule of rules) {
      const match = rule.pattern.exec(ruled);
      if (!match) continue;
      if (rule.when && isReactBound(file) !== rule.when.reactBound) continue;
      if (rule.outcome !== "move" && rule.outcome !== "merge") {
        return { rule: rule.id, outcome: rule.outcome, target: null, domain: null };
      }

      let domain = "";
      let page = "";
      if (rule.domainFrom) {
        const { table, keyFrom } = rule.domainFrom;
        const base = splitBase(path.posix.basename(ruled)).stem;
        const key = keyFrom === "basename" ? base :
          keyFrom === "testSubject" ? base.replace(/\.(test|spec)$/, "") :
          ruled.split("/")[Number(keyFrom.split(":")[1])];
        const entry = spec.tables[table][key];
        if (entry === undefined) {
          return { rule: rule.id, outcome: "unresolved", target: null, domain: null, missingKey: key, table };
        }
        domain = typeof entry === "string" ? entry : entry.domain;
        page = typeof entry === "string" ? "" : entry.page;
      }
      let template = rule.target;
      if (rule.placeByUsage) {
        if (!usageDomainsOf) return { rule: rule.id, outcome: rule.outcome, target: null, domain: null };
        const users = usageDomainsOf(file);
        template = users.length === 1 ? rule.placeByUsage.oneDomain : rule.placeByUsage.otherwise;
        domain = users.length === 1 ? users[0] : "";
      }

      const captures = match.slice(1).filter(capture => capture !== undefined);
      const restSegments = (captures.length ? captures.at(-1) : path.posix.basename(ruled))
        .split("/").filter(Boolean);
      if (restSegments.length === 0) restSegments.push(path.posix.basename(ruled));
      const named = angularize(
        restSegments,
        forcedNameStyle ?? rule.nameStyle ?? "auto",
        siblingNames(ruled),
        ruled.split("/").at(-2),
      );
      if (named.barrel) return { rule: rule.id, outcome: "retire", target: null, domain: null, why: "re-export barrel" };
      const feature = kebab((ruled.split("/")[2] ?? "").replace(/Page$/, ""));
      const target = template
        .replace("{root}", root)
        .replace("{domain}", domain)
        .replace("{page}", page)
        .replace("{feature}", feature)
        .replace("{file}", `${named.directories.includes("__tests__") ? "__tests__/" : ""}${named.file}`)
        .replace("{rest}", [...named.directories, named.file].join("/"))
        .replace(/\/+/g, "/");
      return { rule: rule.id, outcome: rule.outcome, target, domain: domainOfTarget(target) };
    }
    return { rule: null, outcome: "unmatched", target: null, domain: null };
  };

  const ownDomains = new Map();
  const ownDomainOf = file => {
    if (!ownDomains.has(file)) {
      ownDomains.set(file, covers(root, file) ? domainOfTarget(file) : resolveByRules(file, null).domain);
    }
    return ownDomains.get(file);
  };

  const usages = new Map();
  const usageDomains = file => {
    const start = toProductPath(file);
    if (usages.has(start)) return usages.get(start);
    const domains = new Set();
    const seen = new Set([start]);
    const queue = [start];
    for (let index = 0; index < queue.length; index += 1) {
      for (const importer of importersOf(queue[index]).map(toProductPath)) {
        if (seen.has(importer) || ignored.has(importer)) continue;
        seen.add(importer);
        const domain = ownDomainOf(importer);
        if (domain) domains.add(domain);
        else queue.push(importer);
      }
    }
    const result = [...domains].sort();
    usages.set(start, result);
    return result;
  };

  // A test goes where the file it tests goes, named after that file's target.
  const resolveTest = file => {
    const directory = path.posix.dirname(file);
    const name = path.posix.basename(file).replace(/\.(test|spec)\.[tj]sx?$/, "");
    const folders = [directory];
    if (/^__tests?__$/.test(path.posix.basename(directory))) folders.push(path.posix.dirname(directory));
    for (const folder of folders) {
      const present = new Set(siblingsOf(`${folder}/${name}`).map(toProductPath));
      const subject = sourceExtensions.map(extension => `${folder}/${name}${extension}`)
        .find(candidate => present.has(candidate));
      if (!subject) continue;
      const placed = resolve(subject);
      if (placed.outcome !== "move" && placed.outcome !== "merge") {
        return { rule: placed.rule, outcome: placed.outcome, target: null, domain: null, subject };
      }
      // A React host's test stays React, which the rules already say.
      if (!covers(root, placed.target)) return null;
      const stem = path.posix.basename(placed.target).replace(/\.[tj]s$/, "");
      return {
        rule: placed.rule,
        outcome: placed.outcome,
        target: `${path.posix.dirname(placed.target)}/__tests__/${stem}.spec.ts`,
        domain: placed.domain,
        subject,
      };
    }
    return null;
  };

  const resolved = new Map();
  const resolve = file => {
    const productPath = toProductPath(file);
    if (!resolved.has(productPath)) {
      resolved.set(productPath, covers(root, productPath) ?
        { rule: "angular-root", outcome: "angular", target: productPath, domain: domainOfTarget(productPath) } :
        (isTestFile(productPath) && resolveTest(productPath)) || resolveByRules(productPath, usageDomains));
    }
    return resolved.get(productPath);
  };

  return {
    root,
    resolve,
    domainOf: file => resolve(file).domain,
    usageDomains,
  };
};

export const checkStructure = (resolver, files) => {
  const results = [...new Set(files.map(toProductPath))].sort()
    .map(file => ({ file, ...resolver.resolve(file) }));
  const counts = {};
  for (const result of results) counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
  const unmatched = results
    .filter(result => result.outcome === "unmatched" || result.outcome === "unresolved")
    .map(result => ({
      file: result.file,
      why: result.outcome,
      ...(result.missingKey === undefined ? {} : { missingKey: result.missingKey, table: result.table }),
    }));
  // A merge names a counterpart another file already moves to, and a file in
  // place is such a counterpart, so only two moves can collide.
  const byTarget = new Map();
  for (const result of results.filter(entry => entry.outcome === "move")) {
    if (!byTarget.has(result.target)) byTarget.set(result.target, []);
    byTarget.get(result.target).push(result.file);
  }
  return {
    results,
    counts: Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))),
    unmatched,
    collisions: [...byTarget.entries()]
      .filter(([, sources]) => sources.length > 1)
      .map(([target, sources]) => ({ target, sources })),
  };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Angular structure self-test failed: ${message}`);
};

const runSelfTest = () => {
  const spec = {
    root: "src/angular",
    usage: { ignoreImporters: ["src/app/App.tsx"] },
    tables: {
      featureDomain: { alpha: "north", beta: "south" },
      pageDomain: { AlphaPage: { domain: "north", page: "alpha" } },
    },
    preprocess: { islandFolder: "angular" },
    rules: [
      { id: "non-source", match: "**/*.{json,d.ts}", outcome: "stay" },
      { id: "shell", match: "src/app/App.tsx", outcome: "move", target: "{root}/app.component.ts" },
      { id: "pages", match: "src/app/pages/**", outcome: "move",
        domainFrom: { table: "pageDomain", keyFrom: "basename" },
        target: "{root}/domains/{domain}/pages/{page}/{file}", nameStyle: "page" },
      { id: "translation-hook", match: "src/app/useTranslation.ts", outcome: "merge",
        target: "{root}/core/i18n/translation.service.ts" },
      { id: "translation", match: "src/app/TranslationProvider.tsx", outcome: "move",
        target: "{root}/core/i18n/translation.service.ts" },
      { id: "state", match: "src/state/**", outcome: "move",
        placeByUsage: { oneDomain: "{root}/domains/{domain}/store/{rest}", otherwise: "{root}/core/store/{rest}" },
        nameStyle: "store" },
      { id: "hooks", match: "src/hooks/**", outcome: "move",
        placeByUsage: { oneDomain: "{root}/domains/{domain}/services/{rest}", otherwise: "{root}/shared/services/{rest}" },
        nameStyle: "service" },
      { id: "utils-agnostic", match: "src/utils/**", when: { reactBound: false }, outcome: "stay" },
      { id: "utils", match: "src/utils/**", outcome: "move", target: "{root}/shared/utils/{rest}" },
      { id: "theme", match: "src/components/Theme.tsx", outcome: "retire" },
      { id: "components", match: "src/components/**", outcome: "move", target: "{root}/shared/components/{rest}" },
      { id: "features", match: "src/features/*/**", outcome: "move",
        domainFrom: { table: "featureDomain", keyFrom: "segment:2" },
        target: "{root}/domains/{domain}/pages/{feature}/{rest}" },
    ],
  };
  const files = [
    "src/app/App.tsx",
    "src/app/pages/AlphaPage.tsx",
    "src/app/useTranslation.ts",
    "src/app/TranslationProvider.tsx",
    "src/state/LineStore.ts",
    "src/state/useSharedSettings.tsx",
    "src/state/useShellOnly.tsx",
    "src/state/__tests__/LineStore.test.ts",
    "src/state/__test__/useSharedSettings.test.tsx",
    "src/hooks/useLines.ts",
    "src/utils/format.ts",
    "src/utils/format.test.ts",
    "src/utils/bound.ts",
    "src/components/Theme.tsx",
    "src/components/Theme.test.tsx",
    "src/components/button/Button.tsx",
    "src/components/button/Button.styles.ts",
    "src/components/button/Button.stories.tsx",
    "src/components/button/index.ts",
    "src/components/button/__tests__/Button.test.tsx",
    "src/components/button/__tests__/Button.integration.test.tsx",
    "src/components/input/index.tsx",
    "src/components/input/IInputProps.ts",
    "src/components/input/EInputKind.ts",
    "src/features/alpha/AlphaForm.tsx",
    "src/features/alpha/AlphaForm.logic.ts",
    "src/features/alpha/lineForm/angular/line-fields.component.ts",
    "src/features/alpha/lineForm/angular/AngularHost.tsx",
    "src/features/alpha/lineForm/Dup.tsx",
    "src/features/alpha/line-form/dup.tsx",
    "src/features/alpha/lineUtils.ts",
    "src/features/beta/BetaForm.tsx",
    "src/features/gamma/Gamma.tsx",
    "src/angular/domains/north/store/line.store.ts",
    "src/other/Loose.ts",
  ];
  const importers = {
    "src/state/LineStore.ts": ["src/features/alpha/AlphaForm.tsx", "src/features/alpha/lineUtils.ts"],
    "src/state/useSharedSettings.tsx": ["src/features/alpha/AlphaForm.tsx", "src/utils/bound.ts"],
    "src/utils/bound.ts": ["src/features/beta/BetaForm.tsx"],
    "src/state/useShellOnly.tsx": ["src/app/App.tsx"],
    "src/hooks/useLines.ts": ["src/state/LineStore.ts"],
  };
  const resolver = createResolver(spec, {
    isReactBound: file => file.endsWith(".tsx") || file === "src/utils/bound.ts",
    importersOf: file => importers[file] ?? [],
    siblingsOf: file => files.filter(entry => path.posix.dirname(entry) === path.posix.dirname(file)),
  });
  const expectTarget = (file, target, label) => {
    const actual = resolver.resolve(file);
    assert(actual.target === target, `${label}: ${file} went to ${actual.target} (${actual.outcome})`);
  };
  const expectOutcome = (file, outcome, label) => {
    const actual = resolver.resolve(file);
    assert(actual.outcome === outcome, `${label}: ${file} is ${actual.outcome}, not ${outcome}`);
  };

  assert(globToRegExp("src/**/*.{ts,tsx}").test("src/a/b/c.tsx") && globToRegExp("src/**/*.{ts,tsx}").test("src/c.ts") &&
    !globToRegExp("src/*").test("src/a/b.ts"), "a glob matches the wrong paths");

  expectTarget("src/app/pages/AlphaPage.tsx", "src/angular/domains/north/pages/alpha/alpha.component.ts",
    "a page does not land in its domain's page folder");
  expectTarget("src/components/button/Button.tsx", "src/angular/shared/components/button/button.component.ts",
    "a component is not renamed");
  expectTarget("src/components/button/Button.styles.ts", "src/angular/shared/components/button/button.component.css",
    "a styles sidecar is not a component stylesheet");
  expectTarget("src/components/button/Button.stories.tsx", "src/angular/shared/components/button/button.stories.ts",
    "a story is not renamed");
  expectOutcome("src/components/button/index.ts", "retire", "a re-export barrel is not retired");
  expectTarget("src/components/input/index.tsx", "src/angular/shared/components/input/input.component.ts",
    "a folder entry component is not named after its folder");
  expectTarget("src/components/input/IInputProps.ts", "src/angular/shared/components/input/models/i-input-props.model.ts",
    "an interface file is not a model");
  expectTarget("src/components/input/EInputKind.ts", "src/angular/shared/components/input/enums/e-input-kind.enum.ts",
    "an enum file is not an enum");
  expectTarget("src/features/alpha/AlphaForm.logic.ts", "src/angular/domains/north/pages/alpha/utils/alpha-form.logic.ts",
    "a helper sidecar is not a util");
  expectTarget("src/features/alpha/lineForm/angular/line-fields.component.ts",
    "src/angular/domains/north/pages/alpha/line-form/line-fields.component.ts",
    "an island file does not keep its name where its React parent goes");
  expectTarget("src/features/alpha/lineForm/angular/AngularHost.tsx", "src/features/alpha/lineForm/AngularHost.tsx",
    "an island's React host does not move one folder up");
  expectOutcome("src/components/Theme.tsx", "retire", "a retire rule does not retire");
  expectOutcome("src/utils/format.ts", "stay", "a framework-agnostic file does not stay");
  expectTarget("src/utils/bound.ts", "src/angular/shared/utils/utils/bound.ts",
    "React-boundness does not come from the caller");
  expectOutcome("src/features/gamma/Gamma.tsx", "unresolved", "a feature with no domain is not reported");
  expectOutcome("src/other/Loose.ts", "unmatched", "a file no rule matches is not reported");
  expectOutcome("src/angular/domains/north/store/line.store.ts", "angular", "a file under the root is not in place");

  // Usage: one domain, several, only the shell, and a walk through a user
  // without a domain of its own.
  assert(JSON.stringify(resolver.usageDomains("src/state/LineStore.ts")) === JSON.stringify(["north"]),
    "a file used by one domain does not report that domain");
  expectTarget("src/state/LineStore.ts", "src/angular/domains/north/store/line.store.ts",
    "state used by one domain does not land in that domain's store");
  expectTarget("src/state/useSharedSettings.tsx", "src/angular/core/store/shared-settings.store.ts",
    "state used by two domains, one through a domain-less util, does not land in core");
  expectTarget("src/state/useShellOnly.tsx", "src/angular/core/store/shell-only.store.ts",
    "state only the shell composes does not land in core");
  expectTarget("src/hooks/useLines.ts", "src/angular/domains/north/services/lines.service.ts",
    "a hook used through a store placed by usage does not follow that store's users");
  assert(resolver.domainOf("src/hooks/useLines.ts") === "north" && resolver.domainOf("src/utils/format.ts") === null,
    "domainOf does not report the placed domain");

  // Tests go with their subject.
  expectTarget("src/state/__tests__/LineStore.test.ts", "src/angular/domains/north/store/__tests__/line.store.spec.ts",
    "a test in __tests__ is not named after its subject's target");
  expectTarget("src/state/__test__/useSharedSettings.test.tsx", "src/angular/core/store/__tests__/shared-settings.store.spec.ts",
    "a test in __test__ does not find its subject in the parent folder");
  expectOutcome("src/utils/format.test.ts", "stay", "a test of a staying file does not stay");
  expectOutcome("src/components/Theme.test.tsx", "retire", "a test of a retired file is not retired");
  expectTarget("src/components/button/__tests__/Button.test.tsx",
    "src/angular/shared/components/button/__tests__/button.component.spec.ts",
    "a component test is not named after the component file");
  expectTarget("src/components/button/__tests__/Button.integration.test.tsx",
    "src/angular/shared/components/button/__tests__/button.integration.spec.ts",
    "a test without a subject does not fall back to the rules");

  const check = checkStructure(resolver, files);
  assert(JSON.stringify(check.unmatched.map(entry => entry.file)) === JSON.stringify(["src/features/gamma/Gamma.tsx", "src/other/Loose.ts"]) &&
    check.unmatched[0].missingKey === "gamma" && check.unmatched[0].table === "featureDomain",
    `the unmatched files are ${JSON.stringify(check.unmatched)}`);
  assert(check.collisions.length === 1 &&
    check.collisions[0].target === "src/angular/domains/north/pages/alpha/line-form/dup.component.ts" &&
    check.collisions[0].sources.length === 2,
    `the collisions are ${JSON.stringify(check.collisions)}; two files moving to one path are not one collision, or a merge is`);
  assert(check.counts.merge === 1 && check.counts.angular === 1, `the counts are ${JSON.stringify(check.counts)}`);

  let refused = "";
  try {
    createResolver({ root: "src/angular", rules: [{ id: "x", match: "src/**", outcome: "move" }] });
  } catch (error) {
    refused = error.message;
  }
  assert(refused.includes("exactly one of target and placeByUsage"), "a move rule without a target is accepted");

  // The decided structure loads, and the first slice's relocation it records
  // is what the engine computes.
  const decided = loadStructure(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "angular-structure.json"));
  const relocation = Object.entries(decided.firstSliceRelocation ?? {}).filter(([key]) => key.startsWith("src/"));
  const home = /`~` is `([^`]+)`/.exec(decided.firstSliceRelocation?.note ?? "")?.[1];
  const relocated = relocation.map(([file]) => file);
  const decidedResolver = createResolver(decided, {
    isReactBound: file => /\.(tsx|jsx)$/.test(file),
    siblingsOf: file => relocated.filter(entry => path.posix.dirname(entry) === path.posix.dirname(file)),
  });
  assert(home && relocation.length > 0, "the decided structure records no first-slice relocation");
  for (const [file, recorded] of relocation) {
    const expected = recorded.split(" ")[0].replace(/^~/, home);
    const actual = decidedResolver.resolve(file).target;
    assert(actual === expected, `the decided structure sends ${file} to ${actual}, not ${expected}`);
  }

  console.log("Angular structure self-test passed.");
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
