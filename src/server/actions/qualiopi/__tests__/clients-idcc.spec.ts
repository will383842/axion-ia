/**
 * INT-T78-A — SIRET → IDCC automatique sur la fiche client, statut du contrôle
 * (INT-T61-A) et action « Confirmer l'IDCC ».
 *
 * Les témoins d'A02 (axion-apporteurs #782, 6035040482), puis ceux de la
 * sécurité (action admin) :
 *  - la lecture neutre ne contient aucun terme de Qualiopi (témoin STATIQUE) ;
 *  - un annuaire en panne laisse le contrôle inchangé, et ne se lit jamais comme
 *    « aucun IDCC publié » ;
 *  - `liste_idcc = ["1596"]` sans IDCC saisi donne `probable`, l'IDCC proposé
 *    n'étant pas écrit comme saisie ;
 *  - `confirme` n'apparaît qu'après le geste de confirmation, avec son auteur.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  complementsParSiren,
  viderCacheComplements,
} from "@/features/dossier-client/recherche-entreprises";
import {
  confirmerIdccClient,
  sirenDeLaFiche,
  verifierIdccClient,
  type BaseIdccClient,
} from "@/server/qualiopi/financements/idcc-client";

const CLIENT = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";
const ADMIN = "9d2f1c80-3b55-4e7a-a1b2-6c7d8e9f0a11";
const SIREN = "356000000";

type Ligne = {
  statut: string;
  idcc: string | null;
  preuveType: string | null;
  preuveOpco: string | null;
  preuveAuteurId: string | null;
  preuveLe: Date | null;
};

/** Fausse base : une fiche, une ligne de contrôle, un journal, les couples de la table. */
function fausseBase(
  fiche: Partial<{
    siren: string | null;
    siret: string | null;
    idcc: string | null;
    opco: string | null;
    nafCode: string | null;
    type: string;
  }> = {},
  couples: Array<{ opco: string; siretNombre: number }> = [
    { opco: "constructys", siretNombre: 100 },
  ],
) {
  const etat: { ligne: Ligne | null; journal: unknown[]; ecritures: number } = {
    ligne: null,
    journal: [],
    ecritures: 0,
  };
  const ficheComplete = {
    siren: null,
    siret: "35600000000048",
    idcc: null,
    opco: "constructys",
    nafCode: "4120A",
    type: "entreprise",
    ...fiche,
  };
  const tx = {
    clientIdccControle: {
      findUnique: async () =>
        etat.ligne === null ? null : { statut: etat.ligne.statut, idcc: etat.ligne.idcc },
      upsert: async (a: { create: Ligne; update: Ligne }) => {
        etat.ecritures++;
        etat.ligne = etat.ligne === null ? { ...a.create } : { ...a.update };
      },
    },
    clientIdccControleJournal: {
      create: async (a: { data: unknown }) => void etat.journal.push(a.data),
    },
  };
  const db = {
    client: { findUnique: async () => ficheComplete },
    clientIdccControle: { findUnique: async () => etat.ligne },
    idccOpco: {
      findMany: async () =>
        couples.map((c) => ({ ...c, millesimeSource: new Date("2025-01-01T00:00:00Z") })),
    },
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as BaseIdccClient;
  return { db, etat, fiche: ficheComplete };
}

const annuaire = (liste: unknown) => async () => ({
  ok: true as const,
  complements: liste === undefined ? null : { liste_idcc: liste },
});
const enPanne = async () => ({ ok: false as const, motif: "indisponible" as const });

beforeEach(() => viderCacheComplements());

describe("la lecture par SIREN reste NEUTRE (témoin statique)", () => {
  it("ne contient aucun terme de Qualiopi", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/dossier-client/recherche-entreprises.ts"),
      "utf8",
    );
    const debut = source.indexOf("// ── DEBUT lecture par SIREN");
    const fin = source.indexOf("// ── FIN lecture par SIREN");
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    expect(source.slice(debut, fin)).not.toMatch(/idcc|opco|qualiopi|statut|confirm|preuve/i);
  });
});

