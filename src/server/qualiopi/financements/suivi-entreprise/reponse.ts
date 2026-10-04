/**
 * Lot OPCO A8 — les réponses de l'entreprise, par jeton (page publique).
 *
 * 🔴 GET n'écrit JAMAIS : les antivirus de messagerie et les aperçus de liens
 * suivent les adresses des e-mails. Un clic sur « Oui, c'est déposé » ouvre une
 * page de CONFIRMATION ; seul le POST de son formulaire écrit.
 *
 * Jeton : 32 octets aléatoires, conservé en EMPREINTE, à USAGE UNIQUE (une
 * réponse par e-mail) et EXPIRANT. Inconnu, expiré, déjà utilisé, mal formé,
 * interrupteur coupé → la MÊME page neutre : rien ne dit lequel.
 *
 * Effets d'une réponse :
 *   · « Oui, c'est déposé » → `depotFaitLe` = jour de Paris, SANS écraser une
 *     date déjà saisie (par l'admin ou plus tôt) — les relances de dépôt
 *     s'arrêtent d'elles-mêmes (le calendrier passe à la phase « réponse ») ;
 *   · « Accord reçu » → `enregistrerAccordEcrit` (lot A7b) : date écrite +
 *     transition légale vers `accord_recu` par `transitionnerDossier`. Le
 *     MONTANT accordé n'est jamais saisi ici : l'admin le saisit. PDF facultatif,
 *     conservé seulement après un verdict antivirus « sain » ;
 *   · « Refus » → transition légale vers `refuse` quand elle existe, sinon une
 *     note sur le dossier ; dans les deux cas l'alerte `opco_refus_a_traiter`
 *     et la fin des relances ;
 *   · « Pas encore » → noté, les relances continuent.
 */

import { prisma } from "@/lib/prisma";
import { isR2Configured, uploadToR2 } from "@/lib/r2-storage";
import { analyserOctets, type VerdictAntivirus } from "@/server/careers/clamav";
import {
  enregistrerAccordEcrit,
  enregistrerDepotDossier,
  transitionnerDossier,
} from "../dossier-financement";
import { nomOpcoDuClient } from "../opco-referentiel";
import { suiviEntrepriseActif } from "./drapeau";
import { empreinteSiValide } from "./jeton";
import {
  REPONSES_PAR_QUESTION,
  jourDeDate,
  jourParis,
  type QuestionMessage,
  type ReponseEntreprise,
} from "./planning";

export const TAILLE_MAX_ACCORD_OCTETS = 10 * 1024 * 1024;

export interface JetonLu {
  messageId: string;
  suiviId: string;
  dossierId: string;
  question: QuestionMessage;
  intituleFormation: string;
  nomOpco: string;
  /** Le dossier peut être téléchargé (ZIP au stockage, phase de dépôt). */
  dossierTelechargeable: boolean;
  zipKey: string | null;
  zipNom: string | null;
}

export type EtatJeton = { etat: "neutre" } | ({ etat: "valide" } & JetonLu);

const NEUTRE: EtatJeton = { etat: "neutre" };

/**
 * Lit un jeton. `usage: "reponse"` exige un jeton NON utilisé ; `"telechargement"`
 * accepte un jeton déjà répondu (télécharger n'écrit rien), jusqu'à expiration.
 */
