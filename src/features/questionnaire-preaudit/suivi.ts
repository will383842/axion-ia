/**
 * Le SEUL expéditeur automatique du questionnaire avant audit (2026-10-26) : relances J+2/J+5/J+10,
 * confirmations de réception, messages du salon Telegram « Questionnaire audit », essais demandés
 * depuis la console. Appelé par le balayage du worker (`visio-balayage-worker.ts`), toutes les
 * 5 minutes. Tout part du clic « Envoyer » de Will : sans suivi écrit par ce clic, rien ne part.
 *
 * Ordre d'un passage (plan « e-mails, relances, Telegram » §5 D1) :
 *   E. essais demandés par Will → à l'adresse d'essai SEULEMENT (`QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI`) ;
 *   0. les trois interrupteurs éteints → fin ; `refusReel()` → fin ;
 *   1. J0 (premier `email_logs.sentAt` réel de l'invitation) → les 3 relances et « invitation partie » ;
 *   2. réponses reçues → confirmation à la personne et message « réponse reçue » ;
 *   3. arrêts (réponse du dirigeant, clos, expiré, rebond, arrêt posé) → relances annulées ;
 *   4. courriers dus → prise atomique, relecture de l'état, envoi, journal.
 *
 * Interrupteurs (`drapeaux-suivi.ts`) : "true" écrit et envoie ; "essai" COMPTE seulement (rien
 * n'est écrit, rien ne part, des nombres au journal) ; absent ou autre = éteint.
 *
 * Idempotence : `cle` UNIQUE par courrier (`createMany({ skipDuplicates })`), prise atomique
 * (`updateMany where statut`), `jobId` déterministe (`preaudit-<cle>`) contrôlé dans `email_logs`
 * avant tout nouvel envoi. Jamais de rafale : une relance en retard de plus de 24 h (48 h pour une
 * confirmation) est annulée. Fenêtre résiduelle ACCEPTÉE : une relance déjà mise en file part même
 * si le dirigeant répond dans la minute (limiteur de la file e-mail).
 *
 * Deux conteneurs : le worker peut tourner AVANT la migration (`P2021`/`P2022`) → fin silencieuse.
 * Journaux : des NOMBRES seulement, jamais un nom ni une adresse. Rien n'est jamais supprimé.
 * ⛔ La case « recevoir des informations par e-mail » n'est JAMAIS lue ici : elle ne vaut pas
 * accord pour une relance (cliquet `aucun-envoi-automatique.spec.ts`).
 */

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { SITE_URL } from "@/lib/site-url";
import { questionnaireAvantAuditSubject } from "@/lib/email/templates/questionnaire-avant-audit";
import { questionnaireAvantAuditRelanceSubject } from "@/lib/email/templates/questionnaire-avant-audit-relance";
import { questionnaireAvantAuditConfirmationSubject } from "@/lib/email/templates/questionnaire-avant-audit-confirmation";
import { prenomEtInitiale } from "@/server/notifications/personne";
import type { NotifyInput, NotifyResult } from "@/server/notifications/types";
import type { EmailJobName } from "@/server/queue/types";
import type { PrismaClient } from "../../../prisma/generated/client";

import {
  formaterAuditCourt,
  formaterAuditTexte,
  formaterJourMois,
  formaterProchaine,
  planifierRelances,
  prochainCreneauRelance,
  dansCreneauRelance,
} from "./calendrier";
import { mentionsRgpd, preauditActif, refusReel } from "./config";
import {
  adresseEssai,
  modeConfirmations,
  modeRelances,
  modeTelegram,
  type ModeSuivi,
} from "./drapeaux-suivi";
import { cheminEssaiPreaudit, urlArretRelances, urlPreaudit } from "./liens";

type Env = Readonly<Record<string, string | undefined>>;

export type BaseSuivi = Pick<
  PrismaClient,
  | "questionnaireAvantAuditSuivi"
  | "questionnaireAvantAuditCourrier"
  | "questionnaireAvantAudit"
  | "questionnaireAvantAuditEnvoi"
  | "questionnaireAvantAuditBrouillon"
  | "emailLog"
>;

export interface ResultatFile {
  readonly enqueued: boolean;
  readonly garePourValidation?: boolean;
  readonly retenu?: string;
  readonly corbeilleIndisponible?: boolean;
  readonly essaiBloque?: boolean;
}

export type Enfiler = (
  template: EmailJobName,
  to: string,
  locale: "fr",
  payload: Record<string, unknown>,
  options: {
    jobId: string;
    entityType: string;
    entityId: string;
    clientId?: string | null;
    sujet?: string;
    sujetForce?: string;
  },
) => Promise<ResultatFile>;

export type Notifier = (input: NotifyInput) => Promise<NotifyResult>;

export interface DepsSuivi {
  readonly maintenant: Date;
  readonly env?: Env;
  readonly enfiler?: Enfiler;
  readonly notifier?: Notifier;
}

export interface BilanSuivi {
  readonly modes: { relances: ModeSuivi; confirmations: ModeSuivi; telegram: ModeSuivi };
  refuse: boolean;
  migrationAbsente: boolean;
  essais: number;
  crees: number;
  envoyes: number;
  annules: number;
  retenus: number;
  echecs: number;
  /** Mode « essai » : ce qui SERAIT fait (rien n'est écrit). */
  seraientCrees: number;
  seraientEnvoyes: number;
}

export const TEMPLATE_INVITATION = "questionnaire-avant-audit";
const TEMPLATE_RELANCE = "questionnaire-avant-audit-relance";
const TEMPLATE_CONFIRMATION = "questionnaire-avant-audit-confirmation";
const ENTITE_Q = "QuestionnaireAvantAudit";
const ENTITE_ENVOI = "QuestionnaireAvantAuditEnvoi";
const ENTITE_ESSAI = "QuestionnaireAvantAuditEssai";

