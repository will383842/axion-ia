/**
 * Assistant de devis — aperçu serveur → vue de l'écran (fiche E17a). PUR, client-safe.
 *
 * `ApercuAssistant` (S07) + `Numerotation` (S08) → `ApercuPrepare` attendu par `EtapeEnvoi`.
 * AUCUN calcul : les centimes du serveur sont RECOPIÉS (jamais additionnés, répartis ni arrondis).
 * Seuls le formatage de la date et les libellés sont produits ici. Imports de types seulement
 * côté serveur (`vue-formules` tire `node:crypto`, interdit dans le navigateur).
 */
import type { ApercuAssistant } from "@/server/qualiopi/devis/assistant/apercu";
import type { VueFormule, VueServiceTiers } from "@/server/qualiopi/devis/vue-formules";
import type { ApercuPrepare } from "./etapes/envoi/EtapeEnvoi";
import type { VueApercuDevis } from "./etapes/envoi/ApercuDevis";

/** Ce que renvoie `numeroterDevisAssistantAction` (forme de `data`). */
export interface Numerotation {
  devisId: string;
  numero: string;
  devisMajLe: string;
  revision: number;
  aRenumeroter?: true;
}

export interface ContexteVueApercu {
  clientNom: string;
  /** Date de validité ISO (AAAA-MM-JJ) choisie à l'écran. */
  validite: string;
  /** « Résultat visé » saisi ; vide = pas de bloc « Votre objectif ». */
  objectif: string;
  /** Version des CGV en vigueur, lue en configuration par la page (jamais écrite en dur). */
  versionCgv: string;
  /** Livrables saisis à l'écran, par formule et par rang (information, sans montant). */
  livrables?: { A?: readonly string[]; B?: readonly string[] };
}

export function urlApercuPdf(devisId: string): string {
  return `/api/qualiopi/devis/${devisId}/apercu`;
}

