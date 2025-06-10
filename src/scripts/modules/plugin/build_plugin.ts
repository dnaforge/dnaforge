import atrail from '../atrail/atrail?raw';
import atrail_menu from '../atrail/atrail_menu?raw';
import atrail_ui from '../atrail/atrail_ui.htm';

import cc from '../cycle_cover/cycle_cover?raw';
import cc_menu from '../cycle_cover/cycle_cover_menu?raw';
import cc_ui from '../cycle_cover/cycle_cover_ui.htm';

import euler from '../euler/euler?raw';
import euler_menu from '../euler/euler_menu?raw';
import euler_ui from '../euler/euler_ui.htm';

import stdna from '../stdna/stdna?raw';
import shb from '../stdna/sixhelix?raw';
import stdna_menu from '../stdna/stdna_menu?raw';
import stdna_ui from '../stdna/stdna_ui.htm';

import xtdna from '../xtdna/xtdna?raw';
import xtdna_menu from '../xtdna/xtdna_menu?raw';
import xtdna_ui from '../xtdna/xtdna_ui.htm';

import sterna from '../sterna/sterna?raw';
import sterna_menu from '../sterna/sterna_menu?raw';
import sterna_ui from '../sterna/sterna_ui.htm';

import xtrna from '../xtrna/xtrna?raw';
import xtrna_menu from '../xtrna/xtrna_menu?raw';
import xtrna_ui from '../xtrna/xtrna_ui.htm';

// Get the classes and functions that are exported for plugin use
import pluginHelper from './plugin_helper?raw';
const match = pluginHelper.match(
  /export const pluginHelper\s*=\s*{([\s\S]*?)^\};?/m,
);
const pluginHelperContent = match ? match[1].trim() : null;

/**
 * Maps all the files of individual modules
 */
const moduleMap = new Map<string, { ts: string; menu: string; menuName: string; html: string }>(
  [
    ['AT-DNA', { ts: atrail, menu: atrail_menu, menuName: 'ATrail', html: atrail_ui }],
    ['CC-DNA', { ts: cc, menu: cc_menu, menuName: 'CycleCover', html: cc_ui }],
    ['EC-DNA', { ts: euler, menu: euler_menu, menuName: 'Euler', html: euler_ui }],
    ['ST-DNA', { ts: stdna + `\n` + shb, menu: stdna_menu, menuName: 'SpanningTree', html: stdna_ui }],
    ['XT-DNA', { ts: xtdna, menu: xtdna_menu, menuName: 'Xtdna', html: xtdna_ui }],
    ['ST-RNA', { ts: sterna, menu: sterna_menu, menuName: 'Sterna', html: sterna_ui }],
    ['XT-RNA', { ts: xtrna, menu: xtrna_menu, menuName: 'Xtrna', html: xtrna_ui }],
  ]);

/**
 * Cleans up the code strings, so that there are no imports or exports, and all the THREE. functions are
 * prefixed with 'THREE.', so they remain accessible.
 */
function clean(code: string): string {
  const cleaned = code
    .replace(
      /^\s*import[\s\S]+?from\s+['"][^'"]+['"]\s*;?|^\s*import\s+['"][^'"]+['"]\s*;/gm,
      '',
    )
    .replace(
      /^\s*export\s+(?=(const|let|var|function|class|async\s+function|interface|type|enum))/gm,
      '',
    )
    .replace(/^\s*export\s+default\s+/gm, '')
    .trim();

  const threeSymbols = [
    'Vector3',
    'Matrix4',
    'Quaternion',
    'Object3D',
    'BaseEvent',
    'InstancedMesh',
    'Intersection',
    'Camera',
    'Scene',
    'Event',
    'Color',
    'WebGLRenderer',
    'CSS2DRenderer',
    'ArcballControls',
  ];
  const prefixWithTHREE = new RegExp(
    `(?<!\\bTHREE\\.)\\b(${threeSymbols.join('|')})\\b`,
    'g',
  );
  return cleaned.replace(prefixWithTHREE, 'THREE.$1');
}

/**
 * Joins the files of individual modules, and adds the declaration of external functions and classes,
 * embeds the html text to 'const html' and adds the menu initialization, so that the created plugin
 * files work like actual plugins.
 *
 * @returns A map where each key is a module name, and the value is its full plugin script string.
 */
export function buildPluginContent(): Map<string, string> {
  const pluginScripts = new Map<string, string>();

  for (const [name, { ts, menu, menuName, html }] of moduleMap) {
    const tsContent = [ts, menu].map(clean).join('\n\n');
    const htmlContent = html;

    const combined = `const {
  ${pluginHelperContent} } = api;
const html = \`${htmlContent}\`;

${tsContent}

new ${menuName}Menu(context);`;

    pluginScripts.set(name, combined);
  }

  return pluginScripts;
}
