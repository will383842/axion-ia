// Lot L13b — relances des pièces à renouveler (séquences S6 et S6 bis, 10c §3) :
// l'attestation URSSAF (F40) et les autres pièces (F41) s'inscrivent au registre
// des campagnes, ÉTEINTES derrière `formateurs.pieces_cron`.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: vi.fn(),
}));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { decisionCampagne } from "@/lib/relances/campagne";
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { REGISTRE_CAMPAGNES, cleRelance } from "@/server/relances/registre-campagnes";

import { etatsParDefaut } from "../interrupteurs";
import type { PieceLue } from "../pieces-a-renouveler";
import {
  CAMPAGNE_PIECES,
  CAMPAGNE_VIGILANCE,
  faitsPieces,
  WHERE_POPULATION,
  faitsVigilance,
  lirePourRelances,
  motifHorsPopulation,
  motifRetenueRelancePiece,
  type FicheRelance,
  type LecturePieces,
} from "../pieces-relances";

const JOUR = 24 * 60 * 60 * 1000;
// Mardi 13 octobre 2026, 10 h à Paris.
const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const T1 = "11111111-1111-4111-8111-111111111111";

function piece(over: Partial<PieceLue> = {}): PieceLue {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "assurance_rc_pro",
    statutValidation: "valide",
    fichierUrl: "r2://piece",
    dateEmission: new Date("2025-11-01T00:00:00Z"),
    dateExpiration: new Date(MAINTENANT.getTime() + 20 * JOUR),
    createdAt: new Date("2025-11-01T00:00:00Z"),
    archiveAt: null,
    rejetMotif: null,
    valideAt: new Date("2025-11-02T00:00:00Z"),
    ...over,
  } as PieceLue;
}

/** Le cas INCLUS : indépendant du nouveau parcours, dossier vérifié, actif, en cours. */
function fiche(over: Partial<FicheRelance> = {}): FicheRelance {
  return {
    id: T1,
    prenom: "Camille",
    email: "camille@example.com",
    statut: "sous_traitant",
    actif: true,
    finCollaborationAt: null,
    organismeSousTraitantId: null,
    dossierStatut: "verifie",
    candidature: { natureCollaboration: "freelance", status: "hired" },
    pseudonymisee: false,
    ...over,
  };
}

function lecture(pieces: PieceLue[], over: Partial<LecturePieces> = {}): LecturePieces {
  return {
    fiches: [fiche()],
    pieces: new Map([[T1, pieces]]),
    envois: [],
    opposes: new Set(),
    adressesMortes: new Set(),
    ...over,
  };
}

