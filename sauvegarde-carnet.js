'use strict';
/*
 * Sauvegarde du carnet : photos des spots, ours capturés, gouttes de miel, balades.
 * - Exporter : un fichier JSON enregistré sur l'appareil (aucun envoi à un serveur).
 * - Importer : relit ce fichier et remplace le carnet de cet appareil (après confirmation).
 * - Demande au navigateur de conserver les données (navigator.storage.persist) et affiche l'espace utilisé.
 */
(function(root){
  const FORMAT='bear-carnet-v1';
  const KEY_OK=/^[A-Za-z0-9_.-]{1,80}$/;
  const doc=root.document;
  const $=id=>doc.getElementById(id);
  const storage=(()=>{try{return root.localStorage;}catch{return null;}})();

  function status(msg){const s=$('backup-status');if(s)s.textContent=msg;}

  function exportCarnet(){
    try{
      const data={};
      for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k&&KEY_OK.test(k))data[k]=storage.getItem(k);}
      const payload={format:FORMAT,exportedAt:new Date().toISOString(),data};
      const blob=new root.Blob([JSON.stringify(payload)],{type:'application/json'});
      const url=root.URL.createObjectURL(blob);
      const a=doc.createElement('a');
      a.href=url;a.download='carnet-balade-clisson-'+new Date().toISOString().slice(0,10)+'.json';
      doc.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>root.URL.revokeObjectURL(url),4000);
      status('Carnet exporté. Garde ce fichier : il permet de le retrouver si les données du téléphone sont effacées.');
    }catch{status('Export impossible sur cet appareil.');}
  }

  function importCarnet(file){
    const reader=new root.FileReader();
    reader.onload=()=>{
      try{
        const payload=JSON.parse(String(reader.result));
        if(payload?.format!==FORMAT||!payload.data||typeof payload.data!=='object')throw Error('format');
        const entries=Object.entries(payload.data).filter(([k,v])=>KEY_OK.test(k)&&typeof v==='string');
        if(!entries.length)throw Error('vide');
        if(!root.confirm('Remplacer le carnet de cet appareil par le fichier choisi ('+entries.length+' éléments) ?'))return status('Import annulé.');
        for(const [k,v] of entries)storage.setItem(k,v);
        status('Carnet importé. La page va se recharger.');
        setTimeout(()=>root.location.reload(),800);
      }catch{status('Fichier non reconnu : choisis un fichier « carnet-balade-clisson » exporté depuis l’appli.');}
    };
    reader.onerror=()=>status('Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  async function protect(){
    try{
      const ok=root.navigator?.storage?.persist?await root.navigator.storage.persist():false;
      const est=root.navigator?.storage?.estimate?await root.navigator.storage.estimate():null;
      const used=est?.usage?Math.round(est.usage/1024/1024*10)/10+' Mo utilisés':'';
      return (ok?'Stockage protégé par le navigateur.':'Protection non garantie : sauvegarde ton carnet dans un fichier.')+(used?' '+used+'.':'');
    }catch{return 'Protection du stockage indisponible sur cet appareil.';}
  }

  async function init(){
    if(!doc||!$('backup-export'))return;
    $('backup-export').onclick=exportCarnet;
    $('backup-import-input').onchange=e=>{const f=e.target.files?.[0];e.target.value='';if(f)importCarnet(f);};
    $('backup-import').onclick=()=>$('backup-import-input').click();
    status(await protect());
  }
  if(doc)doc.addEventListener('DOMContentLoaded',()=>{init();});
  if(doc&&doc.readyState!=='loading')init();
  root.BearSauvegarde={exportCarnet,importCarnet};
})(typeof window!=='undefined'?window:globalThis);
