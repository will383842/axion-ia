/**
 * Chantier QNC, L03 — LANCEMENT du recueil du besoin (temps 1), relance, et
 * retour rangé dans le dossier de la session.
 *
 * Ce module RÉUTILISE le questionnaire de cadrage du chantier visio
 * (`QuestionnaireCadrage` / `QuestionnaireQuestion`, la page publique
 * `/questionnaire/[id]/[jeton]` et son jeton HMAC) : il n'écrit que des lignes
 * de ces tables par leurs colonnes existantes, et rattache la session au projet
 * par `training_sessions.projet_id` (L00). Aucune colonne, aucun objet SQL.
 *
 * Le recueil est UNE version du questionnaire du projet :
 *   · modèle `recueil_besoin_v1`, mode `en_ligne`, statut `copie` (le lien est
 *     ouvert et PART chez l'entreprise — c'est l'état que pose le geste « Lien ») ;
 *   · les questions du GABARIT fixe d'abord, puis celles que la passe P6 avait
 *     déjà préparées depuis les faits (brouillon non envoyé), recopiées — le
 *     brouillon d'origine reste, rien ne s'efface.
 *
 * ⛔ ÉTEINT = INCHANGÉ : chaque point d'entrée lit d'abord
 * `qualiopi.recueil.actif` et rend sans rien lire d'autre ni rien écrire.
 *
 * La preuve (remise, relance, retour) vit dans `remises_retours` et
 * `relances_journal` (L00, ajout seul), rangées par SESSION.
 */

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { estActifPour, lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";
import { urlQuestionnaire } from "@/server/visio/questionnaire-en-ligne/jeton";
import {
  MODELE_QUESTIONS_DE_WILLIAMS,
  QUESTIONS_REELLES,
} from "@/server/visio/questionnaire-en-ligne/constantes";

import {
  ACTION_RECUEIL_LANCE,
  DELAI_RELANCE_JOURS,
  LOT_RECUEIL,
  MAX_RELANCES,
  MODELE_RECUEIL_BESOIN,
  OBJET_RECUEIL_BESOIN,
} from "./constantes";
import { questionsDuGabarit } from "./gabarit";

type Db = Pick<
  typeof prisma,
  | "setting"
  | "trainingSession"
  | "projet"
  | "questionnaireCadrage"
  | "questionnaireQuestion"
  | "remiseRetour"
  | "relanceJournal"
  | "activityLog"
  | "$transaction"
>;

/** L'envoi réel de l'e-mail — injecté : le worker et l'app y branchent `enqueueEmail`. */
export interface DemandeEnvoi {
  readonly sessionId: string;
  readonly clientId: string | null;
  readonly questionnaireId: string;
  readonly destinataire: string;
  readonly nomDestinataire: string | null;
  readonly raisonSociale: string;
  readonly titreSession: string;
  readonly url: string;
  /** 0 = premier envoi ; 1, 2… = relance. */
  readonly rang: number;
}
export type PortEnvoi = (
  a: DemandeEnvoi,
) => Promise<{ readonly parti: boolean; readonly garePourValidation: boolean }>;

export type ResultatLancement =
  | { readonly etat: "eteint" }
  | { readonly etat: "refuse"; readonly message: string }
  | { readonly etat: "deja_lance"; readonly questionnaireId: string }
  | { readonly etat: "lance"; readonly questionnaireId: string; readonly envoye: boolean };

const JOUR_MS = 24 * 3600 * 1000;

const SELECT_SESSION = {
  id: true,
  estTestInterne: true,
  projetId: true,
  clientId: true,
  titreSession: true,
  client: { select: { raisonSociale: true, contactNom: true, contactEmail: true } },
} as const;

const adresse = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

async function envoyerEtTracer(
  db: Db,
  envoi: PortEnvoi,
  d: DemandeEnvoi,
  o: { readonly auteurId: string | null; readonly maintenant: Date },
): Promise<boolean> {
  const r = await envoi(d);
  if (!r.parti && !r.garePourValidation) return false;
  if (d.rang === 0) {
    await db.remiseRetour.create({
      data: {
        sessionId: d.sessionId,
        nature: "remise",
        destinataire: "entreprise",
        canal: "email",
        objet: OBJET_RECUEIL_BESOIN,
        libelle: "Questionnaire de recueil du besoin",
        auteurId: o.auteurId,
        survenuLe: o.maintenant,
      },
    });
  } else {
    await db.relanceJournal.create({
      data: {
        sessionId: d.sessionId,
        objet: OBJET_RECUEIL_BESOIN,
        destinataire: "entreprise",
        canal: "email",
        rang: d.rang,
        automatique: o.auteurId === null,
        auteurId: o.auteurId,
        creeLe: o.maintenant,
      },
    });
  }
  return true;
}

/** « Dès la demande » : crée le recueil de la session, l'envoie, trace la remise. */
export async function lancerRecueil(
  db: Db,
  entree: { readonly sessionId: string; readonly auteurId: string | null },
  envoi: PortEnvoi,
  maintenant: Date = new Date(),
): Promise<ResultatLancement> {
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  if (etat === "eteint") return { etat: "eteint" };

  const session = await db.trainingSession.findUnique({
    where: { id: entree.sessionId },
    select: SELECT_SESSION,
  });
  if (session === null) return { etat: "refuse", message: "Session introuvable." };
  if (!estActifPour(etat, { estTestInterne: session.estTestInterne })) return { etat: "eteint" };

  if (session.clientId === null || session.client === null) {
    return { etat: "refuse", message: "Cette session n'a pas d'entreprise cliente." };
  }
  const email = adresse(session.client.contactEmail);
  if (email === null) {
    return {
      etat: "refuse",
      message:
        "L'entreprise n'a pas d'adresse de contact : renseignez-la sur sa fiche, puis relancez le recueil.",
    };
  }
  if (urlQuestionnaire("00000000-0000-4000-8000-000000000000") === null) {
    return {
      etat: "refuse",
      message: "Aucun lien ne peut être fabriqué (secret d'authentification absent).",
    };
  }

  // Le projet : celui de la session, sinon l'UNIQUE projet ouvert du client.
  let projetId = session.projetId;
  const aRattacher = projetId === null;
  if (projetId === null) {
    const ouverts = await db.projet.findMany({
      where: { clientId: session.clientId, statut: "ouvert", fusionneDansId: null },
      select: { id: true },
      take: 2,
    });
    if (ouverts.length !== 1) {
      return {
        etat: "refuse",
        message:
          ouverts.length === 0
            ? "Aucun projet ouvert chez ce client : créez-le sur sa fiche, puis rattachez la session."
            : "Plusieurs projets ouverts chez ce client : rattachez la session au bon projet.",
      };
    }
    projetId = ouverts[0]!.id;
  }
  const projetCible = projetId;

  const existant = await db.questionnaireCadrage.findFirst({
    where: { projetId: projetCible, modele: MODELE_RECUEIL_BESOIN },
    select: { id: true },
  });
  if (existant !== null) {
    if (aRattacher) {
      await db.trainingSession.updateMany({
        where: { id: session.id, projetId: null },
        data: { projetId: projetCible },
      });
    }
    return { etat: "deja_lance", questionnaireId: existant.id };
  }

  const questionnaireId = await db.$transaction(async (tx) => {
    if (aRattacher) {
      const lie = await tx.trainingSession.updateMany({
        where: { id: session.id, projetId: null },
        data: { projetId: projetCible },
      });
      if (lie.count !== 1) throw new Error("La session vient d'être rattachée à un autre projet.");
    }
    const derniere = await tx.questionnaireCadrage.findFirst({
      where: { projetId: projetCible },
      orderBy: { version: "desc" },
      select: { id: true, version: true, statut: true, mode: true, modele: true },
    });
    if (derniere !== null && derniere.mode === "en_ligne" && derniere.statut === "copie") {
      // Un lien déjà chez le client, sans réponse : il se ferme (comme « Écrire mes questions »).
      const clos = await tx.questionnaireCadrage.updateMany({
        where: { id: derniere.id, statut: "copie", reponseRecueLe: null },
        data: { statut: "clos", closLe: maintenant },
      });
      if (clos.count !== 1) {
        throw new Error("Le client vient de répondre au questionnaire en cours : rechargez.");
      }
    }
    // Les questions déjà préparées depuis les faits (brouillon non envoyé, hors celles de Will).
    const desFaits =
      derniere !== null &&
      derniere.statut === "brouillon" &&
      derniere.modele !== null &&
      derniere.modele !== MODELE_QUESTIONS_DE_WILLIAMS
        ? await tx.questionnaireQuestion.findMany({
            where: { questionnaireId: derniere.id, poseeDeViveVoix: false, ...QUESTIONS_REELLES },
            orderBy: { ordre: "asc" },
            select: { texte: true, typeVise: true, cleVisee: true, faitSourceId: true },
          })
        : [];
    const gabarit = questionsDuGabarit();
    const cree = await tx.questionnaireCadrage.create({
      data: {
        projetId: projetCible,
        clientId: session.clientId as string,
        version: (derniere?.version ?? 0) + 1,
        mode: "en_ligne",
        statut: "copie",
        genereLe: maintenant,
        copieLe: maintenant,
        modele: MODELE_RECUEIL_BESOIN,
        ...(entree.auteurId !== null ? { creeParId: entree.auteurId } : {}),
        questions: {
          create: [
            ...gabarit.map((q) => ({
              ordre: q.ordre,
              texte: chiffrerParole(q.texte),
              typeVise: q.typeVise,
              cleVisee: q.cleVisee,
            })),
            ...desFaits.map((q, i) => ({
              ordre: gabarit.length + i + 1,
              // Déjà chiffré par la passe P6 : recopié tel quel.
              texte: q.texte,
              typeVise: q.typeVise,
              cleVisee: q.cleVisee,
              faitSourceId: q.faitSourceId,
            })),
          ],
        },
      },
      select: { id: true },
    });
    await journaliser(
      tx,
      {
        action: ACTION_RECUEIL_LANCE,
        targetType: "TrainingSession",
        targetId: session.id,
        changes: { questionnaireId: cree.id, projetId: projetCible, rattache: aRattacher },
        session: entree.auteurId === null ? null : { userId: entree.auteurId },
      },
      { exiger: true },
    );
    return cree.id;
  });

  const url = urlQuestionnaire(questionnaireId) as string;
  const envoye = await envoyerEtTracer(
    db,
    envoi,
    {
      sessionId: session.id,
      clientId: session.clientId,
      questionnaireId,
      destinataire: email,
      nomDestinataire: adresse(session.client.contactNom),
      raisonSociale: session.client.raisonSociale,
      titreSession: session.titreSession,
      url,
      rang: 0,
    },
    { auteurId: entree.auteurId, maintenant },
  );
  return { etat: "lance", questionnaireId, envoye };
}

export interface BilanRelances {
  readonly examines: number;
  readonly relances: number;
  readonly premiersEnvois: number;
}

/**
 * Le passage quotidien : renvoie un premier envoi qui n'a pas pu partir, et
 * relance l'entreprise sans réponse après `DELAI_RELANCE_JOURS` jours, deux
 * fois au plus.
 */
export async function relancerRecueils(
  db: Db,
  envoi: PortEnvoi,
  maintenant: Date = new Date(),
): Promise<BilanRelances> {
  const bilan = { examines: 0, relances: 0, premiersEnvois: 0 };
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  if (etat === "eteint") return bilan;

  const ouverts = await db.questionnaireCadrage.findMany({
    where: { modele: MODELE_RECUEIL_BESOIN, mode: "en_ligne", statut: "copie" },
    orderBy: { genereLe: "asc" },
    select: { id: true, projetId: true },
    take: 200,
  });
  for (const q of ouverts) {
    const session = await db.trainingSession.findFirst({
      where: { projetId: q.projetId },
      orderBy: { createdAt: "asc" },
      select: SELECT_SESSION,
    });
    if (session === null || session.client === null) continue;
    if (!estActifPour(etat, { estTestInterne: session.estTestInterne })) continue;
    const email = adresse(session.client.contactEmail);
    const url = urlQuestionnaire(q.id);
    if (email === null || url === null) continue;
    bilan.examines++;

    const base = {
      sessionId: session.id,
      clientId: session.clientId,
      questionnaireId: q.id,
      destinataire: email,
      nomDestinataire: adresse(session.client.contactNom),
      raisonSociale: session.client.raisonSociale,
      titreSession: session.titreSession,
      url,
    };
    const remise = await db.remiseRetour.findFirst({
      where: { sessionId: session.id, objet: OBJET_RECUEIL_BESOIN, nature: "remise" },
      orderBy: { survenuLe: "desc" },
      select: { survenuLe: true },
    });
    if (remise === null) {
      if (await envoyerEtTracer(db, envoi, { ...base, rang: 0 }, { auteurId: null, maintenant })) {
        bilan.premiersEnvois++;
      }
      continue;
    }
    const rangs = await db.relanceJournal.count({
      where: { sessionId: session.id, objet: OBJET_RECUEIL_BESOIN },
    });
    if (rangs >= MAX_RELANCES) continue;
    const derniere = await db.relanceJournal.findFirst({
      where: { sessionId: session.id, objet: OBJET_RECUEIL_BESOIN },
      orderBy: { creeLe: "desc" },
      select: { creeLe: true },
    });
    const dernierContact = Math.max(remise.survenuLe.getTime(), derniere?.creeLe.getTime() ?? 0);
    if (maintenant.getTime() - dernierContact < DELAI_RELANCE_JOURS * JOUR_MS) continue;
    if (
      await envoyerEtTracer(db, envoi, { ...base, rang: rangs + 1 }, { auteurId: null, maintenant })
    ) {
      bilan.relances++;
    }
  }
  return bilan;
}

/**
 * Range le RETOUR de l'entreprise dans le dossier de sa session : une ligne
 * « réponse » rattachée à la remise, datée du jour serveur de la réponse. Une
 * seule par session (le passage quotidien la rattrape sans doublon).
 */
export async function tracerRetours(db: Db): Promise<{ traces: number }> {
  const etat = await lireInterrupteurQualiopi(LOT_RECUEIL, db);
  if (etat === "eteint") return { traces: 0 };
  const repondus = await db.questionnaireCadrage.findMany({
    where: {
      modele: MODELE_RECUEIL_BESOIN,
      statut: "reponse_recue",
      reponseRecueLe: { not: null },
    },
    orderBy: { reponseRecueLe: "asc" },
    select: { id: true, projetId: true, copieLe: true, reponseRecueLe: true },
    take: 200,
  });
  let traces = 0;
  for (const q of repondus) {
    const session = await db.trainingSession.findFirst({
      where: { projetId: q.projetId },
      orderBy: { createdAt: "asc" },
      select: { id: true, estTestInterne: true },
    });
    if (session === null || q.reponseRecueLe === null) continue;
    if (!estActifPour(etat, { estTestInterne: session.estTestInterne })) continue;
    const deja = await db.remiseRetour.findFirst({
      where: { sessionId: session.id, objet: OBJET_RECUEIL_BESOIN, nature: "reponse" },
      select: { id: true },
    });
    if (deja !== null) continue;
    let remise = await db.remiseRetour.findFirst({
      where: { sessionId: session.id, objet: OBJET_RECUEIL_BESOIN, nature: "remise" },
      orderBy: { survenuLe: "asc" },
      select: { id: true },
    });
    if (remise === null) {
      // Le lien est parti sans trace (e-mail non parti, copié à la main) : la remise est rétablie.
      remise = await db.remiseRetour.create({
        data: {
          sessionId: session.id,
          nature: "remise",
          destinataire: "entreprise",
          canal: "autre",
          objet: OBJET_RECUEIL_BESOIN,
          libelle: "Questionnaire de recueil du besoin (remis hors e-mail du site)",
          survenuLe: q.copieLe ?? q.reponseRecueLe,
        },
        select: { id: true },
      });
    }
    await db.remiseRetour.create({
      data: {
        sessionId: session.id,
        nature: "reponse",
        remiseId: remise.id,
        destinataire: "entreprise",
        canal: "espace",
        objet: OBJET_RECUEIL_BESOIN,
        libelle: "Réponses de l'entreprise au questionnaire de recueil du besoin",
        survenuLe: q.reponseRecueLe,
      },
    });
    traces++;
  }
  return { traces };
}
