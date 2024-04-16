import { SelectionModes } from '../editor/editor';
import { NucleotideDisplay } from '../models/nucleotide_model';

interface GlobalParams {
  visibilityNucBackbone: boolean;
  visibilityNucBase: boolean;
  overlayTorque: boolean;
  overlayTension: boolean;
  selectionMode: SelectionModes;
  nucleotideDisplay: NucleotideDisplay;
}

export const GLOBALS: GlobalParams = {
  visibilityNucBackbone: true,
  visibilityNucBase: true,
  overlayTorque: false,
  overlayTension: false,
  selectionMode: 'connected',
  nucleotideDisplay: 'stick',
};
