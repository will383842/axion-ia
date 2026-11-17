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

export interface LecteurEmailProps {
  /** Corps HTML complet de l'e-mail. */
  html: string;
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
  /** Noms des pièces jointes. */
  piecesJointes?: readonly string[] | null | undefined;
  /** Titre accessible du cadre. */
  titre?: string;
}

const ORIGINE_SITE = "https://axion-ia.com";

/** Origines d'images autorisées : le site, et l'origine configurée du châssis. */
function originesImages(): string[] {
  const liste = [ORIGINE_SITE];
  try {
    const configuree = process.env.NEXT_PUBLIC_SITE_URL;
    if (configuree) {
      const o = new URL(configuree).origin;
      if (o !== "null" && !liste.includes(o)) liste.push(o);
    }
  } catch {
    // URL invalide : on garde le seul domaine du site.
  }
  return liste;
}

/** Balises posées en tête du document (après un éventuel doctype, pour ne pas
 *  basculer l'e-mail en mode quirks). */
export function preparerSrcDoc(html: string): string {
  const csp = `default-src 'none'; img-src data: ${originesImages().join(" ")}; style-src 'unsafe-inline'`;
  const balises =
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta name="color-scheme" content="light dark">`;
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

const present = (v: string | null | undefined): v is string => typeof v === "string" && v !== "";

export function LecteurEmail({
  html,
  texte = null,
  de,
  a,
  repondreA,
  objet,
  preEntete,
  piecesJointes,
  titre,
}: LecteurEmailProps): React.ReactElement {
  const id = useId();
  const titreCadre = titre ?? (present(objet) ? `Aperçu : ${objet}` : "Aperçu de l'e-mail");
  const pieces = (piecesJointes ?? []).filter((p) => p !== "");
  const aTexte = present(texte);
  const aEntete =
    present(de) ||
    present(a) ||
    present(repondreA) ||
    present(objet) ||
    present(preEntete) ||
    pieces.length > 0;
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
          {pieces.length > 0 ? <Ligne libelle="Pièces jointes">{pieces.join(", ")}</Ligne> : null}
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
              { valeur: "html", libelle: "HTML", defaut: true },
              { valeur: "texte", libelle: "Texte brut" },
            ]}
          />
        ) : null}
      </div>
      <div className="admin-lecteur-email-scene">
        <iframe
          className="admin-lecteur-email-cadre"
          title={titreCadre}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={preparerSrcDoc(html)}
        />
        {aTexte ? <pre className="admin-lecteur-email-texte">{texte}</pre> : null}
      </div>
    </div>
  );
}
