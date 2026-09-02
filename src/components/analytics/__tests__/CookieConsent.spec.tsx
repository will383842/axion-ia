import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  ANALYTICS_CONSENT_KEY,
  CookieConsent,
  SCRIPT_AVANT_HYDRATATION,
  __resetConsentSnapshotForTests,
  readAnalyticsConsent,
  resetAnalyticsConsent,
  writeAnalyticsConsent,
} from "../CookieConsent";
import { Clarity } from "../Clarity";

vi.mock("next-intl", () => ({ useLocale: () => "fr" }));
// Le chemin courant, pilotable par test : null = hors App Router, comme avant.
let cheminCourant: string | null = null;
vi.mock("next/navigation", () => ({ usePathname: () => cheminCourant }));
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

/**
 * Monte le HTML SERVEUR dans le document et exécute le script en ligne, comme
 * le navigateur le fait à l'analyse — AVANT toute hydratation React.
 */
function monterAvantHydratation(): HTMLElement {
  const html = renderToString(<CookieConsent />);
  const hote = document.createElement("div");
  hote.innerHTML = html;
  document.body.appendChild(hote);
  new Function(SCRIPT_AVANT_HYDRATATION)();
  return hote;
}

describe("<CookieConsent> — rendu SSR et vie avant l'hydratation (lot LCP 2026-09-02)", () => {
  // Historique : rendu SSR à boutons MORTS (bug « ne se ferme pas ») → puis
  // rien avant hydratation → le bandeau devenait l'élément LCP de /contact et
  // /appel (4 à 10 s sur mobile). Désormais : rendu SSR ET boutons vivants
  // dès l'analyse du document, par le script en ligne.
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("🔴 rend le bandeau côté serveur, avec son script en ligne", () => {
    const html = renderToString(<CookieConsent />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('id="cookie-consent-banner"');
    expect(html).toContain("<script>");
    expect(html).toContain(ANALYTICS_CONSENT_KEY);
  });

  it("🔴 « Accepter » AVANT l'hydratation persiste (localStorage + cookie) et ferme le bandeau", () => {
    const hote = monterAvantHydratation();
    const bandeau = hote.querySelector("#cookie-consent-banner") as HTMLElement;
    expect(bandeau.hidden).toBe(false);
    const recu = vi.fn();
    window.addEventListener("axion-consent-changed", recu);
    (hote.querySelector('[data-consent="accepted"]') as HTMLButtonElement).click();
    expect(bandeau.hidden).toBe(true);
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("accepted");
    expect(Number(window.localStorage.getItem(TS_KEY))).toBeGreaterThan(0);
    expect(readCookieRaw()?.startsWith("accepted|")).toBe(true);
    expect(recu).toHaveBeenCalledTimes(1);
    // React, en hydratant ensuite, relit le même stockage : cohérent.
    __resetConsentSnapshotForTests();
    expect(readAnalyticsConsent()).toBe("accepted");
  });

  it("« Refuser » avant l'hydratation persiste declined", () => {
    const hote = monterAvantHydratation();
    (hote.querySelector('[data-consent="declined"]') as HTMLButtonElement).click();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("declined");
    expect(readCookieRaw()?.startsWith("declined|")).toBe(true);
  });

  it("un choix frais déjà enregistré cache le bandeau dès l'analyse, sans attendre React", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "declined");
    window.localStorage.setItem(TS_KEY, String(Date.now()));
    const hote = monterAvantHydratation();
    expect((hote.querySelector("#cookie-consent-banner") as HTMLElement).hidden).toBe(true);
  });

  it("un choix expiré (13 mois) laisse le bandeau visible avant l'hydratation aussi", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    window.localStorage.setItem(TS_KEY, String(Date.now() - THIRTEEN_MONTHS_MS - 1));
    const hote = monterAvantHydratation();
    expect((hote.querySelector("#cookie-consent-banner") as HTMLElement).hidden).toBe(false);
  });

  it("le script est DÉRIVÉ des constantes du module — mêmes clés, même durée, même événement", () => {
    expect(SCRIPT_AVANT_HYDRATATION).toContain(JSON.stringify(ANALYTICS_CONSENT_KEY));
    expect(SCRIPT_AVANT_HYDRATATION).toContain(JSON.stringify(`${ANALYTICS_CONSENT_KEY}:ts`));
    expect(SCRIPT_AVANT_HYDRATATION).toContain(String(THIRTEEN_MONTHS_MS));
    expect(SCRIPT_AVANT_HYDRATATION).toContain('"axion-consent-changed"');
  });
});

