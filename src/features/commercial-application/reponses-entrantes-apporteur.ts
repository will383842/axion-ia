// RÉPONSES ENTRANTES DES CANDIDATS APPORTEURS — le relevé (2026-09-27).
//
// Décision de Will du 2026-09-27 : quand une personne invitée à l'échange
// répond par e-mail à son invitation — sa réponse arrive dans la boîte Zoho
// Mail contact@axion-ia.com —, la console doit le savoir : la fiche et la liste
// affichent « A répondu le JJ/MM », et ses rappels J+3 / J+7 s'arrêtent.
//
// ── Ce que fait un passage (toutes les 15 minutes, file `apporteur-crons`) ─
//   1. lit la boîte de réception depuis le dernier curseur, moins un
//      CHEVAUCHEMENT de deux heures (un message remis en retard, un passage
//      interrompu) — l'idempotence par identifiant Zoho rend le recouvrement
//      gratuit ;
//   2. garde les messages dont l'EXPÉDITEUR a pour empreinte le
//      `contactEmailHash` d'une fiche apporteur non supprimée, ET qui sont
//      arrivés APRÈS une invitation `apporteur-invitation-appel` partie vers
//      cette personne ;
//   3. pour ceux-là seulement, lit les en-têtes (réponse automatique ?
//      `Message-ID`) et enregistre une RÉPONSE ENTRANTE rattachée à la fiche
//      invitée — une seule par message Zoho ;
//   4. prévient Will (salon Telegram des apporteurs) pour chaque réponse
//      humaine NOUVELLE ;
//   5. avance le curseur, seulement si tout s'est bien passé.
//
// ── Ce que la réponse change ailleurs ─────────────────────────────────────
//   · les rappels : `lireEtatsRelance` compte une réponse humaine comme une
//     réponse (motif `repondu`) — au passage quotidien ET au filet du départ ;
//   · la liste : badge « A répondu le JJ/MM » (`badgeSuiviInvitation`) ;
//   · la fiche : bloc « Réponses reçues par e-mail » ;
//   · les messages automatiques d'ATTENTE (R6, 2026-10-10) : une réponse humaine
//     de la personne annule ses relances « votre inscription / candidature vous
//     attend » (A1, A2, A3 du tunnel vidéo, J+2 / J+7 de l'ancien formulaire),
//     comme une réponse envoyée depuis la console (`reply-actions.ts`). Cela vaut
//     AUSSI pour une personne qui n'a pas encore été invitée — c'est même le cas
//     courant : elle répond à « il vous manque une étape ». Ce message-là n'est
//     pas enregistré (le relevé ne garde que les réponses à une invitation), il
//     arrête seulement les relances. Une réponse automatique n'arrête rien.
//
// ── Réponse automatique ───────────────────────────────────────────────────
// Enregistrée, marquée `auto`, et elle n'arrête RIEN : un « je suis absent »
// n'est pas une réponse de la personne. Pas de notification non plus.
//
// ── Ce qui l'arrête, sans jamais lever ────────────────────────────────────
//   · variables Zoho absentes : rien, dit UNE fois par processus ;
//   · build (`stub.invalid`) : rien, sans un appel ;
//   · table absente (fenêtre app/worker après fusion) : rien, curseur intact ;
//   · Zoho injoignable : rien, curseur intact, repris au passage suivant.

import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import {
  adresseExpediteur,
  estReponseAutomatique,
  estTableAbsente,
  extraitCourt,
  objetEnregistre,
  type Entetes,
} from "@/lib/commercial-application/reponse-entrante";
import {
  creerClientZohoMail,
  lireConfigZohoMail,
  type ClientZohoMail,
  type MessageZoho,
} from "@/server/zoho-mail/client";
import { GABARIT_INVITATION } from "./relance-invitation-etat";
import { annulerRelancesLeadApporteur } from "./relances-lead-apporteur";

/** Motif écrit au journal des envois pour chaque relance retirée. */
export const MOTIF_ANNULATION_REPONSE = "Envoi annulé : la personne a répondu par e-mail.";

/** Clé du curseur dans la table `settings`. */
export const CLE_CURSEUR = "apporteurs.reponses-entrantes.curseur";
/** Recouvrement de sécurité entre deux passages. */
export const CHEVAUCHEMENT_MS = 2 * 60 * 60 * 1000;
/**
 * Premier passage (aucun curseur) : jusqu'où remonter. Quatorze jours, la
 * fenêtre des rappels (`AGE_MAX_INVITATION_MS`) — au-delà, aucun rappel ne
 * reste à arrêter, et l'historique n'est pas l'objet de ce relevé.
 */
