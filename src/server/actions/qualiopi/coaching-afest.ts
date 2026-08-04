"use server";

/**
 * Qualiopi 1-to-1 / AFEST — Server Actions admin (console coaching).
 *
 * Génération des documents AFEST (protocole, attestation en heures) + cadrage
 * AFEST d'un parcours. RBAC admin (requireAdminWrite). Enforcement des exigences
 * certificateur (tuteur, habilitation formateur) GATED par flags SiteSetting :
 * tant que le flag est `false`, aucune contrainte (ADR Phase 0 §7).
 */

import React from "react";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { genererProtocoleAfest } from "@/server/qualiopi/coaching-afest/protocole-1to1";
import { genererAttestation1to1 } from "@/server/qualiopi/coaching-afest/attestation-1to1";
import { genererEmargement1to1 } from "@/server/qualiopi/coaching-afest/emargement-1to1";
import { genererFactureCoaching } from "@/server/qualiopi/coaching-afest/facturation-1to1";
import { validateCoachingFinancement } from "@/server/qualiopi/coaching-afest/financement-1to1";
import {
  SEANCE_HEURES_SELECT,
  estNeutralisee,
  presenceProuvee,
  versSeancePourHeures,
} from "@/server/qualiopi/coaching-afest/heures";
import {
  genererKitOpcoCoaching,
  genererKitCpfCoaching,
  genererKitFranceTravailCoaching,
  genererConventionTripartiteCoaching,
  genererCertificat1to1,
} from "@/server/qualiopi/coaching-afest/kits-1to1";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { PositionnementPdf } from "@/server/qualiopi/documents/templates/positionnement";
import { SatisfactionPdf } from "@/server/qualiopi/documents/templates/satisfaction";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";

export interface AfestActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly documentId?: string | null;
  readonly numero?: string;
  readonly resultat?: "complete" | "partielle" | "aucune";
}

function refresh(revalidate?: string) {
  if (revalidate) revalidatePath(revalidate);
}

/**
 * Vérifie les pré-requis AFEST GATED d'un parcours avant émission d'un document.
 * Retourne un message d'erreur si un flag actif n'est pas satisfait, sinon null.
 * Aucun blocage tant que les flags sont à false (ADR Phase 0 §7).
 *
 * - `afest_tuteur_obligatoire` → tuteur entreprise renseigné.
 * - `afest_formateur_habilitation_requise` → Trainer.afestHabiliteAt présent.
 * - `afest_perimetre_certifie` → exige une cartographie d'activité remplie
 *   (≥1 tâche) et, pour l'attestation, ≥1 séance avec alternance tracée
 *   (mise en situation + phase réflexive non vides).
 */
