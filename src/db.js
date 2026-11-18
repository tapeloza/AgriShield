const opening = new Promise((resolve, reject) => {
  const request = indexedDB.open('agrishield', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('workspace');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Close older AgriShield tabs to enable storage.'));
});
opening.catch(() => {});

async function transaction(mode, operation) {
  const database = await opening;
  return new Promise((resolve, reject) => {
    const tx = database.transaction('workspace', mode);
    const request = operation(tx.objectStore('workspace'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
  });
}

export const loadState = key => transaction('readonly', store => store.get(key));
export const saveState = (key, state) => transaction('readwrite', store => store.put(state, key));
