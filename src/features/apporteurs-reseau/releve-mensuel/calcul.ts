/**
 * Relevé mensuel : le CALCUL. Module PUR (aucune base, aucun e-mail) : il reçoit des lignes DÉJÀ
 * lues et rend le contenu figé `ContenuReleveV1` plus les anomalies à montrer à l'écran.
 *
 * Règles (plan § 5) :
 * - le relevé est arrêté à `coupureAt` (1er M+1 00:00 Paris), à partir des DATES D'ÉVÈNEMENT : un
 *   virement daté après la coupure n'y change rien ; recalculer plus tard rend le même contenu ;
 * - montants en CENTIMES ENTIERS, arrondis au plus proche (la moitié s'éloigne de zéro) ;
 * - la TVA et les totaux sont LUS sur la pièce figée ; la règle et la version du contrat sont LUES
 *   sur la commission, jamais recalculées. Le relevé ne recalcule aucune commission ;
 * - aucune donnée personnelle dans le contenu, aucun identifiant interne.
 */

import {
  LIBELLE_PARRAINAGE,
  aVirerPartielCents,
  echeancePaiement,
  jourParis,
} from "../autofacture-donnees";
import { PALIERS_FORMATION } from "../regles";
import { jsonCanonique } from "./empreinte";
import { bornesPeriode, debutAnnee, exigerPeriodeClose } from "./periode";
import {
  CODES_REGLE_AFFICHABLES,
  FORMAT_VERSION_RELEVE,
  MENTION_PAS_UNE_FACTURE,
  type AnomalieReleve,
  type CodeRegleAffichable,
  type CommissionLue,
  type ContenuReleveV1,
  type EntreeReleve,
  type LigneReleve,
  type PieceLue,
  type PieceReleve,
  type RegleLue,
  type ReportEnAttenteAutofacture,
  type ReportFactureNonViree,
  type ReportIndicatif,
  type ResultatCalculReleve,
  type TotauxDenormalises,
  type VirementReleve,
} from "./types";

/** Arrondi au centime le plus proche ; la moitié s'éloigne de zéro ; jamais `-0`. */
export function arrondiAuCentime(valeur: number): number {
  const r = Math.sign(valeur) * Math.round(Math.abs(valeur));
  return r === 0 ? 0 : r;
}

// ── Normalisation de l'entrée ───────────────────────────────────────────────────────────────────

function entier(
  valeur: number | null,
  contexte: string,
  anomalies: AnomalieReleve[],
): number | null {
  if (valeur === null) return null;
  if (Number.isInteger(valeur)) return valeur;
  anomalies.push({
    code: "montant_non_entier",
    detail: `${contexte} : ${String(valeur)} arrondi au centime le plus proche`,
  });
  return arrondiAuCentime(valeur);
}

function normaliser(
  entree: EntreeReleve,
  anomalies: AnomalieReleve[],
): { commissions: CommissionLue[]; pieces: PieceLue[] } {
  const vus = new Set<string>();
  const commissions: CommissionLue[] = [];
  for (const c of entree.commissions) {
    if (vus.has(c.id)) continue; // jamais deux fois
    vus.add(c.id);
    commissions.push({
      ...c,
      montantCents: entier(c.montantCents, "montant d'une commission", anomalies),
      factureHtCents: entier(c.factureHtCents, "HT facturé", anomalies),
      prixPublicHtCents: entier(c.prixPublicHtCents, "prix public HT", anomalies),
    });
  }
  const pieces = entree.pieces.map((p) => ({
    ...p,
    totalHtCents: entier(p.totalHtCents, `HT de la pièce ${p.numero}`, anomalies),
    totalTvaCents: entier(p.totalTvaCents, `TVA de la pièce ${p.numero}`, anomalies),
    totalTtcCents: entier(p.totalTtcCents, `TTC de la pièce ${p.numero}`, anomalies),
  }));
  return { commissions, pieces };
}

// ── Libellés ────────────────────────────────────────────────────────────────────────────────────

const PRESTATION_PAR_ACTIVITE: Readonly<Record<string, string>> = {
  formation: "Formation",
  un_a_un: "Accompagnement 1-to-1",
  audit: "Audit",
  implementation: "Mise en service",
  site_web: "Site web",
  conference: "Conférence",
};