describe("livré éteint", () => {
  it("les deux campagnes sont inscrites au registre, derrière `pieces_cron`", () => {
    const ids = REGISTRE_CAMPAGNES.map((c) => c.id);
    expect(ids).toContain(CAMPAGNE_VIGILANCE.id);
    expect(ids).toContain(CAMPAGNE_PIECES.id);
    // Clé mère d'abord : couper le dossier en ligne suspend ces relances.
    expect(CAMPAGNE_VIGILANCE.interrupteurs).toEqual(["dossier_en_ligne", "pieces_cron"]);
    expect(CAMPAGNE_PIECES.interrupteurs).toEqual(["dossier_en_ligne", "pieces_cron"]);
  });

  it("interrupteurs absents : aucun formateur n'est lu, aucun e-mail ne part", async () => {
    const lireFaits = vi.fn(async () => faitsPieces(lecture([piece()]), MAINTENANT));
    const envoyer = vi.fn();
    const b = await passerCampagnes(MAINTENANT, {
      registre: REGISTRE_CAMPAGNES.map((c) => ({ ...c, lireFaits })),
      lireInterrupteurs: async () => etatsParDefaut(),
      relanceesAujourdhui: async () => new Set(),
      dejaTente: async () => false,
      envoyer,
    });
    expect(b.campagnesActives).toBe(0);
    expect(lireFaits).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("S6 bis — autres pièces (F41)", () => {
  it("RC pro à 20 jours de l'échéance : premier rappel, avec la pièce et la date", () => {
    const [f] = faitsPieces(lecture([piece()]), MAINTENANT);
    expect(f).toBeDefined();
    expect(f!.entityId).toBe(T1);
    expect(f!.destinataire).toBe("camille@example.com");
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: CAMPAGNE_PIECES.regle,
    });
    expect(d.envoyer).toBe(true);
    if (d.envoyer) {
      expect(d.etape).toBe("j30");
      expect(CAMPAGNE_PIECES.variante?.(d.etape)).toBe(1);
    }
    const valeurs = f!.payload.valeurs as Record<string, string>;
    expect(valeurs["la pièce"]).toBe("votre attestation d'assurance RC pro");
    expect(valeurs.date).toMatch(/2 novembre 2026/);
    expect(valeurs.N).toBe("20");
  });

  it("la relance à J-15 prend la variante « Relance », jamais celle d'une pièce refusée", () => {
    expect(CAMPAGNE_PIECES.variante?.("j15")).toBe(2);
    expect(CAMPAGNE_PIECES.regle.max).toBe(2);
  });

  it("un dépôt anticipé en attente suspend le rappel", () => {
    const enAttente = piece({
      id: "33333333-3333-4333-8333-333333333333",
      statutValidation: "en_attente",
      createdAt: MAINTENANT,
      valideAt: null,
    });
    const [f] = faitsPieces(lecture([piece(), enAttente]), MAINTENANT);
    expect(f!.etat.actionFaite).toBe(true);
  });

  it("pièce encore valable loin de l'échéance, échue ou refusée : aucune relance F41", () => {
    expect(
      faitsPieces(
        lecture([piece({ dateExpiration: new Date(MAINTENANT.getTime() + 90 * JOUR) })]),
        MAINTENANT,
      ),
    ).toEqual([]);
    expect(
      faitsPieces(
        lecture([piece({ dateExpiration: new Date(MAINTENANT.getTime() - JOUR) })]),
        MAINTENANT,
      ),
    ).toEqual([]);
    expect(
      faitsPieces(
        lecture([piece({ statutValidation: "rejete", rejetMotif: "note interne" })]),
        MAINTENANT,
      ),
    ).toEqual([]);
  });

  it("l'attestation URSSAF n'est jamais relancée par F41", () => {
    const vigilance = piece({
      type: "attestation_vigilance_urssaf",
      dateEmission: new Date(MAINTENANT.getTime() - 170 * JOUR),
      dateExpiration: null,
    });
    expect(faitsPieces(lecture([vigilance]), MAINTENANT)).toEqual([]);
  });

  it("les relances déjà tentées de CETTE échéance comptent, pas celles d'une autre", () => {
    const [f0] = faitsPieces(lecture([piece()]), MAINTENANT);
    const cle = cleRelance(CAMPAGNE_PIECES.id, T1, f0!.origineId, "j30");
    const autre = cleRelance(CAMPAGNE_PIECES.id, T1, "assurance_rc_pro-20251101", "j30");
    const [f] = faitsPieces(
      lecture([piece()], {
        envois: [
          { entityId: T1, jobId: cle, at: new Date(MAINTENANT.getTime() - 2 * JOUR) },
          { entityId: T1, jobId: autre, at: new Date(MAINTENANT.getTime() - 400 * JOUR) },
        ],
      }),
      MAINTENANT,
    );
    expect(f!.etat.envois).toHaveLength(1);
  });

  it("opposition, adresse morte : la campagne s'arrête ; fiche effacée : hors population", () => {
    const base = lecture([piece()]);
    const [o] = faitsPieces({ ...base, opposes: new Set([T1]) }, MAINTENANT);
    const [m] = faitsPieces({ ...base, adressesMortes: new Set([T1]) }, MAINTENANT);
    expect(
      faitsPieces(
        { ...base, fiches: [fiche({ prenom: "", email: "x@erased.local" })] },
        MAINTENANT,
      ),
    ).toEqual([]);
    for (const [f, motif] of [
      [o, "opposition"],
      [m, "adresse-morte"],
    ] as const) {
      const d = decisionCampagne({
        etat: f!.etat,
        maintenant: MAINTENANT,
        regle: CAMPAGNE_PIECES.regle,
      });
      expect(d.envoyer).toBe(false);
      expect(d.motif).toBe(motif);
    }
  });

  it("la clé d'envoi ne porte ni adresse ni deux-points", () => {
    const [f] = faitsPieces(lecture([piece()]), MAINTENANT);
    const cle = cleRelance(CAMPAGNE_PIECES.id, f!.entityId, f!.origineId, "j30");
    expect(cle).toBe(`fi-piece-${T1}-assurance_rc_pro-20261102-j30`);
    expect(cle).not.toMatch(/@|:/);
  });
});

describe("S6 — attestation URSSAF (F40)", () => {
  const attestation = (joursAvantEcheance: number) =>
    piece({
      type: "attestation_vigilance_urssaf",
      // Échéance = émission + 6 mois.
      dateEmission: new Date(
        new Date(MAINTENANT.getTime() + joursAvantEcheance * JOUR).setUTCMonth(
          new Date(MAINTENANT.getTime() + joursAvantEcheance * JOUR).getUTCMonth() - 6,
        ),
      ),
      dateExpiration: null,
    });

  it("à 10 jours de l'échéance : la demande part, variante « avant l'échéance »", () => {
    const [f] = faitsVigilance(lecture([attestation(10)]), MAINTENANT);
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: CAMPAGNE_VIGILANCE.regle,
    });
    expect(d.envoyer).toBe(true);
    if (d.envoyer) expect(CAMPAGNE_VIGILANCE.variante?.(d.etape)).toBe(2);
    expect(CAMPAGNE_VIGILANCE.regle.max).toBe(3);
  });

  it("échue sans nouveau dépôt : les relances continuent (elles débloquent)", () => {
    const [f] = faitsVigilance(lecture([attestation(-5)]), MAINTENANT);
    expect(f).toBeDefined();
    expect(f!.etat.actionFaite).toBe(false);
  });

  it("une nouvelle attestation en vérification : rien ne part", () => {
    const enAttente = piece({
      id: "44444444-4444-4444-8444-444444444444",
      type: "attestation_vigilance_urssaf",
      statutValidation: "en_attente",
      dateEmission: MAINTENANT,
      dateExpiration: null,
      valideAt: null,
    });
    expect(faitsVigilance(lecture([attestation(-5), enAttente]), MAINTENANT)).toEqual([]);
  });

  it("aucune attestation déposée : pas de F40 « avant l'échéance »", () => {
    expect(faitsVigilance(lecture([]), MAINTENANT)).toEqual([]);
  });

  it("fenêtre du plan : rien avant J-15, rien après J+16", () => {
    expect(faitsVigilance(lecture([attestation(20)]), MAINTENANT)).toEqual([]);
    expect(faitsVigilance(lecture([attestation(-17)]), MAINTENANT)).toEqual([]);
    expect(faitsVigilance(lecture([attestation(15)]), MAINTENANT)).toHaveLength(1);
    expect(faitsVigilance(lecture([attestation(-16)]), MAINTENANT)).toHaveLength(1);
  });

  it("attestation déjà renouvelée (nouvelle pièce validée) : plus aucune relance", () => {
    const neuve = piece({
      id: "55555555-5555-4555-8555-555555555555",
      type: "attestation_vigilance_urssaf",
      dateEmission: new Date(MAINTENANT.getTime() - JOUR),
      dateExpiration: null,
      createdAt: MAINTENANT,
    });
    expect(faitsVigilance(lecture([attestation(-5), neuve]), MAINTENANT)).toEqual([]);
  });
});

