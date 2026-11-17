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
import type { Prisma } from "../../../prisma/generated/client";
import { decryptPii } from "@/lib/pii-crypto";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { destinataireAlertesClients } from "@/lib/destinataires-internes";
import { dateDeMiseAEcart } from "@/server/email/verdict-envoi";
import { categorieAlerteCalendly } from "@/server/calendly/categorie-alerte";
import { estCategorieClient } from "@/server/notifications/routing";
import { tracerEchec as tracerEchecAvecPrefixe } from "@/server/notifications/doublon-client";
import { chargerEnfileurEmail } from "@/server/notifications/enfileur-email";
import { formatParisDateTime } from "@/server/notifications/format";
import { ligne } from "@/server/notifications/texte-brut";
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
import { bornesVeilleParis, jourParis, type BornesVeille } from "./bornes-paris";

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
  /**
   * L5a — CLÉ FACULTATIVE : demandes de formulaire restées « nouvelles » depuis plus de 2 jours
   * ouvrés (lundi à vendredi, jours fériés NON exclus) et moins de 30 jours, 10 au plus. Un ancien
   * worker qui ne connaît pas la clé l'ignore : le récap reste celui d'avant. Absente quand il n'y a rien.
   */
  enAttente?: ElementRecap[];
  /** L5a — FACULTATIVE : la section n'a pas pu être calculée ce matin (panne de lecture). */
  enAttenteIndisponible?: true;
  /** L5a — FACULTATIVE : demandes en attente dont le nom ne se déchiffre pas (comptées, jamais perdues). */
  enAttenteIllisibles?: number;
  /** L5a — FACULTATIVE : demandes en attente (au-delà des 10 listées) lues mais non listées. */
  enAttenteNonListees?: number;
  /** L5a — FACULTATIVE : le plafond de lecture est atteint sans avoir 10 demandes : liste peut-être incomplète. */
  enAttenteIncomplete?: true;
  /** L5a — FACULTATIVE : demandes d'une personne mise à l'écart (demande d'effacement) : aucun envoi possible. */
  enAttenteEcartees?: number;
  /** Total annoncé dans l'objet : messages + rendez-vous de clients (hors « Autres »). */
  total: number;
}

const net = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** Retire UNIQUEMENT la ligne exacte que `lignesDetailClient` a construite (le lien devient le bouton). */
function sansLigneFiche(lignes: string[], fiche: string, cancelUrl?: string): string[] {
  // Le lien d'annulation du client reste dans Telegram privé : jamais dans un e-mail à contact@.
  const annulation = cancelUrl ? ligne("Annuler / déplacer", cancelUrl) : null;
  return lignes.filter(
    (l) => l !== `Fiche : ${fiche}` && l !== `Console : ${fiche}` && l !== annulation,
  );
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
    lignes: sansLigneFiche(
      lignesDetailClient(event),
      fiche,
      "cancelUrl" in event.payload && typeof event.payload.cancelUrl === "string"
        ? event.payload.cancelUrl
        : undefined,
    ),
    consoleUrl: fiche,
  };
}

