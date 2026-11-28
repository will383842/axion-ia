// PR P (#2464 pt 27) : le script de rotation. Valeurs et clés FICTIVES ; aucune base (faux client Prisma en mémoire).
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { chiffrerOctetsPii, cleQuiDechiffre, decryptPii, encryptPii } from "@/lib/pii-crypto";
import type { ColonneChiffree } from "@/lib/pii-colonnes-chiffrees";

import { rotationPii, type ClientRotation } from "../rotation-cle-pii";

const ANCIENNE = randomBytes(32).toString("hex");
const NOUVELLE = randomBytes(32).toString("hex");
const AUTRE = randomBytes(32).toString("hex");

function sousCle(courante: string, lecture: string | undefined, f: () => void): void {
  process.env.PII_ENCRYPTION_KEY = courante;
  if (lecture) process.env.PII_ENCRYPTION_KEYS_LECTURE = lecture;
  else delete process.env.PII_ENCRYPTION_KEYS_LECTURE;
  f();
}

type Ligne = Record<string, unknown>;

/** Faux client : une « table » par modèle ; updateMany conditionnel comme Prisma ; trace des SET LOCAL. */
function fauxClient(tables: Record<string, Ligne[]>, hook?: () => void) {
  const traces = { setLocal: 0, ecritures: 0 };
  const delegat = (modele: string) => ({
    findMany: async (a: { where?: Ligne; orderBy: Ligne; take: number }) => {
      const cle = Object.keys(a.orderBy)[0] as string;
      const gt = (a.where?.[cle] as { gt?: string } | undefined)?.gt;
      return [...(tables[modele] ?? [])]
        .filter((l) => gt === undefined || String(l[cle]) > gt)
        .sort((x, y) => String(x[cle]).localeCompare(String(y[cle])))
        .slice(0, a.take);
    },
    findUnique: async (a: { where: Ligne }) => {
      const [k, v] = Object.entries(a.where)[0] as [string, unknown];
      return (tables[modele] ?? []).find((l) => l[k] === v) ?? null;
    },
    updateMany: async (a: { where: Ligne; data: Ligne }) => {
      hook?.();
      const trouve = (tables[modele] ?? []).filter((l) =>
        Object.entries(a.where).every(([k, v]) =>
          Buffer.isBuffer(v) ? Buffer.isBuffer(l[k]) && (l[k] as Buffer).equals(v) : l[k] === v,
        ),
      );
      // Comme Prisma : un champ `@updatedAt` (ici `majAt`) passe à « maintenant » sauf valeur explicite dans `data`.
      for (const l of trouve) {
        Object.assign(l, a.data);
        if ("majAt" in l && !("majAt" in a.data)) l.majAt = new Date();
      }
      traces.ecritures += trouve.length;
      return { count: trouve.length };
    },
  });
  const client: Record<string, unknown> = {
    $executeRawUnsafe: async (sql: string) => {
      if (sql.includes("axion.reecriture_pii = 'rotation'")) traces.setLocal += 1;
      return 0;
    },
  };
  for (const m of Object.keys(tables)) client[m] = delegat(m);
  client.$transaction = async (f: (tx: unknown) => Promise<unknown>) => f(client);
  return { client: client as unknown as ClientRotation, traces };
}

const COL_V1: ColonneChiffree = {
  modele: "apporteurReseau",
  cle: "id",
  champ: "prenom",
  format: "v1",
};
const COL_V2: ColonneChiffree = {
  modele: "apporteurIbanHistorique",
  cle: "id",
  champ: "iban",
  format: "v2",
  aad: (l) => `iban-historique:${l.id}`,
  declencheur: true,
};
const COL_OCT: ColonneChiffree = {
  modele: "pieceApporteurContenu",
  cle: "pieceId",
  champ: "octets",
  format: "octets",
};

let ancien: { v1: string; v2: string; oct: Buffer };
beforeEach(() => {
  sousCle(ANCIENNE, undefined, () => {
    ancien = {
      v1: encryptPii("Prenom Fictif"),
      v2: encryptPii("FR0000000000000000000000000", { aad: "iban-historique:h1", cleExigee: true }),
      oct: chiffrerOctetsPii(Buffer.from("octets fictifs")),
    };
  });
  sousCle(NOUVELLE, ANCIENNE, () => undefined);
});
afterEach(() => {
  delete process.env.PII_ENCRYPTION_KEY;
  delete process.env.PII_ENCRYPTION_KEYS_LECTURE;
});

