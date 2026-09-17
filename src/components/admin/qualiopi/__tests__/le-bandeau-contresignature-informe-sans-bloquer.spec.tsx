/**
 * 🔴 LE BANDEAU DIT CE QUI MANQUE, POURQUOI ÇA COMPTE, ET OÙ CLIQUER — SANS BLOQUER.
 *
 * L'organisme apprenait la règle au refus de règlement. Ce bandeau est la seule
 * surface de l'outil qui relie la contresignature du formateur à l'ARGENT, et
 * il est posé là où l'on s'occupe des signatures.
 *
 * ⛔ Il n'est PAS une garde. Décision de Will du 25/08/2026 : « LA
 * CONTRESIGNATURE PAS BLOQUANTE ». Ce fichier vérifie aussi que l'écran
 * d'émargement n'a rien conditionné au constat — un bandeau qui désactiverait
 * un bouton serait un refus déguisé.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BandeauContresignatureFinanceur } from "../BandeauContresignatureFinanceur";
import { constaterContresignature } from "@/server/qualiopi/emargement/contresignature-attendue";

const manquantes = [
  { date: "2026-09-16", demiJournee: "matin" as const, formateurId: "t-1" },
  { date: "2026-09-16", demiJournee: "apres_midi" as const, formateurId: "t-1" },
];

describe("le bandeau ne s'affiche que quand il a quelque chose à dire", () => {
  it("ne rend RIEN en financement direct", () => {
    const { container } = render(
      <BandeauContresignatureFinanceur
        constat={constaterContresignature({
          financement: "direct",
          signees: 2,
          aContresigner: manquantes,
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend RIEN quand tout est contresigné — il DISPARAÎT après le geste", () => {
    const { container } = render(
      <BandeauContresignatureFinanceur
        constat={constaterContresignature({
          financement: "opco",
          signees: 2,
          aContresigner: [],
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ce qui manque, pourquoi ça compte, où cliquer", () => {
  function rendu() {
    return render(
      <BandeauContresignatureFinanceur
        constat={constaterContresignature({
          financement: "opco",
          signees: 3,
          aContresigner: manquantes,
        })}
        href="/fr/adm/qualiopi/sessions/s-1#formateur"
        libelleLien="Voir le formateur désigné"
      />,
    );
  }

  it("nomme les demi-journées manquantes, une par une, dans une liste", () => {
    rendu();
    // La liste à puces, pas la phrase de résumé : c'est elle qu'on lit pour
    // savoir LESQUELLES, et elle doit être complète.
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["16/09/2026 matin", "16/09/2026 après-midi"]);
  });

  it("dit POURQUOI : le règlement du financeur, nommé", () => {
    rendu();
    expect(screen.getByRole("status").textContent ?? "").toContain("OPCO");
  });

  it("dit OÙ cliquer", () => {
    rendu();
    const lien = screen.getByRole("link", { name: /formateur/i });
    expect(lien.getAttribute("href")).toContain("#formateur");
  });

  it("⚠️ n'écrit jamais « obligatoire » ni « exigé par la loi »", () => {
    rendu();
    const texte = (screen.getByRole("status").textContent ?? "").toLowerCase();
    expect(texte).not.toContain("obligatoire");
    expect(texte).not.toContain("exigé par la loi");
    expect(texte).toContain("contractuel");
  });

  it("annonce le ton `status`, pas `alert` — il informe, il n'alarme pas", () => {
    rendu();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("🔴 le cas vide est NOMMÉ — « 0/0 » ne se refait pas", () => {
  it("dit qu'il n'y a rien à contresigner, sans aucun ratio", () => {
    render(
      <BandeauContresignatureFinanceur
        constat={constaterContresignature({
          financement: "opco",
          signees: 0,
          aContresigner: [],
        })}
      />,
    );
    const texte = screen.getByRole("status").textContent ?? "";
    expect(texte).toContain("Rien à contresigner");
    expect(texte).not.toMatch(/\b0\s*\/\s*0\b/);
    // Et surtout : il ne laisse pas croire que le dossier est complet.
    expect(texte.toLowerCase()).toContain("pas");
  });
});

describe("⛔ l'écran d'émargement ne conditionne RIEN au constat", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/emargement/page.tsx",
    ),
    "utf8",
  );

  it("le constat n'apparaît que dans le bandeau", () => {
    // Une seule utilisation de la variable dans le JSX : celle qui la passe au
    // bandeau. Toute seconde occurrence serait, très probablement, une
    // condition — c'est-à-dire le début d'un blocage.
    const usages = source.match(/constatFinanceur/g) ?? [];
    expect(usages.length, "constatFinanceur est lu ailleurs que dans le bandeau").toBe(2);
  });

  it("aucun `disabled`, `notFound` ni `return` piloté par le constat", () => {
    expect(source).not.toMatch(/constatFinanceur[^\n]*\?\?[^\n]*disabled/);
    expect(source).not.toMatch(/disabled=\{[^}]*constatFinanceur/);
    expect(source).not.toMatch(/if\s*\([^)]*constatFinanceur[^)]*\)\s*(return|notFound)/);
    expect(source).not.toMatch(/constatFinanceur\.afficher\s*(&&|\?)[^\n]*(return|notFound)/);
  });
});
