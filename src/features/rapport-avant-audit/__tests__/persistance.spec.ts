/**
 * Persistance du rapport avant audit : chiffrement aller-retour, empreinte altérée refusée,
 * contrat vérifié à la lecture, historique conservé (une ligne par lancement, jamais
 * d'écrasement, jamais de suppression).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { chiffrerParole } from "@/lib/chiffrer-parole";

import {
  BaseHorsContrat,
  EmpreinteAlteree,
  RapportEcarte,
  TransitionRefusee,
  creerRapport,
  empreinteDe,
  enregistrerResultat,
  lancementsEnSuspens,
  lireBaseAudit,
  listerRapportsDuClient,
  marquerErreur,
  noterProgression,
  ouvrirBase,
  ouvrirPropositions,
  prendreRapport,
  remettreEnAttente,
  scellerBase,
  scellerPropositions,
  type BaseRapports,
} from "../persistance";
import { baseValide, CLIENT_FIXTURE, fausseTable } from "./base.fixture";

const ENV0 = { ...process.env };
beforeEach(() => {
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64) };
});
afterEach(() => {
  process.env = { ...ENV0 };
});

function base(table = fausseTable()) {
  return { table, db: { rapportAvantAudit: table } as unknown as BaseRapports };
}

const resultat = () => ({
  base: baseValide(),
  jetonsEntree: 120,
  jetonsSortie: 80,
  nbRecherches: 3,
});

describe("chiffrement de la base d'audit", () => {
  it("aller-retour : la base relue est identique, et jamais en clair en base", () => {
    const b = baseValide();
    const s = scellerBase(b);
    expect(s.chiffre.startsWith("enc:v1:")).toBe(true);
    expect(s.chiffre).not.toContain("soirées");
    expect(s.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(ouvrirBase(s.chiffre, s.empreinte)).toEqual(b);
  });

  it("sans clé de chiffrement, rien n'est scellé (aucun repli en clair)", () => {
    delete process.env["PII_ENCRYPTION_KEY"];
    expect(() => scellerBase(baseValide())).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("une base hors contrat n'est jamais scellée", () => {
    const b = { ...baseValide(), pistes: [{ ...baseValide().pistes[0]!, besoinsServis: ["B9"] }] };
    expect(() => scellerBase(b)).toThrow(BaseHorsContrat);
  });

  it("une empreinte altérée est refusée", () => {
    const s = scellerBase(baseValide());
    const fausse = (s.empreinte[0] === "a" ? "b" : "a") + s.empreinte.slice(1);
    expect(() => ouvrirBase(s.chiffre, fausse)).toThrow(EmpreinteAlteree);
    expect(() => ouvrirBase(s.chiffre, "pas-une-empreinte")).toThrow(EmpreinteAlteree);
  });

  it("un chiffré substitué (autre contenu, même empreinte) est refusé", () => {
    const s = scellerBase(baseValide());
    const autre = chiffrerParole(JSON.stringify({ ...baseValide(), sources: [], pistes: [] }));
    expect(() => ouvrirBase(autre, s.empreinte)).toThrow(EmpreinteAlteree);
  });

  it("une base dont l'empreinte concorde mais hors contrat est refusée à la lecture", () => {
    const json = JSON.stringify({ version: "base-audit/1", n_importe: "quoi" });
    expect(() => ouvrirBase(chiffrerParole(json), empreinteDe(json))).toThrow(BaseHorsContrat);
  });
});

describe("cycle de vie d'un lancement", () => {
  it("prise atomique : un second passage ne reprend pas la même ligne", async () => {
    const { db } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    expect(await prendreRapport(id, new Date(), db)).toBeInstanceOf(Date);
    expect(await prendreRapport(id, new Date(), db)).toBeNull();
  });

  it("le résultat est chiffré, scellé et relu ; les propositions aussi", async () => {
    const { db, table } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const jeton = (await prendreRapport(id, new Date(), db))!;
    await enregistrerResultat(id, jeton, resultat(), new Date(), db);
    const ligne = table.lignes[0]!;
    expect(ligne.statut).toBe("termine");
    expect(ligne.progression).toBe(100);
    expect(String(ligne.baseAudit).startsWith("enc:v1:")).toBe(true);
    expect(JSON.stringify(ligne.propositionsFiche)).not.toContain("effectif");
    expect(ouvrirPropositions(ligne.propositionsFiche)).toEqual(baseValide().propositions_fiche);
    expect(await lireBaseAudit(id, db)).toEqual(baseValide());
  });

  it("une base altérée en base n'est pas rendue par la lecture", async () => {
    const { db, table } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const jeton = (await prendreRapport(id, new Date(), db))!;
    await enregistrerResultat(id, jeton, resultat(), new Date(), db);
    table.lignes[0]!.baseEmpreinte = "0".repeat(64);
    await expect(lireBaseAudit(id, db)).rejects.toThrow(EmpreinteAlteree);
  });

  it("historique conservé : chaque lancement est une ligne neuve, jamais écrasée", async () => {
    const { db, table } = base();
    const a = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const jeton = (await prendreRapport(a.id, new Date(), db))!;
    await enregistrerResultat(a.id, jeton, resultat(), new Date(), db);
    const premiereBase = table.lignes[0]!.baseAudit;

    // Second enregistrement sur la même ligne : refusé, la première base reste.
    await expect(enregistrerResultat(a.id, jeton, resultat(), new Date(), db)).rejects.toThrow(
      TransitionRefusee,
    );
    expect(table.lignes[0]!.baseAudit).toBe(premiereBase);

    const b = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    expect(b.id).not.toBe(a.id);
    const historique = await listerRapportsDuClient(CLIENT_FIXTURE, db);
    expect(historique).toHaveLength(2);
    // La liste ne déchiffre rien et ne rend jamais la base.
    expect(historique.every((h) => !("baseAudit" in h))).toBe(true);
  });

  it("une ligne mise à l'écart n'est plus déchiffrée", async () => {
    const { db, table } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const jeton = (await prendreRapport(id, new Date(), db))!;
    await enregistrerResultat(id, jeton, resultat(), new Date(), db);
    table.lignes[0]!.ecarteLe = new Date();
    await expect(lireBaseAudit(id, db)).rejects.toThrow(RapportEcarte);
  });

  it("interruption : la ligne repasse en attente et est reprise au démarrage", async () => {
    const { db, table } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const jeton = (await prendreRapport(id, new Date(), db))!;
    await remettreEnAttente(id, jeton, db);
    expect(table.lignes[0]!.statut).toBe("en_attente");
    expect(table.lignes[0]!.erreur).toBeNull();
    expect(await lancementsEnSuspens(new Date(), db)).toEqual([id]);
  });

  it("une ligne en cours sans nouvelles depuis 30 min est tenue pour abandonnée", async () => {
    const t0 = new Date("2026-11-02T10:00:00Z");
    let t = t0;
    const { db, table } = base(fausseTable(() => t));
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    await prendreRapport(id, t0, db);
    t = new Date(t0.getTime() + 10 * 60_000);
    expect(await lancementsEnSuspens(t, db)).toEqual([]);
    expect(table.lignes[0]!.statut).toBe("en_cours");
    t = new Date(t0.getTime() + 31 * 60_000);
    expect(await lancementsEnSuspens(t, db)).toEqual([id]);
    // Libérée : la fiche n'est plus bloquée (la ligne n'est plus « en vol » côté en_cours).
    expect(table.lignes[0]!.statut).toBe("en_attente");
  });

  it("une prise périmée (ligne libérée puis reprise) ne peut plus rien écrire", async () => {
    const t0 = new Date("2026-11-02T10:00:00Z");
    let t = t0;
    const { db, table } = base(fausseTable(() => t));
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const ancienne = (await prendreRapport(id, t0, db))!;
    t = new Date(t0.getTime() + 31 * 60_000);
    await lancementsEnSuspens(t, db);
    const neuve = (await prendreRapport(id, t, db))!;
    expect(neuve.getTime()).not.toBe(ancienne.getTime());

    await noterProgression(id, ancienne, "Vieille étape", 50, db);
    await remettreEnAttente(id, ancienne, db);
    await marquerErreur(id, "vieille erreur", t, db, ancienne);
    await expect(enregistrerResultat(id, ancienne, resultat(), t, db)).rejects.toThrow(
      TransitionRefusee,
    );
    expect(table.lignes[0]!.statut).toBe("en_cours");
    expect(table.lignes[0]!.etape).toBe("Démarrage");
    expect(table.lignes[0]!.erreur).toBeNull();

    await enregistrerResultat(id, neuve, resultat(), t, db);
    expect(table.lignes[0]!.statut).toBe("termine");
  });

  it("sans jeton, marquerErreur ne touche jamais une ligne en cours", async () => {
    const { db, table } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    await prendreRapport(id, new Date(), db);
    await marquerErreur(id, "file indisponible", new Date(), db);
    expect(table.lignes[0]!.statut).toBe("en_cours");
  });

  it("une base d'un AUTRE client recopiée sur la ligne n'est pas rendue", async () => {
    const { db, table } = base();
    const { id } = await creerRapport(
      { clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null },
      db,
    );
    const jeton = (await prendreRapport(id, new Date(), db))!;
    await enregistrerResultat(id, jeton, resultat(), new Date(), db);
    table.lignes[0]!.clientId = "22222222-2222-4222-8222-222222222222";
    await expect(lireBaseAudit(id, db)).rejects.toThrow(EmpreinteAlteree);
  });
});

describe("propositions de mise à jour de la fiche", () => {
  it("scellées avec une empreinte : altérée → refusée", () => {
    const e = scellerPropositions(baseValide().propositions_fiche);
    expect(e.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(ouvrirPropositions(e)).toEqual(baseValide().propositions_fiche);
    expect(() => ouvrirPropositions({ ...e, empreinte: "0".repeat(64) })).toThrow(EmpreinteAlteree);
    expect(() => ouvrirPropositions({ v: 1, chiffre: e.chiffre })).toThrow(BaseHorsContrat);
  });

  it("JSON illisible (empreinte concordante) → BaseHorsContrat, jamais une SyntaxError", () => {
    const json = "{pas du json";
    expect(() =>
      ouvrirPropositions({ v: 1, chiffre: chiffrerParole(json), empreinte: empreinteDe(json) }),
    ).toThrow(BaseHorsContrat);
  });
});
