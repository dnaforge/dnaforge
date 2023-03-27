import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { Context } from '../scene/context';
import { CylinderModel } from './cylinder_model';


export class Relaxer {
  world = new CANNON.World();
  context: Context;
  scene: THREE.Scene;
  lastCallTime: number;

  physMeshes: CANNON.Body[] = [];
  threeMeshes: THREE.Object3D[] = [];

  cm: CylinderModel;

  constructor(context: Context) {
    const solver = new CANNON.GSSolver();
    solver.iterations = 7;
    solver.tolerance = 0.1;
    this.world.solver = new CANNON.SplitSolver(solver);
    this.lastCallTime =  performance.now();
    this.context = context;
    this.scene = context.scene;
    context.callbacks.push(() => {return this.animate()});
    
    this.init();
    
  }

  init(){
    this.world.gravity.set(0, -20, 0);

    const material = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const physicsMaterial = new CANNON.Material('physics');
    // Create the ground plane
    const groundShape = new CANNON.Plane()
    const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial })
    groundBody.addShape(groundShape)
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    groundBody.position.set(0, -10, 0);
    this.world.addBody(groundBody);
  }

  setFromCM(cm: CylinderModel){
    this.cm = cm;

    for(let i = 0; i < cm.cylinders.length; i++){
      const cyl = cm.cylinders[i];
      const scale = cyl.scale;
      const len = cyl.getCylinderLength();
      const transform = cyl.transform.clone().scale(new Vector3(1/scale, 1/scale, 1/scale));
      const rot = new Quaternion().setFromRotationMatrix(transform);
      const pos = new Vector3(0, len / 2, 0).applyMatrix4(transform);

      const cylinderShape = new CANNON.Cylinder(scale, scale, len, 10);
      const cylinderBody = new CANNON.Body({ mass: 1, shape: cylinderShape });
      this.physMeshes.push(cylinderBody);
      this.world.addBody(cylinderBody);



      cylinderBody.quaternion.copy(rot as unknown as CANNON.Quaternion);
      cylinderBody.position.copy(pos as unknown as CANNON.Vec3);
    }

  }

  animate() {
    const time = performance.now() / 1000
    const dt = time - this.lastCallTime
    this.lastCallTime = time
    
    if (true) {
      this.world.step(1/60, dt)
    
      // Update box positions
      for (let i = 0; i < this.physMeshes.length; i++) {
        const cyl = this.cm.cylinders[i];

        const len = cyl.getCylinderLength();
        const scale = new Vector3(cyl.scale, cyl.scale, cyl.scale);
        const rot = new Quaternion().copy(this.physMeshes[i].quaternion as unknown as Quaternion);
        const pos = new Vector3().copy(this.physMeshes[i].position as unknown as Vector3);
        pos.sub(new Vector3(0,len/2,0).applyQuaternion(rot));

        const transform = new Matrix4().compose(pos, rot, scale);
        
        cyl.transform = transform;
      }
      this.cm.updateObject();
    }
  }
}

/*
// cannon.js variables
let world
let controls
const timeStep = 1 / 60
let lastCallTime = performance.now()
let sphereShape
let sphereBody
let physicsMaterial
const boxes:  = []
const boxMeshes = []


initCannon()
animate()

function initCannon() {
}

}
*/