/**
 * ÉCRIRE À PLUSIEURS POSTULANTS D'UN SEUL GESTE — la part PURE.
 *
 * ── Pourquoi ce fichier existe, hors du module `"use server"` ─────────────
 * Un module `"use server"` ne peut exporter QUE des fonctions asynchrones :
 * chaque export y devient un point d'entrée réseau, et la garde
 * `un-fichier-use-server-n-exporte-que-des-fonctions` le refuse. Le type de
 * retour et la préparation des envois vivent donc ici — d'où le formulaire les
 * lit aussi. Ce dépôt a déjà payé l'inverse : une constante exportée d'un
 * `"use server"` plantait l'écran AU RENDU, typecheck vert et huit tests
 * unitaires verts.
 *
 * Ce module est PUR : ni Prisma, ni session, ni `server-only`. C'est ce qui
 * permet à ses règles d'être éprouvées sans base — et au composant client de
 * l'importer sans tirer le serveur dans le paquet du navigateur.
 *
 * ── ⛔ CE GESTE N'EXISTE QUE DU CÔTÉ EMPLOI ───────────────────────────────
 * Il porte sur `JobApplication`, jamais sur `Submission`. Écrire d'un seul
 * geste à N apporteurs d'affaires — même une information neutre — fabrique la
 * pièce qu'un contrôle cherche : une communication descendante, uniforme et
 * périodique, adressée à un réseau d'indépendants. C'est la matière même du
 * faisceau de requalification (`docs/partners/ANTI-REQUALIFICATION.md`), et la
 * fiche personne s'interdit déjà, pour la même raison, tout statut, toute file
 * et toute alerte communs aux deux mondes.
 *
 * Un postulant à une offre d'emploi, lui, est dans une relation de candidature
 * assumée : lui répondre en même temps qu'à quinze autres candidats de la même
 * offre est le geste normal d'un recrutement, et le seul reproche qu'on
 * pourrait lui faire serait de ne pas répondre du tout.
 *
 * 🔑 Le plafond n'est PAS redéfini ici. C'est `PLAFOND_EN_MASSE`, celui du
 * geste de statut groupé — un seul nombre à retenir. Sa raison d'être — « au
 * delà, on ne sait plus ce qu'on vient de faire, et le journal de cinquante
 * dossiers ne se relit pas » — vaut ici à plus forte raison : un statut se
 * corrige, un e-mail parti ne revient pas.
 */

/** Ce qu'on sait d'un destinataire au moment de préparer son message. */
export interface DestinatairePrepare {
  readonly id: string;
  /** Prénom en clair. `null` si absent ou indéchiffrable — voir `preparerEnvois`. */
  readonly prenom: string | null;
  /** Intitulé de l'offre visée, figé au dépôt. */
  readonly poste: string | null;
}

/** Un message prêt à partir, personnalisé pour UN destinataire. */
export interface EnvoiPrepare {
  readonly id: string;
  readonly objet: string;
  readonly corps: string;
}

/**
 * Un destinataire ÉCARTÉ avant tout envoi, et la raison exacte.
 *
 * 🔴 Le motif est une VALEUR, pas une phrase. L'écran la traduit ; le test
 * l'assertionne. Une phrase française posée dans le domaine se serait
 * retrouvée comparée caractère par caractère dans les tests, et aurait figé sa
 * propre traduction.
 */
export type MotifEcart =
  /** Le modèle emploie `{prenom}` ou `{poste}`, et le dossier ne les porte pas. */
  | "variable_non_resolue"
  /** Adresse absente ou indéchiffrable — le message n'aurait mené nulle part. */
  | "destinataire_injoignable"
  /** Rendu du gabarit ou écriture en base en échec. Rien n'a été écrit. */
  | "ecriture_impossible"
  /** Sélectionné, puis disparu entre le clic et l'envoi. */
  | "dossier_introuvable";

export interface EcartPrepare {
  readonly id: string;
  readonly motif: MotifEcart;
  /** Les variables restées sans valeur, pour que l'écran puisse les nommer. */
  readonly variables: readonly string[];
}

export interface PreparationEnMasse {
  readonly envois: readonly EnvoiPrepare[];
  readonly ecartes: readonly EcartPrepare[];
}

export type EtatReponseEnMasse =
  | {
      ok: true;
      /** Messages écrits en base ET remis à la file d'envoi. */
      envoyees: number;
      /**
       * Destinataires écartés AVANT tout envoi — variable non résolue, adresse
       * illisible, dossier disparu. Rien n'a été écrit pour eux.
       *
       * 🔑 Comptés à part et jamais fondus dans `envoyees` : un total gonflé
       * ferait croire à des messages partis qui ne le sont pas, et c'est
       * exactement ce qu'on vérifie quand un candidat dit « je n'ai rien reçu ».
       */
      ecartees: number;
      /**
       * Messages écrits en base mais que la file d'envoi a refusés. Ils sont
       * rejouables un par un depuis la fiche, comme un envoi unitaire échoué —
       * la trace existe, elle porte `failed`, elle ne prétend pas être partie.
       */
      echouees: number;
      /** Les écarts, nommés, pour que l'écran les dise sans mentir. */
      details: readonly EcartPrepare[];
    }
  | { ok: false; error: string };

