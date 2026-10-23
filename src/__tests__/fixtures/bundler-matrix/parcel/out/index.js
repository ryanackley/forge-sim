"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// node_modules/@forge/resolver/out/index.js
var require_out = __commonJS({
  "node_modules/@forge/resolver/out/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.makeResolver = makeResolver;
    var Resolver2 = class {
      functions;
      constructor() {
        this.functions = {};
      }
      define(functionKey, cb) {
        if (!cb || typeof cb !== "function") {
          throw new Error(`Resolver definition '${functionKey}' callback must be a 'function'. Received '${typeof cb}'.`);
        }
        if (functionKey in this.functions) {
          throw new Error(`Resolver definition '${functionKey}' already exists.`);
        }
        this.functions[functionKey] = cb;
        return this;
      }
      getFunction(functionKey) {
        if (functionKey in this.functions) {
          return this.functions[functionKey];
        }
        throw new Error(`Resolver has no definition for '${functionKey}'.`);
      }
      sanitizeObject(object) {
        return JSON.parse(JSON.stringify(object));
      }
      getDefinitions() {
        return async ({ call: { functionKey, payload, jobId }, context }, backendRuntimePayload) => {
          const cb = this.getFunction(functionKey);
          const result = await cb({
            payload: payload || {},
            context: {
              ...context,
              installContext: backendRuntimePayload?.installContext,
              accountId: backendRuntimePayload?.principal?.accountId,
              license: backendRuntimePayload?.license,
              jobId,
              installation: backendRuntimePayload?.installation
            }
          });
          if (typeof result === "object") {
            return this.sanitizeObject(result);
          }
          return result;
        };
      }
    };
    exports2.default = Resolver2;
    function makeResolver(handlers) {
      const resolver2 = new Resolver2();
      for (const key of Object.keys(handlers)) {
        resolver2.define(key, handlers[key]);
      }
      return resolver2.getDefinitions();
    }
  }
});

// node_modules/tslib/tslib.es6.mjs
var tslib_es6_exports = {};
__export(tslib_es6_exports, {
  __addDisposableResource: () => __addDisposableResource,
  __assign: () => __assign,
  __asyncDelegator: () => __asyncDelegator,
  __asyncGenerator: () => __asyncGenerator,
  __asyncValues: () => __asyncValues,
  __await: () => __await,
  __awaiter: () => __awaiter,
  __classPrivateFieldGet: () => __classPrivateFieldGet,
  __classPrivateFieldIn: () => __classPrivateFieldIn,
  __classPrivateFieldSet: () => __classPrivateFieldSet,
  __createBinding: () => __createBinding,
  __decorate: () => __decorate,
  __disposeResources: () => __disposeResources,
  __esDecorate: () => __esDecorate,
  __exportStar: () => __exportStar,
  __extends: () => __extends,
  __generator: () => __generator,
  __importDefault: () => __importDefault,
  __importStar: () => __importStar,
  __makeTemplateObject: () => __makeTemplateObject,
  __metadata: () => __metadata,
  __param: () => __param,
  __propKey: () => __propKey,
  __read: () => __read,
  __rest: () => __rest,
  __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
  __runInitializers: () => __runInitializers,
  __setFunctionName: () => __setFunctionName,
  __spread: () => __spread,
  __spreadArray: () => __spreadArray,
  __spreadArrays: () => __spreadArrays,
  __values: () => __values,
  default: () => tslib_es6_default
});
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
    return f;
  }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
    var context = {};
    for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
    for (var p in contextIn.access) context.access[p] = contextIn.access[p];
    context.addInitializer = function(f) {
      if (done) throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === void 0) continue;
      if (result === null || typeof result !== "object") throw new TypeError("Object expected");
      if (_ = accept(result.get)) descriptor.get = _;
      if (_ = accept(result.set)) descriptor.set = _;
      if (_ = accept(result.init)) initializers.unshift(_);
    } else if (_ = accept(result)) {
      if (kind === "field") initializers.unshift(_);
      else descriptor[key] = _;
    }
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
}
function __runInitializers(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) {
    value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  }
  return useValue ? value : void 0;
}
function __propKey(x) {
  return typeof x === "symbol" ? x : "".concat(x);
}
function __setFunctionName(f, name, prefix) {
  if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
}
function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __exportStar(m, o) {
  for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
}
function __spread() {
  for (var ar = [], i = 0; i < arguments.length; i++)
    ar = ar.concat(__read(arguments[i]));
  return ar;
}
function __spreadArrays() {
  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
  for (var r = Array(s), k = 0, i = 0; i < il; i++)
    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
      r[k] = a[j];
  return r;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
function __makeTemplateObject(cooked, raw) {
  if (Object.defineProperty) {
    Object.defineProperty(cooked, "raw", { value: raw });
  } else {
    cooked.raw = raw;
  }
  return cooked;
}
function __importStar(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
  }
  __setModuleDefault(result, mod);
  return result;
}
function __importDefault(mod) {
  return mod && mod.__esModule ? mod : { default: mod };
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldIn(state, receiver) {
  if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
  return typeof state === "function" ? receiver === state : state.has(receiver);
}
function __addDisposableResource(env, value, async) {
  if (value !== null && value !== void 0) {
    if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    env.stack.push({ value, dispose, async });
  } else if (async) {
    env.stack.push({ async: true });
  }
  return value;
}
function __disposeResources(env) {
  function fail(e) {
    env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
    env.hasError = true;
  }
  var r, s = 0;
  function next() {
    while (r = env.stack.pop()) {
      try {
        if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
        if (r.dispose) {
          var result = r.dispose.call(r.value);
          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
            fail(e);
            return next();
          });
        } else s |= 1;
      } catch (e) {
        fail(e);
      }
    }
    if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
    if (env.hasError) throw env.error;
  }
  return next();
}
function __rewriteRelativeImportExtension(path, preserveJsx) {
  if (typeof path === "string" && /^\.\.?\//.test(path)) {
    return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
      return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
    });
  }
  return path;
}
var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
var init_tslib_es6 = __esm({
  "node_modules/tslib/tslib.es6.mjs"() {
    extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    __assign = function() {
      __assign = Object.assign || function __assign2(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    __createBinding = Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    __setModuleDefault = Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    };
    ownKeys = function(o) {
      ownKeys = Object.getOwnPropertyNames || function(o2) {
        var ar = [];
        for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
        return ar;
      };
      return ownKeys(o);
    };
    _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };
    tslib_es6_default = {
      __extends,
      __assign,
      __rest,
      __decorate,
      __param,
      __esDecorate,
      __runInitializers,
      __propKey,
      __setFunctionName,
      __metadata,
      __awaiter,
      __generator,
      __createBinding,
      __exportStar,
      __values,
      __read,
      __spread,
      __spreadArrays,
      __spreadArray,
      __await,
      __asyncGenerator,
      __asyncDelegator,
      __asyncValues,
      __makeTemplateObject,
      __importStar,
      __importDefault,
      __classPrivateFieldGet,
      __classPrivateFieldSet,
      __classPrivateFieldIn,
      __addDisposableResource,
      __disposeResources,
      __rewriteRelativeImportExtension
    };
  }
});

// node_modules/@forge/kvs/out/entity-query.js
var require_entity_query = __commonJS({
  "node_modules/@forge/kvs/out/entity-query.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FilterBuilder = exports2.BaseFilter = exports2.KvsIndexQueryBuilder = void 0;
    var KvsIndexQueryBuilder = class {
      entityName;
      storageApi;
      options;
      constructor(entityName, storageApi, options) {
        this.entityName = entityName;
        this.storageApi = storageApi;
        this.options = options;
      }
      index(name, indexOptions) {
        return new KvsEntityQueryBuilder(this.storageApi, {
          ...this.options,
          entityName: this.entityName,
          indexName: name,
          partition: indexOptions?.partition,
          filters: []
        });
      }
    };
    exports2.KvsIndexQueryBuilder = KvsIndexQueryBuilder;
    var KvsEntityQueryBuilder = class {
      storageApi;
      queryOptions;
      constructor(storageApi, queryOptions) {
        this.storageApi = storageApi;
        this.queryOptions = queryOptions;
      }
      where(condition) {
        this.queryOptions.range = condition;
        return this;
      }
      filters(filter) {
        this.queryOptions.filters = filter.filters();
        this.queryOptions.filterOperator = filter.operator();
        return this;
      }
      sort(sort) {
        this.queryOptions.sort = sort;
        return this;
      }
      cursor(cursor) {
        this.queryOptions.cursor = cursor;
        return this;
      }
      limit(limit) {
        this.queryOptions.limit = limit;
        return this;
      }
      async getOne() {
        const { results } = await this.limit(1).getMany();
        if (results && results.length > 0) {
          return results[0];
        }
        return void 0;
      }
      async getMany() {
        const maybeOptions = {
          ...this.queryOptions?.metadataFields ? { options: { metadataFields: this.queryOptions.metadataFields } } : {}
        };
        const { filters, filterOperator, metadataFields, ...rest } = this.queryOptions;
        if (filters && filterOperator && filters.length > 0) {
          return this.storageApi.queryEntity({
            ...rest,
            ...maybeOptions,
            filters: {
              [filterOperator]: filters
            }
          });
        }
        return this.storageApi.queryEntity({ ...rest, ...maybeOptions });
      }
    };
    var BaseFilter = class {
      items;
      constructor(items = []) {
        this.items = items;
      }
      filters() {
        return this.items;
      }
      operator() {
        return this instanceof AndFilterBuilder ? "and" : "or";
      }
    };
    exports2.BaseFilter = BaseFilter;
    var FilterBuilder = class extends BaseFilter {
      and(field, condition) {
        return new AndFilterBuilder().and(field, condition);
      }
      or(field, condition) {
        return new OrFilterBuilder().or(field, condition);
      }
    };
    exports2.FilterBuilder = FilterBuilder;
    var AndFilterBuilder = class extends BaseFilter {
      and(field, condition) {
        this.items.push({ property: field, ...condition });
        return this;
      }
    };
    var OrFilterBuilder = class extends BaseFilter {
      or(field, condition) {
        this.items.push({ property: field, ...condition });
        return this;
      }
    };
  }
});

// node_modules/@forge/kvs/out/entity.js
var require_entity = __commonJS({
  "node_modules/@forge/kvs/out/entity.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.EntityImpl = void 0;
    var entity_query_1 = require_entity_query();
    var EntityImpl = class {
      entityName;
      storageApi;
      constructor(entityName, storageApi) {
        this.entityName = entityName;
        this.storageApi = storageApi;
      }
      get(key, options) {
        return this.storageApi.getEntity({
          entityName: this.entityName,
          key,
          options
        });
      }
      set(key, value, options) {
        return this.storageApi.setEntity({
          entityName: this.entityName,
          key,
          value,
          options
        });
      }
      delete(key) {
        return this.storageApi.deleteEntity({
          entityName: this.entityName,
          key
        });
      }
      query(options) {
        return new entity_query_1.KvsIndexQueryBuilder(this.entityName, this.storageApi, options);
      }
    };
    exports2.EntityImpl = EntityImpl;
  }
});

// node_modules/@forge/kvs/out/query.js
var require_query = __commonJS({
  "node_modules/@forge/kvs/out/query.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KvsQueryBuilder = void 0;
    var KvsQueryBuilder = class {
      storageApi;
      options;
      constructor(storageApi, options = {}) {
        this.storageApi = storageApi;
        this.options = options;
      }
      where(property, condition) {
        this.options.where = [{ property, ...condition }];
        return this;
      }
      cursor(cursor) {
        this.options.cursor = cursor;
        return this;
      }
      limit(limit) {
        this.options.limit = limit;
        return this;
      }
      async getOne() {
        const { results } = await this.limit(1).getMany();
        if (results && results.length > 0) {
          return results[0];
        }
        return void 0;
      }
      getMany() {
        const maybeOptions = {
          ...this.options?.metadataFields ? { options: { metadataFields: this.options.metadataFields } } : {}
        };
        return this.storageApi.query({
          limit: this.options.limit,
          after: this.options.cursor,
          where: this.options.where,
          ...maybeOptions
        });
      }
    };
    exports2.KvsQueryBuilder = KvsQueryBuilder;
  }
});

// node_modules/@forge/kvs/package.json
var require_package = __commonJS({
  "node_modules/@forge/kvs/package.json"(exports2, module2) {
    module2.exports = {
      name: "@forge/kvs",
      version: "1.6.5",
      description: "Forge Key Value Store SDK",
      author: "Atlassian",
      license: "SEE LICENSE IN LICENSE.txt",
      main: "out/index.js",
      types: "out/index.d.ts",
      files: [
        "out"
      ],
      scripts: {
        build: "yarn run clean && yarn run compile",
        clean: "rm -rf ./out && rm -f tsconfig.tsbuildinfo",
        compile: "tsc -b -v"
      },
      devDependencies: {
        "@atlassian/xen-test-util": "^4.2.0",
        "@types/node": "20.19.1"
      },
      dependencies: {
        "@forge/api": "^7.2.2"
      },
      publishConfig: {
        registry: "https://packages.atlassian.com/api/npm/npm-public/"
      }
    };
  }
});

// node_modules/@forge/kvs/out/version.js
var require_version = __commonJS({
  "node_modules/@forge/kvs/out/version.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.PACKAGE_VERSION = exports2.PACKAGE_NAME = void 0;
    var packageInfo = require_package();
    exports2.PACKAGE_NAME = packageInfo.name;
    exports2.PACKAGE_VERSION = packageInfo.version;
  }
});

// node_modules/@forge/kvs/out/errors.js
var require_errors = __commonJS({
  "node_modules/@forge/kvs/out/errors.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ForgeKvsAPIError = exports2.ForgeKvsError = void 0;
    var version_1 = require_version();
    var ForgeKvsError = class extends Error {
      packageVersion;
      constructor(message, packageVersion = version_1.PACKAGE_VERSION) {
        super(message);
        this.name = "ForgeKvsError";
        this.packageVersion = packageVersion;
      }
    };
    exports2.ForgeKvsError = ForgeKvsError;
    var ForgeKvsAPIError = class extends ForgeKvsError {
      responseDetails;
      code;
      message;
      context;
      constructor(responseDetails, forgeError) {
        super(forgeError.message);
        const { status, statusText, traceId, httpMethod, httpPath, responseBodyLength } = responseDetails;
        this.responseDetails = { status, statusText, traceId, httpMethod, httpPath, responseBodyLength };
        const { code, message, context, ...bodyData } = forgeError;
        this.code = code;
        this.message = message;
        this.context = { ...context, ...bodyData };
      }
    };
    exports2.ForgeKvsAPIError = ForgeKvsAPIError;
  }
});

// node_modules/@forge/kvs/out/utils/transaction-request-builder.js
var require_transaction_request_builder = __commonJS({
  "node_modules/@forge/kvs/out/utils/transaction-request-builder.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildRequestChecks = exports2.buildRequestDeletes = exports2.buildRequestSet = void 0;
    var errors_1 = require_errors();
    function buildConditionsRequest(filter) {
      if (!filter) {
        return void 0;
      }
      if (filter.filters().length === 0) {
        throw new errors_1.ForgeKvsError("Builder must have at least one condition set");
      }
      return {
        [filter.operator()]: filter.filters()
      };
    }
    var buildRequestSet = (setOperation) => {
      const { key, value, entity, options } = setOperation;
      const entityName = entity?.entityName;
      const conditions = buildConditionsRequest(entity?.conditions);
      return {
        key,
        value,
        entityName,
        conditions,
        options
      };
    };
    exports2.buildRequestSet = buildRequestSet;
    var buildRequestDeletes = (deleteOperation) => {
      const { key, entity } = deleteOperation;
      const entityName = entity?.entityName;
      const conditions = buildConditionsRequest(entity?.conditions);
      return {
        key,
        entityName,
        conditions
      };
    };
    exports2.buildRequestDeletes = buildRequestDeletes;
    var buildRequestChecks = (checkOperation) => {
      const { key, entity } = checkOperation;
      const entityName = entity.entityName;
      const conditions = buildConditionsRequest(entity.conditions);
      return {
        key,
        entityName,
        conditions
      };
    };
    exports2.buildRequestChecks = buildRequestChecks;
  }
});

