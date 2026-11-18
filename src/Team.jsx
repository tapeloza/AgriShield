import React, { useEffect, useState } from 'react';
import { useLanguage } from './Language.jsx';
import { loadState, saveState } from './db.js';

export default function Team({ uid }) {
  const { t } = useLanguage();
  const key = 'team:' + uid;
  const [members, setMembers] = useState([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    loadState(key).then(saved => {
      if (!active) return;
      setMembers(saved ?? []);
      setReady(true);
    }).catch(() => {
      if (active) setMessage('Could not load the team roster on this device.');
    });
    return () => { active = false; };
  }, [key]);

  async function add(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = fields.get('name').trim();
    const email = fields.get('email').trim().toLowerCase();
    const role = fields.get('role');
    if (!name) {
      setMessage('Enter the team member’s name.');
      return;
    }
    if (members.some(member => member.email === email)) {
      setMessage('This email is already on the roster.');
      return;
    }
    setSaving(true);
    try {
      const next = [...members, { name, email, role }];
      await saveState(key, next);
      setMembers(next);
      form.reset();
      setMessage('Team member added to this device’s roster.');
    } catch {
      setMessage('Could not save the team member. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <h1>{t("Farm team")}</h1>
    <p className="intro">Keep a roster on this device. Shared access and invitations are not enabled.</p>
    <div className="profile-grid">
      <section className="card" aria-labelledby="team-add">
        <h2 id="team-add">{t("Add a team member")}</h2>
        <form onSubmit={add}>
          <fieldset disabled={!ready || saving}>
            <label htmlFor="team-name">{t("Full name")}</label>
            <input id="team-name" name="name" required maxLength={100} />
            <label htmlFor="team-email">{t("Email address")}</label>
            <input id="team-email" name="email" type="email" required maxLength={254} />
            <label htmlFor="team-role">{t("Farm role")}</label>
            <select id="team-role" name="role">
              <option>Farm manager</option><option>Field operator</option><option>Advisor</option>
            </select>
            <button className="primary wide">{t("Add to roster")}</button>
          </fieldset>
          <p className="feedback" role="status">{message}</p>
        </form>
      </section>
      <section className="card history team-roster" aria-labelledby="team-list">
        <h2 id="team-list">{t("Team roster")}</h2>
        {members.length ? <ul>{members.map(member => <li key={member.email}>
          <div><strong>{member.name}</strong><small>{member.email}</small></div>
          <span>{member.role}</span>
        </li>)}</ul> : <p>No team members added yet.</p>}
      </section>
    </div>
  </>;
}
