/**
 * Saisie du formulaire « devis à formules » → OffreDevisV1. PUR, sans accès base.
 *
 * Les champs sont des CHAÎNES (ce que tape l'admin) ; rien n'est deviné : un prix
 * illisible est refusé avec un message, jamais ramené à 0. Aucun montant par défaut :
 * seule la TVA reçoit le taux standard EXISTANT (`TAUX_TVA_STANDARD`), modifiable.
 */
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import { prixMensuelNet, indemniteSortieMaxCents } from "@/server/qualiopi/devis/montants-mensuels";
import {
  GARANTIE_JOURS_PAR_DEFAUT,
  offreDevisV1,
  type OffreDevisV1,
  type LigneOffre,
  type PhaseOffre,
} from "@/server/qualiopi/devis/offre-devis";

/** Acompte par défaut d'un devis, en % du total HT (décision Williams n°9, 08/11/2026). */
const ACOMPTE_DEVIS_DEFAUT_PCT = 30;

export interface LigneSaisie {
  libelle: string;
  quantite: string;
  prixEur: string;
  tauxTvaPct: string;
}
export interface PhaseSaisie {
  libelle: string;
  pourcentage: string;
  declencheur: "signature" | "avancement" | "livraison";
  /** Non saisis à l'écran : conservés tels quels à la relecture d'une offre enregistrée. */
  delaiJours?: number | undefined;
  dateEstimee?: string | undefined;
}
type OffreAutomatisations = OffreDevisV1["automatisations"];
type OffreServicesTiers = OffreDevisV1["servicesTiers"];
type OffrePlafond = OffreDevisV1["plafondAConfirmer"];
export type Engagement = 0 | 3 | 6 | 12 | 24;
export type Preavis = 1 | 2 | 3;
export type MoisPeriode = 1 | 2 | 6 | 12;

export interface SaisieFormules {
  formules: { achat: boolean; abonnement: boolean };
  garantieJours: string;
  /**
   * Éléments de l'offre que l'écran ne sait pas encore saisir : ils traversent la relecture
   * (`offreVersSaisie`) et la reconstruction (`construireOffre`) SANS être effacés.
   */
  automatisations: OffreAutomatisations;
  servicesTiers: OffreServicesTiers;
  plafondAConfirmer: OffrePlafond;
  achat: {
    lignes: LigneSaisie[];
    phases: PhaseSaisie[];
    hebergement: "client" | "axion";
    hebergementMensuelEur: string;
    maintenance: {
      regle: "obligatoire" | "facultative";
      moisOfferts: string;
      mensuelEur: string;
      periodes: MoisPeriode[];
    };
  };
  abonnement: {
    lignes: LigneSaisie[];
    phases: PhaseSaisie[];
    mensuelCatalogueEur: string;
    tauxTvaPct: string;
    terme: "a_echoir" | "echu";
    /** Non saisi à l'écran : conservé à la relecture (défaut du schéma si absent). */
    modeAvance?: "premiere_periode_seulement" | "toutes_periodes" | undefined;
    periodes: Array<{ mois: MoisPeriode; remisePct: string }>;
    engagementMois: Engagement;
    reconduction: "mensuelle" | "annuelle" | "aucune";
    preavisMois: Preavis;
    indemniteTauxPct: string;
  };
}

export interface TexteCopie {
  bibliothequeId?: string | undefined;
  version?: string | undefined;
  texte: string;
  actif: boolean;
}

/** `tvaStandardPct` : taux standard existant, passé en paramètre pour rester testable. */
export function saisieVide(tvaStandardPct: number = TAUX_TVA_STANDARD): SaisieFormules {
  const tva = String(tvaStandardPct);
  const ligne = (): LigneSaisie => ({ libelle: "", quantite: "1", prixEur: "", tauxTvaPct: tva });
  // Décision Williams n°9 (08/11/2026) : acompte de 30 % du total HT à la signature, solde à la
  // livraison. Le réglage en base `taux_acompte_defaut_pct` n'est lu que par la facturation des
  // sessions (`financements/facturation-service.ts`) : il n'est pas branché ici.
  const phases = (): PhaseSaisie[] => [
    { libelle: "Acompte", pourcentage: String(ACOMPTE_DEVIS_DEFAUT_PCT), declencheur: "signature" },
    {
      libelle: "Solde",
      pourcentage: String(100 - ACOMPTE_DEVIS_DEFAUT_PCT),
      declencheur: "livraison",
    },
  ];
  return {
    formules: { achat: false, abonnement: false },
    garantieJours: String(GARANTIE_JOURS_PAR_DEFAUT),
    automatisations: [],
    servicesTiers: [],
    plafondAConfirmer: null,
    achat: {
      lignes: [ligne()],
      phases: phases(),
      hebergement: "client",
      hebergementMensuelEur: "",
      maintenance: { regle: "facultative", moisOfferts: "0", mensuelEur: "", periodes: [1, 12] },
    },
    abonnement: {
      lignes: [ligne()],
      phases: phases(),
      mensuelCatalogueEur: "",
      tauxTvaPct: tva,
      terme: "a_echoir",
      periodes: [{ mois: 1, remisePct: "0" }],
      engagementMois: 0,
      reconduction: "mensuelle",
      preavisMois: 1,
      indemniteTauxPct: "0",
    },
  };
}

