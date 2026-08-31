// Email — le rapport du simulateur de gains.
//
// Le corps du message porte les CHIFFRES et le PLAN, pas seulement un lien :
// un dirigeant qui reçoit « votre rapport est disponible, cliquez ici » ne
// clique pas. Il doit voir son gain annuel et ses trois premières actions dans
// l'aperçu de sa boîte mail, sans rien ouvrir. Le lien vient ensuite, pour le
// rapport complet et pour le transfert à son associé.
//
// Le lien est permanent : il encode les réponses, donc il rejoue exactement le
// même rapport, même dans six mois.

import { Text, Section, Row, Column, Hr } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface TopTask {
  readonly label: string;
  readonly hours: number;
  readonly eur: number;
  readonly weeks: number;
}

interface Payload {
  readonly contactName: string;
  readonly reportUrl: string;
  readonly sectorLabel: string;
  readonly headcount: number;
  readonly savedHoursPerYear: number;
  readonly savedEurPerYear: number;
  readonly savedEurLow: number;
  readonly savedEurHigh: number;
  readonly fteRecovered: number;
  readonly topTasks: readonly TopTask[];
}

const COPY = {
  fr: {
    title: "Votre estimation de gains",
    preview: (h: string, fte: string) => `${h} heures par an, soit ${fte} temps plein récupéré.`,
    // §3.6 — le prénom vient APRÈS le fait, dans la même phrase. Sur le modèle
    // du référentiel : « Votre place est réservée. Bonjour Marie — voici les
    // détails. » Un « Bonjour Jean, » isolé en tête consommait tout le résumé IA.
    lead: (sector: string, headcount: number, nom: string) =>
      `Voici l'estimation établie pour votre entreprise (${sector}, ${headcount} personne${headcount > 1 ? "s" : ""}).` +
      (nom ? ` Bonjour ${nom} — le détail est juste en dessous.` : ""),
    heroLabel: "Valeur annuelle du temps récupérable",
    range: (low: string, high: string) => `Fourchette réaliste : de ${low} à ${high} par an.`,
    hoursLine: (h: string, fte: string) =>
      `Soit ${h} heures par an, l'équivalent de ${fte} temps plein.`,
    planTitle: "Par quoi commencer",
    planIntro:
      "Classées par rapport entre le gain et l'effort : la première ligne est celle qui rapporte le plus vite, pas celle qui rapporte le plus.",
    taskLine: (hours: string, eur: string, weeks: number) =>
      `${hours} h par an · ${eur} · disponible sous ${weeks} semaine${weeks > 1 ? "s" : ""}`,
    cta: "Voir le rapport complet",
    shareTitle: "Transmettez-le",
    share:
      "Ce lien contient vos réponses : la personne qui l'ouvre voit exactement le même rapport, avec le détail de chaque tâche et la feuille de route complète.",
    disclaimerTitle: "Ce que vaut cette estimation",
    disclaimer:
      "Ces chiffres proviennent d'un modèle dont toutes les hypothèses sont publiées sur la page du simulateur. Ils ne constituent ni un engagement de résultat, ni un devis, ni un audit. Vos résultats réels dépendent de vos process et de votre adoption interne.",
  },
  en: {
    title: "Your estimated gains",
    preview: (h: string, fte: string) =>
      `${h} hours a year — the equivalent of ${fte} full-time roles.`,
    lead: (sector: string, headcount: number, nom: string) =>
      `Here is the estimate for your company (${sector}, ${headcount} people).` +
      (nom ? ` Hello ${nom} — the detail is just below.` : ""),
    heroLabel: "Annual value of the time you can recover",
    range: (low: string, high: string) => `Realistic range: ${low} to ${high} per year.`,
    hoursLine: (h: string, fte: string) =>
      `That is ${h} hours a year, the equivalent of ${fte} full-time roles.`,
    planTitle: "Where to start",
    planIntro:
      "Ranked by gain against effort: the first line is the one that pays off fastest, not the one that pays most.",
    taskLine: (hours: string, eur: string, weeks: number) =>
      `${hours} h per year · ${eur} · available within ${weeks} week${weeks > 1 ? "s" : ""}`,
    cta: "See the full report",
    shareTitle: "Pass it on",
    share:
      "This link carries your answers: whoever opens it sees exactly the same report, with every task detailed and the full roadmap.",
    disclaimerTitle: "What this estimate is worth",
    disclaimer:
      "These figures come from a model whose assumptions are all published on the simulator page. They are neither a performance guarantee, nor a quote, nor an audit. Your actual results depend on your processes and internal adoption.",
  },
} as const;

