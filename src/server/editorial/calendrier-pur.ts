/**
 * Console éditoriale — la logique de calendrier qui ne touche PAS la base.
 *
 * Séparé de `queries.ts` pour une raison concrète : `queries.ts` porte
 * `import "server-only"`, ce qui le rend **inimportable** depuis un test
 * Vitest. Toute la logique qui décide de ce que l'écran affiche — bornage des
 * paramètres d'URL, mois voisin, regroupement par jour — vivait donc dans un
 * fichier que personne ne pouvait tester unitairement.
 *
 * Ici, aucun import serveur : ces fonctions se testent en une milliseconde,
 * et ce sont elles qui cassent, pas les `findMany`.
 */

/** Filtre du §7 : « le filtre identité = pro n'affiche que la page ». */
export type FiltreIdentite = "toutes" | "perso" | "pro";

/**
 * Lit le filtre d'identité d'une URL.
 *
 * Tout ce qui n'est pas exactement `perso` ou `pro` retombe sur `toutes` :
 * une valeur inventée ne doit pas vider l'écran sans explication.
 */
export function estFiltreIdentite(v: string | undefined): FiltreIdentite {
  return v === "perso" || v === "pro" ? v : "toutes";
}

/** Bornes du mois, en UTC — cohérentes avec une colonne `@db.Date`. */
export function bornesDuMois(annee: number, mois: number): { debut: Date; fin: Date } {
  return {
    debut: new Date(Date.UTC(annee, mois - 1, 1)),
    fin: new Date(Date.UTC(annee, mois, 1)),
  };
}

/** Mois précédent / suivant, sans dépendance ni piège de fin d'année. */
export function moisVoisin(
  annee: number,
  mois: number,
  pas: -1 | 1,
): { annee: number; mois: number } {
  const m = mois + pas;
  if (m < 1) return { annee: annee - 1, mois: 12 };
  if (m > 12) return { annee: annee + 1, mois: 1 };
  return { annee, mois: m };
}

/**
 * Borne un mois lu dans l'URL.
 *
 * 🔴 Sans ce bornage, `MOIS[mois - 1]` rend `undefined` sur `?month=99`, le
 * titre de la page devient « Calendrier — undefined 2026 », et une grille
 * construite sur un mois 99 part en vrille. Une URL n'est jamais de confiance.
 */
export function lireMois(v: string | undefined, defaut: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : defaut;
}

/** Borne une année lue dans l'URL, sur une fenêtre raisonnable. */
/**
 * Bornes du calendrier navigable.
 *
 * ⚠️ Elles servent DEUX fois : ici pour borner la navigation, et dans
 * `verifierDateIso` pour refuser une saisie hors fenetre. Les deux doivent
 * rester la meme valeur — une date acceptee que le calendrier ne sait pas
 * afficher produit une publication reelle et invisible.
 */
export const ANNEE_MIN = 2020;
export const ANNEE_MAX = 2100;

export function lireAnnee(v: string | undefined, defaut: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= ANNEE_MIN && n <= ANNEE_MAX ? n : defaut;
}

