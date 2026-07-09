/**
 * Tests — ics.ts (export iCalendar de l'agenda formateur).
 *
 * Points sensibles couverts :
 *   - échappement RFC 5545 §3.3.11 (backslash, `;`, `,`, retour ligne) ;
 *   - pliage à 75 OCTETS §3.1 (accents = 2 octets → 75 octets ≠ 75 caractères,
 *     et jamais de coupe au milieu d'un caractère) ;
 *   - `UID` stable et déterministe (re-synchro = mise à jour, pas de doublon) ;
 *   - journée entière (`fin === null`) → `VALUE=DATE` sur le jour Europe/Paris ;
 *   - prestations annulées/reportées EXCLUES de l'agenda ;
 *   - VCALENDAR bien formé (BEGIN/END, VERSION, PRODID).
 */

import { describe, it, expect } from "vitest";
import { buildPlanningIcs, escapeIcsText, foldIcsLine, formatUtcStamp, icsUid } from "./ics";
import type { PlanningEvent, PlanningStatut } from "./types";

/** Nombre d'octets UTF-8 d'une chaîne (référence indépendante du module testé). */
function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Reconstitue le contenu original en « dépliant » les lignes (CRLF + espace). */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

function evt(over: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    key: "formation:f1",
    type: "formation",
    id: "f1",
    titre: "Formation IA",
    debut: new Date("2026-07-09T07:00:00Z"), // 09:00 Paris
    fin: new Date("2026-07-09T15:00:00Z"),
    statut: "planifiee",
    formateurNom: "Ada Lovelace",
    clientNom: "Meridian SAS",
    lieu: null,
    ...over,
  };
}

const NOW = { now: new Date("2026-07-01T10:00:00Z") };

