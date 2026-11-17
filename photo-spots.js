'use strict';
(function(root){
 const PHOTO_KEY='bear-spot-photos-v1';
 const text=v=>typeof v==='string'&&v.trim().length>0&&!/à vérifier|inconnu/i.test(v);
 // Une entrée du modèle documentaire n'est jamais une autorisation.
 function eligible(s){
  const p=s?.positionPriseDeVue,a=s?.accessibilite,o=s?.orientation;
  return !!(text(s?.id)&&text(s?.lieu?.nom)&&text(s?.lieu?.source)&&
   p?.certitude==='vérifiée'&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&
   Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&text(p.source)&&
   // Orientation facultative (choix de l'organisateur) ; si elle est donnée, sa source doit être présente.
   (o===undefined||text(o?.source))&&
   a?.accesPublic===true&&a?.arretSur===true&&text(a.source));
 }
 function catalogue(data){
  const ids=new Set();
  return (Array.isArray(data?.pointsDeVue)?data.pointsDeVue:[]).filter(s=>{
   if(!eligible(s)||ids.has(s.id))return false;ids.add(s.id);return true;
  });
 }
 // Photos de spots : une photo par identifiant de spot, stockée sur cet appareil uniquement (aucun envoi).
 // Plusieurs photos possibles par spot (12 au maximum, pour rester dans le stockage du téléphone).
 const MAX_PER_SPOT=12;
 function loadPhotos(storage){
  try{
   const v=JSON.parse(storage?.getItem(PHOTO_KEY)||'{}');const out={};
   for(const [id,value] of Object.entries(v||{})){
    if(!/^[A-Za-z0-9_-]{1,40}$/.test(id))continue;
    // Ancien format : une seule photo (texte) ; nouveau format : liste de photos.
    const arr=(Array.isArray(value)?value:[value]).filter(u=>typeof u==='string'&&u.startsWith('data:image/jpeg;base64,')&&u.length<400000).slice(0,MAX_PER_SPOT);
    if(arr.length)out[id]=arr;
   }
   return out;
  }catch{return {};}
 }
 function savePhotos(storage,photos){try{storage?.setItem(PHOTO_KEY,JSON.stringify(photos));return true;}catch{return false;}}
 // Réduit la photo (900 px, JPEG) avant stockage : quelques dizaines de Ko par spot.
 function shrink(file,max=900){
  return new Promise((resolve,reject)=>{
   const doc=root.document,img=new root.Image(),url=root.URL.createObjectURL(file);
   img.onload=()=>{try{
    const s=Math.min(1,max/Math.max(img.width,img.height));
    const c=doc.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    root.URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',0.8));
   }catch(e){reject(e);}};
   img.onerror=()=>{root.URL.revokeObjectURL(url);reject(new Error('image'));};
   img.src=url;
  });
 }
 function mount({map,Marker,document:doc,spots,storage=null}){
  const panel=doc.getElementById('spots'),list=doc.getElementById('spots-list'),status=doc.getElementById('spots-status');
  const open=doc.getElementById('spots-open');
  const show=()=>{if(!panel.open)panel.showModal();};
  open.onclick=show;
  doc.getElementById('spots-close').onclick=()=>panel.close();
  list.replaceChildren();
  const valid=catalogue({pointsDeVue:spots});
  // Positions utilisées par le son d'approche (sons-balade.js).
  (typeof window!=='undefined'?window:globalThis).BearSpotPositions=valid.map(s=>({id:s.id,lat:s.positionPriseDeVue.latitude,lon:s.positionPriseDeVue.longitude}));
  const photos=loadPhotos(storage);
  status.textContent=valid.length?valid.length+' spot(s) documenté(s). Arrête-toi en sécurité avant de photographier.':
   'Les beaux points de vue attendent leurs repères. Aucun spot photo vérifié dans cet atelier : aucune épingle affichée. La balade et le Carnet restent disponibles.';
  const markers=[];
  // Partie SPOT du carnet : une ligne par spot, avec la photo rattachée si elle existe.
  function renderCarnet(){
   const carnet=doc.getElementById('spot-photos-list');if(!carnet)return;
   carnet.replaceChildren();
   for(const spot of valid){
    const li=doc.createElement('li');li.className='ourson-slot';
    const name=doc.createElement('span');name.textContent=spot.lieu.nom;
    const shots=photos[spot.id]||[];
    const state=doc.createElement('span');state.textContent=shots.length?'📷 '+shots.length+(shots.length>1?' photos rattachées':' photo rattachée'):'pas encore de photo';
    li.append(name,state);
    shots.forEach((url,i)=>{const img=doc.createElement('img');img.className='spot-thumb';img.src=url;img.alt='Photo '+(i+1)+' du spot '+spot.lieu.nom;li.append(img);});
    carnet.append(li);
   }
  }
  for(const spot of valid){
   const card=doc.createElement('article');card.className='spot-card';card.tabIndex=-1;
   const title=doc.createElement('h3');title.textContent=spot.lieu.nom;
   const view=doc.createElement('p');view.textContent=spot.orientation?(spot.orientation.direction+' · '+spot.orientation.cadrage):'';
   const source=doc.createElement('p');source.className='rallye-note';
   source.textContent='Sources : '+[spot.lieu.source,spot.positionPriseDeVue.source,spot.orientation?.source,spot.accessibilite.source].filter(Boolean).join(' · ');
   const action=doc.createElement('button');action.type='button';action.textContent='Voir sur la carte';
   action.setAttribute('aria-label','Voir '+spot.lieu.nom+' sur la carte');
   const position=[spot.positionPriseDeVue.longitude,spot.positionPriseDeVue.latitude];
   action.onclick=()=>{panel.close();map.easeTo({center:position,zoom:17});};
   const note=doc.createElement('p');note.textContent='Accès depuis la trace non validé : aucun détour guidé proposé.';
   // Photo du spot : bouton qui ouvre l'appareil photo, photo rattachée à l'identifiant du spot.
   const photoBox=doc.createElement('div');photoBox.className='spot-photo';
   const gallery=doc.createElement('div');gallery.className='spot-gallery';
   const take=doc.createElement('button');take.type='button';
   take.setAttribute('aria-label','Ouvrir l’appareil photo pour le spot '+spot.lieu.nom);
   const file=doc.createElement('input');file.type='file';file.accept='image/*';file.setAttribute('capture','environment');file.className='visually-hidden-file';
   const photoStatus=doc.createElement('p');photoStatus.className='rallye-note';photoStatus.setAttribute('role','status');
   const paint=()=>{
    const shots=photos[spot.id]||[];
    take.textContent=shots.length?'📷 Ajouter une autre photo':'📷 Prendre la photo de ce spot';
    gallery.replaceChildren(...shots.map((url,i)=>{
     const fig=doc.createElement('div');fig.className='spot-shot';
     const img=doc.createElement('img');img.className='spot-thumb';img.src=url;img.alt='Photo '+(i+1)+' du spot '+spot.lieu.nom;
     const del=doc.createElement('button');del.type='button';del.textContent='Retirer cette photo';
     del.setAttribute('aria-label','Retirer la photo '+(i+1)+' du spot '+spot.lieu.nom);
     del.onclick=()=>{const rest=(photos[spot.id]||[]).filter((_,j)=>j!==i);if(rest.length)photos[spot.id]=rest;else delete photos[spot.id];savePhotos(storage,photos);paint();renderCarnet();};
     fig.append(img,del);return fig;
    }));
   };
   take.onclick=()=>file.click();
   file.onchange=async()=>{
    const f=file.files?.[0];file.value='';
    if(!f)return;
    photoStatus.textContent='Traitement de la photo…';
    try{
     const url=await shrink(f);
     const current=photos[spot.id]||[];
     if(current.length>=MAX_PER_SPOT){photoStatus.textContent='Ce spot a déjà '+MAX_PER_SPOT+' photos. Retire-en une pour en ajouter.';return;}
     photos[spot.id]=[...current,url];
     if(!savePhotos(storage,photos)){if(current.length)photos[spot.id]=current;else delete photos[spot.id];throw Error('stockage');}
     paint();renderCarnet();
     photoStatus.textContent=current.length?'Photo ajoutée : '+(current.length+1)+' pour ce spot.':'Photo rattachée à ce spot.';
    }catch{photoStatus.textContent='Photo non enregistrée : format non reconnu ou stockage plein.';}
   };
   photoBox.append(gallery,take,file,photoStatus);
   paint();
   card.append(title,view,source,action,note,photoBox);list.append(card);
   const pin=doc.createElement('button');pin.type='button';pin.className='spot-pin';pin.textContent='📷';
   pin.setAttribute('aria-label','Spot photo : '+spot.lieu.nom);
   pin.onclick=event=>{event.stopPropagation();show();card.focus();};
   markers.push(new Marker({element:pin}).setLngLat(position).addTo(map));
  }
  renderCarnet();
  // Les marqueurs DOM MapLibre survivent aux changements de style, sans sprites distants.
  return {markers,spots:valid,photos:()=>({...photos}),destroy(){markers.forEach(marker=>marker.remove());}};
 }
 async function start(map,Marker){
  const doc=root.document;
  let storage=null;try{storage=root.localStorage;}catch{}
  try{
   const response=await root.fetch('./photo-preparation.json');
   if(!response.ok)throw Error('catalogue');
   return mount({map,Marker,document:doc,storage,spots:catalogue(await response.json())});
  }catch{
   const result=mount({map,Marker,document:doc,storage,spots:[]});
   doc.getElementById('spots-status').textContent='Catalogue de spots indisponible. Aucune épingle affichée ; la trace et le Carnet restent utilisables.';
   return result;
  }
 }
 const api={eligible,catalogue,mount,start,loadPhotos,savePhotos,PHOTO_KEY};
 if(typeof module!=='undefined')module.exports=api;else root.BearPhotoSpots=api;
})(typeof window==='undefined'?globalThis:window);
