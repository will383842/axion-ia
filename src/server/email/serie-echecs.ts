/**
 * Série d'échecs d'envoi — le critère qui manquait (incident du 2026-09-15).
 *
 * ## Ce qui s'est passé, et pourquoi rien n'a sonné
 *
 * Du 2026-09-15 13 h 17 au 2026-09-17 08 h 40 — **43 heures** — aucun e-mail
 * n'est parti : la clé du relais avait été révoquée, chaque tentative rendait
 * `Invalid login: 535 Authentication Failed`. **19 échecs consécutifs, aucun
 * succès.** Sont restés à quai 18 accusés de réception de candidature vers 18
 * personnes distinctes, une alerte Qualiopi interne et un lien de connexion
 * formateur. Personne n'a été prévenu ; le propriétaire l'a découvert par
 * hasard.
 *
 * ## ⚠️ UNE HYPOTHÈSE FAUSSE, ÉCARTÉE — ne pas la reprendre
 *
 * La première rédaction de ce module accusait le SEUIL : « 19 échecs sur 43 h
 * font 2,65 échecs par tranche de 6 h, donc sous le seuil de 3 ». **C'est
 * faux**, et `serie-echecs.spec.ts` l'a dit avant la revue : 19 événements
 * répartis dans plus de sept fenêtres de six heures en mettent forcément trois
 * dans l'une d'elles (principe des tiroirs). Le critère de taux ATTEIGNAIT donc
 * son seuil pendant l'incident. Le silence vient d'ailleurs — voir
 * `creerOuActualiser` dans `alertes-service.ts` : une alerte levée puis jamais
 * refermée dé-duplique toutes les suivantes, et son titre reste figé sur le
 * compte du premier passage. Un fusible qui ne fond qu'une fois.
 *
 * ## Ce que la série ajoute, et qui est mesurable
 *
 * Le critère de taux reste en place et garde son utilité (il attrape les
 * rafales). Mais il mesure le TRAFIC autant que la panne : il lui faut au moins
 * 0,5 échec par heure. En dessous — un vendredi soir, un week-end, une file
 * calme — la chaîne peut être morte pendant des jours sans qu'aucune fenêtre
 * n'atteigne 3.
 *
 * On compte donc AUSSI les échecs **consécutifs**, c'est-à-dire ceux survenus
 * depuis le dernier envoi RÉUSSI. Cette grandeur ne dépend ni du volume, ni de
 * la durée, ni du choix d'une fenêtre :
 *
 * - une chaîne rompue produit une série qui ne s'interrompt jamais — trois
 *   e-mails suffisent, qu'ils partent en dix minutes ou en dix heures ;
 * - une chaîne saine RÉINITIALISE la série au premier succès. Une adresse morte
 *   au milieu d'un trafic normal reste donc un incident isolé, jamais une série.
 *
 * ## Un rebond n'est pas une panne d'authentification
 *
 * `email_logs` porte le motif dans `error`. Une adresse qui n'existe pas
 * (`550 5.1.1 User unknown`) est un incident de DESTINATAIRE : le relais
 * fonctionne, c'est la boîte d'en face qui refuse. La traiter comme une panne
 * de chaîne ferait crier « aucun e-mail ne part » un jour où tout part sauf un.
 * On l'écarte donc du décompte qui déclenche, sans l'effacer du décompte qui
 * s'affiche — les deux nombres sont rendus séparément.
 *
 * ⚠️ **Le doute profite à l'alerte.** Un motif inconnu, absent ou illisible est
 * compté comme un échec de CHAÎNE. Le contraire serait un prédicat qui échoue
 * fermé : un relais rendant une erreur qu'on n'a pas prévue redeviendrait
 * silencieux, ce qui est précisément le défaut qu'on répare. Le risque de faux
 * positif est borné par la série elle-même : trois échecs d'affilée **sans un
 * seul succès entre eux** n'arrivent pas sur une chaîne qui marche.
 *
 * Module PUR : aucune dépendance Prisma ni Next. Les lectures vivent dans
 * `health.ts`, la décision vit ici — c'est ce qui la rend éprouvable sans
 * mocker la base, et donc réellement éprouvée.
 */

import { EmailLogStatus } from "../../../prisma/generated/client";

