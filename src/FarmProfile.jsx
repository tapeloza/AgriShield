import React, { useEffect, useState } from 'react';
import { reload, signOut, verifyBeforeUpdateEmail } from 'firebase/auth';
import { loadState, saveState } from './db.js';
import { crops } from './model.js';

const empty = { business: '', location: '', crops: [], other: '' };

export default function FarmProfile({ user, auth }) {
  const key = 'profile:' + user.uid;
  const [profile, setProfile] = useState(empty);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [currentEmail, setCurrentEmail] = useState(user.email);
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState('');

  useEffect(() => {
    let active = true;
    loadState(key).then(saved => {
      if (active) {
        if (saved) setProfile({ ...empty, ...saved });
        setReady(true);
      }
    }).catch(() => {
      if (active) setProfileMessage('Farm details could not be loaded from this browser.');
    });
    reload(user).then(() => {
      if (active) setCurrentEmail(user.email);
    }).catch(() => {});
    return () => { active = false; };
  }, [key, user]);

  const update = (field, value) => setProfile(old => ({ ...old, [field]: value }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setProfileMessage('');
    try {
      await saveState(key, {
        ...profile, business: profile.business.trim(), location: profile.location.trim(), other: profile.other.trim(),
      });
      setProfileMessage('Farm details saved on this device.');
    } catch {
      setProfileMessage('Could not save farm details. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail(event) {
    event.preventDefault();
    const next = email.trim();
    if (next.toLowerCase() === currentEmail?.toLowerCase()) {
      setEmailMessage('Enter a different email address.');
      return;
    }
    setEmailBusy(true);
    setEmailMessage('');
    try {
      await verifyBeforeUpdateEmail(user, next);
      setEmail('');
      setEmailMessage('Verification link sent to ' + next + '. Open it to confirm the change.');
    } catch (error) {
      setEmailMessage(error.code === 'auth/requires-recent-login'
        ? 'Sign out and sign in again, then retry the email change.'
        : 'Could not send the verification link. Check the email address and your connection.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function leave() {
    setSignOutBusy(true);
    setSignOutMessage('');
    try { await signOut(auth); }
    catch {
      setSignOutBusy(false);
      setSignOutMessage('Could not sign out. Try again.');
    }
  }

  return <>
    <h1>Account</h1>
    <p className="intro">Manage your sign-in email and farm profile.</p>
    <div className="profile-grid">
      <section className="card" aria-labelledby="farm-details">
        <h2 id="farm-details">Business and crops</h2>
        <p className="monitor-note">Saved on this device for your account.</p>
        <form onSubmit={save}>
          <fieldset disabled={!ready || saving}>
            <label htmlFor="business-name">Farm or business name</label>
            <input id="business-name" autoComplete="organization" maxLength={120} value={profile.business}
              onChange={event => update('business', event.target.value)} />
            <label htmlFor="farm-location">Farm location</label>
            <input id="farm-location" maxLength={120} value={profile.location}
              onChange={event => update('location', event.target.value)} />
            <fieldset className="crop-checks">
              <legend>Crops you produce</legend>
              {Object.entries(crops).map(([id, crop]) => <label key={id}>
                <input type="checkbox" checked={profile.crops.includes(id)} onChange={event => {
                  const checked = event.target.checked;
                  setProfile(old => ({ ...old, crops: checked
                    ? [...old.crops, id] : old.crops.filter(item => item !== id) }));
                }} /> {crop.name}
              </label>)}
            </fieldset>
            <label htmlFor="extra-crops">Other crops</label>
            <input id="extra-crops" maxLength={200} value={profile.other}
              onChange={event => update('other', event.target.value)} />
            <button className="primary wide">Save farm details</button>
          </fieldset>
          <p className="feedback" role="status">{profileMessage}</p>
        </form>
      </section>
      <section className="card" aria-labelledby="email-details">
        <h2 id="email-details">Sign-in email</h2>
        <p className="monitor-note">{currentEmail || 'No email address on this account.'}</p>
        <form onSubmit={changeEmail}>
          <fieldset disabled={emailBusy || signOutBusy}>
            <label htmlFor="new-email">New email address</label>
            <input id="new-email" type="email" autoComplete="email" required value={email}
              onChange={event => setEmail(event.target.value)} />
            <button className="wide">{emailBusy ? 'Sending…' : 'Send verification link'}</button>
          </fieldset>
          <p className="feedback" role="status">{emailMessage}</p>
        </form>
        <button className="wide" disabled={signOutBusy || emailBusy} onClick={leave}>Sign out</button>
        <p className="feedback" role="status">{signOutMessage}</p>
      </section>
    </div>
  </>;
}
