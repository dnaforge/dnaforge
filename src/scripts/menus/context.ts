import * as THREE from 'three';
import { Vector3 } from 'three';
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; //'three/addons/controls/OrbitControls';
import { ArcballControls } from 'three/examples/jsm/controls/ArcballControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer';
import { Controls } from '../editor/controls';
import { Menu } from './menu';
import { ModuleMenu } from './module_menu';
import { Graph } from '../models/graph_model';
import { Editor } from '../editor/editor';
import { downloadIMG } from '../io/download';
import { RoutingStrategy } from '../models/cylinder';

const canvas = <HTMLCanvasElement>document.querySelector('#canvas');

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

/**
 * Main context of the program. This class contains the main loop, scene, and renderer, and keeps track of all the
 * sub modules and their interface elements etc.
 */
export class Context {
  controls: Controls = new Controls(this);
  editor: Editor = new Editor(this);

  scene: THREE.Scene = new THREE.Scene();
  camera: THREE.Camera;
  cameraControls: ArcballControls;
  callbacks: { (): void }[] = [];

  graph: Graph = null;
  activeContext: ModuleMenu = null;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;

  menus = new Map<string, Menu>();

  tooltip: {
    object: THREE.Object3D;
    div: HTMLElement;
  };

  statsNeedUpdate = true;

  constructor() {
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.add(new THREE.AmbientLight(0x333333));

    this.setupRenderer();
    this.setupEventListeners();
    this.setupHotkeys();
    this.resetCamera(false);
    this.render();
  }

  /**
   * Associates hotkeys with functions or buttons.
   */
  setupHotkeys() {
    this.controls.registerHotkey(
      'p',
      () => {
        return this.getScreenshot();
      },
      'global',
    );
  }

  /**
   * Registers a menu with the main context. Allows it to handle hotkeys and be accessed
   * from elsewhere in the program. All menus should be registered.
   *
   * @param menu
   */
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