// node_modules/@forge/kvs/out/transaction-api.js
var require_transaction_api = __commonJS({
  "node_modules/@forge/kvs/out/transaction-api.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TransactionBuilderImpl = void 0;
    var transaction_request_builder_1 = require_transaction_request_builder();
    var TransactionBuilderImpl = class {
      storageApi;
      sets;
      deletes;
      checks;
      constructor(storageApi, sets = [], deletes = [], checks = []) {
        this.storageApi = storageApi;
        this.sets = sets;
        this.deletes = deletes;
        this.checks = checks;
      }
      set(key, value, entity, options) {
        const transactSet = {
          key,
          value,
          options
        };
        if (entity) {
          transactSet.entity = {
            entityName: entity.entityName,
            conditions: entity.conditions
          };
        }
        this.sets.push(transactSet);
        return this;
      }
      delete(key, entity) {
        const transactDelete = {
          key
        };
        if (entity) {
          transactDelete.entity = {
            entityName: entity.entityName,
            conditions: entity.conditions
          };
        }
        this.deletes.push(transactDelete);
        return this;
      }
      check(key, { entityName, conditions }) {
        const transactCheck = {
          key,
          entity: {
            entityName,
            conditions
          }
        };
        this.checks.push(transactCheck);
        return this;
      }
      async execute() {
        const undefineEmptyArray = (arr) => {
          return arr.length === 0 ? void 0 : arr;
        };
        const request = {
          set: undefineEmptyArray(this.sets.map(transaction_request_builder_1.buildRequestSet)),
          delete: undefineEmptyArray(this.deletes.map(transaction_request_builder_1.buildRequestDeletes)),
          check: undefineEmptyArray(this.checks.map(transaction_request_builder_1.buildRequestChecks))
        };
        await this.storageApi.transact(request);
      }
    };
    exports2.TransactionBuilderImpl = TransactionBuilderImpl;
  }
});

// node_modules/@forge/kvs/out/kvs.js
var require_kvs = __commonJS({
  "node_modules/@forge/kvs/out/kvs.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KvsImpl = void 0;
    var entity_1 = require_entity();
    var query_1 = require_query();
    var transaction_api_1 = require_transaction_api();
    var KvsImpl = class {
      storageApi;
      constructor(storageApi) {
        this.storageApi = storageApi;
      }
      get(key, options) {
        return this.storageApi.get({ key, options });
      }
      set(key, value, options) {
        return this.storageApi.set({ key, value, options });
      }
      batchSet(items) {
        return this.storageApi.batchSet(items);
      }
      batchDelete(items) {
        return this.storageApi.batchDelete(items);
      }
      batchGet(items) {
        return this.storageApi.batchGet(items);
      }
      delete(key) {
        return this.storageApi.delete({ key });
      }
      query(options) {
        return new query_1.KvsQueryBuilder(this.storageApi, options);
      }
      getSecret(key, options) {
        return this.storageApi.getSecret({ key, options });
      }
      setSecret(key, value, options) {
        return this.storageApi.setSecret({ key, value, options });
      }
      deleteSecret(key) {
        return this.storageApi.deleteSecret({ key });
      }
      entity(entityName) {
        return new entity_1.EntityImpl(entityName, this.storageApi);
      }
      transact() {
        return new transaction_api_1.TransactionBuilderImpl(this.storageApi);
      }
    };
    exports2.KvsImpl = KvsImpl;
  }
});

// node_modules/@forge/kvs/out/interfaces/types.js
var require_types = __commonJS({
  "node_modules/@forge/kvs/out/interfaces/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Sort = exports2.isOverrideAndReturnOptions = exports2.MetadataField = void 0;
    var MetadataField;
    (function(MetadataField2) {
      MetadataField2["CREATED_AT"] = "CREATED_AT";
      MetadataField2["UPDATED_AT"] = "UPDATED_AT";
      MetadataField2["EXPIRE_TIME"] = "EXPIRE_TIME";
    })(MetadataField = exports2.MetadataField || (exports2.MetadataField = {}));
    function isOverrideAndReturnOptions(options) {
      return options !== void 0 && "returnValue" in options;
    }
    exports2.isOverrideAndReturnOptions = isOverrideAndReturnOptions;
    var Sort;
    (function(Sort2) {
      Sort2["ASC"] = "ASC";
      Sort2["DESC"] = "DESC";
    })(Sort = exports2.Sort || (exports2.Sort = {}));
  }
});

// node_modules/@forge/kvs/out/utils/error-handling.js
var require_error_handling = __commonJS({
  "node_modules/@forge/kvs/out/utils/error-handling.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.checkResponseError = exports2.extractTraceId = exports2.getAPIErrorResponseDetails = exports2.safeGetParsedBody = exports2.isForgeError = void 0;
    var errors_1 = require_errors();
    function isForgeError(body) {
      return typeof body === "object" && body !== null && "code" in body && "message" in body;
    }
    exports2.isForgeError = isForgeError;
    function safeGetParsedBody(text) {
      try {
        return JSON.parse(text);
      } catch (error) {
        return void 0;
      }
    }
    exports2.safeGetParsedBody = safeGetParsedBody;
    function getAPIErrorResponseDetails(response, responseText, requestContext) {
      return {
        status: response.status,
        statusText: response.statusText,
        traceId: extractTraceId(response),
        httpMethod: requestContext?.httpMethod,
        httpPath: requestContext?.httpPath,
        responseBodyLength: responseText.length
      };
    }
    exports2.getAPIErrorResponseDetails = getAPIErrorResponseDetails;
    function extractTraceId(response) {
      return response.headers.get("x-b3-traceid") || response.headers.get("x-trace-id");
    }
    exports2.extractTraceId = extractTraceId;
    async function checkResponseError(response, requestContext) {
      if (response.ok) {
        return;
      }
      const responseText = await response.text();
      const details = getAPIErrorResponseDetails(response, responseText, requestContext);
      const parsedBody = safeGetParsedBody(responseText);
      if (parsedBody && isForgeError(parsedBody)) {
        throw new errors_1.ForgeKvsAPIError(details, parsedBody);
      }
      throw new errors_1.ForgeKvsAPIError(details, {
        code: "UNKNOWN_ERROR",
        message: "Unexpected error in Forge KVS API",
        context: { responseText }
      });
    }
    exports2.checkResponseError = checkResponseError;
  }
});

// node_modules/@forge/kvs/out/storage-api.js
var require_storage_api = __commonJS({
  "node_modules/@forge/kvs/out/storage-api.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.StorageApi = void 0;
    var types_1 = require_types();
    var error_handling_1 = require_error_handling();
    var errors_1 = require_errors();
    var ResponseType;
    (function(ResponseType2) {
      ResponseType2[ResponseType2["NONE"] = 0] = "NONE";
      ResponseType2[ResponseType2["EXPECTED"] = 1] = "EXPECTED";
      ResponseType2[ResponseType2["OPTIONAL"] = 2] = "OPTIONAL";
    })(ResponseType || (ResponseType = {}));
    var StorageApi = class {
      apiClient;
      constructor(apiClient) {
        this.apiClient = apiClient;
      }
      async get(body) {
        const rs = await this.handleKeyNotFound(async () => {
          return this.request("/api/v1/get", body, ResponseType.EXPECTED);
        });
        return this.processGetResponse(rs, body.options);
      }
      async getSecret(body) {
        const rs = await this.handleKeyNotFound(async () => {
          return this.request("/api/v1/secret/get", body, ResponseType.EXPECTED);
        });
        return this.processGetResponse(rs, body.options);
      }
      async getEntity(body) {
        const rs = await this.handleKeyNotFound(async () => {
          return this.request("/api/v1/entity/get", body, ResponseType.EXPECTED);
        });
        return this.processGetResponse(rs, body.options);
      }
      async set(body) {
        const rs = await this.request("/api/v1/set", body, ResponseType.OPTIONAL);
        return rs && (0, types_1.isOverrideAndReturnOptions)(body.options) ? this.processSetResponse(rs, body.options) : void 0;
      }
      async setSecret(body) {
        const rs = await this.request("/api/v1/secret/set", body, ResponseType.OPTIONAL);
        return rs && (0, types_1.isOverrideAndReturnOptions)(body.options) ? this.processSetResponse(rs, body.options) : void 0;
      }
      async setEntity(body) {
        const rs = await this.request("/api/v1/entity/set", body, ResponseType.OPTIONAL);
        return rs && (0, types_1.isOverrideAndReturnOptions)(body.options) ? this.processSetResponse(rs, body.options) : void 0;
      }
      async delete(body) {
        await this.handleKeyNotFound(async () => {
          return this.request("/api/v1/delete", body, ResponseType.NONE);
        });
      }
      async deleteSecret(body) {
        await this.handleKeyNotFound(async () => {
          return this.request("/api/v1/secret/delete", body, ResponseType.NONE);
        });
      }
      async deleteEntity(body) {
        await this.handleKeyNotFound(async () => {
          return this.request("/api/v1/entity/delete", body, ResponseType.NONE);
        });
      }
      async query(body) {
        const rs = await this.request("/api/v1/query", body, ResponseType.EXPECTED);
        return {
          results: rs.data,
          nextCursor: rs.cursor
        };
      }
      async queryEntity(body) {
        const rs = await this.request("/api/v1/entity/query", body, ResponseType.EXPECTED);
        return {
          results: rs.data,
          nextCursor: rs.cursor
        };
      }
      async batchSet(body) {
        const rs = await this.request("/api/v1/batch/set", body, ResponseType.EXPECTED);
        return {
          successfulKeys: rs.successfulKeys,
          failedKeys: rs.failedKeys
        };
      }
      async batchDelete(body) {
        const rs = await this.request("/api/v1/batch/delete", body, ResponseType.EXPECTED);
        return {
          successfulKeys: rs.successfulKeys,
          failedKeys: rs.failedKeys
        };
      }
      async batchGet(body) {
        const rs = await this.request("/api/v1/batch/get", body, ResponseType.EXPECTED);
        return {
          successfulKeys: rs.successfulKeys,
          failedKeys: rs.failedKeys
        };
      }
      async transact(transactionRequest) {
        await this.request("/api/v1/transaction", transactionRequest, ResponseType.NONE);
      }
      async handleKeyNotFound(fn) {
        try {
          return await fn();
        } catch (e) {
          if (e instanceof errors_1.ForgeKvsAPIError && e.code === "KEY_NOT_FOUND") {
            return void 0;
          }
          throw e;
        }
      }
      async request(path, body, responseType) {
        const requestBody = {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "content-type": "application/json"
          }
        };
        const response = await this.apiClient(path, requestBody);
        const requestContext = {
          httpMethod: requestBody.method,
          httpPath: path
        };
        await (0, error_handling_1.checkResponseError)(response, requestContext);
        if (responseType === ResponseType.NONE) {
          return;
        }
        const responseText = await response.text();
        if (responseType === ResponseType.OPTIONAL && !responseText) {
          return void 0;
        }
        const parsedBody = (0, error_handling_1.safeGetParsedBody)(responseText);
        if (parsedBody === void 0) {
          const details = (0, error_handling_1.getAPIErrorResponseDetails)(response, responseText, requestContext);
          throw new errors_1.ForgeKvsAPIError(details, {
            code: "UNKNOWN_ERROR",
            message: "Unexpected error in Forge KVS API. Response was not valid JSON",
            context: { contentLength: response.headers.get("content-length") }
          });
        }
        return parsedBody;
      }
      processGetResponse(response, options) {
        if (response && options) {
          const maybeCreatedAt = options.metadataFields?.includes(types_1.MetadataField.CREATED_AT) ? { createdAt: response.createdAt } : {};
          const maybeUpdatedAt = options.metadataFields?.includes(types_1.MetadataField.UPDATED_AT) ? { updatedAt: response.updatedAt } : {};
          const maybeExpireTime = options.metadataFields?.includes(types_1.MetadataField.EXPIRE_TIME) ? { expireTime: response.expireTime } : {};
          return {
            key: response.key,
            value: response.value,
            ...maybeCreatedAt,
            ...maybeUpdatedAt,
            ...maybeExpireTime
          };
        }
        return response?.value;
      }
      processSetResponse(response, options) {
        if (!response) {
          return void 0;
        }
        return {
          key: response.key,
          value: response.value,
          ...options.returnMetadataFields?.includes(types_1.MetadataField.CREATED_AT) && { createdAt: response.createdAt },
          ...options.returnMetadataFields?.includes(types_1.MetadataField.UPDATED_AT) && { updatedAt: response.updatedAt },
          ...options.returnMetadataFields?.includes(types_1.MetadataField.EXPIRE_TIME) && { expireTime: response.expireTime }
        };
      }
    };
    exports2.StorageApi = StorageApi;
  }
});

// node_modules/@forge/kvs/out/conditions.js
var require_conditions = __commonJS({
  "node_modules/@forge/kvs/out/conditions.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FilterConditions = exports2.WhereConditions = void 0;
    function between(firstValue, secondValue) {
      return {
        condition: "BETWEEN",
        values: [firstValue, secondValue]
      };
    }
    function beginsWith(value) {
      return {
        condition: "BEGINS_WITH",
        values: [value]
      };
    }
    function exists() {
      return {
        condition: "EXISTS",
        values: [true]
      };
    }
    function notExists() {
      return {
        condition: "NOT_EXISTS",
        values: [true]
      };
    }
    function greaterThan(value) {
      return {
        condition: "GREATER_THAN",
        values: [value]
      };
    }
    function greaterThanEqualTo(value) {
      return {
        condition: "GREATER_THAN_EQUAL_TO",
        values: [value]
      };
    }
    function lessThan(value) {
      return {
        condition: "LESS_THAN",
        values: [value]
      };
    }
    function lessThanEqualTo(value) {
      return {
        condition: "LESS_THAN_EQUAL_TO",
        values: [value]
      };
    }
    function contains(value) {
      return {
        condition: "CONTAINS",
        values: [value]
      };
    }
    function notContains(value) {
      return {
        condition: "NOT_CONTAINS",
        values: [value]
      };
    }
    function equalTo(value) {
      return {
        condition: "EQUAL_TO",
        values: [value]
      };
    }
    function notEqualTo(value) {
      return {
        condition: "NOT_EQUAL_TO",
        values: [value]
      };
    }
    exports2.WhereConditions = {
      beginsWith,
      between,
      equalTo,
      greaterThan,
      greaterThanEqualTo,
      lessThan,
      lessThanEqualTo
    };
    exports2.FilterConditions = {
      beginsWith,
      between,
      contains,
      notContains,
      equalTo,
      notEqualTo,
      exists,
      notExists,
      greaterThan,
      greaterThanEqualTo,
      lessThan,
      lessThanEqualTo
    };
  }
});

// node_modules/@forge/kvs/out/index.js
var require_out2 = __commonJS({
  "node_modules/@forge/kvs/out/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.kvs = exports2.Filter = exports2.WhereConditions = exports2.FilterConditions = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var kvs_1 = require_kvs();
    var storage_api_1 = require_storage_api();
    function getFetchClient() {
      const runtime = global.__forge_runtime__;
      if (runtime?.kvs?.url && runtime?.kvs?.host) {
        const { proxy, kvs: kvs3, tracing } = runtime;
        return async function(path, options) {
          return await global.__forge_fetch__({ type: "kvs" }, path, {
            ...options,
            headers: {
              ...options?.headers,
              Authorization: `Bearer ${proxy.token}`,
              Host: kvs3?.host,
              "x-b3-traceid": tracing.traceId,
              "x-b3-spanid": tracing.spanId
            }
          });
        };
      }
      return async function(path, options) {
        return await global.__forge_fetch__({
          type: "kvs",
          provider: "app",
          remote: "kvs"
        }, path, options);
      };
    }
    var storageApi = new storage_api_1.StorageApi(getFetchClient());
    var kvs2 = new kvs_1.KvsImpl(storageApi);
    exports2.kvs = kvs2;
    var conditions_1 = require_conditions();
    Object.defineProperty(exports2, "FilterConditions", { enumerable: true, get: function() {
      return conditions_1.FilterConditions;
    } });
    Object.defineProperty(exports2, "WhereConditions", { enumerable: true, get: function() {
      return conditions_1.WhereConditions;
    } });
    var entity_query_1 = require_entity_query();
    Object.defineProperty(exports2, "Filter", { enumerable: true, get: function() {
      return entity_query_1.FilterBuilder;
    } });
    tslib_1.__exportStar(require_errors(), exports2);
    tslib_1.__exportStar(require_types(), exports2);
    exports2.default = kvs2;
  }
});

