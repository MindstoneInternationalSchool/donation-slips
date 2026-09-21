/* Deaf and Envision School — Ganpati Mahotsav 2026 */

var ENDPOINT = "https://script.google.com/macros/s/AKfycbynoSV0slMQS3Az6e01jEq0aUWtQ7yHI4PEDbkytbJHMi883lRzEg_kVzrvld5_GEMrlg/exec";
var CONTROL_PIN = "1954";
var APPROVER = "Srajan Mishra";

var ALLOCS = ['Computer Laboratory','Skills Training Hall','Building Renovation','Projector','Sound Setup','General Fund'];
var CATS = [
  {v:'Petrol'},
  {v:'Food'},
  {v:'Vendor',   ask:'Vendor name'},
  {v:'Artist',   ask:'Artist name'},
  {v:'Miscellaneous', ask:'What was it for?'},
  {v:'Other',    ask:'What was it for?'}
];
var LS = 'des_cfg_v2', CACHE = 'des_cache_v2';

var cfg = {volunteer:'', role:'gate'};
var rows = [], expenses = [], entries = [], current = null, currentKind = 'slip';
var state = {mode:'online', alloc:ALLOCS[0], attend:'yes', filter:'all', kind:'slips',
             view:'home', role:'gate', cat:'Petrol', xmode:'cash'};
var shots = {proof:'', photo:'', bill:''};
var scanning = null;

/* ---------- small helpers ---------- */
var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function num(v){ return parseInt(String(v==null?'':v).replace(/[^0-9]/g,''),10) || 0; }
function money(v){ return '₹' + num(v).toLocaleString('en-IN'); }
function todayKey(d){ d = d?new Date(d):new Date(); return isNaN(d) ? '' : d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function dateOut(v){ var d = v?new Date(v):new Date(); if(isNaN(d)) d = new Date();
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function timeOut(v){ var d = new Date(v); return isNaN(d)?'':d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }
function isControl(){ return cfg.role === 'control'; }
function live(r){ return r.status === 'live'; }
function tail(code){ return String(code||'').split('/').pop(); }

function tier(n){
  n = num(n);
  if (n >= 25000) return {name:'Patron',    guests:16, band:'Patron · ₹25,000 & above', art:'vip',
    note:'Patron tier — VIP Pass, sixteen guests.'};
  if (n >= 2500)  return {name:'Donor',     guests:8,  band:'Donor · ₹2,500 & above', art:'vip',
    note:'Donor tier — VIP Pass, eight guests.'};
  if (n >  2000)  return {name:'Supporter', guests:2,  band:'Supporter · ₹2,001 – 2,499', art:'entry',
    note:'Supporter tier — general admission, two guests.'};
  return            {name:'Entry',     guests:1,  band:'Entry · ₹1 – 2,000', art:'entry',
    note:'Entry tier — general admission, one guest.'};
}
function isComp(r){ return r && r.mode === 'comp'; }
function compTier(r){
  var k = String(r.alloc || 'Invitee');
  return {name:k, guests:Math.max(1,Number(r.guestsAllowed)||1), band:k + ' · complimentary',
          art:'vip', note:'Complimentary pass — no payment taken.'};
}
function passNo(r){ return tail(r.code); }
function verifyUrl(code){
  var base = location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,'');
  return base + 'verify.html?c=' + encodeURIComponent(code);
}
function qrSrc(code, px){
  return 'https://api.qrserver.com/v1/create-qr-code/?size='+px+'x'+px+'&margin=0&data='
    + encodeURIComponent(verifyUrl(code));
}
function words(n){
  var a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var t=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function two(x){ return x<20?a[x]:t[Math.floor(x/10)]+(x%10?' '+a[x%10]:''); }
  function three(x){ return x>=100?a[Math.floor(x/100)]+' Hundred'+(x%100?' '+two(x%100):''):two(x); }
  n = num(n); if(!n) return '—';
  var p=[], cr=Math.floor(n/10000000); n%=10000000;
  var lk=Math.floor(n/100000); n%=100000;
  var th=Math.floor(n/1000); n%=1000;
  if(cr)p.push(two(cr)+' Crore'); if(lk)p.push(two(lk)+' Lakh'); if(th)p.push(two(th)+' Thousand'); if(n)p.push(three(n));
  return 'Rupees '+p.join(' ')+' only';
}

/* ---------- images ---------- */
function shrink(file, max, cb){
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var s = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = function(){ cb(''); };
    img.src = fr.result;
  };
  fr.onerror = function(){ cb(''); };
  fr.readAsDataURL(file);
}

/* ---------- config ---------- */
function loadCfg(){ try { cfg = JSON.parse(localStorage.getItem(LS)) || cfg; } catch(e){} return !!cfg.volunteer; }
function saveCfg(){ try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch(e){} }
function cacheAll(){ try { localStorage.setItem(CACHE, JSON.stringify({rows:rows.slice(0,400), expenses:expenses.slice(0,300), entries:entries.slice(-200)})); } catch(e){} }
function restore(){ try { var d = JSON.parse(localStorage.getItem(CACHE))||{};
  rows = d.rows||[]; expenses = d.expenses||[]; entries = d.entries||[]; } catch(e){} }

/* ---------- navigation ---------- */
function show(v){
  if (v === 'approve' && !isControl()) v = 'home';
  if (v !== 'scan') stopScan();
  state.view = v;
  $$('.view').forEach(function(s){ s.classList.toggle('on', s.id === 'v'+'-'+v); });
  $$('nav.tabs button').forEach(function(b){ b.classList.toggle('on', b.dataset.tab === v); });
  $('nav.tabs').style.display = (v === 'setup') ? 'none' : 'flex';
  window.scrollTo(0,0);
  if (v === 'ledger')  renderLedger();
  if (v === 'approve') renderApprove();
  if (v === 'scan')    renderEntries();
}

/* ---------- network ---------- */
function setSync(kind, msg){
  $('#syncDot').className = 'dot' + (kind==='bad'?' bad':kind==='wait'?' wait':'');
  $('#syncMsg').textContent = msg;
}
function pull(){
  setSync('wait','Syncing…');
  fetch(ENDPOINT + '?action=list&t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d || !d.ok) throw new Error(d && d.error || 'Bad reply');
      rows = (d.rows||[]).slice().sort(function(a,b){ return String(b.ts||'').localeCompare(String(a.ts||'')); });
      expenses = (d.expenses||[]).slice().sort(function(a,b){ return String(b.ts||'').localeCompare(String(a.ts||'')); });
      entries = d.entries || [];
      cacheAll(); paintAll();
      if (current) {
        var f = all().filter(function(r){ return r.id && r.id === current.id; })[0];
        if (f && (f.status !== current.status || f.code !== current.code)) openSlip(f);
      }
      var p = pending().length;
      setSync('ok', p ? (p + ' waiting for approval') : ('Up to date · ' + rows.length + ' slips'));
    })
    .catch(function(e){ setSync('bad','Can\'t reach the Sheet — showing the last copy. ' + e.message); paintAll(); });
}
function push(body){
  return fetch(ENDPOINT, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(body)})
    .then(function(r){ return r.json(); })
    .then(function(d){ if (!d || !d.ok) throw new Error(d && d.error || 'Refused'); return d; });
}
function all(){ return rows.concat(expenses); }
function pending(){ return all().filter(function(r){ return r.status === 'pending' && !r.sending; }); }
function paintAll(){ renderHome(); renderLedger(); renderApprove(); renderEntries(); }

