import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUMAN_LAYOUTS } from '../human-parts.js';
import { createHumans } from '../create-humans.js';
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class{constructor(type,props){this.type=type;Object.assign(this,props);}};
const modelUrls=Object.fromEntries(['male','female'].map(n=>[n,'data:model/gltf-binary;base64,'+readFileSync(new URL(`../human-${n}.glb`,import.meta.url)).toString('base64')]));

test('all actions construct and animate without invalid bounds',async()=>{
 for(const action of ['walking','walking-carrying','standing','cutting','picking-fruit','picking-vegetables','sitting-raft','mining','hoeing']){
  const g=await createHumans({count:3,action,modelUrls});
  g.userData.update(1.5);
  assert.equal(g.userData.people.length,3);
  for(const mesh of g.children){assert.ok(mesh.isInstancedMesh);assert.ok(Number.isFinite(mesh.boundingSphere.radius));}
  g.userData.dispose();g.userData.dispose();assert.equal(g.children.length,0);
 }
});
test('empty handed walk suppresses a load; carrying walk adds it',async()=>{
 const a=await createHumans({action:'walking',carrying:'fruit',modelUrls});
 const b=await createHumans({action:'walking-carrying',carrying:'fruit',modelUrls});
 assert.equal(b.children.length,a.children.length+1);a.userData.dispose();b.userData.dispose();
});
test('whole arms keep identical limb tags across body builds',async()=>{
 for(const build of ['slim','average','broad','full']){
  const g=await createHumans({count:2,build,modelUrls});
  for(const mesh of g.children.filter(m=>m.geometry.hasAttribute('limbId'))){
   const ids=mesh.geometry.attributes.limbId.array;
   for(const part of HUMAN_LAYOUTS.male.filter(p=>/UpperArm$|Forearm$|Hand$/.test(p.name)))assert.ok(ids.slice(part.start,part.start+part.count).every(n=>n===3));
   for(const key of ['restShoulder','restElbow','restWrist'])assert.ok(mesh.geometry.attributes[key].array.every(Number.isFinite));
  }g.userData.dispose();
 }
});
test('rejects invalid inputs before loading',async()=>{
 await assert.rejects(createHumans({count:0}),/count/);
 await assert.rejects(createHumans({ageMin:70,ageMax:20}),/Age/);
 await assert.rejects(createHumans({action:'unknown'}),/action/);
});

test('per-person movement updates only that person in every batch',async()=>{
 const {Matrix4}=await import('three');
 const g=await createHumans({count:3,carrying:'fruit',modelUrls});
 const before=new Map(g.children.map(m=>[m,new Float32Array(m.instanceMatrix.array)]));
 g.userData.setPersonTransform(1,new Matrix4().makeTranslation(7,2,-4));
 let touched=0;
 for(const mesh of g.children){
  const ids=mesh.geometry.attributes.posePersonId.array;
  ids.forEach((id,slot)=>{
   const now=mesh.instanceMatrix.array.slice(slot*16,slot*16+16);
   if(id===1){assert.equal(now[12],7);assert.equal(now[13],2);assert.equal(now[14],-4);touched++;}
   else assert.deepEqual(now,before.get(mesh).slice(slot*16,slot*16+16));
  });
 }
 assert.ok(touched>=4);g.userData.dispose();
});

test('exports all 15 components and uploads isolated custom pose rows',async()=>{
 const {Matrix4,ShaderLib}=await import('three');
 const g=await createHumans({count:65,modelUrls});
 const parts=g.userData.getBodyParts(0);
 assert.equal(Object.keys(parts).length,15);
 assert.equal(Object.values(parts).reduce((n,p)=>n+p.geometry.attributes.position.count,0),HUMAN_LAYOUTS.male.reduce((n,p)=>n+p.count,0));
 assert.equal(parts.rightHand.parent,'rightForearm');
 const mesh=g.children.find(m=>m.geometry.hasAttribute('limbId'));
 const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader};mesh.material.onBeforeCompile(shader);
 const image=shader.uniforms.personPoses.value.image;
 g.userData.setPersonPose(64,{rightHand:new Matrix4().makeTranslation(0,.5,0)});
 assert.equal(image.data[4096*4+14*16+13],.5);
 assert.equal(image.data[4096*4+240],1);assert.equal(image.data[240],0);
 g.userData.clearPersonPose(64);assert.equal(image.data[4096*4+240],0);
 assert.throws(()=>g.userData.setPersonPose(0,{bad:new Matrix4()}),/Invalid/);
 assert.throws(()=>g.userData.setPersonTransform(-1,new Matrix4()),/index/);
 Object.values(parts).forEach(p=>p.geometry.dispose());g.userData.dispose();
});