// node_modules/@forge/api/out/api/errors.js
var require_errors2 = __commonJS({
  "node_modules/@forge/api/out/api/errors.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ApiNotReadyError = exports2.SendEmailError = exports2.ProxyRequestError = exports2.InvalidContainerServiceError = exports2.InvalidRemoteError = exports2.NeedsAuthenticationError = exports2.InvalidWorkspaceRequestedError = exports2.RequestProductNotAllowedError = exports2.ProductEndpointNotAllowedError = exports2.ExternalEndpointNotAllowedError = exports2.NotAllowedError = exports2.FetchError = exports2.HttpError = exports2.API_NOT_READY_ERR = exports2.SEND_EMAIL_ERR = exports2.PROXY_ERR = exports2.INVALID_CONTAINER_SERVICE_ERR = exports2.INVALID_REMOTE_ERR = exports2.NEEDS_AUTHENTICATION_ERR = exports2.FUNCTION_FETCH_ERR = exports2.REQUEST_EGRESS_ALLOWLIST_ERR = exports2.FUNCTION_ERR = void 0;
    exports2.isForgePlatformError = isForgePlatformError;
    exports2.isHostedCodeError = isHostedCodeError;
    exports2.isExpectedError = isExpectedError;
    exports2.FUNCTION_ERR = "FUNCTION_ERR";
    exports2.REQUEST_EGRESS_ALLOWLIST_ERR = "REQUEST_EGRESS_ALLOWLIST_ERR";
    exports2.FUNCTION_FETCH_ERR = "FUNCTION_FETCH_ERR";
    exports2.NEEDS_AUTHENTICATION_ERR = "NEEDS_AUTHENTICATION_ERR";
    exports2.INVALID_REMOTE_ERR = "INVALID_REMOTE_ERR";
    exports2.INVALID_CONTAINER_SERVICE_ERR = "INVALID_CONTAINER_SERVICE_ERR";
    exports2.PROXY_ERR = "PROXY_ERR";
    exports2.SEND_EMAIL_ERR = "SEND_EMAIL_ERR";
    exports2.API_NOT_READY_ERR = "API_NOT_READY_ERR";
    function isForgePlatformError(err) {
      return [
        exports2.REQUEST_EGRESS_ALLOWLIST_ERR,
        exports2.FUNCTION_FETCH_ERR,
        exports2.NEEDS_AUTHENTICATION_ERR,
        exports2.PROXY_ERR,
        exports2.SEND_EMAIL_ERR,
        exports2.API_NOT_READY_ERR
      ].includes(err.name);
    }
    function isHostedCodeError(err) {
      return [
        exports2.FUNCTION_ERR,
        exports2.REQUEST_EGRESS_ALLOWLIST_ERR,
        exports2.FUNCTION_FETCH_ERR,
        exports2.NEEDS_AUTHENTICATION_ERR,
        exports2.SEND_EMAIL_ERR
      ].includes(typeof err === "string" ? err : err.name);
    }
    function isExpectedError(err) {
      return err.name === exports2.NEEDS_AUTHENTICATION_ERR && !!err.options?.isExpectedError;
    }
    var HttpError = class extends Error {
      status;
      constructor(message) {
        super(message);
      }
    };
    exports2.HttpError = HttpError;
    var FetchError = class extends Error {
      constructor(cause) {
        super(cause);
        this.stack = void 0;
        this.name = exports2.FUNCTION_FETCH_ERR;
      }
    };
    exports2.FetchError = FetchError;
    var NotAllowedError = class extends HttpError {
      constructor(message) {
        super(message);
        this.stack = void 0;
        this.name = exports2.REQUEST_EGRESS_ALLOWLIST_ERR;
        this.status = 403;
      }
    };
    exports2.NotAllowedError = NotAllowedError;
    var ExternalEndpointNotAllowedError = class extends NotAllowedError {
      constructor(failedURL) {
        super(`URL not included in the external fetch backend permissions: ${failedURL}. Visit go.atlassian.com/forge-egress for more information.`);
      }
    };
    exports2.ExternalEndpointNotAllowedError = ExternalEndpointNotAllowedError;
    var ProductEndpointNotAllowedError = class extends NotAllowedError {
      constructor(failedURL) {
        super(`URL not allowed: ${failedURL}.`);
      }
    };
    exports2.ProductEndpointNotAllowedError = ProductEndpointNotAllowedError;
    var RequestProductNotAllowedError = class extends NotAllowedError {
      constructor(requestedProduct, invocationProduct) {
        super(`Request ${requestedProduct} is not allowed from ${invocationProduct} context.`);
      }
    };
    exports2.RequestProductNotAllowedError = RequestProductNotAllowedError;
    var InvalidWorkspaceRequestedError = class extends NotAllowedError {
      constructor(failedURL) {
        super(`Invalid workspace requested in URL: ${failedURL}.`);
      }
    };
    exports2.InvalidWorkspaceRequestedError = InvalidWorkspaceRequestedError;
    var NeedsAuthenticationError = class extends HttpError {
      serviceKey;
      options;
      constructor(error, serviceKey, options) {
        super(error);
        this.serviceKey = serviceKey;
        this.options = options;
        this.stack = void 0;
        this.name = exports2.NEEDS_AUTHENTICATION_ERR;
        this.status = 401;
      }
    };
    exports2.NeedsAuthenticationError = NeedsAuthenticationError;
    var InvalidRemoteError = class extends HttpError {
      remoteKey;
      constructor(error, remoteKey) {
        super(error);
        this.remoteKey = remoteKey;
        this.name = exports2.INVALID_REMOTE_ERR;
        this.status = 400;
      }
    };
    exports2.InvalidRemoteError = InvalidRemoteError;
    var InvalidContainerServiceError = class extends HttpError {
      serviceKey;
      constructor(error, serviceKey) {
        super(error);
        this.serviceKey = serviceKey;
        this.name = exports2.INVALID_CONTAINER_SERVICE_ERR;
        this.status = 400;
      }
    };
    exports2.InvalidContainerServiceError = InvalidContainerServiceError;
    var ProxyRequestError = class extends HttpError {
      status;
      errorCode;
      constructor(status, errorCode) {
        super(`Forge platform failed to process runtime HTTP request - ${status} - ${errorCode}`);
        this.status = status;
        this.errorCode = errorCode;
        this.name = exports2.PROXY_ERR;
      }
    };
    exports2.ProxyRequestError = ProxyRequestError;
    var SendEmailError = class extends HttpError {
      status;
      errorCode;
      code;
      responseCode;
      command;
      constructor(status, errorCode, code, responseCode, command) {
        super(`Failed to send email with error code: ${errorCode}`);
        this.status = status;
        this.errorCode = errorCode;
        this.code = code;
        this.responseCode = responseCode;
        this.command = command;
        this.name = exports2.SEND_EMAIL_ERR;
      }
    };
    exports2.SendEmailError = SendEmailError;
    var ApiNotReadyError = class extends Error {
      constructor(message = "Forge API currently not available") {
        super(message);
        this.name = exports2.API_NOT_READY_ERR;
      }
    };
    exports2.ApiNotReadyError = ApiNotReadyError;
  }
});

// node_modules/@forge/api/out/safeUrl.js
var require_safeUrl = __commonJS({
  "node_modules/@forge/api/out/safeUrl.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.isRoute = isRoute;
    exports2.routeFromAbsolute = routeFromAbsolute;
    exports2.route = route2;
    exports2.requireSafeUrl = requireSafeUrl;
    exports2.assumeTrustedRoute = assumeTrustedRoute;
    var ReadonlyRoute = class {
      value_;
      constructor(value_) {
        this.value_ = value_;
      }
      set value(_) {
        throw new Error("modification of a Route is not allowed");
      }
      get value() {
        return this.value_;
      }
    };
    function isRoute(x) {
      return x instanceof ReadonlyRoute;
    }
    function routeFromAbsolute(absolutePath) {
      const absoluteURL = new URL(absolutePath);
      return assumeTrustedRoute(`${absoluteURL.pathname}${absoluteURL.search}`);
    }
    var DOUBLE_DOT = ["..", ".%2e", "%2e.", "%2e%2e", ".%2E", "%2E.", "%2E%2e"];
    var DIRECTORY_PATH = ["/", "\\"];
    var ENDS_PATH = ["?", "#"];
    function containsOneOf(needles, haystack) {
      return needles.some((needle) => haystack.includes(needle));
    }
    function escapeParameter(parameter, mode) {
      switch (mode) {
        case "path":
          if (isRoute(parameter)) {
            return parameter.value;
          }
          parameter = String(parameter);
          if (containsOneOf(DOUBLE_DOT, parameter) || containsOneOf(ENDS_PATH, parameter) || containsOneOf(DIRECTORY_PATH, parameter)) {
            throw new Error("Disallowing path manipulation attempt. For more information see: https://go.atlassian.com/product-fetch-api-route");
          }
          return parameter;
        case "query":
          if (isRoute(parameter)) {
            return encodeURIComponent(parameter.value);
          } else if (parameter instanceof URLSearchParams) {
            return parameter.toString();
          } else {
            return encodeURIComponent(parameter);
          }
      }
    }
    function route2(template, ...parameters) {
      let mode = "path";
      let result = "";
      for (let i = 0; i < template.length; i++) {
        const templateFragment = template[i];
        if (containsOneOf(ENDS_PATH, templateFragment)) {
          mode = "query";
        }
        result += templateFragment;
        if (i >= parameters.length) {
          break;
        }
        result += escapeParameter(parameters[i], mode);
      }
      return new ReadonlyRoute(result);
    }
    function requireSafeUrl(url) {
      if (url instanceof ReadonlyRoute) {
        return url;
      }
      throw new Error(`You must create your route using the 'route' export from '@forge/api'.
See https://go.atlassian.com/forge-fetch-route for more information.`);
    }
    function assumeTrustedRoute(route3) {
      return new ReadonlyRoute(route3);
    }
  }
});

// node_modules/@forge/api/out/api/ari.js
var require_ari = __commonJS({
  "node_modules/@forge/api/out/api/ari.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getInstallationAri = exports2.getEnvironmentAri = exports2.getAppAri = void 0;
    var getAppAri = (appId) => ({
      appId,
      toString: () => `ari:cloud:ecosystem::app/${appId}`,
      toJSON: () => `ari:cloud:ecosystem::app/${appId}`
    });
    exports2.getAppAri = getAppAri;
    var getEnvironmentAri = (appId, environmentId) => ({
      environmentId,
      toString: () => `ari:cloud:ecosystem::environment/${appId}/${environmentId}`,
      toJSON: () => `ari:cloud:ecosystem::environment/${appId}/${environmentId}`
    });
    exports2.getEnvironmentAri = getEnvironmentAri;
    var getInstallationAri = (installationId) => ({
      installationId,
      toString: () => `ari:cloud:ecosystem::installation/${installationId}`,
      toJSON: () => `ari:cloud:ecosystem::installation/${installationId}`
    });
    exports2.getInstallationAri = getInstallationAri;
  }
});

// node_modules/@forge/api/out/api/runtime.js
var require_runtime = __commonJS({
  "node_modules/@forge/api/out/api/runtime.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.MissingPermissions = exports2.PermissionRequirements = exports2.RuntimePermissions = exports2.Permissions = void 0;
    exports2.__getRuntime = __getRuntime;
    exports2.getAppContext = getAppContext;
    exports2.wrapInMetrics = wrapInMetrics;
    exports2.bindInvocationContext = bindInvocationContext;
    var errors_1 = require_errors2();
    var ari_1 = require_ari();
    var extractUrlString = (item) => {
      if (typeof item === "string") {
        return item;
      } else if ("address" in item) {
        return item.address;
      } else {
        return item.remote;
      }
    };
    var formatScopesSection = (scopes) => {
      if (scopes && Array.isArray(scopes) && scopes.length > 0) {
        return `Scopes: ${scopes.join(", ")}`;
      }
      return null;
    };
    var formatExternalSection = (external) => {
      if (!external) {
        return null;
      }
      const externalParts = [];
      Object.keys(external).forEach((type) => {
        if (type === "fetch") {
          const fetchParts = getFetchPermissions(external.fetch);
          externalParts.push(...fetchParts);
        } else {
          const externalUrls = external[type];
          if (externalUrls && Array.isArray(externalUrls) && externalUrls.length > 0) {
            const capitalizedType = String(type).charAt(0).toUpperCase() + String(type).slice(1);
            const urlList = externalUrls.map(extractUrlString).join(", ");
            externalParts.push(`${capitalizedType}: ${urlList}`);
          }
        }
      });
      return externalParts.length > 0 ? `External: ${externalParts.join("; ")}` : null;
    };
    var getFetchPermissions = (fetch2) => {
      if (!fetch2) {
        return [];
      }
      const fetchParts = [];
      Object.keys(fetch2).forEach((fetchType) => {
        const urls = fetch2[fetchType];
        if (urls && urls.length > 0) {
          const urlList = urls.map(extractUrlString).join(", ");
          const capitalizedType = String(fetchType).charAt(0).toUpperCase() + String(fetchType).slice(1);
          fetchParts.push(`Fetch ${capitalizedType}: ${urlList}`);
        }
      });
      return fetchParts;
    };
    var Permissions = class {
      format() {
        const parts = [];
        const scopesSection = formatScopesSection(this.scopes);
        if (scopesSection) {
          parts.push(scopesSection);
        }
        const externalSection = formatExternalSection(this.external);
        if (externalSection) {
          parts.push(externalSection);
        }
        return parts.length > 0 ? parts.join("; ") : "No permissions specified";
      }
    };
    exports2.Permissions = Permissions;
    var RuntimePermissions = class extends Permissions {
      scopes;
      external;
      constructor(scopes, external) {
        super();
        this.scopes = scopes;
        this.external = external;
      }
    };
    exports2.RuntimePermissions = RuntimePermissions;
    var PermissionRequirements = class extends Permissions {
      scopes;
      external;
      constructor(scopes, external) {
        super();
        this.scopes = scopes;
        this.external = external;
      }
    };
    exports2.PermissionRequirements = PermissionRequirements;
    var MissingPermissions = class extends Permissions {
      scopes;
      external;
      constructor(scopes, external) {
        super();
        this.scopes = scopes;
        this.external = external;
      }
    };
    exports2.MissingPermissions = MissingPermissions;
    function __getRuntime() {
      const runtime = global.__forge_runtime__;
      if (!runtime) {
        throw new Error("Forge runtime not found.");
      }
      return runtime;
    }
    function getAppContext() {
      const runtime = __getRuntime();
      const { appId, appVersion, environmentId, environmentType, invocationId, installationId, moduleKey, license, installation, permissions } = runtime.appContext;
      const invocationRemainingTimeInMillis = runtime.lambdaContext.getRemainingTimeInMillis ?? (() => {
        throw new Error("Lambda remaining time is not available. If tunnelling, update Forge CLI to the latest version.");
      });
      return {
        appAri: (0, ari_1.getAppAri)(appId),
        appVersion,
        environmentAri: (0, ari_1.getEnvironmentAri)(appId, environmentId),
        environmentType,
        installationAri: (0, ari_1.getInstallationAri)(installationId),
        invocationId,
        invocationRemainingTimeInMillis,
        moduleKey,
        license,
        installation,
        permissions: new RuntimePermissions(permissions?.scopes || [], permissions?.external || {})
      };
    }
    function wrapInMetrics(name, fn) {
      return async (...args) => {
        const { metrics } = __getRuntime();
        metrics.counter(name).incr();
        const timer = metrics.timing(name).measure();
        let success = true;
        try {
          return await fn(...args);
        } catch (e) {
          const undiciError = global.__forge_undici_error__;
          if (e instanceof errors_1.ProxyRequestError || undiciError && typeof undiciError === "function" && e instanceof undiciError) {
            success = false;
          }
          throw e;
        } finally {
          timer.stop({ success: success.toString() });
        }
      };
    }
    function bindInvocationContext(fn) {
      const AsyncLocalStorage = require("async_hooks").AsyncLocalStorage;
      return AsyncLocalStorage.bind(fn);
    }
  }
});

