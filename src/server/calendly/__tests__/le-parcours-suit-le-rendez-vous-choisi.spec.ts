/**
 * Le parcours public suit le rendez-vous CHOISI (chantier « Types de
 * rendez-vous », lot L2, 2026-10-04).
 *
 * Ce qui doit tenir :
 *   1. `?rdv=diagnostic|projet` désigne le bon type Calendly, rien d'autre ;
 *   2. diagnostic INTROUVABLE chez Calendly → repli silencieux sur le type
 *      appel ; liste illisible → on garde le diagnostic (absence non prouvée) ;
 *   3. un report garde le type d'ORIGINE (URI stockée, puis type, puis nom) ;
 *   4. `utm_content` mesure le bouton : `diagnostic`, `projet`, `diagnostic:accueil-hero`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const listerMock = vi.fn();
vi.mock("@/server/calendly/availability", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listerTypesEvenementCalendly: (...a: unknown[]) => listerMock(...a),
}));

import {
  avecUtmContent,
  choixDuType,
  lireChoixRendezVous,
  lireDepuis,
  parametresDuChoix,
  resoudreChoix,
  resoudreLesDeuxChoix,
  typeDuChoix,
  urlConfigureeDuChoix,
  urlDeReprogrammation,
  utmContentDuChoix,
} from "../choix-rendez-vous";
import { corpsDeLaDemande } from "../reservation";
import { urlDuFormulaire } from "../formulaire-reservation";

const PROJET = "https://calendly.com/axion-ia/premier-contact";
const DIAG = "https://calendly.com/axion-ia/diagnostic-ia";
const APPORTEUR = "https://calendly.com/axion-ia/echange-apporteur-affaires";
const SALON = "https://calendly.com/axion-ia/rencontre-salon-gofab";

const URI_PROJET = "https://api.calendly.com/event_types/PROJET";
const URI_DIAG = "https://api.calendly.com/event_types/DIAG";
const URI_SALON = "https://api.calendly.com/event_types/SALON";

const COMPTE_COMPLET = [
  { uri: URI_PROJET, scheduling_url: PROJET, duration: 45 },
  { uri: URI_DIAG, scheduling_url: DIAG, duration: 30 },
  { uri: "https://api.calendly.com/event_types/APP", scheduling_url: APPORTEUR, duration: 15 },
  { uri: URI_SALON, scheduling_url: SALON, duration: 20 },
];
const COMPTE_SANS_DIAGNOSTIC = COMPTE_COMPLET.filter((t) => t.uri !== URI_DIAG);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CALENDLY_API_TOKEN = "pat_test";
  delete process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL;
  delete process.env.NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL;
  delete process.env.CALENDLY_APPORTEUR_URL;
  listerMock.mockResolvedValue({ types: COMPTE_COMPLET });
});

afterEach(() => {
  delete process.env.CALENDLY_API_TOKEN;
  vi.unstubAllEnvs();
});

describe("le paramètre `rdv` désigne le choix, et seulement lui", () => {
  it("accepte les deux valeurs, insensible à la casse et aux espaces", () => {
    expect(lireChoixRendezVous("diagnostic")).toBe("diagnostic");
    expect(lireChoixRendezVous(" Projet ")).toBe("projet");
  });

  it("refuse tout le reste : la page montre alors le choix", () => {
    for (const v of [
      undefined,
      null,
      "",
      "appel",
      "echange_projet",
      "diagnostic-ia",
      3,
      ["projet"],
    ]) {
      expect(lireChoixRendezVous(v)).toBeNull();
    }
  });

  it("chaque choix vise son type de rendez-vous", () => {
    expect(typeDuChoix("diagnostic")).toBe("diagnostic");
    expect(typeDuChoix("projet")).toBe("echange_projet");
    expect(choixDuType("diagnostic")).toBe("diagnostic");
    expect(choixDuType("echange_projet")).toBe("projet");
    expect(choixDuType("salon")).toBeNull();
  });

  it("chaque choix a sa propre URL Calendly — défauts réels, puis variables", () => {
    expect(urlConfigureeDuChoix("diagnostic")).toBe(DIAG);
    expect(urlConfigureeDuChoix("projet")).toBe(PROJET);
    vi.stubEnv("NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL", "https://calendly.com/x/diag");
    vi.stubEnv("NEXT_PUBLIC_CALENDLY_APPEL_URL", "https://calendly.com/x/appel");
    expect(urlConfigureeDuChoix("diagnostic")).toBe("https://calendly.com/x/diag");
    expect(urlConfigureeDuChoix("projet")).toBe("https://calendly.com/x/appel");
  });
});

describe("repli du diagnostic", () => {
  it("diagnostic présent chez Calendly : son URL, sa durée", async () => {
    await expect(resoudreChoix("diagnostic")).resolves.toEqual({
      choix: "diagnostic",
      url: DIAG,
      replie: false,
      dureeMinutes: 30,
    });
  });

  it("🔴 diagnostic INTROUVABLE (supprimé, désactivé) : repli silencieux sur le type appel", async () => {
    listerMock.mockResolvedValue({ types: COMPTE_SANS_DIAGNOSTIC });
    await expect(resoudreChoix("diagnostic")).resolves.toEqual({
      choix: "diagnostic",
      url: PROJET,
      replie: true,
      dureeMinutes: 45,
    });
  });

  it("liste illisible (API en panne) : on garde le diagnostic, sans durée", async () => {
    listerMock.mockResolvedValue({ failure: { ok: false, reason: "api_error" } });
    await expect(resoudreChoix("diagnostic")).resolves.toEqual({
      choix: "diagnostic",
      url: DIAG,
      replie: false,
    });
  });

  it("API qui lève : jamais d'exception", async () => {
    listerMock.mockRejectedValue(new Error("réseau"));
    await expect(resoudreChoix("diagnostic")).resolves.toMatchObject({ url: DIAG });
  });

  it("au build (`stub.invalid`) et sans jeton : aucune requête", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    await resoudreChoix("diagnostic");
    vi.unstubAllEnvs();
    delete process.env.CALENDLY_API_TOKEN;
    await resoudreChoix("projet");
    expect(listerMock).not.toHaveBeenCalled();
  });

  it("le projet ne se replie jamais, et les deux se résolvent en une lecture", async () => {
    listerMock.mockResolvedValue({ types: COMPTE_SANS_DIAGNOSTIC });
    const deux = await resoudreLesDeuxChoix();
    expect(deux.projet).toEqual({ choix: "projet", url: PROJET, replie: false, dureeMinutes: 45 });
    expect(deux.diagnostic.replie).toBe(true);
    expect(listerMock).toHaveBeenCalledTimes(1);
  });
});

describe("🔴 un report garde le type d'ORIGINE", () => {
  it("par l'URI stockée, même si le type et le nom disent autre chose", async () => {
    await expect(
      urlDeReprogrammation({
        eventTypeUri: URI_DIAG,
        typeRendezVous: "echange_projet",
        eventTypeName: "Discutons de votre projet IA",
      }),
    ).resolves.toBe(DIAG);
    await expect(urlDeReprogrammation({ eventTypeUri: URI_SALON })).resolves.toBe(SALON);
  });

  it("sans URI connue : par le type stocké", async () => {
    await expect(urlDeReprogrammation({ typeRendezVous: "diagnostic" })).resolves.toBe(DIAG);
    await expect(urlDeReprogrammation({ typeRendezVous: "echange_projet" })).resolves.toBe(PROJET);
    await expect(urlDeReprogrammation({ typeRendezVous: "apporteur" })).resolves.toBe(APPORTEUR);
  });

  it("sans type stocké : par le nom", async () => {
    await expect(urlDeReprogrammation({ eventTypeName: "Diagnostic IA" })).resolves.toBe(DIAG);
    await expect(urlDeReprogrammation({ eventTypeName: "Échange projet" })).resolves.toBe(PROJET);
  });

  it("un diagnostic dont le type a disparu se reprogramme sur le type appel", async () => {
    listerMock.mockResolvedValue({ types: COMPTE_SANS_DIAGNOSTIC });
    await expect(
      urlDeReprogrammation({ eventTypeUri: URI_DIAG, typeRendezVous: "diagnostic" }),
    ).resolves.toBe(PROJET);
  });

  it("rien de lisible : le type appel, comme avant", async () => {
    await expect(urlDeReprogrammation({})).resolves.toBe(PROJET);
  });
});

describe("`utm_content` mesure le bouton", () => {
  it("le choix seul, ou le choix et l'emplacement", () => {
    expect(utmContentDuChoix("diagnostic")).toBe("diagnostic");
    expect(utmContentDuChoix("projet", null)).toBe("projet");
    expect(utmContentDuChoix("diagnostic", "accueil-hero")).toBe("diagnostic:accueil-hero");
  });

  it("un emplacement exotique est ignoré, jamais recopié", () => {
    expect(lireDepuis("Accueil-Hero")).toBe("accueil-hero");
    for (const v of ["", "a b", "<script>", "a:b", "-x", "x".repeat(61), 4]) {
      expect(lireDepuis(v)).toBeNull();
    }
    expect(utmContentDuChoix("projet", "a b")).toBe("projet");
  });

  it("les paramètres internes recopient le choix et l'emplacement", () => {
    expect(parametresDuChoix("projet")).toBe("rdv=projet");
    expect(parametresDuChoix("diagnostic", "accueil-hero")).toBe(
      "rdv=diagnostic&depuis=accueil-hero",
    );
  });

  it("l'URL Calendly porte `utm_content`, le reste intact", () => {
    const u = new URL(avecUtmContent(`${DIAG}?hide_gdpr_banner=1`, "diagnostic:faq"));
    expect(u.searchParams.get("utm_content")).toBe("diagnostic:faq");
    expect(u.searchParams.get("hide_gdpr_banner")).toBe("1");
    expect(avecUtmContent(DIAG, null)).toBe(DIAG);
  });
});

describe("🔴 le formulaire maison envoie `utm_content` à Calendly", () => {
  const base = {
    eventTypeUri: URI_DIAG,
    debut: new Date("2026-10-20T08:00:00Z"),
    nom: "Jeanne Test",
    email: "jeanne@example.com",
    fuseau: "Europe/Paris",
    format: "visio" as const,
  };

  it("le bouton voyage dans le `tracking` de la réservation", () => {
    const c = corpsDeLaDemande({ ...base, utmContent: "diagnostic:accueil-hero" });
    const tracking = c["tracking"] as Record<string, unknown>;
    expect(tracking["utm_content"]).toBe("diagnostic:accueil-hero");
    // Tout ou rien : les six champs partent toujours.
    expect(Object.keys(tracking)).toHaveLength(6);
  });

  it("sans bouton connu : `null`, comme avant", () => {
    const tracking = corpsDeLaDemande(base)["tracking"] as Record<string, unknown>;
    expect(tracking["utm_content"]).toBeNull();
  });

  it("le lien vers le formulaire recopie le choix", () => {
    expect(urlDuFormulaire("fr", "2026-10-20T08:00:00.000Z")).toBe(
      "/fr/appel/reserver?debut=2026-10-20T08%3A00%3A00.000Z",
    );
    expect(
      urlDuFormulaire("fr", "2026-10-20T08:00:00.000Z", parametresDuChoix("diagnostic", "faq")),
    ).toBe("/fr/appel/reserver?debut=2026-10-20T08%3A00%3A00.000Z&rdv=diagnostic&depuis=faq");
  });
});
