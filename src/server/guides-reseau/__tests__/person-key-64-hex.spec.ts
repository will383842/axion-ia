// @vitest-environment node
// SITE-429 — la clé de personne des fixtures partagées avec le CRM fait 64 caractères
// hexadécimaux (sortie de `hashEmailForLookup`), sinon le CRM la refuse. Valeurs fictives.
import { describe, it, expect } from "vitest";

import fixtureClic from "./fixtures/charge-crm-v3-page.json";
import fixtureOrigines from "./fixtures/charge-crm-v3.json";

describe("person_key des fixtures CRM v3", () => {
  it.each([
    ["charge-crm-v3.json", fixtureOrigines],
    ["charge-crm-v3-page.json", fixtureClic],
  ])("%s : 64 caractères hexadécimaux", (_nom, f) => {
    expect(f.person.person_key).toMatch(/^[0-9a-f]{64}$/);
  });
});
