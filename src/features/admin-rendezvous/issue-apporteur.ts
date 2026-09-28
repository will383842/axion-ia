/**
 * L'issue de l'échange avec un CANDIDAT APPORTEUR — les règles (2026-09-28).
 *
 * Demande de Will : après l'échange de 15 minutes en visio, cliquer UN bouton
 * selon la situation, et que le bon e-mail parte au candidat. Fonctions pures :
 * la lecture et l'écriture en base vivent dans `issue-apporteur-envoi.ts` et
 * `issue-apporteur-actions.ts`.
 *
 * 🔑 CE N'EST PAS UN SECOND SYSTÈME. L'issue est rangée dans le « point après
 * le rendez-vous » existant (`rendez_vous_suivis`, `suivi.ts`) :
 *   · Absent / Reporté  → `issue` absent / reporte, comme pour un client ;
 *   · Retenu / À revoir / Non retenu → `issue` eu_lieu + `decision`, À LA
 *     PLACE de la `suite` des clients (on ne devise pas un apporteur).
 * Un échange apporteur tenu sort donc de « À faire le point » exactement comme
 * un appel client.
 *
 * Les e-mails, et pourquoi :
 *   · Absent      → « on t'a attendu », UNE fois par personne. À la seconde
 *                   absence, plus de reprogrammation proposée : l'écran
 *                   suggère « Non retenu » ;
 *   · Retenu      → le récapitulatif de bienvenue dans le réseau ;
 *   · Non retenu  → le refus courtois, porte ouverte ;
 *   · Reporté, À revoir → rien : ce sont des constats internes.
 *
 * ⚠️ Aucun import ici hors `zod` : le module est lu par un composant client
 * (les libellés) et doit le rester.
 */

import { z } from "zod";

import type { IssueRdv } from "./suivi";
import type { DecisionSuivi } from "@/lib/commercial-application/relance-invitation";

export const ISSUES_APPORTEUR = ["absent", "reporte", "retenu", "a_revoir", "non_retenu"] as const;
export type IssueApporteur = (typeof ISSUES_APPORTEUR)[number];

export const DECISIONS_APPORTEUR = ["retenu", "a_revoir", "non_retenu"] as const;
export type DecisionApporteur = (typeof DECISIONS_APPORTEUR)[number];

export const LIBELLE_ISSUE_APPORTEUR: Readonly<Record<IssueApporteur, string>> = {
  absent: "Absent",
  reporte: "Reporté",
  retenu: "Retenu",
  a_revoir: "À revoir",
  non_retenu: "Non retenu",
};

/**
 * Noms des gabarits — aussi la clé d'idempotence lue dans le journal des envois
 * (`EmailLog.template`). Ils doivent rester égaux aux entrées de
 * `lib/email/templates/index.tsx` (vérifié par le test des gabarits).
 */
export const GABARIT_ISSUE_ABSENT = "apporteur-issue-absent";
export const GABARIT_ISSUE_RETENU = "apporteur-issue-retenu";
export const GABARIT_ISSUE_NON_RETENU = "apporteur-issue-non-retenu";

export type GabaritIssueApporteur =
  typeof GABARIT_ISSUE_ABSENT | typeof GABARIT_ISSUE_RETENU | typeof GABARIT_ISSUE_NON_RETENU;

export const GABARITS_ISSUE_APPORTEUR: readonly GabaritIssueApporteur[] = [
  GABARIT_ISSUE_ABSENT,
  GABARIT_ISSUE_RETENU,
  GABARIT_ISSUE_NON_RETENU,
];

/** Ce que l'issue écrit dans `rendez_vous_suivis`. */
export function versSuivi(issue: IssueApporteur): {
  issue: IssueRdv;
  decision: DecisionApporteur | null;
} {
  if (issue === "absent") return { issue: "absent", decision: null };
  if (issue === "reporte") return { issue: "reporte", decision: null };
  return { issue: "eu_lieu", decision: issue };
}

/** L'inverse : le bouton actif pour un point déjà enregistré (`null` : aucun). */
export function issueDepuisSuivi(
  issue: IssueRdv,
  decision: DecisionApporteur | null,
): IssueApporteur | null {
  if (issue === "absent") return "absent";
  if (issue === "reporte") return "reporte";
  return decision ?? null;
}

/**
 * L'e-mail que cette issue fait partir, ou `null`.
 *
 * `absencesAnterieures` : les AUTRES échanges de la même personne déjà notés
 * « Absent ». Dès la deuxième absence, on ne propose plus de nouveau créneau.
 */
export function gabaritDeLIssue(
  issue: IssueApporteur,
  absencesAnterieures: number,
): GabaritIssueApporteur | null {
  switch (issue) {
    case "absent":
      return absencesAnterieures >= 1 ? null : GABARIT_ISSUE_ABSENT;
    case "retenu":
      return GABARIT_ISSUE_RETENU;
    case "non_retenu":
      return GABARIT_ISSUE_NON_RETENU;
    case "reporte":
    case "a_revoir":
      return null;
  }
}

/** L'issue arrête-t-elle toute relance future (fiche classée « Sans suite ») ? */
export function classeSansSuite(issue: IssueApporteur): boolean {
  return issue === "non_retenu";
}

/** La note d'échange n'a de sens que si l'échange a eu lieu. */
export function echangeTenu(issue: IssueApporteur): boolean {
  return issue === "retenu" || issue === "a_revoir" || issue === "non_retenu";
}

export const MOT_PERSONNEL_MAX = 800;

