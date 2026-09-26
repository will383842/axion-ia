/**
 * DURÉES DE CONSERVATION DE LA LETTRE ET DU GUIDE (lot L6, 2026-09-25 ;
 * relecture du même jour).
 *
 * Appelé par la purge quotidienne existante (`retention-purge-worker.ts`,
 * 03:00 UTC) — aucun planificateur de plus. Chaque règle est celle que la
 * politique de confidentialité ANNONCE (`src/content/legal.ts`, section « Guide
 * IA entreprise et lettre d'information ») ; le registre art. 30 les reprend.
 *
 * `purgerLettreEtGuide` applique SEPT règles :
 *
 *   1. inscription `pending` jamais confirmée (ancien double opt-in) : 30 jours ;
 *   2. abonné `confirmed` sans contact de SA part depuis 3 ans : supprimé ;
 *   3. abonné `bounced` (échec de distribution définitif) : 3 ans APRÈS LE
 *      REBOND (`bouncedAt`), même règle que les désinscrits ;
 *   4. demande du guide sans demande ni clic de la personne depuis 3 ans ;
 *   5. journal d'envoi (`email_logs`) de l'e-mail « Votre guide » et de la
 *      confirmation de la lettre : 3 ans. Ces gabarits sont transactionnels
 *      (`marketing: false`), donc gardés 5 ans par la règle générale — durée
 *      des PIÈCES Qualiopi dont ce journal est la preuve d'envoi. Un envoi du
 *      guide ne prouve aucune pièce : son adresse en clair ne doit pas survivre
 *      deux ans à la demande elle-même ;
 *   6. preuve de l'information ou du consentement (`consent_events` des SEULES
 *      références de la lettre et du guide) : 5 ans après la FIN de
 *      l'inscription. Les preuves des autres formulaires ne sont pas touchées ;
 *   7. agents navigateur en clair de `consent_events` : hachés (`h:`), jamais
 *      supprimés — rattrapage des lignes écrites avant le lot.
 *
 * Deux fonctions à part, appelées chacune dans son propre `try` du worker :
 * `purgerDesinscrits` (désinscrits à 3 ans, empreinte gardée en liste
 * d'opposition) et `purgerOutboxCrm` (charges déjà acquittées par le CRM, à
 * 30 jours).
 *
 * ## « Dernier contact » — seules comptent les actions de LA PERSONNE
 *
 * Le référentiel CNIL « gestion des activités commerciales » compte 3 ans à
 * partir du dernier contact **émanant de la personne**. On ne retient donc que
 * les dates où ELLE a agi :
 *
 *   · demande du guide : `derniereDemandeFormulaireAt` (dernière demande par le
 *     formulaire public — seul `guide-ia/demande.ts` l'écrit) et `lastClickAt`
 *     (DERNIER clic sur le bouton de téléchargement ; audit du 26/09 : on ne
 *     comptait que le premier, `firstClickAt`, gardé ici par sûreté — il ne
 *     lui est jamais postérieur).
 *
 *     ⚠️ Fenêtre app/worker : cette purge tourne dans le worker, qui atterrit
 *     ~50 min avant la migration de `last_click_at`. Si la colonne manque
 *     (P2022), la requête est rejouée SANS elle — la règle d'avant, jamais
 *     plus agressive (`sansDernierClicSiAbsent`). `createdAt` sert de PLANCHER : une
 *     ligne ne disparaît pas avant 3 ans d'existence, ce qui couvre la ligne
 *     créée par un envoi console (`origine = admin`) — cette date ne bouge
 *     jamais, elle ne prolonge donc rien ;
 *   · abonné : `createdAt` (inscription), `confirmedAt` (confirmation ou
 *     réinscription), `lastClickAt` (clic dans une lettre, s'il existe), ET,
 *     pour la même adresse (recherche par `emailKey`, l'empreinte indexée,
 *     insensible à la casse), la dernière demande du guide par le formulaire et
 *     le clic sur le bouton de téléchargement.
 *
 * ⛔ Ce qui N'EST PAS un contact, à dessein :
 *   · `queuedAt` et `sentAt` de la demande du guide — la console (« Renvoyer
 *     le guide ») et le rattrapage les avancent sans geste de la personne. Les
 *     compter ferait d'un renvoi console une prolongation de 3 ans ;
 *   · `createdAt` d'une ligne `origine = admin` pour l'ABONNÉ : c'est un geste
 *     de l'équipe, pas de la personne ;
 *   · `lastSentAt` — une lettre ENVOYÉE sans réponse. La compter ferait de
 *     chaque envoi une prolongation automatique : la liste ne vieillirait
 *     jamais ;
 *   · `firstSeenAt` — le premier GET du lien personnel, qu'un antivirus
 *     (Safe Links, prévisualisation) déclenche sans la personne ;
 *   · `updatedAt` — n'importe quelle écriture technique l'avance.
 *
 * ## L'asymétrie demande / abonné, voulue
 *
 * Une demande du guide rattache l'ABONNÉ (redemander le guide, c'est se
 * manifester auprès de nous), mais l'activité de l'abonné ne prolonge PAS la
 * demande du guide : un clic dans une lettre ne dit rien d'un besoin de
 * renvoyer le guide. La demande vit 3 ans après la dernière demande ou le
 * dernier clic sur son bouton ; c'est exactement ce que la politique annonce.
 *
 * ## « Fin de l'inscription » — l'événement `fin`
 *
 * Les 5 ans de la preuve courent depuis la FIN de l'inscription. Quand la
 * purge supprime un abonné (inactivité, rebond, désinscription à son terme),
 * elle AJOUTE au registre une ligne `fin` datée de la fin réelle (le jour de la
 * purge, du rebond ou de la désinscription). La règle 6 ne supprime les
 * preuves d'une personne que si (a) sa ligne la plus récente pour ces
 * références a plus de 5 ans ET (b) aucune ligne d'abonné n'existe encore pour
 * son adresse. Un effacement demandé par la personne (art. 17) n'écrit pas de
 * `fin` : sa preuve peut donc partir plus tôt, à sa demande.
 *
 * ## Ce qui n'est JAMAIS supprimé ici
 *
 * `email_oppositions` (liste d'opposition, sans limite de durée — annoncé), les
 * preuves des AUTRES formulaires (candidatures, contact…), et les fiches
 * `Prospection*` (décision de Will du 2026-08-20). Verrou :
 * `src/server/newsletter/__tests__/retention.spec.ts`.
 *
 * ## Journal
 *
 * Des COMPTES seulement, jamais d'adresse ni d'empreinte : une purge par âge ne
 * répond à aucune demande individuelle, rien ne justifie d'en garder la liste.
 * (Exception héritée : `purgerDesinscrits` garde la trace `newsletter.purged`
 * du worker d'origine, SHA-256 de l'adresse, purgée à 12 mois — relue d'ici là
 * par la liste de suppression, `exports.ts`.)
 *
 * ⚠️ `deleteMany` seulement sur les abonnés et les demandes : il ne relit
 * aucune colonne (pas de RETURNING *).
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { hashUserAgent, PREFIXE_AGENT_HACHE } from "@/lib/security/ip-hash";
import { FORM_REF_LETTRE, FORM_REF_REINSCRIPTION } from "@/content/guide-ia-formulaire";
import type { Prisma } from "../../../prisma/generated/client";
import { VERSION_LETTRE_HISTORIQUE } from "./versions";

export const DUREES_LETTRE_GUIDE = {
  /** `pending` jamais confirmé — « inscription jamais confirmée (ancien parcours), 30 jours ». */
  pendingJours: 30,
  /** Abonné confirmé — « 3 ans après votre inscription, votre dernière demande du guide ou votre dernier clic dans une lettre ». */
  abonneInactifMois: 36,
  /** Demande du guide — « 3 ans après votre dernière demande ou votre dernier clic sur le bouton de téléchargement ». */
  demandeGuideMois: 36,
  /** Adresse en échec de distribution définitif — « 3 ans, pour ne plus y écrire ». */
  rebondMois: 36,
  /** Preuve de l'information ou du consentement — « 5 ans après la fin de votre inscription ». */
  preuveMois: 60,
} as const;

