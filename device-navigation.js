(() => {
  'use strict';
  // Browser CSS alone cannot turn a page into a native Roku/TV app.
  // This helper detects TV browsers and enables a ten-foot layout, with
  // directional remote-key focus for our own controls.
  const ua=navigator.userAgent||'';
  const explicit=new URLSearchParams(location.search).get('tv');
  const knownTV=/(?:smart[\s-]?tv|hbbtv|tizen|web0s|webos|netcast|roku|dvp|bravia|viera|googletv|android tv|appletv|fire tv|aft[bmt]|opera tv)/i.test(ua);
  const remoteScreen=matchMedia('(min-width: 1200px) and (hover: none) and (pointer: none)').matches;
  const tv=explicit==='1'||(explicit!=='0'&&(knownTV||remoteScreen));
  if(!tv)return;
  document.body.classList.add('noctra-tv');
  const focusable='button:not([disabled]):not([hidden]):not([tabindex="-1"]),a[href]:not([hidden]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const isVisible=el=>{
    if(!el||el.closest('[hidden],[inert]'))return false;
    const cs=getComputedStyle(el);
    return cs.visibility!=='hidden'&&cs.display!=='none'&&!!el.getClientRects().length;
  };
  function focusRegion(){
    const dialogs=[...document.querySelectorAll('dialog[open]')];
    if(dialogs.length)return dialogs[dialogs.length-1];
    if(document.body.classList.contains('auth-locked'))return document.getElementById('noctra-login');
    return document.getElementById('noctra-app');
  }
  const center=r=>({x:(r.left+r.right)/2,y:(r.top+r.bottom)/2});
  function navigate(key){
    const region=focusRegion();
    if(!region)return;
    const elements=[...region.querySelectorAll(focusable)].filter(isVisible);
    if(!elements.length)return;
    let selected=document.activeElement;
    // Do not override text editing, selects or the player's keyboard handling.
    if(selected?.matches('textarea,select,[contenteditable="true"]'))return;
    if(selected?.matches('input')&&(key==='ArrowLeft'||key==='ArrowRight'))return;
    if(region.id==='player')return;
    if(!elements.includes(selected)){
      selected=elements.find(el=>el.matches('header nav .nav.active'))||elements[0];
      selected.focus({preventScroll:true});
      selected.scrollIntoView({block:'nearest',inline:'nearest'});
      return true;
    }
    const cur=center(selected.getBoundingClientRect());
    const horizontal=key==='ArrowLeft'||key==='ArrowRight';
    const direction=key==='ArrowRight'||key==='ArrowDown'?1:-1;
    let next=null,best=Infinity;
    for(const el of elements){
      if(el===selected)continue;
      const r=el.getBoundingClientRect(),p=center(r);
      const advance=(horizontal?p.x-cur.x:p.y-cur.y)*direction;
      if(advance<=4)continue;
      const deviation=horizontal?Math.abs(p.y-cur.y):Math.abs(p.x-cur.x);
      const score=advance+deviation*2.6;
      if(score<best){best=score;next=el;}
    }
    if(next){
      next.focus({preventScroll:true});
      next.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
      return true;
    }
    return false;
  }
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      if(navigate(e.key))e.preventDefault();
      return;
    }
    // Many TV remotes map Back to Backspace. Keep the browser from navigating
    // away when a dialog can instead be closed.
    if((e.key==='Backspace'||e.key==='BrowserBack')&&
      !(e.target instanceof Element&&e.target.matches('input,textarea,[contenteditable="true"]'))){
      const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
      if(dialog){dialog.close();e.preventDefault();}
    }
  });
})();
