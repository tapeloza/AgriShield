import React, { useEffect, useState } from 'react';
import { useLanguage } from './Language.jsx';
import { loadState, saveState } from './db.js';
import { crops } from './model.js';

const empty = { business: '', location: '', crops: [], other: '' };

export default function FarmDetails({ uid, onSaved }) {
  const { t } = useLanguage();
  const key = 'profile:' + uid;
  const [profile, setProfile] = useState(empty);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
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
    return () => { active = false; };
  }, [key]);

  const update = (field, value) => setProfile(old => ({ ...old, [field]: value }));

  async function save(event) {
    event.preventDefault();
    if (!profile.business.trim()) {
      setProfileMessage('Enter your farm or business name.');
      return;
    }
    setSaving(true);
    setProfileMessage('');
    try {
      await saveState(key, {
        ...profile, business: profile.business.trim(), location: profile.location.trim(), other: profile.other.trim(),
      });
      setProfileMessage('Farm details saved on this device.');
      onSaved?.();
    } catch {
      setProfileMessage('Could not save farm details. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={save}>
    <fieldset disabled={!ready || saving}>
      <label htmlFor="business-name">{t("Farm or business name")}</label>
      <input id="business-name" autoComplete="organization" maxLength={120} required value={profile.business}
        onChange={event => update('business', event.target.value)} />
      <label htmlFor="farm-location">{t("Farm location")}</label>
      <input id="farm-location" maxLength={120} value={profile.location}
        onChange={event => update('location', event.target.value)} />
      <fieldset className="crop-checks">
        <legend>{t("Crops you produce")}</legend>
        {Object.entries(crops).map(([id, crop]) => <label key={id}>
          <input type="checkbox" checked={profile.crops.includes(id)} onChange={event => {
            const checked = event.target.checked;
            setProfile(old => ({ ...old, crops: checked
              ? [...old.crops, id] : old.crops.filter(item => item !== id) }));
          }} /> {t(crop.name)}
        </label>)}
      </fieldset>
      <label htmlFor="extra-crops">{t("Other crops")}</label>
      <input id="extra-crops" maxLength={200} value={profile.other}
        onChange={event => update('other', event.target.value)} />
      <button className="primary wide">{t("Save farm details")}</button>
    </fieldset>
    <p className="feedback" role="status">{profileMessage}</p>
  </form>;
}
