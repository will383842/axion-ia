// Template : src/server/image-bank/utils/pleonasm.ts
//
// Détection de pléonasme à l'amorce d'un alt text.
//
// Ne rejette PAS « photo de groupe », « image of Paris », qui sont des
// descriptions factuelles parfaitement légitimes.
//
// Cible les amorces vides type :
//   - « image of this picture »
//   - « image of an image »
//   - « photo de cette image »
//   - « image montrant une photo »

const PLEONASM_RE =
  /^(image of (this|an? )?(image|picture|photo)|photo de (cette|une? )?(image|photo)|image montrant (cette|une? )?(image|photo))/i;

export function isPleonasm(text: string): boolean {
  return PLEONASM_RE.test(text);
}
