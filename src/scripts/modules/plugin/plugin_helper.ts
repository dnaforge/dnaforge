import { ModuleMenu } from '../../menus/module_menu';
import { Context } from '../../menus/context';
import { editOp } from '../../editor/editOPs';
import { CylinderModel } from '../../models/cylinder_model';
import {
  Cylinder,
  CylinderBundle,
  PrimePos,
  RoutingStrategy,
} from '../../models/cylinder';
import { NucleotideModel } from '../../models/nucleotide_model';
import { Graph, Edge, HalfEdge, Vertex, Face } from '../../models/graph_model';
import { setPrimaryFromScaffold } from '../../utils/primary_utils';
import { Nucleotide } from '../../models/nucleotide';
import { Strand } from '../../models/strand';
import { WiresModel } from '../../models/wires_model';
import { Selectable } from '../../models/selectable';
import * as THREE from 'three';
import { PrimaryGenerator } from '../../utils/primary_generator';
import {
  getNP,
  setRandomPrimary,
  setPartialPrimaryRNA,
} from '../../utils/primary_utils';
import {
  xtrnaParameters,
  getVertexRotations,
  augmentRotations,
} from '../shared/xtrna_routing';
import { downloadTXT } from '../../io/download';

/**
 * This contains all the external functions and classes a plugin can use. (If updated, update the plugin
 * template's custom.d.ts).
 */
export const pluginHelper = {
  editOp,
  CylinderModel,
  Cylinder,
  CylinderBundle,
  PrimePos,
  RoutingStrategy,
  NucleotideModel,
  Graph,
  Edge,
  HalfEdge,
  Vertex,
  Face,
  setPrimaryFromScaffold,
  Nucleotide,
  Strand,
  WiresModel,
  Selectable,
  ModuleMenu,
  Context,
  THREE,
  PrimaryGenerator,
  getNP,
  setRandomPrimary,
  setPartialPrimaryRNA,
  xtrnaParameters,
  getVertexRotations,
  augmentRotations,
  downloadTXT,
};
