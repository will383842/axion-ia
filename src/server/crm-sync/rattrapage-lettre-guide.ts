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
import { FORM_REF_LETTRE } from "@/content/guide-ia-formulaire";

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
