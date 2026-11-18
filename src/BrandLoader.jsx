import React from 'react';

export default function BrandLoader({ pending = false }) {
  return <div className={'brand-loader' + (pending ? '' : ' brand-loader-transition')}
    role={pending ? 'status' : undefined} aria-hidden={pending ? undefined : true}>
    <img src="/agrishield-logo.png" width="230" height="128" alt="" />
    {pending && <span>Opening AgriShield…</span>}
  </div>;
}
