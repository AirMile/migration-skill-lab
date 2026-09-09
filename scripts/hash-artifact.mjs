import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Two runs reported, independently, that they computed these digests by hand
// and retyped the hex into the next artifact. That is a deterministic step.

const usage = `Usage: node scripts/hash-artifact.mjs <file>...

Prints the { path, sha256 } pointer block each artifact needs for the one it
consumes. Paths are printed relative to the current working directory, which is
the form the handoff artifacts use.

Options:
  --json   print one JSON object per file instead of a pointer block
`;

const hashFile = async filePath => {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
};

const main = async () => {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const files = args.filter(argument => !argument.startsWith("--"));

  if (files.length === 0 || args.includes("--help")) {
    process.stdout.write(usage);
    process.exitCode = files.length === 0 ? 1 : 0;
    return;
  }

  const pointers = [];
  for (const file of files) {
    const absolute = path.resolve(file);
    const sha256 = await hashFile(absolute);
    pointers.push({
      path: path.relative(process.cwd(), absolute) || path.basename(absolute),
      sha256,
    });
  }

  if (asJson) {
    for (const pointer of pointers) {
      process.stdout.write(`${JSON.stringify(pointer)}
`);
    }
    return;
  }

  for (const pointer of pointers) {
    process.stdout.write(`${JSON.stringify(pointer, null, 2)}
`);
  }
};

await main();
