// Aternos AFK Bot Paneli
// Tarayıcıda açılan bir sayfadan IP + ilk mesaj girersin, bot sunucuya girip rastgele yürür.
// Çalıştırma: baslat.bat dosyasına çift tıkla (Windows) veya: npm install mineflayer && node panel.js

const http = require('http');
const mineflayer = require('mineflayer');

const PORT = process.env.PORT || 3000;
const IN_CLOUD = !!process.env.PORT;               // Render/Railway gibi yerlerde PORT otomatik gelir
const PASS = process.env.PANEL_PASSWORD || '';     // Panel şifresi (bulutta zorunlu)
const RECONNECT_MS = 15000;

let bot = null;
let cfg = null;
let wanted = false;
let reconnectTimer = null;
const state = { status: 'kapalı', logs: [] };

function log(msg) {
  const t = new Date().toLocaleTimeString('tr-TR');
  state.logs.push('[' + t + '] ' + msg);
  if (state.logs.length > 200) state.logs.shift();
  console.log(msg);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function startBot() {
  if (!wanted) return;
  state.status = 'bağlanıyor';
  log('🔌 ' + cfg.host + ':' + cfg.port + ' adresine bağlanılıyor...');

  const b = mineflayer.createBot({
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    version: false,
    auth: 'offline',
  });
  bot = b;
  let alive = true;

  function step() {
    if (!alive) return;
    try {
      b.clearControlStates();
      b.setControlState(pick(['forward', 'back', 'left', 'right']), true);
      if (Math.random() < 0.4) b.setControlState('jump', true);
      if (Math.random() < 0.2) b.setControlState('sneak', true);
      b.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 1.2, false);
    } catch (e) {}
    setTimeout(step, 1000 + Math.random() * 3000);
  }

  b.once('spawn', () => {
    state.status = 'sunucuda ✅';
    log('✅ Bot sunucuya girdi.');
    setTimeout(() => {
      if (alive && cfg.message) {
        b.chat(cfg.message);
        log('✉️ İlk mesaj gönderildi: ' + cfg.message);
      }
    }, 2000);
    step();
  });

  b.on('messagestr', (m) => {
    if (m && m.trim()) log('💬 ' + m.trim().slice(0, 200));
  });
  b.on('death', () => log('💀 Bot öldü, yeniden doğuyor...'));
  b.on('kicked', (reason) => log('⛔ Atıldı: ' + (typeof reason === 'string' ? reason : JSON.stringify(reason)).slice(0, 200)));
  b.on('error', (err) => log('⚠️ Hata: ' + err.message));
  b.on('end', () => {
    alive = false;
    if (bot === b) bot = null;
    if (wanted) {
      state.status = 'yeniden denenecek';
      log('🔁 Bağlantı koptu, ' + RECONNECT_MS / 1000 + ' sn sonra tekrar denenecek.');
      reconnectTimer = setTimeout(startBot, RECONNECT_MS);
    } else {
      state.status = 'kapalı';
    }
  });
}

function connect(input) {
  let host = String(input.host || '').trim();
  let port = 25565;
  const m = host.match(/^(.*):(\d{1,5})$/);
  if (m) { host = m[1]; port = parseInt(m[2], 10); }
  if (input.port) port = parseInt(input.port, 10) || port;
  if (!host) throw new Error('Sunucu IP/adresi boş.');

  const username = String(input.username || 'AFK_Bot').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    throw new Error('Bot adı 3-16 karakter olmalı (harf, rakam, _).');
  }

  disconnect(true);
  cfg = { host, port, username, message: String(input.message || '').trim() };
  wanted = true;
  startBot();
}

function disconnect(silent) {
  wanted = false;
  clearTimeout(reconnectTimer);
  if (bot) { try { bot.end(); } catch (e) {} bot = null; }
  state.status = 'kapalı';
  if (!silent) log('⏹️ Bot durduruldu.');
}

