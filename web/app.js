'use strict';
const main=document.querySelector('#main');
const nav=document.querySelector('#nav');
const notice=document.querySelector('#status');
const key='random-life-save-v1';
let state=null;
let page='life';
let last='';
try {
  const saved=localStorage.getItem(key);
  if (saved) state=Life.load(saved);
} catch {
  notice.textContent='Сохранение не удалось загрузить. Можно начать новую жизнь.';
}
function element(tag, text, className) {
  const node=document.createElement(tag);
  if (text) node.textContent=text;
  if (className) node.className=className;
  return node;
}
function button(label, fn, type) {
  const node=element('button',label,type);
  node.type='button';
  node.addEventListener('click',fn);
  return node;
}
function save() {
  try {
    localStorage.setItem(key,JSON.stringify(state));
    notice.textContent='';
  } catch {
    notice.textContent='Не удалось записать прогресс. Он доступен до закрытия игры.';
  }
}
function start() {
  if (state && !state.dead && !window.confirm('Заменить текущее прохождение новой жизнью?')) return;
  state=Life.create();
  page='life';
  last='';
  save();
  render();
}
function list(rows) {
  const dl=element('dl');
  for (const [name,value] of rows) dl.append(element('dt',name),element('dd',String(value)));
  return dl;
}
function card(title) {
  const section=element('section','','card');
  section.append(element('h2', title));
  main.append(section);
  return section;
}
const labels={health:'Здоровье',mood:'Настроение',study:'Успеваемость',skill:'Навыки',
  social:'Связи',family:'Близость с семьёй',bond:'Отношения с партнёром',cash:'Деньги',wage:'Доход'};
function decision(index) {
  const before={...state};
  if (!Life.decide(state,index)) return;
  const changes=Object.entries(labels).flatMap(([field,label])=>{
    const delta=state[field]-before[field];
    return delta?[label+' '+(delta>0?'+':'')+delta]:[];
  });
  last=changes.join(' · ');
  save();
  render(true);
}
function render(focus=false) {
  main.replaceChildren();
  nav.hidden=!state;
  for (const item of nav.querySelectorAll('button')) {
    if (item.dataset.page===page) item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  }
  if (!state) {
    const intro=element('section','','intro');
    intro.append(element('h1','Случайная жизнь'),
      element('p','Место рождения и семья достаются случайно. Дальше многое зависит от твоих решений.','muted'),
      button('Начать жизнь',start,'primary'));
    main.append(intro);
    return;
  }
  const identity=element('div','','identity');
  const heading=element('h1',page==='profile'?'Персонаж':page==='history'?'Дневник':state.name);
  identity.append(element('div',state.age===0?'Рождение · '+state.year:'Возраст · '+state.age,'meta'),heading);
  main.append(identity);
  if (page==='history') {
    const timeline=element('ol','','timeline');
    for (const item of [...state.history].reverse()) {
      const entry=element('li');
      entry.append(element('small','Возраст · '+item.age,'meta'),
        element('p',item.title),element('p',item.detail,'muted'));
      timeline.append(entry);
    }
    main.append(timeline);
  } else if (page==='profile') {
    card('Происхождение').append(list([
      ['Имя',state.name],['Пол',state.sex],['Место рождения',state.born],['Сейчас',Life.location(state)],
      ['Мать',state.mother],['Отец',state.father],['В семье',state.sibling?'Двое детей':'Один ребёнок'],
      ['Доход семьи при рождении',Life.strata[state.tier]]]));
    card('Характеристики').append(list(Life.stats.filter(k=>k!=='bond'||state.partner).map(k=>[labels[k],state[k]+' / 100'])));
    card('Обстоятельства').append(list([
      ['Образование',state.edu],['Занятие',state.job],['Доход в год',state.wage+' ед.'],
      ['Накопления',state.cash+' ед.'],['Жильё',state.home?'Собственное':state.independent?'Аренда':'С семьёй'],
      ['Положение',Life.status(state)],['Отношения',state.married?'В браке':state.partner?'Есть партнёр':'Без партнёра'],
      ['Дети',state.children]]));
    main.append(button('Начать новую жизнь',start));
  } else if (state.dead) {
    const summary=card('Итоговая биография');
    for (const line of Life.biography(state)) summary.append(element('p',line));
    main.append(button('Начать новую жизнь',start,'primary'));
  } else {
    main.append(element('p',Life.location(state)+' · Накопления '+state.cash+' ед.','muted'));
    const event=Life.current(state);
    const scene=card(event.title);
    scene.append(element('p',event.body,'muted'));
    const choices=element('div','','choices');
    event.choices.forEach((choice,index)=>{
      const option=button(choice.label,()=>decision(index));
      option.disabled=!choice.allowed(state);
      if (option.disabled) option.append(element('small',choice.reason));
      choices.append(option);
    });
    scene.append(choices);
    if (last) main.append(element('p','После решения и течения времени · '+last,'muted'));
  }
  window.scrollTo(0,0);
  if (focus) {
    heading.tabIndex=-1;
    heading.focus({preventScroll:true});
  }
}
nav.addEventListener('click',event=>{
  const item=event.target.closest('button[data-page]');
  if (!item) return;
  page=item.dataset.page;
  render();
});
render();
