/**
 * 🛑 SUPPRIMER UNE OFFRE N'EFFACE PAS LES DOSSIERS DES CANDIDATS.
 *
 * 🔴 CE QUI ARRIVAIT, ET POURQUOI AUCUNE GARDE NE LE VOYAIT.
 *
 * Will a décidé (D4) qu'un dossier de candidature ne se supprime **jamais tout
 * seul**, et la PR #952 a livré la moitié visible de cette décision : la purge
 * automatique épargne les candidatures `hired`
 * (`retention-purge-worker.ts`, `status: { notIn: ["hired"] }`), verrouillée par
 * `les-dossiers-recrutes-ne-sont-jamais-purges.spec.ts`.
 *
 * L'autre moitié manquait. `JobApplication.offer` portait `onDelete: Cascade`,
 * et `deleteJobOfferAction` purgeait en plus les CV sur disque avant de
 * supprimer l'offre. **Supprimer une offre effaçait donc les dossiers des
 * personnes recrutées par elle**, fichiers compris — exactement ce que la
 * décision interdit, par un chemin que la garde existante ne pouvait pas voir :
 * elle instrumente le worker de purge, et ce chemin-là n'y passe pas.
 *
 * 🔑 UNE PROTECTION POSÉE À UN ENDROIT ET ABSENTE DE SON JUMEAU. C'est le motif
 * que ce dépôt paie le plus souvent, et il est ici aggravé par le fait que la
 * destruction est faite par la BASE (`ON DELETE CASCADE`), pas par du code :
 * aucune relecture de `retention-purge-worker.ts` ne pouvait la trouver.
 *
 * ## Ce que ce fichier verrouille
 *
 * L'invariant STRUCTUREL, celui qui rend la classe entière sûre : la contrainte
 * de clé étrangère doit détacher, jamais détruire. Une garde de comportement
 * (« l'action ne supprime pas ») serait plus faible — un second appelant écrit
 * demain la contournerait, alors que la contrainte, elle, tient pour tout le
 * monde, y compris pour un `DELETE` tapé à la main en console.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = join(process.cwd(), "prisma", "schema.prisma");
const ACTION = join(process.cwd(), "src", "features", "admin-job-offers", "actions.ts");

/** La ligne de relation `offer` du modèle `JobApplication`. */
function ligneDeRelation(): string | null {
  const schema = readFileSync(SCHEMA, "utf8");
  const debut = schema.indexOf("model JobApplication {");
  if (debut === -1) return null;
  const fin = schema.indexOf("\nmodel ", debut + 1);
  const bloc = schema.slice(debut, fin === -1 ? undefined : fin);
  const ligne = bloc.split(/\r?\n/).find((l) => /^\s*offer\s+JobOffer/.test(l));
  return ligne ?? null;
}

describe("🛑 supprimer une offre n'efface pas les dossiers des candidats", () => {
  it("🔑 CONTRE-TÉMOIN : la relation est bien trouvée dans le schéma", () => {
    // Sans lui, un renommage de modèle ou de champ rendrait les tests suivants
    // verts en n'examinant RIEN — la panne que ce dépôt a payée cinq fois.
    const ligne = ligneDeRelation();
    expect(
      ligne,
      "la relation `offer` de `JobApplication` est introuvable — le motif est " +
        "cassé, pas forcément le schéma",
    ).not.toBeNull();
    expect(ligne).toContain("@relation");
  });

  it("🔴 la clé étrangère DÉTACHE, elle ne détruit pas", () => {
    const ligne = ligneDeRelation() ?? "";

    expect(
      ligne.includes("onDelete: SetNull"),
      "`JobApplication.offer` doit porter `onDelete: SetNull`. Avec `Cascade`, " +
        "supprimer une offre efface les candidatures qu'elle a reçues — y compris " +
        "les dossiers `hired`, que la décision D4 et la PR #952 protègent " +
        "explicitement de la purge. La protection ne vaut que si elle tient sur " +
        "TOUS les chemins, pas seulement sur celui qu'une garde instrumente.",
    ).toBe(true);

    // Dit deux fois, dans les deux sens : une garde qui n'exprime que ce qu'elle
    // veut laisse passer ce qu'elle n'a pas nommé.
    expect(
      ligne.includes("onDelete: Cascade"),
      "`onDelete: Cascade` est de retour sur `JobApplication.offer` — c'est la " +
        "destruction silencieuse de dossiers de candidats par la BASE, qu'aucune " +
        "relecture du code de purge ne peut trouver.",
    ).toBe(false);
  });

  it("🔴 la colonne est NULLABLE — sans quoi `SetNull` ne peut pas s'appliquer", () => {
    const schema = readFileSync(SCHEMA, "utf8");
    const debut = schema.indexOf("model JobApplication {");
    const bloc = schema.slice(debut, schema.indexOf("\nmodel ", debut + 1));
    const ligne = bloc.split(/\r?\n/).find((l) => /^\s*offerId\s+String/.test(l)) ?? "";
    expect(ligne, "`offerId` introuvable").not.toBe("");
    expect(
      /^\s*offerId\s+String\?/.test(ligne),
      "`offerId` doit être nullable : Postgres refuse `ON DELETE SET NULL` sur " +
        "une colonne `NOT NULL`, et la migration échouerait au déploiement.",
    ).toBe(true);
  });

  it("🔴 la suppression d'une offre ne purge PLUS les CV de ses candidats", () => {
    // Les dossiers survivent désormais à leur offre. Supprimer leurs pièces
    // jointes laisserait des dossiers vivants pointant vers des fichiers
    // absents : la pire des deux moitiés.
    const src = readFileSync(ACTION, "utf8");
    expect(src.length, "le fichier d'actions des offres est vide ou introuvable").toBeGreaterThan(
      500,
    );

    const sansCommentaires = src
      .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " "))
      .split(/\r?\n/)
      .map((l) => (l.trim().startsWith("//") ? "" : l))
      .join("\n");

    expect(
      /\bdeleteCv\s*\(/.test(sansCommentaires),
      "`admin-job-offers/actions.ts` appelle `deleteCv` : supprimer une offre " +
        "détruirait les pièces jointes de candidatures qui, elles, survivent.",
    ).toBe(false);
  });

  it("🔑 …et le détecteur de `deleteCv` reconnaît vraiment un appel", () => {
    // Contre-témoin du motif : sans lui, une regex cassée rendrait le test
    // ci-dessus vert pour toujours, y compris sur un fichier qui purge.
    const motif = /\bdeleteCv\s*\(/;
    expect(motif.test("await deleteCv(a.cvStoragePath);")).toBe(true);
    expect(motif.test("await Promise.all(xs.map((a) => deleteCv(a.cvStoragePath)));")).toBe(true);
    // Et il ne se déclenche pas sur une simple mention.
    expect(motif.test("// on ne purge plus les CV ici")).toBe(false);
    expect(motif.test("const deleteCvAilleurs = 1;")).toBe(false);
  });
});
