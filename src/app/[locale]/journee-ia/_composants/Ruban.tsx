// Le ruban de la journée : audit le matin, formation l'après-midi, priorités écrites le soir.
// Composant serveur, aucun état. Les textes viennent de `contenu.ts` ; le dessin est un SVG
// à échelle fixe (viewBox 320 × 64) qui s'adapte à la largeur de la carte. Texte de 12 px au moins.

import { CONTENU } from "../contenu";
import s from "../journee-ia.module.css";

export function Ruban() {
  const { ruban, ariaLabelRuban } = CONTENU.accroche.carteDesGains;
  const [debutAudit, finAudit, debutFormation, finFormation] = ruban.heures;
  return (
    <svg className={s.ruban} viewBox="0 0 320 64" role="img" aria-label={ariaLabelRuban}>
      <text className={s.lb} x="56" y="11" textAnchor="middle">
        {ruban.audit}
      </text>
      <text className={s.lb} x="244" y="11" textAnchor="middle">
        {ruban.formation}
      </text>
      <rect x="0" y="16" width="113" height="26" rx="5" fill="var(--color-terracotta-on-mocha)" />
      <rect x="169" y="16" width="151" height="26" rx="5" fill="var(--color-terracotta)" />
      <circle cx="311" cy="29" r="6" fill="var(--color-ink)" />
      <text className={s.hr} x="0" y="58">
        {debutAudit}
      </text>
      <text className={s.hr} x="113" y="58" textAnchor="end">
        {finAudit}
      </text>
      <text className={s.hr} x="169" y="58">
        {debutFormation}
      </text>
      <text className={s.hr} x="320" y="58" textAnchor="end">
        {finFormation}
      </text>
    </svg>
  );
}
