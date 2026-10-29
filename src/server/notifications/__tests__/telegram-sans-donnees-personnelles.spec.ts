/**
 * Telegram ne reçoit ni coordonnées ni contenu saisi (décision du 11/10/2026).
 *
 * Règle unique pour tout message qui concerne une personne physique :
 * - autorisé : type d'événement, prénom + INITIALE du nom, entreprise, ville,
 *   provenance, montant ou statut, lien vers la fiche console ;
 * - interdit : nom complet, e-mail, téléphone, message libre ou extrait,
 *   rémunération souhaitée, motivation, adresse, IBAN.
 *
 * Deux gardes, parce qu'il y a deux chemins vers Telegram :
 *
 * 1. le hub (`notify()` → `formatNotification`) : chaque catégorie est rendue
 *    avec un payload truffé de données témoins, qui ne doivent pas ressortir.
 *    Le `Record<NotificationCategory, …>` oblige toute nouvelle catégorie à
 *    venir avec son jeu d'essai ;
 * 2. les corps écrits à la main (`sendTelegram`, `legacyBody`, `alertIncident`,
 *    `alertOps`, champs `error` / `title` d'une alerte) partout dans `src/` :
 *    aucune interpolation ne peut y porter un identifiant de coordonnée, de
 *    nom ou de texte saisi, sauf passé par `prenomEtInitiale…`.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { formatNotificationPlain } from "../format";
import { formatNotificationClient, type EvenementClient } from "../format-clients";
import { ALL_NOTIFICATION_CATEGORIES, estCategorieClient, telegramGroupFor } from "../routing";
import type { NotificationCategory, NotificationEvent } from "../types";

// ─── 1. Le hub : rendu de chaque catégorie ──────────────────────────────────

const NOM = "Marie Dupontcanari";
const EMAIL = "marie.canari@exemple.fr";
const TEL = "+33 6 39 98 12 34";
const TEXTE = "TEXTE-SAISI-CANARI";

/** Ce qui ne doit JAMAIS ressortir. */
const INTERDITS = [
  "Dupontcanari",
  "canari@",
  "exemple.fr",
  "6 39 98 12 34",
  "639981234",
  "CANARI",
  "4500 €",
  "12 rue des Témoins",
];

const LEAD = {
  submissionId: "sub_1",
  contactName: NOM,
  contactEmail: EMAIL,
  contactPhone: TEL,
  message: TEXTE,
  ville: "Grenoble",
  companyName: "Exemple SARL",
  source: "linkedin",
  locale: "fr",
};

const CANDIDATURE = {
  applicationId: "app_1",
  contactName: NOM,
  contactEmail: EMAIL,
  contactPhone: TEL,
  offerTitle: "Vidéaste freelance (F/H) — tournage",
  city: "Lyon",
  salaryExpectation: "4500 € PRETENTION-CANARI",
  motivationExcerpt: `${TEXTE} motivation`,
  answers: [{ label: "Prix journée", value: `${TEXTE} 4500 €` }],
  hasCv: true,
  locale: "fr",
};

