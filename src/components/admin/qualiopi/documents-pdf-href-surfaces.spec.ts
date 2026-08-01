/**
 * Garde-fou CI — « un lien de téléchargement de pièce ne pointe JAMAIS sur
 * `pdfUrl` ».
 *
 * ── Ce qui s'est passé en production (2026-08-01) ───────────────────────────
 * `DocumentGenere.pdfUrl` n'est pas une adresse stable : c'est une URL R2
 * pré-signée `X-Amz-Expires=900`, calculée UNE FOIS par `storeAndSignPdf()` au
 * moment de la génération, puis figée en base. Le registre documentaire la
 * servait telle quelle dans `href`.
 *
 * Conséquence : passé quinze minutes, TOUT document devenait intéléchargeable.
 * Et comme on revient chercher une pièce des jours plus tard — pour un dossier
 * de déclaration d'activité, pour un auditeur, pour un client — c'est en
 * pratique la totalité du registre qui répondait :
 *
 *     <Error><Code>ExpiredRequest</Code><Message>Request has expired</Message></Error>
 *
 * Constaté sur la session AXI-SESS-2026-003 : les 8 documents étaient morts,
 * signés entre 16:22 et 21:40 UTC la veille. Un registre documentaire dont
 * aucune pièce ne se télécharge n'est pas un registre.
 *
 * ── Pourquoi ce test, et pas seulement le correctif ─────────────────────────
 * `/api/qualiopi/documents/[id]` existait DÉJÀ, écrite pour exactement ce
 * problème — son propre en-tête dit qu'elle est là « pour que le registre
 * documentaire reste téléchargeable indéfiniment ». Un seul appelant s'en
 * servait. Trois surfaces d'administration avaient continué à servir l'URL
 * figée, et rien ne les distinguait à la lecture : `href={doc.pdfUrl}` compile,
 * passe le typecheck, passe tous les tests, et s'affiche comme un lien normal.
 * La panne n'est visible qu'en cliquant, quinze minutes plus tard.
 *
 * C'est précisément la régression qu'un nouveau composant réintroduira sans que
 * personne ne s'en aperçoive. D'où un test qui interdit la FORME, pas seulement
 * les trois occurrences corrigées.
 *
 * ── Ce qui est vérifié ──────────────────────────────────────────────────────
 * Aucun fichier de `src/` ne rend `href={… pdfUrl …}`, sauf ceux listés dans
 * `HREF_PDFURL_LEGITIMES` — chacun avec la raison qui le rend légitime.
 *
 * ── Faire évoluer la liste ──────────────────────────────────────────────────
 * Un nouveau `href={…pdfUrl}` fait échouer ce test. Deux issues, jamais une
 * troisième :
 *   1. la pièce est un `DocumentGenere` → pointer sur
 *      `/api/qualiopi/documents/${doc.id}`, qui re-signe à la demande ;
 *   2. le `pdfUrl` vient d'un AUTRE modèle, ou a été re-signé au rendu juste
 *      avant d'être passé en prop → l'ajouter ici avec sa justification.
 * Ne jamais vider la liste pour faire passer un merge.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");

/** `href={...pdfUrl...}` sur une seule ligne ou étalé par Prettier. */
const HREF_PDFURL = /href=\{[^}]*\bpdfUrl\b/;

/**
 * Surfaces où un `href` construit sur `pdfUrl` est correct.
 * Chemins relatifs à `src/`, séparateur `/`.
 */
const HREF_PDFURL_LEGITIMES: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: "components/portail/PieceSignatureForm.tsx",
    why: "reçoit en prop une URL re-signée à CHAQUE rendu par portail/signer/[token]/page.tsx — jamais la valeur stockée",
  },
  {
    file: "components/admin/documents-interventions/SlotUploader.tsx",
    why: "InterventionDocumentSlot, pas un DocumentGenere — URL de fichier déposé, pas de pré-signature 900 s",
  },
  {
    file: "components/sections/PressReleases.tsx",
    why: "PressRelease — PDF public servi depuis l'espace presse",
  },
  {
    file: "app/[locale]/presse/[slug]/page.tsx",
    why: "PressRelease — même modèle que PressReleases.tsx",
  },
  {
    file: "app/[locale]/(admin)/[adminPrefix]/qualiopi/formations/[id]/supports/page.tsx",
    why: "FormationSupport — support pédagogique, modèle distinct",
  },
  {
    file: "app/[locale]/(admin)/[adminPrefix]/devis/[id]/page.tsx",
    why: "Quote — pdfUrl renseigné par le webhook DocuSeal, pas par storeAndSignPdf()",
  },
  {
    file: "lib/email/templates/documents-nouvelle-version.tsx",
    why: "document d'intervention, URL signée ~14 j envoyée par e-mail (aucune session pour résoudre une route applicative) ; l'e-mail porte en plus `portalUrl`, lui permanent",
  },
  {
    file: "app/[locale]/portail/mon-espace/page.tsx",
    // 🔴 DÉFAUT OUVERT, pas une exception légitime. Ce sont bien des
    // DocumentGenere, et leurs liens expirent donc au bout de 900 s comme les
    // autres : un stagiaire qui revient chercher son attestation deux jours
    // après reçoit ExpiredRequest. Non corrigé ici parce que la route
    // `/api/qualiopi/documents/[id]` exige une session admin — le portail a
    // besoin d'une route équivalente portée par le jeton du stagiaire, ce qui
    // est une décision d'exposition, pas un changement de lien.
    why: "DÉFAUT CONNU — DocumentGenere servi au stagiaire ; attend une route de téléchargement portée par jeton (pas d'auth admin dans le portail)",
  },
];

const AUTORISES = new Set(HREF_PDFURL_LEGITIMES.map((s) => s.file));

/** Fichiers de rendu susceptibles de porter un `href`. */
function fichiersTsx(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) {
      trouves.push(...fichiersTsx(complet));
      continue;
    }
    if (entree.endsWith(".tsx") && !entree.includes(".spec.")) trouves.push(complet);
  }
  return trouves;
}

describe("aucun lien de téléchargement ne pointe sur une URL R2 pré-signée figée", () => {
  it("ne rend `href={…pdfUrl}` que dans les surfaces explicitement justifiées", () => {
    const fautifs = fichiersTsx(SRC)
      .filter((f) => HREF_PDFURL.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
      .filter((rel) => !AUTORISES.has(rel));

    expect(
      fautifs,
      "Ces fichiers servent une URL R2 pré-signée 900 s comme cible de lien : elle sera périmée " +
        "quinze minutes après la génération du document. Pour un DocumentGenere, pointer sur " +
        "`/api/qualiopi/documents/${doc.id}` (re-signature à la demande). Sinon, ajouter le " +
        "fichier à HREF_PDFURL_LEGITIMES avec sa justification.",
    ).toEqual([]);
  });

  // Sans cette assertion, vider HREF_PDFURL_LEGITIMES ferait passer le test
  // ci-dessus — et rendrait le garde-fou muet le jour où il compte.
  it("garde les trois surfaces corrigées hors de la liste des exceptions", () => {
    for (const corrige of [
      "components/admin/qualiopi/DocumentsSection.tsx",
      "components/admin/coaching/AfestPanel.tsx",
      "app/[locale]/(admin)/[adminPrefix]/planning/[type]/[id]/page.tsx",
    ]) {
      expect(AUTORISES.has(corrige), `${corrige} a été réinscrit en exception`).toBe(false);
    }
  });
});
