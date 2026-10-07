// RÉPONSES REÇUES DES CANDIDATS EMPLOI — le relevé (lot L3, 2026-10-07).
//
// Jusqu'ici, une réponse d'un candidat arrivée dans la boîte Zoho Mail
// contact@axion-ia.com n'existait dans la console que si quelqu'un la
// recopiait au journal (« Message reçu », geste manuel). Ce relevé la fait
// apparaître seule dans la fiche, en moins de 15 minutes, avec une alerte.
//
// ── Un relevé SÉPARÉ de celui des apporteurs ─────────────────────────────
// `features/commercial-application/reponses-entrantes-apporteur.ts` n'est PAS
// touché : son curseur, son filtre, l'arrêt des rappels et son alerte
// `APPORTEUR_REPLIED` restent exactement ce qu'ils étaient. Ce module a son
// propre curseur (`CLE_CURSEUR`), sa propre table
// (`JobApplicationInboundReply`) et sa propre file (`formation-crons`, celle
// des autres passages des candidatures). Deux mondes, deux relevés : jamais de
// statut, de file ou d'alerte communs (`src/features/personne/fiche-personne.ts`).
// Seuls sont partagés le client Zoho (lecture seule) et les fonctions PURES de
// `lib/commercial-application/reponse-entrante.ts`.
//
// ── Ce que fait un passage (toutes les 15 minutes) ───────────────────────
//   1. lit la boîte de réception depuis le dernier curseur, moins un
//      CHEVAUCHEMENT de deux heures (idempotence par identifiant Zoho) ;
//   2. garde les messages dont l'EXPÉDITEUR a pour empreinte le `emailHash`
//      d'une candidature, ET qui sont arrivés APRÈS un message parti de chez
//      nous vers ce dossier (accusé de réception, réponse de la console) ;
//      le message est rattaché au dossier du DERNIER envoi parti avant lui ;
//   3. pour chacun : lit les en-têtes (réponse automatique ? `Message-ID`) et,
//      dans UNE transaction, enregistre la réponse (objet + extrait chiffré),
//      consigne `email_recu` au journal et remet le dossier « à traiter » ;
//   4. prévient l'équipe (salon Telegram des candidatures) ;
//   5. avance le curseur, seulement si tout s'est bien passé.
//
// ── Réponse automatique (« je suis absent ») ─────────────────────────────
// Enregistrée, marquée `auto`, visible dans la fiche — et SANS EFFET : ni
// ligne au journal, ni « à traiter », ni alerte.
//
// ── Message ancien (rattrapage) ──────────────────────────────────────────
// Un message de plus de 24 heures (premier passage, ou reprise après une
// panne) est enregistré et consigné au journal à sa date, mais ne remet pas
// le dossier « à traiter » et ne déclenche pas d'alerte : ce qui a dormi un
// jour a déjà, le plus souvent, été traité à la main.
//
// ── Une personne présente dans les deux mondes [I13] ─────────────────────
// Son message est rattaché à sa candidature ICI, et à sa fiche apporteur par
// l'autre relevé — chacun dans sa table. UNE SEULE alerte : si l'autre relevé
// rattache ce message (expéditeur apporteur invité avant le message), c'est
// SON alerte `APPORTEUR_REPLIED` qui part, et ce relevé se tait. Tant que
// l'autre relevé ne l'a pas encore vu, le message est REMIS au passage suivant
// (au plus `ATTENTE_AUTRE_RELEVE_MS`, au-delà on l'enregistre et on alerte :
// mieux vaut deux alertes que zéro).
//
// ── Ce qui l'arrête, sans jamais lever ───────────────────────────────────
//   · INTERRUPTEUR `CANDIDATS_REPONSES_RECUES_ENABLED` différent de "true"
//     (ÉTEINT PAR DÉFAUT : absent = éteint ; lot du « paquet 2 », allumé par
//     Will dans l'environnement du worker quand il le décide) : rien, sans un
//     appel, curseur intact ;
//   · variables Zoho absentes : rien, dit UNE fois par processus ;
//   · build (`stub.invalid`) : rien, sans un appel ;
//   · table absente (fenêtre app/worker après fusion) : rien, curseur intact ;
//   · Zoho injoignable : rien, curseur intact, repris au passage suivant.
//
// 🔴 Aucun effacement automatique : rien ici ne supprime quoi que ce soit.
//
// ⚠️ Tourne dans le WORKER (tsx, hors Next) : ni `server-only`, ni `@/env`.

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
// Constante seulement (lecture) : le gabarit de l'invitation apporteur, pour
// savoir si l'AUTRE relevé rattachera ce message. Rien n'y est modifié.
import { GABARIT_INVITATION } from "@/features/commercial-application/relance-invitation-etat";
import { consignerEvenement } from "./journal";

