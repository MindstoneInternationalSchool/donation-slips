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

var GATE_PIN = '2026';
var GATEKEY = 'des_gate_ok';
var cfg = {volunteer:'', role:'gate'};
var rows = [], expenses = [], entries = [], groups = [], roster = [], current = null, currentKind = 'slip';
var grState = {mode:'online', students:[], group:null};
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
    note:'Patron tier — VIP Pass.'};
  if (n >= 2500)  return {name:'Donor',     guests:8,  band:'Donor · ₹2,500 & above', art:'vip',
    note:'Donor tier — VIP Pass.'};
  if (n >  2000)  return {name:'Supporter', guests:2,  band:'Supporter · ₹2,001 – 2,499', art:'entry',
    note:'Supporter tier — general admission.'};
  return            {name:'Entry',     guests:1,  band:'Entry · ₹1 – 2,000', art:'entry',
    note:'Entry tier — general admission.'};
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
function cacheAll(){ try { localStorage.setItem(CACHE, JSON.stringify({rows:rows.slice(0,400), expenses:expenses.slice(0,300), entries:entries.slice(-200), groups:groups, roster:roster})); } catch(e){} }
function restore(){ try { var d = JSON.parse(localStorage.getItem(CACHE))||{};
  rows = d.rows||[]; expenses = d.expenses||[]; entries = d.entries||[];
  groups = d.groups||[]; roster = d.roster||[]; } catch(e){} }