function lireDetails(details: unknown): Record<string, unknown> {
  return details !== null && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

const chaine = (v: unknown): string | undefined => (typeof v === "string" ? net(v) : undefined);

/**
 * Une demande de client ? Absence de type de formulaire = demande client (chatbot, ancienne demande).
 * `simulateur_roi` part en temps réel comme `CONTACT_FORM_SUBMITTED` (`roi-report/actions.ts`). Un type
 * INCONNU retombe sur `categorieDemandeSansType` (donc traité comme client) : on n'écarte que les
 * catégories CONNUES hors clients (presse, recrutement, investisseur…).
 */
export function categorieSubmission(details: Record<string, unknown>): NotificationCategory {
  const type = chaine(details["unifiedType"]);
  if (!type) return categorieDemandeSansType;
  if (type === "simulateur_roi") return "CONTACT_FORM_SUBMITTED";
  // La table n'a pas de cas par défaut : un type inconnu donne `undefined` à l'exécution.
  return notifCategoryFor(type as UnifiedContactType) ?? categorieDemandeSansType;
}

/**
 * Un prospect du chatbot (`capturer-lead.ts` écrit `details: { besoin, canal: "chatbot" }`). Seul
 * `canal` compte : `details.source` est un champ caché LIBRE du formulaire public. Et seulement sans
 * type de formulaire : une demande « presse » ou « recrutement » ne devient jamais un lead.
 */
function estLeadChatbot(details: Record<string, unknown>): boolean {
  return chaine(details["canal"]) === "chatbot" && !chaine(details["unifiedType"]);
}

/** Plafond de la section « En attente de votre réponse ». */
export const PLAFOND_EN_ATTENTE = 10;
/** Lignes lues au plus (par pages) pour trouver ces demandes. */
export const PLAFOND_LECTURE_EN_ATTENTE = 200;
const TAILLE_PAGE_EN_ATTENTE = 50;
/** Ancienneté minimale (jours ouvrés, STRICTEMENT plus de) et maximale (jours calendaires). */
export const JOURS_OUVRES_MINIMUM = 2;
export const JOURS_MAXIMUM = 30;

/**
 * Jours ouvrés écoulés entre le jour de réception (exclu) et aujourd'hui (inclus), en jours de
 * Paris. Lundi à vendredi ; les jours fériés ne sont PAS exclus. Pur : les jours sont « AAAA-MM-JJ ».
 */
export function joursOuvresEcoules(recu: string, aujourdhui: string): number {
  const [y1, m1, d1] = recu.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = aujourdhui.split("-").map(Number) as [number, number, number];
  const fin = Date.UTC(y2, m2 - 1, d2);
  let n = 0;
  for (let t = Date.UTC(y1, m1 - 1, d1 + 1); t <= fin; t += 86_400_000) {
    const j = new Date(t).getUTCDay();
    if (j !== 0 && j !== 6) n += 1;
  }
  return n;
}

interface EnAttente {
  elements: ElementRecap[];
  illisibles: number;
  nonListees: number;
  ecartees: number;
  incomplete: boolean;
}

/**
 * Demandes de formulaire « en attente », plus de 2 jours ouvrés après leur arrivée.
 *
 * « En attente » = non archivée, hors corbeille, ET
 *   · statut « new » avec `needsAttention` (une demande traitée, ou « répondu ailleurs », sort) ;
 *   · OU aucune réponse `sent` et au moins une réponse `failed` (le client n'a rien reçu). Ce second
 *     cas ne peut pas exiger `needsAttention` : créer une réponse le passe à `false` et un échec
 *     d'envoi ne le rétablit pas. Une réponse seulement `pending` ne remet rien dans la liste.
 *
 * Lecture seule, par pages de 50 (curseur `submittedAt` puis `id`, du plus ancien au plus récent),
 * jusqu'à 10 demandes retenues ou 200 lignes lues. Les filtres faits ensuite dans le code (catégorie
 * client, jours ouvrés exacts, effacement, mise à l'écart) peuvent écarter des lignes : d'où les pages.
 * Une ligne retenue coûte UNE lecture de plus (`dateDeMiseAEcart`, `findFirst`). Aucun texte du
 * visiteur n'en sort ; l'adresse déchiffrée pour ce contrôle ne quitte jamais la boucle.
 */
async function collecterEnAttente(maintenant: Date): Promise<EnAttente> {
  const aujourdhui = jourParis(maintenant);
  const trenteJours = new Date(maintenant.getTime() - JOURS_MAXIMUM * 86_400_000);
  // Pré-filtre de calendrier (2 jours ouvrés = au moins 2 jours) ; le compte exact est fait en JS.
  const deuxJours = new Date(maintenant.getTime() - JOURS_OUVRES_MINIMUM * 86_400_000);
  const base: Prisma.SubmissionWhereInput = {
    deletedAt: null,
    archivedAt: null,
    submittedAt: { gte: trenteJours, lte: deuxJours },
    OR: [
      { status: "new", needsAttention: true },
      {
        status: { in: ["new", "in_progress"] },
        replies: { some: { deliveryStatus: "failed" }, none: { deliveryStatus: "sent" } },
      },
    ],
  };
  const elements: ElementRecap[] = [];
  let illisibles = 0;
  let nonListees = 0;
  let ecartees = 0;
  let lues = 0;
  let curseur: { submittedAt: Date; id: string } | null = null as {
    submittedAt: Date;
    id: string;
  } | null;
  let incomplete = false;
  for (;;) {
    const apres: Prisma.SubmissionWhereInput | null = curseur
      ? {
          OR: [
            { submittedAt: { gt: curseur.submittedAt } },
            { submittedAt: curseur.submittedAt, id: { gt: curseur.id } },
          ],
        }
      : null;
    const lignes = await prisma.submission.findMany({
      where: apres ? { AND: [base, apres] } : base,
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: Math.min(TAILLE_PAGE_EN_ATTENTE, PLAFOND_LECTURE_EN_ATTENTE - lues),
    });
    lues += lignes.length;
    for (const s of lignes) {
      curseur = { submittedAt: s.submittedAt, id: s.id };
      // Effacement RGPD ancien (art. 17) : la ligne reste mais n'a plus rien à dire.
      if (s.contactName === ERASED_PLACEHOLDER) continue;
      const ouvres = joursOuvresEcoules(jourParis(s.submittedAt), aujourdhui);
      if (ouvres <= JOURS_OUVRES_MINIMUM) continue;
      const details = lireDetails(s.details);
      const category: NotificationCategory = estLeadChatbot(details)
        ? "CHATBOT_LEAD_CAPTURED"
        : categorieSubmission(details);
      if (!estCategorieClient(category)) continue;
      if (elements.length >= PLAFOND_EN_ATTENTE) {
        nonListees += 1;
        continue;
      }
      let nom: string | undefined;
      let adresse: string | undefined;
      try {
        nom = net(decryptPii(s.contactName));
        adresse = net(decryptPii(s.contactEmail));
      } catch {
        illisibles += 1;
        continue;
      }
      // Personne mise à l'écart après une demande d'effacement : jamais listée par son nom.
      if (adresse && (await dateDeMiseAEcart(adresse, "recap-demandes-clients")) !== null) {
        ecartees += 1;
        continue;
      }
      const event = {
        category,
        payload: { submissionId: s.id, formType: chaine(details["unifiedType"]) ?? "" },
      } as EvenementClient;
      elements.push({
        type: libelleTypeDemande(event),
        nom: nom ?? "",
        quand: formatParisDateTime(s.submittedAt),
        lignes: [`En attente depuis ${ouvres} jours ouvrés`],
        consoleUrl: lienFicheClient(event),
      });
    }
    if (elements.length >= PLAFOND_EN_ATTENTE) break;
    if (lignes.length < TAILLE_PAGE_EN_ATTENTE) break; // plus rien à lire
    if (lues >= PLAFOND_LECTURE_EN_ATTENTE) {
      incomplete = true;
      break;
    }
  }
  return { elements, illisibles, nonListees, ecartees, incomplete };
}

/** Lit la veille. Lecture seule ; ne lève que si la base est injoignable (l'appelant le trace). */
export async function collecterDemandesVeille(
  maintenant: Date = new Date(),
): Promise<DemandesVeille> {
  const bornes = bornesVeilleParis(maintenant);
  return collecterPourBornes(bornes, maintenant);
}

export async function collecterPourBornes(
  bornes: BornesVeille,
  maintenant?: Date,
): Promise<DemandesVeille> {
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
    const chatbot = estLeadChatbot(details);
    // Même événement que l'alerte en temps réel du chatbot : il porte le besoin du prospect.
    const category: NotificationCategory = chatbot
      ? "CHATBOT_LEAD_CAPTURED"
      : categorieSubmission(details);
    const message = chaine(details["message"]) ?? chaine(details["besoin"]);
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
        ...(message ? { message } : {}),
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
    // Effacement RGPD (art. 17) : la ligne reste en base, mais n'a plus rien à dire au récap.
    if (r.inviteeName === ERASED_PLACEHOLDER) continue;
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

  // L5a : section facultative. Un échec ici ne doit JAMAIS faire perdre le récap de la veille.
  let enAttente: EnAttente | null = null;
  let enAttenteIndisponible = false;
  if (maintenant) {
    try {
      enAttente = await collecterEnAttente(maintenant);
    } catch {
      // Message fixe : aucune donnée de personne, pas l'erreur de la base.
      enAttenteIndisponible = true;
      await tracerEchec("section « en attente » non calculée");
    }
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
    ...(enAttente && enAttente.elements.length > 0 ? { enAttente: enAttente.elements } : {}),
    ...(enAttenteIndisponible ? { enAttenteIndisponible: true as const } : {}),
    ...(enAttente && enAttente.illisibles > 0 ? { enAttenteIllisibles: enAttente.illisibles } : {}),
    ...(enAttente && enAttente.nonListees > 0 ? { enAttenteNonListees: enAttente.nonListees } : {}),
    ...(enAttente?.incomplete ? { enAttenteIncomplete: true as const } : {}),
    ...(enAttente && enAttente.ecartees > 0 ? { enAttenteEcartees: enAttente.ecartees } : {}),
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
      await tracerEchec("aucun enfileur d'e-mail posé");
      return "failed";
    }
    const donnees = await collecterPourBornes(bornes, maintenant);
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
      `non parti (${
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
    await tracerEchec("exception à la lecture ou à l'enfilage");
    return "failed";
  }
}
