import { Color } from "three";
import { SelectionStatus } from "./selectable";


export const NucleotideColours: Record<string, Color> = {
    // Base colors
    A: new Color(0xff8eaf),  // Light Pink (Adenine)
    U: new Color(0xffd133),  // Light Gold (Uracil)
    T: new Color(0xffd133),  // Light Gold (Thymine)
    G: new Color(0x7acc7a),  // Light Green (Guanine)
    C: new Color(0x6688aa),  // Light Blue (Cytosine)

    W: new Color(0xffd166),  // Light Yellow (Adenine or Thymine)
    S: new Color(0x99cc99),  // Light Mint Green (Guanine or Cytosine)
    M: new Color(0xff99cc),  // Light Purple (Adenine or Cytosine)
    K: new Color(0xffcc33),  // Light Orange (Adenine or Guanine)
    R: new Color(0x00cccc),  // Light Teal (Guanine or Adenine)
    Y: new Color(0xbbbbbb),  // Light Gray (Pyrimidine)

    B: new Color(0xff9999),  // Light Salmon (Ambiguous Bases)
    D: new Color(0x99cc99),  // Light Mint Green (Ambiguous D)
    H: new Color(0x6699cc),  // Light Blue (Ambiguous H)
    V: new Color(0xff99cc),  // Light Purple (Ambiguous V)

    N: new Color(0xf5f5f5),  // Off-White (Unknown Base)
}

export const NucleotideSelectionColours: Record<SelectionStatus, Color> = {
    default: new Color(0xf0e8d0),    // Lighter Sand (Default Selection)
    selected: new Color(0x88aaff),  // Light Blue (Selected)
    hover: new Color(0xee4444),      // Light Red (Hovered)
}

export const CylinderColours = {
    prime: new Color(0xff9999),
    linker: new Color(0xff9999),

    //Overlay
    tension: new Color(0xff0000),
    torque: new Color(0x0000ff),
};

export const CylinderSelectionColours: Record<SelectionStatus, Color> = {
    default: new Color(0xffffff),    // Lighter Sand (Default Selection)
    selected: new Color(0x88aaff),  // Light Blue (Selected)
    hover: new Color(0xee4444),      // Light Red (Hovered)
}
