import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

// Singleton registry used by both handler modules (which call `registerRoute`
// at import time) and the generator script (which serializes the registry to
// an OpenAPI spec file).
export const registry = new OpenAPIRegistry();
