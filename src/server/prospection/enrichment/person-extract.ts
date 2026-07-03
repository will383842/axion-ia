/**
 * Prospection — Extraction des responsables depuis une page équipe (T5, pur).
 *
 * Heuristique FR robuste-aux-fixtures : on segmente le texte, on repère les
 * segments contenant un mot-clé de FONCTION, et on en extrait le NOM (2-3 mots
 * capitalisés hors mots-de-fonction). Prouve la passe B (matrice T5 #7). Le
 * mapping fonction/séniorité se fait ensuite via SSOT `qualite-to-fonction`.
 */

import { htmlToText } from "./html-utils";

const ROLE_WORDS =
  /\b(directeur|directrice|gerant|gerante|president|presidente|responsable|manager|manageuse|associe|associee|cofondateur|cofondatrice|fondateur|fondatrice|dirigeant|dirigeante|cadre|consultant|consultante|commercial|commerciale|technique|administratif|administrative|financier|financiere|marketing|achats|recrutement|dg|pdg|daf|drh|dsi|cto|ceo|cfo|chef|cheffe)\b/i;

// Mots outils à ignorer quand on isole le nom.
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
]);

const NAME_TOKEN = /^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+$/;

export interface ExtractedPerson {
  name: string;
  titre: string;
}

function hasRoleWord(seg: string): boolean {
  return ROLE_WORDS.test(seg);
}

// Isole un nom (2-3 tokens capitalisés consécutifs, hors mots-de-fonction/outils).
function findName(seg: string): string | null {
  const roleStripped = seg.replace(new RegExp(ROLE_WORDS.source, "gi"), " ");
  const tokens = roleStripped.split(/[\s,;:·•|]+/).filter(Boolean);
  let run: string[] = [];
  let best: string[] = [];
  for (const t of tokens) {
    const low = t
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    if (NAME_TOKEN.test(t) && !STOPWORDS.has(low)) {
      run.push(t);
      if (run.length > best.length) best = [...run];
    } else {
      run = [];
    }
  }
  if (best.length >= 2 && best.length <= 3) return best.join(" ");
  return null;
}

/** Extrait les personnes (nom + titre) d'une page équipe. Dédup par nom. */
export function extractPersons(html: string): ExtractedPerson[] {
  const text = htmlToText(html);
  // Segmentation par ligne uniquement (un bloc = une personne) : NE PAS couper
  // sur les tirets « Nom — Titre » sinon on sépare le nom de sa fonction.
  const segments = text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: ExtractedPerson[] = [];
  for (const seg of segments) {
    if (!hasRoleWord(seg)) continue;
    const name = findName(seg);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, titre: seg });
  }
  return out;
}