export const RATTRAPAGE_INITIAL_MS = 14 * 24 * 60 * 60 * 1000;

export interface CompteRenduReponses {
  readonly suspendu?: "config-absente" | "build" | "table-absente" | "zoho-injoignable";
  /** Messages lus dans la fenêtre. */
  readonly lus: number;
  /** Messages d'une personne invitée, arrivés après son invitation. */
  readonly reconnus: number;
  readonly enregistrees: { humaines: number; automatiques: number };
  /** Déjà enregistrés par un passage précédent (recouvrement). */
  readonly dejaConnues: number;
  readonly erreurs: number;
  /** Le plafond de pages a été atteint avant de remonter jusqu'au curseur. */
  readonly tronque?: true;
}

let configAbsenteDite = false;
/** Pour les tests : le journal « variables absentes » redevient disponible. */
export function reinitialiserJournalConfig(): void {
  configAbsenteDite = false;
}

function vide(suspendu?: CompteRenduReponses["suspendu"]): CompteRenduReponses {
  return {
    ...(suspendu ? { suspendu } : {}),
    lus: 0,
    reconnus: 0,
    enregistrees: { humaines: 0, automatiques: 0 },
    dejaConnues: 0,
    erreurs: 0,
  };
}

async function lireCurseur(): Promise<Date | null> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: CLE_CURSEUR },
      select: { value: true },
    });
    const brut = (ligne?.value as { depuis?: unknown } | null)?.depuis;
    const t = typeof brut === "string" ? Date.parse(brut) : NaN;
    return Number.isFinite(t) ? new Date(t) : null;
  } catch {
    return null; // curseur illisible : on repart de la fenêtre de rattrapage
  }
}

async function ecrireCurseur(depuis: Date): Promise<void> {
  const value = { depuis: depuis.toISOString() };
  await prisma.setting.upsert({
    where: { key: CLE_CURSEUR },
    create: {
      key: CLE_CURSEUR,
      value,
      description:
        "Relevé des réponses des candidats apporteurs dans Zoho Mail : début du prochain passage.",
    },
    update: { value },
  });
}

interface LigneFiche {
  id: string;
  contactEmailHash: string | null;
  contactName: string;
  details: unknown;
  submittedAt?: Date | null;
}

/** Une réponse à enregistrer : le message, la fiche invitée, l'empreinte. */
interface Rattachement {
  readonly message: MessageZoho;
  readonly empreinte: string;
  readonly fiche: LigneFiche;
}

/** Un message d'une personne connue comme apporteur, sans invitation avant lui. */
interface MessageHorsInvitation {
  readonly message: MessageZoho;
  readonly adresse: string;
}

/**
 * Les messages d'une personne invitée, arrivés après son invitation, chacun
 * rattaché à la fiche de la DERNIÈRE invitation partie avant lui — et, à part,
 * ceux d'une personne apporteur arrivés après sa fiche mais SANS invitation
 * avant eux (ils n'arrêtent que les relances d'attente).
 */
