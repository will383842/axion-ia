// Lecteur d'e-mail commun de la console (lot I0, PLAN-INTERFACE).
//
// Montre un e-mail comme une boîte de réception : en-tête (De, À, Répondre à,
// Objet, pré-en-tête, pièces jointes : chaque ligne n'existe que si la donnée est
// fournie), puis le corps dans un cadre ISOLÉ : `sandbox=""` (ni script, ni
// formulaire, origine opaque), `srcDoc`, `referrerPolicy="no-referrer"`. JAMAIS
// `allow-same-origin`, JAMAIS de script : le HTML n'est jamais injecté dans la page.
//
// Grande hauteur (au moins 720 px, sinon la hauteur de l'écran moins l'en-tête) :
// plus de petite fenêtre à défilement interne. Les trois bascules (ordinateur /
// téléphone, clair / sombre, HTML / texte brut) sont en CSS seul, par boutons
// radio : aucun JavaScript client. Les radios sont rattachés à AUCUN formulaire
// (`form` pointe vers un id inexistant) pour ne jamais entrer dans les données
// d'un formulaire qui contiendrait le lecteur.
//
// Mode sombre : `color-scheme: dark` sur le cadre (admin.css), JAMAIS d'inversion
// de couleurs (elle mettrait les images en négatif). L'e-mail déclare qu'il
// accepte les deux thèmes (`<meta name="color-scheme">` posée dans le `srcDoc`) :
// un e-mail aux couleurs explicites reste tel qu'il est, comme dans une messagerie
// sans mode sombre ; c'est le rendu honnête, pas un faux rendu.
//
// Images distantes : `sandbox=""` ne les bloque pas et le cadre hérite de la CSP
// de la page (`img-src 'self' data: blob: https:`, src/lib/csp.ts). Une balise
// `<meta http-equiv="Content-Security-Policy">` posée en tête du `srcDoc` ne peut
// que RESTREINDRE : plus de script, plus de police, plus de média, et des images
// seulement `data:` ou de l'origine du site, qui est celle des images du châssis
// (`BASE_URL` dans src/lib/email/templates/_layout.tsx : logo et sceau).

import { useId } from "react";

import {
  compterImagesBloquees,
  cspCorpsEmail,
  extraireLiens,
  libelleTaille,
  type ApercuLecteur,
  type PieceJointeApercu,
} from "@/lib/email/apercu-lecteur";

export interface LecteurEmailProps {
  /** Corps HTML complet de l'e-mail (ou `apercu.html`). */
  html?: string;
  /** Version texte brut ; absente = pas de bascule HTML / texte. */
  texte?: string | null | undefined;
  /** Expéditeur (nom et adresse). */
  de?: string | null | undefined;
  /** Destinataire(s). */
  a?: string | null | undefined;
  repondreA?: string | null | undefined;
  objet?: string | null | undefined;
  /** Pré-en-tête (l'aperçu qu'affiche la boîte de réception). */
  preEntete?: string | null | undefined;
  /** Pièces jointes : noms seuls, ou pièces décrites (poids, bouton « Ouvrir »). `[]` = « Aucune pièce jointe ». */
  piecesJointes?: readonly (string | PieceJointeApercu)[] | null | undefined;
  /** Titre accessible du cadre. */
  titre?: string;
  /** Lien « Ouvrir en plein écran » (nouvel onglet) ; absent = aucun lien. */
  pleinEcranHref?: string | undefined;
  /** Version affichée au départ (défaut : HTML). « texte » exige `texte`. */
  formatInitial?: "html" | "texte";
  /** Neutralise les clics sur les liens du corps (aperçu avant envoi). */
  liensInertes?: boolean;
  /**
   * Aperçu avant envoi dont le HTML a été traité par `rendreLiensOuvrables` : les liens publics
   * s'ouvrent dans un NOUVEL onglet (`<base target="_blank">` + `allow-popups`, jamais de script),
   * et la liste « Liens de cet e-mail » s'affiche sous l'aperçu. Les liens personnels du
   * destinataire n'y sont jamais cliquables. Remplace `liensInertes`.
   */
  liensOuvrables?: boolean;
  /** Raccourci : étale les champs d'un `ApercuLecteur` ; les propriétés explicites l'emportent. */
  apercu?: ApercuLecteur;
}

