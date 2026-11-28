/**
 * REGISTRE DES COLONNES CHIFFRÉES (#2464 PR P, rotation de la clé `PII_ENCRYPTION_KEY`).
 *
 * ⚠️ PÉRIMÈTRE ACTUEL : LES TABLES D'APPORTEURS SEULEMENT. `PII_ENCRYPTION_KEY` chiffre toute l'application (des
 * dizaines de fichiers) : le reste du dépôt doit entrer ici, dans un lot à part, avant qu'on puisse retirer l'ancienne
 * clé. TANT QUE CE REGISTRE NE COUVRE PAS TOUT, L'ANCIENNE CLÉ NE PEUT PAS ÊTRE RETIRÉE (docs/runbooks/R30-rotation-cle-pii.md).
 *
 * Sans `server-only` : lu par le script `scripts/securite/rotation-cle-pii.ts` (hors Next) et par des tests.
 * Aucune valeur ni clé ici : des noms de colonnes seulement.
 */

export type FormatColonneChiffree = "v1" | "v2" | "octets";

export interface ColonneChiffree {
  /** Nom du délégué Prisma (`prisma.<modele>`). */
  readonly modele: string;
  /** Champ Prisma de la clé primaire (`id`, `pieceId`, `demandeId`). */
  readonly cle: string;
  readonly champ: string;
  readonly format: FormatColonneChiffree;
  /** Donnée liée (AAD) d'un `enc:v2:`, calculée depuis l'identifiant de la ligne. */
  readonly aad?: (ligne: { id: string }) => string;
  /** La table porte un déclencheur qui n'ouvre la réécriture que sous `SET LOCAL axion.reecriture_pii = 'rotation'`. */
  readonly declencheur?: boolean;
  /**
   * Champ `@updatedAt` de la table, à REMETTRE tel quel à chaque écriture : une rotation n'est pas une activité de la
   * personne, et `majAt` alimente le compteur d'inactivité de la purge RGPD (`purge-rgpd.ts`).
   */
  readonly majAt?: string;
}

export const COLONNES_CHIFFREES: readonly ColonneChiffree[] = [
  ...(["prenom", "nom", "email", "telephone", "adresse", "iban"] as const).map(
    (champ): ColonneChiffree => ({
      modele: "apporteurReseau",
      cle: "id",
      champ,
      format: "v1",
      majAt: "majAt",
    }),
  ),
  ...(["personneNom", "personneEmail", "personneTelephone"] as const).map(
    (champ): ColonneChiffree => ({
      modele: "presentationEntreprise",
      cle: "id",
      champ,
      format: "v1",
      majAt: "majAt",
    }),
  ),
  { modele: "apporteurMessageRecu", cle: "id", champ: "excerpt", format: "v1" },
  { modele: "pieceApporteurContenu", cle: "pieceId", champ: "octets", format: "octets" },
  {
    modele: "apporteurChangementIban",
    cle: "id",
    champ: "iban",
    format: "v2",
    aad: (l) => `changement-iban:${l.id}`,
    declencheur: true,
  },
  {
    modele: "apporteurChangementIbanRib",
    cle: "demandeId",
    champ: "octets",
    format: "octets",
    declencheur: true,
  },
  {
    modele: "apporteurIbanHistorique",
    cle: "id",
    champ: "iban",
    format: "v2",
    aad: (l) => `iban-historique:${l.id}`,
    declencheur: true,
  },
];
