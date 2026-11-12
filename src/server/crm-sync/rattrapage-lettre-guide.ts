/**
 * RATTRAPAGE DE LA LETTRE ET DU GUIDE VERS LE CRM (lot L4-S, 2026-09-25).
 *
 * Deux populations n'ont jamais été transmises, et le geste en direct ne les
 * reprendra pas tout seul :
 *
 *   1. les DEMANDES DU GUIDE cliquées avant l'ouverture de
 *      `CRM_SYNC_GUIDE_ENABLED` (`first_click_at` rempli, `crm_emitted_at`
 *      vide) — le clic a eu lieu, l'émission non ;
 *   2. les ABONNÉS inscrits, à l'adresse VÉRIFIÉE, dont l'inscription n'a
 *      jamais atteint le CRM. « Vérifiée » = confirmée par un bouton (ancien
 *      double opt-in, réinscription), OU inscrite à la demande du guide ET dont
 *      la demande a été cliquée. Une inscription à la demande du guide jamais
 *      cliquée reste HORS du CRM (décision D1 : l'adresse a pu être saisie par
 *      un tiers). Y compris l'inscription d'une demande déjà transmise, mais
 *      partie sans elle (faite après le clic, ou non écrite).
 *
 * Quatre garanties :
 *   · À BLANC PAR DÉFAUT : sans `executer`, aucune écriture, aucune file —
 *     seulement des COMPTES. Jamais une adresse, ni en sortie ni au journal ;
 *   · REJOUABLE : les `event_id` sont DÉTERMINISTES (`event-id.ts`) et chaque
 *     transmission passe par la même fonction que le geste en direct, qui
 *     réserve la ligne avant d'écrire. Deux passages = zéro doublon ;
 *   · EXCLUSIONS : les adresses passées à l'exécution (décision D4) ET les
 *     empreintes de `CRM_SYNC_EXCLUSIONS_SHA256` (persistantes). Comptées
 *     AVANT tout autre classement. Aucune adresse n'est écrite dans ce dépôt ;
 *   · OPPOSITIONS : une adresse opposée à la prospection (`email_oppositions`)
 *     n'est jamais transmise, et elle est comptée.
 *
 * Lecture PAR LOTS de `TAILLE_LOT`, par curseur sur l'identifiant : la mémoire
 * ne dépend pas de la taille des tables, seulement de ce qui est à transmettre.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../prisma/generated/client";
import { FORM_REF_LETTRE } from "@/content/guide-ia-formulaire";

import {
  coupureOriginesSuivantes,
  MAX_ORIGINES_PAR_CHARGE,
  transmettreOriginesSuivantes,
} from "@/server/guides-reseau/synchro-v3";

export { coupureOriginesSuivantes };

import { isCrmSyncGuideEnabled } from "./config";
import { estExclueDuCrm } from "./exclusions";
import {
  SELECT_ABONNE_POUR_CRM,
  transmettreClicGuide,
  transmettreInscriptionLettre,
  type AbonnePourCrm,
} from "./lettre-guide";
import { adressesOpposees } from "./oppositions-par-lot";

/** Taille d'un lot de lecture. */
export const TAILLE_LOT = 500;

export interface OptionsRattrapage {
  /** `true` pour écrire vraiment. Absent ou `false` : à blanc. */
  readonly executer?: boolean;
  /** Adresses à écarter (répétable en ligne de commande, ou sur l'entrée standard). */
  readonly exclure?: readonly string[];
}

export interface BilanRattrapage {
  readonly mode: "a-blanc" | "execution";
  /** Refus d'exécuter : drapeau fermé. Rien n'a été écrit. */
  readonly refus?: "drapeau-guide-ferme";
  readonly demandes: {
    /** Cliquées et jamais transmises, ni exclues ni opposées. */
    readonly aTransmettre: number;
    /** Écartées par `--exclure` ou `CRM_SYNC_EXCLUSIONS_SHA256`. */
    readonly exclues: number;
    /** Opposées à la prospection : jamais transmises. */
    readonly opposees: number;
    readonly transmises: number;
    readonly dejaTransmises: number;
    /** Demande partie, inscription qui l'accompagne NON écrite. */
    readonly inscriptionsNonEcrites: number;
    readonly echecs: number;
  };
  readonly abonnes: {
    /** Inscrits (`confirmed`) examinés. */
    readonly examines: number;
    readonly exclus: number;
    readonly opposes: number;
    /** Inscription à la demande du guide, demande jamais cliquée : hors CRM. */
    readonly nonVerifies: number;
    readonly dejaTransmis: number;
    /** Leur inscription part avec une demande cliquée ci-dessus. */
    readonly avecLaDemande: number;
    readonly aTransmettre: number;
    readonly transmis: number;
    readonly echecs: number;
  };
}

