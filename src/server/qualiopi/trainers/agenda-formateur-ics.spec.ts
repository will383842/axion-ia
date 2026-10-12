import { describe, expect, it } from "vitest";

import { construireAgendaSession, parisVersUtc } from "./agenda-formateur-ics";

describe("agenda de la session (.ics)", () => {
  it("heure de Paris vers UTC, été et hiver", () => {
    expect(parisVersUtc("2026-10-13", "09:00")?.toISOString()).toBe("2026-10-13T07:00:00.000Z");
    expect(parisVersUtc("2026-12-01", "09:00")?.toISOString()).toBe("2026-12-01T08:00:00.000Z");
    // Jour du passage à l'heure d'hiver (25 octobre 2026) : 09:00 est déjà à UTC+1.
    expect(parisVersUtc("2026-10-25", "09:00")?.toISOString()).toBe("2026-10-25T08:00:00.000Z");
    expect(parisVersUtc("n'importe quoi", "09:00")).toBeNull();
  });

  const base = {
    affectationId: "sf1",
    titre: "IA, en entreprise",
    lieu: "Lyon",
    description: "Session S-1",
    maintenant: new Date("2026-10-01T10:00:00Z"),
  };

  it("un événement par journée, UID stable, CRLF, échappements", () => {
    const ics = construireAgendaSession({
      ...base,
      jours: [
        { date: new Date("2026-11-10T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" },
        { date: new Date("2026-11-11T00:00:00Z"), heureDebut: "09:00", heureFin: "12:30" },
      ],
    })!;
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:session-sf1-2026-11-10@axion-ia.com");
    expect(ics).toContain("DTSTART:20261110T080000Z");
    expect(ics).toContain("DTEND:20261110T160000Z");
    expect(ics).toContain("SUMMARY:IA\\, en entreprise");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("aucun horaire lisible : pas de fichier", () => {
    expect(
      construireAgendaSession({
        ...base,
        jours: [{ date: new Date("2026-11-10T00:00:00Z"), heureDebut: "?", heureFin: "17:00" }],
      }),
    ).toBeNull();
    expect(construireAgendaSession({ ...base, jours: [] })).toBeNull();
  });
});