function prestation(c: CommissionLue): string | null {
  if (c.parrainage) return LIBELLE_PARRAINAGE;
  const palier = PALIERS_FORMATION.find((p) => p.id === c.palier);
  if (palier) return palier.libelle;
  return PRESTATION_PAR_ACTIVITE[c.activite] ?? "Prestation";
}

function libelleRegle(code: CodeRegleAffichable, c: CommissionLue): string {
  switch (code) {
    case "forfait_palier":
      return `Forfait du palier ${prestation(c) ?? "de la prestation"}`;
    case "prorata_remise":
      return "Forfait au prorata du prix facturé (art. 4.1 bis)";
    case "forfait_sessions":
      return "Forfait × nombre de sessions";
    case "taux_ht": {
      const base = c.factureHtCents ?? 0;
      const montant = c.montantCents ?? 0;
      if (base > 0 && (montant * 100) % base === 0)
        return `${(montant * 100) / base} % du HT facturé`;
      return "Pourcentage du HT facturé";
    }
    case "plafond_base":
      return "Base plafonnée au total HT hors récurrent";
    case "parrainage_10":
      return "Parrainage : 10 % de la commission du filleul (art. 4.6)";
    case "tarif_avant_date_effet":
      return "Tarif du contrat en vigueur à la commande";
    case "journee_ia":
      return "Forfait Journée IA";
  }
}

/** La règle STOCKÉE sur la commission, ou `null` (jamais recalculée, jamais `formation_3j_plus`). */
function regleLue(c: CommissionLue, anomalies: AnomalieReleve[]): RegleLue | null {
  if (c.regleAppliquee === null) return null;
  if ((CODES_REGLE_AFFICHABLES as readonly string[]).includes(c.regleAppliquee)) {
    const code = c.regleAppliquee as CodeRegleAffichable;
    return { code, libelle: libelleRegle(code, c) };
  }
  // Le code réservé (Q7) se tait : ni libellé ni anomalie. Tout autre code est une anomalie.
  if (c.regleAppliquee !== "formation_3j_plus") {
    anomalies.push({ code: "regle_inconnue", detail: `règle « ${c.regleAppliquee} » hors liste` });
  }
  return null;
}

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────

const emission = (c: CommissionLue): Date => c.autofactureEmiseAt ?? c.majAt;
const dans = (d: Date, debut: Date, fin: Date): boolean => d >= debut && d < fin;
const jour = (d: Date): string => jourParis(d);
const jourEcheance = (d: Date): string => d.toISOString().slice(0, 10);

function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ── Sections ────────────────────────────────────────────────────────────────────────────────────

interface Contexte {
  readonly commissions: readonly CommissionLue[];
  readonly pieces: ReadonlyMap<string, PieceLue>;
  readonly coupure: Date;
  readonly anomalies: AnomalieReleve[];
}

function totauxPiece(
  numero: string,
  lignesHt: number,
  p: PieceLue | undefined,
  anomalies: AnomalieReleve[],
): { ht: number; tva: number; ttc: number } {
  if (!p) {
    anomalies.push({ code: "piece_manquante", detail: `pièce ${numero} introuvable` });
    return { ht: lignesHt, tva: 0, ttc: lignesHt };
  }
  if (p.totalHtCents === null || p.totalTvaCents === null || p.totalTtcCents === null) {
    anomalies.push({ code: "piece_sans_totaux", detail: `pièce ${numero} sans totaux figés` });
    return {
      ht: p.totalHtCents ?? lignesHt,
      tva: p.totalTvaCents ?? 0,
      ttc: p.totalTtcCents ?? lignesHt,
    };
  }
  return { ht: p.totalHtCents, tva: p.totalTvaCents, ttc: p.totalTtcCents };
}

function triLignes(a: LigneReleve, b: LigneReleve): number {
  return (
    comparer(a.dateEmission, b.dateEmission) ||
    comparer(a.pieceNumero, b.pieceNumero) ||
    comparer(a.entreprise ?? "", b.entreprise ?? "") ||
    comparer(a.prestation ?? "", b.prestation ?? "") ||
    a.montantHtCents - b.montantHtCents ||
    // Départage complet : deux lignes égales ici sont identiques, leur ordre ne change rien.
    comparer(jsonCanonique(a), jsonCanonique(b))
  );
}

function triPieces(a: PieceReleve, b: PieceReleve): number {
  return comparer(a.emiseLe, b.emiseLe) || comparer(a.numero, b.numero);
}