export const issueApporteurSchema = z.object({
  calendlyEventId: z.string().min(1).max(64),
  issue: z.enum(ISSUES_APPORTEUR, { message: "Choisis l'issue de l'échange." }),
  /** Note d'échange /20, facultative (grille de la trame imprimée). */
  noteSur20: z.coerce
    .number({ message: "La note doit être un nombre." })
    .int("La note est un nombre entier.")
    .min(0, "La note va de 0 à 20.")
    .max(20, "La note va de 0 à 20.")
    .nullable(),
  /** La phrase qui justifie la note, facultative. */
  justification: z
    .string()
    .trim()
    .max(500, "Une phrase suffit (500 caractères au plus).")
    .nullable(),
  /** « À revoir » : date de rappel interne, facultative, « AAAA-MM-JJ ». */
  rappelLe: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
    .nullable(),
  /** Quelques mots ajoutés en haut de l'e-mail, facultatifs. */
  motPersonnel: z
    .string()
    .trim()
    .max(MOT_PERSONNEL_MAX, `Le mot personnel tient en ${MOT_PERSONNEL_MAX} caractères.`)
    .nullable(),
});

export type IssueApporteurSaisie = z.infer<typeof issueApporteurSchema>;

/** Lit un `FormData`, champs vides → `null`. */
export function lireFormulaireIssueApporteur(fd: FormData): unknown {
  const texte = (k: string): string | null => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  return {
    calendlyEventId: texte("calendlyEventId") ?? "",
    issue: texte("issue"),
    noteSur20: texte("noteSur20"),
    justification: texte("justification"),
    rappelLe: texte("rappelLe"),
    motPersonnel: texte("motPersonnel"),
  };
}

/**
 * Ce qu'on garde : la note seulement pour un échange tenu, la date de rappel
 * seulement pour « À revoir », le mot personnel seulement s'il y a un e-mail.
 */
export function normaliserIssueApporteur(v: IssueApporteurSaisie): {
  issue: IssueRdv;
  decision: DecisionApporteur | null;
  suiteLe: Date | null;
  noteSur20: number | null;
  note: string | null;
} {
  const tenu = echangeTenu(v.issue);
  return {
    ...versSuivi(v.issue),
    suiteLe: v.issue === "a_revoir" && v.rappelLe ? new Date(`${v.rappelLe}T00:00:00Z`) : null,
    noteSur20: tenu ? v.noteSur20 : null,
    note: tenu && v.justification ? v.justification : null,
  };
}

/** « 22/09 », heure de Paris. */
export function jourMoisParis(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/** Un point enregistré, tel que la console en a besoin pour l'afficher. */
export interface PointApporteur {
  readonly issue: IssueRdv;
  readonly decision: DecisionApporteur | null;
  readonly renseigneLe: Date;
}

/**
 * « Absent le 22/09 », « Retenu le 28/09 », « À revoir », « Reporté ».
 * L'absence est datée du RENDEZ-VOUS ; la décision, du jour où elle a été prise.
 */
export function libellePointApporteur(p: PointApporteur, debutRdv: Date | null): string {
  const issue = issueDepuisSuivi(p.issue, p.decision);
  if (issue === "absent") return debutRdv ? `Absent le ${jourMoisParis(debutRdv)}` : "Absent";
  if (issue === "retenu") return `Retenu le ${jourMoisParis(p.renseigneLe)}`;
  if (issue === "non_retenu") return `Non retenu le ${jourMoisParis(p.renseigneLe)}`;
  if (issue === "a_revoir") return "À revoir";
  if (issue === "reporte") return "Reporté";
  return "A eu lieu";
}

/** Un échange apporteur de la personne, avec son point s'il existe. */
export interface EchangeAvecPoint {
  readonly debut: Date | null;
  readonly annule: boolean;
  readonly point: PointApporteur | null;
}

/** Le badge de décision — le type vit avec les autres badges de la liste. */
export type DecisionAffichee = DecisionSuivi;

/**
 * Le badge « décision » d'une personne dans la liste des apporteurs, ou `null`.
 *
 *   1. une décision DÉFINITIVE (retenu, non retenu) l'emporte sur tout — la
 *      plus récemment prise ;
 *   2. sinon, c'est le DERNIER échange non annulé qui parle : « À revoir » ou
 *      « Absent » s'il porte ce point ; rien s'il n'en porte pas (ou
 *      « Reporté ») — une nouvelle réservation après une absence redonne alors
 *      la main au badge « Échange réservé ».
 */
export function decisionAffichee(echanges: readonly EchangeAvecPoint[]): DecisionAffichee | null {
  let definitive: { type: "retenu" | "non-retenu"; le: Date } | null = null;
  for (const e of echanges) {
    const d = e.point?.decision;
    if (d !== "retenu" && d !== "non_retenu") continue;
    const le = e.point!.renseigneLe;
    if (!definitive || le > definitive.le) {
      definitive = { type: d === "retenu" ? "retenu" : "non-retenu", le };
    }
  }
  if (definitive) return definitive;

  const vivants = echanges
    .filter((e) => !e.annule)
    .sort((a, b) => (a.debut?.getTime() ?? 0) - (b.debut?.getTime() ?? 0));
  const dernier = vivants[vivants.length - 1];
  if (!dernier?.point) return null;
  const issue = issueDepuisSuivi(dernier.point.issue, dernier.point.decision);
  if (issue === "a_revoir") return { type: "a-revoir" };
  if (issue === "absent") return { type: "absent", le: dernier.debut };
  return null;
}
