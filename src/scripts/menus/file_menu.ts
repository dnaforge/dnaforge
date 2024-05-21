import * as THREE from 'three';
import { downloadTXT } from '../io/download';
import { read_json } from '../io/read_json';
import { read_obj } from '../io/read_obj';
import { OBJLoader } from '../io/read_obj';
import { Graph } from '../models/graph_model';
import { ModuleMenu } from './module_menu';
import { Context } from './context';
import { Menu } from './menu';

/**
 * Loads all the example obj-files, converts them to graphs and creates their HTML menu items.
 *
 * @returns examples dictionary mapping the menu item ids to the graphs
 */
const examples = ((): { [id: string]: Graph } => {
  const objs = require.context('../../examples', false, /\.(obj)$/);
  const examples: { [id: string]: Graph } = {};
  for (const k of objs.keys()) {
    const obj = objs(k);
    const graph = new OBJLoader(new THREE.LoadingManager()).parse(obj);
    const name = k.slice(2, k.length - 4);
    const id = k.slice(2, k.length - 4);
    const nVerts = graph.getVertices().length;
    const nEdges = graph.getEdges().length;
    const nFaces = graph.getFaces().length;
    examples[id] = graph;

    const example = $(`
    <li data-icon="<span class='mif-file-empty'>" 
    data-caption="${name}"  
    data-id="${id}" 
    data-content="<span class='text-muted'>
    ${nVerts} Vertices - 
    ${nEdges} Edges - 
    ${nFaces} Faces
    </span>"
    </li>`);

    example.on('dblclick', () => {
      $('#file-input-example-open').click();
    });

    const downloadButton = $('<button>', {
      class: 'button cycle mif-2x mif-download outline primary sim-download',
      'data-role': 'hint',
      'data-hint-text': `Download ${name}.obj.`,
      'data-hint-position': 'right',
      style: 'width: 3rem;', // the aspect ratio is skewed with default width for some reason
    });

    downloadButton.on('click', () => {
      console.log(obj);
      downloadTXT(`${name}.obj`, obj);
    });

    example.append(downloadButton);
    $('#file-input-example').append(example);
  }

  return examples;
})();

/**
 * File tab.
 */
export class FileMenu extends Menu {
  fileInputButton: any;
  fileInputExampleButton: any;
  fileInput: any;
  openJSONDialogButton: any;
  downloadJSONButton: any;

  private createdJSONMenu = false;

  constructor(context: Context) {
    super(context, 'file', 'File', true);
  }

  toJSON(): JSONObject {
    return {};
  }

  loadJSON(json: JSONObject) {
    return;
  }

  registerHotkeys() {}

  generateVisible() {
    return;
  }

  /**
   * Reads the input files and calls the appropriate readers to handle them.
   *
   * @param files input files
   * @returns
   */
  readFiles(files: FileList) {
    const file = files[0]; // assuming just one file
    if (file.name.endsWith('.obj')) {
      read_obj(URL.createObjectURL(file), (graph: Graph) => {
        this.context.setGraph(graph);
      });
    } else if (file.name.endsWith('.json')) {
      read_json(URL.createObjectURL(file), (json: JSONObject) => {
        this.context.loadJSON(json);
      });
    } else {
      this.context.addMessage('Unrecognised file format.', '');
    }
  }

  downloadJSON() {
    try {
      const selection: Record<string, Record<string, boolean>> = {};
      const inputs = $('#file-json-treeview').find(':checked');
      for (let i = 0; i < inputs.length; i++) {
        const input = $(inputs[i]);
        const data: string = input.attr('data-id');
        const [dType, menu] = data.split('_');
        if (!selection[menu]) selection[menu] = {};
        selection[menu][dType] = true;
      }
      const str = JSON.stringify(this.context.toJSON(selection));
      downloadTXT(`dnaforge.json`, str);
    } catch (error) {
      throw `Error downloading JSON.`;
    }
  }

  createJSONMenu() {
    //TODO: delegate this to each menu separately
    const content = $('<ul>', {
      'data-role': 'treeview',
      id: 'file-json-treeview',
    });

    const menuUl = (menu: ModuleMenu) => {
      const li = $('<li>', {
        'data-caption': menu.title,
      });
      const ul = $('<ul>');
      li.append(ul);

      const input = (title: string, id: string) => {
        const li2 = $('<li>');
        const input = $('<input>', {
          type: 'checkbox',
          'data-role': 'checkbox',
          'data-caption': title,
          'data-id': id,
          checked: true,
        });
        li2.append(input);
        return li2;
      };

      ul.append(input('Parameters', `params_${menu.elementId}`));
      menu.wires && ul.append(input('Wires Model', `wires_${menu.elementId}`));
      menu.cm && ul.append(input('Cylinder Model', `cm_${menu.elementId}`));
      menu.nm && ul.append(input('Nucleotide Model', `nm_${menu.elementId}`));

      return li;
    };

    for (const menu of this.context.menus.values()) {
      if (!(menu instanceof ModuleMenu)) continue;
      content.append(menuUl(menu));
    }

    $('#file-json-dialog').children('.dialog-content').html(content);
  }

  /**
   * Connects the HTML elements associated with this object to its functions and adds their event listeners.
   */
  setupEventListeners() {
    this.fileInputButton = $('#file-input-open');
    this.fileInputExampleButton = $('#file-input-example-open');
    this.fileInput = $('#file-input');
    this.downloadJSONButton = $(`#file-download-json`);
    this.openJSONDialogButton = $(`#file-open-json-dialog`);

    this.openJSONDialogButton.on('click', () => {
      this.createJSONMenu();
      Metro.dialog.open('#file-json-dialog');
    });

    this.downloadJSONButton.on('click', () => {
      try {
        this.downloadJSON();
      } catch (error) {
        this.context.addMessage(error, 'alert');
      }
    });

    this.fileInputButton.on('click', () => {
      const files = (<HTMLInputElement>this.fileInput[0]).files;
      this.readFiles(files);
    });

    this.fileInputExampleButton.on('click', () => {
      //listview.getSelected doesn't return anything for some reason, so just find the selection like this:
      const id = $('#file-input-example').children('.current').attr('data-id');
      this.context.setGraph(examples[id]);
    });

    $('#canvas').on('dragover', (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      (e as unknown as DragEvent).dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    });

    $('#canvas').on('drop', (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const files = (e as unknown as DragEvent).dataTransfer.files;
      this.readFiles(files);
    });
  }
}
