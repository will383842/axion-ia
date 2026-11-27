/**
 * Piège à robots sur `/fr/appel/reserver` (2026-11-20).
 *
 * Mesuré dans Cloudflare AI Crawl Control : 548 580 des 628 610 requêtes de robots
 * d'IA en 7 jours visaient ce chemin. Chaque créneau du calendrier est un lien
 * UNIQUE (`?debut=<instant>&rdv&depuis&utm_*`), renouvelé tous les quarts d'heure
 * sur 32 jours ; expiré, il répond 307 vers `/appel`, qui en émet de nouveaux.
 *
 * Ce test exige `nofollow` sur CHAQUE créneau, dans les trois destinations du
 * sélecteur (notre formulaire, le report, Calendly). Le parcours humain n'en est
 * pas changé : un navigateur ignore `nofollow`.
 */
import { describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { CalendlySlotPicker } from "../CalendlySlotPicker";

const DAYS = [
  {
    dateKey: "2026-08-04",
    slots: [
      {
        startIso: "2026-08-04T07:00:00.000Z",
        schedulingUrl: "https://calendly.com/axion-ia/diagnostic/2026-08-04T07:00:00Z",
      },
    ],
  },
];

function creneau(props: Record<string, unknown>): HTMLElement {
  cleanup();
  render(<CalendlySlotPicker days={DAYS} isFr height={720} {...props} />);
  return screen.getByRole("link", { name: /Réserver .* à 09:00/ });
}

describe("les créneaux ne sont pas suivis par les robots", () => {
  it("formulaire interne (`/appel/reserver?debut=…`) : nofollow", () => {
    const a = creneau({ reservationDirecte: true, locale: "fr" });
    expect(a.getAttribute("href")).toMatch(/^\/fr\/appel\/reserver\?debut=/);
    expect((a.getAttribute("rel") ?? "").split(/\s+/)).toContain("nofollow");
  });

  it("report (`/appel/reporter?t=…&debut=…`) : nofollow", () => {
    const a = creneau({ lienDuCreneau: (iso: string) => `/fr/appel/reporter?t=x&debut=${iso}` });
    expect((a.getAttribute("rel") ?? "").split(/\s+/)).toContain("nofollow");
  });

  it("repli Calendly : nofollow, et noopener conservé", () => {
    const a = creneau({});
    const rel = (a.getAttribute("rel") ?? "").split(/\s+/);
    expect(rel).toContain("nofollow");
    expect(rel).toContain("noopener");
    expect(a).toHaveAttribute("target", "_blank");
  });
});
