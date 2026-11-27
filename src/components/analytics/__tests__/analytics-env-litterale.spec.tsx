// Les quatre balises tierces lisent `process.env.NEXT_PUBLIC_*` en littéral (et non
// plus `@/env`, qui embarquait zod dans le socle client). Ce test verrouille que le
// comportement d'activation n'a pas bougé : variable absente OU vide = rien n'est
// rendu (`emptyStringAsUndefined` de src/env.ts), consentement requis pour les
// trois balises publicitaires, valeur par défaut de l'URL Plausible.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/tarifs" }));
vi.mock("next/script", () => ({
  default: (props: { id?: string; src?: string }) => (
    <script data-testid={props.id ?? "plausible"} data-src={props.src ?? ""} />
  ),
}));
// `@/env` ne doit plus être chargé par ces composants : s'il l'était, ce mock
// lèverait et le test rougirait.
vi.mock("@/env", () => {
  throw new Error("@/env ne doit pas être importé par les composants analytics");
});
let consentement: "accepted" | "refused" | "unknown" = "accepted";
vi.mock("../CookieConsent", () => ({ useAnalyticsConsent: () => consentement }));
vi.mock("@/lib/analytics/tunnel-facebook-routes", () => ({ isRouteTunnelFacebook: () => true }));

import { Plausible } from "../Plausible";
import { MetaPixel } from "../MetaPixel";
import { Clarity } from "../Clarity";
import { LinkedInInsight } from "../LinkedInInsight";

const CAS = [
  {
    nom: "MetaPixel",
    Composant: MetaPixel,
    cle: "NEXT_PUBLIC_META_PIXEL_ID",
    valeur: "123456",
    id: "meta-pixel",
  },
  {
    nom: "Clarity",
    Composant: Clarity,
    cle: "NEXT_PUBLIC_CLARITY_PROJECT_ID",
    valeur: "abc123",
    id: "clarity",
  },
  {
    nom: "LinkedInInsight",
    Composant: LinkedInInsight,
    cle: "NEXT_PUBLIC_LINKEDIN_PARTNER_ID",
    valeur: "987654",
    id: "linkedin-insight",
  },
] as const;

beforeEach(() => {
  consentement = "accepted";
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(CAS)("$nom", ({ Composant, cle, valeur }) => {
  it("rend la balise quand la variable est posée et le consentement accordé", () => {
    vi.stubEnv(cle, valeur);
    const { container } = render(<Composant />);
    expect(container.querySelector("script")).not.toBeNull();
  });
  it("ne rend rien quand la variable est absente", () => {
    vi.stubEnv(cle, undefined as unknown as string);
    delete process.env[cle];
    const { container } = render(<Composant />);
    expect(container.querySelector("script")).toBeNull();
  });
  it("ne rend rien quand la variable est une chaîne vide", () => {
    vi.stubEnv(cle, "");
    const { container } = render(<Composant />);
    expect(container.querySelector("script")).toBeNull();
  });
  it.each(["refused", "unknown"] as const)("ne rend rien sans consentement (%s)", (etat) => {
    vi.stubEnv(cle, valeur);
    consentement = etat;
    const { container } = render(<Composant />);
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("Plausible", () => {
  it("ne rend rien sans domaine (chaîne vide)", () => {
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "");
    expect(render(<Plausible />).container.querySelector("script")).toBeNull();
  });
  it("utilise l'hôte par défaut quand l'URL d'API est absente ou vide", () => {
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "axion-ia.com");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_API_URL", "");
    const src = render(<Plausible />)
      .container.querySelector("script")
      ?.getAttribute("data-src");
    expect(src).toBe(
      "https://plausible.axion-ia.com/js/script.file-downloads.outbound-links.tagged-events.js",
    );
  });
  it("respecte l'URL d'API quand elle est posée (sans consentement : Plausible n'en exige pas)", () => {
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "axion-ia.com");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_API_URL", "https://stats.example.test");
    consentement = "refused";
    const src = render(<Plausible />)
      .container.querySelector("script")
      ?.getAttribute("data-src");
    expect(src).toBe(
      "https://stats.example.test/js/script.file-downloads.outbound-links.tagged-events.js",
    );
  });
});
