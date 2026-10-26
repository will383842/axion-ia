// Le Tour de France IA est un tunnel de la console, au même rang que les autres
// (2026-10-26, question de Will : « le Tour est-il dans la console avec les
// autres tunnels ? »).
//
// Ce fichier verrouille le CHEMIN entier, du bouton de la landing à l'écran :
//   1. le bouton porte `depuis=tdf-…`, que la page de rendez-vous recopie dans
//      l'`utm_term` et complète d'une source UTM par défaut (`tour:tdf-…` ne vaut
//      que pour le mode de secours de l'iframe) ;
//   2. le rendez-vous se classe `tour_de_france_ia`, famille CLIENT ;
//   3. la console le montre : ligne dans « Par tunnel », onglet propre, compteurs
//      clics → rendez-vous pris → maintenus, libellé lisible de chaque bouton ;
//   4. 🔴 la landing, elle, ne porte toujours AUCUNE mesure.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { agregerBilan, libelleEmplacement } from "@/features/admin-rendezvous/bilan-rendez-vous";
import { passeLeFiltre } from "@/features/admin-rendezvous/type-rdv";
import { TUNNELS_CONNUS, agregerTunnels } from "@/features/admin-tunnels/aggregate";
import { lireTunnel } from "@/features/admin-tunnels/query";
import {
  SEUIL_TRANSFORMATION,
  boutonDeUtmContent,
  construireTableauTour,
} from "@/features/admin-tunnels/tour-entonnoir";
import { funnelKeyFromPath, sendFunnelBeacon } from "@/lib/analytics/funnel-beacon";
import { funnelEventSchema } from "@/lib/schemas/funnel-event-schema";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import {
  lireDepuis,
  typeDuChoix,
  utmContentDuChoix,
  utmSourceParDefaut,
} from "@/server/calendly/choix-rendez-vous";
import { classerParNom, typePorteLesReponses } from "@/server/calendly/type-rendez-vous";
import { choixDeLaRoute } from "@/server/calendly/types-reservables";

const RACINE = join(__dirname, "../../../..");
const lire = (chemin: string): string => readFileSync(join(RACINE, chemin), "utf8");
const TUNNELS = "src/app/[locale]/(admin)/[adminPrefix]/tunnels";

/** Toutes les sources de la landing, hors tests (même parcours que `le-tour-est-ouvert`). */
function sourcesLanding(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((nom) => {
    const chemin = `${dossier}/${nom}`;
    if (nom === "__tests__") return [];
    return statSync(join(RACINE, chemin)).isDirectory() ? sourcesLanding(chemin) : [chemin];
  });
}

