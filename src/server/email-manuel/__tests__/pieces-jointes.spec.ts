// @vitest-environment node

/**
 * Pièces jointes des e-mails écrits à la main (lot I4, fiche F7). Compartiment et base SIMULÉS en
 * mémoire ; le contrôle des octets est le VRAI (`verifierObjetTemporaire`, réutilisé sans changement).
 *
 * Ce qui est verrouillé : acte vérifié dans chaque fonction ; format exclu et limites refusés ;
 * clé tirée par le serveur ; macros, exécutable renommé et antivirus muet refusés ; jeton rejoué sans
 * effet ; objets refusés déplacés et jamais supprimés ; aucun appel de suppression dans le module.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fabriquerZip } from "@/lib/contact/__tests__/zip-de-test";

interface Objet {
  octets: Uint8Array;
  etag: string;
  type: string;
}
interface Ligne {
  id: string;
  emailManuelId: string;
  nomFichier: string;
  format: string;
  tailleOctets: number;
  cleStockage: string;
  statut: string;
  motifRefus: string | null;
  sha256: string | null;
  antivirus: string | null;
  jetonHash: string | null;
  creeLe: Date;
}
interface Email {
  id: string;
  statut: string;
  ecritParId: string | null;
  objet: string;
  [k: string]: unknown;
}

const h = vi.hoisted(() => {
  class ObjetR2Modifie extends Error {}
  return {
    seau: new Map<string, Objet>(),
    lignes: [] as Ligne[],
    emails: [] as Email[],
    suppressions: [] as string[],
    urls: [] as Array<{ cle: string; taille: number; type: string; ttl: number }>,
    debit: { allowed: true, cles: [] as string[], configs: [] as unknown[] },
    env: { EMAIL_MANUEL_ACTIF: "true" as string },
    /** Les requêtes SQL brutes, dans l'ordre. */
    sql: [] as string[],
    /** Ordre des événements : « sql » (verrou) et « findMany » (lecture des pièces). */
    ordre: [] as string[],
    updateMany: { appels: 0 },
    copie: { echecs: 0, pendant: null as null | (() => void) },
    ObjetR2Modifie,
  };
});

vi.mock("@/env", () => ({ env: h.env }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (cle: string, config: unknown) => {
    h.debit.cles.push(cle);
    h.debit.configs.push(config);
    return { allowed: h.debit.allowed, count: 0, remaining: 0, resetAt: 0, panne: false };
  },
}));

function correspond(l: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "emailManuel") {
      const w = v as { ecritParId: string };
      const e = h.emails.find((x) => x.id === (l as Ligne).emailManuelId);
      return e?.ecritParId === w.ecritParId;
    }
    const val = (l as Record<string, unknown>)[k];
    if (v instanceof Date) return val instanceof Date && val.getTime() === v.getTime();
    if (v && typeof v === "object") {
      const c = v as { in?: unknown[]; lt?: Date; gte?: Date };
      if (c.in) return c.in.includes(val);
      if (c.lt) return (val as Date).getTime() < c.lt.getTime();
      if (c.gte) return (val as Date).getTime() >= c.gte.getTime();
    }
    return val === v;
  });
}

const verrous = new Map<string, Promise<void>>();
interface Contexte {
  liberer: Array<() => void>;
}
async function queryRaw(ctx: Contexte, s: TemplateStringsArray, v: unknown[]) {
  const sql = s.join("?");
  h.sql.push(sql);
  if (/FOR UPDATE/.test(sql)) {
    const id = String(v[0]);
    while (verrous.has(id)) await verrous.get(id);
    let lib!: () => void;
    verrous.set(id, new Promise<void>((r) => (lib = r)));
    ctx.liberer.push(() => {
      verrous.delete(id);
      lib();
    });
  }
  h.ordre.push("sql");
  const e = h.emails.find((x) => x.id === v[0]);
  return e
    ? [{ id: e.id, statut: e.statut, ecrit_par_id: e.ecritParId ?? null, objet: e.objet }]
    : [];
}

const prismaMock = {
  emailManuel: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      h.emails.find((e) => correspond(e, where)) ?? null,
  },
  emailManuelPieceJointe: {
    createMany: async ({ data }: { data: Ligne[] }) => {
      h.lignes.push(
        ...data.map((d) => ({ ...d, motifRefus: null, sha256: null, antivirus: null })),
      );
      return { count: data.length };
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      h.ordre.push("findMany");
      return h.lignes.filter((l) => correspond(l, where)).map((l) => ({ ...l }));
    },
    aggregate: async ({ where }: { where: Record<string, unknown> }) => ({
      _sum: {
        tailleOctets: h.lignes
          .filter((l) => correspond(l, where))
          .reduce((t, l) => t + l.tailleOctets, 0),
      },
    }),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
      h.updateMany.appels += 1;
      const vis = h.lignes.filter((l) => correspond(l, where));
      vis.forEach((l) => Object.assign(l, data));
      return { count: vis.length };
    },
  },
};

// Accès paresseux : la fabrique est hissée, `prismaMock` n'existe qu'à l'exécution des appels.
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaComplet();
  },
}));

const prismaComplet = () => ({
  ...prismaMock,
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const ctx: Contexte = { liberer: [] };
    const tx = {
      ...prismaMock,
      $queryRaw: (s: TemplateStringsArray, ...v: unknown[]) => queryRaw(ctx, s, v),
    };
    try {
      return await fn(tx);
    } finally {
      ctx.liberer.forEach((f) => f());
    }
  },
});

function plage(o: Uint8Array, spec: string): Uint8Array {
  const m = /^bytes=(\d*)-(\d*)$/.exec(spec)!;
  if (m[1] === "") return o.subarray(Math.max(0, o.length - Number(m[2])));
  return o.subarray(Number(m[1]), m[2] === "" ? o.length : Number(m[2]) + 1);
}
function verifierEtag(cle: string, etag: string): Objet {
  const o = h.seau.get(cle);
  if (!o || o.etag !== etag) throw new h.ObjetR2Modifie(cle);
  return o;
}

