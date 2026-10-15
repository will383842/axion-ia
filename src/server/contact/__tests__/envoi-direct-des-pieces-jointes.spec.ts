// @vitest-environment node

/**
 * Pièces jointes du contact — le contrôle APRÈS l'envoi direct vers R2
 * (2026-10-15). Le compartiment est SIMULÉ en mémoire, avec ses `ETag` et ses
 * lectures par plage ; la base aussi.
 *
 * Ce qui est verrouillé :
 *   · une archive ZIP est acceptée et DÉPLACÉE vers sa clé définitive, sous le
 *     type reconnu (jamais celui du navigateur) ; l'objet temporaire disparaît ;
 *   · un objet plus gros que l'annonce, ou à la signature invalide, est refusé
 *     ET supprimé ;
 *   · un `.docx` à macros est refusé sur son seul répertoire central, sans lire
 *     le fichier en entier ; un `.docm` est refusé ;
 *   · rien ne se contrôle sans le jeton, et rien ne se contrôle deux fois ;
 *   · un objet remplacé entre deux lectures est refusé ;
 *   · le nettoyage reprend un envoi abandonné, et supprime les temporaires de
 *     plus de 24 h — pas les plus récents.
 */

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fabriquerZip } from "@/lib/contact/__tests__/zip-de-test";

interface Objet {
  octets: Uint8Array;
  etag: string;
  type: string;
  modifieLe: Date;
}
interface Ligne {
  id: string;
  submissionId: string;
  nomFichier: string;
  format: string;
  tailleOctets: number;
  cleStockage: string;
  statut: string;
  jetonHash: string | null;
  motifRefus: string | null;
  sha256: string | null;
  antivirus: string | null;
  createdAt: Date;
}

const h = vi.hoisted(() => {
  class ObjetR2Modifie extends Error {}
  return {
    seau: new Map<string, Objet>(),
    lignes: [] as Ligne[],
    lecturesFlux: 0,
    ObjetR2Modifie,
  };
});

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const val = (l as unknown as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as { lt?: Date; in?: unknown[] };
      if (o.lt) return val instanceof Date && val < o.lt;
      if (o.in) return o.in.includes(val);
    }
    return val === v;
  });
}

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionAttachment: {
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
      findMany: async ({
        where,
        distinct,
      }: {
        where: Record<string, unknown>;
        distinct?: string[];
      }) => {
        const vis = h.lignes.filter((l) => correspond(l, where)).map((l) => ({ ...l }));
        if (!distinct) return vis;
        const vu = new Set<string>();
        return vis.filter((l) => !vu.has(l.submissionId) && vu.add(l.submissionId));
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
    h.lecturesFlux += 1;
    return (async function* () {
      for (let i = 0; i < o.octets.length; i += 64 * 1024) yield o.octets.subarray(i, i + 65536);
    })();
  },
  copierObjetR2: async (source: string, dest: string, etag: string, type: string) => {
    const o = verifierEtag(source, etag);
    h.seau.set(dest, { ...o, type });
  },
  deleteFromR2: async (cle: string) => {
    h.seau.delete(cle);
  },
  listerObjetsR2: async (prefixe: string) => ({
    objets: [...h.seau.entries()]
      .filter(([k]) => k.startsWith(prefixe))
      .map(([cle, o]) => ({ cle, modifieLe: o.modifieLe })),
    suite: null,
  }),
  signerEnvoiDirectR2: vi.fn(),
}));
vi.mock("@/server/careers/clamav", () => ({ analyserFlux: vi.fn() }));

import {
  PREFIXE_TEMPORAIRE,
  empreinteJeton,
  finaliserPiecesJointes,
  nettoyerPiecesJointesContact,
  type Antivirus,
} from "../pieces-jointes";

const SUB = "11111111-1111-4111-8111-111111111111";
const JETON = "j".repeat(43);
const MAINTENANT = new Date("2026-10-15T12:00:00Z");

/** Antivirus qui lit TOUT le flux, puis rend son verdict. */
const antivirusSain: Antivirus = async (flux) => {
  for await (const _ of flux) {
    // lu
  }
  return { issue: "sain" };
};

let n = 0;
function deposer(
  nom: string,
  format: string,
  octets: Uint8Array,
  options: { annonce?: number; createdAt?: Date; jeton?: string } = {},
): Ligne {
  n += 1;
  const cle = `${PREFIXE_TEMPORAIRE}2026-10-15/00000000-0000-4000-8000-00000000000${n}`;
  h.seau.set(cle, {
    octets,
    etag: `"e${n}"`,
    type: "application/octet-stream",
    modifieLe: MAINTENANT,
  });
  const ligne: Ligne = {
    id: `piece-${n}`,
    submissionId: SUB,
    nomFichier: nom,
    format,
    tailleOctets: options.annonce ?? octets.length,
    cleStockage: cle,
    statut: "attendue",
    jetonHash: empreinteJeton(options.jeton ?? JETON),
    motifRefus: null,
    sha256: null,
    antivirus: null,
    createdAt: options.createdAt ?? MAINTENANT,
  };
  h.lignes.push(ligne);
  return ligne;
}

