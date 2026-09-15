import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Which CSS paints a surface is not judgement: it is the styled templates the
// surface renders, down to the component that declares them. flow-baseline
// cites them in the contract, so flow-migrate ports those rules instead of
// restyling from a description, and a shared component is built once at its
// target instead of copied into every slice.

const labDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const usage = `Usage:
  node scripts/style-sources.mjs --product-root <dir> --entry <product path>[:<start>-<end>] [--entry ...] [--map <migration-map.json>] [--lab-root <dir>]
  node scripts/style-sources.mjs --self-test

Walks the render tree from each entry component, or from the JSX inside the
given line range of it, and prints as JSON what paints it:
- contract: the block a flow-contract visualParity entry copies verbatim, with
  styleSources, one "path:start-end" citation per styled, css, keyframes or
  createGlobalStyle template the tree renders, one "path:line" per inline style
  attribute, one path per imported stylesheet and one path per resolved icon;
  and sharedComponents, the ids of the migration map prerequisites the tree
  renders through, when their counterpart is built or the measured structure
  gives them a target;
- sharedComponents: those prerequisites with their counterpart status and
  target. A built one is not walked into, since its Angular counterpart already
  carries those styles;
- icons: every EIconNames member the tree renders, with the file that draws
  it, found through a registry entry ([EIconNames.X]: Component, or the enum
  value as a key) or else as the one X.tsx under an icons folder; a null source
  is read by hand, such as an @lely/icons SVG;
- angularMounts: relative imports into an angular folder, which mean that part
  already runs in Angular and has no React styles left to cite;
- files: every rendered file with its depth and the file that rendered it;
- packages: components rendered from packages, whose styles have no source here;
- unparsed: styled declarations that are no template literal, to read by hand;
- unresolved: relative imports that resolve to no file;
- unfollowed: names asked of a file that it neither declares nor passes on
  through a re-export or an imported binding, to read by hand.

A relative import is followed when the importing code renders one of its names
as JSX, wraps it with styled() or interpolates it into a template; a barrel is
followed for the names asked of it, through export-from and through an import
it exports again. Tests and stories are never followed. Regular expressions,
not a TypeScript parser: the lab installs nothing. Pointers in the map resolve
against --lab-root, by default this lab. Never writes anything.

Options:
  --help        print this text
  --self-test   run the built-in checks
`;

const sourceExtensions = [".tsx", ".ts", ".jsx", ".js"];
const stylesheetPattern = /\bimport\s+["']([^"']+\.(?:css|scss|sass|less))["']/g;
const unstyledPackages = new Set(["react", "react-dom", "styled-components"]);
const identifier = "[A-Za-z_$][\\w$]*";

const toProductPath = value => value.replaceAll("\\", "/").replace(/^(\.\/)+/, "");

const isTestOrStory = file =>
  /\.(test|spec|stories)\.[tj]sx?$/.test(file) || /[\\/]__tests__[\\/]/.test(file);

const escapeName = name => name.replace(/\$/g, "\\$");

const resolveInternal = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...sourceExtensions.map(extension => `${base}${extension}`),
    ...sourceExtensions.map(extension => path.join(base, `index${extension}`)),
  ];
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
};

// Blank comments while keeping every newline, so indexes still map to lines.
const withoutComments = source =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, comment => " ".repeat(comment.length));

const lineAt = (code, index) => code.slice(0, index).split("\n").length;

// The index just past a string, template or bracketed run that opens at index.
const skipBalanced = (code, index) => {
  const opener = code[index];
  if (opener === "\"" || opener === "'") {
    let cursor = index + 1;
    while (cursor < code.length && code[cursor] !== opener) cursor += code[cursor] === "\\" ? 2 : 1;
    return cursor + 1;
  }
  if (opener === "`") {
    let cursor = index + 1;
    while (cursor < code.length && code[cursor] !== "`") {
      if (code[cursor] === "\\") cursor += 2;
      else if (code[cursor] === "$" && code[cursor + 1] === "{") cursor = skipBalanced(code, cursor + 1);
      else cursor += 1;
    }
    return cursor + 1;
  }
  const closer = { "(": ")", "{": "}", "[": "]", "<": ">" }[opener];
  let cursor = index + 1;
  while (cursor < code.length && code[cursor] !== closer) {
    const character = code[cursor];
    if (opener === "<" && character === "=" && code[cursor + 1] === ">") cursor += 2;
    else if ("\"'`({[".includes(character) || (opener === "<" && character === "<")) cursor = skipBalanced(code, cursor);
    else cursor += 1;
  }
  return cursor + 1;
};

