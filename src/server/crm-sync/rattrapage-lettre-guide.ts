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
 *      un tiers).
 *
 * Trois garanties :
 *   · À BLANC PAR DÉFAUT : sans `executer`, aucune écriture, aucune file —
 *     seulement des COMPTES. Jamais une adresse, ni en sortie ni au journal ;
 *   · REJOUABLE : les `event_id` sont DÉTERMINISTES (`event-id.ts`) et chaque
 *     transmission passe par la même fonction que le geste en direct, qui
 *     réserve la ligne avant d'écrire. Deux passages = zéro doublon ;
 *   · EXCLUSIONS À L'EXÉCUTION : les adresses à écarter (décision D4) arrivent
 *     en argument, comparées après normalisation. Aucune adresse n'est écrite
 *     dans ce dépôt, qui est public.
 */

import { prisma } from "@/lib/prisma";
import { FORM_REF_LETTRE } from "@/content/guide-ia-formulaire";

import { isCrmSyncGuideEnabled } from "./config";
import {
  SELECT_ABONNE_POUR_CRM,
  transmettreClicGuide,
  transmettreInscriptionLettre,
  type AbonnePourCrm,
} from "./lettre-guide";

export interface OptionsRattrapage {
  /** `true` pour écrire vraiment. Absent ou `false` : à blanc. */
  readonly executer?: boolean;
  /** Adresses à écarter (répétable en ligne de commande). */
  readonly exclure?: readonly string[];
}

export interface BilanRattrapage {
  readonly mode: "a-blanc" | "execution";
  /** Refus d'exécuter : drapeau fermé. Rien n'a été écrit. */
  readonly refus?: "drapeau-guide-ferme";
  readonly demandes: {
    /** Cliquées et jamais transmises. */
    readonly aTransmettre: number;
    readonly exclues: number;
    readonly transmises: number;
    readonly dejaTransmises: number;
    readonly echecs: number;
  };
  readonly abonnes: {
    /** Inscrits (`confirmed`) examinés. */
    readonly examines: number;
    /** Inscription à la demande du guide, demande jamais cliquée : hors CRM. */
    readonly nonVerifies: number;
    /** Leur inscription part déjà avec une demande cliquée ci-dessus. */
    readonly avecLaDemande: number;
    readonly dejaTransmis: number;
    readonly aTransmettre: number;
    readonly exclus: number;
    readonly transmis: number;
    readonly echecs: number;
  };
}

const INSCRIPTION_PAR_LE_GUIDE: ReadonlySet<string> = new Set(Object.values(FORM_REF_LETTRE));

function normaliser(adresse: string): string {
  return adresse.trim().toLowerCase();
}

