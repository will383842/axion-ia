import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signerRequete, sha256Hex } from "@/server/videos/signature";
import { publicationValide } from "@/server/videos/__tests__/fixtures";
import { creerFauxPrisma } from "@/server/videos/__tests__/faux-prisma";

const SECRET = "s".repeat(40);
const T0 = 1_800_000_000;
const CHEMIN = "/api/interne/videos";

const faux = creerFauxPrisma();
const verifierFichiers = vi.fn();
const apresPublication = vi.fn(async () => ({ indexnow: "ok", erreurs: [] }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return faux.client;
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: 0,
    panne: false,
  })),
}));
vi.mock("@/server/videos/apres-publication", () => ({
  apresPublication: (...a: unknown[]) => (apresPublication as (...x: unknown[]) => unknown)(...a),
}));
vi.mock("@/server/videos/fichiers", () => ({
  verifierFichiers: (...a: unknown[]) => verifierFichiers(...a),
}));

// eslint-disable-next-line no-restricted-imports
import { POST, DELETE } from "@/app/api/interne/videos/route";

let compteurNonce = 0;
function nonceNeuf(): string {
  compteurNonce += 1;
  return compteurNonce.toString(16).padStart(32, "0");
}

interface Options {
  methode?: "POST" | "DELETE";
  corps?: string;
  nonce?: string;
  horodatage?: number;
  secret?: string;
  signature?: string;
  contentType?: string | null;
}

function requete(o: Options = {}): NextRequest {
  const methode = o.methode ?? "POST";
  const corps = o.corps ?? JSON.stringify(publicationValide());
  const nonce = o.nonce ?? nonceNeuf();
  const horodatage = String(o.horodatage ?? T0);
  const signature =
    o.signature ??
    signerRequete({
      secret: o.secret ?? SECRET,
      horodatage,
      nonce,
      methode,
      chemin: CHEMIN,
      corps,
    });
  const entetes: Record<string, string> = {
    "x-axion-horodatage": horodatage,
    "x-axion-nonce": nonce,
    "x-axion-signature": signature,
  };
  if (o.contentType !== null) entetes["content-type"] = o.contentType ?? "application/json";
  return new NextRequest(`http://localhost${CHEMIN}`, {
    method: methode,
    headers: entetes,
    body: corps,
  });
}

async function lire(r: Response): Promise<Record<string, unknown>> {
  return (await r.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 * 1000);
  vi.stubEnv("VIDEOS_SITE_ENABLED", "true");
  vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", SECRET);
  vi.stubEnv("VIDEOS_NOMS_CLIENTS_INTERDITS", "");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
  faux.videos.length = 0;
  faux.journal.length = 0;
  faux.ecritures.length = 0;
  apresPublication.mockClear();
  verifierFichiers.mockReset();
  verifierFichiers.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("interrupteur et configuration", () => {
  it("drapeau éteint → 503 reception_eteinte et ZÉRO écriture", async () => {
    vi.stubEnv("VIDEOS_SITE_ENABLED", "");
    const r = await POST(requete());
    expect(r.status).toBe(503);
    expect((await lire(r)).erreur).toBe("reception_eteinte");
    expect(faux.ecritures).toEqual([]);
    expect(verifierFichiers).not.toHaveBeenCalled();
  });

  it("drapeau absent → 503", async () => {
    vi.unstubAllEnvs();
    delete process.env.VIDEOS_SITE_ENABLED;
    expect((await POST(requete())).status).toBe(503);
    expect(faux.ecritures).toEqual([]);
  });

  it("secret absent ou court → 503 reception_non_configuree", async () => {
    vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", "court");
    const r = await POST(requete());
    expect(r.status).toBe(503);
    expect((await lire(r)).erreur).toBe("reception_non_configuree");
  });

  it("base factice du build (stub.invalid) → 503, aucune mutation tentée", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    const r = await POST(requete());
    expect(r.status).toBe(503);
    expect(faux.ecritures).toEqual([]);
  });

  it("toute réponse est no-store et noindex", async () => {
    const r = await POST(requete());
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toMatch(/noindex/);
  });
});

