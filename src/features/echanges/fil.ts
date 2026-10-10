/**
 * LE FIL « ÉCHANGES » D'UNE FICHE — la part PURE (Candidatures unifiées L7).
 *
 * Avant, une fiche dispersait l'histoire d'une personne en blocs : réponses
 * envoyées, réponses reçues, invitations, rendez-vous, fichiers envoyés, notes.
 * On lisait chaque bloc et on reconstituait l'ordre de tête. Le fil les range
 * en UNE liste, dans l'ordre des faits, comme la maquette validée :
 *
 *   « Reçu » à gauche · « Envoyé » à droite · les notes au centre.
 *
 * Ce module ne lit rien : il reçoit des lignes déjà lues (`lire-fil.ts`) et en
 * fait des FAITS. Deux adaptateurs, un par monde, et jamais un statut commun :
 *
 *   - `faitsEmploi`     : journal de la candidature, réponses reçues (L3),
 *                         liens et fichiers (L5/L5b) ;
 *   - `faitsApporteur`  : réponses envoyées (SubmissionReply), réponses reçues
 *                         (SubmissionInboundReply), invitations et rappels
 *                         (journal des envois), échange réservé et son suivi,
 *                         liens et fichiers.
 *
 * 🔴 Côté apporteur, AUCUN mot de recrutement : les libellés de ce module sont
 * balayés par `vocabulaire-apporteur` (test `fil.spec.ts`).
 *
 * Module PUR : ni Prisma, ni `server-only`. Il est rendu par un composant
 * SERVEUR (`components/admin/echanges/FilEchanges.tsx`) : rien n'en part dans
 * le JavaScript du navigateur.
 */

export type SensFait = "recu" | "envoye" | "note";
export type TonFait = "success" | "warning" | "destructive" | "neutral" | "info";

export interface FichierDuFait {
  readonly nom: string;
  readonly taille: string | null;
  /** « téléchargé le 06/10 », « pas encore téléchargé »… */
  readonly etat: string;
  readonly ton: TonFait;
}

export interface FaitFil {
  readonly id: string;
  readonly sens: SensFait;
  /** Quand le FAIT a eu lieu — jamais quand il a été saisi. */
  readonly quand: Date;
  /** « Reçu », « Envoyé · Présenter le réseau », « Note »… */
  readonly titre: string;
  /** Petites précisions après la date : « remis », « lien ouvert le 05/10 »… */
  readonly precisions: ReadonlyArray<string>;
  readonly badge?: { readonly libelle: string; readonly ton: TonFait } | null;
  /** Le texte court montré dans la bulle (objet, extrait, résumé). */
  readonly texte?: string | null;
  /** Le corps complet, replié. */
  readonly detail?: string | null;
  /** Une erreur d'envoi, montrée EN ENTIER (elle dit quel geste faire). */
  readonly erreur?: string | null;
  readonly lien?: { readonly href: string; readonly libelle: string } | null;
  readonly fichiers?: ReadonlyArray<FichierDuFait>;
}

/** « 05/10 », heure de Paris. */
export function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/** Du plus RÉCENT au plus ancien ; à date égale, ordre stable par identifiant. */
export function ordonnerFil(faits: ReadonlyArray<FaitFil>): FaitFil[] {
  const vus = new Set<string>();
  const uniques = faits.filter((f) => (vus.has(f.id) ? false : (vus.add(f.id), true)));
  return uniques.sort((a, b) => b.quand.getTime() - a.quand.getTime() || a.id.localeCompare(b.id));
}

// ── Livraison d'un message envoyé ───────────────────────────────────────────

const LIVRAISON: Readonly<Record<string, { libelle: string; ton: TonFait }>> = {
  pending: { libelle: "en cours d'envoi", ton: "warning" },
  sent: { libelle: "remis", ton: "success" },
  delivered: { libelle: "remis", ton: "success" },
  failed: { libelle: "échec d'envoi", ton: "destructive" },
  bounced: { libelle: "rejeté par le destinataire", ton: "destructive" },
};

export function badgeLivraison(statut: string): { libelle: string; ton: TonFait } {
  return LIVRAISON[statut] ?? { libelle: statut, ton: "neutral" };
}

// ── Les fichiers d'un lien privé ────────────────────────────────────────────

/** Ce que le fil sait d'un lien privé (sous-ensemble de `LienEnvoye`). */
export interface LienDuFil {
  readonly id: string;
  readonly reponseId: string | null;
  readonly creeLe: Date;
  readonly ouvertLe: Date | null;
  readonly etat: string;
  readonly fichiers: ReadonlyArray<{
    readonly titre: string;
    readonly nomFichier: string | null;
    readonly tailleLisible: string | null;
    readonly telechargeLe: Date | null;
    readonly apercuSeulement: boolean;
  }>;
}

