// @vitest-environment node

/**
 * 🛑 UN ENTRETIEN « TENU » PORTE SON COMPTE RENDU ET SON ISSUE — ET UN
 *    ENTRETIEN NON TENU NE PORTE PAS DE DATE DE TENUE.
 *
 * ## Ce qui est gardé, et pourquoi les DEUX sens comptent
 *
 * Le sens évident : un entretien coché « tenu » sans compte rendu ni issue est
 * un entretien dont il ne reste **rien**. La case est cochée, la décision est
 * invisible, et six mois plus tard personne ne sait pourquoi ce candidat a été
 * écarté. C'est exactement ce que le constat `T2` de l'audit reproche à
 * l'absence d'objet entretien — le reproduire à l'intérieur du nouvel objet
 * n'aurait servi à rien.
 *
 * Le sens qu'on oublie : un entretien **annulé** qui porterait une date de tenue
 * laisserait une trace fantôme, que les rapports liraient comme un entretien
 * réel. C'est le « jumeau oublié », déjà rencontré sur la sortie de dispositif
 * (`enrollments_sortie_coherente_check`), dont cette contrainte reprend
 * l'idiome.
 *
 * ## Pourquoi une garde STATIQUE ici
 *
 * La contrainte vit dans Postgres : la seule façon de l'observer à l'exécution
 * est d'insérer une ligne fautive et de vérifier le refus. Ce contrôle a été
 * fait, sur une base JETABLE — la base de développement partagée est vidée par
 * d'autres sessions en cours de route, et une preuve qui dépend d'un substrat
 * qu'on ne contrôle pas n'est pas une preuve. Les six cas sont rejouables :
 * `prisma/scripts/verifier-contrainte-entretiens.sql`.
 *
 * Ce fichier-ci garde autre chose, et c'est ce qu'une suite unitaire peut
 * garder : que la contrainte n'est pas **retirée**, ni **réduite à un seul
 * sens**, par quelqu'un qui la trouverait gênante. C'est une garde de forme,
 * et elle le dit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260903140000_recrutement_entretiens",
  "migration.sql",
);

function sql(): string {
  return readFileSync(MIGRATION, "utf8");
}

/** La clause CHECK, commentaires retirés. */
function clauseCheck(): string {
  const source = sql()
    .replace(/^--.*$/gm, "")
    .replace(/\s+/g, " ");
  const debut = source.indexOf("job_interviews_etat_coherent_check");
  expect(debut, "la contrainte a disparu de la migration").toBeGreaterThan(-1);
  return source.slice(debut, debut + 400);
}

describe("🛑 contrainte des entretiens — les deux sens", () => {
  it("la migration est bien lue — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ : un fichier déplacé ferait lever `readFileSync`,
    // mais une source tronquée passerait les cas suivants en silence.
    const s = sql();
    expect(s.length).toBeGreaterThan(3_000);
    expect(s).toContain('CREATE TABLE "job_interviews"');
  });

  it("🔴 un entretien TENU exige sa date, son compte rendu ET son issue", () => {
    const clause = clauseCheck();
    for (const exigence of ["held_at IS NOT NULL", "debrief IS NOT NULL", "outcome IS NOT NULL"]) {
      expect(
        clause,
        `la contrainte n'exige plus « ${exigence} » pour un entretien tenu. Un ` +
          "entretien coché tenu sans cela est un entretien dont il ne reste rien : " +
          "la case est cochée, la décision est invisible, et six mois plus tard " +
          "personne ne sait pourquoi ce candidat a été écarté.",
      ).toContain(exigence);
    }
  });

  it("🔴 un entretien NON TENU ne peut pas porter de date de tenue", () => {
    // 🔑 Le jumeau oublié. Sans ce sens-là, un entretien annulé pourrait garder
    // une date de tenue — une trace fantôme que les rapports liraient comme un
    // entretien réel.
    expect(
      clauseCheck(),
      "la contrainte ne garde plus qu'un seul sens. Un entretien annulé ou dont " +
        "le candidat ne s'est pas présenté pourrait porter une date de tenue.",
    ).toMatch(/state\s*<>\s*'tenu'\s*AND\s*held_at IS NULL/);
  });

  it("le lien vers l'agenda est en SET NULL, jamais en CASCADE", () => {
    // Effacer une candidature ne doit pas effacer le rendez-vous de l'agenda :
    // il a sa propre vie et sa propre durée de rétention (36 mois, alignée sur
    // la notice publiée). Une cascade emporterait une ligne d'agenda que
    // personne n'a demandé à supprimer.
    const source = sql().replace(/^--.*$/gm, "");
    const bloc = source.slice(source.indexOf("calendly_events_linked_job_application_id_fkey"));
    expect(bloc.slice(0, 300)).toContain("ON DELETE SET NULL");
  });

  it("🛑 aucun champ d'enregistrement, de transcription ou de résumé", () => {
    // Ordre permanent du responsable de traitement : aucun enregistrement des
    // rendez-vous, aucun résumé automatique. Le compte rendu est SAISI. Cette
    // garde empêche qu'un champ de média entre par la porte du schéma.
    const source = sql().toLowerCase();
    const interdits = ["recording", "transcript", "enregistrement_url", "resume_auto", "notetaker"];
    const trouves = interdits.filter((mot) => new RegExp(`"[a-z_]*${mot}[a-z_]*"`).test(source));
    expect(
      trouves,
      "un champ d'enregistrement ou de transcription a été ajouté à la table des " +
        "entretiens. C'est interdit par ordre permanent : aucun rendez-vous n'est " +
        "enregistré, et le compte rendu est saisi à la main.",
    ).toEqual([]);
  });
});
