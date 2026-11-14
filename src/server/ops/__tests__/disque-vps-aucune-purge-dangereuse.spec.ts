// @vitest-environment node

/**
 * DISQUE DU VPS : AUCUNE PURGE DOCKER LARGE (audit du 14/11/2026).
 *
 * Le workflow `disk-cleanup-prod.yml` et `scripts/ops/disk-cleanup.sh` lançaient chaque jour
 * `docker system prune -af --volumes` : cela efface les images de retour arrière du Studio et
 * les volumes anonymes de conteneurs arrêtés (Plausible, sonde Postgres). Un `docker container
 * prune` lancé en SSH après un déploiement retirait de même les conteneurs arrêtés du Studio.
 * Ce verrou lit `.github/`, `scripts/` et `docs/` et refuse le retour de ces commandes.
 *
 * Exceptions, vérifiées une par une : deux étapes qui tournent sur un RUNNER GitHub jetable
 * (job `runs-on: ubuntu-*`, étape sans SSH), et la SEULE commande `docker builder prune …
 * --keep-storage` (cache de build borné, aucune donnée) : le reste de la ligne n'est pas dispensé.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const DOSSIERS = [".github", "scripts", "docs"];
const EXTENSIONS = new Set([".sh", ".yml", ".yaml", ".txt", ".md", ".conf", ".mjs", ".js", ".ts", ".json", ""]);
const CE_FICHIER = "src/server/ops/__tests__/disque-vps-aucune-purge-dangereuse.spec.ts";

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === ".git") continue;
    const chemin = path.join(dossier, nom);
    const st = statSync(chemin);
    if (st.isDirectory()) sortie.push(...fichiers(chemin));
    else if (EXTENSIONS.has(path.extname(nom))) sortie.push(chemin);
  }
  return sortie;
}

/**
 * Motifs interdits, appliqués à CHAQUE commande d'une ligne (ligne coupée sur `&&`, `||`, `;`, `|`).
 * `prune` suivi d'un drapeau `-a`/`-af`/`-fa`/`--all` n'importe où après lui (`-f -a`,
 * `--filter x -a`, `--all`) ; `container prune`, `system prune` (même sans -a), `volume prune`,
 * `--volumes`.
 */
const INTERDITS: { nom: string; motif: RegExp }[] = [
  { nom: "container prune", motif: /\bcontainer\s+prune\b/ },
  { nom: "system prune", motif: /\bsystem\s+prune\b/ },
  { nom: "volume prune", motif: /\bvolume\s+prune\b/ },
  { nom: "--volumes", motif: /--volumes\b/ },
  { nom: "prune -a / -af / -fa", motif: /\bprune\b[^\n]*\s-[a-zA-Z]*a[a-zA-Z]*(?=\s|$)/ },
  { nom: "prune --all", motif: /\bprune\b[^\n]*\s--all\b/ },
];

/**
 * Seule dispense générale : la commande de cache de build BORNÉE. Elle ne dispense que sa propre
 * commande (pas le reste de la ligne) et seulement si elle ne contient aucun autre `prune`.
 */
const CACHE_BORNE = /\bdocker\s+builder\s+prune\b[^\n]*--keep-storage[=\s]+\d+\s*[A-Za-z]+/;
const AUTRE_PRUNE = /\b(?:system|container|volume|image|network)\s+prune\b|--volumes\b/;

