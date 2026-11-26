/**
 * Un rendez-vous ANNULÉ, ABSENT ou REPORTÉ n'a pas eu lieu : il ne valide jamais une entreprise
 * (règle du dirigeant). Seuls le STATUT et la date de TENUE sont lus ici : la date de PRISE vient
 * de la proposition (lot 5, `invitee.created_at`), jamais de `capturedAt`. Une seule définition, partagée par le rapprochement (lot 5), la console
 * et la validation (lot 6), qui la REJOUE dans sa transaction sur l'état lu à la source.
 *
 *   · `CalendlyEvent.status` : `canceled` | `no_show` (marqués à la main) ;
 *   · `Rencontre.statut`     : `annule` | `absent` | `reporte`.
 */

export const STATUTS_CALENDLY_ECARTES: readonly string[] = ["canceled", "no_show"];
export const STATUTS_RENCONTRE_ECARTES: readonly string[] = ["annule", "absent", "reporte"];

export interface EtatSourceRendezVous {
  calendlyStatus?: string | null | undefined;
  rencontreStatut?: string | null | undefined;
}

export function rendezVousNonTenu(s: EtatSourceRendezVous): boolean {
  return (
    (!!s.calendlyStatus && STATUTS_CALENDLY_ECARTES.includes(s.calendlyStatus)) ||
    (!!s.rencontreStatut && STATUTS_RENCONTRE_ECARTES.includes(s.rencontreStatut))
  );
}

export interface SourceRendezVous extends EtatSourceRendezVous {
  /** Date de TENUE lue À LA SOURCE (jamais celle recopiée dans la proposition). */
  tenuAt: Date | null;
}

/**
 * Date et heure telles que la console les affiche (Europe/Paris) : le message d'un refus doit
 * permettre de retrouver la ligne à l'identique.
 */
export function heureConsole(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

interface LecteurSources {
  calendlyEvent: {
    findUnique(a: unknown): Promise<{
      status: string;
      startTime: Date | null;
      rencontre: { statut: string | null; debutReel: Date | null; debutPrevu: Date | null } | null;
    } | null>;
  };
  rencontre: {
    findUnique(a: unknown): Promise<{
      statut: string | null;
      debutReel: Date | null;
      debutPrevu: Date | null;
    } | null>;
  };
}

/** Lit l'état ACTUEL du rendez-vous désigné par « calendly:<id> » / « rencontre:<id> » (`null` : introuvable). */
export async function lireSourceRendezVous(
  client: unknown,
  cle: string,
): Promise<SourceRendezVous | null> {
  const db = client as LecteurSources;
  const i = cle.indexOf(":");
  const type = cle.slice(0, i);
  const id = cle.slice(i + 1);
  if (!id) return null;
  if (type === "calendly") {
    const ev = await db.calendlyEvent.findUnique({
      where: { id },
      select: {
        status: true,
        startTime: true,
        rencontre: { select: { statut: true, debutReel: true, debutPrevu: true } },
      },
    });
    if (!ev) return null;
    return {
      calendlyStatus: ev.status,
      rencontreStatut: ev.rencontre?.statut ?? null,
      tenuAt: ev.startTime ?? ev.rencontre?.debutReel ?? ev.rencontre?.debutPrevu ?? null,
    };
  }
  if (type === "rencontre") {
    const r = await db.rencontre.findUnique({
      where: { id },
      select: { statut: true, debutReel: true, debutPrevu: true },
    });
    if (!r) return null;
    return {
      rencontreStatut: r.statut,
      tenuAt: r.debutReel ?? r.debutPrevu,
    };
  }
  return null;
}
