// @vitest-environment node

/**
 * LES BORNES DU CODE ET DE LA BASE CONCORDENT (ADR 0065).
 *
 * `regles.ts` (lu par le serveur ET le navigateur) et les CHECK de la
 * migration disent la même chose : 20 Gio pour l'équipe, 4 Gio pour une
 * personne, 200 Mio sous lesquels un fichier de l'équipe est toujours analysé.
 * Une borne changée d'un seul côté ferait refuser par la base ce que l'écran
 * accepte (ou l'inverse).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MIGRATION_PARTAGES } from "../objets-sql";
import {
  SEUIL_ANTIVIRUS_EQUIPE_OCTETS,
  TAILLE_MAX_EQUIPE_OCTETS,
  TAILLE_MAX_PERSONNE_OCTETS,
  TAILLE_MORCEAU_OCTETS,
  defautMorceaux,
  nombreMorceaux,
  tailleMorceau,
} from "../regles";

const sql = readFileSync(
  path.join(process.cwd(), "prisma/migrations", MIGRATION_PARTAGES, "migration.sql"),
  "utf8",
);

describe("les bornes du code et de la base concordent", () => {
  it("taille maximale : équipe et personne", () => {
    expect(sql).toContain(
      `CASE WHEN "origine" = 'personne' THEN ${TAILLE_MAX_PERSONNE_OCTETS} ELSE ${TAILLE_MAX_EQUIPE_OCTETS} END`,
    );
  });

  it("seuil de l'antivirus pour les fichiers de l'équipe", () => {
    expect(sql).toContain(`"taille_octets" > ${SEUIL_ANTIVIRUS_EQUIPE_OCTETS}`);
  });

  it("20 Gio tiennent dans les 10 000 morceaux de R2", () => {
    expect(nombreMorceaux(TAILLE_MAX_EQUIPE_OCTETS)).toBeLessThanOrEqual(10_000);
    expect(TAILLE_MORCEAU_OCTETS).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  });

  it("les morceaux reconstituent exactement le fichier", () => {
    const t = 3 * TAILLE_MORCEAU_OCTETS + 17;
    const n = nombreMorceaux(t);
    let somme = 0;
    for (let i = 1; i <= n; i++) somme += tailleMorceau(t, i);
    expect(somme).toBe(t);
    const recus = Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      etag: `"e${i}"`,
      taille: tailleMorceau(t, i + 1),
    }));
    expect(defautMorceaux(t, recus)).toBeNull();
    expect(defautMorceaux(t, recus.slice(1))).toMatch(/manquant/);
  });
});
