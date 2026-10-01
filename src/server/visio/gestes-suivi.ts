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
import { rencontreDAncrage } from "./ancrage";
import {
  MAX_QUESTIONS_ECRITES,
  MAX_REPONSE,
  MAX_TEXTE_QUESTION,
  MODELE_QUESTIONS_DE_WILLIAMS,
  QUESTIONS_REELLES,
} from "./questionnaire-en-ligne/constantes";
import { versionRemplacable } from "./questionnaire-en-ligne/regles";

type Db = PrismaClient;

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

/** La rencontre d'ancrage du projet (module `ancrage.ts`, partagé avec la route publique). */
export { rencontreDAncrage };

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

/**
 * Les lignes d'un texte « une question par ligne » : numéros et puces de tête
 * retirés (« 1. », « 2) », « - », « • »), lignes vides ignorées.
 */
export function questionsDuTexte(texte: string): string[] {
  return texte
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*(?:\d{1,2}\s*[.)]|[-*•])\s+/u, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((l) => l !== "");
}

/**
 * « Écrire mes questions » (questionnaire en ligne, 2026-10-01) : Will écrit
 * ses questions, une par ligne, SANS IA (donc sans drapeau). Son texte n'est
 * pas soumis aux gardes de P6 (ni lien ni prix) : c'est le sien.
 *
 * Règle UNIQUE de remplacement (`versionRemplacable`, avis de l'architecte B2) :
 *   · la dernière version est un BROUILLON écrit par Will (ou un brouillon IA
 *     vide), sans réponse ni fait → elle est REMPLACÉE en place ;
 *   · sinon → une NOUVELLE version (`en_ligne`, `brouillon`). Ce qui est parti
 *     chez le client ne se réécrit pas. Si la version précédente est un lien
 *     en ligne encore sans réponse (`en_ligne` + `copie`), elle est CLOSE dans
 *     la même transaction : l'ancien lien ne fonctionne plus. Une version « à
 *     copier » déjà copiée reste intacte : c'est la trace de ce qui est parti.
 *
 * Course avec un envoi du client (B1) : le remplacement commence par un
 * `updateMany` conditionnel qui prend le verrou de la ligne et revérifie
 * qu'elle est toujours un brouillon sans réponse ; sinon, rien n'est effacé.
 *
 * `typeVise = "autre"` : une question écrite à la main ne vise aucune rubrique
 * du dossier. C'est la valeur que P6 donne lui-même aux questions ouvertes
 * (`TYPE_VISE_PAR_RUBRIQUE.questions_ouvertes`) ; tout autre type ferait dire
 * à la lecture des réponses qu'une réponse est, par exemple, un « besoin ».
 */
export async function ecrireQuestions(
  db: Db,
  a: {
    readonly clientId: string;
    readonly projetId: string;
    readonly texte: string;
    readonly parAdminId: string;
  },
): Promise<string> {
  if (!(await projetOuvrableDuClient(db, a.projetId, a.clientId))) {
    throw new GesteRefuse("Ce projet n'existe pas (ou plus) sur cette fiche.");
  }
  const questions = questionsDuTexte(a.texte);
  if (questions.length === 0) {
    throw new GesteRefuse("Écrivez au moins une question (une par ligne).");
  }
  if (questions.length > MAX_QUESTIONS_ECRITES) {
    throw new GesteRefuse(`${MAX_QUESTIONS_ECRITES} questions au plus par questionnaire.`);
  }
  const tropLongue = questions.findIndex((q) => q.length > MAX_TEXTE_QUESTION);
  if (tropLongue >= 0) {
    throw new GesteRefuse(
      `La question ${tropLongue + 1} dépasse ${MAX_TEXTE_QUESTION} caractères : raccourcissez-la.`,
    );
  }
  const maintenant = new Date();
  return db.$transaction(async (tx) => {
    const derniere = await tx.questionnaireCadrage.findFirst({
      where: { projetId: a.projetId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        statut: true,
        mode: true,
        modele: true,
        questions: {
          select: { reponseRecueLe: true, _count: { select: { faitsProduits: true } } },
        },
      },
    });
    const etat =
      derniere === null
        ? null
        : {
            statut: derniere.statut,
            modele: derniere.modele,
            questions: derniere.questions.map((x) => ({
              reponseRecueLe: x.reponseRecueLe,
              faits: x._count.faitsProduits,
            })),
          };
    let remplacable = versionRemplacable(etat);
    if (remplacable && derniere !== null) {
      // B1 : verrou de la ligne + revérification, AVANT tout effacement.
      const tenu = await tx.questionnaireCadrage.updateMany({
        where: { id: derniere.id, statut: "brouillon", reponseRecueLe: null },
        data: { genereLe: maintenant },
      });
      remplacable = tenu.count === 1;
    }
    let questionnaireId: string;
    let version: number;
    let ancienLienClos = false;
    if (remplacable && derniere !== null) {
      questionnaireId = derniere.id;
      version = derniere.version;
      await tx.questionnaireQuestion.deleteMany({ where: { questionnaireId } });
      await tx.questionnaireCadrage.update({
        where: { id: questionnaireId },
        data: {
          mode: "en_ligne",
          modele: MODELE_QUESTIONS_DE_WILLIAMS,
          promptHash: null,
          genereLe: maintenant,
          creeParId: a.parAdminId,
        },
      });
    } else {
      if (derniere !== null && derniere.mode === "en_ligne" && derniere.statut === "copie") {
        // L'ancien lien est chez le client, sans réponse : il se ferme.
        const clos = await tx.questionnaireCadrage.updateMany({
          where: { id: derniere.id, statut: "copie", reponseRecueLe: null },
          data: { statut: "clos", closLe: maintenant },
        });
        ancienLienClos = clos.count === 1;
      }
      version = (derniere?.version ?? 0) + 1;
      const cree = await tx.questionnaireCadrage.create({
        data: {
          projetId: a.projetId,
          clientId: a.clientId,
          version,
          mode: "en_ligne",
          statut: "brouillon",
          genereLe: maintenant,
          modele: MODELE_QUESTIONS_DE_WILLIAMS,
          creeParId: a.parAdminId,
        },
        select: { id: true },
      });
      questionnaireId = cree.id;
    }
    await tx.questionnaireQuestion.createMany({
      data: questions.map((texte, i) => ({
        questionnaireId,
        ordre: i + 1,
        texte: chiffrerParole(texte),
        typeVise: "autre" as const,
      })),
    });
    const n = questions.length;
    const enregistrees = `${n} question${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""} (version ${version}).`;
    return ancienLienClos
      ? `${enregistrees} L'ancien lien ne fonctionne plus : envoyez le nouveau (« Lien du questionnaire en ligne »).`
      : `${enregistrees} Cliquez « Lien du questionnaire en ligne » pour obtenir le lien à envoyer.`;
  });
}

