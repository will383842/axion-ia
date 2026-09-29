// Stockage LOCAL de l'extension (IndexedDB) : le son en attente d'envoi, la
// file et l'état des captures. Partagé par le service worker et le document
// offscreen (même origine chrome-extension://).
//
// Le son n'y reste que le temps de l'envoi. Il est DÉTRUIT :
//   · sans accord à 3 minutes, et sur « Refus » (immédiatement) ;
//   · 24 h après la fin si aucune rencontre autorisée n'a été trouvée (cas A) ;
//   · dès que le site a accusé réception du morceau.

const NOM = "enregistreur-meet";
const VERSION = 1;

function ouvrir() {
  return new Promise((resoudre, rejeter) => {
    const req = indexedDB.open(NOM, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("file")) {
        const file = db.createObjectStore("file", { keyPath: "id" });
        file.createIndex("cleClient", "cleClient");
      }
      if (!db.objectStoreNames.contains("captures"))
        db.createObjectStore("captures", { keyPath: "cleClient" });
    };
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error);
  });
}

async function transaction(stores, mode, travail) {
  const db = await ouvrir();
  return new Promise((resoudre, rejeter) => {
    const tx = db.transaction(stores, mode);
    let resultat;
    Promise.resolve(travail(tx))
      .then((r) => {
        resultat = r;
      })
      .catch(rejeter);
    tx.oncomplete = () => {
      db.close();
      resoudre(resultat);
    };
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error);
  });
}

function demande(req) {
  return new Promise((resoudre, rejeter) => {
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error);
  });
}

/** Ajoute un élément à la file (un morceau porte ses octets dans `octets`). */
export function ajouterALaFile(element) {
  return transaction(["file"], "readwrite", (tx) => demande(tx.objectStore("file").put(element)));
}

export function lireLaFile() {
  return transaction(["file"], "readonly", (tx) => demande(tx.objectStore("file").getAll()));
}

export function retirerDeLaFile(id) {
  return transaction(["file"], "readwrite", (tx) => demande(tx.objectStore("file").delete(id)));
}

export function mettreAJourElement(element) {
  return ajouterALaFile(element);
}

/** DÉTRUIT tout ce qui appartient à une capture : son, file, état. */
export function detruireCapture(cleClient) {
  return transaction(["file", "captures"], "readwrite", async (tx) => {
    const index = tx.objectStore("file").index("cleClient");
    const cles = await demande(index.getAllKeys(IDBKeyRange.only(cleClient)));
    for (const cle of cles) tx.objectStore("file").delete(cle);
    const c = await demande(tx.objectStore("captures").get(cleClient));
    if (c) tx.objectStore("captures").put({ ...c, detruit: true });
  });
}

export function ecrireCapture(capture) {
  return transaction(["captures"], "readwrite", (tx) =>
    demande(tx.objectStore("captures").put(capture)),
  );
}

export async function lireCaptures() {
  const liste = await transaction(["captures"], "readonly", (tx) =>
    demande(tx.objectStore("captures").getAll()),
  );
  return Object.fromEntries(liste.map((c) => [c.cleClient, c]));
}

/** Pour le battement : taille de la file et âge du plus vieux élément. */
export async function mesurerLaFile(maintenantMs) {
  const file = await lireLaFile();
  const plusVieux = file.reduce((m, el) => Math.min(m, el.creeLe), Infinity);
  return {
    fileEnAttente: file.length,
    agePlusVieuxMs: file.length === 0 ? null : Math.max(0, maintenantMs - plusVieux),
  };
}
