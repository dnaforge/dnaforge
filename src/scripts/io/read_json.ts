import * as THREE from 'three';
import { FileLoader, Loader } from 'three';

export class JSONLoader extends Loader {
  constructor(manager: THREE.LoadingManager) {
    super(manager);
  }

  load(
    url: string,
    onLoad: (json: JSONObject) => void,
    onProgress: (e: Event) => void,
    onError: (e: Event) => void,
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
      onError,
    );
  }

  parse(json: string) {
    return JSON.parse(json);
  }
}

export function read_json(path: string, callback: (json: JSONObject) => void) {
  const manager = new THREE.LoadingManager();
  const loader = new JSONLoader(manager);
  loader.load(
    path,
    function (json) {
      callback(json);
    },
    undefined,
    function (error) {
      console.error(error);
    },
  );
}
