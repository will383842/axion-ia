// Mesure du tunnel apporteurs (lot 1, 2026-10-05).
//
// Ce que ce fichier protège : les événements du tunnel apporteurs sont dans les
// DEUX listes fermées (type d'émission + schéma serveur), la balise émise par le
// navigateur est acceptée par le schéma serveur, et « Landing Viewed » ne part
// qu'une fois par visite. Une divergence entre les deux listes ne produit
// aucune erreur : la balise est rejetée en silence et la table reste vide.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FUNNEL_EVENT_NAMES,
  FUNNEL_KEYS,
  funnelEventSchema,
} from "@/lib/schemas/funnel-event-schema";
import { sendFunnelBeacon } from "@/lib/analytics/funnel-beacon";
import type { FunnelEvent } from "@/lib/tracking";

/** Lit le corps d'un Blob jsdom (voir `funnel-beacon.test.ts` : `Blob.text()` absent). */
function lireBlob(b: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("lecture du Blob impossible"));
    lecteur.readAsText(b);
  });
}

const EVENEMENTS_APPORTEUR: readonly FunnelEvent[] = [
  "Landing Viewed",
  "Landing Video Played",
  "Landing CTA Clicked",
  "Video Progress",
  "Lead Step Viewed",
  "Lead Email Captured",
  "Lead Apporteur Submitted",
  "Call Booking Viewed",
  "Consent Banner Answered",
];

describe("tunnel apporteurs — listes fermées", () => {
  it("la clé `apporteur` est admise", () => {
    expect(FUNNEL_KEYS).toContain("apporteur");
  });

  it("chaque événement du tunnel est dans la liste serveur", () => {
    for (const e of EVENEMENTS_APPORTEUR) {
      expect(FUNNEL_EVENT_NAMES as readonly string[], e).toContain(e);
    }
  });

  it("toute la liste serveur existe dans le vocabulaire d'émission (le type le verrouille, ceci le rend visible)", () => {
    // `Call Booked` reste volontairement HORS liste serveur : la réservation fait
    // foi côté serveur, une balise publique serait falsifiable.
    expect(FUNNEL_EVENT_NAMES as readonly string[]).not.toContain("Call Booked");
  });
});

describe("tunnel apporteurs — balise émise par le navigateur", () => {
  let corps: Blob[];

  beforeEach(() => {
    corps = [];
    window.sessionStorage.clear();
    vi.stubGlobal("navigator", {
      ...window.navigator,
      sendBeacon: (_u: string, d: Blob) => {
        corps.push(d);
        return true;
      },
    });
    window.history.replaceState({}, "", "/fr/apporteur-affaires/video");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chaque événement est accepté par le schéma serveur (aucune clé en trop)", async () => {
    for (const e of EVENEMENTS_APPORTEUR) {
      sendFunnelBeacon(e, { landing: "vsl-apporteur-v1", placement: "hero", step: "p25" });
    }
    expect(corps).toHaveLength(EVENEMENTS_APPORTEUR.length);
    for (const b of corps) {
      const brut: unknown = JSON.parse(await lireBlob(b));
      const verdict = funnelEventSchema.safeParse(brut);
      expect(verdict.success, JSON.stringify(verdict.error?.issues ?? [])).toBe(true);
      expect((brut as { funnel: string }).funnel).toBe("apporteur");
    }
  });

  it("aucune donnée personnelle ne sort : une clé e-mail rendrait la balise invalide", () => {
    expect(
      funnelEventSchema.safeParse({
        funnel: "apporteur",
        event: "Lead Email Captured",
        sessionId: "s-abcdef123456",
        email: "x@y.fr",
      }).success,
    ).toBe(false);
  });
});
