/**
 * Conversions en `UnrecoverableError` du chemin Claude (constats A-I3 / I2) et
 * garde statique sur `reservationId` (S-M2). Chiffres et valeurs fictifs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { UnrecoverableError } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/server/content-gen/config-store", () => ({
  persistContentGenConfig: vi.fn(),
  readKillSwitchFailSafe: vi.fn().mockResolvedValue({ active: false }),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }));

import { ProviderError } from "@/server/content-gen/providers/IProvider";
import { BlogClaudeRefusError } from "@/server/content-gen/providers/blog-claude";
import { erreurNonRelancableCheminClaude } from "@/server/queue/workers/content-gen-worker";
import { erreurJugeNonRelancableCheminClaude } from "@/server/queue/workers/content-quality-improver-worker";

afterEach(() => vi.unstubAllEnvs());

const claude = () => new ProviderError("boum", "down", "anthropic", true);
const openai = () => new ProviderError("boum", "down", "openai", true);

describe("worker de génération : conversion du chemin Claude", () => {
  it("allumé + type blog + erreur Anthropic => UnrecoverableError (même message)", () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    const r = erreurNonRelancableCheminClaude(claude(), "blog_article");
    expect(r).toBeInstanceOf(UnrecoverableError);
    expect(r?.message).toBe("boum");
  });
  it("éteint => aucune conversion (erreur d'origine inchangée)", () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "");
    expect(erreurNonRelancableCheminClaude(claude(), "blog_article")).toBeNull();
  });
  it("allumé mais erreur OpenAI, ou autre type de contenu => aucune conversion", () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    expect(erreurNonRelancableCheminClaude(openai(), "blog_article")).toBeNull();
    expect(erreurNonRelancableCheminClaude(claude(), "landing_ville")).toBeNull();
    expect(erreurNonRelancableCheminClaude(new Error("x"), "blog_article")).toBeNull();
  });
});

describe("worker de génération : types autorisés (CONTENT_GEN_CLAUDE_TYPES)", () => {
  it("`tous` : une erreur Anthropic sur un type hors blog => UnrecoverableError", () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    const r = erreurNonRelancableCheminClaude(claude(), "landing_ville");
    expect(r).toBeInstanceOf(UnrecoverableError);
  });
  it("liste : seul un type listé est converti ; un autre garde l'erreur d'origine", () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "landing_ville");
    expect(erreurNonRelancableCheminClaude(claude(), "landing_ville")).toBeInstanceOf(
      UnrecoverableError,
    );
    expect(erreurNonRelancableCheminClaude(claude(), "comparison")).toBeNull();
  });
  it("un refus de plafond (BlogClaudeRefusError) est déjà non relançable, sur tout type autorisé", () => {
    const refus = new BlogClaudeRefusError("plafond", "plafond_mois");
    expect(refus).toBeInstanceOf(UnrecoverableError);
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    vi.stubEnv("CONTENT_GEN_CLAUDE_TYPES", "tous");
    // Déjà UnrecoverableError : aucune conversion, l'erreur d'origine est relancée telle quelle.
    expect(erreurNonRelancableCheminClaude(refus, "landing_ville")).toBeNull();
  });
});

describe("worker d'amélioration (juge) : conversion du chemin Claude", () => {
  it("allumé + blog + erreur Anthropic ou refus de la porte => UnrecoverableError", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    expect(await erreurJugeNonRelancableCheminClaude(claude(), "blog_article")).toBeInstanceOf(
      UnrecoverableError,
    );
    const refus = new BlogClaudeRefusError("plafond", "plafond_jour");
    expect(await erreurJugeNonRelancableCheminClaude(refus, "blog_from_title")).toBe(refus);
  });
  it("éteint, ou erreur OpenAI => erreur d'origine inchangée (null)", async () => {
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "");
    expect(await erreurJugeNonRelancableCheminClaude(claude(), "blog_article")).toBeNull();
    vi.stubEnv("CONTENT_GEN_BLOG_CLAUDE", "true");
    expect(await erreurJugeNonRelancableCheminClaude(openai(), "blog_article")).toBeNull();
    expect(await erreurJugeNonRelancableCheminClaude(claude(), "landing_ville")).toBeNull();
  });
});

describe("S-M2 : `reservationId` est réservé à la porte blog-claude", () => {
  const racine = join(process.cwd(), "src", "server", "content-gen", "generators");
  function fichiers(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? fichiers(join(dir, e.name))
        : e.name.endsWith(".ts") && !e.name.endsWith(".spec.ts")
          ? [join(dir, e.name)]
          : [],
    );
  }
  it("aucun fichier de generators/ ne mentionne reservationId", () => {
    const liste = fichiers(racine);
    expect(liste.length).toBeGreaterThan(0);
    const fautifs = liste.filter((f) => /reservationId/.test(readFileSync(f, "utf-8")));
    expect(fautifs).toEqual([]);
  });
});
