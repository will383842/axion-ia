"use client";

import { useState, useTransition } from "react";
import {
  definirMarcheEquipe,
  definirQuotasEquipe,
  publierArticleEquipe,
  renvoyerArticleEquipe,
  type ArticleARelire,
} from "@/server/actions/content-gen/equipe-editoriale";

type ArticleSerialise = Omit<ArticleARelire, "creeLe"> & { creeLe: string };

interface Props {
  adminPrefix: string;
  etat: { active: boolean; variable: boolean; console: boolean; raison?: string };
  quotas: { articlesMaxJour: number; majMaxJour: number };
  aRelire: ReadonlyArray<ArticleSerialise>;
}

export function EquipeEditorialeClient({ adminPrefix, etat, quotas, aRelire }: Props) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [articles, setArticles] = useState(String(quotas.articlesMaxJour));
  const [maj, setMaj] = useState(String(quotas.majMaxJour));

  const agir = (fn: () => Promise<unknown>, ok: string) =>
    demarrer(async () => {
      try {
        await fn();
        setMessage(ok);
      } catch (e) {
        setMessage(`Échec : ${e instanceof Error ? e.message : "erreur inconnue"}`);
      }
    });

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Équipe éditoriale</h1>
      {message && (
        <p role="status" className="rounded border p-3 text-sm">
          {message}
        </p>
      )}

      <section aria-labelledby="etat" className="space-y-2 rounded border p-4">
        <h2 id="etat" className="text-lg font-medium">
          État
        </h2>
        <p>
          <strong>{etat.active ? "En marche" : "Arrêtée"}</strong>
          {etat.raison ? ` — ${etat.raison}` : ""}
        </p>
        <p className="text-sm">
          Variable serveur : {etat.variable ? "allumée" : "éteinte"} · Réglage console :{" "}
          {etat.console ? "marche" : "arrêt"}
        </p>
        <button
          type="button"
          disabled={enCours}
          className="rounded border px-3 py-1"
          onClick={() =>
            agir(
              () => definirMarcheEquipe(!etat.console),
              etat.console ? "Réglage mis sur arrêt." : "Réglage mis sur marche.",
            )
          }
        >
          {etat.console ? "Arrêter l'équipe" : "Mettre l'équipe en marche"}
        </button>
      </section>

      <section aria-labelledby="quotas" className="space-y-2 rounded border p-4">
        <h2 id="quotas" className="text-lg font-medium">
          Quotas par jour
        </h2>
        <label className="block text-sm">
          Nouveaux articles (0 à 10 ; réglage enregistré, application à la création pas encore
          branchée)
          <input
            type="number"
            min={0}
            max={10}
            step={1}
            value={articles}
            onChange={(e) => setArticles(e.target.value)}
            className="ml-2 w-20 rounded border px-2"
          />
        </label>
        <label className="block text-sm">
          Mises à jour (0 à 5)
          <input
            type="number"
            min={0}
            max={5}
            step={1}
            value={maj}
            onChange={(e) => setMaj(e.target.value)}
            className="ml-2 w-20 rounded border px-2"
          />
        </label>
        <button
          type="button"
          disabled={enCours}
          className="rounded border px-3 py-1"
          onClick={() => {
            const ok = (v: string, max: number) =>
              v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= max;
            if (!ok(articles, 10) || !ok(maj, 5)) {
              setMessage("Échec : saisir deux entiers (articles 0 à 10, mises à jour 0 à 5).");
              return;
            }
            agir(
              () =>
                definirQuotasEquipe({ articlesMaxJour: Number(articles), majMaxJour: Number(maj) }),
              "Quotas enregistrés.",
            );
          }}
        >
          Enregistrer les quotas
        </button>
        <p className="text-sm">
          Plafonds en dollars (jour et mois) : à régler dans{" "}
          <a className="underline" href={`/fr/${adminPrefix}/content-gen/settings/providers`}>
            les réglages des fournisseurs
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="relire" className="space-y-3">
        <h2 id="relire" className="text-lg font-medium">
          Articles à relire ({aRelire.length})
        </h2>
        {aRelire.length === 0 && <p className="text-sm">Aucun article en attente.</p>}
        {aRelire.map((a) => (
          <article key={a.reviewId} className="space-y-2 rounded border p-4">
            <h3 className="font-medium">{a.titre ?? "(sans titre)"}</h3>
            <p className="text-sm">
              Coût : {a.coutUsd === null ? "—" : `${a.coutUsd.toFixed(2)} $`} · Renvois depuis la
              console : {a.renvoisConsole}/1
            </p>
            {a.causes.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {a.causes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-sm">Journal des rôles</summary>
              <ol className="mt-1 space-y-1 text-xs">
                {a.journal.map((e, i) => (
                  <li key={i}>
                    passe {e.passe} · {e.role} : {e.decision} ({e.coutUsd.toFixed(2)} $)
                    {e.detail ? ` — ${e.detail}` : ""}
                  </li>
                ))}
              </ol>
            </details>
            {a.statut !== "pending" && (
              <p className="text-sm">
                Déjà renvoyé en correction : en attente du retour de la boucle qualité.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={enCours || a.statut !== "pending"}
                className="rounded border px-3 py-1"
                onClick={() =>
                  agir(() => publierArticleEquipe(a.reviewId), "Article envoyé en publication.")
                }
              >
                Publier
              </button>
              <button
                type="button"
                disabled={enCours || a.statut !== "pending" || a.renvoisConsole >= 1}
                className="rounded border px-3 py-1"
                onClick={() =>
                  agir(() => renvoyerArticleEquipe(a.reviewId), "Article renvoyé en correction.")
                }
              >
                Renvoyer en correction
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
