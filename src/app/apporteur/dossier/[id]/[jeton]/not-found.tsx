// La page NEUTRE du dossier en ligne (statut 404) : jeton faux ou révoqué, dossier
// inconnu, refusé ou résilié. La même page pour tous les cas — rien ne dit lequel.

import Link from "next/link";

import { Coquille, EcranInvalide } from "./Coquille";

export default function DossierIntrouvable() {
  return (
    <Coquille>
      <EcranInvalide />
      {/* Lien perdu ou périmé : renvoyer le bon, sans rien dire du cas (2026-10-09). */}
      <Link
        href="/apporteur/dossier/retrouver"
        className="text-terracotta-deep mt-6 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
      >
        Vous êtes apporteur du réseau ? Recevoir le lien de mon espace →
      </Link>
    </Coquille>
  );
}
