// INVITATION À L'ÉCHANGE DE 15 MINUTES — la logique, partagée par les deux
// portes de la console (2026-09-19) :
//   · le bouton « Envoyer l'invitation » de la fiche (Contacts › Commercial) ;
//   · la case « Envoyer l'invitation » de la saisie manuelle d'un contact.
//
// ── Geste manuel, ET depuis le 2026-09-28 passage automatique ─────────────
// Décision de Will du 19/09 : le lien de réservation partait à la main, à qui
// il choisissait. Décision du 28/09 : TOUTE candidature d'apporteur, et toute
// candidature à une offre d'emploi commerciale, reçoit cette invitation
// 15 minutes après sa réception — troisième porte, le passage du worker
// (`invitation-auto.ts`, `adminId: null`). La saisie manuelle reste manuelle.
// Resserré le 29/09 : côté site, seul le DOSSIER COMPLET est invité
// automatiquement ; le premier contact et l'écran 1 restent au bouton.
//
// ── Ce que l'envoi fait, dans l'ordre ─────────────────────────────────────
//   1. vérifie le lien (https, calendly.com) — une faute de frappe ne part pas ;
//   2. vérifie que la fiche est bien un contact apporteur, non effacé ;
//   3. (2026-09-19) pour une saisie manuelle, vérifie l'ORIGINE de l'adresse :
//      relevée sur l'annonce d'un tiers → jamais ; venue d'ailleurs
//      (recommandation, autre) → seulement si la personne a accepté d'être
//      contactée (L.34-5 CPCE), et le message porte l'information de l'art. 14 ;
//   4. (2026-09-19) refuse une SECONDE invitation à la même personne — toutes
//      ses lignes, par empreinte d'adresse, envois partis ou en validation —
//      sauf « Renvoyer quand même » ;
//   5. met en file `apporteur-invitation-appel` : l'invitation, le kit, et le
//      lien du dossier SI la personne ne l'a pas encore envoyé ;
//   6. retire les rappels « ton dossier t'attend » encore en attente — la
//      personne vient de recevoir l'invitation, qui porte déjà ce lien ;
//   7. journalise le geste (qui, quand, sur quelle fiche).
//
// 🔴 `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Une adresse
// retenue (désinscrite, rebond dur) n'est PAS une réussite — l'écran doit dire
// que rien n'est parti, jamais « envoyé ».
//
// Ce module n'est PAS `"use server"` : c'est de la logique serveur appelée par
// deux actions, pas une action exposée au navigateur.

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { SITE_URL } from "@/lib/site-url";
import { enqueueEmail } from "@/server/queue/queues";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { estLienCalendlyValide } from "@/lib/commercial-application/kit-apporteur";
import {
  ORIGINE_INTERDITE,
  ORIGINES_ACCORD_REQUIS,
  ORIGINES_DIRECTES,
  PROVENANCE_ADRESSE,
} from "@/lib/commercial-application/saisie-manuelle";
import { ORIGINE_SAISIE_MANUELLE } from "@/lib/contact/accuse-attendu";
import { marqueDemarche, varianteObjet } from "@/lib/commercial-application/demarche-invitation";
import { annulerRelancesLeadApporteur } from "./relances-lead-apporteur";
import { lireVsl } from "./lead-vsl-details";
import {
  phraseInvitation,
  type CodeIssueInvitation,
} from "@/lib/commercial-application/issues-invitation";
import {
  GABARIT_RELANCE_INVITATION,
  type SuiviInvitation,
} from "@/lib/commercial-application/relance-invitation";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import {
  decisionAffichee,
  type EchangeAvecPoint,
} from "@/features/admin-rendezvous/issue-apporteur";

/** Nom du gabarit — aussi la clé de lecture de l'historique (`EmailLog.template`). */
export const GABARIT_INVITATION_APPORTEUR = "apporteur-invitation-appel";

export type ResultatInvitation =
  | { ok: true; enValidation?: true; message?: string }
  | {
      ok: false;
      /**
       * 🔑 DERIVE DES CODES QUI ONT UNE PHRASE, et pas l'inverse. Une liste
       * tapee a la main ici laissait ajouter un code que `phraseInvitation` ne
       * connait pas : l'ecran affichait alors du vide, et le vide ne se voit
       * pas en relecture. Les quatre codes retires sont ceux qui ne naissent
       * jamais de cette fonction (deux succes, et deux refus poses par
       * l'appelant avant meme de l'atteindre).
       */
      erreur: Exclude<
        CodeIssueInvitation,
        "envoyee" | "en-validation" | "une-seule-personne" | "non-autorise"
      >;
      message: string;
    };