/* ---------- lists ---------- */
function rowHTML(r, i){
  var isExp = !!r.payee;
  var badge;
  if (r.sending) badge = '<span class="tag pending">Sending…</span>';
  else if (r.status === 'pending')  badge = '<span class="tag wait">Awaiting approval</span>';
  else if (r.status === 'rejected') badge = '<span class="tag void">Rejected</span>';
  else if (r.status === 'void')     badge = '<span class="tag void">Void</span>';
  else if (isExp) badge = '<span class="tag cash">'+esc(r.mode||'cash')+'</span>';
  else if (isComp(r)) badge = '<span class="tag wait">Invitee</span>';
  else badge = '<span class="tag '+(r.mode==='cash'?'cash':'online')+'">'+(r.mode==='cash'?'Cash':'Online')+'</span>';
  var title = isExp ? (r.payee||'—') : (r.donor||'—');
  var sub = isExp ? (esc(r.category||'') + (r.catNote?' · '+esc(r.catNote):''))
                  : (esc(r.alloc||'') + (r.guestsAllowed ? ' · '+r.guestsEntered+'/'+r.guestsAllowed+' in' : ''));
  return '<button class="row-item" type="button" data-i="'+i+'">'
    + '<div style="flex:1;min-width:0"><div class="nm">'+esc(title)+'</div>'
    +   '<div class="cd"><span class="mono">'+esc(tail(r.code) || 'no number yet')+'</span> · '+sub+'</div></div>'
    + '<div class="rt"><div class="am">'+money(r.amount)+'</div>'+badge+'</div></button>';
}
function bindRows(host, list){
  host.querySelectorAll('.row-item').forEach(function(b){
    b.addEventListener('click', function(){ openSlip(list[+b.dataset.i]); });
  });
}

function renderHome(){
  var t = todayKey();
  var mine = rows.filter(function(r){ return live(r) && todayKey(r.ts) === t; });
  $('#hCount').textContent = mine.length;
  $('#hTotal').textContent = money(mine.reduce(function(s,r){ return s + num(r.amount); },0));
  var p = pending(), b = $('#pendingBanner');
  if (p.length) {
    b.style.display = 'block';
    b.textContent = isControl()
      ? p.length + ' ' + (p.length===1?'record needs':'records need') + ' your approval — ' + money(p.reduce(function(s,r){ return s+num(r.amount); },0)) + ' held. Tap to review.'
      : p.length + ' ' + (p.length===1?'record is':'records are') + ' waiting for ' + APPROVER + ' to approve.';
  } else b.style.display = 'none';
  var badge = $('#tabBadge');
  badge.style.display = (isControl() && p.length) ? 'block' : 'none';
  badge.textContent = p.length;
  var recent = rows.slice(0,5), host = $('#homeList');
  host.innerHTML = recent.length ? recent.map(rowHTML).join('') : '<div class="empty">Nothing yet today. Pick one of the three above.</div>';
  bindRows(host, recent);
}

function filtered(){
  var q = $('#q').value.trim().toLowerCase(), t = todayKey();
  var src = state.kind === 'expenses' ? expenses : rows;
  return src.filter(function(r){
    if (state.filter === 'today' && todayKey(r.ts) !== t) return false;
    if (state.filter === 'online' && r.mode !== 'online') return false;
    if (state.filter === 'cash' && r.mode !== 'cash') return false;
    if (state.filter === 'pending' && r.status !== 'pending') return false;
    if (state.filter === 'mine' && (r.volunteer||r.enteredBy||'') !== cfg.volunteer) return false;
    if (!q) return true;
    return [r.donor,r.payee,r.code,r.ref,r.phone,r.alloc,r.category,r.catNote,r.volunteer,r.enteredBy]
      .join(' ').toLowerCase().indexOf(q) > -1;
  });
}
function renderLedger(){
  var list = filtered(), host = $('#ledgerList');
  $('#lCount').textContent = list.length;
  $('#lTotal').textContent = money(list.filter(live).reduce(function(s,r){ return s + num(r.amount); },0));
  host.innerHTML = list.length ? list.map(rowHTML).join('') : '<div class="empty">Nothing matches that.</div>';
  bindRows(host, list);
  var exp = state.kind === 'expenses';
  $('#batchBtn').style.display = exp ? 'none' : 'block';
  $('#certAllBtn').style.display = exp ? 'none' : 'block';
}

/* ---------- approvals ---------- */
function renderApprove(){
  if (!isControl()) return;
  var p = pending();
  $('#aCount').textContent = p.length;
  $('#aTotal').textContent = money(p.reduce(function(s,r){ return s + num(r.amount); },0));
  var host = $('#approveList');
  if (!p.length) { host.innerHTML = '<div class="card"><div class="empty">Nothing waiting. Every record has been dealt with.</div></div>'; return; }
  host.innerHTML = p.map(function(r){
    var isExp = !!r.payee;
    var tr = tier(r.amount);
    var head = isExp ? esc(r.payee||'—') : esc(r.donor||'—');
    var sub  = isExp ? esc(r.category||'') + (r.catNote ? ' · ' + esc(r.catNote) : '')
                     : esc(r.alloc||'General Fund') + ' · ' + esc(r.phone||'no phone');
    var photo = (r.photoUrl || r.proofUrl || r.billUrl)
      ? '<a href="'+esc(r.photoUrl||r.proofUrl||r.billUrl)+'" target="_blank" rel="noopener" style="flex:none"><img class="thumb" src="'+esc(r.photoUrl||r.proofUrl||r.billUrl)+'" alt="proof"></a>' : '';
    var guests = (!isExp && r.attend !== 'no')
      ? '<div style="margin-top:12px;display:flex;gap:10px">'
        + '<div style="flex:1;min-width:0"><div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);margin-bottom:6px">People allowed</div>'
        +   '<div class="step"><button type="button" data-g="-" data-id="'+esc(r.id)+'">\u2212</button>'
        +   '<span id="g-'+esc(r.id)+'">'+tr.guests+'</span>'
        +   '<button type="button" data-g="+" data-id="'+esc(r.id)+'">+</button></div></div>'
        + '<div style="flex:1;min-width:0"><div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);margin-bottom:6px">Passes issued</div>'
        +   '<div class="step"><button type="button" data-p="-" data-id="'+esc(r.id)+'">\u2212</button>'
        +   '<span id="p-'+esc(r.id)+'">1</span>'
        +   '<button type="button" data-p="+" data-id="'+esc(r.id)+'">+</button></div></div></div>'
        + '<div style="font-size:11px;color:var(--ink-3);margin-top:6px">'+esc(tr.name)+' tier suggests '+tr.guests+'. Passes share the one allowance \u2014 the gate counts people, not passes.</div>' : '';
    return '<div class="card" style="padding:15px 16px">'
      + '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">'
      +   '<div style="min-width:0;display:flex;gap:11px">'+photo
      +     '<div style="min-width:0"><div style="font-size:16px;font-weight:700">'+head+'</div>'
      +       '<div style="font-size:12px;color:var(--ink-2)">'+sub+'</div>'
      +       '<div style="font-size:11.5px;color:var(--ink-3);margin-top:2px">'+(isExp?'Recorded':'Entered')+' by '+esc(r.volunteer||r.enteredBy||'—')+' · '+dateOut(r.ts)+'</div></div></div>'
      +   '<div style="text-align:right;flex:none"><div style="font-family:\'Caprasimo\',Georgia,serif;font-size:23px;color:var(--navy);line-height:1.15">'+money(r.amount)+'</div>'
      +     '<span class="tag '+(r.mode==='cash'?'cash':'online')+'">'+esc(isExp ? (r.mode||'cash') : (r.mode==='cash'?'Cash':'Online'))+'</span></div></div>'
      + '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(32,30,29,.1);display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:var(--ink-2)">'
      +   (isExp ? '<span>Bill '+(r.billUrl?'attached':'<b style="color:var(--clay)">missing</b>')+'</span>'
               : '<span>'+(r.mode==='cash'?'Cash taken by':'Ref')+' <b style="color:var(--ink)">'+esc(r.ref||'— not given —')+'</b></span>'
                 + '<span>'+(r.attend==='no'?'Not attending — no pass':esc(tr.name)+' pass')+'</span>')
      + '</div>' + guests
      + '<div class="btn-row" style="margin-top:12px">'
      +   '<button class="btn btn-primary" data-ok="'+esc(r.id)+'" type="button" style="font-size:15px">Approve</button>'
      +   '<button class="btn btn-out" data-no="'+esc(r.id)+'" type="button" style="font-size:15px;color:var(--clay);border-color:var(--clay)">Reject</button>'
      + '</div></div>';
  }).join('');
  host.querySelectorAll('[data-g]').forEach(function(b){
    b.addEventListener('click', function(){
      var el = document.getElementById('g-' + b.dataset.id);
      var v = Math.max(1, (parseInt(el.textContent,10)||1) + (b.dataset.g === '+' ? 1 : -1));
      el.textContent = v;
      var pe = document.getElementById('p-' + b.dataset.id);
      if (pe && (parseInt(pe.textContent,10)||1) > v) pe.textContent = v;
    });
  });
  host.querySelectorAll('[data-p]').forEach(function(b){
    b.addEventListener('click', function(){
      var el = document.getElementById('p-' + b.dataset.id);
      var gEl = document.getElementById('g-' + b.dataset.id);
      var cap = gEl ? Math.max(1, parseInt(gEl.textContent,10) || 1) : 1;
      var v = (parseInt(el.textContent,10)||1) + (b.dataset.p === '+' ? 1 : -1);
      el.textContent = Math.min(Math.max(1, v), cap);
    });
  });
  host.querySelectorAll('[data-ok]').forEach(function(b){ b.addEventListener('click', function(){ decide(b.dataset.ok,'approve',b); }); });
  host.querySelectorAll('[data-no]').forEach(function(b){ b.addEventListener('click', function(){ decide(b.dataset.no,'reject',b); }); });
}