const STYLE_LIENS_INERTES = "<style>a,area{pointer-events:none;cursor:default}</style>";

/** Balises posées en tête du document (après un éventuel doctype, pour ne pas
 *  basculer l'e-mail en mode quirks). */
export function preparerSrcDoc(
  html: string,
  options: { liensInertes?: boolean; liensOuvrables?: boolean } = {},
): string {
  const csp = `default-src 'none'; img-src data: ${cspCorpsEmail()}; style-src 'unsafe-inline'`;
  const balises =
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta name="color-scheme" content="light dark">` +
    (options.liensOuvrables === true ? '<base target="_blank">' : "") +
    (options.liensInertes === true && options.liensOuvrables !== true ? STYLE_LIENS_INERTES : "");
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return doctype[0] + balises + html.slice(doctype[0].length);
  return balises + html;
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{libelle}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Bascule({
  nom,
  etiquette,
  options,
}: {
  nom: string;
  etiquette: string;
  options: readonly { valeur: string; libelle: string; defaut?: boolean }[];
}) {
  return (
    <div className="admin-lecteur-email-bascule" role="radiogroup" aria-label={etiquette}>
      {options.map((o) => (
        <span key={o.valeur} className="admin-lecteur-email-choix">
          <input
            type="radio"
            name={nom}
            id={`${nom}-${o.valeur}`}
            value={o.valeur}
            form={`${nom}-hors-formulaire`}
            defaultChecked={o.defaut === true}
          />
          <label htmlFor={`${nom}-${o.valeur}`}>{o.libelle}</label>
        </span>
      ))}
    </div>
  );
}

function normaliserPieces(
  liste: readonly (string | PieceJointeApercu)[] | null | undefined,
): PieceJointeApercu[] | null {
  if (!liste) return null;
  return liste.map((p) => (typeof p === "string" ? { nom: p } : p)).filter((p) => p.nom !== "");
}

function PiecesJointes({ pieces }: { pieces: readonly PieceJointeApercu[] }) {
  if (pieces.length === 0) return <>Aucune pièce jointe</>;
  return (
    <ul className="admin-lecteur-email-pieces">
      {pieces.map((p, i) => (
        <li key={`${i}-${p.nom}`}>
          <span>{p.nom}</span>
          {typeof p.taille === "number" ? <span> ({libelleTaille(p.taille)})</span> : null}
          {p.remarque ? <span> : {p.remarque}</span> : null}
          {p.href ? (
            <>
              {" "}
              <a
                className="admin-lecteur-email-ouvrir"
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ouvrir ${p.nom} dans un nouvel onglet`}
              >
                Ouvrir
              </a>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ListeLiens({ html }: { html: string }) {
  const liens = extraireLiens(html);
  return (
    <section className="admin-lecteur-email-liens" aria-label="Liens de cet e-mail">
      <h3>Liens de cet e-mail</h3>
      {liens.length === 0 ? (
        <p>Cet e-mail ne contient aucun lien.</p>
      ) : (
        <ul>
          {liens.map((l, i) => (
            <li key={`${i}-${l.adresse}`}>
              <span>{l.texte}</span>
              {" → "}
              {l.genre === "ouvrable" ? (
                <a
                  href={l.adresse}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${l.texte} : ${l.adresse} (s'ouvre dans un nouvel onglet)`}
                >
                  {l.adresse}
                </a>
              ) : (
                <span>{l.adresse}</span>
              )}
              {l.genre === "personnel" ? (
                <em className="admin-lecteur-email-lien-note"> lien personnel du destinataire</em>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const present = (v: string | null | undefined): v is string => typeof v === "string" && v !== "";

export function LecteurEmail(props: LecteurEmailProps): React.ReactElement {
  const {
    apercu,
    titre,
    pleinEcranHref,
    formatInitial = "html",
    liensInertes = false,
    liensOuvrables = false,
  } = props;
  const html = props.html ?? apercu?.html ?? "";
  const texte = props.texte ?? apercu?.texte ?? null;
  const de = props.de ?? apercu?.de;
  const a = props.a ?? apercu?.a;
  const repondreA = props.repondreA ?? apercu?.repondreA;
  const objet = props.objet ?? apercu?.objet;
  const preEntete = props.preEntete ?? apercu?.preEntete;
  const piecesJointes = props.piecesJointes ?? apercu?.piecesJointes;
  const id = useId();
  const imagesBloquees = compterImagesBloquees(html);
  const titreCadre = titre ?? (present(objet) ? `Aperçu : ${objet}` : "Aperçu de l'e-mail");
  const pieces = normaliserPieces(piecesJointes);
  const aTexte = present(texte);
  const aEntete =
    present(de) ||
    present(a) ||
    present(repondreA) ||
    present(objet) ||
    present(preEntete) ||
    pieces !== null;
  return (
    <div className="admin-apercu-email admin-lecteur-email" data-bloc="lecteur-email">
      {aEntete ? (
        <dl className="admin-apercu-email-enveloppe">
          {present(de) ? <Ligne libelle="De">{de}</Ligne> : null}
          {present(a) ? <Ligne libelle="À">{a}</Ligne> : null}
          {present(repondreA) ? <Ligne libelle="Répondre à">{repondreA}</Ligne> : null}
          {present(objet) ? (
            <Ligne libelle="Objet">
              <strong>{objet}</strong>
            </Ligne>
          ) : null}
          {present(preEntete) ? <Ligne libelle="Pré-en-tête">{preEntete}</Ligne> : null}
          {pieces !== null ? (
            <Ligne libelle="Pièces jointes">
              <PiecesJointes pieces={pieces} />
            </Ligne>
          ) : null}
        </dl>
      ) : null}
      <div className="admin-lecteur-email-barre">
        <Bascule
          nom={`${id}-largeur`}
          etiquette="Largeur de l'aperçu"
          options={[
            { valeur: "ordinateur", libelle: "Ordinateur", defaut: true },
            { valeur: "telephone", libelle: "Téléphone" },
          ]}
        />
        <Bascule
          nom={`${id}-theme`}
          etiquette="Thème de l'aperçu"
          options={[
            { valeur: "clair", libelle: "Clair", defaut: true },
            { valeur: "sombre", libelle: "Sombre" },
          ]}
        />
        {aTexte ? (
          <Bascule
            nom={`${id}-format`}
            etiquette="Version affichée"
            options={[
              { valeur: "html", libelle: "HTML", defaut: formatInitial !== "texte" },
              { valeur: "texte", libelle: "Texte brut", defaut: formatInitial === "texte" },
            ]}
          />
        ) : null}
      </div>
      {imagesBloquees > 0 || pleinEcranHref ? (
        <div className="admin-lecteur-email-notes">
          {imagesBloquees > 0 ? (
            <p className="admin-lecteur-email-note" role="note">
              {imagesBloquees === 1
                ? "1 image hébergée ailleurs n'est pas affichée dans l'aperçu ; elle le sera chez le destinataire."
                : `${imagesBloquees} images hébergées ailleurs ne sont pas affichées dans l'aperçu ; elles le seront chez le destinataire.`}
            </p>
          ) : null}
          {pleinEcranHref ? (
            <a
              className="admin-lecteur-email-plein-ecran"
              href={pleinEcranHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir en plein écran
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="admin-lecteur-email-scene">
        <iframe
          className="admin-lecteur-email-cadre"
          title={titreCadre}
          sandbox={liensOuvrables ? "allow-popups allow-popups-to-escape-sandbox" : ""}
          referrerPolicy="no-referrer"
          srcDoc={preparerSrcDoc(html, { liensInertes, liensOuvrables })}
        />
        {aTexte ? <pre className="admin-lecteur-email-texte">{texte}</pre> : null}
      </div>
      {liensOuvrables ? <ListeLiens html={html} /> : null}
    </div>
  );
}
