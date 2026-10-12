(() => {
  'use strict';
  const buttons=[...document.querySelectorAll('[data-mobile-page]')];
  const desktop=[...document.querySelectorAll('header nav [data-page]')];
  const catalog=document.getElementById('catalog');
  const search=document.getElementById('search');
  function mark(page){
    buttons.forEach(b=>{const chosen=b.dataset.mobilePage===page;
      b.classList.toggle('active',chosen);
      if(chosen)b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    });
  }
  function goto(page){
    if(page==='search'){
      mark('search');
      if(document.body.classList.contains('library-mode')===false){
        catalog?.scrollIntoView({behavior:'smooth',block:'start'});
      }
      search?.focus({preventScroll:true});
      return;
    }
    const target=desktop.find(d=>d.dataset.page===page);
    if(target)target.click();
    mark(page);
    if(page!=='home') catalog?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  buttons.forEach(b=>b.addEventListener('click',()=>goto(b.dataset.mobilePage)));
  desktop.forEach(b=>b.addEventListener('click',()=>mark(b.dataset.page)));
  document.querySelector('.search-trigger')?.addEventListener('click',()=>mark('search'));
  // Saved example posters are optional artwork. The Drive JS renders the real catalog.
  document.addEventListener('error',e=>{
    const image=e.target;
    if(image?.tagName==='IMG' && image.getAttribute('src')?.includes('/assets/')){
      image.style.opacity='0';
    }
  },true);
})();