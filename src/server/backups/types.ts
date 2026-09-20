/**
 * Backups & DR (ADR 0032) — types & constantes partagées (server-only).
 *
 * Source unique des composants/kinds/status (consommée par Zod ingestion +
 * affichage admin) et des cibles RPO (pour enrichir BackupRun.ageVsRpoMin).
 * FR-only (EN désactivé runtime).
 */

// ─── Listes canoniques (alignées enum Prisma BackupComponent/Kind/Status) ────
export const BACKUP_COMPONENTS = [
  "postgres",
  "postgres_pitr",
  "redis",
  "files_image_bank",
  "docuseal",
  "plausible_pg",
  "plausible_clickhouse",
  "secrets",
  "git_mirror",
  // 🔴 AJOUTÉS LE 2026-09-20. Ces deux valeurs existent dans l'enum Prisma
  // `BackupComponent` DEPUIS LE 2026-08-19 — la migration est passée, la base
  // les accepte. Cette liste-ci, qui alimente le schéma Zod de
  // `POST /api/internal/backups`, ne les a jamais reçues : la correction du
  // 19 août n'a été faite qu'à moitié.
  //
  // Conséquence mesurée le 2026-09-20 : l'API répondait **HTTP 422** à ces deux
  // composants (« Invalid enum value … received 'files_documents' »), et
  // `report_backup_run` termine par `curl … || true` — l'erreur était donc
  // AVALÉE. Les scripts annonçaient « OK » et `backup_runs` ne recevait rien.
  //
  // La sauvegarde des CV des candidats est donc invisible depuis le
  // **2026-09-03**, jour où le VPS a reçu le script qui rapporte sous
  // `files_utilisateurs`. Dix-sept jours pendant lesquels le tableau de bord
  // montrait une dernière sauvegarde au 03/09 et rien d'alarmant — le voyant
  // ne vieillissait pas, il avait simplement cessé d'exister.
  //
  // 🔑 Un composant absent de cette liste ne « manque » pas au tableau de bord :
  // il n'existe pas pour lui, donc il ne peut pas être en retard, donc il
  // n'alerte jamais. Le vert ne vient pas d'une mesure réussie — il vient de
  // l'absence de question.
  "files_documents",
  "files_utilisateurs",
] as const;
export type BackupComponentValue = (typeof BACKUP_COMPONENTS)[number];

/**
 * Composants qu'on a consciemment décidé de NE PAS sauvegarder (décision
 * 2026-07-11) : données reconstructibles / non critiques / couvertes autrement.
 * - postgres_pitr : PITR abandonné, le dump horaire couvre le RPO retenu
 * - redis : files de jobs BullMQ, reconstructibles
 * - git_mirror : le code vit déjà sur GitHub
 * Ces composants sont rendus « non suivi — assumé » (tone neutre) au lieu de
 * « critique », et sont EXCLUS des alertes /alerts. Retirer un composant de ce
 * set le remet immédiatement sous surveillance (alerte si non sauvegardé).
 * NB : `files_image_bank` avait été RETIRÉ de ce set le 2026-07-11, quand
 * `run-files-backup.sh` rapportait encore sous ce nom. Il y REVIENT le
 * 2026-09-20 : ce script est passé à `files_utilisateurs` le 2026-08-19, plus
 * rien n'alimente `files_image_bank`, et le flux des CV est désormais suivi
 * sous son propre nom.
 */
export const ACCEPTED_GAP_COMPONENTS: ReadonlySet<BackupComponentValue> = new Set([
  "postgres_pitr",
  "redis",
  "git_mirror",
  // 🔴 Ajouté le 2026-09-20. Ce composant n'est plus alimenté depuis le
  // 2026-08-19 : son flux a MIGRÉ vers `files_utilisateurs`. Sans cette ligne
  // il serait « en retard » pour toujours, sans qu'aucune action puisse le
  // rattraper — une alerte qu'on apprend à ignorer, donc une alerte de moins.
  //
  // ⚠️ Ce n'est PAS un aveu que la banque d'images n'a pas besoin d'être
  // sauvegardée : c'est le constat que CE composant-ci ne la sauvegarde pas et
  // ne l'a jamais fait. Le jour où le cron de `backup-image-bank-r2.sh` sera
  // posé, il faudra un composant à lui — et le retirer d'ici.
  "files_image_bank",
]);

export const BACKUP_KINDS = ["daily", "weekly", "monthly", "pitr", "manual"] as const;
export type BackupKindValue = (typeof BACKUP_KINDS)[number];

export const BACKUP_STATUSES = ["success", "warning", "failed", "running", "skipped"] as const;
export type BackupStatusValue = (typeof BACKUP_STATUSES)[number];

export const RESTORE_DRILL_STATUSES = ["passed", "failed", "partial", "running"] as const;
export type RestoreDrillStatusValue = (typeof RESTORE_DRILL_STATUSES)[number];

// ─── RPO cible par composant (minutes) ───────────────────────────────────────
// Sert à calculer ageVsRpoMin côté serveur à l'ingestion + le bandeau "manqué".
export const RPO_TARGETS_MIN: Record<BackupComponentValue, number> = {
  postgres: 24 * 60, // dump quotidien
  postgres_pitr: 60, // WAL streaming < 1h (ADR 0032)
  redis: 24 * 60, // confort
  files_image_bank: 24 * 60,
  docuseal: 24 * 60,
  plausible_pg: 24 * 60,
  plausible_clickhouse: 24 * 60,
  secrets: 24 * 60, // quotidien (cron VPS 0 2 * * *)
  git_mirror: 7 * 24 * 60, // hebdo
  files_documents: 24 * 60, // miroir quotidien 5 h 15 vers le bucket verrouillé
  files_utilisateurs: 24 * 60, // cron VPS 4 h 15
};

