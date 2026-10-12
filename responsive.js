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
      window.noctraRevealHeader?.();
      search?.focus({preventScroll:true});
      if(search?.value.trim())catalog?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const target=desktop.find(d=>d.dataset.page===page);
    if(target)target.click();
    mark(page);
    if(page!=='home') catalog?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  buttons.forEach(b=>b.addEventListener('click',()=>goto(b.dataset.mobilePage)));
  desktop.forEach(b=>b.addEventListener('click',()=>mark(b.dataset.page)));
  // Responsive navigation keeps the published catalog accessible.
  document.addEventListener('error',e=>{
    const image=e.target;
    if(image?.tagName==='IMG' && image.getAttribute('src')?.includes('/assets/')){
      image.style.opacity='0';
    }
  },true);
})();