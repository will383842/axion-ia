/**
 * Qualiopi — Service de génération des attestations (AGENT A — T9).
 *
 * genererAttestationPourEnrollment : génère (ou renvoie existante) l'attestation
 *   d'un stagiaire à partir de son taux de présence.
 *
 * Décision Will #7 :
 *   - >= seuil_presence_pct (défaut 80 %) → attestation complète
 *   - 60–79 %                             → attestation partielle
 *   - < 60 %                              → aucun document
 *
 * Idempotence : si attestationGenereeAt est déjà set et opts.force !== true,
 * retourne l'existant sans regénérer.
 *
 * Stub-aware : early-exit si DATABASE_URL contient "stub.invalid".
 *
 * Note : logQualiopiActivity dépend de next/headers (Server Action). On utilise
 * ici une écriture directe dans ActivityLog (best-effort, même pattern que
 * documents-service.ts) pour rester appelable depuis le worker cron.
 */

import React from "react";
import { estInscriptionActive } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { prisma } from "@/lib/prisma";
import {
  MESSAGE_REFUS_TAUX_NON_MESURE,
  MOTIF_PREUVES_MIN,
  messageRefusPreuvesManquantes,
} from "./refus-attestation";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { classifierPresence } from "@/server/qualiopi/presence/taux";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { makeQrToken, qrDataUrl } from "@/server/qualiopi/documents/qr";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { objectifsPedagogiquesEnTexte } from "@/server/qualiopi/formations/objectifs";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import { getFinaleResultats, evaluationSansAucuneNote } from "./evaluations-service";
import { AttestationPdf } from "@/server/qualiopi/documents/templates/attestation";
import { AttestationPartiellePdf } from "@/server/qualiopi/documents/templates/attestation-partielle";
import { envoyerAttestationDisponible } from "@/server/qualiopi/notifications/notifications-service";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AttestationResult {
  resultat: "complete" | "partielle" | "aucune";
  documentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREUVES — la pièce due au STAGIAIRE n'est plus moins gardée que celle du
//           FINANCEUR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 2026-09-05 — L'ASYMÉTRIE QUE CE BLOC FERME.
 *
 * Deux pièces attestent la même réalité, et elles n'étaient pas gardées pareil :
 *
 * | Pièce                   | Due à           | Ce qu'on exigeait avant ce jour |
 * |-------------------------|-----------------|---------------------------------|
 * | `certificat_realisation`| au FINANCEUR    | taux MESURÉ + trace vérifiable  |
 * | `attestation`           | au STAGIAIRE    | **rien**, par le bouton admin   |
 *
 * `genererCertificatRealisationAction` refuse tant que `tauxPresencePct` est
 * `null` ET tant qu'aucune `EmargementSignature` non révoquée (ou créneau
 * importé rattaché à son fichier) n'existe. `genererAttestationAction`, elle,
 * n'exigeait NI l'un NI l'autre : seul le CRON `attestations-auto` posait une
 * condition, et une seule — l'évaluation finale. Un clic suffisait donc à
 * émettre, au nom de l'organisme, une pièce qui certifie que la personne « a
 * suivi la formation et en a satisfait les exigences » sans qu'une heure ait
 * été constatée ni une compétence notée.
 *
 * C'est l'inverse de la hiérarchie attendue : l'attestation de fin de formation
 * est DUE au stagiaire par l'article L.6353-1, elle lui sert de preuve auprès
 * d'un employeur, et c'est elle qui documente l'indicateur 11. La garder moins
 * que la pièce du payeur revient à dire qu'on se protège mieux d'un contrôle
 * que d'une fausse déclaration faite à la personne formée.
 *
 * ## Pourquoi un MOTIF ÉCRIT, et pas un refus sec
 *
 * Un refus sec sur une pièce que la loi DOIT au stagiaire créerait un défaut
 * pire que celui qu'on ferme : une session dont l'émargement a été perdu, ou
 * reconstitué hors du logiciel, n'obtiendrait plus jamais son attestation, et
 * l'organisme se retrouverait en manquement pour avoir voulu bien faire.
 *
 * On copie donc le patron déjà employé ici pour les régénérations
 * (`useMotifRectification`) et pour le montant de session : la pièce sort, mais
 * seulement si un humain ÉCRIT pourquoi il atteste sans les preuves — et cette
 * phrase part au registre, où l'auditeur la lira.
 *
 * ⚠️ Le cas « émargement papier scanné » n'a PAS besoin de ce motif : la
 * méthode `papier_scanne` écrit bien une `EmargementSignature`
 * (`EmargementMethode`, schema.prisma). La garde ne le voit pas passer.
 */
