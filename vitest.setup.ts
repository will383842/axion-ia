import "@testing-library/jest-dom/vitest";

// Note: jest-axe matcher signature is incompatible with Vitest. A11y
// assertions are handled by `@axe-core/playwright` in e2e tests
// (Sprint 21 wires the dedicated suite).
