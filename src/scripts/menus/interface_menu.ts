import * as THREE from 'three';
import { OrthographicCamera, Vector3 } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLOBALS } from '../globals/globals';
import { Context } from './context';
import { Menu, MenuParameters } from './menu';
import { ColourScheme, ColourSchemePresets } from '../models/colour_schemes';
import { downloadTXT } from '../io/download';
import { read_json } from '../io/read_json';

const meshMaterial = new THREE.MeshBasicMaterial({
  color: 0x9999ff,
  transparent: true,
  opacity: 0.1,
  depthWrite: false,
});

const GRID_SIZE = 14;
const BOUNDING_BOX_SCALE = 10;

const fog = new THREE.FogExp2(0xffffff, 0.1);

interface CSSOBject {
  object: THREE.Object3D;
  divs: HTMLElement[];
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
    }
    this.scene.add(this.axes.object);
  }

  /**
   * Remove the XYZ-axes from the scene.
   */
  removeAxes() {
    if (!this.axes) return;
    this.scene.remove(this.axes.object);
    for (const d of this.axes.divs) d.remove();
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
            ...(<any>v3.coords),
          );
        } else {
          vertices.push(
            ...(<any>v1.coords),
            ...(<any>v3.coords),
            ...(<any>v2.coords),
          );
        }
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
    }
    this.scene.add(this.grid);
  }

  /**
   * Removes the the grid from the 3d scene.
   */
  removeGrid() {
    this.scene.remove(this.grid);
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
    this.context.activeContext?.updateVisuals();
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
      this.context.activeContext?.updateVisuals();
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
          this.context.activeContext?.updateVisuals();
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

            this.createColoursSwatches();
            this.context.activeContext?.updateVisuals();
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
          this.context.activeContext?.updateVisuals();
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
      this.context.activeContext?.updateVisuals();
    });

    $('#toggle-cylinder-torque-overlay').on('click', () => {
      GLOBALS.overlayTorque = $('#toggle-cylinder-torque-overlay')[0].checked;
      this.context.activeContext?.updateVisuals();
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
      this.context.activeContext?.updateVisuals();
    });

    $('#toggle-nucleotides-bases').on('click', () => {
      GLOBALS.visibilityNucBase = $('#toggle-nucleotides-bases')[0].checked;
      this.context.activeContext?.updateVisuals();
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
  }
}
