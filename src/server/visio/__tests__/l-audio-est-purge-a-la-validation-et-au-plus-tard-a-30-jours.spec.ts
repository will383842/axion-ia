/**
 * ⛔ L'AUDIO EST PURGÉ À LA VALIDATION ET AU PLUS TARD À 30 JOURS (B1 ; ADR 0056).
 *
 *   · à la validation du compte rendu ; à l'échéance `audioAPurgerAvant`
 *     (fin + 30 jours) ; tout de suite sur un refus, un accord non confirmé,
 *     un abandon ;
 *   · `audioSupprimeLe` n'est posé qu'APRÈS avoir vérifié que chaque objet a
 *     disparu de R2 ; un objet qui résiste laisse l'étape en échec (reprise).
 *
 * Mutation qui rougit : dans `purgerAudio`, poser `audioSupprimeLe` sans la
 * vérification `objetExiste` → l'objet qui résiste est déclaré purgé ; ou
 * retirer le filtre `audioAPurgerMaintenant` → le son d'une relance encore
 * « déposée » part à la validation de la première partie.
 * Contre-témoin : avant l'échéance, sans validation, rien n'est purgé.
 * Angle mort : la suppression chez Cloudflare (réplication) n'est pas
 * observable ; `existsInR2` est la seule mesure.
 */

import { describe, expect, it } from "vitest";

import { CONSERVATION_AUDIO_MAX_JOURS } from "../cloture";
import { executerEtape } from "../etapes";
import { audioAPurgerMaintenant, purgerAudio } from "../purge-audio";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

const M = new Date("2026-10-06T10:00:00Z");

/** Un enregistrement dont le compte rendu est validé : sa purge est due. */
const DU = { statut: "valide", audioAPurgerAvant: null, compteRenduValide: true } as const;

describe("l'audio est purgé à la validation et au plus tard à 30 jours", () => {
  it("les déclencheurs", () => {
    const base = {
      statut: "compte_rendu_pret",
      audioSupprimeLe: null,
      audioAPurgerAvant: new Date("2026-11-05T10:00:00Z"),
      compteRenduValide: false,
      maintenant: M,
    };
    expect(audioAPurgerMaintenant(base)).toBe(false);
    expect(audioAPurgerMaintenant({ ...base, compteRenduValide: true })).toBe(true);
    expect(audioAPurgerMaintenant({ ...base, maintenant: new Date("2026-11-05T10:00:01Z") })).toBe(
      true,
    );
    for (const statut of ["refuse", "accord_non_confirme", "abandonne", "valide"]) {
      expect(audioAPurgerMaintenant({ ...base, statut }), statut).toBe(true);
    }
    expect(CONSERVATION_AUDIO_MAX_JOURS).toBe(30);
  });

  it("chaque objet supprimé puis vérifié absent ; alors seulement `audioSupprimeLe`", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "purger_audio",
    });
    const r2 = new Set([
      "visio-audio/e1/client/0000/00000.bin",
      "visio-audio/e1/axion/0000/00000.bin",
    ]);
    const marques: string[] = [];
    const deps = depsDeTest({
      depot,
      gestionnaires: { purger_audio: purgerAudio },
      donnees: {
        audiosAPurger: async () => [
          { ...DU, enregistrementId: "e1", trancheIds: ["t1", "t2"], cles: [...r2] },
        ],
        supprimerObjet: async (c) => {
          r2.delete(c);
        },
        objetExiste: async (c) => r2.has(c),
        marquerAudioPurge: async (_tx, a) => {
          marques.push(a.enregistrementId);
        },
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(r2.size).toBe(0);
    expect(marques).toEqual(["e1"]);
  });

  it("contre-témoin : un objet qui résiste → rien n'est marqué, l'étape repart", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "purger_audio",
    });
    const marques: string[] = [];
    const deps = depsDeTest({
      depot,
      gestionnaires: { purger_audio: purgerAudio },
      donnees: {
        audiosAPurger: async () => [
          {
            ...DU,
            enregistrementId: "e1",
            trancheIds: ["t1"],
            cles: ["visio-audio/e1/client/0000/00000.bin"],
          },
        ],
        supprimerObjet: async () => undefined,
        objetExiste: async () => true,
        marquerAudioPurge: async (_tx, a) => {
          marques.push(a.enregistrementId);
        },
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("a_reessayer");
    expect(marques).toEqual([]);
    expect(depot.ligne(t.id)).toMatchObject({
      statut: "a_faire",
      derniereErreur: "stockage_indisponible",
    });
  });
  it("⛔ une rencontre à deux enregistrements : seul le son DÛ part, la relance « déposée » reste", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "purger_audio",
    });
    const r2 = new Set([
      "visio-audio/e1/client/0000/00000.bin",
      "visio-audio/e2/client/0000/00000.bin",
    ]);
    const marques: string[] = [];
    const deps = depsDeTest({
      depot,
      gestionnaires: { purger_audio: purgerAudio },
      donnees: {
        audiosAPurger: async () => [
          {
            ...DU,
            enregistrementId: "e1",
            trancheIds: ["t1"],
            cles: ["visio-audio/e1/client/0000/00000.bin"],
          },
          {
            enregistrementId: "e2",
            trancheIds: ["t2"],
            cles: ["visio-audio/e2/client/0000/00000.bin"],
            statut: "depose",
            audioAPurgerAvant: new Date("2026-11-05T10:00:00Z"),
            compteRenduValide: false,
          },
        ],
        supprimerObjet: async (c) => {
          r2.delete(c);
        },
        objetExiste: async (c) => r2.has(c),
        marquerAudioPurge: async (_tx, a) => {
          marques.push(a.enregistrementId);
        },
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(marques).toEqual(["e1"]);
    expect([...r2]).toEqual(["visio-audio/e2/client/0000/00000.bin"]);
  });
});
