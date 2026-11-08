/**
 * Présentation d'une offre à formules au signataire — PUR.
 *
 * Tout montant est formaté ICI, côté serveur, à partir de l'offre figée : le navigateur n'en
 * calcule aucun. Vocabulaire du client : « Formule A · Achat » et « Formule B · Mise en place +
 * abonnement » (jamais « token », ni unité d'IA, ni prix fournisseur).
 */
import { prixMensuelNet, prixPeriode, totauxFormule, type ChoixCanonique } from "./offre-calculs";
import type { Formule, OffreDevisV1 } from "./offre-devis";

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export const LIBELLE_FORMULE: Record<Formule, string> = {
  achat: "Formule A · Achat",
  abonnement: "Formule B · Mise en place + abonnement",
};

export interface FormuleAffichee {
  readonly formule: Formule;
  readonly libelle: string;
  /** Partie ponctuelle de base (automatisations obligatoires comprises, facultatives exclues). */
  readonly baseHtLisible: string;
  readonly baseTtcLisible: string;
  readonly lignes: readonly { libelle: string; quantite: number; prixLisible: string }[];
  readonly maintenance: {
    readonly regle: "obligatoire" | "facultative";
    readonly mensuelLisible: string;
    readonly periodes: readonly { mois: number; libelle: string }[];
  } | null;
  readonly abonnement: {
    readonly mensuelLisible: string;
    readonly engagementMois: number;
    readonly periodes: readonly { mois: number; libelle: string }[];
  } | null;
}

export interface AutomatisationAffichee {
  readonly code: string;
  readonly libelle: string;
  readonly facultative: boolean;
  readonly dependDe: readonly string[];
  readonly dependDeLibelles: readonly string[];
  readonly prixHtLisible: string;
}

export interface OffreAffichee {
  readonly formules: readonly FormuleAffichee[];
  readonly automatisations: readonly AutomatisationAffichee[];
  readonly textes: readonly string[];
  readonly garantieJours: number | null;
}

function libellePeriode(mois: number, remiseBps: number | null, mensuelNetCents: number): string {
  const duree = mois === 12 ? "12 mois (1 an)" : `${mois} mois`;
  const remise =
    remiseBps !== null && remiseBps > 0
      ? ` — remise de ${(remiseBps / 100).toLocaleString("fr-FR")} %`
      : "";
  return `${duree} d'avance : ${eur(mensuelNetCents)} HT / mois${remise}`;
}

export function presenterOffre(offre: OffreDevisV1): OffreAffichee {
  const obligatoires = offre.automatisations.filter((a) => !a.facultative).map((a) => a.code);
  const libelles = new Map(offre.automatisations.map((a) => [a.code, a.libelle]));

  const formules: FormuleAffichee[] = offre.formulesProposees.map((formule) => {
    const t = totauxFormule(offre, formule, obligatoires);
    const lignes =
      formule === "achat"
        ? (offre.achat?.lignes ?? [])
        : (offre.abonnement?.miseEnServiceLignes ?? []);
    return {
      formule,
      libelle: LIBELLE_FORMULE[formule],
      baseHtLisible: eur(t.totalHtCents),
      baseTtcLisible: eur(t.totalTtcCents),
      lignes: lignes.map((l) => ({
        libelle: l.libelle,
        quantite: l.quantite,
        prixLisible: `${eur(l.prixHtCents)} HT`,
      })),
      maintenance:
        formule === "achat" && offre.achat
          ? {
              regle: offre.achat.maintenance.regle,
              mensuelLisible: `${eur(offre.achat.maintenance.mensuelHtCents)} HT / mois`,
              periodes: offre.achat.maintenance.periodesMois.map((mois) => ({
                mois,
                libelle: libellePeriode(mois, null, offre.achat!.maintenance.mensuelHtCents),
              })),
            }
          : null,
      abonnement:
        formule === "abonnement" && offre.abonnement
          ? {
              mensuelLisible: `${eur(offre.abonnement.mensuelCatalogueHtCents)} HT / mois`,
              engagementMois: offre.abonnement.engagementMois,
              periodes: offre.abonnement.periodes.map((p) => ({
                mois: p.mois,
                libelle: libellePeriode(
                  p.mois,
                  p.remiseBps,
                  prixMensuelNet(offre.abonnement!.mensuelCatalogueHtCents, p.remiseBps),
                ),
              })),
            }
          : null,
    };
  });

  return {
    formules,
    automatisations: offre.automatisations.map((a) => ({
      code: a.code,
      libelle: a.libelle,
      facultative: a.facultative,
      dependDe: a.dependDe,
      dependDeLibelles: a.dependDe.map((c) => libelles.get(c) ?? c),
      prixHtLisible: `${eur(a.prixHtCents)} HT`,
    })),
    textes: offre.textes.filter((t) => t.actif).map((t) => t.texte),
    garantieJours: offre.garantie.jours,
  };
}

export interface RecapChoix {
  readonly formuleLibelle: string;
  readonly automatisations: readonly string[];
  readonly totalPonctuelHtLisible: string;
  readonly totalPonctuelTtcLisible: string;
  /** Une ligne par poste récurrent retenu (abonnement, maintenance). */
  readonly recurrent: readonly string[];
}

/** Ce que le client s'apprête à signer, calculé sur le choix déjà validé. */
export function recapitulerChoix(offre: OffreDevisV1, choix: ChoixCanonique): RecapChoix {
  const t = totauxFormule(offre, choix.formule, choix.automatisationsRetenues);
  const libelles = new Map(offre.automatisations.map((a) => [a.code, a.libelle]));
  const recurrent: string[] = [];

  if (choix.formule === "abonnement" && offre.abonnement && choix.periodiciteMois !== null) {
    const a = offre.abonnement;
    const periode = a.periodes.find((p) => p.mois === choix.periodiciteMois);
    if (periode !== undefined) {
      const net = prixMensuelNet(a.mensuelCatalogueHtCents, periode.remiseBps);
      recurrent.push(
        `Abonnement : ${eur(net)} HT / mois, payé ${periode.mois} mois d'avance ` +
          `(${eur(prixPeriode(a.mensuelCatalogueHtCents, periode.remiseBps, periode.mois))} HT par période de ${periode.mois} mois)`,
      );
    }
  }
  if (
    choix.formule === "achat" &&
    offre.achat &&
    choix.maintenanceRetenue &&
    choix.periodiciteMois !== null
  ) {
    const m = offre.achat.maintenance;
    recurrent.push(
      `Maintenance : ${eur(m.mensuelHtCents)} HT / mois, payée ${choix.periodiciteMois} mois d'avance`,
    );
  }

  return {
    formuleLibelle: LIBELLE_FORMULE[choix.formule],
    automatisations: choix.automatisationsRetenues.map((c) => libelles.get(c) ?? c),
    totalPonctuelHtLisible: eur(t.totalHtCents),
    totalPonctuelTtcLisible: eur(t.totalTtcCents),
    recurrent,
  };
}
