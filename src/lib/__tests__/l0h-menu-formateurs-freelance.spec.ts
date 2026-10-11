/**
 * Lot L0h — le groupe de menu « Formateurs freelance » et sa vue des
 * candidatures. Livré ÉTEINT (`formateurs.menu_freelance`) : absent, le menu et
 * la liste des candidatures sont ceux d'aujourd'hui.
 */

import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  buildAdminNav,
  ordreDesGroupesNav,
} from "../admin-nav";
import { whereCandidatureFormateurFreelance } from "../careers/formateur-freelance-filtre";
import { construireFiltreCandidatures } from "@/features/admin-job-applications/reads";

describe("L0h — menu", () => {
  it("éteint : le menu d'aujourd'hui, à l'identique", () => {
    expect(buildAdminNav("p", { formateursFreelance: false })).toEqual(buildAdminNav("p"));
    expect(buildAdminNav("p").some((it) => it.group === "formateurs-freelance")).toBe(false);
    expect(ordreDesGroupesNav(buildAdminNav("p"))).toEqual(ADMIN_NAV_GROUP_ORDER);
  });

  it("allumé : un groupe à lui, juste après « Recrutement salariés », sans item partagé", () => {
    const nav = buildAdminNav("p", { formateursFreelance: true });
    const groupe = nav.filter((it) => it.group === "formateurs-freelance");
    expect(ADMIN_NAV_GROUP_LABELS["formateurs-freelance"]).toBe("Formateurs freelance");
    expect(groupe.map((it) => [it.label, it.href])).toEqual([
      ["Candidatures", "/fr/p/contacts/candidatures?view=formateurs-freelance"],
    ]);
    const autres = new Set(
      nav.filter((it) => it.group !== "formateurs-freelance").map((it) => it.href),
    );
    for (const it of groupe) expect(autres.has(it.href)).toBe(false);
    const ordre = ordreDesGroupesNav(nav);
    expect(ordre.indexOf("formateurs-freelance")).toBe(ordre.indexOf("recrutement") + 1);
    for (const it of groupe) expect(it.label).not.toMatch(/poste|recrutement|entretien/i);
  });
});

describe("L0h — la vue des candidatures", () => {
  it("éteint : aucun filtre ajouté (la vue est ignorée)", () => {
    expect(construireFiltreCandidatures({ view: "all" }).where).toEqual({});
  });

  it("la vue « formateurs-freelance » ne garde que les candidatures de formateur freelance", () => {
    const { where } = construireFiltreCandidatures({ view: "formateurs-freelance" });
    expect(where).toEqual({ AND: [whereCandidatureFormateurFreelance()] });
    const texte = JSON.stringify(whereCandidatureFormateurFreelance());
    expect(texte).toContain('"natureCollaboration":"freelance"');
    expect(texte).toContain('"slug":"formateur-ia-freelance"');
    expect(texte).toContain("indépendant");
  });

  it("une nature « freelance » seule ne suffit pas : il faut un intitulé de formateur", () => {
    const w = whereCandidatureFormateurFreelance() as { OR: Array<Record<string, unknown>> };
    const branche = w.OR.find((b) =>
      JSON.stringify(b).startsWith('{"AND":[{"natureCollaboration"'),
    );
    expect(branche).toBeDefined();
    expect(JSON.stringify(branche)).toContain("formateur");
    expect(w.OR.some((b) => JSON.stringify(b) === '{"natureCollaboration":"freelance"}')).toBe(
      false,
    );
  });
});