function ligneDe(
  c: CommissionLue,
  base: Pick<LigneReleve, "dateEmission" | "pieceNumero" | "montantHtCents" | "statut">,
  anomalies: AnomalieReleve[] | null,
): LigneReleve {
  const parrain = c.parrainage;
  const regle = anomalies ? regleLue(c, anomalies) : null;
  return {
    ...base,
    entreprise: parrain ? null : c.entreprise,
    prestation: prestation(c),
    factureClient:
      parrain || !c.factureClientNumero
        ? null
        : {
            numero: c.factureClientNumero,
            date: c.factureClientDate ? jour(c.factureClientDate) : null,
          },
    encaissementIntegralLe:
      parrain || !c.encaissementIntegralAt ? null : jour(c.encaissementIntegralAt),
    baseHtCents: parrain ? null : c.factureHtCents,
    prixPublicHtCents: parrain ? null : c.prixPublicHtCents,
    regle,
    renvoiDecompte: anomalies && !regle ? base.pieceNumero : null,
    versionContrat: anomalies && c.versionContrat ? `Contrat v${c.versionContrat}` : null,
    parrainage: parrain,
  };
}

/** A : commissions facturées (autofacture émise) dans `[debut, fin[`. */
function facturees(ctx: Contexte, debut: Date, fin: Date) {
  const lignesLues = ctx.commissions.filter(
    (c) =>
      c.autofactureNumero !== null &&
      c.avoirNumero === null &&
      c.statut !== "annulee" &&
      dans(emission(c), debut, fin),
  );
  for (const c of lignesLues) {
    if (c.autofactureEmiseAt === null) {
      ctx.anomalies.push({
        code: "emission_incoherente",
        detail: `autofacture ${c.autofactureNumero} sans date d'émission : repli sur la dernière mise à jour`,
      });
    }
  }
  const lignes = lignesLues.map((c) => {
    const verse = c.verseeAt !== null && c.verseeAt < ctx.coupure;
    return ligneDe(
      c,
      {
        dateEmission: jour(emission(c)),
        pieceNumero: c.autofactureNumero!,
        montantHtCents: c.montantCents ?? 0,
        statut: verse
          ? { code: "versee", verseeLe: jour(c.verseeAt!) }
          : {
              code: "facturee",
              echeanceLe: jourEcheance(echeancePaiement(emission(c), c.encaissementIntegralAt)),
            },
      },
      ctx.anomalies,
    );
  });
  const parNumero = new Map<string, CommissionLue[]>();
  for (const c of lignesLues) {
    parNumero.set(c.autofactureNumero!, [...(parNumero.get(c.autofactureNumero!) ?? []), c]);
  }
  const pieces: PieceReleve[] = [];
  for (const [numero, cs] of parNumero) {
    const p = ctx.pieces.get(numero);
    const t = totauxPiece(
      numero,
      cs.reduce((s, c) => s + (c.montantCents ?? 0), 0),
      p,
      ctx.anomalies,
    );
    pieces.push({
      numero,
      emiseLe: jour(p?.emiseAt ?? new Date(Math.min(...cs.map((x) => emission(x).getTime())))),
      regimeTva: p?.regimeTva ?? null,
      mention293b: p?.regimeTva === "franchise_293b",
      htCents: t.ht,
      tvaCents: t.tva,
      ttcCents: t.ttc,
      renvoiFacture: null,
    });
  }
  return { lignes: lignes.sort(triLignes), pieces: pieces.sort(triPieces) };
}

