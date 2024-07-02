import * as THREE from 'three';
import { OrthographicCamera, Vector3 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLOBALS } from '../globals/globals';
import { Context } from './context';
import { Menu, MenuParameters } from './menu';
import { ColourScheme, ColourSchemePresets } from '../models/colour_schemes';
import { downloadTXT } from '../io/download';
import { read_json } from '../io/read_json';
import { Nucleotide } from '../models/nucleotide';

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
  visible?: boolean;
}

/**
 * Interface menu.
 */
export class InterfaceMenu extends Menu {
  cameraLight = new THREE.DirectionalLight(0xffffff, 3);
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
  scaleBar: CSSOBject;
  vertexIndices: CSSOBject;
  wires: THREE.Group;
  boundingBox: THREE.Group;
  mesh: THREE.Mesh;
  grid: THREE.GridHelper;

  constructor(context: Context) {
    super(context, 'interface', 'Interface', true);

    context.callbacks.push(() => {
      const cam = this.context.getCamera();
      const pos = cam.position.clone();

      const offset = new Vector3();
      cam
        .getWorldDirection(offset)
        .divideScalar((cam as OrthographicCamera).zoom / -1005);
      pos.add(offset);

      this.cameraLight.position.copy(pos);
    });

    this.scene.add(this.cameraLight);
    this.generateVisible();
    this.createColoursComponent();
  }

  /**
   * Activate this context.
   */
  activate() {
    this.generateVisible();
  }

  toJSON(): JSONObject {
    return {};
  }

  loadJSON(json: JSONObject) {
    return;
  }

  registerHotkeys() {
    this.context.controls.registerHotkey('z', this.showAxesButton);
    this.context.controls.registerHotkey('shift+z', this.showGridButton);
    this.context.controls.registerHotkey(
      'shift+1',
      $($('#selection-mode').find('button')[0]),
    );
    this.context.controls.registerHotkey(
      'shift+2',
      $($('#selection-mode').find('button')[1]),
    );
    this.context.controls.registerHotkey(
      'shift+3',
      $($('#selection-mode').find('button')[2]),
    );
    this.context.controls.registerHotkey(
      'shift+4',
      $($('#selection-mode').find('button')[3]),
    );
    this.context.controls.registerHotkey('4', this.wiresButton);
    this.context.controls.registerHotkey('5', this.solidButton);
    this.context.controls.registerHotkey('6', this.indicesButton);
    this.context.controls.registerHotkey('7', this.boundingBoxButton);
    this.context.controls.registerHotkey('q', this.hoverButton);
    this.context.controls.registerHotkey('np1', () => {
      this.context.setCameraView('front');
    });
    this.context.controls.registerHotkey('np2', () => {
      this.context.rotateCameraView('down');
    });
    this.context.controls.registerHotkey('np3', () => {
      this.context.setCameraView('right');
    });
    this.context.controls.registerHotkey('np4', () => {
      this.context.rotateCameraView('left');
    });
    this.context.controls.registerHotkey('np5', () => {
      this.switchCameraType();
    });
    this.context.controls.registerHotkey('np6', () => {
      this.context.rotateCameraView('right');
    });
    this.context.controls.registerHotkey('np7', () => {
      this.context.setCameraView('top');
    });
    this.context.controls.registerHotkey('np8', () => {
      this.context.rotateCameraView('up');
    });
    this.context.controls.registerHotkey('np9', () => {
      this.context.flipCameraView();
    });
    this.context.controls.registerHotkey('np,', this.resetCameraButton);
  }

  reset() {
    this.removeWires(true);
    this.removeMesh(true);
    this.removeVertexIndices();
  }

  /**
   * Add the XYZ-axes to the scene.
   */
  addAxes() {
    if (!this.axes) {
      const origin = new THREE.Vector3(0, 0, 0);
      const length = 4;

      const X = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        origin,
        length,
        0xff0000,
      );
      const Y = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        origin,
        length,
        0x000000,
      );
      const Z = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        origin,
        length,
        0x0000ff,
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

