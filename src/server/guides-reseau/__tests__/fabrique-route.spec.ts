// @vitest-environment node
// G3 — POST /api/interne/guides-reseau/contenu : base EN MÉMOIRE, stockage et rendu factices, aucun réseau.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Ligne = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const etat = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  depots: [] as { cle: string; octets: number }[],
  objets: new Map<string, number>(),
  panneStockage: false,
  panneBaseSurPret: false,
  pdfOctets: 2048,
  pdfPages: 3,
  rendus: 0,
  cibleEcrite: 0,
  retardRendu: null as Promise<void> | null,
  tailleFausse: false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cibleReseau: {
      upsert: async () => {
        etat.cibleEcrite++;
      },
    },
    guideReseauVersion: {
      findFirst: async ({ where }: Ligne) => {
        const l = etat.lignes
          .filter((x) => x.code === where.code && x.statut === where.statut)
          .sort((a, b) => b.version - a.version)[0];
        return l ? { version: l.version } : null;
      },
      findUnique: async ({ where }: Ligne) =>
        etat.lignes.find(
          (x) => x.code === where.code_version.code && x.version === where.code_version.version,
        ) ?? null,
      create: async ({ data }: Ligne) => {
        if (etat.lignes.some((x) => x.code === data.code && x.version === data.version)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const l = {
          id: `id-${etat.lignes.length + 1}`,
          modifieLe: new Date(),
          sha256Pdf: null,
          pages: null,
          tailleOctets: null,
          ...data,
        };
        etat.lignes.push(l);
        return { id: l.id };
      },
      updateMany: async ({ where, data }: Ligne) => {
        if (data.statut === "pret" && etat.panneBaseSurPret) throw new Error("base_en_panne");
        const seuil = where.OR?.find((o: Ligne) => o.modifieLe)?.modifieLe.lt as Date | undefined;
        const l = etat.lignes.find((x) => x.id === where.id);
        if (!l) return { count: 0 };
        const ok = where.OR
          ? l.statut === "echec" ||
            (l.statut === "en_cours" && seuil !== undefined && l.modifieLe < seuil)
          : l.statut === where.statut;
        if (!ok) return { count: 0 };
        Object.assign(l, data, { modifieLe: new Date() });
        return { count: 1 };
      },
      findMany: async ({ where }: Ligne) =>
        etat.lignes
          .filter((x) => x.code === where.code)
          .map((x) => ({ ...x, id: undefined, cleObjet: undefined })),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("../stockage-guides", () => ({
  ouvrirStockage: () =>
    process.env.GUIDES_RESEAU_STOCKAGE === "volume" || process.env.GUIDES_RESEAU_STOCKAGE === "r2"
      ? {
          mode: process.env.GUIDES_RESEAU_STOCKAGE,
          deposer: async (cle: string, c: Buffer) => {
            if (etat.panneStockage) throw new Error("r2_en_panne");
            etat.depots.push({ cle, octets: c.length });
            etat.objets.set(cle, c.length);
          },
          taille: async (cle: string) => (etat.tailleFausse ? 1 : (etat.objets.get(cle) ?? null)),
        }
      : null,
}));
vi.mock("../guide-pdf", () => ({
  rendreGuidePdf: async () => {
    etat.rendus++;
    if (etat.retardRendu) await etat.retardRendu;
    const pages = Array.from({ length: etat.pdfPages }, () => "/Type /Page\n").join("");
    return Buffer.from(
      (pages + "x".repeat(etat.pdfOctets)).slice(0, Math.max(etat.pdfOctets, pages.length)),
    );
  },
}));

import { POST } from "@/app/api/interne/guides-reseau/contenu/route";
import { GET } from "@/app/api/interne/guides-reseau/versions/route";
import { empreinteTexte, type ContenuGuide } from "../fabrique-pdf";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "s".repeat(40);
const CH = "/api/interne/guides-reseau/contenu";

function contenu(sur: Partial<ContenuGuide> = {}): ContenuGuide {
  return {
    code: "gde-essai-01",
    version: 1,
    titre: "Mon guide pratique",
    sections: [{ titre: "Partie", paragraphes: ["Un paragraphe simple."], puces: [] }],
    ...sur,
  };
}
const corps = (c: ContenuGuide) => ({ ...c, sha256Texte: empreinteTexte(c) });
function entetes(methode: "GET" | "POST", chemin: string, texte: string, secret = SECRET) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000));
  return {
    "x-axion-horodatage": horodatage,
    "x-axion-nonce": nonce,
    "x-axion-signature": signerRequete({
      secret,
      horodatage,
      nonce,
      methode,
      chemin,
      corps: texte,
    }),
  };
}
const envoyer = (
  b: unknown,
  o: { secret?: string; brut?: string; type?: string; sansSignature?: boolean } = {},
) => {
  const texte = o.brut ?? JSON.stringify(b);
  return POST(
    new NextRequest(`http://localhost${CH}`, {
      method: "POST",
      headers: {
        "content-type": o.type ?? "application/json",
        ...(o.sansSignature ? {} : entetes("POST", CH, texte, o.secret)),
      },
      body: texte,
    }),
  );
};
const json = async (r: Response) => (await r.json()) as Ligne;

