// Le DOUBLON d'une demande de client (14/11/2026, décision du fondateur) : le salon « Clients »
// reste la voie principale ; chaque demande est en plus répétée à deux endroits, pour qu'aucune
// ne passe inaperçue :
//   1. la conversation PRIVÉE du fondateur avec le robot (`TELEGRAM_CHAT_ID_PRIVE`, sans repli :
//      absente, pas de doublon Telegram) — un message court, AVEC SON ;
//   2. un e-mail à `destinataireAlertesClients()` (« 🔴 IMPORTANT DEMANDE CLIENT … »), qui porte
//      toutes les informations : nom, entreprise, téléphone, e-mail, message, date du rendez-vous,
//      lien vers la fiche.
//
// Garanties : `doublerAlerteClient` ne lève JAMAIS ; chaque envoi a sa propre clé anti-doublon,
// libérée si l'envoi échoue ; les deux départs sont indépendants. Le doublon ne passe jamais par
// `libererSiEchec` de `notify()` : l'échec d'un doublon ne doit pas rouvrir l'alerte du salon (elle
// serait renvoyée en double). Conséquence : quand le salon est parti, PAS de rejeu pour réparer un
// doublon raté ; le filet est le récap de 7 h 30 (PR C). Chaque échec est tracé (journal + Sentry).
//
// ⚠️ Pas d'import de `queues.ts` ici, même dynamique : ce module est dans la fermeture d'imports du
// worker d'e-mails, que la garde `email-worker.opposition.graphe-worker.spec.ts` tient hors de
// `queues.ts`. L'enfileur vient du registre `enfileur-email.ts`, posé par `queues.ts` (worker) et
// `instrumentation.ts` (app).
//
// ⚠️ Contrat app ↔ worker : le gabarit d'e-mail `alerte-demande-client` est NOUVEAU. Le worker
// atterrit avant l'app (`axionia/AGENTS.md`, « DEUX conteneurs ») : il connaît donc le gabarit
// avant que l'app n'en enfile un. Rien n'est retiré ni renommé.

import { createHash } from "node:crypto";
import { destinataireAlertesClients } from "@/lib/destinataires-internes";
import { lienConsole } from "./personne";
import { formatParisDateTime, humanDateOrText } from "./format";
import {
  lienFicheClient,
  lignesDetailClient,
  libelleTypeDemande,
  type EvenementClient,
} from "./format-clients";
import {
  UNIFIED_TYPE_LABELS,
  resolveSubmissionLabel,
} from "@/features/admin-submissions/type-labels";
import { isDuplicate, libererDedup } from "./dedup";
import { resolveConversationPrivee } from "./routing";
import { sendTelegramRaw } from "./channels/telegram";
import { signalerIncident } from "./channels/sentry";
import { chargerEnfileurEmail } from "./enfileur-email";
import { compacter, ligne } from "./texte-brut";
import type { DoublonsClient } from "./types";

/** Les deux familles d'alerte : un message écrit, ou un rendez-vous Calendly. */
export type CanalDoublon = "message" | "calendly" | "reclamation";
export type EvenementDoublon = "nouveau" | "annule" | "reporte";

/** Durée de mémoire de l'anti-doublon propre au doublon : 24 h. */
const TTL_DOUBLON_SEC = 86400;
/** Plafond Telegram, par prudence (le message est court, ce n'est qu'un filet). */
const MAX_TELEGRAM = 4000;

/** Ce que le doublon sait de la demande, quelle que soit la catégorie. */
export interface ResumeDemande {
  canal: CanalDoublon;
  evenement: EvenementDoublon;
  typeDemande: string;
  /** Type de formulaire en clair (« Formation IA »), pour l'objet de l'alerte. Absent : objet d'avant. */
  libelleType?: string;
  nom?: string;
  entreprise?: string;
  telephone?: string;
  email?: string;
  /** Date du rendez-vous, en clair (Calendly seulement). */
  rdv?: string;
  fiche?: string;
}

const net = (v: string | undefined | null): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

interface ChampsPersonne {
  nom: string | undefined;
  entreprise?: string | undefined;
  telephone: string | undefined;
  email: string | undefined;
  rdv?: string | undefined;
}

/** Type de la base de chaque catégorie de formulaire (repli de `resolveSubmissionLabel`). */
const TYPE_BASE_PAR_CATEGORIE: Readonly<Record<string, string>> = {
  CONTACT_FORM_SUBMITTED: "contact",
  CUSTOMER_SUPPORT_REQUEST: "contact",
  AUDIT_REQUEST_SUBMITTED: "audit",
  INTERVENTION_REQUEST_SUBMITTED: "intervention",
  IMPLEMENTATION_REQUEST_SUBMITTED: "implementation",
  QUOTE_REQUEST_RECEIVED: "quote_request",
};

