/**
 * Garde-fou CI — « qui AFFIRME la certification doit utiliser le bon flag ».
 *
 * Contexte (audit F13, PR #401, 2026-07-25) — deux notions ont été DÉCOUPLÉES
 * parce qu'on les avait confondues en production :
 *
 *   isQualiopiPublicDisclosureEnabled()  → les pages OF sont VISIBLES
 *   isQualiopiCertificationObtenue()     → on a le droit d'AFFIRMER la certification
 *
 * Avant le découplage, `OF_PUBLIC_DISCLOSURE_ENABLED=true` était posé en prod
 * alors que la certification n'était PAS obtenue. Le site affirmait donc
 * publiquement, dans la formulation officielle réservée aux organismes
 * certifiés, que « la certification qualité a été délivrée ». L'en-tête de
 * `flag.ts` qualifie cette situation d'ILLÉGALE.
 *
 * ── Pourquoi ce test, et pas seulement le découplage ────────────────────────
 * Les DEUX fonctions existent toujours et sont TOUTES DEUX légitimes : la
 * première gate la visibilité des pages, la seconde gate l'affirmation. Une
 * surface d'affirmation qui repasserait à `isQualiopiPublicDisclosureEnabled()`
 * — par une résolution de conflit de merge, un copier-coller, ou une branche
 * ancienne rebasée sans attention — **compilerait sans erreur et passerait tous
 * les tests existants**. La régression serait totalement silencieuse : le site
 * se remettrait simplement à afficher la mention de certification dès que
 * `OF_PUBLIC_DISCLOSURE_ENABLED=true`, ce qui est le cas en production.
 *
 * Risque concret et identifié : la branche `feat/services-villes-unify` est
 * basée sur le 2026-07-07 (417 commits de retard, antérieure à #401) et
 * restructure précisément le bloc de divulgation OF du footer. Sans ce test,
 * rien n'attraperait la régression au merge.
 *
 * ── Ce qui est vérifié ─────────────────────────────────────────────────────
 * Chaque fichier listé dans ASSERTION_SURFACES AFFIRME la certification dans
 * une surface publique. Il DOIT donc référencer `isQualiopiCertificationObtenue`.
 * Le test échoue s'il ne le fait plus.
 *
 * ⚠️ Ce test ne dit pas qu'un fichier ne peut PAS utiliser l'autre flag : une
 * même surface a souvent besoin des deux (« la page est visible ET on peut
 * affirmer »), cf. `/certification-qualiopi` qui exige les deux conditions.
 * Il exige seulement que le flag d'AFFIRMATION n'y disparaisse jamais.
 *
 * ── Faire évoluer la liste ─────────────────────────────────────────────────
 * Ajouter une surface qui affirme la certification → l'ajouter ici.
 * Retirer une surface → la retirer ici, avec la raison en commentaire.
 * Ne jamais vider la liste pour faire passer un merge.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");

const ASSERTION_FLAG = "isQualiopiCertificationObtenue";

/**
 * Surfaces publiques qui AFFIRMENT la certification Qualiopi.
 * Chemins relatifs à `src/`, séparateur `/`.
 */
const ASSERTION_SURFACES: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: "components/nav/Footer.tsx",
    why: "mention « organisme de formation certifié Qualiopi » rendue sur ~17 600 routes",
  },
  {
    file: "app/[locale]/a-propos/page.tsx",
    why: "bloc de réassurance OF sur la page institutionnelle",
  },
  {
    file: "app/[locale]/avis/page.tsx",
    why: "mention de certification dans le hub avis (E-E-A-T)",
  },
  {
    file: "app/[locale]/formations/page.tsx",
    why: "suffixe SERP + hero du hub formations",
  },
  {
    file: "app/[locale]/formations/entreprise/page.tsx",
    why: "argument de financement OPCO conditionné à la certification",
  },
  {
    file: "app/[locale]/formations/tarifs/page.tsx",
    why: "suffixe « certifié Qualiopi » sur les prix",
  },
  {
    file: "app/[locale]/formations/[slug]/page.tsx",
    why: "suffixe SERP des fiches formation",
  },
  {
    file: "components/formations/FormationDetailPage.tsx",
    why: "bandeau OF des fiches formation",
  },
  {
    file: "app/[locale]/certification-qualiopi/page.tsx",
    why: "la page dédiée — notFound() tant que la certification n'est pas obtenue",
  },
  {
    file: "app/[locale]/financement-opco-france-travail/page.tsx",
    why: "le financement OPCO découle de la certification",
  },
  {
    file: "server/qualiopi/config/public-identity.ts",
    why: "identité publique OF exposée en JSON-LD et PDF",
  },
  {
    file: "server/qualiopi/config/financing.ts",
    why: "libellés de financement conditionnés à la certification",
  },
  {
    file: "app/sitemap.ts",
    why: "les URLs OF ne sont émises que si la certification est réelle",
  },
];

describe("Qualiopi — flag d'affirmation de la certification", () => {
  it("chaque surface d'affirmation existe encore", () => {
    const missing = ASSERTION_SURFACES.map((s) => s.file).filter(
      (f) => !existsSync(path.join(SRC, ...f.split("/"))),
    );
    expect(
      missing,
      `Fichier(s) disparu(s) — mettre à jour ASSERTION_SURFACES :\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it(`chaque surface d'affirmation utilise ${ASSERTION_FLAG}()`, () => {
    const violations: string[] = [];

    for (const { file, why } of ASSERTION_SURFACES) {
      const abs = path.join(SRC, ...file.split("/"));
      if (!existsSync(abs)) continue; // couvert par le test précédent
      const content = readFileSync(abs, "utf8");
      if (!content.includes(ASSERTION_FLAG)) {
        violations.push(
          `${file}\n     rôle   : ${why}\n     attendu: ${ASSERTION_FLAG}() — le flag qui autorise l'AFFIRMATION\n` +
            `     ⚠️ utiliser isQualiopiPublicDisclosureEnabled() ici ferait affirmer la\n` +
            `        certification dès OF_PUBLIC_DISCLOSURE_ENABLED=true (cas de la prod),\n` +
            `        alors qu'elle n'est pas obtenue. Régression silencieuse : ça compile.`,
        );
      }
    }

    expect(
      violations,
      `\n${violations.length} surface(s) affirmant la certification sans le bon flag :\n\n${violations.join("\n\n")}\n`,
    ).toEqual([]);
  });
});