/**
 * Interrupteur d'environnement du relevé. ÉTEINT si absent : seule la valeur
 * exacte "true" l'allume (même convention que `STRIPE_ENABLED`, `CHATBOT_ENABLED`).
 */
export const INTERRUPTEUR = "CANDIDATS_REPONSES_RECUES_ENABLED";
export function releveAllume(): boolean {
  return process.env[INTERRUPTEUR] === "true";
}

/** Clé du curseur dans la table `settings` — distincte de celle des apporteurs. */
export const CLE_CURSEUR = "candidatures.reponses-entrantes.curseur";
/** Recouvrement de sécurité entre deux passages. */
export const CHEVAUCHEMENT_MS = 2 * 60 * 60 * 1000;
/** Premier passage (aucun curseur) : jusqu'où remonter. */
export const RATTRAPAGE_INITIAL_MS = 14 * 24 * 60 * 60 * 1000;
/** Au-delà, un message est « ancien » : enregistré, sans alerte ni « à traiter ». */
export const RECENT_MS = 24 * 60 * 60 * 1000;
/** Attente maximale du relevé apporteurs pour une personne des deux mondes. */
export const ATTENTE_AUTRE_RELEVE_MS = 2 * 60 * 60 * 1000;
/** `EmailLog.entityType` posé à l'envoi de l'accusé de réception. */
const ENTITE_CANDIDATURE = "JobApplication";
/** Auteur des lignes de journal posées par ce relevé (un mécanisme, pas une personne). */
export const AUTEUR_RELEVE = "Boîte mail (relevé automatique)";

export interface CompteRenduReponsesCandidats {
  readonly suspendu?: "eteint" | "config-absente" | "build" | "table-absente" | "zoho-injoignable";
  readonly lus: number;
  /** Messages d'un candidat, arrivés après un envoi vers son dossier. */
  readonly reconnus: number;
  readonly enregistrees: { humaines: number; automatiques: number };
  readonly dejaConnues: number;
  /** Personnes des deux mondes : remises au passage suivant (l'autre relevé ne les a pas vues). */
  readonly remises: number;
  readonly alertes: number;
  readonly erreurs: number;
  readonly tronque?: true;
}

let configAbsenteDite = false;
/** Pour les tests : le journal « variables absentes » redevient disponible. */
export function reinitialiserJournalConfig(): void {
  configAbsenteDite = false;
}

function vide(suspendu?: CompteRenduReponsesCandidats["suspendu"]): CompteRenduReponsesCandidats {
  return {
    ...(suspendu ? { suspendu } : {}),
    lus: 0,
    reconnus: 0,
    enregistrees: { humaines: 0, automatiques: 0 },
    dejaConnues: 0,
    remises: 0,
    alertes: 0,
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
    return null;
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
        "Relevé des réponses des candidats emploi dans Zoho Mail : début du prochain passage.",
    },
    update: { value },
  });
}

interface Dossier {
  id: string;
  emailHash: string | null;
  firstName: string;
  lastName: string;
  offerTitleSnap: string;
}

