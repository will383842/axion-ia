/**
 * LA PROVENANCE D'UNE CANDIDATURE — normalisation, bornage, libellés.
 *
 * 🔴 POURQUOI CE FICHIER EST PUR, ET SÉPARÉ DE L'ACTION.
 *
 * Trois consommateurs lisent la même notion : l'action qui écrit la
 * candidature, l'écran qui agrège par canal, et le test. Écrite dans l'action,
 * elle aurait été recopiée deux fois — et la copie de l'écran est celle qui
 * dérive, parce que c'est elle qu'on retouche pour « faire joli ».
 *
 * 🔑 CE MODULE NE TOUCHE NI LA BASE NI LA SESSION. Il transforme un cookie en
 * quatre champs, rien de plus. C'est ce qui le rend éprouvable sur des valeurs
 * fixes, y compris les valeurs hostiles — un `utm_source` de trois mille
 * caractères, ou qui contient des balises.
 */

/** Ce que porte le cookie de tunnel, dans le vocabulaire de `lib/utm`. */
export interface UtmLu {
  readonly utm_source?: string | undefined;
  readonly utm_medium?: string | undefined;
  readonly utm_campaign?: string | undefined;
}

export interface Provenance {
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly landingPath: string | null;
}

/**
 * Longueurs maximales, DÉRIVÉES des colonnes.
 *
 * 🔴 Elles ne sont pas décoratives : `@db.VarChar(120)` fait ÉCHOUER l'insertion
 * au-delà, et l'échec arrive au fond de la pile, sur un message Postgres qui
 * accuse la colonne. Une candidature perdue parce qu'un lien portait un
 * `utm_campaign` trop long serait un défaut invisible — le candidat verrait
 * « une erreur est survenue » et n'y reviendrait pas.
 *
 * On TRONQUE plutôt que de refuser : une provenance approximative vaut mieux
 * qu'une candidature perdue. `lib/utm` borne déjà à la lecture du cookie ; cette
 * seconde borne existe parce que ce module a d'autres appelants possibles, et
 * qu'une garde qui dépend de son appelant n'en est pas une.
 */
export const MAX_SOURCE = 120;
export const MAX_MEDIUM = 120;
export const MAX_CAMPAGNE = 160;
export const MAX_CHEMIN = 255;

/** Normalise : coupe les espaces, borne la longueur, rend `null` sur le vide. */
export function borner(valeur: string | undefined | null, max: number): string | null {
  const v = valeur?.trim();
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * Le chemin d'arrivée, SANS sa chaîne de requête.
 *
 * 🔑 La requête est retirée à dessein : elle porte les UTM, qui ont déjà leurs
 * colonnes, et parfois un identifiant de session publicitaire — c'est-à-dire un
 * quasi-identifiant qu'on n'a aucune raison de conserver deux ans dans un
 * dossier de candidature. On garde ce qui répond à la question « quelle page
 * a-t-elle été cliquée », pas plus.
 */
export function cheminSeul(url: string | undefined | null): string | null {
  const brut = url?.trim();
  if (!brut) return null;
  const sansRequete = brut.split("?")[0]!.split("#")[0]!;
  // Un chemin relatif seulement : une URL absolue viendrait d'un en-tête que
  // l'appelant ne contrôle pas, et n'aurait plus de sens comme « page du site ».
  if (!sansRequete.startsWith("/")) return null;
  return borner(sansRequete, MAX_CHEMIN);
}

/**
 * Ce qu'on écrit en base à partir du tunnel.
 *
 * Aucune valeur inventée : quand le cookie est absent — navigation directe,
 * cookie refusé, lien sans balise — les quatre champs restent `null`. Poser
 * « direct » à la place fabriquerait un canal qui n'existe pas et qui
 * dominerait le classement dès la première semaine.
 */
export function provenanceDepuisLeTunnel(utm: UtmLu, cheminArrivee?: string | null): Provenance {
  return {
    utmSource: borner(utm.utm_source, MAX_SOURCE),
    utmMedium: borner(utm.utm_medium, MAX_MEDIUM),
    utmCampaign: borner(utm.utm_campaign, MAX_CAMPAGNE),
    landingPath: cheminSeul(cheminArrivee),
  };
}

/**
 * Le libellé d'un canal à l'écran.
 *
 * 🔴 `null` devient « Provenance inconnue », JAMAIS « Direct ». Les deux ne
 * disent pas la même chose : « direct » affirme que la personne a tapé
 * l'adresse, « inconnue » dit qu'on n'a pas su. Confondre les deux ferait
 * conclure qu'un canal marche alors qu'on ne mesure rien.
 */
export const LIBELLE_PROVENANCE_INCONNUE = "Provenance inconnue";

export function libelleCanal(source: string | null): string {
  return source ?? LIBELLE_PROVENANCE_INCONNUE;
}
