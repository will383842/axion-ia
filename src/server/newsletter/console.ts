/**
 * LA LETTRE ET LE GUIDE, VUS DE LA CONSOLE — lectures (lot L3, 2026-09-24).
 *
 * Ce module ne fait que LIRE : l'écran « Demandes du guide », la fiche d'un
 * abonné, les statistiques et la tuile d'accueil. Les gestes (envoyer,
 * désabonner, effacer, exporter) vivent ailleurs, chacun sur son chemin.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"`. Les pages l'appellent après
 * avoir vérifié la session ; aucune de ces fonctions ne doit devenir une Server
 * Action qu'un client appellerait avec l'identifiant de son choix.
 *
 * Stub-safe (ADR 0026) : au build, le client Prisma rend des listes vides et
 * des zéros ; toutes ces lectures le supportent.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { CONSENT_FORM_REFS } from "@/lib/consents";
import { FORM_REF_LETTRE, FORM_REF_REINSCRIPTION } from "@/content/guide-ia-formulaire";
import {
  AIMANT_GUIDE_IA,
  ENTITE_GUIDE,
  GABARIT_GUIDE,
  HORIZON_RATTRAPAGE_MS,
} from "@/server/guide-ia/config";
import { refusConsole, type RefusConsole } from "@/server/guide-ia/refus-console";
import { verdictAvantEnvoi } from "@/server/email/verdict-envoi";
import type { GuideRequestOrigine, NewsletterStatus } from "../../../prisma/generated/client";

// ============================================================
// Libellés partagés par les écrans
// ============================================================

/** Provenances connues — la liste fermée du formulaire, plus la console et l'historique. */
export const LIBELLES_SOURCE: Readonly<Record<string, string>> = {
  "guide-ia": "Page du guide",
  "blog-fin-article": "Encart, fin d'article de blog",
  "actualites-fin-article": "Encart, fin d'actualité",
  "guides-fin-article": "Encart, fin de guide",
  console: "Console (envoi manuel)",
};

export function libelleSource(source: string | null): string {
  if (source === null || source === "") return "Inconnue";
  return LIBELLES_SOURCE[source] ?? source;
}

/** Références du registre de preuve qui concernent la LETTRE — et elles seules. */
export const FORM_REFS_LETTRE: ReadonlyArray<string> = [
  CONSENT_FORM_REFS.newsletter,
  ...Object.values(FORM_REF_LETTRE),
  FORM_REF_REINSCRIPTION,
];

// ============================================================
// Écran « Demandes du guide »
// ============================================================

export type EtatDemandeFiltre = "toutes" | "non-envoyees" | "envoyees" | "cliquees";

export interface FiltresDemandes {
  readonly etat?: EtatDemandeFiltre;
  readonly origine?: GuideRequestOrigine | "toutes";
  readonly recherche?: string;
  readonly page?: number;
}

export interface LigneDemandeGuide {
  readonly id: string;
  readonly email: string;
  readonly origine: GuideRequestOrigine;
  readonly source: string | null;
  readonly locale: "fr" | "en";
  readonly createdAt: Date;
  readonly queuedAt: Date | null;
  readonly sentAt: Date | null;
  readonly sendCount: number;
  readonly firstSeenAt: Date | null;
  readonly firstClickAt: Date | null;
  readonly crmEmittedAt: Date | null;
  /** Fiche abonné de la même adresse, s'il y en a une. */
  readonly abonneId: string | null;
  readonly abonneStatut: NewsletterStatus | null;
  /**
   * Pourquoi « Renvoyer » est refusé, ou `null` s'il est permis — la règle des
   * gestes (`refusConsole`), appliquée ici pour masquer le bouton.
   */
  readonly refusEnvoi: RefusConsole | "introuvable" | null;
}

export const TAILLE_PAGE_DEMANDES = 50;

function whereDemandes(f: FiltresDemandes): Record<string, unknown> {
  const where: Record<string, unknown> = { aimant: AIMANT_GUIDE_IA };
  if (f.etat === "non-envoyees") where["sentAt"] = null;
  if (f.etat === "envoyees") where["sentAt"] = { not: null };
  if (f.etat === "cliquees") where["firstClickAt"] = { not: null };
  if (f.origine === "formulaire" || f.origine === "admin") where["origine"] = f.origine;
  if (f.recherche && f.recherche.trim().length >= 2) {
    where["email"] = { contains: f.recherche.trim(), mode: "insensitive" };
  }
  return where;
}

