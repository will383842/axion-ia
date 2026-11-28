/** Texte exact du fichier généré `src/generated/villes-publiables.ts` (partagé script ↔ test). */
export function contenuListeGeneree(slugsPubliables: ReadonlyArray<string>): string {
  const triés = [...slugsPubliables].sort();
  const corps = triés.map((s) => `  ${JSON.stringify(s)},`).join("\n");
  return `// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Source : \`scripts/content-gen/gen-villes-publiables.ts\` (verdict \`evaluerPageVille\`).
// Régénérer : pnpm tsx scripts/content-gen/gen-villes-publiables.ts
// Le test \`porte-qualite-ville-liste.spec.ts\` échoue si ce fichier est périmé.
//
// Villes dont la page par-ville passe la porte de qualité. Sans effet tant que le drapeau
// \`VILLES_PORTE_QUALITE_ACTIVE\` est éteint. Edge-safe : littéral pur.

export const VILLES_PUBLIABLES_CAP: ReadonlyArray<string> = [${triés.length ? `\n${corps}\n` : ""}];
`;
}