const PAYLOADS: Record<NotificationCategory, Record<string, unknown>> = {
  CONTACT_FORM_SUBMITTED: { ...LEAD, formType: "contact" },
  AUDIT_REQUEST_SUBMITTED: LEAD,
  INTERVENTION_REQUEST_SUBMITTED: LEAD,
  IMPLEMENTATION_REQUEST_SUBMITTED: LEAD,
  QUOTE_REQUEST_RECEIVED: LEAD,
  PRESS_REQUEST_SUBMITTED: LEAD,
  RECRUITMENT_RECEIVED: LEAD,
  SPEAKER_INVITATION_RECEIVED: LEAD,
  INVESTOR_INQUIRY_RECEIVED: LEAD,
  CUSTOMER_SUPPORT_REQUEST: LEAD,
  JOB_APPLICATION_RECEIVED: CANDIDATURE,
  VIDEO_EDITOR_APPLICATION_RECEIVED: CANDIDATURE,
  COMMERCIAL_APPLICATION_RECEIVED: {
    submissionId: "sub_2",
    contactName: NOM,
    contactEmail: EMAIL,
    contactPhone: TEL,
    ville: "Annecy",
    usesAi: true,
    locale: "fr",
  },
  JOB_OFFERS_STALE: { thresholdDays: 30, offers: [] },
  JOB_APPLICATIONS_STALE: {
    seuilSansReponseJours: 7,
    seuilSansActiviteJours: 14,
    jamaisRepondu: 0,
    sansActivite: 0,
    plafondAtteint: false,
    pires: [],
  },
  REVIEW_SUBMITTED: {
    reviewId: "rev_1",
    authorName: NOM,
    rating: 5,
    companyName: "Exemple SARL",
    hasPhoto: false,
    excerpt: TEXTE,
    locale: "fr",
  },
  PODCAST_REQUEST_SUBMITTED: {
    requestId: "pod_1",
    companyName: "Exemple SARL",
    leaderName: NOM,
    contactEmail: EMAIL,
    contactPhone: TEL,
    city: "Chambéry",
    postalCode: "73000",
    activityExcerpt: TEXTE,
    message: TEXTE,
    locale: "fr",
  },
  RGPD_REQUEST_SUBMITTED: {
    demandeId: "rgpd_1",
    type: "acces",
    traineeNomMasque: "M. D.",
    traineeEmailMasque: "m****@exemple.fr",
    echeance: "11/11/2026",
  },
  NEWSLETTER_PENDING: { email: EMAIL, locale: "fr" },
  NEWSLETTER_CONFIRMED: { email: EMAIL, locale: "fr" },
  NEWSLETTER_UNSUBSCRIBED: { email: EMAIL, locale: "fr" },
  GUIDE_REQUESTED: {
    email: EMAIL,
    locale: "fr",
    source: "accueil",
    lettre: "inscrite",
    envoi: "parti",
    nouvelle: true,
  },
  TOUR_DEMANDE_RECUE: {
    ville: "Lyon",
    villeCle: "lyon",
    comptees: 3,
    seuil: 5,
    compte: true,
  },
  TOUR_VILLE_OUVERTE: { ville: "Lyon", villeCle: "lyon", comptees: 5, seuil: 5 },
  GUIDE_RECAP: { demandes: 1, envois: 1, clics: 0, enAttente: 0, inscriptionsLettre: 0 },
  BOOKING_CREATED: {
    bookingId: "bk_1",
    contactName: NOM,
    contactEmail: EMAIL,
    serviceType: "audit",
  },
  BOOKING_CANCELLED: { bookingId: "bk_1", reason: TEXTE, cancelledBy: "client" },
  OPTION_POSTED: { bookingId: "bk_1" },
  OPTION_CONFIRMED: { bookingId: "bk_1", admin: "Will" },
  OPTION_REFUSED: { bookingId: "bk_1", admin: "Will", reason: TEXTE },
  OPTION_EXPIRED: { bookingId: "bk_1" },
  CALENDLY_INVITEE_CREATED: {
    eventUri: "evt_1",
    inviteeEmail: EMAIL,
    inviteeName: NOM,
    inviteePhone: TEL,
    eventStartTime: "2026-10-12T08:00:00Z",
    eventName: "Appel découverte",
    lieu: "12 rue des Témoins, Grenoble",
    answersText: TEXTE,
  },
  CALENDLY_INVITEE_CANCELED: {
    eventUri: "evt_1",
    inviteeEmail: EMAIL,
    inviteeName: NOM,
    reason: TEXTE,
  },
  // Les catégories CLIENT (décision Will 15/10) : leur gabarit ALLÉGÉ — celui
  // du repli, quand le salon « Clients » n'existe pas encore ou que l'envoi y
  // échoue — ne porte rien non plus. Seul le salon dédié reçoit le détail
  // (`format-clients.ts`, plus bas).
  CLIENT_CALL_BOOKED: {
    eventUri: "evt_1",
    inviteeEmail: EMAIL,
    inviteeName: NOM,
    inviteePhone: TEL,
    eventStartTime: "2026-10-12T08:00:00Z",
    eventName: "Diagnostic IA",
    lieu: "12 rue des Témoins, Grenoble",
    answersText: TEXTE,
  },
  CLIENT_CALL_CANCELED: {
    eventUri: "evt_1",
    inviteeEmail: EMAIL,
    inviteeName: NOM,
    inviteePhone: TEL,
    reason: TEXTE,
    canceledBy: NOM,
  },
  CLIENT_CALL_RESCHEDULED: {
    eventUri: "evt_1",
    inviteeEmail: EMAIL,
    inviteeName: NOM,
    inviteePhone: TEL,
    oldStart: "2026-10-12T08:00:00Z",
    newStart: "2026-10-13T08:00:00Z",
  },
  CHATBOT_LEAD_CAPTURED: {
    submissionId: "sub_3",
    contactName: NOM,
    contactEmail: EMAIL,
    contactPhone: TEL,
    companyName: "Exemple SARL",
    message: TEXTE,
  },
  CHATBOT_ESCALATION: {
    escalationId: "esc_1",
    question: TEXTE,
    contexte: TEXTE,
    contactEmail: EMAIL,
  },
  CALENDLY_INVITEE_RESCHEDULED: {
    eventUri: "evt_1",
    inviteeEmail: EMAIL,
    inviteeName: NOM,
    oldStart: "2026-10-12T08:00:00Z",
    newStart: "2026-10-13T08:00:00Z",
  },
  APPORTEUR_REPLIED: {
    submissionId: "sub_2",
    contactName: NOM,
    subject: TEXTE,
    receivedAt: "2026-10-11T08:00:00Z",
  },
  CANDIDAT_REPLIED: {
    applicationId: "app_1",
    offerTitle: "Vidéaste",
    receivedAt: "2026-10-11T08:00:00Z",
  },
  CANDIDAT_SELF_ERASED: { offerTitle: "Vidéaste", erasedAt: "2026-10-11T08:00:00Z" },
  TRAINER_DOSSIER_RECU: { trainerId: "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13", registre: "vert" },
  // Questionnaire avant audit (2026-10-26) : des champs témoins glissés en trop (nom complet,
  // adresse, texte de réponse) ne doivent JAMAIS ressortir ; seuls ceux du type sont rendus.
  QUESTIONNAIRE_PREAUDIT_REPONSE: {
    evenement: "reponse",
    societe: "OURY CRÉATION",
    qui: "Marie D.",
    parcours: "collaborateur",
    recues: 3,
    attendues: 7,
    dirigeantARepondu: false,
    prochaine: "mer. 4 nov. à 9 h 30",
    chemin: "rendez-vous/rencontres/r1#questionnaire-avant-audit",
    nomComplet: NOM,
    email: EMAIL,
    telephone: TEL,
    reponse: TEXTE,
  },
  QUESTIONNAIRE_PREAUDIT_SUIVI: {
    evenement: "retenu",
    essai: true,
    societe: "OURY CRÉATION",
    motif: "opposition",
    chemin: "rendez-vous/rencontres/r1#questionnaire-avant-audit",
    destinataire: EMAIL,
    contactName: NOM,
    message: TEXTE,
  },
  TRAINER_CHANGEMENT_DEMANDE: {
    trainerId: "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13",
    demandeId: "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d",
    nature: "iban",
  },
  TRAINER_PIECE_DEPOSEE: {
    trainerId: "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13",
    type: "attestation_vigilance_urssaf",
  },
  FORMATEUR_REPLIED: {
    trainerId: "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13",
    receivedAt: "2026-10-20T08:00:00Z",
  },
  ADMIN_REPLIED_TO_SUBMISSION: {
    submissionId: "sub_1",
    replyId: "rep_1",
    repliedBy: "Will",
    toEmail: EMAIL,
    subject: TEXTE,
  },
  DEPLOY_SUCCESS: { sha: "abc1234" },
  DEPLOY_FAILED: { sha: "abc1234" },
  BACKUP_SUCCESS: { type: "db" },
  BACKUP_FAILED: { type: "db" },
  INCIDENT_DETECTED: { title: "Incident" },
  SECURITY_ALERT: { kind: "test", details: {} },
  STRIPE_EVENT: { eventType: "payment_intent.succeeded", amount: 1200 },
  STRIPE_WEBHOOK_SIGNATURE_FAIL: {},
  MONITORING_ALERT: { kind: "test", details: {} },
  CRM_SYNC_ALERT: { kind: "backlog", count: 3 },
  DATA_INCIDENT_ALERT: { numero: 7, palier: "declare", echeance: "2026-10-14T09:00:00.000Z" },
};

