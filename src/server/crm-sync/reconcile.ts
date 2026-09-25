/**
 * RÉCONCILIATION quotidienne de la synchro CRM (lot L5).
 *
 * « Le temps réel donne la fraîcheur, le batch donne la garantie. »
 *
 * ── Ce qu'elle répare, et ce qu'elle ne répare pas ──────────────────────────
 * L'outbox du lot L2 est POST-COMMIT (cf. `enqueue.ts`) : entre l'écriture
 * métier et l'écriture de la ligne d'outbox, il existe une fenêtre — étroite,
 * mais réelle — où un crash du processus laisse une soumission sans événement
 * à émettre. Ce batch est le filet qui rend cette fenêtre VISIBLE.
 *
 * 🔴 Il CONSIGNE, il ne ré-enfile pas. Ré-émettre automatiquement supposerait
 * de reconstruire un payload complet (PII déchiffrées, consentement, société)
 * depuis une source qu'on n'a pas relue — une reconstruction approximative
 * poussée dans un CRM vaut moins qu'une absence signalée. La décision de
 * rejouer reste humaine, depuis la console.
 *
 * ── Les deux faux positifs qu'on refuse de produire ─────────────────────────
 * Une alerte qui crie à tort est pire qu'une alerte absente : elle apprend à
 * ne plus lire. Deux bornes évitent cela :
 *   1. la fenêtre ne remonte JAMAIS avant la première ligne d'outbox — tout ce
 *      qui précède l'allumage du drapeau n'a légitimement rien émis ;
 *   2. les enregistrements des dernières minutes sont ignorés — sinon le batch
 *      accuserait une soumission arrivée pendant qu'il tourne.
 *
 * ── Le signal de VIE (leçon IndexNow) ──────────────────────────────────────
 * Un job vert qui ne relaie rien est le pire des états. Ce batch journalise
 * donc ses compteurs à CHAQUE passage, y compris — surtout — quand tout va
 * bien : l'absence de nouvelles doit être visible, pas supposée.
 */

import { prisma } from "@/lib/prisma";

import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { HORS_APPELS_APPORTEUR } from "@/server/calendly/appel-apporteur";
import { FORM_REF_LETTRE } from "@/content/guide-ia-formulaire";
import { alertCrmSync } from "./alerts";
import { isCrmSyncEnabled, isCrmSyncGuideEnabled } from "./config";
import { estExclueDuCrm } from "./exclusions";
import { adressesOpposees } from "./oppositions-par-lot";
import type { CrmUniverse } from "./types";

/** Profondeur de la comparaison. Au-delà, l'anomalie n'est plus fraîche. */
export const RECONCILE_WINDOW_DAYS = 7;

/**
 * Les enregistrements plus récents que ce délai sont ignorés : l'écriture de
 * l'outbox est post-commit, donc décalée de quelques millisecondes. Cinq
 * minutes couvrent très largement, y compris un processus sous charge.
 */
const GRACE_MS = 5 * 60 * 1000;

/**
 * Plafond de sources examinées par famille et par passage.
 *
 * Ce n'est pas une optimisation prématurée : la comparaison passe par un
 * `IN (…)` sur les `subject_ref`, dont la taille est bornée par ce nombre. À
 * volume constant (Axion-IA produit quelques dizaines de soumissions par
 * semaine), le plafond n'est jamais atteint ; s'il l'était, le rapport le
 * DIRAIT au lieu de tronquer en silence.
 */
const MAX_SOURCES_PER_FAMILY = 2000;

/** Nombre d'identifiants manquants détaillés dans le rapport (le reste est compté). */
const MAX_REPORTED_IDS = 20;

/**
 * Les six familles de capture du site qui émettent vers le CRM (la sixième,
 * `guide_request`, arrive avec le lot L4-S).
 *
 * Étape 0, ligne 12 (2026-08-18) : la réconciliation ne comparait que les
 * formulaires et les candidatures — le critère de PARITÉ du cahier des charges
 * (« sur une semaine, ce que la console voit = ce que le CRM reçoit, toutes
 * familles ») était mesuré sur deux familles sur cinq. Calendly, newsletter et
 * avis rejoignent la comparaison ; chacune avec SA condition d'émission (un
 * enregistrement qui, par construction, n'émet pas n'est pas un manquant).
 */
export type CrmSyncFamily =
  | "submission"
  | "job_application"
  | "calendly_event"
  | "newsletter_subscriber"
  | "customer_review"
  | "guide_request";

