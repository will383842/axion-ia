// Généré par code/generer.mjs à partir de la maquette validée « dossier » (09/11/2026).
// Ne pas éditer à la main : modifier la maquette, puis régénérer.
import type { ReactNode } from "react";
import type { Chiffres } from "./chiffres";

export function SectionsDossier({ p, formulaire }: { p: Chiffres; formulaire?: ReactNode }) {
  return (
    <>
      <section className="heros fd-sable" id="s-heros" aria-labelledby="hero-heading">
        <div className="wrap">
          <div className="h-grille">
            <div className="h-texte">
              <p className="st">Dossier apporteur d’affaires</p>
              <h1 id="hero-heading">
                Trois minutes, <span className="accent">sans CV.</span>
              </h1>
              <p className="h-sous">
                Une question par écran. Vous pouvez vous arrêter et reprendre plus tard&nbsp;: nous
                vous envoyons un lien.
              </p>
              <ul className="chips" aria-label="Ce que demande le dossier">
                <li>
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-horloge" />
                  </svg>
                  3 minutes
                </li>
                <li>
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-zero-cv" />
                  </svg>
                  Aucun CV
                </li>
                <li>
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-carnet" />
                  </svg>
                  8 questions
                </li>
                <li>
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-lien" />
                  </svg>
                  Reprise à tout moment
                </li>
              </ul>
              <p className="h-reassur">Sans exclusivité · Aucun frais d’entrée</p>
            </div>
            <div className="h-photo" style={{ display: "block" }}>
              <div className="ecran ecran-reel" id="dossier">
                {formulaire}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="fd-blanc" id="ensuite" aria-labelledby="h-ensuite">
        <div className="wrap">
          <p className="st">
            <span className="st-n" aria-hidden="true">
              01
            </span>
            Après l’envoi
          </p>
          <h2 id="h-ensuite">Ce qui se passe ensuite</h2>
          <ol className="gestes">
            <li>
              <span className="num" aria-hidden="true">
                1
              </span>
              <div>
                <h3>Un e-mail de confirmation</h3>
                <p>Avec la Journée IA en une page et la phrase à dire.</p>
                <span className="qui">Tout de suite</span>
              </div>
            </li>
            <li className="nous">
              <span className="num" aria-hidden="true">
                2
              </span>
              <div>
                <h3>Un échange de 15 minutes</h3>
                <p>En visio, sur invitation, pour répondre à vos questions.</p>
                <span className="qui">Axion-IA</span>
              </div>
            </li>
            <li className="paye">
              <span className="num" aria-hidden="true">
                3
              </span>
              <div>
                <h3>Votre lien personnel</h3>
                <p>
                  Pour présenter vos premières entreprises et suivre chacune d’elles. Un contrat
                  écrit, lu avant de signer.
                </p>
                <span className="qui">Vous</span>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="fd-terra-pale" id="rappel" aria-labelledby="h-rappel">
        <div className="wrap">
          <p className="st">
            <span className="st-n" aria-hidden="true">
              02
            </span>
            Rappel
          </p>
          <h2 id="h-rappel">Une offre, une commission</h2>
          <ul className="chiffres" aria-label="L’essentiel en chiffres">
            <li>
              <b>{p.prix} HT</b>
              <span>la Journée IA, le même prix pour tous</span>
            </li>
            {p.commissionPublique ? (
              <>
                <li className="t-prix">
                  <b>{p.commission} HT</b>
                  <span>pour vous, par journée réglée · indicatif</span>
                </li>
              </>
            ) : (
              <>
                <li className="t-prix">
                  <b>1 commission</b>
                  <span>pour vous, sur chaque journée payée</span>
                </li>
              </>
            )}
            <li className="t-un">
              <b>1 phrase</b>
              <span>à dire, rien à négocier</span>
            </li>
            <li>
              <b>Zéro</b>
              <span>frais à avancer, jamais</span>
            </li>
          </ul>
          <p className="sans-ia">
            <svg className="ico" aria-hidden="true" focusable="false">
              <use href="#i-bulle" />
            </svg>
            Statut indépendant (micro-entreprise ou société) avec un SIREN actif. Sans SIREN, nous
            vous expliquons comment créer une micro-entreprise.
          </p>
        </div>
      </section>
    </>
  );
}
