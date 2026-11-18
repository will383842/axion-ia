/**
 * Bandeau des 4 tuiles de l'en-tête (lot B1) : Pipeline, Santé du compte, Reste à encaisser,
 * Questionnaire. Server Component. Montants : « X € HT » + TTC dessous (`htEtTtc`). Une lecture
 * en panne dit « Lecture impossible », jamais 0.
 */

import { AlertTriangle, CheckCircle2, ClipboardList, Euro, TrendingUp } from "lucide-react";

import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import type { EnTete } from "@/features/dossier-client/fiche/lire-en-tete";
import { SEUIL_ECHANGE_JOURS } from "@/features/dossier-client/fiche/sante-du-compte";

import { htEtTtc } from "./montants";

const PANNE = "Lecture impossible";

const jour = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  }).format(d);

/** Le reste dû est une somme TTC (avoirs et paiements déduits) : on l'affiche tel quel, sans refaire un HT approximatif. */
const ttcSeul = (cents: number): string =>
  `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
    .format(cents / 100)
    .replace(/[\u202f\u00a0]/g, "\u00a0")}\u00a0€\u00a0TTC`; // price-exempt

const panne = (label: string, icon: typeof Euro): React.ReactElement => (
  <AdminStatCard label={label} value={PANNE} tone="default" icon={icon} />
);

export function TuilesFiche(props: {
  enTete: EnTete;
  ficheHref: string;
  qBase: string;
}): React.ReactElement {
  const { enTete: e, ficheHref } = props;

  const pipeline = e.pipeline.ok
    ? (() => {
        const { ht, ttc } = htEtTtc(e.pipeline.valeur.htCents);
        const chances =
          e.pipeline.valeur.chancesPct === null
            ? "chances non estimées"
            : `${e.pipeline.valeur.chancesPct} % de chances de signer`;
        return (
          <AdminStatCard
            label="Pipeline"
            value={ht}
            meta={`${ttc} · ${chances}`}
            tone="info"
            icon={TrendingUp}
            href={`${ficheHref}?onglet=prestations`}
          />
        );
      })()
    : panne("Pipeline", TrendingUp);

  const sante = e.sante.ok ? (
    e.sante.valeur.niveau === "bonne" ? (
      <AdminStatCard
        label="Santé du compte"
        value="Bonne"
        meta={`Bonne : un échange il y a moins de ${SEUIL_ECHANGE_JOURS} jours, aucun paiement en retard, aucune tâche en retard.`}
        tone="success"
        icon={CheckCircle2}
      />
    ) : (
      <AdminStatCard
        label="Santé du compte"
        value="À surveiller"
        meta={e.sante.valeur.raisons.join(" · ")}
        tone="warning"
        icon={AlertTriangle}
      />
    )
  ) : (
    panne("Santé du compte", AlertTriangle)
  );

  const encours = e.encours.ok ? (
    e.encours.valeur.ttcCents <= 0 ? (
      <AdminStatCard
        label="Reste à encaisser"
        value="Rien à encaisser"
        tone="success"
        icon={CheckCircle2}
        href={`${ficheHref}?onglet=devis-factures`}
      />
    ) : (
      <AdminStatCard
        label="Reste à encaisser"
        value={ttcSeul(e.encours.valeur.ttcCents)}
        {...(e.encours.valeur.avantLe === null
          ? {}
          : {
              meta: `${e.encours.valeur.enRetard ? "en retard depuis le" : "à payer avant le"} ${jour(e.encours.valeur.avantLe)}`,
            })}
        tone="warning"
        icon={Euro}
        href={`${ficheHref}?onglet=devis-factures`}
      />
    )
  ) : (
    panne("Reste à encaisser", Euro)
  );

  const questionnaire = e.questionnaire.ok ? (
    e.questionnaire.valeur === null ? (
      <AdminStatCard label="Questionnaire" value="Pas envoyé" tone="default" icon={ClipboardList} />
    ) : (
      (() => {
        const q = e.questionnaire.valeur;
        const complet = q.attendus !== null && q.attendus > 0 && q.recus >= q.attendus;
        return (
          <AdminStatCard
            label="Questionnaire"
            value={
              q.attendus === null
                ? `${q.recus} reçu${q.recus > 1 ? "s" : ""}`
                : `${q.recus} sur ${q.attendus}`
            }
            {...(complet || q.avantLe === null
              ? {}
              : { meta: `à rendre avant le ${jour(q.avantLe)}` })}
            tone={complet ? "success" : "info"}
            icon={ClipboardList}
            href={`${ficheHref}?onglet=questionnaire`}
          />
        );
      })()
    )
  ) : (
    panne("Questionnaire", ClipboardList)
  );

  return (
    <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
      {pipeline}
      {sante}
      {encours}
      {questionnaire}
    </div>
  );
}