interface DetailsContact {
  unifiedType?: unknown;
  subType?: unknown;
  etape?: unknown;
  origine?: unknown;
  origineSaisie?: unknown;
  accordContactAt?: unknown;
}

function lireDetails(v: unknown): DetailsContact {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as DetailsContact) : {};
}

/** Ce que l'invitation dit à la personne de l'origine de son adresse (art. 14). */
export interface Provenance {
  mode: "directe" | "indirecte";
  /** Fragment dans la langue de l'e-mail : « par e-mail », « par une personne qui vous recommande »… */
  libelle: string;
}

/**
 * Les lignes NON effacées de cette personne, par empreinte d'adresse — un
 * premier contact Facebook, puis un dossier, puis une saisie manuelle font
 * trois lignes pour une seule personne. Sans empreinte (ligne très ancienne),
 * la fiche seule.
 */
async function lignesDeLaPersonne(
  submissionId: string,
  contactEmailHash: string | null,
): Promise<Array<{ id: string; details: unknown }>> {
  if (!contactEmailHash) return [{ id: submissionId, details: null }];
  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash, deletedAt: null },
    select: { id: true, details: true },
    take: 20,
  });
  return lignes.some((l) => l.id === submissionId)
    ? lignes
    : [{ id: submissionId, details: null }, ...lignes];
}

/**
 * Le dossier complet est-il déjà arrivé pour cette personne ?
 *
 * Un premier contact, une capture d'écran 1 ou une saisie manuelle portent
 * `details.etape` ; le dossier complet n'en porte pas. On regarde TOUTES les
 * lignes de la personne, pas seulement la fiche ouverte.
 */
export function dossierDejaArrive(lignes: Array<{ details: unknown }>): boolean {
  return lignes.some((l) => {
    const d = lireDetails(l.details);
    return estApporteur(d) && d.etape === undefined;
  });
}

/** Marque des fiches créées à la réservation d'un échange apporteur (PR #1346). */
const ORIGINE_FICHE_RENDEZ_VOUS = "rendez-vous-apporteur";

/**
 * La personne vient-elle du tunnel vidéo, ou d'une réservation d'échange ?
 *
 * 🔴 2026-10-07 (test réel de Will) : l'invitation de ces personnes disait « Il
 * nous manque encore votre dossier » avec un lien vers l'ANCIEN formulaire de
 * candidature (`/devenir-commercial-ia/candidature`). Ce formulaire n'est pas leur
 * parcours : elles ont donné leur prénom, leur e-mail et leur numéro sur la page
 * vidéo, ou réservé directement. Aucune phrase ni aucun lien vers lui.
 */
export function sansFormulaireDeCandidature(lignes: Array<{ details: unknown }>): boolean {
  return lignes.some((l) => {
    if (lireVsl(l.details)) return true;
    const d = l.details;
    return (
      !!d &&
      typeof d === "object" &&
      (d as Record<string, unknown>)["origine"] === ORIGINE_FICHE_RENDEZ_VOUS
    );
  });
}

export interface InvitationEnvoyee {
  le: Date;
  /** `sent` / `pending` (journal des envois) ou `a_valider` (corbeille de validation). */
  statut: string;
}

/**
 * Les invitations DÉJÀ PARTIES ou EN ATTENTE DE VALIDATION pour un ensemble de
 * lignes — les deux sources :
 *   · le journal des envois (`pending` = en file, `sent` = parti) ;
 *   · la corbeille « Envois à valider » (`a_valider`) : une invitation garée
 *     n'a pas de ligne de journal, et sans elle un second clic en garerait une
 *     seconde.
 * Les envois annulés, en échec ou rebondis ne comptent pas : ils ne sont pas
 * arrivés. Lève si la base ne répond pas — à l'appelant de choisir.
 */
