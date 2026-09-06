/**
 * Lot 1 §1.2 — LES QUATRE ÉTATS d'une étape de dossier. Module PUR.
 *
 * ## Le constat qui fait exister le quatrième
 *
 * Le soir du 15/08/2026, la moitié des rouges du dossier étaient **encore
 * sauvables**. Un rouge indistinct ne dit pas « fais-le maintenant », il dit
 * « c'est foutu » — et devant « c'est foutu », personne ne fait rien.
 *
 * D'où la séparation :
 *
 * | État | Ce que la personne doit comprendre |
 * |---|---|
 * | `fait` | rien à faire |
 * | `a_faire` | dans les temps |
 * | **`rattrapable`** | l'échéance est passée **mais le geste reste utile** — fais-le MAINTENANT |
 * | `hors_delai` | irréversible : le geste reste possible, mais l'écart est consigné et **ne s'efface jamais** |
 *
 * ## La ligne exacte entre `rattrapable` et `hors_delai`
 *
 * Ce n'est PAS « le geste est-il encore possible ». Une attestation peut être
 * émise avec trois semaines de retard : le geste est possible, l'écart est
 * définitif. La ligne est :
 *
 * > **le geste, posé maintenant, produit-il encore un dossier conforme ?**
 *
 * Chaque étape déclare donc sa propre `borneRattrapage` — le moment après lequel
 * la réponse devient non. Pour les pièces d'avant-séance c'est le début de la
 * session ; pour l'émargement, l'expiration des jetons ; pour les pièces d'après
 * elle peut valoir l'échéance elle-même, et l'étape bascule directement.
 *
 * 🔴 Ce que ce module ne fait PAS : décider si une étape est faite. Il ne reçoit
 * que des faits déjà établis. Mélanger la dérivation (« la convention est-elle
 * signée ? ») et la temporalité (« est-il trop tard ? ») produirait un module
 * qu'on ne peut tester qu'avec une base.
 */

/** Les quatre états du plan, plus les deux aveux nécessaires. */
export type EtatEtape =
  /** Le geste a eu lieu. */
  | "fait"
  /** Pas encore fait, et l'échéance n'est pas passée. */
  | "a_faire"
  /** Échéance dépassée, MAIS le geste posé maintenant reste conforme. */
  | "rattrapable"
  /** Irréversible : l'écart est consigné et ne s'efface pas. */
  | "hors_delai"
  /** L'étape ne concerne pas ce dossier (financement, modalité, statut). */
  | "sans_objet"
  /**
   * 🔴 On ne SAIT PAS.
   *
   * Réservé aux dérivations qui peuvent échouer sans que ce soit un manque —
   * typiquement la convocation, dont `EmailLog` ne porte **aucun lien vers une
   * session** : seul le `jobId` la rattache. Si ce rattachement n'est pas
   * établi, l'étape doit dire « rattachement non établi », **jamais `fait`**.
   * Un ✅ par défaut est un mensonge ; un ✗ par défaut envoie refaire un geste
   * déjà posé. Le troisième terme est le seul honnête.
   */
  | "indetermine";

/** Un état qui appelle une action. `sans_objet` et `fait` n'en appellent pas. */
export function appelleUneAction(etat: EtatEtape): boolean {
  return etat === "a_faire" || etat === "rattrapable" || etat === "hors_delai";
}

/**
 * Gravité, pour classer « le pire état » d'un dossier.
 *
 * ⚠️ `indetermine` se place AU-DESSUS de `a_faire` et en dessous de
 * `rattrapable` : ne pas savoir est plus préoccupant qu'une échéance à venir,
 * moins qu'une échéance dépassée. Le ranger tout en bas le ferait disparaître
 * des synthèses — or c'est précisément ce qu'il faut aller vérifier.
 */
const GRAVITE: Readonly<Record<EtatEtape, number>> = {
  sans_objet: 0,
  fait: 1,
  a_faire: 2,
  indetermine: 3,
  rattrapable: 4,
  hors_delai: 5,
};

/** Le pire état d'une liste — `sans_objet` si la liste est vide. */
export function pireEtat(etats: ReadonlyArray<EtatEtape>): EtatEtape {
  return etats.reduce<EtatEtape>(
    (pire, e) => (GRAVITE[e] > GRAVITE[pire] ? e : pire),
    "sans_objet",
  );
}

export interface CalculEtat {
  /** Le geste a-t-il eu lieu ? Déjà établi par l'appelant. */
  readonly fait: boolean;
  /**
   * Date limite du geste. `null` = aucune échéance connue → l'étape reste
   * `a_faire` indéfiniment plutôt que de devenir rouge sur une date inventée.
   */
  readonly echeance: Date | null;
  /**
   * Après ce moment, le geste ne produit plus un dossier conforme.
   * `null` = jamais irréversible → l'étape reste `rattrapable`.
   */
  readonly borneRattrapage: Date | null;
  readonly maintenant: Date;
}

/**
 * L'état d'une étape.
 *
 * ⚠️ Les comparaisons sont STRICTES à l'échéance (`>`) et LARGES à la borne
 * (`>=`) : à la seconde exacte de l'échéance on est encore dans les temps, à la
 * seconde exacte du début de session on ne l'est plus. Une session qui commence
 * à 09:00 n'accepte pas une convention signée à 09:00:00.
 */
