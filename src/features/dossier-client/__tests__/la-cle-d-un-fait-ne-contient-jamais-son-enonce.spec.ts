// @vitest-environment node
/**
 * ⛔ La clé d'un fait ne recopie JAMAIS sa parole en clair.
 *
 * `faits.enonce` est chiffré ; `faits.cle` est une colonne EN CLAIR (elle
 * sert au regroupement). Dériver la clé du texte saisi — « former_l_equipe »,
 * « recommande_par_… » — recopiait la parole du client en clair dans la base,
 * les `pg_dump` et les sauvegardes immuables, où elle ne s'efface plus : le
 * chiffrement de `enonce` (correction EX-M6) était contourné.
 *
 * Vérifié sur les DEUX écrivains de faits saisis : la note manuelle et la
 * reprise de l'historique Calendly (réponses au formulaire).
 *
 * Mutation qui fait rougir : faire rendre à `cleDuFait` le texte réduit (ou
 * un extrait) → les deux tests rougissent.
 * Contre-témoin : un type à valeur unique garde la clé « global ».
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { faitsDeLaNote } from "../note-manuelle";
import { reprendreHistoriqueCalendly } from "../reprise-historique";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

/** Les mots (≥ 4 caractères) d'un texte, réduits comme une clé les réduirait. */
function mots(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 4);
}

function motRecopie(cle: string, texte: string): string | null {
  const c = cle.toLowerCase();
  return mots(texte).find((m) => c.includes(m)) ?? null;
}

describe("⛔ la clé d'un fait ne contient jamais son énoncé", () => {
  it("note manuelle : aucune clé ne porte un mot saisi", () => {
    const faits = faitsDeLaNote(
      {
        activite: "Menuiserie fictive sur mesure",
        besoin: "Former l'équipe commerciale",
        prochaineEtape: "Envoyer le devis",
        objection: true,
        objectionTexte: "Tarif jugé élevé par Dupontfictif",
      },
      true,
    );
    expect(faits.length).toBe(4);
    for (const f of faits) {
      expect(motRecopie(f.cle, f.enonce), `${f.type} : ${f.cle}`).toBeNull();
      expect(f.cle.length).toBeLessThanOrEqual(80);
    }
    // Contre-témoin : un type unique garde la clé de consolidation « global ».
    expect(faits.find((f) => f.type === "prochaine_etape")?.cle).toBe("global");
  });

  it("reprise de l'historique : aucune clé ne porte une réponse au formulaire", async () => {
    const reponses = [
      { question: "Votre besoin", answer: "Automatiser les devis fictifs" },
      { question: "Qui vous a recommandé ?", answer: "Recommandé par Dupontfictif Camille" },
      { question: "Autre chose à nous dire", answer: "Disponible surtout mardis" },
    ];
    const ev = rendezVousCalendly({
      startTime: new Date("2026-09-10T08:00:00Z"),
      rawPayload: { invitee: { questions_and_answers: reponses } },
    });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    await reprendreHistoriqueCalendly(base.client as never, {
      appliquer: true,
      maintenant: new Date("2026-09-30T09:00:00Z"),
    });
    const faits = base.tables["fait"] ?? [];
    expect(faits).toHaveLength(3);
    for (const f of faits) {
      const cle = String(f["cle"]);
      for (const r of reponses) {
        expect(motRecopie(cle, r.answer), `${String(f["type"])} : ${cle}`).toBeNull();
      }
    }
  });
});
