// Génère `src/content/villes/donnees-factuelles/donnees.json` (tâche X-4, vague 3).
//
// HORS LIGNE et REPRODUCTIBLE. Le script ne télécharge rien : il lit
//   1. les données INSEE déjà versionnées (`src/content/villes/data/*.ts`, importées de
//      geo.api.gouv.fr par `scripts/import-insee-villes.ts`) : population, département, région ;
//   2. OPTIONNEL — le fichier Stock Sirene des établissements, TÉLÉCHARGÉ À LA MAIN sur
//      data.gouv.fr (« Base Sirene des entreprises et de leurs établissements », fichier
//      `StockEtablissement_utf8.csv`, décompressé), pour compter les établissements actifs
//      et les divisions NAF dominantes par commune ;
//   3. OPTIONNEL — un fichier `division;libellé` des divisions NAF rév. 2, recopié de la
//      nomenclature INSEE. Sans lui, les secteurs s'affichent par leur code de division.
//
// Il ne s'exécute JAMAIS pendant `next build` (contrat stub.invalid, ADR 0026) : la page ne
// lit que le JSON produit, relu en PR.
//
// Usage :
//   pnpm tsx scripts/villes/donnees-factuelles.ts --echantillon \
//     --slugs paris,lyon,marseille,toulouse,nantes,bordeaux,lille,rennes,strasbourg,montpellier
//   pnpm tsx scripts/villes/donnees-factuelles.ts \
//     --sirene ~/Téléchargements/StockEtablissement_utf8.csv --millesime 2026-10 \
//     --naf-libelles ~/Téléchargements/naf-divisions.csv
//
// Sans `--slugs`, toutes les villes indexables (`getIndexableVillesCore`) sont traitées.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { REGIONS } from "../../src/content/regions";
import { VILLES_CORE, getIndexableVillesCore } from "../../src/content/villes/core";
import {
  fichierDonneesFactuellesSchema,
  type FichierDonneesFactuelles,
} from "../../src/content/villes/donnees-factuelles/schema";
import {
  AgregateurSirene,
  agregerLignesSirene,
  construireVille,
  lireLibellesNaf,
} from "./lib/donnees-factuelles";

const SORTIE = path.resolve("src/content/villes/donnees-factuelles/donnees.json");

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

async function lireLignes(fichier: string, surLigne: (l: string) => void): Promise<void> {
  const flux = readline.createInterface({
    input: fs.createReadStream(fichier, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const l of flux) surLigne(l);
}

async function main(): Promise<void> {
  const echantillon = process.argv.includes("--echantillon");
  const slugsArg = argument("slugs");
  const sirene = argument("sirene");
  const millesime = argument("millesime");
  const nafLibelles = argument("naf-libelles");
  // Date à laquelle les valeurs INSEE ont été RELEVÉES (import geo.api.gouv.fr), jamais la date
  // du jour : `src/content/villes/data/*.ts` a été importé le 2026-05-08 (commit 45ed2c84).
  const releve = argument("releve");
  if (!releve || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(releve)) {
    throw new Error(
      "--releve AAAA-MM-JJ obligatoire : date de l'import INSEE des données du dépôt.",
    );
  }

  if (sirene && !/^\d{4}-(0[1-9]|1[0-2])$/.test(millesime ?? "")) {
    throw new Error("--sirene exige --millesime AAAA-MM (mois du fichier Stock Sirene utilisé).");
  }

  const villes = slugsArg
    ? slugsArg.split(",").map((s) => {
        const v = VILLES_CORE.find((x) => x.slug === s.trim());
        if (!v) throw new Error(`Ville inconnue : ${s}`);
        return v;
      })
    : getIndexableVillesCore();

  const regionNom = new Map(REGIONS.map((r) => [r.slug, r.nameFr]));

  let agregats: ReadonlyMap<string, { total: number; parDivision: Map<string, number> }> | null =
    null;
  if (sirene) {
    const agregateur = new AgregateurSirene(new Set(villes.map((v) => v.inseeCode)));
    // Lecture en flux : le Stock Sirene fait plusieurs Go, on ne le charge jamais en mémoire.
    const tampon: string[] = [];
    await lireLignes(sirene, (l) => {
      tampon.push(l);
      if (tampon.length >= 10_000) {
        agregerLignesSirene(tampon.splice(0), agregateur);
      }
    });
    agregerLignesSirene(tampon, agregateur);
    agregats = agregateur.resultat();
  }

  let libelles: Map<string, string> | undefined;
  if (nafLibelles) {
    const lignes: string[] = [];
    await lireLignes(nafLibelles, (l) => lignes.push(l));
    libelles = lireLibellesNaf(lignes);
  }

  const fichier: FichierDonneesFactuelles = {
    statut: echantillon || !sirene ? "ECHANTILLON" : "COMPLET",
    genereLe: aujourdhui(),
    generePar: "scripts/villes/donnees-factuelles.ts",
    ...(echantillon || !sirene
      ? {
          note:
            "ECHANTILLON : jeu partiel. Population, département et région repris des données INSEE " +
            "versionnées ; aucun chiffre Sirene tant que le fichier Stock n'a pas été téléchargé.",
        }
      : {}),
    villes: villes.map((ville) =>
      construireVille({
        ville,
        regionNom: regionNom.get(ville.region),
        releve,
        ...(agregats && millesime
          ? {
              sirene: {
                agregat: agregats.get(ville.inseeCode),
                millesime,
                ...(libelles ? { libelles } : {}),
              },
            }
          : {}),
      }),
    ),
  };

  // Le fichier entier est refusé s'il contient un seul fait sans source ni date.
  const valide = fichierDonneesFactuellesSchema.parse(fichier);
  fs.writeFileSync(SORTIE, `${JSON.stringify(valide, null, 2)}\n`, "utf8");
  console.log(
    `[donnees-factuelles] ${valide.villes.length} ville(s) → ${SORTIE} (${valide.statut})`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
