import React, { useEffect, useState } from 'react';
import { watchPublications } from './cloud.js';

export default function NewsFeed({ auth }) {
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState(auth ? 'Loading publications…' : 'The public feed is unavailable in this build.');

  useEffect(() => {
    if (!auth) return;
    return watchPublications(auth, null, (items, fromCache) => {
      setArticles(items);
      setStatus(fromCache ? 'Showing publications saved on this device.' : '');
    }, () => setStatus('The public feed is unavailable. Try again when connected.'));
  }, [auth]);

  return <section className="card news-feed" aria-labelledby="news-heading">
    <h2 id="news-heading">Local Guide news feed</h2>
    {status && <p className="monitor-note" role="status">{status}</p>}
    {articles.length === 0 && !status && <p>No public publications yet.</p>}
    {articles.map(article => <article className="news-post" key={article.id}>
      <h3>{article.title}</h3>
      <p className="monitor-note">{article.publishedAt?.toDate().toLocaleDateString('en-ZA')} · Knowledge-holder permission recorded</p>
      <p className="publication-text">{article.content}</p>
      <p className="monitor-note">Provenance · {article.provenance}</p>
    </article>)}
  </section>;
}
