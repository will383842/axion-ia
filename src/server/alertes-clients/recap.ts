// Le RÉCAP QUOTIDIEN des demandes de clients (PR C du chantier « alertes clients »).
//
// Chaque jour à 7 h 30 (heure de Paris), le fondateur reçoit par e-mail tout ce qui est arrivé la
// VEILLE, même quand il n'y a rien (« aucune demande » : le signal de vie qui dit que la chaîne
// tourne). C'est aussi le filet du doublon instantané (`notifications/doublon-client.ts`) : un
// doublon raté se retrouve ici.
//
// Sources : `Submission` (formulaires, hors corbeille), `ChatEscalation` (questions du chatbot sans
// réponse), `CalendlyEvent` (réservations et annulations ; les rendez-vous qui ne sont pas ceux de
// clients — apporteur, formateur — vont dans une section « Autres rendez-vous »).
//
// Garanties :
//   - UN envoi par jour : `jobId` = `recap-demandes-clients-<jour de la veille>` ;
//   - aucune donnée de visiteur dans une URL : le lien d'une fiche vient de `lienFicheClient`
//     (construit sur les identifiants), jamais d'un texte saisi ;
//   - le texte saisi par un visiteur reste du TEXTE : le gabarit l'échappe (React) ;
//   - lecture seule : rien n'est supprimé, rien n'est modifié.
//
// ⚠️ Pas d'import de `queues.ts` (même raison que `doublon-client.ts`) : l'enfileur vient du
// registre `enfileur-email.ts`, que `queues.ts` pose au chargement du worker.
//
// ⚠️ Contrat app ↔ worker : le gabarit `recap-demandes-clients` est NOUVEAU et n'est enfilé que par
// le worker, qui l'interprète depuis les sources : rien à tolérer côté app.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { destinataireAlertesClients } from "@/lib/destinataires-internes";
import { categorieAlerteCalendly } from "@/server/calendly/categorie-alerte";
import { estCategorieClient } from "@/server/notifications/routing";
import { tracerEchec as tracerEchecAvecPrefixe } from "@/server/notifications/doublon-client";
import { chargerEnfileurEmail } from "@/server/notifications/enfileur-email";
import { formatParisDateTime } from "@/server/notifications/format";
import {
  libelleTypeDemande,
  lienFicheClient,
  lignesDetailClient,
  type EvenementClient,
  type EvenementCalendlyNonClient,
} from "@/server/notifications/format-clients";
import type { NotificationCategory } from "@/server/notifications";
import {
  categorieDemandeSansType,
  notifCategoryFor,
} from "@/features/unified-contact/categorie-notification";
import type { UnifiedContactType } from "@/lib/schemas/unified-contact-schema";
import { bornesVeilleParis, type BornesVeille } from "./bornes-paris";

/** Trace un échec du récap (messages fixes, sans donnée personnelle) avec son propre préfixe. */
const tracerEchec = (message: string): Promise<void> =>
  tracerEchecAvecPrefixe(message, {
    journal: "[notif:recap]",
    incident: "Récap quotidien des demandes de clients :",
  });

/** Plafond par source : au-delà, le récap le dit (« N autres non listées ») au lieu de grossir sans fin. */
export const PLAFOND_PAR_SOURCE = 200;

/** Une ligne du récap : tout ce que le gabarit affiche, en texte brut, sérialisable. */
export interface ElementRecap {
  /** « Audit IA », « Rendez-vous annulé »… */
  type: string;
  nom: string;
  /** Quand, en clair, heure de Paris. */
  quand: string;
  /** Vrai quand l'heure est une approximation (annulation Calendly : dernière mise à jour de la ligne). */
  approximatif?: boolean;
  /** Le détail complet (texte brut, hors ligne de fiche). */
  lignes: string[];
  /** Lien de la fiche dans la console, construit par `lienFicheClient`. */
  consoleUrl?: string;
}

