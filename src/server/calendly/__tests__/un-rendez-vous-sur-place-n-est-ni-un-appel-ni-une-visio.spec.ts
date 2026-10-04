// @vitest-environment node

/**
 * Verrou — un rendez-vous SUR PLACE (lieu Calendly `physical`) n'est ni un
 * appel ni une visio.
 *
 * ## Le défaut vu en réel le 2026-10-04
 *
 * « Rencontre au salon GOFAB — 13 octobre » : lieu Calendly de type `physical`,
 * c'est-à-dire une ADRESSE (« Salon GOFAB — espace Lyon Pacte PME AURA, Arena
 * Saint-Étienne… »). La console l'affichait « Téléphone » dans la colonne
 * Format, et le CRM le recevait en `format: "telephone"` : `canal.ts` rangeait
 * `physical` parmi les téléphones, en miroir de `PHONE_LOCATION_TYPES`
 * (`api.ts`).
 *
 * ## Ce que ce témoin vérifie
 *
 * Le canal, le libellé, l'extraction du numéro, la ligne console, le report et
 * le CONTENU RENDU de l'e-mail — pas une forme de code.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { canalDuRendezVous, LIBELLE_CANAL } from "../canal";
import { fetchCalendlyInvitee } from "../api";
import { demandeDepuisLaSource } from "../report";
import { fromCalendly } from "@/features/admin-rendezvous/normalize";
import { renderEmailTemplate } from "@/lib/email/templates";

const ADRESSE =
  "Salon GOFAB — espace Lyon Pacte PME AURA, Arena Saint-Étienne Métropole, 1 rue André Jeantet, 42400 Saint-Chamond";

/** La charge `enrich` d'un rendez-vous sur place, telle que Calendly la rend. */
const PAYLOAD_SUR_PLACE = {
  invitee: {},
  event: { location: { type: "physical", location: ADRESSE } },
};

describe("le canal d'un lieu `physical`", () => {
  it("🔴 lieu physical → Sur place, pas Téléphone", () => {
    const canal = canalDuRendezVous(ADRESSE, PAYLOAD_SUR_PLACE);
    expect(canal, "un lieu `physical` est une adresse, pas un appel").toBe("sur_place");
    expect(LIBELLE_CANAL[canal]).toBe("Sur place");
  });

  it("même quand le texte du lieu ressemble à un numéro, le TYPE l'emporte", () => {
    expect(
      canalDuRendezVous("04 77 12 34 56", {
        event: { location: { type: "physical", location: "04 77 12 34 56" } },
      }),
    ).toBe("sur_place");
  });
});

describe("l'extraction du numéro ne prend jamais une adresse", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CALENDLY_API_TOKEN;
  });

  async function telephoneExtrait(lieu: unknown): Promise<string | null> {
    process.env.CALENDLY_API_TOKEN = "jeton-de-test";
    const reponses: Record<string, unknown> = {
      "https://api.calendly.com/scheduled_events/E/invitees/I": {
        resource: { name: "Camille", email: "camille@exemple.invalid" },
      },
      "https://api.calendly.com/scheduled_events/E": {
        resource: { name: "Rencontre au salon GOFAB", location: lieu },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (uri: string) => new Response(JSON.stringify(reponses[uri] ?? {}), { status: 200 }),
      ),
    );
    const r = await fetchCalendlyInvitee(
      "https://api.calendly.com/scheduled_events/E/invitees/I",
      "https://api.calendly.com/scheduled_events/E",
    );
    if (!r.ok) throw new Error(`lecture Calendly simulée en échec : ${r.reason}`);
    return r.data.inviteePhone;
  }

  it("🔴 un lieu `physical` ne fournit jamais le téléphone, même tout en chiffres", async () => {
    expect(await telephoneExtrait({ type: "physical", location: ADRESSE })).toBeNull();
    expect(
      await telephoneExtrait({ type: "physical", location: "04 77 12 34 56" }),
      "un lieu `physical` est une adresse : il ne remplit pas le champ Téléphone",
    ).toBeNull();
  });

  it("contre-témoin : un appel sortant fournit toujours son numéro", async () => {
    expect(await telephoneExtrait({ type: "outbound_call", location: "+33 6 11 22 33 44" })).toBe(
      "+33 6 11 22 33 44",
    );
  });
});

