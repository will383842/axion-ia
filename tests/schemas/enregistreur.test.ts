/**
 * Contrat de l'enregistreur (v1) — exigé par `pnpm zod:check`.
 *
 * Un message valide passe ; un champ en trop est ignoré (évolution par ajout) ;
 * un champ manquant, une valeur hors énumération ou un identifiant forgé est
 * refusé.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  BattementAppareil,
  CreerSession,
  DeclarerAccord,
  FinSession,
  FinTranche,
  construireContrat,
  texteDuContrat,
  VERSION_CONTRAT_ENREGISTREUR,
  versJsonSchema,
} from "@/lib/schemas/enregistreur";

const UUID = "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b";
const T = "2026-10-06T08:00:00.000Z";

describe("contrat de l'enregistreur (v1)", () => {
  it("CreerSession : valide, champ en plus ignoré, nature et identifiants contrôlés", () => {
    const ok = {
      cleClient: UUID,
      rencontreId: UUID,
      nature: "visio",
      versionExtension: "1.0.0",
      debutLe: T,
      accordLocalLe: null,
      nbParticipants: 2,
    };
    expect(CreerSession.safeParse(ok).success).toBe(true);
    const plus = CreerSession.safeParse({ ...ok, champFutur: "x" });
    expect(plus.success).toBe(true);
    expect(plus.success && "champFutur" in plus.data).toBe(false);
    expect(CreerSession.safeParse({ ...ok, nature: "telephone" }).success).toBe(false);
    expect(CreerSession.safeParse({ ...ok, rencontreId: "../x" }).success).toBe(false);
    expect(CreerSession.safeParse({ ...ok, debutLe: "hier" }).success).toBe(false);
  });

  it("DeclarerAccord : au moins un participant, version du texte bornée", () => {
    const ok = {
      accordLe: T,
      nbParticipants: 2,
      versionTexte: "annonce-v1",
      nouvellePersonne: false,
    };
    expect(DeclarerAccord.safeParse(ok).success).toBe(true);
    expect(DeclarerAccord.safeParse({ ...ok, nbParticipants: 0 }).success).toBe(false);
    expect(DeclarerAccord.safeParse({ ...ok, versionTexte: "x".repeat(65) }).success).toBe(false);
  });

  it("FinTranche : empreinte SHA-256 en minuscules, piste connue", () => {
    const ok = {
      piste: "client",
      numero: 0,
      motifDebut: "demarrage",
      debutCaptureEpochMs: 1,
      nbMorceaux: 18,
      empreinte: "a".repeat(64),
      dureeMs: 180_000,
      finMuette: false,
    };
    expect(FinTranche.safeParse(ok).success).toBe(true);
    expect(FinTranche.safeParse({ ...ok, empreinte: "A".repeat(64) }).success).toBe(false);
    expect(FinTranche.safeParse({ ...ok, piste: "salle" }).success).toBe(false);
  });

  it("FinSession : motif connu, journal sans champ libre de parole", () => {
    const ok = { finLe: T, motif: "manuel", perdus: [], fenetresHorsAccord: [], evenements: [] };
    expect(FinSession.safeParse(ok).success).toBe(true);
    expect(FinSession.safeParse({ ...ok, motif: "autre" }).success).toBe(false);
    expect(
      FinSession.safeParse({ ...ok, evenements: [{ le: T, type: "x".repeat(41) }] }).success,
    ).toBe(false);
  });

  it("BattementAppareil : aucun champ de texte libre au-delà des versions", () => {
    const ok = {
      versionExtension: "1.0.0",
      versionContrat: 1,
      fileEnAttente: 0,
      agePlusVieuxMs: null,
      sessionActive: false,
    };
    expect(BattementAppareil.safeParse(ok).success).toBe(true);
    expect(BattementAppareil.safeParse({ ...ok, fileEnAttente: -1 }).success).toBe(false);
  });

  it("le contrat publié est déterministe et porte sa version", () => {
    expect(texteDuContrat()).toBe(texteDuContrat());
    const c = construireContrat();
    expect(c["version"]).toBe(VERSION_CONTRAT_ENREGISTREUR);
    expect(Object.keys(c["schemas"] as object)).toContain("CreerSession");
  });

  it("le JSON Schema publié traduit fidèlement le Zod, et refuse ce qu'il ne sait pas traduire", () => {
    const js = versJsonSchema(CreerSession) as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, Record<string, unknown>>;
    };
    expect(js.additionalProperties).toBe(false);
    expect(js.required).toContain("cleClient");
    expect(js.properties["cleClient"]).toEqual({ type: "string", format: "uuid" });
    expect(js.properties["accordLocalLe"]).toEqual({
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    });
    expect(js.properties["nature"]).toEqual({ type: "string", enum: ["visio", "dictee"] });
    expect(js.properties["nbParticipants"]).toEqual({
      anyOf: [{ type: "integer", minimum: 1, maximum: 50 }, { type: "null" }],
    });
    expect(versJsonSchema(z.object({ a: z.string().optional() }))).toMatchObject({ required: [] });
    expect(() => versJsonSchema(z.date())).toThrow(/non couvert/);
    expect(() => versJsonSchema(z.string().email())).toThrow(/non couverte/);
  });
});
