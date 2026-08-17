// Lot 4 — squelette d'attente PROPRE A CETTE ROUTE.
//
// 🔴 Avant ce lot, un seul `loading.tsx` existait, au niveau `[adminPrefix]` :
// c'etait tout ou rien. Il affichait trois cartes generiques quelle que soit la
// destination — y compris devant une table. Deux consequences : la mise en page
// SAUTE a l'arrivee du vrai contenu (le squelette n'a pas la forme de ce qu'il
// annonce, donc du CLS, que le budget du depot fixe a 0), et rien ne dit ou
// l'on vient d'atterrir.
//
// Table de creances.
//
// ⚠️ Ce bloc ANNONCE (pas de `announce={false}`), et c'est deliberé. En App
// Router, une navigation ne montre QU'UNE seule frontiere d'attente : la plus
// proche du segment qui change. Rendre celle-ci muette rendrait muette toute
// navigation interne a cette section. Le `announce={false}` est reserve aux
// sections MULTIPLES d'une meme page, ou plusieurs attentes coexistent.
//
// Server Component.

import { AdminLoadingState } from "@/components/admin/ui";

export default function Loading(): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-[var(--space-admin-6)] py-[var(--space-admin-7)]">
      <AdminLoadingState
        variant="table"
        count={8}
        cols={6}
        ariaLabel="Chargement de la facturation Qualiopi"
      />
    </div>
  );
}
