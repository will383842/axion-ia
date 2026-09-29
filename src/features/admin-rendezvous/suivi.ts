/**
 * Suivi d'un rendez-vous après l'appel — les règles (2026-09-27).
 *
 * Demande de Will : savoir si chaque rendez-vous a eu lieu, et ne laisser
 * aucun client sans suite. Fonctions pures : la lecture et l'écriture en base
 * sont dans `queries.ts` et `suivi-actions.ts`.
 *
 * Les règles, et pourquoi :
 *   · « A eu lieu » EXIGE une suite. Un appel tenu sans suite décidée est
 *     exactement le client qui tombe entre deux chaises ;
 *   · toute suite autre que « aucune » EXIGE une échéance : « relancer » sans
 *     date, c'est ne jamais relancer ;
 *   · « Absent » et « Reporté » n'exigent rien. Un report reviendra de
 *     lui-même par une nouvelle réservation Calendly.
 */

import { z } from "zod";

export const ISSUES = ["eu_lieu", "absent", "reporte"] as const;
export type IssueRdv = (typeof ISSUES)[number];

export const SUITES = ["devis", "relance", "proposition", "aucune"] as const;
export type SuiteRdv = (typeof SUITES)[number];

export const LIBELLE_ISSUE: Readonly<Record<IssueRdv, string>> = {
  eu_lieu: "A eu lieu",
  absent: "Absent",
  reporte: "Reporté",
};

export const LIBELLE_SUITE: Readonly<Record<SuiteRdv, string>> = {
  devis: "Devis à envoyer",
  relance: "Relance",
  proposition: "Proposition à faire",
  aucune: "Pas de suite",
};

/**
 * Jusqu'où « À faire le point » remonte. Au-delà, un rendez-vous sans point
 * reste modifiable depuis sa fiche, mais ne gonfle plus le compteur : les
 * appels d'avant cet écran n'ont pas à le mettre au rouge pour toujours.
 */
export const JOURS_A_FAIRE_LE_POINT = 30;

export const suiviSchema = z
  .object({
    calendlyEventId: z.string().min(1).max(64),
    issue: z.enum(ISSUES, { message: "Choisissez ce qui s'est passé." }),
    suite: z.enum(SUITES).nullable(),
    /** « AAAA-MM-JJ », tel que le rend un `<input type="date">`. */
    suiteLe: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
      .nullable(),
    note: z.string().trim().max(5000).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.issue === "eu_lieu" && !v.suite) {
      ctx.addIssue({
        code: "custom",
        path: ["suite"],
        message: "Le rendez-vous a eu lieu : choisissez la suite à donner.",
      });
    }
    if (v.issue === "eu_lieu" && v.suite && v.suite !== "aucune" && !v.suiteLe) {
      ctx.addIssue({
        code: "custom",
        path: ["suiteLe"],
        message: "Indiquez pour quand : une suite sans date ne se fait jamais.",
      });
    }
  });

export type SuiviSaisi = z.infer<typeof suiviSchema>;

/**
 * Ce qu'on garde vraiment : la suite n'a de sens que si l'appel a eu lieu, et
 * l'échéance que si une suite est prévue. Évite qu'un « Absent » garde la
 * suite d'une saisie précédente.
 */
export function normaliserSuivi(v: SuiviSaisi): {
  issue: IssueRdv;
  suite: SuiteRdv | null;
  suiteLe: Date | null;
  note: string | null;
} {
  const suite = v.issue === "eu_lieu" ? v.suite : null;
  const suiteLe =
    suite && suite !== "aucune" && v.suiteLe ? new Date(`${v.suiteLe}T00:00:00Z`) : null;
  return { issue: v.issue, suite, suiteLe, note: v.note && v.note.length > 0 ? v.note : null };
}

/** Lit un `FormData` de formulaire de suivi, champs vides → `null`. */
export function lireFormulaireSuivi(fd: FormData): unknown {
  const texte = (k: string): string | null => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  return {
    calendlyEventId: texte("calendlyEventId") ?? "",
    issue: texte("issue"),
    suite: texte("suite"),
    suiteLe: texte("suiteLe"),
    note: texte("note"),
  };
}

/**
 * Le lien `mailto:` de l'e-mail de relance d'un absent.
 *
 * 🔑 UN `mailto:`, PAS UN ENVOI. Le brouillon s'ouvre dans la messagerie de
 * Will, qui le relit et l'envoie lui-même : rien ne part sans sa validation.
 * Aucun numéro de téléphone dans le texte (ordre permanent du 2026-09-23).
 */
export function mailtoRelanceAbsent(opts: {
  email: string;
  prenom: string | null;
  quand: string;
  lienNouveauCreneau: string;
}): string {
  const bonjour = opts.prenom ? `Bonjour ${opts.prenom},` : "Bonjour,";
  const corps = [
    bonjour,
    "",
    `Je ne vous ai pas vu à notre rendez-vous du ${opts.quand}. Aucun souci, cela arrive.`,
    "",
    "Si vous souhaitez toujours échanger sur votre projet, vous pouvez choisir un autre créneau ici :",
    opts.lienNouveauCreneau,
    "",
    "Bien à vous,",
    "Williams Jullin",
    "Axion IA",
  ].join("\n");
  const sujet = "Notre rendez-vous — choisir un autre créneau";
  return `mailto:${encodeURIComponent(opts.email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

/** Premier mot du nom saisi dans Calendly (« Philippe Legrand » → « Philippe »). */
export function prenomDe(nom: string | null): string | null {
  const t = nom?.trim().split(/\s+/)[0];
  if (!t) return null;
  // Un nom saisi TOUT EN MAJUSCULES (« LE GRAND PHILIPPE ») ne donne pas un
  // prénom fiable : mieux vaut « Bonjour, » qu'un « Bonjour LE, ».
  return t === t.toUpperCase() ? null : t;
}
