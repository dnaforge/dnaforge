declare module 'metro4' {
  const content: any;
  export default content;
}

declare const $: any;
declare const Metro: any;

declare module 'edmonds-blossom-fixed' {
  const content: any;
  export default content;
}

declare module '*.htm' {
  const content: any;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}

type JSONValue = JSONObject | string | number | boolean | Array<JSONValue>;

interface JSONObject {
  [x: string]: JSONValue;
}
