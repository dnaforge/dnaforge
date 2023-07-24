import { SelectionModes } from "../editor/editor";

interface GlobalParams{
  visibilityNucBackbone: boolean,
  visibilityNucBase: boolean,
  overlayTorque: boolean,
  overlayTension: boolean,
  selectionMode: SelectionModes,
}

export const GLOBALS: GlobalParams = {
  visibilityNucBackbone: true,
  visibilityNucBase: true,
  overlayTorque: false,
  overlayTension: false,
  selectionMode: 'connected',
};
