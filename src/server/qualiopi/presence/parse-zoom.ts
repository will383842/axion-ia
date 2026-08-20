/**
 * Parsing des rapports de participants Zoom.
 *
 * Format attendu : CSV UTF-8 (ou UTF-8 BOM), colonnes :
 *   "Name (Original Name)", "User Email", "Join Time", "Leave Time",
 *   "Duration (Minutes)"
 *
 * Particularités gérées :
 *   - BOM UTF-8 (EF BB BF)
 *   - Guillemets doubles autour des champs (RFC 4180)
 *   - Plusieurs lignes par participant → agrégées par email (sinon par nom)
 *   - Dates Zoom format "MM/DD/YYYY hh:mm:ss AM/PM" supposées Europe/Paris
 *     → converties en UTC
 *
 * Aucun import Prisma / accès DB.
 */

import { ventilerParJour, agregerVentilation } from "./ventilation-jour";
import type { ParsedParticipant, ParsedReleve } from "./types";
import { parseCsvRows } from "./_csv-utils";

/** Colonnes Zoom reconnues (insensible à la casse). */
const COL_NOM = ["name (original name)", "name", "display name"];
const COL_EMAIL = ["user email", "email"];
const COL_JOIN = ["join time"];
const COL_LEAVE = ["leave time"];
const COL_DUREE = ["duration (minutes)", "duration"];

/**
 * Parse un rapport de participants Zoom.
 *
 * @param content - Contenu textuel du fichier CSV (déjà décodé en string).
 */
export function parseZoomCsv(content: string): ParsedReleve {
  // Supprimer BOM UTF-8 éventuel
  const texte = content.replace(/^﻿/, "");

  const { headers, rows } = parseCsvRows(texte);

  // Résoudre les indices de colonnes
  const idx = resolveColumns(headers);

  // Agréger les intervalles par email (lower) ou par nomBrut
  const byKey = new Map<
    string,
    {
      nomBrut: string;
      email: string | null;
      intervals: Array<{ join: Date | null; leave: Date | null; duree: number }>;
    }
  >();

  for (const row of rows) {
    const nomBrut = getField(row, idx.nom) ?? "";
    const emailBrut = getField(row, idx.email);
    const email = emailBrut ? emailBrut.toLowerCase().trim() : null;
    const joinRaw = getField(row, idx.join);
    const leaveRaw = getField(row, idx.leave);
    const dureeRaw = getField(row, idx.duree);

    const joinAt = joinRaw ? parseZoomDate(joinRaw) : null;
    const leaveAt = leaveRaw ? parseZoomDate(leaveRaw) : null;
    const dureeMinutes = dureeRaw ? parseFloat(dureeRaw) || 0 : 0;

    const key = email ?? nomBrut.toLowerCase().trim();
    if (!key) continue;

    const existing = byKey.get(key);
    if (existing) {
      existing.intervals.push({ join: joinAt, leave: leaveAt, duree: dureeMinutes });
    } else {
      byKey.set(key, {
        nomBrut,
        email,
        intervals: [{ join: joinAt, leave: leaveAt, duree: dureeMinutes }],
      });
    }
  }

  const participants: ParsedParticipant[] = [];
  for (const entry of byKey.values()) {
    // 🔴 `DIST-01` — la ventilation par JOURNÉE d'abord, l'agrégat ensuite.
    //
    // Ce bloc calculait directement min(join), max(leave) et la somme : les
    // intervalles portaient déjà la journée, et on la jetait. Sur un export de
    // deux jours, l'import ne créait ensuite de créneaux que pour le premier.
    const { jours, totalOrphelin } = ventilerParJour(entry.intervals);
    const { joinAt, leaveAt, dureeMinutes } = agregerVentilation(jours, totalOrphelin);

    participants.push({
      nomBrut: entry.nomBrut,
      email: entry.email,
      joinAt,
      leaveAt,
      dureeMinutes,
      parJour: jours,
    });
  }

  return {
    plateforme: "zoom",
    idReunion: null,
    participants,
    nbLignes: rows.length,
    meta: {},
  };
}

// ─── Helpers internes ────────────────────────────────────────────────────────

type ColIdx = {
  nom: number;
  email: number;
  join: number;
  leave: number;
  duree: number;
};

function resolveColumns(headers: string[]): ColIdx {
  const lower = headers.map((h) => h.toLowerCase().trim());

  function findCol(candidates: string[]): number {
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  return {
    nom: findCol(COL_NOM),
    email: findCol(COL_EMAIL),
    join: findCol(COL_JOIN),
    leave: findCol(COL_LEAVE),
    duree: findCol(COL_DUREE),
  };
}

function getField(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  const v = row[idx];
  if (v === undefined) return null;
  return v.trim() || null;
}

/**
 * Parse une date Zoom "MM/DD/YYYY hh:mm:ss AM/PM" en Europe/Paris → UTC.
 *
 * Zoom exporte toujours dans le fuseau du compte hôte. On suppose Europe/Paris.
 * On utilise Intl pour la conversion inverse (Paris → UTC).
 */
function parseZoomDate(raw: string): Date | null {
  // Format attendu : "06/10/2026 09:00:00 AM" ou "06/10/2026 01:30:00 PM"
  const m = raw
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i);
  if (!m) return null;

  const [, mo, da, yr, hRaw, mn, sc, ampm] = m;
  let heure = parseInt(hRaw!, 10);

  if (ampm!.toUpperCase() === "PM" && heure !== 12) heure += 12;
  if (ampm!.toUpperCase() === "AM" && heure === 12) heure = 0;

  // Construire la date locale Paris
  const iso = `${yr!}-${mo!.padStart(2, "0")}-${da!.padStart(2, "0")}T${String(heure).padStart(2, "0")}:${mn!}:${sc!}`;

  // Convertir Europe/Paris → UTC via l'astuce de formatage inverse
  return parisLocalToUtc(iso);
}

/**
 * Convertit "YYYY-MM-DDTHH:mm:ss" supposé Paris en Date UTC.
 *
 * Méthode : créer la date en UTC, comparer avec ce que Paris affiche à cet
 * instant, et corriger l'offset.
 */
function parisLocalToUtc(localIso: string): Date | null {
  try {
    // Première approximation : traiter l'heure locale comme UTC
    const approx = new Date(localIso + "Z");
    if (isNaN(approx.getTime())) return null;

    // Intl ne donne pas l'offset directement : on l'estime via getParisOffsetMs.
    const offsetMs = getParisOffsetMs(approx);
    return new Date(approx.getTime() - offsetMs);
  } catch {
    return null;
  }
}

/** Retourne l'offset Paris-UTC en ms pour un instant donné. */
function getParisOffsetMs(d: Date): number {
  // Formater l'heure UTC et Paris, calculer la différence
  const utcStr = d.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:mm:ss"
  const parisStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T");

  const utcMs = new Date(utcStr + "Z").getTime();
  const parisMs = new Date(parisStr + "Z").getTime();
  return parisMs - utcMs;
}
