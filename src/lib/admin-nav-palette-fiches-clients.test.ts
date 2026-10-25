import { describe, expect, it } from "vitest";

import { ADMIN_NAV_GROUP_LABELS, buildAdminNav } from "@/lib/admin-nav";

/**
 * Palette ⌘K (25/10/2026, décision de Will) : la fiche d'un client s'appelle « Fiches clients », jamais
 * « CRM » ni « Clients (CRM) » (le CRM est l'outil de prospection Axion CRM Pro, un autre produit).
 * La palette construit ses lignes depuis `buildAdminNav` : ce test lit la même source.
 */
describe("palette ⌘K : Fiches clients", () => {
  const items = buildAdminNav("admin-test-prefix");

  it("l'entrée des fiches clients s'appelle « Fiches clients », dans le groupe « Clients »", () => {
    const e = items.find((it) => it.href.endsWith("/qualiopi/clients"));
    expect(e?.label).toBe("Fiches clients");
    expect(e?.group).toBe("clients");
    expect(ADMIN_NAV_GROUP_LABELS.clients).toBe("Clients");
  });

  it("aucune entrée ni aucun groupe ne s'intitule « CRM » ou « Clients (CRM) »", () => {
    const interdits = /^(CRM|Clients \(CRM\)|Clients CRM)$/i;
    expect(items.filter((it) => interdits.test(it.label))).toEqual([]);
    expect(Object.values(ADMIN_NAV_GROUP_LABELS).filter((l) => interdits.test(l))).toEqual([]);
  });
});
