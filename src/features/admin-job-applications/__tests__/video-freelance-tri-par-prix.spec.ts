// Lot L1 « Candidatures unifiées » (2026-10-07) — critères d'acceptation du plan :
// « 90 », « 250 € », « 1 200 euros », « 200 à 300 » se classent 90, 250, 1 200,
// « à préciser » (croissant) et 1 200, 250, 90, « à préciser » (décroissant),
// sur le montage (prix vertical) comme sur le tournage (prix demi-journée) ; le
// filtre « prix max 100 » ne garde que 90 ; un rôle sans accès au dossier ne
// voit ni prix ni vidéo, et la liste ne se classe pas par prix pour lui.

import { beforeEach, describe, expect, it, vi } from "vitest";

const offerFindManyMock = vi.fn();
const appFindManyMock = vi.fn();
const countMock = vi.fn();
const videoFindManyMock = vi.fn();
const decryptMock = vi.fn((v: string) => v);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: { findMany: (...a: unknown[]) => offerFindManyMock(...a) },
    jobApplication: {
      findMany: (...a: unknown[]) => appFindManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    jobApplicationVideo: { findMany: (...a: unknown[]) => videoFindManyMock(...a) },
    activityLog: { create: async () => ({}) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => decryptMock(v) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import {
  VIDEO_EDITOR_OFFER_SLUG,
  VIDEO_SHOOTING_OFFER_SLUG,
} from "@/lib/careers/video-editor-offer";

import {
  filtrerEtClasser,
  listerCandidaturesVideoFreelance,
  questionDeTriParDefaut,
  questionsDePrix,
  type FiltresVideo,
} from "../video-freelance";

const OFFRES = [
  {
    id: "o-tournage",
    slug: VIDEO_SHOOTING_OFFER_SLUG,
    titleFr: "Vidéaste freelance tournage",
    screeningQuestions: [
      { id: "demi_journee", labelFr: "Prix demi-journée", type: "price", required: true },
      { id: "journee", labelFr: "Prix journée", type: "price", required: true },
      { id: "materiel", labelFr: "Matériel image", type: "short", required: true },
    ],
  },
  {
    id: "o-montage",
    slug: VIDEO_EDITOR_OFFER_SLUG,
    titleFr: "Monteur vidéo freelance",
    screeningQuestions: [
      { id: "prix_horizontal", labelFr: "Prix horizontal", type: "price" },
      { id: "prix_vertical", labelFr: "Prix vertical", type: "price", required: true },
      { id: "liens", labelFr: "Liens d'exemples" },
    ],
  },
];

/** Rangées de la plus récente à la plus ancienne, comme la base les rend. */
function lignes(question: string, ville: (i: number) => string) {
  return ["200 à 300", "250 €", "90", "1 200 euros"].map((prix, i) => ({
    id: `${question}-${["fourchette", "250", "90", "1200"][i]}`,
    firstName: `P${i}`,
    lastName: `N${i}`,
    city: ville(i),
    status: i === 2 ? ("reviewing" as const) : ("new" as const),
    submittedAt: new Date(Date.UTC(2026, 9, 6 - i)),
    answers: { [question]: prix, liens: "https://vimeo.com/123" },
    motivation: null,
    linkedinUrl: null,
  }));
}

const VILLES = ["Lyon", "Saint-Étienne", "Grenoble", "Paris"];

beforeEach(() => {
  vi.clearAllMocks();
  offerFindManyMock.mockResolvedValue(OFFRES);
  countMock.mockResolvedValue(4);
  appFindManyMock.mockImplementation(async (args: { where: { offerId: string } }) =>
    args.where.offerId === "o-tournage"
      ? lignes("demi_journee", (i) => VILLES[i]!)
      : lignes("prix_vertical", (i) => VILLES[i]!),
  );
  videoFindManyMock.mockImplementation(
    async (args: { where: { applicationId: { in: string[] } } }) =>
      args.where.applicationId.in.map((id) => ({
        id: `v-${id}`,
        applicationId: id,
        nomOriginal: "demo.mp4",
        taille: 1000,
      })),
  );
});

async function ordre(filtres: FiltresVideo, role = "super_admin") {
  const res = await listerCandidaturesVideoFreelance({ role, acteurId: "u1" }, filtres);
  const montage = res.find((o) => o.slug === VIDEO_EDITOR_OFFER_SLUG)!;
  const tournage = res.find((o) => o.slug === VIDEO_SHOOTING_OFFER_SLUG)!;
  return {
    montage: montage.candidats.map((c) => c.id.split("-")[1]),
    tournage: tournage.candidats.map((c) => c.id.split("-")[1]),
    res,
  };
}

describe("L1 — classer les monteurs et vidéastes par prix", () => {
  it("par défaut : prix obligatoire, du moins cher au plus cher, « à préciser » en bas", async () => {
    const { montage, tournage, res } = await ordre({});
    expect(montage).toEqual(["90", "250", "1200", "fourchette"]);
    expect(tournage).toEqual(["90", "250", "1200", "fourchette"]);
    // Le prix vertical classe le montage, même s'il n'est pas la première question.
    expect(res.find((o) => o.slug === VIDEO_EDITOR_OFFER_SLUG)?.questionTri).toBe("prix_vertical");
    expect(res.find((o) => o.slug === VIDEO_SHOOTING_OFFER_SLUG)?.questionTri).toBe("demi_journee");
  });

  it("décroissant : 1 200, 250, 90 — et « à préciser » TOUJOURS en bas", async () => {
    const { montage, tournage } = await ordre({ tri: "prix_vertical", sens: "desc" });
    expect(montage).toEqual(["1200", "250", "90", "fourchette"]);
    // `prix_vertical` n'existe pas au tournage : il garde son prix par défaut.
    expect(tournage).toEqual(["1200", "250", "90", "fourchette"]);
  });

  it("le tournage se classe aussi sur la demi-journée demandée explicitement", async () => {
    const { tournage } = await ordre({ tri: "demi_journee", sens: "asc" });
    expect(tournage).toEqual(["90", "250", "1200", "fourchette"]);
  });

  it("prix max 100 € ne garde que 90 (un prix « à préciser » n'est pas sous le plafond)", async () => {
    const { montage, tournage, res } = await ordre({ prixMaxCentimes: 10000 });
    expect(montage).toEqual(["90"]);
    expect(tournage).toEqual(["90"]);
    expect(res[0]?.retenus).toBe(1);
    expect(res[0]?.total).toBe(4);
  });

  it("ville sans accent ni tiret, et étape", async () => {
    expect((await ordre({ ville: "saint etienne" })).montage).toEqual(["250"]);
    expect((await ordre({ etape: "reviewing" })).montage).toEqual(["90"]);
  });

  it("les identités ne sont déchiffrées que pour les lignes affichées", async () => {
    await ordre({ prixMaxCentimes: 10000 });
    // 1 ligne par offre × (prénom + nom) × 2 offres.
    expect(decryptMock).toHaveBeenCalledTimes(4);
  });

  it("vidéos déposées et liens d'exemples sont joints à chaque ligne", async () => {
    const { res } = await ordre({});
    const c = res.find((o) => o.slug === VIDEO_EDITOR_OFFER_SLUG)!.candidats[0]!;
    expect(c.videos).toEqual([{ id: `v-${c.id}`, nom: "demo.mp4", taille: 1000 }]);
    expect(c.liens).toEqual([{ url: "https://vimeo.com/123", plateforme: "Vimeo" }]);
    // Seules les vidéos `disponible` (passées par l'antivirus) sont demandées.
    expect(videoFindManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { statut: "disponible" },
    });
  });

  it("un rôle sans accès ne voit ni prix ni vidéo, et l'ordre ne trahit pas les prix", async () => {
    const { montage, res } = await ordre(
      { tri: "prix_vertical", sens: "asc", prixMaxCentimes: 10000, ville: "Lyon" },
      "reader",
    );
    // Ordre d'arrivée, aucun filtre sur ce qu'il ne voit pas.
    expect(montage).toEqual(["fourchette", "250", "90", "1200"]);
    for (const o of res) {
      expect(o.questionTri).toBeNull();
      expect(o.questionsPrix).toEqual([]);
      for (const c of o.candidats) {
        expect(c.reponses).toEqual({});
        expect(c.videos).toEqual([]);
        expect(c.liens).toEqual([]);
        expect(c.nom).toBeNull();
      }
    }
    expect(videoFindManyMock).not.toHaveBeenCalled();
    expect(decryptMock).not.toHaveBeenCalled();
  });
});

describe("non-régression — offre sans question de prix", () => {
  it("ordre d'arrivée, aucun tri, toutes les lignes, réponses intactes", async () => {
    offerFindManyMock.mockResolvedValue([
      {
        id: "o-montage",
        slug: VIDEO_EDITOR_OFFER_SLUG,
        titleFr: "Monteur vidéo freelance",
        screeningQuestions: [{ id: "materiel", labelFr: "Matériel" }],
      },
    ]);
    const res = await listerCandidaturesVideoFreelance(
      { role: "super_admin", acteurId: "u1" },
      { sens: "desc" },
    );
    expect(res).toHaveLength(1);
    expect(res[0]?.questionTri).toBeNull();
    expect(res[0]?.candidats.map((c) => c.id)).toEqual([
      "prix_vertical-fourchette",
      "prix_vertical-250",
      "prix_vertical-90",
      "prix_vertical-1200",
    ]);
    expect(res[0]?.candidats[0]?.reponses.prix_vertical).toBe("200 à 300");
  });
});

describe("questions de prix", () => {
  it("le prix obligatoire classe par défaut, sinon le premier prix", () => {
    expect(questionDeTriParDefaut(OFFRES[1]!.screeningQuestions as never)).toBe("prix_vertical");
    expect(
      questionDeTriParDefaut([
        { id: "a", type: "price" },
        { id: "b", type: "price" },
      ]),
    ).toBe("a");
    expect(questionDeTriParDefaut([{ id: "x", labelFr: "Matériel" }])).toBeNull();
  });

  it("une offre sans question typée « price » se rabat sur le libellé (prix, tarif)", () => {
    expect(
      questionsDePrix([
        { id: "t", labelFr: "Vos tarifs à la demi-journée" },
        { id: "m", labelFr: "Matériel" },
      ]).map((q) => q.id),
    ).toEqual(["t"]);
  });

  it("deux prix égaux gardent l'ordre d'arrivée", () => {
    const l = [
      { id: "recent", status: "new" as const, city: null, answers: { p: "50" } },
      { id: "ancien", status: "new" as const, city: null, answers: { p: "50 €" } },
    ];
    expect(filtrerEtClasser(l, { questionTri: "p", sens: "desc" }).map((x) => x.id)).toEqual([
      "recent",
      "ancien",
    ]);
  });
});
