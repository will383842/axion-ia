/**
 * W-2 « À faire maintenant » (lot F, M20) — les gestes humains du parcours, rangés par
 * rubrique, tels que le REGISTRE les déclare (`gestes-humains.ts`). Module pur : la page
 * le lit, jamais l'inverse. Un geste ajouté au registre apparaît ici sans autre geste.
 */

import { GESTES_HUMAINS, type GesteHumain, type RubriqueAFaire } from "./gestes-humains";

export interface BlocAFaire {
  readonly rubrique: RubriqueAFaire;
  readonly titre: string;
  /** Où l'on pose ces gestes : une page de la console. */
  readonly href: string;
  readonly gestes: ReadonlyArray<GesteHumain>;
}

/** Ordre d'affichage, titre court, et page de la console où le geste se pose. */
const RUBRIQUES: ReadonlyArray<{
  readonly rubrique: RubriqueAFaire;
  readonly titre: string;
  readonly chemin: string;
}> = [
  {
    rubrique: "candidats",
    titre: "Candidats",
    chemin: "contacts/candidatures?view=formateurs-freelance",
  },
  { rubrique: "echanges", titre: "Échanges", chemin: "rendez-vous" },
  { rubrique: "pieces", titre: "Pièces", chemin: "qualiopi/formateurs/pieces" },
  {
    rubrique: "signatures",
    titre: "Signatures",
    chemin: "qualiopi/formateurs/dossiers?onglet=a_verifier",
  },
  { rubrique: "habilitations", titre: "Habilitations", chemin: "qualiopi/formateurs" },
  { rubrique: "presence", titre: "Présence", chemin: "qualiopi/sessions" },
  { rubrique: "rendez_vous", titre: "Rendez-vous", chemin: "rendez-vous" },
  { rubrique: "remuneration", titre: "Honoraires", chemin: "qualiopi/remuneration" },
  { rubrique: "reglages", titre: "Réglages", chemin: "qualiopi/formateurs/interrupteurs" },
];

/** `adminBase` = `/fr/<adminPrefix>`. Une rubrique sans geste n'a pas de bloc. */
export function blocsAFaire(adminBase: string): ReadonlyArray<BlocAFaire> {
  return RUBRIQUES.flatMap((r) => {
    const gestes = GESTES_HUMAINS.filter((g) => g.rubrique === r.rubrique);
    return gestes.length === 0
      ? []
      : [{ rubrique: r.rubrique, titre: r.titre, href: `${adminBase}/${r.chemin}`, gestes }];
  });
}

/**
 * Les pages du groupe qu'aucun menu ne montre : reliées d'ici. Chaque page garde sa propre
 * porte (interrupteur) ; le lien n'est offert que si elle s'ouvre.
 */
export function liensAnnexes(
  adminBase: string,
  ouvert: {
    readonly suivi_echange: boolean;
    readonly mise_a_niveau: boolean;
    readonly changement_coordonnees?: boolean;
  },
): ReadonlyArray<{ libelle: string; href: string }> {
  const base = `${adminBase}/qualiopi/formateurs`;
  return [
    ...(ouvert.suivi_echange
      ? [{ libelle: "Échanges de découverte", href: `${base}/echanges-du-pont` }]
      : []),
    ...(ouvert.mise_a_niveau ? [{ libelle: "Mise à niveau", href: `${base}/mise-a-niveau` }] : []),
    ...(ouvert.changement_coordonnees === true
      ? [{ libelle: "Changements IBAN et adresse", href: `${base}/changements` }]
      : []),
    { libelle: "Pièces", href: `${base}/pieces` },
    // Pages sans autre porte : chacune garde la sienne et dit quelle clé l'ouvre.
    { libelle: "Lieux à compléter", href: `${base}/lieux` },
    { libelle: "Rattrapage des candidatures", href: `${base}/rattrapage` },
  ];
}