const QUINZE_MIN = 15 * 60 * 1000;
const UN_JOUR = 24 * 60 * 60 * 1000;
const DUS_PAR_PASSAGE = 20;
const CONFIRMATIONS_MAX_PAR_QUESTIONNAIRE = 70;
const TENTATIVES_EMAIL_MAX = 3;
const TENTATIVES_TELEGRAM_MAX = 5;

export const NATURES_RELANCE = ["relance_1", "relance_2", "relance_3"] as const;
type NatureRelance = (typeof NATURES_RELANCE)[number];
const estRelance = (n: string): n is NatureRelance =>
  (NATURES_RELANCE as readonly string[]).includes(n);
const estConfirmation = (n: string) =>
  n === "confirmation_dirigeant" || n === "confirmation_collaborateur";
const estTelegram = (n: string) => n.startsWith("telegram_");

/** `jobId` déterministe d'un courrier (les « : » ne passent pas dans BullMQ). PUR. */
export const jobIdDe = (cle: string) => `preaudit-${cle.replace(/:/g, "-")}`;

let migrationSignalee = false;
function estMigrationAbsente(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
}

function texte(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t !== "" && t.length <= max ? t : undefined;
}

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** La charge déchiffrée d'une réponse, ou `null` (illisible). Jamais journalisée. */
function lireCharge(chiffre: string): {
  donnees: Record<string, unknown>;
  traitement: boolean;
} | null {
  try {
    const o = JSON.parse(dechiffrerParole(chiffre)) as {
      donnees?: unknown;
      consentements?: { traitement?: unknown };
    };
    const d =
      typeof o.donnees === "object" && o.donnees !== null && !Array.isArray(o.donnees)
        ? (o.donnees as Record<string, unknown>)
        : {};
    return { donnees: d, traitement: o.consentements?.traitement === true };
  } catch {
    return null;
  }
}

const INFORMATIQUE_INTERNE = ["Nous-mêmes, directement", "Personne en particulier"];

/** Réponses attendues : 1 (dirigeant) + son équipe + 1 si l'informatique est déléguée. PUR. */
export function reponsesAttendues(donneesDirigeant: Record<string, unknown> | null): number | null {
  if (donneesDirigeant === null) return null;
  const equipe = Array.isArray(donneesDirigeant["equipe"]) ? donneesDirigeant["equipe"].length : 0;
  const it = texte(donneesDirigeant["dat_it"], 300);
  const delegue = it !== undefined && !INFORMATIQUE_INTERNE.includes(it) ? 1 : 0;
  return 1 + equipe + delegue;
}

function premierMot(nom: string | null | undefined): string | undefined {
  const m = (nom ?? "").trim().split(/\s+/)[0];
  if (!m || m.includes("@") || m.length > 40) return undefined;
  return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
}

interface Contexte {
  readonly base: BaseSuivi;
  readonly env: Env;
  readonly maintenant: Date;
  readonly enfiler: Enfiler;
  readonly notifier: Notifier;
  readonly bilan: BilanSuivi;
}

/** Ce que l'on sait d'un questionnaire au moment d'envoyer (relu à CHAQUE envoi). */
interface EtatQuestionnaire {
  readonly id: string;
  readonly ref: string;
  readonly rencontreId: string | null;
  readonly clientId: string | null;
  readonly destinataire: string | null;
  readonly destinataireHash: string | null;
  readonly closLe: Date | null;
  readonly expireLe: Date | null;
  readonly societe: string;
  readonly prenom: string | undefined;
  readonly suivi: {
    readonly id: string;
    readonly relancesDemandees: boolean;
    readonly dateAudit: Date | null;
    readonly lieuAudit: string | null;
    readonly premierEnvoiLe: Date | null;
    readonly relancesArreteesLe: Date | null;
  } | null;
  readonly dirigeantARepondu: boolean;
  readonly donneesDirigeant: Record<string, unknown> | null;
  readonly recues: number;
}

async function lireEtat(ctx: Contexte, questionnaireId: string): Promise<EtatQuestionnaire | null> {
  const q = await ctx.base.questionnaireAvantAudit.findUnique({
    where: { id: questionnaireId },
    select: {
      id: true,
      ref: true,
      rencontreId: true,
      destinataire: true,
      destinataireHash: true,
      closLe: true,
      expireLe: true,
      rencontre: {
        select: {
          clientId: true,
          client: { select: { raisonSociale: true, contactNom: true, contactEmail: true } },
          calendlyEvent: { select: { inviteeName: true, inviteeEmail: true } },
        },
      },
      suivi: {
        select: {
          id: true,
          relancesDemandees: true,
          dateAudit: true,
          lieuAudit: true,
          premierEnvoiLe: true,
          relancesArreteesLe: true,
        },
      },
      envois: {
        where: { ecarteLe: null },
        select: { mode: true, donnees: true, recuLe: true },
        orderBy: { recuLe: "asc" },
      },
    },
  });
  if (q === null) return null;
  let destinataire: string | null = null;
  try {
    destinataire = q.destinataire === null ? null : dechiffrerParole(q.destinataire);
  } catch {
    destinataire = null;
  }
  const mains = q.envois.filter((e) => e.mode === "main");
  const dernierMain = mains[mains.length - 1];
  const donneesDirigeant = dernierMain ? (lireCharge(dernierMain.donnees)?.donnees ?? null) : null;
  // Le prénom de l'e-mail : celui de la réservation ou du contact de la fiche, SEULEMENT si leur
  // adresse est celle à qui Will a envoyé le lien. Sinon « Bonjour, ».
  const ev = q.rencontre?.calendlyEvent ?? null;
  const client = q.rencontre?.client ?? null;
  const memeAdresse = (a: string | null | undefined) =>
    q.destinataireHash !== null && hashEmailForLookup(a ?? null) === q.destinataireHash;
  const prenom = memeAdresse(ev?.inviteeEmail)
    ? premierMot(ev?.inviteeName)
    : memeAdresse(client?.contactEmail)
      ? premierMot(client?.contactNom)
      : undefined;
  const societe =
    texte(client?.raisonSociale, 120) ??
    texte(donneesDirigeant?.["ent_nom"], 120) ??
    "Société inconnue";
  return {
    id: q.id,
    ref: q.ref,
    rencontreId: q.rencontreId,
    clientId: q.rencontre?.clientId ?? null,
    destinataire,
    destinataireHash: q.destinataireHash,
    closLe: q.closLe,
    expireLe: q.expireLe,
    societe,
    prenom,
    suivi: q.suivi,
    dirigeantARepondu: mains.length > 0,
    donneesDirigeant,
    recues: q.envois.length,
  };
}

