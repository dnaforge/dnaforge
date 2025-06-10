import { pluginHelper } from './plugin_helper';
import { Context } from '../../menus/context';

declare global {
  interface Window {
    ts?: typeof import('typescript');
  }
}

export async function loadPlugins(context: Context) {
  const plugins = JSON.parse(localStorage.getItem('plugins') || '[]');

  for (const plugin of plugins) {
    const { name, content } = plugin;
    const isTs = name.endsWith('.ts');
    const isJs = name.endsWith('.js');
    if (!content || (!isTs && !isJs)) continue;

    let javaScriptContent = content;

    // When the plugin file is a .ts file, it needs to be transpiled
    if (isTs) {
      // If there are no previous .ts plugin files, the typescript transpiler needs to be created.
      if (!window.ts) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/typescript@latest/lib/typescript.js';
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      javaScriptContent = window.ts.transpileModule(content, {
        compilerOptions: {
          module: window.ts.ModuleKind.ESNext,
          target: window.ts.ScriptTarget.ES2015,
          experimentalDecorators: true,
        },
      }).outputText;
    }

    try {
      const pluginFn = new Function('context', 'api', javaScriptContent);
      // Plugin file is run with the given context and the pluginHelper (accessible in the plugin file as 'api')
      pluginFn(context, pluginHelper);
    } catch (err) {
      console.error(`Error loading plugin ${name}:`, err);
    }
  }
}