async function checkAfestEnforcement(
  coachingSessionId: string,
  kind: "protocole" | "attestation",
): Promise<string | null> {
  const [tuteurRequis, habilitationRequise, perimetreCertifie] = await Promise.all([
    getQualiopiConfig("afest_tuteur_obligatoire"),
    getQualiopiConfig("afest_formateur_habilitation_requise"),
    getQualiopiConfig("afest_perimetre_certifie"),
  ]);
  // 🔴 Audit certification 2026-07-26 (F65). Ce garde sortait ici quand les trois
  // drapeaux étaient à `false` — ce qui est le cas en production. Une attestation
  // AFEST était donc émissible sans cartographie de l'activité, sans une seule
  // phase réflexive tracée et sans aucun émargement signé.
  //
  // Or ces éléments ne sont pas des OPTIONS d'organisation : l'article
  // D.6313-3-1 les rend CONSTITUTIFS de l'AFEST — analyse de l'activité, mises
  // en situation, phases réflexives, évaluations. Sans eux, ce n'est pas une
  // action de formation en situation de travail, et l'attester est une
  // affirmation fausse.
  //
  // On distingue donc désormais :
  //   - les contrôles CONSTITUTIFS, appliqués à toute attestation AFEST quels
  //     que soient les drapeaux (ci-dessous, bloc `kind === "attestation"`) ;
  //   - les exigences ORGANISATIONNELLES — tuteur d'entreprise, habilitation
  //     formateur — qui restent pilotées par drapeau, car elles relèvent d'un
  //     arbitrage avec le certificateur.
  const controlesConstitutifs = kind === "attestation";
  if (!tuteurRequis && !habilitationRequise && !perimetreCertifie && !controlesConstitutifs) {
    return null;
  }

  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: {
      tuteurEntrepriseNom: true,
      regimePreuve: true,
      trainer: { select: { afestHabiliteAt: true } },
      cartographie: { select: { taches: true } },
      comptesRendus: {
        select: {
          misesEnSituation: true,
          phasesReflexives: true,
          // 🔴 Sélecteur PARTAGÉ, jamais un select local : c'est lui qui embarque
          // `statut` et la relation de signature, sans lesquels ce gate ne peut
          // ni neutraliser une séance annulée, ni voir une signature réelle.
          ...SEANCE_HEURES_SELECT,
        },
      },
    },
  });
  if (!cs) return "Parcours introuvable.";

  if (tuteurRequis && !cs.tuteurEntrepriseNom) {
    return "Tuteur entreprise obligatoire (exigence AFEST activée) — renseignez-le avant de générer le document.";
  }
  if (habilitationRequise && cs.trainer.afestHabiliteAt == null) {
    return "Le formateur n'a pas d'habilitation AFEST tracée (exigence activée).";
  }
  // Cartographie : exigée dès le périmètre certifié, ou pour toute attestation —
  // l'analyse préalable de l'activité est le point de départ de l'AFEST
  // (D.6313-3-1 §1). Attester sans elle revient à attester un accompagnement
  // qui n'est pas une AFEST.
  if (perimetreCertifie || controlesConstitutifs) {
    const taches = cs.cartographie?.taches;
    if (!Array.isArray(taches) || taches.length === 0) {
      return "Cartographie de l'activité incomplète : au moins une tâche doit être identifiée (analyse préalable AFEST, D.6313-3-1 §1).";
    }
    if (kind === "attestation") {
      // 🔴 Les séances ANNULÉES / en ABSENCE JUSTIFIÉE sortent du gate, ET ne
      // peuvent pas non plus le satisfaire.
      //
      // Sans cette neutralisation, une absence légitime bloquait l'attestation à
      // VIE : la séance n'aurait jamais ni durée ni signature, et le gate exigeait
      // les deux de toutes les séances. C'est la raison d'être de l'enum
      // `coaching_seance_statut`.
      //
      // ⚠️ Le filtre s'applique AUSSI à l'alternance : ce critère est un `some()`,
      // si bien qu'une séance annulée dont le compte-rendu avait été rempli avant
      // l'annulation aurait suffi à attester l'alternance d'un parcours où elle
      // n'a jamais eu lieu. Neutraliser d'un côté sans neutraliser de l'autre
      // ouvre le trou plutôt que de le fermer.
      //
      // Sans effet rétroactif : la colonne `statut` est arrivée avec un défaut
      // `realisee`, donc aucune séance existante n'en sort.
      const retenuesBrutes = cs.comptesRendus.filter(
        (cr) => !estNeutralisee(versSeancePourHeures(cr)),
      );
      const retenues = retenuesBrutes.map(versSeancePourHeures);

      // Le cas « aucune séance retenue » se diagnostique AVANT l'alternance :
      // sinon un parcours entièrement annulé se verrait reprocher une alternance
      // manquante, ce qui envoie chercher la correction au mauvais endroit.
      if (cs.comptesRendus.length === 0) {
        return "Aucune séance enregistrée — impossible d'attester la présence.";
      }
      if (retenues.length === 0) {
        return "Aucune séance retenue (toutes annulées ou justifiées) — impossible d'attester la présence.";
      }

      const hasContent = (arr: unknown, key: string): boolean =>
        Array.isArray(arr) &&
        arr.some((x) => {
          if (x == null || typeof x !== "object") return false;
          const v = (x as Record<string, unknown>)[key];
          return typeof v === "string" && v.trim().length > 0;
        });
      const alternanceTracee = retenuesBrutes.some(
        (cr) =>
          hasContent(cr.misesEnSituation, "cas") && hasContent(cr.phasesReflexives, "situation"),
      );
      if (!alternanceTracee) {
        return "Aucune alternance tracée (mise en situation + phase réflexive) sur les comptes-rendus — requis pour attester un parcours AFEST.";
      }
      // Toutes les séances doivent porter une durée (traçabilité des heures).
      // ⚠️ Critère INDÉPENDANT de la signature : il est préservé tel quel.
      if (retenues.some((s) => s.dureeMinutes == null)) {
        return "Une ou plusieurs séances n'ont pas de durée renseignée — impossible d'attester les heures (traçabilité Qualiopi).";
      }
      // 🔴 Preuve de présence, sous le RÉGIME DU PARCOURS.
      //
      // Ce gate lisait directement la colonne de présence — celle que l'ancienne
      // action `signerSeance1to1Action` posait au simple clic d'un admin. Il
      // autorisait donc l'émission d'une attestation sur la foi d'un booléen que
      // personne n'avait signé. Sous `signature_reelle`, le critère est désormais
      // la LIGNE de signature du bénéficiaire, non révoquée.
      //
      // ⚠️ Ce repointage et le retrait des `*SigneAt` de l'action admin sont
      // livrés dans le MÊME commit, à dessein : séparés, on obtiendrait soit un
      // gate qui lit une colonne qu'on n'écrit plus, soit l'inverse.
      const toutesProuvees = retenues.every((s) => presenceProuvee(s, cs.regimePreuve));
      if (!toutesProuvees) {
        return cs.regimePreuve === "signature_reelle"
          ? "Signature du bénéficiaire manquante sur une ou plusieurs séances — faites signer l'émargement de chaque séance avant d'attester (preuve d'audit AFEST)."
          : "Présence non signée sur une ou plusieurs séances — signez l'émargement de chaque séance avant d'attester (preuve d'audit AFEST).";
      }
    }
  }
  return null;
}