const cheminConsole = (rencontreId: string | null) =>
  rencontreId === null
    ? "rendez-vous?vue=questionnaires"
    : `rendez-vous/rencontres/${rencontreId}#questionnaire-avant-audit`;

const ecrit = (m: ModeSuivi) => m === "actif";
const actif = (m: ModeSuivi) => m !== "eteint";

// ── E. Essais ────────────────────────────────────────────────────────────────

const NATURES_ESSAI = [
  "invitation",
  "relance_1",
  "relance_2",
  "relance_3",
  "confirmation_dirigeant",
  "confirmation_collaborateur",
  "telegram_reponse",
  "telegram_suivi",
] as const;

async function passerEssais(ctx: Contexte): Promise<void> {
  const essais = await ctx.base.questionnaireAvantAuditCourrier.findMany({
    where: { nature: "essai", statut: "prevu", prevuLe: { lte: ctx.maintenant } },
    orderBy: { prevuLe: "asc" },
    take: DUS_PAR_PASSAGE,
    select: { id: true, cle: true, questionnaireId: true, essaiDe: true, tentatives: true },
  });
  for (const c of essais) {
    if (!(await prendre(ctx, c.id, "prevu"))) continue;
    const fin = (statut: string, motif: string | null) =>
      ctx.base.questionnaireAvantAuditCourrier.update({
        where: { id: c.id },
        data: { statut, motif, faitLe: ctx.maintenant },
      });
    const de = (NATURES_ESSAI as readonly string[]).includes(c.essaiDe ?? "") ? c.essaiDe! : null;
    if (de === null || c.questionnaireId === null) {
      await fin("echec", "essai invalide");
      ctx.bilan.echecs++;
      continue;
    }
    const etat = await lireEtat(ctx, c.questionnaireId);
    if (etat === null) {
      await fin("annule", "questionnaire supprimé");
      ctx.bilan.annules++;
      continue;
    }
    if (estTelegram(de)) {
      const r = await ctx.notifier(
        payloadTelegram(etat, de === "telegram_reponse" ? "reponse" : "invitation", {
          essai: true,
          prochaine: undefined,
        }),
      );
      const parti = r.channels.telegram === "sent" || r.deduped === true;
      await fin(parti ? "envoye" : "echec", parti ? null : "Telegram indisponible");
      if (parti) ctx.bilan.essais++;
      else ctx.bilan.echecs++;
      continue;
    }
    const a = adresseEssai(ctx.env);
    if (a === null) {
      await fin("echec", "adresse d'essai absente");
      ctx.bilan.echecs++;
      continue;
    }
    const chemin = cheminEssaiPreaudit(etat.id);
    const arret = urlArretRelances(etat.id);
    if (chemin === null || arret === null) {
      await fin("echec", "lien_impossible");
      ctx.bilan.echecs++;
      continue;
    }
    const lien = `${SITE_URL}${chemin}`;
    // Le lien d'arrêt d'un essai ne doit rien écrire : la page lit `essai=1`.
    const lienArret = `${arret}?essai=1`;
    const { template, payload } = gabaritEtPayload(etat, de, {
      lien,
      lienArret,
      brouillonEnCours: false,
      role: de === "confirmation_collaborateur" ? "collaborateur" : "dirigeant",
      prenomRepondant: etat.prenom,
      recuLe: ctx.maintenant,
      env: ctx.env,
    });
    const r = await ctx.enfiler(template, a, "fr", payload, {
      jobId: jobIdDe(c.cle),
      entityType: ENTITE_ESSAI,
      entityId: etat.id,
      sujetForce: `[ESSAI] ${sujetDe(template, payload)}`,
    });
    const issue = issueFile(r);
    await fin(issue.statut, issue.motif);
    if (issue.statut === "envoye") ctx.bilan.essais++;
    else ctx.bilan.retenus++;
  }
}

function sujetDe(template: EmailJobName, payload: Record<string, unknown>): string {
  if (template === TEMPLATE_RELANCE) return questionnaireAvantAuditRelanceSubject("fr", payload);
  if (template === TEMPLATE_CONFIRMATION)
    return questionnaireAvantAuditConfirmationSubject("fr", payload);
  return questionnaireAvantAuditSubject("fr", payload);
}

function issueFile(r: ResultatFile): {
  statut: "envoye" | "retenu" | "prevu" | "echec";
  motif: string | null;
} {
  if (r.enqueued) return { statut: "envoye", motif: null };
  if (r.garePourValidation) return { statut: "retenu", motif: "retenu en corbeille" };
  if (r.essaiBloque)
    return { statut: "retenu", motif: "session d'essai : adresse hors liste blanche" };
  if (r.retenu) return { statut: "retenu", motif: `adresse retenue (${r.retenu})` };
  if (r.corbeilleIndisponible) return { statut: "prevu", motif: "corbeille indisponible" };
  return { statut: "prevu", motif: "file indisponible" };
}

