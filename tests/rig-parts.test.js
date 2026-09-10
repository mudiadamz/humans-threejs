// Plain Node geometry checks: deliberately no Three.js import or GLTFLoader.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HUMAN_PARTS as parts,HUMAN_JOINTS as joints,HUMAN_LAYOUTS as layouts} from '../human-parts.js';
const points=part=>Array.from({length:part.positions.length/3},(_,i)=>Array.from(part.positions.slice(i*3,i*3+3)));
const center=points=>[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length);

test('straight-down limb ring centres within 1 mm; self-mirror within 2 mm',()=>{
 for(const name of ['thigh','calf','upperArm','forearm','hand']){
  const ps=points(parts[name]),ys=ps.map(p=>p[1]);
  const unique=[...new Map(ps.map(p=>[p.join(','),p])).values()];
  const top=center(unique.filter(p=>Math.abs(p[1]-Math.max(...ys))<1e-6)),bottom=center(unique.filter(p=>Math.abs(p[1]-Math.min(...ys))<1e-6));
  assert.ok(Math.abs(top[0]-bottom[0])<.001,name+' x drift');assert.ok(Math.abs(top[2]-bottom[2])<.001,name+' z drift');
 }
 for(const name of ['thigh','calf','upperArm','forearm','hand','foot']){
  const ps=points(parts[name]);
  for(const p of ps)assert.ok(ps.some(q=>Math.hypot(p[0]+q[0],p[1]-q[1],p[2]-q[2])<.002),name+' symmetry');
 }
});
test('joint table encodes straight chains and correct torso/neck/head pivots',()=>{
 for(const sex of ['male','female']){
  const j=joints[sex],ls=layouts[sex];
  for(const chain of [['shoulder','elbow','wrist'],['hip','knee','ankle']])for(const key of chain){assert.equal(j[key][0],j[chain[0]][0]);assert.equal(j[key][2],0);}
  assert.equal(ls.find(p=>p.name==='torso').pivot[1],.925);
  assert.equal(ls.find(p=>p.name==='neck').pivot[1],1.43);
  assert.equal(ls.find(p=>p.name==='head').pivot[1],1.5);
  assert.equal(j.knee[1],.495);
 }
 assert.equal(joints.male.shoulder[0],.182);assert.equal(joints.female.shoulder[0],.158);
 assert.equal(joints.male.hip[0],.104);assert.equal(joints.female.hip[0],.117);
});
test('rounded joint ends extend a full joint radius beyond bind centres',()=>{
 const config={thigh:[.43,.078,.05],calf:[.415,.05,.032],upperArm:[.31,.06,.035],forearm:[.28,.035,.026],hand:[.075,.026,.016]};
 for(const [name,[length,top,bottom]] of Object.entries(config)){
  const ys=points(parts[name]).map(p=>p[1]);
  assert.ok(Math.max(...ys)>=top-1e-6);assert.ok(Math.min(...ys)<=-length-bottom+1e-6);
  // Multiple curved rings, not a single planar end cap.
  assert.ok(new Set(ys.filter(y=>y>0).map(y=>y.toFixed(6))).size>=2);
  assert.ok(new Set(ys.filter(y=>y< -length-1e-6).map(y=>y.toFixed(6))).size>=2);
 }
});
test('GLBs match static joint-local arrays, shared limbs and grounded soles',()=>{
 for(const sex of ['male','female']){
  const bytes=readFileSync(new URL(`../human-${sex}.glb`,import.meta.url));
  const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+len));
  const binaryStart=28+len,view=json.bufferViews[json.accessors[0].bufferView];
  assert.equal(json.nodes[0].extras.rigVersion,1);
  let minY=Infinity,maxY=-Infinity;
  for(const entry of layouts[sex]){
   const part=parts[entry.key];assert.equal(entry.count,part.positions.length/3);
   for(let i=0;i<part.positions.length;i++){
    const actual=bytes.readFloatLE(binaryStart+(view.byteOffset??0)+(entry.start*3+i)*4);
    assert.ok(Math.abs(actual-part.positions[i]-entry.pivot[i%3])<1e-6);
    if(i%3===1){minY=Math.min(minY,actual);maxY=Math.max(maxY,actual);}
   }
  }
  assert.ok(Math.abs(minY)<1e-6);assert.ok(Math.abs(maxY-1.735)<1e-6);
 }
 for(let i=1;i<15;i++)assert.equal(layouts.male[i].key,layouts.female[i].key);
 assert.notDeepEqual(parts.torsoMale.positions,parts.torsoFemale.positions);
});

test('shared vertices have continuous unit normals for soft body shading',()=>{
 for(const [name,part] of Object.entries(parts)){
  const seen=new Map();
  for(let i=0;i<part.positions.length;i+=3){
   const key=Array.from(part.positions.slice(i,i+3)).join(',');
   const n=Array.from(part.normals.slice(i,i+3));
   assert.ok(Math.abs(Math.hypot(...n)-1)<1e-5,name+' unit normal');
   if(seen.has(key))assert.deepEqual(n,seen.get(key),name+' shading seam');else seen.set(key,n);
  }
 }
});
