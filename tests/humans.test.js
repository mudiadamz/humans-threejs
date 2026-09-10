import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
   assert.ok(ids.slice(708,996).every(n=>n===3));assert.ok(ids.slice(1284,1572).every(n=>n===3));
   for(const key of ['restShoulder','restElbow','restWrist'])assert.ok(mesh.geometry.attributes[key].array.every(Number.isFinite));
  }g.userData.dispose();
 }
});
test('rejects invalid inputs before loading',async()=>{
 await assert.rejects(createHumans({count:0}),/count/);
 await assert.rejects(createHumans({ageMin:70,ageMax:20}),/Age/);
 await assert.rejects(createHumans({action:'unknown'}),/action/);
});