describe("rotationPii", () => {
  it("essai (défaut) : compte, n'écrit rien", async () => {
    const { client, traces } = fauxClient({ apporteurReseau: [{ id: "a1", prenom: ancien.v1 }] });
    const r = await rotationPii({ client, colonnes: [COL_V1] });
    expect(r.mode).toBe("essai");
    expect(r.colonnes[0]).toMatchObject({ lecture: 1, reecrites: 0 });
    expect(traces.ecritures).toBe(0);
  });

  it("appliquer : rechiffre sous la courante, même clair ; idempotent", async () => {
    const tables = { apporteurReseau: [{ id: "a1", prenom: ancien.v1 }] };
    const { client, traces } = fauxClient(tables);
    const r1 = await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(r1.colonnes[0]).toMatchObject({ lecture: 1, reecrites: 1 });
    const apres = tables.apporteurReseau[0]!.prenom as string;
    expect(cleQuiDechiffre(apres)).toBe("courante");
    expect(decryptPii(apres)).toBe("Prenom Fictif");
    const ecr = traces.ecritures;
    const r2 = await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(r2.colonnes[0]).toMatchObject({ courante: 1, lecture: 0, reecrites: 0 });
    expect(traces.ecritures).toBe(ecr);
  });

  it("une ligne déjà sous la courante n'est pas réécrite", async () => {
    const deja = encryptPii("Deja");
    const { client, traces } = fauxClient({ apporteurReseau: [{ id: "a1", prenom: deja }] });
    await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(traces.ecritures).toBe(0);
  });

  it("AAD par colonne : v2 relié à la ligne, SET LOCAL 'rotation' pour la table à déclencheur", async () => {
    const tables = { apporteurIbanHistorique: [{ id: "h1", iban: ancien.v2 }] };
    const { client, traces } = fauxClient(tables);
    const r = await rotationPii({ client, colonnes: [COL_V2], mode: "appliquer" });
    expect(r.colonnes[0]).toMatchObject({ reecrites: 1 });
    expect(traces.setLocal).toBe(1);
    const apres = tables.apporteurIbanHistorique[0]!.iban as string;
    expect(cleQuiDechiffre(apres, "iban-historique:h1")).toBe("courante");
    expect(cleQuiDechiffre(apres, "iban-historique:autre")).toBeNull();
  });

  it("pas de SET LOCAL pour une table sans déclencheur", async () => {
    const { client, traces } = fauxClient({ apporteurReseau: [{ id: "a1", prenom: ancien.v1 }] });
    await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(traces.setLocal).toBe(0);
  });

  it("octets AXB1 : rechiffrés, même contenu", async () => {
    const tables = { pieceApporteurContenu: [{ pieceId: "p1", octets: ancien.oct }] };
    const { client } = fauxClient(tables);
    const r = await rotationPii({ client, colonnes: [COL_OCT], mode: "appliquer" });
    expect(r.colonnes[0]).toMatchObject({ lecture: 1, reecrites: 1 });
    const nouveau = tables.pieceApporteurContenu[0]!.octets as Buffer;
    expect(nouveau.equals(ancien.oct)).toBe(false);
    sousCle(NOUVELLE, undefined, () => undefined);
    // lisible avec la seule nouvelle clé
    expect(decryptOctets(nouveau)).toBe("octets fictifs");
  });

  it("valeur indéchiffrable : listée par identifiant, jamais écrasée, jamais en clair dans le rapport", async () => {
    let etrangere = "";
    sousCle(AUTRE, undefined, () => {
      etrangere = encryptPii("Secret Etranger");
    });
    sousCle(NOUVELLE, ANCIENNE, () => undefined);
    const tables = { apporteurReseau: [{ id: "a9", prenom: etrangere }] };
    const { client, traces } = fauxClient(tables);
    const r = await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(r.colonnes[0]).toMatchObject({ illisibles: 1, reecrites: 0 });
    expect(r.colonnes[0]!.idsIllisibles).toEqual(["a9"]);
    expect(tables.apporteurReseau[0]!.prenom).toBe(etrangere);
    expect(traces.ecritures).toBe(0);
    const sortie = JSON.stringify(r);
    expect(sortie).not.toContain("Secret Etranger");
    expect(sortie).not.toContain(etrangere);
    expect(sortie).not.toContain(ANCIENNE);
    expect(sortie).not.toContain(NOUVELLE);
  });

  it("valeur purgée, vide ou claire : jamais touchée", async () => {
    const tables = {
      apporteurIbanHistorique: [{ id: "h1", iban: "purge" }],
      apporteurReseau: [
        { id: "a1", prenom: "" },
        { id: "a2", prenom: null },
        { id: "a3", prenom: "en clair" },
      ],
    };
    const { client, traces } = fauxClient(tables);
    const r = await rotationPii({ client, colonnes: [COL_V2, COL_V1], mode: "appliquer" });
    expect(traces.ecritures).toBe(0);
    expect(r.colonnes[0]).toMatchObject({ purgees: 1 });
    expect(r.colonnes[1]).toMatchObject({ vides: 2, claires: 1 });
  });

  it("écriture concurrente : la mise à jour conditionnelle échoue, la ligne est relue et reprise", async () => {
    const tables = { apporteurReseau: [{ id: "a1", prenom: ancien.v1 }] };
    let une = true;
    const { client } = fauxClient(tables, () => {
      if (une) {
        une = false;
        // un autre processus réécrit la ligne (toujours sous l'ancienne clé) juste avant notre écriture
        sousCle(ANCIENNE, undefined, () => {
          tables.apporteurReseau[0]!.prenom = encryptPii("Prenom Modifie");
        });
        sousCle(NOUVELLE, ANCIENNE, () => undefined);
      }
    });
    const r = await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(r.colonnes[0]).toMatchObject({ reecrites: 1, reprises: 1 });
    expect(decryptPii(tables.apporteurReseau[0]!.prenom as string)).toBe("Prenom Modifie");
    expect(cleQuiDechiffre(tables.apporteurReseau[0]!.prenom as string)).toBe("courante");
  });

  it("lots de 200 avec curseur : toutes les lignes sont vues", async () => {
    const lignes = Array.from({ length: 450 }, (_, i) => ({
      id: `a${String(i).padStart(4, "0")}`,
      prenom: ancien.v1,
    }));
    const { client } = fauxClient({ apporteurReseau: lignes });
    const r = await rotationPii({ client, colonnes: [COL_V1], mode: "appliquer" });
    expect(r.colonnes[0]).toMatchObject({ lues: 450, reecrites: 450 });
  });

  it("--table limite au modèle demandé", async () => {
    const { client, traces } = fauxClient({
      apporteurReseau: [{ id: "a1", prenom: ancien.v1 }],
      pieceApporteurContenu: [{ pieceId: "p1", octets: ancien.oct }],
    });
    const r = await rotationPii({
      client,
      colonnes: [COL_V1, COL_OCT],
      mode: "appliquer",
      table: "pieceApporteurContenu",
    });
    expect(r.colonnes).toHaveLength(1);
    expect(traces.ecritures).toBe(1);
  });

  it("majAt (@updatedAt) identique avant/après pour apporteurReseau et presentationEntreprise", async () => {
    const MAJ = new Date("2026-01-15T10:00:00.000Z");
    const colA: ColonneChiffree = { ...COL_V1, majAt: "majAt" };
    const colP: ColonneChiffree = {
      modele: "presentationEntreprise",
      cle: "id",
      champ: "personneNom",
      format: "v1",
      majAt: "majAt",
    };
    const tables = {
      apporteurReseau: [{ id: "a1", prenom: ancien.v1, majAt: MAJ }],
      presentationEntreprise: [{ id: "p1", personneNom: ancien.v1, majAt: MAJ }],
    };
    const { client } = fauxClient(tables);
    const r = await rotationPii({ client, colonnes: [colA, colP], mode: "appliquer" });
    expect(r.colonnes.map((c) => c.reecrites)).toEqual([1, 1]);
    expect(tables.apporteurReseau[0]!.majAt).toEqual(MAJ);
    expect(tables.presentationEntreprise[0]!.majAt).toEqual(MAJ);
    expect(cleQuiDechiffre(tables.apporteurReseau[0]!.prenom as string)).toBe("courante");
  });

  it("le registre déclare majAt pour apporteurReseau et presentationEntreprise", async () => {
    const { COLONNES_CHIFFREES } = await import("@/lib/pii-colonnes-chiffrees");
    for (const c of COLONNES_CHIFFREES.filter((x) =>
      ["apporteurReseau", "presentationEntreprise"].includes(x.modele),
    ))
      expect(c.majAt).toBe("majAt");
  });
});

import { dechiffrerOctetsPii } from "@/lib/pii-crypto";
function decryptOctets(b: Buffer): string {
  return dechiffrerOctetsPii(b).toString("utf8");
}
