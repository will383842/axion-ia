/**
 * Une CANDIDATURE ne reçoit jamais la question « Enregistrer cette visio ? »
 * (relecture du 2026-10-01). Les deux listes (« Rendez-vous », « Appels
 * réservés ») lisent `linkedJobApplicationId`, le portent sur `UnifiedRdv`, et
 * le passent à `enregistrementPropose`, où il est obligatoire.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { enregistrementPropose } from "@/components/admin/contacts/enregistrement-propose";
import { fromCalendly, type CalendlyEventRow } from "../normalize";
import { CAL_SELECT } from "../queries";

const ligne = (linkedJobApplicationId: string | null): CalendlyEventRow => ({
  id: "evt_1",
  eventTypeName: "Discutons de votre projet IA",
  status: "scheduled",
  startTime: new Date("2026-10-01T09:30:00Z"),
  endTime: new Date("2026-10-01T10:15:00Z"),
  inviteeName: "Camille",
  inviteeEmail: "c@exemple.test",
  inviteePhone: null,
  location: "https://meet.google.com/abc-defg-hij",
  notes: null,
  capturedAt: new Date("2026-10-01T09:00:00Z"),
  linkedJobApplicationId,
});

describe("une candidature ne propose jamais l'enregistrement", () => {
  it("les deux listes lisent le rattachement à une candidature", () => {
    expect(CAL_SELECT).toHaveProperty("linkedJobApplicationId", true);
    expect(fromCalendly(ligne("cand_1")).linkedJobApplicationId).toBe("cand_1");
    expect(fromCalendly(ligne(null)).linkedJobApplicationId).toBeNull();
  });

  it("un « Discutons » rattaché à une candidature : aucune question", () => {
    const r = fromCalendly(ligne("cand_1"));
    expect(
      enregistrementPropose({
        titre: r.title,
        identifiant: r.sourceRecordId,
        drapeau: "ouvert",
        linkedJobApplicationId: r.linkedJobApplicationId,
      }),
    ).toBeNull();
    const t = fromCalendly(ligne(null));
    expect(
      enregistrementPropose({
        titre: t.title,
        identifiant: t.sourceRecordId,
        drapeau: "ouvert",
        linkedJobApplicationId: t.linkedJobApplicationId,
      }),
    ).toBe("evt_1");
  });

  it.each([
    "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/contacts/appels/page.tsx",
  ])("%s passe le rattachement à chaque appel", (fichier) => {
    const code = readFileSync(join(process.cwd(), fichier), "utf8");
    const appels = code.split("enregistrementPropose({").slice(1);
    expect(appels.length).toBeGreaterThan(0);
    for (const a of appels) {
      expect(a.slice(0, a.indexOf("})"))).toContain(
        "linkedJobApplicationId: r.linkedJobApplicationId",
      );
    }
  });
});
