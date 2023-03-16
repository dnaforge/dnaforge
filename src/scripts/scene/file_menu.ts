import * as THREE from 'three';
import { read_obj } from '../io/read_obj';
import { OBJLoader } from '../io/read_obj';
import { Graph } from '../models/graph';
import { Context } from './context';
import { Menu } from './menu';

const examples = (() => {
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

    $('#file-input-example').append(`
            <li data-icon="<span class='mif-file-empty'>" 
            data-caption="${name}"  
            data-id="${id}" 
            data-content="<span class='text-muted'>
            ${nVerts} Vertices - 
            ${nEdges} Edges - 
            ${nFaces} Faces
            </span>"></li>`);
  }

  return examples;
})();

export class FileMenu extends Menu {
  fileInputButton: any;
  fileInputExampleButton: any;
  fileInput: any;

  constructor(context: Context) {
    super(context, 'file', 'File', true);
  }

  handleHotKey(key: string) {
    switch (key) {
      case 'asdf':
        return true;

      default:
        return false;
    }
  }

  regenerateVisible() {
    return;
  }

  readFiles(files: FileList) {
    const file = files[0]; // assuming just one file
    if (file.name.endsWith('.obj')) {
      read_obj(URL.createObjectURL(file), (graph: Graph) => {
        this.context.setGraph(graph);
      });
      return;
    }
    this.context.addMessage('Unrecognised file format.', '');
  }

  setupEventListeners() {
    this.fileInputButton = $('#file-input-open');
    this.fileInputExampleButton = $('#file-input-example-open');
    this.fileInput = $('#file-input');

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
