// Émission des balises de tunnel.
//
// ── Ce que ce fichier protège ─────────────────────────────────────────────
// Deux propriétés, toutes deux invisibles si elles cassent :
//
// 1. **La bonne page est mesurée, et elle seule.** `funnelKeyFromPath` décide
//    seule si une balise part. Une erreur ici rend un tunnel entier muet sans
//    lever la moindre exception — on croirait simplement que personne ne
//    visite la page.
// 2. **La mesure ne casse jamais le tunnel.** Un `sessionStorage` interdit
//    (navigation privée) ou un `sendBeacon` absent ne doit produire aucune
//    exception : une panne de statistiques ne doit pas coûter un prospect.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { funnelKeyFromPath, sendFunnelBeacon } from "@/lib/analytics/funnel-beacon";
import { funnelEventSchema } from "@/lib/schemas/funnel-event-schema";

describe("funnelKeyFromPath", () => {
  it("reconnaît les trois pages du tunnel, avec ou sans préfixe de langue", () => {
    expect(funnelKeyFromPath("/fr/diagnostic")).toBe("diagnostic");
    expect(funnelKeyFromPath("/diagnostic")).toBe("diagnostic");
    expect(funnelKeyFromPath("/fr/simulateur")).toBe("simulateur");
    expect(funnelKeyFromPath("/fr/roi")).toBe("roi");
  });

  it("ne se laisse pas piéger par une correspondance PARTIELLE", () => {
    // Le piège concret : `/interventions/diagnostic-express` est une page de
    // service sans rapport. Un `includes` nu l'aurait comptée comme du tunnel
    // publicitaire et aurait gonflé les entrées de plusieurs centaines de
    // visites par mois, sans que rien ne signale l'erreur.
    expect(funnelKeyFromPath("/fr/interventions/diagnostic-express")).toBeNull();
    expect(funnelKeyFromPath("/fr/blog/le-roi-de-lautomatisation")).toBeNull();
    expect(funnelKeyFromPath("/fr/simulateur-de-couts-cache")).toBeNull();
  });

  it("rend null hors tunnel, sans jamais lever", () => {
    expect(funnelKeyFromPath("/")).toBeNull();
    expect(funnelKeyFromPath("")).toBeNull();
    expect(funnelKeyFromPath(null)).toBeNull();
    expect(funnelKeyFromPath(undefined)).toBeNull();
  });
});

