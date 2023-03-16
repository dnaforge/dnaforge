import * as THREE from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; //'three/addons/controls/OrbitControls';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer';
import Controls from '../utils/controls';
import Menu from './menu';
import ModuleMenu from '../modules/module_menu';
import { Graph } from '../models/graph';

const canvas = document.querySelector('#canvas');

//TODO: move camera controls to controls class and the interface class

const cameraParams = (() => {
  const fov = 60;
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 10;
  const left = (frustumSize * aspect) / -2;
  const right = (frustumSize * aspect) / 2;
  const top = frustumSize / 2;
  const bottom = frustumSize / -2;
  const near = 0.01;
  const far = 500;

  return {
    fov: fov,
    aspect: aspect,
    frustumSize: frustumSize,

    left: left,
    right: right,
    top: top,
    bottom: bottom,
    near: near,
    far: far,
  };
})();

export default class Context {
  scene: THREE.Scene;
  camera: THREE.Camera;
  cameraControls: OrbitControls;
  callbacks: { (): void }[];

  graph: Graph;
  controls: any;
  activeContext: any;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;

  menus = new Map<string, Menu>();

  tooltip: {
    object: THREE.Object3D;
    div: HTMLElement;
  };

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.add(new THREE.AmbientLight(0x333333));
    this.callbacks = [];

    this.graph = null;
    this.controls = new Controls(this);
    this.activeContext = null;

