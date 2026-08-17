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
  /** Valider une évaluation finale des acquis — elle fonde l'attestation. */
  | "valider_evaluation"
  /** Conclure un devis au nom de l'organisme (acceptation, transformation en convention). */
  | "conclure_devis"
  /** Émettre une facture, un avoir, ou encaisser. */
  | "facturer"
  /** Habiliter un formateur sur une formation, ou lever la réserve d'un sous-traitant. */
  | "habiliter_formateur"
  /** Déposer une demande de prise en charge auprès d'un financeur, au nom du client (mandat). */
  | "deposer_demande_financeur";

/** Les rôles NextAuth existants, plus les deux rôles métier ajoutés en 2026-08. */
export type RoleAdmin =
  "super_admin" | "admin" | "responsable_qualite" | "secretaire" | "editor" | "reader";

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

export const HABILITATIONS: Readonly<Record<ActeEngageant, ReadonlyArray<RoleAdmin>>> = {
  contresigner: ["super_admin", "admin"],
  attester: ["super_admin", "admin", "responsable_qualite"],
  valider_evaluation: ["super_admin", "admin", "responsable_qualite"],
  conclure_devis: ["super_admin", "admin"],
  facturer: ["super_admin", "admin"],
  habiliter_formateur: ["super_admin", "admin", "responsable_qualite"],
  deposer_demande_financeur: ["super_admin", "admin"],
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
  valider_evaluation:
    "Valider une évaluation finale fonde l'attestation : acte réservé à la direction ou au responsable qualité.",
  conclure_devis:
    "Conclure un devis engage l'organisme contractuellement : acte réservé à la direction.",
  facturer: "Émettre une facture engage l'organisme comptablement : acte réservé à la direction.",
  habiliter_formateur:
    "Habiliter un formateur engage la qualité de l'action (ind. 21/22) : acte réservé à la direction ou au responsable qualité.",
  deposer_demande_financeur:
    "Déposer une demande de prise en charge engage l'organisme au nom du client (mandat) : acte réservé à la direction.",
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
