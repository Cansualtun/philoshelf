import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../../../packages/ui/style.css';

const blank = {title: '', description: '', url: '', category: 'Keşfet', position: 0, active: true};
const REFRESH_KEY = 'philoshelf.refresh';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState(() => sessionStorage.getItem(REFRESH_KEY) || '');
  const [connected, setConnected] = useState(false);
  const [links, setLinks] = useState([]);
  const [profile, setProfile] = useState({name: '', bio: ''});
  const [form, setForm] = useState({...blank});
  const [id, setId] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function saveTokens(next) {
    setAccessToken(next.accessToken || '');
    setRefreshToken(next.refreshToken || '');
    if (next.refreshToken) sessionStorage.setItem(REFRESH_KEY, next.refreshToken);
    else sessionStorage.removeItem(REFRESH_KEY);
  }

  async function refreshAccess(currentRefresh = refreshToken) {
    if (!currentRefresh) throw Error('Oturum gerekli');
    const r = await fetch('/api/admin/refresh', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({refreshToken: currentRefresh}),
    });
    const d = await r.json();
    if (!r.ok) {
      saveTokens({});
      setConnected(false);
      throw Error(d.error || 'Oturum yenilenemedi');
    }
    saveTokens(d);
    return d.accessToken;
  }

  async function api(path, method = 'GET', body, token = accessToken) {
    const send = async (access) =>
      fetch('/api/admin' + path, {
        method,
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        ...(body ? {body: JSON.stringify(body)} : {}),
      });

    let r = await send(token);
    if (r.status === 401 && refreshToken) {
      const nextAccess = await refreshAccess();
      r = await send(nextAccess);
    }
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }

  async function load(token = accessToken) {
    const d = await api('/links', 'GET', null, token);
    setLinks(d.links);
    setProfile(d.profile);
    setConnected(true);
  }

  async function login(e) {
    e.preventDefault();
    await action(async () => {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || 'Giriş başarısız');
      saveTokens(d);
      setPassword('');
      await load(d.accessToken);
    });
  }

  async function logout() {
    await action(async () => {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({refreshToken}),
        });
      } finally {
        saveTokens({});
        setConnected(false);
        setLinks([]);
      }
    });
  }

  async function action(fn) {
    setMessage('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!refreshToken || connected) return;
    let cancelled = false;
    (async () => {
      try {
        const access = await refreshAccess(refreshToken);
        if (!cancelled) await load(access);
      } catch {
        if (!cancelled) saveTokens({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function field(key, label, type = 'text') {
    return (
      <label>
        {label}
        <input
          type={type}
          required={['title', 'url'].includes(key)}
          value={form[key]}
          maxLength={key === 'title' ? 120 : key === 'category' ? 50 : undefined}
          onChange={(e) =>
            setForm({
              ...form,
              [key]: type === 'number' ? Number(e.target.value) : e.target.value,
            })
          }
        />
      </label>
    );
  }

  return (
    <div className="page admin">
      <header className="top">
        <a href="/" className="wordmark">
          philoshelf<span> / yönetim</span>
        </a>
        {connected && (
          <button onClick={logout} disabled={busy}>
            Çıkış yap
          </button>
        )}
      </header>
      <main>
        <div className="eyebrow">İÇERİK YÖNETİMİ</div>
        <h1>
          Rafını düzenle<span className="title-dot">.</span>
        </h1>
        <p className="bio">Bağlantılarını ve profilini tek bir yerden yönet.</p>
        {message && (
          <p className="notice" role="alert">
            {message}
          </p>
        )}
        {!connected ? (
          <form className="panel login" onSubmit={login}>
            <h2>Yönetici girişi</h2>
            <label>
              E-posta
              <input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Şifre
              <input
                autoComplete="current-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              Giriş yap →
            </button>
          </form>
        ) : (
          <div className="admin-grid">
            <section>
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    await api('/profile', 'PUT', profile);
                    setMessage('Profil kaydedildi.');
                  });
                }}
              >
                <h2>Profil</h2>
                <label>
                  İsim
                  <input
                    required
                    maxLength={80}
                    value={profile.name}
                    onChange={(e) => setProfile({...profile, name: e.target.value})}
                  />
                </label>
                <label>
                  Kısa açıklama
                  <textarea
                    maxLength={300}
                    value={profile.bio}
                    onChange={(e) => setProfile({...profile, bio: e.target.value})}
                  />
                </label>
                <button disabled={busy}>Profili kaydet</button>
              </form>
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    await api('/links' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', form);
                    setForm({...blank});
                    setId(null);
                    await load();
                    setMessage('Bağlantı kaydedildi.');
                  });
                }}
              >
                <h2>{id ? 'Bağlantıyı düzenle' : 'Yeni bağlantı'}</h2>
                {field('title', 'Başlık')}
                {field('url', 'Bağlantı adresi', 'url')}
                <label>
                  Açıklama
                  <textarea
                    maxLength={300}
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                  />
                </label>
                {field('category', 'Kategori')}
                {field('position', 'Sıra (küçük sayı önce görünür)', 'number')}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(form.active)}
                    onChange={(e) => setForm({...form, active: e.target.checked})}
                  />
                  Yayında
                </label>
                <div className="actions">
                  <button disabled={busy} className="primary">
                    Kaydet
                  </button>
                  {id && (
                    <button
                      type="button"
                      onClick={() => {
                        setId(null);
                        setForm({...blank});
                      }}
                    >
                      Vazgeç
                    </button>
                  )}
                </div>
              </form>
            </section>
            <section className="panel">
              <h2>
                Bağlantılar <span className="count">{links.length}</span>
              </h2>
              {!links.length && <p className="empty">Henüz bağlantı yok. İlk bağlantını ekle.</p>}
              {links.map((l) => (
                <article className="admin-link" key={l.id}>
                  <span className="tag">
                    {l.category} · {l.active ? 'Yayında' : 'Taslak'} · Sıra: {l.position}
                  </span>
                  <h3>{l.title}</h3>
                  <p className="url">{l.url}</p>
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => {
                        setId(l.id);
                        setForm({...l});
                        window.scrollTo({top: 0, behavior: 'smooth'});
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      disabled={busy}
                      className="danger"
                      onClick={() => {
                        if (confirm(`“${l.title}” silinsin mi?`)) {
                          action(async () => {
                            await api('/links/' + l.id, 'DELETE');
                            await load();
                          });
                        }
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </main>
      <footer>Philoshelf · Yönetim paneli</footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
