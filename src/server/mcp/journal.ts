/**
 * **LE JOURNAL DE L'ADAPTATEUR — AUCUN CONTENU, JAMAIS.**
 *
 * Une ligne par appel, avec CE QUI S'EST PASSÉ et jamais CE QUI A ÉTÉ LU : le
 * nom de l'outil, l'identifiant de requête, le code de sortie, la durée, le
 * nombre d'éléments et d'octets. Ni argument, ni élément, ni message d'erreur
 * venu d'une source — un message d'erreur de Prisma peut citer une valeur.
 *
 * La garde `__tests__/journal.spec.ts` dérive de `detectPii` : elle exerce les
 * outils sur des jeux saturés de coordonnées, capture chaque ligne écrite ici,
 * et annonce combien elle en a scannées.
 */

export const CODES_DE_SORTIE = [
  "ok",
  "invalid_input",
  "tool_not_found",
  "result_too_large",
  "upstream_unavailable",
  "internal",
] as const;

export type CodeDeSortie = (typeof CODES_DE_SORTIE)[number];

export interface LigneDeJournal {
  readonly outil: string;
  readonly requestId: string;
  readonly principal: string;
  readonly code: CodeDeSortie;
  readonly dureeMs: number;
  /** Nombre d'éléments rendus, ou `null` hors succès. */
  readonly returned: number | null;
  /** Taille canonique de la sortie, ou `null` hors succès. */
  readonly octets: number | null;
}

/** Le préfixe de chaque ligne — c'est lui que la garde cherche dans la capture. */
export const PREFIXE_DU_JOURNAL = "[mcp·appel]";

/** Les seules clés qu'une ligne peut porter. Verrouillées par la garde. */
export const CLES_DU_JOURNAL: readonly (keyof LigneDeJournal)[] = [
  "outil",
  "requestId",
  "principal",
  "code",
  "dureeMs",
  "returned",
  "octets",
];

export function formaterLigne(ligne: LigneDeJournal): string {
  const projection: Record<string, string | number | null> = {};
  for (const cle of CLES_DU_JOURNAL) projection[cle] = ligne[cle];
  return `${PREFIXE_DU_JOURNAL} ${JSON.stringify(projection)}`;
}

export function consigner(ligne: LigneDeJournal): void {
  // Le journal applicatif du serveur est la sortie standard du conteneur : c'est
  // ce que Coolify et Sentry (breadcrumbs) collectent. Pas de logger dédié dans
  // le dépôt ; `console.info` est le canal en service pour les traces serveur.
  // eslint-disable-next-line no-console
  console.info(formaterLigne(ligne));
}