describe("le texte qui part est complet", () => {
  it("F40 et F41 : aucun crochet sans valeur, à chaque étape, avec les vraies déclarations", async () => {
    const { valeursManquantes: reel } = await vi.importActual<
      typeof import("@/server/qualiopi/formateurs-independants/envois")
    >("@/server/qualiopi/formateurs-independants/envois");
    const [p] = faitsPieces(lecture([piece()]), MAINTENANT);
    for (const etape of ["j30", "j15"]) {
      const payload = { ...p!.payload, etape: CAMPAGNE_PIECES.variante!(etape) };
      expect(reel("formateur-piece-a-renouveler", payload)).toBe(false);
    }
    const sans = { prenom: "Camille", valeurs: {}, etape: CAMPAGNE_VIGILANCE.variante!("j15") };
    expect(reel("formateur-vigilance", sans)).toBe(false);
  });
});

describe("population STRICTE (un cas par catégorie exclue, et le cas inclus)", () => {
  const exclus: ReadonlyArray<readonly [string, Partial<FicheRelance>, string]> = [
    ["formateur salarié", { statut: "salarie" }, "salarie"],
    ["dirigeant-formateur", { statut: "dirigeant" }, "dirigeant"],
    [
      "sous-traitant historique (sans candidature du nouveau parcours)",
      { candidature: null, dossierStatut: null },
      "hors-nouveau-parcours",
    ],
    [
      "candidature salariée",
      { candidature: { natureCollaboration: "salarie", status: "hired" } },
      "hors-nouveau-parcours",
    ],
    [
      "candidat non retenu",
      { candidature: { natureCollaboration: "freelance", status: "rejected" } },
      "candidat-non-retenu",
    ],
    [
      "candidat qui s'est retiré",
      { candidature: { natureCollaboration: "freelance", status: "withdrawn" } },
      "candidat-non-retenu",
    ],
    ["dossier en ligne non vérifié", { dossierStatut: "a_verifier" }, "dossier-non-verifie"],
    [
      "intervenant d'un organisme sous-traitant",
      { organismeSousTraitantId: "66666666-6666-4666-8666-666666666666" },
      "intervenant-organisme",
    ],
    ["fiche inactive", { actif: false }, "inactif"],
    [
      "collaboration terminée",
      { finCollaborationAt: new Date("2026-10-01") },
      "collaboration-terminee",
    ],
    ["pseudonymisée (lien contractuel conservé)", { pseudonymisee: true }, "efface"],
    ["effacée", { email: "erased:x@erased.local", prenom: "[erased-rgpd-art17]" }, "efface"],
  ];

  for (const [nom, over, motif] of exclus) {
    it(`${nom} : jamais relancé (S6 ni S6 bis)`, () => {
      const f = fiche(over);
      expect(motifHorsPopulation(f)).toBe(motif);
      const attestationProche = piece({
        id: "77777777-7777-4777-8777-777777777777",
        type: "attestation_vigilance_urssaf",
        dateEmission: new Date(MAINTENANT.getTime() - 175 * JOUR),
        dateExpiration: null,
      });
      const l = lecture([piece(), attestationProche], { fiches: [f] });
      expect(faitsPieces(l, MAINTENANT)).toEqual([]);
      expect(faitsVigilance(l, MAINTENANT)).toEqual([]);
    });
  }

  it("RC pro déjà renouvelée (nouvelle pièce validée, échéance lointaine) : jamais relancée", () => {
    const neuve = piece({
      id: "88888888-8888-4888-8888-888888888888",
      dateEmission: MAINTENANT,
      dateExpiration: new Date(MAINTENANT.getTime() + 365 * JOUR),
      createdAt: MAINTENANT,
    });
    expect(faitsPieces(lecture([piece(), neuve]), MAINTENANT)).toEqual([]);
  });

  it("le cas inclus : indépendant du nouveau parcours, actif, en cours, pièce dans la fenêtre", () => {
    expect(motifHorsPopulation(fiche())).toBeNull();
    expect(faitsPieces(lecture([piece()]), MAINTENANT)).toHaveLength(1);
  });

  it("le `where` en base porte chaque exclusion (le code relit ensuite chaque fiche)", () => {
    expect(WHERE_POPULATION).toMatchObject({
      statut: "sous_traitant",
      organismeSousTraitantId: null,
      dossierStatut: "verifie",
      actif: true,
      finCollaborationAt: null,
      candidatureOrigine: {
        is: { natureCollaboration: "freelance", status: { notIn: ["rejected", "withdrawn"] } },
      },
    });
  });
});

