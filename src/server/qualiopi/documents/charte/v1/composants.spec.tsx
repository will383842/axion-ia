// @vitest-environment node

/**
 * Charte v1 — composants. Le pied de page et les bandeaux de `PageCharte` doivent porter
 * EXACTEMENT le texte de `QualiopiPage` : aucune mention légale ne change avec le style.
 */

import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Document, Text, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { QualiopiPage } from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import {
  collectPdfText,
  collectPdfTextNormalized,
} from "@/server/qualiopi/documents/collect-pdf-text";
import {
  BlocSignature,
  BlocSombre,
  Carte,
  CarteTotaux,
  Chapo,
  EncadreDoux,
  LigneChamp,
  ListePuces,
  PageCharte,
  Pastille,
  SurTitre,
  Tableau,
  Titre,
  Tuile,
} from "./composants";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Organisme Exemple SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@exemple.test",
  telephone: "0400000000",
  site: "https://exemple.test",
};

const SANS_NDA: OrganismeIdentite = { ...IDENTITE, nda: "" };
const AVEC_MENTION: OrganismeIdentite = { ...IDENTITE, qualiopi: "B-2026" };

const CORPS = "CORPS-DU-DOCUMENT";

function rendu(
  Page: typeof QualiopiPage | typeof PageCharte,
  props: Partial<React.ComponentProps<typeof PageCharte>> & { docNumber?: string },
): string {
  const el = (
    <Page
      docTitle="Devis"
      docNumber={props.docNumber ?? "AXI-DEV-2026-001"}
      identite={props.identite ?? IDENTITE}
      {...(props.estCopie !== undefined ? { estCopie: props.estCopie } : {})}
      {...(props.estSpecimen !== undefined ? { estSpecimen: props.estSpecimen } : {})}
      {...(props.specimenMotif !== undefined ? { specimenMotif: props.specimenMotif } : {})}
    >
      <Text>{CORPS}</Text>
    </Page>
  );
  return collectPdfTextNormalized(el);
}

/** Texte situé APRÈS le corps : le pied de page. */
function pied(texte: string): string {
  return texte.split(CORPS)[1]!.trim();
}

describe("PageCharte — pied de page identique à QualiopiPage", () => {
  it.each([
    ["identité complète", IDENTITE],
    ["numéro de déclaration absent", SANS_NDA],
    ["mention conditionnelle présente", AVEC_MENTION],
  ])("%s", (_nom, identite) => {
    const attendu = pied(rendu(QualiopiPage, { identite }));
    const obtenu = pied(rendu(PageCharte, { identite }));
    expect(attendu.length).toBeGreaterThan(20);
    expect(obtenu).toBe(attendu);
  });

  it("l'absence du numéro de déclaration est dite", () => {
    expect(pied(rendu(PageCharte, { identite: SANS_NDA }))).toContain(
      "Déclaration d'activité non encore enregistrée (art. L.6351-1 C. trav.)",
    );
  });

  it("le bandeau du haut porte la raison sociale, le titre et le numéro", () => {
    const t = rendu(PageCharte, {});
    expect(t).toContain("Organisme Exemple SAS");
    expect(t).toContain("Devis N° AXI-DEV-2026-001");
  });

  it("les enfants sont rendus directement dans la page", () => {
    const el = (
      <PageCharte docTitle="Devis" docNumber="N-1" identite={IDENTITE}>
        <Text>ENFANT</Text>
      </PageCharte>
    );
    const rendue = (
      PageCharte as (p: unknown) => React.ReactElement<{ children: React.ReactNode }>
    )(el.props);
    const enfants = React.Children.toArray(rendue.props.children);
    expect(enfants.some((e) => React.isValidElement(e) && e.type === Text)).toBe(true);
  });
});

