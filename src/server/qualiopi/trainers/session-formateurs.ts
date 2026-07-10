/**
 * Qualiopi — Dérivation normalisée des affectations formateur↔session.
 *
 * Fonctions PURES (aucun I/O, testables) partagées par :
 *   - le backfill `prisma/scripts/backfill-session-formateurs-2026-07-09.ts`
 *   - le dual-write de `assignTrainerToSessionAction`
 *
 * Elles convertissent l'état legacy (`TrainingSession.formateurPrincipalId` FK
 * + `coFormateurs` Json) en lignes `SessionFormateur`. Le principal (la FK) est
 * la source de vérité : il écrase toujours le rôle d'une entrée JSON homonyme.
 *
 * Contexte : chantier Cockpit Pilotage — P0 normalisation de `coFormateurs`
 * (Json non indexable/agrégeable) vers la table `session_formateurs`.
 */

/** Valeurs de l'enum Prisma `SessionFormateurRole` (miroir, sans import client). */
export type SessionFormateurRoleValue = "principal" | "co_formateur" | "assistant" | "tuteur_afest";

const VALID_ROLES: readonly SessionFormateurRoleValue[] = [
  "principal",
  "co_formateur",
  "assistant",
  "tuteur_afest",
];

/** Une ligne d'affectation dérivée, prête à upsert dans `SessionFormateur`. */
export interface SessionFormateurRow {
  trainerId: string;
  role: SessionFormateurRoleValue;
  heuresAnimees: number | null;
}

/** Entrée brute d'un item du champ Json `coFormateurs`. */
interface CoFormateurEntry {
  trainerId: string;
  role?: string;
  heuresAnimees?: number;
}

/**
 * Parse défensif du champ Json `coFormateurs` (`[{ trainerId, role?, heuresAnimees? }]`).
 * Ignore silencieusement les items malformés (pas de trainerId string).
 */
export function parseCoFormateurs(raw: unknown): CoFormateurEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CoFormateurEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const trainerId = rec["trainerId"];
    if (typeof trainerId !== "string" || trainerId.length === 0) continue;
    // Construction conditionnelle (exactOptionalPropertyTypes : ne jamais assigner
    // `undefined` explicitement à une propriété optionnelle).
    const entry: CoFormateurEntry = { trainerId };
    if (typeof rec["role"] === "string") entry.role = rec["role"];
    if (typeof rec["heuresAnimees"] === "number" && Number.isFinite(rec["heuresAnimees"])) {
      entry.heuresAnimees = rec["heuresAnimees"];
    }
    out.push(entry);
  }
  return out;
}

/** Normalise un rôle libre vers l'enum ; défaut `co_formateur`. */
function normalizeRole(role: string | undefined): SessionFormateurRoleValue {
  return role !== undefined && (VALID_ROLES as readonly string[]).includes(role)
    ? (role as SessionFormateurRoleValue)
    : "co_formateur";
}

/** Rôle d'un NON-principal : jamais `principal` (rétrogradé en `co_formateur`). */
function nonPrincipalRole(role: string | undefined): SessionFormateurRoleValue {
  const r = normalizeRole(role);
  return r === "principal" ? "co_formateur" : r;
}

/**
 * Dérive les lignes `SessionFormateur` d'une session à partir de son état legacy.
 * Invariant garanti : AU PLUS UN `principal` (l'index partiel SQL l'exige).
 * - le principal = la FK `formateurPrincipalId` si présente ; sinon, à défaut,
 *   la 1ʳᵉ entrée JSON déclarée `principal` (interprétation legacy des lecteurs) ;
 * - toute autre entrée déclarée `principal` dans le Json est rétrogradée en
 *   `co_formateur` ; les rôles `assistant` / `tuteur_afest` sont conservés ;
 * - dédup par `trainerId` ; idempotent et déterministe.
 */
/**
 * Résout l'ID du formateur PRINCIPAL d'une session (source unique).
 * Ordre : FK `formateurPrincipalId` (fiable, écrite par l'assignation) → 1ʳᵉ
 * entrée JSON déclarée `principal` → 1ʳᵉ entrée JSON → null. Utilisé par les
 * générateurs de documents (convention, attestation) et l'émargement pour
 * nommer le bon formateur au lieu du fallback raison sociale.
 */
export function resolvePrincipalTrainerId(input: {
  formateurPrincipalId: string | null;
  coFormateurs: unknown;
}): string | null {
  if (input.formateurPrincipalId) return input.formateurPrincipalId;
  const entries = parseCoFormateurs(input.coFormateurs);
  return entries.find((e) => e.role === "principal")?.trainerId ?? entries[0]?.trainerId ?? null;
}

export function buildSessionFormateurRows(input: {
  formateurPrincipalId: string | null;
  coFormateurs: unknown;
}): SessionFormateurRow[] {
  const entries = parseCoFormateurs(input.coFormateurs);

  // L'UNIQUE principal : la FK prime, sinon la 1ʳᵉ entrée JSON *déclarée* principal.
  // (Pas de fallback entries[0] ici : un co-formateur non désigné ne devient PAS
  // principal — contrairement au résolveur des lecteurs, cf. resolvePrincipalTrainerId.)
  const principalId =
    input.formateurPrincipalId ?? entries.find((e) => e.role === "principal")?.trainerId ?? null;

  const rows = new Map<string, SessionFormateurRow>();
  for (const entry of entries) {
    rows.set(entry.trainerId, {
      trainerId: entry.trainerId,
      role: entry.trainerId === principalId ? "principal" : nonPrincipalRole(entry.role),
      heuresAnimees: entry.heuresAnimees ?? null,
    });
  }

  // Le principal (FK) peut ne pas figurer dans le Json → l'ajouter.
  if (principalId !== null && !rows.has(principalId)) {
    rows.set(principalId, { trainerId: principalId, role: "principal", heuresAnimees: null });
  }

  return [...rows.values()];
}
