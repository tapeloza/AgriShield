import React, { useEffect, useState } from 'react';
import { loadState, saveState } from './db.js';
import { publishPublication, removePublication, watchPublications } from './cloud.js';

const permissionLabels = {
  pending: 'Permission pending',
  granted: 'Permission recorded',
  restricted: 'Restricted',
};

export default function Publications({ uid, auth }) {
  const key = 'publications:' + uid;
  const [items, setItems] = useState([]);
  const [published, setPublished] = useState([]);
  const [publicReady, setPublicReady] = useState(false);
  const [pending, setPending] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [permission, setPermission] = useState('pending');

  useEffect(() => {
    let active = true;
    loadState(key).then(saved => {
      if (!active) return;
      setItems(saved ?? []);
      setReady(true);
    }).catch(() => {
      if (active) setMessage('Publication drafts could not be loaded.');
    });
    return () => { active = false; };
  }, [key]);

  useEffect(() => watchPublications(auth, uid, (entries, fromCache) => {
    setPublished(entries);
    setPublicReady(!fromCache);
  }, () => setPublicReady(false)), [auth, uid]);

  const publicById = new Map(published.map(item => [item.id, item]));
  const localIds = new Set(items.map(item => item.id));
  const recent = [
    ...published.map(item => ({ ...item, time: item.publishedAt?.toMillis() ?? 0, public: true })),
    ...items.filter(item => !publicById.has(item.id)),
  ].sort((a, b) => b.time - a.time);

  async function confirmAction() {
    const { action, item } = pending;
    if ((action === 'publish' || item.public) && !navigator.onLine) {
      setMessage('Connect to the internet to change the public feed.');
      return;
    }
    setActionBusy(true);
    setMessage('');
    try {
      if (action === 'publish') {
        await publishPublication(auth, uid, item);
        setMessage('Published to the public Local Guide news feed.');
      } else {
        setPending(null);
        if (item.public) await removePublication(auth, item.id);
        if (localIds.has(item.id)) {
          const next = items.filter(entry => entry.id !== item.id);
          await saveState(key, next);
          setItems(next);
        }
        setMessage(item.public ? 'Publication removed from the public feed.' : 'Draft deleted.');
      }
      setPending(null);
    } catch {
      setMessage('Could not complete the action. Check your connection and the Firestore publication rules.');
    } finally {
      setActionBusy(false);
    }
  }

  async function create(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = values.get('title').trim();
    const provenance = values.get('provenance').trim();
    if (!title || !provenance) {
      setMessage('Enter a title and a source or provenance note.');
      return;
    }
    const next = [{
      id: crypto.randomUUID(), title, provenance, permission,
      content: permission === 'granted' ? values.get('content').trim() : '',
      time: Date.now(),
    }, ...items];
    setSaving(true);
    try {
      await saveState(key, next);
      setItems(next);
      setWriting(false);
      setMessage('Publication draft saved privately on this device.');
    } catch {
      setMessage('Could not save the publication draft.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <p className="workspace-label">IKS Specialist</p>
        <h1>Publications</h1>
        <p>Record provenance and permissions for Indigenous Knowledge Systems publications.</p>
        {!writing && <button className="publication-create" disabled={!ready} onClick={() => {
          setPermission('pending');
          setMessage('');
          setWriting(true);
        }}>Create a publication</button>}
      </div>
    </section>
    {writing && <section className="card history" aria-labelledby="publication-new">
      <h2 id="publication-new">Create a publication</h2>
      <form onSubmit={create}>
        <fieldset disabled={saving}>
          <label htmlFor="publication-title">Title</label>
          <input id="publication-title" name="title" required maxLength={150} />
          <label htmlFor="publication-provenance">Source or provenance</label>
          <input id="publication-provenance" name="provenance" required maxLength={250} />
          <label htmlFor="publication-permission">Knowledge-holder permission</label>
          <select id="publication-permission" value={permission} onChange={event => setPermission(event.target.value)}>
            {Object.entries(permissionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {permission === 'granted' ? <>
            <label htmlFor="publication-content">Draft text</label>
            <textarea id="publication-content" name="content" rows={6} maxLength={12000} required />
          </> : <p className="monitor-note">Only the publication metadata is saved while permission is pending or restricted.</p>}
          <div className="account-links">
            <button className="primary">Save draft</button>
            <button type="button" onClick={() => setWriting(false)}>Cancel</button>
          </div>
        </fieldset>
      </form>
    </section>}
    <p className="feedback" role="status">{message}</p>
    <section className="card history" aria-labelledby="publication-recent">
      <h2 id="publication-recent">Recent publications</h2>
      {!recent.length ? <p>No publication drafts yet.</p> :
        <ul className="publication-list">{recent.map(item => <li key={item.id}>
          <div>
            <details>
              <summary>{item.title}</summary>
              <p>{item.provenance} · {permissionLabels[item.permission]}</p>
              {item.content && <p className="publication-text">{item.content}</p>}
            </details>
            <small>{item.public ? 'Public in Local Guide' : 'Private draft'} · {new Date(item.time).toLocaleDateString('en-ZA')}</small>
            <div className="account-links">
              {item.public ? <a href="/guide#news-heading">Open public feed</a>
                : <button type="button" disabled={actionBusy || !publicReady || item.permission !== 'granted' || !item.content}
                  onClick={() => setPending({ action: 'publish', item })}>Publish to Local Guide</button>}
              <button type="button" className="danger-button" disabled={actionBusy || !ready || !publicReady}
                onClick={() => setPending({ action: 'delete', item })}>Delete</button>
            </div>
            {pending?.item.id === item.id && <div className="publication-confirm">
              <p>{pending.action === 'publish'
                ? 'Publish the title, source and draft text for anyone to read?'
                : item.public ? 'Remove this publication from the public feed and delete its local draft?' : 'Delete this draft from this device?'}</p>
              <div className="account-links">
                <button type="button" className={pending.action === 'publish' ? 'primary' : 'danger-button'}
                  disabled={actionBusy} onClick={confirmAction}>{pending.action === 'publish' ? 'Confirm publication' : 'Confirm delete'}</button>
                <button type="button" disabled={actionBusy} onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>}
          </div>
        </li>)}</ul>}
      {!publicReady && <p className="monitor-note">Connect to the public feed to publish or delete a publication.</p>}
    </section>
  </>;
}
