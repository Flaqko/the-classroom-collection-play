// Original Flash sound events with independent voices and stereo envelopes.
export class OriginalAudio {
 constructor(metadata, directory='assets/audio/'){this.metadata=metadata;this.directory=directory;this.tracks=new Map();this.active=new Set();this.voiceId=0;this.muted=false;this.paused=false;this.loopBuffers=new Map();}
 wire(track){
  if(track.wired||!this.context)return;track.element.muted=false;
  const source=this.context.createMediaElementSource(track.element),split=this.context.createChannelSplitter(2),merge=this.context.createChannelMerger(2);
  source.connect(split);track.gains=[this.context.createGain(),this.context.createGain()];
  for(let c=0;c<2;c++){split.connect(track.gains[c],track.meta.stereo?c:0);track.gains[c].connect(merge,0,c);}
  merge.connect(this.master);Object.assign(track,{source,split,merge,wired:true});
 }
 unlock(){
  if(!this.context){const Context=window.AudioContext||window.webkitAudioContext;if(Context){this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.muted?0:1;this.master.connect(this.context.destination);for(const t of this.tracks.values())this.wire(t);}}
  this.context?.resume().catch(()=>{});if(!this.paused)this.resume();
 }
 envelope(track){
  if(!track.gains)return;const points=track.meta.envelope||[];
  for(let c=0;c<2;c++){
   const gain=track.gains[c].gain,channel=c?'right':'left',position=track.offset+track.element.currentTime,now=this.context.currentTime;
   let value=points.length?points[0][channel]:1;
   for(let i=0;i<points.length;i++){
    const p=points[i],next=points[i+1];if(p.time<=position)value=p[channel];
    if(next&&p.time<=position&&next.time>position)value=p[channel]+(next[channel]-p[channel])*(position-p.time)/(next.time-p.time);
   }
   gain.cancelScheduledValues(now);gain.setValueAtTime(value,now);
   for(const p of points)if(p.time>position)gain.linearRampToValueAtTime(p[channel],now+p.time-position);
  }
 }
 playLoop(id, start, end) {
  this.clearLoop();
  this.loop = {id, start, end, offset: 0};
  this.unlock();
 }
 async startLoop() {
  const loop = this.loop;
  if (!loop || !this.context || this.paused || loop.source || loop.loading) return;
  loop.loading = true;
  try {
   if (!this.loopBuffers.has(loop.id)) {
    const {file} = this.metadata[loop.id];
    const response = await fetch(this.directory + file);
    if (!response.ok) throw Error('Could not load title music');
    const decoded = await this.context.decodeAudioData(await response.arrayBuffer());
    const rate = decoded.sampleRate;
    const first = Math.round(loop.start * rate);
    const last = Math.min(decoded.length, Math.round(loop.end * rate));
    const buffer = this.context.createBuffer(decoded.numberOfChannels, last - first, rate);
    const fade = Math.round(rate * .002);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
     const samples = buffer.getChannelData(channel);
     samples.set(decoded.getChannelData(channel).subarray(first, last));
     // Soften the cut across the loop boundary without adding silence.
     for (let i = 0; i < fade; i++) {
      samples[i] *= i / fade;
      samples[samples.length - 1 - i] *= i / fade;
     }
    }
    this.loopBuffers.set(loop.id, buffer);
   }
   if (this.loop !== loop || this.paused) return;
   const source = this.context.createBufferSource();
   source.buffer = this.loopBuffers.get(loop.id);
   source.loop = true;
   source.connect(this.master);
   loop.source = source;
   loop.startedAt = this.context.currentTime;
   source.start(0, loop.offset);
  } catch (error) {
   if (this.loop === loop) {
    this.clearLoop();
    console.warn('Could not prepare the title music loop:', error);
    this.play(loop.id, {loops: 999});
   }
  } finally {
   loop.loading = false;
  }
 }
 pauseLoop() {
  const loop = this.loop;
  if (!loop?.source) return;
  const {source} = loop;
  loop.offset = (loop.offset + this.context.currentTime - loop.startedAt) % source.buffer.duration;
  source.stop();
  source.disconnect();
  loop.source = null;
 }
 clearLoop() {
  this.pauseLoop();
  this.loop = null;
 }
 play(id,settings={}){
  if(settings.noMultiple&&[...this.tracks.values()].some(t=>t.id===id&&!t.element.paused&&!t.element.ended))return;
  const meta={...this.metadata[id],...settings},element=document.createElement('audio');
  const loops=Math.max(1,Math.floor(Number(meta.loops)||1));
  element.src=`${this.directory}${meta.file||`${id}.mp3`}`;element.preload='auto';element.dataset.sourceSound=id;element.dataset.loopCount=loops;element.hidden=true;element.muted=this.muted;document.body.append(element);
  const track={key:++this.voiceId,id,element,meta,remaining:loops,offset:0};this.tracks.set(track.key,track);this.active.add(track.key);this.wire(track);
  element.addEventListener('ended',()=>{
   if(!this.active.has(track.key))return;
   if(--track.remaining<=0){this.dispose(track);return;}
   track.offset+=track.meta.duration||element.duration;element.currentTime=0;
   if(!this.paused){this.envelope(track);element.play().catch(()=>{});}
  });
  if(!this.paused){this.envelope(track);element.play().catch(()=>{});}
 }
 dispose(track){
  this.active.delete(track.key);this.tracks.delete(track.key);track.element.pause();track.element.remove();
  for(const node of [track.source,track.split,track.merge,...(track.gains||[])])node?.disconnect();
 }
 stopSound(id){if(this.loop?.id===id)this.clearLoop();for(const track of [...this.tracks.values()])if(track.id===id)this.dispose(track);}
 stop(){this.clearLoop();for(const track of [...this.tracks.values()])this.dispose(track);}
 pause(){this.paused=true;this.pauseLoop();for(const t of this.tracks.values())t.element.pause();}
 resume(){
  this.paused=false;
  this.startLoop();
  for(const key of [...this.active]){const t=this.tracks.get(key);if(!t)continue;if(t.element.paused&&!t.element.ended){this.envelope(t);t.element.play().catch(()=>{});}}
 }
 mute(value){this.muted=value;if(this.master)this.master.gain.value=value?0:1;else for(const t of this.tracks.values())t.element.muted=value;}
}