vi.mock("@/lib/r2-storage", () => ({
  ObjetR2Modifie: h.ObjetR2Modifie,
  isR2Configured: () => true,
  enteteObjetR2: async (cle: string) => {
    const o = h.seau.get(cle);
    return o ? { taille: o.octets.length, etag: o.etag } : null;
  },
  lirePlageObjetR2: async (cle: string, spec: string, etag: string) =>
    plage(verifierEtag(cle, etag).octets, spec),
  fluxObjetGeneralR2: async (cle: string, etag: string) => {
    const o = verifierEtag(cle, etag);
    return (async function* () {
      for (let i = 0; i < o.octets.length; i += 65536) yield o.octets.subarray(i, i + 65536);
    })();
  },
  copierObjetR2: async (source: string, dest: string, etag: string, type: string) => {
    const o = verifierEtag(source, etag);
    if (h.copie.echecs > 0) {
      h.copie.echecs -= 1;
      throw new Error("panne de copie");
    }
    h.copie.pendant?.();
    h.seau.set(dest, { ...o, type });
  },
  deleteFromR2: async (cle: string) => {
    h.suppressions.push(cle);
    h.seau.delete(cle);
  },
  signerEnvoiDirectR2: async (cle: string, taille: number, type: string, ttl: number) => {
    h.urls.push({ cle, taille, type, ttl });
    return `https://r2.example/${cle}?sig=x`;
  },
}));
vi.mock("@/server/careers/clamav", () => ({ analyserFlux: vi.fn() }));

import {
  PREFIXE_REFUSEES_EMAIL,
  PREFIXE_TEMPORAIRE_EMAIL,
  TTL_URL_ENVOI_EMAIL_S,
  finaliserPiecesJointesEmail,
  listerPiecesJointesEmail,
  ouvrirEnvoisPiecesJointesEmail,
  empreinteJetonEmail,
} from "../pieces-jointes";
import {
  MESSAGES_PIECES_EMAIL,
  PLAFOND_OCTETS_24H_PAR_ADMIN,
  prefixesStockageEmail,
} from "@/lib/email-manuel/pieces-jointes";
import { OBJET_EMAIL_MANUEL_EFFACE } from "@/lib/rgpd-erase";
import type { Antivirus } from "@/server/contact/pieces-jointes";

const DIRECTION = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };
const AUTRE_ADMIN = { id: "55555555-5555-4555-8555-555555555555", role: "admin" };
const FONDATEUR = { id: "22222222-2222-4222-8222-222222222222", role: "super_admin" };
const SECRETAIRE = { id: "33333333-3333-4333-8333-333333333333", role: "secretaire" };
const MO = 1024 * 1024;

/** Pousse un e-mail `brouillon` écrit par `acteur`. */
function brouillonDe(acteur: { id: string } | null, extra: Partial<Email> = {}): Email {
  const e: Email = {
    id: randomUUID(),
    statut: "brouillon",
    ecritParId: acteur ? acteur.id : null,
    objet: "",
    ...extra,
  };
  h.emails.push(e);
  return e;
}

const antivirusSain: Antivirus = async (flux) => {
  for await (const _ of flux) {
    // lu
  }
  return { issue: "sain" };
};
const antivirusMuet: Antivirus = async () => ({ issue: "indisponible", raison: "test" });
const antivirusInfecte: Antivirus = async (flux) => {
  for await (const _ of flux) {
    // lu
  }
  return { issue: "infecte", signature: "Test.Signature" };
};

const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n" + "x".repeat(50_000)));
const EXE = new Uint8Array(Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from("DOS mode")]));
const CT = ["[Content_Types].xml", "<Types/>"] as const;

let n = 0;
/** Simule le `PUT` du navigateur : l'objet arrive sous la clé que le serveur a tirée. */
function deposer(cle: string, octets: Uint8Array): void {
  n += 1;
  h.seau.set(cle, { octets, etag: `"e${n}"`, type: "application/octet-stream" });
}

async function ouvrir(
  pieces: Array<{ nom: string; taille: number }>,
  acteur: { id: string; role: string } = DIRECTION,
  quoi?: { emailManuelId: string },
  maintenant?: Date,
) {
  const emailManuelId = quoi?.emailManuelId ?? brouillonDe(acteur).id;
  return ouvrirEnvoisPiecesJointesEmail({ acteur, emailManuelId, pieces }, maintenant);
}

/** Une ligne semée à la main, avec un jeton connu. */
function semer(e: Email, jeton: string, extra: Partial<Ligne> = {}): Ligne {
  const l: Ligne = {
    id: randomUUID(),
    emailManuelId: e.id,
    nomFichier: "a.pdf",
    format: "pdf",
    tailleOctets: 1000,
    cleStockage: `emails-manuels/temporaire/${e.id}/${randomUUID()}`,
    statut: "attendue",
    motifRefus: null,
    sha256: null,
    antivirus: null,
    jetonHash: empreinteJetonEmail(jeton),
    creeLe: new Date(),
    ...extra,
  };
  h.lignes.push(l);
  return l;
}
const nouveauJeton = () => randomBytes(32).toString("base64url");
const MIN = 60_000;

beforeEach(() => {
  h.seau.clear();
  h.lignes.length = 0;
  h.emails.length = 0;
  h.suppressions.length = 0;
  h.urls.length = 0;
  h.debit.allowed = true;
  h.debit.cles.length = 0;
  h.debit.configs.length = 0;
  h.env.EMAIL_MANUEL_ACTIF = "true";
  h.sql.length = 0;
  h.ordre.length = 0;
  h.updateMany.appels = 0;
  h.copie.echecs = 0;
  h.copie.pendant = null;
  verrous.clear();
  n = 0;
});