/** Une réponse à enregistrer : le message, le dossier, l'empreinte. */
export interface RattachementCandidat {
  readonly message: MessageZoho;
  readonly empreinte: string;
  readonly dossier: Dossier;
}

function empreinteDe(m: MessageZoho): string | null {
  const adresse = adresseExpediteur(m.fromAddress);
  return adresse ? hashEmailForLookup(adresse) : null;
}

/**
 * Les messages d'un candidat, arrivés après un message parti de chez nous vers
 * son dossier — chacun rattaché au dossier du DERNIER envoi parti avant lui.
 */
async function rattacher(messages: readonly MessageZoho[]): Promise<RattachementCandidat[]> {
  const parEmpreinte = new Map<string, MessageZoho[]>();
  for (const m of messages) {
    const e = empreinteDe(m);
    if (!e) continue;
    parEmpreinte.set(e, [...(parEmpreinte.get(e) ?? []), m]);
  }
  if (parEmpreinte.size === 0) return [];

  const dossiers = (await prisma.jobApplication.findMany({
    where: { emailHash: { in: [...parEmpreinte.keys()] } },
    select: { id: true, emailHash: true, firstName: true, lastName: true, offerTitleSnap: true },
  })) as Dossier[];
  if (dossiers.length === 0) return [];
  const ids = dossiers.map((d) => d.id);

  // Ce qui est PARTI de chez nous vers ces dossiers : l'accusé de réception
  // (et tout envoi enfilé avec l'entité), et les réponses écrites en console.
  const [journaux, reponses] = await Promise.all([
    prisma.emailLog.findMany({
      where: { entityType: ENTITE_CANDIDATURE, entityId: { in: ids }, status: "sent" },
      select: { entityId: true, createdAt: true, sentAt: true },
    }),
    prisma.jobApplicationReply.findMany({
      where: { applicationId: { in: ids }, deliveryStatus: { in: ["sent", "bounced"] } },
      select: { applicationId: true, sentAt: true, repliedAt: true },
    }),
  ]);
  const envois: Array<{ id: string; le: number }> = [
    ...journaux
      .filter((j): j is typeof j & { entityId: string } => typeof j.entityId === "string")
      .map((j) => ({ id: j.entityId, le: (j.sentAt ?? j.createdAt).getTime() })),
    ...reponses.map((r) => ({ id: r.applicationId, le: (r.sentAt ?? r.repliedAt).getTime() })),
  ];
  const dossierParId = new Map(dossiers.map((d) => [d.id, d]));

  const sortie: RattachementCandidat[] = [];
  for (const [empreinte, liste] of parEmpreinte) {
    const candidats = envois
      .map((e) => ({ d: dossierParId.get(e.id), le: e.le }))
      .filter((x): x is { d: Dossier; le: number } => !!x.d && x.d.emailHash === empreinte)
      .sort((a, b) => b.le - a.le);
    if (candidats.length === 0) continue;
    for (const m of liste) {
      // 🔑 Parti AVANT le message : un message antérieur à tout envoi de notre
      // part n'est pas une réponse (premier contact, autre sujet).
      const envoi = candidats.find((x) => x.le < m.receivedAt.getTime());
      if (envoi) sortie.push({ message: m, empreinte, dossier: envoi.d });
    }
  }
  return sortie;
}

/**
 * Pour chaque message : l'AUTRE relevé (apporteurs) le rattachera-t-il ?
 * Même critère que lui — fiche apporteur non supprimée de même empreinte, et
 * invitation partie avant le message. Lecture seule.
 */
