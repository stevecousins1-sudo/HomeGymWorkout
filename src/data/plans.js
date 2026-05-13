export const PLANS = [
  { id:'hyp4',  name:'4-Day Hypertrophy',      focus:'hyp', daysPerWeek:4, weeks:12, description:'Classic 4-day upper/lower split focused on muscle growth.',                    schedule:[0,1,3,4],       dayNames:['Upper A','Lower A','Upper B','Lower B'] },
  { id:'str5',  name:'5×5 Strength',            focus:'str', daysPerWeek:3, weeks:12, description:'Heavy compound movements 3×/week to build raw strength.',                      schedule:[0,2,4],         dayNames:['Squat Day','Press Day','Deadlift Day'] },
  { id:'ppl',   name:'Push Pull Legs',           focus:'hyp', daysPerWeek:6, weeks:12, description:'High-frequency PPL covering all muscle groups twice per week.',                schedule:[0,1,2,3,4,5],   dayNames:['Push A','Pull A','Legs A','Push B','Pull B','Legs B'] },
  { id:'ul',    name:'Upper/Lower Split',        focus:'str', daysPerWeek:4, weeks:8,  description:'Alternating upper and lower sessions for balanced development.',               schedule:[0,1,3,4],       dayNames:['Upper','Lower','Upper','Lower'] },
  { id:'fb3',   name:'Full Body 3×/week',        focus:'beg', daysPerWeek:3, weeks:8,  description:'Full-body sessions 3 times a week, ideal for building a base.',               schedule:[0,2,4],         dayNames:['Full Body A','Full Body B','Full Body A'] },
  { id:'bro',   name:'Bro Split',                focus:'hyp', daysPerWeek:5, weeks:12, description:'Classic bodybuilding split targeting one muscle group per day.',               schedule:[0,1,2,3,4],     dayNames:['Chest & Triceps','Back & Biceps','Shoulders','Legs','Arms'] },
  { id:'phat',  name:'PHAT',                     focus:'str', daysPerWeek:5, weeks:12, description:'Power Hypertrophy Adaptive Training — strength + hypertrophy blend.',          schedule:[0,1,2,3,4],     dayNames:['Upper Power','Lower Power','Back & Shoulders','Lower Hyp','Chest & Arms'] },
  { id:'531',   name:'Wendler 5/3/1',            focus:'str', daysPerWeek:4, weeks:16, description:'Percentage-based periodization for long-term strength gains.',                 schedule:[0,1,3,4],       dayNames:['Squat','Bench','Deadlift','OHP'] },
  { id:'min2',  name:'2-Day Minimalist',          focus:'beg', daysPerWeek:2, weeks:8,  description:'Two full-body sessions per week for those with limited time.',                 schedule:[0,3],           dayNames:['Full Body A','Full Body B'] },
  { id:'ss',    name:'Starting Strength',         focus:'str', daysPerWeek:3, weeks:12, description:'Barbell-focused novice program: squat, press, deadlift every session.',        schedule:[0,2,4],         dayNames:['Workout A','Workout B','Workout A'] },
  { id:'pb6',   name:'Powerbuilding 6-Day',       focus:'str', daysPerWeek:6, weeks:16, description:'Six-day blend of powerlifting and bodybuilding for size and strength.',        schedule:[0,1,2,3,4,5],   dayNames:['Squat Focus','Chest & Arms','Deadlift Focus','Press & Shoulders','Legs Hyp','Back Hyp'] },
  { id:'arm',   name:'Arm Specialisation',        focus:'hyp', daysPerWeek:4, weeks:8,  description:'Extra arm volume with maintained full-body training frequency.',               schedule:[0,1,3,4],       dayNames:['Arms & Chest','Back & Biceps','Legs','Arms & Shoulders'] },
  { id:'oly',   name:'Olympic Foundations',       focus:'ath', daysPerWeek:4, weeks:12, description:'Learn snatch and clean & jerk technique with strength accessories.',           schedule:[0,1,3,4],       dayNames:['Snatch Focus','Clean & Jerk','Strength A','Strength B'] },
  { id:'cf',    name:'CrossFit Foundations',      focus:'ath', daysPerWeek:5, weeks:8,  description:'GPP-style conditioning combining barbell, gymnastics, and cardio.',            schedule:[0,1,2,3,4],     dayNames:['Barbell WOD','Gymnastics WOD','Conditioning','Mixed Modal','Open WOD'] },
  { id:'fat',   name:'Fat Loss Circuit',          focus:'fat', daysPerWeek:4, weeks:8,  description:'High-rep circuit training with short rest periods to maximise burn.',          schedule:[0,1,3,4],       dayNames:['Upper Circuit','Lower Circuit','Full Circuit A','Full Circuit B'] },
  { id:'beg',   name:'Beginner Full Body',        focus:'beg', daysPerWeek:3, weeks:8,  description:'Simple 3-day full-body plan perfect for anyone just starting out.',           schedule:[0,2,4],         dayNames:['Day A','Day B','Day A'] },
  { id:'ath',   name:'Athletic Performance',      focus:'ath', daysPerWeek:5, weeks:12, description:'Sport-specific training for speed, power, and functional strength.',           schedule:[0,1,2,3,4],     dayNames:['Power & Speed','Upper Strength','Agility & Core','Lower Strength','Conditioning'] },
  { id:'leg',   name:'Leg Dominant Split',        focus:'hyp', daysPerWeek:4, weeks:10, description:'Extra lower-body frequency for those wanting to grow their legs.',             schedule:[0,1,3,4],       dayNames:['Legs A','Upper A','Legs B','Upper B'] },
  { id:'bb',    name:'Back & Biceps Focus',       focus:'hyp', daysPerWeek:4, weeks:10, description:'Lagging back? This plan prioritises pulling volume twice a week.',             schedule:[0,1,3,4],       dayNames:['Back Heavy','Push Day','Back Volume','Legs & Bis'] },
  { id:'gvt',   name:'German Volume Training',    focus:'hyp', daysPerWeek:5, weeks:10, description:'10×10 protocol for serious muscle hypertrophy — brutal but effective.',        schedule:[0,1,2,3,4],     dayNames:['Chest & Back GVT','Legs & Abs GVT','Arms & Shoulders GVT','Chest & Back GVT','Legs & Abs GVT'] },
];

export const FOCUS_LABELS = {
  hyp: 'Hypertrophy',
  str: 'Strength',
  fat: 'Fat loss',
  ath: 'Athletic',
  beg: 'Beginner',
};

export const FOCUS_STYLES = {
  hyp: { background: '#EEEDFE', color: '#534AB7' },
  str: { background: '#E1F5EE', color: '#0F6E56' },
  fat: { background: '#FAECE7', color: '#993C1D' },
  ath: { background: '#E6F1FB', color: '#185FA5' },
  beg: { background: '#EAF3DE', color: '#3B6D11' },
};
