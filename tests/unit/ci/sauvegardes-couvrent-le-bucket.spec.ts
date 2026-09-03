/**
 * Garde — TOUT CE QUE L'APPLICATION ÉCRIT SUR R2 EST SAUVEGARDÉ.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-08-19 (audit Qualiopi E2E, constat `D66-01`) : `BackupComponent`
 * déclare neuf composants — `postgres`, `postgres_pitr`, `redis`,
 * `files_image_bank`, `docuseal`, `plausible_pg`, `plausible_clickhouse`,
 * `secrets`, `git_mirror` — et **aucun ne vise le bucket applicatif**.
 *
 * Or c'est là que vivent les preuves : conventions, contrats, attestations,
 * certificats de réalisation, factures (`documents/`), supports pédagogiques
 * (`supports/`) et images de signature (`emargement/`). Le bucket R2 est la
 * DESTINATION des sauvegardes, et il n'est lui-même sauvegardé par rien.
 *
 * Si ce bucket disparaît — clé compromise, règle de cycle de vie mal posée,
 * suppression — Postgres survit avec `document_hash_sha256` et
 * `signature_sha256` intacts : des empreintes de fichiers que plus personne ne
 * peut produire. `signatureKey` pointe dans le vide. L'organisme dispose d'un
 * registre qui prouve qu'il A EU des pièces et n'en a plus aucune. La rétention
 * légale est de cinq ans (`DOCUMENT_RETENTION_YEARS`).
 *
 * ## Pourquoi RIEN ne le signalait
 *
 * `src/server/backups/queries.ts` calcule le retard **par composant**. Un
 * composant qui n'existe pas dans l'énumération n'a pas de run, donc pas de
 * retard, donc pas d'alerte : **le tableau de bord est vert parce qu'il ne sait
 * pas qu'il devrait regarder**. Aucun test n'était en cause — la surveillance ne
 * peut pas voir ce qui n'est pas dans son énumération. D'où cette garde, qui
 * part de ce que le CODE écrit et non de ce que la sauvegarde déclare couvrir.
 *
 * ## Second défaut fermé ici — `D66-05`
 *
 * `scripts/backup-image-bank-r2.sh` et `scripts/vps/run-files-backup.sh`
 * rapportent tous deux sous `files_image_bank`, alors que le second sauvegarde
 * autre chose (CV, console-docs, reviews-media) et le dit dans son propre
 * en-tête. La détection de retard raisonnant sur le dernier run par composant,
 * si l'un des deux crons meurt l'autre garde le tableau vert : **un témoin
 * positif qui masque un témoin négatif**.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RACINE = process.cwd();

/**
 * Préfixes de clés R2 écrits par l'application, avec le fichier qui les pose.
 *
 * ⚠️ Cette table n'est pas une déclaration d'intention : chaque entrée est
 * VÉRIFIÉE contre le fichier source par le premier test. Si quelqu'un déplace ou
 * renomme un préfixe, la garde tombe — elle ne se contente pas de relire sa
 * propre liste.
 *
 * `tmp/` est volontairement absent : c'est un tampon d'import, rien n'y survit.
 */
const PREFIXES_DURABLES = [
  {
    prefixe: "documents",
    source: "src/server/qualiopi/documents/documents-service.ts",
    quoi: "conventions, contrats, attestations, certificats, factures",
  },
  {
    prefixe: "supports",
    source: "src/server/qualiopi/supports/render-support.ts",
    quoi: "supports pédagogiques et grilles d'évaluation",
  },
  {
    prefixe: "emargement",
    source: "src/server/qualiopi/emargement/storage.ts",
    quoi: "images de signature et de contresignature",
  },
] as const;

function lireScriptsDeSauvegarde(): { chemin: string; contenu: string }[] {
  const dossiers = ["scripts", path.join("scripts", "vps")];
  const out: { chemin: string; contenu: string }[] = [];
  for (const d of dossiers) {
    for (const f of readdirSync(path.join(RACINE, d))) {
      if (!f.endsWith(".sh")) continue;
      const chemin = path.join(d, f);
      out.push({ chemin, contenu: readFileSync(path.join(RACINE, chemin), "utf8") });
    }
  }
  return out;
}

