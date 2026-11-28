// @vitest-environment node
/**
 * 🔴 Chantier QNC, L11 — CE QUE MONTRE L'ÉCRAN EST CE QUE CONTIENT LE ZIP.
 *
 * Le même modèle est rendu deux fois : par l'onglet « Dossier »
 * (`VueDossierSession`) et par l'écrivain du ZIP (`ecrireDossierComplet`).
 * On compare ce que chacun produit — les entrées, leur ordre, leurs lignes et
 * les fichiers qu'elles désignent —, pas ce que le code prétend faire.
 *
 * Témoins du même fichier :
 *   · un ORIGINAL REMPLACÉ est gardé (PDF joint sous documents/remplacees/),
 *     étiqueté « remplacée par », et hors de tout chiffre ;
 *   · un élément du BANC D'ESSAI est montré, étiqueté, et exclu des chiffres
 *     réels ;
 *   · classement destinataire → canal → date, heure de Paris.
 */

import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { renderToStaticMarkup } from "react-dom/server";

import { VueDossierSession } from "@/features/admin-qualiopi/session-hub/VueDossierSession";
import { ecrireDossierComplet } from "../ecrire-zip";
import {
  clesDossier,
  lignesIndexDossier,
  rendreDossier,
  restreindreAuxEmails,
  type ElementDossier,
  type ModeleDossierSession,
} from "../rendu";

function element(over: Partial<ElementDossier> & Pick<ElementDossier, "cle">): ElementDossier {
  return {
    nature: "piece",
    destinataire: "stagiaire",
    canal: "autre",
    date: new Date("2026-06-10T08:00:00Z"),
    titre: "titre",
    details: [],
    etiquettes: [],
    essai: false,
    horsVoyants: false,
    ...over,
  };
}

function modele(): ModeleDossierSession {
  return {
    session: {
      numero: "AXI-SESS-2026-001",
      titre: "Bien démarrer avec l'IA",
      estTestInterne: false,
    },
    elements: [
      // Volontairement dans le désordre : le classement est celui du rendu.
      element({
        cle: "email:e2",
        nature: "email",
        destinataire: "stagiaire",
        canal: "email",
        date: new Date("2026-06-11T07:30:00Z"),
        titre: "Votre avis à J+1",
        details: ["Gabarit : qualiopi-satisfaction-j1", "Adressé à : alice@example.test"],
        copie: { sujet: "Votre avis à J+1", html: "<p>Merci Alice</p>", texte: "Merci Alice" },
      }),
      element({
        cle: "email:e1",
        nature: "email",
        destinataire: "stagiaire",
        canal: "email",
        // 23 h 30 UTC = 01 h 30 à Paris le LENDEMAIN : le jour affiché est celui de Paris.
        date: new Date("2026-06-01T23:30:00Z"),
        titre: "Votre convocation",
        details: ["Gabarit : qualiopi-convocation"],
        copie: { sujet: "Votre convocation", html: "<p>Bonjour Alice</p>", texte: "Bonjour Alice" },
      }),
      element({
        cle: "piece:p1",
        destinataire: "entreprise",
        titre: "AXI-DOC-2026-001 (convention)",
        cheminPdf: "documents/convention/AXI-DOC-2026-001.pdf",
        cleStockage: "documents/2026/convention/AXI-DOC-2026-001.pdf",
      }),
      element({
        cle: "piece:p0",
        destinataire: "stagiaire",
        titre: "AXI-ATT-2026-001 (attestation)",
        etiquettes: ["Remplacée par AXI-ATT-2026-002"],
        horsVoyants: true,
        cheminPdf: "documents/remplacees/attestation/AXI-ATT-2026-001.pdf",
        cleStockage: "documents/2026/attestation/AXI-ATT-2026-001.pdf",
      }),
      element({
        cle: "remise:r1",
        nature: "remise",
        destinataire: "stagiaire",
        canal: "papier",
        titre: "Livret d'accueil",
        details: ["Stagiaire : Bob Martin"],
        essai: true,
      }),
    ],
    blocs: [
      { id: "moyens", titre: "Moyens pédagogiques", lignes: ["Salle A (salle)"] },
      { id: "reclamations", titre: "Réclamations", lignes: ["Aucune réclamation."] },
      { id: "adaptation", titre: "Adaptation (indicateur 10)", lignes: ["Réservé au référent."] },
    ],
    horsDossier: { pieces: 1, emails: 2 },
    avertissements: [],
  };
}

