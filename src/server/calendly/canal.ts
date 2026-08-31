/**
 * Le CANAL d'un rendez-vous : par téléphone, ou en visioconférence.
 *
 * ## Pourquoi une dérivation, et pas une colonne
 *
 * Il serait tentant d'ajouter `canal` au modèle `CalendlyEvent` et de l'écrire à
 * la capture. Ce serait une seconde source de vérité pour un fait que
 * `location` porte déjà — et deux champs qui doivent dire la même chose
 * finissent toujours par diverger. Ce dépôt en a payé le prix plusieurs fois,
 * assez pour en faire une règle.
 *
 * Le canal se DÉRIVE donc, à la lecture, de ce que Calendly a envoyé. Aucune
 * migration, aucun risque de désynchronisation, et les 18 lignes déjà en base
 * répondent correctement sans être retouchées.
 *
 * ## Ce dont on dérive, dans l'ordre
 *
 * 1. **Le `type` du lieu**, conservé dans `rawPayload.event.location.type`.
 *    C'est la source de vérité : c'est Calendly qui la pose, elle est stable, et
 *    une nomenclature existe déjà côté téléphone (`PHONE_LOCATION_TYPES` dans
 *    `api.ts`, dont ce module est le miroir assumé — voir la note plus bas).
 * 2. **La forme de `location`** en dernier recours seulement : une URL fait une
 *    visio, un numéro fait un téléphone.
 *
 * 🔴 L'ORDRE COMPTE, ET IL N'EST PAS ARBITRAIRE. `location` est un champ
 * **librement éditable** depuis la console : `updateCalendlyEventSchema` n'impose
 * qu'une longueur maximale, aucun format. « chez le client », « Teams », « à
 * définir » y sont acceptés aujourd'hui. Pire, `enrich.ts` utilise `setIfEmpty` :
 * une valeur saisie à la main n'est **jamais** écrasée par Calendly ensuite. Se
 * fier d'abord à la forme du texte reviendrait donc à laisser une faute de frappe
 * décider du contenu d'un e-mail envoyé au prospect.
 *
 * ## « inconnu » est une réponse, pas un échec
 *
 * Quand rien ne tranche, on rend `inconnu` — jamais `telephone` « par défaut ».
 * Un défaut silencieux ferait promettre un appel à quelqu'un qui attend un lien
 * de visio, et personne ne le verrait. `inconnu` se voit, et les appelants
 * savent quoi en faire : l'e-mail retombe sur l'invitation Calendly, la console
 * affiche une pastille neutre.
 */

/** Ce qu'on peut affirmer du canal d'un rendez-vous. */
export type CanalRendezVous = "telephone" | "visio" | "inconnu";

/**
 * Types de lieu Calendly qui désignent une VISIOCONFÉRENCE.
 *
 * Liste ouverte à dessein : Calendly en ajoute au fil de ses intégrations, et
 * un type inconnu doit retomber sur l'analyse de forme plutôt que d'être
 * affirmé « téléphone ».
 */
const TYPES_VISIO = new Set([
  "google_conference",
  "zoom_conference",
  "microsoft_teams_conference",
  "gotomeeting_conference",
  "webex_conference",
  "custom", // Calendly y range un lien de réunion saisi à la main
]);

/**
 * Types de lieu Calendly qui désignent un APPEL.
 *
 * ⚠️ MIROIR ASSUMÉ de `PHONE_LOCATION_TYPES` (`src/server/calendly/api.ts`).
 * Les deux listes servent deux questions différentes — « ce lieu est-il un
 * numéro exploitable ? » là-bas, « quel canal annoncer au prospect ? » ici — et
 * les fusionner créerait une dépendance entre l'extraction et l'affichage. Le
 * test `le-canal-est-derive-du-type.spec.ts` vérifie qu'elles ne divergent pas.
 */
const TYPES_TELEPHONE = new Set(["outbound_call", "inbound_call", "physical"]);

/** Une chaîne qui ressemble à un lien de réunion. */
const RESSEMBLE_A_UNE_URL = /^https?:\/\//i;

/** Une chaîne qui ressemble à un numéro composable. */
const RESSEMBLE_A_UN_NUMERO = /^[+\d][\d\s.()-]{5,}$/;

/** Lit `rawPayload.event.location.type` sans jamais lever sur une forme inattendue. */
function typeDuLieu(rawPayload: unknown): string | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null;
  const racine = rawPayload as Record<string, unknown>;
  // Deux chemins d'écriture coexistent en base : `discover` écrit l'événement
  // Calendly à la racine, `enrich` le range sous `event`. Les deux sont normaux.
  const evenement =
    typeof racine["event"] === "object" && racine["event"] !== null
      ? (racine["event"] as Record<string, unknown>)
      : racine;
  const lieu = evenement["location"];
  if (typeof lieu !== "object" || lieu === null) return null;
  const type = (lieu as Record<string, unknown>)["type"];
  return typeof type === "string" && type.trim() !== "" ? type.trim() : null;
}

