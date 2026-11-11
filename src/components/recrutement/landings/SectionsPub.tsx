// Généré par code/generer.mjs à partir de la maquette validée « pub-facebook / annonce » (09/11/2026).
// Ne pas éditer à la main : modifier la maquette, puis régénérer.
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Chiffres } from "./chiffres";

export function SectionsPub({
  p,
  annonce,
  canal,
  formulaire,
}: {
  p: Chiffres;
  annonce?: boolean;
  canal?: string;
  formulaire?: ReactNode;
}) {
  return (
    <>
      <section className="heros fd-sable" id="s-heros" aria-labelledby="hero-heading">
        <div className="wrap">
          <div className="h-grille">
            <div className="h-texte">
              {annonce && (
                <span className="canal v-annonce">
                  <span className="pt" aria-hidden="true"></span>
                  {canal}
                </span>
              )}
              Vu dans Le Mémo de l’Isère · près de chez vous
            </div>
            <p className="st">Apporteurs d’affaires · partout en France</p>
            <h1 id="hero-heading">
              Vous connaissez des dirigeants&nbsp;?{" "}
              <span className="accent">Présentez-leur la Journée IA.</span>
            </h1>
            <p className="h-sous">
              Une journée dans leur entreprise, à <b>{p.prix} HT</b>. Nous faisons le reste. Pour
              vous&nbsp;:{" "}
              {p.commissionPublique ? (
                <>
                  <b>{p.commission} HT par journée</b> réglée, à titre indicatif.
                </>
              ) : (
                <>
                  <b>Une commission</b> sur chaque journée payée, détaillée dans votre contrat.
                </>
              )}
            </p>
            <ul className="chiffres" aria-label="L’essentiel en chiffres">
              {p.commissionPublique ? (
                <>
                  <li className="t-prix">
                    <b>{p.commission} HT</b>
                    <span>par journée réglée · indicatif</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="t-prix">
                    <b>1 commission</b>
                    <span>sur chaque journée payée · selon le contrat</span>
                  </li>
                </>
              )}
              <li>
                <b>{p.prix} HT</b>
                <span>le prix, le même pour tous</span>
              </li>
              <li className="t-un">
                <b>1 phrase</b>
                <span>à dire, rien à négocier</span>
              </li>
              <li>
                <b>Zéro</b>
                <span>frais à avancer, jamais</span>
              </li>
            </ul>
            <ul className="confiance" aria-label="Ce que cela demande">
              <li>
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-check" />
                </svg>
                Sans CV
              </li>
              <li>
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-check" />
                </svg>
                Sans frais d’entrée
              </li>
              <li>
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-check" />
                </svg>
                Sans exclusivité
              </li>
              <li>
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-check" />
                </svg>
                Aucune connaissance en IA
              </li>
            </ul>
          </div>
          <div className="h-photo">
            {!annonce && (
              <div className="form-carte v-pub" id="contact" aria-labelledby="f-titre">
                <span className="canal">
                  <span className="pt" aria-hidden="true"></span>Réponse par e-mail, à tous
                </span>
                <h2 id="f-titre">Recevez la Journée IA en une page</h2>
                <p className="sous">
                  La fiche à transmettre et la phrase à dire. Puis, si vous le souhaitez, votre
                  dossier de 3 minutes.
                </p>
                {formulaire}
                <p className="micro">
                  Indépendant (micro-entreprise ou société). Sans SIREN&nbsp;? Nous expliquons
                  comment en créer un.
                </p>
              </div>
            )}
            {annonce && (
              <div className="v-annonce annonce-cta">
                <Link
                  className="btn btn-p"
                  href="/fr/devenir-commercial-ia/candidature?depuis=annonce-haut"
                >
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-main" />
                  </svg>
                  Compléter mon dossier · 3 minutes
                </Link>
                <p className="micro">Sans CV · une question par écran · nous répondons à tous</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {annonce && (
        <section className="fd-ivoire en-bref-sec v-annonce" aria-labelledby="en-bref-titre">
          <div className="wrap">
            <div className="en-bref">
              <h2 id="en-bref-titre">En bref</h2>
              <p>
                <b>Les apporteurs d’affaires d’Axion-IA</b> sont des indépendants qui présentent la
                Journée IA à des dirigeants de PME et de TPE qu’ils connaissent. Axion-IA prend le
                rendez-vous, établit le devis, anime la journée et facture l’entreprise.
              </p>
              <p>
                <b>La Journée IA</b>&nbsp;: audit le matin, formation de l’équipe l’après-midi, dans
                les locaux de l’entreprise, partout en France. {p.prix} HT, garantie écrite sous
                condition.
              </p>
              {p.commissionPublique ? (
                <>
                  <p>
                    <b>Commission indicative</b>&nbsp;: {p.commission} HT par Journée IA payée,
                    selon le contrat d’apport d’affaires. Sans frais d’entrée, sans exclusivité,
                    sans CV. Statut indépendant avec un SIREN actif.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <b>Commission</b>&nbsp;: une commission sur chaque Journée IA payée, détaillée
                    dans le contrat d’apport d’affaires. Sans frais d’entrée, sans exclusivité, sans
                    CV. Statut indépendant avec un SIREN actif.
                  </p>
                </>
              )}
              <p className="maj">
                Mis à jour le 9 novembre 2026 ·{" "}
                <Link href="/fr/journee-ia">La Journée IA en détail</Link>
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="fd-blanc" id="comment" aria-labelledby="h-comment">
        <div className="wrap">
          <p className="st">
            <span className="st-n" aria-hidden="true">
              01
            </span>
            Comment ça marche
          </p>
          <h2 id="h-comment">Trois gestes, une commission</h2>
          <p className="appui">Vous n’êtes ni vendeur ni expert en IA. Vous mettez en relation.</p>
          <ol className="gestes">
            <li>
              <span className="num" aria-hidden="true">
                1
              </span>
              <div>
                <h3>Vous présentez</h3>
                <p>
                  Vous en parlez à un dirigeant que vous connaissez. Il est enregistré à votre nom.
                </p>
                <span className="qui">Vous · 5 minutes</span>
              </div>
            </li>
            <li className="nous">
              <span className="num" aria-hidden="true">
                2
              </span>
              <div>
                <h3>Nous faisons le reste</h3>
                <p>Rendez-vous, devis, journée dans l’entreprise, facture&nbsp;: notre métier.</p>
                <span className="qui">Axion-IA</span>
              </div>
            </li>
            <li className="paye">
              <span className="num" aria-hidden="true">
                3
              </span>
              <div>
                <h3>Vous êtes payé</h3>
                <p>Quand l’entreprise a réglé, nous vous versons votre commission.</p>
                {p.commissionPublique ? (
                  <>
                    <span className="qui">{p.commission} HT · à titre indicatif</span>
                  </>
                ) : (
                  <>
                    <span className="qui">Selon votre contrat</span>
                  </>
                )}
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="fd-terra-pale" id="offre" aria-labelledby="h-offre">
        <div className="wrap">
          <p className="st">
            <span className="st-n" aria-hidden="true">
              02
            </span>
            Ce que vous présentez
          </p>
          <h2 id="h-offre">Une seule offre, facile à recommander</h2>
          <div className="produit-grille">
            <article className="carte-produit" aria-labelledby="cp-titre">
              <div className="haut">
                <b id="cp-titre">La Journée IA</b>
                <span className="prix-p">
                  {p.prix} HT<small>prix ferme, pour tous</small>
                </span>
              </div>
              <Image
                src="/images/axion-ia-photo-formation-ia-equipe-mixte-exercices-pratiques-resultat.webp"
                alt="Une équipe en formation à l’IA, exercices pratiques sur ses propres dossiers"
                width={1600}
                height={800}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="photo-p"
              />
              <div className="corps">
                <div className="ruban-j" aria-label="Déroulé de la journée">
                  <span className="matin">
                    9 h – 12 h<i>Audit&nbsp;: leurs gains, chiffrés</i>
                  </span>
                  <span className="aprem">
                    13 h 30 – 17 h 30<i>Formation des équipes sur leurs dossiers</i>
                  </span>
                </div>
                <ul className="coches">
                  <li>
                    <span className="ok" aria-hidden="true">
                      <svg className="ico" aria-hidden="true" focusable="false">
                        <use href="#i-loi" />
                      </svg>
                    </span>
                    <span className="t">
                      <b>La loi le demande</b> : depuis le 2 février 2025, l’Europe impose de former
                      les équipes à l’IA. Une attestation par personne.
                    </span>
                  </li>
                  <li>
                    <span className="ok" aria-hidden="true">
                      <svg className="ico" aria-hidden="true" focusable="false">
                        <use href="#i-shield" />
                      </svg>
                    </span>
                    <span className="t">
                      <b>Le risque est chez nous</b> : si les gains identifiés ne dépassent pas 3
                      fois le prix de la journée, nous remboursons, sans discussion, sous 30 jours.
                    </span>
                  </li>
                  <li>
                    <span className="ok" aria-hidden="true">
                      <svg className="ico" aria-hidden="true" focusable="false">
                        <use href="#i-check" />
                      </svg>
                    </span>
                    <span className="t">
                      <b>Dans leurs locaux, partout en France.</b> Rapport et plan d’action sur 90
                      jours sous 3 jours ouvrés.
                    </span>
                  </li>
                </ul>
              </div>
            </article>
            <aside className="phrase" aria-labelledby="ph-titre">
              <p className="st" id="ph-titre">
                La seule phrase à retenir
              </p>
              <blockquote>
                Je connais un organisme qui, en une journée dans votre entreprise, chiffre ce que
                l’IA peut vous faire gagner et forme votre équipe. Je vous mets en relation&nbsp;?
              </blockquote>
              <p className="note">
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-bulle" />
                </svg>
                Prix, garantie, détails&nbsp;: nous les présentons au dirigeant. Vous n’avez rien à
                expliquer.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="fd-noir" id="prix" aria-labelledby="h-prix">
        <div className="wrap com-grille">
          <div className="com-g">
            <p className="st">
              <span className="st-n" aria-hidden="true">
                03
              </span>
              Cartes sur table
            </p>
            <h2 id="h-prix">Votre commission, noir sur blanc</h2>
            {p.commissionPublique ? (
              <>
                <p className="prix-xl com">
                  {p.commission} HT<small>par Journée IA payée</small>
                </p>
                <span className="indicatif">
                  À titre indicatif&nbsp;: la règle du contrat, pas une promesse
                </span>
              </>
            ) : (
              <>
                <p className="prix-xl com">
                  Une commission<small>sur chaque Journée IA payée</small>
                </p>
                <span className="indicatif">Détaillée dans votre contrat, pas une promesse</span>
              </>
            )}
            <ul className="coches-n">
              <li>
                <span className="ok" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-check" />
                  </svg>
                </span>
                <span className="t">Versée quand l’entreprise a payé</span>
              </li>
              <li>
                <span className="ok" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-check" />
                  </svg>
                </span>
                <span className="t">Au prorata en cas de remise</span>
              </li>
              <li>
                <span className="ok" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-check" />
                  </svg>
                </span>
                <span className="t">Un contrat écrit, lu avant de signer</span>
              </li>
            </ul>
          </div>
          <div className="com-pas">
            <h3 style={{ color: "var(--c-ivoire)", margin: "0 0 12px", fontSize: "19px" }}>
              Ce que ce n’est pas
            </h3>
            <ul className="pas-ca">
              <li>
                <span className="ko" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-x" />
                  </svg>
                </span>
                <div>
                  <b>Pas de salaire fixe</b>
                </div>
              </li>
              <li>
                <span className="ko" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-x" />
                  </svg>
                </span>
                <div>
                  <b>Pas de frais d’entrée, rien à avancer</b>
                </div>
              </li>
              <li>
                <span className="ko" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-x" />
                  </svg>
                </span>
                <div>
                  <b>Pas de pyramide, pas d’équipe à monter</b>
                </div>
              </li>
              <li>
                <span className="ko" aria-hidden="true">
                  <svg className="ico" aria-hidden="true" focusable="false">
                    <use href="#i-x" />
                  </svg>
                </span>
                <div>
                  <b>Pas de quota, pas d’exclusivité</b>
                </div>
              </li>
            </ul>
          </div>
          <div className="com-cta prix-cta">
            {!annonce && (
              <a className="btn btn-o v-pub" href="#contact">
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-main" />
                </svg>
                Devenir apporteur
              </a>
            )}
            {annonce && (
              <Link
                className="btn btn-o v-annonce"
                href="/fr/devenir-commercial-ia/candidature?depuis=annonce"
              >
                <svg className="ico" aria-hidden="true" focusable="false">
                  <use href="#i-main" />
                </svg>
                Compléter mon dossier · 3 minutes
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="fd-terra" id="rendez-vous" aria-labelledby="h-final">
        <div className="wrap final-v2">
          <p className="st">
            <span className="st-n" aria-hidden="true">
              04
            </span>
            Prochaine étape
          </p>
          <h2 id="h-final">Trois minutes, sans CV</h2>
          <ol className="etapes-v2">
            <li>
              <span className="n" aria-hidden="true">
                1
              </span>
              Vos coordonnées, la fiche arrive par e-mail
            </li>
            <li>
              <span className="n" aria-hidden="true">
                2
              </span>
              Un dossier de 3 minutes, une question par écran
            </li>
            <li>
              <span className="n" aria-hidden="true">
                3
              </span>
              Votre lien personnel pour présenter vos premières entreprises
            </li>
          </ol>
          {!annonce && (
            <a className="btn btn-blanc v-pub" href="#contact">
              <svg className="ico" aria-hidden="true" focusable="false">
                <use href="#i-main" />
              </svg>
              Recevoir la fiche et devenir apporteur
            </a>
          )}
          {annonce && (
            <Link
              className="btn btn-blanc v-annonce"
              href="/fr/devenir-commercial-ia/candidature?depuis=annonce"
            >
              <svg className="ico" aria-hidden="true" focusable="false">
                <use href="#i-main" />
              </svg>
              Compléter mon dossier · 3 minutes
            </Link>
          )}
          <p className="reassur-t">
            Sans exclusivité · Aucun frais d’entrée · Nous répondons à tous
          </p>
        </div>
      </section>
    </>
  );
}