// ── Base simulée pour la lecture en lot et la relecture au départ ───────────
function baseSimulee(o: {
  fiches: Array<Record<string, unknown>>;
  pieces?: PieceLue[];
  effacements?: string[];
  opposition?: boolean;
}) {
  const trouverFiches = vi.fn(async (args: { where: Record<string, unknown> }) =>
    o.fiches.filter((f) => !("id" in args.where) || f.id === args.where.id),
  );
  Object.assign(prisma, {
    trainer: { findMany: trouverFiches },
    activityLog: {
      findMany: vi.fn(async () => (o.effacements ?? []).map((targetId) => ({ targetId }))),
    },
    trainerDocument: {
      findMany: vi.fn(async () => (o.pieces ?? []).map((p) => ({ ...p, trainerId: T1 }))),
    },
    emailLog: { findMany: vi.fn(async () => []) },
    emailOutbox: { findMany: vi.fn(async () => []) },
    emailOpposition: {
      findMany: vi.fn(async (args: { where: { emailHash: { in: string[] } } }) =>
        o.opposition ? args.where.emailHash.in.map((emailHash) => ({ emailHash })) : [],
      ),
    },
  });
  return { trouverFiches };
}

const ligneBase = (over: Record<string, unknown> = {}) => ({
  id: T1,
  prenom: "Camille",
  email: "camille@example.com",
  statut: "sous_traitant",
  actif: true,
  finCollaborationAt: null,
  organismeSousTraitantId: null,
  dossierStatut: "verifie",
  candidatureOrigine: { natureCollaboration: "freelance", status: "hired" },
  ...over,
});