export async function listerDemandesGuide(f: FiltresDemandes = {}): Promise<{
  lignes: LigneDemandeGuide[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const where = whereDemandes(f);
  const [total, demandes] = await Promise.all([
    prisma.guideRequest.count({ where }),
    prisma.guideRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * TAILLE_PAGE_DEMANDES,
      take: TAILLE_PAGE_DEMANDES,
      select: {
        id: true,
        email: true,
        emailKey: true,
        origine: true,
        source: true,
        locale: true,
        createdAt: true,
        queuedAt: true,
        sentAt: true,
        sendCount: true,
        firstSeenAt: true,
        firstClickAt: true,
        crmEmittedAt: true,
      },
    }),
  ]);

  // Trois lectures GROUPÉES pour la page entière (pas une par ligne) : l'abonné,
  // l'opposition (même empreinte HMAC que `email_oppositions`), le rebond dur
  // (même critère que `verdictAvantEnvoi` : `bounced` + `hard`).
  const emails = demandes.map((d) => d.email);
  const [abonnes, oppositions, rebonds] =
    demandes.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.newsletterSubscriber.findMany({
            where: { email: { in: emails } },
            select: { id: true, email: true, status: true },
          }),
          prisma.emailOpposition.findMany({
            where: { emailHash: { in: demandes.map((d) => d.emailKey) } },
            select: { emailHash: true },
          }),
          prisma.emailLog.findMany({
            where: { recipient: { in: emails }, status: "bounced", bounceType: "hard" },
            select: { recipient: true },
          }),
        ]);
  const parEmail = new Map(abonnes.map((a) => [a.email.toLowerCase(), a]));
  const opposees = new Set(oppositions.map((o) => o.emailHash));
  const mortes = new Set(rebonds.map((r) => r.recipient.toLowerCase()));

  return {
    lignes: demandes.map(({ emailKey, ...d }) => {
      const a = parEmail.get(d.email.toLowerCase());
      const statut = a?.status ?? null;
      return {
        ...d,
        abonneId: a?.id ?? null,
        abonneStatut: statut,
        refusEnvoi: refusConsole(
          {
            statut,
            opposee: opposees.has(emailKey),
            rebondDur: mortes.has(d.email.toLowerCase()),
          },
          d.origine,
        ),
      };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / TAILLE_PAGE_DEMANDES)),
  };
}

// ============================================================
// Fiche abonné
// ============================================================

export interface FicheAbonne {
  readonly abonne: {
    readonly id: string;
    readonly email: string;
    readonly locale: "fr" | "en";
    readonly status: NewsletterStatus;
    readonly source: string | null;
    readonly consentFormRef: string | null;
    readonly consentVersion: string | null;
    readonly confirmedAt: Date | null;
    readonly unsubscribedAt: Date | null;
    readonly softBounceCount: number;
    readonly lastSoftBounceAt: Date | null;
    readonly ipHashPresent: boolean;
    readonly createdAt: Date;
  };
  readonly demandeGuide: {
    readonly id: string;
    readonly origine: GuideRequestOrigine;
    readonly source: string | null;
    readonly createdAt: Date;
    readonly queuedAt: Date | null;
    readonly sentAt: Date | null;
    readonly sendCount: number;
    readonly firstSeenAt: Date | null;
    readonly firstClickAt: Date | null;
    readonly crmEmittedAt: Date | null;
  } | null;
  /** Registre de preuve, limité aux références de la lettre. */
  readonly preuves: ReadonlyArray<{
    readonly id: string;
    readonly formRef: string;
    readonly consentVersion: string;
    readonly action: string;
    readonly occurredAt: Date;
  }>;
  /** E-mails du guide envoyés à cette adresse. */
  readonly envois: ReadonlyArray<{
    readonly id: string;
    readonly status: string;
    readonly createdAt: Date;
    readonly sentAt: Date | null;
    readonly bounceType: string | null;
  }>;
  /** Événements de la lettre partis (ou en attente) vers le CRM. */
  readonly synchroCrm: ReadonlyArray<{
    readonly id: string;
    readonly eventType: string;
    readonly status: string;
    readonly createdAt: Date;
    readonly sentAt: Date | null;
  }>;
  /**
   * Base de l'inscription, lue sur la DERNIÈRE preuve de la lettre :
   * `information` → intérêt légitime, `optin` → consentement, sinon non
   * établie (aucune preuve, ou la dernière est un retrait).
   */
  readonly base: BaseInscription;
  /** Pourquoi « Envoyer / Renvoyer le guide » est refusé, ou `null`. */
  readonly refusEnvoi: RefusConsole | "introuvable" | null;
}