export interface PreuvesAttestation {
  /**
   * Le taux de présence a-t-il été CALCULÉ ? (`tauxPresencePct !== null`)
   *
   * ⚠️ Séparé des trois compteurs ci-dessous, et ce n'est pas cosmétique : ce
   * fait-ci ne passe PAS par la soupape. On peut assumer par écrit l'absence
   * d'une trace ou d'une évaluation ; on ne peut pas attester une assiduité
   * dont on n'a aucune mesure — il n'y aurait rien à attester, et la pièce
   * serait fausse.
   *
   * Il ne figure donc pas dans `preuvesManquantesAttestation`, qui ne liste que
   * les manques RATTRAPABLES par un motif. Le taux, lui, lève
   * `AttestationTauxNonMesureError`.
   */
  readonly tauxPresenceMesure: boolean;
  /** Signatures d'émargement encore au registre (révoquées exclues). */
  readonly signaturesNonRevoquees: number;
  /** Créneaux issus d'un import de plateforme, rattachés à leur fichier archivé. */
  readonly creneauxImportes: number;
  /** Évaluations de type `finale` rattachées à l'inscription. */
  readonly evaluationsFinales: number;
}

/**
 * Les preuves qui MANQUENT et qu'un MOTIF ÉCRIT peut couvrir — vide si
 * l'attestation peut sortir sans rien assumer.
 *
 * 🔴 2026-09-05, second passage — LE TAUX N'EST PAS ICI, ET C'EST LE POINT.
 *
 * Il y figurait au premier jet, et la soupape le couvrait comme les deux autres.
 * Le témoin `taux INCONNU : la soupape ne doit PAS geler la ligne` a montré ce
 * que ça produisait vraiment : la soupape passait, le claim était posé, puis
 * `?? 0` transformait l'inconnu en présence de 0 %, `classifierPresence` rendait
 * « aucune », et la branche « aucune » écrivait `attestationGenereeAt` en sortant
 * SANS PIÈCE. Message observé : `promise resolved "{ resultat: 'aucune',
 * documentId: null }"`. La ligne était gelée pour toujours — le cron filtre sur
 * `attestationGenereeAt: null`. La soupape fabriquait, dans son cas principal,
 * exactement le gel qu'elle devait éviter.
 *
 * La racine n'est pas la soupape, c'est la RÈGLE : on peut assumer par écrit
 * l'absence d'une TRACE ou d'une ÉVALUATION — il reste alors quelque chose à
 * attester, et la pièce est due au stagiaire. On ne peut pas assumer l'absence
 * de toute MESURE d'assiduité : il n'y a alors rien à attester, et la pièce
 * serait fausse. Le taux est donc sorti d'ici et traité en refus DUR, avant le
 * claim, avec un message qui dit quoi faire.
 */
export function preuvesManquantesAttestation(p: PreuvesAttestation): string[] {
  const manquantes: string[] = [];
  if (p.signaturesNonRevoquees === 0 && p.creneauxImportes === 0) {
    manquantes.push(
      "aucune trace d'assiduité vérifiable : ni signature d'émargement au registre, " +
        "ni créneau issu d'un relevé de connexion importé",
    );
  }
  if (p.evaluationsFinales === 0) {
    manquantes.push(
      "aucune évaluation finale des acquis (la pièce certifierait « en a satisfait " +
        "les exigences » en affichant « évaluation non réalisée »)",
    );
  }
  return manquantes;
}

/** Longueur minimale du motif — alignée sur `MOTIF_RECTIFICATION_MIN` de la console. */
// `MOTIF_PREUVES_MIN` vit desormais dans `refus-attestation.ts`, avec les deux
// messages de refus : le service et la CONSOLE doivent s'accorder dessus, et
// la console ne peut pas importer ce fichier-ci (il ouvre la base).
export { MOTIF_PREUVES_MIN } from "./refus-attestation";

/**
 * Refus d'émettre faute de preuves, et faute de motif écrit pour s'en passer.
 *
 * Classe dédiée (et non `Error` nu) pour que l'appelant puisse distinguer ce
 * refus MÉTIER d'une panne — le message, lui, est écrit pour être lu tel quel
 * par l'admin dans la console : il nomme ce qui manque ET la sortie.
 */