// node_modules/@forge/api/out/api/fetch.js
var require_fetch = __commonJS({
  "node_modules/@forge/api/out/api/fetch.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.__requestAtlassianAsUser = exports2.__requestAtlassianAsApp = exports2.wrapRequestConnectedData = exports2.wrapRequestTeamworkGraph = exports2.wrapRequestGraph = exports2.handleProxyResponseErrors = exports2.getForgeProxyError = void 0;
    exports2.__fetchProduct = __fetchProduct;
    exports2.fetchRemote = fetchRemote;
    exports2.getFetchAPI = getFetchAPI;
    var safeUrl_1 = require_safeUrl();
    var errors_1 = require_errors2();
    var runtime_1 = require_runtime();
    async function wrapInMetrics(options, cb) {
      const metrics = (0, runtime_1.__getRuntime)().metrics;
      metrics.counter(options.name, options.tags).incr();
      const timer = metrics.timing(options.name, options.tags).measure();
      try {
        return await cb();
      } finally {
        timer.stop();
      }
    }
    function __fetchProduct(args) {
      return async (path, init) => {
        const response = await global.__forge_fetch__({
          type: args.type,
          provider: args.provider,
          accountId: args.accountId,
          ...args.remote ? { remote: args.remote } : {},
          ...args.contextAri ? { contextAri: args.contextAri } : {}
        }, path, init);
        (0, exports2.handleProxyResponseErrors)(response);
        return response;
      };
    }
    function fetchRemote(args) {
      return async (path, init) => {
        const response = await global.__forge_fetch__({
          type: "tpp",
          provider: args.provider,
          remote: args.remote,
          accountId: args.account
        }, path, init);
        (0, exports2.handleProxyResponseErrors)(response);
        return response;
      };
    }
    function getDefaultRemote(provider) {
      const externalAuthProvider = findExternalAuthProviderConfigOrThrow(provider);
      if (!externalAuthProvider.remotes.length) {
        throw new Error(`Missing remote config for provider ${provider}`);
      }
      return externalAuthProvider.remotes[0].key;
    }
    function findExternalAuthProviderConfigOrThrow(provider) {
      const { externalAuth } = (0, runtime_1.__getRuntime)();
      const externalAuthProvider = externalAuth?.find((externalAuthMetaData) => {
        return externalAuthMetaData.service === provider;
      });
      if (!externalAuthProvider) {
        throw new Error(`Bad provider or missing config for provider ${provider}`);
      }
      return externalAuthProvider;
    }
    var ATLASSIAN_TOKEN_SERVICE_KEY = "atlassian-token-service-key";
    var getForgeProxyError = (response) => response.headers.get("forge-proxy-error");
    exports2.getForgeProxyError = getForgeProxyError;
    var handleProxyResponseErrors = (response) => {
      const errorReason = (0, exports2.getForgeProxyError)(response);
      if (errorReason) {
        if (errorReason === "NEEDS_AUTHENTICATION_ERR") {
          throw new errors_1.NeedsAuthenticationError("Authentication Required", ATLASSIAN_TOKEN_SERVICE_KEY);
        }
        throw new errors_1.ProxyRequestError(response.status, errorReason);
      }
    };
    exports2.handleProxyResponseErrors = handleProxyResponseErrors;
    function lazyThrowNeedsAuthenticationError(serviceKey) {
      return async (scopes) => wrapInMetrics({ name: "api.asUser.withProvider.requestCredentials", tags: { passingScopes: String(!!scopes) } }, async () => {
        throw new errors_1.NeedsAuthenticationError("Authentication Required", serviceKey, { scopes, isExpectedError: true });
      });
    }
    function buildExternalAuthAccountsInfo(provider, remote) {
      const { accounts } = findExternalAuthProviderConfigOrThrow(provider);
      const buildAccountModel = (account) => {
        const { externalAccountId: id, ...rest } = account;
        return { ...rest, id };
      };
      const buildExternalAuthAccountMethods = (account, outboundAuthAccountId) => ({
        hasCredentials: async (scopes) => wrapInMetrics({ name: "api.asUser.withProvider.hasCredentials", tags: { passingScopes: String(!!scopes) } }, async () => !scopes || scopes.every((scope) => account.scopes.includes(scope))),
        requestCredentials: lazyThrowNeedsAuthenticationError(provider),
        getAccount: async () => wrapInMetrics({ name: "api.asUser.withProvider.getAccount" }, async () => account),
        fetch: wrapWithRouteUnwrapper(fetchRemote({ provider, remote: remote ?? getDefaultRemote(provider), account: outboundAuthAccountId }))
      });
      return accounts.map((account) => {
        const authAccount = buildAccountModel(account);
        return {
          account: authAccount,
          methods: buildExternalAuthAccountMethods(authAccount, account.id)
        };
      });
    }
    var throwNotImplementedError = () => {
      throw new Error("not implemented");
    };
    var withProvider = (provider, remote) => {
      const accountsInfo = buildExternalAuthAccountsInfo(provider, remote);
      const defaultAccountInfo = accountsInfo.length ? accountsInfo[0] : void 0;
      const lazyThrowNoValidCredentialsError = () => {
        return (url) => {
          throw new Error(`Fetch failed for ${remote ? `remote '${remote}', ` : ""}provider '${provider}', path '${url}' no credentials previously requested`);
        };
      };
      return {
        hasCredentials: async (scopes) => {
          return defaultAccountInfo ? await defaultAccountInfo.methods.hasCredentials(scopes) : await wrapInMetrics({ name: "api.asUser.withProvider.hasCredentials", tags: { passingScopes: String(!!scopes) } }, async () => false);
        },
        getAccount: async () => wrapInMetrics({ name: "api.asUser.withProvider.getAccount" }, async () => {
          return defaultAccountInfo ? defaultAccountInfo.account : void 0;
        }),
        requestCredentials: lazyThrowNeedsAuthenticationError(provider),
        listCredentials: throwNotImplementedError,
        listAccounts: async () => wrapInMetrics({ name: "api.asUser.withProvider.listAccounts" }, async () => {
          return accountsInfo.map(({ account }) => account);
        }),
        asAccount: (externalAccountId) => {
          const accountInfo = accountsInfo.find(({ account }) => account.id === externalAccountId);
          if (!accountInfo) {
            throw new Error(`No account with ID ${externalAccountId} found for provider ${provider}`);
          }
          return accountInfo.methods;
        },
        fetch: defaultAccountInfo ? defaultAccountInfo.methods.fetch : lazyThrowNoValidCredentialsError()
      };
    };
    var withContext = (provider, accountId) => (contextAri) => {
      const requestProductFn = wrapRequestProduct(__fetchProduct({ provider, contextAri, type: "fpp", accountId }));
      return {
        requestJira: requestProductFn,
        requestConfluence: requestProductFn,
        requestBitbucket: requestProductFn
      };
    };
    var wrapWithRouteUnwrapper = (fetch2) => (path, init) => {
      const stringPath = (0, safeUrl_1.isRoute)(path) ? path.value : path;
      return fetch2(stringPath, init);
    };
    var wrapRequestProduct = (requestProduct) => (path, init) => {
      const safeUrl = (0, safeUrl_1.requireSafeUrl)(path);
      return requestProduct(safeUrl.value, init);
    };
    var wrapRequestGraph = (requestGraphApi) => (query, variables, headers = {}) => requestGraphApi("/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        ...variables ? { variables } : {}
      })
    });
    exports2.wrapRequestGraph = wrapRequestGraph;
    var wrapRequestTeamworkGraph = (requestGraphApi) => (query, variables, operationName, extensions, headers = {}) => requestGraphApi("/graphql/twg", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        ...variables ? { variables } : {},
        ...operationName ? { operationName } : {},
        ...extensions ? { extensions } : {}
      })
    });
    exports2.wrapRequestTeamworkGraph = wrapRequestTeamworkGraph;
    var wrapRequestConnectedData = (fetch2) => (path, init) => {
      const safeUrl = (0, safeUrl_1.requireSafeUrl)(path);
      return fetch2(`/connected-data/${safeUrl.value.replace(/^\/+/, "")}`, init);
    };
    exports2.wrapRequestConnectedData = wrapRequestConnectedData;
    function getFetchAPI() {
      if (global.fetch === void 0) {
        global.fetch = async () => {
          throw new Error("The fetch function is not available");
        };
      }
      return {
        fetch: wrapWithRouteUnwrapper(fetch),
        requestJira: wrapRequestProduct(__fetchProduct({ provider: "none", remote: "jira", type: "fpp" })),
        requestConfluence: wrapRequestProduct(__fetchProduct({ provider: "none", remote: "confluence", type: "fpp" })),
        requestBitbucket: wrapRequestProduct(__fetchProduct({ provider: "none", remote: "bitbucket", type: "fpp" })),
        asUser: (userId) => ({
          requestJira: wrapRequestProduct(__fetchProduct({ provider: "user", remote: "jira", type: "fpp", accountId: userId })),
          requestConfluence: wrapRequestProduct(__fetchProduct({ provider: "user", remote: "confluence", type: "fpp", accountId: userId })),
          requestBitbucket: wrapRequestProduct(__fetchProduct({ provider: "user", remote: "bitbucket", type: "fpp", accountId: userId })),
          requestGraph: (0, exports2.wrapRequestGraph)(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp", accountId: userId })),
          requestTeamworkGraph: (0, exports2.wrapRequestTeamworkGraph)(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp", accountId: userId })),
          requestConnectedData: (0, exports2.wrapRequestConnectedData)(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp" })),
          requestAtlassian: wrapRequestProduct(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp", accountId: userId })),
          withProvider,
          withContext: withContext("user", userId)
        }),
        asApp: () => ({
          requestJira: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "jira", type: "fpp" })),
          requestConfluence: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "confluence", type: "fpp" })),
          requestBitbucket: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "bitbucket", type: "fpp" })),
          requestGraph: (0, exports2.wrapRequestGraph)(__fetchProduct({ provider: "app", remote: "stargate", type: "fpp" })),
          requestConnectedData: (0, exports2.wrapRequestConnectedData)(__fetchProduct({ provider: "app", remote: "stargate", type: "fpp" })),
          requestAtlassian: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "stargate", type: "fpp" })),
          withContext: withContext("app")
        })
      };
    }
    function getRequestStargate(provider) {
      if (provider !== "app" && provider !== "user") {
        throw new Error(`Unsupported provider: ${provider}`);
      }
      return __fetchProduct({ provider, remote: "stargate", type: "fpp" });
    }
    exports2.__requestAtlassianAsApp = getRequestStargate("app");
    exports2.__requestAtlassianAsUser = getRequestStargate("user");
  }
});

// node_modules/@forge/api/out/api/endpoint.js
var require_endpoint = __commonJS({
  "node_modules/@forge/api/out/api/endpoint.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.invokeRemote = invokeRemote;
    exports2.invokeService = invokeService;
    var errors_1 = require_errors2();
    var fetch_1 = require_fetch();
    var InvokeType;
    (function(InvokeType2) {
      InvokeType2["REMOTE"] = "Remote";
      InvokeType2["CONTAINER"] = "Service";
    })(InvokeType || (InvokeType = {}));
    async function invokeRemote(remoteKey, options) {
      return invokeEndpoint(remoteKey, options, InvokeType.REMOTE);
    }
    async function invokeService(serviceKey, options) {
      return invokeEndpoint(serviceKey, options, InvokeType.CONTAINER);
    }
    async function invokeEndpoint(key, options, type) {
      const { path, ...fetchOptions } = options;
      if (!key) {
        throw new Error(`Missing ${type.toLowerCase()} key provided to invoke${type}`);
      }
      if (!path) {
        throw new Error(`Missing or empty path provided to invoke${type}`);
      }
      const response = await global.__forge_fetch__(constructInvokePayload(key, type), path, fetchOptions);
      handleResponseErrors(response, key);
      return response;
    }
    function constructInvokePayload(key, type) {
      switch (type) {
        case InvokeType.REMOTE:
          return {
            type: "frc",
            remote: key
          };
        case InvokeType.CONTAINER:
          return {
            type: "fcc",
            service: key
          };
      }
    }
    function handleResponseErrors(response, key) {
      const forgeProxyError = (0, fetch_1.getForgeProxyError)(response);
      if (forgeProxyError === "INVALID_SERVICE_KEY") {
        throw new errors_1.InvalidContainerServiceError(`Invalid service key provided: "${key}"`, key);
      } else if (forgeProxyError === "INVALID_REMOTE") {
        throw new errors_1.InvalidRemoteError(`Invalid remote key provided: "${key}"`, key);
      }
      (0, fetch_1.handleProxyResponseErrors)(response);
    }
  }
});

// node_modules/@forge/auth/out/api.js
var require_api = __commonJS({
  "node_modules/@forge/auth/out/api.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createApiMethods = void 0;
    var fromEntries = (array) => {
      return array.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    };
    var createApiMethods = (methodToPermissionMap, permissionCheckFactory) => {
      const apiMethodEntries = Object.entries(methodToPermissionMap).map(([methodName, permission]) => [methodName, permissionCheckFactory(permission)]);
      return fromEntries(apiMethodEntries);
    };
    exports2.createApiMethods = createApiMethods;
  }
});

// node_modules/@forge/auth/out/confluence/permissions.js
var require_permissions = __commonJS({
  "node_modules/@forge/auth/out/confluence/permissions.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var API_PERMISSIONS_MAP = {
      canRead: "read",
      canUpdate: "update",
      canDelete: "delete"
    };
    exports2.default = API_PERMISSIONS_MAP;
  }
});

// node_modules/@forge/auth/out/confluence/index.js
var require_confluence = __commonJS({
  "node_modules/@forge/auth/out/confluence/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.authorizeConfluenceWithFetch = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var api_1 = require_api();
    var permissions_1 = tslib_1.__importDefault(require_permissions());
    var checkConfluencePermissions = async (requestConfluence, accountId, contentId, permission) => {
      const res = await requestConfluence(`/rest/api/content/${contentId}/permission/check`, {
        method: "post",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: {
            type: "user",
            identifier: accountId
          },
          operation: permission
        })
      });
      return res;
    };
    var getPermissionsCheckFactory = (requestConfluence, accountId, contentId) => (permission) => {
      return async () => {
        const res = await checkConfluencePermissions(requestConfluence, accountId, contentId, permission);
        return Boolean(res?.hasPermission);
      };
    };
    var authorizeConfluenceWithFetch = (requestConfluence, accountId) => {
      return {
        onConfluenceContent: (contentId) => (0, api_1.createApiMethods)(permissions_1.default, getPermissionsCheckFactory(requestConfluence, accountId, contentId))
      };
    };
    exports2.authorizeConfluenceWithFetch = authorizeConfluenceWithFetch;
  }
});

// node_modules/@forge/auth/out/jira/permissions.js
var require_permissions2 = __commonJS({
  "node_modules/@forge/auth/out/jira/permissions.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.API_PROJECTS_PERMISSIONS_MAP = exports2.API_ISSUES_PERMISSIONS_MAP = void 0;
    var API_ISSUES_PERMISSIONS_MAP = {
      canAssign: "ASSIGN_ISSUES",
      canCreate: "CREATE_ISSUES",
      canEdit: "EDIT_ISSUES",
      canMove: "MOVE_ISSUES",
      canDelete: "DELETE_ISSUES",
      canAddComments: "ADD_COMMENTS",
      canEditAllComments: "EDIT_ALL_COMMENTS",
      canDeleteAllComments: "DELETE_ALL_COMMENTS",
      canCreateAttachments: "CREATE_ATTACHMENTS",
      canDeleteAllAttachments: "DELETE_ALL_ATTACHMENTS"
    };
    exports2.API_ISSUES_PERMISSIONS_MAP = API_ISSUES_PERMISSIONS_MAP;
    var API_PROJECTS_PERMISSIONS_MAP = {
      canAssignIssues: "ASSIGN_ISSUES",
      canCreateIssues: "CREATE_ISSUES",
      canEditIssues: "EDIT_ISSUES",
      canMoveIssues: "MOVE_ISSUES",
      canDeleteIssues: "DELETE_ISSUES",
      canAddComments: "ADD_COMMENTS",
      canEditAllComments: "EDIT_ALL_COMMENTS",
      canDeleteAllComments: "DELETE_ALL_COMMENTS",
      canCreateAttachments: "CREATE_ATTACHMENTS",
      canDeleteAllAttachments: "DELETE_ALL_ATTACHMENTS"
    };
    exports2.API_PROJECTS_PERMISSIONS_MAP = API_PROJECTS_PERMISSIONS_MAP;
  }
});

// node_modules/@forge/auth/out/jira/index.js
var require_jira = __commonJS({
  "node_modules/@forge/auth/out/jira/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.authorizeJiraWithFetch = void 0;
    var api_1 = require_api();
    var permissions_1 = require_permissions2();
    var arrayEquals = (a, b) => {
      return JSON.stringify(Array.from(a.map(String)).sort()) === JSON.stringify(Array.from(b.map(String)).sort());
    };
    var checkJiraPermissions = async (requestJira2, accountId, projectPermissions) => {
      const res = await requestJira2("/rest/api/3/permissions/check", {
        method: "post",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          projectPermissions
        })
      });
      return res;
    };
    var hasPermissionsForEntities = (projectPermissions, permission, type, entities) => {
      if (!entities || entities.length === 0)
        return true;
      const allowedEntities = projectPermissions.find((permissionResponse) => permissionResponse.permission === permission)?.[type];
      return !!allowedEntities && arrayEquals(allowedEntities, entities);
    };
    var getPermissionCheckFactory = (requestJira2, accountId, type, entities) => (permission) => {
      return async () => {
        const { projectPermissions } = await checkJiraPermissions(requestJira2, accountId, [
          {
            permissions: [permission],
            [type]: entities
          }
        ]);
        return hasPermissionsForEntities(projectPermissions, permission, type, entities);
      };
    };
    var toArray = (id) => Array.isArray(id) ? id : [id];
    var authorizeJiraWithFetch = (requestJira2, accountId) => {
      return {
        onJira: async (projectPermissionsInput) => {
          const result = await checkJiraPermissions(requestJira2, accountId, projectPermissionsInput);
          return result.projectPermissions || [];
        },
        onJiraProject: (projects) => (0, api_1.createApiMethods)(permissions_1.API_PROJECTS_PERMISSIONS_MAP, getPermissionCheckFactory(requestJira2, accountId, "projects", toArray(projects))),
        onJiraIssue: (issues) => (0, api_1.createApiMethods)(permissions_1.API_ISSUES_PERMISSIONS_MAP, getPermissionCheckFactory(requestJira2, accountId, "issues", toArray(issues)))
      };
    };
    exports2.authorizeJiraWithFetch = authorizeJiraWithFetch;
  }
});

