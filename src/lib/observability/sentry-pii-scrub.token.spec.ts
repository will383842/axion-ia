/**
 * Le jeton d'émargement ne doit JAMAIS sortir vers Sentry.
 *
 * Un jeton d'émargement reste valable jusqu'à la fin de session + 48 h. Le
 * laisser partir chez un sous-traitant hors UE, c'est lui offrir la capacité de
 * signer une feuille de présence à la place d'un stagiaire — et c'est un
 * transfert de données non prévu au registre.
 *
 * Il échappait aux DEUX filtres existants : il n'est pas hexadécimal
 * (`HEX_TOKEN_RE`) et n'a que deux segments, pas trois (`JWT_RE`). Et surtout, il
 * vit dans le CHEMIN de l'URL — que le scrubber ne touchait pas du tout.
 */

import { describe, it, expect } from "vitest";
import {
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "@/lib/observability/sentry-pii-scrub";

/** Forme réelle d'un jeton `magic-token.ts` : base64url, deux segments. */
const JETON =
  "eyJzY29wZSI6ImVtYXJnZW1lbnQiLCJyZXNvdXJjZUlkIjoiYWJjIn0.KJ8sd7fKJHsdf87sdfKJHSDF87sdfkjh";
const URL_SIGNATURE = `https://axion-ia.com/fr/portail/emarger/${JETON}`;

describe("piiScrubBeforeSend — jeton dans le chemin", () => {
  it("🔴 masque le jeton d'émargement dans `request.url`", () => {
    const nettoye = piiScrubBeforeSend({ request: { url: URL_SIGNATURE } } as never);
    expect(nettoye?.request?.url).not.toContain(JETON);
    expect(nettoye?.request?.url).toContain("[TOKEN]");
  });

  it("garde la route lisible — un débogage sans route ne sert à rien", () => {
    const nettoye = piiScrubBeforeSend({ request: { url: URL_SIGNATURE } } as never);
    expect(nettoye?.request?.url).toContain("/portail/emarger/");
  });

  it.each([
    ["annulation de réservation", `https://axion-ia.com/fr/booking/${JETON}/cancel`],
    ["vérification d'attestation", `https://axion-ia.com/fr/verifier-attestation/${JETON}`],
    ["accès portail", `https://axion-ia.com/fr/portail/acces/${JETON}`],
  ])("masque aussi le jeton de %s", (_, url) => {
    const nettoye = piiScrubBeforeSend({ request: { url } } as never);
    expect(nettoye?.request?.url).not.toContain(JETON);
  });

  it("masque un jeton apparaissant dans un message d'exception", () => {
    const nettoye = piiScrubBeforeSend({
      exception: { values: [{ value: `Échec pour le jeton ${JETON}` }] },
    } as never);
    expect(nettoye?.exception?.values?.[0]?.value).not.toContain(JETON);
  });

  it("⭐ masque même un jeton TROP COURT pour la regex — c'est le rôle du masquage par route", () => {
    // Les deux gardes sont complémentaires, et ce test rend la seconde
    // nécessaire : `MAGIC_TOKEN_RE` exige 20 caractères par segment pour ne pas
    // mordre sur du texte ordinaire contenant un point. Un format de jeton plus
    // court passerait donc entre ses mailles — mais pas entre celles du
    // masquage par route, qui ne regarde pas la forme du segment.
    const court = "abc.def";
    const url = `https://axion-ia.com/fr/portail/emarger/${court}`;
    const nettoye = piiScrubBeforeSend({ request: { url } } as never);
    expect(nettoye?.request?.url).toBe("https://axion-ia.com/fr/portail/emarger/[TOKEN]");
  });

  it("🔴 masque le jeton dans `contexts.trace.data['http.target']`", () => {
    // Sentry pour Next y recopie le CHEMIN BRUT de la requête. La docstring du
    // module annonçait `contexts` comme nettoyé ; il ne l'était pas, ni dans les
    // erreurs ni dans les transactions. Le jeton partait donc malgré le
    // nettoyage de `request.url`.
    const nettoye = piiScrubBeforeSend({
      contexts: { trace: { data: { "http.target": `/fr/portail/emarger/${JETON}` } } },
    } as never);
    const cible = (nettoye?.contexts?.["trace"] as { data?: Record<string, unknown> } | undefined)
      ?.data?.["http.target"];
    expect(String(cible)).not.toContain(JETON);
    expect(String(cible)).toContain("[TOKEN]");
  });

  it("n'abîme pas une URL sans secret", () => {
    const url = "https://axion-ia.com/fr/formations/bien-demarrer-avec-l-ia";
    expect(piiScrubBeforeSend({ request: { url } } as never)?.request?.url).toBe(url);
  });
});

describe("piiScrubBeforeSendTransaction — le hook qui manquait", () => {
  it("🔴 masque le jeton d'une TRANSACTION, sans qu'aucune erreur ne survienne", () => {
    // `beforeSend` ne couvre que les erreurs. Avec un échantillonnage de
    // performance actif, le jeton partait sur une requête parfaitement normale.
    const nettoye = piiScrubBeforeSendTransaction({
      transaction: `/fr/portail/emarger/${JETON}`,
      request: { url: URL_SIGNATURE },
    } as never);

    expect(nettoye?.request?.url).not.toContain(JETON);
    expect(nettoye?.transaction).not.toContain(JETON);
    expect(nettoye?.transaction).toContain("[TOKEN]");
  });

  it("masque aussi `http.target` sur une TRANSACTION", () => {
    const nettoye = piiScrubBeforeSendTransaction({
      contexts: { trace: { data: { "http.target": `/fr/portail/emarger/${JETON}` } } },
    } as never);
    const cible = (nettoye?.contexts?.["trace"] as { data?: Record<string, unknown> } | undefined)
      ?.data?.["http.target"];
    expect(String(cible)).not.toContain(JETON);
  });

  it("retourne bien la transaction — la jeter perdrait tout le traçage", () => {
    const evt = { transaction: "/fr/formations", request: { url: "https://a.test/fr" } };
    expect(piiScrubBeforeSendTransaction(evt as never)).not.toBeNull();
  });
});
