/**
 * Entonnoir du tunnel apporteurs — ce que l'agrégation garantit.
 *
 * Les deux défauts qu'un tableau de pilotage a l'habitude de cacher :
 *   1. un « 0 » affiché là où la mesure n'existe pas (panne de mesure prise pour
 *      « aucune conversion ») ;
 *   2. un coût moyen calculé sur un ou deux cas.
 */
import { describe, it, expect } from "vitest";
import {
  SEUIL_COMPARAISON,
  SEUIL_CONCLURE,
  comparerPages,
  construireEntonnoir,
  coutParApporteurActif,
  coutParMarche,
  decouperParCampagne,
  repartirParAnnonce,
  SANS_ANNONCE,
  listerSemaines,
  lundiDe,
  partDepuisPrecedente,
  type Depense,
  type LeadSuivi,
  type LigneBalise,
  type RetourConnuSuivi,
  type SourcesLues,
} from "../apporteurs-entonnoir";

const OK: SourcesLues = { balises: true, fiches: true, reservations: true, reseau: true };
const DEPUIS = new Date("2026-09-14T00:00:00Z"); // lundi
const JUSQUA = new Date("2026-10-06T12:00:00Z");

function balise(
  sessionId: string,
  event: string,
  jour: string,
  o: Partial<LigneBalise> = {},
): LigneBalise {
  return {
    event,
    sessionId,
    route: "/fr/apporteur-affaires/video",
    utmCampaign: "camp-a",
    createdAt: new Date(`${jour}T10:00:00Z`),
    ...o,
  };
}

function lead(id: string, jour: string, o: Partial<LeadSuivi> = {}): LeadSuivi {
  return {
    id,
    page: "video",
    inscritLe: new Date(`${jour}T10:00:00Z`),
    campagne: "camp-a",
    annonce: "ad-1",
    canal: "facebook",
    etape2: false,
    reserve: false,
    tenu: false,
    retenu: false,
    dossier: false,
    contrat: false,
    presente: false,
    actif: false,
    ...o,
  };
}

const marche = (e: ReturnType<typeof construireEntonnoir>, cle: string) =>
  e.marches.find((m) => m.cle === cle)!;

function entonnoir(
  lignes: LigneBalise[],
  leads: LeadSuivi[],
  extra: Partial<{ depenses: Depense[]; sources: SourcesLues }> = {},
) {
  return construireEntonnoir({
    lignes,
    leads,
    depenses: extra.depenses ?? [],
    sources: extra.sources ?? OK,
    depuis: DEPUIS,
    jusqua: JUSQUA,
  });
}

describe("semaines", () => {
  it("lundi de la semaine, en UTC", () => {
    expect(lundiDe(new Date("2026-10-04T23:00:00Z"))).toBe("2026-09-28"); // dimanche
    expect(lundiDe(new Date("2026-10-05T00:00:00Z"))).toBe("2026-10-05");
  });

  it("liste les lundis de la période, au plus 12", () => {
    expect(listerSemaines(DEPUIS, JUSQUA)).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
    expect(listerSemaines(new Date("2025-01-01T00:00:00Z"), JUSQUA)).toHaveLength(12);
  });
});

describe("AUCUNE DONNÉE → « non mesuré », jamais 0", () => {
  it("sans balise ni fiche, aucune marche ne vaut 0 : toutes sont null", () => {
    const e = entonnoir([], []);
    for (const m of e.marches) {
      expect(m.total, m.cle).toBeNull();
      expect(
        m.parSemaine.every((c) => c === null),
        m.cle,
      ).toBe(true);
    }
  });

  it("une source illisible rend null pour ses marches, pas 0", () => {
    const lignes = [balise("s1", "Landing Viewed", "2026-09-15")];
    const e = entonnoir(lignes, [lead("a", "2026-09-15")], {
      sources: { ...OK, reservations: false, reseau: false },
    });
    expect(marche(e, "visites").total).toBe(1);
    expect(marche(e, "reserve").total).toBeNull();
    expect(marche(e, "tenu").total).toBeNull();
    expect(marche(e, "contrat").total).toBeNull();
    expect(marche(e, "presente").total).toBeNull();
    // Les marches dont la source est lue restent des nombres.
    expect(marche(e, "dossier").total).toBe(0);
  });

  it("des visites mais une marche à zéro : le zéro est VRAI (témoin non nul)", () => {
    const e = entonnoir([balise("s1", "Landing Viewed", "2026-09-15")], []);
    expect(marche(e, "film").total).toBe(0);
    expect(marche(e, "etape1").total).toBe(0);
  });

  it("sans aucune inscription, le bas de l'entonnoir est non mesuré (témoin à zéro)", () => {
    const e = entonnoir([balise("s1", "Landing Viewed", "2026-09-15")], []);
    expect(marche(e, "reserve").total).toBeNull();
    expect(marche(e, "contrat").total).toBeNull();
  });

  it("une semaine sans visite affiche « — » (null) sur les marches suivantes, pas 0", () => {
    const e = entonnoir(
      [
        balise("s1", "Landing Viewed", "2026-09-15"),
        balise("s1", "Landing Video Played", "2026-09-15"),
      ],
      [],
    );
    const i = e.semaines.indexOf("2026-09-28");
    expect(marche(e, "film").parSemaine[i]).toBeNull();
    expect(marche(e, "film").parSemaine[e.semaines.indexOf("2026-09-14")]).toBe(1);
  });
});

