// @vitest-environment node
//
// Lot S3 — le constructeur PUR de l'événement `lead_magnet_requested` v3 émis AU CLIC du lien du
// guide (page « Recevoir le guide »). Charge conforme à la FIXTURE JSON PARTAGÉE
// (`fixtures/charge-crm-v3-page.json`, à copier à l'identique côté CRM). Adresses en `.test`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fixture from "./fixtures/charge-crm-v3-page.json";

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/crm-sync/enqueue", () => ({ enqueueCrmSyncEvent: async () => null }));

import {
  evenementPageGuideV3,
  newsletterOptinPageGuideActif,
  type EntreeEvenementPageGuide,
} from "../synchro-v3";
import type { OrigineAEcrire } from "../origines";

const origine = (sur: Partial<OrigineAEcrire> = {}): OrigineAEcrire => ({
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  postRef: "post_ref_test_01",
  postUrl: null,
  canal: null,
  famille: "guide_reseau",
  detail: "guide_ia",
  compte: "page_principale",
  versionTexte: "m1-v1",
  utmCampagne: null,
  commentaireRefHmac: null,
  occurredAt: new Date("2026-11-01T10:00:00.000Z"),
  cleIdempotence: "page-x",
  ...sur,
});

const entree = (sur: Partial<EntreeEvenementPageGuide> = {}): EntreeEvenementPageGuide => ({
  demandeId: "demande-1",
  email: "personne@exemple.test",
  prenom: "Camille",
  clicLe: new Date("2026-11-01T10:05:00.000Z"),
  consentiLe: new Date("2026-11-01T10:00:00.000Z"),
  versionConsentement: "page-guide-2026-11-08",
  guide: "guide-ia",
  origines: [origine()],
  payloadBase: {
    aimant: "guide-ia-entreprise",
    placement: "mot-guide:instagram",
    locale: "fr",
    email_nature: "pro",
    base_legale: "legitimate_interest_b2b",
    lettre: "non_abonne",
    version_mention: "m1-v1",
  },
  ...sur,
});

const ancien = { ...process.env };
beforeEach(() => {
  delete process.env.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN;
});
afterEach(() => {
  process.env.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN = ancien.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN;
  if (ancien.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN === undefined)
    delete process.env.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN;
});

describe("evenementPageGuideV3 — contrat", () => {
  it("charge conforme à la fixture JSON partagée", () => {
    const r = evenementPageGuideV3(entree());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.evenement).toEqual(fixture);
  });

  it("event_id déterministe : le même pour la même demande (aucun doublon, ni avec le rattrapage)", () => {
    const a = evenementPageGuideV3(entree());
    const b = evenementPageGuideV3(entree({ clicLe: new Date("2026-11-02T08:00:00.000Z") }));
    if (!a.ok || !b.ok) throw new Error("attendu ok");
    expect(a.evenement.event_id).toBe(b.evenement.event_id);
    const autre = evenementPageGuideV3(entree({ demandeId: "demande-2" }));
    if (!autre.ok) throw new Error("attendu ok");
    expect(autre.evenement.event_id).not.toBe(a.evenement.event_id);
  });

  it("rien de v1 n'est perdu : consent et champs du payload fusionnés, la charge v3 prime", () => {
    const r = evenementPageGuideV3(
      entree({
        consent: { version: "mention-3", at: new Date("2026-10-30T09:00:00.000Z") },
        payloadBase: { base_legale: "consent", origines: "ne doit pas écraser", verifie: false },
      }),
    );
    if (!r.ok) throw new Error("attendu ok");
    expect(r.evenement.consent).toEqual({ version: "mention-3", at: "2026-10-30T09:00:00.000Z" });
    const p = r.evenement.payload as Record<string, unknown>;
    expect(p.base_legale).toBe("consent");
    expect(Array.isArray(p.origines)).toBe(true);
    expect(p.verifie).toBe(true);
  });

  it("occurred_at = l'instant du CLIC, la case garde sa propre date", () => {
    const r = evenementPageGuideV3(entree());
    if (!r.ok) throw new Error("attendu ok");
    expect(r.evenement.occurred_at).toBe("2026-11-01T10:05:00.000Z");
    expect(r.evenement.consentements?.[0]?.date).toBe("2026-11-01T10:00:00.000Z");
  });

  it("aucun jeton, pseudo, texte, ni ligne newsletter dans la charge", () => {
    const r = evenementPageGuideV3(
      entree({ origines: [origine({ commentaireRefHmac: "a".repeat(64) })] }),
    );
    const t = JSON.stringify(r);
    expect(t).not.toContain("a".repeat(64));
    expect(t).not.toMatch(/newsletter/);
  });

  it("canal absent de l'origine : « commentaire » ; canal présent : conservé", () => {
    const sans = evenementPageGuideV3(entree());
    const avec = evenementPageGuideV3(entree({ origines: [origine({ canal: "dm" })] }));
    if (!sans.ok || !avec.ok) throw new Error("attendu ok");
    expect((sans.evenement.payload as { origines: { canal: string }[] }).origines[0]?.canal).toBe(
      "commentaire",
    );
    expect((avec.evenement.payload as { origines: { canal: string }[] }).origines[0]?.canal).toBe(
      "dm",
    );
  });

  it.each([
    ["compte", { compte: "Compte-Majuscule" }],
    ["compte trop court", { compte: "a" }],
    ["post_ref", { postRef: "court" }],
    ["version_texte", { versionTexte: "a b" }],
  ])("%s hors format CRM : refus AVANT toute émission", (_n, sur) => {
    const r = evenementPageGuideV3(entree({ origines: [origine(sur as Partial<OrigineAEcrire>)] }));
    expect(r).toEqual({ ok: false, erreur: "origine_invalide" });
  });

  it("aucune origine : refus", () => {
    expect(evenementPageGuideV3(entree({ origines: [] }))).toEqual({
      ok: false,
      erreur: "aucune_origine",
    });
  });

  it("prénom vide ou de plus de 50 caractères : refus", () => {
    expect(evenementPageGuideV3(entree({ prenom: "  " }))).toEqual({ ok: false, erreur: "prenom" });
    expect(evenementPageGuideV3(entree({ prenom: "x".repeat(51) }))).toEqual({
      ok: false,
      erreur: "prenom",
    });
  });

  it("adresse sans empreinte (clé indisponible) : refus", () => {
    expect(evenementPageGuideV3(entree({ email: "" }))).toEqual({ ok: false, erreur: "adresse" });
  });
});

describe("newsletter_optin de la page — interrupteur SÉPARÉ", () => {
  it("éteint par défaut et pour toute valeur autre que « true »", () => {
    expect(newsletterOptinPageGuideActif()).toBe(false);
    for (const v of ["1", "false", "TRUE", ""]) {
      process.env.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN = v;
      expect(newsletterOptinPageGuideActif()).toBe(false);
    }
  });
  it("indépendant de SYNCHRO_CRM_V3", () => {
    process.env.SYNCHRO_CRM_V3 = "true";
    expect(newsletterOptinPageGuideActif()).toBe(false);
    delete process.env.SYNCHRO_CRM_V3;
  });
});
