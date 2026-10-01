/**
 * Le questionnaire de cadrage EN LIGNE, côté client (2026-10-01).
 *
 * Will met un lien secret sous un bouton de son e-mail ; le client répond sur
 * `/questionnaire/<id>/<jeton>` ; à l'envoi, ses réponses s'écrivent dans le
 * questionnaire DU PROJET — exactement là où Will colle aujourd'hui une
 * réponse reçue par e-mail (`enregistrerReponses`, `gestes-suivi.ts`), avec la
 * même écriture chiffrée (`chiffrerParole`, `MAX_REPONSE`).
 *
 * Ce que ce module garantit, et que ses tests verrouillent :
 *
 *   · le JETON est vérifié avant toute lecture de la base (`jetonValide`) ;
 *   · aucune requête au build (`stub.invalid`) : la page dit « lien invalide » ;
 *   · seul un questionnaire `en_ligne` + `copie` s'ouvre — c'est le geste
 *     « Lien du questionnaire en ligne » de Will qui l'ouvre, rien d'autre ;
 *   · une version DÉPASSÉE (une plus récente existe pour le projet) ne s'ouvre
 *     plus : ses réponses seraient invisibles dans la console (B3) ;
 *   · un dossier VIDÉ par l'effacement RGPD (texte de question vide) ne s'ouvre
 *     plus et ne se remplit plus (B4) ;
 *   · les questions « posées de vive voix » et la ligne « Qui répond ? » ne
 *     sont jamais montrées ;
 *   · seules les questions DE CE questionnaire s'écrivent (IDOR), relues DANS la
 *     transaction après le verrou : si Will les a remplacées entre-temps, rien
 *     n'est validé (`questions_changees`, B1) ;
 *   · l'envoi est DÉFINITIF et UNIQUE : `copie → reponse_recue` est un
 *     `updateMany` conditionnel, le second envoi ne trouve plus de ligne ;
 *   · la lecture par l'IA (`lire_reponses`) n'est programmée que si le drapeau
 *     la permet, comme pour une réponse collée — mais la saisie du client, elle,
 *     n'attend pas le drapeau : ce n'est pas un traitement IA.
 *
 * La limite de débit (par IP hachée) et l'e-mail interne vivent dans l'action
 * serveur de la page (`app/questionnaire/[id]/[jeton]/actions.ts`) : ils lisent
 * la requête et la file d'envoi, que ce module n'importe pas.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { rencontreDAncrage } from "../ancrage";
import { modeEnregistrement, type ModeEnregistrement } from "../drapeau";
import { estRencontreDeTest, iaALaDemandePermise } from "../ia-a-la-demande";
import { planifierDans } from "../prise-d-etape";
import {
  MAX_CHAMPS_ENVOI,
  MAX_REPONSE,
  ORDRE_QUI_REPOND,
  QUESTIONS_REELLES,
  TEXTE_QUI_REPOND,
} from "./constantes";
import { jetonValide } from "./jeton";
import { nettoyerQuiRepond, sansControle } from "./regles";

type Db = PrismaClient;

/** La base est-elle le stub du build (`AGENTS.md`, contrat `stub.invalid`) ? */
export function baseFactice(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export interface QuestionPublique {
  readonly id: string;
  readonly ordre: number;
  readonly texte: string;
}

export type EtatPublic =
  | { readonly etat: "introuvable" }
  | { readonly etat: "deja_envoye" }
  | { readonly etat: "ouvert"; readonly questions: ReadonlyArray<QuestionPublique> };

const INTROUVABLE: EtatPublic = { etat: "introuvable" };

/** Les questions montrées au client : ni vive voix, ni « qui répond », ni vidées. */
const QUESTIONS_DU_CLIENT = {
  ...QUESTIONS_REELLES,
  poseeDeViveVoix: false,
  NOT: { texte: "" },
} as const;

/** Ce que les deux fonctions lisent du questionnaire, pour décider s'il s'ouvre. */
const SELECT_ETAT = {
  id: true,
  statut: true,
  mode: true,
  version: true,
  clientId: true,
  projetId: true,
  // B4 : une question vidée par l'effacement RGPD ferme tout le questionnaire.
  _count: { select: { questions: { where: { texte: "" } } } },
} as const;

type EtatLu = {
  statut: "brouillon" | "copie" | "reponse_recue" | "clos";
  mode: "a_copier" | "en_ligne";
  _count: { questions: number };
};

/** `ouvert`, `deja_envoye` ou `introuvable`, selon l'état lu (sans la version). */
function verdict(q: EtatLu | null): "ouvert" | "deja_envoye" | "introuvable" {
  if (!q || q.mode !== "en_ligne" || q._count.questions > 0) return "introuvable";
  if (q.statut === "reponse_recue") return "deja_envoye";
  return q.statut === "copie" ? "ouvert" : "introuvable";
}

/** B3 : une version plus récente existe-t-elle pour ce projet ? */
async function versionDepassee(
  db: Pick<Db, "questionnaireCadrage">,
  projetId: string,
  version: number,
): Promise<boolean> {
  const plusRecente = await db.questionnaireCadrage.findFirst({
    where: { projetId, version: { gt: version } },
    select: { id: true },
  });
  return plusRecente !== null;
}

/**
 * Ce que la page publique peut montrer. Le jeton d'abord : un lien forgé ne
 * coûte aucune requête, et ne distingue pas « inconnu » de « clos ».
 */
export async function lireQuestionnairePublic(
  db: Pick<Db, "questionnaireCadrage" | "questionnaireQuestion">,
  questionnaireId: string,
  jeton: string,
): Promise<EtatPublic> {
  if (!jetonValide(questionnaireId, jeton)) return INTROUVABLE;
  if (baseFactice()) return INTROUVABLE;
  const q = await db.questionnaireCadrage.findUnique({
    where: { id: questionnaireId.toLowerCase() },
    select: SELECT_ETAT,
  });
  const v = verdict(q);
  if (v === "introuvable" || q === null) return INTROUVABLE;
  if (await versionDepassee(db, q.projetId, q.version)) return INTROUVABLE;
  if (v === "deja_envoye") return { etat: "deja_envoye" };
  const questions = await db.questionnaireQuestion.findMany({
    where: { questionnaireId: q.id, ...QUESTIONS_DU_CLIENT },
    orderBy: { ordre: "asc" },
    select: { id: true, ordre: true, texte: true },
  });
  if (questions.length === 0) return INTROUVABLE;
  try {
    return {
      etat: "ouvert",
      questions: questions.map((x) => ({
        id: x.id,
        ordre: x.ordre,
        texte: dechiffrerParole(x.texte),
      })),
    };
  } catch {
    // Une question illisible (clé absente) : on ne montre pas une page à trous.
    return INTROUVABLE;
  }
}

export type IssueEnvoi =
  | {
      readonly issue: "enregistre";
      readonly clientId: string;
      readonly projetId: string;
      readonly lecturePrevue: boolean;
    }
  | { readonly issue: "introuvable" }
  | { readonly issue: "deja_envoye" }
  | { readonly issue: "vide" }
  /** Will a remplacé les questions pendant que le client répondait : rien n'est écrit. */
  | { readonly issue: "questions_changees" };

/** Levées dans la transaction : elles l'annulent, rien n'est écrit. */
class Annule extends Error {
  constructor(readonly issue: "deja_envoye" | "introuvable" | "questions_changees") {
    super(issue);
  }
}

/** Les identifiants des questions montrées au client pour ce questionnaire. */
async function questionsAdmises(
  db: Pick<Db, "questionnaireQuestion">,
  questionnaireId: string,
): Promise<Set<string>> {
  const lignes = await db.questionnaireQuestion.findMany({
    where: { questionnaireId, ...QUESTIONS_DU_CLIENT },
    select: { id: true },
  });
  return new Set(lignes.map((x) => x.id));
}

/**
 * La rencontre d'ancrage, si la lecture IA y est permise (même règle que la
 * réponse collée par Will : `iaALaDemandePermise`) ; `null` sinon.
 */
async function lecturePermise(
  db: Pick<Db, "rencontre">,
  clientId: string,
  projetId: string,
  mode: ModeEnregistrement,
): Promise<string | null> {
  const ancrage = await rencontreDAncrage(db, clientId, projetId);
  if (ancrage === null) return null;
  const test = mode === "pilote" ? await estRencontreDeTest(db, ancrage) : false;
  return iaALaDemandePermise(mode, test) ? ancrage : null;
}

/**
 * Enregistre les réponses du client. Une question sans réponse garde `null`
 * (les questions sans réponse ne sont pas bloquantes) ; un envoi entièrement
 * vide est refusé (`vide`), sans rien écrire.
 */
export async function enregistrerReponsesEnLigne(
  db: Db,
  a: {
    readonly questionnaireId: string;
    readonly jeton: string;
    /** Identifiant de question → texte saisi. */
    readonly reponses: ReadonlyMap<string, string>;
    /** « Qui répond ? (nom et fonction) », facultatif. */
    readonly repondant: string;
  },
  o: { readonly mode?: ModeEnregistrement } = {},
): Promise<IssueEnvoi> {
  if (!jetonValide(a.questionnaireId, a.jeton)) return { issue: "introuvable" };
  if (baseFactice()) return { issue: "introuvable" };
  // Borne AVANT la base : un formulaire légitime n'a jamais autant de champs.
  if (a.reponses.size > MAX_CHAMPS_ENVOI) return { issue: "introuvable" };

  const q = await db.questionnaireCadrage.findUnique({
    where: { id: a.questionnaireId.toLowerCase() },
    select: SELECT_ETAT,
  });
  const v = verdict(q);
  if (v === "introuvable" || q === null) return { issue: "introuvable" };
  if (await versionDepassee(db, q.projetId, q.version)) return { issue: "introuvable" };
  if (v === "deja_envoye") return { issue: "deja_envoye" };

  // Les questions de CE questionnaire : une question d'ailleurs n'est jamais écrite (IDOR).
  const admises = await questionsAdmises(db, q.id);
  const utiles: Array<[string, string]> = [];
  for (const [id, texte] of a.reponses) {
    if (!admises.has(id)) continue;
    const propre = sansControle(texte).trim().slice(0, MAX_REPONSE);
    if (propre !== "") utiles.push([id, propre]);
  }
  if (utiles.length === 0) return { issue: "vide" };
  const repondant = nettoyerQuiRepond(a.repondant);

  const ancrage = await lecturePermise(db, q.clientId, q.projetId, o.mode ?? modeEnregistrement());
  const maintenant = new Date();
  let ecrites = 0;
  try {
    await db.$transaction(async (tx) => {
      // 🔑 L'envoi UNIQUE, et le VERROU de la ligne (B1) : seul le premier envoi
      // trouve la ligne à passer ; « Écrire mes questions » attend ce verrou.
      const passe = await tx.questionnaireCadrage.updateMany({
        where: { id: q.id, statut: "copie", mode: "en_ligne" },
        data: { statut: "reponse_recue", reponseRecueLe: maintenant },
      });
      if (passe.count !== 1) throw new Annule("deja_envoye");
      // B3, revérifié sous le verrou.
      if (await versionDepassee(tx, q.projetId, q.version)) throw new Annule("introuvable");
      // B1 : les questions sont relues SOUS le verrou. Si Will les a remplacées
      // entre la lecture et ici, une réponse viserait une question disparue :
      // rien n'est validé, la page se recharge avec les nouvelles questions.
      const encore = await questionsAdmises(tx, q.id);
      if (utiles.some(([id]) => !encore.has(id))) throw new Annule("questions_changees");
      for (const [id, texte] of utiles) {
        // `questionnaireId` dans le filtre : l'écriture revérifie l'appartenance.
        const r = await tx.questionnaireQuestion.updateMany({
          where: { id, questionnaireId: q.id, ...QUESTIONS_DU_CLIENT },
          data: { reponse: chiffrerParole(texte), reponseRecueLe: maintenant },
        });
        ecrites += r.count;
      }
      if (ecrites !== utiles.length) throw new Annule("questions_changees");
      if (repondant !== "") {
        await tx.questionnaireQuestion.upsert({
          where: { questionnaireId_ordre: { questionnaireId: q.id, ordre: ORDRE_QUI_REPOND } },
          create: {
            questionnaireId: q.id,
            ordre: ORDRE_QUI_REPOND,
            texte: chiffrerParole(TEXTE_QUI_REPOND),
            typeVise: "autre",
            poseeDeViveVoix: true,
            reponse: chiffrerParole(repondant),
            reponseRecueLe: maintenant,
          },
          update: { reponse: chiffrerParole(repondant), reponseRecueLe: maintenant },
        });
      }
      if (ancrage !== null) {
        await planifierDans(tx, ancrage, {
          etape: "lire_reponses",
          compteRenduId: null,
          reinitialiser: true,
        });
      }
    });
  } catch (e) {
    if (e instanceof Annule) return { issue: e.issue };
    throw e;
  }
  return {
    issue: "enregistre",
    clientId: q.clientId,
    projetId: q.projetId,
    lecturePrevue: ancrage !== null,
  };
}
