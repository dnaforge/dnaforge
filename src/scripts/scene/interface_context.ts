import * as THREE from 'three';
import { OrthographicCamera, Vector3 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GLOBALS from '../globals/globals';
import Context from './context';
import Menu from './menu';

const meshMaterial = new THREE.MeshBasicMaterial({
  color: 0x9999ff,
  transparent: true,
  opacity: 0.1,
});

const GRID_SIZE = 14;
const BOUNDING_BOX_SCALE = 10;

const fog = new THREE.FogExp2(0xffffff, 0.1);

interface CSSOBject {
  object: THREE.Object3D;
  divs: HTMLElement[];
}

export default class InterfaceMenu extends Menu {
  cameraLight = new THREE.PointLight(0xffffff, 0.75);
  ambientLight = new THREE.AmbientLight(0xbbbbbb);

  showCamLightButton: any;
  showAmbLightButton: any;
  showFogButton: any;
  showAxesButton: any;
  showGridButton: any;
  showScaleButton: any;
  resetCameraButton: any;
  orthoCameraButton: any;
  perspCameraButton: any;
  indicesButton: any;
  solidButton: any;
  wiresButton: any;
  boundingBoxButton: any;
  hoverButton: any;

  axes: CSSOBject;
  vertexIndices: CSSOBject;
  wires: THREE.Group;
  boundingBox: THREE.Group;
  mesh: THREE.Mesh;
  grid: THREE.GridHelper;

  constructor(context: Context) {
    super(context, 'interface', 'Interface', true);

    context.callbacks.push(() => {
      const pos = this.context.getCamera().position;
      this.cameraLight.position.copy(pos);
    });

    this.scene.add(this.cameraLight);
    this.regenerateVisible();
  }

  populateHotkeys() {
    this.hotkeys.set('4', this.wiresButton);
    this.hotkeys.set('5', this.solidButton);
    this.hotkeys.set('6', this.indicesButton);
    this.hotkeys.set('q', this.hoverButton);
    this.hotkeys.set('np1', () => {
      this.context.setCameraView('front');
    });
    this.hotkeys.set('np2', () => {
      this.context.rotateCameraView('down');
    });
    this.hotkeys.set('np3', () => {
      this.context.setCameraView('right');
    });
    this.hotkeys.set('np4', () => {
      this.context.rotateCameraView('left');
    });
    this.hotkeys.set('np5', () => {
      this.switchCameraType();
    });
    this.hotkeys.set('np6', () => {
      this.context.rotateCameraView('right');
    });
    this.hotkeys.set('np7', () => {
      this.context.setCameraView('top');
    });
    this.hotkeys.set('np8', () => {
      this.context.rotateCameraView('up');
    });
    this.hotkeys.set('np9', () => {
      this.context.flipCameraView();
    });
    this.hotkeys.set('np,', () => {
      this.resetCamera();
    });
  }

  reset() {
    this.removeWires(true);
    this.removeMesh(true);
    this.removeVertexIndices(true);
    this.regenerateVisible();
  }

  addAxes() {
    if (!this.axes) {
      const origin = new THREE.Vector3(0, 0, 0);
      const length = 4;

      const X = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        origin,
        length,
        0xff0000
      );
      const Y = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        origin,
        length,
        0x000000
      );
      const Z = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        origin,
        length,
        0x0000ff
      );

      const xDiv = document.createElement('div');
      xDiv.textContent = 'X';
      xDiv.style.fontSize = '35px';
      const fX = new CSS2DObject(xDiv);
      fX.translateX(4.5);
      const yDiv = document.createElement('div');
      yDiv.textContent = 'Y';
      yDiv.style.fontSize = '35px';
      const fY = new CSS2DObject(yDiv);
      fY.translateY(4.5);
      const zDiv = document.createElement('div');
      zDiv.textContent = 'Z';
      zDiv.style.fontSize = '35px';
      const fZ = new CSS2DObject(zDiv);
      fZ.translateZ(4.5);

      const axesObj = new THREE.Group();
      axesObj.add(X, Y, Z, fX, fY, fZ);

      this.axes = { object: axesObj, divs: [xDiv, yDiv, zDiv] };
    }
    this.scene.add(this.axes.object);
  }

  removeAxes() {
    this.scene.remove(this.axes.object);
    for (let d of this.axes.divs) d.remove();
  }

  /*
    addScale() {
        if (!this.scaleBar) {
            const geo = new THREE.BoxGeometry(1, 0.1, 0.1);
            const scaleBar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
            scaleBar.position.set(3, -0.5, -3);
            this.context.callbacks.push(() => {
                const pos = this.context.getCamera().position
                scaleBar.lookAt(pos);
            })
            this.scene.add(scaleBar);
            this.scaleBar = scaleBar;

        }
        this.scene.add(this.scaleBar);
    }

    removeScale() {
        this.scene.remove(this.scaleBar);
    }
    */

  addCamLight() {
    this.scene.add(this.cameraLight);
  }

  removeCamLight() {
    this.scene.remove(this.cameraLight);
  }

  addAmbLight() {
    this.scene.add(this.ambientLight);
  }

  removeAmbLight() {
    this.scene.remove(this.ambientLight);
  }

  addVertexIndices() {
    const graph = this.context.graph;
    if (!graph) return;
    if (this.vertexIndices) this.removeVertexIndices(true); // remove old
    const vertices = graph.getVertices();

    const divs = [];
    const indicesObject = new THREE.Group();
    for (let i = 0; i < vertices.length; i++) {
      const td = document.createElement('div');
      (td as any).textContent = i + 1; // Starting indexing from 1, since obj-files start indexing at 1.
      td.style.left = '10px';
      td.style.color = '#000000';
      const tl = new CSS2DObject(td);
      tl.position.copy(vertices[i].coords);

      divs.push(td);
      indicesObject.add(tl);
    }

    this.scene.add(indicesObject);
    this.vertexIndices = { object: indicesObject, divs: divs };
  }

  removeVertexIndices(dispose = false) {
    if (!this.vertexIndices) return;
    this.scene.remove(this.vertexIndices.object);
    for (let d of this.vertexIndices.divs) d.remove();
  }

  generateWires() {
    const graph = this.context.graph;
    if (!graph) return;
    this.removeWires(); // remove old
    const edges = graph.getEdges();

    const wireframeColour = new THREE.Color(0x0000ff);
    const wireframeColour2 = new THREE.Color(0xff0000);
    const materialEdge = new THREE.LineBasicMaterial({
      color: wireframeColour,
    });
    const materialSplitEdge = new THREE.LineBasicMaterial({
      color: wireframeColour2,
    });
    const lines = new THREE.Group();

    for (let i = 0; i < edges.length; i++) {
      const [v1, v2] = edges[i].getVertices();
      const p1 = v1.coords;
      const p2 = v2.coords;

      const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const material = edges[i].twin ? materialSplitEdge : materialEdge;
      const line = new THREE.Line(geometry, material);
      lines.add(line);
    }
    this.wires = lines;
  }

  addWires() {
    if (!this.wires) this.generateWires();
    if (this.wires) this.scene.add(this.wires);
  }

  removeWires(dispose = false) {
    if (!this.wires) return;
    this.scene.remove(this.wires);
    if (dispose) {
      for (let c of this.wires.children) (c as THREE.Line).geometry.dispose();
      this.wires = null;
    }
  }

  generateMesh() {
    const graph = this.context.graph;
    if (!graph) return;
    this.removeMesh(true); // remove old
    const vertices = [];
    const normals = [];
    for (let f of graph.getFaces()) {
      const edges = f.getEdges();
      const v1 = edges[0].getVertices()[0];
      for (let i = 0; i < edges.length; i++) {
        const [v2, v3] = edges[i].getVertices();
        if (v1 == v2 || v1 == v3) continue;
        if (
          v2.coords
            .clone()
            .sub(v1.coords)
            .cross(v3.coords.clone().sub(v1.coords))
            .dot(f.normal) > 0
        ) {
          vertices.push(
            ...(<any>v1.coords),
            ...(<any>v2.coords),
            ...(<any>v3.coords)
          );
        } else {
          vertices.push(
            ...(<any>v1.coords),
            ...(<any>v3.coords),
            ...(<any>v2.coords)
          );
        }
        normals.push(
          ...(<any>f.normal),
          ...(<any>f.normal),
          ...(<any>f.normal)
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3)
    );
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    this.mesh = mesh;
  }

  addMesh() {
    if (!this.mesh) this.generateMesh();
    if (this.mesh) this.scene.add(this.mesh);
  }

  removeMesh(dispose = false) {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    if (dispose) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }

  addFog() {
    this.scene.fog = fog;
  }

  removeFog() {
    this.scene.fog = null;
  }

  addBoundingBox() {
    if (!this.boundingBox) {
      const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
      const lines = new THREE.Group();

      const coords = [];
      for (let i = 0; i < 8; i++)
        coords.push(
          new Vector3(
            (i < 4 ? 1 : 0) - 0.5,
            i % 2,
            (i < 2 || (i >= 4 && i < 6) ? 1 : 0) - 0.5
          ).multiplyScalar(BOUNDING_BOX_SCALE)
        );
      const pairs = [];
      for (let p1 of coords)
        for (let p2 of coords)
          if (p1.distanceTo(p2) == BOUNDING_BOX_SCALE) pairs.push([p1, p2]);

      for (let p of pairs) {
        const [p1, p2] = p;
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geometry, material);
        lines.add(line);
      }

      this.boundingBox = lines;
    }
    this.scene.add(this.boundingBox);
  }

  removeBoundingBox() {
    this.scene.remove(this.boundingBox);
  }

  addGrid() {
    if (!this.grid) {
      const size = GRID_SIZE + 0.01;
      const divisions = GRID_SIZE;
      this.grid = new THREE.GridHelper(size, divisions);
    }
    this.scene.add(this.grid);
  }

  removeGrid() {
    this.scene.remove(this.grid);
  }

  resetCamera() {
    const val = (this.context.getCamera() as OrthographicCamera)
      .isOrthographicCamera;
    this.context.resetCamera(val);
  }

  switchCameraType() {
    if ((this.context.getCamera() as OrthographicCamera).isOrthographicCamera)
      this.setPerspectiveCamera();
    else this.setOrthographicCamera();
  }

  setOrthographicCamera() {
    this.orthoCameraButton[0].hidden = true;
    this.perspCameraButton[0].hidden = false;
    this.context.setOrthographicCamera();
  }

  setPerspectiveCamera() {
    this.orthoCameraButton[0].hidden = false;
    this.perspCameraButton[0].hidden = true;
    this.context.setPerspectiveCamera();
  }

  regenerateVisible() {
    if (this.showCamLightButton[0].checked) this.addCamLight();
    else this.removeCamLight();
    if (this.showAmbLightButton[0].checked) this.addAmbLight();
    else this.removeAmbLight();
    if (this.showFogButton[0].checked) this.addFog();
    else this.removeFog();

    if (this.showAxesButton[0].checked) this.addAxes();
    else this.removeAxes();
    if (this.showGridButton[0].checked) this.addGrid();
    else this.removeGrid();
    //if (this.showScaleButton[0].checked) this.addScale();
    //else this.removeScale()

    if (this.indicesButton[0].checked) this.addVertexIndices();
    else this.removeVertexIndices();
    if (this.solidButton[0].checked) this.addMesh();
    else this.removeMesh();
    if (this.wiresButton[0].checked) this.addWires();
    else this.removeWires();
    if (this.boundingBoxButton[0].checked) this.addBoundingBox();
    else this.removeBoundingBox();
  }

  setupEventListeners() {
    this.showCamLightButton = $('#toggle-camera-light');
    this.showAmbLightButton = $('#toggle-ambient-light');
    this.showFogButton = $('#toggle-fog');

    this.showAxesButton = $('#toggle-axes');
    this.showGridButton = $('#toggle-grid');
    this.showScaleButton = $('#toggle-scale');

    this.resetCameraButton = $('#reset-camera');
    this.orthoCameraButton = $('#orthographic-camera');
    this.perspCameraButton = $('#perspective-camera');

    this.indicesButton = $('#toggle-indices');
    this.solidButton = $('#toggle-solid');
    this.wiresButton = $('#toggle-wireframe');
    this.boundingBoxButton = $('#toggle-bounding-box');

    this.hoverButton = $('#toggle-hover');

    this.showCamLightButton.on('click', () => {
      this.regenerateVisible();
    });

    this.showAmbLightButton.on('click', () => {
      this.regenerateVisible();
    });

    this.showFogButton.on('click', () => {
      this.regenerateVisible();
    });

    this.showAxesButton.on('click', () => {
      this.regenerateVisible();
    });

    this.showGridButton.on('click', () => {
      this.regenerateVisible();
    });

    this.solidButton.on('click', () => {
      this.regenerateVisible();
    });

    this.wiresButton.on('click', () => {
      this.regenerateVisible();
    });

    this.boundingBoxButton.on('click', () => {
      this.regenerateVisible();
    });

    this.showScaleButton.on('click', () => {
      this.regenerateVisible();
    });

    this.resetCameraButton.on('click', () => {
      this.resetCamera();
    });

    this.orthoCameraButton.on('click', () => {
      this.setOrthographicCamera();
    });

    this.perspCameraButton.on('click', () => {
      this.setPerspectiveCamera();
    });

    this.indicesButton.on('click', () => {
      this.regenerateVisible();
    });

    $('#selection-mode').on('click', () => {
      GLOBALS.selectionMode = $('#selection-mode')
        .children('.active')
        .attr('data-id');
    });

    this.hoverButton.on('click', (e: Event) => {
      e.stopPropagation();
      GLOBALS.hover = this.hoverButton[0].checked;
    });
  }
}
