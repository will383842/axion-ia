/**
 * SSOT des habilitations — qui peut poser un acte qui ENGAGE L'ORGANISME.
 *
 * ## La frontière que ce module grave
 *
 * Elle ne sépare pas « manuel » de « automatique », ni « important » de
 * « courant ». Elle sépare ce qui n'engage rien de ce qui engage :
 *
 *   - **N'engage rien** — produire un brouillon, créer une session, inscrire un
 *     stagiaire, envoyer une convocation, relancer, classer, consulter. Cela se
 *     délègue et s'automatise : c'est ce qui évite les oublis.
 *   - **Engage l'organisme** — signer, contresigner, émettre une attestation ou
 *     un certificat, valider une évaluation finale, conclure un devis, émettre
 *     une facture, habiliter un formateur, déposer une demande de prise en
 *     charge au nom d'un client. Cela reste un acte humain HABILITÉ.
 *
 * Automatiser ou déléguer la première colonne évite les oublis. Déléguer la
 * seconde ferait conclure des contrats à personne.
 *
 * ## Pourquoi un SSOT, et pas une garde par action
 *
 * 🔴 Constat du 2026-08-15, vérifié dans le code. La frontière n'existait qu'à
 * UN endroit du serveur : `ROLES_ADMIN_HABILITES` dans
 * `documents/signature/document-signature-service.ts`, une constante NON
 * exportée avec UN SEUL site d'appel. Partout ailleurs, les Server Actions
 * Qualiopi appelaient `requireAdminWrite` — qui autorise `editor` — soit
 * 311 occurrences. Concrètement, un compte `editor` pouvait :
 *
 *   - émettre une attestation      (`actions/qualiopi/evaluations.ts`)
 *   - conclure un devis            (`actions/qualiopi/devis.ts`)
 *   - émettre une facture          (`actions/qualiopi/facturation-hub.ts`)
 *   - habiliter un formateur       (`actions/qualiopi/trainers.ts`)
 *
 * La matrice était donc appliquée sur UNE ligne sur cinq. Une garde recopiée
 * dans chaque action aurait reproduit exactement ce défaut : cinq copies
 * divergent un jour, et c'est toujours celle qu'on a oublié de durcir qui sert.
 *
 * ## Module PUR
 *
 * Aucun import Prisma, aucun import Next : la matrice est testable seule, et
 * lisible d'un seul regard. La lecture de session vit chez l'appelant
 * (`requireHabilitation`, dans `actions/qualiopi/_guards.ts`).
 */

/**
 * Un acte qui engage l'organisme.
 *
 * ⚠️ Grain volontairement METIER et non technique. « facturer » couvre
 * l'émission d'une facture de formation, d'une facture libre, d'un avoir et
 * d'une facture de coaching : ce sont le même engagement, et les distinguer
 * inviterait à durcir l'un en oubliant l'autre.
 */
export type ActeEngageant =
  /** Apposer la signature de l'organisme sur une pièce (convention, contrat, lettre de mission). */
  | "contresigner"
  /** Émettre une attestation de fin de formation ou un certificat de réalisation. */
  | "attester"
  /** Conclure un devis au nom de l'organisme (acceptation, transformation en convention). */
  | "conclure_devis"
  /** Émettre une facture, un avoir, ou encaisser. */
  | "facturer"
  /** Habiliter un formateur sur une formation, ou lever la réserve d'un sous-traitant. */
  | "habiliter_formateur"
  /** Déposer une demande de prise en charge auprès d'un financeur, au nom du client (mandat). */
  | "deposer_demande_financeur"
  /**
   * Priver d'effet une signature d'émargement déjà apposée et scellée.
   *
   * 🔴 `D3-3-04` (2026-08-20). C'est l'acte le plus lourd du registre : il
   * retire sa valeur à une preuve que la loi impose de tenir (art. L.6353-1
   * C. trav.), et sur laquelle repose le certificat de réalisation — donc la
   * prise en charge du financeur.
   *
   * Réservé à la DIRECTION seule, et non au responsable qualité : celui-ci
   * peut attester et valider, c'est-à-dire AJOUTER de la preuve. Retirer sa
   * valeur à une preuve déjà recueillie n'est pas le même geste, et ne relève
   * pas de la même responsabilité.
   */
  | "revoquer_signature";