export interface ReconcileFamilyReport {
  family: CrmSyncFamily;
  label: string;
  universe: CrmUniverse;
  /** Nombre d'enregistrements source examinés sur la fenêtre. */
  sources: number;
  /** Nombre d'entre eux qui ont bien une ligne d'outbox. */
  emitted: number;
  /** Nombre d'entre eux qui n'en ont AUCUNE. */
  missing: number;
  /** Identifiants des manquants (tronqué à 20 — `missing` porte le total). */
  missingIds: string[];
  /** Renseigné quand la famille n'a pas été comparée, avec la raison. */
  skipped?: string;
  /** Vrai si le plafond de sources a été atteint (comparaison partielle). */
  truncated: boolean;
}

export interface ReconcileReport {
  ranAt: string;
  /** Faux ⇒ le batch est sorti immédiatement, rien n'a été comparé. */
  enabled: boolean;
  windowDays: number;
  /** Borne basse effective de la comparaison (null si rien à comparer). */
  since: string | null;
  families: ReconcileFamilyReport[];
  totalMissing: number;
}

const FAMILY_LABELS: Record<CrmSyncFamily, string> = {
  submission: "Formulaires (submissions)",
  job_application: "Candidatures aux offres",
  calendly_event: "Rendez-vous Calendly (invité identifié)",
  newsletter_subscriber: "Lettre (inscriptions)",
  customer_review: "Avis clients",
  guide_request: "Guide IA (demandes cliquées)",
};

/**
 * Références de collecte des inscriptions faites À LA DEMANDE DU GUIDE
 * (amendement du 24/09, `guide-ia/lettre.ts`). Elles ne sont pas émises à
 * l'inscription : elles entrent au CRM au CLIC sur le lien du guide (décision
 * D1), derrière `CRM_SYNC_GUIDE_ENABLED`.
 */
const FORM_REFS_INSCRIPTION_PAR_LE_GUIDE: ReadonlySet<string> = new Set(
  Object.values(FORM_REF_LETTRE),
);

