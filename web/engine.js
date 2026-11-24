(function (root) {
  const events = typeof module === 'undefined' ? root.LifeEvents : require('./events');
  const places = [
    ['Россия','Казань','Екатеринбург',['Артём','Михаил','Илья'],['Анна','София','Мария']],
    ['Япония','Осака','Нагоя',['Харуто','Рэн','Юта'],['Юи','Рин','Хина']],
    ['Испания','Валенсия','Севилья',['Матео','Пабло','Алехандро'],['Лусия','Альба','София']],
    ['Бразилия','Куритиба','Ресифи',['Лукас','Педру','Мигел'],['Ана','Жулия','Луиза']],
    ['Канада','Оттава','Галифакс',['Лиам','Оливер','Ноа'],['Эмма','Миа','Оливия']],
    ['Польша','Краков','Вроцлав',['Ян','Адам','Пётр'],['Зофья','Майя','Оливия']]
  ];
  const strata = ['Денег хватает только на необходимое','Стабильный доход','Семья с накоплениями'];
  const stats = ['health','mood','study','skill','social','family','bond'];
  const clamp = value => Math.max(0, Math.min(100,value));
  const roll = s => {
    s.rng = (Math.imul(s.rng,1664525) + 1013904223) >>> 0;
    return s.rng / 4294967296;
  };
  const range = (s,min,max) => min + Math.floor(roll(s)*(max-min+1));
  const pick = (s,list) => list[range(s,0,list.length-1)];
  const log = (s,title,detail) => s.history.push({age:s.age,title,detail});
  const location = s => places[s.region][s.city] + ', ' + places[s.region][0];
  const current = s => events.find(e=>e.id===s.event);
  function create(seed = Math.floor(Math.random()*4294967296)) {
    const s = {version:1,rng:seed>>>0,age:0,city:1,year:new Date().getFullYear(),history:[],seen:[],dead:false};
    s.region = range(s,0,places.length-1);
    const place = places[s.region];
    s.city = range(s,1,2);
    const male = roll(s)<0.5;
    const mother = pick(s,place[4]);
    const father = pick(s,place[3]);
    const tier = range(s,0,2);
    Object.assign(s,{
      sex: male?'Мужской':'Женский', name:pick(s,(male?place[3]:place[4]).filter(n=>n!==(male?father:mother))),
      mother,father,sibling:roll(s)<0.45,tier,born:location(s),
      health:range(s,65,92),mood:range(s,45,70),study:range(s,37,59),skill:range(s,5,20),
      social:range(s,28,49),family:range(s,43,62),bond:0,cash:0,wage:0,habit:0,
      children:0,edu:'Дошкольное',job:'Без работы',event:'birth',work:0,investmentAge:0
    });
    log(s,'Рождение',s.born + '. ' + strata[tier] + '.');
    return s;
  }
  function apply(s,effects) {
    for (const [key,value] of Object.entries(effects)) {
      if (stats.includes(key)) s[key]=clamp(s[key]+value);
      else if (key==='cash') s.cash=Math.max(0,s.cash+value);
      else if (key==='habit') s.habit+=value;
      else if (key==='wageAdd') s.wage=Math.max(0,s.wage+value);
      else if (key==='graduate') s.edu=s.edu==='В университете'?'Высшее':'Среднее профессиональное';
      else if (key==='split') Object.assign(s,{partner:false,married:false,bond:0});
      else if (key==='investment') s.investmentAge=s.age+4;
      else if (key==='move') {
        if (value==='local') s.city=s.city===1?2:1;
        else {
          s.region=(s.region+range(s,1,places.length-1))%places.length;
          s.city=1;
        }
        s.independent=true;
        log(s,'Переезд',location(s));
      } else s[key]=value;
    }
  }
  function end(s,cause) {
    s.dead=true;
    s.event=null;
    s.cause=cause;
    log(s,'Конец жизни',cause);
  }
  function advance(s) {
    while (!s.dead) {
      // Several eligible situations can occur in the same year.
      const eligible = events.filter(e=>s.age>=e.min&&s.age<=e.max&&!s.seen.includes(e.id)&&e.when(s));
      const deadline = eligible.find(e=>e.max===s.age);
      if (deadline || eligible.length) {
        s.event = (deadline || pick(s,eligible)).id;
        return;
      }
      s.age++;
      if (s.age===6) s.edu='В школе';
      if (s.age===18) {
        s.cash+= [4,9,17][s.tier];
        log(s,'Семейная поддержка','Стартовый бюджет вырос на '+[4,9,17][s.tier]+' ед.');
      }
      if (s.age>18) {
        const expenses = (s.home||!s.independent?1:3)+(s.children&&s.age<55?2:0);
        const balance = s.cash+s.wage-expenses;
        s.cash = Math.max(0,balance);
        if (s.wage>0&&s.age<=65) s.work++;
        if (balance<0&&s.independent) s.mood=clamp(s.mood-1);
      }
      if (s.age===s.investmentAge) {
        const payout = roll(s)<Math.min(.8,.25+s.skill/180)?30:0;
        s.cash+=payout;
        log(s,'Итог вложения', payout?'Кафе принесло 30 ед.':'Кафе закрылось. Вложение потеряно.');
      }
      if (s.age===66&&s.reserve) {
        s.cash+=30;
        log(s,'Пенсионный резерв','К накоплениям прибавилось 30 ед.');
      }
      if (s.age>=48) {
        const decline=(s.age>=74?2:1)-(s.age%3===0&&s.habit>0?1:0);
        s.health=clamp(s.health-decline);
      }
      const risk = s.age<57 ? 0 : Math.max(0,(s.age-68)*.0025)+Math.max(0,55-s.health)*.0015;
      if (s.age>=108 || s.health===0 || (risk>0&&roll(s)<risk)) {
        end(s,s.health<35?'Здоровье постепенно ухудшилось.':'Жизнь завершилась в пожилом возрасте.');
      }
    }
  }
  function decide(s,index) {
    const event=current(s);
    const option=event?.choices[index];
    if (!option||!option.allowed(s)) return false;
    log(s,event.title,option.label);
    apply(s,option.effects);
    s.seen.push(event.id);
    advance(s);
    return true;
  }
  function load(raw) {
    const s=JSON.parse(raw);
    if (!s || s.version!==1 || !Number.isInteger(s.age)|| s.age<0 || s.age>108 ||
        !Number.isInteger(s.rng)|| !places[s.region] || ![1,2].includes(s.city) ||
        !Array.isArray(s.history)|| !Array.isArray(s.seen)|| !stats.every(key=>Number.isFinite(s[key])) ||
        !Number.isFinite(s.cash)|| typeof s.edu!=='string'|| typeof s.name!=='string'||
        (s.dead?s.event!==null:!current(s))) throw new Error('Сохранение повреждено или несовместимо.');
    return s;
  }
  const status = s => s.cash>=90 ? 'Обеспеченность' : s.social>=70 ? 'Широкий круг общения' :
    s.cash<8&&s.age>=18 ? 'Ограниченный бюджет' : 'Умеренный достаток';
  const biography = s => [
    s.name + ' · ' + s.age + ' лет жизни',
    'Место рождения — '+s.born+'. Последнее место жительства — '+location(s)+'.',
    'Образование — '+s.edu.toLowerCase()+'. Оплачиваемая работа до 65 лет — '+s.work+' лет.',
    'Семья — '+(s.married?'брак':s.partner?'есть партнёр':'без партнёра')+', детей — '+s.children+'.',
    'Накопления — '+s.cash+' ед. '+(s.home?'Осталось собственное жильё.':''),
    ...s.history.filter(item=>['Переезд','Итог вложения'].includes(item.title))
      .map(item=>'В возрасте '+item.age+' лет · '+item.detail),
    s.cause
  ];
  const api = {events,places,strata,stats,create,current,decide,load,location,status,biography};
  if (typeof module !== 'undefined') module.exports=api;
  else root.Life=api;
})(globalThis);
