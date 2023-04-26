const assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../io/read_obj';
import { Graph, HalfEdge } from './graph';


describe('Atrail-routing', function () {
  const x3 = require('../../../test/test_shapes/3x3.obj');
  const graphs: Graph[] = [];

  let graph: Graph;
  let trail: HalfEdge[];

  beforeEach(function namedFun() {});

  graphs.forEach(function (g: Graph) {
    it(`Should be directed: ${g}`, function () {
    });
  });
});
