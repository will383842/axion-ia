/**
 * Qualiopi — CE QU'EST la cible d'une alerte, en toutes lettres.
 *
 * ## 🔴 Le défaut
 *
 * L'écran des alertes affichait, sous chaque message :
 *
 *     Cible : TrainingSession — 0d4e0c8b-3aaa-4f1e-9c77-1b2d3e4f5a6b
 *
 * Un nom de classe et un UUID. Le LIEN, lui, avait déjà été réparé — six des
 * quinze types de cibles ont un écran de détail, et `lien-cible.ts` y mène. Mais
 * personne ne lit un UUID : pour savoir DE QUI ou DE QUOI parle l'alerte, il
 * fallait cliquer, attendre l'écran, puis revenir. Sur une liste de vingt
 * alertes, cela fait vingt allers-retours pour trier ce qui est urgent.
 *
 * ⚠️ Et le même texte brut partait dans l'E-MAIL d'alerte interne — où il n'y a
 * même pas d'écran où cliquer.
 *
 * ## 🔑 « Trainer » NE SE TRADUIT PLUS PAR « FORMATEUR »
 *
 * Depuis que l'organisme embauche hors formation (secrétaire, marketing,
 * développeur), le modèle `Trainer` porte des gens qui n'animent rien. Écrire
 * « Formateur : Camille Martin » sur l'alerte de remise de son CDD affirmerait
 * d'elle un métier qui n'est pas le sien — exactement le défaut que le lot
 * précédent a corrigé dans l'e-mail de contrat. Le mot retenu est « Personne ».
 *
 * ## ⚠️ UNE CIBLE INTROUVABLE LE DIT — elle ne disparaît pas
 *
 * Si l'entité a été supprimée, l'alerte reste vraie et son libellé doit le
 * montrer. Le taire laisserait une alerte sans sujet, qu'on ne peut ni
 * comprendre ni fermer.
 */

import { prisma } from "@/lib/prisma";

/**
 * Le mot qu'on emploie pour chaque type, quand il faut nommer la NATURE de la
 * cible plutôt que son contenu.
 *
 * ⚠️ Ce sont les mots de l'utilisateur, pas ceux du schéma. Un opérateur ne
 * cherche pas un « TrainerStatement », il cherche un relevé de rémunération.
 */
export const NOM_TYPE_CIBLE: Readonly<Record<string, string>> = {
  TrainingSession: "Session",
  // 🔑 Surtout pas « Formateur » — cf. l'en-tête de ce module.
  Trainer: "Personne",
  Enrollment: "Inscription",
  Devis: "Devis",
  TrainerStatement: "Relevé de rémunération",
  FactureFormation: "Facture",
  DossierFinancement: "Dossier de financement",
  DocumentGenere: "Pièce",
  SousTraitant: "Sous-traitant",
  RgpdDemande: "Demande RGPD",
  Reclamation: "Réclamation",
  OffreSite: "Offre d'emploi",
  Formation: "Formation",
  EmailOutbox: "E-mail",
  BaremeOpco: "Barème OPCO",
};

/** Clé d'un couple (type, identifiant) dans la table des libellés résolus. */
export function cleCible(cibleType: string, cibleId: string): string {
  return `${cibleType}::${cibleId}`;
}

/** Ce qu'une alerte désigne, tel qu'il est stocké. */
export interface CibleDemandee {
  readonly cibleType: string | null;
  readonly cibleId: string | null;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const jourFr = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeZone: "Europe/Paris",
});

function joindre(...morceaux: readonly (string | null | undefined)[]): string {
  return morceaux
    .map((m) => (typeof m === "string" ? m.trim() : ""))
    .filter((m) => m !== "")
    .join(" — ");
}

