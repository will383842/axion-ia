// Vérification n° 2 (rouge « parcours et e-mails ») — relecture de TOUS les textes
// d'e-mail aux formateurs indépendants, tels que le code les enverra
// (`TEXTES_FORMATEUR`, chaque variante, objet, paragraphes et boutons) :
//
//   · vouvoiement, jamais de tutoiement ;
//   · aucun mot de recrutement salarié (embauche, salaire, CDI/CDD, période d'essai) ;
//   · jamais « Grenoble » dans ce que le message dit, jamais « Aucun gain garanti »,
//     aucune promesse de volume ou de revenu (« aucun volume n'est garanti » est permis) ;
//   · les nombres qui engagent sont ceux des règles : seuil URSSAF de 5 000 € HT
//     (`lib/vigilance.ts`), virement à 30 jours de la facture, bilan du DERNIER mois
//     seulement — les mêmes que le contrat-cadre v4 et la lettre de mission v3.
//
// Le pied de page légal (adresse du siège) n'est pas un texte de cette liste.

import { describe, expect, it } from "vitest";

import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import { SEUIL_VIGILANCE_CENTS } from "@/lib/vigilance";

type Fiche = {
  titre: string;
  variantes: ReadonlyArray<{
    objet: string;
    paragraphes: readonly string[];
    boutons: readonly string[];
  }>;
};

const FICHES = Object.entries(TEXTES_FORMATEUR as unknown as Record<string, Fiche>);

/** Chaque texte qui part : `gabarit#variante` → texte complet. */
const TEXTES: ReadonlyArray<[string, string]> = FICHES.flatMap(([gabarit, fiche]) =>
  fiche.variantes.map((v, i): [string, string] => [
    `${gabarit}#${i + 1}`,
    [v.objet, ...v.paragraphes, ...v.boutons].join("\n"),
  ]),
);

const fautes = (motif: RegExp, sauf?: RegExp) =>
  TEXTES.filter(([, t]) => motif.test(sauf ? t.replace(sauf, "") : t)).map(([cle]) => cle);

describe("V2P — textes des e-mails aux formateurs indépendants", () => {
  it("la liste n'est pas vide (garde du test lui-même)", () => {
    expect(TEXTES.length).toBeGreaterThan(50);
  });

  it("vouvoiement : aucun « tu / toi / ton / ta / tes »", () => {
    expect(fautes(/(^|[\s'’(«])(tu|toi|ton|ta|tes)(?=[\s,.!?;:»)]|$)/i)).toEqual([]);
  });

  it("aucun mot de recrutement salarié", () => {
    expect(
      fautes(/embauch|\bsalaires?\b|\bCDI\b|\bCDD\b|p[ée]riode d'essai|contrat de travail/i),
    ).toEqual([]);
  });

  it("jamais « Grenoble », jamais « Aucun gain garanti »", () => {
    expect(fautes(/Grenoble|aucun gain garanti/i)).toEqual([]);
  });

  it("aucune promesse de volume, de revenu ou de gain", () => {
    // « Aucun volume n'est garanti » et « n'est garanti » (négations) sont permis.
    expect(
      fautes(/garanti(e|s)?\b/i, /(aucun volume n'est garanti|n'est garanti|aucun volume)/gi),
    ).toEqual([]);
  });

  it("le seuil URSSAF cité est celui de la règle (5 000 € HT), jamais un autre", () => {
    const seuil = (SEUIL_VIGILANCE_CENTS / 100).toLocaleString("fr-FR").replace(/\s/g, " ");
    const montants = TEXTES.flatMap(([cle, t]) =>
      /urssaf|vigilance/i.test(t)
        ? [...t.matchAll(/(\d[\d\s  ]*\d)\s*€/g)].map((m) => [cle, m[1]?.replace(/\s/g, " ")])
        : [],
    );
    expect(montants.length).toBeGreaterThan(0);
    for (const [cle, m] of montants) expect(m, cle).toBe(seuil);
  });

  it("paiement : la lettre F26 dit « au plus tard 30 jours après la date de cette facture »", () => {
    const f26 = TEXTES.filter(([cle]) => cle.startsWith("formateur-lettre-a-signer#"))
      .map(([, t]) => t)
      .join("\n");
    expect(f26).toMatch(/au plus tard 30 jours après la date de cette facture/);
    expect(f26).toMatch(/pour le dernier mois, bilan de fin de formation/);
  });

  it("aucun texte ne lie le paiement de TOUS les mois au bilan de fin de formation", () => {
    const lies = TEXTES.filter(
      ([, t]) =>
        /bilan/i.test(t) && /(paiement|virement|facture)/i.test(t) && !/dernier mois/i.test(t),
    ).map(([cle]) => cle);
    // Le rappel du bilan (F61) peut le dire pour SA session, sans parler de « tous les mois ».
    expect(lies.filter((c) => !c.startsWith("formateur-bilan-fin-formation#"))).toEqual([]);
  });
});
