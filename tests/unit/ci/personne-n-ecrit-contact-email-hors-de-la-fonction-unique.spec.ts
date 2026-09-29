/**
 * ⛔ CLIQUET — PERSONNE N'ÉCRIT `Client.contact*` HORS DE LA FONCTION UNIQUE
 * (chantier visio, plan PA-1).
 *
 * `Client.contactNom`, `contactEmail`, `contactTelephone` et `contactFonction`
 * sont la COPIE du contact de facturation (`ClientContact`). Une seule fonction
 * les écrit, avec la personne, dans la même transaction :
 * `definirContactFacturation` (`src/server/qualiopi/crm/contact-facturation.ts`).
 * Un second écrivain ferait diverger la fiche et la liste des personnes — et le
 * lien de signature du devis partirait à une adresse que le dossier ne connaît
 * pas.
 *
 * Balayage DÉRIVÉ de `src/` et `scripts/` : chaque appel
 * `.client.create|update|updateMany|upsert(…)` est extrait (parenthèses
 * équilibrées) et son argument ne doit nommer aucune des quatre colonnes ; et
 * aucun `UPDATE clients SET contact_…` en SQL.
 *
 * Exceptions NOMINATIVES, vérifiées vivantes :
 *   · `src/lib/rgpd-erase.ts` — l'effacement (art. 17) anonymise la fiche ;
 *   · un script de vérification de bout en bout sur base jetable.
 *
 * Contre-témoin : le détecteur, sur un source fictif, voit `contactEmail:` dans
 * un `update` et ignore un `contactEmail:` d'un autre modèle.
 * Angle mort : un objet construit ailleurs puis étalé (`data: { ...v }`) n'est
 * pas lu ; la revue le voit, pas ce test.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const FONCTION_UNIQUE = "src/server/qualiopi/crm/contact-facturation.ts";

const EXCEPTIONS: Readonly<Record<string, string>> = {
  "src/lib/rgpd-erase.ts": "effacement art. 17 : anonymisation de la fiche",
  "scripts/qualiopi/e2e-formations-verif.ts": "vérification de bout en bout sur base jetable",
};

const COLONNES = /\bcontact(Nom|Email|Telephone|Fonction)\b/;
const APPEL = /\.client\.(create|update|updateMany|upsert)\s*\(/g;
const SQL = /UPDATE\s+"?clients"?\s+SET[\s\S]{0,400}?\bcontact_(nom|email|telephone|fonction)\b/i;

/** L'argument d'un appel, parenthèses équilibrées, à partir de l'ouvrante. */
function argument(source: string, ouvrante: number): string {
  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i += 1) {
    const c = source[i];
    if (c === "(") profondeur += 1;
    else if (c === ")") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(ouvrante, i + 1);
    }
  }
  return source.slice(ouvrante);
}

function ecritLeContact(source: string): boolean {
  if (SQL.test(source)) return true;
  for (const m of source.matchAll(APPEL)) {
    const ouvrante = (m.index ?? 0) + m[0].length - 1;
    if (COLONNES.test(argument(source, ouvrante))) return true;
  }
  return false;
}

function balayer(): string[] {
  const trouves: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const complet = join(dossier, e.name);
      if (e.isDirectory()) {
        if (["node_modules", "generated", "__tests__", ".next"].includes(e.name)) continue;
        parcourir(complet);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
      if (/\.(spec|test)\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
      if (ecritLeContact(readFileSync(complet, "utf8"))) {
        trouves.push(relative(RACINE, complet).split("\\").join("/"));
      }
    }
  };
  for (const racine of ["src", "scripts"]) {
    const abs = join(RACINE, racine);
    if (!existsSync(abs)) throw new Error(`balayage inopérant : ${abs} introuvable`);
    parcourir(abs);
  }
  return trouves.sort();
}

describe("⛔ personne n'écrit Client.contact* hors de la fonction unique", () => {
  const ecrivains = balayer();

  it("le balayage trouve la fonction unique — sinon il ne garde rien", () => {
    expect(ecrivains).toContain(FONCTION_UNIQUE);
  });

  it("aucun autre fichier n'écrit les colonnes de contact de la fiche", () => {
    const fautifs = ecrivains.filter((f) => f !== FONCTION_UNIQUE && !(f in EXCEPTIONS));
    expect(
      fautifs,
      "ces fichiers écrivent Client.contact* sans passer par definirContactFacturation : " +
        "la fiche et le contact de facturation divergeraient",
    ).toEqual([]);
  });

  it("chaque exception nominative existe encore et écrit encore ces colonnes", () => {
    for (const f of Object.keys(EXCEPTIONS)) {
      expect(ecrivains, `exception périmée : ${f} — retire-la de la liste`).toContain(f);
    }
  });

  it("contre-témoin : le détecteur voit l'écriture, et seulement sur la table clients", () => {
    expect(ecritLeContact("await prisma.client.update({ where, data: { contactEmail: x } })")).toBe(
      true,
    );
    expect(ecritLeContact("tx.client.create({ data: { f: g(1), contactNom } })")).toBe(true);
    expect(ecritLeContact("$executeRaw`UPDATE clients SET contact_email = ${x}`")).toBe(true);
    expect(
      ecritLeContact("prisma.client.update({ data: { statut: 'x' } }); const contactEmail = 1;"),
    ).toBe(false);
    expect(ecritLeContact("prisma.sousTraitant.update({ data: { contactEmail: x } })")).toBe(false);
  });
});
