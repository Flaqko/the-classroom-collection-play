import {setupGamepad, advanceWithSpace} from './gamepad.js?v=controller-highlight';
import {createMovementInput} from './movement-input.js';
import {setupCreditsSkip} from './credits-skip.js';
import {createFrameCounter} from './frame-counter.js';
import {setupSceneEdges} from './scene-edges.js';
import {populatePasswords, resetPasswordSelection} from './password-list.js?v=password-select';
import {setupPauseMenu} from './pause-menu.js';
import {setupAutosave} from './autosave.js';
import {setupRemaster} from './remaster.js';
import {createGame,stepGame,detectionFrames} from './model.js';
import {Renderer} from './renderer.js';
import {OriginalAudio} from './audio.js';
import {levelForFrame,levelForPassword} from './campaign.js';
const stage=document.querySelector('#stage'),status=document.querySelector('#status'),loading=document.querySelector('#loading'),paused=document.querySelector('#paused');
const cheatBar = document.querySelector('#vertical-cheat-bar');
const cheatFill = document.querySelector('#vertical-cheat-fill');
const notifiers = document.querySelector('#classroom-notifiers');
const notePencil = document.querySelector('#note-pencil');
const classroomLayout = stage.closest('.classroom-layout');
let pencil;
const detectionStatus = document.querySelector('#detection-status');
const detectionMeter = document.querySelector('#detection-meter');
const detectionColor = document.querySelector('#detection-color');
if(detectionMeter) detectionMeter.max = detectionFrames;
const frameCounter = createFrameCounter(stage, 30);
const speechArtwork = [
 281, 282, 284, 286, 300, 301, 304, 323, 325, 333, 343, 345, 346, 347,
 357, 358, 359, 360, 361, 362, 363, 376, 377, 378, 382, 421, 422, 464, 468,
];
const syncSceneEdges = setupSceneEdges(stage, [159], speechArtwork);
const passwordList = document.querySelector('#password-list');
const passwordField = passwordList.querySelector('input');
const collectionBack = "collection-back";
const menuContinue = "menu-continue";
const fixedLabels={[menuContinue]:"Continue",[collectionBack]:"Back",121:'Start game',126:'Instructions',130:'Credits',135:'Password',151:'Next',178:'Next',157:'Back',191:'Back to menu',194:'Back to menu',250:'Back to menu'};
let autosave,pauseMenu;
let copyComplete = false;
const movementInput = createMovementInput();
const input = movementInput.directions;
let data,renderer,audio,game,level,screen='loading',frame=252,muted=false,isPaused=false,accumulator=0,previous=0,pendingRootFrame=null;
const activeGame=()=>screen==='play'||screen==='intro';
function clearInput(){movementInput.clear();}
function fitNotePencil(){
 if(!pencil || !stage.clientWidth) return;
 const [left, top, right, bottom] = pencil.bounds();
 const margin = 3;
 const sideSpace = (classroomLayout.clientWidth / stage.clientWidth * 300 - 300) / 2;
 const viewportLeft = -sideSpace + margin;
 const viewportRight = 300 + sideSpace - margin;
 const width = right - left;
 const height = bottom - top;
 const scale = Math.min(1, (viewportRight - viewportLeft) / width, (400 - 2 * margin) / height);
 const x = Math.max(viewportLeft, Math.min(left + width * (1 - scale) / 2, viewportRight - width * scale));
 const y = Math.max(margin, Math.min(top + height * (1 - scale) / 2, 400 - margin - height * scale));
 const offset = [x - scale * left, y - scale * top];
 pencil.node.setAttribute('transform', 'translate(' + offset.join(' ') + ') scale(' + scale + ') matrix(' + pencil.matrix.join(' ') + ')');
}

const pencilResize = new ResizeObserver(fitNotePencil);
pencilResize.observe(classroomLayout);
pencilResize.observe(stage);