describe("PageCharte — filigranes et bandeaux", () => {
  const BANDEAU_SPECIMEN_TITRE = "SPÉCIMEN — sans valeur juridique";
  const MOTIF_DEFAUT =
    "Identité de l'organisme incomplète : ce document ne peut pas être remis à un client ou un auditeur.";
  const BANDEAU_ESSAI_TITRE = "ESSAI — pièce sans valeur";
  const BANDEAU_ESSAI_TEXTE =
    "Pièce d'une session d'essai interne : numéro hors suite légale, jamais remise à un client ou un auditeur comme pièce réelle.";

  it("SPÉCIMEN : texte identique à QualiopiPage", () => {
    for (const Page of [QualiopiPage, PageCharte]) {
      const t = rendu(Page, { estSpecimen: true });
      expect(t).toContain("SPÉCIMEN");
      expect(t).toContain(BANDEAU_SPECIMEN_TITRE);
      expect(t).toContain(MOTIF_DEFAUT);
    }
  });

  it("SPÉCIMEN : le motif transmis remplace le motif par défaut", () => {
    const t = rendu(PageCharte, { estSpecimen: true, specimenMotif: "Motif précis." });
    expect(t).toContain("Motif précis.");
    expect(t).not.toContain(MOTIF_DEFAUT);
  });

  it("ESSAI : détecté au numéro, texte identique à QualiopiPage", () => {
    for (const Page of [QualiopiPage, PageCharte]) {
      const t = rendu(Page, { docNumber: "AXI-DEV-ESSAI-2026-001" });
      expect(t).toContain("ESSAI");
      expect(t).toContain(BANDEAU_ESSAI_TITRE);
      expect(t).toContain(BANDEAU_ESSAI_TEXTE);
    }
  });

  it("COPIE : affiché si demandé, absent sinon", () => {
    expect(rendu(PageCharte, { estCopie: true })).toContain("COPIE");
    expect(rendu(PageCharte, {})).not.toContain("COPIE");
    expect(rendu(QualiopiPage, { estCopie: true })).toContain("COPIE");
  });

  it("un document ordinaire n'affiche ni ESSAI ni SPÉCIMEN", () => {
    const t = rendu(PageCharte, {});
    expect(t).not.toContain("ESSAI");
    expect(t).not.toContain("SPÉCIMEN");
  });
});

describe("composants de contenu", () => {
  it("LigneChamp obligatoire et vide : même texte de manque que FieldRow", () => {
    for (const vide of ["", "   ", "—"]) {
      const t = collectPdfTextNormalized(<LigneChamp label="SIRET" value={vide} required />);
      expect(t).toContain("SIRET");
      expect(t).toContain("Non renseigné");
    }
  });

  it("LigneChamp : valeur présente affichée, vide non obligatoire sans manque", () => {
    expect(collectPdfTextNormalized(<LigneChamp label="Ville" value="Lyon" required />)).toContain(
      "Lyon",
    );
    expect(collectPdfTextNormalized(<LigneChamp label="Ville" value="" />)).not.toContain(
      "Non renseigné",
    );
  });

  it("CarteTotaux affiche les montants reçus sans rien recalculer", () => {
    const t = collectPdfTextNormalized(
      <CarteTotaux
        lignes={[
          { libelle: "Total HT", montant: "1 000,00 €" },
          { libelle: "TVA", montant: "7,00 €" },
          { libelle: "Total TTC", montant: "9 999,99 €" },
        ]}
      />,
    );
    expect(t).toContain("1 000,00 €");
    expect(t).toContain("7,00 €");
    expect(t).toContain("9 999,99 €");
    expect(t).not.toContain("1 007,00");
  });

  it("Tableau : en-têtes, cellules texte et nœuds", () => {
    const t = collectPdfTextNormalized(
      <Tableau
        columns={[
          { key: "d", header: "Désignation", flex: 3 },
          { key: "m", header: "Montant", align: "right" },
        ]}
        rows={[
          { d: "Atelier", m: "280,00 €" },
          { d: <Text>Suivi</Text>, m: 12 },
        ]}
      />,
    );
    for (const m of ["Désignation", "Montant", "Atelier", "280,00 €", "Suivi", "12"]) {
      expect(t).toContain(m);
    }
  });

  it("les autres composants rendent leur contenu", () => {
    const t = collectPdfTextNormalized(
      <>
        <SurTitre>Sur-titre</SurTitre>
        <Titre niveau={1}>Titre un</Titre>
        <Titre niveau={2}>Titre deux</Titre>
        <Titre niveau={3}>Titre trois</Titre>
        <Chapo>Chapo</Chapo>
        <Carte titre="Carte titre">Carte corps</Carte>
        <Tuile libelle="Durée" valeur="14 h" />
        <BlocSombre titre="Sombre titre">Sombre corps</BlocSombre>
        <EncadreDoux titre="Doux titre">Doux corps</EncadreDoux>
        <ListePuces items={["Un", "Deux"]} />
        <Pastille>Pastille</Pastille>
        <BlocSignature titre="Signature titre">
          <Text>Signature corps</Text>
        </BlocSignature>
      </>,
    );
    for (const m of [
      "Sur-titre",
      "Titre un",
      "Titre deux",
      "Titre trois",
      "Chapo",
      "Carte titre",
      "Carte corps",
      "Durée",
      "14 h",
      "Sombre titre",
      "Sombre corps",
      "Doux titre",
      "Doux corps",
      "Un",
      "Deux",
      "Pastille",
      "Signature titre",
      "Signature corps",
    ]) {
      expect(t).toContain(m);
    }
  });

  it("BlocSignature : non sécable, bordure 1.5 terracotta, rayon 11", () => {
    const el = (BlocSignature as (p: unknown) => React.ReactElement<Record<string, unknown>>)({
      titre: "T",
      children: null,
    });
    expect(el.props.wrap).toBe(false);
    const style = el.props.style as Record<string, unknown>;
    expect(style.borderWidth).toBe(1.5);
    expect(style.borderColor).toBe("#B23F16");
    expect(style.borderRadius).toBe(11);
    expect(style.backgroundColor).toBe("#FFFFFF");
  });
});

