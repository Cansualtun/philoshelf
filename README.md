# Philoshelf

React bağlantı sayfası, React yönetim paneli ve Node.js API içeren npm workspaces monorepo.

## Geliştirme

Node.js 24 veya üzeri gerekir. Harici veritabanı gerekmez; SQLite Node.js ile gelir.

```sh
npm ci
# İsteğe bağlı: ADMIN_TOKEN ortam değişkenini güvenli bir değerle tanımlayın.
npm run dev
```

Client 5173, admin 5174, API 3001 portlarında çalışır. Yönetici anahtarı tanımlanmazsa API her açılışta geçici bir anahtar üretip terminale yazar. Anahtar tarayıcıda kalıcı saklanmaz. `.env.example` yalnızca belgedir; `.env` otomatik yüklenmez.

Admin panelinde profil ve bağlantı ekleme, düzenleme, silme, kategori, sıra ve yayın/taslak yönetimi bulunur. Gerçek adresler verilmediği için başlangıçta bağlantı listesi boştur. Public sayfa yalnızca yayındaki kayıtları gösterir.

```sh
npm run build
npm test
```

## Yapı

- `apps/api`: Node HTTP API, SQLite kalıcı veri, Bearer anahtar doğrulama.
- `apps/client`: ziyaretçi bağlantı sayfası.
- `apps/admin`: içerik yönetimi.
- `packages/ui`: ortak görsel stil.

Veriler `.data/philoshelf.sqlite` dosyasında tutulur; bu dizini yedekleyin. `DATA_DIR` ile konumu değiştirilebilir. API loopback adresine bağlanır, geliştirmede Vite `/api` isteklerini ona yönlendirir. Canlı dağıtımda iki arayüzün `/api` yollarını API'ye yönlendiren HTTPS reverse proxy gerekir. Sabit güçlü `ADMIN_TOKEN`, erişim sınırlama ve düzenli veri yedeği sağlanmadan internete açmayın. Bu çalışma canlı dağıtım yapmaz.
