'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const life=require('../web/engine');

const score={
  cautious: fx=>(fx.health||0)*3+(fx.study||0)*2-(fx.debt||0)*2-
    (fx.caseDelay?70:0)-(fx.addiction||0)*14+(fx.illness==='treated'?30:0)+(fx.family||0),
  income: fx=>(fx.cash||0)*2+(fx.wage||0)*4+(fx.wageAdd||0)*5+
    (fx.debt||0)/4+(fx.business?20:0)+(fx.schoolLost?10:0),
  family: fx=>(fx.bond||0)*3+(fx.family||0)*3+(fx.social||0)+(fx.quietLife?23:0)+
    (fx.partner?45:0)+(fx.children?35:0)-(fx.split?100:0)+(fx.health||0),
  risky: fx=>(fx.cash||0)+(fx.debt||0)*2+(fx.addiction||0)*25+(fx.caseDelay?75:0)+
    (fx.illness==='ignored'?40:0)+(fx.betrayed?45:0)+(fx.schoolLost?30:0)+(fx.verdict==='plea'?30:0),
  learning: fx=>(fx.study||0)*2+(fx.skill||0)*2+(fx.graduate?45:0)+
    (fx.edu==='В университете'?40:0)-(fx.schoolLost?100:0),
  mixed: (_,index,s)=>Math.imul(s.rng ^ (index+1),2654435761)>>>0
};
function play(seed,strategy) {
  let s=life.create(seed);
  const choices=[];
  const flags=new Set();
  while(!s.dead) {
    const event=life.current(s);
    const available=event.choices.map((option,index)=>({option,index}))
      .filter(({option})=>!life.blocked(s,event,option));
    assert.ok(available.length,event.id);
    assert.ok(!s.prisonUntil,event.id);
    assert.ok(!(s.schoolLost&&['education','degree'].includes(event.id)),event.id);
    assert.ok(!(['union','child','crisis','discovery','betrayal'].includes(event.id)&&!s.partner),event.id);
    assert.equal(s.housing==='owned',Boolean(s.home),event.id);
    assert.ok(event.min<=s.age&&event.max>=s.age,event.id);
    available.sort((a,b)=>score[strategy](b.option.effects,b.index,s)-score[strategy](a.option.effects,a.index,s));
    choices.push(event.id);
    assert.equal(life.decide(s,available[0].index),true);
    for(const flag of ['schoolLost','record','disabled','bankrupt','estranged','prisonUntil','addiction','debt','quietLife']) {
      if(s[flag]) flags.add(flag);
    }
    if(s.wage===0&&s.age>=22&&s.age<60&&!s.edu.startsWith('В ')) flags.add('unemployed');
    assert.ok(s.cash>=0&&s.debt>=0);
    const saved=life.load(JSON.stringify(s));
    assert.deepEqual(saved,s);
    s=saved;
    assert.equal(life.proceed(s),true);
  }
  for(const item of s.history) {
    if(item.title==='Потеря жилья') flags.add('evicted');
    if(item.title==='Заключение') flags.add('prisonUntil');
    if(item.title==='На свободе') assert.ok(s.record);
    if(item.title==='Развод'||item.title==='Разрыв отношений') flags.add('estranged');
  }
  assert.ok(s.history.every((item,i)=>i===0||s.history[i-1].age<=item.age));
  assert.equal(s.history.at(-1).title,'Конец жизни');
  assert.equal(new Set(choices).size,choices.length);
  return {choices,flags,s};
}

test('240 жизней: 40 общих стартов и шесть стратегий',t=>{
  const lives=[];
  const strategyCounts={};
  let divergent=0;
  for(let i=0;i<40;i++) {
    const seed=Math.imul(i+1,0x9e3779b9);
    const paths=Object.keys(score).map(strategy=>{
      const result=play(seed,strategy);
      (strategyCounts[strategy]??=[]).push(result);
      return result;
    });
    if(new Set(paths.map(p=>p.choices.join(','))).size>=5) divergent++;
    lives.push(...paths);
  }
  const count=predicate=>lives.filter(predicate).length;
  const n=(flag)=>count(p=>p.flags.has(flag));
  const signatures=new Set(lives.map(p=>p.choices.join(',')));
  const sets=new Set(lives.map(p=>[...p.choices].sort().join(',')));
  const totals={
    lives:lives.length,sequences:signatures.size,eventSets:sets.size,divergentStarts:divergent,
    minScenes:Math.min(...lives.map(p=>p.choices.length)),maxScenes:Math.max(...lives.map(p=>p.choices.length)),
    minDeathAge:Math.min(...lives.map(p=>p.s.age)),maxDeathAge:Math.max(...lives.map(p=>p.s.age)),
    before40:count(p=>p.s.age<40),before65:count(p=>p.s.age<65),
    university:count(p=>p.s.edu==='Высшее'),noChildren:count(p=>!p.s.children),
    startedPoorEndedPoor:count(p=>p.s.tier===0&&p.s.age>=40&&p.s.cash<8),
    startedRichEndedPoor:count(p=>p.s.tier===2&&p.s.age>=40&&p.s.cash<8),
    comfortable:count(p=>p.s.age>=65&&p.s.mood>=65&&p.s.cash>=30&&!p.s.bankrupt),
    bankruptcy:n('bankrupt'),debt:n('debt'),eviction:n('evicted'),unemployment:n('unemployed'),
    record:n('record'),prison:n('prisonUntil'),disability:n('disabled'),breakup:n('estranged'),
    addiction:n('addiction'),schoolLost:n('schoolLost'),quiet:n('quietLife')
  };
  t.diagnostic(JSON.stringify(totals));
  t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(strategyCounts).map(([k,paths])=>
    [k,{bankruptcy:paths.filter(p=>p.flags.has('bankrupt')).length,education:paths.filter(p=>p.s.edu==='Высшее').length,
    record:paths.filter(p=>p.flags.has('record')).length,meanAge:Math.round(paths.reduce((n,p)=>n+p.s.age,0)/paths.length)}]))));
  assert.ok(totals.sequences>=220&&totals.eventSets>=220&&divergent>=34);
  assert.ok(totals.before40>0&&totals.before65>=10&&totals.comfortable>=20);
  assert.ok(totals.university>0&&totals.noChildren>=60&&totals.noChildren<=230);
  for(const name of ['bankruptcy','debt','eviction','unemployment','record','prison','disability','breakup','addiction','schoolLost','quiet']) {
    assert.ok(totals[name]>0,name);
  }
});