/** Caractères que les polices du projet ne couvrent pas, ou interdits par la charte. */
const INTERDITS = /[  ⁠☐←-⇿✓✔✅❌⬅-⬇\u{1F000}-\u{1FAFF}☀-⛿✀-➿]/u;

const MOTS_INTERDITS = [
  "certification",
  "qualiopi",
  "opco",
  "prise en charge",
  "financement",
  "financeur",
];

function toutRendre(identite: OrganismeIdentite): string {
  return collectPdfText(
    <>
      <PageCharte
        docTitle="Devis"
        docNumber="AXI-DEV-ESSAI-1"
        identite={identite}
        estCopie
        estSpecimen
      >
        <Text>x</Text>
      </PageCharte>
      <LigneChamp label="a" value="" required />
      <CarteTotaux lignes={[{ libelle: "a", montant: "1" }]} />
      <ListePuces items={["a"]} />
    </>,
  );
}

describe("textes rendus", () => {
  it("aucun caractère interdit", () => {
    for (const identite of [IDENTITE, SANS_NDA, AVEC_MENTION]) {
      expect(toutRendre(identite)).not.toMatch(INTERDITS);
    }
  });

  it("aucun caractère interdit dans le code du module (hors commentaires)", () => {
    for (const f of ["couleurs.ts", "composants.tsx", "index.ts"]) {
      const src = fs
        .readFileSync(path.join(__dirname, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(src).not.toMatch(INTERDITS);
    }
  });

  it("aucun mot interdit dans les textes fixes (mention conditionnelle absente)", () => {
    const t = toutRendre(IDENTITE).toLowerCase();
    for (const mot of MOTS_INTERDITS) expect(t).not.toContain(mot);
  });

  it("ni règle de césure globale, ni police ajoutée, ni graisse 800", () => {
    for (const f of ["couleurs.ts", "composants.tsx"]) {
      const src = fs.readFileSync(path.join(__dirname, f), "utf8");
      expect(src).not.toContain("registerHyphenationCallback");
      expect(src).not.toContain("Font.register");
      expect(src).not.toMatch(/fontWeight:\s*(800|900|"extrabold"|"black")/);
      expect(src).not.toMatch(/boxShadow|linearGradient/);
    }
  });
});

describe("rendu PDF réel", () => {
  it("tous les composants se rendent en un PDF valide (2 identités, avec filigranes)", async () => {
    for (const identite of [IDENTITE, SANS_NDA]) {
      const pdf = await renderToBuffer(
        <Document>
          <PageCharte
            docTitle="Devis"
            docNumber="AXI-DEV-ESSAI-2026-001"
            identite={identite}
            estCopie
            estSpecimen
          >
            <SurTitre>Sur-titre</SurTitre>
            <Titre niveau={1}>Titre</Titre>
            <Chapo>Chapo</Chapo>
            <Carte titre="Carte">Corps</Carte>
            <Tuile libelle="Durée" valeur="14 h" />
            <BlocSombre titre="Sombre" legende="Légende">
              Corps
            </BlocSombre>
            <EncadreDoux titre="Doux">Corps</EncadreDoux>
            <ListePuces items={["Un", "Deux"]} />
            <Pastille>Pastille</Pastille>
            <LigneChamp label="SIRET" value="" required />
            <Tableau
              columns={[
                { key: "d", header: "Désignation", flex: 3 },
                { key: "montant", header: "Montant" },
              ]}
              rows={[{ d: "Atelier", montant: "280,00 €" }]}
              emptyRows={1}
            />
            <CarteTotaux
              lignes={[
                { libelle: "Total HT", montant: "280,00 €" },
                { libelle: "Total TTC", montant: "336,00 €" },
              ]}
            />
            <BlocSignature titre="Signature">
              <Text>Lu et approuvé</Text>
            </BlocSignature>
          </PageCharte>
        </Document>,
      );
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  });
});
