// « Ce que rapporte chaque rendez-vous » — l'agrégation PURE (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L5b. Will veut savoir quel BOUTON
// rapporte : sur 30 ou 90 jours, par type (Diagnostic IA, Échange projet,
// Salon ; l'Apporteur à part), puis par emplacement (`utm_content`, posé par
// le parcours public : `diagnostic:accueil-hero`, `projet:entete`…).
//
// Les règles, une fois :
//   · le type est celui de `typeEffectif` (colonne, sinon nom) — un écran et un
//     e-mail ne classent jamais la même ligne différemment ;
//   · honoré / absent : le POINT fait après l'appel d'abord (`rendez_vous_suivis`),
//     le statut ensuite ; une annulation reste une annulation ;
//   · fiche / client : SEULEMENT le rattachement validé par Will (la rencontre
//     du dossier client rangée sur une fiche `clients`). Aucune déduction par
//     l'adresse : on ne compte pas ce qu'on n'a pas constaté.
//
// Module PUR : la lecture groupée vit dans `bilan-rendez-vous-queries.ts`.

import { typeEffectif } from "@/server/calendly/type-effectif";
import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";

/** Les deux périodes proposées, en jours. */
export const PERIODES_BILAN = [30, 90] as const;
export type PeriodeBilan = (typeof PERIODES_BILAN)[number];

/** `?jours=90` → 90 ; toute autre valeur → 30. */
export function lirePeriodeBilan(valeur: string | undefined): PeriodeBilan {
  return valeur === "90" ? 90 : 30;
}

/** Une ligne GROUPÉE rendue par la base : `n` rendez-vous identiques sur ces axes. */
export interface LigneBilanBrute {
  readonly typeRendezVous: string | null;
  readonly eventTypeName: string | null;
  readonly utmContent: string | null;
  readonly status: string;
  readonly issue: string | null;
  /** La rencontre née du rendez-vous est rangée (validée) sur une fiche client. */
  readonly fiche: boolean;
  /** … et cette fiche est cliente (active ou inactive), pas seulement prospect. */
  readonly client: boolean;
  /**
   * L'ANCIENNE ligne d'un rendez-vous déplacé (relecture A09) : Calendly crée
   * une nouvelle réservation et annule l'ancienne. Comptée, elle ferait
   * « 2 réservés, 1 annulé » pour un seul rendez-vous : elle est ignorée.
   */
  readonly reporte: boolean;
  readonly n: number;
}

export interface CompteursBilan {
  reserves: number;
  honores: number;
  absents: number;
  annules: number;
  fiches: number;
  clients: number;
}

export interface EmplacementBilan {
  /** `utm_content` normalisé (minuscules), `null` s'il est absent. */
  readonly cle: string | null;
  readonly libelle: string;
  readonly compteurs: CompteursBilan;
}

export interface BilanType {
  readonly type: Exclude<TypeRendezVous, "apporteur">;
  readonly total: CompteursBilan;
  readonly emplacements: readonly EmplacementBilan[];
}

export interface BilanRendezVous {
  readonly types: readonly BilanType[];
  /** Les échanges apporteurs, à part : ce ne sont pas des ventes. */
  readonly apporteur: CompteursBilan;
}

export type EtatBilan = "honore" | "absent" | "annule" | "en_attente";

/** L'issue d'un rendez-vous pour le bilan. Voir l'en-tête. */
export function etatDuRendezVous(status: string, issue: string | null): EtatBilan {
  if (status === "canceled") return "annule";
  if (issue === "eu_lieu") return "honore";
  if (issue === "absent") return "absent";
  if (issue) return "en_attente"; // reporté : ni honoré, ni absent
  if (status === "completed") return "honore";
  if (status === "no_show") return "absent";
  return "en_attente";
}

/**
 * Les emplacements connus, en clair. La clé est la partie APRÈS « : » de
 * `utm_content` (`diagnostic:accueil-hero` → `accueil-hero`).
 */
