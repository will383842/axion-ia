"use client";
// use-client: dessin canvas, FontFace, presse-papiers et téléchargements dans le navigateur.

// Les pièces de communication de l'apporteur : chaque pièce = un aperçu, un bouton
// (Télécharger ou Copier) et une phrase qui dit où la mettre. « Tout télécharger » rassemble
// tout dans une archive. Les images sont dessinées ici, dans le navigateur (`dessin.ts`).

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type Accord,
  bioInstagram,
  MENTION_VISUEL,
  MODE_EMPLOI,
  mention,
  signatureHtml,
  signatureTexte,
  textesPublication,
  TITRE_BANNIERE,
  titreLinkedin,
  VISUELS,
} from "@/features/apporteurs-reseau/outils-communication";

import {
  chargerRessources,
  dessinerFacebook,
  dessinerLinkedin,
  dessinerLogo,
  dessinerVisuel,
  enPng,
  type Ressources,
} from "./dessin";
import { creerZip, type FichierZip } from "./zip";

const BOUTON =
  "bg-terracotta-deep inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[16px] font-bold text-white";
const BOUTON_CLAIR =
  "border-terracotta-deep text-terracotta-deep inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 px-5 text-[16px] font-bold";

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Une image dessinée dans un canvas, affichée en aperçu, téléchargeable en PNG. */
function PieceImage({
  dessiner,
  nomFichier,
  libelle,
  aide,
  ressources,
}: {
  dessiner: (c: HTMLCanvasElement, r: Ressources) => void;
  nomFichier: string;
  libelle: string;
  aide: string;
  ressources: Ressources | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ressources && ref.current) dessiner(ref.current, ressources);
  }, [dessiner, ressources]);
  return (
    <li className="border-border bg-paper grid gap-3 rounded-2xl border p-4">
      <p className="font-semibold">{libelle}</p>
      <canvas ref={ref} className="bg-ink h-auto w-full rounded-lg" aria-label={libelle} />
      <p className="text-fg-soft text-[14px]">{aide}</p>
      <button
        type="button"
        disabled={!ressources}
        className={BOUTON}
        onClick={async () => ref.current && telecharger(await enPng(ref.current), nomFichier)}
      >
        ↓ Télécharger
      </button>
    </li>
  );
}

/** Un texte à copier, avec un bouton qui confirme la copie. */
function Texte({
  libelle,
  texte,
  aide,
  html,
}: {
  libelle: string;
  texte: string;
  aide: string;
  html?: string;
}) {
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      if (html && "ClipboardItem" in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([texte], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(texte);
      }
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  };
  return (
    <li className="border-border bg-paper grid gap-3 rounded-2xl border p-4">
      <p className="font-semibold">{libelle}</p>
      {html ? (
        <div className="rounded-lg bg-white p-4" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="bg-sand rounded-lg p-4 text-[15px] whitespace-pre-line">{texte}</p>
      )}
      <p className="text-fg-soft text-[14px]">{aide}</p>
      <button type="button" className={BOUTON_CLAIR} onClick={copier} aria-live="polite">
        {copie ? "✓ Copié" : "Copier"}
      </button>
    </li>
  );
}