describe("contrôles d'entrée (ordre du §3.3)", () => {
  it("en-têtes absents → 400 entetes_invalides", async () => {
    const r = new NextRequest(`http://localhost${CHEMIN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const rep = await POST(r);
    expect(rep.status).toBe(400);
    expect((await lire(rep)).erreur).toBe("entetes_invalides");
  });

  it("Content-Type autre que JSON → 415", async () => {
    expect((await POST(requete({ contentType: "text/plain" }))).status).toBe(415);
  });

  it("corps > 256 Kio → 413 avant tout calcul de signature", async () => {
    const gros = JSON.stringify({ x: "a".repeat(300 * 1024) });
    expect((await POST(requete({ corps: gros }))).status).toBe(413);
    expect(faux.ecritures).toEqual([]);
  });

  it("horodatage à 301 s → 401 horodatage_hors_fenetre", async () => {
    const r = await POST(requete({ horodatage: T0 - 301 }));
    expect(r.status).toBe(401);
    expect((await lire(r)).erreur).toBe("horodatage_hors_fenetre");
  });

  it("signature fausse → 401 signature_invalide, sans détail ni écriture", async () => {
    const r = await POST(requete({ secret: "x".repeat(40) }));
    expect(r.status).toBe(401);
    expect(await lire(r)).toEqual({ ok: false, erreur: "signature_invalide" });
    expect(faux.ecritures).toEqual([]);
  });

  it("secret précédent accepté (rotation)", async () => {
    vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT", "p".repeat(40));
    expect((await POST(requete({ secret: "p".repeat(40) }))).status).toBe(201);
  });

  it("corps non JSON signé → 422", async () => {
    expect((await POST(requete({ corps: "pas du json" }))).status).toBe(422);
  });

  it("champ inconnu → 422 avec la liste des champs", async () => {
    const corps = JSON.stringify({ ...publicationValide(), surprise: 1 });
    const r = await POST(requete({ corps }));
    expect(r.status).toBe(422);
    expect(JSON.stringify(await lire(r))).toContain("surprise");
    expect(faux.ecritures.filter((e) => e.startsWith("siteVideo."))).toEqual([]);
  });

  it("contenu interdit → 422 contenu_interdit + règle, sans écriture de vidéo", async () => {
    const corps = JSON.stringify(
      publicationValide({ titre: "Automatiser ses relances depuis Grenoble facilement" }),
    );
    const r = await POST(requete({ corps }));
    expect(r.status).toBe(422);
    const j = await lire(r);
    expect(j.erreur).toBe("contenu_interdit");
    expect(JSON.stringify(j)).toContain("grenoble");
    expect(faux.videos).toEqual([]);
  });

  it("fichier HEAD 404 → 422 fichier_injoignable sans écrire la vidéo", async () => {
    verifierFichiers.mockResolvedValue({
      ok: false,
      fautes: [{ champ: "fichiers.video", raison: "http_404" }],
    });
    const r = await POST(requete());
    expect(r.status).toBe(422);
    expect((await lire(r)).erreur).toBe("fichier_injoignable");
    expect(faux.videos).toEqual([]);
  });
});

describe("publication, rejeu et versions", () => {
  it("première réception → 201, vidéo écrite, date de publication posée par le site", async () => {
    const r = await POST(requete());
    expect(r.status).toBe(201);
    const j = await lire(r);
    expect(j).toMatchObject({
      ok: true,
      statut: "publiee",
      slug: "automatiser-ses-relances",
      version: 3,
      rejeu: false,
    });
    expect(String(j.url)).toMatch(/\/fr\/videos\/automatiser-ses-relances$/);
    expect(faux.videos).toHaveLength(1);
    expect(faux.videos[0]!.publieeLe).toEqual(new Date(T0 * 1000));
    expect(faux.journal).toHaveLength(1);
  });

  it("REJEU même nonce, même corps → même réponse, X-Axion-Rejeu: 1, ZÉRO effet", async () => {
    const corps = JSON.stringify(publicationValide());
    const nonce = nonceNeuf();
    const premiere = await POST(requete({ corps, nonce }));
    const ecrituresApres = faux.ecritures.length;
    const seconde = await POST(requete({ corps, nonce }));
    expect(seconde.status).toBe(premiere.status);
    expect(seconde.headers.get("x-axion-rejeu")).toBe("1");
    expect(premiere.headers.get("x-axion-rejeu")).toBeNull();
    expect(await lire(seconde)).toEqual(await lire(premiere.clone()));
    expect(faux.ecritures).toHaveLength(ecrituresApres);
    expect(faux.videos).toHaveLength(1);
    expect(faux.journal).toHaveLength(1);
  });

  it("même nonce, corps différent → 409 nonce_reutilise", async () => {
    const nonce = nonceNeuf();
    await POST(requete({ nonce }));
    const autre = JSON.stringify(publicationValide({ version: 4 }));
    const r = await POST(requete({ nonce, corps: autre }));
    expect(r.status).toBe(409);
    expect((await lire(r)).erreur).toBe("nonce_reutilise");
    expect(faux.videos).toHaveLength(1);
    expect(faux.videos[0]!.version).toBe(3);
  });

  it("même studioVideoId + même version + même contenu, nouveau nonce → 200 sans effet", async () => {
    const corps = JSON.stringify(publicationValide());
    await POST(requete({ corps }));
    const avant = faux.ecritures.filter((e) => e.startsWith("siteVideo.")).length;
    const r = await POST(requete({ corps }));
    expect(r.status).toBe(200);
    expect((await lire(r)).rejeu).toBe(true);
    expect(faux.ecritures.filter((e) => e.startsWith("siteVideo.")).length).toBe(avant);
  });

  it("version supérieure → mise à jour, date de publication INCHANGÉE, modifiee_le avance", async () => {
    await POST(requete());
    vi.setSystemTime((T0 + 100) * 1000);
    const v4 = JSON.stringify(
      publicationValide({
        version: 4,
        titre: "Automatiser ses relances clients, version retravaillée",
      }),
    );
    const r = await POST(requete({ corps: v4, horodatage: T0 + 100 }));
    expect(r.status).toBe(200);
    expect(faux.videos).toHaveLength(1);
    expect(faux.videos[0]!.version).toBe(4);
    expect(faux.videos[0]!.publieeLe).toEqual(new Date(T0 * 1000));
    expect(faux.videos[0]!.modifieeLe).toEqual(new Date((T0 + 100) * 1000));
  });

  it("version inférieure → 409 version_perimee", async () => {
    await POST(requete());
    const v2 = JSON.stringify(publicationValide({ version: 2 }));
    const r = await POST(requete({ corps: v2 }));
    expect(r.status).toBe(409);
    expect((await lire(r)).erreur).toBe("version_perimee");
    expect(faux.videos[0]!.version).toBe(3);
  });

  it("slug changé pour le même studioVideoId → 409 slug_immuable", async () => {
    await POST(requete());
    const autre = JSON.stringify(publicationValide({ version: 4, slug: "un-autre-slug" }));
    const r = await POST(requete({ corps: autre }));
    expect(r.status).toBe(409);
    expect((await lire(r)).erreur).toBe("slug_immuable");
  });

  it("slug déjà pris par une autre vidéo → 409 slug_deja_pris", async () => {
    await POST(requete());
    const autre = JSON.stringify(publicationValide({ studioVideoId: "vs_autrevideo01" }));
    const r = await POST(requete({ corps: autre }));
    expect(r.status).toBe(409);
    expect((await lire(r)).erreur).toBe("slug_deja_pris");
  });

  it("vidéo retirée : republier est refusé (video_retiree)", async () => {
    await POST(requete());
    const retrait = JSON.stringify({
      schemaVersion: 1,
      studioVideoId: "vs_01j9abcdefgh",
      motif: "obsolete",
    });
    await DELETE(requete({ methode: "DELETE", corps: retrait }));
    const v4 = JSON.stringify(publicationValide({ version: 4 }));
    const r = await POST(requete({ corps: v4 }));
    expect(r.status).toBe(409);
    expect((await lire(r)).erreur).toBe("video_retiree");
  });
});

describe("DELETE — retrait", () => {
  const retrait = JSON.stringify({
    schemaVersion: 1,
    studioVideoId: "vs_01j9abcdefgh",
    motif: "erreur",
  });

  it("retire : statut retiree, retireeLe posé, motif conservé", async () => {
    await POST(requete());
    const r = await DELETE(requete({ methode: "DELETE", corps: retrait }));
    expect(r.status).toBe(200);
    expect(await lire(r)).toMatchObject({ ok: true, statut: "retiree", rejeu: false });
    expect(faux.videos[0]!.statut).toBe("retiree");
    expect(faux.videos[0]!.retireeLe).toEqual(new Date(T0 * 1000));
    expect(faux.videos[0]!.motifRetrait).toBe("erreur");
  });

  it("retrait rejoué (nouveau nonce) → 200 rejeu:true, aucune écriture de vidéo", async () => {
    await POST(requete());
    await DELETE(requete({ methode: "DELETE", corps: retrait }));
    const avant = faux.ecritures.filter((e) => e.startsWith("siteVideo.")).length;
    const r = await DELETE(requete({ methode: "DELETE", corps: retrait }));
    expect(r.status).toBe(200);
    expect(await lire(r)).toMatchObject({ statut: "retiree", rejeu: true });
    expect(faux.ecritures.filter((e) => e.startsWith("siteVideo.")).length).toBe(avant);
  });

  it("vidéo inconnue → 404", async () => {
    const r = await DELETE(requete({ methode: "DELETE", corps: retrait }));
    expect(r.status).toBe(404);
  });

  it("motif inconnu → 422", async () => {
    const corps = JSON.stringify({
      schemaVersion: 1,
      studioVideoId: "vs_01j9abcdefgh",
      motif: "caprice",
    });
    expect((await DELETE(requete({ methode: "DELETE", corps }))).status).toBe(422);
  });

  it("DELETE sans drapeau → 503", async () => {
    vi.stubEnv("VIDEOS_SITE_ENABLED", "false");
    expect((await DELETE(requete({ methode: "DELETE", corps: retrait }))).status).toBe(503);
  });

  it("la signature d'un POST ne se rejoue pas en DELETE", async () => {
    const corps = retrait;
    const nonce = nonceNeuf();
    const signature = signerRequete({
      secret: SECRET,
      horodatage: String(T0),
      nonce,
      methode: "POST",
      chemin: CHEMIN,
      corps,
    });
    expect((await DELETE(requete({ methode: "DELETE", corps, nonce, signature }))).status).toBe(
      401,
    );
  });
});

describe("empreinte", () => {
  it("le journal garde l'empreinte du corps brut", async () => {
    const corps = JSON.stringify(publicationValide());
    await POST(requete({ corps }));
    expect(faux.journal[0]!.corpsSha256).toBe(sha256Hex(corps));
  });
});

describe("suite de la publication (cache, edge, IndexNow) — après la réponse", () => {
  const retrait = JSON.stringify({
    schemaVersion: 1,
    studioVideoId: "vs_01j9abcdefgh",
    motif: "obsolete",
  });
  const attendre = () => vi.advanceTimersByTimeAsync(10);

  it("publication nouvelle → planifiée une fois, avec slug, thème et série", async () => {
    await POST(requete());
    await attendre();
    expect(apresPublication).toHaveBeenCalledTimes(1);
    expect(apresPublication).toHaveBeenCalledWith({
      type: "publication",
      slug: "automatiser-ses-relances",
      theme: "automatisation",
      serieSlug: "gagner-du-temps",
    });
  });

  it("rejeu réseau (même nonce) et rejeu du fait (nouveau nonce) → RIEN de planifié", async () => {
    const corps = JSON.stringify(publicationValide());
    const nonce = nonceNeuf();
    await POST(requete({ corps, nonce }));
    await attendre();
    apresPublication.mockClear();
    await POST(requete({ corps, nonce }));
    await POST(requete({ corps }));
    await attendre();
    expect(apresPublication).not.toHaveBeenCalled();
  });

  it("refus (signature, schéma, contenu, fichier, version) → RIEN de planifié", async () => {
    await POST(requete({ secret: "x".repeat(40) }));
    await POST(requete({ corps: JSON.stringify({ ...publicationValide(), surprise: 1 }) }));
    verifierFichiers.mockResolvedValue({
      ok: false,
      fautes: [{ champ: "fichiers.video", raison: "http_404" }],
    });
    await POST(requete());
    await attendre();
    expect(apresPublication).not.toHaveBeenCalled();
  });

  it("retrait → planifié (type retrait) ; retrait rejoué → rien", async () => {
    await POST(requete());
    await attendre();
    apresPublication.mockClear();
    await DELETE(requete({ methode: "DELETE", corps: retrait }));
    await attendre();
    expect(apresPublication).toHaveBeenCalledWith({
      type: "retrait",
      slug: "automatiser-ses-relances",
      theme: "automatisation",
      serieSlug: "gagner-du-temps",
    });
    apresPublication.mockClear();
    await DELETE(requete({ methode: "DELETE", corps: retrait }));
    await attendre();
    expect(apresPublication).not.toHaveBeenCalled();
  });

  it("IndexNow en échec → le journal garde la réponse ENVOYÉE, le rejeu rend le même corps", async () => {
    apresPublication.mockResolvedValueOnce({ indexnow: "echec", erreurs: [] });
    const corps = JSON.stringify(publicationValide());
    const nonce = nonceNeuf();
    const premiere = await POST(requete({ corps, nonce }));
    const corpsEnvoye = await premiere.text();
    await attendre();
    const rejeu = await POST(requete({ corps, nonce }));
    expect(await rejeu.text()).toBe(corpsEnvoye);
    expect(JSON.stringify(faux.journal[0])).not.toMatch(/indexnow/);
  });
});