/* ---------- navigation ---------- */
function show(v){
  if (v === 'approve' && !isControl()) v = 'home';
  if (v !== 'scan') stopScan();
  if (v === 'scan') {
    grState.group = null;
    var gsw = $('#groupSearch'); if (gsw) gsw.style.display = 'none';
    var gsq = $('#gsQ'); if (gsq) gsq.value = '';
    var sr = $('#scanResult'); if (sr) sr.innerHTML = '';
    var sc = $('#scanCode'); if (sc) sc.value = '';
  }
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
      groups = (d.groups||[]).slice().sort(function(a,b){ return String(b.ts||'').localeCompare(String(a.ts||'')); });
      roster = d.roster || [];
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
function pendingGroups(){ return groups.filter(function(g){ return g.status === 'pending'; }); }

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
  var p = pending().concat(pendingGroups()), b = $('#pendingBanner');
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
function groupApproveCards(){
  return pendingGroups().map(function(g){
    var list = groupRoster(g);
    return '<div class="card" style="padding:15px 16px">'
      + '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">'
      +   '<div style="min-width:0"><div style="font-size:16px;font-weight:700">' + esc(g.college||'\u2014') + '</div>'
      +     '<div style="font-size:12px;color:var(--ink-2)">' + list.length + ' students \u00b7 ' + esc(g.contact||'no contact') + '</div>'
      +     '<div style="font-size:11.5px;color:var(--ink-3);margin-top:2px">Entered by ' + esc(g.volunteer||'\u2014') + '</div></div>'
      +   '<div style="text-align:right;flex:none"><div style="font-family:\'Caprasimo\',Georgia,serif;font-size:23px;color:var(--navy);line-height:1.15">' + money(g.amount) + '</div>'
      +     '<span class="tag ' + (g.mode==='cash'?'cash':'online') + '">' + (g.mode==='cash'?'Cash':'Online') + '</span></div></div>'
      + '<button class="btn btn-out" data-gopen="' + esc(g.id) + '" type="button" style="margin-top:12px;font-size:15px">Open the group</button></div>';
  }).join('');
}
function renderApprove(){
  if (!isControl()) return;
  var p = pending();
  var pg = pendingGroups();
  $('#aCount').textContent = p.length + pg.length;
  $('#aTotal').textContent = money(p.reduce(function(s,r){ return s + num(r.amount); },0)
                                 + pg.reduce(function(s,g){ return s + num(g.amount); },0));
  var host = $('#approveList');
  if (!p.length && !pg.length) { host.innerHTML = '<div class="card"><div class="empty">Nothing waiting. Every record has been dealt with.</div></div>'; return; }
  host.innerHTML = groupApproveCards() + p.map(function(r){
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
  $('#printBtn').style.display = comp ? 'none' : 'block';
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
var COMP_KINDS = ['Invitee','Chief Guest','Press','Media','Helped In Accommodation',
                  'Helped In Sponsor','Artist / Performer','Other'];
var compState = {kind: COMP_KINDS[0], n: 1};
function buildComp(){
  $('#cKind').innerHTML = COMP_KINDS.map(function(k){
    return '<button class="pill'+(k===compState.kind?' on':'')+'" data-v="'+esc(k)+'" type="button">'+esc(k)+'</button>';
  }).join('');
}
function resetComp(){
  $('#cName').value = ''; $('#cBy').value = ''; $('#cPhone').value = ''; $('#cOther').value = '';
  $('#cOtherField').style.display = 'none';
  compState.kind = COMP_KINDS[0]; compState.n = 1;
  $('#cNum').textContent = '1'; buildComp();
}
function saveComp(){
  var name = $('#cName').value.trim();
  if (!name) { alert('Enter the name for the pass.'); $('#cName').focus(); return; }
  var btn = $('#cSave'); btn.disabled = true; btn.textContent = 'Issuing…';
  var kind = compState.kind;
  if (kind === 'Other') {
    var how = $('#cOther').value.trim();
    if (!how) { alert('Say in what way they helped.'); $('#cOther').focus(); return; }
    kind = 'Other \u00b7 ' + how;
  }
  push({action:'addComp', name:name, kind:kind, guests:compState.n,
        phone:$('#cPhone').value.trim(),
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
  if (kind === 'group') { if (!isControl()) return; resetGroup(); show('group'); return; }
  if (kind === 'bank') { if (!isControl()) return; resetBank(); show('bank'); return; }
  if (kind === 'vip') { if (!isControl()) return; resetVip(); show('vip'); return; }
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
  if (!t) { alert('Type the code printed on the pass.'); return; }
  var grp = groups.filter(function(g){
    if (g.status !== 'live') return false;
    var full = tail(g.code).toUpperCase();              /* GRP-K4M2XQ */
    return full === t || full.replace(/^GRP-/, '') === t;
  })[0];
  if (grp) { showGroupGate(grp); return; }
  $('#groupSearch').style.display = 'none';
  var hit = rows.filter(function(r){ return tail(r.code).toUpperCase() === t; })[0];
  if (!hit) {
    $('#scanResult').innerHTML = '<div class="note clay" style="margin-top:12px"><b>Not found.</b> No pass matches ' + esc(t) + '. Refresh and try again, or check with ' + esc(APPROVER) + '.</div>';
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
function gotCode(raw){
  var m = String(raw||'').match(/[?&]c=([^&]+)/);
  var code = m ? decodeURIComponent(m[1]) : raw;
  stopScan();
  lookup(tail(code));
}
function startScan(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('This browser has no camera access.\n\nUse the phone\'s own Camera app on the QR, or type the code printed on the pass below.');
    return;
  }
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}}).then(function(s){
    scanning = s;
    var v = $('#cam');
    v.srcObject = s; v.setAttribute('playsinline',''); v.muted = true;
    var p = v.play(); if (p && p.catch) p.catch(function(){});
    $('#camWrap').style.display = 'block';
    $('#scanStop').style.display = 'block';
    $('#scanStart').style.display = 'none';

    if ('BarcodeDetector' in window) {
      var det = new window.BarcodeDetector({formats:['qr_code']});
      var tick = function(){
        if (!scanning) return;
        det.detect(v).then(function(hits){
          if (hits && hits.length) gotCode(hits[0].rawValue);
          else setTimeout(tick, 300);
        }).catch(function(){ setTimeout(tick, 500); });
      };
      tick();
      return;
    }

    /* Safari and anything else: decode frames with jsQR */
    var cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently:true});
    var loop = function(){
      if (!scanning) return;
      if (!window.jsQR || v.readyState !== 4) { setTimeout(loop, 220); return; }
      var w = Math.min(640, v.videoWidth || 0), h = Math.round((v.videoHeight || 0) * (w / (v.videoWidth || 1)));
      if (!w || !h) { setTimeout(loop, 220); return; }
      cv.width = w; cv.height = h;
      cx.drawImage(v, 0, 0, w, h);
      var hit = null;
      try {
        hit = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts:'dontInvert'});
      } catch(e){}
      if (hit && hit.data) gotCode(hit.data);
      else setTimeout(loop, 160);
    };
    if (!window.jsQR) {
      $('#scanHint').textContent = 'Loading the scanner…';
      $('#scanHint').style.display = 'block';
    }
    loop();
  }).catch(function(e){
    alert(e && e.name === 'NotAllowedError'
      ? 'Camera permission was refused.\n\nAllow camera access for this site in Settings, or type the code printed on the pass below.'
      : 'Camera not available. Type the code printed on the pass instead.');
  });
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
  var other = compState.kind === 'Other';
  $('#cOtherField').style.display = other ? 'block' : 'none';
  if (other) $('#cOther').focus();
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
/* Reads "1,234.50" / "\u20b950.00" / "50" as a number of rupees.
   num() strips the decimal point, which turns 50.00 into 5000 \u2014 never use
   it on a figure that came out of a file. */
function money2(v){
  var s = String(v == null ? '' : v).replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/* ---------- high profile guest invitation ---------- */
var vipState = {hon:'Shri', lead:'In the gracious presence of', img:null, blob:null, busy:false};

/* the blank ornate panel on the flyer, as fractions of the artwork */
var VIP_PANEL = {x:0.068, y:0.664, w:0.864, h:0.117};

function fitFont(c, text, weight, family, start, max, min){
  var size = start;
  do {
    c.font = weight + ' ' + size + 'px ' + family;
    if (c.measureText(text).width <= max) break;
    size -= 2;
  } while (size > min);
  return size;
}
async function inviteCanvas(){
  if (!vipState.img) vipState.img = await loadImg('assets/flyer.png');
  var img = vipState.img, W = img.width, H = img.height;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var c = cv.getContext('2d');
  c.drawImage(img, 0, 0);

  var px = VIP_PANEL.x * W, py = VIP_PANEL.y * H,
      pw = VIP_PANEL.w * W, ph = VIP_PANEL.h * H;

  /* mask whatever ghost text sits in the panel, keeping the ornate border */
  var inset = pw * 0.035;
  var g = c.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, '#3a1110'); g.addColorStop(0.5, '#4a1614'); g.addColorStop(1, '#3a1110');
  c.fillStyle = g;
  roundRect(c, px + inset, py + ph * 0.10, pw - inset * 2, ph * 0.80, ph * 0.12);
  c.fill();

  var name = [vipState.hon, ($('#vName').value || '').trim()].filter(Boolean).join(' ');
  var role = ($('#vRole').value || '').trim();
  var lead = vipState.lead;
  var cx = px + pw / 2, maxW = pw * 0.84;

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  var yName = py + ph * (lead ? 0.56 : 0.50);
  if (lead) {
    c.fillStyle = '#d7a45c';
    c.font = '600 ' + Math.round(H * 0.0135) + 'px Figtree, sans-serif';
    c.fillText(lead.toUpperCase(), cx, py + ph * 0.28);
  }
  if (name) {
    var ns = fitFont(c, name, '400', "'Caprasimo', Georgia, serif", Math.round(H * 0.033), maxW, 18);
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 8;
    c.fillStyle = '#f2b74c';
    c.font = '400 ' + ns + "px 'Caprasimo', Georgia, serif";
    c.fillText(name, cx, yName);
    c.shadowBlur = 0;
  }
  if (role) {
    var rs = fitFont(c, role, '600', 'Figtree, sans-serif', Math.round(H * 0.0165), maxW, 11);
    c.fillStyle = '#e8d7b4';
    c.font = '600 ' + rs + 'px Figtree, sans-serif';
    c.fillText(role, cx, py + ph * (lead ? 0.80 : 0.74));
  }
  c.textAlign = 'left';
  return cv;
}
var vipTimer = null;
function refreshInvite(){
  clearTimeout(vipTimer);
  vipTimer = setTimeout(function(){
    if (vipState.busy) return;
    vipState.busy = true;
    inviteCanvas().then(function(cv){
      $('#vPreview').innerHTML = '<img src="' + cv.toDataURL('image/jpeg', 0.86)
        + '" alt="Invitation preview" style="width:100%;display:block">';
      return toBlob(cv);                       /* full-quality PNG for print and sharing */
    }).then(function(b){
      vipState.blob = b;
    }).catch(function(e){
      $('#vPreview').innerHTML = '<div class="note clay">Could not draw the invitation. ' + esc(e.message||'') + '</div>';
    }).then(function(){ vipState.busy = false; });
  }, 220);
}
function resetVip(){
  $('#vName').value = ''; $('#vRole').value = ''; $('#vPhone').value = '';
  vipState.hon = 'Shri'; vipState.lead = 'In the gracious presence of';
  paintPills($('#vHon'), 'Shri'); paintPills($('#vLead'), vipState.lead);
  refreshInvite();
}
function inviteName(){
  return ([vipState.hon, ($('#vName').value||'').trim()].filter(Boolean).join(' ') || 'guest');
}
function printInvite(){
  if (!vipState.blob) { alert('The invitation is still drawing \u2014 try again in a moment.'); return; }
  var url = URL.createObjectURL(vipState.blob);
  printThese('<div class="sheet" style="border:0;background:none">'
    + '<img src="' + url + '" style="width:100%;display:block">'
    + '</div>', 'Invitation ' + inviteName());
  setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
}
async function sendInvite(){
  var btn = $('#vSend');
  if (!vipState.blob) { alert('The invitation is still drawing \u2014 try again in a moment.'); return; }
  var label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing\u2026';
  try {
    var f = new File([vipState.blob], 'invitation.png', {type:'image/png'});
    var role = ($('#vRole').value||'').trim();
    var txt = 'Deaf and Envision School, Kanpur\n\nRespected ' + inviteName()
      + (role ? ', ' + role : '') + ',\n\nWe would be honoured by your presence at Ganpati Mahotsav 2026 '
      + 'on 24 September 2026, 6:00 PM onwards, at Deaf and Envision School, Saket Nagar, Kanpur.';
    if (navigator.canShare && navigator.canShare({files:[f]})) {
      await navigator.share({files:[f], text:txt});
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(f); a.download = 'invitation-' + inviteName().replace(/\s+/g,'-') + '.png'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
    window.open('https://wa.me/' + waNumber($('#vPhone').value) + '?text=' + encodeURIComponent(txt), '_blank');
  } catch(e) {
    if (!e || e.name !== 'AbortError') alert('Could not prepare it. ' + (e && e.message ? e.message : ''));
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

/* ---------- bank statement import ---------- */
var bkState = {items:[]};

/* "UPI/SUNDRAM LOHIYA/HDFC/215397886148/Sent using P" -> "SUNDRAM LOHIYA" */
function payerFromDesc(d){
  var s = String(d||'').trim();
  if (!s) return '';
  var parts = s.split('/').map(function(x){ return x.trim(); }).filter(Boolean);
  if (parts.length > 1) {
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (/^[A-Za-z][A-Za-z .]{2,}$/.test(p) && !/^(upi|neft|imps|rtgs|na)$/i.test(p)) return p.replace(/\s+/g,' ');
    }
  }
  var m = s.match(/(?:from|by)\s+([A-Za-z][A-Za-z .]{2,40})/i);
  return m ? m[1].replace(/\s+/g,' ').trim() : '';
}
function titleCase(s){
  return String(s||'').toLowerCase().split(' ').filter(Boolean).map(function(w){
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function parseBank(text){
  var grid = csvRows(text);
  if (!grid.length) return [];
  /* the header is the first row that names an amount column */
  var hi = -1;
  for (var i = 0; i < Math.min(grid.length, 15); i++) {
    var joined = grid[i].join(' ').toLowerCase();
    if (/amount|credit|deposit/.test(joined) && /date|description|narration|particular/.test(joined)) { hi = i; break; }
  }
  if (hi === -1) return [];
  var head = grid[hi];
  var iDesc = pickCol(head, ['description','narration','particular','remark','details']);
  var iAmt  = pickCol(head, ['amount','credit','deposit']);
  var iRef  = pickCol(head, ['chqref','refno','reference','chq','utr','transactionid']);
  var iDate = pickCol(head, ['transactiondate','valuedate','date']);
  var iDrCr = pickCol(head, ['drcr','type','crdr']);
  if (iAmt === -1) return [];

  var out = [];
  grid.slice(hi + 1).forEach(function(r){
    var amt = money2(r[iAmt]);
    if (!amt) return;
    if (iDrCr > -1) {
      var dc = String(r[iDrCr]||'').trim().toUpperCase();
      if (dc && dc.indexOf('CR') === -1) return;        /* debits are not donations */
    }
    var desc = iDesc > -1 ? String(r[iDesc]||'') : '';
    var nm = payerFromDesc(desc);
    var when = iDate > -1 ? String(r[iDate]||'').trim() : '';
    var iso = new Date().toISOString();
    var dm = when.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (dm) {
      var d = new Date(+dm[3], +dm[2]-1, +dm[1], +(dm[4]||12), +(dm[5]||0), +(dm[6]||0));
      if (!isNaN(d)) iso = d.toISOString();
    }
    out.push({
      donor: titleCase(nm), amount: amt, mode: 'online',
      ref: String(iRef > -1 ? (r[iRef]||'') : '').trim(),
      ts: iso, alloc: 'General Fund', attend: 'yes',
      short: nm.length >= 13 && !/\s[A-Za-z]{3,}$/.test(nm),   /* bank cut it off */
      desc: desc
    });
  });
  return out;
}
function renderBankPreview(){
  var list = bkState.items, host = $('#bkPreview');
  if (!list.length) { host.innerHTML = ''; $('#bkGo').style.display = 'none'; return; }
  var total = list.reduce(function(s,x){ return s + Number(x.amount||0); }, 0);
  var noName = list.filter(function(x){ return !x.donor; }).length;
  var cut = list.filter(function(x){ return x.short; }).length;
  host.innerHTML = '<div class="card" style="padding:14px 15px;margin:12px 0">'
    + '<div class="stats"><div class="stat"><div class="k">Credits</div><div class="v">' + list.length + '</div></div>'
    +   '<div class="stat wide"><div class="k">Total</div><div class="v">' + money(total) + '</div></div></div>'
    + (cut || noName
        ? '<div class="note clay" style="margin-top:10px;font-size:11.5px">'
          + (cut ? cut + ' name' + (cut===1?'':'s') + ' look cut off by the bank. ' : '')
          + (noName ? noName + ' row' + (noName===1?'':'s') + ' had no readable name. ' : '')
          + 'They import as they are \u2014 fix them in the Sheet afterwards.</div>'
        : '')
    + '<div style="margin-top:10px;max-height:260px;overflow:auto">'
    + list.map(function(x, i){
        return '<div style="display:flex;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid rgba(32,30,29,.07)">'
          + '<span style="font-size:11px;color:var(--ink-3);width:24px;flex:none">' + (i+1) + '</span>'
          + '<span style="flex:1;min-width:0;font-size:13.5px">' + esc(x.donor || '\u2014 no name \u2014')
          +   (x.short ? '<span style="color:var(--clay)">\u2026</span>' : '') + '</span>'
          + '<span style="font-size:13px;font-weight:700;color:var(--navy);flex:none">' + money(x.amount) + '</span>'
          + '</div>';
      }).join('')
    + '</div></div>';
  $('#bkGo').style.display = 'block';
  $('#bkGo').textContent = 'Import ' + list.length + ' as pending donations';
}
function readBankFile(f){
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    bkState.items = parseBank(rd.result);
    $('#bkDropMsg').textContent = bkState.items.length
      ? f.name + ' \u2014 ' + bkState.items.length + ' credits found'
      : 'No credits found in ' + f.name;
    if (!bkState.items.length) {
      $('#bkPreview').innerHTML = '<div class="note clay" style="margin-top:12px">Could not read that file. It needs a header row naming a date, a description and an amount \u2014 the CSV your bank exports usually has one.</div>';
      $('#bkGo').style.display = 'none';
      return;
    }
    renderBankPreview();
  };
  rd.readAsText(f);
}
function importBank(){
  if (!bkState.items.length) return;
  var btn = $('#bkGo');
  btn.disabled = true; btn.textContent = 'Importing\u2026';
  push({action:'addBulk', items:bkState.items, volunteer:cfg.volunteer})
    .then(function(d){
      (d.rows||[]).forEach(function(r){ rows.unshift(r); });
      cacheAll(); paintAll();
      bkState.items = []; $('#bkPreview').innerHTML = '';
      $('#bkDropMsg').textContent = 'Drop the bank CSV here, or tap to choose';
      btn.style.display = 'none';
      setSync('ok', d.added + ' imported' + (d.skipped ? ', ' + d.skipped + ' already in the ledger' : ''));
      alert(d.added + ' donations imported as pending.'
        + (d.skipped ? '\n\n' + d.skipped + ' were skipped \u2014 already in the ledger with the same reference.' : '')
        + '\n\nGo to Approve to release them.');
      show('approve');
    })
    .catch(function(e){
      alert('Import failed.\n\n' + e.message);
    })
    .then(function(){ btn.disabled = false; renderBankPreview(); });
}
function resetBank(){
  bkState.items = [];
  $('#bkPreview').innerHTML = '';
  $('#bkDropMsg').textContent = 'Drop the bank CSV here, or tap to choose';
  $('#bkGo').style.display = 'none';
}
function approveAll(){
  var p = pending().filter(function(r){ return !r.payee; });
  if (!p.length) { alert('Nothing to approve.'); return; }
  if (!confirm('Approve all ' + p.length + ' pending donations?\n\nEach gets its number and pass. Expenses and groups are not included.')) return;
  var btn = $('#approveAll');
  btn.disabled = true; btn.textContent = 'Approving ' + p.length + '\u2026';
  push({action:'approveAll', ids:p.map(function(r){ return r.id; }), approvedBy:cfg.volunteer})
    .then(function(d){
      (d.rows||[]).forEach(function(u){
        var r = rows.filter(function(x){ return x.id === u.id; })[0];
        if (r) { r.code = u.code; r.status = 'live'; r.approvedBy = u.approvedBy; r.approvedAt = u.approvedAt; }
      });
      cacheAll(); paintAll();
      setSync('ok', d.approved + ' approved');
    })
    .catch(function(e){ alert('Could not approve them all.\n\n' + e.message); })
    .then(function(){ btn.disabled = false; renderApprove(); });
}

/* ---------- college groups ---------- */
function csvRows(text){
  var out = [], row = [], cell = '', q = false;
  text = String(text||'').replace(/\r\n?/g, '\n');
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter(function(r){ return r.some(function(c){ return String(c).trim(); }); });
}
function pickCol(head, names){
  for (var i = 0; i < head.length; i++) {
    var h = String(head[i]||'').toLowerCase().replace(/[^a-z]/g,'');
    for (var j = 0; j < names.length; j++) if (h.indexOf(names[j]) > -1) return i;
  }
  return -1;
}
function parseRoster(text){
  var rowsIn = csvRows(text);
  if (!rowsIn.length) return [];
  var head = rowsIn[0].map(function(c){ return String(c).trim(); });
  var iName = pickCol(head, ['studentname','name','fullname']);
  var iRoll = pickCol(head, ['roll','enrol','enroll','regno','registration','id']);
  var iCourse = pickCol(head, ['course','class','branch','stream','year','dept']);
  var iPhone = pickCol(head, ['phone','mobile','contact']);
  var iAmt = pickCol(head, ['amount','amt','paid','fee','contribution']);
  var body = (iName > -1 || iRoll > -1) ? rowsIn.slice(1) : rowsIn;
  if (iName === -1 && iRoll === -1) { iName = 0; iRoll = head.length > 1 ? 1 : -1; }
  var seen = {}, out = [];
  body.forEach(function(r){
    var st = {
      name: String(iName > -1 ? (r[iName]||'') : '').trim(),
      roll: String(iRoll > -1 ? (r[iRoll]||'') : '').trim(),
      course: String(iCourse > -1 ? (r[iCourse]||'') : '').trim(),
      phone: String(iPhone > -1 ? (r[iPhone]||'') : '').trim(),
      amount: money2(iAmt > -1 ? (r[iAmt]||0) : 0)
    };
    if (!st.name && !st.roll) return;
    var key = (st.name + '|' + st.roll).toLowerCase();
    if (seen[key]) return;
    seen[key] = 1; out.push(st);
  });
  return out;
}
function renderRosterPreview(){
  var host = $('#grPreview'), list = grState.students;
  if (!list.length) { host.innerHTML = ''; return; }
  var paid = list.reduce(function(s,x){ return s + num(x.amount); }, 0);
  var noRoll = list.filter(function(x){ return !x.roll; }).length;
  host.innerHTML = '<div class="card" style="padding:14px 15px;margin-bottom:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">'
    +   '<div style="font-size:15px;font-weight:700">' + list.length + ' student' + (list.length===1?'':'s') + '</div>'
    +   (paid ? '<div style="font-size:12.5px;color:var(--ink-2)">' + money(paid) + ' listed</div>' : '') + '</div>'
    + (noRoll ? '<div style="font-size:11.5px;color:var(--clay-ink);margin-top:4px">' + noRoll + ' without a roll number \u2014 the gate can still find them by name.</div>' : '')
    + '<div style="margin-top:10px;max-height:210px;overflow:auto;display:flex;flex-direction:column;gap:1px">'
    + list.map(function(st, i){
        return '<div style="display:flex;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid rgba(32,30,29,.07)">'
          + '<span style="font-size:11px;color:var(--ink-3);width:26px;flex:none">' + (i+1) + '</span>'
          + '<span style="flex:1;min-width:0;font-size:13.5px">' + esc(st.name || '\u2014') + '</span>'
          + (st.roll ? '<span class="mono" style="font-size:11.5px;color:var(--ink-2);flex:none">' + esc(st.roll) + '</span>' : '')
          + '</div>';
      }).join('')
    + '</div></div>';
}
function readRosterFile(f){
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    grState.students = parseRoster(rd.result);
    $('#grDropMsg').textContent = grState.students.length
      ? f.name + ' \u2014 ' + grState.students.length + ' students read'
      : 'Could not find any names in ' + f.name;
    renderRosterPreview();
  };
  rd.readAsText(f);
}
function saveGroup(){
  var college = $('#grCollege').value.trim();
  var amount = num($('#grAmount').value);
  if (!college) { alert('Enter the college name.'); $('#grCollege').focus(); return; }
  if (!grState.students.length) { alert('Add the student list first \u2014 upload a CSV or paste the names.'); return; }
  var btn = $('#grSave'); btn.disabled = true; btn.textContent = 'Sending\u2026';
  push({action:'addGroup', college:college, contact:$('#grContact').value.trim(),
        phone:$('#grPhone').value.trim(), amount:amount, mode:grState.mode,
        ref:$('#grRef').value.trim(), students:grState.students, volunteer:cfg.volunteer})
    .then(function(d){
      var g = d.group;
      groups.unshift(g);
      roster = roster.concat(grState.students.map(function(st){
        return {id:'tmp-'+Math.random(), groupId:g.id, name:st.name, roll:st.roll,
                course:st.course, phone:st.phone, amount:st.amount, entered:'', enteredAt:'', by:''};
      }));
      cacheAll(); paintAll(); resetGroup();
      setSync('ok','Group sent to ' + APPROVER + ' for approval');
      openGroup(g);
    })
    .catch(function(e){
      setSync('bad','Could not send \u2014 ' + e.message);
      alert('The group did NOT reach the Sheet.\n\n' + e.message);
    })
    .then(function(){ btn.disabled = false; btn.textContent = 'Save & send for approval'; });
}
function resetGroup(){
  ['grCollege','grContact','grPhone','grAmount','grRef'].forEach(function(id){ $('#'+id).value = ''; });
  $('#grPasteBox').value = '';
  $('#grPasteWrap').style.display = 'none';
  grState.mode = 'online'; grState.students = [];
  paintPills($('#grMode'), 'online');
  $('#grDropMsg').textContent = 'Drop the CSV here, or tap to choose';
  $('#grPreview').innerHTML = '';
}
function groupRoster(g){
  return roster.filter(function(r){ return r.groupId === g.id; });
}
function openGroup(g){
  grState.group = g;
  var list = groupRoster(g);
  var inCount = list.filter(function(r){ return String(r.entered||''); }).length;
  var live = g.status === 'live';
  var head = live ? 'Group pass issued' : g.status === 'pending' ? 'Waiting for approval' : 'Rejected';
  var body = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
    + '<span class="ok-dot" style="background:' + (live ? 'var(--sage)' : g.status === 'pending' ? 'var(--gold)' : 'var(--clay)') + '">'
    +   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M4 12.5l5 5L20 6.5"/></svg></span>'
    + '<h1 style="font-size:22px;color:var(--navy)">' + head + '</h1></div>';

  if (!live) {
    body += '<div class="note ' + (g.status === 'pending' ? 'sand' : 'clay') + '">'
      + (g.status === 'pending'
          ? 'Recorded and sent to ' + esc(APPROVER) + '. No number, receipt or pass until he approves it.'
          : 'Rejected by ' + esc(g.approvedBy || APPROVER) + '. No pass was issued.')
      + '</div>';
  }

  body += '<div class="card" style="padding:16px;margin-top:12px">'
    + '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">'
    +   '<div style="min-width:0"><div style="font-size:17px;font-weight:700">' + esc(g.college||'\u2014') + '</div>'
    +     '<div style="font-size:12px;color:var(--ink-2)">' + esc(g.contact||'') + (g.phone ? ' \u00b7 ' + esc(g.phone) : '') + '</div>'
    +     (live ? '<div class="mono" style="font-size:13px;font-weight:700;color:var(--navy);margin-top:5px">' + esc(tail(g.code)) + '</div>' : '')
    +   '</div>'
    +   '<div style="text-align:right;flex:none"><div style="font-family:\'Caprasimo\',Georgia,serif;font-size:23px;color:var(--navy);line-height:1.15">' + money(g.amount) + '</div>'
    +     '<span class="tag ' + (g.mode==='cash'?'cash':'online') + '">' + (g.mode==='cash'?'Cash':'Online') + '</span></div></div>'
    + '<div class="stats" style="margin-top:14px">'
    +   '<div class="stat"><div class="k">Students</div><div class="v">' + list.length + '</div></div>'
    +   '<div class="stat"><div class="k">Entered</div><div class="v">' + inCount + '</div></div>'
    +   '<div class="stat"><div class="k">Yet to come</div><div class="v">' + Math.max(0, list.length - inCount) + '</div></div></div>'
    + '</div>';

  if (live) {
    body += '<div class="card" style="padding:15px 16px;margin-top:12px">'
      + '<div style="display:flex;gap:13px;align-items:center">'
      +   '<span class="qr"><img src="' + qrSrc(g.code, 208) + '" alt="QR"></span>'
      +   '<div style="font-size:11.5px;color:var(--ink-2);line-height:1.5">One pass for the whole group. Scanning it opens the student list \u2014 the gate finds each student by name or roll number and ticks them in against their ID card.</div>'
      + '</div></div>'
      + '<div class="btn-row" style="margin-top:12px">'
      +   '<button class="btn btn-navy" id="gPassBtn" type="button">Group pass</button>'
      +   '<button class="btn btn-out" id="gRecBtn" type="button">Receipt</button></div>'
      + '<button class="btn btn-out" id="gListBtn" type="button" style="margin-top:10px;font-size:15px">Print the student list</button>';
  }

  if (isControl() && g.status === 'pending') {
    body += '<div class="btn-row" style="margin-top:14px">'
      + '<button class="btn btn-primary" id="gOk" type="button">Approve</button>'
      + '<button class="btn btn-out" id="gNo" type="button" style="color:var(--clay);border-color:var(--clay)">Reject</button></div>';
  }

  $('#goneBody').innerHTML = body;
  show('groupone');

  if (live) {
    $('#gPassBtn').addEventListener('click', function(){ printThese(groupPassHTML(g), 'Group pass ' + tail(g.code)); });
    $('#gRecBtn').addEventListener('click', function(){ printThese(groupReceiptHTML(g), 'Receipt ' + tail(g.code)); });
    $('#gListBtn').addEventListener('click', function(){ printThese(rosterSheetHTML(g), 'Students ' + tail(g.code)); });
  }
  if (isControl() && g.status === 'pending') {
    $('#gOk').addEventListener('click', function(){ groupDecide(g, 'approve', $('#gOk')); });
    $('#gNo').addEventListener('click', function(){ groupDecide(g, 'reject', $('#gNo')); });
  }
}
function groupDecide(g, decision, btn){
  if (decision === 'reject' && !confirm('Reject ' + (g.college||'this group') + '? No pass will be issued.')) return;
  btn.disabled = true; btn.textContent = decision === 'approve' ? 'Approving\u2026' : 'Rejecting\u2026';
  push({action:'groupDecide', id:g.id, decision:decision, approvedBy:cfg.volunteer})
    .then(function(d){
      g.status = d.status; if (d.code) g.code = d.code;
      g.approvedBy = cfg.volunteer; g.approvedAt = d.approvedAt || new Date().toISOString();
      cacheAll(); paintAll(); openGroup(g);
      setSync('ok', decision === 'approve' ? 'Group approved \u2014 ' + tail(g.code) : 'Group rejected');
    })
    .catch(function(e){
      btn.disabled = false; btn.textContent = decision === 'approve' ? 'Approve' : 'Reject';
      alert('Not recorded.\n\n' + e.message);
    });
}

/* gate: search a roster */
function showGroupGate(g){
  grState.group = g;
  $('#scanResult').innerHTML = '';
  $('#gsHead').innerHTML = '<div class="card" style="padding:15px 16px;margin-top:12px">'
    + '<div style="font-size:16px;font-weight:700">' + esc(g.college||'\u2014') + '</div>'
    + '<div style="font-size:12px;color:var(--ink-2)">Group pass ' + esc(tail(g.code)) + ' \u00b7 ' + groupRoster(g).length + ' students</div></div>';
  $('#groupSearch').style.display = 'block';
  $('#gsQ').value = '';
  renderGroupSearch();
  $('#gsQ').focus();
}
function renderGroupSearch(){
  var g = grState.group;
  if (!g) return;
  var q = $('#gsQ').value.trim().toLowerCase();
  var list = groupRoster(g);
  var inCount = list.filter(function(r){ return String(r.entered||''); }).length;
  var shown = q
    ? list.filter(function(r){ return (String(r.name||'') + ' ' + String(r.roll||'')).toLowerCase().indexOf(q) > -1; })
    : list.filter(function(r){ return !String(r.entered||''); });
  $('#gsLabel').textContent = 'Find the student \u2014 ' + inCount + ' of ' + list.length + ' already in';
  var host = $('#gsList');
  if (!shown.length) {
    host.innerHTML = '<div class="note clay" style="margin-top:10px">' + (q ? 'No student matches \u201c' + esc(q) + '\u201d on this list. Do not admit.' : 'Everyone on this list has entered.') + '</div>';
    return;
  }
  host.innerHTML = '<div class="card" style="margin-top:10px">' + shown.slice(0, 40).map(function(r){
    var inYet = String(r.entered||'');
    return '<div class="row-item" style="cursor:default">'
      + '<div style="flex:1;min-width:0"><div class="nm">' + esc(r.name||'\u2014') + '</div>'
      +   '<div class="cd">' + (r.roll ? '<span class="mono">' + esc(r.roll) + '</span>' : 'no roll number') + (r.course ? ' \u00b7 ' + esc(r.course) : '') + '</div></div>'
      + (inYet
          ? '<span class="tag void" style="flex:none">Already in</span>'
          : '<button class="btn btn-primary" data-in="' + esc(r.id) + '" type="button" style="flex:none;width:auto;padding:10px 16px;font-size:14px;min-height:40px">Admit</button>')
      + '</div>';
  }).join('') + '</div>';
  host.querySelectorAll('[data-in]').forEach(function(b){
    b.addEventListener('click', function(){ admitStudent(b.dataset.in, b); });
  });
}
function admitStudent(id, btn){
  var g = grState.group;
  var st = roster.filter(function(r){ return r.id === id; })[0];
  if (!st || !g) return;
  if (!staffOk() && !askGatePin()) return;
  btn.disabled = true; btn.textContent = 'Admitting\u2026';
  push({action:'enterStudent', id:id, groupId:g.id, code:g.code, by:cfg.volunteer})
    .then(function(d){
      st.entered = 'yes'; st.enteredAt = d.enteredAt; st.by = cfg.volunteer;
      g.entered = d.groupEntered;
      entries.push({ts:d.enteredAt, code:g.code, count:1, runningTotal:d.groupEntered, by:cfg.volunteer});
      cacheAll(); renderGroupSearch(); renderEntries();
      setSync('ok', st.name + ' admitted');
    })
    .catch(function(e){
      btn.disabled = false; btn.textContent = 'Admit';
      alert('Not admitted.\n\n' + e.message);
    });
}
function askGatePin(){
  var v = prompt('Gate staff PIN \u2014 asked once on this phone.');
  if (v === null) return false;
  if (String(v).trim() !== GATE_PIN) { alert('Wrong PIN. Ask ' + APPROVER + '.'); return false; }
  try { localStorage.setItem(GATEKEY, GATE_PIN); } catch(e){}
  return true;
}
function staffOk(){
  if (isControl()) return true;
  try { return localStorage.getItem(GATEKEY) === GATE_PIN; } catch(e){ return false; }
}

/* group print sheets */
function groupPassHTML(g){
  var list = groupRoster(g);
  return '<div class="sheet"><div class="hd"><img src="assets/logo.png" alt="">'
    + '<div style="flex:1;min-width:0"><div style="font-family:Caprasimo,Georgia,serif;font-size:15pt;color:#fff;line-height:1.1">Deaf and Envision School</div>'
    +   '<div style="font-size:8.5pt;color:#e8c46a">Ganpati Mahotsav 2026 \u00b7 Group Pass</div></div>'
    + '<img src="' + qrSrc(g.code, 200) + '" alt="" style="width:22mm;height:22mm;background:#fff;padding:2mm;border-radius:2mm;flex:none"></div>'
    + '<div class="rule"></div><div class="bd">'
    + '<div style="text-align:center"><div style="font-family:Caprasimo,Georgia,serif;font-size:22pt;color:#12294a">' + esc(g.college||'') + '</div>'
    +   '<div style="font-family:ui-monospace,Menlo,monospace;font-size:13pt;font-weight:700;color:#8c491a;margin-top:2mm">' + esc(tail(g.code)) + '</div>'
    +   '<div style="font-size:11pt;margin-top:3mm">' + list.length + ' students \u00b7 exposure visit</div></div>'
    + '<div class="grid"><div><div class="k">Contact</div><div class="v">' + esc(g.contact||'\u2014') + '</div></div>'
    +   '<div><div class="k">Phone</div><div class="v">' + esc(g.phone||'\u2014') + '</div></div>'
    +   '<div style="grid-column:1/-1"><div class="k">At the gate</div><div style="font-size:9.5pt">Each student is found on the school\'s list by name or roll number, matched against their college ID card, and ticked in. One entry per student.</div></div></div>'
    + '</div><div class="foot"><span>Issued by ' + esc(g.volunteer||'\u2014') + ', approved by ' + esc(g.approvedBy||APPROVER) + '.</span>'
    + '<span style="letter-spacing:.09em;text-transform:uppercase;color:#12294a;font-weight:700;flex:none">Deaf and Envision School</span></div></div>';
}
function groupReceiptHTML(g){
  return receiptHTML({
    code:g.code, ts:g.ts, donor:g.college, amount:g.amount, phone:g.phone,
    mode:g.mode, ref:g.ref, alloc:'General Fund', attend:'no',
    volunteer:g.volunteer, approvedBy:g.approvedBy, status:g.status
  });
}
function rosterSheetHTML(g){
  var list = groupRoster(g);
  var rowsHtml = list.map(function(r, i){
    return '<tr><td style="padding:2mm 0;border-bottom:1px solid rgba(32,30,29,.12);font-size:9pt;width:10mm">' + (i+1) + '</td>'
      + '<td style="padding:2mm 0;border-bottom:1px solid rgba(32,30,29,.12);font-size:10pt">' + esc(r.name||'') + '</td>'
      + '<td style="padding:2mm 0;border-bottom:1px solid rgba(32,30,29,.12);font-size:9pt;font-family:ui-monospace,Menlo,monospace">' + esc(r.roll||'') + '</td>'
      + '<td style="padding:2mm 0;border-bottom:1px solid rgba(32,30,29,.12);width:22mm"></td></tr>';
  }).join('');
  return '<div class="sheet"><div class="hd"><img src="assets/logo.png" alt="">'
    + '<div style="flex:1"><div style="font-family:Caprasimo,Georgia,serif;font-size:14pt;color:#fff">' + esc(g.college||'') + '</div>'
    +   '<div style="font-size:8.5pt;color:#e8c46a">Ganpati Mahotsav 2026 \u00b7 ' + esc(tail(g.code)) + ' \u00b7 ' + list.length + ' students</div></div></div>'
    + '<div class="rule"></div><div class="bd">'
    + '<table style="width:100%;border-collapse:collapse"><thead><tr>'
    +   '<th style="text-align:left;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#82796a;padding-bottom:2mm">#</th>'
    +   '<th style="text-align:left;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#82796a">Name</th>'
    +   '<th style="text-align:left;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#82796a">Roll no.</th>'
    +   '<th style="text-align:left;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:#82796a">In</th></tr></thead>'
    + '<tbody>' + rowsHtml + '</tbody></table></div></div>';
}

/* ---------- shareable images ---------- */
function loadImg(src, cors){
  return new Promise(function(res, rej){
    var i = new Image();
    if (cors) i.crossOrigin = 'anonymous';
    i.onload = function(){ res(i); };
    i.onerror = function(){ rej(new Error('image')); };
    i.src = src;
  });
}
function roundRect(c, x, y, w, h, r){
  c.beginPath();
  c.moveTo(x+r, y); c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r);
  c.arcTo(x, y+h, x, y, r); c.arcTo(x, y, x+w, y, r); c.closePath();
}
function wrapText(c, text, x, y, max, lh){
  var words = String(text).split(' '), line = '', n = 0;
  for (var i = 0; i < words.length; i++) {
    var t = line + words[i] + ' ';
    if (c.measureText(t).width > max && line) { c.fillText(line.trim(), x, y + n*lh); line = words[i] + ' '; n++; }
    else line = t;
  }
  c.fillText(line.trim(), x, y + n*lh);
  return n + 1;
}
function toBlob(cv){
  return new Promise(function(res){ cv.toBlob(function(b){ res(b); }, 'image/png', 0.95); });
}

async function passPNG(r){
  var tr = isComp(r) ? compTier(r) : tier(r.amount);
  var allowed = r.guestsAllowed == null || r.guestsAllowed === '' ? tr.guests : Number(r.guestsAllowed);
  var art = await loadImg(tr.art === 'vip' ? 'assets/vip-pass.png' : 'assets/entry-pass.png');
  var qr = null;
  try { qr = await loadImg(qrSrc(r.code, 520), true); } catch(e){}
  var W = 1080, artH = Math.round(W * art.height / art.width), padH = 470;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = artH + padH;
  var c = cv.getContext('2d');
  c.fillStyle = '#12294a'; c.fillRect(0, 0, W, cv.height);
  c.drawImage(art, 0, 0, W, artH);

  c.textAlign = 'center';
  c.fillStyle = tr.art === 'vip' ? '#0b1b30' : '#5a1f13';
  c.font = "700 " + Math.round(W * 0.019) + "px ui-monospace, Menlo, monospace";
  if (tr.art === 'vip') {
    c.fillText(passNo(r), W * 0.856, artH * 0.862);
  } else {
    c.fillText(passNo(r), W * 0.63, artH * 0.74);
    c.font = "700 " + Math.round(W * 0.016) + "px ui-monospace, Menlo, monospace";
    c.fillText(passNo(r), W * 0.893, artH * 0.715);
  }
  c.textAlign = 'left';

  var y = artH + 44;
  c.fillStyle = '#f5ead8';
  roundRect(c, 40, y, W - 80, padH - 88, 34); c.fill();

  c.fillStyle = '#82796a'; c.font = '600 22px Figtree, sans-serif';
  c.fillText(String(tr.name).toUpperCase() + ' PASS', 80, y + 62);
  c.fillStyle = '#12294a'; c.font = "700 46px 'Caprasimo', Georgia, serif";
  c.fillText(passNo(r), 80, y + 118);
  c.fillStyle = '#201e1d'; c.font = '600 28px Figtree, sans-serif';
  c.fillText(String(r.donor || r.name || ''), 80, y + 170);
  c.fillStyle = '#645c50'; c.font = '400 24px Figtree, sans-serif';
  c.fillText('Admits ' + allowed + ' guest' + (allowed === 1 ? '' : 's') + ' · scan at the gate', 80, y + 212);
  c.fillStyle = '#8c491a'; c.font = '400 20px Figtree, sans-serif';
  c.fillText('Deaf and Envision School · Ganpati Mahotsav 2026', 80, y + 256);

  if (qr) {
    var s = 210, qx = W - 80 - s, qy = y + 46;
    c.fillStyle = '#fff'; roundRect(c, qx - 14, qy - 14, s + 28, s + 28, 18); c.fill();
    c.drawImage(qr, qx, qy, s, s);
  }
  return toBlob(cv);
}

async function certPNG(r){
  var W = 1240, H = 1754;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var c = cv.getContext('2d');
  c.fillStyle = '#f5ead8'; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#c9922f'; c.lineWidth = 8;  c.strokeRect(54, 54, W - 108, H - 108);
  c.strokeStyle = '#12294a'; c.lineWidth = 2;  c.strokeRect(78, 78, W - 156, H - 156);

  var logo = await loadImg('assets/logo.png');
  c.save(); c.beginPath(); c.arc(W/2, 250, 78, 0, Math.PI*2); c.closePath(); c.clip();
  c.fillStyle = '#fffaf1'; c.fill();
  c.drawImage(logo, W/2 - 78, 250 - 78, 156, 156); c.restore();

  c.textAlign = 'center';
  c.fillStyle = '#12294a'; c.font = "400 38px 'Caprasimo', Georgia, serif";
  c.fillText('Deaf and Envision School', W/2, 400);
  c.fillStyle = '#82796a'; c.font = '600 19px Figtree, sans-serif';
  c.fillText('गूँगे बहारों का विद्यालय  ·  ESTABLISHED 1954', W/2, 436);

  c.fillStyle = '#12294a'; c.font = "400 66px 'Caprasimo', Georgia, serif";
  c.fillText('Certificate of Appreciation', W/2, 560);
  c.strokeStyle = '#c9922f'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(W/2 - 120, 596); c.lineTo(W/2 + 120, 596); c.stroke();

  c.fillStyle = '#645c50'; c.font = '400 24px Figtree, sans-serif';
  c.fillText('This is to certify that', W/2, 676);
  c.fillStyle = '#201e1d'; c.font = "400 58px 'Caprasimo', Georgia, serif";
  c.fillText(String(r.donor || r.name || ''), W/2, 756);
  c.strokeStyle = 'rgba(32,30,29,.25)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(280, 786); c.lineTo(W - 280, 786); c.stroke();

  c.fillStyle = '#645c50'; c.font = '400 24px Figtree, sans-serif';
  var lines = isComp(r)
    ? 'has been warmly invited as our guest to the Ganpati Mahotsav 2026 cultural evening, and we are honoured by their presence.'
    : 'has generously contributed ' + money(r.amount) + ' towards the Ganpati Mahotsav 2026 fundraiser, supporting a computer laboratory, skills training halls, building renovation, and classroom equipment for our students.';
  wrapText(c, lines, W/2, 856, W - 400, 40);

  if (!isComp(r)) {
    c.fillStyle = '#12294a'; c.font = "400 72px 'Caprasimo', Georgia, serif";
    c.fillText(money(r.amount), W/2, 1060);
    c.fillStyle = '#82796a'; c.font = '400 22px Figtree, sans-serif';
    c.fillText(words(r.amount), W/2, 1100);
  }

  c.fillStyle = '#645c50'; c.font = '400 23px Figtree, sans-serif';
  c.fillText('With heartfelt gratitude from our students and staff.', W/2, 1180);

  var sig = await loadImg('assets/signature.png');
  var stamp = await loadImg('assets/stamp.png');
  c.drawImage(sig, 210, 1268, 300, 300);
  c.strokeStyle = 'rgba(32,30,29,.35)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(220, 1470); c.lineTo(540, 1470); c.stroke();
  c.fillStyle = '#201e1d'; c.font = '700 26px Figtree, sans-serif';
  c.fillText('Srajan Mishra', 380, 1508);
  c.fillStyle = '#645c50'; c.font = '400 20px Figtree, sans-serif';
  c.fillText('Director of Operations', 380, 1538);
  c.drawImage(stamp, W - 420, 1300, 200, 200);

  try {
    var qr = await loadImg(qrSrc(r.code, 300), true);
    c.drawImage(qr, W - 380, 1520, 120, 120);
  } catch(e){}
  c.fillStyle = '#82796a'; c.font = '400 19px ui-monospace, Menlo, monospace';
  c.fillText(String(r.code || ''), W/2, 1650);
  c.textAlign = 'left';
  return toBlob(cv);
}

function waNumber(p){
  var d = String(p || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.length === 10) d = '91' + d;
  if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1);
  return d;
}
function shareText(r){
  return 'Deaf and Envision School — Ganpati Mahotsav 2026\n\n'
    + (isComp(r) ? String(r.alloc || 'Complimentary') + ' pass for ' : 'Thank you, ')
    + (r.donor || r.name || '') + (isComp(r) ? '' : ', for your donation of ' + money(r.amount))
    + '.\n\nPass number: ' + passNo(r)
    + '\nShow the QR on the pass at the gate.\n' + verifyUrl(r.code);
}

async function sendWhatsApp(r, btn){
  var label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
  try {
    var files = [];
    try { var p = await passPNG(r); if (p) files.push(new File([p], 'pass-' + passNo(r) + '.png', {type:'image/png'})); } catch(e){}
    try { var ct = await certPNG(r); if (ct) files.push(new File([ct], 'certificate-' + passNo(r) + '.png', {type:'image/png'})); } catch(e){}
    var txt = shareText(r);

    if (files.length && navigator.canShare && navigator.canShare({files:files})) {
      await navigator.share({files:files, text:txt});
      return;
    }
    files.forEach(function(f){
      var a = document.createElement('a');
      a.href = URL.createObjectURL(f); a.download = f.name; a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
    });
    var n = waNumber(r.phone);
    window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(txt), '_blank');
    alert(n
      ? 'WhatsApp is opening for ' + r.phone + ' with the message ready.\n\nThe pass and certificate images just downloaded — attach them in WhatsApp.'
      : 'No phone number on this entry, so WhatsApp opened without a contact.\n\nThe pass and certificate images just downloaded — attach them.');
  } catch(e) {
    if (e && e.name === 'AbortError') return;
    alert('Could not prepare the images. ' + (e && e.message ? e.message : ''));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

$('#shareBtn').addEventListener('click', function(){
  if (current) sendWhatsApp(current, $('#shareBtn'));
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

/* high profile guest */
$('#vHon').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  vipState.hon = b.dataset.v; paintPills($('#vHon'), vipState.hon); refreshInvite();
});
$('#vLead').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  vipState.lead = b.dataset.v; paintPills($('#vLead'), vipState.lead); refreshInvite();
});
$('#vName').addEventListener('input', refreshInvite);
$('#vRole').addEventListener('input', refreshInvite);
$('#vPrint').addEventListener('click', printInvite);
$('#vSend').addEventListener('click', sendInvite);

/* bank statement */
$('#bkFile').addEventListener('change', function(e){ readBankFile(e.target.files[0]); });
['dragenter','dragover'].forEach(function(ev){
  $('#bkDrop').addEventListener(ev, function(e){ e.preventDefault(); $('#bkDrop').classList.add('hot'); });
});
['dragleave','drop'].forEach(function(ev){
  $('#bkDrop').addEventListener(ev, function(e){ e.preventDefault(); $('#bkDrop').classList.remove('hot'); });
});
$('#bkDrop').addEventListener('drop', function(e){
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) readBankFile(e.dataTransfer.files[0]);
});
$('#bkGo').addEventListener('click', importBank);
$('#approveAll').addEventListener('click', approveAll);

