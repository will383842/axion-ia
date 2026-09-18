/**
 * 🔴 La branche « base de données » de `/[locale]/formations/[slug]` est du
 * CODE MORT pour les 22 formations — et son commentaire doit le dire.
 *
 * La page cherche d'abord le catalogue statique (`getFormationV2(slug)`) et
 * repart s'il répond. Les 22 formations de la table `formations` y répondent
 * toutes : le seuil de réussite, les objectifs et les indicateurs par
 * formation écrits plus bas ne s'affichent donc jamais. La PR #1110 avait posé
 * sur cette ligne morte un commentaire affirmant « CE SEUIL EST VRAI […] le
 * seuil est RÉELLEMENT appliqué » ; il a été rectifié le 2026-09-17.
 *
 * Liste tapée À DESSEIN : ce sont les 22 slugs mesurés en production
 * (`SELECT slug FROM formations`, 2026-09-18). Si l'un cesse de résoudre au
 * catalogue, la branche redevient vivante pour lui, et le commentaire de la
 * page devient faux à son tour — c'est ce que ce test doit faire voir.
 * Décision du propriétaire (2026-09-17) : on documente, on ne rebranche pas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFormationV2 } from "@/content/formations/catalog-v2";

const SLUGS_PRODUCTION = [
  "ia-pour-bien-commencer",
  "ia-pour-bien-commencer-journee",
  "ia-pour-l-automatisation",
  "ia-pour-l-hotellerie-restauration",
  "ia-pour-l-immobilier",
  "ia-pour-l-industrie",
  "ia-pour-l-it",
  "ia-pour-la-banque-assurance",
  "ia-pour-la-finance",
  "ia-pour-la-production",
  "ia-pour-la-relation-client",
  "ia-pour-la-sante",
  "ia-pour-le-btp",
  "ia-pour-le-commerce",
  "ia-pour-le-juridique",
  "ia-pour-le-marketing",
  "ia-pour-le-transport-logistique",
  "ia-pour-les-achats",
  "ia-pour-les-commerciaux",
  "ia-pour-les-equipes",
  "ia-pour-les-rh",
  "seminaire-ia-toute-l-entreprise-1j",
] as const;

const PAGE = readFileSync(
  join(__dirname, "..", "..", "..", "src", "app", "[locale]", "formations", "[slug]", "page.tsx"),
  "utf8",
);

describe("la fiche formation « base de données » est du code mort — et le dit", () => {
  it("les 22 slugs de production résolvent tous au catalogue statique", () => {
    const vivants = SLUGS_PRODUCTION.filter((s) => getFormationV2(s)?.slugFr !== s);
    expect(
      vivants,
      "Ces slugs ne résolvent plus au catalogue : la branche base de données de la " +
        "fiche redevient VIVANTE pour eux, et son commentaire « code mort » devient faux.",
    ).toEqual([]);
  });

  // 🔴 Relecture PR 1111 : les deux appels existent AUSSI dans `generateMetadata`,
  // plus haut dans le fichier. Un `indexOf` sur tout le fichier lisait donc la
  // mauvaise fonction et restait vert si le corps de la page interrogeait la
  // base d'abord, ou perdait son court-circuit. On lit le CORPS de la page, et
  // du code, pas le commentaire qui le cite.
  it("le corps de la page court-circuite par le catalogue AVANT toute lecture en base", () => {
    const debut = PAGE.indexOf("export default async function FormationSlugPage");
    expect(debut, "FormationSlugPage introuvable : la garde ne lit plus rien").toBeGreaterThan(-1);
    const corps = PAGE.slice(debut);

    const courtCircuit =
      /const cat = getFormationV2\(slug\);\s*if \(cat\) \{[\s\S]*?return <FormationDetailPage/.exec(
        corps,
      );
    expect(courtCircuit, "le court-circuit par le catalogue a disparu du corps").not.toBeNull();

    const iBase = corps.indexOf("await getPublicFormationBySlug(slug)");
    expect(iBase, "la lecture en base a disparu du corps").toBeGreaterThan(-1);
    expect(iBase, "le corps lit la base AVANT le catalogue").toBeGreaterThan(courtCircuit!.index);
  });

  it("aucun commentaire ne réaffirme que ce seuil est appliqué", () => {
    expect(PAGE).not.toContain("— CE SEUIL EST VRAI. Il avait été retiré");
    expect(PAGE).not.toContain("il est réellement appliqué. Voir le commentaire");
    expect(PAGE).toContain("CE CODE NE S'EXÉCUTE JAMAIS");
  });
});
