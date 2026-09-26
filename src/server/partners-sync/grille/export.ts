/**
 * export.ts — la grille de commission publiée vers Axion Partners (DM-03-A).
 *
 * REQ-DM-014 (qui absorbe REQ-ARG-031, REQ-GOV-019, REQ-JUR-019) et REQ-INT-017 : la
 * grille a UNE source, `src/content/pricing.ts`. Ce module en DÉRIVE un contenu
 * canonique et son empreinte SHA-256 ; `scripts/gates/grille-check.ts --publier` l'écrit
 * dans `commissions.v<N>.json`, à côté de ce fichier ; Partners importe chaque version
 * telle quelle (DM-03-P) et recalcule l'empreinte sur le contenu reçu.
 *
 * 🔑 AUCUNE VALEUR N'EST RETAPÉE. Les montants viennent de `COMMERCIAL_COMMISSIONS`, les
 * paliers de `PRICING_CATEGORIES` (+ `UN_A_UN_RECURRING_TIER`), les barèmes indéfinis de
 * `BAREMES_INDEFINIS`. Ce fichier ne contient aucun montant.
 *
 * 🔑 ARGENT EN ENTIERS, HT. Un forfait sort en `montantCents` (centimes HT, entier) et un
 * pourcentage en `tauxBps` (points de base, entier : 30 % = 3000). Aucun flottant ne
 * traverse la frontière : la représentation textuelle d'un flottant n'est pas stable,
 * et l'empreinte ne le serait plus. Une valeur qui ne se convertit pas EXACTEMENT en
 * entier est une anomalie nommée — jamais un arrondi silencieux.
 *
 * 🔑 AUCUN DÉFAUT SUR UN BARÈME MANQUANT (partners/ADR-0003 §5, HYP-W6-BIS). Un palier
 * sans taux sort avec `statut: "bareme_indefini"` et aucun montant : c'est un blocage,
 * jamais un zéro. S'il n'est pas DÉCLARÉ dans `BAREMES_INDEFINIS`, il sort quand même
 * bloqué (motif `non_declare`) — et la garde de cohérence rougit.
 *
 * Aucun accès base, aucun appel réseau. L'alerte au démarrage est INERTE sans
 * `PARTNERS_SYNC_ENABLED=true`.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BAREMES_INDEFINIS,
  COMMERCIAL_COMMISSIONS,
  PRICING_CATEGORIES,
  UN_A_UN_RECURRING_TIER,
  type BaremeIndefini,
  type CommercialCommission,
  type MotifBaremeIndefini,
  type PricingTier,
} from "@/content/pricing";
import { estPartnersSyncActif } from "@/server/partners/config";
import { GRILLE_VERSION } from "@/server/partners/commission";

// ─────────────────────────────────────────────────────────────────────────────
// La forme exportée — c'est elle que DM-03-P importe
// ─────────────────────────────────────────────────────────────────────────────

/** Version de la FORME du contenu (pas de la grille). Change si un champ change. */
export const SCHEMA_GRILLE = 1;

export type LigneCommission = {
  readonly commissionId: string;
  readonly libelleFr: string;
  /** Vocabulaire de `CommercialCommission.kind`, recopié tel quel (AFF-26). */
  readonly kind: "flat" | "percent" | "scale";
  /** Centimes HT, entier. Non nul si et seulement si `kind === "flat"`. */
  readonly montantCents: number | null;
  /** Points de base, entier (30 % = 3000). Non nul si et seulement si `kind === "percent"`. */
  readonly tauxBps: number | null;
};

export type LignePalier = {
  readonly tierId: string;
  /** Clé de `PRICING_CATEGORIES`, ou `hors_categories` pour `UN_A_UN_RECURRING_TIER`. */
  readonly categorie: string;
  readonly commissionId: string | null;
  readonly statut: "taux" | "bareme_indefini";
  /** Nul si `statut === "taux"`. */
  readonly baremeIndefini: {
    /** AAAA-MM-JJ ; nul seulement pour un palier NON DÉCLARÉ (anomalie). */
    readonly depuis: string | null;
    readonly motif: MotifBaremeIndefini | "non_declare";
  } | null;
};