function setScreen(next){
 screen=next;
 const copyingRoom = next === 'play' && (level?.mode ?? 'copy') === 'copy';
 if(detectionStatus) detectionStatus.hidden = !copyingRoom;
 cheatBar?.toggleAttribute('hidden', !copyingRoom);
 notifiers.replaceChildren();
 notePencil.replaceChildren();
 pencil = next === 'day' ? [...renderer.root.children.values()].find(child => child.id === 196) : null;
 notePencil.toggleAttribute('hidden', !pencil);
 if(pencil){
  notePencil.append(pencil.node);
  fitNotePencil();
 }
 if(copyingRoom){
  for(const [name, x] of [['safe_notifier', -22], ['cheat_notifier', 322]]){
   const indicator = renderer.find(name);
   if(!indicator) continue;
   const [a, b, c, d, , y] = indicator.matrix;
   indicator.node.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${x} ${y})`);
   notifiers.append(indicator.node);
  }
 }
 document.body.dataset.screen=next;
 document.body.dataset.day=level?.day||'';
 passwordList.hidden = next !== 'password';
 pauseMenu?.refresh();
}
function sounds(){for(const event of renderer.drainSounds())if(event.type==='stopAllSounds')audio.stop();else if(event.type==='rootPlay')pendingRootFrame=frame+1;else if(event.stop)audio.stopSound(event.id);else audio.play(event.id,event);}
function label(id){
 if(fixedLabels[id])return fixedLabels[id];const action=data.buttons[id];if(!action)return null;
 if(action.relative)return action.relative>0?'Next':'Back';
 if([2,252].includes(action.target))return 'Back to menu';
 const source=levelForFrame(data.levels,frame),target=levelForFrame(data.levels,action.target);
 if(['lose','killed'].includes(source?.phase))return 'Restart';
 if(['play','intro'].includes(target?.phase))return 'Play';
 if(target?.phase==='day'||action.target===data.ending.start)return 'Next';
 return null;
}
function drawDetection(){
 if(detectionMeter) detectionMeter.value=game.detection;
 const cone=renderer.find('fov')?.node;
 if(!cone || !detectionColor) return;
 if(!game.detection){
  cone.style.removeProperty('filter');
  return;
 }
 // Keep the authored transparency and show full red before the catch.
 const warning=Math.min(1,game.detection/8);
 const red=Math.min(1,Math.max(0,(game.detection-8)/(detectionFrames-12)));
 const original=1-warning;
 detectionColor.setAttribute('values',[
  original,0,0,0,warning,
  0,original,0,0,warning*(0.72*(1-red)),
  0,0,original,0,warning*(0.05+0.04*red),
  0,0,0,1,0,
 ].join(' '));
 const sourceFilter=cone.getAttribute('filter');
 cone.style.filter=(sourceFilter?sourceFilter+' ':'')+'url(#detection-tint)';
}
function drawCheatBar(){
 if(!cheatBar || cheatBar.hasAttribute('hidden')) return;
 renderer.visible('cheatbar',false);
 const progress=(game.copyFrame-1)/(game.copyFrames-1);
 cheatFill.setAttribute('transform','translate(0 '+(142.35-147*progress)+') scale(1 '+(.029815674+1.001556426*progress)+')');
 cheatFill.setAttribute('fill','rgb('+Math.round(255-153*progress)+' '+Math.round(204*progress)+' 0)');
}
function drawState(){
 const full = game.copyFrames > 1 && game.copyFrame === game.copyFrames;
 if(full && !copyComplete)audio.play('copy-complete');
 copyComplete = full;
 renderer.drawGame(game);drawDetection();drawCheatBar();stage.dataset.copyFrame=game.copyFrame;stage.dataset.copyFrames=game.copyFrames;stage.dataset.teacherFrame=game.teacherFrame;}
function showCredits(){
 setScreen('credits');
 status.textContent='Original credits · Menu returns to the title.';
 if (audio.loop?.id !== 108) audio.playLoop(108, .12, 16.15);
}
function show(f){
 pauseMenu.close();
 // Original menu returns target the start of the retired sponsor sequence.
 if (f === data.opening.start) f = data.opening.title;
 clearInput();pendingRootFrame=null;isPaused=false;paused.hidden=true;
 const route=levelForFrame(data.levels,f);if(route)level=route.level;
 const instructionPage = f >= 253 && f <= 263;
 const keepInstructionScene = instructionPage && screen === 'instructions';
 const menuPage = f === data.opening.title || instructionPage || f === 264;
 const leavingMenuPage = ['title', 'instructions', 'password'].includes(screen);
 const circleFrame = menuPage && leavingMenuPage && !keepInstructionScene
  ? [...renderer.root.children.values()].find(child => child.id === 116)?.frame
  : undefined;
 const keepTitleMusic = (f === data.opening.title || f === data.ending.credits) && audio.loop?.id === 108;
 const stopForLevel = route && !(route.level.day === 10 && ['win', 'killed'].includes(route.phase));
 if (stopForLevel || ([252,307,602].includes(f) && !keepTitleMusic)) audio.stop();
 audio.resume();
 frame = f;
 if (keepInstructionScene) renderer.gotoScene(f);
 else {
  renderer.mount(f);
  if (circleFrame !== undefined) {
   const circle = [...renderer.root.children.values()].find(child => child.id === 116);
   circle?.setFrame(circleFrame);
  }
 }
 if(f===252){setScreen('title');status.textContent='Original game by Luksy.';if (!keepTitleMusic) audio.playLoop(108, .12, 16.15);}
 else if(instructionPage){setScreen('instructions');status.textContent=`Original instructions · page ${f-252} of 11 · Copying starts automatically near the geek.`;}
 else if(f===264){
  setScreen('password');
  status.textContent='';
  resetPasswordSelection(passwordList);
 }
 else if(route){
  setScreen(route.phase);
  if(['day','play','intro'].includes(route.phase)) autosave?.save(level.day);
  if(route.phase==='day')status.textContent=`Day ${level.day} · ${level.password}`;
  else if(['play','intro'].includes(route.phase)){game=createGame(Math.random,level);copyComplete=false;drawState();status.textContent=level.mode==='intro'?'Day 10 · The original confrontation.':level.mode==='escape'?'Day 10 · Reach the exit.':`Day ${level.day} · Copy from the geek, then return to your seat.`;}
  else if(route.phase==='lose')status.textContent=`Caught. Restart Day ${level.day} to try again.`;
  else if(route.phase==='killed')status.textContent=`Day ${level.day} · Restart to try again.`;
  else status.textContent=level.day===10?'You survived.':`Day ${level.day} passed.`;
 }else if(f===307){setScreen('ending');status.textContent='The original ending.';}
 else if(f===data.ending.credits) showCredits();
 syncSceneEdges();
 accumulator=0;if(f!==264)stage.focus({preventScroll:true});sounds();
}
function submitPassword(){const target=levelForPassword(data.levels,passwordField.value);if(target)show(target.note);else status.textContent='Select a password first.';}
setupCreditsSkip(stage, () => screen === 'credits', () => show(data.opening.title));
passwordList.querySelector('form').addEventListener('submit', event => {
 event.preventDefault();
 submitPassword();
});
function button(id){
 if(id===menuContinue){autosave.continueGame();return;}
 if(id===collectionBack){window.location.assign("collection.html?v=shared-fullscreen");return;}
 const action=data.buttons[id];if(!action)return;
 if(action.relative){show(frame+action.relative);return;}
 show(action.target);
}
document.querySelector('#sound').onclick=e=>{muted=!muted;e.target.textContent=`Sound: ${muted?'off':'on'}`;e.target.setAttribute('aria-pressed',muted);audio?.mute(muted);};
window.addEventListener('pointerdown',()=>audio?.unlock(),{capture:true});window.addEventListener('keydown',()=>audio?.unlock(),{capture:true});
window.addEventListener('keydown', e => {
 if(screen !== 'play' || pauseMenu.paused) return;
 if(e.shiftKey && e.code === 'KeyF' && !e.repeat && !isPaused && (level.mode ?? 'copy') === 'copy'){
  e.preventDefault();
  game.copyFrame = game.copyFrames;
  drawState();
 }else if(movementInput.press(e)){
  e.preventDefault();
 }
});
window.addEventListener('keyup', e => movementInput.release(e));
stage.addEventListener('pointerdown',e=>{if(activeGame()&&e.button===0){e.preventDefault();stage.focus();isPaused=false;paused.hidden=true;audio.resume();}});
function pause(){clearInput();accumulator=0;if(activeGame()){isPaused=true;paused.hidden=false;}audio?.pause();}
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();previous=0;});
stage.addEventListener('focus',()=>{if(!document.hidden&&!pauseMenu?.paused){isPaused=false;paused.hidden=true;previous=0;audio?.resume();}});
window.addEventListener('focus',()=>{if(!activeGame()&&!document.hidden&&!pauseMenu?.paused)audio?.resume();});
function tick(){
 if(pendingRootFrame!==null){show(pendingRootFrame);return;}
 if(activeGame()&&!isPaused){
  const probes=['class',...level.extraCollision].map(name=>(x,y)=>renderer.collision(x,y,name));
  stepGame(game,input,renderer.zones(),probes,(x,y)=>renderer.collision(x,y,'fov'));
  if(game.phase!=='play'){show(level[game.phase]);return;}if(game.stopSounds)audio.stop();
  renderer.advance();drawState();sounds();
 }else if(screen==='credits'||screen==='ending'){
  if (frame >= data.ending.last) show(data.ending.returnTo);
  else {
   renderer.advance();
   renderer.gotoScene(++frame);
   sounds();
   if (frame === data.ending.credits) {
    audio.stop();
    showCredits();
   }
  }
 }else if(!isPaused){renderer.advance();sounds();}
 syncSceneEdges();
}
function animate(now) {
 const measure = frameCounter.visible;
 const started = measure ? performance.now() : 0;
 let ticks = 0;
 if (!previous) previous = now;
 const elapsed = Math.min(100, now - previous);
 previous = now;
 if (!document.hidden && !isPaused && !pauseMenu.paused) {
  accumulator += elapsed;
  while (accumulator >= 1000 / 30) {
   accumulator -= 1000 / 30;
   tick();
   ticks++;
  }
 }
 if (measure) frameCounter.record(now, ticks, performance.now() - started);
 requestAnimationFrame(animate);
}
Object.defineProperty(window,'classroom',{value:Object.freeze({snapshot:()=>({screen,frame,day:level?.day,paused:isPaused||Boolean(pauseMenu?.paused),...(activeGame()?{mode:level.mode,tick:game.tick,x:game.x,y:game.y,copyFrame:game.copyFrame,copyFrames:game.copyFrames,detection:game.detection,teacherFrame:game.teacherFrame,teacherStopped:game.teacherStopped,teacherTime:game.teacherTime,waitUntil:game.waitUntil,fovFrame:renderer.find('fov')?.frame||0,zones:renderer.zones()}: {})})})});
async function boot(){try{
 const fetchAsset=async url=>{const response=await fetch(url);if(!response.ok)throw Error(`${url}: HTTP ${response.status}`);return response;};
 const [dataResponse,libraryResponse,menuArtwork]=await Promise.all([fetchAsset('assets/game.json'),fetchAsset('assets/library.svg'),fetchAsset('assets/classroom-2/title-labels.svg')]);
 data=await dataResponse.json();
 // Symbol 114 is the original Play More Games button.
 data.scenes[data.opening.title] = data.scenes[data.opening.title].filter(({id}) => ![9, 12, 114].includes(id));
 // Reuse the original Back vectors and button states at title-menu scale.
 const backStates = data.symbols[157].records;
 const backHover = backStates.find(record => record.over);
 data.symbols[collectionBack] = {
  kind: 'button',
  records: [
   {...backHover, up: true, over: false, color: [0, 0, 0, 1, 0, 0, 0, 0]},
   ...backStates.filter(record => !record.up),
  ],
 };
 data.scenes[data.opening.title].push({
  id: collectionBack, depth: 34, matrix: [2, 0, 0, 2, 150, 317.4],
 });
 data.scenes[data.opening.title].sort((a, b) => a.depth - b.depth);
 data.scenes[264] = data.scenes[264].filter(({id}) => ![137, 192, 193].includes(id));
 populatePasswords(passwordList, Object.values(data.levels).map(({day, password}) => ({
  label: `Day ${day}`, password,
 })));
 audio=new OriginalAudio({...data.audio, 'copy-complete': {file: '../classroom-3/audio/53.mp3', stereo: false}});
 muted = audio.muted;
 const soundButton = document.querySelector('#sound');
 soundButton.textContent = muted ? 'Sound: off' : 'Sound: on';
 soundButton.setAttribute('aria-pressed', muted);
 renderer = new Renderer(stage, data, await libraryResponse.text(), label, button);
 await setupRemaster(renderer.defs, 'classic');
 // The yellow title panel also contains letter-shaped cutouts for the old button.
 const menuFill = renderer.defs.querySelector('#asset109 > path[fill="#ffcc00"]');
 menuFill.setAttribute('d', menuFill.getAttribute('d').split(/\s+M/, 1)[0]);
 const menuSource = new DOMParser().parseFromString(await menuArtwork.text(), 'image/svg+xml');
 const lettering = document.importNode(menuSource.querySelector('#continue-art'), true);
 const letteringId = 'menu-continue-lettering';
 lettering.id = 'asset' + letteringId;
 renderer.defs.append(lettering);
 data.symbols[letteringId] = {kind: 'asset', bounds: [-53.75, -16, 53.75, 16]};
 const face = {...backHover, id: letteringId};
 data.symbols[menuContinue] = {kind: 'button', records: [
  {...face, up: true, over: false},
  {...face, color: [0, 0, 0, 1, 0.4, 1, 0, 0]},
  {...face, over: false, down: true, color: [0, 0, 0, 1, 0.8, 0, 0, 0]},
  {...face, over: false, hit: true, depth: 2},
 ]};
 const titleRecords = data.scenes[data.opening.title];
 const menuRows = [121, menuContinue, 126, 130, 135, collectionBack];
 let hadSave;
 function updateTitleOptions(hasSave) {
  if (hadSave === hasSave) return;
  hadSave = hasSave;
  data.scenes[data.opening.title] = hasSave
   ? [...titleRecords, {id: menuContinue, depth: 8, matrix: [1, 0, 0, 1, 150, 0]}]
      .map(record => {
       const row = menuRows.indexOf(record.id);
       if (row < 0) return record;
       const [a,b,c,d,x] = record.matrix;
       return {...record, matrix: [a*.9,b*.9,c*.9,d*.9,x,148+34*row]};
      })
      .sort((a,b)=>a.depth-b.depth)
   : titleRecords;
  if (screen === 'title') renderer.gotoScene(data.opening.title);
 }
 pauseMenu = setupPauseMenu({
  stage, audio, clearInput,
  canPause: () => ['day','play','intro','lose','win','killed','ending'].includes(screen),
  backToTitle: () => show(data.opening.title),
 });
 loading.hidden = true;
 autosave = setupAutosave('classic', day => {
  const checkpoint = data.levels[day]?.note;
  if (!Number.isInteger(checkpoint)) return false;
  show(checkpoint);
 }, updateTitleOptions);
 if (!autosave.resumeFromLink()) show(data.opening.title);
 setupGamepad({
  surface: classroomLayout, movement: movementInput, pauseMenu,
  goBack: () => {
   if (screen === 'title') button(collectionBack);
   else if (['instructions', 'password', 'credits'].includes(screen)) show(data.opening.title);
   else return false;
   return true;
  },
  canMove: activeGame, advance: () => advanceWithSpace(stage), unlock: () => audio.unlock(),
 });
 requestAnimationFrame(animate);
 }catch(error){loading.replaceChildren();const message=document.createElement('p');message.textContent=`Could not load the original game assets: ${error.message}`;const retry=document.createElement('button');retry.textContent='Retry loading';retry.onclick=()=>location.reload();loading.append(message,retry);setScreen('error');console.error(error);}}
boot();
