/**
 * Qualiopi — Service de facturation formation (T11 AGENT A).
 *
 * Génère une FactureFormation (numéro séquentiel AXI-FACT-YYYY-NNN),
 * construit la FactureData, produit le document PDF via generateDocument,
 * et stocke documentId + emiseAt.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un résultat
 * minimal sans toucher la DB ni R2.
 *
 * 🔴 TVA : le régime par défaut est **assujetti**, jamais exonéré.
 * Cet en-tête affirmait le contraire — « TVA exonérée 261-4-4° CGI par défaut
 * (tvaExoneree=true) » — alors que `REGIME_TVA_DEFAUT` vaut `"assujetti"`
 * depuis, précisément pour « ne jamais omettre par erreur une TVA due ».
 * Commentaire périmé corrigé le 2026-08-04 : sur ce sujet, une note qui dit
 * l'inverse du code est une invitation à « rétablir » l'exonération.
 * L'exonération reste un choix explicite par dossier, jamais un défaut.
 *
 * Subrogation OPCO : destinataire forcé = "opco", mention exacte,
 * numeroDossierOpco BLOQUANT si absent.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";
import { computeVentilationDossier, computeForfait } from "./opco-calcul";
import { resoudreDestinataireFacture } from "./destinataire-facture";
import { periodePrestationSession } from "./periode-prestation";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import {
  assertOrganismeComplet,
  assertAcheteurComplet,
} from "@/server/qualiopi/documents/conformite";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import {
  computeTotauxFacture,
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import { resolveRibFacture } from "@/lib/legal-identity";
import { resoudreConditions, type ModeFacturation } from "./conditions-client";

/** Garde de type : la colonne est un enum Prisma, la config une chaîne libre. */
function estModeFacturation(v: unknown): v is ModeFacturation {
  return v === "acompte_solde" || v === "solde_unique";
}

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface GenererFactureInput {
  sessionId: string;
  destinataire: FactureFormationDestinataire;
  ventilation: "forfait" | "horaire";
}

export interface GenererFactureResult {
  factureId: string;
  numero: string;
  documentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// genererFactureFormation
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;

/**
 * Crée une FactureFormation, calcule les lignes (forfait ou horaire OPCO),
 * construit la FactureData, génère le PDF via generateDocument, et stocke
 * documentId + emiseAt sur la facture.
 *
 * Retry P2002 sur le numéro séquentiel (pattern identique à documents-service.ts).
 */
export async function genererFactureFormation(
  input: GenererFactureInput,
): Promise<GenererFactureResult> {
  // ── Stub build-time ──────────────────────────────────────────────────────
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { factureId: "stub", numero: "AXI-FACT-0000-000", documentId: null };
  }

