/**
 * Qualiopi — Rapprochement OPCO en LECTURE SEULE (module PUR, lot OPCO A1).
 *
 * `Client.opcoIdentifie` est un texte libre (inféré ou saisi) ; `Client.opco`
 * est l'OPCO typé, choisi par un administrateur. Ce module propose l'OPCO typé
 * que le texte libre désigne — il n'écrit RIEN : la suggestion s'affiche, et
 * seul un choix explicite en console la rend réelle.
 *
 * 🔴 Une suggestion n'est faite qu'en cas de correspondance UNIQUE. « Akto /
 * Atlas » ou « OPCO » seul ne désignent pas un opérateur : mieux vaut ne rien
 * proposer que pousser l'administrateur vers le mauvais financeur.
 *
 * Aucun import Prisma/next : importable par l'écran client et les tests.
 */

import { OPCO_IDS, OPCO_LABELS, isOpcoId, type OpcoId } from "./opco-referentiel";

/** Minuscules, sans accents, sans rien d'autre que lettres et chiffres. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** La forme normalisée, et la même privée du préfixe « opco » s'il y en a un. */
function cles(texte: string): string[] {
  const n = normaliser(texte);
  const sansPrefixe = n.startsWith("opco") ? n.slice(4) : n;
  return [n, sansPrefixe].filter((c) => c !== "");
}

const CLES_PAR_OPCO: ReadonlyArray<readonly [OpcoId, ReadonlySet<string>]> = OPCO_IDS.map(
  (id) => [id, new Set([...cles(id), ...cles(OPCO_LABELS[id])])] as const,
);

/**
 * L'OPCO typé que le texte libre désigne sans ambiguïté, ou `null`.
 * Ne suggère jamais rien quand l'OPCO typé est déjà renseigné.
 */
export function suggererOpco(client: {
  opco: string | null | undefined;
  opcoIdentifie: string | null | undefined;
}): OpcoId | null {
  if (client.opco != null && client.opco !== "") return null;
  const texte = client.opcoIdentifie?.trim();
  if (!texte) return null;
  if (isOpcoId(texte)) return texte;

  const entree = cles(texte);
  const trouves = CLES_PAR_OPCO.filter(([, connues]) => entree.some((c) => connues.has(c)));
  return trouves.length === 1 ? trouves[0]![0] : null;
}
