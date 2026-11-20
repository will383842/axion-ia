import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { EmailOutboxItem } from "@/components/admin/qualiopi/EmailOutboxItem";
import { EmailAutomationSettings } from "@/components/admin/qualiopi/EmailAutomationSettings";

const ok = async () => ({ data: { id: "x", envoye: true } });

function item() {
  return render(
    <EmailOutboxItem
      id="e1"
      template="relance-impaye"
      destinataire="paie@client.fr"
      sujet="Rappel de facture"
      clientNom="Société Test"
      creeLe="12/11/2026"
      apercu={[
        { label: "Attention", valeur: "le formateur a répondu" },
        { label: "Facture", valeur: "F-001" },
      ]}
      nbPiecesJointes={2}
      accepteMessagePersonnalise
      approuverAction={ok}
      refuserAction={async () => ({ data: { id: "e1" } })}
    />,
  );
}

describe("EmailOutboxItem — refonte visuelle", () => {
  it("affiche les badges, l'aide et aucun <iframe>", () => {
    const { container } = item();
    expect(screen.getByText("Société Test")).toBeTruthy();
    expect(screen.getByText(/En attente depuis le 12\/11\/2026/)).toBeTruthy();
    expect(screen.getByText(/2 pièces jointes/)).toBeTruthy();
    expect(screen.getByText("Message personnalisé (facultatif)")).toBeTruthy();
    expect(screen.getByText(/Attention :/)).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("dl")).not.toBeNull();
  });

  it("« Approuver et envoyer » reste désactivé tant que la case n'est pas cochée", () => {
    item();
    const bouton = screen.getByRole("button", { name: "Approuver et envoyer" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((bouton as HTMLButtonElement).disabled).toBe(false);
  });
});

const props = {
  clients: [{ id: "c1", raisonSociale: "Société Test" }],
  templates: ["relance-impaye"],
  definirAction: async () => ({ data: { id: "r" } }),
  supprimerAction: async () => ({ data: { id: "r" } }),
};

describe("EmailAutomationSettings — refonte visuelle", () => {
  it("liste les règles dans un tableau à 4 colonnes", () => {
    render(
      <EmailAutomationSettings
        {...props}
        reglages={[
          { id: "r1", scope: "global", clientNom: null, template: null, mode: "auto" },
          {
            id: "r2",
            scope: "client",
            clientNom: "Société Test",
            template: "relance-impaye",
            mode: "validation",
          },
        ]}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Envoi automatique")).toBeTruthy();
    expect(within(table).getByText("Relecture requise")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Retirer la règle/ })).toHaveLength(2);
  });

  it("état vide : message inline, pas de tableau, champ Client toujours rendu", () => {
    render(<EmailAutomationSettings {...props} reglages={[]} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/Aucune règle personnalisée/)).toBeTruthy();
    const client = screen.getByLabelText("Client") as HTMLSelectElement;
    expect(client.disabled).toBe(true);
  });

  it("choisir « Envoi automatique » puis enregistrer ouvre la confirmation", async () => {
    // jsdom n'implémente pas <dialog>.showModal.
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    render(<EmailAutomationSettings {...props} reglages={[]} />);
    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "auto" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la règle" }));
    expect(await screen.findByText(/en envoi AUTOMATIQUE/)).toBeTruthy();
  });
});

// Garde de vocabulaire : aucune chaîne visible ajoutée ne contient les mots réservés.
const INTERDIT = /qualiopi|opco|financement|prise en charge|certification|cpf/i;
// Chaînes déjà présentes sur main (chemins d'import) — ni ajoutées ni retirées.
const LISTE_BLANCHE = new Set([
  "@/components/admin/qualiopi/EmailOutboxItem",
  "@/components/admin/qualiopi/EmailAutomationSettings",
  "@/server/actions/qualiopi/email-outbox",
]);
const FICHIERS = [
  "src/components/admin/qualiopi/EmailOutboxItem.tsx",
  "src/components/admin/qualiopi/EmailAutomationSettings.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/emails/page.tsx",
];

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
        (c) => INTERDIT.test(c) && !LISTE_BLANCHE.has(c),
      );
      expect(fautives).toEqual([]);
    });
  }
});
