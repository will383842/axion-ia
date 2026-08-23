#!/usr/bin/env tsx
/**
 * Génère la FIXTURE du dossier LinkedIn Q4 — `tests/fixtures/editorial/linkedin-q4/`.
 *
 * ⚠️ Pourquoi une fixture, et ce qu'elle ne prouve pas.
 *
 * Les sources réelles du §6 — `Linkedin complet.zip`, `02-calendrier-publication.csv`,
 * `10-LES-61-POSTS.md` — sont INTROUVABLES sur cette machine (ni dépôt, ni
 * Documents, Downloads, Desktop, OneDrive). Plutôt que d'attendre, le lot 0
 * avance sur une fixture FIDÈLE AU FORMAT décrit au §6 : séparateur `;`,
 * UTF-8 BOM, CRLF, sections `## #N`.
 *
 * Ce que la fixture prouve : que l'import lit ce format, qu'il est idempotent,
 * transactionnel, et qu'il rend le bon compte.
 * Ce qu'elle NE prouve PAS : que les VRAIES données passent. Trois des six
 * critères du lot 0 restent à confirmer sur le dossier réel, et le rapport de
 * lot doit le dire sans l'enjoliver.
 *
 * Déterministe : aucun aléa, aucune horloge. Deux exécutions rendent deux
 * fichiers identiques au bit près — sinon la fixture polluerait chaque diff.
 *
 * Usage : `tsx scripts/editorial/generer-fixture-linkedin.ts`
 */

import fs from "node:fs";
import path from "node:path";
import { TAGS_AUTORISES } from "../../src/server/editorial/referentiels/conformite";

const DESTINATION = path.join(process.cwd(), "tests", "fixtures", "editorial", "linkedin-q4");

/** 61 publications sur les quatre mois du trimestre — « voir les quatre mois ». */
const REPARTITION = [
  { mois: 9, annee: 2026, combien: 15 },
  { mois: 10, annee: 2026, combien: 16 },
  { mois: 11, annee: 2026, combien: 15 },
  { mois: 12, annee: 2026, combien: 15 },
] as const;

const FORMATS = [
  "texte",
  "carrousel",
  "video",
  "image",
  "texte",
  "photo",
  "texte",
  "carrousel",
] as const;

const HEURES = ["7h45", "8h30", "12h15", "7h45", "18h00"] as const;
const LIENS = ["", "reservation", "", "candidature", "", "newsletter", ""] as const;

/** Jours ouvrés du mois, dans l'ordre — on ne publie pas le week-end. */
function joursOuvres(annee: number, mois: number): number[] {
  const jours: number[] = [];
  const dernier = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  for (let j = 1; j <= dernier; j += 1) {
    const jour = new Date(Date.UTC(annee, mois - 1, j)).getUTCDay();
    if (jour !== 0 && jour !== 6) jours.push(j);
  }
  return jours;
}

interface Row {
  numero: number;
  date: string;
  heure: string;
  format: string;
  accroche: string;
  production: string;
  photoWill: string;
  lien: string;
  echoPage: string;
  tags: string;
  note: string;
}

function construireLignes(): Row[] {
  const rows: Row[] = [];
  let numero = 0;

  for (const bloc of REPARTITION) {
    const ouvres = joursOuvres(bloc.annee, bloc.mois);
    // Étalement régulier sur le mois, sans jamais retomber deux fois le même jour.
    const pas = Math.floor(ouvres.length / bloc.combien) || 1;

    for (let k = 0; k < bloc.combien; k += 1) {
      numero += 1;
      const jour = ouvres[Math.min(k * pas, ouvres.length - 1)] ?? 1;
      const format = FORMATS[numero % FORMATS.length] ?? "texte";

      // 3 ou 4 tags, pris dans la liste fermée — la règle `tags-nombre` exige
      // la fourchette, la règle `tags-liste` exige la provenance.
      const combienTags = numero % 3 === 0 ? 4 : 3;
      const tags: string[] = [];
      for (let t = 0; t < combienTags; t += 1) {
        tags.push(`#${TAGS_AUTORISES[(numero * 3 + t) % TAGS_AUTORISES.length] ?? "IAPourPME"}`);
      }

      rows.push({
        numero,
        date: `${String(jour).padStart(2, "0")}/${String(bloc.mois).padStart(2, "0")}/${bloc.annee}`,
        heure: HEURES[numero % HEURES.length] ?? "07:45",
        format,
        // Une accroche sur deux porte un `;` et des guillemets : c'est
        // exactement ce qui casse un `split(";")` naïf, donc c'est ce qu'il
        // faut que la fixture contienne.
        accroche:
          numero % 2 === 0
            ? `Ce que personne ne dit sur l'IA en PME ; et pourquoi c'est "gênant"`
            : `Trois signaux qu'un processus vous coûte plus qu'il ne rapporte`,
        production: format === "video" || format === "carrousel" ? "oui" : "",
        photoWill: format === "photo" ? "oui" : "",
        lien: LIENS[numero % LIENS.length] ?? "",
        // 13 échos de page, comme l'annonce le §1 bis pour le compte n°2.
        echoPage: "",
        tags: tags.join(" "),
        note: numero % 5 === 0 ? "à revoir avant publication" : "",
      });
    }
  }

  // Les 13 échos, répartis régulièrement sur les 61 lignes.
  const pasEcho = Math.floor(rows.length / 13);
  for (let e = 0; e < 13; e += 1) {
    const cible = rows[e * pasEcho];
    if (cible) cible.echoPage = "oui";
  }

  return rows;
}

