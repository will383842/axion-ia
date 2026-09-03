// @vitest-environment node

/**
 * Les rappels d'entretien — ce qui empêche la boucle, et ce qui empêche le
 * silence.
 *
 * ## Les deux pannes possibles, opposées
 *
 * **La boucle.** Fenêtre de 15 min, cadence de 5 : chaque entretien est vu TROIS
 * fois. Sans marqueur d'idempotence, le candidat reçoit trois messages. Le
 * marqueur est donc la seule chose qui l'empêche — et il doit être posé
 * UNIQUEMENT sur un envoi réussi.
 *
 * **Le silence.** Poser le marqueur sur un envoi qui a échoué interdit le
 * rattrapage : le passage suivant ne verra plus le candidat, et personne ne
 * saura que le rappel n'est jamais parti. C'est le défaut `D5-1-C1` de ce
 * dépôt, et c'est le plus grave des deux — un doublon se voit, un silence non.
 *
 * ## Ce que ce fichier teste, et comment
 *
 * Sur un Prisma mocké : on contrôle ce que `enqueueEmail` rend, et on regarde
 * ce que la passe ÉCRIT. C'est le seul niveau où « le marqueur n'est pas posé
 * quand l'envoi échoue » s'observe — une base réelle ne dirait pas pourquoi.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/** Ce que la passe a lu, et ce qu'elle a écrit. */
const lectures: unknown[] = [];
const ecritures: unknown[] = [];
/** Ce que la mise en file rend — pilotable par cas. */
let miseEnFileRend: { enqueued: boolean } | Error = { enqueued: true };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobInterview: {
      findMany: vi.fn(async (args: unknown) => {
        lectures.push(args);
        return entretiensRendus;
      }),
      update: vi.fn(async (args: unknown) => {
        ecritures.push(args);
        return {};
      }),
    },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async () => {
    if (miseEnFileRend instanceof Error) throw miseEnFileRend;
    return miseEnFileRend;
  }),
}));

// Le déchiffrement est l'identité en test : ce fichier ne teste pas la crypto.
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => v,
  isDecryptedEmailUsable: (v: string) => typeof v === "string" && v.includes("@"),
}));

import {
  executerPassageEntretien,
  PASSAGES_ENTRETIEN,
  envoyerRappelsEntretien,
} from "../rappels-entretien";

const MAINTENANT = new Date("2026-09-10T09:00:00.000Z").getTime();

/** Ce que le mock rend — réécrit par chaque cas. */
let entretiensRendus: unknown[] = [];

function unEntretien(surcharge: Record<string, unknown> = {}) {
  return {
    id: "e1",
    scheduledAt: new Date(MAINTENANT + 61 * 60_000),
    durationMin: 30,
    mode: "visio",
    location: "https://meet.exemple.invalid/x",
    round: 1,
    application: {
      id: "a1",
      email: "candidat@exemple.invalid",
      firstName: "Sofia",
      offerTitleSnap: "Développeur web (F/H)",
      locale: "fr",
    },
    ...surcharge,
  };
}

const PASSAGE_H1 = PASSAGES_ENTRETIEN.find((p) => p.moment === "h1")!;
const PASSAGE_J1 = PASSAGES_ENTRETIEN.find((p) => p.moment === "j1")!;

beforeEach(() => {
  lectures.length = 0;
  ecritures.length = 0;
  entretiensRendus = [];
  miseEnFileRend = { enqueued: true };
});

describe("rappels d'entretien — fenêtres", () => {
  it("la fenêtre H-1 est TROIS fois la cadence — sinon un passage sauté perd le rappel", () => {
    // 🔑 Le rapport 15/5 n'est pas décoratif : c'est ce qui rend la passe
    // tolérante à un redémarrage. Une fenêtre égale à la cadence perdrait le
    // rappel au premier hoquet, en silence.
    const largeur = PASSAGE_H1.fenetre.maxMinutes - PASSAGE_H1.fenetre.minMinutes;
    expect(largeur).toBe(15);
    expect(PASSAGE_H1.fenetre.minMinutes).toBe(60);
  });

  it("la fenêtre J-1 vise bien 24 h, même largeur", () => {
    const largeur = PASSAGE_J1.fenetre.maxMinutes - PASSAGE_J1.fenetre.minMinutes;
    expect(largeur).toBe(15);
    expect(PASSAGE_J1.fenetre.minMinutes).toBe(1440);
  });

  it("🔴 les deux marqueurs sont DISTINCTS — un seul ferait taire le second", () => {
    // Avec un marqueur unique, le J-1 le poserait et le H-1 ne verrait plus
    // aucun candidat. Le rappel le plus utile des deux disparaîtrait.
    expect(PASSAGE_J1.marqueur).not.toBe(PASSAGE_H1.marqueur);
  });

  it("la lecture ne prend QUE les entretiens planifiés, dans la fenêtre, non rappelés", async () => {
    await executerPassageEntretien(PASSAGE_H1, MAINTENANT);
    const where = (lectures[0] as { where: Record<string, unknown> }).where;

    // Un entretien annulé, tenu ou dont le candidat ne s'est pas présenté n'a
    // rien à rappeler.
    expect(where["state"]).toBe("planifie");
    expect(where[PASSAGE_H1.marqueur]).toBeNull();

    const bornes = where["scheduledAt"] as { gte: Date; lt: Date };
    expect(bornes.gte.getTime()).toBe(MAINTENANT + 60 * 60_000);
    expect(bornes.lt.getTime()).toBe(MAINTENANT + 75 * 60_000);
  });
});