/** Le gabarit et sa charge (pré-formatée : aucun calcul de fuseau au rendu). PUR. */
function gabaritEtPayload(
  etat: EtatQuestionnaire,
  nature: string,
  o: {
    lien: string;
    lienArret: string;
    brouillonEnCours: boolean;
    role: "dirigeant" | "collaborateur";
    prenomRepondant: string | undefined;
    recuLe: Date;
    env: Env;
  },
): { template: EmailJobName; payload: Record<string, unknown> } {
  const audit = etat.suivi?.dateAudit ?? null;
  const dates = audit
    ? { auditTexte: formaterAuditTexte(audit), auditCourt: formaterAuditCourt(audit) }
    : {};
  const lieu = etat.suivi?.lieuAudit ? { lieuAudit: etat.suivi.lieuAudit } : {};
  if (estRelance(nature)) {
    return {
      template: TEMPLATE_RELANCE,
      payload: {
        rang: Number(nature.slice(-1)),
        ...(etat.prenom ? { prenom: etat.prenom } : {}),
        lien: o.lien,
        lienArret: o.lienArret,
        ...dates,
        ...lieu,
        brouillonEnCours: o.brouillonEnCours,
      },
    };
  }
  if (estConfirmation(nature)) {
    const m = mentionsRgpd(o.env);
    return {
      template: TEMPLATE_CONFIRMATION,
      payload: {
        role: o.role,
        ...(o.prenomRepondant ? { prenom: o.prenomRepondant } : {}),
        societe: etat.societe,
        recuLeTexte: formaterAuditCourt(o.recuLe),
        ...(audit ? { auditCourt: formaterAuditCourt(audit) } : {}),
        conservation: m.conservation,
        contactRgpd: m.contact,
      },
    };
  }
  return {
    template: TEMPLATE_INVITATION,
    payload: { ...(etat.prenom ? { prenom: etat.prenom } : {}), lien: o.lien, ...dates, ...lieu },
  };
}

function payloadTelegram(
  etat: EtatQuestionnaire,
  evenement: "reponse" | "invitation" | "relance" | "arret" | "retenu",
  extra: {
    essai?: boolean | undefined;
    qui?: string | undefined;
    parcours?: "dirigeant" | "collaborateur" | "referent_it" | undefined;
    rang?: number | undefined;
    motif?: string | undefined;
    prochaine: string | undefined;
  },
): NotifyInput {
  const payload = {
    evenement,
    ...(extra.essai ? { essai: true } : {}),
    societe: etat.societe,
    ...(extra.qui ? { qui: extra.qui } : {}),
    ...(extra.parcours ? { parcours: extra.parcours } : {}),
    ...(evenement === "reponse"
      ? {
          recues: etat.recues,
          attendues: reponsesAttendues(etat.donneesDirigeant),
          dirigeantARepondu: etat.dirigeantARepondu,
        }
      : {}),
    ...(extra.rang !== undefined ? { rang: extra.rang } : {}),
    ...(extra.motif ? { motif: extra.motif } : {}),
    ...(extra.prochaine ? { prochaine: extra.prochaine } : {}),
    chemin: cheminConsole(etat.rencontreId),
  };
  return evenement === "reponse"
    ? { category: "QUESTIONNAIRE_PREAUDIT_REPONSE", payload }
    : { category: "QUESTIONNAIRE_PREAUDIT_SUIVI", payload };
}

/** Prise atomique : seul le passage qui fait passer la ligne `en_cours` la traite. */
async function prendre(ctx: Contexte, id: string, statutAttendu: string): Promise<boolean> {
  const r = await ctx.base.questionnaireAvantAuditCourrier.updateMany({
    where: { id, statut: statutAttendu },
    data: { statut: "en_cours", prisLe: ctx.maintenant, tentatives: { increment: 1 } },
  });
  return r.count === 1;
}

// ── 1. J0 → relances et « invitation partie » ───────────────────────────────

async function passerJ0(ctx: Contexte): Promise<void> {
  const { modes } = ctx.bilan;
  if (!actif(modes.relances) && !actif(modes.telegram)) return;
  const suivis = await ctx.base.questionnaireAvantAuditSuivi.findMany({
    where: { questionnaireId: { not: null }, premierEnvoiLe: null },
    select: { id: true, questionnaireId: true, relancesDemandees: true },
    take: 100,
  });
  for (const s of suivis) {
    const qid = s.questionnaireId as string;
    const log = await ctx.base.emailLog.findFirst({
      where: { template: TEMPLATE_INVITATION, entityType: ENTITE_Q, entityId: qid, status: "sent" },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });
    const j0 = log?.sentAt ?? null;
    if (j0 === null) continue;
    if (!ecrit(modes.relances) && !ecrit(modes.telegram)) {
      ctx.bilan.seraientCrees++;
      continue;
    }
    await ctx.base.questionnaireAvantAuditSuivi.updateMany({
      where: { id: s.id, premierEnvoiLe: null },
      data: { premierEnvoiLe: j0 },
    });
    if (ecrit(modes.telegram) && (s.relancesDemandees === false || !ecrit(modes.relances))) {
      await creer(ctx, [
        {
          cle: `tg_invit:${qid}`,
          questionnaireId: qid,
          nature: "telegram_invitation",
          canal: "telegram",
          prevuLe: ctx.maintenant,
        },
      ]);
    }
  }
  await creerRelances(ctx);
}