beforeEach(() => {
  Object.assign(etat, {
    lignes: [],
    depots: [],
    objets: new Map(),
    panneStockage: false,
    panneBaseSurPret: false,
    pdfOctets: 2048,
    pdfPages: 3,
    rendus: 0,
    cibleEcrite: 0,
    retardRendu: null,
    tailleFausse: false,
  });
  vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", SECRET);
  vi.stubEnv("GUIDES_RESEAU_STOCKAGE", "volume");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example.test:5432/x");
});
afterEach(() => vi.unstubAllEnvs());

describe("interrupteur et signature", () => {
  it("éteint (absent, « false », « TRUE ») = 404, rien lu ni écrit", async () => {
    for (const v of ["", "false", "TRUE", "1"]) {
      vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", v);
      expect((await envoyer(corps(contenu()))).status).toBe(404);
    }
    expect(etat.lignes).toHaveLength(0);
    expect(etat.rendus).toBe(0);
  });
  it("sans signature ou mauvais secret = 401", async () => {
    expect((await envoyer(corps(contenu()), { sansSignature: true })).status).toBe(401);
    expect((await envoyer(corps(contenu()), { secret: "x".repeat(40) })).status).toBe(401);
  });
  it("SANS repli : le secret des vidéos n'ouvre pas la route", async () => {
    vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", "");
    vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", "v".repeat(40));
    const r = await envoyer(corps(contenu()), { secret: "v".repeat(40) });
    expect(r.status).toBe(503);
    expect((await json(r)).erreur).toBe("reception_non_configuree");
  });
  it("64 Ko + 1 = 413 ; text/plain = 415 ; JSON illisible = 400", async () => {
    expect((await envoyer(null, { brut: "a".repeat(64 * 1024 + 1) })).status).toBe(413);
    expect((await envoyer(corps(contenu()), { type: "text/plain" })).status).toBe(415);
    expect((await envoyer(null, { brut: "{pas du json" })).status).toBe(400);
  });
});

