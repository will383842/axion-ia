// Cockpit — HUB DE PILOTAGE.
//
// « Qu'est-ce qui ne va pas, maintenant ? » Une page, tous les signaux des trois
// piliers : planning (sessions non staffées, conflits), conformité formateur,
// rémunération (relevés en attente, anomalies).
//
// Une page VIDE est la bonne nouvelle : elle signifie qu'il n'y a rien à
// arbitrer. On le dit explicitement plutôt que d'afficher un écran nu, qui se
// confondrait avec un bug de chargement.
//
// 0 JS client : navigation mensuelle par liens, tout le rendu est RSC. Le verdict
// vient de `construireHub`, fonction pure et testée — cette page ne fait que le
// mettre en forme.

import Link from "next/link";
import { getHubSignaux } from "@/features/admin-planning/hub-queries";
import {
  aDesSignauxCritiques,
  type NiveauSignal,
  type Signal,
} from "@/features/admin-planning/hub";
import {
  AdminPageHeader,
  AdminBadge,
  AdminCard,
  AdminButton,
  AdminFilterTabs,
} from "@/components/admin/ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

const MONTHS = [
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

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseMonth(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}
function parseYear(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

const NIVEAU_TONE: Record<NiveauSignal, "destructive" | "warning"> = {
  critique: "destructive",
  attention: "warning",
};

const NIVEAU_LABEL: Record<NiveauSignal, string> = {
  critique: "Critique",
  attention: "Attention",
};

function CarteSignal({ signal }: { signal: Signal }) {
  return (
    <AdminCard>
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <AdminBadge tone={NIVEAU_TONE[signal.niveau]} dot>
          {NIVEAU_LABEL[signal.niveau]}
        </AdminBadge>
        <h2 className="admin-h2">{signal.titre}</h2>
      </div>
      <p className="admin-muted">{signal.explication}</p>
      <ul className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
        {signal.items.map((item) => (
          <li key={`${signal.code}:${item.href}:${item.label}`}>
            <Link href={item.href} className="admin-link">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

export default async function PlanningHubPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  // 🔑 On appelle la garde pour son EFFET : sans session, elle redirige vers la
  // connexion. C'est ce que cette page doit garantir par elle-même — le proxy
  // ne peut pas être la seule couche (contournement du 2026-09-05).
  //
  // ⚠️ Pas de `<AccesRefuse>` ici, et ce n'est pas un oubli : en consultation,
  //    le seul refus possible est « rôle non reconnu », que le layout admin
  //    intercepte DÉJÀ avant de rendre ses enfants. La branche serait morte, et
  //    elle coûtait 1,64 kB gz au cliquet de bundle sur les 29 pages de ce lot
  //    (mesuré par Gate B) — `AccesRefuse` tire `next/link` et une icône.
  await gardePage("consultation", `/fr/${adminPrefix}/login`);

  const sp = await searchParams;

  const now = new Date();
  const year = parseYear(sp["year"], now.getFullYear());
  const month = parseMonth(sp["month"], now.getMonth() + 1);

  const signaux = await getHubSignaux(year, month, adminPrefix, now);
  const critiques = aDesSignauxCritiques(signaux);

  const base = `/fr/${adminPrefix}/planning/hub`;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <>
      {/* Retour Will 2026-08-02 : « je ne comprends pas à quoi sert cette
          page ». La description dit maintenant le SERVICE rendu, pas le
          contenu ; les compteurs restent visibles dans les sections. */}
      <AdminPageHeader
        title="Hub de pilotage"
        description={`Où dois-je intervenir ce mois-ci ? Le hub rassemble ce qui cloche dans le planning — conflits, surcharges, indisponibilités, prestations sans formateur — et l'action à mener pour chacun. ${MONTHS[month - 1]} ${year}.`}
        meta={
          critiques ? (
            <AdminBadge tone="destructive" dot pulse>
              Action requise
            </AdminBadge>
          ) : null
        }
      />

      {/* Vues du planning en sélecteur segmenté + mois en AdminButton — loi
          UX 2026-08-02 : une action est un bouton encadré, jamais un lien
          texte discret. Fusion avec le chantier parallèle : leurs boutons de
          mois (icônes fléchées), notre sélecteur de vues. */}
      <nav className="mb-[var(--space-admin-5)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <AdminFilterTabs
          options={[
            { value: "hub", label: "Hub", href: base },
            { value: "calendrier", label: "Calendrier", href: `/fr/${adminPrefix}/planning` },
            {
              value: "timeline",
              label: "Occupation",
              href: `/fr/${adminPrefix}/planning/timeline`,
            },
            {
              value: "pipeline",
              label: "Entonnoir commercial",
              href: `/fr/${adminPrefix}/planning/pipeline`,
            },
            // Ces deux vues n'étaient atteignables depuis le hub que par un lien
            // texte discret en bas de page.
            { value: "charge", label: "Charge", href: `/fr/${adminPrefix}/planning/charge` },
            {
              value: "previsionnel",
              label: "Prévisionnel",
              href: `/fr/${adminPrefix}/planning/previsionnel`,
            },
          ]}
          current="hub"
        />
        <span className="flex items-center gap-[var(--space-admin-2)]">
          <AdminButton
            href={`${base}?year=${prev.y}&month=${prev.m}`}
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
          >
            {MONTHS[prev.m - 1]}
          </AdminButton>
          <AdminButton
            href={`${base}?year=${next.y}&month=${next.m}`}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            {MONTHS[next.m - 1]}
          </AdminButton>
        </span>
      </nav>

      {signaux.length === 0 ? (
        <AdminCard>
          <h2 className="admin-h2">Rien à arbitrer</h2>
          <p className="admin-muted">
            Aucune session sans formateur, aucun conflit, aucun formateur non conforme en mission,
            aucune surcharge, aucun relevé en attente. Un hub vide est le bon résultat.
          </p>
        </AdminCard>
      ) : (
        <div className="flex flex-col gap-[var(--space-admin-5)]">
          {signaux.map((s) => (
            <CarteSignal key={s.code} signal={s} />
          ))}
        </div>
      )}
    </>
  );
}