describe("<CookieConsent> — affichage", () => {
  it("s'affiche quand aucun choix n'est enregistré", () => {
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

describe("<CookieConsent> — compact au téléphone", () => {
  // Mesuré le 2026-09-02 sur iPhone 375 px : 249 px sur 629, soit 40 % de
  // l'écran, qui recouvraient les deux phrases clés de la page « nous
  // vérifions votre réservation ». La hauteur vient d'abord du TEXTE : on le
  // borne, et on exige des boutons de 44 px (h-11) côte à côte.
  it("🔴 le texte du bandeau tient sous 200 caractères, liens compris", () => {
    render(<CookieConsent />);
    const corps = document.getElementById("cookie-consent-body");
    expect(corps, "le corps du bandeau existe").toBeTruthy();
    expect((corps?.textContent ?? "").trim().length).toBeLessThanOrEqual(200);
  });

  it("🔴 les deux boutons font 44 px de haut et partagent la largeur", () => {
    render(<CookieConsent />);
    for (const nom of ["Refuser", "Accepter"]) {
      const classes = screen.getByRole("button", { name: nom }).className.split(/\s+/);
      expect(classes, `${nom} : h-11`).toContain("h-11");
    }
    const rangee = screen.getByRole("button", { name: "Refuser" }).parentElement;
    expect(rangee?.className.split(/\s+/)).toContain("grid-cols-2");
  });

  it("le titre reste lisible par les lecteurs d'écran (aria-labelledby) même masqué", () => {
    render(<CookieConsent />);
    const titre = document.getElementById("cookie-consent-title");
    expect(titre?.textContent).toBe("Cookies analytics");
    expect(banner()?.getAttribute("aria-labelledby")).toBe("cookie-consent-title");
  });
});

describe("<CookieConsent> — écrans de fin du parcours d'appel", () => {
  // Aucun script tiers n'y est chargé (Clarity, LinkedIn s'abstiennent via la
  // même fonction), donc rien à consentir : la bannière ne recouvre plus
  // « merci de ne pas réserver à nouveau » sur un téléphone.
  it.each(["/fr/appel/confirme", "/fr/appel/annuler", "/fr/appel/reporter"])(
    "ne s'affiche pas sur %s",
    (p) => {
      cheminCourant = p;
      try {
        render(<CookieConsent />);
        expect(banner()).toBeNull();
      } finally {
        cheminCourant = null;
      }
    },
  );

  it("🔑 CONTRE-TÉMOIN : s'affiche toujours sur /fr/appel, l'entrée de l'entonnoir", () => {
    cheminCourant = "/fr/appel";
    try {
      render(<CookieConsent />);
      expect(banner()).not.toBeNull();
    } finally {
      cheminCourant = null;
    }
  });
});

describe("<CookieConsent> — police système (régression CLS du 2026-09-02)", () => {
  it("🔴 le bandeau n'utilise pas la police de marque : rendu SSR, elle le fait décaler au swap", () => {
    const html = renderToString(<CookieConsent />);
    // Mesuré sur le runner : `p#cookie-consent-body`, cause « Web font loaded »,
    // 0,052 sur /fr, 0,062 sur /contact, 0,049 sur /appel — au-dessus du seuil.
    expect(html).toMatch(/font-family:[^"]*system-ui/);
    expect(html).not.toMatch(/font-family:[^"]*Manrope/);
  });
});
