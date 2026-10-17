/**
 * Lot F (M20) — la console des formateurs indépendants : « À faire maintenant »
 * (lue depuis le registre des gestes humains), menu complet, pastilles, pages
 * orphelines, bandeau d'étape, alerte « dossier à vérifier ».
 */
import { describe, it, expect } from "vitest";

import { ADMIN_NAV_GROUP_ORDER, buildAdminNav } from "@/lib/admin-nav";
import { badgeFormateurs } from "@/components/admin/ui/badges-formateurs";
import { formatNotificationPlain } from "@/server/notifications/format";

import { GESTES_HUMAINS } from "../gestes-humains";
import { blocsAFaire, liensAnnexes } from "../a-faire-maintenant";
import { bandeauEtape } from "../bandeau-etape";
import { etapeFormateurIndependant, type FaitsParcours } from "../etape-parcours-independant";

const TOUT = {
  formateursFreelance: true,
  dossiersEtContrats: true,
  entreesFormateurs: { aFaire: true, missions: true, honoraires: true },
} as const;

const groupe = (opts: Parameters<typeof buildAdminNav>[1]) =>
  buildAdminNav("p", opts).filter((it) => it.group === "formateurs-freelance");

describe("menu complet du groupe « Formateurs freelance »", () => {
  it("complet : À faire maintenant, Candidatures, Dossiers, Missions, Honoraires", () => {
    expect(groupe(TOUT).map((it) => it.label)).toEqual([
      "À faire maintenant",
      "Candidatures",
      "Dossiers et contrats",
      "Missions",
      "Honoraires",
    ]);
    expect(groupe(TOUT).map((it) => it.href)).toEqual([
      "/fr/p/qualiopi/formateurs/a-faire",
      "/fr/p/contacts/candidatures?view=formateurs-freelance",
      "/fr/p/qualiopi/formateurs/dossiers",
      "/fr/p/qualiopi/formateurs/missions",
      "/fr/p/qualiopi/remuneration?vue=formateurs-freelance",
    ]);
  });

  it("chaque entrée a son propre interrupteur : sans l'option, elle n'est pas là", () => {
    const sans = groupe({ formateursFreelance: true, dossiersEtContrats: true });
    expect(sans.map((it) => it.label)).toEqual(["Candidatures", "Dossiers et contrats"]);
    const seule = groupe({
      formateursFreelance: true,
      entreesFormateurs: { missions: true },
    });
    expect(seule.map((it) => it.label)).toEqual(["Candidatures", "Missions"]);
  });

  it("groupe éteint : le menu d'aujourd'hui à l'identique, options ignorées", () => {
    expect(buildAdminNav("p", { entreesFormateurs: TOUT.entreesFormateurs })).toEqual(
      buildAdminNav("p"),
    );
    expect(ADMIN_NAV_GROUP_ORDER).not.toContain("formateurs-freelance");
  });

  it("aucune adresse du groupe n'est partagée avec un autre groupe", () => {
    const nav = buildAdminNav("p", TOUT);
    const autres = new Set(
      nav.filter((i) => i.group !== "formateurs-freelance").map((i) => i.href),
    );
    for (const it of groupe(TOUT)) expect(autres.has(it.href)).toBe(false);
    const hrefs = nav.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("pastilles du groupe : ce qui reste à faire", () => {
  const base = "/fr/p";
  const c = { dossiers: 3, missions: 2, honoraires: 4 };
  it("une pastille par entrée, égalité exacte sur l'adresse", () => {
    expect(badgeFormateurs(`${base}/qualiopi/formateurs/dossiers`, base, c)?.count).toBe(3);
    expect(badgeFormateurs(`${base}/qualiopi/formateurs/missions`, base, c)?.count).toBe(2);
    expect(
      badgeFormateurs(`${base}/qualiopi/remuneration?vue=formateurs-freelance`, base, c)?.count,
    ).toBe(4);
    // « À faire maintenant » = ce qui attend l'équipe : dossiers + missions « à vous ».
    expect(badgeFormateurs(`${base}/qualiopi/formateurs/a-faire`, base, c)?.count).toBe(5);
  });
  it("zéro ou absent : aucune pastille ; les autres adresses n'en portent pas", () => {
    expect(badgeFormateurs(`${base}/qualiopi/formateurs/dossiers`, base, undefined)).toBeNull();
    expect(
      badgeFormateurs(`${base}/qualiopi/formateurs/dossiers`, base, { ...c, dossiers: 0 }),
    ).toBeNull();
    expect(badgeFormateurs(`${base}/qualiopi/remuneration`, base, c)).toBeNull();
    expect(badgeFormateurs(`${base}/qualiopi/formateurs/dossiers/x`, base, c)).toBeNull();
  });
});

describe("W-2 « À faire maintenant » : lu depuis le registre des gestes humains", () => {
  const blocs = blocsAFaire("/fr/p");
  it("chaque geste du registre apparaît une fois, dans le bloc de sa rubrique", () => {
    const vus = blocs.flatMap((b) => b.gestes.map((g) => g.id));
    expect(vus.sort()).toEqual(GESTES_HUMAINS.map((g) => g.id).sort());
    for (const b of blocs) for (const g of b.gestes) expect(g.rubrique).toBe(b.rubrique);
  });
  it("un bloc par rubrique utilisée, avec un titre court et un lien dans la console", () => {
    expect(new Set(blocs.map((b) => b.rubrique)).size).toBe(blocs.length);
    for (const b of blocs) {
      expect(b.titre.length).toBeGreaterThan(2);
      expect(b.titre.length).toBeLessThan(30);
      expect(b.href.startsWith("/fr/p/")).toBe(true);
    }
  });
  it("les pages orphelines sont reliées, selon leur interrupteur", () => {
    const tout = liensAnnexes(
      "/fr/p",
      { suivi_echange: true, mise_a_niveau: true, changement_coordonnees: true },
      "admin",
    );
    expect(tout.map((l) => l.href)).toEqual([
      "/fr/p/qualiopi/formateurs/echanges-du-pont",
      "/fr/p/qualiopi/formateurs/mise-a-niveau",
      "/fr/p/qualiopi/formateurs/changements",
      "/fr/p/qualiopi/formateurs/pieces",
      "/fr/p/qualiopi/formateurs/lieux",
      "/fr/p/qualiopi/formateurs/rattrapage",
    ]);
    const rien = liensAnnexes("/fr/p", { suivi_echange: false, mise_a_niveau: false }, "admin");
    expect(rien.map((l) => l.href)).toEqual([
      "/fr/p/qualiopi/formateurs/pieces",
      "/fr/p/qualiopi/formateurs/lieux",
      "/fr/p/qualiopi/formateurs/rattrapage",
    ]);
  });
});

const faits = (p: Partial<FaitsParcours>): FaitsParcours => ({
  actif: false,
  finCollaborationAt: null,
  activationValideeAt: null,
  issueDuParcours: true,
  dossierStatut: "en_cours",
  dossierOuvertAt: null,
  dossierEnvoyeAt: null,
  dossierVerifieAt: null,
  dernierVerdict: null,
  contrat: null,
  ...p,
});

describe("bandeau d'étape sur la fiche (W-10)", () => {
  const url = "/fr/p/qualiopi/formateurs/abc";
  it("dossier reçu : l'étape et le bouton qui mène à l'écran de vérification", () => {
    const b = bandeauEtape(etapeFormateurIndependant(faits({ dossierStatut: "a_verifier" })), url);
    expect(b.libelle).toMatch(/Dossier reçu/);
    expect(b.lien).toEqual({ libelle: "Vérifier et contresigner", href: `${url}/verifier` });
    expect(b.ton).toBe("warn");
  });
  it("contrat signé ou contresigné, registre rouge : même écran", () => {
    for (const f of [
      faits({ contrat: { statutSignature: "partielle", signeLe: null, contresigneLe: null } }),
      faits({ contrat: { statutSignature: "signee", signeLe: null, contresigneLe: null } }),
      faits({ dernierVerdict: "rouge" }),
    ]) {
      expect(bandeauEtape(etapeFormateurIndependant(f), url).lien?.href).toBe(`${url}/verifier`);
    }
  });
  it("actif ou dossier en cours : l'étape, sans bouton", () => {
    const actif = bandeauEtape(etapeFormateurIndependant(faits({ actif: true })), url);
    expect(actif).toMatchObject({ libelle: "Actif", lien: null, ton: "ok" });
    const cours = bandeauEtape(etapeFormateurIndependant(faits({})), url);
    expect(cours.lien).toBeNull();
    expect(cours.ton).toBe("neutral");
  });
});

describe("l'alerte « dossier reçu » mène à l'écran de vérification", () => {
  it("le lien de l'alerte est celui de /verifier, pas celui de la fiche", () => {
    const id = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
    const { text } = formatNotificationPlain(
      { category: "TRAINER_DOSSIER_RECU", payload: { trainerId: id, registre: "vert" } },
      "info",
    );
    expect(text).toContain(`/qualiopi/formateurs/${id}/verifier`);
  });
});