describe("rappels d'entretien — idempotence", () => {
  it("un envoi réussi POSE le marqueur", async () => {
    entretiensRendus = [unEntretien()];
    const r = await executerPassageEntretien(PASSAGE_H1, MAINTENANT);

    expect(r.envoyes).toBe(1);
    expect(r.echecs).toBe(0);
    expect(ecritures).toHaveLength(1);
    const ecriture = ecritures[0] as { where: { id: string }; data: Record<string, Date> };
    expect(ecriture.where.id).toBe("e1");
    expect(ecriture.data[PASSAGE_H1.marqueur]).toBeInstanceOf(Date);
  });

  it("🔴 une mise en file REFUSÉE ne pose PAS le marqueur", async () => {
    // Le cœur du défaut `D5-1-C1`. `enqueueEmail` ne lève pas : elle rend
    // `{ enqueued: false }`. Poser le marqueur dessus interdirait le rattrapage,
    // et le rappel ne partirait JAMAIS sans que personne ne le sache.
    entretiensRendus = [unEntretien()];
    miseEnFileRend = { enqueued: false };

    const r = await executerPassageEntretien(PASSAGE_H1, MAINTENANT);

    expect(r.envoyes).toBe(0);
    expect(r.echecs).toBe(1);
    expect(
      ecritures,
      "le marqueur a été posé alors que la mise en file a été refusée : " +
        "le rappel ne partira jamais et le passage suivant ne le verra plus",
    ).toHaveLength(0);
  });

  it("🔴 une mise en file qui LÈVE ne pose pas non plus le marqueur", async () => {
    entretiensRendus = [unEntretien()];
    miseEnFileRend = new Error("Redis indisponible");

    const r = await executerPassageEntretien(PASSAGE_H1, MAINTENANT);

    expect(r.echecs).toBe(1);
    expect(ecritures).toHaveLength(0);
  });

  it("🔴 une adresse illisible ne consomme pas le marqueur", async () => {
    // Clé de chiffrement absente ou désalignée : c'est un problème de
    // configuration. Poser le marqueur le rendrait irrattrapable après
    // correction — on perdrait le rappel pour une variable d'environnement.
    entretiensRendus = [
      unEntretien({ application: { ...unEntretien().application, email: "illisible" } }),
    ];

    const r = await executerPassageEntretien(PASSAGE_H1, MAINTENANT);

    expect(r.adressesIllisibles).toBe(1);
    expect(r.envoyes).toBe(0);
    expect(ecritures).toHaveLength(0);
  });
});

describe("rappels d'entretien — garde-fous", () => {
  it("le plafond borne l'emballement et le SIGNALE", async () => {
    // 🔑 Il ne protège pas d'un volume réel — il n'y a jamais cinquante
    // entretiens dans le même quart d'heure. Il protège du cas où le marqueur
    // cesserait d'être posé : la passe rejouerait la même liste toutes les cinq
    // minutes. Et `plafondAtteint` le rend VISIBLE au lieu de le taire.
    entretiensRendus = Array.from({ length: 51 }, (_, i) => unEntretien({ id: `e${i}` }));

    const r = await executerPassageEntretien(PASSAGE_H1, MAINTENANT);

    expect(r.plafondAtteint).toBe(true);
    expect(r.candidats).toBe(50);
  });

  it("les deux passages tournent, même si le premier ne trouve rien", async () => {
    // Témoin : un `for` qui sortirait au premier passage vide ferait taire le
    // H-1 chaque fois qu'aucun entretien n'est à J-1 — c'est-à-dire presque
    // toujours.
    entretiensRendus = [];
    const resultats = await envoyerRappelsEntretien(MAINTENANT);
    expect(resultats.map((r) => r.moment)).toEqual(["j1", "h1"]);
  });
});