describe("comptes", () => {
  const lignes = [
    balise("s1", "Landing Viewed", "2026-09-15"),
    balise("s1", "Landing Video Played", "2026-09-15"),
    balise("s1", "Landing CTA Clicked", "2026-09-15"),
    balise("s1", "Lead Email Captured", "2026-09-15"),
    balise("s2", "Landing Viewed", "2026-09-16"),
    balise("s3", "Landing Viewed", "2026-09-29"),
    balise("s3", "Landing Video Played", "2026-09-29"),
    // Page ancienne : n'entre pas dans l'entonnoir de la nouvelle page.
    balise("s4", "Landing Viewed", "2026-09-16", { route: "/fr/apporteur-affaires" }),
  ];

  it("compte des SESSIONS par semaine d'arrivée, nouvelle page seulement", () => {
    const e = entonnoir(lignes, []);
    expect(marche(e, "visites").total).toBe(3);
    expect(marche(e, "film").total).toBe(2);
    expect(marche(e, "clic").total).toBe(1);
    expect(marche(e, "etape1").total).toBe(1);
    expect(marche(e, "visites").parSemaine).toEqual([2, 0, 1, 0]);
  });

  it("compte des PERSONNES par semaine d'inscription pour le bas", () => {
    const leads = [
      lead("a", "2026-09-15", {
        etape2: true,
        reserve: true,
        tenu: true,
        retenu: true,
        dossier: true,
      }),
      lead("b", "2026-09-16", { reserve: true }),
      lead("c", "2026-09-29"),
      lead("vieux", "2026-09-29", { page: "court" }),
    ];
    const e = entonnoir(lignes, leads);
    expect(marche(e, "reserve").total).toBe(2);
    expect(marche(e, "tenu").total).toBe(1);
    expect(marche(e, "retenu").total).toBe(1);
    expect(marche(e, "dossier").total).toBe(1);
    expect(marche(e, "reserve").parSemaine).toEqual([2, null, 0, null]);
  });

  it("la page est déduite de la ROUTE de la première balise", () => {
    const e = entonnoir(
      [
        balise("s9", "Landing CTA Clicked", "2026-09-16"),
        balise("s9", "Landing Viewed", "2026-09-15"),
      ],
      [],
    );
    expect(marche(e, "visites").total).toBe(1);
  });
});

describe("pourcentages et coûts", () => {
  it("part depuis la précédente : null si l'une des deux est non mesurée ou si la base est vide", () => {
    expect(partDepuisPrecedente(5, 10)).toBe(50);
    expect(partDepuisPrecedente(null, 10)).toBeNull();
    expect(partDepuisPrecedente(5, null)).toBeNull();
    expect(partDepuisPrecedente(0, 0)).toBeNull();
    expect(partDepuisPrecedente(0, 10)).toBe(0);
  });

  it("coût ÷ 0 → null (« — »), jamais Infinity ni 0 €", () => {
    expect(coutParMarche(5000, 0)).toBeNull();
    expect(coutParMarche(5000, null)).toBeNull();
    expect(coutParMarche(0, 5)).toBeNull(); // rien de saisi : pas « 0 € »
    expect(coutParMarche(5000, 4)).toBe(1250);
  });

  it("les dépenses se rangent par semaine, le total couvre toute la période", () => {
    const depenses: Depense[] = [
      {
        spentOn: new Date("2026-09-15T00:00:00Z"),
        canal: "facebook",
        campagne: null,
        montantCentimes: 2500,
      },
      {
        spentOn: new Date("2026-09-30T00:00:00Z"),
        canal: "facebook",
        campagne: null,
        montantCentimes: 1000,
      },
    ];
    const e = entonnoir([], [], { depenses });
    expect(e.depenseSemaine).toEqual([2500, 0, 1000, 0]);
    expect(e.depenseTotale).toBe(3500);
  });
});