// node_modules/@forge/auth/out/index.js
var require_out3 = __commonJS({
  "node_modules/@forge/auth/out/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.authorizeJiraWithFetch = exports2.authorizeConfluenceWithFetch = void 0;
    var confluence_1 = require_confluence();
    Object.defineProperty(exports2, "authorizeConfluenceWithFetch", { enumerable: true, get: function() {
      return confluence_1.authorizeConfluenceWithFetch;
    } });
    var jira_1 = require_jira();
    Object.defineProperty(exports2, "authorizeJiraWithFetch", { enumerable: true, get: function() {
      return jira_1.authorizeJiraWithFetch;
    } });
  }
});

// node_modules/@forge/api/out/authorization/index.js
var require_authorization = __commonJS({
  "node_modules/@forge/api/out/authorization/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.authorize = void 0;
    var auth_1 = require_out3();
    var __1 = require_out6();
    var authorize = () => {
      const accountId = (0, __1.__getRuntime)().aaid;
      if (!accountId) {
        throw new Error(`Couldn\u2019t find the accountId of the invoking user. This API can only be used inside user-invoked modules.`);
      }
      return {
        ...(0, auth_1.authorizeConfluenceWithFetch)(async (path, opts) => {
          const res = await (0, __1.asUser)().requestConfluence((0, __1.assumeTrustedRoute)(path), opts);
          return res.json();
        }, accountId),
        ...(0, auth_1.authorizeJiraWithFetch)(async (path, opts) => {
          const res = await (0, __1.asUser)().requestJira((0, __1.assumeTrustedRoute)(path), opts);
          return res.json();
        }, accountId)
      };
    };
    exports2.authorize = authorize;
  }
});

// node_modules/@forge/api/out/privacy/index.js
var require_privacy = __commonJS({
  "node_modules/@forge/api/out/privacy/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createReportPersonalData = exports2.LIMIT = exports2.URL = void 0;
    exports2.URL = "/app/report-accounts";
    exports2.LIMIT = 90;
    var createReportPersonalData = (requestAtlassian) => {
      return function fetchUpdates(accounts) {
        if (accounts.length === 0) {
          return Promise.resolve([]);
        }
        const request = requestAtlassian(exports2.URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accounts: accounts.slice(0, exports2.LIMIT) })
        }).then(async (resp) => {
          if (resp.status === 200) {
            return (await resp.json()).accounts;
          }
          if (resp.status === 204) {
            return [];
          }
          return Promise.reject(resp);
        });
        return Promise.all([request, fetchUpdates(accounts.slice(exports2.LIMIT))]).then(([first, second]) => first.concat(second));
      };
    };
    exports2.createReportPersonalData = createReportPersonalData;
  }
});

