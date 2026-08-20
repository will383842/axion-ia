/**
 * Parsing des rapports de présence Microsoft Teams.
 *
 * Format : TSV (séparateur TAB), souvent UTF-16 LE avec BOM.
 * Le caller fournit une string JS (déjà décodée) — on gère :
 *   - BOM `﻿` (U+FEFF)
 *   - Caractères NUL résiduels du décodage UTF-16
 *   - Sections "1. Summary", "2. Participants", "3. In-Meeting Activities"
 *
 * Colonnes participants : "Name", "Email" (ou "UPN"), "Duration",
 *   "First Join", "Last Leave".
 * Durée Teams : "1h 5m 3s" | "5m 3s" | "45s" | "65" (secondes pures).
 *
 * Aucun import Prisma / accès DB.
 */

import { ventilerParJour, agregerVentilation, type IntervalleConnexion } from "./ventilation-jour";
import type { ParsedParticipant, ParsedReleve } from "./types";
import { parseCsvRows } from "./_csv-utils";

/**
 * Parse un rapport de présence Teams.
 *
 * @param content - Contenu textuel du fichier (BOM UTF-16 déjà converti en string JS).
 */
export function parseTeamsCsv(content: string): ParsedReleve {
  // Retirer BOM et NUL
  const texte = content.replace(/^﻿/, "").replace(/\0/g, "");

  // Extraire la section participants (entre "2." et "3.")
  const sectionParticipants = extractSection(texte, "2.");

  if (!sectionParticipants) {
    // Pas de section structurée → tenter parsing direct comme TSV simple
    return parseTsvParticipants(texte);
  }

  return parseTsvParticipants(sectionParticipants);
}

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * Extrait la section débutant par `sectionMarker` (ex. "2.") jusqu'à la
 * section suivante (ex. "3.") ou la fin du fichier.
 */
function extractSection(text: string, sectionMarker: string): string | null {
  const lines = text.split(/\r?\n/);
  let inSection = false;
  const result: string[] = [];

  for (const line of lines) {
    const stripped = line.trim();

    // Détecter début de section cible
    if (
      !inSection &&
      (stripped.startsWith(sectionMarker) || stripped.toLowerCase().includes("participants"))
    ) {
      inSection = true;
      continue; // Ignorer le titre de section
    }

    // Détecter début de section suivante (nombre suivi de ".")
    if (inSection && /^\d+\./.test(stripped) && !stripped.startsWith(sectionMarker)) {
      break;
    }

    if (inSection) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join("\n") : null;
}

/** Colonnes attendues dans la section participants. */
const COL_NOM = ["name", "nom"];
const COL_EMAIL = ["email", "upn", "adresse e-mail"];
const COL_DUREE = ["duration", "durée", "duree"];
const COL_JOIN = ["first join", "première connexion", "premiere connexion", "join time"];
const COL_LEAVE = ["last leave", "dernière déconnexion", "derniere deconnexion", "leave time"];

function parseTsvParticipants(text: string): ParsedReleve {
  const { headers, rows } = parseCsvRows(text, "\t");

  if (headers.length === 0) {
    return { plateforme: "teams", idReunion: null, participants: [], nbLignes: 0, meta: {} };
  }

  const lower = headers.map((h) => h.toLowerCase().trim());

  function findCol(candidates: string[]): number {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const idxNom = findCol(COL_NOM);
  const idxEmail = findCol(COL_EMAIL);
  const idxDuree = findCol(COL_DUREE);
  const idxJoin = findCol(COL_JOIN);
  const idxLeave = findCol(COL_LEAVE);

  // 🔴 `DIST-01` (2026-08-20) — REGROUPEMENT PAR PARTICIPANT, puis ventilation
  // par journée.
  //
  // Ce parseur poussait **une ligne = un participant**. Un export couvrant deux
  // journées produisait donc deux entrées homonymes, et `matchParticipants` n'en
  // retenait qu'UNE par inscription : la seconde journée disparaissait purement
  // et simplement. Zoom, lui, regroupait déjà — les trois parseurs partageaient
  // le défaut sans partager le code.
  const parCle = new Map<
    string,
    { nomBrut: string; email: string | null; intervals: IntervalleConnexion[] }
  >();

  for (const row of rows) {
    const nomBrut = getField(row, idxNom) ?? "";
    if (!nomBrut) continue;

    const emailRaw = getField(row, idxEmail);
    const email = emailRaw ? emailRaw.toLowerCase().trim() : null;

    const dureeRaw = getField(row, idxDuree);
    const dureeMinutes = dureeRaw ? parseTeamsDuration(dureeRaw) : 0;

    const joinRaw = getField(row, idxJoin);
    const leaveRaw = getField(row, idxLeave);

    const joinAt = joinRaw ? parseTeamsDate(joinRaw) : null;
    const leaveAt = leaveRaw ? parseTeamsDate(leaveRaw) : null;

    const cle = email ?? nomBrut.toLowerCase().trim();
    if (!cle) continue;
    const courant = parCle.get(cle) ?? { nomBrut, email, intervals: [] };
    courant.intervals.push({ join: joinAt, leave: leaveAt, duree: dureeMinutes });
    parCle.set(cle, courant);
  }

  const participants: ParsedParticipant[] = [];
  for (const entry of parCle.values()) {
    const { jours, totalOrphelin } = ventilerParJour(entry.intervals);
    const agg = agregerVentilation(jours, totalOrphelin);
    participants.push({
      nomBrut: entry.nomBrut,
      email: entry.email,
      joinAt: agg.joinAt,
      leaveAt: agg.leaveAt,
      dureeMinutes: agg.dureeMinutes,
      parJour: jours,
    });
  }

  return {
    plateforme: "teams",
    idReunion: null,
    participants,
    nbLignes: rows.length,
    meta: {},
  };
}

/**
 * Parse une durée Teams en minutes.
 * Formats acceptés : "1h 5m 3s", "5m 3s", "45s", "65" (secondes pures),
 *   "01:05:03" (HH:mm:ss).
 */
export function parseTeamsDuration(raw: string): number {
  const s = raw.trim();

  // Format HH:mm:ss
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) {
    return parseInt(hms[1]!, 10) * 60 + parseInt(hms[2]!, 10) + parseInt(hms[3]!, 10) / 60;
  }

  // Format textuel "1h 5m 3s"
  const heuRes = s.match(/(\d+)\s*h/i);
  const minRes = s.match(/(\d+)\s*m(?!s)/i);
  const secRes = s.match(/(\d+)\s*s/i);

  if (heuRes ?? minRes ?? secRes) {
    const h = heuRes ? parseInt(heuRes[1]!, 10) : 0;
    const m = minRes ? parseInt(minRes[1]!, 10) : 0;
    const sc = secRes ? parseInt(secRes[1]!, 10) : 0;
    return h * 60 + m + sc / 60;
  }

  // Nombre pur → secondes
  const n = parseFloat(s);
  if (!isNaN(n)) return n / 60;

  return 0;
}

/**
 * Parse une date Teams (ISO 8601 ou format local) en Date UTC.
 * Teams exporte en général en ISO : "2026-06-10T09:00:00Z" ou "2026-06-10 09:00:00".
 */
function parseTeamsDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO avec Z ou +offset
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // Format "YYYY-MM-DD HH:mm:ss" sans fuseau → supposé Paris
  const local = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (local) {
    return new Date(`${local[1]!}T${local[2]!}Z`);
  }

  return null;
}

function getField(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  const v = row[idx];
  if (v === undefined) return null;
  return v.trim() || null;
}
