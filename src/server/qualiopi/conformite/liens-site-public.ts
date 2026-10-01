/**
 * Qualiopi — les pages du SITE PUBLIC où l'auditrice vérifie une information
 * publiée (indicateurs 1, 9, 26, 31).
 *
 * Module PUR. Le jumeau de `registres-par-indicateur.ts` : celui-là renvoie
 * vers la console (chemins RELATIFS, le préfixe admin est secret) ; celui-ci
 * renvoie vers ce que le PUBLIC voit, donc en liens ABSOLUS — l'auditrice les
 * ouvre dans un nouvel onglet, et le manifeste imprimé doit les porter en
 * entier.
 *
 * ⚠️ Chaque chemin correspond à une route réelle : `src/app/[locale]/<chemin>/
 * page.tsx`. `liens-site-public.spec.ts` le vérifie sur le disque — un lien
 * vers une page supprimée mènerait l'auditrice sur une 404, le jour du contrôle.
 *
 * Comme les registres, ces liens ne disent RIEN de la couverture.
 */

import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";

/**
 * Une fiche formation du catalogue public, pour que l'auditrice ouvre une
 * prestation détaillée (objectifs, prérequis, délai d'accès, tarif — sections
 * de `src/app/[locale]/formations/[slug]/page.tsx`). Dérivée du catalogue,
 * jamais écrite en dur : un slug retiré ne laisse pas un lien mort.
 */
const SLUG_FICHE_EXEMPLE = FORMATIONS_V2[0]?.slugFr;

export interface PagePublique {
  /** Chemin sous la locale française, sans origine (« /fr/… »). */
  readonly chemin: string;
  /** Ce que l'auditrice y trouve. */
  readonly libelle: string;
}

export interface LienPublic {
  readonly url: string;
  readonly libelle: string;
}

export const PAGES_PUBLIQUES_PAR_INDICATEUR: Readonly<Record<number, readonly PagePublique[]>> = {
  1: [
    { chemin: "/fr/formations", libelle: "Catalogue public des formations" },
    ...(SLUG_FICHE_EXEMPLE !== undefined
      ? [
          {
            chemin: `/fr/formations/${SLUG_FICHE_EXEMPLE}`,
            libelle:
              "Fiche d'une formation (objectifs, prérequis, délai d'accès, tarif, indicateurs de résultats)",
          },
        ]
      : []),
    // Les CGV ne disent rien des délais d'accès : ils sont sur chaque fiche.
    { chemin: "/fr/conditions-generales", libelle: "Conditions générales de vente" },
  ],
  9: [{ chemin: "/fr/reglement-interieur", libelle: "Règlement intérieur publié" }],
  26: [
    {
      chemin: "/fr/accessibilite",
      libelle: "Accessibilité et contact du référent handicap",
    },
  ],
  31: [{ chemin: "/fr/reclamations", libelle: "Procédure de réclamation publiée" }],
};

/** Origine publique configurée, sans barre finale (repli : https://axion-ia.com). */
export function originePublique(): string {
  return (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
}

/** Liens absolus vers le site public pour l'indicateur `numero` (jamais `undefined`). */
export function liensSitePublic(numero: number, origine: string = originePublique()): LienPublic[] {
  return (PAGES_PUBLIQUES_PAR_INDICATEUR[numero] ?? []).map((p) => ({
    url: `${origine}${p.chemin}`,
    libelle: p.libelle,
  }));
}