export interface DureesLettreGuide {
  readonly pendingJours: number;
  readonly abonneInactifMois: number;
  readonly demandeGuideMois: number;
  readonly rebondMois: number;
  readonly preuveMois: number;
}

export interface ResultatPurgeLettreGuide {
  readonly pendingPurges: number;
  readonly abonnesInactifsPurges: number;
  /** Abonnés au-delà du seuil, gardés parce qu'une demande ou un clic du guide récent les rattache. */
  readonly abonnesGardesParDemandeRecente: number;
  readonly rebondsPurges: number;
  readonly demandesGuidePurgees: number;
  readonly journauxEnvoiPurges: number;
  /** Lignes de preuve (lettre et guide) supprimées à 5 ans après la fin. */
  readonly preuvesPurgees: number;
  /** Agents navigateur en clair hachés (lignes mises à jour, aucune supprimée). */
  readonly agentsHaches: number;
}

/** Gabarits dont le journal suit la durée de la lettre et du guide, pas celle des pièces. */
export const GABARITS_LETTRE_GUIDE = ["guide-ia-envoi", "newsletter-confirm-optin"] as const;

/**
 * Références du registre de preuve propres à la lettre et au guide — les
 * SEULES que la règle 6 peut supprimer. Mêmes sources que `FORM_REFS_LETTRE`
 * de la console (`newsletter/console`), recomposées ici sans tirer ce module-là.
 */