export type ContenuGrille = {
  readonly schema: number;
  readonly unites: { readonly montant: "centimes_ht"; readonly taux: "points_de_base" };
  /**
   * La valeur `grilleVersion` que portent les événements (`src/server/partners/commission.ts`,
   * 12 hex). Recopiée ici pour que Partners relie une commission reçue à cette version
   * de grille. DÉRIVÉE : importée, jamais écrite.
   */
  readonly grilleVersionEvenement: string;
  /** Triées par `commissionId`. */
  readonly commissions: ReadonlyArray<LigneCommission>;
  /** Triés par `tierId`. */
  readonly paliers: ReadonlyArray<LignePalier>;
};

/** Le fichier `commissions.v<N>.json`. `hash` = SHA-256 hex de `canonique(contenu)`. */
export type PublicationGrille = {
  readonly version: number;
  readonly publieeAt: string;
  readonly hash: string;
  readonly contenu: ContenuGrille;
};

// ─────────────────────────────────────────────────────────────────────────────
// Les entrées — injectables, pour que la garde se prouve sur des défauts
// ─────────────────────────────────────────────────────────────────────────────

export type PalierSource = { readonly categorie: string; readonly tier: PricingTier };

export type EntreesGrille = {
  readonly commissions: ReadonlyArray<CommercialCommission>;
  readonly paliers: ReadonlyArray<PalierSource>;
  readonly baremesIndefinis: ReadonlyArray<BaremeIndefini>;
  readonly grilleVersionEvenement: string;
};