// node_modules/@forge/api/out/webTrigger.js
var require_webTrigger = __commonJS({
  "node_modules/@forge/api/out/webTrigger.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.webTrigger = void 0;
    var runtime_1 = require_runtime();
    var fetch_1 = require_fetch();
    var proxyGetWebTriggerURL = (0, runtime_1.wrapInMetrics)("api.getWebTriggerUrl", async (webTriggerModuleKey, forceCreate, secretKeyConfig) => {
      const runtime = (0, runtime_1.__getRuntime)();
      const input = {
        appId: runtime.appContext.appId,
        envId: runtime.appContext.environmentId,
        triggerKey: webTriggerModuleKey,
        contextId: runtime.contextAri,
        ...secretKeyConfig !== void 0 ? {
          secretKeyConfig: {
            key: secretKeyConfig.key,
            ...secretKeyConfig.noExpiry !== void 0 ? { noExpiry: secretKeyConfig.noExpiry } : {}
          }
        } : {}
      };
      const response = await (0, fetch_1.__requestAtlassianAsApp)("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation forge_app_createWebTriggerUrl($input: WebTriggerUrlInput!, $forceCreate: Boolean) {
              createWebTriggerUrl(input: $input, forceCreate: $forceCreate) {
                url
              }
            }
          `,
          variables: {
            input,
            forceCreate
          }
        })
      });
      if (!response.ok) {
        throw new Error(`Internal error occurred: Failed to get web trigger URL: ${response.statusText}.`);
      }
      const responseBody = await response.json();
      if (!responseBody?.data?.createWebTriggerUrl?.url) {
        throw new Error(`Internal error occurred: Failed to get web trigger URL.`);
      }
      return responseBody.data.createWebTriggerUrl.url;
    });
    var proxyDeleteWebTriggerURL = (0, runtime_1.wrapInMetrics)("api.deleteWebTriggerUrl", async (webTriggerUrl) => {
      const webTriggerUrlIdRegexGroupMatch = /\/(?:x1|public)\/([^\/\?\#]+)/;
      const matches = webTriggerUrl.match(webTriggerUrlIdRegexGroupMatch);
      if (!matches || matches.length < 2) {
        throw new Error("Internal error occurred: Failed to parse web trigger URL for ID");
      }
      const id = matches[1];
      const response = await (0, fetch_1.__requestAtlassianAsApp)("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation forge_app_deleteWebTriggerUrl($id: ID!) {
              deleteWebTriggerUrl(id: $id) {
                success
                message
              }
            }
          `,
          variables: {
            id
          }
        })
      });
      if (!response.ok) {
        throw new Error(`Internal error occurred: Failed to delete web trigger URL: ${response.statusText}.`);
      }
      const responseBody = await response.json();
      if (!responseBody?.data?.deleteWebTriggerUrl?.success) {
        const errorText = responseBody?.data?.deleteWebTriggerUrl?.message || "unknown error";
        throw new Error(`Internal error occurred: Failed to delete web trigger URL: ${errorText}`);
      }
    });
    var proxyQueryWebTriggerURLs = (0, runtime_1.wrapInMetrics)("api.queryWebTriggerUrls", async (moduleKey) => {
      const runtime = (0, runtime_1.__getRuntime)();
      const response = await (0, fetch_1.__requestAtlassianAsApp)("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query forge_app_webTriggerUrlsByAppContext($appId: ID!, $envId: ID!, $contextId: ID!) {
              webTriggerUrlsByAppContext(appId: $appId, envId: $envId, contextId: $contextId) {
                triggerKey
                url
              }
            }
          `,
          variables: {
            appId: runtime.appContext.appId,
            envId: runtime.appContext.environmentId,
            contextId: runtime.contextAri
          }
        })
      });
      if (!response.ok) {
        throw new Error(`Internal error occurred: Failed to get web trigger URLs: ${response.statusText}.`);
      }
      const responseBody = await response.json();
      if (!responseBody?.data?.webTriggerUrlsByAppContext) {
        throw new Error("Internal error occurred: No data from web trigger URLs query.");
      }
      let result = responseBody.data.webTriggerUrlsByAppContext;
      if (moduleKey) {
        result = result.filter((webTriggerResult) => webTriggerResult.triggerKey === moduleKey);
      }
      result = result.map((webTriggerResult) => ({
        moduleKey: webTriggerResult.triggerKey,
        url: webTriggerResult.url
      }));
      return result;
    });
    exports2.webTrigger = {
      getUrl: async (webTriggerModuleKey, optionsOrForceCreate) => {
        const forceCreate = typeof optionsOrForceCreate === "boolean" ? optionsOrForceCreate : optionsOrForceCreate?.forceCreate ?? false;
        const secretKeyConfig = typeof optionsOrForceCreate === "object" && optionsOrForceCreate !== null ? optionsOrForceCreate.secretKeyConfig : void 0;
        return proxyGetWebTriggerURL(webTriggerModuleKey, forceCreate, secretKeyConfig);
      },
      deleteUrl: async (webTriggerUrl) => proxyDeleteWebTriggerURL(webTriggerUrl),
      queryUrls: async (moduleKey) => proxyQueryWebTriggerURLs(moduleKey)
    };
  }
});

// node_modules/@forge/i18n/out/constants.js
var require_constants = __commonJS({
  "node_modules/@forge/i18n/out/constants.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FORGE_SUPPORTED_LOCALE_CODES = exports2.I18N_BUNDLE_FOLDER_NAME = exports2.I18N_INFO_FILE_NAME = void 0;
    exports2.I18N_INFO_FILE_NAME = "i18n-info.json";
    exports2.I18N_BUNDLE_FOLDER_NAME = "__LOCALES__";
    exports2.FORGE_SUPPORTED_LOCALE_CODES = [
      "zh-CN",
      "zh-TW",
      "cs-CZ",
      "da-DK",
      "nl-NL",
      "en-US",
      "en-GB",
      "et-EE",
      "fi-FI",
      "fr-FR",
      "de-DE",
      "hu-HU",
      "is-IS",
      "it-IT",
      "ja-JP",
      "ko-KR",
      "no-NO",
      "pl-PL",
      "pt-BR",
      "pt-PT",
      "ro-RO",
      "ru-RU",
      "sk-SK",
      "tr-TR",
      "es-ES",
      "sv-SE"
    ];
  }
});

// node_modules/@forge/i18n/out/translationsGetter.js
var require_translationsGetter = __commonJS({
  "node_modules/@forge/i18n/out/translationsGetter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TranslationsGetter = exports2.TranslationGetterError = void 0;
    var pushIfNotExists = (array, item) => {
      if (!array.includes(item)) {
        array.push(item);
      }
    };
    var TranslationGetterError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "TranslationGetterError";
      }
    };
    exports2.TranslationGetterError = TranslationGetterError;
    var TranslationsGetter = class {
      resourcesAccessor;
      i18nInfoConfig = null;
      translationResources = /* @__PURE__ */ new Map();
      constructor(resourcesAccessor) {
        this.resourcesAccessor = resourcesAccessor;
      }
      async getTranslations(locale, options = { fallback: true }) {
        const i18nInfoConfig = await this.getI18nInfoConfig();
        const { fallback } = options;
        if (!fallback) {
          let translationResource;
          if (i18nInfoConfig.locales.includes(locale)) {
            translationResource = await this.getTranslationResource(locale);
          }
          return {
            translations: translationResource ?? null,
            locale
          };
        }
        for (const targetLocale of this.getLocaleLookupOrder(locale, i18nInfoConfig)) {
          const translationResource = await this.getTranslationResource(targetLocale);
          if (translationResource) {
            return {
              translations: translationResource,
              locale: targetLocale
            };
          }
        }
        return {
          translations: null,
          locale
        };
      }
      async getTranslationsByLocaleLookupOrder(locale) {
        const i18nInfoConfig = await this.getI18nInfoConfig();
        const lookupOrder = this.getLocaleLookupOrder(locale, i18nInfoConfig);
        return await Promise.all(lookupOrder.map(async (targetLocale) => {
          const translationResource = await this.getTranslationResource(targetLocale);
          return {
            locale: targetLocale,
            translations: translationResource
          };
        }));
      }
      reset() {
        this.i18nInfoConfig = null;
        this.translationResources.clear();
      }
      async getTranslationResource(locale) {
        let resource = this.translationResources.get(locale);
        if (!resource) {
          try {
            resource = await this.resourcesAccessor.getTranslationResource(locale);
            this.translationResources.set(locale, resource);
          } catch (error) {
            if (error instanceof TranslationGetterError) {
              throw error;
            }
            throw new TranslationGetterError(`Failed to get translation resource for locale: ${locale}`);
          }
        }
        return resource;
      }
      async getI18nInfoConfig() {
        if (!this.i18nInfoConfig) {
          try {
            this.i18nInfoConfig = await this.resourcesAccessor.getI18nInfoConfig();
          } catch (error) {
            if (error instanceof TranslationGetterError) {
              throw error;
            }
            throw new TranslationGetterError("Failed to get i18n info config");
          }
        }
        return this.i18nInfoConfig;
      }
      getLocaleLookupOrder(locale, config) {
        const { locales, fallback } = config;
        const lookupOrder = [locale];
        const fallbackLocales = fallback[locale];
        if (fallbackLocales && Array.isArray(fallbackLocales) && fallbackLocales.length > 0) {
          lookupOrder.push(...fallbackLocales);
        }
        pushIfNotExists(lookupOrder, config.fallback.default);
        return lookupOrder.filter((locale2) => locales.includes(locale2));
      }
    };
    exports2.TranslationsGetter = TranslationsGetter;
  }
});

// node_modules/lodash/isArray.js
var require_isArray = __commonJS({
  "node_modules/lodash/isArray.js"(exports2, module2) {
    var isArray = Array.isArray;
    module2.exports = isArray;
  }
});

// node_modules/lodash/_freeGlobal.js
var require_freeGlobal = __commonJS({
  "node_modules/lodash/_freeGlobal.js"(exports2, module2) {
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    module2.exports = freeGlobal;
  }
});

// node_modules/lodash/_root.js
var require_root = __commonJS({
  "node_modules/lodash/_root.js"(exports2, module2) {
    var freeGlobal = require_freeGlobal();
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    module2.exports = root;
  }
});

// node_modules/lodash/_Symbol.js
var require_Symbol = __commonJS({
  "node_modules/lodash/_Symbol.js"(exports2, module2) {
    var root = require_root();
    var Symbol2 = root.Symbol;
    module2.exports = Symbol2;
  }
});

// node_modules/lodash/_getRawTag.js
var require_getRawTag = __commonJS({
  "node_modules/lodash/_getRawTag.js"(exports2, module2) {
    var Symbol2 = require_Symbol();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var nativeObjectToString = objectProto.toString;
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    function getRawTag(value) {
      var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
      try {
        value[symToStringTag] = void 0;
        var unmasked = true;
      } catch (e) {
      }
      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }
    module2.exports = getRawTag;
  }
});

// node_modules/lodash/_objectToString.js
var require_objectToString = __commonJS({
  "node_modules/lodash/_objectToString.js"(exports2, module2) {
    var objectProto = Object.prototype;
    var nativeObjectToString = objectProto.toString;
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    module2.exports = objectToString;
  }
});

// node_modules/lodash/_baseGetTag.js
var require_baseGetTag = __commonJS({
  "node_modules/lodash/_baseGetTag.js"(exports2, module2) {
    var Symbol2 = require_Symbol();
    var getRawTag = require_getRawTag();
    var objectToString = require_objectToString();
    var nullTag = "[object Null]";
    var undefinedTag = "[object Undefined]";
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    function baseGetTag(value) {
      if (value == null) {
        return value === void 0 ? undefinedTag : nullTag;
      }
      return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
    }
    module2.exports = baseGetTag;
  }
});

// node_modules/lodash/isObjectLike.js
var require_isObjectLike = __commonJS({
  "node_modules/lodash/isObjectLike.js"(exports2, module2) {
    function isObjectLike(value) {
      return value != null && typeof value == "object";
    }
    module2.exports = isObjectLike;
  }
});

// node_modules/lodash/isSymbol.js
var require_isSymbol = __commonJS({
  "node_modules/lodash/isSymbol.js"(exports2, module2) {
    var baseGetTag = require_baseGetTag();
    var isObjectLike = require_isObjectLike();
    var symbolTag = "[object Symbol]";
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
    }
    module2.exports = isSymbol;
  }
});

// node_modules/lodash/_isKey.js
var require_isKey = __commonJS({
  "node_modules/lodash/_isKey.js"(exports2, module2) {
    var isArray = require_isArray();
    var isSymbol = require_isSymbol();
    var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/;
    var reIsPlainProp = /^\w*$/;
    function isKey(value, object) {
      if (isArray(value)) {
        return false;
      }
      var type = typeof value;
      if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
        return true;
      }
      return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
    }
    module2.exports = isKey;
  }
});

// node_modules/lodash/isObject.js
var require_isObject = __commonJS({
  "node_modules/lodash/isObject.js"(exports2, module2) {
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    module2.exports = isObject;
  }
});

// node_modules/lodash/isFunction.js
var require_isFunction = __commonJS({
  "node_modules/lodash/isFunction.js"(exports2, module2) {
    var baseGetTag = require_baseGetTag();
    var isObject = require_isObject();
    var asyncTag = "[object AsyncFunction]";
    var funcTag = "[object Function]";
    var genTag = "[object GeneratorFunction]";
    var proxyTag = "[object Proxy]";
    function isFunction(value) {
      if (!isObject(value)) {
        return false;
      }
      var tag = baseGetTag(value);
      return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
    }
    module2.exports = isFunction;
  }
});

// node_modules/lodash/_coreJsData.js
var require_coreJsData = __commonJS({
  "node_modules/lodash/_coreJsData.js"(exports2, module2) {
    var root = require_root();
    var coreJsData = root["__core-js_shared__"];
    module2.exports = coreJsData;
  }
});

// node_modules/lodash/_isMasked.js
var require_isMasked = __commonJS({
  "node_modules/lodash/_isMasked.js"(exports2, module2) {
    var coreJsData = require_coreJsData();
    var maskSrcKey = (function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    })();
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    module2.exports = isMasked;
  }
});

// node_modules/lodash/_toSource.js
var require_toSource = __commonJS({
  "node_modules/lodash/_toSource.js"(exports2, module2) {
    var funcProto = Function.prototype;
    var funcToString = funcProto.toString;
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {
        }
        try {
          return func + "";
        } catch (e) {
        }
      }
      return "";
    }
    module2.exports = toSource;
  }
});

// node_modules/lodash/_baseIsNative.js
var require_baseIsNative = __commonJS({
  "node_modules/lodash/_baseIsNative.js"(exports2, module2) {
    var isFunction = require_isFunction();
    var isMasked = require_isMasked();
    var isObject = require_isObject();
    var toSource = require_toSource();
    var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
    var reIsHostCtor = /^\[object .+?Constructor\]$/;
    var funcProto = Function.prototype;
    var objectProto = Object.prototype;
    var funcToString = funcProto.toString;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var reIsNative = RegExp(
      "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    );
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }
    module2.exports = baseIsNative;
  }
});

// node_modules/lodash/_getValue.js
var require_getValue = __commonJS({
  "node_modules/lodash/_getValue.js"(exports2, module2) {
    function getValue(object, key) {
      return object == null ? void 0 : object[key];
    }
    module2.exports = getValue;
  }
});

// node_modules/lodash/_getNative.js
var require_getNative = __commonJS({
  "node_modules/lodash/_getNative.js"(exports2, module2) {
    var baseIsNative = require_baseIsNative();
    var getValue = require_getValue();
    function getNative(object, key) {
      var value = getValue(object, key);
      return baseIsNative(value) ? value : void 0;
    }
    module2.exports = getNative;
  }
});

// node_modules/lodash/_nativeCreate.js
var require_nativeCreate = __commonJS({
  "node_modules/lodash/_nativeCreate.js"(exports2, module2) {
    var getNative = require_getNative();
    var nativeCreate = getNative(Object, "create");
    module2.exports = nativeCreate;
  }
});

// node_modules/lodash/_hashClear.js
var require_hashClear = __commonJS({
  "node_modules/lodash/_hashClear.js"(exports2, module2) {
    var nativeCreate = require_nativeCreate();
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
      this.size = 0;
    }
    module2.exports = hashClear;
  }
});

// node_modules/lodash/_hashDelete.js
var require_hashDelete = __commonJS({
  "node_modules/lodash/_hashDelete.js"(exports2, module2) {
    function hashDelete(key) {
      var result = this.has(key) && delete this.__data__[key];
      this.size -= result ? 1 : 0;
      return result;
    }
    module2.exports = hashDelete;
  }
});

// node_modules/lodash/_hashGet.js
var require_hashGet = __commonJS({
  "node_modules/lodash/_hashGet.js"(exports2, module2) {
    var nativeCreate = require_nativeCreate();
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? void 0 : result;
      }
      return hasOwnProperty.call(data, key) ? data[key] : void 0;
    }
    module2.exports = hashGet;
  }
});

// node_modules/lodash/_hashHas.js
var require_hashHas = __commonJS({
  "node_modules/lodash/_hashHas.js"(exports2, module2) {
    var nativeCreate = require_nativeCreate();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
    }
    module2.exports = hashHas;
  }
});

// node_modules/lodash/_hashSet.js
var require_hashSet = __commonJS({
  "node_modules/lodash/_hashSet.js"(exports2, module2) {
    var nativeCreate = require_nativeCreate();
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    function hashSet(key, value) {
      var data = this.__data__;
      this.size += this.has(key) ? 0 : 1;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    module2.exports = hashSet;
  }
});

// node_modules/lodash/_Hash.js
var require_Hash = __commonJS({
  "node_modules/lodash/_Hash.js"(exports2, module2) {
    var hashClear = require_hashClear();
    var hashDelete = require_hashDelete();
    var hashGet = require_hashGet();
    var hashHas = require_hashHas();
    var hashSet = require_hashSet();
    function Hash(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    Hash.prototype.clear = hashClear;
    Hash.prototype["delete"] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;
    module2.exports = Hash;
  }
});

// node_modules/lodash/_listCacheClear.js
var require_listCacheClear = __commonJS({
  "node_modules/lodash/_listCacheClear.js"(exports2, module2) {
    function listCacheClear() {
      this.__data__ = [];
      this.size = 0;
    }
    module2.exports = listCacheClear;
  }
});

// node_modules/lodash/eq.js
var require_eq = __commonJS({
  "node_modules/lodash/eq.js"(exports2, module2) {
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    module2.exports = eq;
  }
});

// node_modules/lodash/_assocIndexOf.js
var require_assocIndexOf = __commonJS({
  "node_modules/lodash/_assocIndexOf.js"(exports2, module2) {
    var eq = require_eq();
    function assocIndexOf(array, key) {
      var length = array.length;
      while (length--) {
        if (eq(array[length][0], key)) {
          return length;
        }
      }
      return -1;
    }
    module2.exports = assocIndexOf;
  }
});

// node_modules/lodash/_listCacheDelete.js
var require_listCacheDelete = __commonJS({
  "node_modules/lodash/_listCacheDelete.js"(exports2, module2) {
    var assocIndexOf = require_assocIndexOf();
    var arrayProto = Array.prototype;
    var splice = arrayProto.splice;
    function listCacheDelete(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index, 1);
      }
      --this.size;
      return true;
    }
    module2.exports = listCacheDelete;
  }
});

// node_modules/lodash/_listCacheGet.js
var require_listCacheGet = __commonJS({
  "node_modules/lodash/_listCacheGet.js"(exports2, module2) {
    var assocIndexOf = require_assocIndexOf();
    function listCacheGet(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      return index < 0 ? void 0 : data[index][1];
    }
    module2.exports = listCacheGet;
  }
});

// node_modules/lodash/_listCacheHas.js
var require_listCacheHas = __commonJS({
  "node_modules/lodash/_listCacheHas.js"(exports2, module2) {
    var assocIndexOf = require_assocIndexOf();
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    module2.exports = listCacheHas;
  }
});

// node_modules/lodash/_listCacheSet.js
var require_listCacheSet = __commonJS({
  "node_modules/lodash/_listCacheSet.js"(exports2, module2) {
    var assocIndexOf = require_assocIndexOf();
    function listCacheSet(key, value) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        ++this.size;
        data.push([key, value]);
      } else {
        data[index][1] = value;
      }
      return this;
    }
    module2.exports = listCacheSet;
  }
});

// node_modules/lodash/_ListCache.js
var require_ListCache = __commonJS({
  "node_modules/lodash/_ListCache.js"(exports2, module2) {
    var listCacheClear = require_listCacheClear();
    var listCacheDelete = require_listCacheDelete();
    var listCacheGet = require_listCacheGet();
    var listCacheHas = require_listCacheHas();
    var listCacheSet = require_listCacheSet();
    function ListCache(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype["delete"] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;
    module2.exports = ListCache;
  }
});

// node_modules/lodash/_Map.js
var require_Map = __commonJS({
  "node_modules/lodash/_Map.js"(exports2, module2) {
    var getNative = require_getNative();
    var root = require_root();
    var Map2 = getNative(root, "Map");
    module2.exports = Map2;
  }
});

// node_modules/lodash/_mapCacheClear.js
var require_mapCacheClear = __commonJS({
  "node_modules/lodash/_mapCacheClear.js"(exports2, module2) {
    var Hash = require_Hash();
    var ListCache = require_ListCache();
    var Map2 = require_Map();
    function mapCacheClear() {
      this.size = 0;
      this.__data__ = {
        "hash": new Hash(),
        "map": new (Map2 || ListCache)(),
        "string": new Hash()
      };
    }
    module2.exports = mapCacheClear;
  }
});

// node_modules/lodash/_isKeyable.js
var require_isKeyable = __commonJS({
  "node_modules/lodash/_isKeyable.js"(exports2, module2) {
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    module2.exports = isKeyable;
  }
});

// node_modules/lodash/_getMapData.js
var require_getMapData = __commonJS({
  "node_modules/lodash/_getMapData.js"(exports2, module2) {
    var isKeyable = require_isKeyable();
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    module2.exports = getMapData;
  }
});

// node_modules/lodash/_mapCacheDelete.js
var require_mapCacheDelete = __commonJS({
  "node_modules/lodash/_mapCacheDelete.js"(exports2, module2) {
    var getMapData = require_getMapData();
    function mapCacheDelete(key) {
      var result = getMapData(this, key)["delete"](key);
      this.size -= result ? 1 : 0;
      return result;
    }
    module2.exports = mapCacheDelete;
  }
});

// node_modules/lodash/_mapCacheGet.js
var require_mapCacheGet = __commonJS({
  "node_modules/lodash/_mapCacheGet.js"(exports2, module2) {
    var getMapData = require_getMapData();
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    module2.exports = mapCacheGet;
  }
});

// node_modules/lodash/_mapCacheHas.js
var require_mapCacheHas = __commonJS({
  "node_modules/lodash/_mapCacheHas.js"(exports2, module2) {
    var getMapData = require_getMapData();
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    module2.exports = mapCacheHas;
  }
});

// node_modules/lodash/_mapCacheSet.js
var require_mapCacheSet = __commonJS({
  "node_modules/lodash/_mapCacheSet.js"(exports2, module2) {
    var getMapData = require_getMapData();
    function mapCacheSet(key, value) {
      var data = getMapData(this, key), size = data.size;
      data.set(key, value);
      this.size += data.size == size ? 0 : 1;
      return this;
    }
    module2.exports = mapCacheSet;
  }
});

// node_modules/lodash/_MapCache.js
var require_MapCache = __commonJS({
  "node_modules/lodash/_MapCache.js"(exports2, module2) {
    var mapCacheClear = require_mapCacheClear();
    var mapCacheDelete = require_mapCacheDelete();
    var mapCacheGet = require_mapCacheGet();
    var mapCacheHas = require_mapCacheHas();
    var mapCacheSet = require_mapCacheSet();
    function MapCache(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype["delete"] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;
    module2.exports = MapCache;
  }
});

// node_modules/lodash/memoize.js
var require_memoize = __commonJS({
  "node_modules/lodash/memoize.js"(exports2, module2) {
    var MapCache = require_MapCache();
    var FUNC_ERROR_TEXT = "Expected a function";
    function memoize(func, resolver2) {
      if (typeof func != "function" || resolver2 != null && typeof resolver2 != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      var memoized = function() {
        var args = arguments, key = resolver2 ? resolver2.apply(this, args) : args[0], cache = memoized.cache;
        if (cache.has(key)) {
          return cache.get(key);
        }
        var result = func.apply(this, args);
        memoized.cache = cache.set(key, result) || cache;
        return result;
      };
      memoized.cache = new (memoize.Cache || MapCache)();
      return memoized;
    }
    memoize.Cache = MapCache;
    module2.exports = memoize;
  }
});

// node_modules/lodash/_memoizeCapped.js
var require_memoizeCapped = __commonJS({
  "node_modules/lodash/_memoizeCapped.js"(exports2, module2) {
    var memoize = require_memoize();
    var MAX_MEMOIZE_SIZE = 500;
    function memoizeCapped(func) {
      var result = memoize(func, function(key) {
        if (cache.size === MAX_MEMOIZE_SIZE) {
          cache.clear();
        }
        return key;
      });
      var cache = result.cache;
      return result;
    }
    module2.exports = memoizeCapped;
  }
});

// node_modules/lodash/_stringToPath.js
var require_stringToPath = __commonJS({
  "node_modules/lodash/_stringToPath.js"(exports2, module2) {
    var memoizeCapped = require_memoizeCapped();
    var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
    var reEscapeChar = /\\(\\)?/g;
    var stringToPath = memoizeCapped(function(string) {
      var result = [];
      if (string.charCodeAt(0) === 46) {
        result.push("");
      }
      string.replace(rePropName, function(match, number, quote, subString) {
        result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
      });
      return result;
    });
    module2.exports = stringToPath;
  }
});

// node_modules/lodash/_arrayMap.js
var require_arrayMap = __commonJS({
  "node_modules/lodash/_arrayMap.js"(exports2, module2) {
    function arrayMap(array, iteratee) {
      var index = -1, length = array == null ? 0 : array.length, result = Array(length);
      while (++index < length) {
        result[index] = iteratee(array[index], index, array);
      }
      return result;
    }
    module2.exports = arrayMap;
  }
});

// node_modules/lodash/_baseToString.js
var require_baseToString = __commonJS({
  "node_modules/lodash/_baseToString.js"(exports2, module2) {
    var Symbol2 = require_Symbol();
    var arrayMap = require_arrayMap();
    var isArray = require_isArray();
    var isSymbol = require_isSymbol();
    var INFINITY = 1 / 0;
    var symbolProto = Symbol2 ? Symbol2.prototype : void 0;
    var symbolToString = symbolProto ? symbolProto.toString : void 0;
    function baseToString(value) {
      if (typeof value == "string") {
        return value;
      }
      if (isArray(value)) {
        return arrayMap(value, baseToString) + "";
      }
      if (isSymbol(value)) {
        return symbolToString ? symbolToString.call(value) : "";
      }
      var result = value + "";
      return result == "0" && 1 / value == -INFINITY ? "-0" : result;
    }
    module2.exports = baseToString;
  }
});

// node_modules/lodash/toString.js
var require_toString = __commonJS({
  "node_modules/lodash/toString.js"(exports2, module2) {
    var baseToString = require_baseToString();
    function toString(value) {
      return value == null ? "" : baseToString(value);
    }
    module2.exports = toString;
  }
});

// node_modules/lodash/_castPath.js
var require_castPath = __commonJS({
  "node_modules/lodash/_castPath.js"(exports2, module2) {
    var isArray = require_isArray();
    var isKey = require_isKey();
    var stringToPath = require_stringToPath();
    var toString = require_toString();
    function castPath(value, object) {
      if (isArray(value)) {
        return value;
      }
      return isKey(value, object) ? [value] : stringToPath(toString(value));
    }
    module2.exports = castPath;
  }
});

// node_modules/lodash/_toKey.js
var require_toKey = __commonJS({
  "node_modules/lodash/_toKey.js"(exports2, module2) {
    var isSymbol = require_isSymbol();
    var INFINITY = 1 / 0;
    function toKey(value) {
      if (typeof value == "string" || isSymbol(value)) {
        return value;
      }
      var result = value + "";
      return result == "0" && 1 / value == -INFINITY ? "-0" : result;
    }
    module2.exports = toKey;
  }
});

// node_modules/lodash/_baseGet.js
var require_baseGet = __commonJS({
  "node_modules/lodash/_baseGet.js"(exports2, module2) {
    var castPath = require_castPath();
    var toKey = require_toKey();
    function baseGet(object, path) {
      path = castPath(path, object);
      var index = 0, length = path.length;
      while (object != null && index < length) {
        object = object[toKey(path[index++])];
      }
      return index && index == length ? object : void 0;
    }
    module2.exports = baseGet;
  }
});

// node_modules/lodash/get.js
var require_get = __commonJS({
  "node_modules/lodash/get.js"(exports2, module2) {
    var baseGet = require_baseGet();
    function get(object, path, defaultValue) {
      var result = object == null ? void 0 : baseGet(object, path);
      return result === void 0 ? defaultValue : result;
    }
    module2.exports = get;
  }
});

// node_modules/@forge/i18n/out/translationValueGetter.js
var require_translationValueGetter = __commonJS({
  "node_modules/@forge/i18n/out/translationValueGetter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getTranslationValueFromContent = exports2.getTranslationValue = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var get_1 = tslib_1.__importDefault(require_get());
    var getTranslationValue = (translationLookup, i18nKey, locale) => {
      const translation = translationLookup[locale];
      if (!translation) {
        return null;
      }
      return (0, exports2.getTranslationValueFromContent)(translation, i18nKey);
    };
    exports2.getTranslationValue = getTranslationValue;
    var getTranslationValueFromContent = (translationContent, i18nKey) => {
      let translationValue = translationContent[i18nKey];
      if (!translationValue) {
        const keyTokens = i18nKey.split(".");
        if (keyTokens.length > 1) {
          translationValue = (0, get_1.default)(translationContent, keyTokens, null);
        }
      }
      return typeof translationValue === "string" ? translationValue : null;
    };
    exports2.getTranslationValueFromContent = getTranslationValueFromContent;
  }
});

// node_modules/@forge/i18n/out/translator.js
var require_translator = __commonJS({
  "node_modules/@forge/i18n/out/translator.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Translator = void 0;
    var translationValueGetter_1 = require_translationValueGetter();
    var Translator = class {
      locale;
      translationsGetter;
      localeLookupOrderedTranslations = null;
      cache = /* @__PURE__ */ new Map();
      constructor(locale, translationsGetter) {
        this.locale = locale;
        this.translationsGetter = translationsGetter;
      }
      async init() {
        this.localeLookupOrderedTranslations = await this.translationsGetter.getTranslationsByLocaleLookupOrder(this.locale);
      }
      translate(i18nKey) {
        if (!this.localeLookupOrderedTranslations) {
          throw new Error("TranslationLookup not initialized");
        }
        let result = this.cache.get(i18nKey);
        if (result === void 0) {
          for (const { translations } of this.localeLookupOrderedTranslations) {
            const translationValue = (0, translationValueGetter_1.getTranslationValueFromContent)(translations, i18nKey);
            if (translationValue !== null) {
              result = translationValue;
              break;
            }
          }
          result = result ?? null;
          this.cache.set(i18nKey, result);
        }
        return result;
      }
    };
    exports2.Translator = Translator;
  }
});

// node_modules/@forge/i18n/out/ensureLocale.js
var require_ensureLocale = __commonJS({
  "node_modules/@forge/i18n/out/ensureLocale.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ensureLocale = void 0;
    var constants_1 = require_constants();
    var forgeSupportedLocaleCodesSet = new Set(constants_1.FORGE_SUPPORTED_LOCALE_CODES);
    var localeFallbacks = {
      "en-UK": "en-GB",
      "nb-NO": "no-NO"
    };
    var languageToLocaleCodeMap = constants_1.FORGE_SUPPORTED_LOCALE_CODES.reduce((agg, code) => {
      const [lng] = code.split("-");
      if (!agg[lng]) {
        agg[lng] = code;
      }
      return agg;
    }, {
      nb: "no-NO",
      pt: "pt-PT"
    });
    var ensureLocale = (rawLocale) => {
      const locale = rawLocale.replace("_", "-");
      if (forgeSupportedLocaleCodesSet.has(locale)) {
        return locale;
      }
      return languageToLocaleCodeMap[locale] ?? localeFallbacks[locale] ?? null;
    };
    exports2.ensureLocale = ensureLocale;
  }
});

// node_modules/@forge/i18n/out/moduleI18nHelper.js
var require_moduleI18nHelper = __commonJS({
  "node_modules/@forge/i18n/out/moduleI18nHelper.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extractI18nPropertiesFromModules = exports2.extractI18nKeysFromModules = exports2.getI18nSupportedModuleEntries = void 0;
    var isObject = (value) => {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    };
    var isI18nValue = (value) => {
      return typeof value?.i18n === "string";
    };
    var isConnectModuleKey = (moduleKey) => moduleKey.startsWith("connect-");
    var isCoreModuleKey = (moduleKey) => moduleKey.startsWith("core:");
    var getI18nKeysFromObject = (obj) => {
      const visited = /* @__PURE__ */ new Set();
      const visit = (value, i18nPath) => {
        if (!isObject(value) || visited.has(value)) {
          return [];
        }
        visited.add(value);
        return Object.entries(value).flatMap(([propKey, propValue]) => {
          const currentPath = [...i18nPath, propKey];
          if (isI18nValue(propValue)) {
            return [{ propertyPath: currentPath, key: propValue.i18n }];
          } else if (Array.isArray(propValue)) {
            return propValue.flatMap((item) => visit(item, currentPath));
          }
          return visit(propValue, currentPath);
        });
      };
      return visit(obj, []);
    };
    var getI18nSupportedModuleEntries = (modules) => {
      return Object.entries(modules).flatMap(([moduleKey, moduleEntries]) => {
        if (!isConnectModuleKey(moduleKey) && !isCoreModuleKey(moduleKey) && moduleEntries && Array.isArray(moduleEntries) && moduleEntries.length > 0) {
          return moduleEntries.map((moduleEntry) => [moduleEntry, moduleKey]);
        }
        return [];
      });
    };
    exports2.getI18nSupportedModuleEntries = getI18nSupportedModuleEntries;
    var extractI18nKeysFromModules = (modules) => {
      const i18nKeys = /* @__PURE__ */ new Set();
      for (const moduleEntry of (0, exports2.getI18nSupportedModuleEntries)(modules)) {
        const i18nKeysForEntryValue = getI18nKeysFromObject(moduleEntry[0]);
        for (const { key } of i18nKeysForEntryValue) {
          i18nKeys.add(key);
        }
      }
      return i18nKeys.size > 0 ? Array.from(i18nKeys) : [];
    };
    exports2.extractI18nKeysFromModules = extractI18nKeysFromModules;
    var extractI18nPropertiesFromModules = (modules) => {
      const moduleI18nProperties = [];
      for (const moduleEntry of (0, exports2.getI18nSupportedModuleEntries)(modules)) {
        const i18nKeysForEntryValue = getI18nKeysFromObject(moduleEntry[0]);
        for (const i18nObj of i18nKeysForEntryValue) {
          moduleI18nProperties.push({ moduleName: moduleEntry[1], ...i18nObj });
        }
      }
      return moduleI18nProperties;
    };
    exports2.extractI18nPropertiesFromModules = extractI18nPropertiesFromModules;
  }
});

// node_modules/@forge/i18n/out/types.js
var require_types2 = __commonJS({
  "node_modules/@forge/i18n/out/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// node_modules/@forge/i18n/out/index.js
var require_out4 = __commonJS({
  "node_modules/@forge/i18n/out/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getI18nSupportedModuleEntries = exports2.extractI18nPropertiesFromModules = exports2.extractI18nKeysFromModules = exports2.getTranslationValue = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_constants(), exports2);
    tslib_1.__exportStar(require_translationsGetter(), exports2);
    tslib_1.__exportStar(require_translator(), exports2);
    tslib_1.__exportStar(require_ensureLocale(), exports2);
    var translationValueGetter_1 = require_translationValueGetter();
    Object.defineProperty(exports2, "getTranslationValue", { enumerable: true, get: function() {
      return translationValueGetter_1.getTranslationValue;
    } });
    var moduleI18nHelper_1 = require_moduleI18nHelper();
    Object.defineProperty(exports2, "extractI18nKeysFromModules", { enumerable: true, get: function() {
      return moduleI18nHelper_1.extractI18nKeysFromModules;
    } });
    Object.defineProperty(exports2, "extractI18nPropertiesFromModules", { enumerable: true, get: function() {
      return moduleI18nHelper_1.extractI18nPropertiesFromModules;
    } });
    Object.defineProperty(exports2, "getI18nSupportedModuleEntries", { enumerable: true, get: function() {
      return moduleI18nHelper_1.getI18nSupportedModuleEntries;
    } });
    tslib_1.__exportStar(require_types2(), exports2);
  }
});

// node_modules/@forge/api/out/api/i18n.js
var require_i18n = __commonJS({
  "node_modules/@forge/api/out/api/i18n.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.i18n = exports2.createTranslationFunction = exports2.getTranslations = exports2.resetTranslationsCache = void 0;
    var i18n_1 = require_out4();
    var fs_1 = require("fs");
    var path_1 = require("path");
    var runtime_1 = require_runtime();
    var getI18nBundleFolderPath = () => {
      const { appCodeDir } = (0, runtime_1.__getRuntime)().container;
      return appCodeDir ? [appCodeDir, i18n_1.I18N_BUNDLE_FOLDER_NAME] : [i18n_1.I18N_BUNDLE_FOLDER_NAME];
    };
    var readLocaleFileContent = async (filePath) => {
      const fileContent = await fs_1.promises.readFile((0, path_1.join)(...getI18nBundleFolderPath(), filePath));
      return JSON.parse(fileContent.toString());
    };
    var makeResourceAccessorErrorMessage = (message) => {
      if (global.__forge_tunnel__) {
        const cliUpdateWarning = "To access i18n resources while using `forge tunnel`, please ensure that your Forge CLI is up to date. Run `npm install -g @forge/cli` to update to the latest version.";
        return `${message}
${cliUpdateWarning}`;
      }
      return message;
    };
    var resolverResourcesAccessor = {
      getI18nInfoConfig: async () => {
        try {
          const info = await readLocaleFileContent(i18n_1.I18N_INFO_FILE_NAME);
          return info.config;
        } catch (error) {
          throw new i18n_1.TranslationGetterError(makeResourceAccessorErrorMessage("Failed to get i18n info config."));
        }
      },
      getTranslationResource: async (locale) => {
        try {
          return await readLocaleFileContent(`${locale}.json`);
        } catch (error) {
          throw new i18n_1.TranslationGetterError(makeResourceAccessorErrorMessage(`Failed to get translation resource for locale: ${locale}.`));
        }
      }
    };
    var translationsFunctionCache = /* @__PURE__ */ new Map();
    var translationsGetter = new i18n_1.TranslationsGetter(resolverResourcesAccessor);
    var resetTranslationsCache = () => {
      translationsGetter.reset();
      translationsFunctionCache.clear();
    };
    exports2.resetTranslationsCache = resetTranslationsCache;
    var getTranslations = async (rawLocale, options = {
      fallback: true
    }) => {
      const locale = doEnsureLocale(rawLocale);
      return await translationsGetter.getTranslations(locale, options);
    };
    exports2.getTranslations = getTranslations;
    var createTranslationFunction = async (rawLocale) => {
      const locale = doEnsureLocale(rawLocale);
      let translator = translationsFunctionCache.get(locale);
      if (!translator) {
        translator = await createTranslationFunctionImpl(locale);
        translationsFunctionCache.set(locale, translator);
      }
      return translator;
    };
    exports2.createTranslationFunction = createTranslationFunction;
    var doEnsureLocale = (rawLocale) => {
      const ensuredLocale = (0, i18n_1.ensureLocale)(rawLocale);
      if (!ensuredLocale) {
        console.warn(`The locale "${rawLocale}" is not supported, defaulting to the default locale.`);
        return rawLocale;
      }
      return ensuredLocale;
    };
    var createTranslationFunctionImpl = async (locale) => {
      const translator = new i18n_1.Translator(locale, translationsGetter);
      await translator.init();
      return (i18nKey, defaultValue) => translator.translate(i18nKey) ?? defaultValue ?? i18nKey;
    };
    exports2.i18n = {
      createTranslationFunction: exports2.createTranslationFunction,
      getTranslations: exports2.getTranslations
    };
  }
});

// node_modules/@forge/egress/out/egress/url-parser.js
var require_url_parser = __commonJS({
  "node_modules/@forge/egress/out/egress/url-parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseUrl = parseUrl;
    function parseUrl(url) {
      var _a, _b;
      const protocol = (_b = (_a = url.match(/^(.*?:)/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : "https:";
      const hostAndPath = url.replace(protocol, "").replace(/^\/*/, "").replace(/^\\*/, "").split("?")[0].split("#")[0];
      const hostname = hostAndPath.split("/")[0];
      const pathname = hostAndPath.slice(hostname.length) || "/";
      return { protocol, hostname, pathname };
    }
  }
});

// node_modules/@forge/egress/out/egress/utils.js
var require_utils = __commonJS({
  "node_modules/@forge/egress/out/egress/utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getEgressesBasedOnToggles = exports2.sortAndGroupEgressPermissionsByDomain = exports2.EgressCategory = exports2.EgressType = void 0;
    exports2.globToRegex = globToRegex;
    var url_parser_1 = require_url_parser();
    function globToRegex(pattern) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      const regexPattern = escaped.replace(/\*/g, ".*");
      return new RegExp(`^${regexPattern}$`);
    }
    var sortAndGroupEgressPermissionsByDomain = (egressAddresses) => {
      if ((egressAddresses === null || egressAddresses === void 0 ? void 0 : egressAddresses.length) === 0) {
        return [];
      }
      const protocolRegex = /^(.*?:\/\/)/;
      const domains = /* @__PURE__ */ new Set();
      const wildcardDomains = [];
      egressAddresses.forEach((item) => {
        const itemWithProtocol = protocolRegex.test(item) ? item : `https://${item}`;
        const url = (0, url_parser_1.parseUrl)(itemWithProtocol);
        if (url.hostname.startsWith("*")) {
          domains.add(url.hostname.substring(2));
          wildcardDomains.push(globToRegex(url.hostname));
        } else {
          domains.add(url.hostname);
        }
      });
      return [...domains].sort().reduce((grouped, domain) => {
        if (!wildcardDomains.some((pattern) => pattern.test(domain))) {
          grouped.push(domain);
        }
        return grouped;
      }, []);
    };
    exports2.sortAndGroupEgressPermissionsByDomain = sortAndGroupEgressPermissionsByDomain;
    var EgressType;
    (function(EgressType2) {
      EgressType2["FetchBackendSide"] = "FETCH_BACKEND_SIDE";
      EgressType2["FetchClientSide"] = "FETCH_CLIENT_SIDE";
      EgressType2["Fonts"] = "FONTS";
      EgressType2["Frames"] = "FRAMES";
      EgressType2["Images"] = "IMAGES";
      EgressType2["Media"] = "MEDIA";
      EgressType2["Scripts"] = "SCRIPTS";
      EgressType2["Styles"] = "STYLES";
    })(EgressType || (exports2.EgressType = EgressType = {}));
    var EgressCategory;
    (function(EgressCategory2) {
      EgressCategory2["ANALYTICS"] = "ANALYTICS";
    })(EgressCategory || (exports2.EgressCategory = EgressCategory = {}));
    var getEgressesBasedOnToggles = (input) => {
      const filteredEgresses = input.egress.filter((egress) => {
        var _a;
        if (((_a = egress.category) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === EgressCategory.ANALYTICS) {
          if (input.installationConfig) {
            const analyticsConfig = input.installationConfig.find((config) => config.key.toUpperCase() === "ALLOW_EGRESS_ANALYTICS");
            return (analyticsConfig === null || analyticsConfig === void 0 ? void 0 : analyticsConfig.value) !== false;
          } else {
            return input.overrides.ALLOW_EGRESS_ANALYTICS !== false;
          }
        }
        return true;
      });
      const egressByType = /* @__PURE__ */ new Map();
      for (const egress of filteredEgresses) {
        if (!egressByType.has(egress.type)) {
          egressByType.set(egress.type, egress.addresses);
        }
        egressByType.set(egress.type, [...egressByType.get(egress.type), ...egress.addresses]);
      }
      return [...egressByType.entries()].map(([type, egresses]) => ({
        type,
        addresses: [...new Set(egresses)]
      }));
    };
    exports2.getEgressesBasedOnToggles = getEgressesBasedOnToggles;
  }
});