/**
 * Les rôles du produit, du plus au moins étendu.
 *
 * 🔴 Ce tuple est la SOURCE, et `RoleAdmin` s'en déduit — pas l'inverse. Un type
 * seul ne survit pas à la compilation : il ne peut ni peupler un `<select>`, ni
 * construire un `z.enum`, ni se parcourir dans un test. Faute de tuple, six
 * endroits du produit portaient chacun leur recopie de la liste (`D6-2-M1`), et
 * les six étaient restées à quatre rôles pendant que l'enum en portait six.
 *
 * ⚠️ L'ordre est SIGNIFIANT : il est repris tel quel dans les menus de choix de
 * rôle, du plus étendu au plus restreint.
 */
export const ROLES_ADMIN = [
  "super_admin",
  "admin",
  "responsable_qualite",
  "secretaire",
  "editor",
  "reader",
] as const;

/** Les rôles NextAuth existants, plus les deux rôles métier ajoutés en 2026-08. */
export type RoleAdmin = (typeof ROLES_ADMIN)[number];

/**
 * Qui peut poser quel acte.
 *
 * 🔴 Lecture de la matrice : `super_admin` et `admin` engagent l'organisme sans
 * restriction — ce sont les comptes de direction. `responsable_qualite` porte
 * les actes du DOMAINE QUALITÉ (attester, valider une évaluation, habiliter un
 * formateur) parce que ce sont précisément les décisions que le RNQ lui confie
 * (ind. 11, 21, 22) ; il n'engage jamais l'organisme sur le plan CONTRACTUEL ou
 * FINANCIER. `secretaire`, `editor` et `reader` ne posent AUCUN acte engageant.
 *
 * ⚠️ `secretaire` n'est pas un rôle diminué : il peut tout faire de ce qui
 * n'engage pas (créer une session, inscrire, générer les brouillons, convoquer,
 * relancer, classer, tout consulter) via `requireAdminWrite`. C'est le sens même
 * de l'objectif « n'importe quelle secrétaire gère le système ».
 */
/**
 * 🔴 QUI PEUT POSER UN ACTE QUI N'ENGAGE RIEN — l'autre moitié de la frontière.
 *
 * ## Le défaut que cette constante ferme
 *
 * Trouvé le 2026-08-17 en ouvrant la porte d'audit du Lot 9, puis vérifié :
 * `requireAdminWrite` (`actions/knowledge/_guards.ts`) testait une liste écrite
 * en dur — `super_admin`, `admin`, `editor` — et **ni `responsable_qualite` ni
 * `secretaire` n'y figuraient**.
 *
 * Les deux rôles créés le 15/08 par le Lot 10 étaient donc **inertes** : toute
 * action gardée par `requireAdminWrite` leur répondait `forbidden`. Créer une
 * session, inscrire un stagiaire, générer un brouillon, convoquer, relancer,
 * classer — rien. Des comptes en LECTURE déguisés.
 *
 * Et le commentaire six lignes plus haut affirmait exactement l'inverse :
 * *« `secretaire` n'est pas un rôle diminué : il peut tout faire de ce qui
 * n'engage pas […] via `requireAdminWrite` »*. **La doctrine et le code se
 * contredisaient**, et c'est la doctrine qui avait raison.
 *
 * ## Pourquoi la liste vit ICI et plus dans la garde
 *
 * Une liste de rôles écrite dans la garde est invisible depuis la matrice : on
 * peut ajouter un rôle à `HABILITATIONS` — donc lui donner le droit d'attester —
 * sans voir qu'il ne peut même pas créer une session. C'est arrivé. Ici, les
 * deux moitiés de la frontière se lisent d'un seul regard, et un test vérifie
 * qu'elles restent cohérentes.
 *
 * ⚠️ `reader` en est ABSENT, et c'est le seul rôle qui doit l'être : c'est le
 * compte de consultation. `editor` y reste — produire un brouillon n'engage
 * rien, c'est précisément la colonne déléguable.
 */
export const ROLES_ECRITURE: ReadonlyArray<RoleAdmin> = [
  "super_admin",
  "admin",
  "responsable_qualite",
  "secretaire",
  "editor",
];

/** Ce rôle peut-il poser un acte qui n'engage pas l'organisme ? */
export function peutEcrire(role: string | null | undefined): boolean {
  return ROLES_ECRITURE.includes(role as RoleAdmin);
}