export interface DemandesVeille {
  jour: string;
  jourCourt: string;
  jourLong: string;
  /** Messages (formulaires, chatbot). */
  demandes: ElementRecap[];
  /** Rendez-vous de clients : réservations et annulations. */
  rendezVous: ElementRecap[];
  /** Rendez-vous qui ne sont pas ceux d'un client (apporteur, formateur). */
  autresRendezVous: ElementRecap[];
  /** Demandes lues mais non listées (plafond atteint), par section. */
  nonListees: { demandes: number; rendezVous: number; autresRendezVous: number };
  /** Lignes illisibles (déchiffrement impossible) : comptées, jamais perdues en silence. */
  illisibles: number;
  /** Total annoncé dans l'objet : messages + rendez-vous de clients (hors « Autres »). */
  total: number;
}

const net = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** Retire UNIQUEMENT la ligne exacte que `lignesDetailClient` a construite (le lien devient le bouton). */
function sansLigneFiche(lignes: string[], fiche: string): string[] {
  return lignes.filter((l) => l !== `Fiche : ${fiche}` && l !== `Console : ${fiche}`);
}

function elementDe(
  event: EvenementClient | EvenementCalendlyNonClient,
  c: { type: string; nom: string; quand: Date; approximatif?: boolean },
): ElementRecap {
  const fiche = lienFicheClient(event);
  return {
    type: c.type,
    nom: c.nom,
    quand: formatParisDateTime(c.quand),
    ...(c.approximatif ? { approximatif: true } : {}),
    lignes: sansLigneFiche(lignesDetailClient(event), fiche),
    consoleUrl: fiche,
  };
}