describe("1. du bouton à la page de rendez-vous : `depuis` et UTM", () => {
  it("le bouton mène à la page du Tour avec son repère", () => {
    // Lu dans la source (une spec de `features/` n'importe pas `app/`).
    const contenu = lire("src/app/tourdefrance-ia/contenu.ts");
    expect(contenu).toContain('CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia"');
    expect(contenu).toContain("`${CHEMIN_RENDEZ_VOUS}?depuis=${encodeURIComponent(depuis)}`");
    const url = new URL("/fr/appel/tour-de-france-ia?depuis=tdf-heros", "https://exemple.invalid");
    // La page de rendez-vous accepte le repère tel quel…
    expect(lireDepuis(url.searchParams.get("depuis"))).toBe("tdf-heros");
  });

  it("la page sert le choix `tour`, classé `tour_de_france_ia`", () => {
    expect(choixDeLaRoute("tour-de-france-ia")).toBe("tour");
    expect(typeDuChoix("tour")).toBe("tour_de_france_ia");
  });

  it("…le repère du bouton est recopié dans l'utm_content du mode de secours de l'iframe, avec une source par défaut", () => {
    for (const depuis of ["tdf-heros", "tdf-final", "tdf-bandeau", "tdf-collant"]) {
      expect(utmContentDuChoix("tour", depuis)).toBe(`tour:${depuis}`);
      expect(boutonDeUtmContent(utmContentDuChoix("tour", depuis))).toBe(depuis);
    }
    expect(utmSourceParDefaut("tour")).toBe("tour-de-france-ia");
  });

  it("la page de rendez-vous du Tour, et elle seule, émet l'arrivée (clic « Participer »)", () => {
    const page = lire("src/app/[locale]/appel/page.tsx");
    expect(page).toMatch(
      /choix === "tour" \? \(\s*<ArriveeReservationMesure landing="tour-de-france-ia" placement=\{depuis\} \/>/,
    );
    expect(funnelKeyFromPath("/fr/appel/tour-de-france-ia")).toBe("tour");
    // La balise qu'elle produit passe le schéma strict de l'API.
    expect(
      funnelEventSchema.safeParse({
        funnel: "tour",
        event: "Call Booking Viewed",
        sessionId: "s-12345678",
        route: "/fr/appel/tour-de-france-ia",
        landing: "tour-de-france-ia",
        placement: "tdf-heros",
      }).success,
    ).toBe(true);
  });
});

describe("2. le classement du rendez-vous", () => {
  it("le nom Calendly du Tour donne `tour_de_france_ia`, famille client", () => {
    expect(classerParNom("Tour de France IA")).toBe("tour_de_france_ia");
    expect(classerParNom("tour-de-france-ia")).toBe("tour_de_france_ia");
    expect(estAppelApporteur("Tour de France IA")).toBe(false);
    expect(passeLeFiltre("tour_de_france_ia", "clients")).toBe(true);
    expect(passeLeFiltre("tour_de_france_ia", "apporteurs")).toBe(false);
    expect(typePorteLesReponses("tour_de_france_ia")).toBe(true);
  });
});

describe("3. la console montre le Tour comme les autres tunnels", () => {
  it("une ligne « Tour de France IA » dans « Par tunnel », même à zéro", () => {
    expect(TUNNELS_CONNUS.find((t) => t.cle === "tour")).toEqual({
      cle: "tour",
      libelle: "Tour de France IA",
      chemin: "/tourdefrance-ia",
    });
    const ligne = agregerTunnels([]).parTunnel.find((t) => t.cle === "tour");
    expect(ligne?.libelle).toBe("Tour de France IA (/tourdefrance-ia)");
    expect(ligne?.sessions).toBe(0);
    expect(lireTunnel("tour")).toBe("tour");
  });

  it("un onglet « Tunnel Tour de France IA », et la ligne y mène", () => {
    const layout = lire(`${TUNNELS}/layout.tsx`);
    expect(layout).toContain(
      '{ id: "tour", label: "Tunnel Tour de France IA", href: `${base}/tour` }',
    );
    expect(layout).toContain('else if (chemin.includes("/tunnels/tour")) actif = "tour";');
    expect(lire(`${TUNNELS}/_components/VueEnsemble.tsx`)).toContain(
      "`${base}/tour?fenetre=${jours}`",
    );
    expect(lire(`${TUNNELS}/tour/page.tsx`)).toContain("gardeLectureAppels(");
  });

  it("les boutons de la landing ont un libellé lisible dans les bilans", () => {
    expect(libelleEmplacement("tour:tdf-heros")).toBe("Tour de France IA (haut de page)");
    expect(libelleEmplacement("tour:tdf-final")).toBe("Tour de France IA (bas de page)");
    expect(libelleEmplacement("tour:tdf-bandeau")).toBe("Tour de France IA (bandeau)");
    expect(libelleEmplacement("tour:tdf-collant")).toBe(
      "Tour de France IA (bouton collant, mobile)",
    );
    expect(libelleEmplacement("tour")).toBe("Page rendez-vous");
    // Contre-témoins : les autres boutons ne bougent pas.
    expect(libelleEmplacement("diagnostic:accueil-hero")).toBe("Accueil (haut de page)");
    expect(libelleEmplacement("projet")).toBe("Page rendez-vous");
  });
});

describe("le tableau du tunnel : clics → rendez-vous pris → maintenus", () => {
  const ligne = (
    utmContent: string | null,
    status: string,
    n: number,
    issue: string | null = null,
  ) => ({
    typeRendezVous: "tour_de_france_ia",
    eventTypeName: "Tour de France IA",
    utmContent,
    status,
    issue,
    fiche: false,
    client: false,
    reporte: false,
    n,
  });

  it("compte, relie bouton par bouton, et calcule la transformation", () => {
    const bilan = agregerBilan([
      ligne("tour:tdf-heros", "active", 2),
      ligne("tour:tdf-heros", "canceled", 1),
      ligne("tour:tdf-final", "active", 1, "eu_lieu"),
      // Un diagnostic ne doit pas entrer dans le Tour.
      { ...ligne("diagnostic:accueil-hero", "active", 9), typeRendezVous: "diagnostic" },
    ]);
    const tour = bilan.types.find((t) => t.type === "tour_de_france_ia");
    const balises = [
      { sessionId: "a", placement: "tdf-heros" },
      { sessionId: "a", placement: "tdf-heros" }, // même visite : une seule arrivée
      { sessionId: "b", placement: "tdf-heros" },
      { sessionId: "c", placement: "tdf-final" },
      { sessionId: "d", placement: "TDF-FINAL" },
      { sessionId: "e", placement: null },
      { sessionId: "f", placement: "tdf-collant" },
      { sessionId: "g", placement: "tdf-heros" },
      { sessionId: "h", placement: "tdf-heros" },
    ];
    const t = construireTableauTour(balises, tour);

    expect(t.visites).toBeNull();
    expect(t.arrivees).toBe(8);
    expect(t.rdv).toEqual({ pris: 4, maintenus: 3, honores: 1, absents: 0, annules: 1, fiches: 0 });
    expect(t.transformation).toBe(50);

    const parCle = Object.fromEntries(t.parBouton.map((l) => [l.cle ?? "∅", l]));
    expect(parCle["tdf-heros"]).toMatchObject({ arrivees: 4, pris: 3, maintenus: 2 });
    expect(parCle["tdf-final"]).toMatchObject({ arrivees: 2, pris: 1, maintenus: 1 });
    expect(parCle["tdf-collant"]).toMatchObject({ arrivees: 1, pris: 0 });
    expect(parCle["∅"]).toMatchObject({ libelle: "Non renseigné", arrivees: 1, pris: 0 });
    expect(parCle["tdf-heros"]?.libelle).toBe("Tour de France IA (haut de page)");
  });

  it("le bouton venu de utm_term (tdf-heros) prime sur un utm_content de post ; sans rien : « Non renseigné »", () => {
    const requete = lire("src/features/admin-rendezvous/bilan-rendez-vous-queries.ts");
    expect(requete).toContain("'utm_term' ~ '^tdf-[a-z0-9-]+$'");
    expect(requete).toContain("THEN 'tour:' ||");
    expect(requete).toContain("ELSE e.utm_content");
    expect(requete).toContain("raw_payload -> 'invitee' -> 'tracking' ->> 'utm_term'");
    // La requête réécrit utm_content en `tour:<utm_term>` : l'agrégat doit y lire le bouton.
    const bilan = agregerBilan([
      ligne("tour:tdf-heros", "active", 1), // post123 remplacé par le CASE SQL
      ligne(null, "active", 1),
    ]);
    const tour = bilan.types.find((t) => t.type === "tour_de_france_ia");
    const t = construireTableauTour([], tour);
    const parCle = Object.fromEntries(t.parBouton.map((l) => [l.cle ?? "∅", l]));
    expect(parCle["tdf-heros"]).toMatchObject({ pris: 1 });
    expect(parCle["∅"]).toMatchObject({ libelle: "Non renseigné", pris: 1 });
    expect(boutonDeUtmContent("post123")).toBeNull();
  });

  it("aucun rendez-vous : zéro (le bilan omet le Tour), jamais « non mesuré »", () => {
    const t = construireTableauTour([], undefined);
    expect(t.arrivees).toBe(0);
    expect(t.rdv?.pris).toBe(0);
    expect(t.parBouton).toEqual([]);
  });

  it("🔴 une lecture en échec rend « non mesuré », jamais zéro", () => {
    const t = construireTableauTour(null, null);
    expect(t.arrivees).toBeNull();
    expect(t.rdv).toBeNull();
    expect(t.transformation).toBeNull();
  });

  it("pas de pourcentage sous le seuil de clics", () => {
    const balises = Array.from({ length: SEUIL_TRANSFORMATION - 1 }, (_, i) => ({
      sessionId: `s${i}`,
      placement: "tdf-heros",
    }));
    expect(construireTableauTour(balises, undefined).transformation).toBeNull();
  });
});

describe("4. 🔴 la landing ne porte toujours aucune mesure", () => {
  it("ni balise ni tunnel pour /tourdefrance-ia", () => {
    expect(funnelKeyFromPath("/tourdefrance-ia")).toBeNull();
    const sources = sourcesLanding("src/app/tourdefrance-ia").filter((f) => /\.tsx?$/.test(f));
    expect(sources.length).toBeGreaterThan(1);
    for (const f of sources) {
      expect(lire(f), f).not.toMatch(/ArriveeReservationMesure|trackFunnel|funnel-beacon/);
    }
  });
});

describe("5. les sessions du Tour restent dans leur tunnel", () => {
  const tour = (id: string) => ({
    funnel: "tour",
    event: "Call Booking Viewed",
    sessionId: id,
    step: null,
    stepIndex: null,
    deviceType: "mobile",
    utmSource: null,
    utmCampaign: "aout-tpe",
    gainBucket: null,
    sector: null,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
  });
  const sim = (id: string, event: string) => ({ ...tour(id), funnel: "simulateur", event });

  it("une session « tour » avec campagne ne change pas la partRapport de la campagne", () => {
    const base = [sim("a", "Simulator Started"), sim("a", "Simulator Report Requested")];
    const avant = agregerTunnels(base);
    const apres = agregerTunnels([...base, tour("t1"), tour("t2")]);
    expect(apres.parCampagne).toEqual(avant.parCampagne);
    expect(apres.parCampagne[0]!.partRapport).toBe(100);
    expect(apres.sessions).toBe(avant.sessions);
    expect(apres.parAppareil).toEqual(avant.parAppareil);
    expect(apres.entonnoirs).toEqual(avant.entonnoirs);
    expect(apres.parTunnel.find((t) => t.cle === "tour")!.sessions).toBe(2);
  });

  it("la balise de consentement n'est pas journalisée sous le tunnel tour", () => {
    const envoyes: string[] = [];
    const anciens = { w: globalThis.window, n: globalThis.navigator, d: globalThis.document };
    const stockage = new Map<string, string>();
    Object.assign(globalThis, {
      window: {
        location: { pathname: "/fr/appel/tour-de-france-ia" },
        innerWidth: 1200,
        sessionStorage: {
          getItem: (k: string) => stockage.get(k) ?? null,
          setItem: (k: string, v: string) => void stockage.set(k, v),
        },
      },
      document: { documentElement: { lang: "fr" } },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { sendBeacon: (_u: string, b: Blob) => envoyes.push(String(b.size)) },
    });
    try {
      sendFunnelBeacon("Consent Banner Answered", { step: "accepted" });
      expect(envoyes).toHaveLength(0);
      expect(stockage.size).toBe(0);
      sendFunnelBeacon("Call Booking Viewed", { landing: "tour-de-france-ia" });
      expect(envoyes).toHaveLength(1);
    } finally {
      Object.assign(globalThis, { window: anciens.w, document: anciens.d });
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: anciens.n });
    }
  });
});
