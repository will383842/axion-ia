/**
 * Sépare un nom complet en colonnes Nom / Prénom pour les listes admin.
 *
 * La base ne stocke qu'UN champ (`contactName`, chiffré) : les formulaires
 * publics n'ont qu'un champ « nom », et le tunnel commercial concatène
 * « Prénom Nom » avant chiffrement. La séparation est donc une heuristique
 * d'AFFICHAGE : premier mot = prénom, reste = nom. Un seul mot est rendu
 * comme nom seul (un contact qui n'a saisi que « Dupont » n'a pas donné de
 * prénom).
 */
export function splitNomPrenom(full: string | null | undefined): {
  prenom: string | null;
  nom: string | null;
} {
  const clean = (full ?? "").trim();
  if (!clean) return { prenom: null, nom: null };
  const parts = clean.split(/\s+/);
  const first = parts[0] ?? null;
  if (parts.length === 1) return { prenom: null, nom: first };
  return { prenom: first, nom: parts.slice(1).join(" ") };
}