/**
 * Rend le canal d'un rendez-vous.
 *
 * @param location   la colonne `calendly_events.location` (numéro, lien, ou nul)
 * @param rawPayload la colonne `calendly_events.rawPayload`, si on l'a sous la main
 */
export function canalDuRendezVous(
  location: string | null | undefined,
  rawPayload?: unknown,
): CanalRendezVous {
  const type = typeDuLieu(rawPayload);
  if (type !== null) {
    if (TYPES_VISIO.has(type)) return "visio";
    if (TYPES_TELEPHONE.has(type)) return "telephone";
    // Type connu de Calendly mais pas de nous : on ne devine pas, on descend
    // d'un cran vers la forme du texte.
  }

  const valeur = (location ?? "").trim();
  if (valeur === "") return "inconnu";
  if (RESSEMBLE_A_UNE_URL.test(valeur)) return "visio";
  if (RESSEMBLE_A_UN_NUMERO.test(valeur)) return "telephone";
  return "inconnu";
}

/** Le mot à afficher. « Format » et non « Canal » — voir la note ci-dessous. */
export const LIBELLE_CANAL: Readonly<Record<CanalRendezVous, string>> = {
  telephone: "Téléphone",
  visio: "Visio",
  inconnu: "À préciser",
};

/**
 * L'intitulé de la colonne et du champ, côté console.
 *
 * 🔑 « Format », et surtout PAS « Canal » : ce mot est déjà pris dans la console
 * — `contacts/page.tsx` l'emploie pour le type de message entrant (formulaire,
 * chatbot, e-mail). Deux « Canal » désignant deux choses différentes à deux
 * écrans d'intervalle est une confusion durable, pour un mot qui ne coûte rien à
 * changer. Arbitré par Will le 2026-08-31.
 */
export const INTITULE_FORMAT = "Format" as const;

/**
 * Teinte d'identité par format, pour la console.
 *
 * ## Pourquoi PAS un ton sémantique
 *
 * `AdminBadge` propose `success`, `warning`, `destructive`… Les employer ici
 * ferait lire un jugement là où il n'y en a pas : une visio en vert dirait
 * « tout va bien », un téléphone en orange dirait « attention ». Le format
 * n'est pas un état, c'est une modalité. La console a précisément une palette
 * pour ça — `--color-admin-id-*` — non sémantique, déjà employée par
 * `contacts/page.tsx` pour teinter les canaux de messages entrants.
 *
 * ## Pourquoi ces deux teintes-là
 *
 * `bleu` pour le téléphone n'est pas un choix libre : la console **écrit déjà**
 * `appel: { teinte: "bleu" }` dans `contacts/page.tsx`. Un appel est bleu dans
 * cette interface ; le rendez-vous téléphonique hérite de cette couleur plutôt
 * que d'en inventer une seconde pour la même idée.
 *
 * `teal` pour la visio se lit sans ambiguïté à côté du bleu. La règle de
 * collision appliquée est **par écran** : `teal` désigne aussi les messages sur
 * l'écran contacts, mais aucun canal de message n'est affiché sur l'écran des
 * appels, donc les deux sens ne se rencontrent jamais.
 *
 * 🔑 `inconnu` ne reçoit **aucune** teinte d'identité. Lui en donner une le
 * ferait ressembler à un format décidé — exactement l'inverse de ce qu'il dit.
 */
export const TEINTE_CANAL: Readonly<Record<CanalRendezVous, string | null>> = {
  telephone: "bleu",
  visio: "teal",
  inconnu: null,
};

/**
 * `colorId` Google Agenda par format.
 *
 * Google n'accepte que ses onze couleurs d'événement, désignées par un
 * identifiant numérique — la valeur n'est pas libre. On prend les deux qui
 * correspondent visuellement aux teintes de la console, pour qu'un rendez-vous
 * ait la même couleur des deux côtés :
 *
 * - `"9"` Blueberry (bleu)   → téléphone
 * - `"7"` Peacock  (turquoise) → visio
 *
 * 🔑 `inconnu` rend `null`, et un `null` doit se traduire par « on n'envoie pas
 * de `colorId` », donc par la couleur par défaut de l'agenda — surtout pas par
 * une couleur choisie au hasard qui ferait croire à une information.
 */
export const COULEUR_GOOGLE_CANAL: Readonly<Record<CanalRendezVous, string | null>> = {
  telephone: "9",
  visio: "7",
  inconnu: null,
};