/**
 * Résout en UNE passe les libellés de toutes les cibles demandées.
 *
 * ⚠️ UNE REQUÊTE PAR TYPE PRÉSENT, jamais une par alerte. Un écran qui porte
 * quarante alertes sur trois types fait trois requêtes, pas quarante — et la
 * différence n'est pas théorique : cet écran a déjà planté à l'hydratation une
 * fois, c'est le dernier endroit où ajouter quarante allers-retours.
 *
 * 🔑 Stub-safe : au build (`stub.invalid`) comme sur une panne, on rend une
 * table VIDE. L'affichage retombe alors sur le nom du type, qui reste juste —
 * jamais sur un UUID.
 */
export async function libellesDesCibles(
  cibles: readonly CibleDemandee[],
): Promise<ReadonlyMap<string, string>> {
  const parType = new Map<string, Set<string>>();
  for (const c of cibles) {
    if (typeof c.cibleType !== "string" || typeof c.cibleId !== "string") continue;
    if (c.cibleType === "" || c.cibleId === "") continue;
    const s = parType.get(c.cibleType) ?? new Set<string>();
    s.add(c.cibleId);
    parType.set(c.cibleType, s);
  }

  const resolus = new Map<string, string>();
  const poser = (type: string, id: string, libelle: string): void => {
    const t = libelle.trim();
    if (t !== "") resolus.set(cleCible(type, id), t);
  };

  await Promise.all(
    [...parType.entries()].map(async ([type, ids]) => {
      const liste = [...ids];
      try {
        switch (type) {
          case "TrainingSession": {
            const rows = await prisma.trainingSession.findMany({
              where: { id: { in: liste } },
              select: { id: true, numero: true, titreSession: true, dateDebut: true },
            });
            for (const r of rows) {
              poser(type, r.id, joindre(r.titreSession, jourFr.format(r.dateDebut), r.numero));
            }
            break;
          }
          case "Trainer": {
            const rows = await prisma.trainer.findMany({
              where: { id: { in: liste } },
              select: { id: true, nom: true, prenom: true, contratPoste: true },
            });
            for (const r of rows) {
              poser(type, r.id, joindre(`${r.prenom} ${r.nom}`, r.contratPoste));
            }
            break;
          }
          case "Enrollment": {
            const rows = await prisma.enrollment.findMany({
              where: { id: { in: liste } },
              select: {
                id: true,
                trainee: { select: { nom: true, prenom: true } },
                session: { select: { titreSession: true } },
              },
            });
            for (const r of rows) {
              poser(
                type,
                r.id,
                joindre(
                  r.trainee === null ? null : `${r.trainee.prenom} ${r.trainee.nom}`,
                  r.session?.titreSession ?? null,
                ),
              );
            }
            break;
          }
          case "Devis": {
            const rows = await prisma.devis.findMany({
              where: { id: { in: liste } },
              select: { id: true, numero: true },
            });
            for (const r of rows) poser(type, r.id, r.numero);
            break;
          }
          case "TrainerStatement": {
            const rows = await prisma.trainerStatement.findMany({
              where: { id: { in: liste } },
              select: {
                id: true,
                periodeYear: true,
                periodeMonth: true,
                trainer: { select: { nom: true, prenom: true } },
              },
            });
            for (const r of rows) {
              const mois = MOIS[r.periodeMonth - 1] ?? String(r.periodeMonth);
              poser(
                type,
                r.id,
                joindre(
                  r.trainer === null ? null : `${r.trainer.prenom} ${r.trainer.nom}`,
                  `${mois} ${r.periodeYear}`,
                ),
              );
            }
            break;
          }
          case "FactureFormation": {
            const rows = await prisma.factureFormation.findMany({
              where: { id: { in: liste } },
              select: { id: true, numero: true },
            });
            for (const r of rows) poser(type, r.id, r.numero);
            break;
          }
          case "DossierFinancement": {
            const rows = await prisma.dossierFinancement.findMany({
              where: { id: { in: liste } },
              select: { id: true, financeurNom: true, numeroDossierExterne: true },
            });
            for (const r of rows) {
              poser(type, r.id, joindre(r.financeurNom, r.numeroDossierExterne));
            }
            break;
          }
          case "DocumentGenere": {
            const rows = await prisma.documentGenere.findMany({
              where: { id: { in: liste } },
              select: { id: true, numero: true },
            });
            for (const r of rows) poser(type, r.id, r.numero);
            break;
          }
          case "SousTraitant": {
            const rows = await prisma.sousTraitant.findMany({
              where: { id: { in: liste } },
              select: { id: true, nom: true },
            });
            for (const r of rows) poser(type, r.id, r.nom);
            break;
          }
          case "RgpdDemande": {
            const rows = await prisma.rgpdDemande.findMany({
              where: { id: { in: liste } },
              select: {
                id: true,
                type: true,
                trainee: { select: { nom: true, prenom: true } },
              },
            });
            for (const r of rows) {
              poser(
                type,
                r.id,
                joindre(
                  r.trainee === null ? null : `${r.trainee.prenom} ${r.trainee.nom}`,
                  String(r.type),
                ),
              );
            }
            break;
          }
          case "Reclamation": {
            const rows = await prisma.reclamation.findMany({
              where: { id: { in: liste } },
              select: { id: true, numero: true, objet: true },
            });
            for (const r of rows) poser(type, r.id, joindre(r.objet, r.numero));
            break;
          }
          case "OffreSite": {
            const rows = await prisma.offreSite.findMany({
              where: { id: { in: liste } },
              select: { id: true, slug: true },
            });
            for (const r of rows) poser(type, r.id, r.slug);
            break;
          }
          case "Formation": {
            const rows = await prisma.formation.findMany({
              where: { id: { in: liste } },
              select: { id: true, titre: true, numero: true },
            });
            for (const r of rows) poser(type, r.id, joindre(r.titre, r.numero));
            break;
          }
          case "EmailOutbox": {
            const rows = await prisma.emailOutbox.findMany({
              where: { id: { in: liste } },
              select: { id: true, sujet: true },
            });
            for (const r of rows) poser(type, r.id, r.sujet);
            break;
          }
          case "BaremeOpco": {
            const rows = await prisma.baremeOpco.findMany({
              where: { id: { in: liste } },
              select: { id: true, opco: true },
            });
            for (const r of rows) poser(type, r.id, String(r.opco));
            break;
          }
          default:
            // Type inconnu de ce module : l'affichage retombe sur le type brut,
            // ce qui reste juste. Ajouter un `case` ici est une ligne.
            break;
        }
      } catch {
        // Stub de build ou panne : on n'ajoute rien. L'affichage nomme le type,
        // et ne montre JAMAIS un UUID.
      }
    }),
  );

  return resolus;
}

