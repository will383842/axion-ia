/**
 * commission.ts — la résolution de commission, fonction PURE dérivée de `pricing.ts`.
 *
 * REQ-INT-006 : « calculé dans axionia par une fonction pure dérivée de pricing.ts ;
 * Partners ne contient aucune copie de la grille. » Ce module est le seul endroit où
 * la grille commerciale rencontre le contrat d'événements. Il n'en fait pas une copie :
 * il IMPORTE `COMMERCIAL_COMMISSIONS`, la SSOT du dépôt.
 *
 * 🔴 LE DÉFAUT QUE CE MODULE EXISTE POUR NE PAS REPRODUIRE (REQ-DM-015, A-2).
 * La formule antérieure était `flatEur × quantiteJournees × 100`. Elle DOUBLAIT la
 * commission sur tous les paliers pluri-journées, parce que le palier porte déjà la
 * durée : « Formation 2 jours » vaut 1 000 € dans la grille — c'est-à-dire 500 €
 * la journée, deux journées. Multiplier une seconde fois par 2 rend 2 000 €.
 * `jours` sert à IDENTIFIER LE PALIER, et à rien d'autre. Il n'apparaît dans aucune
 * multiplication de ce fichier, et le test frontière le vérifie.
 *
 * 🔑 AUCUN CAS NE REND ZÉRO, AUCUN CAS NE LÈVE. REQ-DM-015 est explicite : « un cas
 * sans barème produit le blocage "barème indéfini", jamais 0 ni une exception ». Un
 * zéro se confond avec une commission nulle légitime ; une exception fait perdre
 * l'événement. Un verdict `bloquee` remonte en console et se traite à la main.
 */
import { createHash } from "node:crypto";

import {
  COMMERCIAL_COMMISSIONS,
  commissionFormation,
  type CommercialCommission,
} from "@/content/pricing";

/** Les cinq valeurs de l'enum Prisma `ActiviteFacturation`. */
export type ActiviteFacturation = "formation" | "un_a_un" | "audit" | "implementation" | "site_web";

export type EntreeCommission = {
  /** Nullable : une ligne de devis peut ne porter aucune activité (`Devis.activite?`). */
  readonly activite: ActiviteFacturation | null;
  /**
   * Le nombre de journées. Formation (contrat 2.3, A1.1) : 500 € PAR JOURNÉE — c'est le taux
   * journalier qui est multiplié, jamais le forfait d'un palier (A-2 : 2 jours = 1 000 €).
   */
  readonly jours: number | null;
  readonly montantHtCents: number;
  /**
   * Prix PUBLIC de référence de la ligne, en centimes HT (`prixReferenceDeLaLigne`). Formation :
   * il porte le prorata de remise de l'art. 4.1 bis, comme le moteur. Absent : la commission
   * d'une formation n'est pas calculée (aucun montant inventé), elle est bloquée « à qualifier ».
   */
  readonly prixReferenceHtCents?: number | null;
};

export type ResolutionCommission = {
  readonly statut: "calculee" | "bloquee";
  /** L'id dans `COMMERCIAL_COMMISSIONS`, ou null si aucune entrée ne vise l'activité. */
  readonly commissionId: string | null;
  readonly montantCents: number | null;
  /** REQ-DM-015 / REQ-ARG-017 : le motif porté par la ligne bloquée. */
  readonly motifBlocage: "a_qualifier" | null;
  /**
   * Le libellé que l'apporteur lit. Écrit par REQ-ARG-017, pas inventé ici.
   *
   * 🔑 IL S'APPELAIT `libelleApporteur`, ET LA FRONTIÈRE L'A REFUSÉ (2026-09-05).
   * `FRONTIERE_INTERDITE` refuse toute clé qui contient « apporteur » — famille
   * `identite_autre_apporteur`, REQ-INT-029. La garde avait raison de rougir : elle
   * ne sait pas lire une intention, seulement un nom, et un nom qui dit « apporteur »
   * est indiscernable d'une fuite d'identité pour tout relecteur futur.
   *
   * La réponse n'a PAS été d'exempter le champ : une exemption de plus est une maille
   * de moins, et celle-ci aurait couvert par avance tous les `…Apporteur` qu'on
   * ajouterait ensuite. C'est le NOM qui était faux. La valeur n'a jamais été une
   * identité : c'est le libellé de la LIGNE DE GRILLE (« Formation 2 jours »,
   * « Prestation hors grille de commissions »). « Apporteur » n'y désignait que le
   * LECTEUR du libellé, pas son sujet.
   */
  readonly libelleCommission: string | null;
  /** La grille QUI A SERVI, pour que Partners puisse épingler la version. */
  readonly grilleVersion: string;
};

