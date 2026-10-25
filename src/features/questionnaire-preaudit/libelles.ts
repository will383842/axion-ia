/**
 * Les questions du questionnaire en FRANÇAIS, pour la console (vérification F, défaut E, 25/10/2026)
 * — module PUR.
 *
 * Le HTML déposé par Will déclare chaque champ par `F("type", "id", "Libellé", …)`, parfois
 * `F("type", "id", IT ? "Libellé référent" : "Libellé", …)`. On relit ces appels dans la copie
 * déposée (celle que le prospect a remplie) : aucun dictionnaire à tenir à jour à côté. Un id
 * introuvable reçoit un repli lisible (sa rubrique), jamais l'id brut seul.
 */

export interface Libelles {
  /** Libellé du dirigeant et du collaborateur. */
  readonly normal: ReadonlyMap<string, string>;
  /** Libellé propre au référent informatique, quand le HTML en donne un. */
  readonly it: ReadonlyMap<string, string>;
}

export const AUCUN_LIBELLE: Libelles = { normal: new Map(), it: new Map() };

const LITTERAL = String.raw`"((?:[^"\\]|\\.)*)"`;
const APPEL = new RegExp(
  String.raw`\bF\(\s*"[a-z_]+"\s*,\s*"([A-Za-z0-9_]+)"\s*,\s*(?:IT\s*\?\s*` +
    LITTERAL +
    String.raw`\s*:\s*)?` +
    LITTERAL,
  "g",
);

function texteDuLitteral(s: string): string {
  try {
    return (JSON.parse(`"${s}"`) as string).trim();
  } catch {
    return s.trim();
  }
}

/** Les libellés déclarés dans le HTML ; le premier appel d'un id l'emporte. */
export function libellesDuHtml(html: string): Libelles {
  const normal = new Map<string, string>();
  const it = new Map<string, string>();
  for (const m of html.matchAll(APPEL)) {
    const id = m[1] as string;
    const pourIt = m[2];
    const libelle = texteDuLitteral(m[3] ?? "");
    if (libelle !== "" && !normal.has(id)) normal.set(id, libelle);
    if (pourIt !== undefined) {
      const l = texteDuLitteral(pourIt);
      if (l !== "" && !it.has(id)) it.set(id, l);
    }
  }
  return { normal, it };
}

const RUBRIQUES: ReadonlyArray<readonly [string, string]> = [
  ["ent_", "Entreprise"],
  ["org_", "Organisation"],
  ["tools_", "Outils"],
  ["cpt_", "Comptabilité"],
  ["rh_", "Ressources humaines"],
  ["com_", "Commercial"],
  ["dat_", "Informatique et données"],
  ["stack_", "Informatique"],
  ["vis_", "Vision"],
  ["form_", "Formation"],
  ["id_", "Identité"],
  ["contact_", "Contact"],
];

/** Le libellé d'un champ pour Will : la question, sinon sa rubrique et le nom du champ. PUR. */
export function libelleDe(cle: string, libelles: Libelles, mode?: string): string {
  const l = (mode === "it" ? libelles.it.get(cle) : undefined) ?? libelles.normal.get(cle);
  if (l !== undefined) return l;
  const rubrique = RUBRIQUES.find(([p]) => cle.startsWith(p));
  const nom = (rubrique ? cle.slice(rubrique[0].length) : cle).replace(/_/g, " ").trim();
  return rubrique ? `${rubrique[1]} : ${nom || cle}` : `Champ « ${nom || cle} »`;
}
