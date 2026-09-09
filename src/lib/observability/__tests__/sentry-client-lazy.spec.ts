/**
 * Une erreur de frontière atteint Sentry SANS attendre l'inactivité du fil.
 *
 * 🔴 LE DÉFAUT GARDÉ ICI EST UNE ABSENCE, PAS UNE ERREUR.
 *
 * `instrumentation-client.ts` diffère `Sentry.init()` à `requestIdleCallback`
 * (repli 3 s) pour tenir le budget Web Vitals. Une erreur d'HYDRATATION vit
 * dans cette fenêtre, et `captureException` sans client attaché ne lève pas :
 * elle abandonne l'événement en silence. Trois frontières React étaient donc
 * muettes, dont `[adminPrefix]/error.tsx` qui appelait pourtant Sentry depuis
 * mai 2026 — l'instrumentation paraissait en place.
 *
 * 🔑 Le cas décisif est le PREMIER : il n'ordonnance aucune inactivité, exprès.
 * Si la capture attendait `requestIdleCallback`, ce test resterait sans
 * événement — c'est exactement ce que la production faisait.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captures: Array<{ error: unknown; contexte: unknown }> = [];
const initsAppeles: unknown[] = [];

vi.mock("@sentry/nextjs", () => ({
  init: (options: unknown) => {
    initsAppeles.push(options);
  },
  captureException: (error: unknown, contexte: unknown) => {
    captures.push({ error, contexte });
  },
  dedupeIntegration: () => ({ name: "dedupe" }),
  inboundFiltersIntegration: () => ({ name: "inboundFilters" }),
  functionToStringIntegration: () => ({ name: "functionToString" }),
  linkedErrorsIntegration: () => ({ name: "linkedErrors" }),
  globalHandlersIntegration: () => ({ name: "globalHandlers" }),
  httpContextIntegration: () => ({ name: "httpContext" }),
  setTag: () => undefined,
  captureRouterTransitionStart: () => undefined,
}));

describe("capturerErreurDeFrontiere", () => {
  beforeEach(() => {
    captures.length = 0;
    initsAppeles.length = 0;
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://cle@o0.ingest.sentry.io/1");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("initialise le SDK ELLE-MÊME et émet, sans qu'aucune inactivité ait été ordonnancée", async () => {
    const { capturerErreurDeFrontiere } = await import("../sentry-client-lazy");

    await capturerErreurDeFrontiere(
      Object.assign(new Error("Hydration failed"), { digest: "abc123" }),
      "global-error",
    );

    expect(
      initsAppeles,
      "le SDK n'a pas été initialisé : la capture attend donc encore l'inactivité du fil " +
        "principal, et l'événement est abandonné en silence — le défaut d'origine",
    ).toHaveLength(1);
    expect(captures).toHaveLength(1);
    expect((captures[0]?.error as Error).message).toBe("Hydration failed");
  });

  it("étiquette l'événement avec la frontière qui a rattrapé, et le digest", async () => {
    const { capturerErreurDeFrontiere } = await import("../sentry-client-lazy");

    await capturerErreurDeFrontiere(
      Object.assign(new Error("boum"), { digest: "d-42" }),
      "admin-error",
    );

    const contexte = captures[0]?.contexte as {
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
    };
    expect(
      contexte?.tags?.["boundary"],
      "sans cette étiquette, on ne peut pas distinguer dans Sentry une erreur de rendu " +
        "serveur d'un échec d'hydratation : les trois frontières se ressemblent",
    ).toBe("admin-error");
    expect(contexte?.extra?.["digest"]).toBe("d-42");
  });

  it("n'initialise rien quand aucun DSN n'est configuré, et ne jette pas", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { capturerErreurDeFrontiere } = await import("../sentry-client-lazy");

    await expect(
      capturerErreurDeFrontiere(new Error("dev"), "locale-error"),
    ).resolves.toBeUndefined();

    expect(initsAppeles).toHaveLength(0);
    expect(captures).toHaveLength(0);
  });

  it("loge dans la console AVANT tout await — seul signal disponible sans DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { capturerErreurDeFrontiere } = await import("../sentry-client-lazy");
    const espion = console.error as unknown as ReturnType<typeof vi.fn>;

    void capturerErreurDeFrontiere(new Error("visible tout de suite"), "locale-error");

    // Aucun `await` ici : le log doit déjà être parti.
    expect(espion).toHaveBeenCalledWith("[locale-error]", expect.any(Error));
  });

  it("ne charge le SDK qu'UNE fois pour plusieurs erreurs successives", async () => {
    const { capturerErreurDeFrontiere } = await import("../sentry-client-lazy");

    await Promise.all([
      capturerErreurDeFrontiere(new Error("une"), "global-error"),
      capturerErreurDeFrontiere(new Error("deux"), "global-error"),
    ]);

    expect(initsAppeles).toHaveLength(1);
    expect(captures).toHaveLength(2);
  });
});
