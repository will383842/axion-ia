// Traduction des clés du journal d'activité — refonte UI 2026-08-01 (couche 4).
//
// POURQUOI
// Le tableau de bord d'accueil — la toute première page de la console —
// affichait les clés brutes du journal : « qualiopi.piece.lien_signature »,
// « facturation.plan_recurrent.statut ». Illisible, et surtout inutile : on ne
// sait pas ce qui s'est passé sans aller lire le code.
//
// POURQUOI PAS UNE TABLE DE 206 ENTRÉES
// Le code écrit 206 clés distinctes, et il en apparaît à chaque sprint. Une
// table exhaustive serait périmée dès la semaine suivante, et une clé absente
// retomberait sur l'affichage brut — exactement le problème qu'on corrige.
//
// Les clés suivent toutes la forme `domaine.objet.verbe` (ou `domaine.verbe`).
// On décode donc la STRUCTURE : une famille d'icône + un nom lisible par
// domaine, un verbe conjugué au participe passé, et l'objet rendu tel quel en
// toutes lettres. Une clé inconnue reste ainsi lisible sans qu'on ait à la
// déclarer.

/**
 * Famille d'icône d'une ligne de journal — refonte UI 2026-08-01 (couche 4).
 *
 * C'est une CLÉ, pas un pictogramme. Ce module est du code de bibliothèque : il
 * est testé sans DOM et ne doit pas dépendre de React. Il nomme donc la famille,
 * et le composant qui affiche le journal choisit la forme (`DashboardV2`,
 * `ICONE_ACTIVITE`).
 *
 * Auparavant la table portait les emojis eux-mêmes — c'est ce qui les rendait
 * impossibles à remplacer sans toucher au module et à ses tests.
 */
export type ActivityIconKey =
  | "coaching"
  | "signature"
  | "document"
  | "devis"
  | "organisation"
  | "alerte"
  | "rapport"
  | "financeur"
  | "audit"
  | "remuneration"
  | "appreciation"
  | "attestation"
  | "reglage"
  | "formation"
  | "facturation"
  | "email"
  | "connaissances"
  | "rgpd"
  | "newsletter"
  | "article"
  | "marque"
  | "media"
  | "inconnu";

/** Famille d'icône + nom du domaine, dérivés du premier segment de la clé. */
const DOMAINES: ReadonlyArray<readonly [prefixe: string, icone: ActivityIconKey, nom: string]> = [
  ["qualiopi.coaching", "coaching", "Coaching"],
  ["qualiopi.emargement", "signature", "Émargement"],
  ["qualiopi.document", "document", "Document"],
  ["qualiopi.piece", "document", "Pièce"],
  ["qualiopi.devis", "devis", "Devis"],
  ["qualiopi.client", "organisation", "Client"],
  ["qualiopi.alerte", "alerte", "Alerte"],
  ["qualiopi.alertes", "alerte", "Alertes"],
  ["qualiopi.bpf", "rapport", "Bilan pédagogique"],
  ["qualiopi.bareme_opco", "financeur", "Barème OPCO"],
  ["qualiopi.audit_mission", "audit", "Mission d'audit"],
  ["qualiopi.compensation_rule", "remuneration", "Rémunération formateur"],
  ["qualiopi.appreciations", "appreciation", "Appréciation"],
  ["qualiopi.attestation", "attestation", "Attestation"],
  ["qualiopi.compta", "rapport", "Comptabilité"],
  ["qualiopi.crm", "organisation", "CRM"],
  ["qualiopi.config", "reglage", "Réglage Qualiopi"],
  ["qualiopi.acompte", "remuneration", "Acompte"],
  ["qualiopi", "formation", "Formation"],
  ["facturation", "facturation", "Facturation"],
  ["email.outbox", "email", "File d'e-mails"],
  ["email.reglage", "reglage", "Réglage e-mail"],
  ["email", "email", "E-mail"],
  ["kb", "connaissances", "Connaissances"],
  ["gdpr", "rgpd", "RGPD"],
  ["newsletter", "newsletter", "Newsletter"],
  ["admin.articles", "article", "Articles"],
  ["brand_voice_drift", "marque", "Voix de marque"],
  ["asset", "media", "Média"],
  ["setting", "reglage", "Réglage"],
] as const;

