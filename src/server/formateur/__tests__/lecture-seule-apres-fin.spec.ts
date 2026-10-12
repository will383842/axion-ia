/**
 * Lot E (M14) — après une fin de collaboration, l'espace formateur reste ouvert EN
 * LECTURE SEULE (honoraires et dossier), et la version d'accès (`accesVersion`) est
 * vérifiée par la session de l'espace.
 *
 *  - une session porte la version d'accès de la fiche ; la clôture l'incrémente, donc
 *    toute session ouverte avant la fin tombe ;
 *  - une session ancienne, sans version, ne vaut plus rien une fois la fin close ;
 *  - un formateur indépendant dont la collaboration est close peut se reconnecter, en
 *    lecture seule, si l'interrupteur `formateurs.fin_collaboration` est allumé ;
 *  - un salarié désactivé : rien ne change (aucun accès).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-lot-e-0123456789abcdef";
});

const db = vi.hoisted(() => ({ trainer: { findUnique: vi.fn() } }));
const jeton = vi.hoisted(() => ({ valeur: null as string | null }));
const allume = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/formateur/cookie", () => ({ getFormateurToken: async () => jeton.valeur }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: allume,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { signFormateurSession, verifyFormateurSession } from "@/lib/formateur-session";
import {
  getFormateurSession,
  getFormateurSessionLecture,
  requireFormateur,
} from "@/server/formateur/guard";

const ID = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";

const fiche = (over: Record<string, unknown> = {}) => ({
  id: ID,
  nom: "Martin",
  prenom: "Camille",
  email: "camille@example.test",
  actif: true,
  statut: "sous_traitant",
  accesVersion: 3,
  finCollaborationAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  jeton.valeur = null;
  allume.mockResolvedValue(true);
});

describe("jeton de session : la version d'accès", () => {
  it("la version signée est rendue à la vérification ; sans version, rien", async () => {
    const avec = await signFormateurSession(ID, "formateur", undefined, 3);
    const v = await verifyFormateurSession(avec, "formateur");
    expect(v).toEqual({ ok: true, trainerId: ID, version: 3 });
    const sans = await signFormateurSession(ID, "formateur");
    expect(await verifyFormateurSession(sans, "formateur")).toEqual({ ok: true, trainerId: ID });
  });
});

describe("getFormateurSession (accès complet)", () => {
  it("même version : la session vaut", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(fiche());
    expect((await getFormateurSession())?.trainerId).toBe(ID);
  });

  it("version dépassée (la clôture l'a incrémentée) : plus de session", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 2);
    db.trainer.findUnique.mockResolvedValue(fiche());
    expect(await getFormateurSession()).toBeNull();
  });

  it("session ancienne sans version : vaut tant que la collaboration n'est pas close", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur");
    db.trainer.findUnique.mockResolvedValue(fiche());
    expect((await getFormateurSession())?.trainerId).toBe(ID);
    db.trainer.findUnique.mockResolvedValue(fiche({ finCollaborationAt: new Date() }));
    expect(await getFormateurSession()).toBeNull();
  });

  it("collaboration close, même version et même active : jamais d'accès complet", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(fiche({ finCollaborationAt: new Date() }));
    expect(await getFormateurSession()).toBeNull();
  });
});

describe("getFormateurSessionLecture (après la fin)", () => {
  const close = { actif: false, finCollaborationAt: new Date("2026-10-01T00:00:00Z") };

  it("fiche active : accès complet, pas de lecture seule", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(fiche());
    expect(await getFormateurSessionLecture()).toMatchObject({
      trainerId: ID,
      lectureSeule: false,
    });
  });

  it("indépendant, collaboration close, interrupteur allumé : lecture seule", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(fiche(close));
    expect(await getFormateurSessionLecture()).toMatchObject({
      trainerId: ID,
      lectureSeule: true,
      finCollaborationAt: close.finCollaborationAt,
    });
  });

  it("interrupteur coupé : aucun accès (comportement d'avant)", async () => {
    allume.mockResolvedValue(false);
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(fiche(close));
    expect(await getFormateurSessionLecture()).toBeNull();
  });

  it("session ouverte avant la fin (version dépassée ou absente) : aucun accès", async () => {
    db.trainer.findUnique.mockResolvedValue(fiche(close));
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 2);
    expect(await getFormateurSessionLecture()).toBeNull();
    jeton.valeur = await signFormateurSession(ID, "formateur");
    expect(await getFormateurSessionLecture()).toBeNull();
  });

  it("salarié désactivé : aucun accès", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(
      fiche({ statut: "salarie", actif: false, finCollaborationAt: null }),
    );
    expect(await getFormateurSessionLecture()).toBeNull();
  });

  it("une page à accès complet renvoie la lecture seule vers « Mes honoraires »", async () => {
    jeton.valeur = await signFormateurSession(ID, "formateur", undefined, 3);
    db.trainer.findUnique.mockResolvedValue(fiche(close));
    await expect(requireFormateur()).rejects.toThrow("REDIRECT:/fr/espace-formateur/remuneration");
  });

  it("sans session du tout : la page de connexion, comme avant", async () => {
    await expect(requireFormateur()).rejects.toThrow("REDIRECT:/fr/espace-formateur/connexion");
  });
});
