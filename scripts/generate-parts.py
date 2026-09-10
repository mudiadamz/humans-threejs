"""Generate rig-ready static arrays and GLBs using Python's standard library."""
import math,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parts={}
def surface(rings,n=12):
 p=[];ns=[]
 def tri(a,b,c):
  u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
  normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];l=math.sqrt(sum(x*x for x in normal))
  if l<1e-10:return
  for pt in [a,b,c]:p.extend(round(x,7) for x in pt);ns.extend(round(x/l,7) for x in normal)
 rr=[[(rx*math.cos(i*2*math.pi/n),y,z+rz*math.sin(i*2*math.pi/n)) for i in range(n)] for y,rx,rz,z in rings]
 for a,b in zip(rr,rr[1:]):
  for i in range(n):j=(i+1)%n;tri(a[i],b[i],b[j]);tri(a[i],b[j],a[j])
 # Rings listed bottom to top, CCW normals outward.
 for i in range(1,n-1):tri(rr[0][0],rr[0][i],rr[0][i+1]);tri(rr[-1][0],rr[-1][i+1],rr[-1][i])
 # Average shared-vertex normals within each closed piece for soft shading.
 sums={}
 for i in range(0,len(p),3):
  key=tuple(p[i:i+3]);acc=sums.setdefault(key,[0.,0.,0.])
  for k in range(3):acc[k]+=ns[i+k]
 for i in range(0,len(p),3):
  v=sums[tuple(p[i:i+3])];l=math.sqrt(sum(x*x for x in v))
  ns[i:i+3]=[round(x/l,7) for x in v]
 return {'positions':p,'normals':ns}
def capsule(length,top,bottom,bulge):
 # Joint centers at y=0 and -length; hemispherical overlaps at both ends.
 t45=math.sqrt(.5)
 return surface([(-length-bottom,0,0,0),(-length-bottom*t45,bottom*t45,bottom*t45,0),(-length,bottom,bottom,0),(-length*.72,bulge[0]*.92,bulge[1]*.92,0),(-length*.40,bulge[0],bulge[1],0),(-length*.16,top*.98,top*.98,0),(0,top,top,0),(top*t45,top*t45,top*t45,0),(top,0,0,0)])
parts['thigh']=capsule(.430,.078,.050,(.077,.080))
parts['calf']=capsule(.415,.050,.032,(.054,.058))
parts['upperArm']=capsule(.310,.060,.035,(.049,.052))
parts['forearm']=capsule(.280,.035,.026,(.033,.035))
parts['hand']=capsule(.075,.026,.016,(.028,.023))
# Compact curled-finger volume with a broad knuckle line; same wrist origin.
parts['fist']=surface([(-.067,0,0,.008),(-.060,.027,.027,.008),(-.047,.034,.033,.009),(-.034,.035,.032,.010),(-.022,.034,.030,.008),(-.010,.027,.025,.003),(0,.026,.026,0),(.0183848,.0183848,.0183848,0),(.026,0,0,0)])
parts['foot']=surface([(-.08,.048,.103,.038),(-.03,.048,.103,.038),(0,.033,.045,0),(.032,0,0,0)])
parts['neck']=surface([(-.008,.057,.055,0),(.078,.057,.055,0)])
parts['head']=surface([(-.010,.042,.046,.006),(.012,.060,.055,.008),(.048,.073,.067,.008),(.093,.083,.074,.006),(.145,.085,.081,0),(.183,.080,.077,-.004),(.218,.058,.058,-.005),(.235,.020,.022,-.005)])
for sex,rings in [('Male',[(.895,.13,.084,0),(.95,.149,.095,0),(1.025,.158,.097,0),(1.105,.139,.085,0),(1.185,.144,.092,0),(1.28,.18,.112,0),(1.35,.198,.109,0),(1.405,.18,.09,0),(1.435,.115,.07,0)]),('Female',[(.895,.145,.09,0),(.95,.175,.107,0),(1.025,.176,.108,0),(1.105,.13,.08,0),(1.185,.12,.079,0),(1.28,.15,.119,.014),(1.35,.161,.111,.009),(1.405,.146,.088,0),(1.435,.102,.065,0)])]:
 parts['torso'+sex]=surface([(y-.925,x,z,c) for y,x,z,c in rings])