export class AttestationPreuvesManquantesError extends Error {
  readonly manquantes: ReadonlyArray<string>;

  constructor(manquantes: ReadonlyArray<string>) {
    super(messageRefusPreuvesManquantes(manquantes));
    this.name = "AttestationPreuvesManquantesError";
    this.manquantes = manquantes;
  }
}

/**
 * Refus DUR : aucune mesure d'assiduité, donc rien à attester.
 *
 * Classe distincte de la précédente, et c'est délibéré — les deux refus n'ont
 * pas la même issue. L'un se lève avec un motif écrit ; celui-ci ne se lève
 * qu'en RENSEIGNANT la présence. Une seule classe pour les deux aurait poussé la
 * console à proposer un champ de motif là où il ne servirait à rien, et un motif
 * qu'on saisit sans effet est pire qu'un refus : il fait croire qu'on a agi.
 *
 * ⚠️ Le message dit quoi faire. Un refus qui ne dit pas comment continuer est un
 * cul-de-sac, et l'admin finit par chercher un contournement.
 */
export class AttestationTauxNonMesureError extends Error {
  constructor() {
    super(MESSAGE_REFUS_TAUX_NON_MESURE);
    this.name = "AttestationTauxNonMesureError";
  }
}

/**
 * Lit les preuves en base. Mêmes requêtes que la garde du certificat de
 * réalisation (`actions/qualiopi/documents.ts`) — délibérément, pour que les
 * deux pièces se refusent sur les mêmes faits.
 */