export async function lireJeton(
  clair: string,
  usage: "reponse" | "telechargement",
  now: Date = new Date(),
): Promise<EtatJeton> {
  if (!suiviEntrepriseActif()) return NEUTRE;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return NEUTRE;
  const hash = empreinteSiValide(clair);
  if (hash === null) return NEUTRE;
  const m = await prisma.opcoSuiviMessage.findUnique({
    where: { jetonHash: hash },
    select: {
      id: true,
      question: true,
      reponse: true,
      jetonExpireLe: true,
      suivi: {
        select: {
          id: true,
          zipKey: true,
          zipNom: true,
          dossier: {
            select: {
              id: true,
              depotFaitLe: true,
              client: { select: { opco: true, opcoIdentifie: true } },
              trainingSession: {
                select: {
                  titreSession: true,
                  client: { select: { opco: true, opcoIdentifie: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!m || m.jetonExpireLe.getTime() <= now.getTime()) return NEUTRE;
  if (usage === "reponse" && m.reponse !== null) return NEUTRE;
  const dossier = m.suivi.dossier;
  return {
    etat: "valide",
    messageId: m.id,
    suiviId: m.suivi.id,
    dossierId: dossier.id,
    question: m.question as QuestionMessage,
    intituleFormation: dossier.trainingSession?.titreSession ?? "",
    nomOpco: nomOpcoDuClient(dossier.client ?? dossier.trainingSession?.client ?? null),
    dossierTelechargeable: m.suivi.zipKey !== null && dossier.depotFaitLe === null,
    zipKey: m.suivi.zipKey,
    zipNom: m.suivi.zipNom,
  };
}

/** La réponse est-elle permise pour cette question ? */
export function reponseAdmise(question: QuestionMessage, brut: unknown): ReponseEntreprise | null {
  return typeof brut === "string" &&
    (REPONSES_PAR_QUESTION[question] as readonly string[]).includes(brut)
    ? (brut as ReponseEntreprise)
    : null;
}

/** « AAAA-MM-JJ » valide, pas dans le futur (jour de Paris). */
export function dateAccordAdmise(brut: unknown, now: Date): Date | null {
  if (typeof brut !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(brut)) return null;
  const d = new Date(`${brut}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || jourDeDate(d) !== brut) return null;
  if (brut > jourParis(now)) return null;
  return d;
}

export type IssueFichier =
  "aucun" | "conserve" | "refuse_format" | "trop_lourd" | "non_analyse" | "infecte";

export type IssueReponse =
  | { issue: "neutre" }
  | { issue: "invalide"; message: string }
  | { issue: "enregistree"; reponse: ReponseEntreprise; fichier: IssueFichier };

async function journal(dossierId: string, action: string, changes: Record<string, unknown>) {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action,
        targetType: "DossierFinancement",
        targetId: dossierId,
        changes: changes as never,
      },
    });
  } catch (err) {
    console.error(
      `[suivi-entreprise-opco] journal « ${action} » non écrit :`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function ajouterNote(dossierId: string, ligne: string): Promise<void> {
  const d = await prisma.dossierFinancement.findUnique({
    where: { id: dossierId },
    select: { notes: true },
  });
  await prisma.dossierFinancement.update({
    where: { id: dossierId },
    data: { notes: d?.notes ? `${d.notes}\n${ligne}` : ligne },
  });
}

async function conserverAccord(
  dossierId: string,
  messageId: string,
  suiviId: string,
  fichier: Uint8Array | null,
  analyser: (o: Uint8Array) => Promise<VerdictAntivirus>,
): Promise<IssueFichier> {
  if (fichier === null || fichier.length === 0) return "aucun";
  if (fichier.length > TAILLE_MAX_ACCORD_OCTETS) return "trop_lourd";
  if (Buffer.from(fichier.subarray(0, 5)).toString("latin1") !== "%PDF-") return "refuse_format";
  if (!isR2Configured()) return "non_analyse";
  const verdict = await analyser(fichier);
  if (verdict.issue === "infecte") {
    await journal(dossierId, "qualiopi.opco.suivi_entreprise.accord_fichier_infecte", {
      signature: verdict.signature,
    });
    return "infecte";
  }
  // « Indisponible » n'est PAS un verdict : un fichier non analysé n'est pas gardé.
  if (verdict.issue !== "sain") return "non_analyse";
  const cle = `opco-suivi/${dossierId}/accord-${messageId}.pdf`;
  await uploadToR2(cle, fichier, "application/pdf");
  await prisma.opcoSuiviEntreprise.update({
    where: { id: suiviId },
    data: { accordFichierKey: cle },
  });
  return "conserve";
}

/** POST de la page publique : la seule écriture. */
export async function enregistrerReponse(
  input: {
    jeton: string;
    reponse: unknown;
    dateAccord?: unknown;
    fichier?: Uint8Array | null;
  },
  now: Date = new Date(),
  analyser: (o: Uint8Array) => Promise<VerdictAntivirus> = analyserOctets,
): Promise<IssueReponse> {
  const lu = await lireJeton(input.jeton, "reponse", now);
  if (lu.etat !== "valide") return { issue: "neutre" };
  const reponse = reponseAdmise(lu.question, input.reponse);
  if (reponse === null) return { issue: "neutre" };
  let dateAccord: Date | null = null;
  if (reponse === "accord") {
    dateAccord = dateAccordAdmise(input.dateAccord, now);
    if (dateAccord === null) {
      return {
        issue: "invalide",
        message: "Indiquez la date portée sur l'accord (elle ne peut pas être dans le futur).",
      };
    }
  }

  // Consommation ATOMIQUE du jeton : deux POST concurrents, un seul écrit.
  const { count } = await prisma.opcoSuiviMessage.updateMany({
    where: { id: lu.messageId, reponse: null, jetonExpireLe: { gt: now } },
    data: { reponse, reponduLe: now },
  });
  if (count === 0) return { issue: "neutre" };

  const dossier = await prisma.dossierFinancement.findUniqueOrThrow({
    where: { id: lu.dossierId },
    select: { statut: true, depotFaitLe: true, accordEcritLe: true, accordAt: true },
  });
  // Relecture A8 (E1) : un accord déjà acté (par l'admin ou un lien précédent)
  // n'est JAMAIS réécrit par un lien encore valide — même règle que la date de dépôt.
  const accordDejaActe =
    dossier.accordEcritLe != null ||
    dossier.accordAt != null ||
    ["accord_recu", "facture", "paiement_recu", "clos"].includes(dossier.statut);
  const effets: Record<string, unknown> = { question: lu.question, reponse };
  let fichier: IssueFichier = "aucun";

  if (reponse === "oui") {
    if (dossier.depotFaitLe === null && dossier.statut !== "clos") {
      // Jour civil de Paris, écrit comme une saisie de la console (minuit UTC).
      await enregistrerDepotDossier({
        dossierId: lu.dossierId,
        depotFaitLe: new Date(`${jourParis(now)}T00:00:00.000Z`),
      });
      effets["depotFaitLe"] = jourParis(now);
    } else {
      // Une date déjà saisie (par l'admin) n'est JAMAIS écrasée.
      effets["depotFaitLeConserve"] = dossier.depotFaitLe ? jourDeDate(dossier.depotFaitLe) : null;
    }
  } else if (reponse === "accord" && dateAccord !== null && accordDejaActe) {
    effets["accordEcritLeConserve"] = dossier.accordEcritLe
      ? jourDeDate(dossier.accordEcritLe)
      : null;
  } else if (reponse === "accord" && dateAccord !== null) {
    try {
      const r = await enregistrerAccordEcrit({
        dossierId: lu.dossierId,
        accordEcritLe: dateAccord,
      });
      effets["accordEcritLe"] = jourDeDate(dateAccord);
      effets["transitions"] = r.transitions;
    } catch (err) {
      // Statut qui ne permet pas d'acter l'accord (dossier refusé, clos…) : la
      // réponse est gardée, les relances s'arrêtent, l'admin tranche.
      effets["accordNonActe"] = err instanceof Error ? err.message : String(err);
      await prisma.opcoSuiviEntreprise.update({
        where: { id: lu.suiviId },
        data: { relancesArreteesLe: now },
      });
    }
    fichier = await conserverAccord(
      lu.dossierId,
      lu.messageId,
      lu.suiviId,
      input.fichier ?? null,
      analyser,
    );
    effets["fichier"] = fichier;
  } else if (reponse === "refus") {
    await prisma.opcoSuiviEntreprise.update({
      where: { id: lu.suiviId },
      data: { refusDeclareLe: now },
    });
    const chemin: ("envoye" | "refuse")[] =
      dossier.statut === "envoye"
        ? ["refuse"]
        : dossier.statut === "a_monter" && dossier.depotFaitLe !== null
          ? ["envoye", "refuse"]
          : [];
    try {
      for (const vers of chemin) await transitionnerDossier({ dossierId: lu.dossierId, vers });
      effets["transitions"] = chemin;
    } catch (err) {
      effets["transitionImpossible"] = err instanceof Error ? err.message : String(err);
    }
    if (chemin.length === 0 || effets["transitionImpossible"] !== undefined) {
      await ajouterNote(
        lu.dossierId,
        `[${jourParis(now).split("-").reverse().join("/")}] Refus de l'OPCO déclaré par l'entreprise (lien de suivi) : à vérifier.`,
      );
    }
  }

  await journal(lu.dossierId, "qualiopi.opco.suivi_entreprise.reponse_recue", effets);
  return { issue: "enregistree", reponse, fichier };
}
