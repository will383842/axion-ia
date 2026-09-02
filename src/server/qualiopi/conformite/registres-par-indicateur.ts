/**
 * Qualiopi — OÙ, dans la console, se vérifie chaque indicateur.
 *
 * ## Le défaut que ce module ferme (2026-09-02, audit certificateur)
 *
 * L'écran « Conformité & mode auditeur » est celui que l'auditrice lit le jour
 * de sa venue. Il affiche, indicateur par indicateur, un statut et des éléments
 * constatés — et, pour les indicateurs adossés à des PIÈCES, la liste des pièces
 * ouvrables une par une.
 *
 * Mais **dix des vingt-trois indicateurs applicables n'ont aucune pièce** : la
 * veille, le réseau handicap, la sous-traitance, les réclamations, la revue de
 * direction, les moyens pédagogiques, les appréciations, les compétences des
 * intervenants. Leur preuve n'est pas un PDF : c'est un REGISTRE, tenu dans un
 * écran de la console. Sur ces dix-là, l'écran affichait un verdict et
 * proposait, littéralement, rien à cliquer.
 *
 * L'auditrice devait donc croire le verdict sur parole, ou refermer l'écran et
 * chercher le registre dans une navigation de cent cinquante entrées. C'est
 * exactement ce que la doctrine du dépôt reproche déjà ailleurs : « une preuve
 * qu'on ne peut pas retrouver n'est pas une preuve », et « une page qu'on ne
 * trouve pas ne sert à personne le jour du contrôle ».
 *
 * ## Ce que ce module N'EST PAS
 *
 * 🔴 Il ne dit RIEN de la couverture d'un indicateur, et ne doit jamais servir à
 * la calculer. Un lien vers un registre vide reste un lien juste : il mène là où
 * la preuve DEVRAIT être, ce qui est précisément l'information utile quand elle
 * n'y est pas. Le verdict vient de `conformite-service.ts`, et de lui seul.
 *
 * ## Exhaustivité
 *
 * Chaque numéro des 32 indicateurs porte une entrée, **y compris vide** :
 * `registres-par-indicateur.spec.ts` le vérifie en dérivant la liste de
 * `INDICATEURS_RNQ`, jamais en la recopiant. Un indicateur ajouté au registre
 * force donc une décision explicite — « voici où on le vérifie » ou « nulle
 * part, et voici pourquoi » — au lieu de disparaître en silence.
 */

/** Un renvoi vers l'écran de console qui porte la preuve d'un indicateur. */
export interface RegistreIndicateur {
  /** Chemin RELATIF à `/{locale}/{adminPrefix}` — jamais une URL absolue. */
  readonly chemin: string;
  /** Ce que l'auditrice y trouve, dit de son point de vue à elle. */
  readonly libelle: string;
}

/**
 * Les registres de la console, par indicateur RNQ.
 *
 * Les libellés nomment ce que l'auditrice vient VÉRIFIER, pas le nom de l'écran
 * dans notre navigation : elle ne cherche pas « Moyens pédagogiques », elle
 * cherche « l'inventaire des moyens et leur date de vérification ».
 */
