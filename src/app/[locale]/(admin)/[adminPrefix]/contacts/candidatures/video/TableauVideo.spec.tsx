/**
 * Vue « Monteurs & vidéastes » — rendu du tableau d'une offre (lot L1,
 * 2026-10-07). Deux familles de vérifications :
 *  - NON-RÉGRESSION : ce qui existait avant L1 est toujours là (une colonne par
 *    question, « Candidat », « Ville », « Reçue le », « Statut », le lien « gérer
 *    dans la liste », « masqué » pour un rôle sans accès, une offre sans prix
 *    rendue dans l'ordre d'arrivée, sans tri) ;
 *  - L1 : prix lisible ou « à préciser », en-tête de prix triable, bouton
 *    « ▶ N vidéos », rien de tout cela pour un rôle sans accès.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { CandidatVideo, OffreVideo } from "@/features/admin-job-applications/video-freelance";

import { Filtres, TableauOffre, type Etat } from "./TableauVideo";

const BASE = "/fr/console/contacts/candidatures";
const ETAT: Etat = { tri: "", sens: "asc", prixMax: "", ville: "", etape: "" };

function candidat(id: string, partiel: Partial<CandidatVideo> = {}): CandidatVideo {
  return {
    id,
    nom: `Nom ${id}`,
    ville: "Lyon",
    status: "new",
    submittedAt: new Date("2026-09-26T10:00:00Z"),
    reponses: {},
    videos: [],
    liens: [],
    ...partiel,
  };
}

function offre(partiel: Partial<OffreVideo>): OffreVideo {
  return {
    slug: "monteur-video-freelance-distance",
    offerId: "o1",
    titre: "Monteur vidéo freelance",
    questions: [],
    questionsPrix: [],
    questionTri: null,
    sens: "asc",
    candidats: [],
    total: 0,
    retenus: 0,
    lectureTronquee: false,
    ...partiel,
  };
}

function rendre(o: OffreVideo, etat: Etat = ETAT): string {
  return renderToStaticMarkup(
    <TableauOffre offre={o} base={BASE} chemin={`${BASE}/video`} etat={etat} />,
  );
}

describe("non-régression — ce qui existait avant L1", () => {
  const sansPrix = offre({
    questions: [
      { id: "materiel", labelFr: "Votre matériel : caméra, objectifs", required: true },
      { id: "liens", labelFr: "Liens d'exemples" },
    ],
    candidats: [
      candidat("b", { reponses: { materiel: "Sony FX3", liens: "https://vimeo.com/1" } }),
      candidat("a", { reponses: { materiel: "Canon R6" } }),
    ],
    total: 2,
    retenus: 2,
  });

  it("sur téléphone, le tableau défile horizontalement : jamais de lignes en cartes (décision du 07/10)", () => {
    const html = rendre(sansPrix);
    expect(html).toContain('class="overflow-x-auto"');
    expect(html).toContain("<thead>");
    expect(html).not.toContain("max-sm:");
    expect(html).not.toContain("data-label");
  });

  it("une colonne par question, avec l'astérisque des obligatoires, et les colonnes fixes", () => {
    const html = rendre(sansPrix);
    for (const t of ["Candidat", "Ville", "Reçue le", "Statut", "Votre matériel *", "Liens d"]) {
      expect(html).toContain(t);
    }
  });

  it("offre sans question de prix : ordre reçu, aucun « Classé par », aucun en-tête triable", () => {
    const html = rendre(sansPrix);
    expect(html.indexOf("Nom b")).toBeLessThan(html.indexOf("Nom a"));
    expect(html).not.toContain("Classé par");
    expect(html).not.toContain("aria-sort");
    expect(html).toContain("Sony FX3");
    expect(html).toContain('href="https://vimeo.com/1"');
  });

  it("le lien « gérer dans la liste » et le lien vers la fiche sont inchangés", () => {
    const html = rendre(sansPrix);
    expect(html).toContain(`href="${BASE}?offerId=o1"`);
    expect(html).toContain("gérer dans la liste");
    expect(html).toContain(`href="${BASE}/b"`);
    expect(html).toContain("2 candidatures");
  });

  it("rôle sans accès : « masqué », aucune réponse, aucun bouton vidéo", () => {
    const html = rendre(
      offre({
        questions: [{ id: "pv", labelFr: "Prix vertical", type: "price", required: true }],
        candidats: [candidat("x", { nom: null, ville: null })],
        total: 1,
        retenus: 1,
      }),
    );
    expect(html).toContain("masqué");
    expect(html).not.toContain("▶");
    expect(html).not.toContain("à préciser");
    expect(html).not.toContain("Classé par");
  });

  it("une offre sans candidature le dit, comme avant", () => {
    expect(rendre(offre({}))).toContain("Aucune candidature pour l&#x27;instant.");
  });
});

describe("L1 — prix triés et vidéos", () => {
  const avecPrix = offre({
    questions: [
      { id: "pv", labelFr: "Prix vertical", type: "price", required: true, court: "vertical" },
      { id: "ph", labelFr: "Prix horizontal", type: "price", court: "horizontal" },
    ],
    questionsPrix: ["pv", "ph"],
    questionTri: "pv",
    candidats: [
      candidat("c1", {
        reponses: { pv: "1 200 euros" },
        videos: [{ id: "v1", nom: "demo.mp4", taille: 10 }],
        liens: [{ url: "https://vimeo.com/2", plateforme: "Vimeo" }],
      }),
      candidat("c2", { reponses: { pv: "200 à 300" } }),
    ],
    total: 2,
    retenus: 2,
  });

  it("montant lisible, « à préciser » avec la saisie d'origine, jamais « HT »", () => {
    const html = rendre(avecPrix);
    expect(html).toMatch(/1\s200\s€/);
    expect(html).toContain("à préciser");
    expect(html).toContain("« 200 à 300 »");
    expect(html).not.toMatch(/\bHT\b/);
  });

  it("l'en-tête du prix qui classe porte aria-sort et inverse le sens au clic", () => {
    const html = rendre(avecPrix);
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain(`href="${BASE}/video?tri=pv&amp;sens=desc"`);
    expect(html).toContain(`href="${BASE}/video?tri=ph"`);
    expect(html).toContain("Classé par prix vertical, du moins cher au plus cher");
  });

  it("le tri garde les filtres en cours dans l'adresse", () => {
    const html = rendre(avecPrix, { ...ETAT, prixMax: "100", ville: "Lyon", etape: "new" });
    expect(html).toContain(
      `href="${BASE}/video?tri=pv&amp;sens=desc&amp;prixMax=100&amp;ville=Lyon&amp;etape=new"`,
    );
    expect(html).toContain("2 sur 2 candidatures");
  });

  it("bouton « ▶ 1 vidéo · 1 lien », et « Aucune vidéo » sinon", () => {
    const html = rendre(avecPrix);
    expect(html).toMatch(/▶<\/span> 1 vidéo · 1 lien/);
    expect(html).toContain("Aucune vidéo");
  });
});

describe("filtres", () => {
  it("rôle avec accès : prix max, ville et statut ; jamais de curseur", () => {
    const html = renderToStaticMarkup(<Filtres etat={ETAT} chemin="/x" ouvert />);
    expect(html).toContain('name="prixMax"');
    expect(html).toContain('name="ville"');
    expect(html).toContain('name="etape"');
    expect(html).not.toContain('type="range"');
  });

  it("rôle sans accès : seulement le statut (il ne voit ni prix ni ville)", () => {
    const html = renderToStaticMarkup(<Filtres etat={ETAT} chemin="/x" ouvert={false} />);
    expect(html).not.toContain('name="prixMax"');
    expect(html).not.toContain('name="ville"');
    expect(html).toContain('name="etape"');
  });
});
