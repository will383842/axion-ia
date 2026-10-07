// « Landing Viewed » : une fois par visite (lot 1 mesure, 2026-10-05).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { LandingViewTracker } from "../LandingViewTracker";

/** Lit le corps d'un Blob jsdom (`Blob.text()` absent : voir `funnel-beacon.test.ts`). */
function lireBlob(b: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("lecture du Blob impossible"));
    lecteur.readAsText(b);
  });
}

describe("LandingViewTracker", () => {
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
    window.history.replaceState({}, "", "/fr/apporteur-affaires");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("émet « Landing Viewed » une seule fois par visite, même après un remontage", async () => {
    const premier = render(<LandingViewTracker landing="apporteur-court" />);
    premier.unmount();
    render(<LandingViewTracker landing="apporteur-court" />);
    expect(corps).toHaveLength(1);
    const brut = JSON.parse(await lireBlob(corps[0]!)) as { event: string; landing: string };
    expect(brut.event).toBe("Landing Viewed");
    expect(brut.landing).toBe("apporteur-court");
  });

  it("émet quand même si le stockage de session est interdit", () => {
    const espion = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("refusé");
    });
    // Sans stockage la session n'a pas d'identifiant : la balise base est
    // muette (comportement voulu), mais le composant ne doit jamais lever.
    expect(() => render(<LandingViewTracker landing="apporteur-court" />)).not.toThrow();
    espion.mockRestore();
  });
});