describe("complementsParSiren — le module neutre", () => {
  it("rend les compléments du bon SIREN, sans rien en déduire", async () => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            results: [
              { siren: "111111111", complements: { liste_idcc: ["0001"] } },
              { siren: SIREN, complements: { liste_idcc: ["1596"] } },
            ],
          }),
        ),
    );
    const r = await complementsParSiren(SIREN, { fetch });
    expect(r).toEqual({ ok: true, complements: { liste_idcc: ["1596"] } });
    expect(String(fetch.mock.calls[0]![0])).toContain(`q=${SIREN}`);
  });

  it("contrôle le SIREN AVANT d'appeler l'annuaire", async () => {
    const fetch = vi.fn();
    expect(await complementsParSiren("12345", { fetch })).toEqual({
      ok: false,
      motif: "siren_invalide",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("panne, statut HTTP d'erreur, réponse illisible ⇒ `indisponible` ; autre SIREN ⇒ `introuvable`", async () => {
    expect(
      await complementsParSiren(SIREN, {
        fetch: async () => {
          throw new Error("réseau");
        },
      }),
    ).toEqual({ ok: false, motif: "indisponible" });
    viderCacheComplements();
    expect(
      await complementsParSiren(SIREN, { fetch: async () => new Response("x", { status: 503 }) }),
    ).toEqual({
      ok: false,
      motif: "indisponible",
    });
    viderCacheComplements();
    expect(
      await complementsParSiren(SIREN, {
        fetch: async () => new Response(JSON.stringify({ results: [{ siren: "999999999" }] })),
      }),
    ).toEqual({ ok: false, motif: "introuvable" });
  });

  it("garde 24 h les réponses obtenues, jamais une panne", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ results: [{ siren: SIREN }] })));
    await complementsParSiren(SIREN, { fetch: ok });
    await complementsParSiren(SIREN, { fetch: ok });
    expect(ok).toHaveBeenCalledOnce();
    viderCacheComplements();
    const panne = vi.fn(async () => new Response("x", { status: 500 }));
    await complementsParSiren(SIREN, { fetch: panne });
    await complementsParSiren(SIREN, { fetch: panne });
    expect(panne).toHaveBeenCalledTimes(2);
  });
});

describe("verifierIdccClient — le domaine interprète", () => {
  it("annuaire EN PANNE : le contrôle est inchangé, rien n'est écrit, jamais « aucun IDCC publié »", async () => {
    const { db, etat } = fausseBase();
    const r = await verifierIdccClient(db, enPanne, CLIENT);
    expect(r).toEqual({ ok: false, motif: "annuaire_indisponible" });
    expect(etat.ecritures).toBe(0);
    expect(etat.ligne).toBeNull();
    expect(etat.journal).toEqual([]);
  });

  it("annuaire qui ne connaît pas le SIREN : inchangé aussi (`annuaire_introuvable`)", async () => {
    const { db, etat } = fausseBase();
    const r = await verifierIdccClient(
      db,
      async () => ({ ok: false, motif: "introuvable" }),
      CLIENT,
    );
    expect(r).toEqual({ ok: false, motif: "annuaire_introuvable" });
    expect(etat.ecritures).toBe(0);
  });

  it("`liste_idcc = [\"1596\"]` sans IDCC saisi ⇒ `probable`, l'IDCC est PROPOSÉ et n'est pas écrit comme saisie", async () => {
    const { db, etat, fiche } = fausseBase({ idcc: null });
    const r = await verifierIdccClient(db, annuaire(["1596"]), CLIENT);
    expect(r).toMatchObject({
      ok: true,
      statut: "probable",
      idcc: null,
      idccPropose: "1596",
    });
    // La ligne de contrôle ne porte AUCUN IDCC : la proposition n'est pas une saisie.
    expect(etat.ligne).toMatchObject({ statut: "probable", idcc: null });
    expect(fiche.idcc).toBeNull();
  });

  it("les valeurs d'échappement de la DSN ne sont jamais proposées", async () => {
    const { db } = fausseBase({ idcc: null });
    const r = await verifierIdccClient(db, annuaire(["9999"]), CLIENT);
    expect(r).toMatchObject({ ok: true, statut: "non_renseigne", idccPropose: null });
  });

  it("plusieurs conventions publiées et rien de saisi ⇒ anomalie, aucune proposition", async () => {
    const { db } = fausseBase({ idcc: null });
    const r = await verifierIdccClient(db, annuaire(["1596", "0843"]), CLIENT);
    expect(r).toMatchObject({ ok: true, statut: "anomalie", idccPropose: null });
  });

  it("n'écrit JAMAIS `confirme` : même un IDCC saisi qui concorde reste `concordant`", async () => {
    const { db, etat } = fausseBase({ idcc: "1596" });
    const r = await verifierIdccClient(db, annuaire(["1596"]), CLIENT);
    expect(r).toMatchObject({ ok: true, statut: "concordant" });
    expect(etat.ligne?.statut).not.toBe("confirme");
    expect(etat.ligne?.preuveAuteurId).toBeNull();
  });

  it("refuse un particulier, un client introuvable, un SIREN invalide — sans appeler l'annuaire", async () => {
    const lire = vi.fn();
    expect(await verifierIdccClient(fausseBase({ type: "particulier" }).db, lire, CLIENT)).toEqual({
      ok: false,
      motif: "particulier",
    });
    expect(
      await verifierIdccClient(fausseBase({ siret: "123", siren: null }).db, lire, CLIENT),
    ).toEqual({ ok: false, motif: "siren_invalide" });
    expect(lire).not.toHaveBeenCalled();
  });

  it("le SIREN vient du SIRET de la fiche quand il est valide", () => {
    expect(sirenDeLaFiche({ siren: "111111111", siret: "35600000000048" })).toBe(SIREN);
    expect(sirenDeLaFiche({ siren: SIREN, siret: null })).toBe(SIREN);
    expect(sirenDeLaFiche({ siren: null, siret: "abc" })).toBeNull();
  });
});