const MOIS_FR = [
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

/** « 2026-12-08 » → « 8 décembre 2026 » ; illisible = texte tel quel. */
export function libelleDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const mois = m ? MOIS_FR[Number(m[2]) - 1] : undefined;
  return m && mois ? `${Number(m[3])} ${mois} ${m[1]}` : iso;
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const RYTHMES: Readonly<Record<string, string>> = {
  ponctuel: "ponctuel",
  mensuel: "par mois",
  annuel: "par an",
};

function service(s: VueServiceTiers): VueApercuDevis["servicesExterieurs"][number] {
  const rythme = RYTHMES[s.rythme] ?? s.rythme;
  return {
    nom: s.nom,
    obligatoire: s.obligatoire,
    estimation:
      s.estimationHtCents === null
        ? "selon l'offre du fournisseur"
        : `${EUROS.format(s.estimationHtCents / 100)} HT, ${rythme}`,
  };
}

function cle(f: VueFormule): "A" | "B" {
  return f.formule === "achat" ? "A" : "B";
}

/** Lignes d'une formule : celles du serveur, puis ses montants récurrents tels quels. */
function lignesFormule(f: VueFormule): VueApercuDevis["formules"][number]["lignes"] {
  const lignes = f.lignes.map((l) => ({ libelle: l.designation, montantHtCents: l.totalHtCents }));
  if (f.maintenance)
    lignes.push({
      libelle: `Maintenance (par mois${f.maintenance.moisOfferts > 0 ? `, ${f.maintenance.moisOfferts} mois offerts` : ""})`,
      montantHtCents: f.maintenance.mensuelHtCents,
    });
  if (f.hebergementMensuelHtCents !== null)
    lignes.push({
      libelle: "Hébergement chez Axion-IA (par mois)",
      montantHtCents: f.hebergementMensuelHtCents,
    });
  if (f.abonnement) {
    lignes.push({
      libelle: "Abonnement (par mois, tarif catalogue)",
      montantHtCents: f.abonnement.mensuelCatalogueHtCents,
    });
    // Périodes remisées : le mensuel net du serveur, recopié.
    for (const p of f.abonnement.periodes)
      if (p.remisePercent > 0)
        lignes.push({
          libelle: `Abonnement remisé de ${p.remisePercent} % (${p.mois} mois, par mois)`,
          montantHtCents: p.mensuelNetHtCents,
        });
  }
  // `totalHtCents` du serveur ne compte QUE la mise en place (pas les mensuels ci-dessus).
  lignes.push({ libelle: "Mise en place hors taxes", montantHtCents: f.totalHtCents });
  return lignes;
}

export type ResultatVue = { ok: true; prepare: ApercuPrepare } | { ok: false; erreur: string };

export function versApercuPrepare(
  apercu: ApercuAssistant,
  num: Numerotation,
  ctx: ContexteVueApercu,
): ResultatVue {
  if (apercu.erreurs.length > 0) {
    return {
      ok: false,
      erreur: apercu.erreurs
        .slice(0, 3)
        .map((e) => e.message)
        .join(" "),
    };
  }
  const base = {
    numero: num.numero,
    clientNom: ctx.clientNom,
    validiteLibelle: libelleDate(ctx.validite),
    objectif: ctx.objectif.trim() === "" ? null : ctx.objectif,
    mentionTva: apercu.mentionTva,
    versionCgv: ctx.versionCgv,
  };
  let vue: VueApercuDevis;
  if (apercu.classique) {
    const t = apercu.classique.totaux;
    vue = {
      ...base,
      lignes: apercu.classique.lignes.map((l) => ({
        libelle: l.designation,
        totalHtCents: l.totalHtCents,
      })),
      totalHtCents: t.totalHtCents,
      tvaCents: t.totalTvaCents,
      totalTtcCents: t.totalTtcCents,
      phases: [],
      formules: [],
      servicesExterieurs: [],
    };
  } else if (apercu.formules) {
    const formules = apercu.formules.formules;
    // Une seule formule : son détail est AUSSI le détail global. Deux formules : le total dépend
    // du choix du client, donc aucun total global n'est recopié (zéros) et l'aperçu MASQUE le
    // bloc de totaux globaux (`formules.length > 1`) ; chaque formule porte les siens.
    const seule = formules.length === 1 ? formules[0] : undefined;
    vue = {
      ...base,
      lignes: seule
        ? seule.lignes.map((l) => ({ libelle: l.designation, totalHtCents: l.totalHtCents }))
        : [],
      totalHtCents: seule?.totalHtCents ?? 0,
      tvaCents: seule?.totalTvaCents ?? 0,
      totalTtcCents: seule?.totalTtcCents ?? 0,
      // Montants de phase du serveur : HT, donc nommés comme tels (aucune TVA recalculée ici).
      phases: seule
        ? seule.phases.map((p) => ({
            rang: p.rang,
            libelle: `${p.libelle} (HT)`,
            livrable: ctx.livrables?.[cle(seule)]?.[p.rang - 1] ?? "",
            pourcentage: p.pourcentage,
            montantCents: p.montantHtCents,
          }))
        : [],
      formules: formules.map((f) => ({
        cle: cle(f),
        titre: f.titre.replace(/^Formule [AB] · /, ""),
        lignes: lignesFormule(f),
        totalTvaCents: f.totalTvaCents,
        totalTtcCents: f.totalTtcCents,
      })),
      plafondAConfirmer: apercu.formules.plafondAConfirmer,
      servicesExterieurs: apercu.formules.servicesTiers.map(service),
    };
  } else {
    return { ok: false, erreur: "L'aperçu du serveur est vide : réessayez." };
  }
  return {
    ok: true,
    prepare: {
      devisId: num.devisId,
      numero: num.numero,
      majLe: num.devisMajLe,
      apercuPdfUrl: urlApercuPdf(num.devisId),
      vue,
    },
  };
}