describe("coût par apporteur actif — jamais une moyenne sur peu de cas", () => {
  it("aucun actif : pas de coût", () => {
    expect(coutParApporteurActif(100_000, 0)).toEqual({ etat: "aucun", actifs: 0 });
  });

  it("1 ou 2 cas : « trop peu pour conclure », aucun coût calculé", () => {
    for (const n of [1, 2, SEUIL_CONCLURE - 1]) {
      expect(coutParApporteurActif(100_000, n)).toEqual({ etat: "trop-peu", actifs: n });
    }
  });

  it("à partir du seuil, le coût moyen est calculé ; sans dépense saisie il reste null", () => {
    expect(coutParApporteurActif(100_000, SEUIL_CONCLURE)).toEqual({
      etat: "ok",
      actifs: SEUIL_CONCLURE,
      coutCentimes: 10_000,
    });
    expect(coutParApporteurActif(0, SEUIL_CONCLURE)).toMatchObject({
      etat: "ok",
      coutCentimes: null,
    });
  });
});

describe("comparaison nouvelle page / ancienne page", () => {
  function visites(
    page: "video" | "court",
    n: number,
    avec: Record<string, number>,
  ): LigneBalise[] {
    const route = page === "video" ? "/fr/apporteur-affaires/video" : "/fr/apporteur-affaires";
    const res: LigneBalise[] = [];
    for (let i = 0; i < n; i++) {
      const id = `${page}-${i}`;
      res.push(balise(id, "Landing Viewed", "2026-09-15", { route }));
      for (const [ev, k] of Object.entries(avec)) {
        if (i < k) res.push(balise(id, ev, "2026-09-15", { route }));
      }
    }
    return res;
  }

  it("étape 1 et étape 2 par visite, pour les deux pages", () => {
    const l = [
      ...visites("video", 100, { "Lead Email Captured": 20, "Lead Apporteur Submitted": 10 }),
      ...visites("court", 50, { "Lead Apporteur Submitted": 5 }),
    ];
    const [video, court] = comparerPages(l);
    expect(video).toMatchObject({
      visites: 100,
      etape1: 20,
      etape2: 10,
      etape1ParVisite: 20,
      etape2ParVisite: 10,
    });
    // Ancienne page : un seul formulaire, son envoi vaut pour les deux étapes.
    expect(court).toMatchObject({ visites: 50, etape1: 5, etape2: 5, etape2ParVisite: 10 });
  });

  it("sous le seuil de visites, aucun taux (bruit)", () => {
    const l = visites("video", SEUIL_COMPARAISON - 1, { "Lead Email Captured": 5 });
    const [video] = comparerPages(l);
    expect(video?.etape1).toBe(5);
    expect(video?.etape1ParVisite).toBeNull();
  });
});

describe("découpage", () => {
  it("par campagne : visites mesurées, dépense et coût par étape 2 portés par la ligne", () => {
    const lignes = [
      balise("s1", "Landing Viewed", "2026-09-15", { utmCampaign: "camp-a" }),
      balise("s2", "Landing Viewed", "2026-09-15", { utmCampaign: "camp-b" }),
    ];
    const leads = [
      lead("a", "2026-09-15", { etape2: true, reserve: true }),
      lead("b", "2026-09-15", { campagne: "camp-b" }),
    ];
    const dep: Depense[] = [
      {
        spentOn: new Date("2026-09-15T00:00:00Z"),
        canal: "facebook",
        campagne: "camp-a",
        montantCentimes: 4000,
      },
    ];
    const l = decouperParCampagne(lignes, leads, dep, true);
    const a = l.find((x) => x.cle === "camp-a")!;
    expect(a).toMatchObject({
      visites: 1,
      etape1: 1,
      etape2: 1,
      reserves: 1,
      depenseCentimes: 4000,
    });
    expect(l.find((x) => x.cle === "camp-b")).toMatchObject({
      etape1: 1,
      etape2: 0,
      depenseCentimes: null,
    });
  });

  it("balises illisibles : les visites sont non mesurées (null), pas 0", () => {
    const l = decouperParCampagne([], [lead("a", "2026-09-15")], [], false);
    expect(l[0]?.visites).toBeNull();
  });

  it("par annonce : les visites ne sont jamais mesurées (la balise ne porte pas l'annonce)", () => {
    const r = repartirParAnnonce(
      [lead("a", "2026-09-15"), lead("b", "2026-09-15", { annonce: null })],
      OK,
      0,
      { suivis: [], sources: OK },
    );
    expect(r.lignes.map((x) => x.cle)).toEqual(["ad-1", SANS_ANNONCE]);
    expect(SANS_ANNONCE).toBe("(sans identifiant)");
    expect(r.lignes.every((x) => x.visites === null)).toBe(true);
    expect(r.total.visites).toBeNull();
  });
});

