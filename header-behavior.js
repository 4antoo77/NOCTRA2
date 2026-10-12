(() => {
  'use strict';
  const header=document.querySelector('#noctra-app > header');
  const search=document.getElementById('search');
  if(!header||!search)return;
  let idleTimer=0;
  let lastScroll=window.scrollY||0;

  function reveal(){
    header.classList.remove('noctra-header-hidden');
  }
  function conceal(){
    if(document.body.classList.contains('auth-locked'))return;
    if(window.scrollY<=28)return reveal();
    if(document.activeElement===search)return reveal();
    if(document.body.classList.contains('noctra-tv')&&header.contains(document.activeElement))return reveal();
    header.classList.add('noctra-header-hidden');
  }
  function onScroll(){
    const current=window.scrollY||0;
    if(Math.abs(current-lastScroll)<1)return;
    lastScroll=current;
    clearTimeout(idleTimer);
    // Both upward and downward scrolling temporarily hide the navbar.
    conceal();
    idleTimer=window.setTimeout(reveal,650);
  }
  window.noctraRevealHeader=()=>{
    clearTimeout(idleTimer);
    reveal();
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',()=>{
    clearTimeout(idleTimer);
    reveal();
  },{passive:true});
  header.addEventListener('focusin',reveal);
  search.addEventListener('focus',()=>{
    clearTimeout(idleTimer);
    reveal();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.activeElement===search){
      search.blur();
    }
  });
  reveal();
})();
