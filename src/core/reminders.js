import {monthDate,validDate} from './dates.js';

export const REMINDER_MODES=['3days','1day','due','overdue','custom'];
export const DEFAULT_REMINDER_TIME='10:00';
export const REMINDER_OPTIONS=[
  ['3days','3 days before'],
  ['1day','1 day before'],
  ['due','On the due date'],
  ['overdue','Daily while overdue'],
  ['custom','Custom day of month']
];

export function reminderTimeOrDefault(value){
  return value===undefined||value===null?DEFAULT_REMINDER_TIME:value;
}

export function validReminderTime(value){
  return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeReminderModes(value){
  if(Array.isArray(value))return [...new Set(value.filter(mode=>REMINDER_MODES.includes(mode)))];
  return REMINDER_MODES.includes(value)?[value]:[];
}

function selectedModes(value){
  if(Array.isArray(value))return value;
  if(value==null||value===''||value==='none')return [];
  return [value];
}

function validSelection(modes){
  return Array.isArray(modes)&&new Set(modes).size===modes.length&&modes.every(mode=>REMINDER_MODES.includes(mode));
}

function customDayError(modes,day){
  if(!modes.includes('custom'))return '';
  return /^\d+$/.test(String(day||''))&&Number(day)>=1&&Number(day)<=31?'':'Enter a reminder day from 1 to 31.';
}

export function reminderError(dueDate,selections,day,time){
  const modes=selectedModes(selections);
  if(!validSelection(modes))return 'Choose a reminder timing.';
  if(!modes.length)return '';
  if(!validDate(dueDate))return 'Choose a due date for the reminder.';
  const dayError=customDayError(modes,day);
  if(dayError)return dayError;
  if(time!==undefined&&time!==null&&!validReminderTime(time))return 'Choose a reminder time.';
  if(modes.includes('custom')&&monthDate(dueDate.slice(0,7),Number(day))>=dueDate)return 'Set reminder before due date.';
  return '';
}

export function monthlyReminderError(dueDay,selections,day,time){
  const modes=selectedModes(selections);
  if(!validSelection(modes))return 'Choose a reminder timing.';
  if(!modes.length)return '';
  if(!Number.isInteger(dueDay)||dueDay<1||dueDay>31)return 'Set a due day before choosing a reminder.';
  const dayError=customDayError(modes,day);
  if(dayError)return dayError;
  if(time!==undefined&&time!==null&&!validReminderTime(time))return 'Choose a reminder time.';
  if(modes.includes('custom')&&Number(day)>=dueDay)return 'Set reminder before due date.';
  return '';
}

export function reminderNotificationTime(date,time,repeatDaily,now=new Date()){
  const selected=reminderTimeOrDefault(time);
  if(!validDate(date)||!validReminderTime(selected))return null;
  const [year,month,day]=date.split('-').map(Number),[hour,minute]=selected.split(':').map(Number);
  const when=new Date(year,month-1,day,hour,minute,0,0);
  if(when<=now){
    const nowDate=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    if(date!==nowDate)return null;
    if(repeatDaily)when.setDate(when.getDate()+1);
    else return null;
  }
  return when;
}

export function reminderOccurrencesForDueDate(dueDate,selections,day){
  if(reminderError(dueDate,selections,day))return[];
  const seen=new Set();
  return normalizeReminderModes(selections).flatMap(mode=>{
    let occurrence;
    if(mode==='overdue')occurrence={mode,date:addDays(dueDate,1),repeatDaily:true};
    else if(mode==='due')occurrence={mode,date:dueDate,repeatDaily:false};
    else if(mode==='custom')occurrence={mode,date:monthDate(dueDate.slice(0,7),Number(day)),repeatDaily:false};
    else occurrence={mode,date:addDays(dueDate,mode==='3days'?-3:-1),repeatDaily:false};
    const key=occurrence.date+':'+occurrence.repeatDaily;
    if(seen.has(key))return[];
    seen.add(key);
    return[occurrence];
  });
}

export function addDays(date,days){
  const [year,month,day]=date.split('-').map(Number);
  const value=new Date(Date.UTC(year,month-1,day+days));
  return value.getUTCFullYear()+'-'+String(value.getUTCMonth()+1).padStart(2,'0')+'-'+String(value.getUTCDate()).padStart(2,'0');
}