const INSCRIPTION_PAR_LE_GUIDE: ReadonlySet<string> = new Set(Object.values(FORM_REF_LETTRE));

function normaliser(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/** Parcourt une table par lots de `TAILLE_LOT`, curseur sur l'identifiant. */
async function* parLots<T extends { id: string }>(
  lire: (apres: string | null) => Promise<T[]>,
): AsyncGenerator<T[]> {
  let curseur: string | null = null;
  for (;;) {
    const lot = await lire(curseur);
    if (lot.length === 0) return;
    yield lot;
    if (lot.length < TAILLE_LOT) return;
    curseur = lot[lot.length - 1]!.id;
  }
}

function apres(curseur: string | null): { id?: { gt: string } } {
  return curseur === null ? {} : { id: { gt: curseur } };
}

export async function rattraperLettreEtGuide(
  options: OptionsRattrapage = {},
): Promise<BilanRattrapage> {
  const executer = options.executer === true;
  const exclues = new Set((options.exclure ?? []).map(normaliser).filter((a) => a.length > 0));
  const estExclue = (adresse: string): boolean =>
    exclues.has(normaliser(adresse)) || estExclueDuCrm(adresse);

  const demandes = {
    aTransmettre: 0,
    exclues: 0,
    opposees: 0,
    transmises: 0,
    dejaTransmises: 0,
    inscriptionsNonEcrites: 0,
    echecs: 0,
  };
  const abonnes = {
    examines: 0,
    exclus: 0,
    opposes: 0,
    nonVerifies: 0,
    dejaTransmis: 0,
    avecLaDemande: 0,
    aTransmettre: 0,
    transmis: 0,
    echecs: 0,
  };

  // ── 1. Demandes cliquées, jamais transmises ─────────────────────────────
  const demandesATransmettre: string[] = [];
  const avecDemandeEnAttente = new Set<string>();
  for await (const lot of parLots((curseur) =>
    prisma.guideRequest.findMany({
      where: { firstClickAt: { not: null }, crmEmittedAt: null, ...apres(curseur) },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
      take: TAILLE_LOT,
    }),
  )) {
    const opposees = await adressesOpposees(lot.map((d) => d.email));
    for (const d of lot) {
      if (estExclue(d.email)) demandes.exclues += 1;
      else if (opposees.has(normaliser(d.email))) demandes.opposees += 1;
      else {
        demandesATransmettre.push(d.id);
        avecDemandeEnAttente.add(normaliser(d.email));
      }
    }
  }
  demandes.aTransmettre = demandesATransmettre.length;

  // ── 2. Abonnés inscrits ─────────────────────────────────────────────────
  const abonnesATransmettre: AbonnePourCrm[] = [];
  for await (const lot of parLots<AbonnePourCrm>((curseur) =>
    prisma.newsletterSubscriber.findMany({
      where: { status: "confirmed", confirmedAt: { not: null }, ...apres(curseur) },
      select: SELECT_ABONNE_POUR_CRM,
      orderBy: { id: "asc" },
      take: TAILLE_LOT,
    }),
  )) {
    abonnes.examines += lot.length;

    // Adresses dont une demande du guide a été cliquée (vérification par le clic).
    const parLeGuide = lot.filter(
      (a) => a.consentFormRef !== null && INSCRIPTION_PAR_LE_GUIDE.has(a.consentFormRef),
    );
    const cliquees = new Set(
      parLeGuide.length === 0
        ? []
        : (
            await prisma.guideRequest.findMany({
              where: { email: { in: parLeGuide.map((a) => a.email) }, firstClickAt: { not: null } },
              select: { email: true },
            })
          ).map((d) => normaliser(d.email)),
    );
    const idsParLeGuide = new Set(parLeGuide.map((a) => a.id));

    // Inscriptions déjà transmises (identifiant aléatoire d'avant ce lot, ou
    // déterministe) : une ligne `newsletter_optin` postérieure à l'inscription.
    // La plus récente par référence suffit.
    const derniereEmission = new Map<string, Date>();
    for (const e of await prisma.crmSyncOutbox.findMany({
      where: {
        subjectRef: { in: lot.map((a) => `site:newsletter_subscriber:${a.id}`) },
        eventType: "newsletter_optin",
      },
      select: { subjectRef: true, createdAt: true },
    })) {
      const avant = derniereEmission.get(e.subjectRef);
      if (avant === undefined || e.createdAt > avant)
        derniereEmission.set(e.subjectRef, e.createdAt);
    }

    const opposees = await adressesOpposees(lot.map((a) => a.email));
    for (const a of lot) {
      const email = normaliser(a.email);
      const emise = derniereEmission.get(`site:newsletter_subscriber:${a.id}`);
      if (estExclue(a.email)) abonnes.exclus += 1;
      else if (opposees.has(email)) abonnes.opposes += 1;
      else if (idsParLeGuide.has(a.id) && !cliquees.has(email)) abonnes.nonVerifies += 1;
      else if (emise !== undefined && a.confirmedAt !== null && emise >= a.confirmedAt) {
        abonnes.dejaTransmis += 1;
      } else if (avecDemandeEnAttente.has(email)) abonnes.avecLaDemande += 1;
      else abonnesATransmettre.push(a);
    }
  }
  abonnes.aTransmettre = abonnesATransmettre.length;

  const bilan = {
    mode: executer ? ("execution" as const) : ("a-blanc" as const),
    demandes,
    abonnes,
  };

  if (!executer) return bilan;
  if (!isCrmSyncGuideEnabled()) return { ...bilan, refus: "drapeau-guide-ferme" };

  // ── Exécution : les demandes d'abord (elles emportent leur inscription) ──
  for (const id of demandesATransmettre) {
    const issue = await transmettreClicGuide(id);
    if (issue === "transmise") demandes.transmises += 1;
    else if (issue === "deja-transmise") demandes.dejaTransmises += 1;
    else if (issue === "inscription-non-ecrite") demandes.inscriptionsNonEcrites += 1;
    else if (issue === "opposee") demandes.opposees += 1;
    else if (issue === "exclue") demandes.exclues += 1;
    else demandes.echecs += 1;
  }
  for (const a of abonnesATransmettre) {
    const issue = await transmettreInscriptionLettre(a);
    if (issue === "ecrite") abonnes.transmis += 1;
    else if (issue === "deja") abonnes.dejaTransmis += 1;
    else if (issue === "opposee") abonnes.opposes += 1;
    else if (issue === "exclue") abonnes.exclus += 1;
    else abonnes.echecs += 1;
  }
  return bilan;
}

export interface ArgumentsRattrapage {
  executer: boolean;
  exclure: string[];
  /** `--exclure-stdin` : lire les adresses à exclure sur l'entrée standard. */
  exclureStdin: boolean;
  erreur?: string;
}

/**
 * Arguments de `scripts/crm-sync-rattrapage-lettre-guide.ts`. À blanc par
 * défaut ; `--exclure <adresse>` répétable ; `--exclure-stdin` (une adresse
 * par ligne sur l'entrée standard, rien dans l'historique du shell) ;
 * `--executer` pour agir.
 */
export function lireArgumentsRattrapage(argv: readonly string[]): ArgumentsRattrapage {
  const exclure: string[] = [];
  let executer = false;
  let aBlanc = false;
  let exclureStdin = false;
  const refus = (erreur: string): ArgumentsRattrapage => ({
    executer: false,
    exclure,
    exclureStdin: false,
    erreur,
  });
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--executer") executer = true;
    else if (arg === "--a-blanc") aBlanc = true;
    else if (arg === "--exclure-stdin") exclureStdin = true;
    else if (arg === "--exclure") {
      const valeur = argv[i + 1];
      if (!valeur || valeur.startsWith("--")) return refus("--exclure attend une adresse.");
      exclure.push(valeur);
      i += 1;
    } else {
      return refus(`argument inconnu : ${arg ?? ""}`);
    }
  }
  if (executer && aBlanc) return refus("--executer et --a-blanc sont incompatibles.");
  return { executer, exclure, exclureStdin };
}

