/**
 * Qualiopi — Service RGPD stagiaire (T14 — AGENT A).
 *
 * exporterDonneesStagiaire : retourne un JSON complet de toutes les données du
 *                            stagiaire (droit d'accès RGPD art. 15).
 * supprimerStagiaire       : anonymise les PII + pose deletedAt (soft-delete).
 *                            PAS de DELETE physique (intégrité comptable/légale).
 * creerDemandeRgpd         : trace la demande en DB.
 *
 * Stub-aware : mutations lèvent si stub.invalid ; lectures retournent fallback.
 *
 * Règles non négociables :
 * - Suppression = anonymisation PII + deletedAt=now() (jamais DELETE physique).
 * - Export inclut le handicap déchiffré via decryptPii.
 * - exactOptionalPropertyTypes respecté.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { supprimerImageSignature } from "@/server/qualiopi/emargement/storage";
import { enqueueEmail } from "@/server/queue/queues";
import { notify } from "@/server/notifications";
import { redactName, redactEmail } from "@/lib/pii-redaction";
import type { RgpdDemandeType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export type { RgpdDemandeType };

export interface CreerDemandeRgpdResult {
  id: string;
  type: RgpdDemandeType;
  demandeAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// exporterDonneesStagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporte toutes les données d'un stagiaire au format JSON (droit d'accès RGPD).
 *
 * Inclut : identité, inscriptions, évaluations, questionnaires, documents,
 * appréciations liées, situation handicap déchiffrée, parcours coaching 1-to-1 /
 * AFEST (séances + comptes-rendus, évaluations, cartographie, plan, journaux,
 * transitions, contrat de coaching).
 *
 * Stub-aware : retourne un objet vide si DATABASE_URL contient "stub.invalid".
 */
