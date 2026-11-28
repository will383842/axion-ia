/**
 * Content Generator — Écran « Chaîne éditoriale » (C14, lecture seule).
 * Aucune écriture, aucun JavaScript client : onglets et période sont des liens.
 * Un chiffre = un compte sur une table ; une source vide ou illisible = « indisponible ».
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { getVueChaineEditoriale } from "@/server/actions/content-gen/chaine-editoriale";
import type { Source, VueChaine } from "@/server/content-gen/chaine/vue-console";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ onglet?: string; jours?: string }>;
}

const ONGLETS = [
  ["entonnoir", "Entonnoir"],
  ["refus", "Raisons de refus"],
  ["cout", "Coût"],
  ["resultats", "Résultats"],
  ["propositions", "Propositions"],
] as const;
const PERIODES = [7, 30, 90] as const;

const pct = (x: number | null): string =>
  x === null ? "indisponible" : `${Math.round(x * 100)} %`;
const usd = (x: number | null): string => (x === null ? "indisponible" : `${x.toFixed(2)} $`);

function Indispo({ s }: { s: Extract<Source<unknown>, { etat: "indisponible" }> }) {
  return <p className="admin-meta-block">Indisponible : {s.raison}</p>;
}

function Contenu({ vue, onglet }: { vue: VueChaine; onglet: string }): React.ReactElement {
  if (onglet === "refus") {
    const s = vue.refus;
    if (s.etat === "indisponible") return <Indispo s={s} />;
    const r = s.valeur;
    return (
      <>
        <p className="admin-meta-block">
          {r.total} refus sur les 8 dernières semaines (machine et humains confondus).
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nombre</th>
            </tr>
          </thead>
          <tbody>
            {r.parCode.map((c) => (
              <tr key={c.code}>
                <td>{c.code}</td>
                <td>{c.nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="admin-h3">Par rôle</h3>
        <ul className="admin-meta-block">
          {r.parRole.map((x) => (
            <li key={x.role}>
              {x.role} : {x.nombre}
            </li>
          ))}
        </ul>
        <h3 className="admin-h3">Tendance (semaine commençant le)</h3>
        <ul className="admin-meta-block">
          {r.tendance.map((t) => (
            <li key={t.semaineDebut.toISOString()}>
              {t.semaineDebut.toLocaleDateString("fr-FR")} : {t.nombre}
            </li>
          ))}
        </ul>
        <h3 className="admin-h3">Derniers refus</h3>
        <ul className="admin-meta-block">
          {r.exemples.map((x, i) => (
            <li key={i}>
              {x.createdAt.toLocaleDateString("fr-FR")} · {x.role} · {x.code}
              {x.jobId ? ` · job ${x.jobId}` : ""}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (onglet === "cout") {
    const s = vue.cout;
    if (s.etat === "indisponible") return <Indispo s={s} />;
    const c = s.valeur;
    return (
      <>
        <ul className="admin-meta-block">
          <li>
            Dépense attribuée à un rôle : <strong>{usd(c.totalUsd)}</strong>
          </li>
          <li>
            Par contenu publié : <strong>{usd(c.parPublieUsd)}</strong>
          </li>
          <li>
            Par contenu abandonné : <strong>{usd(c.parAbandonneUsd)}</strong>
          </li>
          <li>
            Plafonds jour et mois, réserve : réglage existant dans <em>Réglages › Fournisseurs</em>{" "}
            (aucun second réglage ici).
          </li>
        </ul>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Rôle</th>
              <th>Dépense</th>
            </tr>
          </thead>
          <tbody>
            {c.parRole.map((x) => (
              <tr key={x.role}>
                <td>{x.role}</td>
                <td>{usd(x.usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }
  if (onglet === "resultats" || onglet === "propositions") {
    const s = onglet === "resultats" ? vue.resultats : vue.propositions;
    if (s.etat === "indisponible") return <Indispo s={s} />;
    const n = "mesures" in s.valeur ? s.valeur.mesures : s.valeur.total;
    return (
      <p className="admin-meta-block">
        {n} ligne(s) enregistrée(s). Le détail s&apos;affichera quand le suivi sera branché ; sous les
        planchers statistiques du pilotage, aucune décision n&apos;est tirée.
      </p>
    );
  }
  const s = vue.entonnoir;
  if (s.etat === "indisponible") return <Indispo s={s} />;
  const e = s.valeur;
  return (
    <>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Étape</th>
            <th>Nombre</th>
            <th>Part de l’étape précédente</th>
          </tr>
        </thead>
        <tbody>
          {e.etapes.map((x) => (
            <tr key={x.cle}>
              <td>{x.libelle}</td>
              <td>{x.nombre}</td>
              <td>{pct(x.tauxEtapePrecedente)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="admin-meta-block">
        Abandonnés (briefs sans angle ou sans matière, jobs en échec ou annulés) :{" "}
        <strong>{e.abandonnes}</strong> · réussite globale (publiés / besoins) :{" "}
        <strong>{pct(e.tauxGlobal)}</strong>
      </p>
    </>
  );
}

export default async function ChaineEditorialePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/${adminPrefix}/login`);

  const onglet = ONGLETS.some(([k]) => k === sp.onglet) ? (sp.onglet as string) : "entonnoir";
  const jours = PERIODES.find((p) => String(p) === sp.jours) ?? 30;
  const vue = await getVueChaineEditoriale(jours);
  const base = `/${locale}/${adminPrefix}/content-gen/chaine-editoriale`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Chaîne éditoriale"
        description="Lecture seule : entonnoir, refus, coût, résultats et propositions de la chaîne IA. Rien ici ne modifie la production."
      />
      <AdminCard>
        <nav className="admin-meta-block" aria-label="Vues">
          {ONGLETS.map(([k, l]) => (
            <Link
              key={k}
              href={`${base}?onglet=${k}&jours=${jours}`}
              aria-current={k === onglet ? "page" : undefined}
            >
              {k === onglet ? <strong>{l}</strong> : l}{" "}
            </Link>
          ))}
        </nav>
        <p className="admin-meta-block">
          Période :{" "}
          {PERIODES.map((p) => (
            <Link key={p} href={`${base}?onglet=${onglet}&jours=${p}`}>
              {p === jours ? <strong>{p} j</strong> : `${p} j`}{" "}
            </Link>
          ))}
        </p>
      </AdminCard>
      <AdminCard>
        <Contenu vue={vue} onglet={onglet} />
      </AdminCard>
    </AdminPageShell>
  );
}