async function produire(m: ModeleDossierSession) {
  const rendu = rendreDossier(m);
  const html = renderToStaticMarkup(
    <VueDossierSession
      rendu={rendu}
      copies={new Map(m.elements.filter((e) => e.copie).map((e) => [e.cle, e.copie!.texte]))}
      hrefEmailsEnvoyes="/fr/x/emails-envoyes"
      avecBlocs
      noteZip="note"
    />,
  );
  const zip = new JSZip();
  // La pièce EN VIGUEUR est jointe par `genererDossierSessionZip` avant l'écrivain.
  zip.file("documents/convention/AXI-DOC-2026-001.pdf", Buffer.from("%PDF convention"));
  const lus: string[] = [];
  const ecrit = await ecrireDossierComplet(zip, m, async (cle) => {
    lus.push(cle);
    return Buffer.from(`%PDF ${cle}`);
  });
  return { rendu, html, zip, ecrit, lus };
}

/** Le texte visible d'un balisage, espaces normalisés. */
function texte(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("🔴 écran = ZIP", () => {
  it("mêmes entrées, dans le même ordre", async () => {
    const { rendu, html } = await produire(modele());
    const surEcran = [...html.matchAll(/data-cle="([^"]+)"/g)].map((m) => m[1]);
    expect(surEcran).toEqual(clesDossier(rendu));
    expect(surEcran).toHaveLength(5);
  });

  it("chaque ligne de l'index du ZIP est à l'écran, et inversement chaque entrée de l'écran est à l'index", async () => {
    const { rendu, html, zip } = await produire(modele());
    const index = await zip.file("dossier-complet/index.txt")!.async("string");
    expect(index).toBe(lignesIndexDossier(rendu).join("\n"));
    const visible = texte(html);
    for (const g of rendu.groupes) {
      expect(visible).toContain(g.libelle);
      for (const c of g.canaux) {
        for (const e of c.entrees) {
          expect(visible).toContain(e.titre);
          expect(visible).toContain(e.quand);
          for (const l of e.lignes) expect(visible).toContain(l);
          for (const et of e.etiquettes) expect(visible).toContain(et);
          for (const f of e.fichiers) {
            expect(visible).toContain(f.chemin);
            expect(zip.file(f.chemin)).not.toBeNull();
          }
          expect(index).toContain(e.titre);
        }
      }
    }
    for (const b of rendu.blocs)
      for (const l of b.lignes) {
        expect(visible).toContain(l);
        expect(index).toContain(l);
      }
  });

  it("le contenu des e-mails est joint tel qu'il est parti (HTML et texte)", async () => {
    const { zip, rendu } = await produire(modele());
    const fichiers = rendu.groupes.flatMap((g) =>
      g.canaux.flatMap((c) => c.entrees.flatMap((e) => e.fichiers)),
    );
    const html = fichiers.filter((f) => f.sorte === "html");
    expect(html).toHaveLength(2);
    const contenus = await Promise.all(html.map((f) => zip.file(f.chemin)!.async("string")));
    expect(contenus).toContain("<p>Bonjour Alice</p>");
    const txt = fichiers.find((f) => f.sorte === "texte" && f.chemin.includes("email-e1"));
    expect(await zip.file(txt!.chemin)!.async("string")).toContain("Bonjour Alice");
  });

  it("l'onglet E-mails est le même rendu, réduit aux e-mails", async () => {
    const { rendu } = await produire(modele());
    const emails = restreindreAuxEmails(rendu);
    expect(clesDossier(emails)).toEqual(clesDossier(rendu).filter((c) => c.startsWith("email:")));
    expect(emails.blocs).toEqual([]);
  });
});

describe("classement destinataire → canal → date, heure de Paris", () => {
  it("les stagiaires avant l'entreprise ; l'espace, l'e-mail, le papier, l'autre ; puis la date", async () => {
    const { rendu } = await produire(modele());
    expect(rendu.groupes.map((g) => g.destinataire)).toEqual(["stagiaire", "entreprise"]);
    const stagiaire = rendu.groupes[0]!;
    expect(stagiaire.canaux.map((c) => c.canal)).toEqual(["email", "papier", "autre"]);
    expect(stagiaire.canaux[0]!.entrees.map((e) => e.cle)).toEqual(["email:e1", "email:e2"]);
    // 2026-06-01 23:30 UTC → 02/06/2026 à 01:30 à Paris.
    expect(stagiaire.canaux[0]!.entrees[0]!.quand).toBe("02/06/2026 à 01:30 (heure de Paris)");
  });

  it("les fichiers sont nommés à l'heure de Paris, rangés par destinataire et canal", async () => {
    const { rendu } = await produire(modele());
    const e1 = rendu.groupes[0]!.canaux[0]!.entrees[0]!;
    expect(e1.fichiers.map((f) => f.chemin)).toEqual([
      "dossier-complet/stagiaire/email/2026-06-02_01h30_email-e1.html",
      "dossier-complet/stagiaire/email/2026-06-02_01h30_email-e1.txt",
    ]);
  });
});

describe("🔴 l'original remplacé est gardé, étiqueté, hors voyants", () => {
  it("son PDF est joint sous documents/remplacees/ et son étiquette est visible", async () => {
    const { zip, html, lus } = await produire(modele());
    expect(zip.file("documents/remplacees/attestation/AXI-ATT-2026-001.pdf")).not.toBeNull();
    expect(lus).toEqual(["documents/2026/attestation/AXI-ATT-2026-001.pdf"]);
    expect(texte(html)).toContain("Remplacée par AXI-ATT-2026-002");
  });

  it("il n'entre dans aucun chiffre", async () => {
    const { rendu } = await produire(modele());
    expect(rendu.chiffres[0]).toBe(
      "Chiffres réels : 1 pièce, 2 e-mails, 0 remise, 0 retour, 0 relance.",
    );
    expect(rendu.chiffres).toContain(
      "1 pièce remplacée, gardée au dossier et exclue des chiffres.",
    );
  });

  it("un modèle vierge n'est pas une pièce « remplacée » : il n'entre pas dans ce compteur", () => {
    const m = modele();
    const vierge = element({
      cle: "piece:pv",
      titre: "AXI-POS-2026-001 (positionnement)",
      etiquettes: ["Modèle vierge — non probant, non joint : x"],
      horsVoyants: true,
      modeleVierge: true,
    });
    const avec = rendreDossier({ ...m, elements: [...m.elements, vierge] });
    expect(avec.chiffres).toContain("1 pièce remplacée, gardée au dossier et exclue des chiffres.");
    const seul = rendreDossier({ ...m, elements: [vierge] });
    expect(seul.chiffres.join(" ")).not.toContain("remplacée");
  });

  it("un PDF introuvable est DÉCLARÉ absent, jamais tu", async () => {
    const zip = new JSZip();
    const ecrit = await ecrireDossierComplet(zip, modele(), async () => null);
    expect(ecrit.absents).toEqual([
      "documents/remplacees/attestation/AXI-ATT-2026-001.pdf",
      "documents/convention/AXI-DOC-2026-001.pdf",
    ]);
    const index = await zip.file("dossier-complet/index.txt")!.async("string");
    expect(index).toContain("FICHIERS DÉSIGNÉS MAIS ABSENTS DU ZIP");
  });
});

describe("🔴 essai exclu des chiffres réels", () => {
  it("l'élément d'essai est montré, étiqueté, et ne compte pas", async () => {
    const { rendu, html } = await produire(modele());
    expect(clesDossier(rendu)).toContain("remise:r1");
    expect(texte(html)).toContain("Banc d'essai — hors chiffres réels");
    expect(rendu.chiffres[0]).toContain("0 remise");
    expect(rendu.chiffres).toContain(
      "1 élément du banc d'essai, montré et exclu des chiffres réels.",
    );
  });

  it("une session du banc d'essai le dit en tête : rien n'y compte", () => {
    const m = modele();
    const rendu = rendreDossier({ ...m, session: { ...m.session, estTestInterne: true } });
    expect(rendu.entete).toContain(
      "SESSION DU BANC D'ESSAI — rien de ce dossier ne compte dans les chiffres réels de l'organisme.",
    );
  });
});
