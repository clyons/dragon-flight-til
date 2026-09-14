import { Vector3, MathUtils } from 'three';
const FPS=30, FRAMES=1035;
const smooth=(t,a,b)=>MathUtils.smoothstep(t,a,b);
export async function runShortTour(app) {
  const {portrait,width,height,renderer,sim,camera,controls,homeTarget}=app;
  const format=portrait?'portrait':'widescreen';
  const indicator=document.createElement('div');
  Object.assign(indicator.style,{position:'fixed',top:'8px',left:'8px',zIndex:1000,padding:'10px',background:'#fff',color:'#24372f'});
  document.body.append(indicator);indicator.textContent='Preparing short demo…';
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  const config={codec:'avc1.42002a',width,height,bitrate:14_000_000,framerate:FPS,latencyMode:'realtime',avc:{format:'annexb'}};
  if(!(await VideoEncoder.isConfigSupported(config)).supported)throw new Error('This browser cannot encode the H.264 demo. Use Chrome.');
  const chunks=[];let failure;
  const encoder=new VideoEncoder({output(chunk){const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);chunks.push(bytes);},error(error){failure=error;}});
  encoder.configure(config);
  let title='01 / TAKE FLIGHT',detail='Head leads. Tail follows.';
  const chapter=(a,b)=>{title=a;detail=b;};
  const preroll=seconds=>{for(let i=0;i<Math.round(seconds*FPS);i++)app.advance();};
  app.resetForCut();app.changeMaterial('jade');app.fly();preroll(8);
  const events=new Map([
    [120,()=>{preroll(8);chapter('02 / FIGURE EIGHT','Swoop through both sides.');}],
    [300,()=>{preroll(11);chapter('03 / REVERSE THE CIRCLE','A fresh view of the dragon.');}],
    [390,()=>{chapter('04 / STEER THE HEAD','← Turn left');app.input('ArrowLeft');}],
    [426,()=>{detail='→ Turn right';app.input('ArrowRight');}],
    [462,()=>{detail='↑ Lift the head and climb';app.input('ArrowUp');}],
    [510,()=>{app.clearInput();app.resetForCut();chapter('05 / GRAB & SHAKE','Pick it up. Give it a shake.');app.beginGrab();}],
    [591,()=>chapter('06 / THROW','And let it fly.')],
    [609,()=>app.release()],
    [759,()=>{app.resetForCut();app.changeMaterial('copper');chapter('07 / MATERIALS','Copper · warm and metallic');}],
    [840,()=>{app.changeMaterial('obsidian');detail='Obsidian · a soft, dark shine';}],
    [921,()=>{app.resetForCut();app.changeMaterial('jade');chapter('08 / RESET','Back to the beginning.');}],
    [975,()=>chapter('GO FOR A SPIN','Play the dragon playground.')],
  ]);
  const text=(value,x,y,size,color='#24372f',weight=500)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px "DM Sans", sans-serif`;ctx.fillText(value,x,y);};
  const wrap=(value,x,y,size,maxWidth)=>{
    let line='';ctx.font=`500 ${size}px "DM Sans", sans-serif`;
    for(const word of value.split(/\s+/)){
      if(ctx.measureText(line+word).width>maxWidth){text(line,x,y,size);line='';y+=size*1.35;}
      line+=word+' ';
    }text(line,x,y,size);
  };
  const paint=()=>{
    ctx.drawImage(renderer.domElement,0,0,width,height);
    const state=app.status();
    if(portrait){
      text('DRAGON',64,76,34,'#24372f',800);text('FLIGHT PLAYGROUND',64,99,12,'#24372f',600);
      text('THREE.JS + BOX3D',770,74,17,'#647269');
      text('Go for a spin.',64,180,68);
      text(title,64,247,20,'#48705a',700);wrap(detail,64,293,26,930);
      text(state.mode,64,1105,18,'#647269',600);
    }else{
      text('DRAGON',64,79,43,'#24372f',800);text('FLIGHT PLAYGROUND',64,104,13,'#24372f',600);
      text('THREE.JS + BOX3D',1645,80,18,'#647269');
      text('A little myth.',64,205,58);text('A little motion.',64,275,58);
      text('Go for a spin.',64,330,24,'#647269');
      text(title,64,408,18,'#48705a',700);wrap(detail,64,450,26,355);
      text(state.mode,1555,690,19,'#647269',600);
    }
    const barY=portrait?1150:765;
    const startX=portrait?64:604;
    const scale=portrait?1:.8;
    const pill=(label,x,w,active=false)=>{
      ctx.fillStyle=active?'#284e3e':'#fafbf6';ctx.beginPath();ctx.roundRect(startX+x*scale,barY,w*scale,66*scale,16);ctx.fill();
      text(label,startX+(x+22)*scale,barY+42*scale,23*scale,active?'#f2f4eb':'#24372f');
    };
    pill(sim.mode==='flight'?'↘ Drop':'↗ Take flight',0,230,sim.mode==='flight');
    pill(state.held?'Holding':'Grab',246,170,state.held);
    pill(state.material[0].toUpperCase()+state.material.slice(1),432,225);
    pill('Reset ↺',673,279);
    if(sim.mode==='flight'){
      const x=portrait?64:64,y=portrait?1263:809;
      text('←  ↑  ↓  →',x,y,portrait?28:30,state.key?'#285d43':'#647269',600);
      text(state.key?'Steering the head':'Autopilot',portrait?300:300,y,22,'#647269');
    }
    text('Elder Fire Dragon · Biocraftlab · CC BY-NC-SA 4.0',64,portrait?1312:871,18,'#647269');
    if(!portrait)text('clyons.github.io/dragon-flight-til/play/',1410,871,18,'#647269');
  };
  for(let frame=0;frame<FRAMES;frame++){
    events.get(frame)?.();
    if(frame>=510&&frame<609){
      const t=(frame-510)/FPS;
      let offset;
      if(t<2.1){
        const a=smooth(t,.5,.85);
        offset=new Vector3(a*Math.sin(t*15)*1.3,smooth(t,0,.7)*4+a*Math.sin(t*12)*.55,a*Math.cos(t*13)*.65);
      }else if(t<2.7){
        const last=new Vector3(Math.sin(2.1*15)*1.3,4+Math.sin(2.1*12)*.55,Math.cos(2.1*13)*.65);
        offset=last.lerp(new Vector3(-2.5,3,0),smooth(t,2.1,2.7));
      }else offset=new Vector3(-2.5,3,0).addScaledVector(new Vector3(18,14,-4),t-2.7);
      app.moveGrab(offset,smooth(t,2.1,2.9));
    }
    if(frame>=759&&frame<921){
      const angle=Math.sin((frame-759)/FPS*.5)*.18;
      camera.position.set(6,12,20).multiplyScalar(portrait?1.375:1).applyAxisAngle(new Vector3(0,1,0),angle).add(controls.target);
    }
    app.advance();paint();
    const videoFrame=new VideoFrame(canvas,{timestamp:Math.round(frame*1e6/FPS),duration:Math.round(1e6/FPS)});
    encoder.encode(videoFrame,{keyFrame:frame%60===0});videoFrame.close();
    if(frame%15===0){
      await encoder.flush();if(failure)throw failure;
      indicator.textContent=`Recording ${format}: ${Math.floor(frame/FRAMES*100)}%`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  await encoder.flush();encoder.close();if(failure)throw failure;
  indicator.textContent=`Saving ${format}…`;
  const response=await fetch(`/save-recording?format=${format}`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Video-Metadata':JSON.stringify({width,height,fps:FPS,frames:FRAMES,duration:FRAMES/FPS,format})},body:new Blob(chunks)});
  if(!response.ok)throw new Error('Recording save failed');
  indicator.textContent=`Saved ${format} · ${FRAMES/FPS} seconds`;
  document.title=`Saved ${format} demo`;
  if(portrait&&new URLSearchParams(location.search).has('both'))location.href='/?format=widescreen';
}
