# Straight-limb rig integration (v0.3)

This export addresses items 1–6 of `HUMAN-MODEL-SPEC.md`, plus the optional knee-height adjustment. It is intended for a host rig that uses one shared geometry per limb type and places left/right instances at ±joint X.

## Synchronous data: no loader or Three.js dependency

```js
import { HUMAN_PARTS, HUMAN_JOINTS, HUMAN_LAYOUTS } from './human-parts.js';

const j = HUMAN_JOINTS.male;
const thigh = HUMAN_PARTS.thigh; // { positions: Float32Array, normals: Float32Array }
// Feed these directly to your renderer's geometry constructor.
```

This module has no imports, network requests, asynchronous initialization or Three.js dependency. Entries are:

`torsoMale`, `torsoFemale`, `neck`, `head`, `thigh`, `calf`, `foot`, `upperArm`, `forearm`, `hand`.

All vertices are already **joint-local**. Do not subtract another pivot. Treat shared arrays as read-only; copy if your renderer mutates them. Normals are unit-length, flat-shaded and use the same orientation as the positions. Geometry is non-indexed triangles.

```js
// In a Three.js host, using the synchronous arrays:
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(HUMAN_PARTS.forearm.positions, 3));
geometry.setAttribute('normal', new THREE.BufferAttribute(HUMAN_PARTS.forearm.normals, 3));
// Use this same geometry for both sides, for every sex.
```

The two torsos differ. All other body parts are shared. Place identical limb geometry at negative/positive X; no mirroring or negative scale is needed. Hands are symmetric mittens; feet point toward +Z.

## Joint table (metres, grounded soles)

Each named joint is `[x, y, z]`; X is the positive-side offset. Negate X for the other side. Values below have Z = 0 unless stated.

| Joint | Male X | Female X | Y |
|---|---:|---:|---:|
| hip | 0.104 | 0.117 | 0.925 |
| knee | 0.104 | 0.117 | 0.495 |
| ankle | 0.104 | 0.117 | 0.080 |
| shoulder | 0.182 | 0.158 | 1.385 |
| elbow | 0.182 | 0.158 | 1.075 |
| wrist | 0.182 | 0.158 | 0.795 |
| neckBase | 0 | 0 | 1.430 |
| headBase | 0 | 0 | 1.500 |
| headCentre | 0 | 0 | 1.620 |
| eye | 0 | 0 | 1.634 (Z = 0.072) |

Lengths are `j.lengths.thigh = 0.430`, `calf = 0.415`, `upperArm = 0.310`, `forearm = 0.280`. Total body height is 1.735 m. The calf entry corresponds to the host rig's shin.

## Pivot and hierarchy rules

- Torso origin: hip joint `[0, 0.925, 0]` in the assembled body.
- Neck origin: neck base, not its upper end.
- Head origin: skull base / top of neck, not its crown.
- Upper arm → forearm: child translation `[0, -0.310, 0]`.
- Forearm → hand: `[0, -0.280, 0]`.
- Thigh → calf: `[0, -0.430, 0]`.
- Calf → foot: `[0, -0.415, 0]`.

If the torso mesh is under a group at the hip, shoulder placement relative to that group is `[±shoulder.x, shoulder.y - hip.y, 0]`. The neck and head offsets similarly subtract their parent's joint Y.

The hips and shoulders differ by sex, not the limb shapes. The host can scale its torso separately while sharing limb meshes. Rounded ends extend past the joint: do not infer bone length from geometry bounds or the uppermost vertex. Use the joint table.

## Rounded ends and tolerance checks

Thigh, calf, upper arm, forearm and hand have low-poly hemispherical joint caps, overlapping neighbouring pieces around a shared joint. Caps extend by approximately the local radius: elbow 35 mm, knee 50 mm, wrist 26 mm, ankle 32 mm. The foot includes an ankle cap. Tests enforce:

- Top/bottom limb ring-centre drift below **1 mm** in X/Z.
- Limb self-mirror error below **2 mm** in X.
- Correct torso, neck and head pivots.
- Curved caps extending past both bind joint centres.
- Static arrays matching both assembled GLBs, with identical limb data.

Run only the dependency-free tests:

```sh
node --test tests/rig-parts.test.js
```

Open `rig-preview.html` via `npm run preview` to inspect the shared pieces at elbow 75° and knee 77°. The preview constructs its own simple hierarchy from the static export, without using `createHumans` or `GLTFLoader`.

## GLBs and compatibility

The male and female GLBs assemble the same arrays into 15 merged body components. Each has 1,056 triangles / 3,168 vertices, and is 78,676 bytes. The `Human` node's extras contain `rigVersion: 1`, the part ranges/pivots, and its joint table. `HUMAN_LAYOUTS` exports that same metadata synchronously.

This is a topology change from v0.2. Replace the module, `human-parts.js`, and both GLBs together. The updated `createHumans` validates rig version and uses the new metadata; old hard-coded vertex offsets are invalid. `getBodyParts()` still returns model-space geometry with a separate pivot, whereas `HUMAN_PARTS` is already joint-local.

Accessory data and a dedicated fist shape remain a separate follow-up (spec items 8–9). Existing procedural accessories and action APIs remain available through `createHumans`.
