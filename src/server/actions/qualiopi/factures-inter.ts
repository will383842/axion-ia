/**
 * Qualiopi — Server Action : facture PAR INSCRIPTION (inter-entreprises, R-INTER).
 *
 * genererFactureParInscriptionAction : émet une facture pour UN participant d'une
 * session inter-entreprises, selon SON financement (override inscription) et SON
 * payeur. Distincte de la facture session-level (intra, financements.ts).
 *
 * TVA : régime dérivé de la config (`regime_tva`, défaut assujetti — cf.
 * legal/tva.ts) ; la mention n'est jamais codée en dur. Numéro séquentiel
 * AXI-FACT-YYYY-NNN.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { champsIdentiteManquants } from "@/server/qualiopi/documents/conformite";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import {
  computeTotauxFacture,
  isRegimeTva,
  REGIME_TVA_DEFAUT,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import {
  resolveEnrollmentFinancement,
  destinataireFacture,
  checkFactureParInscription,
} from "@/server/qualiopi/financements/inter-entreprises";
import { calculerEcheanceFacture } from "@/server/qualiopi/financements/conditions-client";

type ActionResult<T> = { data: T } | { error: string };

const schema = z.object({ enrollmentId: z.string().uuid() });

/**
 * Prochain numéro de la série `AXI-FACT-YYYY-NNN` sur `factures_formation`.
 * Le dénominateur était correct (filtré par préfixe) ; la mécanique ne l'était
 * pas — un `count()` recule dès qu'une facture disparaît de la série.
 */
async function genererNumeroFacture(annee: number): Promise<string> {
  return nextNumero("facture", annee, (prefixe) =>
    prisma.factureFormation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    }),
  );
}

