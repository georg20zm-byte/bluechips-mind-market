'use strict';
/* ═════════════ META (рынок, кванты) ═════════════ */
let quants=100, chips=5; // чипы 🔷 — твёрдая валюта (IAP), кванты ⟠ — фармятся
const PLVL={xp:0,lvl:1};
const xpNext=l=>50+(l-1)*40;
const cardCap=()=>Math.min(10,PLVL.lvl+2); // потолок карт = уровень игрока + 2
function addXP(n){
  PLVL.xp+=n;let up=false;
  while(PLVL.xp>=xpNext(PLVL.lvl)){PLVL.xp-=xpNext(PLVL.lvl);PLVL.lvl++;up=true;}
  syncPlayerUI();return up;
}
function foeLvl(){return Math.min(10,Math.max(curDiff().lvl,PLVL.lvl-1));} // подбор соперника по уровню
function syncPlayerUI(){
  $('balNum').textContent=Math.floor(quants)+' ⟠';
  $('chipsNum').textContent=chips+' 🔷';
  $('plvlNum').textContent='УР. '+PLVL.lvl;
  $('plvlFill').style.width=Math.min(100,PLVL.xp/xpNext(PLVL.lvl)*100)+'%';
  if($('deckQ'))$('deckQ').innerHTML=Math.floor(quants)+' ⟠ · '+chips+' 🔷 · <span style="color:var(--me)">ур.'+PLVL.lvl+'</span>';
  if($('cbWallet'))$('cbWallet').innerHTML='<span style="color:var(--gold)">'+Math.floor(quants)+' ⟠</span> · <span style="color:#5B9BFF">'+chips+' 🔷</span> · <span style="color:var(--me)">ИГРОК УР.'+PLVL.lvl+'</span>';
}
function animateQ(from,to){ // плавное списание квантов
  const t0=performance.now(),dur=450;
  (function f(ts){
    const k=Math.min(1,(ts-t0)/dur);
    quants=from+(to-from)*k;
    syncPlayerUI();
    if(k<1)requestAnimationFrame(f);else{quants=to;syncPlayerUI();}
  })(t0);
}
const CATEGORIES=[
  {id:'all',      label:'ВСЕ',       emoji:'🌐'},
  {id:'finance',  label:'ФИНАНСЫ',   emoji:'💹'},
  {id:'economy',  label:'ЭКОНОМИКА',  emoji:'📊'},
  {id:'politics', label:'ПОЛИТИКА',   emoji:'🏛'},
  {id:'sports',   label:'СПОРТ',      emoji:'🏈'},
  {id:'culture',  label:'КУЛЬТУРА',   emoji:'🎬'},
];
let curCat='all';
// стартовый набор — фолбэк, если живые события ещё не загрузились
let EVENTS=[
  {id:'ai', q:'Лопнет ли пузырь ИИ до конца лета?',       poolY:6200,poolN:3800,resolved:null,dl:'31 АВГ',category:'finance'},
  {id:'btc',q:'Биткоин выше $150K к 1 сентября?',         poolY:2900,poolN:7100,resolved:null,dl:'1 СЕН',category:'finance'},
  {id:'fed',q:'ФРС снизит ставку на июльском заседании?', poolY:5100,poolN:4900,resolved:null,dl:'29 ИЮЛ',category:'economy'},
];
function initEvent(e){e.pos={yes:{sh:0,inv:0},no:{sh:0,inv:0}};e.duels={n:0,w:0};if(!e.category)e.category='culture';return e;}
EVENTS.forEach(initEvent);