/** « 12,5 » / « 12.50 » → 1250. Vide, négatif, > 2 décimales, texte → null. */
export function eurosVersCents(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Pourcentage entier ou à 2 décimales → points de base. */
function pctVersBps(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

type Erreurs = string[];

function ligneVersOffre(l: LigneSaisie, rang: string, e: Erreurs) {
  const prix = eurosVersCents(l.prixEur);
  const tva = pctVersBps(l.tauxTvaPct);
  const quantite = Number(l.quantite.trim().replace(",", "."));
  if (prix === null) e.push(`${rang} : prix illisible (euros, 2 décimales au plus).`);
  if (tva === null) e.push(`${rang} : taux de TVA illisible.`);
  if (!Number.isFinite(quantite) || l.quantite.trim() === "")
    e.push(`${rang} : quantité illisible.`);
  return { libelle: l.libelle, quantite, prixHtCents: prix ?? -1, tauxTvaBps: tva ?? -1 };
}

function phasesVersOffre(p: PhaseSaisie[], nom: string, e: Erreurs) {
  return p.map((x, i) => {
    const pourcentage = Number(x.pourcentage);
    if (!Number.isInteger(pourcentage))
      e.push(`${nom}, phase ${i + 1} : pourcentage entier requis.`);
    return {
      rang: i + 1,
      libelle: x.libelle,
      pourcentage,
      declencheur: x.declencheur,
      ...(x.delaiJours !== undefined ? { delaiJours: x.delaiJours } : {}),
      ...(x.dateEstimee !== undefined ? { dateEstimee: x.dateEstimee } : {}),
    };
  });
}

export type ResultatOffre = { ok: true; offre: OffreDevisV1 } | { ok: false; erreurs: string[] };

export function construireOffre(s: SaisieFormules, textes: readonly TexteCopie[]): ResultatOffre {
  const e: Erreurs = [];
  const proposees = [
    ...(s.formules.achat ? (["achat"] as const) : []),
    ...(s.formules.abonnement ? (["abonnement"] as const) : []),
  ];
  if (proposees.length === 0) return { ok: false, erreurs: ["Choisissez au moins une formule."] };

  const garantie = s.garantieJours.trim() === "" ? null : Number(s.garantieJours);
  const brut: Record<string, unknown> = {
    v: 1,
    client: "professionnel",
    formulesProposees: proposees,
    automatisations: s.automatisations,
    servicesTiers: s.servicesTiers,
    plafondAConfirmer: s.plafondAConfirmer,
    garantie: { jours: garantie },
    textes: textes.map((t) => ({ ...t })),
  };

  if (s.formules.achat) {
    const a = s.achat;
    const mensuel = eurosVersCents(a.maintenance.mensuelEur);
    if (mensuel === null) e.push("Maintenance : montant mensuel illisible.");
    const heb = eurosVersCents(a.hebergementMensuelEur);
    brut["achat"] = {
      lignes: a.lignes.map((l, i) => ligneVersOffre(l, `Achat, ligne ${i + 1}`, e)),
      phases: phasesVersOffre(a.phases, "Achat", e),
      hebergement: a.hebergement,
      ...(a.hebergement === "axion" ? { hebergementMensuelHtCents: heb ?? -1 } : {}),
      maintenance: {
        regle: a.maintenance.regle,
        moisOfferts: Number(a.maintenance.moisOfferts),
        mensuelHtCents: mensuel ?? -1,
        periodesMois: a.maintenance.periodes,
      },
    };
    if (a.hebergement === "axion" && heb === null) e.push("Hébergement : mensuel illisible.");
  }

  if (s.formules.abonnement) {
    const b = s.abonnement;
    const cat = eurosVersCents(b.mensuelCatalogueEur);
    const tva = pctVersBps(b.tauxTvaPct);
    const indem = pctVersBps(b.indemniteTauxPct);
    if (cat === null) e.push("Abonnement : mensuel catalogue illisible.");
    if (tva === null) e.push("Abonnement : taux de TVA illisible.");
    if (indem === null) e.push("Abonnement : taux d'indemnité de sortie illisible.");
    brut["abonnement"] = {
      miseEnServiceLignes: b.lignes.map((l, i) =>
        ligneVersOffre(l, `Mise en service, ligne ${i + 1}`, e),
      ),
      phases: phasesVersOffre(b.phases, "Mise en service", e),
      mensuelCatalogueHtCents: cat ?? -1,
      tauxTvaBps: tva ?? -1,
      terme: b.terme,
      ...(b.modeAvance !== undefined ? { modeAvance: b.modeAvance } : {}),
      periodes: b.periodes.map((p) => {
        const remise = pctVersBps(p.remisePct);
        if (remise === null) e.push(`Période de ${p.mois} mois : remise illisible.`);
        return { mois: p.mois, remiseBps: remise ?? -1 };
      }),
      engagementMois: b.engagementMois,
      reconduction: b.reconduction,
      preavisMois: b.preavisMois,
      indemniteSortieTauxBps: indem ?? -1,
    };
  }

  const r = offreDevisV1.safeParse(brut);
  // Les messages de lecture (prix illisible…) passent avant ceux du schéma : un -1 de
  // marqueur y produirait un message obscur.
  if (e.length > 0) return { ok: false, erreurs: e };
  if (!r.success) {
    return {
      ok: false,
      erreurs: r.error.issues.map((i) => `${i.path.join(".") || "offre"} : ${i.message}`),
    };
  }
  return { ok: true, offre: r.data };
}

/**
 * Indemnité de sortie MAXIMALE en centimes HT : taux × mensualités restantes au plus haut
 * (engagement entier restant, mensuel net le plus élevé parmi les périodes proposées, soit
 * celui de la plus faible remise). `null` s'il n'y a rien à afficher ou si la saisie est illisible.
 */
export function indemniteSortieAffichee(s: SaisieFormules): number | null {
  if (!s.formules.abonnement || s.abonnement.engagementMois === 0) return null;
  const cat = eurosVersCents(s.abonnement.mensuelCatalogueEur);
  const taux = pctVersBps(s.abonnement.indemniteTauxPct);
  const remises = s.abonnement.periodes.map((p) => pctVersBps(p.remisePct));
  if (cat === null || taux === null || remises.length === 0 || remises.some((r) => r === null)) {
    return null;
  }
  try {
    const remiseMin = Math.min(...(remises as number[]));
    const restant = prixMensuelNet(cat, remiseMin) * s.abonnement.engagementMois;
    return indemniteSortieMaxCents(restant, taux);
  } catch {
    return null;
  }
}

const centsVersEur = (c: number): string => (c / 100).toFixed(2).replace(/\.00$/, "");
const bpsVersPct = (b: number): string => (b / 100).toFixed(2).replace(/\.?0+$/, "");

/** Relecture d'une offre enregistrée pour la rééditer (inverse de `construireOffre`). */
export function offreVersSaisie(o: OffreDevisV1): SaisieFormules {
  const base = saisieVide();
  const ligne = (x: LigneOffre): LigneSaisie => ({
    libelle: x.libelle,
    quantite: String(x.quantite),
    prixEur: centsVersEur(x.prixHtCents),
    tauxTvaPct: bpsVersPct(x.tauxTvaBps),
  });
  const phases = (p: readonly PhaseOffre[]) =>
    [...p]
      .sort((a, b) => a.rang - b.rang)
      .map((x) => ({
        libelle: x.libelle,
        pourcentage: String(x.pourcentage),
        declencheur: x.declencheur,
        ...(x.delaiJours !== undefined ? { delaiJours: x.delaiJours } : {}),
        ...(x.dateEstimee !== undefined ? { dateEstimee: x.dateEstimee } : {}),
      }));
  const out: SaisieFormules = {
    ...base,
    formules: {
      achat: o.formulesProposees.includes("achat"),
      abonnement: o.formulesProposees.includes("abonnement"),
    },
    garantieJours: o.garantie.jours === null ? "" : String(o.garantie.jours),
    automatisations: o.automatisations,
    servicesTiers: o.servicesTiers,
    plafondAConfirmer: o.plafondAConfirmer,
  };
  if (o.achat) {
    out.achat = {
      lignes: o.achat.lignes.map(ligne),
      phases: phases(o.achat.phases),
      hebergement: o.achat.hebergement,
      hebergementMensuelEur:
        o.achat.hebergementMensuelHtCents === undefined
          ? ""
          : centsVersEur(o.achat.hebergementMensuelHtCents),
      maintenance: {
        regle: o.achat.maintenance.regle,
        moisOfferts: String(o.achat.maintenance.moisOfferts),
        mensuelEur: centsVersEur(o.achat.maintenance.mensuelHtCents),
        periodes: [...o.achat.maintenance.periodesMois],
      },
    };
  }
  if (o.abonnement) {
    out.abonnement = {
      lignes: o.abonnement.miseEnServiceLignes.map(ligne),
      phases: phases(o.abonnement.phases),
      mensuelCatalogueEur: centsVersEur(o.abonnement.mensuelCatalogueHtCents),
      tauxTvaPct: bpsVersPct(o.abonnement.tauxTvaBps),
      terme: o.abonnement.terme,
      modeAvance: o.abonnement.modeAvance,
      periodes: o.abonnement.periodes.map((p) => ({
        mois: p.mois,
        remisePct: bpsVersPct(p.remiseBps),
      })),
      engagementMois: o.abonnement.engagementMois,
      reconduction: o.abonnement.reconduction,
      preavisMois: o.abonnement.preavisMois,
      indemniteTauxPct: bpsVersPct(o.abonnement.indemniteSortieTauxBps),
    };
  }
  return out;
}
