import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  BlocActivite,
  BlocConformite,
  BlocFiabilite,
  BlocMissions,
  type MissionsLues,
} from "../FicheFormateurBlocs";

const base = {
  proposees: 0,
  acceptees: 0,
  refusees: 0,
  enAttente: 0,
  sansReponse: 0,
  expirees: 0,
  absences: 0,
  derniersRefus: [],
} satisfies MissionsLues;

const conf = {
  estSousTraitant: true,
  cumulIllisible: false,
  montantRetenuCents: 1234500,
  approcheVigilanceCents: 400000,
  seuilVigilanceCents: 500000,
};

describe("BlocActivite", () => {
  it("titre de bloc et compteurs, pluriel et « à venir »", () => {
    const { container } = render(<BlocActivite sessionsAnimees={3} sessionsAVenir={2} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Activité");
    expect(container.textContent).toContain("3 sessions Qualiopi animées · 2 à venir.");
  });
  it("singulier, sans « à venir »", () => {
    const { container } = render(<BlocActivite sessionsAnimees={1} sessionsAVenir={0} />);
    expect(container.textContent).toContain("1 session Qualiopi animée.");
    expect(container.textContent).not.toContain("à venir");
  });
});

describe("BlocConformite", () => {
  it("dossier complet : bloc vert, aucun tableau", () => {
    const { container } = render(
      <BlocConformite {...conf} nbManquements={0} bloquants={[]} alertes={[]} />,
    );
    expect(container.querySelector("section")?.getAttribute("data-teinte")).toBe("vert");
    expect(container.textContent).toContain("Dossier complet — aucun manquement.");
    expect(container.querySelector("table")).toBeNull();
  });
  it("manquements : tableau sémantique, défilement horizontal, gravités", () => {
    const { container } = render(
      <BlocConformite
        {...conf}
        nbManquements={2}
        bloquants={[{ code: "a", message: "RC pro absente" }]}
        alertes={[{ code: "b", message: "Pièce à rafraîchir" }]}
      />,
    );
    expect(container.querySelector("section")?.getAttribute("data-teinte")).toBe("terracotta");
    expect(container.querySelector("div.overflow-x-auto table")).not.toBeNull();
    expect(container.querySelectorAll("th[scope='col']")).toHaveLength(2);
    const lignes = screen.getAllByRole("row");
    expect(lignes).toHaveLength(3);
    expect(within(lignes[1]!).getByText("RC pro absente")).toBeTruthy();
    expect(container.textContent).toContain("1 manquement bloquant — ce formateur ne devrait pas");
    expect(container.textContent).toContain("12 345 € HT".replace(" ", " "));
  });
  it("l'explication du seuil est dans un <details> fermé", () => {
    const { container } = render(
      <BlocConformite {...conf} nbManquements={0} bloquants={[]} alertes={[]} />,
    );
    const d = container.querySelector("details");
    expect(d).not.toBeNull();
    expect(d?.hasAttribute("open")).toBe(false);
  });
  it("pas de cumul pour un salarié", () => {
    const { container } = render(
      <BlocConformite
        {...conf}
        estSousTraitant={false}
        nbManquements={0}
        bloquants={[]}
        alertes={[]}
      />,
    );
    expect(container.textContent).not.toContain("URSSAF");
  });
});

describe("BlocFiabilite", () => {
  it("niveau de vigilance, tableau d'incidents et aide repliée", () => {
    const { container } = render(
      <BlocFiabilite
        resume="2 incidents."
        tauxIncidentsBloquants={10}
        incidentsBloquants={1}
        niveauVigilance="vigilance_forte"
        incidents={[
          {
            id: "i1",
            dateIncident: new Date("2026-03-04T10:00:00Z"),
            titre: "Retard",
            session: { numero: "S-1" },
          },
          {
            id: "i2",
            dateIncident: new Date("2026-03-05T10:00:00Z"),
            titre: "Absence",
            session: null,
          },
        ]}
      />,
    );
    expect(container.textContent).toContain("Soit 10 % des missions.");
    expect(screen.getByText("Vigilance forte")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
  });
  it("aucune vigilance, aucun incident : ni mention ni tableau", () => {
    const { container } = render(
      <BlocFiabilite
        resume="RAS."
        tauxIncidentsBloquants={null}
        incidentsBloquants={0}
        niveauVigilance="aucune"
        incidents={[]}
      />,
    );
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).not.toContain("reconduction");
  });
});

describe("BlocMissions", () => {
  it("état vide : AdminEmptyState + absences", () => {
    const { container } = render(<BlocMissions missions={base} libelleIndependant={null} />);
    expect(screen.getByText("Aucune mission proposée par l'outil à ce jour.")).toBeTruthy();
    expect(container.textContent).toContain("Aucune absence consignée.");
    expect(container.querySelector("table")).toBeNull();
  });
  it("salarié : décompte et tableau des refus", () => {
    const { container } = render(
      <BlocMissions
        libelleIndependant={null}
        missions={{
          ...base,
          proposees: 3,
          acceptees: 1,
          refusees: 1,
          absences: 2,
          derniersRefus: [
            {
              reponduAt: new Date("2026-02-01T10:00:00Z"),
              motifRefus: "indisponible",
              session: { numero: "S-9", titreSession: "IA pour tous" },
            },
          ],
        }}
      />,
    );
    expect(container.textContent).toContain("3 proposées · 1 acceptée · 1 refusée");
    expect(container.textContent).toContain("2 absences consignées");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(container.textContent).toContain("« indisponible »");
  });
  it("indépendant : libellé fourni, titre sans « proposées », pas de tableau de refus", () => {
    const { container } = render(
      <BlocMissions
        missions={{ ...base, absences: 1 }}
        libelleIndependant="2 missions réalisées"
      />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Missions (24 derniers mois)",
    );
    expect(container.textContent).toContain("2 missions réalisées. 1 absence consignée");
    expect(container.querySelector("table")).toBeNull();
  });
});

describe("page : structure et actions inchangées", () => {
  const src = readFileSync(
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/page.tsx",
    "utf8",
  );
  it("en-tête avec badges d'état, blocs teintés, pas de marge posée sur un bloc", () => {
    expect(src).toContain("meta={");
    expect(src).toContain("<BlocActivite");
    expect(src).toMatch(/<AdminBloc\s+teinte="terracotta"/);
    expect(src).not.toMatch(/<AdminBloc[^>]*className="mb-/);
    expect(src).not.toContain('className="admin-card');
  });
  it("les actions serveur et leurs textes de confirmation sont toujours câblés", () => {
    for (const nom of [
      "genererCvFormateurAction",
      "signerContratTravailEmployeurAction",
      "contresignerLettreMissionAction",
      "addTrainerDevelopmentActionAction",
      "deleteTrainerDevelopmentActionAction",
      "updateTrainerSousTraitancePiecesAction",
    ]) {
      expect(src).toContain(nom);
    }
    expect(src).toContain('libelleBouton="Signer le contrat pour l\'employeur"');
    expect(src).toContain('libelleBouton="Contresigner la lettre de mission"');
    expect(src).toContain("CONFIRMATION_EFFACEMENT_FORMATEUR");
    expect(src).toContain("ANCRE_DEVELOPPEMENT_COMPETENCES");
  });
});

// Garde de vocabulaire : aucune chaîne visible AJOUTÉE ne contient les mots réservés.
const INTERDIT = /qualiopi|opco|financement|prise en charge|certification|cpf/i;
// Mentions déjà présentes sur main (gardées en sommeil) — ni ajoutées ni retirées.
const EXISTANT = [
  "session Qualiopi animée",
  "@/components/admin/qualiopi/",
  "@/server/qualiopi/",
  "@/server/actions/qualiopi/",
  "Admin — Qualiopi",
  "Qualiopi — Fiche formateur | Axion-IA Admin", // métadonnée existante
];

function chainesVisibles(src: string): string[] {
  const sans = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const out: string[] = [];
  for (const m of sans.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2] ?? "");
  for (const m of sans.matchAll(/>([^<>{}\n]+)</g)) out.push(m[1] ?? "");
  return out;
}

describe("garde de vocabulaire des fichiers refondus", () => {
  for (const f of [
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/FicheFormateurBlocs.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/page.tsx",
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/layout.tsx",
  ]) {
    it(`${f.split("/").pop()} : aucune chaîne visible ajoutée avec un mot réservé`, () => {
      const fautives = chainesVisibles(readFileSync(f, "utf8")).filter(
        (c) => INTERDIT.test(c) && !c.startsWith("/") && !EXISTANT.some((e) => c.includes(e)), // « / » : chemins de liens existants
      );
      expect(fautives).toEqual([]);
    });
  }
});
