// Rendu d'un entonnoir : une barre par étape, largeur proportionnelle.
//
// ── Pourquoi la barre ET les deux pourcentages ────────────────────────────
// La barre donne la forme en un coup d'œil. Mais lire un entonnoir uniquement
// « depuis la base » masque les chutes locales : passer de 8 % à 4 % ne
// ressemble à rien sur une barre, alors que c'est la MOITIÉ des visiteurs
// perdus à cette étape précise. Les deux lectures sont donc affichées, et
// celle « depuis l'étape précédente » est mise en avant dès qu'elle est basse.

import type { Entonnoir } from "@/features/admin-tunnels/aggregate";

/** En dessous de ce passage, l'étape est signalée comme un point de fuite. */
const SEUIL_ALERTE = 50;

export function EntonnoirVue({ entonnoir }: { entonnoir: Entonnoir }): React.ReactElement {
  const base = entonnoir.etapes[0]?.sessions ?? 0;

  return (
    <section className="admin-card">
      <h3 className="admin-h3">{entonnoir.titre}</h3>
      {/* La base est écrite en toutes lettres : sans elle, un pourcentage
          d'entonnoir se lit systématiquement de travers. */}
      <p className="admin-meta-small">
        Base : {base.toLocaleString("fr-FR")} {entonnoir.base}
      </p>

      {base === 0 ? (
        <p className="admin-meta">Aucune session sur la période.</p>
      ) : (
        <ol className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-3)]">
          {entonnoir.etapes.map((etape, rang) => {
            const alerte = rang > 0 && etape.partDepuisPrecedente < SEUIL_ALERTE;
            return (
              <li key={etape.cle}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--space-admin-2)]">
                  <span className="admin-label">{etape.libelle}</span>
                  <span className="admin-meta-small tabular-nums">
                    {etape.sessions.toLocaleString("fr-FR")} · {etape.partDepuisBase}&nbsp;%
                    {rang > 0 ? (
                      <>
                        {" · "}
                        <span className={alerte ? "admin-severity-warning" : undefined}>
                          {etape.partDepuisPrecedente}&nbsp;% de l&apos;étape précédente
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>

                {/* Jetons imposés par la charte de la console : accent
                    terracotta sur sa piste éclaircie. La version initiale
                    utilisait le bleu « info » sur un gris neutre — deux
                    couleurs étrangères à la palette, qui juraient avec le reste
                    de l'écran. Le commentaire de `--color-admin-accent-track`
                    dans admin.css est explicite : « jamais un gris étranger ».
                    Même forme que les jauges de couverture de la console. */}
                <div
                  className="mt-[var(--space-admin-1)] h-3 w-full overflow-hidden rounded-full bg-[color:var(--color-admin-accent-track)]"
                  role="img"
                  aria-label={`${etape.libelle} : ${etape.sessions} sessions, ${etape.partDepuisBase} % de la base`}
                >
                  <div
                    className="h-full rounded-full bg-[color:var(--color-admin-accent)]"
                    style={{ width: `${Math.max(etape.partDepuisBase, 0.5)}%` }}
                  />
                </div>

                {rang > 0 && etape.perdues > 0 ? (
                  <p className="admin-meta-small">
                    {etape.perdues.toLocaleString("fr-FR")} session
                    {etape.perdues > 1 ? "s" : ""} perdue{etape.perdues > 1 ? "s" : ""} ici
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