/** Échappe une cellule : guillemets doublés, champ cité s'il contient `;` ou `"`. */
function cellule(v: string): string {
  if (v.includes(";") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function ecrireCsv(rows: Row[]): string {
  const entetes = [
    "numero",
    "date",
    "heure",
    "format",
    "accroche",
    "production",
    "photo_will",
    "lien",
    "echo_page",
    "tags",
    "note",
  ];
  const lignes = [entetes.join(";")];
  for (const r of rows) {
    lignes.push(
      [
        String(r.numero),
        r.date,
        r.heure,
        r.format,
        cellule(r.accroche),
        r.production,
        r.photoWill,
        r.lien,
        r.echoPage,
        r.tags,
        cellule(r.note),
      ].join(";"),
    );
  }
  // BOM + CRLF : un export tableur Windows, tel que le §6 le décrit.
  return "﻿" + lignes.join("\r\n") + "\r\n";
}

function ecrirePosts(rows: Row[]): string {
  const blocs: string[] = [
    "# LES 61 POSTS — dossier LinkedIn Q4 2026",
    "",
    "> Fixture de format. Le contenu est neutre : ce qui est testé, c'est le",
    "> découpage `## #N` et l'appariement au CSV par le numéro.",
    "",
  ];

  for (const r of rows) {
    blocs.push(`## #${r.numero} — ${r.accroche.slice(0, 60)}`);
    blocs.push("");
    blocs.push(r.accroche);
    blocs.push("");
    blocs.push(
      `Corps de la publication n°${r.numero}. Trois lignes suffisent à vérifier ` +
        `que le découpage rend bien le corps entier, sauts de ligne compris.`,
    );
    blocs.push("");
    blocs.push("Ce que ça change, concrètement : le temps repasse sur le métier.");
    blocs.push("");
    blocs.push("### Premier commentaire");
    blocs.push("");
    blocs.push(
      r.lien
        ? `Le détail est ici — et les questions sont les bienvenues en réponse.`
        : `Si le sujet vous parle, dites-le en réponse : j'y répondrai une par une.`,
    );
    blocs.push("");
  }

  return blocs.join("\n");
}

function main(): void {
  const rows = construireLignes();

  if (rows.length !== 61) {
    throw new Error(`La fixture doit compter 61 lignes, elle en compte ${rows.length}.`);
  }
  const echos = rows.filter((r) => r.echoPage === "oui").length;
  if (echos !== 13) {
    throw new Error(`La fixture doit compter 13 échos de page, elle en compte ${echos}.`);
  }
  const septembre = rows.filter((r) => r.date.endsWith("/09/2026")).length;
  if (septembre !== 15) {
    throw new Error(`Septembre doit compter 15 publications, il en compte ${septembre}.`);
  }
  // Aucune date en double : deux publications le même jour à la même heure
  // rendraient le critère « aux bonnes dates » invérifiable.
  const cles = new Set(rows.map((r) => r.date));
  if (cles.size !== rows.length) {
    throw new Error(`Dates en double dans la fixture : ${rows.length - cles.size}.`);
  }

  fs.mkdirSync(DESTINATION, { recursive: true });
  fs.writeFileSync(
    path.join(DESTINATION, "02-calendrier-publication.csv"),
    ecrireCsv(rows),
    "utf8",
  );
  fs.writeFileSync(path.join(DESTINATION, "10-LES-61-POSTS.md"), ecrirePosts(rows), "utf8");

  console.warn(
    `✅ Fixture écrite dans ${DESTINATION}\n` +
      `   61 lignes · 13 échos · 15 en septembre · BOM UTF-8 · CRLF · séparateur « ; »`,
  );
}

main();