function decide(id, act, btn){
  var r = all().filter(function(x){ return x.id === id; })[0];
  if (!r) return;
  var isExp = !!r.payee;
  var label = isExp ? (r.payee||'this expense') : (r.donor||'this entry');
  if (act !== 'approve' && !confirm((act==='void'?'Void ':'Reject ') + label + ' · ' + money(r.amount) + '?')) return;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  var g = document.getElementById('g-' + id);
  var p = document.getElementById('p-' + id);
  var body = {action:act, id:id, approvedBy:cfg.volunteer, kind: isExp ? 'expense' : 'slip'};
  if (act === 'approve' && g) { var gv = parseInt(g.textContent,10); body.guests = isNaN(gv) ? 0 : gv; }
  if (act === 'approve' && p) { var pv = parseInt(p.textContent,10); body.passes = isNaN(pv) ? 1 : pv; }
  push(body).then(function(d){
    var s = d.row || {};
    r.status = s.status;
    if (s.code) r.code = s.code;
    if (s.guestsAllowed != null) r.guestsAllowed = s.guestsAllowed;
    if (s.passesIssued != null) r.passesIssued = s.passesIssued;
    r.approvedBy = cfg.volunteer; r.approvedAt = s.approvedAt || new Date().toISOString();
    cacheAll(); paintAll();
    if (current && current.id === id) openSlip(r);
    setSync('ok', act === 'approve' ? ('Approved — ' + tail(r.code)) : ('Marked ' + r.status));
  }).catch(function(e){
    if (btn) { btn.disabled = false; btn.textContent = act === 'approve' ? 'Approve' : 'Reject'; }
    setSync('bad','Could not record that — ' + e.message);
    alert('Not recorded in the Sheet.\n\n' + e.message);
  });
}

/* ---------- slip view ---------- */
function openSlip(r){
  if (!r) return;
  current = r;
  var isExp = !!r.payee;
  currentKind = isExp ? 'expense' : 'slip';
  var comp = isComp(r);
  var tr = comp ? compTier(r) : tier(r.amount);
  var st = r.sending ? 'saving' : (r.status || 'pending');
  var approved = st === 'live';

  $('#slipHead').textContent = st === 'saving' ? 'Sending…'
    : st === 'pending' ? 'Waiting for approval'
    : st === 'rejected' ? 'Rejected'
    : st === 'void' ? 'Voided' : (isExp ? 'Expense approved' : comp ? 'Pass issued' : 'Slip approved');
  $('#okDot').style.background = approved ? 'var(--sage)' : (st==='pending'||st==='saving') ? 'var(--gold)' : 'var(--clay)';

  var sState = $('#sState');
  if (approved) sState.style.display = 'none';
  else {
    sState.style.display = 'block';
    sState.className = 'note ' + (st === 'rejected' || st === 'void' ? 'clay' : 'sand');
    sState.textContent = st === 'saving' ? 'Sending to the shared ledger…'
      : st === 'pending' ? 'Recorded and sent to ' + APPROVER + '. No number, receipt or pass until he approves it. This screen updates on its own.'
      : st === 'rejected' ? 'Rejected by ' + (r.approvedBy || APPROVER) + '. Nothing was issued.'
      : 'Voided. Number ' + tail(r.code) + ' is not valid and will never be reused.';
  }

  $('#sCode').textContent = r.code || (st === 'rejected' ? 'none — rejected' : 'issued on approval');
  $('#sDonor').textContent = isExp ? (r.payee||'—') : (r.donor||'—');
  $('#sAlloc').textContent = isExp ? ((r.category||'') + (r.catNote ? ' · ' + r.catNote : '')) : (r.alloc||'—');
  $('#sAmount').textContent = money(r.amount);
  var m = $('#sMode');
  m.className = 'tag ' + (comp ? 'wait' : r.mode==='cash'?'cash':'online');
  m.textContent = isExp ? String(r.mode||'cash') : comp ? 'Complimentary' : (r.mode==='cash' ? 'Paid in Cash' : 'Paid Online');

  var th = $('#sThanks');
  th.style.display = (approved && !isExp && !comp) ? 'block' : 'none';
  th.textContent = 'Thank you, ' + (r.donor||'friend') + ', for supporting the Ganpati Mahotsav 2026 fundraiser. Your gift goes towards ' + String(r.alloc||'the general fund').toLowerCase() + '.';

  var pb = $('#passBlock');
  if (isExp) {
    pb.innerHTML = r.billUrl
      ? '<div class="card" style="padding:15px 16px"><div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px">Bill</div><a href="'+esc(r.billUrl)+'" target="_blank" rel="noopener"><img src="'+esc(r.billUrl)+'" alt="bill" style="width:100%;border-radius:12px;display:block"></a></div>'
      : '<div class="note clay">No bill photograph attached to this expense.</div>';
  } else if (!approved) {
    pb.innerHTML = '<div class="note navy">The ' + esc(tr.name) + ' pass is held until approval. No number and no QR exist yet.</div>';
  } else if (r.attend === 'no') {
    pb.innerHTML = '<div class="note clay">Marked as not attending — no pass issued. The receipt and certificate still go to the donor.</div>';
  } else {
    pb.innerHTML = passCardHTML(r, tr);
  }

  $('#outRow').style.display = approved ? 'flex' : 'none';
  $('#certBtn').style.display = (isExp || comp) ? 'none' : 'block';
  $('#outRow').style.display = (approved && !comp) ? 'flex' : 'none';
  $('#printBtn').textContent = isExp ? 'Print record' : 'Receipt';
  $('#approveHere').style.display = (isControl() && st === 'pending') ? 'block' : 'none';
  $('#voidBtn').style.display = (approved && isControl()) ? 'flex' : 'none';
  show('slip');
}