function commandes(ligne: string): string[] {
  return ligne
    .split(/&&|\|\||;|\|/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Lignes à examiner : hors commentaires entiers ; en Markdown, seulement les blocs de code. */
function lignesExecutables(rel: string, texte: string): number[] {
  const sortie: number[] = [];
  let dansBloc = false;
  texte.split("\n").forEach((ligne, i) => {
    if (rel.endsWith(".md")) {
      if (/^\s*```/.test(ligne)) {
        dansBloc = !dansBloc;
        return;
      }
      if (!dansBloc) return;
    }
    if (/^\s*(#|\/\/)/.test(ligne)) return; // commentaire entier : non exécuté
    sortie.push(i);
  });
  return sortie;
}

/** Dispense « runner GitHub jetable » : la ligne doit être dans un job `runs-on: ubuntu-*` et dans une étape SANS SSH. */
function surRunnerGithubJetable(rel: string, lignes: string[], idx: number): boolean {
  if (!rel.startsWith(".github/workflows/")) return false;
  const cleJob = /^ {2}[A-Za-z0-9_-]+:\s*$/;
  let debutJob = -1;
  for (let i = idx; i >= 0; i--) {
    if (cleJob.test(lignes[i])) {
      debutJob = i;
      break;
    }
    if (/^jobs:/.test(lignes[i])) return false;
  }
  if (debutJob < 0) return false;
  let finJob = lignes.length;
  for (let i = idx + 1; i < lignes.length; i++) {
    if (cleJob.test(lignes[i])) {
      finJob = i;
      break;
    }
  }
  const runsOn = lignes.slice(debutJob, finJob).find((l) => /^\s{4}runs-on:/.test(l));
  if (!runsOn || !/ubuntu-/.test(runsOn) || /self-hosted/.test(runsOn)) return false;
  let debutEtape = idx;
  while (debutEtape > debutJob && !/^\s{6}-\s/.test(lignes[debutEtape])) debutEtape--;
  const etape = lignes.slice(debutEtape, idx + 1).join("\n");
  return !/\bssh\b|root@|appleboy|\bscp\b/.test(etape);
}

/** Exceptions : fichier + ligne exacte, ET job GitHub jetable (vérifié par surRunnerGithubJetable). */
const EXCEPTIONS_RUNNER: { fichier: string; ligne: RegExp; raison: string }[] = [
  {
    fichier: ".github/workflows/ci.yml",
    ligne: /^\s*docker image prune -af \|\| true\s*$/,
    raison: "runner GitHub jetable (Gate C), pas le VPS",
  },
  {
    fichier: ".github/workflows/deploy-coolify.yml",
    ligne: /^\s*sudo docker system prune --all --force --volumes \|\| true\s*$/,
    raison: "runner GitHub jetable (job build), pas le VPS",
  },
];

/** Applique le verrou à un texte (exporté en interne pour tester le verrou lui-même). */
function analyser(rel: string, texte: string): string[] {
  const lignes = texte.split("\n");
  const fautes: string[] = [];
  for (const idx of lignesExecutables(rel, texte)) {
    const ligne = lignes[idx];
    for (const cmd of commandes(ligne)) {
      // Seul le MORCEAU `logger -t disk-alert …` du crontab snapshot est un message (texte), pas la ligne entière.
      if (rel === "scripts/vps/crontab.snapshot.txt" && /^logger -t disk-alert\b/.test(cmd)) continue;
      for (const interdit of INTERDITS) {
        if (!interdit.motif.test(cmd)) continue;
        if (CACHE_BORNE.test(cmd) && !AUTRE_PRUNE.test(cmd)) continue;
        const exc = EXCEPTIONS_RUNNER.find((e) => e.fichier === rel && e.ligne.test(ligne));
        if (exc && surRunnerGithubJetable(rel, lignes, idx)) continue;
        fautes.push(`${rel}:${idx + 1} [${interdit.nom}] ${ligne.trim()}`);
      }
    }
  }
  return fautes;
}

describe("le verrou lui-même reconnaît les purges dangereuses", () => {
  const verifier = (cmd: string) => analyser("scripts/x.sh", cmd + "\n");
  it.each([
    "docker container prune -f",
    "docker system prune -f",
    "docker system prune",
    "docker image prune -f -a",
    "docker image prune --filter until=24h -a",
    "docker image prune --all",
    "docker volume prune -f",
    "docker compose down --volumes",
    "docker builder prune -af",
    "docker builder prune -f && docker container prune -f",
    "docker builder prune -f --keep-storage 2GB && docker system prune -f",
  ])("refuse : %s", (cmd) => {
    expect(verifier(cmd).length).toBeGreaterThan(0);
  });
  it.each([
    "docker image prune -f",
    "docker builder prune -f --keep-storage 2GB",
    "/usr/bin/docker builder prune -af --keep-storage 2GB >> /var/log/x.log 2>&1",
  ])("accepte : %s", (cmd) => {
    expect(verifier(cmd)).toEqual([]);
  });
  it("l'exemption `logger -t disk-alert` ne vaut que pour son morceau, dans le crontab snapshot", () => {
    const dangereuse = "docker system prune -af --volumes; logger -t disk-alert x";
    expect(analyser("scripts/vps/crontab.snapshot.txt", dangereuse).length).toBeGreaterThan(0);
    expect(analyser("scripts/x.sh", 'logger -t disk-alert "docker system prune requis"').length).toBeGreaterThan(0);
    expect(analyser("scripts/vps/crontab.snapshot.txt", 'logger -t disk-alert "docker system prune requis" || true')).toEqual([]);
  });
  it("une ligne en SSH n'est jamais dispensée comme runner jetable", () => {
    const yml = [
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: purge sur le VPS",
      "        run: |",
      "          ssh root@vps bash <<'FIN'",
      "          docker image prune -af || true",
      "          FIN",
    ].join("\n");
    expect(analyser(".github/workflows/ci.yml", yml).length).toBeGreaterThan(0);
  });
});

describe("disque du VPS : aucune purge Docker large dans .github/, scripts/ et docs/", () => {
  const cibles = DOSSIERS.flatMap((d) => fichiers(path.join(RACINE, d)));

  it("les anciens fichiers de purge ont disparu", () => {
    const rel = cibles.map((c) => path.relative(RACINE, c).split(path.sep).join("/"));
    expect(rel).not.toContain(".github/workflows/disk-cleanup-prod.yml");
    expect(rel).not.toContain("scripts/ops/disk-cleanup.sh");
  });

  it("aucune commande de purge large (container/system/volume prune, prune -a, --all, --volumes)", () => {
    const fautes: string[] = [];
    for (const chemin of cibles) {
      const rel = path.relative(RACINE, chemin).split(path.sep).join("/");
      if (rel === CE_FICHIER) continue;
      fautes.push(...analyser(rel, readFileSync(chemin, "utf8")));
    }
    expect(fautes, `Purge Docker interdite (voir AGENTS.md, « Disque du VPS ») :\n${fautes.join("\n")}`).toEqual([]);
  });

  it("les exceptions runner existent encore ET sont dans un job GitHub jetable, étape sans SSH", () => {
    for (const e of EXCEPTIONS_RUNNER) {
      const lignes = readFileSync(path.join(RACINE, e.fichier), "utf8").split("\n");
      const idx = lignes.findIndex((l) => e.ligne.test(l));
      expect(idx, `${e.fichier} : ${e.raison} (ligne absente : retirer l'exception)`).toBeGreaterThanOrEqual(0);
      expect(surRunnerGithubJetable(e.fichier, lignes, idx), `${e.fichier} : ${e.raison}`).toBe(true);
    }
  });

  it("les scripts de garde-fous ne font que mesurer, prévenir ou archiver avant de ranger /tmp", () => {
    const surveiller = readFileSync(path.join(RACINE, "scripts/vps/surveiller-disque.sh"), "utf8");
    expect(surveiller).not.toMatch(/\brm\s+-[a-z]*r|\bdocker\s+(?:rm|rmi|stop|kill|prune|system\s+prune)\b/);
    const menage = readFileSync(path.join(RACINE, "scripts/vps/menage-tmp.sh"), "utf8");
    expect(menage).not.toMatch(/\bdocker\s+(?:rm|rmi|stop|kill|[a-z]+\s+prune)\b/);
    // La suppression ne vient qu'APRÈS la vérification de l'archive (liste, puis comparaison du contenu).
    const verif = menage.indexOf('tar -dzf "$archive"');
    expect(verif).toBeGreaterThan(-1);
    expect(verif).toBeLessThan(menage.indexOf("rm -rf --one-file-system"));
    expect(menage.indexOf('gzip -t "$archive"')).toBeLessThan(menage.indexOf("rm -rf --one-file-system"));
  });
});
