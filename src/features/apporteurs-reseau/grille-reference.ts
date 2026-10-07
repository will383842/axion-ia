// La GRILLE DE RÉFÉRENCE des commissions, produit par produit (2026-10-07, décision de Will).
//
// Le contrat 2.3 (annexe 1, A1.7) renvoie, pour un produit créé APRÈS la signature, à « la
// grille de référence publiée par la Société ». Cette grille, c'est ici — et la page publique
// `/fr/apporteur-affaires/commissions` la rend.
//
// 🔑 AUCUN CHIFFRE ÉCRIT À LA MAIN. Les montants viennent des MÊMES sources que le moteur
// qui calcule les commissions :
//   · `regles.ts` : prix et forfaits des formations (PALIERS_FORMATION), taux (TAUX_BPS),
//     forfait de la conférence ;
//   · `pricing.ts` : prix publics des audits, des implémentations et du 1-to-1.
// Seuls les LIBELLÉS sont écrits ici : ce sont ceux de l'annexe 1. La garde
// `la-grille-de-reference-est-celle-du-contrat.spec.ts` compare chaque ligne au texte signé :
// une divergence rougit la CI.
//
// 📅 DATES : `publieLe` = date de la dernière modification du tableau dans le contrat,
// relevée dans l'historique git (2026-10-07) :
//   A1.1, A1.2, A1.3, A1.4, A1.5 → 2026-10-05 (ed37cfa2f, contrat v2) ;
//   A1.4 bis (conférence)        → 2026-10-06 (e012a08fb).
// Un produit AJOUTÉ plus tard porte son propre `ajouteLe` (AAAA-MM-JJ) : la date affichée
// pour lui est la plus récente des deux.

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_RECURRING_TIER,
  type PricingTier,
} from "@/content/pricing";
import { FORFAIT_CONFERENCE_CENTS, PALIERS_FORMATION, TAUX_BPS } from "./regles";

export interface LigneGrille {
  /** Les cellules, dans l'ordre des colonnes du tableau. */
  readonly cellules: readonly string[];
  /** Produit ajouté après la publication du tableau (AAAA-MM-JJ). */
  readonly ajouteLe?: string;
}

export interface TableauGrille {
  readonly cle: "A1.1" | "A1.2" | "A1.3" | "A1.4" | "A1.4 bis" | "A1.5";
  readonly titre: string;
  readonly regle: string;
  readonly colonnes: readonly string[];
  readonly lignes: readonly LigneGrille[];
  /** Dernière modification du tableau (AAAA-MM-JJ). */
  readonly publieLe: string;
}