const CT = ["[Content_Types].xml", "<Types/>"] as const;
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n" + "x".repeat(200_000)));
const EXE = new Uint8Array(Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from("DOS mode")]));

beforeEach(() => {
  h.seau.clear();
  h.lignes.length = 0;
  h.lecturesFlux = 0;
  n = 0;
});

describe("fin d'envoi — accepté, rangé, déplacé", () => {
  it("une archive ZIP est acceptée, déplacée sous sa clé définitive, typée application/zip", async () => {
    const zip = fabriquerZip([
      ["plans/rdc.pdf", "%PDF-1.7"],
      ["photos/facade.jpg", "JFIF"],
    ]);
    const l = deposer("plans.zip", "zip", zip);
    const temporaire = l.cleStockage;
    const bilan = await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(bilan).toEqual({ pieces: [{ id: l.id, statut: "recue" }], controlees: true });
    expect(l.statut).toBe("recue");
    expect(l.cleStockage).toMatch(
      new RegExp(`^contact/pieces-jointes/2026/${SUB}/[0-9a-f-]{36}\\.zip$`),
    );
    expect(h.seau.has(temporaire)).toBe(false);
    expect(h.seau.get(l.cleStockage)?.type).toBe("application/zip");
    expect(l.sha256).toBe(createHash("sha256").update(zip).digest("hex"));
    expect(l.antivirus).toBe("sain");
  });

  it("un PDF de 200 Ko : lu par morceaux, empreinte exacte", async () => {
    const l = deposer("Cahier des charges.pdf", "pdf", PDF);
    await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(l.statut).toBe("recue");
    expect(l.sha256).toBe(createHash("sha256").update(PDF).digest("hex"));
  });

  it("antivirus muet : la pièce passe « non vérifiée », l'empreinte est relue", async () => {
    const l = deposer("cdc.pdf", "pdf", PDF);
    await finaliserPiecesJointes(SUB, JETON, async () => ({
      issue: "indisponible",
      raison: "ECONNREFUSED",
    }));
    expect(l).toMatchObject({ statut: "recue", antivirus: "non_verifie" });
    expect(l.sha256).toBe(createHash("sha256").update(PDF).digest("hex"));
  });
});

describe("fin d'envoi — refusé et supprimé", () => {
  it("un objet plus gros que la taille annoncée est refusé et supprimé", async () => {
    const l = deposer("cdc.pdf", "pdf", PDF, { annonce: 1000 });
    const temporaire = l.cleStockage;
    const bilan = await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(l).toMatchObject({ statut: "refusee", motifRefus: "taille" });
    expect(bilan.pieces[0]!.statut).toBe("refusee");
    expect(bilan.pieces[0]!.message).toMatch(/pièce non reçue/);
    expect(h.seau.has(temporaire)).toBe(false);
    expect(h.seau.size).toBe(0);
  });

  it("un exécutable déguisé en .pdf est refusé et supprimé, sans lecture complète", async () => {
    const l = deposer("devis.pdf", "pdf", EXE);
    const bilan = await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(l).toMatchObject({ statut: "refusee", motifRefus: "contenu" });
    expect(bilan.pieces[0]!.message).toMatch(/ne correspond pas à son extension/);
    expect(h.seau.size).toBe(0);
    expect(h.lecturesFlux).toBe(0);
  });

  it("un .docx à macros est refusé sur son RÉPERTOIRE CENTRAL, sans lire le fichier entier", async () => {
    const docx = fabriquerZip([
      CT,
      ["word/document.xml", "x".repeat(300_000)],
      ["word/vbaProject.bin", "VBA"],
    ]);
    const l = deposer("cdc.docx", "docx", docx);
    const bilan = await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(l).toMatchObject({ statut: "refusee", motifRefus: "macros" });
    expect(bilan.pieces[0]!.message).toMatch(/contient des macros/);
    expect(h.lecturesFlux).toBe(0);
    expect(h.seau.size).toBe(0);
  });

  it("un .docm est refusé, même valide", async () => {
    const l = deposer("cdc.docm", "docx", fabriquerZip([CT, ["word/document.xml", "<w/>"]]));
    await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(l).toMatchObject({ statut: "refusee", motifRefus: "macros" });
    expect(h.seau.size).toBe(0);
  });

  it("un fichier infecté est refusé et supprimé", async () => {
    const l = deposer("cdc.pdf", "pdf", PDF);
    await finaliserPiecesJointes(SUB, JETON, async () => ({
      issue: "infecte",
      signature: "Eicar-Test-Signature",
    }));
    expect(l).toMatchObject({ statut: "refusee", motifRefus: "infecte" });
    expect(h.seau.size).toBe(0);
  });

  it("un objet remplacé APRÈS son contrôle (ETag changé) est refusé, jamais copié", async () => {
    const l = deposer("cdc.pdf", "pdf", PDF);
    const objet = h.seau.get(l.cleStockage)!;
    await finaliserPiecesJointes(SUB, JETON, async (flux) => {
      for await (const _ of flux) {
        // lu
      }
      // Le navigateur ré-envoie un autre contenu sur la même clé, pendant le contrôle.
      objet.etag = '"remplace"';
      return { issue: "sain" };
    });
    expect(l).toMatchObject({ statut: "refusee", motifRefus: "contenu" });
    expect(h.seau.size).toBe(0);
  });

  it("un objet jamais arrivé : « non reçue »", async () => {
    const l = deposer("cdc.pdf", "pdf", PDF);
    h.seau.delete(l.cleStockage);
    const bilan = await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(l.statut).toBe("non_recue");
    expect(bilan.pieces[0]).toEqual({
      id: l.id,
      statut: "non_recue",
      message: expect.stringMatching(/« cdc\.pdf » : pièce non reçue/),
    });
  });
});

