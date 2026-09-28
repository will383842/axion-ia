/**
 * Verrou — un imprimé INTERNE est dans l'image, et nulle part en public.
 *
 * ## Le constat (2026-09-28)
 *
 * La trame de l'échange découverte avec un candidat apporteur porte la grille
 * de notation et les critères éliminatoires. Elle doit être téléchargeable
 * depuis la console, et JAMAIS par un candidat. D'où trois familles de risques,
 * chacune muette si rien ne la garde :
 *
 * - **le fichier n'arrive pas dans l'image.** Le standalone Next ne trace pas un
 *   fichier lu par `readFile` : sans la ligne `COPY … /app/private ./private` du
 *   Dockerfile, la route console rend 404 en production, et tout reste vert ici ;
 * - **le fichier devient public.** Il suffit de le déposer sous `public/` « pour
 *   que ce soit plus pratique », ou de déclarer un `private/…` dans
 *   `fichiersPublics` ;
 * - **la liste blanche s'élargit en silence** — un nom avec `/` ou `..` qui
 *   ferait sortir la route de son dossier.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DOSSIER_FICHIERS_INTERNES,
  FICHIER_INTERNE_VALIDE,
  IMPRIMES,
  fichierInterneAutorise,
  imprimeParId,
  lienFichierInterne,
} from "@/content/imprimes";

const RACINE = path.resolve(__dirname, "../../..");
const TRAME = "trame-echange-apporteur";

/** Les instructions du stage `runner` seulement — le builder copie tout le contexte. */
function stageRunner(): string {
  const dockerfile = readFileSync(path.join(RACINE, "Dockerfile"), "utf8");
  const debut = dockerfile.search(/^FROM\s+\S+\s+AS\s+runner\s*$/im);
  expect(debut, "le Dockerfile n'a plus de stage « runner »").toBeGreaterThan(-1);
  return dockerfile.slice(debut);
}

function tousLesFichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tousLesFichiers(path.join(dossier, e.name)) : [e.name],
  );
}

const internes = IMPRIMES.flatMap((i) =>
  (i.fichiersInternes ?? []).map((f) => ({ imprime: i.id, ...f })),
);

describe("les imprimés internes", () => {
  it("le registre contient la trame de l'échange apporteur et la marque interne", () => {
    const trame = imprimeParId(TRAME);
    expect(trame, "la trame a disparu du registre IMPRIMES").toBeDefined();
    expect(trame!.usageInterne).toMatch(/ne pas transmettre au candidat/i);
    expect(trame!.fichiersPublics).toEqual([]);
    expect(trame!.fichiersInternes?.map((f) => f.fichier)).toEqual(["trame-echange-apporteur.pdf"]);
    expect(trame!.voirAussi?.href).toBe("/contacts/commercial");
  });

  it("un imprimé qui porte des fichiers internes est marqué interne, et réciproquement", () => {
    for (const i of IMPRIMES) {
      expect(
        Boolean(i.usageInterne),
        `« ${i.id} » : fichiersInternes et usageInterne vont ensemble`,
      ).toBe((i.fichiersInternes ?? []).length > 0);
    }
  });

  it("chaque fichier interne a un nom simple, sans chemin, et existe sous private/imprimes", () => {
    // Contre-témoin : une liste vide rendrait la boucle vacuement verte.
    expect(internes.length).toBeGreaterThan(0);
    for (const f of internes) {
      expect(f.fichier, `« ${f.fichier} » n'est pas un nom de fichier admis`).toMatch(
        FICHIER_INTERNE_VALIDE,
      );
      const disque = path.join(RACINE, DOSSIER_FICHIERS_INTERNES, f.fichier);
      expect(existsSync(disque), `${disque} est absent du dépôt`).toBe(true);
      expect(statSync(disque).size).toBeGreaterThan(10_000);
    }
  });

  it("aucun fichier sous private/ n'est référencé comme public, ni copié sous public/", () => {
    for (const i of IMPRIMES) {
      for (const f of i.fichiersPublics) {
        expect(f.chemin, `« ${i.id} » publie un fichier privé`).not.toMatch(/(^|\/)private\//);
        expect(f.chemin).not.toContain("..");
      }
    }
    const publics = new Set(tousLesFichiers(path.join(RACINE, "public")));
    for (const f of internes) {
      expect(publics.has(f.fichier), `${f.fichier} a été déposé sous public/`).toBe(false);
    }
  });

  it("la liste blanche refuse un id inconnu, un chemin avec .. et un nom non déclaré", () => {
    expect(fichierInterneAutorise(TRAME, "trame-echange-apporteur.pdf")?.fichier).toBe(
      "trame-echange-apporteur.pdf",
    );
    expect(fichierInterneAutorise("inconnu", "trame-echange-apporteur.pdf")).toBeUndefined();
    expect(fichierInterneAutorise(TRAME, "../trame-echange-apporteur.pdf")).toBeUndefined();
    expect(fichierInterneAutorise(TRAME, "..%2F..%2Fpackage.json")).toBeUndefined();
    expect(fichierInterneAutorise(TRAME, "autre.pdf")).toBeUndefined();
    // Un fichier interne d'UN imprimé ne sort pas sous l'id d'un autre.
    expect(fichierInterneAutorise("flyer-a5", "trame-echange-apporteur.pdf")).toBeUndefined();
  });

  it("le lien de téléchargement passe par la route console, jamais par un chemin public", () => {
    expect(lienFichierInterne(TRAME, "trame-echange-apporteur.pdf")).toBe(
      "/api/admin/imprimes/trame-echange-apporteur/trame-echange-apporteur.pdf",
    );
  });
});

describe("le fichier interne arrive dans l'image Docker, et seulement par la route", () => {
  it("le stage runner du Dockerfile copie private/ à la racine de l'application", () => {
    // `process.cwd()` vaut /app dans le conteneur (WORKDIR /app, `node server.js`) :
    // la route lit donc /app/private/imprimes/<fichier>.
    expect(stageRunner()).toMatch(
      /^COPY\s+--from=builder\s+(?:--chown=\S+\s+)?\/app\/private\s+\.\/private\s*$/m,
    );
    expect(stageRunner()).toMatch(/^WORKDIR\s+\/app\s*$/m);
  });

  it("le .dockerignore n'exclut pas private/ du contexte de build", () => {
    const lignes = readFileSync(path.join(RACINE, ".dockerignore"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    for (const l of lignes) {
      expect(/^\/?private(\/|$|\*)/.test(l) || l === "*", `.dockerignore exclut « ${l} »`).toBe(
        false,
      );
    }
  });

  it("aucune réécriture ni redirection de next.config ne sert private/", () => {
    const config = readFileSync(path.join(RACINE, "next.config.ts"), "utf8");
    expect(config).not.toMatch(/["'`/]private\//);
  });
});
