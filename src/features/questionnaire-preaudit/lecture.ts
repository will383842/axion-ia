/**
 * Lecture COMPLÈTE d'une réponse pour la console (audit des données du 24/10/2026, point 10) —
 * module PUR.
 *
 * La console n'affichait que `donnees`, champs répétables en JSON collé. Elle montre désormais
 * tout ce qui est gardé : l'en-tête (parcours, service, rempli par le dirigeant, consentements
 * avec leur date, lien personnel, référence), les champs simples, chaque champ répétable
 * (`equipe`, `taches`, `segments`, `stack`, `serveurs`…) en TABLEAU avec des libellés, le bloc
 * `calc`, le bloc `prefill` ENTIER (confirmés, modifiés, non vérifiés, vidés) et, replié, le JSON
 * brut. Aucune liste blanche : un champ inconnu passe tel quel.
 */

import { LIBELLE_PREFILL, type EtatPrefill } from "./donnees";

export interface Paire {
  readonly libelle: string;
  readonly valeur: string;
}

export interface Tableau {
  readonly cle: string;
  readonly libelle: string;
  readonly colonnes: ReadonlyArray<string>;
  readonly lignes: ReadonlyArray<ReadonlyArray<string>>;
}

export interface BlocPrefill {
  readonly etat: EtatPrefill;
  readonly libelle: string;
  readonly cles: ReadonlyArray<string>;
}

export interface LectureReponse {
  readonly entete: ReadonlyArray<Paire>;
  /** Champs simples de `donnees` (clé telle quelle, valeur en texte). */
  readonly champs: ReadonlyArray<Paire & { readonly cle: string; readonly prefill?: EtatPrefill }>;
  /** Champs répétables de `donnees`, en tableaux. */
  readonly tableaux: ReadonlyArray<Tableau>;
  /** Bloc `calc` (calculs de la page), ou `null`. */
  readonly calc: {
    readonly paires: ReadonlyArray<Paire>;
    readonly tableaux: ReadonlyArray<Tableau>;
  } | null;
  /** Le bloc `prefill` entier : les quatre listes, même vides. */
  readonly prefill: ReadonlyArray<BlocPrefill>;
  /** Le JSON reçu, indenté (vue « données brutes »). */
  readonly brut: string;
}

/** Libellés des sous-champs les plus fréquents ; les autres sont rendus lisibles (`_` → espace). */
const LIBELLES: Readonly<Record<string, string>> = {
  prenom: "Prénom",
  nom: "Nom",
  role: "Fonction",
  service: "Service",
  contrat: "Contrat",
  mission: "Mission",
  email: "E-mail",
  tel: "Téléphone",
  tel_pro: "Téléphone pro",
  outils_p: "Outils",
  pese_p: "Ce qui pèse",
  tele: "Télétravail",
  tache: "Tâche",
  titre: "Titre",
  frequence: "Fréquence",
  duree: "Durée",
  temps: "Temps",
  raison: "Raison",
  raisons: "Raisons",
  nb_taches: "Nombre de tâches",
  h_semaine: "Heures par semaine",
  h_jour: "Heures par jour",
  outil: "Outil",
  usage: "Usage",
  segment: "Segment",
  part: "Part",
  type: "Type",
  lieu: "Lieu",
  systeme: "Système",
  version: "Version",
  remarque: "Remarque",
  note: "Note",
  equipe: "Équipe",
  taches: "Tâches",
  segments: "Segments",
  stack: "Logiciels",
  serveurs: "Serveurs",
};

/** Colonnes techniques jamais montrées dans un tableau (ids internes). */
const MASQUEES: ReadonlySet<string> = new Set(["id", "_id", "uid"]);

export function libelle(cle: string): string {
  const connu = LIBELLES[cle];
  if (connu !== undefined) return connu;
  const t = cle.replace(/_/g, " ").trim();
  return t === "" ? cle : t.charAt(0).toUpperCase() + t.slice(1);
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function enTexte(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean")
    return v === true ? "oui" : v === false ? "non" : String(v);
  if (Array.isArray(v)) {
    return v
      .map(enTexte)
      .filter((s) => s !== "")
      .join(", ");
  }
  const o = objet(v);
  if (o !== null) {
    return Object.entries(o)
      .filter(([k]) => !MASQUEES.has(k))
      .map(([k, x]) => `${libelle(k)} : ${enTexte(x)}`)
      .filter((s) => !s.endsWith(" : "))
      .join(" ; ");
  }
  return String(v);
}

/** Un tableau d'objets (au moins un objet) → tableau lisible ; sinon `null`. */
export function enTableau(cle: string, v: unknown): Tableau | null {
  if (!Array.isArray(v) || v.length === 0 || !v.every((x) => objet(x) !== null)) return null;
  const colonnes: string[] = [];
  for (const x of v as Record<string, unknown>[]) {
    for (const k of Object.keys(x)) if (!MASQUEES.has(k) && !colonnes.includes(k)) colonnes.push(k);
  }
  return {
    cle,
    libelle: libelle(cle),
    colonnes: colonnes.map(libelle),
    lignes: (v as Record<string, unknown>[]).map((x) => colonnes.map((k) => enTexte(x[k]))),
  };
}

function separer(o: Record<string, unknown>): {
  paires: Paire[];
  tableaux: Tableau[];
  cles: string[];
} {
  const paires: Paire[] = [];
  const tableaux: Tableau[] = [];
  const cles: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    const t = enTableau(k, v);
    if (t !== null) tableaux.push(t);
    else {
      const valeur = enTexte(v);
      if (valeur !== "") {
        paires.push({ libelle: k, valeur });
        cles.push(k);
      }
    }
  }
  return { paires, tableaux, cles };
}