export const FORM_REFS_PREUVE_LETTRE_GUIDE: ReadonlyArray<string> = [
  CONSENT_FORM_REFS.newsletter,
  ...Object.values(FORM_REF_LETTRE),
  FORM_REF_REINSCRIPTION,
];

/** Source des empreintes gardées sans limite après une désinscription (`email_oppositions.source`). */
export const SOURCE_OPPOSITION_DESINSCRIT = "lettre-desinscription-3-ans";

function moisAvant(maintenant: Date, mois: number): Date {
  const d = new Date(maintenant.getTime());
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d;
}

function joursAvant(maintenant: Date, jours: number): Date {
  return new Date(maintenant.getTime() - jours * 86_400_000);
}

/** Une date absente ou antérieure à la limite : la condition « pas de contact depuis ». */
function avantAbonne(
  champ: "confirmSentAt" | "confirmedAt" | "lastClickAt",
  limite: Date,
): Prisma.NewsletterSubscriberWhereInput {
  return { OR: [{ [champ]: null }, { [champ]: { lt: limite } }] };
}

function avantDemande(
  champ: "derniereDemandeFormulaireAt" | "firstClickAt" | "lastClickAt",
  limite: Date,
): Prisma.GuideRequestWhereInput {
  return { OR: [{ [champ]: null }, { [champ]: { lt: limite } }] };
}

/** Colonne absente de la base (Prisma P2022) : migration pas encore jouée. */
function estColonneAbsente(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2022";
}

/**
 * Exécute `requete(true)` (avec `last_click_at`) ; si la colonne n'existe pas
 * encore (fenêtre app/worker), rejoue `requete(false)` — la règle d'avant, qui
 * ne comptait que le premier clic. Toute autre erreur remonte.
 */
async function sansDernierClicSiAbsent<T>(
  requete: (avecDernierClic: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await requete(true);
  } catch (e) {
    if (!estColonneAbsente(e)) throw e;
    return requete(false);
  }
}