      this.scene.add(this.axes.object);
    }
    this.axes.object.visible = true;
    for (const d of this.axes.divs) d.hidden = false;
  }

  /**
   * Remove the XYZ-axes from the scene.
   */
  removeAxes() {
    if (!this.axes) return;
    this.axes.object.visible = false;
    for (const d of this.axes.divs) d.hidden = true;
  }

  addScale() {
    if (!this.scaleBar) {
      const scaleDiv = document.createElement('div');
      scaleDiv.textContent = '';
      scaleDiv.style.fontSize = '15px';
      const scaleText = new CSS2DObject(scaleDiv);
      scaleText.translateX(6.5);
      scaleText.translateZ(7.5);

      const geo = new THREE.BoxGeometry(1, 0.04, 0.04);
      const scaleBar = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0x000000 }),
      );
      scaleBar.position.set(6.5, 0, 7.1);

      const scaleBarObj = new THREE.Group();
      scaleBarObj.add(scaleBar, scaleText);

      this.scaleBar = { object: scaleBarObj, divs: [scaleDiv], visible: false };
      this.scene.add(this.scaleBar.object);
    }
    if (this.scaleBar.visible && this.showGridButton[0].checked) {
      this.scaleBar.object.visible = true;
      for (const d of this.scaleBar.divs) d.hidden = false;
    } else this.removeScale();
  }

  updateScale() {
    const setText = (value: number) => {
      this.scaleBar.divs[0].textContent = `${Number(value.toFixed(5))} nm`;
      this.addScale();
    };

    const cm = this.context.activeContext?.cm;
    if (cm) {
      this.scaleBar.visible = true;
      setText(1 / cm.scale);
    } else {
      this.scaleBar.visible = false;
      this.removeScale();
    }
    this.context.rendererNeedsUpdate = true;
  }

  removeScale() {
    if (this.scaleBar) {
      this.scaleBar.object.visible = false;
      for (const d of this.scaleBar.divs) d.hidden = true;
    }
  }

  /**
   * Adds a light that follows the camera.
   */
  addCamLight() {
    this.scene.add(this.cameraLight);
  }

  /**
   * Removes the light that follows the camera.
   */
  removeCamLight() {
    this.scene.remove(this.cameraLight);
  }

  /**
   * Adds an ambient light.
   */
  addAmbLight() {
    this.scene.add(this.ambientLight);
  }

  /**
   * Removes the ambient light.
   */
  removeAmbLight() {
    this.scene.remove(this.ambientLight);
  }

  /**
   * Adds vertex indices to the 3d scene.
   */
  addVertexIndices() {
    const graph = this.context.graph;
    if (!graph) return;
    if (this.vertexIndices) this.removeVertexIndices(); // remove old
    const vertices = graph.getVertices();

    const divs = [];
    const indicesObject = new THREE.Group();
    for (let i = 0; i < vertices.length; i++) {
      const td = document.createElement('div');
      (td as any).textContent = vertices[i].id;
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

  /**
   * Remove the vertex indices from the 3d scene.
   */
  removeVertexIndices() {
    if (!this.vertexIndices) return;
    this.scene.remove(this.vertexIndices.object);
    for (const d of this.vertexIndices.divs) d.remove();
  }

  /**
   * Generate the mesh wireframe 3d object.
   */
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
      const material = edges[i].isSplit() ? materialSplitEdge : materialEdge;
      const line = new THREE.Line(geometry, material);
      lines.add(line);
    }
    this.wires = lines;
  }

  /**
   * Add the mesh wireframe to the 3d scene.
   */
  addWires() {
    if (!this.wires) this.generateWires();
    if (this.wires) this.scene.add(this.wires);
  }

  /**
   * Remove the mesh wireframe from the 3d scene
   *
   * @param dispose delete the object as well
   */
  removeWires(dispose = false) {
    if (!this.wires) return;
    this.scene.remove(this.wires);
    if (dispose) {
      for (const c of this.wires.children) (c as THREE.Line).geometry.dispose();
      this.wires = null;
    }
  }

  /**
   * Generate the mesh 3d model. This mesh only contains the faces.
   */
  generateMesh() {
    const graph = this.context.graph;
    if (!graph) return;
    this.removeMesh(true); // remove old
    const vertices = [];
    const normals = [];
    for (const f of graph.getFaces()) {
      const tris = f.triangulate();
      for (const tri of tris) {
        const [v1, v2, v3] = tri;
        vertices.push(
          ...(<any>v1.coords),
          ...(<any>v2.coords),
          ...(<any>v3.coords),
        );
        normals.push(
          ...(<any>f.normal),
          ...(<any>f.normal),
          ...(<any>f.normal),
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3),
    );
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    this.mesh = mesh;
  }

  /**
   * Add the mesh 3d model to the 3d scene.
   */
  addMesh() {
    if (!this.mesh) this.generateMesh();
    if (this.mesh) this.scene.add(this.mesh);
  }

  /**
   * Remove the mesh 3d model from the 3d scene.
   *
   * @param dispose also delete the model
   */
  removeMesh(dispose = false) {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    if (dispose) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }

  /**
   * Adds a fog that causes far away objects in the 3d scene to fade away.
   */
  addFog() {
    this.scene.fog = fog;
  }

  /**
   * Removes the fog from the scene.
   */
  removeFog() {
    this.scene.fog = null;
  }

  /**
   * Adds a bounding box of the graph to the scene.
   */
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
            (i < 2 || (i >= 4 && i < 6) ? 1 : 0) - 0.5,
          ).multiplyScalar(BOUNDING_BOX_SCALE),
        );
      const pairs = [];
      for (const p1 of coords)
        for (const p2 of coords)
          if (p1.distanceTo(p2) == BOUNDING_BOX_SCALE) pairs.push([p1, p2]);

      for (const p of pairs) {
        const [p1, p2] = p;
        const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geometry, material);
        lines.add(line);
      }

      this.boundingBox = lines;
    }
    this.scene.add(this.boundingBox);
  }

  /**
   * Remove the bounding box from the 3d scene.
   */
  removeBoundingBox() {
    this.scene.remove(this.boundingBox);
  }

  /**
   * Adds a grid to the 3d scene. The scale factor used in the routing models should match the grid size.
   */
  addGrid() {
    if (!this.grid) {
      const size = GRID_SIZE + 0.01;
      const divisions = GRID_SIZE;
      this.grid = new THREE.GridHelper(size, divisions);
      this.scene.add(this.grid);
    }
    this.grid.visible = true;
    this.addScale();
  }

  /**
   * Removes the the grid from the 3d scene.
   */
  removeGrid() {
    if (this.grid) this.grid.visible = false;
    this.removeScale();
  }

  /**
   * Resets the camera transformations.
   */
  resetCamera() {
    const val = (this.context.getCamera() as OrthographicCamera)
      .isOrthographicCamera;
    this.context.resetCamera(val);
  }

  /**
   * Switch the current camera type between orthographic and perspective.
   */
  switchCameraType() {
    if ((this.context.getCamera() as OrthographicCamera).isOrthographicCamera)
      this.setPerspectiveCamera();
    else this.setOrthographicCamera();
  }

  /**
   * Sets the current camera to an orthographic one.
   */
  setOrthographicCamera() {
    this.orthoCameraButton[0].hidden = true;
    this.perspCameraButton[0].hidden = false;
    this.context.setOrthographicCamera();
  }

  /**
   * Sets the current camera to perspective one.
   */
  setPerspectiveCamera() {
    this.orthoCameraButton[0].hidden = false;
    this.perspCameraButton[0].hidden = true;
    this.context.setPerspectiveCamera();
  }

  loadColourScheme(json: typeof ColourScheme) {
    let kt: keyof typeof ColourScheme;
    for (kt in json) {
      for (const c in json[kt]) {
        (<any>ColourSchemePresets['Custom'][kt])[c] = new THREE.Color(
          (<any>json[kt])[c],
        );
      }
    }
    $('#ui-colours-presets')[0].value = 'Custom';
    Object.assign(ColourScheme, ColourSchemePresets['Custom']);
    this.createColoursSwatches();
    this.context.editor.UpdateObjectVisuals();
  }

  createColoursComponent() {
    this.createColoursSwatches();
    for (const scheme in ColourSchemePresets) {
      $('#ui-colours-presets').append($(`<option>${scheme}</option>`));
    }
    const updateRandomColours = () => {
      for (const ct of Object.values(ColourSchemePresets['Random'])) {
        for (const v of Object.values(ct)) {
          (<THREE.Color>v).setHex(0xffffff * Math.random());
        }
      }
    };
    $('#ui-colours-presets').on('change', () => {
      const nScheme = $('#ui-colours-presets').val();
      if (nScheme == 'Random') updateRandomColours();
      Object.assign(ColourScheme, ColourSchemePresets[nScheme]);
      this.createColoursSwatches();
      this.context.editor.UpdateObjectVisuals();
    });
  }

  createColoursSwatches() {
    const container = $('#ui-colours');
    container.html('');
    const createSubComponent = (
      category: keyof typeof ColourScheme,
      varN = false,
    ) => {
      const dict: Record<string, THREE.Color> = ColourScheme[category];
      const customVals: Record<string, THREE.Color> =
        ColourSchemePresets['Custom'][category];

      let swatchContainer: any;
      let i = 0;

      const copyToCustom = () => {
        if ($('#ui-colours-presets')[0].value != 'Custom') {
          let kt: keyof typeof ColourScheme;
          for (const t in customVals) delete customVals[t];
          for (kt in ColourScheme) {
            for (const c in ColourScheme[kt]) {
              (<any>ColourSchemePresets['Custom'][kt])[c] = (<any>(
                ColourScheme[kt]
              ))[c];
            }
          }
          $('#ui-colours-presets')[0].value = 'Custom';
          Object.assign(ColourScheme, ColourSchemePresets['Custom']);
        }
      };

      let k: keyof typeof customVals;
      for (k in dict) {
        if (!(i++ % 8)) {
          swatchContainer = $('<div>', { class: 'group-list horizontal' });
          container.append(swatchContainer);
        }
        const swatch = $(`<div>`, { class: '' });
        swatch.append(
          $(`<span> ${k} </span>`, { class: 'd-inline', style: 'margin: 5px' }),
        );
        const colour = $('<input>', { type: 'color' });

        swatch.append(colour);
        swatchContainer.append(swatch);
        colour[0].value = `#${dict[k].getHexString()}`;

        const kClosure = k;
        colour.on('change', () => {
          copyToCustom();
          const colourVal = new THREE.Color(colour.val());
          customVals[kClosure] = colourVal;
          this.context.editor.UpdateObjectVisuals();
          this.updateArcDiagram();
        });

        if (varN) {
          const cross = $("<a href='javascript:void(0)'>x</a>", {
            class: 'badge',
          });
          swatch.append(cross);

          const del = () => {
            if (Object.keys(customVals).length <= 1) return;
            copyToCustom();

            delete customVals[kClosure];
            //swatch.remove();
            //if(swatchContainer.children().length == 0) swatchContainer.remove();
            this.createColoursSwatches();

            this.context.editor.UpdateObjectVisuals();
            this.updateArcDiagram();
          };

          cross.on('click', del);
          colour.on('contextMenu', (e: MouseEvent) => {
            e.preventDefault();
            del();
          });
        }
      }

      if (varN) {
        const add = $('<button>+</button>');
        container.append(add);
        add.on('click', () => {
          copyToCustom();
          for (let i = 1; i < Object.keys(customVals).length + 2; i++) {
            if (!customVals[i]) {
              customVals[i] = new THREE.Color().setHex(
                0xffffff * Math.random(),
              );
              break;
            }
          }
          this.createColoursSwatches();
          this.context.editor.UpdateObjectVisuals();
          this.updateArcDiagram();
        });
      }
    };

    //Wires:
    container.append($('<p>Wires Colours</p>'));
    createSubComponent('WiresColours', true);

    //Nucleotides:
    container.append($('<p>Nucleotide Colours</p>'));
    createSubComponent('NucleotideColours');
    container.append($('<p>Nucleotide Selection Colours</p>'));
    createSubComponent('NucleotideSelectionColours');

    //Strands
    container.append($('<p>Strand Colours</p>'));
    createSubComponent('StrandColours', true);

    //Cylinders:
    container.append($('<p>Cylinder Colours</p>'));
    createSubComponent('CylinderColours');
    container.append($('<p>CylinderSelection Colours</p>'));
    createSubComponent('CylinderSelectionColours');
  }

  updateSceneStatistics() {
    const container = $('#scene-stats');
    container.html('');
    if (!this.context.graph) {
      container.text('No graph loaded.');
      return;
    }

    const root = $('<ul>', { 'data-role': 'treeview' });
    container.append(root);

    const createComponent = (title: string, data: JSONObject) => {
      const componentRoot = $(`<li>${title}</li>`);
      const componentData = $('<ul>');

      let count = 0;
      for (const key in data) {
        count += 1;
        const line = $(`<li>${key}: ${data[key]}</li>`);
        componentData.append(line);
      }

      if (count > 0) {
        // Only create data if there is any data
        root.append(componentRoot);
        componentRoot.append(componentData);
      }
    };

    // Graph:
    const graphData = {
      Nodes: this.context.graph.getVertices().length,
      Edges: this.context.graph.getEdges().length,
      Faces: this.context.graph.getFaces().length,
    };
    createComponent('Mesh Model', graphData);

    // Wires:
    const wm = this.context.activeContext?.wires;
    wm && createComponent('Wire Model', wm.getStatistics());

    // CM:
    const cm = this.context.activeContext?.cm;
    cm && createComponent('Cylinder Model', cm.getStatistics());

    // NM:
    const nm = this.context.activeContext?.nm;
    nm && createComponent('Nucleotide Model', nm.getStatistics());

    // Selection:
    const selection = this.context.editor.activeModel?.selection;
    if (selection && this.context.editor.activeModel?.isVisible) {
      createComponent('Selection', { N: selection.size });
    }

    // Scale
    this.updateScale();
  }

  updateSelectors() {
    if ($('#ui-system-dialog')[0].hidden) return;

    const container = $('#ui-system');
    container.html('');

    const n_cols = 4;
    const grid = $('<div>', { class: 'grid' });
    container.append(grid);
    const row = $('<div>', { class: 'row' });
    grid.append(row);
    const lists = Array.from({ length: n_cols }, () => {
      const cell = $('<div>', { class: 'cell-' + Math.floor(12 / n_cols) });
      const list = $('<ul>', { style: 'list-style-type: none;' });

      row.append(cell);
      cell.append(list);

      return list;
    });

    const nm = this.context.activeContext?.nm;
    if (nm) {
      for (let i = 0; i < nm.strands.length; i++) {
        const s = nm.strands[i];
        const list = lists[i % n_cols];

        const strandContainer = $('<li>');

        const strandID = $(
          `<a href="javascript: void(0)"> Strand ${s.id} </a>`,
          { style: s.isScaffold ? 'color: red;' : '' },
        );
        const p5Button = $(`<a href="javascript: void(0)">5'</a>`);
        const p3Button = $(`<a href="javascript: void(0)">3'</a>`);

        p5Button.on('click', () => {
          const p5 = s.nucleotides[0];
          this.context.focusCamera(p5.getPosition());
          this.context.editor.select(p5);
        });

        p3Button.on('click', () => {
          const p3 = s.nucleotides[s.nucleotides.length - 1];
          this.context.focusCamera(p3.getPosition());
          this.context.editor.select(p3);
        });

        strandID.on('click', () => {
          const p5 = s.nucleotides[0];
          this.context.focusCamera(p5.getPosition());
          this.context.editor.deselectAll();
          for (const n of s.nucleotides) this.context.editor.select(n, true);
        });

        strandContainer.append(p5Button);
        strandContainer.append(strandID);
        strandContainer.append(p3Button);
        list.append(strandContainer);
      }
    }
  }

  updateArcDiagram() {
    const arcCanvas = $('#ui-arcs');
    if ($('#ui-arcs-dialog')[0].hidden) return;

    const ctx = arcCanvas[0].getContext('2d');

    // Setup Canvas -------------
    const nucs = this.context.activeContext?.nm?.getNucleotides();
    const strands = this.context.activeContext?.nm?.getStrands();
    if (!nucs) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, arcCanvas[0].width, arcCanvas[0].height);
      ctx.restore();
      return;
    }
    let maxDist = 0;
    for (const n of nucs)
      if (n.pair) maxDist = Math.max(maxDist, n.pair.id - n.id);

    const SCALE = Math.min(8, (0.75 * screen.width) / nucs.length);
    const floor = 20;
    const width = nucs.length * SCALE;
    const height = (maxDist / 2) * SCALE + floor;
    const tickHeight = 5;
    const tickWidth = 5;
    const tickInterval = Math.ceil(Math.floor(nucs.length / 20) / 20) * 20;

    arcCanvas.attr('width', width);
    arcCanvas.attr('height', height);

    // --------------------------
    // Colour Functions ---------
    let colourSegments: THREE.Color[];
    let colourFunction: (n: Nucleotide) => void;
    const colour = new THREE.Color(0xffffff);

    const setStrokeColour = (
      r: number,
      g: number,
      b: number,
      a: number = 0.9,
    ) => {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    const lerpColours = (idx: number, max: number) => {
      const colorID = Math.floor((idx / max) * (colourSegments.length - 1));
      const theta = (idx / max) * (colourSegments.length - 1) - colorID;

      colour.lerpColors(
        colourSegments[colorID],
        colourSegments[colorID + 1],
        theta,
      );

      return colour;
    };

    const setRandomStrandColour = (n: Nucleotide) => {
      if (n.id == 0 || n.prev?.id != n.pair?.next?.pair?.id) {
        setStrokeColour(
          Math.floor(Math.random() * 255),
          Math.floor(Math.random() * 255),
          Math.floor(Math.random() * 255),
        );
      }
    };

    const setRandomNucleotidecolour = () => {
      setStrokeColour(
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
      );
    };

    let setWireColour = (n: Nucleotide) => {
      colourSegments = Object.keys(ColourScheme.WiresColours).map(
        (k: keyof typeof ColourScheme.WiresColours) =>
          ColourScheme.WiresColours[k],
      );
      if (colourSegments.length < 2) colourSegments.push(colourSegments[0]);
      setWireColour = (n: Nucleotide) => {
        const idx = n.id;
        const max = nucs.length;
        const colour = lerpColours(idx, max);

        setStrokeColour(
          Math.floor(colour.r * 255),
          Math.floor(colour.g * 255),
          Math.floor(colour.b * 255),
        );
      };
      setWireColour(n);
    };

    const setNucleotideColour = (n: Nucleotide) => {
      const colour = ColourScheme.NucleotideColours[n.base];
      setStrokeColour(
        Math.floor(colour.r * 255),
        Math.floor(colour.g * 255),
        Math.floor(colour.b * 255),
      );
    };

    const setStrandColour = (n: Nucleotide) => {
      const strandColours = Object.values(ColourScheme.StrandColours);
      const colour = strandColours[n.pair.strand.id % strandColours.length];

      setStrokeColour(
        Math.floor(colour.r * 255),
        Math.floor(colour.g * 255),
        Math.floor(colour.b * 255),
      );
    };

    const selectorVal = $('#ui-arcs-colours')[0].value;
    if (selectorVal == 'wires') colourFunction = setWireColour;
    else if (selectorVal == 'nucleotides') colourFunction = setNucleotideColour;
    else if (selectorVal == 'strands') colourFunction = setStrandColour;
    else if (selectorVal == 'random_nucleotides')
      colourFunction = setRandomNucleotidecolour;
    else if (selectorVal == 'random_strands')
      colourFunction = setRandomStrandColour;

    // --------------------------
    // Draw Arcs  ---------------
    for (const s of strands) {
      for (const n of s.getNucleotides()) {
        const p1 = n.id * SCALE;

        if (n.id % tickInterval == 1) {
          const prevStroke = ctx.strokeStyle;
          ctx.beginPath();
          ctx.strokeStyle = '#000000';
          ctx.moveTo(p1, height - floor * 0.5 + tickHeight);
          ctx.lineTo(p1, height - floor * 0.5 - tickHeight);
          ctx.fillText(n.id - 1, p1 + tickWidth, height - tickHeight);
          ctx.stroke();
          ctx.strokeStyle = prevStroke;
        }

        if (n.pair) {
          colourFunction(n);

          const p2 = n.pair.id * SCALE;
          if (p1 >= p2) continue;

          ctx.beginPath();
          ctx.arc(
            (p2 + p1) / 2,
            height - floor,
            (p2 - p1) / 2,
            Math.PI,
            2 * Math.PI,
          );
          ctx.stroke();
        }
      }
    }

    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.moveTo(0, height - floor + ctx.lineWidth);
    ctx.lineTo(width, height - floor + ctx.lineWidth);
    ctx.stroke();
  }

  /**
   * Add all visible objects to the scene and remove all invisible ones.
   */
  generateVisible() {
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

    this.context.rendererNeedsUpdate = true;
  }

  /**
   * Connects the HTML elements associated with this object to its functions and adds their event listeners.
   */
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
      this.generateVisible();
    });

    this.showAmbLightButton.on('click', () => {
      this.generateVisible();
    });

    this.showFogButton.on('click', () => {
      this.generateVisible();
    });

    this.showAxesButton.on('click', () => {
      this.generateVisible();
    });

    this.showGridButton.on('click', () => {
      this.generateVisible();
    });

    this.solidButton.on('click', () => {
      this.generateVisible();
    });

    this.wiresButton.on('click', () => {
      this.generateVisible();
    });

    this.boundingBoxButton.on('click', () => {
      this.generateVisible();
    });

    this.showScaleButton.on('click', () => {
      this.generateVisible();
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
      this.generateVisible();
    });

    $('#toggle-cylinder-tension-overlay').on('click', () => {
      GLOBALS.overlayTension = $('#toggle-cylinder-tension-overlay')[0].checked;
      this.context.editor.UpdateObjectVisuals();
    });

    $('#toggle-cylinder-torque-overlay').on('click', () => {
      GLOBALS.overlayTorque = $('#toggle-cylinder-torque-overlay')[0].checked;
      this.context.editor.UpdateObjectVisuals();
    });

    $('#selection-mode').on('click', (e: any) => {
      GLOBALS.selectionMode = $('#selection-mode')
        .find('.active')
        .attr('data-id');
    });

    $('#toggle-nucleotides-backbone').on('click', () => {
      GLOBALS.visibilityNucBackbone = $(
        '#toggle-nucleotides-backbone',
      )[0].checked;
      this.context.editor.UpdateObjectVisuals();
    });

    $('#toggle-nucleotides-bases').on('click', () => {
      GLOBALS.visibilityNucBase = $('#toggle-nucleotides-bases')[0].checked;
      this.context.editor.UpdateObjectVisuals();
    });

    this.hoverButton.on('click', (e: Event) => {
      e.stopPropagation();
      this.context.controls.hover = this.hoverButton[0].checked;
    });

    $('#ui-colours-save').on('click', () => {
      try {
        downloadTXT('colour-scheme.json', JSON.stringify(ColourScheme));
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#ui-colours-load-button').on('click', () => {
      try {
        const file = (<HTMLInputElement>$('#ui-colours-load-input')[0])
          .files[0];
        read_json(URL.createObjectURL(file), (json: typeof ColourScheme) => {
          this.loadColourScheme(json);
        });
      } catch (error) {
        this.context.addMessage(error, 'alert');
        throw error;
      }
    });

    $('#ui-system-button').on('click', () => {
      this.context.uiNeedsUpdate = true;
    });

    $('#nucleotide-display').on('click', (e: any) => {
      GLOBALS.nucleotideDisplay = $('#nucleotide-display')
        .find('.active')
        .attr('data-id');
      this.context.editor.updateAllObjects();
    });

    $('#ui-arcs-colours').on('change', () => {
      this.updateArcDiagram();
    });
  }
}