describe("dépôt nominal", () => {
  it("201, un objet envoyé à la clé dérivée, ligne « pret », cibles_reseau JAMAIS écrite", async () => {
    const r = await envoyer(corps(contenu()));
    expect(r.status).toBe(201);
    const j = await json(r);
    expect(j).toMatchObject({
      ok: true,
      deja: false,
      code: "gde-essai-01",
      version: 1,
      pages: 3,
      tailleOctets: 2048,
    });
    expect(JSON.stringify(j)).not.toMatch(/guides-reseau\/|\.pdf|https?:/); // ni clé, ni chemin, ni lien
    expect(etat.depots).toEqual([{ cle: "guides-reseau/gde-essai-01/v1.pdf", octets: 2048 }]);
    expect(etat.lignes[0]).toMatchObject({
      statut: "pret",
      stockage: "volume",
      cleObjet: "guides-reseau/gde-essai-01/v1.pdf",
    });
    expect(etat.cibleEcrite).toBe(0);
  });
  it("la clé ne vient jamais du corps : un champ cle/chemin est refusé", async () => {
    const r = await envoyer({ ...corps(contenu()), cle: "../../etc/x" });
    expect(r.status).toBe(422);
    expect(etat.depots).toHaveLength(0);
  });
  it("empreinte fausse = 422 empreinte_differente, rien rendu", async () => {
    const r = await envoyer({ ...corps(contenu()), sha256Texte: "0".repeat(64) });
    expect(r.status).toBe(422);
    expect((await json(r)).erreur).toBe("empreinte_differente");
    expect(etat.rendus).toBe(0);
  });
  it("texte refusé = 422 texte_refuse avec la règle et sans extrait", async () => {
    const c = contenu({
      sections: [{ titre: "Partie", paragraphes: ["Rejoignez Grenoble"], puces: [] }],
    });
    const r = await envoyer(corps(c));
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j).toMatchObject({ erreur: "texte_refuse", regle: "grenoble" });
    expect(JSON.stringify(j)).not.toMatch(/Rejoignez/);
  });
  it("guide-ia et adr-… refusés (code_invalide)", async () => {
    for (const code of ["guide-ia", "adr-essai-01"]) {
      const r = await envoyer(corps(contenu({ code })));
      expect(r.status).toBe(422);
      expect((await json(r)).erreur).toBe("code_invalide");
    }
  });
  it("stockage non choisi = 503 stockage_indisponible, aucune ligne", async () => {
    vi.stubEnv("GUIDES_RESEAU_STOCKAGE", "");
    const r = await envoyer(corps(contenu()));
    expect(r.status).toBe(503);
    expect((await json(r)).erreur).toBe("stockage_indisponible");
    expect(etat.lignes).toHaveLength(0);
  });
});

describe("idempotence et ordre", () => {
  it("rejeu identique = 200 deja:true, UN SEUL envoi", async () => {
    expect((await envoyer(corps(contenu()))).status).toBe(201);
    const r = await envoyer(corps(contenu()));
    expect(r.status).toBe(200);
    expect(await json(r)).toMatchObject({ ok: true, deja: true });
    expect(etat.depots).toHaveLength(1);
    expect(etat.rendus).toBe(1);
  });
  it("même version, autre empreinte = 409", async () => {
    await envoyer(corps(contenu()));
    const autre = contenu({ titre: "Un autre titre" });
    const r = await envoyer(corps(autre));
    expect(r.status).toBe(409);
    expect(etat.depots).toHaveLength(1);
  });
  it("version plus ancienne que la version prête = 409 version_perimee {versionMax}", async () => {
    await envoyer(corps(contenu({ version: 3 })));
    const r = await envoyer(corps(contenu({ version: 2 })));
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ erreur: "version_perimee", versionMax: 3 });
    expect(etat.depots).toHaveLength(1);
  });
  it("deux dépôts simultanés de la même version = 201 + 409", async () => {
    let lacher!: () => void;
    etat.retardRendu = new Promise<void>((r) => (lacher = r));
    const a = envoyer(corps(contenu()));
    await new Promise((r) => setTimeout(r, 30));
    const b = await envoyer(corps(contenu()));
    expect(b.status).toBe(409);
    expect((await json(b)).erreur).toBe("en_cours");
    lacher();
    expect((await a).status).toBe(201);
    expect(etat.depots).toHaveLength(1);
  });
  it("deux versions différentes simultanées : un seul rendu à la fois (429 rendu_occupe)", async () => {
    let lacher!: () => void;
    etat.retardRendu = new Promise<void>((r) => (lacher = r));
    const a = envoyer(corps(contenu({ version: 1 })));
    await new Promise((r) => setTimeout(r, 30));
    const b = await envoyer(corps(contenu({ code: "gde-autre-02", version: 1 })));
    expect(b.status).toBe(429);
    expect((await json(b)).erreur).toBe("rendu_occupe");
    lacher();
    expect((await a).status).toBe(201);
  });
  it("rendu qui dépasse 60 s : abandonné, 503 echec, ligne « echec », verrou libéré, rien déposé", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let lacher!: () => void;
      etat.retardRendu = new Promise<void>((r) => (lacher = r));
      const a = envoyer(corps(contenu({ version: 1 })));
      await vi.advanceTimersByTimeAsync(61_000);
      const r = await a;
      expect(r.status).toBe(503);
      expect((await json(r)).erreur).toBe("echec");
      expect(etat.lignes.find((l) => l.version === 1)?.statut).toBe("echec");
      lacher();
      await vi.advanceTimersByTimeAsync(10);
      expect(etat.depots).toHaveLength(0);
      etat.retardRendu = null;
      const b = await envoyer(corps(contenu({ version: 1 })));
      expect(b.status).toBe(201);
    } finally {
      vi.useRealTimers();
    }
  });
  it("panne du stockage = 503 stockage_echec, ligne « echec », ancienne version intacte, relance OK", async () => {
    await envoyer(corps(contenu({ version: 1 })));
    etat.panneStockage = true;
    const r = await envoyer(corps(contenu({ version: 2 })));
    expect(r.status).toBe(503);
    expect((await json(r)).erreur).toBe("stockage_echec");
    expect(etat.lignes.find((l) => l.version === 2)?.statut).toBe("echec");
    expect(etat.lignes.find((l) => l.version === 1)?.statut).toBe("pret");
    expect(etat.cibleEcrite).toBe(0);
    etat.panneStockage = false;
    expect((await envoyer(corps(contenu({ version: 2 })))).status).toBe(201);
  });
  it("taille relue différente = stockage_echec (pas « pret »)", async () => {
    etat.tailleFausse = true;
    const r = await envoyer(corps(contenu()));
    expect(r.status).toBe(503);
    expect(etat.lignes[0]?.statut).toBe("echec");
  });
  it("panne de la base APRÈS l'envoi = 503, puis la relance écrase l'objet et réussit", async () => {
    etat.panneBaseSurPret = true;
    const r = await envoyer(corps(contenu()));
    expect(r.status).toBe(503);
    expect(etat.lignes[0]?.statut).not.toBe("pret");
    etat.panneBaseSurPret = false;
    const relance = await envoyer(corps(contenu()));
    expect(relance.status).toBe(201);
    expect(etat.depots).toHaveLength(2); // même clé, écrasée
    expect(new Set(etat.depots.map((d) => d.cle)).size).toBe(1);
  });
  it("une ligne « en_cours » périmée (> 5 min) est reprise", async () => {
    etat.lignes.push({
      id: "vieux",
      code: "gde-essai-01",
      version: 1,
      sha256Texte: "0".repeat(64),
      statut: "en_cours",
      modifieLe: new Date(Date.now() - 6 * 60_000),
    });
    expect((await envoyer(corps(contenu()))).status).toBe(201);
  });
});