describe("sendFunnelBeacon", () => {
  let envoyees: Array<{ url: string; corps: unknown }>;

  const allerSur = (chemin: string): void => {
    window.history.replaceState({}, "", chemin);
  };

  beforeEach(() => {
    envoyees = [];
    window.sessionStorage.clear();
    vi.stubGlobal("navigator", {
      ...window.navigator,
      sendBeacon: (url: string, data: Blob) => {
        // `Blob.text()` est asynchrone : on retient l'objet et on le lira dans
        // l'assertion, qui peut, elle, attendre.
        envoyees.push({ url, corps: data });
        return true;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  const lireCorps = async (index: number): Promise<Record<string, unknown>> => {
    const brut = envoyees[index]?.corps as Blob;
    // Ni `Blob.text()` ni `Response` ne savent lire ce Blob : jsdom fournit sa
    // propre implémentation, étrangère à celle du runtime Node. `FileReader`,
    // lui, vient du même jsdom. On lit donc réellement le corps envoyé plutôt
    // que d'affaiblir l'assertion en inspectant l'objet.
    const texte = await new Promise<string>((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(String(lecteur.result));
      lecteur.onerror = () => reject(new Error("lecture du Blob impossible"));
      lecteur.readAsText(brut);
    });
    return JSON.parse(texte) as Record<string, unknown>;
  };

  it("n'émet RIEN hors d'une page de tunnel", () => {
    allerSur("/fr/a-propos");
    sendFunnelBeacon("Simulator Started");
    expect(envoyees).toHaveLength(0);
  });

  it("n'émet rien pour un événement non journalisé", () => {
    // `trackFunnel` est utilisé par tout le site (réservation, paiement,
    // chatbot). Seuls les événements d'acquisition doivent atteindre la table.
    allerSur("/fr/simulateur");
    sendFunnelBeacon("Payment Completed");
    expect(envoyees).toHaveLength(0);
  });

  it("émet une charge conforme au schéma serveur", async () => {
    allerSur("/fr/simulateur");
    sendFunnelBeacon("Simulator Step", { step: "sector", stepIndex: 2, stepTotal: 9 });

    expect(envoyees).toHaveLength(1);
    expect(envoyees[0]?.url).toBe("/api/funnel");
    const corps = await lireCorps(0);
    expect(corps.funnel).toBe("simulateur");
    expect(corps.event).toBe("Simulator Step");
    expect(corps.step).toBe("sector");
    expect(corps.stepIndex).toBe(2);
    expect(corps.route).toBe("/fr/simulateur");
    expect(String(corps.sessionId).length).toBeGreaterThanOrEqual(8);
  });

  it("N'ENVOIE JAMAIS les champs d'attribution, que le serveur relit lui-même", async () => {
    // Une valeur d'attribution venue du client est falsifiable. Le schéma
    // serveur refuse d'ailleurs toute clé inconnue : envoyer `utmSource` ferait
    // rejeter la balise ENTIÈRE, donc perdre l'événement.
    allerSur("/fr/diagnostic");
    sendFunnelBeacon("Landing CTA Clicked", {
      placement: "hero",
      utmSource: "facebook",
      utmCampaign: "test",
      intervention: "essentielle",
      priceBucket: "1000-2000",
    });

    const corps = await lireCorps(0);
    expect(corps).not.toHaveProperty("utmSource");
    expect(corps).not.toHaveProperty("utmCampaign");
    expect(corps).not.toHaveProperty("intervention");
    expect(corps).not.toHaveProperty("priceBucket");
    expect(corps.placement).toBe("hero");
  });

  it("garde le même identifiant sur toute la session, pour chaîner le parcours", async () => {
    allerSur("/fr/diagnostic");
    sendFunnelBeacon("Landing Viewed", { landing: "diagnostic" });
    allerSur("/fr/simulateur");
    sendFunnelBeacon("Simulator Started");

    const premier = await lireCorps(0);
    const second = await lireCorps(1);
    expect(premier.sessionId).toBe(second.sessionId);
    // Le tunnel, lui, change : c'est ce couple qui montre l'entrée par la page
    // publicitaire et la complétion sur le questionnaire.
    expect(premier.funnel).toBe("diagnostic");
    expect(second.funnel).toBe("simulateur");
  });

  it("émet une charge que le schéma SERVEUR accepte réellement", async () => {
    // 🔴 Le verrou décisif. Le serveur refuse toute clé inconnue : une seule
    // propriété de trop côté client ferait rejeter la balise ENTIÈRE, en
    // silence — aucune erreur visible, simplement une table qui reste vide.
    // On rejoue donc ici la validation exacte de `POST /api/funnel`.
    allerSur("/fr/simulateur");
    sendFunnelBeacon("Simulator Completed", {
      sector: "batiment",
      headcount: "11-50",
      gainBucket: "50k-150k",
      taskCount: 7,
      stepIndex: 9,
      stepTotal: 9,
    });

    const verdict = funnelEventSchema.safeParse(await lireCorps(0));
    expect(verdict.success, JSON.stringify(verdict.error?.issues ?? [])).toBe(true);
  });

  it("ne lève pas quand le stockage de session est interdit", () => {
    // Cas réel : navigation privée stricte, ou blocage du stockage par
    // l'utilisateur. On renonce à la mesure, on ne casse pas la page.
    const espion = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage refusé");
    });
    allerSur("/fr/simulateur");
    expect(() => sendFunnelBeacon("Simulator Started")).not.toThrow();
    expect(envoyees).toHaveLength(0);
    espion.mockRestore();
  });

  it("ne lève pas quand aucun moyen d'envoi n'existe", () => {
    vi.stubGlobal("navigator", { ...window.navigator, sendBeacon: undefined });
    vi.stubGlobal("fetch", () => Promise.reject(new Error("hors ligne")));
    allerSur("/fr/simulateur");
    expect(() => sendFunnelBeacon("Simulator Started")).not.toThrow();
  });
});
