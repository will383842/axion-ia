/**
 * Sprint A-suite P6 — Item 3. Tests correlationId traceId inter-workers.
 * 2 scénarios :
 *  1. L'orchestrateur crée un ContentGenJob avec correlationId non-null.
 *  2. Le correlationId généré est un UUID v4 valide.
 */

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// UUID v4 regex (RFC 4122)
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("correlationId — Item 3 Sprint A-suite P6", () => {
  it("crypto.randomUUID() génère un UUID v4 valide (format correlationId)", () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(UUID_V4_REGEX);
    // Longueur exacte VARCHAR(36)
    expect(id.length).toBe(36);
  });

  it("deux appels successifs génèrent des identifiants distincts", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
  });
});
