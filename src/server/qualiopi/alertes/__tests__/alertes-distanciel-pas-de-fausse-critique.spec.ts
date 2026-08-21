/**
 * 🔴 `D2-3-C2` — une session distancielle bien menée ne doit RIEN faire crier.
 *
 * ## Le défaut
 *
 * `emargementSigneAt` n'est posé que par la grille présentielle
 * (`actions/qualiopi/presence.ts`, `saveEmargementAction`). L'import d'un relevé
 * de connexion ne l'écrit **jamais** : il appelle `recomputeTauxPresence` et
 * s'arrête là.
 *
 * Deux règles d'alerte filtraient pourtant sur ce seul champ. Résultat, sur une
 * session 100 % distancielle dont le relevé était importé, le taux calculé et le
 * fichier archivé avec son empreinte :
 *
 *   · `emargement_manquant` — **critique, une par stagiaire**, après la clôture ;
 *   · `emargement_aucune_signature` — **critique**, tant que les jetons vivent.
 *
 * Chaque alerte critique part par e-mail. Une modalité entière du catalogue
 * produisait une salve de fausses alertes à chaque session correctement tenue.
 *
 * 🔑 `trace-cloture.ts` portait déjà la bonne définition — signature **ou** taux
 * — et l'appliquait depuis le début. Les règles en avaient une recopie plus
 * ÉTROITE. C'est la sixième occurrence du motif « un prédicat recopié diverge » ;
 * ici la copie n'autorisait pas trop de monde, elle en **accusait** trop.
 *
 * ## Ce que ce fichier garde
 *
 * Le `where` RÉELLEMENT envoyé à la base — pas le texte du fichier. Un test
 * statique dirait seulement que le mot `porteUneTraceDePresence` apparaît ; il
 * ne dirait pas qu'il est appliqué à la bonne requête.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // ⚠️ Seuls les deux modèles des règles visées sont mockés. Toutes les autres
    // règles lèveront et seront rattrapées par le fail-soft par règle de
    // l'évaluateur — c'est sans effet sur ce qu'on mesure ici, et cela évite de
    // recopier les vingt modèles du fichier de tests principal.
    enrollment: { findMany: vi.fn() },
    trainingSession: { findMany: vi.fn() },
  },
}));

// ⚠️ Sans ces quatre doubles, la chaîne d'import atteint `next-auth`, qui charge
// `next/server` hors contexte Next et fait échouer la COLLECTE du fichier —
// « no tests », un état qui ressemble à un succès dans un journal pressé.
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/financements/bareme-opco", () => ({ listBaremesEnVigueur: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  listTrainerDocuments: vi.fn(),
  cumulAnnuelFormateurCents: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { evaluerAlertes } from "../evaluateur";
import {
  porteUneTraceDePresence,
  sansAucuneTraceDePresence,
} from "@/server/qualiopi/presence/trace-cloture";

const mp = prisma as unknown as {
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
};

/** Le `where` de chaque appel au modèle. */
function wheres(m: { findMany: ReturnType<typeof vi.fn> }): Array<Record<string, unknown>> {
  return m.findMany.mock.calls
    .map((c) => (c[0] as { where?: Record<string, unknown> } | undefined)?.where)
    .filter((w): w is Record<string, unknown> => w !== undefined);
}

describe("`D2-3-C2` — les alertes d'émargement reconnaissent le distanciel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    mp.enrollment.findMany.mockResolvedValue([]);
    mp.trainingSession.findMany.mockResolvedValue([]);
    await evaluerAlertes();
  });

  it("🔴 `emargement_manquant` n'accuse que l'absence de TOUTE trace", () => {
    // La requête de R03 se reconnaît à son filtre de session close.
    const r03 = wheres(mp.enrollment).find(
      (w) => (w["session"] as { statut?: string } | undefined)?.statut === "realisee",
    );
    // 🔑 Sans cette assertion, un renommage ferait disparaître la requête et le
    // test passerait au vert en ne vérifiant plus rien.
    expect(r03, "la requête de `emargement_manquant` est introuvable").toBeDefined();

    // Le taux de présence compte comme une trace — c'est tout le correctif.
    expect(
      r03,
      "la règle ignore `tauxPresencePct` : elle criera sur toute session distancielle",
    ).toMatchObject(sansAucuneTraceDePresence());
  });

  it("🔴 `emargement_aucune_signature` accepte aussi le relevé importé", () => {
    // ⚠️ Le sélecteur porte sur la clause DISTINCTIVE : « le dispositif est en
    // place » (`some.emargementTokens`). Sans elle, la recherche attrapait la
    // règle JUMELLE — `session_sans_dispositif_emargement` —, qui porte elle
    // aussi un `enrollments.none` mais dit exactement l'inverse. Deux règles
    // voisines et opposées : se tromper de cible ferait garder la mauvaise.
    const regle = wheres(mp.trainingSession)
      .map((w) => w["AND"])
      .filter((and): and is Array<Record<string, unknown>> => Array.isArray(and))
      .find((and) =>
        and.some(
          (c) =>
            (c["enrollments"] as { some?: Record<string, unknown> } | undefined)?.some?.[
              "emargementTokens"
            ] !== undefined,
        ),
      );
    expect(regle, "la requête de `emargement_aucune_signature` est introuvable").toBeDefined();

    const clause = regle?.find(
      (c) => (c["enrollments"] as { none?: unknown } | undefined)?.none !== undefined,
    );
    expect(clause, "la clause « personne n'a de trace » a disparu de la règle").toBeDefined();
    expect(
      (clause?.["enrollments"] as { none: unknown }).none,
      "la règle ne regarde que `emargementSigneAt` : elle criera pendant toute session distancielle",
    ).toEqual(porteUneTraceDePresence());
  });

  it("les deux prédicats sont des contraires EXACTS", () => {
    // ⚠️ Ils vivent côte à côte et l'un est la négation de l'autre. Si l'un
    // gagne un champ sans l'autre, une inscription pourrait n'être NI « avec
    // trace » NI « sans trace » — et disparaîtrait des deux mesures.
    const avec = porteUneTraceDePresence()
      .OR.map((c) => Object.keys(c)[0])
      .sort();
    const sans = Object.keys(sansAucuneTraceDePresence()).sort();
    expect(avec).toEqual(sans);
    expect(avec).toEqual(["emargementSigneAt", "tauxPresencePct"]);
  });

  it("le témoin : un taux à 0 % EST une trace", () => {
    // 🔑 `{ not: null }` et non `> 0`, délibérément — un relevé qui dit que
    // personne ne s'est connecté est une preuve, pas une absence de preuve. Le
    // durcissement en `> 0` a déjà été tenté puis retiré dans `trace-cloture`.
    const taux = porteUneTraceDePresence().OR[1].tauxPresencePct;
    expect(taux).toEqual({ not: null });
    expect(taux).not.toEqual({ gt: 0 });
  });
});