function passCardHTML(r, tr){
  var allowed = r.guestsAllowed == null || r.guestsAllowed === '' ? tr.guests : Number(r.guestsAllowed);
  var used = Number(r.guestsEntered) || 0;
  var count = Math.max(1, r.passesIssued == null || r.passesIssued === '' ? 1 : Number(r.passesIssued));
  var out = '';
  for (var i = 1; i <= count; i++) {
    var no = passNo(r) + (count > 1 ? '-' + i : '');
    var art = tr.art === 'vip'
      ? '<img src="assets/vip-pass.png" alt=""><span style="left:85.6%;top:86.2%;font-size:8px;color:#0b1b30">'+esc(no)+'</span>'
      : '<img src="assets/entry-pass.png" alt=""><span style="left:63%;top:72.5%;font-size:8px;color:#5a1f13">'+esc(no)+'</span><span style="left:89.3%;top:70%;font-size:7px;color:#5a1f13">'+esc(no)+'</span>';
    out += '<div class="card" style="padding:15px 16px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">'
      +   '<div><div style="font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3)">'+esc(tr.name)+' pass'+(count>1?' \u00b7 '+i+' of '+count:'')+'</div>'
      +     '<div class="mono" style="font-size:15px;font-weight:700;color:var(--navy)">'+esc(no)+'</div></div>'
      +   '<span class="chip-gold" style="flex:none">'+allowed+' guest'+(allowed===1?'':'s')+'</span></div>'
      + '<div style="display:flex;gap:13px;align-items:center;margin-bottom:12px">'
      +   '<span class="qr"><img src="'+qrSrc(r.code,208)+'" alt="QR"></span>'
      +   '<div style="font-size:11.5px;color:var(--ink-2);line-height:1.5">Scan at the gate to admit guests. '
      +     '<b style="color:var(--ink)">'+used+' of '+allowed+'</b> already in'+(count>1?', across all '+count+' passes':'')+'.<br>'+esc(tr.note)+'</div></div>'
      + '<div class="pass-wrap">'+art+'</div></div>';
  }
  return out;
}

/* ---------- donation form ---------- */
function paintPills(host, val){ host.querySelectorAll('.pill').forEach(function(b){ b.classList.toggle('on', b.dataset.v === val); }); }
function buildAllocs(){
  $('#fAlloc').innerHTML = ALLOCS.map(function(a){
    return '<button class="pill'+(a===state.alloc?' on':'')+'" data-v="'+esc(a)+'" type="button">'+esc(a)+'</button>';
  }).join('');
  $('#fAlloc').addEventListener('click', function(e){
    var b = e.target.closest('.pill'); if(!b) return;
    state.alloc = b.dataset.v; paintPills($('#fAlloc'), state.alloc);
  });
}
function buildCats(){
  $('#xCat').innerHTML = CATS.map(function(c){
    return '<button class="pill'+(c.v===state.cat?' on':'')+'" data-v="'+esc(c.v)+'" type="button">'+esc(c.v)+'</button>';
  }).join('');
  $('#xCat').addEventListener('click', function(e){
    var b = e.target.closest('.pill'); if(!b) return;
    state.cat = b.dataset.v; paintPills($('#xCat'), state.cat); catNote();
  });
}
function catNote(){
  var c = CATS.filter(function(x){ return x.v === state.cat; })[0] || {};
  $('#xNoteField').style.display = c.ask ? 'block' : 'none';
  if (c.ask) { $('#xNoteLabel').textContent = c.ask; $('#xNote').placeholder = c.ask; }
}
var COMP_KINDS = ['Invitee','Chief Guest','Press','Artist / Performer'];
var compState = {kind: COMP_KINDS[0], n: 1};
function buildComp(){
  $('#cKind').innerHTML = COMP_KINDS.map(function(k){
    return '<button class="pill'+(k===compState.kind?' on':'')+'" data-v="'+esc(k)+'" type="button">'+esc(k)+'</button>';
  }).join('');
}
function resetComp(){
  $('#cName').value = ''; $('#cBy').value = '';
  compState.kind = COMP_KINDS[0]; compState.n = 1;
  $('#cNum').textContent = '1'; buildComp();
}
function saveComp(){
  var name = $('#cName').value.trim();
  if (!name) { alert('Enter the name for the pass.'); $('#cName').focus(); return; }
  var btn = $('#cSave'); btn.disabled = true; btn.textContent = 'Issuing…';
  push({action:'addComp', name:name, kind:compState.kind, guests:compState.n,
        invitedBy:$('#cBy').value.trim(), issuedBy:cfg.volunteer})
    .then(function(d){
      var row = d.row;
      rows.unshift(row); cacheAll(); paintAll();
      openSlip(row); resetComp();
      setSync('ok','Invitee pass issued — ' + tail(row.code));
    })
    .catch(function(e){
      setSync('bad','Could not issue it — ' + e.message);
      alert('Not issued.\n\n' + e.message);
    })
    .then(function(){ btn.disabled = false; btn.textContent = 'Issue the pass'; });
}

function startFlow(kind){
  if (kind === 'comp') { if (!isControl()) return; resetComp(); show('comp'); return; }
  if (kind === 'expense') { resetExpense(); show('expense'); return; }
  state.mode = kind;
  resetForm();
  $('#formHead').textContent = kind === 'online' ? 'Paid online' : 'Cash received';
  $('#shotBlock').style.display = kind === 'online' ? 'block' : 'none';
  $('#cashPhotoBlock').style.display = kind === 'cash' ? 'block' : 'none';
  $('#fRefLabel').textContent = kind === 'online' ? 'UPI / bank reference' : 'Cash received in hand by';
  $('#fRef').placeholder = kind === 'online' ? 'UTR or transaction id' : 'Name of the person who took the cash';
  $('#fRef').style.fontFamily = kind === 'online' ? 'ui-monospace,Menlo,monospace' : 'inherit';
  show('form');
}
function resetForm(){
  ['#fDonor','#fAmount','#fPhone','#fRef'].forEach(function(s){ $(s).value = ''; });
  state.attend = 'yes'; state.alloc = ALLOCS[0];
  paintPills($('#fAttend'),'yes'); paintPills($('#fAlloc'), state.alloc);
  shots.proof = ''; shots.photo = '';
  $('#shotPrev').style.display = 'none'; $('#camPrev').style.display = 'none';
  $('#ocrMsg').style.display = 'none'; $('#drop').classList.remove('hot');
  tierHint();
}
function tierHint(){
  var v = num($('#fAmount').value);
  var tr = tier(v);
  $('#tierHint').innerHTML = v
    ? '<b>' + esc(tr.name) + ' tier</b> — ' + esc(tr.band) + ' · <b>' + tr.guests + ' guest' + (tr.guests===1?'':'s') + '</b> admitted. ' + esc(APPROVER) + ' can change the number when approving.'
    : 'Entry ₹1–2,000 · 1 guest. Supporter ₹2,001–2,499 · 2 guests. Donor ₹2,500+ · 8 guests. Patron ₹25,000+ · 16 guests.';
}

