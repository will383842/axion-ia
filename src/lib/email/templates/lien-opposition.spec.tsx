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
//   - sans destinataire (aperçus, tests), aucun lien, aucun jeton fantôme ;
//   - (lot S2) l'attente se DÉDUIT de `data-nature` et `data-destinataire`, estampillés par le
//     châssis : pas de lien sous les droits, les réclamations, le recouvrement, les alertes
//     internes, ni pour un destinataire « interne ». Un gabarit migré n'a plus à toucher ce test.

import { describe, it, expect, beforeAll } from "vitest";

import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES, familleDuHtml } from "./index";
import { REGIME_FAMILLE } from "./_layout";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { lireJetonOpposition } from "@/server/email/opposition-jeton";

const DESTINATAIRE = "jean.dupont@client-test.fr";

function liensDistincts(html: string): Set<string> {
  return new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
}

/** Valeur d'un attribut `data-*` estampillé sur le <body> par le châssis, ou null. */
function estampille(html: string, attribut: string): string | null {
  const m = new RegExp(`data-${attribut}="([^"]*)"`).exec(html);
  return m ? (m[1] as string) : null;
}

/** Plan §2.2-8 : natures et destinataire qui n'ont jamais le lien. */
const NATURES_SANS_LIEN = new Set(["droits", "reclamation", "recouvrement", "alerte-interne"]);
function lienAttendu(html: string, famille: string | null): boolean {
  if (famille === "A") return false;
  if (estampille(html, "destinataire") === "interne") return false;
  const nature = estampille(html, "nature");
  return !(nature !== null && NATURES_SANS_LIEN.has(nature));
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
      if (!lienAttendu(html, famille)) {
        expect(
          lien,
          `${name} (${famille}, ${estampille(html, "nature") ?? "nature non déclarée"}) ne doit ` +
            `porter aucun lien d'opposition`,
        ).toBeNull();
        return;
      }
      expect(lien, `${name} (${famille}) doit porter le lien d'opposition`).not.toBeNull();
      const jeton = decodeURIComponent(new URL(lien!).searchParams.get("token") ?? "");
      expect(lireJetonOpposition(jeton)).toBe(DESTINATAIRE);
      expect(liensDistincts(html).size).toBeLessThanOrEqual(REGIME_FAMILLE[famille!].budgetLiens);
    });
  }

  // ⚠️ TIMEOUT EXPLICITE, et ce n'est pas un contournement.
  //
  // Ce témoin-ci rend TOUS les gabarits dans UN seul `it`, là où le bloc
  // ci-dessus en fait un `it` par gabarit. Il consomme donc à lui seul le
  // budget de 5 s par défaut de Vitest, et ce budget se consomme à mesure que
  // le parc grandit : il a expiré au 51ᵉ gabarit (rappel de la veille,
  // 2026-09-05), après avoir tenu de justesse au 50ᵉ. Le seuil n'exprimait
  // aucune exigence — personne n'a jamais décidé que rendre le parc entier
  // devait tenir en cinq secondes — et l'assertion, elle, est inchangée.
  it("sans destinataire, aucun lien d'opposition n'est rendu — sur aucun gabarit", async () => {
    for (const name of EMAIL_TEMPLATE_NAMES) {
      const { html } = await renderEmailTemplate(name, "fr", PAYLOAD_EXEMPLE);
      expect(lienOpposition(html), `${name} : lien fantôme sans destinataire`).toBeNull();
    }
  }, 30_000);

  it("le libellé dit la portée : les sollicitations COMMERCIALES", async () => {
    const { html } = await renderEmailTemplate("roi-report", "fr", PAYLOAD_EXEMPLE, {
      destinataire: DESTINATAIRE,
    });
    expect(html).toContain("Ne plus recevoir de sollicitations commerciales");
  });
});
