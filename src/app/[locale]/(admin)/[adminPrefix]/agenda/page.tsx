/**
 * Agenda — tous les rendez-vous, d'un coup d'œil (2026-08-26).
 *
 * POURQUOI CETTE PAGE EXISTE ALORS QUE « APPELS RÉSERVÉS » EXISTE DÉJÀ
 * --------------------------------------------------------------------
 * « Appels réservés » répond à « qui a réservé ? » : c'est une liste de
 * réservations Calendly, avec leur fiche. Elle ne sait rien des rendez-vous que
 * Will pose lui-même — sur son ordinateur ou son iPhone — et elle ne dit pas où
 * il est libre. Or c'est CETTE question qui se pose avant de proposer une date à
 * quelqu'un.
 *
 * Cette page fusionne donc les deux sources : la base pour les réservations
 * Calendly (version riche : téléphone, réponses au formulaire, lien
 * d'annulation), l'agenda Google pour tout le reste. Voir
 * `features/admin-agenda/types.ts` pour la règle de fusion et sa raison.
 *
 * MOBILE D'ABORD, ET SANS JAVASCRIPT POUR L'ESSENTIEL
 * ---------------------------------------------------
 * La frise horaire est un composant SERVEUR : la page est `force-dynamic`, donc
 * l'heure courante est juste au rendu et le trait n'a pas besoin d'être animé.
 * Seul le formulaire d'indisponibilité embarque du JavaScript. La console n'a
 * pas à payer un bundle de calendrier pour afficher une journée.
 */

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui";
import { getAgendaFenetre, bornesDuJourParis } from "@/features/admin-agenda/queries";
import { AgendaTimeline } from "@/components/admin/agenda/AgendaTimeline";
import { PoserIndisponibiliteForm } from "@/components/admin/agenda/PoserIndisponibiliteForm";
import { dayKeyInParis } from "@/lib/calendar-grid";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<{ jour?: string }>;
}

const JOURS_COURTS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

/** `AAAA-MM-JJ` valide ? Sinon on retombe sur aujourd'hui plutôt que de planter. */
function jourValide(v: string | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function decalerJour(jour: string, delta: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function libelleJour(jour: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${jour}T12:00:00Z`));
}

/**
 * Bandeau d'état de la connexion Google.
 *
 * 🔴 IL EXISTE POUR UNE RAISON PRÉCISE : un agenda injoignable et un agenda vide
 * rendent la même page. Sans ce bandeau, une journée sans rendez-vous se lit
 * « tu es libre » alors qu'elle peut signifier « je n'ai pas pu regarder » — et
 * c'est exactement le genre de silence qui a laissé `/appel` vendre des créneaux
 * périmés pendant treize minutes. Un repli doit toujours se dire.
 */
function BandeauGoogle({
  configure,
  ok,
  raison,
  tronque,
}: {
  configure: boolean;
  ok: boolean;
  raison?: string;
  tronque: boolean;
}): React.ReactElement | null {
  if (configure && ok && !tronque) return null;

  const texte = !configure
    ? "Seules les réservations en ligne sont affichées : l'agenda Google n'est pas encore connecté à la console. Vos rendez-vous personnels et ceux de votre iPhone n'apparaissent donc pas ici."
    : !ok
      ? raison === "forbidden"
        ? "L'agenda Google refuse l'accès. Dans Google Agenda, partagez-le avec l'adresse du compte de service en « Apporter des modifications aux événements »."
        : "L'agenda Google n'a pas répondu. Ce que vous voyez peut être incomplet — ce n'est pas forcément une journée libre."
      : "Trop d'événements sur cette période : la liste a été tronquée, des rendez-vous manquent à l'écran.";

  return (
    <p
      role="status"
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg-subtle)] px-[var(--space-admin-3)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
    >
      {texte}
    </p>
  );
}

export default async function AgendaPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const { jour: jourBrut } = await searchParams;

  const maintenant = new Date();
  const aujourdhui = dayKeyInParis(maintenant);
  const jour = jourValide(jourBrut) ?? aujourdhui;

  const { debut, fin } = bornesDuJourParis(jour);
  const { items, diagnostics } = await getAgendaFenetre(debut, fin);

  const base = `/fr/${adminPrefix}/agenda`;
  // Frise de sept jours centrée sur le jour affiché : sur mobile, c'est ce qui
  // tient sans défilement horizontal tout en gardant hier et demain à portée.
  const semaine = Array.from({ length: 7 }, (_, i) => decalerJour(jour, i - 3));

  const occupes = items.filter((i) => i.occupe).length;

  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      <AdminPageHeader
        title="Agenda"
        description="Tous vos rendez-vous — réservations en ligne, agenda personnel et iPhone — et les plages que vous avez fermées."
      />

      <BandeauGoogle
        configure={diagnostics.googleConfigure}
        ok={diagnostics.googleOk}
        {...(diagnostics.googleRaison ? { raison: diagnostics.googleRaison } : {})}
        tronque={diagnostics.googleTronque}
      />

      {/* Frise de semaine — des liens, donc navigables sans JavaScript et
          ouvrables dans un nouvel onglet. */}
      <nav aria-label="Choisir un jour">
        <ul className="flex gap-[var(--space-admin-2)] overflow-x-auto pb-[var(--space-admin-1)]">
          {semaine.map((j) => {
            const actif = j === jour;
            const d = new Date(`${j}T12:00:00Z`);
            return (
              <li key={j} className="shrink-0">
                <Link
                  href={`${base}?jour=${j}`}
                  aria-current={actif ? "date" : undefined}
                  className={`flex min-w-[3.25rem] flex-col items-center rounded-[var(--radius-admin-md)] border px-[var(--space-admin-3)] py-[var(--space-admin-2)] ${
                    actif
                      ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-info-soft)]"
                      : "border-[color:var(--color-admin-border)]"
                  }`}
                >
                  <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {JOURS_COURTS[d.getUTCDay()]}
                  </span>
                  <span className="text-[length:var(--text-admin-md)] font-medium tabular-nums">
                    {d.getUTCDate()}
                  </span>
                  {j === aujourdhui && (
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)]">
                      auj.
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-wrap items-baseline justify-between gap-[var(--space-admin-2)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-medium first-letter:uppercase">
          {libelleJour(jour)}
        </h2>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {occupes === 0
            ? "Aucune plage occupée"
            : `${occupes} plage${occupes > 1 ? "s" : ""} occupée${occupes > 1 ? "s" : ""}`}
        </p>
      </div>

      <AgendaTimeline items={items} estAujourdhui={jour === aujourdhui} maintenant={maintenant} />

      <PoserIndisponibiliteForm jour={jour} actif={diagnostics.googleConfigure} />
    </div>
  );
}
