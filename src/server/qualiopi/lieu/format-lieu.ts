/**
 * Qualiopi — Formatage du lieu de déroulement d'une prestation.
 *
 * Fonctions PURES (aucun I/O), partagées par la fiche session, le calendrier et
 * les documents légaux (convention L.6353-1, convocation — Qualiopi off.9 :
 * information du bénéficiaire sur les conditions de déroulement).
 *
 * Miroir exact des champs `lieu*` de `TrainingSession` et `CoachingSession`.
 * Tous nullables : une prestation legacy sans lieu renvoie `null` (les documents
 * retombent alors sur la modalité seule — comportement inchangé).
 */

/** Valeurs de l'enum Prisma `LieuType` (miroir, sans import du client). */
export type LieuTypeValue = "sur_site" | "nos_locaux" | "distanciel";

/** Champs `lieu*` d'une session (formation collective ou coaching 1-to-1). */
export interface LieuFields {
  lieuType?: LieuTypeValue | null;
  lieuIntitule?: string | null;
  lieuAdresse?: string | null;
  lieuCodePostal?: string | null;
  lieuVille?: string | null;
  lieuSalle?: string | null;
  lieuVisioUrl?: string | null;
}

const LABELS: Record<LieuTypeValue, string> = {
  sur_site: "Sur site",
  nos_locaux: "Nos locaux",
  distanciel: "Distanciel",
};

/** Chaîne non vide après trim, sinon null. */
function clean(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Hôte lisible d'une URL de visio (ex. `meet.google.com`). Null si URL invalide. */
function visioHost(url: string | null | undefined): string | null {
  const u = clean(url);
  if (u === null) return null;
  try {
    return new URL(u).hostname || null;
  } catch {
    return null;
  }
}

/** Vrai dès qu'au moins un champ de lieu est renseigné (pilote le score de complétude). */
export function isLieuRenseigne(l: LieuFields): boolean {
  return (
    l.lieuType != null ||
    clean(l.lieuIntitule) !== null ||
    clean(l.lieuAdresse) !== null ||
    clean(l.lieuCodePostal) !== null ||
    clean(l.lieuVille) !== null ||
    clean(l.lieuSalle) !== null ||
    clean(l.lieuVisioUrl) !== null
  );
}

/**
 * Rend le lieu en une ligne lisible. `null` si rien n'est renseigné.
 *
 * Exemples :
 *   « Sur site — 11 Av. Paul Verlaine, 38100 Grenoble · Salle B2 »
 *   « Nos locaux »
 *   « Distanciel — meet.google.com »
 */
export function formatLieu(l: LieuFields): string | null {
  if (!isLieuRenseigne(l)) return null;

  if (l.lieuType === "distanciel") {
    const host = visioHost(l.lieuVisioUrl);
    return host !== null ? `${LABELS.distanciel} — ${host}` : LABELS.distanciel;
  }

  const codePostalVille = [clean(l.lieuCodePostal), clean(l.lieuVille)].filter(Boolean).join(" ");
  const adresse = [clean(l.lieuAdresse), codePostalVille.length > 0 ? codePostalVille : null]
    .filter(Boolean)
    .join(", ");

  const base = [
    l.lieuType != null ? LABELS[l.lieuType] : null,
    clean(l.lieuIntitule),
    adresse.length > 0 ? adresse : null,
  ]
    .filter(Boolean)
    .join(" — ");

  const salle = clean(l.lieuSalle);
  const rendu =
    salle !== null ? (base.length > 0 ? `${base} · Salle ${salle}` : `Salle ${salle}`) : base;

  if (rendu.length === 0) {
    // Ni type, ni intitulé, ni adresse, ni salle : reste l'URL de visio éventuelle.
    const host = visioHost(l.lieuVisioUrl);
    return host !== null ? `${LABELS.distanciel} — ${host}` : null;
  }
  return rendu;
}