/** Lit une durée d'environnement ; toute valeur < 1 retombe sur le défaut (anti-misconfig). */
export function lireDuree(nom: string, defaut: number): number {
  const brut = process.env[nom];
  if (!brut) return defaut;
  const n = parseInt(brut, 10);
  return Number.isFinite(n) && n >= 1 ? n : defaut;
}

export function dureesDepuisEnvironnement(): DureesLettreGuide {
  return {
    pendingJours: lireDuree("RETENTION_NEWSLETTER_PENDING_DAYS", DUREES_LETTRE_GUIDE.pendingJours),
    abonneInactifMois: lireDuree(
      "RETENTION_NEWSLETTER_INACTIVE_MONTHS",
      DUREES_LETTRE_GUIDE.abonneInactifMois,
    ),
    demandeGuideMois: lireDuree(
      "RETENTION_GUIDE_REQUESTS_MONTHS",
      DUREES_LETTRE_GUIDE.demandeGuideMois,
    ),
    rebondMois: lireDuree("RETENTION_NEWSLETTER_BOUNCED_MONTHS", DUREES_LETTRE_GUIDE.rebondMois),
    preuveMois: lireDuree("RETENTION_LETTRE_PREUVES_MONTHS", DUREES_LETTRE_GUIDE.preuveMois),
  };
}

const LOT = 500;

interface AbonneSortant {
  readonly id: string;
  readonly email: string;
  readonly consentFormRef: string | null;
  readonly consentVersion: string | null;
}

const SELECTION_SORTANT = {
  id: true,
  email: true,
  consentFormRef: true,
  consentVersion: true,
} as const;

/**
 * Ajoute la ligne `fin` au registre, sous la référence et la version de
 * l'inscription qui se termine. Best-effort (`recordConsentEvent` ne lève
 * jamais) : rend `false` si la preuve n'a pas pu être écrite.
 */
function consignerFin(abonne: AbonneSortant, fin: Date): Promise<boolean> {
  return recordConsentEvent({
    email: abonne.email,
    formRef: abonne.consentFormRef ?? CONSENT_FORM_REFS.newsletter,
    consentVersion: abonne.consentVersion ?? VERSION_LETTRE_HISTORIQUE,
    action: "fin",
    occurredAt: fin,
  });
}

