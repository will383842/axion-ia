/**
 * Lecture et écriture du questionnaire de pré-audit (2026-10-24).
 *
 * Écrivains des tables (verrouillés par le cliquet nominatif) : `deposerQuestionnaire`,
 * `reserverEnvoi`, `annulerEnvoi`, `enregistrerReponse`, `marquerLu`, `clore`,
 * `brouillon.ts` (aucune purge : conservation 5 ans, suppression manuelle, `config.ts`). Aucun n'envoie d'e-mail : seul `envoyer.ts` le fait, sur clic de Will.
 */

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { MessagePourWill } from "@/features/dossier-client/message-affichable";
import {
  codeDirigeantPreauditValide,
  jetonPreauditValide,
} from "@/server/visio/questionnaire-en-ligne/jeton";

import {
  ENVOIS_MAX_PAR_QUESTIONNAIRE,
  lignesDeLaCharge,
  type ChargeValide,
  type ReponseLisible,
} from "./donnees";
import { validerHtml } from "./html";
import { lireLaCharge } from "./lecture";

export { cheminEssaiPreaudit, cheminPreaudit, urlArretRelances, urlPreaudit } from "./liens";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Le lien reçoit des réponses 45 jours après l'envoi, sauf clôture plus tôt par Will. */
export const VALIDITE_JOURS = 45;
/** Deux envois du même questionnaire à moins de 60 s : le second est un double clic. */
export const DELAI_ANTI_DOUBLE_CLIC_MS = 60_000;

/**
 * Le `membre` gardé avec une réponse : JAMAIS le code du dirigeant (il ouvre son brouillon) —
 * masqué en `null`, ni en base, ni dans la console.
 */
export function membreAGarder(
  questionnaireId: string,
  mode: string,
  membre: string | null,
): string | null {
  if (membre === null) return null;
  return mode === "main" && codeDirigeantPreauditValide(questionnaireId, membre) ? null : membre;
}

/** Le questionnaire de ce lien, ou `null` si le jeton est faux ou le questionnaire inconnu. */
export async function lireParJeton(id: string, jeton: string) {
  if (!UUID.test(id.toLowerCase()) || !jetonPreauditValide(id, jeton)) return null;
  return prisma.questionnaireAvantAudit.findUnique({
    where: { id: id.toLowerCase() },
    // La raison sociale s'affiche sur l'accueil du questionnaire (`CONFIG.client`).
    include: { rencontre: { select: { client: { select: { raisonSociale: true } } } } },
  });
}

/** Le lien accepte-t-il encore des réponses réelles ? (envoyé, ni clos, ni expiré) */
export function accepteDesReponses(
  q: { envoyeLe: Date | null; closLe: Date | null; expireLe: Date | null },
  maintenant: Date = new Date(),
): boolean {
  if (q.envoyeLe === null || q.closLe !== null) return false;
  return q.expireLe === null || q.expireLe.getTime() > maintenant.getTime();
}

/**
 * Le mode essai (bouton « Essayer » de la console) : permis tant que le lien n'est ni clos ni
 * expiré, envoyé ou non (audit E2, point 5). Un lien mort ne rend plus son HTML pré-rempli. PUR.
 */
export function essaiPermis(
  q: { closLe: Date | null; expireLe: Date | null },
  maintenant: Date = new Date(),
): boolean {
  if (q.closLe !== null) return false;
  return q.expireLe === null || q.expireLe.getTime() > maintenant.getTime();
}

export async function lireDeLaRencontre(rencontreId: string) {
  return prisma.questionnaireAvantAudit.findUnique({
    where: { rencontreId },
    select: {
      id: true,
      ref: true,
      creeLe: true,
      envoyeLe: true,
      luLe: true,
      closLe: true,
      expireLe: true,
    },
  });
}

export interface ResultatDepot {
  readonly id: string;
  /** Un questionnaire déjà envoyé (sans réponse) a été recréé : l'ancien lien ne marche plus. */
  readonly ancienLienMort: boolean;
  /** E-mails encore en attente avec l'ancien lien, REJETÉS (jamais supprimés). */
  readonly emailsRejetes: number;
}

