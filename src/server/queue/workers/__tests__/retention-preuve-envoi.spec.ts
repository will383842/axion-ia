/**
 * `D5-5-04` + `D5-5-05` — une preuve ne doit pas mourir avant ce qu'elle prouve.
 *
 * ## Les deux défauts fermés ici
 *
 * **`D5-5-04`** — les `EmailLog` transactionnels étaient purgés à **36 mois**,
 * alors que la pièce dont ils sont la preuve d'envoi est conservée
 * `DOCUMENT_RETENTION_YEARS` = **5 ans** (art. L.6353-9 C. trav.). Passé trois
 * ans, `convocationEnvoyeeAt` continuait d'affirmer « envoyée » et plus rien ne
 * le prouvait — c'est précisément la pièce qu'un auditeur réclame.
 *
 * **`D5-5-05`** — la purge des `activity_logs` à 12 mois n'avait **aucun filtre
 * d'action** et emportait les traces `gdpr.erase.completed` /
 * `gdpr.export.delivered`. Or `api/gdpr-erase/route.ts` déclare en tête :
 * « ActivityLog : conservé (immuable, art. 30 RGPD register) ». Deux textes du
 * même dépôt se contredisaient, et c'est le silencieux qui gagnait.
 *
 * ## Pourquoi un test de COMPORTEMENT et pas un test statique
 *
 * Le verrou voisin (`prospection-aucune-purge-automatique.spec.ts`) lit la
 * source, parce qu'il garde une ABSENCE — et une absence ne s'observe pas à
 * l'exécution. Ici on garde le contraire : des clauses `where` précises. Les
 * lire dans le texte prouverait qu'elles sont écrites, jamais qu'elles sont
 * **appliquées**. On exécute donc la purge sur un Prisma mocké et on inspecte
 * les arguments réellement passés.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteManyCalls = new Map<string, unknown[]>();

function enregistrer(modele: string) {
  return {
    deleteMany: vi.fn(async (args: unknown) => {
      const liste = deleteManyCalls.get(modele) ?? [];
      liste.push(args);
      deleteManyCalls.set(modele, liste);
      return { count: 0 };
    }),
    findMany: vi.fn(async () => []),
    delete: vi.fn(async () => ({})),
    // 🔴 2026-09-03 — ce mock ne connaissait que trois méthodes, et le worker en
    // gagne au fil des lots. `D4` a ajouté un `count` d'observation sur les
    // candidatures : ce fichier a rougi sur `prisma.jobApplication.count is not
    // a function`, alors qu'il ne parle ni de candidatures ni de comptage.
    //
    // 🔑 Un mock incomplet ne fait pas échouer ce qu'il teste : il fait échouer
    // le PROCHAIN qui touche au worker, sur un message qui n'a rien à voir avec
    // son sujet. On complète le harnais plutôt que de contraindre le worker à
    // n'utiliser que trois verbes. Aucune assertion de ce fichier ne porte sur
    // `count` — il rend zéro et n'enregistre rien.
    count: vi.fn(async () => 0),
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
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";

/** Nombre de mois entre `date` et maintenant, arrondi au plus proche. */
function moisEcoules(date: Date): number {
  const jours = (Date.now() - date.getTime()) / 86_400_000;
  return Math.round(jours / 30.44);
}

type ClauseWhere = {
  where?: {
    createdAt?: { lt?: Date };
    action?: { startsWith?: string };
    NOT?: { action?: { startsWith?: string } };
    marketing?: boolean;
  };
};

function appels(modele: string): ClauseWhere[] {
  return (deleteManyCalls.get(modele) ?? []) as ClauseWhere[];
}

describe("purge de rétention — la preuve ne meurt pas avant ce qu'elle prouve", () => {
  beforeEach(async () => {
    deleteManyCalls.clear();
    // Aucune variable d'environnement : on mesure les DÉFAUTS, qui sont ce qui
    // s'applique en production tant que personne n'a posé de surcharge.
    delete process.env["RETENTION_EMAIL_LOGS_MONTHS"];
    delete process.env["RETENTION_LOGS_MONTHS"];
    delete process.env["RETENTION_GDPR_TRACES_MONTHS"];
    await executerPurgeRetention();
  });

  // ── `D5-5-04` ──────────────────────────────────────────────────────────────

  it("🔴 les e-mails transactionnels vivent aussi longtemps que la pièce (5 ans)", () => {
    const transac = appels("emailLog").find((a) => a.where?.marketing === false);
    expect(transac, "la purge du transactionnel doit exister").toBeDefined();
    expect(moisEcoules(transac!.where!.createdAt!.lt!)).toBe(DOCUMENT_RETENTION_YEARS * 12);
  });

  it("🔴 et PAS 36 mois — la valeur d'avant, qui tuait la preuve deux ans trop tôt", () => {
    // Témoin explicite de la régression : si quelqu'un rétablit 36, ce test
    // nomme la raison au lieu de laisser lire un chiffre nu.
    const transac = appels("emailLog").find((a) => a.where?.marketing === false);
    expect(moisEcoules(transac!.where!.createdAt!.lt!)).not.toBe(36);
  });

  it("le marketing reste à 13 mois — la norme CNIL de prospection est INCHANGÉE", () => {
    // 🔑 Témoin négatif du volet `D5-5-04` : sans lui, allonger TOUTES les
    // rétentions e-mail passerait les deux tests ci-dessus. Or allonger la
    // conservation de données de prospection serait une non-conformité, pas
    // une correction.
    const marketing = appels("emailLog").find((a) => a.where?.marketing === true);
    expect(marketing, "la purge du marketing doit exister").toBeDefined();
    expect(moisEcoules(marketing!.where!.createdAt!.lt!)).toBe(13);
  });

  // ── `D5-5-05` ──────────────────────────────────────────────────────────────

  it("🔴 la purge des journaux à 12 mois ÉPARGNE les traces `gdpr.*`", () => {
    const courante = appels("activityLog").find((a) => a.where?.NOT !== undefined);
    expect(courante, "la purge courante doit exclure un préfixe").toBeDefined();
    expect(courante!.where!.NOT!.action!.startsWith).toBe("gdpr.");
    expect(moisEcoules(courante!.where!.createdAt!.lt!)).toBe(12);
  });

  it("🔴 les traces `gdpr.*` ont leur propre échéance, alignée sur les pièces", () => {
    const rgpd = appels("activityLog").find((a) => a.where?.action?.startsWith === "gdpr.");
    expect(rgpd, "les traces RGPD doivent avoir leur propre purge").toBeDefined();
    expect(moisEcoules(rgpd!.where!.createdAt!.lt!)).toBe(DOCUMENT_RETENTION_YEARS * 12);
  });

  it("les traces `gdpr.*` sont bien purgées un jour — la rétention n'est pas l'éternité", () => {
    // 🔑 Témoin négatif du volet `D5-5-05`. Exclure `gdpr.` de la purge SANS lui
    // donner d'échéance produirait une conservation sans limite : la
    // non-conformité art. 5.1.e qu'on croyait corriger, à l'envers. Les deux
    // appels doivent exister, pas un seul.
    expect(appels("activityLog")).toHaveLength(2);
  });
});
