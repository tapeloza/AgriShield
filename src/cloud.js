import {
  collection, connectFirestoreEmulator, deleteDoc, doc, initializeFirestore, limit, onSnapshot,
  orderBy, persistentLocalCache, persistentMultipleTabManager, query, runTransaction, serverTimestamp, setDoc, where, writeBatch,
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
  return onSnapshot(readings, { includeMetadataChanges: true }, snapshot => {
    next(snapshot.docs.map(item => ({ ...item.data(), id: item.id })), snapshot.metadata.fromCache);
  }, failed);
}

export function saveCloudReading(auth, uid, reading) {
  const { id, sensorId, crop, time, source, moisture } = reading;
  return setDoc(doc(store(auth), 'accounts', uid, 'readings', id), { sensorId, crop, time, source, moisture });
}

export function watchSensors(auth, uid, next, failed) {
  return onSnapshot(collection(store(auth), 'accounts', uid, 'sensors'), { includeMetadataChanges: true }, next, failed);
}

export function saveCloudSensor(auth, uid, sensor, createIfMissing = false) {
  const { id, plot, bed, landmark, mapEmbed } = sensor;
  const db = store(auth);
  const ref = doc(db, 'accounts', uid, 'sensors', id);
  const fields = { plot, bed, landmark: landmark || '', ...(mapEmbed ? { mapEmbed } : {}) };
  if (!createIfMissing) return setDoc(ref, fields);
  return runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);
    if (!existing.exists()) transaction.set(ref, fields);
  });
}

export function saveSampleReadings(auth, uid, samples) {
  const db = store(auth);
  const batch = writeBatch(db);
  for (const { id, sensorId, crop, time, source, moisture } of samples) {
    batch.set(doc(db, 'accounts', uid, 'readings', id), { sensorId, crop, time, source, moisture });
  }
  return batch.commit();
}

export function watchPublications(auth, owner, next, failed) {
  const feed = collection(store(auth), 'publications');
  const selection = owner ? query(feed, where('owner', '==', owner))
    : query(feed, orderBy('publishedAt', 'desc'), limit(30));
  return onSnapshot(selection, { includeMetadataChanges: true }, snapshot => {
    const entries = snapshot.docs.filter(item => !item.metadata.hasPendingWrites)
      .map(item => ({ ...item.data(), id: item.id }));
    next(entries, snapshot.metadata.fromCache);
  }, failed);
}

export function publishPublication(auth, uid, item) {
  const { id, title, provenance, content } = item;
  return setDoc(doc(store(auth), 'publications', id), {
    owner: uid, title, provenance, content, permission: 'granted', publishedAt: serverTimestamp(),
  });
}

export function removePublication(auth, id) {
  return deleteDoc(doc(store(auth), 'publications', id));
}
