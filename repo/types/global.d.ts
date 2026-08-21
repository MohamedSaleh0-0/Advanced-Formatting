// No @types/node available (no network access to fetch it in the
// environment this was authored in). `require` is the only Node.js
// global this codebase actually uses (for the optional, try/catch-guarded
// CodeMirror imports in decorations.ts), so it's declared directly here
// rather than pulling in a full Node type package.
declare function require(id: string): any;
