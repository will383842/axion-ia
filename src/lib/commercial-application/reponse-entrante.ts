// RÉPONSES ENTRANTES DES CANDIDATS APPORTEURS — les règles, en module PUR (2026-09-27).
//
// Décision de Will du 2026-09-27 : quand une personne invitée à l'échange
// répond par e-mail à son invitation, la console doit le savoir — la fiche et
// la liste affichent « A répondu le JJ/MM », et ses rappels s'arrêtent.
//
// Ce module ne lit rien et n'écrit rien : il dit si un message est une réponse
// AUTOMATIQUE, il taille l'objet et l'extrait, il reconnaît l'adresse de
// l'expéditeur. Le relevé vit dans `features/commercial-application/
// reponses-entrantes-apporteur.ts`, le client Zoho dans `server/zoho-mail/`.
//
// ── Pourquoi garder une réponse automatique, sans arrêter les rappels ─────
// Un « je suis absent jusqu'au 12 » n'est pas une réponse de la personne :
// elle n'a rien lu. Arrêter ses rappels sur un message de son logiciel lui
// ferait perdre l'invitation. On le GARDE quand même (marqué `auto`) : la fiche
// dit ainsi pourquoi un rappel est parti alors que « quelque chose » est
// arrivé, et Will voit la date de retour annoncée.

/** Longueur maximale de l'objet enregistré (colonne `VARCHAR(500)`). */
export const LONGUEUR_OBJET_MAX = 500;
/** Longueur maximale de l'extrait affiché — jamais le corps complet. */
export const LONGUEUR_EXTRAIT_MAX = 300;

/** En-têtes d'un message, noms en minuscules → valeurs (un en-tête peut se répéter). */
export type Entetes = Readonly<Record<string, readonly string[]>>;

