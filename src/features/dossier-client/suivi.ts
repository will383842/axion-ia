/**
 * Le SUIVI d'un rendez-vous — une seule fonction l'écrit
 * (chantier visio, PR 4 ; plan V-05, principe « `RencontreSuivi` est
 * l'autorité du suivi »).
 *
 * ## Pourquoi deux tables, et une seule porte
 *
 * `RendezVousSuivi` (onglet « Rendez-vous », 27/09) exige un rendez-vous
 * Calendly et meurt avec lui à la purge des 36 mois : un rendez-vous saisi
 * dans la console, une dictée, n'y auraient pas de suivi, et la suite d'un
 * client de juillet disparaîtrait en juillet d'il y a trois ans.
 * `RencontreSuivi` vit avec la RENCONTRE : c'est l'autorité.
 *
 * Tant que la rencontre a un lien Calendly VIVANT, l'onglet « Rendez-vous »
 * existant lit encore `RendezVousSuivi` : `enregistrerSuivi()` écrit alors
 * LES DEUX, dans la même transaction. Elles ne peuvent pas diverger, parce
 * que personne d'autre ne les écrit — garde
 * `tests/unit/ci/aucune-ecriture-de-rendez-vous-suivi-hors-de-la-fonction-unique.spec.ts`
 * (exceptions nommées : l'issue d'un échange APPORTEUR, qui n'a pas de
 * rencontre — PA-9 —, et l'effacement RGPD).
 *
 * Un type Calendly HORS de la liste blanche (échange apporteur, entretien…)
 * n'a pas de rencontre : seule `RendezVousSuivi` est écrite, comme avant.
 *
 * ## Le statut d'une rencontre suit son issue — sauf tant que Calendly vit
 *
 * Une rencontre saisie dans la console naît `planifie` ; l'issue la fait
 * passer `tenu`, `absent` ou `reporte` — ici, par ce seul chemin. Une
 * rencontre Calendly au lien vivant garde un statut NUL (CHECK
 * `rencontres_statut_fige_calendly`) : son statut est celui de Calendly, figé
 * à la purge.
 *
 * `note` (appréciation libre) n'existe que dans `RendezVousSuivi` : sur une
 * rencontre, une appréciation devient un FAIT `saisie_manuelle` (note
 * manuelle), chiffré et effaçable.
 *
 * Module neutre.
 */

import type {
  RencontreStatut,
  RendezVousIssue,
  RendezVousSuite,
} from "../../../prisma/generated/client";
import { garderSuiteEtEcheance, manquementDuSuivi } from "@/features/admin-rendezvous/suivi";
import { dansLaTransaction, type BaseTransactionnelle, type Tx } from "./base";
import { assurerRencontrePourCalendly } from "./rencontre-calendly";

export interface EntreeSuivi {
  /** La rencontre (console) — OU le rendez-vous Calendly (onglet « Rendez-vous »). */
  readonly rencontreId?: string | null;
  readonly calendlyEventId?: string | null;
  readonly issue: RendezVousIssue;
  readonly suite: RendezVousSuite | null;
  readonly suiteLe: Date | null;
  /**
   * Appréciation libre : `RendezVousSuivi` seulement. ABSENTE (`undefined`) :
   * l'appréciation déjà saisie dans l'onglet « Rendez-vous » est GARDÉE —
   * « Après l'appel » ne la montre pas, il ne doit pas l'effacer. `null` :
   * effacée (le formulaire de l'onglet l'a vidée).
   */
  readonly note?: string | null;
  /** L'administrateur (NULL = proposé par la machine). */
  readonly auteurId: string | null;
  /** Adresse du compte console, recopiée dans `RendezVousSuivi.renseignePar`. Absente : gardée. */
  readonly renseignePar?: string | null;
  readonly maintenant?: Date;
}

export interface ResultatSuivi {
  readonly rencontreId: string | null;
  readonly suiviCalendlyEcrit: boolean;
}

export class ErreurSuivi extends Error {}

/** L'issue fait le statut d'une rencontre sans lien Calendly vivant. */
export const STATUT_DE_L_ISSUE: Readonly<Record<RendezVousIssue, RencontreStatut>> = {
  eu_lieu: "tenu",
  absent: "absent",
  reporte: "reporte",
};

/**
 * La règle issue / suite / échéance est CELLE de l'onglet « Rendez-vous »
 * (`admin-rendezvous/suivi.ts`, source unique) : on l'applique, on ne la
 * réécrit pas.
 */