const LISTES_PREFILL: ReadonlyArray<readonly [string, EtatPrefill]> = [
  ["confirmes", "confirme"],
  ["modifies", "modifie"],
  ["non_verifies", "non_verifie"],
  ["vides", "vide"],
];

const PARCOURS: Readonly<Record<string, string>> = {
  main: "Dirigeant",
  emp: "Collaborateur",
  it: "Référent informatique",
};

function dateFr(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

/** Ce que la console montre à la place du code du dirigeant (il ouvre son brouillon). */
export const CODE_DIRIGEANT_MASQUE = "(code du dirigeant, masqué)";

/**
 * La réponse entière, rangée pour la console. `json` est le texte reçu (déjà déchiffré).
 * `estCodeDirigeant` : vrai pour le code du dirigeant, MASQUÉ partout (en-tête et vue brute).
 */
export function lireLaCharge(
  json: string,
  estCodeDirigeant: (membre: string) => boolean = () => false,
): LectureReponse {
  let racine: Record<string, unknown> = {};
  let brut = json;
  try {
    racine = objet(JSON.parse(json)) ?? {};
    const m = racine["membre"];
    if (typeof m === "string" && estCodeDirigeant(m)) {
      racine = { ...racine, membre: CODE_DIRIGEANT_MASQUE };
    }
    brut = JSON.stringify(racine, null, 2);
  } catch {
    // texte gardé tel quel dans la vue brute
  }
  const consent = objet(racine["consentements"]);
  const envoye = dateFr(racine["envoyeLe"]);
  const entete: Paire[] = [
    { libelle: "Parcours", valeur: PARCOURS[String(racine["mode"])] ?? enTexte(racine["mode"]) },
    { libelle: "Service", valeur: enTexte(racine["service"] ?? racine["service_categorie"]) },
    { libelle: "Rempli par le dirigeant", valeur: enTexte(racine["rempliParLeDirigeant"]) },
    {
      libelle: "Consentement au traitement",
      valeur:
        consent === null
          ? ""
          : `${enTexte(consent["traitement"])}${envoye !== "" ? ` (le ${envoye})` : ""}` +
            (consent["version"] !== undefined ? ` — version ${enTexte(consent["version"])}` : ""),
    },
    {
      libelle: "Collaborateurs informés",
      valeur: consent === null ? "" : enTexte(consent["collaborateursInformes"]),
    },
    { libelle: "Lien personnel (code)", valeur: enTexte(racine["membre"]) },
    { libelle: "Référence", valeur: enTexte(racine["ref"]) },
    { libelle: "Entreprise", valeur: enTexte(racine["client"]) },
    { libelle: "Envoyé le (heure du navigateur)", valeur: envoye },
    { libelle: "Schéma", valeur: enTexte(racine["schema"]) },
  ].filter((p) => p.valeur !== "");

  const p = objet(racine["prefill"]);
  const prefill: BlocPrefill[] = LISTES_PREFILL.map(([liste, etat]) => {
    const ids = p?.[liste];
    return {
      etat,
      libelle: LIBELLE_PREFILL[etat],
      cles: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [],
    };
  });
  const etatDe = new Map<string, EtatPrefill>();
  for (const b of prefill) for (const c of b.cles) if (!etatDe.has(c)) etatDe.set(c, b.etat);

  const d = separer(objet(racine["donnees"]) ?? {});
  const champs = d.paires.map((x, i) => {
    const cle = d.cles[i] as string;
    const etat = etatDe.get(cle);
    return etat === undefined ? { ...x, cle } : { ...x, cle, prefill: etat };
  });
  const c = objet(racine["calc"]);
  const calc = c === null ? null : separer(c);

  return {
    entete,
    champs,
    tableaux: d.tableaux,
    calc:
      calc === null
        ? null
        : {
            paires: calc.paires.map((x) => ({ ...x, libelle: libelle(x.libelle) })),
            tableaux: calc.tableaux,
          },
    prefill,
    brut,
  };
}