export const REGISTRES_PAR_INDICATEUR: Record<number, readonly RegistreIndicateur[]> = {
  // C1 — Information du public
  1: [
    { chemin: "/qualiopi/formations", libelle: "Catalogue des prestations publiées" },
    { chemin: "/qualiopi/config", libelle: "Identité de l'organisme et numéro de déclaration" },
  ],
  2: [{ chemin: "/qualiopi/indicateurs", libelle: "Indicateurs de résultats et BPF" }],
  // Taux d'obtention des certifications : statistique publiée, aucun registre
  // interne ne la porte (cf. INDICATEUR_DOCUMENT_TYPES, même constat).
  3: [],

  // C2 — Objectifs et adaptation
  4: [
    { chemin: "/qualiopi/dossiers", libelle: "Dossiers : analyse du besoin à l'entrée" },
    { chemin: "/qualiopi/entrees", libelle: "Demandes entrantes et qualification" },
  ],
  5: [
    { chemin: "/qualiopi/formations", libelle: "Objectifs pédagogiques, formation par formation" },
  ],
  6: [{ chemin: "/qualiopi/formations", libelle: "Contenus, modalités et programmes" }],
  7: [],
  8: [
    { chemin: "/qualiopi/dossiers", libelle: "Positionnement et évaluation des acquis à l'entrée" },
  ],

  // C3 — Accueil, suivi, évaluation
  9: [{ chemin: "/qualiopi/sessions", libelle: "Sessions : convocations et pièces d'accueil" }],
  10: [
    { chemin: "/qualiopi/stagiaires", libelle: "Bénéficiaires : besoins déclarés et adaptations" },
    { chemin: "/qualiopi/partenariats", libelle: "Réseau mobilisé pour l'adaptation" },
  ],
  11: [
    { chemin: "/qualiopi/sessions", libelle: "Sessions : évaluations des acquis et attestations" },
    { chemin: "/qualiopi/appreciations", libelle: "Appréciations recueillies" },
  ],
  12: [
    {
      chemin: "/qualiopi/mode-auditeur/emargement",
      libelle: "Registre des signatures d'émargement — la preuve de présence, chaîne par chaîne",
    },
    { chemin: "/qualiopi/sessions", libelle: "Sessions : feuilles d'émargement" },
  ],
  // Indicateurs APPRENTISSAGE/CFA — hors périmètre, aucun registre.
  13: [],
  14: [],
  15: [],
  16: [],

  // C4 — Moyens
  17: [
    { chemin: "/qualiopi/moyens", libelle: "Inventaire des moyens et dates de vérification" },
    { chemin: "/qualiopi/formateurs", libelle: "Intervenants actifs" },
  ],
  18: [
    { chemin: "/qualiopi/moyens", libelle: "Moyens par catégorie et leur vérification" },
    { chemin: "/qualiopi/config", libelle: "Modalités écrites de coordination des intervenants" },
  ],
  19: [{ chemin: "/qualiopi/formations", libelle: "Supports et ressources mis à disposition" }],
  20: [],

  // C5 — Qualification du personnel
  21: [
    {
      chemin: "/qualiopi/formateurs",
      libelle: "Registre des intervenants : fiches et pièces de compétence validées",
    },
  ],
  22: [
    {
      chemin: "/qualiopi/formateurs",
      libelle: "Actions de développement des compétences, datées",
    },
  ],

  // C6 — Environnement professionnel
  23: [{ chemin: "/qualiopi/veille", libelle: "Journal de veille légale et réglementaire" }],
  24: [{ chemin: "/qualiopi/veille", libelle: "Journal de veille emplois et métiers" }],
  25: [{ chemin: "/qualiopi/veille", libelle: "Journal de veille pédagogique et technologique" }],
  26: [
    { chemin: "/qualiopi/partenariats", libelle: "Réseau handicap et interlocuteurs identifiés" },
    { chemin: "/qualiopi/config", libelle: "Désignation du référent handicap" },
  ],
  27: [
    {
      chemin: "/qualiopi/sous-traitants",
      libelle: "Registre des sous-traitants : NDA, vérification, contrat",
    },
    { chemin: "/qualiopi/formateurs", libelle: "Intervenants indépendants et leur vigilance" },
  ],
  28: [],
  29: [],

  // C7 — Appréciations et amélioration continue
  30: [{ chemin: "/qualiopi/appreciations", libelle: "Appréciations, par partie prenante" }],
  31: [
    { chemin: "/qualiopi/reclamations", libelle: "Registre des réclamations et leur traitement" },
    { chemin: "/qualiopi/incidents", libelle: "Registre des incidents et aléas" },
  ],
  32: [
    {
      chemin: "/qualiopi/revue-direction",
      libelle: "Revues de direction et plan d'amélioration continue",
    },
  ],
};

/** Les registres d'un indicateur — jamais `undefined`, pour l'appelant JSX. */
export function registresDeIndicateur(numero: number): readonly RegistreIndicateur[] {
  return REGISTRES_PAR_INDICATEUR[numero] ?? [];
}
