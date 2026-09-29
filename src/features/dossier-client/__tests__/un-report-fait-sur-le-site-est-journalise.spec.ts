// @vitest-environment node
/**
 * Un REPORT fait sur le site est JOURNALISÉ (`calendly_reports`) : c'est une
 * réservation neuve + une annulation, et sans ce journal rien ne dirait que
 * le nouveau rendez-vous remplace l'ancien. Avec lui, la rencontre du nouveau
 * rendez-vous se voit PROPOSER la fiche de l'ancien (motif `report`) — jamais
 * rangée d'office (A4).
 *
 *   · `reporterRendezVous` appelle le journal APRÈS la réservation du nouveau,
 *     AVANT la libération de l'ancien, et pas du tout si la réservation échoue ;
 *   · un journal qui plante ne coûte pas le report ;
 *   · `journaliserReport` est idempotent.
 *
 * Contre-témoin : sans journal, le nouveau rendez-vous reste « à classer ».
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  journaliserReport,
  reporterRendezVous,
  type RendezVousSource,
} from "@/server/calendly/report";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { dossierEnMemoire, fiche, id, rendezVousCalendly } from "./_dossier-en-memoire";

const ANCIEN = "https://api.calendly.com/scheduled_events/aaaaaaaa-1111-2222-3333-444444444444";
const NOUVEAU = "https://api.calendly.com/scheduled_events/bbbbbbbb-5555-6666-7777-888888888888";

function source(): RendezVousSource {
  return {
    id: "clx9k2m4a0001qw8h7yz3n5vb",
    eventUri: ANCIEN,
    inviteeName: "Camille Prospect",
    inviteeEmail: "camille@exemple-fictif.fr",
    inviteePhone: null,
    timezone: "Europe/Paris",
    location: null,
    rawPayload: { event: { location: { type: "google_conference" } } },
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
  };
}

function reseau(status: number) {
  const ordre: string[] = [];
  const f = vi.fn((url: string, init?: RequestInit) => {
    const m = init?.method ?? "GET";
    if (m === "POST" && url.endsWith("/invitees")) {
      ordre.push("reserver");
      return Promise.resolve(
        new Response(
          JSON.stringify({ resource: { event: NOUVEAU, cancel_url: "https://calendly.com/c" } }),
          {
            status,
          },
        ),
      );
    }
    if (m === "POST" && url.endsWith("/cancellation")) {
      ordre.push("liberer");
      return Promise.resolve(new Response("{}", { status: 201 }));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          resource: { status: "canceled", location: { type: "google_conference" } },
        }),
        {
          status: 200,
        },
      ),
    );
  });
  return { f, ordre };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

describe("un report fait sur le site est journalisé", () => {
  it("le journal part après la réservation, avant la libération", async () => {
    process.env.CALENDLY_API_TOKEN = "jeton-de-test";
    const { f, ordre } = reseau(201);
    vi.stubGlobal("fetch", f);
    const journal = vi.fn(async () => {
      ordre.push("journal");
    });
    const r = await reporterRendezVous(
      source(),
      "https://api.calendly.com/event_types/x",
      new Date("2026-10-09T08:00:00Z"),
      journal,
    );
    expect(r.ok).toBe(true);
    expect(journal).toHaveBeenCalledWith(ANCIEN, NOUVEAU);
    expect(ordre.indexOf("journal")).toBeGreaterThan(ordre.indexOf("reserver"));
    expect(ordre.indexOf("journal")).toBeLessThan(ordre.indexOf("liberer"));
  });

  it("réservation refusée : pas de journal ; journal qui plante : le report tient", async () => {
    process.env.CALENDLY_API_TOKEN = "jeton-de-test";
    const refus = reseau(400);
    vi.stubGlobal("fetch", refus.f);
    const journal = vi.fn();
    const r1 = await reporterRendezVous(
      source(),
      "https://api.calendly.com/event_types/x",
      new Date("2026-10-09T08:00:00Z"),
      journal,
    );
    expect(r1.ok).toBe(false);
    expect(journal).not.toHaveBeenCalled();

    const ok = reseau(201);
    vi.stubGlobal("fetch", ok.f);
    const r2 = await reporterRendezVous(
      source(),
      "https://api.calendly.com/event_types/x",
      new Date("2026-10-09T08:00:00Z"),
      async () => {
        throw new Error("base indisponible");
      },
    );
    expect(r2.ok).toBe(true);
  });

  it("le journal propose la fiche de l'ancien au nouveau (motif « report »), sans ranger", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const ancien = rendezVousCalendly({ eventUri: ANCIEN, inviteeEmail: "x@exemple-report.fr" });
    const nouveau = rendezVousCalendly({ eventUri: NOUVEAU, inviteeEmail: "x@exemple-report.fr" });
    const base = dossierEnMemoire({
      client: [f],
      calendlyEvent: [ancien, nouveau],
      rencontre: [
        {
          id: id(5),
          source: "calendly",
          type: "visio",
          titre: "t",
          calendlyEventUri: ANCIEN,
          clientId: f["id"],
          rattachementStatut: "valide",
        },
      ],
    });
    await journaliserReport(base.client as never, ANCIEN, NOUVEAU);
    await journaliserReport(base.client as never, ANCIEN, NOUVEAU);
    expect(base.tables["calendlyReport"]).toHaveLength(1);

    await assurerRencontrePourCalendly(base.client as never, nouveau["id"] as string, {
      borne: new Date("2026-10-01T00:00:00Z"),
    });
    const r = base.tables["rencontre"]?.find((x) => x["calendlyEventId"] === nouveau["id"]);
    expect(r?.["clientId"]).toBeNull();
    expect(r?.["clientProposeId"]).toBe(f["id"]);
    expect(r?.["motifProposition"]).toBe("report");
  });
});
