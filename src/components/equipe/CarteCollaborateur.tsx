import Link from "next/link";
import type { FichePublique } from "@/lib/equipe";
import { PastilleCategorie } from "./PastilleCategorie";
import { PortraitCollaborateur } from "./PortraitCollaborateur";

/** Carte de personne du hub : portrait 96 px, nom en titre, fonction, ville, un seul lien. */
export function CarteCollaborateur({
  fiche,
  href,
  niveauTitre = "h3",
}: {
  fiche: FichePublique;
  href: string;
  niveauTitre?: "h2" | "h3" | "h4";
}) {
  const Titre = niveauTitre;
  return (
    <article className="border-border bg-paper flex items-start gap-4 rounded-2xl border p-4">
      <PortraitCollaborateur
        fiche={fiche}
        sizes="96px"
        decoratif
        className="h-24 w-24 shrink-0 rounded-2xl"
      />
      <div className="min-w-0">
        <PastilleCategorie categorie={fiche.categorie} />
        <Titre className="text-fg mt-1 text-lg font-semibold">
          <Link href={href} className="underline-offset-2 hover:underline">
            {fiche.nom}
          </Link>
        </Titre>
        {fiche.fonction ? <p className="text-fg-soft text-[15px]">{fiche.fonction}</p> : null}
        {fiche.ville ? <p className="text-fg-soft text-[15px]">{fiche.ville}</p> : null}
      </div>
    </article>
  );
}
