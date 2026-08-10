// Coaching 1-to-1 — détail d'une séance (lecture seule admin).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionAdmin } from "@/server/coaching-admin/queries";
import {
  coachingInterventionLabel,
  optimisationTypeLabel,
  sessionStatutLabel,
} from "@/server/formateur/coaching-options";
import { sumHeuresReelles } from "@/server/qualiopi/coaching-1to1/heures";
import { CoachingFacturationPanel } from "@/components/admin/coaching/CoachingFacturationPanel";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <h2 className="text-mocha mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <p className="text-sm">
      <span className="text-fg-muted">{label} : </span>
      {value || "—"}
    </p>
  );
}

export default async function AdminSeanceDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { id, locale, adminPrefix } = await params;
  const s = await getSessionAdmin(id);
  if (!s) notFound();
  const seancesHref = `/${locale}/${adminPrefix}/coaching/seances`;
  const heuresReelles = sumHeuresReelles(s.comptesRendus);

  return (
    <div className="space-y-4">
      <div>
        <Link href={seancesHref} className="text-terracotta text-xs hover:underline">
          ← Séances
        </Link>
        <h1 className="text-mocha mt-1 text-xl font-semibold">
          {coachingInterventionLabel(s.interventionSlug)}
        </h1>
        <p className="text-fg-muted text-sm">
          {dateFmt.format(s.dateSeance)} · {sessionStatutLabel(s.statut)} · Formateur :{" "}
          {s.trainer.prenom} {s.trainer.nom}
        </p>
        <p className="text-fg-muted text-sm">
          Bénéficiaire : {s.beneficiaireNom ?? "—"}
          {s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}
        </p>
        {/* Rattachement CRM (clientId/devisId) — tiret pour les séances legacy
            sans rattachement, la ligne reste pour signaler que le lien existe. */}
        <p className="text-fg-muted text-sm">
          Client : {s.client?.raisonSociale ?? "—"} · Devis : {s.devis?.numero ?? "—"}
        </p>
        <p className="text-fg-muted text-sm">Heures réalisées : {heuresReelles} h</p>
      </div>

      {/* 2026-08-10 (décision Will) : l'ancien AfestPanel (cadrage AFEST,
          financement OPCO/CPF/FT, certification, kits financeurs) et le registre
          de signatures AFEST ont été supprimés — le 1-to-1 est une prestation de
          conseil hors Qualiopi. Ne reste que la facturation directe. */}
      <CoachingFacturationPanel
        coachingContractId={s.coachingContractId}
        revalidatePath={`/${locale}/${adminPrefix}/coaching/seances/${s.id}`}
        documents={s.documentsGeneres}
      />

      <Block title="Cartographie de l'activité">
        {s.cartographie ? (
          <div className="space-y-1">
            <Line
              label="Tâches recensées"
              value={String((s.cartographie.taches as unknown[])?.length ?? 0)}
            />
            <Line label="Chronophages" value={s.cartographie.chronophages} />
            <Line label="Irritants" value={s.cartographie.irritants} />
            <Line label="Contraintes" value={s.cartographie.contraintes} />
          </div>
        ) : (
          <p className="text-fg-muted text-sm">Non renseignée.</p>
        )}
      </Block>

      <Block title={`Optimisations (${s.optimisations.length})`}>
        {s.optimisations.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {s.optimisations.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span>
                  {o.titre}{" "}
                  <span className="text-fg-muted text-xs">({optimisationTypeLabel(o.type)})</span>
                </span>
                {o.retenue ? <span className="text-success text-xs">retenue</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted text-sm">Aucune.</p>
        )}
      </Block>

      <Block title="Plan d'optimisation">
        {s.plan ? (
          <div className="space-y-1">
            <Line label="Objectifs" value={s.plan.objectifs} />
            <Line
              label="Gain estimé"
              value={s.plan.gainTempsHSemaine != null ? `${s.plan.gainTempsHSemaine} h/sem` : null}
            />
            <Line label="Suivi proposé" value={s.plan.suiviPropose} />
          </div>
        ) : (
          <p className="text-fg-muted text-sm">Non établi.</p>
        )}
      </Block>

      <Block title={`Comptes-rendus (${s.comptesRendus.length})`}>
        {s.comptesRendus.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {s.comptesRendus.map((c) => (
              <li key={c.id}>
                <span className="text-mocha">{dateFmt.format(c.dateSeance)}</span>
                {c.dureeMinutes ? ` · ${c.dureeMinutes} min` : ""}
                {c.planRemis ? " · plan remis" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted text-sm">Aucun.</p>
        )}
      </Block>

      <Block title={`Journal de progression (${s.journaux.length})`}>
        {s.journaux.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {s.journaux.map((j) => (
              <li key={j.id}>
                <span className="text-mocha">{j.periode ?? "Entrée"}</span>
                {j.gainTempsCumuleHSem != null ? ` · ${j.gainTempsCumuleHSem} h/sem` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted text-sm">Aucune entrée.</p>
        )}
      </Block>
    </div>
  );
}