async function lirePreuvesAttestation(
  enrollmentId: string,
  tauxPresencePct: number | null,
): Promise<PreuvesAttestation> {
  const signaturesNonRevoquees = await prisma.emargementSignature.count({
    where: { enrollmentId, revokedAt: null },
  });
  // Comme pour le certificat : le relevé de connexion importé vaut trace, à la
  // condition d'être rattaché au fichier archivé (`importId`). `source: manuel`
  // reste exclu — une présence tapée à la main est une déclaration, pas une
  // preuve. Non interrogé si une signature suffit déjà.
  const creneauxImportes =
    signaturesNonRevoquees > 0
      ? 0
      : await prisma.presenceCreneau.count({
          where: {
            enrollmentId,
            source: { in: ["import_zoom", "import_teams", "import_meet"] },
            importId: { not: null },
          },
        });
  const evaluationsFinales = await prisma.evaluationAcquis.count({
    where: { enrollmentId, type: "finale" },
  });
  return {
    tauxPresenceMesure: tauxPresencePct !== null,
    signaturesNonRevoquees,
    creneauxImportes,
    evaluationsFinales,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// genererAttestationPourEnrollment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'attestation de réalisation pour un stagiaire.
 *
 * Étapes :
 * 1. Lit enrollment + session + formation + trainee.
 * 2. Idempotence : si attestationGenereeAt set et pas force → retourne existant.
 * 3. Classifie la présence via classifierPresence (taux.ts).
 * 4. Si "aucune" → update Enrollment, log, retourne null.
 * 5. Construit AttestationData / AttestationPartielleData.
 * 6. generateDocument → DocumentGenere.
 * 7. update Enrollment (attestationResultat, documentId, genereeAt).
 * 8. log activity.
 */
export async function genererAttestationPourEnrollment(
  enrollmentId: string,
  opts?: {
    force?: boolean;
    /**
     * Motif de la rectification, SAISI par l'humain qui régénère.
     *
     * 🔴 Sans lui, la pièce déclarait rectifier la précédente avec une phrase
     * générique — « après mise à jour de l'évaluation des acquis » — même quand
     * la vraie raison était tout autre. Un motif que le logiciel invente n'est
     * pas un motif : l'auditeur lit ce texte au registre, et il doit dire ce qui
     * s'est réellement passé. Absent → repli sur la formule d'origine.
     */
    rectificationMotif?: string;
    /**
     * Motif ÉCRIT d'émettre l'attestation alors que les preuves manquent.
     *
     * 🔴 C'est la soupape de la garde ci-dessus, et la seule. Sans lui, une
     * inscription sans taux mesuré, sans émargement ou sans évaluation finale
     * fait lever `AttestationPreuvesManquantesError`. Avec lui, la pièce sort et
     * la phrase part au registre : l'auditeur voit ce que l'organisme a assumé,
     * et pourquoi.
     *
     * ⚠️ Le cron ne le passe JAMAIS — il pré-filtre sur les mêmes preuves. Un
     * motif écrit est un acte humain ; un motif que le logiciel se donnerait à
     * lui-même ne serait qu'un contournement avec un nom rassurant.
     */
    motifPreuvesManquantes?: string;
  },
): Promise<AttestationResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { resultat: "aucune", documentId: null };
  }

  // 1. Lecture enrollment + relations
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      statut: true,
      tauxPresencePct: true,
      attestationResultat: true,
      attestationDocumentId: true,
      attestationGenereeAt: true,
      trainee: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          entreprise: true,
          fonction: true,
        },
      },
      session: {
        select: {
          id: true,
          // Intitulé de l'ACTION (personnalisable) et durée RÉELLE : mêmes sources
          // que le certificat de réalisation et la convention, pour que toutes les
          // pièces d'un même dossier annoncent la même formation et la même durée
          // (constats #3 et #9 de l'audit Qualiopi — divergence = refus au contrôle).
          titreSession: true,
          dureeReelleHeures: true,
          dateDebut: true,
          dateFin: true,
          modalite: true,
          coFormateurs: true,
          formateurPrincipalId: true,
          // Snapshot légal (WS5) prioritaire ; formation LIVE = repli legacy.
          formationSnapshot: true,
          formation: {
            select: {
              titre: true,
              objectifsPedagogiques: true,
              dureeHeures: true,
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    throw new Error(`Enrollment introuvable : ${enrollmentId}`);
  }

  // 2. Idempotence
  if (enrollment.attestationGenereeAt && !opts?.force) {
    return {
      resultat: (enrollment.attestationResultat ?? "aucune") as "complete" | "partielle" | "aucune",
      documentId: enrollment.attestationDocumentId ?? null,
    };
  }

  // 2b. Invariant métier S2 : un stagiaire exclu ou en abandon ne peut pas
  //     recevoir d'attestation, même via l'action manuelle admin.
  //     (Le cron filtre déjà ces statuts, mais l'action manuelle ne le faisait pas.)
  if (!estInscriptionActive(enrollment.statut)) {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: "qualiopi.attestation.refusee_statut",
          targetType: "Enrollment",
          targetId: enrollmentId,
          changes: { statut: enrollment.statut } as never,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch {
      // best-effort
    }
    return { resultat: "aucune", documentId: null };
  }

  // 2b-bis. 🔴 PREUVES — voir le bloc `PreuvesAttestation` en tête de fichier.
  //
  // Placée AVANT le claim de 2c, et ce n'est pas un détail : le claim écrit
  // `attestationGenereeAt`, et seul `genererOuLiberer` (6bis) sait le relâcher.
  // Un refus levé après le claim marquerait donc l'inscription « attestée » sans
  // pièce, et le cron — qui filtre sur `attestationGenereeAt: null` — ne la
  // reprendrait plus jamais. Refuser AVANT ne laisse aucune trace à nettoyer.
  //
  // Elle vaut aussi pour `force` : régénérer une attestation dont l'émargement a
  // été révoqué entre-temps, ce n'est pas la rectifier, c'est la répéter à faux.
  // Une révocation se solde par une annulation au registre, pas par un nouveau
  // tirage.
  const preuves = await lirePreuvesAttestation(enrollmentId, enrollment.tauxPresencePct);

  // 🔴 Le TAUX d'abord, et par un refus DUR que la soupape ne lève pas.
  //
  // Sans lui, la soupape était inerte dans son cas principal — et pire, elle
  // fabriquait le gel qu'elle devait éviter : on passait la garde, on posait le
  // claim, puis `tauxPresencePct ?? 0` classait à « aucune », l'inscription
  // sortait sans pièce avec `attestationGenereeAt` posé, et le cron — qui filtre
  // sur `null` — ne la reprenait plus jamais. Un taux INCONNU n'est pas un taux
  // de 0 %, et c'est exactement le défaut de fond que cette garde ferme.
  //
  // Placé AVANT le bloc suivant : rien ne sert de demander un motif pour des
  // manques rattrapables si la mesure elle-même est absente.
  if (!preuves.tauxPresenceMesure) {
    throw new AttestationTauxNonMesureError();
  }

  const manquantes = preuvesManquantesAttestation(preuves);
  if (manquantes.length > 0) {
    const motif = opts?.motifPreuvesManquantes?.trim() ?? "";
    if (motif.length < MOTIF_PREUVES_MIN) {
      throw new AttestationPreuvesManquantesError(manquantes);
    }
    // La sortie est ouverte, mais elle est ÉCRITE. Best-effort comme les autres
    // journalisations de ce service (pas de `next/headers` : appelable du worker).
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: "qualiopi.attestation.preuves_manquantes_assumees",
          targetType: "Enrollment",
          targetId: enrollmentId,
          changes: { manquantes, motif, preuves } as never,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch {
      // best-effort
    }
  }

  // 2c. 🔴 CLAIM ATOMIQUE — la vraie garde d'unicité.
  //
  // La vérification du 2. est une LECTURE, faite sur un instantané pris en tête
  // de fonction. Entre elle et l'écriture de `attestationGenereeAt` (étape 7),
  // le service lit la configuration, résout l'identité de l'organisme, calcule
  // un QR code et REND UN PDF : plusieurs centaines de millisecondes, plusieurs
  // allers-retours. Deux exécutions concurrentes — le cron de 09:00 et un clic
  // « Générer » — lisent donc toutes deux `null` et produisent chacune une
  // attestation, avec deux numéros `AXI-ATT` et deux `qrToken` publiquement
  // vérifiables. `attestationDocumentId` ne pointe que vers la dernière :
  // l'autre reste orpheline ET authentifiée.
  //
  // `updateMany` conditionné sur `attestationGenereeAt: null` fait de la garde
  // une opération ATOMIQUE de la base : le perdant voit `count === 0` et sort.
  // C'est exactement le patron déjà écrit pour les notifications internes
  // (`notifications-service.ts`, claim de `notifiedAt` AVANT l'enqueue), y
  // compris sa contrepartie indispensable : LIBÉRER le verrou si la suite
  // échoue (cf. étape 6bis) — sans quoi un échec de rendu marquerait
  // l'inscription « attestée » pour toujours, et le cron ne la reprendrait
  // jamais (il filtre sur `attestationGenereeAt: null`).
  //
  // ⚠️ Non appliqué quand `force` : régénérer est un acte délibéré, motivé, et
  // la pièce précédente est alors rectifiée explicitement.
  if (!opts?.force) {
    const claim = await prisma.enrollment.updateMany({
      where: { id: enrollmentId, attestationGenereeAt: null },
      data: { attestationGenereeAt: new Date() },
    });
    if (claim.count === 0) {
      // Perdu la course : on relit l'état RÉEL plutôt que de rendre
      // l'instantané périmé du début de fonction.
      const deja = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: { attestationResultat: true, attestationDocumentId: true },
      });
      return {
        resultat: (deja?.attestationResultat ?? "aucune") as "complete" | "partielle" | "aucune",
        documentId: deja?.attestationDocumentId ?? null,
      };
    }
  }

  // 3. Classifie la présence
  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct");
  const tauxPct = enrollment.tauxPresencePct ?? 0;
  const resultat = classifierPresence(tauxPct, seuilPresencePct);

  // 4. Si aucune → pas de doc
  if (resultat === "aucune") {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        attestationResultat: "aucune",
        attestationGenereeAt: new Date(),
      },
    });

    // Log activité best-effort (direct Prisma — pas de next/headers ici)
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: null,
          action: "qualiopi.attestation.aucune",
          targetType: "Enrollment",
          targetId: enrollmentId,
          changes: { resultat: "aucune", tauxPct } as never,
          ipAddress: null,
          userAgent: null,
        },
      });
    } catch {
      // best-effort
    }

    return { resultat: "aucune", documentId: null };
  }

  // 5. Construction du PDF — données formation depuis le snapshot légal (WS5),
  //    repli sur la lecture LIVE pour les sessions antérieures à WS5.
  const session = enrollment.session;
  const formation = readFormationForDocs(session.formationSnapshot, session.formation);
  const trainee = enrollment.trainee;

  const identite = await getOrganismeIdentite();
  const token = makeQrToken();
  const verifyUrl = `${identite.site}/fr/verifier-attestation/${token}`;
  const qrUrl = await qrDataUrl(verifyUrl);

  // #3 — base = durée RÉELLE de la session si déclarée (comme le certificat de
  // réalisation), sinon durée catalogue. Sans ça, une session animée 16 h au lieu
  // des 14 h prévues sortait une attestation à « 14 h » et un certificat à « 16 h »
  // pour le même stagiaire — divergence rejetée par un contrôle OPCO/France Travail.
  const dureeHeures = session.dureeReelleHeures ?? formation.dureeHeures ?? 0;
  const heuresSuivies = Math.round((tauxPct * dureeHeures) / 100);

  // Formateur principal : FK formateurPrincipalId prioritaire (fiable), repli sur
  // le Json coFormateurs (legacy), puis raison sociale. Corrige le nom du
  // formateur sur l'attestation (auparavant toujours la raison sociale car
  // coFormateurs est vide en pratique — jamais écrit par l'app).
  let formateurNom = identite.raisonSociale;
  const principalTrainerId = resolvePrincipalTrainerId({
    formateurPrincipalId: session.formateurPrincipalId,
    coFormateurs: session.coFormateurs,
  });
  if (principalTrainerId) {
    try {
      const trainer = await prisma.trainer.findUnique({
        where: { id: principalTrainerId },
        select: { nom: true, prenom: true },
      });
      if (trainer) {
        formateurNom = `${trainer.prenom} ${trainer.nom}`.trim();
      }
    } catch {
      // fallback identité raisonSociale
    }
  } else {
    // Repli legacy : nom inline éventuellement présent dans coFormateurs[0].
    const arr = Array.isArray(session.coFormateurs) ? session.coFormateurs : [];
    const premier = arr[0] as { nom?: string; prenom?: string } | undefined;
    if (premier?.nom) {
      formateurNom = [premier.prenom, premier.nom].filter(Boolean).join(" ");
    }
  }

  // Objectifs pédagogiques → string lisible.
  //
  // 🔴 Parcours à blanc 2026-07-27. Le `(raw as string[]).join(", ")` était un
  // cast de confiance : le catalogue écrit `{ id, verbe, description }`, donc
  // l'attestation remise au stagiaire imprimait « Objectifs : [object Object],
  // [object Object], … ». Constaté sur une attestation réellement générée en
  // production. Le repli `String(raw ?? "")` avait le même défaut.
  const objectifsStr = objectifsPedagogiquesEnTexte(formation.objectifsPedagogiques);

  // Évaluation finale (null si pas d'évaluation)
  //
  // 🔴 Audit certification 2026-07-26 (F21) — on lit désormais le DÉTAIL, pas
  // seulement le verdict. `objectifsStr` (la liste complète du catalogue) était
  // imprimée sous « Compétences acquises » sans que rien ne consulte
  // l'évaluation : l'attestation affirmait l'acquisition de tous les objectifs,
  // y compris ceux notés « non acquis ». L6353-1 exige les résultats de
  // l'évaluation ; le document restituait le programme.
  const resultatsFinale = await getFinaleResultats(enrollmentId);
  // 🔴 Vérification E2E 2026-07-26. Une évaluation existante mais dont AUCUNE
  // compétence n'est notée doit être traitée comme « non réalisée », pas comme
  // un échec : `scorePct = 0` et `reussite = false` y sont des artefacts de
  // saisie vide, pas un résultat. Sans ce test, l'attestation portait
  // « Non validée — score 0 % » — le faux échec que F22 ferme au niveau du
  // calcul, réintroduit au niveau du document.
  const sansAucuneNote = resultatsFinale !== null && evaluationSansAucuneNote(resultatsFinale);
  const evaluationObtenue =
    resultatsFinale === null || sansAucuneNote
      ? undefined
      : `${resultatsFinale.reussite ? "Réussite" : "Non validée"} — score ${resultatsFinale.scorePct} %`;

  // Ce qui s'imprime sous « Compétences acquises ».
  //
  // Trois cas, et aucun ne consiste à recopier le programme :
  //   - évaluation faite  → uniquement les objectifs réellement notés « acquis » ;
  //   - aucun acquis      → le dire, plutôt que de laisser une ligne vide qui se
  //                         lirait comme une omission de mise en page ;
  //   - pas d'évaluation  → l'annoncer explicitement. Une attestation muette sur
  //                         ce point serait interprétée comme une acquisition.
  const competencesAcquisesStr =
    resultatsFinale === null || sansAucuneNote
      ? "Évaluation des acquis non réalisée"
      : resultatsFinale.acquis.length > 0
        ? resultatsFinale.acquis.join(", ")
        : "Aucun objectif évalué comme acquis";

  // Les réserves, quand il y en a. Absentes du PDF si tout est acquis : une
  // rubrique « Non acquis : — » attire l'œil sur un vide sans rien signifier.
  const partiels = resultatsFinale?.partiels ?? [];
  const nonAcquis = resultatsFinale?.nonAcquis ?? [];
  // Une compétence attendue et non notée n'est ni acquise ni échouée : elle est
  // manquante. La taire ferait passer un oubli de saisie pour un échec (cf. F22).
  const nonEvalues = resultatsFinale?.nonEvalues ?? [];
  const competencesReserves = [
    partiels.length > 0 ? `Partiellement acquis : ${partiels.join(", ")}` : null,
    nonAcquis.length > 0 ? `Non acquis : ${nonAcquis.join(", ")}` : null,
    nonEvalues.length > 0 ? `Non évalués : ${nonEvalues.join(", ")}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join(" · ");

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const beneficiaire = {
    nom: trainee.nom,
    prenom: trainee.prenom,
    ...(trainee.entreprise !== null ? { entreprise: trainee.entreprise } : {}),
    ...(trainee.fonction !== null ? { fonction: trainee.fonction } : {}),
  };

  const formationData = {
    // #9 — intitulé de la SESSION (personnalisable), comme convention/convocation/
    // émargement/certificat. `titreSession` vaut par défaut `formation.titre`.
    intitule: session.titreSession ?? formation.titre ?? "",
    objectifs: objectifsStr,
    dureeHeures,
    dateDebut: session.dateDebut ? formatDate(new Date(session.dateDebut)) : "",
    dateFin: session.dateFin ? formatDate(new Date(session.dateFin)) : "",
    modalite: session.modalite,
    formateur: formateurNom,
  };

  const dateEmission = formatDate(new Date());

  // 6. Génère le document (numérotation + R2 + DB).
  //    buildElement reçoit le numéro alloué → l'en-tête PDF affiche le vrai N°.
  const docType = resultat === "complete" ? "attestation" : "attestation_partielle";
  // 🔴 Une régénération FORCÉE n'est pas un duplicata, c'est une rectification.
  //
  // Constaté sur le premier dossier réel : `AXI-ATT-2026-003` portait
  // « Évaluation des acquis non réalisée » ; l'évaluation a été enregistrée
  // ensuite, l'attestation régénérée — et la version JUSTE est sortie filigranée
  // « COPIE ». L'organisme devait alors choisir entre présenter un original faux
  // ou une copie exacte.
  //
  // On dit ce qu'on fait : la nouvelle pièce déclare rectifier la précédente, et
  // sort sans filigrane. La traçabilité vit au registre, où l'auditeur recoupe.
  // Test de VÉRACITÉ, pas d'égalité stricte à `null` : la pièce précédente peut
  // avoir été purgée, et une lecture qui ne trouve rien ne doit pas faire échouer
  // la régénération — on émet alors sans mention de rectification.
  const numeroPrecedent =
    opts?.force === true && enrollment.attestationDocumentId !== null
      ? (
          await prisma.documentGenere.findUnique({
            where: { id: enrollment.attestationDocumentId },
            select: { numero: true },
          })
        )?.numero
      : undefined;

  // 6bis. 🔴 CONTREPARTIE DU CLAIM — libérer si le rendu échoue.
  //
  // Le claim de l'étape 2c a posé `attestationGenereeAt` AVANT de produire quoi
  // que ce soit. Si la génération échoue ici (R2 indisponible, police absente,
  // identité incomplète), l'inscription resterait marquée « attestée » sans
  // aucune pièce — et le cron, qui filtre sur `attestationGenereeAt: null`, ne
  // la reprendrait JAMAIS. Un verrou qu'on ne relâche pas ne protège plus, il
  // condamne.
  //
  // Même geste que `notifierAlerteInterne` : on rend la colonne à `null`, puis
  // on propage l'erreur (l'appelant — cron ou action — la journalise déjà).
  const genererOuLiberer = async <T>(op: () => Promise<T>): Promise<T> => {
    try {
      return await op();
    } catch (err) {
      if (!opts?.force) {
        await prisma.enrollment
          .updateMany({
            where: { id: enrollmentId },
            data: { attestationGenereeAt: null, attestationResultat: null },
          })
          .catch(() => {
            // Best-effort : si même la libération échoue, on ne masque pas
            // l'erreur d'origine, qui est la vraie information.
          });
      }
      throw err;
    }
  };

  const generated = await genererOuLiberer(() =>
    generateDocument({
      type: docType,
      buildElement: (numero) => {
        if (resultat === "complete") {
          return React.createElement(AttestationPdf, {
            data: {
              numero,
              dateEmission,
              identite,
              beneficiaire,
              formation: formationData,
              resultats: {
                heuresSuivies,
                heuresTotales: dureeHeures,
                ...(evaluationObtenue !== undefined ? { evaluationObtenue } : {}),
                competencesAcquises: competencesAcquisesStr,
                ...(competencesReserves !== "" ? { competencesReserves } : {}),
              },
              qrToken: token,
              qrDataUrl: qrUrl,
            },
          });
        } else {
          return React.createElement(AttestationPartiellePdf, {
            data: {
              numero,
              dateEmission,
              identite,
              beneficiaire,
              formation: formationData,
              resultats: {
                heuresSuivies,
                heuresTotales: dureeHeures,
                ...(evaluationObtenue !== undefined ? { evaluationObtenue } : {}),
                competencesPartiellesValidees: competencesAcquisesStr,
                ...(competencesReserves !== "" ? { competencesReserves } : {}),
              },
              qrToken: token,
              qrDataUrl: qrUrl,
            },
          });
        }
      },
      refs: { sessionId: session.id, traineeId: trainee.id },
      qrToken: token,
      ...(numeroPrecedent !== undefined && numeroPrecedent !== null
        ? {
            rectifie: {
              numero: numeroPrecedent,
              motif:
                opts?.rectificationMotif !== undefined && opts.rectificationMotif.trim() !== ""
                  ? opts.rectificationMotif.trim()
                  : "Attestation régénérée après mise à jour de l'évaluation des acquis : cette version remplace la précédente.",
            },
          }
        : {}),
    }),
  );

  // 7. Update Enrollment
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      attestationResultat: resultat,
      attestationDocumentId: generated.id,
      attestationGenereeAt: new Date(),
    },
  });

  // 7b. Notification stagiaire — fail-soft (ne bloque pas la génération)
  //
  // 🔴 2026-08-24 — LE HUITIÈME APPELANT DE LA FAMILLE, ET LE DERNIER.
  //
  // `envoyerAttestationDisponible` rend `Promise<boolean>` : `false` = rien n'est
  // parti. Elle ne lève PAS dans ce cas — le `catch` ci-dessous ne voyait donc
  // aucun de ses cinq chemins d'échec (stub, stagiaire sans adresse, file
  // indisponible, e-mail garé en corbeille de validation).
  //
  // Conséquence : l'attestation était générée et enregistrée, le stagiaire
  // n'était JAMAIS prévenu qu'elle existait, et rien ne le rattrapait. Le
  // fail-soft est bon — la génération ne doit pas dépendre d'un e-mail — mais
  // avaler l'information est autre chose : personne ne pouvait savoir combien de
  // stagiaires attendaient une attestation dont ils ignoraient l'existence.
  //
  // 🔑 CE DÉFAUT A ÉCHAPPÉ À DEUX GARDES. `aucun-envoi-ignore.spec.ts` ne lit
  // qu'un seul fichier, le worker des crons. Et le cliquet que j'ai écrit ce
  // matin reposait sur une LISTE DE SEPT NOMS écrite à la main, dont
  // `envoyerAttestationDisponible` ne faisait pas partie. Une liste à maintenir
  // vieillit toujours mal : le cliquet découvre désormais les fonctions à
  // contrat tout seul, en lisant leur signature.
  //
  // Fail-soft, donc : on ne bloque pas. Mais on le DIT, et le message nomme la
  // conséquence pour que la ligne de journal soit actionnable.
  try {
    if (!(await envoyerAttestationDisponible(enrollmentId))) {
      console.error(
        `[attestation-service] NON ENVOYÉ — l'attestation de l'inscription ` +
          `${enrollmentId} est générée et enregistrée, mais le stagiaire n'a PAS ` +
          "été prévenu qu'elle est disponible (message garé en corbeille de " +
          "validation, ou file de messages indisponible). Aucun rattrapage " +
          "automatique n'existe pour cette notification : le prévenir demande un " +
          "geste manuel.",
      );
    }
  } catch (err) {
    console.error(
      `[attestation-service] envoyerAttestationDisponible: erreur enrollment ${enrollmentId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // 8. Log activité best-effort (direct Prisma — pas de next/headers ici)
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: `qualiopi.attestation.${resultat}`,
        targetType: "Enrollment",
        targetId: enrollmentId,
        changes: { resultat, documentId: generated.id, tauxPct } as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch {
    // best-effort
  }

  return { resultat, documentId: generated.id };
}