describe("confirmerIdccClient — le geste de confirmation", () => {
  it("`confirme` n'apparaît QU'APRÈS le geste, avec son auteur et sa date posée par le serveur", async () => {
    const { db, etat } = fausseBase({ idcc: "1596" });
    await verifierIdccClient(db, annuaire(["1596"]), CLIENT);
    expect(etat.ligne?.statut).toBe("concordant");

    const maintenant = new Date("2026-10-07T10:00:00Z");
    const r = await confirmerIdccClient(db, {
      clientId: CLIENT,
      auteurId: ADMIN,
      type: "attestation_entreprise",
      maintenant,
    });
    expect(r).toEqual({ ok: true, change: true });
    expect(etat.ligne).toMatchObject({
      statut: "confirme",
      idcc: "1596",
      preuveType: "attestation_entreprise",
      preuveAuteurId: ADMIN,
      preuveLe: maintenant,
    });
    // Le journal ne porte aucun contenu : des statuts, un type, un auteur.
    expect(etat.journal.at(-1)).toEqual({
      clientId: CLIENT,
      de: "concordant",
      vers: "confirme",
      preuveType: "attestation_entreprise",
      auteurId: ADMIN,
    });
  });

  it("une vérification ultérieure ne défait PAS la confirmation tant que l'IDCC saisi est le même", async () => {
    const { db, etat } = fausseBase({ idcc: "1596" });
    await confirmerIdccClient(db, { clientId: CLIENT, auteurId: ADMIN, type: "declaration_opco" });
    await verifierIdccClient(db, annuaire(["1596"]), CLIENT);
    expect(etat.ligne?.statut).toBe("confirme");
  });

  it("refuse sans IDCC saisi : on ne confirme que ce qui est saisi", async () => {
    const { db, etat } = fausseBase({ idcc: null });
    const r = await confirmerIdccClient(db, {
      clientId: CLIENT,
      auteurId: ADMIN,
      type: "attestation_entreprise",
    });
    expect(r).toMatchObject({ ok: false, motif: "refusee" });
    expect(etat.ligne).toBeNull();
  });

  it("refuse un accord de prise en charge d'un OPCO qui n'est pas celui de la table", async () => {
    const { db, etat } = fausseBase({ idcc: "1596" });
    const r = await confirmerIdccClient(db, {
      clientId: CLIENT,
      auteurId: ADMIN,
      type: "accord_prise_en_charge_opco",
      opco: "akto",
    });
    expect(r).toMatchObject({ ok: false, motif: "refusee" });
    expect(etat.ligne).toBeNull();
  });

  it("admet l'accord de l'OPCO de la table", async () => {
    const { db, etat } = fausseBase({ idcc: "1596" });
    const r = await confirmerIdccClient(db, {
      clientId: CLIENT,
      auteurId: ADMIN,
      type: "accord_prise_en_charge_opco",
      opco: "constructys",
    });
    expect(r).toEqual({ ok: true, change: true });
    expect(etat.ligne).toMatchObject({ statut: "confirme", preuveOpco: "constructys" });
  });

  it("refuse un particulier", async () => {
    const r = await confirmerIdccClient(fausseBase({ type: "particulier" }).db, {
      clientId: CLIENT,
      auteurId: ADMIN,
      type: "attestation_entreprise",
    });
    expect(r).toEqual({ ok: false, motif: "particulier" });
  });
});
