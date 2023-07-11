import * as THREE from 'three';
import { Graph } from '../models/graph_model';
import { FileLoader, Loader, Vector3 } from 'three';

const _face_vertex_data_separator_pattern = /\s+/;

export class OBJLoader extends Loader {
  constructor(manager: THREE.LoadingManager) {
    super(manager);
  }

  load(
    url: string,
    onLoad: (g: Graph) => void,
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

  parse(text: string) {
    const vertices = [];
    const normals = [];
    const edges = []; // implicit edges based on faces
    const edgesE = []; // explicit edges
    const faces = [];

    if (text.indexOf('\r\n') !== -1) {
      text = text.replace(/\r\n/g, '\n');
    }
    if (text.indexOf('\\\n') !== -1) {
      text = text.replace(/\\\n/g, '');
    }
    const lines = text.split('\n');

    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i].trimStart();

      if (line.length === 0) continue;

      const lineFirstChar = line.charAt(0);
      if (lineFirstChar === 'v') {
        const data = line.split(_face_vertex_data_separator_pattern);
        switch (data[0]) {
          case 'v':
            vertices.push(
              new THREE.Vector3(
                parseFloat(data[1]),
                parseFloat(data[2]),
                parseFloat(data[3]),
              ),
            );
            break;
          case 'vn':
            normals.push(
              new THREE.Vector3(
                parseFloat(data[1]),
                parseFloat(data[2]),
                parseFloat(data[3]),
              ).normalize(),
            );
            break;
          case 'vt':
            //uvs
            break;
        }
      } else if (lineFirstChar === 'f') {
        const lineData = line.slice(1).trim();
        const vertexData = lineData.split(_face_vertex_data_separator_pattern);
        const faceVertices = [];

        for (let j = 0, jl = vertexData.length; j < jl; j++) {
          const vertex = parseInt(vertexData[j].split('/')[0]);
          faceVertices.push(vertex);
        }

        for (let j = 0, jl = faceVertices.length; j < jl; j++) {
          const v1 = faceVertices[j];
          const v2 = j + 1 < jl ? faceVertices[j + 1] : faceVertices[0];
          edges.push(v1, v2);
        }
        edges.push(faceVertices[0], faceVertices[faceVertices.length - 1]);

        faces.push(faceVertices);
      } else if (lineFirstChar === 'l') {
        const lineData = line.slice(1).trim();
        const vertexData = lineData.split(_face_vertex_data_separator_pattern);
        let v1 = parseInt(vertexData[0]);
        for (let j = 1; j < vertexData.length; j++) {
          const v2 = parseInt(vertexData[j]);
          edgesE.push(v1, v2);
          v1 = v2;
        }
      } else if (lineFirstChar === 'p') {
        //TODO: points
      }
    }
    // find bounding box size and center of mass
    const min = new Vector3();
    const max = new Vector3();
    for (const v of vertices) {
      min.x = Math.min(min.x, v.x);
      min.y = Math.min(min.y, v.y);
      min.z = Math.min(min.z, v.z);
      max.x = Math.max(max.x, v.x);
      max.y = Math.max(max.y, v.y);
      max.z = Math.max(max.z, v.z);
    }
    const scale = 10 / Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
    const com = max.add(min).multiplyScalar(0.5);
    com.y = min.y; // keep the model above the floor height. It looks better that way.

    const graph = new Graph();
    const gVertices = [];

    const visited_edges = new Set(); // avoid double counting edges
    for (let i = 0; i < vertices.length; i++) {
      const v = graph.addVertex(
        vertices[i].sub(com).multiplyScalar(scale),
        normals[i],
      );
      gVertices.push(v);
    }
    //implicit edges:
    for (let i = 0; i < edges.length; i += 2) {
      const v1 = gVertices[edges[i] - 1];
      const v2 = gVertices[edges[i + 1] - 1];
      if (visited_edges.has([v1.id, v2.id].toString())) continue;
      graph.addEdge(v1, v2);
      visited_edges.add([v1.id, v2.id].toString());
      visited_edges.add([v2.id, v1.id].toString());
    }
    for (let i = 0; i < faces.length; i++) {
      const fVerts = [];
      const fEdges = [];
      for (let j = 0; j < faces[i].length; j++) {
        const v = gVertices[faces[i][j] - 1];
        fVerts.push(v);
      }
      for (let j = 0; j < fVerts.length; j++) {
        const v1 = fVerts[j];
        const v2 = j == fVerts.length - 1 ? fVerts[0] : fVerts[j + 1];
        const e = v1.getCommonEdges(v2)[0];
        fEdges.push(e);
      }
      graph.addFace(fEdges);
    }
    graph.calculateNormalsOutside();

    //explicit edges: These can define a multigraph
    for (let i = 0; i < edgesE.length; i += 2) {
      const v1 = gVertices[edgesE[i] - 1];
      const v2 = gVertices[edgesE[i + 1] - 1];
      const t = v1.getCommonEdges(v2)[0];
      if (t) graph.splitEdge(t);
      else graph.addEdge(v1, v2);
    }

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
    },
  );
}