function takeShot(file){
  if (!file) return;
  $('#ocrMsg').style.display = 'block';
  $('#ocrMsg').className = 'note sand';
  $('#ocrMsg').textContent = 'Reading the screenshot…';
  shrink(file, 1400, function(data){
    if (!data) { $('#ocrMsg').textContent = 'Could not open that image.'; return; }
    shots.proof = data;
    $('#shotImg').src = data; $('#shotPrev').style.display = 'block';
    push({action:'ocr', image:data}).then(function(d){
      var p = d.parsed || {};
      if (p.amount && !num($('#fAmount').value)) $('#fAmount').value = p.amount;
      if (p.ref && !$('#fRef').value) $('#fRef').value = p.ref;
      if (p.donor && !$('#fDonor').value) $('#fDonor').value = p.donor;
      tierHint();
      var got = [];
      if (p.amount) got.push('amount ' + money(p.amount));
      if (p.ref) got.push('reference ' + p.ref);
      if (p.donor) got.push('name ' + p.donor);
      $('#ocrMsg').className = 'note ' + (p.confidence === 'high' ? 'sage' : 'sand');
      var tail = ' <button type="button" id="ocrRaw" style="background:none;border:0;padding:0;font:inherit;font-weight:700;color:var(--navy);text-decoration:underline">what it read</button>';
      $('#ocrMsg').innerHTML = (got.length
        ? 'Read ' + esc(got.join(', ')) + '. <b>Check every field before saving.</b>'
        : 'Could not make out the details' + (p.chars ? '' : ' — no text came back at all') + '. Type them in; the screenshot is still saved as proof.')
        + tail;
      $('#ocrMsg').innerHTML += '<div style="font-size:11.5px;margin-top:6px;color:var(--ink-2)">The donor\'s name is almost never in a payment screenshot \u2014 type it in.</div>';
      var rb = document.getElementById('ocrRaw');
      if (rb) rb.addEventListener('click', function(){
        alert((p.chars || 0) + ' characters read from the image:\n\n' + (p.raw || '(nothing)'));
      });
    }).catch(function(e){
      $('#ocrMsg').className = 'note clay';
      $('#ocrMsg').textContent = 'Could not read it (' + e.message + '). Type the details in — the screenshot is still saved as proof.';
    });
  });
}

function save(){
  var donor = $('#fDonor').value.trim(), amount = num($('#fAmount').value);
  if (!donor)  { alert('Enter the donor name.'); $('#fDonor').focus(); return; }
  if (!amount) { alert('Enter the amount.'); $('#fAmount').focus(); return; }
  var rec = {
    ts: new Date().toISOString(), donor: donor, amount: amount,
    phone: $('#fPhone').value.trim(), mode: state.mode, ref: $('#fRef').value.trim(),
    alloc: state.alloc, attend: state.attend, volunteer: cfg.volunteer, status: 'pending',
    guestsAllowed: state.attend === 'no' ? 0 : tier(amount).guests, guestsEntered: 0
  };
  var body = Object.assign({action:'add'}, rec, {proof: shots.proof, photo: shots.photo});
  rec.sending = true;
  rows.unshift(rec); renderHome(); openSlip(rec);
  var btn = $('#saveBtn'); btn.disabled = true; btn.textContent = 'Sending…';
  push(body).then(function(d){
    delete rec.sending;
    Object.assign(rec, d.row || {});
    cacheAll(); paintAll();
    if (current === rec) openSlip(rec);
    setSync('ok','Sent to ' + APPROVER + ' for approval');
  }).catch(function(e){
    rows = rows.filter(function(x){ return x !== rec; });
    paintAll();
    setSync('bad','Could not send — ' + e.message);
    alert('This entry did NOT reach the Sheet.\n\n' + e.message + '\n\nCheck your internet and enter it again.');
  }).then(function(){
    btn.disabled = false; btn.textContent = 'Save & send for approval';
    resetForm();
  });
}

/* ---------- expense form ---------- */
function resetExpense(){
  ['#xPayee','#xAmount','#xNote'].forEach(function(s){ $(s).value = ''; });
  $('#xDate').value = new Date().toISOString().slice(0,10);
  state.cat = CATS[0].v; state.xmode = 'cash';
  paintPills($('#xCat'), state.cat); paintPills($('#xMode'), 'cash'); catNote();
  shots.bill = ''; $('#billPrev').style.display = 'none';
}
function saveExpense(){
  var payee = $('#xPayee').value.trim(), amount = num($('#xAmount').value);
  if (!payee)  { alert('Who was it paid to?'); $('#xPayee').focus(); return; }
  if (!amount) { alert('Enter the amount.'); $('#xAmount').focus(); return; }
  var rec = {
    ts: new Date().toISOString(), date: $('#xDate').value, payee: payee, category: state.cat,
    catNote: $('#xNote').value.trim(), amount: amount, mode: state.xmode,
    enteredBy: cfg.volunteer, status: 'pending'
  };
  var body = Object.assign({action:'addExpense'}, rec, {bill: shots.bill});
  rec.sending = true;
  expenses.unshift(rec); renderHome(); openSlip(rec);
  var btn = $('#xSave'); btn.disabled = true; btn.textContent = 'Sending…';
  push(body).then(function(d){
    delete rec.sending;
    Object.assign(rec, d.row || {});
    cacheAll(); paintAll();
    if (current === rec) openSlip(rec);
    setSync('ok','Expense sent to ' + APPROVER);
  }).catch(function(e){
    expenses = expenses.filter(function(x){ return x !== rec; });
    paintAll();
    setSync('bad','Could not send — ' + e.message);
    alert('This expense did NOT reach the Sheet.\n\n' + e.message);
  }).then(function(){
    btn.disabled = false; btn.textContent = 'Save & send for approval';
    resetExpense();
  });
}

