// @vitest-environment node
import { describe, expect, it } from "vitest";

import { baseEnMemoire } from "@/features/dossier-client/documents/__tests__/_base-en-memoire";
import {
  compteDepuisNom,
  enregistrerNotes,
  TITRE_NOTES,
  validerNotes,
} from "@/features/site-audit/notes";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

const sain = async () => ({ issue: "sain" }) as never;
const hors = async () => ({ issue: "indisponible" }) as never;
const note = { t: "x", d: "2026-11-04T10:00:00.000Z" };

function cles(n: number): Record<string, object> {
  const o: Record<string, object> = {};
  for (let i = 0; i < n; i++) o[`audit-oury-q3-abc-${i}`] = note;
  return o;
}

function monter() {
  return baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
}

function entree(base: string | null, notes: Record<string, object>) {
  return { clientId: CLIENT, projetId: PROJET, base, notes, parAdminId: ADMIN };
}

describe("validerNotes", () => {
  it("refuse vide, clé hors motif, valeur non objet, 3001 clés", () => {
    expect(validerNotes({ notes: {} }).ok).toBe(false);
    expect(validerNotes({}).ok).toBe(false);
    expect(validerNotes({ notes: { "autre-cle": {} } }).ok).toBe(false);
    expect(validerNotes({ notes: { "audit-oury-q3-abc-1": "texte" } }).ok).toBe(false);
    expect(validerNotes({ notes: cles(3001) }).ok).toBe(false);
  });
  it("accepte des clés conformes", () => {
    expect(validerNotes({ notes: cles(3) }).ok).toBe(true);
  });
});

describe("compteDepuisNom", () => {
  it("lit le nombre de clés", () => {
    expect(compteDepuisNom("site-audit-notes-12.txt")).toBe(12);
    expect(compteDepuisNom("autre.txt")).toBeNull();
    expect(compteDepuisNom(null)).toBeNull();
  });
});

describe("les notes ne reculent jamais", () => {
  it("nominal : document txt interne, ancienne version archivée, deux événements", async () => {
    const s = monter();
    const r1 = await enregistrerNotes(s.db, entree(null, cles(2)), sain);
    expect(r1.issue).toBe("ok");
    const v1 = (r1 as { version: string }).version;
    const r2 = await enregistrerNotes(s.db, entree(v1, cles(3)), sain);
    expect(r2.issue).toBe("ok");
    const docs = s.etat.documents.filter((d) => d.titre === TITRE_NOTES);
    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.cote === "interne" && d.fichierFormat === "txt")).toBe(true);
    expect(docs[0]!.fichierNom).toBe("site-audit-notes-2.txt");
    expect(docs[0]!.archiveLe).not.toBeNull();
    expect(docs[1]!.archiveLe).toBeNull();
    const actions = s.etat.evenements.map((e) => e.action);
    expect(actions.filter((a) => a === "document_ajoute")).toHaveLength(2);
    expect(actions.filter((a) => a === "document_archive")).toHaveLength(1);
  });

  it("base périmée → conflit, rien d'écrit", async () => {
    const s = monter();
    const r1 = await enregistrerNotes(s.db, entree(null, cles(2)), sain);
    const avant = s.etat.documents.length;
    const r = await enregistrerNotes(s.db, entree(null, cles(5)), sain);
    expect(r).toEqual({ issue: "conflit", version: (r1 as { version: string }).version });
    expect(s.etat.documents).toHaveLength(avant);
  });

  it("moins de clés que la dernière version → refus", async () => {
    const s = monter();
    const r1 = (await enregistrerNotes(s.db, entree(null, cles(5)), sain)) as { version: string };
    const r = await enregistrerNotes(s.db, entree(r1.version, cles(4)), sain);
    expect(r.issue).toBe("moins");
    expect(s.etat.documents).toHaveLength(1);
  });

  it("antivirus indisponible → rien d'écrit", async () => {
    const s = monter();
    const r = await enregistrerNotes(s.db, entree(null, cles(2)), hors);
    expect(r.issue).toBe("antivirus");
    expect(s.etat.documents).toHaveLength(0);
    expect(s.etat.evenements).toHaveLength(0);
  });
});
