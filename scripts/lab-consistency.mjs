import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Two of the lab's own rules are written in prose and checked by nobody: a
// skill's version, which is repeated in its SKILL.md, its acceptance document
// and the README, and the integration branch's name, which one constant holds
// and nine passages of prose repeat. Both have already drifted and been
// repaired by hand. The lab's own principle is that a rule no tool checks
// drifts, so this checks them.

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const usage = `Usage: node scripts/lab-consistency.mjs [options]

Reports where the lab disagrees with itself. Reads only; never writes.

Checks:
  versions      each skill's declared version against its acceptance document's
                targetVersion, heading and file name, and against the README
  branch        every integration-branch name in the skills and the project
                constants against integrationBranch in scripts/run-context.mjs
  scripts       every scripts\\<name>.mjs a skill names exists
  schema-facts  the schemaVersion and statuses new-result.mjs scaffolds with,
                and the schemaVersion flow-baseline tells a run to write,
                against the schemas those were copied from

Exits non-zero when anything is out of step, naming the file and line.
Historical records under audits\\ and runs\\ are left out: they are true of
when they were written.

Options:
  --lab-root <dir>   the lab to check (default: this script's own lab)
  --json             print the findings as JSON
  --self-test        run the built-in checks
  --help             print this text
`;

// A placeholder, not a branch: the runId is filled in per slice.
const branchPlaceholders = new Set(["migration/<runId>", "migration/<run"]);

const readLines = async file => (await readFile(file, "utf8")).split(/\r?\n/);

const lineOf = (lines, predicate) => {
  const index = lines.findIndex(predicate);
  return index === -1 ? null : index + 1;
};

const listDirectories = async directory => {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const listFiles = async directory => {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile())
      .map(entry => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

// Every markdown file a skill owns, so a rule in a reference counts too.
const skillMarkdown = async (root, skill) => {
  const base = path.join(root, ".github", "skills", skill);
  const files = (await listFiles(base)).map(name => path.join(base, name));
  const referenceBase = path.join(base, "references");
  const references = (await listFiles(referenceBase))
    .map(name => path.join(referenceBase, name));
  return [...files, ...references].filter(file => file.endsWith(".md"));
};

const frontMatterValue = (lines, key) => {
  const match = lines.find(line => line.startsWith(`${key}:`));
  return match ? match.slice(key.length + 1).trim() : null;
};

// "0.39" is a prefix of "0.39.0" and "0" is a prefix of "0.1.0", but "0.33" is
// not a prefix of "0.36.0" and "0.3" is not a prefix of "0.39.0".
const isVersionPrefix = (token, version) => {
  const tokenParts = token.split(".");
  const versionParts = version.split(".");
  if (tokenParts.length > versionParts.length) return false;
  return tokenParts.every((part, index) => part === versionParts[index]);
};

const checkVersions = async (root, findings) => {
  const skills = await listDirectories(path.join(root, ".github", "skills"));
  const documentsDirectory = path.join(root, "docs");
  const documentNames = await listFiles(documentsDirectory);

  const readmePath = path.join(root, "README.md");
  let readmeLines = [];
  try {
    readmeLines = await readLines(readmePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const skill of skills) {
    const skillPath = path.join(root, ".github", "skills", skill, "SKILL.md");
    let lines;
    try {
      lines = await readLines(skillPath);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const versionLine = lines.findIndex(line => /^Skill version:/.test(line));
    if (versionLine === -1) continue;
    const declared = /`([^`]+)`/.exec(lines[versionLine])?.[1];
    if (!declared) {
      findings.push({
        check: "versions",
        file: path.relative(root, skillPath),
        line: versionLine + 1,
        message: "the Skill version line names no version in backticks.",
      });
      continue;
    }

    // Matched on the frontmatter rather than the file name, which varies.
    let acceptanceName = null;
    let acceptanceLines = null;
    for (const name of documentNames) {
      if (!name.endsWith("-acceptance.md")) continue;
      const candidate = await readLines(path.join(documentsDirectory, name));
      if (frontMatterValue(candidate, "skill") === skill) {
        acceptanceName = name;
        acceptanceLines = candidate;
        break;
      }
    }
    if (!acceptanceName) {
      findings.push({
        check: "versions",
        file: path.relative(root, skillPath),
        line: versionLine + 1,
        message: `${skill} declares ${declared} but no acceptance document in docs\\ names it.`,
      });
      continue;
    }
    const acceptancePath = path.join("docs", acceptanceName);

    const target = frontMatterValue(acceptanceLines, "targetVersion");
    if (target !== declared) {
      findings.push({
        check: "versions",
        file: acceptancePath,
        line: lineOf(acceptanceLines, line => line.startsWith("targetVersion:")) ?? 1,
        message: `targetVersion is ${target}, but ${skill} declares ${declared}.`,
      });
    }

    const nameToken = /-v([0-9][0-9.]*)-acceptance\.md$/.exec(acceptanceName)?.[1];
    if (nameToken && !isVersionPrefix(nameToken, declared)) {
      findings.push({
        check: "versions",
        file: acceptancePath,
        line: 1,
        message: `the file name says v${nameToken}, but ${skill} declares ${declared}; rename it.`,
      });
    }

    const headingIndex = acceptanceLines.findIndex(
      line => line.startsWith("# ") && /\bv\d/.test(line),
    );
    if (headingIndex !== -1) {
      // Shortened the same way the file names are, so the same prefix rule.
      const headingToken = /\bv(\d[\d.]*)/.exec(acceptanceLines[headingIndex])?.[1];
      if (headingToken && !isVersionPrefix(headingToken, declared)) {
        findings.push({
          check: "versions",
          file: acceptancePath,
          line: headingIndex + 1,
          message: `the heading says v${headingToken}, but ${skill} declares ${declared}.`,
        });
      }
    }

    const readmeIndex = readmeLines.findIndex(line => line.includes(`\`${skill}\` v`));
    if (readmeIndex === -1) {
      findings.push({
        check: "versions",
        file: "README.md",
        line: 1,
        message: `README names no version for ${skill}.`,
      });
    } else if (!readmeLines[readmeIndex].includes(`\`${skill}\` v${declared}`)) {
      findings.push({
        check: "versions",
        file: "README.md",
        line: readmeIndex + 1,
        message: `README does not say ${skill} v${declared}.`,
      });
    }
  }
};