  // ── Chargement session + formation + client ──────────────────────────────
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: input.sessionId },
    include: {
      formation: true,
      client: true,
      // 🔴 Ajouté le 2026-08-19 (constat `CONF-03` / `D9-3-01`). Sans les
      // inscriptions, la ventilation horaire n'avait aucun moyen de connaître
      // l'effectif RÉEL et retombait sur `nbParticipantsPrevus` — c'est-à-dire
      // qu'elle facturait au financeur des personnes qui n'étaient jamais venues.
      enrollments: { select: { statut: true, tauxPresencePct: true } },
    },
  });

  // ── Vérification subrogation (bloquante) ─────────────────────────────────
  if (session.opcoSubrogation && !session.numeroDossierOpco) {
    throw new Error(
      "Subrogation OPCO : le numéro de dossier OPCO est obligatoire pour émettre la facture.",
    );
  }

  // ── Calcul des lignes (forfait ou horaire) ───────────────────────────────
  // Durée depuis le snapshot légal (WS5) ; repli LIVE pour les sessions legacy.
  const formationDoc = readFormationForDocs(session.formationSnapshot, session.formation);
  const dureeHeures =
    session.dureeReelleHeures ?? formationDoc.dureeHeures ?? session.formation.dureeHeures;
  // 🔴 `CONF-03` / `D9-3-01` (2026-08-19) — le repli était `nbParticipantsPrevus`.
  // Or `nbParticipantsReels` n'a AUCUN écrivain dans le code applicatif : la
  // colonne est toujours `null` en production, donc la facture adressée à l'OPCO
  // portait TOUJOURS les participants PRÉVUS. Session prévue à 8, trois présents :
  // la demande de prise en charge réclamait le montant de 8. C'est un indu au
  // contrôle de service fait, sur une pièce comptable numérotée.
  //
  // Le repli est désormais l'effectif CONSTATÉ. « Constaté » = statut `presente`
  // OU un taux de présence non nul : les deux témoignent d'une venue, et se
  // contenter du statut manquerait les dossiers où seul le taux a été calculé.
  //
  // ⚠️ Une constatation humaine explicite (`nbParticipantsReels`) garde la
  // priorité : le repli ne l'écrase jamais.
  //
  // ⚠️ APPROXIMATION ASSUMÉE, et il faut la connaître : la formule facture
  // `durée × participants`, donc un stagiaire venu à 40 % est compté comme un
  // participant PLEIN. On cesse de facturer des absents — on ne facture pas
  // encore les heures réellement suivies stagiaire par stagiaire. Passer à ce
  // modèle est un changement de méthode de facturation, pas une correction de
  // défaut : à trancher avec Will, pas au détour d'un correctif.
  const participantsConstates = session.enrollments.filter(
    (e) => e.statut === "presente" || (e.tauxPresencePct ?? 0) > 0,
  ).length;
  const nbParticipants = session.nbParticipantsReels ?? participantsConstates;

  let lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  let totalHtCents: number;

  if (input.ventilation === "horaire") {
    // Barème de prise en charge saisi sur le dossier (T18).
    // priseEnChargeMontantCents et priseEnChargeUnite sont obligatoires en ventilation horaire.
    if (session.priseEnChargeMontantCents == null || session.priseEnChargeUnite == null) {
      throw new Error(
        "Barème de prise en charge non renseigné sur le dossier — à relever sur le portail OPCO de la branche du client.",
      );
    }
    // 🔴 Refus DUR quand personne n'est venu (`CONF-03`). Sans lui, l'effectif
    // constaté tombe à 0 et la facture partirait à 0 € — ou pire, quelqu'un
    // rétablirait le repli sur les prévus « pour que ça marche », ramenant
    // exactement le défaut qu'on ferme ici.
    //
    // Une session que personne n'a suivie n'est pas une session à facturer à
    // l'heure : c'est un dossier à instruire. Le message dit quoi faire plutôt
    // que ce qui manque — un refus qui n'indique pas la sortie se contourne.
    if (nbParticipants === 0) {
      throw new Error(
        "Ventilation horaire impossible : aucune présence constatée sur cette session. " +
          "Renseignez l'émargement (ou le relevé de connexion), ou facturez au forfait si la prestation est due malgré l'absence.",
      );
    }
    const result = computeVentilationDossier({
      unite: session.priseEnChargeUnite,
      montantCents: session.priseEnChargeMontantCents,
      dureeHeures,
      nbParticipants,
      ...(session.priseEnChargePlafondFormationCents != null
        ? { plafondFormationCents: session.priseEnChargePlafondFormationCents }
        : {}),
      ...(session.priseEnChargePlafondAnnuelCents != null
        ? { plafondAnnuelCents: session.priseEnChargePlafondAnnuelCents }
        : {}),
    });
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  } else {
    const result = computeForfait(session.montantHtCents);
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  }

  // ── Destinataire réel (subrogation → opco) ───────────────────────────────
  const destinataireReel: FactureFormationDestinataire = session.opcoSubrogation
    ? "opco"
    : input.destinataire;

  // [P1] Facturer le BON tiers selon le destinataire réel — ne pas retomber sur
  //   la raison sociale de l'entreprise cliente pour l'OPCO / France Travail / le
  //   stagiaire. SIRET/adresse de l'OPCO = donnée d'un référentiel OPCO (à saisir),
  //   jamais inventés.
  //
  // Règles déportées dans `destinataire-facture.ts` : ce bloc existait ici en
  // version correcte pendant que l'action `financements` en portait une version
  // fautive. Un seul résolveur, plus de divergence possible.
  const acheteur = resoudreDestinataireFacture(destinataireReel, session.client);
  const destinataireNom = acheteur.nom;
  const destinataireSiret = acheteur.siret ?? undefined;
  const destinataireAdresse = acheteur.adresse ?? undefined;

  // ── Numéro séquentiel + retry P2002 ─────────────────────────────────────
  const annee = new Date().getFullYear();
  const identite = await getOrganismeIdentite();

  // Garde-fou conformité : une facture sans identité OF complète (SIRET, NDA,
  // adresse siège) est illégale. On valide AVANT toute création de
  // FactureFormation, et hors du try/catch fail-soft de génération PDF, pour
  // bloquer DUR (sinon l'erreur serait avalée et un enregistrement non conforme
  // serait créé sans PDF).
  assertOrganismeComplet(identite, "facture");

  // Symétrie ACHETEUR (2026-08-04). Le garde-fou ci-dessus ne protégeait que
  // NOTRE identité, alors que l'art. L.441-9 exige « le nom des parties ainsi
  // que LEUR adresse ». Une fiche client sans adresse produisait une facture
  // portant « Non renseigné » en rouge : visible, mais émise quand même.
  //
  // Ne s'applique qu'au destinataire `entreprise` : pour OPCO / France Travail /
  // bénéficiaire, `resoudreDestinataireFacture` renvoie volontairement une
  // adresse nulle (référentiel externe, « jamais inventés ») — bloquer là
  // couperait les circuits de financement.
  assertAcheteurComplet(acheteur, destinataireReel);

  // Échéance : délai configurable (SiteSetting) — financeur (subrogation OPCO)
  // vs client direct. RIB depuis legal_overrides (null → bloc omis du PDF).
  const [delaiClientGlobal, delaiFinanceur, tauxAcompteGlobal, modeFacturationGlobal, rib] =
    await Promise.all([
      getQualiopiConfig("delai_paiement_jours"),
      getQualiopiConfig("delai_paiement_financeur_jours"),
      getQualiopiConfig("taux_acompte_defaut_pct"),
      getQualiopiConfig("mode_facturation_defaut"),
      resolveRibFacture(),
    ]);

  // 🔴 Vérification E2E 2026-07-26 — F61 était livré en dormance : les colonnes
  // `Client.delaiPaiementJours` / `tauxAcomptePct` / `modeFacturation` et le
  // résolveur `resoudreConditions` existaient, mais AUCUN émetteur de facture
  // ne les lisait. Le réglage par client, demandé explicitement, n'avait donc
  // aucun effet. Branché ici — subrogation OPCO exceptée : c'est alors le
  // financeur qui paie, pas le client, et son délai propre s'applique.
  const conditions = resoudreConditions(
    {
      delaiPaiementJours: session.client?.delaiPaiementJours ?? null,
      tauxAcomptePct: session.client?.tauxAcomptePct ?? null,
      modeFacturation: estModeFacturation(session.client?.modeFacturation)
        ? session.client.modeFacturation
        : null,
    },
    {
      delaiPaiementJours: delaiClientGlobal,
      tauxAcomptePct: tauxAcompteGlobal,
      modeFacturation: estModeFacturation(modeFacturationGlobal)
        ? modeFacturationGlobal
        : "acompte_solde",
    },
  );

  const delaiJours = session.opcoSubrogation ? delaiFinanceur : conditions.delaiPaiementJours;
  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(
    echeance.getDate() + (Number.isFinite(delaiJours) && delaiJours > 0 ? delaiJours : 30),
  );

  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");

  // Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC. Snapshot facture.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

  let factureCreee: { id: string; numero: string } | null = null;
  let documentId: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 🔴 V20 — la boucle `for attempt` est CONSERVÉE, mais elle cesse d'être
    // déterministe. Avec `count()`, les cinq tentatives recalculaient le même
    // numéro et l'émission échouait définitivement. Le MAX, lui, progresse dès
    // qu'une facture concurrente a été insérée : la reprise converge.
    //
    // On ne prend PAS de verrou consultatif ici : le rendu PDF a lieu à
    // l'intérieur de cette boucle, et le tenir plusieurs centaines de
    // millisecondes sérialiserait toute la facturation en épuisant le pool.
    const numero = await nextNumero("facture", annee, (prefixe) =>
      prisma.factureFormation.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );

    // Construction FactureData (React.createElement, pas de JSX en .ts)
    // Date d'exécution réelle, lue sur la session — sans elle le gabarit
    // retombe sur la date d'émission et la facture contredit la convention
    // (cf. `periode-prestation.ts`).
    const periodePrestation = periodePrestationSession(session);

    const factureData: FactureData = {
      numero,
      dateEmission: formatDate(now),
      dateEcheance: formatDate(echeance),
      ...(periodePrestation !== undefined ? { periodePrestation } : {}),
      identite,
      regimeTva,
      tauxTvaStandardPercent: tauxStandard,
      client: {
        raisonSociale: destinataireNom,
        ...(destinataireSiret !== undefined ? { siret: destinataireSiret } : {}),
        ...(destinataireAdresse !== undefined ? { adresse: destinataireAdresse } : {}),
      },
      lignes,
      ...(session.opcoSubrogation && session.numeroDossierOpco !== null
        ? {
            subrogationOpco: {
              nomOpco: destinataireNom,
              numeroDossier: session.numeroDossierOpco,
            },
          }
        : {}),
      ...(rib !== null ? { rib } : {}),
    };

    // 🔴 #7 — Le PDF affiche le NUMÉRO DE FACTURE (`factureData.numero`, celui
    // enregistré dans `factureFormation` et exporté au FEC/compta), et NON le
    // numéro DocumentGenere alloué indépendamment par `generateDocument`. Avant,
    // le PDF remis au client portait un numéro (compteur documentGenere) absent
    // du registre comptable (compteur factureFormation) : facture introuvable
    // dans les livres, refus au contrôle. On IGNORE donc `docNumero`.
    // (Le DocumentGenere garde son propre numéro pour le classement interne R2 —
    // artefact de stockage, sans valeur comptable ; unification complète = chantier
    // à part, l'historique des deux séquences se chevauche.)
    let docResult: { id: string } | null = null;
    try {
      docResult = await generateDocument({
        type: "facture",
        identite,
        buildElement: () => React.createElement(FacturePdf, { data: factureData }),
        refs: { sessionId: input.sessionId },
      });
    } catch {
      // Fail-soft : la facture est créée sans PDF si le renderer échoue
    }
    documentId = docResult?.id ?? null;

    try {
      const facture = await prisma.factureFormation.create({
        data: {
          numero,
          activite: "formation",
          sessionId: input.sessionId,
          ...(session.clientId != null ? { clientId: session.clientId } : {}),
          destinataire: destinataireReel,
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(session.client?.tvaIntracom != null
            ? { destinataireTvaIntracom: session.client.tvaIntracom }
            : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: totalHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
          lignes: lignes as never,
          subrogation: session.opcoSubrogation,
          ...(session.numeroDossierOpco !== null && session.numeroDossierOpco !== undefined
            ? { numeroDossierOpco: session.numeroDossierOpco }
            : {}),
          statut: "emise",
          emiseAt: now,
          echeanceAt: echeance,
          ...(documentId !== null ? { documentId } : {}),
        },
        select: { id: true, numero: true },
      });
      factureCreee = facture;
      break;
    } catch (err: unknown) {
      const isPrismaUniqueError =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (isPrismaUniqueError && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }

  if (!factureCreee) {
    throw new Error(
      `[genererFactureFormation] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives.`,
    );
  }

  return {
    factureId: factureCreee.id,
    numero: factureCreee.numero,
    documentId,
  };
}