export async function purgerLettreEtGuide(
  maintenant: Date = new Date(),
  durees: DureesLettreGuide = dureesDepuisEnvironnement(),
): Promise<ResultatPurgeLettreGuide> {
  // 1) `pending` : ni créé, ni relancé depuis 30 jours. Aucune preuve n'a été
  //    écrite pour une inscription jamais confirmée : pas de `fin`.
  const limitePending = joursAvant(maintenant, durees.pendingJours);
  const pending = await prisma.newsletterSubscriber.deleteMany({
    where: {
      status: "pending",
      createdAt: { lt: limitePending },
      AND: [avantAbonne("confirmSentAt", limitePending)],
    },
  });

  // 2) abonnés confirmés sans contact de LEUR part depuis 3 ans.
  const limiteAbonne = moisAvant(maintenant, durees.abonneInactifMois);
  const clauseInactif: Prisma.NewsletterSubscriberWhereInput = {
    status: "confirmed",
    createdAt: { lt: limiteAbonne },
    AND: [avantAbonne("confirmedAt", limiteAbonne), avantAbonne("lastClickAt", limiteAbonne)],
  };
  const candidats: AbonneSortant[] = await prisma.newsletterSubscriber.findMany({
    where: clauseInactif,
    select: SELECTION_SORTANT,
  });

  let abonnesInactifsPurges = 0;
  let abonnesGardesParDemandeRecente = 0;
  for (let i = 0; i < candidats.length; i += LOT) {
    const lot = candidats.slice(i, i + LOT);
    // Recherche par EMPREINTE (`emailKey`, indexée, normalisée) : une
    // différence de casse ne détache pas la demande de son abonné.
    const cles = new Map<string, string>();
    for (const c of lot) {
      const k = hashEmailForLookup(c.email);
      if (k) cles.set(c.id, k);
    }
    const recentes = await sansDernierClicSiAbsent((avecDernierClic) =>
      prisma.guideRequest.findMany({
        where: {
          emailKey: { in: [...new Set(cles.values())] },
          OR: [
            { derniereDemandeFormulaireAt: { gte: limiteAbonne } },
            { firstClickAt: { gte: limiteAbonne } },
            ...(avecDernierClic ? [{ lastClickAt: { gte: limiteAbonne } }] : []),
          ],
        },
        select: { emailKey: true },
      }),
    );
    const actives = new Set(recentes.map((r) => r.emailKey));
    for (const c of lot) {
      const k = cles.get(c.id);
      if (k !== undefined && actives.has(k)) {
        abonnesGardesParDemandeRecente += 1;
        continue;
      }
      // La clause d'inactivité est REJOUÉE dans la suppression : un clic arrivé
      // entre la lecture et l'écriture garde la ligne. Et la `fin` n'est écrite
      // que pour une ligne RÉELLEMENT supprimée.
      const r = await prisma.newsletterSubscriber.deleteMany({
        where: { id: c.id, ...clauseInactif },
      });
      if (r.count === 1) {
        abonnesInactifsPurges += 1;
        await consignerFin(c, maintenant);
      }
    }
  }

  // 3) adresses rejetées (rebond dur) : 3 ans après le rebond. `bouncedAt`
  //    manque sur une ligne passée `bounced` avant la colonne (et non reprise
  //    par la migration) : repli sur `updatedAt`, postérieur au rebond — il ne
  //    raccourcit jamais la durée annoncée.
  const limiteRebond = moisAvant(maintenant, durees.rebondMois);
  const clauseRebond: Prisma.NewsletterSubscriberWhereInput = {
    status: "bounced",
    OR: [{ bouncedAt: { lt: limiteRebond } }, { bouncedAt: null, updatedAt: { lt: limiteRebond } }],
  };
  const rejetes = await prisma.newsletterSubscriber.findMany({
    where: clauseRebond,
    select: { ...SELECTION_SORTANT, bouncedAt: true, updatedAt: true },
  });
  let rebondsPurges = 0;
  for (const a of rejetes) {
    const r = await prisma.newsletterSubscriber.deleteMany({
      where: { id: a.id, ...clauseRebond },
    });
    if (r.count === 1) {
      rebondsPurges += 1;
      await consignerFin(a, a.bouncedAt ?? a.updatedAt);
    }
  }

  // 4) demandes du guide sans demande ni clic de la personne depuis 3 ans —
  //    le DERNIER clic (`lastClickAt`), pas le premier.
  const limiteGuide = moisAvant(maintenant, durees.demandeGuideMois);
  const guide = await sansDernierClicSiAbsent((avecDernierClic) =>
    prisma.guideRequest.deleteMany({
      where: {
        createdAt: { lt: limiteGuide },
        AND: [
          avantDemande("derniereDemandeFormulaireAt", limiteGuide),
          avantDemande("firstClickAt", limiteGuide),
          ...(avecDernierClic ? [avantDemande("lastClickAt", limiteGuide)] : []),
        ],
      },
    }),
  );

  // 5) journaux d'envoi du guide et de la confirmation de la lettre.
  const journaux = await prisma.emailLog.deleteMany({
    where: { template: { in: [...GABARITS_LETTRE_GUIDE] }, createdAt: { lt: limiteGuide } },
  });

  // 6) preuves de la lettre et du guide : 5 ans après la fin de l'inscription.
  const preuvesPurgees = await purgerPreuvesLettreGuide(maintenant, durees.preuveMois);

  // 7) agents navigateur en clair : hachés, jamais supprimés.
  const agentsHaches = await hacherAgentsEnClair();

  return {
    pendingPurges: pending.count,
    abonnesInactifsPurges,
    abonnesGardesParDemandeRecente,
    rebondsPurges,
    demandesGuidePurgees: guide.count,
    journauxEnvoiPurges: journaux.count,
    preuvesPurgees,
    agentsHaches,
  };
}

