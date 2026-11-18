import React, { useEffect, useRef } from 'react';
import { useLanguage } from './Language.jsx';
import FarmDetails from './FarmDetails.jsx';

export default function FarmOnboarding({ uid, onClose }) {
  const { t } = useLanguage();
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="card onboarding" aria-labelledby="onboarding-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id="onboarding-title">{t("Add your business details")}</h2>
    <p className="monitor-note">Set up your farm profile. You can update these details in Account.</p>
    <FarmDetails uid={uid} onSaved={onClose} />
    <button type="button" className="wide" onClick={onClose}>{t("Do this later")}</button>
  </dialog>;
}
