/**
 * Qualiopi — ÉMISSION d'une facture de formation au niveau session, et rendu de
 * son PDF. Service PUR : aucun `"use server"`, aucun `next/headers`, aucune
 * garde d'accès, aucun journal.
 *
 * ## Pourquoi ce module existe (2026-09-15)
 *
 * Ce corps vivait dans `actions/qualiopi/financements.ts`, derrière le bouton
 * « Générer la facture de formation ». La facture d'une session réalisée est
 * désormais AUSSI générée automatiquement le lendemain de sa fin, par un cron du
 * worker (`facture-auto-session.ts`). Or le worker tourne `tsx` HORS de Next :
 * une Server Action y lève dès sa garde d'accès (`requireHabilitation` lit la
 * session du navigateur), et le job échouerait en silence à chaque passage.
 *
 * 🔑 Il n'y a donc qu'UN chemin d'émission — même numérotation légale continue
 * (`AXI-FACT`, art. 242 nonies A ann. II CGI), même résolution de l'acheteur,
 * même facturation par créance, même PDF — et deux enveloppes : l'action (garde
 * `facturer` + journal au nom de l'administrateur) et le cron (journal
 * `qualiopi.facture.generer.auto`, sans administrateur). Le code ci-dessous a
 * été DÉPLACÉ tel quel, commentaires compris ; les tests du bouton
 * (`financements-actions.spec.ts`, `facture-creance-cablage.spec.ts`) sont
 * rejoués sans modification.
 *
 * ⚠️ Ne réintroduisez ici ni garde d'accès ni `logQualiopiActivity` : ce sont
 * les enveloppes qui savent QUI agit. Garde :
 * `facture-auto-session.graphe-worker.spec.ts`.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { computeVentilationDossier } from "@/server/qualiopi/financements/opco-calcul";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { champsIdentiteManquants } from "@/server/qualiopi/documents/conformite";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  computeTotauxFacture,
  isRegimeTva,
  regimeTvaDepuisConfig,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import {
  resoudreDestinataireFacture,
  destinataireEstPersonnePhysique,
  CLIENT_FACTURABLE_SELECT,
} from "@/server/qualiopi/financements/destinataire-facture";
import { DELAI_PAIEMENT_DEFAUT_JOURS } from "@/server/qualiopi/financements/conditions-client";
import { choisirCreancePourFacture } from "@/server/qualiopi/financements/facture-par-creance";
import { resolveRibFacture } from "@/lib/legal-identity";
import { periodePrestationSession } from "@/server/qualiopi/financements/periode-prestation";
import { FacturePdf } from "@/server/qualiopi/documents/templates/facture";
import type { FactureData } from "@/server/qualiopi/documents/templates/facture";
import { factureVivante } from "@/server/qualiopi/financements/facture-vivante";
import { avecVerrouFactureSession } from "@/server/qualiopi/financements/verrou-facture-session";
import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";

/**
 * `code` distingue les refus que l'automate traite À PART d'une erreur métier :
 *   - `verrou_pris` : un autre passage (ou un clic) émet pour cette session ;
 *   - `deja_facturee` : une facture vivante couvre déjà la prestation ;
 *   - `garde` : la précondition de l'appelant, relue sous verrou, a refusé.
 */
export type CodeRefusEmission = "verrou_pris" | "deja_facturee" | "garde";

export type ResultatEmission<T> = { data: T } | { error: string; code?: CodeRefusEmission };

export interface EmettreFactureSessionInput {
  sessionId: string;
  destinataire: FactureFormationDestinataire;
  ventilation: "forfait" | "horaire";
}

