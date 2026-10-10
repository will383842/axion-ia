/**
 * `Schedule` vers Meta à la réservation de l'échange apporteur (lot 5).
 *
 * Ce que ces cas verrouillent :
 *   1. DÉDOUBLONNAGE : `event_id` = `schedule:<id de la réservation>`, identique
 *      pour le navigateur et le serveur, stable d'un envoi à l'autre ;
 *   2. CONSENTEMENT lu sur la fiche (gardé avec sa date à l'étape 1) : sans
 *      « accepté » tracé, ou sur un refus, ou sans réponse, rien ne part ;
 *   3. un contact qui ne vient pas de Facebook n'est pas compté ;
 *   4. le `fbc` porte l'heure d'ARRIVÉE du clic gardée sur la fiche ;
 *   5. rien en clair, et une panne ne remonte jamais.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const envMock = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_META_PIXEL_ID: "123456789",
    META_CAPI_ACCESS_TOKEN: "jeton-de-test",
    META_CAPI_TEST_EVENT_CODE: undefined as string | undefined,
  },
}));
vi.mock("@/env", () => envMock);
vi.mock("@sentry/nextjs", () => ({
  captureException: () => undefined,
  captureMessage: () => undefined,
}));
const trouver = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findUnique: (...a: unknown[]) => trouver(...a) } },
}));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));

import { envoyerScheduleApporteur, lireDonneesMetaFiche } from "../schedule-apporteur";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

const FICHE_ACCEPTEE = {
  funnel: {
    consentPub: { accepte: true, le: "2026-10-05T10:00:00.000Z" },
    fbp: "fb.1.1725000000000.123456",
    fbclidValeur: "IwAR0abcdefghijklmnop",
    fbcCreeLe: "2026-10-05T09:59:00.000Z",
  },
  candidature: { sourceConnaissance: "facebook" },
};

const reponseOk = () => new Response("{}", { status: 200 });

function entree(o: Record<string, unknown> = {}) {
  const fetchImpl = vi.fn(async () => reponseOk());
  return {
    fetchImpl,
    input: {
      calendlyEventId: "cm_evt_42",
      submissionId: "sub-1",
      email: "Nadia@Example.com",
      nom: "Nadia Dupont",
      telephone: "06 12 34 56 78",
      at: new Date("2026-10-07T08:00:00Z"),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...o,
    },
  };
}

type Corps = { data: Array<Record<string, unknown>> };
const corpsEnvoye = (f: ReturnType<typeof vi.fn>): Corps =>
  JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as Corps;

beforeEach(() => {
  trouver.mockReset();
  envMock.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789";
  envMock.env.META_CAPI_ACCESS_TOKEN = "jeton-de-test";
});

describe("lireDonneesMetaFiche — lecture défensive, pure", () => {
  it("une réponse « acceptée » tracée vaut accepted ; un refus, declined", () => {
    expect(lireDonneesMetaFiche(FICHE_ACCEPTEE).consentPub).toBe("accepted");
    expect(
      lireDonneesMetaFiche({ funnel: { consentPub: { accepte: false, le: "x" } } }).consentPub,
    ).toBe("declined");
  });

  it("tout le reste vaut unknown — jamais un consentement déduit", () => {
    for (const v of [
      null,
      undefined,
      {},
      { funnel: {} },
      { funnel: { consentPub: "oui" } },
      { funnel: { consentPub: { accepte: "true" } } },
      { funnel: { consentPub: {} } },
    ]) {
      expect(lireDonneesMetaFiche(v).consentPub).toBe("unknown");
    }
  });
});

describe("envoyerScheduleApporteur", () => {
  it("envoie `Schedule` avec event_id `schedule:<id de la réservation>`", async () => {
    trouver.mockResolvedValue({ details: FICHE_ACCEPTEE });
    const { input, fetchImpl } = entree();
    const r = await envoyerScheduleApporteur(input);
    expect(r).toEqual({ envoye: true });
    const ev = corpsEnvoye(fetchImpl).data[0];
    expect(ev?.["event_name"]).toBe("Schedule");
    expect(ev?.["event_id"]).toBe("schedule:cm_evt_42");
    expect(ev?.["event_source_url"]).toBe("https://axion-ia.com/fr/apporteur-affaires/video/merci");
  });

  it("DÉDOUBLONNAGE : la même réservation donne toujours le même event_id (même après un nouvel envoi)", async () => {
    trouver.mockResolvedValue({ details: FICHE_ACCEPTEE });
    const a = entree();
    const b = entree({ at: new Date("2026-10-07T09:30:00Z") });
    await envoyerScheduleApporteur(a.input);
    await envoyerScheduleApporteur(b.input);
    expect(corpsEnvoye(a.fetchImpl).data[0]?.["event_id"]).toBe(
      corpsEnvoye(b.fetchImpl).data[0]?.["event_id"],
    );
    // Une AUTRE réservation a un autre identifiant.
    const c = entree({ calendlyEventId: "cm_evt_43" });
    await envoyerScheduleApporteur(c.input);
    expect(corpsEnvoye(c.fetchImpl).data[0]?.["event_id"]).toBe("schedule:cm_evt_43");
  });

  it("le fbc porte l'heure d'ARRIVÉE du clic gardée sur la fiche, pas l'heure de la réservation", async () => {
    trouver.mockResolvedValue({ details: FICHE_ACCEPTEE });
    const { input, fetchImpl } = entree();
    await envoyerScheduleApporteur(input);
    const ud = corpsEnvoye(fetchImpl).data[0]?.["user_data"] as Record<string, unknown>;
    expect(ud["fbc"]).toBe(`fb.1.${Date.parse("2026-10-05T09:59:00.000Z")}.IwAR0abcdefghijklmnop`);
    expect(ud["fbp"]).toBe("fb.1.1725000000000.123456");
  });

  it("hache l'adresse confirmée, le téléphone et le prénom ; rien en clair ; pas de ville", async () => {
    trouver.mockResolvedValue({ details: FICHE_ACCEPTEE });
    const { input, fetchImpl } = entree();
    await envoyerScheduleApporteur(input);
    const ev = corpsEnvoye(fetchImpl).data[0] as Record<string, unknown>;
    const ud = ev["user_data"] as Record<string, unknown>;
    expect(ud["em"]).toEqual([sha("nadia@example.com")]);
    expect(ud["ph"]).toEqual([sha("33612345678")]);
    expect(ud["fn"]).toEqual([sha("nadia")]);
    expect(ud).not.toHaveProperty("ct");
    const brut = JSON.stringify(ev);
    expect(brut).not.toMatch(/nadia|dupont|0612/i);
  });

  it("SANS réponse tracée sur la fiche : rien ne part (règle de refus conservée)", async () => {
    trouver.mockResolvedValue({ details: { candidature: { sourceConnaissance: "facebook" } } });
    const { input, fetchImpl } = entree();
    const r = await envoyerScheduleApporteur(input);
    expect(r).toEqual({ envoye: false, motif: "sans_consentement" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sur un REFUS tracé : rien ne part", async () => {
    trouver.mockResolvedValue({
      details: {
        funnel: { consentPub: { accepte: false, le: "2026-10-05T10:00:00.000Z" } },
        candidature: { sourceConnaissance: "facebook" },
      },
    });
    const { input, fetchImpl } = entree();
    expect((await envoyerScheduleApporteur(input)).envoye).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("un contact LinkedIn n'est pas compté par la campagne Facebook, même avec consentement", async () => {
    trouver.mockResolvedValue({
      details: { ...FICHE_ACCEPTEE, candidature: { sourceConnaissance: "linkedin" } },
    });
    const { input, fetchImpl } = entree();
    expect(await envoyerScheduleApporteur(input)).toEqual({
      envoye: false,
      motif: "pas_facebook",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("une ligne « suspecte » (robot) n'entraîne pas Meta — même règle que Lead (2026-10-10)", async () => {
    trouver.mockResolvedValue({ details: { ...FICHE_ACCEPTEE, vsl: { suspect: true } } });
    const { input, fetchImpl } = entree();
    expect(await envoyerScheduleApporteur(input)).toEqual({ envoye: false, motif: "suspect" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fiche introuvable ou base muette : rien ne part, rien ne lève", async () => {
    trouver.mockResolvedValueOnce(null);
    const a = entree();
    expect(await envoyerScheduleApporteur(a.input)).toEqual({
      envoye: false,
      motif: "fiche_introuvable",
    });
    trouver.mockRejectedValueOnce(new Error("base indisponible"));
    const b = entree();
    expect(await envoyerScheduleApporteur(b.input)).toEqual({
      envoye: false,
      motif: "base_indisponible",
    });
    expect(a.fetchImpl).not.toHaveBeenCalled();
    expect(b.fetchImpl).not.toHaveBeenCalled();
  });

  it("jeton absent : rien ne part", async () => {
    envMock.env.META_CAPI_ACCESS_TOKEN = undefined as unknown as string;
    trouver.mockResolvedValue({ details: FICHE_ACCEPTEE });
    const { input, fetchImpl } = entree();
    expect(await envoyerScheduleApporteur(input)).toEqual({
      envoye: false,
      motif: "non_configure",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("un refus de Meta ou une panne réseau ne remontent jamais", async () => {
    trouver.mockResolvedValue({ details: FICHE_ACCEPTEE });
    const refus = vi.fn(async () => new Response("bad", { status: 400 }));
    expect(
      await envoyerScheduleApporteur(entree({ fetchImpl: refus as unknown as typeof fetch }).input),
    ).toEqual({ envoye: false, motif: "refus" });
    const panne = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(
      await envoyerScheduleApporteur(entree({ fetchImpl: panne as unknown as typeof fetch }).input),
    ).toEqual({ envoye: false, motif: "reseau" });
  });
});
