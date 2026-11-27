/**
 * S10-1 · Lecture des exports CSV du rapport « Liens » de la Search Console. Module PUR.
 *
 * Le fichier est déposé à la main par Will : aucun appel réseau. Le type d'export est reconnu
 * par ses en-têtes (français et anglais) ; un fichier inconnu est refusé, jamais deviné.
 *
 * ⚠️ Les noms d'en-têtes ci-dessous viennent de la documentation et de la mémoire de l'interface :
 * ils sont À ALIGNER sur un export réel (fixture à fournir par Will, S10 § 1.1). La reconnaissance
 * est tolérante (casse, accents, apostrophes), et le refus est explicite si rien ne correspond.
 */
import { parseCsvRows } from "../../qualiopi/presence/_csv-utils";
import {
  normaliserAncre,
  normaliserCible,
  normaliserDomaine,
  normaliserPageSource,
  CELLULE_MAX,
} from "./normaliser";

export type TypeExport =
  "gsc_liens_externes_recents" | "gsc_sites_principaux" | "gsc_ancres" | "gsc_pages_cibles";

export const ERREURS_MAX = 20;
const EXTRAIT_MAX = 200;

/** Colonnes clés (la première trouvée décide du type) puis colonne de valeur, normalisées. */
const SIGNATURES: ReadonlyArray<{
  readonly type: TypeExport;
  readonly cles: readonly string[];
  readonly valeurs: readonly string[];
}> = [
  {
    type: "gsc_sites_principaux",
    cles: ["site", "sites", "principaux sites"],
    valeurs: ["linking pages", "pages de liens", "pages liantes", "pages de provenance"],
  },
  {
    type: "gsc_ancres",
    cles: ["linking text", "texte du lien", "texte d ancrage", "texte de lien", "ancre"],
    valeurs: ["count", "nombre", "liens", "links"],
  },
  {
    type: "gsc_pages_cibles",
    cles: ["target page", "page cible", "top linked pages", "pages les plus liees"],
    valeurs: ["incoming links", "liens entrants", "external links", "liens externes", "links"],
  },
  {
    type: "gsc_liens_externes_recents",
    cles: ["linking page", "page de liens", "page source", "page liante", "latest links"],
    valeurs: ["last crawled", "derniere exploration", "last crawl", "derniere analyse"],
  },
];

