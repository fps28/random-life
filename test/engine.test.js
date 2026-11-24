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
  function school(study) {
    const state=life.create(132);
    while(state.event!=='education') {
      const event=life.current(state);
      const options=event.choices.map((choice,index)=>({index,delta:choice.effects.study||0,choice}));
      options.sort((a,b)=>study?(b.delta-a.delta):(a.delta-b.delta));
      life.decide(state,options.find(o=>o.choice.allowed(state)).index);
    }
    return state;
  }
  const high=school(true);
  const low=school(false);
  assert.ok(high.study>=65&&low.study<65);
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
  while (!state.dead&&state.age<66) {
    const choices=life.current(state).choices;
    life.decide(state,choices.findIndex(c=>c.allowed(state)));
  }
  assert.ok(state.history.some(x=>x.age===66&&x.title==='Пенсионный резерв'));
});

test('512 полных жизней с восстановлением сохранения в каждом ходе',()=>{
  const seen=new Set();
  const ages=new Set();
  assert.equal(new Set(life.events.map(e=>e.id)).size,48);
  for(let i=0;i<512;i++) {
    let state=life.create(Math.imul(i,0x9e3779b9));
    let turn=0;
    while(!state.dead) {
      const event=life.current(state);
      const choices=event.choices.flatMap((choice,index)=>choice.allowed(state)?[index]:[]);
      assert.ok(choices.length>0);
      const index=choices[(i+turn)%choices.length];
      seen.add(event.id);
      const reloaded=life.load(JSON.stringify(state));
      assert.deepEqual(state,reloaded);
      assert.equal(life.decide(state,index),true);
      assert.equal(life.decide(reloaded,index),true);
      assert.deepEqual(state,reloaded);
      state=reloaded;
      assert.ok(++turn<=48);
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
  assert.equal(seen.size,life.events.length);
});

test('невалидное сохранение обрабатывается',()=>{
  for(const raw of ['broken','null','{}','{"version":2}']) assert.throws(()=>life.load(raw));
});