describe("bornes mémoire", () => {
  it("31 pages = 422 trop_de_pages, rien envoyé", async () => {
    etat.pdfPages = 31;
    const r = await envoyer(corps(contenu()));
    expect(r.status).toBe(422);
    expect((await json(r)).erreur).toBe("trop_de_pages");
    expect(etat.depots).toHaveLength(0);
  });
  it("PDF > 5 Mo = 422", async () => {
    etat.pdfOctets = 5 * 1024 * 1024 + 1;
    expect((await envoyer(corps(contenu()))).status).toBe(422);
    expect(etat.depots).toHaveLength(0);
  });
});

describe("GET /versions", () => {
  const lire = (code: string, sig = true) => {
    const chemin = `/api/interne/guides-reseau/versions?code=${code}`;
    return GET(
      new NextRequest(`http://localhost${chemin}`, {
        method: "GET",
        headers: sig ? entetes("GET", chemin, "") : {},
      }),
    );
  };
  it("éteint = 404 ; sans signature = 401 ; code mal formé = 422", async () => {
    expect((await lire("gde-essai-01", false)).status).toBe(401);
    expect((await lire("pas-un-code")).status).toBe(422);
    vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "");
    expect((await lire("gde-essai-01")).status).toBe(404);
  });
  it("rend les versions sans chemin, clé, ni lien", async () => {
    await envoyer(corps(contenu()));
    const r = await lire("gde-essai-01");
    expect(r.status).toBe(200);
    const texte = JSON.stringify(await r.json());
    expect(texte).toMatch(/"version":1/);
    expect(texte).not.toMatch(/guides-reseau\/|\.pdf|https?:|cleObjet/);
  });
});
