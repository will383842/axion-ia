/**
 * Listes de rattachement du formulaire « Nouvelle appréciation ».
 *
 * 🔴 POURQUOI (revue visuelle 2026-08-03). Le formulaire demandait à
 * l'utilisateur de COLLER trois identifiants techniques à la main —
 * « ID stagiaire (UUID, facultatif) », « ID inscription », « ID client », avec
 * `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` en exemple. Personne ne connaît
 * l'UUID d'un stagiaire ; les trois champs restaient donc vides, et
 * l'appréciation ne se rattachait à rien. Un registre Qualiopi dont les
 * entrées ne sont reliées à personne perd l'essentiel de sa valeur de preuve.
 *
 * On sert des libellés lisibles, l'identifiant reste la valeur transmise.
 *
 * Volumes bornés : ce sont les personnes et affaires d'un organisme de
 * formation, pas un catalogue. Le plafond protège d'un rendu déraisonnable si
 * la base grossit — au-delà, il faudra un champ de recherche.
 */

import { prisma } from "@/lib/prisma";

const PLAFOND = 500;

/** Vocabulaire d'écran du statut d'un formateur — la valeur brute est technique. */
const LIBELLE_STATUT_FORMATEUR: Record<string, string> = {
  salarie: "salarié",
  dirigeant: "dirigeant-formateur",
  sous_traitant: "sous-traitant",
};

export interface OptionRattachement {
  id: string;
  libelle: string;
}

export interface OptionsAppreciation {
  stagiaires: OptionRattachement[];
  inscriptions: OptionRattachement[];
  clients: OptionRattachement[];
  /**
   * 🔴 La quatrième liste, absente jusqu'au 2026-09-04. Le formulaire proposait
   * la qualité « Formateur » sans permettre de dire LEQUEL : l'appréciation
   * partait sans auteur, et off.30 la comptait « auteur non établi ». La
   * qualité existait, la personne derrière n'existait pas.
   */
  formateurs: OptionRattachement[];
}

const VIDE: OptionsAppreciation = {
  stagiaires: [],
  inscriptions: [],
  clients: [],
  formateurs: [],
};

/**
 * Les quatre listes, en une passe. Chaque lecture est indépendamment fail-soft :
 * une table indisponible ne doit pas priver le formulaire des autres, ni faire
 * tomber la page.
 */
export async function listerOptionsAppreciation(): Promise<OptionsAppreciation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return VIDE;

  const [stagiaires, inscriptions, clients, formateurs] = await Promise.all([
    prisma.trainee
      .findMany({
        select: { id: true, nom: true, prenom: true, entreprise: true },
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        take: PLAFOND,
      })
      .catch(() => []),
    prisma.enrollment
      .findMany({
        select: {
          id: true,
          trainee: { select: { nom: true, prenom: true } },
          session: { select: { numero: true, titreSession: true } },
        },
        orderBy: { createdAt: "desc" },
        take: PLAFOND,
      })
      .catch(() => []),
    prisma.client
      .findMany({
        select: { id: true, raisonSociale: true, numero: true },
        orderBy: { raisonSociale: "asc" },
        take: PLAFOND,
      })
      .catch(() => []),
    // Seulement les formateurs ACTIFS : une appréciation se recueille auprès de
    // quelqu'un qui intervient, et proposer d'anciens intervenants allongerait
    // la liste de noms qu'on ne choisira jamais.
    prisma.trainer
      .findMany({
        where: { actif: true },
        select: { id: true, nom: true, prenom: true, statut: true },
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        take: PLAFOND,
      })
      .catch(() => []),
  ]);

  return {
    stagiaires: stagiaires.map((t) => ({
      id: t.id,
      libelle: t.entreprise ? `${t.prenom} ${t.nom} — ${t.entreprise}` : `${t.prenom} ${t.nom}`,
    })),
    // Une inscription se reconnaît par QUI est inscrit À QUOI — jamais par son
    // numéro seul, que personne ne retient.
    inscriptions: inscriptions.map((e) => ({
      id: e.id,
      libelle: `${e.trainee.prenom} ${e.trainee.nom} — ${e.session.titreSession} (${e.session.numero})`,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      libelle: `${c.raisonSociale} (${c.numero})`,
    })),
    // Le statut est rendu dans le libellé : un salarié et un sous-traitant ne
    // pèsent pas pareil dans un dossier d'audit, et l'agent doit le voir au
    // moment de choisir — pas après.
    formateurs: formateurs.map((t) => ({
      id: t.id,
      libelle: `${t.prenom} ${t.nom} (${LIBELLE_STATUT_FORMATEUR[t.statut] ?? t.statut})`,
    })),
  };
}
