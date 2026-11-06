/**
 * Vue d'un devis à formules — ce que le CLIENT lit (PDF, e-mail). PUR.
 *
 * Une seule fonction transforme une `OffreDevisV1` valide en données d'affichage,
 * partagée par l'aperçu du brouillon, l'envoi et le renvoi : ce que Will voit est
 * ce qui part. Aucun montant, taux ni durée n'est inventé ici — tout vient de
 * l'offre saisie. Montants en centimes HT (le gabarit les met en euros).
 *
 * ⛔ Vocabulaire client : jamais d'unité d'IA, de jeton ni de prix fournisseur.
 */
import type { OffreDevisV1, Formule } from "./offre-devis";
import {
  echeancierPhases,
  indemniteSortieMaxCents,
  prixMensuelNet,
  totauxFormule,
} from "./offre-calculs";

export interface VueLigneFormule {
  readonly designation: string;
  readonly quantite: number;
  readonly prixUnitaireHtCents: number;
  readonly tauxTvaPercent: number;
  readonly totalHtCents: number;
  /** Précisions d'affichage (mode d'IA, optionnel…). */
  readonly precision?: string;
}

export interface VuePalier {
  readonly rang: number;
  readonly libelle: string;
  readonly pourcentage: number;
  readonly declencheur: string;
  readonly montantHtCents: number;
}

export interface VuePeriode {
  readonly mois: number;
  /** Remise en points de pourcentage (500 bps → 5). */
  readonly remisePercent: number;
  readonly mensuelNetHtCents: number;
  readonly prixPeriodeHtCents: number;
}

export interface VueAbonnement {
  readonly mensuelCatalogueHtCents: number;
  readonly tauxTvaPercent: number;
  readonly terme: string;
  readonly modeAvance: string;
  readonly periodes: readonly VuePeriode[];
  readonly engagementMois: number;
  readonly reconduction: string;
  readonly preavisMois: number;
  /** Plafond de l'indemnité de sortie anticipée, en centimes HT ; null = aucune. */
  readonly indemniteSortieMaxHtCents: number | null;
  readonly indemniteSortieTauxPercent: number;
}

export interface VueMaintenance {
  readonly obligatoire: boolean;
  readonly moisOfferts: number;
  readonly mensuelHtCents: number;
  readonly periodesMois: readonly number[];
}

export interface VueFormule {
  readonly formule: Formule;
  /** Titre court : « Formule A · Achat ». */
  readonly titre: string;
  readonly lignes: readonly VueLigneFormule[];
  /** Automatisations facultatives : proposées, hors total tant que non retenues. */
  readonly options: readonly VueLigneFormule[];
  readonly totalHtCents: number;
  readonly totalTvaCents: number;
  readonly totalTtcCents: number;
  readonly phases: readonly VuePalier[];
  readonly abonnement: VueAbonnement | null;
  readonly maintenance: VueMaintenance | null;
  /** Hébergement chez Axion-IA (ligne séparée), mensuel HT en centimes. */
  readonly hebergementMensuelHtCents: number | null;
}

export interface VueServiceTiers {
  readonly nom: string;
  readonly obligatoire: boolean;
  readonly estimationHtCents: number | null;
  readonly rythme: string;
}

export interface VueFormules {
  readonly formules: readonly VueFormule[];
  readonly servicesTiers: readonly VueServiceTiers[];
  readonly plafondAConfirmer: { readonly montantHtCents: number; readonly texte: string } | null;
  /** Durée de garantie en jours ; null = aucune garantie. */
  readonly garantieJours: number | null;
  /** Avantages, inconvénients, prérequis et clauses ACTIFS, tels que saisis. */
  readonly textes: readonly string[];
}

const TITRES: Readonly<Record<Formule, string>> = {
  achat: "Formule A · Achat",
  abonnement: "Formule B · Mise en place + abonnement",
};

