/**
 * 🔴 L'EFFACEMENT RGPD ART. 17 ÉCHOUAIT SUR CE QU'IL EXISTE POUR EFFACER.
 *
 * ## Le défaut, mesuré le 2026-08-25 (cahier D6-4)
 *
 * La route `DELETE /api/admin/articles/[id]/forget` se déclare, dans son propre
 * en-tête, « **Suppression RGPD art. 17 d'un article généré par l'IA** », et
 * annonce `GenerationProvenance → CASCADE Prisma`.
 *
 * **Le schéma dit l'inverse** : `prisma/schema.prisma:1394` porte
 * `onDelete: Restrict`.
 *
 * Or **tout** article généré par l'IA porte au moins une ligne de provenance —
 * c'est la définition même de la table (AI Act art. 50 : un enregistrement par
 * appel LLM). Le `DELETE` violait donc la clé étrangère, la transaction était
 * annulée, et la route rendait **HTTP 500 « Delete failed »**.
 *
 * 🔑 **L'endpoint du droit à l'effacement échouait précisément sur la classe
 * d'articles pour laquelle il a été écrit.** Et son journal d'audit RGPD
 * *déclarait* une cascade que Postgres interdit — une trace qui affirme un
 * effacement qui n'a pas eu lieu.
 *
 * ## Pourquoi la solution n'est pas de passer en `Cascade`
 *
 * La migration qui a posé ce `Restrict`
 * (`20260521150000_fix_provenance_cascade`) l'a fait **exprès**, et a écrit la
 * consigne : « *la suppression doit passer par une procédure admin dédiée qui
 * archive les lignes provenance avant de supprimer l'article* ». Passer en
 * cascade détruirait les traces **AI Act art. 50** que le `Restrict` protège.
 *
 * Cette procédure n'avait jamais été écrite. Le seul contournement existant
 * (`scripts/delete-landing-ville-articles.ts:109`) **supprime** les lignes de
 * provenance — c'est-à-dire fait exactement ce que le `Restrict` interdisait.
 *
 * ## Ce qui rend l'archivage légitime — et c'est vérifiable
 *
 * `GenerationProvenance` ne contient **aucune donnée personnelle** : fournisseur,
 * modèle, version, empreintes de prompt, comptes de jetons, coût, empreinte
 * chaînée, horodatage. **Rien qui identifie une personne.** Les deux droits ne
 * s'opposent donc pas : on efface l'article (art. 17) **et** on conserve la
 * traçabilité de sa génération (AI Act art. 50).
 *
 * Le premier test ci-dessous est un **contre-témoin de cette affirmation** :
 * si une colonne personnelle était ajoutée demain à la provenance, l'archivage
 * cesserait d'être défendable, et ce fichier doit le dire avant qu'on l'apprenne
 * autrement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const ROUTE = join(
  process.cwd(),
  "src",
  "app",
  "api",
  "admin",
  "articles",
  "[id]",
  "forget",
  "route.ts",
);

/** Le corps d'un modèle Prisma, extrait par son nom. */
function modele(nom: string): string {
  const m = new RegExp(`^model ${nom} \\{[\\s\\S]*?^\\}`, "m").exec(SCHEMA);
  return m?.[0] ?? "";
}

/** Le code seul, commentaires vidés — sinon la garde lit sa propre prose. */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("//") ? "" : l))
    .join("\n");
}