/**
 * Règle 6. Ne supprime QUE des lignes dont `formRef` est une référence de la
 * lettre ou du guide, et seulement pour une personne (a) dont la ligne la plus
 * récente pour ces références a plus de `mois` mois et (b) qui n'a plus aucune
 * ligne d'abonné (une ligne existante, même désinscrite ou rejetée, veut dire
 * que la fin n'est pas encore consignée).
 */
async function purgerPreuvesLettreGuide(maintenant: Date, mois: number): Promise<number> {
  const limite = moisAvant(maintenant, mois);
  const refs = [...FORM_REFS_PREUVE_LETTRE_GUIDE];
  const vieilles = await prisma.consentEvent.findMany({
    where: { formRef: { in: refs }, occurredAt: { lt: limite } },
    select: { personKey: true },
  });
  const candidates = new Set(vieilles.map((v) => v.personKey));
  if (candidates.size === 0) return 0;

  const recentes = await prisma.consentEvent.findMany({
    where: {
      personKey: { in: [...candidates] },
      formRef: { in: refs },
      occurredAt: { gte: limite },
    },
    select: { personKey: true },
  });
  for (const r of recentes) candidates.delete(r.personKey);
  if (candidates.size === 0) return 0;

  // (b) Les abonnés n'ont pas de colonne d'empreinte : on hache leurs adresses.
  // Lecture limitée aux candidats restants ; la table de la lettre reste de
  // taille modeste (quelques milliers de lignes au plus).
  const abonnes = await prisma.newsletterSubscriber.findMany({ select: { email: true } });
  for (const a of abonnes) {
    const k = hashEmailForLookup(a.email);
    if (k) candidates.delete(k);
  }

  let total = 0;
  const restantes = [...candidates];
  for (let i = 0; i < restantes.length; i += LOT) {
    const r = await prisma.consentEvent.deleteMany({
      where: { personKey: { in: restantes.slice(i, i + LOT) }, formRef: { in: refs } },
    });
    total += r.count;
  }
  return total;
}

/**
 * Règle 7. Idempotent : une valeur déjà hachée porte le préfixe `h:` et n'est
 * plus relue. Met à jour par VALEUR distincte (un même navigateur revient sur
 * beaucoup de lignes). Aucune ligne n'est supprimée. Borné à 20 lots de 1 000
 * lignes par passe : un reliquat plus gros finit les nuits suivantes.
 */
async function hacherAgentsEnClair(): Promise<number> {
  let total = 0;
  for (let passe = 0; passe < 20; passe += 1) {
    const lignes = await prisma.consentEvent.findMany({
      where: {
        userAgent: { not: null },
        NOT: { userAgent: { startsWith: PREFIXE_AGENT_HACHE } },
      },
      select: { userAgent: true },
      take: 1_000,
    });
    if (lignes.length === 0) break;
    const valeurs = new Set(lignes.map((l) => l.userAgent).filter((v): v is string => !!v));
    for (const valeur of valeurs) {
      // Lève en production si le sel manque : la passe s'arrête (le worker
      // l'attrape), aucune valeur n'est écrite à moitié.
      const empreinte = hashUserAgent(valeur);
      const r = await prisma.consentEvent.updateMany({
        where: { userAgent: valeur },
        data: { userAgent: empreinte },
      });
      total += r.count;
    }
    if (lignes.length < 1_000) break;
  }
  return total;
}

export interface ResultatPurgeDesinscrits {
  readonly purges: number;
  /** Empreintes posées en liste d'opposition (nouvelles, hors celles qui existaient). */
  readonly empreintesGardees: number;
  /** Lignes laissées en place faute d'avoir pu poser l'empreinte (reprises demain). */
  readonly reportes: number;
}

