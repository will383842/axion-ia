/**
 * L'E-MAIL DE SUIVI d'un rendez-vous (chantier visio, PR 7 ; V-14).
 *
 * Rédigé à partir des SEULS faits VALIDÉS de la rencontre (jamais une
 * citation, jamais la transcription), vérifié par le code, puis mis en file
 * `exigerValidation: true` : il attend dans « E-mails à valider » et ne part
 * QUE sur le clic de Will (ordre permanent). Si la passe échoue, un GABARIT
 * FIXE (« En bref / engagements / prochaine étape ») est proposé.
 *
 *   · G14 — aucun prix, aucune TVA, aucun montant ;
 *   · G15 — aucun lien, aucune adresse, aucun téléphone ;
 *   · G9 réduit — chaque nombre écrit figure dans un fait ;
 *   · chaque paragraphe s'appuie sur des faits connus (F…).
 *
 * Le destinataire n'est JAMAIS une adresse écrite par l'IA : c'est un
 * participant client VALIDÉ de la rencontre (`destinataireValide`), adresse
 * professionnelle de préférence.
 *
 * Module PUR.
 */

import type { FaitType } from "../../../../prisma/generated/client";
import { OBJET_MAX, objetCompose } from "@/lib/email/objet-email";
import type { EmailSuiviV1 } from "../schemas/autres";
import { neutraliserDonnees } from "../verification/regles";
import { contientUneAdresse, contientUnPrix, nombresAbsentsDesSources } from "./gardes-texte";

/** Les types de faits qui peuvent nourrir l'e-mail (jamais un budget, une objection, un prix). */
export const TYPES_POUR_EMAIL: ReadonlySet<FaitType> = new Set([
  "besoin",
  "objectif",
  "probleme",
  "nb_participants",
  "public_cible",
  "modalite_souhaitee",
  "echeance",
  "offre_envisagee",
  "engagement_axion",
  "engagement_client",
  "prochaine_etape",
  "question_client_repondue",
]);

/**
 * La longueur de l'objet n'est PAS une règle propre au circuit : c'est celle de
 * tous les e-mails du site (`OBJET_MAX` et `objetCompose` de
 * `lib/email/objet-email.ts`, référentiel §3.4, 45 caractères). Une seconde
 * borne ici la contredisait.
 */
export const PARAGRAPHES_MAX = 4;

export interface FaitPourEmail {
  readonly id: string;
  readonly type: FaitType;
  /** Énoncé DÉCHIFFRÉ d'un fait VALIDÉ. */
  readonly enonce: string;
}

export interface EmailRedige {
  readonly objet: string;
  readonly paragraphes: ReadonlyArray<string>;
}

/** Ne garde que les faits utilisables, avec leur référence `F…`. */
export function faitsPourEmail(
  faits: ReadonlyArray<FaitPourEmail & { readonly statut: string }>,
): Array<FaitPourEmail & { readonly ref: string }> {
  return faits
    .filter((f) => f.statut === "valide" && TYPES_POUR_EMAIL.has(f.type) && f.enonce.trim() !== "")
    .map((f, i) => ({
      id: f.id,
      type: f.type,
      enonce: f.enonce,
      ref: `F${String(i + 1).padStart(2, "0")}`,
    }));
}

/** G17 (règle commune `neutraliserDonnees`). */
function neutraliser(t: string): string {
  return neutraliserDonnees(t).replace(/\s+/g, " ").trim();
}

export function construireEntreeEmail(e: {
  readonly rencontre: { readonly titre: string; readonly date: Date | null };
  readonly faits: ReadonlyArray<FaitPourEmail & { readonly ref: string }>;
}): string {
  const date = e.rencontre.date
    ? e.rencontre.date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
    : "date inconnue";
  return [
    `<rendez_vous>${neutraliser(e.rencontre.titre)} — ${date}</rendez_vous>`,
    "<faits_valides>",
    ...e.faits.map((f) => `${f.ref} | ${f.type} | ${neutraliser(f.enonce)}`),
    "</faits_valides>",
  ].join("\n");
}

export type VerdictEmail =
  | { readonly ok: true; readonly email: EmailRedige }
  | {
      readonly ok: false;
      readonly motif:
        | "objet_vide"
        | "objet_trop_long"
        | "sans_paragraphe"
        | "trop_de_paragraphes"
        | "paragraphe_sans_fait"
        | "fait_inconnu"
        | "prix"
        | "adresse"
        | "nombre_absent_des_faits";
    };

