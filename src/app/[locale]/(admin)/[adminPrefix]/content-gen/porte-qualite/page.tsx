/**
 * Content Generator — Écran « Porte qualité » (Q8 onglets 1 et 2 en lecture ; Q14 onglet 4 :
 * réglages, journal, dérogations, interdits en lecture seule). Aucun JavaScript client : les onglets et le filtre sont des liens.
 * L'écran n'a pas de vérité propre (conception § 12.1) : critères = registre, verdicts =
 * lignes de la table, rendus sans recalcul ; `null` s'affiche « indisponible », jamais 0.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  enregistrerReglagesPorte,
  getVuePorteQualite,
  getVueReglagesJournal,
} from "@/server/actions/content-gen/porte-qualite";
import type { VueReglagesJournal } from "@/server/content-gen/porte-qualite-io";
import type { VuePorte } from "@/server/content-gen/porte-qualite";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ onglet?: string; verdict?: string; etat?: string; erreur?: string }>;
}

const LIBELLE_VERDICT: Record<string, string> = {
  publiable: "Publiable",
  a_corriger: "À corriger",
  bloque: "Bloqué",
};
const LIBELLE_STATUT: Record<string, string> = {
  ok: "Conforme",
  echec: "En échec",
  non_evalue: "Non évalué",
};
const LIBELLE_CLASSE: Record<string, string> = {
  dur: "Refus définitif",
  corrigeable: "Corrigeable",
  derogeable: "Dérogation possible",
};

const nombre = (n: number | null): string => (n === null ? "indisponible" : String(n));

function dateLisible(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VueEnsemble({ vue }: { vue: VuePorte }): React.ReactElement {
  return (
    <>
      <AdminCard>
        <h2 className="admin-h2">État de la porte</h2>
        <ul className="admin-meta-block">
          <li>
            Dernier verdict écrit :{" "}
            <strong>
              {vue.dernierVerdictLe ? dateLisible(vue.dernierVerdictLe) : "aucun (indisponible)"}
            </strong>
            . Interrupteur lu côté application : {vue.interrupteurActif ? "allumé" : "éteint"} (le
            worker a le sien ; seule la date ci-dessus prouve qu’il écrit).
          </li>
          <li>
            Phase : <strong>{vue.phase ?? "indisponible"}</strong> · mode :{" "}
            <strong>{vue.mode ?? "indisponible"}</strong> · version de la porte :{" "}
            <strong>{vue.versionPorte}</strong>
          </li>
          <li>
            Plafond de sécurité : <strong>{nombre(vue.plafondSecuriteParJour)}</strong> par jour
            (une limite, pas un objectif).
          </li>
          <li>
            Tant que les critères de faits, de doublons et d’intention ne sont pas branchés (PR
            suivantes), tout critère prévu mais absent est « non évalué » et les verdicts sortent «
            Bloqué » par construction : lisez le détail des critères, pas le compteur.
          </li>
          <li>
            En observation, la porte note chaque contenu et ne bloque rien : le fonctionnement
            actuel de la publication ne change pas.
          </li>
        </ul>
      </AdminCard>
      <AdminCard>
        <h2 className="admin-h2">Verdicts enregistrés</h2>
        {vue.verdicts.etat === "indisponible" ? (
          <p className="admin-meta-block">Indisponible : {vue.verdicts.raison}</p>
        ) : (
          <>
            <p className="admin-meta-block">
              {vue.verdicts.valeur.total} verdict(s) récents :{" "}
              {Object.entries(LIBELLE_VERDICT)
                .map(
                  ([k, l]) =>
                    `${l} ${vue.verdicts.etat === "ok" ? (vue.verdicts.valeur.parVerdict[k] ?? 0) : 0}`,
                )
                .join(" · ")}
            </p>
            <h3 className="admin-h3">Raisons les plus fréquentes</h3>
            {vue.verdicts.valeur.raisons.length === 0 ? (
              <p className="admin-meta-block">Aucune raison de refus enregistrée.</p>
            ) : (
              <ol className="admin-meta-block">
                {vue.verdicts.valeur.raisons.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    {r.id} — {r.libelle} : {r.nombre}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </AdminCard>
      <AdminCard>
        <h2 className="admin-h2">Critères et seuils (registre)</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Critère</th>
              <th>Règle</th>
              <th>Famille</th>
              <th>Gravité</th>
              <th>Seuil</th>
            </tr>
          </thead>
          <tbody>
            {vue.criteres.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.libelle}</td>
                <td>{c.famille}</td>
                <td>{LIBELLE_CLASSE[c.classe] ?? c.classe}</td>
                <td>{c.seuil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>
    </>
  );
}

function Contenus({
  vue,
  adminPrefix,
  filtre,
}: {
  vue: VuePorte;
  adminPrefix: string;
  filtre: string | null;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/content-gen/porte-qualite?onglet=contenus`;
  if (vue.verdicts.etat === "indisponible") {
    return (
      <AdminCard>
        <p className="admin-meta-block">Indisponible : {vue.verdicts.raison}</p>
      </AdminCard>
    );
  }
  const lignes = vue.verdicts.valeur.lignes.filter((l) => !filtre || l.verdict === filtre);
  return (
    <AdminCard>
      <h2 className="admin-h2">Contenus notés</h2>
      <p className="admin-meta-block">
        Filtre :{" "}
        <Link href={base} className="admin-link">
          Tous
        </Link>
        {Object.entries(LIBELLE_VERDICT).map(([k, l]) => (
          <span key={k}>
            {" · "}
            <Link href={`${base}&verdict=${k}`} className="admin-link">
              {l}
            </Link>
          </span>
        ))}
      </p>
      {lignes.length === 0 ? (
        <p className="admin-meta-block">Aucun verdict pour ce filtre.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Contenu</th>
              <th>Type</th>
              <th>Note</th>
              <th>Verdict</th>
              <th>Critères non satisfaits</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td>{dateLisible(l.creeLe)}</td>
                <td>
                  {l.jobId ? (
                    <Link
                      href={`/fr/${adminPrefix}/content-gen/jobs/${l.jobId}`}
                      className="admin-link"
                    >
                      {l.titre ?? l.jobId}
                    </Link>
                  ) : (
                    (l.titre ?? "indisponible")
                  )}
                </td>
                <td>{l.type}</td>
                <td>{nombre(l.note)}</td>
                <td>{LIBELLE_VERDICT[l.verdict] ?? l.verdict}</td>
                <td>
                  <ul>
                    {l.criteres
                      .filter((c) => c.statut !== "ok")
                      .map((c) => (
                        <li key={c.id}>
                          {c.id} ({LIBELLE_STATUT[c.statut] ?? c.statut}) : {c.raison ?? "—"}
                          {c.preuves.length > 0 ? ` — ${c.preuves.slice(0, 3).join(" ; ")}` : ""}
                        </li>
                      ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminCard>
  );
}

function ReglagesJournal({
  vue,
  extra,
  etat,
  erreur,
}: {
  vue: VuePorte;
  extra: VueReglagesJournal;
  etat: string | null;
  erreur: string | null;
}): React.ReactElement {
  return (
    <>
      <AdminCard>
        <h2 className="admin-h2">Réglages</h2>
        <p className="admin-meta-block">
          Version de la porte : <strong>{vue.versionPorte}</strong>. Ces seuils sont validés par le
          schéma du back-end ; tant que le point final n’est pas allumé, ils n’agissent que sur la
          notation en observation. Chaque changement est inscrit au journal ci-dessous.
        </p>
        {etat === "ok" ? <p role="status">Réglages enregistrés.</p> : null}
        {erreur ? <p role="alert">Refusé : {erreur}</p> : null}
        <form action={enregistrerReglagesPorte}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Réglage</th>
                <th>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vue.reglagesPorte).map(([cle, valeur]) => (
                <tr key={cle}>
                  <td>
                    <label htmlFor={`reglage-${cle}`}>{cle}</label>
                  </td>
                  <td>
                    <input
                      id={`reglage-${cle}`}
                      name={cle}
                      type="number"
                      step={1}
                      required
                      defaultValue={valeur}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" className="admin-btn">
            Enregistrer les réglages
          </button>
        </form>
      </AdminCard>
      <AdminCard>
        <h2 className="admin-h2">Journal des changements</h2>
        {extra.journal.etat === "indisponible" ? (
          <p className="admin-meta-block">Indisponible : {extra.journal.raison}</p>
        ) : extra.journal.valeur.length === 0 ? (
          <p className="admin-meta-block">Aucun changement enregistré.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quand</th>
                <th>Qui</th>
                <th>Avant → après</th>
              </tr>
            </thead>
            <tbody>
              {extra.journal.valeur.map((e) => (
                <tr key={e.id}>
                  <td>{dateLisible(e.quand)}</td>
                  <td>{e.qui}</td>
                  <td>
                    <ul>
                      {e.changements.map((c) => (
                        <li key={c.cle}>
                          {c.cle} : {c.avant} → {c.apres}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
      <AdminCard>
        <h2 className="admin-h2">Dérogations</h2>
        {extra.derogations.etat === "indisponible" ? (
          <p className="admin-meta-block">Indisponible : {extra.derogations.raison}</p>
        ) : extra.derogations.valeur.length === 0 ? (
          <p className="admin-meta-block">Aucune dérogation enregistrée.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Note</th>
                <th>Décidée par</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {extra.derogations.valeur.map((d) => (
                <tr key={d.id}>
                  <td>{dateLisible(d.quand)}</td>
                  <td>{d.type}</td>
                  <td>{nombre(d.note)}</td>
                  <td>{d.decidePar}</td>
                  <td>{d.motif}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>
      <AdminCard>
        <h2 className="admin-h2">Liste des interdits (lecture seule)</h2>
        <p className="admin-meta-block">
          Importée de <code>interdits-publication.ts</code>. Aucune modification depuis l’écran :
          toute évolution passe par une PR sur ce fichier.
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Raison affichée au rédacteur</th>
              <th>Exception</th>
            </tr>
          </thead>
          <tbody>
            {extra.interdits.map((i) => (
              <tr key={i.code}>
                <td>{i.code}</td>
                <td>{i.raison}</td>
                <td>{i.sauf ?? "aucune"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>
    </>
  );
}

export default async function PorteQualitePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const { onglet, verdict, etat, erreur } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  let vue: VuePorte;
  try {
    vue = await getVuePorteQualite();
  } catch {
    // Non administrateur (ex. lecteur) : même repli que les autres pages console.
    redirect(`/fr/${adminPrefix}`);
  }

  const surReglages = onglet === "reglages";
  let extra: VueReglagesJournal | null = null;
  if (surReglages) {
    try {
      extra = await getVueReglagesJournal();
    } catch {
      redirect(`/fr/${adminPrefix}`);
    }
  }

  const base = `/fr/${adminPrefix}/content-gen/porte-qualite`;
  const surContenus = onglet === "contenus";
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Porte qualité"
        description="La porte note les contenus générés. En observation, elle n’en bloque aucun."
      />
      <nav aria-label="Onglets">
        <Link
          href={base}
          className="admin-link"
          aria-current={surContenus || surReglages ? undefined : "page"}
        >
          Vue d’ensemble
        </Link>
        {" · "}
        <Link
          href={`${base}?onglet=contenus`}
          className="admin-link"
          aria-current={surContenus ? "page" : undefined}
        >
          Contenus
        </Link>
        {" · "}
        <Link
          href={`${base}?onglet=reglages`}
          className="admin-link"
          aria-current={surReglages ? "page" : undefined}
        >
          Réglages et journal
        </Link>
      </nav>
      {surReglages && extra ? (
        <ReglagesJournal vue={vue} extra={extra} etat={etat ?? null} erreur={erreur ?? null} />
      ) : surContenus ? (
        <Contenus
          vue={vue}
          adminPrefix={adminPrefix}
          filtre={verdict && verdict in LIBELLE_VERDICT ? verdict : null}
        />
      ) : (
        <VueEnsemble vue={vue} />
      )}
    </AdminPageShell>
  );
}
