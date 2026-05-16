/**
 * Build the OpenAPI 3.1 spec from registered zod schemas + route metadata
 * and emit it to two locations:
 *   - openapi/openapi.json   (committed source of truth, CI gate)
 *   - public/openapi.json    (served at https://<host>/openapi.json)
 *
 * Run via `npm run openapi:generate`.
 * The `--check` flag exits non-zero if the regenerated spec differs from
 * the committed copy (used in CI).
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

// Side-effect import: each handler module registers its routes at import-time.
import "../src/lib/api/openapi/handlers";
import { registry } from "../src/lib/api/openapi/registry";

const ROOT = resolve(__dirname, "..");
const COMMITTED = resolve(ROOT, "openapi/openapi.json");
const STATIC = resolve(ROOT, "public/openapi.json");

// Read apiVersion from package.json
const pkgRaw = readFileSync(resolve(ROOT, "package.json"), "utf8");
const pkg = JSON.parse(pkgRaw) as { apiVersion?: string };
const apiVersion = pkg.apiVersion ?? "0.1.0";

// Register security schemes once.
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
registry.registerComponent("securitySchemes", "CookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "t2w-token",
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "T2W API",
    version: apiVersion,
    description:
      "Tales on 2 Wheels public API. Shared by the web app and the Android / iOS mobile clients. Dual-mode auth: HttpOnly cookie OR Authorization: Bearer.",
  },
  servers: [
    { url: "https://taleson2wheels.com", description: "production" },
    { url: "http://localhost:3000", description: "local dev" },
  ],
});

const json = JSON.stringify(document, null, 2) + "\n";

if (process.argv.includes("--check")) {
  if (!existsSync(COMMITTED)) {
    console.error("[openapi:check] openapi/openapi.json does not exist. Run `npm run openapi:generate` first.");
    process.exit(1);
  }
  const committed = readFileSync(COMMITTED, "utf8");
  if (committed !== json) {
    console.error("[openapi:check] Generated spec differs from committed openapi/openapi.json.");
    console.error("[openapi:check] Run `npm run openapi:generate` and commit the result.");
    process.exit(1);
  }
  console.log("[openapi:check] Spec is up to date.");
  process.exit(0);
}

mkdirSync(dirname(COMMITTED), { recursive: true });
mkdirSync(dirname(STATIC), { recursive: true });
writeFileSync(COMMITTED, json);
writeFileSync(STATIC, json);
console.log(`[openapi:generate] Wrote ${COMMITTED}`);
console.log(`[openapi:generate] Wrote ${STATIC}`);