const DECLENCHEURS: Readonly<Record<string, string>> = {
  signature: "À la signature",
  avancement: "À l'avancement",
  livraison: "À la livraison",
};

export const LIBELLES_TERME: Readonly<Record<string, string>> = {
  a_echoir: "À échoir (payé en début de période)",
  echu: "À terme échu (payé en fin de période)",
};

export const LIBELLES_RECONDUCTION: Readonly<Record<string, string>> = {
  mensuelle: "Reconduction mensuelle",
  annuelle: "Reconduction annuelle",
  aucune: "Sans reconduction",
};

export const LIBELLES_MODE_AVANCE: Readonly<Record<string, string>> = {
  premiere_periode_seulement: "Durée choisie payée d'avance pour la première période seulement",
  toutes_periodes: "Durée choisie payée d'avance à chaque période",
};

export const LIBELLES_RYTHME: Readonly<Record<string, string>> = {
  ponctuel: "ponctuel",
  mensuel: "mensuel",
  annuel: "annuel",
};

function libelleModeIA(a: OffreDevisV1["automatisations"][number]): string {
  const apres =
    a.modeIAApres === "via_axion_forfait"
      ? "via Axion-IA, en forfait"
      : "directement auprès du fournisseur, à votre charge";
  switch (a.modeIA) {
    case "client_direct":
      return "IA à votre charge, directement auprès du fournisseur";
    case "via_axion_forfait":
      return "IA fournie via Axion-IA, en forfait";
    case "incluse":
      return `IA incluse pendant ${a.moisIAInclus ?? 0} mois, puis ${apres}`;
  }
}