/** Vérifie le brouillon rédigé par l'IA. Un brouillon fautif est refusé en entier. */
export function verifierEmail(
  sortie: EmailSuiviV1,
  faits: ReadonlyArray<FaitPourEmail & { readonly ref: string }>,
): VerdictEmail {
  const objet = sortie.objet.trim();
  if (objet === "") return { ok: false, motif: "objet_vide" };
  if (objet.length > OBJET_MAX) return { ok: false, motif: "objet_trop_long" };
  const paras = sortie.paragraphes.filter((p) => p.texte.trim() !== "");
  if (paras.length === 0) return { ok: false, motif: "sans_paragraphe" };
  if (paras.length > PARAGRAPHES_MAX) return { ok: false, motif: "trop_de_paragraphes" };
  const refs = new Set(faits.map((f) => f.ref));
  for (const p of paras) {
    if (p.faits_refs.length === 0) return { ok: false, motif: "paragraphe_sans_fait" };
    if (p.faits_refs.some((r) => !refs.has(r.trim()))) return { ok: false, motif: "fait_inconnu" };
  }
  const tout = [objet, ...paras.map((p) => p.texte), sortie.formule_de_fin].join("\n");
  if (contientUnPrix(tout)) return { ok: false, motif: "prix" };
  if (contientUneAdresse(tout)) return { ok: false, motif: "adresse" };
  if (
    nombresAbsentsDesSources(
      tout,
      faits.map((f) => f.enonce),
    ).length > 0
  ) {
    return { ok: false, motif: "nombre_absent_des_faits" };
  }
  return { ok: true, email: { objet, paragraphes: paras.map((p) => p.texte.trim()) } };
}

const ENGAGEMENTS: ReadonlySet<FaitType> = new Set(["engagement_axion", "engagement_client"]);

/**
 * Le GABARIT FIXE, quand la passe échoue (ou sur demande de Will) : trois
 * blocs construits par le code depuis les faits validés, sans IA.
 */
export function gabaritFixeEmail(
  tousLesFaits: ReadonlyArray<FaitPourEmail>,
  rencontre: { readonly titre: string },
): EmailRedige {
  // G14 et G15 valent aussi sans IA : un énoncé qui porte un prix ou une
  // adresse n'entre pas dans le texte.
  const faits = tousLesFaits.filter(
    (f) => !contientUnPrix(f.enonce) && !contientUneAdresse(f.enonce),
  );
  const enBref = faits.filter((f) => !ENGAGEMENTS.has(f.type) && f.type !== "prochaine_etape");
  const engagements = faits.filter((f) => ENGAGEMENTS.has(f.type));
  const suite = faits.filter((f) => f.type === "prochaine_etape");
  const liste = (fs: ReadonlyArray<FaitPourEmail>): string =>
    fs.map((f) => `- ${f.enonce.trim()}`).join("\n");
  const paragraphes = [
    "Merci pour notre échange. Voici ce que j'en retiens, pour que nous partions sur la même base.",
    ...(enBref.length > 0 ? [`En bref :\n${liste(enBref)}`] : []),
    ...(engagements.length > 0 ? [`Ce que nous avons convenu :\n${liste(engagements)}`] : []),
    ...(suite.length > 0 ? [`Prochaine étape :\n${liste(suite)}`] : []),
    "N'hésitez pas à me corriger si j'ai mal compris un point.",
  ];
  return {
    objet: objetCompose("Suite à notre échange :", rencontre.titre),
    paragraphes,
  };
}

/** Le participant choisi est-il un participant CLIENT validé de la rencontre ? */
export function destinataireValide(
  contactId: string,
  participants: ReadonlyArray<{
    readonly contactId: string | null;
    readonly role: string;
    readonly contactActif: boolean;
  }>,
): boolean {
  return participants.some(
    (p) => p.contactId === contactId && p.role === "client" && p.contactActif,
  );
}

/** L'adresse d'envoi : professionnelle de préférence, jamais une adresse écrite par l'IA. */
export function adresseDEnvoi(
  adresses: ReadonlyArray<{ readonly email: string; readonly nature: "pro" | "perso" }>,
): string | null {
  return (adresses.find((a) => a.nature === "pro") ?? adresses[0])?.email ?? null;
}