/** « 1 900 € » (espaces simples, pour se comparer au texte du contrat). */
export function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/[  ]/g, " ")} €`;
}

const pourcent = (bps: number) => `${bps / 100} %`;

function palier(id: string, liste: readonly PricingTier[]): PricingTier {
  const t = liste.find((x) => x.id === id);
  if (!t) throw new Error(`[grille-reference] palier introuvable : ${id}`);
  return t;
}

/** Prix d'entrée d'un palier (`priceFlat`, sinon `priceMin`). */
function prixDEntree(t: PricingTier): number {
  const p = t.priceFlat ?? t.priceMin;
  if (p === undefined) throw new Error(`[grille-reference] palier sans prix : ${t.id}`);
  return p;
}

function prixSousPalier(t: PricingTier, i: number): number {
  const s = t.subTiers?.[i];
  if (!s) throw new Error(`[grille-reference] sous-palier ${i} introuvable : ${t.id}`);
  return s.priceFlat;
}

const aPartirDe = (n: number) => `à partir de ${euros(n)}`;

export function grilleDeReference(): readonly TableauGrille[] {
  const formation: LigneGrille[] = PALIERS_FORMATION.map((p) => {
    const [nom, duree] = p.libelle.split(", ");
    return { cellules: [nom!, duree!, euros(p.prixCents / 100), euros(p.forfaitCents / 100)] };
  });

  const unAUn = pourcent(TAUX_BPS.un_a_un);
  const accompagnement: LigneGrille[] = [
    ["Accompagnement dirigeant", "1 jour", palier("intervention-dirigeants", INTERVENTION_TIERS)],
    [
      "Accompagnement dirigeant",
      "2 jours",
      palier("intervention-dirigeant-vision-2j", INTERVENTION_TIERS),
    ],
    [
      "Accompagnement collaborateur",
      "1 jour",
      palier("intervention-membre-equipe", INTERVENTION_TIERS),
    ],
    [
      "Accompagnement collaborateur",
      "2 jours",
      palier("intervention-membre-equipe-2j", INTERVENTION_TIERS),
    ],
  ].map(([nom, duree, t]) => ({
    cellules: [nom as string, duree as string, euros(prixDEntree(t as PricingTier)), unAUn],
  }));
  accompagnement.push({
    cellules: [
      "Coaching individuel",
      "à la séance",
      aPartirDe(prixDEntree(UN_A_UN_RECURRING_TIER)),
      unAUn,
    ],
  });

  const audit = pourcent(TAUX_BPS.audit);
  const flash = palier("audit-flash", AUDIT_TIERS);
  const cible = palier("audit-cible", AUDIT_TIERS);
  const pme = palier("audit-strategique-pme", AUDIT_TIERS);
  const eti = palier("audit-strategique-eti", AUDIT_TIERS);
  const audits: LigneGrille[] = (
    [
      ["Audit sur place", prixDEntree(flash)],
      ["Audit sur place — sur site", prixSousPalier(flash, 0)],
      ["Audit ciblé", prixDEntree(cible)],
      ["Audit ciblé — solo", prixSousPalier(cible, 0)],
      ["Audit ciblé — standard", prixSousPalier(cible, 1)],
      ["Audit ciblé — avancé", prixSousPalier(cible, 2)],
      ["Audit stratégique PME", prixDEntree(pme)],
      ["Audit stratégique PME — 20 à 50 salariés", prixSousPalier(pme, 0)],
      ["Audit stratégique PME — 50 à 250 salariés", prixSousPalier(pme, 1)],
      ["Audit stratégique ETI", prixDEntree(eti)],
      ["Audit stratégique ETI — base", prixSousPalier(eti, 0)],
    ] as const
  ).map(([nom, prix]) => ({ cellules: [nom, aPartirDe(prix), audit] }));

  const impl = pourcent(TAUX_BPS.implementation);
  const prixImpl = (t: PricingTier) =>
    t.priceMin !== undefined && t.priceMax !== undefined
      ? `${euros(t.priceMin)} à ${euros(t.priceMax)}`
      : t.priceFlat !== undefined
        ? euros(t.priceFlat)
        : "sur devis";
  const implementations: LigneGrille[] = (
    [
      ["Pilote IA", "impl-poc"],
      ["Mission PME", "impl-mission-pme"],
      ["Mission ETI", "impl-mission-eti"],
      ["Grand programme", "impl-grand-programme"],
      ["IA custom d'entreprise (4 à 12 semaines)", "impl-ia-custom"],
    ] as const
  ).map(([nom, id]) => ({
    cellules: [nom, prixImpl(palier(id, IMPLEMENTATION_TIERS)), impl],
  }));

  return [
    {
      cle: "A1.1",
      titre: "Formations collectives",
      regle:
        "Forfait par journée de formation vendue, au prix public, réduit au prorata en cas de remise. Prix par groupe de 2 à 15 participants.",
      colonnes: ["Formation", "Durée", "Prix public HT", "Commission"],
      lignes: formation,
      publieLe: "2026-10-05",
    },
    {
      cle: "A1.2",
      titre: "Accompagnement individuel et coaching (1-to-1)",
      regle: `${unAUn} du montant hors taxes facturé.`,
      colonnes: ["Prestation", "Durée", "Prix public HT", "Commission"],
      lignes: accompagnement,
      publieLe: "2026-10-05",
    },
    {
      cle: "A1.3",
      titre: "Audits",
      regle: `${audit} du montant hors taxes facturé.`,
      colonnes: ["Palier", "Prix de référence HT", "Commission"],
      lignes: audits,
      publieLe: "2026-10-05",
    },
    {
      cle: "A1.4",
      titre: "Implémentations",
      regle: `${impl} du montant hors taxes facturé.`,
      colonnes: ["Palier", "Prix de référence HT", "Commission"],
      lignes: implementations,
      publieLe: "2026-10-05",
    },
    {
      cle: "A1.4 bis",
      titre: "Conférences",
      regle: "Forfait par conférence signée et payée, quel que soit le nombre de participants.",
      colonnes: ["Prestation", "Commission"],
      lignes: [
        { cellules: ["Conférence", `${euros(FORFAIT_CONFERENCE_CENTS / 100)} HT par conférence`] },
      ],
      publieLe: "2026-10-06",
    },
    {
      cle: "A1.5",
      titre: "Prestations non commissionnées",
      regle:
        "Ces prestations ne donnent lieu à aucune commission. Le « coup de projecteur » (podcast, interview, page dédiée), fourni gratuitement, n'en donne pas non plus.",
      colonnes: ["Prestation", "Commission"],
      lignes: [
        { cellules: ["Développement web", "Aucune"] },
        { cellules: ["Maintenance", "Aucune"] },
        { cellules: ["Intervention sur demande", "Aucune"] },
      ],
      publieLe: "2026-10-05",
    },
  ];
}

/** La date à afficher pour une ligne : la plus récente entre le tableau et son ajout. */
export function dateDeLaLigne(t: TableauGrille, l: LigneGrille): string {
  return l.ajouteLe && l.ajouteLe > t.publieLe ? l.ajouteLe : t.publieLe;
}