const LIBELLE_BLOQUEE = "Prestation hors grille de commissions";

/**
 * La version de la grille, DÉRIVÉE de son contenu.
 *
 * 🔑 Pourquoi pas un numéro à incrémenter : un numéro manuel est mis à jour par la
 * même personne, dans le même geste, que la grille qu'il est censé dater — il est
 * donc toujours juste au moment où on l'écrit et faux dès qu'on oublie. Une empreinte
 * du contenu ne s'oublie pas : elle change parce que la grille a changé, jamais parce
 * que quelqu'un y a pensé. Partners épingle cette valeur avec chaque commission :
 * deux commissions de versions différentes deviennent alors comparables.
 *
 * Seuls les champs qui ENTRENT DANS LE CALCUL sont hachés — un libellé retouché ne
 * doit pas invalider des commissions déjà versées.
 */
export function versionDeLaGrille(grille: ReadonlyArray<CommercialCommission>): string {
  const canonique = grille
    .map((c) => `${c.id}|${c.kind}|${c.flatEur ?? ""}|${c.percent ?? ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonique, "utf8").digest("hex").slice(0, 12);
}

export const GRILLE_VERSION = versionDeLaGrille(COMMERCIAL_COMMISSIONS);

/**
 * L'id de commission qui vise une activité, et pour une formation le palier que
 * `jours` identifie.
 *
 * Formation : l'id RANGE la ligne dans une famille de la grille (`-4h` sous 1 jour, `-1j`
 * sous 2, `-2j` sous 3, `-3j` au-delà) ; le MONTANT et le LIBELLÉ suivent les journées
 * réellement vendues (« Formation — 4 journées (500 € par journée) »), jamais la famille.
 */
function idPourActivite(activite: ActiviteFacturation, jours: number | null): string | null {
  switch (activite) {
    case "formation": {
      // Pas de journées = pas de palier. Aucun repli sur « 1 jour » : ce serait
      // inventer un palier, donc inventer un montant.
      // Contrat 2.3, A1.1 (2026-10-07) : par DEMI-journée au moins (0,5 = 4 heures).
      if (jours === null || !Number.isFinite(jours) || jours < 0.5 || (jours * 2) % 1 !== 0)
        return null;
      if (jours < 1) return "com-formation-4h";
      if (jours < 2) return "com-formation-1j";
      if (jours < 3) return "com-formation-2j";
      return "com-formation-3j";
    }
    case "un_a_un":
      return "com-un-a-un";
    case "audit":
      return "com-audit";
    case "implementation":
      return "com-integration";
    case "site_web":
      // La grille ne porte AUCUNE entrée pour le site web. C'est un fait mesuré, pas
      // un oubli de ce module : la vente de site web n'est pas commissionnée par la
      // grille publiée. Le verdict est donc un blocage, et le test le prouve contre
      // la grille réelle.
      return null;
  }
}

/** « Formation — 4 journées (500 € par journée) », « … — 1,5 journée … » : le libellé dit le compte. */
function libelleFormation(jours: number): string {
  const n = jours.toLocaleString("fr-FR");
  const mot = jours >= 2 ? "journées" : "journée";
  return `Formation — ${n} ${mot} (${commissionFormation(1)} € par journée)`;
}

function bloquee(commissionId: string | null): ResolutionCommission {
  return {
    statut: "bloquee",
    commissionId,
    montantCents: null,
    motifBlocage: "a_qualifier",
    libelleCommission: LIBELLE_BLOQUEE,
    grilleVersion: GRILLE_VERSION,
  };
}

/**
 * Le verdict de commission d'une ligne.
 *
 * `flat` = `flatEur × 100` — UNE FOIS par commande portant le palier.
 * `percent` = `floor(percent × montantHtCents / 100)`, comme le moteur.
 * Formation = 500 € × journées (contrat 2.3, A1.1).
 * `scale`, ou barème introuvable → `bloquee` / `a_qualifier`.
 */
export function resoudreCommission(e: EntreeCommission): ResolutionCommission {
  if (e.activite === null) return bloquee(null);

  const id = idPourActivite(e.activite, e.jours);
  if (id === null) return bloquee(null);

  const entree = COMMERCIAL_COMMISSIONS.find((c) => c.id === id);
  if (entree === undefined) {
    // La grille a bougé sous ce module : l'id qu'il vise n'existe plus. C'est un
    // blocage, pas une exception — l'événement doit partir et l'anomalie se voir.
    return bloquee(null);
  }

  // FORMATION — contrat 2.3, A1.1 (décision de Will, 2026-10-07) : 500 € PAR JOURNÉE vendue,
  // sans limite (5 journées = 2 500 €), la demi-journée à 250 €. C'est la règle du moteur
  // (`regles.ts`). A-2 reste vrai : le montant est le TAUX JOURNALIER × les journées, jamais un
  // forfait de palier multiplié une seconde fois (2 jours = 1 000 €, pas 2 000 €).
  if (e.activite === "formation" && e.jours !== null) {
    // Prorata de remise (art. 4.1 bis), À L'IDENTIQUE du moteur (`regles.ts`) : au prix public
    // ou plus cher → le forfait ; moins cher → forfait × prix facturé ÷ prix public, arrondi
    // à l'inférieur. Jamais au-delà du forfait, jamais au-delà de la facture.
    const reference = e.prixReferenceHtCents ?? null;
    if (reference === null || !(reference > 0)) return bloquee(id);
    const forfaitCents = Math.round(commissionFormation(e.jours) * 100);
    const ht = Math.max(0, e.montantHtCents);
    return {
      statut: "calculee",
      commissionId: id,
      montantCents: ht >= reference ? forfaitCents : Math.floor((forfaitCents * ht) / reference),
      motifBlocage: null,
      libelleCommission: libelleFormation(e.jours),
      grilleVersion: GRILLE_VERSION,
    };
  }

  if (entree.kind === "flat") {
    if (entree.flatEur === undefined) return bloquee(id);
    // ⚠️ `e.jours` N'APPARAÎT PAS dans cette ligne. C'est le correctif A-2.
    return {
      statut: "calculee",
      commissionId: id,
      montantCents: entree.flatEur * 100,
      motifBlocage: null,
      libelleCommission: entree.labelFr,
      grilleVersion: GRILLE_VERSION,
    };
  }

  if (entree.kind === "percent") {
    if (entree.percent === undefined) return bloquee(id);
    return {
      statut: "calculee",
      commissionId: id,
      // À l'inférieur, comme le moteur (`regles.ts`) : un centime n'est jamais arrondi au-dessus.
      montantCents: Math.floor((entree.percent * e.montantHtCents) / 100),
      motifBlocage: null,
      libelleCommission: entree.labelFr,
      grilleVersion: GRILLE_VERSION,
    };
  }

  // `scale` : montant non public, détaillé après candidature. Rien à calculer ici —
  // et surtout pas un zéro, qui se lirait comme « aucune commission due ».
  return bloquee(id);
}
