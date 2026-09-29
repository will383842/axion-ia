// @vitest-environment node

/**
 * Verrou — chaque durée que la notice ANNONCE pour les rendez-vous enregistrés
 * est APPLIQUÉE par une purge, et c'est la même valeur (chantier visio, PR 8 ;
 * B1 ; modèle : `la-retention-des-appels-suit-la-notice.spec.ts`).
 *
 * ## Pourquoi
 *
 * Une durée publiée qu'aucun mécanisme n'applique est l'écart le plus facile
 * à constater en contrôle : lire la page, puis la base. La notice et la purge
 * vivent dans des fichiers relus par des passes différentes (éditoriale,
 * technique) : sans ce test, rien ne rougirait si l'une bougeait seule.
 *
 * ## Comment
 *
 * Le test DÉRIVE chaque durée du TEXTE de la notice (celui qui sera publié à
 * la bascule), la compare à `CONSERVATION_VISIO` — la constante que la purge
 * lit —, puis vérifie que la purge existe et est planifiée : chaque fonction
 * est exportée par `src/lib/rgpd-erase.ts` ET appelée par
 * `retention-purge-worker.ts`.
 *
 * Contre-témoin : une notice fictive à « 60 jours » ne donne pas la valeur de
 * la constante. Angles morts : la purge du SON (30 jours) appartient au
 * circuit (PR 6) — ici, seule la durée annoncée est comparée à la constante ;
 * le contenu des faits rejetés (30 jours) n'est pas annoncé (donnée interne).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONSERVATION_VISIO, sectionRendezVousDecouverte } from "../visio-annonce-textes";

const WORKER = "src/server/queue/workers/retention-purge-worker.ts";
const ERASE = "src/lib/rgpd-erase.ts";
const NOTICE = "src/content/legal.ts";

const lire = (f: string): string => readFileSync(join(process.cwd(), f), "utf8");

/** Les durées lues dans une section de notice (FR). */
function dureesAnnoncees(texte: string) {
  const n = (re: RegExp): number => Number(re.exec(texte)?.[1] ?? Number.NaN);
  return {
    audioJoursMax: n(/son, au plus tard (\d+) jours/),
    segmentsMois: n(/transcription, (\d+) mois après le rendez-vous/),
    prospectAns: n(/(\d+) ans après notre dernier rendez-vous si vous n'êtes pas devenu client/),
    clientAns: n(/(\d+) ans après notre dernière activité commune/),
    versionsJours: n(/versions remplacées ou rejetées d'un compte rendu, (\d+) jours/),
    preuvesApresDossierAns: n(/preuve de votre accord \([^)]*\), (\d+) ans après la fin/),
  };
}

/** Purge planifiée par le worker pour chaque durée annoncée. */
const PURGES = {
  segmentsMois: "purgerSegmentsAnciens",
  prospectAns: "purgerDossiersVisioEchus",
  clientAns: "purgerDossiersVisioEchus",
  versionsJours: "purgerVersionsComptesRendus",
  preuvesApresDossierAns: "purgerPreuvesAccordEchues",
} as const;

describe("une durée annoncée pour les rendez-vous a sa purge", () => {
  const annoncees = dureesAnnoncees(sectionRendezVousDecouverte("fr", true));

  for (const [cle, valeur] of Object.entries(annoncees)) {
    it(`🔴 « ${cle} » : la notice et la constante de la purge disent la même chose`, () => {
      expect(valeur, `durée « ${cle} » introuvable dans la notice`).not.toBeNaN();
      expect(valeur).toBe(CONSERVATION_VISIO[cle as keyof typeof CONSERVATION_VISIO]);
    });
  }

  for (const [cle, fonction] of Object.entries(PURGES)) {
    it(`🔴 « ${cle} » est appliquée : ${fonction} est exportée ET planifiée`, () => {
      expect(lire(ERASE)).toMatch(new RegExp(`export async function ${fonction}\\(`));
      expect(lire(WORKER)).toMatch(new RegExp(`await ${fonction}\\(`));
    });
  }

  it("🔴 le worker lit ses seuils de la constante, pas d'une variable d'environnement", () => {
    const src = lire(WORKER);
    expect(src).toMatch(/seuilsDuJour\(maintenant\)/);
    expect(src).not.toMatch(/RETENTION_VISIO/);
  });

  it("🔴 le prospect suit la durée générale des demandes commerciales", () => {
    const annees = Number(/Demandes commerciales\s*:\s*(\d+)\s*ans?/.exec(lire(NOTICE))?.[1]);
    expect(CONSERVATION_VISIO.prospectAns).toBe(annees);
  });

  it("🔴 le préavis annonce la durée du son DÉRIVÉE de la notice, pas une copie", () => {
    // Le préavis (e-mail aux clients actifs) et la notice annoncent la même
    // durée : une seule constante, sinon l'une bougerait sans l'autre.
    const preavis = lire("src/lib/email/templates/preavis-sous-traitants.tsx");
    expect(preavis).toMatch(
      /export const CONSERVATION_SON_MAX_JOURS: number = CONSERVATION_VISIO\.audioJoursMax;/,
    );
  });

  it("🔑 CONTRE-TÉMOIN : une notice à une autre durée ne donne pas la constante", () => {
    const faux = sectionRendezVousDecouverte("fr", true).replace(
      "son, au plus tard 30 jours",
      "son, au plus tard 60 jours",
    );
    expect(dureesAnnoncees(faux).audioJoursMax).not.toBe(CONSERVATION_VISIO.audioJoursMax);
  });
});
