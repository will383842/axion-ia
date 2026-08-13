// Agrégation des tunnels d'acquisition.
//
// ── Ce que ce fichier protège ─────────────────────────────────────────────
// Ces chiffres orientent des dépenses publicitaires. Un taux faux ne se voit
// pas : il s'affiche proprement et fait couper la mauvaise campagne. Chaque
// test ci-dessous fixe une propriété qui, si elle cassait, produirait un
// nombre plausible mais mensonger.

import { describe, it, expect } from "vitest";
import { agregerTunnels, type LigneTunnel } from "@/features/admin-tunnels/aggregate";

const T0 = new Date("2026-08-01T10:00:00.000Z");

function balise(sessionId: string, event: string, extra: Partial<LigneTunnel> = {}): LigneTunnel {
  return {
    funnel: "simulateur",
    event,
    sessionId,
    step: null,
    stepIndex: null,
    deviceType: "mobile",
    utmSource: null,
    utmCampaign: null,
    gainBucket: null,
    sector: null,
    createdAt: T0,
    ...extra,
  };
}

/** Parcours complet depuis la publicité, jusqu'à l'étape indiquée. */
function parcours(id: string, jusqua: string, extra: Partial<LigneTunnel> = {}): LigneTunnel[] {
  const suite = [
    "Landing Viewed",
    "Landing Video Played",
    "Landing CTA Clicked",
    "Simulator Started",
    "Simulator Completed",
    "Simulator Report Requested",
    "Simulator Callback Requested",
  ];
  const fin = suite.indexOf(jusqua);
  return suite.slice(0, fin + 1).map((e) => balise(id, e, extra));
}

describe("agregerTunnels — bases de calcul", () => {
  it("ne mélange PAS les deux populations dans un seul entonnoir", () => {
    // Le piège central. Deux visiteurs entrent directement sur `/simulateur`
    // sans jamais voir la page publicitaire. Si on les comptait au
    // dénominateur de « bouton cliqué », le taux de la page pub s'effondrerait
    // à 33 % au lieu de 100 % — et on couperait une campagne qui marche.
    const lignes = [
      ...parcours("pub-1", "Simulator Started"),
      balise("direct-1", "Simulator Started"),
      balise("direct-2", "Simulator Started"),
    ];

    const s = agregerTunnels(lignes);
    const pub = s.entonnoirs[0]!;
    const questionnaire = s.entonnoirs[1]!;

    expect(s.sessions).toBe(3);
    expect(s.sessionsPub).toBe(1);

    // L'entonnoir publicitaire ne connaît QUE la session venue de la pub.
    expect(pub.etapes.find((e) => e.cle === "vue")?.sessions).toBe(1);
    expect(pub.etapes.find((e) => e.cle === "clic")?.partDepuisBase).toBe(100);

    // L'entonnoir questionnaire, lui, compte les trois.
    expect(questionnaire.etapes[0]?.sessions).toBe(3);
  });

  it("calcule la part depuis l'étape PRÉCÉDENTE, pas seulement depuis la base", () => {
    // Sans ce taux intermédiaire, une chute brutale à une seule étape se
    // dilue dans le taux global et devient invisible.
    const lignes = [
      ...parcours("a", "Simulator Callback Requested"),
      ...parcours("b", "Simulator Completed"),
      ...parcours("c", "Landing CTA Clicked"),
      ...parcours("d", "Landing Viewed"),
    ];

    const pub = agregerTunnels(lignes).entonnoirs[0]!;
    const clic = pub.etapes.find((e) => e.cle === "clic")!;
    const ouvert = pub.etapes.find((e) => e.cle === "demarre")!;

    expect(clic.sessions).toBe(3); // a, b, c
    expect(clic.partDepuisBase).toBe(75); // 3 / 4
    expect(ouvert.sessions).toBe(2); // a, b
    expect(ouvert.partDepuisPrecedente).toBeCloseTo(66.7, 1); // 2 / 3
    expect(ouvert.perdues).toBe(1);
  });

  it("ne divise jamais par zéro sur un jeu vide", () => {
    const s = agregerTunnels([]);
    expect(s.sessions).toBe(0);
    expect(s.entonnoirs[0]?.etapes.every((e) => e.partDepuisBase === 0)).toBe(true);
    expect(s.abandonParEcran).toEqual([]);
  });

  it("compte une SESSION une seule fois, même si elle rejoue un événement", () => {
    // Un visiteur qui recharge la page émet plusieurs fois « page affichée ».
    // Compter les balises et non les sessions gonflerait le haut de
    // l'entonnoir et écraserait tous les taux en dessous.
    const lignes = [
      balise("a", "Landing Viewed"),
      balise("a", "Landing Viewed"),
      balise("a", "Landing Viewed"),
      balise("a", "Simulator Started"),
    ];
    const s = agregerTunnels(lignes);
    expect(s.sessionsPub).toBe(1);
    expect(s.entonnoirs[0]?.etapes[0]?.sessions).toBe(1);
  });
});