/** Verbe final → participe passé français. */
const VERBES: Readonly<Record<string, string>> = {
  create: "créé",
  creer: "créé",
  created: "créé",
  new: "créé",
  update: "modifié",
  updated: "modifié",
  updater: "modifié",
  set: "défini",
  definir: "défini",
  set_actif: "activé",
  delete: "supprimé",
  supprimer: "supprimé",
  deleted: "supprimé",
  purged: "purgé",
  send: "envoyé",
  envoyer: "envoyé",
  sent: "envoyé",
  emettre: "émis",
  genere: "généré",
  generer: "généré",
  generate: "généré",
  generated: "généré",
  export: "exporté",
  exporter: "exporté",
  export_csv: "exporté en CSV",
  export_pdf: "exporté en PDF",
  export_zip: "exporté en archive",
  importer: "importé",
  accept: "accepté",
  decline: "refusé",
  refuser: "refusé",
  approuver: "approuvé",
  validate: "validé",
  valider: "validé",
  revise: "révisé",
  statut: "changé de statut",
  transition: "changé d'étape",
  save: "enregistré",
  saved: "enregistré",
  persisted: "enregistré",
  assign_formateur: "assigné à un formateur",
  close: "clôturé",
  revocation: "révoqué",
  contresignature: "contresigné",
  marquer_lu: "marqué comme lu",
  marquer_tout_lu: "tout marqué comme lu",
  resoudre: "résolu",
  synchroniser: "synchronisé",
  promote: "promu",
  demote: "rétrogradé",
  completed: "terminé",
  delivered: "livré",
  uploaded: "téléversé",
  visa: "visé",
  versee: "versée",
};

/**
 * Noms d'objet féminins rencontrés dans les clés du journal.
 *
 * Sans cette liste, le participe reste au masculin et l'on lit « relance
 * envoyé », « facture émis » — ça saute aux yeux en français. On ne vise pas
 * l'exhaustivité grammaticale : ces mots couvrent l'écrasante majorité des
 * clés, et le masculin reste un repli acceptable pour le reste.
 */
const OBJETS_FEMININS: ReadonlySet<string> = new Set([
  "relance",
  "facture",
  "convention",
  "piece",
  "session",
  "alerte",
  "alertes",
  "attestation",
  "entree",
  "mission",
  "regle",
  "depense",
  "appreciation",
  "version",
  "ligne",
  "demande",
  "campagne",
  "page",
  "image",
  "categorie",
  "etiquette",
  "note",
  "tache",
  "reclamation",
  "veille",
  "signature",
  "presence",
  "evaluation",
  "formation",
  "habilitation",
  "disponibilite",
  "offre",
  "candidature",
  "connaissance",
  "connaissances",
  "donnee",
  "donnees",
  "url",
  "fiche",
  "grille",
  "convocation",
  "lettre",
  "revue",
  "pieces",
  "newsletter",
  "newsletters",
  "relances",
  "factures",
  "sessions",
  "formations",
  "candidatures",
  "offres",
  "notes",
  "images",
  "pages",
  "versions",
  "lignes",
  "demandes",
  "signatures",
]);

