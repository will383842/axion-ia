/**
 * Vérification n° 2 — regard du FORMATEUR NOVICE : les e-mails qu'il reçoit de F1 à F61
 * (`formateur-independant-textes.ts`), lus comme lui les lit, au téléphone.
 *
 *   · objet court (45 caractères, la règle du référentiel : au-delà, coupé à l'écran) ;
 *   · un seul geste demandé par message (au plus un bouton par défaut) ;
 *   · pas de mur de texte (130 mots au plus) ;
 *   · ni anglais, ni mot technique, ni vocabulaire du salariat ;
 *   · un code de catalogue par message (Will valide « F61 » : il doit savoir lequel).
 *
 * Seuls les messages adressés au formateur sont lus (`interne: false`).
 */
import { describe, expect, it } from "vitest";

import {
  TEXTES_FORMATEUR,
  type TexteFormateur,
} from "@/lib/email/templates/formateur-independant-textes";

const FICHES = Object.entries(TEXTES_FORMATEUR) as Array<[string, TexteFormateur]>;
const AU_FORMATEUR = FICHES.filter(([, f]) => !f.interne);

/** Un mot entier, accents compris (`\b` de JS coupe « signé » après « sign »). */
const mot = (liste: string) => new RegExp(`(?<![\\p{L}\\d])(?:${liste})(?![\\p{L}\\d])`, "iu");

const ANGLAIS = mot(
  "click|here|dear|hello|please|account|login|log in|sign in|download|meeting|call|deadline|feedback|update|team|booking|check|ok|email me|1-to-1|onboarding",
);
const TECHNIQUE = mot(
  "null|undefined|NaN|true|false|uuid|token|payload|webhook|cron|HTTP|enum|[a-z]+_[a-z_]+",
);
// Le lexique du chantier (`le-dossier-formateur-respecte-le-lexique.spec.ts`) : un
// indépendant n'a ni poste, ni entretien, ni salaire.
const SALARIAT = mot(
  "poste|entretien|recrutement|salaire|rémunération|vous devez|obligatoire|embauche|subordination",
);

function texteDe(v: TexteFormateur["variantes"][number]): string {
  return [v.objet, ...v.paragraphes, ...v.boutons].join("\n");
}

describe("V2-N · les e-mails du formateur, lus par un novice", () => {
  it("il y a bien des messages à lire (garde-fou du test)", () => {
    expect(AU_FORMATEUR.length).toBeGreaterThan(40);
  });

  for (const [gabarit, fiche] of AU_FORMATEUR) {
    fiche.variantes.forEach((v, i) => {
      const nom = `${fiche.code} ${gabarit}${fiche.variantes.length > 1 ? ` (${v.etape ?? i})` : ""}`;
      it(`${nom} — objet ≤ 45 caractères, un bouton au plus, 130 mots au plus`, () => {
        expect(v.objet.length, v.objet).toBeLessThanOrEqual(45);
        expect(v.boutons.length).toBeLessThanOrEqual(fiche.code === "F14" ? 2 : 1);
        const mots = v.paragraphes.join(" ").split(/\s+/).filter(Boolean).length;
        expect(mots).toBeLessThanOrEqual(130);
      });
      it(`${nom} — ni anglais, ni technique, ni vocabulaire du salariat`, () => {
        const t = texteDe(v);
        expect(ANGLAIS.exec(t)?.[0] ?? null).toBeNull();
        expect(TECHNIQUE.exec(t)?.[0] ?? null).toBeNull();
        expect(SALARIAT.exec(t)?.[0] ?? null).toBeNull();
      });
    });
  }

  // V2-N-17 (mineur, doublon) — deux messages différents portent le même code « F61 » :
  // `formateur-bilan-fin-formation` (relance du bilan) et `formateur-email-modifie`
  // (adresse modifiée). L'ordre d'allumage parle de « F61 » pour le bilan ; l'écran de
  // validation des textes affiche les deux sous le même numéro.
  it.fails("V2-N-17 — chaque message a son propre code de catalogue", () => {
    const parCode = new Map<string, string[]>();
    for (const [g, f] of FICHES) parCode.set(f.code, [...(parCode.get(f.code) ?? []), g]);
    const doublons = [...parCode].filter(([, gs]) => gs.length > 1);
    expect(doublons).toEqual([]);
  });
});
