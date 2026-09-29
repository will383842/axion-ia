// @vitest-environment node
/**
 * La résolution d'un lien de visio (déplacée dans `visio-serveur.ts`,
 * chantier visio PR 4) porte SA liste blanche : elle ne suit QUE la
 * redirection Calendly (`calendly.com/events/…`) et ne rend qu'un lien
 * `https`. `location` est modifiable à la main : une fonction qui irait
 * chercher n'importe quelle adresse serait une porte ouverte sur le réseau
 * interne du serveur.
 *
 * Mutation qui fait rougir : retirer `if (!estRedirectionCalendly(url))`
 * → l'adresse interne est appelée.
 * Contre-témoin : la redirection Calendly est suivie et son lien Meet rendu.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { resoudreConference } from "../visio-serveur";

function reponse(status: number, location: string | null): Response {
  return new Response(null, { status, headers: location ? { location } : {} });
}

describe("la résolution de visio ne suit que Calendly", () => {
  it("une adresse hors Calendly n'est JAMAIS appelée", async () => {
    const f = vi.fn();
    for (const url of [
      "http://127.0.0.1:5432/",
      "https://intranet.exemple-fictif.fr/redir",
      "https://calendly.com.exemple-fictif.fr/events/x",
    ]) {
      expect(await resoudreConference(url, f as never)).toBeNull();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("contre-témoin : la redirection Calendly est suivie", async () => {
    const f = vi.fn(async () => reponse(302, "https://meet.google.com/abc-defg-hij"));
    expect(
      await resoudreConference("https://calendly.com/events/uuid/google_meet", f as never),
    ).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("une redirection vers autre chose qu'un https n'est pas rendue", async () => {
    const f = vi.fn(async () => reponse(302, "javascript:alert(1)"));
    expect(
      await resoudreConference("https://calendly.com/events/uuid/google_meet", f as never),
    ).toBeNull();
  });
});