/** Les relances des suivis qui ont un J0, aucune relance encore, et aucune réponse du dirigeant. */
async function creerRelances(ctx: Contexte): Promise<void> {
  const { modes } = ctx.bilan;
  if (!actif(modes.relances)) return;
  const suivis = await ctx.base.questionnaireAvantAuditSuivi.findMany({
    where: {
      relancesDemandees: true,
      relancesArreteesLe: null,
      premierEnvoiLe: { not: null },
      questionnaire: {
        is: {
          closLe: null,
          courriers: { none: { nature: "relance_1" } },
          envois: { none: { mode: "main", ecarteLe: null } },
        },
      },
    },
    select: { questionnaireId: true, premierEnvoiLe: true, dateAudit: true },
    take: 100,
  });
  for (const s of suivis) {
    const qid = s.questionnaireId as string;
    const plan = planifierRelances(s.premierEnvoiLe as Date, s.dateAudit);
    if (!ecrit(modes.relances)) {
      ctx.bilan.seraientCrees += plan.length;
      continue;
    }
    await creer(
      ctx,
      plan.map((r) => ({
        cle: `relance_${r.rang}:${qid}`,
        questionnaireId: qid,
        nature: `relance_${r.rang}`,
        canal: "email",
        prevuLe: r.prevuLe ?? ctx.maintenant,
        ...(r.prevuLe === null ? { statut: "annule", motif: "audit_proche" } : {}),
      })),
    );
    if (ecrit(modes.telegram)) {
      const dates = plan
        .filter((r) => r.prevuLe !== null)
        .map((r) => formaterJourMois(r.prevuLe as Date))
        .join(", ");
      await creer(ctx, [
        {
          cle: `tg_invit:${qid}`,
          questionnaireId: qid,
          nature: "telegram_invitation",
          canal: "telegram",
          prevuLe: ctx.maintenant,
          motif: dates === "" ? null : dates,
        },
      ]);
    }
  }
}

interface NouveauCourrier {
  readonly cle: string;
  readonly questionnaireId: string | null;
  readonly envoiId?: string | null;
  readonly nature: string;
  readonly canal: "email" | "telegram" | "journal";
  readonly prevuLe: Date;
  readonly statut?: string;
  readonly motif?: string | null;
  readonly destinataireHash?: string | null;
}

async function creer(ctx: Contexte, lignes: ReadonlyArray<NouveauCourrier>): Promise<void> {
  if (lignes.length === 0) return;
  const r = await ctx.base.questionnaireAvantAuditCourrier.createMany({
    data: lignes.map((l) => ({
      cle: l.cle,
      questionnaireId: l.questionnaireId,
      envoiId: l.envoiId ?? null,
      nature: l.nature,
      canal: l.canal,
      statut: l.statut ?? "prevu",
      prevuLe: l.prevuLe,
      motif: l.motif ?? null,
      destinataireHash: l.destinataireHash ?? null,
    })),
    skipDuplicates: true,
  });
  ctx.bilan.crees += r.count;
}

// ── 2. Réponses → confirmations et « réponse reçue » ────────────────────────

async function passerReponses(ctx: Contexte): Promise<void> {
  const { modes } = ctx.bilan;
  if (!actif(modes.confirmations) && !actif(modes.telegram)) return;
  const envois = await ctx.base.questionnaireAvantAuditEnvoi.findMany({
    where: {
      ecarteLe: null,
      // Jamais de rafale à l'allumage : 48 h au plus.
      recuLe: { gte: new Date(ctx.maintenant.getTime() - 2 * UN_JOUR) },
      questionnaire: { suivi: { isNot: null } },
      courriers: {
        none: {
          nature: {
            in: ["confirmation_dirigeant", "confirmation_collaborateur", "telegram_reponse"],
          },
        },
      },
    },
    select: {
      id: true,
      questionnaireId: true,
      mode: true,
      recuLe: true,
      donnees: true,
      questionnaire: { select: { suivi: { select: { creeLe: true } } } },
    },
    orderBy: { recuLe: "asc" },
    take: 50,
  });
  for (const e of envois) {
    const creeLe = e.questionnaire.suivi?.creeLe ?? null;
    if (creeLe === null || e.recuLe.getTime() < creeLe.getTime()) continue;
    const etat = await lireEtat(ctx, e.questionnaireId);
    if (etat === null) continue;
    const lignes: NouveauCourrier[] = [];
    if (actif(modes.confirmations)) {
      const charge = lireCharge(e.donnees);
      let adresse: string | null = null;
      if (e.mode === "main") adresse = etat.destinataire;
      else if (charge !== null && charge.traitement) {
        const a = texte(charge.donnees["id_email"]);
        adresse = a !== undefined && ADRESSE.test(a) ? a : null;
      }
      const deja = await ctx.base.questionnaireAvantAuditCourrier.count({
        where: {
          questionnaireId: e.questionnaireId,
          nature: { in: ["confirmation_dirigeant", "confirmation_collaborateur"] },
        },
      });
      const nature = e.mode === "main" ? "confirmation_dirigeant" : "confirmation_collaborateur";
      const motif =
        adresse === null
          ? "sans adresse utilisable"
          : deja >= CONFIRMATIONS_MAX_PAR_QUESTIONNAIRE
            ? "plafond atteint"
            : null;
      lignes.push({
        cle: `conf:${e.id}`,
        questionnaireId: e.questionnaireId,
        envoiId: e.id,
        nature,
        canal: "email",
        prevuLe: ctx.maintenant,
        ...(motif !== null ? { statut: "annule", motif } : {}),
        destinataireHash: adresse === null ? null : hashEmailForLookup(adresse),
      });
    }
    if (actif(modes.telegram)) {
      lignes.push({
        cle: `tg_rep:${e.id}`,
        questionnaireId: e.questionnaireId,
        envoiId: e.id,
        nature: "telegram_reponse",
        canal: "telegram",
        prevuLe: ctx.maintenant,
      });
    }
    const aEcrire = lignes.filter((l) =>
      l.nature === "telegram_reponse" ? ecrit(modes.telegram) : ecrit(modes.confirmations),
    );
    ctx.bilan.seraientCrees += lignes.length - aEcrire.length;
    await creer(ctx, aEcrire);
  }
}