describe("agregerTunnels — statistiques par tunnel", () => {
  it("attribue chaque session au tunnel où elle a COMMENCÉ", () => {
    // Une session entrée par la page publicitaire puis passée au
    // questionnaire touche deux tunnels. Elle appartient au premier.
    const lignes = [
      balise("a", "Landing Viewed", {
        funnel: "diagnostic",
        createdAt: new Date("2026-08-01T10:00:00Z"),
      }),
      balise("a", "Simulator Started", {
        funnel: "simulateur",
        createdAt: new Date("2026-08-01T10:02:00Z"),
      }),
      balise("a", "Simulator Completed", {
        funnel: "simulateur",
        createdAt: new Date("2026-08-01T10:05:00Z"),
      }),
    ];

    const parTunnel = agregerTunnels(lignes).parTunnel;
    expect(parTunnel).toHaveLength(1);
    expect(parTunnel[0]?.cle).toBe("diagnostic");
    expect(parTunnel[0]?.questionnairesTermines).toBe(1);
  });

  it("SOMME exactement au nombre de sessions — la propriété qui rend les taux justes", () => {
    // Compter une session dans chaque tunnel touché ferait une somme
    // supérieure au total, et tout pourcentage bâti dessus serait faux sans
    // qu'aucun chiffre n'ait l'air aberrant.
    const lignes = [
      balise("a", "Landing Viewed", {
        funnel: "diagnostic",
        createdAt: new Date("2026-08-01T10:00:00Z"),
      }),
      balise("a", "Simulator Started", {
        funnel: "simulateur",
        createdAt: new Date("2026-08-01T10:01:00Z"),
      }),
      balise("b", "Simulator Started", {
        funnel: "simulateur",
        createdAt: new Date("2026-08-01T11:00:00Z"),
      }),
      balise("c", "Simulator Started", {
        funnel: "roi",
        createdAt: new Date("2026-08-01T12:00:00Z"),
      }),
    ];

    const s = agregerTunnels(lignes);
    const somme = s.parTunnel.reduce((n, t) => n + t.sessions, 0);
    expect(somme).toBe(s.sessions);
    expect(somme).toBe(3);
  });

  it("ne dépend PAS de l'ordre des lignes reçues", () => {
    // Se fier à l'ordre d'arrivée marcherait tant que l'appelant trie par date
    // croissante. Le jour où ce tri change, toutes les sessions basculeraient
    // silencieusement dans le mauvais tunnel.
    const tot = new Date("2026-08-01T10:00:00Z");
    const tard = new Date("2026-08-01T10:05:00Z");
    const desordre = [
      balise("a", "Simulator Started", { funnel: "simulateur", createdAt: tard }),
      balise("a", "Landing Viewed", { funnel: "diagnostic", createdAt: tot }),
    ];
    expect(agregerTunnels(desordre).parTunnel[0]?.cle).toBe("diagnostic");
  });

  it("nomme les tunnels lisiblement, et laisse passer une clé inconnue", () => {
    const lignes = [balise("a", "Simulator Started", { funnel: "roi" })];
    expect(agregerTunnels(lignes).parTunnel[0]?.libelle).toContain("/roi");
  });

  it("trie par volume, pour que le tunnel dominant soit en tête", () => {
    const lignes = [
      balise("a", "Simulator Started", { funnel: "roi" }),
      balise("b", "Simulator Started", { funnel: "simulateur" }),
      balise("c", "Simulator Started", { funnel: "simulateur" }),
    ];
    expect(agregerTunnels(lignes).parTunnel[0]?.cle).toBe("simulateur");
  });
});

