/**
 * 🔴 `D4-5 1.1` — la route PDF de facture ne frappe plus de jeton à longue vie.
 *
 * ## Le défaut
 *
 * À CHAQUE affichage d'une facture, la route signait une URL R2 valable
 * **90 jours** — un droit d'accès anonyme, porteur, d'un trimestre. Elle la
 * persistait en clair dans `Invoice.pdfUrl` et la renvoyait en outre dans un
 * en-tête de réponse, `X-Invoice-R2-Signed-Url`.
 *
 * ⚠️ Vérifié sur le dépôt entier : **rien ne lisait ni l'un ni l'autre**. Une
 * seule occurrence de l'en-tête dans tout le dépôt — son émission ; un seul
 * écrivain de la colonne — cette route ; aucun lecteur. Le commentaire qui
 * justifiait les 90 jours (« sert de lien de facture au client pendant le
 * trimestre ») décrivait une INTENTION, pas un câblage.
 *
 * 🔑 Le motif est celui que cet audit rencontre sans cesse — *l'outil est écrit,
 * le raccordement manque* — sauf qu'ici l'outil non raccordé fabriquait un
 * secret à longue vie, à chaque consultation.
 *
 * ## Ce que ce fichier garde
 *
 * Aucun test ne couvrait cette route. Celui-ci ne prétend pas la couvrir : il
 * garde la seule chose qui compte ici, et qui se relit sans base de données —
 * qu'aucun jeton longue durée ne soit frappé, stocké ou diffusé.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

/** Le fichier, commentaires ôtés — un commentaire qui explique le défaut n'est pas le défaut. */
function lireSansCommentaires(...segments: string[]): string {
  return readFileSync(join(RACINE, ...segments), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ROUTE = lireSansCommentaires(
  "src",
  "app",
  "api",
  "admin",
  "invoices",
  "[id]",
  "pdf",
  "route.ts",
);

describe("`D4-5 1.1` — aucun jeton d'accès à longue vie sur la facture", () => {
  it("🔴 la route ne SIGNE plus d'URL", () => {
    // La signature elle-même a disparu, pas seulement sa durée : ramener
    // `getSignedUrlR2` ici rouvrirait la question entière (quelle durée ? pour
    // quel lecteur ?), et c'est exactement la question qui n'avait pas de
    // réponse.
    expect(ROUTE, "la route re-signe une URL R2").not.toContain("getSignedUrlR2");
  });

  it("🔴 aucune durée de signature ne se compte en jours", () => {
    // Attrape `90 * 24 * 3600` et ses variantes, quel que soit le nom donné.
    expect(ROUTE, "une durée de signature en jours est réapparue").not.toMatch(
      /\d+\s*\*\s*24\s*\*\s*3600/,
    );
  });

  it("🔴 le jeton n'est ni persisté, ni diffusé en en-tête", () => {
    expect(ROUTE, "une URL signée est écrite dans `Invoice.pdfUrl`").not.toContain("pdfUrl");
    expect(ROUTE, "l'en-tête qui diffusait le jeton est de retour").not.toContain(
      "X-Invoice-R2-Signed-Url",
    );
  });

  it("le témoin : l'ARCHIVAGE, lui, est toujours là", () => {
    // 🔑 Sans ce témoin, supprimer tout le bloc R2 passerait les trois tests
    // ci-dessus au vert — et on aurait « corrigé » la fuite en cessant
    // d'archiver le document fiscal, ce qui est bien pire. C'est l'archive qui
    // sert la facture après émission ; la route REFUSE de re-rendre un PDF déjà
    // haché.
    // ⚠️ On teste l'APPEL, pas le nom. Première version : `toContain("uploadToR2")`.
    // La mutation qui supprimait l'appel est passée AU VERT — la ligne d'import,
    // intacte, contenait encore le mot. Un témoin qui matche un import ne
    // témoigne de rien.
    expect(ROUTE, "le PDF n'est plus archivé dans R2").toMatch(/await uploadToR2\(/);
    expect(ROUTE, "la clé d'archive n'est plus dérivée").toMatch(/invoicePdfKey\(/);
    expect(ROUTE, "l'empreinte n'est plus persistée").toMatch(/updateData\.hashSha256\s*=/);
  });

  it("🔴 les jetons DÉJÀ persistés sont effacés par une migration", () => {
    // ⚠️ Fermer le robinet ne vide pas le seau. Les URL frappées avant le
    // correctif restaient des droits d'accès valides, jusqu'à 90 jours. Un
    // correctif qui les laisse en base laisse le risque qu'il prétend traiter.
    const purge = readFileSync(
      join(
        RACINE,
        "prisma",
        "migrations",
        "20260820230000_invoice_pdf_url_signed_purge",
        "migration.sql",
      ),
      "utf-8",
    );
    expect(purge).toContain('UPDATE "invoices"');
    expect(purge).toContain("X-Amz-Signature");
    // Et pas un effacement aveugle : la colonne peut porter une URL de paiement
    // Stripe, qui n'est pas un secret.
    expect(purge, "la purge efface toute la colonne, y compris ce qui n'est pas un secret").toMatch(
      /WHERE\s+"pdf_url"\s+LIKE/i,
    );
  });
});