// ─── Cadrage AFEST d'un parcours ─────────────────────────────────────────────

const cadrageSchema = z.object({
  coachingSessionId: z.string().uuid(),
  estAfest: z.boolean(),
  heuresPrevuesConvention: z.number().min(0).max(2000).optional(),
  tuteurEntrepriseNom: z.string().trim().max(200).optional(),
  tuteurEntrepriseEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  objectifsPedagogiques: z
    .array(z.object({ libelle: z.string().trim().min(1).max(300) }))
    .optional(),
  revalidate: z.string().optional(),
});

export async function setAfestCadrageAction(
  input: z.input<typeof cadrageSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = cadrageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const d = parsed.data;

  const data: Prisma.CoachingSessionUpdateInput = { estAfest: d.estAfest };
  if (d.heuresPrevuesConvention !== undefined)
    data.heuresPrevuesConvention = d.heuresPrevuesConvention;
  if (d.tuteurEntrepriseNom !== undefined) data.tuteurEntrepriseNom = d.tuteurEntrepriseNom || null;
  if (d.tuteurEntrepriseEmail !== undefined)
    data.tuteurEntrepriseEmail = d.tuteurEntrepriseEmail || null;
  if (d.objectifsPedagogiques !== undefined)
    data.objectifsPedagogiques = d.objectifsPedagogiques as unknown as Prisma.InputJsonValue;

  await prisma.coachingSession.update({ where: { id: d.coachingSessionId }, data });
  await logQualiopiActivity({
    action: "qualiopi.coaching.afest.cadrage",
    targetType: "CoachingSession",
    targetId: d.coachingSessionId,
    changes: { estAfest: d.estAfest },
    session,
  });
  refresh(d.revalidate);
  return { ok: true };
}

// ─── Génération Protocole AFEST ──────────────────────────────────────────────

const genSchema = z.object({
  coachingSessionId: z.string().uuid(),
  revalidate: z.string().optional(),
});

