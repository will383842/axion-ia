/**
 * R14 — LE JETON DU LIEN PUBLIC D'UN DOCUMENT NE SORT PAS VERS SENTRY
 * (ADR 0063, D12).
 *
 * `/document/<uuid>/<jeton>` : le jeton (HMAC base64url, 43 caractères) ouvre la
 * page envoyée au client. Il échappe à `HEX_TOKEN_RE` (pas hexadécimal) et à
 * `JWT_RE` (un seul segment) : sans entrée dans `SEGMENTS_SECRETS`, il partirait
 * en clair chez un sous-traitant hors UE.
 *
 * Fichier à part (et non un cas de plus dans `sentry-pii-scrub.token.spec.ts`) :
 * le chantier du questionnaire en ligne (ADR 0062) ajoute le sien à la fin de
 * ce fichier-là ; deux fichiers ne se marchent pas dessus au rebasage.
 *
 * Contre-épreuve : `/documents-x/…` et `/document/<uuid>` seul restent lisibles.
 */

import { describe, expect, it } from "vitest";

import {
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "@/lib/observability/sentry-pii-scrub";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "Qx3_vR9kLm2-Tz8wYp4sAb6dEf1gHj5nKc7uWq0oIt0";
const URL_DOC = `https://axion-ia.com/document/${ID}/${JETON}`;

describe("document du projet — le jeton du lien public", () => {
  it("🔴 masque le jeton dans l'URL de la requête", () => {
    for (const url of [URL_DOC, `${URL_DOC}?a=1`, `${URL_DOC}#ancre`]) {
      const nettoye = piiScrubBeforeSend({ request: { url } } as never);
      expect(nettoye?.request?.url).not.toContain(JETON);
      expect(nettoye?.request?.url).toContain(`/document/${ID}/[TOKEN]`);
    }
  });

  it("masque le jeton d'une transaction (nom et http.target)", () => {
    const nettoye = piiScrubBeforeSendTransaction({
      transaction: `/document/${ID}/${JETON}`,
      contexts: { trace: { data: { "http.target": `/document/${ID}/${JETON}` } } },
    } as never);
    expect(nettoye?.transaction).toBe(`/document/${ID}/[TOKEN]`);
    const cible = (nettoye?.contexts?.["trace"] as { data?: Record<string, unknown> } | undefined)
      ?.data?.["http.target"];
    expect(String(cible)).not.toContain(JETON);
  });

  it("contre-épreuve : une route voisine et l'identifiant seul restent lisibles", () => {
    const voisine = `https://axion-ia.com/documents-x/${JETON}`;
    expect(piiScrubBeforeSend({ request: { url: voisine } } as never)?.request?.url).toContain(
      "/documents-x/",
    );
    const seul = `https://axion-ia.com/document/${ID}`;
    expect(piiScrubBeforeSend({ request: { url: seul } } as never)?.request?.url).toBe(seul);
  });
});

describe("document du projet — rien de la requête ne part (corps, état du routeur, Referer)", () => {
  /** Un événement tel que `@sentry/node-core` le compose : corps et en-têtes compris. */
  function evenement(url: string, data: unknown) {
    return {
      request: {
        url,
        method: "POST",
        query_string: `jeton=${JETON}`,
        data,
        headers: {
          "user-agent": "Mozilla/5.0",
          "next-router-state-tree": encodeURIComponent(
            JSON.stringify([
              "",
              { children: ["document", { children: [ID, { children: [JETON] }] }] },
            ]),
          ),
          "Next-Action": "7f3a9c0e1b2d",
          referer: URL_DOC,
          "next-url": `/document/${ID}/${JETON}`,
        },
      },
    };
  }

  const PROJET = `https://axion-ia.com/fr/admin-x/qualiopi/clients/${ID}/projets/${ID}`;
  const CORPS_MULTIPART =
    '------b\r\nContent-Disposition: form-data; name="fichier"; filename="CR-Martin.pdf"\r\n\r\n' +
    "%PDF-1.7 compte rendu confidentiel";

  it("🔴 lien public : ni corps, ni chaîne de requête, ni état du routeur, ni Referer — et le jeton nulle part", () => {
    const e = piiScrubBeforeSend(evenement(URL_DOC, { a: 1 }) as never);
    expect(e?.request?.data).toBeUndefined();
    expect(e?.request?.query_string).toBeUndefined();
    const entetes = Object.keys(e?.request?.headers ?? {}).map((k) => k.toLowerCase());
    for (const retire of ["next-router-state-tree", "next-action", "referer", "next-url"]) {
      expect(entetes).not.toContain(retire);
    }
    expect(entetes).toContain("user-agent");
    expect(JSON.stringify(e)).not.toContain(JETON);
  });

  it("🔴 envoi d'un fichier depuis la page du projet : le contenu du fichier ne part pas", () => {
    const e = piiScrubBeforeSend(evenement(PROJET, CORPS_MULTIPART) as never);
    expect(JSON.stringify(e)).not.toMatch(/compte rendu confidentiel|CR-Martin|7f3a9c0e1b2d/);
    expect(e?.request?.data).toBeUndefined();
  });

  it("même nettoyage pour une transaction", () => {
    const t = piiScrubBeforeSendTransaction({
      transaction: `/document/${ID}/${JETON}`,
      ...evenement(URL_DOC, CORPS_MULTIPART),
    } as never);
    expect(JSON.stringify(t)).not.toContain(JETON);
    expect(JSON.stringify(t)).not.toContain("compte rendu confidentiel");
  });

  it("contre-témoin : une autre route garde son corps (nettoyé) et ses en-têtes", () => {
    const e = piiScrubBeforeSend(
      evenement("https://axion-ia.com/fr/contact", { message: "Bonjour" }) as never,
    );
    expect(e?.request?.data).toEqual({ message: "Bonjour" });
    expect(Object.keys(e?.request?.headers ?? {})).toContain("Next-Action");
  });
});