// node_modules/@forge/egress/out/egress/egress-filtering-service.js
var require_egress_filtering_service = __commonJS({
  "node_modules/@forge/egress/out/egress/egress-filtering-service.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.EgressFilteringService = void 0;
    var url_parser_1 = require_url_parser();
    var utils_1 = require_utils();
    var EgressFilteringService = class {
      constructor(allowList) {
        this.URLs = allowList.filter((domainOrURL) => !domainOrURL.startsWith("*")).map((url) => this.parseUrl(url));
        this.wildcardDomains = allowList.filter((domainOrURL) => domainOrURL !== "*").map((url) => this.parseUrl(url)).filter((url) => decodeURIComponent(url.hostname).startsWith("*")).map((url) => ({
          ...url,
          regex: (0, utils_1.globToRegex)(decodeURIComponent(url.hostname))
        }));
        this.allowsEverything = allowList.includes("*");
      }
      parseUrl(url) {
        return (0, url_parser_1.parseUrl)(url);
      }
      containsWildCardEgress() {
        return this.allowsEverything;
      }
      isValidUrl(url) {
        if (this.allowsEverything) {
          return true;
        }
        const parsedUrl = this.parseUrl(url);
        return this.allowedDomainExact(parsedUrl, this.URLs) || this.allowedDomainPattern(parsedUrl, this.wildcardDomains);
      }
      isValidUrlCSP(url) {
        if (this.allowsEverything) {
          return true;
        }
        const parsedUrl = this.parseUrl(url);
        return this.allowedDomainExactAndPath(parsedUrl, this.URLs) || this.allowedDomainPatternAndPath(parsedUrl, this.wildcardDomains);
      }
      allowedDomainExact(domain, allowList) {
        return allowList.filter((allowed) => allowed.protocol === domain.protocol).some((url) => url.hostname === domain.hostname);
      }
      allowedDomainExactAndPath(domain, allowList) {
        return allowList.filter((allowed) => this.protocolMatchesCSP(allowed.protocol, domain.protocol)).filter((allowed) => allowed.hostname === domain.hostname).some((allowed) => this.pathMatches(allowed.pathname, domain.pathname));
      }
      allowedDomainPattern(domain, allowList) {
        return allowList.filter((allowed) => allowed.protocol === domain.protocol).some((pattern) => pattern.regex.test(domain.hostname));
      }
      allowedDomainPatternAndPath(domain, allowList) {
        return allowList.filter((pattern) => this.protocolMatchesCSP(pattern.protocol, domain.protocol)).filter((pattern) => pattern.regex.test(domain.hostname)).some((allowed) => this.pathMatches(allowed.pathname, domain.pathname));
      }
      protocolMatchesCSP(allowedProtocol, requestProtocol) {
        if (allowedProtocol === requestProtocol) {
          return true;
        }
        if (allowedProtocol === "http:" && requestProtocol === "https:") {
          return true;
        }
        if (allowedProtocol === "ws:" && requestProtocol === "wss:") {
          return true;
        }
        return false;
      }
      pathMatches(allowedPath, requestPath) {
        if (allowedPath === "/") {
          return true;
        }
        if (allowedPath.endsWith("/")) {
          return requestPath.startsWith(allowedPath);
        }
        return requestPath === allowedPath;
      }
    };
    exports2.EgressFilteringService = EgressFilteringService;
  }
});