const LIBELLES_EMPLACEMENT: Readonly<Record<string, string>> = {
  "accueil-hero": "Accueil (haut de page)",
  "accueil-haut": "Accueil (haut de page)",
  "accueil-final": "Accueil (bas de page)",
  "accueil-bas": "Accueil (bas de page)",
  "accueil-mobile": "Accueil (mobile)",
  accueil: "Accueil",
  entete: "En-tête",
  "en-tete": "En-tête",
  header: "En-tête",
  "entete-mobile": "En-tête (mobile)",
  pied: "Pied de page",
  "pied-de-page": "Pied de page",
  footer: "Pied de page",
  chatbot: "Chatbot",
  email: "E-mail",
  "e-mail": "E-mail",
  "email-contact": "E-mail contact",
  "email-salon": "E-mail salon",
  "salon-email": "E-mail salon",
  "page-audit": "Page audit",
  "page-formation": "Page formations",
  "page-coaching": "Page coaching",
  "page-integration": "Page intégration",
  faq: "FAQ",
};

/** Les valeurs posées par le bouton de `/appel` quand aucun emplacement n'est connu. */
const CHOIX_SANS_EMPLACEMENT = new Set(["diagnostic", "projet"]);

function normaliserUtm(utm: string | null | undefined): string | null {
  const v = utm?.trim().toLowerCase();
  return v ? v : null;
}

/** Le libellé humain d'un `utm_content` ; la valeur brute s'il est inconnu. */
export function libelleEmplacement(utmContent: string | null | undefined): string {
  const v = normaliserUtm(utmContent);
  if (!v) return "Non renseigné";
  if (CHOIX_SANS_EMPLACEMENT.has(v)) return "Page rendez-vous";
  const i = v.indexOf(":");
  const emplacement = i === -1 ? v : v.slice(i + 1);
  return LIBELLES_EMPLACEMENT[emplacement] ?? utmContent?.trim() ?? v;
}

function zero(): CompteursBilan {
  return { reserves: 0, honores: 0, absents: 0, annules: 0, fiches: 0, clients: 0 };
}

function ajouter(c: CompteursBilan, l: LigneBilanBrute): void {
  const n = Number.isFinite(l.n) && l.n > 0 ? l.n : 0;
  c.reserves += n;
  const etat = etatDuRendezVous(l.status, l.issue);
  if (etat === "honore") c.honores += n;
  if (etat === "absent") c.absents += n;
  if (etat === "annule") c.annules += n;
  if (l.fiche) c.fiches += n;
  if (l.fiche && l.client) c.clients += n;
}

/** Ordre d'affichage ; « Autre » n'apparaît que s'il porte au moins un rendez-vous. */
const TYPES_DU_BILAN = ["diagnostic", "echange_projet", "salon", "autre"] as const;

/** Agrège les lignes groupées par type puis par emplacement. */
export function agregerBilan(lignes: readonly LigneBilanBrute[]): BilanRendezVous {
  const apporteur = zero();
  const parType = new Map<
    BilanType["type"],
    { total: CompteursBilan; emplacements: Map<string, EmplacementBilan> }
  >();
  for (const t of TYPES_DU_BILAN) parType.set(t, { total: zero(), emplacements: new Map() });

  for (const l of lignes) {
    // Un rendez-vous déplacé ne compte qu'une fois : par sa nouvelle ligne.
    if (l.reporte) continue;
    const type = typeEffectif(l);
    if (type === "apporteur") {
      ajouter(apporteur, l);
      continue;
    }
    const groupe = parType.get(type);
    if (!groupe) continue;
    ajouter(groupe.total, l);
    const cle = normaliserUtm(l.utmContent);
    const k = cle ?? "";
    let e = groupe.emplacements.get(k);
    if (!e) {
      e = { cle, libelle: libelleEmplacement(l.utmContent), compteurs: zero() };
      groupe.emplacements.set(k, e);
    }
    ajouter(e.compteurs, l);
  }

  const types: BilanType[] = [];
  for (const t of TYPES_DU_BILAN) {
    const g = parType.get(t);
    if (!g) continue;
    if (t === "autre" && g.total.reserves === 0) continue;
    types.push({
      type: t,
      total: g.total,
      emplacements: [...g.emplacements.values()].sort(
        (a, b) => b.compteurs.reserves - a.compteurs.reserves,
      ),
    });
  }
  return { types, apporteur };
}