    this.setupRenderer();
    this.setupEventListeners();
    this.resetCamera(false);
    this.render();
  }

  registerMenu(menu: Menu) {
    this.menus.set(menu.elementId, menu);
  }

  private setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    this.labelRenderer = new CSS2DRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = 'fixed';
    this.labelRenderer.domElement.style.top = (canvas as HTMLElement).style.top;
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(this.labelRenderer.domElement);
  }

  private render() {
    const renderT = () => {
      for (const c of this.callbacks) c();
      this.controls.handleInput();
      requestAnimationFrame(renderT);
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    };
    renderT();
  }

  handleHotKey(key: string) {
    if (this.activeContext && this.activeContext.handleHotKey(key)) return;
    for (const menu of this.menus.values())
      if (menu.isGlobal && menu.handleHotKey(key)) return;
    switch (key) {
      case 'asdf':
        console.log('asdf');
        break;

      default:
        break;
    }
  }

  focusCamera(point: Vector3) {
    this.cameraControls.target.copy(point);
    const d = this.cameraControls.target
      .clone()
      .sub(this.camera.position)
      .length();
    const dir = this.cameraControls.target
      .clone()
      .sub(this.camera.position)
      .normalize();
    const nPos = this.cameraControls.target
      .clone()
      .sub(dir.multiplyScalar(Math.min(d, 3)));
    this.camera.position.copy(nPos);
    this.cameraControls.update();
  }

  // TODO: use current distance to target
  setCameraView(dir: string) {
    const dist = 20;
    switch (dir) {
      case 'front':
        this.camera.position.copy(new Vector3(0, 5, dist));
        this.cameraControls.target = new Vector3(0, 5, 0);
        break;
      case 'right':
        this.camera.position.copy(new Vector3(dist, 5, 0));
        this.cameraControls.target = new Vector3(0, 5, 0);
        break;
      case 'top':
        this.camera.position.copy(new Vector3(0, dist, 0));
        this.cameraControls.target = new Vector3(0, 0, 0);
        break;

      default:
        break;
    }
    this.cameraControls.update();
  }

  rotateCameraView(dir: string) {
    switch (dir) {
      case 'up':
        this.camera.position.applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 24);
        break;
      case 'down':
        this.camera.position.applyAxisAngle(
          new Vector3(0, 1, 0),
          -Math.PI / 24
        );
        break;
      case 'left':
        this.camera.position.applyAxisAngle(
          new Vector3(0, 1, 0),
          -Math.PI / 24
        );
        break;
      case 'right':
        this.camera.position.applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 24);
        break;

      default:
        break;
    }
    this.cameraControls.update();
  }

  flipCameraView() {
    const cPos = this.camera.position;
    const tPos = this.cameraControls.target;
    this.camera.position.copy(new Vector3(-cPos.x, -(cPos.y - 5) + 5, -cPos.z));
    this.cameraControls.target.copy(
      new Vector3(-tPos.x, -(tPos.y - 5) + 5, -tPos.z)
    );
    this.cameraControls.update();
  }

  setCamera(cam: THREE.Camera) {
    this.camera = cam;
    this.cameraControls.dispose();
    this.cameraControls = new OrbitControls(
      this.camera,
      document.querySelector('#canvas')
    );
    this.cameraControls.update();
  }

  getCamera(): THREE.Camera {
    return this.camera;
  }

  resetCamera(toOrthographic: boolean) {
    if (toOrthographic) {
      this.camera = new THREE.OrthographicCamera(
        cameraParams.left,
        cameraParams.right,
        cameraParams.top,
        cameraParams.bottom,
        cameraParams.near,
        cameraParams.far
      );
    } else {
      this.camera = new THREE.PerspectiveCamera(
        cameraParams.fov,
        cameraParams.aspect,
        cameraParams.near,
        cameraParams.far
      );
    }
    this.camera.position.z = 10;
    this.cameraControls && this.cameraControls.dispose();
    this.cameraControls = new OrbitControls(
      this.camera,
      document.querySelector('#canvas')
    );
    this.cameraControls.update();
  }

  setOrthographicCamera() {
    const pos = this.camera.position;
    const rot = this.camera.rotation;
    const tar = this.cameraControls.target;
    this.resetCamera(true);
    this.camera.position.copy(pos);
    this.camera.rotation.copy(rot);
    this.cameraControls.target = tar;
    this.cameraControls.update();
  }

  setPerspectiveCamera() {
    const pos = this.camera.position;
    const rot = this.camera.rotation;
    const tar = this.cameraControls.target;
    this.resetCamera(false);
    this.camera.position.copy(pos);
    this.camera.rotation.copy(rot);
    this.cameraControls.target = tar;
    this.cameraControls.update();
  }

  addMessage(message: string, type: string, duration = 3000) {
    const notify = Metro.notify;
    notify.setup({
      width: 300,
      timeout: duration,
    });
    notify.create(message, null, {
      cls: type,
    });

    //Metro.toast.create(message, null, null, null, null);
  }

  reset(graph: Graph) {
    this.graph = graph;
    for (const ctx of this.menus.values()) ctx.reset();
    this.activeContext = null;
  }

  setGraph(graph: Graph) {
    this.reset(graph);
    this.addMessage(
      `Loaded a graph with<br>${graph.getVertices().length} vertices<br>${
        graph.getEdges().length
      } edges<br>${graph.getFaces().length} faces`,
      'info'
    );
  }

  selectAll() {
    this.activeContext && this.activeContext.selectAll();
  }

  deselectAll() {
    this.activeContext && this.activeContext.deselectAll();
  }

  addTooltip(point: Vector3, content: string) {
    if (!this.tooltip) {
      const td = document.createElement('div');
      td.style.left = '50px';
      td.style.color = '#000000';
      td.style.backgroundColor = '#ffffff';
      td.style.border = '1px';
      const tl = new CSS2DObject(td);
      this.tooltip = { object: tl, div: td };
      this.scene.add(this.tooltip.object);
    }
    this.tooltip.object.position.copy(point);
    this.tooltip.div.innerHTML = content;
    this.tooltip.div.hidden = false;
  }

  removeTooltip() {
    if (!this.tooltip) return;
    this.tooltip.div.hidden = true;
  }

  createWindow() {
    const t = document.createElement('div');
    t.innerHTML = `<div class="p-2" data-role="window"
                        data-draggable="true"
                        data-width="200"
                        data-height="160">
                        Drag this window on the caption.
                        </div>`;
    document.body.appendChild(t.firstChild);
  }

  switchContext(context: ModuleMenu) {
    this.activeContext && this.activeContext.inactivate();
    context.activate();
    this.activeContext = context;
    this.addMessage(`Switched to ${context.title} context.`, 'info', 500);
  }

  switchMainTab(id: string) {
    const menu = this.menus.get(id);
    if (menu && !menu.isGlobal) this.switchContext(<ModuleMenu>menu);
  }

  private setupEventListeners() {
    $('#main-tabs').on('tab', (e: any) => {
      (<HTMLElement>document.activeElement).blur();
      const id = e.detail.tab.id.replace('-tab', '');
      return this.switchMainTab(id);
    });

    window.onresize = () => {
      cameraParams.aspect = window.innerWidth / window.innerHeight;
      cameraParams.left = (cameraParams.frustumSize * cameraParams.aspect) / -2;
      cameraParams.right = (cameraParams.frustumSize * cameraParams.aspect) / 2;

      (this.camera as any).aspect = cameraParams.aspect;
      (this.camera as any).left = cameraParams.left;
      (this.camera as any).right = cameraParams.right;

      (this.camera as any).updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    };
  }
}
