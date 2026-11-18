import React, { useEffect, useState } from 'react';
import { useLanguage } from './Language.jsx';
import { reload, signOut, verifyBeforeUpdateEmail } from 'firebase/auth';
import FarmDetails from './FarmDetails.jsx';

export default function FarmProfile({ user, auth }) {
  const { t } = useLanguage();
  const [currentEmail, setCurrentEmail] = useState(user.email);
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState('');

  useEffect(() => {
    let active = true;
    reload(user).then(() => {
      if (active) setCurrentEmail(user.email);
    }).catch(() => {});
    return () => { active = false; };
  }, [user]);

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
    <h1>{t("Account")}</h1>
    <p className="intro">Manage your sign-in email and farm profile.</p>
    <div className="profile-grid">
      <section className="card" aria-labelledby="farm-details">
        <h2 id="farm-details">{t("Business and crops")}</h2>
        <p className="monitor-note">Saved on this device for your account.</p>
        <FarmDetails uid={user.uid} />
      </section>
      <section className="card" aria-labelledby="email-details">
        <h2 id="email-details">Sign-in email</h2>
        <p className="monitor-note">{currentEmail || 'No email address on this account.'}</p>
        <form onSubmit={changeEmail}>
          <fieldset disabled={emailBusy || signOutBusy}>
            <label htmlFor="new-email">{t("New email address")}</label>
            <input id="new-email" type="email" autoComplete="email" required value={email}
              onChange={event => setEmail(event.target.value)} />
            <button className="wide">{emailBusy ? 'Sending…' : 'Send verification link'}</button>
          </fieldset>
          <p className="feedback" role="status">{emailMessage}</p>
        </form>
        <button className="wide" disabled={signOutBusy || emailBusy} onClick={leave}>{t("Sign out")}</button>
        <p className="feedback" role="status">{signOutMessage}</p>
      </section>
    </div>
  </>;
}
