/**
 * `pnpm mcp:fixtures` — produit les jeux MAXIMAUX de chaque outil.
 *
 * Le contrôle 4 du harnais (§ 09) exige, pour chaque outil, un fichier
 * `fixtureMax` : la sortie la plus lourde que l'outil puisse rendre à sa limite
 * de pagination, avec chaque champ à sa longueur plausible maximale. Le
 * harnais valide chaque jeu contre `outputSchema`, mesure ses octets
 * canoniques contre `maxBytes`, et annonce combien de jeux il a exécutés.
 *
 * ⚠️ Un jeu est une FORME, pas une donnée : aucune coordonnée réelle, aucun
 *    nom réel. Les identifiants sont des UUID de version 4 fabriqués, les
 *    textes des remplissages numérotés. `detectPii` doit rester muet dessus.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { OUTILS } from "../../src/server/mcp/registre";
import { nomComplet } from "../../src/server/mcp/contrat";
import { octetsCanoniques, versValeurJson } from "../../src/server/mcp/json-canonique";

const RACINE_MCP = resolve(process.cwd(), "src/server/mcp");
const AS_OF = "2026-09-02T04:00:00.000Z";

function texte(prefixe: string, i: number, longueur: number): string {
  const base = `${prefixe} ${String(i + 1)} `;
  return base.padEnd(longueur, "abcdefghij ").slice(0, longueur);
}

function uuidFabrique(i: number): string {
  const h = i.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${h}`;
}

function jourPlus(i: number): string {
  return new Date(Date.UTC(2026, 8, 1 + (i % 28))).toISOString().slice(0, 10);
}

function heure(i: number, decalageMin: number): string {
  return new Date(Date.UTC(2026, 8, 1 + (i % 28), 8 + (i % 9), decalageMin)).toISOString();
}

function meta(returned: number, extras: Partial<Record<string, unknown>> = {}) {
  return {
    returned,
    hasMore: true,
    cursor: null,
    mode: "items",
    truncated: false,
    truncationNote: null,
    sourceIncomplete: true,
    sourceNote: texte("note source", 0, 120),
    failedSources: ["podcast"],
    version: "1.0.0",
    deprecated: false,
    sunsetAt: null,
    asOf: AS_OF,
    ...extras,
  };
}

const CANAUX = ["appel", "message", "candidature", "podcast"] as const;
const SOURCES = ["calendly", "google", "console"] as const;
const FORMATS = ["telephone", "visio", "inconnu"] as const;
const STATUTS = ["scheduled", "pending", "past", "completed", "canceled", "no_show"] as const;
const NIVEAUX_ALERTE = ["info", "important", "critique"] as const;
const CODES_SIGNAL = [
  "session_non_staffee",
  "conflit_formateur",
  "formateur_indisponible",
  "formateur_non_conforme",
  "surcharge_formateur",
  "releve_a_valider",
  "anomalie_remuneration",
] as const;

const JEUX: Record<string, () => unknown> = {
  "inbox.recent": () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: uuidFabrique(i),
      canal: CANAUX[i % 4],
      recuLe: heure(i, 0),
      objet: texte("objet", i, 120),
      contact: texte("contact", i, 60),
      contexte: texte("contexte", i, 160),
      statut: texte("statut", i, 24),
      aAgir: i % 2 === 0,
    }));
    const compteurs = { appel: 100, message: 100, candidature: 100, podcast: 100 };
    return {
      items,
      meta: meta(items.length),
      synthese: { total: 400, parCanal: compteurs, aAgir: 200, aAgirParCanal: compteurs },
    };
  },
  "agenda.jour": () => {
    const items = Array.from({ length: 24 }, (_, i) => ({
      id: `gg_${uuidFabrique(i)}`,
      source: SOURCES[i % 3],
      titre: texte("titre", i, 120),
      debut: heure(0, i * 2),
      fin: heure(0, i * 2 + 1),
      journeeEntiere: i % 7 === 0,
      occupe: true,
      jour: jourPlus(0),
      contact: null,
      format: FORMATS[i % 3],
      annule: false,
      lieu: texte("lieu", i, 120),
      note: texte("note", i, 200),
    }));
    return { items, meta: meta(items.length, { failedSources: ["google"] }) };
  },
  "agenda.semaine": () => {
    const items = Array.from({ length: 84 }, (_, i) => ({
      id: `cal_${uuidFabrique(i)}`,
      source: SOURCES[i % 3],
      titre: texte("titre", i, 80),
      debut: heure(i % 7, (i % 12) * 4),
      fin: heure(i % 7, (i % 12) * 4 + 3),
      journeeEntiere: false,
      occupe: true,
      jour: jourPlus(i % 7),
      contact: null,
      format: FORMATS[i % 3],
      annule: i % 11 === 0,
      lieu: texte("lieu", i, 80),
      note: texte("note", i, 120),
    }));
    return { items, meta: meta(items.length, { failedSources: ["google"] }) };
  },
  "rendezvous.list": () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: uuidFabrique(i),
      titre: texte("type de rendez-vous", i, 100),
      debut: heure(i, 0),
      fin: heure(i, 30),
      heureConfirmee: true,
      jour: jourPlus(i),
      statut: STATUTS[i % 6],
      contact: null,
      format: FORMATS[i % 3],
      notes: null,
    }));
    return { items, meta: meta(items.length, { failedSources: [] }) };
  },
  "pilotage.alertes": () => {
    const items = CODES_SIGNAL.map((code, i) => ({
      code,
      niveau: i % 2 === 0 ? "critique" : "attention",
      titre: texte("titre", i, 100),
      explication: texte("explication", i, 300),
      nombre: 30,
      elements: Array.from({ length: 30 }, (_, j) => ({ libelle: texte("element", j, 90) })),
    }));
    return { items, meta: meta(items.length, { failedSources: [], hasMore: false }) };
  },
  "deploiement.etat": () => ({
    items: [
      {
        etat: "en-retard",
        resume: texte("resume", 0, 220),
        commit: "0a1b2c3",
        commitEnService: "9f8e7d6",
        branche: "main",
        termineLe: AS_OF,
        titreDuCommit: texte("titre du commit", 0, 140),
        dureeSecondes: 1680,
        numeroDeRun: 4321,
      },
    ],
    meta: meta(1, { failedSources: ["github"], hasMore: false }),
  }),
  "qualiopi.conformite": () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: uuidFabrique(i),
      code: `code_${String(i % 47).padStart(2, "0")}`,
      niveau: NIVEAUX_ALERTE[i % 3],
      titre: texte("titre", i, 120),
      message: texte("message", i, 240),
      lu: i % 2 === 0,
      creeLe: heure(i, 0),
      resolueLe: null,
      cible: { type: "TrainingSession", id: uuidFabrique(1000 + i) },
    }));
    return { items, meta: meta(items.length, { failedSources: [] }) };
  },
};

let ecrits = 0;
for (const outil of OUTILS) {
  const fabrique = JEUX[outil.name];
  if (fabrique === undefined) {
    throw new Error(`aucun jeu maximal défini pour « ${nomComplet(outil.name)} »`);
  }
  const jeu = versValeurJson(fabrique(), outil.name);
  const validation = outil.output.safeParse(jeu);
  if (!validation.success) {
    throw new Error(
      `le jeu de « ${outil.name} » ne respecte pas son schéma : ` +
        validation.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" · "),
    );
  }
  const octets = octetsCanoniques(jeu);
  const cible = resolve(RACINE_MCP, outil.fixtureMax);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, `${JSON.stringify(jeu, null, 2)}\n`, "utf8");
  const verdict = octets <= outil.maxBytes ? "≤" : "DÉPASSE";
  console.log(
    `${verdict === "≤" ? "✅" : "❌"} ${nomComplet(outil.name)} · ${String(octets)} octets ` +
      `${verdict} maxBytes ${String(outil.maxBytes)} → ${outil.fixtureMax}`,
  );
  ecrits += 1;
}
console.log(`[mcp:fixtures] ${String(ecrits)} jeu(x) écrit(s)`);
