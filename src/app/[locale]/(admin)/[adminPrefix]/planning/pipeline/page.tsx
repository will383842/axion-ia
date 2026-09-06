// Cockpit — PIPELINE COMMERCIAL.
//
// Le calendrier dit QUAND. Le prévisionnel dit COMBIEN j'encaisse. Cette page dit
// **où sont mes affaires, et où est-ce que je perds**.
//
// Le chiffre le plus utile de chaque étage n'est pas le compte ni le montant :
// c'est l'ÂGE de la plus vieille affaire bloquée. Un devis envoyé il y a 40 jours
// est un devis mort qui s'ignore ; une session réalisée il y a 60 jours et jamais
// facturée est de l'argent qu'on a oublié de réclamer.
//
// L'étage « Demandes en cours » est marqué NON RELIÉ : `Submission` ne pointe
// vers aucun devis en base. On le compte, on ne le suit pas — et on le dit,
// plutôt que de tracer une flèche qu'aucune donnée ne soutient.
//
// 0 JS client : réglage de la fenêtre par querystring, rendu RSC, barres en CSS pur.

import Link from "next/link";
import { getPipeline, FENETRE_JOURS_DEFAUT } from "@/features/admin-planning/pipeline-queries";
import type { Etage } from "@/features/admin-planning/pipeline";
import { AdminPageHeader, AdminBadge, AdminCard } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Fenêtre entre 7 et 730 jours, sinon la valeur par défaut. */
function parseFenetre(v: string | undefined): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 7 && n <= 730 ? n : FENETRE_JOURS_DEFAUT;
}

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Au-delà de ces seuils, l'âge d'un étage passe en alerte. Ils encodent un
 * jugement métier : un devis sans réponse à 30 jours est froid ; une prestation
 * livrée et non facturée à 15 jours est une négligence ; une facture impayée à
 * 45 jours dépasse largement l'échéance usuelle à 30 jours.
 */
const SEUIL_ALERTE_JOURS: Partial<Record<Etage["code"], number>> = {
  devis_envoye: 30,
  a_facturer: 15,
  facture_emise: 45,
};

function LigneEtage({ etage, largeurPct }: { etage: Etage; largeurPct: number }) {
  const seuil = SEUIL_ALERTE_JOURS[etage.code];
  const enAlerte = seuil !== undefined && etage.ageMaxJours !== null && etage.ageMaxJours > seuil;

  return (
    <li className="border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-4)]">
      <div className="flex flex-wrap items-baseline gap-[var(--space-admin-3)]">
        <span className="font-semibold">{etage.libelle}</span>
        <span className="tabular-nums">{etage.nb}</span>
        {etage.montantHtCents !== null && (
          <span className="tabular-nums">{euros(etage.montantHtCents)} HT</span>
        )}
        {etage.ageMaxJours !== null && (
          <AdminBadge tone={enAlerte ? "destructive" : "neutral"} dot={enAlerte} compact>
            {etage.ageMaxJours} j au plus ancien
          </AdminBadge>
        )}
        {!etage.chaine && (
          <AdminBadge tone="outline" compact>
            non relié
          </AdminBadge>
        )}
      </div>

      {/* Largeur relative au plus gros étage. CSS pur, aucune lib. */}
      <div
        className="mt-[var(--space-admin-2)] h-2 overflow-hidden rounded-full bg-[color:var(--color-admin-paper-alt)]"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-[color:var(--color-admin-terracotta)]"
          style={{ width: `${largeurPct}%` }}
        />
      </div>

      <p className="admin-muted mt-[var(--space-admin-2)]">{etage.explication}</p>
    </li>
  );
}

export default async function PlanningPipelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }

  const sp = await searchParams;

  const fenetre = parseFenetre(sp["fenetre"]);
  const now = new Date();
  const pipeline = await getPipeline(now, fenetre);

  const base = `/fr/${adminPrefix}/planning/pipeline`;
  const maxNb = Math.max(1, ...pipeline.etages.map((e) => e.nb));
  const taux = pipeline.tauxAcceptationDevisPct;

  return (
    <>
      <AdminPageHeader
        title="Pipeline commercial"
        description={`${fenetre} derniers jours · taux d'acceptation des devis : ${
          taux === null ? "aucun devis tranché" : `${taux} %`
        }`}
      />

      <nav className="mb-[var(--space-admin-5)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
        {[30, 90, 180, 365].map((j) => (
          <Link
            key={j}
            href={`${base}?fenetre=${j}`}
            className="admin-link"
            aria-current={j === fenetre ? "page" : undefined}
          >
            {j} j
          </Link>
        ))}
        <Link href={`/fr/${adminPrefix}/planning/hub`} className="admin-link">
          Hub
        </Link>
        <Link href={`/fr/${adminPrefix}/planning/previsionnel`} className="admin-link">
          Prévisionnel
        </Link>
      </nav>

      <AdminCard>
        <h2 className="admin-h2">Entonnoir</h2>
        <p className="admin-muted">
          « Demandes en cours » est compté mais non relié : aucune clé étrangère ne relie une
          demande entrante au devis qu&apos;elle devient. Les étages suivants, eux, se suivent
          réellement.
        </p>
        <ul className="mt-[var(--space-admin-4)]">
          {pipeline.etages.map((e) => (
            <LigneEtage key={e.code} etage={e} largeurPct={Math.round((e.nb / maxNb) * 100)} />
          ))}
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Fuites</h2>
        {pipeline.fuites.length === 0 ? (
          <p className="admin-muted">
            Aucune affaire perdue, refusée, expirée ou annulée sur la période.
          </p>
        ) : (
          <>
            <p className="admin-muted">
              Sorties nommées de l&apos;entonnoir. Une affaire qui disparaît sans qu&apos;on sache
              pourquoi serait un zéro silencieux de plus.
            </p>
            <table className="admin-table mt-[var(--space-admin-3)]">
              <thead>
                <tr>
                  <th scope="col">Sortie</th>
                  <th scope="col" className="text-right">
                    Nombre
                  </th>
                  <th scope="col" className="text-right">
                    Montant HT
                  </th>
                </tr>
              </thead>
              <tbody>
                {pipeline.fuites.map((f) => (
                  <tr key={f.code}>
                    <td>{f.libelle}</td>
                    <td className="text-right tabular-nums">{f.nb}</td>
                    <td className="text-right tabular-nums">
                      {f.montantHtCents === null ? "—" : `${euros(f.montantHtCents)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </AdminCard>
    </>
  );
}
