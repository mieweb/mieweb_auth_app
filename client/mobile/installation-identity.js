// Non-migrating installation identity (migration-plan.md Phase 2).
//
// An ECDSA P-256 keypair generated on this installation. The private key is
// non-extractable: IndexedDB stores the CryptoKey handle, so key material is
// never exposed to JS, localStorage, or the Meteor bundle.
//
// STORAGE GUARANTEE (documented per plan): WebView IndexedDB is excluded from
// iCloud/Android cloud backups on current OS versions, but this is weaker
// than a Keychain kSecAttrAccessible...ThisDeviceOnly item. Upgrading storage
// to a secure-storage Cordova plugin is tracked in migration-plan.md Phase 0.

const DB_NAME = "mieauth-identity";
const STORE = "identity";
const KEY_ID = "installation-identity-v1";

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbGet = async (db) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY_ID);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbPut = async (db, value) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const request = tx.objectStore(STORE).put(value, KEY_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const generateIdentity = async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false, // non-extractable private key
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return {
    installationId: crypto.randomUUID(),
    publicKeyB64: bufferToBase64(spki),
    privateKey: keyPair.privateKey,
    createdAt: new Date(),
  };
};

/**
 * Load or create this installation's identity.
 * @returns {Promise<{installationId: string, publicKeyB64: string, sign: (message: string) => Promise<string>}>}
 */
export const getOrCreateIdentity = async () => {
  const db = await openDb();
  let record = await idbGet(db);
  if (!record?.privateKey) {
    record = await generateIdentity();
    await idbPut(db, record);
  }
  db.close();

  return {
    installationId: record.installationId,
    publicKeyB64: record.publicKeyB64,
    // Server verifies with SHA-256 over the UTF-8 message, P1363 encoding —
    // exactly what WebCrypto ECDSA produces.
    sign: async (message) => {
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        record.privateKey,
        new TextEncoder().encode(message),
      );
      return bufferToBase64(signature);
    },
  };
};
