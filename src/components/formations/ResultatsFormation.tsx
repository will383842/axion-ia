// Server Component — encadré « Nos résultats » d'une fiche formation
// (indicateur 2 du Référentiel national qualité : diffusion des indicateurs de
// résultats). Aucun JS client, aucune image : du HTML rendu au serveur, présent
// dès la première peinture (ISR de la page), donc aucun décalage de mise en page.
//
// Les chiffres viennent EXCLUSIVEMENT de `getResultatsPublicsFormation` (comptes
// lus en base, cf. `src/server/qualiopi/indicateurs/resultats-publics.ts`). Ce
// composant n'en invente ni n'en arrondit aucun : il met en forme.

import type { ReactNode } from "react";

import {
  dateLongueFr,
  libelleEchantillon,
  libellePeriode,
  noteFr,
  type ResultatsPublicsFormation,
} from "@/server/qualiopi/indicateurs/resultats-publics";

interface Tuile {
  readonly label: string;
  readonly valeur: string;
  readonly detail: string;
}

function tuiles(r: ResultatsPublicsFormation): Tuile[] {
  const liste: Tuile[] = [
    {
      label: r.nbSessions > 1 ? "Sessions réalisées" : "Session réalisée",
      valeur: String(r.nbSessions),
      detail: "Sessions menées à leur terme.",
    },
    {
      label: r.nbStagiaires > 1 ? "Stagiaires formés" : "Stagiaire formé",
      valeur: String(r.nbStagiaires),
      detail: "Hors abandons et exclusions.",
    },
  ];
  if (r.satisfaction) {
    const n = r.satisfaction.nbReponses;
    liste.push({
      label: "Satisfaction moyenne",
      valeur: `${noteFr(r.satisfaction.moyenneSur5)}/5`,
      detail: `${n} ${n > 1 ? "réponses" : "réponse"} au questionnaire de fin de formation.`,
    });
  }
  if (r.assiduite) {
    const a = r.assiduite.nbAssidus;
    liste.push({
      label: "Assiduité",
      valeur: `${a} sur ${r.nbStagiaires}`,
      detail: `${a > 1 ? "ont" : "a"} suivi au moins ${r.assiduite.seuilPct} % de la formation.`,
    });
  }
  return liste;
}

export function ResultatsFormation({
  resultats: r,
}: {
  resultats: ResultatsPublicsFormation;
}): ReactNode {
  return (
    <section
      aria-labelledby="resultats-formation-titre"
      className="border-border bg-bg shadow-card mx-auto mt-6 max-w-5xl rounded-2xl border p-6 sm:p-8"
      data-testid="resultats-formation"
    >
      <p className="text-terracotta-deep text-[11.5px] font-bold tracking-[0.1em] uppercase">
        Indicateurs de résultats
      </p>
      <h3
        id="resultats-formation-titre"
        className="text-fg mt-2 text-lg leading-tight font-semibold tracking-tight"
      >
        Nos résultats sur cette formation
      </h3>
      <dl className="xs:grid-cols-2 mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {tuiles(r).map((t) => (
          <div key={t.label} className="border-border flex flex-col rounded-xl border p-4">
            <dt className="text-fg-soft text-[13px] leading-snug">{t.label}</dt>
            <dd className="text-fg mt-1 text-2xl font-semibold tabular-nums">{t.valeur}</dd>
            <dd className="text-fg-soft mt-1 text-[12px] leading-snug">{t.detail}</dd>
          </div>
        ))}
      </dl>
      <p className="text-fg-soft mt-5 text-[13px] leading-relaxed">
        {libelleEchantillon(r)} {libellePeriode(r)} Chiffres mis à jour le{" "}
        {dateLongueFr(r.calculeLe)}.
        {r.echantillonFaible
          ? " L’échantillon est encore trop faible pour être représentatif : ces chiffres seront complétés au fil des prochaines sessions."
          : null}
      </p>
    </section>
  );
}
