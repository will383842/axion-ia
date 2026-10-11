/**
 * LE JETON DU LIEN PRIVÉ D'ENVOI DE FICHIERS NE SORT PAS VERS SENTRY
 * (Candidatures unifiées L5, ADR 0065 D6).
 *
 * `/api/partage/<uuid>/<jeton>[/<fichierId>]` : le jeton (HMAC base64url,
 * 43 caractères) ouvre les fichiers envoyés à un candidat. Il échappe à
 * `HEX_TOKEN_RE` et `JWT_RE` : sans entrée dans `SEGMENTS_SECRETS`, il partirait
 * en clair chez un sous-traitant hors UE.
 *
 * Contre-épreuve : l'identifiant du lien et celui du fichier restent lisibles.
 */

import { describe, expect, it } from "vitest";

import {
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "@/lib/observability/sentry-pii-scrub";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const FICHIER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const JETON = "Qx3_vR9kLm2-Tz8wYp4sAb6dEf1gHj5nKc7uWq0oIt0";

describe("lien privé d'envoi de fichiers — le jeton est masqué", () => {
  it("dans l'URL de la page et dans celle d'un téléchargement", () => {
    for (const url of [
      `https://axion-ia.com/api/partage/${ID}/${JETON}`,
      `https://axion-ia.com/api/partage/${ID}/${JETON}/${FICHIER}`,
      `https://axion-ia.com/api/partage/${ID}/${JETON}?a=1`,
    ]) {
      const nettoye = piiScrubBeforeSend({ request: { url } } as never);
      expect(nettoye?.request?.url).not.toContain(JETON);
      expect(nettoye?.request?.url).toContain(`/api/partage/${ID}/[TOKEN]`);
    }
    const t = piiScrubBeforeSend({
      request: { url: `https://axion-ia.com/api/partage/${ID}/${JETON}/${FICHIER}` },
    } as never);
    expect(t?.request?.url).toContain(`/[TOKEN]/${FICHIER}`);
  });

  it("dans une transaction (nom et http.target)", () => {
    const nettoye = piiScrubBeforeSendTransaction({
      transaction: `/api/partage/${ID}/${JETON}`,
      contexts: { trace: { data: { "http.target": `/api/partage/${ID}/${JETON}` } } },
    } as never);
    expect(nettoye?.transaction).toBe(`/api/partage/${ID}/[TOKEN]`);
    const cible = (nettoye?.contexts?.["trace"] as { data?: Record<string, unknown> } | undefined)
      ?.data?.["http.target"];
    expect(String(cible)).not.toContain(JETON);
  });

  it("contre-épreuve : l'identifiant seul reste lisible", () => {
    const seul = `https://axion-ia.com/api/partage/${ID}`;
    expect(piiScrubBeforeSend({ request: { url: seul } } as never)?.request?.url).toBe(seul);
  });
});
