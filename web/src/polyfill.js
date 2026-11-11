import { Buffer } from "buffer";
globalThis.Buffer ??= Buffer;
globalThis.global ??= globalThis;
globalThis.process ??= { env: {}, browser: true, version: "" }; // old `util` (via wallet deps) reads process.env
