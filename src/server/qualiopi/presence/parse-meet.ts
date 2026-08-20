/**
 * Parsing des rapports de présence Google Meet.
 *
 * Format : CSV UTF-8, colonnes :
 *   "Name", "Email", "Duration", "Time joined", "Time exited"
 *
 * La colonne "Duration" est en minutes (nombre entier ou décimal).
 * Les colonnes "Time joined" / "Time exited" peuvent être absentes.
 *
 * Aucun import Prisma / accès DB.
 */

import { ventilerParJour, agregerVentilation, type IntervalleConnexion } from "./ventilation-jour";
import type { ParsedParticipant, ParsedReleve } from "./types";
import { parseCsvRows } from "./_csv-utils";

/** Colonnes Google Meet reconnues (insensible à la casse). */
const COL_NOM = ["name", "nom", "display name"];
const COL_EMAIL = ["email", "adresse e-mail"];
const COL_DUREE = ["duration", "durée", "duree"];
const COL_JOIN = ["time joined", "joined", "heure de connexion"];
const COL_LEAVE = ["time exited", "exited", "left", "heure de déconnexion"];

/**
 * Parse un rapport de présence Google Meet.
 *
 * @param content - Contenu textuel du fichier CSV (déjà décodé en string).
 */
export function parseMeetCsv(content: string): ParsedReleve {
  // Retirer BOM éventuel
  const texte = content.replace(/^﻿/, "");

  const { headers, rows } = parseCsvRows(texte);

  if (headers.length === 0) {
    return { plateforme: "meet", idReunion: null, participants: [], nbLignes: 0, meta: {} };
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
    const dureeMinutes = dureeRaw ? parseFloat(dureeRaw) || 0 : 0;

    const joinRaw = getField(row, idxJoin);
    const leaveRaw = getField(row, idxLeave);

    const joinAt = joinRaw ? parseMeetDate(joinRaw) : null;
    const leaveAt = leaveRaw ? parseMeetDate(leaveRaw) : null;

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
    plateforme: "meet",
    idReunion: null,
    participants,
    nbLignes: rows.length,
    meta: {},
  };
}

// ─── Helpers internes ────────────────────────────────────────────────────────

function getField(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  const v = row[idx];
  if (v === undefined) return null;
  return v.trim() || null;
}

/**
 * Parse une date Google Meet en Date UTC.
 * Meet exporte généralement en ISO 8601 ou "YYYY-MM-DD HH:mm:ss".
 */
function parseMeetDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO standard
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // "YYYY-MM-DD HH:mm:ss" sans fuseau → supposé UTC
  const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (m) {
    return new Date(`${m[1]!}T${m[2]!}Z`);
  }

  return null;
}