/**
 * 🔴 QUI PEUT CONSULTER — la troisième moitié, restée hors du SSOT jusqu'ici.
 *
 * ## Le défaut que cette constante ferme
 *
 * Mesuré le 2026-08-27. Le SSOT décrivait qui ÉCRIT et qui ENGAGE, jamais qui
 * REGARDE. Chaque page a donc tranché seule, et le résultat n'est pas un
 * périmètre, c'est une dérive :
 *
 * | | |
 * |---|---|
 * | pages `(admin)` | **305** |
 * | fermées par une liste de rôles ÉCRITE EN DUR | **64** |
 * | passant par ce fichier | **0** |
 *
 * Le callback `authorized()` d'Auth.js ne teste que `isLoggedIn` — jamais le
 * rôle — et aucun `layout` n'ajoute de garde. **241 pages sur 305 (79 %) étaient
 * donc déjà ouvertes** à `secretaire`, `reader`, `editor` et
 * `responsable_qualite`. Les 64 autres se fermaient sans que rien ne dise
 * pourquoi celles-là.
 *
 * ⚠️ La preuve que c'est une dérive et non une décision : `/qualiopi/facturation`
 * portait sa propre liste, `["admin", "super_admin", "editor", "reader"]`.
 * **`reader` — le rôle qui, par définition, ne fait que lire — voyait le hub de
 * facturation ; `secretaire`, dont ce fichier écrit qu'elle « gère le système »,
 * ne le voyait pas.** `responsable_qualite`, le rôle Qualiopi, non plus. Aucune
 * décision de périmètre ne produit ce classement.
 *
 * ## Pourquoi ouvrir en lecture est SÛR
 *
 * Vérifié acte par acte : les sept actes engageants qui existent réellement sont
 * gardés CÔTÉ SERVEUR par `requireHabilitation`, indépendamment de l'écran
 * atteint. Atteindre la fiche d'un devis ne permet pas de le conclure —
 * `conclure_devis` reste `["super_admin", "admin"]`.
 *
 * ## 🔴 `valider_evaluation` A ÉTÉ RETIRÉ (décision de Will, 2026-08-27)
 *
 * Cette matrice a porté pendant des mois un huitième acte, `valider_evaluation`,
 * réservé à `["super_admin", "admin", "responsable_qualite"]` et assorti d'un
 * motif de refus soigné. **Il n'était appelé nulle part.**
 *
 * Vérifié avant de conclure : ce n'était pas un trou de sécurité, c'était un acte
 * **qui n'existe pas dans le produit**. `EvaluationAcquis` ne porte aucun état de
 * validation — ni `valideeAt`, ni `valideePar`, ni statut. Ce que l'entrée
 * décrivait (« elle fonde l'attestation ») est réellement gardé, mais par
 * `attester`, sur `genererAttestationAction`.
 *
 * 🔑 **Une entrée de matrice qui ne garde rien est pire qu'une absence** :
 * `actesAutorises()` la rendait, et tout lecteur en déduisait que le geste était
 * contrôlé. Le dépôt le savait déjà — `toute-action-a-une-surface.spec.ts` la
 * nomme parmi SEPT cas du même motif, « l'outil est écrit, le raccordement
 * manque ». Nommée, jamais résolue.
 *
 * Si un jour on construit vraiment cette étape, c'est l'entrée qu'il faudra
 * remettre — en même temps que le bouton, pas avant.
 *
 * ## La frontière, en une phrase
 *
 * `reader` lit et ne fait que lire ; tous les autres lisent aussi. La frontière
 * du produit est sur l'**acte**, jamais sur l'écran.
 */
export const ROLES_CONSULTATION: ReadonlyArray<RoleAdmin> = ROLES_ADMIN;

/**
 * Ce rôle peut-il CONSULTER la console ?
 *
 * 🔑 Volontairement dérivé de `ROLES_ADMIN` et non recopié : un rôle ajouté à
 * l'énumération consulte par défaut, et c'est la bonne valeur par défaut —
 * l'inverse (un rôle neuf qui ne voit rien) fabrique exactement les comptes
 * inertes du 2026-08-17.
 */
export function peutConsulter(role: string | null | undefined): boolean {
  return ROLES_CONSULTATION.includes(role as RoleAdmin);
}

export const HABILITATIONS: Readonly<Record<ActeEngageant, ReadonlyArray<RoleAdmin>>> = {
  contresigner: ["super_admin", "admin"],
  attester: ["super_admin", "admin", "responsable_qualite"],
  conclure_devis: ["super_admin", "admin"],
  facturer: ["super_admin", "admin"],
  habiliter_formateur: ["super_admin", "admin", "responsable_qualite"],
  deposer_demande_financeur: ["super_admin", "admin"],
  revoquer_signature: ["super_admin", "admin"],
};

/**
 * Libellé affiché quand l'acte est refusé.
 *
 * 🔴 Un bouton absent sans explication produit un appel téléphonique. L'écran
 * doit dire POURQUOI, et à QUI s'adresser — sinon la personne contourne, ou
 * appelle le dirigeant pour un geste de trois secondes.
 */
