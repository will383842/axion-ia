// Stub for "server-only" Next.js package — no-op in Vitest environment.
// The real package throws at runtime if imported into a Client Component bundle.
// In tests (Node.js), there is no client bundle so the import has no effect.
export {};
