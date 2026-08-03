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

export interface OptionRattachement {
  id: string;
  libelle: string;
}

export interface OptionsAppreciation {
  stagiaires: OptionRattachement[];
  inscriptions: OptionRattachement[];
  clients: OptionRattachement[];
}

const VIDE: OptionsAppreciation = { stagiaires: [], inscriptions: [], clients: [] };

/**
 * Les trois listes, en une passe. Chaque lecture est indépendamment fail-soft :
 * une table indisponible ne doit pas priver le formulaire des deux autres, ni
 * faire tomber la page.
 */
export async function listerOptionsAppreciation(): Promise<OptionsAppreciation> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return VIDE;

  const [stagiaires, inscriptions, clients] = await Promise.all([
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
  };
}
