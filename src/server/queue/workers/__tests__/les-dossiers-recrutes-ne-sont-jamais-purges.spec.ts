/**
 * 🛑 LE DOSSIER D'UNE PERSONNE RECRUTÉE N'EST JAMAIS PURGÉ AUTOMATIQUEMENT.
 *
 * **Décision du responsable de traitement, 2026-09-03 (D4)** : la candidature
 * d'une personne entrée dans la société devient une pièce de son dossier du
 * personnel. Elle se conserve le temps de la relation de travail, et sa
 * suppression est un **geste explicite** — jamais une horloge.
 *
 * ## Le défaut que ce fichier ferme
 *
 * La purge des candidatures (2026-08-13) filtrait sur la SEULE date de dépôt :
 *
 * ```ts
 * where: { submittedAt: { lt: monthsAgo(candidaturesMois) } }
 * ```
 *
 * Aucune exclusion de statut. Vingt-quatre mois après avoir postulé, le dossier
 * d'un salarié **toujours en poste** partait avec ceux des refusés — CV et photo
 * compris, effacés du disque avant la ligne. Personne n'aurait été prévenu : la
 * passe quotidienne ne distingue pas ce qu'elle épargne de ce qu'elle n'a jamais
 * vu.
 *
 * Les 24 mois restent la règle pour les candidatures NON retenues : c'est la
 * recommandation CNIL, elle n'est pas touchée ici.
 *
 * ## Pourquoi un test de COMPORTEMENT, et à ce niveau-là
 *
 * Le verrou voisin `prospection-aucune-purge-automatique.spec.ts` lit la source,
 * parce qu'il garde une ABSENCE — et une absence ne s'observe pas à l'exécution.
 * Ici on garde le contraire : une clause `where` précise. La lire dans le texte
 * prouverait qu'elle est écrite, jamais qu'elle est **appliquée**. On exécute
 * donc la purge sur un Prisma mocké et on inspecte les arguments réellement
 * passés — même harnais que `retention-preuve-envoi.spec.ts`.
 *
 * ⚠️ On ne joue PAS cette purge sur une vraie base : `executerPurgeRetention`
 * efface une quinzaine de tables. La lancer sur la base de développement
 * partagée détruirait les fixtures des autres sessions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/** Arguments réellement passés, par modèle et par méthode. */
const appelsParModele = new Map<string, { findMany: unknown[]; deleteMany: unknown[] }>();

function journal(modele: string) {
  if (!appelsParModele.has(modele)) {
    appelsParModele.set(modele, { findMany: [], deleteMany: [] });
  }
  return appelsParModele.get(modele)!;
}

function enregistrer(modele: string) {
  return {
    findMany: vi.fn(async (args: unknown) => {
      journal(modele).findMany.push(args);
      // Aucune ligne rendue : le worker ne doit rien supprimer par ricochet, et
      // ce test ne juge pas ce qu'il ferait d'une ligne — il juge ce qu'il
      // DEMANDE à la base.
      return [];
    }),
    deleteMany: vi.fn(async (args: unknown) => {
      journal(modele).deleteMany.push(args);
      return { count: 0 };
    }),
    delete: vi.fn(async () => ({})),
    count: vi.fn(async () => 0),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async () => ({})),
  };
}

vi.mock("@/lib/prisma", () => {
  const cache = new Map<string, ReturnType<typeof enregistrer>>();
  return {
    prisma: new Proxy(
      {},
      {
        get(_cible, modele: string) {
          if (!cache.has(modele)) cache.set(modele, enregistrer(modele));
          return cache.get(modele);
        },
      },
    ),
  };
});