// Every styled, css, keyframes and createGlobalStyle template with its name and
// range; a nested css template inside another one belongs to its outer range.
const extractDefinitions = code => {
  const definitions = [];
  const unparsed = [];
  for (const match of code.matchAll(/\b(styled|css|keyframes|createGlobalStyle)\b/g)) {
    const start = match.index;
    if (definitions.some(definition => start > definition.start && start < definition.end)) continue;
    if (/[\w$.]/.test(code[start - 1] ?? "")) continue;
    let cursor = start + match[1].length;
    const skipSpace = () => {
      while (/\s/.test(code[cursor] ?? "")) cursor += 1;
    };
    skipSpace();
    if (match[1] === "styled") {
      if (code[cursor] !== "." && code[cursor] !== "(") continue;
      while (cursor < code.length) {
        skipSpace();
        if (code[cursor] === ".") {
          cursor += 1;
          skipSpace();
          const name = new RegExp(`^${identifier}`).exec(code.slice(cursor));
          if (!name) break;
          cursor += name[0].length;
        } else if (code[cursor] === "(" || code[cursor] === "<") {
          cursor = skipBalanced(code, cursor);
        } else {
          break;
        }
      }
    } else if (code[cursor] === "<") {
      cursor = skipBalanced(code, cursor);
      skipSpace();
    }
    if (code[cursor] !== "`") {
      if (match[1] === "styled") unparsed.push(lineAt(code, start));
      continue;
    }
    const end = skipBalanced(code, cursor);
    const before = code.slice(Math.max(0, start - 300), start);
    const named = new RegExp(`(?:(?:const|let|var)\\s+(${identifier})\\s*(?::[^=;]*)?=|(${identifier})\\s*:|export\\s+default)\\s*$`).exec(before);
    const name = named?.[1] ?? named?.[2] ?? "default";
    const exported = new RegExp(`export\\s+(?:const|let|var)\\s+${escapeName(name)}\\b|export\\s+default\\s*$`).test(before) ||
      new RegExp(`export\\s*\\{[^}]*\\b${escapeName(name)}\\b[^}]*\\}(?!\\s*from)`).test(code);
    definitions.push({ name, kind: match[1], start, end, exported, lines: [lineAt(code, start), lineAt(code, end - 1)] });
  }
  return { definitions, unparsed };
};

// A name counts as painted when code renders it as JSX, wraps it with styled()
// or interpolates it into a template.
const referencesName = (text, name) => new RegExp(
  `(?<![\\w$.)\\]])<${escapeName(name)}[\\s/>.]|\\bstyled\\(\\s*${escapeName(name)}\\s*[),]|\\$\\{\\s*${escapeName(name)}\\s*\\}`,
).test(text);

const parseClause = clause => {
  const names = [];
  const braced = /\{([^}]*)\}/.exec(clause);
  for (const part of braced ? braced[1].split(",") : []) {
    const item = part.trim();
    if (!item || /^type\s/.test(item)) continue;
    const [imported, local] = item.split(/\s+as\s+/).map(entry => entry.trim());
    names.push({ imported, local: local ?? imported });
  }
  const outside = clause.replace(/\{[^}]*\}/, "");
  const namespace = /\*\s*as\s+([\w$]+)/.exec(outside)?.[1] ?? null;
  const fallback = /^\s*([\w$]+)\s*(?:,|$)/.exec(outside.replace(/\*\s*as\s+[\w$]+/, ""));
  if (fallback) names.push({ imported: "default", local: fallback[1] });
  return { names, namespace };
};

const parseImports = code =>
  [...code.matchAll(/\bimport\s+(type\s+)?([\w$\s{},*]+?)\s+from\s+["']([^"']+)["']/g)]
    .filter(match => !match[1])
    .map(match => ({ specifier: match[3], ...parseClause(match[2]) }));

const parseReExports = code => [
  ...[...code.matchAll(/\bexport\s+(type\s+)?\{([^}]*)\}\s*from\s+["']([^"']+)["']/g)]
    .filter(match => !match[1])
    .map(match => ({
      specifier: match[3],
      names: match[2].split(",").map(entry => entry.trim()).filter(entry => entry && !/^type\s/.test(entry))
        .map(entry => {
          const [imported, exported] = entry.split(/\s+as\s+/).map(part => part.trim());
          return { imported, exported: exported ?? imported };
        }),
    })),
  ...[...code.matchAll(/\bexport\s+\*\s+from\s+["']([^"']+)["']/g)]
    .map(match => ({ specifier: match[1], star: true })),
];

