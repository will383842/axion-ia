/**
 * Réseau d'apporteurs — l'assemblage PUR de la page « Mes commissions » (lecture seule).
 *
 * Reçoit des lignes DÉJÀ lues, filtrées par apporteur, et rend une vue à liste blanche : aucun
 * champ « ...ligne », jamais un identifiant interne, un palier brut, un motif de contestation ni
 * une donnée d'un autre apporteur. Ne calcule aucune commission : il recopie `montantCents`.
 * Aucun total, compteur, objectif ni classement n'est produit.
 */

import { echeancePaiement, aVirerPartielCents } from "./autofacture-donnees";
import { etatPourApporteur, type EtatDeclaration } from "./declaration-regles";
import {
  etatPrincipal,
  facettesCommission,
  type EtatPrincipal,
  type StatutLigne,
} from "./etat-commission";
import { PALIERS_FORMATION } from "./regles";

export type RegimeTva = "assujetti" | "franchise_293b" | null;

export interface PresentationLue {
  id: string;
  denomination: string;
  recueAt: Date;
  statut: string;
  contactEnvoyeAt: Date | null;
  protegeeJusquAt: Date | null;
}

export interface ReservationLue {
  presentationId: string;
  reserveeJusquAt: Date;
  valideeAt: Date | null;
}

export interface CommissionLue {
  id: string;
  presentationId: string | null;
  /** Propriétaire de la présentation rattachée (jamais affiché), `null` sans présentation. */
  presentationApporteurId: string | null;
  parrainage: boolean;
  activite: string;
  palier: string | null;
  montantCents: number | null;
  statut: StatutLigne;
  releveMois: string | null;
  autofactureNumero: string | null;
  autofactureEmiseAt: Date | null;
  avoirNumero: string | null;
  autofactureAttenteMotif: string | null;
  litigeDepuis: Date | null;
  verseeAt: Date | null;
  majAt: Date;
}

export interface CommissionVue {
  cle: string;
  nature: string | null;
  /** Montant HT à afficher ; `null` : aucun montant n'est affiché (jamais « 0 € » par défaut). */
  montantCents: number | null;
  etat: EtatPrincipal;
  numeroFacture: string | null;
  factureLe: Date | null;
  echeanceLe: Date | null;
  verseeLe: Date | null;
  numeroAvoir: string | null;
}

export interface EntrepriseVue {
  /** Position dans la liste : jamais l'identifiant interne de la présentation. */
  cle: string;
  denomination: string;
  presenteeLe: Date;
  etat: EtatDeclaration;
  /** Fin de réservation : seulement si `PresentationReservation` la porte. */
  reserveeJusquAu: Date | null;
  valideeLe: Date | null;
  commissions: CommissionVue[];
}

export interface PieceVue {
  numero: string;
  genre: "facture" | "avoir";
  le: Date;
}

export interface VirementAVenirVue {
  numero: string;
  factureLe: Date;
  echeanceLe: Date;
  /** `null` : régime de TVA inconnu, aucun chiffre. */
  montants: null | { htCents: number; tvaCents: number | null; ttcCents: number };
  regime: RegimeTva;
}

export interface EspaceCommissionsVue {
  entreprises: EntrepriseVue[];
  horsEntreprise: CommissionVue[];
  virements: VirementAVenirVue[];
  pieces: PieceVue[];
  tronque: boolean;
}

export const BORNE_PRESENTATIONS = 100;
export const BORNE_COMMISSIONS = 300;

function nature(l: Pick<CommissionLue, "activite" | "palier">): string | null {
  const palier = PALIERS_FORMATION.find((p) => p.id === l.palier);
  if (palier) return palier.libelle;
  if (l.activite === "audit") return "Audit";
  if (l.activite === "implementation") return "Mise en service";
  return null;
}

const emission = (l: Pick<CommissionLue, "autofactureEmiseAt" | "majAt">): Date =>
  l.autofactureEmiseAt ?? l.majAt;

