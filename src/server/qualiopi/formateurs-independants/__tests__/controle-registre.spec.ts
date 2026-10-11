/**
 * Lot L4 (ADR 0066 étape 6 et (i)) — contrôle registre d'un formateur
 * indépendant : verdict vert / orange / rouge, preuve horodatée en AJOUT SEUL,
 * validation d'un orange, contrôle périodique éteint par défaut.
 *
 * Tests ROUGES au premier commit : les modules `controle-regles.ts` et
 * `controle.ts` n'existaient pas.
 */

import { describe, expect, it, vi } from "vitest";

import {
  DELAI_RECONTROLE_JOURS,
  FRAICHEUR_CONTROLE_JOURS,
  SOURCE_VALIDATION_ORANGE,
  aRecontroler,
  dansLaPlageDuPassage,
  etatControle,
  jugerControleRegistre,
  normaliserNda,
  type EntreeControle,
} from "../controle-regles";
import {
  controlerRegistreFormateur,
  jsonCanonique,
  passerControleRegistrePeriodique,
  validerControleOrange,
  type SourceRegistre,
} from "../controle";

const JOUR = 24 * 3600 * 1000;
const SIREN = "123456782";
const SIRET = `${SIREN}00012`;
const NDA = "84380000000";
const TRAINER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const CONTROLE = "33333333-3333-4333-8333-333333333333";

function entree(over: Partial<EntreeControle> = {}): EntreeControle {
  return {
    siret: SIRET,
    nda: NDA,
    entreprise: {
      siren: SIREN,
      etatAdministratif: "A",
      naf: "85.59A",
      etablissement: { siret: SIRET, ouvert: true },
    },
    listeOF: { ndaDuSiren: [NDA], sirenDuNda: SIREN },
    ...over,
  };
}

