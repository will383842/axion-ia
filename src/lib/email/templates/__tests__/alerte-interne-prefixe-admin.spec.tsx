// L'alerte interne mène à la console — lot 2 (2026-09-02).
//
// Le préfixe d'administration était codé en dur avec la valeur PUBLIQUE du
// dépôt : en production, où `ADMIN_URL_PREFIX` en pose une autre, le bouton
// menait à un 404. Et faute de `ctaSecret`, le châssis recopiait l'URL
// d'administration en texte brut dans le corps.

import { describe, it, expect, afterEach } from "vitest";

import { renderEmailTemplate } from "../index";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const AVANT = process.env["ADMIN_URL_PREFIX"];

afterEach(() => {
  if (AVANT === undefined) delete process.env["ADMIN_URL_PREFIX"];
  else process.env["ADMIN_URL_PREFIX"] = AVANT;
});

describe("qualiopi-alerte-interne — le bouton vers la console", () => {
  it("🔴 lit le préfixe d'administration de l'environnement, comme la console", async () => {
    process.env["ADMIN_URL_PREFIX"] = "console-prod-zz91";
    const { html } = await renderEmailTemplate("qualiopi-alerte-interne", "fr", PAYLOAD_EXEMPLE, {
      destinataire: "will@axion-ia.com",
    });
    expect(html).toContain("/fr/console-prod-zz91/qualiopi/alertes");
    expect(html).not.toContain("admin-dev-x7k2n9");
  });

  it("sans variable, garde le préfixe de développement (Mailhog reste utilisable)", async () => {
    delete process.env["ADMIN_URL_PREFIX"];
    const { html } = await renderEmailTemplate("qualiopi-alerte-interne", "fr", PAYLOAD_EXEMPLE);
    expect(html).toContain("/fr/admin-dev-x7k2n9/qualiopi/alertes");
  });

  it("l'URL d'administration n'est pas recopiée en texte brut dans le corps", async () => {
    process.env["ADMIN_URL_PREFIX"] = "console-prod-zz91";
    const { html } = await renderEmailTemplate("qualiopi-alerte-interne", "fr", PAYLOAD_EXEMPLE);
    // Une seule occurrence : celle du bouton. Le repli texte du CTA (§3.8) est
    // supprimé par `ctaSecret`.
    expect(html.split("/fr/console-prod-zz91/qualiopi/alertes").length - 1).toBe(1);
  });
});