describe("🔴 répartition PAR ANNONCE (2026-10-10, statistiques réelles)", () => {
  const connu = (o: Partial<RetourConnuSuivi> = {}): RetourConnuSuivi => ({
    id: "c",
    etape2: false,
    reserve: false,
    tenu: false,
    retenu: false,
    contrat: false,
    ...o,
  });
  const LEADS = [
    lead("a", "2026-09-15", { annonce: "ad-1", etape2: true, reserve: true, tenu: true }),
    lead("b", "2026-09-15", {
      annonce: "ad-1",
      etape2: true,
      reserve: true,
      tenu: true,
      retenu: true,
      contrat: true,
    }),
    lead("c", "2026-09-16", { annonce: "ad-2" }),
    lead("d", "2026-09-16", { annonce: null, etape2: true }),
    // L'ancienne page n'entre pas dans la répartition du tunnel vidéo.
    lead("e", "2026-09-16", { page: "court", annonce: "ad-1" }),
  ];

  it("compte chaque marche par annonce — étape 1, étape 2, réservés, tenus, retenus, contrats", () => {
    const r = repartirParAnnonce(LEADS, OK, 0, { suivis: [], sources: OK });
    expect(r.lignes).toEqual([
      {
        cle: "ad-1",
        visites: null,
        etape1: 2,
        etape2: 2,
        reserves: 2,
        tenus: 2,
        retenus: 1,
        contrats: 1,
      },
      {
        cle: "ad-2",
        visites: null,
        etape1: 1,
        etape2: 0,
        reserves: 0,
        tenus: 0,
        retenus: 0,
        contrats: 0,
      },
      {
        cle: SANS_ANNONCE,
        visites: null,
        etape1: 1,
        etape2: 1,
        reserves: 0,
        tenus: 0,
        retenus: 0,
        contrats: 0,
      },
    ]);
    expect(r.total).toMatchObject({ cle: "Total", etape1: 4, etape2: 3, reserves: 2, contrats: 1 });
  });

  it("le coût ne se calcule qu'au TOTAL (aucun champ annonce dans les dépenses), jamais inventé", () => {
    const r = repartirParAnnonce(LEADS, OK, 12_000, { suivis: [], sources: OK });
    expect(r.total.depenseCentimes).toBe(12_000);
    expect(r.total.coutParEtape1).toBe(3_000);
    expect(r.total.coutParReservation).toBe(6_000);
    for (const l of r.lignes) expect(l).not.toHaveProperty("coutParEtape1");
    // Rien de saisi : « — », jamais 0 €.
    const sans = repartirParAnnonce(LEADS, OK, 0, { suivis: [], sources: OK });
    expect(sans.total.depenseCentimes).toBeNull();
    expect(sans.total.coutParEtape1).toBeNull();
    expect(sans.total.coutParReservation).toBeNull();
    // Aucune réservation : pas de division par zéro.
    const z = repartirParAnnonce([lead("x", "2026-09-15")], OK, 5_000, { suivis: [], sources: OK });
    expect(z.total.coutParReservation).toBeNull();
  });

  it("une source illisible rend « non mesuré » (null), jamais 0", () => {
    const r = repartirParAnnonce(LEADS, { ...OK, reservations: false, reseau: false }, 0, {
      suivis: [],
      sources: OK,
    });
    const ad1 = r.lignes.find((l) => l.cle === "ad-1")!;
    expect(ad1.etape1).toBe(2);
    expect(ad1.reserves).toBeNull();
    expect(ad1.tenus).toBeNull();
    expect(ad1.retenus).toBeNull();
    expect(ad1.contrats).toBeNull();
    const sansFiches = repartirParAnnonce(LEADS, { ...OK, fiches: false }, 0, {
      suivis: [],
      sources: OK,
    });
    expect(sansFiches.total.etape1).toBeNull();
  });

  it("les « déjà connus » revenus par la pub sont comptés À PART, hors des annonces et du total", () => {
    const r = repartirParAnnonce(LEADS, OK, 0, {
      suivis: [connu({ id: "k1", etape2: true, reserve: true }), connu({ id: "k2" })],
      sources: OK,
    });
    expect(r.dejaConnus).toMatchObject({
      cle: "Déjà connus (revenus par la publicité)",
      etape1: 2,
      etape2: 1,
      reserves: 1,
      tenus: 0,
    });
    expect(r.total.etape1).toBe(4);
    // Lecture des fiches connues en échec : la ligne n'est pas affichée comme des zéros.
    const ko = repartirParAnnonce(LEADS, OK, 0, {
      suivis: [],
      sources: { ...OK, fiches: false },
    });
    expect(ko.dejaConnus).toBeNull();
  });
});
