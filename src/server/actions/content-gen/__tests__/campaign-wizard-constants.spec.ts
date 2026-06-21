/**
 * Garde anti-dérive : les vocabulaires du wizard multi-axes DOIVENT être des
 * membres réels des enums Prisma. Sinon l'échantillonnage orchestrateur caste
 * une valeur invalide → l'insert du ContentGenJob échoue SILENCIEUSEMENT (le cast
 * `as OrganisationType` n'est pas validé en DB). Bug réel détecté à l'audit E2E
 * 2026-06-21 (profession_liberale / collectivite_territoriale hors enum).
 */

import { describe, it, expect } from "vitest";
import {
  WIZARD_SERVICE_SECTORS,
  WIZARD_SEARCH_INTENTS,
  WIZARD_COMPANY_SIZES,
  WIZARD_ORG_TYPES,
} from "../campaign-wizard-constants";
import {
  ServiceSector,
  SearchIntent,
  CompanySize,
  OrganisationType,
} from "../../../../../prisma/generated/client";

describe("wizard multi-axes — vocabulaires alignés sur les enums Prisma", () => {
  it("WIZARD_SERVICE_SECTORS ⊆ enum ServiceSector", () => {
    const valid = new Set(Object.values(ServiceSector));
    for (const o of WIZARD_SERVICE_SECTORS) expect(valid.has(o.value)).toBe(true);
  });

  it("WIZARD_SEARCH_INTENTS ⊆ enum SearchIntent", () => {
    const valid = new Set(Object.values(SearchIntent));
    for (const o of WIZARD_SEARCH_INTENTS) expect(valid.has(o.value)).toBe(true);
  });

  it("WIZARD_COMPANY_SIZES ⊆ enum CompanySize", () => {
    const valid = new Set(Object.values(CompanySize));
    for (const o of WIZARD_COMPANY_SIZES) expect(valid.has(o.value)).toBe(true);
  });

  it("WIZARD_ORG_TYPES ⊆ enum OrganisationType (régression C1)", () => {
    const valid = new Set(Object.values(OrganisationType));
    for (const o of WIZARD_ORG_TYPES) expect(valid.has(o.value)).toBe(true);
    // Anti-régression explicite : ces 2 valeurs ont causé le bug, ne doivent JAMAIS revenir.
    const values = WIZARD_ORG_TYPES.map((o) => o.value);
    expect(values).not.toContain("profession_liberale");
    expect(values).not.toContain("collectivite_territoriale");
  });
});