/** Les variables qu'un modèle sait résoudre. Toute autre reste à l'écran. */
export const VARIABLES_CONNUES = ["prenom", "poste"] as const;

/** Même motif que `remplirModele` — il n'est pas recopié à la légère : les
 *  deux doivent voir EXACTEMENT les mêmes variables, sans quoi on écarterait
 *  sur une variable que la substitution aurait su résoudre, ou l'inverse. */
const VARIABLE = /\{(\w+)\}/g;

/** Les variables CONNUES qu'un texte emploie, sans doublon, dans l'ordre vu. */
export function variablesEmployees(texte: string): string[] {
  const vues = new Set<string>();
  for (const trouve of texte.matchAll(VARIABLE)) {
    const nom = trouve[1];
    if (nom && (VARIABLES_CONNUES as readonly string[]).includes(nom)) vues.add(nom);
  }
  return [...vues];
}

/**
 * Personnalise l'objet et le corps POUR CHAQUE destinataire, et écarte ceux
 * dont une variable ne peut pas être résolue.
 *
 * ── 🔴 LE DÉFAUT QUE CETTE FONCTION EXISTE POUR EMPÊCHER ──────────────────
 * Le composeur unitaire substitue `{prenom}` et `{poste}` AU MOMENT OÙ le
 * recruteur choisit un modèle, avec les valeurs du dossier ouvert. Deux fautes
 * guettent l'envoi groupé, et elles sont de la même famille :
 *
 *   · reprendre ce texte DÉJÀ substitué → le prénom du premier candidat part
 *     à tous les autres ;
 *   · prendre le modèle brut sans substituer → « Bonjour {prenom}, » part à
 *     cinquante personnes.
 *
 * Elles n'ont pas la même visibilité. La seconde se voit à l'œil nu dans le
 * premier message reçu. La PREMIÈRE ne se voit que du côté des destinataires,
 * et le recruteur peut ne jamais l'apprendre. C'est celle-là qui coûte cher.
 *
 * La substitution a donc lieu ICI, une fois par destinataire, à partir de SON
 * dossier — jamais dans le navigateur, jamais une seule fois pour tous.
 *
 * ── Pourquoi ÉCARTER plutôt que laisser passer ────────────────────────────
 * `remplirModele` laisse une variable non résolue TELLE QUELLE, accolades
 * comprises, et c'est la bonne décision pour un envoi unitaire : un `{prenom}`
 * resté à l'écran se voit et se corrige avant de cliquer. En envoi groupé,
 * personne ne relit les cinquante rendus — le trou partirait.
 *
 * On écarte donc ce destinataire-là, et on le NOMME. Écarter n'annule pas le
 * geste : les quarante-neuf autres partent, et le recruteur sait exactement
 * lequel reste à traiter à la main.
 *
 * `substituer` est passée en paramètre plutôt qu'importée : ce module reste
 * ainsi sans dépendance, et le test prouve qu'on appelle bien la MÊME fonction
 * que le composeur unitaire, au lieu d'en écrire une seconde qui dériverait.
 */
export function preparerEnvois(
  destinataires: readonly DestinatairePrepare[],
  modele: { readonly objet: string; readonly corps: string },
  substituer: (texte: string, valeurs: Record<string, string | null>) => string,
): PreparationEnMasse {
  const attendues = [
    ...new Set([...variablesEmployees(modele.objet), ...variablesEmployees(modele.corps)]),
  ];

  const envois: EnvoiPrepare[] = [];
  const ecartes: EcartPrepare[] = [];

  for (const d of destinataires) {
    const valeurs: Record<string, string | null> = { prenom: d.prenom, poste: d.poste };
    // Une valeur vide ou faite d'espaces ne résout rien : `remplirModele`
    // laisserait l'accolade. On applique ICI sa règle exacte, plutôt que de
    // relire le rendu à la recherche d'accolades — un texte peut légitimement
    // en contenir, et on écarterait alors un message parfaitement valable.
    const manquantes = attendues.filter((v) => {
      const valeur = valeurs[v];
      return valeur == null || valeur.trim().length === 0;
    });

    if (manquantes.length > 0) {
      ecartes.push({ id: d.id, motif: "variable_non_resolue", variables: manquantes });
      continue;
    }

    envois.push({
      id: d.id,
      objet: substituer(modele.objet, valeurs),
      corps: substituer(modele.corps, valeurs),
    });
  }

  return { envois, ecartes };
}