  /**
   * Main loop.
   */
  private render() {
    const renderT = () => {
      for (const c of this.callbacks) c();
      this.controls.handleInput();
      this.cameraControls.update();
      requestAnimationFrame(renderT);
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);

      if (this.statsNeedUpdate) {
        this.statsNeedUpdate = false;
        this.updateSceneStatistics();
      }
    };
    renderT();
  }

  getScreenshot() {
    const X = 7680;
    const Y = X * (canvas.height / canvas.width);
    canvas.width = X;
    canvas.height = Y;
    this.renderer.setSize(X, Y);
    this.renderer.render(this.scene, this.camera);

    const imgData = this.renderer.domElement.toDataURL('image/png');
    downloadIMG('untitled.png', imgData);
    this.resetSize();
  }

  resetSize() {
    cameraParams.aspect = window.innerWidth / window.innerHeight;
    cameraParams.left = (cameraParams.frustumSize * cameraParams.aspect) / -2;
    cameraParams.right = (cameraParams.frustumSize * cameraParams.aspect) / 2;

    (this.camera as any).aspect = cameraParams.aspect;
    (this.camera as any).left = cameraParams.left;
    (this.camera as any).right = cameraParams.right;

    (this.camera as any).updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Focuses the camera to a point in space.
   *
   * @param point
   */
  focusCamera(point: Vector3) {
    this.cameraControls.target.copy(point);
    this.cameraControls.update();
  }

  /**
   * Sets the camera view to one of three options.
   *
   * @param dir direction. front, right, or top
   */
  setCameraView(dir: string) {
    // TODO: use current distance to target
    const dist = 20;
    switch (dir) {
      case 'front':
        this.cameraControls.reset();
        this.camera.position.copy(new Vector3(0, 5, dist));
        this.cameraControls.target = new Vector3(0, 5, 0);
        break;
      case 'right':
        this.cameraControls.reset();
        this.camera.position.copy(new Vector3(dist, 5, 0));
        this.cameraControls.target = new Vector3(0, 5, 0);
        break;
      case 'top':
        this.cameraControls.reset();
        this.camera.position.copy(new Vector3(0, dist, 0));
        this.cameraControls.target = new Vector3(0, 0, 0);
        break;

      default:
        break;
    }
    this.cameraControls.update();
  }

  /**
   * Rotates camera by 25 degrees around the given direction.
   *
   * @param dir Direction. up, down, left, or right.
   */
  rotateCameraView(dir: string) {
    switch (dir) {
      case 'up':
        this.camera.position.applyAxisAngle(
          new Vector3(1, 0, 0),
          -Math.PI / 24,
        );
        break;
      case 'down':
        this.camera.position.applyAxisAngle(new Vector3(1, 0, 0), Math.PI / 24);
        break;
      case 'left':
        this.camera.position.applyAxisAngle(
          new Vector3(0, 1, 0),
          -Math.PI / 24,
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

  /**
   * Flips camera view by 180 degrees.
   */
  flipCameraView() {
    const cPos = this.camera.position;
    const tPos = this.cameraControls.target;
    this.camera.position.copy(new Vector3(-cPos.x, -(cPos.y - 5) + 5, -cPos.z));
    this.cameraControls.target.copy(
      new Vector3(-tPos.x, -(tPos.y - 5) + 5, -tPos.z),
    );
    this.cameraControls.update();
  }

  getCamera(): THREE.Camera {
    return this.camera;
  }

  /**
   * Resets camera to its original settings. Either to an orthographic
   * or to a perspective camera.
   *
   * @param toOrthographic Otherwise perspective.
   */
  resetCamera(toOrthographic: boolean) {
    if (toOrthographic) {
      this.camera = new THREE.OrthographicCamera(
        cameraParams.left,
        cameraParams.right,
        cameraParams.top,
        cameraParams.bottom,
        -1000,
        cameraParams.far,
      );
    } else {
      this.camera = new THREE.PerspectiveCamera(
        cameraParams.fov,
        cameraParams.aspect,
        cameraParams.near,
        cameraParams.far,
      );
    }
    this.cameraControls && this.cameraControls.dispose();
    this.cameraControls = new ArcballControls(
      this.camera,
      document.querySelector('#canvas'),
      this.scene,
    );
    this.cameraControls.setGizmosVisible(false);
    this.cameraControls.wMax = 5;
    this.cameraControls.cursorZoom = true;

    this.camera.position.copy(new Vector3(0, 5, 20));
    this.cameraControls.target = new Vector3(0, 5, 0);
    this.cameraControls.update();
  }

  /**
   * Sets the camera to an orthographic camera. Tries to preserve its
   * current orientation.
   */
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

  /**
   * Sets the camera to a perspective camera. Tries to preserve its
   * current orientation.
   */
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

  /**
   * Adds a notification to the scene. Disappears after a while.
   *
   * @param message contents of the notification
   * @param type default, success, info, alert, or warning
   * @param duration lifetime of the message
   */
  addMessage(message: string, type: string, duration = 3000) {
    const notify = Metro.notify;
    notify.setup({
      width: 300,
    });
    notify.create(message, null, {
      cls: type,
      keepOpen: true,
    });

    const stripped = $(`<div>${message}</div>`).text();
    console.log(
      `${type.toUpperCase()}: ${message.replace(
        /<\/?("[^"]*"|'[^']*'|[^>])*(>|$)/g,
        ' ',
      )}`,
    );

    const els = $('.notify-container').children();
    const created = $(els[els.length - 1]);
    this.closeMessage(created, duration);
  }

  async closeMessage(el: any, timeout: number) {
    const wait = () => new Promise((resolve) => setTimeout(resolve, timeout));
    await wait();
    el.remove();
  }

  toJSON(selection: JSONObject): JSONObject {
    const json: JSONObject = {
      graph: this.graph?.toJSON(),
      active: this.activeContext?.elementId,
    };
    for (const menu of this.menus.keys()) {
      if (!selection[menu]) continue;
      json[menu] = this.menus.get(menu).toJSON(<JSONObject>selection[menu]);
    }
    return json;
  }

  loadJSON(json: any) {
    json.graph && this.setGraph(Graph.loadJSON(json.graph));
    for (const menu of this.menus.keys()) {
      const mJson = json[menu];
      mJson && this.menus.get(menu).loadJSON(mJson);
      this.menus.get(menu).inactivate();
    }
    if (!this.activeContext && json.active) {
      this.menus.get(json.active).activate();
      this.activeContext = <ModuleMenu>this.menus.get(json.active);
    }
    this.activeContext && this.activeContext.activate();
  }

  /**
   * Resets the main context. Also resets all the menus.
   *
   */
  reset() {
    this.graph = null;
    for (const ctx of this.menus.values()) ctx.reset();
    this.editor.reset();
  }

  /**
   * Resets the main context and sets the new graph.
   *
   * @param graph
   */
  setGraph(graph: Graph) {
    this.reset();
    this.graph = graph;
    for (const ctx of this.menus.values()) ctx.isGlobal && ctx.activate();
    this.addMessage(
      `Loaded a graph with<br>${graph.getVertices().length} vertices<br>${
        graph.getEdges().length
      } edges<br>${graph.getFaces().length} faces`,
      'info',
    );
    this.statsNeedUpdate = true;
  }

  /**
   * Sets the tooltip in the 3D scene around the given point. Note that there is only ever this one
   * tooltip.
   *
   * @param point
   * @param content
   */
  addTooltip(point: Vector3, content: string) {
    if (!this.tooltip) {
      const td = document.createElement('div');
      td.style.left = '50px';
      td.style.color = '#000000';
      td.style.backgroundColor = 'rgba(255,255,255,0.6)';
      td.style.border = '1px';
      const tl = new CSS2DObject(td);
      this.tooltip = { object: tl, div: td };
      this.scene.add(this.tooltip.object);
    }
    this.tooltip.object.position.copy(point);
    this.tooltip.div.innerHTML = content;
    this.tooltip.div.hidden = false;
  }

  /**
   * Remove the tooltip.
   */
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

  /**
   * Switches context. Set the given context as the active one and inactivates others. Does not inactivate global
   * contexts.
   *
   * @param context
   */
  switchContext(context: ModuleMenu) {
    const prevContext = this.activeContext;
    this.activeContext = context;
    prevContext && prevContext.inactivate();
    context.activate();
    this.addMessage(`Switched to ${context.title} context.`, 'info', 500);
    this.statsNeedUpdate = true;
  }

  /**
   * Called when switching to a new menu. If the new menu is not a global one, sets it as active and inactivates the old
   * one.
   *
   * @param id element id of the new menu
   */
  switchMainTab(id: string) {
    const menu = this.menus.get(id);
    if (menu && !menu.isGlobal) this.switchContext(<ModuleMenu>menu);
  }

  updateSceneStatistics() {
    const container = $('#scene-stats');
    container.html('');
    if (!this.graph) {
      container.text('No graph loaded.');
      return;
    }

    const tree = $('<ul>', { 'data-role': 'treeview' });
    container.append(tree);

    // Graph:
    const graphData = $('<li>Graph</li>');
    const data = $('<ul>');
    const verts = $(`<li>Vertices: ${this.graph.getVertices().length}</li>`);
    const edges = $(`<li>Edges: ${this.graph.getEdges().length}</li>`);
    const faces = $(`<li>Faces: ${this.graph.getFaces().length}</li>`);

    tree.append(graphData);
    graphData.append(data);
    data.append(verts);
    data.append(edges);
    data.append(faces);

    // CM:
    const cm = this.activeContext?.cm;
    if (cm) {
      const pseudoCount = (() => {
        let i = 0;
        for (const c of cm.getCylinders()) {
          if (c.routingStrategy == RoutingStrategy.Pseudoknot) i += 1;
        }
        return i;
      })();

      const cmData = $('<li>Cylinder Model</li>');
      const data = $('<ul>');
      const cylinders = $(`<li>Cylinders: ${cm.getCylinders().length}</li>`);
      const pseudoknots = $(`<li>Pseudoknots: ${pseudoCount}</li>`);

      tree.append(cmData);
      cmData.append(data);
      data.append(cylinders);
      data.append(pseudoknots);
    }

    // NM:
    const nm = this.activeContext?.nm;
    if (nm) {
      const nmData = $('<li>Nucleotide Model</li>');
      const data = $('<ul>');
      const nucleotides = $(
        `<li>Nucleotides: ${nm.getNucleotides().length}</li>`,
      );
      const strands = $(`<li>Strands: ${nm.getStrands().length}</li>`);

      tree.append(nmData);
      nmData.append(data);
      data.append(nucleotides);
      data.append(strands);
    }

    // Selection:
    const selection = this.editor.activeModel?.selection;
    if (selection && this.editor.activeModel?.isVisible) {
      const sData = $('<li>Selection</li>');
      const data = $('<ul>');
      const n = $(`<li>N: ${selection.size}</li>`);

      tree.append(sData);
      sData.append(data);
      data.append(n);
    }
  }

  /**
   * Connects the HTML elements relevant to main context to it. Adds their event listeners.
   */
  private setupEventListeners() {
    $('#main-tabs').on('tab', (e: any) => {
      (<HTMLElement>document.activeElement).blur();
      const id = e.detail.tab.id.replace('-tab', '');
      return this.switchMainTab(id);
    });

    window.onresize = () => {
      this.resetSize();
    };
  }
}
