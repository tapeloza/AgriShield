import React, { useEffect, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, isSignInWithEmailLink, onAuthStateChanged,
  RecaptchaVerifier, sendSignInLinkToEmail, signInWithEmailLink, signInWithPhoneNumber,
  signInWithPopup, signOut,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const auth = Object.values(config).every(Boolean) ? getAuth(initializeApp(config)) : null;
const hasEmailLink = () => Boolean(auth && isSignInWithEmailLink(auth, location.href));
const pendingEmail = 'agrishield.pending-email';
export const opensAccount = new URLSearchParams(location.search).get('view') === 'account';
const errorMessages = {
  'auth/popup-blocked': 'Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed. You can try again.',
  'auth/unauthorized-domain': 'This site address needs to be authorised in Firebase.',
  'auth/operation-not-allowed': 'This sign-in method needs to be enabled in Firebase.',
  'auth/too-many-requests': 'Too many attempts. Wait a while before trying again.',
};

function normalisePhone(value) {
  const phone = value.trim().replace(/[\s()-]/g, '');
  return /^0\d{9}$/.test(phone) ? '+27' + phone.slice(1) : phone;
}

export default function Account() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!auth);
  const [method, setMethod] = useState('email');
  const [value, setValue] = useState(() => {
    try { return hasEmailLink() ? localStorage.getItem(pendingEmail) || '' : ''; }
    catch { return ''; }
  });
  const [confirmation, setConfirmation] = useState(null);
  const [finishing, setFinishing] = useState(hasEmailLink);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const captcha = useRef(null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, next => {
      setUser(next);
      setReady(true);
    });
    return () => {
      unsubscribe();
      captcha.current?.clear();
      captcha.current = null;
    };
  }, []);

  async function run(action, fallback) {
    setMessage('');
    setBusy(true);
    try { await action(); }
    catch (error) { setMessage(errorMessages[error.code] || fallback); }
    finally {
      captcha.current?.clear();
      captcha.current = null;
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (confirmation) {
      return run(async () => {
        await confirmation.confirm(code.trim());
        setConfirmation(null);
        setCode('');
      }, 'Could not verify the code. Check it or request a new one.');
    }
    if (finishing) {
      return run(async () => {
        await signInWithEmailLink(auth, value.trim(), location.href);
        try { localStorage.removeItem(pendingEmail); } catch {}
        history.replaceState(null, '', '/?view=account');
        setFinishing(false);
        setValue('');
      }, 'Could not verify the email link. Enter the original email address or request a new link.');
    }
    if (method === 'email') {
      return run(async () => {
        const email = value.trim();
        await sendSignInLinkToEmail(auth, email, {
          url: location.origin + '/?view=account', handleCodeInApp: true,
        });
        try { localStorage.setItem(pendingEmail, email); } catch {}
        setMessage('Check your inbox and open the sign-in link.');
      }, 'Could not send the link. Check your connection and try again.');
    }
    const phone = normalisePhone(value);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setMessage('Enter a South African number such as 082 123 4567, or include the international country code.');
      return;
    }
    return run(async () => {
      captcha.current = new RecaptchaVerifier(auth, 'sms-recaptcha', { size: 'invisible' });
      setConfirmation(await signInWithPhoneNumber(auth, phone, captcha.current));
      setMessage('Check your SMS messages for the code.');
    }, 'Could not send a code. Check your connection and try again shortly.');
  }

  return <>
    <h1>Account</h1>
    <p className="intro">Create an account or sign in without a password. Your readings stay in this browser.</p>
    <section className="card account" aria-label="Sign in">
      {!auth ? <p>Sign-in setup is pending. You can still use the dashboard and library offline.</p>
        : !ready ? <p role="status">Checking your session…</p>
        : user && !finishing ? <>
          <p>Signed in as <strong>{user.email || user.phone || 'AgriShield user'}</strong>.</p>
          <button className="wide" disabled={busy} onClick={() => run(
            () => signOut(auth), 'Could not sign out. Try again.',
          )}>Sign out on this device</button>
        </> : <>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {confirmation ? <>
                <label htmlFor="auth-code">SMS verification code</label>
                <input id="auth-code" value={code} onChange={e => setCode(e.target.value)}
                  autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required />
                <button className="primary wide">Verify and continue</button>
                <button type="button" className="wide" onClick={() => {
                  setConfirmation(null); setCode(''); setMessage('');
                }}>Change number or request another code</button>
              </> : <>
                {!finishing && <>
                  <label htmlFor="auth-method">Sign in with</label>
                  <select id="auth-method" value={method} onChange={e => {
                    setMethod(e.target.value); setValue(''); setMessage('');
                  }}>
                    <option value="email">Email</option>
                    <option value="phone">Phone number</option>
                  </select>
                </>}
                <label htmlFor="auth-contact">{method === 'email' ? 'Email address' : 'Phone number'}</label>
                <input id="auth-contact" type={method === 'email' ? 'email' : 'tel'}
                  autoComplete={method === 'email' ? 'email' : 'tel'} required value={value}
                  onChange={e => setValue(e.target.value)} />
                <button className="primary wide">{finishing ? 'Confirm email and sign in'
                  : method === 'email' ? 'Send sign-in link' : 'Send SMS code'}</button>
                {finishing && <button type="button" className="wide" onClick={() => {
                  history.replaceState(null, '', '/?view=account');
                  setFinishing(false); setMessage('');
                }}>Request a new link</button>}
              </>}
            </fieldset>
          </form>
          <div id="sms-recaptcha" />
          {!confirmation && !finishing && <button className="wide" disabled={busy} onClick={() => run(
            () => signInWithPopup(auth, new GoogleAuthProvider()), 'Could not complete Google sign-in. Check your connection and try again.',
          )}>Continue with Google</button>}
          <p className="feedback">Sign-in needs internet. Use a device you trust if you want to stay signed in.</p>
        </>}
      <p className="feedback" role="status">{busy ? 'Working…' : message}</p>
    </section>
  </>;
}
