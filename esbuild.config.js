const esbuild = require("esbuild");

esbuild.build({
  entryPoints: [
    "src/content.js",    
    "src/extension/popup.js"
  ],
  bundle: true,
  outdir: "build",
  minify: true,
  format: "iife",
});