export async function exporterDonneesStagiaire(traineeId: string): Promise<object> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {};
  }

  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: {
      enrollments: {
        include: {
          session: {
            select: {
              numero: true,
              titreSession: true,
              dateDebut: true,
              dateFin: true,
              modalite: true,
            },
          },
          evaluations: true,
          questionnaires: true,
          presences: true,
          // RGPD art. 15 — les signatures d'émargement SONT des données
          // personnelles : nom et adresse figés, empreinte d'IP, empreinte de
          // navigateur, et l'image du tracé manuscrit. Les omettre rendait
          // l'export incomplet — c'est l'oubli O1 du plan, et cet `include` est
          // une liste blanche écrite à la main : rien n'itère le modèle.
          //
          // `selfHash` et `prevHash` sont volontairement inclus : ils permettent
          // au stagiaire de faire vérifier l'intégrité de sa propre feuille par
          // un tiers, sans passer par nous.
          emargementSignatures: true,
          // Les jetons SANS leur empreinte : `tokenHash` n'apprendrait rien au
          // stagiaire et exposerait la seule donnée permettant de retrouver un
          // lien. On ne remonte que le cycle de vie.
          emargementTokens: {
            select: {
              id: true,
              createdAt: true,
              expiresAt: true,
              usedAt: true,
              revokedAt: true,
              revokedMotif: true,
            },
          },
        },
      },
      documents: true,
      appreciations: true,
      rgpdDemandes: true,
      // RGPD art. 15 — portabilité des parcours coaching 1-to-1 / AFEST.
      coachingSessions: {
        include: {
          comptesRendus: true,
          evaluations: true,
          cartographie: true,
          plan: true,
          journaux: true,
          transitions: true,
          coachingContract: true,
        },
      },
    },
  });

  if (trainee === null) return {};

  // Déchiffrer le détail handicap pour l'export (droit d'accès = données en clair)
  const handicapDetails =
    trainee.handicapDetailsChiffre !== null ? decryptPii(trainee.handicapDetailsChiffre) : null;

  return {
    exporteAt: new Date().toISOString(),
    stagiaire: {
      id: trainee.id,
      nom: trainee.nom,
      prenom: trainee.prenom,
      email: trainee.email,
      telephone: trainee.telephone ?? null,
      entreprise: trainee.entreprise ?? null,
      fonction: trainee.fonction ?? null,
      situationHandicap: trainee.situationHandicap,
      handicapDetails,
      consentementFormation: trainee.consentementFormation,
      consentementEmail: trainee.consentementEmail,
      consentementVersion: trainee.consentementVersion ?? null,
      consentementAt: trainee.consentementAt ?? null,
      createdAt: trainee.createdAt,
    },
    inscriptions: trainee.enrollments,
    documents: trainee.documents.map((d) => ({
      id: d.id,
      type: d.type,
      numero: d.numero,
      pdfUrl: d.pdfUrl ?? null,
      createdAt: d.createdAt,
    })),
    appreciations: trainee.appreciations,
    demandesRgpd: trainee.rgpdDemandes,
    // RGPD art.15 — parcours coaching 1-to-1 / AFEST du bénéficiaire.
    coachingSessions: trainee.coachingSessions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// supprimerStagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anonymise les données PII du stagiaire et pose `deletedAt = now()`.
 *
 * Champs anonymisés : nom, prenom, email, telephone, handicapDetailsChiffre.
 * Côté coaching 1-to-1 / AFEST : PII bénéficiaire/tuteur des CoachingSession +
 * notes confidentielles des CompteRenduSeance (mêmes transaction).
 * L'enregistrement est conservé pour l'intégrité comptable et légale (documents,
 * inscriptions, émargements, heures réalisées, attestations).
 *
 * PAS de DELETE physique — conformément au droit à l'effacement RGPD art. 17
 * appliqué sous contrainte de conservation légale (art. 17§3b).
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function supprimerStagiaire(traineeId: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("supprimerStagiaire: stub DB — non disponible au build");
  }

  const anonymNom = "[supprime]";
  const anonymPrenom = "[supprime]";
  // Email anonymisé unique pour éviter la violation de contrainte UNIQUE.
  const anonymEmail = `supprime-${traineeId}@anonymise.invalid`;
  const now = new Date();

  await prisma.$transaction([
    prisma.trainee.update({
      where: { id: traineeId },
      data: {
        nom: anonymNom,
        prenom: anonymPrenom,
        email: anonymEmail,
        telephone: null,
        entreprise: null,
        fonction: null,
        situationHandicap: false,
        handicapDetailsChiffre: null,
        consentementFormation: false,
        consentementEmail: false,
        deletedAt: now,
      },
    }),
    // RGPD : révoquer TOUS les accès portail du stagiaire anonymisé. Sans cela un
    // lien portail encore valide (token 90 j) resterait exploitable et donnerait
    // accès à l'espace d'un stagiaire pourtant « supprimé ». (Audit E2E 2026-06.)
    prisma.portailAcces.updateMany({
      where: { traineeId, revoked: false },
      data: { revoked: true },
    }),
    // RGPD : anonymiser les parcours coaching 1-to-1 / AFEST du stagiaire. Les
    // séances sont conservées (agrégats légaux : heures réalisées, attestations,
    // émargements, financement OPCO) mais purgées des PII bénéficiaire/tuteur.
    prisma.coachingSession.updateMany({
      where: { traineeId },
      data: {
        beneficiaireNom: null,
        beneficiaireEmail: null,
        beneficiaireEntreprise: null,
        tuteurEntrepriseNom: null,
        tuteurEntrepriseEmail: null,
      },
    }),
    // RGPD : purger les notes confidentielles des comptes-rendus de séance
    // (champ libre potentiellement nominatif). Le reste du compte-rendu (durée,
    // objectifs, présence signée) est conservé pour l'intégrité légale AFEST.
    prisma.compteRenduSeance.updateMany({
      where: { coachingSession: { traineeId } },
      data: { notesConfidentielles: null },
    }),
    // RGPD : révoquer les jetons d'émargement encore vivants. Un lien valide
    // survivant à l'effacement permettrait de signer au nom d'une personne
    // pourtant « supprimée ».
    prisma.emargementToken.updateMany({
      // Les DEUX contextes : `enrollmentId` est nullable, `coachingId` porte
      // l'AFEST 1-to-1 (polymorphisme D9). Ne filtrer que sur l'inscription
      // raterait silencieusement toutes les signatures de coaching le jour où
      // ce chemin existera.
      where: {
        OR: [{ enrollment: { traineeId } }, { coaching: { traineeId } }],
        revokedAt: null,
      },
      data: { revokedAt: now, revokedMotif: "Effacement RGPD" },
    }),
    // 🔴 AUCUNE écriture sur les colonnes de `emargement_signatures`, et c'est
    // un correctif, pas un oubli.
    //
    // Ce code mettait `signataireEmail`, `ipHash` et `userAgentSha256` à `null`
    // au motif qu'« aucun des trois n'est nécessaire à la preuve ». Les trois
    // sont dans le tuple haché (cf. `COLONNES_SCELLEES`). Conséquence : après
    // toute demande d'article 17, `verifierChaine` rendait `empreinte_invalide`
    // sur CHAQUE signature du stagiaire — c'est-à-dire, dans un dossier remis à
    // un contrôle, le verdict « ces feuilles ont été modifiées après coup », sur
    // des pièces parfaitement intactes. Un stagiaire de mauvaise foi n'avait
    // qu'à demander son effacement avant un contrôle pour rendre ses heures
    // injustifiables.
    //
    // Le raisonnement juste était déjà écrit ici pour `signataireNom` : l'écraser
    // invaliderait `selfHash` sur toute la chaîne. Il n'avait pas été appliqué à
    // la ligne suivante. L'article 17 §3 b — traitement nécessaire à la
    // constatation d'un droit en justice — couvre les quatre colonnes de la même
    // façon, et couvre a fortiori `ipHash` et `userAgentSha256`, qui sont déjà
    // des pseudonymes SHA-256. Effacer l'adresse électronique en conservant le
    // NOM COMPLET de la personne ne protégeait d'ailleurs personne.
    //
    // Ce qui EST effacé, parce que ce n'est pas dans le tuple : l'IMAGE du tracé
    // sur R2, avec `signatureKey`. C'est la donnée la plus sensible du lot — un
    // tracé manuscrit — et sa destruction n'ôte rien à la vérifiabilité, seul son
    // condensat `signatureSha256` étant scellé.
  ]);

  // 🔴 L'IMAGE du tracé vit sur R2, hors transaction. Sans cet appel elle
  // resterait cinq ans après un effacement RGPD — c'est l'oubli O2 du plan, et
  // `deleteFromR2` existait sans jamais être appelé.
  //
  // Fait APRÈS la transaction, jamais dedans : un appel réseau à l'intérieur la
  // tiendrait ouverte le temps de N allers-retours.
  await purgerImagesSignatures(traineeId, now);
}

