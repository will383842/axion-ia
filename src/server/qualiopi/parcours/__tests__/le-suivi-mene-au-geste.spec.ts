/**
 * Le suivi de dossier doit MENER au geste, pas seulement le décrire.
 *
 * ## Le défaut, vécu le 2026-09-04
 *
 * Will, sur son propre outil : « je n'ai pas trouvé le bouton pour
 * contresigner ». Le suivi disait pourtant, mot pour mot :
 *
 *     « Acte HABILITÉ, jamais automatique : bloc Signatures, "Contresigner". »
 *
 * Deux mots, deux erreurs : le bloc s'appelle **« Signature des pièces
 * contractuelles »**, le bouton **« Signer pour l'organisme »**. Ni l'un ni
 * l'autre n'existe sous le nom cité. Une phrase d'aide qui nomme des choses
 * absentes de l'écran est pire qu'une absence d'aide : elle envoie chercher.
 *
 * ## Puis l'audit UX du 30/09/2026
 *
 * Sept étapes menaient au bloc « Sous-pages » de la fiche : un clic pour y
 * descendre, un deuxième pour choisir la sous-page, puis une recherche aux yeux.
 * Chaque étape porte désormais une `cible` — la sous-page ET la section — et le
 * lien y mène en un clic (`hrefEtape`).
 *
 * ## Ce que ces témoins protègent
 *
 * 1. Chaque étape porte une cible.
 * 2. La cible pointe un `id` qui EXISTE réellement dans le fichier de la page
 *    ciblée — la fiche OU la sous-page, et plus seulement la fiche.
 * 3. Le libellé de la cible nomme le bloc tel qu'il s'affiche.
 *
 * Le point 2 est le seul qui rougisse si quelqu'un renomme un `id` de section
 * — c'est-à-dire exactement le glissement qui a produit le défaut d'origine.
 *
 * 4. (relecture L3) Un `id` présent dans le SOURCE n'est pas un `id` RENDU :
 *    `#signature-pieces` n'existe à l'écran que s'il y a une pièce signable.
 *    Les deux étapes de signature le visaient même sans convention — lien
 *    mort, que le point 2 ne pouvait pas voir. Le bloc dédié ci-dessous garde
 *    la CONDITION : le parcours ne vise ce bloc que quand la fiche le rend.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ANCRES_SOUS_PAGES } from "@/features/admin-qualiopi/session-hub/ancres";
import { circuitPour } from "../../documents/signature/parties-requises";
import {
  construireParcours,
  TYPES_CONVENTION,
  type SessionParcoursInput,
  type SousPageSession,
} from "../session-parcours";

const RACINE = resolve(__dirname, "../../../../..");

const CHEMIN_PARCOURS = "src/server/qualiopi/parcours/session-parcours.ts";
const FICHE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]";

/**
 * Les fichiers qui composent chaque page ciblée. La fiche rend aussi
 * `DocumentsSection`, qui porte le volet « Par stagiaire ».
 */
const FICHIERS_DE: Record<"fiche" | SousPageSession, readonly string[]> = {
  fiche: [`${FICHE}/page.tsx`, "src/components/admin/qualiopi/DocumentsSection.tsx"],
  emargement: [`${FICHE}/emargement/page.tsx`],
  evaluations: [`${FICHE}/evaluations/page.tsx`],
  financement: [`${FICHE}/financement/page.tsx`],
  kit: [`${FICHE}/kit/page.tsx`],
};

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf8");
}

/**
 * Les `id` d'une page : littéraux (`id="x"`) et gabarits à préfixe
 * (`` id={`insc-${…}`} `` → `insc-`).
 */
