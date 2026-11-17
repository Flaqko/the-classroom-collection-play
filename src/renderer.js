const NS='http://www.w3.org/2000/svg';
export const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function transformBounds(b,m){const p=[point(m,b[0],b[1]),point(m,b[2],b[1]),point(m,b[0],b[3]),point(m,b[2],b[3])];return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];}
const union=(a,b)=>!a?b:!b?a:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
const identity=[1,0,0,1,0,0];
const teacherByScene={266:213,270:262,274:269,278:293,282:313,286:337,290:364,294:370,298:409,303:427,304:454};
export const isModelDriven=(scene,id)=>!!teacherByScene[scene]&&[teacherByScene[scene],223,315].includes(id);
export function treeBounds(tree,parent=identity){
 const world=multiply(parent,tree.matrix||identity);
 if(tree.def?.bounds)return transformBounds(tree.def.bounds,world);
 let b=null;for(const c of tree.children.values())b=union(b,treeBounds(c,world));return b;
}
const el=(name)=>document.createElementNS(NS,name);
function setAttributeIfChanged(node,name,value){
 const text=String(value);
 if(node.getAttribute(name)!==text)node.setAttribute(name,text);
}
const numeric=/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi;

function interpolateAttribute(start,end,progress){
 if(/^#[0-9a-f]{6}$/i.test(start)&&/^#[0-9a-f]{6}$/i.test(end)){
  return '#'+[1,3,5].map(i=>{
   const a=parseInt(start.slice(i,i+2),16),b=parseInt(end.slice(i,i+2),16);
   return Math.round(a+(b-a)*progress).toString(16).padStart(2,'0');
  }).join('');
 }
 const a=start.match(numeric),b=end.match(numeric);
 if(!a||!b||a.length!==b.length||start.replace(numeric,'#')!==end.replace(numeric,'#'))return progress<.5?start:end;
 let i=0;
 return start.replace(numeric,()=>{const x=Number(a[i]),y=Number(b[i++]);return String(x+(y-x)*progress);});
}

