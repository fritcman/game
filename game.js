import * as THREE from 'three';

const $ = id => document.getElementById(id);
const ui = {
  menu:$('menu'), hud:$('hud'), pause:$('pause'), death:$('death'), loading:$('loading'),
  prompt:$('prompt'), toast:$('toast'), healthFill:$('healthFill'), hungerFill:$('hungerFill'),
  healthText:$('healthText'), hungerText:$('hungerText'), wood:$('woodCount'), stone:$('stoneCount'),
  clock:$('clock'), weather:$('weather')
};

let scene,camera,renderer,clock,controls;
let started=false,paused=false,dead=false,locked=false;
let health=100,hunger=100,wood=0,stone=0,day=1,dayTime=8*60;
let lastSurvival=0,lastClock=0,lastToast=0,toastTimer=null;
let velocityY=0,onGround=true,selected=0,hasAxe=false;
const keys={};
const worldObjects=[],resources=[],enemies=[];
const raycaster=new THREE.Raycaster();
const tempVec=new THREE.Vector3();
const blockGeo=new THREE.BoxGeometry(1,1,1);
const mat={};
const SAVE_KEY='wilderness-survival-save-v1';

function material(color,roughness=1){return new THREE.MeshStandardMaterial({color,roughness});}
function init(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9eb9c4);scene.fog=new THREE.Fog(0x9eb9c4,18,58);
  camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,120);camera.position.set(0,2,7);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  $('game').appendChild(renderer.domElement);
  clock=new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xc9e4ed,0x45513a,1.45));
  const sun=new THREE.DirectionalLight(0xffe0b0,2.1);sun.position.set(-20,35,15);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);scene.userData.sun=sun;
  mat.grass=material(0x557b43);mat.dirt=material(0x6a5038);mat.stone=material(0x777b78);mat.wood=material(0x755033);mat.leaves=material(0x315b39);mat.trunk=material(0x654329);mat.bark=material(0x795638);mat.apple=material(0xb83c2e);mat.zombie=material(0x6b8960);
  buildWorld();addClouds();addCamp();
  controls={yaw:0,pitch:0};
  addEvents();animate();ui.loading.classList.add('hidden');
}
function addBlock(x,y,z,material,kind='block',scale=1){
  const mesh=new THREE.Mesh(blockGeo,material);mesh.position.set(x,y,z);mesh.scale.setScalar(scale);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={kind,resource:kind==='tree'?'wood':kind==='rock'?'stone':null,hp:kind==='tree'?3:kind==='rock'?4:1};
  scene.add(mesh);worldObjects.push(mesh);return mesh;
}
function buildWorld(){
  // Flat voxel-like terrain with a slightly varied natural surface.
  for(let x=-24;x<=24;x++)for(let z=-24;z<=24;z++){
    const n=Math.sin(x*1.7+z*.4)*.08+Math.cos(z*1.2-x*.3)*.06;
    const top=addBlock(x,-.5+n,z,mat.grass,'ground');top.scale.set(1,.22,1);top.position.y=-.11+n;
    if((x+z)%3===0){const dirt=addBlock(x,-.68,z,mat.dirt,'ground');dirt.scale.set(1,.18,1);dirt.position.y=-.29+n;}
  }
  // Trees arranged in irregular clearings around the spawn point.
  for(let x=-21;x<=21;x+=3)for(let z=-21;z<=21;z+=3){
    if(Math.hypot(x,z)<7)continue;
    const seed=Math.abs(Math.sin(x*12.3+z*8.1));if(seed<.42)continue;
    const tx=x+(seed-.5)*1.4,tz=z+(Math.cos(x+z)*.5);
    makeTree(tx,tz,seed>.8?5:4);
  }
  for(let i=0;i<30;i++){
    const x=(Math.random()-.5)*42,z=(Math.random()-.5)*42;if(Math.hypot(x,z)<5)continue;
    makeRock(x,z);
  }
}
function makeTree(x,z,h=4){
  const trunk=addBlock(x,h/2,z,mat.trunk,'tree');trunk.scale.set(.65,h,.65);trunk.position.y=h/2-.05;
  const crown=addBlock(x,h+.25,z,mat.leaves,'foliage');crown.scale.set(2.6,2.1,2.6);crown.position.y=h+.25;
  const crown2=addBlock(x,h+1.1,z,mat.leaves,'foliage');crown2.scale.set(1.9,1.8,1.9);crown2.position.y=h+1.1;
}
function makeRock(x,z){
  const rock=addBlock(x,.25,z,mat.stone,'rock');rock.scale.set(.8,.55,.75);rock.rotation.y=Math.random();
}
function addClouds(){
  const cloudMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
  for(let i=0;i<12;i++){const g=new THREE.Group();const x=(Math.random()-.5)*80,z=(Math.random()-.5)*80,y=17+Math.random()*5;
    for(let j=0;j<4;j++){const m=new THREE.Mesh(new THREE.BoxGeometry(3+Math.random()*2,1,2.5),cloudMat);m.position.set((j-1.5)*2,Math.random()*.5,Math.random()*2);g.add(m);}
    g.position.set(x,y,z);scene.add(g);g.userData.drift=.15+Math.random()*.2;scene.userData.clouds??=[];scene.userData.clouds.push(g);
  }
}
function addCamp(){
  const fireMat=new THREE.MeshStandardMaterial({color:0xff8a25,emissive:0xff4a08,emissiveIntensity:2});
  const fire=new THREE.Mesh(new THREE.BoxGeometry(.35,.65,.35),fireMat);fire.position.set(2,.35,3);scene.add(fire);
  const light=new THREE.PointLight(0xff8a38,2.5,9);light.position.set(2,1,3);scene.add(light);
  for(let i=0;i<4;i++){const log=addBlock(2+Math.cos(i*Math.PI/2)*.45,.12,3+Math.sin(i*Math.PI/2)*.45,mat.trunk,'ground');log.scale.set(.9,.2,.2);log.rotation.y=i*Math.PI/2;}
}
function addEvents(){
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  $('startBtn').onclick=()=>{startGame();};
  $('resumeBtn').onclick=()=>resume();
  $('restartBtn').onclick=()=>{resetGame();startGame();};
  $('saveBtn').onclick=()=>{saveGame();showToast('ИГРА СОХРАНЕНА');};
  $('menuBtn').onclick=()=>{saveGame();exitPointer();ui.pause.classList.add('hidden');ui.hud.classList.add('hidden');ui.menu.classList.remove('hidden');started=false;};
  $('soundBtn').onclick=()=>toggleMusic();
  document.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(e.code==='Escape'&&started&&!dead){if(paused)resume();else pause();}
    if(['Digit1','Digit2','Digit3'].includes(e.code)){selected=Number(e.code.slice(-1))-1;updateHotbar();}
    if(e.code==='KeyE')interact();
  });
  document.addEventListener('keyup',e=>keys[e.code]=false);
  document.addEventListener('mousemove',e=>{if(!locked||paused)return;controls.yaw-=e.movementX*.0022;controls.pitch-=e.movementY*.0022;controls.pitch=Math.max(-1.48,Math.min(1.48,controls.pitch));camera.rotation.order='YXZ';camera.rotation.y=controls.yaw;camera.rotation.x=controls.pitch;});
  renderer.domElement.addEventListener('click',()=>{if(started&&!paused&&!dead&&!locked)renderer.domElement.requestPointerLock();else if(locked)mineOrAttack();});
  document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;if(started&&!paused&&!dead&&!locked)pause();});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('mousedown',e=>{if(e.button===2&&locked)useItem();});
}
function startGame(){
  if(!started){const saved=loadGame();if(saved)applySave(saved);}
  started=true;paused=false;dead=false;ui.menu.classList.add('hidden');ui.pause.classList.add('hidden');ui.death.classList.add('hidden');ui.hud.classList.remove('hidden');renderer.domElement.requestPointerLock();startMusic();updateHud();
}
function pause(){paused=true;ui.pause.classList.remove('hidden');document.exitPointerLock?.();}
function resume(){paused=false;ui.pause.classList.add('hidden');renderer.domElement.requestPointerLock();}
function exitPointer(){if(document.pointerLockElement)document.exitPointerLock();}
function resetGame(){
  health=100;hunger=100;wood=0;stone=0;day=1;dayTime=480;hasAxe=false;camera.position.set(0,2,7);controls.yaw=0;controls.pitch=0;camera.rotation.set(0,0,0);dead=false;paused=false;
}
function showToast(msg){ui.toast.textContent=msg;ui.toast.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.style.opacity=0,1800);}
function updateHud(){
  ui.healthFill.style.width=health+'%';ui.hungerFill.style.width=hunger+'%';ui.healthText.textContent=Math.ceil(health);ui.hungerText.textContent=Math.ceil(hunger);ui.wood.textContent=wood;ui.stone.textContent=stone;
  const h=Math.floor(dayTime/60)%24,m=Math.floor(dayTime%60);ui.clock.textContent=`ДЕНЬ ${day} · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function updateHotbar(){document.querySelectorAll('.slot').forEach((s,i)=>s.classList.toggle('selected',i===selected));}
function forward(){return new THREE.Vector3(-Math.sin(controls.yaw),0,-Math.cos(controls.yaw));}
function right(){return new THREE.Vector3(Math.cos(controls.yaw),0,-Math.sin(controls.yaw));}
function move(dt){
  const f=forward(),r=right(),dir=new THREE.Vector3();
  if(keys.KeyW||keys.ArrowUp)dir.add(f);if(keys.KeyS||keys.ArrowDown)dir.sub(f);if(keys.KeyD||keys.ArrowRight)dir.add(r);if(keys.KeyA||keys.ArrowLeft)dir.sub(r);
  if(dir.lengthSq())dir.normalize();
  const speed=(keys.ShiftLeft||keys.ShiftRight)?7.2:4.4;
  camera.position.addScaledVector(dir,speed*dt);
  camera.position.x=THREE.MathUtils.clamp(camera.position.x,-23,23);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-23,23);
  if((keys.Space||keys.KeyV)&&onGround){velocityY=6.5;onGround=false;}
  velocityY-=18*dt;camera.position.y+=velocityY*dt;
  if(camera.position.y<1.7){camera.position.y=1.7;velocityY=0;onGround=true;}
}
function getTarget(){
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);raycaster.far=5;
  const hits=raycaster.intersectObjects(worldObjects,false);
  return hits.find(h=>h.object.userData.kind==='tree'||h.object.userData.kind==='rock')?.object||null;
}
function interact(){
  if(!locked)return;
  const target=getTarget();if(!target)return;
  if(target.userData.kind==='tree'||target.userData.kind==='rock')mine(target);
}
function mineOrAttack(){
  const target=getTarget();if(target){mine(target);return;}
  const enemy=nearestEnemy();if(enemy&&enemy.distance<3){enemy.hp-=hasAxe?2:1;if(enemy.hp<=0){scene.remove(enemy.mesh);enemies.splice(enemies.indexOf(enemy),1);showToast('ВРАГ ПОВЕРЖЕН');}else showToast('ПОПАДАНИЕ');}
}
function mine(target){
  target.userData.hp--;
  target.material=target.material.clone();target.material.color.multiplyScalar(.82);
  if(target.userData.hp<=0){
    const kind=target.userData.resource;
    if(kind==='wood'){wood+=3;showToast('+3 ДЕРЕВА');}
    if(kind==='stone'){stone+=2;showToast('+2 КАМНЯ');}
    scene.remove(target);worldObjects.splice(worldObjects.indexOf(target),1);
    if(!hasAxe&&wood>=5){hasAxe=true;showToast('ТЫ СОБРАЛ МАТЕРИАЛЫ. ТОПОР ДОСТУПЕН В СЛОТЕ 2');}
    updateHud();
  }else showToast('ЕЩЁ НЕСКОЛЬКО УДАРОВ');
}
function useItem(){
  if(selected===2){if(hunger<100){hunger=Math.min(100,hunger+28);showToast('ТЫ СЪЕЛ ЯБЛОКО (+28 СЫТОСТИ)');updateHud();}else showToast('ТЫ НЕ ГОЛОДЕН');}
  else if(selected===1&&hasAxe){showToast('ТОПОР ГОТОВ. ЛКМ — РУБИТЬ');}
  else showToast('ПОКА НЕЧЕГО ИСПОЛЬЗОВАТЬ');
}
function nearestEnemy(){let best=null;for(const e of enemies){const d=e.mesh.position.distanceTo(camera.position);if(!best||d<best.distance)best={...e,distance:d};}return best;}
function spawnEnemy(){
  const angle=Math.random()*Math.PI*2,dist=13+Math.random()*7;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.75,1.7,.55),mat.zombie);mesh.position.set(camera.position.x+Math.cos(angle)*dist,.85,camera.position.z+Math.sin(angle)*dist);mesh.castShadow=true;scene.add(mesh);enemies.push({mesh,hp:3,attack:0});
}
function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i],p=e.mesh.position;const dx=camera.position.x-p.x,dz=camera.position.z-p.z,d=Math.hypot(dx,dz);
    if(d>1.25){p.x+=dx/d*dt*.85;p.z+=dz/d*dt*.85;e.mesh.rotation.y=Math.atan2(dx,dz);}
    else{e.attack+=dt;if(e.attack>1.4){health=Math.max(0,health-7);e.attack=0;updateHud();showToast('ТЕБЯ АТАКУЮТ!');}}
  }
}
function updateDay(dt){
  dayTime+=dt*2.2;if(dayTime>=1440){dayTime-=1440;day++;}
  const phase=dayTime/1440*Math.PI*2,dayFactor=Math.max(.12,Math.sin(phase-Math.PI/2)*.5+.5);
  const sky=new THREE.Color().setRGB(.035+dayFactor*.55,.055+dayFactor*.62,.09+dayFactor*.66);
  scene.background.copy(sky);scene.fog.color.copy(sky);scene.userData.sun.intensity=.25+dayFactor*2;
  scene.userData.sun.position.set(Math.cos(phase)*28,Math.max(4,Math.sin(phase)*35),12);
  ui.weather.textContent=dayFactor<.25?'НОЧЬ · ОПАСНОСТЬ РЯДОМ':dayFactor<.5?'СУМЕРКИ':'ТИХО В ЛЕСУ';
  if(Math.floor(dayTime/60)!==lastClock){lastClock=Math.floor(dayTime/60);updateHud();}
}
function survival(dt){
  lastSurvival+=dt;if(lastSurvival<1)return;lastSurvival=0;
  hunger=Math.max(0,hunger-.18);
  if(hunger<=0)health=Math.max(0,health-2.5);
  else if(hunger>75&&health<100)health=Math.min(100,health+.25);
  if(health<=0)gameOver();
  updateHud();
  if(dayTime>18*60&&Math.random()<.12&&enemies.length<4)spawnEnemy();
}
function gameOver(){dead=true;started=false;exitPointer();ui.hud.classList.add('hidden');ui.death.classList.remove('hidden');$('deathStats').textContent=`Ты продержался до ${day}-го дня. Добыто дерева: ${wood}, камня: ${stone}.`; }
function saveGame(){
  const data={health,hunger,wood,stone,day,dayTime,hasAxe,pos:camera.position.toArray(),yaw:controls.yaw};
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch(e){showToast('НЕ УДАЛОСЬ СОХРАНИТЬ');}
}
function loadGame(){try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}}
function applySave(s){health=s.health??100;hunger=s.hunger??100;wood=s.wood??0;stone=s.stone??0;day=s.day??1;dayTime=s.dayTime??480;hasAxe=!!s.hasAxe;if(s.pos)camera.position.fromArray(s.pos);controls.yaw=s.yaw??0;camera.rotation.y=controls.yaw;updateHud();}
let audioCtx=null,musicOn=true,musicTimer=null;
function startMusic(){
  if(!musicOn||audioCtx)return;
  try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();playAmbient();}catch(e){audioCtx=null;}
}
// Original procedural ambient: soft evolving pads and sparse notes, not a Minecraft recording.
function playAmbient(){
  if(!audioCtx)return;
  const now=audioCtx.currentTime;
  const master=audioCtx.createGain();master.gain.value=.035;master.connect(audioCtx.destination);
  const notes=[110,164.81,220,146.83,196,246.94];
  notes.forEach((freq,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();osc.type='sine';osc.frequency.value=freq;filter.type='lowpass';filter.frequency.value=650;gain.gain.value=.0001;osc.connect(filter);filter.connect(gain);gain.connect(master);gain.gain.setTargetAtTime(.18/(i+1),now+i*.22,1.8);gain.gain.setTargetAtTime(.0001,now+10+i*.2,2.5);osc.start(now+i*.22);osc.stop(now+15);});
  musicTimer=setTimeout(()=>{master.disconnect();if(started&&!paused&&musicOn)playAmbient();},14500);
}
function toggleMusic(){musicOn=!musicOn;$('soundBtn').textContent=musicOn?'♫':'♪';if(!musicOn){if(audioCtx){audioCtx.close();audioCtx=null;}clearTimeout(musicTimer);}else if(started)startMusic();}
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
  if(started&&!paused&&!dead){
    move(dt);updateDay(dt);updateEnemies(dt);survival(dt);
    for(const c of (scene.userData.clouds||[]))c.position.x+=c.userData.drift*dt;
    const target=getTarget();ui.prompt.textContent=target?(target.userData.kind==='tree'?'ЛКМ — РУБИТЬ ДЕРЕВО':'ЛКМ — ДОБЫТЬ КАМЕНЬ'):'';
  }
  renderer.render(scene,camera);
}
init();