function fichiersDuLien(l: LienDuFil): FichierDuFait[] {
  return l.fichiers.map((f) => ({
    nom: f.nomFichier ?? f.titre,
    taille: f.tailleLisible,
    etat: f.telechargeLe
      ? `téléchargé le ${jourMois(f.telechargeLe)}`
      : f.apercuSeulement
        ? "aperçu automatique seulement"
        : "pas encore téléchargé",
    ton: f.telechargeLe ? "success" : "neutral",
  }));
}

function precisionsDuLien(l: LienDuFil): string[] {
  const p: string[] = [];
  if (l.ouvertLe) p.push(`lien ouvert le ${jourMois(l.ouvertLe)}`);
  if (l.etat === "expire") p.push("lien expiré");
  if (l.etat === "retire") p.push("lien retiré");
  return p;
}

/**
 * Accroche chaque lien au message qui l'a porté (`reponseId`). Un lien sans
 * message connu devient son propre fait « Envoyé · Fichiers » : il ne disparaît
 * jamais du fil.
 */
function accrocherLiens(
  faits: FaitFil[],
  liens: ReadonlyArray<LienDuFil>,
  idDuMessage: (reponseId: string) => string,
): FaitFil[] {
  const parReponse = new Map(liens.filter((l) => l.reponseId).map((l) => [l.reponseId!, l]));
  const accroches = new Set<string>();
  const out = faits.map((f) => {
    const l = [...parReponse.entries()].find(([rid]) => idDuMessage(rid) === f.id)?.[1];
    if (!l) return f;
    accroches.add(l.id);
    return {
      ...f,
      precisions: [...f.precisions, ...precisionsDuLien(l)],
      fichiers: fichiersDuLien(l),
    };
  });
  for (const l of liens) {
    if (accroches.has(l.id)) continue;
    out.push({
      id: `lien-${l.id}`,
      sens: "envoye",
      quand: l.creeLe,
      titre: "Envoyé · Fichiers",
      precisions: precisionsDuLien(l),
      fichiers: fichiersDuLien(l),
    });
  }
  return out;
}

// ── Emploi ──────────────────────────────────────────────────────────────────

export interface EvenementEmploi {
  readonly id: string;
  readonly type: string;
  readonly libelle: string;
  readonly occurredAt: Date;
  readonly authorName: string;
  readonly summary: string;
  readonly body: string | null;
  readonly replyId: string | null;
  /** Posé par le relevé L3 : la réponse reçue a sa propre ligne, plus riche. */
  readonly reponseRecueId: string | null;
  readonly livraison: {
    readonly statut: string;
    readonly erreur: string | null;
    readonly reessais: number;
  } | null;
}

export interface ReponseRecueDuFil {
  readonly id: string;
  readonly recueLe: Date;
  readonly objet: string;
  readonly extrait: string | null;
  readonly automatique: boolean;
  readonly lienZoho: string;
}

function faitRecu(r: ReponseRecueDuFil): FaitFil {
  return {
    id: `recu-${r.id}`,
    sens: "recu",
    quand: r.recueLe,
    titre: "Reçu",
    precisions: ["lu automatiquement", ...(r.automatique ? ["réponse automatique"] : [])],
    texte: r.extrait ? `« ${r.extrait} »` : r.objet,
    detail: r.extrait ? r.objet : null,
    lien: { href: r.lienZoho, libelle: "Ouvrir dans Zoho" },
  };
}

export function faitsEmploi(d: {
  readonly evenements: ReadonlyArray<EvenementEmploi>;
  readonly recues: ReadonlyArray<ReponseRecueDuFil>;
  readonly liens: ReadonlyArray<LienDuFil>;
}): FaitFil[] {
  const faits: FaitFil[] = [];
  for (const e of d.evenements) {
    if (e.type === "email_recu" && e.reponseRecueId) continue; // la ligne L3 le dit mieux
    if (e.type === "email_envoye") {
      const b = e.livraison ? badgeLivraison(e.livraison.statut) : null;
      faits.push({
        id: e.replyId ? `envoi-${e.replyId}` : `evt-${e.id}`,
        sens: "envoye",
        quand: e.occurredAt,
        titre: "Envoyé",
        precisions: [
          e.authorName,
          ...(e.livraison && e.livraison.reessais > 0
            ? [`${e.livraison.reessais} réessai(s)`]
            : []),
        ],
        badge: b,
        texte: e.summary,
        detail: e.body && e.body !== e.summary ? e.body : null,
        erreur: e.livraison?.erreur ?? null,
      });
      continue;
    }
    faits.push({
      id: `evt-${e.id}`,
      sens: e.type === "email_recu" ? "recu" : "note",
      quand: e.occurredAt,
      titre: e.type === "email_recu" ? "Reçu" : e.libelle,
      precisions: [e.authorName],
      texte: e.summary,
      detail: e.body && e.body !== e.summary ? e.body : null,
    });
  }
  for (const r of d.recues) faits.push(faitRecu(r));
  return ordonnerFil(accrocherLiens(faits, d.liens, (rid) => `envoi-${rid}`));
}

