/**
 * Fix 2026-07-19 — corps legacy `sendTelegram()` non affiché.
 *
 * Les call-sites legacy (`@/lib/telegram` → `sendTelegram({ tag, body })`)
 * produisent un payload `{ kind, details: { legacyBody } }`. La branche
 * INCIDENT_DETECTED du formatteur ne lisait que title/url/statusCode/error →
 * le message Telegram partait **VIDE** (« 🔴 Incident détecté » sans texte).
 * MONITORING_ALERT, lui, affichait le JSON brut `{"legacyBody":"…"}`.
 *
 * Ce test verrouille le fallback qui rend le `legacyBody` dans les deux cas.
 */

import { describe, it, expect } from "vitest";

import { formatNotification } from "../format";
import type { NotificationEvent } from "../types";

// Reproduit le shape produit par sendTelegram() (casté `as never` là-bas car le
// typage strict par catégorie ne le connaît pas — on caste donc ici aussi).
const legacyEvent = (category: string, body: string): NotificationEvent =>
  ({
    category,
    payload: { kind: "INCIDENT", details: { legacyBody: body } },
  }) as unknown as NotificationEvent;

describe("formatNotification — fallback corps legacy", () => {
  it("INCIDENT_DETECTED legacy → affiche le texte (ne part plus VIDE)", () => {
    const msg = "Fournisseur IA hors service depuis 30 min";
    const { text } = formatNotification(legacyEvent("INCIDENT_DETECTED", msg), "error");
    expect(text).toContain(msg);
  });

  it("MONITORING_ALERT legacy → affiche le texte, PAS le JSON brut", () => {
    const msg = "Echecs en serie 12 generations echouees";
    const { text } = formatNotification(legacyEvent("MONITORING_ALERT", msg), "warn");
    expect(text).toContain(msg);
    expect(text).not.toContain("legacyBody");
  });

  it("INCIDENT_DETECTED structuré (non-legacy) → toujours rendu normalement", () => {
    const event = {
      category: "INCIDENT_DETECTED",
      payload: { title: "RGPD effacement effectue" },
    } as unknown as NotificationEvent;
    const { text } = formatNotification(event, "error");
    expect(text).toContain("RGPD effacement effectue");
    expect(text).toContain("Titre");
  });
});
