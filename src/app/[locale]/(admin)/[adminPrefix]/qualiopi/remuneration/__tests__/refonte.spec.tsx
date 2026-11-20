import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  CarteLigne,
  LignesDuMois,
  PastilleStatutReleve,
  TuilesReleve,
  type LigneReleve,
} from "../_composants";

const ligne = (o: Partial<LigneReleve> = {}): LigneReleve => ({
  id: "l1",
  prestationType: "animation",
  motif: null,
  model: "taux_journalier",
  nature: "honoraire_du",
  statut: "valide",
  heures: 7,
  montantHtCents: 35000,
  rattacheeAuReleve: true,
  ...o,
});

const tuiles = {
  totalHtCents: 100000,
  tvaCents: 20000,
  totalTtcCents: 120000,
  payeAt: null,
  echeance: null,
  retardJours: null,
  ecartFacture: false,
};

describe("TuilesReleve", () => {
  it("affiche HT, TVA, TTC en grand et une échéance neutre sans date", () => {
    render(<TuilesReleve {...tuiles} />);
    const zone = screen.getByLabelText("Chiffres clés");
    expect(within(zone).getByText("Total HT")).toBeTruthy();
    expect(within(zone).getByText("TVA")).toBeTruthy();
    expect(within(zone).getByText("Total TTC")).toBeTruthy();
    expect(within(zone).getByText(/1[\s  ]200,00/)).toBeTruthy();
    expect(within(zone).getByText("Aucune échéance enregistrée")).toBeTruthy();
  });

  it("échéance dépassée : nombre de jours de retard", () => {
    render(<TuilesReleve {...tuiles} echeance={new Date("2026-10-01")} retardJours={12} />);
    expect(screen.getByText("12 j de retard")).toBeTruthy();
  });

  it("payé : tuile « Payé »", () => {
    render(<TuilesReleve {...tuiles} payeAt={new Date("2026-11-02")} />);
    expect(screen.getByText("Payé")).toBeTruthy();
  });

  it("écart de facture : le TTC le signale", () => {
    render(<TuilesReleve {...tuiles} ecartFacture />);
    expect(screen.getByText("Écart avec la facture reçue")).toBeTruthy();
  });
});

describe("PastilleStatutReleve", () => {
  it("pastille pleine avec icône et libellé", () => {
    const { container } = render(<PastilleStatutReleve statut="a_valider" />);
    expect(screen.getByText("À valider")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".admin-badge-plein")).not.toBeNull();
  });
});

describe("cartes de lignes", () => {
  it("une carte : titre, pastille avec icône, montant, bordure gauche selon l'état", () => {
    const { container } = render(
      <ul>
        <CarteLigne ligne={ligne()} />
      </ul>,
    );
    expect(screen.getByRole("heading", { level: 4 })).toBeTruthy();
    expect(screen.getByText("Figé")).toBeTruthy();
    expect(container.querySelector("li svg")).not.toBeNull();
    expect(container.querySelector("li")?.className).toContain("border-l-4");
    expect(screen.getByText(/350,00/)).toBeTruthy();
  });

  it("motif d'anomalie dans un encadré teinté, pas en italique", () => {
    const { container } = render(
      <ul>
        <CarteLigne ligne={ligne({ motif: "assiette_ca_absente" })} />
      </ul>,
    );
    expect(screen.getByText(/Anomalie :/)).toBeTruthy();
    expect(container.querySelector("em, i, .italic")).toBeNull();
  });

  it("regroupe facturées et non facturées", () => {
    render(
      <LignesDuMois
        lignes={[
          ligne({ id: "a" }),
          ligne({ id: "b", rattacheeAuReleve: false, statut: "previsionnel" }),
        ]}
      />,
    );
    expect(screen.getByText(/Facturées \(dans le total\) \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Non facturées \(hors total\) \(1\)/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("état vide : AdminEmptyState avec icône", () => {
    const { container } = render(<LignesDuMois lignes={[]} />);
    expect(screen.getByText("Aucune ligne sur cette période")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

const DIR = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/remuneration";
const PAGE = readFileSync(`${DIR}/[id]/page.tsx`, "utf8");

describe("actions et logique inchangées", () => {
  it("les cinq actions serveur et les champs cachés sont toujours branchés", () => {
    for (const a of [
      "emettreAutofactureFormAction",
      "transmettreAutofactureFormAction",
      "contesterAutofactureFormAction",
      "accepterDesaccordFormAction",
      "refuserDesaccordFormAction",
      "transitionStatementFormAction",
    ]) {
      expect(PAGE).toContain(`action={${a}}`);
    }
    expect(PAGE).toContain('name="statementId"');
    expect(PAGE).toContain('name="ibanEmpreinteAffichee"');
    expect(PAGE).toContain("transitionsPossibles(releve.statut)");
  });

  it("textes d'explication longs dans des blocs repliés, aucune couleur Tailwind par défaut", () => {
    expect(PAGE).toContain("<AdminBlocRepliable");
    expect(PAGE).not.toMatch(/\b(?:bg|text|border)-(?:red|green|blue|gray|slate|amber)-\d/);
  });
});

// Garde de vocabulaire : aucune chaîne visible AJOUTÉE ne contient les mots réservés.
const INTERDIT = /qualiopi|opco|financement|prise en charge|certification|cpf/i;
// Chemins d'import et URL (commencent par « @/ » ou « / ») : pas du texte visible.
// Chaîne déjà présente sur main (titre de métadonnées) — ni ajoutée ni retirée.
const LISTE_BLANCHE = new Set(["Qualiopi — Relevé d'honoraires | Axion-IA Admin"]);
const FICHIERS = [`${DIR}/[id]/page.tsx`, `${DIR}/_composants.tsx`, `${DIR}/layout.tsx`];

function chainesVisibles(src: string): string[] {
  const sansCommentaires = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const out: string[] = [];
  for (const m of sansCommentaires.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2] ?? "");
  for (const m of sansCommentaires.matchAll(/>([^<>{}\n]+)</g)) out.push(m[1] ?? "");
  return out;
}

describe("garde de vocabulaire des fichiers refondus", () => {
  for (const f of FICHIERS) {
    it(`${f} : aucune chaîne visible ajoutée avec un mot réservé`, () => {
      const fautives = chainesVisibles(readFileSync(f, "utf8")).filter(
        (c) => INTERDIT.test(c) && !LISTE_BLANCHE.has(c) && !/^(@\/|\/)/.test(c),
      );
      expect(fautives).toEqual([]);
    });
  }
});
