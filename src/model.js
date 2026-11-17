// Explicit translation of classroom clip events; scene-specific authored rules
// come from the recovered level metadata rather than reusing Day1's timeline.
const firstDay={day:1,player:[224.6,369.3],copyFrames:261,teacherLength:134,randomWait:8000,teacherActions:{3:2},teacherName:'teacher_level1',teacherId:213,barId:223,extraCollision:[]};
export const detectionFrames = 24;

export function createGame(random=Math.random,level=firstDay){
 return {level,x:level.player[0],y:level.player[1],copyFrame:1,copyFrames:level.copyFrames,phase:'play',tick:0,teacherFrame:1,teacherStopped:false,
  fovFrame:1,teacherTime:0,waitUntil:Math.floor(random()*level.randomWait),random,
  inSafe:true,inHit:false,detection:0};
}
export function canBeginCopy(g){return g.phase==='play'&&g.copyFrame<g.copyFrames&&(g.level.mode??'copy')==='copy';}
export function playerBounds(g){return [g.x-5.9,g.y-13,g.x+13,g.y+5.9];}
export function overlaps(a,b){return !!a&&!!b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
export function advanceTeacher(g){
 g.teacherTime+=1000/30;
 if(!g.teacherStopped){
  const old=g.teacherFrame;
  if(g.level.randomWait&&old===2)g.teacherFrame=g.teacherTime>g.waitUntil?4:3;
  else if(g.level.randomWait&&old===3)g.teacherFrame=2;
  else{
   g.teacherFrame=old%g.level.teacherLength+1;
   const action=g.level.teacherActions[g.teacherFrame];
   if(action==='stop')g.teacherStopped=true;
   else if(typeof action==='number')g.teacherFrame=action;
  }
  if(g.teacherFrame===1&&old!==1){g.waitUntil=g.teacherTime+Math.floor(g.random()*g.level.randomWait);g.fovFrame=0;}
 }
 g.fovFrame=g.fovFrame%120+1;
}
export function stepGame(g,input={},zones={},collision=()=>false,visionContains){
 if(g.phase!=='play')return;
 g.stopSounds=false;const mode=g.level.mode??'copy',speed=g.level.speed??3;
 // Flash independently applies all four keys, then its four collision probes.
 if(input.down)g.y+=speed;if(input.up)g.y-=speed;if(input.left)g.x-=speed;if(input.right)g.x+=speed;
 for(const probe of Array.isArray(collision)?collision:[collision]){
  if(probe(g.x+13,g.y))g.x-=speed;
  if(probe(g.x-5.9,g.y))g.x+=speed;
  if(probe(g.x,g.y+5.9))g.y-=speed;
  if(probe(g.x,g.y-13))g.y+=speed;
 }
 const bounds=playerBounds(g);g.inSafe=overlaps(bounds,zones.safe);g.inHit=overlaps(bounds,zones.hit);
 if(mode==='intro'){g.tick++;advanceTeacher(g);return;}
 // The cone rotates, so its enclosing rectangle includes space outside the beam.
 const inVision=()=>visionContains ? visionContains(g.x,g.y) : overlaps([g.x,g.y,g.x,g.y],zones.fov);
 if(mode==='escape'){
  if(overlaps(bounds,zones.bullet))g.phase='killed';
  if(overlaps(bounds,zones.finishline))g.phase='win';
  if(g.phase!=='play')return;
  // The original references the absent level11_lose label. AVM1 ignores
  // an unresolved goto; preserve its sound-stop side effect, not a new screen.
  if(overlaps(bounds,zones.teacher)||!g.inSafe&&inVision())g.stopSounds=true;
  g.tick++;advanceTeacher(g);return;
 }
 if(g.copyFrame===g.copyFrames&&g.inSafe){g.phase='win';return;}
 if(overlaps(bounds,zones.explosion)){g.phase='killed';return;}
 // Match Classroom 3's point test for direct contact.
 if(overlaps([g.x,g.y,g.x,g.y],zones.teacher)){g.phase='lose';return;}
 const copying=g.inHit&&canBeginCopy(g);
 const seen=(!g.inSafe||copying)&&inVision();
 g.detection=seen?g.detection+1:Math.max(0,g.detection-1);
 if(g.detection>=detectionFrames){g.phase='lose';return;}
 if(copying)g.copyFrame++;
 g.tick++;advanceTeacher(g);
}