/** Mots qu'un libellé de type ne doit jamais porter dans l'objet (filtres, confidentialité). */
const MOTS_INTERDITS_OBJET = /qualiopi|opco|prise en charge|financeur/i;

/**
 * Le libellé de type pour l'objet, en MAJUSCULES, ou `undefined` (rien à ajouter). Vient du
 * catalogue `resolveSubmissionLabel`, jamais d'un `subType` brut. Un libellé qui porterait un mot
 * interdit devient « FORMATION ». (Le gabarit d'e-mail refait la même garde : ancien payload.)
 */
export function suffixeTypeObjet(libelle: string | undefined): string | undefined {
  // Retours à la ligne et caractères de contrôle : jamais dans un objet d'e-mail.
  const t = libelle

    ?.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return undefined;
  if (MOTS_INTERDITS_OBJET.test(t)) return "FORMATION";
  return Array.from(t.toLocaleUpperCase("fr-FR")).slice(0, LONGUEUR_MAX_TYPE_OBJET).join("").trim();
}

/** Borne du type dans l'objet : préfixe (35) + « · » (3) + 40 = 78 caractères au plus. */
export const LONGUEUR_MAX_TYPE_OBJET = 40;

/** Le libellé de type d'un formulaire (jamais d'un rendez-vous ni du chatbot), ou `undefined`. */
function libelleTypeFormulaire(event: EvenementClient): string | undefined {
  const base = TYPE_BASE_PAR_CATEGORIE[event.category];
  if (!base) return undefined;
  const formType =
    "formType" in event.payload && typeof event.payload.formType === "string"
      ? event.payload.formType
      : undefined;
  // Type connu du catalogue des formulaires : son libellé. Sinon (type hors formulaire comme
  // « simulateur_roi_rappel », ou pas de type) : la même source que la ligne de type du corps et
  // de Telegram, qui ne lit aucun champ libre.
  if (formType && UNIFIED_TYPE_LABELS[formType]) return resolveSubmissionLabel(base, formType);
  return libelleTypeDemande(event);
}

/** Résume l'événement : qui, quoi, quand, et le lien de la fiche. */
export function resumerDemande(event: EvenementClient): ResumeDemande {
  // Lien construit à partir des identifiants : jamais lu dans le texte libre du visiteur
  // (hameçonnage : un message commençant par « Fiche : https://… »).
  const fiche = lienFicheClient(event);

  const resume = (
    canal: CanalDoublon,
    evenement: EvenementDoublon,
    c: ChampsPersonne,
  ): ResumeDemande => ({
    canal,
    evenement,
    typeDemande: libelleTypeDemande(event),
    ...(canal === "message" && libelleTypeFormulaire(event)
      ? { libelleType: libelleTypeFormulaire(event)! }
      : {}),
    ...(net(c.nom) ? { nom: net(c.nom)! } : {}),
    ...(net(c.entreprise) ? { entreprise: net(c.entreprise)! } : {}),
    ...(net(c.telephone) ? { telephone: net(c.telephone)! } : {}),
    ...(net(c.email) ? { email: net(c.email)! } : {}),
    ...(net(c.rdv) ? { rdv: net(c.rdv)! } : {}),
    ...(fiche ? { fiche } : {}),
  });

  switch (event.category) {
    case "CLIENT_CALL_BOOKED": {
      const p = event.payload;
      return resume("calendly", "nouveau", {
        nom: p.inviteeName,
        telephone: p.inviteePhone,
        email: p.inviteeEmail,
        rdv: humanDateOrText(p.eventStartTime),
      });
    }
    case "CLIENT_CALL_CANCELED": {
      const p = event.payload;
      return resume("calendly", "annule", {
        nom: p.inviteeName,
        telephone: p.inviteePhone,
        email: p.inviteeEmail,
        rdv: humanDateOrText(p.eventStartTime),
      });
    }
    case "CLIENT_CALL_RESCHEDULED": {
      const p = event.payload;
      return resume("calendly", "reporte", {
        nom: p.inviteeName,
        telephone: p.inviteePhone,
        email: p.inviteeEmail,
        rdv: humanDateOrText(p.newStart),
      });
    }
    case "CHATBOT_ESCALATION":
      return resume("message", "nouveau", {
        nom: undefined,
        telephone: undefined,
        email: event.payload.contactEmail,
      });
    default: {
      const p = event.payload;
      return resume("message", "nouveau", {
        nom: p.contactName,
        entreprise: p.companyName,
        telephone: p.contactPhone,
        email: p.contactEmail,
      });
    }
  }
}

