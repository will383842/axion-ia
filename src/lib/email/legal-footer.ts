// SSOT du pied de page légal des e-mails — module PUR.
//
// POURQUOI CE FICHIER EXISTE
// ──────────────────────────
// Jusqu'au 2026-08-31, `_layout.tsx` lisait l'identité légale du pied de page
// dans l'environnement :
//
//     const COMPANY = {
//       name: process.env.COMPANY_NAME || "Axion-IA",
//       address: process.env.COMPANY_ADDRESS || "",   // ← chaîne vide en repli
//       registration: process.env.COMPANY_REGISTRATION_NUMBER || "",
//       vat: process.env.COMPANY_VAT_NUMBER || "",
//     };
//
// Trois défauts, dans l'ordre de gravité :
//
//  1. 🔴 Le repli est la chaîne VIDE, et `joinDefined` la filtre en silence. Un
//     e-mail rendu sans `COMPANY_ADDRESS` part donc SANS adresse de siège et
//     SANS numéro d'immatriculation — ce que la LCEN (art. 1-1, loi SREN
//     n° 2024-449) impose d'afficher. Le défaut ne se voit nulle part : pas de
//     log, pas de test, un pied de page simplement plus court.
//
//  2. 🔴 Ces variables vivent sur l'application Coolify **`axion-ia-worker`**,
//     distincte de l'app web et dotée de son propre environnement — c'est le
//     worker seul qui rend et envoie les e-mails (cf. l'en-tête de `client.ts`,
//     qui raconte comment la bascule ZeptoMail avait été faite sur la mauvaise
//     app). Une identité légale correcte sur le site ne prouve donc RIEN sur ce
//     que reçoivent les destinataires.
//
//  3. 🔴 `COMPANY_ADDRESS` a déjà produit une entité à DEUX adresses en
//     production, constatée le 02/08/2026 : la valeur d'environnement portait
//     « 11 Avenue Paul Verlaine, 38100 Grenoble », sans le complément
//     « ELITE BUREAUX - boîte 53 » qui fait pourtant partie de l'adresse
//     immatriculée à SIRENE. `src/lib/seo.ts` en a tiré la conclusion pour le
//     site et a figé l'adresse dans le code (voir le commentaire de
//     `buildSiegePostalAddress`), en notant explicitement : « `COMPANY_ADDRESS`
//     continue de servir le pied de page des e-mails — cette PR n'y touche
//     pas. » Ce fichier est cette PR-là.
//
// LA RÈGLE : une adresse de siège n'est pas un réglage. Elle est publique,
// figée au Kbis, et ne change qu'au transfert de siège — qui passera de toute
// façon par une modification de code. La rendre configurable garantissait la
// re-divergence. On la fige, comme le site, et une garde compare les deux.
//
// ⚠️ MODULE PUR — n'importe NI `next`, NI `prisma`, NI `@/env`. Il est évalué
// dans le worker BullMQ, hors requête, sans accès garanti à la base. Ajouter un
// import à effet de bord ici casserait le rendu de TOUS les e-mails.

import { MENTION_NON_AGREMENT, NDA_NUMERO } from "@/server/qualiopi/legal/legal-mentions";
// Littéraux d'identité légale — module PUR (zéro import), extrait de `brand.ts`
// le 2026-08-31 pour que ce pied de page les DÉRIVE au lieu de les recopier.
// `identite-legale-registre.spec.ts` interdit toute copie littérale sous `src/`,
// et à raison : la raison sociale avait déjà divergé en sept copies, dont une
// écrivait « Axion-IA SAS » là où le Kbis porte « AXION IA ».
import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";

/**
 * Identité légale de l'émetteur, telle qu'elle DOIT figurer au pied de chaque
 * e-mail (LCEN art. 1-1 ; art. L.6352-12 C. trav. pour la déclaration
 * d'activité).
 *
 * Valeurs recopiées du Kbis (RCS Grenoble, à jour au 30/07/2026) et de l'avis
 * de situation SIRENE du 02/08/2026, qui concordent.
 */
export const EMAIL_LEGAL = {
  /** Raison sociale EXACTE — dérivée, jamais recopiée. */
  legalName: IDENTITE_LEGALE.legalName,
  /** Forme juridique, en toutes lettres pour la version FR / EN. */
  legalFormFr: IDENTITE_LEGALE.legalFormFr,
  legalFormEn: IDENTITE_LEGALE.legalFormEn,
  /**
   * Adresse du siège sur une ligne, complément de domiciliation COMPRIS —
   * « ELITE BUREAUX - boîte 53 » fait partie de l'adresse immatriculée.
   */
  address: adresseSiegeUneLigne(),
  /** SIREN à 9 chiffres — l'identifiant que la LCEN exige d'afficher. */
  siren: IDENTITE_LEGALE.siren,
  /** SIRET du siège (SIREN + NIC 00011), clé de Luhn valide. */
  siret: IDENTITE_LEGALE.siret,
  /** N° de TVA intracommunautaire — clé 51 + SIREN. */
  vat: IDENTITE_LEGALE.vat,
  /** N° de déclaration d'activité d'organisme de formation. SSOT importée. */
  nda: NDA_NUMERO,
  /**
   * 🔴 Indissociable du numéro ci-dessus, et jamais rendue sans lui. L'art.
   * L.6352-12 C. trav. interdit de faire état de l'enregistrement sans préciser
   * qu'il ne vaut pas agrément : publier le numéro seul dans un pied de page
   * commercial est une infraction, pas un raccourci de mise en page.
   */
  mentionNonAgrement: MENTION_NON_AGREMENT,
  /**
   * Boîte de CONTACT — celle qu'un destinataire peut réellement joindre, et la
   * cible du `Reply-To` de tous les envois (cf. `client.ts`). Zoho Mail Lite,
   * relevée par Williams.
   *
   * Volontairement PAS `process.env.ADMIN_REPLY_FROM` : ce pied de page annonce
   * au destinataire où écrire. Le désaligner de l'en-tête `Reply-To` réel — ce
   * qu'une variable absente sur le worker suffirait à provoquer — enverrait les
   * réponses dans le vide en promettant le contraire.
   */
  contactEmail: "contact@axion-ia.com",
  /** Téléphone du fondateur, tel qu'imprimé sur la carte. Bloc signature. */
  phone: "+33 7 43 33 12 01",
  phoneTel: "+33743331201",
} as const;

/**
 * Le fondateur, pour le bloc signature des e-mails relationnels (référentiel
 * §6.1). Recopié de `FOUNDER` (`brand.ts`) pour la même raison que `legalName`
 * ci-dessus ; même garde de non-divergence.
 */
export const EMAIL_SIGNATURE = {
  fullName: "Williams Jullin",
  roleFr: "Fondateur — Axion-IA",
  roleEn: "Founder — Axion-IA",
  linkedin: "https://www.linkedin.com/in/williamsjullin/",
} as const;