const checkBranch = async (root, findings) => {
  const contextPath = path.join(root, "scripts", "run-context.mjs");
  let integrationBranch;
  try {
    // The constant itself, not a second copy of its value.
    ({ integrationBranch } = await import(pathToFileURL(contextPath).href));
  } catch {
    findings.push({
      check: "branch",
      file: path.relative(root, contextPath) || "scripts/run-context.mjs",
      line: 1,
      message: "run-context.mjs does not export integrationBranch.",
    });
    return;
  }

  const skills = await listDirectories(path.join(root, ".github", "skills"));
  const files = [];
  for (const skill of skills) files.push(...await skillMarkdown(root, skill));
  files.push(path.join(root, "docs", "project-constants.md"));

  for (const file of files) {
    let lines;
    try {
      lines = await readLines(file);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    lines.forEach((line, index) => {
      // Only inside a code span: every real branch mention is written as code,
      // while prose like "migration/architecture guides" is a slash between two
      // words and not a branch at all.
      for (const span of line.matchAll(/`([^`]*)`/g)) {
        for (const match of span[1].matchAll(/migration\/[A-Za-z0-9<>_-]+/g)) {
          const named = match[0];
          if (named === integrationBranch || branchPlaceholders.has(named)) continue;
          findings.push({
            check: "branch",
            file: path.relative(root, file),
            line: index + 1,
            message: `names ${named}, but the integration branch is ${integrationBranch}.`,
          });
        }
      }
    });
  }
};

const checkScripts = async (root, findings) => {
  const skills = await listDirectories(path.join(root, ".github", "skills"));
  const present = new Set(await listFiles(path.join(root, "scripts")));

  for (const skill of skills) {
    for (const file of await skillMarkdown(root, skill)) {
      const lines = await readLines(file);
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/scripts[\\/]([a-z][a-z-]*\.mjs)/g)) {
          if (present.has(match[1])) continue;
          findings.push({
            check: "scripts",
            file: path.relative(root, file),
            line: index + 1,
            message: `names scripts\\${match[1]}, which does not exist.`,
          });
        }
      });
    }
  }
};

// A schema's own facts get copied twice: into the scaffold that writes the
// artifact, and into the one skill line that names the version to write. Both
// agree today, and neither would say so if a schemaVersion moved.
const checkSchemaFacts = async (root, findings) => {
  const schemaOf = async name => {
    const file = path.join(root, "schemas", `${name}.schema.json`);
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  };
  const highestVersion = schema => {
    const version = schema.properties?.schemaVersion;
    if (!version) return null;
    return version.enum ? Math.max(...version.enum) : version.const ?? null;
  };

  const scaffoldPath = path.join(root, "scripts", "new-result.mjs");
  let specifications = null;
  try {
    ({ specifications } = await import(pathToFileURL(scaffoldPath).href));
  } catch {
    specifications = null;
  }
  if (specifications) {
    for (const [name, specification] of Object.entries(specifications)) {
      const schema = await schemaOf(name);
      // visual-selectors is a spec, not a handoff artifact, so it has no schema.
      if (!schema) continue;
      const highest = highestVersion(schema);
      if (specification.schemaVersion !== undefined && specification.schemaVersion !== highest) {
        findings.push({
          check: "schema-facts",
          file: "scripts\\new-result.mjs",
          line: 1,
          message: `scaffolds ${name} at schemaVersion ${specification.schemaVersion}, but the schema's highest is ${highest}.`,
        });
      }
      const allowed = schema.properties?.status?.enum;
      if (allowed && specification.statuses) {
        const same = [...allowed].sort().join("|") === [...specification.statuses].sort().join("|");
        if (!same) {
          findings.push({
            check: "schema-facts",
            file: "scripts\\new-result.mjs",
            line: 1,
            message: `offers ${name} statuses ${specification.statuses.join(", ")}, but the schema allows ${allowed.join(", ")}.`,
          });
        }
      }
    }
  }

  const contractSchema = await schemaOf("flow-contract");
  const baselinePath = path.join(root, ".github", "skills", "flow-baseline", "SKILL.md");
  let baselineLines;
  try {
    baselineLines = await readLines(baselinePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    baselineLines = null;
  }
  if (contractSchema && baselineLines) {
    const highest = highestVersion(contractSchema);
    const index = baselineLines.findIndex(line => /at schemaVersion \d+/.test(line));
    if (index !== -1) {
      const named = Number(/at schemaVersion (\d+)/.exec(baselineLines[index])[1]);
      if (named !== highest) {
        findings.push({
          check: "schema-facts",
          file: path.relative(root, baselinePath),
          line: index + 1,
          message: `tells the run to write schemaVersion ${named}, but the flow-contract schema's highest is ${highest}.`,
        });
      }
    }
  }
};