const SUITE_OBJET: Readonly<Record<CanalDoublon, Readonly<Record<EvenementDoublon, string>>>> = {
  message: { nouveau: "MESSAGE", annule: "MESSAGE", reporte: "MESSAGE" },
  calendly: { nouveau: "CALENDLY", annule: "CALENDLY ANNULÉ", reporte: "CALENDLY REPORTÉ" },
  reclamation: { nouveau: "RÉCLAMATION", annule: "RÉCLAMATION", reporte: "RÉCLAMATION" },
};

/**
 * Le message de la conversation privée : texte brut, court, sans le texte libre du message
 * (il est dans le salon « Clients » et dans l'e-mail).
 */
export function formatDoublonPrive(event: EvenementClient, maintenant = new Date()): string {
  const r = resumerDemande(event);
  const quand =
    "submittedAt" in event.payload && event.payload.submittedAt
      ? event.payload.submittedAt
      : maintenant;
  const qui = [r.nom, r.entreprise].filter((v): v is string => v !== undefined).join(" — ");
  const lignes: Array<string | null> = [
    `🚨 IMPORTANT — DEMANDE CLIENT · ${SUITE_OBJET[r.canal][r.evenement]}${suffixeType(r.libelleType)}`,
    r.typeDemande,
    qui || null,
    r.telephone ? `📞 ${r.telephone}` : null,
    r.email ? `✉️ ${r.email}` : null,
    r.rdv ? `🗓 ${r.rdv}` : null,
    `Reçu le ${formatParisDateTime(quand)} (heure de Paris)`,
    r.fiche ? `Fiche : ${r.fiche}` : null,
  ];
  return compacter(lignes.filter((l): l is string => l !== null))
    .join("\n")
    .slice(0, MAX_TELEGRAM);
}

const suffixeType = (libelle: string | undefined): string => {
  const s = suffixeTypeObjet(libelle);
  return s ? ` · ${s}` : "";
};

/** Objet de l'e-mail. Sans type : ≤ 45 caractères (le test du gabarit le mesure). */
export function objetAlerteClient(
  canal: CanalDoublon,
  evenement: EvenementDoublon,
  libelleType?: string,
): string {
  return `🔴 IMPORTANT DEMANDE CLIENT ${SUITE_OBJET[canal][evenement]}${suffixeType(libelleType)}`;
}

