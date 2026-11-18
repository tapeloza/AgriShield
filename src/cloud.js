import {
  collection, connectFirestoreEmulator, doc, initializeFirestore, limit, onSnapshot,
  orderBy, persistentLocalCache, persistentMultipleTabManager, query, setDoc,
} from 'firebase/firestore';

let database;
function store(auth) {
  if (database) return database;
  database = initializeFirestore(auth.app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const emulator = import.meta.env.DEV && import.meta.env.VITE_FIRESTORE_EMULATOR_URL;
  if (emulator) {
    const { hostname, port } = new URL(emulator);
    connectFirestoreEmulator(database, hostname, Number(port));
  }
  return database;
}

export function watchRole(auth, uid, next, failed) {
  return onSnapshot(doc(store(auth), 'accounts', uid), { includeMetadataChanges: true }, next, failed);
}

export function saveSpecialistRole(auth, uid) {
  return setDoc(doc(store(auth), 'accounts', uid), { role: 'specialist' });
}

export function watchReadings(auth, uid, next, failed) {
  const readings = query(collection(store(auth), 'accounts', uid, 'readings'), orderBy('time', 'desc'), limit(100));
  return onSnapshot(readings, snapshot => next(snapshot.docs.map(item => ({ ...item.data(), id: item.id }))), failed);
}

export function saveCloudReading(auth, uid, reading) {
  const { id, sensorId, crop, time, source, moisture } = reading;
  return setDoc(doc(store(auth), 'accounts', uid, 'readings', id), { sensorId, crop, time, source, moisture });
}
