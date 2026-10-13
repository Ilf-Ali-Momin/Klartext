// Runs every fixture through the real pipeline and prints per field accuracy.
//
//   npm run eval                 all fixtures in fixtures/ and fixtures/private/
//   npm run eval -- inkasso      only fixtures whose name contains "inkasso"
//   npm run eval -- --verbose    also print expected and actual values for mismatches
//
// Field values are printed only with --verbose, so real letters stay out of terminal logs by default.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { explainLetter, type ImageMediaType, type LetterInput } from "@/lib/llm/explain";
import type { LetterCard } from "@/lib/llm/schema";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const FIXTURE_DIRS = ["fixtures", "fixtures/private"];

const MEDIA_TYPES: Record<string, ImageMediaType | "application/pdf"> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

interface Expected {
  sender?: { type: string };
  letter_date?: string | null;
  deadline?: { kind?: string; date?: string | null; relative_period?: unknown };
  amount?: { value: number } | null;
  reference_numbers?: string[];
}

interface Fixture {
  name: string;
  file: string;
  expected: Expected;
}

type Check = { field: string; expected: unknown; actual: unknown; pass: boolean };

function findFixtures(filter: string | undefined): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const dir of FIXTURE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const ext = path.extname(entry).toLowerCase();
      if (!(ext in MEDIA_TYPES)) continue;
      const base = entry.slice(0, -ext.length);
      const expectedPath = path.join(dir, `${base}.expected.json`);
      if (!existsSync(expectedPath)) {
        console.warn(`skip ${path.join(dir, entry)}: no ${base}.expected.json`);
        continue;
      }
      const name = path.join(dir, base);
      if (filter && !name.includes(filter)) continue;
      fixtures.push({
        name,
        file: path.join(dir, entry),
        expected: JSON.parse(readFileSync(expectedPath, "utf8")) as Expected,
      });
    }
  }
  return fixtures;
}

function toInput(file: string): LetterInput {
  const mediaType = MEDIA_TYPES[path.extname(file).toLowerCase()];
  const data = readFileSync(file).toString("base64");
  return mediaType === "application/pdf"
    ? { kind: "pdf", data }
    : { kind: "images", images: [{ mediaType, data }] };
}

function check(field: string, expected: unknown, actual: unknown): Check {
  return { field, expected, actual, pass: isDeepStrictEqual(expected, actual) };
}

function compare(expected: Expected, card: LetterCard): Check[] {
  const checks: Check[] = [];
  if (expected.sender) checks.push(check("sender.type", expected.sender.type, card.sender.type));
  if ("letter_date" in expected) checks.push(check("letter_date", expected.letter_date, card.letter_date));
  const d = expected.deadline;
  if (d && "kind" in d) checks.push(check("deadline.kind", d.kind, card.deadline.kind));
  if (d && "date" in d) checks.push(check("deadline.date", d.date, card.deadline.date));
  if (d && "relative_period" in d) {
    checks.push(check("deadline.relative_period", d.relative_period, card.deadline.relative_period));
  }
  if ("amount" in expected) {
    checks.push(check("amount.value", expected.amount?.value ?? null, card.amount?.value ?? null));
  }
  if (expected.reference_numbers) {
    const actual = card.reference_numbers.map((r) => r.value);
    const missing = expected.reference_numbers.filter((value) => !actual.includes(value));
    checks.push({ field: "reference_numbers", expected: expected.reference_numbers, actual, pass: missing.length === 0 });
  }
  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const filter = args.find((arg) => !arg.startsWith("--"));
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local or .env.");
    process.exit(1);
  }
  const fixtures = findFixtures(filter);
  if (fixtures.length === 0) {
    console.error("No fixtures found.");
    process.exit(1);
  }

  const totals = new Map<string, { pass: number; total: number }>();
  let failedRuns = 0;

  for (const fixture of fixtures) {
    const started = Date.now();
    const result = await explainLetter(toInput(fixture.file));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (!result.ok) {
      failedRuns++;
      console.log(`FAIL  ${fixture.name}  (${seconds}s)  pipeline error: ${result.reason}`);
      continue;
    }

    const checks = compare(fixture.expected, result.card);
    for (const c of checks) {
      const t = totals.get(c.field) ?? { pass: 0, total: 0 };
      t.total++;
      if (c.pass) t.pass++;
      totals.set(c.field, t);
    }
    const failed = checks.filter((c) => !c.pass);
    console.log(
      `${failed.length === 0 ? "ok  " : "MISS"}  ${fixture.name}  (${seconds}s)` +
        (failed.length ? `  wrong: ${failed.map((c) => c.field).join(", ")}` : ""),
    );
    if (verbose) {
      for (const c of failed) {
        console.log(`        ${c.field}: expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(c.actual)}`);
      }
    }
  }

  console.log("\nField accuracy");
  let allPerfect = failedRuns === 0;
  for (const [field, { pass, total }] of totals) {
    const pct = ((pass / total) * 100).toFixed(0).padStart(3);
    console.log(`  ${field.padEnd(26)} ${pct}%  (${pass}/${total})`);
    if (pass !== total) allPerfect = false;
  }
  console.log(`\n${fixtures.length} letters, ${failedRuns} pipeline errors`);
  process.exit(allPerfect ? 0 : 1);
}

main().catch((error: unknown) => {
  // SDK and file errors only. Letter content never reaches an error message here.
  console.error(`eval crashed: ${error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"}`);
  process.exit(1);
});
