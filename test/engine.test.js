'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const life=require('../web/engine');

test('случайное происхождение, родители и характеристики',()=>{
  const people=Array.from({length:300},(_,i)=>life.create(Math.imul(i,0x9e3779b9)));
  assert.equal(new Set(people.map(p=>p.region)).size,6);
  assert.equal(new Set(people.map(p=>p.tier)).size,3);
  assert.equal(new Set(people.map(p=>p.sex)).size,2);
  assert.ok(people.some(p=>p.sibling)&&people.some(p=>!p.sibling));
  for(const person of people) {
    assert.equal(person.age,0);
    assert.equal(person.born,life.location(person));
    assert.ok(person.mother&&person.father);
    for(const key of life.stats) assert.ok(person[key]>=0&&person[key]<=100);
  }
});

test('успеваемость в школьных событиях открывает университет',()=>{
  const high=Object.assign(life.create(132),{age:18,event:'education',study:72});
  const low=Object.assign(life.create(132),{age:18,event:'education',study:47});
  const before=JSON.stringify(low);
  assert.equal(life.decide(low,0),false);
  assert.equal(JSON.stringify(low),before);
  assert.equal(life.decide(high,0),true);
  assert.equal(high.edu,'В университете');
});

test('эмиграция требует накоплений и меняет страну',()=>{
  const state=Object.assign(life.create(12),{age:41,event:'emigration',cash:25,skill:70});
  assert.equal(life.decide(state,0),false);
  state.cash=26;
  const region=state.region;
  assert.equal(life.decide(state,0),true);
  assert.notEqual(state.region,region);
  assert.ok(state.history.some(line=>line.title==='Переезд'));
});

test('резерв выплачивается спустя несколько лет',()=>{
  const state=Object.assign(life.create(22),{age:60,event:'budget',cash:30});
  life.decide(state,0);
  assert.equal(state.reserve,true);
  life.proceed(state);
  while (!state.dead&&state.age<66) {
    const choices=life.current(state).choices;
    life.decide(state,choices.findIndex(c=>c.allowed(state)));
    life.proceed(state);
  }
  assert.ok(state.history.some(x=>x.age===66&&x.title==='Пенсионный резерв'));
});

test('512 полных жизней с восстановлением сохранения в каждом ходе',()=>{
  const seen=new Set();
  const ages=new Set();
  assert.equal(new Set(life.events.map(e=>e.id)).size,71);
  for(let i=0;i<512;i++) {
    let state=life.create(Math.imul(i,0x9e3779b9));
    let turn=0;
    while(!state.dead) {
      const event=life.current(state);
      const choices=event.choices.flatMap((choice,index)=>!life.blocked(state,event,choice)?[index]:[]);
      assert.ok(choices.length>0);
      const index=choices[(i+turn)%choices.length];
      seen.add(event.id);
      const reloaded=life.load(JSON.stringify(state));
      assert.deepEqual(state,reloaded);
      assert.equal(life.decide(state,index),true);
      assert.equal(life.decide(reloaded,index),true);
      assert.deepEqual(state,reloaded);
      assert.ok(state.receipt.text.startsWith(event.choices[index].outcome));
      assert.equal(state.receipt.age,state.age);
      assert.equal(life.decide(state,index),false);
      state=life.load(JSON.stringify(reloaded));
      assert.equal(life.proceed(state),true);
      assert.equal(life.proceed(state),false);
      assert.ok(++turn<=life.events.length);
      for(const key of life.stats) assert.ok(state[key]>=0&&state[key]<=100,key);
      assert.ok(state.cash>=0);
    }
    ages.add(state.age);
    assert.equal(state.event,null);
    assert.ok(state.age<=108);
    assert.equal(state.history.at(-1).title,'Конец жизни');
    assert.ok(life.biography(state).every(line=>typeof line==='string'&&line.length>0));
    assert.deepEqual(life.load(JSON.stringify(state)),state);
  }
  assert.ok(ages.size>20);
  assert.ok(seen.size>=65);
});

