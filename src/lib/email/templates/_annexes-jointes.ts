// Phrase « pièces jointes » des e-mails qui portent le lien du contrat à SIGNER (lien du dossier,
// rappels, « Retenu »). Construite à partir des annexes RÉELLEMENT jointes : le payload porte le
// champ FACULTATIF `annexesJointes` (identifiants des annexes). Absent, vide ou
// illisible : aucune phrase (un worker plus ancien n'écrit pas ce champ, rien ne casse).
// Aucun montant, aucun nom de ville : texte pur, sans dépendance serveur.

const LIBELLES: Readonly<Record<string, string>> = {
  "fiche-commissions": "la fiche des commissions",
  livret: "le livret",
  "guide-demarrage": "le guide de démarrage",
};
const ORDRE = ["fiche-commissions", "livret", "guide-demarrage"] as const;

/** « la fiche des commissions, le livret et le guide de démarrage » */
const enListe = (noms: readonly string[]): string =>
  noms.length <= 1 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;

/** La phrase à ajouter au gabarit, ou `null` si aucune annexe n'est jointe. Pure. */
export function phrasePiecesJointes(annexesJointes: unknown): string | null {
  if (!Array.isArray(annexesJointes)) return null;
  const ids = ORDRE.filter((id) => annexesJointes.includes(id));
  if (ids.length === 0) return null;
  const noms = ids.map((id) => LIBELLES[id] as string);
  return `Vous trouverez en ${noms.length > 1 ? "pièces jointes" : "pièce jointe"} ${enListe(noms)}, pour en prendre connaissance avant de signer.`;
}
