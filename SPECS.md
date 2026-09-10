# API and model specifications

## Entry point

`await createHumans(options)` returns a `THREE.Group`. Requires Three.js with `three/addons/` imports; tested against **0.180.0**. No DOM, camera, lights or render loop are created by the function.

| Option | Default | Accepted values |
|---|---|---|
| `count` | `1` | Positive integer |
| `variant` | `'mixed'` | `mixed`, `male`, `female` |
| `build` | `'mixed'` | `mixed`, `slim`, `average`, `broad`, `full` |
| `skin` | `'mixed'` | `mixed`, or 0–7 from light to dark |
| `ageMin`, `ageMax` | `20`, `45` | Ordered numbers in 3–100 |
| `face` | `'mixed'` | `mixed`, `soft`, `angular`, `wide` |
| `hair` | `'mixed'` | `mixed`, `cropped`, `swept`, `bob`, `long`, `curls`, `bald` |
| `clothing` | `'hide'` | `hide`, `none` |
| `carrying` | `'none'` | `none`, `mixed`, `fruit`, `vegetables`, `meat`, `fish`, `livestock` |
| `action` | `'walking'` | See actions below |
| `environmentProps` | `false` | Boolean; optional scenery for working actions |
| `spacing` | `1.05` | Positive grid spacing in metres |
| `positions` | omitted | One `[x,y,z]` array per person; overrides the grid |
| `seed` | `0` | Integer for reproducible appearance variation |
| `modelUrls` | Sibling GLBs | `{male: url, female: url}`; partial overrides supported |

Age maps artistically to body height and brown hair shade, with variation even for a single fixed age. It is not a biological prediction. Mixed female hairstyles favor long hair. Height metadata excludes the extra height of hair.

## Actions

| Action | Behavior |
|---|---|
| `walking` | Empty-handed walking; ignores the carrying selection |
| `walking-carrying` | Walking while holding the selected load; missing/none load becomes mixed |
| `standing` | Standing; can hold a selected load |
| `cutting` | Cutting gesture and knife |
| `picking-fruit` | Reaching to pick fruit |
| `picking-vegetables` | Forward bend and low picking gesture |
| `sitting-raft` | Seated pose; legacy name retained, raft off by default |
| `mining` | Two-handed pickaxe swing and forward lean |
| `hoeing` | Two-handed low hoe stroke and deeper lean |

Working actions suppress carried food. `environmentProps: true` restores scenery for cutting, picking, sitting and mining; hoeing has no scenery. Hand tools remain visible independently of scenery. Old calls that set a load but omit `action` automatically select `walking-carrying`.

## Runtime methods

```js
people.userData.update(elapsedSeconds, { walking: true, speed: 1 });
people.userData.people; // [{ index, age, height }, ...]
people.userData.dispose(); // Idempotent; removes group and frees its resources
```

Call `update` each frame with elapsed seconds. `speed` scales the cycle; typical values are 0.65, 1 and 1.4. `walking: false` disables the walking gait only; it does not pause working actions. To pause all motion, stop advancing the supplied elapsed time. Actions and appearance are selected at creation: create a replacement group to change them.

Walking is in place. Move the group in your world separately. Individual people span several instanced batches. `setPersonTransform`, `setPersonPose`, `clearPersonPose`, and `getBodyParts` support per-person movement and external posing; see [Individual control](INDIVIDUAL-CONTROL.md). All people in a group still share an action/prop selection, but custom poses can override each person independently. Use separate groups for different equipped props.

## Geometry and rendering

- Each base GLB: **524 triangles**, **1,572 non-indexed vertices**, one mesh, one material, no textures, no skeleton or animation clips.
- Male file: 38,544 bytes. Female file: 38,540 bytes.
- +Y up, +Z forward, metre units. Raw soles are at y=0.015; the function grounds the geometry.
- Base body height: approximately 1.735 m. Age/height scaling is applied per instance.
- Appearance parts and tools are generated in JavaScript; they are not inside the GLBs.
- Batches share geometry/material by appearance category. Total triangle and draw-call counts increase with hair, face, clothing, cargo and tools.
- Body components have stable limb IDs to prevent hands and arms from splitting when build proportions change.
- Model URL overrides must point to copies of these compatible GLBs: the limb mapping depends on their vertex count and component order. Arbitrary replacement characters are not supported.

## Limits

This is a stylized procedural model, not a production skeletal rig. There is no foot IK, terrain collision, object grasping physics, water simulation, navigation or root motion. Extreme poses may have intersecting geometry. GPU deformation does not update CPU vertex positions for raycasting or bounds, and custom animated shadow/depth materials are not supplied. Batch frustum culling is disabled to keep custom poses visible. Use application-level spatial group culling and appropriate custom shadow materials.

Repeated factory calls create independent resources and reload/parse model data; reuse a group where possible. The preview caps its selector at 5,000 people, but this is not a measured device guarantee. Very large worlds should use spatial batches for culling.
