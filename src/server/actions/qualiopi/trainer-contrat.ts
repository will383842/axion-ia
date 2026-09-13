/**
 * Qualiopi — Contrat de travail d'un formateur SALARIÉ : saisie et émission.
 *
 * Deux actions, et la séparation est volontaire :
 *
 *   · `updateTrainerContratAction` enregistre les mentions sur la fiche. Elle ne
 *     produit RIEN — on peut la rappeler dix fois, corriger, revenir ;
 *   · `genererContratTravailAction` produit la pièce, numérotée et hashée. Elle
 *     refuse tant qu'une mention obligatoire manque, et rend TOUS les manques.
 *
 * 🔑 POURQUOI DEUX ACTIONS, ET PAS UN BOUTON QUI FAIT LES DEUX. Will a demandé
 * la RELECTURE avant l'envoi. Une action unique « enregistrer et émettre »
 * n'aurait laissé aucun moment pour relire : la pièce serait partie au circuit
 * de signature dans le même geste que la saisie. Ici la pièce est produite,
 * consultable en PDF, et c'est un TROISIÈME geste — l'envoi du lien de
 * signature, qui existe déjà pour toutes les pièces signables — qui l'expédie.
 *
 * ⚠️ Ces actions touchent une RÉMUNÉRATION et un engagement d'employeur. Elles
 * exigent `remunerer_formateur`, pas `requireAdminWrite` : un compte éditorial
 * ne doit pas pouvoir embaucher.
 */

"use server";

import React from "react";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logQualiopiActivity, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { ContratTravailPdf } from "@/server/qualiopi/documents/templates/contrat-travail";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { enqueueEmail } from "@/server/queue/queues";
import { publicUrl } from "@/lib/public-url";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import {
  LIBELLE_REFUS_CONTRAT,
  motifSpecimenContrat,
  verifierEligibiliteContrat,
  type SalarieContrat,
} from "@/server/qualiopi/trainers/contrat-travail";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Build GH Actions : `DATABASE_URL` pointe sur `stub.invalid` et le client
 * Prisma court-circuite toute lecture (cf. AGENTS.md). Produire un PDF dans ces
 * conditions donnerait une pièce vide, numérotée pour de bon.
 */
const STUB = "stub.invalid";
function isStub(): boolean {
  return process.env.DATABASE_URL?.includes(STUB) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Saisie des mentions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 `null` EFFACE, `undefined` laisse intact — même convention que le fixe
 * récupérable. Sans elle, on ne pourrait pas retirer le terme d'un CDD qu'on
 * transforme en CDI autrement qu'en base.
 *
 * ⚠️ Les dates arrivent en `YYYY-MM-DD` (input natif) et sont interprétées en
 * UTC. Une date de naissance ou d'embauche n'a pas d'heure : la traiter en heure
 * locale la décalerait d'un jour pour la moitié de l'année.
 */
const dateJour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format JJ/MM/AAAA")
  .nullable()
  .optional()
  .transform((v) => (v === null || v === undefined ? v : new Date(`${v}T00:00:00.000Z`)));

const texteOptionnel = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() === "" ? null : v));

const contratSchema = z.object({
  id: z.string().uuid(),
  contratType: z.enum(["cdi", "cdd"]).nullable().optional(),
  dateNaissance: dateJour,
  lieuNaissance: texteOptionnel(120),
  adressePersonnelle: texteOptionnel(500),
  dateEmbauche: dateJour,
  contratPoste: texteOptionnel(160),
  contratClassification: texteOptionnel(120),
  // Décimal en base (35, 24,5) : on accepte le point comme la virgule.
  contratDureeHebdoHeures: z.coerce.number().positive().max(48).nullable().optional(),
  contratPeriodeEssaiMois: z.coerce.number().int().min(0).max(8).nullable().optional(),
  contratLieuTravail: texteOptionnel(500),
  contratDateFin: dateJour,
  contratMotifCdd: texteOptionnel(1000),
});