export function OutilsCommunication({ nomComplet }: { nomComplet: string }) {
  const [ressources, setRessources] = useState<Ressources | null>(null);
  const [erreur, setErreur] = useState(false);
  const [accord, setAccord] = useState<Accord>("m");
  const [archive, setArchive] = useState<"repos" | "en_cours">("repos");

  useEffect(() => {
    chargerRessources().then(setRessources, () => setErreur(true));
  }, []);

  const dessinLinkedin = useCallback(
    (c: HTMLCanvasElement, r: Ressources) =>
      dessinerLinkedin(c, r, nomComplet, TITRE_BANNIERE, mention(accord)),
    [nomComplet, accord],
  );
  const dessinFacebook = useCallback(
    (c: HTMLCanvasElement, r: Ressources) =>
      dessinerFacebook(c, r, nomComplet, TITRE_BANNIERE, mention(accord)),
    [nomComplet, accord],
  );

  const toutTelecharger = async () => {
    if (!ressources) return;
    setArchive("en_cours");
    try {
      const c = document.createElement("canvas");
      const png = async (
        nom: string,
        dessiner: (x: HTMLCanvasElement) => void,
      ): Promise<FichierZip> => {
        dessiner(c);
        return { nom, octets: new Uint8Array(await (await enPng(c)).arrayBuffer()) };
      };
      const fichiers: FichierZip[] = [
        await png("banniere-linkedin.png", (x) => dessinLinkedin(x, ressources)),
        await png("couverture-facebook.png", (x) => dessinFacebook(x, ressources)),
      ];
      for (const v of VISUELS) {
        fichiers.push(
          await png(`visuels/${v.cle}.png`, (x) =>
            dessinerVisuel(x, ressources, v, "carre", MENTION_VISUEL),
          ),
        );
      }
      fichiers.push(
        await png("story.png", (x) =>
          dessinerVisuel(x, ressources, VISUELS[0]!, "story", MENTION_VISUEL),
        ),
      );
      fichiers.push(
        await png("logo/axion-ia-logo-1024.png", (x) => dessinerLogo(x, ressources, 1024)),
      );
      const svg = await fetch("/images/axion-ia-logo-vectoriel-couleur.svg").then((r) =>
        r.arrayBuffer(),
      );
      fichiers.push({ nom: "logo/axion-ia-logo.svg", octets: new Uint8Array(svg) });
      const textes = [
        `BIO INSTAGRAM\n${bioInstagram(accord)}`,
        `TITRE LINKEDIN\n${titreLinkedin(accord)}`,
        `SIGNATURE D'E-MAIL\n${signatureTexte(nomComplet, accord)}`,
        ...textesPublication(accord).map(
          (t) => `PUBLICATION — ${t.libelle.toUpperCase()}\n${t.texte}`,
        ),
      ].join("\n\n────────\n\n");
      fichiers.push({ nom: "textes.txt", octets: new TextEncoder().encode(textes) });
      const zip = creerZip(fichiers);
      telecharger(
        new Blob([zip], { type: "application/zip" }),
        "axion-ia-outils-de-communication.zip",
      );
    } finally {
      setArchive("repos");
    }
  };

  if (erreur) {
    return (
      <p className="text-fg-soft mt-6">
        Les images n&apos;ont pas pu se préparer. Rechargez la page ; si cela continue,
        écrivez-nous.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-8">
      <fieldset className="grid gap-2">
        <legend className="font-semibold">
          Votre mention, sur la bannière, la couverture et la signature
        </legend>
        <div className="flex flex-wrap gap-3">
          {(["m", "f"] as const).map((a) => (
            <label
              key={a}
              className="border-border bg-paper flex min-h-[48px] items-center gap-2 rounded-xl border px-4"
            >
              <input
                type="radio"
                name="accord"
                checked={accord === a}
                onChange={() => setAccord(a)}
              />
              {a === "m"
                ? "Apporteur d'affaires indépendant"
                : "Apporteuse d'affaires indépendante"}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        disabled={!ressources || archive === "en_cours"}
        className={BOUTON}
        onClick={toutTelecharger}
      >
        {archive === "en_cours" ? "Préparation…" : "↓ Tout télécharger (images, logo et textes)"}
      </button>

      <section className="grid gap-3">
        <h2 className="font-serif text-[22px] font-medium">À votre nom</h2>
        <ul className="grid gap-4">
          <PieceImage
            dessiner={dessinLinkedin}
            nomFichier="banniere-linkedin.png"
            libelle="Bannière LinkedIn"
            aide={MODE_EMPLOI.linkedin}
            ressources={ressources}
          />
          <PieceImage
            dessiner={dessinFacebook}
            nomFichier="couverture-facebook.png"
            libelle="Couverture Facebook"
            aide={MODE_EMPLOI.facebook}
            ressources={ressources}
          />
          <Texte
            libelle="Signature d'e-mail"
            texte={signatureTexte(nomComplet, accord)}
            html={signatureHtml(nomComplet, accord)}
            aide={MODE_EMPLOI.signature}
          />
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-[22px] font-medium">Visuels de publication</h2>
        <p className="text-fg-soft text-[15px]">{MODE_EMPLOI.visuels}</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {VISUELS.map((v) => (
            <PieceImage
              key={v.cle}
              dessiner={(c, r) => dessinerVisuel(c, r, v, "carre", MENTION_VISUEL)}
              nomFichier={`axion-ia-${v.cle}.png`}
              libelle={v.libelle}
              aide="Format carré : Facebook, Instagram, LinkedIn."
              ressources={ressources}
            />
          ))}
          <PieceImage
            dessiner={(c, r) => dessinerVisuel(c, r, VISUELS[0]!, "story", MENTION_VISUEL)}
            nomFichier="axion-ia-story.png"
            libelle="Story"
            aide={MODE_EMPLOI.story}
            ressources={ressources}
          />
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-[22px] font-medium">Textes prêts à copier</h2>
        <ul className="grid gap-4">
          <Texte libelle="Bio Instagram" texte={bioInstagram(accord)} aide={MODE_EMPLOI.bio} />
          <Texte
            libelle="Titre de votre profil LinkedIn"
            texte={titreLinkedin(accord)}
            aide={MODE_EMPLOI.titreLinkedin}
          />
          {textesPublication(accord).map((t) => (
            <Texte
              key={t.cle}
              libelle={`Publication — ${t.libelle}`}
              texte={t.texte}
              aide={MODE_EMPLOI.textes}
            />
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-[22px] font-medium">Logo</h2>
        <ul className="grid gap-4">
          <PieceImage
            dessiner={(c, r) => dessinerLogo(c, r, 1024)}
            nomFichier="axion-ia-logo-1024.png"
            libelle="Logo (PNG, fond transparent)"
            aide={MODE_EMPLOI.logos}
            ressources={ressources}
          />
        </ul>
        <a
          href="/images/axion-ia-logo-vectoriel-couleur.svg"
          download="axion-ia-logo.svg"
          className={BOUTON_CLAIR}
        >
          ↓ Logo vectoriel (SVG, pour l&apos;impression)
        </a>
      </section>
    </div>
  );
}
