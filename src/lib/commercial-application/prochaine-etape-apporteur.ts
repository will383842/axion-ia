// LA PROCHAINE ÉTAPE d'un candidat apporteur, en une phrase et UN bouton — le
// bandeau en tête de la fiche (`BandeauProchaineEtape.tsx`).
//
// Aucune règle nouvelle : l'étape vient de `etapeDuSuivi` ; ce module dit
// seulement quoi écrire et quel geste proposer pour chaque étape. Module PUR
// (aucun import serveur) : il se teste sans base.

import type { EtapeSuivi, DossierApporteurResume } from "./etape-suivi-apporteur";
import { libelleMotifSansLien } from "./etape-suivi-apporteur";
import type { SuiviInvitation } from "./relance-invitation";

/** Au-delà de ce nombre de jours sans réponse après l'invitation, on le signale. */
export const JOURS_SANS_NOUVELLES = 14;

export type BoutonProchaineEtape =
  /** Un lien vers un bloc de la même fiche. */
  | { readonly type: "ancre"; readonly libelle: string; readonly href: string }
  /** Un lien vers le dossier apporteur (`/apporteurs/<id>`). */
  | { readonly type: "dossier"; readonly libelle: string }
  /** Le geste qui ouvre le dossier et envoie le contrat (aperçu puis confirmation). */
  | { readonly type: "ouvrir-contrat" };

export interface ProchaineEtape {
  readonly phrase: string;
  readonly bouton: BoutonProchaineEtape | null;
  /** Une alerte orange (« Sans nouvelles depuis 16 jours »), ou `null`. */
  readonly alerte: string | null;
  /** Une réponse du candidat plus récente que la dernière action, ou `null`. */
  readonly reponseLe: Date | null;
}

export const ANCRE_INVITATION = "#invitation";
export const ANCRE_ECHANGE = "#rendez-vous";
export const ANCRE_REPONSES = "#reponses-recues";

const JOUR_MS = 24 * 60 * 60 * 1000;

function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function heure(d: Date): string {
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/** Le jour de la dernière chose que NOUS avons faite pour cette personne. */
export function derniereAction(
  suivi: SuiviInvitation | null,
  dossier: DossierApporteurResume | null,
): Date | null {
  const dates: Date[] = [];
  if (suivi?.invitation) dates.push(suivi.invitation);
  for (const r of suivi?.relances ?? []) dates.push(r);
  const d = suivi?.decision;
  if (d && "le" in d && d.le) dates.push(d.le);
  if (dossier?.contratEnvoyeLe) dates.push(dossier.contratEnvoyeLe);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((x) => x.getTime())));
}

export function prochaineEtape(
  etape: EtapeSuivi,
  ctx: {
    readonly suivi: SuiviInvitation | null;
    readonly dossier: DossierApporteurResume | null;
    /** Administrateur : seul à pouvoir ouvrir le dossier et envoyer le contrat. */
    readonly peutEngager: boolean;
    /** Un échange est rattaché à la fiche (l'action d'ouverture en a besoin). */
    readonly aUnEchange: boolean;
    readonly maintenant: Date;
  },
): ProchaineEtape {
  let phrase: string;
  let bouton: BoutonProchaineEtape | null = null;
  let alerte: string | null = null;

  switch (etape.type) {
    case "candidat":
      phrase = etape.motif
        ? `Pas encore invité à l'échange : ${libelleMotifSansLien(etape.motif)}.`
        : "Pas encore invité à l'échange de 15 minutes.";
      bouton = { type: "ancre", libelle: "Envoyer l'invitation", href: ANCRE_INVITATION };
      break;
    case "lien-envoye": {
      phrase = `Invité le ${jourMois(etape.le)}${etape.annule ? " · échange annulé" : ""}.`;
      const dernier = derniereAction(ctx.suivi, null) ?? etape.le;
      const jours = Math.floor((ctx.maintenant.getTime() - dernier.getTime()) / JOUR_MS);
      if (jours > JOURS_SANS_NOUVELLES) alerte = `Sans nouvelles depuis ${jours} jours`;
      break;
    }
    case "echange-reserve":
      phrase = etape.le
        ? `Échange réservé le ${jourMois(etape.le)} à ${heure(etape.le)}.`
        : "Échange réservé.";
      break;
    case "echange-fait":
      phrase = etape.aRevoir
        ? "Échange à revoir : notez le résultat quand vous avez décidé."
        : "Échange fait : notez le résultat.";
      bouton = { type: "ancre", libelle: "Noter le résultat", href: ANCRE_ECHANGE };
      break;
    case "absent":
      phrase = "Absent à l'échange : notez la suite.";
      bouton = { type: "ancre", libelle: "Noter le résultat", href: ANCRE_ECHANGE };
      break;
    case "retenu-sans-contrat":
      phrase = "Retenu, mais aucun dossier n'est ouvert : le contrat n'est pas parti.";
      if (!ctx.peutEngager) {
        phrase += " Un administrateur doit l'envoyer.";
      } else if (ctx.aUnEchange) {
        bouton = { type: "ouvrir-contrat" };
      } else {
        phrase += " Aucun échange n'est rattaché à cette fiche : rattachez-le d'abord.";
      }
      break;
    case "retenu":
      phrase = "Dossier ouvert, contrat envoyé.";
      bouton = { type: "dossier", libelle: "Voir le dossier apporteur" };
      break;
    case "contrat-envoye":
      phrase = `Contrat envoyé le ${jourMois(etape.le)} : en attente de la signature.`;
      bouton = { type: "dossier", libelle: "Voir le dossier apporteur" };
      break;
    case "dossier-a-completer":
      phrase = "Le dossier est à compléter par la personne.";
      bouton = { type: "dossier", libelle: "Voir le dossier apporteur" };
      break;
    case "dossier-signe":
      phrase = "La personne a signé : le dossier est à vérifier.";
      bouton = { type: "dossier", libelle: "Vérifier et contresigner" };
      break;
    case "contrat-contresigne":
      phrase = etape.le ? `Contrat contresigné le ${jourMois(etape.le)}.` : "Contrat contresigné.";
      break;
    case "contrat-termine":
      phrase = "Contrat terminé.";
      break;
    case "non-retenu":
      phrase = "Non retenu.";
      break;
    case "dossier-refuse":
      phrase = "Dossier refusé.";
      break;
    case "sans-suite":
      phrase = "Fiche classée sans suite.";
      break;
  }

  const derniere = derniereAction(ctx.suivi, ctx.dossier);
  const reponse = ctx.suivi?.reponse ?? null;
  const reponseLe =
    reponse && (!derniere || reponse.getTime() > derniere.getTime()) ? reponse : null;

  return { phrase, bouton, alerte, reponseLe };
}
