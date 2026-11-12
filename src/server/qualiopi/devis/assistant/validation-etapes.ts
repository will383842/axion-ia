/**
 * Validation par étape de l'assistant de création de devis (fiche S03).
 *
 * PUR et client-safe : aucun import prisma. Aucun montant n'est calculé ici : les conversions
 * texte → centimes passent par `normaliserEuros` + `eurosVersCents`, les totaux par
 * `computeTotauxFacture`, la validité d'une offre à formules par `construireOffre` (dont les
 * messages sont repris tels quels). Le serveur rejoue `validerEtape(p, 4, ctx)` à la
 * numérotation : la validation des écrans n'est qu'un confort.
 *
 * `validerEtape(p, n, ctx)` est CUMULATIVE : elle vérifie les étapes 1 à n.
 *
 * Décisions (DECISIONS-D1-D2-ARCHITECTE.md) :
 *  - D1 : les lignes de l'étape 1 alimentent la formule A (ou la mise en service de B seule) ;
 *    la mise en service de B en « A + B » est un montant saisi, une seule ligne, jamais à 0 €.
 *  - D2/S03 : AUCUNE automatisation neuve ; seules passent celles déjà présentes, à l'identique,
 *    dans l'offre du devis rouvert (`ctx.automatisationsHeritees`).
 *  - D3 : maintenance 1, 2, 6 ou 12 mois, montant > 0 ; D8 : validité de J+7 à J+90.
 *  - Aucun montant d'IA dans `nonImprime`.
 */