/**
 * Supprime les images de signature d'un stagiaire sur R2, et trace la purge.
 *
 * Chaque image est traitée indépendamment : un échec sur l'une ne doit pas
 * empêcher les autres d'être purgées.
 *
 * `imagePurgeeAt` n'est posé que si la suppression a RÉUSSI. Le poser d'office
 * ferait croire à un effacement qui n'a pas eu lieu — pire que pas d'effacement
 * du tout, puisque plus personne n'irait vérifier. `signatureKey` est mis à
 * `null` en même temps : une clé qui ne pointe plus sur rien ferait échouer
 * toute relecture ultérieure sans expliquer pourquoi.
 */
export async function purgerImagesSignatures(traineeId: string, now: Date): Promise<void> {
  const signatures = await prisma.emargementSignature.findMany({
    where: {
      OR: [{ enrollment: { traineeId } }, { coaching: { traineeId } }],
      signatureKey: { not: null },
      imagePurgeeAt: null,
    },
    select: { id: true, signatureKey: true },
  });

  let echecs = 0;
  for (const signature of signatures) {
    if (signature.signatureKey === null) continue;
    try {
      await supprimerImageSignature(signature.signatureKey);
      await prisma.emargementSignature.update({
        where: { id: signature.id },
        data: { imagePurgeeAt: now, signatureKey: null },
      });
    } catch (err) {
      echecs += 1;
      Sentry.captureException(err, {
        tags: { action: "supprimerStagiaire:purgeImage" },
        extra: { signatureId: signature.id },
      });
    }
  }

  // 🔴 LÈVE si une seule image n'a pas pu être supprimée.
  //
  // Avaler l'échec faisait retourner `supprimerStagiaire` normalement, donc
  // passer la demande RGPD en « traitée » — et le garde qui exige le statut
  // « demandée » rendait alors tout rejeu IMPOSSIBLE. L'image restait cinq ans
  // avec `imagePurgeeAt` à null, et rien ne balaie cette colonne.
  //
  // En levant, la demande reste « demandée » et l'admin peut relancer. Les
  // images déjà purgées ne le seront pas deux fois : la requête filtre sur
  // `imagePurgeeAt: null`.
  if (echecs > 0) {
    throw new Error(
      `Effacement RGPD incomplet : ${echecs} image${echecs > 1 ? "s" : ""} de signature n'ont pas pu être supprimées. La demande reste ouverte, relancez-la.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// creerDemandeRgpd
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trace une demande RGPD (export ou suppression) en base de données.
 *
 * La demande est créée avec le statut "demandee". Le traitement effectif
 * (export ou suppression) est déclenché par l'admin via les actions T14.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerDemandeRgpd(
  traineeId: string,
  type: RgpdDemandeType,
): Promise<CreerDemandeRgpdResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerDemandeRgpd: stub DB — non disponible au build");
  }

  const demande = await prisma.rgpdDemande.create({
    data: {
      traineeId,
      type,
      statut: "demandee",
      demandeAt: new Date(),
    },
    select: { id: true, type: true, demandeAt: true },
  });

  // ── Prévenir les DEUX parties ────────────────────────────────────────────
  // 🔴 Avant le 2026-08-13, cette fonction s'arrêtait à la ligne du dessus.
  // Ni la personne ni l'équipe n'étaient prévenues : la demande pouvait dormir
  // indéfiniment alors que le délai de réponse est d'UN MOIS et court dès le
  // dépôt. Le premier signal aurait été une saisine de la CNIL.
  //
  // Meilleur effort : la demande est DÉJÀ enregistrée. Un échec de
  // notification ne doit pas la faire échouer — ce serait remplacer un défaut
  // silencieux par une perte franche.
  try {
    await notifierDemandeRgpd(traineeId, demande.id, demande.type, demande.demandeAt);
  } catch (err) {
    console.error("[rgpd-service] notification de demande impossible :", err);
  }

  return { id: demande.id, type: demande.type, demandeAt: demande.demandeAt };
}

/** Délai de réponse imposé par l'article 12.3 du RGPD. */
const DELAI_REPONSE_JOURS = 30;

/**
 * Accuse réception auprès de la personne ET alerte l'équipe.
 *
 * Séparée de `creerDemandeRgpd` pour que l'échec d'un canal n'emporte pas
 * l'autre : une alerte Telegram muette ne doit pas priver la personne de son
 * accusé, et réciproquement.
 */
async function notifierDemandeRgpd(
  traineeId: string,
  demandeId: string,
  type: RgpdDemandeType,
  demandeAt: Date,
): Promise<void> {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: { email: true, nom: true, prenom: true },
  });
  if (!trainee?.email) return;

  const echeance = new Date(demandeAt);
  echeance.setDate(echeance.getDate() + DELAI_REPONSE_JOURS);
  const fmt = (d: Date): string =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const nomComplet = `${trainee.prenom} ${trainee.nom}`.trim();

  // Accusé à la personne : c'est sa seule preuve que la demande est arrivée,
  // et il matérialise la date de départ du délai pour les deux parties.
  await enqueueEmail("rgpd-demande-recue", trainee.email, "fr", {
    type,
    reference: demandeId,
    deposeeLe: fmt(demandeAt),
  });

  // Alerte interne, en `warn` : c'est un délai légal, pas une information.
  //
  // 🔴 2026-08-20, constat `D5-5-06`. Ce payload portait `nomComplet` et
  // `trainee.email` EN CLAIR. La catégorie est routée vers **Telegram**
  // (`notifications/routing.ts`), hors UE : exercer un droit RGPD expédiait
  // l'identité du demandeur hors de l'Union **à l'occasion même de la
  // demande**. `redactName` et `redactEmail` existaient dans le dépôt et
  // n'étaient simplement pas appelés ici.
  //
  // La rédaction est faite ICI, à la source, et non dans le formateur :
  // `dispatchChannels` passe le payload BRUT à `sendSentryBreadcrumb`, hors UE
  // lui aussi. Rédiger au rendu n'aurait fermé qu'un canal sur deux.
  //
  // Rien n'est perdu côté équipe : `notify()` ne persiste rien en base, l'écran
  // `qualiopi/rgpd` lit la table `RgpdDemande` en direct, et le message porte
  // la `Référence` plus un lien console. Traiter une demande n'a jamais
  // demandé de lire un nom dans Telegram.
  await notify({
    category: "RGPD_REQUEST_SUBMITTED",
    payload: {
      demandeId,
      type,
      traineeNomMasque: redactName(nomComplet),
      traineeEmailMasque: redactEmail(trainee.email),
      echeance: fmt(echeance),
    },
  });
}
