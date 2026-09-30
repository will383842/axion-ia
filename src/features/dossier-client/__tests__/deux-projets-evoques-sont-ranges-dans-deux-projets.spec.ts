// @vitest-environment node
/**
 * ⛔ Deux projets évoqués dans un même rendez-vous (J1 « formation RH »,
 * J2 « audit ») sont rangés dans DEUX projets (V1-03) :
 *   · les faits « à ranger » sont groupés par projet évoqué, avec la
 *     proposition de P2 (projet existant ou nouveau) ;
 *   · « Valider » range chaque groupe dans le projet choisi pour lui ;
 *   · « Déplacer » refuse un rendez-vous dont les faits viennent de plusieurs
 *     projets (il les verserait tous dans un seul).
 *
 * Mutations qui font rougir :
 *   · ignorer `groupes` dans `validerApresLAppel` : le budget de l'audit
 *     atterrit dans le projet de la formation ;
 *   · retirer le refus de `deplacerRencontre`.
 * Contre-témoin : un seul projet évoqué ne produit aucun second groupe.
 */

import { describe, expect, it } from "vitest";

import { deplacerRencontre } from "../deplacer";
import { evocationsDe, grouperParProjetEvoque } from "../projets-evoques";
import { validerApresLAppel } from "../valider";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";

const PROJET_CONNU = id(2);

const ETAT = {
  faits: [
    ["F01", "fait-besoin-rh"],
    ["F02", "fait-budget-rh"],
    ["F03", "fait-budget-audit"],
    ["F04", "fait-activite"],
  ] as const,
  declarations: [
    ["F01", "projet", "J1"],
    ["F02", "projet", "J1"],
    ["F03", "projet", "J2"],
    ["F04", "entreprise", null],
  ] as const,
  projetsEvoques: [
    { ref: "J1", intitule: "Formation RH", activite: null },
    { ref: "J2", intitule: "Audit", activite: null },
  ],
  correspondances: { faits: [], contacts: [], projets: [["P1", PROJET_CONNU]] as const },
  rattachement: {
    decisions: [
      {
        projet_evoque_ref: "J1",
        decision: "projet_existant" as const,
        projet_connu_ref: "P1",
        titre_propose: null,
        activite_proposee: null,
        faits_refs: ["F01", "F02"],
        confiance: "haute" as const,
        explication: "",
      },
      {
        projet_evoque_ref: "J2",
        decision: "nouveau_projet" as const,
        projet_connu_ref: null,
        titre_propose: "Audit IA",
        activite_proposee: null,
        faits_refs: ["F03"],
        confiance: "haute" as const,
        explication: "",
      },
    ],
    projet_principal_ref: "J1",
    portees_a_corriger: [],
  },
};

const faitsVue = [
  { id: "fait-besoin-rh", portee: "a_ranger" as const },
  { id: "fait-budget-rh", portee: "a_ranger" as const },
  { id: "fait-budget-audit", portee: "a_ranger" as const },
  { id: "fait-activite", portee: "entreprise" as const },
];

describe("⛔ deux projets évoqués sont rangés dans deux projets", () => {
  it("les faits à ranger sont groupés par projet évoqué, avec la proposition de P2", () => {
    const g = grouperParProjetEvoque(faitsVue, evocationsDe(ETAT as never));
    expect(g.principal.ref).toBe("J1");
    expect(g.principal.proposition).toEqual({ mode: "existant", projetId: PROJET_CONNU });
    expect(g.principal.faits.map((f) => f.id)).toEqual([
      "fait-besoin-rh",
      "fait-budget-rh",
      "fait-activite",
    ]);
    expect(g.autres).toHaveLength(1);
    expect(g.autres[0]).toEqual(
      expect.objectContaining({
        ref: "J2",
        intitule: "Audit",
        proposition: { mode: "nouveau", titre: "Audit IA" },
      }),
    );
    expect(g.autres[0]?.faits.map((f) => f.id)).toEqual(["fait-budget-audit"]);
  });

  it("contre-témoin : un seul projet évoqué, aucun second groupe", () => {
    const g = grouperParProjetEvoque(faitsVue.slice(0, 2), evocationsDe(ETAT as never));
    expect(g.autres).toEqual([]);
  });

  it("« Valider » range chaque groupe dans son projet", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const rencontreId = id(5);
    const [rh, audit] = [id(6), id(6)];
    const fait = (fid: string, type: string) => ({
      id: fid,
      clientId: f["id"],
      portee: "a_ranger",
      projetId: null,
      type,
      cle: "global",
      enonce: "",
      certitude: "dit_explicitement",
      confiance: "haute",
      source: "transcription",
      rencontreId,
      statut: "propose",
      suivi: null,
    });
    const base = dossierEnMemoire({
      client: [f],
      rencontre: [
        {
          id: rencontreId,
          source: "saisie_manuelle",
          type: "visio",
          titre: "Rendez-vous",
          clientId: f["id"],
          rattachementStatut: "valide",
          statut: "planifie",
          calendlyEventId: null,
          projetId: null,
          debutPrevu: new Date("2026-10-06T08:00:00Z"),
        },
      ],
      fait: [fait(rh, "budget"), fait(audit, "budget")],
    });
    const r = await validerApresLAppel(base.client as never, {
      rencontreId,
      parAdminId: ADMIN,
      projet: { mode: "nouveau", titre: "Formation RH" },
      groupes: [{ projet: { mode: "nouveau", titre: "Audit IA" }, faitIds: [audit] }],
      faitsCoches: [rh, audit],
      note: null,
      suivi: { issue: "eu_lieu", suite: "aucune", suiteLe: null },
    });
    const faits = base.tables["fait"] ?? [];
    const projets = base.tables["projet"] ?? [];
    expect(projets.map((p) => p["titre"]).sort()).toEqual(["Audit IA", "Formation RH"]);
    const pAudit = projets.find((p) => p["titre"] === "Audit IA")?.["id"];
    expect(faits.find((x) => x["id"] === rh)?.["projetId"]).toBe(r.projetId);
    expect(faits.find((x) => x["id"] === audit)?.["projetId"]).toBe(pAudit);
    expect(faits.every((x) => x["statut"] === "valide")).toBe(true);
    expect(base.tables["rencontre"]?.[0]?.["projetId"]).toBe(r.projetId);
  });

  it("« Déplacer » refuse des faits venus de plusieurs projets", async () => {
    const a = fiche({ raisonSociale: "Fiche A" });
    const b = fiche({ raisonSociale: "Fiche B" });
    const rencontreId = id(5);
    const [p1, p2, pB] = [id(2), id(2), id(2)];
    const fait = (projetId: string) => ({
      id: id(6),
      clientId: a["id"],
      portee: "projet",
      projetId,
      type: "budget",
      cle: "global",
      rencontreId,
      statut: "valide",
    });
    const base = dossierEnMemoire({
      client: [a, b],
      projet: [
        { id: p1, clientId: a["id"], numero: "AXI-PRJ-2026-001" },
        { id: p2, clientId: a["id"], numero: "AXI-PRJ-2026-002" },
        { id: pB, clientId: b["id"], numero: "AXI-PRJ-2026-003" },
      ],
      rencontre: [
        {
          id: rencontreId,
          source: "calendly",
          calendlyEventId: null,
          clientId: a["id"],
          projetId: p1,
          rattachementStatut: "valide",
        },
      ],
      fait: [fait(p1), fait(p2)],
    });
    await expect(
      deplacerRencontre(base.client as never, {
        rencontreId,
        versClientId: b["id"] as string,
        versProjetId: pB,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/plusieurs projets/);
    expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBe(a["id"]);
  });
});
