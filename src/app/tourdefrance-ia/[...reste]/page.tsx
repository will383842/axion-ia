// Toute adresse inconnue sous `/tourdefrance-ia/…` → la 404 PROPRE au Tour
// (`../not-found.tsx`). Sans ce segment, Next rendrait la 404 racine du site.

import { notFound } from "next/navigation";

export default function TourAdresseInconnue(): never {
  notFound();
}
