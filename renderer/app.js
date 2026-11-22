(function () {
  'use strict';

  /* Google Drive is listed before Google so docs.google.com matches it first. */
  var PLATFORMS = [
    { name: 'LinkedIn', hosts: ['linkedin.com'], code: 'LI', hue: 212, prefix: 'https://www.linkedin.com/in/' },
    { name: 'GitHub', hosts: ['github.com'], code: 'GH', hue: 268, prefix: 'https://github.com/' },
    { name: 'Hugging Face', hosts: ['huggingface.co'], code: 'HF', hue: 42, prefix: 'https://huggingface.co/' },
    { name: 'Kaggle', hosts: ['kaggle.com'], code: 'KG', hue: 190, prefix: 'https://www.kaggle.com/' },
    { name: 'X', hosts: ['x.com', 'twitter.com'], code: 'X', hue: 160, prefix: 'https://x.com/' },
    { name: 'Medium', hosts: ['medium.com'], code: 'MD', hue: 100, prefix: 'https://medium.com/@' },
    { name: 'Instagram', hosts: ['instagram.com'], code: 'IG', hue: 328, prefix: 'https://www.instagram.com/' },
    { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'], code: 'YT', hue: 4, prefix: 'https://www.youtube.com/@' },
    { name: 'Discord', hosts: ['discord.gg', 'discord.com'], code: 'DC', hue: 234, handle: false },
    { name: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'], code: 'WA', hue: 140, handle: false },
    { name: 'Google Drive', hosts: ['drive.google.com', 'docs.google.com'], code: 'GD', hue: 52, handle: false },
    { name: 'Google', hosts: ['google.com'], code: 'G', hue: 20, handle: false },
    { name: 'Stack Overflow', hosts: ['stackoverflow.com'], code: 'SO', hue: 28, handle: false },
    { name: 'Notion', hosts: ['notion.so', 'notion.site'], code: 'N', hue: 300, handle: false },
    { name: 'Calendly', hosts: ['calendly.com'], code: 'CA', hue: 205, handle: false },
    { name: 'Upwork', hosts: ['upwork.com'], code: 'UW', hue: 120 },
    { name: 'Fiverr', hosts: ['fiverr.com'], code: 'FV', hue: 150 }
  ];
  var CHIP_NAMES = ['LinkedIn', 'GitHub', 'Hugging Face', 'Kaggle', 'X', 'Medium'];
  var STOP = ['watch', 'search', 'results', 'channel', 'playlist', 'users', 'questions', 'feed', 'home', 'login', 'in', 'www'];

  var ICONS = {
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="3"/><path d="M15 9V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h2"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h3"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.5 5.1 5.6.8-4.05 3.95.96 5.6L12 16.4l-5.01 2.65.96-5.6L3.9 9.5l5.6-.8L12 3.6z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12"/><path d="M10 11v5M14 11v5"/></svg>'
  };

  var state = { items: [], q: '', ready: false, editing: null, confirm: null, sel: 0, nav: false, summoned: false, focusEdit: false };
  var toastTimer = null, confirmTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list'), countEl = $('count'), toastEl = $('toast');
  var qIn = $('q'), formEl = $('add'), saveBtn = $('save');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- link helpers ---------- */
  function stripSlash(s) { return s.replace(/\/+$/, ''); }
  function shortUrl(u) { return String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); }
  function keyOf(u) { return shortUrl(u).toLowerCase(); }
  function isHttp(u) { return /^https?:\/\//i.test(String(u || '')); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function newId() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function parse(raw) {
    var s = (raw || '').trim();
    if (!s || /\s/.test(s)) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.hostname.indexOf('.') < 1) return null;
    var href = u.href;
    if (u.pathname === '/' && !u.search && !u.hash) href = href.replace(/\/$/, '');
    return { href: href, url: u };
  }
  function matchPlatform(host) {
    var h = host.replace(/^www\./, '').toLowerCase();
    for (var i = 0; i < PLATFORMS.length; i++) {
      var hs = PLATFORMS[i].hosts;
      for (var j = 0; j < hs.length; j++) {
        if (h === hs[j] || h.slice(-(hs[j].length + 1)) === '.' + hs[j]) return PLATFORMS[i];
      }
    }
    return null;
  }
  function platByName(name) {
    for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].name === name) return PLATFORMS[i];
    return null;
  }
  function isBare(href) {
    var h = stripSlash(href).toLowerCase();
    for (var i = 0; i < PLATFORMS.length; i++) {
      var p = PLATFORMS[i].prefix;
      if (p && stripSlash(p).toLowerCase() === h) return true;
    }
    return false;
  }
  function autoLabel(u, plat) {
    var host = u.hostname.replace(/^www\./, '');
    if (!plat) return host;
    if (plat.handle === false) return plat.name;
    var seg = u.pathname.split('/').filter(Boolean);
    var h = (plat.name === 'LinkedIn' && seg[0] === 'in') ? (seg[1] || '') : (seg[0] || '');
    h = h.replace(/^@/, '');
    if (!/^[A-Za-z0-9._-]{2,32}$/.test(h) || STOP.indexOf(h.toLowerCase()) > -1) return plat.name;
    return plat.name + ' · ' + h;
  }
  function buildItem(url, label, pinned, createdAt) {
    var p = parse(url);
    if (!p) return null;
    var plat = matchPlatform(p.url.hostname);
    return {
      id: newId(), url: p.href,
      label: String(label || '').trim().slice(0, 120) || autoLabel(p.url, plat),
      platform: plat ? plat.name : p.url.hostname.replace(/^www\./, ''),
      pinned: !!pinned, createdAt: Number(createdAt) || Date.now()
    };
  }
  function tile(platformName) {
    var plat = platByName(platformName), code, hue;
    if (plat) { code = plat.code; hue = plat.hue; }
    else { var s = String(platformName || '?'); code = s.charAt(0).toUpperCase(); hue = hash(s) % 360; }
    var t = el('span', 'tile', code);
    t.style.setProperty('--h', String(hue));
    t.setAttribute('aria-hidden', 'true');
    return t;
  }

  /* ---------- what the input currently means ---------- */
  function inputState() {
    var raw = state.q.trim();
    if (!raw) return { kind: 'empty' };
    var p = parse(raw);
    if (!p) return { kind: 'search' };
    if (isBare(p.href)) return { kind: 'bare', p: p };
    var k = keyOf(p.href);
    var dup = state.items.filter(function (i) { return keyOf(i.url) === k; })[0];
    if (dup) return { kind: 'dup', p: p, dup: dup };
    return { kind: 'new', p: p };
  }

  function visible() {
    var st = inputState();
    var arr = state.items.slice();
    if (st.kind === 'search') {
      var tokens = state.q.trim().toLowerCase().split(/\s+/);
      arr = arr.filter(function (it) {
        var hay = (String(it.label) + ' ' + String(it.url) + ' ' + String(it.platform)).toLowerCase();
        return tokens.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    arr.sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      var c = String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' });
      return c || ((a.createdAt || 0) - (b.createdAt || 0));
    });
    return arr;
  }

  /* ---------- storage (the main process writes links.json) ---------- */
  function persist() {
    window.vault.save(state.items).catch(function () { toast("Couldn't save to disk."); });
  }
  function addItem(it) { state.items.push(it); persist(); }
  function patchItem(it, patch) { Object.assign(it, patch); persist(); render(); }
  function removeItem(it) {
    state.items = state.items.filter(function (x) { return x.id !== it.id; });
    persist(); render();
  }

  /* ---------- toast + copy ---------- */
  function toast(msg) {
    toastEl.firstChild.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2000);
  }
  function doCopy(text, okMsg, btn, thenHide) {
    window.vault.copy(text).then(function () {
      toast(okMsg);
      if (btn) {
        btn.classList.add('done');
        setTimeout(function () { if (btn.isConnected) btn.classList.remove('done'); }, 1100);
      }
      if (thenHide && state.summoned) setTimeout(function () { window.vault.hide(); }, 450);
    }, function () { toast("Couldn't copy that."); });
  }

  /* ---------- view ---------- */
  function ibtn(svg, label) {
    var b = el('button', 'ibtn'); b.type = 'button';
    b.innerHTML = svg; b.setAttribute('aria-label', label); b.title = label;
    return b;
  }

  function commitEdit(it, value) {
    state.editing = null;
    var next = String(value || '').trim();
    if (next && next !== it.label) patchItem(it, { label: next }); else render();
  }

  function rowFor(it, active) {
    var li = el('li', 'row' + (active ? ' on' : ''));
    li.appendChild(tile(it.platform));

    var name;
    if (state.editing === it.id) {
      name = el('input', 'edit'); name.type = 'text'; name.value = it.label;
      name.setAttribute('aria-label', 'Label for ' + it.label);
      name.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(it, name.value); }
        else if (e.key === 'Escape') { e.stopPropagation(); state.editing = null; render(); }
      });
      name.addEventListener('blur', function () { if (state.editing === it.id) commitEdit(it, name.value); });
    } else {
      name = el('div', 'name', it.label);
      name.title = it.url + '\nDouble-click to rename';
      name.addEventListener('dblclick', function () { state.editing = it.id; state.focusEdit = true; render(); });
    }
    li.appendChild(name);

    var acts = el('div', 'acts');
    var copy = ibtn(ICONS.copy, 'Copy ' + it.label);
    copy.addEventListener('click', function () { doCopy(it.url, 'Copied ' + shortUrl(it.url), copy); });
    acts.appendChild(copy);

    if (isHttp(it.url)) {
      var open = el('a', 'ibtn'); open.href = it.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
      open.innerHTML = ICONS.open; open.setAttribute('aria-label', 'Open ' + it.label); open.title = 'Open in browser';
      acts.appendChild(open);
    }

    var pin = ibtn(ICONS.star, it.pinned ? 'Unpin ' + it.label : 'Pin ' + it.label);
    pin.setAttribute('aria-pressed', it.pinned ? 'true' : 'false');
    pin.addEventListener('click', function () { patchItem(it, { pinned: !it.pinned }); });
    acts.appendChild(pin);

    if (state.confirm === it.id) {
      var sure = el('button', 'ibtn sure', 'Delete?'); sure.type = 'button';
      sure.addEventListener('click', function () { state.confirm = null; removeItem(it); });
      acts.appendChild(sure);
    } else {
      var del = ibtn(ICONS.trash, 'Delete ' + it.label);
      del.addEventListener('click', function () {
        state.confirm = it.id; render();
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(function () { state.confirm = null; render(); }, 3000);
      });
      acts.appendChild(del);
    }
    li.appendChild(acts);
    return li;
  }

  function previewRow(st) {
    var li = el('li', 'row preview');
    var plat = matchPlatform(st.p.url.hostname);
    li.appendChild(tile(plat ? plat.name : st.p.url.hostname.replace(/^www\./, '')));
    var name = el('div', 'name', st.kind === 'new' ? autoLabel(st.p.url, plat) : 'Add your username to the end of the link');
    name.appendChild(el('span', 'sub', shortUrl(st.p.href)));
    li.appendChild(name);
    if (st.kind === 'new') {
      var h = el('div', 'hintr');
      var k = el('kbd', null, 'Enter'); h.appendChild(k); h.appendChild(document.createTextNode('to save'));
      li.appendChild(h);
    }
    return li;
  }

  function emptyBlock() {
    var e = el('li', 'empty');
    e.appendChild(el('strong', null, 'No links yet'));
    e.appendChild(el('p', null, 'Paste a link above and press Enter. Or start from a platform and add your username.'));
    var chips = el('div', 'chips');
    CHIP_NAMES.forEach(function (name) {
      var p = platByName(name);
      var b = el('button', 'chip', name); b.type = 'button';
      b.addEventListener('click', function () { prefill(p.prefix); });
      chips.appendChild(b);
    });
    var port = el('button', 'chip', 'Portfolio'); port.type = 'button';
    port.addEventListener('click', function () { prefill('https://'); });
    chips.appendChild(port);
    e.appendChild(chips);
    return e;
  }
  function prefill(text) {
    qIn.value = text; state.q = text; state.nav = false; state.sel = 0;
    render(); qIn.focus();
    try { qIn.setSelectionRange(text.length, text.length); } catch (e) {}
  }

  function renderList() {
    var frag = document.createDocumentFragment();
    var st = inputState(), vis = visible();
    if (st.kind === 'dup') {
      var di = vis.indexOf(st.dup);
      if (di > -1) { state.sel = di; state.nav = true; }
    }
    if (state.sel >= vis.length) state.sel = Math.max(0, vis.length - 1);

    if (st.kind === 'new' || st.kind === 'bare') frag.appendChild(previewRow(st));
    if (!state.ready) frag.appendChild(el('li', 'note', 'Loading your links…'));
    else if (!state.items.length) { if (st.kind !== 'new') frag.appendChild(emptyBlock()); }
    else if (!vis.length) frag.appendChild(el('li', 'note', 'Nothing matches “' + state.q.trim() + '”.'));
    else vis.forEach(function (it, i) { frag.appendChild(rowFor(it, state.nav && i === state.sel)); });

    listEl.replaceChildren(frag);
    if (state.focusEdit) {
      state.focusEdit = false;
      var inp = listEl.querySelector('input.edit');
      if (inp) { inp.focus(); inp.select(); }
    }
    var on = listEl.querySelector('.row.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  function renderMeta() {
    var n = state.items.length;
    countEl.textContent = n + (n === 1 ? ' Link' : ' Links');
    saveBtn.classList.toggle('ready', inputState().kind === 'new');
  }
  function render() { renderList(); renderMeta(); }

  /* ---------- actions ---------- */
  function saveCurrent() {
    var st = inputState();
    if (st.kind === 'bare') { toast('Add your username to the end of the link first.'); qIn.focus(); return; }
    if (st.kind === 'dup') { toast('Already saved as ' + st.dup.label + '.'); return; }
    if (st.kind !== 'new') { toast('Paste a link first.'); qIn.focus(); return; }
    var it = buildItem(st.p.href, '', false, Date.now());
    addItem(it);
    qIn.value = ''; state.q = ''; state.nav = false; state.sel = 0;
    render();
    toast('Saved ' + it.label);
    qIn.focus();
  }

  function selectedItem() { return state.nav ? visible()[state.sel] : null; }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    var st = inputState();
    if (st.kind === 'new' || st.kind === 'bare') { saveCurrent(); return; }
    var it = selectedItem();
    if (it) doCopy(it.url, 'Copied ' + shortUrl(it.url), null, true);
    else toast(state.q.trim() ? 'Nothing to copy.' : 'Paste a link to save, or type to find one.');
  });
  saveBtn.addEventListener('click', saveCurrent);
  $('close').addEventListener('click', function () { window.vault.hide(); });

  qIn.addEventListener('input', function () {
    state.q = qIn.value; state.sel = 0;
    var k = inputState().kind;
    state.nav = !!state.q.trim() && k !== 'new' && k !== 'bare';
    render();
  });
  qIn.addEventListener('keydown', function (e) {
    var n = visible().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      if (!state.nav) { state.nav = true; state.sel = 0; }
      else state.sel = Math.min(n - 1, Math.max(0, state.sel + (e.key === 'ArrowDown' ? 1 : -1)));
      render();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      var it = selectedItem();
      if (it && isHttp(it.url)) window.open(it.url, '_blank');
    }
  });

  document.addEventListener('mousedown', function () { state.summoned = false; });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (state.q) { qIn.value = ''; state.q = ''; state.nav = false; state.sel = 0; render(); }
      else window.vault.hide();
      return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault(); qIn.focus();
    }
  });

  /* ---------- events from the main process ---------- */
  function reset() {
    state.summoned = true; state.q = ''; state.nav = false; state.sel = 0;
    state.editing = null; state.confirm = null;
    qIn.value = '';
    render(); qIn.focus();
  }
  window.vault.onFocusSearch(reset);
  window.vault.onReload(function (added) {
    window.vault.load().then(function (items) {
      state.items = Array.isArray(items) ? items : [];
      render();
      toast(added ? 'Imported ' + added + ' link' + (added === 1 ? '' : 's') + '.' : 'Nothing new to import.');
    });
  });

  var isMac = /mac/i.test(navigator.platform || '');
  $('hotkey').textContent = isMac ? '⌘⇧L' : 'Ctrl+Shift+L';

  /* ---------- start ---------- */
  render();
  window.vault.load().then(function (items) {
    state.items = Array.isArray(items) ? items : [];
    state.ready = true;
    render(); qIn.focus();
  }, function () {
    state.ready = true; render();
  });
})();
