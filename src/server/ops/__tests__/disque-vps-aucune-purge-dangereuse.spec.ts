// @vitest-environment node

/**
 * DISQUE DU VPS : AUCUNE PURGE DOCKER LARGE (audit du 14/11/2026).
 *
 * Le workflow `disk-cleanup-prod.yml` et `scripts/ops/disk-cleanup.sh` lançaient chaque jour
 * `docker system prune -af --volumes` : cela efface les images de retour arrière du Studio et
 * les volumes anonymes de conteneurs arrêtés (Plausible, sonde Postgres). Ce verrou lit les
 * fichiers de `.github/` et `scripts/` et refuse le retour de ces commandes.
 *
 * Exceptions, listées une par une plus bas : deux étapes qui tournent sur un RUNNER GitHub
 * jetable (jamais sur le VPS), et le cache de build borné par `--keep-storage` (aucune donnée).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const DOSSIERS = [".github", "scripts"];
const EXTENSIONS = new Set([".sh", ".yml", ".yaml", ".txt", ".md", ".conf", ".mjs", ".js", ".ts", ".json", ""]);

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

// `prune -a`, `prune -af`, `prune -fa`, `prune --all`, `--volumes`, `volume prune`.
const INTERDITS: { nom: string; motif: RegExp }[] = [
  { nom: "prune -a / -af / -fa", motif: /\bprune\s+(?:-[a-zA-Z]*a[a-zA-Z]*)(?:\s|$)/ },
  { nom: "prune --all", motif: /\bprune\s+(?:[^\n]*\s)?--all\b/ },
  { nom: "--volumes", motif: /--volumes\b/ },
  { nom: "volume prune", motif: /\bvolume\s+prune\b/ },
];

/** Exceptions : fichier (relatif, séparateur /) + motif exact de la ligne tolérée. */
const EXCEPTIONS: { fichier: string; ligne: RegExp; raison: string }[] = [
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

/** Cache de build seul, borné : aucune image, aucun volume, aucune donnée. */
const CACHE_BORNE = /\bbuilder\s+prune\b[^\n]*--keep-storage\b/;
/** Message d'aide (texte, pas une commande lancée) : cache de build uniquement. */
const AIDE_CACHE = /`docker builder prune -af`/;

describe("disque du VPS : aucune purge Docker large dans .github/ et scripts/", () => {
  const cibles = DOSSIERS.flatMap((d) => fichiers(path.join(RACINE, d)));

  it("les anciens fichiers de purge ont disparu", () => {
    const rel = cibles.map((c) => path.relative(RACINE, c).split(path.sep).join("/"));
    expect(rel).not.toContain(".github/workflows/disk-cleanup-prod.yml");
    expect(rel).not.toContain("scripts/ops/disk-cleanup.sh");
  });

  it("aucune commande de purge large (prune -a, --volumes, volume prune)", () => {
    const fautes: string[] = [];
    for (const chemin of cibles) {
      const rel = path.relative(RACINE, chemin).split(path.sep).join("/");
      readFileSync(chemin, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          for (const interdit of INTERDITS) {
            if (!interdit.motif.test(ligne)) continue;
            if (CACHE_BORNE.test(ligne) || AIDE_CACHE.test(ligne)) continue;
            if (EXCEPTIONS.some((e) => e.fichier === rel && e.ligne.test(ligne))) continue;
            fautes.push(`${rel}:${i + 1} [${interdit.nom}] ${ligne.trim()}`);
          }
        });
    }
    expect(fautes, `Purge Docker interdite (voir AGENTS.md, « Disque du VPS ») :\n${fautes.join("\n")}`).toEqual([]);
  });

  it("les exceptions restent justifiées : elles existent encore (sinon les retirer)", () => {
    for (const e of EXCEPTIONS) {
      const texte = readFileSync(path.join(RACINE, e.fichier), "utf8");
      expect(texte.split("\n").some((l) => e.ligne.test(l)), `${e.fichier} : ${e.raison}`).toBe(true);
    }
  });

  it("les scripts de garde-fous ne font que mesurer, prévenir ou archiver avant de ranger /tmp", () => {
    const surveiller = readFileSync(path.join(RACINE, "scripts/vps/surveiller-disque.sh"), "utf8");
    expect(surveiller).not.toMatch(/\brm\s+-[a-z]*r|\bdocker\s+(?:rm|rmi|stop|kill|prune|system\s+prune)\b/);
    const menage = readFileSync(path.join(RACINE, "scripts/vps/menage-tmp.sh"), "utf8");
    expect(menage).not.toMatch(/\bdocker\s+(?:rm|rmi|stop|kill|[a-z]+\s+prune)\b/);
    // La suppression ne vient qu'APRÈS la vérification de l'archive.
    const verif = menage.indexOf("$(tar -tzf");
    expect(verif).toBeGreaterThan(-1);
    expect(verif).toBeLessThan(menage.indexOf("rm -rf --one-file-system"));
  });
});
