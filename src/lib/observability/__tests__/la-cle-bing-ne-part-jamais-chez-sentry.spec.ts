import { describe, expect, it } from "vitest";

import { ecarterFilDarianBing, optionsSentryServeur } from "../sentry-options";

describe("la clé Bing ne part jamais chez Sentry par un fil d'Ariane", () => {
  it("écarte un appel fetch vers Bing, garde les autres", () => {
    const bing = {
      category: "http",
      data: {
        url: "https://ssl.bing.com/webmaster/api.svc/json/GetPageStats",
        "http.query": "?apikey=XYZ",
      },
    };
    expect(ecarterFilDarianBing(bing)).toBeNull();
    expect(ecarterFilDarianBing({ data: { "http.query": "?apikey=XYZ" } })).toBeNull();
    const autre = { category: "http", data: { url: "https://axion-ia.com/fr" } };
    expect(ecarterFilDarianBing(autre)).toBe(autre);
  });

  it("est branché dans les options partagées (app et worker)", () => {
    expect(optionsSentryServeur("https://k@o.example/1").beforeBreadcrumb).toBe(
      ecarterFilDarianBing,
    );
  });
});
