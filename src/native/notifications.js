import {LocalNotifications} from '@capacitor/local-notifications';
import {addMonths,curMonth,monthDate,today,validDate} from '../core/dates.js';
import {normalizeReminderModes,reminderError,reminderNotificationTime,reminderOccurrencesForDueDate} from '../core/reminders.js';
import {S,houseRentDir,tenantProfiles} from '../data/state.js';
import {platform} from './platform.js';

const CHANNEL='bill-reminders';
let channelCreated=false,syncRunning=null,syncPending=false;

export async function requestNotificationPermission(){
  if(!platform.isNative)return true;
  let status=await LocalNotifications.checkPermissions();
  if(status.display!=='granted')status=await LocalNotifications.requestPermissions();
  return status.display==='granted';
}

function monthlyKeys(){
  const start=curMonth(),keys=[];
  for(let offset=0;offset<13;offset++)keys.push(addMonths(start,offset));
  return keys;
}

function recordsInPeriod(cat,period,match){
  return S.records.find(r=>r.cat===cat&&(r.period||r.date.slice(0,7))===period&&match(r));
}

function remindersFromRecord(record,title,dueDate,defaults){
  if(record.status!=='due'||!validDate(dueDate))return[];
  const x=record.x||{},selection=x.reminder===undefined?defaults&&defaults.reminder:x.reminder;
  const modes=normalizeReminderModes(selection),day=x.reminderDay===undefined?defaults&&defaults.reminderDay:x.reminderDay;
  const time=x.reminderTime===undefined?defaults&&defaults.reminderTime:x.reminderTime;
  const error=reminderError(dueDate,modes,day,time);
  if(error)return[];
  return reminderOccurrencesForDueDate(dueDate,modes,day).map(occurrence=>({
    key:record.id+':'+dueDate+':'+occurrence.mode,title,dueDate,mode:occurrence.mode,day,time,occurrence
  }));
}

function addRecurringReminder(items,key,title,dueDate,selections,day,time){
  const modes=normalizeReminderModes(selections);
  if(!validDate(dueDate)||reminderError(dueDate,modes,day,time))return;
  for(const occurrence of reminderOccurrencesForDueDate(dueDate,modes,day)){
    items.push({key:key+':'+dueDate+':'+occurrence.mode,title,dueDate,mode:occurrence.mode,day,time,occurrence});
  }
}

function collectReminders(){
  const items=[];
  for(const record of S.records){
    if(record.status!=='due')continue;
    const x=record.x||{};
    let defaults=null,dueDate='';
    if(record.cat==='mobilebill'){
      defaults=S.mobileBills.find(p=>p.id===record.mobileBillId)||null;
      dueDate=x.dueDate||'';
    }else if(record.cat==='rent'){
      const house=S.houses.find(h=>h.id===record.houseId)||S.houses.find(h=>h.name===(record.party||''));
      const tenant=record.dir==='received'?tenantProfiles(house).find(t=>t.name===record.tenant):null;
      defaults=tenant||house;
      dueDate=validDate(record.date)?record.date:'';
      const dueBy=x.dueBy||defaults&&defaults.dueBy;
      const dueDay=dueBy==='first'?1:dueBy==='seventh'?7:x.dueDay||defaults&&defaults.dueDay;
      if(Number.isInteger(dueDay)&&record.period){
        dueDate=monthDate(record.period,dueDay);
      }
    }else dueDate=x.due||'';
    items.push(...remindersFromRecord(record,(record.party||record.title||record.cat||'Bill')+' bill',dueDate,defaults));
  }

  const periods=monthlyKeys();
  for(const profile of S.mobileBills){
    for(const period of periods){
      const record=recordsInPeriod('mobilebill',period,r=>r.mobileBillId===profile.id);
      if(record)continue;
      addRecurringReminder(items,'mobile:'+profile.id,profile.name+' mobile bill',monthDate(period,profile.dueDay),profile.reminder,profile.reminderDay,profile.reminderTime);
    }
  }

  for(const house of S.houses){
    const direction=houseRentDir(house);
    if(direction==='paid'&&Number.isInteger(house.rentAmountP)&&house.rentAmountP>0){
      for(const period of periods){
        const record=recordsInPeriod('rent',period,r=>r.dir==='paid'&&(r.houseId===house.id||r.party===house.name));
        if(record)continue;
        const dueDay=house.dueBy==='seventh'?7:house.dueBy==='custom'?house.dueDay:1;
        addRecurringReminder(items,'rent:'+house.id,house.name+' rent',monthDate(period,dueDay),house.reminder,house.reminderDay,house.reminderTime);
      }
    }else if(direction==='received'){
      for(const tenant of tenantProfiles(house)){
        if(!Number.isInteger(tenant.rentAmountP)||tenant.rentAmountP<=0)continue;
        for(const period of periods){
          const record=recordsInPeriod('rent',period,r=>r.dir==='received'&&r.tenant===tenant.name&&(r.houseId===house.id||r.party===house.name));
          if(record)continue;
          const dueDay=tenant.dueBy==='seventh'?7:tenant.dueBy==='custom'?tenant.dueDay:1;
          addRecurringReminder(items,'rent:'+house.id+':'+tenant.name,tenant.name+' rent · '+house.name,monthDate(period,dueDay),tenant.reminder,tenant.reminderDay,tenant.reminderTime);
        }
      }
    }
  }
  return items;
}

function notificationId(key,used){
  let hash=2166136261;
  for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619);}
  let id=(hash>>>0)&0x7fffffff;
  if(!id)id=1;
  while(used.has(id))id=id===0x7fffffff?1:id+1;
  used.add(id);
  return id;
}

async function syncNow(){
  if(!platform.isNative)return;
  const pending=await LocalNotifications.getPending();
  const old=pending.notifications.filter(n=>n.extra&&n.extra.expensesBillReminder===true);
  if(old.length)await LocalNotifications.cancel({notifications:old.map(n=>({id:n.id}))});

  const permission=await LocalNotifications.checkPermissions();
  if(permission.display!=='granted')return;
  if(!channelCreated){await LocalNotifications.createChannel({id:CHANNEL,name:'Bill reminders',description:'Due date reminders for bills'});channelCreated=true;}

  const todayDate=today(),used=new Set(),notifications=[];
  for(const item of collectReminders()){
    const target=item.mode==='overdue'&&item.occurrence.date<todayDate?todayDate:item.occurrence.date;
    if(target<todayDate)continue;
    const at=reminderNotificationTime(target,item.time,item.occurrence.repeatDaily);
    if(!at)continue;
    const dueLabel=item.dueDate.split('-').reverse().join('/');
    notifications.push({
      id:notificationId(item.key+':'+item.mode,used),
      title:item.title,
      body:item.mode==='overdue'?'This bill is overdue. Due date: '+dueLabel+'.':'This bill is due on '+dueLabel+'.',
      channelId:CHANNEL,
      schedule:item.occurrence.repeatDaily?{at:at,every:'day'}:{at:at},
      isExactNotification:false,
      extra:{expensesBillReminder:true,key:item.key}
    });
  }
  if(notifications.length)await LocalNotifications.schedule({notifications});
}

export function syncBillNotifications(){
  syncPending=true;
  if(!syncRunning){
    syncRunning=(async()=>{
      while(syncPending){syncPending=false;await syncNow();}
    })().finally(()=>{syncRunning=null;});
  }
  return syncRunning;
}