/**
 * Dépôt du HTML adapté par Will.
 *   · rien d'envoyé : remplacement sur place ;
 *   · déjà envoyé SANS aucune réponse (adresse fausse, e-mail seulement retenu en corbeille) :
 *     la ligne est recréée — nouvel identifiant, donc nouveau jeton : l'ancien lien meurt (404) ;
 *   · déjà envoyé AVEC au moins une réponse : refusé ;
 *   · déjà envoyé avec un BROUILLON en cours (quelqu'un remplit) : refusé aussi — la recréation
 *     effacerait ce brouillon en cascade, et aucune donnée d'un client n'est supprimée sans que
 *     Will l'ait décidé (audit des données du 24/10/2026, point 6).
 *
 * Tout se passe dans UNE transaction qui verrouille la ligne (`FOR UPDATE`) ; `enregistrerReponse`
 * prend le même verrou. Une réponse validée pendant le redépôt attend la fin de la transaction,
 * trouve alors la ligne disparue et est REFUSÉE : elle n'est jamais effacée en silence par la
 * cascade. La suppression est de plus conditionnée à l'absence de réponse (`envois: { none }`).
 */
export async function deposerQuestionnaire(
  rencontreId: string,
  html: string,
): Promise<ResultatDepot> {
  const v = validerHtml(html);
  if (!v.ok) throw new MessagePourWill(v.motif);
  return prisma.$transaction(async (tx): Promise<ResultatDepot> => {
    const existant = await tx.questionnaireAvantAudit.findUnique({
      where: { rencontreId },
      select: { id: true, envoyeLe: true },
    });
    let ancienLienMort = false;
    let emailsRejetes = 0;
    if (existant !== null) {
      await tx.$queryRaw`SELECT id FROM questionnaires_avant_audit WHERE id = ${existant.id}::uuid FOR UPDATE`;
      if (existant.envoyeLe === null) {
        await tx.questionnaireAvantAudit.update({ where: { id: existant.id }, data: { html } });
        return { id: existant.id, ancienLienMort: false, emailsRejetes: 0 };
      }
      const refus = new MessagePourWill(
        "Ce questionnaire a déjà reçu des réponses : il ne peut plus être remplacé. Pour écrire à " +
          "quelqu'un d'autre, déposez un questionnaire sur la rencontre de cette personne.",
      );
      const reponses = await tx.questionnaireAvantAuditEnvoi.count({
        where: { questionnaireId: existant.id },
      });
      if (reponses > 0) throw refus;
      const brouillons = await tx.questionnaireAvantAuditBrouillon.count({
        where: { questionnaireId: existant.id },
      });
      if (brouillons > 0) {
        throw new MessagePourWill(
          "Quelqu'un a déjà commencé à remplir ce questionnaire (brouillon enregistré) : le " +
            "remplacer effacerait ce brouillon, il n'est donc pas remplacé. Attendez sa réponse, " +
            "ou déposez un questionnaire sur la rencontre de la bonne personne.",
        );
      }
      const supprime = await tx.questionnaireAvantAudit.deleteMany({
        where: { id: existant.id, envois: { none: {} }, brouillons: { none: {} } },
      });
      if (supprime.count === 0) throw refus;
      // Les e-mails encore en attente portent l'ancien lien (mort) : REJETÉS, pas supprimés.
      const rejetes = await tx.emailOutbox.updateMany({
        where: {
          entityType: "QuestionnaireAvantAudit",
          entityId: existant.id,
          statut: { in: ["a_valider", "approuve"] },
        },
        data: {
          statut: "refuse",
          refuseAt: new Date(),
          refuseMotif: "Questionnaire redéposé : l'ancien lien n'existe plus.",
        },
      });
      emailsRejetes = rejetes.count;
      ancienLienMort = true;
    }
    const cree = await tx.questionnaireAvantAudit.create({
      data: { rencontreId, html, ref: randomBytes(6).toString("hex") },
      select: { id: true },
    });
    return { id: cree.id, ancienLienMort, emailsRejetes };
  });
}