/* ---------- gate ---------- */
function renderEntries(){
  var host = $('#entryList');
  var last = entries.slice(-8).reverse();
  host.innerHTML = last.length ? last.map(function(e){
    return '<div class="row-item" style="cursor:default">'
      + '<div style="flex:1;min-width:0"><div class="nm">'+e.count+' guest'+(e.count===1?'':'s')+' in</div>'
      + '<div class="cd"><span class="mono">'+esc(tail(e.code))+'</span> · by '+esc(e.by||'—')+'</div></div>'
      + '<div class="rt"><div class="am" style="font-size:13px">'+timeOut(e.ts)+'</div></div></div>';
  }).join('') : '<div class="empty">No one has come in yet.</div>';
}
function lookup(codeTail){
  var t = String(codeTail||'').trim().toUpperCase();
  if (!t) { alert('Type the last six characters from the pass.'); return; }
  var hit = rows.filter(function(r){ return tail(r.code).toUpperCase() === t; })[0];
  if (!hit) {
    $('#scanResult').innerHTML = '<div class="note clay" style="margin-top:12px"><b>Not found.</b> No pass ends in ' + esc(t) + '. Refresh and try again, or check with ' + esc(APPROVER) + '.</div>';
    return;
  }
  showGate(hit);
}
function showGate(r){
  var tr = isComp(r) ? compTier(r) : tier(r.amount);
  var allowed = Number(r.guestsAllowed) || 0;
  var used = Number(r.guestsEntered) || 0;
  var left = Math.max(0, allowed - used);
  var host = $('#scanResult');
  if (r.status !== 'live') {
    host.innerHTML = '<div class="note clay" style="margin-top:12px"><b>Not valid.</b> This pass is ' + esc(r.status) + '.</div>';
    return;
  }
  host.innerHTML = '<div class="card" style="padding:16px;margin-top:12px">'
    + '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">'
    +   '<div style="min-width:0"><div style="font-size:17px;font-weight:700">'+esc(r.donor||'—')+'</div>'
    +     '<div class="mono" style="font-size:11.5px;color:var(--ink-3)">'+esc(tail(r.code))+'</div></div>'
    +   '<span class="chip-gold" style="flex:none">'+esc(tr.name)+'</span></div>'
    + '<div class="stats" style="margin-top:12px"><div class="stat"><div class="k">Allowed</div><div class="v">'+allowed+'</div></div>'
    +   '<div class="stat"><div class="k">Already in</div><div class="v">'+used+'</div></div>'
    +   '<div class="stat"><div class="k">Left</div><div class="v" style="color:'+(left?'var(--sage-ink)':'var(--clay)')+'">'+left+'</div></div></div>'
    + (left
        ? '<div style="margin-top:14px"><div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);margin-bottom:6px">How many are entering now?</div>'
          + '<div class="step"><button type="button" id="gMinus">\u2212</button><span id="gNow">'+Math.min(left,1)+'</span><button type="button" id="gPlus">+</button></div>'
          + '<button class="btn btn-primary" id="gGo" type="button" style="margin-top:12px">Admit</button></div>'
        : '<div class="note clay" style="margin-top:14px">All '+allowed+' guests on this pass have already entered.</div>')
    + '</div>';
  if (!left) return;
  var el = $('#gNow');
  $('#gMinus').addEventListener('click', function(){ el.textContent = Math.max(1, (parseInt(el.textContent,10)||1) - 1); });
  $('#gPlus').addEventListener('click', function(){ el.textContent = Math.min(left, (parseInt(el.textContent,10)||1) + 1); });
  $('#gGo').addEventListener('click', function(){
    var n = parseInt(el.textContent,10) || 1, btn = $('#gGo');
    btn.disabled = true; btn.textContent = 'Admitting…';
    push({action:'enter', code:r.code, count:n, by:cfg.volunteer}).then(function(d){
      r.guestsEntered = d.entered;
      entries.push({ts:new Date().toISOString(), code:r.code, count:n, runningTotal:d.entered, by:cfg.volunteer});
      cacheAll(); renderEntries(); renderLedger();
      $('#scanResult').innerHTML = '<div class="note sage" style="margin-top:12px"><b>' + n + ' guest' + (n===1?'':'s') + ' admitted.</b> '
        + esc(r.donor||'') + ' — ' + d.entered + ' of ' + d.allowed + ' now in.</div>';
      $('#scanCode').value = '';
    }).catch(function(e){
      btn.disabled = false; btn.textContent = 'Admit';
      alert('Not admitted.\n\n' + e.message);
    });
  });
}
function stopScan(){
  if (scanning) { try { scanning.getTracks().forEach(function(t){ t.stop(); }); } catch(e){} scanning = null; }
  $('#camWrap').style.display = 'none';
  $('#scanStop').style.display = 'none';
  $('#scanStart').style.display = 'block';
}
function startScan(){
  if (!('BarcodeDetector' in window)) {
    alert('This browser cannot scan in-app.\n\nUse the phone\'s own Camera app on the QR — it opens the same check page. Or type the last six characters below.');
    return;
  }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){
    scanning = s;
    var v = $('#cam'); v.srcObject = s; v.play();
    $('#camWrap').style.display = 'block';
    $('#scanStop').style.display = 'block';
    $('#scanStart').style.display = 'none';
    var det = new window.BarcodeDetector({formats:['qr_code']});
    var tick = function(){
      if (!scanning) return;
      det.detect(v).then(function(hits){
        if (hits && hits.length) {
          var m = String(hits[0].rawValue||'').match(/[?&]c=([^&]+)/);
          var code = m ? decodeURIComponent(m[1]) : hits[0].rawValue;
          stopScan();
          lookup(tail(code));
        } else setTimeout(tick, 320);
      }).catch(function(){ setTimeout(tick, 500); });
    };
    tick();
  }).catch(function(){ alert('Camera not available. Type the last six characters instead.'); });
}

/* ---------- print ---------- */
function receiptHTML(r){
  var voidMark = r.status === 'void' ? '<div style="font-size:9pt;font-weight:700;color:#8c491a">VOIDED — not a valid receipt</div>' : '';
  var cashNote = r.mode === 'cash' ? ' Cash received in hand by ' + esc(r.ref || r.volunteer || 'school staff') + '.' : '';
  var tr = tier(r.amount);
  return '<div class="sheet">'
  + '<div class="hd"><img src="assets/logo.png" alt="">'
  +   '<div style="flex:1;min-width:0">'
  +     '<div style="font-family:Caprasimo,Georgia,serif;font-size:15pt;color:#fff;line-height:1.1">Deaf and Envision School</div>'
  +     '<div style="font-size:8.5pt;color:#e8c46a">गूँगे बहारों का विद्यालय · Established 1954</div>'
  +     '<div style="font-size:7.5pt;color:rgba(255,255,255,.62);margin-top:2px">127/70 AW, 1 Block, Saket Nagar, Kanpur, Uttar Pradesh 208014</div>'
  +   '</div>'
  +   (r.code ? '<img src="'+qrSrc(r.code,160)+'" alt="" style="width:19mm;height:19mm;background:#fff;padding:1.5mm;border-radius:2mm;flex:none">' : '')
  + '</div><div class="rule"></div>'
  + '<div class="bd">'
  +   '<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">'
  +     '<div><div style="font-family:Caprasimo,Georgia,serif;font-size:14pt;color:#12294a;line-height:1.15">Donation Receipt</div>'
  +       '<div style="font-size:10pt;color:#12294a">दान रसीद</div>'
  +       '<div style="font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:#82796a;margin-top:3px">Ganpati Mahotsav 2026 Fundraiser · गणपति महोत्सव 2026</div>'+voidMark+'</div>'
  +     '<div style="text-align:right;flex:none"><div class="k">Voucher</div>'
  +       '<div style="font-family:ui-monospace,Menlo,monospace;font-size:9pt;font-weight:700;color:#12294a">'+esc(r.code||'—')+'</div>'
  +       '<div style="font-size:8pt;color:#645c50">'+dateOut(r.ts)+'</div></div>'
  +   '</div>'
  +   '<div class="grid">'
  +     '<div><div class="k">Received with thanks from · प्राप्तकर्ता से</div><div class="v">'+esc(r.donor||'—')+'</div></div>'
  +     '<div><div class="k">Amount · राशि</div><div style="font-family:Caprasimo,Georgia,serif;font-size:15pt;color:#12294a">'+money(r.amount)+'</div></div>'
  +     '<div><div class="k">Payment mode · भुगतान माध्यम</div><div class="v" style="color:#12294a">'+(r.mode==='cash'?'Paid in Cash':'Paid Online')+' · '+esc(r.ref||'—')+'</div></div>'
  +     '<div><div class="k">Amount in words · राशि शब्दों में</div><div style="font-size:9.5pt">'+words(r.amount)+'</div></div>'
  +     '<div><div class="k">Allocated to · उपयोग</div><div class="v">'+esc(r.alloc||'General Fund')+'</div></div>'
  +     '<div><div class="k">Pass · प्रवेश</div><div class="v">'+(r.attend==='no'?'No pass issued':esc(tr.name)+' · '+(r.guestsAllowed==null||r.guestsAllowed===''?tr.guests:Number(r.guestsAllowed))+' guests on '+Math.max(1,Number(r.passesIssued)||1)+' pass'+(Math.max(1,Number(r.passesIssued)||1)===1?'':'es'))+'</div></div>'
  +   '</div>'
  +   '<div><div style="font-size:9.5pt;line-height:1.55;text-wrap:pretty">Your contribution to the Ganpati Mahotsav 2026 fundraiser supports the school\'s development programme — a computer laboratory, skills training halls, renovation of the school building, and a projector and sound setup for classroom teaching. On behalf of our students and staff, thank you for standing with us.</div>'
  +     '<div style="font-size:9pt;line-height:1.6;margin-top:6px">गणपति महोत्सव 2026 में आपके सहयोग से विद्यालय में कंप्यूटर प्रयोगशाला, कौशल प्रशिक्षण कक्ष, भवन नवीनीकरण तथा प्रोजेक्टर एवं ध्वनि व्यवस्था का कार्य संभव हो रहा है। आपके सहयोग के लिए हार्दिक आभार।</div>'
  +     '<div style="margin-top:10px;display:flex;gap:10px;background:#12294a;border-radius:12px;padding:10px 13px">'
  +       '<span style="font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#e8c46a;flex:none;padding-top:1px">Important</span>'
  +       '<span style="font-size:8.5pt;line-height:1.45;color:rgba(255,255,255,.9)">We have applied for 80G and 12A registration. <b>80G Reg. No.: [Pending]</b> · 12A: applied.'+cashNote+'</span></div></div>'
  +   '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px">'
  +     '<div style="flex:none;width:46mm">'
  +       '<div style="height:16mm;overflow:hidden;display:flex;align-items:center"><img src="assets/signature.png" alt="" style="width:52mm;height:52mm;object-fit:contain;margin:-18mm 0 -18mm -2mm"></div>'
  +       '<div style="border-top:1px solid rgba(32,30,29,.35);padding-top:4px"><div style="font-size:10pt;font-weight:700">Srajan Mishra</div><div style="font-size:8pt;color:#645c50">Director of Operations</div></div></div>'
  +     '<img src="assets/stamp.png" alt="" style="width:26mm;height:26mm;object-fit:contain;opacity:.92;flex:none">'
  +   '</div>'
  + '</div>'
  + '<div class="foot"><span>Computer-generated receipt. Voucher '+esc(r.code||'—')+' is unique and verifiable at the school office. Issued by '+esc(r.volunteer||'—')+', approved by '+esc(r.approvedBy||APPROVER)+'.</span>'
  +   '<span style="letter-spacing:.09em;text-transform:uppercase;color:#12294a;font-weight:700;flex:none">Deaf and Envision School</span></div>'
  + '</div>';
}