function vueFormule(offre: OffreDevisV1, formule: Formule): VueFormule {
  const bloc = formule === "achat" ? offre.achat : offre.abonnement;
  if (!bloc) throw new RangeError(`Formule « ${formule} » proposée sans bloc de prix.`);

  const base =
    formule === "achat"
      ? (offre.achat?.lignes ?? [])
      : (offre.abonnement?.miseEnServiceLignes ?? []);
  const obligatoires = offre.automatisations.filter((a) => !a.facultative);
  const facultatives = offre.automatisations.filter((a) => a.facultative);
  const codesObligatoires = obligatoires.map((a) => a.code);

  const lignes: VueLigneFormule[] = [
    ...base.map((l) => ({
      designation: l.libelle,
      quantite: l.quantite,
      prixUnitaireHtCents: l.prixHtCents,
      tauxTvaPercent: l.tauxTvaBps / 100,
      totalHtCents: Math.round(l.quantite * l.prixHtCents),
    })),
    ...obligatoires.map((a) => ({
      designation: a.libelle,
      quantite: 1,
      prixUnitaireHtCents: a.prixHtCents,
      tauxTvaPercent: a.tauxTvaBps / 100,
      totalHtCents: a.prixHtCents,
      precision: libelleModeIA(a),
    })),
  ];
  const libelleDe = (code: string): string =>
    offre.automatisations.find((x) => x.code === code)?.libelle ?? code;
  const options: VueLigneFormule[] = facultatives.map((a) => ({
    designation: a.libelle,
    quantite: 1,
    prixUnitaireHtCents: a.prixHtCents,
    tauxTvaPercent: a.tauxTvaBps / 100,
    totalHtCents: a.prixHtCents,
    precision: [
      "Facultative",
      a.dependDe.length > 0 ? `nécessite : ${a.dependDe.map(libelleDe).join(", ")}` : null,
      libelleModeIA(a),
    ]
      .filter((x) => x !== null)
      .join(" — "),
  }));

  const totaux = totauxFormule(offre, formule, codesObligatoires);
  const tauxPhases = lignes.map((l) => Math.round(l.tauxTvaPercent * 100));
  const paliers = echeancierPhases(totaux.totalHtCents, bloc.phases, tauxPhases);
  const phases: VuePalier[] = [...bloc.phases]
    .sort((a, b) => a.rang - b.rang)
    .map((p, i) => ({
      rang: p.rang,
      libelle: p.libelle,
      pourcentage: p.pourcentage,
      declencheur: DECLENCHEURS[p.declencheur] ?? p.declencheur,
      montantHtCents: paliers[i]!.montantHtCents,
    }));

  let abonnement: VueAbonnement | null = null;
  let maintenance: VueMaintenance | null = null;
  let hebergement: number | null = null;

  if (formule === "abonnement" && offre.abonnement) {
    const a = offre.abonnement;
    const periodes = a.periodes.map((p) => ({
      mois: p.mois,
      remisePercent: p.remiseBps / 100,
      mensuelNetHtCents: prixMensuelNet(a.mensuelCatalogueHtCents, p.remiseBps),
      prixPeriodeHtCents: prixMensuelNet(a.mensuelCatalogueHtCents, p.remiseBps) * p.mois,
    }));
    // Plafond = le cas le plus défavorable au client : tout l'engagement restant, au
    // plus haut mensuel net proposé. Sans engagement ou à taux 0 : aucune indemnité.
    const plusHaut = Math.max(...periodes.map((p) => p.mensuelNetHtCents));
    const indemnite =
      a.engagementMois > 0 && a.indemniteSortieTauxBps > 0
        ? indemniteSortieMaxCents(plusHaut * a.engagementMois, a.indemniteSortieTauxBps)
        : null;
    abonnement = {
      mensuelCatalogueHtCents: a.mensuelCatalogueHtCents,
      tauxTvaPercent: a.tauxTvaBps / 100,
      terme: LIBELLES_TERME[a.terme] ?? a.terme,
      modeAvance: LIBELLES_MODE_AVANCE[a.modeAvance] ?? a.modeAvance,
      periodes,
      engagementMois: a.engagementMois,
      reconduction: LIBELLES_RECONDUCTION[a.reconduction] ?? a.reconduction,
      preavisMois: a.preavisMois,
      indemniteSortieMaxHtCents: indemnite,
      indemniteSortieTauxPercent: a.indemniteSortieTauxBps / 100,
    };
  }
  if (formule === "achat" && offre.achat) {
    const m = offre.achat.maintenance;
    maintenance = {
      obligatoire: m.regle === "obligatoire",
      moisOfferts: m.moisOfferts,
      mensuelHtCents: m.mensuelHtCents,
      periodesMois: [...m.periodesMois],
    };
    hebergement =
      offre.achat.hebergement === "axion" ? (offre.achat.hebergementMensuelHtCents ?? null) : null;
  }

  return {
    formule,
    titre: TITRES[formule],
    lignes,
    options,
    totalHtCents: totaux.totalHtCents,
    totalTvaCents: totaux.totalTvaCents,
    totalTtcCents: totaux.totalTtcCents,
    phases,
    abonnement,
    maintenance,
    hebergementMensuelHtCents: hebergement,
  };
}

/** Vue complète. `offre` DOIT être valide (`offreDevisV1.parse`) : rien n'est revalidé ici. */
export function vueFormules(offre: OffreDevisV1): VueFormules {
  const ordre: Formule[] = ["achat", "abonnement"];
  return {
    formules: ordre
      .filter((f) => offre.formulesProposees.includes(f))
      .map((f) => vueFormule(offre, f)),
    servicesTiers: offre.servicesTiers.map((s) => ({
      nom: s.nom,
      obligatoire: s.obligatoire,
      estimationHtCents: s.estimationHtCents,
      rythme: LIBELLES_RYTHME[s.rythme] ?? s.rythme,
    })),
    plafondAConfirmer: offre.plafondAConfirmer,
    garantieJours: offre.garantie.jours,
    textes: offre.textes.filter((t) => t.actif && t.texte.trim() !== "").map((t) => t.texte.trim()),
  };
}