const runChecks = async root => {
  const findings = [];
  await checkVersions(root, findings);
  await checkBranch(root, findings);
  await checkScripts(root, findings);
  await checkSchemaFacts(root, findings);
  findings.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line);
  return findings;
};

const parseArguments = argumentsList => {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--json" || argument === "--self-test" || argument === "--help") {
      options[argument.slice(2)] = true;
      continue;
    }
    if (argument === "--lab-root") {
      const value = argumentsList[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${argument} needs a value.\n\n${usage}`);
      }
      options["lab-root"] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unexpected argument ${argument}.\n\n${usage}`);
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`Lab consistency self-test failed: ${message}`);
};

// A fixture lab, so every negative case is proved without touching the real
// files.
const writeFixture = async (directory, overrides = {}) => {
  const files = {
    ".github/skills/demo-skill/SKILL.md": [
      "# Demo Skill",
      "",
      "Skill version: `0.4.0`.",
      "",
      "Run `node \"<lab>\\scripts\\run-context.mjs\" --product-root <p>`",
      "off `migration/angular`, into `migration/<runId>`.",
      "",
    ].join("\n"),
    "docs/demo-skill-v0.4-acceptance.md": [
      "---",
      "document: skill-acceptance-criteria",
      "skill: demo-skill",
      "targetVersion: 0.4.0",
      "---",
      "",
      "# `demo-skill` v0.4.0 acceptance criteria",
      "",
    ].join("\n"),
    "README.md": "- experimental `demo-skill` v0.4.0 source skill;\n",
    "docs/project-constants.md": "- `migration/angular` is the integration branch.\n",
    "scripts/run-context.mjs": "export const integrationBranch = \"migration/angular\";\n",
    "schemas/migration-result.schema.json": JSON.stringify({
      properties: {
        schemaVersion: { enum: [4, 5] },
        status: { enum: ["completed", "failed", "blocked"] },
      },
    }, null, 2),
    "scripts/new-result.mjs": [
      "export const specifications = {",
      "  \"migration-result\": {",
      "    schemaVersion: 5,",
      "    statuses: [\"completed\", \"failed\", \"blocked\"],",
      "  },",
      "};",
      "",
    ].join("\n"),
    ...overrides,
  };
  for (const [relative, content] of Object.entries(files)) {
    if (content === null) continue;
    const target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
};

const runSelfTest = async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "lab-consistency-"));
  try {
    const caseOf = async (name, overrides) => {
      const directory = path.join(temporary, name);
      await writeFixture(directory, overrides);
      return runChecks(directory);
    };

    const clean = await caseOf("clean", {});
    assert(clean.length === 0,
      `a consistent lab reports findings: ${JSON.stringify(clean)}`);

    // The drift 22ce7d3 repaired by hand: the skill moved, its acceptance
    // document and the README did not.
    const stale = await caseOf("stale-version", {
      ".github/skills/demo-skill/SKILL.md":
        "# Demo Skill\n\nSkill version: `0.6.0`.\n",
    });
    assert(stale.some(finding => /targetVersion is 0\.4\.0.*declares 0\.6\.0/.test(finding.message)),
      "an acceptance document left behind is not reported");
    assert(stale.some(finding => /file name says v0\.4.*declares 0\.6\.0/.test(finding.message)),
      "an acceptance file name left behind is not reported");
    assert(stale.some(finding => /README does not say demo-skill v0\.6\.0/.test(finding.message)),
      "a README left behind is not reported");

    const heading = await caseOf("stale-heading", {
      "docs/demo-skill-v0.4-acceptance.md": [
        "---", "skill: demo-skill", "targetVersion: 0.4.0", "---", "",
        "# `demo-skill` v0.3.0 acceptance criteria", "",
      ].join("\n"),
    });
    assert(heading.some(finding => /heading says v0\.3\.0.*declares 0\.4\.0/.test(finding.message)),
      "a stale acceptance heading is not reported");

    // The repo shortens headings the same way it shortens file names.
    const shortHeading = await caseOf("short-heading", {
      "docs/demo-skill-v0.4-acceptance.md": [
        "---", "skill: demo-skill", "targetVersion: 0.4.0", "---", "",
        "# `demo-skill` v0.4 acceptance criteria", "",
      ].join("\n"),
    });
    assert(shortHeading.length === 0,
      `a shortened heading is treated as drift: ${JSON.stringify(shortHeading)}`);

    // Prose is not a branch: "migration/architecture guides" is two words.
    const prose = await caseOf("prose-slash", {
      ".github/skills/demo-skill/SKILL.md":
        "# Demo Skill\n\nSkill version: `0.4.0`.\n\n" +
        "Follow the migration/architecture guides, off `migration/angular`.\n",
    });
    assert(prose.length === 0,
      `a slash between two words is read as a branch: ${JSON.stringify(prose)}`);

    // A shortened file name is the repo's own existing form, not drift.
    const shortened = await caseOf("shortened-name", {
      ".github/skills/demo-skill/SKILL.md":
        "# Demo Skill\n\nSkill version: `0.1.0`.\n\n`migration/angular`\n",
      "docs/demo-skill-v0.4-acceptance.md": null,
      "docs/demo-skill-v0-acceptance.md": [
        "---", "skill: demo-skill", "targetVersion: 0.1.0", "---", "",
        "# `demo-skill` v0.1.0 acceptance criteria", "",
      ].join("\n"),
      "README.md": "- `demo-skill` v0.1.0;\n",
    });
    assert(shortened.length === 0,
      `a shortened acceptance file name is treated as drift: ${JSON.stringify(shortened)}`);

    // The pending merge change: the constant moves, the prose does not.
    const branch = await caseOf("stale-branch", {
      "scripts/run-context.mjs":
        "export const integrationBranch = \"migration/main-angular\";\n",
    });
    assert(branch.filter(finding => finding.check === "branch").length === 2,
      `a branch name left behind in prose is not reported once per passage: ${JSON.stringify(branch)}`);
    assert(branch.some(finding => finding.file.includes("project-constants")),
      "the project constants are not scanned for the branch name");
    assert(branch.every(finding => !/migration\/<runId>/.test(finding.message)),
      "the per-slice placeholder is reported as a stale branch");

    const missing = await caseOf("missing-script", {
      ".github/skills/demo-skill/SKILL.md":
        "# Demo Skill\n\nSkill version: `0.4.0`.\n\n" +
        "Run `node \"<lab>\\scripts\\gone-away.mjs\"`, off `migration/angular`.\n",
    });
    assert(missing.some(finding => finding.check === "scripts" &&
      /gone-away\.mjs, which does not exist/.test(finding.message)),
      "a named script that does not exist is not reported");

    const orphan = await caseOf("no-acceptance", {
      "docs/demo-skill-v0.4-acceptance.md": null,
    });
    assert(orphan.some(finding => /no acceptance document/.test(finding.message)),
      "a skill without an acceptance document is not reported");

    // A schema moves and the scaffold keeps writing the version before it.
    const behindSchema = await caseOf("scaffold-behind", {
      "schemas/migration-result.schema.json": JSON.stringify({
        properties: {
          schemaVersion: { enum: [4, 5, 6] },
          status: { enum: ["completed", "failed", "blocked"] },
        },
      }, null, 2),
    });
    assert(behindSchema.some(finding => finding.check === "schema-facts" &&
      /scaffolds migration-result at schemaVersion 5.*highest is 6/.test(finding.message)),
    "a scaffold left behind by a schemaVersion is not reported");

    const statusDrift = await caseOf("status-drift", {
      "schemas/migration-result.schema.json": JSON.stringify({
        properties: {
          schemaVersion: { enum: [4, 5] },
          status: { enum: ["completed", "failed", "blocked", "parked"] },
        },
      }, null, 2),
    });
    assert(statusDrift.some(finding => finding.check === "schema-facts" &&
      /statuses completed, failed, blocked.*schema allows .*parked/.test(finding.message)),
    "a status the schema gained is not reported");

    // The one skill line that names the version a run writes.
    const proseVersion = await caseOf("prose-schema-version", {
      "schemas/flow-contract.schema.json": JSON.stringify({
        properties: { schemaVersion: { enum: [7, 8, 9] } },
      }, null, 2),
      ".github/skills/flow-baseline/SKILL.md": [
        "# Flow Baseline", "", "Skill version: `0.4.0`.", "",
        "7. Write `flow-contract.json` at schemaVersion 8 in the run directory,",
        "   off `migration/angular`.", "",
      ].join("\n"),
      "docs/flow-baseline-v0.4-acceptance.md": [
        "---", "skill: flow-baseline", "targetVersion: 0.4.0", "---", "",
        "# `flow-baseline` v0.4.0 acceptance criteria", "",
      ].join("\n"),
      "README.md": "- `demo-skill` v0.4.0;\n- `flow-baseline` v0.4.0;\n",
    });
    assert(proseVersion.some(finding => finding.check === "schema-facts" &&
      /write schemaVersion 8.*highest is 9/.test(finding.message)),
    "a skill line naming a schemaVersion the schema has moved past is not reported");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  console.log("Lab consistency self-test passed.");
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (options["self-test"]) {
    await runSelfTest();
    return;
  }

  const root = path.resolve(options["lab-root"] ?? rootDirectory);
  const findings = await runChecks(root);

  if (options.json) {
    console.log(JSON.stringify({ root, findings }, null, 2));
  } else if (findings.length === 0) {
    console.log(
      "The lab agrees with itself: versions, branch name, named scripts and schema facts.",
    );
  } else {
    console.log(`${findings.length} disagreement(s):`);
    for (const finding of findings) {
      console.log(`  ${finding.file}:${finding.line}  [${finding.check}] ${finding.message}`);
    }
  }
  if (findings.length > 0) process.exitCode = 1;
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