/** SHA-256 de l'adresse normalisée — le format de la trace héritée du worker. */
function sha256Adresse(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

/**
 * Désinscrits : l'adresse est gardée 3 ans (`RETENTION_NEWSLETTER_UNSUB_MONTHS`),
 * « puis seule une empreinte en est conservée, sans limite de durée, pour
 * qu'aucun envoi ne vous parvienne ». L'empreinte vit dans `email_oppositions`
 * (HMAC `hashEmailForLookup`, jamais l'adresse), que `verdict-envoi.ts` lit
 * avant tout envoi marketing ou de sollicitation.
 *
 * Ordre, par ligne : (1) empreinte — si elle échoue, la ligne RESTE et la purge
 * repasse demain : supprimer l'adresse sans son empreinte rendrait la promesse
 * fausse ; (2) suppression conditionnelle ; (3) `fin` au registre, datée de la
 * désinscription ; (4) trace `newsletter.purged` (héritée du worker).
 *
 * ⚠️ Aucune synchronisation CRM ici : le CRM a reçu `newsletter_optout` au
 * moment de la désinscription.
 */
export async function purgerDesinscrits(
  maintenant: Date,
  mois: number,
): Promise<ResultatPurgeDesinscrits> {
  const limite = moisAvant(maintenant, mois);
  const clause: Prisma.NewsletterSubscriberWhereInput = {
    status: "unsubscribed",
    unsubscribedAt: { lt: limite },
  };
  const anciens = await prisma.newsletterSubscriber.findMany({
    where: clause,
    select: { ...SELECTION_SORTANT, unsubscribedAt: true },
  });
  let purges = 0;
  let empreintesGardees = 0;
  let reportes = 0;
  for (const a of anciens) {
    const emailHash = hashEmailForLookup(a.email);
    if (!emailHash) {
      reportes += 1;
      continue;
    }
    try {
      const existante = await prisma.emailOpposition.findUnique({
        where: { emailHash },
        select: { id: true },
      });
      if (existante === null) {
        await prisma.emailOpposition.create({
          data: { emailHash, source: SOURCE_OPPOSITION_DESINSCRIT },
          select: { id: true },
        });
        empreintesGardees += 1;
      }
    } catch {
      reportes += 1;
      continue;
    }
    const r = await prisma.newsletterSubscriber.deleteMany({ where: { id: a.id, ...clause } });
    if (r.count !== 1) continue;
    purges += 1;
    await consignerFin(a, a.unsubscribedAt ?? maintenant);
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "newsletter.purged",
        targetType: "newsletter_subscriber",
        targetId: a.id,
        changes: { emailHash: sha256Adresse(a.email), policy: "retention", ageMonths: mois },
      },
    });
  }
  return { purges, empreintesGardees, reportes };
}

/**
 * `crm_sync_outbox` : la charge porte les données de la personne EN CLAIR
 * (déchiffrées à la construction). Une ligne `sent` est acquittée par le CRM :
 * la garder ne sert qu'à la console de santé, 30 jours suffisent. Les lignes
 * `pending`, `failed` et `gave_up` ne sont JAMAIS purgées par l'âge : ce sont
 * des envois non aboutis, qu'un humain doit voir (même doctrine que la
 * corbeille `a_valider` d'`email_outbox`).
 */
export const OUTBOX_CRM_ENVOYEE_JOURS = 30;

export async function purgerOutboxCrm(
  maintenant: Date = new Date(),
  jours: number = lireDuree("RETENTION_CRM_OUTBOX_SENT_DAYS", OUTBOX_CRM_ENVOYEE_JOURS),
): Promise<number> {
  const limite = joursAvant(maintenant, jours);
  const r = await prisma.crmSyncOutbox.deleteMany({
    where: {
      status: "sent",
      OR: [{ sentAt: { lt: limite } }, { sentAt: null, createdAt: { lt: limite } }],
    },
  });
  return r.count;
}
