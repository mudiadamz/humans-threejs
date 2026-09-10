# Humans for Three.js

Lightweight, low-poly people with varied appearance and procedural actions. Create a single person or an instanced crowd through one async function.

## Install from GitHub

```sh
npm install git+https://github.com/mudiadamz/humans-threejs.git#v0.4.0 three
```

This repository is private, so your Git client must have access. The package is installed directly from GitHub, not the npm registry. Append `#<commit-sha>` to pin a revision and commit your application's lockfile.

```js
import { createHumans } from 'humans-threejs';
import { HUMAN_PARTS, HUMAN_JOINTS } from 'humans-threejs/human-parts';
```

ES modules; Node.js 18+; Three.js 0.180.x. TypeScript declarations are included. TypeScript consumers should install `@types/three@^0.180.0` as a dev dependency. The library needs no build step.

## Node.js

```js
import { createHumans } from 'humans-threejs/node';
const humans = await createHumans({ count: 2 });
console.log(humans.userData.people);
humans.userData.dispose();
```

The Node entry loads the bundled GLBs from disk and constructs Three.js objects; it does not provide a server-side renderer or WebGL context. The static `human-parts` entry has no runtime imports and does not load Three.js.

## Browser assets

Bundlers must emit the two bundled GLBs. With Vite, use explicit asset URLs:

```js
import { createHumans } from 'humans-threejs';
import male from 'humans-threejs/human-male.glb?url';
import female from 'humans-threejs/human-female.glb?url';
const people = await createHumans({ modelUrls: { male, female } });
```

Other bundlers can copy the GLBs to public assets and pass their URLs. You can also supply `modelData: { male: arrayBuffer, female: arrayBuffer }` to bypass fetching.

## Preview

After cloning the repository:

```sh
npm install
npm run preview
```

Open [the local HTML preview](http://127.0.0.1:8080). The preview uses `create-humans.js` directly and provides controls for appearance, age, carrying and actions. It needs internet access for the pinned Three.js CDN modules. Serve it over HTTP; opening `index.html` through `file://` will not load the GLBs.

## Use with your own rig

Import synchronous joint-local arrays from [`human-parts.js`](human-parts.js), with no GLB loader or Three.js dependency. See [rig integration and joint table](RIG-INTEGRATION.md). The [rig preview](rig-preview.html) checks the same shared limbs at bent elbows and knees.

## Use in another project

Install as above, or copy `create-humans.js`, `human-parts.js`, and both GLBs together into a served directory. For manual file copying, import from your local `./create-humans.js` path.

```js
import { createHumans } from 'humans-threejs';

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
- Per-person placement and external part-pose matrices; extraction of all 15 body parts.
- Environment props off by default, so your project can supply its own scenery.

For integration with an existing rig, see [individual movement, part extraction and per-frame posing](INDIVIDUAL-CONTROL.md).

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
| `human-parts.js` | Dependency-free, joint-local body arrays and joint table |
| `rig-preview.html` | Shared-limb rig and bent-joint preview |
| `index.html` | Interactive preview using the exported function |
| `SPECS.md` | API, model specifications and known limitations |
| `tests/` | Automated construction and regression checks |

This repository is prepared for private project use. No open-source license has been assigned.

## Packaging

`npm pack` runs tests and creates an installable `.tgz`. `private: true` prevents accidental npm-registry publishing; it does not prevent GitHub or tarball installation.

## v0.4 visual refinement

Softer shading, rounder jaw/skull and torso contours, tapered limbs and rounded long hair. Walking includes calf/foot flex and relaxed elbows, with less vertical bob. The external rig still receives identical shared straight limbs and the same joint table. Each body is now 2,264 triangles; update the static module and GLBs together.
