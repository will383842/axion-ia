import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le `matcher` de `src/proxy.ts` décide QUELLES URL passent par le middleware.
 *
 * 🔴 CE FICHIER EXISTE À CAUSE D'UN CONTOURNEMENT D'AUTHENTIFICATION (2026-09-05).
 *    Les deux alternatives d'extension du matcher portaient `.*\.ext$` — donc TOUT
 *    chemin, y compris `/fr/<préfixe-admin>/...`. Or `callbacks.authorized` de
 *    `src/auth.config.ts` est la SEULE vérification d'authentification du périmètre
 *    admin. Mesuré en production, sans cookie :
 *
 *      /fr/<préfixe>/qualiopi/stagiaires/temoin-inexistant       → 302 vers /login
 *      /fr/<préfixe>/qualiopi/stagiaires/temoin-inexistant.png   → 200
 *      /fr/admin-zzzzzzzzzzzz/.../temoin-inexistant.png          → 404  (contre-témoin)
 *
 * ⚠️ ET CE TEST EXISTE AUSSI À CAUSE D'UN HARNAIS QUI MENTAIT. Une première version
 *    lisait le matcher puis « dé-échappait » les `\\.` à la main, dans un `node -e`
 *    passé par le shell. La cascade d'échappements a neutralisé le remplacement :
 *    la regex gardait `\\.`, c'est-à-dire « un antislash littéral suivi de n'importe
 *    quel caractère ». Toutes les alternatives contenant un point étaient MORTES, le
 *    harnais rendait `true` pour à peu près tout, et il annonçait neuf régressions
 *    imaginaires. Ce qui l'a démasqué n'est pas la relecture : c'est de l'avoir
 *    rejoué contre la version D'ORIGINE, qui rendait exactement les mêmes résultats.
 *
 *    D'où `JSON.parse` ci-dessous : le littéral du fichier EST un littéral JSON,
 *    on laisse l'analyseur faire le dé-échappement au lieu de le bricoler.
 */

const RACINE = resolve(__dirname, "../../..");

/** La regex du matcher, telle que Next la compilera. */
function matcherDuProxy(): RegExp {
  const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");

  const bloc = /matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(source);
  expect(bloc, "bloc `matcher:` introuvable dans src/proxy.ts").not.toBeNull();

  const litteral = /("\/\(\(\?!(?:[^"\\]|\\.)*")/.exec(bloc?.[1] ?? "");
  expect(litteral, "le littéral du matcher est introuvable").not.toBeNull();

  // Le littéral du fichier est une chaîne JSON valide : `JSON.parse` rend
  // exactement ce que le moteur JS verra à l'exécution.
  const motif = JSON.parse(litteral?.[1] ?? '""') as string;
  return new RegExp(`^${motif}$`);
}

/** Vrai si le middleware s'exécute sur ce chemin. */
function middlewareSExecute(chemin: string): boolean {
  return matcherDuProxy().test(chemin);
}

// Un préfixe admin quelconque : le matcher ne doit RIEN savoir de sa valeur.
// `ADMIN_URL_PREFIX` est `z.string().min(1).optional()` — rien ne l'oblige à
// commencer par `admin-`, et Next exige un matcher statiquement analysable.
const PREFIXES = ["admin-xfz5hk0j7hrk", "console-secrete", "zzz"];

describe("le matcher du proxy n'exclut jamais une route localisée", () => {
  it("TÉMOIN POSITIF — le harnais mesure vraiment (sinon tout ce fichier est creux)", () => {
    // Sans ces deux-là, un matcher cassé qui rendrait `true` partout — ou `false`
    // partout — passerait tous les autres cas d'un des deux blocs.
    expect(middlewareSExecute("/fr/a-propos"), "une page localisée ordinaire").toBe(true);
    expect(middlewareSExecute("/api/healthz"), "une route d'API").toBe(false);
  });

  it("ROUGIT sur le contournement : une route admin + extension DOIT être vue", () => {
    const extensions = ["png", "jpg", "svg", "webp", "avif", "pdf", "html", "vcf", "txt", "ico"];
    for (const prefixe of PREFIXES) {
      for (const locale of ["fr", "en"]) {
        for (const ext of extensions) {
          const chemin = `/${locale}/${prefixe}/submissions/identifiant-quelconque.${ext}`;
          expect(
            middlewareSExecute(chemin),
            `${chemin} doit passer par le middleware : sans lui, la page s'exécute sans session`,
          ).toBe(true);
        }
      }
    }
  });

  it("et aucune route localisée, admin ou non, n'échappe au middleware", () => {
    for (const chemin of [
      "/fr/ressources/guide.pdf",
      "/fr/galerie/photo.webp",
      "/en/blog/article.html",
      "/fr/quelque-chose.txt",
    ]) {
      expect(middlewareSExecute(chemin), chemin).toBe(true);
    }
  });

  it("CONTRE-TÉMOIN — les exclusions racine restent exclues", () => {
    // 🔑 Le test qui compte. Un correctif trop large rendrait `true` partout et
    //    passerait le cas précédent en cassant la production : la vCard et le
    //    catalogue sont les cibles de QR IMPRIMÉS — déjà distribués, non
    //    rappelables. Chacun de ces chemins existe réellement (src/app/*.txt,
    //    src/app/williams-jullin.vcf, public/).
    for (const chemin of [
      "/robots.txt",
      "/ai.txt",
      "/llms.txt",
      "/llms-full.txt",
      "/3a5c32d22b04f1430690cc33eaec6be9.txt",
      "/williams-jullin.vcf",
      "/catalogue/index.html",
      "/catalogue-formations-ia-axion-ia.pdf",
      "/logo-axion-ia.png",
      "/images/illustrations/x.webp",
      "/fonts/inter.woff2",
      "/file.svg",
    ]) {
      expect(
        middlewareSExecute(chemin),
        `${chemin} doit RESTER hors du middleware : c'est un fichier racine, sans variante localisée`,
      ).toBe(false);
    }
  });

  it("les exclusions non liées aux extensions sont intactes", () => {
    for (const chemin of [
      "/api/auth/callback/credentials",
      "/_next/static/chunks/main.js",
      "/widget/offres-emploi.js",
      "/qr/une-cible",
      "/maintenance",
      "/.well-known/security.txt",
    ]) {
      expect(middlewareSExecute(chemin), chemin).toBe(false);
    }
  });
});