const exportedNames = code => new Set([
  ...[...code.matchAll(new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:const\\s+enum|const|let|var|function\\*?|class|enum|interface|type)\\s+(${identifier})`,
    "g",
  ))].map(match => match[1]),
  ...(/\bexport\s+default\b/.test(code) ? ["default"] : []),
  ...[...code.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)]
    .flatMap(match => match[1].split(",").map(entry => entry.trim().split(/\s+as\s+/).at(-1)).filter(Boolean)),
]);

// Names a file exports from its own bindings: export { a as b } and export default a.
const localExports = code => {
  const locals = new Map();
  for (const match of code.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)) {
    for (const entry of match[1].split(",").map(part => part.trim()).filter(part => part && !/^type\s/.test(part))) {
      const [local, exported] = entry.split(/\s+as\s+/).map(part => part.trim());
      locals.set(exported ?? local, local);
    }
  }
  const fallback = new RegExp(`\\bexport\\s+default\\s+(${identifier})\\s*;?[ \\t]*$`, "m").exec(code);
  if (fallback) locals.set("default", fallback[1]);
  return locals;
};

const readCode = file => withoutComments(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));

// The product's icons are an enum member at the call site and a component
// looked up at runtime, so the walk alone never reaches the SVG a field draws.
const iconEnum = "EIconNames";

const listSourceFiles = (directory, files = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "coverage", "__tests__"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, files);
    else if (sourceExtensions.includes(path.extname(entry.name)) && !isTestOrStory(full)) files.push(full);
  }
  return files;
};

const createIconResolver = root => {
  let sources = null;
  const load = () => {
    sources ??= listSourceFiles(path.join(root, "src")).map(file => ({ file, code: readCode(file) }));
    return sources;
  };
  const escapeText = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const viaRegistry = keyPattern => {
    const found = new Set();
    for (const { file, code } of load()) {
      const bindings = new Map(parseImports(code).flatMap(imported =>
        imported.names.map(name => [name.local, imported.specifier])));
      for (const match of code.matchAll(new RegExp(`${keyPattern}\\s*:\\s*(${identifier})\\s*(?=[,}\\n])`, "g"))) {
        const specifier = bindings.get(match[1]);
        const resolved = specifier?.startsWith(".") ? resolveInternal(file, specifier) : null;
        if (resolved) found.add(resolved);
      }
    }
    return [...found];
  };
  return member => {
    let value = null;
    for (const { code } of load()) {
      const body = new RegExp(`\\benum\\s+${iconEnum}\\s*\\{([^}]*)\\}`).exec(code)?.[1];
      value ??= body ? new RegExp(`\\b${escapeName(member)}\\s*=\\s*["']([^"']+)["']`).exec(body)?.[1] ?? null : null;
    }
    const byRegistry = [...new Set([
      ...viaRegistry(`\\[\\s*${iconEnum}\\.${escapeName(member)}\\s*\\]`),
      ...(value ? viaRegistry(`["']${escapeText(value)}["']`) : []),
    ])];
    if (byRegistry.length === 1) return { value, source: byRegistry[0], method: "registry" };
    const byName = byRegistry.length > 1 ? byRegistry : load()
      .map(({ file }) => file)
      .filter(file => path.relative(root, file).split(path.sep).includes("icons") &&
        [".tsx", ".jsx"].includes(path.extname(file)) && path.basename(file, path.extname(file)) === member);
    if (byRegistry.length === 0 && byName.length === 1) return { value, source: byName[0], method: "file-name" };
    return { value, source: null, method: null, candidates: byName };
  };
};

const loadPrerequisites = (mapPath, labRoot) => {
  const readJson = file => JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const map = readJson(mapPath);
  if (map.artifactType !== "migration-map") throw new Error(`${mapPath} is not a migration-map.`);
  if (!map.metrics) throw new Error(`${mapPath} carries no metrics pointer; measure it with migration-map.mjs.`);
  const metricsPath = path.isAbsolute(map.metrics.path) ? map.metrics.path : path.resolve(labRoot, map.metrics.path);
  const targets = new Map((readJson(metricsPath).prerequisites ?? []).map(entry => [entry.id, entry.target ?? null]));
  return new Map((map.prerequisites ?? []).map(prerequisite => [toProductPath(prerequisite.reactSource), {
    id: prerequisite.id,
    angular: prerequisite.angular?.status === "built" ? "built" : (prerequisite.copies ?? []).length > 0 ? "copy" : "none",
    target: targets.get(prerequisite.id) ?? null,
  }]));
};