class SymbolInstance {
 constructor(renderer,record,parent){
  this.r=renderer;this.id=record.id;this.def=renderer.data.symbols[this.id];this.parent=parent;
  this.node=el('g');this.node.dataset.symbol=this.id;this.children=new Map();this.frame=1;this.running=true;this.state='up';
  this.age = 0;
  this.waitFrames = this.def?.randomWait ? Math.floor(Math.random() * this.def.randomWait * renderer.data.fps / 1000) : 0;
  this.update(record);
  if(!this.def)return;
  if(this.def.kind==='asset'){
   this.use=el('use');
   this.use.setAttribute('href',renderer.assetReference(this.id,record.ratio));
   this.node.append(this.use);
  }else if(this.def.kind==='button'){
   this.sync(this.def.records.filter(c=>c.up));
   for(const [event,state] of [['pointerenter','over'],['pointerleave','out'],['pointerdown','down'],['pointerup','up']]){
    const sound=this.def.buttonSounds?.[state];if(sound)this.node.addEventListener(event,()=>this.r.soundEvents.push({...sound}));
   }
   if(renderer.buttonLabel(this.id)||this.def.buttonSounds){
    const label=renderer.buttonLabel(this.id);
    if(label){this.node.setAttribute('role','button');this.node.setAttribute('tabindex','0');this.node.setAttribute('aria-label',label);}
    this.node.classList.add('source-button');
    const b=this.hitBounds();if(b){const hit=el('rect');for(const [k,v] of Object.entries({x:b[0],y:b[1],width:Math.max(1,b[2]-b[0]),height:Math.max(1,b[3]-b[1]),fill:'transparent'}))hit.setAttribute(k,v);this.node.append(hit);this.hit=hit;}
    if(label)this.node.addEventListener('click',e=>{e.stopPropagation();renderer.onButton(this.id)});
    this.node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();renderer.onButton(this.id)}});
    for(const [event,state] of [['pointerenter','over'],['pointerleave','up'],['pointerdown','down'],['pointerup','over']])this.node.addEventListener(event,()=>{this.state=state;this.sync(this.def.records.filter(c=>c[state]));});
   }
  }else if(this.def.kind==='sprite'){
   this.sync(this.def.frames[0]||[]);this.sound();this.action();
  }
 }
 update(record){this.matrix=record.matrix||identity;this.depth=record.depth;this.birth=record.birth;this.color=record.color;this.alpha=record.alpha??1;this.name=record.name||'';setAttributeIfChanged(this.node,'transform',`matrix(${this.matrix.join(',')})`);this.r.applyColor(this.node,record);if(this.name&&this.node.dataset.name!==this.name)this.node.dataset.name=this.name;
  if(this.use&&this.def.morph&&this.ratio!==record.ratio)this.use.setAttribute('href',this.r.assetReference(this.id,record.ratio));
  this.ratio=record.ratio;
 }
 sync(records,reset=false){
  const live=new Set();let next=this.node.firstChild;for(const rec of records){live.add(rec.depth);let child=this.children.get(rec.depth);
   if(!child||child.id!==rec.id||child.birth!==rec.birth||reset){child?.node.remove();child=new SymbolInstance(this.r,rec,this);this.children.set(rec.depth,child);}else child.update(rec);
   // Keep the hit target attached through down/up; moving it cancels native clicks.
   if(child.node!==next)this.node.insertBefore(child.node,next?.parentNode===this.node?next:this.hit||null);
   next=child.node.nextSibling;
  }
  for(const [depth,child] of this.children)if(!live.has(depth)){child.node.remove();this.children.delete(depth);}
 }
 setFrame(frame){if(this.def?.kind!=='sprite')return;const next=Math.max(1,Math.min(this.def.frames.length,frame));if(this.frame!==next){const reset=next===1&&this.frame>1;this.frame=next;this.node.dataset.sourceFrame=next;this.sync(this.def.frames[next-1],reset);this.sound();}}
 sound(){for(const event of this.def?.frameEvents||[])if(event.frame===this.frame)this.r.soundEvents.push(event);for(const sound of this.def?.sounds||[])if(sound.frame===this.frame)this.r.soundEvents.push(sound);}
 action(){
  const action=this.def?.actions?.[this.frame];
  if(action==='stop')this.running=false;
  else if(action==='unload'){this.running=false;this.sync([]);}
  else if(typeof action==='number')this.setFrame(action);
  else if(action?.stop){this.setFrame(action.target);this.running=false;}
 }
 advance(){
  // These source timelines are driven by the explicit classroom rule model.
  if(!this.children.size&&this.def?.kind!=='sprite')return;
  const priorChildren=[...this.children.values()];
  if(this.def?.kind==='sprite'&&this.running&&(this.r.data.game==='Classroom2'||!isModelDriven(this.r.frame,this.id))){
   this.age++;
   const ready=this.def.randomWait && this.frame===2 && this.age>this.waitFrames;
   this.setFrame(ready?4:this.frame%this.def.frames.length+1);this.action();
  }
  for(const child of priorChildren)if(this.children.get(child.depth)===child)child.advance();
 }
 world(){return this.parent?multiply(this.parent.world(),this.matrix):this.matrix;}
 localBounds(){
  if(this.def?.bounds)return this.def.bounds;
  let b=null;for(const child of this.children.values())b=union(b,transformBounds(child.localBounds()||[0,0,0,0],child.matrix));return b;
 }
 bounds(){return treeBounds(this,this.parent?.world()||identity);}
 hitBounds(){let b=null;for(const rec of this.def.records.filter(c=>c.hit)){const bounds=this.r.sourceBounds(rec.id);if(bounds)b=union(b,transformBounds(bounds,rec.matrix));}return b||this.localBounds();}
 find(name){if(this.name===name)return this;for(const c of this.children.values()){const hit=c.find(name);if(hit)return hit;}return null;}
 containsPaintedFill(x,y){
  if(this.alpha===0)return false;
  if(!this.use)return [...this.children.values()].some(child=>child.containsPaintedFill(x,y));
  const [a,b,c,d,tx,ty]=this.world(),det=a*d-b*c;
  if(!det)return false;
  const dx=x-tx,dy=y-ty;
  const localX=(d*dx-c*dy)/det,localY=(a*dy-b*dx)/det;
  // Read the active morph variant, and exclude invisible collision shapes.
  const href=this.use.getAttribute('href');
  if(!this.r.paintedPaths.has(href)){
   const shape=this.r.defs.querySelector(href);
   const paths=[...(shape?.querySelectorAll('path')??[])]
    .filter(path=>path.getAttribute('fill')!=='none'&&Number(path.getAttribute('fill-opacity')??1)>0)
    .map(path=>({path:new Path2D(path.getAttribute('d')),rule:path.getAttribute('fill-rule')||'nonzero'}));
   this.r.paintedPaths.set(href,paths);
  }
  return this.r.paintedPaths.get(href).some(({path,rule})=>this.r.context.isPointInPath(path,localX,localY,rule));
 }
 contains(x,y){
  if(this.def?.kind==='asset'){
   const m=this.world(),det=m[0]*m[3]-m[1]*m[2];if(!det)return false;
   const dx=x-m[4],dy=y-m[5];const localX=(m[3]*dx-m[2]*dy)/det,localY=(-m[1]*dx+m[0]*dy)/det;
   return (this.r.paths.get(this.id)||[]).some(p=>{
    if(p.fill&&this.r.context.isPointInPath(p.path,localX,localY,p.rule))return true;
    if(p.stroke&&p.width>0){this.r.context.lineWidth=p.width;this.r.context.lineCap=p.cap;this.r.context.lineJoin=p.join;return this.r.context.isPointInStroke(p.path,localX,localY);}
    return false;
   });
  }
  return [...this.children.values()].some(c=>c.contains(x,y));
 }
}
export class Renderer {
 constructor(svg,data,library,buttonLabel,onButton){
  this.svg=svg;this.data=data;this.buttonLabel=buttonLabel;this.onButton=onButton;this.paths=new Map();this.filters=new Map();this.soundEvents=[];this.context=document.createElement('canvas').getContext('2d');
  const doc=new DOMParser().parseFromString(library,'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('Original vector library could not be parsed');
  this.defs=document.importNode(doc.querySelector('defs'),true);
  this.paintedPaths=new Map();
  this.morphTemplates=new Map();
  this.morphVariants=new Set();
  for(const asset of this.defs.children){
   const id=Number(asset.id.replace('asset',''));if(!Number.isFinite(id))continue;
   if(data.symbols[id]?.morph){
    this.morphTemplates.set(id,asset.cloneNode(true));
    asset.querySelectorAll('animate,animateTransform').forEach(node=>node.remove());
   }
   this.paths.set(id,[...asset.querySelectorAll('path')].map(p=>({path:new Path2D(p.getAttribute('d')),fill:p.getAttribute('fill')!=='none',stroke:!!p.getAttribute('stroke')&&p.getAttribute('stroke')!=='none',width:Number(p.getAttribute('stroke-width')||1),cap:p.getAttribute('stroke-linecap')||'butt',join:p.getAttribute('stroke-linejoin')||'miter',rule:p.getAttribute('fill-rule')||'nonzero'})));
  }
  svg.append(this.defs);
 }
 assetReference(id,ratio){
  const template=this.morphTemplates.get(id);
  if(!template||!ratio)return `#asset${id}`;
  const name=`asset${id}-morph-${ratio}`;
  if(!this.morphVariants.has(name)){
   const variant=template.cloneNode(true),progress=ratio/65535;
   variant.id=name;
   for(const animation of variant.querySelectorAll('animate')){
    const [start,end]=(animation.getAttribute('values')||'').split(';');
    if(end!==undefined)animation.parentElement.setAttribute(animation.getAttribute('attributeName'),interpolateAttribute(start,end,progress));
    animation.remove();
   }
   variant.querySelectorAll('animateTransform').forEach(node=>node.remove());
   for(const node of variant.querySelectorAll('[id]'))node.id+=`-${ratio}`;
   for(const node of variant.querySelectorAll('[fill],[stroke]')){
    for(const attr of ['fill','stroke']){
     const value=node.getAttribute(attr);
     if(value?.startsWith('url(#'))node.setAttribute(attr,value.replace(')',`-${ratio})`));
    }
   }
   this.defs.append(variant);
   this.morphVariants.add(name);
  }
  return `#${name}`;
 }
 applyColor(node,record){
  const c=record.color;
  if(!c||[0,1,2].every(i=>c[i]===1)&&c.slice(4).every(v=>v===0)){setAttributeIfChanged(node,'opacity',record.alpha??1);if(node.hasAttribute('filter'))node.removeAttribute('filter');return;}
  const key=c.join(',');let id=this.filters.get(key);
  if(!id){id=`source-color-${this.filters.size}`;this.filters.set(key,id);const filter=el('filter');filter.id=id;filter.setAttribute('color-interpolation-filters','sRGB');filter.setAttribute('x','-50%');filter.setAttribute('y','-50%');filter.setAttribute('width','200%');filter.setAttribute('height','200%');
   const transfer=el('feComponentTransfer');for(const [i,channel] of ['R','G','B','A'].entries()){const f=el(`feFunc${channel}`);f.setAttribute('type','linear');f.setAttribute('slope',c[i]);f.setAttribute('intercept',c[i+4]);transfer.append(f);}filter.append(transfer);this.defs.append(filter);
  }
  setAttributeIfChanged(node,'opacity',1);setAttributeIfChanged(node,'filter',`url(#${id})`);
 }
 mount(frame){this.root?.node.remove();this.soundEvents=[];this.frame=frame;this.root=new SymbolInstance(this,{id:-1,matrix:identity,alpha:1},null);this.root.sync(this.data.scenes[frame]);this.svg.append(this.root.node);this.level=this.data.levels?.[Math.floor((frame-265)/4)+1];for(const event of this.data.sceneSounds||[])if(event.frame===frame)this.soundEvents.push(event);}
 advance(){this.root.advance();}
 gotoScene(frame){this.frame=frame;this.root.sync(this.data.scenes[frame]);for(const event of this.data.sceneSounds||[])if(event.frame===frame)this.soundEvents.push(event);}
 sourceBounds(id){const d=this.data.symbols[id];if(d.bounds)return d.bounds;let b=null;const records=d.kind==='sprite'?d.frames[0]:d.records.filter(c=>c.hit);for(const c of records||[]){const cb=this.sourceBounds(c.id);if(cb)b=union(b,transformBounds(cb,c.matrix));}return b;}
 find(name){return this.root.find(name);}
 bounds(name){return this.find(name)?.bounds();}
 visible(name,show){const i=this.find(name);const visibility=show?'visible':'hidden';if(i&&i.node.style.visibility!==visibility)i.node.style.visibility=visibility;}
 drawGame(g){
  const player=this.find('player');if(player){player.node.toggleAttribute('data-interpolate-motion', true);player.update({id:player.id,name:'player',matrix:[1,0,0,1,g.x,g.y],alpha:1});}
  this.find(g.level.teacherName)?.setFrame(g.teacherFrame);this.find('cheatbar')?.setFrame(g.copyFrame);
  for(const name of ['safepoint','hitpoint','teacher_hittest','finishline'])this.visible(name,false);
  this.visible('cheat_notifier',g.inHit);this.visible('safe_notifier',g.inSafe);this.visible('cheatbar',g.copyFrame<g.copyFrames);this.visible('button',g.copyFrame<g.copyFrames);
 }
 zones(){return {safe:this.bounds('safepoint'),hit:this.bounds('hitpoint'),teacher:this.bounds('teacher_hittest'),fov:this.bounds('fov'),explosion:this.bounds('explosion'),bullet:this.bounds('bullet'),finishline:this.bounds('finishline')};}
 collision(x,y,name='class'){return this.find(name)?.contains(x,y)||false;}
 drainSounds(){return this.soundEvents.splice(0);}
}
