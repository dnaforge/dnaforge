import * as THREE from 'three';
import { Graph } from '../models/graph';
import { FileLoader, Loader, Vector3 } from 'three';

//TODO

export class OBJLoader extends Loader {
  constructor(manager: THREE.LoadingManager) {
    super(manager);
  }

  load(
    url: string,
    onLoad: (g: Graph) => void,
    onProgress: (e: Event) => void,
    onError: (e: Event) => void
  ) {
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (text) => {
        onLoad(this.parse(<string>text));
      },
      onProgress,
      onError
    );
  }

  parse(text: string) {
    const graph = new Graph();
    graph.calculateNormalsOutside();
    return graph;
  }
}

export function read_obj(path: string, callback: (g: Graph) => void) {
  const manager = new THREE.LoadingManager();
  const loader = new OBJLoader(manager);
  loader.load(
    path,
    function (obj) {
      callback(obj);
    },
    undefined,
    function (error) {
      console.error(error);
    }
  );
}