/** L'état d'avant un envoi, à rétablir tel quel si la mise en file échoue. */
export interface EtatAvantEnvoi {
  envoyeLe: Date | null;
  expireLe: Date | null;
  closLe: Date | null;
  destinataire: string | null;
  destinataireHash: string | null;
}

/**
 * Réserve l'envoi AVANT la mise en file (anti double clic) : n'aboutit que si rien n'est parti
 * depuis moins de 60 s. Garde l'adresse (chiffrée + empreinte) pour l'export et l'effacement.
 * Rend l'état d'avant (pour `annulerEnvoi`), ou `null` si un envoi vient d'avoir lieu.
 *
 * ⛔ Dès qu'un envoi est RÉSERVÉ (`envoyeLe` posé, même si l'e-mail est seulement retenu dans la
 * corbeille), l'adresse est figée : un autre destinataire est refusé. Le lien ne dépend pas de
 * l'adresse, donc l'ancien destinataire pourrait encore répondre ; et l'export/l'effacement
 * retrouvent les réponses du dirigeant par cette adresse OU par la réservation Calendly (risque
 * voisin : une réservation Calendly prise par un TIERS rattache le questionnaire à son adresse).
 * Issue en cas d'adresse fausse : `deposerQuestionnaire` recrée le questionnaire (nouveau lien)
 * tant qu'aucune réponse n'est arrivée.
 */
export async function reserverEnvoi(
  id: string,
  destinataire: string,
  maintenant: Date = new Date(),
): Promise<EtatAvantEnvoi | null> {
  const avant = await prisma.questionnaireAvantAudit.findUnique({
    where: { id },
    select: {
      envoyeLe: true,
      expireLe: true,
      closLe: true,
      destinataire: true,
      destinataireHash: true,
    },
  });
  if (avant === null) return null;
  const hash = hashEmailForLookup(destinataire);
  // Dès qu'un envoi a abouti, l'adresse est FIGÉE (même sans réponse, même si l'effacement du
  // dirigeant a remis l'empreinte à NULL) : le lien ne dépend pas de l'adresse, donc l'ancien
  // destinataire pourrait encore répondre par l'ancien lien et ses réponses se mêleraient à
  // celles du nouveau.
  if (avant.envoyeLe !== null && avant.destinataireHash !== hash) {
    throw new MessagePourWill(
      "Ce questionnaire a déjà été envoyé à une autre adresse. Si l'adresse était fausse et que " +
        "personne n'a encore répondu, déposez-le de nouveau : l'ancien lien cessera de marcher. " +
        "Pour écrire à quelqu'un d'autre, déposez un questionnaire sur la rencontre de cette " +
        "personne.",
    );
  }
  const limite = new Date(maintenant.getTime() - DELAI_ANTI_DOUBLE_CLIC_MS);
  const r = await prisma.questionnaireAvantAudit.updateMany({
    where: { id, OR: [{ envoyeLe: null }, { envoyeLe: { lt: limite } }] },
    data: {
      envoyeLe: maintenant,
      expireLe: new Date(maintenant.getTime() + VALIDITE_JOURS * 86_400_000),
      closLe: null,
      destinataire: chiffrerParole(destinataire),
      destinataireHash: hash,
    },
  });
  return r.count === 1 ? avant : null;
}

/** La mise en file a échoué : on rétablit TOUT l'état d'avant (clôture et adresse comprises). */
export async function annulerEnvoi(id: string, avant: EtatAvantEnvoi): Promise<void> {
  await prisma.questionnaireAvantAudit.update({
    where: { id },
    data: {
      envoyeLe: avant.envoyeLe,
      expireLe: avant.expireLe,
      closLe: avant.closLe,
      destinataire: avant.destinataire,
      destinataireHash: avant.destinataireHash,
    },
  });
}