describe("le jeton, et une seule fois", () => {
  it("sans le bon jeton, rien ne se contrôle ni ne se range", async () => {
    const l = deposer("cdc.pdf", "pdf", PDF);
    const bilan = await finaliserPiecesJointes(SUB, "x".repeat(43), antivirusSain);
    expect(bilan).toEqual({ pieces: [], controlees: false });
    expect(l.statut).toBe("attendue");
    expect(h.seau.has(l.cleStockage)).toBe(true);
  });

  it("un second appel rend l'issue rangée sans rien relire", async () => {
    deposer("cdc.pdf", "pdf", PDF);
    await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    const lectures = h.lecturesFlux;
    const second = await finaliserPiecesJointes(SUB, JETON, antivirusSain);
    expect(second.controlees).toBe(false);
    expect(second.pieces[0]!.statut).toBe("recue");
    expect(h.lecturesFlux).toBe(lectures);
  });
});

describe("nettoyage horaire", () => {
  it("reprend un envoi abandonné depuis plus d'une heure, et fait partir l'accusé", async () => {
    const vieux = new Date(MAINTENANT.getTime() - 2 * 60 * 60 * 1000);
    const abandonnee = deposer("cdc.pdf", "pdf", PDF, { createdAt: vieux });
    const recente = deposer("autre.pdf", "pdf", PDF, { jeton: "k".repeat(43) });
    recente.submissionId = "22222222-2222-4222-8222-222222222222";
    const accuse = vi.fn(async () => true);
    const bilan = await nettoyerPiecesJointesContact(MAINTENANT, {
      antivirus: antivirusSain,
      accuse,
    });
    expect(abandonnee.statut).toBe("recue");
    expect(recente.statut).toBe("attendue");
    expect(accuse).toHaveBeenCalledWith(SUB);
    expect(accuse).toHaveBeenCalledTimes(1);
    expect(bilan.demandesReprises).toBe(1);
  });

  it("supprime les objets temporaires de plus de 24 h, garde les récents et les définitifs", async () => {
    const vieux = new Date(MAINTENANT.getTime() - 25 * 60 * 60 * 1000);
    const o = { octets: PDF, etag: '"o"', type: "x", modifieLe: vieux };
    h.seau.set(`${PREFIXE_TEMPORAIRE}2026-10-14/orphelin`, o);
    h.seau.set(`${PREFIXE_TEMPORAIRE}2026-10-15/recent`, { ...o, modifieLe: MAINTENANT });
    h.seau.set(`contact/pieces-jointes/2025/${SUB}/ancien.pdf`, o);
    const bilan = await nettoyerPiecesJointesContact(MAINTENANT, {
      antivirus: antivirusSain,
      accuse: async () => true,
    });
    expect(bilan.temporairesSupprimes).toBe(1);
    expect([...h.seau.keys()].sort()).toEqual([
      `contact/pieces-jointes/2025/${SUB}/ancien.pdf`,
      `${PREFIXE_TEMPORAIRE}2026-10-15/recent`,
    ]);
  });
});