/** B : avoirs émis dans `[debut, fin[` (date lue sur la pièce de l'avoir). */
function avoirs(ctx: Contexte, debut: Date, fin: Date) {
  const lues: Array<{ c: CommissionLue; p: PieceLue }> = [];
  const vusSansPiece = new Set<string>();
  for (const c of ctx.commissions) {
    if (c.avoirNumero === null || c.statut === "annulee") continue;
    const p = ctx.pieces.get(c.avoirNumero);
    if (!p) {
      if (!vusSansPiece.has(c.avoirNumero)) {
        vusSansPiece.add(c.avoirNumero);
        ctx.anomalies.push({
          code: "avoir_sans_piece",
          detail: `avoir ${c.avoirNumero} sans pièce : il ne peut pas être daté`,
        });
      }
      continue;
    }
    if (dans(p.emiseAt, debut, fin)) lues.push({ c, p });
  }
  const lignes = lues.map(({ c, p }) =>
    ligneDe(
      c,
      {
        dateEmission: jour(p.emiseAt),
        pieceNumero: p.numero,
        montantHtCents: -Math.abs(c.montantCents ?? 0),
        statut: null,
      },
      ctx.anomalies,
    ),
  );
  const parNumero = new Map<string, { p: PieceLue; ht: number }>();
  for (const { c, p } of lues) {
    const cur = parNumero.get(p.numero) ?? { p, ht: 0 };
    cur.ht += -Math.abs(c.montantCents ?? 0);
    parNumero.set(p.numero, cur);
  }
  const pieces: PieceReleve[] = [];
  for (const [numero, { p, ht }] of parNumero) {
    const t = totauxPiece(numero, Math.abs(ht), p, ctx.anomalies);
    pieces.push({
      numero,
      emiseLe: jour(p.emiseAt),
      regimeTva: p.regimeTva,
      mention293b: p.regimeTva === "franchise_293b",
      htCents: -Math.abs(t.ht),
      tvaCents: -Math.abs(t.tva),
      ttcCents: -Math.abs(t.ttc),
      renvoiFacture: p.factureRectifiee,
    });
  }
  return { lignes: lignes.sort(triLignes), pieces: pieces.sort(triPieces) };
}

/**
 * Somme TTC cumulée VIRÉE d'une autofacture à l'instant `t` (versements antérieurs à `t`, avoirs
 * émis avant `t`). Sans ligne suspendue et avec des totaux figés : TTC de la pièce moins TTC des
 * avoirs. Sinon : par complément (`aVirerPartielCents`), comme le virement lui-même.
 */
function cumulVire(ctx: Contexte, numero: string, t: Date): number {
  const toutes = ctx.commissions.filter(
    (c) => c.autofactureNumero === numero && c.statut !== "annulee",
  );
  const payables = toutes.filter((c) => c.avoirNumero === null);
  const payees = payables.filter((c) => c.verseeAt !== null && c.verseeAt < t);
  if (payees.length === 0) return 0;
  const suspendues = payables.filter((c) => !(c.verseeAt !== null && c.verseeAt < t));
  const reprises = toutes.filter(
    (c) =>
      c.avoirNumero !== null &&
      (ctx.pieces.get(c.avoirNumero) === undefined || ctx.pieces.get(c.avoirNumero)!.emiseAt < t),
  );
  const facture = ctx.pieces.get(numero);
  const avoirsPieces = [...new Set(reprises.map((r) => r.avoirNumero!))].map((n) =>
    ctx.pieces.get(n),
  );
  if (
    suspendues.length === 0 &&
    facture?.totalTtcCents != null &&
    avoirsPieces.every((p) => p !== undefined && p.totalTtcCents !== null)
  ) {
    return (
      facture.totalTtcCents - avoirsPieces.reduce((s, p) => s + Math.abs(p!.totalTtcCents!), 0)
    );
  }
  const regimeFacture = facture?.regimeTva ?? null;
  return aVirerPartielCents(
    {
      facture: regimeFacture,
      avoir: (n) => ctx.pieces.get(n)?.regimeTva ?? regimeFacture,
    },
    [...payees, ...reprises].map((c) => ({
      statut: c.statut,
      montantCents: c.montantCents,
      avoirNumero: c.avoirNumero,
    })),
    suspendues.map((c) => c.montantCents ?? 0),
  ).totalCents;
}

/** C : virements réglés dans `[debut, fin[`, regroupés par autofacture. */
function virements(ctx: Contexte, debut: Date, fin: Date): VirementReleve[] {
  const dates = new Map<string, Date>();
  for (const c of ctx.commissions) {
    if (c.autofactureNumero === null || c.avoirNumero !== null || c.statut === "annulee") continue;
    if (c.verseeAt === null || !dans(c.verseeAt, debut, fin)) continue;
    const cur = dates.get(c.autofactureNumero);
    if (!cur || c.verseeAt > cur) dates.set(c.autofactureNumero, c.verseeAt);
  }
  const rendus: VirementReleve[] = [];
  for (const [numero, derniere] of dates) {
    const montant = cumulVire(ctx, numero, fin) - cumulVire(ctx, numero, debut);
    if (montant < 0) {
      ctx.anomalies.push({ code: "virement_negatif", detail: `virement négatif sur ${numero}` });
    }
    rendus.push({
      reference: numero,
      verseLe: jour(derniere),
      montantTtcCents: montant,
      compensation: montant === 0,
    });
  }
  return rendus.sort(
    (a, b) => comparer(a.verseLe, b.verseLe) || comparer(a.reference, b.reference),
  );
}

