import { Matrix4, Vector2, Vector3 } from 'three';

const r1 = new Vector3().randomDirection();

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