describe("agregerTunnels — courbe d'abandon écran par écran", () => {
  const ecran = (id: string, rang: number, nom: string): LigneTunnel =>
    balise(id, "Simulator Step", { step: nom, stepIndex: rang });

  it("désigne l'écran exact où les visiteurs décrochent", () => {
    // Trois sessions atteignent l'écran 2 ; une seule va plus loin.
    const lignes = [
      balise("a", "Simulator Started"),
      ecran("a", 1, "sector"),
      ecran("a", 2, "functions"),
      ecran("a", 3, "volume:ventes"),
      balise("b", "Simulator Started"),
      ecran("b", 1, "sector"),
      ecran("b", 2, "functions"),
      balise("c", "Simulator Started"),
      ecran("c", 1, "sector"),
      ecran("c", 2, "functions"),
    ];

    const courbe = agregerTunnels(lignes).abandonParEcran;
    const deux = courbe.find((e) => e.stepIndex === 2)!;

    expect(deux.step).toBe("functions");
    expect(deux.atteintes).toBe(3);
    expect(deux.poursuivies).toBe(1);
    expect(deux.partAbandon).toBeCloseTo(66.7, 1);
  });

  it("n'accuse PAS le dernier écran d'un abandon qu'il ne cause pas", () => {
    // Le dernier écran n'a par définition aucun écran suivant. Sans la prise
    // en compte de « questionnaire terminé », il afficherait 100 % d'abandon
    // alors qu'il est celui qui convertit — et on aurait réécrit la question
    // qui marche le mieux.
    const lignes = [
      balise("a", "Simulator Started"),
      ecran("a", 1, "sector"),
      ecran("a", 2, "functions"),
      balise("a", "Simulator Completed"),
    ];

    const dernier = agregerTunnels(lignes).abandonParEcran.find((e) => e.stepIndex === 2)!;
    expect(dernier.atteintes).toBe(1);
    expect(dernier.poursuivies).toBe(1);
    expect(dernier.partAbandon).toBe(0);
  });

  it("rend la courbe dans l'ordre des écrans", () => {
    const lignes = [
      balise("a", "Simulator Started"),
      ecran("a", 3, "volume"),
      ecran("a", 1, "sector"),
      ecran("a", 2, "functions"),
    ];
    expect(agregerTunnels(lignes).abandonParEcran.map((e) => e.stepIndex)).toEqual([1, 2, 3]);
  });
});

describe("agregerTunnels — répartitions", () => {
  it("attribue une session à sa campagne même si les balises tardives l'omettent", () => {
    // L'attribution est relue du cookie à chaque balise, mais une session peut
    // commencer avant que le cookie ne soit lisible. On retient la première
    // valeur non vide, sinon la session basculerait en « Sans campagne » et
    // l'argent dépensé deviendrait introuvable.
    const lignes = [
      balise("a", "Landing Viewed", { utmCampaign: "aout-tpe", utmSource: "facebook" }),
      balise("a", "Simulator Started"),
      balise("a", "Simulator Completed"),
      balise("a", "Simulator Report Requested"),
    ];

    const ligne = agregerTunnels(lignes).parCampagne[0]!;
    expect(ligne.cle).toBe("aout-tpe");
    expect(ligne.sessions).toBe(1);
    expect(ligne.rapports).toBe(1);
    expect(ligne.partRapport).toBe(100);
  });

  it("range les sessions sans campagne à part, sans les perdre", () => {
    const lignes = [
      balise("a", "Simulator Started", { utmCampaign: "aout-tpe" }),
      balise("b", "Simulator Started"),
    ];
    const parCampagne = agregerTunnels(lignes).parCampagne;
    expect(parCampagne.map((l) => l.cle).sort()).toEqual(["Sans campagne", "aout-tpe"]);
    expect(parCampagne.reduce((n, l) => n + l.sessions, 0)).toBe(2);
  });

  it("trie par volume décroissant, pour que la campagne dominante soit en tête", () => {
    const lignes = [
      balise("a", "Simulator Started", { utmCampaign: "petite" }),
      balise("b", "Simulator Started", { utmCampaign: "grosse" }),
      balise("c", "Simulator Started", { utmCampaign: "grosse" }),
    ];
    expect(agregerTunnels(lignes).parCampagne[0]?.cle).toBe("grosse");
  });

  it("ne compte les tranches de gain que sur les rapports réellement demandés", () => {
    // Une tranche connue sans rapport demandé signifie que le visiteur a vu
    // son résultat et n'a pas laissé ses coordonnées. La compter gonflerait le
    // volume de prospects qualifiés.
    const lignes = [
      balise("a", "Simulator Completed", { gainBucket: "50k-150k" }),
      balise("b", "Simulator Completed", { gainBucket: "50k-150k" }),
      balise("b", "Simulator Report Requested", { gainBucket: "50k-150k" }),
    ];
    const tranches = agregerTunnels(lignes).parTranche;
    expect(tranches).toEqual([{ cle: "50k-150k", rapports: 1 }]);
  });
});

describe("agregerTunnels — totaux de tête", () => {
  it("compte séparément rapports et rappels, le rappel étant le lead le plus chaud", () => {
    const lignes = [
      ...parcours("a", "Simulator Callback Requested"),
      ...parcours("b", "Simulator Report Requested"),
      ...parcours("c", "Simulator Completed"),
    ];
    const s = agregerTunnels(lignes);
    expect(s.questionnairesTermines).toBe(3);
    expect(s.rapportsDemandes).toBe(2);
    expect(s.rappelsDemandes).toBe(1);
  });
});