// ── Report à la coupure ─────────────────────────────────────────────────────────────────────────

function minEcheance(courante: string, c: CommissionLue): string {
  const e = jourEcheance(echeancePaiement(emission(c), c.encaissementIntegralAt));
  return e < courante ? e : courante;
}

function report(ctx: Contexte, preparationAt: Date) {
  const { coupure } = ctx;
  const sortieD1 = new Map<string, ReportFactureNonViree>();
  const idsReportes = new Set<string>();
  for (const c of ctx.commissions) {
    if (c.autofactureNumero === null || c.avoirNumero !== null || c.statut === "annulee") continue;
    if (!(emission(c) < coupure)) continue;
    if (c.verseeAt !== null && c.verseeAt < coupure) continue;
    idsReportes.add(c.id);
    const cur = sortieD1.get(c.autofactureNumero);
    if (cur) {
      // La date la plus ancienne : le résultat ne dépend pas de l'ordre de lecture.
      const jourEmission = jour(emission(c));
      sortieD1.set(c.autofactureNumero, {
        ...cur,
        emiseLe: jourEmission < cur.emiseLe ? jourEmission : cur.emiseLe,
        echeanceLe: minEcheance(cur.echeanceLe, c),
        nbLignes: cur.nbLignes + 1,
        htCents: cur.htCents + (c.montantCents ?? 0),
      });
    } else {
      sortieD1.set(c.autofactureNumero, {
        pieceNumero: c.autofactureNumero,
        emiseLe: jour(emission(c)),
        echeanceLe: jourEcheance(echeancePaiement(emission(c), c.encaissementIntegralAt)),
        nbLignes: 1,
        htCents: c.montantCents ?? 0,
      });
    }
  }
  const facturesNonVirees = [...sortieD1.values()].sort(
    (a, b) => comparer(a.echeanceLe, b.echeanceLe) || comparer(a.pieceNumero, b.pieceNumero),
  );

  const enAttente: ReportEnAttenteAutofacture[] = [];
  for (const c of ctx.commissions) {
    if (c.statut === "annulee" || c.autofactureAttenteDepuis === null) continue;
    if (!(c.autofactureAttenteDepuis < coupure)) continue;
    if (c.autofactureEmiseAt !== null && c.autofactureEmiseAt < coupure) continue;
    idsReportes.add(c.id);
    enAttente.push({
      entreprise: c.parrainage ? null : c.entreprise,
      prestation: prestation(c),
      montantHtCents: c.montantCents ?? 0,
      motif: c.autofactureAttenteMotif,
      depuisLe: jour(c.autofactureAttenteDepuis),
    });
  }
  enAttente.sort(
    (a, b) =>
      comparer(a.depuisLe, b.depuisLe) ||
      comparer(a.entreprise ?? "", b.entreprise ?? "") ||
      comparer(a.prestation ?? "", b.prestation ?? "") ||
      a.montantHtCents - b.montantHtCents ||
      comparer(jsonCanonique(a), jsonCanonique(b)),
  );

  const indicatif: ReportIndicatif = { auJour: jour(preparationAt), lignes: [] };
  for (const c of ctx.commissions) {
    if (idsReportes.has(c.id) || !(c.creeAt < coupure)) continue;
    if (["annulee", "versee", "reprise", "retenue"].includes(c.statut)) continue;
    const statut =
      c.litigeDepuis !== null
        ? "litige"
        : c.statut === "a_qualifier" || c.statut === "en_attente_vigilance"
          ? c.statut
          : null;
    if (statut === null) continue;
    indicatif.lignes.push({
      entreprise: c.parrainage ? null : c.entreprise,
      prestation: prestation(c),
      statut,
      montantHtCents: c.montantCents,
    });
  }
  indicatif.lignes.sort(
    (a, b) =>
      comparer(a.statut, b.statut) ||
      comparer(a.entreprise ?? "", b.entreprise ?? "") ||
      comparer(a.prestation ?? "", b.prestation ?? "") ||
      (a.montantHtCents ?? 0) - (b.montantHtCents ?? 0) ||
      comparer(jsonCanonique(a), jsonCanonique(b)),
  );
  return { facturesNonVirees, enAttenteAutofacture: enAttente, indicatif };
}

