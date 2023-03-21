var assert = require('assert');
import * as _ from 'lodash';
import * as THREE from 'three';
import { OBJLoader } from '../../io/read_obj';
import { CylinderModel } from '../../models/cylinder_model';
import { Edge, Graph, HalfEdge } from '../../models/graph';
import { NucleotideModel } from '../../models/nucleotide_model';
import { WiresModel } from '../../models/wires_model';
import { MenuParameters } from '../../scene/menu';
import { cylindersToNucleotides, Sterna, wiresToCylinders } from './sterna';

describe('Spanning tree-routing', function () {
  const tet = require('../../../test/test_shapes/tetra_dubs.obj');
  const x3 = require('../../../test/test_shapes/3x3.obj');
  const plane = require('../../../test/test_shapes/plane.obj');

  const graphs = [
    ['tetrahedron', tet],
    ['3x3', x3],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });

  let sterna: Sterna;
  let graph: Graph;
  let trail: Edge[];

  graphs.forEach(function (g: [string, Graph]) {
    it(`Should start where it ends: ${g[0]}`, function () {
      graph = g[1];
      sterna = new Sterna(graph);
      trail = sterna.trail;

      const first = trail[0];
      const last = trail[trail.length - 1];

      assert.equal(!!first.getCommonVertex(last), true);
    });
  });
});

/*
describe('Atrail Cylinder Model', function () {
  const tet = require('../../../test/test_shapes/tetra_dubs.obj');
  const x4 = require('../../../test/test_shapes/4x4.obj');
  const plane = require('../../../test/test_shapes/plane.obj');

  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const atrails = graphs.map((g) => {
    const atrail = new ATrail(g[1]);
    atrail.findATrail();
    return [g[0], atrail];
  });

  let cm: CylinderModel;

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Should throw error because of small scale: ${g[0]}`, function () {
      const params = {
        scale: 100,
      };
      try {
        cm = wiresToCylinders(g[1], params);
        assert.equal(false, true);
      } catch { }
    });

    it(`All cylinders should be fully connected: ${g[0]}`, function () {
      const params = {
        scale: 0.1,
      };
      cm = wiresToCylinders(g[1], params);

      for (let c of cm.cylinders) {
        for (let n of _.values(c.neighbours)) {
          assert.equal(!!n, true);
        }
      }
    });

    it(`All primes should be 1-to-1 connected: ${g[0]}`, function () {
      const params = {
        scale: 0.1,
      };
      cm = wiresToCylinders(g[1], params);

      for (let c of cm.cylinders) {
        for (let prime of _.keys(c.neighbours)) {
          const n = c.neighbours[prime];
          const prime2 = n[1];

          assert.equal(n[0].neighbours[prime2][0] == c, true);
        }
      }
    });
  });
});

describe('Atrail Nucleotide Model', function () {
  const tet = require('../../../test/test_shapes/tetra_dubs.obj');
  const x4 = require('../../../test/test_shapes/4x4.obj');
  const plane = require('../../../test/test_shapes/plane.obj');

  const graphs = [
    ['tetrahedron', tet],
    ['4x4', x4],
    ['plane', plane],
  ].map((g) => {
    return [g[0], new OBJLoader(new THREE.LoadingManager()).parse(g[1])];
  });
  const atrails = graphs.map((g) => {
    const atrail = new ATrail(g[1]);
    atrail.findATrail();
    return [g[0], atrail];
  });

  let cm: CylinderModel;
  let nm: NucleotideModel;

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Should generate nucleotides: ${g[0]}`, function () {
      const params = {
        scale: 0.5,
        scaffoldName: 'none',
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      assert.equal(nm.getNucleotides().length > 0, true);
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Min strand overlap should be above 5: ${g[0]}`, function () {
      const params = {
        scale: 0.2,
        scaffoldName: 'none',
        addNicks: true,
        minStrandLength: 5,
        maxStrandLength: 100,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      const scaffold = nm.getScaffold().nucleotides;
      let overlap = 0;
      for (let i = 0; i < scaffold.length; i++) {
        const nuc = scaffold[i];
        const pair = nuc.pair;
        if (!pair) {
          overlap = 0;
          continue;
        }
        if (!pair.next) {
          assert.equal(overlap >= 5, true);
          overlap = 0;
        }
        overlap++;
      }
    });
  });

  atrails.forEach(function (g: [string, ATrail]) {
    it(`Max strand length should be under 100: ${g[0]}`, function () {
      const params = {
        scale: 0.2,
        scaffoldName: 'none',
        addNicks: true,
        minStrandLength: 5,
        maxStrandLength: 100,
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      for (let s of nm.strands) {
        if (s.isScaffold) continue;
        assert.equal(s.nucleotides.length <= 100, true);
      }
    });
  });



  atrails.forEach(function (g: [string, ATrail]) {
    it(`Primary structure should be complementary: ${g[0]}`, function () {
      const params: MenuParameters = {
        scale: 0.2,
        scaffoldName: 'random',
      };
      cm = wiresToCylinders(g[1], params);
      nm = cylindersToNucleotides(cm, params);

      

      const complement: Record<string, string> = {A: "T", T: "A", G: "C", C: "G"}


      for (let s of nm.strands) {
        for(let n of s.nucleotides){
          if(!n.pair) continue;
          assert.equal(complement[n.base] == n.pair.base, true);
        }
      }
    });
  });

});
*/
