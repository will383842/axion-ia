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

/**
 * 🔴 `D4-4-C` — une URL pré-signée est un DROIT D'ACCÈS ANONYME.
 *
 * Elle ne traverse aucune session, aucun jeton, aucun contrôle de rôle : qui la
 * détient lit le fichier, point. Sa durée de vie n'est donc pas un réglage de
 * confort, c'est une durée d'exposition — et ces URL atterrissent dans
 * l'historique du navigateur, dans les en-têtes `Referer`, dans les journaux de
 * proxy d'entreprise, et dans les transferts que fait le stagiaire lui-même.
 *
 * Le portail signait à **24 h** des pièces nominatives, en invoquant une raison
 * qui confond deux choses : la `pdfUrl` STOCKÉE est périmée parce qu'elle a été
 * signée à la génération ; une URL signée AU RENDU n'a besoin que de survivre
 * au clic de quelqu'un qui regarde déjà la page.
 */
describe("🔴 durée de vie des URL pré-signées", () => {
  /**
   * Extrait le contenu entre parenthèses d'un appel, parenthèses équilibrées.
   */
  function argumentsDe(source: string, debut: number): string | null {
    const ouvrante = source.indexOf("(", debut);
    if (ouvrante === -1) return null;
    let profondeur = 0;
    for (let i = ouvrante; i < source.length; i++) {
      if (source[i] === "(") profondeur++;
      else if (source[i] === ")") {
        profondeur--;
        if (profondeur === 0) return source.slice(ouvrante + 1, i);
      }
    }
    return null;
  }

  /** Découpe au PREMIER niveau seulement : `f(a, g(b, c))` rend deux morceaux. */
  function decouperAuPremierNiveau(args: string): string[] {
    const morceaux: string[] = [];
    let profondeur = 0;
    let courant = "";
    for (const c of args) {
      if (c === "(" || c === "[" || c === "{") profondeur++;
      if (c === ")" || c === "]" || c === "}") profondeur--;
      if (c === "," && profondeur === 0) {
        morceaux.push(courant);
        courant = "";
        continue;
      }
      courant += c;
    }
    if (courant.trim() !== "") morceaux.push(courant);
    return morceaux;
  }

  it("aucun appel à `getSignedUrlR2` ne s'en remet au défaut", () => {
    // Le défaut valait **90 jours**. Un appelant qui omet la durée — et rien ne
    // le lui rappelait — publiait un droit de lecture anonyme d'un trimestre.
    // C'est arrivé : `api/admin/invoices/[id]/pdf` PERSISTE cette URL de 90 j
    // dans `Invoice.pdfUrl`, soit un lien porteur rangé dans une colonne.
    //
    // Le paramètre est désormais obligatoire ; cette garde vérifie qu'aucun
    // appel ne redevient implicite si quelqu'un lui redonne un défaut.
    const fautifs: string[] = [];
    for (const fichier of fichiersSource(SRC)) {
      const source = sansCommentaires(readFileSync(fichier, "utf8"));
      let curseur = source.indexOf("getSignedUrlR2(");
      while (curseur !== -1) {
        const args = argumentsDe(source, curseur);
        if (args !== null && decouperAuPremierNiveau(args).length < 2) {
          fautifs.push(path.relative(SRC, fichier).split(path.sep).join("/"));
        }
        curseur = source.indexOf("getSignedUrlR2(", curseur + 1);
      }
    }
    expect(
      fautifs,
      "Passez la durée de vie explicitement : une URL pré-signée est un droit " +
        "d'accès anonyme, et sa durée est une décision, pas un défaut hérité.",
    ).toEqual([]);
  });

  it("le recensement n'est pas vide — sinon la garde ne garde rien", () => {
    const avecAppels = fichiersSource(SRC).filter((f) =>
      sansCommentaires(readFileSync(f, "utf8")).includes("getSignedUrlR2("),
    );
    expect(avecAppels.length).toBeGreaterThanOrEqual(5);
  });

  it("aucune pièce nominative n'est signée pour plus d'une heure", () => {
    // Garde de FAMILLE. Les surfaces de lecture nominatives — portail
    // stagiaire, pièces Qualiopi, supports, kit formateur — doivent rester dans
    // l'ordre de grandeur du clic. Le seuil est volontairement lâche (une
    // heure) : il n'interdit pas de choisir, il interdit de dériver vers la
    // journée ou le trimestre sans que personne ne le voie.
    const SURFACES_NOMINATIVES = [
      "server/qualiopi/portail/portail-service.ts",
      "app/api/qualiopi/documents/[id]/route.ts",
      "app/api/qualiopi/supports/[id]/route.ts",
      "app/api/espace-formateur/kit/[sessionId]/route.ts",
      "app/[locale]/portail/signer/[token]/page.tsx",
    ];
    const trop: string[] = [];
    for (const relatif of SURFACES_NOMINATIVES) {
      const complet = path.join(SRC, ...relatif.split("/"));
      const source = sansCommentaires(readFileSync(complet, "utf8"));
      for (const appel of ["getSignedUrlR2(", "signedDocumentPdfUrl("]) {
        let curseur = source.indexOf(appel);
        while (curseur !== -1) {
          const args = argumentsDe(source, curseur);
          const duree = args === null ? null : decouperAuPremierNiveau(args)[1];
          if (duree !== undefined && duree !== null) {
            // `15 * 60`, `900`, `TTL_LECTURE_NOMINATIVE_S`… on évalue les
            // formes arithmétiques littérales, et on ignore le reste.
            const litteral = duree.trim();
            if (/^[\d\s*+_]+$/.test(litteral)) {
              const secondes = Number(eval(litteral.replace(/_/g, "")));
              if (Number.isFinite(secondes) && secondes > 3600) {
                trop.push(`${relatif} → ${litteral} s`);
              }
            }
          }
          curseur = source.indexOf(appel, curseur + 1);
        }
      }
    }
    expect(
      trop,
      "Une URL pré-signée est lisible par quiconque la détient, sans " +
        "authentification. Sur une pièce nominative, sa durée de vie est une " +
        "durée d'exposition.",
    ).toEqual([]);
  });
});
