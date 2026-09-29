// @vitest-environment node
/**
 * ⛔ Une fusion s'écrit vers Axion Partners par la file EXISTANTE
 * (`ecrireEvenementPartners`, #1180) avec le constructeur du contrat
 * (`payloadClientFusionne`), dans la transaction de la fusion — correction
 * anti-doublon D3 : ni événement maison, ni file de rejeu maison.
 *
 * Le contrat publié est simulé ici avec `client.fusionne` DEDANS (c'est la
 * copie v2 de #1223) : sans lui la file refuse ce type, et la fusion n'écrit
 * alors RIEN (cas couvert par `une-fusion-defaite-n-est-jamais-rejouee-…`).
 *
 * Mutation qui fait rougir : retirer l'appel à `emettreFusionVersPartners`
 * dans `fusionnerFiches` → aucune ligne dans la file.
 * Contre-témoin : canal fermé (`PARTNERS_SYNC_ENABLED` absent) → aucune ligne,
 * `emiseVersPartnersLe` reste nul (inertie totale).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { BaseTransactionnelle } from "../base";
import { defaireFusion, ErreurDefaireFusion } from "../defaire-fusion";
import { fusionnerFiches } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

vi.mock("@/server/partners/contrat", async (importOriginal) => {
  const vrai = await importOriginal<Record<string, unknown>>();
  const types = [...(vrai["TYPES_EVENEMENT"] as readonly string[]), "client.fusionne"];
  const dedans = (t: string) => types.includes(t);
  return {
    ...vrai,
    TYPES_EVENEMENT: types,
    estDansLeContratV1: dedans,
    estDansLeContrat: dedans,
  };
});

/**
 * La base en mémoire expose `$transaction` jusque dans la transaction ; la
 * file exige un client de transaction qui n'en a pas. On le masque.
 */
function sansTransactionImbriquee(client: {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
}): BaseTransactionnelle {
  return {
    $transaction: (fn) =>
      client.$transaction((tx) =>
        fn(
          new Proxy(tx as object, {
            has: (cible, cle) => cle !== "$transaction" && Reflect.has(cible, cle),
          }) as never,
        ),
      ),
  } as BaseTransactionnelle;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("⛔ une fusion s'écrit dans la file Partners existante", () => {
  it("canal ouvert : UNE ligne client.fusionne, survivant = absorbante", async () => {
    vi.stubEnv("PARTNERS_SYNC_ENABLED", "true");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/test");
    const s = sceneFusion();
    const r = await fusionnerFiches(sansTransactionImbriquee(s.base.client), {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    const file = s.base.tables["partnersSyncOutbox"] ?? [];
    expect(file).toHaveLength(1);
    expect(file[0]).toMatchObject({
      eventType: "client.fusionne",
      subjectRef: `client:${s.absorbanteId}`,
    });
    const corps = JSON.parse(String(file[0]?.["corps"])) as Record<string, unknown>;
    expect(corps["event_type"]).toBe("client.fusionne");
    expect(corps["payload"]).toEqual({ survivorId: s.absorbanteId, absorbedId: s.absorbeeId });

    const f = s.base.tables["clientFusion"]?.[0];
    expect(f?.["id"]).toBe(r.fusionId);
    expect(f?.["emiseVersPartnersLe"]).toBeInstanceOf(Date);

    // Le contrat n'a aucun événement « fusion défaite » : une fusion transmise
    // ne se défait pas depuis la console, et rien de plus n'est écrit.
    await expect(
      defaireFusion(s.base.client as never, {
        fusionId: r.fusionId,
        motif: "Deux entreprises distinctes, vérifié.",
        parAdminId: ADMIN,
      }),
    ).rejects.toBeInstanceOf(ErreurDefaireFusion);
    expect(s.base.tables["partnersSyncOutbox"]).toHaveLength(1);
  });

  it("🔑 CONTRE-TÉMOIN : canal fermé, aucune ligne et emiseVersPartnersLe reste nul", async () => {
    vi.stubEnv("PARTNERS_SYNC_ENABLED", "");
    const s = sceneFusion();
    await fusionnerFiches(sansTransactionImbriquee(s.base.client), {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    expect(s.base.tables["partnersSyncOutbox"] ?? []).toHaveLength(0);
    expect(s.base.tables["clientFusion"]?.[0]?.["emiseVersPartnersLe"]).toBeNull();
    expect(
      s.base.tables["clientFusionElement"]?.map((e) => `${e["type"]}:${e["elementId"]}`).sort(),
    ).toEqual(
      [`contact:${s.contactId}`, `projet:${s.projetId}`, `rencontre:${s.rencontreId}`].sort(),
    );
  });
});