import {
  construireOffre,
  eurosVersCents,
  type LigneSaisie,
  type SaisieFormules,
} from "@/components/admin/qualiopi/devis-formules/saisie";
import { CENTS_MAX } from "@/server/qualiopi/devis/offre-devis";
import { computeTotauxFacture, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import { normaliserEuros, type EtapeAssistant, type PayloadAssistantV1 } from "./payload";

export interface ErreurChamp {
  champ: string;
  message: string;
}

export interface ContexteValidation {
  /** Interrupteur `devis_formules`. */
  formulesActives: boolean;
  typeClient: "entreprise" | "particulier" | null;
  maintenant: Date;
  /** Taux de TVA standard reçu du serveur (défaut : `TAUX_TVA_STANDARD`). Jamais saisi. */
  tauxStandard?: number;
  /**
   * Automatisations de l'offre EN BASE du devis rouvert. Seules celles-ci (comparées à
   * l'identique) peuvent figurer dans le brouillon ; toute autre est refusée (D1 architecte).
   */
  automatisationsHeritees?: readonly unknown[];
}

export const VALIDITE_MIN_JOURS = 7;
export const VALIDITE_MAX_JOURS = 90;
const PERIODES_PERMISES: readonly number[] = [1, 2, 6, 12];
const ACTIVITES_FORMULES = ["implementation", "site_web"] as const;
const JOUR_MS = 86_400_000;

type Erreurs = ErreurChamp[];
const err = (e: Erreurs, champ: string, message: string) => e.push({ champ, message });

/** Quantité : positive, 2 décimales au plus (règle du schéma). */
function lireQuantite(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

function lirePrixCents(s: string): number | null {
  const c = eurosVersCents(normaliserEuros(s));
  return c !== null && c <= CENTS_MAX ? c : null;
}

// ───────────────────────── étape 1 : pour qui, quoi ─────────────────────────

function validerLignes(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  if (p.lignesClassiques.length === 0) {
    err(e, "lignesClassiques", "Ajoutez au moins une ligne au devis.");
    return;
  }
  const lignes: Array<{ quantite: number; prixUnitaireHtCents: number }> = [];
  let toutesLisibles = true;
  p.lignesClassiques.forEach((l, i) => {
    const base = `lignesClassiques.${i}`;
    if (l.designation.trim() === "")
      err(e, `${base}.designation`, "Désignation de la ligne requise.");
    const quantite = lireQuantite(l.quantite);
    if (quantite === null) {
      toutesLisibles = false;
      err(e, `${base}.quantite`, "Quantité illisible (positive, 2 décimales au plus).");
    }
    const prix = lirePrixCents(l.prixEur);
    if (prix === null) {
      toutesLisibles = false;
      err(e, `${base}.prixEur`, "Prix illisible (euros, 2 décimales au plus, positif).");
    }
    if (quantite !== null && prix !== null) lignes.push({ quantite, prixUnitaireHtCents: prix });
  });
  // Un total à 0 € est refusé, sauf pour B seule où les lignes forment la mise en service
  // (le garde de B porte sur son mensuel, cf. étape 3).
  const exigeTotal = p.typeDevis !== "formules" || p.formules.formules.achat;
  if (exigeTotal && toutesLisibles) {
    const total = computeTotauxFacture(lignes, "assujetti", ctx.tauxStandard).totalHtCents;
    if (total <= 0) err(e, "lignesClassiques", "Le total du devis ne peut pas être de 0 €.");
  }
}

function validerEtape1(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  if (!p.clientId) err(e, "clientId", "Choisissez le client.");
  if (!p.activite) err(e, "activite", "Choisissez l'activité du devis.");
  validerLignes(p, ctx, e);
}

// ───────────────────────── étape 2 : type de devis ─────────────────────────

function validerEtape2(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  if (!p.typeDevis) {
    err(e, "typeDevis", "Choisissez le type de devis.");
    return;
  }
  if (p.typeDevis !== "formules") return;
  if (ctx.typeClient === "particulier")
    err(e, "typeDevis", "Les formules ne sont pas proposées à un particulier.");
  if (!p.activite || !(ACTIVITES_FORMULES as readonly string[]).includes(p.activite))
    err(
      e,
      "typeDevis",
      "Les formules sont réservées aux activités « mise en place d'une IA » et « site web ».",
    );
  if (!ctx.formulesActives) err(e, "typeDevis", "Les devis à formules ne sont pas activés.");
  if (!p.formules.formules.achat && !p.formules.formules.abonnement)
    err(e, "formules.formules", "Choisissez au moins une formule.");
}

// ───────────────────────── étape 3 : détail ─────────────────────────

/** Comparaison structurelle indépendante de l'ordre des clés. */
function empreinte(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(empreinte).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${empreinte(x)}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

/**
 * LISTE BLANCHE des clés d'IA permises dans `nonImprime` (D2 architecte : un choix, jamais un
 * tarif). Toute clé dont un jeton est « ia » doit être la clé `ia`, et tout ce qui se trouve
 * dessous est refusé sauf :
 *  - `achat` / `abonnement` : conteneurs par formule (objet, ou simple chaîne de mode) ;
 *  - `mode`, `niveau` : textes courts ; `inclus` : booléen ;
 *  - `mois` : nombre de mois, entier de 0 à 120.
 * Tout autre champ (numérique, monétaire ou non : `valeur`, `budget`, `forfait`…) est refusé.
 */
const CLES_IA_CONTENEURS = new Set(["achat", "abonnement"]);
const CLES_IA_TEXTE = new Set(["mode", "niveau"]);
const CLE_IA_BOOLEEN = "inclus";
const CLE_IA_MOIS = "mois";
const MOIS_IA_MAX = 120;
const TEXTE_IA_MAX = 40;
const jetons = (cle: string): string[] =>
  cle
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Valeur permise sous une clé de la liste blanche (conteneur = objet ou chaîne de mode). */
function feuilleIAValide(cle: string, v: unknown): boolean {
  if (CLES_IA_TEXTE.has(cle)) return typeof v === "string" && v.length <= TEXTE_IA_MAX;
  if (cle === CLE_IA_BOOLEEN) return typeof v === "boolean";
  if (cle === CLE_IA_MOIS)
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MOIS_IA_MAX;
  return false;
}

/** Parcourt un sous-arbre `ia` ; rend le chemin du premier champ hors liste blanche. */
function intrusIA(v: unknown, chemin: string, conteneur: boolean): string | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    // Un conteneur (achat/abonnement) peut être une simple chaîne de mode.
    return conteneur && typeof v === "string" && v.length <= TEXTE_IA_MAX ? null : chemin;
  }
  for (const [cle, x] of Object.entries(v as Record<string, unknown>)) {
    const ici = `${chemin}.${cle}`;
    if (CLES_IA_CONTENEURS.has(cle) && chemin === "nonImprime.ia") {
      const r = intrusIA(x, ici, true);
      if (r) return r;
    } else if (!feuilleIAValide(cle, x)) return ici;
  }
  return null;
}

/** Chemin du premier champ d'IA hors liste blanche dans `nonImprime`, s'il y en a un. */
function montantIA(v: Record<string, unknown>): string | null {
  const parcourir = (x: unknown, chemin: string): string | null => {
    if (!x || typeof x !== "object") return null;
    const entrees = Array.isArray(x)
      ? x.map((y, i): [string, unknown] => [String(i), y])
      : Object.entries(x as Record<string, unknown>);
    for (const [cle, y] of entrees) {
      const ici = `${chemin}.${cle}`;
      if (jetons(cle).includes("ia")) {
        // La seule clé d'IA permise est `ia`, à la racine de `nonImprime`.
        if (cle !== "ia" || chemin !== "nonImprime") return ici;
        const r = intrusIA(y, ici, false);
        if (r) return r;
      } else {
        const r = parcourir(y, ici);
        if (r) return r;
      }
    }
    return null;
  };
  return parcourir(v, "nonImprime");
}

/** Montant saisi vide, ou nul (« 0 », « 0,00 ») une fois normalisé. */
function estVideOuZero(prixEur: string): boolean {
  const t = normaliserEuros(prixEur);
  return t === "" || eurosVersCents(t) === 0;
}

/**
 * Saisie à convertir en offre, selon la décision D1 de l'architecte. Exportée pour que la
 * conversion (S04) n'ait pas de second convertisseur :
 *  - A (seule ou A + B) : lignes de l'étape 1 → `achat.lignes` ;
 *  - B seule : lignes de l'étape 1 → mise en service ;
 *  - A + B : mise en service = montant saisi (une ligne) ; champ vide = aucune ligne ;
 *  - taux de chaque ligne et de l'abonnement = taux standard reçu, jamais saisi.
 */
export function saisieFormulesPourOffre(
  p: PayloadAssistantV1,
  tauxStandard: number = TAUX_TVA_STANDARD,
): SaisieFormules {
  const taux = String(tauxStandard);
  // `eurosVersCents` ne gère pas les espaces (« 1 190 » → illisible) : toujours normaliser avant.
  const ligne = (l: LigneSaisie): LigneSaisie => ({
    ...l,
    prixEur: normaliserEuros(l.prixEur),
    tauxTvaPct: taux,
  });
  const deEtape1 = (): LigneSaisie[] =>
    p.lignesClassiques.map((l) =>
      ligne({ libelle: l.designation, quantite: l.quantite, prixEur: l.prixEur, tauxTvaPct: taux }),
    );
  const f = p.formules;
  // « A + B » : champ vide, « 0 » ou « 0,00 » = aucune ligne (jamais une ligne à 0 €).
  const miseEnService: LigneSaisie[] = f.formules.achat
    ? f.abonnement.lignes.filter((l) => !estVideOuZero(l.prixEur)).map(ligne)
    : deEtape1();
  return {
    ...f,
    achat: {
      ...f.achat,
      lignes: deEtape1(),
      hebergementMensuelEur: normaliserEuros(f.achat.hebergementMensuelEur),
      maintenance: {
        ...f.achat.maintenance,
        mensuelEur: normaliserEuros(f.achat.maintenance.mensuelEur),
      },
    },
    abonnement: {
      ...f.abonnement,
      lignes: miseEnService,
      tauxTvaPct: taux,
      mensuelCatalogueEur: normaliserEuros(f.abonnement.mensuelCatalogueEur),
    },
  };
}

function validerAutomatisations(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  const permises = new Set((ctx.automatisationsHeritees ?? []).map(empreinte));
  p.formules.automatisations.forEach((a, i) => {
    if (!permises.has(empreinte(a)))
      err(
        e,
        `formules.automatisations.${i}`,
        "Les options facultatives ne sont pas proposées dans cette version : retirez cette ligne.",
      );
  });
}

function validerPeriodes(periodes: readonly number[], champ: string, e: Erreurs): void {
  if (periodes.some((m) => !PERIODES_PERMISES.includes(m)))
    err(e, champ, "Les périodes possibles sont 1, 2, 6 ou 12 mois.");
}

function validerFormules(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  const s = saisieFormulesPourOffre(p, ctx.tauxStandard);
  validerAutomatisations(p, ctx, e);
  if (s.formules.achat && s.formules.abonnement) {
    // D1.4 : en « A + B », la mise en service de B est UN montant saisi : une ligne, quantité 1.
    const l = s.abonnement.lignes;
    if (l.length > 1)
      err(
        e,
        "formules.abonnement.lignes",
        "En formules A + B, la mise en service de B est un montant unique : une seule ligne.",
      );
    else if (l.length === 1 && lireQuantite(l[0]?.quantite ?? "") !== 1)
      err(e, "formules.abonnement.lignes", "La mise en service de B est de quantité 1.");
  }
  if (s.formules.achat) {
    validerPeriodes(s.achat.maintenance.periodes, "formules.achat.maintenance.periodes", e);
    if (lirePrixCents(s.achat.maintenance.mensuelEur) === 0)
      err(e, "formules.achat.maintenance.mensuelEur", "La maintenance doit être supérieure à 0 €.");
  }
  if (s.formules.abonnement) {
    validerPeriodes(
      s.abonnement.periodes.map((x) => x.mois),
      "formules.abonnement.periodes",
      e,
    );
    if (lirePrixCents(s.abonnement.mensuelCatalogueEur) === 0)
      err(
        e,
        "formules.abonnement.mensuelCatalogueEur",
        "Le mensuel de l'abonnement doit être supérieur à 0 €.",
      );
    if (s.abonnement.indemniteTauxPct.trim() === "")
      err(
        e,
        "formules.abonnement.indemniteTauxPct",
        "Indiquez l'indemnité de sortie (0 pour aucune indemnité).",
      );
  }
  const avant = e.length;
  const r = construireOffre(s, p.textes);
  // Messages du moteur repris tels quels, sans doublon avec les gardes ci-dessus.
  if (!r.ok && avant === e.length) for (const m of r.erreurs) err(e, "formules", m);
  else if (!r.ok)
    for (const m of r.erreurs) if (!e.some((x) => x.message === m)) err(e, "formules", m);
}

function validerEtape3(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  const ia = montantIA(p.nonImprime);
  if (ia)
    err(e, ia, "Aucun montant d'IA n'est accepté : le forfait IA n'a pas de place sur le devis.");
  if (p.typeDevis === "formules") validerFormules(p, ctx, e);
}

// ───────────────────────── étape 4 : validité ─────────────────────────

function validerEtape4(p: PayloadAssistantV1, ctx: ContexteValidation, e: Erreurs): void {
  if (p.dateValidite === null) return; // défaut du moteur (+30 jours)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.dateValidite);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (
    !m ||
    !d ||
    d.getUTCFullYear() !== Number(m[1]) ||
    d.getUTCMonth() !== Number(m[2]) - 1 ||
    d.getUTCDate() !== Number(m[3])
  ) {
    err(e, "dateValidite", "Date de validité illisible (AAAA-MM-JJ).");
    return;
  }
  const n = ctx.maintenant;
  const aujourdhui = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const jours = Math.round((d.getTime() - aujourdhui) / JOUR_MS);
  if (jours < VALIDITE_MIN_JOURS || jours > VALIDITE_MAX_JOURS)
    err(
      e,
      "dateValidite",
      `La validité doit être comprise entre ${VALIDITE_MIN_JOURS} et ${VALIDITE_MAX_JOURS} jours.`,
    );
}

export function validerEtape(
  p: PayloadAssistantV1,
  etape: EtapeAssistant,
  ctx: ContexteValidation,
): { ok: boolean; erreurs: ErreurChamp[] } {
  const erreurs: Erreurs = [];
  validerEtape1(p, ctx, erreurs);
  if (etape >= 2) validerEtape2(p, ctx, erreurs);
  if (etape >= 3) validerEtape3(p, ctx, erreurs);
  if (etape >= 4) validerEtape4(p, ctx, erreurs);
  return { ok: erreurs.length === 0, erreurs };
}
