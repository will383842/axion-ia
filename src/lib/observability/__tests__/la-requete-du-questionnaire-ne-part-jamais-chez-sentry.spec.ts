/**
 * LA REQUÊTE DU QUESTIONNAIRE NE PART JAMAIS CHEZ SENTRY (veto de la relecture
 * sécurité sur la PR 1258, 2026-10-01).
 *
 * Le SDK serveur joint par défaut le CORPS de la requête entrante
 * (`event.request.data`) malgré `sendDefaultPii: false`. Sur la route publique
 * du questionnaire, ce corps porte le jeton (qui permet de répondre à la place
 * du client), les réponses et le nom de la personne ; l'en-tête
 * `Next-Router-State-Tree` et le `Referer` portent encore le jeton. Une panne
 * (Redis, base, file d'e-mails) suffisait à tout envoyer aux États-Unis.
 *
 * Le test construit des événements RÉALISTES (corps de formulaire d'action
 * serveur, en-têtes Next, cookies, chaîne de requête) et vérifie qu'après
 * nettoyage il ne reste ni jeton, ni réponse, ni nom.
 *
 * Mutation qui rougit : retirer `purgerRequeteSecrete` d'un des deux hooks ;
 * restreindre le motif de route (préfixe de langue, méthode dans le nom de
 * transaction). Contre-témoins : l'événement BRUT contient bien les secrets
 * (sinon le test ne prouverait rien), et le nettoyage générique seul — celui
 * d'une route ordinaire — laisse passer une réponse libre : c'est pourquoi on
 * supprime au lieu de masquer.
 */

import { describe, expect, it } from "vitest";

import {
  corpsAIgnorer,
  estRouteARequeteSecrete,
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "../sentry-pii-scrub";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "Qx3_vR9kLm2-Tz8wYp4sAb6dEf1gHj5nKc7uWq0oIt0";
const REPONSE = "Douze personnes à former, surtout la comptabilité";
const NOM = "Camille Exemple, DAF";
const Q = "11111111-1111-4111-8111-111111111111";
const URL_PAGE = `https://axion-ia.com/questionnaire/${ID}/${JETON}`;
const ARBRE = encodeURIComponent(
  JSON.stringify([
    "",
    {
      children: [
        "questionnaire",
        { children: [["id", ID, "d"], { children: [["jeton", JETON, "d"]] }] },
      ],
    },
  ]),
);

/** Ce que le SDK joint réellement à une erreur levée pendant l'action d'envoi. */
function evenementBrut(url = URL_PAGE) {
  return {
    request: {
      url: `${url}?erreur=vide`,
      method: "POST",
      query_string: "erreur=vide",
      data: `1_questionnaireId=${ID}&1_jeton=${JETON}&1_reponse_${Q}=${encodeURIComponent(REPONSE)}&1_repondant=${encodeURIComponent(NOM)}`,
      headers: {
        "Next-Router-State-Tree": ARBRE,
        "Next-Action": "4048427e40aa03856d8cf1187a9ce82131eb1061fa",
        Referer: URL_PAGE,
        Cookie: "axion_utm=x",
        "Content-Type": "multipart/form-data",
      },
      cookies: { axion_utm: "x" },
    },
    exception: { values: [{ type: "Error", value: "Redis indisponible" }] },
  };
}

const secrets = (o: unknown): string[] => {
  const s = JSON.stringify(o);
  return [JETON, encodeURIComponent(JETON), "Douze", "Camille", "Exemple"].filter((x) =>
    s.includes(x),
  );
};

describe("la requête du questionnaire ne part jamais chez Sentry", () => {
  it("contre-témoin : l'événement brut contient bien jeton, réponse et nom", () => {
    expect(secrets(evenementBrut())).toEqual(expect.arrayContaining([JETON, "Douze", "Camille"]));
  });

  it("🔴 erreur : ni jeton, ni réponse, ni nom après nettoyage (corps texte)", () => {
    const nettoye = piiScrubBeforeSend(evenementBrut() as never);
    expect(secrets(nettoye)).toEqual([]);
    expect(nettoye?.request?.data).toBeUndefined();
    expect(nettoye?.request?.cookies).toBeUndefined();
    expect(nettoye?.request?.query_string).toBeUndefined();
    const entetes = Object.keys(nettoye?.request?.headers ?? {}).map((k) => k.toLowerCase());
    expect(entetes).not.toContain("next-router-state-tree");
    expect(entetes).not.toContain("next-action");
    expect(entetes).not.toContain("referer");
    expect(entetes).not.toContain("cookie");
    // La route reste lisible pour le débogage.
    expect(nettoye?.request?.url).toBe(`https://axion-ia.com/questionnaire/${ID}/[TOKEN]`);
  });

  it("🔴 erreur : corps déjà décodé en objet", () => {
    const e = evenementBrut();
    (e.request as Record<string, unknown>)["data"] = {
      "1_jeton": JETON,
      [`1_reponse_${Q}`]: REPONSE,
      "1_repondant": NOM,
    };
    expect(secrets(piiScrubBeforeSend(e as never))).toEqual([]);
  });

  it("🔴 transaction : même purge (corps, en-têtes, nom de transaction)", () => {
    const t = {
      ...evenementBrut(),
      transaction: `POST /questionnaire/${ID}/${JETON}`,
      contexts: { trace: { data: { "http.target": `/questionnaire/${ID}/${JETON}` } } },
    };
    expect(secrets(piiScrubBeforeSendTransaction(t as never))).toEqual([]);
  });

  it("🔴 le préfixe de langue et la route voisine `/document/` sont couverts", () => {
    for (const url of [
      `https://axion-ia.com/fr/questionnaire/${ID}/${JETON}`,
      `https://axion-ia.com/document/${ID}/${JETON}`,
    ]) {
      const nettoye = piiScrubBeforeSend(evenementBrut(url) as never);
      expect(nettoye?.request?.data, url).toBeUndefined();
      expect(JSON.stringify(nettoye), url).not.toContain("Douze");
    }
  });

  it("contre-témoin : sur une route ordinaire, le nettoyage générique laisse une réponse libre", () => {
    // C'est la raison de la purge : un texte libre n'a pas de forme à masquer.
    const nettoye = piiScrubBeforeSend(evenementBrut("https://axion-ia.com/fr/contact") as never);
    expect(JSON.stringify(nettoye)).toContain("Douze");
  });

  it("le SDK ne lit même pas le corps de ces routes (`ignoreIncomingRequestBody`)", () => {
    expect(corpsAIgnorer(`/questionnaire/${ID}/${JETON}`)).toBe(true);
    expect(corpsAIgnorer(`https://axion-ia.com/questionnaire/${ID}/${JETON}?envoye=1`)).toBe(true);
    expect(corpsAIgnorer("/document/abc")).toBe(true);
    // Contre-témoins : routes voisines par le nom, et pages ordinaires.
    expect(corpsAIgnorer("/questionnaire-satisfaction")).toBe(false);
    expect(corpsAIgnorer("/fr/contact")).toBe(false);
    expect(estRouteARequeteSecrete("/fr/portail/questionnaire/x")).toBe(false);
  });
});