export const MOTIF_REFUS: Readonly<Record<ActeEngageant, string>> = {
  contresigner:
    "Contresigner engage l'organisme : cet acte revient à un responsable habilité (direction).",
  attester:
    "Émettre une attestation engage l'organisme sur la réalisation : acte réservé à la direction ou au responsable qualité.",
  conclure_devis:
    "Conclure un devis engage l'organisme contractuellement : acte réservé à la direction.",
  facturer: "Émettre une facture engage l'organisme comptablement : acte réservé à la direction.",
  habiliter_formateur:
    "Habiliter un formateur engage la qualité de l'action (ind. 21/22) : acte réservé à la direction ou au responsable qualité.",
  deposer_demande_financeur:
    "Déposer une demande de prise en charge engage l'organisme au nom du client (mandat) : acte réservé à la direction.",
  // ⚠️ Le libellé disait « une signature d'émargement » — il avait été écrit pour
  // ce seul canal. L'acte couvre aussi la révocation d'une signature de PIÈCE
  // depuis le registre auditeur : un message qui nomme le mauvais objet envoie
  // chercher au mauvais endroit.
  revoquer_signature:
    "Priver d'effet une signature — d'émargement ou de pièce — retire sa valeur à une preuve légale : acte réservé à la direction.",
};

/**
 * Ce rôle peut-il poser cet acte ?
 *
 * ⚠️ `role` est typé `string` et non `RoleAdmin` À DESSEIN : la session NextAuth
 * expose `role?: string` (cf. `knowledge/_guards.ts`), et un rôle inconnu — parce
 * qu'il vient d'un jeton ancien, d'une base pas encore migrée, ou d'une faute de
 * frappe en configuration — doit être REFUSÉ, pas provoquer une erreur de type
 * qui masquerait le cas. Refus par défaut : c'est la seule valeur sûre pour une
 * garde d'autorisation.
 */
export function peutEngager(role: string | null | undefined, acte: ActeEngageant): boolean {
  if (role == null) return false;
  return (HABILITATIONS[acte] as ReadonlyArray<string>).includes(role);
}

/** Tous les actes qu'un rôle peut poser — alimente l'affichage, jamais l'autorisation. */
export function actesAutorises(role: string | null | undefined): ActeEngageant[] {
  return (Object.keys(HABILITATIONS) as ActeEngageant[]).filter((a) => peutEngager(role, a));
}

/** Liste ordonnée des actes engageants — sert aux tests d'exhaustivité. */
export const ACTES_ENGAGEANTS = Object.keys(HABILITATIONS) as ReadonlyArray<ActeEngageant>;

/**
 * ── Le dossier d'un CANDIDAT ────────────────────────────────────────────────
 *
 * Une troisième frontière, qui n'est ni « écrire » ni « engager ».
 *
 * ## Pourquoi elle ne se déduit d'aucune des deux autres
 *
 * `ROLES_ECRITURE` admet `editor` : produire un brouillon n'engage rien, et
 * c'est justement la colonne déléguable. Mais un rôle purement rédactionnel n'a
 * aucune raison d'ouvrir le CV, la photo ou le numéro de téléphone d'une
 * personne qui a postulé. Et `HABILITATIONS` ne s'applique pas non plus : lire
 * un dossier de candidature n'engage l'organisme envers personne.
 *
 * La question n'est donc pas « cela engage-t-il ? » mais « **qui traite ce
 * dossier ?** ». Trier des candidatures est du secrétariat, et le responsable
 * qualité en a besoin pour l'indicateur des compétences. L'éditeur, non.
 *
 * ## 🔴 Le défaut que cette frontière ferme (mesuré le 2026-08-25, cahier D6-1)
 *
 * `admin-job-applications/actions.ts` protégeait le CV par
 * `super_admin | admin | editor`, mais son `requireAdminRead()` **ne testait
 * AUCUN rôle** — il vérifiait la seule présence d'une session. Or trois actions
 * derrière lui (`listApplicationsAction`, `listCandidaturesUnifieesAction`,
 * `getApplicationDetailAction`) rendent les PII **déchiffrées** : nom, adresse
 * e-mail, téléphone.
 *
 * Autrement dit : **la pièce jointe était mieux protégée que l'identité à
 * laquelle elle appartient**, et un compte `reader` — le rôle de consultation,
 * explicitement exclu de l'écriture — lisait l'identité complète de chaque
 * candidat. Protéger la porte en laissant la fenêtre ouverte n'est pas de la
 * prudence : c'est de la fausse sécurité.
 *
 * ## Pourquoi ici, et pas une liste locale de plus
 *
 * Trois surfaces distinctes lisent ce dossier — la liste, le CV, la photo. Une
 * liste recopiée dans chacune divergerait : le dépôt vient d'en solder
 * vingt-neuf copies du prédicat d'écriture, et neuf défauts sur onze de la nuit
 * du 24 étaient « une règle appliquée à un site, oubliée sur son jumeau ».
 *
 * ⚠️ **La liste de rôles ne suffit pas à rendre l'accès défendable devant la
 * CNIL — c'est la TRACE qui le rend défendable.** Les trois surfaces journalisent
 * désormais l'accès (`ActivityLog`), ce qu'aucune ne faisait.
 */