const MONTRE_MONTANT: ReadonlySet<EtatPrincipal> = new Set([
  "suspendue",
  "facturee",
  "en_attente_pieces",
  "en_attente_fiche",
  "en_attente_fiche_solde_negatif",
  "due",
  "versee",
]);

function vueLigne(l: CommissionLue, etat: EtatPrincipal, cle: string): CommissionVue {
  const m = l.montantCents;
  const reprise = etat === "reprise_a_deduire" || etat === "reprise_deduite";
  const montant =
    reprise && m !== null && m !== 0
      ? Math.abs(m)
      : MONTRE_MONTANT.has(etat) && m !== null && m !== 0
        ? m
        : null;
  const facturee = l.autofactureNumero !== null && etat !== "annulee";
  const e = facturee ? emission(l) : null;
  return {
    cle,
    nature: nature(l),
    montantCents: montant,
    etat,
    numeroFacture: etat === "facturee" || etat === "versee" ? l.autofactureNumero : null,
    factureLe: etat === "facturee" || etat === "versee" ? e : null,
    echeanceLe: etat === "facturee" && e ? echeancePaiement(e) : null,
    verseeLe: etat === "versee" ? (l.verseeAt ?? null) : null,
    numeroAvoir: l.avoirNumero,
  };
}

function etatDe(l: CommissionLue): EtatPrincipal {
  return etatPrincipal(
    facettesCommission({
      statut: l.statut,
      montantCents: l.montantCents,
      releveMois: l.releveMois,
      autofactureNumero: l.autofactureNumero,
      autofactureAttenteMotif: l.autofactureAttenteMotif,
      litigeDepuis: l.litigeDepuis,
      activite: l.activite,
    }),
    l.montantCents,
  );
}

function virements(lignes: readonly CommissionLue[], regime: RegimeTva): VirementAVenirVue[] {
  const parNumero = new Map<string, CommissionLue[]>();
  for (const l of lignes) {
    if (!l.autofactureNumero) continue;
    parNumero.set(l.autofactureNumero, [...(parNumero.get(l.autofactureNumero) ?? []), l]);
  }
  const out: VirementAVenirVue[] = [];
  for (const [numero, ls] of parNumero) {
    const suspendue = (l: CommissionLue) =>
      l.statut === "retenue" || (l.statut === "due" && l.litigeDepuis !== null);
    const aVirer = ls.filter(
      (l) =>
        (l.statut === "due" && l.litigeDepuis === null) || (l.statut === "reprise" && !l.verseeAt),
    );
    if (!aVirer.some((l) => l.statut === "due")) continue;
    const suspendues = ls.filter(suspendue).map((l) => l.montantCents ?? 0);
    const date = new Date(Math.min(...ls.map((l) => emission(l).getTime())));
    const base = { numero, factureLe: date, echeanceLe: echeancePaiement(date), regime };
    if (regime === null) {
      out.push({ ...base, montants: null });
      continue;
    }
    const { totalCents, partielPossible } = aVirerPartielCents(regime, aVirer, suspendues);
    if (!partielPossible || totalCents <= 0) continue;
    const ht = aVirer.reduce(
      (s, l) =>
        s + (l.statut === "reprise" ? -Math.abs(l.montantCents ?? 0) : (l.montantCents ?? 0)),
      0,
    );
    out.push({
      ...base,
      montants: {
        htCents: ht,
        tvaCents: regime === "assujetti" ? totalCents - ht : null,
        ttcCents: totalCents,
      },
    });
  }
  return out.sort((a, b) => a.factureLe.getTime() - b.factureLe.getTime());
}

