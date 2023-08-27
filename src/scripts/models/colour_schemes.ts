import { Color } from 'three';
import { SelectionStatus } from './selectable';

const NucleotideColours: Record<string, Color> = {
  // Base colors
  A: new Color(0xff8eaf), // Light Pink (Adenine)
  U: new Color(0xffd133), // Light Gold (Uracil)
  T: new Color(0xffd133), // Light Gold (Thymine)
  G: new Color(0x7acc7a), // Light Green (Guanine)
  C: new Color(0x6688aa), // Light Blue (Cytosine)

  W: new Color(0xffd166), // Light Yellow (Adenine or Thymine)
  S: new Color(0x99cc99), // Light Mint Green (Guanine or Cytosine)
  M: new Color(0xff99cc), // Light Purple (Adenine or Cytosine)
  K: new Color(0xffcc33), // Light Orange (Adenine or Guanine)
  R: new Color(0x00cccc), // Light Teal (Guanine or Adenine)
  Y: new Color(0xbbbbbb), // Light Gray (Pyrimidine)

  B: new Color(0xff9999), // Light Salmon (Ambiguous Bases)
  D: new Color(0x99cc99), // Light Mint Green (Ambiguous D)
  H: new Color(0x6699cc), // Light Blue (Ambiguous H)
  V: new Color(0xff99cc), // Light Purple (Ambiguous V)

  N: new Color(0xf5f5f5), // Off-White (Unknown Base)
};

const NucleotideSelectionColours: Record<SelectionStatus, Color> = {
  default: new Color(0xf0e8d0), // Lighter Sand (Default Selection)
  selected: new Color(0x88aaff), // Light Blue (Selected)
  hover: new Color(0xee4444), // Light Red (Hovered)
};

const CylinderColours = {
  prime: new Color(0xff9999),
  linker: new Color(0xff9999),

  //Overlay
  tension: new Color(0xff0000),
  torque: new Color(0x0000ff),
};

const CylinderSelectionColours: Record<SelectionStatus, Color> = {
  default: new Color(0xffffff), // Lighter Sand (Default Selection)
  selected: new Color(0x88aaff), // Light Blue (Selected)
  hover: new Color(0xee4444), // Light Red (Hovered)
};

export const ColourScheme = {
  NucleotideColours: NucleotideColours,
  NucleotideSelectionColours: NucleotideSelectionColours,

  CylinderColours: CylinderColours,
  CylinderSelectionColours: CylinderSelectionColours,
};

