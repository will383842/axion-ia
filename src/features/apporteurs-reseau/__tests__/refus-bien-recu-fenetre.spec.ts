// #2464 point 2 : une présentation ACTIVE (réservée) d'un autre apporteur ne sort jamais de la fenêtre de
// lecture de « Bien reçu », même quand le SIREN a plus de 20 présentations terminées.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  envoyes: [] as Array<Record<string, unknown>>,
}));

vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    lireAAttribuerEnAttente: async () => [],
    ouvrirAAttribuer: vi.fn(async () => true),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (v: string) => v }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));
vi.mock("../apercu-envoi", () => ({
  apercu: vi.fn(async (e: Record<string, unknown>) => ({ ...e, sujet: "s", html: "" })),
}));
vi.mock("../envois", () => ({
  avecTexteLibre: (p: Record<string, unknown>) => p,
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));

type Where = { statut?: string | { in: string[] } };
/** Une base qui RESPECTE le filtre de statut, l'ordre et la borne `take` (le faux d'avant rendait tout). */
function lire(args: {
  where: Where;
  take?: number;
  orderBy?: { protegeeJusquAt?: unknown; recueAt?: unknown };
}) {
  const st = args.where.statut;
  let l = etat.lignes.filter((x) =>
    st === undefined
      ? true
      : typeof st === "string"
        ? x.statut === st
        : st.in.includes(x.statut as string),
  );
  if (args.orderBy?.protegeeJusquAt)
    l = [...l].sort(
      (a, b) =>
        ((b.protegeeJusquAt as Date | null)?.getTime() ?? Infinity) -
        ((a.protegeeJusquAt as Date | null)?.getTime() ?? Infinity),
    );
  return l.slice(0, args.take ?? l.length);
}

vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: async (f: (t: unknown) => unknown) => f(prisma),
    presentationReservation: { findMany: vi.fn(async () => []) },
    presentationEntreprise: {
      findUnique: vi.fn(async (a: { include?: unknown }) => ({
        ...(a.include
          ? { apporteur: { id: "APP2", prenom: "Ana", nom: "Bel", email: "ana@x.fr" } }
          : {}),
        id: "P2",
        siren: "123456782",
        apporteurId: "APP2",
        statut: "reservee",
        contactEnvoyeAt: null,
        denomination: "Acme",
        recueAt: new Date("2026-10-01T00:00:00Z"),
        personneNom: "Durand",
        personneEmail: "d@acme.fr",
      })),
      findMany: vi.fn(async (a: Parameters<typeof lire>[0]) => lire(a)),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    },
  };
  return { prisma };
});

import { appliquerReponse, MESSAGE_DEJA_ATTRIBUEE } from "../presentations";

const opts = { civilite: "" as const, nomFamille: "" };

beforeEach(() => {
  etat.envoyes = [];
  vi.useFakeTimers({ now: new Date("2026-10-20T10:00:00Z"), toFake: ["Date"] });
  // 25 présentations TERMINÉES d'autres apporteurs (protection échue, sans repos), listées AVANT l'active.
  etat.lignes = Array.from({ length: 25 }, (_, i) => ({
    id: `T${i}`,
    apporteurId: `X${i}`,
    statut: "terminee",
    contactEnvoyeAt: null,
    recueAt: new Date("2025-01-01T00:00:00Z"),
    protegeeJusquAt: new Date("2025-06-01T00:00:00Z"),
  }));
  etat.lignes.push({
    id: "R1",
    apporteurId: "APP1",
    statut: "reservee",
    contactEnvoyeAt: new Date("2026-09-20T00:00:00Z"),
    recueAt: new Date("2026-09-01T00:00:00Z"),
    protegeeJusquAt: null,
  });
});

describe("fenêtre de lecture de « Bien reçu »", () => {
  it("une présentation réservée et déjà « Bien reçu » reste vue parmi 25 terminées : refus « déjà attribuée »", async () => {
    const r = await appliquerReponse("P2", "bien_recu", opts);
    vi.useRealTimers();
    expect(r).toEqual({ ok: false, message: MESSAGE_DEJA_ATTRIBUEE });
    expect(etat.envoyes).toEqual([]);
  });
});