/** Vrai si la chaîne est une clé de jour « AAAA-MM-JJ » plausible. */
export function estCleJour(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Ce dont la grille a besoin pour poser ses pastilles. */
export interface AvecCleJour {
  dayKey: string;
}

/** Compte par jour, pour les pastilles de la grille. */
export function compterParJour(publications: readonly AvecCleJour[]): Map<string, number> {
  const parJour = new Map<string, number>();
  for (const p of publications) {
    parJour.set(p.dayKey, (parJour.get(p.dayKey) ?? 0) + 1);
  }
  return parJour;
}

// ── Dates et heures saisies : la forme ne suffit pas ───────────────────────

/**
 * 🔴 Défaut trouvé par la passe 4 du protocole (adversaire).
 *
 * Les Server Actions ne validaient que la FORME (`^\d{4}-\d{2}-\d{2}$`), puis
 * confiaient la valeur à `Date.UTC`, qui reporte silencieusement :
 *
 * | Envoyé       | Stocké          |
 * | ------------ | --------------- |
 * | `2026-02-30` | 2026-03-02      |
 * | `2026-13-45` | 2027-02-14      |
 * | `0000-00-00` | 1899-11-30      |
 * | `9999-99-99` | **+010007-06-07** |
 *
 * Aucun refus, aucun message. Deux aggravations : `deplacerPublicationAction`
 * est branchée sur le glisser-déposer du calendrier, et `lireAnnee` borne la
 * navigation à 2020-2100 — une publication datée 1999 ou 10007 devenait donc
 * **inatteignable dans le calendrier**, sans que rien ne le dise.
 *
 * La garde équivalente existait déjà côté import (`convertirDate` refuse
 * « 30/02/2026 » par « Date inexistante au calendrier ») ; elle n'était
 * simplement branchée sur aucune action. Le §1 du protocole : une garde ne
 * vaut que si elle est posée là où l'objet casse.
 */
export function verifierDateIso(
  iso: string,
): { ok: true; date: Date } | { ok: false; erreur: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { ok: false, erreur: `Date « ${iso} » : format attendu AAAA-MM-JJ.` };

  const annee = Number(m[1]);
  const mois = Number(m[2]);
  const jour = Number(m[3]);

  if (mois < 1 || mois > 12) {
    return { ok: false, erreur: `Date « ${iso} » : le mois ${mois} n'existe pas.` };
  }
  if (jour < 1 || jour > 31) {
    return { ok: false, erreur: `Date « ${iso} » : le jour ${jour} n'existe pas.` };
  }

  const date = new Date(Date.UTC(annee, mois - 1, jour));

  // Le report est le seul moyen fiable de rejeter le 30 février : c'est
  // `Date` elle-même qui connaît les années bissextiles.
  if (
    date.getUTCFullYear() !== annee ||
    date.getUTCMonth() !== mois - 1 ||
    date.getUTCDate() !== jour
  ) {
    return { ok: false, erreur: `Date « ${iso} » : ce jour n'existe pas au calendrier.` };
  }

  // ⚠️ Bornes ALIGNÉES sur celles de `lireAnnee`. Sans elles, on accepterait
  // une date que le calendrier ne sait pas afficher — la publication existe,
  // mais aucun écran ne la montre. Une donnée invisible est pire qu'un refus.
  if (annee < ANNEE_MIN || annee > ANNEE_MAX) {
    return {
      ok: false,
      erreur:
        `Date « ${iso} » : l'année ${annee} sort du calendrier, qui va de ` +
        `${ANNEE_MIN} à ${ANNEE_MAX}. La publication serait enregistrée mais ` +
        `introuvable à l'écran.`,
    };
  }

  return { ok: true, date };
}

/** `AAAA-MM-JJ` valide ? Le prédicat, pour brancher sur un `.refine()` Zod. */
export function dateIsoValide(iso: string): boolean {
  return verifierDateIso(iso).ok;
}

/**
 * 🔴 Même défaut, même cause : `^\d{2}:\d{2}$` acceptait `99:99`.
 *
 * L'import refusait déjà « heures hors bornes » / « minutes hors bornes ».
 */
export function heureValide(heure: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(heure);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/**
 * `AAAA-MM-JJ` → `Date` à minuit UTC, en REFUSANT l'impossible.
 *
 * Jamais `new Date(a, m, j)` — le fuseau local décalerait le jour.
 */
export function dateUtcStricte(iso: string): Date {
  const r = verifierDateIso(iso);
  if (!r.ok) throw new Error(r.erreur);
  return r.date;
}

// ── L'état d'avancement, pour la couleur du calendrier ─────────────────────

/**
 * L'état d'une publication, réduit à UNE valeur lisible.
 *
 * 🔴 Pourquoi une valeur unique alors que le modèle en porte trois.
 *
 * Une publication a trois statuts indépendants — rédaction, asset, diffusion —
 * et c'est juste : ils avancent séparément. Mais une case de calendrier fait
 * 64 pixels de haut : elle ne peut pas en afficher trois, et surtout on ne
 * regarde pas un mois pour lire des statuts. On le regarde pour répondre à
 * « qu'est-ce qu'il me reste à faire ? ».
 *
 * L'ordre ci-dessous est celui du RESTE À FAIRE, du plus urgent au terminé.
 * C'est lui qui décide de la couleur : l'état le moins avancé d'un jour
 * l'emporte, parce qu'un jour où tout est prêt sauf un visuel n'est pas un
 * jour prêt.
 */
export const ETATS_AVANCEMENT = [
  "a_produire",
  "en_cours",
  "pret",
  "programme",
  "publie",
  "annule",
] as const;
export type EtatAvancement = (typeof ETATS_AVANCEMENT)[number];

export interface AvecStatuts {
  dayKey: string;
  statutAsset: string;
  statutDiffusion: string;
}

/**
 * L'état d'UNE publication.
 *
 * La diffusion prime quand elle est engagée : un post publié est terminé,
 * quel que soit l'état de son visuel — c'est déjà en ligne, il est trop tard
 * pour le produire.
 *
 * ⚠️ `non_requis` compte comme PRÊT et non comme « à produire ». Un post de
 * texte seul n'attend aucun visuel : le peindre en rouge le ferait remonter
 * dans la liste du travail restant, où il n'a rien à faire.
 */
export function etatPublication(p: {
  statutAsset: string;
  statutDiffusion: string;
}): EtatAvancement {
  if (p.statutDiffusion === "annule") return "annule";
  if (p.statutDiffusion === "publie") return "publie";
  if (p.statutDiffusion === "programme") return "programme";
  if (p.statutAsset === "pret" || p.statutAsset === "non_requis") return "pret";
  if (p.statutAsset === "en_cours" || p.statutAsset === "a_valider") return "en_cours";
  return "a_produire";
}

/**
 * L'état d'un JOUR : le moins avancé de ses publications.
 *
 * 🔴 Le moins avancé, jamais la moyenne ni le plus avancé. Un jour qui porte
 * un post publié et un post dont le visuel manque n'est pas « à moitié fait » :
 * il reste du travail dessus, et c'est ce qu'on veut voir.
 *
 * `annule` est ÉCARTÉ du calcul : un post annulé n'est pas du travail restant,
 * et le laisser peser ferait passer un jour terminé pour un jour en retard.
 * Un jour qui n'a QUE des annulés rend bien `annule`.
 */
export function etatDuJour(
  publications: readonly { statutAsset: string; statutDiffusion: string }[],
): EtatAvancement | null {
  if (publications.length === 0) return null;
  const etats = publications.map(etatPublication);
  const vivants = etats.filter((e) => e !== "annule");
  if (vivants.length === 0) return "annule";
  let pire: EtatAvancement = "publie";
  for (const e of vivants) {
    if (ETATS_AVANCEMENT.indexOf(e) < ETATS_AVANCEMENT.indexOf(pire)) pire = e;
  }
  return pire;
}

/** L'état de chaque jour, prêt pour la grille. */
export function etatParJour(publications: readonly AvecStatuts[]): Map<string, EtatAvancement> {
  const groupes = new Map<string, AvecStatuts[]>();
  for (const p of publications) {
    const liste = groupes.get(p.dayKey);
    if (liste) liste.push(p);
    else groupes.set(p.dayKey, [p]);
  }
  const resultat = new Map<string, EtatAvancement>();
  for (const [cle, liste] of groupes) {
    const etat = etatDuJour(liste);
    if (etat) resultat.set(cle, etat);
  }
  return resultat;
}
