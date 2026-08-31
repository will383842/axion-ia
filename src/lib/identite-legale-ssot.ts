// SSOT des littéraux d'identité légale — MODULE PUR, zéro import.
//
// ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
//
// La raison sociale vivait dans `src/lib/brand.ts`, et `identite-legale-registre.spec.ts`
// interdit — à juste titre — toute recopie littérale ailleurs sous `src/` :
// elle avait déjà divergé en sept copies, dont l'une écrivait « Axion-IA SAS »
// (avec trait d'union) là où le Kbis porte « AXION IA ». Un caractère d'écart
// casse le rapprochement d'entité que Google fait avec SIRENE et l'INPI.
//
// Mais `brand.ts` fait `import { env } from "@/env"`. Or le pied de page légal
// des e-mails est rendu dans le worker BullMQ, hors requête, et ce chemin ne
// charge PAS `@/env` aujourd'hui : la convention du dépôt (cf. l'en-tête de
// `server/qualiopi/config/flag.ts`) est de lire `process.env` brut sur ce
// trajet, « pour ne pas toucher la validation Zod des secrets prod ».
//
// Les deux règles sont justes, et elles se contredisaient :
//   • dériver plutôt que recopier → importer `brand.ts` ;
//   • garder le rendu d'e-mail pur → ne pas importer `brand.ts`.
//
// On sort du dilemme en déplaçant le littéral, pas en choisissant un camp : les
// valeurs figées descendent ici, dans un module SANS AUCUN IMPORT, et les deux
// côtés en dérivent. `brand.ts` continue d'exposer `legalName` (rien ne change
// pour ses appelants), et `lib/email/legal-footer.ts` lit la même source sans
// rien traîner avec elle.
//
// ── CE QUI A LE DROIT DE FIGURER ICI ────────────────────────────────────────
//
// Uniquement ce qui est PUBLIC et FIGÉ à un registre : dénomination, adresse du
// siège, SIREN, SIRET, TVA intracommunautaire. Ces valeurs ne changent qu'au
// prix d'une formalité (transfert de siège, changement de dénomination) qui
// passera de toute façon par une modification de code.
//
// ⛔ Rien de configurable. `COMPANY_ADDRESS` a produit une entité à DEUX
// adresses en production le 02/08/2026 — présente au runtime, absente au SSG,
// et sans le complément de domiciliation. Une adresse de siège n'est pas un
// réglage : la rendre configurable garantit qu'elle re-divergera.
//
// Source : Kbis (RCS Grenoble, à jour au 30/07/2026, n° de gestion 2026B01964)
// et avis de situation SIRENE du 02/08/2026, qui concordent.

export const IDENTITE_LEGALE = {
  /**
   * Dénomination immatriculée EXACTE — « AXION IA », **sans trait d'union**,
   * suivie de la forme sociale.
   *
   * 🔴 NE PAS réaligner sur la marque commerciale « Axion-IA » : c'est ce champ
   * que Google rapproche des registres pour fusionner l'entité, et un tiret ici
   * ne matche AUCUN registre. Le tiret appartient à `BRAND.name`.
   */
  legalName: "AXION IA SAS",

  /** Forme juridique en toutes lettres (LCEN art. 1-1). */
  legalFormFr: "SAS française",
  legalFormEn: "French company (SAS)",

  /**
   * Adresse du siège, en composants.
   *
   * 🔴 `complement` fait partie de l'adresse immatriculée : SIRENE le porte sur
   * sa propre ligne, et l'omettre casse l'exact-match NAP. Ne pas « nettoyer ».
   */
  rue: "11 Avenue Paul Verlaine",
  complement: "ELITE BUREAUX - boîte 53",
  codePostal: "38100",
  ville: "Grenoble",
  pays: "France",

  /** SIREN à 9 chiffres — l'identifiant que la LCEN exige d'afficher. */
  siren: "108018631",
  /** SIRET du siège (SIREN + NIC 00011), clé de Luhn valide. */
  siret: "10801863100011",
  /** TVA intracommunautaire — clé 51 + SIREN. */
  vat: "FR51108018631",
} as const;

/** Adresse du siège sur une ligne, complément compris. Pied de page e-mail. */
export function adresseSiegeUneLigne(): string {
  const i = IDENTITE_LEGALE;
  return `${i.rue}, ${i.complement}, ${i.codePostal} ${i.ville}, ${i.pays}`;
}
