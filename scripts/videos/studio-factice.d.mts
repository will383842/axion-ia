export function sha256Hex(corps: string | Buffer): string;
export function signer(o: {
  secret: string;
  horodatage: string;
  nonce: string;
  methode: string;
  chemin: string;
  corps: string;
}): string;
export function entetesSignes(o: {
  secret: string;
  methode: string;
  chemin: string;
  corps?: string;
  horodatage?: number;
  nonce?: string;
}): Record<string, string>;
export function fabriquerFichiers(dossier: string): Record<string, number>;
export function servirFichiers(racine: string): Promise<{
  origine: string;
  compteurs: { head: number; get: number; range: number };
  arreter: () => Promise<void>;
}>;
export function construirePublication(o: {
  slug: string;
  version?: number;
  studioVideoId?: string;
  tailles: Record<string, number>;
  theme?: string;
  sousTitresOctets?: number;
  surcharge?: Record<string, unknown>;
}): Record<string, unknown>;
export function deposer(o: {
  racineServie: string;
  slug: string;
  version?: number;
  dossierSource: string;
}): number;