test('выпуск без аттестата, закрытая вакансия и альтернативный путь',()=>{
  let s=Object.assign(life.create(50),{age:17,event:'dropout',cash:5,study:40});
  assert.equal(life.decide(s,0),true);
  assert.equal(s.edu,'Без аттестата');
  s=life.load(JSON.stringify(s));
  assert.equal(life.proceed(s),true);
  assert.ok(s.age>=18);
  assert.notEqual(s.event,'education');
  const job=life.events.find(event=>event.id==='job');
  assert.match(life.blocked(s,job,job.choices[0]),/без аттестата/);
  s=Object.assign(s,{receipt:null,event:'returnschool',age:21,cash:9});
  assert.equal(life.decide(s,0),true);
  assert.equal(s.schoolLost,false);
  assert.equal(s.edu,'Школьное');
});

test('сохранение v2 сохраняет текущую сцену и экран результата',()=>{
  const s=life.create(31);
  life.decide(s,0);
  const old={...s,version:2,independent:true};
  delete old.debt;
  delete old.housing;
  delete old.news;
  const loaded=life.load(JSON.stringify(old));
  assert.equal(loaded.housing,'rent');
  assert.equal(loaded.debt,0);
  assert.deepEqual(loaded.receipt,s.receipt);
  assert.ok(life.proceed(loaded));
});

test('непогашенный долг приводит к потере жилья и блокирует следующий кредит',()=>{
  const s=Object.assign(life.create(75),{age:30,event:'loan',cash:0,wage:4,job:'Почасовая работа'});
  assert.ok(life.decide(s,0));
  s.cash=0;
  s.wage=0;
  s.job='Без работы';
  // Study the yearly outcomes without intervening discretionary choices.
  const world=require('../web/world');
  const report=(state,title)=>state.history.push({age:state.age,title});
  for (let i=0;i<6;i++) {
    s.age++;
    world.year(s,()=>.99,report,n=>Math.max(0,Math.min(100,n)));
  }
  assert.equal(s.bankrupt,true);
  assert.equal(s.debt,0);
  assert.ok(s.history.some(item=>item.title==='Просрочка'));
  assert.ok(s.history.some(item=>item.title==='Потеря жилья'));
  const loan=life.events.find(event=>event.id==='loan');
  assert.match(life.blocked(s,loan,loan.choices[1]),/банкротства/);
});

test('расследование может затихнуть, а приговор сохраняется и после срока',()=>{
  const world=require('../web/world');
  const report=(state,title)=>state.history.push({age:state.age,title});
  const clamp=n=>Math.max(0,Math.min(100,n));
  const start=Object.assign(life.create(81),{age:25,event:'offence',wage:4});
  assert.ok(life.decide(start,0));
  const clear={...start,age:28,history:[]};
  world.year(clear,()=>.99,report,clamp);
  assert.equal(clear.caseStatus,'closed');
  assert.equal(clear.record,false);
  const charged={...start,age:28,history:[],receipt:null};
  world.year(charged,()=>.1,report,clamp);
  assert.equal(charged.caseStatus,'trial');
  charged.event='trial';
  assert.ok(life.decide(charged,2));
  charged.age=29;
  world.year(charged,()=>.99,report,clamp);
  assert.equal(charged.prisonUntil,31);
  assert.equal(charged.wage,0);
  charged.age=31;
  world.year(charged,()=>.99,report,clamp);
  assert.equal(charged.prisonUntil,0);
  assert.equal(charged.record,true);
  assert.equal(charged.released,true);
});
