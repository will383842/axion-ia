// @vitest-environment node
/**
 * ADR 0063 — LA PURGE DU PILOTE EMPORTE LES DOCUMENTS DE SES PROJETS.
 *
 * `projets` est RESTRICT envers `documents_projet` (clé « même client ») : sans
 * ce traitement, la purge des données de test échouait dès qu'un projet de test
 * portait un document. Rien ne se supprime, SAUF l'effacement RGPD : ici, sous
 * le drapeau, les OCTETS d'abord, puis les documents, puis le projet — chaque
 * document journalisé (`documents_projet`, motif `pilote`) pour que le rejeu
 * après restauration le resupprime.
 *
 * Contre-témoin : les documents d'une VRAIE fiche ne sont pas touchés.
 * La base réelle (refus sans drapeau, suppression admise sous le drapeau) est
 * prouvée en Gate D (`tests/integration/documents-projet/`, cas 14 à 17 et 24).
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

describe("la purge du pilote emporte les documents de ses projets", () => {
  it("octets, documents et projet de test partent, journalisés ; ceux de la vraie fiche restent", async () => {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const vraie = fiche({ raisonSociale: "Vraie Fiche" });
    const pTest = id(8);
    const pVrai = id(8);
    const dTest = id(9);
    const dVrai = id(9);
    const base = dossierEnMemoire({
      client: [fictif, vraie],
      clientTestInterne: [{ clientId: fictif["id"] }],
      projet: [
        { id: pTest, clientId: fictif["id"], numero: "AXI-PRJ-2026-901", titre: "p" },
        { id: pVrai, clientId: vraie["id"], numero: "AXI-PRJ-2026-902", titre: "p" },
      ],
      documentProjet: [
        { id: dTest, clientId: fictif["id"], projetId: pTest, titre: "Guide (test)" },
        { id: dVrai, clientId: vraie["id"], projetId: pVrai, titre: "Guide" },
      ],
      documentProjetContenu: [{ documentId: dTest }, { documentId: dVrai }],
    });
    d.client = base.client;

    const r = await purgerPilote();
    expect(r).toMatchObject({ projets: 1 });
    const t = base.tables;
    expect(t["documentProjetContenu"]?.map((x) => x["documentId"])).toEqual([dVrai]);
    expect(t["documentProjet"]?.map((x) => x["id"])).toEqual([dVrai]);
    expect(t["projet"]?.map((x) => x["id"])).toEqual([pVrai]);
    expect(t["effacementJournal"]?.filter((e) => e["tableCible"] === "documents_projet")).toEqual([
      expect.objectContaining({ ligneId: dTest, motif: "pilote" }),
    ]);
    // Sous le drapeau, dans la même transaction (le seul passage que les triggers admettent).
    expect(base.brut).toContain("SET LOCAL axion.effacement_rgpd = 'on'");
  });

  it("contre-témoin : sans document, la purge se comporte comme avant", async () => {
    const fictif = fiche({ raisonSociale: "Atelier Test Fictif" });
    const base = dossierEnMemoire({
      client: [fictif],
      clientTestInterne: [{ clientId: fictif["id"] }],
      projet: [{ id: id(8), clientId: fictif["id"], numero: "AXI-PRJ-2026-903", titre: "p" }],
    });
    d.client = base.client;
    const r = await purgerPilote();
    expect(r).toMatchObject({ projets: 1 });
    expect(
      (base.tables["effacementJournal"] ?? []).some((e) => e["tableCible"] === "documents_projet"),
    ).toBe(false);
  });
});
