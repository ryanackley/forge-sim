"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var backend_exports = {};
__export(backend_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(backend_exports);
var import_resolver = __toESM(require("@forge/resolver"));
var import_kvs = require("@forge/kvs");
var import_api = require("@forge/api");
const resolver = new import_resolver.default();
resolver.define("save", async ({ payload }) => {
  await import_kvs.kvs.set("saved:" + payload.id, { id: payload.id, by: "matrix-backend" });
  return "saved " + payload.id;
});
resolver.define("summary", async () => {
  const saved = await import_kvs.kvs.get("saved:ui");
  return saved ? "ui saved by " + saved.by : "nothing saved";
});
resolver.define("issue", async ({ payload }) => {
  const res = await (0, import_api.requestJira)(import_api.route`/rest/api/3/issue/${payload.key}`);
  const data = await res.json();
  return data.fields.summary;
});
const handler = resolver.getDefinitions();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