export const roiReportSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const eur = typeof p.savedEurPerYear === "number" ? p.savedEurPerYear : 0;
  const amount = formatEur(eur, locale);
  return locale === "fr"
    ? `Votre estimation : ${amount} par an`
    : `Your estimate: ${amount} a year`;
};

function formatEur(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNum(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(value);
}

export function RoiReportEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const C = emailStyles.COLORS;

  const topTasks = Array.isArray(p.topTasks) ? p.topTasks : [];

  return (
    <EmailLayout
      famille="B"
      /* L'objet porte déjà le montant : le pré-en-tête porte donc ce qu'il ne dit
         pas — le volume d'heures et l'équivalent temps plein (§3.5). */
      preview={t.preview(formatNum(p.savedHoursPerYear, locale), formatNum(p.fteRecovered, locale))}
      title={t.title}
      cta={{ label: t.cta, href: p.reportUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        {t.lead(p.sectorLabel, p.headcount, p.contactName)}
      </Text>

      {/* ── Le chiffre ─────────────────────────────────────────────────── */}
      <Section
        style={{
          border: `2px solid ${C.terracotta}`,
          borderRadius: "16px",
          padding: "24px",
          margin: "24px 0",
          textAlign: "center" as const,
        }}
      >
        <Text
          style={{
            ...emailStyles.paragraphStyle,
            margin: "0 0 6px",
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: C.textMuted,
          }}
        >
          {t.heroLabel}
        </Text>
        <Text
          style={{
            margin: "0",
            fontFamily: emailStyles.SERIF,
            fontSize: "40px",
            lineHeight: "1.1",
            fontWeight: 700,
            color: C.text,
          }}
        >
          {formatEur(p.savedEurPerYear, locale)}
        </Text>
        <Text
          style={{
            ...emailStyles.paragraphStyle,
            margin: "10px 0 0",
            fontSize: "14px",
            color: C.textMuted,
          }}
        >
          {t.range(formatEur(p.savedEurLow, locale), formatEur(p.savedEurHigh, locale))}
        </Text>
        <Text
          style={{
            ...emailStyles.paragraphStyle,
            margin: "6px 0 0",
            fontSize: "14px",
            color: C.textMuted,
          }}
        >
          {t.hoursLine(formatNum(p.savedHoursPerYear, locale), formatNum(p.fteRecovered, locale))}
        </Text>
      </Section>

      {/* ── Le plan ────────────────────────────────────────────────────── */}
      <Text style={emailStyles.headingStyle}>{t.planTitle}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, fontSize: "14px", color: C.textMuted }}>
        {t.planIntro}
      </Text>

      {topTasks.map((task, index) => (
        <Section key={`${task.label}-${index}`} style={{ margin: "0 0 14px" }}>
          <Row>
            <Column style={{ width: "28px", verticalAlign: "top" as const }}>
              <Text
                style={{
                  ...emailStyles.paragraphStyle,
                  margin: 0,
                  fontWeight: 700,
                  color: C.terracotta,
                }}
              >
                {index + 1}.
              </Text>
            </Column>
            <Column>
              <Text style={{ ...emailStyles.paragraphStyle, margin: 0, fontWeight: 600 }}>
                {task.label}
              </Text>
              <Text
                style={{
                  ...emailStyles.paragraphStyle,
                  margin: "2px 0 0",
                  fontSize: "14px",
                  color: C.textMuted,
                }}
              >
                {t.taskLine(formatNum(task.hours, locale), formatEur(task.eur, locale), task.weeks)}
              </Text>
            </Column>
          </Row>
        </Section>
      ))}

      <Hr style={{ borderColor: C.border, margin: "24px 0" }} />

      <Text style={emailStyles.headingStyle}>{t.shareTitle}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.share}</Text>

      <Text
        style={{
          ...emailStyles.paragraphStyle,
          marginTop: "24px",
          fontSize: "13px",
          fontWeight: 600,
          color: C.textMuted,
        }}
      >
        {t.disclaimerTitle}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, fontSize: "13px", color: C.textMuted }}>
        {t.disclaimer}
      </Text>
    </EmailLayout>
  );
}