export async function updateTrainerContratAction(
  input: z.input<typeof contratSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = contratSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides (dates, durée ou période d'essai)." };
  const { id, ...v } = parsed.data;

  try {
    await prisma.trainer.update({
      where: { id },
      data: {
        ...(v.contratType !== undefined ? { contratType: v.contratType } : {}),
        ...(v.dateNaissance !== undefined ? { dateNaissance: v.dateNaissance } : {}),
        ...(v.lieuNaissance !== undefined ? { lieuNaissance: v.lieuNaissance } : {}),
        ...(v.adressePersonnelle !== undefined ? { adressePersonnelle: v.adressePersonnelle } : {}),
        ...(v.dateEmbauche !== undefined ? { dateEmbauche: v.dateEmbauche } : {}),
        ...(v.contratPoste !== undefined ? { contratPoste: v.contratPoste } : {}),
        ...(v.contratClassification !== undefined
          ? { contratClassification: v.contratClassification }
          : {}),
        ...(v.contratDureeHebdoHeures !== undefined
          ? { contratDureeHebdoHeures: v.contratDureeHebdoHeures }
          : {}),
        ...(v.contratPeriodeEssaiMois !== undefined
          ? { contratPeriodeEssaiMois: v.contratPeriodeEssaiMois }
          : {}),
        ...(v.contratLieuTravail !== undefined ? { contratLieuTravail: v.contratLieuTravail } : {}),
        ...(v.contratDateFin !== undefined ? { contratDateFin: v.contratDateFin } : {}),
        ...(v.contratMotifCdd !== undefined ? { contratMotifCdd: v.contratMotifCdd } : {}),
      },
    });
  } catch {
    return { error: "Formateur introuvable ou enregistrement impossible." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.contrat_travail.saisie",
    targetType: "Trainer",
    targetId: id,
    // Le JOURNAL ne porte pas l'adresse personnelle ni la date de naissance : ce
    // sont des données de la vie privée du salarié, et un journal d'activité est
    // lu par tout compte habilité à la console. On trace le GESTE, pas la fiche.
    changes: {
      contratType: v.contratType ?? null,
      poste: v.contratPoste ?? null,
      classification: v.contratClassification ?? null,
      dureeHebdo: v.contratDureeHebdoHeures ?? null,
    },
    session,
  });

  return { data: { id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Émission de la pièce
// ─────────────────────────────────────────────────────────────────────────────

/** Formate une date pour le corps du contrat. `""` quand elle manque. */
function dateFr(d: Date | null): string {
  return d === null ? "" : d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/**
 * Produit le contrat de travail d'un formateur salarié.
 *
 * ⛔ REFUSE plutôt que de produire une pièce incomplète, et rend TOUS les motifs
 * d'un coup. Un opérateur qui corrige une mention, réessaie, en découvre une
 * deuxième, corrige, réessaie… n'apprend jamais combien il en reste — et sur un
 * contrat de travail chaque mention manquante a sa propre conséquence.
 *
 * ⚠️ La convention collective, elle, ne REFUSE pas : elle DÉCLASSE en spécimen.
 * L'écart est délibéré. Les mentions ci-dessus dépendent du salarié et se
 * saisissent en trente secondes ; la convention dépend de l'organisme et
 * demande une vérification que Will seul peut faire. Bloquer toute embauche sur
 * une question de configuration serait disproportionné — produire une pièce
 * qu'on pourrait croire opposable le serait davantage.
 */
export async function genererContratTravailAction(input: {
  trainerId: string;
}): Promise<ActionResult<{ documentId: string; numero: string; specimen: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  if (isStub()) return { error: "Génération désactivée en mode build (stub)" };

  const parsed = z.object({ trainerId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { trainerId } = parsed.data;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      statut: true,
      dateNaissance: true,
      lieuNaissance: true,
      adressePersonnelle: true,
      dateEmbauche: true,
      contratType: true,
      contratPoste: true,
      contratClassification: true,
      contratDureeHebdoHeures: true,
      contratPeriodeEssaiMois: true,
      contratLieuTravail: true,
      contratDateFin: true,
      contratMotifCdd: true,
      fixeMensuelBrutCents: true,
      avanceRepriseCents: true,
    },
  });
  if (trainer === null) return { error: "Formateur introuvable" };

  // `Decimal` Prisma → nombre. `toNumber()` est sûr ici : la colonne est en
  // Decimal(5,2), très loin des bornes du flottant.
  const dureeHebdo =
    trainer.contratDureeHebdoHeures === null ? null : Number(trainer.contratDureeHebdoHeures);

  const salarie: SalarieContrat = {
    statut: trainer.statut as SalarieContrat["statut"],
    nom: trainer.nom,
    prenom: trainer.prenom,
    dateNaissance: trainer.dateNaissance,
    lieuNaissance: trainer.lieuNaissance,
    adressePersonnelle: trainer.adressePersonnelle,
    dateEmbauche: trainer.dateEmbauche,
    contratType: trainer.contratType,
    contratPoste: trainer.contratPoste,
    contratClassification: trainer.contratClassification,
    contratDureeHebdoHeures: dureeHebdo,
    contratPeriodeEssaiMois: trainer.contratPeriodeEssaiMois,
    contratLieuTravail: trainer.contratLieuTravail,
    contratDateFin: trainer.contratDateFin,
    contratMotifCdd: trainer.contratMotifCdd,
    fixeMensuelBrutCents: trainer.fixeMensuelBrutCents,
  };

  const verdict = verifierEligibiliteContrat(salarie);
  if (!verdict.eligible) {
    return {
      error: `Contrat impossible à établir :\n${verdict.refus
        .map((m) => `• ${LIBELLE_REFUS_CONTRAT[m]}`)
        .join("\n")}`,
    };
  }

  const [libelleConvention, idcc, representant] = await Promise.all([
    getQualiopiConfig("convention_collective"),
    getQualiopiConfig("convention_collective_idcc"),
    getQualiopiConfig("dirigeant_nom"),
  ]);
  const convention = { libelle: libelleConvention, idcc };
  const specimenMotif = motifSpecimenContrat(convention);

  const identite = await getOrganismeIdentite();

  const doc = await generateDocument({
    type: "contrat_travail",
    identite,
    // Sans ce rattachement, la pièce ne serait reliée au salarié par RIEN :
    // impossible, depuis un `documents_generes.id`, de savoir à qui adresser le
    // lien de signature — et l'espace formateur ne la verrait jamais.
    refs: { trainerId },
    buildElement: (numero) =>
      React.createElement(ContratTravailPdf, {
        data: {
          numero,
          ...(specimenMotif !== null ? { estSpecimen: true as const, specimenMotif } : {}),
          salarie: {
            nom: trainer.nom,
            prenom: trainer.prenom,
            dateNaissance: dateFr(trainer.dateNaissance),
            lieuNaissance: trainer.lieuNaissance ?? "",
            adresse: trainer.adressePersonnelle ?? "",
          },
          // `verifierEligibiliteContrat` a déjà refusé un type absent : le repli
          // ne s'exerce jamais, il satisfait le typage sans inventer de valeur
          // silencieuse (un `cdi` par défaut aurait effacé un terme de CDD).
          type: trainer.contratType ?? "cdi",
          dateEmbauche: dateFr(trainer.dateEmbauche),
          ...(trainer.contratDateFin !== null ? { dateFin: dateFr(trainer.contratDateFin) } : {}),
          ...(trainer.contratMotifCdd !== null ? { motifCdd: trainer.contratMotifCdd } : {}),
          poste: trainer.contratPoste ?? "",
          classification: trainer.contratClassification ?? "",
          dureeHebdoHeures: dureeHebdo === null ? "" : String(dureeHebdo).replace(".", ","),
          lieuTravail: trainer.contratLieuTravail ?? "",
          periodeEssaiMois: trainer.contratPeriodeEssaiMois,
          remunerationMensuelle: euros(trainer.fixeMensuelBrutCents ?? 0),
          /*
            🔴 LA CLAUSE DE VARIABLE N'EST RENDUE QUE SI LE MÉCANISME EXISTE.

            `fixeMensuelBrutCents` seul ne suffit pas à l'affirmer : tout salarié
            en a un. Ce qui distingue le fixe RÉCUPÉRABLE, c'est qu'une avance
            est reprise dessus — `avanceRepriseCents` renseigné en est la trace
            explicite, posée par le panneau du fixe récupérable.

            Écrire la clause pour quelqu'un dont la paie ne fonctionne pas ainsi
            créerait une attente de commissions sans objet ; l'omettre pour
            quelqu'un dont elle fonctionne ainsi rendrait l'imputation
            INOPPOSABLE — un variable qui s'impute sur un fixe ne se pratique pas
            sans être écrit.
          */
          variableActive: trainer.avanceRepriseCents !== null,
          conventionCollective: convention.libelle,
          conventionIdcc: convention.idcc,
          representant,
          dateContrat: dateFr(new Date()),
        },
        identite,
      }),
  });

  await logQualiopiActivity({
    action: "qualiopi.document.contrat_travail.genere",
    targetType: "Trainer",
    targetId: trainerId,
    changes: {
      documentId: doc.id,
      numero: doc.numero,
      contratType: trainer.contratType,
      specimen: specimenMotif !== null,
    },
    session,
  });

  return {
    data: { documentId: doc.id, numero: doc.numero, specimen: specimenMotif !== null },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Prévenir le salarié
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Annonce au salarié que son contrat l'attend dans son espace.
 *
 * ## 🔴 Pourquoi ce geste existe
 *
 * La pièce était complète, numérotée, signable — et personne n'allait la
 * chercher. Quelqu'un qu'on vient d'embaucher n'a aucune raison d'ouvrir un
 * « espace formateur » de sa propre initiative : il attend qu'on lui dise. Le
 * lecteur EXISTAIT ; rien ne lui indiquait le chemin.
 *
 * ## ⛔ POURQUOI IL EST MANUEL, ET LE RESTERA
 *
 * C'est le QUATRIÈME geste, après enregistrer, établir et RELIRE. Will a demandé
 * la relecture avant l'envoi ; un envoi automatique à l'émission la rendrait
 * impossible — le message partirait dans le même mouvement que la production de
 * la pièce, et une mention fausse serait déjà chez l'intéressé.
 *
 * ⚠️ L'écart avec l'autofacture est VOULU et n'est pas une incohérence :
 * celle-là s'émet automatiquement parce que son contrôle humain a déjà eu lieu
 * (la VALIDATION du relevé, où un opérateur regarde l'argent). Ici, le contrôle
 * humain est la relecture, et elle vient APRÈS la production.
 *
 * ## Ce que le message ne fait pas
 *
 * ⛔ Aucune pièce jointe : le contrat porte la rémunération et l'adresse
 * personnelle du salarié, l'espace le sert derrière une garde de propriété, une
 * boîte aux lettres ne garde rien.
 *
 * ⛔ Aucun lien secret : le lien de connexion vaut quinze minutes. Un message
 * ouvert le soir porterait un lien déjà mort, sur l'annonce d'un contrat de
 * travail. On envoie vers la page de connexion.
 */
export async function notifierContratTravailAction(input: {
  trainerId: string;
}): Promise<ActionResult<{ destinataire: string }>> {
  const session = await requireHabilitation("remunerer_formateur");
  if (isStub()) return { error: "Envoi désactivé en mode build (stub)" };

  const parsed = z.object({ trainerId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { trainerId } = parsed.data;

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      nom: true,
      prenom: true,
      statut: true,
      actif: true,
      contratType: true,
      contratPoste: true,
      dateEmbauche: true,
    },
  });
  if (trainer === null) return { error: "Formateur introuvable" };
  if (trainer.statut !== "salarie") {
    return { error: "Ce formateur n'est pas salarié : il n'a pas de contrat de travail." };
  }
  if (!trainer.actif) {
    return { error: "Ce compte est désactivé : réactivez-le avant de prévenir le salarié." };
  }
  if (trainer.email.trim() === "") {
    return { error: "Ce formateur n'a pas d'adresse e-mail : renseignez-la sur sa fiche." };
  }

  /*
    🔴 ON REFUSE D'ANNONCER UNE PIÈCE QUI N'EXISTE PAS.

    Sans ce contrôle, le bouton enverrait « votre contrat est prêt » à quelqu'un
    qui ouvrirait un espace vide. C'est pire que le silence qu'on corrige : le
    silence n'engage rien, l'annonce fausse fait perdre confiance dans tout ce
    qui suivra.

    ⚠️ Et on refuse aussi le SPÉCIMEN. Une pièce marquée « spécimen » n'est pas
    opposable et le service de signature la rejette : l'annoncer enverrait le
    salarié buter sur un refus, sur le document le plus engageant qu'on lui
    adresse.
  */
  const piece = await prisma.documentGenere.findFirst({
    where: { type: "contrat_travail", trainerId, annuleeAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { numero: true, metadata: true },
  });
  if (piece === null) {
    return {
      error:
        "Aucun contrat n'a été établi pour ce salarié. Établissez-le, relisez-le, puis prévenez-le.",
    };
  }
  const estSpecimen =
    typeof piece.metadata === "object" &&
    piece.metadata !== null &&
    !Array.isArray(piece.metadata) &&
    (piece.metadata as Record<string, unknown>)["specimen"] === true;
  if (estSpecimen) {
    return {
      error:
        "Ce contrat porte la mention SPÉCIMEN : il n'est pas opposable et ne peut pas être signé. Renseignez la convention collective de l'organisme, établissez-le à nouveau, puis prévenez le salarié.",
    };
  }

  const envoi = await enqueueEmail(
    "formateur-contrat-travail",
    trainer.email,
    "fr",
    {
      formateurPrenomNom: `${trainer.prenom} ${trainer.nom}`.trim(),
      natureContrat: trainer.contratType === "cdd" ? "CDD" : "CDI",
      /*
        🔴 MON PROPRE DÉFAUT, TROUVÉ PAR LA RELECTURE DU 13/09. C'était
        `?? "formateur"` : une personne dont le poste n'a pas été saisi recevait
        PAR ÉCRIT l'annonce de son contrat au poste de « formateur ». Une
        secrétaire, un développeur web.

        ⚠️ Et l'asymétrie aggravait tout : le PDF du contrat, lui, passe `?? ""`
        sur une `FieldRow required` — il affiche « Non renseigné » en rouge. Le
        DOCUMENT se taisait là où l'E-MAIL affirmait.

        ⛔ Le repli ne s'exerce d'ailleurs jamais : `verifierEligibiliteContrat`
        refuse d'établir un contrat sans poste, et cette action refuse d'annoncer
        une pièce qui n'existe pas. Un repli qui ne peut pas s'exercer n'a pas
        besoin d'INVENTER — il a besoin de ne rien affirmer.
      */
      poste: trainer.contratPoste ?? "",
      dateEmbauche: dateFr(trainer.dateEmbauche),
      numeroPiece: piece.numero,
      lienEspace: publicUrl(FORMATEUR_CONNEXION_PATH).toString(),
    },
    {
      // 🔑 `entityType`/`entityId` rendent l'envoi RETROUVABLE : c'est ce que
      // l'écran relit pour afficher « prévenu le … ». Sans eux, la trace
      // existerait dans le journal des e-mails sans qu'aucune surface ne sache
      // la rattacher à ce salarié.
      //
      // ⚠️ AUCUN `jobId` fixe, volontairement : un identifiant stable rendrait
      // l'envoi idempotent, donc un SECOND envoi serait silencieusement avalé.
      // Or réenvoyer est un geste légitime — le premier message s'est perdu, ou
      // le contrat a été refait.
      entityType: "Trainer",
      entityId: trainerId,
    },
  );

  if (!envoi.enqueued) {
    return {
      error:
        envoi.garePourValidation === true
          ? "Le message est garé en corbeille de validation : il partira une fois validé."
          : "La file de messages est indisponible : le salarié n'a PAS été prévenu. Réessayez.",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.contrat_travail.notifie",
    targetType: "Trainer",
    targetId: trainerId,
    changes: { numero: piece.numero, destinataire: trainer.email },
    session,
  });

  return { data: { destinataire: trainer.email } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Consigner la remise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consigne la date à laquelle le salarié a REÇU son exemplaire du contrat.
 *
 * ## 🔴 Pourquoi ce geste existe, et pourquoi il est SÉPARÉ de l'annonce
 *
 * Le contrat est produit, le salarié est prévenu, la pièce l'attend dans son
 * espace. Restait un fait que le logiciel ne voyait pas : **est-ce qu'il a son
 * exemplaire ?** Si la remise a lieu, tout va bien. Sinon, rien ne le dit, rien
 * ne compte les jours, et personne ne l'apprend avant un conseil de prud'hommes.
 *
 * ⛔ CE N'EST PAS `notifierContratTravailAction`, ET LES CONFONDRE SERAIT LE
 * DÉFAUT. « Votre contrat vous attend » et « il a son exemplaire » sont deux
 * faits différents. Si la notification posait cette date, on aurait une remise
 * consignée pour quelqu'un qui n'a jamais ouvert le message — une trace FAUSSE,
 * pire qu'une trace absente, parce qu'elle se défend.
 *
 * ## Ce que la date ferme
 *
 * L'alerte `contrat_cdd_non_remis` est `critique` et `resolutionAuto: true` :
 * elle ne s'éteint QUE si cette colonne se pose. C'est le geste que son message
 * prescrit, et c'est pour qu'il existe au même moment que l'alerte qu'une garde
 * (`tests/unit/ci/la-remise-du-cdd-a-son-geste.spec.ts`) refuse l'une sans
 * l'autre.
 *
 * ⚠️ La date est SAISIE, jamais « maintenant » par défaut. Une remise a pu avoir
 * lieu la veille, ou le jour de l'embauche pendant que personne n'était devant
 * l'écran. Poser l'horloge du serveur ferait dire à la trace autre chose que ce
 * qui s'est passé — sur la pièce même qu'on produirait pour le prouver.
 *
 * ⚠️ Elle refuse une date FUTURE : consigner une remise qui n'a pas encore eu
 * lieu éteindrait l'alerte par anticipation, ce qui est exactement ce qu'elle
 * existe pour empêcher.
 */
const remiseSchema = z.object({
  trainerId: z.string().uuid(),
  /** `YYYY-MM-DD`, ou `null` pour EFFACER une date consignée par erreur. */
  remisLe: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format JJ/MM/AAAA")
    .nullable(),
});

export async function consignerRemiseContratAction(
  input: z.input<typeof remiseSchema>,
): Promise<ActionResult<{ id: string; efface: boolean }>> {
  const session = await requireHabilitation("remunerer_formateur");
  const parsed = remiseSchema.safeParse(input);
  if (!parsed.success) return { error: "Date invalide." };
  const { trainerId, remisLe } = parsed.data;

  const quand = remisLe === null ? null : new Date(`${remisLe}T00:00:00.000Z`);
  if (quand !== null && Number.isNaN(quand.getTime())) return { error: "Date invalide." };

  // 🔴 Pas de remise DANS LE FUTUR. Elle éteindrait l'alerte par anticipation —
  // très exactement ce que cette alerte existe pour empêcher.
  if (quand !== null && quand.getTime() > Date.now()) {
    return {
      error:
        "Cette date est dans le futur : on ne consigne une remise qu'une fois qu'elle a eu lieu.",
    };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { statut: true },
  });
  if (trainer === null) return { error: "Formateur introuvable" };
  if (trainer.statut !== "salarie") {
    return {
      error: "Ce formateur n'est pas salarié : il n'a pas de contrat de travail à remettre.",
    };
  }

  try {
    await prisma.trainer.update({ where: { id: trainerId }, data: { contratRemisAt: quand } });
  } catch {
    return { error: "Enregistrement impossible." };
  }

  await logQualiopiActivity({
    // ⚠️ Le journal distingue les deux gestes : consigner une remise est un fait
    // opposable, l'effacer revient à dire qu'on s'était trompé. Les ranger sous
    // la même action rendrait le second invisible à la relecture.
    action:
      remisLe === null
        ? "qualiopi.trainer.remise_contrat.effacee"
        : "qualiopi.trainer.remise_contrat",
    targetType: "Trainer",
    targetId: trainerId,
    changes: { remisLe },
    session,
  });

  return { data: { id: trainerId, efface: remisLe === null } };
}
