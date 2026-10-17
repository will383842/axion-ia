/**
 * Candidature de formateur indépendant — le formulaire en 4 blocs (lot L0c-1).
 *
 * Vous · Votre activité · Vos formations · Pour finir. Ni photo, ni lettre,
 * ni « poste actuel », ni disponibilité, ni prétention : le tarif est fixé
 * (350 € HT la journée), il ne se négocie pas au formulaire.
 *
 * Livré ÉTEINT : interrupteur `formateurs.formulaire_freelance` absent = le
 * formulaire d'aujourd'hui.
 *
 * Module PUR et isomorphe (le formulaire et l'action le partagent).
 */

import { checkSiretFormat, normalizeSiret } from "@/lib/siret";

import { estOffreFormateurFreelance, type NatureCollaborationOffre } from "./formateur-freelance";

/** Les réponses écrites dans `JobApplication.answers` : la clé EST le libellé lu en console. */
export const REPONSE_CODE_POSTAL = "Code postal";
export const REPONSE_SIRET = "Numéro SIRET";
export const REPONSE_NUMERO_DECLARATION = "Numéro de déclaration d'activité";
export const REPONSE_INTERVIEWS = "Interviews filmées";

export const MESSAGE_SIRET_INVALIDE =
  "Ce numéro SIRET n'est pas valide : vérifiez les 14 chiffres.";

/**
 * La candidature se fait-elle dans le formulaire du formateur indépendant ?
 * Décidé côté serveur, par l'offre — jamais par une donnée du navigateur.
 */
export function modeFormateurFreelance(e: {
  readonly formulaireAllume: boolean;
  readonly natureLue: boolean;
  readonly offre:
    | {
        readonly slug?: string | null;
        readonly titleFr?: string | null;
        readonly employmentType?: string | null;
        readonly secondaryEmploymentType?: string | null;
        readonly natureCollaboration?: NatureCollaborationOffre | null | undefined;
      }
    | null
    | undefined;
}): boolean {
  if (!e.formulaireAllume || !e.offre) return false;
  return estOffreFormateurFreelance(e.offre, { natureLue: e.natureLue });
}

export type ChampsFormateurFreelance =
  | {
      ok: true;
      codePostal: string;
      formations: string;
      reponses: Record<string, string>;
    }
  | { ok: false; error: string };

const coche = (v: string | null) => v === "on" || v === "true" || v === "1";

/** Lit et vérifie les champs propres au formulaire (le reste suit le formulaire commun). */
export function lireChampsFormateurFreelance(
  lire: (cle: string) => string | null,
): ChampsFormateurFreelance {
  const codePostal = (lire("codePostal") ?? "").replace(/\s/g, "");
  if (!/^\d{5}$/.test(codePostal)) {
    return { ok: false, error: "Indiquez votre code postal (5 chiffres)." };
  }

  const reponses: Record<string, string> = { [REPONSE_CODE_POSTAL]: codePostal };

  const siretBrut = (lire("siret") ?? "").trim();
  if (siretBrut) {
    const siret = checkSiretFormat(siretBrut);
    if (!siret.ok) return { ok: false, error: MESSAGE_SIRET_INVALIDE };
    reponses[REPONSE_SIRET] = normalizeSiret(siret.value);
  }

  // Qualiopi ind. 21 (2026-10-17) — numéro de déclaration d'activité exigé : « pas encore
  // de numéro » n'est plus accepté, même envoyé à la main (`pasEncoreDeNumero`).
  const numero = (lire("numeroDeclaration") ?? "").replace(/\s/g, "");
  if (!numero) {
    return {
      ok: false,
      error:
        "Indiquez votre numéro de déclaration d'activité (11 chiffres) : il est nécessaire pour animer nos formations.",
    };
  }
  if (!/^\d{11}$/.test(numero)) {
    return { ok: false, error: "Le numéro de déclaration d'activité compte 11 chiffres." };
  }
  reponses[REPONSE_NUMERO_DECLARATION] = numero;

  const formations = (lire("formations") ?? "").trim().slice(0, 600);
  if (!formations) {
    return { ok: false, error: "Dites-nous en une phrase les formations que vous animez." };
  }

  if (coche(lire("interviews"))) {
    reponses[REPONSE_INTERVIEWS] = "D'accord pour qu'on me les propose";
  }

  return { ok: true, codePostal, formations, reponses };
}

/**
 * Ce que le dépôt fait d'une candidature, selon le formulaire envoyé et les
 * interrupteurs. Le formulaire se déclare (champ caché `formulaire`) : pendant
 * la bascule, l'ancien et le nouveau restent valables (pages en cache). Mais
 * tout EFFET neuf — accusé « mission », nature figée — exige l'interrupteur.
 */
export function decisionsDuDepot(e: {
  readonly formulaireEnvoye: unknown;
  readonly formulaireAllume: boolean;
  readonly textesValides: boolean;
  readonly natureLue: boolean;
  readonly offre: Parameters<typeof modeFormateurFreelance>[0]["offre"];
}): { modeFormateur: boolean; accuseMission: boolean; figerNature: boolean } {
  const modeFormateur =
    e.formulaireEnvoye === "formateur-freelance" &&
    modeFormateurFreelance({ formulaireAllume: true, natureLue: e.natureLue, offre: e.offre });
  return {
    modeFormateur,
    accuseMission: modeFormateur && e.formulaireAllume && e.textesValides,
    figerNature: e.formulaireAllume,
  };
}
