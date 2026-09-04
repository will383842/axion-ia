/**
 * LES CAMPAGNES QUI ONT RÉELLEMENT AMENÉ QUELQU'UN — lecture.
 *
 * ## Pourquoi lire les candidatures plutôt qu'une table de liens
 *
 * L'écran de fabrication des liens (`lib/campagnes/lien-campagne.ts`) ne
 * stocke rien : un lien est entièrement redérivé de quatre choix. Reste la
 * question que Will a posée — « où vais-je retrouver ce lien ? ».
 *
 * La réponse honnête n'est pas « dans la liste de ceux que tu as créés » : une
 * telle liste contiendrait surtout des liens jamais diffusés, et manquerait
 * ceux collés à la main dans le gestionnaire de publicités. Elle mentirait dans
 * les deux sens.
 *
 * On lit donc ce qui EST ARRIVÉ : les valeurs d'UTM portées par les
 * candidatures. Une campagne qui figure ici a amené quelqu'un ; une campagne
 * absente n'a rien amené — et c'est une information, pas un oubli.
 *
 * ## Ce module n'est PAS `"use server"`
 *
 * Chaque export d'un module `"use server"` devient un point d'entrée réseau.
 * Une lecture nue qui y vivrait serait appelable depuis l'extérieur, et la
 * garde de rôle de la page ne la protégerait pas. Même doctrine que
 * `admin-job-applications/reads.ts`.
 */

import { prisma } from "@/lib/prisma";

export interface CampagneVue {
  source: string;
  medium: string | null;
  campagne: string | null;
  visuel: string | null;
  /** Nombre de candidatures arrivées avec exactement ces valeurs. */
  arrivees: number;
  /** La plus récente, pour distinguer une campagne vivante d'une campagne finie. */
  derniereArrivee: Date;
}

/** Forme de `details.funnel.utm`, telle que les Server Actions l'écrivent. */
interface FunnelStocke {
  utm?: {
    utm_source?: unknown;
    utm_medium?: unknown;
    utm_campaign?: unknown;
    utm_content?: unknown;
  };
}

/** Chaîne bornée, ou `null`. Le contenu vient d'une URL publique : il n'est jamais de confiance. */
function texteBorne(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

/**
 * Les campagnes vues, de la plus récente à la plus ancienne.
 *
 * 🔑 L'agrégat est fait EN MÉMOIRE, pas en SQL : `details` est un JSON libre,
 * et un `GROUP BY` sur des chemins JSON imbriqués coûterait un index dédié pour
 * un écran consulté quelques fois par mois. Le plafond de lignes lues borne le
 * coût, et il est DIT à l'écran quand il est atteint — un agrégat tronqué qui
 * ne le dit pas est pire que pas d'agrégat.
 */
export async function lireCampagnesVues(options?: {
  plafond?: number;
  depuisJours?: number;
}): Promise<{ campagnes: CampagneVue[]; plafondAtteint: boolean; lignesLues: number }> {
  const plafond = options?.plafond ?? 5000;
  const depuisJours = options?.depuisJours ?? 365;
  const depuis = new Date(Date.now() - depuisJours * 24 * 60 * 60 * 1000);

  const lignes = await prisma.submission.findMany({
    where: { submittedAt: { gte: depuis } },
    select: { details: true, submittedAt: true },
    orderBy: { submittedAt: "desc" },
    take: plafond,
  });

  const parCle = new Map<string, CampagneVue>();

  for (const ligne of lignes) {
    const details = ligne.details as unknown as { funnel?: FunnelStocke } | null;
    const utm = details?.funnel?.utm;
    const source = texteBorne(utm?.utm_source);
    // Sans source, la ligne n'appartient à aucune campagne : elle est venue
    // autrement (accès direct, référencement naturel). Ce n'est pas une valeur
    // manquante à combler, c'est une absence de campagne.
    if (!source) continue;

    const medium = texteBorne(utm?.utm_medium);
    const campagne = texteBorne(utm?.utm_campaign);
    const visuel = texteBorne(utm?.utm_content);
    const cle = `${source}|${medium ?? ""}|${campagne ?? ""}|${visuel ?? ""}`;

    const existant = parCle.get(cle);
    if (existant) {
      existant.arrivees += 1;
      if (ligne.submittedAt > existant.derniereArrivee)
        existant.derniereArrivee = ligne.submittedAt;
    } else {
      parCle.set(cle, {
        source,
        medium,
        campagne,
        visuel,
        arrivees: 1,
        derniereArrivee: ligne.submittedAt,
      });
    }
  }

  const campagnes = [...parCle.values()].sort(
    (a, b) => b.derniereArrivee.getTime() - a.derniereArrivee.getTime(),
  );

  return { campagnes, plafondAtteint: lignes.length >= plafond, lignesLues: lignes.length };
}
