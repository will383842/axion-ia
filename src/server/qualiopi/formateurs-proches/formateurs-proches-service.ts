import "server-only";

/**
 * « Formateurs proches » d'une fiche client — lecture (lot L15c, ADR 0066 ;
 * W6 §1 étapes 3 à 10).
 *
 * Point de départ : le lieu de la PROCHAINE session planifiée du client quand
 * il est connu (sinon l'adresse de la fiche client) ; une session à distance
 * rend « la distance ne compte pas ». Tout se résout dans `communes_geo`, en
 * base : aucun appel réseau à l'affichage.
 *
 * Le rôle et l'interrupteur sont jugés par l'APPELANT avant tout appel : hors
 * rôle, rien n'est requêté. Une panne rend `null` (« indisponible »), jamais
 * une liste vide qui ferait croire qu'il n'y a personne.
 */

import { REGIONS } from "@/content/regions";
import { prisma } from "@/lib/prisma";

import {
  classerFormateursProches,
  type Depart,
  type FormateurAClasser,
  type Groupe,
  type Point,
} from "./classer";
import { departementDeCommune } from "./communes-geo";
import { resoudreCodePostal } from "./communes-lecture";
import { statsFormateurs, type LecteurStats } from "./stats-formateurs";

export interface ResultatProches {
  readonly depart: Depart;
  readonly approximatif: boolean;
  readonly groupes: ReadonlyArray<Groupe>;
}

/** Borne de lecture : bien au-delà du nombre de formateurs actifs attendu. */
const PLAFOND_FORMATEURS = 500;

const REGION_PAR_DEPARTEMENT: ReadonlyMap<string, string> = new Map(
  REGIONS.flatMap((r) => r.departements.map((d) => [d, r.slug] as const)),
);
const regionDe = (d: string) => REGION_PAR_DEPARTEMENT.get(d) ?? null;

async function lieuDe(
  codePostal: string | null | undefined,
  ville: string | null | undefined,
): Promise<{ point: Point; nom: string; approximatif: boolean } | null> {
  const r = await resoudreCodePostal(codePostal, ville);
  if (!r) return null;
  const c = r.commune;
  return {
    point: { lat: c.latitude, lon: c.longitude, departement: c.departement },
    nom: `${c.nom} (${c.departement})`,
    approximatif: r.approximatif,
  };
}

export async function lireFormateursProches(
  clientId: string,
  maintenant: Date,
): Promise<ResultatProches | null> {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { adresseCodePostal: true, adresseVille: true, adressePaysCode: true },
    });
    if (!client) return null;

    const session = await prisma.trainingSession.findFirst({
      where: { clientId, statut: "planifiee", dateDebut: { gte: maintenant } },
      orderBy: { dateDebut: "asc" },
      select: {
        numero: true,
        lieuType: true,
        lieuCodePostal: true,
        lieuVille: true,
        modalite: true,
      },
    });

    let depart: Depart = { sorte: "inconnu" };
    let approximatif = false;
    const distanciel =
      session !== null &&
      (session.lieuType === "distanciel" ||
        (session.lieuType === null && session.modalite === "distanciel"));
    if (distanciel) {
      depart = { sorte: "distanciel", libelle: `session ${session!.numero} à distance` };
    } else {
      const lieuSession = session ? await lieuDe(session.lieuCodePostal, session.lieuVille) : null;
      const lieuClient =
        lieuSession === null && (client.adressePaysCode ?? "FR") === "FR"
          ? await lieuDe(client.adresseCodePostal, client.adresseVille)
          : null;
      const lieu = lieuSession ?? lieuClient;
      if (lieu) {
        approximatif = lieu.approximatif;
        depart = {
          sorte: "lieu",
          point: lieu.point,
          libelle: lieuSession
            ? `${lieu.nom} — lieu de la session ${session!.numero}`
            : `${lieu.nom} — adresse de la fiche client`,
        };
      }
    }

    const formateurs = await prisma.trainer.findMany({
      where: { actif: true, finCollaborationAt: null },
      orderBy: { id: "asc" },
      take: PLAFOND_FORMATEURS,
      select: {
        id: true,
        prenom: true,
        nom: true,
        statut: true,
        communeInsee: true,
        geoLat: true,
        geoLng: true,
        regionsIntervention: true,
        interventionFranceEntiere: true,
      },
    });
    const codes = [
      ...new Set(formateurs.map((f) => f.communeInsee).filter((c): c is string => !!c)),
    ];
    const communes = new Map(
      (codes.length
        ? await prisma.communeGeo.findMany({
            where: { codeInsee: { in: codes } },
            select: {
              codeInsee: true,
              nom: true,
              latitude: true,
              longitude: true,
              departement: true,
            },
          })
        : []
      ).map((c) => [c.codeInsee, c]),
    );
    const stats = await statsFormateurs(
      prisma as unknown as LecteurStats,
      formateurs.map((f) => f.id),
      maintenant,
    );

    const aClasser = formateurs.map((f): FormateurAClasser => {
      const commune = f.communeInsee ? communes.get(f.communeInsee) : undefined;
      const departement =
        commune?.departement ?? (f.communeInsee ? departementDeCommune(f.communeInsee) : null);
      const point: Point | null =
        f.geoLat !== null && f.geoLng !== null
          ? { lat: Number(f.geoLat), lon: Number(f.geoLng), departement }
          : commune
            ? { lat: commune.latitude, lon: commune.longitude, departement }
            : null;
      return {
        id: f.id,
        nom: `${f.prenom} ${f.nom}`.trim(),
        statut: f.statut,
        point,
        commune: commune ? `${commune.nom} (${commune.departement})` : null,
        regionsIntervention: f.regionsIntervention,
        franceEntiere: f.interventionFranceEntiere,
        stats: stats.get(f.id) ?? {
          formationsRealisees: 0,
          satisfaction: null,
          derniereFormation: null,
        },
      };
    });

    return { depart, approximatif, groupes: classerFormateursProches(depart, aClasser, regionDe) };
  } catch {
    return null;
  }
}