/* group */
$('#grMode').addEventListener('click', function(e){
  var b = e.target.closest('.pill'); if(!b) return;
  grState.mode = b.dataset.v; paintPills($('#grMode'), grState.mode);
  var online = grState.mode === 'online';
  $('#grRefLabel').textContent = online ? 'UPI / bank reference' : 'Cash received in hand by';
  $('#grRef').placeholder = online ? 'UTR or transaction id' : 'Name of the person who took the cash';
});
$('#grFile').addEventListener('change', function(e){ readRosterFile(e.target.files[0]); });
['dragenter','dragover'].forEach(function(ev){
  $('#grDrop').addEventListener(ev, function(e){ e.preventDefault(); $('#grDrop').classList.add('hot'); });
});
['dragleave','drop'].forEach(function(ev){
  $('#grDrop').addEventListener(ev, function(e){ e.preventDefault(); $('#grDrop').classList.remove('hot'); });
});
$('#grDrop').addEventListener('drop', function(e){
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) readRosterFile(e.dataTransfer.files[0]);
});
$('#grPaste').addEventListener('click', function(){
  var w = $('#grPasteWrap');
  w.style.display = w.style.display === 'none' ? 'block' : 'none';
  if (w.style.display === 'block') $('#grPasteBox').focus();
});
$('#grPasteGo').addEventListener('click', function(){
  grState.students = parseRoster($('#grPasteBox').value);
  $('#grDropMsg').textContent = grState.students.length
    ? grState.students.length + ' students pasted'
    : 'No names found in what you pasted';
  renderRosterPreview();
});
$('#grSave').addEventListener('click', saveGroup);
$('#gsQ').addEventListener('input', renderGroupSearch);

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
  $('#pickGroup').style.display = isControl() ? 'flex' : 'none';
  $('#pickBank').style.display = isControl() ? 'flex' : 'none';
  $('#pickVip').style.display = isControl() ? 'flex' : 'none';
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
