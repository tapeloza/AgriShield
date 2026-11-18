import React, { useEffect, useState } from 'react';
import { loadState, saveState } from './db.js';

const permissionLabels = {
  pending: 'Permission pending',
  granted: 'Permission recorded',
  restricted: 'Restricted',
};

export default function Publications({ uid }) {
  const key = 'publications:' + uid;
  const [items, setItems] = useState([]);
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
      {!items.length ? <p>No publication drafts yet.</p> :
        <ul>{items.map(item => <li key={item.id}>
          <details>
            <summary>{item.title}</summary>
            <p>{item.provenance} · {permissionLabels[item.permission]}</p>
            {item.content && <p className="publication-text">{item.content}</p>}
          </details>
          <small>{new Date(item.time).toLocaleDateString('en-ZA')}</small>
        </li>)}</ul>}
    </section>
  </>;
}