// ── 3. Arrêts ────────────────────────────────────────────────────────────────

type MotifArret =
  | "reponse_dirigeant"
  | "clos"
  | "expire"
  | "supprime"
  | "rebond"
  | "opposition"
  | "en_retard"
  | "will"
  | "desinscription";

async function arreterRelances(
  ctx: Contexte,
  qid: string,
  motif: MotifArret,
  signalerMemeSansAnnulation = false,
): Promise<void> {
  if (!ecrit(ctx.bilan.modes.relances)) {
    ctx.bilan.seraientCrees++;
    return;
  }
  await ctx.base.questionnaireAvantAuditSuivi.updateMany({
    where: { questionnaireId: qid, relancesArreteesLe: null },
    data: { relancesArreteesLe: ctx.maintenant, relancesArretMotif: motif },
  });
  const r = await ctx.base.questionnaireAvantAuditCourrier.updateMany({
    where: { questionnaireId: qid, nature: { in: [...NATURES_RELANCE] }, statut: "prevu" },
    data: { statut: "annule", motif, faitLe: ctx.maintenant },
  });
  ctx.bilan.annules += r.count;
  if (ecrit(ctx.bilan.modes.telegram) && (r.count > 0 || signalerMemeSansAnnulation)) {
    await creer(ctx, [
      {
        cle: `tg_arret:${qid}`,
        questionnaireId: qid,
        nature: "telegram_arret",
        canal: "telegram",
        prevuLe: ctx.maintenant,
        motif,
      },
    ]);
  }
}

async function passerArrets(ctx: Contexte): Promise<void> {
  if (!actif(ctx.bilan.modes.relances)) return;
  const suivis = await ctx.base.questionnaireAvantAuditSuivi.findMany({
    where: {
      questionnaireId: { not: null },
      questionnaire: {
        is: { courriers: { some: { nature: { in: [...NATURES_RELANCE] }, statut: "prevu" } } },
      },
    },
    select: { questionnaireId: true, relancesArreteesLe: true, relancesArretMotif: true },
    take: 200,
  });
  for (const s of suivis) {
    const qid = s.questionnaireId as string;
    const motif = await motifDArret(
      ctx,
      qid,
      s.relancesArreteesLe !== null ? s.relancesArretMotif : null,
    );
    if (motif !== null) await arreterRelances(ctx, qid, motif);
  }
}

/** Pourquoi les relances de ce questionnaire doivent s'arrêter, ou `null`. */
async function motifDArret(
  ctx: Contexte,
  qid: string,
  dejaPose: string | null,
): Promise<MotifArret | null> {
  if (dejaPose !== null) return (dejaPose as MotifArret) ?? "will";
  const etat = await lireEtat(ctx, qid);
  if (etat === null) return "supprime";
  if (etat.dirigeantARepondu) return "reponse_dirigeant";
  if (etat.closLe !== null) return "clos";
  if (etat.expireLe !== null && etat.expireLe.getTime() <= ctx.maintenant.getTime())
    return "expire";
  const rebond = await ctx.base.emailLog.findFirst({
    where: {
      template: TEMPLATE_INVITATION,
      entityType: ENTITE_Q,
      entityId: qid,
      bounceType: "hard",
    },
    select: { id: true },
  });
  if (rebond !== null) return "rebond";
  return null;
}

// ── 4. Courriers dus ─────────────────────────────────────────────────────────

async function passerDus(ctx: Contexte): Promise<void> {
  const { modes } = ctx.bilan;
  const natures = [
    ...(actif(modes.relances) ? NATURES_RELANCE : []),
    ...(actif(modes.confirmations) ? ["confirmation_dirigeant", "confirmation_collaborateur"] : []),
    ...(actif(modes.telegram)
      ? [
          "telegram_invitation",
          "telegram_reponse",
          "telegram_relance",
          "telegram_arret",
          "telegram_retenu",
        ]
      : []),
  ];
  if (natures.length === 0) return;
  const dus = await ctx.base.questionnaireAvantAuditCourrier.findMany({
    where: {
      nature: { in: natures },
      OR: [
        { statut: "prevu", prevuLe: { lte: ctx.maintenant } },
        { statut: "en_cours", prisLe: { lt: new Date(ctx.maintenant.getTime() - QUINZE_MIN) } },
      ],
    },
    orderBy: { prevuLe: "asc" },
    take: DUS_PAR_PASSAGE,
  });
  for (const c of dus) {
    const famille: ModeSuivi = estRelance(c.nature)
      ? modes.relances
      : estConfirmation(c.nature)
        ? modes.confirmations
        : modes.telegram;
    if (!ecrit(famille)) {
      ctx.bilan.seraientEnvoyes++;
      continue;
    }
    if (!(await prendre(ctx, c.id, c.statut))) continue;
    try {
      await traiterUn(ctx, c);
    } catch (e) {
      if (estMigrationAbsente(e)) throw e;
      // Une panne ne laisse jamais la ligne bloquée : elle repasse « prévue » (tentatives comptées).
      await ctx.base.questionnaireAvantAuditCourrier.update({
        where: { id: c.id },
        data: {
          statut: c.tentatives + 1 >= TENTATIVES_EMAIL_MAX ? "echec" : "prevu",
          motif: "erreur au traitement",
        },
      });
      ctx.bilan.echecs++;
    }
  }
}

type Courrier = Awaited<
  ReturnType<BaseSuivi["questionnaireAvantAuditCourrier"]["findMany"]>
>[number];