async function invitationsDesLignes(ids: string[]): Promise<InvitationEnvoyee[]> {
  const [journal, enValidation] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        template: GABARIT_INVITATION_APPORTEUR,
        entityType: "Submission",
        entityId: { in: ids },
        status: { in: ["pending", "sent"] },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.emailOutbox.findMany({
      where: {
        template: GABARIT_INVITATION_APPORTEUR,
        entityType: "Submission",
        entityId: { in: ids },
        statut: "a_valider",
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  return [
    ...journal.map((l) => ({ le: l.createdAt, statut: String(l.status) })),
    ...enValidation.map((l) => ({ le: l.createdAt, statut: "a_valider" })),
  ].sort((a, b) => b.le.getTime() - a.le.getTime());
}

// `varianteObjet` et `marqueDemarche` vivent dans un module PUR (les rappels,
// qui tournent dans le worker, les lisent aussi) ; ré-exportés ici pour les
// lecteurs existants.
export { varianteObjet, marqueDemarche };

/** « 12/09 », heure de Paris — le jour dit à l'administrateur. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export async function envoyerInvitationApporteur(input: {
  submissionId: string;
  calendlyUrl: string;
  /** `null` : envoi du passage automatique (worker), sans administrateur. */
  adminId: string | null;
  /** « Renvoyer quand même » : passe outre une invitation déjà partie ou en validation. */
  renvoyer?: boolean;
  /** « La personne a accepté d'être contactée », coché sur la fiche (recommandation, autre). */
  accordContact?: boolean;
}): Promise<ResultatInvitation> {
  const calendlyUrl = input.calendlyUrl.trim();
  if (!estLienCalendlyValide(calendlyUrl)) {
    return {
      ok: false,
      erreur: "lien-invalide",
      message: phraseInvitation("lien-invalide").texte,
    };
  }

  const ligne = await prisma.submission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      locale: true,
      contactName: true,
      contactEmail: true,
      contactEmailHash: true,
      details: true,
      deletedAt: true,
    },
  });
  if (!ligne || ligne.deletedAt) {
    return { ok: false, erreur: "introuvable", message: phraseInvitation("introuvable").texte };
  }
  // Même prédicat que la liste « Apporteurs » : on n'invite que ceux qui y
  // figurent (2026-09-19, prédicat unique).
  //
  // `details` sert plus bas (origine de la saisie, accord, provenance art. 14) :
  // il est lu ICI, une fois. Perdre cette ligne fait échouer la provenance
  // trente lignes plus loin, sans erreur de compilation — mesuré au pré-push.
  const details = lireDetails(ligne.details);
  if (!estApporteur(ligne.details)) {
    return {
      ok: false,
      erreur: "pas-un-apporteur",
      message: phraseInvitation("pas-un-apporteur").texte,
    };
  }

  let email: string | null = null;
  let nom: string | null = null;
  try {
    email = decryptPii(ligne.contactEmail);
    nom = decryptPii(ligne.contactName);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerInvitationApporteur", step: "pii" } });
  }
  // Une fiche effacée (art. 17) porte une adresse synthétique : lui écrire
  // ferait rebondir un message au nom d'une personne qui a demandé l'oubli.
  if (!email || nom === ERASED_PLACEHOLDER || email.endsWith("@erased.local")) {
    return {
      ok: false,
      erreur: "efface",
      message: phraseInvitation("efface").texte,
    };
  }

  const locale = ligne.locale === "en" ? "en" : "fr";

  // ── ORIGINE DE L'ADRESSE (art. 14 RGPD, L.34-5 CPCE), 2026-09-19 ─────────
  // Seule une SAISIE MANUELLE porte une origine déclarée : une personne venue
  // d'un formulaire du site a donné son adresse elle-même, et son invitation
  // garde le texte d'origine (aucune provenance dans le payload).
  let provenance: Provenance | undefined;
  let accordAEcrire = false;
  if (details.origine === ORIGINE_SAISIE_MANUELLE) {
    const origine = typeof details.origineSaisie === "string" ? details.origineSaisie : "";
    if (origine === ORIGINE_INTERDITE) {
      return {
        ok: false,
        erreur: "origine-interdite",
        message: phraseInvitation("origine-interdite").texte,
      };
    }
    const fragment = PROVENANCE_ADRESSE[origine];
    if (ORIGINES_ACCORD_REQUIS.includes(origine)) {
      const accordEnregistre = typeof details.accordContactAt === "string";
      if (!accordEnregistre && input.accordContact !== true) {
        return {
          ok: false,
          erreur: "accord-manquant",
          message: phraseInvitation("accord-manquant").texte,
        };
      }
      accordAEcrire = !accordEnregistre;
      if (fragment) provenance = { mode: "indirecte", libelle: fragment[locale] };
    } else if (ORIGINES_DIRECTES.includes(origine) && fragment) {
      provenance = { mode: "directe", libelle: fragment[locale] };
    }
  }

  // ── JAMAIS DEUX INVITATIONS, 2026-09-19 ──────────────────────────────────
  // Lue par PERSONNE, pas par ligne : la même personne a souvent deux ou trois
  // lignes, et l'historique d'une seule fiche laissait inviter deux fois.
  // Base muette : on ne peut pas savoir, donc rien ne part — une invitation en
  // double est pire qu'un nouvel essai dans une minute.
  let lignes: Array<{ id: string; details: unknown }>;
  try {
    lignes = await lignesDeLaPersonne(ligne.id, ligne.contactEmailHash);
    if (input.renvoyer !== true) {
      const deja = await invitationsDesLignes(lignes.map((l) => l.id));
      const derniere = deja[0];
      if (derniere) {
        return {
          ok: false,
          erreur: "deja-invitee",
          message: phraseInvitation("deja-invitee", { le: jourMois(derniere.le) }).texte,
        };
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "historique" },
    });
    return {
      ok: false,
      // 🔑 Ici on ne sait PAS LIRE l'historique — ce n'est pas la file d'envoi
      // qui est en panne. Les deux partageaient un code et se contredisaient.
      erreur: "historique-illisible",
      message: phraseInvitation("historique-illisible").texte,
    };
  }

  // L'accord attesté sur la fiche est daté AVANT l'envoi : c'est lui qui
  // autorise l'invitation, il doit exister au moment où elle part.
  if (accordAEcrire) {
    await prisma.submission.update({
      where: { id: ligne.id },
      data: {
        details: { ...(ligne.details as object), accordContactAt: new Date().toISOString() },
      },
    });
  }

  const dossierUrl =
    dossierDejaArrive(lignes) || sansFormulaireDeCandidature(lignes)
      ? undefined
      : `${SITE_URL}/${locale}${DOSSIER_COMPLET_PATH}`;

  const envoi = await enqueueEmail(
    GABARIT_INVITATION_APPORTEUR,
    email,
    locale,
    {
      contactName: nom ?? "",
      calendlyUrl,
      ...(dossierUrl ? { dossierUrl } : {}),
      ...(provenance ? { provenance } : {}),
      // 2026-09-27 (Will) : toute fiche qui n'est pas une saisie manuelle est
      // une CANDIDATURE (formulaire du site, annonce Indeed importée) — l'objet
      // le dit, avec un objet parmi quatre, stable par fiche. 2026-09-28 : une
      // fiche née d'une candidature à une offre d'emploi porte `offre` à la
      // place — cf. `marqueDemarche`.
      ...marqueDemarche(ligne.details, ligne.id),
    },
    { entityType: "Submission", entityId: ligne.id },
  );

  // Garée dans « Envois à valider » (règle d'automatisation) : rien n'est
  // parti, mais rien n'est perdu non plus — ce n'est ni une réussite d'envoi ni
  // une panne. Dit tel quel, et journalisé.
  if (envoi.garePourValidation) {
    await journaliser(input.adminId, ligne, dossierUrl !== undefined, true);
    return {
      ok: true,
      enValidation: true,
      message: phraseInvitation("en-validation").texte,
    };
  }

  if (!envoi.enqueued) {
    return envoi.retenu
      ? {
          ok: false,
          erreur: "retenu",
          message: phraseInvitation("retenu").texte,
        }
      : {
          ok: false,
          erreur: "file-indisponible",
          message: phraseInvitation("file-indisponible").texte,
        };
  }

  // Les rappels « ton dossier t'attend » deviennent redondants : l'invitation
  // porte déjà le lien du dossier. Best-effort — l'invitation est partie.
  try {
    await annulerRelancesLeadApporteur(
      email,
      "Envoi annulé : une invitation à l'échange a été envoyée depuis la console.",
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "annuler-relances" },
    });
  }

  // 🔴 2026-09-28 (Will) — « on les a contactés, et la console ne se met pas à
  // jour ». L'invitation ne touchait ni le statut ni `replyCount` : les 58
  // invités du 27/09 restaient comptés « à traiter » (58 des 68 du badge).
  // La balle est désormais dans le camp du candidat : la fiche est RANGÉE,
  // exactement le geste « Traité » de la console (`transitions.ts`) — elle
  // reste vivante et les rappels J+3/J+7 continuent. Une réponse humaine
  // reçue dans Zoho la rouvre (`reponses-entrantes-apporteur.ts`).
  // Best-effort : l'invitation est partie, un statut non rangé n'est que du bruit.
  try {
    await prisma.submission.updateMany({
      where: { id: ligne.id, status: { in: ["new", "in_progress"] }, archivedAt: null },
      data: { status: "processed", needsAttention: false },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "ranger-la-fiche" },
    });
  }

  await journaliser(input.adminId, ligne, dossierUrl !== undefined, false);
  return { ok: true };
}