/** Les entrées RÉELLES, lues dans `pricing.ts`. */
export function entreesDepuisPricing(): EntreesGrille {
  const paliers: PalierSource[] = [];
  for (const [categorie, tiers] of Object.entries(PRICING_CATEGORIES)) {
    for (const tier of tiers) paliers.push({ categorie, tier });
  }
  paliers.push({ categorie: "hors_categories", tier: UN_A_UN_RECURRING_TIER });
  return {
    commissions: COMMERCIAL_COMMISSIONS,
    paliers,
    baremesIndefinis: BAREMES_INDEFINIS,
    grilleVersionEvenement: GRILLE_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion en entiers — exacte ou refusée
// ─────────────────────────────────────────────────────────────────────────────

/** `valeur × 100` s'il est un entier sûr EXACT, sinon `null`. */
function centuple(valeur: number | undefined): number | null {
  if (valeur === undefined || !Number.isFinite(valeur)) return null;
  const n = Math.round(valeur * 100);
  // Exactitude : 12,345 € ne devient pas 1235 centimes en silence.
  if (!Number.isSafeInteger(n) || n / 100 !== valeur) return null;
  return n;
}

function ligneCommission(c: CommercialCommission): LigneCommission {
  return {
    commissionId: c.id,
    libelleFr: c.labelFr,
    kind: c.kind,
    montantCents: c.kind === "flat" ? centuple(c.flatEur) : null,
    tauxBps: c.kind === "percent" ? centuple(c.percent) : null,
  };
}

/** Une commission qui porte un taux exploitable (forfait > 0 ou pourcentage dans ]0, 100 %]). */
function porteUnTaux(l: LigneCommission): boolean {
  if (l.kind === "flat") return l.montantCents !== null && l.montantCents > 0;
  if (l.kind === "percent") return l.tauxBps !== null && l.tauxBps > 0 && l.tauxBps <= 10_000;
  return false;
}

const parId = <T>(xs: ReadonlyArray<T>, cle: (x: T) => string): Map<string, T> =>
  new Map(xs.map((x) => [cle(x), x]));

// ─────────────────────────────────────────────────────────────────────────────
// Le contenu
// ─────────────────────────────────────────────────────────────────────────────

export function construireContenuGrille(e: EntreesGrille = entreesDepuisPricing()): ContenuGrille {
  const commissions = e.commissions
    .map(ligneCommission)
    .sort((a, b) =>
      a.commissionId < b.commissionId ? -1 : a.commissionId > b.commissionId ? 1 : 0,
    );
  const commissionsParId = parId(commissions, (c) => c.commissionId);
  const declares = parId(e.baremesIndefinis, (b) => b.tierId);

  const paliers: LignePalier[] = e.paliers.map(({ categorie, tier }) => {
    const commissionId = tier.commissionId ?? null;
    const commission = commissionId === null ? undefined : commissionsParId.get(commissionId);
    const declare = declares.get(tier.id);
    if (commission !== undefined && porteUnTaux(commission) && declare === undefined) {
      return { tierId: tier.id, categorie, commissionId, statut: "taux", baremeIndefini: null };
    }
    // Tout le reste BLOQUE : déclaré, ou non déclaré (anomalie que la garde nomme).
    return {
      tierId: tier.id,
      categorie,
      commissionId,
      statut: "bareme_indefini",
      baremeIndefini:
        declare !== undefined
          ? { depuis: declare.depuis, motif: declare.motif }
          : { depuis: null, motif: "non_declare" },
    };
  });
  paliers.sort((a, b) => (a.tierId < b.tierId ? -1 : a.tierId > b.tierId ? 1 : 0));

  return {
    schema: SCHEMA_GRILLE,
    unites: { montant: "centimes_ht", taux: "points_de_base" },
    grilleVersionEvenement: e.grilleVersionEvenement,
    commissions,
    paliers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La garde de COHÉRENCE (HYP-W6-BIS) — chaque palier : un taux, ou un barème indéfini daté
// ─────────────────────────────────────────────────────────────────────────────

export type CodeAnomalie =
  | "palier_absent"
  | "palier_en_double"
  | "commission_en_double"
  | "commission_inconnue"
  | "montant_invalide"
  | "double_statut"
  | "sans_taux_non_declare"
  | "entree_orpheline"
  | "entree_en_double"
  | "date_invalide"
  | "motif_invalide"
  | "basis_incoherent";

export type AnomalieGrille = {
  readonly code: CodeAnomalie;
  readonly id: string;
  readonly message: string;
};

const MOTIFS: ReadonlySet<string> = new Set<MotifBaremeIndefini>([
  "hors_perimetre_w6",
  "bareme_non_publie",
  "palier_sans_bareme",
]);

/** AAAA-MM-JJ ET date réelle (pas de 2026-02-30). */
function estDateIso(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function doublons<T>(xs: ReadonlyArray<T>, cle: (x: T) => string): string[] {
  const vus = new Set<string>();
  const doubles = new Set<string>();
  for (const x of xs) {
    const k = cle(x);
    if (vus.has(k)) doubles.add(k);
    vus.add(k);
  }
  return [...doubles];
}

export function verifierCoherenceGrille(
  e: EntreesGrille = entreesDepuisPricing(),
): AnomalieGrille[] {
  const anomalies: AnomalieGrille[] = [];
  const a = (code: CodeAnomalie, id: string, message: string): void => {
    anomalies.push({ code, id, message });
  };

  for (const id of doublons(e.commissions, (c) => c.id))
    a("commission_en_double", id, `la commission « ${id} » est déclarée plusieurs fois`);
  for (const id of doublons(e.paliers, (p) => p.tier.id))
    a("palier_en_double", id, `le palier « ${id} » est déclaré plusieurs fois`);
  for (const id of doublons(e.baremesIndefinis, (b) => b.tierId))
    a("entree_en_double", id, `BAREMES_INDEFINIS nomme « ${id} » plusieurs fois`);

  const lignes = parId(e.commissions.map(ligneCommission), (l) => l.commissionId);
  for (const c of e.commissions) {
    const l = lignes.get(c.id)!;
    if (c.kind === "flat" && (l.montantCents === null || l.montantCents <= 0))
      a(
        "montant_invalide",
        c.id,
        `forfait « ${c.id} » : flatEur=${String(c.flatEur)} ne donne pas un entier de centimes > 0`,
      );
    if (c.kind === "percent" && (l.tauxBps === null || l.tauxBps <= 0 || l.tauxBps > 10_000))
      a(
        "montant_invalide",
        c.id,
        `pourcentage « ${c.id} » : percent=${String(c.percent)} ne donne pas un entier de points de base dans ]0, 10000]`,
      );
  }

  const paliersParId = parId(e.paliers, (p) => p.tier.id);
  const declares = parId(e.baremesIndefinis, (b) => b.tierId);

  for (const { tier } of e.paliers) {
    const commissionId = tier.commissionId;
    const declare = declares.get(tier.id);
    let aUnTaux = false;
    if (commissionId !== undefined) {
      const l = lignes.get(commissionId);
      if (l === undefined) {
        a(
          "commission_inconnue",
          tier.id,
          `le palier « ${tier.id} » vise la commission « ${commissionId} », absente de COMMERCIAL_COMMISSIONS`,
        );
      } else {
        aUnTaux = porteUnTaux(l);
      }
    }
    if (aUnTaux && declare !== undefined) {
      a(
        "double_statut",
        tier.id,
        `le palier « ${tier.id} » a un taux (${String(commissionId)}) ET une entrée BAREMES_INDEFINIS — l'un ou l'autre`,
      );
    } else if (!aUnTaux && declare === undefined) {
      if (commissionId === undefined) {
        a(
          "palier_absent",
          tier.id,
          `le palier « ${tier.id} » n'a ni commissionId ni entrée datée dans BAREMES_INDEFINIS`,
        );
      } else {
        a(
          "sans_taux_non_declare",
          tier.id,
          `le palier « ${tier.id} » vise « ${commissionId} », qui ne porte pas de taux, sans entrée datée dans BAREMES_INDEFINIS`,
        );
      }
    }
  }

  for (const b of e.baremesIndefinis) {
    if (!paliersParId.has(b.tierId))
      a(
        "entree_orpheline",
        b.tierId,
        `BAREMES_INDEFINIS nomme « ${b.tierId} », qui n'est pas un palier de pricing.ts`,
      );
    if (!estDateIso(b.depuis))
      a(
        "date_invalide",
        b.tierId,
        `BAREMES_INDEFINIS « ${b.tierId} » : date « ${b.depuis} » (attendu AAAA-MM-JJ réel)`,
      );
    if (!MOTIFS.has(b.motif))
      a(
        "motif_invalide",
        b.tierId,
        `BAREMES_INDEFINIS « ${b.tierId} » : motif « ${String(b.motif)} » hors vocabulaire`,
      );
  }

  for (const c of e.commissions) {
    if (c.basisTierId === undefined) continue;
    const p = paliersParId.get(c.basisTierId);
    if (p === undefined || p.tier.commissionId !== c.id)
      a(
        "basis_incoherent",
        c.id,
        `la commission « ${c.id} » prend « ${c.basisTierId} » pour exemple, mais ce palier ${p === undefined ? "n'existe pas" : `porte commissionId « ${String(p.tier.commissionId)} »`}`,
      );
  }

  return anomalies;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonique + empreinte
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON canonique : clés triées par point de code UTF-16, aucun espace, entiers sûrs
 * seulement. Sous-ensemble de RFC 8785 (JCS), le MÊME que `src/domain/evenement/canonique.ts`
 * côté Partners, qui recalcule l'empreinte à l'import (DM-03-P point 7). Porté ici et non
 * importé depuis `src/server/qualiopi/emargement/canonical.ts` : l'isolation qualiopi
 * interdit ce chemin d'import. Tout ce qui n'est pas canonicalisable LÈVE.
 */
export function canonique(valeur: unknown, chemin = ""): string {
  if (valeur === null) return "null";
  switch (typeof valeur) {
    case "string":
      return JSON.stringify(valeur);
    case "boolean":
      return valeur ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(valeur))
        throw new Error(
          `[grille] non canonicalisable en « ${chemin || "(racine)"} » : seuls les entiers sûrs sont admis`,
        );
      return String(valeur === 0 ? 0 : valeur);
    case "object":
      break;
    default:
      throw new Error(
        `[grille] non canonicalisable en « ${chemin || "(racine)"} » : type ${typeof valeur}`,
      );
  }
  if (Array.isArray(valeur))
    return `[${valeur.map((v, i) => canonique(v, `${chemin}[${i}]`)).join(",")}]`;
  const proto: unknown = Object.getPrototypeOf(valeur);
  if (proto !== Object.prototype && proto !== null)
    throw new Error(
      `[grille] non canonicalisable en « ${chemin || "(racine)"} » : objet non simple`,
    );
  const o = valeur as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonique(o[k], chemin ? `${chemin}.${k}` : k)}`)
    .join(",")}}`;
}

/** SHA-256 hex (64 minuscules) du JSON canonique du contenu — le `hash` publié. */
export function empreinteGrille(contenu: ContenuGrille): string {
  return createHash("sha256").update(canonique(contenu), "utf8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Les publications sur disque — `commissions.v<N>.json`, à côté de ce fichier
// ─────────────────────────────────────────────────────────────────────────────

function dossierModule(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.cwd(), "src", "server", "partners-sync", "grille");
  }
}

export const MOTIF_FICHIER = /^commissions\.v([1-9]\d*)\.json$/;

export function dossierPublications(): string {
  return dossierModule();
}

/** Toutes les publications du dossier, triées par version croissante. */
export function lirePublications(dossier: string = dossierPublications()): PublicationGrille[] {
  const pubs: PublicationGrille[] = [];
  for (const nom of readdirSync(dossier)) {
    const m = MOTIF_FICHIER.exec(nom);
    if (m === null) continue;
    const pub = JSON.parse(readFileSync(path.join(dossier, nom), "utf8")) as PublicationGrille;
    if (pub.version !== Number(m[1]))
      throw new Error(
        `[grille] ${nom} porte version=${String(pub.version)} : le nom et le contenu divergent`,
      );
    pubs.push(pub);
  }
  return pubs.sort((x, y) => x.version - y.version);
}

/** Les défauts d'une série de publications : empreinte, suite des versions, date. */
export function verifierPublications(pubs: ReadonlyArray<PublicationGrille>): string[] {
  const defauts: string[] = [];
  pubs.forEach((p, i) => {
    if (p.version !== i + 1)
      defauts.push(`v${p.version} : versions non contiguës (attendu v${i + 1})`);
    if (!/^[0-9a-f]{64}$/.test(p.hash))
      defauts.push(`v${p.version} : hash « ${p.hash} » n'est pas un SHA-256 hex`);
    else if (empreinteGrille(p.contenu) !== p.hash)
      defauts.push(
        `v${p.version} : hash embarqué ${p.hash} ≠ hash recalculé ${empreinteGrille(p.contenu)}`,
      );
    if (
      Number.isNaN(Date.parse(p.publieeAt)) ||
      new Date(p.publieeAt).toISOString() !== p.publieeAt
    )
      defauts.push(`v${p.version} : publieeAt « ${p.publieeAt} » n'est pas un horodatage ISO UTC`);
  });
  return defauts;
}

/** La publication suivante, ou `null` si le contenu n'a pas changé depuis la dernière. */
export function prochainePublication(
  pubs: ReadonlyArray<PublicationGrille>,
  contenu: ContenuGrille,
  maintenant: Date,
): PublicationGrille | null {
  const hash = empreinteGrille(contenu);
  const derniere = pubs.at(-1);
  if (derniere !== undefined && derniere.hash === hash) return null;
  return {
    version: (derniere?.version ?? 0) + 1,
    publieeAt: maintenant.toISOString(),
    hash,
    contenu,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// L'alerte au démarrage (HYP-W6-BIS) — inerte sans PARTNERS_SYNC_ENABLED
// ─────────────────────────────────────────────────────────────────────────────

export type RapportDemarrage = {
  readonly actif: boolean;
  readonly baremesIndefinis: ReadonlyArray<string>;
  readonly anomalies: ReadonlyArray<AnomalieGrille>;
};

/**
 * Appelée au démarrage du serveur Node (`src/instrumentation.ts`). Liste les paliers
 * dont la commission est BLOQUÉE (barème indéfini) et les anomalies de cohérence.
 * N'écrit rien, n'envoie rien ; sans `PARTNERS_SYNC_ENABLED=true`, ne calcule même rien.
 */
export function alerterBaremesIndefinisAuDemarrage(
  alerter: (message: string) => void = (m) => console.warn(m),
  e?: EntreesGrille,
): RapportDemarrage {
  if (!estPartnersSyncActif()) return { actif: false, baremesIndefinis: [], anomalies: [] };
  const entrees = e ?? entreesDepuisPricing();
  const contenu = construireContenuGrille(entrees);
  const anomalies = verifierCoherenceGrille(entrees);
  const indefinis = contenu.paliers.filter((p) => p.statut === "bareme_indefini");
  if (indefinis.length > 0) {
    alerter(
      `[partners:grille] ${indefinis.length} palier(s) en barème indéfini — commission BLOQUÉE : ` +
        indefinis.map((p) => `${p.tierId} (${p.baremeIndefini?.motif ?? "?"})`).join(", "),
    );
  }
  if (anomalies.length > 0) {
    alerter(
      `[partners:grille] ${anomalies.length} anomalie(s) de cohérence : ` +
        anomalies.map((x) => `${x.code}:${x.id}`).join(", "),
    );
  }
  return { actif: true, baremesIndefinis: indefinis.map((p) => p.tierId), anomalies };
}