describe("ouvrir les envois", () => {
  it("une ligne attendue et une URL signée par fichier, sur un brouillon existant", async () => {
    const r = await ouvrir([
      { nom: "Devis.pdf", taille: 120_000 },
      { nom: "photo.JPG", taille: 2 * MO },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(h.emails).toHaveLength(1);
    expect(r.emailManuelId).toBe(h.emails[0]!.id);
    expect(r.envois).toHaveLength(2);
    expect(h.lignes.map((l) => l.statut)).toEqual(["attendue", "attendue"]);
    expect(h.lignes.map((l) => l.format)).toEqual(["pdf", "jpg"]);
    expect(h.lignes[0]!.jetonHash).toBe(h.lignes[1]!.jetonHash);
    expect(h.lignes[0]!.jetonHash).not.toBe(r.jeton);
  });

  it("URL PUT à longueur exacte, valable 30 minutes", async () => {
    await ouvrir([{ nom: "a.pdf", taille: 777 }]);
    expect(TTL_URL_ENVOI_EMAIL_S).toBe(30 * 60);
    expect(h.urls).toEqual([
      expect.objectContaining({ taille: 777, ttl: 1800, type: "application/octet-stream" }),
    ]);
  });

  it("la clé R2 est tirée par le serveur : le nom du navigateur n'y entre jamais", async () => {
    await ouvrir([{ nom: "../../secret/evil.pdf", taille: 100 }]);
    const cle = h.lignes[0]!.cleStockage;
    expect(cle).toMatch(
      new RegExp(`^${PREFIXE_TEMPORAIRE_EMAIL}${h.emails[0]!.id}/[0-9a-f-]{36}$`),
    );
    expect(cle).not.toMatch(/secret|evil|\.\./);
    expect(h.lignes[0]!.nomFichier).toBe("evil.pdf");
  });

  it("un champ cleStockage glissé dans l'annonce est ignoré", async () => {
    const piege = { nom: "a.pdf", taille: 100, cleStockage: "emails-manuels/choisie-par-moi" };
    await ouvrir([piege as { nom: string; taille: number }]);
    expect(h.lignes[0]!.cleStockage).not.toContain("choisie-par-moi");
  });

  it.each([
    "plans.zip",
    "ancien.doc",
    "tableau.xls",
    "deck.ppt",
    "rapport.odt",
    "x.pdf.exe",
    "virus.exe",
    "macro.docm",
    "sans-extension",
  ])("format exclu « %s » : refusé, aucune ligne, aucune URL", async (nom) => {
    const r = await ouvrir([{ nom, taille: 1000 }]);
    expect(r.ok).toBe(false);
    expect(h.lignes).toHaveLength(0);
    expect(h.urls).toHaveLength(0);
  });

  it.each(["a.pdf", "a.docx", "a.xlsx", "a.pptx", "a.txt", "a.csv", "a.png", "a.jpg", "a.jpeg"])(
    "format permis « %s »",
    async (nom) => {
      expect((await ouvrir([{ nom, taille: 1000 }])).ok).toBe(true);
    },
  );

  it("plus de 5 fichiers : refus", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ nom: `f${i}.pdf`, taille: 1000 }));
    const r = await ouvrir(six);
    expect(r).toMatchObject({ ok: false, refus: "annonce" });
    expect(h.lignes).toHaveLength(0);
  });

  it("5 fichiers passent ; un sixième ajouté dans un second appel est refusé", async () => {
    const cinq = Array.from({ length: 5 }, (_, i) => ({ nom: `f${i}.pdf`, taille: 1000 }));
    const a = await ouvrir(cinq);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = await ouvrir([{ nom: "de-trop.pdf", taille: 1000 }], DIRECTION, {
      emailManuelId: a.emailManuelId,
    });
    expect(b).toMatchObject({ ok: false, refus: "annonce" });
    expect(h.lignes).toHaveLength(5);
  });

  it("un fichier de plus de 10 Mo : refus", async () => {
    const r = await ouvrir([{ nom: "gros.pdf", taille: 10 * MO + 1 }]);
    expect(r).toMatchObject({ ok: false, refus: "annonce" });
    expect(h.lignes).toHaveLength(0);
  });

  it("exactement 10 Mo : accepté", async () => {
    expect((await ouvrir([{ nom: "pile.pdf", taille: 10 * MO }])).ok).toBe(true);
  });

  it("plus de 10 Mo au total (ajouts compris) : refus", async () => {
    const a = await ouvrir([{ nom: "a.pdf", taille: 6 * MO }]);
    if (!a.ok) throw new Error("attendu ok");
    const b = await ouvrir([{ nom: "b.pdf", taille: 5 * MO }], DIRECTION, {
      emailManuelId: a.emailManuelId,
    });
    expect(b).toMatchObject({ ok: false, refus: "annonce" });
  });

  it("taille nulle, négative ou fractionnaire : refus", async () => {
    for (const taille of [0, -5, 1.5, Number.NaN]) {
      expect((await ouvrir([{ nom: "a.pdf", taille }])).ok).toBe(false);
    }
    expect(h.lignes).toHaveLength(0);
  });

  it("e-mail déjà parti : plus de pièce ajoutée", async () => {
    const a = await ouvrir([{ nom: "a.pdf", taille: 10 }]);
    if (!a.ok) throw new Error("attendu ok");
    h.emails[0]!.statut = "en_file";
    const b = await ouvrir([{ nom: "b.pdf", taille: 10 }], DIRECTION, {
      emailManuelId: a.emailManuelId,
    });
    expect(b).toMatchObject({ ok: false, refus: "deja_parti" });
  });

  it("e-mail inconnu : refus", async () => {
    const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], DIRECTION, {
      emailManuelId: randomUUID(),
    });
    expect(r).toMatchObject({ ok: false, refus: "inconnu" });
  });

  it("limite de débit email-manuel:pj:<adminId>, 30 par heure, refus si le compteur est muet", async () => {
    await ouvrir([{ nom: "a.pdf", taille: 10 }], FONDATEUR);
    expect(h.debit.cles).toEqual([`email-manuel:pj:${FONDATEUR.id}`]);
    expect(h.debit.configs[0]).toEqual({ limit: 30, windowSec: 3600, surPanne: "refuser" });
  });

  it("débit dépassé : refus, aucune ligne, aucune URL", async () => {
    h.debit.allowed = false;
    const r = await ouvrir([{ nom: "a.pdf", taille: 10 }]);
    expect(r).toMatchObject({ ok: false, refus: "debit" });
    expect(h.lignes).toHaveLength(0);
    expect(h.urls).toHaveLength(0);
  });
});