const HTML = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aternos AFK Bot</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, sans-serif; background:#12151c; color:#e8ecf3; display:flex; justify-content:center; padding:20px; }
  .card { width:100%; max-width:560px; background:#1b2030; border:1px solid #2a3147; border-radius:14px; padding:20px; }
  h1 { margin:0 0 4px; font-size:22px; }
  p.sub { margin:0 0 16px; color:#9aa6c0; font-size:14px; }
  label { display:block; margin:12px 0 4px; font-size:13px; color:#9aa6c0; }
  input { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #333d58; background:#12151c; color:#e8ecf3; font-size:15px; }
  .row { display:flex; gap:10px; margin-top:16px; }
  button { flex:1; padding:11px; border:0; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; }
  #go { background:#3ddc84; color:#06210f; }
  #stop { background:#ef5350; color:#fff; }
  .status { margin-top:16px; font-size:14px; }
  .status b { color:#3ddc84; }
  #log { margin-top:8px; height:220px; overflow:auto; background:#0d1017; border:1px solid #2a3147; border-radius:8px; padding:10px; font:12px/1.5 ui-monospace, monospace; white-space:pre-wrap; }
  .err { color:#ff8a80; margin-top:10px; font-size:13px; min-height:16px; }
</style></head><body>
<div class="card">
  <h1>⛏️ Aternos AFK Bot</h1>
  <p class="sub">Sunucu adresini ve ilk mesajı yaz, bot girip rastgele yürüsün.</p>

  <label>Sunucu adresi (port varsa böyle: ornek.aternos.me:12345)</label>
  <input id="host" placeholder="ornek.aternos.me:12345" autocomplete="off">

  <label>Bot adı</label>
  <input id="username" value="AFK_Bot" autocomplete="off">

  <label>Girince yazacağı ilk mesaj (boş bırakabilirsin; /login şifre gibi komut da olur)</label>
  <input id="message" placeholder="Merhaba!" autocomplete="off">

  <div class="row">
    <button id="go">▶ Bağlan</button>
    <button id="stop">⏹ Durdur</button>
  </div>
  <div class="err" id="err"></div>
  <div class="status">Durum: <b id="status">kapalı</b></div>
  <div id="log"></div>
</div>
<script>
  var $ = function (id) { return document.getElementById(id); };

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); });
  }

  $('go').onclick = function () {
    $('err').textContent = '';
    post('/api/connect', {
      host: $('host').value,
      username: $('username').value,
      message: $('message').value
    }).then(function (r) { if (r.error) $('err').textContent = r.error; });
  };

  $('stop').onclick = function () { post('/api/disconnect'); };

  function refresh() {
    fetch('/api/status').then(function (r) { return r.json(); }).then(function (s) {
      $('status').textContent = s.status;
      var box = $('log');
      var atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
      box.textContent = s.logs.join('\\n');
      if (atBottom) box.scrollTop = box.scrollHeight;
    }).catch(function () {});
  }
  setInterval(refresh, 1500);
  refresh();
</script>
</body></html>`;

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function authorized(req, res) {
  if (!PASS) {
    if (!IN_CLOUD) return true; // kendi bilgisayarında şifresiz çalışır
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('PANEL_PASSWORD ayarlanmadığı için panel kapalı. Ortam değişkeni olarak PANEL_PASSWORD ekle.');
    return false;
  }
  const h = req.headers.authorization || '';
  const given = h.startsWith('Basic ') ? Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':') : '';
  if (given !== PASS) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="AFK Bot"', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Şifre gerekli');
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  if (!authorized(req, res)) return;

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }
  if (req.method === 'GET' && req.url === '/api/status') return send(res, 200, state);
  if (req.method === 'POST' && req.url === '/api/connect') {
    const body = await readBody(req);
    try { connect(body); send(res, 200, { ok: true }); }
    catch (e) { send(res, 200, { error: e.message }); }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/disconnect') {
    disconnect(false);
    return send(res, 200, { ok: true });
  }
  res.writeHead(404); res.end('Bulunamadı');
});

server.listen(PORT, IN_CLOUD ? '0.0.0.0' : '127.0.0.1', () => {
  console.log('Panel hazır: http://localhost:' + PORT);
  console.log('Bu pencereyi kapatma, kapatırsan bot da düşer.');

  // Render ücretsiz planında uyumaması için 10 dakikada bir kendi adresine istek atar:
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      fetch(process.env.RENDER_EXTERNAL_URL + '/health').catch(() => {});
    }, 10 * 60 * 1000);
  }

  // Bulutta yeniden başlayınca panele girmeden bot otomatik girsin:
  if (process.env.BOT_HOST) {
    try {
      connect({
        host: process.env.BOT_HOST,
        username: process.env.BOT_USERNAME || 'AFK_Bot',
        message: process.env.BOT_MESSAGE || '',
      });
    } catch (e) {
      log('⚠️ Otomatik başlatma hatası: ' + e.message);
    }
  }
});