async function traiterUn(ctx: Contexte, c: Courrier): Promise<void> {
  const tentatives = c.tentatives + 1;
  const fin = async (statut: string, motif: string | null) => {
    await ctx.base.questionnaireAvantAuditCourrier.update({
      where: { id: c.id },
      data: { statut, motif, faitLe: statut === "prevu" ? null : ctx.maintenant },
    });
    if (statut === "annule") ctx.bilan.annules++;
    if (statut === "echec") ctx.bilan.echecs++;
    if (statut === "retenu") ctx.bilan.retenus++;
    if (statut === "envoye") ctx.bilan.envoyes++;
  };
  const telegram = estTelegram(c.nature);
  if (tentatives > (telegram ? TENTATIVES_TELEGRAM_MAX : TENTATIVES_EMAIL_MAX)) {
    await fin("echec", "trop de tentatives");
    return;
  }
  if (c.questionnaireId === null) {
    await fin("annule", "supprime");
    return;
  }
  const etat = await lireEtat(ctx, c.questionnaireId);
  if (etat === null) {
    await fin("annule", "supprime");
    return;
  }
  if (telegram) {
    await envoyerTelegram(ctx, c, etat, fin);
    return;
  }
  const retard = ctx.maintenant.getTime() - c.prevuLe.getTime();
  if (estRelance(c.nature)) {
    const motif = await motifDArret(ctx, etat.id, etat.suivi?.relancesArreteesLe ? "will" : null);
    if (motif !== null) {
      await fin("annule", motif);
      await arreterRelances(ctx, etat.id, motif, true);
      return;
    }
    if (retard > UN_JOUR) {
      await fin("annule", "en_retard");
      return;
    }
    if (!dansCreneauRelance(ctx.maintenant)) {
      await ctx.base.questionnaireAvantAuditCourrier.update({
        where: { id: c.id },
        data: {
          statut: "prevu",
          prevuLe: prochainCreneauRelance(ctx.maintenant),
          tentatives: c.tentatives,
        },
      });
      return;
    }
  } else if (retard > 2 * UN_JOUR) {
    await fin("annule", "en_retard");
    return;
  }

  const jobId = jobIdDe(c.cle);
  // La file e-mail efface ses tâches finies : `email_logs` (écrit AVANT la file) fait foi.
  const deja = await ctx.base.emailLog.findFirst({ where: { jobId }, select: { id: true } });
  if (deja !== null) {
    await fin("envoye", "déjà en file (reprise)");
    return;
  }

  let destinataire: string | null = null;
  let role: "dirigeant" | "collaborateur" = "dirigeant";
  let prenomRepondant: string | undefined;
  let recuLe = ctx.maintenant;
  if (estRelance(c.nature) || c.nature === "confirmation_dirigeant") {
    destinataire = etat.destinataire;
    prenomRepondant = etat.prenom;
    if (c.nature === "confirmation_dirigeant" && c.envoiId !== null) {
      const e = await ctx.base.questionnaireAvantAuditEnvoi.findUnique({
        where: { id: c.envoiId },
        select: { donnees: true, recuLe: true },
      });
      if (e !== null) {
        recuLe = e.recuLe;
        prenomRepondant =
          texte(lireCharge(e.donnees)?.donnees["contact_prenom"], 60) ?? etat.prenom;
      }
    }
  } else {
    role = "collaborateur";
    if (c.envoiId !== null) {
      const e = await ctx.base.questionnaireAvantAuditEnvoi.findUnique({
        where: { id: c.envoiId },
        select: { donnees: true, recuLe: true, ecarteLe: true },
      });
      const charge = e !== null && e.ecarteLe === null ? lireCharge(e.donnees) : null;
      const a =
        charge !== null && charge.traitement ? texte(charge.donnees["id_email"]) : undefined;
      if (a !== undefined && ADRESSE.test(a)) destinataire = a;
      if (e !== null) recuLe = e.recuLe;
      prenomRepondant = texte(charge?.donnees["id_prenom"], 60);
    }
  }
  // L'adresse doit être celle notée au journal (une adresse effacée ou changée ne reçoit rien).
  if (
    destinataire === null ||
    (c.destinataireHash !== null && hashEmailForLookup(destinataire) !== c.destinataireHash) ||
    (estConfirmation(c.nature) && c.destinataireHash === null)
  ) {
    await fin("annule", "sans adresse utilisable");
    return;
  }

  const lien = urlPreaudit(etat.id);
  const lienArret = urlArretRelances(etat.id);
  if (estRelance(c.nature) && (lien === null || lienArret === null)) {
    await fin("echec", "lien_impossible");
    return;
  }
  const brouillonEnCours =
    estRelance(c.nature) &&
    (await ctx.base.questionnaireAvantAuditBrouillon.count({
      where: { questionnaireId: etat.id, mode: "main" },
    })) > 0;
  const { template, payload } = gabaritEtPayload(etat, c.nature, {
    lien: lien ?? "",
    lienArret: lienArret ?? "",
    brouillonEnCours,
    role,
    prenomRepondant,
    recuLe,
    env: ctx.env,
  });
  const r = await ctx.enfiler(template, destinataire, "fr", payload, {
    jobId,
    entityType: c.nature === "confirmation_collaborateur" ? ENTITE_ENVOI : ENTITE_Q,
    entityId: c.nature === "confirmation_collaborateur" && c.envoiId !== null ? c.envoiId : etat.id,
    clientId: etat.clientId,
    sujet: sujetDe(template, payload),
  });
  const issue = issueFile(r);
  if (issue.statut === "prevu") {
    // File ou corbeille indisponible : retentée au passage suivant (tentatives comptées).
    await fin("prevu", issue.motif);
    return;
  }
  await fin(issue.statut, issue.motif);
  if (issue.statut === "retenu" && r.retenu !== undefined && estRelance(c.nature)) {
    // Liste de suppression ou opposition : plus aucune relance pour ce questionnaire.
    await arreterRelances(ctx, etat.id, "opposition");
  }
  if (ecrit(ctx.bilan.modes.telegram)) {
    if (issue.statut === "envoye" && estRelance(c.nature)) {
      await creer(ctx, [
        {
          cle: `tg_rel:${etat.id}:${c.nature.slice(-1)}`,
          questionnaireId: etat.id,
          nature: "telegram_relance",
          canal: "telegram",
          prevuLe: ctx.maintenant,
          motif: c.nature.slice(-1),
        },
      ]);
    } else if (issue.statut === "retenu") {
      await creer(ctx, [
        {
          cle: `tg_ret:${c.cle}`,
          questionnaireId: etat.id,
          nature: "telegram_retenu",
          canal: "telegram",
          prevuLe: ctx.maintenant,
          motif: issue.motif,
        },
      ]);
    }
  }
}

