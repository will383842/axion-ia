/**
 * Fraîcheur du sujet — garde-fou contre la republication de dépêches périmées.
 *
 * Incident réel du 2026-08-15, constaté en production dans l'heure suivant la
 * mise en service de la reprise du retard : quatre dépêches datées du 6 juillet
 * ont été republiées le 15 août, en pleine page « actualités ».
 *
 * La cause tient à une différence de nature entre deux familles de jobs, que le
 * classement par message d'erreur ne pouvait pas voir : un job de campagne ne
 * porte aucun sujet (le mot-clé est pioché à l'exécution, donc une relance
 * produit du contenu frais), tandis qu'un job RSS porte la dépêche entière,
 * figée à sa date de parution.
 */

import { describe, it, expect } from "vitest";
import { isAutoRetryable, isTopicStillFresh } from "../failure-classifier";

const NOW = new Date("2026-08-15T16:00:00.000Z");

/** Charge utile réelle d'un job RSS, relevée en production. */
function rssPayload(pubDate: string) {
  return {
    rssGuid: "https://exemple.fr/article/123",
    rssTitle: "MiniMax : ses modèles disponibles sur Amazon Bedrock",
    rssPubDate: pubDate,
    rssDescription: "…",
  };
}

/** Charge utile réelle d'un job de campagne : ni sujet ni mot-clé. */
const CAMPAIGN_PAYLOAD = {
  vertical: "interventions_formations",
  slotIndex: 2,
  campaignName: "AURA + Île-de-France",
};

describe("isTopicStillFresh", () => {
  it("refuse la dépêche de juillet republiée le 15 août (le cas réel)", () => {
    expect(isTopicStillFresh("blog_from_rss", rssPayload("2026-07-06T19:00:44.000Z"), NOW)).toBe(
      false,
    );
  });

  it("accepte une dépêche du jour", () => {
    expect(isTopicStillFresh("blog_from_rss", rssPayload("2026-08-15T06:00:00.000Z"), NOW)).toBe(
      true,
    );
  });

  it("accepte encore une dépêche de la veille, refuse celle d'il y a une semaine", () => {
    expect(isTopicStillFresh("blog_from_rss", rssPayload("2026-08-14T16:00:00.000Z"), NOW)).toBe(
      true,
    );
    expect(isTopicStillFresh("blog_from_rss", rssPayload("2026-08-08T16:00:00.000Z"), NOW)).toBe(
      false,
    );
  });

  it("refuse une dépêche sans date exploitable", () => {
    // On ne peut pas déclarer fraîche une source qu'on ne sait pas dater.
    expect(isTopicStillFresh("blog_from_rss", {}, NOW)).toBe(false);
    expect(isTopicStillFresh("blog_from_rss", { rssPubDate: "pas une date" }, NOW)).toBe(false);
    expect(isTopicStillFresh("blog_from_rss", null, NOW)).toBe(false);
  });

  it("n'entrave JAMAIS un job de campagne, si vieux soit-il", () => {
    // C'est tout l'intérêt de la reprise : ces jobs ne portent aucun sujet, le
    // mot-clé est pioché à l'exécution — une relance produit du contenu frais.
    expect(isTopicStillFresh("how_to_x_in_y", CAMPAIGN_PAYLOAD, NOW)).toBe(true);
    expect(isTopicStillFresh("blog_article", CAMPAIGN_PAYLOAD, NOW)).toBe(true);
    expect(isTopicStillFresh("faq_geo", null, NOW)).toBe(true);
  });
});

describe("isAutoRetryable — la fraîcheur prime sur la cause de l'échec", () => {
  it("ne relance pas une dépêche périmée, même sur un échec parfaitement transitoire", () => {
    // Le message d'erreur seul disait « transitoire, relance-moi » ; c'est
    // exactement ce raisonnement qui a republié l'actualité de juillet.
    expect(
      isAutoRetryable("OpenAI rate limited", 0, 3, {
        contentType: "blog_from_rss",
        inputPayload: rssPayload("2026-07-06T19:00:44.000Z"),
      }),
    ).toBe(false);
  });

  it("relance un job de campagne sur le même échec transitoire", () => {
    expect(
      isAutoRetryable("OpenAI rate limited", 0, 3, {
        contentType: "how_to_x_in_y",
        inputPayload: CAMPAIGN_PAYLOAD,
      }),
    ).toBe(true);
  });

  it("garde son comportement d'origine quand le job n'est pas fourni", () => {
    expect(isAutoRetryable("OpenAI rate limited", 0, 3)).toBe(true);
  });
});