function normaliserEntete(h: string): string {
  return h
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function reconnaitreExport(entetes: readonly string[]): TypeExport | null {
  const n = entetes.map(normaliserEntete);
  // Clé ET colonne de valeur exigées : une seule colonne « Site » ne fait pas un export Google.
  for (const s of SIGNATURES) {
    if (n.some((h) => s.cles.includes(h)) && n.some((h) => s.valeurs.includes(h))) return s.type;
  }
  return null;
}

export type LigneExport =
  | {
      readonly type: "gsc_sites_principaux";
      readonly domaine: string;
      readonly nbPagesLiantes: number | null;
    }
  | { readonly type: "gsc_ancres"; readonly ancre: string; readonly nombre: number | null }
  | {
      readonly type: "gsc_pages_cibles";
      readonly cheminCible: string;
      readonly nombre: number | null;
    }
  | {
      readonly type: "gsc_liens_externes_recents";
      readonly pageSource: string;
      readonly domaineSource: string;
      readonly derniereExploration: string | null;
    };

export interface ErreurLigne {
  readonly ligne: number;
  readonly raison: string;
  readonly extrait: string;
}

export type ResultatLecture =
  | {
      readonly ok: true;
      readonly type: TypeExport;
      readonly lignes: LigneExport[];
      readonly ignorees: number;
      /** 20 premières seulement, extraits de 200 caractères au plus. */
      readonly erreurs: ErreurLigne[];
    }
  | { readonly ok: false; readonly raison: "vide" | "type_inconnu" };

function detecterSeparateur(texte: string): string {
  const premiere = texte.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const n = (c: string) => premiere.split(c).length - 1;
  const [pv, tab, vir] = [n(";"), n("\t"), n(",")];
  if (pv > vir && pv >= tab) return ";";
  if (tab > vir) return "\t";
  return ",";
}

function lireNombre(brut: string | undefined): number | null {
  const s = (brut ?? "").replace(/[\s  .,]/g, "");
  return /^\d{1,12}$/.test(s) ? Number(s) : null;
}

function lireDate(brut: string | undefined): string | null {
  const s = (brut ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  const [a, m, j] = iso ? [iso[1]!, iso[2]!, iso[3]!] : fr ? [fr[3]!, fr[2]!, fr[1]!] : [];
  if (!a || !m || !j) return null;
  const d = new Date(`${a}-${m}-${j}T00:00:00Z`);
  // Date impossible (mois 25, 31 février) : rien plutôt qu'une date fausse.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${a}-${m}-${j}`
    ? null
    : `${a}-${m}-${j}`;
}

function indexColonne(
  entetes: readonly string[],
  candidats: readonly string[],
  defaut: number,
): number {
  const i = entetes.map(normaliserEntete).findIndex((h) => candidats.includes(h));
  return i >= 0 ? i : defaut;
}

export function lireExportGsc(contenu: string): ResultatLecture {
  if (contenu.replace(/^﻿/, "").trim() === "") return { ok: false, raison: "vide" };
  const { headers, rows } = parseCsvRows(contenu, detecterSeparateur(contenu));
  const type = reconnaitreExport(headers);
  if (!type) return { ok: false, raison: "type_inconnu" };
  const sig = SIGNATURES.find((s) => s.type === type)!;
  const iCle = indexColonne(headers, sig.cles, 0);
  const iVal = indexColonne(headers, sig.valeurs, 1);

  const lignes: LigneExport[] = [];
  const erreurs: ErreurLigne[] = [];
  let ignorees = 0;
  const refuser = (ligne: number, raison: string, cle: string) => {
    ignorees++;
    if (erreurs.length < ERREURS_MAX) {
      erreurs.push({ ligne, raison, extrait: cle.slice(0, EXTRAIT_MAX) });
    }
  };

  rows.forEach((brutes, k) => {
    const ligne = k + 2;
    // Un caractère de plus que le plafond : une URL trop longue est REFUSÉE, jamais tronquée en silence.
    const cellules = brutes.map((c) => c.slice(0, CELLULE_MAX + 1));
    const cle = cellules[iCle] ?? "";
    const val = cellules[iVal];
    switch (type) {
      case "gsc_sites_principaux": {
        const domaine = normaliserDomaine(cle);
        if (!domaine) return refuser(ligne, "domaine illisible ou interne", cle);
        lignes.push({ type, domaine, nbPagesLiantes: lireNombre(val) });
        return;
      }
      case "gsc_ancres": {
        const ancre = normaliserAncre(cle);
        if (!ancre) return refuser(ligne, "ancre vide", cle);
        lignes.push({ type, ancre, nombre: lireNombre(val) });
        return;
      }
      case "gsc_pages_cibles": {
        const cheminCible = normaliserCible(cle);
        if (!cheminCible) return refuser(ligne, "page cible hors d'Axion IA ou illisible", cle);
        lignes.push({ type, cheminCible, nombre: lireNombre(val) });
        return;
      }
      case "gsc_liens_externes_recents": {
        const pageSource = normaliserPageSource(cle);
        const domaineSource = pageSource ? normaliserDomaine(pageSource) : null;
        if (!pageSource || !domaineSource)
          return refuser(ligne, "page source illisible ou interne", cle);
        lignes.push({ type, pageSource, domaineSource, derniereExploration: lireDate(val) });
        return;
      }
    }
  });

  return { ok: true, type, lignes, ignorees, erreurs };
}
