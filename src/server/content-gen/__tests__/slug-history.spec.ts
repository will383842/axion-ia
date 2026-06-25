/**
 * Tests recordSlugChange — SSOT slug-history (fiabilité publication P1 2026-06-25).
 *
 * Couvre :
 *  1. no-op si oldSlug === newSlug (aucun rename réel).
 *  2. no-op si oldSlug vide.
 *  3. upsert idempotent sur (oldLocale, oldSlug) quand rename réel.
 *  4. injecte `reason` quand fourni, l'omet sinon.
 *  5. accepte un client `tx` injecté (exécution intra-transaction).
 */

import { describe, it, expect, vi } from "vitest";
import { recordSlugChange } from "../slug-history";

type UpsertArg = {
  where: unknown;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function makeClient() {
  const upsert = vi.fn(async (_arg: UpsertArg) => ({}));
  return { client: { articleSlugHistory: { upsert } }, upsert };
}

describe("recordSlugChange", () => {
  it("no-op si oldSlug === newSlug", async () => {
    const { client, upsert } = makeClient();
    await recordSlugChange(
      { articleId: "a1", oldSlug: "same", newSlug: "same", locale: "fr" },
      client as never,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("no-op si oldSlug vide", async () => {
    const { client, upsert } = makeClient();
    await recordSlugChange(
      { articleId: "a1", oldSlug: "", newSlug: "nouveau-slug", locale: "fr" },
      client as never,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upsert sur la clé (oldLocale, oldSlug) quand rename réel", async () => {
    const { client, upsert } = makeClient();
    await recordSlugChange(
      {
        articleId: "a1",
        oldSlug: "ancien-slug",
        newSlug: "nouveau-slug",
        locale: "fr",
        reason: "refresh_regen:job-1",
      },
      client as never,
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]![0];
    expect(arg.where).toEqual({ oldLocale_oldSlug: { oldLocale: "fr", oldSlug: "ancien-slug" } });
    expect(arg.create).toMatchObject({
      articleId: "a1",
      oldSlug: "ancien-slug",
      oldLocale: "fr",
      reason: "refresh_regen:job-1",
    });
    expect(arg.update).toMatchObject({ articleId: "a1", reason: "refresh_regen:job-1" });
  });

  it("omet `reason` quand non fourni (create + update)", async () => {
    const { client, upsert } = makeClient();
    await recordSlugChange(
      { articleId: "a1", oldSlug: "ancien", newSlug: "neuf", locale: "en" },
      client as never,
    );
    const arg = upsert.mock.calls[0]![0];
    expect("reason" in arg.create).toBe(false);
    expect("reason" in arg.update).toBe(false);
  });

  it("est idempotent (même clé) sur ré-appel — upsert absorbe le doublon", async () => {
    const { client, upsert } = makeClient();
    const input = {
      articleId: "a1",
      oldSlug: "ancien",
      newSlug: "neuf",
      locale: "fr" as const,
    };
    await recordSlugChange(input, client as never);
    await recordSlugChange(input, client as never);
    expect(upsert).toHaveBeenCalledTimes(2);
    // Les deux appels ciblent la MÊME clé naturelle → la 2e fois = update no-op DB.
    const k1 = upsert.mock.calls[0]![0].where;
    const k2 = upsert.mock.calls[1]![0].where;
    expect(k1).toEqual(k2);
  });
});
