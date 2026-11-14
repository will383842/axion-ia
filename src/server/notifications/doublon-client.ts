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
// libérée si l'envoi échoue (un rejeu peut alors réessayer) ; les deux départs sont indépendants.
// Le doublon ne passe jamais par `libererSiEchec` de `notify()` : l'échec d'un doublon ne doit
// pas rouvrir l'alerte du salon (elle serait renvoyée en double).
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
import { formatParisDateTime, humanDateOrText } from "./format";
import { lignesDetailClient, libelleTypeDemande, type EvenementClient } from "./format-clients";
import { isDuplicate, libererDedup } from "./dedup";
import { resolveConversationPrivee } from "./routing";
import { sendTelegramRaw } from "./channels/telegram";
import { signalerIncident } from "./channels/sentry";
import { chargerEnfileurEmail } from "./enfileur-email";
import { compacter } from "./texte-brut";
import type { DoublonsClient } from "./types";

/** Les deux familles d'alerte : un message écrit, ou un rendez-vous Calendly. */
export type CanalDoublon = "message" | "calendly";
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

/** Résume l'événement : qui, quoi, quand, et le lien de la fiche. */
export function resumerDemande(event: EvenementClient): ResumeDemande {
  // Le lien de la fiche est déjà construit, une seule fois, par `lignesDetailClient`.
  const lienLigne = lignesDetailClient(event).find((l) => /^(Fiche|Console) : /.test(l));
  const fiche = lienLigne?.replace(/^(Fiche|Console) : /, "");

  const resume = (
    canal: CanalDoublon,
    evenement: EvenementDoublon,
    c: ChampsPersonne,
  ): ResumeDemande => ({
    canal,
    evenement,
    typeDemande: libelleTypeDemande(event),
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
    `🚨 IMPORTANT — DEMANDE CLIENT · ${SUITE_OBJET[r.canal][r.evenement]}`,
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

/** Objet de l'e-mail, ≤ 45 caractères (le test du gabarit le mesure). */
export function objetAlerteClient(canal: CanalDoublon, evenement: EvenementDoublon): string {
  return `🔴 IMPORTANT DEMANDE CLIENT ${SUITE_OBJET[canal][evenement]}`;
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
  }
  if (!ok && dedupKey) await libererDedup(categorie, dedupKey);
  return ok ? "sent" : "failed";
}

async function doublerParEmail(
  event: EvenementClient,
  dedupKey: string | undefined,
): Promise<DoublonsClient["email"]> {
  const categorie = `email:${event.category}`;
  if (dedupKey && (await isDuplicate(categorie, dedupKey, TTL_DOUBLON_SEC))) return "deduped";
  try {
    const r = resumerDemande(event);
    const quand =
      "submittedAt" in event.payload && event.payload.submittedAt
        ? event.payload.submittedAt
        : new Date();
    const payload: Record<string, unknown> = {
      canal: r.canal,
      evenement: r.evenement,
      typeDemande: r.typeDemande,
      nom: r.nom ?? r.entreprise ?? "",
      recuLe: formatParisDateTime(quand),
      lignes: lignesDetailClient(event),
      ...(r.fiche ? { consoleUrl: r.fiche } : {}),
    };
    const jobId = dedupKey
      ? `alerte-client-${createHash("sha256").update(`${event.category}|${dedupKey}`).digest("hex").slice(0, 40)}`
      : undefined;
    const enfileur = await chargerEnfileurEmail();
    if (!enfileur) {
      // Aucun point d'entrée n'a posé de chargeur (script isolé) : l'e-mail ne partira pas.
      console.error("[notif:doublon] aucun enfileur d'e-mail posé : e-mail NON enfilé");
      await signalerIncident("Doublon e-mail d'une demande de client : aucun enfileur posé");
      if (dedupKey) await libererDedup(categorie, dedupKey);
      return "failed";
    }
    const res = await enfileur(
      "alerte-demande-client",
      destinataireAlertesClients(),
      "fr",
      payload,
      {
        ...(jobId ? { jobId } : {}),
        entityType: "NotificationClient",
        entityId: dedupKey ?? event.category,
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
    console.error(`[notif:doublon] e-mail non parti (${motif})`);
    await signalerIncident(`Doublon e-mail d'une demande de client non parti (${motif})`);
    if (dedupKey) await libererDedup(categorie, dedupKey);
    return "failed";
  } catch {
    if (dedupKey) await libererDedup(categorie, dedupKey);
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