/** Journal du geste : qui, quand, sur quelle fiche. L'adresse n'y est pas recopiée. */
async function journaliser(
  adminId: string | null,
  ligne: { id: string; contactEmailHash: string | null },
  lienDossier: boolean,
  enValidation: boolean,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: adminId,
        action: "submission.invitation_apporteur",
        targetType: "submission",
        targetId: ligne.id,
        // L'empreinte suffit à retrouver la personne.
        changes: {
          gabarit: GABARIT_INVITATION_APPORTEUR,
          contactEmailHash: ligne.contactEmailHash,
          lienDossier,
          ...(enValidation ? { enValidation: true } : {}),
        },
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "journal" },
    });
  }
}

/**
 * L'historique des invitations de CETTE PERSONNE — toutes ses lignes, par
 * empreinte d'adresse — lu dans le journal des envois (la seule source qui
 * dit si un e-mail est PARTI) et dans la corbeille de validation. Ne lève
 * jamais : une fiche doit s'afficher même si le journal ne répond pas.
 */
export async function lireInvitationsDeLaPersonne(
  submissionId: string,
): Promise<InvitationEnvoyee[]> {
  try {
    const ligne = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { contactEmailHash: true },
    });
    const lignes = await lignesDeLaPersonne(submissionId, ligne?.contactEmailHash ?? null);
    return await invitationsDesLignes(lignes.map((l) => l.id));
  } catch (err) {
    Sentry.captureException(err, { tags: { lecture: "invitations-apporteur" } });
    return [];
  }
}

