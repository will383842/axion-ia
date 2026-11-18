/**
 * L'étape 2 (`/appel/reserver`) : l'en-tête et le bouton propres au Tour, et l'en-tête historique
 * inchangé pour les autres types de rendez-vous.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
vi.mock("@/i18n/routing", () => ({ routing: { locales: ["fr", "en"] } }));
vi.mock("../actions", () => ({ soumettreLaReservation: vi.fn() }));
vi.mock("@/server/calendly/alertes-reservation", () => ({ signalerRepliPermanent: vi.fn() }));
vi.mock("@/server/calendly/availability", () => ({
  resoudreEventTypePourReservation: vi.fn(async () => ({ dureeMinutes: 30, questions: [] })),
}));
vi.mock("@/server/calendly/reprise-formulaire", () => ({
  lireLaRepriseDuCreneau: vi.fn(async () => null),
}));
vi.mock("@/server/calendly/formulaire-reservation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/calendly/formulaire-reservation")>()),
  reservationDirecteActive: () => true,
  creneauExploitable: () => true,
}));
vi.mock("@/server/calendly/choix-rendez-vous", () => ({
  PARAM_DEPUIS: "depuis",
  PARAM_RDV: "rdv",
  avecUtmContent: (url: string) => url,
  lireChoixRendezVous: (v: string | undefined) => (v === "tour" || v === "projet" ? v : null),
  lireDepuis: () => undefined,
  lireSuiviArrivee: () => ({}),
  lienDuCalendrier: () => "/fr/appel",
  resoudreChoix: vi.fn(async () => ({ url: "https://calendly.com/exemple" })),
}));
vi.mock("@/server/calendly/types-reservables", () => ({ formatsProposes: () => undefined }));
vi.mock("@/features/commercial-application/identite-reservation-vsl", () => ({
  PARAM_JETON_VSL: "j",
  identiteDuJetonVsl: vi.fn(async () => null),
}));
vi.mock("@/features/tour-de-france/identite-visio", () => ({
  champVilleDuTour: () => null,
  identiteDuJetonTour: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/formateurs-independants/identite-reservation", () => ({
  identiteDuJetonReservation: vi.fn(async () => null),
}));

import ReserverPage from "../page";

afterEach(cleanup);

async function rendre(rdv: string) {
  const ui = await ReserverPage({
    params: Promise.resolve({ locale: "fr" }),
    searchParams: Promise.resolve({ rdv, debut: "2030-01-15T13:30:00.000Z" }),
  });
  return render(ui);
}

describe("l'en-tête de l'étape 2", () => {
  it("rdv=tour : fil du Tour (étape 2), titre, sous-titre et bouton « Confirmer ma visio »", async () => {
    const { container } = await rendre("tour");
    expect(container.querySelector("h1")?.textContent).toBe("Votre visio de 30 minutes");
    expect(container.querySelector('ol [aria-current="step"]')?.textContent).toBe("La visio");
    expect(container.textContent).toContain(
      "Plus qu'une minute : vos coordonnées, dont un téléphone pour vous joindre.",
    );
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe(
      "Confirmer ma visio",
    );
    expect(container.textContent).not.toContain("Plus qu'une minute et c'est réservé");
  });

  it("rdv=projet : en-tête et bouton historiques, inchangés", async () => {
    const { container } = await rendre("projet");
    expect(container.querySelector("h1")?.textContent).toBe("Plus qu'une minute et c'est réservé");
    expect(container.textContent).toContain("Vos coordonnées");
    expect(container.querySelector("[aria-current]")).toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe(
      "Confirmer ce rendez-vous",
    );
  });
});