export const collectStyleSources = ({ productRoot, entries, prerequisites = new Map() }) => {
  const root = path.resolve(productRoot);
  const productPath = file => toProductPath(path.relative(root, file));
  const states = new Map();
  const queue = [];
  const unresolved = [];
  const packages = new Map();
  const shared = new Map();

  const request = (file, { depth, from, wanted, range = null }) => {
    const existing = states.get(file);
    if (!existing) {
      states.set(file, { depth, from, wanted, range, result: null });
      queue.push(file);
      return;
    }
    const before = existing.wanted === "all" ? Infinity : existing.wanted.size;
    if (wanted === "all") existing.wanted = "all";
    else if (existing.wanted !== "all") for (const name of wanted) existing.wanted.add(name);
    const after = existing.wanted === "all" ? Infinity : existing.wanted.size;
    if (depth < existing.depth) Object.assign(existing, { depth, from });
    if (after !== before && !queue.includes(file)) queue.push(file);
  };

  for (const entry of entries) {
    const [, entryPath, start, end] = /^(.*?)(?::(\d+)-(\d+))?$/.exec(entry);
    const file = path.resolve(root, entryPath);
    if (!existsSync(file)) throw new Error(`Entry ${entryPath} does not exist under ${root}.`);
    request(file, { depth: 0, from: null, wanted: "all", range: start ? [Number(start), Number(end)] : null });
  }

  while (queue.length > 0) {
    const file = queue.shift();
    const state = states.get(file);
    const code = readCode(file);
    const { definitions, unparsed } = extractDefinitions(code);

    // What the component renders: the range, or the file outside its templates.
    let region;
    if (state.range) {
      region = code.split("\n").map((line, index) =>
        index + 1 >= state.range[0] && index + 1 <= state.range[1] ? line : "").join("\n");
    } else {
      region = code;
      for (const definition of definitions) {
        region = region.slice(0, definition.start) +
          region.slice(definition.start, definition.end).replace(/[^\n]/g, " ") +
          region.slice(definition.end);
      }
    }
    const live = new Set(definitions.filter(definition =>
      referencesName(region, definition.name) ||
      (!state.range && (state.wanted === "all" ?
        definition.exported :
        state.wanted.has(definition.name) || (definition.name === "default" && state.wanted.has("default"))))));
    for (let grew = true; grew;) {
      grew = false;
      for (const definition of definitions) {
        if (live.has(definition)) continue;
        if ([...live].some(user => referencesName(code.slice(user.start, user.end), definition.name))) {
          live.add(definition);
          grew = true;
        }
      }
    }
    const painted = [region, ...[...live].map(definition => code.slice(definition.start, definition.end))].join("\n");

    const inlineStyles = [...region.matchAll(/\bstyle=\{\{/g)].map(match => lineAt(region, match.index));
    const stylesheets = [];
    for (const match of code.matchAll(stylesheetPattern)) {
      const resolved = resolveInternal(file, match[1]);
      if (resolved) stylesheets.push(productPath(resolved));
      else unresolved.push({ from: productPath(file), specifier: match[1] });
    }
    state.result = {
      definitions: [...live].sort((left, right) => left.start - right.start),
      unparsed,
      inlineStyles,
      stylesheets,
      icons: [...region.matchAll(new RegExp(`\\b${iconEnum}\\.(${identifier})`, "g"))]
        .map(match => ({ member: match[1], line: lineAt(region, match.index) })),
      angularMounts: [],
      unfollowed: [],
    };

    const follow = (resolved, wanted) => {
      if (isTestOrStory(resolved)) return;
      const prerequisite = prerequisites.get(productPath(resolved));
      if (prerequisite) shared.set(prerequisite.id, { ...prerequisite, reactSource: productPath(resolved) });
      if (prerequisite?.angular === "built") return;
      request(resolved, { depth: state.depth + 1, from: productPath(file), wanted: new Set(wanted) });
    };

    const imports = parseImports(code);
    for (const imported of imports) {
      if (imported.specifier.startsWith(".") && !productPath(file).split("/").includes("angular")) {
        const target = resolveInternal(file, imported.specifier);
        if (target && productPath(target).split("/").includes("angular")) state.result.angularMounts.push(productPath(target));
      }
      const used = imported.names.filter(name => referencesName(painted, name.local));
      const namespaced = imported.namespace ?
        [...painted.matchAll(new RegExp(`(?<![\\w$.)\\]])<${escapeName(imported.namespace)}\\.(${identifier})|\\bstyled\\(\\s*${escapeName(imported.namespace)}\\.(${identifier})`, "g"))]
          .map(match => match[1] ?? match[2]) :
        [];
      if (used.length === 0 && namespaced.length === 0) continue;
      const wanted = [...used.map(name => name.imported), ...namespaced];
      if (!imported.specifier.startsWith(".")) {
        const name = imported.specifier.startsWith("@") ?
          imported.specifier.split("/").slice(0, 2).join("/") :
          imported.specifier.split("/")[0];
        if (unstyledPackages.has(name)) continue;
        if (!packages.has(name)) packages.set(name, new Set());
        for (const component of [...used.map(entry => entry.local), ...namespaced]) packages.get(name).add(component);
        continue;
      }
      const resolved = resolveInternal(file, imported.specifier);
      if (!resolved) unresolved.push({ from: productPath(file), specifier: imported.specifier });
      else follow(resolved, wanted);
    }

    if (state.wanted !== "all") {
      const passedOn = new Set();
      for (const reExport of parseReExports(code)) {
        if (!reExport.specifier.startsWith(".")) continue;
        const resolved = resolveInternal(file, reExport.specifier);
        if (!resolved) {
          unresolved.push({ from: productPath(file), specifier: reExport.specifier });
          continue;
        }
        const pairs = reExport.star ?
          [...exportedNames(readCode(resolved))]
            .filter(name => name !== "default" && state.wanted.has(name))
            .map(name => ({ imported: name, exported: name })) :
          reExport.names.filter(name => state.wanted.has(name.exported));
        for (const pair of pairs) passedOn.add(pair.exported);
        if (pairs.length > 0) follow(resolved, pairs.map(pair => pair.imported));
      }
      // A barrel can also import a component and export it again.
      const bindings = new Map(imports.flatMap(imported =>
        imported.names.map(name => [name.local, { specifier: imported.specifier, imported: name.imported }])));
      const locals = localExports(code);
      const declared = exportedNames(code);
      for (const name of state.wanted) {
        if (passedOn.has(name)) continue;
        const binding = bindings.get(locals.get(name));
        const resolved = binding?.specifier.startsWith(".") ? resolveInternal(file, binding.specifier) : null;
        if (resolved) follow(resolved, [binding.imported]);
        else if (binding?.specifier.startsWith(".")) unresolved.push({ from: productPath(file), specifier: binding.specifier });
        else if (!binding && !declared.has(name)) state.result.unfollowed.push(name);
      }
    }
  }

  const resolveIcon = createIconResolver(root);
  const icons = new Map();
  for (const [file, state] of states) {
    for (const use of state.result.icons) {
      if (!icons.has(use.member)) icons.set(use.member, { ...resolveIcon(use.member), usedIn: [] });
      icons.get(use.member).usedIn.push(`${productPath(file)}:${use.line}`);
    }
  }
  const iconList = [...icons.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([member, icon]) => ({
      name: `${iconEnum}.${member}`,
      value: icon.value,
      source: icon.source && productPath(icon.source),
      method: icon.method,
      ...(icon.candidates?.length ? { candidates: icon.candidates.map(productPath) } : {}),
      usedIn: icon.usedIn.sort(),
    }));

  const files = [...states.entries()]
    .map(([file, state]) => ({ file, state }))
    .sort((left, right) => left.state.depth - right.state.depth ||
      productPath(left.file).localeCompare(productPath(right.file)));
  const styleSources = files.flatMap(({ file, state }) => [
    ...state.result.definitions.map(definition => `${productPath(file)}:${definition.lines[0]}-${definition.lines[1]}`),
    ...state.result.inlineStyles.map(line => `${productPath(file)}:${line}`),
    ...state.result.stylesheets,
  ]);
  const sharedComponents = [...shared.values()].sort((left, right) => left.id.localeCompare(right.id));
  return {
    contract: {
      styleSources: [...new Set([...styleSources, ...iconList.map(icon => icon.source).filter(Boolean)])],
      sharedComponents: sharedComponents
        .filter(component => component.angular === "built" || component.target)
        .map(component => component.id),
    },
    sharedComponents,
    files: files.map(({ file, state }) => ({
      path: productPath(file),
      depth: state.depth,
      renderedBy: state.from,
      styled: state.result.definitions.map(definition => ({
        name: definition.name,
        kind: definition.kind,
        lines: `${definition.lines[0]}-${definition.lines[1]}`,
      })),
    })),
    icons: iconList,
    angularMounts: files.flatMap(({ file, state }) =>
      [...new Set(state.result.angularMounts)].map(mounts => ({ path: productPath(file), mounts }))),
    packages: [...packages.entries()].map(([name, components]) => ({ name, components: [...components].sort() })),
    unparsed: files.flatMap(({ file, state }) => state.result.unparsed.map(line => `${productPath(file)}:${line}`)),
    unresolved: [...new Map(unresolved.map(entry => [`${entry.from}|${entry.specifier}`, entry])).values()],
    unfollowed: files
      .filter(({ state }) => state.result.unfollowed.length > 0)
      .map(({ file, state }) => ({ path: productPath(file), names: [...new Set(state.result.unfollowed)].sort() })),
  };
};

const parseArguments = argumentsList => {
  const options = { entry: [] };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "--self-test") {
      options[argument.slice(2)] = true;
    } else if (["--product-root", "--entry", "--map", "--lab-root"].includes(argument)) {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} needs a value.`);
      if (argument === "--entry") options.entry.push(value);
      else options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument ${argument}.`);
    }
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Style sources self-test failed: ${message}`);
};

const runSelfTest = async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "style-sources-"));
  const product = path.join(temporary, "product");
  const lab = path.join(temporary, "lab");
  const fixtures = {
    "src/features/strip/StraightStripLength.tsx": [
      "import React from \"react\";",
      "import styled from \"styled-components\";",
      "import { FocusNumberInput } from \"../drawer/FocusNumberInput\";",
      "import { EIconNames } from \"../../components/icons/names\";",
      "import type { Props } from \"./types\";",
      "import { useStores } from \"../../state/stores\";",
      "import \"./strip.css\";",
      "",
      "const Row = styled.div`",
      "  display: flex;",
      "`;",
      "// <Unused /> in a comment does not paint it.",
      "const Unused = styled.span`",
      "  color: red;",
      "`;",
      "",
      "export const StraightStripLength = ({ length }: Props) => {",
      "  const stores = useStores<Props>();",
      "  return (",
      "    <Row style={{ gap: 4 }}>",
      "      <FocusNumberInput icon={EIconNames.StraightLine} value={length} />",
      "    </Row>",
      "  );",
      "};",
    ].join("\r\n"),
    "src/features/strip/strip.css": ".strip { gap: 4px; }\n",
    "src/features/strip/types.ts": "export type Props = { length: number };\n",
    "src/state/stores.ts": "export const useStores = () => ({});\n",
    "src/components/icons/names.ts": [
      "export enum EIconNames {",
      "  StraightLine = \"icon-straight-line\",",
      "  Angle = \"icon-angle\",",
      "  Robot = \"icon-robot\",",
      "  Picture = \"lely-icon-picture\",",
      "}",
    ].join("\n"),
    "src/components/icons/StraightLine.tsx": "export const StraightLine = () => <svg viewBox=\"0 0 24 24\" />;\n",
    "src/shared/icons/registry.ts": "import AngleIcon from \"./Angle\";\nexport const SHARED_ICONS = {\n  \"icon-angle\": AngleIcon,\n};\n",
    "src/shared/icons/Angle.tsx": "export default () => <svg />;\n",
    "src/shared/icons/Robot.tsx": "export const Robot = () => <svg />;\n",
    "src/features/drawer/FocusNumberInput.tsx": [
      "import { NumberInput } from \"../../components/inputs\";",
      "import { Button, Ghost } from \"../../components/button\";",
      "export const FocusNumberInput = props => <><NumberInput {...props} /><Button /><Ghost /></>;",
    ].join("\n"),
    "src/components/button/index.ts": [
      "import Button from \"./Button\";",
      "export { Button };",
      "export * as Kinds from \"./kinds\";",
    ].join("\n"),
    "src/components/button/Button.tsx": [
      "import styled from \"styled-components\";",
      "const Base = styled.button`",
      "  padding: 0;",
      "`;",
      "export default function Button() {",
      "  return <Base />;",
      "}",
    ].join("\n"),
    "src/features/strip/Migrated.tsx": "import { AngularHost } from \"./AngularHost\";\nexport const Migrated = () => <AngularHost />;\n",
    "src/features/strip/AngularHost.tsx": [
      "import { useEffect } from \"react\";",
      "import { mountThing } from \"../../angular/domains/strip/mount-thing\";",
      "export const AngularHost = () => {",
      "  useEffect(() => mountThing());",
      "  return <div />;",
      "};",
    ].join("\n"),
    "src/angular/domains/strip/mount-thing.ts": "export const mountThing = () => {};\n",
    "src/features/drawer/__tests__/FocusNumberInput.test.tsx": "import { FocusNumberInput } from \"../FocusNumberInput\";\n",
    "src/components/inputs/index.ts": [
      "export { NumberInput } from \"./NumberInput\";",
      "export * from \"./TextInput\";",
    ].join("\n"),
    "src/components/inputs/TextInput.tsx": [
      "import styled from \"styled-components\";",
      "const Box = styled.input`border: 0;`;",
      "export const TextInput = () => <Box />;",
    ].join("\n"),
    "src/components/inputs/NumberInput.tsx": [
      "import styled, { css } from \"styled-components\";",
      "import { HoverInput } from \"./HoverInput\";",
      "import Icon from \"../icons/Icon\";",
      "import * as S from \"./parts\";",
      "",
      "const presetCss = css`",
      "  border-radius: ${({ theme }) => theme.radius};",
      "`;",
      "",
      "const Preset = styled(HoverInput).attrs({ type: \"number\" })<{ unit?: string }>`",
      "  ${presetCss};",
      "  ${({ unit }) => unit && css`",
      "    padding-right: 24px;",
      "  `}",
      "`;",
      "",
      "export const NumberInput = ({ unit }) => (",
      "  <S.Unit>",
      "    <Icon name={EIconNames.Angle} />",
      "    <Icon name={EIconNames.Robot} />",
      "    <Icon name={EIconNames.Picture} />",
      "    <Preset unit={unit} />",
      "  </S.Unit>",
      ");",
    ].join("\n"),
    "src/components/inputs/parts.ts": [
      "import styled from \"styled-components\";",
      "export const Unit = styled.span`",
      "  margin-left: 4px;",
      "`;",
      "export const Other = styled.div`",
      "  color: blue;",
      "`;",
    ].join("\n"),
    "src/components/inputs/HoverInput.tsx": [
      "import styled from \"styled-components\";",
      "import { Tooltip } from \"@lely/ui/tooltip\";",
      "import { Gone } from \"./gone\";",
      "const HoverLabel = styled.label`",
      "  position: absolute;",
      "  transform: translateY(-50%);",
      "`;",
      "const Controls = styled.div`",
      "  height: 56px;",
      "  align-items: center;",
      "`;",
      "const Legacy = styled.div({ color: \"red\" });",
      "import { ThemeBase } from \"../theme\";",
      "export const HoverInput = () => (",
      "  <Controls><Tooltip /><HoverLabel /><Legacy /><Gone /><ThemeBase.Provider /></Controls>",
      ");",
    ].join("\n"),
    "src/components/theme.ts": "export interface ThemeBase { radius: number }\nexport const enum Mode { Dark = \"dark\" }\n",
    "src/components/icons/Icon.tsx": [
      "import styled from \"styled-components\";",
      "import { StraightLine } from \"./StraightLine\";",
      "import { EIconNames } from \"./names\";",
      "const LOCAL_ICONS = {",
      "  [EIconNames.StraightLine]: StraightLine,",
      "};",
      "const Svg = styled.svg`width: 24px;`;",
      "export default () => <Svg />;",
    ].join("\n"),
  };
  try {
    for (const [relativePath, content] of Object.entries(fixtures)) {
      const filePath = path.join(product, ...relativePath.split("/"));
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    }
    const map = {
      artifactType: "migration-map",
      metrics: { path: "runs/map/migration-metrics.json", sha256: "0" },
      prerequisites: [
        { id: "focus-number-input", reactSource: "src/features/drawer/FocusNumberInput.tsx", angular: { status: "none" }, copies: [] },
        { id: "icon", reactSource: "src/components/icons/Icon.tsx", angular: { status: "built" }, copies: [] },
        { id: "parts", reactSource: "src/components/inputs/parts.ts", angular: { status: "none" }, copies: [] },
        { id: "text-input", reactSource: "src/components/inputs/TextInput.tsx", angular: { status: "none" }, copies: [] },
      ],
    };
    const metrics = {
      prerequisites: [
        { id: "focus-number-input", target: "src/angular/shared/ui/focus-number-input.component.ts" },
        { id: "icon", target: "src/angular/shared/ui/icon.component.ts" },
        { id: "parts", target: null },
        { id: "text-input", target: "src/angular/shared/ui/text-input.component.ts" },
      ],
    };
    await mkdir(path.join(lab, "runs", "map"), { recursive: true });
    await writeFile(path.join(lab, "runs", "map", "migration-map.json"), JSON.stringify(map));
    await writeFile(path.join(lab, "runs", "map", "migration-metrics.json"), JSON.stringify(metrics));

    const lineOf = (relativePath, text) =>
      fixtures[relativePath].replace(/\r\n/g, "\n").split("\n").findIndex(line => line.includes(text)) + 1;
    const range = (relativePath, startText, endLine) => `${relativePath}:${lineOf(relativePath, startText)}-${endLine}`;

    const output = collectStyleSources({
      productRoot: product,
      entries: ["src/features/strip/StraightStripLength.tsx"],
      prerequisites: loadPrerequisites(path.join(lab, "runs", "map", "migration-map.json"), lab),
    });
    const strip = "src/features/strip/StraightStripLength.tsx";
    const number = "src/components/inputs/NumberInput.tsx";
    const hover = "src/components/inputs/HoverInput.tsx";
    const expected = [
      range(strip, "const Row", lineOf(strip, "display: flex") + 1),
      `${strip}:${lineOf(strip, "style={{")}`,
      "src/features/strip/strip.css",
      range("src/components/button/Button.tsx", "const Base", 4),
      range(number, "const presetCss", 8),
      range(number, "const Preset", 15),
      range(hover, "const HoverLabel", 7),
      range(hover, "const Controls", 11),
      range("src/components/inputs/parts.ts", "export const Unit", 4),
      "src/shared/icons/Angle.tsx",
      "src/shared/icons/Robot.tsx",
      "src/components/icons/StraightLine.tsx",
    ];
    assert(JSON.stringify(output.contract.styleSources) === JSON.stringify(expected),
      `styleSources ${JSON.stringify(output.contract.styleSources)} differ from ${JSON.stringify(expected)}`);
    assert(JSON.stringify(output.contract.sharedComponents) === JSON.stringify(["focus-number-input", "icon"]),
      `sharedComponents ${JSON.stringify(output.contract.sharedComponents)} should list the unbuilt one with a target and the built one`);
    assert(!output.files.some(file => file.path.endsWith("Icon.tsx")),
      "a built prerequisite was walked into");
    assert(output.sharedComponents.some(component => component.id === "parts" && component.target === null) &&
      output.files.some(file => file.path.endsWith("parts.ts")),
      "a prerequisite without a target should be reported and walked like any file");
    assert(!output.files.some(file => /TextInput|stores|names|types|__tests__/.test(file.path)),
      `unrendered files were followed: ${output.files.map(file => file.path).join(", ")}`);
    assert(output.files.find(file => file.path.endsWith("parts.ts")).styled.length === 1,
      "an unused export of a style module was cited");
    assert(JSON.stringify(output.packages) === JSON.stringify([{ name: "@lely/ui", components: ["Tooltip"] }]),
      `packages ${JSON.stringify(output.packages)}`);
    assert(JSON.stringify(output.unparsed) === JSON.stringify([`${hover}:${lineOf(hover, "const Legacy")}`]),
      `unparsed ${JSON.stringify(output.unparsed)}`);
    assert(output.unresolved.length === 1 && output.unresolved[0].specifier === "./gone",
      `unresolved ${JSON.stringify(output.unresolved)}`);
    assert(output.files.find(file => file.path === hover).depth === 4 &&
      output.files.find(file => file.path === hover).renderedBy === number,
      "the depth or renderer of a nested file is wrong");
    assert(JSON.stringify(output.unfollowed) === JSON.stringify([{ path: "src/components/button/index.ts", names: ["Ghost"] }]),
      `a name a barrel does not pass on should be unfollowed: ${JSON.stringify(output.unfollowed)}`);
    const icons = Object.fromEntries(output.icons.map(icon => [icon.name, icon]));
    assert(icons["EIconNames.StraightLine"]?.method === "registry" &&
      icons["EIconNames.StraightLine"].usedIn[0] === `${strip}:${lineOf(strip, "EIconNames.StraightLine")}` &&
      icons["EIconNames.Angle"]?.method === "registry" && icons["EIconNames.Angle"].value === "icon-angle" &&
      icons["EIconNames.Robot"]?.method === "file-name" &&
      icons["EIconNames.Picture"]?.source === null && icons["EIconNames.Picture"].value === "lely-icon-picture",
      `icons were resolved wrongly: ${JSON.stringify(output.icons)}`);
    assert(output.angularMounts.length === 0, `angularMounts without a mount: ${JSON.stringify(output.angularMounts)}`);

    const migrated = collectStyleSources({ productRoot: product, entries: ["src/features/strip/Migrated.tsx"] });
    assert(JSON.stringify(migrated.angularMounts) ===
      JSON.stringify([{ path: "src/features/strip/AngularHost.tsx", mounts: "src/angular/domains/strip/mount-thing.ts" }]) &&
      migrated.contract.styleSources.length === 0,
      `a migrated surface was not reported as mounting Angular: ${JSON.stringify(migrated.angularMounts)}`);

    const ranged = collectStyleSources({
      productRoot: product,
      entries: [`${strip}:${lineOf(strip, "<Row style")}-${lineOf(strip, "<Row style")}`],
    });
    assert(JSON.stringify(ranged.contract.styleSources) ===
      JSON.stringify([range(strip, "const Row", lineOf(strip, "display: flex") + 1), `${strip}:${lineOf(strip, "style={{")}`, "src/features/strip/strip.css"]) &&
      ranged.files.length === 1 && ranged.contract.sharedComponents.length === 0,
      `a line range still followed JSX outside it: ${JSON.stringify(ranged.contract)}`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.log("Style sources self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }
  if (options.help || !options["product-root"] || options.entry.length === 0) {
    process.stdout.write(usage);
    process.exitCode = options.help ? 0 : 1;
    return;
  }
  const prerequisites = options.map ?
    loadPrerequisites(path.resolve(options.map), path.resolve(options["lab-root"] ?? labDirectory)) :
    new Map();
  console.log(JSON.stringify(collectStyleSources({
    productRoot: options["product-root"],
    entries: options.entry,
    prerequisites,
  }), null, 2));
};

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
