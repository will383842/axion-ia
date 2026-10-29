/**
 * Le suivi personne par personne sur la fiche client (2026-10-27) : en-tête, lignes, badges, noms
 * selon le rôle, lien d'export, absence de l'ancien « sur 379 ». Reprend les cas de l'ancien
 * fichier des ouvertures (lecture impossible, interrupteur éteint, bouton réservé).
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { construireBandeau } from "@/features/dossier-client/bandeau-ou-en-est";
import type { QuestionnaireDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import {
  suivreParPersonne,
  type EntreeBrouillon,
  type EntreeOuverture,
  type EntreeReponse,
} from "@/features/questionnaire-preaudit/personnes";
import type { SuiviLu } from "@/features/questionnaire-preaudit/suivi-par-personne";

import { BlocQuestionnaireFiche } from "../BlocQuestionnaireFiche";

const CODE_DIR = "DIRIGEANTSECRET0000AAAA";
const ENVOYE = new Date("2026-10-25T09:00:00Z");
const T = new Date("2026-10-27T16:30:00Z");
const LONGTEMPS = new Date("2026-10-27T10:00:00Z");

const equipe = ["Alice Martin", "Bruno Durand", "Chloé Petit", "David Éloi"].map((n, i) => ({
  id: `${"abcd"[i]}`.repeat(11) + String(i),
  prenom: n.split(" ")[0],
  nom: n.split(" ")[1],
  role: "Comptable",
  journee: "Oui",
}));

const reponseDirigeant: EntreeReponse = {
  id: "r1",
  mode: "main",
  membreColonne: null,
  recuLe: LONGTEMPS,
  ecartee: false,
  charge: { membre: CODE_DIR, donnees: { equipe, ent_effectif: "20 à 49" } },
};
const brouillonInconnu = (nom: string): EntreeBrouillon => ({
  id: "33333333-3333-4333-8333-333333333333",
  mode: "emp",
  membre: "zzzzzzzzzzzz0001",
  majLe: T,
  instantane: { data: { id_prenom: nom, id_nom: "Inconnu", b_1: "x" }, pre: [] },
});
const ouverture = (m: string): EntreeOuverture => ({
  mode: "emp",
  membre: m,
  premiereOuverture: T,
  derniereOuverture: T,
  nombre: 2,
  derniereEtapeAtteinte: 1,
});

function lu(
  p: {
    reponses?: EntreeReponse[];
    brouillons?: EntreeBrouillon[];
    ouvertures?: EntreeOuverture[] | null;
  },
  sauvegarde?: Date | null | "illisible",
): Pick<QuestionnaireDeLaFiche, "parPersonne" | "derniereSauvegarde"> {
  const suivi = suivreParPersonne({
    reponses: p.reponses ?? [],
    brouillons: p.brouillons ?? [],
    ouvertures: p.ouvertures === undefined ? [] : p.ouvertures,
    estCodeDirigeant: (m) => m === CODE_DIR,
    squelette: null,
    luLe: null,
  });
  const parPersonne: SuiviLu = {
    suivi,
    controle: {
      reponses: (p.reponses ?? []).length,
      ecartees: 0,
      illisibles: 0,
      brouillons: (p.brouillons ?? []).length,
    },
    expireLe: null,
  };
  return { parPersonne, derniereSauvegarde: sauvegarde === undefined ? new Date() : sauvegarde };
}

function q(extra: Partial<QuestionnaireDeLaFiche> = {}): QuestionnaireDeLaFiche {
  return {
    id: "q1",
    rencontreId: null,
    rencontreTitre: null,
    rencontreDebut: null,
    creeLe: ENVOYE,
    envoyeLe: ENVOYE,
    expireLe: new Date("2026-12-09T09:00:00Z"),
    closLe: null,
    reponses: { dirigeant: 1, referentInformatique: 0, collaborateurs: 0, aTraiter: 1 },
    invitationEmailLogId: null,
    invitationStatut: "sent",
    ...extra,
  };
}

const bloc = (
  qq: QuestionnaireDeLaFiche,
  o: { ouv?: boolean; lire?: boolean; noms?: boolean; export?: boolean } = {},
) =>
  render(
    <BlocQuestionnaireFiche
      questionnaires={[qq]}
      adminPrefix="console"
      ficheHref="/fr/console/qualiopi/clients/c1"
      afficherOuvertures={o.ouv ?? true}
      voitBrouillons={o.noms ?? false}
      peutExporter={o.export ?? false}
      {...(o.lire ? { lireBrouillon: vi.fn() } : {})}
    />,
  ).container.textContent ?? "";

describe("en-tête et lignes", () => {
  const t = bloc(q({ ...lu({ reponses: [reponseDirigeant] }) }));
  it("dit combien sont reçus et ce qu'il manque", () => {
    expect(t).toContain("Où en sont les réponses");
    expect(t).toContain("1 sur 5 reçus : il manque 4 collaborateurs.");
    expect(t).toContain("Collaborateurs : déclarés 4 · reçus 0 · en cours 0 · manquants 4");
  });
  it("une ligne par personne déclarée, avec sa fonction", () => {
    expect(t).toContain("Alice Martin · Comptable");
    expect(t).toContain("David Éloi · Comptable");
    expect(t).toContain("Dirigeant");
    expect(t).toContain("Référent informatique");
  });
  it("badges", () => {
    expect(t).toContain("Reçue le");
    expect(t).toContain("1 à traiter");
    expect(t).toContain("Pas de nouvelles");
  });
  it("l'effectif et l'échéance du lien", () => {
    expect(t).toContain("la liste semble incomplète");
    expect(t).toContain("Le lien reçoit des réponses jusqu'au 09/12");
  });
  it("légende du taux", () => {
    expect(t).toContain("Taux = questions essentielles de son parcours");
  });
  it("jamais l'ancien « sur 379 » ni l'ancien format « questions (… %) »", () => {
    expect(t).not.toContain("sur 379");
    expect(t).not.toMatch(/questions \(\d+ %\)/);
  });
  it("jamais le code du dirigeant", () => {
    expect(t).not.toContain(CODE_DIR);
    expect(t).not.toContain("AAAA");
  });
});

describe("noms tirés d'un brouillon : réservés au super-administrateur", () => {
  const donnees = q(lu({ reponses: [reponseDirigeant], brouillons: [brouillonInconnu("Zoé")] }));
  it("masqués sans le droit", () => {
    const t = bloc(donnees);
    expect(t).not.toContain("Zoé");
    expect(t).toContain("Personne non retrouvée dans l'équipe (lien …0001)");
  });
  it("montrés avec le droit", () => {
    expect(bloc(donnees, { noms: true })).toContain("Zoé Inconnu");
  });
  it("« Lire le brouillon » seulement quand la fiche l'autorise", () => {
    expect(bloc(donnees)).not.toContain("Lire le brouillon");
    expect(bloc(donnees, { lire: true })).toContain("Lire le brouillon");
  });
});

describe("équipe lue dans le brouillon du dirigeant : noms réservés au super-administrateur", () => {
  const brouillonEquipe: EntreeBrouillon = {
    id: "bd",
    mode: "main",
    membre: "",
    majLe: new Date("2026-10-27T09:00:00Z"),
    instantane: { data: { equipe } },
  } as unknown as EntreeBrouillon;
  const donnees = q(lu({ reponses: [], brouillons: [brouillonEquipe] }));
  it("aucun nom ni effectif sans le droit", () => {
    const t = bloc(donnees);
    expect(t).not.toContain("Alice Martin");
    expect(t).not.toContain("Comptable");
  });
  it("montrés avec le droit", () => {
    expect(bloc(donnees, { noms: true })).toContain("Alice Martin");
  });
});

describe("ouvertures", () => {
  it("compte et date", () => {
    const base = lu({ reponses: [reponseDirigeant], ouvertures: [ouverture(equipe[0]!.id)] });
    expect(bloc(q(base))).toContain("2 fois, dernière le 27/10");
  });
  it("interrupteur éteint : « non suivi », jamais « pas encore »", () => {
    const r = render(
      <BlocQuestionnaireFiche
        questionnaires={[q(lu({ reponses: [reponseDirigeant], ouvertures: null }))]}
        adminPrefix="console"
        ficheHref="/f"
        afficherOuvertures={false}
      />,
    );
    const cellules = [...r.container.querySelectorAll("td")].map((c) => c.textContent);
    expect(cellules).toContain("non suivi");
    expect(cellules).not.toContain("pas encore");
  });
  it("lecture des ouvertures indisponible : dit, jamais « pas encore »", () => {
    const t = bloc(q(lu({ reponses: [reponseDirigeant], ouvertures: null })), { ouv: true });
    expect(t).toContain("suivi des ouvertures indisponible");
    expect(t).not.toMatch(/Ouvert.*pas encore$/);
  });
});

describe("panne, conservation, export", () => {
  it("lecture en panne : dit, jamais « personne n'a répondu »", () => {
    const t = bloc(q({ parPersonne: null, parPersonneEnPanne: true }));
    expect(t).toContain("Suivi par personne : lecture impossible pour le moment.");
    expect(t).not.toContain("Où en sont les réponses");
  });
  it("ligne de conservation, sans alerte avec une sauvegarde récente", () => {
    const r = render(
      <BlocQuestionnaireFiche
        questionnaires={[q(lu({ reponses: [reponseDirigeant] }, new Date()))]}
        adminPrefix="console"
        ficheHref="/f"
        afficherOuvertures
      />,
    );
    const c = r.container.querySelector('[data-bloc="conservation"]')!;
    expect(c.textContent).toContain(
      "Conservation : 1 réponse et 0 brouillon gardés, tous lisibles",
    );
    expect(c.textContent).toContain("rien n'est supprimé automatiquement (5 ans)");
    expect(c.getAttribute("data-alerte")).toBe("non");
  });
  it("alerte si la sauvegarde est trop ancienne, absente ou illisible", () => {
    for (const s of [new Date(Date.now() - 40 * 3_600_000), null, "illisible" as const]) {
      const r = render(
        <BlocQuestionnaireFiche
          questionnaires={[q(lu({ reponses: [reponseDirigeant] }, s))]}
          adminPrefix="console"
          ficheHref="/f"
          afficherOuvertures
        />,
      );
      expect(
        r.container.querySelector('[data-bloc="conservation"]')!.getAttribute("data-alerte"),
      ).toBe("oui");
    }
  });
  it("lien d'export seulement si autorisé", () => {
    const donnees = q(lu({ reponses: [reponseDirigeant] }));
    expect(bloc(donnees)).not.toContain("Télécharger une copie");
    expect(bloc(donnees, { export: true })).toContain(
      "Télécharger une copie de toutes les réponses (à garder en lieu sûr)",
    );
  });
});

describe("bandeau « Où en est ce client »", () => {
  const bandeau = (qq: Partial<QuestionnaireDeLaFiche>) =>
    construireBandeau({
      maintenant: T,
      rendezVous: [],
      questionnaires: [q(qq)],
      fil: [],
      prestations: [],
      nbDevis: 0,
    }).find((l) => l.cle === "questionnaire")!.texte;
  it("qui a répondu, sur combien, ce qui n'est pas lu", () => {
    expect(bandeau(lu({ reponses: [reponseDirigeant] }))).toBe(
      "envoyé le 25 oct. · 1 sur 5 reçus · 1 réponse à lire",
    );
  });
  it("en cours de remplissage", () => {
    const p = lu({
      reponses: [reponseDirigeant],
      brouillons: [
        {
          id: "b",
          mode: "emp",
          membre: equipe[0]!.id,
          majLe: T,
          instantane: { data: { b_1: "x" } },
        },
      ],
    });
    expect(bandeau(p)).toContain("1 sur 5 reçus · 1 en train de remplir");
  });
  it("lecture en panne : dit", () => {
    expect(bandeau({ parPersonne: null, parPersonneEnPanne: true })).toBe(
      "envoyé le 25 oct. · suivi par personne : lecture impossible",
    );
  });
  it("sans suivi chargé : la ligne d'avant", () => {
    expect(bandeau({ parPersonne: null })).toBe("envoyé le 25 oct. · 1 réponse à lire");
  });
});

describe("résumé en clair : général, équipe, postes, dates", () => {
  const t = bloc(
    q(
      lu({
        reponses: [reponseDirigeant],
        ouvertures: [ouverture(equipe[0]!.id), { ...ouverture(""), mode: "lien", nombre: 3 }],
      }),
    ),
  );
  it("dit clairement si le questionnaire général est terminé", () => {
    expect(t).toContain("1. Questionnaire général (le dirigeant)");
    expect(t).toContain("Terminé : reçu le");
  });
  it("liste l'équipe déclarée, avec le poste et ce que chacun a fait", () => {
    expect(t).toContain("2. Équipe déclarée par le dirigeant : 4 personnes");
    expect(t).toContain("0 terminé · 0 en brouillon · 3 n'ont pas commencé");
    expect(t).toContain("N'a pas commencé");
    expect(t).toContain("a ouvert son lien le 27/10");
  });
  it("montre le lien commun, hors du total", () => {
    expect(t).toContain("Lien commun (sans code personnel) : ouvert 3 fois");
  });
  it("sans le droit, aucun nom d'un brouillon n'apparaît dans le résumé", () => {
    const sans = bloc(
      q(lu({ reponses: [reponseDirigeant], brouillons: [brouillonInconnu("Zoé")] })),
    );
    expect(sans).not.toContain("Zoé");
  });
});

describe("résumé en clair : équipe lue dans le brouillon du dirigeant", () => {
  const brouillonEquipe = {
    id: "bd2",
    mode: "main",
    membre: "",
    majLe: new Date("2026-10-27T09:00:00Z"),
    instantane: { data: { equipe } },
  } as unknown as EntreeBrouillon;
  const resume = (noms: boolean): string => {
    const r = render(
      <BlocQuestionnaireFiche
        questionnaires={[q(lu({ reponses: [], brouillons: [brouillonEquipe] }))]}
        adminPrefix="console"
        ficheHref="/f"
        afficherOuvertures
        voitBrouillons={noms}
      />,
    );
    return r.container.querySelector('[data-bloc="resume-en-clair"]')?.textContent ?? "";
  };
  it("sans le droit : ni nom ni poste dans le résumé", () => {
    const t = resume(false);
    expect(t).not.toContain("Alice Martin");
    expect(t).not.toContain("Comptable");
  });
  it("avec le droit : les noms et les postes y sont", () => {
    expect(resume(true)).toContain("Alice Martin · Comptable");
  });
});
