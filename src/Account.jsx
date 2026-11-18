import React, { useEffect, useState } from 'react';
import { useLanguage } from './Language.jsx';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAdditionalUserInfo, getAuth, GoogleAuthProvider,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup,
} from 'firebase/auth';
import { sensorPath } from './sensors.js';
import { saveState } from './db.js';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function configureAuth() {
  if (!Object.values(config).every(Boolean)) return null;
  try {
    const instance = getAuth(initializeApp(config));
    const emulator = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
    if (emulator) connectAuthEmulator(instance, emulator);
    return instance;
  } catch {
    return null;
  }
}

export const auth = configureAuth();
const route = location.pathname.replace(/\/$/, '');
export const authPage = route === '/signup' ? 'signup' : route === '/signin' ? 'signin' : null;
const errorMessages = {
  'auth/popup-blocked': 'Allow pop-ups for this address, or open AgriShield in Chrome or Edge and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed. You can try again.',
  'auth/unauthorized-domain': 'Add this app address under Firebase Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed': 'Enable this sign-in method under Firebase Authentication → Sign-in method.',
  'auth/invalid-credential': 'Email or password is incorrect. Try again or reset your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'This email already has an account. Use the sign-in page.',
  'auth/weak-password': 'Choose a password that meets the Firebase password policy.',
  'auth/password-does-not-meet-requirements': 'Choose a password that meets the Firebase password policy.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email. Sign in using your original method.',
  'auth/too-many-requests': 'Too many attempts. Wait a while before trying again.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.',
  'auth/web-storage-unsupported': 'Open AgriShield in Chrome or Edge with browser storage enabled, then try Google sign-in.',
};

export default function Account({ page, user, ready }) {
  const { t } = useLanguage();
  const signup = page === 'signup';
  const [role, setRole] = useState('grower');
  const [reset, setReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const heading = t(signup ? 'Create your account' : reset ? 'Reset your password' : 'Sign in to AgriShield');

  useEffect(() => {
    if (user && !busy) location.replace(sensorPath('/'));
  }, [user, busy]);

  async function run(action, fallback) {
    setMessage('');
    setBusy(true);
    try { await action(); }
    catch (error) { setMessage(errorMessages[error.code] || fallback); }
    finally { setBusy(false); }
  }

  async function finishSignup(credential) {
    if (signup && role === 'specialist' && getAdditionalUserInfo(credential)?.isNewUser) {
      await saveState('role:' + credential.user.uid, 'specialist');
    }
  }

  function submit(event) {
    event.preventDefault();
    const address = email.trim();
    if (reset) {
      return run(async () => {
        try { await sendPasswordResetEmail(auth, address); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        setMessage('If this email is registered, a password reset link will arrive in its inbox.');
      }, 'Could not request a reset link. Try again.');
    }
    return run(() => signup
      ? createUserWithEmailAndPassword(auth, address, password).then(finishSignup)
      : signInWithEmailAndPassword(auth, address, password),
    signup ? 'Could not create your account. Try again.' : 'Could not sign in. Try again.');
  }

  function toggleReset() {
    setReset(value => !value);
    setMessage('');
    setPassword('');
  }

  return <div className="auth-layout">
    <aside className="auth-image" aria-label="Vegetable fields">
      <div>
        <strong>Know your fields.</strong>
        <p>Monitor soil conditions and keep your farm records close, even offline.</p>
      </div>
    </aside>
    <div className="auth-panel">
    <h1>{heading}</h1>
    <p className="intro">{reset ? 'Enter the email address you use for AgriShield.' : t('Use your email and password or continue with Google.')}</p>
    <section className="account auth-form" aria-label={heading}>
      {!auth ? <p>Sign-in is unavailable until Firebase is configured.</p>
        : !ready ? <p role="status">Checking your session…</p>
        : user ? <p role="status">Opening your dashboard…</p> : <>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {signup && <>
                <label htmlFor="workspace-role">Account type</label>
                <select id="workspace-role" value={role} onChange={event => setRole(event.target.value)}>
                  <option value="grower">Grower</option>
                  <option value="specialist">IKS Specialist</option>
                </select>
              </>}
              <label htmlFor="auth-email">{t("Email address")}</label>
              <input id="auth-email" type="email" autoComplete={reset ? 'email' : 'username'} required value={email}
                onChange={event => setEmail(event.target.value)} />
              {!reset && <>
                <label htmlFor="auth-password">{t("Password")}</label>
                <input id="auth-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'}
                  minLength={signup ? 6 : undefined} required value={password}
                  onChange={event => setPassword(event.target.value)} />
              </>}
              <button className="primary wide">{t(reset ? 'Send reset link' : signup ? 'Create account' : 'Sign in')}</button>
            </fieldset>
          </form>
          {!reset && <button className="wide" disabled={busy} onClick={() => run(
            () => signInWithPopup(auth, new GoogleAuthProvider()).then(finishSignup),
            'Could not complete Google sign-in. Try opening AgriShield in Chrome or Edge.',
          )}>{t("Continue with Google")}</button>}
          {!signup && <button className="wide" type="button" disabled={busy} onClick={toggleReset}>
            {t(reset ? 'Back to sign in' : 'Forgot password?')}
          </button>}
        </>}
      <p className="feedback" role="status">{busy ? 'Working…' : message}</p>
      <div className="account-links">
        {signup && <a href={sensorPath('/signin')}>Already have an account? Sign in</a>}
        <a href={sensorPath('/')}>{t("Back to welcome")}</a>
      </div>
    </section>
    </div>
  </div>;
}