// ── Échappement ──────────────────────────────────────────────────────────────
describe("escapeIcsText", () => {
  it("échappe backslash, point-virgule et virgule", () => {
    expect(escapeIcsText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
  });

  it("convertit les retours ligne en `\\n` littéral", () => {
    expect(escapeIcsText("ligne1\nligne2")).toBe("ligne1\\nligne2");
    expect(escapeIcsText("ligne1\r\nligne2")).toBe("ligne1\\nligne2");
  });

  it("échappe le backslash EN PREMIER (pas de double échappement)", () => {
    // Un point-virgule seul → `\;` (un seul backslash ajouté).
    expect(escapeIcsText(";")).toBe("\\;");
  });
});

// ── Pliage 75 octets ─────────────────────────────────────────────────────────
describe("foldIcsLine", () => {
  it("laisse une ligne courte intacte", () => {
    expect(foldIcsLine("SUMMARY:court")).toBe("SUMMARY:court");
  });

  it("plie une ligne longue à 75 octets par ligne physique", () => {
    const line = `SUMMARY:${"a".repeat(200)}`;
    const folded = foldIcsLine(line);
    for (const physical of folded.split("\r\n")) {
      expect(utf8Bytes(physical)).toBeLessThanOrEqual(75);
    }
  });

  it("compte les OCTETS et non les caractères (accents = 2 octets)", () => {
    // 100 « é » = 200 octets → doit être plié même si < 75 « caractères » par vue.
    const line = `SUMMARY:${"é".repeat(100)}`;
    const folded = foldIcsLine(line);
    expect(folded).toContain("\r\n ");
    for (const physical of folded.split("\r\n")) {
      expect(utf8Bytes(physical)).toBeLessThanOrEqual(75);
    }
  });

  it("ne coupe jamais au milieu d'un caractère multi-octet (déplier = original)", () => {
    const value = "Formation IA — accompagnement stratégique des dirigeants « clés » en français";
    const line = `SUMMARY:${value}`;
    const folded = foldIcsLine(line);
    // Chaque ligne physique reste un UTF-8 valide (déplier reconstitue la ligne).
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    for (const physical of folded.split("\r\n")) {
      expect(utf8Bytes(physical)).toBeLessThanOrEqual(75);
    }
  });

  it("préfixe les lignes de continuation d'une seule espace", () => {
    const folded = foldIcsLine(`X:${"z".repeat(120)}`);
    const [, second] = folded.split("\r\n");
    expect(second?.startsWith(" ")).toBe(true);
  });
});

// ── UID stable ───────────────────────────────────────────────────────────────
describe("icsUid", () => {
  it("dérive un UID déterministe du type et de l'id", () => {
    expect(icsUid({ type: "formation", id: "abc" })).toBe("formation-abc@axion-ia.com");
    expect(icsUid({ type: "coaching", id: "xyz" })).toBe("coaching-xyz@axion-ia.com");
  });

  it("est stable entre deux appels (re-synchro = pas de doublon)", () => {
    const e = { type: "formation" as const, id: "f1" };
    expect(icsUid(e)).toBe(icsUid(e));
  });
});

// ── formatUtcStamp ───────────────────────────────────────────────────────────
describe("formatUtcStamp", () => {
  it("formate en `YYYYMMDDTHHMMSSZ` (UTC)", () => {
    expect(formatUtcStamp(new Date("2026-07-09T07:05:03Z"))).toBe("20260709T070503Z");
  });
});

// ── buildPlanningIcs ─────────────────────────────────────────────────────────
describe("buildPlanningIcs", () => {
  it("émet un VCALENDAR bien formé (BEGIN/END, VERSION, PRODID)", () => {
    const ics = buildPlanningIcs([evt()], "Agenda Ada", NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Axion-IA//Planning Formateur//FR");
    // Un VEVENT ouvert = un VEVENT fermé.
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics.match(/END:VEVENT/g)?.length).toBe(1);
  });

  it("toutes les lignes physiques respectent la limite de 75 octets", () => {
    const ics = buildPlanningIcs(
      [
        evt({
          titre: "Formation IA — accompagnement stratégique très détaillé des dirigeants clés",
        }),
      ],
      "Agenda Aéronautique & Défense — spécialités françaises accentuées",
      NOW,
    );
    for (const physical of ics.split("\r\n")) {
      expect(utf8Bytes(physical)).toBeLessThanOrEqual(75);
    }
  });

  it("porte le nom de calendrier (X-WR-CALNAME) et l'UID stable", () => {
    const ics = buildPlanningIcs([evt()], "Agenda Ada", NOW);
    const flat = unfold(ics);
    expect(flat).toContain("X-WR-CALNAME:Agenda Ada");
    expect(flat).toContain("UID:formation-f1@axion-ia.com");
  });

  it("créneau horodaté → DTSTART/DTEND en UTC", () => {
    const ics = unfold(buildPlanningIcs([evt()], "Agenda", NOW));
    expect(ics).toContain("DTSTART:20260709T070000Z");
    expect(ics).toContain("DTEND:20260709T150000Z");
  });

  it("journée entière (fin null) → VALUE=DATE sur le jour Europe/Paris", () => {
    // 2026-07-09T22:30Z = 2026-07-10T00:30 à Paris → jour parisien = le 10.
    const ics = unfold(
      buildPlanningIcs(
        [evt({ fin: null, debut: new Date("2026-07-09T22:30:00Z") })],
        "Agenda",
        NOW,
      ),
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20260710");
    // Fin DATE exclusive → lendemain.
    expect(ics).toContain("DTEND;VALUE=DATE:20260711");
    expect(ics).not.toContain("DTSTART:2026"); // pas de forme horodatée
  });

  it("exclut les prestations annulées et reportées", () => {
    const statuts: PlanningStatut[] = ["annulee", "reportee"];
    for (const statut of statuts) {
      const ics = buildPlanningIcs(
        [evt({ statut }), evt({ key: "formation:f2", id: "f2", titre: "Vivante" })],
        "Agenda",
        NOW,
      );
      expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
      expect(ics).toContain("SUMMARY:Vivante");
    }
  });

  it("échappe le titre dans SUMMARY (virgule, point-virgule)", () => {
    const ics = unfold(buildPlanningIcs([evt({ titre: "IA, ML; deep" })], "Agenda", NOW));
    expect(ics).toContain("SUMMARY:IA\\, ML\\; deep");
  });

  it("émet une LOCATION quand le lieu est renseigné, sinon rien", () => {
    const avec = unfold(buildPlanningIcs([evt({ lieu: "Grenoble" })], "Agenda", NOW));
    expect(avec).toContain("LOCATION:Grenoble");
    const sans = unfold(buildPlanningIcs([evt({ lieu: null })], "Agenda", NOW));
    expect(sans).not.toContain("LOCATION:");
  });

  it("calendrier vide reste un VCALENDAR valide sans VEVENT", () => {
    const ics = buildPlanningIcs([], "Agenda", NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("DTSTAMP est déterministe quand `now` est injecté", () => {
    const ics = unfold(buildPlanningIcs([evt()], "Agenda", NOW));
    expect(ics).toContain("DTSTAMP:20260701T100000Z");
  });
});
