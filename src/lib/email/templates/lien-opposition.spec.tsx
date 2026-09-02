// Le lien « Ne plus recevoir de sollicitations commerciales » — lot 1b (2026-09-02).
//
// Gardé ici, sur les 44 gabarits rendus AVEC un destinataire, comme le worker
// le fait :
//   - famille A : jamais de lien d'opposition (une facture, un lien de
//     connexion ne se « désabonnent » pas) ;
//   - familles B, C, D : le lien est là, il porte un jeton VALIDE pour ce
//     destinataire, et il tient dans le budget de liens du régime ;
//   - la famille est estampillée dans le HTML (`data-famille`), c'est ce que
//     le worker lit pour décider de l'en-tête RFC 8058 ;
//   - sans destinataire (aperçus, tests), aucun lien, aucun jeton fantôme.

import { describe, it, expect, beforeAll } from "vitest";

import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES, familleDuHtml } from "./index";
import { REGIME_FAMILLE } from "./_layout";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { lireJetonOpposition } from "@/server/email/opposition-jeton";

const DESTINATAIRE = "jean.dupont@client-test.fr";

function liensDistincts(html: string): Set<string> {
  return new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
}

function lienOpposition(html: string): string | null {
  const m = /href="([^"]*\/api\/unsubscribe\?token=op1\.[^"]+)"/.exec(html);
  return m ? m[1]!.replace(/&amp;/g, "&") : null;
}

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
});

describe("lien d'opposition — 44 gabarits rendus avec un destinataire", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    it(`${name} : famille estampillée, lien selon le régime, jeton valide`, async () => {
      const { html, famille } = await renderEmailTemplate(name, "fr", PAYLOAD_EXEMPLE, {
        destinataire: DESTINATAIRE,
      });
      expect(famille, `${name} : famille introuvable dans le HTML`).not.toBeNull();
      expect(familleDuHtml(html)).toBe(famille);

      const lien = lienOpposition(html);
      if (famille === "A") {
        expect(lien, `${name} (A) ne doit porter aucun lien d'opposition`).toBeNull();
        return;
      }
      expect(lien, `${name} (${famille}) doit porter le lien d'opposition`).not.toBeNull();
      const jeton = decodeURIComponent(new URL(lien!).searchParams.get("token") ?? "");
      expect(lireJetonOpposition(jeton)).toBe(DESTINATAIRE);
      expect(liensDistincts(html).size).toBeLessThanOrEqual(REGIME_FAMILLE[famille!].budgetLiens);
    });
  }

  it("sans destinataire, aucun lien d'opposition n'est rendu — sur aucun gabarit", async () => {
    for (const name of EMAIL_TEMPLATE_NAMES) {
      const { html } = await renderEmailTemplate(name, "fr", PAYLOAD_EXEMPLE);
      expect(lienOpposition(html), `${name} : lien fantôme sans destinataire`).toBeNull();
    }
  });

  it("le libellé dit la portée : les sollicitations COMMERCIALES", async () => {
    const { html } = await renderEmailTemplate("roi-report", "fr", PAYLOAD_EXEMPLE, {
      destinataire: DESTINATAIRE,
    });
    expect(html).toContain("Ne plus recevoir de sollicitations commerciales");
  });
});
