import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 🔴 TOUTE COLONNE D'EMPREINTE D'E-MAIL DOIT PORTER SON INDEX **DANS CE
 * SCHÉMA**, pas seulement dans une migration.
 *
 * ## Le défaut fermé (mesuré le 2026-09-04)
 *
 * Sur les quatre modèles du dépôt qui portent une empreinte d'adresse, trois
 * déclaraient leur index ici. **`JobApplication` ne le déclarait pas** — alors
 * que l'index existe bel et bien en production (`Index Scan using
 * job_applications_email_hash_idx`, lu sur un plan réel), créé par une
 * migration BRUTE du 2026-08-20.
 *
 * ## Pourquoi cet écart est dangereux, et pas cosmétique
 *
 * Prisma tient le schéma pour la source de vérité. Un index présent en base et
 * absent du schéma est une DÉRIVE : la prochaine migration régénérée depuis le
 * schéma émet un `DROP INDEX`, et personne ne le lit dans un diff de migration.
 *
 * Ce qui tomberait alors n'est pas de la performance de confort :
 *
 * · l'**export art. 15** et l'**effacement art. 17** cherchent une candidature
 *   PAR CETTE EMPREINTE — `email` est chiffré à IV aléatoire, donc introuvable
 *   par égalité SQL. C'est la raison d'être de la colonne ;
 * · la **clé de rapprochement d'une personne** entre `Submission` (tunnel
 *   apporteurs) et `JobApplication` (recrutement) est cette même empreinte.
 *
 * Sur 86 lignes la perte d'index ne se verrait pas. Sur dix mille, si — et le
 * jour où ça se verra, personne ne fera le lien avec un `DROP INDEX` glissé
 * dans une migration six mois plus tôt.
 *
 * ## Ce que cette garde ne fait pas
 *
 * Elle ne vérifie pas que l'index existe EN BASE — un test unitaire n'a pas la
 * base sous la main. Elle vérifie que le schéma le DÉCLARE, ce qui est
 * précisément la moitié qui manquait : la base l'avait, le schéma non.
 */

const SCHEMA = resolve(__dirname, "../../../prisma/schema.prisma");

/** Un nom de champ qui désigne une empreinte d'adresse e-mail. */
const CHAMP_EMPREINTE = /^\s*(\w*[eE]mailHash)\s+String/;

type Modele = { nom: string; corps: string; ligne: number };

/** Découpe le schéma en modèles, avec leur corps et leur ligne de départ. */
function modeles(): Modele[] {
  const lignes = readFileSync(SCHEMA, "utf8").split(/\r?\n/);
  const out: Modele[] = [];
  let courant: { nom: string; ligne: number; lignes: string[] } | null = null;

  for (let i = 0; i < lignes.length; i += 1) {
    const l = lignes[i] as string;
    const debut = /^model\s+(\w+)\s*\{/.exec(l);
    if (debut !== null) {
      courant = { nom: debut[1] as string, ligne: i + 1, lignes: [] };
      continue;
    }
    if (courant === null) continue;
    if (/^\}/.test(l)) {
      out.push({ nom: courant.nom, corps: courant.lignes.join("\n"), ligne: courant.ligne });
      courant = null;
      continue;
    }
    courant.lignes.push(l);
  }
  return out;
}

/**
 * Vrai si le modèle indexe ce champ — par `@@index([champ])`, par
 * `@@unique([champ])`, ou par un `@unique` posé sur la ligne du champ.
 * Un index composé qui COMMENCE par le champ compte aussi : Postgres peut
 * l'utiliser pour une égalité sur la première colonne.
 */
function estIndexe(corps: string, champ: string): boolean {
  const surLaLigne = new RegExp(`^\\s*${champ}\\s+String[^\\n]*@unique`, "m");
  if (surLaLigne.test(corps)) return true;
  const bloc = new RegExp(`@@(index|unique)\\(\\s*\\[\\s*${champ}\\s*[,\\]]`);
  return bloc.test(corps);
}

describe("🔴 une empreinte d'e-mail sans index déclaré est une dérive qui s'efface en silence", () => {
  const tous = modeles();

  it("le schéma se découpe bien en modèles (TÉMOIN+)", () => {
    // 🔑 Sans ce témoin, « aucun fautif » ne se distingue pas de « mon
    // découpage n'a rien trouvé » — une accolade déplacée, un `model` renommé,
    // et la garde rend un vert d'aveugle.
    expect(tous.length).toBeGreaterThan(50);
    expect(tous.map((m) => m.nom)).toContain("JobApplication");
    expect(tous.map((m) => m.nom)).toContain("Submission");
  });

  it("TÉMOIN+ : des colonnes d'empreinte sont bien détectées", () => {
    const porteurs = tous.filter((m) => m.corps.split("\n").some((l) => CHAMP_EMPREINTE.test(l)));
    // Au 2026-09-04 : Submission, JobApplication, CrmInboundEvent,
    // PodcastRequest, EmailOpposition. Un chiffre qui tomberait à 0 voudrait
    // dire que le motif ne reconnaît plus rien, pas que le dépôt est propre.
    expect(porteurs.length).toBeGreaterThanOrEqual(4);
  });

  it("chaque colonne d'empreinte d'e-mail porte un index DÉCLARÉ dans le schéma", () => {
    const fautifs: string[] = [];

    for (const m of tous) {
      for (const l of m.corps.split("\n")) {
        const trouve = CHAMP_EMPREINTE.exec(l);
        if (trouve === null) continue;
        const champ = trouve[1] as string;
        if (!estIndexe(m.corps, champ)) {
          fautifs.push(`${m.nom}.${champ} (schema.prisma:${m.ligne})`);
        }
      }
    }

    expect(
      fautifs,
      `Ces colonnes d'empreinte d'e-mail n'ont AUCUN index déclaré dans ` +
        `prisma/schema.prisma.\n\n` +
        `Si l'index existe malgré tout en base — créé par une migration brute — ` +
        `c'est PIRE que s'il manquait : Prisma tient le schéma pour la vérité, et ` +
        `la prochaine migration régénérée depuis le schéma émettra un DROP INDEX ` +
        `que personne ne lira. Ce qui tombera alors, c'est l'export art. 15, ` +
        `l'effacement art. 17, et la clé de rapprochement d'une personne entre ` +
        `Submission et JobApplication.\n\n` +
        `Correctif : ajouter \`@@index([<champ>])\` au modèle. Vérifier d'abord ` +
        `que le nom généré par Prisma (\`<table>_<colonne>_idx\`) est bien celui ` +
        `qui existe déjà en base, sinon la migration en créera un second.\n\n` +
        `Fautifs :\n  - ${fautifs.join("\n  - ")}`,
    ).toEqual([]);
  });
});