export type BaseInscription = "interet-legitime" | "consentement" | "non-etablie";

/** La base se lit sur la preuve la plus récente — `preuves` est trié du plus récent au plus ancien. */
export function baseDInscription(
  preuves: ReadonlyArray<{ readonly action: string }>,
): BaseInscription {
  const derniere = preuves[0]?.action;
  if (derniere === "information") return "interet-legitime";
  if (derniere === "optin") return "consentement";
  return "non-etablie";
}

export async function lireFicheAbonne(id: string): Promise<FicheAbonne | null> {
  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      source: true,
      consentFormRef: true,
      consentVersion: true,
      confirmedAt: true,
      unsubscribedAt: true,
      softBounceCount: true,
      lastSoftBounceAt: true,
      ipHash: true,
      createdAt: true,
    },
  });
  if (!abonne) return null;

  const personKey = hashEmailForLookup(abonne.email);
  const [demandeGuide, preuves, envois, synchroCrm, opposition, verdict] = await Promise.all([
    personKey
      ? prisma.guideRequest.findUnique({
          where: { emailKey_aimant: { emailKey: personKey, aimant: AIMANT_GUIDE_IA } },
          select: {
            id: true,
            origine: true,
            source: true,
            createdAt: true,
            queuedAt: true,
            sentAt: true,
            sendCount: true,
            firstSeenAt: true,
            firstClickAt: true,
            crmEmittedAt: true,
          },
        })
      : Promise.resolve(null),
    personKey
      ? prisma.consentEvent.findMany({
          where: { personKey, formRef: { in: [...FORM_REFS_LETTRE] } },
          orderBy: { occurredAt: "desc" },
          take: 50,
          select: { id: true, formRef: true, consentVersion: true, action: true, occurredAt: true },
        })
      : Promise.resolve([]),
    prisma.emailLog.findMany({
      where: { recipient: abonne.email, template: GABARIT_GUIDE },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, createdAt: true, sentAt: true, bounceType: true },
    }),
    prisma.crmSyncOutbox.findMany({
      where: { subjectRef: `site:newsletter_subscriber:${abonne.id}` },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, eventType: true, status: true, createdAt: true, sentAt: true },
    }),
    personKey
      ? prisma.emailOpposition.findUnique({
          where: { emailHash: personKey },
          select: { id: true },
        })
      : Promise.resolve(null),
    // Le MÊME verdict que le geste et le rattrapage (contexte du guide).
    verdictAvantEnvoi(abonne.email, { template: GABARIT_GUIDE, marketing: false }),
  ]);

  const { ipHash, ...reste } = abonne;
  return {
    abonne: { ...reste, ipHashPresent: ipHash !== null && ipHash !== "" },
    demandeGuide,
    preuves,
    envois,
    synchroCrm: synchroCrm.map((s) => ({ ...s, status: String(s.status) })),
    base: baseDInscription(preuves),
    refusEnvoi: refusConsole(
      {
        statut: abonne.status,
        opposee: opposition !== null,
        rebondDur: verdict.retenu && verdict.motif === "rebond_dur",
      },
      demandeGuide?.origine ?? null,
    ),
  };
}

// ============================================================
// Statistiques
// ============================================================

export interface PointMensuel {
  /** « AAAA-MM ». */
  readonly mois: string;
  readonly inscriptions: number;
  readonly desabonnements: number;
  readonly demandesGuide: number;
}

export interface StatistiquesLettre {
  readonly confirmes: number;
  readonly enAttente: number;
  readonly desabonnes: number;
  readonly rejetes: number;
  /** Désabonnés / (confirmés + désabonnés), en %, ou `null` sans dénominateur. */
  readonly tauxDesabonnement: number | null;
  /** Toutes les lignes d'abonné, tous statuts : le dénominateur du taux de rejet. */
  readonly abonnesTous: number;
  /** Rejetés / toutes les lignes d'abonné (tous statuts), en %. */
  readonly tauxRejet: number | null;
  readonly demandes: number;
  readonly demandesEnvoyees: number;
  readonly demandesVues: number;
  readonly demandesCliquees: number;
  /**
   * Demandes ENVOYÉES et cliquées / demandes envoyées, en %, plafonné à 100.
   * Seul le clic (POST) vaut geste humain. Une demande cliquée sans `sent_at`
   * (clôture non consignée) n'entre ni au numérateur ni au dénominateur.
   */
  readonly tauxClic: number | null;
  readonly parMois: ReadonlyArray<PointMensuel>;
  /** Abonnés CONFIRMÉS par provenance. */
  readonly abonnesParSource: ReadonlyArray<{ readonly source: string | null; readonly n: number }>;
  /** Demandes du guide par provenance. */
  readonly demandesParSource: ReadonlyArray<{ readonly source: string | null; readonly n: number }>;
}