/**
 * Condition « cet échec appartient à la série en cours », isolée pour être
 * éprouvée sur des lignes plutôt que sur sa forme.
 *
 * La série, ce sont les échecs postérieurs au dernier envoi RÉUSSI. Deux
 * branches, parce que `failedAt` n'est pas garanti sur les lignes anciennes :
 * on retombe alors sur `createdAt`, plutôt que de les laisser disparaître de la
 * série — un échec qu'on ne compte pas est un échec qui n'alerte pas.
 *
 * `dernierSucces === null` (aucun envoi réussi de toute l'histoire, ou base
 * fraîche) : aucune borne basse, tous les échecs appartiennent à la série.
 *
 * ⚠️ Elle vit ICI, dans le module pur, et non dans `health.ts` : l'écran
 * `emails-envoyes` a besoin de la même borne, et l'importer depuis la sonde
 * tirait `@/server/notifications` — donc `next-auth`, donc `next/server` — dans
 * un test d'écran qui n'en a que faire. La collecte échouait avant le premier
 * test. Une condition partagée vit dans le module pur, pas dans celui qui parle
 * à Telegram. (Seul import non-pur de ce fichier : l'ÉNUM Prisma, une valeur
 * constante — aucun client n'est instancié.)
 */
export function whereEchecsDeLaSerie(dernierSucces: Date | null): {
  status: typeof EmailLogStatus.failed;
  OR?: Array<{ failedAt: { gt: Date } } | { failedAt: null; createdAt: { gt: Date } }>;
} {
  if (dernierSucces === null) return { status: EmailLogStatus.failed };
  return {
    status: EmailLogStatus.failed,
    OR: [{ failedAt: { gt: dernierSucces } }, { failedAt: null, createdAt: { gt: dernierSucces } }],
  };
}

/**
 * Nombre d'échecs consécutifs à partir duquel on crie.
 *
 * Trois, et pas un : une adresse invalide arrive tous les jours, et une alerte
 * qui tombe pour un incident ordinaire est désarmée en une semaine. Trois, et
 * pas dix-neuf : à quelques e-mails par jour, dix-neuf, c'est deux jours de
 * silence — la durée exacte de l'incident qu'on répare.
 */
export const SEUIL_ECHECS_CONSECUTIFS = 3;

/** Ce que la série a besoin de savoir d'une ligne du journal. */
export interface LigneEchec {
  readonly recipient: string;
  readonly template: string;
  readonly error: string | null;
  /** Date de l'échec définitif ; `createdAt` sert de repli sur les lignes anciennes. */
  readonly failedAt: Date | null;
  readonly createdAt: Date;
}

/** Ce qu'on sait d'une série d'échecs, et qui suffit à décider comme à raconter. */
export interface SerieEchecs {
  /** Échecs consécutifs, tous motifs confondus. */
  readonly total: number;
  /** Ceux qu'on ne peut PAS imputer au destinataire — le nombre qui déclenche. */
  readonly chaine: number;
  /** Ceux qu'on impute au destinataire (adresse morte, boîte pleine). */
  readonly destinataire: number;
  /** Combien de personnes distinctes n'ont rien reçu. C'est ce chiffre qui parle. */
  readonly destinatairesDistincts: number;
  /** Date du PLUS ANCIEN échec de la série — « depuis quand ». */
  readonly depuis: Date | null;
  /** Motif le plus récent non imputable au destinataire, borné pour l'affichage. */
  readonly motif: string | null;
}

/** Une série vide — le rendu d'une chaîne qui n'a rien raté depuis son dernier succès. */
export const SERIE_VIDE: SerieEchecs = {
  total: 0,
  chaine: 0,
  destinataire: 0,
  destinatairesDistincts: 0,
  depuis: null,
  motif: null,
};

/**
 * Marqueurs d'un refus imputable au DESTINATAIRE.
 *
 * Volontairement étroits : tout ce qui n'est pas reconnu ici compte comme une
 * panne de chaîne (cf. l'en-tête). Élargir cette liste, c'est rendre la
 * surveillance plus sourde — à ne faire que sur un motif réellement observé en
 * production, jamais « par précaution ».
 */
