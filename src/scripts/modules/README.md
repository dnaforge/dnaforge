# Instructions for Adding a New Built-in Module

- Update `plugin/build_plugin.ts` file to import the raw JavaScript files of the new module (like all the other modules), and add them along with the module's name to the `moduleMap`.

- Update `modules.ts` file's `modules` object with the new module's name and menu class.

- Update `pluginHelper` at `plugin/plugin_helper.ts` with any imports of the new module file that are not yet listed in the object.