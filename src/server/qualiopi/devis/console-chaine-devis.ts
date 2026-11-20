/**
 * Chaîne du devis dans la console : règles PURES (aucune lecture, aucun effet).
 *
 * - le lien du PDF émis (la route de téléchargement existe et exige l'admin) ;
 * - l'état d'horodatage à afficher dans le bloc « Signature électronique » ;
 * - l'aide « fiche sans adresse e-mail ».
 */

/** Route existante `GET /api/qualiopi/documents/[id]` (session admin exigée). */
export function urlPdfDevisEmis(d: {
  statut: string;
  documentGenereId: string | null;
}): string | null {
  if (d.statut === "brouillon" || d.documentGenereId === null) return null;
  return `/api/qualiopi/documents/${d.documentGenereId}`;
}

export interface LigneHorodatage {
  readonly statut: string;
  readonly horodateAt: Date | null;
  readonly creeAt: Date;
}

export interface EtatHorodatageDevis {
  readonly genre: "obtenu" | "attente" | "non_configure";
  readonly libelle: string;
}

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/**
 * Une ligne en attente prime (la plus ancienne) ; sinon le jeton obtenu le plus récent ;
 * aucune ligne (ou horodatage jamais mis en place) : « non configuré ».
 */
export function etatHorodatageDevis(
  lignes: readonly LigneHorodatage[],
  _maintenant: Date = new Date(),
): EtatHorodatageDevis {
  const attente = lignes
    .filter((l) => l.statut === "en_attente")
    .sort((a, b) => a.creeAt.getTime() - b.creeAt.getTime())[0];
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