/** Le jour (AAAA-MM-JJ) à Paris : borne la mémoire du jobId à la durée des jobs terminés. */
function jourParis(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Identifiant d'entité de l'e-mail d'alerte (`EmailLog.entityId`, `extra.jobData` chez Sentry si
 * l'envoi échoue). JAMAIS la clé brute : pour une alerte Calendly elle contient l'URI de l'invité,
 * qui peut servir à annuler ou déplacer son rendez-vous. Empreinte non réversible, stable pour une
 * même clé (idempotence), préfixée par la catégorie ; sans clé, la catégorie seule.
 */
export function entiteDeLAlerte(categorie: string, dedupKey: string | undefined): string {
  if (!dedupKey) return categorie;
  return `${categorie}:${createHash("sha256").update(dedupKey).digest("hex").slice(0, 16)}`;
}

/** Journal + Sentry, motif SEUL (jamais de donnée de personne). Ne lève jamais. */
export async function tracerEchec(
  message: string,
  prefixe: { journal: string; incident: string } = {
    journal: "[notif:doublon]",
    incident: "Doublon d'une demande de client :",
  },
): Promise<void> {
  console.error(`${prefixe.journal} ${message}`);
  await signalerIncident(`${prefixe.incident} ${message}`).catch(() => {});
}

async function doublerSurTelegram(
  event: EvenementClient,
  dedupKey: string | undefined,
): Promise<DoublonsClient["prive"]> {
  const cible = resolveConversationPrivee();
  if (!cible) return "skipped";
  const categorie = `prive:${event.category}`;
  if (dedupKey && (await isDuplicate(categorie, dedupKey, TTL_DOUBLON_SEC))) return "deduped";
  let ok = false;
  let motif = "envoi refusé par Telegram";
  try {
    ok = await sendTelegramRaw({
      text: formatDoublonPrive(event),
      brut: true,
      // Avec son : c'est tout l'objet du doublon.
      silent: false,
      sansApercuLien: true,
      chatId: cible.chatId,
      botToken: cible.botToken,
    });
  } catch {
    ok = false;
    motif = "exception à l'envoi Telegram";
  }
  if (!ok) {
    await tracerEchec(`conversation privée non prévenue (${motif})`);
    if (dedupKey) await libererDedup(categorie, dedupKey);
  }
  return ok ? "sent" : "failed";
}

async function doublerParEmail(
  event: EvenementClient,
  dedupKey: string | undefined,
): Promise<DoublonsClient["email"]> {
  const categorie = `email:${event.category}`;
  if (dedupKey && (await isDuplicate(categorie, dedupKey, TTL_DOUBLON_SEC))) return "deduped";
  const liberer = async (): Promise<void> => {
    if (dedupKey) await libererDedup(categorie, dedupKey);
  };
  try {
    const r = resumerDemande(event);
    const quand =
      "submittedAt" in event.payload && event.payload.submittedAt
        ? event.payload.submittedAt
        : new Date();
    // Le lien voyage HORS de `lignes` (il devient le bouton) : on retire seulement la ligne
    // exacte que `lignesDetailClient` a construite, jamais une ligne du texte du visiteur.
    const ligneFiche = (l: string): boolean =>
      l === `Fiche : ${r.fiche}` || l === `Console : ${r.fiche}`;
    // Le lien d'annulation du client (Calendly) donne la main sur SON rendez-vous : il reste dans
    // la conversation privée Telegram, jamais dans un e-mail à la boîte de contact. Même technique :
    // seule la ligne exacte construite par `lignesDetailClient` part, jamais une ligne du visiteur.
    const cancelUrl =
      "cancelUrl" in event.payload && typeof event.payload.cancelUrl === "string"
        ? event.payload.cancelUrl
        : undefined;
    const ligneAnnulation = (l: string): boolean =>
      cancelUrl !== undefined && l === ligne("Annuler / déplacer", cancelUrl);
    const payload: Record<string, unknown> = {
      canal: r.canal,
      evenement: r.evenement,
      typeDemande: r.typeDemande,
      // Clé facultative : un ancien worker l'ignore et rend l'objet d'avant.
      ...(r.libelleType ? { libelleType: r.libelleType } : {}),
      nom: r.nom ?? r.entreprise ?? "",
      recuLe: formatParisDateTime(quand),
      lignes: lignesDetailClient(event).filter((l) => !ligneFiche(l) && !ligneAnnulation(l)),
      ...(r.fiche ? { consoleUrl: r.fiche } : {}),
    };
    // Le jour dans le jobId : BullMQ garde les jobs terminés 7 jours, l'anti-doublon 24 h. Sans
    // le jour, un rejeu entre les deux renverrait « enqueued » sans e-mail.
    const jobId = dedupKey
      ? `alerte-client-${createHash("sha256").update(`${event.category}|${dedupKey}|${jourParis()}`).digest("hex").slice(0, 40)}`
      : undefined;
    const enqueueEmail = await chargerEnfileurEmail();
    if (!enqueueEmail) {
      // Aucun point d'entrée n'a posé de chargeur (script isolé) : l'e-mail ne partira pas.
      await tracerEchec("aucun enfileur d'e-mail posé : e-mail non enfilé");
      await liberer();
      return "failed";
    }
    const res = await enqueueEmail(
      "alerte-demande-client",
      destinataireAlertesClients(),
      "fr",
      payload,
      {
        ...(jobId ? { jobId } : {}),
        entityType: "NotificationClient",
        entityId: entiteDeLAlerte(event.category, dedupKey),
        clientId: null,
      },
    );
    if (res.enqueued) return "queued";
    // Rien n'est parti : retenu, corbeille indisponible, essai bloqué, garé « au lieu de partir »
    // ou file absente. Échec signalé, clé libérée (un rejeu peut réessayer).
    const motif = res.retenu
      ? "retenu"
      : res.corbeilleIndisponible
        ? "corbeille indisponible"
        : res.essaiBloque
          ? "essai bloqué"
          : res.garePourValidation
            ? "garé au lieu de partir"
            : "non enfilé";
    await tracerEchec(`e-mail non parti (${motif})`);
    await liberer();
    return "failed";
  } catch {
    await tracerEchec("exception à l'enfilage de l'e-mail");
    await liberer();
    return "failed";
  }
}

/**
 * Double une demande de client : conversation privée Telegram + e-mail instantané.
 * Ne lève jamais ; les deux envois sont indépendants.
 */
export async function doublerAlerteClient(
  event: EvenementClient,
  dedupKey: string | undefined,
): Promise<DoublonsClient> {
  const [prive, email] = await Promise.all([
    doublerSurTelegram(event, dedupKey).catch((): DoublonsClient["prive"] => "failed"),
    doublerParEmail(event, dedupKey).catch((): DoublonsClient["email"] => "failed"),
  ]);
  return { prive, email };
}

// ─────────────────────────────────────────────────────────────────────────────
// L6d — Le doublon d'une RÉCLAMATION déposée (canal « reclamation »).
//
// Contenu : numéro, date de réception, lien de la fiche. JAMAIS le texte de la réclamation ni les
// coordonnées du déposant (e-mail comme Telegram). Clé de dédoublonnage = identifiant de la
// réclamation : un rejeu du dépôt ne renvoie pas une seconde alerte. Ne lève jamais.
// ─────────────────────────────────────────────────────────────────────────────

export interface AlerteReclamation {
  /** Identifiant de la réclamation : clé de dédoublonnage. */
  readonly id: string;
  readonly numero: string;
  readonly recueLe: Date;
}

/** Lien de la fiche en console (registre des réclamations), construit comme les autres alertes. */
export function lienFicheReclamation(): string {
  return lienConsole("qualiopi/reclamations");
}

export function formatDoublonReclamation(a: AlerteReclamation): string {
  const lignes: string[] = [
    `🚨 IMPORTANT — DEMANDE CLIENT · ${SUITE_OBJET.reclamation.nouveau}`,
    `Réclamation ${a.numero}`,
    `Reçu le ${formatParisDateTime(a.recueLe)} (heure de Paris)`,
    `Fiche : ${lienFicheReclamation()}`,
  ];
  return compacter(lignes).join("\n").slice(0, MAX_TELEGRAM);
}

async function doublerReclamationSurTelegram(
  a: AlerteReclamation,
): Promise<DoublonsClient["prive"]> {
  const cible = resolveConversationPrivee();
  if (!cible) return "skipped";
  const categorie = "prive:RECLAMATION_DEPOSEE";
  if (await isDuplicate(categorie, a.id, TTL_DOUBLON_SEC)) return "deduped";
  let ok = false;
  let motif = "envoi refusé par Telegram";
  try {
    ok = await sendTelegramRaw({
      text: formatDoublonReclamation(a),
      brut: true,
      silent: false,
      sansApercuLien: true,
      chatId: cible.chatId,
      botToken: cible.botToken,
    });
  } catch {
    ok = false;
    motif = "exception à l'envoi Telegram";
  }
  if (!ok) {
    await tracerEchec(`réclamation : conversation privée non prévenue (${motif})`);
    await libererDedup(categorie, a.id);
  }
  return ok ? "sent" : "failed";
}

async function doublerReclamationParEmail(a: AlerteReclamation): Promise<DoublonsClient["email"]> {
  const categorie = "email:RECLAMATION_DEPOSEE";
  if (await isDuplicate(categorie, a.id, TTL_DOUBLON_SEC)) return "deduped";
  try {
    const payload: Record<string, unknown> = {
      canal: "reclamation",
      evenement: "nouveau",
      typeDemande: "Réclamation",
      nom: "",
      recuLe: formatParisDateTime(a.recueLe),
      lignes: [`Numéro : ${a.numero}`],
      consoleUrl: lienFicheReclamation(),
    };
    const jobId = `alerte-client-${createHash("sha256").update(`RECLAMATION_DEPOSEE|${a.id}|${jourParis()}`).digest("hex").slice(0, 40)}`;
    const enqueueEmail = await chargerEnfileurEmail();
    if (!enqueueEmail) {
      await tracerEchec("réclamation : aucun enfileur d'e-mail posé");
      await libererDedup(categorie, a.id);
      return "failed";
    }
    const res = await enqueueEmail(
      "alerte-demande-client",
      destinataireAlertesClients(),
      "fr",
      payload,
      {
        jobId,
        entityType: "NotificationClient",
        entityId: entiteDeLAlerte("RECLAMATION_DEPOSEE", a.id),
        clientId: null,
      },
    );
    if (res.enqueued) return "queued";
    await tracerEchec("réclamation : e-mail non parti");
    await libererDedup(categorie, a.id);
    return "failed";
  } catch {
    await tracerEchec("réclamation : exception à l'enfilage de l'e-mail");
    await libererDedup(categorie, a.id);
    return "failed";
  }
}

/** Double une réclamation déposée : conversation privée Telegram + e-mail. Ne lève jamais. */
export async function doublerAlerteReclamation(a: AlerteReclamation): Promise<DoublonsClient> {
  const [prive, email] = await Promise.all([
    doublerReclamationSurTelegram(a).catch((): DoublonsClient["prive"] => "failed"),
    doublerReclamationParEmail(a).catch((): DoublonsClient["email"] => "failed"),
  ]);
  return { prive, email };
}