function idsDe(page: "fiche" | SousPageSession): { exacts: Set<string>; prefixes: Set<string> } {
  const source = FICHIERS_DE[page].map(lire).join("\n");
  const exacts = new Set<string>();
  const prefixes = new Set<string>();
  for (const m of source.matchAll(/\bid="([a-z0-9-]+)"/g)) exacts.add(m[1]!);
  for (const m of source.matchAll(/\bid=\{`([a-z0-9-]+)\$\{/g)) prefixes.add(m[1]!);
  return { exacts, prefixes };
}

function existe(page: "fiche" | SousPageSession, fragment: string): boolean {
  const { exacts, prefixes } = idsDe(page);
  return exacts.has(fragment) || [...prefixes].some((p) => fragment.startsWith(p));
}

/**
 * Les cibles LITTÉRALES déclarées dans le parcours : `cible: { sousPage?,
 * fragment, libelle }` et les constantes `CIBLE_…` (même forme d'objet).
 */
function ciblesDeclarees(): Array<{ sousPage: string | null; fragment: string; libelle: string }> {
  const source = lire(CHEMIN_PARCOURS);
  const re =
    /\{\s*(?:sousPage:\s*"([a-z]+)",\s*)?fragment:\s*"([^"]+)",\s*libelle:\s*"([^"]+)",?\s*\}/g;
  return [...source.matchAll(re)].map((m) => ({
    sousPage: m[1] ?? null,
    fragment: m[2]!,
    libelle: m[3]!,
  }));
}

/** Un dossier qui exerce les seize étapes, cibles dynamiques comprises. */
function dossier(): SessionParcoursInput {
  const d = (iso: string) => new Date(iso);
  return {
    session: {
      statut: "en_cours",
      dateDebut: d("2026-10-10T07:00:00.000Z"),
      dateFin: d("2026-10-11T15:00:00.000Z"),
      formateurPrincipalId: null,
      financementType: "opco",
    },
    documents: [],
    signaturesParPiece: new Map(),
    inscriptions: [
      {
        id: "3f2a",
        statut: "planifiee",
        financementType: null,
        emargementSigneAt: null,
        convocationEnvoyeeAt: null,
        questionnaires: [],
        evaluationFinaleAt: null,
        aUnAccesPortail: false,
        attestation: null,
      },
    ],
    liensEmargementActifs: 0,
    creneauxEmargement: 0,
    contresignature: { signees: 2, aContresigner: 1, sansDestinataire: 0, parFormateur: new Map() },
    maintenant: d("2026-10-10T12:00:00.000Z"),
  };
}

describe("le suivi de dossier mène au geste", () => {
  it("déclare au moins dix cibles littérales — sinon le test ne vérifie rien", () => {
    // Témoin positif. Sans lui, une regex cassée rendrait la suite verte en ne
    // parcourant aucune itération.
    expect(ciblesDeclarees().length).toBeGreaterThanOrEqual(10);
  });

  it("🔴 chaque cible littérale pointe un id qui EXISTE dans la page ciblée", () => {
    for (const { sousPage, fragment, libelle } of ciblesDeclarees()) {
      const page = (sousPage ?? "fiche") as "fiche" | SousPageSession;
      expect(
        existe(page, fragment),
        `La cible « ${libelle} » renvoie vers ${page}#${fragment}, qui n'est l'id d'aucun ` +
          `élément de ${FICHIERS_DE[page].join(" / ")}. Le lien mènera nulle part — c'est ` +
          `la version moderne du « bloc Signatures » qui n'existait pas.`,
      ).toBe(true);
    }
  });

  it("🔴 chaque étape CONSTRUITE (cibles dynamiques comprises) pointe un id réel", () => {
    // Les cibles de la sous-page Évaluations se composent à l'exécution
    // (`insc-{enrollmentId}`) : la regex ne les voit pas, le parcours si.
    const etapes = construireParcours(dossier()).etapes;
    expect(etapes).toHaveLength(16);
    for (const e of etapes) {
      const page = e.cible.sousPage ?? "fiche";
      expect(existe(page, e.cible.fragment), `${e.cle} → ${page}#${e.cible.fragment}`).toBe(true);
    }
  });

  it("🔴 plus aucune étape ne cible le bloc « Sous-pages »", () => {
    for (const e of construireParcours(dossier()).etapes) {
      expect(e.cible.fragment, e.cle).not.toBe("sous-pages");
    }
    expect(lire(CHEMIN_PARCOURS)).not.toMatch(/fragment:\s*"sous-pages"/);
  });

  it("chaque id du catalogue des sous-pages existe dans sa sous-page", () => {
    for (const [page, ids] of Object.entries(ANCRES_SOUS_PAGES)) {
      for (const id of ids as readonly string[]) {
        const { exacts, prefixes } = idsDe(page as SousPageSession);
        expect(
          id.endsWith("-") ? prefixes.has(id) : exacts.has(id),
          `${page} : id « ${id} » absent`,
        ).toBe(true);
      }
    }
  });

  it("aucun libellé de cible ne nomme un bloc au nom fantôme", () => {
    // Les deux noms exacts qui ont produit le défaut. Ils ne doivent plus
    // apparaître seuls : « Signatures » sans « des pièces », « Contresigner »
    // comme nom de bouton.
    for (const { libelle } of ciblesDeclarees()) {
      expect(
        /^bloc Signatures$/.test(libelle),
        `« ${libelle} » : ce bloc n'existe pas sous ce nom à l'écran. ` +
          `Il s'appelle « Signature des pièces contractuelles ».`,
      ).toBe(false);
      expect(
        /Contresigner/.test(libelle),
        `« ${libelle} » : le bouton s'appelle « Signer pour l'organisme ».`,
      ).toBe(false);
    }
  });

  it("« À traiter » ouvre le dossier À L'ÉTAPE — phase et section, pas la fiche nue", () => {
    const source = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/a-traiter/page.tsx");
    // Les échéances dépassées : le lien de l'étape elle-même.
    expect(source).toMatch(/hrefEtape\(\s*e\.sessionId,\s*e\.etape,/);
    // Les signatures : le bloc « Signature des pièces contractuelles ».
    expect(source).toMatch(/hrefEtape\(\s*s\.sessionId,[\s\S]{0,80}CIBLE_SIGNATURE_PIECES/);
    // Plus aucun lien vers la fiche nue d'une session.
    expect(source).not.toMatch(/href=\{`\$\{base\}\/qualiopi\/sessions\/\$\{e\.sessionId\}`\}/);
  });

  it("le rendu mène par hrefEtape, et n'offre « Aller à » que sur ce qui reste à faire", () => {
    // Un lien d'action sur les seize lignes noierait les trois qui comptent ;
    // une étape faite n'offre que « Voir ». La règle vit dans le composant.
    const rendu = lire("src/features/admin-qualiopi/session-hub/ChecklistSession.tsx");
    expect(rendu).toContain('e.etat !== "fait"');
    expect(rendu).toContain('e.etat !== "sans_objet"');
    expect(rendu).toContain("hrefEtape(");
    expect(rendu).not.toMatch(/href=\{`#\$\{/);
  });
});

describe("🔴 #signature-pieces n'est visé que lorsque la fiche le rend", () => {
  const ETAPES_SIGNATURE = ["convention_signee", "convention_contresignee"] as const;
  const convention = (annuleeAt: Date | null) => ({
    id: "conv",
    type: "convention",
    numero: "AXI-DOC-2026-003",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    annuleeAt,
  });
  const fragments = (documents: SessionParcoursInput["documents"]) =>
    construireParcours({ ...dossier(), documents })
      .etapes.filter((e) => (ETAPES_SIGNATURE as readonly string[]).includes(e.cle))
      .map((e) => e.cible.fragment);

  it("la fiche rend le bloc SEULEMENT s'il existe une pièce signable vivante", () => {
    // La condition que le parcours suppose. Si elle change (bloc rendu
    // toujours, ou sur un autre critère), ce test oblige à revoir la cible.
    const page = lire(`${FICHE}/page.tsx`);
    expect(page).toMatch(
      /const piecesSignables = documentsRaw\.filter\(\s*\(d\) => circuitPour\(d\.type\) !== null && d\.annuleeAt === null,?\s*\)/,
    );
    expect(page).toMatch(/\{piecesSignables\.length > 0 && \(\s*<div\s+id="signature-pieces"/);
  });

  it("chaque forme de convention a un circuit : une convention vivante EST une pièce signable", () => {
    for (const t of TYPES_CONVENTION) expect(circuitPour(t), t).not.toBeNull();
  });

  it.each([
    ["aucune convention générée", [] as SessionParcoursInput["documents"]],
    ["la seule convention est annulée", [convention(new Date("2026-09-02T00:00:00.000Z"))]],
  ])("%s : les deux étapes mènent au bloc Documents, toujours rendu", (_cas, documents) => {
    expect(fragments(documents)).toEqual(["documents", "documents"]);
    expect(existe("fiche", "documents")).toBe(true);
  });

  it("TÉMOIN — convention vivante : les deux étapes mènent au bloc des signatures", () => {
    expect(fragments([convention(null)])).toEqual(["signature-pieces", "signature-pieces"]);
  });
});