describe("lecture en lot", () => {
  it("interroge la base avec le `where` de la population", async () => {
    const { trouverFiches } = baseSimulee({ fiches: [ligneBase()], pieces: [piece()] });
    const l = await lirePourRelances();
    expect(trouverFiches.mock.calls[0]![0].where).toEqual(WHERE_POPULATION);
    expect(l.fiches).toHaveLength(1);
  });

  it("une fiche pseudonymisée (effacement journalisé) est écartée même si la base la rend", async () => {
    baseSimulee({ fiches: [ligneBase()], pieces: [piece()], effacements: [T1] });
    expect((await lirePourRelances()).fiches).toEqual([]);
  });

  it("une ligne hors population rendue par la base est écartée par le code", async () => {
    baseSimulee({ fiches: [ligneBase({ statut: "salarie" })], pieces: [piece()] });
    expect((await lirePourRelances()).fiches).toEqual([]);
  });
});

describe("relecture au départ : arrêt immédiat", () => {
  const allumes = async () => true;
  const job = (origineRelance: unknown = "assurance_rc_pro-20261102") =>
    ["formateur-piece-a-renouveler", "Trainer", T1, { origineRelance }] as const;

  it("tout est encore vrai : la relance part", async () => {
    baseSimulee({ fiches: [ligneBase()], pieces: [piece()] });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toBeNull();
  });

  it("pièce renouvelée entre-temps : retenue", async () => {
    const neuve = piece({
      id: "99999999-9999-4999-8999-999999999999",
      dateEmission: MAINTENANT,
      dateExpiration: new Date(MAINTENANT.getTime() + 365 * JOUR),
      createdAt: MAINTENANT,
    });
    baseSimulee({ fiches: [ligneBase()], pieces: [piece(), neuve] });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toMatch(
      /plus à renouveler/,
    );
  });

  it("nouvelle pièce déposée (en attente) : retenue", async () => {
    const depot = piece({
      id: "99999999-9999-4999-8999-999999999998",
      statutValidation: "en_attente",
      createdAt: MAINTENANT,
      valideAt: null,
    });
    baseSimulee({ fiches: [ligneBase()], pieces: [piece(), depot] });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toMatch(/déposée/);
  });

  it("collaboration terminée entre-temps : retenue", async () => {
    baseSimulee({ fiches: [ligneBase({ finCollaborationAt: new Date() })], pieces: [piece()] });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toMatch(/plus concernée/);
  });

  it("désinscrite (opposition) : retenue", async () => {
    baseSimulee({ fiches: [ligneBase()], pieces: [piece()], opposition: true });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toMatch(/opposée/);
  });

  it("pseudonymisée entre-temps : retenue", async () => {
    baseSimulee({ fiches: [ligneBase()], pieces: [piece()], effacements: [T1] });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toMatch(/plus concernée/);
  });

  it("interrupteur coupé entre-temps : retenue", async () => {
    baseSimulee({ fiches: [ligneBase()], pieces: [piece()] });
    expect(await motifRetenueRelancePiece(...job(), async () => false, MAINTENANT)).toMatch(
      /coupées/,
    );
  });

  it("sans origine lisible, ou base muette : retenue (échec fermé)", async () => {
    expect(await motifRetenueRelancePiece(...job(42), allumes, MAINTENANT)).not.toBeNull();
    Object.assign(prisma, {
      trainer: {
        findMany: vi.fn(async () => {
          throw new Error("base muette");
        }),
      },
    });
    expect(await motifRetenueRelancePiece(...job(), allumes, MAINTENANT)).toMatch(/illisible/);
  });

  it("le payload porte l'origine, jamais l'adresse", () => {
    const [f] = faitsPieces(lecture([piece()]), MAINTENANT);
    expect(f!.payload.origineRelance).toBe("assurance_rc_pro-20261102");
    expect(JSON.stringify(f!.payload)).not.toMatch(/@/);
  });
});
