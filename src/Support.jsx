import React, { useState } from 'react';
import { useLanguage } from './Language.jsx';

const provinces = {
  Limpopo: {
    url: 'https://www.ldard.gov.za/index.php/contact-us/chief-directorate-agriculture-development-and-farmer-support',
    offices: [['Capricorn', '015 632 8600'], ['Mopani', '015 328 3015'],
      ['Sekhukhune', '015 812 3402'], ['Vhembe', '015 963 2005'], ['Waterberg', '014 717 4949']],
  },
  Mpumalanga: {
    url: 'https://dardlea.mpg.gov.za/district_office.html',
    offices: [['Bohlabela', '013 759 4000'], ['Ehlanzeni', '013 759 4039'],
      ['Gert Sibande', '017 819 2076'], ['Nkangala', '013 947 2551']],
  },
};

export default function Support() {
  const { t } = useLanguage();
  const [province, setProvince] = useState('Limpopo');
  const { offices, url } = provinces[province];
  const fromDemo = new URLSearchParams(location.search).get('from') === 'demo';

  return <>
    <a href={fromDemo ? '/demo' : '/'}>{t('Back to AgriShield')}</a>
    <h1>{t('Agricultural support')}</h1>
    <p className="intro" lang="en-ZA">Contact your district office and ask to speak to the agricultural extension officer for your farm area.</p>
    <div className="profile-grid">
      <section className="card" aria-labelledby="find-extension">
        <h2 id="find-extension">{t('Find an extension officer')}</h2>
        <label htmlFor="support-province">{t('Province')}</label>
        <select id="support-province" value={province} onChange={event => setProvince(event.target.value)}>
          {Object.keys(provinces).map(name => <option key={name}>{name}</option>)}
        </select>
        <ul className="support-offices">
          {offices.map(([name, phone]) => <li key={name}>
            <strong>{name}</strong>
            <a href={'tel:+27' + phone.replace(/\s/g, '').slice(1)}>{phone}</a>
          </li>)}
        </ul>
        <a href={url} target="_blank" rel="noreferrer" lang="en-ZA">Official district directory</a>
      </section>
      <section className="card" aria-labelledby="support-institutions" lang="en-ZA">
        <h2 id="support-institutions">Support institutions</h2>
        <ul className="support-institutions">
          <li><a href="https://www.nda.gov.za/" target="_blank" rel="noreferrer">Department of Agriculture</a></li>
          <li><a href="https://www.arc.agric.za/Pages/ARC-Information-Hub.aspx" target="_blank" rel="noreferrer">Agricultural Research Council</a></li>
        </ul>
        <p className="monitor-note">Phone numbers are available offline after the app is cached. External websites need internet.</p>
      </section>
    </div>
  </>;
}