/**
 * « Lien du questionnaire en ligne » : le questionnaire passe `en_ligne` (le
 * lien secret s'ouvre — un questionnaire « à copier » n'est jamais exposé sans
 * ce geste) et, s'il était en brouillon, `copie` (il part chez le client). La
 * page publique n'ouvre QUE ce couple `en_ligne` + `copie`.
 */
export async function ouvrirLienEnLigne(db: Db, questionnaireId: string): Promise<string> {
  const q = await exigerQuestionnaire(db, questionnaireId);
  if (q.statut === "clos") throw new GesteRefuse("Ce questionnaire est clos.");
  if (q.statut === "reponse_recue") {
    throw new GesteRefuse(
      "Les réponses sont déjà reçues : écrivez de nouvelles questions pour un nouveau questionnaire.",
    );
  }
  const visibles = await db.questionnaireQuestion.count({
    where: { questionnaireId: q.id, poseeDeViveVoix: false, ...QUESTIONS_REELLES },
  });
  if (visibles === 0) {
    throw new GesteRefuse("Aucune question à montrer au client : écrivez d'abord vos questions.");
  }
  await db.questionnaireCadrage.update({
    where: { id: q.id },
    data:
      q.statut === "brouillon"
        ? { mode: "en_ligne", statut: "copie", copieLe: new Date() }
        : { mode: "en_ligne" },
  });
  return "Lien prêt : copiez-le et mettez-le sous un bouton de votre e-mail.";
}

/**
 * Case « posée de vive voix » : la question sort du texte à copier. La ligne
 * « Qui répond ? » (ordre 0) n'est pas une question : refusée.
 */
export async function marquerPoseeDeViveVoix(
  db: Db,
  questionId: string,
  valeur: boolean,
): Promise<string> {
  const fait = await db.questionnaireQuestion.updateMany({
    where: { id: questionId, ...QUESTIONS_REELLES },
    data: { poseeDeViveVoix: valeur },
  });
  if (fait.count === 0) throw new GesteRefuse("Question introuvable.");
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
  // La ligne « Qui répond ? » (ordre 0) n'est jamais réécrite par la saisie de Will.
  const questions = await db.questionnaireQuestion.findMany({
    where: { questionnaireId: q.id, ...QUESTIONS_REELLES },
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
  // Un double clic (ou un second onglet) ne gare pas un deuxième e-mail : tant
  // qu'un e-mail de suivi de cette rencontre vers cette personne attend dans
  // « E-mails à valider », on le signale au lieu d'en préparer un autre.
  // Écarté (`refuse`) ou parti (`envoye`), il n'attend plus : on en prépare un.
  // Compte aussi un e-mail GARÉ mais pas encore relié à sa demande (étape
  // `email_suivi` interrompue après le garage) : même filtre que sa reprise.
  const dejaPrepare = await db.emailOutbox.count({
    where: {
      statut: "a_valider",
      OR: [
        { emailSuivi: { is: { rencontreId: a.rencontreId, contactId: donnees.contact.id } } },
        {
          template: "visio-email-suivi",
          entityType: "Rencontre",
          entityId: a.rencontreId,
          recipient: to,
          emailSuivi: { is: null },
        },
      ],
    },
  });
  if (dejaPrepare > 0) {
    return "Un e-mail de suivi pour cette personne est déjà préparé : relisez-le dans « E-mails à valider ».";
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