export const ROLES_DOSSIER_CANDIDAT: ReadonlyArray<RoleAdmin> = [
  "super_admin",
  "admin",
  "responsable_qualite",
  "secretaire",
];

/**
 * Ce rôle peut-il ouvrir le dossier d'un candidat — identité, CV, photo ?
 *
 * Refus par défaut sur un rôle inconnu, pour la même raison que `peutEngager`.
 */
export function peutOuvrirDossierCandidat(
  role: string | null | undefined,
): role is (typeof ROLES_DOSSIER_CANDIDAT)[number] {
  if (role == null) return false;
  return (ROLES_DOSSIER_CANDIDAT as ReadonlyArray<string>).includes(role);
}

/**
 * ── Les deux derniers ensembles du périmètre RECRUTEMENT ────────────────────
 *
 * 🔴 POURQUOI ILS MONTENT ICI ALORS QUE PERSONNE NE CHANGE DE DROIT.
 *
 * Ces deux listes existaient, écrites en dur, dans `admin-job-offers/actions.ts`
 * et `admin-job-applications/actions.ts`. Elles ne divergeaient pas encore — et
 * c'est justement le moment de les remonter : une liste locale ne diverge pas le
 * jour où on l'écrit, elle diverge le jour où le SSOT gagne un rôle, et
 * **personne ne le voit sur aucun écran**.
 *
 * Le lot 6 vient d'en payer la démonstration : la garde d'écriture des
 * candidatures autorisait `super_admin | admin | editor` pendant que
 * `ROLES_DOSSIER_CANDIDAT` valait `super_admin | admin | responsable_qualite |
 * secretaire`. Résultat : `editor` écartait des dossiers qu'il ne pouvait pas
 * ouvrir, et `secretaire` menait le dossier sans pouvoir le conclure.
 *
 * ⚠️ **Aucun périmètre effectif ne change ici.** Les deux prédicats rendent
 * exactement les mêmes réponses que les littéraux qu'ils remplacent. C'est
 * délibéré : élargir un droit au passage d'un refactor est la façon la plus
 * discrète d'ouvrir une porte. Si ces ensembles doivent bouger, ce sera une
 * décision, dans sa propre PR, avec son motif.
 */

/**
 * GÉRER une offre d'emploi — créer, modifier, publier, archiver, cloner.
 *
 * Distinct de `ROLES_DOSSIER_CANDIDAT` à dessein : une offre est un texte
 * éditorial destiné à être PUBLIC, pas le dossier d'une personne. `editor` y a
 * donc sa place, là où il n'a rien à faire dans une candidature ; et
 * `responsable_qualite` comme `secretaire` n'en publient pas.
 */
export const ROLES_GESTION_OFFRE: ReadonlyArray<RoleAdmin> = ["super_admin", "admin", "editor"];

export function peutGererLesOffres(
  role: string | null | undefined,
): role is (typeof ROLES_GESTION_OFFRE)[number] {
  if (role == null) return false;
  return (ROLES_GESTION_OFFRE as ReadonlyArray<string>).includes(role);
}

/**
 * Les gestes IRRÉVERSIBLES du recrutement : supprimer une candidature,
 * supprimer une offre.
 *
 * 🔑 Ce n'est pas un `ActeEngageant` : supprimer n'engage l'organisme envers
 * personne, ça lui retire au contraire une trace. C'est une frontière de
 * DESTRUCTION, et elle se tient au rôle le plus étroit — d'autant que la
 * doctrine du dossier (décision D4 de Will) est qu'on ne supprime jamais un
 * dossier tout seul.
 */
export function estSuperAdmin(role: string | null | undefined): role is "super_admin" {
  return role === "super_admin";
}