describe("jugerControleRegistre — les quatre vérifications", () => {
  it("tout est bon → vert, numéro vu sur la liste publique", () => {
    const v = jugerControleRegistre(entree());
    expect(v.verdict).toBe("vert");
    expect(v.motifs).toEqual([]);
    expect(v.ndaSurLaListe).toBe(true);
  });

  it("registre muet → orange « à contrôler », jamais une conclusion", () => {
    const v = jugerControleRegistre(entree({ entreprise: null }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("registre_muet");
  });

  it("liste publique muette → orange, jamais « numéro caduc »", () => {
    const v = jugerControleRegistre(entree({ listeOF: null }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("liste_of_muette");
    expect(v.ndaSurLaListe).toBe(false);
  });

  it("SIREN cessé → rouge", () => {
    const e = entree();
    const v = jugerControleRegistre({
      ...e,
      entreprise: { ...e.entreprise!, etatAdministratif: "C" },
    });
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("siren_cesse");
  });

  it("établissement fermé → rouge", () => {
    const e = entree();
    const v = jugerControleRegistre({
      ...e,
      entreprise: { ...e.entreprise!, etablissement: { siret: SIRET, ouvert: false } },
    });
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("etablissement_ferme");
  });

  it("numéro de déclaration porté par un AUTRE SIREN → rouge", () => {
    const v = jugerControleRegistre(
      entree({ listeOF: { ndaDuSiren: [], sirenDuNda: "999999999" } }),
    );
    expect(v.verdict).toBe("rouge");
    expect(v.motifs).toContain("nda_autre_siren");
  });

  it("numéro absent de la liste → orange", () => {
    const v = jugerControleRegistre(entree({ listeOF: { ndaDuSiren: [], sirenDuNda: null } }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("nda_hors_liste");
  });

  it("numéro « en cours » → orange", () => {
    const v = jugerControleRegistre(entree({ nda: "en cours" }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("nda_en_cours");
  });

  it("numéro absent → orange", () => {
    const v = jugerControleRegistre(entree({ nda: null }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("nda_absent");
  });

  it("activité sans lien avec la formation → orange, pas rouge", () => {
    const e = entree();
    const v = jugerControleRegistre({ ...e, entreprise: { ...e.entreprise!, naf: "56.10A" } });
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("activite_a_controler");
  });

  it("SIRET absent → orange, et la liste n'est pas dite « muette »", () => {
    const v = jugerControleRegistre(entree({ siret: null, entreprise: null, listeOF: null }));
    expect(v.verdict).toBe("orange");
    expect(v.motifs).toContain("siret_absent");
    expect(v.motifs).toContain("nda_non_verifie");
    expect(v.motifs).not.toContain("liste_of_muette");
  });

  it("normaliserNda garde 11 chiffres, sinon null", () => {
    expect(normaliserNda("84 38 00000 00")).toBe(NDA);
    expect(normaliserNda("en cours")).toBeNull();
    expect(normaliserNda("123")).toBeNull();
  });
});

describe("etatControle — ce que vaut le dernier contrôle", () => {
  const maintenant = new Date("2026-10-31T10:00:00Z");
  const ligne = (
    verdict: "vert" | "orange" | "rouge",
    joursAvant: number,
    source = "registre",
    creeJoursAvant = joursAvant,
  ) => ({
    id: `${verdict}-${joursAvant}-${source}`,
    verdict,
    source,
    verifieAt: new Date(maintenant.getTime() - joursAvant * JOUR),
    createdAt: new Date(maintenant.getTime() - creeJoursAvant * JOUR),
  });

  it("aucun contrôle → non probant", () => {
    expect(etatControle([], maintenant).probant).toBe(false);
  });

  it("vert de moins de 30 jours → probant", () => {
    expect(etatControle([ligne("vert", 29)], maintenant).probant).toBe(true);
  });

  it(`vert de plus de ${FRAICHEUR_CONTROLE_JOURS} jours → non probant`, () => {
    expect(etatControle([ligne("vert", 31)], maintenant).probant).toBe(false);
  });

  it("orange non validé → non probant", () => {
    const e = etatControle([ligne("orange", 2)], maintenant);
    expect(e.statut).toBe("orange_a_valider");
    expect(e.probant).toBe(false);
  });

  it("orange validé → probant, aux MÊMES dates qu'un vert (K-2)", () => {
    const e = etatControle(
      [ligne("orange", 10), ligne("orange", 10, SOURCE_VALIDATION_ORANGE, 1)],
      maintenant,
    );
    expect(e.statut).toBe("orange_valide");
    expect(e.probant).toBe(true);
    expect(e.dernierAt?.getTime()).toBe(maintenant.getTime() - 10 * JOUR);
  });

  it("un contrôle rouge APRÈS une validation l'emporte", () => {
    const e = etatControle(
      [ligne("orange", 10), ligne("orange", 10, SOURCE_VALIDATION_ORANGE, 9), ligne("rouge", 1)],
      maintenant,
    );
    expect(e.statut).toBe("rouge");
    expect(e.probant).toBe(false);
  });
});

describe("contrôle périodique — sélection et plage horaire (K-4)", () => {
  const maintenant = new Date("2026-10-31T10:00:00Z");

  it(`recontrôle au-delà de ${DELAI_RECONTROLE_JOURS} jours, jamais de trou au-delà de 30`, () => {
    expect(aRecontroler(null, maintenant)).toBe(true);
    expect(aRecontroler(new Date(maintenant.getTime() - 26 * JOUR), maintenant)).toBe(true);
    expect(aRecontroler(new Date(maintenant.getTime() - 24 * JOUR), maintenant)).toBe(false);
    // Mois de 31 jours : contrôlé le 1er, recontrôlé dès le 27 — avant J+30.
    const premier = new Date("2026-10-01T10:00:00Z");
    expect(aRecontroler(premier, new Date("2026-10-27T10:00:00Z"))).toBe(true);
  });

  it("plage 8 h - 19 h, heure de Paris", () => {
    expect(dansLaPlageDuPassage(new Date("2026-10-31T06:30:00Z"))).toBe(false); // 7 h 30
    expect(dansLaPlageDuPassage(new Date("2026-10-31T07:30:00Z"))).toBe(true); // 8 h 30 (UTC+1)
    expect(dansLaPlageDuPassage(new Date("2026-10-31T18:30:00Z"))).toBe(false); // 19 h 30
  });
});

// ─── Écritures (client de base factice) ─────────────────────────────────────

function fausseBase(opts: {
  trainer?: Record<string, unknown> | null;
  controles?: Array<Record<string, unknown>>;
  interrupteur?: unknown;
  actifs?: Array<{ id: string; dernier: Date | null }>;
}) {
  const crees: Array<Record<string, unknown>> = [];
  const journal: Array<Record<string, unknown>> = [];
  const majTrainer: Array<Record<string, unknown>> = [];
  const verif = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      crees.push(data);
      return { id: `v${crees.length}`, ...data };
    }),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(async (): Promise<unknown> => null),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return (opts.controles ?? []).find((c) => c.id === where.id) ?? null;
    }),
  };
  const db = {
    trainer: {
      findUnique: vi.fn(async () => (opts.trainer === undefined ? null : opts.trainer)),
      findMany: vi.fn(async () =>
        (opts.actifs ?? []).map((a) => ({
          id: a.id,
          verificationsRegistre: a.dernier ? [{ verifieAt: a.dernier }] : [],
        })),
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        majTrainer.push(data);
        return {};
      }),
    },
    verificationRegistreSousTraitance: verif,
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        journal.push(data);
        return {};
      }),
    },
    setting: {
      findUnique: vi.fn(async () =>
        opts.interrupteur === undefined ? null : { value: opts.interrupteur },
      ),
    },
    $executeRaw: vi.fn(async () => 0),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return { db, crees, journal, majTrainer, verif };
}

const sourceVerte: SourceRegistre = {
  lireEntreprise: async () => ({
    siren: SIREN,
    etatAdministratif: "A",
    naf: "85.59A",
    etablissement: { siret: SIRET, ouvert: true },
  }),
  lireListeOF: async () => ({ ndaDuSiren: [NDA], sirenDuNda: SIREN }),
};

const formateur = {
  id: TRAINER,
  statut: "sous_traitant",
  siret: SIRET,
  sousTraitantNda: NDA,
};

describe("controlerRegistreFormateur — une preuve à CHAQUE contrôle", () => {
  const maintenant = new Date("2026-10-31T10:00:00Z");

  it("écrit une ligne de preuve horodatée avec l'empreinte de la réponse", async () => {
    const { db, crees, journal } = fausseBase({ trainer: formateur });
    const r = await controlerRegistreFormateur(db as never, sourceVerte, {
      trainerId: TRAINER,
      verifieParId: ADMIN,
      maintenant,
    });
    expect(r).toMatchObject({ ok: true, verdict: "vert" });
    expect(crees).toHaveLength(1);
    expect(crees[0]).toMatchObject({
      trainerId: TRAINER,
      verdict: "vert",
      siren: SIREN,
      siret: SIRET,
      verifieParId: ADMIN,
      verifieAt: maintenant,
    });
    expect(String(crees[0]!.reponseSha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(journal).toHaveLength(1);
    expect(journal[0]!.targetId).toBe(TRAINER);
  });

  it("l'empreinte se recalcule sur la réponse stockée, sans champ hors contrat", async () => {
    const { db, crees } = fausseBase({ trainer: formateur });
    const bavarde: SourceRegistre = {
      ...sourceVerte,
      lireEntreprise: async () =>
        ({
          siren: SIREN,
          etatAdministratif: "A",
          naf: "85.59A",
          etablissement: { siret: SIRET, ouvert: true },
          dirigeants: ["Nom Prénom"],
        }) as never,
    };
    await controlerRegistreFormateur(db as never, bavarde, {
      trainerId: TRAINER,
      verifieParId: null,
      maintenant,
    });
    const stockee = crees[0]!.reponseSource;
    expect(JSON.stringify(stockee)).not.toContain("dirigeants");
    // jsonb réordonne les clés : on re-sérialise de façon canonique.
    const { createHash } = await import("node:crypto");
    const relue = JSON.parse(JSON.stringify(stockee));
    expect(createHash("sha256").update(jsonCanonique(relue)).digest("hex")).toBe(
      crees[0]!.reponseSha256,
    );
  });

  it("deux contrôles = deux lignes, jamais un UPDATE", async () => {
    const { db, crees, verif } = fausseBase({ trainer: formateur });
    await controlerRegistreFormateur(db as never, sourceVerte, {
      trainerId: TRAINER,
      verifieParId: null,
      maintenant,
    });
    await controlerRegistreFormateur(db as never, sourceVerte, {
      trainerId: TRAINER,
      verifieParId: null,
      maintenant,
    });
    expect(crees).toHaveLength(2);
    expect(verif.update).not.toHaveBeenCalled();
    expect(verif.updateMany).not.toHaveBeenCalled();
    expect(verif.delete).not.toHaveBeenCalled();
  });

  it("API qui lève → orange « à contrôler », jamais vert, et la ligne est écrite", async () => {
    const { db, crees } = fausseBase({ trainer: formateur });
    const panne: SourceRegistre = {
      lireEntreprise: async () => {
        throw new Error("délai dépassé");
      },
      lireListeOF: async () => {
        throw new Error("délai dépassé");
      },
    };
    const r = await controlerRegistreFormateur(db as never, panne, {
      trainerId: TRAINER,
      verifieParId: null,
      maintenant,
    });
    expect(r).toMatchObject({ ok: true, verdict: "orange" });
    expect(crees[0]!.verdict).toBe("orange");
  });

  it("numéro vu sur la liste → date posée sur la fiche", async () => {
    const { db, majTrainer } = fausseBase({ trainer: formateur });
    await controlerRegistreFormateur(db as never, sourceVerte, {
      trainerId: TRAINER,
      verifieParId: null,
      maintenant,
    });
    expect(majTrainer).toEqual([{ ndaVerifieListeAt: maintenant }]);
  });

  it("salarié ou dirigeant : hors périmètre, aucune ligne", async () => {
    const { db, crees } = fausseBase({ trainer: { ...formateur, statut: "salarie" } });
    const r = await controlerRegistreFormateur(db as never, sourceVerte, {
      trainerId: TRAINER,
      verifieParId: ADMIN,
      maintenant,
    });
    expect(r.ok).toBe(false);
    expect(crees).toHaveLength(0);
  });
});

describe("validerControleOrange — un orange validé est une NOUVELLE ligne", () => {
  const maintenant = new Date("2026-10-31T10:00:00Z");
  const verifieAt = new Date("2026-10-29T10:00:00Z");
  const orange = {
    id: CONTROLE,
    trainerId: TRAINER,
    verdict: "orange",
    source: "registre",
    siren: SIREN,
    siret: SIRET,
    numeroDeclarationActivite: NDA,
    verifieAt,
    createdAt: verifieAt,
  };

  it("valide un orange : même date de contrôle, auteur posé", async () => {
    const { db, crees } = fausseBase({ controles: [orange] });
    const r = await validerControleOrange(db as never, {
      trainerId: TRAINER,
      controleId: CONTROLE,
      motif: "Récépissé de déclaration vu, numéro attribué le 20/10.",
      valideParId: ADMIN,
      maintenant,
    });
    expect(r.ok).toBe(true);
    expect(crees).toHaveLength(1);
    expect(crees[0]).toMatchObject({
      verdict: "orange",
      source: SOURCE_VALIDATION_ORANGE,
      verifieAt,
      verifieParId: ADMIN,
    });
  });

  it("un rouge ne se valide jamais", async () => {
    const { db, crees } = fausseBase({ controles: [{ ...orange, verdict: "rouge" }] });
    const r = await validerControleOrange(db as never, {
      trainerId: TRAINER,
      controleId: CONTROLE,
      motif: "Je passe outre, ça ira très bien.",
      valideParId: ADMIN,
      maintenant,
    });
    expect(r.ok).toBe(false);
    expect(crees).toHaveLength(0);
  });

  it("sans motif → refus", async () => {
    const { db, crees } = fausseBase({ controles: [orange] });
    const r = await validerControleOrange(db as never, {
      trainerId: TRAINER,
      controleId: CONTROLE,
      motif: "  ",
      valideParId: ADMIN,
      maintenant,
    });
    expect(r.ok).toBe(false);
    expect(crees).toHaveLength(0);
  });

  it("le contrôle d'un AUTRE formateur → refus", async () => {
    const { db, crees } = fausseBase({
      controles: [{ ...orange, trainerId: "44444444-4444-4444-8444-444444444444" }],
    });
    const r = await validerControleOrange(db as never, {
      trainerId: TRAINER,
      controleId: CONTROLE,
      motif: "Récépissé de déclaration vu, numéro attribué le 20/10.",
      valideParId: ADMIN,
      maintenant,
    });
    expect(r.ok).toBe(false);
    expect(crees).toHaveLength(0);
  });

  it("un contrôle plus récent existe → refus (on ne valide que le dernier)", async () => {
    const { db, crees, verif } = fausseBase({ controles: [orange] });
    // La vérification se fait SOUS VERROU, dans la transaction.
    verif.findFirst.mockResolvedValueOnce({ id: "plus-recent" } as never);
    const r = await validerControleOrange(db as never, {
      trainerId: TRAINER,
      controleId: CONTROLE,
      motif: "Récépissé de déclaration vu, numéro attribué le 20/10.",
      valideParId: ADMIN,
      maintenant,
    });
    expect(r.ok).toBe(false);
    expect(crees).toHaveLength(0);
  });
});

describe("passerControleRegistrePeriodique — ÉTEINT par défaut", () => {
  const dansLaPlage = new Date("2026-10-31T09:00:00Z"); // 10 h à Paris

  it("interrupteur absent → aucun appel au registre, aucune ligne", async () => {
    const { db, crees } = fausseBase({
      actifs: [{ id: TRAINER, dernier: null }],
      trainer: formateur,
    });
    const lire = vi.fn(sourceVerte.lireEntreprise);
    const r = await passerControleRegistrePeriodique(
      db as never,
      { ...sourceVerte, lireEntreprise: lire },
      { maintenant: dansLaPlage },
    );
    expect(r).toMatchObject({ passe: false, raison: "interrupteur" });
    expect(lire).not.toHaveBeenCalled();
    expect(crees).toHaveLength(0);
  });

  it("allumé, dans la plage : recontrôle les fiches de plus de 25 jours, plafonné", async () => {
    const { db, crees } = fausseBase({
      interrupteur: { actif: true },
      trainer: formateur,
      actifs: [
        { id: TRAINER, dernier: new Date(dansLaPlage.getTime() - 26 * JOUR) },
        {
          id: "55555555-5555-4555-8555-555555555555",
          dernier: new Date(dansLaPlage.getTime() - 3 * JOUR),
        },
        { id: "66666666-6666-4666-8666-666666666666", dernier: null },
      ],
    });
    const r = await passerControleRegistrePeriodique(db as never, sourceVerte, {
      maintenant: dansLaPlage,
      plafond: 1,
    });
    expect(r).toMatchObject({ passe: true, controles: 1 });
    expect(crees).toHaveLength(1);
    // Le contrôle périodique est l'œuvre du système : aucun auteur.
    expect(crees[0]!.verifieParId).toBeNull();
  });

  it("allumé, hors plage → rien", async () => {
    const { db, crees } = fausseBase({
      interrupteur: { actif: true },
      actifs: [{ id: TRAINER, dernier: null }],
      trainer: formateur,
    });
    const r = await passerControleRegistrePeriodique(db as never, sourceVerte, {
      maintenant: new Date("2026-10-31T20:00:00Z"),
    });
    expect(r).toMatchObject({ passe: false, raison: "hors_plage" });
    expect(crees).toHaveLength(0);
  });
});