function normaliser(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/**
 * Les inscriptions de la fenêtre qui DOIVENT avoir leur `newsletter_optin`
 * (lot L4-S, relecture du 25/09) :
 *
 *   · confirmées par bouton (référence nulle ou hors guide) : émises à la
 *     confirmation, comme avant — GARDÉES ;
 *   · faites à la demande du guide : elles n'émettent qu'une fois l'adresse
 *     vérifiée par le clic. GARDÉES seulement si une demande de cette adresse
 *     a été TRANSMISE (une ligne `lead_magnet_requested` existe) ; jamais
 *     cliquée, ou cliquée drapeau fermé, elles sont ÉCARTÉES (rien à attendre).
 *     Avant ce filtre, elles étaient toutes écartées : une inscription du
 *     guide dont la demande était partie sans elle n'était contrôlée par rien.
 *
 * Écartées aussi : les adresses exclues (`CRM_SYNC_EXCLUSIONS_SHA256`) et,
 * pour le guide, opposées — le site ne les émet pas, ce ne sont pas des pertes.
 * Tri EN MÉMOIRE, jamais par un `notIn` SQL : sur une colonne nullable,
 * `NOT IN` écarte aussi les NULL — c'est-à-dire toutes les inscriptions
 * antérieures au lot L2, que le filet doit justement voir.
 */
export async function inscriptionsAControler(
  lignes: ReadonlyArray<{ id: string; email: string; consentFormRef: string | null }>,
): Promise<Array<{ id: string }>> {
  const retenues = lignes.filter((l) => !estExclueDuCrm(l.email));
  const parLeGuide = retenues.filter(
    (l) => l.consentFormRef !== null && FORM_REFS_INSCRIPTION_PAR_LE_GUIDE.has(l.consentFormRef),
  );
  const transmises = new Set<string>();
  let opposees = new Set<string>();
  if (parLeGuide.length > 0) {
    const demandes = await prisma.guideRequest.findMany({
      where: {
        email: { in: parLeGuide.map((l) => l.email) },
        firstClickAt: { not: null },
        crmEmittedAt: { not: null },
      },
      select: { id: true, email: true },
    });
    const emailParRef = new Map<string, string>(
      demandes.map((d) => [`site:guide_request:${d.id}`, normaliser(d.email)] as const),
    );
    if (emailParRef.size > 0) {
      const lignesOutbox = await prisma.crmSyncOutbox.findMany({
        where: { subjectRef: { in: [...emailParRef.keys()] }, eventType: "lead_magnet_requested" },
        select: { subjectRef: true },
      });
      for (const l of lignesOutbox) {
        const email = emailParRef.get(l.subjectRef);
        if (email !== undefined) transmises.add(email);
      }
    }
    if (transmises.size > 0) opposees = await adressesOpposees([...transmises]);
  }
  const guide = new Set(parLeGuide.map((l) => l.id));
  return retenues
    .filter((l) => {
      if (!guide.has(l.id)) return true;
      const email = normaliser(l.email);
      return transmises.has(email) && !opposees.has(email);
    })
    .map((l) => ({ id: l.id }));
}

/**
 * Compare les enregistrements SOURCE aux `subject_ref` émis, sans rien écrire
 * ni alerter. Séparée de `runCrmSyncReconciliation` pour que la console puisse
 * afficher l'écart courant sans déclencher de notification au chargement d'une
 * page — une carte d'observabilité ne doit pas avoir d'effet de bord.
 */
export async function collectReconciliation(): Promise<ReconcileReport> {
  const ranAt = new Date().toISOString();

  if (!isCrmSyncEnabled()) {
    return {
      ranAt,
      enabled: false,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  // Borne 1 : l'horodatage d'ACTIVATION du drapeau — pas la première ligne
  // d'outbox. La revue adversariale a montré que borner sur la 1re ligne
  // rendait le filet AVEUGLE précisément sur sa raison d'être : si la toute
  // première capture post-allumage tombe dans la fenêtre post-commit (crash
  // entre l'écriture métier et l'outbox), il n'existe AUCUNE ligne d'outbox —
  // et l'ancienne borne concluait « rien à comparer » puis excluait cette
  // submission pour toujours. Le marqueur est posé une seule fois, au premier
  // passage drapeau ouvert, et fait foi ensuite.
  const marker = await prisma.siteSetting.upsert({
    where: { key: "crm_sync_activated_at" },
    create: {
      key: "crm_sync_activated_at",
      value: ranAt,
      description:
        "Horodatage du premier passage de réconciliation avec CRM_SYNC_ENABLED ouvert — borne basse du filet (ne pas modifier).",
      category: "general",
    },
    update: {},
    select: { value: true },
  });
  const activatedAt = new Date(String(marker.value));

  const windowStart = new Date(Date.now() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since = activatedAt > windowStart ? activatedAt : windowStart;
  // Borne 2 : la période de grâce, pour ne pas accuser ce qui vient d'arriver.
  const until = new Date(Date.now() - GRACE_MS);

  const families: ReconcileFamilyReport[] = [];

  families.push(
    await compareFamily({
      family: "submission",
      universe: "business",
      since,
      until,
      // 🔴 `submittedAt` et non `createdAt` : c'est le nom de la colonne
      // d'horodatage sur `Submission` comme sur `JobApplication`. Un
      // `createdAt` inventé ici ne compile pas — mais avec un `where` typé
      // trop large il aurait pu passer et comparer la fenêtre ENTIÈRE.
      //
      // 🔴 B2 (19/09) — les dossiers APPORTEURS ne partent plus au CRM (ordre
      // de Will du 04/09, ADR 0051). Ils n'ont donc, par construction, aucune
      // ligne d'outbox : les compter ici les ferait tous passer pour des
      // émissions perdues, et chaque candidature déclencherait `reconcile_gap`.
      //
      // Le tri se fait EN MÉMOIRE, jamais par un `NOT` sur un chemin JSON : en
      // SQL un chemin absent rend NULL, et `NOT (NULL = …)` écarte aussi toutes
      // les demandes clients sans `subType` — le filet deviendrait aveugle à la
      // perte qu'il existe pour voir. Le plafond `take` s'applique AVANT le tri :
      // au volume actuel il n'est jamais atteint (cf. `MAX_SOURCES_PER_FAMILY`).
      loadIds: async (from, to) => {
        const lignes = await prisma.submission.findMany({
          where: { submittedAt: { gte: from, lt: to } },
          select: { id: true, details: true },
          orderBy: { submittedAt: "asc" },
          take: MAX_SOURCES_PER_FAMILY,
        });
        return lignes.filter(
          (ligne) => !estApporteur(ligne.details) && !estFormulaireRecrutement(ligne.details),
        );
      },
    }),
  );

  // Les candidatures ne partent PLUS au CRM (ADR 0047, révision « aucune
  // candidature ne franchit la frontière ») : ni l'action, ni le tunnel
  // apporteurs n'émettent. Les comparer produirait un « manquant » par
  // candidature, donc une alerte quotidienne qui ne signale rien — et le
  // drapeau `CRM_SYNC_CANDIDATES_ENABLED` reste OUVERT pour l'opposition au
  // vivier, il ne dit donc plus rien de l'envoi. La famille reste dans le
  // rapport (toutes, jamais moins), toujours ignorée, SANS lecture en base.
  families.push({
    family: "job_application",
    label: FAMILY_LABELS.job_application,
    universe: "vivier",
    sources: 0,
    emitted: 0,
    missing: 0,
    missingIds: [],
    skipped: "envoi des candidatures coupé par décision de Will (ADR 0047)",
    truncated: false,
  });

  // ── Les trois familles ajoutées le 2026-08-18 (ligne 12) ─────────────────
  // Chacune ne compte que ce qui DOIT émettre :
  //  - Calendly : l'émission exige l'adresse de l'invité (le widget ne la
  //    transmet pas ; c'est l'enrichissement API qui la récupère). Un
  //    rendez-vous sans adresse n'a, par construction, aucune ligne d'outbox —
  //    et c'est un défaut d'enrichissement, pas de synchro. On compare donc
  //    les rendez-vous DONT l'adresse est connue, par date de capture.
  //  - Newsletter : l'émission a lieu à la CONFIRMATION du double opt-in
  //    (`newsletter_optin`), jamais à la demande. Fenêtre sur `confirmedAt`.
  //  - Avis : émis à la soumission (`review_posted`), quel que soit le statut
  //    de modération. Fenêtre sur `createdAt`.
  families.push(
    await compareFamily({
      family: "calendly_event",
      universe: "business",
      since,
      until,
      loadIds: (from, to) =>
        prisma.calendlyEvent.findMany({
          // Les échanges apporteur ne sont jamais émis (`syncCalendlyEventToCrm`) :
          // les compter ici les ferait passer pour des émissions perdues.
          where: {
            capturedAt: { gte: from, lt: to },
            inviteeEmail: { not: null },
            ...HORS_APPELS_APPORTEUR,
          },
          select: { id: true },
          orderBy: { capturedAt: "asc" },
          take: MAX_SOURCES_PER_FAMILY,
        }),
    }),
    await compareFamily({
      family: "newsletter_subscriber",
      universe: "business",
      since,
      until,
      // Lot L4-S : confirmées par bouton, ou faites à la demande du guide dont
      // une demande a été transmise (`inscriptionsAControler`). Une ligne
      // `newsletter_optin` exactement : un rebond ou un désabonnement sur la
      // même référence ne masque pas une inscription jamais transmise.
      eventType: "newsletter_optin",
      loadIds: async (from, to) =>
        inscriptionsAControler(
          await prisma.newsletterSubscriber.findMany({
            where: { confirmedAt: { gte: from, lt: to } },
            select: { id: true, email: true, consentFormRef: true },
            orderBy: { confirmedAt: "asc" },
            take: MAX_SOURCES_PER_FAMILY,
          }),
        ),
    }),
    await compareFamily({
      family: "customer_review",
      universe: "business",
      since,
      until,
      loadIds: (from, to) =>
        prisma.customerReview.findMany({
          where: { createdAt: { gte: from, lt: to } },
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: MAX_SOURCES_PER_FAMILY,
        }),
    }),
  );

  // Lot L4-S — la demande du guide entre au CRM au CLIC (`first_click_at`),
  // derrière `CRM_SYNC_GUIDE_ENABLED`. Drapeau fermé : famille présente,
  // ignorée, SANS lecture en base (rien n'émet, rien ne manque). Ouvert : les
  // clics de la fenêtre doivent tous avoir leur `site:guide_request:<id>`.
  // Les clics antérieurs à l'ouverture relèvent de la commande de rattrapage.
  if (!isCrmSyncGuideEnabled()) {
    families.push({
      family: "guide_request",
      label: FAMILY_LABELS.guide_request,
      universe: "business",
      sources: 0,
      emitted: 0,
      missing: 0,
      missingIds: [],
      skipped: "flux lettre et guide fermé (CRM_SYNC_GUIDE_ENABLED)",
      truncated: false,
    });
  } else {
    families.push(
      await compareFamily({
        family: "guide_request",
        universe: "business",
        since,
        until,
        loadIds: (from, to) =>
          prisma.guideRequest.findMany({
            where: { firstClickAt: { gte: from, lt: to } },
            select: { id: true },
            orderBy: { firstClickAt: "asc" },
            take: MAX_SOURCES_PER_FAMILY,
          }),
      }),
    );
  }

  return {
    ranAt,
    enabled: true,
    windowDays: RECONCILE_WINDOW_DAYS,
    since: since.toISOString(),
    families,
    totalMissing: families.reduce((sum, f) => sum + f.missing, 0),
  };
}

interface CompareInput {
  family: CrmSyncFamily;
  universe: CrmUniverse;
  since: Date;
  until: Date;
  /**
   * Charge les identifiants source de la fenêtre. Le `where` est construit par
   * l'appelant et non ici : chaque modèle nomme sa colonne d'horodatage comme
   * il l'entend (`submittedAt` sur les deux familles actuelles), et un contrat
   * générique qui imposerait un nom de colonne serait faux dès le 3e modèle.
   */
  loadIds: (since: Date, until: Date) => PromiseLike<Array<{ id: string }>>;
  /** Type d'événement exigé (lot L4-S). Absent : n'importe quelle ligne de la référence. */
  eventType?: string;
}

/**
 * Un `/contact` de type « recrutement » n'émet plus (garde de
 * `syncFormSubmissionToCrm`, ADR 0047 révisée) : il n'a donc, par construction,
 * aucune ligne d'outbox et ne doit pas compter comme manquant. Même lecture
 * DÉFENSIVE que `estApporteur` — le JSON vient de la base, rien ne doit lever.
 */
function estFormulaireRecrutement(details: unknown): boolean {
  if (!details || typeof details !== "object" || Array.isArray(details)) return false;
  return (details as Record<string, unknown>).unifiedType === "recrutement";
}

async function compareFamily(input: CompareInput): Promise<ReconcileFamilyReport> {
  const sources = await input.loadIds(input.since, input.until);
  const refs = sources.map((s) => `site:${input.family}:${s.id}`);

  if (refs.length === 0) {
    return {
      family: input.family,
      label: FAMILY_LABELS[input.family],
      universe: input.universe,
      sources: 0,
      emitted: 0,
      missing: 0,
      missingIds: [],
      truncated: false,
    };
  }

  // Une seule requête, sur l'index `subject_ref` créé par la migration L2.
  // On demande les `subject_ref` PRÉSENTS et on déduit les absents en mémoire :
  // l'inverse (un NOT IN) ne saurait pas dire quels identifiants manquent.
  const emitted = await prisma.crmSyncOutbox.findMany({
    where: {
      subjectRef: { in: refs },
      ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
    },
    select: { subjectRef: true },
  });

  const seen = new Set(emitted.map((row) => row.subjectRef));
  const missing = refs.filter((ref) => !seen.has(ref));

  return {
    family: input.family,
    label: FAMILY_LABELS[input.family],
    universe: input.universe,
    sources: refs.length,
    emitted: refs.length - missing.length,
    missing: missing.length,
    missingIds: missing.slice(0, MAX_REPORTED_IDS),
    truncated: refs.length >= MAX_SOURCES_PER_FAMILY,
  };
}

/**
 * Le passage quotidien : compare, ALERTE si écart, et journalise toujours.
 *
 * Ne lève jamais — un échec du batch est lui-même une anomalie signalée
 * (`reconcile_failed`), pas un job rouge dont personne ne lit la trace.
 */
export async function runCrmSyncReconciliation(): Promise<ReconcileReport> {
  if (!isCrmSyncEnabled()) {
    // Sortie immédiate, drapeau à OFF. Aucune requête, aucun log de vie : dans
    // cet état l'outbox est vide par construction, il n'y a rien à surveiller.
    return {
      ranAt: new Date().toISOString(),
      enabled: false,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  let report: ReconcileReport;
  try {
    report = await collectReconciliation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[crm-sync][réconciliation] échec du batch :", detail);
    await alertCrmSync({ kind: "reconcile_failed", detail });
    return {
      ranAt: new Date().toISOString(),
      enabled: true,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  // ── SIGNAL DE VIE ────────────────────────────────────────────────────────
  // Journalisé même quand tout est à zéro. C'est la seule preuve que la
  // garantie quotidienne a effectivement tourné : sans elle, un batch mort et
  // un batch qui ne trouve rien sont indiscernables.
  console.warn(
    `[crm-sync][réconciliation] ${JSON.stringify({
      ranAt: report.ranAt,
      since: report.since,
      totalMissing: report.totalMissing,
      familles: report.families.map((f) => ({
        famille: f.family,
        sources: f.sources,
        manquants: f.missing,
        ...(f.skipped ? { ignoree: f.skipped } : {}),
      })),
    })}`,
  );

  if (report.totalMissing > 0) {
    const detail = report.families
      .filter((f) => f.missing > 0)
      .map((f) => `${f.label} : ${f.missing} (${f.missingIds.join(", ")})`)
      .join(" · ");

    await alertCrmSync({
      kind: "reconcile_gap",
      count: report.totalMissing,
      detail: detail.slice(0, 400),
    });
  }

  return report;
}
