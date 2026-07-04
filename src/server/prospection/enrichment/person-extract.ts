/**
 * Prospection — Extraction des responsables depuis une page équipe (T5, pur).
 *
 * Heuristique FR robuste (réconciliation adversariale T5) :
 *  - **layout carte** `<h3>Nom</h3><p>Fonction</p>` : nom et fonction tombent sur
 *    des lignes voisines → appariement par fenêtre glissante (une ligne rôle sans
 *    nom emprunte le nom de la ligne adjacente).
 *  - **`Rôle : Nom`** : découpage sur `:` et test de chaque moitié.
 *  - **rejet des raisons sociales** (Cabinet/SARL/SAS/Associés…) → pas de faux
 *    positif « personne » sur un nom d'entreprise (RGPD : pas de ligne perso bidon).
 * Le mapping fonction/séniorité se fait ensuite via SSOT `qualite-to-fonction`.
 */

import { htmlToText } from "./html-utils";

const ROLE_WORDS =
  /\b(directeur|directrice|gerant|gerante|president|presidente|responsable|manager|manageuse|associe|associee|cofondateur|cofondatrice|fondateur|fondatrice|dirigeant|dirigeante|cadre|consultant|consultante|commercial|commerciale|technique|administratif|administrative|financier|financiere|marketing|achats|recrutement|dg|pdg|daf|drh|dsi|cto|ceo|cfo|chef|cheffe|juriste)\b/i;

// Marqueurs de raison sociale → la ligne est une ENTREPRISE, pas une personne.
const COMPANY_MARKERS =
  /\b(cabinet|sarl|sasu|sas|eurl|sci|scop|snc|selarl|selas|holding|groupe|agence|societe|entreprise|company|corp|ltd|gmbh)\b|associ|& |et associes/i;

const STOPWORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "au",
  "aux",
  "notre",
  "nos",
  "general",
  "generale",
  "adjoint",
  "adjointe",
  "grand",
  "est",
  "ouest",
  "nord",
  "sud",
  "region",
  "regional",
  "regionale",
  "monsieur",
  "madame",
  "docteur",
  "maitre",
]);

const NAME_TOKEN = /^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+$/;

export interface ExtractedPerson {
  name: string;
  titre: string;
}

function hasRoleWord(seg: string): boolean {
  return ROLE_WORDS.test(seg);
}

function isCompanyLine(seg: string): boolean {
  return COMPANY_MARKERS.test(seg);
}

function low(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Cherche la meilleure séquence de 2-3 tokens capitalisés (hors rôle/outils).
function findNameInText(text: string): string | null {
  const roleStripped = text.replace(new RegExp(ROLE_WORDS.source, "gi"), " ");
  const tokens = roleStripped.split(/[\s,;:·•|]+/).filter(Boolean);
  let run: string[] = [];
  let best: string[] = [];
  for (const t of tokens) {
    if (NAME_TOKEN.test(t) && !STOPWORDS.has(low(t))) {
      run.push(t);
      if (run.length > best.length && run.length <= 3) best = [...run];
    } else {
      run = [];
    }
  }
  return best.length >= 2 ? best.join(" ") : null;
}

// Extrait un nom d'un segment : gère `Rôle : Nom` (teste chaque moitié).
function findName(seg: string): string | null {
  if (isCompanyLine(seg)) return null;
  const parts = seg.split(":");
  // Priorité à la moitié qui ressemble le plus à un nom (souvent après le `:`).
  for (const part of [...parts].reverse()) {
    const n = findNameInText(part);
    if (n) return n;
  }
  return findNameInText(seg);
}

/** Extrait les personnes (nom + titre) d'une page équipe. Dédup par nom. */
export function extractPersons(html: string): ExtractedPerson[] {
  const text = htmlToText(html);
  const segments = text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: ExtractedPerson[] = [];
  const emit = (name: string, titre: string): void => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, titre });
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as string;
    if (isCompanyLine(seg)) continue;
    const role = hasRoleWord(seg);
    const name = findName(seg);

    if (role && name) {
      emit(name, seg);
    } else if (role && !name) {
      // Layout carte : fonction sur cette ligne, nom sur la ligne adjacente.
      const neighbours = [segments[i - 1], segments[i + 1]].filter(Boolean) as string[];
      for (const nb of neighbours) {
        if (isCompanyLine(nb) || hasRoleWord(nb)) continue;
        const nbName = findName(nb);
        if (nbName) {
          emit(nbName, seg);
          break;
        }
      }
    }
  }
  return out;
}
