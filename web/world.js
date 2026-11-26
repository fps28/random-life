(function (root) {
  // Abstract game profiles, in the same order as the birth countries.
  const regions=[
    {cost:0,growth:.96,aid:1,shock:.035}, {cost:1,growth:1.12,aid:2,shock:.022},
    {cost:0,growth:1.02,aid:2,shock:.030}, {cost:-1,growth:.88,aid:0,shock:.049},
    {cost:2,growth:1.22,aid:2,shock:.025}, {cost:0,growth:1.03,aid:1,shock:.031}
  ];
  const defaults={
    debt:0,arrears:0,housing:'family',caseAge:0,caseStatus:null,debtOrigin:null,
    illness:null,disabled:false,addiction:0,record:false,prisonUntil:0,
    marketAge:0,vulnerability:0,familyShock:false,nextScene:0
  };
  function init(s,roll,fresh=false) {
    for (const [key,value] of Object.entries(defaults)) if (!(key in s)) s[key]=value;
    s.news ||= [];
    if (fresh) {
      s.vulnerability=Math.floor(roll(s)*3);
      s.familyShock=roll(s)<[.55,.27,.14][s.tier];
    } else {
      s.housing=s.home?'owned':s.independent?'rent':'family';
      s.vulnerability=s.rng%3;
    }
  }
  function insolvency(s) {
    const owned=s.home;
    s.cash=Math.min(s.cash,3);
    Object.assign(s,{debt:0,arrears:0,bankrupt:true,restructured:false,home:false});
    if (owned||s.housing==='rent') Object.assign(s,{housing:'lost',independent:true});
    if (['Работа на себя','Своё дело'].includes(s.job)) Object.assign(s,{business:false,job:'Без работы',wage:0});
  }
  function finances(s,profile,roll,report) {
    if (s.age<=18) return;
    if (s.prisonUntil) {
      s.debt+=s.debt>0?1:0;
      return;
    }
    let gross=Math.round(s.wage*profile.growth);
    if (s.job==='Временные смены'||s.job==='Работа на себя'||s.job==='Своё дело') {
      gross=Math.max(0,gross+Math.floor(roll(s)*7)-4);
    }
    if (s.marketAge>0&&s.age-s.marketAge<=3) gross=Math.max(0,gross-(s.job==='Работа на себя'?4:2));
    if (s.wage===0) gross+=s.age>=65?2:profile.aid;
    const rent={family:2,owned:3,rent:6,shelter:2,lost:3}[s.housing];
    const expenses=Math.max(1,rent+profile.cost)+(s.children&&s.age<56?2:0)+s.addiction+(s.disabled?1:0);
    const balance=s.cash+gross-expenses;
    s.cash=Math.max(0,balance);
    const installment=Math.min(s.debt,s.restructured?2:5);
    if (installment>0&&s.cash>=installment) {
      s.cash-=installment;
      s.debt-=installment;
      s.arrears=Math.max(0,s.arrears-1);
      if (!s.debt) report(s,'Последний платёж','Ты закрываешь долг. Следующий год снова можно планировать без банковского взноса.');
    } else if (installment>0) {
      s.debt+=2;
      s.arrears++;
      if (s.arrears===1) report(s,'Просрочка','После обычных расходов денег на взнос не хватило. Банк начисляет просрочку, и общий долг растёт.');
    }
    if (s.wage>0&&s.age<=65) s.work++;
    s.rentMissed=s.housing==='rent'&&balance<0?(s.rentMissed||0)+1:0;
    if (s.rentMissed>=2) {
      s.housing='lost';
      report(s,'Потеря жилья','После двух лет с неоплаченными расходами хозяин расторгает договор. По старому адресу жить больше нельзя.');
    }
    if (s.housing==='lost'&&s.seen.includes('evicted')) {
      s.housing='shelter';
      report(s,'Временная крыша','Постоянного адреса снова нет. На этот раз получается найти только место во временном жилье.');
    }
    if (s.arrears>=5) {
      insolvency(s);
      report(s,'Банкротство','Договориться о платежах не удалось. Остаток долга списан после расчёта с кредиторами, возможность брать новые кредиты потеряна.');
    }
    if (balance<0) s.mood=Math.max(0,s.mood-2);
  }
  function legal(s,roll,report) {
    if (s.caseAge===s.age) {
      if (roll(s)<.62) {
        s.caseStatus='trial';
        report(s,'Расследование','Проверка документов дошла до твоей подписи. Тебя вызывают в суд.');
      } else {
        s.caseStatus='closed';
        report(s,'Проверка закончилась','Запрос о старой подписи больше не приходит. Дело закрывают без предъявления обвинения.');
      }
    }
    if (s.verdictAge===s.age) {
      const conviction=s.verdict==='plea'?1:s.verdict==='defence'?.43:.68;
      s.caseStatus='closed';
      if (roll(s)<conviction) {
        s.record=true;
        if (s.verdict!=='plea'&&roll(s)<.35) {
          s.cash=Math.max(0,s.cash-10);
          report(s,'Обвинительный приговор','Суд назначает штраф. Тюремного срока нет, но судимость остаётся в биографии.');
        } else {
          const term=s.verdict==='plea'?2:2+Math.floor(roll(s)*3);
          s.prisonUntil=s.age+term;
          Object.assign(s,{wage:0,job:'В заключении',business:false,network:false});
          report(s,'Заключение','Суд назначает срок: '+term+' г. Прежний источник заработка исчезает.');
        }
      } else report(s,'Оправдание','Суд не находит оснований для обвинительного приговора. Судимости нет.');
    }
    if (s.prisonUntil&&s.age>=s.prisonUntil) {
      Object.assign(s,{prisonUntil:0,job:'Без работы',released:true});
      report(s,'На свободе','Срок заканчивается. Часть вакансий теперь закрыта из-за судимости, поэтому работу придётся искать заново.');
    }
  }
  function health(s,roll,report,clamp) {
    if (s.age>=12&&s.age<=74&&roll(s)<.004) {
      if (roll(s)<.23) return 'Жизнь оборвалась из-за несчастного случая.';
      s.health=clamp(s.health-16);
      if (roll(s)<.28) {
        s.disabled=true;
        s.illness=s.illness||'treated';
        report(s,'После несчастного случая','Ты выжил после несчастного случая. Некоторые функции не восстановились, и привычный распорядок теперь придётся менять.');
      } else report(s,'Несчастный случай','После травмы обычные дела даются тяжелее. На восстановление нужно время.');
    }
    if (!s.illness&&s.age>=15&&s.age<=70&&roll(s)<.003+.003*s.vulnerability+
        (100-s.health)*.00017+(s.skippedCheckup?.007:0)) {
      s.illness='symptoms';
      s.symptomAge=s.age;
    }
    if (s.illness==='waiting'&&s.age-s.symptomAge>=2&&roll(s)<.55) {
      s.illness='treated';
      report(s,'Дошла очередь','Обследование подтверждает болезнь. Ты начинаешь лечение; дальше многое зависит от того, как восстановится организм.');
    }
    if (s.illness==='symptoms'&&s.age-s.symptomAge>=2) s.illness='ignored';
    if (s.illness==='ignored'||s.illness==='waiting') {
      s.health=clamp(s.health-5);
      if (!s.disabled&&roll(s)<(100-s.health)*.002) {
        s.disabled=true;
        if (!s.prisonUntil) Object.assign(s,{wage:0,job:'Без работы',business:false});
        report(s,'Болезнь меняет привычную жизнь','Состояние ухудшается. После лечения остаются стойкие ограничения, а прежнюю нагрузку выдерживать уже невозможно.');
      }
    }
    if (s.illness==='treated'&&s.age%4===0) s.health=clamp(s.health-1);
    if (s.addiction) s.health=clamp(s.health-s.addiction*2);
    const decline=s.age>=48?(s.age>=74?2:1)-(s.age%3===0&&s.habit>0?1:0)+(s.skippedCheckup&&s.age%4===0?1:0):0;
    s.health=clamp(s.health-decline);
    const risk=Math.max(0,(s.age-68)*.0025)+Math.max(0,32-s.health)*.006;
    if (s.health===0 || (risk>0&&roll(s)<risk)) return s.illness||s.health<35?
      'Жизнь закончилась после ухудшения здоровья.':'Жизнь завершилась в пожилом возрасте.';
    if (s.age>=108) return 'Жизнь завершилась в пожилом возрасте.';
    return '';
  }
  function year(s,roll,report,clamp) {
    const profile=regions[s.region];
    legal(s,roll,report);
    if (s.age>=28&&s.age<=54&&!s.marketAge&&roll(s)<profile.shock) {
      s.marketAge=s.age;
      report(s,'Работы в округе стало меньше','Компании замораживают найм, а часть заказов отменяют. В ближайшие годы на заработок рассчитывать сложнее.');
    }
    finances(s,profile,roll,report);
    if (s.contactsSearch&&!s.prisonUntil&&s.wage===0) {
      s.contactsSearch=false;
      if (roll(s)<.22+s.social/160) {
        Object.assign(s,{job:'Работа по рекомендации',wage:6});
        report(s,'Звонок с предложением','Один из знакомых вспоминает о свободном месте. После собеседования тебя берут на работу.');
      } else report(s,'Ответа не хватило','Знакомые отозвались, но работы по их рекомендациям пока нет.');
    }
    if (s.partner) {
      const erosion=(s.wage>=11?2:0)+(s.addiction>=2?s.addiction:0)+(s.prisonUntil?3:0);
      s.bond=clamp(s.bond-erosion);
      if (s.bond<=8&&roll(s)<.44) {
        const married=s.married;
        Object.assign(s,{partner:false,married:false,bond:0,betrayed:false,estranged:true,mood:clamp(s.mood-12)});
        report(s,married?'Развод':'Разрыв отношений','После месяцев отчуждения партнёр прекращает отношения. Фотографии остаются, а прежней совместной жизни больше нет.');
      }
    }
    if (s.quietLife&&s.age%3===0) s.mood=clamp(s.mood+2);
    return health(s,roll,report,clamp);
  }
  const api={init,year,insolvency};
  if (typeof module!=='undefined') module.exports=api;
  else root.LifeWorld=api;
})(globalThis);