async function messagesDuMondeApporteur(
  rattachements: readonly RattachementCandidat[],
): Promise<Set<string>> {
  const empreintes = [...new Set(rattachements.map((r) => r.empreinte))];
  if (empreintes.length === 0) return new Set();
  const fiches = (await prisma.submission.findMany({
    where: { contactEmailHash: { in: empreintes }, deletedAt: null },
    select: { id: true, contactEmailHash: true, details: true },
  })) as Array<{ id: string; contactEmailHash: string | null; details: unknown }>;
  const apporteurs = fiches.filter((f) => estApporteur(f.details));
  if (apporteurs.length === 0) return new Set();
  const invitations = await prisma.emailLog.findMany({
    where: {
      template: GABARIT_INVITATION,
      entityType: "Submission",
      entityId: { in: apporteurs.map((f) => f.id) },
      status: "sent",
    },
    select: { entityId: true, createdAt: true, sentAt: true },
  });
  const empreinteFiche = new Map(apporteurs.map((f) => [f.id, f.contactEmailHash]));
  const sortie = new Set<string>();
  for (const r of rattachements) {
    const invite = invitations.some(
      (i) =>
        !!i.entityId &&
        empreinteFiche.get(i.entityId) === r.empreinte &&
        (i.sentAt ?? i.createdAt).getTime() < r.message.receivedAt.getTime(),
    );
    if (invite) sortie.add(r.message.messageId);
  }
  return sortie;
}

/** Les messages déjà rattachés par le relevé apporteurs. Table absente = aucun. */
async function dejaVusParLAutreReleve(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const lignes = await prisma.submissionInboundReply.findMany({
      where: { zohoMessageId: { in: [...ids] } },
      select: { zohoMessageId: true },
    });
    return new Set(lignes.map((l) => l.zohoMessageId));
  } catch {
    return new Set();
  }
}

function nomLisible(d: Dossier): string {
  const lire = (v: string) => {
    try {
      return decryptPii(v) ?? "";
    } catch {
      return "";
    }
  };
  return `${lire(d.firstName)} ${lire(d.lastName)}`.trim();
}