const MOTIFS_DESTINATAIRE: readonly RegExp[] = [
  // Codes étendus SMTP : 5.1.x = adresse, 5.2.1/5.2.2 = boîte désactivée/pleine.
  /\b5\.1\.[0-6]\b/,
  /\b5\.2\.[12]\b/,
  // Codes courts, mais seulement accompagnés d'un mot qui désigne LA BOÎTE
  // D'EN FACE. ⚠️ Ni « address » ni « user » ici : voir `MOTIFS_CHAINE`.
  /\b55[0123]\b[\s\S]{0,80}?(recipient|mailbox|destinataire)/i,
  /no such (user|recipient|mailbox)/i,
  /user unknown|unknown user/i,
  /mailbox (unavailable|full|not found|does not exist)/i,
  /recipient (address )?(rejected|not found|unknown)/i,
  /invalid recipients?\b/i,
];

/**
 * 🔴 CE QUI EST À NOUS, ET QUI PASSAIT POUR UN PROBLÈME DE DESTINATAIRE.
 *
 * Défaut trouvé en relecture le 2026-09-17, en EXÉCUTANT les expressions
 * ci-dessus sur des motifs réels :
 *
 *   `553 5.7.1 Sender address rejected: not owned by user`  → « destinataire »
 *   `550 Message rejected due to spam content, address blocked` → « destinataire »
 *
 * Le mot « address » suffisait, et il figure dans les deux. Or ces deux motifs
 * disent l'inverse de ce qu'ils étaient classés : c'est NOTRE adresse
 * d'expédition qui est refusée, ou NOTRE réputation. Le jour où le compte
 * d'envoi est suspendu ou le `MAIL FROM` déréglé, **100 % des envois** rendent
 * `553 Sender address rejected` — donc `chaine = 0`, donc **aucune alerte**.
 * Panne totale, silence total : très exactement le défaut que ce module répare,
 * rétabli par sa propre liste.
 *
 * 🔑 Ces marqueurs sont donc évalués **EN PREMIER** et l'emportent. Un motif qui
 * parle de l'expéditeur, de politique, de réputation ou de blocage est une
 * panne de CHAÎNE, quel que soit le reste de la phrase.
 */
const MOTIFS_CHAINE: readonly RegExp[] = [
  /sender|exp[ée]diteur|mail ?from|return[- ]path/i,
  /not owned by/i,
  /spam|blacklist|block(ed|list)|reputation|r[ée]putation/i,
  /\bpolicy\b|politique/i,
  // 5.7.x = refus d'AUTORISATION / de politique, jamais une adresse inconnue.
  /\b5\.7\.\d+\b/,
  /authentication|authentification|invalid login|quota|rate limit/i,
];

/**
 * Vrai si le motif désigne la boîte d'en face plutôt que notre chaîne.
 *
 * ⚠️ `null`, chaîne vide ou motif inconnu → **faux**, donc compté comme panne
 * de chaîne. Le doute profite à l'alerte : c'est la seule orientation qui ne
 * recrée pas le silence de 43 heures.
 *
 * ⚠️ Et un motif qui parle de NOUS (expéditeur, politique, réputation,
 * authentification) l'emporte sur tout marqueur de destinataire — voir
 * `MOTIFS_CHAINE`.
 */
export function estEchecDestinataire(error: string | null | undefined): boolean {
  const motif = error?.trim();
  if (!motif) return false;
  if (MOTIFS_CHAINE.some((r) => r.test(motif))) return false;
  return MOTIFS_DESTINATAIRE.some((r) => r.test(motif));
}

/**
 * Agrège un ENSEMBLE d'échecs : combien, de quelle nature, vers combien de
 * personnes, depuis quand.
 *
 * 🔑 Cette fonction ne prétend RIEN sur la consécutivité — elle compte ce qu'on
 * lui donne. C'est `analyserSerie` qui porte la précondition, et l'écran
 * `emails-envoyes` appelle celle-ci parce qu'il décrit un STOCK à rattraper,
 * pas une série en cours.
 *
 * 🔴 Distinction ajoutée en relecture (2026-09-17) : la première version
 * n'exposait que `analyserSerie`, et l'écran l'appelait sur une fenêtre de
 * trente jours. Il violait donc la précondition écrite deux lignes plus haut, et
 * affichait un bandeau rouge « série en cours » sur des échecs vieux de
 * plusieurs semaines — que rien ne pouvait faire redescendre. Un bandeau rouge
 * permanent apprend à ne plus lire les bandeaux rouges.
 */
