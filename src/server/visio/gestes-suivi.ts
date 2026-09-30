/**
 * Les GESTES de Will sur le questionnaire de cadrage et l'e-mail de suivi
 * (chantier visio, PR 7). Appelés par l'action unique
 * `src/features/dossier-client/suivi-actions.ts`, qui vérifie la session
 * (décision A2) ; testables ici sans elle.
 *
 * Aucun geste n'appelle OpenAI : ils préparent la demande et PROGRAMMENT une
 * étape (`planifierDans`), que le worker exécute. Et aucun geste n'envoie un
 * e-mail : le gabarit fixe est GARÉ dans « E-mails à valider »
 * (`exigerValidation: true`), comme le brouillon rédigé par l'étape.
 *
 * Statuts du questionnaire : `brouillon` (préparé) → `copie` (Will l'a copié
 * dans son e-mail) → `reponse_recue` (réponses collées, lecture programmée) →
 * `clos`.
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { projetOuvrableDuClient } from "@/features/dossier-client/projet-ouvrable";
import { modeEnregistrement, type ModeEnregistrement } from "./drapeau";
import { GesteRefuse } from "./gestes-compte-rendu";
import {
  estRencontreDeTest,
  iaALaDemandePermise,
  MESSAGE_IA_A_LA_DEMANDE_FERMEE,
} from "./ia-a-la-demande";
import { destinataireValide, faitsPourEmail, gabaritFixeEmail } from "./passes/email-suivi";
import {
  destinataireDuSuivi,
  lireDonneesEmailSuivi,
  payloadEmailSuivi,
  type DonneesEmailSuivi,
  type PortEnvoiEmailSuivi,
} from "./passes/etapes-a-la-demande";
import { planifierDans } from "./prise-d-etape";

type Db = PrismaClient;

const MAX_REPONSE = 5000;

/** Le drapeau est lu à l'exécution ; les tests et la Gate D l'injectent. */
export interface OptionsIa {
  readonly mode?: ModeEnregistrement;
}

/**
 * ⛔ Les gestes qui programment une étape IA (questionnaire, lecture des
 * réponses, e-mail rédigé) sont refusés tant que le drapeau ne l'ouvre pas pour
 * cette rencontre (`ia-a-la-demande.ts`) : rien n'est programmé, rien ne part.
 */
async function exigerIaPermise(
  db: Pick<Db, "rencontre">,
  rencontreId: string,
  o: OptionsIa,
  suite = "",
): Promise<void> {
  const mode = o.mode ?? modeEnregistrement();
  const test = mode === "pilote" ? await estRencontreDeTest(db, rencontreId) : false;
  if (!iaALaDemandePermise(mode, test)) {
    throw new GesteRefuse(
      suite ? `${MESSAGE_IA_A_LA_DEMANDE_FERMEE} ${suite}` : MESSAGE_IA_A_LA_DEMANDE_FERMEE,
    );
  }
}

// ── Questionnaire ────────────────────────────────────────────────────────────

