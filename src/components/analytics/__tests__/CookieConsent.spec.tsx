import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  ANALYTICS_CONSENT_KEY,
  CookieConsent,
  __resetConsentSnapshotForTests,
  readAnalyticsConsent,
  resetAnalyticsConsent,
  writeAnalyticsConsent,
} from "../CookieConsent";
import { Clarity } from "../Clarity";

vi.mock("next-intl", () => ({ useLocale: () => "fr" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_CLARITY_PROJECT_ID: "test-project" } }));
vi.mock("next/script", () => ({
  default: ({ id }: { id: string }) => <script data-testid={id} />,
}));

const TS_KEY = `${ANALYTICS_CONSENT_KEY}:ts`;
const THIRTEEN_MONTHS_MS = 13 * 30 * 24 * 60 * 60 * 1000;

function clearCookie() {
  document.cookie = `${ANALYTICS_CONSENT_KEY}=; path=/; max-age=0`;
}

function readCookieRaw(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${ANALYTICS_CONSENT_KEY}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

const banner = () => screen.queryByRole("dialog");

beforeEach(() => {
  window.localStorage.clear();
  clearCookie();
  __resetConsentSnapshotForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<CookieConsent> — rendu SSR", () => {
  // RÉGRESSION : le banner était rendu dans le HTML statique des 17k routes
  // SSG, servi par Cloudflare en ~100 ms, alors que ses onClick n'existent
  // qu'après hydratation (~284 KB gz). Il était donc visible mais MORT au
  // clic pendant plusieurs centaines de ms (desktop) à quelques secondes
  // (mobile) — la cause du bug « le bandeau ne se ferme pas, parfois ».
  it("ne rend RIEN côté serveur (sinon boutons morts avant hydratation)", () => {
    expect(renderToString(<CookieConsent />)).toBe("");
  });
});

describe("<CookieConsent> — affichage", () => {
  it("s'affiche une fois hydraté quand aucun choix n'est enregistré", () => {
    render(<CookieConsent />);
    expect(banner()).not.toBeNull();
    expect(screen.getByText("Cookies analytics")).toBeTruthy();
  });

  it("ne s'affiche pas si un choix est déjà enregistré", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "declined");
    window.localStorage.setItem(TS_KEY, String(Date.now()));
    render(<CookieConsent />);
    expect(banner()).toBeNull();
  });

  it("se ré-affiche si le consent a expiré (13 mois CNIL)", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    window.localStorage.setItem(TS_KEY, String(Date.now() - THIRTEEN_MONTHS_MS - 1));
    render(<CookieConsent />);
    expect(banner()).not.toBeNull();
  });
});

describe("<CookieConsent> — choix visiteur", () => {
  it("« Accepter » ferme le banner et persiste en localStorage ET en cookie", async () => {
    render(<CookieConsent />);
    await act(async () => screen.getByRole("button", { name: "Accepter" }).click());

    expect(banner()).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("accepted");
    expect(readCookieRaw()).toMatch(/^accepted\|\d+$/);
    expect(readAnalyticsConsent()).toBe("accepted");
  });

  it("« Refuser » ferme le banner et persiste declined", async () => {
    render(<CookieConsent />);
    await act(async () => screen.getByRole("button", { name: "Refuser" }).click());

    expect(banner()).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("declined");
    expect(readAnalyticsConsent()).toBe("declined");
  });
});

describe("<CookieConsent> — stockage indisponible", () => {
  // RÉGRESSION : `writeConsent` sortait du catch AVANT de dispatcher l'event
  // et rien n'était persisté ; seul un state React éphémère masquait le
  // banner → il revenait à chaque rechargement, indéfiniment (iOS « Bloquer
  // tous les cookies », quota, navigation privée).
  it("ferme le banner et bascule sur le cookie si localStorage throw", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    render(<CookieConsent />);
    await act(async () => screen.getByRole("button", { name: "Accepter" }).click());

    expect(banner()).toBeNull();
    expect(readCookieRaw()).toMatch(/^accepted\|\d+$/);
  });

  it("ferme le banner même si localStorage ET cookie sont indisponibles", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const cookieSpy = vi.spyOn(Document.prototype, "cookie", "set").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    render(<CookieConsent />);
    await act(async () => screen.getByRole("button", { name: "Accepter" }).click());

    expect(banner()).toBeNull();
    expect(readAnalyticsConsent()).toBe("accepted");
    cookieSpy.mockRestore();
  });

  it("relit le choix depuis le cookie quand localStorage est vide (éviction ITP)", () => {
    document.cookie = `${ANALYTICS_CONSENT_KEY}=${encodeURIComponent(`declined|${Date.now()}`)}; path=/`;
    __resetConsentSnapshotForTests();

    render(<CookieConsent />);
    expect(banner()).toBeNull();
    expect(readAnalyticsConsent()).toBe("declined");
  });
});

describe("resetAnalyticsConsent — RGPD art. 7.3", () => {
  it("purge le stockage et ré-affiche le banner", async () => {
    render(<CookieConsent />);
    await act(async () => screen.getByRole("button", { name: "Accepter" }).click());
    expect(banner()).toBeNull();

    await act(async () => resetAnalyticsConsent());

    expect(banner()).not.toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
    expect(readCookieRaw()).toBeNull();
    expect(readAnalyticsConsent()).toBe("unknown");
  });
});

describe("<Clarity> — gate consent", () => {
  it("ne charge RIEN sans choix enregistré", () => {
    render(<Clarity />);
    expect(screen.queryByTestId("ms-clarity")).toBeNull();
  });

  it("ne charge RIEN si le visiteur a refusé", () => {
    writeAnalyticsConsent("declined");
    render(<Clarity />);
    expect(screen.queryByTestId("ms-clarity")).toBeNull();
  });

  it("charge le script une fois le consent accepté", () => {
    writeAnalyticsConsent("accepted");
    render(<Clarity />);
    expect(screen.queryByTestId("ms-clarity")).not.toBeNull();
  });
});
