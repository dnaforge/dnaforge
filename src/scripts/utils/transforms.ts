import { Matrix4, Vector3 } from "three";


export function get2PointTransform(p1: Vector3, p2: Vector3) {
    const center = p1.clone().add(p2).multiplyScalar(0.5);

    const r1 = new Vector3(Math.random(), Math.random(), Math.random());

    const dir = p2.clone().sub(p1).normalize();
    const nor1 = r1.sub(dir.clone().multiplyScalar(r1.dot(dir))).normalize();
    const nor2 = dir.clone().cross(nor1);

    const transform = new Matrix4().makeBasis(nor2, dir, nor1).setPosition(center);

    return transform;
}