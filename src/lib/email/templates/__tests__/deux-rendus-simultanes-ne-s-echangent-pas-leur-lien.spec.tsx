// @vitest-environment node
// 🔴 Deux e-mails rendus EN MÊME TEMPS ne s'échangent jamais leur lien d'opposition
// (relecture sécurité, 2026-10-09).
//
// Le worker rend deux e-mails à la fois. Le lien d'opposition vivait dans une variable de
// module posée avant plusieurs `await` : l'e-mail de A pouvait partir avec le lien de B, dont
// le jeton porte l'ADRESSE de B. On force ici l'entrelacement : le premier rendu attend ses
// statistiques d'avis plus longtemps que le second. Avec l'ancien mécanisme, A recevait le
// lien de B ; avec le contexte par rendu, chacun garde le sien.
import { beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ appels: 0 }));
vi.mock("../../review-stats", () => ({
  getPublishedReviewStats: async () => {
    h.appels += 1;
    // Le PREMIER rendu attend ; le second passe devant lui.
    if (h.appels % 2 === 1) await new Promise((r) => setTimeout(r, 40));
    return { count: 0, avg: 0 };
  },
}));

import { renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { lireJetonOpposition } from "@/server/email/opposition-jeton";

const A = "alice.martin@exemple-a.fr";
const B = "bruno.durand@exemple-b.fr";

/** Les adresses portées par les liens d'opposition d'un HTML. */
function adressesOpposees(html: string): string[] {
  const jetons = [...html.matchAll(/\/api\/unsubscribe\?token=([^"&]+)/g)].map((m) =>
    decodeURIComponent(m[1]!),
  );
  return jetons.map((j) => lireJetonOpposition(j)).filter((x): x is string => !!x);
}

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
});

describe("deux rendus simultanés", () => {
  it.each([1, 2, 3])("essai %i : chaque e-mail ne porte que le lien de SON destinataire", async () => {
    // Famille B (avec lien d'opposition) : l'attribution d'un apporteur.
    const [ra, rb] = await Promise.all([
      renderEmailTemplate("apporteur-attribution-confirmee", "fr", PAYLOAD_EXEMPLE, { destinataire: A }),
      renderEmailTemplate("apporteur-attribution-confirmee", "fr", PAYLOAD_EXEMPLE, { destinataire: B }),
    ]);
    // Témoin positif : chaque HTML porte bien un lien d'opposition.
    expect(adressesOpposees(ra.html).length).toBeGreaterThan(0);
    expect(adressesOpposees(rb.html).length).toBeGreaterThan(0);
    expect(new Set(adressesOpposees(ra.html))).toEqual(new Set([A]));
    expect(new Set(adressesOpposees(rb.html))).toEqual(new Set([B]));
    expect(ra.html).not.toContain(Buffer.from(B, "utf8").toString("base64url"));
    expect(rb.html).not.toContain(Buffer.from(A, "utf8").toString("base64url"));
    expect(ra.text).not.toContain(Buffer.from(B, "utf8").toString("base64url"));
  });
});