export async function genererFactureParInscriptionAction(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    select: {
      id: true,
      financementType: true,
      clientId: true,
      numeroDossierOpco: true,
      edofVerifieAt: true,
      ftDispositif: true,
      montantHtCents: true,
      trainee: { select: { nom: true, prenom: true } },
      client: {
        select: {
          raisonSociale: true,
          siret: true,
          adresse: true,
          opcoIdentifie: true,
          // Conditions de paiement du payeur (F61) — sert à poser l'échéance.
          delaiPaiementJours: true,
        },
      },
      session: {
        select: {
          id: true,
          interEntreprises: true,
          financementType: true,
          clientId: true,
          numeroDossierOpco: true,
          edofVerifieAt: true,
          ftDispositif: true,
          montantHtCents: true,
          opcoSubrogation: true,
          titreSession: true,
          client: {
            select: {
              raisonSociale: true,
              siret: true,
              adresse: true,
              opcoIdentifie: true,
              delaiPaiementJours: true,
            },
          },
        },
      },
    },
  });

  if (!enrollment) return { error: "Inscription introuvable" };
  if (!enrollment.session.interEntreprises) {
    return {
      error: "Session non inter-entreprises : utiliser la facturation au niveau session.",
    };
  }

  const resolved = resolveEnrollmentFinancement(enrollment, {
    financementType: enrollment.session.financementType,
    clientId: enrollment.session.clientId,
    numeroDossierOpco: enrollment.session.numeroDossierOpco,
    edofVerifieAt: enrollment.session.edofVerifieAt,
    ftDispositif: enrollment.session.ftDispositif,
    montantHtCents: enrollment.session.montantHtCents,
  });

  const readiness = checkFactureParInscription(resolved, {
    opcoSubrogation: enrollment.session.opcoSubrogation,
  });
  if (!readiness.ok) return { error: `Facture impossible : ${readiness.raison}` };

  // 🔴 Anti-DOUBLE ÉMISSION : une inscription déjà facturée (facture non annulée)
  // ne doit pas en générer une seconde — chacune consomme un NUMÉRO LÉGAL et
  // facturerait le participant deux fois. Une facture annulée autorise une réémission.
  // ⚠️ LIMITE : cette garde applicative (lecture puis écriture, hors transaction)
  // ferme le DOUBLE-CLIC séquentiel mais PAS une course concurrente stricte (deux
  // requêtes simultanées lisent `null` avant que l'une commite). La fermeture
  // complète exige un INDEX UNIQUE PARTIEL Postgres sur `enrollment_id WHERE statut
  // <> 'annulee'` — migration + confirmation métier (une inscription a-t-elle
  // toujours au plus UNE facture active ?). Voir _AUDIT/QUALIOPI-RESTE-WILL-2026-07-24.md.
  const dejaFacturee = await prisma.factureFormation.findFirst({
    where: { enrollmentId: enrollment.id, statut: { not: "annulee" } },
    select: { numero: true },
  });
  if (dejaFacturee !== null) {
    return {
      error: `Cette inscription est déjà facturée (${dejaFacturee.numero}). Annulez la facture existante avant d'en émettre une nouvelle.`,
    };
  }

  // 🔴 La subrogation décide de QUI est facturé, pas seulement de qui paie.
  // Sans elle, l'OPCO rembourse son adhérent : la facture va à l'entreprise.
  const destinataire = destinataireFacture(resolved.financementType, {
    opcoSubrogation: enrollment.session.opcoSubrogation,
  });
  const payeur = enrollment.client ?? enrollment.session.client;
  const traineeNom = `${enrollment.trainee.prenom} ${enrollment.trainee.nom}`;

  let destinataireNom = "À compléter";
  let destinataireSiret: string | undefined;
  let destinataireAdresse: string | undefined;
  if (destinataire === "opco") {
    // Libellé, pas slug : c'est le nom du destinataire imprimé sur la facture.
    // Cette branche est déjà gardée par `destinataire === "opco"` juste au-dessus.
    const opcoId = payeur?.opcoIdentifie ?? enrollment.session.client?.opcoIdentifie ?? null;
    destinataireNom = opcoId !== null ? opcoLabel(opcoId) : "OPCO";
  } else if (destinataire === "stagiaire") {
    destinataireNom = traineeNom;
  } else if (destinataire === "france_travail") {
    destinataireNom = "France Travail";
  } else {
    destinataireNom = payeur?.raisonSociale ?? "Entreprise";
    destinataireSiret = payeur?.siret ?? undefined;
    destinataireAdresse = payeur?.adresse ?? undefined;
  }

  // ⚠️ NOTE (constat #5, NON corrigé ici — risque de régression) : pour un
  // financement `direct`/`mixte`, `destinataireFacture` renvoie « entreprise » même
  // pour un PARTICULIER en auto-financement (sans employeur). Un garde-fou « refuser
  // si pas de raison sociale » bloquait donc à tort une facture nominative légale.
  // Le vrai correctif est dans le MAPPING `destinataireFacture` (distinguer un
  // particulier auto-financé → destinataire « stagiaire ») — arbitrage métier/juriste,
  // pas un simple garde. Voir _AUDIT/QUALIOPI-RESTE-WILL-2026-07-24.md.

  // Garde-fou conformité : facture inter illégale si identité OF incomplète.
  const identite = await getOrganismeIdentite();
  const manquants = champsIdentiteManquants(identite, "facture");
  if (manquants.length > 0) {
    return {
      error: `Identité de l'organisme incomplète (${manquants.join(", ")}). Renseignez ces valeurs dans les paramètres Qualiopi avant de facturer.`,
    };
  }

  const annee = new Date().getFullYear();
  const lignes = [
    {
      designation: `Formation « ${enrollment.session.titreSession} » — participant ${traineeNom}`,
      quantite: 1,
      prixUnitaireHtCents: resolved.montantHtCents,
    },
  ];

  // Régime de TVA (config, évolutif) + ventilation HT/TVA/TTC. Snapshot facture.
  const regimeTvaConfig = await getQualiopiConfig("regime_tva");
  const regimeTva: RegimeTva = isRegimeTva(regimeTvaConfig) ? regimeTvaConfig : REGIME_TVA_DEFAUT;
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(lignes, regimeTva, tauxStandard);

  // ── Émission explicite + échéance ────────────────────────────────────────
  //
  // 🔴 Ce chemin n'écrivait NI `statut`, NI `emiseAt`, NI `echeanceAt`. La ligne
  // retombait donc sur le défaut du schéma — `brouillon` — tout en ayant déjà
  // consommé un NUMÉRO LÉGAL de la série `AXI-FACT-YYYY-NNN`, en bloquant toute
  // réémission (« cette inscription est déjà facturée ») et en annonçant à
  // l'admin « Facture X générée ». Une facture émise de fait, parquée dans un
  // statut de brouillon : invisible de la balance âgée, du prévisionnel, du cron
  // de retard et donc de toute relance.
  //
  // Pourquoi émettre ICI plutôt que de laisser le brouillon à
  // `emettreFactureBrouillon` : ce dernier RÉALLOUE un numéro à l'émission. Un
  // vrai brouillon porte pour cela un provisoire `BROUILLON-<uuid>` (cf.
  // plan-recurrent.ts) ; celui-ci porte un numéro de série définitif. Le faire
  // passer par l'émission générique le renumérerait et laisserait un TROU dans
  // la séquence — exactement la rupture de continuité que le CGI 242 nonies A
  // interdit. On aligne donc l'état de la ligne sur ce que le reste du code et
  // l'interface affirment déjà : elle est émise.
  //
  // L'échéance suit le délai du PAYEUR (celui dont l'identité est imprimée sur
  // la facture), avec repli sur les 30 j par défaut. Sans elle, la facture reste
  // hors du circuit de recouvrement quel que soit son statut.
  const emiseAt = new Date();
  const echeanceAt = calculerEcheanceFacture(emiseAt, payeur?.delaiPaiementJours ?? null);

  let created: { id: string; numero: string };
  try {
    created = await withNumberRetry(async () => {
      const numero = await genererNumeroFacture(annee);
      return prisma.factureFormation.create({
        data: {
          numero,
          sessionId: enrollment.session.id,
          enrollmentId: enrollment.id,
          destinataire,
          destinataireNom,
          ...(destinataireSiret !== undefined ? { destinataireSiret } : {}),
          ...(destinataireAdresse !== undefined ? { destinataireAdresse } : {}),
          montantHtCents: resolved.montantHtCents,
          tvaExoneree: totaux.totalTvaCents === 0,
          regimeTva,
          montantTvaCents: totaux.totalTvaCents,
          montantTtcCents: totaux.totalTtcCents,
          lignes: lignes as never,
          subrogation: resolved.financementType === "opco" && enrollment.session.opcoSubrogation,
          ...(resolved.numeroDossierOpco !== null
            ? { numeroDossierOpco: resolved.numeroDossierOpco }
            : {}),
          statut: "emise",
          emiseAt,
          echeanceAt,
        },
        select: { id: true, numero: true },
      });
    });
  } catch {
    return { error: "Erreur lors de la création de la facture." };
  }

  await logQualiopiActivity({
    action: "qualiopi.facture.par_inscription",
    targetType: "FactureFormation",
    targetId: created.id,
    changes: {
      numero: created.numero,
      enrollmentId: enrollment.id,
      destinataire,
      montantHtCents: resolved.montantHtCents,
    },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}
