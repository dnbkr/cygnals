import cfg from '../deno.json' with { type: 'json' }
import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: [
    "./src/index.ts",
    { name: "./dom", path: "./src/dom.ts" },
    { name: "./react", path: "./src/react.ts" },
  ],
  outDir: "./npm",
  shims: { deno: true },
  importMap: "deno.json",
  test: false,
  declaration: "inline",
  compilerOptions: {
    lib: ["DOM"],
  },
  package: {
    name: "cygnals",
    version: cfg.version,
    keywords: ["signals", "reactive", "state"],
    description: "Tools for working with reactive data",
    license: "MIT",
    author: "Daniel Baker",
    homepage: "https://github.com/dnbkr/cygnals#readme",
    repository: {
      type: "git",
      url: "git+https://github.com/dnbkr/cygnals.git",
    },
    bugs: {
      url: "https://github.com/dnbkr/cygnals/issues",
    },
    devDependencies: {
      "@types/react": "^18"
    }
  },
  mappings: {
    "npm:react": {
      name: "react",
      version: "^18",
      peerDependency: true,
    },
    "npm:@types/react": {
      name: "",
    }
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