describe("l'effacement art. 17 et la traçabilité AI Act ne s'opposent pas", () => {
  it("🔑 CONTRE-TÉMOIN : la provenance ne porte AUCUNE donnée personnelle", () => {
    // C'est la prémisse de tout ce lot. Si elle tombe, archiver la provenance
    // au lieu de la supprimer cesse d'être défendable — et il faudra alors
    // trancher entre les deux droits au lieu de les satisfaire tous les deux.
    const corps = modele("GenerationProvenance");
    expect(corps, "le modèle GenerationProvenance a disparu du schéma").not.toBe("");

    const COLONNES_PERSONNELLES = [
      "email",
      "nom",
      "prenom",
      "telephone",
      "phone",
      "adresse",
      "ipAddress",
      "ipHash",
      "userId",
      "authorId",
      "traineeId",
      "clientId",
    ];
    const trouvees = COLONNES_PERSONNELLES.filter((c) =>
      new RegExp(`^\\s+${c}\\b`, "m").test(corps),
    );
    expect(
      trouvees,
      "une colonne personnelle est apparue dans `GenerationProvenance` : l'archiver " +
        "au lieu de l'effacer ne satisfait plus l'art. 17. Il faut désormais choisir.",
    ).toEqual([]);
  });

  it("le lien vers l'article reste `Restrict` — la provenance ne se détruit pas en cascade", () => {
    // 🔑 CONTRE-TÉMOIN de la solution retenue. Le correctif le plus court aurait
    // été de passer en `Cascade` : le 500 disparaît, et les traces AI Act avec.
    // Si quelqu'un le fait un jour « pour débloquer », ce test le dit.
    const corps = modele("GenerationProvenance");
    expect(
      /article\s+Article\s+@relation\([^)]*onDelete:\s*Restrict/.test(corps),
      "`GenerationProvenance.article` n'est plus en `Restrict` : passer en cascade " +
        "détruit les traces AI Act art. 50 que ce verrou protège. La migration " +
        "`20260521150000_fix_provenance_cascade` l'a posé exprès.",
    ).toBe(true);
  });

  it("la table d'archive existe, et elle ne porte AUCUNE clé étrangère vers l'article", () => {
    // Une archive qui garderait la FK serait détruite par la même cascade —
    // elle ne survivrait pas à ce qu'elle est censée survivre.
    const corps = modele("GenerationProvenanceArchive");
    expect(
      corps,
      "`GenerationProvenanceArchive` n'existe pas : l'effacement art. 17 n'a nulle " +
        "part où déposer les traces AI Act avant de supprimer l'article.",
    ).not.toBe("");

    expect(
      /@relation\(/.test(corps),
      "l'archive porte une relation vers l'article : elle serait emportée par la " +
        "suppression qu'elle est censée survivre.",
    ).toBe(false);
  });

  it("la route ARCHIVE la provenance avant de supprimer l'article", () => {
    const source = codeSeul(ROUTE);

    expect(
      source.includes("generationProvenanceArchive"),
      "la route ne dépose rien dans l'archive : le `Restrict` fera échouer la " +
        "suppression en 500, exactement comme avant.",
    ).toBe(true);

    expect(
      /generationProvenance\.deleteMany/.test(source),
      "la route ne purge pas les lignes de provenance : le `Restrict` bloque " +
        "toujours la suppression de l'article.",
    ).toBe(true);

    // L'ordre compte : archiver APRÈS avoir supprimé ne garderait rien.
    const iArchive = source.indexOf("generationProvenanceArchive");
    const iPurge = source.indexOf("generationProvenance.deleteMany");
    const iSuppression = source.indexOf("article.delete");
    expect(
      iArchive < iPurge && iPurge < iSuppression,
      "l'ordre est faux : il faut ARCHIVER, puis PURGER la provenance, puis " +
        "supprimer l'article. Tout autre ordre perd les traces ou échoue.",
    ).toBe(true);
  });

  it("le journal d'audit ne déclare plus une cascade que Postgres interdit", () => {
    const source = codeSeul(ROUTE);

    // 🔴 Le journal listait `"GenerationProvenance"` parmi les cascades. Une
    // trace d'audit RGPD qui affirme un effacement qui n'a pas eu lieu est pire
    // qu'une trace absente : elle se lit comme une preuve.
    const bloc = /cascade:\s*\[([\s\S]*?)\]/.exec(source)?.[1] ?? "";
    expect(bloc, "le bloc `cascade:` du journal d'audit a disparu").not.toBe("");
    expect(
      bloc.includes("GenerationProvenance"),
      "le journal d'audit déclare toujours `GenerationProvenance` en CASCADE — " +
        "or elle est en `Restrict`, et elle est désormais ARCHIVÉE, pas effacée. " +
        "La trace doit dire ce qui a réellement eu lieu.",
    ).toBe(false);
  });
});