/**
 * Pour la LISTE des apporteurs : où en est chaque personne affichée depuis son
 * invitation, clé = l'identifiant de la ligne de la liste.
 *
 * 2026-09-27 (Will) : « que l'on sache dans la console qu'ils ont bien été
 * contactés » — d'abord la date de l'invitation ; puis, avec les rappels
 * automatiques, les rappels partis et l'échange réservé ou annulé ; puis la
 * réponse de la personne reçue par e-mail (relevé Zoho, 2026-09-27). Le badge
 * lui-même est choisi par `badgeSuiviInvitation` (règle pure, testée).
 *
 * Lue par EMPREINTE d'adresse, comme `lireInvitationsDeLaPersonne` : la liste
 * montre la ligne la plus récente de la personne, l'invitation a pu partir d'une
 * autre de ses lignes, et l'échange est rattaché à une troisième. Cinq requêtes
 * pour toute la page, pas une par ligne. Une invitation garée en validation n'y
 * figure pas : elle n'est pas partie.
 */
export async function lireSuiviInvitationListe(
  ids: readonly string[],
): Promise<Map<string, SuiviInvitation>> {
  const resultat = new Map<string, SuiviInvitation>();
  if (ids.length === 0) return resultat;
  const affichees = await prisma.submission.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, contactEmailHash: true },
  });
  const empreintes = [
    ...new Set(affichees.map((l) => l.contactEmailHash).filter((h): h is string => !!h)),
  ];
  const lignesPersonnes = empreintes.length
    ? await prisma.submission.findMany({
        where: { contactEmailHash: { in: empreintes } },
        select: { id: true, contactEmailHash: true },
      })
    : [];
  // Ligne quelconque → clé de la personne (l'empreinte, ou la ligne seule sans empreinte).
  const personneDe = new Map<string, string>();
  for (const l of affichees) personneDe.set(l.id, l.contactEmailHash ?? `id:${l.id}`);
  for (const l of lignesPersonnes) personneDe.set(l.id, l.contactEmailHash ?? `id:${l.id}`);
  const toutes = [...personneDe.keys()];

  const [journal, evenements, entrantes] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        template: { in: [GABARIT_INVITATION_APPORTEUR, GABARIT_RELANCE_INVITATION] },
        entityType: "Submission",
        entityId: { in: toutes },
        status: { in: ["pending", "sent"] },
      },
      select: { template: true, entityId: true, createdAt: true },
    }),
    prisma.calendlyEvent.findMany({
      where: { linkedSubmissionId: { in: toutes } },
      select: {
        linkedSubmissionId: true,
        eventTypeName: true,
        status: true,
        startTime: true,
        // 2026-09-28 — l'issue de l'échange (badge Retenu / Non retenu…).
        suivi: { select: { issue: true, decision: true, renseigneLe: true } },
      },
    }),
    // 2026-09-27 — les réponses HUMAINES de la personne, relevées dans la boîte
    // Zoho. Accessoires : si elles ne se lisent pas (table pas encore migrée,
    // base lente), la liste garde les autres badges plutôt que de tout perdre.
    prisma.submissionInboundReply
      .findMany({
        where: { submissionId: { in: toutes }, auto: false },
        select: { submissionId: true, receivedAt: true },
      })
      .catch((err: unknown) => {
        Sentry.captureException(err, { tags: { lecture: "reponses-entrantes-liste" } });
        return [] as Array<{ submissionId: string; receivedAt: Date }>;
      }),
  ]);

  const invitationPar = new Map<string, Date>();
  for (const e of journal) {
    if (e.template !== GABARIT_INVITATION_APPORTEUR) continue;
    const p = e.entityId ? personneDe.get(e.entityId) : undefined;
    if (!p) continue;
    const avant = invitationPar.get(p);
    if (!avant || e.createdAt > avant) invitationPar.set(p, e.createdAt);
  }
  const relancesPar = new Map<string, Date[]>();
  for (const e of journal) {
    if (e.template !== GABARIT_RELANCE_INVITATION) continue;
    const p = e.entityId ? personneDe.get(e.entityId) : undefined;
    const invitation = p ? invitationPar.get(p) : undefined;
    // Un rappel ne compte que pour l'invitation qu'il suit.
    if (!p || !invitation || e.createdAt <= invitation) continue;
    relancesPar.set(p, [...(relancesPar.get(p) ?? []), e.createdAt]);
  }
  const echangePar = new Map<string, "reserve" | "annule">();
  const echangesPar = new Map<string, EchangeAvecPoint[]>();
  const echangeLePar = new Map<string, Date>();
  for (const ev of evenements) {
    if (!estAppelApporteur(ev.eventTypeName)) continue;
    const p = ev.linkedSubmissionId ? personneDe.get(ev.linkedSubmissionId) : undefined;
    if (!p) continue;
    echangesPar.set(p, [
      ...(echangesPar.get(p) ?? []),
      { debut: ev.startTime, annule: ev.status === "canceled", point: ev.suivi ?? null },
    ]);
    // Un échange non annulé l'emporte sur un échange annulé (reprise d'un créneau).
    if (ev.status !== "canceled") {
      echangePar.set(p, "reserve");
      // 2026-10-07 — le DERNIER échange non annulé dit « réservé » ou « fait ».
      const avant = echangeLePar.get(p);
      if (ev.startTime && (!avant || ev.startTime > avant)) echangeLePar.set(p, ev.startTime);
    } else if (!echangePar.has(p)) echangePar.set(p, "annule");
  }

  const reponsePar = new Map<string, Date>();
  for (const r of entrantes) {
    const p = personneDe.get(r.submissionId);
    const invitation = p ? invitationPar.get(p) : undefined;
    // Une réponse ne compte que si elle suit l'invitation qu'on affiche.
    if (!p || !invitation || r.receivedAt <= invitation) continue;
    const avant = reponsePar.get(p);
    if (!avant || r.receivedAt > avant) reponsePar.set(p, r.receivedAt);
  }

  for (const l of affichees) {
    const p = personneDe.get(l.id)!;
    const invitation = invitationPar.get(p) ?? null;
    const echange = echangePar.get(p) ?? null;
    if (!invitation && !echange) continue;
    const decision = decisionAffichee(echangesPar.get(p) ?? []);
    resultat.set(l.id, {
      invitation,
      relances: (relancesPar.get(p) ?? []).sort((a, b) => a.getTime() - b.getTime()),
      echange,
      ...(echangeLePar.has(p) ? { echangeLe: echangeLePar.get(p)! } : {}),
      reponse: reponsePar.get(p) ?? null,
      ...(decision ? { decision } : {}),
    });
  }
  return resultat;
}
