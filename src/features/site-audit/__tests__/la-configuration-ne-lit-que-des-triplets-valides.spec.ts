import { describe, expect, it } from "vitest";

import { siteAuditDuClient } from "../config";

const C1 = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const D1 = "33333333-3333-4333-8333-333333333333";
const C2 = "44444444-4444-4444-8444-444444444444";
const P2 = "55555555-5555-4555-8555-555555555555";
const D2 = "66666666-6666-4666-8666-666666666666";

describe("siteAuditDuClient", () => {
  it("absente ou vide → null", () => {
    expect(siteAuditDuClient(C1, {})).toBeNull();
    expect(siteAuditDuClient(C1, { SITE_AUDIT_DOCUMENTS: "" })).toBeNull();
  });
  it("une entrée", () => {
    expect(siteAuditDuClient(C1, { SITE_AUDIT_DOCUMENTS: `${C1}:${P1}:${D1}` })).toEqual({
      projetId: P1,
      documentId: D1,
    });
  });
  it("deux entrées : chacune son client, un tiers → null", () => {
    const env = { SITE_AUDIT_DOCUMENTS: `${C1}:${P1}:${D1}, ${C2}:${P2}:${D2}` };
    expect(siteAuditDuClient(C2, env)).toEqual({ projetId: P2, documentId: D2 });
    expect(siteAuditDuClient("77777777-7777-4777-8777-777777777777", env)).toBeNull();
  });
  it("UUID faux ignoré, entrée valide voisine conservée", () => {
    const env = { SITE_AUDIT_DOCUMENTS: `${C1}:pas-un-uuid:${D1},${C1}:${P1}:${D1}` };
    expect(siteAuditDuClient(C1, env)).toEqual({ projetId: P1, documentId: D1 });
    expect(siteAuditDuClient(C1, { SITE_AUDIT_DOCUMENTS: `${C1}:${P1}` })).toBeNull();
  });
  it("majuscules acceptées et ramenées en minuscules", () => {
    const env = { SITE_AUDIT_DOCUMENTS: `${C1}:${P1}:${D1}`.toUpperCase() };
    expect(siteAuditDuClient(C1.toUpperCase(), env)).toEqual({ projetId: P1, documentId: D1 });
  });
});