export function normaliserEntreeSuivi(e: EntreeSuivi): {
  issue: RendezVousIssue;
  suite: RendezVousSuite | null;
  suiteLe: Date | null;
} {
  const garde = garderSuiteEtEcheance(e.issue, e.suite, e.suiteLe);
  const manque = manquementDuSuivi({ issue: e.issue, ...garde });
  if (manque !== null) throw new ErreurSuivi(manque.message);
  return { issue: e.issue, ...garde };
}

/**
 * Écrit le suivi d'un rendez-vous, dans UNE transaction. À appeler depuis une
 * action qui a vérifié la session. Voir l'en-tête.
 */
export async function enregistrerSuivi(
  db: BaseTransactionnelle,
  e: EntreeSuivi,
): Promise<ResultatSuivi> {
  const valeurs = normaliserEntreeSuivi(e);
  const maintenant = e.maintenant ?? new Date();
  return db.$transaction((tx) => enregistrerSuiviDans(tx, e, valeurs, maintenant));
}

/** Même chose, DANS la transaction de l'appelant (« Valider et préparer le devis »). */
export async function enregistrerSuiviDansLaTransaction(
  tx: Tx,
  e: EntreeSuivi,
): Promise<ResultatSuivi> {
  return enregistrerSuiviDans(tx, e, normaliserEntreeSuivi(e), e.maintenant ?? new Date());
}

async function enregistrerSuiviDans(
  tx: Tx,
  e: EntreeSuivi,
  valeurs: ReturnType<typeof normaliserEntreeSuivi>,
  maintenant: Date,
): Promise<ResultatSuivi> {
  let rencontreId = e.rencontreId ?? null;
  let calendlyEventId = e.calendlyEventId ?? null;

  if (rencontreId === null && calendlyEventId === null) {
    throw new ErreurSuivi("Suivi : ni rencontre ni rendez-vous Calendly.");
  }

  if (rencontreId === null && calendlyEventId !== null) {
    const ev = await tx.calendlyEvent.findUnique({
      where: { id: calendlyEventId },
      select: { id: true },
    });
    if (ev === null) throw new ErreurSuivi("Rendez-vous introuvable.");
    const r = await assurerRencontrePourCalendly(dansLaTransaction(tx), calendlyEventId, {
      maintenant,
    });
    rencontreId = r.statut === "creee" || r.statut === "existante" ? r.rencontreId : null;
  }

  if (rencontreId !== null) {
    const rencontre = await tx.rencontre.findUnique({
      where: { id: rencontreId },
      select: { id: true, calendlyEventId: true },
    });
    if (rencontre === null) throw new ErreurSuivi("Rencontre introuvable.");
    calendlyEventId = rencontre.calendlyEventId;

    await tx.rencontreSuivi.upsert({
      where: { rencontreId },
      create: {
        rencontreId,
        ...valeurs,
        auteurId: e.auteurId,
        valideLe: e.auteurId ? maintenant : null,
      },
      update: { ...valeurs, auteurId: e.auteurId, valideLe: e.auteurId ? maintenant : null },
    });
    // Le statut suit l'issue — sauf tant que le lien Calendly vit (CHECK).
    if (rencontre.calendlyEventId === null) {
      await tx.rencontre.update({
        where: { id: rencontreId },
        data: { statut: STATUT_DE_L_ISSUE[valeurs.issue] },
      });
    }
  }

  // La recopie dans l'onglet « Rendez-vous », tant que Calendly vit.
  let suiviCalendlyEcrit = false;
  if (calendlyEventId !== null) {
    // `note` et `renseignePar` ne s'écrivent que si l'appelant les donne :
    // « Valider et préparer le devis » ne connaît pas l'appréciation de
    // l'onglet, il ne l'efface pas (garde
    // `apres-l-appel-ne-perd-pas-la-note-de-l-onglet.spec.ts`).
    const note =
      e.note === undefined ? {} : { note: e.note && e.note.trim() !== "" ? e.note.trim() : null };
    const renseignePar = e.renseignePar === undefined ? {} : { renseignePar: e.renseignePar };
    await tx.rendezVousSuivi.upsert({
      where: { calendlyEventId },
      create: { calendlyEventId, ...valeurs, ...note, ...renseignePar },
      update: { ...valeurs, ...note, ...renseignePar },
    });
    suiviCalendlyEcrit = true;
  }

  return { rencontreId, suiviCalendlyEcrit };
}
