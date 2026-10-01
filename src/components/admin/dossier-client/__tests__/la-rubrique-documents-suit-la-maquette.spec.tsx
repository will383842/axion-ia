/**
 * LA RUBRIQUE « DOCUMENTS » SUIT LA MAQUETTE (2-ux.md, 2-maquette.html).
 *
 * Rendu RÉEL de `CarteDocuments` (la partie sans base de la rubrique) et du
 * compteur de l'onglet Projets :
 *   · deux groupes, « Envoyé au client » puis « Interne », chacun compté, le
 *     plus récent en haut (date d'envoi / date d'ajout) ;
 *   · une ligne : nature écrite, date, auteur, taille ou domaine ; « Ouvrir »
 *     (nouvel onglet, noopener) pour un lien, « Télécharger » pour un fichier ;
 *     « Archiver » ; jamais « Supprimer » ;
 *   · les archivés à part, ne comptent pas, avec « Réafficher » ;
 *   · l'état vide utile, formulaire ouvert ;
 *   · « Copier le lien client » seulement pour une page partageable ;
 *   · « 6 documents » dans la liste des projets, mène à `#documents`.
 *
 * Mutations qui rougissent : compter les archivés ; inverser le tri ; perdre
 * `rel="noopener noreferrer"` ; afficher le bouton de partage sur un PDF.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));
const lectures = vi.hoisted(() => ({
  documents: [] as unknown[],
  ouverturesDemandees: [] as string[][],
}));
vi.mock("@/features/dossier-client/documents/queries", async (original) => ({
  ...(await original<typeof import("@/features/dossier-client/documents/queries")>()),
  lireDocumentsDuProjet: async () => lectures.documents,
  lireOuvertures: async (ids: string[]) => {
    lectures.ouverturesDemandees.push([...ids]);
    return {};
  },
}));
vi.mock("@/features/dossier-client/documents/actions", () => ({
  ajouterDocumentFormAction: vi.fn(),
  archiverDocumentFormAction: vi.fn(),
  reafficherDocumentFormAction: vi.fn(),
}));
vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
  garderCetteValeurFormAction: vi.fn(),
}));

import {
  CarteDocuments,
  DocumentsDuProjet,
} from "@/components/admin/dossier-client/DocumentsDuProjet";
import { OngletProjets } from "@/components/admin/dossier-client/Onglets";
import type { DocumentDeLaListe } from "@/features/dossier-client/documents/queries";
import type { ProjetDuDossier } from "@/features/dossier-client/queries";

const PROJET = "22222222-2222-4222-8222-222222222222";
const HREF = `/fr/admin-x/qualiopi/clients/11111111-1111-4111-8111-111111111111/projets/${PROJET}`;

function doc(p: Partial<DocumentDeLaListe> & { id: string; titre: string }): DocumentDeLaListe {
  return {
    cote: "envoye_au_client",
    nature: "page_en_ligne",
    envoyeLe: new Date("2026-09-30T00:00:00Z"),
    lienUrl: "https://axion-ia.com/fr/exemple",
    fichierNom: null,
    fichierFormat: null,
    fichierTailleOctets: null,
    analyseAntivirus: null,
    archiveLe: null,
    createdAt: new Date("2026-09-30T10:00:00Z"),
    auteur: "Williams",
    ...p,
  };
}

const TELEOS: DocumentDeLaListe[] = [
  doc({
    id: "d1",
    titre: "E-mail « Votre journée d'audit IA »",
    nature: "email",
    lienUrl: null,
    fichierNom: "envoi.eml",
    fichierFormat: "eml",
    fichierTailleOctets: 18 * 1024,
    analyseAntivirus: "sain",
    envoyeLe: new Date("2026-09-28T00:00:00Z"),
  }),
  doc({ id: "d2", titre: "Console d'exemple", envoyeLe: new Date("2026-09-30T00:00:00Z") }),
  doc({
    id: "d3",
    titre: "Programme de la journée d'audit",
    nature: "page_en_ligne",
    lienUrl: null,
    fichierNom: "programme.html",
    fichierFormat: "html",
    fichierTailleOctets: 40_000,
    analyseAntivirus: "sain",
    envoyeLe: new Date("2026-09-29T00:00:00Z"),
  }),
  doc({
    id: "d4",
    titre: "Guide de l'auditeur",
    cote: "interne",
    nature: "pdf",
    envoyeLe: null,
    lienUrl: null,
    fichierNom: "guide.pdf",
    fichierFormat: "pdf",
    fichierTailleOctets: Math.round(2.1 * 1024 * 1024),
    analyseAntivirus: "sain",
  }),
  doc({
    id: "d5",
    titre: "Programme de la journée d'audit (première version)",
    archiveLe: new Date("2026-10-01T09:00:00Z"),
    envoyeLe: new Date("2026-09-29T00:00:00Z"),
  }),
];

function rendre(
  documents: DocumentDeLaListe[],
  extra: Partial<Parameters<typeof CarteDocuments>[0]> = {},
) {
  return renderToStaticMarkup(
    <CarteDocuments
      clientId="11111111-1111-4111-8111-111111111111"
      projetId={PROJET}
      projetHref={HREF}
      documents={documents}
      ouvertures={{}}
      // Un lien pour TOUS les documents : seule `estPartageable` (dans la ligne)
      // peut alors réserver le bouton à la page partageable.
      liensPublics={Object.fromEntries(
        documents.map((d) => [d.id, `https://axion-ia.com/document/${d.id}/jeton`]),
      )}
      nbQuestionnaires={1}
      message={null}
      erreur={null}
      aujourdhui="2026-10-01"
      {...extra}
    />,
  );
}

describe("la rubrique Documents suit la maquette", () => {
  it("deux groupes comptés, archivés exclus, ancre #documents", () => {
    const html = rendre(TELEOS);
    expect(html).toContain('id="documents"');
    expect(html).toMatch(/Documents[\s\S]{0,200}aria-label="4 documents"/);
    expect(html).toContain("Envoyé au client · 3");
    expect(html).toContain("Interne · 1");
    expect(html.indexOf("Envoyé au client · 3")).toBeLessThan(html.indexOf("Interne · 1"));
  });

  it("le plus récent en haut, par date d'envoi", () => {
    const html = rendre(TELEOS);
    const a = html.indexOf("Console d&#x27;exemple");
    const b = html.indexOf("Programme de la journée d&#x27;audit<");
    const c = html.indexOf("Votre journée d&#x27;audit IA");
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("une ligne dit nature, date, auteur, taille ou domaine", () => {
    const html = rendre(TELEOS);
    expect(html).toContain("E-mail · envoyé le 28/09/2026 · ajouté par Williams · 18 Ko");
    expect(html).toContain(
      "Page en ligne · envoyé le 30/09/2026 · ajouté par Williams · axion-ia.com",
    );
    expect(html).toContain("PDF · ajouté le 30/09/2026 par Williams · 2,1 Mo");
  });

  it("un lien s'ouvre dans un nouvel onglet sans transmettre l'origine ; un fichier se télécharge", () => {
    const html = rendre(TELEOS);
    expect(html).toMatch(
      /href="https:\/\/axion-ia\.com\/fr\/exemple" target="_blank" rel="noopener noreferrer"/,
    );
    expect(html).toContain("(nouvel onglet)");
    expect(html).toContain(`href="${HREF}/documents/d4"`);
    expect(html).toContain("Télécharger");
    expect(html).toContain("« Guide de l&#x27;auditeur » (PDF, 2,1 Mo)");
  });

  it("chaque document actif a « Archiver » ; aucun « Supprimer » nulle part", () => {
    const html = rendre(TELEOS);
    expect(html.match(/>Archiver</g)?.length).toBe(4);
    expect(html).not.toMatch(/Supprimer|Modifier/);
  });

  it("les archivés sont à part, comptés à part, réaffichables, toujours consultables", () => {
    const html = rendre(TELEOS);
    expect(html).toContain("Documents archivés (1)");
    expect(html).toContain("archivé le 01/10/2026");
    expect(html.match(/>Réafficher</g)?.length).toBe(1);
    expect(html).toContain("Envoyé au client · Page en ligne · envoyé le 29/09/2026");
  });

  it("« Copier le lien client » seulement pour la page envoyée, saine et visible", () => {
    const html = rendre(TELEOS);
    expect(html.match(/Copier le lien client/g)?.length).toBe(1);
    expect(html).toContain("https://axion-ia.com/document/d3/jeton");
    for (const autre of ["d1", "d2", "d4", "d5"]) {
      expect(html).not.toContain(`/document/${autre}/jeton`);
    }
  });

  it("le producteur ne fabrique un lien public, et ne lit les ouvertures, QUE pour la page partageable", async () => {
    const uuid = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;
    lectures.documents = TELEOS.map((d, i) => ({ ...d, id: uuid(i + 1) }));
    lectures.ouverturesDemandees = [];
    const element = await DocumentsDuProjet({
      clientId: "11111111-1111-4111-8111-111111111111",
      projetId: PROJET,
      projetHref: HREF,
      nbQuestionnaires: 0,
      recherche: {},
    });
    const html = renderToStaticMarkup(element);
    // d3 (index 2) est la seule page envoyée, HTML, saine et visible.
    expect(lectures.ouverturesDemandees).toEqual([[uuid(3)]]);
    expect(html.match(/Copier le lien client/g)?.length).toBe(1);
    expect(html).toMatch(
      new RegExp(`https://axion-ia[.]com/document/${uuid(3)}/[A-Za-z0-9_-]{43}`),
    );
    for (const i of [1, 2, 4, 5]) expect(html).not.toContain(`/document/${uuid(i)}/`);
  });

  it("la ligne du questionnaire mène à sa vue et ne compte pas", () => {
    const html = rendre(TELEOS);
    expect(html).toContain("Questionnaire de cadrage et réponses du client →");
    expect(html).toContain(`href="${HREF}?vue=questionnaire"`);
    expect(rendre(TELEOS, { nbQuestionnaires: 0 })).not.toContain("Questionnaire de cadrage");
  });

  it("projet vide : la phrase utile, le formulaire déjà ouvert, ni groupes ni archivés", () => {
    const html = rendre([]);
    expect(html).toContain(
      "Rangez ici tout ce qui concerne ce projet : ce que vous avez envoyé au client (e-mail, PDF, liens) et vos documents internes.",
    );
    expect(html).toMatch(/<details[^>]*open=""[^>]*>\s*<summary[^>]*>\+ Ajouter un document/);
    expect(html).not.toContain("Envoyé au client ·");
    expect(html).not.toContain("Documents archivés");
  });

  it("un groupe vide dit pourquoi ; tout archivé : les deux phrases et le repli", () => {
    const html = rendre([TELEOS[4]!]);
    expect(html).toContain("Rien d&#x27;envoyé au client pour l&#x27;instant.");
    expect(html).toContain("Aucun document interne pour l&#x27;instant.");
    expect(html).toContain("Documents archivés (1)");
  });

  it("le formulaire porte les libellés exacts", () => {
    const html = rendre([]);
    for (const libelle of [
      "Ce document a été…",
      "Gardé en interne",
      "Coller un lien",
      "Une adresse qui commence par https://",
      "ou choisir un fichier",
      "PDF, Word, Excel, PowerPoint, image, e-mail (.eml), page web, texte · 15 Mo au plus",
      "Laissez vide pour reprendre le nom du fichier ou du site",
      "Je laisse deviner",
      "Date d&#x27;envoi au client",
      "Seulement pour un document envoyé. Aujourd&#x27;hui par défaut.",
      "Ajouter le document",
    ]) {
      expect(html, libelle).toContain(libelle);
    }
    expect(html).toContain('value="2026-10-01"');
  });

  it("un message d'erreur rouvre le formulaire, en alerte", () => {
    const html = rendre(TELEOS, { erreur: "Collez un lien ou choisissez un fichier." });
    expect(html).toMatch(/role="alert"[^>]*>Collez un lien ou choisissez un fichier\./);
    expect(html).toMatch(/<details[^>]*open=""/);
  });

  it("après un archivage : le message nomme le document et propose « Annuler »", () => {
    const html = rendre(TELEOS, { message: "archive:d5" });
    expect(html).toContain(
      "« Programme de la journée d&#x27;audit (première version) » est archivé.",
    );
    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/>Annuler</);
  });
});

describe("le compteur de la liste des projets", () => {
  const projet: ProjetDuDossier = {
    id: PROJET,
    numero: "AXI-PRJ-2026-014",
    titre: "Journée d'audit IA",
    statut: "ouvert",
    derniereReouvertureLe: null,
    createdAt: new Date("2026-09-01"),
    devis: [],
    nbQuestionnaires: 1,
    contacts: [],
  } as unknown as ProjetDuDossier;

  function liste(nbDocuments?: Record<string, number>) {
    return renderToStaticMarkup(
      <OngletProjets
        clientId="c"
        projets={[projet]}
        faitsARanger={[]}
        ficheHref="/fr/admin-x/qualiopi/clients/c"
        qBase="/fr/admin-x/qualiopi"
        erreur={null}
        {...(nbDocuments ? { nbDocuments } : {})}
      />,
    );
  }

  it("« 6 documents » mène à la rubrique ; « 1 document » au singulier", () => {
    expect(liste({ [PROJET]: 6 })).toContain(
      `href="/fr/admin-x/qualiopi/clients/c/projets/${PROJET}#documents"`,
    );
    expect(liste({ [PROJET]: 6 })).toContain("6 documents");
    expect(liste({ [PROJET]: 1 })).toMatch(/>1 document</);
  });

  it("zéro document, ou compteur absent : rien n'est affiché", () => {
    expect(liste({ [PROJET]: 0 })).not.toMatch(/\d+ documents?</);
    expect(liste()).not.toMatch(/\d+ documents?</);
  });
});
