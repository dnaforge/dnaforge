const assert = require('assert');
import * as THREE from 'three';
import { OBJLoader } from '../io/read_obj';
import { Graph } from './graph_model';
const tet = require('../../test/test_shapes/tetra.obj');
const x3 = require('../../test/test_shapes/3x3.obj');
const plane = require('../../test/test_shapes/plane.obj');

describe('Graph - tetrahedron', function () {
  const graph = new OBJLoader(new THREE.LoadingManager()).parse(tet);

  it(`Should have 4 vertices`, function () {
    assert.equal(graph.getVertices().length == 4, true);
  });

  it(`Should have 6 edges`, function () {
    assert.equal(graph.getEdges().length == 6, true);
  });

  it(`Should have 4 faces`, function () {
    assert.equal(graph.getFaces().length == 4, true);
  });

  it(`1st vertex should be paired to 2nd vertex`, function () {
    const v0 = graph.getVertices()[0];
    const v1 = graph.getVertices()[1];
    const ce = v0.getCommonEdges(v1);
    assert.equal(ce.length == 1, true);
  });
});

describe('Graph - 3x3', function () {
  const graph = new OBJLoader(new THREE.LoadingManager()).parse(x3);

  it(`Should have 27 vertices`, function () {
    assert.equal(graph.vertices.length == 27, true);
  });

  it(`Should have 54 edges`, function () {
    assert.equal(graph.edges.length == 54, true);
  });

  it(`Should have 0 faces`, function () {
    assert.equal(graph.faces.length == 0, true);
  });

  it(`1st vertex should be paired to 10th vertex`, function () {
    const v0 = graph.getVertices()[0];
    const v1 = graph.getVertices()[9];
    const ce = v0.getCommonEdges(v1);
    assert.equal(ce.length == 1, true);
  });

  it(`1st vertex should not be paired to 20th vertex`, function () {
    const v0 = graph.getVertices()[0];
    const v1 = graph.getVertices()[19];
    const ce = v0.getCommonEdges(v1);
    assert.equal(ce.length == 0, true);
  });
});

describe('Graph - edge splits', function () {
  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let graph: Graph;

  graphs.forEach(function (g: [string, Graph]) {
    it(`Edge count should double: ${g[0]}`, function () {
      graph = g[1].clone();

      for (const e of graph.getEdges()) graph.splitEdge(e);

      assert.equal(g[1].getEdges().length * 2 == graph.getEdges().length, true);
    });
  });

  graphs.forEach(function (g: [string, Graph]) {
    it(`Face count should increase by |E|: ${g[0]}`, function () {
      graph = g[1].clone();

      for (const e of graph.getEdges()) graph.splitEdge(e);

      assert.equal(
        g[1].getFaces().length + g[1].getEdges().length ==
          graph.getFaces().length,
        true
      );
    });
  });

  graphs.forEach(function (g: [string, Graph]) {
    it(`Edge count should quadruple: ${g[0]}`, function () {
      graph = g[1].clone();

      for (const e of graph.getEdges()) graph.splitEdge(e);
      for (const e of graph.getEdges()) graph.splitEdge(e);

      assert.equal(g[1].getEdges().length * 4 == graph.getEdges().length, true);
    });
  });

  graphs.forEach(function (g: [string, Graph]) {
    it(`Vertex count should remain the same: ${g[0]}`, function () {
      graph = g[1].clone();

      for (const e of graph.getEdges()) graph.splitEdge(e);

      assert.equal(
        g[1].getVertices().length == graph.getVertices().length,
        true
      );
    });
  });
});
