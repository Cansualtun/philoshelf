import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

test('kimlik doğrulama, token yenileme, içerik yaşam döngüsü', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'philoshelf-'));
  const socket = net.createServer();
  await new Promise((r) => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['apps/api/server.mjs'], {
      env: {
        ...process.env,
        DATA_DIR: dir,
        PORT: String(port),
        AUTH_SECRET: 'test-auth-secret',
      },
      stdio: 'ignore',
    });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 30));
    }
    throw Error('API başlamadı');
  };
  const stop = () => new Promise((r) => {
    child.once('exit', r);
    child.kill();
  });
  const req = (p, method = 'GET', b, token) =>
    fetch(`http://127.0.0.1:${port}/api${p}`, {
      method,
      headers: {
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
        'Content-Type': 'application/json',
      },
      ...(b ? {body: JSON.stringify(b)} : {}),
    });

  try {
    await start();

    assert.equal((await req('/admin/links', 'GET', null)).status, 401);
    assert.equal(
      (await req('/admin/login', 'POST', {email: 'wrong@example.com', password: 'Sarikedi98!'})).status,
      401
    );

    const login = await req('/admin/login', 'POST', {
      email: 'altuncansu98@gmail.com',
      password: 'Sarikedi98!',
    });
    assert.equal(login.status, 200);
    let tokens = await login.json();
    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);

    assert.equal((await req('/admin/links', 'GET', null, tokens.accessToken)).status, 200);

    const refreshed = await req('/admin/refresh', 'POST', {refreshToken: tokens.refreshToken});
    assert.equal(refreshed.status, 200);
    const next = await refreshed.json();
    assert.ok(next.accessToken);
    assert.ok(next.refreshToken);
    assert.equal(
      (await req('/admin/refresh', 'POST', {refreshToken: tokens.refreshToken})).status,
      401
    );
    tokens = next;

    const link = {
      title: 'Okuma listesi',
      description: 'Kitaplar',
      category: 'Kitap',
      url: 'https://example.com',
      position: 1,
      active: false,
    };
    let r = await req('/admin/links', 'POST', link, tokens.accessToken);
    assert.equal(r.status, 201);
    const {id} = await r.json();
    assert.equal((await (await req('/public')).json()).links.length, 0);
    assert.equal((await req('/admin/links', 'PUT', link, tokens.accessToken)).status, 404);
    assert.equal(
      (await req('/admin/links/' + id, 'PUT', {...link, active: true}, tokens.accessToken)).status,
      200
    );
    assert.equal((await (await req('/public')).json()).links[0].title, link.title);
    assert.equal(
      (await req('/admin/links', 'POST', {...link, url: 'javascript:alert(1)'}, tokens.accessToken)).status,
      400
    );
    assert.equal(
      (await req('/admin/profile', 'PUT', {name: 'Yeni profil', bio: 'Merhaba'}, tokens.accessToken)).status,
      200
    );

    await stop();
    await start();

    const again = await req('/admin/login', 'POST', {
      email: 'altuncansu98@gmail.com',
      password: 'Sarikedi98!',
    });
    assert.equal(again.status, 200);
    tokens = await again.json();

    const data = await (await req('/public')).json();
    assert.equal(data.profile.name, 'Yeni profil');
    assert.equal(data.links.length, 1);
    assert.equal((await req('/admin/links/' + id, 'DELETE', null, tokens.accessToken)).status, 200);
    assert.equal((await (await req('/public')).json()).links.length, 0);
    assert.equal((await req('/admin/links/' + id, 'DELETE', null, tokens.accessToken)).status, 404);

    assert.equal((await req('/admin/logout', 'POST', {refreshToken: tokens.refreshToken})).status, 200);
    assert.equal(
      (await req('/admin/refresh', 'POST', {refreshToken: tokens.refreshToken})).status,
      401
    );
  } finally {
    if (child?.exitCode === null) await stop();
    await rm(dir, {recursive: true, force: true});
  }
});
