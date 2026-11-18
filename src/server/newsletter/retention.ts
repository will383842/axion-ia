/**
 * DURÉES DE CONSERVATION DE LA LETTRE ET DU GUIDE — CODE DE PURGE RETIRÉ (2026-11-14).
 *
 * 🛑 Règle du fondateur : AUCUNE donnée de personne n'est supprimée automatiquement. Les
 * fonctions `purgerLettreEtGuide` et `purgerDesinscrits` (abonnés, demandes du guide, preuves de
 * consentement) n'avaient plus aucun appelant depuis le 2026-10-07 ; leur CODE est supprimé, pour
 * qu'aucune session ne puisse les rebrancher « par mégarde ». Un test statique
 * (`__tests__/retention.spec.ts`) refuse tout `delete` / `deleteMany` sur `newsletterSubscriber`,
 * `guideRequest` ou `consentEvent` dans ce fichier.
 *
 * Reste ici : les constantes de durée (référence), et `purgerOutboxCrm` (file CRM déjà acquittée,
 * charges techniques, aucune fiche de personne).
 */
import { prisma } from "@/lib/prisma";
import { CONSENT_FORM_REFS } from "@/lib/consents";
import { FORM_REF_LETTRE, FORM_REF_REINSCRIPTION } from "@/content/guide-ia-formulaire";

export const DUREES_LETTRE_GUIDE = {
  /** `pending` jamais confirmé — « inscription jamais confirmée (ancien parcours), 30 jours ». */
  pendingJours: 30,
  /** Abonné confirmé — « 3 ans après votre inscription, votre dernière demande du guide ou votre dernier clic dans une lettre ». */
  abonneInactifMois: 36,
  /** Demande du guide — « 3 ans après votre dernière demande ou votre dernier clic sur le bouton de téléchargement ». */
  demandeGuideMois: 36,
  /** Adresse en échec de distribution définitif — « 3 ans, pour ne plus y écrire ». */
  rebondMois: 36,
  /** Preuve de l'information ou du consentement — « 5 ans après la fin de votre inscription ». */
  preuveMois: 60,
} as const;

export interface DureesLettreGuide {
  readonly pendingJours: number;
  readonly abonneInactifMois: number;
  readonly demandeGuideMois: number;
  readonly rebondMois: number;
  readonly preuveMois: number;
}

export interface ResultatPurgeLettreGuide {
  readonly pendingPurges: number;
  readonly abonnesInactifsPurges: number;
  /** Abonnés au-delà du seuil, gardés parce qu'une demande ou un clic du guide récent les rattache. */
  readonly abonnesGardesParDemandeRecente: number;
  readonly rebondsPurges: number;
  readonly demandesGuidePurgees: number;
  readonly journauxEnvoiPurges: number;
  /** Lignes de preuve (lettre et guide) supprimées à 5 ans après la fin. */
  readonly preuvesPurgees: number;
  /** Agents navigateur en clair hachés (lignes mises à jour, aucune supprimée). */
  readonly agentsHaches: number;
}

/** Gabarits dont le journal suit la durée de la lettre et du guide, pas celle des pièces. */
export const GABARITS_LETTRE_GUIDE = ["guide-ia-envoi", "newsletter-confirm-optin"] as const;

/**
 * Références du registre de preuve propres à la lettre et au guide — les
 * SEULES que la règle 6 peut supprimer. Mêmes sources que `FORM_REFS_LETTRE`
 * de la console (`newsletter/console`), recomposées ici sans tirer ce module-là.
 */
export const FORM_REFS_PREUVE_LETTRE_GUIDE: ReadonlyArray<string> = [
  CONSENT_FORM_REFS.newsletter,
  ...Object.values(FORM_REF_LETTRE),
  FORM_REF_REINSCRIPTION,
];

/** Source des empreintes gardées sans limite après une désinscription (`email_oppositions.source`). */
export const SOURCE_OPPOSITION_DESINSCRIT = "lettre-desinscription-3-ans";

function joursAvant(maintenant: Date, jours: number): Date {
  return new Date(maintenant.getTime() - jours * 86_400_000);
}

/** Lit une durée d'environnement ; toute valeur < 1 retombe sur le défaut (anti-misconfig). */
export function lireDuree(nom: string, defaut: number): number {
  const brut = process.env[nom];
  if (!brut) return defaut;
  const n = parseInt(brut, 10);
  return Number.isFinite(n) && n >= 1 ? n : defaut;
}

export function dureesDepuisEnvironnement(): DureesLettreGuide {
  return {
    pendingJours: lireDuree("RETENTION_NEWSLETTER_PENDING_DAYS", DUREES_LETTRE_GUIDE.pendingJours),
    abonneInactifMois: lireDuree(
      "RETENTION_NEWSLETTER_INACTIVE_MONTHS",
      DUREES_LETTRE_GUIDE.abonneInactifMois,
    ),
    demandeGuideMois: lireDuree(
      "RETENTION_GUIDE_REQUESTS_MONTHS",
      DUREES_LETTRE_GUIDE.demandeGuideMois,
    ),
    rebondMois: lireDuree("RETENTION_NEWSLETTER_BOUNCED_MONTHS", DUREES_LETTRE_GUIDE.rebondMois),
    preuveMois: lireDuree("RETENTION_LETTRE_PREUVES_MONTHS", DUREES_LETTRE_GUIDE.preuveMois),
  };
}

/**
 * `crm_sync_outbox` : la charge porte les données de la personne EN CLAIR
 * (déchiffrées à la construction). Une ligne `sent` est acquittée par le CRM :
 * la garder ne sert qu'à la console de santé, 30 jours suffisent. Les lignes
 * `pending`, `failed` et `gave_up` ne sont JAMAIS purgées par l'âge : ce sont
 * des envois non aboutis, qu'un humain doit voir (même doctrine que la
 * corbeille `a_valider` d'`email_outbox`).
 */
export const OUTBOX_CRM_ENVOYEE_JOURS = 30;

export async function purgerOutboxCrm(
  maintenant: Date = new Date(),
  jours: number = lireDuree("RETENTION_CRM_OUTBOX_SENT_DAYS", OUTBOX_CRM_ENVOYEE_JOURS),
): Promise<number> {
  const limite = joursAvant(maintenant, jours);
  const r = await prisma.crmSyncOutbox.deleteMany({
    where: {
      status: "sent",
      OR: [{ sentAt: { lt: limite } }, { sentAt: null, createdAt: { lt: limite } }],
    },
  });
  return r.count;
}
