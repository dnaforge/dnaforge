interface GLOBALS_TYPE {
  [key: string]: any;
  hover: boolean;
  selectionMode: 'none' | 'single' | 'limited' | 'connected';
}

export const GLOBALS: GLOBALS_TYPE = {
  hover: false,
  selectionMode: 'connected',

  visibilityNucBackbone: true,
  visibilityNucBase: true,
};