export type ResultatReponse = "ok" | "doublon" | "ferme" | "trop";

/**
 * Une réponse d'une personne, chiffrée. Refus tant que le lien n'accepte pas de réponses.
 * Même verrou que `deposerQuestionnaire` : si un redépôt est en cours, on attend sa fin, on trouve
 * la ligne disparue, et la réponse est refusée au lieu d'être effacée par la cascade.
 *
 *   · IDEMPOTENT : un renvoi identique (même questionnaire, parcours, `membre` gardé,
 *     `envoyeLe` du navigateur ET contenu identique) ne crée pas de seconde ligne (`doublon`) — délai dépassé, réponse
 *     perdue, la page renvoie ; il ne compte pas dans le plafond ;
 *   · plafond de `ENVOIS_MAX_PAR_QUESTIONNAIRE` lignes (`trop`) ;
 *   · le brouillon du DIRIGEANT n'est supprimé que si sa réponse porte SON code (lien de base sans
 *     code : un salarié qui répond « dirigeant » ne supprime pas le brouillon du dirigeant).
 */
export async function enregistrerReponse(
  q: { id: string },
  charge: ChargeValide,
  maintenant: Date = new Date(),
): Promise<ResultatReponse> {
  return prisma.$transaction(async (tx): Promise<ResultatReponse> => {
    const verrou = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM questionnaires_avant_audit WHERE id = ${q.id}::uuid FOR UPDATE`;
    if (verrou.length === 0) return "ferme";
    const frais = await tx.questionnaireAvantAudit.findUnique({
      where: { id: q.id },
      select: { envoyeLe: true, closLe: true, expireLe: true },
    });
    if (frais === null || !accepteDesReponses(frais, maintenant)) return "ferme";
    const membre = membreAGarder(q.id, charge.mode, charge.membre);
    if (charge.envoyeLe !== null) {
      const memes = await tx.questionnaireAvantAuditEnvoi.findMany({
        where: {
          questionnaireId: q.id,
          mode: charge.mode,
          membre,
          envoyeLeNavigateur: charge.envoyeLe,
        },
        select: { donnees: true },
      });
      // Doublon seulement si le CONTENU est identique, octet pour octet : une version modifiée
      // portant le même `envoyeLe` n'est JAMAIS perdue (elle devient une nouvelle ligne).
      const identique = memes.some((e) => {
        try {
          return dechiffrerParole(e.donnees) === charge.json;
        } catch {
          return false;
        }
      });
      if (identique) return "doublon";
    }
    const n = await tx.questionnaireAvantAuditEnvoi.count({ where: { questionnaireId: q.id } });
    if (n >= ENVOIS_MAX_PAR_QUESTIONNAIRE) return "trop";
    await tx.questionnaireAvantAuditEnvoi.create({
      data: {
        questionnaireId: q.id,
        mode: charge.mode,
        membre,
        envoyeLeNavigateur: charge.envoyeLe,
        infosEmail: charge.infosEmail,
        donnees: chiffrerParole(charge.json),
      },
    });
    // Réponse reçue : le brouillon de cette personne n'a plus lieu d'être (`brouillon.ts`).
    // Dirigeant : seulement si la réponse est AUTHENTIFIÉE par son code.
    const dirigeantAuthentifie =
      charge.mode === "main" &&
      charge.membre !== null &&
      codeDirigeantPreauditValide(q.id, charge.membre);
    if (charge.mode !== "main" || dirigeantAuthentifie) {
      await tx.questionnaireAvantAuditBrouillon.deleteMany({
        where:
          charge.mode === "main"
            ? { questionnaireId: q.id, mode: "main" }
            : { questionnaireId: q.id, mode: charge.mode, membre: charge.membre ?? "" },
      });
    }
    // Une nouvelle réponse repasse la fiche « à traiter » : la lecture précédente est périmée.
    await tx.questionnaireAvantAudit.update({ where: { id: q.id }, data: { luLe: null } });
    return "ok";
  });
}

export async function marquerLu(id: string, userId: string): Promise<void> {
  await prisma.questionnaireAvantAudit.update({
    where: { id },
    data: { luLe: new Date(), luParId: userId },
  });
}

/** « Clore » : le lien ne reçoit plus de réponses (les réponses déjà reçues restent). */
export async function clore(id: string): Promise<void> {
  await prisma.questionnaireAvantAudit.update({ where: { id }, data: { closLe: new Date() } });
}

/**
 * Les réponses, une par personne, déchiffrées pour la console. Une réponse ILLISIBLE (clé absente
 * ou valeur abîmée) reste listée avec `illisible: true` — la console affiche une alerte rouge,
 * jamais une liste vide. Une réponse MISE À L'ÉCART (demande d'effacement d'un salarié) n'est pas
 * déchiffrée : seule sa ligne et l'alerte sont montrées.
 */
export async function lireReponses(questionnaireId: string): Promise<ReponseLisible[]> {
  const lignes = await prisma.questionnaireAvantAuditEnvoi.findMany({
    where: { questionnaireId },
    orderBy: { recuLe: "asc" },
  });
  return lignes.map((e) => {
    const base = {
      id: e.id,
      mode: e.mode as ReponseLisible["mode"],
      membre: membreAGarder(questionnaireId, e.mode, e.membre),
      recuLe: e.recuLe,
      ecarteLe: e.ecarteLe,
      infosEmail: e.infosEmail ?? null,
    };
    if (e.ecarteLe !== null) return { ...base, illisible: false, lignes: [], lecture: null };
    let json: string;
    try {
      json = dechiffrerParole(e.donnees);
      JSON.parse(json);
    } catch {
      return { ...base, illisible: true, lignes: [], lecture: null };
    }
    return {
      ...base,
      illisible: false,
      lignes: lignesDeLaCharge(json),
      lecture: lireLaCharge(json, (m) => codeDirigeantPreauditValide(questionnaireId, m)),
    };
  });
}

export interface QuestionnaireSansRencontre {
  readonly id: string;
  readonly ref: string;
  readonly envoyeLe: Date | null;
  readonly closLe: Date | null;
  readonly reponses: ReadonlyArray<ReponseLisible>;
}

/**
 * Les questionnaires dont la rencontre a été SUPPRIMÉE (`rencontre_id` à NULL depuis le
 * 25/10/2026 : plus d'effacement en cascade) : LECTURE seule, pour que leurs réponses restent
 * visibles, exportables et mises à l'écart à la demande. Rien n'est supprimé ici.
 */
export const SANS_RENCONTRE_PAR_PAGE = 25;

export async function listerQuestionnairesSansRencontre(page = 1): Promise<{
  readonly liste: QuestionnaireSansRencontre[];
  readonly page: number;
  readonly suivante: boolean;
}> {
  const p = Number.isInteger(page) && page >= 1 ? page : 1;
  const qs = await prisma.questionnaireAvantAudit.findMany({
    where: { rencontreId: null },
    select: { id: true, ref: true, envoyeLe: true, closLe: true },
    // Les envoyés d'abord (du plus récent), puis les jamais envoyés ; `id` départage (pages stables).
    orderBy: [{ envoyeLe: { sort: "desc", nulls: "last" } }, { creeLe: "desc" }, { id: "asc" }],
    skip: (p - 1) * SANS_RENCONTRE_PAR_PAGE,
    take: SANS_RENCONTRE_PAR_PAGE + 1,
  });
  const liste = await Promise.all(
    qs.slice(0, SANS_RENCONTRE_PAR_PAGE).map(async (q) => ({
      id: q.id,
      ref: q.ref,
      envoyeLe: q.envoyeLe,
      closLe: q.closLe,
      reponses: await lireReponses(q.id),
    })),
  );
  return { liste, page: p, suivante: qs.length > SANS_RENCONTRE_PAR_PAGE };
}