test('невалидное сохранение обрабатывается',()=>{
  for(const raw of ['broken','null','{}','{"version":2}']) assert.throws(()=>life.load(raw));
});

test('у всех сцен три или четыре стратегии с отдельными текстовыми исходами',()=>{
  for (const event of life.events) {
    assert.ok(event.body.length>=150,event.id);
    assert.ok(event.choices.length>=3&&event.choices.length<=4,event.id);
    assert.equal(new Set(event.choices.map(c=>c.outcome)).size,event.choices.length,event.id);
    assert.equal(new Set(event.choices.map(c=>JSON.stringify(c.effects))).size,event.choices.length,event.id);
    assert.ok(event.choices.every(c=>c.outcome.length>=65),event.id);
  }
});

test('старая запись об уходе с учёбы объясняет отказ работодателя',()=>{
  const old=Object.assign(life.create(24),{version:1,age:24,event:'job',edu:'Школьное',skill:31});
  delete old.receipt;
  old.history.push({age:22,title:'Последний семестр',detail:'Уйти на оплачиваемую работу'});
  const state=life.load(JSON.stringify(old));
  assert.equal(state.version,3);
  assert.equal(state.history.at(-1).choiceIndex,1);
  assert.equal(state.leftStudy,true);
  const job=life.current(state);
  assert.match(life.blocked(state,job,job.choices[0]),/ушёл до защиты/);
  assert.match(life.sceneText(state,job).join(' '),/без защиты/);
  assert.equal(life.decide(state,3),true);
  assert.equal(state.skill,41);
});

test('поддержка друга возвращается через несколько лет, а коротких звонков недостаточно',()=>{
  const event=life.events.find(e=>e.id==='friendback');
  for (const [choice,expected] of [[0,true],[1,false],[2,true]]) {
    const state=Object.assign(life.create(12),{age:39,event:'friendcall',cash:12,friend:true});
    assert.equal(life.decide(state,choice),true);
    state.age=41;
    assert.equal(event.when(state),false);
    state.age=42;
    assert.equal(event.when(state),expected);
  }
});

test('резерв и опыт для переезда объясняются через фактический баланс и дневник',()=>{
  const state=Object.assign(life.create(12),{age:45,event:'emigration',cash:10,skill:31,home:true});
  state.history.push({age:43,choice:'Купить квартиру',cashSpent:40});
  const event=life.current(state);
  const reason=life.blocked(state,event,event.choices[0]);
  assert.match(reason,/покупки квартиры/);
  assert.match(reason,/10/);
  assert.match(reason,/Купить квартиру/);
  assert.match(reason,/больше практики/);
});

test('отложенный осмотр влияет на здоровье до обращения за помощью',()=>{
  const state=Object.assign(life.create(8),{age:50,event:'checkup',cash:20});
  assert.equal(life.decide(state,1),true);
  assert.equal(state.skippedCheckup,true);
  const control=life.load(JSON.stringify(state));
  const chronic=life.load(JSON.stringify(state));
  for (const sample of [control,chronic]) {
    sample.age=51;
    sample.health=80;
    sample.seen=life.events.map(event=>event.id).filter(id=>id!=='care');
  }
  control.skippedCheckup=false;
  life.proceed(control);
  life.proceed(chronic);
  assert.equal(chronic.health,control.health-1);
  assert.equal(chronic.event,'care');
  assert.equal(life.decide(chronic,0),true);
  assert.equal(chronic.skippedCheckup,false);
  assert.equal(chronic.receipt.changes.cash,-7);
  assert.equal(chronic.receipt.changes.health,15);
});

test('отмена заказа касается своего дела, затем можно перейти на ставку',()=>{
  const state=Object.assign(life.create(29),{age:46,event:'venture',cash:70,skill:70});
  const follow=life.events.find(e=>e.id==='businesscheck');
  assert.equal(life.decide(state,0),true);
  state.age=49;
  assert.equal(follow.when(state),true);
  state.event='businesscheck';
  state.receipt=null;
  assert.equal(life.decide(state,1),true);
  assert.equal(state.wage,7);
  assert.equal(state.business,false);
  assert.equal(state.job,'Работа по найму');
});