// ── Réseau d'apporteurs ─────────────────────────────────────────────────────

export interface ReponseEnvoyeeApporteur {
  readonly id: string;
  readonly repliedAt: Date;
  readonly repliedByName: string;
  readonly subject: string;
  readonly deliveryStatus: string;
  readonly errorMsg: string | null;
  /** Libellé du modèle de départ, s'il y en a un (« Présenter le réseau »). */
  readonly modele: string | null;
  readonly bodyText: string | null;
}

export interface InvitationDuFil {
  readonly id: string;
  readonly le: Date;
  /** `invitation` : le lien de l'échange ; `rappel` : rappel automatique. */
  readonly nature: "invitation" | "rappel";
  readonly statut: string;
}

export interface EchangeDuFil {
  readonly id: string;
  /** Quand la personne a réservé. */
  readonly reserveLe: Date;
  /** L'heure de l'échange, si Calendly l'a donnée. */
  readonly pour: Date | null;
  readonly annule: boolean;
  /** Le suivi noté après l'échange, s'il existe. */
  readonly suivi: {
    readonly le: Date;
    readonly issue: "eu_lieu" | "absent" | "reporte";
    readonly decision: "retenu" | "a_revoir" | "non_retenu" | null;
    readonly note: string | null;
  } | null;
}

/** L'issue de l'échange, dans le vocabulaire du réseau (cf. L8a). */
const DECISION_RESEAU: Readonly<Record<string, string>> = {
  retenu: "On poursuit",
  a_revoir: "À revoir",
  non_retenu: "Sans suite",
};
const ISSUE_RESEAU: Readonly<Record<string, string>> = {
  eu_lieu: "Échange fait",
  absent: "Absent à l'échange",
  reporte: "Échange reporté",
};

function heure(d: Date): string {
  return d
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    .replace(":", " h ");
}

export function faitsApporteur(d: {
  readonly envoyees: ReadonlyArray<ReponseEnvoyeeApporteur>;
  readonly recues: ReadonlyArray<ReponseRecueDuFil>;
  readonly invitations: ReadonlyArray<InvitationDuFil>;
  readonly echanges: ReadonlyArray<EchangeDuFil>;
  readonly liens: ReadonlyArray<LienDuFil>;
}): FaitFil[] {
  const faits: FaitFil[] = [];
  for (const r of d.envoyees) {
    faits.push({
      id: `envoi-${r.id}`,
      sens: "envoye",
      quand: r.repliedAt,
      titre: r.modele ? `Envoyé · ${r.modele}` : "Envoyé",
      precisions: [r.repliedByName],
      badge: badgeLivraison(r.deliveryStatus),
      texte: r.subject,
      detail: r.bodyText,
      erreur: r.errorMsg,
    });
  }
  for (const r of d.recues) faits.push(faitRecu(r));
  for (const i of d.invitations) {
    faits.push({
      id: `invit-${i.id}`,
      sens: "envoye",
      quand: i.le,
      titre:
        i.nature === "invitation"
          ? "Envoyé · Invitation à l'échange"
          : "Envoyé · Rappel automatique",
      precisions: [],
      badge:
        i.statut === "a_valider"
          ? { libelle: "à valider", ton: "warning" }
          : badgeLivraison(i.statut),
    });
  }
  for (const e of d.echanges) {
    faits.push({
      id: `echange-${e.id}`,
      sens: "note",
      quand: e.reserveLe,
      titre: e.annule ? "Échange de 15 minutes annulé" : "Échange de 15 minutes réservé",
      precisions: e.pour ? [`pour le ${jourMois(e.pour)} à ${heure(e.pour)}`] : [],
    });
    if (e.suivi) {
      const decision = e.suivi.decision ? DECISION_RESEAU[e.suivi.decision] : null;
      faits.push({
        id: `suivi-${e.id}`,
        sens: "note",
        quand: e.suivi.le,
        titre: ISSUE_RESEAU[e.suivi.issue] ?? "Échange",
        precisions: decision ? [decision] : [],
        texte: e.suivi.note,
      });
    }
  }
  return ordonnerFil(accrocherLiens(faits, d.liens, (rid) => `envoi-${rid}`));
}