// живые события из data/events.json (генерит worker/events-parser.js из Polymarket).
// Не загрузилось — тихо остаёмся на фолбэк-наборе, игра работает всегда.
async function loadLiveEvents(){
  try{
    const res=await fetch('data/events.json',{cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();
    const flat=[];
    Object.values(data.categories||{}).forEach(arr=>arr.forEach(ev=>{
      flat.push(initEvent({
        id:ev.id, q:ev.q, category:ev.category,
        poolY:Math.round((ev.priceYes||0.5)*10000),
        poolN:Math.round((1-(ev.priceYes||0.5))*10000),
        resolved:null, dl:(ev.dl||'').replace(/-/g,'.').slice(5)||'—', url:ev.url||null,
      }));
    }));
    if(flat.length){EVENTS=flat;renderCats();renderMarket();}
  }catch(_){/* оффлайн или файла нет — остаёмся на фолбэке */}
}
const REPORT=[]; // отчёт игрока: резолвы событий с профитом и статой дуэлей
const FOE_NAMES=['SHORT_KING','ГЭП_ХАНТЕР','TETHER_ENJOYER','МАРЖИН_КОЛЛ','DIAMOND_РУКИ','FUD_МАШИНА'];
const priceY=e=>e.poolY/(e.poolY+e.poolN);
const fmtQ=n=>Math.round(n)+' ⟠';
const $=id=>document.getElementById(id);
function syncBalance(){syncPlayerUI();}
function renderCats(){
  const bar=$('catBar');if(!bar)return;
  bar.innerHTML=CATEGORIES.map(c=>{
    const n=c.id==='all'?EVENTS.filter(e=>!e.resolved).length:EVENTS.filter(e=>e.category===c.id&&!e.resolved).length;
    if(c.id!=='all'&&n===0)return ''; // прячем пустые категории
    return `<div class="cat${c.id===curCat?' on':''}" data-c="${c.id}">${c.emoji} ${c.label}${n?' <b>'+n+'</b>':''}</div>`;
  }).join('');
  bar.querySelectorAll('.cat').forEach(el=>el.addEventListener('pointerdown',()=>{
    curCat=el.dataset.c;catShowAll=false;renderCats();renderMarket();$('mktList').scrollTop=0;
  }));
}
let catShowAll=false;
function renderMarket(){
  const L=$('mktList');L.innerHTML='';
  if(REPORT.length){
    const r=document.createElement('div');r.className='ev';
    r.innerHTML='<div class="evMeta" style="color:var(--gold)">📨 ОТЧЁТ · СОБЫТИЯ ЗАВЕРШЕНЫ</div>'+
      REPORT.map(x=>`<div class="pos"><span>«${x.q}» → <b style="color:${x.res==='yes'?'var(--me)':'var(--foe)'}">${x.res==='yes'?'ДА':'НЕТ'}</b>${x.n?'<br>дуэли по событию: побед '+x.wr+'% из '+x.n:''}</span><span class="pv" style="color:${x.pay>=0?'var(--me)':'var(--foe)'}">${x.pay>=0?'+':''}${Math.round(x.pay)} ⟠</span></div>`).join('');
    L.appendChild(r);
  }
  let feed=curCat==='all'?EVENTS.slice():EVENTS.filter(e=>e.category===curCat);
  // незавершённые вперёд, лимит топ-5 (не перегружаем ленту), «ещё» разворачивает
  feed.sort((a,b)=>(a.resolved?1:0)-(b.resolved?1:0));
  const LIMIT=5, total=feed.length;
  if(!catShowAll&&total>LIMIT)feed=feed.slice(0,LIMIT);
  if(!feed.length){
    const empt=document.createElement('div');empt.className='ev';
    empt.innerHTML='<div class="evMeta">В этой категории пока нет открытых событий</div>';
    L.appendChild(empt);
  }
  feed.forEach(e=>{
    const py=priceY(e),pn=1-py;
    const card=document.createElement('div');card.className='ev';
    let html=`<div class="evQ">${e.q}</div>
      <div class="evMeta">ДЕДЛАЙН ${e.dl} · ПУЛ: ${fmtQ(e.poolY+e.poolN)}${e.duels.n?' · ДУЭЛИ: '+Math.round(e.duels.w/e.duels.n*100)+'% ИЗ '+e.duels.n:''}</div>
      <div class="evBar"><div class="evBarY" style="width:${py*100}%"></div></div>`;
    if(e.resolved){
      html+=`<div class="resolved" style="background:rgba(${e.resolved==='yes'?'56,225,234':'255,59,78'},.12);color:${e.resolved==='yes'?'var(--me)':'var(--foe)'}">РЕЗОЛВ: ${e.resolved==='yes'?'ДА':'НЕТ'}</div>`;
    }else{
      html+=`<div class="evBtns">
        <div class="evBtn y" data-e="${e.id}" data-s="yes">ДА · ${Math.round(py*100)}¢<small>купить шеры</small></div>
        <div class="evBtn n" data-e="${e.id}" data-s="no">НЕТ · ${Math.round(pn*100)}¢<small>купить шеры</small></div>
      </div>`;
    }
    ['yes','no'].forEach(s=>{
      const p=e.pos[s];
      if(p.sh>0){
        const val=e.resolved?(e.resolved===s?p.sh:0):p.sh*(s==='yes'?py:pn);
        html+=`<div class="pos"><span>ПОЗИЦИЯ ${s==='yes'?'ДА':'НЕТ'}: ${p.sh.toFixed(1)} шер (${fmtQ(p.inv)})</span><span class="pv">${e.resolved?(e.resolved===s?'выплата ':'сгорело '):'~'}${fmtQ(val)}</span></div>`;
      }
    });
    if(!e.resolved)html+=`<div class="pos"><span style="color:var(--muted)">симуляция исхода для теста</span><span class="devBtn" data-dev="${e.id}">⚙ РЕЗОЛВ</span></div>`;
    card.innerHTML=html;L.appendChild(card);
  });
  if(!catShowAll&&total>LIMIT){
    const more=document.createElement('div');more.className='moreBtn';
    more.textContent='ПОКАЗАТЬ ЕЩЁ '+(total-LIMIT)+' →';
    more.addEventListener('pointerdown',()=>{catShowAll=true;renderMarket();});
    L.appendChild(more);
  }
  L.querySelectorAll('.evBtn').forEach(b=>b.addEventListener('pointerdown',()=>openSheet(b.dataset.e,b.dataset.s)));
  L.querySelectorAll('.devBtn').forEach(b=>b.addEventListener('pointerdown',()=>devResolve(b.dataset.dev)));
}
function devResolve(id){
  const e=EVENTS.find(x=>x.id===id);
  e.resolved=Math.random()<priceY(e)?'yes':'no';
  const p=e.pos[e.resolved];
  const pay=(p.sh||0)-(e.pos.yes.inv+e.pos.no.inv); // профит: выплата минус вложенное
  if(p.sh>0)quants+=p.sh;
  REPORT.unshift({q:e.q,res:e.resolved,pay,n:e.duels.n,wr:e.duels.n?Math.round(e.duels.w/e.duels.n*100):0});
  syncBalance();renderMarket();
}
const PACKS=[
  {ico:'🐂',nm:'Набор Быка',ds:'«Аналитический отчёт» +50% HP, кулдаун волн −25%',pr:'50 🔷'},
  {ico:'🐻',nm:'Набор Медведя',ds:'Второй слот опровержения, башни живут дольше',pr:'50 🔷'},
  {ico:'🕵️',nm:'Инсайдер-пак',ds:'Скан 3.0с, кулдаун −50%, слив дешевле на 5 AP',pr:'75 🔷'},
  {ico:'⚡',nm:'Маркет-мейкер',ds:'Стартовые +40 AP и −20% кулдаун чемпиона',pr:'100 🔷'},
];
const CHIP_PACKS=[
  {ico:'🔷',nm:'Горсть чипов',ds:'50 🔷',pr:'199 ₽'},
  {ico:'💠',nm:'Стек чипов',ds:'120 🔷 · выгода 20%',pr:'399 ₽'},
  {ico:'🌀',nm:'Кейс чипов',ds:'350 🔷 · выгода 40%',pr:'999 ₽'},
];
function renderShop(){
  const L=$('mktList2');L.innerHTML='';
  const h1=document.createElement('div');
  h1.innerHTML='<div class="evMeta" style="color:#5B9BFF">🔷 ЧИПЫ — ПРЕМИУМ-ВАЛЮТА · кванты фармятся в дуэлях, чипы покупаются</div>';
  L.appendChild(h1);
  CHIP_PACKS.forEach(p=>{
    const d=document.createElement('div');d.className='pack';
    d.innerHTML=`<div class="pic">${p.ico}</div><div><div class="nm">${p.nm}</div><div class="ds">${p.ds}</div></div><div class="buy">${p.pr}<small>СКОРО · TG STARS</small></div>`;
    L.appendChild(d);
  });
  const h2=document.createElement('div');
  h2.innerHTML='<div class="evMeta" style="margin-top:8px">НАБОРЫ ИНСТРУМЕНТОВ · ЗА ЧИПЫ</div>';
  L.appendChild(h2);
  PACKS.forEach(p=>{
    const d=document.createElement('div');d.className='pack';
    d.innerHTML=`<div class="pic">${p.ico}</div><div><div class="nm">${p.nm}</div><div class="ds">${p.ds}</div></div><div class="buy">${p.pr}<small>СКОРО</small></div>`;
    L.appendChild(d);
  });
}
function syncDeckTab(){
  const t=document.querySelector('.tab[data-t="deck"]');
  t.classList.toggle('lockT',!tutorialDone);
  t.textContent=tutorialDone?'💼 ПОРТФЕЛЬ':'🔒 ПОРТФЕЛЬ';
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('pointerdown',()=>{
  if(t.dataset.t==='deck'){
    if(!tutorialDone){
      t.textContent='🔒 ПОСЛЕ ОБУЧЕНИЯ';setTimeout(syncDeckTab,1300);return;
    }
    openDeck(false,null);return;
  }
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');
  $('mktList').classList.toggle('hidden',t.dataset.t!=='mkt');
  $('catBar').classList.toggle('hidden',t.dataset.t!=='mkt');
  $('mktList2').classList.toggle('hidden',t.dataset.t!=='shop');
}));

let sheetEv=null,sheetSide=null,sheetAmt=25;
function openSheet(id,side){
  sheetEv=EVENTS.find(x=>x.id===id);sheetSide=side;
  setAmt(25);
  $('shQ').textContent=sheetEv.q;
  $('shSide').textContent='МНЕНИЕ: '+(side==='yes'?'ДА':'НЕТ');
  $('shSide').style.color=side==='yes'?'var(--me)':'var(--foe)';
  calcSheet();$('sheetWrap').classList.remove('hidden');
}
function calcSheet(){
  const py=priceY(sheetEv);
  const p=sheetSide==='yes'?py:1-py;
  $('shPrice').textContent='ЦЕНА ШЕРА: '+Math.round(p*100)+'¢ · вероятность рынка '+Math.round(p*100)+'%';
  const sh=sheetAmt/p;
  $('shShares').textContent=sh.toFixed(1);
  $('shPayout').textContent=fmtQ(sh);
}
function setAmt(v){
  const max=Math.max(5,Math.floor(quants));
  sheetAmt=Math.min(max,Math.max(5,Math.round(v/5)*5||5));
  $('amtSlider').max=max;$('amtSlider').value=sheetAmt;
  $('amtInput').value=sheetAmt;
  calcSheet();
}
$('amtSlider').addEventListener('input',()=>setAmt(+$('amtSlider').value));
$('amtInput').addEventListener('input',()=>{const v=+$('amtInput').value;if(v>=5)setAmt(v);});
$('amtInput').addEventListener('blur',()=>setAmt(+$('amtInput').value));
$('shCancel').addEventListener('pointerdown',()=>$('sheetWrap').classList.add('hidden'));
$('shConfirm').addEventListener('pointerdown',()=>{
  if(quants<sheetAmt){$('shConfirm').textContent='НЕ ХВАТАЕТ КВАНТОВ';setTimeout(()=>$('shConfirm').textContent='ИНВЕСТИРОВАТЬ',1000);return;}
  const py=priceY(sheetEv);
  const p=sheetSide==='yes'?py:1-py;
  quants-=sheetAmt;
  sheetEv.pos[sheetSide].sh+=sheetAmt/p;sheetEv.pos[sheetSide].inv+=sheetAmt;
  if(sheetSide==='yes')sheetEv.poolY+=sheetAmt;else sheetEv.poolN+=sheetAmt;
  syncBalance();renderMarket();
  $('sheetWrap').classList.add('hidden');
  openDuel();
});
