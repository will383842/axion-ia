/**
 * Garde : la sonde d'accessibilité doit rendre 200.
 *
 * 🔴 Sans elle, ZeptoMail REFUSE de créer le webhook. Mesuré en
 * production le 2026-09-01 : la route n'exportait que `POST`, donc un `GET`
 * rendait **405** et le panneau affichait « URL cannot be reached ». Le bouton
 * « Ajouter » ne créait rien, et le compteur `dernier appel webhook` restait
 * à `JAMAIS` — non parce que les appels étaient refusés, mais parce que le
 * webhook n'avait jamais pu exister.
 *
 * Cette garde est volontairement minuscule : elle ne vérifie qu'un code et
 * l'absence de fuite. C'est exactement ce dont dépend la création du webhook,
 * et rien de plus.
 */

import { describe, it, expect, vi } from "vitest";

// Le module importe prisma, redis et le service d'alertes au chargement. On les
// neutralise : cette garde ne teste QUE la sonde GET, qui ne les touche pas.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({ creerOuDedup: vi.fn() }));

import { GET } from "./route";

describe("sonde d'accessibilité du webhook ZeptoMail", () => {
  it("🔴 rend 200 — ZeptoMail refuse de créer le webhook sinon", async () => {
    const r = GET();
    expect(
      r.status,
      "ZeptoMail interroge l'URL avant d'accepter la création du webhook et " +
        "exige un 200. Tout autre code affiche « URL cannot be reached » et " +
        "rend la création impossible — quel que soit l'état de la clé.",
    ).toBe(200);
    await r.text();
  });

  it("ne divulgue RIEN du système — pas même si une clé est configurée", async () => {
    const corps = await GET().json();
    // Un point d'entrée public ne renseigne pas sur son propre armement.
    expect(Object.keys(corps).sort()).toEqual(["endpoint", "ok"]);
    expect(JSON.stringify(corps)).not.toMatch(/key|cle|secret|token/i);
  });
});
