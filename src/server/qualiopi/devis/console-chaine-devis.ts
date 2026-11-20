/**
 * Chaîne du devis dans la console : règles PURES (aucune lecture, aucun effet).
 *
 * - le lien du PDF émis (la route de téléchargement existe et exige l'admin) ;
 * - l'état d'horodatage à afficher dans le bloc « Signature électronique » ;
 * - l'aide « fiche sans adresse e-mail ».
 */

/** Route existante `GET /api/qualiopi/documents/[id]` (session admin exigée). */
export function urlPiece(documentGenereId: string): string {
  return `/api/qualiopi/documents/${documentGenereId}`;
}

export function urlPdfDevisEmis(d: {
  statut: string;
  documentGenereId: string | null;
}): string | null {
  if (d.statut === "brouillon" || d.documentGenereId === null) return null;
  return urlPiece(d.documentGenereId);
}

export interface LigneHorodatage {
  readonly statut: string;
  readonly horodateAt: Date | null;
  readonly creeAt: Date;
  /** Seule sa PRÉSENCE compte : le texte n'est jamais affiché. */
  readonly derniereErreur?: string | null;
}

export interface EtatHorodatageDevis {
  readonly genre: "obtenu" | "attente" | "echec" | "illisible" | "non_configure";
  readonly libelle: string;
}

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/**
 * `null` (lecture impossible) : illisible. Une ligne en attente avec une erreur : échec ; en
 * attente sans erreur : attente (la plus ancienne) ; sinon le jeton obtenu le plus récent ;
 * des lignes inexploitables : illisible ; aucune ligne : « non configuré ».
 */
export function etatHorodatageDevis(
  lignes: readonly LigneHorodatage[] | null,
  _maintenant: Date = new Date(),
): EtatHorodatageDevis {
  if (lignes === null) {
    return { genre: "illisible", libelle: "Horodatage : lecture impossible, à vérifier" };
  }
  const enAttente = lignes
    .filter((l) => l.statut === "en_attente")
    .sort((a, b) => a.creeAt.getTime() - b.creeAt.getTime());
  const enEchec = enAttente.find((l) => (l.derniereErreur ?? "") !== "");
  if (enEchec !== undefined) {
    return {
      genre: "echec",
      libelle: `Horodatage : en échec depuis le ${jour(enAttente[0]!.creeAt)}, nouvel essai automatique`,
    };
  }
  const attente = enAttente[0];
  if (attente !== undefined) {
    return {
      genre: "attente",
      libelle: `Horodatage : en attente depuis le ${jour(attente.creeAt)}`,
    };
  }
  const obtenu = lignes
    .filter((l) => l.statut === "obtenu" && l.horodateAt !== null)
    .sort((a, b) => (b.horodateAt as Date).getTime() - (a.horodateAt as Date).getTime())[0];
  if (obtenu !== undefined) {
    return {
      genre: "obtenu",
      libelle: `Horodatage : obtenu le ${jour(obtenu.horodateAt as Date)}`,
    };
  }
  if (lignes.length > 0) {
    return { genre: "illisible", libelle: "Horodatage : illisible, à vérifier" };
  }
  return { genre: "non_configure", libelle: "Horodatage : non configuré" };
}

export function aideAdresseDevis(d: {
  classique: boolean;
  adresse: string | null;
  statut: string;
}): { texte: string; lienFiche: boolean } | null {
  if (d.statut !== "brouillon") return null;
  if (d.adresse !== null && d.adresse.trim() !== "") return null;
  if (d.classique) {
    return {
      texte:
        "Cette fiche n'a pas d'adresse e-mail : le devis ne peut pas partir par e-mail. Utilisez « Remis en main propre… » ci-dessous, ou ajoutez l'adresse sur la fiche.",
      lienFiche: true,
    };
  }
  return {
    texte: "Un devis à formules se signe en ligne : ajoutez l'adresse e-mail du client.",
    lienFiche: true,
  };
}
