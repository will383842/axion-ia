/**
 * Assistant de devis — adaptateur vers le moteur (fiche E04). PUR, client-safe.
 *
 * `EtatAssistant` → `SaisieFormules` → `construireOffre` (INCHANGÉ), ou, pour le prix unique,
 * lignes classiques de `createDevisAction`. Règles (DECISIONS-D1-D2-ARCHITECTE §1 D1 et §2) :
 *  - aucune ligne facultative : `automatisations` = [] (devis neuf) ou les héritées TELLES QUELLES ;
 *  - A : lignes de l'étape 1 → `achat.lignes` ; B seule : lignes → `miseEnServiceLignes` ;
 *    A + B : UNE ligne de mise en service saisie, vide ou 0 = aucune ligne ;
 *  - taux de TVA = taux standard reçu, jamais saisi ; aucune `modeAvance` écrite ;
 *  - montants en chaînes → espaces retirés → `eurosVersCents` (jamais `parseFloat`).
 */
import {
  construireOffre,
  type LigneSaisie,
  type PhaseSaisie,
  type SaisieFormules,
  type TexteCopie,
} from "../devis-formules/saisie";
import type { OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { eurosEnCents, quantiteLue } from "./calculs";
import { propositionEffective } from "./etat";
import type { EtatAssistant, PhaseAssistant } from "./types";

export interface ContexteConversion {
  /** Taux de TVA standard (%), reçu des props. */
  tvaStandardPct: number;
  /** Textes actifs de la bibliothèque, recopiés tels quels dans l'offre. */
  textes: readonly TexteCopie[];
}

export interface LigneClassique {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
  offreCode?: string;
  offreTierId?: string;
}

/** Forme de l'entrée de `createDevisAction` (hors client et projet, ajoutés par l'appelant). */
export interface DevisClassique {
  activite?: NonNullable<EtatAssistant["modele"]>;
  lignes: LigneClassique[];
  financementSuggere?: "direct" | "opco" | "cpf" | "france_travail";
  nbParticipants?: number;
  dureeHeures?: number;
  modaliteOpco?: "intra" | "inter_presentiel" | "inter_distanciel";
  opcoEnveloppeRestanteCents?: number;
  dateDebutSessionPrevue?: string;
}

export type ResultatConversion =
  | { ok: true; type: "formules"; saisie: SaisieFormules; offre: OffreDevisV1 }
  | { ok: true; type: "classique"; classique: DevisClassique }
  | { ok: false; erreurs: string[] };

const sansEspaces = (s: string): string => s.replace(/[   ]/g, "");

function lignesSaisie(e: EtatAssistant, tva: string): LigneSaisie[] {
  return e.lignes.map((l) => ({
    libelle: l.libelle,
    quantite: l.quantite,
    prixEur: sansEspaces(l.prixEur),
    tauxTvaPct: tva,
  }));
}

function phasesSaisie(p: readonly PhaseAssistant[]): PhaseSaisie[] {
  return p.map((x) => ({
    libelle: x.libelle,
    pourcentage: x.pourcentage,
    declencheur: x.declencheur,
    ...(x.delaiJours !== undefined ? { delaiJours: x.delaiJours } : {}),
    ...(x.dateEstimee !== undefined ? { dateEstimee: x.dateEstimee } : {}),
  }));
}

/** Mise en service de B : B seule → lignes ; A + B → une ligne saisie (vide ou 0 = aucune). */
function miseEnService(
  e: EtatAssistant,
  seule: boolean,
  tva: string,
  erreurs: string[],
): LigneSaisie[] {
  if (seule) return lignesSaisie(e, tva);
  const saisie = e.abonnement.miseEnServiceSaisie;
  if (saisie.trim() === "") return [];
  const cents = eurosEnCents(saisie);
  if (cents === null) {
    erreurs.push("Mise en service : montant illisible (euros, 2 décimales au plus).");
    return [];
  }
  if (cents === 0) return [];
  const libelle = e.abonnement.miseEnServiceLibelle.trim();
  return [
    {
      libelle: libelle === "" ? "Mise en service et adaptation" : libelle,
      quantite: "1",
      prixEur: sansEspaces(saisie),
      tauxTvaPct: tva,
    },
  ];
}

export function versSaisie(
  e: EtatAssistant,
  tvaStandardPct: number,
): { saisie: SaisieFormules; erreurs: string[] } {
  const p = propositionEffective(e);
  const tva = String(tvaStandardPct);
  const erreurs: string[] = [];
  const ab = e.abonnement;
  const ac = e.achat;
  const saisie: SaisieFormules = {
    formules: { achat: p === "A" || p === "AB", abonnement: p === "B" || p === "AB" },
    garantieJours: e.garantie.afficher ? e.garantie.jours.trim() : "",
    automatisations: e.automatisationsHeritees,
    servicesTiers: e.servicesTiers,
    plafondAConfirmer: e.plafondAConfirmer,
    achat: {
      lignes: lignesSaisie(e, tva),
      phases: phasesSaisie(ac.phases),
      hebergement: ac.hebergement,
      hebergementMensuelEur: sansEspaces(ac.hebergementMensuelEur),
      maintenance: {
        regle: ac.maintenance.regle,
        // Le moteur porte les mois offerts (schéma, PDF, plan récurrent) : on les transmet.
        moisOfferts: ac.maintenance.moisOfferts.trim(),
        mensuelEur: sansEspaces(ac.maintenance.mensuelEur),
        periodes: ac.maintenance.periodes,
      },
    },
    abonnement: {
      lignes: miseEnService(e, p === "B", tva, erreurs),
      phases: phasesSaisie(ab.phases),
      mensuelCatalogueEur: sansEspaces(ab.mensuelCatalogueEur),
      tauxTvaPct: tva,
      terme: ab.terme,
      periodes: ab.periodes.map((x) => ({ mois: x.mois, remisePct: sansEspaces(x.remisePct) })),
      engagementMois: ab.engagementMois,
      reconduction: ab.reconduction,
      preavisMois: ab.preavisMois,
      indemniteTauxPct: sansEspaces(ab.indemniteTauxPct),
    },
  };
  // Mise en service illisible : seulement si B est réellement proposée.
  return { saisie, erreurs: saisie.formules.abonnement ? erreurs : [] };
}

function versClassique(e: EtatAssistant): ResultatConversion {
  const erreurs: string[] = [];
  const lignes: LigneClassique[] = e.lignes.map((l, i) => {
    const quantite = quantiteLue(l.quantite);
    const prix = eurosEnCents(l.prixEur);
    if (l.libelle.trim() === "") erreurs.push(`Ligne ${i + 1} : le libellé est requis.`);
    if (quantite === null) erreurs.push(`Ligne ${i + 1} : quantité illisible.`);
    if (prix === null)
      erreurs.push(`Ligne ${i + 1} : prix illisible (euros, 2 décimales au plus).`);
    return {
      designation: l.libelle.trim(),
      quantite: quantite ?? 0,
      prixUnitaireHtCents: prix ?? 0,
      ...(l.offreCode !== "" ? { offreCode: l.offreCode } : {}),
      ...(l.offreCode !== "" && l.offreTierId ? { offreTierId: l.offreTierId } : {}),
    };
  });
  const f = e.financement;
  const classique: DevisClassique = { lignes, ...(e.modele ? { activite: e.modele } : {}) };
  if (f.mode !== "") {
    classique.financementSuggere = f.mode;
    if (f.mode === "opco") {
      const nb = /^\d+$/.test(f.nbParticipants.trim()) ? Number(f.nbParticipants) : null;
      const heures = quantiteLue(f.dureeHeures);
      if (nb !== null && nb > 0) classique.nbParticipants = nb;
      if (heures !== null) classique.dureeHeures = heures;
      if (f.modaliteOpco !== "") classique.modaliteOpco = f.modaliteOpco;
      if (f.enveloppeRestante.trim() !== "") {
        const c = eurosEnCents(f.enveloppeRestante);
        if (c === null) erreurs.push("Enveloppe restante : montant illisible.");
        else classique.opcoEnveloppeRestanteCents = c;
      }
    }
    if (f.dateDebutSession !== "") classique.dateDebutSessionPrevue = f.dateDebutSession;
  }
  return erreurs.length > 0 ? { ok: false, erreurs } : { ok: true, type: "classique", classique };
}

export function versOffre(e: EtatAssistant, ctx: ContexteConversion): ResultatConversion {
  if (propositionEffective(e) === "prix_unique") return versClassique(e);
  const { saisie, erreurs } = versSaisie(e, ctx.tvaStandardPct);
  if (erreurs.length > 0) return { ok: false, erreurs };
  const r = construireOffre(saisie, ctx.textes);
  return r.ok ? { ok: true, type: "formules", saisie, offre: r.offre } : r;
}
