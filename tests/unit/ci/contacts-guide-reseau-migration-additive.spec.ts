/**
 * La migration `contacts_guide_reseau` (page « Recevoir le guide », lot S0) est ADDITIVE : une table
 * neuve, rien d'existant touché (AGENTS.md « DEUX conteneurs » : l'ancien conteneur, qui ignore la
 * table, doit continuer à tourner). Aucun code ne la lit ni ne l'écrit à ce stade (lot S2).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "prisma", "migrations", "20261108140000_contacts_guide_reseau");
const sansCommentaires = (t: string): string =>
  t
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const sql = sansCommentaires(readFileSync(join(DOSSIER, "migration.sql"), "utf8"));
const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

describe("migration contacts_guide_reseau : additive", () => {
  it("ne contient que CREATE TABLE, CREATE INDEX et la clé étrangère de la table neuve", () => {
    const instructions = sql
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    for (const i of instructions) {
      expect(i).toMatch(
        /^(CREATE TABLE "contacts_guide_reseau"|CREATE (UNIQUE )?INDEX "contacts_guide_reseau_|ALTER TABLE "contacts_guide_reseau" ADD CONSTRAINT)/,
      );
    }
    expect(instructions.filter((i) => i.startsWith("CREATE TABLE"))).toHaveLength(1);
  });

  it("ne supprime, ne renomme, n'écrit et ne crée aucune énumération", () => {
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bUPDATE\s+"/i,
      /\bINSERT\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bCREATE TYPE\b/i,
      /\bALTER TYPE\b/i,
      /\bALTER COLUMN\b/i,
      /\bALTER TABLE "(?!contacts_guide_reseau")/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });

  it("porte les colonnes demandées et l'unicité du jeton", () => {
    for (const c of [
      "email_key",
      "guide_request_id",
      "prenom",
      "mot",
      "reseau",
      "compte_ref",
      "post_ref",
      "version_m1",
      "version_consentement",
      "consent_empreinte",
      "consenti_le",
      "jeton_empreinte",
      "conv_ref",
      "merci_statut",
      "merci_confirme_le",
      "created_at",
      "updated_at",
    ]) {
      expect(sql).toContain(`"${c}"`);
    }
    expect(sql).toContain("\"merci_statut\" VARCHAR(20) NOT NULL DEFAULT 'a_envoyer'");
    expect(sql).toContain('CREATE UNIQUE INDEX "contacts_guide_reseau_jeton_empreinte_key"');
    expect(sql).toContain('"contacts_guide_reseau"("email_key")');
    expect(sql).toContain('"contacts_guide_reseau"("merci_statut", "created_at")');
    // Pas d'adresse en clair : seule la clé d'adresse (HMAC) est portée.
    expect(sql).not.toMatch(/"email"/);
  });

  it("le schéma Prisma déclare le modèle, annoté RGPD", () => {
    expect(schema).toMatch(
      /\/\/\/ rgpd: dossier-client\n(?:\/\/\/.*\n)*model ContactGuideReseau \{/,
    );
    expect(schema).toContain('@@map("contacts_guide_reseau")');
  });

  it("rollback.sql présent : un DROP TABLE derrière un garde-fou « table vide »", () => {
    const f = join(DOSSIER, "rollback.sql");
    expect(existsSync(f)).toBe(true);
    const r = sansCommentaires(readFileSync(f, "utf8"));
    expect(r.match(/DROP TABLE "contacts_guide_reseau"/g)).toHaveLength(1);
    expect(r).toMatch(/IF EXISTS \(SELECT 1 FROM "contacts_guide_reseau"\)/);
    expect(r).not.toMatch(/\b(DELETE\s+FROM|UPDATE\s+"|TRUNCATE)\b/i);
  });

  it("seuls les fichiers du lot S2 touchent la table (liste fermée)", async () => {
    const { readdirSync } = await import("node:fs");
    const fichiers: string[] = [];
    const marche = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) marche(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.(spec|test)\.tsx?$/.test(e.name)) {
          fichiers.push(p);
        }
      }
    };
    marche(join(process.cwd(), "src"));
    const racine = process.cwd() + "/";
    const fautifs = fichiers
      .filter((f) => /\.contactGuideReseau\.|contacts_guide_reseau/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(racine, ""))
      .sort();
    // Écrivain : la validation de la page. Lecteurs : la page (usage unique), l'export art. 15,
    // la mise à l'écart de l'effacement art. 17, et (lot S3) le lecteur au clic du lien du guide
    // (`clic-page-guide.ts` : un `findFirst` seulement, aucune écriture ni suppression), et le
    // rattrapage horaire du guide (`rattrapage.ts` : un `findFirst` pour savoir si la demande vient
    // de la page, afin de rendre le lien de désinscription ; aucune écriture ni suppression), et
    // la mise à l'écart par adresse (`mise-a-l-ecart.ts` : un `updateMany` vers `ecarte`, jamais
    // de suppression ; appelé par l'effacement et l'opposition reçus en message privé), et (lot S4a)
    // la réservation des « merci » (`confirmations.ts` : des `UPDATE` de `merci_statut`, jamais de
    // suppression ; regroupement des PR 1937 et 1938).
    expect(fautifs).toEqual([
      "src/app/guide-reseau/route.ts",
      "src/lib/rgpd-erase.ts",
      "src/lib/rgpd-guide-reseau.ts",
      "src/server/guide-ia/rattrapage.ts",
      "src/server/guides-reseau/clic-page-guide.ts",
      "src/server/guides-reseau/confirmations.ts",
      "src/server/guides-reseau/mise-a-l-ecart.ts",
      "src/server/guides-reseau/page-confirmation.ts",
    ]);
  });
});
