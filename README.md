# Humans for Three.js

Lightweight, low-poly people with varied appearance and procedural actions. Create a single person or an instanced crowd through one async function.

## Preview

```sh
npm install
npm run preview
```

Open [the local HTML preview](http://127.0.0.1:8080). The preview uses `create-humans.js` directly and provides controls for appearance, age, carrying and actions. It needs internet access for the pinned Three.js CDN modules. Serve it over HTTP; opening `index.html` through `file://` will not load the GLBs.

## Use in another project

Copy `create-humans.js`, `human-male.glb`, and `human-female.glb` together into a served asset directory, and install Three.js. Bundlers must include the sibling GLB assets, or pass explicit `modelUrls`.

```js
import { createHumans } from './create-humans.js';

const people = await createHumans({
  count: 100,
  ageMin: 18,
  ageMax: 60,
  variant: 'mixed',
  action: 'walking-carrying',
  carrying: 'fruit',
  seed: 42,
});
scene.add(people);

// Inside your existing animation loop:
people.userData.update(elapsedSeconds, { speed: 1 });

// When finished (also removes the group from its parent):
// people.userData.dispose();
```

Your application supplies the scene, lights, camera and renderer. The returned `THREE.Group` can be positioned, rotated and scaled. For a single person, set `count: 1`.

## Features

- Male/female base models, four body builds, eight skin tones and varied heights.
- Age range with slight individual variation, including dark-to-light brown hair.
- Three face styles and cropped, swept, bob, long, curly or bald hair.
- Animal-hide tunics and food loads: fruit, vegetables, meat, fish and a small lamb.
- Separate empty-handed and carrying walks, standing, cutting, picking, sitting, mining and hoeing.
- Two-handed arm IK for mining and hoeing; GPU deformation for animation.
- Environment props off by default, so your project can supply its own scenery.

See [API and model specifications](SPECS.md) for all options and limitations.

## Checks

```sh
npm test
```

Tests load the real models and verify actions, finite geometry bounds, limb tags, cargo separation and disposal. Browser checks were also performed during development; these are not an FPS benchmark.

## Repository contents

| File | Purpose |
|---|---|
| `create-humans.js` | Single exported `createHumans()` function |
| `human-male.glb`, `human-female.glb` | Base body models |
| `index.html` | Interactive preview using the exported function |
| `SPECS.md` | API, model specifications and known limitations |
| `tests/` | Automated construction and regression checks |

This repository is prepared for private project use. No open-source license has been assigned.