/** La rencontre d'ancrage du projet : la plus récente rangée dans ce projet. */
export async function rencontreDAncrage(
  db: Pick<Db, "rencontre">,
  clientId: string,
  projetId: string,
): Promise<string | null> {
  const r = await db.rencontre.findFirst({
    where: { clientId, projetId, fusionneeDansId: null },
    orderBy: [{ debutReel: "desc" }, { debutPrevu: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  return r?.id ?? null;
}

/** « Préparer un questionnaire » : nouvelle version en brouillon + étape `questionnaire`. */
export async function demanderQuestionnaire(
  db: Db,
  a: { readonly clientId: string; readonly projetId: string; readonly parAdminId: string },
  o: OptionsIa = {},
): Promise<string> {
  if (!(await projetOuvrableDuClient(db, a.projetId, a.clientId))) {
    throw new GesteRefuse("Ce projet n'existe pas (ou plus) sur cette fiche.");
  }
  const ancrage = await rencontreDAncrage(db, a.clientId, a.projetId);
  if (ancrage === null) {
    throw new GesteRefuse(
      "Aucun rendez-vous n'est rangé dans ce projet : le questionnaire part de ce qui a été dit en rendez-vous.",
    );
  }
  await exigerIaPermise(db, ancrage, o);
  return db.$transaction(async (tx) => {
    const enPreparation = await tx.questionnaireCadrage.findFirst({
      where: { projetId: a.projetId, statut: "brouillon", modele: null },
      select: { id: true },
    });
    if (!enPreparation) {
      const derniere = await tx.questionnaireCadrage.findFirst({
        where: { projetId: a.projetId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.questionnaireCadrage.create({
        data: {
          projetId: a.projetId,
          clientId: a.clientId,
          version: (derniere?.version ?? 0) + 1,
          mode: "a_copier",
          statut: "brouillon",
          genereLe: new Date(),
          creeParId: a.parAdminId,
        },
      });
    }
    await planifierDans(tx, ancrage, {
      etape: "questionnaire",
      compteRenduId: null,
      reinitialiser: true,
    });
    return "Questionnaire en préparation : il apparaît ici d'ici quelques minutes.";
  });
}

async function exigerQuestionnaire(db: Pick<Db, "questionnaireCadrage">, id: string) {
  const q = await db.questionnaireCadrage.findUnique({
    where: { id },
    select: { id: true, statut: true, clientId: true, projetId: true },
  });
  if (!q) throw new GesteRefuse("Questionnaire introuvable.");
  return q;
}

/** « J'ai copié le questionnaire » (l'envoi réel est hors du site en V1, B8). */
export async function marquerQuestionnaireCopie(db: Db, questionnaireId: string): Promise<string> {
  const q = await exigerQuestionnaire(db, questionnaireId);
  if (q.statut !== "brouillon") return "Déjà noté comme copié.";
  await db.questionnaireCadrage.update({
    where: { id: q.id },
    data: { statut: "copie", copieLe: new Date() },
  });
  return "Noté : le questionnaire est parti chez le client.";
}

/** Case « posée de vive voix » : la question sort du texte à copier. */
export async function marquerPoseeDeViveVoix(
  db: Db,
  questionId: string,
  valeur: boolean,
): Promise<string> {
  await db.questionnaireQuestion.update({
    where: { id: questionId },
    data: { poseeDeViveVoix: valeur },
  });
  return valeur ? "Question notée comme posée de vive voix." : "Question remise dans le texte.";
}

/**
 * Les réponses collées par Will, question par question (chiffrées), puis la
 * lecture programmée. Une question sans réponse garde `null`.
 */
export async function enregistrerReponses(
  db: Db,
  a: {
    readonly questionnaireId: string;
    readonly reponses: ReadonlyMap<string, string>;
  },
  o: OptionsIa = {},
): Promise<string> {
  const q = await exigerQuestionnaire(db, a.questionnaireId);
  if (q.statut === "clos") throw new GesteRefuse("Ce questionnaire est clos.");
  const questions = await db.questionnaireQuestion.findMany({
    where: { questionnaireId: q.id },
    select: { id: true },
  });
  const ids = new Set(questions.map((x) => x.id));
  const utiles = [...a.reponses].filter(([id, t]) => ids.has(id) && t.trim() !== "");
  if (utiles.length === 0) throw new GesteRefuse("Aucune réponse à enregistrer.");
  const ancrage = await rencontreDAncrage(db, q.clientId, q.projetId);
  // Les réponses collées sont des paroles du client : leur lecture par l'IA
  // attend le drapeau (sans rendez-vous d'ancrage, aucune lecture n'est programmée).
  if (ancrage !== null) await exigerIaPermise(db, ancrage, o);
  const maintenant = new Date();
  await db.$transaction(async (tx) => {
    for (const [id, texte] of utiles) {
      await tx.questionnaireQuestion.update({
        where: { id },
        data: {
          reponse: chiffrerParole(texte.trim().slice(0, MAX_REPONSE)),
          reponseRecueLe: maintenant,
        },
      });
    }
    await tx.questionnaireCadrage.update({
      where: { id: q.id },
      data: { statut: "reponse_recue", reponseRecueLe: maintenant },
    });
    if (ancrage !== null) {
      await planifierDans(tx, ancrage, {
        etape: "lire_reponses",
        compteRenduId: null,
        reinitialiser: true,
      });
    }
  });
  return ancrage === null
    ? "Réponses enregistrées. (Aucun rendez-vous dans ce projet : pas de lecture automatique.)"
    : "Réponses enregistrées : elles sont rangées en faits à valider d'ici quelques minutes.";
}

/**
 * Valider un fait tiré d'une réponse : il devient une valeur du dossier, et la
 * question ouverte d'origine passe « répondue » (jamais avant la validation).
 */
export async function validerFaitDeReponse(
  db: Db,
  a: { readonly faitId: string; readonly parAdminId: string },
): Promise<string> {
  const f = await db.fait.findUnique({
    where: { id: a.faitId },
    select: {
      id: true,
      statut: true,
      source: true,
      questionnaireQuestion: { select: { faitSourceId: true } },
    },
  });
  if (!f || f.source !== "questionnaire_cadrage") throw new GesteRefuse("Fait introuvable.");
  if (f.statut !== "propose" && f.statut !== "en_attente") return "Déjà traité.";
  await db.$transaction(async (tx) => {
    await tx.fait.update({ where: { id: f.id }, data: { statut: "valide" } });
    await tx.faitEvenement.create({
      data: { faitId: f.id, action: "valide", parAdminId: a.parAdminId },
    });
    const sourceId = f.questionnaireQuestion?.faitSourceId ?? null;
    if (sourceId !== null) {
      const source = await tx.fait.findUnique({
        where: { id: sourceId },
        select: { id: true, suivi: true, statut: true },
      });
      if (source && source.statut === "valide" && source.suivi === "ouvert") {
        await tx.fait.update({
          where: { id: source.id },
          data: { suivi: "repondu", resoluParFaitId: f.id },
        });
        await tx.faitEvenement.create({
          data: {
            faitId: source.id,
            action: "suivi_change",
            ancienSuivi: "ouvert",
            nouveauSuivi: "repondu",
            parAdminId: a.parAdminId,
          },
        });
      }
    }
  });
  return "Réponse validée.";
}

export async function rejeterFaitDeReponse(
  db: Db,
  a: { readonly faitId: string; readonly parAdminId: string },
): Promise<string> {
  const f = await db.fait.findUnique({
    where: { id: a.faitId },
    select: { id: true, statut: true, source: true },
  });
  if (!f || f.source !== "questionnaire_cadrage") throw new GesteRefuse("Fait introuvable.");
  if (f.statut !== "propose" && f.statut !== "en_attente") return "Déjà traité.";
  await db.$transaction(async (tx) => {
    await tx.fait.update({
      where: { id: f.id },
      data: { statut: "rejete", motifRejet: "rejete_par_williams" },
    });
    await tx.faitEvenement.create({
      data: {
        faitId: f.id,
        action: "rejete",
        motif: "rejete_par_williams",
        parAdminId: a.parAdminId,
      },
    });
  });
  return "Réponse écartée.";
}

export async function clore(db: Db, questionnaireId: string): Promise<string> {
  const q = await exigerQuestionnaire(db, questionnaireId);
  await db.questionnaireCadrage.update({
    where: { id: q.id },
    data: { statut: "clos", closLe: new Date() },
  });
  return "Questionnaire clos.";
}

// ── E-mail de suivi ─────────────────────────────────────────────────────────

/**
 * Les données de l'e-mail (la lecture UNIQUE, `lireDonneesEmailSuivi`, que
 * l'étape du worker appelle aussi) et l'adresse d'envoi — ou un refus motivé.
 */
async function exigerDestinataire(
  db: Db,
  rencontreId: string,
  contactId: string,
): Promise<{ donnees: DonneesEmailSuivi; to: string }> {
  const lu = await lireDonneesEmailSuivi(db, rencontreId, contactId);
  if (!lu.ok) {
    throw new GesteRefuse(
      lu.motif === "rencontre_non_rangee"
        ? "Rangez d'abord ce rendez-vous chez un client."
        : "Ce destinataire n'est pas un participant client validé du rendez-vous.",
    );
  }
  // ⛔ Un participant CLIENT validé de la rencontre, de la même fiche.
  if (!destinataireValide(contactId, lu.donnees.participants)) {
    throw new GesteRefuse("Ce destinataire n'est pas un participant client validé du rendez-vous.");
  }
  const to = destinataireDuSuivi(lu.donnees);
  if (to === null) throw new GesteRefuse("Cette personne n'a pas d'adresse e-mail sur sa fiche.");
  return { donnees: lu.donnees, to };
}

/** « Préparer l'e-mail de suivi » : la demande, puis l'étape `email_suivi` (rédaction IA). */
export async function demanderEmailSuivi(
  db: Db,
  a: { readonly rencontreId: string; readonly contactId: string; readonly parAdminId: string },
  o: OptionsIa = {},
): Promise<string> {
  // ⛔ Rien d'un vrai client ne part chez OpenAI tant que le drapeau ne l'ouvre pas.
  await exigerIaPermise(db, a.rencontreId, o, "Utilisez le modèle fixe.");
  const { donnees } = await exigerDestinataire(db, a.rencontreId, a.contactId);
  if (faitsPourEmail(donnees.faits).length === 0) {
    throw new GesteRefuse("Validez d'abord le compte rendu : l'e-mail part des faits validés.");
  }
  await db.$transaction(async (tx) => {
    // Une demande encore sans e-mail est reprise (jamais deux demandes en vol).
    const enAttente = await tx.emailSuivi.findFirst({
      where: { rencontreId: a.rencontreId, emailOutboxId: null },
      orderBy: { creeLe: "desc" },
      select: { id: true },
    });
    if (enAttente) {
      await tx.emailSuivi.update({
        where: { id: enAttente.id },
        data: { contactId: donnees.contact.id, clientId: donnees.clientId },
      });
    } else {
      await tx.emailSuivi.create({
        data: {
          rencontreId: a.rencontreId,
          clientId: donnees.clientId,
          contactId: donnees.contact.id,
          creeParId: a.parAdminId,
        },
      });
    }
    await planifierDans(tx, a.rencontreId, {
      etape: "email_suivi",
      compteRenduId: null,
      reinitialiser: true,
    });
  });
  return "E-mail en préparation : il vous attendra dans « E-mails à valider ».";
}

/**
 * « Utiliser le modèle fixe » : sans IA (donc libre, quel que soit le
 * drapeau), depuis les faits validés, GARÉ dans « E-mails à valider ». Rien ne
 * part sans le clic de Will.
 */
export async function emailSuiviGabaritFixe(
  db: Db,
  envoi: PortEnvoiEmailSuivi,
  a: { readonly rencontreId: string; readonly contactId: string; readonly parAdminId: string },
): Promise<string> {
  const { donnees, to } = await exigerDestinataire(db, a.rencontreId, a.contactId);
  const faits = faitsPourEmail(donnees.faits);
  if (faits.length === 0) {
    throw new GesteRefuse("Validez d'abord le compte rendu : l'e-mail part des faits validés.");
  }
  const email = gabaritFixeEmail(faits, { titre: donnees.rencontre.titre || "notre rendez-vous" });
  const outboxId = await envoi.mettreEnValidation({
    to,
    payload: payloadEmailSuivi(donnees, email),
    clientId: donnees.clientId,
    sujet: email.objet,
    rencontreId: a.rencontreId,
  });
  if (outboxId === null) {
    throw new GesteRefuse("La file « E-mails à valider » est indisponible : rien n'est parti.");
  }
  // Une demande restée SANS e-mail (rédaction en échec définitif, annulée) est
  // REPRISE : sinon elle resterait orpheline pour toujours. Jamais celle que
  // l'étape rédige encore (à faire, en cours) : elle aura son propre e-mail.
  const orpheline = await db.emailSuivi.findFirst({
    where: { rencontreId: a.rencontreId, emailOutboxId: null },
    orderBy: { creeLe: "desc" },
    select: { id: true },
  });
  const etape = orpheline
    ? await db.traitementVisio.findFirst({
        where: { rencontreId: a.rencontreId, etape: "email_suivi" },
        select: { statut: true },
      })
    : null;
  const enVol = etape?.statut === "a_faire" || etape?.statut === "en_cours";
  if (orpheline && !enVol) {
    await db.emailSuivi.update({
      where: { id: orpheline.id },
      data: { contactId: donnees.contact.id, clientId: donnees.clientId, emailOutboxId: outboxId },
    });
  } else {
    await db.emailSuivi.create({
      data: {
        rencontreId: a.rencontreId,
        clientId: donnees.clientId,
        contactId: donnees.contact.id,
        emailOutboxId: outboxId,
        creeParId: a.parAdminId,
      },
    });
  }
  return "E-mail préparé avec le modèle fixe : relisez-le dans « E-mails à valider ».";
}