function lireDetails(details: unknown): Record<string, unknown> {
  return details !== null && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

const chaine = (v: unknown): string | undefined => (typeof v === "string" ? net(v) : undefined);

/** Une demande de client ? Absence de type de formulaire = demande client (chatbot, ancienne demande). */
export function categorieSubmission(details: Record<string, unknown>): NotificationCategory {
  const type = chaine(details["unifiedType"]);
  return type ? notifCategoryFor(type as UnifiedContactType) : categorieDemandeSansType;
}

/** Lit la veille. Lecture seule ; ne lève que si la base est injoignable (l'appelant le trace). */
export async function collecterDemandesVeille(
  maintenant: Date = new Date(),
): Promise<DemandesVeille> {
  const bornes = bornesVeilleParis(maintenant);
  return collecterPourBornes(bornes);
}

export async function collecterPourBornes(bornes: BornesVeille): Promise<DemandesVeille> {
  const dansLaVeille = { gte: bornes.debut, lt: bornes.fin };
  const demandes: ElementRecap[] = [];
  const rendezVous: ElementRecap[] = [];
  const autresRendezVous: ElementRecap[] = [];
  const nonListees = { demandes: 0, rendezVous: 0, autresRendezVous: 0 };
  let illisibles = 0;

  // ── Formulaires ────────────────────────────────────────────────────────────
  const submissions = await prisma.submission.findMany({
    where: { deletedAt: null, submittedAt: dansLaVeille },
    orderBy: { submittedAt: "asc" },
  });
  const demandesClient: Array<{ q: Date; e: ElementRecap }> = [];
  for (const s of submissions) {
    const details = lireDetails(s.details);
    const category = categorieSubmission(details);
    if (!estCategorieClient(category)) continue; // presse, recrutement, investisseur… : pas un client
    let nom: string | undefined;
    let entreprise: string | undefined;
    let email: string | undefined;
    let telephone: string | undefined;
    try {
      nom = net(decryptPii(s.contactName));
      entreprise = net(decryptPii(s.companyName));
      email = net(decryptPii(s.contactEmail));
      telephone = net(decryptPii(s.contactPhone));
    } catch {
      // Falsification ou clé absente : on le compte et on le dit, sans jamais afficher le chiffré.
      illisibles += 1;
      continue;
    }
    const event = {
      category,
      payload: {
        submissionId: s.id,
        contactName: nom ?? "",
        contactEmail: email ?? "",
        ...(telephone ? { contactPhone: telephone } : {}),
        formType: chaine(details["unifiedType"]) ?? "",
        ...(entreprise && entreprise !== "—" ? { companyName: entreprise } : {}),
        ...(chaine(details["ville"]) ? { ville: chaine(details["ville"])! } : {}),
        ...(chaine(details["subType"]) ? { subType: chaine(details["subType"])! } : {}),
        ...(chaine(details["message"]) ? { message: chaine(details["message"])! } : {}),
        ...(chaine(details["budgetIndicative"])
          ? { budgetIndicative: chaine(details["budgetIndicative"])! }
          : {}),
        ...(chaine(details["timingWeeks"]) ? { timingWeeks: chaine(details["timingWeeks"])! } : {}),
        ...(chaine(details["source"]) ? { source: chaine(details["source"])! } : {}),
        ...(s.sector ? { companySector: s.sector } : {}),
        ...(s.employeesCount ? { companySize: s.employeesCount } : {}),
        locale: s.locale === "en" ? "en" : "fr",
        submittedAt: s.submittedAt.toISOString(),
      },
    } as EvenementClient;
    demandesClient.push({
      q: s.submittedAt,
      e: elementDe(event, {
        type: libelleTypeDemande(event),
        nom: [nom, entreprise && entreprise !== "—" ? entreprise : undefined]
          .filter((v): v is string => v !== undefined)
          .join(" — "),
        quand: s.submittedAt,
      }),
    });
  }

  // ── Questions du chatbot restées sans réponse ──────────────────────────────
  const escalades = await prisma.chatEscalation.findMany({
    where: { createdAt: dansLaVeille },
    orderBy: { createdAt: "asc" },
  });
  for (const x of escalades) {
    const event: EvenementClient = {
      category: "CHATBOT_ESCALATION",
      payload: {
        escalationId: x.id,
        question: x.question,
        ...(net(x.contexte) ? { contexte: net(x.contexte)! } : {}),
        ...(net(x.contactEmail) ? { contactEmail: net(x.contactEmail)! } : {}),
        submittedAt: x.createdAt.toISOString(),
      },
    };
    demandesClient.push({
      q: x.createdAt,
      e: elementDe(event, {
        type: libelleTypeDemande(event),
        nom: net(x.contactEmail) ?? "",
        quand: x.createdAt,
      }),
    });
  }
  demandesClient.sort((a, b) => a.q.getTime() - b.q.getTime());
  for (const { e } of demandesClient) {
    if (demandes.length < PLAFOND_PAR_SOURCE) demandes.push(e);
    else nonListees.demandes += 1;
  }

  // ── Rendez-vous Calendly ───────────────────────────────────────────────────
  const rdvs = await prisma.calendlyEvent.findMany({
    where: {
      OR: [{ capturedAt: dansLaVeille }, { status: "canceled", updatedAt: dansLaVeille }],
    },
    orderBy: { capturedAt: "asc" },
  });
  const lignesRdv: Array<{ q: number; client: boolean; e: ElementRecap }> = [];
  for (const r of rdvs) {
    const classement = { typeRendezVous: r.typeRendezVous, eventTypeName: r.eventTypeName };
    const base = {
      eventUri: r.id,
      inviteeEmail: r.inviteeEmail ?? "",
      inviteeName: r.inviteeName ?? "",
      eventName: r.eventTypeName,
      ...(r.typeRendezVous ? { typeRendezVous: r.typeRendezVous } : {}),
      ...(r.inviteePhone ? { inviteePhone: r.inviteePhone } : {}),
    };
    const nom = net(r.inviteeName) ?? net(r.inviteeEmail) ?? "";
    // La même règle que les alertes : `categorieAlerteCalendly` dit client ou non.
    const client = categorieAlerteCalendly("reservation", classement) === "CLIENT_CALL_BOOKED";
    if (r.capturedAt >= bornes.debut && r.capturedAt < bornes.fin) {
      const event = {
        category: categorieAlerteCalendly("reservation", classement),
        payload: {
          ...base,
          eventStartTime: r.startTime?.toISOString() ?? "(voir mail Calendly)",
          ...(r.location ? { lieu: r.location } : {}),
          ...(r.cancelUrl ? { cancelUrl: r.cancelUrl } : {}),
          ...(r.pageUrl ? { pageUrl: r.pageUrl } : {}),
          ...(r.utmSource ? { utmSource: r.utmSource } : {}),
          ...(r.utmCampaign ? { utmCampaign: r.utmCampaign } : {}),
          ...(r.utmMedium ? { utmMedium: r.utmMedium } : {}),
        },
      } as EvenementClient | EvenementCalendlyNonClient;
      lignesRdv.push({
        q: r.capturedAt.getTime(),
        client,
        e: elementDe(event, {
          type: client
            ? libelleTypeDemande(event as EvenementClient)
            : `Rendez-vous : ${net(r.eventTypeName) ?? "autre"}`,
          nom,
          quand: r.capturedAt,
        }),
      });
    }
    if (r.status === "canceled" && r.updatedAt >= bornes.debut && r.updatedAt < bornes.fin) {
      const event = {
        category: categorieAlerteCalendly("annulation", classement),
        payload: {
          ...base,
          ...(r.startTime ? { eventStartTime: r.startTime.toISOString() } : {}),
        },
      } as EvenementClient | EvenementCalendlyNonClient;
      lignesRdv.push({
        q: r.updatedAt.getTime(),
        client,
        e: elementDe(event, {
          type: `Annulation — ${
            client
              ? libelleTypeDemande(event as EvenementClient)
              : (net(r.eventTypeName) ?? "rendez-vous")
          }`,
          nom,
          // Calendly (offre gratuite) ne dit pas QUAND on annule : on lit la dernière mise à jour
          // de la ligne, qui peut suivre l'annulation (une note ajoutée après, par exemple).
          quand: r.updatedAt,
          approximatif: true,
        }),
      });
    }
  }
  lignesRdv.sort((a, b) => a.q - b.q);
  for (const { client, e } of lignesRdv) {
    const cible = client ? rendezVous : autresRendezVous;
    if (cible.length < PLAFOND_PAR_SOURCE) cible.push(e);
    else nonListees[client ? "rendezVous" : "autresRendezVous"] += 1;
  }

  return {
    jour: bornes.jour,
    jourCourt: bornes.jourCourt,
    jourLong: bornes.jourLong,
    demandes,
    rendezVous,
    autresRendezVous,
    nonListees,
    illisibles,
    total:
      demandes.length +
      rendezVous.length +
      nonListees.demandes +
      nonListees.rendezVous +
      illisibles,
  };
}

/** La charge de l'e-mail : texte brut sérialisable (le gabarit échappe tout). */
export function payloadRecap(d: DemandesVeille): Record<string, unknown> {
  return { ...d };
}

/** « recap-demandes-clients-2026-11-13 » : un seul envoi par jour (BullMQ ignore un jobId déjà vu). */
export function jobIdRecap(jour: string): string {
  return `recap-demandes-clients-${jour}`;
}

export type ResultatRecap = "queued" | "failed";

/**
 * Envoie le récap de la veille. Idempotent par jour (jobId) : rejouable sans doublon. Ne lève jamais :
 * un échec est tracé (journal + Sentry, sans donnée de personne) et rendu `failed`.
 */
export async function envoyerRecapVeille(maintenant: Date = new Date()): Promise<ResultatRecap> {
  const bornes = bornesVeilleParis(maintenant);
  try {
    const enqueueEmail = await chargerEnfileurEmail();
    if (!enqueueEmail) {
      await tracerEchec("récap quotidien : aucun enfileur d'e-mail posé");
      return "failed";
    }
    const donnees = await collecterPourBornes(bornes);
    const res = await enqueueEmail(
      "recap-demandes-clients",
      destinataireAlertesClients(),
      "fr",
      payloadRecap(donnees),
      {
        jobId: jobIdRecap(bornes.jour),
        entityType: "RecapClients",
        entityId: bornes.jour,
        clientId: null,
      },
    );
    if (res.enqueued) return "queued";
    await tracerEchec(
      `récap quotidien non parti (${
        res.retenu
          ? "retenu"
          : res.corbeilleIndisponible
            ? "corbeille indisponible"
            : res.essaiBloque
              ? "essai bloqué"
              : res.garePourValidation
                ? "garé au lieu de partir"
                : "non enfilé"
      })`,
    );
    return "failed";
  } catch {
    await tracerEchec("récap quotidien : exception à la lecture ou à l'enfilage");
    return "failed";
  }
}
