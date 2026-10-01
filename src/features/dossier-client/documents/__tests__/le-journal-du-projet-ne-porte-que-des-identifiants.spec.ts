// @vitest-environment node

/**
 * R9 — LE JOURNAL DU PROJET NE PORTE QUE DES IDENTIFIANTS (ADR 0063, D9).
 *
 * Ajout, archivage, réaffichage et téléchargement écrivent une ligne
 * `projet_evenements` avec `documentId` et l'auteur — JAMAIS le titre ni le nom
 * du fichier (ils peuvent nommer une personne : « Compte rendu — entretien avec
 * Mme Martin »). Le journal est en ajout seul : ce qui y entre n'en sort plus.
 *
 * Mutation qui rougit : mettre le titre dans `motif` « pour lire l'historique ».
 * Contre-témoin : les quatre actions sont bien journalisées, dans l'ordre.
 */

import { describe, expect, it } from "vitest";

import { ajouterFichier, ajouterLien } from "../ajouter";
import { archiver, reafficher } from "../archiver";
import { telechargerDocument } from "../telecharger";
import { baseEnMemoire } from "./_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const TITRE = "Compte rendu — entretien avec Mme Martin";
const NOM = "CR-Martin-confidentiel.pdf";
const sain = async () => ({ issue: "sain" as const });

describe("le journal du projet ne porte que des identifiants", () => {
  it("ajout, archivage, réaffichage, téléchargement : documentId, jamais titre ni nom", async () => {
    const { db, etat } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    const commun = {
      clientId: CLIENT,
      projetId: PROJET,
      cote: "interne" as const,
      nature: "compte_rendu" as const,
      titre: TITRE,
      envoyeLe: null,
      parAdminId: ADMIN,
    };
    const f = await ajouterFichier(
      db as never,
      { ...commun, nom: NOM, octets: new TextEncoder().encode("%PDF-1.4 x") },
      sain,
    );
    const l = await ajouterLien(db as never, { ...commun, lien: "https://exemple.fr/martin" });
    const t = { id: f.id, projetId: PROJET, clientId: CLIENT, parAdminId: ADMIN };
    await archiver(db as never, t);
    await reafficher(db as never, t);
    await telechargerDocument(db as never, t, sain);

    expect(etat.evenements.map((e) => [e["action"], e["documentId"]])).toEqual([
      ["document_ajoute", f.id],
      ["document_ajoute", l.id],
      ["document_archive", f.id],
      ["document_reaffiche", f.id],
      ["document_telecharge", f.id],
    ]);
    for (const e of etat.evenements) {
      expect(e["projetId"]).toBe(PROJET);
      expect(e["parAdminId"]).toBe(ADMIN);
      const texte = JSON.stringify(e);
      expect(texte).not.toContain("Martin");
      expect(texte).not.toContain("exemple.fr");
      expect(e["motif"] ?? null).toBeNull();
    }
  });
});
