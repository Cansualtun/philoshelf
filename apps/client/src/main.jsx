import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PlatformIcon} from './platform-icon.jsx';
import './style.css';

function destination(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Tümü');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(4);
  useEffect(() => {
    const resize = () => {
      const size = window.innerHeight < 740 ? 3 : 4;
      setPageSize(size);
      setPage(0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  async function load() {
    setError(false);
    setLoading(true);
    try {
      const response = await fetch('/api/public');
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const categories = ['Tümü', ...new Set(data?.links.map(link => link.category) || [])];
  const filtered = data?.links.filter(link => category === 'Tümü' || link.category === category) || [];
  const pages = Math.ceil(filtered.length / pageSize);
  return <div className="link-site">
    <div className="ambient ambient-one" aria-hidden="true"/>
    <div className="ambient ambient-two" aria-hidden="true"/>
    <main className="profile">
      <header className="profile-header">
        <div className="profile-mark" aria-hidden="true"><span>p</span><svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/></svg></div>
        <p className="kicker">BİR FİKİRLE BAŞLAR.</p>
        <h1>{data?.profile.name || 'Philoshelf'}<span>.</span></h1>
        <p className="profile-bio">{data?.profile.bio || 'Bir kitap, bir fikir, yeni bir bakış.'}</p>
      </header>
      <section className="destinations" aria-label="Philoshelf bağlantıları" aria-busy={loading}>
        <div className="section-label"><span>KEŞFET, OKU, BİRLİKTE DÜŞÜN.</span><span aria-hidden="true">↘</span></div>
        {categories.length > 2 && <nav className="filters" aria-label="Kategoriler">{categories.map(item => <button key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setPage(0); }}>{item}</button>)}</nav>}
        {error ? <div className="status" role="alert"><h2>Birazdan tekrar buluşalım.</h2><p>Bağlantılar şu anda yüklenemiyor.</p><button onClick={load}>Tekrar dene ↗</button></div>
          : loading ? <div className="skeleton-list" role="status" aria-label="Bağlantılar yükleniyor">{[1,2,3].map(i => <div className="skeleton" key={i}/> )}</div>
          : !data?.links.length ? <div className="status"><span className="status-star">✳</span><h2>Yeni fikirler yolda.</h2><p>Yazılar, okuma listeleri ve buluşmalar.<br/>Çok yakında, tam burada.</p></div>
          : <div className="destination-list">{filtered.slice(page * pageSize, (page + 1) * pageSize).map((link, index) => <a className={'destination' + (page === 0 && index === 0 ? ' destination-featured' : '')} key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.title} — yeni sekmede açılır`}>
            <PlatformIcon url={link.url}/>
            <div className="destination-copy"><h2>{link.title}</h2><p>{link.description || destination(link.url)}</p></div>
            <span className="destination-arrow" aria-hidden="true">↗</span>
          </a>)}</div>}
        {pages > 1 && !loading && !error && <nav className="pager" aria-label="Bağlantı sayfaları"><button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Önceki bağlantılar">←</button><span aria-live="polite">{page + 1}<span> / {pages}</span></span><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Sonraki bağlantılar">→</button></nav>}
      </section>
      <footer className="profile-footer"><span className="footer-line"/><p>MERAKLA BİR ARADA <span aria-hidden="true">✳</span></p><span className="footer-line"/></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
