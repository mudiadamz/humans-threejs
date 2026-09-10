# Individual movement and externally driven poses

The base GLB stores one merged mesh, not 15 named mesh nodes. Its triangles form 15 body components with stable ranges. The library can now extract them or accept your rig's matrices while keeping crowd rendering instanced.

## Move a person every frame

```js
const worldInGroup = new THREE.Matrix4().compose(position, quaternion, scale);
people.userData.setPersonTransform(personIndex, worldInGroup);
```

This replaces the person's placement relative to the returned group, updates every body/accessory/tool batch belonging to that person, and retains the generated age-dependent scale. It does not change any other person. Translation no longer changes the procedural gait phase. Do not include the age scale again in the supplied matrix.

## Drive body parts from your existing rig

```js
const bindParts = people.userData.getBodyParts(personIndex);
const pivot = bindParts.rightUpperArm.pivot;

// A model-space delta: rotate around the bind shoulder, not around the origin.
const arm = new THREE.Matrix4()
  .makeTranslation(pivot.x, pivot.y, pivot.z)
  .multiply(new THREE.Matrix4().makeRotationX(-1.0))
  .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));

people.userData.setPersonPose(personIndex, {
  rightUpperArm: arm,
  rightForearm: arm,
  rightHand: arm,
});
```

Call `setPersonPose` with a fresh map of matrices each frame. Each matrix is an **absolute model-space deformation from the bind pose**, before age scale and person/group placement. For a conventional hierarchy, calculate `posedJointWorld * inverse(bindJointWorld)` in that shared model space. Parent transforms are **not** automatically composed by this API: include inherited motion in each child's matrix.

Unspecified parts become identity on each call. A custom pose fully overrides built-in deformation for that person, including gait, bob and torso bend. Other people continue their procedural animation. `people.userData.clearPersonPose(personIndex)` restores the built-in action.

Matrices must be finite, invertible, affine `THREE.Matrix4` objects. The factory's action still selects geometry and tools for the whole group; this API changes each person's geometry pose, not their clothing or equipped tool.

## Components

`getBodyParts(index)` returns a map with `{geometry, pivot, parent}` entries. Geometry is copied, in grounded model coordinates with the selected build deformation, before age/instance scaling. Pivot is the center of the component's uppermost ring, a useful approximate bind joint. Parent is metadata, not an active skeleton.

- `torso`, `neck`, `head`
- `leftThigh`, `leftCalf`, `leftFoot`
- `leftUpperArm`, `leftForearm`, `leftHand`
- `rightThigh`, `rightCalf`, `rightFoot`
- `rightUpperArm`, `rightForearm`, `rightHand`

Here left is the negative-X side and right is positive-X. Match these coordinates to your rig rather than assuming its naming convention. The components total 1,572 vertices / 524 triangles. Calf and foot are separate parts; so are forearm and hand.

To use these geometries in another rig, either retain their model-space vertices and apply bind-relative matrices, or translate vertices by `-pivot` and place each mesh at that pivot in your hierarchy. The caller owns extracted geometries and must dispose them:

```js
Object.values(bindParts).forEach(part => part.geometry.dispose());
```

Extract once, not per frame. The metadata does not certify that these bind positions match an external rig; compare its bone lengths and coordinates first.

## Accessories and performance

Custom poses bind face/hair to `head`, tools to `rightHand`, and clothing/cargo to `torso`. These are rigid attachments, not skinned clothing or automatic two-handed grips. Environment props move with person placement but do not receive custom body poses. If your rig handles accessories differently, use the extracted body geometry and supply your own accessories.

Part matrices are stored in a float data texture; no CPU vertex rewriting is required. Updating poses currently uploads the shared texture, so benchmark your target crowd size. To avoid disappearing geometry under custom deformation, the generated batches have frustum culling disabled; spatially partition/cull whole groups in your application when needed. GPU poses still do not update CPU raycasting geometry or animated shadow/depth passes.

The HTML preview has an **Individual control demo** checkbox: the first three people move separately and receive distinct custom arm poses every frame.