/** Retire les accents pour comparer un mot à la liste ci-dessus. */
function sansAccent(mot: string): string {
  return mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Accorde un participe passé en genre et en nombre.
 *
 * Seul le PREMIER mot est accordé : « exporté en CSV » doit devenir
 * « exportée en CSV », et surtout pas « exporté en CSVe ».
 */
function accorder(participe: string, feminin: boolean, pluriel: boolean): string {
  if (!feminin && !pluriel) return participe;
  const [tete, ...suite] = participe.split(" ");
  if (tete === undefined) return participe;
  let accorde = tete;
  if (feminin && !accorde.endsWith("e")) accorde += "e";
  if (pluriel && !accorde.endsWith("s")) accorde += "s";
  return [accorde, ...suite].join(" ");
}

/** Un nom au pluriel se termine par « s » — approximation suffisante ici. */
function estPluriel(nom: string): boolean {
  return sansAccent(nom).endsWith("s");
}

export interface ActionDecrite {
  /** Repère visuel du domaine. */
  icone: ActivityIconKey;
  /** Ce qui a été fait, en toutes lettres. */
  texte: string;
}

/**
 * Segments d'objet écrits en anglais dans les clés (le code mélange les deux
 * langues). La console est en français : on les traduit, sinon on lit
 * « Trainer document généré » à côté de « Convention générée ».
 */
const OBJETS_TRADUITS: Readonly<Record<string, string>> = {
  trainer: "formateur",
  trainer_document: "document formateur",
  trainer_availability: "disponibilité formateur",
  trainee: "stagiaire",
  enrollment: "inscription",
  draft: "brouillon",
  invoice: "facture",
  quote: "devis",
  booking: "réservation",
  user: "utilisateur",
  settings: "réglages",
  article: "article",
  asset: "média",
  outbox: "file d’envoi",
  piece: "pièce",
  releve: "relevé",
  emargement: "émargement",
  reglage: "réglage",
  entree: "entrée",
  depense: "dépense",
  moyen: "moyen pédagogique",
  sous_traitant: "sous-traitant",
  revue_direction: "revue de direction",
  audit_mission: "mission d’audit",
  certificat_realisation: "certificat de réalisation",
  facture_libre: "facture libre",
  plan_recurrent: "plan récurrent",
  lien_signature: "lien de signature",
};

function humaniser(segment: string): string {
  return OBJETS_TRADUITS[segment] ?? segment.replace(/_/g, " ");
}

/**
 * Traduit une clé du journal en une phrase lisible.
 *
 * `qualiopi.document.convention.genere` → `document` + « Document convention généré »
 * `facturation.relance.envoyer`         → `facturation` + « Relance envoyée »
 * `un.verbe.inconnu`                    → `inconnu` + « un verbe inconnu » (jamais la clé brute)
 */
export function decrireAction(action: string): ActionDecrite {
  const cle = action.trim();
  if (cle === "") return { icone: "inconnu", texte: "Action inconnue" };

  const domaine = DOMAINES.find(([prefixe]) => cle === prefixe || cle.startsWith(`${prefixe}.`));
  const icone = domaine?.[1] ?? "inconnu";

  // Segments restants une fois le domaine retiré.
  const reste = domaine ? cle.slice(domaine[0].length).replace(/^\./, "") : cle;
  const segments = reste.split(".").filter(Boolean);

  if (segments.length === 0) {
    // La clé EST le domaine (ex. « setting.updated » traité plus haut, ou
    // « noop »). On se contente du nom du domaine.
    return { icone, texte: domaine?.[2] ?? humaniser(cle) };
  }

  const dernier = segments[segments.length - 1] as string;
  const verbe = VERBES[dernier];

  // Sans verbe reconnu, tous les segments décrivent l'objet. Le nom du domaine
  // sert alors de sujet pour que la phrase reste complète.
  if (!verbe) {
    const objet = segments.map(humaniser).join(" ");
    return { icone, texte: capitaliser(domaine ? `${domaine[2]} ${objet}` : objet) };
  }

  const objet = segments.slice(0, -1).map(humaniser).join(" ");

  // Sans objet, c'est le domaine qui est le sujet : « Newsletter purgée ».
  if (objet === "") {
    const sujet = domaine?.[2] ?? "";
    const noyauSujet = (sujet.split(" ").pop() ?? "").trim();
    const p = accorder(verbe, OBJETS_FEMININS.has(sansAccent(noyauSujet)), estPluriel(noyauSujet));
    return { icone, texte: capitaliser(`${sujet} ${p}`.trim()) };
  }

  // Avec un objet, on NE répète PAS le nom du domaine : l'emoji le porte déjà,
  // et « Facturation relance envoyée » se lit moins bien que « Relance
  // envoyée ». L'accord se fait sur le dernier mot de l'objet, qui en est le
  // noyau (« certificat realisation » → masculin, « lien signature » → masculin).
  const mots = objet.split(" ");
  const noyau = mots[mots.length - 1] as string;
  const p = accorder(verbe, OBJETS_FEMININS.has(sansAccent(noyau)), estPluriel(noyau));
  return { icone, texte: capitaliser(`${objet} ${p}`) };
}

function capitaliser(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
