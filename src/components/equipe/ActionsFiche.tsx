import { ArrowRight } from "lucide-react";
import { Cta } from "@/components/marketing/Cta";
import type { ContenuFiche, FichePublique } from "@/lib/equipe";

/**
 * Boutons d'action de la fiche (héros et appel final). Une catégorie qui déclare ses boutons
 * dans le registre les voit rendus ici ; sinon, les deux boutons par défaut (Williams, inchangés).
 */
export function ActionsFiche({
  fiche,
  contenu,
  emplacement,
}: {
  fiche: FichePublique;
  contenu: ContenuFiche;
  emplacement: "hero" | "cta";
}) {
  const { actions, bouton, boutonSecondaire } = contenu.appelFinal;
  const suivi = (suffixe: string) => `equipe-${fiche.slug}-${emplacement}-${suffixe}`;
  if (actions && actions.length > 0) {
    return (
      <>
        {actions.map((a) => (
          <Cta
            key={a.href + a.libelle}
            href={a.href}
            variant={a.variante === "primaire" ? "terracotta" : "outline"}
            size="lg"
            track={suivi(a.href.replace(/^\//, "").replace(/\//g, "-") || "accueil")}
          >
            {a.libelle}
            {a.variante === "primaire" ? (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            ) : null}
          </Cta>
        ))}
      </>
    );
  }
  return (
    <>
      <Cta href="/appel" variant="terracotta" size="lg" track={suivi("appel")}>
        {bouton}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Cta>
      <Cta href="/contact" variant="outline" size="lg" track={suivi("contact")}>
        {boutonSecondaire}
      </Cta>
    </>
  );
}