async function prochaineRelance(ctx: Contexte, qid: string): Promise<string | undefined> {
  const r = await ctx.base.questionnaireAvantAuditCourrier.findFirst({
    where: { questionnaireId: qid, nature: { in: [...NATURES_RELANCE] }, statut: "prevu" },
    orderBy: { prevuLe: "asc" },
    select: { prevuLe: true },
  });
  return r === null ? undefined : formaterProchaine(r.prevuLe);
}

async function envoyerTelegram(
  ctx: Contexte,
  c: Courrier,
  etat: EtatQuestionnaire,
  fin: (statut: string, motif: string | null) => Promise<void>,
): Promise<void> {
  let input: NotifyInput;
  if (c.nature === "telegram_reponse") {
    let qui: string | undefined;
    let parcours: "dirigeant" | "collaborateur" | "referent_it" | undefined;
    if (c.envoiId !== null) {
      const e = await ctx.base.questionnaireAvantAuditEnvoi.findUnique({
        where: { id: c.envoiId },
        select: { mode: true, donnees: true },
      });
      if (e !== null) {
        const d = lireCharge(e.donnees)?.donnees ?? {};
        const main = e.mode === "main";
        parcours = main ? "dirigeant" : e.mode === "it" ? "referent_it" : "collaborateur";
        const p = texte(d[main ? "contact_prenom" : "id_prenom"], 100);
        const n = texte(d[main ? "contact_nom" : "id_nom"], 100);
        qui =
          p !== undefined || n !== undefined ? prenomEtInitiale(p ?? null, n ?? null) : undefined;
      }
    }
    input = payloadTelegram(etat, "reponse", {
      ...(qui ? { qui } : {}),
      ...(parcours ? { parcours } : {}),
      prochaine: await prochaineRelance(ctx, etat.id),
    });
  } else if (c.nature === "telegram_invitation") {
    input = payloadTelegram(etat, "invitation", { prochaine: c.motif ?? undefined });
  } else if (c.nature === "telegram_relance") {
    input = payloadTelegram(etat, "relance", {
      rang: Number(c.motif ?? "0") || undefined,
      prochaine: await prochaineRelance(ctx, etat.id),
    });
  } else if (c.nature === "telegram_arret") {
    input = payloadTelegram(etat, "arret", { motif: c.motif ?? undefined, prochaine: undefined });
  } else {
    input = payloadTelegram(etat, "retenu", { motif: c.motif ?? undefined, prochaine: undefined });
  }
  const r = await ctx.notifier(input);
  if (r.channels.telegram === "sent" || r.deduped === true) {
    await fin("envoye", null);
    return;
  }
  // Telegram indisponible ou débit dépassé : retenté au passage suivant (5 tentatives au plus).
  await fin(
    c.tentatives + 1 >= TENTATIVES_TELEGRAM_MAX ? "echec" : "prevu",
    "Telegram indisponible",
  );
}

// ── Le passage ───────────────────────────────────────────────────────────────

export async function passerSuiviQuestionnaires(
  base: BaseSuivi,
  deps: DepsSuivi,
): Promise<BilanSuivi> {
  const env = deps.env ?? process.env;
  const bilan: BilanSuivi = {
    modes: {
      relances: modeRelances(env),
      confirmations: modeConfirmations(env),
      telegram: modeTelegram(env),
    },
    refuse: false,
    migrationAbsente: false,
    essais: 0,
    crees: 0,
    envoyes: 0,
    annules: 0,
    retenus: 0,
    echecs: 0,
    seraientCrees: 0,
    seraientEnvoyes: 0,
  };
  const ctx: Contexte = {
    base,
    env,
    maintenant: deps.maintenant,
    enfiler:
      deps.enfiler ?? (async (...a) => (await import("@/server/queue/queues")).enqueueEmail(...a)),
    notifier: deps.notifier ?? (async (i) => (await import("@/server/notifications")).notify(i)),
    bilan,
  };
  try {
    // E. Les essais de Will : seulement si le questionnaire est allumé, jamais au prospect.
    if (preauditActif(env)) await passerEssais(ctx);
    const { modes } = bilan;
    if (!actif(modes.relances) && !actif(modes.confirmations) && !actif(modes.telegram))
      return bilan;
    if (refusReel(env) !== null) {
      bilan.refuse = true;
      return bilan;
    }
    await passerJ0(ctx);
    await passerReponses(ctx);
    await passerArrets(ctx);
    await passerDus(ctx);
    return bilan;
  } catch (e) {
    if (!estMigrationAbsente(e)) throw e;
    // Le worker est en avance sur la migration (deux conteneurs) : rien à faire, sans bruit.
    bilan.migrationAbsente = true;
    if (!migrationSignalee) {
      migrationSignalee = true;
      console.warn(
        "[questionnaire-preaudit/suivi] tables du suivi absentes : migration pas encore jouée",
      );
    }
    return bilan;
  }
}

/** Réinitialise l'avertissement « migration absente » (tests). */
export function reinitialiserAvertissementMigration(): void {
  migrationSignalee = false;
}