export async function rattraperLettreEtGuide(
  options: OptionsRattrapage = {},
): Promise<BilanRattrapage> {
  const executer = options.executer === true;
  const exclues = new Set((options.exclure ?? []).map(normaliser).filter((a) => a.length > 0));
  const estExclue = (adresse: string): boolean => exclues.has(normaliser(adresse));

  // ── 1. Demandes cliquées, jamais transmises ─────────────────────────────
  const demandes = await prisma.guideRequest.findMany({
    where: { firstClickAt: { not: null }, crmEmittedAt: null },
    select: { id: true, email: true },
    orderBy: { firstClickAt: "asc" },
  });
  const demandesRetenues = demandes.filter((d) => !estExclue(d.email));

  // ── 2. Abonnés inscrits ─────────────────────────────────────────────────
  const abonnes: AbonnePourCrm[] = await prisma.newsletterSubscriber.findMany({
    where: { status: "confirmed", confirmedAt: { not: null } },
    select: SELECT_ABONNE_POUR_CRM,
    orderBy: { confirmedAt: "asc" },
  });

  // Adresses dont la demande du guide a été cliquée (vérification par le clic).
  const parLeGuide = abonnes.filter(
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
  const avecDemandeEnAttente = new Set(demandesRetenues.map((d) => normaliser(d.email)));

  // Inscriptions déjà transmises (identifiant aléatoire d'avant ce lot, ou
  // déterministe) : une ligne `newsletter_optin` postérieure à l'inscription.
  const refs = abonnes.map((a) => `site:newsletter_subscriber:${a.id}`);
  const emises =
    refs.length === 0
      ? []
      : await prisma.crmSyncOutbox.findMany({
          where: { subjectRef: { in: refs }, eventType: "newsletter_optin" },
          select: { subjectRef: true, createdAt: true },
        });
  const dejaTransmise = (a: AbonnePourCrm): boolean =>
    emises.some(
      (e) =>
        e.subjectRef === `site:newsletter_subscriber:${a.id}` &&
        a.confirmedAt !== null &&
        e.createdAt >= a.confirmedAt,
    );

  let nonVerifies = 0;
  let avecLaDemande = 0;
  let dejaTransmis = 0;
  let exclus = 0;
  const abonnesATransmettre: AbonnePourCrm[] = [];
  for (const a of abonnes) {
    const verifiee = !parLeGuide.includes(a) || cliquees.has(normaliser(a.email));
    if (!verifiee) nonVerifies += 1;
    else if (dejaTransmise(a)) dejaTransmis += 1;
    else if (estExclue(a.email)) exclus += 1;
    else if (avecDemandeEnAttente.has(normaliser(a.email))) avecLaDemande += 1;
    else abonnesATransmettre.push(a);
  }

  const bilan = {
    mode: executer ? ("execution" as const) : ("a-blanc" as const),
    demandes: {
      aTransmettre: demandesRetenues.length,
      exclues: demandes.length - demandesRetenues.length,
      transmises: 0,
      dejaTransmises: 0,
      echecs: 0,
    },
    abonnes: {
      examines: abonnes.length,
      nonVerifies,
      avecLaDemande,
      dejaTransmis,
      aTransmettre: abonnesATransmettre.length,
      exclus,
      transmis: 0,
      echecs: 0,
    },
  };

  if (!executer) return bilan;
  if (!isCrmSyncGuideEnabled()) return { ...bilan, refus: "drapeau-guide-ferme" };

  // ── Exécution : les demandes d'abord (elles emportent leur inscription) ──
  for (const d of demandesRetenues) {
    const issue = await transmettreClicGuide(d.id);
    if (issue === "transmise") bilan.demandes.transmises += 1;
    else if (issue === "deja-transmise") bilan.demandes.dejaTransmises += 1;
    else bilan.demandes.echecs += 1;
  }
  for (const a of abonnesATransmettre) {
    const ligne = await transmettreInscriptionLettre(a);
    if (ligne !== null) bilan.abonnes.transmis += 1;
    else bilan.abonnes.echecs += 1;
  }
  return bilan;
}

/**
 * Arguments de `scripts/crm-sync-rattrapage-lettre-guide.ts`. À blanc par
 * défaut ; `--exclure <adresse>` répétable ; `--executer` pour agir.
 */
export function lireArgumentsRattrapage(argv: readonly string[]): {
  executer: boolean;
  exclure: string[];
  erreur?: string;
} {
  const exclure: string[] = [];
  let executer = false;
  let aBlanc = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--executer") executer = true;
    else if (arg === "--a-blanc") aBlanc = true;
    else if (arg === "--exclure") {
      const valeur = argv[i + 1];
      if (!valeur || valeur.startsWith("--")) {
        return { executer: false, exclure, erreur: "--exclure attend une adresse." };
      }
      exclure.push(valeur);
      i += 1;
    } else {
      return { executer: false, exclure, erreur: `argument inconnu : ${arg ?? ""}` };
    }
  }
  if (executer && aBlanc) {
    return { executer: false, exclure, erreur: "--executer et --a-blanc sont incompatibles." };
  }
  return { executer, exclure };
}