/** Les adresses d'un texte lu sur l'entrée standard : une par ligne, lignes vides et `#` ignorés. */
export function adressesDeLEntree(texte: string): string[] {
  return texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

// ── Lot guide réseau 4 (O5) : les origines restées en route ─────────────────────────────────────

/** Délai laissé au chemin direct avant que le rattrapage ne reprenne une origine. */
export const DELAI_RATTRAPAGE_ORIGINES_MS = 10 * 60_000;

/**
 * Borne d'un passage : nombre maximal de lots de `TAILLE_LOT` lus (soit 10 000 origines).
 * La lecture ne porte que sur les personnes qui ont cliqué, et que sur leurs `MAX_ORIGINES_PAR_CHARGE`
 * origines les plus récentes (les autres ne partiront jamais : elles ne sont pas relues). Les origines
 * d'une adresse exclue ou hors format CRM passent `hors_charge` (mise à l'écart, rien de supprimé) au
 * premier passage : elles ne reviennent plus et ne mangent donc pas la borne. Au-delà de la borne, le
 * passage s'arrête et le journal le dit ; les origines non lues restent `NULL` et sont reprises au
 * passage suivant (les lignes déjà traitées en sont sorties).
 */
export const MAX_LOTS_ORIGINES = 20;

export interface OptionsRattrapageOrigines {
  readonly executer?: boolean;
  /**
   * Date de coupure (D3, `ORIGINES_SUIVANTES_DEPUIS`) : seules les origines écrites à partir de
   * cette date sont reprises ; les plus anciennes restent `NULL` (aucune fausse marque
   * « transmise »). SANS elle, le passage ne fait rien : la décision de Williams est attendue.
   */
  readonly depuis?: Date;
  readonly maintenant?: Date;
}

export interface BilanRattrapageOrigines {
  readonly mode: "a-blanc" | "execution";
  readonly refus?: "coupure-absente" | "colonne-absente";
  /** Groupes (personne, guide) ayant des origines en attente. */
  readonly groupes: number;
  readonly nonCliques: number;
  readonly transmis: number;
  readonly echecs: number;
  /** `true` si la borne `MAX_LOTS_ORIGINES` a été atteinte avant la fin de la table. */
  readonly borneAtteinte?: boolean;
}

/**
 * Reprend les origines `crm_statut IS NULL` d'une personne qui a cliqué : UNE transmission
 * cumulative par (personne, guide), par `transmettreOriginesSuivantes` (qui relit l'opposition
 * dans sa transaction). À blanc par défaut. Journal agrégé : jamais d'adresse ni d'empreinte.
 */
export async function rattraperOriginesSuivantes(
  options: OptionsRattrapageOrigines = {},
): Promise<BilanRattrapageOrigines> {
  const executer = options.executer === true;
  const mode = executer ? "execution" : "a-blanc";
  const vide = { groupes: 0, nonCliques: 0, transmis: 0, echecs: 0 };
  const depuis = options.depuis ?? coupureOriginesSuivantes();
  if (!depuis) return { mode, refus: "coupure-absente", ...vide };
  const maintenant = options.maintenant ?? new Date();
  const groupes = new Map<string, { emailKey: string; guide: string }>();
  // Curseur sur `id` (comme `parLots`) : les origines qui ne partiront pas (personne jamais
  // cliquée, exclue) ne bloquent plus la lecture des suivantes. Borné par `MAX_LOTS_ORIGINES`.
  let curseur: string | null = null;
  let borneAtteinte = false;
  try {
    for (let lot = 0; ; lot += 1) {
      if (lot >= MAX_LOTS_ORIGINES) {
        borneAtteinte = true;
        break;
      }
      // Seules les personnes qui ont cliqué (`first_click_at` ET `crm_emitted_at` posés) : les
      // origines des autres ne partiront pas avant leur clic et ne prennent pas de place dans la borne.
      const lt = new Date(maintenant.getTime() - DELAI_RATTRAPAGE_ORIGINES_MS);
      // Une seule requête. Rang = position parmi les origines ACTIVES encore dans la charge
      // (`NULL` ou `transmise`, de la plus récente à la plus ancienne) : au-delà de
      // `MAX_ORIGINES_PAR_CHARGE`, l'origine ne partira jamais et n'est pas relue.
      const depart = curseur ?? "00000000-0000-0000-0000-000000000000";
      const lignes: { id: string; emailKey: string; guide: string }[] = await prisma.$queryRaw(
        Prisma.sql`
          SELECT r.id::text AS "id", r.email_key AS "emailKey", r.guide AS "guide"
          FROM (
            SELECT o.id, o.email_key, o.guide, o.crm_statut, o.created_at,
                   ROW_NUMBER() OVER (
                     PARTITION BY o.email_key, o.guide ORDER BY o.occurred_at DESC
                   ) AS rang
            FROM guide_reseau_origines o
            WHERE o.archivee_le IS NULL
              AND (o.crm_statut IS NULL OR o.crm_statut = 'transmise')
          ) r
          JOIN guide_requests g ON g.email_key = r.email_key AND g.aimant = r.guide
          WHERE r.crm_statut IS NULL
            AND r.rang <= ${MAX_ORIGINES_PAR_CHARGE}
            AND r.created_at < ${lt}
            AND r.created_at >= ${depuis}
            AND g.first_click_at IS NOT NULL
            AND g.crm_emitted_at IS NOT NULL
            AND r.id > ${depart}::uuid
          ORDER BY r.id ASC
          LIMIT ${TAILLE_LOT}`,
      );
      for (const l of lignes) groupes.set(`${l.emailKey}|${l.guide}`, l);
      if (lignes.length < TAILLE_LOT) break;
      curseur = lignes[lignes.length - 1]!.id;
    }
  } catch (e) {
    // P2022 (colonne absente) ; en SQL brut, Prisma la rend en P2010 avec le code Postgres 42703.
    const erreur = e as { code?: unknown; meta?: { code?: unknown } };
    if (erreur.code === "P2022" || (erreur.code === "P2010" && erreur.meta?.code === "42703")) {
      console.warn(
        JSON.stringify({ event: "guides_reseau_origines_crm", resultat: "colonne_absente" }),
      );
      return { mode, refus: "colonne-absente", ...vide };
    }
    throw e;
  }
  if (borneAtteinte) {
    // Origines abandonnées pour CE passage : gardées telles quelles (NULL), jamais effacées.
    console.warn(
      JSON.stringify({
        event: "guides_reseau_origines_crm_rattrapage",
        resultat: "borne_atteinte",
        lotsLus: MAX_LOTS_ORIGINES,
        taille_lot: TAILLE_LOT,
      }),
    );
  }
  let nonCliques = 0;
  let transmis = 0;
  let echecs = 0;
  for (const g of groupes.values()) {
    const demande = await prisma.guideRequest.findUnique({
      where: { emailKey_aimant: { emailKey: g.emailKey, aimant: g.guide } },
      select: { email: true, firstClickAt: true },
    });
    if (demande === null || demande.firstClickAt === null) {
      nonCliques += 1;
      continue;
    }
    if (!executer) continue;
    const r = await transmettreOriginesSuivantes({
      email: demande.email,
      emailKey: g.emailKey,
      guide: g.guide,
      depuis,
    });
    if (r === "transmise") transmis += 1;
    else if (r === "echec") echecs += 1;
  }
  console.warn(
    JSON.stringify({
      event: "guides_reseau_origines_crm_rattrapage",
      mode,
      groupes: groupes.size,
      transmis,
    }),
  );
  return { mode, groupes: groupes.size, nonCliques, transmis, echecs, borneAtteinte };
}