describe("l'acte ecrire_email_manuel est vérifié dans chaque fonction exposée", () => {
  it("ouvrir : refus sans l'acte, rien d'écrit, compteur non touché", async () => {
    const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], SECRETAIRE);
    expect(r).toMatchObject({ ok: false, refus: "acte" });
    expect(h.lignes).toHaveLength(0);
    expect(h.debit.cles).toHaveLength(0);
  });

  it("finaliser : refus sans l'acte, l'objet n'est pas lu", async () => {
    const a = await ouvrir([{ nom: "a.pdf", taille: PDF.length }]);
    if (!a.ok) throw new Error("attendu ok");
    deposer(h.lignes[0]!.cleStockage, PDF);
    const r = await finaliserPiecesJointesEmail(
      { acteur: SECRETAIRE, emailManuelId: a.emailManuelId, jeton: a.jeton },
      { antivirus: antivirusSain },
    );
    expect(r).toMatchObject({ ok: false, refus: "acte" });
    expect(h.lignes[0]!.statut).toBe("attendue");
  });

  it("lister : refus sans l'acte", async () => {
    const r = await listerPiecesJointesEmail({
      acteur: SECRETAIRE,
      emailManuelId: randomUUID(),
    });
    expect(r).toMatchObject({ ok: false, refus: "acte" });
  });

  it("rôle absent ou vide : refus", async () => {
    for (const role of [null, undefined, ""]) {
      const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], {
        id: DIRECTION.id,
        role: role as string,
      });
      expect(r).toMatchObject({ ok: false, refus: "acte" });
    }
  });
});

