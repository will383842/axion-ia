// @vitest-environment node

/**
 * R10 — LE LIEN PUBLIC N'OUVRE QUE SA PAGE (ADR 0063, D12).
 *
 * `jeton = base64url(HMAC-SHA256(SHA-256("axion-document-projet|" + AUTH_SECRET),
 * "document-projet:v1:" + id))`. Rien n'est stocké. Forme et jeton sont
 * vérifiés AVANT la base : un jeton faux ne coûte aucune requête.
 *
 * Mutations qui rougissent : réutiliser la clé du questionnaire (ADR 0062) —
 * son jeton ouvrirait alors le document de même identifiant ; lire la base
 * avant de vérifier le jeton ; une clé de développement connue en production.
 * Contre-témoin : le bon jeton ouvre la page.
 */

import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cheminDocument, jetonDocument, jetonDocumentValide } from "../jeton";
import { lirePagePublique } from "../page-publique";
import { baseEnMemoire } from "./_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const HTML = new TextEncoder().encode("<!doctype html><p>Programme</p>");

/** Le jeton qu'émettrait le questionnaire en ligne (ADR 0062) pour le même identifiant. */
function jetonQuestionnaire(id: string, secret: string): string {
  const k = createHash("sha256").update(`axion-questionnaire-cadrage|${secret}`).digest();
  return createHmac("sha256", k).update(`questionnaire-cadrage:v1:${id}`).digest("base64url");
}

function scene() {
  const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
  const doc = s.poser(
    {
      clientId: CLIENT,
      projetId: PROJET,
      cote: "envoye_au_client",
      nature: "page_en_ligne",
      envoyeLe: new Date("2026-09-30T00:00:00Z"),
      fichierNom: "programme.html",
      fichierFormat: "html",
      fichierTailleOctets: HTML.length,
      analyseAntivirus: "sain",
      analyseLe: new Date(),
    },
    HTML,
  );
  const autre = s.poser({ ...doc, id: "99999999-9999-4999-8999-999999999999" }, HTML);
  return { ...s, doc, autre };
}

const GET = (id: string, jeton: string) => ({
  id,
  jeton,
  methode: "GET" as const,
  entetes: new Headers(),
});

describe("le lien public n'ouvre que sa page", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("le jeton est un HMAC base64url de 43 caractères, stable, propre à chaque document", () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    const { doc, autre } = scene();
    const j = jetonDocument(doc.id);
    expect(j).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(jetonDocument(doc.id)).toBe(j);
    expect(jetonDocument(autre.id)).not.toBe(j);
    expect(cheminDocument(doc.id)).toBe(`/document/${doc.id}/${j}`);
  });

  it("le jeton d'un AUTRE document, ou une forme invalide → 404 sans aucune requête", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    const { db, compteurs, doc, autre } = scene();
    for (const jeton of [
      jetonDocument(autre.id)!,
      "court",
      `${jetonDocument(doc.id)!}x`,
      "!".repeat(43),
    ]) {
      expect(await lirePagePublique(db as never, GET(doc.id, jeton))).toBeNull();
    }
    expect(
      await lirePagePublique(db as never, GET("pas-un-uuid", jetonDocument(doc.id)!)),
    ).toBeNull();
    expect(compteurs.requetes).toBe(0);
  });

  it("le jeton du QUESTIONNAIRE pour le même identifiant n'ouvre rien (séparation de domaine)", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    const { db, compteurs, doc } = scene();
    const jq = jetonQuestionnaire(doc.id, "secret-de-test");
    expect(jetonDocumentValide(doc.id, jq)).toBe(false);
    expect(await lirePagePublique(db as never, GET(doc.id, jq))).toBeNull();
    expect(compteurs.requetes).toBe(0);
  });

  it("une rotation d'AUTH_SECRET éteint tous les liens", async () => {
    vi.stubEnv("AUTH_SECRET", "ancien-secret");
    const { db, doc } = scene();
    const ancien = jetonDocument(doc.id)!;
    vi.stubEnv("AUTH_SECRET", "nouveau-secret");
    expect(await lirePagePublique(db as never, GET(doc.id, ancien))).toBeNull();
  });

  it("production sans AUTH_SECRET : aucun lien fabriqué, aucun lien valide", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const { doc } = scene();
    expect(jetonDocument(doc.id)).toBeNull();
    expect(cheminDocument(doc.id)).toBeNull();
    vi.stubEnv("NODE_ENV", "test");
    const jetonDev = jetonDocument(doc.id)!;
    vi.stubEnv("NODE_ENV", "production");
    expect(jetonDocumentValide(doc.id, jetonDev)).toBe(false);
  });

  it("la base factice du build (stub.invalid) répond 404 d'elle-même", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    const { db, compteurs, doc } = scene();
    expect(await lirePagePublique(db as never, GET(doc.id, jetonDocument(doc.id)!))).toBeNull();
    expect(compteurs.requetes).toBe(0);
  });

  it("contre-témoin : le bon jeton ouvre la page, octet pour octet", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-de-test");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/axion");
    const { db, doc } = scene();
    const page = await lirePagePublique(db as never, GET(doc.id, jetonDocument(doc.id)!));
    expect(page).not.toBeNull();
    expect(Array.from(page!)).toEqual(Array.from(HTML));
  });
});