describe("la console d'un rendez-vous sur place ne promet ni appel ni visio", () => {
  it("🔴 format « sur_place », aucun bouton de visio, l'adresse reste lisible", () => {
    const rdv = fromCalendly({
      id: "rdv-gofab",
      eventTypeName: "Rencontre au salon GOFAB — 13 octobre",
      startTime: new Date("2026-10-13T08:00:00Z"),
      endTime: new Date("2026-10-13T08:15:00Z"),
      capturedAt: new Date("2026-10-04T08:00:00Z"),
      status: "scheduled",
      inviteeName: "Camille",
      inviteeEmail: "camille@exemple.invalid",
      inviteePhone: null,
      location: ADRESSE,
      rawPayload: PAYLOAD_SUR_PLACE,
      notes: null,
      linkedJobApplicationId: null,
      typeRendezVous: "salon",
    } as unknown as Parameters<typeof fromCalendly>[0]);
    expect(rdv.format).toBe("sur_place");
    expect(LIBELLE_CANAL[rdv.format]).not.toBe("Téléphone");
    expect(rdv.lienVisio).toBeNull();
    expect(rdv.location).toBe(ADRESSE);
  });

  it("un report en ligne est refusé plutôt que rejoué en appel", () => {
    const d = demandeDepuisLaSource(
      {
        id: "rdv-gofab",
        eventUri: null,
        inviteeName: "Camille",
        inviteeEmail: "camille@exemple.invalid",
        inviteePhone: "+33 6 11 22 33 44",
        timezone: "Europe/Paris",
        location: ADRESSE,
        rawPayload: PAYLOAD_SUR_PLACE,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      },
      "https://api.calendly.com/event_types/T",
      new Date("2026-10-14T08:00:00Z"),
    );
    expect(d.ok, "reporter un rendez-vous sur place en appel changerait son format").toBe(false);
  });
});

describe("l'e-mail d'un rendez-vous sur place ne promet ni appel ni visio", () => {
  const BASE = {
    prenom: "Camille",
    heure: "10:00",
    date: "mardi 13 octobre",
    dureeMinutes: 15,
    lieu: ADRESSE,
    format: "sur_place",
    cancelUrl: "https://calendly.com/cancellations/zz",
    rescheduleUrl: "https://calendly.com/reschedulings/zz",
  };

  for (const moment of ["confirmation", "j1", "h1"] as const) {
    it(`🔴 ${moment} : « sur place » et l'adresse, jamais « nous vous appellerons »`, async () => {
      const rendu = await renderEmailTemplate("appel-rappel", "fr", { ...BASE, moment });
      const t = `${rendu.html} ${rendu.text ?? ""}`.toLowerCase();
      expect(t, "un rendez-vous sur place promettait un appel").not.toContain("appellerons");
      expect(t).not.toContain("visioconférence");
      expect(t).toContain("sur place");
      expect(t).toContain("arena saint-étienne");
    });
  }

  it("🔴 le chemin RÉEL des rappels : format dérivé de la charge, puis rendu", async () => {
    // `rappels-appel.ts` dérive le format par `canalDuRendezVous(location,
    // rawPayload)` et le passe au gabarit. Tant que `physical` était un
    // téléphone, le salon GOFAB aurait lu « Nous vous appellerons au Salon
    // GOFAB — espace Lyon Pacte PME AURA… ».
    const rendu = await renderEmailTemplate("appel-rappel", "fr", {
      ...BASE,
      format: canalDuRendezVous(ADRESSE, PAYLOAD_SUR_PLACE),
      moment: "j1",
    });
    const t = `${rendu.html} ${rendu.text ?? ""}`.toLowerCase();
    expect(t, "l'e-mail promettait un appel à une adresse de salon").not.toContain("appellerons");
  });

  it("sans format transmis, le gabarit ne transforme pas l'adresse en appel", async () => {
    const rendu = await renderEmailTemplate("appel-rappel", "fr", {
      ...BASE,
      format: undefined,
      moment: "confirmation",
    });
    expect(`${rendu.html} ${rendu.text ?? ""}`.toLowerCase()).not.toContain("appellerons");
  });
});