// node_modules/@forge/egress/out/egress/index.js
var require_egress = __commonJS({
  "node_modules/@forge/egress/out/egress/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_egress_filtering_service(), exports2);
    tslib_1.__exportStar(require_url_parser(), exports2);
    tslib_1.__exportStar(require_utils(), exports2);
  }
});

// node_modules/@forge/egress/out/index.js
var require_out5 = __commonJS({
  "node_modules/@forge/egress/out/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_egress(), exports2);
  }
});

// node_modules/@forge/api/out/api/permissions.js
var require_permissions3 = __commonJS({
  "node_modules/@forge/api/out/api/permissions.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.permissions = exports2.canLoadResource = exports2.canFetchFrom = exports2.hasScope = exports2.hasPermission = void 0;
    exports2.extractUrlString = extractUrlString;
    var runtime_1 = require_runtime();
    var errors_1 = require_errors2();
    var egress_1 = require_out5();
    function extractUrlString(url) {
      if (typeof url === "string") {
        return url;
      }
      if ("address" in url) {
        return url.address;
      }
      return url.remote;
    }
    function wrapInSyncMetrics(options, cb) {
      const metrics = (0, runtime_1.__getRuntime)().metrics;
      metrics.counter(options.name, options.tags).incr();
      return cb();
    }
    var getMissingScopes = (requiredScopes, currentlyGrantedScopes) => {
      if (!requiredScopes) {
        return void 0;
      }
      if (Array.isArray(requiredScopes) && requiredScopes.length > 0) {
        const currentGrantedScopes = Array.isArray(currentlyGrantedScopes) ? currentlyGrantedScopes : [];
        const missingScopes = requiredScopes.filter((scope) => !currentGrantedScopes.includes(scope));
        if (missingScopes.length > 0) {
          return missingScopes;
        }
      }
      return void 0;
    };
    var getMissingUrls = (requiredUrls, currentlyGrantedUrls, useCSP) => {
      const allowList = currentlyGrantedUrls.map((url) => extractUrlString(url));
      const egressFilter = new egress_1.EgressFilteringService(allowList);
      const missingUrls = requiredUrls.filter((requiredUrl) => {
        const urlString = extractUrlString(requiredUrl);
        if (useCSP) {
          return !egressFilter.isValidUrlCSP(urlString);
        }
        return !egressFilter.isValidUrl(urlString);
      });
      return missingUrls;
    };
    var VALID_REQUIREMENT_KEYS = ["scopes", "external"];
    var VALID_EXTERNAL_TYPES = [
      "fetch",
      "fonts",
      "frames",
      "images",
      "media",
      "scripts",
      "styles",
      "configurable"
    ];
    var VALID_FETCH_TYPES = ["backend", "client"];
    var validateKeys = (obj, validKeys) => {
      const validKeysSet = new Set(validKeys);
      const providedKeys = Object.keys(obj);
      const invalidKeys = providedKeys.filter((key) => !validKeysSet.has(key));
      if (invalidKeys.length > 0) {
        throw new Error(`Invalid permission key(s): ${invalidKeys.join(", ")}. Visit https://go.atlassian.com/forge-permissions for more information.`);
      }
    };
    var validateObjectField = (value, fieldPath) => {
      if (value !== void 0) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError(`${fieldPath} should be an object, not ${Array.isArray(value) ? "an array" : `a ${typeof value}`}`);
        }
      }
    };
    var validateArrayField = (value, fieldPath) => {
      if (value !== void 0 && !Array.isArray(value)) {
        throw new TypeError(`${fieldPath} should be an array, not a ${typeof value}`);
      }
    };
    var validatePermissionRequirements = (requirements) => {
      validateKeys(requirements, VALID_REQUIREMENT_KEYS);
      validateArrayField(requirements.scopes, "scopes");
      if (requirements.external !== void 0) {
        validateObjectField(requirements.external, "external");
        validateKeys(requirements.external, VALID_EXTERNAL_TYPES);
        for (const type of VALID_EXTERNAL_TYPES) {
          if (type !== "fetch" && type !== "configurable") {
            validateArrayField(requirements.external[type], `external.${String(type)}`);
          }
        }
        if (requirements.external.fetch !== void 0) {
          validateObjectField(requirements.external.fetch, "external.fetch");
          validateKeys(requirements.external.fetch, VALID_FETCH_TYPES);
          for (const type of VALID_FETCH_TYPES) {
            validateArrayField(requirements.external.fetch[type], `external.fetch.${String(type)}`);
          }
        }
      }
    };
    var getMissingFetchPermissions = (requiredFetch, currentlyGrantedFetch) => {
      if (!requiredFetch) {
        return void 0;
      }
      const missingFetch = {};
      Object.keys(requiredFetch).forEach((fetchType) => {
        const requiredUrls = requiredFetch[fetchType];
        if (!requiredUrls || !Array.isArray(requiredUrls) || requiredUrls.length === 0)
          return;
        const missingUrls = getMissingUrls(requiredUrls, currentlyGrantedFetch?.[fetchType] ?? [], fetchType === "client");
        if (missingUrls.length) {
          missingFetch[fetchType] = missingUrls.map(extractUrlString);
        }
      });
      return Object.keys(missingFetch).length ? missingFetch : void 0;
    };
    var getMissingExternalPermissions = (requiredExternal, currentGrantedExternal) => {
      let missingExternal = void 0;
      Object.keys(requiredExternal).forEach((type) => {
        if (type === "fetch") {
          const missingFetchPerms = getMissingFetchPermissions(requiredExternal.fetch, currentGrantedExternal.fetch);
          if (missingFetchPerms) {
            if (!missingExternal) {
              missingExternal = {};
            }
            missingExternal.fetch = missingFetchPerms;
          }
          return;
        }
        if (type === "configurable") {
          return;
        }
        const externalUrls = requiredExternal[type];
        if (!externalUrls || !Array.isArray(externalUrls) || externalUrls.length === 0) {
          return;
        }
        const missingUrls = getMissingUrls(externalUrls, currentGrantedExternal[type] || [], true);
        if (missingUrls.length > 0) {
          if (!missingExternal) {
            missingExternal = {};
          }
          missingExternal[type] = missingUrls.map(extractUrlString);
        }
      });
      return missingExternal;
    };
    var hasPermission = (requirements) => {
      return wrapInSyncMetrics({ name: "api.permissions.hasPermission" }, () => hasPermissionWithoutMetrics(requirements));
    };
    exports2.hasPermission = hasPermission;
    var hasPermissionWithoutMetrics = (requirements) => {
      const appContext = (0, runtime_1.getAppContext)();
      const currentlyGrantedPermissions = appContext.permissions;
      const arePermissionsAvailable = !!(currentlyGrantedPermissions && typeof currentlyGrantedPermissions === "object");
      if (!arePermissionsAvailable) {
        throw new errors_1.ApiNotReadyError("This feature is not available yet");
      }
      validatePermissionRequirements(requirements);
      const missingPermissions = {};
      let hasMissingPermissions = false;
      const missingScopes = getMissingScopes(requirements.scopes, currentlyGrantedPermissions.scopes);
      if (missingScopes) {
        missingPermissions.scopes = missingScopes;
        hasMissingPermissions = true;
      }
      if (requirements.external) {
        const { external: requiredExternal } = requirements;
        const currentlyGrantedExternal = currentlyGrantedPermissions.external || {};
        const missingExternalPerms = getMissingExternalPermissions(requiredExternal, currentlyGrantedExternal);
        if (missingExternalPerms) {
          missingPermissions.external = {
            ...missingPermissions.external,
            ...missingExternalPerms
          };
          hasMissingPermissions = true;
        }
      }
      return {
        granted: !hasMissingPermissions,
        ...hasMissingPermissions && {
          missing: new runtime_1.MissingPermissions(missingPermissions.scopes, missingPermissions.external)
        }
      };
    };
    var hasScope = (scope) => {
      return wrapInSyncMetrics({ name: "api.permissions.hasScope" }, () => hasPermissionWithoutMetrics({ scopes: [scope] }).granted);
    };
    exports2.hasScope = hasScope;
    var canFetchFrom = (type, url) => {
      return wrapInSyncMetrics({ name: "api.permissions.canFetchFrom" }, () => hasPermissionWithoutMetrics({ external: { fetch: { [type]: [url] } } }).granted);
    };
    exports2.canFetchFrom = canFetchFrom;
    var canLoadResource = (type, url) => {
      return wrapInSyncMetrics({ name: "api.permissions.canLoadResource" }, () => hasPermissionWithoutMetrics({ external: { [type]: [url] } }).granted);
    };
    exports2.canLoadResource = canLoadResource;
    exports2.permissions = {
      hasPermission: exports2.hasPermission,
      hasScope: exports2.hasScope,
      canFetchFrom: exports2.canFetchFrom,
      canLoadResource: exports2.canLoadResource
    };
  }
});

// node_modules/@forge/api/out/index.js
var require_out6 = __commonJS({
  "node_modules/@forge/api/out/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.permissions = exports2.i18n = exports2.routeFromAbsolute = exports2.route = exports2.assumeTrustedRoute = exports2.getAppContext = exports2.bindInvocationContext = exports2.__getRuntime = exports2.RequestProductNotAllowedError = exports2.ProxyRequestError = exports2.ProductEndpointNotAllowedError = exports2.NotAllowedError = exports2.NeedsAuthenticationError = exports2.isHostedCodeError = exports2.isForgePlatformError = exports2.isExpectedError = exports2.InvalidWorkspaceRequestedError = exports2.HttpError = exports2.FUNCTION_ERR = exports2.FetchError = exports2.ExternalEndpointNotAllowedError = exports2.createRequestStargateAsApp = exports2.webTrigger = exports2.requestJira = exports2.requestConfluence = exports2.requestBitbucket = exports2.invokeService = exports2.invokeRemote = exports2.fetch = exports2.authorize = exports2.asUser = exports2.asApp = exports2.__requestAtlassianAsUser = exports2.__requestAtlassianAsApp = exports2.__fetchProduct = exports2.privacy = void 0;
    var endpoint_1 = require_endpoint();
    Object.defineProperty(exports2, "invokeRemote", { enumerable: true, get: function() {
      return endpoint_1.invokeRemote;
    } });
    Object.defineProperty(exports2, "invokeService", { enumerable: true, get: function() {
      return endpoint_1.invokeService;
    } });
    var fetch_1 = require_fetch();
    Object.defineProperty(exports2, "__fetchProduct", { enumerable: true, get: function() {
      return fetch_1.__fetchProduct;
    } });
    Object.defineProperty(exports2, "__requestAtlassianAsApp", { enumerable: true, get: function() {
      return fetch_1.__requestAtlassianAsApp;
    } });
    Object.defineProperty(exports2, "__requestAtlassianAsUser", { enumerable: true, get: function() {
      return fetch_1.__requestAtlassianAsUser;
    } });
    var authorization_1 = require_authorization();
    Object.defineProperty(exports2, "authorize", { enumerable: true, get: function() {
      return authorization_1.authorize;
    } });
    var privacy_1 = require_privacy();
    var webTrigger_1 = require_webTrigger();
    Object.defineProperty(exports2, "webTrigger", { enumerable: true, get: function() {
      return webTrigger_1.webTrigger;
    } });
    var fetchAPI = (0, fetch_1.getFetchAPI)();
    var asUser = fetchAPI.asUser;
    exports2.asUser = asUser;
    var asApp = fetchAPI.asApp;
    exports2.asApp = asApp;
    var fetch2 = fetchAPI.fetch;
    exports2.fetch = fetch2;
    var requestJira2 = fetchAPI.requestJira;
    exports2.requestJira = requestJira2;
    var requestConfluence = fetchAPI.requestConfluence;
    exports2.requestConfluence = requestConfluence;
    var requestBitbucket = fetchAPI.requestBitbucket;
    exports2.requestBitbucket = requestBitbucket;
    var API = {
      ...fetchAPI,
      invokeRemote: endpoint_1.invokeRemote,
      invokeService: endpoint_1.invokeService
    };
    exports2.privacy = {
      reportPersonalData: (0, privacy_1.createReportPersonalData)(fetch_1.__requestAtlassianAsApp)
    };
    exports2.default = API;
    var createRequestStargateAsApp = () => fetch_1.__requestAtlassianAsApp;
    exports2.createRequestStargateAsApp = createRequestStargateAsApp;
    var errors_1 = require_errors2();
    Object.defineProperty(exports2, "ExternalEndpointNotAllowedError", { enumerable: true, get: function() {
      return errors_1.ExternalEndpointNotAllowedError;
    } });
    Object.defineProperty(exports2, "FetchError", { enumerable: true, get: function() {
      return errors_1.FetchError;
    } });
    Object.defineProperty(exports2, "FUNCTION_ERR", { enumerable: true, get: function() {
      return errors_1.FUNCTION_ERR;
    } });
    Object.defineProperty(exports2, "HttpError", { enumerable: true, get: function() {
      return errors_1.HttpError;
    } });
    Object.defineProperty(exports2, "InvalidWorkspaceRequestedError", { enumerable: true, get: function() {
      return errors_1.InvalidWorkspaceRequestedError;
    } });
    Object.defineProperty(exports2, "isExpectedError", { enumerable: true, get: function() {
      return errors_1.isExpectedError;
    } });
    Object.defineProperty(exports2, "isForgePlatformError", { enumerable: true, get: function() {
      return errors_1.isForgePlatformError;
    } });
    Object.defineProperty(exports2, "isHostedCodeError", { enumerable: true, get: function() {
      return errors_1.isHostedCodeError;
    } });
    Object.defineProperty(exports2, "NeedsAuthenticationError", { enumerable: true, get: function() {
      return errors_1.NeedsAuthenticationError;
    } });
    Object.defineProperty(exports2, "NotAllowedError", { enumerable: true, get: function() {
      return errors_1.NotAllowedError;
    } });
    Object.defineProperty(exports2, "ProductEndpointNotAllowedError", { enumerable: true, get: function() {
      return errors_1.ProductEndpointNotAllowedError;
    } });
    Object.defineProperty(exports2, "ProxyRequestError", { enumerable: true, get: function() {
      return errors_1.ProxyRequestError;
    } });
    Object.defineProperty(exports2, "RequestProductNotAllowedError", { enumerable: true, get: function() {
      return errors_1.RequestProductNotAllowedError;
    } });
    var runtime_1 = require_runtime();
    Object.defineProperty(exports2, "__getRuntime", { enumerable: true, get: function() {
      return runtime_1.__getRuntime;
    } });
    Object.defineProperty(exports2, "bindInvocationContext", { enumerable: true, get: function() {
      return runtime_1.bindInvocationContext;
    } });
    Object.defineProperty(exports2, "getAppContext", { enumerable: true, get: function() {
      return runtime_1.getAppContext;
    } });
    var safeUrl_1 = require_safeUrl();
    Object.defineProperty(exports2, "assumeTrustedRoute", { enumerable: true, get: function() {
      return safeUrl_1.assumeTrustedRoute;
    } });
    Object.defineProperty(exports2, "route", { enumerable: true, get: function() {
      return safeUrl_1.route;
    } });
    Object.defineProperty(exports2, "routeFromAbsolute", { enumerable: true, get: function() {
      return safeUrl_1.routeFromAbsolute;
    } });
    var i18n_1 = require_i18n();
    Object.defineProperty(exports2, "i18n", { enumerable: true, get: function() {
      return i18n_1.i18n;
    } });
    var permissions_1 = require_permissions3();
    Object.defineProperty(exports2, "permissions", { enumerable: true, get: function() {
      return permissions_1.permissions;
    } });
  }
});

// app/src/backend.js
var backend_exports = {};
__export(backend_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(backend_exports);
var import_resolver = __toESM(require_out());
var import_kvs = __toESM(require_out2());
var import_api = __toESM(require_out6());
var resolver = new import_resolver.default();
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
var handler = resolver.getDefinitions();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
