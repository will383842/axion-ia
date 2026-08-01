/**
 * Tests — clé R2 d'un `DocumentGenere`, et interdiction de la confusion
 * clé/URL qui a cassé la lecture avant signature.
 *
 * ── Le défaut (2026-08-01) ──────────────────────────────────────────────────
 * `portail/signer/[token]/page.tsx` affichait au signataire un lien « lire la
 * pièce » construit ainsi :
 *
 *     pdfUrl = await getSignedUrlR2(piece.pdfUrl, 15 * 60)
 *
 * `getSignedUrlR2(key, ttl)` attend une CLÉ d'objet. `piece.pdfUrl` est une URL
 * — déjà pré-signée, stockée en base. R2 signait donc un objet dont la clé
 * était l'URL elle-même, et le lien renvoyait `NoSuchKey`.
 *
 * Rien ne le signalait : `getSignedUrl` est un calcul HORS-LIGNE (aucun appel
 * réseau, aucune vérification d'existence), il ne lève pas — le `try/catch`
 * placé autour ne s'est jamais déclenché — et l'URL produite est parfaitement
 * bien formée. L'échec n'apparaît qu'au clic, chez le client.
 *
 * Ce que ça coûtait : le signataire accepte une mention affirmant qu'il a « pu
 * prendre connaissance de la pièce dans son intégralité avant de signer ».
 *
 * ── Ce qui est vérifié ──────────────────────────────────────────────────────
 * 1. `documentPdfKey` produit exactement la clé écrite par `documents-service`.
 * 2. Personne ne repasse un `pdfUrl` à `getSignedUrlR2` — la forme fautive est
 *    interdite dans tout `src/`.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { documentPdfKey } from "./r2-storage";

const SRC = path.resolve(process.cwd(), "src");

describe("documentPdfKey", () => {
  it("reproduit la clé écrite par storeAndSignPdf", () => {
    expect(
      documentPdfKey({
        type: "convention",
        numero: "AXI-DOC-2026-009",
        createdAt: new Date(2026, 6, 31, 23, 40),
      }),
    ).toBe("documents/2026/convention/AXI-DOC-2026-009.pdf");
  });

  // 🔴 L'écriture partitionne sur l'année LOCALE (`new Date().getFullYear()`).
  // Lire en UTC — comme le fait `invoicePdfKey`, légitimement, pour une autre
  // série — désignerait un autre dossier pour toute pièce émise le 31 décembre
  // au soir en Europe/Paris, et le PDF deviendrait introuvable.
  it("partitionne sur l'année LOCALE, comme l'écriture", () => {
    const saintSylvestreSoir = new Date(2026, 11, 31, 23, 30);
    expect(
      documentPdfKey({ type: "attestation", numero: "N", createdAt: saintSylvestreSoir }),
    ).toBe("documents/2026/attestation/N.pdf");
  });
});

/** Fichiers de code (hors tests) susceptibles d'appeler R2. */
function fichiersSource(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) {
      trouves.push(...fichiersSource(complet));
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (entree.includes(".spec.") || entree.includes(".test.")) continue;
    trouves.push(complet);
  }
  return trouves;
}

/** `getSignedUrlR2(<quelque chose>pdfUrl…` — la forme exacte du défaut. */
const CLE_QUI_EST_UNE_URL = /getSignedUrlR2\(\s*[^),]*[Pp]dfUrl/;

/**
 * Retire commentaires de bloc et de ligne avant de chercher la forme fautive.
 * Sans ça, le test se déclencherait sur les commentaires qui DÉCRIVENT le
 * défaut — à commencer par celui de `documentPdfKey`, qui cite l'appel fautif
 * pour expliquer pourquoi la fonction existe. Un garde-fou qui interdit de
 * documenter ce qu'il interdit finit par être désarmé.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("aucune URL n'est passée là où une clé R2 est attendue", () => {
  it("n'appelle jamais getSignedUrlR2 avec un pdfUrl", () => {
    const fautifs = fichiersSource(SRC)
      .filter((f) => CLE_QUI_EST_UNE_URL.test(sansCommentaires(readFileSync(f, "utf8"))))
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"));

    expect(
      fautifs,
      "`getSignedUrlR2` attend une CLÉ d'objet ; `pdfUrl` est une URL déjà signée. " +
        "La pré-signature ne lève pas et l'URL produite paraît valable — l'échec " +
        "n'apparaît qu'au clic, en NoSuchKey. Utiliser `signedDocumentPdfUrl(doc, ttl)`, " +
        "qui prend le document et construit la clé lui-même.",
    ).toEqual([]);
  });
});