export const ColourSchemePresets = {
  Default: {
    NucleotideColours: {
      // Base colors
      A: new Color(0xff8eaf), // Light Pink (Adenine)
      U: new Color(0xffd133), // Light Gold (Uracil)
      T: new Color(0xffd133), // Light Gold (Thymine)
      G: new Color(0x7acc7a), // Light Green (Guanine)
      C: new Color(0x6688aa), // Light Blue (Cytosine)

      W: new Color(0xffd166), // Light Yellow (Adenine or Thymine)
      S: new Color(0x99cc99), // Light Mint Green (Guanine or Cytosine)
      M: new Color(0xff99cc), // Light Purple (Adenine or Cytosine)
      K: new Color(0xffcc33), // Light Orange (Adenine or Guanine)
      R: new Color(0x00cccc), // Light Teal (Guanine or Adenine)
      Y: new Color(0xbbbbbb), // Light Gray (Pyrimidine)

      B: new Color(0xff9999), // Light Salmon (Ambiguous Bases)
      D: new Color(0x99cc99), // Light Mint Green (Ambiguous D)
      H: new Color(0x6699cc), // Light Blue (Ambiguous H)
      V: new Color(0xff99cc), // Light Purple (Ambiguous V)

      N: new Color(0xf5f5f5), // Off-White (Unknown Base)
    },

    NucleotideSelectionColours: {
      default: new Color(0xf0e8d0), // Lighter Sand (Default Selection)
      selected: new Color(0x88aaff), // Light Blue (Selected)
      hover: new Color(0xee4444), // Light Red (Hovered)
    },

    CylinderColours: {
      prime: new Color(0xff9999),
      linker: new Color(0xff9999),

      //Overlay
      tension: new Color(0xff0000),
      torque: new Color(0x0000ff),
    },

    CylinderSelectionColours: {
      default: new Color(0xffffff), // Lighter Sand (Default Selection)
      selected: new Color(0x88aaff), // Light Blue (Selected)
      hover: new Color(0xee4444), // Light Red (Hovered)
    },
  },

  Alternative: {
    NucleotideColours: {
      A: new Color(0xffb6c1), // Light Pink (Adenine)
      U: new Color(0xffdb58), // Light Gold (Uracil)
      T: new Color(0xffdb58), // Light Gold (Thymine)
      G: new Color(0x98fb98), // Pale Green (Guanine)
      C: new Color(0x87ceeb), // Sky Blue (Cytosine)

      W: new Color(0xffe599), // Light Yellow (Adenine or Thymine)
      S: new Color(0x9ac99d), // Light Mint Green (Guanine or Cytosine)
      M: new Color(0xda9dc3), // Light Pink (Adenine or Cytosine)
      K: new Color(0xffc359), // Light Orange (Adenine or Guanine)
      R: new Color(0x5e8f94), // Slate Blue (Guanine or Adenine)
      Y: new Color(0xc0c0c0), // Silver Gray (Pyrimidine)

      B: new Color(0xffa07a), // Light Salmon (Ambiguous Bases)
      D: new Color(0x9ac99d), // Light Mint Green (Ambiguous D)
      H: new Color(0x6a8caa), // Light Blue (Ambiguous H)
      V: new Color(0xda9dc3), // Light Pink (Ambiguous V)

      N: new Color(0xf5f5f5), // Off-White (Unknown Base)
    },

    NucleotideSelectionColours: {
      default: new Color(0xf3e0b8), // Lighter Sand (Default Selection)
      selected: new Color(0x87cefa), // Light Sky Blue (Selected)
      hover: new Color(0xff6f6f), // Coral Red (Hovered)
    },

    CylinderColours: {
      prime: new Color(0xffa07a), // Light Salmon
      linker: new Color(0xffa07a), // Light Salmon

      //Overlay
      tension: new Color(0xff3030), // Firebrick
      torque: new Color(0x4169e1), // Royal Blue
    },

    CylinderSelectionColours: {
      default: new Color(0xf5deb3), // Wheat (Default Selection)
      selected: new Color(0x87cefa), // Light Sky Blue (Selected)
      hover: new Color(0xff6f6f), // Coral Red (Hovered)
    },
  },
  Random: {
    NucleotideColours: {
      A: new Color('#82e0aa'), // Mint Green
      U: new Color('#f39c12'), // Orange
      T: new Color('#3498db'), // Blue
      G: new Color('#e74c3c'), // Red
      C: new Color('#9b59b6'), // Purple

      W: new Color('#f1c40f'), // Yellow
      S: new Color('#2ecc71'), // Green
      M: new Color('#e67e22'), // Brown
      K: new Color('#16a085'), // Teal
      R: new Color('#d35400'), // Dark Orange
      Y: new Color('#bdc3c7'), // Silver

      B: new Color('#c0392b'), // Dark Red
      D: new Color('#27ae60'), // Dark Green
      H: new Color('#8e44ad'), // Dark Purple
      V: new Color('#2980b9'), // Dark Blue

      N: new Color('#ecf0f1'), // Light Gray
    },

    NucleotideSelectionColours: {
      default: new Color('#d7dbdd'), // Light Gray
      selected: new Color('#3498db'), // Blue
      hover: new Color('#e74c3c'), // Red
    },

    CylinderColours: {
      prime: new Color('#e67e22'), // Brown
      linker: new Color('#e74c3c'), // Red

      //Overlay
      tension: new Color('#f39c12'), // Orange
      torque: new Color('#2ecc71'), // Green
    },

    CylinderSelectionColours: {
      default: new Color('#d7dbdd'), // Light Gray
      selected: new Color('#3498db'), // Blue
      hover: new Color('#e74c3c'), // Red
    },
  },
  Winter: {
    NucleotideColours: {
      A: new Color('#e74c3c'), // Red
      U: new Color('#3498db'), // Blue
      T: new Color('#f39c12'), // Orange
      G: new Color('#2ecc71'), // Green
      C: new Color('#9b59b6'), // Purple

      W: new Color('#e67e22'), // Carrot
      S: new Color('#27ae60'), // Emerald
      M: new Color('#d35400'), // Pumpkin
      K: new Color('#2980b9'), // Belize Hole
      R: new Color('#8e44ad'), // Wisteria
      Y: new Color('#c0392b'), // Pomegranate

      B: new Color('#f39c12'), // Orange
      D: new Color('#27ae60'), // Emerald
      H: new Color('#9b59b6'), // Purple
      V: new Color('#d35400'), // Pumpkin

      N: new Color('#34495e'), // Wet Asphalt
    },

    NucleotideSelectionColours: {
      default: new Color('#ffffff'), // Pure White
      selected: new Color('#e74c3c'), // Red
      hover: new Color('#3498db'), // Peter River
    },

    CylinderColours: {
      prime: new Color('#e67e22'), // Carrot
      linker: new Color('#8e44ad'), // Wisteria

      //Overlay
      tension: new Color('#f39c12'), // Orange
      torque: new Color('#2980b9'), // Belize Hole
    },

    CylinderSelectionColours: {
      default: new Color('#ffffff'), // Pure White
      selected: new Color('#e74c3c'), // Red
      hover: new Color('#3498db'), // Peter River
    },
  },
};
