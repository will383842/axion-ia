// @vitest-environment node
//
// Lot guide réseau 4 (O2) — événement v3 d'une demande venue de la CONVERSATION : l'origine
// complète, SANS consentement ni prénom (aucune case cochée : information M1 seulement).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: () => "0000000000000000000000000000000000000000000000000000000000000000",
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/crm-sync/enqueue", () => ({ enqueueCrmSyncEvent: async () => null }));

import { eventIdDemandeGuide } from "@/server/crm-sync/event-id";
import type { OrigineAEcrire } from "../origines";
import { evenementConversationV3 } from "../synchro-v3";

const origine = (sur: Partial<OrigineAEcrire> = {}): OrigineAEcrire => ({
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  postRef: "post_ref_test_01",
  postUrl: null,
  canal: "message_prive",
  famille: "guide_reseau",
  detail: null,
  compte: "page_principale",
  versionTexte: "m1-v1",
  utmCampagne: null,
  commentaireRefHmac: "a".repeat(64),
  occurredAt: new Date("2026-11-01T10:00:00.000Z"),
  cleIdempotence: "",
  ...sur,
});
const entree = (sur: Record<string, unknown> = {}) => ({
  demandeId: "demande-1",
  email: "personne@exemple.test",
  clicLe: new Date("2026-11-01T10:05:00.000Z"),
  guide: "guide-ia",
  origines: [origine()],
  payloadBase: { aimant: "guide-ia-entreprise", locale: "fr" },
  ...sur,
});

describe("evenementConversationV3", () => {
  it("ni consentements, ni prénom ; identifiants de la demande", () => {
    const r = evenementConversationV3(entree());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.evenement as unknown as Record<string, unknown>;
    expect(e).not.toHaveProperty("consentements");
    expect(e.person).not.toHaveProperty("first_name");
    expect(e.event_id).toBe(eventIdDemandeGuide("demande-1"));
    expect(e.subject_ref).toBe("site:guide_request:demande-1");
    expect(e.event_type).toBe("lead_magnet_requested");
    expect(e.schema_version).toBe(3);
    expect(e.guides_recus).toEqual([{ guide: "guide-ia", date: "2026-11-01T10:05:00.000Z" }]);
    const p = e.payload as Record<string, unknown>;
    expect(p.verifie).toBe(true);
    expect(p.aimant).toBe("guide-ia-entreprise");
    expect((p.origines as unknown[]).length).toBe(1);
  });

  it("la source par défaut est guide-reseau ; surchargeable (demande née d'ailleurs)", () => {
    const a = evenementConversationV3(entree());
    const b = evenementConversationV3(entree({ sourceSlug: "guide-ia" }));
    expect(a.ok && a.evenement.source_slug).toBe("guide-reseau");
    expect(b.ok && b.evenement.source_slug).toBe("guide-ia");
  });

  it("compte ou post_ref hors format CRM → origine_invalide", () => {
    for (const sur of [{ compte: "Compte Invalide!" }, { postRef: "court" }]) {
      const r = evenementConversationV3(entree({ origines: [origine(sur)] }));
      expect(r).toEqual({ ok: false, erreur: "origine_invalide" });
    }
  });

  it("sans origine → aucune_origine ; adresse illisible → adresse", () => {
    expect(evenementConversationV3(entree({ origines: [] }))).toEqual({
      ok: false,
      erreur: "aucune_origine",
    });
    expect(evenementConversationV3(entree({ email: " " }))).toEqual({
      ok: false,
      erreur: "adresse",
    });
  });

  it("la charge ne porte ni HMAC de commentaire, ni référence de conversation, ni texte libre", () => {
    const r = evenementConversationV3(entree());
    expect(JSON.stringify(r)).not.toMatch(/commentaire_ref|conv_ref|a{64}/);
  });
});