export interface FactureSessionEmise {
  factureId: string;
  numero: string;
  documentId: string | null;
  /** Destinataire EFFECTIF, tel qu'écrit sur la pièce. */
  destinataire: FactureFormationDestinataire;
  ventilation: "forfait" | "horaire";
  totalHtCents: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alloue le prochain numéro de la série légale des factures (`AXI-FACT-YYYY-NNN`).
 *
 * 🔴 Audit certification 2026-07-26 (V20, étape 0). Ce compteur portait sur
 * `createdAt` — « toutes les lignes de `factures_formation` créées dans l'année ».
 * Or cette table n'héberge pas UNE série mais QUATRE :
 *   - la série légale des factures (préfixe `NUMBERING_PREFIX.facture`), celle-ci ;
 *   - les AVOIRS (`facture-libre.ts`, `avoirDeId` non nul) : série légale
 *     DISTINCTE, avec son propre compteur préfixé `AXI-AVO-` ;
 *   - les brouillons de plan récurrent (`BROUILLON-<uuid>`, `plan-recurrent.ts`) :
 *     numéro provisoire jusqu'au clic d'émission ;
 *   - les reprises d'historique (`estImportee`), que le schéma qualifie lui-même
 *     de « hors séquence AXI-FACT », et dont le `createdAt` est la date d'IMPORT
 *     et non la date d'émission.
 *
 * Compter par `createdAt` additionne les quatre. Deux clics suffisent : une
 * facture émise, puis un avoir, et l'appel suivant compte 2 lignes et saute au
 * n° 003. Le 002 n'existera jamais — rupture de la séquence chronologique
 * continue exigée par l'art. 242 nonies A ann. II du CGI. Et comme les cinq
 * autres allocateurs de la MÊME série (facturation-service, facture-libre,
 * plan-recurrent, factures-inter, facturation-1to1) comptent, eux, par PRÉFIXE,
 * les deux dénominateurs dérivent l'un de l'autre et finissent par réémettre un
 * numéro déjà porté par une pièce comptable (P2002 sur un registre légal).
 *
 * Second piège, celui qu'aucun retry ne rattrape : un brouillon de plan récurrent
 * créé en décembre et émis en janvier porte un `createdAt` en N-1 et un numéro en
 * N. Le compteur `createdAt` de l'année N ne le voit JAMAIS → il réalloue
 * indéfiniment le même numéro, `withNumberRetry` recalcule la même valeur à chaque
 * tentative, cinq P2002 d'affilée, échec dur, aucune facture émise.
 *
 * On aligne donc sur le prédicat préfixé des cinq autres allocateurs. Le préfixe
 * de comptage et le préfixe d'écriture sont dérivés de la MÊME constante : c'est
 * la divergence entre deux littéraux recopiés à la main qui a produit F63, puis
 * V12. Ne pas réintroduire de littéral ici.
 *
 * ⚠️ Ceci n'est PAS le compteur définitif, et V20 n'est PAS refermé. `count + 1`
 * reste faux en cas de SUPPRESSION d'une pièce : le compteur recule et réattribue
 * un numéro déjà utilisé sans violer l'unicité, puisque la ligne a disparu — or
 * l'art. 242 nonies A interdit le réemploi. C'est l'objet de L7 (`allocateNumero`
 * sous verrou transactionnel, `MAX(seq) + 1`). L'étape 0 ne corrige QUE le
 * DÉNOMINATEUR, et elle se fait maintenant parce que la table est vide (vérifié en
 * production : `SELECT count(*) FROM factures_formation` = 0) : la fenêtre de
 * correction sans reprise de données se referme à la première facture émise.
 */
async function genererNumeroFacture(annee: number): Promise<string> {
  return nextNumero("facture", annee, (prefixe) =>
    prisma.factureFormation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    }),
  );
}

/**
 * Calcule les lignes de ventilation forfait (1 ligne globale).
 */