export async function genererProtocoleAfestAction(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  const blocked = await checkAfestEnforcement(parsed.data.coachingSessionId, "protocole");
  if (blocked) return { ok: false, error: blocked };

  try {
    const res = await genererProtocoleAfest(parsed.data.coachingSessionId);
    if (!res) return { ok: false, error: "Génération indisponible." };
    await logQualiopiActivity({
      action: "qualiopi.coaching.protocole_afest.generate",
      targetType: "CoachingSession",
      targetId: parsed.data.coachingSessionId,
      changes: res,
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Génération Attestation 1-to-1 ───────────────────────────────────────────

const attestSchema = z.object({
  coachingSessionId: z.string().uuid(),
  force: z.boolean().optional(),
  revalidate: z.string().optional(),
});

export async function genererAttestation1to1Action(
  input: z.input<typeof attestSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = attestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  const blocked = await checkAfestEnforcement(parsed.data.coachingSessionId, "attestation");
  if (blocked) return { ok: false, error: blocked };

  try {
    const res = await genererAttestation1to1(parsed.data.coachingSessionId, {
      ...(parsed.data.force !== undefined ? { force: parsed.data.force } : {}),
    });
    await logQualiopiActivity({
      action: `qualiopi.coaching.attestation.${res.resultat}`,
      targetType: "CoachingSession",
      targetId: parsed.data.coachingSessionId,
      changes: res,
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, resultat: res.resultat, documentId: res.documentId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Émargement 1-to-1 (feuille de présence signée) ──────────────────────────

export async function genererEmargement1to1Action(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  // Mêmes pré-requis gated que le protocole (tuteur/habilitation/cartographie) —
  // PAS la présence signée (l'émargement EST la preuve de présence).
  const blocked = await checkAfestEnforcement(parsed.data.coachingSessionId, "protocole");
  if (blocked) return { ok: false, error: blocked };
  try {
    const res = await genererEmargement1to1(parsed.data.coachingSessionId);
    if (!res) return { ok: false, error: "Génération indisponible." };
    await logQualiopiActivity({
      action: "qualiopi.coaching.emargement.generate",
      targetType: "CoachingSession",
      targetId: parsed.data.coachingSessionId,
      changes: res,
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Présence ACTÉE par l'organisme (≠ signature) ────────────────────────────

const presenceSchema = z.object({
  compteRenduId: z.string().uuid(),
  beneficiairePresent: z.boolean().optional(),
  revalidate: z.string().optional(),
});

/**
 * Acte la présence d'une séance 1-to-1 — DÉCLARATION DE L'ORGANISME.
 *
 * 🔴 Cette action ne signe RIEN, et son ancien nom (`signerSeance1to1Action`)
 * disait le contraire. Elle posait `beneficiaireSigneAt`, `formateurSigneAt` et
 * `tuteurSigneAt` au simple clic d'un administrateur : quatre horodatages de
 * SIGNATURE, sans signataire identifié, sans image, sans empreinte, sans chaîne.
 * Une signature juridiquement anonyme (art. 1367) affirmée par la partie qui en
 * bénéficie — c'est-à-dire pire qu'une absence de signature, parce qu'un dossier
 * de contrôle y lit une preuve là où il n'y en a aucune.
 *
 * Ce qui reste ici est légitime et n'est pas retiré : `beneficiairePresent` et
 * `presenceSigneeAt` sont la présence DÉCLARÉE par l'organisme, dont le régime
 * `legacy_boolean` dépend pour exclure les absences actées. Les supprimer
 * casserait tous les parcours existants.
 *
 * ➡️ Les vraies signatures passent par `signerSeanceAfest` : le bénéficiaire, le
 * formateur et le tuteur signent depuis leur appareil ou le poste du formateur.
 * Aucun chemin admin ne peut plus poser un `*SigneAt`.
 */
export async function acterPresenceSeance1to1Action(
  input: z.input<typeof presenceSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = presenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const d = parsed.data;
  // Vérifie l'existence + récupère le parcours pour la traçabilité d'audit.
  const cr = await prisma.compteRenduSeance.findUnique({
    where: { id: d.compteRenduId },
    select: { coachingSessionId: true, coachingSession: { select: { regimePreuve: true } } },
  });
  if (!cr) return { ok: false, error: "Compte-rendu introuvable." };

  // 🔴 Sous `signature_reelle`, ces deux colonnes ne sont plus qu'un CACHE
  // dérivé, écrit par la seule transaction de signature. Les laisser écrire ici
  // empoisonnerait ce cache avec une valeur qu'aucune signature n'appuie —
  // la feuille d'émargement afficherait « présent » sur une séance dont les
  // heures ne sont pas comptées, soit exactement la contradiction que ce
  // chantier corrige. Inerte aujourd'hui : tous les parcours sont en legacy.
  if (cr.coachingSession.regimePreuve === "signature_reelle") {
    return {
      ok: false,
      error:
        "Ce parcours est en régime de signature réelle : la présence y est portée par la signature du bénéficiaire, elle ne peut pas être actée depuis la console.",
    };
  }

  const now = new Date();
  const data: Prisma.CompteRenduSeanceUpdateInput = { presenceSigneeAt: now };
  if (d.beneficiairePresent !== undefined) data.beneficiairePresent = d.beneficiairePresent;
  await prisma.compteRenduSeance.update({ where: { id: d.compteRenduId }, data });
  await logQualiopiActivity({
    action: "qualiopi.coaching.seance.presence_actee",
    targetType: "CompteRenduSeance",
    targetId: d.compteRenduId,
    changes: { presenceSigneeAt: now, coachingSessionId: cr.coachingSessionId },
    session,
  });
  refresh(d.revalidate);
  return { ok: true };
}

// ─── Facture coaching (CoachingContract) ─────────────────────────────────────

const factureSchema = z.object({
  coachingContractId: z.string().uuid(),
  revalidate: z.string().optional(),
});

export async function genererFactureCoachingAction(
  input: z.input<typeof factureSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = factureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererFactureCoaching(parsed.data.coachingContractId);
    await logQualiopiActivity({
      action: "qualiopi.coaching.facture.generate",
      targetType: "CoachingContract",
      targetId: parsed.data.coachingContractId,
      changes: { factureId: res.factureId, numero: res.numero },
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de facturation." };
  }
}

// ─── Financement d'un contrat coaching (parité OPCO/CPF/France Travail) ───────

const financementSchema = z.object({
  coachingContractId: z.string().uuid(),
  financementType: z.enum(["direct", "opco", "cpf", "france_travail", "mixte"]),
  montantHtCents: z.number().int().min(0).optional(),
  subrogation: z.boolean().optional(),
  numeroDossierOpco: z.string().trim().max(60).optional(),
  conventionTripartiteSigneeAt: z.string().min(1).optional(),
  priseEnChargeMontantCents: z.number().int().min(0).optional(),
  priseEnChargeUnite: z
    .enum(["euro_heure", "euro_jour", "euro_formation", "euro_an_salarie"])
    .optional(),
  priseEnChargePlafondFormationCents: z.number().int().min(0).optional(),
  priseEnChargePlafondAnnuelCents: z.number().int().min(0).optional(),
  priseEnChargeSourceUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  edofVerifieAt: z.string().min(1).optional(),
  resteAChargeCents: z.number().int().min(0).optional(),
  cpfPayeurResteCharge: z.string().trim().max(40).optional(),
  ftDispositif: z.enum(["aif", "poei", "csp"]).optional(),
  ftAifPrescriptionDate: z.string().min(1).optional(),
  ftPoeiOffreEmploiNumero: z.string().trim().max(50).optional(),
  ftPoeiAccordFinancementAt: z.string().min(1).optional(),
  ftPoeiEngagementSigneAt: z.string().min(1).optional(),
  revalidate: z.string().optional(),
});

/** "yyyy-mm-dd" → Date (minuit UTC), null si vide/invalide. */
function parseDateInput(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function setFinancementCoachingAction(
  input: z.input<typeof financementSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = financementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const d = parsed.data;

  const data: Prisma.CoachingContractUpdateInput = { financementType: d.financementType };
  if (d.montantHtCents !== undefined) data.montantHtCents = d.montantHtCents;
  if (d.subrogation !== undefined) data.subrogation = d.subrogation;
  if (d.numeroDossierOpco !== undefined) data.numeroDossierOpco = d.numeroDossierOpco || null;
  if (d.conventionTripartiteSigneeAt !== undefined)
    data.conventionTripartiteSigneeAt = parseDateInput(d.conventionTripartiteSigneeAt);
  if (d.priseEnChargeMontantCents !== undefined)
    data.priseEnChargeMontantCents = d.priseEnChargeMontantCents;
  if (d.priseEnChargeUnite !== undefined) data.priseEnChargeUnite = d.priseEnChargeUnite;
  if (d.priseEnChargePlafondFormationCents !== undefined)
    data.priseEnChargePlafondFormationCents = d.priseEnChargePlafondFormationCents;
  if (d.priseEnChargePlafondAnnuelCents !== undefined)
    data.priseEnChargePlafondAnnuelCents = d.priseEnChargePlafondAnnuelCents;
  if (d.priseEnChargeSourceUrl !== undefined)
    data.priseEnChargeSourceUrl = d.priseEnChargeSourceUrl || null;
  if (d.priseEnChargeMontantCents !== undefined || d.priseEnChargeUnite !== undefined)
    data.priseEnChargeReleveLe = new Date();
  if (d.edofVerifieAt !== undefined) data.edofVerifieAt = parseDateInput(d.edofVerifieAt);
  if (d.resteAChargeCents !== undefined) data.resteAChargeCents = d.resteAChargeCents;
  if (d.cpfPayeurResteCharge !== undefined)
    data.cpfPayeurResteCharge = d.cpfPayeurResteCharge || null;
  if (d.ftDispositif !== undefined) data.ftDispositif = d.ftDispositif;
  if (d.ftAifPrescriptionDate !== undefined)
    data.ftAifPrescriptionDate = parseDateInput(d.ftAifPrescriptionDate);
  if (d.ftPoeiOffreEmploiNumero !== undefined)
    data.ftPoeiOffreEmploiNumero = d.ftPoeiOffreEmploiNumero || null;
  if (d.ftPoeiAccordFinancementAt !== undefined)
    data.ftPoeiAccordFinancementAt = parseDateInput(d.ftPoeiAccordFinancementAt);
  if (d.ftPoeiEngagementSigneAt !== undefined)
    data.ftPoeiEngagementSigneAt = parseDateInput(d.ftPoeiEngagementSigneAt);

  await prisma.coachingContract.update({ where: { id: d.coachingContractId }, data });

  // Alerte non bloquante : pré-requis du dispositif non satisfaits.
  const contrat = await prisma.coachingContract.findUnique({
    where: { id: d.coachingContractId },
    select: {
      financementType: true,
      montantHtCents: true,
      subrogation: true,
      numeroDossierOpco: true,
      conventionTripartiteSigneeAt: true,
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      edofVerifieAt: true,
      resteAChargeCents: true,
      ftDispositif: true,
      ftAifPrescriptionDate: true,
      ftPoeiOffreEmploiNumero: true,
      ftPoeiAccordFinancementAt: true,
      ftPoeiEngagementSigneAt: true,
    },
  });
  const alerte = contrat ? validateCoachingFinancement(contrat) : null;

  await logQualiopiActivity({
    action: "qualiopi.coaching.financement.set",
    targetType: "CoachingContract",
    targetId: d.coachingContractId,
    changes: { financementType: d.financementType },
    session,
  });
  refresh(d.revalidate);
  return alerte ? { ok: true, error: alerte } : { ok: true };
}

// ─── Certification France Compétences d'un parcours (RNCP / RS) ───────────────

const certificationSchema = z.object({
  coachingSessionId: z.string().uuid(),
  certificationType: z.enum(["aucune", "rs", "rncp"]),
  codeRncp: z.string().trim().max(20).optional(),
  codeRs: z.string().trim().max(20).optional(),
  numeroEnregistrementFc: z.string().trim().max(40).optional(),
  dateEnregistrementCertif: z.coerce.date().optional(),
  dateEcheanceCertif: z.coerce.date().optional(),
  cpfEligible: z.boolean().optional(),
  blocsCompetences: z.array(z.object({ libelle: z.string().trim().min(1).max(300) })).optional(),
  revalidate: z.string().optional(),
});

export async function setCertificationCoachingAction(
  input: z.input<typeof certificationSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = certificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const d = parsed.data;

  const data: Prisma.CoachingSessionUpdateInput = { certificationType: d.certificationType };
  if (d.codeRncp !== undefined) data.codeRncp = d.codeRncp || null;
  if (d.codeRs !== undefined) data.codeRs = d.codeRs || null;
  if (d.numeroEnregistrementFc !== undefined)
    data.numeroEnregistrementFc = d.numeroEnregistrementFc || null;
  if (d.dateEnregistrementCertif !== undefined)
    data.dateEnregistrementCertif = d.dateEnregistrementCertif;
  if (d.dateEcheanceCertif !== undefined) data.dateEcheanceCertif = d.dateEcheanceCertif;
  if (d.cpfEligible !== undefined) data.cpfEligible = d.cpfEligible;
  if (d.blocsCompetences !== undefined)
    data.blocsCompetences = d.blocsCompetences as unknown as Prisma.InputJsonValue;

  await prisma.coachingSession.update({ where: { id: d.coachingSessionId }, data });
  await logQualiopiActivity({
    action: "qualiopi.coaching.certification.set",
    targetType: "CoachingSession",
    targetId: d.coachingSessionId,
    changes: { certificationType: d.certificationType },
    session,
  });
  refresh(d.revalidate);
  return { ok: true };
}

// ─── Kits financeurs + certificat 1-to-1 (réutilisent les templates) ──────────

type CoachingKit =
  "kit_opco" | "kit_cpf" | "kit_france_travail" | "convention_tripartite" | "certificat";

const KIT_GENERATORS: Record<
  CoachingKit,
  (id: string) => Promise<{ documentId: string; numero: string }>
> = {
  kit_opco: genererKitOpcoCoaching,
  kit_cpf: genererKitCpfCoaching,
  kit_france_travail: genererKitFranceTravailCoaching,
  convention_tripartite: genererConventionTripartiteCoaching,
  certificat: (id) => genererCertificat1to1(id),
};

const kitSchema = z.object({
  coachingSessionId: z.string().uuid(),
  kit: z.enum(["kit_opco", "kit_cpf", "kit_france_travail", "convention_tripartite", "certificat"]),
  revalidate: z.string().optional(),
});

export async function genererKitCoachingAction(
  input: z.input<typeof kitSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = kitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  const { coachingSessionId, kit } = parsed.data;
  try {
    const res = await KIT_GENERATORS[kit](coachingSessionId);
    await logQualiopiActivity({
      action: `qualiopi.coaching.${kit}.generate`,
      targetType: "CoachingSession",
      targetId: coachingSessionId,
      changes: { documentId: res.documentId, numero: res.numero },
      session,
    });
    refresh(parsed.data.revalidate);
    return { ok: true, documentId: res.documentId, numero: res.numero };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

// ─── Positionnement + satisfaction 1-to-1 (réutilisent les templates) ─────────

async function genererDocCoaching(
  coachingSessionId: string,
  type: "positionnement" | "satisfaction",
  session: Awaited<ReturnType<typeof requireAdminWrite>>,
): Promise<AfestActionResult> {
  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: { interventionSlug: true, dateSeance: true },
  });
  if (!cs) return { ok: false, error: "Parcours introuvable." };
  const identite = await getOrganismeIdentite();
  const docData = {
    intituleFormation: coachingInterventionLabel(cs.interventionSlug),
    dateSession: new Date(cs.dateSeance).toLocaleDateString("fr-FR"),
  };
  const res = await generateDocument({
    type,
    buildElement: (numero) =>
      type === "positionnement"
        ? React.createElement(PositionnementPdf, { data: { numero, ...docData }, identite })
        : React.createElement(SatisfactionPdf, { data: { numero, ...docData }, identite }),
    refs: { coachingSessionId },
  });
  await logQualiopiActivity({
    action: `qualiopi.coaching.${type}.generate`,
    targetType: "CoachingSession",
    targetId: coachingSessionId,
    changes: { documentId: res.id, numero: res.numero },
    session,
  });
  return { ok: true, documentId: res.id, numero: res.numero };
}

export async function genererPositionnement1to1Action(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererDocCoaching(parsed.data.coachingSessionId, "positionnement", session);
    refresh(parsed.data.revalidate);
    return res;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}

export async function genererSatisfaction1to1Action(
  input: z.input<typeof genSchema>,
): Promise<AfestActionResult> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Non autorisé." };
  }
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };
  try {
    const res = await genererDocCoaching(parsed.data.coachingSessionId, "satisfaction", session);
    refresh(parsed.data.revalidate);
    return res;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de génération." };
  }
}