// ── Point d'entrée ──────────────────────────────────────────────────────────────────────────────

const somme = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

export function calculerReleve(entree: EntreeReleve): ResultatCalculReleve {
  exigerPeriodeClose(entree.periode, entree.preparationAt);
  const anomalies: AnomalieReleve[] = [];
  const { commissions, pieces } = normaliser(entree, anomalies);
  const { debut, coupure } = bornesPeriode(entree.periode);
  const piecesParNumero = new Map(pieces.map((p) => [p.numero, p]));
  const ctx: Contexte = { commissions, pieces: piecesParNumero, coupure, anomalies };

  const a = facturees(ctx, debut, coupure);
  const b = avoirs(ctx, debut, coupure);
  const c = virements(ctx, debut, coupure);

  // Cumul de l'année : calcul direct sur [1er janvier ; coupure[, jamais à partir des relevés précédents.
  const muet: Contexte = { ...ctx, anomalies: [] };
  const debutA = debutAnnee(entree.periode);
  const aAn = facturees(muet, debutA, coupure);
  const bAn = avoirs(muet, debutA, coupure);
  const cAn = virements(muet, debutA, coupure);

  const factureHtCents = somme(a.pieces.map((p) => p.htCents));
  const avoirHtCents = Math.abs(somme(b.pieces.map((p) => p.htCents)));
  const versees = a.lignes.filter((l) => l.statut?.code === "versee");
  const enCours = a.lignes.filter((l) => l.statut?.code === "facturee");

  const contenu: ContenuReleveV1 = {
    formatVersion: FORMAT_VERSION_RELEVE,
    periode: entree.periode,
    coupureAt: coupure.toISOString(),
    mention: MENTION_PAS_UNE_FACTURE,
    aucunMouvement: a.lignes.length === 0 && b.lignes.length === 0 && c.length === 0,
    facturees: a,
    avoirs: b,
    virements: c,
    sousTotaux: {
      facturees: { nb: enCours.length, htCents: somme(enCours.map((l) => l.montantHtCents)) },
      versees: { nb: versees.length, htCents: somme(versees.map((l) => l.montantHtCents)) },
    },
    totaux: {
      factureHtCents,
      avoirHtCents,
      netHtCents: factureHtCents - avoirHtCents,
      tvaCents: somme(a.pieces.map((p) => p.tvaCents)) + somme(b.pieces.map((p) => p.tvaCents)),
      ttcCents: somme(a.pieces.map((p) => p.ttcCents)) + somme(b.pieces.map((p) => p.ttcCents)),
      vireTtcCents: somme(c.map((v) => v.montantTtcCents)),
    },
    report: report(ctx, entree.preparationAt),
    cumulAnnee: {
      annee: Number(entree.periode.slice(0, 4)),
      factureHtCents: somme(aAn.pieces.map((p) => p.htCents)),
      avoirHtCents: Math.abs(somme(bAn.pieces.map((p) => p.htCents))),
      netHtCents: somme(aAn.pieces.map((p) => p.htCents)) + somme(bAn.pieces.map((p) => p.htCents)),
      netTtcCents:
        somme(aAn.pieces.map((p) => p.ttcCents)) + somme(bAn.pieces.map((p) => p.ttcCents)),
      vireTtcCents: somme(cAn.map((v) => v.montantTtcCents)),
    },
  };
  return { contenu, anomalies };
}

/** Totaux dénormalisés pour les statistiques (lus sur le contenu, jamais pour réémettre). */
export function totauxDenormalises(contenu: ContenuReleveV1): TotauxDenormalises {
  return {
    nbLignes: contenu.facturees.lignes.length + contenu.avoirs.lignes.length,
    facturesHtCents: contenu.totaux.factureHtCents,
    avoirsHtCents: contenu.totaux.avoirHtCents,
    viresTtcCents: contenu.totaux.vireTtcCents,
    enAttenteHtCents:
      somme(contenu.report.facturesNonVirees.map((f) => f.htCents)) +
      somme(contenu.report.enAttenteAutofacture.map((e) => e.montantHtCents)),
    cumulAnneeHtCents: contenu.cumulAnnee.netHtCents,
  };
}
