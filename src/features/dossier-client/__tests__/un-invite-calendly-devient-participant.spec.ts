// @vitest-environment node
/**
 * Un invité ajouté à la réservation Calendly devient PARTICIPANT de la
 * rencontre — avec le titulaire et Williams — et seule l'EMPREINTE de son
 * adresse est gardée (plan V-05, vérification V5-C3).
 *
 * Sans cela, une parole du collègue invité serait attribuée par défaut au
 * titulaire, et l'effacement ciblé du collègue ne retrouverait rien.
 *
 * Contre-témoin : un rendez-vous sans invité n'a que deux participants.
 * Angle mort : le NOM de l'invité n'est pas dans la charge Calendly ; il
 * s'affiche par la partie locale de son adresse jusqu'à ce que Will le range.
 */

import { describe, expect, it } from "vitest";

import { hashEmailForLookup } from "@/lib/security/email-hash";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const BORNE = new Date("2026-10-01T00:00:00Z");

describe("un invité Calendly devient participant", () => {
  it("titulaire, invité et Williams — par empreinte, jamais par adresse", async () => {
    const ev = rendezVousCalendly({
      rawPayload: {
        event: {
          location: { type: "google_conference" },
          event_guests: [{ email: "collegue@exemple-fictif.fr" }],
          event_memberships: [{ user_email: "williams@exemple-fictif.fr" }],
        },
      },
    });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });

    const r = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    expect(r.statut).toBe("creee");

    const participants = base.tables["rencontreParticipant"] ?? [];
    expect(participants.map((p) => p["role"]).sort()).toEqual(["axion", "client", "client"]);
    const empreintes = participants.map((p) => p["emailHash"]);
    expect(empreintes).toContain(hashEmailForLookup("collegue@exemple-fictif.fr"));
    expect(empreintes).toContain(hashEmailForLookup("camille@exemple-fictif.fr"));
    expect(empreintes).toContain(hashEmailForLookup("williams@exemple-fictif.fr"));
    // Aucune adresse en clair dans les participants.
    expect(JSON.stringify(participants)).not.toContain("@");
  });

  it("contre-témoin : sans invité, deux participants", async () => {
    const ev = rendezVousCalendly();
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, { borne: BORNE });
    expect(base.tables["rencontreParticipant"]).toHaveLength(2);
  });

  it("un second appel ne recrée rien et resynchronise la date", async () => {
    const ev = rendezVousCalendly();
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    ev["startTime"] = new Date("2026-10-07T08:00:00Z");
    const b = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      borne: BORNE,
    });
    expect(b.statut).toBe("existante");
    expect(
      a.statut === "creee" && b.statut === "existante" && a.rencontreId === b.rencontreId,
    ).toBe(true);
    expect(base.tables["rencontre"]).toHaveLength(1);
    expect(base.tables["rencontreParticipant"]).toHaveLength(2);
    expect((base.tables["rencontre"]?.[0]?.["debutPrevu"] as Date).toISOString()).toBe(
      "2026-10-07T08:00:00.000Z",
    );
  });
});
