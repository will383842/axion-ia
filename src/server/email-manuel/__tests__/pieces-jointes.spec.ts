// @vitest-environment node

/**
 * Pièces jointes des e-mails écrits à la main (lot I4, fiche F7). Compartiment et base SIMULÉS en
 * mémoire ; le contrôle des octets est le VRAI (`verifierObjetTemporaire`, réutilisé sans changement).
 *
 * Ce qui est verrouillé : acte vérifié dans chaque fonction ; format exclu et limites refusés ;
 * clé tirée par le serveur ; macros, exécutable renommé et antivirus muet refusés ; jeton rejoué sans
 * effet ; objets refusés déplacés et jamais supprimés ; aucun appel de suppression dans le module.
 */

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
  cleIdempotence: string;
  statut: string;
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
    ObjetR2Modifie,
  };
});

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
    const val = (l as Record<string, unknown>)[k];
    if (v && typeof v === "object" && "in" in v) return (v as { in: unknown[] }).in.includes(val);
    return val === v;
  });
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailManuel: {
      findUnique: async ({ where }: { where: { id?: string; cleIdempotence?: string } }) =>
        h.emails.find((e) =>
          where.id ? e.id === where.id : e.cleIdempotence === where.cleIdempotence,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const e = { id: `email-${h.emails.length + 1}`, statut: "brouillon", ...data } as Email;
        h.emails.push(e);
        return e;
      },
    },
    emailManuelPieceJointe: {
      createMany: async ({ data }: { data: Ligne[] }) => {
        h.lignes.push(
          ...data.map((d) => ({ ...d, motifRefus: null, sha256: null, antivirus: null })),
        );
        return { count: data.length };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        h.lignes.filter((l) => correspond(l, where)).map((l) => ({ ...l })),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const vis = h.lignes.filter((l) => correspond(l, where));
        vis.forEach((l) => Object.assign(l, data));
        return { count: vis.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: object }) => {
        const l = h.lignes.find((x) => x.id === where.id);
        if (!l) throw new Error("introuvable");
        return Object.assign(l, data);
      },
    },
  },
}));

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
  type BrouillonACreer,
} from "../pieces-jointes";
import type { Antivirus } from "@/server/contact/pieces-jointes";

const DIRECTION = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };
const FONDATEUR = { id: "22222222-2222-4222-8222-222222222222", role: "super_admin" };
const SECRETAIRE = { id: "33333333-3333-4333-8333-333333333333", role: "secretaire" };
const MO = 1024 * 1024;

const BROUILLON: BrouillonACreer = {
  cleIdempotence: "cle-idempotence-0001",
  entiteType: "Client",
  entiteId: "44444444-4444-4444-8444-444444444444",
  destinataireChiffre: "chiffre",
  destinataireHash: "a".repeat(64),
  expediteurNom: "Axion-IA",
  ecritParNom: "Direction",
};

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
  acteur = DIRECTION,
  quoi: { emailManuelId: string } | { brouillon: BrouillonACreer } = { brouillon: BROUILLON },
) {
  return ouvrirEnvoisPiecesJointesEmail({ acteur, ...quoi, pieces });
}

beforeEach(() => {
  h.seau.clear();
  h.lignes.length = 0;
  h.emails.length = 0;
  h.suppressions.length = 0;
  h.urls.length = 0;
  h.debit.allowed = true;
  h.debit.cles.length = 0;
  h.debit.configs.length = 0;
  n = 0;
});

describe("ouvrir les envois", () => {
  it("crée la ligne brouillon si besoin, une ligne attendue et une URL signée par fichier", async () => {
    const r = await ouvrir([
      { nom: "Devis.pdf", taille: 120_000 },
      { nom: "photo.JPG", taille: 2 * MO },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(h.emails).toHaveLength(1);
    expect(h.emails[0]!.statut).toBe("brouillon");
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
      new RegExp(`^${PREFIXE_TEMPORAIRE_EMAIL}\\d{4}-\\d{2}-\\d{2}/[0-9a-f-]{36}$`),
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
    "virus.exe",
    "macro.docm",
    "sans-extension",
  ])("format exclu « %s » : refusé, aucune ligne, aucune URL", async (nom) => {
    const r = await ouvrir([{ nom, taille: 1000 }]);
    expect(r.ok).toBe(false);
    expect(h.lignes).toHaveLength(0);
    expect(h.urls).toHaveLength(0);
  });

  it.each([
    "a.pdf",
    "a.docx",
    "a.xlsx",
    "a.pptx",
    "a.odt",
    "a.txt",
    "a.csv",
    "a.png",
    "a.jpg",
    "a.jpeg",
  ])("format permis « %s »", async (nom) => {
    expect((await ouvrir([{ nom, taille: 1000 }])).ok).toBe(true);
  });

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

  it("le même brouillon (même clé d'idempotence) n'est créé qu'une fois", async () => {
    await ouvrir([{ nom: "a.pdf", taille: 10 }]);
    await ouvrir([{ nom: "b.pdf", taille: 10 }]);
    expect(h.emails).toHaveLength(1);
    expect(h.lignes).toHaveLength(2);
  });

  it("brouillon mal formé (empreinte, type d'entité) : refus avant toute écriture", async () => {
    const mauvais = [
      { ...BROUILLON, destinataireHash: "xyz" },
      { ...BROUILLON, entiteType: "Inconnu" },
    ];
    for (const b of mauvais) {
      const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], DIRECTION, { brouillon: b });
      expect(r.ok).toBe(false);
    }
    expect(h.emails).toHaveLength(0);
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
    const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], DIRECTION, { emailManuelId: "nope" });
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
    expect(h.emails).toHaveLength(0);
    expect(h.urls).toHaveLength(0);
  });
});

describe("l'acte ecrire_email_manuel est vérifié dans chaque fonction exposée", () => {
  it("ouvrir : refus sans l'acte, rien d'écrit, compteur non touché", async () => {
    const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], SECRETAIRE);
    expect(r).toMatchObject({ ok: false, refus: "acte" });
    expect(h.emails).toHaveLength(0);
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
    const r = await listerPiecesJointesEmail({ acteur: SECRETAIRE, emailManuelId: "x" });
    expect(r).toMatchObject({ ok: false, refus: "acte" });
  });

  it("rôle absent ou vide : refus", async () => {
    for (const role of [null, undefined, ""]) {
      const r = await ouvrir([{ nom: "a.pdf", taille: 10 }], { id: "x", role: role as string });
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

  it("le module n'importe pas le module du formulaire de contact autrement que pour le contrôle", () => {
    const src = readFileSync(path.join(racine, fichiers[0]!), "utf8");
    const imports = [...src.matchAll(/from "(@\/server\/contact\/[^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["@/server/contact/pieces-jointes"]);
    expect(src).toMatch(/verifierObjetTemporaire/);
    expect(src).not.toMatch(/finaliserPiecesJointes\(|nettoyerPiecesJointesContact/);
  });
});
