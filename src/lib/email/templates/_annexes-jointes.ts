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

/** Nom du fichier joint → identifiant de l'annexe (même liste, test annexes-envoi-du-lien). */
export const ID_ANNEXE_PAR_NOM_FICHIER: Readonly<Record<string, string>> = {
  "Fiche-des-commissions-Axion-IA.pdf": "fiche-commissions",
  "Livret-apporteur-Axion-IA.pdf": "livret",
  "Guide-de-demarrage-apporteur-Axion-IA.pdf": "guide-demarrage",
};

/** Gabarits dont la phrase « pièces jointes » doit refléter ce qui part RÉELLEMENT. */
export const GABARITS_A_PHRASE_PIECES_JOINTES: ReadonlySet<string> = new Set([
  "apporteur-dossier-lien",
  "apporteur-issue-retenu",
]);

/**
 * Payload sans les annexes que le worker n'a pas pu joindre (omises au `GET`, remplacées,
 * trop lourdes) : la phrase ne promet que les pièces réellement parties. Pure, ne modifie pas
 * son entrée ; sans omission ou sans `annexesJointes`, rend le payload tel quel.
 */
export function payloadSansAnnexesOmises(
  payload: Record<string, unknown>,
  nomsOmis: readonly string[],
): Record<string, unknown> {
  const jointes = payload["annexesJointes"];
  if (!Array.isArray(jointes) || nomsOmis.length === 0) return payload;
  const retires = new Set(
    nomsOmis.map((n) => ID_ANNEXE_PAR_NOM_FICHIER[n]).filter((i): i is string => Boolean(i)),
  );
  if (retires.size === 0) return payload;
  const restantes = jointes.filter((i) => !(typeof i === "string" && retires.has(i)));
  const reste: Record<string, unknown> = { ...payload };
  delete reste["annexesJointes"];
  return restantes.length > 0 ? { ...reste, annexesJointes: restantes } : reste;
}
