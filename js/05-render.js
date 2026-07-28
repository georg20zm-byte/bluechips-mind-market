/* ── render ── */
function draw(t){
  ctx.clearRect(0,0,W,H);
  const midY=H*0.5;
  let g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(255,59,78,.06)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(56,225,234,.06)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(107,116,132,.12)';ctx.lineWidth=1;
  for(let i=1;i<LANES;i++){ctx.beginPath();ctx.moveTo(W*i/LANES,0);ctx.lineTo(W*i/LANES,H);ctx.stroke();}

  const scan=S.running&&S.t<S.scanUntil;
  if(!scan){ctx.fillStyle='rgba(7,8,11,.42)';ctx.fillRect(0,0,W,midY);}
  else{ctx.fillStyle='rgba(240,80,200,.05)';ctx.fillRect(0,0,W,midY);}
  // зоны спеллов
  S.zones.forEach(z=>{
    const a=(z.until-S.t)/3;
    ctx.strokeStyle=z.kind==='halt'?`rgba(56,225,234,${.3*a+.15})`:`rgba(240,80,200,${.3*a+.15})`;
    ctx.setLineDash([4,4]);ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,7);ctx.stroke();ctx.setLineDash([]);
  });
  // постройки
  S.towers.forEach(tw=>{
    const mine=tw.side==='me';
    const hidden=!mine&&!scan&&tw.y<midY;
    const col=mine?'240,190,60':'255,59,78';
    const dis=S.t<tw.disabledUntil;
    if(hidden){
      if(TUT.on||liveMatches<2){ // с 3-го живого матча меток нет — только скан
        ctx.fillStyle='rgba(107,116,132,.5)';ctx.fillRect(tw.x-8,tw.y-8,16,16);
        ctx.fillStyle='rgba(168,176,190,.8)';ctx.font='800 11px JetBrains Mono';ctx.textAlign='center';
        ctx.fillText('?',tw.x,tw.y+4);
      }
      return;
    }
    if(tw.key==='paywall'){
      const hw=W/LANES*0.42;
      ctx.fillStyle=`rgba(${col},${dis?.3:.75})`;
      ctx.fillRect(tw.x-hw,tw.y-5,hw*2,10);
      ctx.fillStyle='rgba(7,8,11,.6)';
      for(let i=-3;i<=3;i++)ctx.fillRect(tw.x+i*hw/3.5-1,tw.y-5,2,10);
      ctx.fillStyle='rgba(7,8,11,.7)';ctx.fillRect(tw.x-hw,tw.y-11,hw*2,3);
      ctx.fillStyle=`rgba(${col},.9)`;ctx.fillRect(tw.x-hw,tw.y-11,hw*2*tw.hp/tw.maxHp,3);
      return;
    }
    const d=CARD_DB[tw.key];
    ctx.strokeStyle=`rgba(${col},${dis?.05:.12})`;ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(tw.x,tw.y,d.range,0,7);ctx.stroke();
    ctx.fillStyle=dis?'rgba(107,116,132,.6)':`rgba(${col},.9)`;
    if(tw.key==='lawsuit'){
      ctx.setLineDash([4,5]);ctx.strokeStyle=`rgba(${col},.35)`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(tw.x,tw.y,CARD_DB.lawsuit.range,0,7);ctx.stroke();ctx.setLineDash([]);
      ctx.save();ctx.translate(tw.x,tw.y);ctx.rotate(Math.PI/4);
      ctx.fillRect(-7,-7,14,14);ctx.restore();
      ctx.fillStyle='rgba(7,8,11,.9)';ctx.font='800 10px JetBrains Mono';ctx.textAlign='center';
      ctx.fillText('⚖',tw.x,tw.y+3.5);
    }else if(tw.key==='sniper'){
      ctx.fillRect(tw.x-8,tw.y-8,16,16);
      ctx.strokeStyle='rgba(7,8,11,.9)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(tw.x-5,tw.y);ctx.lineTo(tw.x+5,tw.y);ctx.moveTo(tw.x,tw.y-5);ctx.lineTo(tw.x,tw.y+5);ctx.stroke();
    }else{
      ctx.beginPath();ctx.arc(tw.x,tw.y,9,0,7);ctx.fill();
      ctx.strokeStyle=dis?'rgba(107,116,132,.4)':`rgba(${col},.5)`;
      ctx.beginPath();ctx.arc(tw.x,tw.y,13,0,7);ctx.stroke();
    }
    // остаток жизни
    const lifeFrac=clamp((tw.dieAt-S.t)/CARD_DB[tw.key].life,0,1);
    ctx.strokeStyle=`rgba(${col},.7)`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(tw.x,tw.y,16,-Math.PI/2,-Math.PI/2+Math.PI*2*lifeFrac);ctx.stroke();
    if(dis){ctx.fillStyle='rgba(240,80,200,.9)';ctx.font='800 9px JetBrains Mono';ctx.textAlign='center';ctx.fillText('OFFLINE',tw.x,tw.y+28);}
  });
  // юниты
  S.units.forEach(u=>{
    const mine=u.side==='me';
    if(!mine&&!scan&&u.y<midY)return;
    const col=mine?'56,225,234':'255,59,78';
    const frozen=S.t<u.frozenUntil;
    const alpha=u.stealth?.55:.95;
    const halo=ctx.createRadialGradient(u.x,u.y,1,u.x,u.y,u.r*3);
    halo.addColorStop(0,`rgba(${frozen?'168,216,255':col},.5)`);halo.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(u.x,u.y,u.r*3,0,7);ctx.fill();
    ctx.fillStyle=frozen?'rgba(168,216,255,.9)':`rgba(${col},${alpha})`;
    if(u.key==='report'||u.key==='golem'){
      ctx.beginPath();
      for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6;
        const px=u.x+Math.cos(a)*u.r,py=u.y+Math.sin(a)*u.r;
        i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
      ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(7,8,11,.7)';ctx.fillRect(u.x-12,u.y-u.r-7,24,3);
      ctx.fillStyle=`rgba(${col},.9)`;ctx.fillRect(u.x-12,u.y-u.r-7,24*u.hp/u.maxHp,3);
    }else if(u.stealth){
      ctx.setLineDash([3,3]);ctx.strokeStyle=`rgba(${col},.9)`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(u.x,u.y,u.r+2,0,7);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(u.x,u.y,u.r,0,7);ctx.fill();
    }else{
      ctx.beginPath();ctx.arc(u.x,u.y,u.r,0,7);ctx.fill();
    }
  });
  // выстрелы
  S.shots.forEach(s=>{
    ctx.strokeStyle=`rgba(${s.color},${s.life/.22*.9})`;ctx.lineWidth=s.splash?2:2.8;
    ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();
    if(s.splash){ctx.strokeStyle=`rgba(${s.color},${s.life/.22*.45})`;
      ctx.beginPath();ctx.arc(s.x2,s.y2,s.splash,0,7);ctx.stroke();}
  });
  // подписи
  S.floats.forEach(f=>{
    ctx.fillStyle=`rgba(${f.color},${clamp(f.life,0,1)})`;
    ctx.font='700 9.5px JetBrains Mono';ctx.textAlign='center';
    ctx.fillText(f.txt,f.x,f.y);
  });
  // ОКО
  /* ═══ ОКО-ЛИНИЯ: горизонтальная лента вместо пунктирной оси ═══
     цвет = кто доминирует (циан ты / красный оппонент), толщина = серия атак лидера */
  const BLU='56,225,234', RED='255,59,78';
  const LINE_BASE=3, x0=8, plotW=W-16, WIN=60; // окно = длительность матча
  const winStart=Math.max(0,S.t-WIN);
  const tx2px=tt=>x0+((tt-winStart)/WIN)*plotW;
  // лента по сегментам (0.25с каждый)
  S.line.forEach(pt=>{
    if(pt.t<winStart)return;
    const x=tx2px(pt.t), wSeg=(0.25/WIN)*plotW+0.6;
    const h=LINE_BASE*(pt.dom===0?1:pt.mult);
    ctx.fillStyle=pt.dom>0?`rgba(${BLU},.92)`:pt.dom<0?`rgba(${RED},.92)`:'rgba(240,190,60,.45)';
    ctx.fillRect(x,midY-h/2,wSeg,h);
  });
  // маркер Ока на конце линии
  const mX=tx2px(S.t), mY=midY;
  const oc2=S.oko>0.005?BLU:S.oko<-0.005?RED:'240,190,60';
  const halo2=ctx.createRadialGradient(mX,mY,1,mX,mY,18);
  halo2.addColorStop(0,`rgba(${oc2},.55)`);halo2.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=halo2;ctx.beginPath();ctx.arc(mX,mY,18,0,7);ctx.fill();
  ctx.fillStyle='#E8ECF1';ctx.beginPath();ctx.arc(mX,mY,5.5+(S.overtime?Math.sin(t*8)*1.5:0),0,7);ctx.fill();
  ctx.fillStyle='#07080B';ctx.beginPath();ctx.arc(mX,mY,2.2,0,7);ctx.fill();
  // акцент сдвига: мягкое свечение вдоль линии (без стрелок)
  if(S.okoFlash&&S.t<S.okoFlash.until){
    const toMe=S.okoFlash.side==='me';
    const a=clamp((S.okoFlash.until-S.t)/1.3,0,1);
    const fc=toMe?BLU:RED;
    const fg=ctx.createLinearGradient(0,midY-24,0,midY+24);
    fg.addColorStop(0,'rgba(0,0,0,0)');fg.addColorStop(.5,`rgba(${fc},${.14*a})`);fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fg;ctx.fillRect(0,midY-24,W,48);
    if(TUT.on){ctx.font='800 10px JetBrains Mono';ctx.textAlign='left';
      ctx.fillStyle=`rgba(${fc},${a})`;
      ctx.fillText(toMe?'РЫНОК ТВОЙ — ЛИНИЯ ГОЛУБАЯ':'РЫНОК ПАДАЕТ — ЛИНИЯ КРАСНАЯ',8,midY-30);}
  }
  // пульсы полной заливки при установке
  S.pulses.forEach(p=>{
    ctx.strokeStyle=`rgba(${p.color},${clamp(p.life/.4,0,1)})`;
    ctx.lineWidth=3*clamp(p.life/.4,0,1)+1;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.stroke();
  });
  // ── призрак перетаскиваемой карты (полупрозрачный, заливка при дропе) ──
  if(dragP&&dragP.active&&dragP.py>0&&dragP.py<H){
    const gd=CARD_DB[S.hand[dragP.slot]];
    const gx=dragP.px,gy=dragP.py;
    ctx.save();ctx.globalAlpha=.45;
    if(gd.t==='unit'){
      const lane=clamp(Math.floor(gx/W*LANES),0,LANES-1);
      // подсветка полосы
      ctx.fillStyle='rgba(56,225,234,.10)';
      ctx.fillRect(W*lane/LANES,0,W/LANES,H);
      ctx.strokeStyle='rgba(56,225,234,.5)';ctx.setLineDash([6,6]);ctx.lineWidth=1.5;
      ctx.strokeRect(W*lane/LANES+2,2,W/LANES-4,H-4);ctx.setLineDash([]);
      // призраки юнитов под пальцем
      ctx.fillStyle='rgba(56,225,234,.9)';
      for(let i=0;i<gd.count;i++){
        const ox=(gd.count>1?(i-(gd.count-1)/2)*14:0);
        if(gd.hp>=10){
          ctx.beginPath();
          for(let k=0;k<6;k++){const a=Math.PI/3*k-Math.PI/6;
            const hx=gx+ox+Math.cos(a)*gd.r,hy=gy+Math.sin(a)*gd.r;
            k?ctx.lineTo(hx,hy):ctx.moveTo(hx,hy);}
          ctx.closePath();ctx.fill();
        } else {ctx.beginPath();ctx.arc(gx+ox,gy,gd.r,0,7);ctx.fill();}
      }
    } else if(gd.t==='tower'||gd.t==='wall'){
      const ok=gy>=H*0.52&&towersOf('me').length<TOWER_CAP;
      const col=ok?'240,190,60':'255,59,78';
      if(gd.t==='wall'){
        const hw=W/LANES*0.42;
        ctx.fillStyle=`rgba(${col},.8)`;ctx.fillRect(gx-hw,gy-5,hw*2,10);
      } else {
        ctx.strokeStyle=`rgba(${col},.4)`;ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(gx,gy,gd.range,0,7);ctx.stroke();
        ctx.fillStyle=`rgba(${col},.9)`;
        if(S.hand[dragP.slot]==='sniper')ctx.fillRect(gx-8,gy-8,16,16);
        else{ctx.beginPath();ctx.arc(gx,gy,9,0,7);ctx.fill();}
      }
      if(!ok){ctx.globalAlpha=.9;ctx.fillStyle='rgba(255,59,78,.9)';ctx.font='800 9px JetBrains Mono';ctx.textAlign='center';ctx.fillText('НА СВОЮ ПОЛОВИНУ',gx,gy-18);}
    } else { // spell
      if(gd.radius){
        ctx.strokeStyle='rgba(240,80,200,.7)';ctx.setLineDash([5,5]);ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(gx,gy,gd.radius,0,7);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='rgba(240,80,200,.15)';
        ctx.beginPath();ctx.arc(gx,gy,gd.radius,0,7);ctx.fill();
      } else {
        ctx.fillStyle='rgba(240,190,60,.9)';ctx.font='800 14px JetBrains Mono';ctx.textAlign='center';
        ctx.fillText('+40 AP',gx,gy);
      }
    }
    ctx.restore();
  }
  // ── туториал: затемнение арены + мишень + стрелка от карты ──
  if(TUT.on&&S.paused){
    ctx.fillStyle='rgba(4,5,8,.45)';ctx.fillRect(0,0,W,H);
    let tx=null,ty=null;
    if(TUT.step===1){tx=laneX(1);ty=H*0.72;} // центр своей половины
    else if(TUT.step===2){tx=null;} // урок Ока: акцент на оси, рука не нужна
    else if(TUT.step===3){tx=laneX(1);ty=H*0.42;}
    else if(TUT.step===4){tx=W-36;ty=H*0.22;} // скрытая башня «?»
    else if(TUT.step===5){tx=laneX(1);ty=H*0.30;} // финальная атака — на половину врага
    if(TUT.step===2){ // урок линии: кольцо внимания на маркере
      const mX2=8+(Math.min(S.t,60)/60)*(W-16), mY2=H*0.5;
      ctx.strokeStyle='rgba(240,190,60,'+(0.55+Math.sin(t*5)*.35)+')';
      ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(mX2,mY2,24+Math.sin(t*5)*5,0,7);ctx.stroke();
    }
    if(tx!==null){
      // пульсирующая мишень
      ctx.strokeStyle='rgba(240,190,60,'+(0.5+Math.sin(t*6)*.3)+')';
      ctx.lineWidth=2;ctx.setLineDash([6,5]);
      ctx.beginPath();ctx.arc(tx,ty,26+Math.sin(t*6)*4,0,7);ctx.stroke();ctx.setLineDash([]);
      if(TUT.step===1){ctx.fillStyle='rgba(240,190,60,.9)';ctx.font='800 9px JetBrains Mono';ctx.textAlign='center';ctx.fillText('СЮДА',tx,ty+3);}
      // рука-указатель: демонстрирует жест перетаскивания от карты к мишени
      if(TUT.step!==4){
        const hi=document.querySelector('.tutHi');
        if(hi){
          const hr=hi.getBoundingClientRect(),cr=cv.getBoundingClientRect();
          const sx=clamp(hr.left+hr.width/2-cr.left,10,W-10),sy=H-6;
          const CYCLE=1.8, ph=(t%CYCLE)/CYCLE;
          // 0–0.65 движение по дуге, 0.65–1.0 «тап» на мишени
          let hx,hy,press=0;
          if(ph<0.65){
            const k=ph/0.65, e=k*k*(3-2*k); // ease in-out
            const cxq=(sx+tx)/2+(sx>tx?50:-50),cyq=(sy+ty)/2;
            hx=(1-e)*(1-e)*sx+2*(1-e)*e*cxq+e*e*tx;
            hy=(1-e)*(1-e)*sy+2*(1-e)*e*cyq+e*e*ty;
            // полупрозрачный след жеста
            ctx.strokeStyle='rgba(240,190,60,.35)';ctx.lineWidth=2;ctx.setLineDash([4,7]);
            ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(cxq,cyq,tx,ty);ctx.stroke();ctx.setLineDash([]);
          } else {
            hx=tx;hy=ty;
            press=Math.sin((ph-0.65)/0.35*Math.PI); // нажатие
          }
          // белая перчатка: ладонь + указательный палец (в стиле CR)
          const sc=1-press*0.18;
          ctx.save();ctx.translate(hx,hy);ctx.scale(sc,sc);
          ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
          ctx.fillStyle='#F5F5F2';
          // палец (кончик в точке мишени)
          ctx.beginPath();ctx.ellipse(4,14,7,15,-.35,0,7);ctx.fill();
          // ладонь-кулак
          ctx.beginPath();ctx.ellipse(13,30,15,13,-.25,0,7);ctx.fill();
          // манжет
          ctx.shadowColor='transparent';
          ctx.fillStyle='#D9DCE2';
          ctx.beginPath();ctx.ellipse(24,38,7,10,-.5,0,7);ctx.fill();
          ctx.restore();
          if(press>0){ // круг нажатия
            ctx.strokeStyle='rgba(255,255,255,'+(0.7*press)+')';ctx.lineWidth=2.5;
            ctx.beginPath();ctx.arc(tx,ty,18+press*10,0,7);ctx.stroke();
          }
        }
      }
    }
  }
  // зона размещения
  if(S.selected>=0||S.champSel){
    const d=S.selected>=0?CARD_DB[S.hand[S.selected]]:null;
    const own=d&&(d.t==='tower'||d.t==='wall');
    ctx.fillStyle=own?'rgba(240,190,60,.06)':'rgba(56,225,234,.05)';
    if(own)ctx.fillRect(0,midY,W,H-midY);else ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=own?'rgba(240,190,60,.5)':'rgba(56,225,234,.4)';
    ctx.setLineDash([6,6]);ctx.lineWidth=1.5;
    ctx.strokeRect(2,own?midY+2:2,W-4,(own?H-midY:H)-4);
    ctx.setLineDash([]);
  }
}

/* ── loop ── */
let lastT=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(ts-lastT)/1000)||0;lastT=ts;
  if(S&&S.running)step(dt*(S.timeScale||1));
  if(S&&!$('scrBattle').classList.contains('hidden')){
    let tl;
    if(S.overtime)tl=Math.max(0,OT_T-(S.t-S.otT));
    else tl=Math.max(0,MATCH_T-S.t);
    const m=Math.floor(tl/60),sec=Math.ceil(tl%60);
    $('timer').textContent=m+':'+String(sec===60?0:sec).padStart(2,'0');
    $('apNum').innerHTML=Math.floor(S.ap.me)+'<span> AP</span>';
    $('apFill').style.width=(S.ap.me/MAX_AP*100)+'%';
    $('heatFill').style.width=clamp(S.heat/HEAT_LIMIT*100,0,100)+'%';
    syncHand();draw(ts/1000);
  }
}

