export function levelForFrame(levels,frame){
 for(const level of Object.values(levels||{})){
  if(level.escape?.play===frame)return {level:level.escape,phase:'play'};
  for(const [key,phase] of [['note','day'],['play',level.mode==='intro'?'intro':'play'],['lose','lose'],['win','win'],['killed','killed']])if(Number.isFinite(level[key])&&level[key]===frame)return {level,phase};
 }
 return null;
}
export function levelForPassword(levels,password){return Object.values(levels||{}).find(l=>l.password===password)||null;}
export function nextNote(levels,day){return levels?.[day+1]?.note??null;}
