// @vitest-environment node

/**
 * Verrou — un événement que le CRM n'acceptera jamais est SIGNALÉ, pas
 * seulement enregistré.
 *
 * ## Ce qui a été mesuré, et comment
 *
 * Le 2026-09-01 en production : **trois soumissions de formulaire abandonnées**
 * les 24, 26 et 28 août, toutes pour la même raison
 * (`candidate_consent_v2_required`). Trois personnes qui ont écrit et que le
 * CRM n'a jamais connues.
 *
 * Elles n'ont été découvertes que parce qu'on est allé regarder la table.
 *
 * ## Pourquoi personne ne les avait vues
 *
 * Rien n'était cassé, et c'est le plus troublant. Le refus définitif était géré
 * proprement : ligne passée en `gave_up`, erreur conservée, et le commentaire
 * d'à côté annonçait qu'elle « reste visible pour traitement humain ».
 *
 * Elle l'est — sur la page `/synchro-crm`. Qu'il faut penser à ouvrir.
 *
 * `crm-sync/health.ts` mesure d'ailleurs ces abandons, et dit **explicitement**
 * qu'elle « ne doit ni émettre, ni alerter » : c'est une vue de lecture, par
 * choix. Le résultat combiné de ces deux décisions raisonnables est que
 * **personne n'était prévenu**.
 *
 * ## Pourquoi alerter ici, et pas dans une sonde
 *
 * Une sonde périodique ne voit que sa fenêtre — celle de `health.ts` fait
 * 24 heures, et les trois abandons y sont invisibles depuis longtemps. Alerter
 * AU MOMENT de l'abandon ne dépend d'aucune fenêtre : l'événement est signalé
 * une fois, quand il se produit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notifyMock(...a) }));

const { emitOutboxRow } = await import("../emit");

/** Une ligne prête à partir. */
function ligne(over: Record<string, unknown> = {}) {
  return {
    id: "outbox-1",
    eventType: "form_submission",
    subjectRef: "site:contact:42",
    universe: "axion",
    payload: { schema_version: 1, event_id: "e1" },
    status: "pending",
    attempts: 0,
    ...over,
  };
}

/** Les alertes d'abandon réellement émises. */
function abandons(): Array<Record<string, unknown>> {
  return notifyMock.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .filter(
      (e) => (e["payload"] as Record<string, unknown> | undefined)?.["kind"] === "crm_abandon",
    );
}

/** Le corps lisible de la première alerte. */
function corps(): string {
  const p = abandons()[0]?.["payload"] as Record<string, unknown> | undefined;
  const d = p?.["details"] as Record<string, unknown> | undefined;
  return String(d?.["legacyBody"] ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueMock.mockResolvedValue(ligne());
  updateMock.mockResolvedValue({});
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
  process.env.CRM_SYNC_URL = "https://crm.exemple.invalid/ingest";
  process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test";
  process.env.CRM_SYNC_ENABLED = "true";
});

describe("un refus définitif du CRM se signale", () => {
  it("🔴 un 422 déclenche une alerte", async () => {
    // 422 = refus définitif : contrat, consentement ou taxonomie. C'est
    // exactement ce qui a fait perdre trois personnes en août.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "candidate_consent_v2_required" }), { status: 422 }),
        ),
    );
    const r = await emitOutboxRow("outbox-1");

    expect(r.status).toBe("gave_up");
    expect(abandons().length, "un abandon sans alerte est un abandon silencieux").toBe(1);
  });

  it("🔑 l'alerte dit DE QUI elle parle et POURQUOI", async () => {
    // Une alerte qui annonce « un événement a échoué » sans dire lequel oblige
    // à ouvrir la console pour comprendre — le détour qu'elle doit éviter.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "candidate_consent_v2_required" }), { status: 422 }),
        ),
    );
    await emitOutboxRow("outbox-1");

    const t = corps();
    expect(t, "le type d'événement").toContain("form_submission");
    expect(t, "le sujet concerné").toContain("site:contact:42");
    expect(t, "la raison exacte du refus").toContain("candidate_consent_v2_required");
    expect(t, "et le fait que rejouer ne servirait à rien").toContain("DÉFINITIF");
  });

  it("🔑 CONTRE-TÉMOIN : un succès n'alerte pas", async () => {
    // Sans ce cas, l'alerte pourrait partir à chaque émission et deviendrait du
    // bruit — donc ignorée, donc inutile.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, result: { status: "created" } }), {
          status: 200,
        }),
      ),
    );
    const r = await emitOutboxRow("outbox-1");
    expect(r.status).toBe("sent");
    expect(abandons(), "une émission réussie ne doit rien signaler").toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : un refus TEMPORAIRE n'alerte pas", async () => {
    // 503 = le CRM est fermé ou son drapeau d'ingestion est à OFF. C'est l'état
    // normal tant que la bascule n'a pas eu lieu : alerter là-dessus produirait
    // une alerte par ligne et par passage.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "closed" }), { status: 503 })),
    );
    const r = await emitOutboxRow("outbox-1");
    expect(r.status).toBe("failed");
    expect(abandons(), "un refus temporaire n'est pas un abandon").toEqual([]);
  });

  it("🔑 une alerte qui échoue n'empêche pas la ligne d'être soldée", async () => {
    // Le pire cas doit rester le comportement d'avant — un abandon silencieux —
    // et jamais une ligne laissée dans un état incohérent.
    notifyMock.mockRejectedValue(new Error("telegram muet"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "refus" }), { status: 422 })),
    );
    const r = await emitOutboxRow("outbox-1");
    expect(r.status).toBe("gave_up");
    expect(updateMock, "la ligne doit être marquée quoi qu'il arrive").toHaveBeenCalled();
  });
});
