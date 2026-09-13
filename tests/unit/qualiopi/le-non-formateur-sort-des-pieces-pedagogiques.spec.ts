/**
 * 🔴 UNE PERSONNE QUI N'ANIME PAS SORT DES PIÈCES PÉDAGOGIQUES — ET DE CELLES-LÀ
 * SEULEMENT.
 *
 * ## Le défaut, et pourquoi il ne se voyait pas
 *
 * Toute personne employée par Axion-IA est une ligne de `trainers`. Tant que
 * l'organisme n'embauchait que des formateurs, « salarié » et « intervenant
 * pédagogique » désignaient le même ensemble, et une dizaine de lectures se sont
 * écrites sur ce raccourci. Il devient faux à la PREMIÈRE embauche hors
 * formation — secrétaire, marketing, développeur — **sans qu'une seule ligne de
 * code ne change**.
 *
 * Deux conséquences ne se rattrapent pas :
 *
 *   · **le BPF est une déclaration annuelle à la DREETS.** Une secrétaire y
 *     serait déclarée à l'État comme formatrice interne de l'organisme ;
 *   · **l'indicateur 21 exige 100 %** de formateurs porteurs d'un CV et d'une
 *     pièce de compétence. Chaque embauche non pédagogique ajoute un
 *     dénominateur qu'aucune pièce honnête ne satisfait : l'indicateur passe en
 *     non-conformité MAJEURE, et le seul geste qui le reverdirait serait de
 *     fabriquer une pièce de compétence au nom de quelqu'un qui n'enseigne pas.
 *
 * ## ⚠️ CE QUE CETTE GARDE SURVEILLE, ET CE QU'ELLE INTERDIT D'ÉLARGIR
 *
 * La ligne de partage n'est PAS « Trainer ou pas ». C'est :
 *
 *   · **pièce PÉDAGOGIQUE** → filtrer sur `estFormateur` ;
 *   · **pièce d'EMPLOYEUR** → surtout PAS.
 *
 * Un filtre appliqué en bloc à toute lecture de `Trainer` casserait le contrat
 * de travail, le délai de remise d'un CDD et la paie — qui visent tout salarié.
 * Les deux moitiés de ce fichier tiennent donc les deux sens : ce qui DOIT
 * filtrer, et ce qui ne doit SURTOUT PAS.
 *
 * 🔑 Analyse de SOURCE, comme `refs-circuits.spec.ts` : exécuter ces lectures
 * demanderait une base et un mock par entité ; lire le fichier suffit à prouver
 * la présence — ou l'absence — du filtre, et reste vrai quel que soit le chemin
 * d'exécution.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

/** Le corps d'une fonction, de sa signature à la suivante. */
function corpsDe(source: string, signature: string): string {
  const depart = source.indexOf(signature);
  expect(
    depart,
    `« ${signature} » a disparu : cette garde ne surveille plus rien.`,
  ).toBeGreaterThan(-1);
  const suite = source.indexOf("\nasync function ", depart + 10);
  const suite2 = source.indexOf("\nexport async function ", depart + 10);
  const fin = [suite, suite2].filter((n) => n > -1).sort((a, b) => a - b)[0];
  return source.slice(depart, fin ?? source.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ce qui DOIT filtrer
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 les pièces PÉDAGOGIQUES excluent qui n'anime pas", () => {
  it("le BPF ne déclare à la DREETS que de vrais formateurs", () => {
    // 🔴 LA PLUS GRAVE DU LOT. Le BPF n'est pas une pièce interne : c'est une
    // déclaration annuelle à l'État. Une erreur n'y est pas un chiffre faux sur
    // un écran, c'est une fausse déclaration.
    const src = lire("src/server/qualiopi/bpf/service.ts");
    /*
      ⚠️ La fenêtre part de la DESTRUCTURATION et se ferme sur l'appel qui SUIT,
      cherché À PARTIR de ce point.

      Ma première version bornait sur `src.indexOf("listDepenses")` — qui trouve
      l'IMPORT, en haut du fichier, donc AVANT le départ : la tranche était vide
      et le test rouge alors que le code était juste. Un extracteur qui se borne
      sur un symbole présent plusieurs fois lit le mauvais morceau.
    */
    const depart = src.indexOf("nbFormateursInternes");
    expect(depart, "la destructuration du BPF a changé de nom").toBeGreaterThan(-1);
    const bloc = src.slice(depart, src.indexOf("listDepenses(", depart));
    expect(
      (bloc.match(/estFormateur:\s*true/g) ?? []).length,
      "le BPF compte des Trainer sans filtrer sur `estFormateur` : une secrétaire " +
        "serait déclarée à la DREETS comme formatrice interne de l'organisme.",
    ).toBeGreaterThanOrEqual(2);
  });

  it("🔴 le dénominateur de l'indicateur 21 ne compte que les formateurs", () => {
    // Le prédicat d'off.21 exige une couverture de 100 %. Un dénominateur gonflé
    // par des non-formateurs fait basculer l'indicateur en NC majeure, sans
    // aucun correctif honnête possible.
    const src = lire("src/server/qualiopi/conformite/conformite-service.ts");
    const comptes = src.match(/prisma\.trainer\.count\(\{[\s\S]*?\}\)/g) ?? [];
    expect(comptes.length, "aucun compte de Trainer trouvé : le motif a changé").toBeGreaterThan(3);
    const sansFiltre = comptes.filter((c) => !/estFormateur:\s*true/.test(c));
    expect(
      sansFiltre,
      "un compte de Trainer de la conformité ne filtre pas sur `estFormateur`. " +
        "S'il alimente un indicateur PÉDAGOGIQUE, il fera rougir off.21 à la " +
        "première embauche hors formation. S'il vise autre chose, il n'a rien à " +
        "faire dans ce fichier.",
    ).toStrictEqual([]);
  });

  it("la liste OFFICIELLE des formateurs — pièce d'audit — est filtrée", () => {
    const src = lire("src/server/actions/qualiopi/documents.ts");
    const bloc = corpsDe(src, "export async function genererListeFormateursAction");
    expect(
      bloc,
      "la liste des formateurs est une PIÈCE D'AUDIT qui NOMME les gens. Sans " +
        "`pedagogiquesSeulement`, une secrétaire y serait présentée au " +
        "certificateur comme un moyen humain de l'organisme.",
    ).toContain("pedagogiquesSeulement: true");
  });

  it("le manifeste d'audit ne NOMME que de vrais formateurs sous l'indicateur 21", () => {
    const src = lire("src/server/qualiopi/conformite/audit-dossier.ts");
    const bloc = src.slice(src.indexOf("trainersAvecCV"), src.indexOf("trainersAvecCV") + 400);
    expect(
      bloc,
      "le manifeste ne compte pas, il NOMME : « Fiche au dossier : Prénom Nom » " +
        "sous l'indicateur 21, devant le certificateur.",
    ).toMatch(/estFormateur:\s*true/);
  });

  it("🔴 l'alerte de CV périmé ne vise pas quelqu'un dont le CV n'est exigé par rien", () => {
    // Sans ce filtre, chaque embauche hors formation produisait une alerte
    // `important` IMMÉDIATE et INFERMABLE. Le seul geste qui l'aurait éteinte
    // aurait été de verser un CV de secrétaire au dossier de l'indicateur 21.
    //
    // 🔑 Une alerte qui réclame un geste que personne ne peut poser honnêtement
    // apprend à ignorer la famille entière — et c'est la vraie qu'on rate.
    const src = lire("src/server/qualiopi/alertes/evaluateur.ts");
    const bloc = corpsDe(src, "async function regleCvFormateurPerime");
    expect(bloc).toMatch(/estFormateur:\s*true/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ce qui ne doit SURTOUT PAS filtrer — la moitié qu'on oublie
// ─────────────────────────────────────────────────────────────────────────────

describe("⛔ les pièces d'EMPLOYEUR visent TOUT salarié", () => {
  it("🔴 l'alerte de remise d'un CDD ne filtre PAS sur `estFormateur`", () => {
    // Une secrétaire en CDD a le MÊME délai de deux jours ouvrables, et le même
    // risque de requalification en CDI. Filtrer ici éteindrait l'alerte
    // précisément pour les gens que ce lot vient rendre possibles.
    const src = lire("src/server/qualiopi/alertes/evaluateur.ts");
    const bloc = corpsDe(src, "async function regleContratCddNonRemis");
    expect(
      bloc,
      "la règle de remise du CDD filtre sur `estFormateur` : elle ne verrait plus " +
        "la secrétaire, le développeur ni le responsable marketing — c'est-à-dire " +
        "exactement les embauches que ce champ existe pour permettre. Le délai de " +
        "L.1242-13 ne connaît pas les métiers.",
    ).not.toMatch(/estFormateur/);
  });

  it("🔴 le pilotage des salariés liste TOUT LE MONDE", () => {
    // La vue employeur. Un filtre pédagogique y créerait deux listes, et
    // obligerait à savoir dans laquelle chercher avant de chercher.
    const src = lire("src/server/rh/salaries-pilotage.ts");
    expect(
      src,
      "le pilotage des salariés filtre sur `estFormateur` : les contrats des " +
        "non-formateurs deviendraient invisibles, ce qui est l'inverse du but.",
    ).not.toMatch(/estFormateur/);
  });

  it("🔑 `listTrainers` ne filtre PAS par défaut — l'appelant doit choisir", () => {
    /*
      🔴 LE CŒUR DU SUJET, ET LA RAISON POUR LAQUELLE CE CHAMP EST UNE OPTION.

      `listTrainers` n'a jamais promis « les intervenants pédagogiques » : elle
      promet « les Trainer ». Une secrétaire n'y apparaîtrait pas PAR ERREUR,
      elle y apparaîtrait parce que la fonction répond à une question voisine de
      celle qu'on croit lui poser.

      Filtrer par défaut aurait corrigé les pièces d'audit ET cassé en silence
      tout ce qui vise l'employeur. Chaque appelant doit dire laquelle des deux
      questions il pose — et ce témoin interdit qu'on lui reprenne ce choix.
    */
    const src = lire("src/server/qualiopi/trainers/trainers.ts");
    const bloc = corpsDe(src, "export async function listTrainers");
    expect(bloc, "l'option a disparu").toContain("pedagogiquesSeulement");
    expect(
      bloc,
      "`listTrainers` filtre désormais sur `estFormateur` SANS que l'appelant " +
        "l'ait demandé : la paie, le contrat de travail et le pilotage des " +
        "salariés perdraient silencieusement les non-formateurs.",
    ).toMatch(/if\s*\(opts\?\.pedagogiquesSeulement\)/);
  });

  it("⚠️ le contrat de travail n'annonce JAMAIS un poste inventé", () => {
    // C'était `?? "formateur"` : une personne dont le poste n'est pas saisi
    // recevait par écrit l'annonce de son contrat au poste de formateur. Le PDF,
    // lui, affichait « Non renseigné » — le document se taisait là où l'e-mail
    // affirmait.
    const src = lire("src/server/actions/qualiopi/trainer-contrat.ts");
    expect(
      src,
      "le repli du poste réinvente « formateur ». Un repli qui INVENTE est pire " +
        "qu'une absence : il affirme à quelqu'un un métier qui n'est pas le sien.",
    ).not.toMatch(/contratPoste\s*\?\?\s*"formateur"/);
  });
});
