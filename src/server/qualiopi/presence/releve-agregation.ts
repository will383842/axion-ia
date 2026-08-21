/**
 * Relevé de connexion distanciel — agrégation par STAGIAIRE.
 *
 * ## Le défaut que ce module corrige (`DIST-03`)
 *
 * Le relevé était construit directement depuis les CRÉNEAUX de présence. Une
 * session sur deux demi-journées produisait donc **deux lignes par personne**,
 * et le récapitulatif annonçait « Stagiaires conformes : 8 / 8 » pour **quatre**
 * personnes.
 *
 * Ce document est remis à l'**OPCO** et remplace la feuille d'émargement pour
 * les formations à distance. Il déclarait un effectif double.
 *
 * 🔑 Le gabarit ne laissait pourtant aucun doute sur ce qu'il fallait compter :
 * « **Stagiaires** conformes ». Le dénominateur, lui, comptait des créneaux. Un
 * libellé exact au-dessus d'un calcul faux ne se remarque pas — il rassure.
 *
 * ## Module PUR
 *
 * Aucun import Prisma ni React : l'agrégation se teste sans monter la chaîne
 * PDF, qui tire `@react-pdf/renderer` et rend la collecte Vitest coûteuse. Le
 * formatage est injecté, pour la même raison.
 */

/** Un créneau de présence, tel que lu en base. */
export interface CreneauReleve {
  readonly enrollmentId: string;
  readonly nomPrenom: string;
  readonly heureConnexion: Date | null;
  readonly heureDeconnexion: Date | null;
  readonly dureeRealiseeMinutes: number | null;
  readonly dureePrevueMinutes: number | null;
}

/** Une ligne du relevé, prête à imprimer. */
export interface LigneReleve {
  readonly nomPrenom: string;
  readonly heureConnexion: string;
  readonly heureDeconnexion: string;
  readonly dureeEffective: string;
  readonly presenceValidee: boolean;
}

export interface FormatsReleve {
  readonly formatHeure: (d: Date) => string;
  readonly formatDuree: (minutes: number) => string;
}

/**
 * Regroupe les créneaux par stagiaire et décide de sa conformité.
 *
 * Choix d'agrégation, et leurs raisons :
 *
 * - **connexion = la PREMIÈRE, déconnexion = la DERNIÈRE.** Ce sont les bornes
 *   réelles de la journée du stagiaire. Prendre celles d'un créneau au hasard —
 *   ce que faisait l'ancien code en imprimant une ligne par créneau — affichait
 *   des plages qui ne correspondaient à aucune séance complète.
 *
 * - **durée effective = la SOMME.** C'est le total réellement suivi, et c'est ce
 *   que l'OPCO finance.
 *
 * - **conformité = somme réalisée ÷ somme prévue ≥ seuil annoncé.** Elle était
 *   jusqu'ici la valeur `present` d'un créneau, calculée contre un seuil FIXE de
 *   50 % par créneau, alors que l'en-tête du document annonce « Durée minimale
 *   requise : N % de la durée de la session ». 🔴 Le document **affichait une
 *   règle et en appliquait une autre** — et c'est la règle affichée qui engage
 *   l'organisme devant le financeur.
 *
 * - ⚠️ **`prevue === 0` ne vaut PAS conforme.** Sans durée prévue il n'y a rien
 *   à comparer : affirmer la conformité serait la fabriquer. C'est le cas d'une
 *   session dont les journées n'ont pas été déclarées — fréquent, et
 *   précisément celui où il ne faut rien affirmer.
 *
 * L'ordre d'apparition des stagiaires est celui de leur premier créneau : un
 * `Map` préserve l'ordre d'insertion, et un relevé qui réordonnerait les
 * personnes d'une génération à l'autre serait illisible à la comparaison.
 */
export function agregerReleveParStagiaire(
  creneaux: readonly CreneauReleve[],
  seuilPct: number,
  formats: FormatsReleve,
): LigneReleve[] {
  interface Cumul {
    nomPrenom: string;
    connexion: Date | null;
    deconnexion: Date | null;
    realisee: number;
    prevue: number;
  }
  const parStagiaire = new Map<string, Cumul>();

  for (const c of creneaux) {
    const cumul: Cumul = parStagiaire.get(c.enrollmentId) ?? {
      nomPrenom: c.nomPrenom,
      connexion: null,
      deconnexion: null,
      realisee: 0,
      prevue: 0,
    };
    if (c.heureConnexion !== null) {
      cumul.connexion =
        cumul.connexion === null || c.heureConnexion < cumul.connexion
          ? c.heureConnexion
          : cumul.connexion;
    }
    if (c.heureDeconnexion !== null) {
      cumul.deconnexion =
        cumul.deconnexion === null || c.heureDeconnexion > cumul.deconnexion
          ? c.heureDeconnexion
          : cumul.deconnexion;
    }
    cumul.realisee += c.dureeRealiseeMinutes ?? 0;
    cumul.prevue += c.dureePrevueMinutes ?? 0;
    parStagiaire.set(c.enrollmentId, cumul);
  }

  return [...parStagiaire.values()].map((s) => ({
    nomPrenom: s.nomPrenom,
    heureConnexion: s.connexion ? formats.formatHeure(s.connexion) : "—",
    heureDeconnexion: s.deconnexion ? formats.formatHeure(s.deconnexion) : "—",
    dureeEffective: formats.formatDuree(s.realisee),
    presenceValidee: s.prevue > 0 && (s.realisee / s.prevue) * 100 >= seuilPct,
  }));
}
