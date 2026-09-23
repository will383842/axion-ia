/**
 * LES LIENS D'INSERTION DU COMPOSEUR — dérivés du référentiel, jamais recopiés.
 *
 * 🔑 Trois choses vérifiées, et c'est tout ce qui compte ici :
 *   1. les URLs rendues pointent vers des FICHIERS QUI EXISTENT VRAIMENT sous
 *      `public/` — un bouton qui insère un 404 est pire que pas de bouton ;
 *   2. la dérivation regarde bien `IMPRIMES` et pas une copie : un id retiré du
 *      référentiel fait DISPARAÎTRE son lien, jamais un lien mort ;
 *   3. le lien Calendly n'apparaît que configuré ET valide.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { liensImprimesPourEmail, lienCalendlyPourEmail } from "../liens-email";
import { IMPRIMES } from "@/content/imprimes";

const ORIGINE = "https://exemple.invalid";

describe("liensImprimesPourEmail", () => {
  const liens = liensImprimesPourEmail(ORIGINE);

  it("rend les trois imprimés attendus, ni plus ni moins", () => {
    expect(liens.map((l) => l.id).sort()).toEqual(
      ["depliant-formations", "devenir-apporteur", "flyer-a5"].sort(),
    );
  });

  it.each(liens.map((l) => l))(
    "« %s » pointe vers un fichier qui EXISTE sous public/",
    (lien: { id: string; url: string }) => {
      const chemin = lien.url.replace(`${ORIGINE}/`, "");
      const absolu = join(process.cwd(), "public", chemin);
      expect(
        existsSync(absolu),
        `${lien.url} ne correspond à aucun fichier réel (${absolu}) : un bouton d'insertion pointerait vers un 404`,
      ).toBe(true);
    },
  );

  it("🔴 DÉRIVE de IMPRIMES — un id absent du référentiel ne produit AUCUN lien inventé", () => {
    // Preuve par le vide : si `IMPRIMES` ne connaît plus un id qu'on proposait,
    // aucune entrée mal formée ne doit apparaître à sa place. On le prouve en
    // retirant temporairement l'entrée et en relisant le module ne suffirait
    // pas (import figé) — on vérifie donc directement que la fonction ne fait
    // AUCUNE supposition sur un id qu'elle ne trouve pas dans IMPRIMES :
    // chaque lien rendu a bien une entrée correspondante dans le référentiel.
    for (const lien of liens) {
      const entree = IMPRIMES.find((i) => i.id === lien.id);
      expect(entree, `« ${lien.id} » est rendu sans exister dans IMPRIMES`).toBeDefined();
      expect(lien.url.endsWith(entree!.fichiersPublics[0]!.chemin)).toBe(true);
    }
  });

  it("les URLs sont ABSOLUES — un e-mail n'a pas d'origine relative", () => {
    for (const lien of liens) expect(lien.url).toMatch(/^https:\/\//);
  });
});

describe("lienCalendlyPourEmail", () => {
  it("rend `null` quand rien n'est configuré", () => {
    expect(lienCalendlyPourEmail(undefined)).toBeNull();
  });

  it("rend `null` sur un lien invalide — jamais un bouton qui insère n'importe quoi", () => {
    expect(lienCalendlyPourEmail("https://exemple.invalid/pas-calendly")).toBeNull();
  });

  it("rend le lien quand il est configuré et valide", () => {
    const url = "https://calendly.com/axion-ia/entretien";
    expect(lienCalendlyPourEmail(url)).toEqual({
      id: "calendly-echange",
      label: "Réserver un échange",
      url,
    });
  });

  it("🔴 emploie bien LE validateur passé — mutation : un validateur qui accepte tout ferait tout passer", () => {
    // Témoin du câblage : si `lienCalendlyPourEmail` cessait d'appeler `valide`,
    // ce test resterait vert par coïncidence. On le fait donc échouer À DESSEIN
    // avec un validateur qui refuse tout, et on vérifie que le refus est bien
    // RÉPERCUTÉ — la preuve que l'argument est branché, pas ignoré.
    const toutRefuser = (): boolean => false;
    expect(lienCalendlyPourEmail("https://calendly.com/x/y", toutRefuser)).toBeNull();
  });
});