export function assemblerEspaceCommissions(e: {
  apporteurId: string;
  regimeTva: RegimeTva;
  maintenant: Date;
  presentations: readonly PresentationLue[];
  reservations: readonly ReservationLue[];
  commissions: readonly CommissionLue[];
  tronque: boolean;
}): EspaceCommissionsVue {
  const resa = new Map(e.reservations.map((r) => [r.presentationId, r]));
  const propres = new Set(e.presentations.map((p) => p.id));

  // Garde de cloisonnement (défense en profondeur : la requête filtre déjà par apporteur).
  const mes = e.commissions.filter((c) => {
    if (c.presentationId === null) return true;
    return c.presentationApporteurId === e.apporteurId;
  });

  const parPresentation = new Map<string, CommissionVue[]>();
  const hors: CommissionVue[] = [];
  const parrainages = new Map<string, CommissionLue[]>();

  for (const c of mes) {
    const etat = etatDe(c);
    if (etat === "masquee") continue;
    if (c.parrainage) {
      // Parrainage : regroupé par autofacture, jamais rattaché à une entreprise, jamais avant facture.
      if (c.autofactureNumero && (c.statut === "due" || c.statut === "versee")) {
        parrainages.set(c.autofactureNumero, [...(parrainages.get(c.autofactureNumero) ?? []), c]);
      }
      continue;
    }
    if (c.activite === "prime_challenge") {
      if (c.autofactureNumero && (c.statut === "due" || c.statut === "versee"))
        hors.push({ ...vueLigne(c, etat, `h${hors.length}`), nature: "Prime exceptionnelle" });
      continue;
    }
    if (c.presentationId === null || !propres.has(c.presentationId)) continue;
    parPresentation.set(c.presentationId, [
      ...(parPresentation.get(c.presentationId) ?? []),
      vueLigne(c, etat, `c${parPresentation.get(c.presentationId)?.length ?? 0}`),
    ]);
  }

  for (const [numero, ls] of parrainages) {
    const toutesVersees = ls.every((l) => l.statut === "versee");
    const somme = ls.reduce((s, l) => s + (l.montantCents ?? 0), 0);
    const d = new Date(Math.min(...ls.map((l) => emission(l).getTime())));
    hors.push({
      cle: `p${hors.length}`,
      nature: "Parrainage",
      montantCents: somme !== 0 ? somme : null,
      etat: toutesVersees ? "versee" : ls.some((l) => l.litigeDepuis) ? "suspendue" : "facturee",
      numeroFacture: numero,
      factureLe: d,
      echeanceLe: toutesVersees ? null : echeancePaiement(d),
      verseeLe: toutesVersees
        ? new Date(Math.max(...ls.map((l) => (l.verseeAt ?? l.majAt).getTime())))
        : null,
      numeroAvoir: null,
    });
  }

  const entreprises: EntrepriseVue[] = [];
  for (const [i, p] of e.presentations.entries()) {
    const r = resa.get(p.id);
    const etat = etatPourApporteur(
      p,
      e.maintenant,
      r ? { recueAt: p.recueAt, reserveeJusquAt: r.reserveeJusquAt } : undefined,
    );
    if (!etat) continue;
    entreprises.push({
      cle: `e${i}`,
      denomination: p.denomination,
      presenteeLe: p.recueAt,
      etat: etat.etat,
      // Une date seulement si elle vient de `PresentationReservation` (jamais des 6 mois de `protegeeJusquAt`).
      reserveeJusquAu: r && etat.etat === "reservee" ? etat.jusquAu : null,
      valideeLe: r?.valideeAt ?? null,
      commissions: parPresentation.get(p.id) ?? [],
    });
  }

  const pieces = new Map<string, PieceVue>();
  for (const c of mes) {
    if (c.autofactureNumero && c.statut !== "annulee")
      pieces.set(c.autofactureNumero, {
        numero: c.autofactureNumero,
        genre: "facture",
        le: new Date(
          Math.min(
            pieces.get(c.autofactureNumero)?.le.getTime() ?? Infinity,
            emission(c).getTime(),
          ),
        ),
      });
    if (c.avoirNumero)
      pieces.set(c.avoirNumero, { numero: c.avoirNumero, genre: "avoir", le: emission(c) });
  }

  return {
    entreprises,
    horsEntreprise: hors,
    virements: virements(mes, e.regimeTva),
    pieces: [...pieces.values()].sort((a, b) => b.le.getTime() - a.le.getTime()),
    tronque: e.tronque,
  };
}
