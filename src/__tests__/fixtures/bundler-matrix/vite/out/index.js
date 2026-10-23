import require$$2 from "async_hooks";
import require$$1 from "fs";
import require$$2$1 from "path";
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      var isInstance = false;
      try {
        isInstance = this instanceof a2;
      } catch {
      }
      if (isInstance) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
var out$5 = {};
var hasRequiredOut$5;
function requireOut$5() {
  if (hasRequiredOut$5) return out$5;
  hasRequiredOut$5 = 1;
  Object.defineProperty(out$5, "__esModule", { value: true });
  out$5.makeResolver = makeResolver;
  class Resolver2 {
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
  }
  out$5.default = Resolver2;
  function makeResolver(handlers) {
    const resolver2 = new Resolver2();
    for (const key of Object.keys(handlers)) {
      resolver2.define(key, handlers[key]);
    }
    return resolver2.getDefinitions();
  }
  return out$5;
}
var outExports$2 = requireOut$5();
const Resolver = /* @__PURE__ */ getDefaultExportFromCjs(outExports$2);
var out$4 = {};
var extendStatics = function(d, b) {
  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
    d2.__proto__ = b2;
  } || function(d2, b2) {
    for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
  };
  return extendStatics(d, b);
};
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
var __assign = function() {
  __assign = Object.assign || function __assign2(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i];
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
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
function __setFunctionName(f, name2, prefix) {
  if (typeof name2 === "symbol") name2 = name2.description ? "[".concat(name2.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name2) : name2 });
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
var __createBinding = Object.create ? (function(o, m, k, k2) {
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
var __setModuleDefault = Object.create ? (function(o, v) {
  Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
  o["default"] = v;
};
var ownKeys = function(o) {
  ownKeys = Object.getOwnPropertyNames || function(o2) {
    var ar = [];
    for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
    return ar;
  };
  return ownKeys(o);
};
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
var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
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
const tslib_es6 = {
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
const tslib_es6$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  __addDisposableResource,
  get __assign() {
    return __assign;
  },
  __asyncDelegator,
  __asyncGenerator,
  __asyncValues,
  __await,
  __awaiter,
  __classPrivateFieldGet,
  __classPrivateFieldIn,
  __classPrivateFieldSet,
  __createBinding,
  __decorate,
  __disposeResources,
  __esDecorate,
  __exportStar,
  __extends,
  __generator,
  __importDefault,
  __importStar,
  __makeTemplateObject,
  __metadata,
  __param,
  __propKey,
  __read,
  __rest,
  __rewriteRelativeImportExtension,
  __runInitializers,
  __setFunctionName,
  __spread,
  __spreadArray,
  __spreadArrays,
  __values,
  default: tslib_es6
}, Symbol.toStringTag, { value: "Module" }));
const require$$0$1 = /* @__PURE__ */ getAugmentedNamespace(tslib_es6$1);
var kvs = {};
var entity = {};
var entityQuery = {};
var hasRequiredEntityQuery;
function requireEntityQuery() {
  if (hasRequiredEntityQuery) return entityQuery;
  hasRequiredEntityQuery = 1;
  Object.defineProperty(entityQuery, "__esModule", { value: true });
  entityQuery.FilterBuilder = entityQuery.BaseFilter = entityQuery.KvsIndexQueryBuilder = void 0;
  class KvsIndexQueryBuilder {
    entityName;
    storageApi;
    options;
    constructor(entityName, storageApi2, options) {
      this.entityName = entityName;
      this.storageApi = storageApi2;
      this.options = options;
    }
    index(name2, indexOptions) {
      return new KvsEntityQueryBuilder(this.storageApi, {
        ...this.options,
        entityName: this.entityName,
        indexName: name2,
        partition: indexOptions?.partition,
        filters: []
      });
    }
  }
  entityQuery.KvsIndexQueryBuilder = KvsIndexQueryBuilder;
  class KvsEntityQueryBuilder {
    storageApi;
    queryOptions;
    constructor(storageApi2, queryOptions) {
      this.storageApi = storageApi2;
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
  }
  class BaseFilter {
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
  }
  entityQuery.BaseFilter = BaseFilter;
  class FilterBuilder extends BaseFilter {
    and(field, condition) {
      return new AndFilterBuilder().and(field, condition);
    }
    or(field, condition) {
      return new OrFilterBuilder().or(field, condition);
    }
  }
  entityQuery.FilterBuilder = FilterBuilder;
  class AndFilterBuilder extends BaseFilter {
    and(field, condition) {
      this.items.push({ property: field, ...condition });
      return this;
    }
  }
  class OrFilterBuilder extends BaseFilter {
    or(field, condition) {
      this.items.push({ property: field, ...condition });
      return this;
    }
  }
  return entityQuery;
}
var hasRequiredEntity;
function requireEntity() {
  if (hasRequiredEntity) return entity;
  hasRequiredEntity = 1;
  Object.defineProperty(entity, "__esModule", { value: true });
  entity.EntityImpl = void 0;
  const entity_query_1 = requireEntityQuery();
  class EntityImpl {
    entityName;
    storageApi;
    constructor(entityName, storageApi2) {
      this.entityName = entityName;
      this.storageApi = storageApi2;
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
  }
  entity.EntityImpl = EntityImpl;
  return entity;
}
var query = {};
var hasRequiredQuery;
function requireQuery() {
  if (hasRequiredQuery) return query;
  hasRequiredQuery = 1;
  Object.defineProperty(query, "__esModule", { value: true });
  query.KvsQueryBuilder = void 0;
  class KvsQueryBuilder {
    storageApi;
    options;
    constructor(storageApi2, options = {}) {
      this.storageApi = storageApi2;
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
  }
  query.KvsQueryBuilder = KvsQueryBuilder;
  return query;
}
var transactionApi = {};
var transactionRequestBuilder = {};
var errors$1 = {};
var version$1 = {};
const name = "@forge/kvs";
const version = "1.6.5";
const require$$0 = {
  name,
  version
};
var hasRequiredVersion;
function requireVersion() {
  if (hasRequiredVersion) return version$1;
  hasRequiredVersion = 1;
  Object.defineProperty(version$1, "__esModule", { value: true });
  version$1.PACKAGE_VERSION = version$1.PACKAGE_NAME = void 0;
  const packageInfo = require$$0;
  version$1.PACKAGE_NAME = packageInfo.name;
  version$1.PACKAGE_VERSION = packageInfo.version;
  return version$1;
}
var hasRequiredErrors$1;
function requireErrors$1() {
  if (hasRequiredErrors$1) return errors$1;
  hasRequiredErrors$1 = 1;
  Object.defineProperty(errors$1, "__esModule", { value: true });
  errors$1.ForgeKvsAPIError = errors$1.ForgeKvsError = void 0;
  const version_1 = requireVersion();
  class ForgeKvsError extends Error {
    packageVersion;
    constructor(message, packageVersion = version_1.PACKAGE_VERSION) {
      super(message);
      this.name = "ForgeKvsError";
      this.packageVersion = packageVersion;
    }
  }
  errors$1.ForgeKvsError = ForgeKvsError;
  class ForgeKvsAPIError extends ForgeKvsError {
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
  }
  errors$1.ForgeKvsAPIError = ForgeKvsAPIError;
  return errors$1;
}
var hasRequiredTransactionRequestBuilder;
function requireTransactionRequestBuilder() {
  if (hasRequiredTransactionRequestBuilder) return transactionRequestBuilder;
  hasRequiredTransactionRequestBuilder = 1;
  Object.defineProperty(transactionRequestBuilder, "__esModule", { value: true });
  transactionRequestBuilder.buildRequestChecks = transactionRequestBuilder.buildRequestDeletes = transactionRequestBuilder.buildRequestSet = void 0;
  const errors_1 = requireErrors$1();
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
  const buildRequestSet = (setOperation) => {
    const { key, value, entity: entity2, options } = setOperation;
    const entityName = entity2?.entityName;
    const conditions2 = buildConditionsRequest(entity2?.conditions);
    return {
      key,
      value,
      entityName,
      conditions: conditions2,
      options
    };
  };
  transactionRequestBuilder.buildRequestSet = buildRequestSet;
  const buildRequestDeletes = (deleteOperation) => {
    const { key, entity: entity2 } = deleteOperation;
    const entityName = entity2?.entityName;
    const conditions2 = buildConditionsRequest(entity2?.conditions);
    return {
      key,
      entityName,
      conditions: conditions2
    };
  };
  transactionRequestBuilder.buildRequestDeletes = buildRequestDeletes;
  const buildRequestChecks = (checkOperation) => {
    const { key, entity: entity2 } = checkOperation;
    const entityName = entity2.entityName;
    const conditions2 = buildConditionsRequest(entity2.conditions);
    return {
      key,
      entityName,
      conditions: conditions2
    };
  };
  transactionRequestBuilder.buildRequestChecks = buildRequestChecks;
  return transactionRequestBuilder;
}
var hasRequiredTransactionApi;
function requireTransactionApi() {
  if (hasRequiredTransactionApi) return transactionApi;
  hasRequiredTransactionApi = 1;
  Object.defineProperty(transactionApi, "__esModule", { value: true });
  transactionApi.TransactionBuilderImpl = void 0;
  const transaction_request_builder_1 = requireTransactionRequestBuilder();
  class TransactionBuilderImpl {
    storageApi;
    sets;
    deletes;
    checks;
    constructor(storageApi2, sets = [], deletes = [], checks = []) {
      this.storageApi = storageApi2;
      this.sets = sets;
      this.deletes = deletes;
      this.checks = checks;
    }
    set(key, value, entity2, options) {
      const transactSet = {
        key,
        value,
        options
      };
      if (entity2) {
        transactSet.entity = {
          entityName: entity2.entityName,
          conditions: entity2.conditions
        };
      }
      this.sets.push(transactSet);
      return this;
    }
    delete(key, entity2) {
      const transactDelete = {
        key
      };
      if (entity2) {
        transactDelete.entity = {
          entityName: entity2.entityName,
          conditions: entity2.conditions
        };
      }
      this.deletes.push(transactDelete);
      return this;
    }
    check(key, { entityName, conditions: conditions2 }) {
      const transactCheck = {
        key,
        entity: {
          entityName,
          conditions: conditions2
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
  }
  transactionApi.TransactionBuilderImpl = TransactionBuilderImpl;
  return transactionApi;
}
var hasRequiredKvs;
function requireKvs() {
  if (hasRequiredKvs) return kvs;
  hasRequiredKvs = 1;
  Object.defineProperty(kvs, "__esModule", { value: true });
  kvs.KvsImpl = void 0;
  const entity_1 = requireEntity();
  const query_1 = requireQuery();
  const transaction_api_1 = requireTransactionApi();
  class KvsImpl {
    storageApi;
    constructor(storageApi2) {
      this.storageApi = storageApi2;
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
  }
  kvs.KvsImpl = KvsImpl;
  return kvs;
}
var storageApi = {};
var types$1 = {};
var hasRequiredTypes$1;
function requireTypes$1() {
  if (hasRequiredTypes$1) return types$1;
  hasRequiredTypes$1 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Sort = exports.isOverrideAndReturnOptions = exports.MetadataField = void 0;
    (function(MetadataField) {
      MetadataField["CREATED_AT"] = "CREATED_AT";
      MetadataField["UPDATED_AT"] = "UPDATED_AT";
      MetadataField["EXPIRE_TIME"] = "EXPIRE_TIME";
    })(exports.MetadataField || (exports.MetadataField = {}));
    function isOverrideAndReturnOptions(options) {
      return options !== void 0 && "returnValue" in options;
    }
    exports.isOverrideAndReturnOptions = isOverrideAndReturnOptions;
    (function(Sort) {
      Sort["ASC"] = "ASC";
      Sort["DESC"] = "DESC";
    })(exports.Sort || (exports.Sort = {}));
  })(types$1);
  return types$1;
}
var errorHandling = {};
var hasRequiredErrorHandling;
function requireErrorHandling() {
  if (hasRequiredErrorHandling) return errorHandling;
  hasRequiredErrorHandling = 1;
  Object.defineProperty(errorHandling, "__esModule", { value: true });
  errorHandling.checkResponseError = errorHandling.extractTraceId = errorHandling.getAPIErrorResponseDetails = errorHandling.safeGetParsedBody = errorHandling.isForgeError = void 0;
  const errors_1 = requireErrors$1();
  function isForgeError(body) {
    return typeof body === "object" && body !== null && "code" in body && "message" in body;
  }
  errorHandling.isForgeError = isForgeError;
  function safeGetParsedBody(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return void 0;
    }
  }
  errorHandling.safeGetParsedBody = safeGetParsedBody;
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
  errorHandling.getAPIErrorResponseDetails = getAPIErrorResponseDetails;
  function extractTraceId(response) {
    return response.headers.get("x-b3-traceid") || response.headers.get("x-trace-id");
  }
  errorHandling.extractTraceId = extractTraceId;
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
  errorHandling.checkResponseError = checkResponseError;
  return errorHandling;
}
var hasRequiredStorageApi;
function requireStorageApi() {
  if (hasRequiredStorageApi) return storageApi;
  hasRequiredStorageApi = 1;
  Object.defineProperty(storageApi, "__esModule", { value: true });
  storageApi.StorageApi = void 0;
  const types_1 = requireTypes$1();
  const error_handling_1 = requireErrorHandling();
  const errors_1 = requireErrors$1();
  var ResponseType;
  (function(ResponseType2) {
    ResponseType2[ResponseType2["NONE"] = 0] = "NONE";
    ResponseType2[ResponseType2["EXPECTED"] = 1] = "EXPECTED";
    ResponseType2[ResponseType2["OPTIONAL"] = 2] = "OPTIONAL";
  })(ResponseType || (ResponseType = {}));
  class StorageApi {
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
  }
  storageApi.StorageApi = StorageApi;
  return storageApi;
}
var conditions = {};
var hasRequiredConditions;
function requireConditions() {
  if (hasRequiredConditions) return conditions;
  hasRequiredConditions = 1;
  Object.defineProperty(conditions, "__esModule", { value: true });
  conditions.FilterConditions = conditions.WhereConditions = void 0;
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
  conditions.WhereConditions = {
    beginsWith,
    between,
    equalTo,
    greaterThan,
    greaterThanEqualTo,
    lessThan,
    lessThanEqualTo
  };
  conditions.FilterConditions = {
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
  return conditions;
}
var hasRequiredOut$4;
function requireOut$4() {
  if (hasRequiredOut$4) return out$4;
  hasRequiredOut$4 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.kvs = exports.Filter = exports.WhereConditions = exports.FilterConditions = void 0;
    const tslib_1 = require$$0$1;
    const kvs_1 = requireKvs();
    const storage_api_1 = requireStorageApi();
    function getFetchClient() {
      const runtime2 = commonjsGlobal.__forge_runtime__;
      if (runtime2?.kvs?.url && runtime2?.kvs?.host) {
        const { proxy, kvs: kvs3, tracing } = runtime2;
        return async function(path, options) {
          return await commonjsGlobal.__forge_fetch__({ type: "kvs" }, path, {
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
        return await commonjsGlobal.__forge_fetch__({
          type: "kvs",
          provider: "app",
          remote: "kvs"
        }, path, options);
      };
    }
    const storageApi2 = new storage_api_1.StorageApi(getFetchClient());
    const kvs2 = new kvs_1.KvsImpl(storageApi2);
    exports.kvs = kvs2;
    var conditions_1 = requireConditions();
    Object.defineProperty(exports, "FilterConditions", { enumerable: true, get: function() {
      return conditions_1.FilterConditions;
    } });
    Object.defineProperty(exports, "WhereConditions", { enumerable: true, get: function() {
      return conditions_1.WhereConditions;
    } });
    var entity_query_1 = requireEntityQuery();
    Object.defineProperty(exports, "Filter", { enumerable: true, get: function() {
      return entity_query_1.FilterBuilder;
    } });
    tslib_1.__exportStar(requireErrors$1(), exports);
    tslib_1.__exportStar(requireTypes$1(), exports);
    exports.default = kvs2;
  })(out$4);
  return out$4;
}
var outExports$1 = requireOut$4();
var out$3 = {};
var endpoint = {};
var errors = {};
var hasRequiredErrors;
function requireErrors() {
  if (hasRequiredErrors) return errors;
  hasRequiredErrors = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ApiNotReadyError = exports.ProxyRequestError = exports.InvalidContainerServiceError = exports.InvalidRemoteError = exports.NeedsAuthenticationError = exports.InvalidWorkspaceRequestedError = exports.RequestProductNotAllowedError = exports.ProductEndpointNotAllowedError = exports.ExternalEndpointNotAllowedError = exports.NotAllowedError = exports.FetchError = exports.HttpError = exports.API_NOT_READY_ERR = exports.PROXY_ERR = exports.INVALID_CONTAINER_SERVICE_ERR = exports.INVALID_REMOTE_ERR = exports.NEEDS_AUTHENTICATION_ERR = exports.FUNCTION_FETCH_ERR = exports.REQUEST_EGRESS_ALLOWLIST_ERR = exports.FUNCTION_ERR = void 0;
    exports.isForgePlatformError = isForgePlatformError;
    exports.isHostedCodeError = isHostedCodeError;
    exports.isExpectedError = isExpectedError;
    exports.FUNCTION_ERR = "FUNCTION_ERR";
    exports.REQUEST_EGRESS_ALLOWLIST_ERR = "REQUEST_EGRESS_ALLOWLIST_ERR";
    exports.FUNCTION_FETCH_ERR = "FUNCTION_FETCH_ERR";
    exports.NEEDS_AUTHENTICATION_ERR = "NEEDS_AUTHENTICATION_ERR";
    exports.INVALID_REMOTE_ERR = "INVALID_REMOTE_ERR";
    exports.INVALID_CONTAINER_SERVICE_ERR = "INVALID_CONTAINER_SERVICE_ERR";
    exports.PROXY_ERR = "PROXY_ERR";
    exports.API_NOT_READY_ERR = "API_NOT_READY_ERR";
    function isForgePlatformError(err) {
      return [
        exports.REQUEST_EGRESS_ALLOWLIST_ERR,
        exports.FUNCTION_FETCH_ERR,
        exports.NEEDS_AUTHENTICATION_ERR,
        exports.PROXY_ERR,
        exports.API_NOT_READY_ERR
      ].includes(err.name);
    }
    function isHostedCodeError(err) {
      return [exports.FUNCTION_ERR, exports.REQUEST_EGRESS_ALLOWLIST_ERR, exports.FUNCTION_FETCH_ERR, exports.NEEDS_AUTHENTICATION_ERR].includes(typeof err === "string" ? err : err.name);
    }
    function isExpectedError(err) {
      return err.name === exports.NEEDS_AUTHENTICATION_ERR && !!err.options?.isExpectedError;
    }
    class HttpError extends Error {
      status;
      constructor(message) {
        super(message);
      }
    }
    exports.HttpError = HttpError;
    class FetchError extends Error {
      constructor(cause) {
        super(cause);
        this.stack = void 0;
        this.name = exports.FUNCTION_FETCH_ERR;
      }
    }
    exports.FetchError = FetchError;
    class NotAllowedError extends HttpError {
      constructor(message) {
        super(message);
        this.stack = void 0;
        this.name = exports.REQUEST_EGRESS_ALLOWLIST_ERR;
        this.status = 403;
      }
    }
    exports.NotAllowedError = NotAllowedError;
    class ExternalEndpointNotAllowedError extends NotAllowedError {
      constructor(failedURL) {
        super(`URL not included in the external fetch backend permissions: ${failedURL}. Visit go.atlassian.com/forge-egress for more information.`);
      }
    }
    exports.ExternalEndpointNotAllowedError = ExternalEndpointNotAllowedError;
    class ProductEndpointNotAllowedError extends NotAllowedError {
      constructor(failedURL) {
        super(`URL not allowed: ${failedURL}.`);
      }
    }
    exports.ProductEndpointNotAllowedError = ProductEndpointNotAllowedError;
    class RequestProductNotAllowedError extends NotAllowedError {
      constructor(requestedProduct, invocationProduct) {
        super(`Request ${requestedProduct} is not allowed from ${invocationProduct} context.`);
      }
    }
    exports.RequestProductNotAllowedError = RequestProductNotAllowedError;
    class InvalidWorkspaceRequestedError extends NotAllowedError {
      constructor(failedURL) {
        super(`Invalid workspace requested in URL: ${failedURL}.`);
      }
    }
    exports.InvalidWorkspaceRequestedError = InvalidWorkspaceRequestedError;
    class NeedsAuthenticationError extends HttpError {
      serviceKey;
      options;
      constructor(error, serviceKey, options) {
        super(error);
        this.serviceKey = serviceKey;
        this.options = options;
        this.stack = void 0;
        this.name = exports.NEEDS_AUTHENTICATION_ERR;
        this.status = 401;
      }
    }
    exports.NeedsAuthenticationError = NeedsAuthenticationError;
    class InvalidRemoteError extends HttpError {
      remoteKey;
      constructor(error, remoteKey) {
        super(error);
        this.remoteKey = remoteKey;
        this.name = exports.INVALID_REMOTE_ERR;
        this.status = 400;
      }
    }
    exports.InvalidRemoteError = InvalidRemoteError;
    class InvalidContainerServiceError extends HttpError {
      serviceKey;
      constructor(error, serviceKey) {
        super(error);
        this.serviceKey = serviceKey;
        this.name = exports.INVALID_CONTAINER_SERVICE_ERR;
        this.status = 400;
      }
    }
    exports.InvalidContainerServiceError = InvalidContainerServiceError;
    class ProxyRequestError extends HttpError {
      status;
      errorCode;
      constructor(status, errorCode) {
        super(`Forge platform failed to process runtime HTTP request - ${status} - ${errorCode}`);
        this.status = status;
        this.errorCode = errorCode;
        this.name = exports.PROXY_ERR;
      }
    }
    exports.ProxyRequestError = ProxyRequestError;
    class ApiNotReadyError extends Error {
      constructor(message = "Forge API currently not available") {
        super(message);
        this.name = exports.API_NOT_READY_ERR;
      }
    }
    exports.ApiNotReadyError = ApiNotReadyError;
  })(errors);
  return errors;
}
var fetch$1 = {};
var safeUrl = {};
var hasRequiredSafeUrl;
function requireSafeUrl_1() {
  if (hasRequiredSafeUrl) return safeUrl;
  hasRequiredSafeUrl = 1;
  Object.defineProperty(safeUrl, "__esModule", { value: true });
  safeUrl.isRoute = isRoute;
  safeUrl.routeFromAbsolute = routeFromAbsolute;
  safeUrl.route = route;
  safeUrl.requireSafeUrl = requireSafeUrl;
  safeUrl.assumeTrustedRoute = assumeTrustedRoute;
  class ReadonlyRoute {
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
  }
  function isRoute(x) {
    return x instanceof ReadonlyRoute;
  }
  function routeFromAbsolute(absolutePath) {
    const absoluteURL = new URL(absolutePath);
    return assumeTrustedRoute(`${absoluteURL.pathname}${absoluteURL.search}`);
  }
  const DOUBLE_DOT = ["..", ".%2e", "%2e.", "%2e%2e", ".%2E", "%2E.", "%2E%2e"];
  const DIRECTORY_PATH = ["/", "\\"];
  const ENDS_PATH = ["?", "#"];
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
  function route(template, ...parameters) {
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
  function assumeTrustedRoute(route2) {
    return new ReadonlyRoute(route2);
  }
  return safeUrl;
}
var runtime = {};
var ari = {};
var hasRequiredAri;
function requireAri() {
  if (hasRequiredAri) return ari;
  hasRequiredAri = 1;
  Object.defineProperty(ari, "__esModule", { value: true });
  ari.getInstallationAri = ari.getEnvironmentAri = ari.getAppAri = void 0;
  const getAppAri = (appId) => ({
    appId,
    toString: () => `ari:cloud:ecosystem::app/${appId}`,
    toJSON: () => `ari:cloud:ecosystem::app/${appId}`
  });
  ari.getAppAri = getAppAri;
  const getEnvironmentAri = (appId, environmentId) => ({
    environmentId,
    toString: () => `ari:cloud:ecosystem::environment/${appId}/${environmentId}`,
    toJSON: () => `ari:cloud:ecosystem::environment/${appId}/${environmentId}`
  });
  ari.getEnvironmentAri = getEnvironmentAri;
  const getInstallationAri = (installationId) => ({
    installationId,
    toString: () => `ari:cloud:ecosystem::installation/${installationId}`,
    toJSON: () => `ari:cloud:ecosystem::installation/${installationId}`
  });
  ari.getInstallationAri = getInstallationAri;
  return ari;
}
var hasRequiredRuntime;
function requireRuntime() {
  if (hasRequiredRuntime) return runtime;
  hasRequiredRuntime = 1;
  Object.defineProperty(runtime, "__esModule", { value: true });
  runtime.MissingPermissions = runtime.PermissionRequirements = runtime.RuntimePermissions = runtime.Permissions = void 0;
  runtime.__getRuntime = __getRuntime;
  runtime.getAppContext = getAppContext;
  runtime.wrapInMetrics = wrapInMetrics;
  runtime.bindInvocationContext = bindInvocationContext;
  const errors_1 = requireErrors();
  const ari_1 = requireAri();
  const extractUrlString = (item) => {
    if (typeof item === "string") {
      return item;
    } else if ("address" in item) {
      return item.address;
    } else {
      return item.remote;
    }
  };
  const formatScopesSection = (scopes) => {
    if (scopes && Array.isArray(scopes) && scopes.length > 0) {
      return `Scopes: ${scopes.join(", ")}`;
    }
    return null;
  };
  const formatExternalSection = (external) => {
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
  const getFetchPermissions = (fetch2) => {
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
  class Permissions {
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
  }
  runtime.Permissions = Permissions;
  class RuntimePermissions extends Permissions {
    scopes;
    external;
    constructor(scopes, external) {
      super();
      this.scopes = scopes;
      this.external = external;
    }
  }
  runtime.RuntimePermissions = RuntimePermissions;
  class PermissionRequirements extends Permissions {
    scopes;
    external;
    constructor(scopes, external) {
      super();
      this.scopes = scopes;
      this.external = external;
    }
  }
  runtime.PermissionRequirements = PermissionRequirements;
  class MissingPermissions extends Permissions {
    scopes;
    external;
    constructor(scopes, external) {
      super();
      this.scopes = scopes;
      this.external = external;
    }
  }
  runtime.MissingPermissions = MissingPermissions;
  function __getRuntime() {
    const runtime2 = commonjsGlobal.__forge_runtime__;
    if (!runtime2) {
      throw new Error("Forge runtime not found.");
    }
    return runtime2;
  }
  function getAppContext() {
    const runtime2 = __getRuntime();
    const { appId, appVersion, environmentId, environmentType, invocationId, installationId, moduleKey, license, installation, permissions: permissions2 } = runtime2.appContext;
    const invocationRemainingTimeInMillis = runtime2.lambdaContext.getRemainingTimeInMillis ?? (() => {
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
      permissions: new RuntimePermissions(permissions2?.scopes || [], permissions2?.external || {})
    };
  }
  function wrapInMetrics(name2, fn) {
    return async (...args) => {
      const { metrics } = __getRuntime();
      metrics.counter(name2).incr();
      const timer = metrics.timing(name2).measure();
      let success = true;
      try {
        return await fn(...args);
      } catch (e) {
        const undiciError = commonjsGlobal.__forge_undici_error__;
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
    const AsyncLocalStorage = require$$2.AsyncLocalStorage;
    return AsyncLocalStorage.bind(fn);
  }
  return runtime;
}
var hasRequiredFetch;
function requireFetch() {
  if (hasRequiredFetch) return fetch$1;
  hasRequiredFetch = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.__requestAtlassianAsUser = exports.__requestAtlassianAsApp = exports.wrapRequestConnectedData = exports.wrapRequestTeamworkGraph = exports.wrapRequestGraph = exports.handleProxyResponseErrors = exports.getForgeProxyError = void 0;
    exports.__fetchProduct = __fetchProduct;
    exports.fetchRemote = fetchRemote;
    exports.getFetchAPI = getFetchAPI;
    const safeUrl_1 = requireSafeUrl_1();
    const errors_1 = requireErrors();
    const runtime_1 = requireRuntime();
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
        const response = await commonjsGlobal.__forge_fetch__({
          type: args.type,
          provider: args.provider,
          accountId: args.accountId,
          ...args.remote ? { remote: args.remote } : {},
          ...args.contextAri ? { contextAri: args.contextAri } : {}
        }, path, init);
        (0, exports.handleProxyResponseErrors)(response);
        return response;
      };
    }
    function fetchRemote(args) {
      return async (path, init) => {
        const response = await commonjsGlobal.__forge_fetch__({
          type: "tpp",
          provider: args.provider,
          remote: args.remote,
          accountId: args.account
        }, path, init);
        (0, exports.handleProxyResponseErrors)(response);
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
    const ATLASSIAN_TOKEN_SERVICE_KEY = "atlassian-token-service-key";
    const getForgeProxyError = (response) => response.headers.get("forge-proxy-error");
    exports.getForgeProxyError = getForgeProxyError;
    const handleProxyResponseErrors = (response) => {
      const errorReason = (0, exports.getForgeProxyError)(response);
      if (errorReason) {
        if (errorReason === "NEEDS_AUTHENTICATION_ERR") {
          throw new errors_1.NeedsAuthenticationError("Authentication Required", ATLASSIAN_TOKEN_SERVICE_KEY);
        }
        throw new errors_1.ProxyRequestError(response.status, errorReason);
      }
    };
    exports.handleProxyResponseErrors = handleProxyResponseErrors;
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
    const throwNotImplementedError = () => {
      throw new Error("not implemented");
    };
    const withProvider = (provider, remote) => {
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
    const withContext = (provider, accountId) => (contextAri) => {
      const requestProductFn = wrapRequestProduct(__fetchProduct({ provider, contextAri, type: "fpp", accountId }));
      return {
        requestJira: requestProductFn,
        requestConfluence: requestProductFn,
        requestBitbucket: requestProductFn
      };
    };
    const wrapWithRouteUnwrapper = (fetch2) => (path, init) => {
      const stringPath = (0, safeUrl_1.isRoute)(path) ? path.value : path;
      return fetch2(stringPath, init);
    };
    const wrapRequestProduct = (requestProduct) => (path, init) => {
      const safeUrl2 = (0, safeUrl_1.requireSafeUrl)(path);
      return requestProduct(safeUrl2.value, init);
    };
    const wrapRequestGraph = (requestGraphApi) => (query2, variables, headers = {}) => requestGraphApi("/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query2,
        ...variables ? { variables } : {}
      })
    });
    exports.wrapRequestGraph = wrapRequestGraph;
    const wrapRequestTeamworkGraph = (requestGraphApi) => (query2, variables, operationName, extensions, headers = {}) => requestGraphApi("/graphql/twg", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query2,
        ...variables ? { variables } : {},
        ...operationName ? { operationName } : {},
        ...extensions ? { extensions } : {}
      })
    });
    exports.wrapRequestTeamworkGraph = wrapRequestTeamworkGraph;
    const wrapRequestConnectedData = (fetch2) => (path, init) => {
      const safeUrl2 = (0, safeUrl_1.requireSafeUrl)(path);
      return fetch2(`/connected-data/${safeUrl2.value.replace(/^\/+/, "")}`, init);
    };
    exports.wrapRequestConnectedData = wrapRequestConnectedData;
    function getFetchAPI() {
      if (commonjsGlobal.fetch === void 0) {
        commonjsGlobal.fetch = async () => {
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
          requestGraph: (0, exports.wrapRequestGraph)(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp", accountId: userId })),
          requestTeamworkGraph: (0, exports.wrapRequestTeamworkGraph)(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp", accountId: userId })),
          requestConnectedData: (0, exports.wrapRequestConnectedData)(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp" })),
          requestAtlassian: wrapRequestProduct(__fetchProduct({ provider: "user", remote: "stargate", type: "fpp", accountId: userId })),
          withProvider,
          withContext: withContext("user", userId)
        }),
        asApp: () => ({
          requestJira: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "jira", type: "fpp" })),
          requestConfluence: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "confluence", type: "fpp" })),
          requestBitbucket: wrapRequestProduct(__fetchProduct({ provider: "app", remote: "bitbucket", type: "fpp" })),
          requestGraph: (0, exports.wrapRequestGraph)(__fetchProduct({ provider: "app", remote: "stargate", type: "fpp" })),
          requestConnectedData: (0, exports.wrapRequestConnectedData)(__fetchProduct({ provider: "app", remote: "stargate", type: "fpp" })),
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
    exports.__requestAtlassianAsApp = getRequestStargate("app");
    exports.__requestAtlassianAsUser = getRequestStargate("user");
  })(fetch$1);
  return fetch$1;
}
var hasRequiredEndpoint;
function requireEndpoint() {
  if (hasRequiredEndpoint) return endpoint;
  hasRequiredEndpoint = 1;
  Object.defineProperty(endpoint, "__esModule", { value: true });
  endpoint.invokeRemote = invokeRemote;
  endpoint.invokeService = invokeService;
  const errors_1 = requireErrors();
  const fetch_1 = requireFetch();
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
    const response = await commonjsGlobal.__forge_fetch__(constructInvokePayload(key, type), path, fetchOptions);
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
  return endpoint;
}
var authorization = {};
var out$2 = {};
var confluence = {};
var api = {};
var hasRequiredApi;
function requireApi() {
  if (hasRequiredApi) return api;
  hasRequiredApi = 1;
  Object.defineProperty(api, "__esModule", { value: true });
  api.createApiMethods = void 0;
  const fromEntries = (array) => {
    return array.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  };
  const createApiMethods = (methodToPermissionMap, permissionCheckFactory) => {
    const apiMethodEntries = Object.entries(methodToPermissionMap).map(([methodName, permission]) => [methodName, permissionCheckFactory(permission)]);
    return fromEntries(apiMethodEntries);
  };
  api.createApiMethods = createApiMethods;
  return api;
}
var permissions$2 = {};
var hasRequiredPermissions$2;
function requirePermissions$2() {
  if (hasRequiredPermissions$2) return permissions$2;
  hasRequiredPermissions$2 = 1;
  Object.defineProperty(permissions$2, "__esModule", { value: true });
  const API_PERMISSIONS_MAP = {
    canRead: "read",
    canUpdate: "update",
    canDelete: "delete"
  };
  permissions$2.default = API_PERMISSIONS_MAP;
  return permissions$2;
}
var hasRequiredConfluence;
function requireConfluence() {
  if (hasRequiredConfluence) return confluence;
  hasRequiredConfluence = 1;
  Object.defineProperty(confluence, "__esModule", { value: true });
  confluence.authorizeConfluenceWithFetch = void 0;
  const tslib_1 = require$$0$1;
  const api_1 = requireApi();
  const permissions_1 = tslib_1.__importDefault(requirePermissions$2());
  const checkConfluencePermissions = async (requestConfluence, accountId, contentId, permission) => {
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
  const getPermissionsCheckFactory = (requestConfluence, accountId, contentId) => (permission) => {
    return async () => {
      const res = await checkConfluencePermissions(requestConfluence, accountId, contentId, permission);
      return Boolean(res?.hasPermission);
    };
  };
  const authorizeConfluenceWithFetch = (requestConfluence, accountId) => {
    return {
      onConfluenceContent: (contentId) => (0, api_1.createApiMethods)(permissions_1.default, getPermissionsCheckFactory(requestConfluence, accountId, contentId))
    };
  };
  confluence.authorizeConfluenceWithFetch = authorizeConfluenceWithFetch;
  return confluence;
}
var jira = {};
var permissions$1 = {};
var hasRequiredPermissions$1;
function requirePermissions$1() {
  if (hasRequiredPermissions$1) return permissions$1;
  hasRequiredPermissions$1 = 1;
  Object.defineProperty(permissions$1, "__esModule", { value: true });
  permissions$1.API_PROJECTS_PERMISSIONS_MAP = permissions$1.API_ISSUES_PERMISSIONS_MAP = void 0;
  const API_ISSUES_PERMISSIONS_MAP = {
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
  permissions$1.API_ISSUES_PERMISSIONS_MAP = API_ISSUES_PERMISSIONS_MAP;
  const API_PROJECTS_PERMISSIONS_MAP = {
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
  permissions$1.API_PROJECTS_PERMISSIONS_MAP = API_PROJECTS_PERMISSIONS_MAP;
  return permissions$1;
}
var hasRequiredJira;
function requireJira() {
  if (hasRequiredJira) return jira;
  hasRequiredJira = 1;
  Object.defineProperty(jira, "__esModule", { value: true });
  jira.authorizeJiraWithFetch = void 0;
  const api_1 = requireApi();
  const permissions_1 = requirePermissions$1();
  const arrayEquals = (a, b) => {
    return JSON.stringify(Array.from(a.map(String)).sort()) === JSON.stringify(Array.from(b.map(String)).sort());
  };
  const checkJiraPermissions = async (requestJira, accountId, projectPermissions) => {
    const res = await requestJira("/rest/api/3/permissions/check", {
      method: "post",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        projectPermissions
      })
    });
    return res;
  };
  const hasPermissionsForEntities = (projectPermissions, permission, type, entities) => {
    if (!entities || entities.length === 0)
      return true;
    const allowedEntities = projectPermissions.find((permissionResponse) => permissionResponse.permission === permission)?.[type];
    return !!allowedEntities && arrayEquals(allowedEntities, entities);
  };
  const getPermissionCheckFactory = (requestJira, accountId, type, entities) => (permission) => {
    return async () => {
      const { projectPermissions } = await checkJiraPermissions(requestJira, accountId, [
        {
          permissions: [permission],
          [type]: entities
        }
      ]);
      return hasPermissionsForEntities(projectPermissions, permission, type, entities);
    };
  };
  const toArray = (id) => Array.isArray(id) ? id : [id];
  const authorizeJiraWithFetch = (requestJira, accountId) => {
    return {
      onJira: async (projectPermissionsInput) => {
        const result = await checkJiraPermissions(requestJira, accountId, projectPermissionsInput);
        return result.projectPermissions || [];
      },
      onJiraProject: (projects) => (0, api_1.createApiMethods)(permissions_1.API_PROJECTS_PERMISSIONS_MAP, getPermissionCheckFactory(requestJira, accountId, "projects", toArray(projects))),
      onJiraIssue: (issues) => (0, api_1.createApiMethods)(permissions_1.API_ISSUES_PERMISSIONS_MAP, getPermissionCheckFactory(requestJira, accountId, "issues", toArray(issues)))
    };
  };
  jira.authorizeJiraWithFetch = authorizeJiraWithFetch;
  return jira;
}
var hasRequiredOut$3;
function requireOut$3() {
  if (hasRequiredOut$3) return out$2;
  hasRequiredOut$3 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.authorizeJiraWithFetch = exports.authorizeConfluenceWithFetch = void 0;
    var confluence_1 = requireConfluence();
    Object.defineProperty(exports, "authorizeConfluenceWithFetch", { enumerable: true, get: function() {
      return confluence_1.authorizeConfluenceWithFetch;
    } });
    var jira_1 = requireJira();
    Object.defineProperty(exports, "authorizeJiraWithFetch", { enumerable: true, get: function() {
      return jira_1.authorizeJiraWithFetch;
    } });
  })(out$2);
  return out$2;
}
var hasRequiredAuthorization;
function requireAuthorization() {
  if (hasRequiredAuthorization) return authorization;
  hasRequiredAuthorization = 1;
  Object.defineProperty(authorization, "__esModule", { value: true });
  authorization.authorize = void 0;
  const auth_1 = requireOut$3();
  const __1 = requireOut();
  const authorize = () => {
    const accountId = (0, __1.__getRuntime)().aaid;
    if (!accountId) {
      throw new Error(`Couldn’t find the accountId of the invoking user. This API can only be used inside user-invoked modules.`);
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
  authorization.authorize = authorize;
  return authorization;
}
var privacy = {};
var hasRequiredPrivacy;
function requirePrivacy() {
  if (hasRequiredPrivacy) return privacy;
  hasRequiredPrivacy = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createReportPersonalData = exports.LIMIT = exports.URL = void 0;
    exports.URL = "/app/report-accounts";
    exports.LIMIT = 90;
    const createReportPersonalData = (requestAtlassian) => {
      return function fetchUpdates(accounts) {
        if (accounts.length === 0) {
          return Promise.resolve([]);
        }
        const request = requestAtlassian(exports.URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accounts: accounts.slice(0, exports.LIMIT) })
        }).then(async (resp) => {
          if (resp.status === 200) {
            return (await resp.json()).accounts;
          }
          if (resp.status === 204) {
            return [];
          }
          return Promise.reject(resp);
        });
        return Promise.all([request, fetchUpdates(accounts.slice(exports.LIMIT))]).then(([first, second]) => first.concat(second));
      };
    };
    exports.createReportPersonalData = createReportPersonalData;
  })(privacy);
  return privacy;
}
var webTrigger = {};
var hasRequiredWebTrigger;
function requireWebTrigger() {
  if (hasRequiredWebTrigger) return webTrigger;
  hasRequiredWebTrigger = 1;
  Object.defineProperty(webTrigger, "__esModule", { value: true });
  webTrigger.webTrigger = void 0;
  const runtime_1 = requireRuntime();
  const fetch_1 = requireFetch();
  const proxyGetWebTriggerURL = (0, runtime_1.wrapInMetrics)("api.getWebTriggerUrl", async (webTriggerModuleKey, forceCreate, secretKeyConfig) => {
    const runtime2 = (0, runtime_1.__getRuntime)();
    const input = {
      appId: runtime2.appContext.appId,
      envId: runtime2.appContext.environmentId,
      triggerKey: webTriggerModuleKey,
      contextId: runtime2.contextAri,
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
  const proxyDeleteWebTriggerURL = (0, runtime_1.wrapInMetrics)("api.deleteWebTriggerUrl", async (webTriggerUrl) => {
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
  const proxyQueryWebTriggerURLs = (0, runtime_1.wrapInMetrics)("api.queryWebTriggerUrls", async (moduleKey) => {
    const runtime2 = (0, runtime_1.__getRuntime)();
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
          appId: runtime2.appContext.appId,
          envId: runtime2.appContext.environmentId,
          contextId: runtime2.contextAri
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
  webTrigger.webTrigger = {
    getUrl: async (webTriggerModuleKey, optionsOrForceCreate) => {
      const forceCreate = typeof optionsOrForceCreate === "boolean" ? optionsOrForceCreate : optionsOrForceCreate?.forceCreate ?? false;
      const secretKeyConfig = typeof optionsOrForceCreate === "object" && optionsOrForceCreate !== null ? optionsOrForceCreate.secretKeyConfig : void 0;
      return proxyGetWebTriggerURL(webTriggerModuleKey, forceCreate, secretKeyConfig);
    },
    deleteUrl: async (webTriggerUrl) => proxyDeleteWebTriggerURL(webTriggerUrl),
    queryUrls: async (moduleKey) => proxyQueryWebTriggerURLs(moduleKey)
  };
  return webTrigger;
}
var i18n = {};
var out$1 = {};
var constants = {};
var hasRequiredConstants;
function requireConstants() {
  if (hasRequiredConstants) return constants;
  hasRequiredConstants = 1;
  Object.defineProperty(constants, "__esModule", { value: true });
  constants.FORGE_SUPPORTED_LOCALE_CODES = constants.I18N_BUNDLE_FOLDER_NAME = constants.I18N_INFO_FILE_NAME = void 0;
  constants.I18N_INFO_FILE_NAME = "i18n-info.json";
  constants.I18N_BUNDLE_FOLDER_NAME = "__LOCALES__";
  constants.FORGE_SUPPORTED_LOCALE_CODES = [
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
  return constants;
}
var translationsGetter = {};
var hasRequiredTranslationsGetter;
function requireTranslationsGetter() {
  if (hasRequiredTranslationsGetter) return translationsGetter;
  hasRequiredTranslationsGetter = 1;
  Object.defineProperty(translationsGetter, "__esModule", { value: true });
  translationsGetter.TranslationsGetter = translationsGetter.TranslationGetterError = void 0;
  const pushIfNotExists = (array, item) => {
    if (!array.includes(item)) {
      array.push(item);
    }
  };
  class TranslationGetterError extends Error {
    constructor(message) {
      super(message);
      this.name = "TranslationGetterError";
    }
  }
  translationsGetter.TranslationGetterError = TranslationGetterError;
  class TranslationsGetter {
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
  }
  translationsGetter.TranslationsGetter = TranslationsGetter;
  return translationsGetter;
}
var translator = {};
var translationValueGetter = {};
var isArray_1;
var hasRequiredIsArray;
function requireIsArray() {
  if (hasRequiredIsArray) return isArray_1;
  hasRequiredIsArray = 1;
  var isArray = Array.isArray;
  isArray_1 = isArray;
  return isArray_1;
}
var _freeGlobal;
var hasRequired_freeGlobal;
function require_freeGlobal() {
  if (hasRequired_freeGlobal) return _freeGlobal;
  hasRequired_freeGlobal = 1;
  var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
  _freeGlobal = freeGlobal;
  return _freeGlobal;
}
var _root;
var hasRequired_root;
function require_root() {
  if (hasRequired_root) return _root;
  hasRequired_root = 1;
  var freeGlobal = require_freeGlobal();
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal || freeSelf || Function("return this")();
  _root = root;
  return _root;
}
var _Symbol;
var hasRequired_Symbol;
function require_Symbol() {
  if (hasRequired_Symbol) return _Symbol;
  hasRequired_Symbol = 1;
  var root = require_root();
  var Symbol2 = root.Symbol;
  _Symbol = Symbol2;
  return _Symbol;
}
var _getRawTag;
var hasRequired_getRawTag;
function require_getRawTag() {
  if (hasRequired_getRawTag) return _getRawTag;
  hasRequired_getRawTag = 1;
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
  _getRawTag = getRawTag;
  return _getRawTag;
}
var _objectToString;
var hasRequired_objectToString;
function require_objectToString() {
  if (hasRequired_objectToString) return _objectToString;
  hasRequired_objectToString = 1;
  var objectProto = Object.prototype;
  var nativeObjectToString = objectProto.toString;
  function objectToString(value) {
    return nativeObjectToString.call(value);
  }
  _objectToString = objectToString;
  return _objectToString;
}
var _baseGetTag;
var hasRequired_baseGetTag;
function require_baseGetTag() {
  if (hasRequired_baseGetTag) return _baseGetTag;
  hasRequired_baseGetTag = 1;
  var Symbol2 = require_Symbol(), getRawTag = require_getRawTag(), objectToString = require_objectToString();
  var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
  var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
  function baseGetTag(value) {
    if (value == null) {
      return value === void 0 ? undefinedTag : nullTag;
    }
    return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
  }
  _baseGetTag = baseGetTag;
  return _baseGetTag;
}
var isObjectLike_1;
var hasRequiredIsObjectLike;
function requireIsObjectLike() {
  if (hasRequiredIsObjectLike) return isObjectLike_1;
  hasRequiredIsObjectLike = 1;
  function isObjectLike(value) {
    return value != null && typeof value == "object";
  }
  isObjectLike_1 = isObjectLike;
  return isObjectLike_1;
}
var isSymbol_1;
var hasRequiredIsSymbol;
function requireIsSymbol() {
  if (hasRequiredIsSymbol) return isSymbol_1;
  hasRequiredIsSymbol = 1;
  var baseGetTag = require_baseGetTag(), isObjectLike = requireIsObjectLike();
  var symbolTag = "[object Symbol]";
  function isSymbol(value) {
    return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
  }
  isSymbol_1 = isSymbol;
  return isSymbol_1;
}
var _isKey;
var hasRequired_isKey;
function require_isKey() {
  if (hasRequired_isKey) return _isKey;
  hasRequired_isKey = 1;
  var isArray = requireIsArray(), isSymbol = requireIsSymbol();
  var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/;
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
  _isKey = isKey;
  return _isKey;
}
var isObject_1;
var hasRequiredIsObject;
function requireIsObject() {
  if (hasRequiredIsObject) return isObject_1;
  hasRequiredIsObject = 1;
  function isObject(value) {
    var type = typeof value;
    return value != null && (type == "object" || type == "function");
  }
  isObject_1 = isObject;
  return isObject_1;
}
var isFunction_1;
var hasRequiredIsFunction;
function requireIsFunction() {
  if (hasRequiredIsFunction) return isFunction_1;
  hasRequiredIsFunction = 1;
  var baseGetTag = require_baseGetTag(), isObject = requireIsObject();
  var asyncTag = "[object AsyncFunction]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";
  function isFunction(value) {
    if (!isObject(value)) {
      return false;
    }
    var tag = baseGetTag(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
  }
  isFunction_1 = isFunction;
  return isFunction_1;
}
var _coreJsData;
var hasRequired_coreJsData;
function require_coreJsData() {
  if (hasRequired_coreJsData) return _coreJsData;
  hasRequired_coreJsData = 1;
  var root = require_root();
  var coreJsData = root["__core-js_shared__"];
  _coreJsData = coreJsData;
  return _coreJsData;
}
var _isMasked;
var hasRequired_isMasked;
function require_isMasked() {
  if (hasRequired_isMasked) return _isMasked;
  hasRequired_isMasked = 1;
  var coreJsData = require_coreJsData();
  var maskSrcKey = (function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
  })();
  function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
  }
  _isMasked = isMasked;
  return _isMasked;
}
var _toSource;
var hasRequired_toSource;
function require_toSource() {
  if (hasRequired_toSource) return _toSource;
  hasRequired_toSource = 1;
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
  _toSource = toSource;
  return _toSource;
}
var _baseIsNative;
var hasRequired_baseIsNative;
function require_baseIsNative() {
  if (hasRequired_baseIsNative) return _baseIsNative;
  hasRequired_baseIsNative = 1;
  var isFunction = requireIsFunction(), isMasked = require_isMasked(), isObject = requireIsObject(), toSource = require_toSource();
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  var funcProto = Function.prototype, objectProto = Object.prototype;
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
  _baseIsNative = baseIsNative;
  return _baseIsNative;
}
var _getValue;
var hasRequired_getValue;
function require_getValue() {
  if (hasRequired_getValue) return _getValue;
  hasRequired_getValue = 1;
  function getValue(object, key) {
    return object == null ? void 0 : object[key];
  }
  _getValue = getValue;
  return _getValue;
}
var _getNative;
var hasRequired_getNative;
function require_getNative() {
  if (hasRequired_getNative) return _getNative;
  hasRequired_getNative = 1;
  var baseIsNative = require_baseIsNative(), getValue = require_getValue();
  function getNative(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : void 0;
  }
  _getNative = getNative;
  return _getNative;
}
var _nativeCreate;
var hasRequired_nativeCreate;
function require_nativeCreate() {
  if (hasRequired_nativeCreate) return _nativeCreate;
  hasRequired_nativeCreate = 1;
  var getNative = require_getNative();
  var nativeCreate = getNative(Object, "create");
  _nativeCreate = nativeCreate;
  return _nativeCreate;
}
var _hashClear;
var hasRequired_hashClear;
function require_hashClear() {
  if (hasRequired_hashClear) return _hashClear;
  hasRequired_hashClear = 1;
  var nativeCreate = require_nativeCreate();
  function hashClear() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
    this.size = 0;
  }
  _hashClear = hashClear;
  return _hashClear;
}
var _hashDelete;
var hasRequired_hashDelete;
function require_hashDelete() {
  if (hasRequired_hashDelete) return _hashDelete;
  hasRequired_hashDelete = 1;
  function hashDelete(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  }
  _hashDelete = hashDelete;
  return _hashDelete;
}
var _hashGet;
var hasRequired_hashGet;
function require_hashGet() {
  if (hasRequired_hashGet) return _hashGet;
  hasRequired_hashGet = 1;
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
  _hashGet = hashGet;
  return _hashGet;
}
var _hashHas;
var hasRequired_hashHas;
function require_hashHas() {
  if (hasRequired_hashHas) return _hashHas;
  hasRequired_hashHas = 1;
  var nativeCreate = require_nativeCreate();
  var objectProto = Object.prototype;
  var hasOwnProperty = objectProto.hasOwnProperty;
  function hashHas(key) {
    var data = this.__data__;
    return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
  }
  _hashHas = hashHas;
  return _hashHas;
}
var _hashSet;
var hasRequired_hashSet;
function require_hashSet() {
  if (hasRequired_hashSet) return _hashSet;
  hasRequired_hashSet = 1;
  var nativeCreate = require_nativeCreate();
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  function hashSet(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
    return this;
  }
  _hashSet = hashSet;
  return _hashSet;
}
var _Hash;
var hasRequired_Hash;
function require_Hash() {
  if (hasRequired_Hash) return _Hash;
  hasRequired_Hash = 1;
  var hashClear = require_hashClear(), hashDelete = require_hashDelete(), hashGet = require_hashGet(), hashHas = require_hashHas(), hashSet = require_hashSet();
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
  _Hash = Hash;
  return _Hash;
}
var _listCacheClear;
var hasRequired_listCacheClear;
function require_listCacheClear() {
  if (hasRequired_listCacheClear) return _listCacheClear;
  hasRequired_listCacheClear = 1;
  function listCacheClear() {
    this.__data__ = [];
    this.size = 0;
  }
  _listCacheClear = listCacheClear;
  return _listCacheClear;
}
var eq_1;
var hasRequiredEq;
function requireEq() {
  if (hasRequiredEq) return eq_1;
  hasRequiredEq = 1;
  function eq(value, other) {
    return value === other || value !== value && other !== other;
  }
  eq_1 = eq;
  return eq_1;
}
var _assocIndexOf;
var hasRequired_assocIndexOf;
function require_assocIndexOf() {
  if (hasRequired_assocIndexOf) return _assocIndexOf;
  hasRequired_assocIndexOf = 1;
  var eq = requireEq();
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }
  _assocIndexOf = assocIndexOf;
  return _assocIndexOf;
}
var _listCacheDelete;
var hasRequired_listCacheDelete;
function require_listCacheDelete() {
  if (hasRequired_listCacheDelete) return _listCacheDelete;
  hasRequired_listCacheDelete = 1;
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
  _listCacheDelete = listCacheDelete;
  return _listCacheDelete;
}
var _listCacheGet;
var hasRequired_listCacheGet;
function require_listCacheGet() {
  if (hasRequired_listCacheGet) return _listCacheGet;
  hasRequired_listCacheGet = 1;
  var assocIndexOf = require_assocIndexOf();
  function listCacheGet(key) {
    var data = this.__data__, index = assocIndexOf(data, key);
    return index < 0 ? void 0 : data[index][1];
  }
  _listCacheGet = listCacheGet;
  return _listCacheGet;
}
var _listCacheHas;
var hasRequired_listCacheHas;
function require_listCacheHas() {
  if (hasRequired_listCacheHas) return _listCacheHas;
  hasRequired_listCacheHas = 1;
  var assocIndexOf = require_assocIndexOf();
  function listCacheHas(key) {
    return assocIndexOf(this.__data__, key) > -1;
  }
  _listCacheHas = listCacheHas;
  return _listCacheHas;
}
var _listCacheSet;
var hasRequired_listCacheSet;
function require_listCacheSet() {
  if (hasRequired_listCacheSet) return _listCacheSet;
  hasRequired_listCacheSet = 1;
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
  _listCacheSet = listCacheSet;
  return _listCacheSet;
}
var _ListCache;
var hasRequired_ListCache;
function require_ListCache() {
  if (hasRequired_ListCache) return _ListCache;
  hasRequired_ListCache = 1;
  var listCacheClear = require_listCacheClear(), listCacheDelete = require_listCacheDelete(), listCacheGet = require_listCacheGet(), listCacheHas = require_listCacheHas(), listCacheSet = require_listCacheSet();
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
  _ListCache = ListCache;
  return _ListCache;
}
var _Map;
var hasRequired_Map;
function require_Map() {
  if (hasRequired_Map) return _Map;
  hasRequired_Map = 1;
  var getNative = require_getNative(), root = require_root();
  var Map2 = getNative(root, "Map");
  _Map = Map2;
  return _Map;
}
var _mapCacheClear;
var hasRequired_mapCacheClear;
function require_mapCacheClear() {
  if (hasRequired_mapCacheClear) return _mapCacheClear;
  hasRequired_mapCacheClear = 1;
  var Hash = require_Hash(), ListCache = require_ListCache(), Map2 = require_Map();
  function mapCacheClear() {
    this.size = 0;
    this.__data__ = {
      "hash": new Hash(),
      "map": new (Map2 || ListCache)(),
      "string": new Hash()
    };
  }
  _mapCacheClear = mapCacheClear;
  return _mapCacheClear;
}
var _isKeyable;
var hasRequired_isKeyable;
function require_isKeyable() {
  if (hasRequired_isKeyable) return _isKeyable;
  hasRequired_isKeyable = 1;
  function isKeyable(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
  }
  _isKeyable = isKeyable;
  return _isKeyable;
}
var _getMapData;
var hasRequired_getMapData;
function require_getMapData() {
  if (hasRequired_getMapData) return _getMapData;
  hasRequired_getMapData = 1;
  var isKeyable = require_isKeyable();
  function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
  }
  _getMapData = getMapData;
  return _getMapData;
}
var _mapCacheDelete;
var hasRequired_mapCacheDelete;
function require_mapCacheDelete() {
  if (hasRequired_mapCacheDelete) return _mapCacheDelete;
  hasRequired_mapCacheDelete = 1;
  var getMapData = require_getMapData();
  function mapCacheDelete(key) {
    var result = getMapData(this, key)["delete"](key);
    this.size -= result ? 1 : 0;
    return result;
  }
  _mapCacheDelete = mapCacheDelete;
  return _mapCacheDelete;
}
var _mapCacheGet;
var hasRequired_mapCacheGet;
function require_mapCacheGet() {
  if (hasRequired_mapCacheGet) return _mapCacheGet;
  hasRequired_mapCacheGet = 1;
  var getMapData = require_getMapData();
  function mapCacheGet(key) {
    return getMapData(this, key).get(key);
  }
  _mapCacheGet = mapCacheGet;
  return _mapCacheGet;
}
var _mapCacheHas;
var hasRequired_mapCacheHas;
function require_mapCacheHas() {
  if (hasRequired_mapCacheHas) return _mapCacheHas;
  hasRequired_mapCacheHas = 1;
  var getMapData = require_getMapData();
  function mapCacheHas(key) {
    return getMapData(this, key).has(key);
  }
  _mapCacheHas = mapCacheHas;
  return _mapCacheHas;
}
var _mapCacheSet;
var hasRequired_mapCacheSet;
function require_mapCacheSet() {
  if (hasRequired_mapCacheSet) return _mapCacheSet;
  hasRequired_mapCacheSet = 1;
  var getMapData = require_getMapData();
  function mapCacheSet(key, value) {
    var data = getMapData(this, key), size = data.size;
    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
  }
  _mapCacheSet = mapCacheSet;
  return _mapCacheSet;
}
var _MapCache;
var hasRequired_MapCache;
function require_MapCache() {
  if (hasRequired_MapCache) return _MapCache;
  hasRequired_MapCache = 1;
  var mapCacheClear = require_mapCacheClear(), mapCacheDelete = require_mapCacheDelete(), mapCacheGet = require_mapCacheGet(), mapCacheHas = require_mapCacheHas(), mapCacheSet = require_mapCacheSet();
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
  _MapCache = MapCache;
  return _MapCache;
}
var memoize_1;
var hasRequiredMemoize;
function requireMemoize() {
  if (hasRequiredMemoize) return memoize_1;
  hasRequiredMemoize = 1;
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
  memoize_1 = memoize;
  return memoize_1;
}
var _memoizeCapped;
var hasRequired_memoizeCapped;
function require_memoizeCapped() {
  if (hasRequired_memoizeCapped) return _memoizeCapped;
  hasRequired_memoizeCapped = 1;
  var memoize = requireMemoize();
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
  _memoizeCapped = memoizeCapped;
  return _memoizeCapped;
}
var _stringToPath;
var hasRequired_stringToPath;
function require_stringToPath() {
  if (hasRequired_stringToPath) return _stringToPath;
  hasRequired_stringToPath = 1;
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
  _stringToPath = stringToPath;
  return _stringToPath;
}
var _arrayMap;
var hasRequired_arrayMap;
function require_arrayMap() {
  if (hasRequired_arrayMap) return _arrayMap;
  hasRequired_arrayMap = 1;
  function arrayMap(array, iteratee) {
    var index = -1, length = array == null ? 0 : array.length, result = Array(length);
    while (++index < length) {
      result[index] = iteratee(array[index], index, array);
    }
    return result;
  }
  _arrayMap = arrayMap;
  return _arrayMap;
}
var _baseToString;
var hasRequired_baseToString;
function require_baseToString() {
  if (hasRequired_baseToString) return _baseToString;
  hasRequired_baseToString = 1;
  var Symbol2 = require_Symbol(), arrayMap = require_arrayMap(), isArray = requireIsArray(), isSymbol = requireIsSymbol();
  var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
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
    return result == "0" && 1 / value == -Infinity ? "-0" : result;
  }
  _baseToString = baseToString;
  return _baseToString;
}
var toString_1;
var hasRequiredToString;
function requireToString() {
  if (hasRequiredToString) return toString_1;
  hasRequiredToString = 1;
  var baseToString = require_baseToString();
  function toString(value) {
    return value == null ? "" : baseToString(value);
  }
  toString_1 = toString;
  return toString_1;
}
var _castPath;
var hasRequired_castPath;
function require_castPath() {
  if (hasRequired_castPath) return _castPath;
  hasRequired_castPath = 1;
  var isArray = requireIsArray(), isKey = require_isKey(), stringToPath = require_stringToPath(), toString = requireToString();
  function castPath(value, object) {
    if (isArray(value)) {
      return value;
    }
    return isKey(value, object) ? [value] : stringToPath(toString(value));
  }
  _castPath = castPath;
  return _castPath;
}
var _toKey;
var hasRequired_toKey;
function require_toKey() {
  if (hasRequired_toKey) return _toKey;
  hasRequired_toKey = 1;
  var isSymbol = requireIsSymbol();
  function toKey(value) {
    if (typeof value == "string" || isSymbol(value)) {
      return value;
    }
    var result = value + "";
    return result == "0" && 1 / value == -Infinity ? "-0" : result;
  }
  _toKey = toKey;
  return _toKey;
}
var _baseGet;
var hasRequired_baseGet;
function require_baseGet() {
  if (hasRequired_baseGet) return _baseGet;
  hasRequired_baseGet = 1;
  var castPath = require_castPath(), toKey = require_toKey();
  function baseGet(object, path) {
    path = castPath(path, object);
    var index = 0, length = path.length;
    while (object != null && index < length) {
      object = object[toKey(path[index++])];
    }
    return index && index == length ? object : void 0;
  }
  _baseGet = baseGet;
  return _baseGet;
}
var get_1;
var hasRequiredGet;
function requireGet() {
  if (hasRequiredGet) return get_1;
  hasRequiredGet = 1;
  var baseGet = require_baseGet();
  function get(object, path, defaultValue) {
    var result = object == null ? void 0 : baseGet(object, path);
    return result === void 0 ? defaultValue : result;
  }
  get_1 = get;
  return get_1;
}
var hasRequiredTranslationValueGetter;
function requireTranslationValueGetter() {
  if (hasRequiredTranslationValueGetter) return translationValueGetter;
  hasRequiredTranslationValueGetter = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getTranslationValueFromContent = exports.getTranslationValue = void 0;
    const tslib_1 = require$$0$1;
    const get_12 = tslib_1.__importDefault(requireGet());
    const getTranslationValue = (translationLookup, i18nKey, locale) => {
      const translation = translationLookup[locale];
      if (!translation) {
        return null;
      }
      return (0, exports.getTranslationValueFromContent)(translation, i18nKey);
    };
    exports.getTranslationValue = getTranslationValue;
    const getTranslationValueFromContent = (translationContent, i18nKey) => {
      let translationValue = translationContent[i18nKey];
      if (!translationValue) {
        const keyTokens = i18nKey.split(".");
        if (keyTokens.length > 1) {
          translationValue = (0, get_12.default)(translationContent, keyTokens, null);
        }
      }
      return typeof translationValue === "string" ? translationValue : null;
    };
    exports.getTranslationValueFromContent = getTranslationValueFromContent;
  })(translationValueGetter);
  return translationValueGetter;
}
var hasRequiredTranslator;
function requireTranslator() {
  if (hasRequiredTranslator) return translator;
  hasRequiredTranslator = 1;
  Object.defineProperty(translator, "__esModule", { value: true });
  translator.Translator = void 0;
  const translationValueGetter_1 = requireTranslationValueGetter();
  class Translator {
    locale;
    translationsGetter;
    localeLookupOrderedTranslations = null;
    cache = /* @__PURE__ */ new Map();
    constructor(locale, translationsGetter2) {
      this.locale = locale;
      this.translationsGetter = translationsGetter2;
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
  }
  translator.Translator = Translator;
  return translator;
}
var ensureLocale = {};
var hasRequiredEnsureLocale;
function requireEnsureLocale() {
  if (hasRequiredEnsureLocale) return ensureLocale;
  hasRequiredEnsureLocale = 1;
  Object.defineProperty(ensureLocale, "__esModule", { value: true });
  ensureLocale.ensureLocale = void 0;
  const constants_1 = requireConstants();
  const forgeSupportedLocaleCodesSet = new Set(constants_1.FORGE_SUPPORTED_LOCALE_CODES);
  const localeFallbacks = {
    "en-UK": "en-GB",
    "nb-NO": "no-NO"
  };
  const languageToLocaleCodeMap = constants_1.FORGE_SUPPORTED_LOCALE_CODES.reduce((agg, code) => {
    const [lng] = code.split("-");
    if (!agg[lng]) {
      agg[lng] = code;
    }
    return agg;
  }, {
    nb: "no-NO",
    pt: "pt-PT"
  });
  const ensureLocale$1 = (rawLocale) => {
    const locale = rawLocale.replace("_", "-");
    if (forgeSupportedLocaleCodesSet.has(locale)) {
      return locale;
    }
    return languageToLocaleCodeMap[locale] ?? localeFallbacks[locale] ?? null;
  };
  ensureLocale.ensureLocale = ensureLocale$1;
  return ensureLocale;
}
var moduleI18nHelper = {};
var hasRequiredModuleI18nHelper;
function requireModuleI18nHelper() {
  if (hasRequiredModuleI18nHelper) return moduleI18nHelper;
  hasRequiredModuleI18nHelper = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getI18nSupportedModuleEntries = void 0;
    const isObject = (value) => {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    };
    const isI18nValue = (value) => {
      return typeof value?.i18n === "string";
    };
    const isConnectModuleKey = (moduleKey) => moduleKey.startsWith("connect-");
    const isCoreModuleKey = (moduleKey) => moduleKey.startsWith("core:");
    const getI18nKeysFromObject = (obj) => {
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
    const getI18nSupportedModuleEntries = (modules) => {
      return Object.entries(modules).flatMap(([moduleKey, moduleEntries]) => {
        if (!isConnectModuleKey(moduleKey) && !isCoreModuleKey(moduleKey) && moduleEntries && Array.isArray(moduleEntries) && moduleEntries.length > 0) {
          return moduleEntries.map((moduleEntry) => [moduleEntry, moduleKey]);
        }
        return [];
      });
    };
    exports.getI18nSupportedModuleEntries = getI18nSupportedModuleEntries;
    const extractI18nKeysFromModules = (modules) => {
      const i18nKeys = /* @__PURE__ */ new Set();
      for (const moduleEntry of (0, exports.getI18nSupportedModuleEntries)(modules)) {
        const i18nKeysForEntryValue = getI18nKeysFromObject(moduleEntry[0]);
        for (const { key } of i18nKeysForEntryValue) {
          i18nKeys.add(key);
        }
      }
      return i18nKeys.size > 0 ? Array.from(i18nKeys) : [];
    };
    exports.extractI18nKeysFromModules = extractI18nKeysFromModules;
    const extractI18nPropertiesFromModules = (modules) => {
      const moduleI18nProperties = [];
      for (const moduleEntry of (0, exports.getI18nSupportedModuleEntries)(modules)) {
        const i18nKeysForEntryValue = getI18nKeysFromObject(moduleEntry[0]);
        for (const i18nObj of i18nKeysForEntryValue) {
          moduleI18nProperties.push({ moduleName: moduleEntry[1], ...i18nObj });
        }
      }
      return moduleI18nProperties;
    };
    exports.extractI18nPropertiesFromModules = extractI18nPropertiesFromModules;
  })(moduleI18nHelper);
  return moduleI18nHelper;
}
var types = {};
var hasRequiredTypes;
function requireTypes() {
  if (hasRequiredTypes) return types;
  hasRequiredTypes = 1;
  Object.defineProperty(types, "__esModule", { value: true });
  return types;
}
var hasRequiredOut$2;
function requireOut$2() {
  if (hasRequiredOut$2) return out$1;
  hasRequiredOut$2 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getI18nSupportedModuleEntries = exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getTranslationValue = void 0;
    const tslib_1 = require$$0$1;
    tslib_1.__exportStar(requireConstants(), exports);
    tslib_1.__exportStar(requireTranslationsGetter(), exports);
    tslib_1.__exportStar(requireTranslator(), exports);
    tslib_1.__exportStar(requireEnsureLocale(), exports);
    var translationValueGetter_1 = requireTranslationValueGetter();
    Object.defineProperty(exports, "getTranslationValue", { enumerable: true, get: function() {
      return translationValueGetter_1.getTranslationValue;
    } });
    var moduleI18nHelper_1 = requireModuleI18nHelper();
    Object.defineProperty(exports, "extractI18nKeysFromModules", { enumerable: true, get: function() {
      return moduleI18nHelper_1.extractI18nKeysFromModules;
    } });
    Object.defineProperty(exports, "extractI18nPropertiesFromModules", { enumerable: true, get: function() {
      return moduleI18nHelper_1.extractI18nPropertiesFromModules;
    } });
    Object.defineProperty(exports, "getI18nSupportedModuleEntries", { enumerable: true, get: function() {
      return moduleI18nHelper_1.getI18nSupportedModuleEntries;
    } });
    tslib_1.__exportStar(requireTypes(), exports);
  })(out$1);
  return out$1;
}
var hasRequiredI18n;
function requireI18n() {
  if (hasRequiredI18n) return i18n;
  hasRequiredI18n = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.i18n = exports.createTranslationFunction = exports.getTranslations = exports.resetTranslationsCache = void 0;
    const i18n_1 = requireOut$2();
    const fs_1 = require$$1;
    const path_1 = require$$2$1;
    const runtime_1 = requireRuntime();
    const getI18nBundleFolderPath = () => {
      const { appCodeDir } = (0, runtime_1.__getRuntime)().container;
      return appCodeDir ? [appCodeDir, i18n_1.I18N_BUNDLE_FOLDER_NAME] : [i18n_1.I18N_BUNDLE_FOLDER_NAME];
    };
    const readLocaleFileContent = async (filePath) => {
      const fileContent = await fs_1.promises.readFile((0, path_1.join)(...getI18nBundleFolderPath(), filePath));
      return JSON.parse(fileContent.toString());
    };
    const makeResourceAccessorErrorMessage = (message) => {
      if (commonjsGlobal.__forge_tunnel__) {
        const cliUpdateWarning = "To access i18n resources while using `forge tunnel`, please ensure that your Forge CLI is up to date. Run `npm install -g @forge/cli` to update to the latest version.";
        return `${message}
${cliUpdateWarning}`;
      }
      return message;
    };
    const resolverResourcesAccessor = {
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
    const translationsFunctionCache = /* @__PURE__ */ new Map();
    const translationsGetter2 = new i18n_1.TranslationsGetter(resolverResourcesAccessor);
    const resetTranslationsCache = () => {
      translationsGetter2.reset();
      translationsFunctionCache.clear();
    };
    exports.resetTranslationsCache = resetTranslationsCache;
    const getTranslations = async (rawLocale, options = {
      fallback: true
    }) => {
      const locale = doEnsureLocale(rawLocale);
      return await translationsGetter2.getTranslations(locale, options);
    };
    exports.getTranslations = getTranslations;
    const createTranslationFunction = async (rawLocale) => {
      const locale = doEnsureLocale(rawLocale);
      let translator2 = translationsFunctionCache.get(locale);
      if (!translator2) {
        translator2 = await createTranslationFunctionImpl(locale);
        translationsFunctionCache.set(locale, translator2);
      }
      return translator2;
    };
    exports.createTranslationFunction = createTranslationFunction;
    const doEnsureLocale = (rawLocale) => {
      const ensuredLocale = (0, i18n_1.ensureLocale)(rawLocale);
      if (!ensuredLocale) {
        console.warn(`The locale "${rawLocale}" is not supported, defaulting to the default locale.`);
        return rawLocale;
      }
      return ensuredLocale;
    };
    const createTranslationFunctionImpl = async (locale) => {
      const translator2 = new i18n_1.Translator(locale, translationsGetter2);
      await translator2.init();
      return (i18nKey, defaultValue) => translator2.translate(i18nKey) ?? defaultValue ?? i18nKey;
    };
    exports.i18n = {
      createTranslationFunction: exports.createTranslationFunction,
      getTranslations: exports.getTranslations
    };
  })(i18n);
  return i18n;
}
var permissions = {};
var out = {};
var egress = {};
var egressFilteringService = {};
var urlParser = {};
var hasRequiredUrlParser;
function requireUrlParser() {
  if (hasRequiredUrlParser) return urlParser;
  hasRequiredUrlParser = 1;
  Object.defineProperty(urlParser, "__esModule", { value: true });
  urlParser.parseUrl = parseUrl;
  function parseUrl(url) {
    var _a, _b;
    const protocol = (_b = (_a = url.match(/^(.*?:)/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : "https:";
    const hostAndPath = url.replace(protocol, "").replace(/^\/*/, "").replace(/^\\*/, "").split("?")[0].split("#")[0];
    const hostname = hostAndPath.split("/")[0];
    const pathname = hostAndPath.slice(hostname.length) || "/";
    return { protocol, hostname, pathname };
  }
  return urlParser;
}
var utils = {};
var hasRequiredUtils;
function requireUtils() {
  if (hasRequiredUtils) return utils;
  hasRequiredUtils = 1;
  Object.defineProperty(utils, "__esModule", { value: true });
  utils.getEgressesBasedOnToggles = utils.sortAndGroupEgressPermissionsByDomain = utils.EgressCategory = utils.EgressType = void 0;
  utils.globToRegex = globToRegex;
  const url_parser_1 = requireUrlParser();
  function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const regexPattern = escaped.replace(/\*/g, ".*");
    return new RegExp(`^${regexPattern}$`);
  }
  const sortAndGroupEgressPermissionsByDomain = (egressAddresses) => {
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
  utils.sortAndGroupEgressPermissionsByDomain = sortAndGroupEgressPermissionsByDomain;
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
  })(EgressType || (utils.EgressType = EgressType = {}));
  var EgressCategory;
  (function(EgressCategory2) {
    EgressCategory2["ANALYTICS"] = "ANALYTICS";
  })(EgressCategory || (utils.EgressCategory = EgressCategory = {}));
  const getEgressesBasedOnToggles = (input) => {
    const filteredEgresses = input.egress.filter((egress2) => {
      var _a;
      if (((_a = egress2.category) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === EgressCategory.ANALYTICS) {
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
    for (const egress2 of filteredEgresses) {
      if (!egressByType.has(egress2.type)) {
        egressByType.set(egress2.type, egress2.addresses);
      }
      egressByType.set(egress2.type, [...egressByType.get(egress2.type), ...egress2.addresses]);
    }
    return [...egressByType.entries()].map(([type, egresses]) => ({
      type,
      addresses: [...new Set(egresses)]
    }));
  };
  utils.getEgressesBasedOnToggles = getEgressesBasedOnToggles;
  return utils;
}
var hasRequiredEgressFilteringService;
function requireEgressFilteringService() {
  if (hasRequiredEgressFilteringService) return egressFilteringService;
  hasRequiredEgressFilteringService = 1;
  Object.defineProperty(egressFilteringService, "__esModule", { value: true });
  egressFilteringService.EgressFilteringService = void 0;
  const url_parser_1 = requireUrlParser();
  const utils_1 = requireUtils();
  class EgressFilteringService {
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
  }
  egressFilteringService.EgressFilteringService = EgressFilteringService;
  return egressFilteringService;
}
var hasRequiredEgress;
function requireEgress() {
  if (hasRequiredEgress) return egress;
  hasRequiredEgress = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require$$0$1;
    tslib_1.__exportStar(requireEgressFilteringService(), exports);
    tslib_1.__exportStar(requireUrlParser(), exports);
    tslib_1.__exportStar(requireUtils(), exports);
  })(egress);
  return egress;
}
var hasRequiredOut$1;
function requireOut$1() {
  if (hasRequiredOut$1) return out;
  hasRequiredOut$1 = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require$$0$1;
    tslib_1.__exportStar(requireEgress(), exports);
  })(out);
  return out;
}
var hasRequiredPermissions;
function requirePermissions() {
  if (hasRequiredPermissions) return permissions;
  hasRequiredPermissions = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.permissions = exports.canLoadResource = exports.canFetchFrom = exports.hasScope = exports.hasPermission = void 0;
    exports.extractUrlString = extractUrlString;
    const runtime_1 = requireRuntime();
    const errors_1 = requireErrors();
    const egress_1 = requireOut$1();
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
    const getMissingScopes = (requiredScopes, currentlyGrantedScopes) => {
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
    const getMissingUrls = (requiredUrls, currentlyGrantedUrls, useCSP) => {
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
    const VALID_REQUIREMENT_KEYS = ["scopes", "external"];
    const VALID_EXTERNAL_TYPES = [
      "fetch",
      "fonts",
      "frames",
      "images",
      "media",
      "scripts",
      "styles",
      "configurable"
    ];
    const VALID_FETCH_TYPES = ["backend", "client"];
    const validateKeys = (obj, validKeys) => {
      const validKeysSet = new Set(validKeys);
      const providedKeys = Object.keys(obj);
      const invalidKeys = providedKeys.filter((key) => !validKeysSet.has(key));
      if (invalidKeys.length > 0) {
        throw new Error(`Invalid permission key(s): ${invalidKeys.join(", ")}. Visit https://go.atlassian.com/forge-permissions for more information.`);
      }
    };
    const validateObjectField = (value, fieldPath) => {
      if (value !== void 0) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError(`${fieldPath} should be an object, not ${Array.isArray(value) ? "an array" : `a ${typeof value}`}`);
        }
      }
    };
    const validateArrayField = (value, fieldPath) => {
      if (value !== void 0 && !Array.isArray(value)) {
        throw new TypeError(`${fieldPath} should be an array, not a ${typeof value}`);
      }
    };
    const validatePermissionRequirements = (requirements) => {
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
    const getMissingFetchPermissions = (requiredFetch, currentlyGrantedFetch) => {
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
    const getMissingExternalPermissions = (requiredExternal, currentGrantedExternal) => {
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
    const hasPermission = (requirements) => {
      return wrapInSyncMetrics({ name: "api.permissions.hasPermission" }, () => hasPermissionWithoutMetrics(requirements));
    };
    exports.hasPermission = hasPermission;
    const hasPermissionWithoutMetrics = (requirements) => {
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
    const hasScope = (scope) => {
      return wrapInSyncMetrics({ name: "api.permissions.hasScope" }, () => hasPermissionWithoutMetrics({ scopes: [scope] }).granted);
    };
    exports.hasScope = hasScope;
    const canFetchFrom = (type, url) => {
      return wrapInSyncMetrics({ name: "api.permissions.canFetchFrom" }, () => hasPermissionWithoutMetrics({ external: { fetch: { [type]: [url] } } }).granted);
    };
    exports.canFetchFrom = canFetchFrom;
    const canLoadResource = (type, url) => {
      return wrapInSyncMetrics({ name: "api.permissions.canLoadResource" }, () => hasPermissionWithoutMetrics({ external: { [type]: [url] } }).granted);
    };
    exports.canLoadResource = canLoadResource;
    exports.permissions = {
      hasPermission: exports.hasPermission,
      hasScope: exports.hasScope,
      canFetchFrom: exports.canFetchFrom,
      canLoadResource: exports.canLoadResource
    };
  })(permissions);
  return permissions;
}
var hasRequiredOut;
function requireOut() {
  if (hasRequiredOut) return out$3;
  hasRequiredOut = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.permissions = exports.i18n = exports.routeFromAbsolute = exports.route = exports.assumeTrustedRoute = exports.getAppContext = exports.bindInvocationContext = exports.__getRuntime = exports.RequestProductNotAllowedError = exports.ProxyRequestError = exports.ProductEndpointNotAllowedError = exports.NotAllowedError = exports.NeedsAuthenticationError = exports.isHostedCodeError = exports.isForgePlatformError = exports.isExpectedError = exports.InvalidWorkspaceRequestedError = exports.HttpError = exports.FUNCTION_ERR = exports.FetchError = exports.ExternalEndpointNotAllowedError = exports.createRequestStargateAsApp = exports.webTrigger = exports.requestJira = exports.requestConfluence = exports.requestBitbucket = exports.invokeService = exports.invokeRemote = exports.fetch = exports.authorize = exports.asUser = exports.asApp = exports.__requestAtlassianAsUser = exports.__requestAtlassianAsApp = exports.__fetchProduct = exports.privacy = void 0;
    const endpoint_1 = requireEndpoint();
    Object.defineProperty(exports, "invokeRemote", { enumerable: true, get: function() {
      return endpoint_1.invokeRemote;
    } });
    Object.defineProperty(exports, "invokeService", { enumerable: true, get: function() {
      return endpoint_1.invokeService;
    } });
    const fetch_1 = requireFetch();
    Object.defineProperty(exports, "__fetchProduct", { enumerable: true, get: function() {
      return fetch_1.__fetchProduct;
    } });
    Object.defineProperty(exports, "__requestAtlassianAsApp", { enumerable: true, get: function() {
      return fetch_1.__requestAtlassianAsApp;
    } });
    Object.defineProperty(exports, "__requestAtlassianAsUser", { enumerable: true, get: function() {
      return fetch_1.__requestAtlassianAsUser;
    } });
    const authorization_1 = requireAuthorization();
    Object.defineProperty(exports, "authorize", { enumerable: true, get: function() {
      return authorization_1.authorize;
    } });
    const privacy_1 = requirePrivacy();
    const webTrigger_1 = requireWebTrigger();
    Object.defineProperty(exports, "webTrigger", { enumerable: true, get: function() {
      return webTrigger_1.webTrigger;
    } });
    const fetchAPI = (0, fetch_1.getFetchAPI)();
    const asUser = fetchAPI.asUser;
    exports.asUser = asUser;
    const asApp = fetchAPI.asApp;
    exports.asApp = asApp;
    const fetch2 = fetchAPI.fetch;
    exports.fetch = fetch2;
    const requestJira = fetchAPI.requestJira;
    exports.requestJira = requestJira;
    const requestConfluence = fetchAPI.requestConfluence;
    exports.requestConfluence = requestConfluence;
    const requestBitbucket = fetchAPI.requestBitbucket;
    exports.requestBitbucket = requestBitbucket;
    const API = {
      ...fetchAPI,
      invokeRemote: endpoint_1.invokeRemote,
      invokeService: endpoint_1.invokeService
    };
    exports.privacy = {
      reportPersonalData: (0, privacy_1.createReportPersonalData)(fetch_1.__requestAtlassianAsApp)
    };
    exports.default = API;
    const createRequestStargateAsApp = () => fetch_1.__requestAtlassianAsApp;
    exports.createRequestStargateAsApp = createRequestStargateAsApp;
    var errors_1 = requireErrors();
    Object.defineProperty(exports, "ExternalEndpointNotAllowedError", { enumerable: true, get: function() {
      return errors_1.ExternalEndpointNotAllowedError;
    } });
    Object.defineProperty(exports, "FetchError", { enumerable: true, get: function() {
      return errors_1.FetchError;
    } });
    Object.defineProperty(exports, "FUNCTION_ERR", { enumerable: true, get: function() {
      return errors_1.FUNCTION_ERR;
    } });
    Object.defineProperty(exports, "HttpError", { enumerable: true, get: function() {
      return errors_1.HttpError;
    } });
    Object.defineProperty(exports, "InvalidWorkspaceRequestedError", { enumerable: true, get: function() {
      return errors_1.InvalidWorkspaceRequestedError;
    } });
    Object.defineProperty(exports, "isExpectedError", { enumerable: true, get: function() {
      return errors_1.isExpectedError;
    } });
    Object.defineProperty(exports, "isForgePlatformError", { enumerable: true, get: function() {
      return errors_1.isForgePlatformError;
    } });
    Object.defineProperty(exports, "isHostedCodeError", { enumerable: true, get: function() {
      return errors_1.isHostedCodeError;
    } });
    Object.defineProperty(exports, "NeedsAuthenticationError", { enumerable: true, get: function() {
      return errors_1.NeedsAuthenticationError;
    } });
    Object.defineProperty(exports, "NotAllowedError", { enumerable: true, get: function() {
      return errors_1.NotAllowedError;
    } });
    Object.defineProperty(exports, "ProductEndpointNotAllowedError", { enumerable: true, get: function() {
      return errors_1.ProductEndpointNotAllowedError;
    } });
    Object.defineProperty(exports, "ProxyRequestError", { enumerable: true, get: function() {
      return errors_1.ProxyRequestError;
    } });
    Object.defineProperty(exports, "RequestProductNotAllowedError", { enumerable: true, get: function() {
      return errors_1.RequestProductNotAllowedError;
    } });
    var runtime_1 = requireRuntime();
    Object.defineProperty(exports, "__getRuntime", { enumerable: true, get: function() {
      return runtime_1.__getRuntime;
    } });
    Object.defineProperty(exports, "bindInvocationContext", { enumerable: true, get: function() {
      return runtime_1.bindInvocationContext;
    } });
    Object.defineProperty(exports, "getAppContext", { enumerable: true, get: function() {
      return runtime_1.getAppContext;
    } });
    var safeUrl_1 = requireSafeUrl_1();
    Object.defineProperty(exports, "assumeTrustedRoute", { enumerable: true, get: function() {
      return safeUrl_1.assumeTrustedRoute;
    } });
    Object.defineProperty(exports, "route", { enumerable: true, get: function() {
      return safeUrl_1.route;
    } });
    Object.defineProperty(exports, "routeFromAbsolute", { enumerable: true, get: function() {
      return safeUrl_1.routeFromAbsolute;
    } });
    var i18n_1 = requireI18n();
    Object.defineProperty(exports, "i18n", { enumerable: true, get: function() {
      return i18n_1.i18n;
    } });
    var permissions_1 = requirePermissions();
    Object.defineProperty(exports, "permissions", { enumerable: true, get: function() {
      return permissions_1.permissions;
    } });
  })(out$3);
  return out$3;
}
var outExports = requireOut();
const resolver = new Resolver();
resolver.define("save", async ({ payload }) => {
  await outExports$1.kvs.set("saved:" + payload.id, { id: payload.id, by: "matrix-backend" });
  return "saved " + payload.id;
});
resolver.define("summary", async () => {
  const saved = await outExports$1.kvs.get("saved:ui");
  return saved ? "ui saved by " + saved.by : "nothing saved";
});
resolver.define("issue", async ({ payload }) => {
  const res = await outExports.requestJira(outExports.route`/rest/api/3/issue/${payload.key}`);
  const data = await res.json();
  return data.fields.summary;
});
const handler = resolver.getDefinitions();
export {
  handler
};