/** Seuil au-delà duquel un drill de restauration est considéré périmé. */
export const DRILL_STALE_DAYS = 35;

// ─── Libellés FR ──────────────────────────────────────────────────────────────
export const COMPONENT_LABELS_FR: Record<BackupComponentValue, string> = {
  postgres: "PostgreSQL (dump)",
  postgres_pitr: "PostgreSQL (PITR / WAL)",
  redis: "Redis / BullMQ",
  // 🔴 2026-09-20 — CE COMPOSANT NE VEUT PLUS DIRE CE QUE SON NOM ANNONCE.
  //
  // Une première correction l'avait renommé « Banque d'images », en croyant que
  // `scripts/backup-image-bank-r2.sh` l'alimentait. FAUX, et relevé en
  // relecture : **aucun cron n'appelle ce script**, ni dans
  // `scripts/vps/crontab.snapshot.txt`, ni sur le VPS, où aucun wrapper
  // `run-image-bank-*.sh` n'existe. Ses 56 traces viennent de
  // `run-files-backup.sh`, qui rapportait sous ce nom jusqu'au **2026-09-03**.
  //
  // ⚠️ DEUX DATES, ET C'EST TOUT LE SUJET. Le dépôt a basculé le 2026-08-19
  // (`ae8a23ff9`), mais les wrappers du VPS ne se déploient pas tout seuls :
  // `/opt/axion-ia/run-files-backup.sh` n'a reçu la nouvelle version que le
  // 2026-09-03. Entre les deux, le serveur a continué de rapporter sous
  // l'ancien nom — d'où des traces jusqu'au 03/09, et plus AUCUNE ensuite,
  // puisque le nouveau nom partait en 422. La dernière trace lisible du
  // tableau de bord est donc celle d'un script périmé.
  //
  // L'ancien libellé « Fichiers (CV, documents, avis) » n'était donc pas faux :
  // il l'est DEVENU le 19 août, en même temps que le 422. Et le renommer en
  // « Banque d'images » aurait affiché « 56 sauvegardes, dernière le 19/08 »
  // pour un flux qui n'a jamais tourné sous ce nom — un troisième faux vert,
  // ouvert en fermant les deux autres.
  //
  // ⛔ ET LA BANQUE D'IMAGES, ELLE, N'EST SAUVEGARDÉE PAR RIEN. Le script
  // existe depuis toujours et personne ne l'appelle — exactement le défaut que
  // `backup-documents-r2.sh` a connu jusqu'au 2026-09-20. À trancher : poser le
  // cron, ou assumer par écrit que les originaux de la banque d'images ne sont
  // pas sauvegardés.
  files_image_bank: "Fichiers utilisateurs (vestige, jusqu'au 03/09/2026)",
  docuseal: "Docuseal (signatures)",
  plausible_pg: "Plausible (Postgres)",
  plausible_clickhouse: "Plausible (ClickHouse)",
  secrets: "Secrets & config",
  git_mirror: "Miroir Git",
  files_documents: "Pièces légales (conventions, attestations, signatures)",
  files_utilisateurs: "Fichiers déposés (CV, documents de console, avis)",
};

export const KIND_LABELS_FR: Record<BackupKindValue, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  pitr: "PITR",
  manual: "Manuel",
};

export const STATUS_LABELS_FR: Record<BackupStatusValue, string> = {
  success: "Réussi",
  warning: "Avertissement",
  failed: "Échec",
  running: "En cours",
  skipped: "Ignoré",
};

// ─── Types de vue (lecture admin) ─────────────────────────────────────────────
export interface BackupOverviewRow {
  component: BackupComponentValue;
  label: string;
  lastStatus: BackupStatusValue | null;
  lastAt: Date | null;
  sizeBytes: bigint | null;
  durationSec: number | null;
  destinations: string[];
  rpoTargetMin: number;
  ageVsRpoMin: number | null; // null = jamais sauvegardé
  /** ✅ frais · ⚠️ en retard/avertissement · 🔴 échec ou jamais · ➖ non suivi (assumé). */
  tone: "success" | "warning" | "destructive" | "neutral";
  lastDrillAt: Date | null;
  drillStale: boolean; // dernier drill réussi > DRILL_STALE_DAYS (ou jamais)
  /** Composant volontairement non sauvegardé (cf. ACCEPTED_GAP_COMPONENTS) : neutralise tone + alertes. */
  acceptedGap: boolean;
}

export interface BackupHistoryItem {
  id: string;
  component: BackupComponentValue;
  componentLabel: string;
  kind: BackupKindValue;
  status: BackupStatusValue;
  startedAt: Date;
  durationSec: number | null;
  sizeBytes: bigint | null;
  destinations: string[];
  ageVsRpoMin: number | null;
  failReason: string | null;
}

export interface BackupHistoryPage {
  items: BackupHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BackupBanners {
  missedBackup: boolean; // un composant en retard vs RPO ou jamais sauvegardé
  cascading: boolean; // un dernier run failed avec consecutiveFailures >= 2
  staleDrill: boolean; // un composant sans drill réussi récent
  details: string[];
}