/** Normalise une table d'en-têtes : noms en minuscules, valeurs en tableau de chaînes. */
export function normaliserEntetes(brut: unknown): Entetes {
  const sortie: Record<string, string[]> = {};
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return sortie;
  for (const [nom, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const valeurs = (Array.isArray(valeur) ? valeur : [valeur])
      .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
      .map(String);
    const cle = nom.trim().toLowerCase();
    sortie[cle] = [...(sortie[cle] ?? []), ...valeurs];
  }
  return sortie;
}

function valeurs(e: Entetes, nom: string): string[] {
  return (e[nom] ?? []).map((v) => v.trim().toLowerCase());
}

/**
 * Objets typiques d'une réponse automatique, en français et en anglais. Ancrés
 * en DÉBUT d'objet : « Re: absence de réponse ? » écrit par une personne ne
 * doit pas passer pour un message de logiciel.
 */
const OBJETS_AUTOMATIQUES: readonly RegExp[] = [
  /^(re\s*:\s*)?r[ée]ponse automatique\b/i,
  /^(re\s*:\s*)?(message|r[ée]ponse)\s+d'absence\b/i,
  /^(re\s*:\s*)?absen(ce|t)\b/i,
  /^(re\s*:\s*)?auto(matic)?[\s-]?(reply|response|réponse)\b/i,
  /^(re\s*:\s*)?out of (the )?office\b/i,
  /^(re\s*:\s*)?(je suis |i am |i'm )?(actuellement )?(absent|away)\b/i,
  /^(re\s*:\s*)?accus[ée] de r[ée]ception\b/i,
  /^(re\s*:\s*)?(delivery status notification|undeliverable|mail delivery failed)\b/i,
];

/**
 * Le message est-il une réponse AUTOMATIQUE ?
 *
 * Par ordre de fiabilité :
 *   · `Auto-Submitted` (RFC 3834) autre que `no` ;
 *   · `X-Autoreply`, `X-Autorespond` ;
 *   · `Precedence: auto_reply | bulk | junk | list` ;
 *   · à défaut d'en-têtes lisibles, l'OBJET.
 */
export function estReponseAutomatique(msg: {
  readonly entetes: Entetes | null;
  readonly objet: string;
}): boolean {
  const e = msg.entetes;
  if (e) {
    if (valeurs(e, "auto-submitted").some((v) => v !== "" && v !== "no")) return true;
    if (valeurs(e, "x-autoreply").some((v) => v !== "" && v !== "no")) return true;
    if (valeurs(e, "x-autorespond").length > 0) return true;
    // ⚠️ PAS `X-Auto-Response-Suppress` : Exchange le pose aussi sur des
    // messages écrits par une personne. Il demande de ne pas LUI répondre
    // automatiquement ; il ne dit pas que le message l'est.
    if (valeurs(e, "precedence").some((v) => /^(auto_reply|bulk|junk|list)$/.test(v))) return true;
  }
  return OBJETS_AUTOMATIQUES.some((r) => r.test(msg.objet.trim()));
}

/** L'adresse d'un expéditeur — « Camille <camille@exemple.fr> » ou nue —, normalisée ; `null` si illisible. */
export function adresseExpediteur(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const chevrons = /<([^<>\s]+@[^<>\s]+)>/.exec(brut);
  const candidate = (chevrons ? chevrons[1]! : brut).trim().toLowerCase();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(candidate) ? candidate : null;
}

/** Coupe sur une frontière de mot, ajoute « … » si le texte a été raccourci. */
function tailler(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max - 1);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/** L'objet enregistré : espaces repliés, ≤ 500 caractères, « (sans objet) » si vide. */
export function objetEnregistre(brut: string | null | undefined): string {
  const t = (brut ?? "").replace(/\s+/g, " ").trim();
  return t ? tailler(t, LONGUEUR_OBJET_MAX) : "(sans objet)";
}

/**
 * Début de la citation du message d'origine — « Le 27 sept. 2026 à 19:30,
 * Axion-IA a écrit : », « On Sat, Sep 27, 2026 at … wrote: », « ----- Message
 * d'origine ----- », « De : ». Ce qui suit n'est pas la réponse de la personne :
 * c'est NOTRE invitation qu'elle cite.
 */
const DEBUT_CITATION =
  /\s(le\s.{4,80}?a\s[ée]crit\s?:|on\s.{4,80}?wrote\s?:|-{2,}\s?(message d'origine|original message|forwarded message)|de\s?:\s.{1,120}?envoy[ée]\s?:|from\s?:\s.{1,120}?sent\s?:)/i;

/**
 * L'extrait affiché : le résumé que Zoho donne du corps, SANS la citation de
 * l'invitation, espaces repliés, ≤ 300 caractères. `null` s'il ne reste rien.
 */
export function extraitCourt(resume: string | null | undefined): string | null {
  const plat = ` ${(resume ?? "").replace(/\s+/g, " ").trim()}`;
  const m = DEBUT_CITATION.exec(plat);
  const utile = (m ? plat.slice(0, m.index) : plat).trim();
  return utile ? tailler(utile, LONGUEUR_EXTRAIT_MAX) : null;
}

/**
 * L'erreur Prisma dit-elle que la table n'existe pas (P2021) ?
 *
 * Cas ATTENDU pendant l'heure qui suit la fusion : le worker atterrit ~50 min
 * avant que l'app ne joue la migration (`AGENTS.md`, « DEUX conteneurs »).
 * Pendant cette fenêtre, la table des réponses entrantes est absente — donc
 * vide, en vérité : rien n'a pu y être écrit.
 */
export function estTableAbsente(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: unknown }).code;
  return code === "P2021";
}

/**
 * Lien « Ouvrir dans Zoho » vers le message dans l'interface web. L'API ne
 * renvoie qu'une adresse d'API (`URI`) ; ce lien suit le format des permaliens
 * de l'interface (`/zm/#mail/folder/inbox/p/<messageId>`), sans garantie
 * contractuelle de Zoho — au pire il ouvre la boîte de réception.
 */
export function lienZoho(dc: string, zohoMessageId: string): string {
  return `https://mail.zoho.${dc}/zm/#mail/folder/inbox/p/${encodeURIComponent(zohoMessageId)}`;
}
