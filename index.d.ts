/// <reference types="@webgpu/types" />
import type { Group, Matrix4, BufferGeometry, Vector3 } from 'three';
import type { PartName, Vector3Tuple } from './human-parts.js';
export type { PartName } from './human-parts.js';
export type Action = 'walking' | 'walking-carrying' | 'standing' | 'cutting' | 'picking-fruit' | 'picking-vegetables' | 'sitting-raft' | 'mining' | 'hoeing';
export type Carrying = 'none' | 'mixed' | 'fruit' | 'vegetables' | 'meat' | 'fish' | 'livestock';
export interface HumanOptions {
  count?: number; variant?: 'mixed' | 'male' | 'female';
  build?: 'mixed' | 'slim' | 'average' | 'broad' | 'full';
  skin?: 'mixed' | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
  ageMin?: number; ageMax?: number;
  face?: 'mixed' | 'soft' | 'angular' | 'wide';
  hair?: 'mixed' | 'cropped' | 'swept' | 'bob' | 'long' | 'curls' | 'bald';
  hands?: 'auto' | 'open' | 'fist'; clothing?: 'hide' | 'none'; carrying?: Carrying; action?: Action;
  environmentProps?: boolean; spacing?: number; positions?: Vector3Tuple[]; seed?: number;
  modelUrls?: Partial<Record<'male' | 'female', string | URL>>;
  modelData?: Partial<Record<'male' | 'female', ArrayBuffer>>;
}
export interface ExtractedPart { geometry: BufferGeometry; pivot: Vector3; parent: PartName | null }
export interface HumanControls {
  people: Array<{ index: number; age: number; height: number }>;
  update(elapsedSeconds: number, options?: { walking?: boolean; speed?: number }): void;
  setPersonTransform(index: number, matrix: Matrix4): void;
  setPersonPose(index: number, transforms: Partial<Record<PartName, Matrix4>>): void;
  clearPersonPose(index: number): void;
  getBodyParts(index: number): Record<PartName, ExtractedPart>;
  dispose(): void;
}
export type HumanGroup = Group & { userData: HumanControls };
export function createHumans(options?: HumanOptions): Promise<HumanGroup>;