function certHTML(r){
  var tr = tier(r.amount);
  return '<div class="sheet" style="border:0"><div class="cert"><div class="inner">'
  + '<img src="assets/logo.png" alt="" style="width:26mm;height:26mm;border-radius:999px">'
  + '<div><div style="font-family:Caprasimo,Georgia,serif;font-size:16pt;color:#12294a;line-height:1.15">Deaf and Envision School</div>'
  +   '<div style="font-size:10pt;color:#8c491a">गूँगे बहारों का विद्यालय · Established 1954</div></div>'
  + '<div style="width:36mm;height:2px;background:#c9922f"></div>'
  + '<div><div style="font-family:Caprasimo,Georgia,serif;font-size:26pt;color:#12294a;line-height:1.1">Certificate of Appreciation</div>'
  +   '<div style="font-size:12pt;color:#12294a;margin-top:2mm">आभार प्रमाण-पत्र</div></div>'
  + '<div style="font-size:10.5pt;color:#645c50;letter-spacing:.08em;text-transform:uppercase">Presented with gratitude to</div>'
  + '<div style="font-family:Caprasimo,Georgia,serif;font-size:30pt;color:#8c491a;line-height:1.1;border-bottom:1px solid rgba(32,30,29,.25);padding-bottom:4mm;min-width:120mm">'+esc(r.donor||'—')+'</div>'
  + '<div style="font-size:11.5pt;line-height:1.7;max-width:150mm;text-wrap:pretty">in recognition of a generous contribution of '
  +   '<b style="font-size:14pt;color:#12294a">'+money(r.amount)+'</b> ('+words(r.amount)+') towards the '
  +   '<b>Ganpati Mahotsav 2026</b> fundraiser, supporting our computer laboratory, skills training halls, building renovation, and classroom projector and sound setup.</div>'
  + '<div style="font-size:10.5pt;line-height:1.75;max-width:150mm">आपके इस उदार सहयोग से विद्यालय के मूक-बधिर विद्यार्थियों के जीवन में शिक्षा और आत्मनिर्भरता का मार्ग प्रशस्त होता है। विद्यालय परिवार आपका हार्दिक आभार व्यक्त करता है।</div>'
  + '<div style="flex:1"></div>'
  + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16mm;width:100%">'
  +   '<div style="text-align:center;flex:none">'
  +     (r.code ? '<img src="'+qrSrc(r.code,200)+'" alt="" style="width:22mm;height:22mm">' : '')
  +     '<div style="font-family:ui-monospace,Menlo,monospace;font-size:6.5pt;color:#645c50;margin-top:1.5mm">'+esc(r.code||'')+'</div></div>'
  +   '<div style="text-align:center;flex:none"><img src="assets/stamp.png" alt="" style="width:26mm;height:26mm;object-fit:contain;opacity:.92"></div>'
  +   '<div style="flex:none;width:52mm;text-align:center">'
  +     '<div style="height:16mm;overflow:hidden;display:flex;align-items:center;justify-content:center"><img src="assets/signature.png" alt="" style="width:52mm;height:52mm;object-fit:contain;margin:-18mm 0"></div>'
  +     '<div style="border-top:1px solid rgba(32,30,29,.35);padding-top:2mm"><div style="font-size:10pt;font-weight:700">Srajan Mishra</div>'
  +     '<div style="font-size:8pt;color:#645c50">Director of Operations</div></div></div>'
  + '</div>'
  + '<div style="font-size:7.5pt;color:#82796a;letter-spacing:.06em">'+esc(tr.name)+' tier · issued '+dateOut(r.approvedAt||r.ts)+' · verifiable at the school office</div>'
  + '</div></div></div>';
}

function expenseHTML(r){
  return '<div class="sheet">'
  + '<div class="hd"><img src="assets/logo.png" alt="">'
  +   '<div style="flex:1"><div style="font-family:Caprasimo,Georgia,serif;font-size:15pt;color:#fff">Deaf and Envision School</div>'
  +   '<div style="font-size:8.5pt;color:#e8c46a">Expense record · Ganpati Mahotsav 2026</div></div></div><div class="rule"></div>'
  + '<div class="bd"><div class="grid">'
  +   '<div><div class="k">Paid to</div><div class="v">'+esc(r.payee||'—')+'</div></div>'
  +   '<div><div class="k">Amount</div><div style="font-family:Caprasimo,Georgia,serif;font-size:15pt;color:#12294a">'+money(r.amount)+'</div></div>'
  +   '<div><div class="k">Category</div><div class="v">'+esc(r.category||'')+(r.catNote?' · '+esc(r.catNote):'')+'</div></div>'
  +   '<div><div class="k">Paid by</div><div class="v">'+esc(r.mode||'cash')+'</div></div>'
  +   '<div><div class="k">Date</div><div class="v">'+esc(r.date||dateOut(r.ts))+'</div></div>'
  +   '<div><div class="k">Number</div><div class="v mono" style="font-size:9pt">'+esc(r.code||'—')+'</div></div>'
  + '</div>'
  + (r.billUrl ? '<img src="'+esc(r.billUrl)+'" alt="bill" style="max-width:100%;max-height:120mm;object-fit:contain;border-radius:3mm">' : '<div style="font-size:9.5pt;color:#8c491a">No bill photograph attached.</div>')
  + '</div>'
  + '<div class="foot"><span>Recorded by '+esc(r.enteredBy||'—')+', approved by '+esc(r.approvedBy||APPROVER)+'.</span>'
  +   '<span style="font-weight:700;color:#12294a">Deaf and Envision School</span></div></div>';
}