async function notifier(r: RattachementCandidat, objet: string): Promise<boolean> {
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "CANDIDAT_REPLIED",
      payload: {
        applicationId: r.dossier.id,
        contactName: nomLisible(r.dossier) || "(nom illisible)",
        offerTitle: r.dossier.offerTitleSnap,
        subject: objet,
        receivedAt: r.message.receivedAt.toISOString(),
      },
    });
    return true;
  } catch (e) {
    console.warn(
      "[reponses-candidats] notification impossible :",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

export async function passerReponsesEntrantesCandidats(
  opts: { maintenant?: Date; client?: ClientZohoMail } = {},
): Promise<CompteRenduReponsesCandidats> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return vide("build");
  // Éteint par défaut : ni Zoho, ni base, ni curseur.
  if (!releveAllume()) return vide("eteint");

  let client = opts.client;
  if (!client) {
    const config = lireConfigZohoMail();
    if (!config) {
      if (!configAbsenteDite) {
        configAbsenteDite = true;
        console.warn(
          "[reponses-candidats] ZOHO_MAIL_CLIENT_ID / ZOHO_MAIL_CLIENT_SECRET / " +
            "ZOHO_MAIL_REFRESH_TOKEN absents de l'environnement du worker : les réponses " +
            "des candidats emploi ne sont pas relevées.",
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
      "[reponses-candidats] boîte Zoho illisible — passage abandonné, repris au suivant :",
      e instanceof Error ? e.message : String(e),
    );
    return vide("zoho-injoignable");
  }

  const rattachements = await rattacher(liste.messages);
  let dejaConnues = 0;
  let erreurs = 0;
  let remises = 0;
  let alertes = 0;
  const enregistrees = { humaines: 0, automatiques: 0 };

  if (rattachements.length > 0) {
    let connus: Set<string>;
    try {
      const deja = await prisma.jobApplicationInboundReply.findMany({
        where: { zohoMessageId: { in: rattachements.map((r) => r.message.messageId) } },
        select: { zohoMessageId: true },
      });
      connus = new Set(deja.map((d) => d.zohoMessageId));
    } catch (e) {
      if (estTableAbsente(e)) {
        console.warn(
          "[reponses-candidats] table des réponses absente (migration pas encore jouée par " +
            "l'app) : passage reporté.",
        );
        return { ...vide("table-absente"), lus: liste.messages.length };
      }
      throw e;
    }

    const nouveaux = rattachements.filter((r) => !connus.has(r.message.messageId));
    dejaConnues = rattachements.length - nouveaux.length;
    const mondeApporteur = await messagesDuMondeApporteur(nouveaux);
    const vusAilleurs = await dejaVusParLAutreReleve([...mondeApporteur]);

    for (const r of nouveaux) {
      const m = r.message;
      const desDeuxMondes = mondeApporteur.has(m.messageId);
      // Personne des deux mondes, message pas encore vu par l'autre relevé :
      // on le remet, pour que l'alerte unique soit la sienne.
      if (
        desDeuxMondes &&
        !vusAilleurs.has(m.messageId) &&
        debut.getTime() - m.receivedAt.getTime() < ATTENTE_AUTRE_RELEVE_MS
      ) {
        remises += 1;
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
      const recent = debut.getTime() - m.receivedAt.getTime() < RECENT_MS;

      try {
        await prisma.$transaction(async (tx) => {
          const ligne = await tx.jobApplicationInboundReply.create({
            data: {
              applicationId: r.dossier.id,
              receivedAt: m.receivedAt,
              fromEmailHash: r.empreinte,
              subject: objet,
              excerpt: extrait ? encryptPii(extrait) : null,
              zohoMessageId: m.messageId,
              zohoFolderId: m.folderId || null,
              internetMessageId,
              auto,
            },
            select: { id: true },
          });
          if (auto) return; // gardée, sans effet
          await consignerEvenement(
            {
              applicationId: r.dossier.id,
              type: "email_recu",
              authorId: null,
              authorName: AUTEUR_RELEVE,
              occurredAt: m.receivedAt,
              summary: `Réponse reçue par e-mail — « ${objet} »`,
              // Pas d'extrait ici : le journal est en clair, l'extrait reste
              // chiffré dans sa table (bloc « Réponses reçues par e-mail »).
              body: null,
              meta: { source: "zoho", reponseRecueId: ligne.id, zohoMessageId: m.messageId },
            },
            tx,
          );
          if (recent) {
            await tx.jobApplication.updateMany({
              where: { id: r.dossier.id },
              data: { needsAttention: true },
            });
          }
        });
      } catch (e) {
        const code = (e as { code?: unknown } | null)?.code;
        if (code === "P2002") {
          dejaConnues += 1; // un autre passage l'a écrit entre-temps
          continue;
        }
        erreurs += 1;
        console.error(
          `[reponses-candidats] réponse ${m.messageId} non enregistrée :`,
          e instanceof Error ? e.message : String(e),
        );
        continue;
      }

      if (auto) {
        enregistrees.automatiques += 1;
        continue;
      }
      enregistrees.humaines += 1;
      // UNE alerte : celle du relevé apporteurs quand il a rattaché ce message.
      if (recent && !vusAilleurs.has(m.messageId)) {
        if (await notifier(r, objet)) alertes += 1;
      }
    }
  }

  // Le curseur n'avance que sur un passage SANS erreur ni message remis : un
  // message raté ou remis est relu au passage suivant.
  if (erreurs === 0 && remises === 0) {
    try {
      await ecrireCurseur(debut);
    } catch (e) {
      console.warn(
        "[reponses-candidats] curseur non enregistré (le prochain passage relira plus large) :",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  if (!liste.complet) {
    console.warn(
      `[reponses-candidats] fenêtre tronquée : plus de ${liste.messages.length} messages depuis ` +
        `${depuis.toISOString()} — les plus anciens n'ont pas été lus.`,
    );
  }

  return {
    lus: liste.messages.length,
    reconnus: rattachements.length,
    enregistrees,
    dejaConnues,
    remises,
    alertes,
    erreurs,
    ...(liste.complet ? {} : { tronque: true as const }),
  };
}
