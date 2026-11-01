import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
const dir=process.env.DATA_DIR||new URL('../../.data/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(`${dir}/philoshelf.sqlite`);
db.exec(`CREATE TABLE IF NOT EXISTS links(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',url TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'Keşfet',position INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1); CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,bio TEXT NOT NULL); INSERT OR IGNORE INTO settings VALUES(1,'Philoshelf','Bir kitap, bir fikir, yeni bir bakış. Düşünce dünyamıza hoş geldin.');`);
const token=process.env.ADMIN_TOKEN||randomBytes(24).toString('hex');
if(!process.env.ADMIN_TOKEN)console.log(`Geçici yönetici anahtarı (yalnızca bu oturum): ${token}`);
function authorized(req){const a=Buffer.from(req.headers.authorization||'');const b=Buffer.from(`Bearer ${token}`);return a.length===b.length&&timingSafeEqual(a,b)}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>16384)throw Error('İstek çok büyük')}return JSON.parse(s||'{}')}
function fields(b){if(typeof b.title!=='string'||!b.title.trim()||b.title.length>120)throw Error('Başlık 1–120 karakter olmalı');const u=new URL(b.url);if(!['https:','http:'].includes(u.protocol))throw Error('Geçerli bir http/https bağlantısı girin');if(u.username||u.password)throw Error('Bağlantı kimlik bilgisi içeremez');if(typeof b.description!=='string'||b.description.length>300||typeof b.category!=='string'||b.category.length>50)throw Error('Açıklama veya kategori geçersiz');if(!Number.isInteger(b.position)||Math.abs(b.position)>100000)throw Error('Sıra geçersiz');return [b.title.trim(),b.description.trim(),u.href,b.category.trim()||'Keşfet',b.position,b.active?1:0]}
export const server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const send=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data))};const path=new URL(req.url,'http://localhost').pathname;
try{
 if(path==='/api/health'&&req.method==='GET')return send(200,{ok:true});
 if(path==='/api/public'&&req.method==='GET')return send(200,{profile:db.prepare('SELECT name,bio FROM settings WHERE id=1').get(),links:db.prepare('SELECT * FROM links WHERE active=1 ORDER BY position,id').all()});
 if(!path.startsWith('/api/admin'))return send(404,{error:'Bulunamadı'});
 if(!authorized(req))return send(401,{error:'Yönetici anahtarı geçersiz'});
 if(path==='/api/admin/links'&&req.method==='GET')return send(200,{links:db.prepare('SELECT * FROM links ORDER BY position,id').all(),profile:db.prepare('SELECT name,bio FROM settings WHERE id=1').get()});
 if(path==='/api/admin/profile'&&req.method==='PUT'){const b=await body(req);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.bio!=='string'||b.bio.length>300)throw Error('Profil bilgileri geçersiz');db.prepare('UPDATE settings SET name=?,bio=? WHERE id=1').run(b.name.trim(),b.bio.trim());return send(200,{ok:true})}
 if(path==='/api/admin/links'&&req.method==='POST'){const v=fields(await body(req));const result=db.prepare('INSERT INTO links(title,description,url,category,position,active) VALUES(?,?,?,?,?,?)').run(...v);return send(201,{id:Number(result.lastInsertRowid)})}
 const match=path.match(/^\/api\/admin\/links\/(\d+)$/);if(match&&['PUT','DELETE'].includes(req.method)){const id=Number(match[1]);const result=req.method==='DELETE'?db.prepare('DELETE FROM links WHERE id=?').run(id):db.prepare('UPDATE links SET title=?,description=?,url=?,category=?,position=?,active=? WHERE id=?').run(...fields(await body(req)),id);return send(result.changes?200:404,result.changes?{ok:true}:{error:'Bağlantı bulunamadı'})}
 return send(404,{error:'Bulunamadı'});
}catch(e){return send(400,{error:e.message||'Geçersiz istek'})}});
server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('Philoshelf API hazır'));