/** Pourcentage arrondi à une décimale, `null` si le dénominateur est nul. */
export function pourcentage(numerateur: number, denominateur: number): number | null {
  if (denominateur <= 0) return null;
  return Math.round((numerateur / denominateur) * 1000) / 10;
}

/** Un taux ne dépasse jamais 100 % (deux comptages lus à deux instants peuvent se croiser). */
function plafonne100(v: number | null): number | null {
  return v === null ? null : Math.min(100, v);
}

/** Les `n` derniers mois (le plus ancien d'abord), clés « AAAA-MM » en UTC. */
export function derniersMois(maintenant: Date, n: number): string[] {
  const cles: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - i, 1));
    cles.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return cles;
}

function cleMois(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Plafond de lignes lues pour la courbe — au-delà, passer à une agrégation SQL. */
const PLAFOND_COURBE = 20_000;

export async function lireStatistiquesLettre(
  maintenant: Date = new Date(),
  nbMois = 12,
): Promise<StatistiquesLettre> {
  const mois = derniersMois(maintenant, nbMois);
  const debut = new Date(`${mois[0]}-01T00:00:00.000Z`);

  const [
    parStatut,
    demandes,
    demandesEnvoyees,
    demandesVues,
    demandesCliquees,
    envoyeesCliquees,
    inscrits,
    partis,
    demandesDates,
    abonnesSource,
    demandesSource,
  ] = await Promise.all([
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.guideRequest.count({ where: { aimant: AIMANT_GUIDE_IA } }),
    prisma.guideRequest.count({ where: { aimant: AIMANT_GUIDE_IA, sentAt: { not: null } } }),
    prisma.guideRequest.count({ where: { aimant: AIMANT_GUIDE_IA, firstSeenAt: { not: null } } }),
    prisma.guideRequest.count({ where: { aimant: AIMANT_GUIDE_IA, firstClickAt: { not: null } } }),
    prisma.guideRequest.count({
      where: { aimant: AIMANT_GUIDE_IA, sentAt: { not: null }, firstClickAt: { not: null } },
    }),
    prisma.newsletterSubscriber.findMany({
      where: { confirmedAt: { gte: debut } },
      select: { confirmedAt: true },
      take: PLAFOND_COURBE,
    }),
    prisma.newsletterSubscriber.findMany({
      where: { unsubscribedAt: { gte: debut } },
      select: { unsubscribedAt: true },
      take: PLAFOND_COURBE,
    }),
    prisma.guideRequest.findMany({
      where: { aimant: AIMANT_GUIDE_IA, createdAt: { gte: debut } },
      select: { createdAt: true },
      take: PLAFOND_COURBE,
    }),
    prisma.newsletterSubscriber.groupBy({
      by: ["source"],
      where: { status: "confirmed" },
      _count: { _all: true },
    }),
    prisma.guideRequest.groupBy({
      by: ["source"],
      where: { aimant: AIMANT_GUIDE_IA },
      _count: { _all: true },
    }),
  ]);

  const compte = (s: NewsletterStatus): number =>
    parStatut.find((r) => r.status === s)?._count._all ?? 0;
  const confirmes = compte("confirmed");
  const enAttente = compte("pending");
  const desabonnes = compte("unsubscribed");
  const rejetes = compte("bounced");
  const tous = confirmes + enAttente + desabonnes + rejetes;

  const grille = new Map<
    string,
    { inscriptions: number; desabonnements: number; demandesGuide: number }
  >(mois.map((m) => [m, { inscriptions: 0, desabonnements: 0, demandesGuide: 0 }]));
  for (const r of inscrits) {
    if (r.confirmedAt) {
      const p = grille.get(cleMois(r.confirmedAt));
      if (p) p.inscriptions++;
    }
  }
  for (const r of partis) {
    if (r.unsubscribedAt) {
      const p = grille.get(cleMois(r.unsubscribedAt));
      if (p) p.desabonnements++;
    }
  }
  for (const r of demandesDates) {
    const p = grille.get(cleMois(r.createdAt));
    if (p) p.demandesGuide++;
  }

  const trier = (
    rows: ReadonlyArray<{ source: string | null; _count: { _all: number } }>,
  ): Array<{ source: string | null; n: number }> =>
    rows.map((r) => ({ source: r.source, n: r._count._all })).sort((a, b) => b.n - a.n);

  return {
    confirmes,
    enAttente,
    desabonnes,
    rejetes,
    abonnesTous: tous,
    tauxDesabonnement: pourcentage(desabonnes, confirmes + desabonnes),
    tauxRejet: pourcentage(rejetes, tous),
    demandes,
    demandesEnvoyees,
    demandesVues,
    demandesCliquees,
    tauxClic: plafonne100(pourcentage(envoyeesCliquees, demandesEnvoyees)),
    parMois: mois.map((m) => ({ mois: m, ...grille.get(m)! })),
    abonnesParSource: trier(abonnesSource),
    demandesParSource: trier(demandesSource),
  };
}

// ============================================================
// Tuile d'accueil
// ============================================================

export interface TuileGuideLettre {
  readonly abonnesConfirmes: number;
  readonly demandes30j: number;
  /**
   * Demandes du FORMULAIRE, des 7 derniers jours (l'horizon du rattrapage),
   * sans envoi depuis plus d'une heure — hors celles retenues en validation
   * et celles d'une adresse en rebond dur : ce qui reste est à regarder.
   */
  readonly demandesEnSouffrance: number;
}

const TUILE_VIDE: TuileGuideLettre = {
  abonnesConfirmes: 0,
  demandes30j: 0,
  demandesEnSouffrance: 0,
};

/** Plafond de lecture de la tuile : au-delà, la tuile dit « au moins ». */
const PLAFOND_TUILE = 500;

/** Demandes en retard, hors celles qu'une cause CONNUE retient (validation, rebond dur). */
async function compterEnSouffrance(maintenant: Date): Promise<number> {
  const t = maintenant.getTime();
  const enRetard = await prisma.guideRequest.findMany({
    where: {
      aimant: AIMANT_GUIDE_IA,
      // Une demande console est un geste humain : l'administrateur voit
      // l'issue au clic, et le rattrapage ne la reprend jamais.
      origine: "formulaire",
      sentAt: null,
      createdAt: { gte: new Date(t - HORIZON_RATTRAPAGE_MS), lte: new Date(t - 3_600_000) },
    },
    select: { id: true, email: true },
    take: PLAFOND_TUILE,
  });
  if (enRetard.length === 0) return 0;
  const [garees, rebonds] = await Promise.all([
    prisma.emailOutbox.findMany({
      where: {
        entityType: ENTITE_GUIDE,
        entityId: { in: enRetard.map((d) => d.id) },
        statut: "a_valider",
      },
      select: { entityId: true },
    }),
    prisma.emailLog.findMany({
      where: {
        recipient: { in: enRetard.map((d) => d.email) },
        status: "bounced",
        bounceType: "hard",
      },
      select: { recipient: true },
    }),
  ]);
  const retenues = new Set(garees.map((g) => g.entityId));
  const mortes = new Set(rebonds.map((r) => r.recipient.toLowerCase()));
  return enRetard.filter((d) => !retenues.has(d.id) && !mortes.has(d.email.toLowerCase())).length;
}

/** Ne lève jamais : une tuile d'accueil ne doit pas faire tomber le tableau de bord. */
export async function lireTuileGuideLettre(
  maintenant: Date = new Date(),
): Promise<TuileGuideLettre> {
  try {
    const t = maintenant.getTime();
    const [abonnesConfirmes, demandes30j, demandesEnSouffrance] = await Promise.all([
      prisma.newsletterSubscriber.count({ where: { status: "confirmed" } }),
      prisma.guideRequest.count({
        where: { aimant: AIMANT_GUIDE_IA, createdAt: { gte: new Date(t - 30 * 86_400_000) } },
      }),
      compterEnSouffrance(maintenant),
    ]);
    return { abonnesConfirmes, demandes30j, demandesEnSouffrance };
  } catch {
    return TUILE_VIDE;
  }
}