/** Valeurs de `COMPONENT=` posées par les scripts, hors défaut de la librairie. */
function composantsDeclares(): { chemin: string; composant: string }[] {
  const out: { chemin: string; composant: string }[] = [];
  for (const { chemin, contenu } of lireScriptsDeSauvegarde()) {
    for (const m of contenu.matchAll(/^\s*(?:export\s+)?COMPONENT=["']?([a-z_]+)["']?/gm)) {
      const v = m[1];
      // `backup-lib.sh` pose `COMPONENT="${COMPONENT:-unknown}"` : c'est le
      // défaut de la librairie partagée, pas la déclaration d'un script.
      if (v === undefined || v === "unknown") continue;
      out.push({ chemin, composant: v });
    }
  }
  return out;
}

describe("🔴 sauvegardes — la table des préfixes est vérifiée, pas recopiée", () => {
  it.each(PREFIXES_DURABLES)(
    "le préfixe `$prefixe/` est bien posé par $source",
    ({ prefixe, source }) => {
      const src = readFileSync(path.join(RACINE, source), "utf8");
      // On cherche le préfixe dans un littéral de gabarit de clé R2, pas dans un
      // commentaire : un test qui trouve sa propre documentation reste vert
      // quand le code disparaît.
      const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
      expect(sansCommentaires).toMatch(new RegExp("`" + prefixe + "/\\$\\{"));
    },
  );
});

describe("🔴 sauvegardes — tout préfixe R2 durable est couvert par un script", () => {
  it.each(PREFIXES_DURABLES)(
    "`$prefixe/` ($quoi) est nommé par au moins un script de sauvegarde",
    ({ prefixe }) => {
      const scripts = lireScriptsDeSauvegarde().filter(({ contenu }) =>
        new RegExp(`(^|[^a-z_])${prefixe}/`, "m").test(contenu),
      );
      expect(
        scripts.map((s) => s.chemin),
        `Aucun script de sauvegarde ne mentionne le préfixe R2 « ${prefixe}/ ». ` +
          `Ce que l'application y écrit n'est sauvegardé par RIEN — et le tableau ` +
          `de bord reste vert, parce qu'un composant absent de l'énumération n'a ` +
          `ni run ni retard. Voir l'en-tête de ce fichier (constat D66-01).`,
      ).not.toHaveLength(0);
    },
  );
});

/**
 * Composants sciemment portés par plusieurs scripts, avec le motif.
 *
 * ⚠️ Une entrée ici est une **DETTE**, pas un blanc-seing. Elle porte le même
 * risque que `D66-05` : la détection de retard raisonne sur le DERNIER run par
 * composant, donc le script survivant masque le script mort. Ce n'est pas
 * l'endroit où ranger un doublon qu'on n'a pas envie de trancher.
 */
const PLUSIEURS_SCRIPTS_ASSUME: Record<string, string> = {
  // `backup-postgres.sh` écrit vers la Storage Box Hetzner, `backup-postgres-r2.sh`
  // vers Cloudflare R2 (hors site), `vps/run-pg-hourly-backup.sh` est le
  // lanceur horaire. Trois chemins, une seule base — la séparation en
  // `postgres_storagebox` / `postgres_r2` est la bonne réponse, mais elle change
  // l'alerting de sauvegarde et n'a rien à faire dans la PR qui couvre le bucket
  // applicatif. Consigné `P3-06`, à trancher séparément.
  postgres: "trois chemins complémentaires (Storage Box, R2, lanceur horaire) — P3-06",
  // Les `vps/run-*.sh` sont des LANCEURS : ils invoquent le script d'implémentation
  // et en reprennent le composant. C'est correct — le défaut de `D66-05` était
  // qu'un lanceur portait le composant d'un AUTRE script, avec une charge utile
  // différente.
  docuseal: "lanceur `vps/run-docuseal-backup.sh` + implémentation `backup-docuseal.sh`",
};

describe("🔴 sauvegardes — un composant, un script", () => {
  it("aucune valeur de COMPONENT n'est utilisée par deux scripts différents", () => {
    const parComposant = new Map<string, string[]>();
    for (const { chemin, composant } of composantsDeclares()) {
      const deja = parComposant.get(composant) ?? [];
      if (!deja.includes(chemin)) deja.push(chemin);
      parComposant.set(composant, deja);
    }
    const partages = [...parComposant.entries()]
      .filter(([, ch]) => ch.length > 1)
      .filter(([composant]) => !(composant in PLUSIEURS_SCRIPTS_ASSUME));

    // Témoin de non-vacuité : si l'extraction des `COMPONENT=` rendait un
    // ensemble vide, ce test passerait sur n'importe quoi. On exige donc qu'elle
    // ait effectivement trouvé les scripts du dépôt.
    expect(parComposant.size).toBeGreaterThan(5);
    expect(
      partages,
      `Deux scripts rapportent sous le même composant. La détection de retard ` +
        `(src/server/backups/queries.ts) raisonne sur le DERNIER run par ` +
        `composant : si l'un des deux crons meurt, l'autre garde le tableau vert. ` +
        `Un témoin positif qui masque un témoin négatif (constat D66-05).`,
    ).toStrictEqual([]);
  });

  it("chaque COMPONENT déclaré existe dans l'énumération Prisma `BackupComponent`", () => {
    const schema = readFileSync(path.join(RACINE, "prisma", "schema.prisma"), "utf8");
    const bloc = schema.match(/enum BackupComponent \{([\s\S]*?)\}/);
    expect(bloc, "énumération `BackupComponent` introuvable au schéma").not.toBeNull();
    const valeurs = new Set(
      [...bloc![1]!.matchAll(/^\s*([a-z_]+)\s*(?:\/\/.*)?$/gm)]
        .map((m) => m[1]!)
        .filter((v) => v !== "map"),
    );
    // Témoin de non-vacuité : si l'extraction rendait un ensemble vide, le test
    // passerait sur n'importe quoi.
    expect(valeurs.size).toBeGreaterThan(5);

    const inconnus = composantsDeclares()
      .filter(({ composant }) => !valeurs.has(composant))
      .map(({ chemin, composant }) => `${chemin} → ${composant}`);
    expect(
      inconnus,
      `Un script rapporte sous un composant absent de l'énumération : la ligne ` +
        `sera refusée à l'insertion, et la sauvegarde passera pour non exécutée.`,
    ).toStrictEqual([]);
  });
});