function computeForfait(montantHtCents: number): {
  lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  totalHtCents: number;
} {
  return {
    lignes: [
      {
        designation: "Formation professionnelle — forfait",
        quantite: 1,
        prixUnitaireHtCents: montantHtCents,
      },
    ],
    totalHtCents: montantHtCents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Émission
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Émet une facture de formation (forfait | horaire) pour une session.
 *
 * Valide les bloquants avant création :
 * - OPCO+subrogation → numeroDossierOpco obligatoire.
 * - CPF → edofVerifieAt non-null.
 * - OPCO → opcoStatut=accord_recu.
 *
 * TVA : régime dérivé de la config (`regime_tva`, défaut assujetti — cf.
 * legal/tva.ts) ; `tvaExoneree` est calculé (`totalTvaCents === 0`), jamais posé
 * d'office.
 *
 * ⚠️ L'entrée est supposée VALIDÉE par l'appelant (schéma Zod de l'action,
 * décision pure du cron).
 *
 * 🔴 SOUS VERROU CONSULTATIF PAR SESSION (relecture A09, PR 1097). Le bouton et
 * l'automate prennent le même : deux clics simultanés, ou un clic pendant le
 * passage du cron, n'émettent qu'une pièce. Et sous ce verrou, une facture
 * VIVANTE qui couvre déjà la prestation fait refuser l'émission.
 *
 * @param options.garde  précondition de l'appelant, évaluée SOUS le verrou
 *   (l'automate y relit sa décision). Un message non nul refuse l'émission.
 */
export async function emettreFactureFormationSession(
  input: EmettreFactureSessionInput,
  options?: { garde?: () => Promise<string | null> },
): Promise<ResultatEmission<FactureSessionEmise>> {
  const issue = await avecVerrouFactureSession(input.sessionId, async () => {
    if (options?.garde !== undefined) {
      const refus = await options.garde();
      if (refus !== null) return { error: refus, code: "garde" } as const;
    }
    return emettreSansVerrou(input);
  });
  if (!issue.acquis) {
    return {
      error:
        "Une génération de facture est déjà en cours pour cette session. Réessayez dans un instant.",
      code: "verrou_pris",
    };
  }
  return issue.valeur;
}

async function emettreSansVerrou(
  input: EmettreFactureSessionInput,
): Promise<ResultatEmission<FactureSessionEmise>> {
  const { sessionId, destinataire, ventilation } = input;

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      financementType: true,
      opcoStatut: true,
      opcoSubrogation: true,
      numeroDossierOpco: true,
      edofVerifieAt: true,
      montantHtCents: true,
      dureeReelleHeures: true,
      nbParticipantsReels: true,
      nbParticipantsPrevus: true,
      modalite: true,
      titreSession: true,
      numero: true,
      // Barème prise en charge (T18)
      priseEnChargeMontantCents: true,
      priseEnChargeUnite: true,
      priseEnChargePlafondFormationCents: true,
      priseEnChargePlafondAnnuelCents: true,
      dateDebut: true,
      dateFin: true,
      clientId: true,
      // 🔴 Les créances du dossier — c'est elles qui disent QUI doit et COMBIEN.
      // Sans ce `select`, le destinataire était écrasé à « opco » en subrogation
      // et le reste à charge n'était facturable à personne.
      dossiersFinancement: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          payeurs: {
            select: {
              id: true,
              payeurType: true,
              payeurNom: true,
              montantAttenduCents: true,
              factureFormationId: true,
            },
          },
        },
      },
      client: {
        select: {
          ...CLIENT_FACTURABLE_SELECT,
          // Conditions de règlement propres au client (F61) — priment sur la config.
          delaiPaiementJours: true,
        },
      },
      // 🔴 Les factures ORIGINALES déjà rattachées à la session (un avoir ne
      // porte pas de `sessionId`) : c'est ce qui refuse le doublon, plus bas.
      facturesFormation: {
        where: { avoirDeId: null },
        select: {
          id: true,
          numero: true,
          statut: true,
          montantHtCents: true,
          avoirs: { select: { statut: true, montantHtCents: true } },
        },
      },
    },
  });
  if (!trainingSession) return { error: "Session introuvable" };

  // ── Validations bloquantes ────────────────────────────────────────────────

  // OPCO accord BLOQUANT
  if (
    (trainingSession.financementType === "opco" || trainingSession.financementType === "mixte") &&
    trainingSession.opcoStatut !== "accord_recu" &&
    trainingSession.opcoStatut !== "paiement_recu"
  ) {
    return {
      error:
        "Accord OPCO non reçu — impossible de générer la facture. Validez l'accord OPCO d'abord.",
    };
  }

  // Subrogation : numeroDossierOpco obligatoire
  if (trainingSession.opcoSubrogation && !trainingSession.numeroDossierOpco) {
    return {
      error:
        "Subrogation OPCO activée mais le numéro de dossier OPCO est absent. Renseignez-le avant de facturer.",
    };
  }

  // CPF : vérification EDOF obligatoire
  if (trainingSession.financementType === "cpf" && !trainingSession.edofVerifieAt) {
    return {
      error: "Financement CPF sans vérification EDOF. Vérifiez le dossier EDOF avant de facturer.",
    };
  }

  // Identité de l'organisme complète (mentions vendeur obligatoires sur facture :
  // SIRET, NDA, adresse du siège). Bloque AVANT la création du dossier facture
  // avec un message actionnable plutôt que de produire un document non conforme.
  const identiteFacture = await getOrganismeIdentite();
  const manquants = champsIdentiteManquants(identiteFacture, "facture");
  if (manquants.length > 0) {
    return {
      error: `Identité de l'organisme incomplète (${manquants.join(", ")}). Renseignez ces valeurs dans les paramètres Qualiopi avant de facturer.`,
    };
  }

  // ── Calcul des lignes ─────────────────────────────────────────────────────

  let lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  let totalHtCents: number;

  if (ventilation === "forfait") {
    const result = computeForfait(trainingSession.montantHtCents);
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  } else {
    // Ventilation horaire — barème saisi sur le dossier (T18)
    const dureeHeures = trainingSession.dureeReelleHeures ?? 0;
    const nbParticipants =
      trainingSession.nbParticipantsReels ?? trainingSession.nbParticipantsPrevus;
    // Durée réelle obligatoire
    if (dureeHeures === 0) {
      return {
        error:
          "Durée réelle non renseignée — impossible de calculer la ventilation horaire. Renseignez la durée réelle de la session.",
      };
    }
    // Barème de prise en charge obligatoire
    if (
      trainingSession.priseEnChargeMontantCents == null ||
      trainingSession.priseEnChargeUnite == null
    ) {
      return {
        error:
          "Barème de prise en charge non renseigné sur le dossier — à relever sur le portail OPCO de la branche du client.",
      };
    }
    const result = computeVentilationDossier({
      unite: trainingSession.priseEnChargeUnite,
      montantCents: trainingSession.priseEnChargeMontantCents,
      dureeHeures,
      nbParticipants,
      ...(trainingSession.priseEnChargePlafondFormationCents != null
        ? { plafondFormationCents: trainingSession.priseEnChargePlafondFormationCents }
        : {}),
      ...(trainingSession.priseEnChargePlafondAnnuelCents != null
        ? { plafondAnnuelCents: trainingSession.priseEnChargePlafondAnnuelCents }
        : {}),
    });
    lignes = result.lignes;
    totalHtCents = result.totalHtCents;
  }

  // ── 🔴 DESTINATAIRE ET MONTANT VIENNENT DE LA CRÉANCE ────────────────────
  //
  // Cette ligne valait `opcoSubrogation ? "opco" : destinataire` : le choix de
  // l'humain était ÉCRASÉ dès que la subrogation était cochée. Conséquence,
  // **le reste à charge n'était facturable à personne** — impossible d'émettre
  // depuis la session la seconde facture, celle de l'entreprise. Le seul
  // contournement était une facture libre ressaisie à la main, sans lien avec
  // le dossier.
  //
  // La règle métier n'a pourtant jamais été douteuse (plan, Lot 8 étape 6) :
  // **l'OPCO paie sa part, le client le reste à charge**. Deux factures. Ce qui
  // manquait n'était pas la décision, c'était le chemin.
  //
  // `DossierPayeur` était conçu pour ça depuis l'origine. On facture donc PAR
  // CRÉANCE : le destinataire vient de la ligne, le montant aussi (plus de
  // double comptage : facturer le total de la session à l'OPCO puis le reste à
  // l'entreprise réclamerait deux fois la même somme), et le rattachement
  // s'écrit à l'émission.
  //
  // ⚠️ Sans dossier ni créance, on retombe sur le comportement historique. Un
  // dossier peut légitimement ne pas exister (financement direct, affaire
  // antérieure au mécanisme) : refuser là serait bloquer une émission licite.
  // `?? []` sur le TABLEAU lui-même : une session lue par un chemin qui ne
  // sélectionne pas la relation rendrait `undefined`, et l'indexation lèverait.
  const dossier = (trainingSession.dossiersFinancement ?? [])[0];
  const creances = dossier?.payeurs ?? [];
  const dossierId = dossier?.id ?? null;
  const choix = choisirCreancePourFacture(creances, destinataire);

  if (!choix.ok && choix.raison !== "aucune_creance") {
    return { error: choix.message };
  }

  // ── 🔴 JAMAIS DEUX FACTURES VIVANTES POUR LA MÊME PRESTATION ──────────────
  //
  // Relecture A09 de la PR 1097 : depuis que l'automate émet la facture d'une
  // session en financement direct le lendemain de sa fin, ce bouton — affiché
  // sans condition — en émettait une SECONDE l'après-midi. Sans créance, rien
  // ne regardait les factures existantes.
  //
  //   · SANS créance : la facture couvre toute la session. Toute autre facture
  //     vivante de la session la couvre déjà.
  //   · AVEC créances : chaque créance a sa facture (OPCO + reste à charge : le
  //     cas légitime de deux factures). Seule une facture vivante rattachée à
  //     AUCUNE créance du dossier — une facture « globale » — couvre déjà tout.
  //     La double facturation d'une MÊME créance est refusée par
  //     `choisirCreancePourFacture`, plus haut.
  //
  // ⚠️ Vivante = ni annulée, ni entièrement rectifiée par avoir (`facture-
  // vivante.ts`). Refacturer après un avoir total reste donc possible — c'est
  // exactement le geste que le message prescrit.
  const rattacheesAUneCreance = new Set(
    creances.map((c) => c.factureFormationId).filter((id): id is string => id !== null),
  );
  const couvrantes = (trainingSession.facturesFormation ?? []).filter(
    (f) => factureVivante(f) && !(choix.ok && rattacheesAUneCreance.has(f.id)),
  );
  if (couvrantes.length > 0) {
    const numeros = couvrantes.map((f) => f.numero).join(", ");
    return {
      error:
        `Une facture existe déjà pour cette session : ${numeros}. ` +
        "Pour refacturer, émettez d'abord un avoir sur cette facture.",
      code: "deja_facturee",
    };
  }

  const destinataireEffectif: FactureFormationDestinataire = destinataire;

  // ── 🔴 CETTE FACTURE-CI part-elle au financeur ? ──────────────────────────
  //
  // Trois consommateurs interrogeaient `trainingSession.opcoSubrogation`,
  // c'est-à-dire « cette SESSION est-elle subrogée ? », là où la question posée
  // est « cette FACTURE-CI part-elle au financeur ? ». Depuis que le bloc
  // ci-dessus a retiré l'écrasement du destinataire — à raison : « l'OPCO paie
  // sa part, le client le reste à charge, deux factures » — les deux questions
  // ont des réponses DIFFÉRENTES sur la facture du reste à charge.
  //
  // Ce qu'un client recevait, sur une session subrogée :
  //
  //   · l'encadré légal du gabarit PDF, alimenté par `nomOpco:
  //     facture.destinataireNom` (plus bas) — soit, mot pour mot : « Facture
  //     libellée à l'OPCO **Acme** dans le cadre de la subrogation de paiement ».
  //     La facture appelait le CLIENT « OPCO », sous son propre SIRET, et
  //     affirmait qu'un financeur la réglait alors que ces euros sont
  //     précisément le reste à charge qu'il doit payer lui-même. Elle se
  //     contredisait avec ses propres conditions de règlement et le RIB imprimé
  //     dessous. Mentions obligatoires FAUSSES (art. L.441-9 C. com.,
  //     242 nonies A CGI) ;
  //   · le délai de paiement du FINANCEUR (45 j) au lieu du sien (30 j) — alors
  //     que le commentaire de l'échéance, plus bas, écrit lui-même la bonne
  //     règle : « sauf subrogation, où c'est le FINANCEUR QUI PAIE, avec son
  //     délai propre ».
  //
  // 🔑 Le gabarit PDF PRÉSUPPOSE l'écrasement qu'on lui a retiré. Un émetteur a
  // changé de règle ; ni lui, ni son jumeau `facturation-service.ts:147` — qui
  // écrase toujours, et reste donc cohérent — n'ont suivi.
  //
  // ⚠️ Volontairement `=== "opco"` et non « tout financeur » : la subrogation
  // est un mécanisme OPCO, et étendre à `france_travail` ALLONGERAIT son délai
  // de 30 à 45 jours. Élargir un délai de paiement n'est pas la direction
  // prudente, et ce n'est pas le défaut mesuré.
  const factureAuFinanceurSubroge =
    trainingSession.opcoSubrogation && destinataireEffectif === "opco";
  if (choix.ok) {
    // Le montant de la créance PRIME sur la ventilation calculée : c'est lui
    // qui porte la part réellement due par ce débiteur après application du
    // plafond du financeur.
    totalHtCents = choix.montantHtCents;
    lignes = [
      {
        designation: `${lignes[0]?.designation ?? "Prestation de formation"} — part ${choix.creance.payeurNom}`,
        quantite: 1,
        prixUnitaireHtCents: choix.montantHtCents,
      },
    ];
  }

  // 🔴 Identité de l'ACHETEUR — nom + SIRET + adresse (art. L.441-9 C. com.,
  // 242 nonies A CGI). Ce chemin enregistrait `trainingSession.titreSession`
  // comme destinataire : la première facture réelle est partie au nom de
  // « IA pour l'immobilier — INVEST SUN (Saint-Étienne) », sans SIRET ni adresse.
  // Le client était pourtant déjà chargé, et jamais lu. Cf. destinataire-facture.ts.
  const acheteur = resoudreDestinataireFacture(destinataireEffectif, trainingSession.client);

  // ── Échéance de paiement ─────────────────────────────────────────────────
  // Jamais posée jusqu'ici : la colonne `echeanceAt` restait nulle, le hub
  // affichait « — » et le PDF retombait sur émission + 30 j. Or l'échéance est
  // une mention obligatoire, et le délai est réglable par client (F61) —
  // sauf subrogation, où c'est le financeur qui paie, avec son délai propre.
  const [delaiClientGlobal, delaiFinanceur] = await Promise.all([
    getQualiopiConfig("delai_paiement_jours"),
    getQualiopiConfig("delai_paiement_financeur_jours"),
  ]);
  const delaiRetenu = factureAuFinanceurSubroge
    ? delaiFinanceur
    : (trainingSession.client?.delaiPaiementJours ?? delaiClientGlobal);
  const delaiJours =
    typeof delaiRetenu === "number" && Number.isFinite(delaiRetenu) && delaiRetenu > 0
      ? delaiRetenu
      : DELAI_PAIEMENT_DEFAUT_JOURS;
  const emiseAt = new Date();
  const echeanceAt = new Date(emiseAt);
  echeanceAt.setDate(echeanceAt.getDate() + delaiJours);

  // ── Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC ─────────────
  // Qualiopi n'a aucun effet sur la TVA : le régime est lu depuis la config et
  // figé sur la facture (snapshot). Défaut « assujetti » (20 %).
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = regimeTvaDepuisConfig(regimeTvaConfig);
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

  // ── Numéro séquentiel + création atomique ─────────────────────────────────
  // R7 : `genererNumeroFacture` lit la BORNE HAUTE de la série ; sous création
  // concurrente deux factures peuvent lire le même maximum → même numéro. La
  // contrainte @unique sur `numero` rejette le doublon (P2002) ; `withNumberRetry`
  // ré-alloue et réessaie — et la reprise CONVERGE désormais, le maximum
  // progressant dès qu'une insertion concurrente a abouti (avec `count+1` elle
  // rejouait le même numéro cinq fois).
  // L'allocation DOIT rester DANS la closure pour être recalculée à chaque tentative.
  //
  // V20 étape 0 — ce que le nouveau dénominateur garantit, et ce qu'il ne garantit
  // PAS. Le compteur porte désormais sur `numero startsWith "AXI-FACT-<annee>-"` :
  // la ligne gagnante entre immédiatement dans le dénominateur de la tentative
  // suivante, donc le retry PROGRESSE sous CONCURRENCE. (Avec l'ancien filtre
  // `createdAt`, une facture dont la LIGNE datait d'une année antérieure — un
  // brouillon de plan récurrent émis en janvier — restait invisible au compteur :
  // les 5 tentatives recalculaient le même numéro et l'action échouait en boucle.)
  // En revanche il ne progresse TOUJOURS PAS sur un TROU de séquence : si 001 et
  // 003 existent sans 002, count = 2 → réalloue 003 → P2002 → recount = 2 → même
  // numéro → échec dur, car `withNumberRetry` relance une closure déterministe
  // sans lui passer le n° de tentative (cf. numbering/retry.ts). Ne PAS « corriger »
  // en passant `count + tentative` comme reclamations.ts : cela creuserait un trou
  // de plus dans la série (collision sur 001 → la tentative 2 émettrait 003), soit
  // exactement la rupture CGI 242 nonies A que ce lot referme. Non atteignable
  // aujourd'hui (aucun chemin applicatif ne supprime de `factureFormation`, et
  // `importerFacturesHistoriqueAction` refuse les préfixes AXI-FACT/AXI-AVO) ;
  // fermé pour de bon par L7 (`allocateNumero`, MAX(seq)+1 sous verrou).
  const annee = new Date().getFullYear();
  const facture = await withNumberRetry(async () => {
    const numero = await genererNumeroFacture(annee);
    return prisma.factureFormation.create({
      data: {
        numero,
        sessionId,
        // Classe la facture dans le hub (filtre « Formation ») — laissée nulle,
        // la ligne échappait à toute ventilation par activité.
        activite: "formation",
        // Rattache la facture au client CRM : sans ce lien, le hub et les
        // relances retombent sur le libellé figé au lieu de la fiche client.
        ...(trainingSession.clientId != null ? { clientId: trainingSession.clientId } : {}),
        // 🔴 LE RATTACHEMENT AU DOSSIER, jamais écrit jusqu'ici par aucun
        // émetteur. Son absence rendait `marquerPaiementRecuSiSoldee` du CODE
        // MORT — sa condition n'était jamais vraie — donc un dossier
        // n'atteignait jamais `paiement_recu` autrement qu'à la main, et le
        // pilotage ne voyait jamais un euro encaissé.
        ...(dossierId !== null ? { dossierFinancementId: dossierId } : {}),
        destinataire: destinataireEffectif,
        destinataireNom: acheteur.nom,
        destinataireSiret: acheteur.siret,
        destinataireAdresse: acheteur.adresse,
        destinataireTvaIntracom: acheteur.tvaIntracom,
        montantHtCents: totalHtCents,
        tvaExoneree: totaux.totalTvaCents === 0,
        regimeTva,
        montantTvaCents: totaux.totalTvaCents,
        montantTtcCents: totaux.totalTtcCents,
        lignes: lignes as never,
        subrogation: factureAuFinanceurSubroge,
        numeroDossierOpco: factureAuFinanceurSubroge
          ? (trainingSession.numeroDossierOpco ?? null)
          : null,
        statut: "emise",
        emiseAt,
        echeanceAt,
      },
      select: { id: true, numero: true, documentId: true },
    });
  });

  // 🔴 Le second lien : la CRÉANCE pointe vers sa facture.
  //
  // Sans lui, on saurait qu'un dossier a des factures sans savoir QUELLE
  // créance chacune solde — donc impossible de dire ce qu'il reste à encaisser
  // de chaque payeur, ce que le plan exige explicitement (Lot 8, étape 6).
  //
  // C'est aussi lui qui rend l'anti-double-émission opérant : sans marquage, la
  // même créance se refacturerait indéfiniment.
  //
  // Best-effort : la facture est émise et porte un numéro légal. Faire échouer
  // l'action ici laisserait une facture réelle non rattachée, ce qui est PIRE
  // que le rattachement manquant — on journalise et on continue.
  if (choix.ok) {
    try {
      await prisma.dossierPayeur.update({
        where: { id: choix.creance.id },
        data: { factureFormationId: facture.id },
      });
    } catch (err) {
      console.error("[financements] rattachement créance → facture impossible", {
        creanceId: choix.creance.id,
        factureId: facture.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    data: {
      factureId: facture.id,
      numero: facture.numero,
      documentId: facture.documentId,
      destinataire: destinataireEffectif,
      ventilation,
      totalHtCents,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère (ou régénère) le PDF d'une FactureFormation existante, puis stocke
 * documentId sur la facture.
 *
 * Fail-soft : si le renderer PDF échoue, retourne { error } sans lever.
 */
export async function genererPdfFactureFormation(
  factureId: string,
): Promise<ResultatEmission<{ factureId: string; documentId: string }>> {
  // Chargement de la facture avec les données nécessaires pour reconstruire le PDF
  const facture = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: {
      id: true,
      numero: true,
      destinataireNom: true,
      destinataireSiret: true,
      destinataireAdresse: true,
      destinataireTvaIntracom: true,
      refClient: true,
      montantHtCents: true,
      lignes: true,
      regimeTva: true,
      subrogation: true,
      numeroDossierOpco: true,
      emiseAt: true,
      echeanceAt: true,
      sessionId: true,
      // 🔴 2026-08-25, cahier D4-3 — la REGENERATION doit rendre la meme piece
      // que l'emission. Sans ces deux champs, un PDF regenere reimprimerait les
      // trois mentions du Code de commerce ENTRE PROFESSIONNELS sur la facture
      // d'un particulier, alors que l'emission ne les met plus. Deux rendus
      // differents pour la meme facture, c'est pire que le defaut d'origine.
      destinataire: true,
      session: { select: { client: { select: { type: true } } } },
    },
  });
  if (!facture) return { error: "Facture introuvable" };

  // Reconstruction de FactureData pour le renderer
  const identite = await getOrganismeIdentite();
  // Régime de TVA figé sur la facture (snapshot) + taux standard courant.
  // ⛔ PAS `regimeTvaDepuisConfig` ICI (ADR 0050 §7) : on RE-REND une facture
  // déjà émise. Lui appliquer le verrou réimprimerait à 20 % une pièce qui est
  // partie exonérée — c'est-à-dire falsifier un document opposable, au lieu
  // d'empêcher un document futur.
  const regimeTva: RegimeTva = isRegimeTva(facture.regimeTva)
    ? facture.regimeTva
    : REGIME_TVA_DEFAUT;
  const tauxTvaStandardPercent =
    (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;

  const formatDate = (d: Date | null | undefined): string =>
    d ? d.toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR");

  const echeance =
    facture.echeanceAt ??
    (() => {
      const d = new Date(facture.emiseAt ?? new Date());
      d.setDate(d.getDate() + 30);
      return d;
    })();

  const lignes = (Array.isArray(facture.lignes) ? facture.lignes : []) as Array<{
    designation: string;
    quantite: number;
    prixUnitaireHtCents: number;
    tauxTvaPercent?: number;
  }>;

  // 🔴 Le RIB, sans lequel le client n'a AUCUNE coordonnée pour virer.
  //
  // Ce chemin — la RÉGÉNÉRATION d'un PDF de facture — était le seul des quatre
  // producteurs à ne pas l'injecter : `facture-libre.ts`,
  // `facturation-service.ts` et `facturation-1to1.ts` appellent tous
  // `resolveRibFacture()`. Conséquence silencieuse : régénérer une facture en
  // retirait les coordonnées bancaires, et le client recevait une pièce moins
  // complète que l'originale — sans que rien ne le signale.
  //
  // ⚠️ `null` quand l'IBAN n'est pas configuré (`legal_overrides`) : le gabarit
  // omet alors le bloc, ce qui est correct. On n'invente aucun IBAN.
  const rib = await resolveRibFacture();

  // Date de RÉALISATION de la prestation (art. 242 nonies A ann. II CGI) —
  // `sessionId` était DÉJÀ sélectionné ici sans jamais être lu, cf.
  // `periode-prestation.ts` pour ce que ce silence produisait sur la pièce.
  const sessionFacture =
    facture.sessionId !== null && facture.sessionId !== undefined
      ? await prisma.trainingSession.findUnique({
          where: { id: facture.sessionId },
          select: { dateDebut: true, dateFin: true },
        })
      : null;
  const periodePrestation = periodePrestationSession(sessionFacture);

  const factureData: FactureData = {
    numero: facture.numero,
    dateEmission: formatDate(facture.emiseAt),
    dateEcheance: formatDate(echeance),
    ...(periodePrestation !== undefined ? { periodePrestation } : {}),
    identite,
    regimeTva,
    tauxTvaStandardPercent,
    ...(facture.refClient !== null && facture.refClient !== ""
      ? { refClient: facture.refClient }
      : {}),
    client: {
      // 🔴 2026-08-25, cahier D4-3 — SANS ce champ, les trois mentions du Code
      // de commerce ENTRE PROFESSIONNELS partaient a un particulier. Le type
      // etait deja selectionne cote serveur : il manquait le branchement.
      // Derive au SSOT, jamais recopie ici.
      estPersonnePhysique: destinataireEstPersonnePhysique(
        facture.destinataire,
        facture.session?.client ?? null,
      ),
      raisonSociale: facture.destinataireNom,
      ...(facture.destinataireSiret !== null && facture.destinataireSiret !== undefined
        ? { siret: facture.destinataireSiret }
        : {}),
      ...(facture.destinataireAdresse !== null && facture.destinataireAdresse !== undefined
        ? { adresse: facture.destinataireAdresse }
        : {}),
      ...(facture.destinataireTvaIntracom !== null && facture.destinataireTvaIntracom !== undefined
        ? { numeroTvaIntracom: facture.destinataireTvaIntracom }
        : {}),
    },
    lignes,
    ...(facture.subrogation &&
    facture.numeroDossierOpco !== null &&
    facture.numeroDossierOpco !== undefined
      ? {
          subrogationOpco: {
            nomOpco: facture.destinataireNom,
            numeroDossier: facture.numeroDossierOpco,
          },
        }
      : {}),
    ...(rib !== null ? { rib } : {}),
  };

  // 🔴 Audit certification 2026-07-26 (F64). Ce chemin injectait le numéro
  // DocumentGenere dans l'en-tête du PDF, alors que la facture est enregistrée —
  // et exportée au FEC — sous le numéro `factureFormation`. Deux compteurs
  // `count+1` indépendants sur deux tables distinctes : ils partent ensemble et
  // divergent dès la première régénération de PDF, le premier échec de rendu, ou
  // la première facture de plan récurrent.
  //
  // Conséquence : le PDF remis au client porte un numéro ABSENT du registre
  // comptable. Facture introuvable dans les livres, refus au contrôle.
  //
  // Le défaut était DÉJÀ corrigé dans l'autre chemin de facturation
  // (`facturation-service.ts:228`), avec ce raisonnement écrit noir sur blanc.
  // Quelqu'un l'a vu une fois et n'a corrigé qu'un des deux appels. On ignore
  // donc `docNumero` ici aussi : le DocumentGenere garde son propre numéro pour
  // le classement interne R2 — artefact de stockage, sans valeur comptable.
  let documentId: string;
  try {
    const docResult = await generateDocument({
      type: "facture",
      buildElement: () => React.createElement(FacturePdf, { data: factureData }),
      refs: facture.sessionId != null ? { sessionId: facture.sessionId } : {},
    });
    documentId = docResult.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de génération PDF";
    return { error: `PDF non généré : ${msg}` };
  }

  // Mise à jour de la facture avec documentId
  await prisma.factureFormation.update({
    where: { id: factureId },
    data: { documentId },
  });

  return { data: { factureId, documentId } };
}