export function resumerEchecs(echecs: readonly LigneEchec[]): SerieEchecs {
  if (echecs.length === 0) return SERIE_VIDE;

  const dateDe = (l: LigneEchec): Date => l.failedAt ?? l.createdAt;
  const parDate = [...echecs].sort((a, b) => dateDe(a).getTime() - dateDe(b).getTime());

  let chaine = 0;
  let destinataire = 0;
  let motif: string | null = null;
  const personnes = new Set<string>();

  for (const l of parDate) {
    personnes.add(l.recipient.trim().toLowerCase());
    if (estEchecDestinataire(l.error)) {
      destinataire += 1;
    } else {
      chaine += 1;
      // Le plus RÉCENT gagne : la liste est triée par date croissante, donc la
      // dernière itération qualifiante écrase les précédentes. Un motif qui a
      // changé en cours de panne (auth → quota) doit se lire au présent.
      if (l.error?.trim()) motif = l.error.trim().slice(0, 160);
    }
  }

  return {
    total: parDate.length,
    chaine,
    destinataire,
    destinatairesDistincts: personnes.size,
    depuis: dateDe(parDate[0] as LigneEchec),
    motif,
  };
}

/**
 * Analyse une SÉRIE d'échecs consécutifs.
 *
 * ⚠️ L'appelant garantit la CONSÉCUTIVITÉ : ces lignes sont celles postérieures
 * au dernier envoi réussi. Cette fonction ne la vérifie pas — elle ne voit pas
 * les succès. C'est `health.ts` qui borne la lecture (`whereEchecsDeLaSerie`),
 * et `health.spec.ts` qui verrouille la borne.
 *
 * Ce n'est qu'un NOM posé sur `resumerEchecs` : le calcul est le même, la
 * PROMESSE ne l'est pas. Appeler celle-ci sur un stock quelconque est une faute
 * — et c'en fut une.
 */
export function analyserSerie(echecs: readonly LigneEchec[]): SerieEchecs {
  return resumerEchecs(echecs);
}

/**
 * Faut-il crier ?
 *
 * On lit `chaine` et non `total` : trois adresses mortes d'affilée sur une
 * campagne de recrutement ne sont pas une panne, et l'alerte qui les confondrait
 * serait désarmée avant d'avoir servi. Les rebonds ont déjà leurs propres codes
 * (`emails_rebonds`, `email_rebond_dur`).
 */
export function doitAlerterSerie(serie: SerieEchecs): boolean {
  return serie.chaine >= SEUIL_ECHECS_CONSECUTIFS;
}

/**
 * Durée écoulée, en français lisible.
 *
 * L'écran doit dire « depuis 43 h », pas afficher un horodatage ISO que
 * personne ne soustrait de tête à 8 h du matin.
 */
export function depuisCombienDeTemps(depuis: Date, maintenant: Date): string {
  const minutes = Math.max(0, Math.floor((maintenant.getTime() - depuis.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `${heures} h`;
  const jours = Math.floor(heures / 24);
  const reste = heures % 24;
  return reste > 0 ? `${jours} j ${reste} h` : `${jours} j`;
}

/**
 * Une phrase qui dit ce qui s'est passé, pour qui, et depuis quand.
 *
 * Elle sert AUSSI BIEN au message d'alerte qu'à l'écran de renvoi : la demande
 * était « pas un tableau d'identifiants ». Une seule formulation, donc, et un
 * seul endroit où la corriger.
 */
export function resumeSerie(serie: SerieEchecs, maintenant: Date): string {
  if (serie.total === 0) return "Aucun envoi en échec : le dernier e-mail est bien parti.";

  const personnes =
    serie.destinatairesDistincts === 1
      ? "1 destinataire"
      : `${serie.destinatairesDistincts} destinataires distincts`;
  const depuis = serie.depuis
    ? ` — le plus ancien date d'il y a ${depuisCombienDeTemps(serie.depuis, maintenant)}`
    : "";
  const part =
    serie.destinataire > 0
      ? ` (dont ${serie.destinataire} imputable(s) à l'adresse du destinataire)`
      : "";

  return (
    `${serie.total} envoi(s) ont échoué d'affilée, sans un seul succès entre eux, vers ` +
    `${personnes}${part}${depuis}.`
  );
}
