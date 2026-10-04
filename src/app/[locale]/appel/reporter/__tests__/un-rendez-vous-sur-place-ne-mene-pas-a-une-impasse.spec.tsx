// @vitest-environment node

/**
 * Verrou — déplacer un rendez-vous SUR PLACE ne mène plus à une impasse.
 *
 * ## Le défaut (relecture de la PR 1300, 2026-10-04)
 *
 * La réservation directe ne sait rejouer qu'un appel ou une visio. Pour un
 * rendez-vous sur place (lieu `physical`), la page `/appel/reporter` montrait
 * pourtant les créneaux et « Confirmer ce nouvel horaire » ; le report était
 * ensuite refusé (« Réessayez, ou écrivez-nous »), en boucle. Et l'alerte
 * envoyée à Will disait « l'enrichissement a peut-être échoué » — une fausse
 * piste.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ADRESSE = "Salon GOFAB — Arena Saint-Étienne Métropole, 42400 Saint-Chamond";
const LIGNE_SUR_PLACE = {
  id: "rdv-gofab",
  eventUri: "https://api.calendly.com/scheduled_events/E",
  status: "scheduled",
  inviteeName: "Camille",
  inviteeEmail: "camille@exemple.invalid",
  inviteePhone: "+33 6 11 22 33 44",
  timezone: "Europe/Paris",
  location: ADRESSE,
  rawPayload: { event: { location: { type: "physical", location: ADRESSE } } },
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  eventTypeUri: "https://api.calendly.com/event_types/T",
  typeRendezVous: "salon",
  eventTypeName: "Rencontre au salon GOFAB",
};

const prevenir = vi.fn();
const reserverCreneau = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findUnique: vi.fn(async () => LIGNE_SUR_PLACE) } },
}));
vi.mock("@/server/calendly/liens-rendez-vous", async (orig) => ({
  ...(await orig<typeof import("@/server/calendly/liens-rendez-vous")>()),
  lireLeLien: vi.fn(async () => ({ ok: true, rendezVousId: "rdv-gofab" })),
}));
vi.mock("@/server/calendly/availability", () => ({
  resoudreEventTypePourReservation: vi.fn(async () => ({
    uri: "https://api.calendly.com/event_types/T",
  })),
}));
vi.mock("@/server/calendly/enrich", () => ({ enrichCalendlyEvent: vi.fn() }));
vi.mock("@/server/calendly/revalider-creneaux", () => ({ invaliderCreneaux: vi.fn() }));
vi.mock("@/server/calendly/alertes-reservation", () => ({
  prevenir: (...a: unknown[]) => prevenir(...a),
}));
vi.mock("@/server/calendly/formulaire-reservation", () => ({ creneauExploitable: () => true }));
vi.mock("@/server/calendly/choix-rendez-vous", () => ({
  urlDeReprogrammation: vi.fn(async () => "https://calendly.com/axion/salon"),
}));
vi.mock("@/server/calendly/reservation", () => ({
  reserverCreneau: (...a: unknown[]) => reserverCreneau(...a),
}));

beforeEach(() => {
  prevenir.mockReset();
  reserverCreneau.mockReset();
});

describe("le report d'un rendez-vous sur place", () => {
  it("🔴 rend la raison « sur_place », sans jamais rien réserver", async () => {
    const { reporterRendezVous } = await import("@/server/calendly/report");
    const r = await reporterRendezVous(
      LIGNE_SUR_PLACE,
      "https://api.calendly.com/event_types/T",
      new Date("2026-10-14T08:00:00Z"),
    );
    expect(r).toEqual({ ok: false, raison: "sur_place" });
    expect(reserverCreneau).not.toHaveBeenCalled();
  });

  it("🔴 l'alerte à Will dit la VRAIE raison, pas « enrichissement »", async () => {
    const { reporterDepuisLeLien } = await import("../actions");
    const { CHAMP_JETON, CHAMP_LOCALE_ANNULATION, CHAMP_NOUVEAU_DEBUT } =
      await import("@/server/calendly/liens-rendez-vous");
    const fd = new FormData();
    fd.set(CHAMP_JETON, "jeton");
    fd.set(CHAMP_LOCALE_ANNULATION, "fr");
    fd.set(CHAMP_NOUVEAU_DEBUT, "2026-10-14T08:00:00Z");
    await expect(reporterDepuisLeLien(fd)).rejects.toThrow(/^REDIRECT:/);

    expect(prevenir).toHaveBeenCalledTimes(1);
    const message = String(prevenir.mock.calls[0]?.[3] ?? "");
    expect(message, "l'alerte doit nommer le rendez-vous sur place").toContain(
      "Rendez-vous sur place : report en ligne impossible",
    );
    expect(message).not.toMatch(/enrichissement/i);
  });
});

describe("la page « déplacer » d'un rendez-vous sur place", () => {
  it("🔴 ne montre pas les créneaux : l'écran sur place passe AVANT eux", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/appel/reporter/page.tsx"),
      "utf8",
    );
    const ecranSurPlace = src.indexOf("<ReportSurPlace");
    expect(ecranSurPlace, "aucun écran dédié au rendez-vous sur place").toBeGreaterThan(-1);
    expect(ecranSurPlace).toBeLessThan(src.indexOf("Confirmer ce nouvel horaire"));
    expect(ecranSurPlace).toBeLessThan(src.indexOf("fetchAvailableSlots({"));
  });

  it("propose le lien de report Calendly quand la ligne le porte, sinon d'écrire", async () => {
    const { ReportSurPlace } = await import("@/components/booking/ReportSurPlace");
    const avec = renderToStaticMarkup(
      <ReportSurPlace lienCalendly="https://calendly.com/reschedulings/zz" />,
    );
    expect(avec).toContain('href="https://calendly.com/reschedulings/zz"');
    expect(avec).not.toContain("Confirmer ce nouvel horaire");
    expect(avec).toContain("e-mail de confirmation");

    const sans = renderToStaticMarkup(<ReportSurPlace lienCalendly={null} />);
    expect(sans).not.toContain("calendly.com");
    expect(sans).toContain("mailto:contact@axion-ia.com");

    // Jamais une URL arbitraire dans le bouton.
    const piege = renderToStaticMarkup(<ReportSurPlace lienCalendly="https://exemple.invalid/x" />);
    expect(piege).not.toContain("exemple.invalid");
  });
});
