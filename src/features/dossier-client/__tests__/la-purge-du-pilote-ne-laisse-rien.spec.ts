// @vitest-environment node
/**
 * La purge du pilote ne laisse RIEN du pilote (plan V-05b, jalon O-1) :
 * `purgerPilote()` — de `src/lib/rgpd-erase.ts`, seul module qui pose le
 * drapeau d'effacement — supprime les rencontres de test et tout le dossier
 * de la fiche fictive (faits, projets, personnes), journalise chaque ligne
 * (`EffacementJournal`, motif `pilote`), et laisse la fiche fictive elle-même
 * (elle resservira). `scripts/visio/pilote.ts --purger --appliquer` l'appelle.
 *
 * Contre-témoin : le dossier d'une VRAIE fiche n'est pas touché.
 * Angle mort : la cascade des participants et des suivis (supprimés avec
 * leur rencontre) est celle de la base, non rejouée par la base en mémoire.
 */

import { describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return d.client;
  },
}));

import { purgerPilote } from "@/lib/rgpd-erase";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

describe("la purge du pilote ne laisse rien", () => {
  it("tout le pilote part, journalisé ; la vraie fiche reste intacte", async () => {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const vraie = fiche({ raisonSociale: "Vraie Fiche" });
    const rTest = id(5);
    const rVraie = id(5);
    const rencontre = (rid: string, clientId: unknown, test: boolean) => ({
      id: rid,
      source: "saisie_manuelle",
      type: "visio",
      titre: "t",
      clientId,
      rattachementStatut: "valide",
      statut: "planifie",
      estTestInterne: test,
    });
    const base = dossierEnMemoire({
      client: [fictif, vraie],
      clientTestInterne: [{ clientId: fictif["id"] }],
      rencontre: [rencontre(rTest, fictif["id"], true), rencontre(rVraie, vraie["id"], false)],
      fait: [
        {
          id: id(6),
          clientId: fictif["id"],
          portee: "entreprise",
          projetId: null,
          rencontreId: rTest,
          statut: "valide",
          type: "activite",
        },
        {
          id: id(6),
          clientId: vraie["id"],
          portee: "entreprise",
          projetId: null,
          rencontreId: rVraie,
          statut: "valide",
          type: "activite",
        },
      ],
      projet: [
        { id: id(8), clientId: fictif["id"], numero: "AXI-PRJ-2026-901", titre: "p" },
        { id: id(8), clientId: vraie["id"], numero: "AXI-PRJ-2026-902", titre: "p" },
      ],
      clientContact: [
        { id: id(7), clientId: fictif["id"], nom: "Testeur" },
        { id: id(7), clientId: vraie["id"], nom: "Vraie personne" },
      ],
    });
    d.client = base.client;

    const r = await purgerPilote();
    expect(r).toMatchObject({ rencontres: 1, faits: 1, projets: 1, personnes: 1 });
    const t = base.tables;
    expect(t["rencontre"]?.map((x) => x["id"])).toEqual([rVraie]);
    expect(t["fait"]?.every((x) => x["clientId"] === vraie["id"])).toBe(true);
    expect(t["projet"]?.every((x) => x["clientId"] === vraie["id"])).toBe(true);
    expect(t["clientContact"]?.every((x) => x["clientId"] === vraie["id"])).toBe(true);
    // La fiche fictive reste, inscrite.
    expect(t["client"]).toHaveLength(2);
    expect(t["clientTestInterne"]).toHaveLength(1);
    expect(new Set(t["effacementJournal"]?.map((e) => e["motif"]))).toEqual(new Set(["pilote"]));
    expect(base.brut).toContain("SET LOCAL axion.effacement_rgpd = 'on'");
  });
});
