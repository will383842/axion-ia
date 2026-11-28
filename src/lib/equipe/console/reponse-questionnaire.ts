/**
 * Lecture TOLÉRANTE de la réponse d'une personne au questionnaire (colonne JSON `answers`), pour
 * l'écran « À valider ». Rien n'est cru : tout ce qui n'a pas la forme attendue est ignoré.
 */
export interface ReponseLue {
  readonly prenom: string | null;
  readonly intitule: string | null;
  readonly presentation: string | null;
  readonly langues: readonly string[];
  readonly lieu: string | null;
  readonly apport: string | null;
  /** Réponses propres à la catégorie : question → texte. */
  readonly categorie: ReadonlyArray<readonly [string, string]>;
  readonly consentements: { readonly photo: boolean; readonly linkedin: boolean };
  readonly attestation: { readonly version: string; readonly at: string } | null;
}

const objet = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const texte = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

function aPlat(v: unknown): string | null {
  const t = texte(v);
  if (t !== null) return t;
  if (Array.isArray(v)) {
    const l = v.map(aPlat).filter((x): x is string => x !== null);
    return l.length > 0 ? l.join(", ") : null;
  }
  const o = objet(v);
  if (o) {
    const l = Object.values(o)
      .map(aPlat)
      .filter((x): x is string => x !== null);
    return l.length > 0 ? l.join(" · ") : null;
  }
  return null;
}

export function lireReponseQuestionnaire(answers: unknown): ReponseLue {
  const racine = objet(answers) ?? {};
  const commun = objet(racine["commun"]) ?? {};
  const consents = objet(racine["consentements"]) ?? {};
  const att = objet(racine["attestation"]);
  const langues = Array.isArray(commun["langues"])
    ? commun["langues"].map(texte).filter((x): x is string => x !== null)
    : [];
  const categorie = Object.entries(objet(racine["categorie"]) ?? {})
    .map(([k, v]) => [k, aPlat(v)] as const)
    .filter((e): e is readonly [string, string] => e[1] !== null);
  const version = att ? texte(att["version"]) : null;
  const at = att ? texte(att["at"]) : null;
  return {
    prenom: texte(commun["prenom"]),
    intitule: texte(commun["intitule"]),
    presentation: texte(commun["presentation"]),
    langues,
    lieu: aPlat(commun["lieu"]),
    apport: aPlat(commun["apport"]),
    categorie,
    consentements: { photo: consents["photo"] === true, linkedin: consents["linkedin"] === true },
    attestation: version !== null && at !== null ? { version, at } : null,
  };
}