async function rattacher(
  messages: readonly MessageZoho[],
): Promise<{ rattachements: Rattachement[]; horsInvitation: MessageHorsInvitation[] }> {
  const parEmpreinte = new Map<string, MessageZoho[]>();
  for (const m of messages) {
    const adresse = adresseExpediteur(m.fromAddress);
    const empreinte = adresse ? hashEmailForLookup(adresse) : null;
    if (!empreinte) continue;
    parEmpreinte.set(empreinte, [...(parEmpreinte.get(empreinte) ?? []), m]);
  }
  if (parEmpreinte.size === 0) return { rattachements: [], horsInvitation: [] };

  const fiches = (await prisma.submission.findMany({
    where: { contactEmailHash: { in: [...parEmpreinte.keys()] }, deletedAt: null },
    select: {
      id: true,
      contactEmailHash: true,
      contactName: true,
      details: true,
      submittedAt: true,
    },
  })) as LigneFiche[];
  const ficheParId = new Map(fiches.map((f) => [f.id, f]));
  if (fiches.length === 0) return { rattachements: [], horsInvitation: [] };

  const invitations = await prisma.emailLog.findMany({
    where: {
      template: GABARIT_INVITATION,
      entityType: "Submission",
      entityId: { in: fiches.map((f) => f.id) },
      status: "sent",
    },
    select: { entityId: true, createdAt: true, sentAt: true },
  });

  const sortie: Rattachement[] = [];
  const horsInvitation: MessageHorsInvitation[] = [];
  for (const [empreinte, liste] of parEmpreinte) {
    // La plus ANCIENNE fiche apporteur de la personne : un message arrivé avant
    // elle ne répond à aucun de nos messages.
    const premiereFiche = fiches
      .filter((f) => f.contactEmailHash === empreinte && estApporteur(f.details))
      .map((f) => (f.submittedAt instanceof Date ? f.submittedAt.getTime() : 0))
      .sort((a, b) => a - b)[0];
    const invits = invitations
      .map((i) => ({ fiche: i.entityId ? ficheParId.get(i.entityId) : undefined, i }))
      .filter(
        (x): x is { fiche: LigneFiche; i: (typeof invitations)[number] } =>
          !!x.fiche && x.fiche.contactEmailHash === empreinte && estApporteur(x.fiche.details),
      )
      .map((x) => ({ fiche: x.fiche, le: (x.i.sentAt ?? x.i.createdAt).getTime() }))
      .sort((a, b) => b.le - a.le);
    for (const m of liste) {
      // 🔑 Partie AVANT le message : un message antérieur à l'invitation n'y
      // répond pas (premier contact, question d'avant) — il n'est pas enregistré.
      const invit = invits.find((x) => x.le < m.receivedAt.getTime());
      if (invit) {
        sortie.push({ message: m, empreinte, fiche: invit.fiche });
        continue;
      }
      const adresse = adresseExpediteur(m.fromAddress);
      if (adresse && premiereFiche !== undefined && premiereFiche < m.receivedAt.getTime()) {
        horsInvitation.push({ message: m, adresse });
      }
    }
  }
  return { rattachements: sortie, horsInvitation };
}

/**
 * R6 — une réponse humaine de la personne arrête ses relances d'attente.
 * Best-effort : un retrait raté n'interrompt pas le relevé (la relance repart
 * au pire une fois, comme avant), et ne fait pas reculer le curseur.
 */
async function arreterRelancesAttente(adresse: string): Promise<void> {
  try {
    await annulerRelancesLeadApporteur(adresse, MOTIF_ANNULATION_REPONSE);
  } catch (e) {
    console.warn(
      "[reponses-entrantes] relances d'attente non retirées :",
      e instanceof Error ? e.message : String(e),
    );
  }
}

