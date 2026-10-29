// @vitest-environment node

/**
 * L'action de la mini-demande : le leurre, la limite, la validation, l'enregistrement, la
 * redirection — et ce qu'elle n'importe JAMAIS (e-mail, notification, cookies).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lireJetonDemande } from "@/features/tour-de-france/jeton-demande";

const mocks = vi.hoisted(() => ({
  enregistrerDemande: vi.fn(),
  checkRateLimit: vi.fn(),
  signalerHoneypot: vi.fn(),
  revalidatePath: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn((..._a: unknown[]) => undefined),
  attendre: vi.fn(async (..._a: unknown[]) => {}),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));
vi.mock("../attente", () => ({ attendreDureeMinimale: mocks.attendre }));
vi.mock("@/features/tour-de-france/enregistrer", () => ({
  enregistrerDemande: mocks.enregistrerDemande,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/security/honeypot-observable", () => ({
  signalerHoneypot: mocks.signalerHoneypot,
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import { envoyerDemandeTour } from "../actions";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-0a1b2c3d4e5f";

function formulaire(surcharge: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    nom: "Claire Martin",
    email: "Claire@Exemple.fr",
    ville: "Lyon",
    depuis: "tdf-heros",
    utm_source: "facebook",
    utm_campaign: "tour-ia",
    website: "",
    ...surcharge,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

/** L'adresse vers laquelle l'action a redirigé. */
async function destination(fd: FormData): Promise<URL> {
  try {
    await envoyerDemandeTour(fd);
  } catch (e) {
    const m = /^REDIRECT:(.+)$/.exec((e as Error).message);
    if (m?.[1]) return new URL(m[1], "https://axion-ia.com");
    throw e;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, panne: false });
  mocks.enregistrerDemande.mockResolvedValue({ id: ID, compte: true, rattachement: "a_verifier" });
});

