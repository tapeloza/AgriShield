import React, { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { useLanguage } from './Language.jsx';

function connectionStatus() {
  if (!navigator.onLine) return 'Offline';
  const connection = navigator.connection;
  const weak = ['slow-2g', '2g', '3g'].includes(connection?.effectiveType) ||
    connection?.rtt >= 750 || (connection?.downlink > 0 && connection.downlink < 0.7);
  return weak ? 'Unstable network' : 'Online';
}

export default function ProfileMenu({ user, demo, auth, onAccount, onTeam }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState(connectionStatus);
  const menu = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const name = user?.displayName || user?.email || (demo ? 'Demo workspace' : 'AgriShield');
  const initials = name.split('@')[0].trim().split(/[\s._-]+/).filter(Boolean)
    .slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'A';

  useEffect(() => {
    const update = () => setStatus(connectionStatus());
    const connection = navigator.connection;
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    connection?.addEventListener('change', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      connection?.removeEventListener('change', update);
    };
  }, []);

  async function logout() {
    setError('');
    setLeaving(true);
    try {
      await signOut(auth);
    } catch {
      setError('Could not sign out. Try again.');
      setLeaving(false);
    }
  }

  const ring =  status === 'Online' ? 'online' : status === 'Offline' ? 'offline' : 'unstable';
  return <div className="profile-control">
    <button className={'avatar avatar-' + ring} type="button" popoverTarget="profile-menu"
      title={t(status)} aria-label={t('Open profile menu') + ' · ' + t(status)}>{initials}</button>
    <div id="profile-menu" ref={menu} popover="auto" className="profile-popover">
      <div className="profile-identity">
        <strong>{name}</strong>
        <span role="status">{t(status)}</span>
      </div>
      {demo ? <a className="profile-item" href="/">{t("Exit demo")}</a> : <>
        <button className="profile-item" onClick={() => { menu.current.hidePopover(); onAccount(); }}>{t("Account settings")}</button>
        <button className="profile-item" onClick={() => { menu.current.hidePopover(); onTeam(); }}>{t("Add a team member")}</button>
        <button className="profile-item" disabled={leaving} onClick={logout}>{t('Sign out')}</button>
        {error && <p role="status" className="monitor-note">{error}</p>}
      </>}
    </div>
  </div>;
}
