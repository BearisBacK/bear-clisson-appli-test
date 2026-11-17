'use strict';
/*
 * Sons de la balade, synthétisés (aucun fichier audio, aucun envoi).
 * - bonne() : monument qui s'illumine. Petit accord montant, clair : « bonne nouvelle ».
 * - rugissement() : approche d'un ours. Grondement grave qui descend.
 * - attrape() : ours rangé dans le carnet. Rugissement plus fort, suivi d'un accord de victoire.
 * Le son ne démarre qu'après un premier toucher de l'écran (règle iOS).
 */
(function(root){
  let ctx=null;
  function ensure(){
    try{
      const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return null;
      ctx=ctx||new AC();
      if(ctx.state==='suspended')ctx.resume?.();
      return ctx.state==='running'?ctx:null;
    }catch{return null;}
  }
  function unlock(){ensure();}
  root.addEventListener?.('pointerdown',unlock,{passive:true});
  root.addEventListener?.('touchend',unlock,{passive:true});

  function note(c,freq,start,dur,type,gain){
    const o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,start);
    g.gain.setValueAtTime(0.0001,start);
    g.gain.exponentialRampToValueAtTime(gain,start+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,start+dur);
    o.connect(g).connect(c.destination);o.start(start);o.stop(start+dur+0.05);
  }
  function bonne(){
    const c=ensure();if(!c)return;
    const t=c.currentTime;
    [[523,0],[659,0.12],[784,0.24],[1047,0.36]].forEach(([f,d])=>note(c,f,t+d,0.35,'triangle',0.16));
  }
  function growl(c,t,dur,from,to,gain){
    const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    o.type='sawtooth';o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+dur);
    f.type='lowpass';f.frequency.setValueAtTime(420,t);f.frequency.exponentialRampToValueAtTime(160,t+dur);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+0.08);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(f).connect(g).connect(c.destination);o.start(t);o.stop(t+dur+0.05);
  }
  function rugissement(){
    const c=ensure();if(!c)return;
    growl(c,c.currentTime,0.9,140,60,0.22);
  }
  function attrape(){
    const c=ensure();if(!c)return;
    const t=c.currentTime;
    growl(c,t,1.1,220,90,0.3);
    [[523,0.9],[659,1.02],[784,1.14],[1047,1.26]].forEach(([f,d])=>note(c,f,t+d,0.3,'square',0.08));
  }
  // Spot photo : déclencheur d'appareil (bref bruit filtré) suivi de deux notes vives.
  function spot(){
    const c=ensure();if(!c)return;
    const t=c.currentTime;
    const len=Math.floor(c.sampleRate*0.06),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    const src=c.createBufferSource(),hp=c.createBiquadFilter(),g=c.createGain();
    src.buffer=buf;hp.type='highpass';hp.frequency.value=1800;g.gain.value=0.5;
    src.connect(hp).connect(g).connect(c.destination);src.start(t);
    note(c,1568,t+0.12,0.16,'sine',0.14);note(c,2093,t+0.22,0.22,'sine',0.14);
  }
  // Proximité d'un spot : un seul son par spot, rearmé quand on s'éloigne (au-delà de 50 m).
  const SPOT_NEAR_M=30, SPOT_LEAVE_M=50;
  const spotNear=new Set();
  function metresBetween(lat1,lon1,lat2,lon2){
    const kx=111320*Math.cos(lat1*Math.PI/180), ky=110574;
    return Math.hypot((lon2-lon1)*kx,(lat2-lat1)*ky);
  }
  function spotCheck(lat,lon){
    const list=root.BearSpotPositions||[];
    for(const sp of list){
      const d=metresBetween(lat,lon,sp.lat,sp.lon);
      if(d<=SPOT_NEAR_M&&!spotNear.has(sp.id)){spotNear.add(sp.id);spot();}
      else if(d>SPOT_LEAVE_M)spotNear.delete(sp.id);
    }
  }
  root.BearSons={bonne,rugissement,attrape,spot,spotCheck};
})(typeof window!=='undefined'?window:globalThis);