export function calculerEtat({
  fait,
  echeance,
  borneRattrapage,
  maintenant,
}: CalculEtat): EtatEtape {
  if (fait) return "fait";
  if (echeance === null) return "a_faire";
  if (maintenant.getTime() <= echeance.getTime()) return "a_faire";
  if (borneRattrapage === null) return "rattrapable";
  return maintenant.getTime() >= borneRattrapage.getTime() ? "hors_delai" : "rattrapable";
}

/**
 * La mention rendue à l'écran — **jamais la couleur seule** (WCAG 1.4.1).
 *
 * Le plan impose que l'état soit dans le TEXTE. Cette fonction est donc la
 * seule autorisée à produire ces phrases : deux formulations concurrentes pour
 * le même état finiraient par se contredire, et c'est le texte qui fait foi
 * pour quelqu'un qui n'a pas accès à la couleur.
 */
export function mentionPour(args: {
  readonly etat: EtatEtape;
  readonly echeance: Date | null;
  readonly borneRattrapage: Date | null;
  readonly faitLe: Date | null;
  readonly maintenant: Date;
  /** Pourquoi l'étape ne concerne pas ce dossier (`sans_objet`). */
  readonly motifSansObjet?: string;
  /** Pourquoi la dérivation n'a pas abouti (`indetermine`). */
  readonly motifIndetermine?: string;
}): string {
  const { etat, echeance, borneRattrapage, faitLe, maintenant } = args;
  switch (etat) {
    case "fait":
      return faitLe ? `Fait le ${jour(faitLe)}` : "Fait";
    case "a_faire":
      return echeance
        ? `À faire avant le ${jour(echeance)} (${enJours(maintenant, echeance)})`
        : "À faire";
    case "rattrapable":
      return borneRattrapage
        ? `Échéance dépassée — rattrapable avant le ${jourHeure(borneRattrapage)}`
        : "Échéance dépassée — encore rattrapable";
    case "hors_delai":
      return echeance
        ? `Hors délai : ${retardEnJours(echeance, maintenant)} — écart consigné`
        : "Hors délai — écart consigné";
    case "sans_objet":
      return args.motifSansObjet ?? "Sans objet pour ce dossier";
    case "indetermine":
      // 🔴 Cette phrase est le livrable. Elle dit qu'on ne sait pas, et elle ne
      // se confond ni avec un ✅ ni avec un manque.
      return args.motifIndetermine ?? "Rattachement non établi — à vérifier à la main";
  }
}

function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function jourHeure(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MS_JOUR = 24 * 60 * 60 * 1000;

/**
 * Combien de temps il reste, DEPUIS AUJOURD'HUI : « aujourd'hui », « demain »,
 * « dans 5 jours ».
 *
 * 🔴 F10, recette du 2026-09-04 — cette fonction rendait « J-5 ».
 *
 * Le compte est juste : il vaut bien le nombre de jours entre MAINTENANT et
 * l'échéance. C'est la NOTATION qui ment. Dans le vocabulaire de la formation,
 * « J » est le jour de la SESSION : « J-7 » désigne la convocation à envoyer
 * sept jours avant l'action, et c'est ainsi que le reste du produit l'emploie
 * (rappel J-7, rappel J-1, alerte J-2). Ici « J » désignait AUJOURD'HUI.
 *
 * Les deux repères ne coïncident que si l'échéance tombe le jour de la session.
 * Dès qu'elle est POSTÉRIEURE — évaluation à chaud due deux jours APRÈS la fin,
 * par exemple — l'écran affichait « Évaluation finale (J-3) » pour une échéance
 * qui se situe à J+2. Le lecteur en déduit qu'il est en retard de cinq jours,
 * ou qu'il lui reste trois jours avant la session : les deux sont faux.
 *
 * Aucune notation ne pouvait lever l'ambiguïté, parce que le lecteur ne sait
 * pas laquelle des deux origines est employée. On abandonne donc « J-n » ici et
 * on écrit le délai en toutes lettres : « dans 5 jours » ne se confond avec
 * aucun repère de session. « J-n » reste réservé aux jalons RELATIFS À LA
 * SESSION, où il est exact.
 */
function enJours(de: Date, a: Date): string {
  const n = ecartEnJoursCalendaires(de, a);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

/**
 * Écart en jours de CALENDRIER, pas en tranches de 24 h.
 *
 * 🔴 Second défaut, trouvé en écrivant le témoin du premier. Le calcul était
 * `Math.ceil((a - de) / MS_JOUR)` : une échéance due AUJOURD'HUI à 17 h, lue à
 * 9 h, donne 8 h d'écart, dont le plafond vaut 1 — soit « demain ». La mention
 * annonçait donc pour le lendemain une pièce à produire dans la journée, et
 * « aujourd'hui » n'était atteignable qu'une fois l'échéance DÉPASSÉE.
 *
 * C'est la même faute que « dans 7 jours » affiché pour demain (recette
 * formateur du 2026-09-04) : compter des durées là où l'utilisateur lit des
 * dates. On compare donc les quantièmes, dans le même fuseau que `jour()` qui
 * imprime la date juste à côté — sans quoi la mention pourrait dire « demain »
 * en affichant la date du jour.
 */
function ecartEnJoursCalendaires(de: Date, a: Date): number {
  const minuit = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((minuit(a) - minuit(de)) / MS_JOUR);
}

/** « +1 j », « +12 j ». Toujours au moins « +1 j » : un dépassement se voit. */
function retardEnJours(echeance: Date, maintenant: Date): string {
  const n = Math.max(1, Math.floor((maintenant.getTime() - echeance.getTime()) / MS_JOUR));
  return `+${n} j`;
}
