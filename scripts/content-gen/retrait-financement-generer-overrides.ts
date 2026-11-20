/**
 * Retrait des mentions de financement — PR B : générateur d'overrides PAR FAMILLE.
 *
 * LIT un rapport d'essai à blanc (Markdown) et ÉCRIT trois fichiers dans un dossier. Il n'importe pas
 * Prisma, n'ouvre aucune connexion, n'écrit JAMAIS en base : lecture d'un fichier, écriture de fichiers.
 *
 *   pnpm tsx scripts/content-gen/retrait-financement-generer-overrides.ts \
 *     --rapport=<rapport.md> --sortie=<dossier>
 *
 * Sorties (déterministes : deux passes sur le même rapport donnent les mêmes octets) :
 *   overrides-auto.json  F1 et F4 100 % financement : un objet par champ (contenu, champ, passage d'origine,
 *                        remplacement, famille, raison, pertes acceptées). Phrases de `phrases-standard.ts`.
 *   lot-agent.jsonl      F2, F3, F4 mêlées, F6 : passage d'origine, AUCUNE proposition.
 *   a-la-main.md         F7 : cas durs, AUCUNE proposition.
 *
 * Familles : cf. `src/server/content-gen/retrait-financement/familles.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import {
  genererOverrides,
  lireRapport,
  rendreALaMain,
  rendreLotAgent,
  rendreOverridesAuto,
} from "../../src/server/content-gen/retrait-financement/familles";

function option(argv: string[], nom: string): string | null {
  return argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? null;
}

function main(argv: string[]): void {
  const rapport = option(argv, "rapport");
  const sortie = option(argv, "sortie");
  if (!rapport || !sortie)
    throw new Error(
      "Usage : --rapport=<rapport.md> --sortie=<dossier> (lecture d'un rapport, écriture de fichiers).",
    );
  const cas = lireRapport(fs.readFileSync(rapport, "utf8"));
  if (cas.length === 0) throw new Error(`Aucun cas ambigu lu dans ${rapport} : mauvais fichier ?`);
  const s = genererOverrides(cas);
  fs.mkdirSync(sortie, { recursive: true });
  fs.writeFileSync(path.join(sortie, "overrides-auto.json"), rendreOverridesAuto(s));
  fs.writeFileSync(path.join(sortie, "lot-agent.jsonl"), rendreLotAgent(s));
  fs.writeFileSync(path.join(sortie, "a-la-main.md"), rendreALaMain(s));
  const parFamille = (l: { famille: string }[]) =>
    Object.entries(
      l.reduce<Record<string, number>>(
        (m, x) => ({ ...m, [x.famille]: (m[x.famille] ?? 0) + 1 }),
        {},
      ),
    )
      .sort()
      .map(([f, n]) => `${f}:${n}`)
      .join(" ");
  console.log(
    `${cas.length} cas lus · ${s.auto.length} overrides automatiques (${parFamille(s.auto)}) · ` +
      `${s.agent.length} cas pour l'agent (${parFamille(s.agent)}) · ${s.aLaMain.length} à la main (${parFamille(s.aLaMain)})`,
  );
}

main(process.argv.slice(2));
