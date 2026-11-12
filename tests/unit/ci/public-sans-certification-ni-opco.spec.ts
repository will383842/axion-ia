/**
 * RIEN DE `public/` NE REVENDIQUE UNE CERTIFICATION NI UN FINANCEMENT (2026-11-08).
 *
 * `public/` est servi tel quel, hors middleware et hors drapeaux (`proxy.ts` exclut
 * `.html`). Le feuilletoir du catalogue y affichait « Organisme certifié Qualiopi »
 * et « OPCO jusqu'à 100 % » alors que le drapeau applicatif était à `false` : un
 * fichier statique contourne toute garde du code. Il a été sorti vers
 * `docs/pdf-hors-ligne-certification/catalogue-feuilletoir/`, comme les PDF du
 * 14/10. Le PDF apporteur (OPCO, France Travail, Grenoble) l'a suivi.
 *
 * Ce test :
 *  - exige que les fichiers soient bien sortis de `public/` ;
 *  - exige que leurs anciennes adresses REDIRIGENT (QR imprimés, e-mails déjà partis) ;
 *  - interdit Qualiopi / OPCO / CPF dans tout fichier TEXTE de `public/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../..");
const PUBLIC = path.join(RACINE, "public");

const EXTENSIONS_TEXTE = new Set([".html", ".htm", ".txt", ".xml", ".json", ".js", ".css", ".svg"]);
const INTERDIT = /qualiopi|\bopco\b|\bcpf\b/i;

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else sortie.push(chemin);
  }
  return sortie;
}

describe("public/ sans certification ni financement", () => {
  it("le feuilletoir du catalogue n'est plus servi", () => {
    expect(existsSync(path.join(PUBLIC, "catalogue", "index.html"))).toBe(false);
    expect(existsSync(path.join(PUBLIC, "catalogue", "pages-web"))).toBe(false);
    expect(
      existsSync(
        path.join(RACINE, "docs/pdf-hors-ligne-certification/catalogue-feuilletoir/index.html"),
      ),
    ).toBe(true);
  });

  it("le PDF apporteur n'est plus servi, mais il est conservé hors ligne", () => {
    expect(
      existsSync(path.join(PUBLIC, "imprimes", "devenir-apporteur-d-affaires-axion-ia.pdf")),
    ).toBe(false);
    expect(
      existsSync(
        path.join(
          RACINE,
          "docs/pdf-hors-ligne-certification/apporteur/devenir-apporteur-d-affaires-axion-ia.pdf",
        ),
      ),
    ).toBe(true);
  });

  it("les anciennes adresses redirigent au lieu de répondre 404", () => {
    const config = readFileSync(path.join(RACINE, "next.config.ts"), "utf8");
    expect(config).toMatch(/source: "\/catalogue\/index\.html",\s*destination: "\/fr\/formations"/);
    expect(config).toMatch(
      /source: "\/imprimes\/devenir-apporteur-d-affaires-axion-ia\.pdf",\s*destination: "\/fr\/apporteur-affaires"/,
    );
  });

  it("aucun fichier texte de public/ ne cite Qualiopi, OPCO ou CPF", () => {
    const fautifs = fichiers(PUBLIC)
      .filter((f) => EXTENSIONS_TEXTE.has(path.extname(f).toLowerCase()))
      .filter((f) => INTERDIT.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(RACINE, f));
    expect(fautifs).toEqual([]);
  });
});