function printThese(html, label){
  if (!html) { alert('Nothing approved to print yet.'); return; }
  $('#print-root').innerHTML = html;
  document.title = label || 'Donation slip';
  setTimeout(function(){ window.print(); }, 200);
}
function printable(list){ return list.filter(function(r){ return r.status === 'live' || r.status === 'void'; }); }

/* ---------- wiring ---------- */
$$('nav.tabs button').forEach(function(b){ b.addEventListener('click', function(){ show(b.dataset.tab); }); });
$$('[data-go]').forEach(function(b){ b.addEventListener('click', function(){ show(b.dataset.go); }); });
$$('[data-start]').forEach(function(b){ b.addEventListener('click', function(){ startFlow(b.dataset.start); }); });

$('#refreshBtn').addEventListener('click', pull);
$('#cKind').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  compState.kind = b.dataset.v; paintPills($('#cKind'), compState.kind);
});
$('#cMinus').addEventListener('click', function(){ compState.n = Math.max(1, compState.n - 1); $('#cNum').textContent = compState.n; });
$('#cPlus').addEventListener('click', function(){ compState.n = compState.n + 1; $('#cNum').textContent = compState.n; });
$('#cSave').addEventListener('click', saveComp);
$('#pendingBanner').addEventListener('click', function(){ show(isControl() ? 'approve' : 'ledger'); });
$('#saveBtn').addEventListener('click', save);
$('#xSave').addEventListener('click', saveExpense);
$('#againBtn').addEventListener('click', function(){ startFlow(state.mode); });
$('#printBtn').addEventListener('click', function(){
  if (!current) return;
  printThese(currentKind === 'expense' ? expenseHTML(current) : receiptHTML(current), tail(current.code) || 'record');
});
$('#certBtn').addEventListener('click', function(){ if (current) printThese(certHTML(current), 'Certificate ' + tail(current.code)); });
$('#batchBtn').addEventListener('click', function(){
  printThese(printable(filtered()).map(receiptHTML).join(''), 'Receipts');
});
$('#certAllBtn').addEventListener('click', function(){
  printThese(printable(filtered()).map(certHTML).join(''), 'Certificates');
});
$('#shareBtn').addEventListener('click', function(){
  if (!current) return;
  var txt = 'Deaf and Envision School — donation receipt ' + (current.code||'') + '\n'
    + (current.donor||'') + ' · ' + money(current.amount) + ' · ' + (current.mode==='cash'?'Paid in Cash':'Paid Online') + '\n'
    + 'Allocated to ' + (current.alloc||'General Fund') + '. Thank you for supporting Ganpati Mahotsav 2026.\n'
    + verifyUrl(current.code);
  if (navigator.share) navigator.share({title:'Donation receipt', text:txt}).catch(function(){});
  else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function(){ alert('Copied — paste into WhatsApp.'); });
});
$('#voidBtn').addEventListener('click', function(){ if (current) decide(current.id, 'void', null); });
$('#okBtn').addEventListener('click', function(){ if (current) decide(current.id, 'approve', $('#okBtn')); });
$('#noBtn').addEventListener('click', function(){ if (current) decide(current.id, 'reject', $('#noBtn')); });

$('#fAttend').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  state.attend = b.dataset.v; paintPills($('#fAttend'), state.attend);
});
$('#xMode').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  state.xmode = b.dataset.v; paintPills($('#xMode'), state.xmode);
});
$('#fAmount').addEventListener('input', tierHint);
$('#lFilter').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  state.filter = b.dataset.v; paintPills($('#lFilter'), state.filter); renderLedger();
});
$('#lKind').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  state.kind = b.dataset.v; paintPills($('#lKind'), state.kind); renderLedger();
});
$('#q').addEventListener('input', renderLedger);

/* file pickers */
$('#drop').addEventListener('click', function(){ $('#file').click(); });
$('#file').addEventListener('change', function(){ takeShot(this.files[0]); this.value = ''; });
$('#shotClear').addEventListener('click', function(){ shots.proof=''; $('#shotPrev').style.display='none'; $('#ocrMsg').style.display='none'; });
$('#camBtn').addEventListener('click', function(){ $('#camFile').click(); });
$('#camFile').addEventListener('change', function(){
  var f = this.files[0]; this.value = '';
  if (f) shrink(f, 1100, function(d){ shots.photo = d; $('#camImg').src = d; $('#camPrev').style.display = 'block'; });
});
$('#camClear').addEventListener('click', function(){ shots.photo=''; $('#camPrev').style.display='none'; });
$('#billBtn').addEventListener('click', function(){ $('#billFile').click(); });
$('#billFile').addEventListener('change', function(){
  var f = this.files[0]; this.value = '';
  if (f) shrink(f, 1400, function(d){ shots.bill = d; $('#billImg').src = d; $('#billPrev').style.display = 'block'; });
});
$('#billClear').addEventListener('click', function(){ shots.bill=''; $('#billPrev').style.display='none'; });

['dragenter','dragover'].forEach(function(ev){
  $('#drop').addEventListener(ev, function(e){ e.preventDefault(); this.classList.add('hot'); });
});
['dragleave','drop'].forEach(function(ev){
  $('#drop').addEventListener(ev, function(e){ e.preventDefault(); this.classList.remove('hot'); });
});
$('#drop').addEventListener('drop', function(e){
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) takeShot(f);
});
document.addEventListener('paste', function(e){
  if (state.view !== 'form' || state.mode !== 'online') return;
  var items = (e.clipboardData && e.clipboardData.items) || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') === 0) { takeShot(items[i].getAsFile()); break; }
  }
});

/* gate */
$('#scanStart').addEventListener('click', startScan);
$('#scanStop').addEventListener('click', stopScan);
$('#scanGo').addEventListener('click', function(){ lookup($('#scanCode').value); });
$('#scanCode').addEventListener('keydown', function(e){ if (e.key === 'Enter') lookup(this.value); });

/* setup */
$('#setRole').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  state.role = b.dataset.v; paintPills($('#setRole'), state.role);
  $('#pinField').style.display = state.role === 'control' ? 'block' : 'none';
});
function openSetup(){
  $('#setName').value = cfg.volunteer || '';
  state.role = cfg.role || 'gate';
  paintPills($('#setRole'), state.role);
  $('#pinField').style.display = state.role === 'control' ? 'block' : 'none';
  $('#setPin').value = '';
  show('setup');
}
$('#whoBtn').addEventListener('click', openSetup);
$('#reconfig').addEventListener('click', openSetup);
$('#setSave').addEventListener('click', function(){
  var n = $('#setName').value.trim();
  if (!n) { alert('Enter your name.'); return; }
  if (state.role === 'control' && $('#setPin').value.trim() !== CONTROL_PIN) {
    alert('Wrong control PIN. Ask ' + APPROVER + '.'); return;
  }
  cfg.volunteer = n; cfg.role = state.role; saveCfg();
  applyRole(); show('home'); pull();
});
function applyRole(){
  $('#pickComp').style.display = isControl() ? 'flex' : 'none';
  $('#tabApprove').style.display = isControl() ? 'flex' : 'none';
  $('#roleChip').textContent = isControl() ? 'Main control' : 'Entry gate';
  $('#whoName').textContent = (cfg.volunteer||'').split(/[\s—-]/)[0];
}

/* ---------- boot ---------- */
restore();
buildAllocs();
buildCats();
resetExpense();
if (loadCfg()) { applyRole(); show('home'); paintAll(); pull(); }
else openSetup();
setInterval(function(){ if (!document.hidden && state.view !== 'setup') pull(); }, 20000);
document.addEventListener('visibilitychange', function(){ if (!document.hidden && state.view !== 'setup') pull(); });
