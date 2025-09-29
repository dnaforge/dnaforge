# DNAForge Plugin Instructions

The plugin's idea is to develop a new design method for nucleic acid origami to use in DNAforge.

The plugin files are stored in the browser's local storage. This means that if you frequently clear out your browser's local storage, your plugins will be removed and have to be re-uploaded to DNAforge. Each plugin should be contained in just one file (of type `.js` or `.ts`).

## Table of Contents
* [Uploading a Plugin](#uploading-a-plugin)
* [Deleting a Plugin](#deleting-a-plugin)
* [Plugin Development](#plugin-development)
    + [Rules for Plugin Construction](#rules-for-plugin-construction)
    + [TypeScript Plugins](#typescript-plugins)
    + [Example Plugin Files](#example-plugin-files)
    + [Built-in TypeScript Modules](#built-in-typescript-modules)
    + [Testing a Plugin File](#testing-a-plugin-file)

---

## Uploading a Plugin
The plugin files can be uploaded to DNAforge with the following way:

*Go to `File`-tab -> `Upload Plugin` -> drag the plugin file to the box or select the file from the local file system -> click `Upload Plugin`* 

![screenshot](/docs/plugin-development/screenshots/scr3.png "Click 'Upload Plugin'")
![screenshot](/docs/plugin-development/screenshots/scr4.png "Click blue 'Upload Plugin' button")

It is possible to upload multiple plugins at once. When the plugin is successfully uploaded, the page will reload. If there are any issues with the uploading of the plugin file, the web page will display an error message describing the problem.

If the plugin file is correctly constructed, it will display itself at the top bar next to the built-in design methods.

![screenshot](/docs/plugin-development/screenshots/scr5.png "Plugin tab")

---

## Deleting a Plugin
Plugin files can be deleted individually the following way:

*Go to `File`-tab -> `Manage Plugins` -> `User Plugins` -> click red delete button of the plugin file* 

![screenshot](/docs/plugin-development/screenshots/scr1.png "Click 'Manage Plugins'")
![screenshot](/docs/plugin-development/screenshots/scr6.png "Click red delete button")


The file will be permanently removed from the browser's local storage and cannot be retrieved afterward. Clearing out local storage removes all plugin files. 

---

## Plugin Development
This section covers the basics on how to construct a plugin that works as intended in DNAForge. 

### Rules for Plugin Construction
Keep in mind that there are some additional rules to the plugin construction compared to the [built-in TypeScript modules](https://github.com/dnaforge/dnaforge/tree/main/src/scripts/modules) in GitHub:

- The plugin file must be just one file (of type `.js` or `.ts`)
- Use `api.` to access external classes and functions (the available classes and functions are listed in the file `custom.d.ts`)
- You cannot use `import` or `export` functions at all. All the external classes and functions you're allowed to use in your plugin can be accessed with `api.` call.
- Initiate the menu class with the context (like in the TypeScript template file)

### TypeScript Plugins
If you decide to work on your own plugin in TypeScript, download the provided [plugin template](https://github.com/dnaforge/dnaforge/tree/main/docs/plugin-development/plugin_template.zip) .zip file. The .zip file contains three files: `custom.d.ts`, `tsconfig.json`, and the actual template `plugin_template.ts`. These can work as a starting point when developing a new plugin for DNAForge.

Keep the provided `custom.d.ts` and `tsconfig.json` files in the same folder as your plugin file in order to avoid development-time TypeScript errors.

The template file contains instructions on how the plugin file should be constructed.

Some errors might be caused by using `THREE.` classes or functions not defined in `custom.d.ts`. These classes/functions are still usable, just manually add any missing declarations under the `THREE` namespace to resolve the TypeScript errors.

### Example Plugin Files
You can download the automatically generated example plugin files of the built-in modules for reference from https://dnaforge.org 

*(Go to `File`-tab -> `Manage Plugins` -> `Built-in Plugins` -> blue download button)* 

> **Note:** These examples are of type `.js`, while the provided template is for `.ts` plugins.

![screenshot](/docs/plugin-development/screenshots/scr1.png "Click 'Manage Plugins'")
![screenshot](/docs/plugin-development/screenshots/scr2.png "Click blue download button")

### Built-in TypeScript Modules
You can also see DNAForge's built-in TypeScript modules for reference from the following link: https://github.com/dnaforge/dnaforge/tree/main/src/scripts/modules .

### Testing a Plugin File
The plugin file can be tested by uploading it to DNAforge (see [Uploading a Plugin](#uploading-a-plugin)).
