import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from './src/response.mjs';
test('boş proxy hatası anlaşılır API hatasına dönüşür', async () => {
  await assert.rejects(readApiResponse(new Response('', {status:500})), /API boş yanıt.*HTTP 500/);
});
test('HTML proxy yanıtı içerik sızdırmadan açıklanır', async () => {
  await assert.rejects(readApiResponse(new Response('<html>proxy</html>', {status:502})), /JSON.*HTTP 502/);
});
test('başarılı içerik ve hatalı giriş JSON yanıtları korunur', async () => {
  assert.deepEqual(await readApiResponse(Response.json({accessToken:'test'})), {accessToken:'test'});
  assert.deepEqual(await readApiResponse(Response.json({error:'E-posta veya şifre hatalı'}, {status:401})), {error:'E-posta veya şifre hatalı'});
});
test('geçersiz JSON biçimleri reddedilir', async () => {
  await assert.rejects(readApiResponse(Response.json(null)), /yanıtı geçersiz/);
});
