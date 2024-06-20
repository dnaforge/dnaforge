import { Matrix4, Vector2, Vector3 } from 'three';
import { NATYPE } from '../globals/consts';

const r1 = new Vector3().randomDirection();

/**
 * A random number generator.
 * 
 * @param seed 
 * @returns 
 */
export function randomGen(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Creates a transformation which transforms a Y-oriented unit vector centered at
 * the origin to a vector that spans from point p1 to p2.
 *
 * @param p1 point 1
 * @param p2 point 2
 * @returns transformation matrix
 */
export function get2PointTransform(p1: Vector3, p2: Vector3): Matrix4 {
  const center = p1.clone().add(p2).multiplyScalar(0.5);

  const dir = p2.clone().sub(p1).normalize();
  const nor1 = r1
    .clone()
    .sub(dir.clone().multiplyScalar(r1.dot(dir)))
    .normalize();
  const nor2 = dir.clone().cross(nor1);

  const transform = new Matrix4()
    .makeBasis(nor2, dir, nor1)
    .setPosition(center);

  return transform;
}

export function getPointerProjection2p(
  startPos: Vector2,
  curPos: Vector2,
  transform: Matrix4,
  z: number,
) {
  const SENSITIVITY = 0.75;

  const pointerProjInit = new Vector3(startPos.x, startPos.y, 0).applyMatrix4(
    transform,
  );
  const pointerProj = new Vector3(curPos.x, curPos.y, 0)
    .applyMatrix4(transform)
    .sub(pointerProjInit)
    .multiplyScalar(z * SENSITIVITY);

  return pointerProj;
}

/**
 * Searches for searchElement in sortedArray.
 * Assumes that sortedArray is sorted in ascending order.
 *
 * @param sortedArray the array to search in
 * @param searchElement the element to search for
 * @returns the index of the searchElement or the insertion index if the element wasn't found
 */
export function binarySearch<Type>(
  sortedArray: Type[],
  searchElement: Type,
): number {
  let low = 0;
  let high = sortedArray.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midVal = sortedArray[mid];

    if (midVal === searchElement) {
      // return location of element
      return mid;
    } else if (midVal < searchElement) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // return insert location
  return low;
}

/**
 * Calculates the centre of mass from the backbone coordinates and orientation vectors
 *
 * @param bb
 * @param a1
 * @param baseNormal
 * @param naType
 * @returns
 */
export function bbToCoM(
  bb: Vector3,
  a1: Vector3,
  baseNormal: Vector3,
  naType: NATYPE,
) {
  const lenFactor = 0.8518;

  if (naType == 'DNA') {
    const a2 = a1.clone().cross(baseNormal);
    const cm = bb.clone().add(
      a1
        .clone()
        .multiplyScalar(0.34 * lenFactor)
        .add(a2.clone().multiplyScalar(0.3408 * lenFactor)),
    );
    return cm;
  } else if (naType == 'RNA') {
    const cm = bb.clone().add(
      a1
        .clone()
        .multiplyScalar(0.4 * lenFactor)
        .sub(baseNormal.clone().multiplyScalar(-0.2 * lenFactor)),
    );
    return cm;
  } else {
    throw `Unknown naType`;
  }
}

/**
 * Calculates the backbone coordinates from the centre of mass and orientation vectors
 *
 * @param com
 * @param a1
 * @param a3
 * @param naType
 * @returns
 */
export function CoMToBB(
  com: Vector3,
  a1: Vector3,
  a3: Vector3,
  naType: NATYPE,
) {
  const lenFactor = 0.8518;

  if (naType == 'DNA') {
    const a2 = a1.clone().cross(a3);
    const bb = com.clone().sub(
      a1
        .clone()
        .multiplyScalar(0.34 * lenFactor)
        .add(a2.clone().multiplyScalar(0.3408 * lenFactor)),
    );
    return bb;
  } else if (naType == 'RNA') {
    const bb = com.clone().sub(
      a1
        .clone()
        .multiplyScalar(0.4 * lenFactor)
        .sub(a3.clone().multiplyScalar(-0.2 * lenFactor)),
    );
    return bb;
  } else {
    throw `Unknown naType`;
  }
}

