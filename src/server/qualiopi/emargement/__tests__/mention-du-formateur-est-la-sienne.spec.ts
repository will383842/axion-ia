/**
 * CLIQUET — le formateur ne peut pas sceller le texte d'un stagiaire.
 *
 * ## Le défaut (2026-08-24, cahier D3-3)
 *
 * 🔴 L'écran de contresignature servait au formateur les mentions **du
 * stagiaire**. Le premier bloc affirmait « J'atteste avoir **suivi** la matinée
 * … » et le bloc RGPD annonçait la finalité « justifier de **votre assiduité** ».
 * Un formateur n'a pas suivi la formation : il l'a **animée**. Et il n'a pas
 * d'assiduité de stagiaire à justifier.
 *
 * Ce n'était pas qu'un défaut d'affichage. `MENTION_VERSION` est **scellée dans
 * le tuple haché** de la contresignature (`contresignature-service.ts`) : la
 * pièce attestait donc, sous empreinte cryptographique, que le formateur avait
 * lu un texte qui n'était pas le sien. Sur une pièce probante, c'est une
 * affirmation fausse — et c'est exactement ce que l'en-tête de `mentions.ts`
 * interdit d'écrire.
 *
 * 🔑 **L'origine est instructive.** `feuille-groupe.ts` raconte lui-même qu'un
 * correctif antérieur avait ajouté l'affichage des mentions au formateur, «
 * parce que la base enregistrait `mentionVersion` sans que personne n'ait jamais
 * vu le texte ». Ce correctif avait branché les mentions du stagiaire : la
 * moitié du travail. C'est la forme récurrente de ce dépôt — une règle juste,
 * appliquée à un site, oubliée sur son jumeau.
 *
 * ## Ce que ce fichier garde
 *
 * Que les deux jeux de mentions restent **distincts, versionnés séparément, et
 * chacun fidèle à ce que son signataire fait réellement**.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MENTION_VERSION,
  MENTION_VERSION_CONTRESIGNATURE,
  mentionComplete,
  mentionCompleteContresignature,
  type ParametresMention,
} from "@/server/qualiopi/emargement/mentions";

const P: ParametresMention = {
  formationIntitule: "IA pour bien commencer",
  jourLisible: "mercredi 10 juin 2026",
  demiJourneeLisible: "la matinée",
  horaires: "09:00–17:00",
  organisme: "Axion-IA",
};

describe("la mention du formateur est la sienne", () => {
  it("le formateur atteste avoir ANIMÉ, jamais avoir suivi", () => {
    // 🔴 Le cœur du défaut. Le texte servi à l'écran de contresignature
    // affirmait « J'atteste avoir suivi … ».
    const texte = mentionCompleteContresignature(P).join(" ");

    expect(
      texte,
      "la mention de contresignature ne dit pas que le formateur a ANIMÉ la " +
        "demi-journée. C'est pourtant tout ce qu'elle atteste : la contresignature " +
        "est la pièce qui établit que la séance a bien été dispensée.",
    ).toMatch(/anim/i);

    expect(
      texte,
      "la mention de contresignature affirme que le formateur a SUIVI la " +
        "formation. C'est le texte du stagiaire — et il est scellé dans le tuple " +
        "haché de la contresignature, donc la pièce affirme une chose fausse sous " +
        "empreinte cryptographique.",
    ).not.toMatch(/avoir suivi/i);
  });

  it("le formateur n'a pas d'« assiduité » à justifier", () => {
    // Le bloc RGPD du stagiaire annonce la finalité « justifier de votre
    // assiduité » (L.6362-5, R.6313-3). Appliquée au formateur, la finalité est
    // fausse : ses données servent à établir que la séance a été ANIMÉE.
    // Une finalité inexacte est un défaut d'information au sens de l'art. 13.
    const texte = mentionCompleteContresignature(P).join(" ");
    expect(
      texte,
      "la mention de contresignature annonce au formateur la finalité prévue pour " +
        "un stagiaire (« votre assiduité »). L'information RGPD due au titre de " +
        "l'art. 13 doit énoncer la finalité RÉELLE du traitement.",
    ).not.toMatch(/votre assiduité/i);
  });

  it("le formateur reçoit quand même son information RGPD complète", () => {
    // 🔑 CONTRE-TÉMOIN, dans l'autre sens. Corriger le texte ne doit pas revenir
    // à AMPUTER le formateur de l'information qui lui est due : on collecte son
    // tracé, son horodatage, et les empreintes de son IP et de son navigateur —
    // exactement comme pour un stagiaire.
    //
    // Sans ce cas, on pourrait « corriger » le défaut en servant une phrase
    // unique sans aucun bloc RGPD, et les deux tests ci-dessus passeraient.
    const blocs = mentionCompleteContresignature(P);
    const texte = blocs.join(" ");

    expect(blocs.length, "la mention de contresignature a perdu ses blocs").toBeGreaterThanOrEqual(
      3,
    );
    for (const [motif, quoi] of [
      [/1366/, "la valeur juridique de la signature électronique (art. 1366 C. civ.)"],
      [/adresse IP|empreinte/i, "ce qui est collecté (empreintes d'IP et de navigateur)"],
      [/[Cc]onservation/, "la durée de conservation"],
      [/effacement/i, "les droits d'accès, de rectification et d'effacement"],
    ] as ReadonlyArray<readonly [RegExp, string]>) {
      expect(
        texte,
        `l'information RGPD due au formateur a perdu ${quoi}. Corriger la mention ` +
          `ne doit pas revenir à l'amputer : on collecte son tracé, son horodatage ` +
          `et les empreintes de son IP et de son navigateur, exactement comme pour ` +
          `un stagiaire.`,
      ).toMatch(motif);
    }
  });

  it("les deux jeux de mentions ont des VERSIONS distinctes", () => {
    // Sans versions distinctes, modifier le texte du formateur obligerait à
    // incrémenter celui du stagiaire — ou, pire, laisserait les deux textes
    // dériver sous une même version. `mention_version` sert précisément à dire
    // CE QUI A ÉTÉ SIGNÉ : deux textes différents ne peuvent pas partager une
    // version.
    //
    // Le dépôt porte déjà ce motif : `MENTION_VERSION_DOCUMENT` pour les pièces
    // contractuelles.
    expect(
      MENTION_VERSION_CONTRESIGNATURE,
      "la contresignature et la signature du stagiaire scellent la MÊME version " +
        "alors qu'elles présentent des textes différents : `mention_version` ne " +
        "permet plus de savoir ce qui a été signé.",
    ).not.toBe(MENTION_VERSION);
  });

  it("les deux textes diffèrent réellement — sinon les versions mentent", () => {
    // 🔑 Contre-témoin du test précédent. Deux versions distinctes posées sur un
    // texte identique seraient une comptabilité vide.
    expect(
      mentionCompleteContresignature(P).join(" "),
      "le formateur et le stagiaire reçoivent le même texte sous deux versions " +
        "différentes : la distinction de version ne recouvre rien.",
    ).not.toBe(mentionComplete(P).join(" "));
  });

  /**
   * Les DEUX écrans qui recueillent une signature. Le second est le jumeau : le
   * défaut a été trouvé sur l'écran formateur, et la même phrase en dur vivait
   * dans le portail stagiaire. Ce dépôt paie régulièrement le motif « une règle
   * appliquée à un site, oubliée sur son jumeau » — d'où les deux, ensemble.
   */
  const ECRANS_DE_SIGNATURE = [
    ["components", "espace-formateur", "EmargementGroupe.tsx"],
    ["components", "portail", "EmargementForm.tsx"],
  ] as const;

  it.each(ECRANS_DE_SIGNATURE)(
    "%s/%s/%s ne fabrique plus sa propre phrase d'attestation",
    (...chemin) => {
      // 🔴 La seule phrase juste que voyait le formateur — « J'atteste avoir
      // animé cette demi-journée » — était CODÉE EN DUR dans le JSX, hors de
      // `mentions.ts`. Elle échappait donc à la règle de versionnement que ce
      // module impose en toutes lettres : elle pouvait être réécrite sans que
      // `mentionVersion` bouge, rendant invérifiable ce qui avait été présenté
      // aux signataires précédents.
      //
      // ⚠️ On lit le fichier LIGNE PAR LIGNE en écartant les commentaires : un
      // test statique naïf trouverait ses propres explications, et ce dépôt
      // s'est déjà fait piéger par un extracteur qui lisait les commentaires.
      const source = readFileSync(join(process.cwd(), "src", ...chemin), "utf8");
      const codeSeul = source
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
        .join("\n");

      expect(
        codeSeul,
        `${chemin.join("/")} porte de nouveau une phrase d'attestation en dur. ` +
          "Elle échapperait au versionnement de `mentions.ts` : on pourrait la " +
          "réécrire sans changer `mentionVersion`, et la pièce scellée pointerait " +
          "vers un texte qui n'existe plus. Le texte doit venir d'un export de " +
          "`mentions.ts`.",
      ).not.toMatch(/atteste avoir/i);
    },
  );

  it("le contre-témoin : l'extracteur reconnaîtrait bien une phrase en dur", () => {
    // 🔑 Sans ce cas, le test ci-dessus passerait au vert même si son extracteur
    // cassait ou si son motif ne reconnaissait plus rien — il n'examinerait
    // alors AUCUN écran, en silence. C'est la panne que ce dépôt a payée cinq
    // fois.
    const faux = [
      "// J'atteste avoir animé — ceci est un commentaire",
      "<span>J'atteste avoir suivi cette demi-journée.</span>",
    ].join("\n");
    const codeSeul = faux
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
      .join("\n");

    expect(
      codeSeul,
      "l'extracteur ne reconnaît plus une phrase d'attestation en dur : le test " +
        "précédent ne garde donc plus rien.",
    ).toMatch(/atteste avoir/i);
    expect(
      codeSeul,
      "l'extracteur ne retire plus les lignes de commentaire : il accuserait les " +
        "explications d'un fichier au lieu de son code.",
    ).not.toMatch(/ceci est un commentaire/);
  });
});
