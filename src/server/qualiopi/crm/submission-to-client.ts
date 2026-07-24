/**
 * Qualiopi — Mapping « demande de contact (Submission) » → « prospect CRM (Client) ».
 *
 * POURQUOI
 * --------
 * Un lead qui arrive par le formulaire public atterrit dans `submissions`
 * (inbox). Pour le facturer un jour, il faut un `Client` (CRM Qualiopi) — deux
 * tables qui ne se connaissent pas, avec des schémas différents (la Submission
 * chiffre les PII, le Client les stocke en clair). Résultat : l'admin re-tapait
 * à la main raison sociale / nom / email / téléphone à chaque conversion.
 *
 * Ce module dérive les champs Client pré-remplis d'une Submission déjà
 * DÉCHIFFRÉE (le déchiffrement reste côté action, jamais ici). Le lead ne
 * devient PAS automatiquement un client : le résultat pré-remplit un formulaire
 * que l'admin valide (décision humaine explicite — un lead n'est pas un client,
 * et chaque `Client` consomme un numéro séquentiel immuable `AXI-CLI-NNN`).
 *
 * Pur : aucune I/O, aucune dépendance Prisma runtime. Testable seul.
 */

import type { CompanySize } from "./types";

/** Sous-ensemble d'une Submission déchiffrée, suffisant au pré-remplissage. */
export interface SubmissionForClientMapping {
  id: string;
  /** `companyName` — "—" (placeholder du formulaire) traité comme vide. */
  companyName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactRole?: string | null;
  sector?: string | null;
  /** `employeesCount` — la taille INSEE du formulaire unifié (tpe/pme/…). */
  employeesCount?: string | null;
  address?: string | null;
  /** `details` JSON — on y récupère ville et message si présents. */
  details?: unknown;
}

/** Valeurs pré-remplies transmises au ClientForm. */
export interface ClientPrefill {
  type: "entreprise" | "particulier";
  raisonSociale: string;
  contactNom: string;
  contactEmail: string;
  contactTelephone: string;
  contactFonction: string;
  secteur: string;
  adresse: string;
  taille: CompanySize | "";
  /** Contexte injectable au Formation Engine (message du lead). */
  contexteIa: string;
  /** Traçabilité — persisté dans `Client.source` (pas de FK ajoutée). */
  source: string;
}

/** Placeholder posé par le formulaire public quand la société n'est pas saisie. */
const COMPANY_PLACEHOLDER = "—";

/** Mappe la taille INSEE du formulaire unifié vers l'enum Prisma CompanySize. */
export function mapEmployeesCountToTaille(raw: string | null | undefined): CompanySize | "" {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "tpe":
      return "TPE";
    case "pme":
      return "PME";
    case "eti":
      return "ETI";
    case "grande_entreprise":
    case "grande-entreprise":
    case "ge":
      return "GRANDE_ENTREPRISE";
    default:
      // Valeur libre héritée (ex. "10-50") ou absente → non mappée, à saisir.
      return "";
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Extrait `ville` et `message` du JSON `details` (formulaire unifié). */
function readDetails(details: unknown): { ville: string; message: string } {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return { ville: "", message: "" };
  }
  const d = details as Record<string, unknown>;
  return { ville: str(d.ville), message: str(d.message) };
}

/**
 * Construit les valeurs pré-remplies du ClientForm à partir d'une Submission
 * déchiffrée. Aucun champ inventé : ce qui manque reste vide (l'admin complète,
 * notamment SIRET / NAF / IDCC, absents de tout formulaire public).
 */
export function buildClientPrefillFromSubmission(s: SubmissionForClientMapping): ClientPrefill {
  const company = str(s.companyName);
  const contactNom = str(s.contactName);
  const { ville, message } = readDetails(s.details);

  // Raison sociale : la société si renseignée (≠ placeholder), sinon le nom du
  // contact (cas d'un particulier / lead sans société).
  const hasCompany = company !== "" && company !== COMPANY_PLACEHOLDER;
  const raisonSociale = hasCompany ? company : contactNom;

  // Type : sans société identifiée, on penche « particulier » (B2C, ex. CPF) ;
  // sinon entreprise. L'admin peut basculer dans le formulaire.
  const type: "entreprise" | "particulier" = hasCompany ? "entreprise" : "particulier";

  // Adresse : l'adresse si fournie, sinon au moins la ville (souvent la seule
  // info géographique du formulaire unifié).
  const adresse = str(s.address) || ville;

  return {
    type,
    raisonSociale,
    contactNom,
    contactEmail: str(s.contactEmail),
    contactTelephone: str(s.contactPhone),
    contactFonction: str(s.contactRole),
    secteur: str(s.sector),
    adresse,
    taille: type === "entreprise" ? mapEmployeesCountToTaille(s.employeesCount) : "",
    contexteIa: message,
    source: `submission:${s.id}`,
  };
}