/** Catégories qui concernent une personne : elles doivent porter un lien console. */
const AVEC_FICHE: NotificationCategory[] = [
  "CONTACT_FORM_SUBMITTED",
  "QUOTE_REQUEST_RECEIVED",
  "JOB_APPLICATION_RECEIVED",
  "VIDEO_EDITOR_APPLICATION_RECEIVED",
  "COMMERCIAL_APPLICATION_RECEIVED",
  "REVIEW_SUBMITTED",
  "PODCAST_REQUEST_SUBMITTED",
  "NEWSLETTER_CONFIRMED",
  "GUIDE_REQUESTED",
  "CALENDLY_INVITEE_CREATED",
  "CLIENT_CALL_BOOKED",
  "CHATBOT_LEAD_CAPTURED",
  "APPORTEUR_REPLIED",
];

function rendu(category: NotificationCategory): string {
  return formatNotificationPlain(
    { category, payload: PAYLOADS[category] } as unknown as NotificationEvent,
    "info",
  ).text;
}

describe("Telegram (hub) — aucune coordonnée ni texte saisi, quelle que soit la catégorie", () => {
  for (const category of Object.keys(PAYLOADS) as NotificationCategory[]) {
    it(`🔴 ${category}`, () => {
      const texte = rendu(category);
      for (const interdit of INTERDITS) {
        expect(texte, `« ${interdit} » ne doit pas partir sur Telegram`).not.toContain(interdit);
      }
    });
  }

  it("le TÉMOIN : prénom + initiale, entreprise et ville restent", () => {
    const texte = rendu("CONTACT_FORM_SUBMITTED");
    expect(texte).toContain("Marie D.");
    expect(texte).toContain("Exemple SARL");
    expect(texte).toContain("Grenoble");
  });

  it("chaque alerte qui concerne une personne renvoie à la console", () => {
    for (const category of AVEC_FICHE) {
      expect(rendu(category), category).toMatch(/https?:\/\/\S+\/fr\/[^/\s]+\//);
    }
  });
});

// ─── 1 bis. L'EXCEPTION, explicite : le salon « Clients » (décision Will 15/10) ─

describe("Telegram — le salon « Clients » est la SEULE exception, et elle est bornée", () => {
  it("le gabarit complet porte nom, e-mail, téléphone et message des clients", () => {
    const texte = formatNotificationClient({
      category: "CONTACT_FORM_SUBMITTED",
      payload: PAYLOADS.CONTACT_FORM_SUBMITTED,
    } as unknown as EvenementClient);
    expect(texte).toContain(NOM);
    expect(texte).toContain(EMAIL);
    expect(texte).toContain(TEL);
    expect(texte).toContain(TEXTE);
  });

  it("🔴 seules les catégories du groupe « clients » peuvent l'emprunter", () => {
    for (const c of ALL_NOTIFICATION_CATEGORIES) {
      expect(estCategorieClient(c), c).toBe(telegramGroupFor(c) === "clients");
    }
  });

  it("🔴 le détail ne part QUE vers le salon dédié — le repli reçoit le gabarit allégé", () => {
    // Le câblage, pas seulement la définition : dans `index.ts`, le gabarit
    // complet n'est envoyé qu'au salon résolu par `resolveSalonClients()`, et
    // le dernier essai (repli) envoie `texteAllege`.
    const source = readFileSync("src/server/notifications/index.ts", "utf-8");
    const fonction = source.slice(
      source.indexOf("async function envoyerAuSalonClients"),
      source.indexOf("async function dispatchChannels"),
    );
    expect(fonction).toMatch(/const salon = resolveSalonClients\(\)/);
    expect(fonction).toMatch(/formatNotificationClient\(event\)/);
    expect(fonction).toMatch(/chatId: salon\.chatId/);
    expect(fonction).toMatch(/text: texteAllege,[\s\S]*chatId: repli\.chatId/);
    expect(source.match(/formatNotificationClient\(/g)).toHaveLength(1);
  });
});

// ─── 2. Les corps écrits à la main, partout dans src/ ────────────────────────

/** Déclencheurs : un appel d'envoi, ou un texte d'alerte libre. */
const DECLENCHEUR = /\bsendTelegram\(|\blegacyBody\s*:|\balertIncident\(|\balertOps\(/;

/** Champs `error` / `title` d'une alerte — seulement dans un fichier qui notifie. */
const DECLENCHEUR_ALERTE = /^\s*(error|title)\s*:\s*`/;
const NOTIFIE =
  /from "@\/server\/notifications"|import\("@\/server\/notifications"\)|from "@\/lib\/telegram"/;

/** Identifiants qui portent une coordonnée, un nom complet ou du texte saisi. */
const IDENTIFIANT_INTERDIT =
  /\b(e-?mail\w*|\w*Email|contact_email|telephone|tel|phone|\w*Phone|nom|nomComplet|contactName|inviteeName|leaderName|authorName|fullName|lastName|question|besoin_resume|besoin|motivation\w*|salary\w*|answersText|answers|excerpt|activityExcerpt|adresse|address|iban|bic|rib)\b|\b(input|data|d|p|payload|body|values)\.message\b/;

function sourcesDeSrc(): string[] {
  return execFileSync("git", ["ls-files", "src/**/*.ts", "src/**/*.tsx"], { encoding: "utf-8" })
    .trim()
    .split("\n")
    .filter((f) => !/__tests__|\.(spec|test)\.tsx?$/.test(f));
}

/** Interpolations `${…}` fautives d'un texte. */
export function interpolationsFautives(texte: string): string[] {
  const fautives: string[] = [];
  for (const m of texte.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
    const expr = m[1] ?? "";
    if (/prenomEtInitiale/.test(expr)) continue;
    if (IDENTIFIANT_INTERDIT.test(expr)) fautives.push(expr.trim());
  }
  return fautives;
}

/**
 * Pour chaque déclencheur : la fenêtre de 12 lignes avant (corps préparé dans
 * une variable) et 15 après. Approximation assumée — le hub, lui, est couvert
 * par le rendu ci-dessus.
 */
function corpsSuspects(): Array<{ ou: string; expr: string }> {
  const sortie: Array<{ ou: string; expr: string }> = [];
  for (const f of sourcesDeSrc()) {
    const source = readFileSync(f, "utf-8");
    const notifie = NOTIFIE.test(source);
    const lignes = source.split("\n");
    lignes.forEach((l, i) => {
      const declenche = DECLENCHEUR.test(l) || (notifie && DECLENCHEUR_ALERTE.test(l));
      if (!declenche || /^\s*(\/\/|\*|import)/.test(l)) return;
      const fenetre = lignes.slice(Math.max(0, i - 12), i + 15).join("\n");
      for (const expr of interpolationsFautives(fenetre))
        sortie.push({ ou: `${f}:${i + 1}`, expr });
    });
  }
  return sortie;
}

describe("Telegram (corps écrits à la main) — aucune interpolation de donnée personnelle", () => {
  it("le détecteur voit bien une fuite (le test regarde quelque chose)", () => {
    expect(interpolationsFautives("`Email : ${input.email}`")).toEqual(["input.email"]);
    expect(interpolationsFautives("`Tél : ${d.telephone}`")).toEqual(["d.telephone"]);
    expect(interpolationsFautives("`Invité : ${rdv.inviteeName}`")).toEqual(["rdv.inviteeName"]);
    expect(interpolationsFautives("`Q : ${input.question}`")).toEqual(["input.question"]);
    expect(interpolationsFautives("`${data.message}`")).toEqual(["data.message"]);
    expect(interpolationsFautives("`${redactEmail(abonne.email)}`")).toHaveLength(1);
  });

  it("…et laisse passer ce qui est permis", () => {
    expect(interpolationsFautives("`${prenomEtInitialeDepuisNomComplet(input.nom)}`")).toEqual([]);
    expect(interpolationsFautives("`Erreur : ${(err as Error).message}`")).toEqual([]);
    expect(interpolationsFautives("`Devis ${devis.numero}`")).toEqual([]);
  });

  it("🔴 aucun corps Telegram de src/ n'interpole e-mail, téléphone, nom complet ou texte saisi", () => {
    expect(corpsSuspects()).toEqual([]);
  });
});
