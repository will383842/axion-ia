import { describe, it, expect, vi } from "vitest";
import {
  equipeEditorialeActive,
  estRouteInterneConnue,
  verifierLienInterne,
  verifierLienExterne,
  filtrerLiensMaillage,
} from "./maillage";

const rep = (status: number) => new Response(null, { status });

describe("liens internes", () => {
  it("accepte une route connue et une route dynamique", () => {
    expect(estRouteInterneConnue("/journee-ia")).toBe(true);
    expect(estRouteInterneConnue("/fr/blog/mon-article?x=1")).toBe(true);
  });
  it("refuse une route inconnue", () => {
    expect(verifierLienInterne("/page-qui-nexiste-pas")).toEqual({
      ok: false,
      raison: "route-inconnue",
    });
    expect(estRouteInterneConnue("//evil.com")).toBe(false);
  });
});

describe("liens externes (réseau simulé)", () => {
  it("accepte un 200 en HEAD", async () => {
    const f = vi.fn().mockResolvedValue(rep(200));
    expect((await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f })).ok).toBe(true);
    expect(f.mock.calls[0]![1].method).toBe("HEAD");
  });
  it("replie sur GET quand HEAD est refusé", async () => {
    const f = vi.fn().mockResolvedValueOnce(rep(405)).mockResolvedValueOnce(rep(200));
    expect((await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f })).ok).toBe(true);
    expect(f.mock.calls[1]![1].method).toBe("GET");
  });
  it("refuse une redirection", async () => {
    const f = vi.fn().mockResolvedValue(rep(301));
    expect(await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f })).toEqual({
      ok: false,
      raison: "redirection",
    });
  });
  it("refuse un code ≠ 200", async () => {
    const f = vi.fn().mockResolvedValue(rep(404));
    expect((await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f })).raison).toBe(
      "code-404",
    );
  });
  it("refuse une source de niveau faible sans appeler le réseau", async () => {
    const f = vi.fn();
    const v = await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f, niveau: "low" });
    expect(v).toEqual({ ok: false, raison: "source-faible" });
    expect(f).not.toHaveBeenCalled();
  });
  it("refuse un hôte local et un domaine exclu", async () => {
    const f = vi.fn();
    expect((await verifierLienExterne("http://127.0.0.1/x", { fetchImpl: f })).ok).toBe(false);
    expect((await verifierLienExterne("https://reddit.com/x", { fetchImpl: f })).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("refuse http, port non standard, hôte sans point, point final", async () => {
    const f = vi.fn();
    for (const u of [
      "http://exemple.fr/",
      "https://exemple.fr:8443/",
      "https://redis/",
      "https://localhost./",
      "https://old.reddit.com/x",
    ]) {
      expect((await verifierLienExterne(u, { fetchImpl: f })).ok).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("refuse une redirection renvoyée par le GET de repli", async () => {
    const f = vi.fn().mockResolvedValueOnce(rep(403)).mockResolvedValueOnce(rep(302));
    expect((await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f })).raison).toBe(
      "redirection",
    );
  });
  it("refuse /en/… et les contre-obliques", () => {
    expect(estRouteInterneConnue("/en/blog/x")).toBe(false);
    expect(estRouteInterneConnue("/\\evil.com")).toBe(false);
  });
  it("refuse un lien injoignable (délai dépassé)", async () => {
    const f = vi.fn().mockRejectedValue(new Error("abort"));
    expect((await verifierLienExterne("https://exemple.fr/a", { fetchImpl: f })).raison).toBe(
      "injoignable",
    );
  });
});

describe("interrupteur CONTENT_EQUIPE_EDITORIALE", () => {
  it("n'est actif que pour la valeur exacte true", () => {
    expect(equipeEditorialeActive({})).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "1" })).toBe(false);
    expect(equipeEditorialeActive({ CONTENT_EQUIPE_EDITORIALE: "true" })).toBe(true);
  });
  it("éteint : liens rendus tels quels, aucun réseau", async () => {
    const f = vi.fn();
    const out = await filtrerLiensMaillage([{ url: "/inconnue" }, { url: "https://a.fr/x" }], {
      env: {},
      fetchImpl: f,
    });
    expect(out.every((l) => l.verdict.ok)).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
  it("allumé : route inconnue refusée", async () => {
    const out = await filtrerLiensMaillage([{ url: "/inconnue" }], {
      env: { CONTENT_EQUIPE_EDITORIALE: "true" },
    });
    expect(out[0]!.verdict.ok).toBe(false);
  });
});