vi.mock("@/server/careers/cv-storage", () => ({ deleteCv: vi.fn(async () => undefined) }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

import { executerPurgeRetention } from "../retention-purge-worker";

/** Nombre de mois entre `date` et maintenant, arrondi au plus proche. */
function moisEcoules(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / 86_400_000 / 30.44);
}

interface ClauseCandidature {
  where?: {
    submittedAt?: { lt?: Date };
    status?: { notIn?: readonly string[]; in?: readonly string[]; equals?: string } | string;
  };
}

function lecturesCandidatures(): ClauseCandidature[] {
  return (appelsParModele.get("jobApplication")?.findMany ?? []) as ClauseCandidature[];
}

/**
 * Tous les statuts qu'une clause DÉSIGNE comme purgeables — c'est-à-dire ceux
 * qu'elle inclut, jamais ceux qu'elle exclut.
 *
 * 🔑 Sans cette distinction, `{ status: { notIn: ["hired"] } }` et
 * `{ status: { in: ["hired"] } }` se ressemblent : les deux « contiennent »
 * le mot. C'est exactement la confusion qu'un test naïf laisserait passer.
 */
function statutsDesignes(clause: ClauseCandidature): string[] {
  const s = clause.where?.status;
  if (s == null) return ["*"]; // aucun filtre de statut : la clause les désigne TOUS
  if (typeof s === "string") return [s];
  if (s.equals) return [s.equals];
  if (s.in) return [...s.in];
  return []; // `notIn` seul : la clause n'en désigne aucun nommément
}

describe("🛑 candidatures — le dossier d'une personne recrutée survit à la purge", () => {
  beforeEach(async () => {
    appelsParModele.clear();
    // Aucune surcharge d'environnement : on mesure les DÉFAUTS, qui sont ce qui
    // s'applique en production tant que personne n'a posé de variable.
    delete process.env["RETENTION_CANDIDATURES_MONTHS"];
    await executerPurgeRetention();
  });

  it("la purge des candidatures a bien tourné — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Si le bloc candidatures disparaissait du worker,
    // tous les cas ci-dessous passeraient au vert en ne regardant rien, et
    // l'absence d'alerte se lirait comme une absence de problème.
    expect(
      lecturesCandidatures().length,
      "aucune lecture de `jobApplication` : le bloc de purge des candidatures " +
        "a-t-il été supprimé ou renommé ?",
    ).toBeGreaterThan(0);
  });

  it("🔴 aucune clause de purge ne désigne le statut `hired`", () => {
    const fautives = lecturesCandidatures().filter((c) => {
      const designes = statutsDesignes(c);
      return designes.includes("hired") || designes.includes("*");
    });

    expect(
      fautives,
      "La purge peut emporter le dossier d'une personne RECRUTÉE. C'est interdit " +
        "par décision du responsable de traitement (D4, 2026-09-03) : ce dossier " +
        "devient une pièce du dossier du personnel et ne s'efface qu'à la main, " +
        "par le bouton réservé au super-administrateur. Une clause SANS filtre de " +
        "statut les désigne tous — c'est le défaut d'origine.",
    ).toEqual([]);
  });

  it("🔴 l'exclusion porte sur le STATUT, pas sur un délai plus long", () => {
    // 🔑 Le témoin qui distingue une vraie exclusion d'un simple sursis. Poser
    // « les recrutés à 120 mois » passerait le cas précédent tant que la clause
    // ne les désigne pas nommément — mais les effacerait dix ans plus tard,
    // c'est-à-dire pendant la carrière de la personne. On exige donc qu'AUCUNE
    // clause ne borne les recrutés par une date, quelle qu'elle soit.
    const avecStatut = lecturesCandidatures().filter((c) => c.where?.status != null);
    expect(
      avecStatut.length,
      "aucune clause ne filtre par statut : l'exclusion n'existe pas",
    ).toBeGreaterThan(0);

    for (const clause of avecStatut) {
      const s = clause.where!.status;
      expect(
        typeof s === "object" && Array.isArray(s?.notIn) && s.notIn.includes("hired"),
        "l'exclusion des recrutés doit s'écrire `status: { notIn: [\"hired\"] }` — " +
          "toute autre forme (délai propre, second passage, `in` élargi) les " +
          "efface tôt ou tard",
      ).toBe(true);
    }
  });

  it("les candidatures NON retenues restent purgées à 24 mois — la CNIL est inchangée", () => {
    // 🔑 Témoin négatif. Sans lui, supprimer purement et simplement le bloc de
    // purge ferait passer les deux cas ci-dessus : on prouverait l'obéissance
    // par la conservation sans limite, ce qui est l'autre non-conformité.
    const bornees = lecturesCandidatures().filter((c) => c.where?.submittedAt?.lt != null);
    expect(bornees.length, "la purge des refus doit rester bornée dans le temps").toBeGreaterThan(
      0,
    );
    expect(moisEcoules(bornees[0]!.where!.submittedAt!.lt!)).toBe(24);
  });
});
