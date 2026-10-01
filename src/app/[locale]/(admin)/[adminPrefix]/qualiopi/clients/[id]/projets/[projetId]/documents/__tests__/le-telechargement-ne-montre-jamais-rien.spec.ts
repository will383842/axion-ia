// @vitest-environment node

/**
 * R2 — LE TÉLÉCHARGEMENT NE MONTRE JAMAIS RIEN (ADR 0063, D7).
 *
 * Un HTML ou un e-mail déposé ne doit jamais s'exécuter dans la console. Pour
 * CHACUN des onze formats, la route admin répond en pièce jointe, en type
 * neutre, sans reniflage, sous bac à sable, sans cache. Le nom de fichier ne
 * peut pas casser l'en-tête (guillemets, retour chariot).
 *
 * Et la garde est celle du dossier client (R7) : sans session 401, rôle hors
 * de la liste A2 403, triplet faux 404 (jamais 403 : ne pas confirmer qu'il existe).
 *
 * Mutations qui rougissent : servir le type réel pour les PDF « par confort »
 * (`inline`) ; oublier `nosniff` ; recopier le nom brut dans l'en-tête.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { baseEnMemoire } from "@/features/dossier-client/documents/__tests__/_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

const etat = vi.hoisted(() => ({
  session: null as unknown,
  base: null as unknown,
}));

vi.mock("@/auth", () => ({ auth: async () => etat.session }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return etat.base;
  },
}));
vi.mock("@/server/careers/clamav", () => ({
  analyserOctets: async () => ({ issue: "sain" }),
}));

import { GET } from "../[documentId]/route";
import { FORMATS } from "@/features/dossier-client/documents/formats";
import { entetesTelechargement } from "@/features/dossier-client/documents/telecharger";

const ATTENDU = {
  "content-type": "application/octet-stream",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex",
};

function appeler(id: string, projetId = PROJET, clientId = CLIENT) {
  return GET(new Request("https://axion-ia.com/x"), {
    params: Promise.resolve({
      locale: "fr",
      adminPrefix: "admin-x",
      id: clientId,
      projetId,
      documentId: id,
    }),
  });
}

describe("le téléchargement ne montre jamais rien", () => {
  beforeEach(() => {
    etat.session = { user: { id: ADMIN, role: "admin" } };
  });

  it.each(Object.keys(FORMATS))(
    "format %s : pièce jointe, type neutre, nosniff, bac à sable, sans cache",
    async (format) => {
      const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
      etat.base = s.db;
      const octets = new TextEncoder().encode("<script>alert(1)</script>");
      const doc = s.poser(
        {
          clientId: CLIENT,
          projetId: PROJET,
          fichierNom: `piece.${FORMATS[format as keyof typeof FORMATS].extensions[0]}`,
          fichierFormat: format,
          fichierTailleOctets: octets.length,
          analyseAntivirus: "sain",
          analyseLe: new Date(),
        },
        octets,
      );
      const r = await appeler(doc.id);
      expect(r.status).toBe(200);
      for (const [cle, valeur] of Object.entries(ATTENDU)) {
        expect(r.headers.get(cle), cle).toBe(valeur);
      }
      expect(r.headers.get("content-disposition")).toMatch(
        /^attachment; filename="piece\.\w+"; filename\*=UTF-8''piece\.\w+$/,
      );
      expect(r.headers.get("content-length")).toBe(String(octets.length));
      expect(new Uint8Array(await r.arrayBuffer())).toEqual(octets);
    },
  );

  it("un nom à guillemets, retour chariot ou accents ne casse pas l'en-tête", () => {
    const e = entetesTelechargement('Devis "final"\r\nSet-Cookie: x=1 — été.pdf', 10);
    const cd = e["Content-Disposition"]!;
    expect(cd).not.toMatch(/[\r\n]/);
    const ascii = /filename="([^"]*)"/.exec(cd)?.[1];
    expect(ascii).toBeDefined();
    expect(ascii).not.toContain('"');
    expect(cd).toContain("filename*=UTF-8''Devis%20%22final%22");
    expect(cd).toContain("%C3%A9t%C3%A9.pdf");
    expect(e["Content-Type"]).toBe("application/octet-stream");
  });

  it("sans session → 401 ; rôle hors de la liste A2 → 403 ; aucun octet lu", async () => {
    const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    etat.base = s.db;
    const doc = s.poser({ clientId: CLIENT, projetId: PROJET, fichierFormat: "pdf" });
    etat.session = null;
    expect((await appeler(doc.id)).status).toBe(401);
    etat.session = { user: { id: ADMIN, role: "reader" } };
    expect((await appeler(doc.id)).status).toBe(403);
    expect(s.compteurs.requetes).toBe(0);
  });

  it("un triplet faux ou un identifiant mal formé → 404, jamais 403", async () => {
    const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    etat.base = s.db;
    const doc = s.poser({ clientId: CLIENT, projetId: PROJET, fichierFormat: "pdf" });
    expect((await appeler(doc.id, PROJET, "44444444-4444-4444-8444-444444444444")).status).toBe(
      404,
    );
    expect((await appeler("pas-un-uuid")).status).toBe(404);
  });
});