joints={}
for sex,shoulder,hip in [('male',.182,.104),('female',.158,.117)]:
 joints[sex]={'hip':[hip,.925,0],'knee':[hip,.495,0],'ankle':[hip,.080,0],'shoulder':[shoulder,1.385,0],'elbow':[shoulder,1.075,0],'wrist':[shoulder,.795,0],'neckBase':[0,1.430,0],'headBase':[0,1.500,0],'headCentre':[0,1.620,0],'eye':[0,1.634,.072],'lengths':{'thigh':.430,'calf':.415,'upperArm':.310,'forearm':.280},'height':1.735}
layouts={}
for sex in ['male','female']:
 j=joints[sex];entries=[('torso','torso'+sex.title(),[0,.925,0],None),('neck','neck',j['neckBase'],'torso'),('head','head',j['headBase'],'neck')]
 for side,sign in [('left',-1),('right',1)]:
  for key,joint,parent in [('thigh','hip','torso'),('calf','knee',side+'Thigh'),('foot','ankle',side+'Calf'),('upperArm','shoulder','torso'),('forearm','elbow',side+'UpperArm'),('hand','wrist',side+'Forearm')]:
   pivot=j[joint].copy();pivot[0]*=sign;entries.append((side+key[0].upper()+key[1:],key,pivot,parent))
 pos=[];nor=[];layout=[]
 for name,key,pivot,parent in entries:
  part=parts[key];start=len(pos)//3;count=len(part['positions'])//3
  pos.extend(round(v+pivot[i%3],7) for i,v in enumerate(part['positions']));nor.extend(part['normals'])
  layout.append({'name':name,'key':key,'start':start,'count':count,'pivot':pivot,'parent':parent})
 layouts[sex]=layout
 pb=struct.pack('<%sf'%len(pos),*pos);nb=struct.pack('<%sf'%len(nor),*nor);binary=pb+nb
 g={'asset':{'version':'2.0','generator':'humans-threejs rig-ready generator'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'Human','extras':{'rigVersion':1,'parts':layout,'joints':j}}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.85}}],'buffers':[{'byteLength':len(binary)}],'bufferViews':[{'buffer':0,'byteLength':len(pb),'byteOffset':0,'target':34962},{'buffer':0,'byteLength':len(nb),'byteOffset':len(pb),'target':34962}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(pos)//3,'type':'VEC3','min':[min(pos[i::3]) for i in range(3)],'max':[max(pos[i::3]) for i in range(3)]},{'bufferView':1,'componentType':5126,'count':len(nor)//3,'type':'VEC3'}]}
 jb=json.dumps(g,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4)
 data=struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary
 (ROOT/f'human-{sex}.glb').write_bytes(data)
 print(sex,len(pos)//9,'triangles',len(data),'bytes')
lines=['// Generated by scripts/generate-parts.py. No Three.js, fetch, or async dependencies.','// Arrays are joint-local. Treat shared arrays as read-only; clone before modifying.','export const HUMAN_PARTS = {']
for key,part in parts.items():lines.append(key+': {positions:new Float32Array('+json.dumps(part['positions'],separators=(',',':'))+'),normals:new Float32Array('+json.dumps(part['normals'],separators=(',',':'))+')},')
lines+=['};','export const HUMAN_JOINTS = '+json.dumps(joints,separators=(',',':'))+';','export const HUMAN_LAYOUTS = '+json.dumps(layouts,separators=(',',':'))+';']
(ROOT/'human-parts.js').write_text('\n'.join(lines)+'\n')