describe("la mini-demande du Tour", () => {
  it("leurre rempli : trace, redirection normale vers la visio, RIEN d'enregistré", async () => {
    const url = await destination(formulaire({ website: "https://robot.example" }));
    expect(mocks.signalerHoneypot).toHaveBeenCalledWith("tour-demande", "https://robot.example");
    expect(mocks.enregistrerDemande).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(url.pathname).toBe("/fr/appel/tour-france-ia");
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
    expect(url.searchParams.get("j")).toBeNull();
  });

  it("trop de demandes (ou compteur en panne) : ?erreur=trop, rien d'enregistré", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, panne: false });
    const url = await destination(formulaire());
    expect(url.pathname).toBe("/tour-france-ia/demande");
    expect(url.searchParams.get("erreur")).toBe("trop");
    expect(mocks.enregistrerDemande).not.toHaveBeenCalled();
    expect(mocks.attendre).toHaveBeenCalledTimes(1);
  });

  it("Redis en panne : la limite est demandée en mode « refuser », et le refus tient", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, panne: true });
    const url = await destination(formulaire());
    expect(url.searchParams.get("erreur")).toBe("trop");
    expect(mocks.attendre).toHaveBeenCalledTimes(1);
    const [cle, config] = mocks.checkRateLimit.mock.calls[0] as [
      string,
      { limit: number; windowSec: number; surPanne: string },
    ];
    expect(cle).toMatch(/^tour-demande:/);
    expect(cle).not.toContain("203.0.113.7");
    expect(config).toMatchObject({ limit: 10, windowSec: 3600, surPanne: "refuser" });
  });

  it.each([
    ["nom vide", { nom: "  " }],
    ["nom trop long", { nom: "x".repeat(81) }],
    ["e-mail faux", { email: "pas-un-email" }],
    ["ville vide", { ville: "" }],
  ])("%s : ?erreur=champs, aucune donnée dans l'adresse", async (_nom, surcharge) => {
    const url = await destination(formulaire(surcharge));
    expect(url.pathname).toBe("/tour-france-ia/demande");
    expect(url.searchParams.get("erreur")).toBe("champs");
    expect(url.search).not.toMatch(/Claire|Exemple|Lyon|0612|06%2012/);
    expect(mocks.enregistrerDemande).not.toHaveBeenCalled();
    expect(mocks.attendre).toHaveBeenCalledTimes(1);
  });

  it("succès : enregistre, signe un jeton, redirige avec depuis, utm et j", async () => {
    const url = await destination(formulaire());
    expect(mocks.enregistrerDemande).toHaveBeenCalledTimes(1);
    expect(mocks.enregistrerDemande.mock.calls[0]?.[0]).toMatchObject({
      nom: "Claire Martin",
      email: "claire@exemple.fr",
      ville: "Lyon",
      depuis: "tdf-heros",
      utmSource: "facebook",
      utmCampaign: "tour-ia",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/tour-france-ia");
    expect(url.pathname).toBe("/fr/appel/tour-france-ia");
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_campaign")).toBe("tour-ia");
    expect(lireJetonDemande(url.searchParams.get("j"))).toEqual({ id: ID });
    // Ni le nom ni l'adresse ne voyagent dans l'adresse.
    expect(url.search).not.toMatch(/Claire|exemple|0612|06%2012/i);
  });

  it("un téléphone posté par une ancienne page est ignoré et n'est jamais transmis", async () => {
    const url = await destination(formulaire({ telephone: "06 12 34 56 78" }));
    expect(url.searchParams.get("erreur")).toBeNull();
    expect(mocks.enregistrerDemande).toHaveBeenCalledTimes(1);
    const transmis = mocks.enregistrerDemande.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(transmis).not.toHaveProperty("telephone");
    expect(JSON.stringify(transmis)).not.toMatch(/0612|06 12/);
  });

  it("anti-oracle : un doublon et une première demande reçoivent la même réponse", async () => {
    const premiere = await destination(formulaire());
    mocks.enregistrerDemande.mockResolvedValue({ id: ID, compte: false, rattachement: "fiche" });
    const doublon = await destination(formulaire());
    expect(doublon.pathname).toBe(premiere.pathname);
    expect([...doublon.searchParams.keys()]).toEqual([...premiere.searchParams.keys()]);
  });

  it("base en panne : signalée à Sentry, la personne va quand même à la visio (sans jeton)", async () => {
    mocks.enregistrerDemande.mockRejectedValue(new Error("base injoignable"));
    const url = await destination(formulaire());
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(url.pathname).toBe("/fr/appel/tour-france-ia");
    expect(url.searchParams.get("depuis")).toBe("tdf-heros");
    expect(url.searchParams.get("j")).toBeNull();
    expect(mocks.attendre).toHaveBeenCalledTimes(1);
  });

  it("adresse connue ou neuve : même redirection, après la même attente minimale", async () => {
    const neuve = await destination(formulaire());
    mocks.enregistrerDemande.mockResolvedValue({ id: ID, compte: false, rattachement: "fiche" });
    const connue = await destination(formulaire());
    expect(connue.pathname).toBe(neuve.pathname);
    expect([...connue.searchParams.keys()]).toEqual([...neuve.searchParams.keys()]);
    expect(mocks.attendre).toHaveBeenCalledTimes(2);
    expect(mocks.attendre.mock.calls[0]?.[0]).toEqual(expect.any(Number));
  });

  it("IP_HASH_SALT manquant en production : signalé à Sentry, une seule fois par processus", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IP_HASH_SALT", "");
    delete process.env.IP_HASH_SALT;
    try {
      await destination(formulaire());
      await destination(formulaire());
    } finally {
      vi.unstubAllEnvs();
    }
    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
    expect(mocks.captureMessage.mock.calls[0]?.[0]).toMatch(/IP_HASH_SALT/);
  });

  it("une valeur de suivi non conforme est abandonnée, jamais recopiée", async () => {
    const url = await destination(formulaire({ depuis: "Pas Valide!", utm_source: "a b" }));
    expect(url.searchParams.get("depuis")).toBeNull();
    expect(url.searchParams.get("utm_source")).toBeNull();
  });
});

describe("ce que l'action n'importe jamais", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/tour-france-ia/demande/actions.ts"),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");

  it("aucun e-mail, aucune notification, aucun cookie", () => {
    for (const i of imports) expect(i, i).not.toMatch(/email(?!-hash)|notif|queue|cookies/i);
    expect(source).not.toMatch(/enqueueEmail|notify\(|cookies\(\)/);
  });

  it("n'exporte que des fonctions asynchrones, et redirect reste hors du try", () => {
    const exportees = [...source.matchAll(/^export\s+.*$/gm)].map((m) => m[0]);
    expect(exportees).toEqual([
      "export async function envoyerDemandeTour(formData: FormData): Promise<void> {",
    ]);
    const bloc = /let jeton[\s\S]*?\n {2}\}\n/.exec(source)?.[0] ?? "";
    expect(bloc).toContain("enregistrerDemande(");
    expect(bloc).not.toContain("redirect(");
  });
});
