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
  const decisionFields = [...stats,'cash','wage'];
  const prior = (s,id) => s.history.find(item=>item.eventId===id);
  const sceneContext = {
    birth: s => s.tier===0 ? 'В семейном бюджете сейчас почти нет запаса, и лишняя пара рук могла бы пригодиться.' :
      s.sibling ? 'В соседней комнате уже спит старший ребёнок. Родители стараются сохранить и его привычный распорядок.' : '',
    education: s => s.study>=65 ? 'Твои выпускные результаты подходят и для подачи документов в университет.' :
      'По выпускным результатам проще рассчитывать на колледж или работу с обучением на месте.',
    exam: s => s.study<48 ? 'На последней контрольной ты оставил несколько задач пустыми. Летнее расписание может это изменить.' : '',
    movehome: s => s.wage>0 ? 'Первый заработок делает переезд реальным, но теперь надо решить, сколько дохода отдавать за комнату.' : '',
    degree: s => s.independent ? 'Аренду нужно платить и в месяцы, когда всё время отнимает учёба.' : '',
    job: s => s.leftStudy ? 'Учёба осталась без защиты. В резюме сейчас проще опереться на опыт, который дали первые смены.' :
      s.edu==='Высшее' ? 'Ты уже можешь приложить диплом к отклику на работу специалиста.' :
      s.edu==='Среднее профессиональное' ? 'Практику из колледжа можно показать на собеседовании, даже если потребуется ещё чему-то научиться.' : '',
    friendcall: s => prior(s,'friend')?.choiceIndex===2 ? 'На экране всё ещё то самое имя: вместе вы когда-то возились над одним проектом вечерами.' : '',
    rent: s => s.children ? 'В семейном бюджете уже есть расходы на ребёнка. Пересчёт аренды затрагивает и их.' : '',
    child: s => s.married ? 'После регистрации брака обсуждать общие расходы стало привычнее. Этот разговор всё равно даётся иначе.' : '',
    promotion: s => s.network ? 'Твою работу помнят со стажировки. Один из тех, кто знает тебя с тех пор, готов поручиться.' : '',
    relocation: s => s.home ? 'В нынешнем городе у тебя своя квартира. Её судьба тоже входит в решение.' : '',
    burnout: s => s.job==='Руководитель' ? 'После повышения вопросы, которые вечером можно было оставить на завтра, чаще остаются за тобой.' : '',
    crisis: s => s.children ? 'После семейных дел свободные вечера стали редкостью, и каждому кажется, что другой давно это принял.' : '',
    venture: s => s.edu==='Школьное'&&s.skill>=50 ? 'Заказчик смотрел на твои работы. Навыков, которые ты набрал на практике, хватило для этого разговора.' : '',
    parents: s => s.region!==places.findIndex(place=>s.born.endsWith(', '+place[0])) ?
      'Вы уже давно живёте в разных странах. Даже короткий визит придётся планировать заранее.' : '',
    care: s => s.skippedCheckup ? 'Вспоминается осмотр, который ты отложил. С тех пор самочувствие всё ещё приходится подстраивать под дела.' :
      s.habit ? 'Привычный распорядок помогает держаться, но устаёшь быстрее, чем несколько лет назад.' : '',
    retire: s => s.reserve ? 'Часть денег уже отложена отдельно. Она пополнит доступный запас в следующем году.' : '',
    grand: s => prior(s,'childtime')?.choiceIndex===1 ? 'Ребёнок помнит, как часто за выходные тебе приходилось держаться за рабочие смены. Сегодня он заранее предлагает выбрать время вместе.' : '',
    repair: s => prior(s,'home')?.choiceIndex===0 ? 'Ты вспоминаешь шум воды на осмотре. Теперь эту часть квартиры тоже приходится брать на себя.' : ''
  };
  function sceneText(s,event=current(s)) {
    const context=sceneContext[event.id]?.(s);
    return context ? [event.body,context] : [event.body];
  }
  function blocked(s,event,option) {
    if (option.allowed(s)) return '';
    const {effects}=option;
    const reasons=[];
    if (event.id==='education') {
      const exams=prior(s,'exam');
      reasons.push(exams?.choiceIndex===1 ? 'Летом ты работал, и часть тем осталась без подготовки. Итоговых баллов университету не хватает.' :
        'По выпускным результатам ты не проходишь университетский отбор.');
      reasons.push('Сейчас доступны колледж и работа. Позже можно набрать практический опыт и повысить квалификацию на курсах.');
    }
    if (event.id==='job') reasons.push(s.leftStudy ?
      'Ты ушёл до защиты, поэтому диплома нет. Опыт пока тоже не заменяет его. Практическая работа и вечерние курсы помогут набрать нужные навыки.' :
      'Работодатель просит вузовский диплом или более уверенный практический опыт. Его можно набрать на работе с обучением и на вечерних курсах.');
    if (event.id==='promotion') reasons.push('Для руководящей роли не хватает опыта или рекомендации от человека, который видел твою работу. Попробуй начать с отдельного проекта.');
    if (effects.move&&s.home) reasons.push('После покупки квартиры деньги связаны с жильём. Продать или сдать его к сроку этого предложения ты не успеешь.');
    if (effects.move==='foreign'&&s.skill<45) reasons.push('Команда за границей ждёт больше практики. Короткий заказ из дома позволит попробовать похожую работу.');
    if (event.id==='venture'&&effects.business&&s.skill<50) reasons.push('Заказчик ждёт, что ты самостоятельно справишься со всем объёмом. Пробная задача позволит набрать опыт без увольнения.');
    if ((effects.married&&s.bond<25)||(effects.children&&s.bond<28)) reasons.push(
      'Партнёр пока не готов к такому шагу. Вам пока проще говорить о ближайших встречах. Обсуждение денег и быта поможет понять, чего каждый ждёт.');
    if (effects.cash<0&&s.cash<-effects.cash) {
      reasons.push('На этот шаг нужно '+(-effects.cash)+' ед., а в запасе сейчас '+s.cash+'.');
      const recent=[...s.history].reverse().find(item=>item.cashSpent>0 && s.age-item.age<=5);
      if (recent) reasons.push('Одна из недавних трат — «'+recent.choice+'» ('+recent.cashSpent+' ед.).');
      reasons.push(effects.move?'Можно остаться и пополнить запас работой, даже если это предложение уйдёт.' :
        'Выбери способ без этой траты или с меньшими расходами, чтобы сохранить запас на будущее.');
    }
    return reasons.join(' ') || option.reason;
  }
  function create(seed = Math.floor(Math.random()*4294967296)) {
    const s = {version:2,receipt:null,rng:seed>>>0,age:0,city:1,year:new Date().getFullYear(),history:[],seen:[],dead:false};
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
        const decline=(s.age>=74?2:1)-(s.age%3===0&&s.habit>0?1:0)
          +(s.skippedCheckup&&s.age%4===0?1:0);
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
    if (s.dead||s.receipt||!option||!option.allowed(s)) return false;
    const before={...s};
    const historyIndex=s.history.length;
    apply(s,option.effects);
    const changes={};
    for (const field of decisionFields) {
      const amount=s[field]-before[field];
      if (amount) changes[field]=amount;
    }
    s.history.splice(historyIndex,0,{
      age:s.age,title:event.title,detail:option.outcome,eventId:event.id,
      choice:option.label,choiceIndex:index,cashSpent:Math.max(0,-(changes.cash||0))
    });
    s.seen.push(event.id);
    s.receipt={eventId:event.id,age:s.age,title:event.title,choice:option.label,text:option.outcome,changes};
    return true;
  }
  function proceed(s) {
    if (!s.receipt) return false;
    s.receipt=null;
    advance(s);
    return true;
  }
  function load(raw) {
    const s=JSON.parse(raw);
    if (!s || ![1,2].includes(s.version) || !Number.isInteger(s.age)|| s.age<0 || s.age>108 ||
        !Number.isInteger(s.rng)|| !places[s.region] || ![1,2].includes(s.city) ||
        !Array.isArray(s.history)|| !Array.isArray(s.seen)|| !stats.every(key=>Number.isFinite(s[key])) ||
        !Number.isFinite(s.cash)|| typeof s.edu!=='string'|| typeof s.name!=='string'||
        (s.dead?s.event!==null:!current(s))) throw new Error('Сохранение повреждено или несовместимо.');
    if (s.version===1) {
      s.history=s.history.map(item=>{
        const event=events.find(e=>e.title===item.title);
        const choiceIndex=event?.choices.findIndex(choice=>choice.label===item.detail);
        if (!(choiceIndex>=0)) return item;
        return {...item,eventId:event.id,choice:item.detail,choiceIndex};
      });
      s.leftStudy=prior(s,'degree')?.choiceIndex===1;
      s.skippedCheckup=prior(s,'checkup')?.choiceIndex===1 && !prior(s,'care');
      s.friendTrust=prior(s,'friendcall')?.choiceIndex===0;
      s.business=prior(s,'venture')?.choiceIndex===0 && s.job==='Своё дело';
      s.receipt=null;
      s.version=2;
    }
    if (s.receipt!==null && (!s.receipt||s.dead||s.receipt.eventId!==s.event||
        s.receipt.age!==s.age||typeof s.receipt.title!=='string'||typeof s.receipt.choice!=='string'||
        typeof s.receipt.text!=='string'||!s.receipt.changes||!s.seen.includes(s.event))) {
      throw new Error('Сохранение содержит повреждённую сцену.');
    }
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
    ...s.history.filter(item=>['Переезд','Итог вложения'].includes(item.title)||
      ['friendback','businesscheck'].includes(item.eventId))
      .map(item=>'В возрасте '+item.age+' лет · '+item.detail),
    s.cause
  ];
  const api = {events,places,strata,stats,create,current,decide,proceed,sceneText,blocked,load,location,status,biography};
  if (typeof module !== 'undefined') module.exports=api;
  else root.Life=api;
})(globalThis);
