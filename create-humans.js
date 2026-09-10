import * as THREE from 'three';
import { HUMAN_LAYOUTS, HUMAN_JOINTS } from './human-parts.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Create one person or an instanced crowd. Returns a THREE.Group; call group.userData.dispose() when finished. */
export async function createHumans(settings = {}) {
 const options={count:1,variant:'mixed',skin:'mixed',build:'mixed',face:'mixed',hair:'mixed',clothing:'hide',carrying:'none',environmentProps:false,action:'walking',ageMin:20,ageMax:45,spacing:1.05,seed:0,...settings};
 // Preserve older calls which specified a load without an explicit action.
 if(settings.action===undefined && options.carrying!=='none')options.action='walking-carrying';
 const {count,spacing,positions,ageMin:minAge,ageMax:maxAge,seed:variationSeed}=options;
 if(!Number.isInteger(count)||count<1)throw new Error('count must be a positive integer');
 if(!Number.isFinite(minAge)||!Number.isFinite(maxAge)||minAge<3||maxAge>100||minAge>maxAge)throw new Error('Age range must be ordered and within 3–100');
 if(!Number.isFinite(spacing)||spacing<=0||!Number.isInteger(variationSeed))throw new Error('Use positive spacing and an integer seed');
 if(positions && (positions.length!==count||positions.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))))throw new Error('positions must have one [x,y,z] per person');
 for(const [key,allowed] of Object.entries({variant:['mixed','male','female'],skin:['mixed',...Array.from({length:8},(_,i)=>String(i))],build:['mixed','slim','average','broad','full'],face:['mixed','soft','angular','wide'],hair:['mixed','cropped','swept','bob','curls','bald','long'],action:['walking','walking-carrying','standing','cutting','picking-fruit','picking-vegetables','sitting-raft','mining','hoeing'],clothing:['hide','none'],carrying:['none','mixed','fruit','vegetables','meat','livestock','fish']})){
  if(!allowed.includes(String(options[key])))throw new Error(`Invalid ${key}: ${options[key]}`);
 }
 const modelUrls={male:new URL('./human-male.glb',import.meta.url).href,female:new URL('./human-female.glb',import.meta.url).href,...settings.modelUrls};
 const result=new THREE.Group();result.name='Humans';const crowds=[];
 const layout=HUMAN_LAYOUTS.male;
 const partNames=layout.map(p=>p.name),partStarts=layout.map(p=>p.start),partCounts=layout.map(p=>p.count),partParents=layout.map(p=>p.parent);
 const personRefs=Array.from({length:count},()=>[]),personKeys=[];
 // 16 RGBA matrices per person, tiled into rows to support large crowds.
 const poseColumns=Math.min(count,64),poseWidth=poseColumns*64;
 const poseData=new Float32Array(poseWidth*Math.ceil(count/poseColumns)*4);
 const poseTexture=new THREE.DataTexture(poseData,poseWidth,Math.ceil(count/poseColumns),THREE.RGBAFormat,THREE.FloatType);
 poseTexture.needsUpdate=true;
 const poseOffset=i=>(Math.floor(i/poseColumns)*poseWidth+(i%poseColumns)*64)*4;
 function registerBatch(mesh,indices,attachment=0){
  mesh.geometry.setAttribute('posePersonId',new THREE.InstancedBufferAttribute(new Float32Array(indices),1));
  if(!mesh.geometry.hasAttribute('bodyPartId'))mesh.geometry.setAttribute('bodyPartId',new THREE.Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count).fill(attachment),1));
  indices.forEach((i,slot)=>personRefs[i].push({mesh,slot}));
  // GPU poses may extend beyond the static geometry bounds.
  mesh.frustumCulled=false;
 }
 const models = {};
 for (const name of ['male','female']) {
  const gltf=await new GLTFLoader().loadAsync(modelUrls[name]);
  const model=gltf.scene.getObjectByName('Human');
  if(model.userData.rigVersion!==1 || model.geometry.attributes.position.count!==partCounts.reduce((a,b)=>a+b,0))throw new Error('Use the rig-ready v0.3 GLBs shipped with this module');
  models[name]=model;
 }
 // Cache four proportion variants per model; head size is preserved across builds.
 const builds=['slim','average','broad','full'];
 const geometries={};
 const smooth=(a,b,v)=>{const t=THREE.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
 for(const [name,model] of Object.entries(models)){
  for(const build of builds){
   const geometry=model.geometry.clone();
   const position=geometry.attributes.position;
   const limbIds=new Float32Array(position.count),partIds=new Float32Array(position.count);
   layout.forEach((p,id)=>{
    const limb=/Thigh$/.test(p.name)?1:/Calf$|Foot$/.test(p.name)?2:/UpperArm$|Forearm$|Hand$/.test(p.name)?3:0;
    limbIds.fill(limb,p.start,p.start+p.count);partIds.fill(id,p.start,p.start+p.count);
   });
   geometry.setAttribute('bodyPartId',new THREE.Float32BufferAttribute(partIds,1));
   geometry.setAttribute('limbId',new THREE.BufferAttribute(limbIds,1));
   function deformPoint(x,y,z){
    const body=1-smooth(1.39,1.52,y),waist=Math.exp(-Math.pow((y-1.10)/.23,2)),shoulder=Math.exp(-Math.pow((y-1.34)/.16,2));
    let w=1,d=1;
    if(build==='slim'){w-=.18*body;d-=.19*body;}
    if(build==='broad'){w+=body*(.10+.22*shoulder);d+=body*(.09+.12*shoulder);}
    if(build==='full'){w+=body*(.21+.27*waist);d+=body*(.25+.40*waist);}
    return new THREE.Vector3(x*w,y,z*d);
   }
   geometry.userData.bindPivots=HUMAN_LAYOUTS[name].map(p=>deformPoint(...p.pivot));
   for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const body=1-smooth(1.39,1.52,y);
    const waist=Math.exp(-Math.pow((y-1.10)/.23,2));
    const shoulders=Math.exp(-Math.pow((y-1.34)/.16,2));
    let width=1,depth=1;
    if(build==='slim'){width-=.18*body;depth-=.19*body;}
    if(build==='broad'){width+=body*(.10+.22*shoulders);depth+=body*(.09+.12*shoulders);}
    if(build==='full'){width+=body*(.21+.27*waist);depth+=body*(.25+.40*waist);}
    position.setXYZ(i,x*width,y,z*depth);
   }
   const jointArrays=[[],[],[]],segments=[];
   for(let v=0;v<position.count;v++){
    const id=partIds[v],right=id>=9,side=right?1:-1;
    for(const [j,key] of ['shoulder','elbow','wrist'].entries()){
     const p=HUMAN_JOINTS[name][key];jointArrays[j].push(...deformPoint(p[0]*side,p[1],p[2]).toArray());
    }
    segments.push(id===(right?12:6)?0:id===(right?13:7)?1:id===(right?14:8)?2:-1);
   }
   ['restShoulder','restElbow','restWrist'].forEach((key,j)=>geometry.setAttribute(key,new THREE.Float32BufferAttribute(jointArrays[j],3)));
   geometry.setAttribute('armSegment',new THREE.Float32BufferAttribute(segments,1));
   geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
   geometries[`${name}-${build}`]=geometry;
  }
 }
 // Stable independent values keep height, build, and model from being correlated.
 const random=(i,seed)=>{let n=Math.imul(i+1,747796405)^seed^variationSeed;n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;};

 const detailMaterial=new THREE.MeshStandardMaterial({roughness:.9});
 const faceTypes=['soft','angular','wide'],hairTypes=['cropped','swept','bob','curls','bald','long'];
 // Artistic age-to-appearance mapping, not a biological prediction.
 function appearance(i,minAge,maxAge){
  const age=minAge+random(i,48371)*(maxAge-minAge);
  const growth=[[3,.96],[5,1.10],[8,1.28],[11,1.44],[14,1.61],[18,1.73],[25,1.75],[55,1.75],[75,1.71],[100,1.66]];
  let k=1;while(k<growth.length-1&&age>growth[k][0])k++;
  const [a,h]=growth[k-1],[b,h2]=growth[k];
  const base=h+(h2-h)*(age-a)/(b-a);
  const metres=base+(random(i,82139)-.5)*(age<18?.09:.14);
  // Childhood tends lighter, adulthood darker, later years lighter brown.
  const shade=THREE.MathUtils.clamp(.30+.32*(1-smooth(5,22,age))+.42*smooth(45,100,age)+(random(i,87321)-.5)*.24,0,1);
  const hairColor=new THREE.Color(0x302017).lerp(new THREE.Color(0xb38a60),shade);
  return {age,metres,hairColor};
 }
 const details={};
 function box(x,y,z,w,h,d){const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.translate(x,y,z);return g;}
 function ball(x,y,z,w,h,d){const g=new THREE.SphereGeometry(1,8,5).toNonIndexed();g.scale(w,h,d);g.translate(x,y,z);return g;}
 function merged(parts){const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;}
 for(const type of faceTypes){
  const spread=type==='wide'?.039:type==='soft'?.029:.032;
  const eyeHeight=type==='soft'?.011:.008;
  const marks=[];
  for(const sign of [-1,1]){
   marks.push(box(sign*spread,1.634,.072,.014,eyeHeight,.008));
   const brow=box(sign*spread,1.658,.073,.022,.004,.006);marks.push(brow);
  }
  marks.push(box(0,1.563,.071,type==='wide'?.033:.026,.004,.007));
  details['face-'+type]=merged(marks);
  details['nose-'+type]=merged([ball(0,1.601,.075,type==='angular'?.014:.012,.023,type==='angular'?.023:.017),ball(-.077,1.617,0,.016,.027,.018),ball(.077,1.617,0,.016,.027,.018)]);
 }
 for(const type of hairTypes.filter(t=>t!=='bald')){
  const cap=new THREE.SphereGeometry(1,10,4,0,Math.PI*2,0,Math.PI/2).toNonIndexed();cap.scale(.098,.078,.091);cap.translate(0,1.685,0);
  const parts=[cap];
  if(type==='cropped')parts.push(box(0,1.672,-.059,.138,.052,.046));
  if(type==='swept'){
   const fringe=box(-.025,1.689,.062,.114,.043,.045);parts.push(fringe,box(0,1.65,-.058,.145,.10,.052));
  }
  if(type==='bob')parts.push(box(0,1.601,-.060,.181,.19,.056),box(-.082,1.608,0,.032,.18,.13),box(.082,1.608,0,.032,.18,.13));
  if(type==='long'){
   // Hair falls behind the shoulders, with two narrower front sections.
   parts.push(box(0,1.47,-.077,.19,.40,.056),
    box(-.085,1.525,-.01,.034,.32,.105),box(.085,1.525,-.01,.034,.32,.105),
    box(-.105,1.38,.066,.035,.18,.036),box(.105,1.38,.066,.035,.18,.036));
  }
  if(type==='curls'){
   for(let i=0;i<9;i++){const a=i*Math.PI*2/9;parts.push(ball(Math.cos(a)*.078,1.697+Math.sin(i*2)*.012,Math.sin(a)*.073,.034,.035,.033));}
   parts.push(ball(0,1.757,0,.066,.035,.061));
  }
  details['hair-'+type]=merged(parts);
 }


 const hideMaterial=new THREE.MeshStandardMaterial({roughness:1,vertexColors:true,side:THREE.DoubleSide});
 const hideColors=[0x967047,0xb18a59,0x715039,0xc2a174,0x806044];
 // Open neckline and uneven open hem; a single low-poly hide shell per build.
 function hideGeometry(name,build){
  const rings=[[.72,.213,.141],[.97,.199,.137],[1.175,.162,.118],[1.355,.224,.14],[1.44,.184,.118],[1.455,.069,.064]];
  const pts=[],tints=[];const n=12;
  const point=(r,i)=>{
   const [y,rx,rz]=rings[r],a=2*Math.PI*(i%n)/n;
   const yy=y+(r===0?([0,.023,-.029,.013,-.017,.035][i%6]):0);
   const body=1-smooth(1.39,1.52,yy),waist=Math.exp(-Math.pow((yy-1.10)/.23,2)),shoulder=Math.exp(-Math.pow((yy-1.34)/.16,2));
   let w=1,d=1;
   if(build==='slim'){w-=.18*body;d-=.19*body;}
   if(build==='broad'){w+=body*(.10+.22*shoulder);d+=body*(.09+.12*shoulder);}
   if(build==='full'){w+=body*(.21+.27*waist);d+=body*(.25+.40*waist);}
   // Same fitting deformation as the body, with clearance for both silhouettes.
   return [Math.cos(a)*rx*w,yy,Math.sin(a)*rz*d+.006];
  };
  function triangle(a,b,c,t){pts.push(...a,...b,...c);for(let j=0;j<3;j++)tints.push(t,t*.98,t*.94);}
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<n;i++){
   const a=point(r,i),b=point(r+1,i),c=point(r+1,i+1),d=point(r,i+1);
   const tone=.85+random(r*n+i,7123)*.15;
   triangle(a,b,c,tone);triangle(a,c,d,tone);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));g.computeVertexNormals();return g;
 }
 for(const name of ['male','female'])for(const build of builds)details[`hide-${name}-${build}`]=hideGeometry(name,build);

  const cargoTypes=['fruit','vegetables','meat','livestock','fish'];
 function painted(g,color){const c=new THREE.Color(color),a=[];for(let i=0;i<g.attributes.position.count;i++)a.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return g;}
 function basket(){return [painted(box(0,1.035,.43,.48,.19,.28),0x896039),painted(box(0,1.136,.43,.50,.022,.30),0xb08a53)];}
 {
  const parts=basket();
  for(let i=0;i<8;i++)parts.push(painted(ball((i%4-1.5)*.105,1.17+Math.floor(i/4)*.012,.37+Math.floor(i/4)*.12,.053,.051,.05),[0xb4432d,0xd9a23b,0x739249][i%3]));
  details['cargo-fruit']=merged(parts);
 }
 {
  const parts=basket();
  for(let i=0;i<4;i++){
   parts.push(painted(ball((i-1.5)*.105,1.16,.43,.048,.052,.085),0x55753a));
   parts.push(painted(ball((i-1.5)*.105,1.22,.46,.06,.07,.025),0x729548));
  }
  parts.push(painted(box(.06,1.19,.34,.19,.025,.027),0xc88135));
  details['cargo-vegetables']=merged(parts);
 }
 {
  // Small lamb held horizontally in front of the torso.
  const parts=[painted(ball(0,1.12,.43,.235,.125,.12),0xd8c9a7),painted(ball(.225,1.20,.43,.09,.10,.073),0xbaa98a)];
  for(const x of [-.14,.13])for(const z of [.37,.49])parts.push(painted(box(x,.975,z,.032,.15,.032),0x917658));
  parts.push(painted(ball(.235,1.245,.335,.06,.018,.04),0xbaa98a),painted(ball(.235,1.245,.525,.06,.018,.04),0xbaa98a));
  parts.push(painted(ball(.269,1.217,.491,.009,.009,.009),0x29251f),painted(ball(.283,1.173,.452,.032,.025,.028),0x6d5945));
  details['cargo-livestock']=merged(parts);
 }


 {
  const parts=basket();
  // Stylized meat cuts, pale fat edges, and a bone-in joint.
  parts.push(painted(ball(-.10,1.18,.43,.092,.048,.08),0x9a493c),painted(ball(.08,1.18,.44,.10,.057,.078),0xa95a48));
  parts.push(painted(box(-.10,1.221,.43,.115,.01,.023),0xdebda1));
  parts.push(painted(box(.15,1.20,.36,.13,.022,.025),0xead7b5),painted(ball(.217,1.20,.36,.021,.021,.023),0xead7b5));
  details['cargo-meat']=merged(parts);
 }
 {
  const parts=basket();
  for(let i=0;i<3;i++){
   const z=.345+i*.086,y=1.17+(i%2)*.016;
   parts.push(painted(ball(-.015,y,z,.155,.037,.035),[0x718b86,0x8e9b96,0x647e89][i]));
   const tail=new THREE.ConeGeometry(.046,.083,3).toNonIndexed();tail.rotateZ(-Math.PI/2);tail.translate(-.174,y,z);parts.push(painted(tail,0x546e71));
   parts.push(painted(ball(.11,y+.025,z+.014,.008,.007,.007),0x202b2c));
   parts.push(painted(box(-.005,y+.031,z,.13,.008,.012),0xaebbb3));
  }
  details['cargo-fish']=merged(parts);
 }

 // Lightweight procedural gait: shared GPU animation, no per-person CPU updates.

 const stationMaterial=new THREE.MeshStandardMaterial({roughness:1,vertexColors:true});
 details['station-cutting']=merged([painted(box(0,.43,.56,.48,.86,.30),0x745035),painted(box(0,.87,.56,.53,.05,.34),0xb09261),painted(ball(-.04,.93,.56,.09,.04,.055),0x778d3c)]);
 details['station-picking-fruit']=merged([painted(box(.28,1.03,.76,.06,2.06,.06),0x6a5036),painted(ball(.17,1.96,.68,.29,.25,.20),0x4d713d),painted(ball(.27,1.81,.48,.046,.049,.043),0xb35c32),painted(ball(.10,1.94,.48,.044,.047,.043),0xc58c35)]);
 details['station-picking-vegetables']=merged([painted(box(0,.025,.62,.55,.05,.40),0x74543a),...[-.16,0,.16].map(x=>painted(ball(x,.14,.61,.095,.12,.09),0x557b3c))]);
 details['tool-knife']=merged([painted(box(.267,.76,.018,.035,.13,.035),0x5b402d),painted(box(.267,.665,.018,.075,.09,.014),0xa3a7a0)]);
 const toolMaterial=new THREE.MeshStandardMaterial({roughness:.7,vertexColors:true});


 {
  const logs=[];
  for(let i=0;i<5;i++)logs.push(painted(ball((i-2)*.19,.09,.32,.105,.09,.83),0x896640));
  logs.push(painted(box(0,.23,.0,.73,.28,.28),0x735035),painted(box(0,.16,-.19,.91,.025,.045),0x574431),painted(box(0,.16,.83,.91,.025,.045),0x574431));
  details['station-sitting-raft']=merged(logs);
 }
 details['station-mining']=merged([painted(ball(.21,.38,.69,.32,.38,.28),0x777975),painted(ball(-.11,.11,.72,.14,.11,.16),0x92938a)]);
 details['tool-pickaxe']=merged([painted(box(.267,.60,.018,.033,.49,.033),0x705133),painted(box(.267,.38,.018,.33,.046,.044),0x777c7a)]);

 // Fit the grip to the same build-dependent hand offset as the body.
 details['tool-hoe']=merged([painted(box(.267,.55,.018,.033,.62,.033),0x705133),painted(box(.267,.25,.072,.16,.035,.15),0x777c7a)]);
 for(const tool of ['knife','pickaxe','hoe'])for(const build of builds){
  const g=details['tool-'+tool].clone();
  const y=.79,body=1-smooth(1.39,1.52,y),waist=Math.exp(-Math.pow((y-1.10)/.23,2)),shoulder=Math.exp(-Math.pow((y-1.34)/.16,2));
  let w=1,d=1;
  if(build==='slim'){w-=.18*body;d-=.19*body;}
  if(build==='broad'){w+=body*(.10+.22*shoulder);d+=body*(.09+.12*shoulder);}
  if(build==='full'){w+=body*(.21+.27*waist);d+=body*(.25+.40*waist);}
  if(tool==='knife')g.translate(.275*w-.267,-.015,.024*d-.018);else g.translate(.008,-.015,.006);
  details['tool-'+tool+'-'+build]=g;
 }
 const actionPose={value:0};
 const carryPose={value:0};
 const gait={time:{value:0},amount:{value:1},speed:{value:1}};
 function animateMaterial(material,part){
  material.onBeforeCompile=shader=>{
   shader.uniforms.personPoses={value:poseTexture};shader.uniforms.poseColumns={value:poseColumns};
   shader.uniforms.actionPose=actionPose;shader.uniforms.carryPose=carryPose;shader.uniforms.walkTime=gait.time;shader.uniforms.walkAmount=gait.amount;shader.uniforms.walkSpeed=gait.speed;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    ${part==='body'?'attribute float limbId; attribute vec3 restShoulder; attribute vec3 restElbow; attribute vec3 restWrist; attribute float armSegment;':''}
    attribute float posePersonId; attribute float bodyPartId;
    uniform sampler2D personPoses; uniform int poseColumns;
    ivec2 personTexel(int offset){int i=int(posePersonId+.5);return ivec2((i%poseColumns)*64+offset,i/poseColumns);}
    mat4 partPose(){int col=int(bodyPartId+.5)*4;return mat4(texelFetch(personPoses,personTexel(col),0),texelFetch(personPoses,personTexel(col+1),0),texelFetch(personPoses,personTexel(col+2),0),texelFetch(personPoses,personTexel(col+3),0));}
    uniform float actionPose; uniform float carryPose; uniform float walkTime; uniform float walkAmount; uniform float walkSpeed;
    vec3 alignBone(vec3 v,vec3 a,vec3 b){a=normalize(a);b=normalize(b);vec3 c=cross(a,b);return v+cross(c,v)+cross(c,cross(c,v))/max(0.001,1.0+dot(a,b));}
    vec3 gaitRotate(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
   `);
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    float gaitSeed=0.0;
    #ifdef USE_INSTANCING
      gaitSeed=posePersonId*2.39996323+instanceMatrix[1].y*13.7;
    #endif
    float gaitPhase=walkTime*walkSpeed*(5.5+0.35*sin(gaitSeed))+gaitSeed;
    float gaitSide=position.x<0.0?-1.0:1.0;
    float workCycle=sin(gaitPhase*.50);
    float workAngle=actionPose==6.0?-0.48+0.26*workCycle:-1.05+0.68*workCycle;
    vec3 workGrip=actionPose==6.0?vec3(.015,1.01,.40):vec3(.015,1.13,.36);
    float gaitAngle=0.0;
    float gaitPivot=0.0;
    ${part==='body'?`if(limbId==1.0 || limbId==2.0){gaitAngle=sin(gaitPhase)*gaitSide*0.40*walkAmount;gaitPivot=0.925;}
    else if(limbId==3.0){gaitAngle=mix(-sin(gaitPhase)*gaitSide*0.32*walkAmount,-0.95,carryPose);gaitPivot=1.385;}`:''}
    ${part==='body'?`if(limbId==3.0){
      if(actionPose==1.0)gaitAngle=position.x>0.0?-1.05+0.25*sin(gaitPhase*1.3):-1.05;
      if(actionPose==2.0)gaitAngle=position.x>0.0?-2.35+0.14*sin(gaitPhase):-0.4;
      if(actionPose==3.0)gaitAngle=-0.3+0.12*sin(gaitPhase);
      if(actionPose==4.0)gaitAngle=-0.75;
      if(actionPose==5.0)gaitAngle=-1.5+0.85*sin(gaitPhase*.7);
      if(actionPose>0.0)gaitPivot=1.385;
    }`:''}
    ${part==='tool'?`gaitAngle=actionPose==5.0?-1.5+0.85*sin(gaitPhase*.7):-1.05+0.25*sin(gaitPhase*1.3);gaitPivot=1.385;`:''}
    ${part==='body'?`if(actionPose==4.0 && (limbId==1.0 || limbId==2.0)){gaitAngle=limbId==2.0?-0.6:-1.4;gaitPivot=0.925;}`:''}
    ${part==='cloth'?`if(actionPose==4.0){gaitAngle=-1.4*(1.0-smoothstep(.88,1.02,position.y));gaitPivot=.94;}`:''}
    float bend=actionPose==3.0?${part==='body'?'(limbId==3.0?0.95:limbId>0.0?0.0:0.95*smoothstep(.88,1.04,position.y))':part==='cloth'?'0.95*smoothstep(.88,1.04,position.y)':'0.95'}:0.0;
    if(actionPose>=5.0)bend=${part==='body'?'(limbId==3.0?1.0:limbId>0.0?0.0:smoothstep(.87,1.08,position.y))':part==='cloth'?'smoothstep(.87,1.08,position.y)':'1.0'}*(actionPose==6.0?.46:.16+.11*(1.0-workCycle));
    ${part==='body'?`vec3 workElbow=vec3(0.0),workHand=vec3(0.0);
    if(actionPose>=5.0 && limbId==3.0){
     workHand=workGrip+gaitRotate(vec3(0.0,position.x<0.0?.10:-.07,0.0),workAngle);
     vec3 delta=workHand-restShoulder;float l1=length(restElbow-restShoulder),l2=length(restWrist-restElbow);
     float dist=clamp(length(delta),.05,l1+l2-.002);vec3 dir=normalize(delta);
     float along=(l1*l1-l2*l2+dist*dist)/(2.0*dist);
     vec3 outward=vec3(gaitSide,-.4,-.15);vec3 plane=normalize(outward-dir*dot(outward,dir));
     workElbow=restShoulder+dir*along+plane*sqrt(max(0.0,l1*l1-along*along));
     workHand=restShoulder+dir*dist;
     objectNormal=armSegment<.5?alignBone(objectNormal,restElbow-restShoulder,workElbow-restShoulder):alignBone(objectNormal,restWrist-restElbow,workHand-workElbow);
     gaitAngle=0.0;
    }`:''}
    ${part==='tool'?`if(actionPose>=5.0)gaitAngle=workAngle;`:''}
    objectNormal=gaitRotate(gaitRotate(objectNormal,gaitAngle),bend);
    bool manualPose=texelFetch(personPoses,personTexel(60),0).x>.5;
    mat4 manualTransform=mat4(1.0);
    if(manualPose){manualTransform=partPose();objectNormal=transpose(inverse(mat3(manualTransform)))*normal;}
   `);
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed=gaitRotate(transformed-vec3(0.0,gaitPivot,0.0),gaitAngle)+vec3(0.0,gaitPivot,0.0);
    ${part==='body'?`if(actionPose>=5.0 && limbId==3.0){
     transformed=armSegment<.5?restShoulder+alignBone(position-restShoulder,restElbow-restShoulder,workElbow-restShoulder):workElbow+alignBone(position-restElbow,restWrist-restElbow,workHand-workElbow);
    }`:''}
    ${part==='tool'?`if(actionPose>=5.0)transformed=workGrip+gaitRotate(position-vec3(.275,.79,.024),workAngle);`:''}
    ${part==='cloth'?`transformed.z+=sin(gaitPhase+position.y*4.0)*0.025*(1.0-smoothstep(0.72,1.18,position.y))*walkAmount;`:''}
    transformed=gaitRotate(transformed-vec3(0.0,.85,0.0),bend)+vec3(0.0,.85,0.0);
    if(actionPose==4.0){
     ${part==='body'?`if(limbId==2.0){transformed=gaitRotate(position-vec3(0.0,.495,0.0),-.6)+vec3(0.0,.925-.430*cos(1.4),.430*sin(1.4));}`:''}
     transformed.y-=.50;
    }
    ${part==='body'?`if(actionPose>=5.0 && (limbId==1.0 || limbId==2.0)){transformed.x+=gaitSide*.025;transformed.z+=gaitSide*.065;}`:''}
    transformed.y+=0.018*(1.0+cos(gaitPhase*2.0))*walkAmount;
    if(manualPose)transformed=(manualTransform*vec4(position,1.0)).xyz;
   `);
  };
  material.customProgramCacheKey=()=>`human-walk-${part}-v3`;
 }
 for(const model of Object.values(models))animateMaterial(model.material,'body');
 animateMaterial(toolMaterial,'tool');animateMaterial(detailMaterial,'detail');animateMaterial(hideMaterial,'cloth');

 const appearances=Array.from({length:count},(_,i)=>appearance(i,minAge,maxAge));
  const variant=options.variant;
  const columns=count<=3?count:Math.ceil(Math.sqrt(count));const rows=Math.ceil(count/columns);
  const obj=new THREE.Object3D();const colors=[0xf3d6c4,0xe9bfa5,0xd9a382,0xc58b65,0xac704e,0x8b5438,0x633c2b,0x40271f];
  const skin=options.skin;
  const build=options.build;
  const face=options.face,hair=options.hair;
  const action=options.action;
  actionPose.value=({'cutting':1,'picking-fruit':2,'picking-vegetables':3,'sitting-raft':4,'mining':5,'hoeing':6})[action]??0;
  gait.amount.value=(action==='walking'||action==='walking-carrying')?1:0;
  const carrying=action==='walking-carrying'?(options.carrying==='none'?'mixed':options.carrying):action==='standing'?options.carrying:'none';
  carryPose.value=carrying==='none'?0:1;
  const extraGroups={};
  const people=[];
  const groups={};
  for(let i=0;i<count;i++){
   const name=variant==='mixed'?(i%2?'female':'male'):variant;
   const shape=build==='mixed'?builds[Math.floor(random(i,9173)*builds.length)]:build;
   const key=`${name}-${shape}`;
   personKeys[i]=key;
   (groups[key]??=[]).push(i);
   if(options.environmentProps && actionPose.value>0 && action!=='hoeing')(extraGroups['station-'+action]??=[]).push(i);
   if(action==='cutting')(extraGroups['tool-knife-'+shape]??=[]).push(i);
   if(action==='mining')(extraGroups['tool-pickaxe-'+shape]??=[]).push(i);
   if(action==='hoeing')(extraGroups['tool-hoe-'+shape]??=[]).push(i);
   if(carrying!=='none'){const cargo=carrying==='mixed'?cargoTypes[i%cargoTypes.length]:carrying;(extraGroups['cargo-'+cargo]??=[]).push(i);}
   if(options.clothing==='hide')(extraGroups['hide-'+key]??=[]).push(i);
   const faceType=face==='mixed'?faceTypes[Math.floor(random(i,3427)*3)]:face;
   // Varied hair: female models favor below-shoulder hair; manual style selections still apply to everyone.
   const hairRoll=random(i,7847);
   const hairType=hair==='mixed'?(name==='female'?(hairRoll<.75?'long':hairRoll<.90?'bob':hairRoll<.95?'curls':hairRoll<.98?'swept':hairRoll<.995?'cropped':'bald'):hairTypes[Math.floor(hairRoll*5)]):hair;
   for(const detail of ['face-'+faceType,'nose-'+faceType,...(hairType==='bald'?[]:['hair-'+hairType])]) (extraGroups[detail]??=[]).push(i);
  }
  for(const [name,indices] of Object.entries(groups)){
   if(!indices.length)continue;
   const model=models[name.split('-')[0]];
   const crowd=new THREE.InstancedMesh(geometries[name],model.material,indices.length);
   indices.forEach((i,j)=>{
    obj.position.fromArray(positions?.[i] ?? [(i%columns-(columns-1)/2)*spacing,0,(Math.floor(i/columns)-(rows-1)/2)*spacing]);
    const metres=appearances[i].metres;
    const widthScale=Math.min(1,metres/1.735);
    obj.scale.set(widthScale,metres/1.735,widthScale);obj.updateMatrix();
    people[i]=obj.matrix.clone();
    crowd.setMatrixAt(j,obj.matrix);crowd.setColorAt(j,new THREE.Color(colors[skin==='mixed'?(count===1?3:Math.round(i*(colors.length-1)/(count-1))):Number(skin)]));
   });
   registerBatch(crowd,indices);
   crowd.instanceMatrix.needsUpdate=true;crowd.instanceColor.needsUpdate=true;crowd.computeBoundingSphere();result.add(crowd);crowds.push(crowd);
  }
  for(const [key,indices] of Object.entries(extraGroups)){
   const batch=new THREE.InstancedMesh(details[key],key.startsWith('station-')?stationMaterial:key.startsWith('tool-')?toolMaterial:(key.startsWith('hide-')||key.startsWith('cargo-'))?hideMaterial:detailMaterial,indices.length);
   indices.forEach((i,j)=>{
    batch.setMatrixAt(j,people[i]);
    const skinColor=colors[skin==='mixed'?(count===1?3:Math.round(i*(colors.length-1)/(count-1))):Number(skin)];
    const color=(key.startsWith('station-')||key.startsWith('tool-')||key.startsWith('cargo-'))?0xffffff:key.startsWith('hide-')?hideColors[Math.floor(random(i,97531)*hideColors.length)]:key.startsWith('nose')?skinColor:key.startsWith('face')?0x302420:appearances[i].hairColor;
    batch.setColorAt(j,new THREE.Color(color));
   });
   registerBatch(batch,indices,key.startsWith('hair-')||key.startsWith('face-')||key.startsWith('nose-')?2:key.startsWith('tool-')?14:0);
   batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();result.add(batch);crowds.push(batch);
  }

 // Call on every frame with elapsed seconds. Walking stays in place.
 result.userData.update=(elapsedSeconds,{walking=true,speed=1}={})=>{
  gait.time.value=elapsedSeconds;gait.amount.value=walking&&['walking','walking-carrying'].includes(options.action)?1:0;gait.speed.value=speed;
 };
 function assertPerson(index){if(disposed)throw new Error('Humans group is disposed');if(!Number.isInteger(index)||index<0||index>=count)throw new Error('Invalid person index');}
 function validMatrix(matrix){return matrix?.isMatrix4&&matrix.elements.every(Number.isFinite)&&Math.abs(matrix.determinant())>1e-10&&matrix.elements[3]===0&&matrix.elements[7]===0&&matrix.elements[11]===0&&matrix.elements[15]===1;}
 const identity=new THREE.Matrix4();
 result.userData.setPersonTransform=(index,matrix)=>{
  assertPerson(index);if(!validMatrix(matrix))throw new Error('Expected an invertible affine Matrix4');
  // User transform replaces placement, while retaining generated age scale.
  const height=appearances[index].metres/1.735,width=Math.min(1,height);
  const final=matrix.clone().multiply(new THREE.Matrix4().makeScale(width,height,width));
  for(const {mesh,slot} of personRefs[index]){mesh.setMatrixAt(slot,final);mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=null;mesh.boundingBox=null;}
 };
 result.userData.setPersonPose=(index,transforms)=>{
  assertPerson(index);
  if(!transforms||typeof transforms!=='object')throw new Error('Expected named model-space part matrices');
  for(const [name,matrix] of Object.entries(transforms))if(!partNames.includes(name)||!validMatrix(matrix))throw new Error(`Invalid part transform: ${name}`);
  const offset=poseOffset(index);
  partNames.forEach((name,id)=>(transforms[name]??identity).toArray(poseData,offset+id*16));
  poseData[offset+240]=1;poseTexture.needsUpdate=true;
 };
 result.userData.clearPersonPose=index=>{assertPerson(index);poseData[poseOffset(index)+240]=0;poseTexture.needsUpdate=true;};
 result.userData.getBodyParts=index=>{
  assertPerson(index);const source=geometries[personKeys[index]],parts={};
  partNames.forEach((name,id)=>{
   const geometry=new THREE.BufferGeometry(),start=partStarts[id],length=partCounts[id];
   for(const key of ['position','normal'])geometry.setAttribute(key,new THREE.Float32BufferAttribute(source.attributes[key].array.slice(start*3,(start+length)*3),3));
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const pivot=source.userData.bindPivots[id].clone();
   parts[name]={geometry,pivot,parent:partParents[id]};
  });
  return parts;
 };
 result.userData.people=appearances.map((p,i)=>({index:i,age:p.age,height:p.metres}));
 let disposed=false;
 result.userData.dispose=()=>{
  if(disposed)return;disposed=true;result.removeFromParent();
  for(const batch of crowds)batch.dispose();
  for(const geometry of [...Object.values(geometries),...Object.values(details)])geometry.dispose();
  for(const model of Object.values(models)){model.geometry.dispose();model.material.dispose();}
  poseTexture.dispose();stationMaterial.dispose();toolMaterial.dispose();detailMaterial.dispose();hideMaterial.dispose();result.clear();
 };
 return result;
}
