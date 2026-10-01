// @vitest-environment node

/**
 * R1 — AUCUN ACCÈS CROISÉ ENTRE CLIENTS (ADR 0063, D6).
 *
 * Tout geste sur un document passe par le TRIPLET (id, projetId, clientId) lu
 * dans l'URL ou le formulaire, revérifié en base. Un triplet faux répond
 * « introuvable » — jamais « interdit », qui confirmerait l'existence.
 *
 * Mutations qui rougissent : retirer `clientId` du `where` d'une lecture ou
 * d'un archivage ; ne pas vérifier le projet avant d'écrire (l'ajout part
 * alors dans le projet d'un autre client — ici la base en mémoire n'a pas la
 * clé composée, la vraie l'a : Gate D).
 * Contre-témoin : le bon triplet ajoute, archive, réaffiche et télécharge.
 */

import { describe, expect, it } from "vitest";

import { ajouterLien, ErreurDocument } from "../ajouter";
import { archiver, reafficher } from "../archiver";
import { telechargerDocument } from "../telecharger";
import { baseEnMemoire } from "./_base-en-memoire";

const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJET_A = "a0000000-0000-4000-8000-00000000000a";
const PROJET_B = "b0000000-0000-4000-8000-00000000000b";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const sain = async () => ({ issue: "sain" as const });

function scene() {
  const s = baseEnMemoire([
    { id: PROJET_A, clientId: CLIENT_A },
    { id: PROJET_B, clientId: CLIENT_B },
  ]);
  const octets = new TextEncoder().encode("%PDF-1.7 confidentiel B");
  const docB = s.poser(
    {
      clientId: CLIENT_B,
      projetId: PROJET_B,
      fichierNom: "devis-b.pdf",
      fichierFormat: "pdf",
      fichierTailleOctets: octets.length,
      analyseAntivirus: "sain",
      analyseLe: new Date(),
    },
    octets,
  );
  return { ...s, docB };
}

describe("un document d'un autre client est introuvable", () => {
  it("ajouter dans le projet d'un autre client est refusé AVANT toute écriture", async () => {
    const { db, compteurs, etat } = scene();
    const e = await ajouterLien(db as never, {
      clientId: CLIENT_A,
      projetId: PROJET_B,
      cote: "interne",
      nature: null,
      titre: "Intrus",
      envoyeLe: null,
      parAdminId: ADMIN,
      lien: "https://axion-ia.com/x",
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurDocument);
    expect((e as Error).message).toBe("Ce projet n'appartient pas à ce client.");
    expect(compteurs.ecritures).toBe(0);
    expect(etat.documents).toHaveLength(1);
  });

  it("archiver ou réafficher par un triplet faux répond « introuvable » et n'écrit rien", async () => {
    const { db, compteurs, docB } = scene();
    for (const triplet of [
      { id: docB.id, projetId: PROJET_A, clientId: CLIENT_A },
      { id: docB.id, projetId: PROJET_B, clientId: CLIENT_A },
      { id: docB.id, projetId: PROJET_A, clientId: CLIENT_B },
    ]) {
      await expect(archiver(db as never, { ...triplet, parAdminId: ADMIN })).rejects.toThrow(
        /n'a pas pu être archivé/,
      );
      await expect(reafficher(db as never, { ...triplet, parAdminId: ADMIN })).rejects.toThrow(
        /n'a pas pu être réaffiché/,
      );
    }
    expect(docB.archiveLe).toBeNull();
    expect(compteurs.ecritures).toBe(0);
  });

  it("télécharger par un triplet faux répond « introuvable » sans lire les octets", async () => {
    const { db, compteurs, docB } = scene();
    const r = await telechargerDocument(
      db as never,
      { id: docB.id, projetId: PROJET_B, clientId: CLIENT_A, parAdminId: ADMIN },
      sain,
    );
    expect(r).toEqual({ issue: "introuvable" });
    expect(compteurs.lecturesContenu).toBe(0);
  });

  it("contre-témoin : le bon triplet ajoute, archive, réaffiche et télécharge", async () => {
    const { db, etat, docB } = scene();
    const ajoute = await ajouterLien(db as never, {
      clientId: CLIENT_A,
      projetId: PROJET_A,
      cote: "envoye_au_client",
      nature: null,
      titre: "",
      envoyeLe: "2026-09-30",
      parAdminId: ADMIN,
      lien: "https://axion-ia.com/fr/exemples/console-exemple",
    });
    const doc = etat.documents.find((d) => d.id === ajoute.id);
    expect(doc).toMatchObject({
      clientId: CLIENT_A,
      projetId: PROJET_A,
      nature: "page_en_ligne",
      titre: "axion-ia.com/…/console-exemple",
    });
    expect(doc?.envoyeLe?.toISOString()).toBe("2026-09-30T00:00:00.000Z");

    const t = { id: docB.id, projetId: PROJET_B, clientId: CLIENT_B, parAdminId: ADMIN };
    await archiver(db as never, t);
    expect(docB.archiveLe).toBeInstanceOf(Date);
    expect(docB.archiveParId).toBe(ADMIN);
    await reafficher(db as never, t);
    expect(docB.archiveLe).toBeNull();
    const r = await telechargerDocument(db as never, t, sain);
    expect(r.issue).toBe("servi");
  });
});
