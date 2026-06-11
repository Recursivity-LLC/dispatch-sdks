// Validates every golden fixture against the JSON Schemas. This is the cheapest
// conformance gate: if a fixture (or, in an SDK's tests, a freshly-produced event)
// doesn't satisfy the schema, the wire contract has drifted. Run: `pnpm --filter
// @dispatchitapp/contract validate` (after `pnpm install`).
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const eventSchema = load(join(root, "schema", "event.schema.json"));
const ticketSchema = load(join(root, "schema", "ticket.schema.json"));
const validateEvent = ajv.compile(eventSchema);
const validateTicket = ajv.compile(ticketSchema);

const fixturesDir = join(root, "fixtures");
let failures = 0;

for (const file of readdirSync(fixturesDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const name = basename(file);
  const data = load(join(fixturesDir, file));
  const validate = name.startsWith("ticket.") ? validateTicket : validateEvent;
  const kind = name.startsWith("ticket.") ? "ticket" : "event";
  if (validate(data)) {
    console.log(`  ok    ${name}  (${kind})`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}  (${kind})`);
    for (const err of validate.errors ?? []) {
      console.error(`        ${err.instancePath || "/"} ${err.message}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} fixture(s) failed schema validation.`);
  process.exit(1);
}
console.log("\nAll fixtures valid against the contract schemas.");