/**
 * Le texte à afficher pour une cible — module PUR, testable sans base.
 *
 * ⛔ IL NE REND JAMAIS UN UUID NU. C'est toute la raison d'être de ce module :
 * un identifiant technique n'apprend rien à qui lit, et il occupe la place de ce
 * qui l'aurait appris.
 */
export function texteCible(
  cibleType: string | null | undefined,
  cibleId: string | null | undefined,
  resolus: ReadonlyMap<string, string>,
): string | null {
  if (typeof cibleType !== "string" || cibleType.trim() === "") return null;
  const nomType = NOM_TYPE_CIBLE[cibleType] ?? cibleType;
  if (typeof cibleId !== "string" || cibleId.trim() === "") return nomType;
  const libelle = resolus.get(cleCible(cibleType, cibleId));
  if (libelle !== undefined) return `${nomType} : ${libelle}`;
  /*
    ⚠️ NON RÉSOLU — et les deux causes méritent le même texte.

    Soit l'entité a été supprimée (l'alerte reste vraie et doit rester
    compréhensible), soit la base n'a pas répondu. Dans les deux cas, nommer le
    type sans prétendre connaître le contenu est la seule chose honnête.

    🔑 On ne recolle PAS l'UUID « au cas où » : ce serait revenir au défaut, avec
    une justification. Le lien, quand il existe, porte déjà l'identifiant.
  */
  return `${nomType} (non retrouvée)`;
}
