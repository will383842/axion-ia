// Fiche SITE-PETITS — le jeton `?j=` du lien « Recevoir le guide » et le jeton `?t=` du
// téléchargement ne partent jamais chez Sentry (URL, query, transaction, corps).
import { describe, expect, it } from "vitest";

import {
  corpsAIgnorer,
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "../sentry-pii-scrub";

const JETON = "Zm9vYmFyLWV4ZW1wbGU.c2lnLWV4ZW1wbGUtMDEyMzQ1Njc4OQ";
const ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["/guide-reseau", "j"],
  ["/fr/guide-reseau/envoyer", "j"],
  ["/api/guide-ia/telecharger", "t"],
];

describe("le lien du guide réseau ne part jamais chez Sentry", () => {
  it.each(ROUTES)("🔴 %s : ni jeton ni query dans l'erreur", (chemin, cle) => {
    const evt = {
      request: {
        url: `https://axion-ia.com${chemin}?${cle}=${JETON}`,
        query_string: `${cle}=${JETON}`,
        data: `${cle}=${JETON}`,
        headers: { Referer: `https://axion-ia.com${chemin}?${cle}=${JETON}` },
      },
    };
    const sortie = JSON.stringify(piiScrubBeforeSend(evt as never));
    expect(sortie).not.toContain(JETON);
    expect(corpsAIgnorer(`https://axion-ia.com${chemin}?${cle}=${JETON}`)).toBe(true);
  });

  it.each(ROUTES)("🔴 %s : ni jeton dans la transaction", (chemin, cle) => {
    const evt = {
      type: "transaction",
      transaction: `GET ${chemin}`,
      request: {
        url: `https://axion-ia.com${chemin}?${cle}=${JETON}`,
        query_string: `${cle}=${JETON}`,
      },
    };
    const sortie = JSON.stringify(piiScrubBeforeSendTransaction(evt as never));
    expect(sortie).not.toContain(JETON);
  });

  it("une clé de query `j` ou `t` est masquée dans l'URL même hors de ces routes", () => {
    const evt = { request: { url: `https://axion-ia.com/fr/autre?x=1&j=${JETON}` } };
    expect(JSON.stringify(piiScrubBeforeSend(evt as never))).not.toContain(JETON);
  });

  it("contre-témoin : une route voisine par le nom n'est pas purgée", () => {
    expect(corpsAIgnorer("/fr/guide-reseaux-aide")).toBe(false);
    expect(corpsAIgnorer("/api/guide-ia/statut")).toBe(false);
  });
});
