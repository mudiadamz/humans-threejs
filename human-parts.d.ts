export type PartName = 'torso' | 'neck' | 'head' | 'leftThigh' | 'leftCalf' | 'leftFoot' | 'leftUpperArm' | 'leftForearm' | 'leftHand' | 'rightThigh' | 'rightCalf' | 'rightFoot' | 'rightUpperArm' | 'rightForearm' | 'rightHand';
export type ShapeName = 'torsoMale' | 'torsoFemale' | 'neck' | 'head' | 'thigh' | 'calf' | 'foot' | 'upperArm' | 'forearm' | 'hand';
export type Vector3Tuple = [number, number, number];
export interface BodyPartData { positions: Float32Array; normals: Float32Array }
export interface JointTable {
  hip: Vector3Tuple; knee: Vector3Tuple; ankle: Vector3Tuple;
  shoulder: Vector3Tuple; elbow: Vector3Tuple; wrist: Vector3Tuple;
  neckBase: Vector3Tuple; headBase: Vector3Tuple; headCentre: Vector3Tuple; eye: Vector3Tuple;
  lengths: { thigh: number; calf: number; upperArm: number; forearm: number };
  height: number;
}
export interface PartLayout { name: PartName; key: ShapeName; start: number; count: number; pivot: Vector3Tuple; parent: PartName | null }
export const HUMAN_PARTS: Record<ShapeName, BodyPartData>;
export const HUMAN_JOINTS: Record<'male' | 'female', JointTable>;
export const HUMAN_LAYOUTS: Record<'male' | 'female', PartLayout[]>;