async function notifier(r: Rattachement, auto: boolean, objet: string): Promise<void> {
  if (auto) return;
  try {
    // Import PARESSEUX : le hub tire ses canaux (Telegram, e-mail) ; seul un
    // passage qui a quelque chose à dire en paie le chargement.
    const { notify } = await import("@/server/notifications");
    let nom = "";
    try {
      nom = decryptPii(r.fiche.contactName) ?? "";
    } catch {
      nom = "";
    }
    await notify({
      category: "APPORTEUR_REPLIED",
      payload: {
        submissionId: r.fiche.id,
        contactName: nom || "(nom illisible)",
        subject: objet,
        receivedAt: r.message.receivedAt.toISOString(),
      },
    });
  } catch (e) {
    console.warn(
      "[reponses-entrantes] notification impossible :",
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function passerReponsesEntrantes(
  opts: { maintenant?: Date; client?: ClientZohoMail } = {},
): Promise<CompteRenduReponses> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return vide("build");

  let client = opts.client;
  if (!client) {
    const config = lireConfigZohoMail();
    if (!config) {
      if (!configAbsenteDite) {
        configAbsenteDite = true;
        console.warn(
          "[reponses-entrantes] ZOHO_MAIL_CLIENT_ID / ZOHO_MAIL_CLIENT_SECRET / " +
            "ZOHO_MAIL_REFRESH_TOKEN absents de l'environnement du worker : les réponses " +
            "des candidats apporteurs ne sont pas relevées.",
        );
      }
      return vide("config-absente");
    }
    client = creerClientZohoMail(config);
  }

  const debut = opts.maintenant ?? new Date();
  const curseur = await lireCurseur();
  const depuis = new Date(
    curseur ? curseur.getTime() - CHEVAUCHEMENT_MS : debut.getTime() - RATTRAPAGE_INITIAL_MS,
  );

  let liste: Awaited<ReturnType<ClientZohoMail["listerMessagesRecus"]>>;
  try {
    liste = await client.listerMessagesRecus(depuis);
  } catch (e) {
    console.warn(
      "[reponses-entrantes] boîte Zoho illisible — passage abandonné, repris au suivant :",
      e instanceof Error ? e.message : String(e),
    );
    return vide("zoho-injoignable");
  }

  const { rattachements, horsInvitation } = await rattacher(liste.messages);
  let dejaConnues = 0;
  let erreurs = 0;
  const enregistrees = { humaines: 0, automatiques: 0 };

  if (rattachements.length > 0) {
    let connus: Set<string>;
    try {
      const deja = await prisma.submissionInboundReply.findMany({
        where: { zohoMessageId: { in: rattachements.map((r) => r.message.messageId) } },
        select: { zohoMessageId: true },
      });
      connus = new Set(deja.map((d) => d.zohoMessageId));
    } catch (e) {
      if (estTableAbsente(e)) {
        console.warn(
          "[reponses-entrantes] table des réponses absente (migration pas encore jouée par " +
            "l'app) : passage reporté.",
        );
        return { ...vide("table-absente"), lus: liste.messages.length };
      }
      throw e;
    }

    for (const r of rattachements) {
      const m = r.message;
      if (connus.has(m.messageId)) {
        dejaConnues += 1;
        continue;
      }
      let entetes: Entetes | null = null;
      try {
        entetes = await client.lireEntetes(m.folderId, m.messageId);
      } catch {
        entetes = null; // l'objet seul décidera
      }
      const objet = objetEnregistre(m.subject);
      const auto = estReponseAutomatique({ entetes, objet });
      const internetMessageId = entetes?.["message-id"]?.[0]?.trim().slice(0, 500) || null;
      const extrait = extraitCourt(m.summary);
      try {
        await prisma.submissionInboundReply.create({
          data: {
            submissionId: r.fiche.id,
            receivedAt: m.receivedAt,
            fromEmailHash: r.empreinte,
            subject: objet,
            excerpt: extrait ? encryptPii(extrait) : null,
            zohoMessageId: m.messageId,
            zohoFolderId: m.folderId || null,
            internetMessageId,
            auto,
          },
        });
      } catch (e) {
        const code = (e as { code?: unknown } | null)?.code;
        if (code === "P2002") {
          dejaConnues += 1; // un autre passage l'a écrit entre-temps
          continue;
        }
        erreurs += 1;
        console.error(
          `[reponses-entrantes] réponse ${m.messageId} non enregistrée :`,
          e instanceof Error ? e.message : String(e),
        );
        continue;
      }
      if (auto) enregistrees.automatiques += 1;
      else {
        enregistrees.humaines += 1;
        // Une fiche rangée à l'invitation (`invitation-apporteur.ts`) revient
        // « à traiter » quand le candidat répond : sans ça, sa réponse ne se
        // verrait que sur Telegram. Une réponse automatique (absence) ne rouvre rien.
        try {
          await prisma.submission.updateMany({
            where: { id: r.fiche.id, status: "processed", archivedAt: null },
            data: { status: "in_progress", needsAttention: true },
          });
        } catch (e) {
          console.warn(
            "[reponses-entrantes] fiche non rouverte :",
            e instanceof Error ? e.message : String(e),
          );
        }
      }
      if (!auto) {
        const adresse = adresseExpediteur(m.fromAddress);
        if (adresse) await arreterRelancesAttente(adresse);
      }
      await notifier(r, auto, objet);
    }
  }

  // Messages d'une personne apporteur SANS invitation avant eux (un lead de la
  // page vidéo qui répond à « il vous manque une étape ») : rien n'est
  // enregistré, mais une réponse humaine arrête ses relances d'attente. Les
  // en-têtes décident d'une réponse automatique, comme plus haut.
  for (const h of horsInvitation) {
    let entetes: Entetes | null = null;
    try {
      entetes = await client.lireEntetes(h.message.folderId, h.message.messageId);
    } catch {
      entetes = null;
    }
    if (estReponseAutomatique({ entetes, objet: objetEnregistre(h.message.subject) })) continue;
    await arreterRelancesAttente(h.adresse);
  }

  // Le curseur n'avance que sur un passage SANS erreur : un message raté est
  // relu au passage suivant (le recouvrement ne suffirait pas après 2 h).
  if (erreurs === 0) {
    try {
      await ecrireCurseur(debut);
    } catch (e) {
      console.warn(
        "[reponses-entrantes] curseur non enregistré (le prochain passage relira plus large) :",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  if (!liste.complet) {
    console.warn(
      `[reponses-entrantes] fenêtre tronquée : plus de ${liste.messages.length} messages depuis ` +
        `${depuis.toISOString()} — les plus anciens n'ont pas été lus.`,
    );
  }

  return {
    lus: liste.messages.length,
    reconnus: rattachements.length,
    enregistrees,
    dejaConnues,
    erreurs,
    ...(liste.complet ? {} : { tronque: true as const }),
  };
}
