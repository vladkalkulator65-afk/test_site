'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const data = window.SK_DATA;
  if (!data) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = $('.site-header');
  const menu = $('#mobile-menu');
  const menuToggle = $('.menu-toggle');
  function closeMenu() {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Открыть меню');
    document.body.classList.remove('menu-open');
  }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.classList.toggle('menu-open', open);
  });
  $$('a', menu).forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuToggle.focus(); }
    if (event.key === 'Tab' && !menu.hidden) {
      const stops = [menuToggle, ...$$('a', menu)];
      if (event.shiftKey && document.activeElement === stops[0]) { event.preventDefault(); stops.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === stops.at(-1)) { event.preventDefault(); stops[0].focus(); }
    }
  });
  matchMedia('(min-width: 1380px)').addEventListener('change', e => { if (e.matches) closeMenu(); });
  function scrollState() { header.classList.toggle('scrolled', window.scrollY > 10); }
  window.addEventListener('scroll', scrollState, {passive:true}); scrollState();
  if ('IntersectionObserver' in window && !reduceMotion) {
    document.documentElement.classList.add('js-reveal');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), {threshold:0.05, rootMargin:'0px 0px 20px 0px'});
    $$('.reveal').forEach(el => observer.observe(el));
  }
  // Hide the fixed mobile CTA while the corresponding form is already on screen.
  const cta = $('.mobile-cta');
  const observedSections = new Set();
  if ('IntersectionObserver' in window) {
    const ctaObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? observedSections.add(entry.target) : observedSections.delete(entry.target));
      cta.classList.toggle('cta-hidden', observedSections.size > 0);
    }, {threshold:0.2});
    ['#hero-title','#quiz','#contacts'].forEach(s => ctaObserver.observe($(s)));
  }
  // Native <dialog> confines keyboard focus and handles Escape.
  let returnFocus = new WeakMap();
  function openDialog(dialog) {
    closeMenu();
    returnFocus.set(dialog, document.activeElement);
    if (!dialog.open) dialog.showModal();
  }
  $$('dialog').forEach(dialog => {
    $('[data-close-dialog]',dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      const previous = returnFocus.get(dialog);
      if (previous?.isConnected && previous.getClientRects().length) previous.focus({preventScroll:true});
    });
  });
  const leadDialog = $('#lead-dialog');
  function openLead(project = '') {
    $('#modal-form [name=project]').value = project;
    $('#lead-context').textContent = project ? `Обсудим: ${project}. Оставьте контакты для звонка специалиста.` : 'Оставьте контакты, чтобы обсудить детали со специалистом.';
    openDialog(leadDialog);
    $('#modal-name').focus({preventScroll:true});
  }
  $$('[data-open-lead]').forEach(button => button.addEventListener('click', () => openLead(button.dataset.project || '')));
  // Portfolio: genuine archive projects, no invented category or object data.
  let filter = 'all', showAll = false;
  const cards = $$('[data-project-card]');
  function applyFilter() {
    let visible = 0, total = 0;
    cards.forEach(card => {
      const matches = filter === 'all' || card.dataset.category === filter;
      if (matches) total++;
      const show = matches && (showAll || visible < 6);
      if (show) visible++;
      card.hidden = !show;
    });
    $('#project-count').textContent = `Показано ${visible} из ${total} проектов`;
    $('#show-projects').hidden = total <= 6;
    $('#show-projects').textContent = showAll ? 'Свернуть проекты ↑' : `Показать все проекты (${total}) ↓`;
  }
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter; showAll = false;
    $$('.filter').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    applyFilter();
  }));
  $('#show-projects').addEventListener('click', () => {
    showAll = !showAll; applyFilter();
    if (!showAll) $('#projects-title').scrollIntoView({behavior: reduceMotion ? 'instant' : 'smooth', block:'start'});
    else cards.filter(c => !c.hidden)[6]?.querySelector('button')?.focus({preventScroll:true});
  });
  applyFilter();
  let currentProject = null, imageIndex = 0;
  const projectDialog = $('#project-dialog'), lightbox = $('#lightbox');
  function renderImage() {
    const photo = currentProject.images[imageIndex];
    ['#gallery-image','#lightbox-image'].forEach(selector => {
      const image = $(selector); image.src = photo.src; image.alt = photo.alt;
      image.width = photo.width; image.height = photo.height;
    });
    const count = `${imageIndex + 1} / ${currentProject.images.length}`;
    $('#gallery-counter').textContent = count; $('#lightbox-counter').textContent = count;
    $$('#gallery-thumbs button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === imageIndex)));
  }
  function changeImage(delta) {
    if (!currentProject) return;
    imageIndex = (imageIndex + delta + currentProject.images.length) % currentProject.images.length;
    renderImage();
  }
  function fact(term, value) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = term; dd.textContent = value;
    $('#project-facts').append(dt,dd);
  }
  function openProject(id) {
    const p = data.projects.find(p => p.id === id); if (!p) return;
    currentProject = p; imageIndex = 0;
    $('#project-dialog-title').textContent = p.title; $('#project-type').textContent = p.type;
    $('#project-location').textContent = p.location; $('#project-details').textContent = p.details;
    $('#project-note').textContent = (p.note ? p.note+' ' : '') + 'Срок указан для этого выполненного объекта и не является обещанием срока для нового проекта.';
    $('#project-facts').replaceChildren(); fact('Задача',p.task); fact('Размер',p.size); fact('Срок объекта',p.duration);
    $('#gallery-thumbs').replaceChildren();
    p.images.forEach((photo,i) => {
      const button = document.createElement('button'), image = document.createElement('img');
      button.type = 'button'; button.setAttribute('aria-label', `Фотография ${i+1}`); button.setAttribute('aria-pressed',String(i===0));
      image.src = photo.thumb || photo.src; image.alt = ''; image.decoding = 'async'; image.width = photo.width; image.height = photo.height; image.loading='lazy';
      button.append(image); button.addEventListener('click', () => { imageIndex = i; renderImage(); }); $('#gallery-thumbs').append(button);
    });
    renderImage(); openDialog(projectDialog); $('#project-dialog-title').focus({preventScroll:true});
  }
  $$('[data-project-id]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.projectId)));
  $$('[data-gallery-prev]').forEach(b => b.addEventListener('click', () => changeImage(-1)));
  $$('[data-gallery-next]').forEach(b => b.addEventListener('click', () => changeImage(1)));
  [projectDialog,lightbox].forEach(dialog => dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); changeImage(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); changeImage(-1); }
  }));
  // Swipe is optional; visible controls remain available for every touch device.
  ['#gallery-image','#lightbox-image'].forEach(selector => {
    let startX = null, startY = null;
    $(selector).addEventListener('touchstart',e => { startX=e.changedTouches[0].clientX; startY=e.changedTouches[0].clientY; },{passive:true});
    $(selector).addEventListener('touchend',e => {
      const dx=e.changedTouches[0].clientX-startX, dy=e.changedTouches[0].clientY-startY;
      if (startX !== null && Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.5) changeImage(dx>0?-1:1);
      startX=null;
    },{passive:true});
  });
  $('#gallery-zoom').addEventListener('click', () => openDialog(lightbox));
  $('#similar-project').addEventListener('click', () => {
    const name = `${currentProject.type} — ${currentProject.title}`;
    projectDialog.close(); openLead(name);
  });
  // Quiz: answers persist between steps in memory, never personal data in storage.
  let step = 0;
  const answers = {};
  const quizForm = $('#quiz-form');
  $$('.quiz-option input').forEach(input => input.addEventListener('change', () => {
    answers[input.name] = input.value; $('.quiz-error').textContent = '';
  }));
  function renderQuiz(focus = true) {
    $$('.quiz-step').forEach((fieldset,i) => { fieldset.hidden = i !== step; fieldset.disabled = i !== step; });
    $('#quiz-step-label').textContent = `Шаг ${step+1} из 5`; $('#quiz-progress').value = step+1;
    $('#quiz-back').disabled = step === 0; $('#quiz-next').hidden = step === 4;
    $('.quiz-error').textContent = '';
    if (step === 4) {
      $('#quiz-summary').replaceChildren();
      data.quiz.forEach(q => {const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=q.title;dd.textContent=answers[q.key];$('#quiz-summary').append(dt,dd);});
    }
    if (focus) $(`.quiz-step[data-step="${step}"] legend`).focus({preventScroll:true});
  }
  $('#quiz-next').addEventListener('click', () => {
    if (!answers[data.quiz[step].key]) {
      $('.quiz-error').textContent = 'Выберите один вариант, чтобы продолжить.';
      $(`.quiz-step[data-step="${step}"] input`).focus({preventScroll:true}); return;
    }
    step = Math.min(4,step+1); renderQuiz();
  });
  $('#quiz-back').addEventListener('click', () => {step=Math.max(0,step-1);renderQuiz();});
  // Phone mask preserves caret position for edits and accepts +7, 8, and 10 digits.
  function phoneDigits(value) {
    let digits=value.replace(/\D/g,'');
    if (digits.length > 10 && (digits[0] === '7' || digits[0] === '8')) digits=digits.slice(1);
    else if (value.startsWith('+7')) digits=digits.slice(1);
    return digits.slice(0,10);
  }
  function phoneMask(digits) {
    if (!digits) return '';
    let v='+7 ('+digits.slice(0,3);
    if(digits.length>=3) v+=')';
    if(digits.length>3) v+=' '+digits.slice(3,6);
    if(digits.length>6) v+='-'+digits.slice(6,8);
    if(digits.length>8) v+='-'+digits.slice(8,10);
    return v;
  }
  $$('input[type=tel]').forEach(input => {
    input.addEventListener('beforeinput', event => {
      if(event.inputType!=='deleteContentBackward' || input.selectionStart!==input.selectionEnd) return;
      const cursor=input.selectionStart || 0;
      if(!cursor || /\d/.test(input.value[cursor-1])) return;
      event.preventDefault();
      let index=cursor-1;
      while(index>=0 && !/\d/.test(input.value[index])) index--;
      if(index<=1){input.value='';input.setCustomValidity('');return;}
      const before=input.value.slice(0,index).replace(/\D/g,'').length;
      input.value=phoneMask(phoneDigits(input.value.slice(0,index)+input.value.slice(index+1)));
      let pos=0,count=0;
      for(;pos<input.value.length;pos++){if(/\d/.test(input.value[pos])) count++;if(count>=before){pos++;break;}}
      input.setSelectionRange(pos,pos);input.setCustomValidity('');
    });
    input.addEventListener('input',e => {
      input.setCustomValidity('');
      if (/^[78]$/.test(input.value)) {input.value='+7 (';return;}
      const old=input.value, cursor=input.selectionStart ?? old.length;
      let digitsBefore=old.slice(0,cursor).replace(/\D/g,'').length;
      const formatted=phoneMask(phoneDigits(old));
      input.value=formatted;
      if(cursor<old.length) {
        let count=0,pos=0;for(;pos<formatted.length;pos++){if(/\d/.test(formatted[pos])) count++;if(count>=digitsBefore){pos++;break;}}
        input.setSelectionRange(pos,pos);
      }
    });
    input.addEventListener('blur',()=>{if(input.value) input.value=phoneMask(phoneDigits(input.value));});
  });
  const attribution={};
  const params=new URLSearchParams(location.search);
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','yclid'].forEach(key=>{if(params.has(key)) attribution[key]=params.get(key).slice(0,250);});
  let csrf='', tokenRequest=null;
  async function getToken(force=false) {
    if(location.protocol==='file:') throw new Error('Для отправки заявки откройте сайт на PHP-хостинге или локальном PHP-сервере. Вы также можете позвонить: '+data.phone+'.');
    if(csrf && !force) return csrf;
    if(tokenRequest) return tokenRequest;
    tokenRequest=(async()=>{
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
      try {
        const response=await fetch('php/token.php',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
        const type=response.headers.get('Content-Type')||'';
        if(!type.includes('application/json')) throw new Error('Сервер отправки недоступен. Позвоните нам: '+data.phone+'.');
        const result=await response.json();
        if(!response.ok || !result.csrf_token) throw new Error(result.message||'Не удалось подготовить форму. Повторите попытку позже.');
        csrf=result.csrf_token;
        $$('[name=csrf_token]').forEach(input=>input.value=csrf); return csrf;
      } finally {clearTimeout(timer);tokenRequest=null;}
    })();
    return tokenRequest;
  }
  // Prepare a genuine server token early; no fake success when PHP is unavailable.
  getToken().catch(()=>{});
  function formError(form,message,fields={}) {
    const status=$('.form-status',form); status.className='form-status error';status.textContent=message;
    let first=null;
    Object.entries(fields).forEach(([name,message])=>{
      const field=form.elements.namedItem(name);
      if(field && typeof field.setCustomValidity==='function') {field.setCustomValidity(message);first??=field;}
    });
    if(first){first.reportValidity();first.focus();}else status.focus({preventScroll:true});
  }
  $$('.lead-form').forEach(form=>{
    form.addEventListener('input',event=>{if(event.target.setCustomValidity) event.target.setCustomValidity('');});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(form.dataset.pending==='true')return;
      if(form===quizForm && step!==4){$('#quiz-next').click();return;}
      const name=$('[name=name]',form), phone=$('[name=phone]',form), consent=$('[name=consent]',form);
      name.value=name.value.trim(); name.setCustomValidity(name.value.length<2?'Введите ваше имя.':'');
      phone.setCustomValidity(phoneDigits(phone.value).length!==10?'Введите 10 цифр телефона после +7.':'');
      consent.setCustomValidity(consent.checked?'':'Подтвердите согласие на обработку персональных данных.');
      if(!form.reportValidity())return;
      const status=$('.form-status',form), submit=$('[type=submit]',form);
      const label=submit.innerHTML;
      form.dataset.pending='true';form.setAttribute('aria-busy','true');submit.disabled=true;submit.textContent='Отправляем…';
      status.className='form-status';status.textContent='';
      try {
        const token=await getToken();
        const payload=new FormData(form);payload.set('csrf_token',token);payload.set('source',form.dataset.source);
        payload.set('attribution',JSON.stringify(attribution));
        if(form===quizForm) payload.set('quiz',JSON.stringify(answers));
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
        let response;
        try { response=await fetch(form.action,{method:'POST',body:payload,credentials:'same-origin',headers:{Accept:'application/json'},signal:controller.signal}); }
        finally {clearTimeout(timeout);}
        if(!(response.headers.get('Content-Type')||'').includes('application/json')) throw new Error('Сервер вернул непонятный ответ. Отправка не подтверждена. Позвоните нам: '+data.phone+'.');
        const result=await response.json();
        if(!response.ok || result.ok!==true || !result.receipt_id){
          if(result.error==='csrf_expired') {csrf='';await getToken(true);}
          formError(form,result.message||'Не удалось отправить заявку. Попробуйте позже или позвоните нам.',result.fields);return;
        }
        status.className='form-status success';
        status.textContent=`${result.message}\nНомер обращения: ${result.receipt_id}.`;
        status.focus({preventScroll:true});
        form.reset();
        if(form===quizForm) $$('.quiz-option input').forEach(input=>input.checked=answers[input.name]===input.value);
        if(data.metrikaId && analyticsChoice==='accepted' && typeof window.ym==='function') window.ym(data.metrikaId,'reachGoal','lead_sent',{form:form.dataset.source});
      }catch(error){
        formError(form,error.name==='AbortError'?'Сервер не ответил вовремя. Отправка не подтверждена: попробуйте ещё раз или позвоните нам.':error.message||'Не удалось связаться с сервером. Проверьте соединение.');
      }finally{
        form.dataset.pending='false';form.removeAttribute('aria-busy');submit.disabled=false;submit.innerHTML=label;
      }
    });
  });
  // Analytics is disabled until a real counter ID is configured and consent given.
  let analyticsChoice='';
  try{analyticsChoice=localStorage.getItem('sk-analytics-consent')||'';}catch{}
  const analyticsId=Number(data.metrikaId);
  function enableAnalytics(){
    if(!Number.isSafeInteger(analyticsId)||analyticsId<=0||$('#metrika-script'))return;
    window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments);};window.ym.l=Date.now();
    const script=document.createElement('script');script.id='metrika-script';script.async=true;script.src='https://mc.yandex.ru/metrika/tag.js';document.head.append(script);
    window.ym(analyticsId,'init',{clickmap:false,trackLinks:true,accurateTrackBounce:true,webvisor:false});
  }
  function chooseAnalytics(choice){
    analyticsChoice=choice;try{localStorage.setItem('sk-analytics-consent',choice);}catch{}
    $('#analytics-banner').hidden=true;
    if(choice==='accepted')enableAnalytics();
    else if($('#metrika-script')) location.reload();
  }
  if(Number.isSafeInteger(analyticsId)&&analyticsId>0){
    $('#analytics-settings').hidden=false;
    $('#analytics-banner').hidden=!!analyticsChoice;
    if(analyticsChoice==='accepted')enableAnalytics();
    $('#analytics-settings').addEventListener('click',()=>{$('#analytics-banner').hidden=false;$('#analytics-accept').focus();});
    $('#analytics-accept').addEventListener('click',()=>chooseAnalytics('accepted'));
    $('#analytics-decline').addEventListener('click',()=>chooseAnalytics('declined'));
  }
})();

document.querySelector('#rounded-order-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const answers = [
    ['product', 'Изделие'],
    ['dimensions', 'Размеры и форма'],
    ['wood', 'Древесина'],
    ['quantity', 'Количество'],
    ['delivery', 'Город и срок'],
    ['budget', 'Бюджет'],
  ];
  const data = new FormData(form);
  const body = answers
    .map(([key, label]) => [label, String(data.get(key) ?? '').trim()])
    .filter(([, value]) => value)
    .map(([label, value]) => label + ': ' + value)
    .join('\r\n');
  const subject = encodeURIComponent('Заказ элементов для парной');
  window.location.href = 'mailto:bani_so_vkusom@mail.ru?subject=' + subject + '&body=' + encodeURIComponent(body);
});