describe("finaliser : contrôle, copie définitive, refus conservés", () => {
  async function envoyer(nom: string, octets: Uint8Array, annonce = octets.length) {
    const a = await ouvrir([{ nom, taille: annonce }]);
    if (!a.ok) throw new Error("ouverture refusée");
    const ligne = h.lignes[h.lignes.length - 1]!;
    const cleTemporaire = ligne.cleStockage;
    deposer(cleTemporaire, octets);
    return { a, ligne, cleTemporaire };
  }
  const fin = (a: { emailManuelId: string; jeton: string }, av: Antivirus = antivirusSain) =>
    finaliserPiecesJointesEmail(
      { acteur: DIRECTION, emailManuelId: a.emailManuelId, jeton: a.jeton },
      { antivirus: av },
    );

  it("un PDF sain est accepté et copié sous emails-manuels/<id>/<uuid>.pdf", async () => {
    const { a, ligne, cleTemporaire } = await envoyer("Devis.pdf", PDF);
    const r = await fin(a);
    expect(r.ok).toBe(true);
    expect(ligne.statut).toBe("acceptee");
    expect(ligne.antivirus).toBe("sain");
    expect(ligne.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ligne.cleStockage).toMatch(
      new RegExp(`^emails-manuels/${a.emailManuelId}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(h.seau.get(ligne.cleStockage)?.type).toBe("application/pdf");
    // L'objet temporaire n'est JAMAIS supprimé.
    expect(h.seau.has(cleTemporaire)).toBe(true);
    expect(h.suppressions).toEqual([]);
  });

  it("un exécutable renommé en .pdf est refusé (signature des octets) et déplacé, pas supprimé", async () => {
    const { a, ligne, cleTemporaire } = await envoyer("facture.pdf", EXE);
    await fin(a);
    expect(ligne).toMatchObject({ statut: "refusee", motifRefus: "contenu" });
    expect(ligne.cleStockage.startsWith(PREFIXE_REFUSEES_EMAIL)).toBe(true);
    expect(h.seau.has(ligne.cleStockage)).toBe(true);
    expect(h.seau.has(cleTemporaire)).toBe(true);
    expect(h.suppressions).toEqual([]);
  });

  it("un .docx à macros est refusé", async () => {
    const docx = fabriquerZip([CT, ["word/document.xml", "<w/>"], ["word/vbaProject.bin", "VBA"]]);
    const { a, ligne } = await envoyer("cdc.docx", docx);
    const r = await fin(a);
    expect(ligne).toMatchObject({ statut: "refusee", motifRefus: "macros" });
    expect(r.ok && r.pieces[0]!.message).toMatch(/macros/);
    expect(ligne.cleStockage.startsWith(PREFIXE_REFUSEES_EMAIL)).toBe(true);
  });

  it("un fichier infecté est refusé et conservé à l'écart", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF);
    await fin(a, antivirusInfecte);
    expect(ligne).toMatchObject({ statut: "refusee", motifRefus: "infecte" });
    expect(ligne.cleStockage.startsWith(PREFIXE_REFUSEES_EMAIL)).toBe(true);
    expect(h.suppressions).toEqual([]);
  });

  it("antivirus muet : refus « antivirus indisponible, réessayez », rien n'est joint", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF);
    const r = await fin(a, antivirusMuet);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pieces[0]).toMatchObject({ statut: "antivirus_indisponible" });
    expect(r.pieces[0]!.message).toMatch(/antivirus indisponible, réessayez/);
    expect(ligne.statut).not.toBe("acceptee");
    expect(ligne.cleStockage.startsWith("emails-manuels/temporaire/")).toBe(true);
    expect([...h.seau.keys()].some((k) => /^emails-manuels\/[0-9a-f-]{36}\//.test(k))).toBe(false);
  });

  it("après un antivirus muet, on peut réessayer avec le même jeton", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF);
    await fin(a, antivirusMuet);
    await fin(a, antivirusSain);
    expect(ligne.statut).toBe("acceptee");
  });

  it("taille réelle différente de l'annonce : refusée", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF, PDF.length - 10);
    await fin(a);
    expect(ligne).toMatchObject({ statut: "refusee", motifRefus: "taille" });
  });

  it("objet jamais arrivé : non reçue", async () => {
    const a = await ouvrir([{ nom: "a.pdf", taille: 100 }]);
    if (!a.ok) throw new Error("attendu ok");
    const r = await fin(a);
    expect(r.ok && r.pieces[0]!.statut).toBe("non_recue");
    expect(h.lignes[0]!.statut).toBe("non_recue");
  });

  it("jeton rejoué : sans effet (aucune relecture, aucun second contrôle)", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF);
    await fin(a);
    const cleDefinitive = ligne.cleStockage;
    const objets = h.seau.size;
    const copie = { ...ligne };
    const seconde = await fin(a, antivirusInfecte);
    expect(seconde.ok && seconde.controlees).toBe(false);
    expect(ligne).toEqual(copie);
    expect(ligne.cleStockage).toBe(cleDefinitive);
    expect(h.seau.size).toBe(objets);
  });

  it("mauvais jeton : sans effet", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF);
    const r = await fin({ ...a, jeton: "x".repeat(43) });
    expect(r.ok && r.controlees).toBe(false);
    expect(ligne.statut).toBe("attendue");
  });

  it("objet remplacé entre deux lectures : refusé", async () => {
    const { a, ligne } = await envoyer("a.pdf", PDF);
    const faux: Antivirus = async (flux) => {
      for await (const _ of flux) {
        // lu
      }
      h.seau.get(ligne.cleStockage)!.etag = '"change"';
      return { issue: "sain" };
    };
    await fin(a, faux);
    expect(ligne.statut).not.toBe("acceptee");
  });

  it("un e-mail sans pièce acceptée ne propose rien à joindre ; la liste distingue les statuts", async () => {
    const { a } = await envoyer("a.pdf", PDF);
    await fin(a);
    const r = await listerPiecesJointesEmail({ acteur: DIRECTION, emailManuelId: a.emailManuelId });
    expect(r.ok && r.pieces).toEqual([
      expect.objectContaining({ nomFichier: "a.pdf", statut: "acceptee", joignable: true }),
    ]);
  });

  it("antivirus muet : la pièce n'est pas joignable", async () => {
    const { a } = await envoyer("a.pdf", PDF);
    await fin(a, antivirusMuet);
    const r = await listerPiecesJointesEmail({ acteur: DIRECTION, emailManuelId: a.emailManuelId });
    expect(r.ok && r.pieces.every((p) => !p.joignable)).toBe(true);
  });

  it("la liste ne rend ni clé de stockage ni empreinte de jeton", async () => {
    const { a } = await envoyer("a.pdf", PDF);
    await fin(a);
    const r = await listerPiecesJointesEmail({ acteur: DIRECTION, emailManuelId: a.emailManuelId });
    const texte = JSON.stringify(r);
    expect(texte).not.toMatch(/emails-manuels\//);
    expect(texte).not.toMatch(/jetonHash/);
  });
});

const fonction = {
  ouvrir: (acteur: { id: string; role: string }, id: string) =>
    ouvrirEnvoisPiecesJointesEmail({
      acteur,
      emailManuelId: id,
      pieces: [{ nom: "a.pdf", taille: 1000 }],
    }),
  finaliser: (acteur: { id: string; role: string }, id: string, jeton: string, av: Antivirus) =>
    finaliserPiecesJointesEmail({ acteur, emailManuelId: id, jeton }, { antivirus: av }),
  lister: (acteur: { id: string; role: string }, id: string) =>
    listerPiecesJointesEmail({ acteur, emailManuelId: id }),
};

describe("cloisonnement par auteur", () => {
  it("1. ouvrir : le brouillon de A, appelé par B → inconnu, rien d'écrit", async () => {
    const e = brouillonDe(DIRECTION);
    const r = await fonction.ouvrir(AUTRE_ADMIN, e.id);
    expect(r).toMatchObject({ ok: false, refus: "inconnu" });
    expect(h.lignes).toHaveLength(0);
    expect(h.urls).toHaveLength(0);
  });

  it("2. finaliser : B présente l'id et le vrai jeton de A → inconnu, antivirus jamais appelé", async () => {
    const e = brouillonDe(DIRECTION);
    const a = await ouvrirEnvoisPiecesJointesEmail({
      acteur: DIRECTION,
      emailManuelId: e.id,
      pieces: [{ nom: "a.pdf", taille: PDF.length }],
    });
    if (!a.ok) throw new Error("attendu ok");
    deposer(h.lignes[0]!.cleStockage, PDF);
    const av = vi.fn(antivirusSain);
    const r = await fonction.finaliser(AUTRE_ADMIN, e.id, a.jeton, av);
    expect(r).toMatchObject({ ok: false, refus: "inconnu" });
    expect(h.lignes.map((l) => l.statut)).toEqual(["attendue"]);
    expect(av).not.toHaveBeenCalled();
  });

  it("3. lister : B → inconnu, aucun nom de fichier", async () => {
    const e = brouillonDe(DIRECTION);
    semer(e, nouveauJeton(), { nomFichier: "secret.pdf" });
    const r = await fonction.lister(AUTRE_ADMIN, e.id);
    expect(r).toMatchObject({ ok: false, refus: "inconnu" });
    expect(JSON.stringify(r)).not.toContain("secret.pdf");
  });

  it("4. pas d'exception pour le fondateur ; l'auteur passe", async () => {
    const e = brouillonDe(DIRECTION);
    const jeton = nouveauJeton();
    semer(e, jeton);
    expect(await fonction.ouvrir(FONDATEUR, e.id)).toMatchObject({ refus: "inconnu" });
    expect(await fonction.finaliser(FONDATEUR, e.id, jeton, antivirusSain)).toMatchObject({
      refus: "inconnu",
    });
    expect(await fonction.lister(FONDATEUR, e.id)).toMatchObject({ refus: "inconnu" });
    expect((await fonction.ouvrir(DIRECTION, e.id)).ok).toBe(true);
    expect((await fonction.lister(DIRECTION, e.id)).ok).toBe(true);
  });

  it("5. auteur supprimé (ecritParId NULL) → inconnu", async () => {
    const e = brouillonDe(null);
    expect(await fonction.ouvrir(DIRECTION, e.id)).toMatchObject({ refus: "inconnu" });
    expect(await fonction.lister(DIRECTION, e.id)).toMatchObject({ refus: "inconnu" });
  });
});

describe("concurrence : limites lues sous verrou", () => {
  it("6. deux ouvertures de 5 × 1 Mo : une seule passe", async () => {
    const e = brouillonDe(DIRECTION);
    const cinq = Array.from({ length: 5 }, (_, i) => ({ nom: `f${i}.pdf`, taille: MO }));
    const [a, b] = await Promise.all([
      ouvrir(cinq, DIRECTION, { emailManuelId: e.id }),
      ouvrir(cinq, DIRECTION, { emailManuelId: e.id }),
    ]);
    const ok = [a, b].filter((r) => r.ok);
    const ko = [a, b].filter((r) => !r.ok);
    expect(ok).toHaveLength(1);
    expect(ko[0]).toMatchObject({ refus: "annonce", message: MESSAGES_PIECES_EMAIL.nombre });
    expect(h.lignes).toHaveLength(5);
    // Témoin : le verrou est la PREMIÈRE requête, avant toute lecture des pièces.
    expect(h.sql[0]).toMatch(/FOR UPDATE/);
    expect(h.sql[0]).toMatch(/::uuid/);
    expect(h.ordre[0]).toBe("sql");
    expect(h.ordre.indexOf("sql")).toBeLessThan(h.ordre.indexOf("findMany"));
  });

  it("7. deux ouvertures 6 Mo + 3 Mo : une seule passe, somme ≤ 10 Mo", async () => {
    const e = brouillonDe(DIRECTION);
    const duo = [
      { nom: "a.pdf", taille: 6 * MO },
      { nom: "b.pdf", taille: 3 * MO },
    ];
    const rs = await Promise.all([
      ouvrir(duo, DIRECTION, { emailManuelId: e.id }),
      ouvrir(duo, DIRECTION, { emailManuelId: e.id }),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(h.lignes.reduce((t, l) => t + l.tailleOctets, 0)).toBeLessThanOrEqual(10 * MO);
  });

  it("8. plus de 10 Mo en un seul appel : message « total », aucune ligne", async () => {
    const r = await ouvrir([
      { nom: "a.pdf", taille: 6 * MO },
      { nom: "b.pdf", taille: 5 * MO },
    ]);
    expect(r).toMatchObject({ ok: false, message: MESSAGES_PIECES_EMAIL.total });
    expect(h.lignes).toHaveLength(0);
  });
});

describe("finaliser : l'e-mail part pendant le contrôle", () => {
  async function pret() {
    const e = brouillonDe(DIRECTION);
    const a = await ouvrirEnvoisPiecesJointesEmail({
      acteur: DIRECTION,
      emailManuelId: e.id,
      pieces: [{ nom: "a.pdf", taille: PDF.length }],
    });
    if (!a.ok) throw new Error("attendu ok");
    deposer(h.lignes[0]!.cleStockage, PDF);
    return { e, a };
  }
  const parti =
    (e: Email): Antivirus =>
    async (flux) => {
      for await (const _ of flux) {
        // lu
      }
      e.statut = "en_file";
      return { issue: "sain" };
    };

  it("9. statut en_file pendant l'antivirus : refusée « envoi_parti », jamais acceptée", async () => {
    const { e, a } = await pret();
    const r = await fonction.finaliser(DIRECTION, e.id, a.jeton, parti(e));
    expect(h.lignes[0]).toMatchObject({ statut: "refusee", motifRefus: "envoi_parti" });
    expect(h.lignes.some((l) => l.statut === "acceptee")).toBe(false);
    expect(r.ok && r.pieces[0]!.message).toBe(MESSAGES_PIECES_EMAIL.envoiParti("a.pdf"));
    // Le brouillon est devenu « en_file » : lister est cloisonné par auteur, pas par statut.
    const l = await fonction.lister(DIRECTION, e.id);
    expect(l.ok && l.pieces[0]!.joignable).toBe(false);
  });

  it("9b. statut en_file pendant la COPIE (après la lecture simple) : Temps 3, jamais acceptée", async () => {
    const { e, a } = await pret();
    h.copie.pendant = () => {
      e.statut = "en_file";
    };
    await fonction.finaliser(DIRECTION, e.id, a.jeton, antivirusSain);
    expect(h.lignes[0]).toMatchObject({ statut: "refusee", motifRefus: "envoi_parti" });
    expect(h.lignes[0]!.cleStockage.startsWith("emails-manuels/temporaire/")).toBe(true);
  });

  it("10. e-mail déjà parti dès le départ : deja_parti, lignes inchangées, antivirus muet", async () => {
    const { e, a } = await pret();
    e.statut = "en_file";
    const av = vi.fn(antivirusSain);
    const r = await fonction.finaliser(DIRECTION, e.id, a.jeton, av);
    expect(r).toMatchObject({ ok: false, refus: "deja_parti" });
    expect(h.lignes[0]!.statut).toBe("attendue");
    expect(av).not.toHaveBeenCalled();
  });
});

describe("expiration sans suppression", () => {
  const MAINTENANT = new Date("2026-11-17T12:00:00Z");
  const il_y_a = (min: number) => new Date(MAINTENANT.getTime() - min * MIN);

  it("11. attendue de 61 min : non_recue, rien de supprimé", async () => {
    const e = brouillonDe(DIRECTION);
    for (let i = 0; i < 5; i += 1) semer(e, nouveauJeton(), { creeLe: il_y_a(61) });
    const r = await ouvrir(
      [{ nom: "n.pdf", taille: 1000 }],
      DIRECTION,
      { emailManuelId: e.id },
      MAINTENANT,
    );
    expect(r.ok).toBe(true);
    expect(h.lignes.slice(0, 5).map((l) => l.statut)).toEqual(Array(5).fill("non_recue"));
    expect(h.lignes).toHaveLength(6);
  });

  it("12. attendue de 59 min : compte encore → refus « nombre »", async () => {
    const e = brouillonDe(DIRECTION);
    for (let i = 0; i < 5; i += 1) semer(e, nouveauJeton(), { creeLe: il_y_a(59) });
    const r = await ouvrir(
      [{ nom: "n.pdf", taille: 1000 }],
      DIRECTION,
      { emailManuelId: e.id },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: false, message: MESSAGES_PIECES_EMAIL.nombre });
  });

  it("13. controle bloquée : 76 min → non_recue ; 74 min → reste controle et compte", async () => {
    const e = brouillonDe(DIRECTION);
    const vieille = semer(e, nouveauJeton(), { statut: "controle", creeLe: il_y_a(76) });
    expect(
      (await ouvrir([{ nom: "n.pdf", taille: 10 }], DIRECTION, { emailManuelId: e.id }, MAINTENANT))
        .ok,
    ).toBe(true);
    expect(vieille.statut).toBe("non_recue");

    const f = brouillonDe(DIRECTION);
    const recente = semer(f, nouveauJeton(), { statut: "controle", creeLe: il_y_a(74) });
    for (let i = 0; i < 4; i += 1) semer(f, nouveauJeton(), { creeLe: il_y_a(5) });
    const r = await ouvrir(
      [{ nom: "n.pdf", taille: 10 }],
      DIRECTION,
      { emailManuelId: f.id },
      MAINTENANT,
    );
    expect(r).toMatchObject({ ok: false, message: MESSAGES_PIECES_EMAIL.nombre });
    expect(recente.statut).toBe("controle");
  });

  it("14. jeton présenté sur une ligne de plus de 60 min : non_recue, antivirus muet", async () => {
    const e = brouillonDe(DIRECTION);
    const a = await ouvrirEnvoisPiecesJointesEmail(
      { acteur: DIRECTION, emailManuelId: e.id, pieces: [{ nom: "a.pdf", taille: PDF.length }] },
      il_y_a(61),
    );
    if (!a.ok) throw new Error("attendu ok");
    deposer(h.lignes[0]!.cleStockage, PDF);
    const av = vi.fn(antivirusSain);
    const r = await finaliserPiecesJointesEmail(
      { acteur: DIRECTION, emailManuelId: e.id, jeton: a.jeton },
      { antivirus: av },
      MAINTENANT,
    );
    expect(r.ok && r.pieces[0]!.statut).toBe("non_recue");
    expect(h.lignes[0]!.statut).toBe("non_recue");
    expect(av).not.toHaveBeenCalled();
  });

  it("15. ligne expirée pendant le contrôle : reste non_recue, jamais acceptée", async () => {
    const e = brouillonDe(DIRECTION);
    const a = await ouvrirEnvoisPiecesJointesEmail({
      acteur: DIRECTION,
      emailManuelId: e.id,
      pieces: [{ nom: "a.pdf", taille: PDF.length }],
    });
    if (!a.ok) throw new Error("attendu ok");
    deposer(h.lignes[0]!.cleStockage, PDF);
    const expire: Antivirus = async (flux) => {
      for await (const _ of flux) {
        // lu
      }
      h.lignes[0]!.statut = "non_recue";
      return { issue: "sain" };
    };
    await fonction.finaliser(DIRECTION, e.id, a.jeton, expire);
    expect(h.lignes[0]!.statut).toBe("non_recue");
  });
});

describe("rangement protégé", () => {
  it("16. exception de copie sur une des deux lignes : finaliser répond ok, la ligne revient attendue", async () => {
    const e = brouillonDe(DIRECTION);
    const a = await ouvrirEnvoisPiecesJointesEmail({
      acteur: DIRECTION,
      emailManuelId: e.id,
      pieces: [
        { nom: "a.pdf", taille: PDF.length },
        { nom: "b.pdf", taille: PDF.length },
      ],
    });
    if (!a.ok) throw new Error("attendu ok");
    for (const l of h.lignes) deposer(l.cleStockage, PDF);
    h.copie.echecs = 1;
    const r = await fonction.finaliser(DIRECTION, e.id, a.jeton, antivirusSain);
    expect(r.ok).toBe(true);
    expect(h.lignes.map((l) => l.statut).sort()).toEqual(["acceptee", "attendue"]);
  });

  it("17. format recontrôlé : un zip semé à la main finit refusé « format », jamais accepté", async () => {
    const e = brouillonDe(DIRECTION);
    const jeton = nouveauJeton();
    const zip = fabriquerZip([CT, ["a.txt", "x"]]);
    const l = semer(e, jeton, { nomFichier: "a.zip", format: "zip", tailleOctets: zip.length });
    deposer(l.cleStockage, zip);
    await fonction.finaliser(DIRECTION, e.id, jeton, antivirusSain);
    expect(l.statut).toBe("refusee");
    expect(l.motifRefus).toBe("format");
  });

  it("18. ODT refusé à l'ouverture, message sans « ODT »", async () => {
    const r = await ouvrir([{ nom: "rapport.odt", taille: 1000 }]);
    expect(r).toMatchObject({ ok: false, refus: "annonce" });
    expect(!r.ok && r.message).not.toMatch(/ODT/);
    expect(MESSAGES_PIECES_EMAIL.format("x")).not.toMatch(/ODT/);
  });

  it("19. clés traçables : chaque clé commence par un des 3 dossiers de son e-mail", async () => {
    const e = brouillonDe(DIRECTION);
    const a = await ouvrirEnvoisPiecesJointesEmail({
      acteur: DIRECTION,
      emailManuelId: e.id,
      pieces: [
        { nom: "bon.pdf", taille: PDF.length },
        { nom: "faux.pdf", taille: EXE.length },
      ],
    });
    if (!a.ok) throw new Error("attendu ok");
    expect(h.lignes[0]!.cleStockage).toMatch(
      new RegExp(`^emails-manuels/temporaire/${e.id}/[0-9a-f-]{36}$`),
    );
    deposer(h.lignes[0]!.cleStockage, PDF);
    deposer(h.lignes[1]!.cleStockage, EXE);
    await fonction.finaliser(DIRECTION, e.id, a.jeton, antivirusSain);
    const prefixes = prefixesStockageEmail(e.id);
    const cles = [...h.seau.keys(), ...h.lignes.map((l) => l.cleStockage)];
    expect(cles.length).toBeGreaterThan(3);
    for (const c of cles) expect(prefixes.some((p) => c.startsWith(p))).toBe(true);
  });
});

describe("neutralisation, plafond, validation, interrupteur, noms", () => {
  it("20. brouillon neutralisé : neutralise, aucune ligne, aucune URL", async () => {
    const e = brouillonDe(DIRECTION, { objet: OBJET_EMAIL_MANUEL_EFFACE });
    const r = await fonction.ouvrir(DIRECTION, e.id);
    expect(r).toMatchObject({ ok: false, refus: "neutralise" });
    expect(h.lignes).toHaveLength(0);
    expect(h.urls).toHaveLength(0);
  });

  it("21. plafond de 24 h : 195 Mo + 6 Mo refusé ; à 25 h accepté ; pièces de B non comptées", async () => {
    expect(PLAFOND_OCTETS_24H_PAR_ADMIN).toBe(200 * MO);
    const autre = brouillonDe(DIRECTION);
    const gros = semer(autre, nouveauJeton(), { tailleOctets: 195 * MO, statut: "acceptee" });
    const e = brouillonDe(DIRECTION);
    const six = [{ nom: "a.pdf", taille: 6 * MO }];
    expect(await ouvrir(six, DIRECTION, { emailManuelId: e.id })).toMatchObject({
      refus: "plafond",
    });
    gros.creeLe = new Date(Date.now() - 25 * 60 * MIN);
    expect((await ouvrir(six, DIRECTION, { emailManuelId: e.id })).ok).toBe(true);

    h.lignes.length = 0;
    const deB = brouillonDe(AUTRE_ADMIN);
    semer(deB, nouveauJeton(), { tailleOctets: 195 * MO, statut: "acceptee" });
    expect((await ouvrir(six, DIRECTION, { emailManuelId: e.id })).ok).toBe(true);
  });

  it("22. validation : aucune entrée invalide ne touche la base", async () => {
    const e = brouillonDe(DIRECTION);
    const ok = [{ nom: "a.pdf", taille: 10 }];
    const base = { acteur: DIRECTION, emailManuelId: e.id, pieces: ok };
    expect(
      await ouvrirEnvoisPiecesJointesEmail({ ...base, emailManuelId: "pas-un-uuid" }),
    ).toMatchObject({ refus: "inconnu" });
    expect(h.sql).toHaveLength(0);
    expect(
      await ouvrirEnvoisPiecesJointesEmail({ ...base, pieces: undefined as never }),
    ).toMatchObject({ refus: "annonce" });
    const six = Array.from({ length: 6 }, (_, i) => ({ nom: `f${i}.pdf`, taille: 1 }));
    expect(await ouvrirEnvoisPiecesJointesEmail({ ...base, pieces: six })).toMatchObject({
      refus: "annonce",
      message: MESSAGES_PIECES_EMAIL.nombre,
    });
    expect(
      await ouvrirEnvoisPiecesJointesEmail({ ...base, pieces: [{ nom: 42 as never, taille: 1 }] }),
    ).toMatchObject({ refus: "annonce" });
    expect(h.sql).toHaveLength(0);
    expect(h.debit.cles).toHaveLength(0);
    const r = await finaliserPiecesJointesEmail(
      { acteur: DIRECTION, emailManuelId: e.id, jeton: "court" },
      { antivirus: antivirusSain },
    );
    expect(r).toMatchObject({ refus: "inconnu" });
    expect(h.updateMany.appels).toBe(0);
  });

  it("23. interrupteur éteint : ouvrir et finaliser refusent sans écrire ni débiter ; lister reste ok", async () => {
    const e = brouillonDe(DIRECTION);
    h.env.EMAIL_MANUEL_ACTIF = "false";
    expect(await fonction.ouvrir(DIRECTION, e.id)).toMatchObject({ refus: "eteint" });
    expect(await fonction.finaliser(DIRECTION, e.id, nouveauJeton(), antivirusSain)).toMatchObject({
      refus: "eteint",
    });
    expect(h.lignes).toHaveLength(0);
    expect(h.debit.cles).toHaveLength(0);
    expect(h.sql).toHaveLength(0);
    expect((await fonction.lister(DIRECTION, e.id)).ok).toBe(true);
  });

  it("24. noms : double extension refusée, retours à la ligne et barres retirés", async () => {
    expect(await ouvrir([{ nom: "x.pdf.exe", taille: 10 }])).toMatchObject({ refus: "annonce" });
    await ouvrir([{ nom: "a\r\nb.pdf", taille: 10 }]);
    await ouvrir([{ nom: "../../etc/x.pdf", taille: 10 }]);
    expect(h.lignes).toHaveLength(2);
    expect(h.lignes[0]!.nomFichier).not.toMatch(/[\r\n]/);
    expect(h.lignes[1]!.nomFichier).not.toContain("/");
  });
});

describe("garde de source : jamais de suppression", () => {
  const racine = process.cwd();
  const fichiers = [
    "src/server/email-manuel/pieces-jointes.ts",
    "src/lib/email-manuel/pieces-jointes.ts",
  ];
  it.each(fichiers)("%s ne mentionne aucune suppression d'objet", (f) => {
    const src = readFileSync(path.join(racine, f), "utf8");
    expect(src.length).toBeGreaterThan(500);
    expect(src).not.toMatch(/deleteFromR2/);
    expect(src).not.toMatch(/DeleteObject/);
    expect(src).not.toMatch(/\.delete(Many)?\(/);
    expect(src).not.toMatch(/supprimerObjet|supprimerSansBruit/);
  });

  it("25. F7 ne crée ni ne modifie l'e-mail lui-même, n'est pas une action serveur", () => {
    const src = readFileSync(path.join(racine, fichiers[0]!), "utf8");
    expect(src).not.toMatch(
      /\.emailManuel\.(create|createMany|upsert|update|updateMany|delete|deleteMany)\b/,
    );
    expect(src).not.toMatch(/["']use server["']/);
    expect(src).not.toMatch(/deleteFromR2/);
  });

  it("le module n'importe pas le module du formulaire de contact autrement que pour le contrôle", () => {
    const src = readFileSync(path.join(racine, fichiers[0]!), "utf8");
    const imports = [...src.matchAll(/from "(@\/server\/contact\/[^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["@/server/contact/pieces-jointes"]);
    expect(src).toMatch(/verifierObjetTemporaire/);
    expect(src).not.toMatch(/finaliserPiecesJointes\(|nettoyerPiecesJointesContact/);
  });
});
