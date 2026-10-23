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

// node_modules/react/cjs/react.production.min.js
var require_react_production_min = __commonJS({
  "node_modules/react/cjs/react.production.min.js"(exports) {
    "use strict";
    var l = Symbol.for("react.element");
    var n = Symbol.for("react.portal");
    var p = Symbol.for("react.fragment");
    var q = Symbol.for("react.strict_mode");
    var r = Symbol.for("react.profiler");
    var t = Symbol.for("react.provider");
    var u = Symbol.for("react.context");
    var v = Symbol.for("react.forward_ref");
    var w = Symbol.for("react.suspense");
    var x = Symbol.for("react.memo");
    var y = Symbol.for("react.lazy");
    var z = Symbol.iterator;
    function A(a) {
      if (null === a || "object" !== typeof a) return null;
      a = z && a[z] || a["@@iterator"];
      return "function" === typeof a ? a : null;
    }
    var B = { isMounted: function() {
      return false;
    }, enqueueForceUpdate: function() {
    }, enqueueReplaceState: function() {
    }, enqueueSetState: function() {
    } };
    var C = Object.assign;
    var D = {};
    function E(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    E.prototype.isReactComponent = {};
    E.prototype.setState = function(a, b) {
      if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a, b, "setState");
    };
    E.prototype.forceUpdate = function(a) {
      this.updater.enqueueForceUpdate(this, a, "forceUpdate");
    };
    function F() {
    }
    F.prototype = E.prototype;
    function G(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    var H = G.prototype = new F();
    H.constructor = G;
    C(H, E.prototype);
    H.isPureReactComponent = true;
    var I = Array.isArray;
    var J = Object.prototype.hasOwnProperty;
    var K = { current: null };
    var L = { key: true, ref: true, __self: true, __source: true };
    function M(a, b, e) {
      var d, c = {}, k = null, h = null;
      if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
      var g = arguments.length - 2;
      if (1 === g) c.children = e;
      else if (1 < g) {
        for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
        c.children = f;
      }
      if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
      return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
    }
    function N(a, b) {
      return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
    }
    function O(a) {
      return "object" === typeof a && null !== a && a.$$typeof === l;
    }
    function escape(a) {
      var b = { "=": "=0", ":": "=2" };
      return "$" + a.replace(/[=:]/g, function(a2) {
        return b[a2];
      });
    }
    var P = /\/+/g;
    function Q(a, b) {
      return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
    }
    function R(a, b, e, d, c) {
      var k = typeof a;
      if ("undefined" === k || "boolean" === k) a = null;
      var h = false;
      if (null === a) h = true;
      else switch (k) {
        case "string":
        case "number":
          h = true;
          break;
        case "object":
          switch (a.$$typeof) {
            case l:
            case n:
              h = true;
          }
      }
      if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
        return a2;
      })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
      h = 0;
      d = "" === d ? "." : d + ":";
      if (I(a)) for (var g = 0; g < a.length; g++) {
        k = a[g];
        var f = d + Q(k, g);
        h += R(k, b, e, f, c);
      }
      else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
      else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
      return h;
    }
    function S(a, b, e) {
      if (null == a) return a;
      var d = [], c = 0;
      R(a, d, "", "", function(a2) {
        return b.call(e, a2, c++);
      });
      return d;
    }
    function T(a) {
      if (-1 === a._status) {
        var b = a._result;
        b = b();
        b.then(function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
        }, function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
        });
        -1 === a._status && (a._status = 0, a._result = b);
      }
      if (1 === a._status) return a._result.default;
      throw a._result;
    }
    var U = { current: null };
    var V = { transition: null };
    var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
    function X() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    exports.Children = { map: S, forEach: function(a, b, e) {
      S(a, function() {
        b.apply(this, arguments);
      }, e);
    }, count: function(a) {
      var b = 0;
      S(a, function() {
        b++;
      });
      return b;
    }, toArray: function(a) {
      return S(a, function(a2) {
        return a2;
      }) || [];
    }, only: function(a) {
      if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
      return a;
    } };
    exports.Component = E;
    exports.Fragment = p;
    exports.Profiler = r;
    exports.PureComponent = G;
    exports.StrictMode = q;
    exports.Suspense = w;
    exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
    exports.act = X;
    exports.cloneElement = function(a, b, e) {
      if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
      var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
      if (null != b) {
        void 0 !== b.ref && (k = b.ref, h = K.current);
        void 0 !== b.key && (c = "" + b.key);
        if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
        for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
      }
      var f = arguments.length - 2;
      if (1 === f) d.children = e;
      else if (1 < f) {
        g = Array(f);
        for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
        d.children = g;
      }
      return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
    };
    exports.createContext = function(a) {
      a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a.Provider = { $$typeof: t, _context: a };
      return a.Consumer = a;
    };
    exports.createElement = M;
    exports.createFactory = function(a) {
      var b = M.bind(null, a);
      b.type = a;
      return b;
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(a) {
      return { $$typeof: v, render: a };
    };
    exports.isValidElement = O;
    exports.lazy = function(a) {
      return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
    };
    exports.memo = function(a, b) {
      return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
    };
    exports.startTransition = function(a) {
      var b = V.transition;
      V.transition = {};
      try {
        a();
      } finally {
        V.transition = b;
      }
    };
    exports.unstable_act = X;
    exports.useCallback = function(a, b) {
      return U.current.useCallback(a, b);
    };
    exports.useContext = function(a) {
      return U.current.useContext(a);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(a) {
      return U.current.useDeferredValue(a);
    };
    exports.useEffect = function(a, b) {
      return U.current.useEffect(a, b);
    };
    exports.useId = function() {
      return U.current.useId();
    };
    exports.useImperativeHandle = function(a, b, e) {
      return U.current.useImperativeHandle(a, b, e);
    };
    exports.useInsertionEffect = function(a, b) {
      return U.current.useInsertionEffect(a, b);
    };
    exports.useLayoutEffect = function(a, b) {
      return U.current.useLayoutEffect(a, b);
    };
    exports.useMemo = function(a, b) {
      return U.current.useMemo(a, b);
    };
    exports.useReducer = function(a, b, e) {
      return U.current.useReducer(a, b, e);
    };
    exports.useRef = function(a) {
      return U.current.useRef(a);
    };
    exports.useState = function(a) {
      return U.current.useState(a);
    };
    exports.useSyncExternalStore = function(a, b, e) {
      return U.current.useSyncExternalStore(a, b, e);
    };
    exports.useTransition = function() {
      return U.current.useTransition();
    };
    exports.version = "18.3.1";
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_react_production_min();
    } else {
      module.exports = null;
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

// node_modules/@forge/react/node_modules/@forge/bridge/out/router/targets.js
var require_targets = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/router/targets.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NavigationTarget = void 0;
    exports.NavigationTarget = {
      /**
       * The view page for pages, blogs and custom content. Takes a contentId to identify the content.
       */
      ContentView: "contentView",
      /**
       * The edit page for pages, blogs and custom content. Takes a contentId to identify the content.
       */
      ContentEdit: "contentEdit",
      /**
       * The list/collector page for pages, blogs and custom content contained in a space. Takes a spaceKey and a contentType to identify the content type for pages and blogs. Takes a moduleKey for custom content.
       */
      ContentList: "contentList",
      /**
       * The space view page. Takes a spaceKey to identify the space.
       */
      SpaceView: "spaceView",
      /**
       * The page within a specific module. Takes a moduleKey to identify the correct module.
       */
      Module: "module",
      /**
       * The profile page for a specific user. Takes an accountId to identify the user.
       */
      UserProfile: "userProfile",
      /**
       * A dashboard in Jira. Takes a dashboardId to identify the dashboard.
       */
      Dashboard: "dashboard",
      /**
       * An issue in Jira. Takes an issueKey to identify the issue.
       */
      Issue: "issue",
      /**
       * The project settings details of a Jira project. Takes a projectKey to identify the project. Only accessible to administrators.
       */
      ProjectSettingsDetails: "projectSettingsDetails"
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/errors.js
var require_errors = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BridgeAPIError = void 0;
    var BridgeAPIError = class extends Error {
    };
    exports.BridgeAPIError = BridgeAPIError;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/bridge.js
var require_bridge = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/bridge.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getCallBridge = void 0;
    var errors_1 = require_errors();
    function isBridgeAvailable(bridge) {
      return !!(bridge === null || bridge === void 0 ? void 0 : bridge.callBridge);
    }
    var getCallBridge = () => {
      if (!isBridgeAvailable(globalThis.__bridge)) {
        throw new errors_1.BridgeAPIError(`
      Unable to establish a connection with the Custom UI bridge.
      If you are trying to run your app locally, Forge apps only work in the context of Atlassian products. Refer to https://go.atlassian.com/forge-tunneling-with-custom-ui for how to tunnel when using a local development server.
    `);
      }
      return globalThis.__bridge.callBridge;
    };
    exports.getCallBridge = getCallBridge;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/utils/index.js
var require_utils = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/utils/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.withRateLimiter = void 0;
    var errors_1 = require_errors();
    var withRateLimiter = (wrappedFn, maxOps, intervalInMs, exceededErrorMessage) => {
      let start = Date.now();
      let numOps = 0;
      return async (...args) => {
        const now = Date.now();
        const elapsed = now - start;
        if (elapsed > intervalInMs) {
          start = now;
          numOps = 0;
        }
        if (numOps >= maxOps) {
          throw new errors_1.BridgeAPIError(exceededErrorMessage || "Too many invocations.");
        }
        numOps = numOps + 1;
        return wrappedFn(...args);
      };
    };
    exports.withRateLimiter = withRateLimiter;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/invoke/invoke.js
var require_invoke = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/invoke/invoke.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.invoke = invoke2;
    exports.makeInvoke = makeInvoke;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var utils_1 = require_utils();
    var callBridge = (0, bridge_1.getCallBridge)();
    var validatePayload = (payload) => {
      if (!payload)
        return;
      if (Object.values(payload).some((val) => typeof val === "function")) {
        throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
      }
    };
    var _invoke = async (functionKey, payload, metadata) => {
      if (typeof functionKey !== "string") {
        throw new errors_1.BridgeAPIError("functionKey must be a string!");
      }
      validatePayload(payload);
      return await callBridge("invoke", { functionKey, payload, metadata });
    };
    var limitedInvoke = (0, utils_1.withRateLimiter)(_invoke, 500, 1e3 * 25, "Resolver calls are rate limited at 500req/25s");
    function invoke2(functionKey, payload, metadata) {
      return limitedInvoke(functionKey, payload, metadata);
    }
    function makeInvoke() {
      return invoke2;
    }
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/invoke/index.js
var require_invoke2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/invoke/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_invoke(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js
var require_invoke_endpoint = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InvokeType = void 0;
    exports._invokeEndpointFn = _invokeEndpointFn;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var utils_1 = require_utils();
    var MAX_NUM_OPERATIONS = 500;
    var OPERATION_INTERVAL_SEC = 25;
    var OPERATION_INTERVAL_MS = 1e3 * OPERATION_INTERVAL_SEC;
    var InvokeType;
    (function(InvokeType2) {
      InvokeType2["REMOTE"] = "Remote";
      InvokeType2["SERVICE"] = "Container";
    })(InvokeType || (exports.InvokeType = InvokeType = {}));
    var callBridge = (0, bridge_1.getCallBridge)();
    var validatePayload = (payload) => {
      if (!payload)
        return;
      if (Object.values(payload).some((val) => typeof val === "function")) {
        throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
      }
    };
    var _setupInvokeEndpointFn = (invokeType) => async (input) => {
      validatePayload(input);
      const callBridgePayload = {
        ...input,
        invokeType: `ui-${invokeType.toLowerCase()}-fetch`
      };
      const bridgeResponse = await callBridge("invoke", callBridgePayload);
      const { success, payload, error } = bridgeResponse !== null && bridgeResponse !== void 0 ? bridgeResponse : {};
      const response = { ...success ? payload : error };
      if (response && response.headers) {
        for (const header in response.headers) {
          if (Array.isArray(response.headers[header])) {
            response.headers[header] = response.headers[header].join(",");
          }
        }
      }
      return response;
    };
    function _invokeEndpointFn(invokeType) {
      const invokeEndpointFn = _setupInvokeEndpointFn(invokeType);
      return (0, utils_1.withRateLimiter)(invokeEndpointFn, MAX_NUM_OPERATIONS, OPERATION_INTERVAL_MS, `${invokeType} invocation calls are rate limited at ${MAX_NUM_OPERATIONS}/${OPERATION_INTERVAL_SEC}s`);
    }
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js
var require_invoke_remote = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.invokeRemote = void 0;
    var invoke_endpoint_1 = require_invoke_endpoint();
    var invokeRemote = (input) => {
      const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.REMOTE);
      return invokeEndpoint(input);
    };
    exports.invokeRemote = invokeRemote;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js
var require_invoke_service = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.invokeService = void 0;
    var invoke_endpoint_1 = require_invoke_endpoint();
    var invokeService = (input) => {
      const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.SERVICE);
      return invokeEndpoint(input);
    };
    exports.invokeService = invokeService;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/index.js
var require_invoke_endpoint2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/invoke-endpoint/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_invoke_remote(), exports);
    tslib_1.__exportStar(require_invoke_service(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/submit.js
var require_submit = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/submit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.submit = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var submit = async (payload) => {
      const success = await callBridge("submit", payload);
      if (success === false) {
        throw new errors_1.BridgeAPIError("this resource's view is not submittable.");
      }
    };
    exports.submit = submit;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/close.js
var require_close = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/close.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.close = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var close = async (payload) => {
      try {
        const success = await callBridge("close", payload);
        if (success === false) {
          throw new errors_1.BridgeAPIError("this resource's view is not closable.");
        }
      } catch (e) {
        throw new errors_1.BridgeAPIError("this resource's view is not closable.");
      }
    };
    exports.close = close;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/open.js
var require_open = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/open.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.open = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var open = async () => {
      try {
        const success = await callBridge("open");
        if (success === false) {
          throw new errors_1.BridgeAPIError("this resource's view is not openable.");
        }
      } catch (e) {
        throw new errors_1.BridgeAPIError("this resource's view is not openable.");
      }
    };
    exports.open = open;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/refresh.js
var require_refresh = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/refresh.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.refresh = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var refresh = async (payload) => {
      const success = await callBridge("refresh", payload);
      if (success === false) {
        throw new errors_1.BridgeAPIError("this resource's view is not refreshable.");
      }
    };
    exports.refresh = refresh;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/createHistory.js
var require_createHistory = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/createHistory.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createHistory = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var createHistory = async () => {
      const history = await callBridge("createHistory");
      history.listen((location) => {
        history.location = location;
      });
      return history;
    };
    exports.createHistory = createHistory;
  }
});

// node_modules/@forge/i18n/out/constants.js
var require_constants = __commonJS({
  "node_modules/@forge/i18n/out/constants.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FORGE_SUPPORTED_LOCALE_CODES = exports.I18N_BUNDLE_FOLDER_NAME = exports.I18N_INFO_FILE_NAME = void 0;
    exports.I18N_INFO_FILE_NAME = "i18n-info.json";
    exports.I18N_BUNDLE_FOLDER_NAME = "__LOCALES__";
    exports.FORGE_SUPPORTED_LOCALE_CODES = [
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
  "node_modules/@forge/i18n/out/translationsGetter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TranslationsGetter = exports.TranslationGetterError = void 0;
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
    exports.TranslationGetterError = TranslationGetterError;
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
    exports.TranslationsGetter = TranslationsGetter;
  }
});

// node_modules/lodash/isArray.js
var require_isArray = __commonJS({
  "node_modules/lodash/isArray.js"(exports, module) {
    var isArray = Array.isArray;
    module.exports = isArray;
  }
});

// node_modules/lodash/_freeGlobal.js
var require_freeGlobal = __commonJS({
  "node_modules/lodash/_freeGlobal.js"(exports, module) {
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    module.exports = freeGlobal;
  }
});

// node_modules/lodash/_root.js
var require_root = __commonJS({
  "node_modules/lodash/_root.js"(exports, module) {
    var freeGlobal = require_freeGlobal();
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    module.exports = root;
  }
});

// node_modules/lodash/_Symbol.js
var require_Symbol = __commonJS({
  "node_modules/lodash/_Symbol.js"(exports, module) {
    var root = require_root();
    var Symbol2 = root.Symbol;
    module.exports = Symbol2;
  }
});

// node_modules/lodash/_getRawTag.js
var require_getRawTag = __commonJS({
  "node_modules/lodash/_getRawTag.js"(exports, module) {
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
    module.exports = getRawTag;
  }
});

// node_modules/lodash/_objectToString.js
var require_objectToString = __commonJS({
  "node_modules/lodash/_objectToString.js"(exports, module) {
    var objectProto = Object.prototype;
    var nativeObjectToString = objectProto.toString;
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    module.exports = objectToString;
  }
});

// node_modules/lodash/_baseGetTag.js
var require_baseGetTag = __commonJS({
  "node_modules/lodash/_baseGetTag.js"(exports, module) {
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
    module.exports = baseGetTag;
  }
});

// node_modules/lodash/isObjectLike.js
var require_isObjectLike = __commonJS({
  "node_modules/lodash/isObjectLike.js"(exports, module) {
    function isObjectLike(value) {
      return value != null && typeof value == "object";
    }
    module.exports = isObjectLike;
  }
});

// node_modules/lodash/isSymbol.js
var require_isSymbol = __commonJS({
  "node_modules/lodash/isSymbol.js"(exports, module) {
    var baseGetTag = require_baseGetTag();
    var isObjectLike = require_isObjectLike();
    var symbolTag = "[object Symbol]";
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
    }
    module.exports = isSymbol;
  }
});

// node_modules/lodash/_isKey.js
var require_isKey = __commonJS({
  "node_modules/lodash/_isKey.js"(exports, module) {
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
    module.exports = isKey;
  }
});

// node_modules/lodash/isObject.js
var require_isObject = __commonJS({
  "node_modules/lodash/isObject.js"(exports, module) {
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    module.exports = isObject;
  }
});

// node_modules/lodash/isFunction.js
var require_isFunction = __commonJS({
  "node_modules/lodash/isFunction.js"(exports, module) {
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
    module.exports = isFunction;
  }
});

// node_modules/lodash/_coreJsData.js
var require_coreJsData = __commonJS({
  "node_modules/lodash/_coreJsData.js"(exports, module) {
    var root = require_root();
    var coreJsData = root["__core-js_shared__"];
    module.exports = coreJsData;
  }
});

// node_modules/lodash/_isMasked.js
var require_isMasked = __commonJS({
  "node_modules/lodash/_isMasked.js"(exports, module) {
    var coreJsData = require_coreJsData();
    var maskSrcKey = (function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    })();
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    module.exports = isMasked;
  }
});

// node_modules/lodash/_toSource.js
var require_toSource = __commonJS({
  "node_modules/lodash/_toSource.js"(exports, module) {
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
    module.exports = toSource;
  }
});

// node_modules/lodash/_baseIsNative.js
var require_baseIsNative = __commonJS({
  "node_modules/lodash/_baseIsNative.js"(exports, module) {
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
    module.exports = baseIsNative;
  }
});

// node_modules/lodash/_getValue.js
var require_getValue = __commonJS({
  "node_modules/lodash/_getValue.js"(exports, module) {
    function getValue(object, key) {
      return object == null ? void 0 : object[key];
    }
    module.exports = getValue;
  }
});

// node_modules/lodash/_getNative.js
var require_getNative = __commonJS({
  "node_modules/lodash/_getNative.js"(exports, module) {
    var baseIsNative = require_baseIsNative();
    var getValue = require_getValue();
    function getNative(object, key) {
      var value = getValue(object, key);
      return baseIsNative(value) ? value : void 0;
    }
    module.exports = getNative;
  }
});

// node_modules/lodash/_nativeCreate.js
var require_nativeCreate = __commonJS({
  "node_modules/lodash/_nativeCreate.js"(exports, module) {
    var getNative = require_getNative();
    var nativeCreate = getNative(Object, "create");
    module.exports = nativeCreate;
  }
});

// node_modules/lodash/_hashClear.js
var require_hashClear = __commonJS({
  "node_modules/lodash/_hashClear.js"(exports, module) {
    var nativeCreate = require_nativeCreate();
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
      this.size = 0;
    }
    module.exports = hashClear;
  }
});

// node_modules/lodash/_hashDelete.js
var require_hashDelete = __commonJS({
  "node_modules/lodash/_hashDelete.js"(exports, module) {
    function hashDelete(key) {
      var result = this.has(key) && delete this.__data__[key];
      this.size -= result ? 1 : 0;
      return result;
    }
    module.exports = hashDelete;
  }
});

// node_modules/lodash/_hashGet.js
var require_hashGet = __commonJS({
  "node_modules/lodash/_hashGet.js"(exports, module) {
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
    module.exports = hashGet;
  }
});

// node_modules/lodash/_hashHas.js
var require_hashHas = __commonJS({
  "node_modules/lodash/_hashHas.js"(exports, module) {
    var nativeCreate = require_nativeCreate();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
    }
    module.exports = hashHas;
  }
});

// node_modules/lodash/_hashSet.js
var require_hashSet = __commonJS({
  "node_modules/lodash/_hashSet.js"(exports, module) {
    var nativeCreate = require_nativeCreate();
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    function hashSet(key, value) {
      var data = this.__data__;
      this.size += this.has(key) ? 0 : 1;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    module.exports = hashSet;
  }
});

// node_modules/lodash/_Hash.js
var require_Hash = __commonJS({
  "node_modules/lodash/_Hash.js"(exports, module) {
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
    module.exports = Hash;
  }
});

// node_modules/lodash/_listCacheClear.js
var require_listCacheClear = __commonJS({
  "node_modules/lodash/_listCacheClear.js"(exports, module) {
    function listCacheClear() {
      this.__data__ = [];
      this.size = 0;
    }
    module.exports = listCacheClear;
  }
});

// node_modules/lodash/eq.js
var require_eq = __commonJS({
  "node_modules/lodash/eq.js"(exports, module) {
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    module.exports = eq;
  }
});

// node_modules/lodash/_assocIndexOf.js
var require_assocIndexOf = __commonJS({
  "node_modules/lodash/_assocIndexOf.js"(exports, module) {
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
    module.exports = assocIndexOf;
  }
});

// node_modules/lodash/_listCacheDelete.js
var require_listCacheDelete = __commonJS({
  "node_modules/lodash/_listCacheDelete.js"(exports, module) {
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
    module.exports = listCacheDelete;
  }
});

// node_modules/lodash/_listCacheGet.js
var require_listCacheGet = __commonJS({
  "node_modules/lodash/_listCacheGet.js"(exports, module) {
    var assocIndexOf = require_assocIndexOf();
    function listCacheGet(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      return index < 0 ? void 0 : data[index][1];
    }
    module.exports = listCacheGet;
  }
});

// node_modules/lodash/_listCacheHas.js
var require_listCacheHas = __commonJS({
  "node_modules/lodash/_listCacheHas.js"(exports, module) {
    var assocIndexOf = require_assocIndexOf();
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    module.exports = listCacheHas;
  }
});

// node_modules/lodash/_listCacheSet.js
var require_listCacheSet = __commonJS({
  "node_modules/lodash/_listCacheSet.js"(exports, module) {
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
    module.exports = listCacheSet;
  }
});

// node_modules/lodash/_ListCache.js
var require_ListCache = __commonJS({
  "node_modules/lodash/_ListCache.js"(exports, module) {
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
    module.exports = ListCache;
  }
});

// node_modules/lodash/_Map.js
var require_Map = __commonJS({
  "node_modules/lodash/_Map.js"(exports, module) {
    var getNative = require_getNative();
    var root = require_root();
    var Map2 = getNative(root, "Map");
    module.exports = Map2;
  }
});

// node_modules/lodash/_mapCacheClear.js
var require_mapCacheClear = __commonJS({
  "node_modules/lodash/_mapCacheClear.js"(exports, module) {
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
    module.exports = mapCacheClear;
  }
});

// node_modules/lodash/_isKeyable.js
var require_isKeyable = __commonJS({
  "node_modules/lodash/_isKeyable.js"(exports, module) {
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    module.exports = isKeyable;
  }
});

// node_modules/lodash/_getMapData.js
var require_getMapData = __commonJS({
  "node_modules/lodash/_getMapData.js"(exports, module) {
    var isKeyable = require_isKeyable();
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    module.exports = getMapData;
  }
});

// node_modules/lodash/_mapCacheDelete.js
var require_mapCacheDelete = __commonJS({
  "node_modules/lodash/_mapCacheDelete.js"(exports, module) {
    var getMapData = require_getMapData();
    function mapCacheDelete(key) {
      var result = getMapData(this, key)["delete"](key);
      this.size -= result ? 1 : 0;
      return result;
    }
    module.exports = mapCacheDelete;
  }
});

// node_modules/lodash/_mapCacheGet.js
var require_mapCacheGet = __commonJS({
  "node_modules/lodash/_mapCacheGet.js"(exports, module) {
    var getMapData = require_getMapData();
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    module.exports = mapCacheGet;
  }
});

// node_modules/lodash/_mapCacheHas.js
var require_mapCacheHas = __commonJS({
  "node_modules/lodash/_mapCacheHas.js"(exports, module) {
    var getMapData = require_getMapData();
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    module.exports = mapCacheHas;
  }
});

// node_modules/lodash/_mapCacheSet.js
var require_mapCacheSet = __commonJS({
  "node_modules/lodash/_mapCacheSet.js"(exports, module) {
    var getMapData = require_getMapData();
    function mapCacheSet(key, value) {
      var data = getMapData(this, key), size = data.size;
      data.set(key, value);
      this.size += data.size == size ? 0 : 1;
      return this;
    }
    module.exports = mapCacheSet;
  }
});

// node_modules/lodash/_MapCache.js
var require_MapCache = __commonJS({
  "node_modules/lodash/_MapCache.js"(exports, module) {
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
    module.exports = MapCache;
  }
});

// node_modules/lodash/memoize.js
var require_memoize = __commonJS({
  "node_modules/lodash/memoize.js"(exports, module) {
    var MapCache = require_MapCache();
    var FUNC_ERROR_TEXT = "Expected a function";
    function memoize(func, resolver) {
      if (typeof func != "function" || resolver != null && typeof resolver != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      var memoized = function() {
        var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
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
    module.exports = memoize;
  }
});

// node_modules/lodash/_memoizeCapped.js
var require_memoizeCapped = __commonJS({
  "node_modules/lodash/_memoizeCapped.js"(exports, module) {
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
    module.exports = memoizeCapped;
  }
});

// node_modules/lodash/_stringToPath.js
var require_stringToPath = __commonJS({
  "node_modules/lodash/_stringToPath.js"(exports, module) {
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
    module.exports = stringToPath;
  }
});

// node_modules/lodash/_arrayMap.js
var require_arrayMap = __commonJS({
  "node_modules/lodash/_arrayMap.js"(exports, module) {
    function arrayMap(array, iteratee) {
      var index = -1, length = array == null ? 0 : array.length, result = Array(length);
      while (++index < length) {
        result[index] = iteratee(array[index], index, array);
      }
      return result;
    }
    module.exports = arrayMap;
  }
});

// node_modules/lodash/_baseToString.js
var require_baseToString = __commonJS({
  "node_modules/lodash/_baseToString.js"(exports, module) {
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
    module.exports = baseToString;
  }
});

// node_modules/lodash/toString.js
var require_toString = __commonJS({
  "node_modules/lodash/toString.js"(exports, module) {
    var baseToString = require_baseToString();
    function toString(value) {
      return value == null ? "" : baseToString(value);
    }
    module.exports = toString;
  }
});

// node_modules/lodash/_castPath.js
var require_castPath = __commonJS({
  "node_modules/lodash/_castPath.js"(exports, module) {
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
    module.exports = castPath;
  }
});

// node_modules/lodash/_toKey.js
var require_toKey = __commonJS({
  "node_modules/lodash/_toKey.js"(exports, module) {
    var isSymbol = require_isSymbol();
    var INFINITY = 1 / 0;
    function toKey(value) {
      if (typeof value == "string" || isSymbol(value)) {
        return value;
      }
      var result = value + "";
      return result == "0" && 1 / value == -INFINITY ? "-0" : result;
    }
    module.exports = toKey;
  }
});

// node_modules/lodash/_baseGet.js
var require_baseGet = __commonJS({
  "node_modules/lodash/_baseGet.js"(exports, module) {
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
    module.exports = baseGet;
  }
});

// node_modules/lodash/get.js
var require_get = __commonJS({
  "node_modules/lodash/get.js"(exports, module) {
    var baseGet = require_baseGet();
    function get(object, path, defaultValue) {
      var result = object == null ? void 0 : baseGet(object, path);
      return result === void 0 ? defaultValue : result;
    }
    module.exports = get;
  }
});

// node_modules/@forge/i18n/out/translationValueGetter.js
var require_translationValueGetter = __commonJS({
  "node_modules/@forge/i18n/out/translationValueGetter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getTranslationValueFromContent = exports.getTranslationValue = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var get_1 = tslib_1.__importDefault(require_get());
    var getTranslationValue = (translationLookup, i18nKey, locale) => {
      const translation = translationLookup[locale];
      if (!translation) {
        return null;
      }
      return (0, exports.getTranslationValueFromContent)(translation, i18nKey);
    };
    exports.getTranslationValue = getTranslationValue;
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
    exports.getTranslationValueFromContent = getTranslationValueFromContent;
  }
});

// node_modules/@forge/i18n/out/translator.js
var require_translator = __commonJS({
  "node_modules/@forge/i18n/out/translator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Translator = void 0;
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
    exports.Translator = Translator;
  }
});

// node_modules/@forge/i18n/out/ensureLocale.js
var require_ensureLocale = __commonJS({
  "node_modules/@forge/i18n/out/ensureLocale.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ensureLocale = void 0;
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
    exports.ensureLocale = ensureLocale;
  }
});

// node_modules/@forge/i18n/out/moduleI18nHelper.js
var require_moduleI18nHelper = __commonJS({
  "node_modules/@forge/i18n/out/moduleI18nHelper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getI18nSupportedModuleEntries = void 0;
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
    exports.getI18nSupportedModuleEntries = getI18nSupportedModuleEntries;
    var extractI18nKeysFromModules = (modules) => {
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
    var extractI18nPropertiesFromModules = (modules) => {
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
  }
});

// node_modules/@forge/i18n/out/types.js
var require_types = __commonJS({
  "node_modules/@forge/i18n/out/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@forge/i18n/out/index.js
var require_out = __commonJS({
  "node_modules/@forge/i18n/out/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getI18nSupportedModuleEntries = exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getTranslationValue = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_constants(), exports);
    tslib_1.__exportStar(require_translationsGetter(), exports);
    tslib_1.__exportStar(require_translator(), exports);
    tslib_1.__exportStar(require_ensureLocale(), exports);
    var translationValueGetter_1 = require_translationValueGetter();
    Object.defineProperty(exports, "getTranslationValue", { enumerable: true, get: function() {
      return translationValueGetter_1.getTranslationValue;
    } });
    var moduleI18nHelper_1 = require_moduleI18nHelper();
    Object.defineProperty(exports, "extractI18nKeysFromModules", { enumerable: true, get: function() {
      return moduleI18nHelper_1.extractI18nKeysFromModules;
    } });
    Object.defineProperty(exports, "extractI18nPropertiesFromModules", { enumerable: true, get: function() {
      return moduleI18nHelper_1.extractI18nPropertiesFromModules;
    } });
    Object.defineProperty(exports, "getI18nSupportedModuleEntries", { enumerable: true, get: function() {
      return moduleI18nHelper_1.getI18nSupportedModuleEntries;
    } });
    tslib_1.__exportStar(require_types(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/getContext.js
var require_getContext = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/getContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getContext = void 0;
    var bridge_1 = require_bridge();
    var i18n_1 = require_out();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getContext = async () => {
      var _a;
      const context = await callBridge("getContext");
      const locale = context === null || context === void 0 ? void 0 : context.locale;
      if (locale) {
        context.locale = (_a = (0, i18n_1.ensureLocale)(locale)) !== null && _a !== void 0 ? _a : locale;
      }
      return context;
    };
    exports.getContext = getContext;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/changeWindowTitle.js
var require_changeWindowTitle = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/changeWindowTitle.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.changeWindowTitle = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var changeWindowTitle = async (title) => {
      try {
        await callBridge("changeWindowTitle", title);
      } catch (e) {
        throw new errors_1.BridgeAPIError("the window title wasn't changed due to error.");
      }
    };
    exports.changeWindowTitle = changeWindowTitle;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/theme.js
var require_theme = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/theme.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.theme = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    exports.theme = {
      enable: () => callBridge("enableTheming")
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/utils/blobParser.js
var require_blobParser = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/utils/blobParser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.blobToBase64 = exports.base64ToBlob = void 0;
    var base64ToBlob = (b64string, mimeType) => {
      if (!b64string) {
        return null;
      }
      const base64Data = b64string.includes(";base64") ? b64string.split(",")[1] : b64string;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    };
    exports.base64ToBlob = base64ToBlob;
    var blobToBase64 = (blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };
    exports.blobToBase64 = blobToBase64;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/events/serialiseBlob.js
var require_serialiseBlob = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/events/serialiseBlob.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.containsSerialisedBlobs = exports.containsBlobs = exports.deserialiseBlobsInPayload = exports.serialiseBlobsInPayload = void 0;
    var blobParser_1 = require_blobParser();
    var isPlainObject = (value) => {
      if (typeof value !== "object" || value === null)
        return false;
      if (Object.prototype.toString.call(value) !== "[object Object]")
        return false;
      const proto = Object.getPrototypeOf(value);
      if (proto === null)
        return true;
      const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
      return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
    };
    var blobToBase64WithMetadata = async (blob) => {
      const base64Data = await (0, blobParser_1.blobToBase64)(blob);
      return {
        data: base64Data,
        type: blob.type
      };
    };
    var base64WithMetadataToBlob = (metadata) => {
      return (0, blobParser_1.base64ToBlob)(metadata.data, metadata.type);
    };
    var serialiseBlobsInPayload = async (payload) => {
      if (payload instanceof Blob) {
        const blobData = await blobToBase64WithMetadata(payload);
        return {
          ...blobData,
          // Custom property used to identify serialized blob data for deserialization
          __isBlobData: true
        };
      }
      if (Array.isArray(payload)) {
        return Promise.all(payload.map((item) => (0, exports.serialiseBlobsInPayload)(item)));
      }
      if (payload && isPlainObject(payload)) {
        const entries = await Promise.all(Object.entries(payload).map(async ([key, value]) => [key, await (0, exports.serialiseBlobsInPayload)(value)]));
        return Object.fromEntries(entries);
      }
      return payload;
    };
    exports.serialiseBlobsInPayload = serialiseBlobsInPayload;
    var deserialiseBlobsInPayload = (payload) => {
      if (payload && isPlainObject(payload) && "__isBlobData" in payload) {
        const typedData = payload;
        return base64WithMetadataToBlob({
          data: typedData.data,
          type: typedData.type
        });
      }
      if (Array.isArray(payload)) {
        return payload.map((item) => (0, exports.deserialiseBlobsInPayload)(item));
      }
      if (payload && isPlainObject(payload)) {
        const result = {};
        for (const [key, value] of Object.entries(payload)) {
          result[key] = (0, exports.deserialiseBlobsInPayload)(value);
        }
        return result;
      }
      return payload;
    };
    exports.deserialiseBlobsInPayload = deserialiseBlobsInPayload;
    var containsBlobs = (payload) => {
      if (payload instanceof Blob) {
        return true;
      }
      if (Array.isArray(payload)) {
        return payload.some((item) => (0, exports.containsBlobs)(item));
      }
      if (payload && isPlainObject(payload)) {
        return Object.values(payload).some((value) => (0, exports.containsBlobs)(value));
      }
      return false;
    };
    exports.containsBlobs = containsBlobs;
    var containsSerialisedBlobs = (payload) => {
      if (payload && isPlainObject(payload) && "__isBlobData" in payload) {
        return true;
      }
      if (Array.isArray(payload)) {
        return payload.some((item) => (0, exports.containsSerialisedBlobs)(item));
      }
      if (payload && isPlainObject(payload)) {
        return Object.values(payload).some((value) => (0, exports.containsSerialisedBlobs)(value));
      }
      return false;
    };
    exports.containsSerialisedBlobs = containsSerialisedBlobs;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/events/events.js
var require_events = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/events/events.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.events = void 0;
    var bridge_1 = require_bridge();
    var serialiseBlob_1 = require_serialiseBlob();
    var callBridge = (0, bridge_1.getCallBridge)();
    var wrapCallback = (callback) => {
      return (payload) => {
        let newPayload = payload;
        if ((0, serialiseBlob_1.containsSerialisedBlobs)(payload)) {
          newPayload = (0, serialiseBlob_1.deserialiseBlobsInPayload)(payload);
        }
        return callback(newPayload);
      };
    };
    var emit = async (event, payload) => {
      let newPayload = payload;
      if ((0, serialiseBlob_1.containsBlobs)(payload)) {
        newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
      }
      return callBridge("emit", { event, payload: newPayload });
    };
    var on = (event, callback) => {
      return callBridge("on", { event, callback: wrapCallback(callback) });
    };
    var emitPublic = async (event, payload) => {
      let newPayload = payload;
      if ((0, serialiseBlob_1.containsBlobs)(payload)) {
        newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
      }
      return callBridge("emitPublic", { event, payload: newPayload });
    };
    var onPublic = (event, callback) => {
      return callBridge("onPublic", { event, callback: wrapCallback(callback) });
    };
    exports.events = {
      emit,
      on,
      emitPublic,
      onPublic
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/emitReadyEvent.js
var require_emitReadyEvent = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/emitReadyEvent.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.emitReadyEvent = void 0;
    var events_1 = require_events();
    var view_1 = require_view();
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var EXTENSION_READY = "EXTENSION_READY";
    var emitReadyEvent = async () => {
      const context = await view_1.view.getContext();
      await events_1.events.emit(EXTENSION_READY, {
        localId: context.localId
      });
      try {
        await callBridge("emitReadyEvent");
      } catch {
      }
    };
    exports.emitReadyEvent = emitReadyEvent;
  }
});

// node_modules/iframe-resizer/js/iframeResizer.js
var require_iframeResizer = __commonJS({
  "node_modules/iframe-resizer/js/iframeResizer.js"(exports, module) {
    console.info(`
IFRAME-RESIZER

Iframe-Resizer 5 is now available via the following two packages:

 * @iframe-resizer/parent
 * @iframe-resizer/child

Additionally their are also new versions of iframe-resizer for React, Vue, and jQuery.

Version 5 of iframe-resizer has been extensively rewritten to use modern browser APIs, which has enabled significantly better performance and greater accuracy in the detection of content resizing events.

Please see https://iframe-resizer.com/upgrade for more details.
`);
    (function(undefined2) {
      if (typeof window === "undefined") return;
      var count = 0, destroyObserver, logEnabled = false, hiddenCheckEnabled = false, msgHeader = "message", msgHeaderLen = msgHeader.length, msgId = "[iFrameSizer]", msgIdLen = msgId.length, pagePosition = null, requestAnimationFrame = window.requestAnimationFrame, resetRequiredMethods = Object.freeze({
        max: 1,
        scroll: 1,
        bodyScroll: 1,
        documentElementScroll: 1
      }), settings = {}, timer = null, defaults = Object.freeze({
        autoResize: true,
        bodyBackground: null,
        bodyMargin: null,
        bodyMarginV1: 8,
        bodyPadding: null,
        checkOrigin: true,
        inPageLinks: false,
        enablePublicMethods: true,
        heightCalculationMethod: "bodyOffset",
        id: "iFrameResizer",
        interval: 32,
        license: "1jqr0si6pnt",
        log: false,
        maxHeight: Infinity,
        maxWidth: Infinity,
        minHeight: 0,
        minWidth: 0,
        mouseEvents: true,
        resizeFrom: "parent",
        scrolling: false,
        sizeHeight: true,
        sizeWidth: false,
        warningTimeout: 5e3,
        tolerance: 0,
        widthCalculationMethod: "scroll",
        onClose: function() {
          return true;
        },
        onClosed: function() {
        },
        onInit: function() {
        },
        onMessage: function() {
          warn("onMessage function not defined");
        },
        onMouseEnter: function() {
        },
        onMouseLeave: function() {
        },
        onResized: function() {
        },
        onScroll: function() {
          return true;
        }
      });
      function getMutationObserver() {
        return window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
      }
      function addEventListener(el, evt, func) {
        el.addEventListener(evt, func, false);
      }
      function removeEventListener(el, evt, func) {
        el.removeEventListener(evt, func, false);
      }
      function setupRequestAnimationFrame() {
        var vendors = ["moz", "webkit", "o", "ms"];
        var x;
        for (x = 0; x < vendors.length && !requestAnimationFrame; x += 1) {
          requestAnimationFrame = window[vendors[x] + "RequestAnimationFrame"];
        }
        if (requestAnimationFrame) {
          requestAnimationFrame = requestAnimationFrame.bind(window);
        } else {
          log("setup", "RequestAnimationFrame not supported");
        }
      }
      function getMyID(iframeId) {
        var retStr = "Host page: " + iframeId;
        if (window.top !== window.self) {
          retStr = window.parentIFrame && window.parentIFrame.getId ? window.parentIFrame.getId() + ": " + iframeId : "Nested host page: " + iframeId;
        }
        return retStr;
      }
      function formatLogHeader(iframeId) {
        return msgId + "[" + getMyID(iframeId) + "]";
      }
      function isLogEnabled(iframeId) {
        return settings[iframeId] ? settings[iframeId].log : logEnabled;
      }
      function log(iframeId, msg) {
        output("log", iframeId, msg, isLogEnabled(iframeId));
      }
      function info(iframeId, msg) {
        output("info", iframeId, msg, isLogEnabled(iframeId));
      }
      function warn(iframeId, msg) {
        output("warn", iframeId, msg, true);
      }
      function output(type, iframeId, msg, enabled) {
        if (true === enabled && "object" === typeof window.console) {
          console[type](formatLogHeader(iframeId), msg);
        }
      }
      function iFrameListener(event) {
        function resizeIFrame() {
          function resize() {
            setSize(messageData);
            setPagePosition(iframeId);
            on("onResized", messageData);
          }
          ensureInRange("Height");
          ensureInRange("Width");
          syncResize(resize, messageData, "init");
        }
        function processMsg() {
          var data = msg.slice(msgIdLen).split(":");
          var height = data[1] ? parseInt(data[1], 10) : 0;
          var iframe = settings[data[0]] && settings[data[0]].iframe;
          var compStyle = getComputedStyle(iframe);
          return {
            iframe,
            id: data[0],
            height: height + getPaddingEnds(compStyle) + getBorderEnds(compStyle),
            width: data[2],
            type: data[3]
          };
        }
        function getPaddingEnds(compStyle) {
          if (compStyle.boxSizing !== "border-box") {
            return 0;
          }
          var top = compStyle.paddingTop ? parseInt(compStyle.paddingTop, 10) : 0;
          var bot = compStyle.paddingBottom ? parseInt(compStyle.paddingBottom, 10) : 0;
          return top + bot;
        }
        function getBorderEnds(compStyle) {
          if (compStyle.boxSizing !== "border-box") {
            return 0;
          }
          var top = compStyle.borderTopWidth ? parseInt(compStyle.borderTopWidth, 10) : 0;
          var bot = compStyle.borderBottomWidth ? parseInt(compStyle.borderBottomWidth, 10) : 0;
          return top + bot;
        }
        function ensureInRange(Dimension) {
          var max = Number(settings[iframeId]["max" + Dimension]), min = Number(settings[iframeId]["min" + Dimension]), dimension = Dimension.toLowerCase(), size = Number(messageData[dimension]);
          log(iframeId, "Checking " + dimension + " is in range " + min + "-" + max);
          if (size < min) {
            size = min;
            log(iframeId, "Set " + dimension + " to min value");
          }
          if (size > max) {
            size = max;
            log(iframeId, "Set " + dimension + " to max value");
          }
          messageData[dimension] = "" + size;
        }
        function isMessageFromIFrame() {
          function checkAllowedOrigin() {
            function checkList() {
              var i = 0, retCode = false;
              log(
                iframeId,
                "Checking connection is from allowed list of origins: " + checkOrigin
              );
              for (; i < checkOrigin.length; i++) {
                if (checkOrigin[i] === origin) {
                  retCode = true;
                  break;
                }
              }
              return retCode;
            }
            function checkSingle() {
              var remoteHost = settings[iframeId] && settings[iframeId].remoteHost;
              log(iframeId, "Checking connection is from: " + remoteHost);
              return origin === remoteHost;
            }
            return checkOrigin.constructor === Array ? checkList() : checkSingle();
          }
          var origin = event.origin, checkOrigin = settings[iframeId] && settings[iframeId].checkOrigin;
          if (checkOrigin && "" + origin !== "null" && !checkAllowedOrigin()) {
            throw new Error(
              "Unexpected message received from: " + origin + " for " + messageData.iframe.id + ". Message was: " + event.data + ". This error can be disabled by setting the checkOrigin: false option or by providing of array of trusted domains."
            );
          }
          return true;
        }
        function isMessageForUs() {
          return msgId === ("" + msg).slice(0, msgIdLen) && msg.slice(msgIdLen).split(":")[0] in settings;
        }
        function isMessageFromMetaParent() {
          var retCode = messageData.type in { true: 1, false: 1, undefined: 1 };
          if (retCode) {
            log(iframeId, "Ignoring init message from meta parent page");
          }
          return retCode;
        }
        function getMsgBody(offset) {
          return msg.slice(msg.indexOf(":") + msgHeaderLen + offset);
        }
        function forwardMsgFromIFrame(msgBody) {
          log(
            iframeId,
            "onMessage passed: {iframe: " + messageData.iframe.id + ", message: " + msgBody + "}"
          );
          on("onMessage", {
            iframe: messageData.iframe,
            message: JSON.parse(msgBody)
          });
          log(iframeId, "--");
        }
        function getPageInfo() {
          var bodyPosition = document.body.getBoundingClientRect(), iFramePosition = messageData.iframe.getBoundingClientRect();
          return JSON.stringify({
            iframeHeight: iFramePosition.height,
            iframeWidth: iFramePosition.width,
            clientHeight: Math.max(
              document.documentElement.clientHeight,
              window.innerHeight || 0
            ),
            clientWidth: Math.max(
              document.documentElement.clientWidth,
              window.innerWidth || 0
            ),
            offsetTop: parseInt(iFramePosition.top - bodyPosition.top, 10),
            offsetLeft: parseInt(iFramePosition.left - bodyPosition.left, 10),
            scrollTop: window.pageYOffset,
            scrollLeft: window.pageXOffset,
            documentHeight: document.documentElement.clientHeight,
            documentWidth: document.documentElement.clientWidth,
            windowHeight: window.innerHeight,
            windowWidth: window.innerWidth
          });
        }
        function sendPageInfoToIframe(iframe, iframeId2) {
          function debouncedTrigger() {
            trigger("Send Page Info", "pageInfo:" + getPageInfo(), iframe, iframeId2);
          }
          debounceFrameEvents(debouncedTrigger, 32, iframeId2);
        }
        function startPageInfoMonitor() {
          function setListener(type, func) {
            function sendPageInfo() {
              if (settings[id]) {
                sendPageInfoToIframe(settings[id].iframe, id);
              } else {
                stop();
              }
            }
            ;
            ["scroll", "resize"].forEach(function(evt) {
              log(id, type + evt + " listener for sendPageInfo");
              func(window, evt, sendPageInfo);
            });
          }
          function stop() {
            setListener("Remove ", removeEventListener);
          }
          function start() {
            setListener("Add ", addEventListener);
          }
          var id = iframeId;
          start();
          if (settings[id]) {
            settings[id].stopPageInfo = stop;
          }
        }
        function stopPageInfoMonitor() {
          if (settings[iframeId] && settings[iframeId].stopPageInfo) {
            settings[iframeId].stopPageInfo();
            delete settings[iframeId].stopPageInfo;
          }
        }
        function checkIFrameExists() {
          var retBool = true;
          if (null === messageData.iframe) {
            warn(iframeId, "IFrame (" + messageData.id + ") not found");
            retBool = false;
          }
          return retBool;
        }
        function getElementPosition(target) {
          var iFramePosition = target.getBoundingClientRect();
          getPagePosition(iframeId);
          return {
            x: Math.floor(Number(iFramePosition.left) + Number(pagePosition.x)),
            y: Math.floor(Number(iFramePosition.top) + Number(pagePosition.y))
          };
        }
        function scrollRequestFromChild(addOffset) {
          function reposition() {
            pagePosition = newPosition;
            scrollTo();
            log(iframeId, "--");
          }
          function calcOffset() {
            return {
              x: Number(messageData.width) + offset.x,
              y: Number(messageData.height) + offset.y
            };
          }
          function scrollParent() {
            if (window.parentIFrame) {
              window.parentIFrame["scrollTo" + (addOffset ? "Offset" : "")](
                newPosition.x,
                newPosition.y
              );
            } else {
              warn(
                iframeId,
                "Unable to scroll to requested position, window.parentIFrame not found"
              );
            }
          }
          var offset = addOffset ? getElementPosition(messageData.iframe) : { x: 0, y: 0 }, newPosition = calcOffset();
          log(
            iframeId,
            "Reposition requested from iFrame (offset x:" + offset.x + " y:" + offset.y + ")"
          );
          if (window.top === window.self) {
            reposition();
          } else {
            scrollParent();
          }
        }
        function scrollTo() {
          if (false === on("onScroll", pagePosition)) {
            unsetPagePosition();
          } else {
            setPagePosition(iframeId);
          }
        }
        function findTarget(location) {
          function jumpToTarget() {
            var jumpPosition = getElementPosition(target);
            log(
              iframeId,
              "Moving to in page link (#" + hash + ") at x: " + jumpPosition.x + " y: " + jumpPosition.y
            );
            pagePosition = {
              x: jumpPosition.x,
              y: jumpPosition.y
            };
            scrollTo();
            log(iframeId, "--");
          }
          function jumpToParent() {
            if (window.parentIFrame) {
              window.parentIFrame.moveToAnchor(hash);
            } else {
              log(
                iframeId,
                "In page link #" + hash + " not found and window.parentIFrame not found"
              );
            }
          }
          var hash = location.split("#")[1] || "", hashData = decodeURIComponent(hash), target = document.getElementById(hashData) || document.getElementsByName(hashData)[0];
          if (target) {
            jumpToTarget();
          } else if (window.top === window.self) {
            log(iframeId, "In page link #" + hash + " not found");
          } else {
            jumpToParent();
          }
        }
        function onMouse(event2) {
          var mousePos = {};
          if (Number(messageData.width) === 0 && Number(messageData.height) === 0) {
            var data = getMsgBody(9).split(":");
            mousePos = {
              x: data[1],
              y: data[0]
            };
          } else {
            mousePos = {
              x: messageData.width,
              y: messageData.height
            };
          }
          on(event2, {
            iframe: messageData.iframe,
            screenX: Number(mousePos.x),
            screenY: Number(mousePos.y),
            type: messageData.type
          });
        }
        function on(funcName, val) {
          return chkEvent(iframeId, funcName, val);
        }
        function actionMsg() {
          if (settings[iframeId] && settings[iframeId].firstRun) firstRun();
          switch (messageData.type) {
            case "close": {
              closeIFrame(messageData.iframe);
              break;
            }
            case "message": {
              forwardMsgFromIFrame(getMsgBody(6));
              break;
            }
            case "mouseenter": {
              onMouse("onMouseEnter");
              break;
            }
            case "mouseleave": {
              onMouse("onMouseLeave");
              break;
            }
            case "autoResize": {
              settings[iframeId].autoResize = JSON.parse(getMsgBody(9));
              break;
            }
            case "scrollTo": {
              scrollRequestFromChild(false);
              break;
            }
            case "scrollToOffset": {
              scrollRequestFromChild(true);
              break;
            }
            case "pageInfo": {
              sendPageInfoToIframe(
                settings[iframeId] && settings[iframeId].iframe,
                iframeId
              );
              startPageInfoMonitor();
              break;
            }
            case "pageInfoStop": {
              stopPageInfoMonitor();
              break;
            }
            case "inPageLink": {
              findTarget(getMsgBody(9));
              break;
            }
            case "reset": {
              resetIFrame(messageData);
              break;
            }
            case "init": {
              resizeIFrame();
              on("onInit", messageData.iframe);
              break;
            }
            default: {
              if (Number(messageData.width) === 0 && Number(messageData.height) === 0) {
                warn(
                  "Unsupported message received (" + messageData.type + "), this is likely due to the iframe containing a later version of iframe-resizer than the parent page"
                );
              } else {
                resizeIFrame();
              }
            }
          }
        }
        function hasSettings(iframeId2) {
          var retBool = true;
          if (!settings[iframeId2]) {
            retBool = false;
            warn(
              messageData.type + " No settings for " + iframeId2 + ". Message was: " + msg
            );
          }
          return retBool;
        }
        function iFrameReadyMsgReceived() {
          for (var iframeId2 in settings) {
            trigger(
              "iFrame requested init",
              createOutgoingMsg(iframeId2),
              settings[iframeId2].iframe,
              iframeId2
            );
          }
        }
        function firstRun() {
          if (settings[iframeId]) {
            settings[iframeId].firstRun = false;
          }
        }
        var msg = event.data, messageData = {}, iframeId = null;
        if ("[iFrameResizerChild]Ready" === msg) {
          iFrameReadyMsgReceived();
        } else if (isMessageForUs()) {
          messageData = processMsg();
          iframeId = messageData.id;
          if (settings[iframeId]) {
            settings[iframeId].loaded = true;
          }
          if (!isMessageFromMetaParent() && hasSettings(iframeId)) {
            log(iframeId, "Received: " + msg);
            if (checkIFrameExists() && isMessageFromIFrame()) {
              actionMsg();
            }
          }
        } else {
          info(iframeId, "Ignored: " + msg);
        }
      }
      function chkEvent(iframeId, funcName, val) {
        var func = null, retVal = null;
        if (settings[iframeId]) {
          func = settings[iframeId][funcName];
          if ("function" === typeof func) {
            retVal = func(val);
          } else {
            throw new TypeError(
              funcName + " on iFrame[" + iframeId + "] is not a function"
            );
          }
        }
        return retVal;
      }
      function removeIframeListeners(iframe) {
        var iframeId = iframe.id;
        delete settings[iframeId];
      }
      function closeIFrame(iframe) {
        var iframeId = iframe.id;
        if (chkEvent(iframeId, "onClose", iframeId) === false) {
          log(iframeId, "Close iframe cancelled by onClose event");
          return;
        }
        log(iframeId, "Removing iFrame: " + iframeId);
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (error) {
          warn(error);
        }
        chkEvent(iframeId, "onClosed", iframeId);
        log(iframeId, "--");
        removeIframeListeners(iframe);
        if (destroyObserver) {
          destroyObserver.disconnect();
          destroyObserver = null;
        }
      }
      function getPagePosition(iframeId) {
        if (null === pagePosition) {
          pagePosition = {
            x: window.pageXOffset === undefined2 ? document.documentElement.scrollLeft : window.pageXOffset,
            y: window.pageYOffset === undefined2 ? document.documentElement.scrollTop : window.pageYOffset
          };
          log(
            iframeId,
            "Get page position: " + pagePosition.x + "," + pagePosition.y
          );
        }
      }
      function setPagePosition(iframeId) {
        if (null !== pagePosition) {
          window.scrollTo(pagePosition.x, pagePosition.y);
          log(
            iframeId,
            "Set page position: " + pagePosition.x + "," + pagePosition.y
          );
          unsetPagePosition();
        }
      }
      function unsetPagePosition() {
        pagePosition = null;
      }
      function resetIFrame(messageData) {
        function reset() {
          setSize(messageData);
          trigger("reset", "reset", messageData.iframe, messageData.id);
        }
        log(
          messageData.id,
          "Size reset requested by " + ("init" === messageData.type ? "host page" : "iFrame")
        );
        getPagePosition(messageData.id);
        syncResize(reset, messageData, "reset");
      }
      function setSize(messageData) {
        function setDimension(dimension) {
          if (!messageData.id) {
            log("undefined", "messageData id not set");
            return;
          }
          messageData.iframe.style[dimension] = messageData[dimension] + "px";
          log(
            messageData.id,
            "IFrame (" + iframeId + ") " + dimension + " set to " + messageData[dimension] + "px"
          );
        }
        function chkZero(dimension) {
          if (!hiddenCheckEnabled && "0" === messageData[dimension]) {
            hiddenCheckEnabled = true;
            log(iframeId, "Hidden iFrame detected, creating visibility listener");
            fixHiddenIFrames();
          }
        }
        function processDimension(dimension) {
          setDimension(dimension);
          chkZero(dimension);
        }
        var iframeId = messageData.iframe.id;
        if (settings[iframeId]) {
          if (settings[iframeId].sizeHeight) {
            processDimension("height");
          }
          if (settings[iframeId].sizeWidth) {
            processDimension("width");
          }
        }
      }
      function syncResize(func, messageData, doNotSync) {
        if (doNotSync !== messageData.type && requestAnimationFrame && // including check for jasmine because had trouble getting spy to work in unit test using requestAnimationFrame
        !window.jasmine) {
          log(messageData.id, "Requesting animation frame");
          requestAnimationFrame(func);
        } else {
          func();
        }
      }
      function trigger(calleeMsg, msg, iframe, id, noResponseWarning) {
        function postMessageToIFrame() {
          var target = settings[id] && settings[id].targetOrigin;
          log(
            id,
            "[" + calleeMsg + "] Sending msg to iframe[" + id + "] (" + msg + ") targetOrigin: " + target
          );
          iframe.contentWindow.postMessage(msgId + msg, target);
        }
        function iFrameNotFound() {
          warn(id, "[" + calleeMsg + "] IFrame(" + id + ") not found");
        }
        function chkAndSend() {
          if (iframe && "contentWindow" in iframe && null !== iframe.contentWindow) {
            postMessageToIFrame();
          } else {
            iFrameNotFound();
          }
        }
        function warnOnNoResponse() {
          function warning() {
            if (settings[id] && !settings[id].loaded && !errorShown) {
              errorShown = true;
              warn(
                id,
                "IFrame has not responded within " + settings[id].warningTimeout / 1e3 + " seconds. Check iFrameResizer.contentWindow.js has been loaded in iFrame. This message can be ignored if everything is working, or you can set the warningTimeout option to a higher value or zero to suppress this warning."
              );
            }
          }
          if (!!noResponseWarning && settings[id] && !!settings[id].warningTimeout) {
            settings[id].msgTimeout = setTimeout(
              warning,
              settings[id].warningTimeout
            );
          }
        }
        var errorShown = false;
        id = id || iframe.id;
        if (settings[id]) {
          chkAndSend();
          warnOnNoResponse();
        }
      }
      function createOutgoingMsg(iframeId) {
        return iframeId + ":" + settings[iframeId].bodyMarginV1 + ":" + settings[iframeId].sizeWidth + ":" + settings[iframeId].log + ":" + settings[iframeId].interval + ":" + settings[iframeId].enablePublicMethods + ":" + settings[iframeId].autoResize + ":" + settings[iframeId].bodyMargin + ":" + settings[iframeId].heightCalculationMethod + ":" + settings[iframeId].bodyBackground + ":" + settings[iframeId].bodyPadding + ":" + settings[iframeId].tolerance + ":" + settings[iframeId].inPageLinks + ":" + settings[iframeId].resizeFrom + ":" + settings[iframeId].widthCalculationMethod + ":" + settings[iframeId].mouseEvents;
      }
      function isNumber(value) {
        return typeof value === "number";
      }
      function setupIFrame(iframe, options) {
        function setLimits() {
          function addStyle(style) {
            var styleValue = settings[iframeId][style];
            if (Infinity !== styleValue && 0 !== styleValue) {
              iframe.style[style] = isNumber(styleValue) ? styleValue + "px" : styleValue;
              log(iframeId, "Set " + style + " = " + iframe.style[style]);
            }
          }
          function chkMinMax(dimension) {
            if (settings[iframeId]["min" + dimension] > settings[iframeId]["max" + dimension]) {
              throw new Error(
                "Value for min" + dimension + " can not be greater than max" + dimension
              );
            }
          }
          chkMinMax("Height");
          chkMinMax("Width");
          addStyle("maxHeight");
          addStyle("minHeight");
          addStyle("maxWidth");
          addStyle("minWidth");
        }
        function newId() {
          var id = options && options.id || defaults.id + count++;
          if (null !== document.getElementById(id)) {
            id += count++;
          }
          return id;
        }
        function ensureHasId(iframeId2) {
          if (typeof iframeId2 !== "string") {
            throw new TypeError("Invaild id for iFrame. Expected String");
          }
          if ("" === iframeId2) {
            iframe.id = iframeId2 = newId();
            logEnabled = (options || {}).log;
            log(
              iframeId2,
              "Added missing iframe ID: " + iframeId2 + " (" + iframe.src + ")"
            );
          }
          return iframeId2;
        }
        function setScrolling() {
          log(
            iframeId,
            "IFrame scrolling " + (settings[iframeId] && settings[iframeId].scrolling ? "enabled" : "disabled") + " for " + iframeId
          );
          iframe.style.overflow = false === (settings[iframeId] && settings[iframeId].scrolling) ? "hidden" : "auto";
          switch (settings[iframeId] && settings[iframeId].scrolling) {
            case "omit": {
              break;
            }
            case true: {
              iframe.scrolling = "yes";
              break;
            }
            case false: {
              iframe.scrolling = "no";
              break;
            }
            default: {
              iframe.scrolling = settings[iframeId] ? settings[iframeId].scrolling : "no";
            }
          }
        }
        function setupBodyMarginValues() {
          if ("number" === typeof (settings[iframeId] && settings[iframeId].bodyMargin) || "0" === (settings[iframeId] && settings[iframeId].bodyMargin)) {
            settings[iframeId].bodyMarginV1 = settings[iframeId].bodyMargin;
            settings[iframeId].bodyMargin = "" + settings[iframeId].bodyMargin + "px";
          }
        }
        function checkReset() {
          var firstRun = settings[iframeId] && settings[iframeId].firstRun, resetRequertMethod = settings[iframeId] && settings[iframeId].heightCalculationMethod in resetRequiredMethods;
          if (!firstRun && resetRequertMethod) {
            resetIFrame({ iframe, height: 0, width: 0, type: "init" });
          }
        }
        function setupIFrameObject() {
          if (settings[iframeId]) {
            settings[iframeId].iframe.iFrameResizer = {
              close: closeIFrame.bind(null, settings[iframeId].iframe),
              removeListeners: removeIframeListeners.bind(
                null,
                settings[iframeId].iframe
              ),
              resize: trigger.bind(
                null,
                "Window resize",
                "resize",
                settings[iframeId].iframe
              ),
              moveToAnchor: function(anchor) {
                trigger(
                  "Move to anchor",
                  "moveToAnchor:" + anchor,
                  settings[iframeId].iframe,
                  iframeId
                );
              },
              sendMessage: function(message) {
                message = JSON.stringify(message);
                trigger(
                  "Send Message",
                  "message:" + message,
                  settings[iframeId].iframe,
                  iframeId
                );
              }
            };
          }
        }
        function init(msg) {
          function iFrameLoaded() {
            trigger("iFrame.onload", msg, iframe, undefined2, true);
            checkReset();
          }
          function createDestroyObserver(MutationObserver2) {
            if (!iframe.parentNode) {
              return null;
            }
            var destroyObserver2 = new MutationObserver2(function(mutations) {
              mutations.forEach(function(mutation) {
                var removedNodes = Array.prototype.slice.call(mutation.removedNodes);
                removedNodes.forEach(function(removedNode) {
                  if (removedNode === iframe) {
                    closeIFrame(iframe);
                  }
                });
              });
            });
            destroyObserver2.observe(iframe.parentNode, {
              childList: true
            });
            return destroyObserver2;
          }
          var MutationObserver = getMutationObserver();
          if (MutationObserver) {
            destroyObserver = createDestroyObserver(MutationObserver);
          }
          addEventListener(iframe, "load", iFrameLoaded);
          trigger("init", msg, iframe, undefined2, true);
        }
        function checkOptions(options2) {
          if ("object" !== typeof options2) {
            throw new TypeError("Options is not an object");
          }
        }
        function copyOptions(options2) {
          for (var option in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, option)) {
              settings[iframeId][option] = Object.prototype.hasOwnProperty.call(
                options2,
                option
              ) ? options2[option] : defaults[option];
            }
          }
        }
        function getTargetOrigin(remoteHost) {
          return "" === remoteHost || null !== remoteHost.match(/^(about:blank|javascript:|file:\/\/)/) ? "*" : remoteHost;
        }
        function depricate(key) {
          var splitName = key.split("Callback");
          if (splitName.length === 2) {
            var name = "on" + splitName[0].charAt(0).toUpperCase() + splitName[0].slice(1);
            this[name] = this[key];
            delete this[key];
            warn(
              iframeId,
              "Deprecated: '" + key + "' has been renamed '" + name + "'. The old method will be removed in the next major version."
            );
          }
        }
        function processOptions(options2) {
          options2 = options2 || {};
          settings[iframeId] = /* @__PURE__ */ Object.create(null);
          settings[iframeId].iframe = iframe;
          settings[iframeId].firstRun = true;
          settings[iframeId].remoteHost = iframe.src && iframe.src.split("/").slice(0, 3).join("/");
          checkOptions(options2);
          Object.keys(options2).forEach(depricate, options2);
          copyOptions(options2);
          if (settings[iframeId]) {
            settings[iframeId].targetOrigin = true === settings[iframeId].checkOrigin ? getTargetOrigin(settings[iframeId].remoteHost) : "*";
          }
        }
        function beenHere() {
          return iframeId in settings && "iFrameResizer" in iframe;
        }
        var iframeId = ensureHasId(iframe.id);
        if (beenHere()) {
          warn(iframeId, "Ignored iFrame, already setup.");
        } else {
          processOptions(options);
          setScrolling();
          setLimits();
          setupBodyMarginValues();
          init(createOutgoingMsg(iframeId));
          setupIFrameObject();
        }
      }
      function debouce(fn, time) {
        if (null === timer) {
          timer = setTimeout(function() {
            timer = null;
            fn();
          }, time);
        }
      }
      var frameTimer = {};
      function debounceFrameEvents(fn, time, frameId) {
        if (!frameTimer[frameId]) {
          frameTimer[frameId] = setTimeout(function() {
            frameTimer[frameId] = null;
            fn();
          }, time);
        }
      }
      function fixHiddenIFrames() {
        function checkIFrames() {
          function checkIFrame(settingId) {
            function chkDimension(dimension) {
              return "0px" === (settings[settingId] && settings[settingId].iframe.style[dimension]);
            }
            function isVisible(el) {
              return null !== el.offsetParent;
            }
            if (settings[settingId] && isVisible(settings[settingId].iframe) && (chkDimension("height") || chkDimension("width"))) {
              trigger(
                "Visibility change",
                "resize",
                settings[settingId].iframe,
                settingId
              );
            }
          }
          Object.keys(settings).forEach(function(key) {
            checkIFrame(key);
          });
        }
        function mutationObserved(mutations) {
          log(
            "window",
            "Mutation observed: " + mutations[0].target + " " + mutations[0].type
          );
          debouce(checkIFrames, 16);
        }
        function createMutationObserver() {
          var target = document.querySelector("body"), config = {
            attributes: true,
            attributeOldValue: false,
            characterData: true,
            characterDataOldValue: false,
            childList: true,
            subtree: true
          }, observer = new MutationObserver(mutationObserved);
          observer.observe(target, config);
        }
        var MutationObserver = getMutationObserver();
        if (MutationObserver) {
          createMutationObserver();
        }
      }
      function resizeIFrames(event) {
        function resize() {
          sendTriggerMsg("Window " + event, "resize");
        }
        log("window", "Trigger event: " + event);
        debouce(resize, 16);
      }
      function tabVisible() {
        function resize() {
          sendTriggerMsg("Tab Visible", "resize");
        }
        if ("hidden" !== document.visibilityState) {
          log("document", "Trigger event: Visibility change");
          debouce(resize, 16);
        }
      }
      function sendTriggerMsg(eventName, event) {
        function isIFrameResizeEnabled(iframeId) {
          return settings[iframeId] && "parent" === settings[iframeId].resizeFrom && settings[iframeId].autoResize && !settings[iframeId].firstRun;
        }
        Object.keys(settings).forEach(function(iframeId) {
          if (isIFrameResizeEnabled(iframeId)) {
            trigger(eventName, event, settings[iframeId].iframe, iframeId);
          }
        });
      }
      function setupEventListeners() {
        addEventListener(window, "message", iFrameListener);
        addEventListener(window, "resize", function() {
          resizeIFrames("resize");
        });
        addEventListener(document, "visibilitychange", tabVisible);
        addEventListener(document, "-webkit-visibilitychange", tabVisible);
      }
      function factory() {
        function init(options, element) {
          function chkType() {
            if (!element.tagName) {
              throw new TypeError("Object is not a valid DOM element");
            } else if ("IFRAME" !== element.tagName.toUpperCase()) {
              throw new TypeError(
                "Expected <IFRAME> tag, found <" + element.tagName + ">"
              );
            }
          }
          if (element) {
            chkType();
            setupIFrame(element, options);
            iFrames.push(element);
          }
        }
        function warnDeprecatedOptions(options) {
          if (options && options.enablePublicMethods) {
            warn(
              "enablePublicMethods option has been removed, public methods are now always available in the iFrame"
            );
          }
        }
        var iFrames;
        setupRequestAnimationFrame();
        setupEventListeners();
        return function iFrameResizeF(options, target) {
          iFrames = [];
          warnDeprecatedOptions(options);
          switch (typeof target) {
            case "undefined":
            case "string": {
              Array.prototype.forEach.call(
                document.querySelectorAll(target || "iframe"),
                init.bind(undefined2, options)
              );
              break;
            }
            case "object": {
              init(options, target);
              break;
            }
            default: {
              throw new TypeError("Unexpected data type (" + typeof target + ")");
            }
          }
          return iFrames;
        };
      }
      function createJQueryPublicMethod($) {
        if (!$.fn) {
          info("", "Unable to bind to jQuery, it is not fully loaded.");
        } else if (!$.fn.iFrameResize) {
          $.fn.iFrameResize = function $iFrameResizeF(options) {
            function init(index, element) {
              setupIFrame(element, options);
            }
            return this.filter("iframe").each(init).end();
          };
        }
      }
      if (window.jQuery !== undefined2) {
        createJQueryPublicMethod(window.jQuery);
      }
      if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = factory();
      }
      window.iFrameResize = window.iFrameResize || factory();
    })();
  }
});

// node_modules/iframe-resizer/js/iframeResizer.contentWindow.js
var require_iframeResizer_contentWindow = __commonJS({
  "node_modules/iframe-resizer/js/iframeResizer.contentWindow.js"(exports, module) {
    (function(undefined2) {
      if (typeof window === "undefined") return;
      var autoResize = true, base = 10, bodyBackground = "", bodyMargin = 0, bodyMarginStr = "", bodyObserver = null, bodyPadding = "", calculateWidth = false, doubleEventList = { resize: 1, click: 1 }, eventCancelTimer = 128, firstRun = true, height = 1, heightCalcModeDefault = "bodyOffset", heightCalcMode = heightCalcModeDefault, initLock = true, initMsg = "", inPageLinks = {}, interval = 32, intervalTimer = null, logging = false, mouseEvents = false, msgID = "[iFrameSizer]", msgIdLen = msgID.length, myID = "", resetRequiredMethods = {
        max: 1,
        min: 1,
        bodyScroll: 1,
        documentElementScroll: 1
      }, resizeFrom = "child", sendPermit = true, target = window.parent, targetOriginDefault = "*", tolerance = 0, triggerLocked = false, triggerLockedTimer = null, throttledTimer = 16, width = 1, widthCalcModeDefault = "scroll", widthCalcMode = widthCalcModeDefault, win = window, onMessage = function() {
        warn("onMessage function not defined");
      }, onReady = function() {
      }, onPageInfo = function() {
      }, customCalcMethods = {
        height: function() {
          warn("Custom height calculation function not defined");
          return document.documentElement.offsetHeight;
        },
        width: function() {
          warn("Custom width calculation function not defined");
          return document.body.scrollWidth;
        }
      }, eventHandlersByName = {}, passiveSupported = false;
      function noop() {
      }
      try {
        var options = Object.create(
          {},
          {
            passive: {
              // eslint-disable-next-line getter-return
              get: function() {
                passiveSupported = true;
              }
            }
          }
        );
        window.addEventListener("test", noop, options);
        window.removeEventListener("test", noop, options);
      } catch (error) {
      }
      function addEventListener(el, evt, func, options2) {
        el.addEventListener(evt, func, passiveSupported ? options2 || {} : false);
      }
      function removeEventListener(el, evt, func) {
        el.removeEventListener(evt, func, false);
      }
      function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
      }
      function throttle(func) {
        var context, args, result, timeout = null, previous = 0, later = function() {
          previous = Date.now();
          timeout = null;
          result = func.apply(context, args);
          if (!timeout) {
            context = args = null;
          }
        };
        return function() {
          var now = Date.now();
          if (!previous) {
            previous = now;
          }
          var remaining = throttledTimer - (now - previous);
          context = this;
          args = arguments;
          if (remaining <= 0 || remaining > throttledTimer) {
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
            if (!timeout) {
              context = args = null;
            }
          } else if (!timeout) {
            timeout = setTimeout(later, remaining);
          }
          return result;
        };
      }
      function formatLogMsg(msg) {
        return msgID + "[" + myID + "] " + msg;
      }
      function log(msg) {
        if (logging && "object" === typeof window.console) {
          console.log(formatLogMsg(msg));
        }
      }
      function warn(msg) {
        if ("object" === typeof window.console) {
          console.warn(formatLogMsg(msg));
        }
      }
      function init() {
        readDataFromParent();
        log("Initialising iFrame (" + window.location.href + ")");
        readDataFromPage();
        setMargin();
        setBodyStyle("background", bodyBackground);
        setBodyStyle("padding", bodyPadding);
        injectClearFixIntoBodyElement();
        checkHeightMode();
        checkWidthMode();
        stopInfiniteResizingOfIFrame();
        setupPublicMethods();
        setupMouseEvents();
        startEventListeners();
        inPageLinks = setupInPageLinks();
        sendSize("init", "Init message from host page");
        onReady();
      }
      function readDataFromParent() {
        function strBool(str) {
          return "true" === str;
        }
        var data = initMsg.slice(msgIdLen).split(":");
        myID = data[0];
        bodyMargin = undefined2 === data[1] ? bodyMargin : Number(data[1]);
        calculateWidth = undefined2 === data[2] ? calculateWidth : strBool(data[2]);
        logging = undefined2 === data[3] ? logging : strBool(data[3]);
        interval = undefined2 === data[4] ? interval : Number(data[4]);
        autoResize = undefined2 === data[6] ? autoResize : strBool(data[6]);
        bodyMarginStr = data[7];
        heightCalcMode = undefined2 === data[8] ? heightCalcMode : data[8];
        bodyBackground = data[9];
        bodyPadding = data[10];
        tolerance = undefined2 === data[11] ? tolerance : Number(data[11]);
        inPageLinks.enable = undefined2 === data[12] ? false : strBool(data[12]);
        resizeFrom = undefined2 === data[13] ? resizeFrom : data[13];
        widthCalcMode = undefined2 === data[14] ? widthCalcMode : data[14];
        mouseEvents = undefined2 === data[15] ? mouseEvents : strBool(data[15]);
      }
      function depricate(key) {
        var splitName = key.split("Callback");
        if (splitName.length === 2) {
          var name = "on" + splitName[0].charAt(0).toUpperCase() + splitName[0].slice(1);
          this[name] = this[key];
          delete this[key];
          warn(
            "Deprecated: '" + key + "' has been renamed '" + name + "'. The old method will be removed in the next major version."
          );
        }
      }
      function readDataFromPage() {
        function readData() {
          var data = window.iFrameResizer;
          log("Reading data from page: " + JSON.stringify(data));
          Object.keys(data).forEach(depricate, data);
          onMessage = "onMessage" in data ? data.onMessage : onMessage;
          onReady = "onReady" in data ? data.onReady : onReady;
          targetOriginDefault = "targetOrigin" in data ? data.targetOrigin : targetOriginDefault;
          heightCalcMode = "heightCalculationMethod" in data ? data.heightCalculationMethod : heightCalcMode;
          widthCalcMode = "widthCalculationMethod" in data ? data.widthCalculationMethod : widthCalcMode;
        }
        function setupCustomCalcMethods(calcMode, calcFunc) {
          if ("function" === typeof calcMode) {
            log("Setup custom " + calcFunc + "CalcMethod");
            customCalcMethods[calcFunc] = calcMode;
            calcMode = "custom";
          }
          return calcMode;
        }
        if ("iFrameResizer" in window && Object === window.iFrameResizer.constructor) {
          readData();
          heightCalcMode = setupCustomCalcMethods(heightCalcMode, "height");
          widthCalcMode = setupCustomCalcMethods(widthCalcMode, "width");
        }
        log("TargetOrigin for parent set to: " + targetOriginDefault);
      }
      function chkCSS(attr, value) {
        if (-1 !== value.indexOf("-")) {
          warn("Negative CSS value ignored for " + attr);
          value = "";
        }
        return value;
      }
      function setBodyStyle(attr, value) {
        if (undefined2 !== value && "" !== value && "null" !== value) {
          document.body.style[attr] = value;
          log("Body " + attr + ' set to "' + value + '"');
        }
      }
      function setMargin() {
        if (undefined2 === bodyMarginStr) {
          bodyMarginStr = bodyMargin + "px";
        }
        setBodyStyle("margin", chkCSS("margin", bodyMarginStr));
      }
      function stopInfiniteResizingOfIFrame() {
        document.documentElement.style.height = "";
        document.body.style.height = "";
        log('HTML & body height set to "auto"');
      }
      function manageTriggerEvent(options2) {
        var listener = {
          add: function(eventName) {
            function handleEvent() {
              sendSize(options2.eventName, options2.eventType);
            }
            eventHandlersByName[eventName] = handleEvent;
            addEventListener(window, eventName, handleEvent, { passive: true });
          },
          remove: function(eventName) {
            var handleEvent = eventHandlersByName[eventName];
            delete eventHandlersByName[eventName];
            removeEventListener(window, eventName, handleEvent);
          }
        };
        if (options2.eventNames && Array.prototype.map) {
          options2.eventName = options2.eventNames[0];
          options2.eventNames.map(listener[options2.method]);
        } else {
          listener[options2.method](options2.eventName);
        }
        log(
          capitalizeFirstLetter(options2.method) + " event listener: " + options2.eventType
        );
      }
      function manageEventListeners(method) {
        manageTriggerEvent({
          method,
          eventType: "Animation Start",
          eventNames: ["animationstart", "webkitAnimationStart"]
        });
        manageTriggerEvent({
          method,
          eventType: "Animation Iteration",
          eventNames: ["animationiteration", "webkitAnimationIteration"]
        });
        manageTriggerEvent({
          method,
          eventType: "Animation End",
          eventNames: ["animationend", "webkitAnimationEnd"]
        });
        manageTriggerEvent({
          method,
          eventType: "Input",
          eventName: "input"
        });
        manageTriggerEvent({
          method,
          eventType: "Mouse Up",
          eventName: "mouseup"
        });
        manageTriggerEvent({
          method,
          eventType: "Mouse Down",
          eventName: "mousedown"
        });
        manageTriggerEvent({
          method,
          eventType: "Orientation Change",
          eventName: "orientationchange"
        });
        manageTriggerEvent({
          method,
          eventType: "Print",
          eventNames: ["afterprint", "beforeprint"]
        });
        manageTriggerEvent({
          method,
          eventType: "Ready State Change",
          eventName: "readystatechange"
        });
        manageTriggerEvent({
          method,
          eventType: "Touch Start",
          eventName: "touchstart"
        });
        manageTriggerEvent({
          method,
          eventType: "Touch End",
          eventName: "touchend"
        });
        manageTriggerEvent({
          method,
          eventType: "Touch Cancel",
          eventName: "touchcancel"
        });
        manageTriggerEvent({
          method,
          eventType: "Transition Start",
          eventNames: [
            "transitionstart",
            "webkitTransitionStart",
            "MSTransitionStart",
            "oTransitionStart",
            "otransitionstart"
          ]
        });
        manageTriggerEvent({
          method,
          eventType: "Transition Iteration",
          eventNames: [
            "transitioniteration",
            "webkitTransitionIteration",
            "MSTransitionIteration",
            "oTransitionIteration",
            "otransitioniteration"
          ]
        });
        manageTriggerEvent({
          method,
          eventType: "Transition End",
          eventNames: [
            "transitionend",
            "webkitTransitionEnd",
            "MSTransitionEnd",
            "oTransitionEnd",
            "otransitionend"
          ]
        });
        if ("child" === resizeFrom) {
          manageTriggerEvent({
            method,
            eventType: "IFrame Resized",
            eventName: "resize"
          });
        }
      }
      function checkCalcMode(calcMode, calcModeDefault, modes, type) {
        if (calcModeDefault !== calcMode) {
          if (!(calcMode in modes)) {
            warn(
              calcMode + " is not a valid option for " + type + "CalculationMethod."
            );
            calcMode = calcModeDefault;
          }
          log(type + ' calculation method set to "' + calcMode + '"');
        }
        return calcMode;
      }
      function checkHeightMode() {
        heightCalcMode = checkCalcMode(
          heightCalcMode,
          heightCalcModeDefault,
          getHeight,
          "height"
        );
      }
      function checkWidthMode() {
        widthCalcMode = checkCalcMode(
          widthCalcMode,
          widthCalcModeDefault,
          getWidth,
          "width"
        );
      }
      function startEventListeners() {
        if (true === autoResize) {
          manageEventListeners("add");
          setupMutationObserver();
        } else {
          log("Auto Resize disabled");
        }
      }
      function disconnectMutationObserver() {
        if (null !== bodyObserver) {
          bodyObserver.disconnect();
        }
      }
      function stopEventListeners() {
        manageEventListeners("remove");
        disconnectMutationObserver();
        clearInterval(intervalTimer);
      }
      function injectClearFixIntoBodyElement() {
        var clearFix = document.createElement("div");
        clearFix.style.clear = "both";
        clearFix.style.display = "block";
        clearFix.style.height = "0";
        document.body.appendChild(clearFix);
      }
      function setupInPageLinks() {
        function getPagePosition() {
          return {
            x: window.pageXOffset === undefined2 ? document.documentElement.scrollLeft : window.pageXOffset,
            y: window.pageYOffset === undefined2 ? document.documentElement.scrollTop : window.pageYOffset
          };
        }
        function getElementPosition(el) {
          var elPosition = el.getBoundingClientRect(), pagePosition = getPagePosition();
          return {
            x: parseInt(elPosition.left, 10) + parseInt(pagePosition.x, 10),
            y: parseInt(elPosition.top, 10) + parseInt(pagePosition.y, 10)
          };
        }
        function findTarget(location) {
          function jumpToTarget(target3) {
            var jumpPosition = getElementPosition(target3);
            log(
              "Moving to in page link (#" + hash + ") at x: " + jumpPosition.x + " y: " + jumpPosition.y
            );
            sendMsg(jumpPosition.y, jumpPosition.x, "scrollToOffset");
          }
          var hash = location.split("#")[1] || location, hashData = decodeURIComponent(hash), target2 = document.getElementById(hashData) || document.getElementsByName(hashData)[0];
          if (undefined2 === target2) {
            log(
              "In page link (#" + hash + ") not found in iFrame, so sending to parent"
            );
            sendMsg(0, 0, "inPageLink", "#" + hash);
          } else {
            jumpToTarget(target2);
          }
        }
        function checkLocationHash() {
          var hash = window.location.hash;
          var href = window.location.href;
          if ("" !== hash && "#" !== hash) {
            findTarget(href);
          }
        }
        function bindAnchors() {
          function setupLink(el) {
            function linkClicked(e) {
              e.preventDefault();
              findTarget(this.getAttribute("href"));
            }
            if ("#" !== el.getAttribute("href")) {
              addEventListener(el, "click", linkClicked);
            }
          }
          Array.prototype.forEach.call(
            document.querySelectorAll('a[href^="#"]'),
            setupLink
          );
        }
        function bindLocationHash() {
          addEventListener(window, "hashchange", checkLocationHash);
        }
        function initCheck() {
          setTimeout(checkLocationHash, eventCancelTimer);
        }
        function enableInPageLinks() {
          if (Array.prototype.forEach && document.querySelectorAll) {
            log("Setting up location.hash handlers");
            bindAnchors();
            bindLocationHash();
            initCheck();
          } else {
            warn(
              "In page linking not fully supported in this browser! (See README.md for IE8 workaround)"
            );
          }
        }
        if (inPageLinks.enable) {
          enableInPageLinks();
        } else {
          log("In page linking not enabled");
        }
        return {
          findTarget
        };
      }
      function setupMouseEvents() {
        if (mouseEvents !== true) return;
        function sendMouse(e) {
          sendMsg(0, 0, e.type, e.screenY + ":" + e.screenX);
        }
        function addMouseListener(evt, name) {
          log("Add event listener: " + name);
          addEventListener(window.document, evt, sendMouse);
        }
        addMouseListener("mouseenter", "Mouse Enter");
        addMouseListener("mouseleave", "Mouse Leave");
      }
      function setupPublicMethods() {
        log("Enable public methods");
        win.parentIFrame = {
          autoResize: function autoResizeF(resize) {
            if (true === resize && false === autoResize) {
              autoResize = true;
              startEventListeners();
            } else if (false === resize && true === autoResize) {
              autoResize = false;
              stopEventListeners();
            }
            sendMsg(0, 0, "autoResize", JSON.stringify(autoResize));
            return autoResize;
          },
          close: function closeF() {
            sendMsg(0, 0, "close");
          },
          getId: function getIdF() {
            return myID;
          },
          getPageInfo: function getPageInfoF(callback) {
            if ("function" === typeof callback) {
              onPageInfo = callback;
              sendMsg(0, 0, "pageInfo");
            } else {
              onPageInfo = function() {
              };
              sendMsg(0, 0, "pageInfoStop");
            }
          },
          moveToAnchor: function moveToAnchorF(hash) {
            inPageLinks.findTarget(hash);
          },
          reset: function resetF() {
            resetIFrame("parentIFrame.reset");
          },
          scrollTo: function scrollToF(x, y) {
            sendMsg(y, x, "scrollTo");
          },
          scrollToOffset: function scrollToF(x, y) {
            sendMsg(y, x, "scrollToOffset");
          },
          sendMessage: function sendMessageF(msg, targetOrigin) {
            sendMsg(0, 0, "message", JSON.stringify(msg), targetOrigin);
          },
          setHeightCalculationMethod: function setHeightCalculationMethodF(heightCalculationMethod) {
            heightCalcMode = heightCalculationMethod;
            checkHeightMode();
          },
          setWidthCalculationMethod: function setWidthCalculationMethodF(widthCalculationMethod) {
            widthCalcMode = widthCalculationMethod;
            checkWidthMode();
          },
          setTargetOrigin: function setTargetOriginF(targetOrigin) {
            log("Set targetOrigin: " + targetOrigin);
            targetOriginDefault = targetOrigin;
          },
          size: function sizeF(customHeight, customWidth) {
            var valString = "" + (customHeight || "") + (customWidth ? "," + customWidth : "");
            sendSize(
              "size",
              "parentIFrame.size(" + valString + ")",
              customHeight,
              customWidth
            );
          }
        };
      }
      function initInterval() {
        if (0 !== interval) {
          log("setInterval: " + interval + "ms");
          intervalTimer = setInterval(function() {
            sendSize("interval", "setInterval: " + interval);
          }, Math.abs(interval));
        }
      }
      function setupBodyMutationObserver() {
        function addImageLoadListners(mutation) {
          function addImageLoadListener(element) {
            if (false === element.complete) {
              log("Attach listeners to " + element.src);
              element.addEventListener("load", imageLoaded, false);
              element.addEventListener("error", imageError, false);
              elements.push(element);
            }
          }
          if (mutation.type === "attributes" && mutation.attributeName === "src") {
            addImageLoadListener(mutation.target);
          } else if (mutation.type === "childList") {
            Array.prototype.forEach.call(
              mutation.target.querySelectorAll("img"),
              addImageLoadListener
            );
          }
        }
        function removeFromArray(element) {
          elements.splice(elements.indexOf(element), 1);
        }
        function removeImageLoadListener(element) {
          log("Remove listeners from " + element.src);
          element.removeEventListener("load", imageLoaded, false);
          element.removeEventListener("error", imageError, false);
          removeFromArray(element);
        }
        function imageEventTriggered(event, type, typeDesc) {
          removeImageLoadListener(event.target);
          sendSize(type, typeDesc + ": " + event.target.src);
        }
        function imageLoaded(event) {
          imageEventTriggered(event, "imageLoad", "Image loaded");
        }
        function imageError(event) {
          imageEventTriggered(event, "imageLoadFailed", "Image load failed");
        }
        function mutationObserved(mutations) {
          sendSize(
            "mutationObserver",
            "mutationObserver: " + mutations[0].target + " " + mutations[0].type
          );
          mutations.forEach(addImageLoadListners);
        }
        function createMutationObserver() {
          var target2 = document.querySelector("body"), config = {
            attributes: true,
            attributeOldValue: false,
            characterData: true,
            characterDataOldValue: false,
            childList: true,
            subtree: true
          };
          observer = new MutationObserver(mutationObserved);
          log("Create body MutationObserver");
          observer.observe(target2, config);
          return observer;
        }
        var elements = [], MutationObserver = window.MutationObserver || window.WebKitMutationObserver, observer = createMutationObserver();
        return {
          disconnect: function() {
            if ("disconnect" in observer) {
              log("Disconnect body MutationObserver");
              observer.disconnect();
              elements.forEach(removeImageLoadListener);
            }
          }
        };
      }
      function setupMutationObserver() {
        var forceIntervalTimer = 0 > interval;
        if (window.MutationObserver || window.WebKitMutationObserver) {
          if (forceIntervalTimer) {
            initInterval();
          } else {
            bodyObserver = setupBodyMutationObserver();
          }
        } else {
          log("MutationObserver not supported in this browser!");
          initInterval();
        }
      }
      function getComputedStyle2(prop, el) {
        var retVal = 0;
        el = el || document.body;
        retVal = document.defaultView.getComputedStyle(el, null);
        retVal = null === retVal ? 0 : retVal[prop];
        return parseInt(retVal, base);
      }
      function chkEventThottle(timer) {
        if (timer > throttledTimer / 2) {
          throttledTimer = 2 * timer;
          log("Event throttle increased to " + throttledTimer + "ms");
        }
      }
      function getMaxElement(side, elements) {
        var elementsLength = elements.length, elVal = 0, maxVal = 0, Side = capitalizeFirstLetter(side), timer = Date.now();
        for (var i = 0; i < elementsLength; i++) {
          elVal = elements[i].getBoundingClientRect()[side] + getComputedStyle2("margin" + Side, elements[i]);
          if (elVal > maxVal) {
            maxVal = elVal;
          }
        }
        timer = Date.now() - timer;
        log("Parsed " + elementsLength + " HTML elements");
        log("Element position calculated in " + timer + "ms");
        chkEventThottle(timer);
        return maxVal;
      }
      function getAllMeasurements(dimensions) {
        return [
          dimensions.bodyOffset(),
          dimensions.bodyScroll(),
          dimensions.documentElementOffset(),
          dimensions.documentElementScroll()
        ];
      }
      function getTaggedElements(side, tag) {
        function noTaggedElementsFound() {
          warn("No tagged elements (" + tag + ") found on page");
          return document.querySelectorAll("body *");
        }
        var elements = document.querySelectorAll("[" + tag + "]");
        if (elements.length === 0) noTaggedElementsFound();
        return getMaxElement(side, elements);
      }
      function getAllElements() {
        return document.querySelectorAll("body *");
      }
      var getHeight = {
        bodyOffset: function getBodyOffsetHeight() {
          return document.body.offsetHeight + getComputedStyle2("marginTop") + getComputedStyle2("marginBottom");
        },
        offset: function() {
          return getHeight.bodyOffset();
        },
        bodyScroll: function getBodyScrollHeight() {
          return document.body.scrollHeight;
        },
        custom: function getCustomWidth() {
          return customCalcMethods.height();
        },
        documentElementOffset: function getDEOffsetHeight() {
          return document.documentElement.offsetHeight;
        },
        documentElementScroll: function getDEScrollHeight() {
          return document.documentElement.scrollHeight;
        },
        max: function getMaxHeight() {
          return Math.max.apply(null, getAllMeasurements(getHeight));
        },
        min: function getMinHeight() {
          return Math.min.apply(null, getAllMeasurements(getHeight));
        },
        grow: function growHeight() {
          return getHeight.max();
        },
        lowestElement: function getBestHeight() {
          return Math.max(
            getHeight.bodyOffset() || getHeight.documentElementOffset(),
            getMaxElement("bottom", getAllElements())
          );
        },
        taggedElement: function getTaggedElementsHeight() {
          return getTaggedElements("bottom", "data-iframe-height");
        }
      }, getWidth = {
        bodyScroll: function getBodyScrollWidth() {
          return document.body.scrollWidth;
        },
        bodyOffset: function getBodyOffsetWidth() {
          return document.body.offsetWidth;
        },
        custom: function getCustomWidth() {
          return customCalcMethods.width();
        },
        documentElementScroll: function getDEScrollWidth() {
          return document.documentElement.scrollWidth;
        },
        documentElementOffset: function getDEOffsetWidth() {
          return document.documentElement.offsetWidth;
        },
        scroll: function getMaxWidth() {
          return Math.max(getWidth.bodyScroll(), getWidth.documentElementScroll());
        },
        max: function getMaxWidth() {
          return Math.max.apply(null, getAllMeasurements(getWidth));
        },
        min: function getMinWidth() {
          return Math.min.apply(null, getAllMeasurements(getWidth));
        },
        rightMostElement: function rightMostElement() {
          return getMaxElement("right", getAllElements());
        },
        taggedElement: function getTaggedElementsWidth() {
          return getTaggedElements("right", "data-iframe-width");
        }
      };
      function sizeIFrame(triggerEvent, triggerEventDesc, customHeight, customWidth) {
        function resizeIFrame() {
          height = currentHeight;
          width = currentWidth;
          sendMsg(height, width, triggerEvent);
        }
        function isSizeChangeDetected() {
          function checkTolarance(a, b) {
            var retVal = Math.abs(a - b) <= tolerance;
            return !retVal;
          }
          currentHeight = undefined2 === customHeight ? getHeight[heightCalcMode]() : customHeight;
          currentWidth = undefined2 === customWidth ? getWidth[widthCalcMode]() : customWidth;
          return checkTolarance(height, currentHeight) || calculateWidth && checkTolarance(width, currentWidth);
        }
        function isForceResizableEvent() {
          return !(triggerEvent in { init: 1, interval: 1, size: 1 });
        }
        function isForceResizableCalcMode() {
          return heightCalcMode in resetRequiredMethods || calculateWidth && widthCalcMode in resetRequiredMethods;
        }
        function logIgnored() {
          log("No change in size detected");
        }
        function checkDownSizing() {
          if (isForceResizableEvent() && isForceResizableCalcMode()) {
            resetIFrame(triggerEventDesc);
          } else if (!(triggerEvent in { interval: 1 })) {
            logIgnored();
          }
        }
        var currentHeight, currentWidth;
        if (isSizeChangeDetected() || "init" === triggerEvent) {
          lockTrigger();
          resizeIFrame();
        } else {
          checkDownSizing();
        }
      }
      var sizeIFrameThrottled = throttle(sizeIFrame);
      function sendSize(triggerEvent, triggerEventDesc, customHeight, customWidth) {
        function recordTrigger() {
          if (!(triggerEvent in { reset: 1, resetPage: 1, init: 1 })) {
            log("Trigger event: " + triggerEventDesc);
          }
        }
        function isDoubleFiredEvent() {
          return triggerLocked && triggerEvent in doubleEventList;
        }
        if (isDoubleFiredEvent()) {
          log("Trigger event cancelled: " + triggerEvent);
        } else {
          recordTrigger();
          if (triggerEvent === "init") {
            sizeIFrame(triggerEvent, triggerEventDesc, customHeight, customWidth);
          } else {
            sizeIFrameThrottled(
              triggerEvent,
              triggerEventDesc,
              customHeight,
              customWidth
            );
          }
        }
      }
      function lockTrigger() {
        if (!triggerLocked) {
          triggerLocked = true;
          log("Trigger event lock on");
        }
        clearTimeout(triggerLockedTimer);
        triggerLockedTimer = setTimeout(function() {
          triggerLocked = false;
          log("Trigger event lock off");
          log("--");
        }, eventCancelTimer);
      }
      function triggerReset(triggerEvent) {
        height = getHeight[heightCalcMode]();
        width = getWidth[widthCalcMode]();
        sendMsg(height, width, triggerEvent);
      }
      function resetIFrame(triggerEventDesc) {
        var hcm = heightCalcMode;
        heightCalcMode = heightCalcModeDefault;
        log("Reset trigger event: " + triggerEventDesc);
        lockTrigger();
        triggerReset("reset");
        heightCalcMode = hcm;
      }
      function sendMsg(height2, width2, triggerEvent, msg, targetOrigin) {
        function setTargetOrigin() {
          if (undefined2 === targetOrigin) {
            targetOrigin = targetOriginDefault;
          } else {
            log("Message targetOrigin: " + targetOrigin);
          }
        }
        function sendToParent() {
          var size = height2 + ":" + width2, message = myID + ":" + size + ":" + triggerEvent + (undefined2 === msg ? "" : ":" + msg);
          log("Sending message to host page (" + message + ")");
          target.postMessage(msgID + message, targetOrigin);
        }
        if (true === sendPermit) {
          setTargetOrigin();
          sendToParent();
        }
      }
      function receiver(event) {
        var processRequestFromParent = {
          init: function initFromParent() {
            initMsg = event.data;
            target = event.source;
            init();
            firstRun = false;
            setTimeout(function() {
              initLock = false;
            }, eventCancelTimer);
          },
          reset: function resetFromParent() {
            if (initLock) {
              log("Page reset ignored by init");
            } else {
              log("Page size reset by host page");
              triggerReset("resetPage");
            }
          },
          resize: function resizeFromParent() {
            sendSize("resizeParent", "Parent window requested size check");
          },
          moveToAnchor: function moveToAnchorF() {
            inPageLinks.findTarget(getData());
          },
          inPageLink: function inPageLinkF() {
            this.moveToAnchor();
          },
          // Backward compatibility
          pageInfo: function pageInfoFromParent() {
            var msgBody = getData();
            log("PageInfoFromParent called from parent: " + msgBody);
            onPageInfo(JSON.parse(msgBody));
            log(" --");
          },
          message: function messageFromParent() {
            var msgBody = getData();
            log("onMessage called from parent: " + msgBody);
            onMessage(JSON.parse(msgBody));
            log(" --");
          }
        };
        function isMessageForUs() {
          return msgID === ("" + event.data).slice(0, msgIdLen);
        }
        function getMessageType() {
          return event.data.split("]")[1].split(":")[0];
        }
        function getData() {
          return event.data.slice(event.data.indexOf(":") + 1);
        }
        function isMiddleTier() {
          return !(typeof module !== "undefined" && module.exports) && "iFrameResize" in window || window.jQuery !== undefined2 && "iFrameResize" in window.jQuery.prototype;
        }
        function isInitMsg() {
          return event.data.split(":")[2] in { true: 1, false: 1 };
        }
        function callFromParent() {
          var messageType = getMessageType();
          if (messageType in processRequestFromParent) {
            processRequestFromParent[messageType]();
          } else if (!isMiddleTier() && !isInitMsg()) {
            warn("Unexpected message (" + event.data + ")");
          }
        }
        function processMessage() {
          if (false === firstRun) {
            callFromParent();
          } else if (isInitMsg()) {
            processRequestFromParent.init();
          } else {
            log(
              'Ignored message of type "' + getMessageType() + '". Received before initialization.'
            );
          }
        }
        if (isMessageForUs()) {
          processMessage();
        }
      }
      function chkLateLoaded() {
        if ("loading" !== document.readyState) {
          window.parent.postMessage("[iFrameResizerChild]Ready", "*");
        }
      }
      if (!("iframeResizer" in window)) {
        window.iframeChildListener = function(data) {
          receiver({ data, sameDomian: true });
        };
        addEventListener(window, "message", receiver);
        addEventListener(window, "readystatechange", chkLateLoaded);
        chkLateLoaded();
      }
    })();
  }
});

// node_modules/iframe-resizer/index.js
var require_iframe_resizer = __commonJS({
  "node_modules/iframe-resizer/index.js"(exports, module) {
    var iframeResize = require_iframeResizer();
    module.exports = {
      iframeResize,
      iframeResizer: iframeResize,
      // Backwards compatibility
      contentWindow: require_iframeResizer_contentWindow()
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/adf-renderer.js
var require_adf_renderer = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/adf-renderer.js"(exports) {
    "use strict";
    var __createBinding2 = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
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
    }));
    var __setModuleDefault2 = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar2 = exports && exports.__importStar || /* @__PURE__ */ (function() {
      var ownKeys2 = function(o) {
        ownKeys2 = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys2(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys2(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding2(result, mod, k[i]);
        }
        __setModuleDefault2(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createAdfRendererIframeProps = exports.sendMessageWhenReady = void 0;
    var READY_SIGNAL_FALLBACK_DELAY_MS = 1e4;
    var sendMessageWhenReady = (iframe, message, origin) => {
      const sendMessage = () => {
        var _a;
        return (_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) === null || _a === void 0 ? void 0 : _a.postMessage(message, origin);
      };
      const timeoutId = setTimeout(() => {
        window.removeEventListener("message", handleReady);
        sendMessage();
      }, READY_SIGNAL_FALLBACK_DELAY_MS);
      const handleReady = (event) => {
        var _a;
        if (event.source === (iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) && ((_a = event.data) === null || _a === void 0 ? void 0 : _a.source) === "forge-adf-renderer-ready") {
          clearTimeout(timeoutId);
          window.removeEventListener("message", handleReady);
          sendMessage();
        }
      };
      window.addEventListener("message", handleReady);
    };
    exports.sendMessageWhenReady = sendMessageWhenReady;
    var createAdfRendererIframeProps = async (context, iframeId) => {
      const IframeResizer = await Promise.resolve().then(() => __importStar2(require_iframe_resizer()));
      const IframeResizerModule = IframeResizer.default || IframeResizer;
      const origin = new URL(document.referrer).origin;
      const src = `${origin}/forge-apps/adf-renderer`;
      const id = iframeId || `forge-adf-renderer-iframe-${crypto.randomUUID()}`;
      const onLoad = () => {
        var _a, _b, _c, _d, _e;
        const iframe = document.getElementById(id);
        const message = {
          type: "adf-document",
          document: (_a = context.extension.macro) === null || _a === void 0 ? void 0 : _a.body,
          timestamp: Date.now(),
          source: "forge-adf-renderer",
          localId: context.localId,
          isEditing: (_c = (_b = context.extension) === null || _b === void 0 ? void 0 : _b.isEditing) !== null && _c !== void 0 ? _c : false,
          contentId: (_e = (_d = context.extension) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.id
        };
        IframeResizerModule.iframeResizer({
          heightCalculationMethod: "taggedElement",
          widthCalculationMethod: "bodyScroll",
          initCallback: (iframe2) => {
            var _a2;
            (_a2 = iframe2 === null || iframe2 === void 0 ? void 0 : iframe2.iFrameResizer) === null || _a2 === void 0 ? void 0 : _a2.resize();
          }
        }, iframe || "");
        (0, exports.sendMessageWhenReady)(iframe, message, origin);
      };
      setTimeout(() => {
        document.documentElement.style.height = "auto";
        document.body.style.height = "auto";
      }, 200);
      return {
        id,
        src,
        onLoad
      };
    };
    exports.createAdfRendererIframeProps = createAdfRendererIframeProps;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/onClose.js
var require_onClose = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/onClose.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.onClose = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var onClose = async (payload) => {
      try {
        const success = await callBridge("onClose", payload);
        if (success === false) {
          throw new errors_1.BridgeAPIError("`onClose` call has failed.");
        }
      } catch (e) {
        throw new errors_1.BridgeAPIError("`onClose` failed because this resource's view is not closable.");
      }
    };
    exports.onClose = onClose;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/getFrameDispatch.js
var require_getFrameDispatch = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/getFrameDispatch.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getFrameDispatch = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getFrameDispatch = async () => {
      return await callBridge("getFrameDispatch");
    };
    exports.getFrameDispatch = getFrameDispatch;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/view.js
var require_view = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/view.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.view = void 0;
    var submit_1 = require_submit();
    var close_1 = require_close();
    var open_1 = require_open();
    var refresh_1 = require_refresh();
    var createHistory_1 = require_createHistory();
    var getContext_1 = require_getContext();
    var changeWindowTitle_1 = require_changeWindowTitle();
    var theme_1 = require_theme();
    var emitReadyEvent_1 = require_emitReadyEvent();
    var adf_renderer_1 = require_adf_renderer();
    var onClose_1 = require_onClose();
    var getFrameDispatch_1 = require_getFrameDispatch();
    exports.view = {
      submit: submit_1.submit,
      close: close_1.close,
      onClose: onClose_1.onClose,
      open: open_1.open,
      refresh: refresh_1.refresh,
      createHistory: createHistory_1.createHistory,
      getContext: getContext_1.getContext,
      getFrameDispatch: getFrameDispatch_1.getFrameDispatch,
      theme: theme_1.theme,
      changeWindowTitle: changeWindowTitle_1.changeWindowTitle,
      emitReadyEvent: emitReadyEvent_1.emitReadyEvent,
      createAdfRendererIframeProps: adf_renderer_1.createAdfRendererIframeProps
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/view/index.js
var require_view2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/view/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_view(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/router/router.js
var require_router = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/router/router.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.router = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getUrl = async (location) => {
      if (!(location === null || location === void 0 ? void 0 : location.target)) {
        throw new Error("target is required for getUrl");
      }
      const url = await callBridge("getUrl", location);
      if (!url) {
        throw new Error("Failed to get URL");
      }
      try {
        return new URL(url);
      } catch (error) {
        throw new Error(`Failed to parse URL: ${url} (${error})`);
      }
    };
    var navigate = (location) => {
      if (typeof location === "string") {
        return callBridge("navigate", { url: location, type: "same-tab" });
      } else {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
          throw new Error("target is required for navigation");
        }
        return callBridge("navigate", { ...location, type: "same-tab" });
      }
    };
    var open = (location) => {
      if (typeof location === "string") {
        return callBridge("navigate", { url: location, type: "new-tab" });
      } else {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
          throw new Error("target is required for navigation");
        }
        return callBridge("navigate", { ...location, type: "new-tab" });
      }
    };
    var reload = async () => callBridge("reload");
    exports.router = {
      getUrl,
      navigate,
      open,
      reload
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/router/index.js
var require_router2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/router/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_router(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/modal/modal.js
var require_modal = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/modal/modal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Modal = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var NAMED_MODAL_SIZES = ["small", "medium", "large", "xlarge", "max", "fullscreen", "resizable"];
    var noop = () => {
    };
    function isNamedModalSize(size) {
      return typeof size === "string" && NAMED_MODAL_SIZES.includes(size);
    }
    function isCustomModalSize(size) {
      if (typeof size !== "object" || size === null)
        return false;
      const s = size;
      return typeof s.width === "string" && (s.height === void 0 || typeof s.height === "string");
    }
    function isValidModalSize(size) {
      return isNamedModalSize(size) || isCustomModalSize(size);
    }
    var Modal = class {
      constructor(opts) {
        var _a, _b;
        this.resource = (opts === null || opts === void 0 ? void 0 : opts.resource) || null;
        this.onClose = (opts === null || opts === void 0 ? void 0 : opts.onClose) || noop;
        this.size = (opts === null || opts === void 0 ? void 0 : opts.size) || "medium";
        this.context = (opts === null || opts === void 0 ? void 0 : opts.context) || {};
        this.closeOnEscape = (_a = opts === null || opts === void 0 ? void 0 : opts.closeOnEscape) !== null && _a !== void 0 ? _a : true;
        this.closeOnOverlayClick = (_b = opts === null || opts === void 0 ? void 0 : opts.closeOnOverlayClick) !== null && _b !== void 0 ? _b : true;
        this.title = (opts === null || opts === void 0 ? void 0 : opts.title) || "";
        this.icon = (opts === null || opts === void 0 ? void 0 : opts.icon) || "";
      }
      async open() {
        if (!isValidModalSize(this.size)) {
          throw new errors_1.BridgeAPIError(`Invalid modal size: ${JSON.stringify(this.size)}. Must be one of the named sizes (${NAMED_MODAL_SIZES.join(", ")}) or a custom dimensions object with a "width" string property and an optional "height" string property.`);
        }
        try {
          const success = await callBridge("openModal", {
            resource: this.resource,
            onClose: this.onClose,
            size: this.size,
            context: this.context,
            closeOnEscape: this.closeOnEscape,
            closeOnOverlayClick: this.closeOnOverlayClick,
            title: this.title,
            icon: this.icon
          });
          if (success === false) {
            throw new errors_1.BridgeAPIError("Unable to open modal.");
          }
        } catch (err) {
          throw new errors_1.BridgeAPIError("Unable to open modal.");
        }
      }
    };
    exports.Modal = Modal;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/modal/index.js
var require_modal2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/modal/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_modal(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/fetch/fetch.js
var require_fetch = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/fetch/fetch.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.productFetchApi = exports.remoteFetchApi = void 0;
    var blobParser_1 = require_blobParser();
    var parseFormData = async (form, matchFilePrefix = false) => {
      const parsed = {};
      for (const [key, value] of form.entries()) {
        const isFileKey = matchFilePrefix ? key.startsWith("file") : key === "file";
        if (isFileKey) {
          const fileName = value.name;
          const fileType = value.type;
          parsed[key] = await (0, blobParser_1.blobToBase64)(value);
          parsed[`__${key}Name`] = fileName;
          parsed[`__${key}Type`] = fileType;
        } else {
          parsed[key] = value;
        }
      }
      return JSON.stringify(parsed);
    };
    var validateFetchOptions = (init) => {
      if (!init) {
        return init;
      }
      if ("signal" in init) {
        const { signal: _signal, ...rest } = init;
        console.error("Signal is not supported in @forge/bridge and was removed from fetch options. Please use the fetch method from @forge/api for signal support.");
        return rest;
      }
      return init;
    };
    var parseRequest = async (fetchType, init) => {
      const isFormData = (init === null || init === void 0 ? void 0 : init.body) instanceof FormData ? true : false;
      const requestBody = isFormData ? await parseFormData(init === null || init === void 0 ? void 0 : init.body, fetchType === "remote") : init === null || init === void 0 ? void 0 : init.body;
      const req = new Request("", { body: requestBody, method: init === null || init === void 0 ? void 0 : init.method, headers: init === null || init === void 0 ? void 0 : init.headers });
      const headers = Object.fromEntries(req.headers.entries());
      const body = req.method !== "GET" ? await req.text() : null;
      return {
        body,
        headers: new Headers(headers),
        isMultipartFormData: isFormData
      };
    };
    var remoteFetchApi = (callBridge) => {
      const fetch2 = async (remoteKey, init) => {
        const validatedInit = validateFetchOptions(init);
        const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest("remote", validatedInit);
        const fetchPayload = {
          remoteKey,
          fetchRequestInit: { ...validatedInit, body: requestBody, headers: [...requestHeaders.entries()] },
          isMultipartFormData
        };
        const { body, headers, statusText, status, isAttachment } = await callBridge("fetchRemote", fetchPayload);
        const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
        return new Response(responseBody || null, { headers, status, statusText });
      };
      return {
        requestRemote: (remoteKey, fetchOptions) => fetch2(remoteKey, fetchOptions)
      };
    };
    exports.remoteFetchApi = remoteFetchApi;
    var productFetchApi = (callBridge) => {
      const fetch2 = async (product, restPath, init) => {
        const validatedInit = validateFetchOptions(init);
        const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest("product", validatedInit);
        if (!requestHeaders.has("X-Atlassian-Token")) {
          requestHeaders.set("X-Atlassian-Token", "no-check");
        }
        const fetchPayload = {
          product,
          restPath,
          fetchRequestInit: {
            ...validatedInit,
            body: requestBody,
            headers: [...requestHeaders.entries()]
          },
          isMultipartFormData
        };
        const { body, headers, statusText, status, isAttachment } = await callBridge("fetchProduct", fetchPayload);
        const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
        return new Response(responseBody || null, { headers, status, statusText });
      };
      return {
        requestConfluence: (restPath, fetchOptions) => fetch2("confluence", restPath, fetchOptions),
        requestJira: (restPath, fetchOptions) => fetch2("jira", restPath, fetchOptions),
        requestBitbucket: (restPath, fetchOptions) => fetch2("bitbucket", restPath, fetchOptions)
      };
    };
    exports.productFetchApi = productFetchApi;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/fetch/index.js
var require_fetch2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/fetch/index.js"(exports) {
    "use strict";
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.requestRemote = exports.requestBitbucket = exports.requestJira = exports.requestConfluence = void 0;
    var bridge_1 = require_bridge();
    var fetch_1 = require_fetch();
    _a = (0, fetch_1.productFetchApi)((0, bridge_1.getCallBridge)()), exports.requestConfluence = _a.requestConfluence, exports.requestJira = _a.requestJira, exports.requestBitbucket = _a.requestBitbucket;
    exports.requestRemote = (0, fetch_1.remoteFetchApi)((0, bridge_1.getCallBridge)()).requestRemote;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/requestTeamworkGraph/index.js
var require_requestTeamworkGraph = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/requestTeamworkGraph/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.requestTeamworkGraph = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var requestTeamworkGraph = async (query, variables) => {
      const response = await callBridge("requestTeamworkGraph", { query, variables });
      return response;
    };
    exports.requestTeamworkGraph = requestTeamworkGraph;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/flag/flag.js
var require_flag = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/flag/flag.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.showFlag = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var showFlag = (options) => {
      var _a;
      if (!options.id) {
        throw new errors_1.BridgeAPIError('"id" must be defined in flag options');
      }
      const result = callBridge("showFlag", {
        ...options,
        type: (_a = options.type) !== null && _a !== void 0 ? _a : "info"
      });
      return {
        close: async () => {
          await result;
          return callBridge("closeFlag", { id: options.id });
        }
      };
    };
    exports.showFlag = showFlag;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/flag/index.js
var require_flag2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/flag/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.showFlag = void 0;
    var flag_1 = require_flag();
    Object.defineProperty(exports, "showFlag", { enumerable: true, get: function() {
      return flag_1.showFlag;
    } });
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/events/index.js
var require_events2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/events/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_events(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/realtime/realtime.js
var require_realtime = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/realtime/realtime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.realtime = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var publish = (channel, payload, options) => {
      return callBridge("publishRealtimeChannel", { channelName: channel, eventPayload: payload, options });
    };
    var subscribe = (channel, callback, options) => {
      return callBridge("subscribeRealtimeChannel", {
        channelName: channel,
        onEvent: callback,
        options
      });
    };
    var publishGlobal = (channel, payload, options) => {
      return callBridge("publishRealtimeChannel", { channelName: channel, eventPayload: payload, options, isGlobal: true });
    };
    var subscribeGlobal = (channel, callback, options) => {
      return callBridge("subscribeRealtimeChannel", {
        channelName: channel,
        onEvent: callback,
        options,
        isGlobal: true
      });
    };
    exports.realtime = {
      publish,
      subscribe,
      publishGlobal,
      subscribeGlobal
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/realtime/productContext.js
var require_productContext = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/realtime/productContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bitbucket = exports.Confluence = exports.Jira = void 0;
    var Jira;
    (function(Jira2) {
      Jira2["Board"] = "board";
      Jira2["Issue"] = "issue";
      Jira2["Project"] = "project";
    })(Jira || (exports.Jira = Jira = {}));
    var Confluence;
    (function(Confluence2) {
      Confluence2["Content"] = "content";
      Confluence2["Space"] = "space";
    })(Confluence || (exports.Confluence = Confluence = {}));
    var Bitbucket;
    (function(Bitbucket2) {
      Bitbucket2["Repository"] = "repository";
      Bitbucket2["PullRequest"] = "pullRequest";
    })(Bitbucket || (exports.Bitbucket = Bitbucket = {}));
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/realtime/index.js
var require_realtime2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/realtime/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bitbucket = exports.Confluence = exports.Jira = exports.realtime = void 0;
    var realtime_1 = require_realtime();
    Object.defineProperty(exports, "realtime", { enumerable: true, get: function() {
      return realtime_1.realtime;
    } });
    var productContext_1 = require_productContext();
    Object.defineProperty(exports, "Jira", { enumerable: true, get: function() {
      return productContext_1.Jira;
    } });
    Object.defineProperty(exports, "Confluence", { enumerable: true, get: function() {
      return productContext_1.Confluence;
    } });
    Object.defineProperty(exports, "Bitbucket", { enumerable: true, get: function() {
      return productContext_1.Bitbucket;
    } });
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/open.js
var require_open2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/open.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.open = exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var MAX_AGENT_LENGTH = 30;
    var callBridge = (0, bridge_1.getCallBridge)();
    exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE = "Unable to open Rovo Chat due to usage in an unsupported product. Only Confluence, Jira and some Jira Service Management modules are supported at this point. See https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/";
    var transformRovoPayload = (openRovoPayload) => {
      switch (openRovoPayload.type) {
        case "forge":
          return {
            agentName: openRovoPayload.agentName,
            agentKey: openRovoPayload.agentKey,
            prompt: openRovoPayload.prompt
          };
        case "atlassian":
          return {
            agentName: openRovoPayload.agentName,
            prompt: openRovoPayload.prompt
          };
        default:
          return { prompt: openRovoPayload.prompt };
      }
    };
    var open = async (openRovoPayload) => {
      if (openRovoPayload.type === "forge") {
        if (openRovoPayload.agentName.length > MAX_AGENT_LENGTH) {
          throw new Error("rovo agent name too long");
        }
        if (openRovoPayload.agentKey.length > MAX_AGENT_LENGTH) {
          throw new Error("rovo agent key too long");
        }
      }
      const rovoArgs = transformRovoPayload(openRovoPayload);
      const success = await callBridge("openRovo", rovoArgs);
      if (success === false) {
        throw new errors_1.BridgeAPIError(exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE);
      }
    };
    exports.open = open;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/isEnabled.js
var require_isEnabled = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/isEnabled.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isEnabled = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var isEnabled = () => {
      return callBridge("isRovoEnabled");
    };
    exports.isEnabled = isEnabled;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/rovo.js
var require_rovo = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/rovo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.rovo = void 0;
    var open_1 = require_open2();
    var isEnabled_1 = require_isEnabled();
    exports.rovo = {
      open: open_1.open,
      isEnabled: isEnabled_1.isEnabled
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/index.js
var require_rovo2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/rovo/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_rovo(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/i18n/index.js
var require_i18n = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/i18n/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createTranslationFunction = exports.getTranslations = exports.resetTranslationsCache = void 0;
    var i18n_1 = require_out();
    var view_1 = require_view2();
    var frontendResourcesAccessor = {
      getI18nInfoConfig: async () => {
        const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${i18n_1.I18N_INFO_FILE_NAME}`);
        if (!resp.ok) {
          throw new Error("Failed to get i18n info config: " + resp.statusText);
        }
        const info = await resp.json();
        return info.config;
      },
      getTranslationResource: async (locale) => {
        const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${locale}.json`);
        if (!resp.ok) {
          throw new Error(`Failed to get translation resource for locale: ${locale}`);
        }
        return resp.json();
      }
    };
    var translationsGetter = new i18n_1.TranslationsGetter(frontendResourcesAccessor);
    var resetTranslationsCache = () => {
      translationsGetter.reset();
    };
    exports.resetTranslationsCache = resetTranslationsCache;
    var getTranslations = async (locale = null, options = {
      fallback: true
    }) => {
      let targetLocale = locale;
      if (!targetLocale) {
        const context = await view_1.view.getContext();
        targetLocale = context.locale;
      }
      return await translationsGetter.getTranslations(targetLocale, options);
    };
    exports.getTranslations = getTranslations;
    var createTranslationFunction = async (locale = null) => {
      let targetLocale = locale;
      if (!targetLocale) {
        const context = await view_1.view.getContext();
        targetLocale = context.locale;
      }
      const translator = new i18n_1.Translator(targetLocale, translationsGetter);
      await translator.init();
      return (i18nKey, defaultValue) => {
        var _a, _b;
        return (_b = (_a = translator.translate(i18nKey)) !== null && _a !== void 0 ? _a : defaultValue) !== null && _b !== void 0 ? _b : i18nKey;
      };
    };
    exports.createTranslationFunction = createTranslationFunction;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/permissions/permissions.js
var require_permissions = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/permissions/permissions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.permissions = void 0;
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var egressGet = async (payload) => {
      return callBridge("__permission__egressGet", payload);
    };
    var egressSet = async (payload) => {
      return callBridge("__permission__egressSet", payload);
    };
    var egressDeleteDomain = async (payload) => {
      return callBridge("__permission__egressDeleteDomain", payload);
    };
    var egressDeleteGroup = async (payload) => {
      return callBridge("__permission__egressDeleteGroup", payload);
    };
    var remoteGet = async (payload) => {
      return callBridge("__permission__remoteGet", payload);
    };
    var remoteSet = async (payload) => {
      return callBridge("__permission__remoteSet", payload);
    };
    exports.permissions = {
      egress: {
        get: egressGet,
        set: egressSet,
        deleteDomain: egressDeleteDomain,
        deleteGroup: egressDeleteGroup
      },
      remote: {
        get: remoteGet,
        set: remoteSet
      }
    };
  }
});

// node_modules/@forge/egress/out/egress/url-parser.js
var require_url_parser = __commonJS({
  "node_modules/@forge/egress/out/egress/url-parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseUrl = parseUrl;
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
var require_utils2 = __commonJS({
  "node_modules/@forge/egress/out/egress/utils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getEgressesBasedOnToggles = exports.sortAndGroupEgressPermissionsByDomain = exports.EgressCategory = exports.EgressType = void 0;
    exports.globToRegex = globToRegex;
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
    exports.sortAndGroupEgressPermissionsByDomain = sortAndGroupEgressPermissionsByDomain;
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
    })(EgressType || (exports.EgressType = EgressType = {}));
    var EgressCategory;
    (function(EgressCategory2) {
      EgressCategory2["ANALYTICS"] = "ANALYTICS";
    })(EgressCategory || (exports.EgressCategory = EgressCategory = {}));
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
    exports.getEgressesBasedOnToggles = getEgressesBasedOnToggles;
  }
});

// node_modules/@forge/egress/out/egress/egress-filtering-service.js
var require_egress_filtering_service = __commonJS({
  "node_modules/@forge/egress/out/egress/egress-filtering-service.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EgressFilteringService = void 0;
    var url_parser_1 = require_url_parser();
    var utils_1 = require_utils2();
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
    exports.EgressFilteringService = EgressFilteringService;
  }
});

// node_modules/@forge/egress/out/egress/index.js
var require_egress = __commonJS({
  "node_modules/@forge/egress/out/egress/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_egress_filtering_service(), exports);
    tslib_1.__exportStar(require_url_parser(), exports);
    tslib_1.__exportStar(require_utils2(), exports);
  }
});

// node_modules/@forge/egress/out/index.js
var require_out2 = __commonJS({
  "node_modules/@forge/egress/out/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_egress(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/permissions/permissionsUtil.js
var require_permissionsUtil = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/permissions/permissionsUtil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createPermissionUtils = createPermissionUtils;
    exports.checkPermissions = checkPermissions;
    var egress_1 = require_out2();
    var view_1 = require_view2();
    function extractUrlString(url) {
      if (typeof url === "string") {
        return url;
      }
      if ("address" in url && url.address) {
        return url.address;
      }
      return url.remote || "";
    }
    var RESOURCE_TYPES = ["fonts", "styles", "frames", "images", "media", "scripts"];
    var FETCH_TYPES = ["backend", "client"];
    function createPermissionUtils(runtimePermissions) {
      if (!runtimePermissions) {
        return null;
      }
      const { scopes, external = {} } = runtimePermissions;
      const scopeArray = Array.isArray(scopes) ? scopes : Object.keys(scopes || {});
      return {
        hasScope: (scope) => scopeArray.includes(scope),
        canFetchFrom: (type, url) => {
          var _a;
          const fetchUrls = (_a = external.fetch) === null || _a === void 0 ? void 0 : _a[type];
          if (!(fetchUrls === null || fetchUrls === void 0 ? void 0 : fetchUrls.length))
            return false;
          const allowList = fetchUrls.map(extractUrlString).filter((u) => u.length > 0);
          if (allowList.length === 0)
            return false;
          const egressFilter = new egress_1.EgressFilteringService(allowList);
          const egressFilterWithCSP = egressFilter;
          return type === "client" ? egressFilterWithCSP.isValidUrlCSP(url) : egressFilter.isValidUrl(url);
        },
        canLoadResource: (type, url) => {
          const resourceUrls = external[type];
          if (!(resourceUrls === null || resourceUrls === void 0 ? void 0 : resourceUrls.length))
            return false;
          const allowList = resourceUrls.map(extractUrlString).filter((u) => u.length > 0);
          if (allowList.length === 0)
            return false;
          const egressFilter = new egress_1.EgressFilteringService(allowList);
          const egressFilterWithCSP = egressFilter;
          return egressFilterWithCSP.isValidUrlCSP(url);
        },
        getScopes: () => scopeArray,
        getExternalPermissions: () => external,
        hasAnyPermissions: () => scopeArray.length > 0 || Object.keys(external).length > 0
      };
    }
    function checkScopes(requiredScopes, permissionUtils) {
      if (!(requiredScopes === null || requiredScopes === void 0 ? void 0 : requiredScopes.length)) {
        return void 0;
      }
      const missingScopes = requiredScopes.filter((scope) => !permissionUtils.hasScope(scope));
      return missingScopes.length > 0 ? missingScopes : void 0;
    }
    function checkFetchPermissions(requiredFetch, permissionUtils) {
      if (!(requiredFetch === null || requiredFetch === void 0 ? void 0 : requiredFetch.fetch)) {
        return void 0;
      }
      const missingFetch = {};
      FETCH_TYPES.forEach((type) => {
        var _a;
        const requiredUrls = (_a = requiredFetch.fetch) === null || _a === void 0 ? void 0 : _a[type];
        if (requiredUrls === null || requiredUrls === void 0 ? void 0 : requiredUrls.length) {
          const missingUrls = requiredUrls.filter((url) => !permissionUtils.canFetchFrom(type, url));
          if (missingUrls.length > 0) {
            missingFetch[type] = missingUrls;
          }
        }
      });
      return Object.keys(missingFetch).length > 0 ? missingFetch : void 0;
    }
    function checkResourcePermissions(requiredExternal, permissionUtils) {
      const missingResources = {};
      RESOURCE_TYPES.forEach((type) => {
        const requiredUrls = requiredExternal === null || requiredExternal === void 0 ? void 0 : requiredExternal[type];
        if (requiredUrls === null || requiredUrls === void 0 ? void 0 : requiredUrls.length) {
          const missingUrls = requiredUrls.filter((url) => !permissionUtils.canLoadResource(type, url));
          if (missingUrls.length > 0) {
            missingResources[type] = missingUrls;
          }
        }
      });
      return Object.keys(missingResources).length > 0 ? missingResources : void 0;
    }
    function checkExternalPermissions(requiredExternal, permissionUtils) {
      if (!requiredExternal) {
        return void 0;
      }
      const missingFetch = checkFetchPermissions(requiredExternal, permissionUtils);
      const missingResources = checkResourcePermissions(requiredExternal, permissionUtils);
      if (!missingFetch && !missingResources) {
        return void 0;
      }
      const missingExternal = {};
      if (missingFetch) {
        missingExternal.fetch = missingFetch;
      }
      if (missingResources) {
        Object.assign(missingExternal, missingResources);
      }
      return missingExternal;
    }
    function validateObjectField(value, fieldPath) {
      if (value !== void 0) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError(`${fieldPath} should be an object, not ${Array.isArray(value) ? "an array" : `a ${typeof value}`}`);
        }
      }
    }
    function validateArrayField(value, fieldPath) {
      if (value !== void 0 && !Array.isArray(value)) {
        throw new TypeError(`${fieldPath} should be an array, not a ${typeof value}`);
      }
    }
    function validatePermissionShape(requiredPermissions) {
      validateArrayField(requiredPermissions.scopes, "scopes");
      const external = requiredPermissions.external;
      if (external === void 0)
        return;
      validateObjectField(external, "external");
      if (external.fetch !== void 0) {
        validateObjectField(external.fetch, "external.fetch");
        for (const type of FETCH_TYPES) {
          validateArrayField(external.fetch[type], `external.fetch.${type}`);
        }
      }
      for (const type of RESOURCE_TYPES) {
        validateArrayField(external[type], `external.${type}`);
      }
    }
    async function checkPermissions(requiredPermissions, runtimePermissions) {
      var _a;
      if (!requiredPermissions) {
        return { granted: false, missing: null };
      }
      validatePermissionShape(requiredPermissions);
      if (!((_a = requiredPermissions.scopes) === null || _a === void 0 ? void 0 : _a.length) && !requiredPermissions.external) {
        return { granted: true, missing: null };
      }
      let permissionsToCheck = runtimePermissions;
      if (!permissionsToCheck) {
        const context = await view_1.view.getContext();
        permissionsToCheck = context.permissions;
      }
      const permissionUtils = createPermissionUtils(permissionsToCheck);
      if (!permissionUtils) {
        return { granted: false, missing: null };
      }
      const missing = {};
      let hasAllRequiredPermissions = true;
      const missingScopes = checkScopes(requiredPermissions.scopes, permissionUtils);
      if (missingScopes) {
        missing.scopes = missingScopes;
        hasAllRequiredPermissions = false;
      }
      const missingExternal = checkExternalPermissions(requiredPermissions.external, permissionUtils);
      if (missingExternal) {
        missing.external = missingExternal;
        hasAllRequiredPermissions = false;
      }
      return {
        granted: hasAllRequiredPermissions,
        missing: hasAllRequiredPermissions ? null : missing
      };
    }
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/permissions/index.js
var require_permissions2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/permissions/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_permissions(), exports);
    tslib_1.__exportStar(require_permissionsUtil(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/upload.js
var require_upload = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/upload.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.upload = exports.createUploadPromises = void 0;
    var invoke_1 = require_invoke2();
    var errors_1 = require_errors();
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var base64ToBlob = (base64, mimeType) => {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType || "application/octet-stream" });
    };
    var getObjectMetadata = async (blob) => {
      const length = blob.size;
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      const checksum = btoa(String.fromCharCode(...hashArray));
      const checksumType = "SHA256";
      return {
        length,
        checksum,
        checksumType
      };
    };
    var createUploadPromises = async ({ functionKey, objects }) => {
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to filter and generate presigned URLs");
      }
      if (!Array.isArray(objects) || objects.length === 0) {
        throw new errors_1.BridgeAPIError("objects array is required and must not be empty");
      }
      const blobs = objects.map((obj, index) => {
        if (obj instanceof Blob) {
          return obj;
        }
        const isBase64Object = obj && typeof obj === "object" && "data" in obj && typeof obj.data === "string";
        if (!isBase64Object) {
          throw new errors_1.BridgeAPIError(`Invalid object type at index ${index}. Only Blob or Base64Object (with data string and optional mimeType) are accepted.`);
        }
        try {
          return base64ToBlob(obj.data, obj.mimeType);
        } catch (e) {
          throw new errors_1.BridgeAPIError(`Invalid base64 data at index ${index}. The data string must be valid base64 encoded.`);
        }
      });
      const allObjectMetadata = await Promise.all(blobs.map((blob) => getObjectMetadata(blob)));
      const presignedURLsToObjectMetadata = await (0, invoke_1.invoke)(functionKey, {
        allObjectMetadata
      });
      if (!presignedURLsToObjectMetadata || typeof presignedURLsToObjectMetadata !== "object") {
        throw new errors_1.BridgeAPIError("Invalid response from functionKey");
      }
      const checksumToBlobMap = /* @__PURE__ */ new Map();
      const checksumToIndexMap = /* @__PURE__ */ new Map();
      blobs.forEach((blob, index) => {
        const metadata = allObjectMetadata[index];
        checksumToBlobMap.set(metadata.checksum, blob);
        checksumToIndexMap.set(metadata.checksum, index);
      });
      const uploadPromises = Object.entries(presignedURLsToObjectMetadata).map(([presignedUrl, metadata]) => {
        const { key, checksum } = metadata;
        const object = checksumToBlobMap.get(checksum);
        const index = checksumToIndexMap.get(checksum);
        if (index === void 0) {
          return {
            promise: Promise.resolve({
              success: false,
              key,
              error: `Index not found for checksum ${checksum}`
            }),
            index: -1
          };
        }
        if (!object) {
          return {
            promise: Promise.resolve({
              success: false,
              key,
              error: `Blob not found for checksum ${checksum}`
            }),
            index
          };
        }
        const uploadPromise = (async () => {
          try {
            const response = await fetch(presignedUrl, {
              method: "PUT",
              body: object,
              headers: {
                "Content-Type": object.type || "application/octet-stream",
                "Content-Length": object.size.toString()
              }
            });
            return {
              success: response.ok,
              key,
              status: response.status,
              error: response.ok ? void 0 : `Upload failed with status ${response.status}`
            };
          } catch (error) {
            return {
              success: false,
              key,
              status: 503,
              error: error instanceof Error ? error.message : "Upload failed"
            };
          }
        })();
        return { promise: uploadPromise, index, objectType: object.type, objectSize: object.size };
      });
      return uploadPromises;
    };
    exports.createUploadPromises = createUploadPromises;
    var upload = async ({ functionKey, objects }) => {
      void callBridge("trackObjectStoreAction", { action: "upload" });
      const uploadPromises = await (0, exports.createUploadPromises)({ functionKey, objects });
      const results = await Promise.all(uploadPromises.map((item) => item.promise));
      return results;
    };
    exports.upload = upload;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/deleteObjects.js
var require_deleteObjects = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/deleteObjects.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.deleteObjects = void 0;
    var invoke_1 = require_invoke2();
    var errors_1 = require_errors();
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var deleteObjects = async ({ functionKey, keys }) => {
      void callBridge("trackObjectStoreAction", { action: "delete" });
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to delete objects");
      }
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
      }
      await Promise.all(keys.map(async (key) => {
        await (0, invoke_1.invoke)(functionKey, { key });
      }));
    };
    exports.deleteObjects = deleteObjects;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/download.js
var require_download = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/download.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.download = void 0;
    var invoke_1 = require_invoke2();
    var errors_1 = require_errors();
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var download = async ({ functionKey, keys }) => {
      void callBridge("trackObjectStoreAction", { action: "download" });
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to filter and generate download URLs");
      }
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
      }
      const downloadUrlsTokeys = await (0, invoke_1.invoke)(functionKey, {
        keys
      });
      if (!downloadUrlsTokeys || typeof downloadUrlsTokeys !== "object") {
        throw new errors_1.BridgeAPIError("Invalid response from functionKey");
      }
      const downloadPromises = Object.entries(downloadUrlsTokeys).map(async ([downloadUrl, key]) => {
        try {
          const response = await fetch(downloadUrl, {
            method: "GET"
          });
          if (!response.ok) {
            return {
              success: false,
              key,
              status: response.status,
              error: `Download failed with status ${response.status}`
            };
          }
          const blob = await response.blob();
          return {
            success: true,
            key,
            blob,
            status: response.status
          };
        } catch (error) {
          return {
            success: false,
            key,
            status: 503,
            error: error instanceof Error ? error.message : "Download failed"
          };
        }
      });
      const results = await Promise.all(downloadPromises);
      return results;
    };
    exports.download = download;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/getMetadata.js
var require_getMetadata = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/getMetadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getMetadata = void 0;
    var index_1 = require_invoke2();
    var errors_1 = require_errors();
    var bridge_1 = require_bridge();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getMetadata = async ({ functionKey, keys }) => {
      void callBridge("trackObjectStoreAction", { action: "getMetadata" });
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to filter and generate object metadata");
      }
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
      }
      const results = await Promise.all(keys.map(async (key) => {
        const result = await (0, index_1.invoke)(functionKey, { key });
        if (!result || typeof result !== "object") {
          return {
            key,
            error: "Invalid response from functionKey"
          };
        }
        return result;
      }));
      return results;
    };
    exports.getMetadata = getMetadata;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/objectStore.js
var require_objectStore = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/objectStore.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createUploadPromises = exports.objectStore = void 0;
    var upload_1 = require_upload();
    Object.defineProperty(exports, "createUploadPromises", { enumerable: true, get: function() {
      return upload_1.createUploadPromises;
    } });
    var deleteObjects_1 = require_deleteObjects();
    var download_1 = require_download();
    var getMetadata_1 = require_getMetadata();
    exports.objectStore = {
      upload: upload_1.upload,
      download: download_1.download,
      getMetadata: getMetadata_1.getMetadata,
      delete: deleteObjects_1.deleteObjects
    };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/types.js
var require_types2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/index.js
var require_object_store = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/object-store/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_objectStore(), exports);
    tslib_1.__exportStar(require_types2(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/evaluator.js
var require_evaluator = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/evaluator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Evaluator = void 0;
    var Evaluator = class {
      constructor(results) {
        this.results = results;
      }
      checkFlag(flagName, defaultValue) {
        if (!this.results || !this.results.feature_flags) {
          return defaultValue;
        }
        const featureFlags = this.results.feature_flags;
        let hashedValue = "";
        try {
          hashedValue = this.getHashedValue(flagName);
        } catch (err) {
          console.error("Unexpected error occurred while evaluating flag ", err);
          return defaultValue;
        }
        if (!hashedValue) {
          return defaultValue;
        }
        const evaluatedFlag = featureFlags[hashedValue];
        if (evaluatedFlag) {
          if (evaluatedFlag.disabled) {
            return false;
          }
          return evaluatedFlag.value;
        }
        return defaultValue;
      }
      shutDown() {
        this.results = void 0;
      }
      // To be Updated with proper hashing function
      getHashedValue(flagName) {
        if (typeof flagName !== "string") {
          return "";
        }
        const input = flagName.trim();
        if (input.length === 0) {
          return "";
        }
        let hash = 5381;
        for (let i = 0; i < input.length; i += 1) {
          const charCode = input.charCodeAt(i);
          hash = (hash << 5) + hash + charCode;
          hash |= 0;
        }
        return (hash >>> 0).toString();
      }
    };
    exports.Evaluator = Evaluator;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js
var require_initFeatureFlags = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.initFeatureFlags = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var utils_1 = require_utils();
    var maxOps = 500;
    var intervalInMs = 1e3 * 25;
    var callBridge = (0, bridge_1.getCallBridge)();
    var validatePayload = (payload) => {
      if (!payload || !payload.user || !payload.config) {
        throw new errors_1.BridgeAPIError("Missing required parameters. Parameter user is required in the payload.");
      }
      if (!payload.config.environment || !["development", "staging", "production"].includes(payload.config.environment)) {
        throw new errors_1.BridgeAPIError("Invalid environment. Valid environments are: development, staging, production");
      }
      if (Object.values(payload).some((val) => typeof val === "function")) {
        throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
      }
    };
    var _initFeatureFlags = (payload) => {
      validatePayload(payload);
      return callBridge("initFeatureFlags", { user: payload.user, config: payload.config });
    };
    exports.initFeatureFlags = (0, utils_1.withRateLimiter)(_initFeatureFlags, maxOps, intervalInMs, `Feature flags initialisation calls are rate limited at ${maxOps}req/${intervalInMs / 1e3}s`);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/featureFlags.js
var require_featureFlags = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/featureFlags.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FeatureFlags = void 0;
    var evaluator_1 = require_evaluator();
    var initFeatureFlags_1 = require_initFeatureFlags();
    var FeatureFlags = class {
      constructor() {
        this.initialized = false;
      }
      /**
       * Initialize the feature flags client
       */
      async initialize(user, config = { environment: "development" }) {
        if (this.isInitialized()) {
          return;
        }
        if (!(config === null || config === void 0 ? void 0 : config.environment)) {
          config.environment = "development";
        }
        const result = await (0, initFeatureFlags_1.initFeatureFlags)({ user, config });
        this.initialized = true;
        this.evaluator = new evaluator_1.Evaluator(result);
      }
      /**
       * Check if a feature flag is enabled for the user
       */
      checkFlag(flagName, defaultValue = false) {
        if (!this.isInitialized() || !this.evaluator) {
          throw new Error("FeatureFlags not initialized. Call initialize() first.");
        }
        return this.evaluator.checkFlag(flagName, defaultValue);
      }
      /**
       * Shutdown the feature flags client
       */
      shutdown() {
        if (!this.isInitialized()) {
          return;
        }
        this.initialized = false;
        this.evaluator.shutDown();
      }
      isInitialized() {
        return this.initialized;
      }
    };
    exports.FeatureFlags = FeatureFlags;
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/index.js
var require_featureFlags2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/featureFlags/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FeatureFlags = void 0;
    var featureFlags_1 = require_featureFlags();
    Object.defineProperty(exports, "FeatureFlags", { enumerable: true, get: function() {
      return featureFlags_1.FeatureFlags;
    } });
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js
var require_frontendCustomMetrics = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.frontendCustomMetrics = void 0;
    var bridge_1 = require_bridge();
    var errors_1 = require_errors();
    var callBridge = (0, bridge_1.getCallBridge)();
    var emit = async (customMetricName, value) => {
      await callBridge("emitFrontendCustomMetric", {
        customMetricName,
        value
      });
    };
    var MAX_METRIC_NAME_LENGTH = 50;
    var METRIC_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
    var validateMetricName = (name) => {
      if (name.trim().length === 0) {
        throw new errors_1.BridgeAPIError("Custom metric name cannot be empty");
      }
      if (name.length > MAX_METRIC_NAME_LENGTH) {
        throw new errors_1.BridgeAPIError(`Custom metric name cannot exceed ${MAX_METRIC_NAME_LENGTH} characters`);
      }
      if (!METRIC_NAME_REGEX.test(name)) {
        throw new errors_1.BridgeAPIError("Custom metric name must start and end with alphanumeric characters and can only contain letters, numbers, dots (.), and hyphens (-)");
      }
      if (name.includes("..") || name.includes("--")) {
        throw new errors_1.BridgeAPIError("Custom metric name cannot contain consecutive dots or hyphens");
      }
    };
    var counter = (name) => {
      validateMetricName(name);
      return {
        incr: () => emit(name, 1),
        incrBy: (value) => {
          if (value <= 0) {
            throw new errors_1.BridgeAPIError("Counter value must be a positive number");
          }
          return emit(name, value);
        }
      };
    };
    exports.frontendCustomMetrics = { counter };
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/frontendCustomMetrics/index.js
var require_frontendCustomMetrics2 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/frontendCustomMetrics/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_frontendCustomMetrics(), exports);
  }
});

// node_modules/@forge/react/node_modules/@forge/bridge/out/index.js
var require_out3 = __commonJS({
  "node_modules/@forge/react/node_modules/@forge/bridge/out/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.i18n = exports.NavigationTarget = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var targets_1 = require_targets();
    Object.defineProperty(exports, "NavigationTarget", { enumerable: true, get: function() {
      return targets_1.NavigationTarget;
    } });
    tslib_1.__exportStar(require_invoke2(), exports);
    tslib_1.__exportStar(require_invoke_endpoint2(), exports);
    tslib_1.__exportStar(require_view2(), exports);
    tslib_1.__exportStar(require_router2(), exports);
    tslib_1.__exportStar(require_modal2(), exports);
    tslib_1.__exportStar(require_fetch2(), exports);
    tslib_1.__exportStar(require_requestTeamworkGraph(), exports);
    tslib_1.__exportStar(require_flag2(), exports);
    tslib_1.__exportStar(require_events2(), exports);
    tslib_1.__exportStar(require_realtime2(), exports);
    tslib_1.__exportStar(require_rovo2(), exports);
    exports.i18n = tslib_1.__importStar(require_i18n());
    tslib_1.__exportStar(require_permissions2(), exports);
    tslib_1.__exportStar(require_object_store(), exports);
    tslib_1.__exportStar(require_featureFlags2(), exports);
    tslib_1.__exportStar(require_frontendCustomMetrics2(), exports);
  }
});

// node_modules/@forge/react/out/hooks/useProductContext.js
var require_useProductContext = __commonJS({
  "node_modules/@forge/react/out/hooks/useProductContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useProductContext = void 0;
    var bridge_1 = require_out3();
    var react_1 = require_react();
    var useProductContext = () => {
      const [productContext, setProductContext] = (0, react_1.useState)();
      (0, react_1.useEffect)(() => {
        bridge_1.view.getContext().then(setProductContext).catch((err) => {
          throw err;
        });
      }, []);
      return productContext;
    };
    exports.useProductContext = useProductContext;
  }
});

// node_modules/@forge/react/out/hooks/useConfig.js
var require_useConfig = __commonJS({
  "node_modules/@forge/react/out/hooks/useConfig.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useConfig = void 0;
    var react_1 = require_react();
    var bridge_1 = require_out3();
    var updateConfig = (setConfig) => {
      bridge_1.view.getContext().then((context) => {
        setConfig(context?.extension.config);
      }).catch((err) => {
        throw err;
      });
    };
    var useConfig = () => {
      const [config, setConfig] = (0, react_1.useState)(void 0);
      (0, react_1.useEffect)(() => {
        updateConfig(setConfig);
      }, []);
      (0, react_1.useEffect)(() => {
        const sub = bridge_1.events.on("FORGE_CORE_MACRO_CONFIG_CHANGED", () => {
          updateConfig(setConfig);
        });
        return () => {
          void sub.then((subscription) => subscription.unsubscribe());
        };
      }, []);
      return config;
    };
    exports.useConfig = useConfig;
  }
});

// node_modules/lodash/_stackClear.js
var require_stackClear = __commonJS({
  "node_modules/lodash/_stackClear.js"(exports, module) {
    var ListCache = require_ListCache();
    function stackClear() {
      this.__data__ = new ListCache();
      this.size = 0;
    }
    module.exports = stackClear;
  }
});

// node_modules/lodash/_stackDelete.js
var require_stackDelete = __commonJS({
  "node_modules/lodash/_stackDelete.js"(exports, module) {
    function stackDelete(key) {
      var data = this.__data__, result = data["delete"](key);
      this.size = data.size;
      return result;
    }
    module.exports = stackDelete;
  }
});

// node_modules/lodash/_stackGet.js
var require_stackGet = __commonJS({
  "node_modules/lodash/_stackGet.js"(exports, module) {
    function stackGet(key) {
      return this.__data__.get(key);
    }
    module.exports = stackGet;
  }
});

// node_modules/lodash/_stackHas.js
var require_stackHas = __commonJS({
  "node_modules/lodash/_stackHas.js"(exports, module) {
    function stackHas(key) {
      return this.__data__.has(key);
    }
    module.exports = stackHas;
  }
});

// node_modules/lodash/_stackSet.js
var require_stackSet = __commonJS({
  "node_modules/lodash/_stackSet.js"(exports, module) {
    var ListCache = require_ListCache();
    var Map2 = require_Map();
    var MapCache = require_MapCache();
    var LARGE_ARRAY_SIZE = 200;
    function stackSet(key, value) {
      var data = this.__data__;
      if (data instanceof ListCache) {
        var pairs = data.__data__;
        if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
          pairs.push([key, value]);
          this.size = ++data.size;
          return this;
        }
        data = this.__data__ = new MapCache(pairs);
      }
      data.set(key, value);
      this.size = data.size;
      return this;
    }
    module.exports = stackSet;
  }
});

// node_modules/lodash/_Stack.js
var require_Stack = __commonJS({
  "node_modules/lodash/_Stack.js"(exports, module) {
    var ListCache = require_ListCache();
    var stackClear = require_stackClear();
    var stackDelete = require_stackDelete();
    var stackGet = require_stackGet();
    var stackHas = require_stackHas();
    var stackSet = require_stackSet();
    function Stack(entries) {
      var data = this.__data__ = new ListCache(entries);
      this.size = data.size;
    }
    Stack.prototype.clear = stackClear;
    Stack.prototype["delete"] = stackDelete;
    Stack.prototype.get = stackGet;
    Stack.prototype.has = stackHas;
    Stack.prototype.set = stackSet;
    module.exports = Stack;
  }
});

// node_modules/lodash/_setCacheAdd.js
var require_setCacheAdd = __commonJS({
  "node_modules/lodash/_setCacheAdd.js"(exports, module) {
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    function setCacheAdd(value) {
      this.__data__.set(value, HASH_UNDEFINED);
      return this;
    }
    module.exports = setCacheAdd;
  }
});

// node_modules/lodash/_setCacheHas.js
var require_setCacheHas = __commonJS({
  "node_modules/lodash/_setCacheHas.js"(exports, module) {
    function setCacheHas(value) {
      return this.__data__.has(value);
    }
    module.exports = setCacheHas;
  }
});

// node_modules/lodash/_SetCache.js
var require_SetCache = __commonJS({
  "node_modules/lodash/_SetCache.js"(exports, module) {
    var MapCache = require_MapCache();
    var setCacheAdd = require_setCacheAdd();
    var setCacheHas = require_setCacheHas();
    function SetCache(values) {
      var index = -1, length = values == null ? 0 : values.length;
      this.__data__ = new MapCache();
      while (++index < length) {
        this.add(values[index]);
      }
    }
    SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
    SetCache.prototype.has = setCacheHas;
    module.exports = SetCache;
  }
});

// node_modules/lodash/_arraySome.js
var require_arraySome = __commonJS({
  "node_modules/lodash/_arraySome.js"(exports, module) {
    function arraySome(array, predicate) {
      var index = -1, length = array == null ? 0 : array.length;
      while (++index < length) {
        if (predicate(array[index], index, array)) {
          return true;
        }
      }
      return false;
    }
    module.exports = arraySome;
  }
});

// node_modules/lodash/_cacheHas.js
var require_cacheHas = __commonJS({
  "node_modules/lodash/_cacheHas.js"(exports, module) {
    function cacheHas(cache, key) {
      return cache.has(key);
    }
    module.exports = cacheHas;
  }
});

// node_modules/lodash/_equalArrays.js
var require_equalArrays = __commonJS({
  "node_modules/lodash/_equalArrays.js"(exports, module) {
    var SetCache = require_SetCache();
    var arraySome = require_arraySome();
    var cacheHas = require_cacheHas();
    var COMPARE_PARTIAL_FLAG = 1;
    var COMPARE_UNORDERED_FLAG = 2;
    function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
      if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
        return false;
      }
      var arrStacked = stack.get(array);
      var othStacked = stack.get(other);
      if (arrStacked && othStacked) {
        return arrStacked == other && othStacked == array;
      }
      var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : void 0;
      stack.set(array, other);
      stack.set(other, array);
      while (++index < arrLength) {
        var arrValue = array[index], othValue = other[index];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
        }
        if (compared !== void 0) {
          if (compared) {
            continue;
          }
          result = false;
          break;
        }
        if (seen) {
          if (!arraySome(other, function(othValue2, othIndex) {
            if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
            result = false;
            break;
          }
        } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
          result = false;
          break;
        }
      }
      stack["delete"](array);
      stack["delete"](other);
      return result;
    }
    module.exports = equalArrays;
  }
});

// node_modules/lodash/_Uint8Array.js
var require_Uint8Array = __commonJS({
  "node_modules/lodash/_Uint8Array.js"(exports, module) {
    var root = require_root();
    var Uint8Array2 = root.Uint8Array;
    module.exports = Uint8Array2;
  }
});

// node_modules/lodash/_mapToArray.js
var require_mapToArray = __commonJS({
  "node_modules/lodash/_mapToArray.js"(exports, module) {
    function mapToArray(map) {
      var index = -1, result = Array(map.size);
      map.forEach(function(value, key) {
        result[++index] = [key, value];
      });
      return result;
    }
    module.exports = mapToArray;
  }
});

// node_modules/lodash/_setToArray.js
var require_setToArray = __commonJS({
  "node_modules/lodash/_setToArray.js"(exports, module) {
    function setToArray(set) {
      var index = -1, result = Array(set.size);
      set.forEach(function(value) {
        result[++index] = value;
      });
      return result;
    }
    module.exports = setToArray;
  }
});

// node_modules/lodash/_equalByTag.js
var require_equalByTag = __commonJS({
  "node_modules/lodash/_equalByTag.js"(exports, module) {
    var Symbol2 = require_Symbol();
    var Uint8Array2 = require_Uint8Array();
    var eq = require_eq();
    var equalArrays = require_equalArrays();
    var mapToArray = require_mapToArray();
    var setToArray = require_setToArray();
    var COMPARE_PARTIAL_FLAG = 1;
    var COMPARE_UNORDERED_FLAG = 2;
    var boolTag = "[object Boolean]";
    var dateTag = "[object Date]";
    var errorTag = "[object Error]";
    var mapTag = "[object Map]";
    var numberTag = "[object Number]";
    var regexpTag = "[object RegExp]";
    var setTag = "[object Set]";
    var stringTag = "[object String]";
    var symbolTag = "[object Symbol]";
    var arrayBufferTag = "[object ArrayBuffer]";
    var dataViewTag = "[object DataView]";
    var symbolProto = Symbol2 ? Symbol2.prototype : void 0;
    var symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
    function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
      switch (tag) {
        case dataViewTag:
          if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
            return false;
          }
          object = object.buffer;
          other = other.buffer;
        case arrayBufferTag:
          if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
            return false;
          }
          return true;
        case boolTag:
        case dateTag:
        case numberTag:
          return eq(+object, +other);
        case errorTag:
          return object.name == other.name && object.message == other.message;
        case regexpTag:
        case stringTag:
          return object == other + "";
        case mapTag:
          var convert = mapToArray;
        case setTag:
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
          convert || (convert = setToArray);
          if (object.size != other.size && !isPartial) {
            return false;
          }
          var stacked = stack.get(object);
          if (stacked) {
            return stacked == other;
          }
          bitmask |= COMPARE_UNORDERED_FLAG;
          stack.set(object, other);
          var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
          stack["delete"](object);
          return result;
        case symbolTag:
          if (symbolValueOf) {
            return symbolValueOf.call(object) == symbolValueOf.call(other);
          }
      }
      return false;
    }
    module.exports = equalByTag;
  }
});

// node_modules/lodash/_arrayPush.js
var require_arrayPush = __commonJS({
  "node_modules/lodash/_arrayPush.js"(exports, module) {
    function arrayPush(array, values) {
      var index = -1, length = values.length, offset = array.length;
      while (++index < length) {
        array[offset + index] = values[index];
      }
      return array;
    }
    module.exports = arrayPush;
  }
});

// node_modules/lodash/_baseGetAllKeys.js
var require_baseGetAllKeys = __commonJS({
  "node_modules/lodash/_baseGetAllKeys.js"(exports, module) {
    var arrayPush = require_arrayPush();
    var isArray = require_isArray();
    function baseGetAllKeys(object, keysFunc, symbolsFunc) {
      var result = keysFunc(object);
      return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
    }
    module.exports = baseGetAllKeys;
  }
});

// node_modules/lodash/_arrayFilter.js
var require_arrayFilter = __commonJS({
  "node_modules/lodash/_arrayFilter.js"(exports, module) {
    function arrayFilter(array, predicate) {
      var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
      while (++index < length) {
        var value = array[index];
        if (predicate(value, index, array)) {
          result[resIndex++] = value;
        }
      }
      return result;
    }
    module.exports = arrayFilter;
  }
});

// node_modules/lodash/stubArray.js
var require_stubArray = __commonJS({
  "node_modules/lodash/stubArray.js"(exports, module) {
    function stubArray() {
      return [];
    }
    module.exports = stubArray;
  }
});

// node_modules/lodash/_getSymbols.js
var require_getSymbols = __commonJS({
  "node_modules/lodash/_getSymbols.js"(exports, module) {
    var arrayFilter = require_arrayFilter();
    var stubArray = require_stubArray();
    var objectProto = Object.prototype;
    var propertyIsEnumerable = objectProto.propertyIsEnumerable;
    var nativeGetSymbols = Object.getOwnPropertySymbols;
    var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
      if (object == null) {
        return [];
      }
      object = Object(object);
      return arrayFilter(nativeGetSymbols(object), function(symbol) {
        return propertyIsEnumerable.call(object, symbol);
      });
    };
    module.exports = getSymbols;
  }
});

// node_modules/lodash/_baseTimes.js
var require_baseTimes = __commonJS({
  "node_modules/lodash/_baseTimes.js"(exports, module) {
    function baseTimes(n, iteratee) {
      var index = -1, result = Array(n);
      while (++index < n) {
        result[index] = iteratee(index);
      }
      return result;
    }
    module.exports = baseTimes;
  }
});

// node_modules/lodash/_baseIsArguments.js
var require_baseIsArguments = __commonJS({
  "node_modules/lodash/_baseIsArguments.js"(exports, module) {
    var baseGetTag = require_baseGetTag();
    var isObjectLike = require_isObjectLike();
    var argsTag = "[object Arguments]";
    function baseIsArguments(value) {
      return isObjectLike(value) && baseGetTag(value) == argsTag;
    }
    module.exports = baseIsArguments;
  }
});

// node_modules/lodash/isArguments.js
var require_isArguments = __commonJS({
  "node_modules/lodash/isArguments.js"(exports, module) {
    var baseIsArguments = require_baseIsArguments();
    var isObjectLike = require_isObjectLike();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var propertyIsEnumerable = objectProto.propertyIsEnumerable;
    var isArguments = baseIsArguments(/* @__PURE__ */ (function() {
      return arguments;
    })()) ? baseIsArguments : function(value) {
      return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
    };
    module.exports = isArguments;
  }
});

// node_modules/lodash/stubFalse.js
var require_stubFalse = __commonJS({
  "node_modules/lodash/stubFalse.js"(exports, module) {
    function stubFalse() {
      return false;
    }
    module.exports = stubFalse;
  }
});

// node_modules/lodash/isBuffer.js
var require_isBuffer = __commonJS({
  "node_modules/lodash/isBuffer.js"(exports, module) {
    var root = require_root();
    var stubFalse = require_stubFalse();
    var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
    var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
    var moduleExports = freeModule && freeModule.exports === freeExports;
    var Buffer2 = moduleExports ? root.Buffer : void 0;
    var nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0;
    var isBuffer = nativeIsBuffer || stubFalse;
    module.exports = isBuffer;
  }
});

// node_modules/lodash/_isIndex.js
var require_isIndex = __commonJS({
  "node_modules/lodash/_isIndex.js"(exports, module) {
    var MAX_SAFE_INTEGER = 9007199254740991;
    var reIsUint = /^(?:0|[1-9]\d*)$/;
    function isIndex(value, length) {
      var type = typeof value;
      length = length == null ? MAX_SAFE_INTEGER : length;
      return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
    }
    module.exports = isIndex;
  }
});

// node_modules/lodash/isLength.js
var require_isLength = __commonJS({
  "node_modules/lodash/isLength.js"(exports, module) {
    var MAX_SAFE_INTEGER = 9007199254740991;
    function isLength(value) {
      return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }
    module.exports = isLength;
  }
});

// node_modules/lodash/_baseIsTypedArray.js
var require_baseIsTypedArray = __commonJS({
  "node_modules/lodash/_baseIsTypedArray.js"(exports, module) {
    var baseGetTag = require_baseGetTag();
    var isLength = require_isLength();
    var isObjectLike = require_isObjectLike();
    var argsTag = "[object Arguments]";
    var arrayTag = "[object Array]";
    var boolTag = "[object Boolean]";
    var dateTag = "[object Date]";
    var errorTag = "[object Error]";
    var funcTag = "[object Function]";
    var mapTag = "[object Map]";
    var numberTag = "[object Number]";
    var objectTag = "[object Object]";
    var regexpTag = "[object RegExp]";
    var setTag = "[object Set]";
    var stringTag = "[object String]";
    var weakMapTag = "[object WeakMap]";
    var arrayBufferTag = "[object ArrayBuffer]";
    var dataViewTag = "[object DataView]";
    var float32Tag = "[object Float32Array]";
    var float64Tag = "[object Float64Array]";
    var int8Tag = "[object Int8Array]";
    var int16Tag = "[object Int16Array]";
    var int32Tag = "[object Int32Array]";
    var uint8Tag = "[object Uint8Array]";
    var uint8ClampedTag = "[object Uint8ClampedArray]";
    var uint16Tag = "[object Uint16Array]";
    var uint32Tag = "[object Uint32Array]";
    var typedArrayTags = {};
    typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
    typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
    function baseIsTypedArray(value) {
      return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
    }
    module.exports = baseIsTypedArray;
  }
});

// node_modules/lodash/_baseUnary.js
var require_baseUnary = __commonJS({
  "node_modules/lodash/_baseUnary.js"(exports, module) {
    function baseUnary(func) {
      return function(value) {
        return func(value);
      };
    }
    module.exports = baseUnary;
  }
});

// node_modules/lodash/_nodeUtil.js
var require_nodeUtil = __commonJS({
  "node_modules/lodash/_nodeUtil.js"(exports, module) {
    var freeGlobal = require_freeGlobal();
    var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
    var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
    var moduleExports = freeModule && freeModule.exports === freeExports;
    var freeProcess = moduleExports && freeGlobal.process;
    var nodeUtil = (function() {
      try {
        var types = freeModule && freeModule.require && freeModule.require("util").types;
        if (types) {
          return types;
        }
        return freeProcess && freeProcess.binding && freeProcess.binding("util");
      } catch (e) {
      }
    })();
    module.exports = nodeUtil;
  }
});

// node_modules/lodash/isTypedArray.js
var require_isTypedArray = __commonJS({
  "node_modules/lodash/isTypedArray.js"(exports, module) {
    var baseIsTypedArray = require_baseIsTypedArray();
    var baseUnary = require_baseUnary();
    var nodeUtil = require_nodeUtil();
    var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
    var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
    module.exports = isTypedArray;
  }
});

// node_modules/lodash/_arrayLikeKeys.js
var require_arrayLikeKeys = __commonJS({
  "node_modules/lodash/_arrayLikeKeys.js"(exports, module) {
    var baseTimes = require_baseTimes();
    var isArguments = require_isArguments();
    var isArray = require_isArray();
    var isBuffer = require_isBuffer();
    var isIndex = require_isIndex();
    var isTypedArray = require_isTypedArray();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function arrayLikeKeys(value, inherited) {
      var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
      for (var key in value) {
        if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
        (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
        isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
        isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
        isIndex(key, length)))) {
          result.push(key);
        }
      }
      return result;
    }
    module.exports = arrayLikeKeys;
  }
});

// node_modules/lodash/_isPrototype.js
var require_isPrototype = __commonJS({
  "node_modules/lodash/_isPrototype.js"(exports, module) {
    var objectProto = Object.prototype;
    function isPrototype(value) {
      var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
      return value === proto;
    }
    module.exports = isPrototype;
  }
});

// node_modules/lodash/_overArg.js
var require_overArg = __commonJS({
  "node_modules/lodash/_overArg.js"(exports, module) {
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    module.exports = overArg;
  }
});

// node_modules/lodash/_nativeKeys.js
var require_nativeKeys = __commonJS({
  "node_modules/lodash/_nativeKeys.js"(exports, module) {
    var overArg = require_overArg();
    var nativeKeys = overArg(Object.keys, Object);
    module.exports = nativeKeys;
  }
});

// node_modules/lodash/_baseKeys.js
var require_baseKeys = __commonJS({
  "node_modules/lodash/_baseKeys.js"(exports, module) {
    var isPrototype = require_isPrototype();
    var nativeKeys = require_nativeKeys();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function baseKeys(object) {
      if (!isPrototype(object)) {
        return nativeKeys(object);
      }
      var result = [];
      for (var key in Object(object)) {
        if (hasOwnProperty.call(object, key) && key != "constructor") {
          result.push(key);
        }
      }
      return result;
    }
    module.exports = baseKeys;
  }
});

// node_modules/lodash/isArrayLike.js
var require_isArrayLike = __commonJS({
  "node_modules/lodash/isArrayLike.js"(exports, module) {
    var isFunction = require_isFunction();
    var isLength = require_isLength();
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }
    module.exports = isArrayLike;
  }
});

// node_modules/lodash/keys.js
var require_keys = __commonJS({
  "node_modules/lodash/keys.js"(exports, module) {
    var arrayLikeKeys = require_arrayLikeKeys();
    var baseKeys = require_baseKeys();
    var isArrayLike = require_isArrayLike();
    function keys(object) {
      return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
    }
    module.exports = keys;
  }
});

// node_modules/lodash/_getAllKeys.js
var require_getAllKeys = __commonJS({
  "node_modules/lodash/_getAllKeys.js"(exports, module) {
    var baseGetAllKeys = require_baseGetAllKeys();
    var getSymbols = require_getSymbols();
    var keys = require_keys();
    function getAllKeys(object) {
      return baseGetAllKeys(object, keys, getSymbols);
    }
    module.exports = getAllKeys;
  }
});

// node_modules/lodash/_equalObjects.js
var require_equalObjects = __commonJS({
  "node_modules/lodash/_equalObjects.js"(exports, module) {
    var getAllKeys = require_getAllKeys();
    var COMPARE_PARTIAL_FLAG = 1;
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
      if (objLength != othLength && !isPartial) {
        return false;
      }
      var index = objLength;
      while (index--) {
        var key = objProps[index];
        if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
          return false;
        }
      }
      var objStacked = stack.get(object);
      var othStacked = stack.get(other);
      if (objStacked && othStacked) {
        return objStacked == other && othStacked == object;
      }
      var result = true;
      stack.set(object, other);
      stack.set(other, object);
      var skipCtor = isPartial;
      while (++index < objLength) {
        key = objProps[index];
        var objValue = object[key], othValue = other[key];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
        }
        if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
          result = false;
          break;
        }
        skipCtor || (skipCtor = key == "constructor");
      }
      if (result && !skipCtor) {
        var objCtor = object.constructor, othCtor = other.constructor;
        if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
          result = false;
        }
      }
      stack["delete"](object);
      stack["delete"](other);
      return result;
    }
    module.exports = equalObjects;
  }
});

// node_modules/lodash/_DataView.js
var require_DataView = __commonJS({
  "node_modules/lodash/_DataView.js"(exports, module) {
    var getNative = require_getNative();
    var root = require_root();
    var DataView = getNative(root, "DataView");
    module.exports = DataView;
  }
});

// node_modules/lodash/_Promise.js
var require_Promise = __commonJS({
  "node_modules/lodash/_Promise.js"(exports, module) {
    var getNative = require_getNative();
    var root = require_root();
    var Promise2 = getNative(root, "Promise");
    module.exports = Promise2;
  }
});

// node_modules/lodash/_Set.js
var require_Set = __commonJS({
  "node_modules/lodash/_Set.js"(exports, module) {
    var getNative = require_getNative();
    var root = require_root();
    var Set2 = getNative(root, "Set");
    module.exports = Set2;
  }
});

// node_modules/lodash/_WeakMap.js
var require_WeakMap = __commonJS({
  "node_modules/lodash/_WeakMap.js"(exports, module) {
    var getNative = require_getNative();
    var root = require_root();
    var WeakMap2 = getNative(root, "WeakMap");
    module.exports = WeakMap2;
  }
});

// node_modules/lodash/_getTag.js
var require_getTag = __commonJS({
  "node_modules/lodash/_getTag.js"(exports, module) {
    var DataView = require_DataView();
    var Map2 = require_Map();
    var Promise2 = require_Promise();
    var Set2 = require_Set();
    var WeakMap2 = require_WeakMap();
    var baseGetTag = require_baseGetTag();
    var toSource = require_toSource();
    var mapTag = "[object Map]";
    var objectTag = "[object Object]";
    var promiseTag = "[object Promise]";
    var setTag = "[object Set]";
    var weakMapTag = "[object WeakMap]";
    var dataViewTag = "[object DataView]";
    var dataViewCtorString = toSource(DataView);
    var mapCtorString = toSource(Map2);
    var promiseCtorString = toSource(Promise2);
    var setCtorString = toSource(Set2);
    var weakMapCtorString = toSource(WeakMap2);
    var getTag = baseGetTag;
    if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap2 && getTag(new WeakMap2()) != weakMapTag) {
      getTag = function(value) {
        var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
        if (ctorString) {
          switch (ctorString) {
            case dataViewCtorString:
              return dataViewTag;
            case mapCtorString:
              return mapTag;
            case promiseCtorString:
              return promiseTag;
            case setCtorString:
              return setTag;
            case weakMapCtorString:
              return weakMapTag;
          }
        }
        return result;
      };
    }
    module.exports = getTag;
  }
});

// node_modules/lodash/_baseIsEqualDeep.js
var require_baseIsEqualDeep = __commonJS({
  "node_modules/lodash/_baseIsEqualDeep.js"(exports, module) {
    var Stack = require_Stack();
    var equalArrays = require_equalArrays();
    var equalByTag = require_equalByTag();
    var equalObjects = require_equalObjects();
    var getTag = require_getTag();
    var isArray = require_isArray();
    var isBuffer = require_isBuffer();
    var isTypedArray = require_isTypedArray();
    var COMPARE_PARTIAL_FLAG = 1;
    var argsTag = "[object Arguments]";
    var arrayTag = "[object Array]";
    var objectTag = "[object Object]";
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
      var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
      objTag = objTag == argsTag ? objectTag : objTag;
      othTag = othTag == argsTag ? objectTag : othTag;
      var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
      if (isSameTag && isBuffer(object)) {
        if (!isBuffer(other)) {
          return false;
        }
        objIsArr = true;
        objIsObj = false;
      }
      if (isSameTag && !objIsObj) {
        stack || (stack = new Stack());
        return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
      }
      if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
        var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
        if (objIsWrapped || othIsWrapped) {
          var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
          stack || (stack = new Stack());
          return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
        }
      }
      if (!isSameTag) {
        return false;
      }
      stack || (stack = new Stack());
      return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
    }
    module.exports = baseIsEqualDeep;
  }
});

// node_modules/lodash/_baseIsEqual.js
var require_baseIsEqual = __commonJS({
  "node_modules/lodash/_baseIsEqual.js"(exports, module) {
    var baseIsEqualDeep = require_baseIsEqualDeep();
    var isObjectLike = require_isObjectLike();
    function baseIsEqual(value, other, bitmask, customizer, stack) {
      if (value === other) {
        return true;
      }
      if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
        return value !== value && other !== other;
      }
      return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
    }
    module.exports = baseIsEqual;
  }
});

// node_modules/lodash/isEqual.js
var require_isEqual = __commonJS({
  "node_modules/lodash/isEqual.js"(exports, module) {
    var baseIsEqual = require_baseIsEqual();
    function isEqual(value, other) {
      return baseIsEqual(value, other);
    }
    module.exports = isEqual;
  }
});

// node_modules/@forge/react/out/hooks/useTheme.js
var require_useTheme = __commonJS({
  "node_modules/@forge/react/out/hooks/useTheme.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useTheme = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var react_1 = require_react();
    var bridge_1 = require_out3();
    var isEqual_1 = tslib_1.__importDefault(require_isEqual());
    var useTheme = () => {
      const [theme, setTheme] = (0, react_1.useState)(null);
      const themeRef = (0, react_1.useRef)(null);
      const themeLoadedRef = (0, react_1.useRef)(false);
      const loadingContextRef = (0, react_1.useRef)(false);
      const applyTheme = (0, react_1.useCallback)((nextTheme) => {
        if ((0, isEqual_1.default)(themeRef.current, nextTheme)) {
          return;
        }
        themeRef.current = nextTheme;
        setTheme((current) => (0, isEqual_1.default)(current, nextTheme) ? current : nextTheme);
      }, []);
      (0, react_1.useEffect)(() => {
        let cancelled = false;
        void (async () => {
          if (themeLoadedRef.current || loadingContextRef.current) {
            return;
          }
          loadingContextRef.current = true;
          try {
            const context = await bridge_1.view.getContext();
            if (cancelled || !context?.theme || themeLoadedRef.current) {
              return;
            }
            applyTheme(context.theme);
            themeLoadedRef.current = true;
          } finally {
            loadingContextRef.current = false;
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [applyTheme]);
      (0, react_1.useEffect)(() => {
        let unsubscribeFn = null;
        let cancelled = false;
        const sub = bridge_1.events.on("FORGE_CORE_THEME_CHANGED", ({ theme: updatedTheme }) => {
          themeLoadedRef.current = true;
          applyTheme(updatedTheme);
        });
        void sub.then((subscription) => {
          if (cancelled) {
            subscription.unsubscribe();
          } else {
            unsubscribeFn = () => subscription.unsubscribe();
          }
        });
        return () => {
          cancelled = true;
          if (unsubscribeFn) {
            unsubscribeFn();
          }
        };
      }, [applyTheme]);
      return theme;
    };
    exports.useTheme = useTheme;
  }
});

// node_modules/@forge/react/out/hooks/usePermissions.js
var require_usePermissions = __commonJS({
  "node_modules/@forge/react/out/hooks/usePermissions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.usePermissions = void 0;
    var react_1 = require_react();
    var bridge_1 = require_out3();
    var usePermissions = (requiredPermissions) => {
      const [context, setContext] = (0, react_1.useState)();
      const [isLoading, setIsLoading] = (0, react_1.useState)(true);
      const [error, setError] = (0, react_1.useState)(null);
      const [permissionResult, setPermissionResult] = (0, react_1.useState)({
        granted: false,
        missing: null
      });
      (0, react_1.useEffect)(() => {
        const loadContext = async () => {
          try {
            setIsLoading(true);
            setError(null);
            const contextData = await bridge_1.view.getContext();
            setContext(contextData);
          } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to load context"));
          } finally {
            setIsLoading(false);
          }
        };
        void loadContext();
      }, []);
      (0, react_1.useEffect)(() => {
        if (isLoading) {
          return;
        }
        const checkPerms = async () => {
          if (!requiredPermissions) {
            setPermissionResult({ granted: false, missing: null });
            return;
          }
          if (!context?.permissions) {
            if (context !== void 0) {
              setError(new Error("This feature is not available yet"));
              setPermissionResult({ granted: false, missing: null });
            }
            return;
          }
          try {
            setError(null);
            const result = await (0, bridge_1.checkPermissions)(requiredPermissions, context.permissions);
            setPermissionResult(result);
          } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to check permissions"));
            setPermissionResult({ granted: false, missing: null });
          }
        };
        void checkPerms();
      }, [context, requiredPermissions, isLoading]);
      return {
        hasPermission: permissionResult.granted,
        isLoading,
        missingPermissions: permissionResult.missing,
        error
      };
    };
    exports.usePermissions = usePermissions;
  }
});

// node_modules/scheduler/cjs/scheduler.production.min.js
var require_scheduler_production_min = __commonJS({
  "node_modules/scheduler/cjs/scheduler.production.min.js"(exports) {
    "use strict";
    function f(a, b) {
      var c = a.length;
      a.push(b);
      a: for (; 0 < c; ) {
        var d = c - 1 >>> 1, e = a[d];
        if (0 < g(e, b)) a[d] = b, a[c] = e, c = d;
        else break a;
      }
    }
    function h(a) {
      return 0 === a.length ? null : a[0];
    }
    function k(a) {
      if (0 === a.length) return null;
      var b = a[0], c = a.pop();
      if (c !== b) {
        a[0] = c;
        a: for (var d = 0, e = a.length, w = e >>> 1; d < w; ) {
          var m = 2 * (d + 1) - 1, C = a[m], n = m + 1, x = a[n];
          if (0 > g(C, c)) n < e && 0 > g(x, C) ? (a[d] = x, a[n] = c, d = n) : (a[d] = C, a[m] = c, d = m);
          else if (n < e && 0 > g(x, c)) a[d] = x, a[n] = c, d = n;
          else break a;
        }
      }
      return b;
    }
    function g(a, b) {
      var c = a.sortIndex - b.sortIndex;
      return 0 !== c ? c : a.id - b.id;
    }
    if ("object" === typeof performance && "function" === typeof performance.now) {
      l = performance;
      exports.unstable_now = function() {
        return l.now();
      };
    } else {
      p = Date, q = p.now();
      exports.unstable_now = function() {
        return p.now() - q;
      };
    }
    var l;
    var p;
    var q;
    var r = [];
    var t = [];
    var u = 1;
    var v = null;
    var y = 3;
    var z = false;
    var A = false;
    var B = false;
    var D = "function" === typeof setTimeout ? setTimeout : null;
    var E = "function" === typeof clearTimeout ? clearTimeout : null;
    var F = "undefined" !== typeof setImmediate ? setImmediate : null;
    "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function G(a) {
      for (var b = h(t); null !== b; ) {
        if (null === b.callback) k(t);
        else if (b.startTime <= a) k(t), b.sortIndex = b.expirationTime, f(r, b);
        else break;
        b = h(t);
      }
    }
    function H(a) {
      B = false;
      G(a);
      if (!A) if (null !== h(r)) A = true, I(J);
      else {
        var b = h(t);
        null !== b && K(H, b.startTime - a);
      }
    }
    function J(a, b) {
      A = false;
      B && (B = false, E(L), L = -1);
      z = true;
      var c = y;
      try {
        G(b);
        for (v = h(r); null !== v && (!(v.expirationTime > b) || a && !M()); ) {
          var d = v.callback;
          if ("function" === typeof d) {
            v.callback = null;
            y = v.priorityLevel;
            var e = d(v.expirationTime <= b);
            b = exports.unstable_now();
            "function" === typeof e ? v.callback = e : v === h(r) && k(r);
            G(b);
          } else k(r);
          v = h(r);
        }
        if (null !== v) var w = true;
        else {
          var m = h(t);
          null !== m && K(H, m.startTime - b);
          w = false;
        }
        return w;
      } finally {
        v = null, y = c, z = false;
      }
    }
    var N = false;
    var O = null;
    var L = -1;
    var P = 5;
    var Q = -1;
    function M() {
      return exports.unstable_now() - Q < P ? false : true;
    }
    function R() {
      if (null !== O) {
        var a = exports.unstable_now();
        Q = a;
        var b = true;
        try {
          b = O(true, a);
        } finally {
          b ? S() : (N = false, O = null);
        }
      } else N = false;
    }
    var S;
    if ("function" === typeof F) S = function() {
      F(R);
    };
    else if ("undefined" !== typeof MessageChannel) {
      T = new MessageChannel(), U = T.port2;
      T.port1.onmessage = R;
      S = function() {
        U.postMessage(null);
      };
    } else S = function() {
      D(R, 0);
    };
    var T;
    var U;
    function I(a) {
      O = a;
      N || (N = true, S());
    }
    function K(a, b) {
      L = D(function() {
        a(exports.unstable_now());
      }, b);
    }
    exports.unstable_IdlePriority = 5;
    exports.unstable_ImmediatePriority = 1;
    exports.unstable_LowPriority = 4;
    exports.unstable_NormalPriority = 3;
    exports.unstable_Profiling = null;
    exports.unstable_UserBlockingPriority = 2;
    exports.unstable_cancelCallback = function(a) {
      a.callback = null;
    };
    exports.unstable_continueExecution = function() {
      A || z || (A = true, I(J));
    };
    exports.unstable_forceFrameRate = function(a) {
      0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P = 0 < a ? Math.floor(1e3 / a) : 5;
    };
    exports.unstable_getCurrentPriorityLevel = function() {
      return y;
    };
    exports.unstable_getFirstCallbackNode = function() {
      return h(r);
    };
    exports.unstable_next = function(a) {
      switch (y) {
        case 1:
        case 2:
        case 3:
          var b = 3;
          break;
        default:
          b = y;
      }
      var c = y;
      y = b;
      try {
        return a();
      } finally {
        y = c;
      }
    };
    exports.unstable_pauseExecution = function() {
    };
    exports.unstable_requestPaint = function() {
    };
    exports.unstable_runWithPriority = function(a, b) {
      switch (a) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          a = 3;
      }
      var c = y;
      y = a;
      try {
        return b();
      } finally {
        y = c;
      }
    };
    exports.unstable_scheduleCallback = function(a, b, c) {
      var d = exports.unstable_now();
      "object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
      switch (a) {
        case 1:
          var e = -1;
          break;
        case 2:
          e = 250;
          break;
        case 5:
          e = 1073741823;
          break;
        case 4:
          e = 1e4;
          break;
        default:
          e = 5e3;
      }
      e = c + e;
      a = { id: u++, callback: b, priorityLevel: a, startTime: c, expirationTime: e, sortIndex: -1 };
      c > d ? (a.sortIndex = c, f(t, a), null === h(r) && a === h(t) && (B ? (E(L), L = -1) : B = true, K(H, c - d))) : (a.sortIndex = e, f(r, a), A || z || (A = true, I(J)));
      return a;
    };
    exports.unstable_shouldYield = M;
    exports.unstable_wrapCallback = function(a) {
      var b = y;
      return function() {
        var c = y;
        y = b;
        try {
          return a.apply(this, arguments);
        } finally {
          y = c;
        }
      };
    };
  }
});

// node_modules/scheduler/index.js
var require_scheduler = __commonJS({
  "node_modules/scheduler/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_scheduler_production_min();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/react-reconciler/cjs/react-reconciler.production.min.js
var require_react_reconciler_production_min = __commonJS({
  "node_modules/react-reconciler/cjs/react-reconciler.production.min.js"(exports, module) {
    module.exports = function $$$reconciler($$$hostConfig) {
      var exports2 = {};
      "use strict";
      var aa = require_react(), ba = require_scheduler(), ca = Object.assign;
      function n(a) {
        for (var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++) b += "&args[]=" + encodeURIComponent(arguments[c]);
        return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      var da = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, ea = Symbol.for("react.element"), fa = Symbol.for("react.portal"), ha = Symbol.for("react.fragment"), ia = Symbol.for("react.strict_mode"), ja = Symbol.for("react.profiler"), ka = Symbol.for("react.provider"), la = Symbol.for("react.context"), ma = Symbol.for("react.forward_ref"), na = Symbol.for("react.suspense"), oa = Symbol.for("react.suspense_list"), pa = Symbol.for("react.memo"), qa = Symbol.for("react.lazy");
      Symbol.for("react.scope");
      Symbol.for("react.debug_trace_mode");
      var ra = Symbol.for("react.offscreen");
      Symbol.for("react.legacy_hidden");
      Symbol.for("react.cache");
      Symbol.for("react.tracing_marker");
      var sa = Symbol.iterator;
      function ta(a) {
        if (null === a || "object" !== typeof a) return null;
        a = sa && a[sa] || a["@@iterator"];
        return "function" === typeof a ? a : null;
      }
      function ua(a) {
        if (null == a) return null;
        if ("function" === typeof a) return a.displayName || a.name || null;
        if ("string" === typeof a) return a;
        switch (a) {
          case ha:
            return "Fragment";
          case fa:
            return "Portal";
          case ja:
            return "Profiler";
          case ia:
            return "StrictMode";
          case na:
            return "Suspense";
          case oa:
            return "SuspenseList";
        }
        if ("object" === typeof a) switch (a.$$typeof) {
          case la:
            return (a.displayName || "Context") + ".Consumer";
          case ka:
            return (a._context.displayName || "Context") + ".Provider";
          case ma:
            var b = a.render;
            a = a.displayName;
            a || (a = b.displayName || b.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
            return a;
          case pa:
            return b = a.displayName || null, null !== b ? b : ua(a.type) || "Memo";
          case qa:
            b = a._payload;
            a = a._init;
            try {
              return ua(a(b));
            } catch (c) {
            }
        }
        return null;
      }
      function va(a) {
        var b = a.type;
        switch (a.tag) {
          case 24:
            return "Cache";
          case 9:
            return (b.displayName || "Context") + ".Consumer";
          case 10:
            return (b._context.displayName || "Context") + ".Provider";
          case 18:
            return "DehydratedFragment";
          case 11:
            return a = b.render, a = a.displayName || a.name || "", b.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
          case 7:
            return "Fragment";
          case 5:
            return b;
          case 4:
            return "Portal";
          case 3:
            return "Root";
          case 6:
            return "Text";
          case 16:
            return ua(b);
          case 8:
            return b === ia ? "StrictMode" : "Mode";
          case 22:
            return "Offscreen";
          case 12:
            return "Profiler";
          case 21:
            return "Scope";
          case 13:
            return "Suspense";
          case 19:
            return "SuspenseList";
          case 25:
            return "TracingMarker";
          case 1:
          case 0:
          case 17:
          case 2:
          case 14:
          case 15:
            if ("function" === typeof b) return b.displayName || b.name || null;
            if ("string" === typeof b) return b;
        }
        return null;
      }
      function wa(a) {
        var b = a, c = a;
        if (a.alternate) for (; b.return; ) b = b.return;
        else {
          a = b;
          do
            b = a, 0 !== (b.flags & 4098) && (c = b.return), a = b.return;
          while (a);
        }
        return 3 === b.tag ? c : null;
      }
      function xa(a) {
        if (wa(a) !== a) throw Error(n(188));
      }
      function za(a) {
        var b = a.alternate;
        if (!b) {
          b = wa(a);
          if (null === b) throw Error(n(188));
          return b !== a ? null : a;
        }
        for (var c = a, d = b; ; ) {
          var e = c.return;
          if (null === e) break;
          var f = e.alternate;
          if (null === f) {
            d = e.return;
            if (null !== d) {
              c = d;
              continue;
            }
            break;
          }
          if (e.child === f.child) {
            for (f = e.child; f; ) {
              if (f === c) return xa(e), a;
              if (f === d) return xa(e), b;
              f = f.sibling;
            }
            throw Error(n(188));
          }
          if (c.return !== d.return) c = e, d = f;
          else {
            for (var g = false, h = e.child; h; ) {
              if (h === c) {
                g = true;
                c = e;
                d = f;
                break;
              }
              if (h === d) {
                g = true;
                d = e;
                c = f;
                break;
              }
              h = h.sibling;
            }
            if (!g) {
              for (h = f.child; h; ) {
                if (h === c) {
                  g = true;
                  c = f;
                  d = e;
                  break;
                }
                if (h === d) {
                  g = true;
                  d = f;
                  c = e;
                  break;
                }
                h = h.sibling;
              }
              if (!g) throw Error(n(189));
            }
          }
          if (c.alternate !== d) throw Error(n(190));
        }
        if (3 !== c.tag) throw Error(n(188));
        return c.stateNode.current === c ? a : b;
      }
      function Aa(a) {
        a = za(a);
        return null !== a ? Ba(a) : null;
      }
      function Ba(a) {
        if (5 === a.tag || 6 === a.tag) return a;
        for (a = a.child; null !== a; ) {
          var b = Ba(a);
          if (null !== b) return b;
          a = a.sibling;
        }
        return null;
      }
      function Ca(a) {
        if (5 === a.tag || 6 === a.tag) return a;
        for (a = a.child; null !== a; ) {
          if (4 !== a.tag) {
            var b = Ca(a);
            if (null !== b) return b;
          }
          a = a.sibling;
        }
        return null;
      }
      var Da = Array.isArray, Ea = $$$hostConfig.getPublicInstance, Fa = $$$hostConfig.getRootHostContext, Ga = $$$hostConfig.getChildHostContext, Ha = $$$hostConfig.prepareForCommit, Ia = $$$hostConfig.resetAfterCommit, Ja = $$$hostConfig.createInstance, Ka = $$$hostConfig.appendInitialChild, La = $$$hostConfig.finalizeInitialChildren, Ma = $$$hostConfig.prepareUpdate, Na = $$$hostConfig.shouldSetTextContent, Oa = $$$hostConfig.createTextInstance, Pa = $$$hostConfig.scheduleTimeout, Qa = $$$hostConfig.cancelTimeout, Ra = $$$hostConfig.noTimeout, Sa = $$$hostConfig.isPrimaryRenderer, Ta = $$$hostConfig.supportsMutation, Ua = $$$hostConfig.supportsPersistence, Va = $$$hostConfig.supportsHydration, Wa = $$$hostConfig.getInstanceFromNode, Xa = $$$hostConfig.preparePortalMount, Ya = $$$hostConfig.getCurrentEventPriority, Za = $$$hostConfig.detachDeletedInstance, $a = $$$hostConfig.supportsMicrotasks, ab = $$$hostConfig.scheduleMicrotask, bb = $$$hostConfig.supportsTestSelectors, cb = $$$hostConfig.findFiberRoot, db = $$$hostConfig.getBoundingRect, eb = $$$hostConfig.getTextContent, fb = $$$hostConfig.isHiddenSubtree, gb = $$$hostConfig.matchAccessibilityRole, hb = $$$hostConfig.setFocusIfFocusable, ib = $$$hostConfig.setupIntersectionObserver, jb = $$$hostConfig.appendChild, kb = $$$hostConfig.appendChildToContainer, lb = $$$hostConfig.commitTextUpdate, mb = $$$hostConfig.commitMount, nb = $$$hostConfig.commitUpdate, ob = $$$hostConfig.insertBefore, pb = $$$hostConfig.insertInContainerBefore, qb = $$$hostConfig.removeChild, rb = $$$hostConfig.removeChildFromContainer, sb = $$$hostConfig.resetTextContent, tb = $$$hostConfig.hideInstance, ub = $$$hostConfig.hideTextInstance, vb = $$$hostConfig.unhideInstance, wb = $$$hostConfig.unhideTextInstance, xb = $$$hostConfig.clearContainer, yb = $$$hostConfig.cloneInstance, zb = $$$hostConfig.createContainerChildSet, Ab = $$$hostConfig.appendChildToContainerChildSet, Bb = $$$hostConfig.finalizeContainerChildren, Cb = $$$hostConfig.replaceContainerChildren, Eb = $$$hostConfig.cloneHiddenInstance, Fb = $$$hostConfig.cloneHiddenTextInstance, Gb = $$$hostConfig.canHydrateInstance, Hb = $$$hostConfig.canHydrateTextInstance, Ib = $$$hostConfig.canHydrateSuspenseInstance, Jb = $$$hostConfig.isSuspenseInstancePending, Kb = $$$hostConfig.isSuspenseInstanceFallback, Lb = $$$hostConfig.getSuspenseInstanceFallbackErrorDetails, Mb = $$$hostConfig.registerSuspenseInstanceRetry, Nb = $$$hostConfig.getNextHydratableSibling, Ob = $$$hostConfig.getFirstHydratableChild, Pb = $$$hostConfig.getFirstHydratableChildWithinContainer, Qb = $$$hostConfig.getFirstHydratableChildWithinSuspenseInstance, Rb = $$$hostConfig.hydrateInstance, Sb = $$$hostConfig.hydrateTextInstance, Tb = $$$hostConfig.hydrateSuspenseInstance, Ub = $$$hostConfig.getNextHydratableInstanceAfterSuspenseInstance, Vb = $$$hostConfig.commitHydratedContainer, Wb = $$$hostConfig.commitHydratedSuspenseInstance, Xb = $$$hostConfig.clearSuspenseBoundary, Yb = $$$hostConfig.clearSuspenseBoundaryFromContainer, Zb = $$$hostConfig.shouldDeleteUnhydratedTailInstances, $b = $$$hostConfig.didNotMatchHydratedContainerTextInstance, ac = $$$hostConfig.didNotMatchHydratedTextInstance, bc;
      function cc(a) {
        if (void 0 === bc) try {
          throw Error();
        } catch (c) {
          var b = c.stack.trim().match(/\n( *(at )?)/);
          bc = b && b[1] || "";
        }
        return "\n" + bc + a;
      }
      var dc = false;
      function ec(a, b) {
        if (!a || dc) return "";
        dc = true;
        var c = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          if (b) if (b = function() {
            throw Error();
          }, Object.defineProperty(b.prototype, "props", { set: function() {
            throw Error();
          } }), "object" === typeof Reflect && Reflect.construct) {
            try {
              Reflect.construct(b, []);
            } catch (l) {
              var d = l;
            }
            Reflect.construct(a, [], b);
          } else {
            try {
              b.call();
            } catch (l) {
              d = l;
            }
            a.call(b.prototype);
          }
          else {
            try {
              throw Error();
            } catch (l) {
              d = l;
            }
            a();
          }
        } catch (l) {
          if (l && d && "string" === typeof l.stack) {
            for (var e = l.stack.split("\n"), f = d.stack.split("\n"), g = e.length - 1, h = f.length - 1; 1 <= g && 0 <= h && e[g] !== f[h]; ) h--;
            for (; 1 <= g && 0 <= h; g--, h--) if (e[g] !== f[h]) {
              if (1 !== g || 1 !== h) {
                do
                  if (g--, h--, 0 > h || e[g] !== f[h]) {
                    var k = "\n" + e[g].replace(" at new ", " at ");
                    a.displayName && k.includes("<anonymous>") && (k = k.replace("<anonymous>", a.displayName));
                    return k;
                  }
                while (1 <= g && 0 <= h);
              }
              break;
            }
          }
        } finally {
          dc = false, Error.prepareStackTrace = c;
        }
        return (a = a ? a.displayName || a.name : "") ? cc(a) : "";
      }
      var fc = Object.prototype.hasOwnProperty, gc = [], hc = -1;
      function ic(a) {
        return { current: a };
      }
      function q(a) {
        0 > hc || (a.current = gc[hc], gc[hc] = null, hc--);
      }
      function v(a, b) {
        hc++;
        gc[hc] = a.current;
        a.current = b;
      }
      var jc = {}, x = ic(jc), z = ic(false), kc = jc;
      function mc(a, b) {
        var c = a.type.contextTypes;
        if (!c) return jc;
        var d = a.stateNode;
        if (d && d.__reactInternalMemoizedUnmaskedChildContext === b) return d.__reactInternalMemoizedMaskedChildContext;
        var e = {}, f;
        for (f in c) e[f] = b[f];
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
        return e;
      }
      function A(a) {
        a = a.childContextTypes;
        return null !== a && void 0 !== a;
      }
      function nc() {
        q(z);
        q(x);
      }
      function oc(a, b, c) {
        if (x.current !== jc) throw Error(n(168));
        v(x, b);
        v(z, c);
      }
      function pc(a, b, c) {
        var d = a.stateNode;
        b = b.childContextTypes;
        if ("function" !== typeof d.getChildContext) return c;
        d = d.getChildContext();
        for (var e in d) if (!(e in b)) throw Error(n(108, va(a) || "Unknown", e));
        return ca({}, c, d);
      }
      function qc(a) {
        a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || jc;
        kc = x.current;
        v(x, a);
        v(z, z.current);
        return true;
      }
      function rc(a, b, c) {
        var d = a.stateNode;
        if (!d) throw Error(n(169));
        c ? (a = pc(a, b, kc), d.__reactInternalMemoizedMergedChildContext = a, q(z), q(x), v(x, a)) : q(z);
        v(z, c);
      }
      var tc = Math.clz32 ? Math.clz32 : sc, uc = Math.log, vc = Math.LN2;
      function sc(a) {
        a >>>= 0;
        return 0 === a ? 32 : 31 - (uc(a) / vc | 0) | 0;
      }
      var wc = 64, xc = 4194304;
      function yc(a) {
        switch (a & -a) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return a & 4194240;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            return a & 130023424;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 1073741824;
          default:
            return a;
        }
      }
      function zc(a, b) {
        var c = a.pendingLanes;
        if (0 === c) return 0;
        var d = 0, e = a.suspendedLanes, f = a.pingedLanes, g = c & 268435455;
        if (0 !== g) {
          var h = g & ~e;
          0 !== h ? d = yc(h) : (f &= g, 0 !== f && (d = yc(f)));
        } else g = c & ~e, 0 !== g ? d = yc(g) : 0 !== f && (d = yc(f));
        if (0 === d) return 0;
        if (0 !== b && b !== d && 0 === (b & e) && (e = d & -d, f = b & -b, e >= f || 16 === e && 0 !== (f & 4194240))) return b;
        0 !== (d & 4) && (d |= c & 16);
        b = a.entangledLanes;
        if (0 !== b) for (a = a.entanglements, b &= d; 0 < b; ) c = 31 - tc(b), e = 1 << c, d |= a[c], b &= ~e;
        return d;
      }
      function Ac(a, b) {
        switch (a) {
          case 1:
          case 2:
          case 4:
            return b + 250;
          case 8:
          case 16:
          case 32:
          case 64:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return b + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
          case 67108864:
            return -1;
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function Bc(a, b) {
        for (var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f = a.pendingLanes; 0 < f; ) {
          var g = 31 - tc(f), h = 1 << g, k = e[g];
          if (-1 === k) {
            if (0 === (h & c) || 0 !== (h & d)) e[g] = Ac(h, b);
          } else k <= b && (a.expiredLanes |= h);
          f &= ~h;
        }
      }
      function Cc(a) {
        a = a.pendingLanes & -1073741825;
        return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
      }
      function Dc() {
        var a = wc;
        wc <<= 1;
        0 === (wc & 4194240) && (wc = 64);
        return a;
      }
      function Ec(a) {
        for (var b = [], c = 0; 31 > c; c++) b.push(a);
        return b;
      }
      function Fc(a, b, c) {
        a.pendingLanes |= b;
        536870912 !== b && (a.suspendedLanes = 0, a.pingedLanes = 0);
        a = a.eventTimes;
        b = 31 - tc(b);
        a[b] = c;
      }
      function Gc(a, b) {
        var c = a.pendingLanes & ~b;
        a.pendingLanes = b;
        a.suspendedLanes = 0;
        a.pingedLanes = 0;
        a.expiredLanes &= b;
        a.mutableReadLanes &= b;
        a.entangledLanes &= b;
        b = a.entanglements;
        var d = a.eventTimes;
        for (a = a.expirationTimes; 0 < c; ) {
          var e = 31 - tc(c), f = 1 << e;
          b[e] = 0;
          d[e] = -1;
          a[e] = -1;
          c &= ~f;
        }
      }
      function Hc(a, b) {
        var c = a.entangledLanes |= b;
        for (a = a.entanglements; c; ) {
          var d = 31 - tc(c), e = 1 << d;
          e & b | a[d] & b && (a[d] |= b);
          c &= ~e;
        }
      }
      var C = 0;
      function Ic(a) {
        a &= -a;
        return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
      }
      var Jc = ba.unstable_scheduleCallback, Kc = ba.unstable_cancelCallback, Lc = ba.unstable_shouldYield, Mc = ba.unstable_requestPaint, D = ba.unstable_now, Nc = ba.unstable_ImmediatePriority, Oc = ba.unstable_UserBlockingPriority, Pc = ba.unstable_NormalPriority, Qc = ba.unstable_IdlePriority, Rc = null, Sc = null;
      function Tc(a) {
        if (Sc && "function" === typeof Sc.onCommitFiberRoot) try {
          Sc.onCommitFiberRoot(Rc, a, void 0, 128 === (a.current.flags & 128));
        } catch (b) {
        }
      }
      function Uc(a, b) {
        return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
      }
      var Vc = "function" === typeof Object.is ? Object.is : Uc, Wc = null, Xc = false, Yc = false;
      function Zc(a) {
        null === Wc ? Wc = [a] : Wc.push(a);
      }
      function $c(a) {
        Xc = true;
        Zc(a);
      }
      function ad() {
        if (!Yc && null !== Wc) {
          Yc = true;
          var a = 0, b = C;
          try {
            var c = Wc;
            for (C = 1; a < c.length; a++) {
              var d = c[a];
              do
                d = d(true);
              while (null !== d);
            }
            Wc = null;
            Xc = false;
          } catch (e) {
            throw null !== Wc && (Wc = Wc.slice(a + 1)), Jc(Nc, ad), e;
          } finally {
            C = b, Yc = false;
          }
        }
        return null;
      }
      var bd = [], cd = 0, dd = null, ed = 0, fd = [], gd = 0, hd = null, id = 1, jd = "";
      function kd(a, b) {
        bd[cd++] = ed;
        bd[cd++] = dd;
        dd = a;
        ed = b;
      }
      function ld(a, b, c) {
        fd[gd++] = id;
        fd[gd++] = jd;
        fd[gd++] = hd;
        hd = a;
        var d = id;
        a = jd;
        var e = 32 - tc(d) - 1;
        d &= ~(1 << e);
        c += 1;
        var f = 32 - tc(b) + e;
        if (30 < f) {
          var g = e - e % 5;
          f = (d & (1 << g) - 1).toString(32);
          d >>= g;
          e -= g;
          id = 1 << 32 - tc(b) + e | c << e | d;
          jd = f + a;
        } else id = 1 << f | c << e | d, jd = a;
      }
      function md(a) {
        null !== a.return && (kd(a, 1), ld(a, 1, 0));
      }
      function nd(a) {
        for (; a === dd; ) dd = bd[--cd], bd[cd] = null, ed = bd[--cd], bd[cd] = null;
        for (; a === hd; ) hd = fd[--gd], fd[gd] = null, jd = fd[--gd], fd[gd] = null, id = fd[--gd], fd[gd] = null;
      }
      var od = null, pd = null, F = false, qd = false, rd = null;
      function sd(a, b) {
        var c = td(5, null, null, 0);
        c.elementType = "DELETED";
        c.stateNode = b;
        c.return = a;
        b = a.deletions;
        null === b ? (a.deletions = [c], a.flags |= 16) : b.push(c);
      }
      function ud(a, b) {
        switch (a.tag) {
          case 5:
            return b = Gb(b, a.type, a.pendingProps), null !== b ? (a.stateNode = b, od = a, pd = Ob(b), true) : false;
          case 6:
            return b = Hb(b, a.pendingProps), null !== b ? (a.stateNode = b, od = a, pd = null, true) : false;
          case 13:
            b = Ib(b);
            if (null !== b) {
              var c = null !== hd ? { id, overflow: jd } : null;
              a.memoizedState = { dehydrated: b, treeContext: c, retryLane: 1073741824 };
              c = td(18, null, null, 0);
              c.stateNode = b;
              c.return = a;
              a.child = c;
              od = a;
              pd = null;
              return true;
            }
            return false;
          default:
            return false;
        }
      }
      function vd(a) {
        return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
      }
      function wd(a) {
        if (F) {
          var b = pd;
          if (b) {
            var c = b;
            if (!ud(a, b)) {
              if (vd(a)) throw Error(n(418));
              b = Nb(c);
              var d = od;
              b && ud(a, b) ? sd(d, c) : (a.flags = a.flags & -4097 | 2, F = false, od = a);
            }
          } else {
            if (vd(a)) throw Error(n(418));
            a.flags = a.flags & -4097 | 2;
            F = false;
            od = a;
          }
        }
      }
      function xd(a) {
        for (a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag; ) a = a.return;
        od = a;
      }
      function yd(a) {
        if (!Va || a !== od) return false;
        if (!F) return xd(a), F = true, false;
        if (3 !== a.tag && (5 !== a.tag || Zb(a.type) && !Na(a.type, a.memoizedProps))) {
          var b = pd;
          if (b) {
            if (vd(a)) throw zd(), Error(n(418));
            for (; b; ) sd(a, b), b = Nb(b);
          }
        }
        xd(a);
        if (13 === a.tag) {
          if (!Va) throw Error(n(316));
          a = a.memoizedState;
          a = null !== a ? a.dehydrated : null;
          if (!a) throw Error(n(317));
          pd = Ub(a);
        } else pd = od ? Nb(a.stateNode) : null;
        return true;
      }
      function zd() {
        for (var a = pd; a; ) a = Nb(a);
      }
      function Ad() {
        Va && (pd = od = null, qd = F = false);
      }
      function Bd(a) {
        null === rd ? rd = [a] : rd.push(a);
      }
      var Cd = da.ReactCurrentBatchConfig;
      function Dd(a, b) {
        if (Vc(a, b)) return true;
        if ("object" !== typeof a || null === a || "object" !== typeof b || null === b) return false;
        var c = Object.keys(a), d = Object.keys(b);
        if (c.length !== d.length) return false;
        for (d = 0; d < c.length; d++) {
          var e = c[d];
          if (!fc.call(b, e) || !Vc(a[e], b[e])) return false;
        }
        return true;
      }
      function Ed(a) {
        switch (a.tag) {
          case 5:
            return cc(a.type);
          case 16:
            return cc("Lazy");
          case 13:
            return cc("Suspense");
          case 19:
            return cc("SuspenseList");
          case 0:
          case 2:
          case 15:
            return a = ec(a.type, false), a;
          case 11:
            return a = ec(a.type.render, false), a;
          case 1:
            return a = ec(a.type, true), a;
          default:
            return "";
        }
      }
      function Fd(a, b, c) {
        a = c.ref;
        if (null !== a && "function" !== typeof a && "object" !== typeof a) {
          if (c._owner) {
            c = c._owner;
            if (c) {
              if (1 !== c.tag) throw Error(n(309));
              var d = c.stateNode;
            }
            if (!d) throw Error(n(147, a));
            var e = d, f = "" + a;
            if (null !== b && null !== b.ref && "function" === typeof b.ref && b.ref._stringRef === f) return b.ref;
            b = function(a2) {
              var b2 = e.refs;
              null === a2 ? delete b2[f] : b2[f] = a2;
            };
            b._stringRef = f;
            return b;
          }
          if ("string" !== typeof a) throw Error(n(284));
          if (!c._owner) throw Error(n(290, a));
        }
        return a;
      }
      function Gd(a, b) {
        a = Object.prototype.toString.call(b);
        throw Error(n(31, "[object Object]" === a ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
      }
      function Hd(a) {
        var b = a._init;
        return b(a._payload);
      }
      function Id(a) {
        function b(b2, c2) {
          if (a) {
            var d2 = b2.deletions;
            null === d2 ? (b2.deletions = [c2], b2.flags |= 16) : d2.push(c2);
          }
        }
        function c(c2, d2) {
          if (!a) return null;
          for (; null !== d2; ) b(c2, d2), d2 = d2.sibling;
          return null;
        }
        function d(a2, b2) {
          for (a2 = /* @__PURE__ */ new Map(); null !== b2; ) null !== b2.key ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
          return a2;
        }
        function e(a2, b2) {
          a2 = Jd(a2, b2);
          a2.index = 0;
          a2.sibling = null;
          return a2;
        }
        function f(b2, c2, d2) {
          b2.index = d2;
          if (!a) return b2.flags |= 1048576, c2;
          d2 = b2.alternate;
          if (null !== d2) return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
          b2.flags |= 2;
          return c2;
        }
        function g(b2) {
          a && null === b2.alternate && (b2.flags |= 2);
          return b2;
        }
        function h(a2, b2, c2, d2) {
          if (null === b2 || 6 !== b2.tag) return b2 = Kd(c2, a2.mode, d2), b2.return = a2, b2;
          b2 = e(b2, c2);
          b2.return = a2;
          return b2;
        }
        function k(a2, b2, c2, d2) {
          var f2 = c2.type;
          if (f2 === ha) return m(a2, b2, c2.props.children, d2, c2.key);
          if (null !== b2 && (b2.elementType === f2 || "object" === typeof f2 && null !== f2 && f2.$$typeof === qa && Hd(f2) === b2.type)) return d2 = e(b2, c2.props), d2.ref = Fd(a2, b2, c2), d2.return = a2, d2;
          d2 = Ld(c2.type, c2.key, c2.props, null, a2.mode, d2);
          d2.ref = Fd(a2, b2, c2);
          d2.return = a2;
          return d2;
        }
        function l(a2, b2, c2, d2) {
          if (null === b2 || 4 !== b2.tag || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation) return b2 = Md(c2, a2.mode, d2), b2.return = a2, b2;
          b2 = e(b2, c2.children || []);
          b2.return = a2;
          return b2;
        }
        function m(a2, b2, c2, d2, f2) {
          if (null === b2 || 7 !== b2.tag) return b2 = Nd(c2, a2.mode, d2, f2), b2.return = a2, b2;
          b2 = e(b2, c2);
          b2.return = a2;
          return b2;
        }
        function r(a2, b2, c2) {
          if ("string" === typeof b2 && "" !== b2 || "number" === typeof b2) return b2 = Kd("" + b2, a2.mode, c2), b2.return = a2, b2;
          if ("object" === typeof b2 && null !== b2) {
            switch (b2.$$typeof) {
              case ea:
                return c2 = Ld(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = Fd(a2, null, b2), c2.return = a2, c2;
              case fa:
                return b2 = Md(b2, a2.mode, c2), b2.return = a2, b2;
              case qa:
                var d2 = b2._init;
                return r(a2, d2(b2._payload), c2);
            }
            if (Da(b2) || ta(b2)) return b2 = Nd(b2, a2.mode, c2, null), b2.return = a2, b2;
            Gd(a2, b2);
          }
          return null;
        }
        function p(a2, b2, c2, d2) {
          var e2 = null !== b2 ? b2.key : null;
          if ("string" === typeof c2 && "" !== c2 || "number" === typeof c2) return null !== e2 ? null : h(a2, b2, "" + c2, d2);
          if ("object" === typeof c2 && null !== c2) {
            switch (c2.$$typeof) {
              case ea:
                return c2.key === e2 ? k(a2, b2, c2, d2) : null;
              case fa:
                return c2.key === e2 ? l(a2, b2, c2, d2) : null;
              case qa:
                return e2 = c2._init, p(
                  a2,
                  b2,
                  e2(c2._payload),
                  d2
                );
            }
            if (Da(c2) || ta(c2)) return null !== e2 ? null : m(a2, b2, c2, d2, null);
            Gd(a2, c2);
          }
          return null;
        }
        function B(a2, b2, c2, d2, e2) {
          if ("string" === typeof d2 && "" !== d2 || "number" === typeof d2) return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
          if ("object" === typeof d2 && null !== d2) {
            switch (d2.$$typeof) {
              case ea:
                return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, k(b2, a2, d2, e2);
              case fa:
                return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, l(b2, a2, d2, e2);
              case qa:
                var f2 = d2._init;
                return B(a2, b2, c2, f2(d2._payload), e2);
            }
            if (Da(d2) || ta(d2)) return a2 = a2.get(c2) || null, m(b2, a2, d2, e2, null);
            Gd(b2, d2);
          }
          return null;
        }
        function w(e2, g2, h2, k2) {
          for (var l2 = null, m2 = null, u = g2, t = g2 = 0, E = null; null !== u && t < h2.length; t++) {
            u.index > t ? (E = u, u = null) : E = u.sibling;
            var y = p(e2, u, h2[t], k2);
            if (null === y) {
              null === u && (u = E);
              break;
            }
            a && u && null === y.alternate && b(e2, u);
            g2 = f(y, g2, t);
            null === m2 ? l2 = y : m2.sibling = y;
            m2 = y;
            u = E;
          }
          if (t === h2.length) return c(e2, u), F && kd(e2, t), l2;
          if (null === u) {
            for (; t < h2.length; t++) u = r(e2, h2[t], k2), null !== u && (g2 = f(u, g2, t), null === m2 ? l2 = u : m2.sibling = u, m2 = u);
            F && kd(e2, t);
            return l2;
          }
          for (u = d(e2, u); t < h2.length; t++) E = B(u, e2, t, h2[t], k2), null !== E && (a && null !== E.alternate && u.delete(null === E.key ? t : E.key), g2 = f(E, g2, t), null === m2 ? l2 = E : m2.sibling = E, m2 = E);
          a && u.forEach(function(a2) {
            return b(e2, a2);
          });
          F && kd(e2, t);
          return l2;
        }
        function Y(e2, g2, h2, k2) {
          var l2 = ta(h2);
          if ("function" !== typeof l2) throw Error(n(150));
          h2 = l2.call(h2);
          if (null == h2) throw Error(n(151));
          for (var u = l2 = null, m2 = g2, t = g2 = 0, E = null, y = h2.next(); null !== m2 && !y.done; t++, y = h2.next()) {
            m2.index > t ? (E = m2, m2 = null) : E = m2.sibling;
            var w2 = p(e2, m2, y.value, k2);
            if (null === w2) {
              null === m2 && (m2 = E);
              break;
            }
            a && m2 && null === w2.alternate && b(e2, m2);
            g2 = f(w2, g2, t);
            null === u ? l2 = w2 : u.sibling = w2;
            u = w2;
            m2 = E;
          }
          if (y.done) return c(
            e2,
            m2
          ), F && kd(e2, t), l2;
          if (null === m2) {
            for (; !y.done; t++, y = h2.next()) y = r(e2, y.value, k2), null !== y && (g2 = f(y, g2, t), null === u ? l2 = y : u.sibling = y, u = y);
            F && kd(e2, t);
            return l2;
          }
          for (m2 = d(e2, m2); !y.done; t++, y = h2.next()) y = B(m2, e2, t, y.value, k2), null !== y && (a && null !== y.alternate && m2.delete(null === y.key ? t : y.key), g2 = f(y, g2, t), null === u ? l2 = y : u.sibling = y, u = y);
          a && m2.forEach(function(a2) {
            return b(e2, a2);
          });
          F && kd(e2, t);
          return l2;
        }
        function ya(a2, d2, f2, h2) {
          "object" === typeof f2 && null !== f2 && f2.type === ha && null === f2.key && (f2 = f2.props.children);
          if ("object" === typeof f2 && null !== f2) {
            switch (f2.$$typeof) {
              case ea:
                a: {
                  for (var k2 = f2.key, l2 = d2; null !== l2; ) {
                    if (l2.key === k2) {
                      k2 = f2.type;
                      if (k2 === ha) {
                        if (7 === l2.tag) {
                          c(a2, l2.sibling);
                          d2 = e(l2, f2.props.children);
                          d2.return = a2;
                          a2 = d2;
                          break a;
                        }
                      } else if (l2.elementType === k2 || "object" === typeof k2 && null !== k2 && k2.$$typeof === qa && Hd(k2) === l2.type) {
                        c(a2, l2.sibling);
                        d2 = e(l2, f2.props);
                        d2.ref = Fd(a2, l2, f2);
                        d2.return = a2;
                        a2 = d2;
                        break a;
                      }
                      c(a2, l2);
                      break;
                    } else b(a2, l2);
                    l2 = l2.sibling;
                  }
                  f2.type === ha ? (d2 = Nd(f2.props.children, a2.mode, h2, f2.key), d2.return = a2, a2 = d2) : (h2 = Ld(f2.type, f2.key, f2.props, null, a2.mode, h2), h2.ref = Fd(a2, d2, f2), h2.return = a2, a2 = h2);
                }
                return g(a2);
              case fa:
                a: {
                  for (l2 = f2.key; null !== d2; ) {
                    if (d2.key === l2) if (4 === d2.tag && d2.stateNode.containerInfo === f2.containerInfo && d2.stateNode.implementation === f2.implementation) {
                      c(a2, d2.sibling);
                      d2 = e(d2, f2.children || []);
                      d2.return = a2;
                      a2 = d2;
                      break a;
                    } else {
                      c(a2, d2);
                      break;
                    }
                    else b(a2, d2);
                    d2 = d2.sibling;
                  }
                  d2 = Md(f2, a2.mode, h2);
                  d2.return = a2;
                  a2 = d2;
                }
                return g(a2);
              case qa:
                return l2 = f2._init, ya(a2, d2, l2(f2._payload), h2);
            }
            if (Da(f2)) return w(a2, d2, f2, h2);
            if (ta(f2)) return Y(a2, d2, f2, h2);
            Gd(a2, f2);
          }
          return "string" === typeof f2 && "" !== f2 || "number" === typeof f2 ? (f2 = "" + f2, null !== d2 && 6 === d2.tag ? (c(a2, d2.sibling), d2 = e(d2, f2), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = Kd(f2, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
        }
        return ya;
      }
      var Od = Id(true), Pd = Id(false), Qd = ic(null), Rd = null, Sd = null, Td = null;
      function Ud() {
        Td = Sd = Rd = null;
      }
      function Vd(a, b, c) {
        Sa ? (v(Qd, b._currentValue), b._currentValue = c) : (v(Qd, b._currentValue2), b._currentValue2 = c);
      }
      function Wd(a) {
        var b = Qd.current;
        q(Qd);
        Sa ? a._currentValue = b : a._currentValue2 = b;
      }
      function Xd(a, b, c) {
        for (; null !== a; ) {
          var d = a.alternate;
          (a.childLanes & b) !== b ? (a.childLanes |= b, null !== d && (d.childLanes |= b)) : null !== d && (d.childLanes & b) !== b && (d.childLanes |= b);
          if (a === c) break;
          a = a.return;
        }
      }
      function Yd(a, b) {
        Rd = a;
        Td = Sd = null;
        a = a.dependencies;
        null !== a && null !== a.firstContext && (0 !== (a.lanes & b) && (G = true), a.firstContext = null);
      }
      function Zd(a) {
        var b = Sa ? a._currentValue : a._currentValue2;
        if (Td !== a) if (a = { context: a, memoizedValue: b, next: null }, null === Sd) {
          if (null === Rd) throw Error(n(308));
          Sd = a;
          Rd.dependencies = { lanes: 0, firstContext: a };
        } else Sd = Sd.next = a;
        return b;
      }
      var $d = null;
      function ae(a) {
        null === $d ? $d = [a] : $d.push(a);
      }
      function be(a, b, c, d) {
        var e = b.interleaved;
        null === e ? (c.next = c, ae(b)) : (c.next = e.next, e.next = c);
        b.interleaved = c;
        return ce(a, d);
      }
      function ce(a, b) {
        a.lanes |= b;
        var c = a.alternate;
        null !== c && (c.lanes |= b);
        c = a;
        for (a = a.return; null !== a; ) a.childLanes |= b, c = a.alternate, null !== c && (c.childLanes |= b), c = a, a = a.return;
        return 3 === c.tag ? c.stateNode : null;
      }
      var de = false;
      function ee(a) {
        a.updateQueue = { baseState: a.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
      }
      function fe(a, b) {
        a = a.updateQueue;
        b.updateQueue === a && (b.updateQueue = { baseState: a.baseState, firstBaseUpdate: a.firstBaseUpdate, lastBaseUpdate: a.lastBaseUpdate, shared: a.shared, effects: a.effects });
      }
      function ge(a, b) {
        return { eventTime: a, lane: b, tag: 0, payload: null, callback: null, next: null };
      }
      function he(a, b, c) {
        var d = a.updateQueue;
        if (null === d) return null;
        d = d.shared;
        if (0 !== (H & 2)) {
          var e = d.pending;
          null === e ? b.next = b : (b.next = e.next, e.next = b);
          d.pending = b;
          return ce(a, c);
        }
        e = d.interleaved;
        null === e ? (b.next = b, ae(d)) : (b.next = e.next, e.next = b);
        d.interleaved = b;
        return ce(a, c);
      }
      function ie(a, b, c) {
        b = b.updateQueue;
        if (null !== b && (b = b.shared, 0 !== (c & 4194240))) {
          var d = b.lanes;
          d &= a.pendingLanes;
          c |= d;
          b.lanes = c;
          Hc(a, c);
        }
      }
      function je(a, b) {
        var c = a.updateQueue, d = a.alternate;
        if (null !== d && (d = d.updateQueue, c === d)) {
          var e = null, f = null;
          c = c.firstBaseUpdate;
          if (null !== c) {
            do {
              var g = { eventTime: c.eventTime, lane: c.lane, tag: c.tag, payload: c.payload, callback: c.callback, next: null };
              null === f ? e = f = g : f = f.next = g;
              c = c.next;
            } while (null !== c);
            null === f ? e = f = b : f = f.next = b;
          } else e = f = b;
          c = { baseState: d.baseState, firstBaseUpdate: e, lastBaseUpdate: f, shared: d.shared, effects: d.effects };
          a.updateQueue = c;
          return;
        }
        a = c.lastBaseUpdate;
        null === a ? c.firstBaseUpdate = b : a.next = b;
        c.lastBaseUpdate = b;
      }
      function ke(a, b, c, d) {
        var e = a.updateQueue;
        de = false;
        var f = e.firstBaseUpdate, g = e.lastBaseUpdate, h = e.shared.pending;
        if (null !== h) {
          e.shared.pending = null;
          var k = h, l = k.next;
          k.next = null;
          null === g ? f = l : g.next = l;
          g = k;
          var m = a.alternate;
          null !== m && (m = m.updateQueue, h = m.lastBaseUpdate, h !== g && (null === h ? m.firstBaseUpdate = l : h.next = l, m.lastBaseUpdate = k));
        }
        if (null !== f) {
          var r = e.baseState;
          g = 0;
          m = l = k = null;
          h = f;
          do {
            var p = h.lane, B = h.eventTime;
            if ((d & p) === p) {
              null !== m && (m = m.next = {
                eventTime: B,
                lane: 0,
                tag: h.tag,
                payload: h.payload,
                callback: h.callback,
                next: null
              });
              a: {
                var w = a, Y = h;
                p = b;
                B = c;
                switch (Y.tag) {
                  case 1:
                    w = Y.payload;
                    if ("function" === typeof w) {
                      r = w.call(B, r, p);
                      break a;
                    }
                    r = w;
                    break a;
                  case 3:
                    w.flags = w.flags & -65537 | 128;
                  case 0:
                    w = Y.payload;
                    p = "function" === typeof w ? w.call(B, r, p) : w;
                    if (null === p || void 0 === p) break a;
                    r = ca({}, r, p);
                    break a;
                  case 2:
                    de = true;
                }
              }
              null !== h.callback && 0 !== h.lane && (a.flags |= 64, p = e.effects, null === p ? e.effects = [h] : p.push(h));
            } else B = { eventTime: B, lane: p, tag: h.tag, payload: h.payload, callback: h.callback, next: null }, null === m ? (l = m = B, k = r) : m = m.next = B, g |= p;
            h = h.next;
            if (null === h) if (h = e.shared.pending, null === h) break;
            else p = h, h = p.next, p.next = null, e.lastBaseUpdate = p, e.shared.pending = null;
          } while (1);
          null === m && (k = r);
          e.baseState = k;
          e.firstBaseUpdate = l;
          e.lastBaseUpdate = m;
          b = e.shared.interleaved;
          if (null !== b) {
            e = b;
            do
              g |= e.lane, e = e.next;
            while (e !== b);
          } else null === f && (e.shared.lanes = 0);
          le |= g;
          a.lanes = g;
          a.memoizedState = r;
        }
      }
      function me(a, b, c) {
        a = b.effects;
        b.effects = null;
        if (null !== a) for (b = 0; b < a.length; b++) {
          var d = a[b], e = d.callback;
          if (null !== e) {
            d.callback = null;
            d = c;
            if ("function" !== typeof e) throw Error(n(191, e));
            e.call(d);
          }
        }
      }
      var ne = {}, oe = ic(ne), pe = ic(ne), qe = ic(ne);
      function re(a) {
        if (a === ne) throw Error(n(174));
        return a;
      }
      function se(a, b) {
        v(qe, b);
        v(pe, a);
        v(oe, ne);
        a = Fa(b);
        q(oe);
        v(oe, a);
      }
      function te() {
        q(oe);
        q(pe);
        q(qe);
      }
      function ue(a) {
        var b = re(qe.current), c = re(oe.current);
        b = Ga(c, a.type, b);
        c !== b && (v(pe, a), v(oe, b));
      }
      function ve(a) {
        pe.current === a && (q(oe), q(pe));
      }
      var I = ic(0);
      function we(a) {
        for (var b = a; null !== b; ) {
          if (13 === b.tag) {
            var c = b.memoizedState;
            if (null !== c && (c = c.dehydrated, null === c || Jb(c) || Kb(c))) return b;
          } else if (19 === b.tag && void 0 !== b.memoizedProps.revealOrder) {
            if (0 !== (b.flags & 128)) return b;
          } else if (null !== b.child) {
            b.child.return = b;
            b = b.child;
            continue;
          }
          if (b === a) break;
          for (; null === b.sibling; ) {
            if (null === b.return || b.return === a) return null;
            b = b.return;
          }
          b.sibling.return = b.return;
          b = b.sibling;
        }
        return null;
      }
      var xe = [];
      function ye() {
        for (var a = 0; a < xe.length; a++) {
          var b = xe[a];
          Sa ? b._workInProgressVersionPrimary = null : b._workInProgressVersionSecondary = null;
        }
        xe.length = 0;
      }
      var ze = da.ReactCurrentDispatcher, Ae = da.ReactCurrentBatchConfig, Be = 0, J = null, K = null, L = null, Ce = false, De = false, Ee = 0, Fe = 0;
      function M() {
        throw Error(n(321));
      }
      function Ge(a, b) {
        if (null === b) return false;
        for (var c = 0; c < b.length && c < a.length; c++) if (!Vc(a[c], b[c])) return false;
        return true;
      }
      function He(a, b, c, d, e, f) {
        Be = f;
        J = b;
        b.memoizedState = null;
        b.updateQueue = null;
        b.lanes = 0;
        ze.current = null === a || null === a.memoizedState ? Ie : Je;
        a = c(d, e);
        if (De) {
          f = 0;
          do {
            De = false;
            Ee = 0;
            if (25 <= f) throw Error(n(301));
            f += 1;
            L = K = null;
            b.updateQueue = null;
            ze.current = Ke;
            a = c(d, e);
          } while (De);
        }
        ze.current = Le;
        b = null !== K && null !== K.next;
        Be = 0;
        L = K = J = null;
        Ce = false;
        if (b) throw Error(n(300));
        return a;
      }
      function Me() {
        var a = 0 !== Ee;
        Ee = 0;
        return a;
      }
      function Ne() {
        var a = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
        null === L ? J.memoizedState = L = a : L = L.next = a;
        return L;
      }
      function Oe() {
        if (null === K) {
          var a = J.alternate;
          a = null !== a ? a.memoizedState : null;
        } else a = K.next;
        var b = null === L ? J.memoizedState : L.next;
        if (null !== b) L = b, K = a;
        else {
          if (null === a) throw Error(n(310));
          K = a;
          a = { memoizedState: K.memoizedState, baseState: K.baseState, baseQueue: K.baseQueue, queue: K.queue, next: null };
          null === L ? J.memoizedState = L = a : L = L.next = a;
        }
        return L;
      }
      function Pe(a, b) {
        return "function" === typeof b ? b(a) : b;
      }
      function Qe(a) {
        var b = Oe(), c = b.queue;
        if (null === c) throw Error(n(311));
        c.lastRenderedReducer = a;
        var d = K, e = d.baseQueue, f = c.pending;
        if (null !== f) {
          if (null !== e) {
            var g = e.next;
            e.next = f.next;
            f.next = g;
          }
          d.baseQueue = e = f;
          c.pending = null;
        }
        if (null !== e) {
          f = e.next;
          d = d.baseState;
          var h = g = null, k = null, l = f;
          do {
            var m = l.lane;
            if ((Be & m) === m) null !== k && (k = k.next = { lane: 0, action: l.action, hasEagerState: l.hasEagerState, eagerState: l.eagerState, next: null }), d = l.hasEagerState ? l.eagerState : a(d, l.action);
            else {
              var r = {
                lane: m,
                action: l.action,
                hasEagerState: l.hasEagerState,
                eagerState: l.eagerState,
                next: null
              };
              null === k ? (h = k = r, g = d) : k = k.next = r;
              J.lanes |= m;
              le |= m;
            }
            l = l.next;
          } while (null !== l && l !== f);
          null === k ? g = d : k.next = h;
          Vc(d, b.memoizedState) || (G = true);
          b.memoizedState = d;
          b.baseState = g;
          b.baseQueue = k;
          c.lastRenderedState = d;
        }
        a = c.interleaved;
        if (null !== a) {
          e = a;
          do
            f = e.lane, J.lanes |= f, le |= f, e = e.next;
          while (e !== a);
        } else null === e && (c.lanes = 0);
        return [b.memoizedState, c.dispatch];
      }
      function Re(a) {
        var b = Oe(), c = b.queue;
        if (null === c) throw Error(n(311));
        c.lastRenderedReducer = a;
        var d = c.dispatch, e = c.pending, f = b.memoizedState;
        if (null !== e) {
          c.pending = null;
          var g = e = e.next;
          do
            f = a(f, g.action), g = g.next;
          while (g !== e);
          Vc(f, b.memoizedState) || (G = true);
          b.memoizedState = f;
          null === b.baseQueue && (b.baseState = f);
          c.lastRenderedState = f;
        }
        return [f, d];
      }
      function Se() {
      }
      function Te(a, b) {
        var c = J, d = Oe(), e = b(), f = !Vc(d.memoizedState, e);
        f && (d.memoizedState = e, G = true);
        d = d.queue;
        Ue(Ve.bind(null, c, d, a), [a]);
        if (d.getSnapshot !== b || f || null !== L && L.memoizedState.tag & 1) {
          c.flags |= 2048;
          We(9, Xe.bind(null, c, d, e, b), void 0, null);
          if (null === N) throw Error(n(349));
          0 !== (Be & 30) || Ye(c, b, e);
        }
        return e;
      }
      function Ye(a, b, c) {
        a.flags |= 16384;
        a = { getSnapshot: b, value: c };
        b = J.updateQueue;
        null === b ? (b = { lastEffect: null, stores: null }, J.updateQueue = b, b.stores = [a]) : (c = b.stores, null === c ? b.stores = [a] : c.push(a));
      }
      function Xe(a, b, c, d) {
        b.value = c;
        b.getSnapshot = d;
        Ze(b) && $e(a);
      }
      function Ve(a, b, c) {
        return c(function() {
          Ze(b) && $e(a);
        });
      }
      function Ze(a) {
        var b = a.getSnapshot;
        a = a.value;
        try {
          var c = b();
          return !Vc(a, c);
        } catch (d) {
          return true;
        }
      }
      function $e(a) {
        var b = ce(a, 1);
        null !== b && af(b, a, 1, -1);
      }
      function bf(a) {
        var b = Ne();
        "function" === typeof a && (a = a());
        b.memoizedState = b.baseState = a;
        a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Pe, lastRenderedState: a };
        b.queue = a;
        a = a.dispatch = cf.bind(null, J, a);
        return [b.memoizedState, a];
      }
      function We(a, b, c, d) {
        a = { tag: a, create: b, destroy: c, deps: d, next: null };
        b = J.updateQueue;
        null === b ? (b = { lastEffect: null, stores: null }, J.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, null === c ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
        return a;
      }
      function df() {
        return Oe().memoizedState;
      }
      function ef(a, b, c, d) {
        var e = Ne();
        J.flags |= a;
        e.memoizedState = We(1 | b, c, void 0, void 0 === d ? null : d);
      }
      function ff(a, b, c, d) {
        var e = Oe();
        d = void 0 === d ? null : d;
        var f = void 0;
        if (null !== K) {
          var g = K.memoizedState;
          f = g.destroy;
          if (null !== d && Ge(d, g.deps)) {
            e.memoizedState = We(b, c, f, d);
            return;
          }
        }
        J.flags |= a;
        e.memoizedState = We(1 | b, c, f, d);
      }
      function gf(a, b) {
        return ef(8390656, 8, a, b);
      }
      function Ue(a, b) {
        return ff(2048, 8, a, b);
      }
      function hf(a, b) {
        return ff(4, 2, a, b);
      }
      function jf(a, b) {
        return ff(4, 4, a, b);
      }
      function kf(a, b) {
        if ("function" === typeof b) return a = a(), b(a), function() {
          b(null);
        };
        if (null !== b && void 0 !== b) return a = a(), b.current = a, function() {
          b.current = null;
        };
      }
      function lf(a, b, c) {
        c = null !== c && void 0 !== c ? c.concat([a]) : null;
        return ff(4, 4, kf.bind(null, b, a), c);
      }
      function mf() {
      }
      function nf(a, b) {
        var c = Oe();
        b = void 0 === b ? null : b;
        var d = c.memoizedState;
        if (null !== d && null !== b && Ge(b, d[1])) return d[0];
        c.memoizedState = [a, b];
        return a;
      }
      function of(a, b) {
        var c = Oe();
        b = void 0 === b ? null : b;
        var d = c.memoizedState;
        if (null !== d && null !== b && Ge(b, d[1])) return d[0];
        a = a();
        c.memoizedState = [a, b];
        return a;
      }
      function pf(a, b, c) {
        if (0 === (Be & 21)) return a.baseState && (a.baseState = false, G = true), a.memoizedState = c;
        Vc(c, b) || (c = Dc(), J.lanes |= c, le |= c, a.baseState = true);
        return b;
      }
      function qf(a, b) {
        var c = C;
        C = 0 !== c && 4 > c ? c : 4;
        a(true);
        var d = Ae.transition;
        Ae.transition = {};
        try {
          a(false), b();
        } finally {
          C = c, Ae.transition = d;
        }
      }
      function rf() {
        return Oe().memoizedState;
      }
      function sf(a, b, c) {
        var d = tf(a);
        c = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
        if (uf(a)) vf(b, c);
        else if (c = be(a, b, c, d), null !== c) {
          var e = O();
          af(c, a, d, e);
          wf(c, b, d);
        }
      }
      function cf(a, b, c) {
        var d = tf(a), e = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
        if (uf(a)) vf(b, e);
        else {
          var f = a.alternate;
          if (0 === a.lanes && (null === f || 0 === f.lanes) && (f = b.lastRenderedReducer, null !== f)) try {
            var g = b.lastRenderedState, h = f(g, c);
            e.hasEagerState = true;
            e.eagerState = h;
            if (Vc(h, g)) {
              var k = b.interleaved;
              null === k ? (e.next = e, ae(b)) : (e.next = k.next, k.next = e);
              b.interleaved = e;
              return;
            }
          } catch (l) {
          } finally {
          }
          c = be(a, b, e, d);
          null !== c && (e = O(), af(c, a, d, e), wf(c, b, d));
        }
      }
      function uf(a) {
        var b = a.alternate;
        return a === J || null !== b && b === J;
      }
      function vf(a, b) {
        De = Ce = true;
        var c = a.pending;
        null === c ? b.next = b : (b.next = c.next, c.next = b);
        a.pending = b;
      }
      function wf(a, b, c) {
        if (0 !== (c & 4194240)) {
          var d = b.lanes;
          d &= a.pendingLanes;
          c |= d;
          b.lanes = c;
          Hc(a, c);
        }
      }
      var Le = { readContext: Zd, useCallback: M, useContext: M, useEffect: M, useImperativeHandle: M, useInsertionEffect: M, useLayoutEffect: M, useMemo: M, useReducer: M, useRef: M, useState: M, useDebugValue: M, useDeferredValue: M, useTransition: M, useMutableSource: M, useSyncExternalStore: M, useId: M, unstable_isNewReconciler: false }, Ie = { readContext: Zd, useCallback: function(a, b) {
        Ne().memoizedState = [a, void 0 === b ? null : b];
        return a;
      }, useContext: Zd, useEffect: gf, useImperativeHandle: function(a, b, c) {
        c = null !== c && void 0 !== c ? c.concat([a]) : null;
        return ef(
          4194308,
          4,
          kf.bind(null, b, a),
          c
        );
      }, useLayoutEffect: function(a, b) {
        return ef(4194308, 4, a, b);
      }, useInsertionEffect: function(a, b) {
        return ef(4, 2, a, b);
      }, useMemo: function(a, b) {
        var c = Ne();
        b = void 0 === b ? null : b;
        a = a();
        c.memoizedState = [a, b];
        return a;
      }, useReducer: function(a, b, c) {
        var d = Ne();
        b = void 0 !== c ? c(b) : b;
        d.memoizedState = d.baseState = b;
        a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: a, lastRenderedState: b };
        d.queue = a;
        a = a.dispatch = sf.bind(null, J, a);
        return [d.memoizedState, a];
      }, useRef: function(a) {
        var b = Ne();
        a = { current: a };
        return b.memoizedState = a;
      }, useState: bf, useDebugValue: mf, useDeferredValue: function(a) {
        return Ne().memoizedState = a;
      }, useTransition: function() {
        var a = bf(false), b = a[0];
        a = qf.bind(null, a[1]);
        Ne().memoizedState = a;
        return [b, a];
      }, useMutableSource: function() {
      }, useSyncExternalStore: function(a, b, c) {
        var d = J, e = Ne();
        if (F) {
          if (void 0 === c) throw Error(n(407));
          c = c();
        } else {
          c = b();
          if (null === N) throw Error(n(349));
          0 !== (Be & 30) || Ye(d, b, c);
        }
        e.memoizedState = c;
        var f = { value: c, getSnapshot: b };
        e.queue = f;
        gf(Ve.bind(
          null,
          d,
          f,
          a
        ), [a]);
        d.flags |= 2048;
        We(9, Xe.bind(null, d, f, c, b), void 0, null);
        return c;
      }, useId: function() {
        var a = Ne(), b = N.identifierPrefix;
        if (F) {
          var c = jd;
          var d = id;
          c = (d & ~(1 << 32 - tc(d) - 1)).toString(32) + c;
          b = ":" + b + "R" + c;
          c = Ee++;
          0 < c && (b += "H" + c.toString(32));
          b += ":";
        } else c = Fe++, b = ":" + b + "r" + c.toString(32) + ":";
        return a.memoizedState = b;
      }, unstable_isNewReconciler: false }, Je = {
        readContext: Zd,
        useCallback: nf,
        useContext: Zd,
        useEffect: Ue,
        useImperativeHandle: lf,
        useInsertionEffect: hf,
        useLayoutEffect: jf,
        useMemo: of,
        useReducer: Qe,
        useRef: df,
        useState: function() {
          return Qe(Pe);
        },
        useDebugValue: mf,
        useDeferredValue: function(a) {
          var b = Oe();
          return pf(b, K.memoizedState, a);
        },
        useTransition: function() {
          var a = Qe(Pe)[0], b = Oe().memoizedState;
          return [a, b];
        },
        useMutableSource: Se,
        useSyncExternalStore: Te,
        useId: rf,
        unstable_isNewReconciler: false
      }, Ke = { readContext: Zd, useCallback: nf, useContext: Zd, useEffect: Ue, useImperativeHandle: lf, useInsertionEffect: hf, useLayoutEffect: jf, useMemo: of, useReducer: Re, useRef: df, useState: function() {
        return Re(Pe);
      }, useDebugValue: mf, useDeferredValue: function(a) {
        var b = Oe();
        return null === K ? b.memoizedState = a : pf(b, K.memoizedState, a);
      }, useTransition: function() {
        var a = Re(Pe)[0], b = Oe().memoizedState;
        return [a, b];
      }, useMutableSource: Se, useSyncExternalStore: Te, useId: rf, unstable_isNewReconciler: false };
      function xf(a, b) {
        if (a && a.defaultProps) {
          b = ca({}, b);
          a = a.defaultProps;
          for (var c in a) void 0 === b[c] && (b[c] = a[c]);
          return b;
        }
        return b;
      }
      function yf(a, b, c, d) {
        b = a.memoizedState;
        c = c(d, b);
        c = null === c || void 0 === c ? b : ca({}, b, c);
        a.memoizedState = c;
        0 === a.lanes && (a.updateQueue.baseState = c);
      }
      var zf = { isMounted: function(a) {
        return (a = a._reactInternals) ? wa(a) === a : false;
      }, enqueueSetState: function(a, b, c) {
        a = a._reactInternals;
        var d = O(), e = tf(a), f = ge(d, e);
        f.payload = b;
        void 0 !== c && null !== c && (f.callback = c);
        b = he(a, f, e);
        null !== b && (af(b, a, e, d), ie(b, a, e));
      }, enqueueReplaceState: function(a, b, c) {
        a = a._reactInternals;
        var d = O(), e = tf(a), f = ge(d, e);
        f.tag = 1;
        f.payload = b;
        void 0 !== c && null !== c && (f.callback = c);
        b = he(a, f, e);
        null !== b && (af(b, a, e, d), ie(b, a, e));
      }, enqueueForceUpdate: function(a, b) {
        a = a._reactInternals;
        var c = O(), d = tf(a), e = ge(c, d);
        e.tag = 2;
        void 0 !== b && null !== b && (e.callback = b);
        b = he(a, e, d);
        null !== b && (af(b, a, d, c), ie(b, a, d));
      } };
      function Af(a, b, c, d, e, f, g) {
        a = a.stateNode;
        return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f, g) : b.prototype && b.prototype.isPureReactComponent ? !Dd(c, d) || !Dd(e, f) : true;
      }
      function Bf(a, b, c) {
        var d = false, e = jc;
        var f = b.contextType;
        "object" === typeof f && null !== f ? f = Zd(f) : (e = A(b) ? kc : x.current, d = b.contextTypes, f = (d = null !== d && void 0 !== d) ? mc(a, e) : jc);
        b = new b(c, f);
        a.memoizedState = null !== b.state && void 0 !== b.state ? b.state : null;
        b.updater = zf;
        a.stateNode = b;
        b._reactInternals = a;
        d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f);
        return b;
      }
      function Cf(a, b, c, d) {
        a = b.state;
        "function" === typeof b.componentWillReceiveProps && b.componentWillReceiveProps(c, d);
        "function" === typeof b.UNSAFE_componentWillReceiveProps && b.UNSAFE_componentWillReceiveProps(c, d);
        b.state !== a && zf.enqueueReplaceState(b, b.state, null);
      }
      function Df(a, b, c, d) {
        var e = a.stateNode;
        e.props = c;
        e.state = a.memoizedState;
        e.refs = {};
        ee(a);
        var f = b.contextType;
        "object" === typeof f && null !== f ? e.context = Zd(f) : (f = A(b) ? kc : x.current, e.context = mc(a, f));
        e.state = a.memoizedState;
        f = b.getDerivedStateFromProps;
        "function" === typeof f && (yf(a, b, f, c), e.state = a.memoizedState);
        "function" === typeof b.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b !== e.state && zf.enqueueReplaceState(e, e.state, null), ke(a, c, e, d), e.state = a.memoizedState);
        "function" === typeof e.componentDidMount && (a.flags |= 4194308);
      }
      function Ef(a, b) {
        try {
          var c = "", d = b;
          do
            c += Ed(d), d = d.return;
          while (d);
          var e = c;
        } catch (f) {
          e = "\nError generating stack: " + f.message + "\n" + f.stack;
        }
        return { value: a, source: b, stack: e, digest: null };
      }
      function Ff(a, b, c) {
        return { value: a, source: null, stack: null != c ? c : null, digest: null != b ? b : null };
      }
      function Gf(a, b) {
        try {
          console.error(b.value);
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      var Hf = "function" === typeof WeakMap ? WeakMap : Map;
      function If(a, b, c) {
        c = ge(-1, c);
        c.tag = 3;
        c.payload = { element: null };
        var d = b.value;
        c.callback = function() {
          Jf || (Jf = true, Kf = d);
          Gf(a, b);
        };
        return c;
      }
      function Lf(a, b, c) {
        c = ge(-1, c);
        c.tag = 3;
        var d = a.type.getDerivedStateFromError;
        if ("function" === typeof d) {
          var e = b.value;
          c.payload = function() {
            return d(e);
          };
          c.callback = function() {
            Gf(a, b);
          };
        }
        var f = a.stateNode;
        null !== f && "function" === typeof f.componentDidCatch && (c.callback = function() {
          Gf(a, b);
          "function" !== typeof d && (null === Mf ? Mf = /* @__PURE__ */ new Set([this]) : Mf.add(this));
          var c2 = b.stack;
          this.componentDidCatch(b.value, { componentStack: null !== c2 ? c2 : "" });
        });
        return c;
      }
      function Nf(a, b, c) {
        var d = a.pingCache;
        if (null === d) {
          d = a.pingCache = new Hf();
          var e = /* @__PURE__ */ new Set();
          d.set(b, e);
        } else e = d.get(b), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b, e));
        e.has(c) || (e.add(c), a = Of.bind(null, a, b, c), b.then(a, a));
      }
      function Pf(a) {
        do {
          var b;
          if (b = 13 === a.tag) b = a.memoizedState, b = null !== b ? null !== b.dehydrated ? true : false : true;
          if (b) return a;
          a = a.return;
        } while (null !== a);
        return null;
      }
      function Qf(a, b, c, d, e) {
        if (0 === (a.mode & 1)) return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b = ge(-1, 1), b.tag = 2, he(c, b, 1))), c.lanes |= 1), a;
        a.flags |= 65536;
        a.lanes = e;
        return a;
      }
      var Rf = da.ReactCurrentOwner, G = false;
      function P(a, b, c, d) {
        b.child = null === a ? Pd(b, null, c, d) : Od(b, a.child, c, d);
      }
      function Sf(a, b, c, d, e) {
        c = c.render;
        var f = b.ref;
        Yd(b, e);
        d = He(a, b, c, d, f, e);
        c = Me();
        if (null !== a && !G) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Tf(a, b, e);
        F && c && md(b);
        b.flags |= 1;
        P(a, b, d, e);
        return b.child;
      }
      function Uf(a, b, c, d, e) {
        if (null === a) {
          var f = c.type;
          if ("function" === typeof f && !Vf(f) && void 0 === f.defaultProps && null === c.compare && void 0 === c.defaultProps) return b.tag = 15, b.type = f, Wf(a, b, f, d, e);
          a = Ld(c.type, null, d, b, b.mode, e);
          a.ref = b.ref;
          a.return = b;
          return b.child = a;
        }
        f = a.child;
        if (0 === (a.lanes & e)) {
          var g = f.memoizedProps;
          c = c.compare;
          c = null !== c ? c : Dd;
          if (c(g, d) && a.ref === b.ref) return Tf(a, b, e);
        }
        b.flags |= 1;
        a = Jd(f, d);
        a.ref = b.ref;
        a.return = b;
        return b.child = a;
      }
      function Wf(a, b, c, d, e) {
        if (null !== a) {
          var f = a.memoizedProps;
          if (Dd(f, d) && a.ref === b.ref) if (G = false, b.pendingProps = d = f, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (G = true);
          else return b.lanes = a.lanes, Tf(a, b, e);
        }
        return Xf(a, b, c, d, e);
      }
      function Yf(a, b, c) {
        var d = b.pendingProps, e = d.children, f = null !== a ? a.memoizedState : null;
        if ("hidden" === d.mode) if (0 === (b.mode & 1)) b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, v(Zf, $f), $f |= c;
        else {
          if (0 === (c & 1073741824)) return a = null !== f ? f.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = { baseLanes: a, cachePool: null, transitions: null }, b.updateQueue = null, v(Zf, $f), $f |= a, null;
          b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
          d = null !== f ? f.baseLanes : c;
          v(Zf, $f);
          $f |= d;
        }
        else null !== f ? (d = f.baseLanes | c, b.memoizedState = null) : d = c, v(Zf, $f), $f |= d;
        P(a, b, e, c);
        return b.child;
      }
      function ag(a, b) {
        var c = b.ref;
        if (null === a && null !== c || null !== a && a.ref !== c) b.flags |= 512, b.flags |= 2097152;
      }
      function Xf(a, b, c, d, e) {
        var f = A(c) ? kc : x.current;
        f = mc(b, f);
        Yd(b, e);
        c = He(a, b, c, d, f, e);
        d = Me();
        if (null !== a && !G) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Tf(a, b, e);
        F && d && md(b);
        b.flags |= 1;
        P(a, b, c, e);
        return b.child;
      }
      function bg(a, b, c, d, e) {
        if (A(c)) {
          var f = true;
          qc(b);
        } else f = false;
        Yd(b, e);
        if (null === b.stateNode) cg(a, b), Bf(b, c, d), Df(b, c, d, e), d = true;
        else if (null === a) {
          var g = b.stateNode, h = b.memoizedProps;
          g.props = h;
          var k = g.context, l = c.contextType;
          "object" === typeof l && null !== l ? l = Zd(l) : (l = A(c) ? kc : x.current, l = mc(b, l));
          var m = c.getDerivedStateFromProps, r = "function" === typeof m || "function" === typeof g.getSnapshotBeforeUpdate;
          r || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== d || k !== l) && Cf(b, g, d, l);
          de = false;
          var p = b.memoizedState;
          g.state = p;
          ke(b, d, g, e);
          k = b.memoizedState;
          h !== d || p !== k || z.current || de ? ("function" === typeof m && (yf(b, c, m, d), k = b.memoizedState), (h = de || Af(b, c, h, d, p, k, l)) ? (r || "function" !== typeof g.UNSAFE_componentWillMount && "function" !== typeof g.componentWillMount || ("function" === typeof g.componentWillMount && g.componentWillMount(), "function" === typeof g.UNSAFE_componentWillMount && g.UNSAFE_componentWillMount()), "function" === typeof g.componentDidMount && (b.flags |= 4194308)) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k), g.props = d, g.state = k, g.context = l, d = h) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), d = false);
        } else {
          g = b.stateNode;
          fe(a, b);
          h = b.memoizedProps;
          l = b.type === b.elementType ? h : xf(b.type, h);
          g.props = l;
          r = b.pendingProps;
          p = g.context;
          k = c.contextType;
          "object" === typeof k && null !== k ? k = Zd(k) : (k = A(c) ? kc : x.current, k = mc(b, k));
          var B = c.getDerivedStateFromProps;
          (m = "function" === typeof B || "function" === typeof g.getSnapshotBeforeUpdate) || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== r || p !== k) && Cf(b, g, d, k);
          de = false;
          p = b.memoizedState;
          g.state = p;
          ke(b, d, g, e);
          var w = b.memoizedState;
          h !== r || p !== w || z.current || de ? ("function" === typeof B && (yf(b, c, B, d), w = b.memoizedState), (l = de || Af(b, c, l, d, p, w, k) || false) ? (m || "function" !== typeof g.UNSAFE_componentWillUpdate && "function" !== typeof g.componentWillUpdate || ("function" === typeof g.componentWillUpdate && g.componentWillUpdate(d, w, k), "function" === typeof g.UNSAFE_componentWillUpdate && g.UNSAFE_componentWillUpdate(d, w, k)), "function" === typeof g.componentDidUpdate && (b.flags |= 4), "function" === typeof g.getSnapshotBeforeUpdate && (b.flags |= 1024)) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = w), g.props = d, g.state = w, g.context = k, d = l) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && p === a.memoizedState || (b.flags |= 1024), d = false);
        }
        return dg(a, b, c, d, f, e);
      }
      function dg(a, b, c, d, e, f) {
        ag(a, b);
        var g = 0 !== (b.flags & 128);
        if (!d && !g) return e && rc(b, c, false), Tf(a, b, f);
        d = b.stateNode;
        Rf.current = b;
        var h = g && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
        b.flags |= 1;
        null !== a && g ? (b.child = Od(b, a.child, null, f), b.child = Od(b, null, h, f)) : P(a, b, h, f);
        b.memoizedState = d.state;
        e && rc(b, c, true);
        return b.child;
      }
      function eg(a) {
        var b = a.stateNode;
        b.pendingContext ? oc(a, b.pendingContext, b.pendingContext !== b.context) : b.context && oc(a, b.context, false);
        se(a, b.containerInfo);
      }
      function fg(a, b, c, d, e) {
        Ad();
        Bd(e);
        b.flags |= 256;
        P(a, b, c, d);
        return b.child;
      }
      var gg = { dehydrated: null, treeContext: null, retryLane: 0 };
      function hg(a) {
        return { baseLanes: a, cachePool: null, transitions: null };
      }
      function ig(a, b, c) {
        var d = b.pendingProps, e = I.current, f = false, g = 0 !== (b.flags & 128), h;
        (h = g) || (h = null !== a && null === a.memoizedState ? false : 0 !== (e & 2));
        if (h) f = true, b.flags &= -129;
        else if (null === a || null !== a.memoizedState) e |= 1;
        v(I, e & 1);
        if (null === a) {
          wd(b);
          a = b.memoizedState;
          if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b.mode & 1) ? b.lanes = 1 : Kb(a) ? b.lanes = 8 : b.lanes = 1073741824, null;
          g = d.children;
          a = d.fallback;
          return f ? (d = b.mode, f = b.child, g = { mode: "hidden", children: g }, 0 === (d & 1) && null !== f ? (f.childLanes = 0, f.pendingProps = g) : f = jg(g, d, 0, null), a = Nd(a, d, c, null), f.return = b, a.return = b, f.sibling = a, b.child = f, b.child.memoizedState = hg(c), b.memoizedState = gg, a) : kg(b, g);
        }
        e = a.memoizedState;
        if (null !== e && (h = e.dehydrated, null !== h)) return lg(a, b, g, d, h, e, c);
        if (f) {
          f = d.fallback;
          g = b.mode;
          e = a.child;
          h = e.sibling;
          var k = { mode: "hidden", children: d.children };
          0 === (g & 1) && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k, b.deletions = null) : (d = Jd(e, k), d.subtreeFlags = e.subtreeFlags & 14680064);
          null !== h ? f = Jd(h, f) : (f = Nd(f, g, c, null), f.flags |= 2);
          f.return = b;
          d.return = b;
          d.sibling = f;
          b.child = d;
          d = f;
          f = b.child;
          g = a.child.memoizedState;
          g = null === g ? hg(c) : { baseLanes: g.baseLanes | c, cachePool: null, transitions: g.transitions };
          f.memoizedState = g;
          f.childLanes = a.childLanes & ~c;
          b.memoizedState = gg;
          return d;
        }
        f = a.child;
        a = f.sibling;
        d = Jd(f, { mode: "visible", children: d.children });
        0 === (b.mode & 1) && (d.lanes = c);
        d.return = b;
        d.sibling = null;
        null !== a && (c = b.deletions, null === c ? (b.deletions = [a], b.flags |= 16) : c.push(a));
        b.child = d;
        b.memoizedState = null;
        return d;
      }
      function kg(a, b) {
        b = jg({ mode: "visible", children: b }, a.mode, 0, null);
        b.return = a;
        return a.child = b;
      }
      function mg(a, b, c, d) {
        null !== d && Bd(d);
        Od(b, a.child, null, c);
        a = kg(b, b.pendingProps.children);
        a.flags |= 2;
        b.memoizedState = null;
        return a;
      }
      function lg(a, b, c, d, e, f, g) {
        if (c) {
          if (b.flags & 256) return b.flags &= -257, d = Ff(Error(n(422))), mg(a, b, g, d);
          if (null !== b.memoizedState) return b.child = a.child, b.flags |= 128, null;
          f = d.fallback;
          e = b.mode;
          d = jg({ mode: "visible", children: d.children }, e, 0, null);
          f = Nd(f, e, g, null);
          f.flags |= 2;
          d.return = b;
          f.return = b;
          d.sibling = f;
          b.child = d;
          0 !== (b.mode & 1) && Od(b, a.child, null, g);
          b.child.memoizedState = hg(g);
          b.memoizedState = gg;
          return f;
        }
        if (0 === (b.mode & 1)) return mg(a, b, g, null);
        if (Kb(e)) return d = Lb(e).digest, f = Error(n(419)), d = Ff(
          f,
          d,
          void 0
        ), mg(a, b, g, d);
        c = 0 !== (g & a.childLanes);
        if (G || c) {
          d = N;
          if (null !== d) {
            switch (g & -g) {
              case 4:
                e = 2;
                break;
              case 16:
                e = 8;
                break;
              case 64:
              case 128:
              case 256:
              case 512:
              case 1024:
              case 2048:
              case 4096:
              case 8192:
              case 16384:
              case 32768:
              case 65536:
              case 131072:
              case 262144:
              case 524288:
              case 1048576:
              case 2097152:
              case 4194304:
              case 8388608:
              case 16777216:
              case 33554432:
              case 67108864:
                e = 32;
                break;
              case 536870912:
                e = 268435456;
                break;
              default:
                e = 0;
            }
            e = 0 !== (e & (d.suspendedLanes | g)) ? 0 : e;
            0 !== e && e !== f.retryLane && (f.retryLane = e, ce(a, e), af(
              d,
              a,
              e,
              -1
            ));
          }
          ng();
          d = Ff(Error(n(421)));
          return mg(a, b, g, d);
        }
        if (Jb(e)) return b.flags |= 128, b.child = a.child, b = og.bind(null, a), Mb(e, b), null;
        a = f.treeContext;
        Va && (pd = Qb(e), od = b, F = true, rd = null, qd = false, null !== a && (fd[gd++] = id, fd[gd++] = jd, fd[gd++] = hd, id = a.id, jd = a.overflow, hd = b));
        b = kg(b, d.children);
        b.flags |= 4096;
        return b;
      }
      function pg(a, b, c) {
        a.lanes |= b;
        var d = a.alternate;
        null !== d && (d.lanes |= b);
        Xd(a.return, b, c);
      }
      function qg(a, b, c, d, e) {
        var f = a.memoizedState;
        null === f ? a.memoizedState = { isBackwards: b, rendering: null, renderingStartTime: 0, last: d, tail: c, tailMode: e } : (f.isBackwards = b, f.rendering = null, f.renderingStartTime = 0, f.last = d, f.tail = c, f.tailMode = e);
      }
      function rg(a, b, c) {
        var d = b.pendingProps, e = d.revealOrder, f = d.tail;
        P(a, b, d.children, c);
        d = I.current;
        if (0 !== (d & 2)) d = d & 1 | 2, b.flags |= 128;
        else {
          if (null !== a && 0 !== (a.flags & 128)) a: for (a = b.child; null !== a; ) {
            if (13 === a.tag) null !== a.memoizedState && pg(a, c, b);
            else if (19 === a.tag) pg(a, c, b);
            else if (null !== a.child) {
              a.child.return = a;
              a = a.child;
              continue;
            }
            if (a === b) break a;
            for (; null === a.sibling; ) {
              if (null === a.return || a.return === b) break a;
              a = a.return;
            }
            a.sibling.return = a.return;
            a = a.sibling;
          }
          d &= 1;
        }
        v(I, d);
        if (0 === (b.mode & 1)) b.memoizedState = null;
        else switch (e) {
          case "forwards":
            c = b.child;
            for (e = null; null !== c; ) a = c.alternate, null !== a && null === we(a) && (e = c), c = c.sibling;
            c = e;
            null === c ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
            qg(b, false, e, c, f);
            break;
          case "backwards":
            c = null;
            e = b.child;
            for (b.child = null; null !== e; ) {
              a = e.alternate;
              if (null !== a && null === we(a)) {
                b.child = e;
                break;
              }
              a = e.sibling;
              e.sibling = c;
              c = e;
              e = a;
            }
            qg(b, true, c, null, f);
            break;
          case "together":
            qg(b, false, null, null, void 0);
            break;
          default:
            b.memoizedState = null;
        }
        return b.child;
      }
      function cg(a, b) {
        0 === (b.mode & 1) && null !== a && (a.alternate = null, b.alternate = null, b.flags |= 2);
      }
      function Tf(a, b, c) {
        null !== a && (b.dependencies = a.dependencies);
        le |= b.lanes;
        if (0 === (c & b.childLanes)) return null;
        if (null !== a && b.child !== a.child) throw Error(n(153));
        if (null !== b.child) {
          a = b.child;
          c = Jd(a, a.pendingProps);
          b.child = c;
          for (c.return = b; null !== a.sibling; ) a = a.sibling, c = c.sibling = Jd(a, a.pendingProps), c.return = b;
          c.sibling = null;
        }
        return b.child;
      }
      function sg(a, b, c) {
        switch (b.tag) {
          case 3:
            eg(b);
            Ad();
            break;
          case 5:
            ue(b);
            break;
          case 1:
            A(b.type) && qc(b);
            break;
          case 4:
            se(b, b.stateNode.containerInfo);
            break;
          case 10:
            Vd(b, b.type._context, b.memoizedProps.value);
            break;
          case 13:
            var d = b.memoizedState;
            if (null !== d) {
              if (null !== d.dehydrated) return v(I, I.current & 1), b.flags |= 128, null;
              if (0 !== (c & b.child.childLanes)) return ig(a, b, c);
              v(I, I.current & 1);
              a = Tf(a, b, c);
              return null !== a ? a.sibling : null;
            }
            v(I, I.current & 1);
            break;
          case 19:
            d = 0 !== (c & b.childLanes);
            if (0 !== (a.flags & 128)) {
              if (d) return rg(
                a,
                b,
                c
              );
              b.flags |= 128;
            }
            var e = b.memoizedState;
            null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
            v(I, I.current);
            if (d) break;
            else return null;
          case 22:
          case 23:
            return b.lanes = 0, Yf(a, b, c);
        }
        return Tf(a, b, c);
      }
      function tg(a) {
        a.flags |= 4;
      }
      function ug(a, b) {
        if (null !== a && a.child === b.child) return true;
        if (0 !== (b.flags & 16)) return false;
        for (a = b.child; null !== a; ) {
          if (0 !== (a.flags & 12854) || 0 !== (a.subtreeFlags & 12854)) return false;
          a = a.sibling;
        }
        return true;
      }
      var vg, wg, xg, yg;
      if (Ta) vg = function(a, b) {
        for (var c = b.child; null !== c; ) {
          if (5 === c.tag || 6 === c.tag) Ka(a, c.stateNode);
          else if (4 !== c.tag && null !== c.child) {
            c.child.return = c;
            c = c.child;
            continue;
          }
          if (c === b) break;
          for (; null === c.sibling; ) {
            if (null === c.return || c.return === b) return;
            c = c.return;
          }
          c.sibling.return = c.return;
          c = c.sibling;
        }
      }, wg = function() {
      }, xg = function(a, b, c, d, e) {
        a = a.memoizedProps;
        if (a !== d) {
          var f = b.stateNode, g = re(oe.current);
          c = Ma(f, c, a, d, e, g);
          (b.updateQueue = c) && tg(b);
        }
      }, yg = function(a, b, c, d) {
        c !== d && tg(b);
      };
      else if (Ua) {
        vg = function(a, b, c, d) {
          for (var e = b.child; null !== e; ) {
            if (5 === e.tag) {
              var f = e.stateNode;
              c && d && (f = Eb(f, e.type, e.memoizedProps, e));
              Ka(a, f);
            } else if (6 === e.tag) f = e.stateNode, c && d && (f = Fb(f, e.memoizedProps, e)), Ka(a, f);
            else if (4 !== e.tag) {
              if (22 === e.tag && null !== e.memoizedState) f = e.child, null !== f && (f.return = e), vg(a, e, true, true);
              else if (null !== e.child) {
                e.child.return = e;
                e = e.child;
                continue;
              }
            }
            if (e === b) break;
            for (; null === e.sibling; ) {
              if (null === e.return || e.return === b) return;
              e = e.return;
            }
            e.sibling.return = e.return;
            e = e.sibling;
          }
        };
        var zg = function(a, b, c, d) {
          for (var e = b.child; null !== e; ) {
            if (5 === e.tag) {
              var f = e.stateNode;
              c && d && (f = Eb(f, e.type, e.memoizedProps, e));
              Ab(a, f);
            } else if (6 === e.tag) f = e.stateNode, c && d && (f = Fb(f, e.memoizedProps, e)), Ab(a, f);
            else if (4 !== e.tag) {
              if (22 === e.tag && null !== e.memoizedState) f = e.child, null !== f && (f.return = e), zg(a, e, true, true);
              else if (null !== e.child) {
                e.child.return = e;
                e = e.child;
                continue;
              }
            }
            if (e === b) break;
            for (; null === e.sibling; ) {
              if (null === e.return || e.return === b) return;
              e = e.return;
            }
            e.sibling.return = e.return;
            e = e.sibling;
          }
        };
        wg = function(a, b) {
          var c = b.stateNode;
          if (!ug(a, b)) {
            a = c.containerInfo;
            var d = zb(a);
            zg(d, b, false, false);
            c.pendingChildren = d;
            tg(b);
            Bb(a, d);
          }
        };
        xg = function(a, b, c, d, e) {
          var f = a.stateNode, g = a.memoizedProps;
          if ((a = ug(a, b)) && g === d) b.stateNode = f;
          else {
            var h = b.stateNode, k = re(oe.current), l = null;
            g !== d && (l = Ma(h, c, g, d, e, k));
            a && null === l ? b.stateNode = f : (f = yb(f, l, c, g, d, b, a, h), La(f, c, d, e, k) && tg(b), b.stateNode = f, a ? tg(b) : vg(f, b, false, false));
          }
        };
        yg = function(a, b, c, d) {
          c !== d ? (a = re(qe.current), c = re(oe.current), b.stateNode = Oa(d, a, c, b), tg(b)) : b.stateNode = a.stateNode;
        };
      } else wg = function() {
      }, xg = function() {
      }, yg = function() {
      };
      function Ag(a, b) {
        if (!F) switch (a.tailMode) {
          case "hidden":
            b = a.tail;
            for (var c = null; null !== b; ) null !== b.alternate && (c = b), b = b.sibling;
            null === c ? a.tail = null : c.sibling = null;
            break;
          case "collapsed":
            c = a.tail;
            for (var d = null; null !== c; ) null !== c.alternate && (d = c), c = c.sibling;
            null === d ? b || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
        }
      }
      function Q(a) {
        var b = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
        if (b) for (var e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
        else for (e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
        a.subtreeFlags |= d;
        a.childLanes = c;
        return b;
      }
      function Bg(a, b, c) {
        var d = b.pendingProps;
        nd(b);
        switch (b.tag) {
          case 2:
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return Q(b), null;
          case 1:
            return A(b.type) && nc(), Q(b), null;
          case 3:
            c = b.stateNode;
            te();
            q(z);
            q(x);
            ye();
            c.pendingContext && (c.context = c.pendingContext, c.pendingContext = null);
            if (null === a || null === a.child) yd(b) ? tg(b) : null === a || a.memoizedState.isDehydrated && 0 === (b.flags & 256) || (b.flags |= 1024, null !== rd && (Cg(rd), rd = null));
            wg(a, b);
            Q(b);
            return null;
          case 5:
            ve(b);
            c = re(qe.current);
            var e = b.type;
            if (null !== a && null != b.stateNode) xg(a, b, e, d, c), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
            else {
              if (!d) {
                if (null === b.stateNode) throw Error(n(166));
                Q(b);
                return null;
              }
              a = re(oe.current);
              if (yd(b)) {
                if (!Va) throw Error(n(175));
                a = Rb(b.stateNode, b.type, b.memoizedProps, c, a, b, !qd);
                b.updateQueue = a;
                null !== a && tg(b);
              } else {
                var f = Ja(e, d, c, a, b);
                vg(f, b, false, false);
                b.stateNode = f;
                La(f, e, d, c, a) && tg(b);
              }
              null !== b.ref && (b.flags |= 512, b.flags |= 2097152);
            }
            Q(b);
            return null;
          case 6:
            if (a && null != b.stateNode) yg(a, b, a.memoizedProps, d);
            else {
              if ("string" !== typeof d && null === b.stateNode) throw Error(n(166));
              a = re(qe.current);
              c = re(oe.current);
              if (yd(b)) {
                if (!Va) throw Error(n(176));
                a = b.stateNode;
                c = b.memoizedProps;
                if (d = Sb(a, c, b, !qd)) {
                  if (e = od, null !== e) switch (e.tag) {
                    case 3:
                      $b(e.stateNode.containerInfo, a, c, 0 !== (e.mode & 1));
                      break;
                    case 5:
                      ac(e.type, e.memoizedProps, e.stateNode, a, c, 0 !== (e.mode & 1));
                  }
                }
                d && tg(b);
              } else b.stateNode = Oa(d, a, c, b);
            }
            Q(b);
            return null;
          case 13:
            q(I);
            d = b.memoizedState;
            if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
              if (F && null !== pd && 0 !== (b.mode & 1) && 0 === (b.flags & 128)) zd(), Ad(), b.flags |= 98560, e = false;
              else if (e = yd(b), null !== d && null !== d.dehydrated) {
                if (null === a) {
                  if (!e) throw Error(n(318));
                  if (!Va) throw Error(n(344));
                  e = b.memoizedState;
                  e = null !== e ? e.dehydrated : null;
                  if (!e) throw Error(n(317));
                  Tb(e, b);
                } else Ad(), 0 === (b.flags & 128) && (b.memoizedState = null), b.flags |= 4;
                Q(b);
                e = false;
              } else null !== rd && (Cg(rd), rd = null), e = true;
              if (!e) return b.flags & 65536 ? b : null;
            }
            if (0 !== (b.flags & 128)) return b.lanes = c, b;
            c = null !== d;
            c !== (null !== a && null !== a.memoizedState) && c && (b.child.flags |= 8192, 0 !== (b.mode & 1) && (null === a || 0 !== (I.current & 1) ? 0 === R && (R = 3) : ng()));
            null !== b.updateQueue && (b.flags |= 4);
            Q(b);
            return null;
          case 4:
            return te(), wg(a, b), null === a && Xa(b.stateNode.containerInfo), Q(b), null;
          case 10:
            return Wd(b.type._context), Q(b), null;
          case 17:
            return A(b.type) && nc(), Q(b), null;
          case 19:
            q(I);
            e = b.memoizedState;
            if (null === e) return Q(b), null;
            d = 0 !== (b.flags & 128);
            f = e.rendering;
            if (null === f) if (d) Ag(e, false);
            else {
              if (0 !== R || null !== a && 0 !== (a.flags & 128)) for (a = b.child; null !== a; ) {
                f = we(a);
                if (null !== f) {
                  b.flags |= 128;
                  Ag(e, false);
                  a = f.updateQueue;
                  null !== a && (b.updateQueue = a, b.flags |= 4);
                  b.subtreeFlags = 0;
                  a = c;
                  for (c = b.child; null !== c; ) d = c, e = a, d.flags &= 14680066, f = d.alternate, null === f ? (d.childLanes = 0, d.lanes = e, d.child = null, d.subtreeFlags = 0, d.memoizedProps = null, d.memoizedState = null, d.updateQueue = null, d.dependencies = null, d.stateNode = null) : (d.childLanes = f.childLanes, d.lanes = f.lanes, d.child = f.child, d.subtreeFlags = 0, d.deletions = null, d.memoizedProps = f.memoizedProps, d.memoizedState = f.memoizedState, d.updateQueue = f.updateQueue, d.type = f.type, e = f.dependencies, d.dependencies = null === e ? null : { lanes: e.lanes, firstContext: e.firstContext }), c = c.sibling;
                  v(I, I.current & 1 | 2);
                  return b.child;
                }
                a = a.sibling;
              }
              null !== e.tail && D() > Dg && (b.flags |= 128, d = true, Ag(e, false), b.lanes = 4194304);
            }
            else {
              if (!d) if (a = we(f), null !== a) {
                if (b.flags |= 128, d = true, a = a.updateQueue, null !== a && (b.updateQueue = a, b.flags |= 4), Ag(e, true), null === e.tail && "hidden" === e.tailMode && !f.alternate && !F) return Q(b), null;
              } else 2 * D() - e.renderingStartTime > Dg && 1073741824 !== c && (b.flags |= 128, d = true, Ag(e, false), b.lanes = 4194304);
              e.isBackwards ? (f.sibling = b.child, b.child = f) : (a = e.last, null !== a ? a.sibling = f : b.child = f, e.last = f);
            }
            if (null !== e.tail) return b = e.tail, e.rendering = b, e.tail = b.sibling, e.renderingStartTime = D(), b.sibling = null, a = I.current, v(I, d ? a & 1 | 2 : a & 1), b;
            Q(b);
            return null;
          case 22:
          case 23:
            return Eg(), c = null !== b.memoizedState, null !== a && null !== a.memoizedState !== c && (b.flags |= 8192), c && 0 !== (b.mode & 1) ? 0 !== ($f & 1073741824) && (Q(b), Ta && b.subtreeFlags & 6 && (b.flags |= 8192)) : Q(b), null;
          case 24:
            return null;
          case 25:
            return null;
        }
        throw Error(n(
          156,
          b.tag
        ));
      }
      function Fg(a, b) {
        nd(b);
        switch (b.tag) {
          case 1:
            return A(b.type) && nc(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
          case 3:
            return te(), q(z), q(x), ye(), a = b.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b.flags = a & -65537 | 128, b) : null;
          case 5:
            return ve(b), null;
          case 13:
            q(I);
            a = b.memoizedState;
            if (null !== a && null !== a.dehydrated) {
              if (null === b.alternate) throw Error(n(340));
              Ad();
            }
            a = b.flags;
            return a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
          case 19:
            return q(I), null;
          case 4:
            return te(), null;
          case 10:
            return Wd(b.type._context), null;
          case 22:
          case 23:
            return Eg(), null;
          case 24:
            return null;
          default:
            return null;
        }
      }
      var Gg = false, S = false, Hg = "function" === typeof WeakSet ? WeakSet : Set, T = null;
      function Ig(a, b) {
        var c = a.ref;
        if (null !== c) if ("function" === typeof c) try {
          c(null);
        } catch (d) {
          U(a, b, d);
        }
        else c.current = null;
      }
      function Jg(a, b, c) {
        try {
          c();
        } catch (d) {
          U(a, b, d);
        }
      }
      var Kg = false;
      function Lg(a, b) {
        Ha(a.containerInfo);
        for (T = b; null !== T; ) if (a = T, b = a.child, 0 !== (a.subtreeFlags & 1028) && null !== b) b.return = a, T = b;
        else for (; null !== T; ) {
          a = T;
          try {
            var c = a.alternate;
            if (0 !== (a.flags & 1024)) switch (a.tag) {
              case 0:
              case 11:
              case 15:
                break;
              case 1:
                if (null !== c) {
                  var d = c.memoizedProps, e = c.memoizedState, f = a.stateNode, g = f.getSnapshotBeforeUpdate(a.elementType === a.type ? d : xf(a.type, d), e);
                  f.__reactInternalSnapshotBeforeUpdate = g;
                }
                break;
              case 3:
                Ta && xb(a.stateNode.containerInfo);
                break;
              case 5:
              case 6:
              case 4:
              case 17:
                break;
              default:
                throw Error(n(163));
            }
          } catch (h) {
            U(a, a.return, h);
          }
          b = a.sibling;
          if (null !== b) {
            b.return = a.return;
            T = b;
            break;
          }
          T = a.return;
        }
        c = Kg;
        Kg = false;
        return c;
      }
      function Mg(a, b, c) {
        var d = b.updateQueue;
        d = null !== d ? d.lastEffect : null;
        if (null !== d) {
          var e = d = d.next;
          do {
            if ((e.tag & a) === a) {
              var f = e.destroy;
              e.destroy = void 0;
              void 0 !== f && Jg(b, c, f);
            }
            e = e.next;
          } while (e !== d);
        }
      }
      function Ng(a, b) {
        b = b.updateQueue;
        b = null !== b ? b.lastEffect : null;
        if (null !== b) {
          var c = b = b.next;
          do {
            if ((c.tag & a) === a) {
              var d = c.create;
              c.destroy = d();
            }
            c = c.next;
          } while (c !== b);
        }
      }
      function Og(a) {
        var b = a.ref;
        if (null !== b) {
          var c = a.stateNode;
          switch (a.tag) {
            case 5:
              a = Ea(c);
              break;
            default:
              a = c;
          }
          "function" === typeof b ? b(a) : b.current = a;
        }
      }
      function Pg(a) {
        var b = a.alternate;
        null !== b && (a.alternate = null, Pg(b));
        a.child = null;
        a.deletions = null;
        a.sibling = null;
        5 === a.tag && (b = a.stateNode, null !== b && Za(b));
        a.stateNode = null;
        a.return = null;
        a.dependencies = null;
        a.memoizedProps = null;
        a.memoizedState = null;
        a.pendingProps = null;
        a.stateNode = null;
        a.updateQueue = null;
      }
      function Qg(a) {
        return 5 === a.tag || 3 === a.tag || 4 === a.tag;
      }
      function Rg(a) {
        a: for (; ; ) {
          for (; null === a.sibling; ) {
            if (null === a.return || Qg(a.return)) return null;
            a = a.return;
          }
          a.sibling.return = a.return;
          for (a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag; ) {
            if (a.flags & 2) continue a;
            if (null === a.child || 4 === a.tag) continue a;
            else a.child.return = a, a = a.child;
          }
          if (!(a.flags & 2)) return a.stateNode;
        }
      }
      function Sg(a, b, c) {
        var d = a.tag;
        if (5 === d || 6 === d) a = a.stateNode, b ? pb(c, a, b) : kb(c, a);
        else if (4 !== d && (a = a.child, null !== a)) for (Sg(a, b, c), a = a.sibling; null !== a; ) Sg(a, b, c), a = a.sibling;
      }
      function Tg(a, b, c) {
        var d = a.tag;
        if (5 === d || 6 === d) a = a.stateNode, b ? ob(c, a, b) : jb(c, a);
        else if (4 !== d && (a = a.child, null !== a)) for (Tg(a, b, c), a = a.sibling; null !== a; ) Tg(a, b, c), a = a.sibling;
      }
      var V = null, Ug = false;
      function Vg(a, b, c) {
        for (c = c.child; null !== c; ) Wg(a, b, c), c = c.sibling;
      }
      function Wg(a, b, c) {
        if (Sc && "function" === typeof Sc.onCommitFiberUnmount) try {
          Sc.onCommitFiberUnmount(Rc, c);
        } catch (h) {
        }
        switch (c.tag) {
          case 5:
            S || Ig(c, b);
          case 6:
            if (Ta) {
              var d = V, e = Ug;
              V = null;
              Vg(a, b, c);
              V = d;
              Ug = e;
              null !== V && (Ug ? rb(V, c.stateNode) : qb(V, c.stateNode));
            } else Vg(a, b, c);
            break;
          case 18:
            Ta && null !== V && (Ug ? Yb(V, c.stateNode) : Xb(V, c.stateNode));
            break;
          case 4:
            Ta ? (d = V, e = Ug, V = c.stateNode.containerInfo, Ug = true, Vg(a, b, c), V = d, Ug = e) : (Ua && (d = c.stateNode.containerInfo, e = zb(d), Cb(d, e)), Vg(a, b, c));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            if (!S && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
              e = d = d.next;
              do {
                var f = e, g = f.destroy;
                f = f.tag;
                void 0 !== g && (0 !== (f & 2) ? Jg(c, b, g) : 0 !== (f & 4) && Jg(c, b, g));
                e = e.next;
              } while (e !== d);
            }
            Vg(a, b, c);
            break;
          case 1:
            if (!S && (Ig(c, b), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
              d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
            } catch (h) {
              U(c, b, h);
            }
            Vg(a, b, c);
            break;
          case 21:
            Vg(a, b, c);
            break;
          case 22:
            c.mode & 1 ? (S = (d = S) || null !== c.memoizedState, Vg(a, b, c), S = d) : Vg(a, b, c);
            break;
          default:
            Vg(
              a,
              b,
              c
            );
        }
      }
      function Xg(a) {
        var b = a.updateQueue;
        if (null !== b) {
          a.updateQueue = null;
          var c = a.stateNode;
          null === c && (c = a.stateNode = new Hg());
          b.forEach(function(b2) {
            var d = Yg.bind(null, a, b2);
            c.has(b2) || (c.add(b2), b2.then(d, d));
          });
        }
      }
      function Zg(a, b) {
        var c = b.deletions;
        if (null !== c) for (var d = 0; d < c.length; d++) {
          var e = c[d];
          try {
            var f = a, g = b;
            if (Ta) {
              var h = g;
              a: for (; null !== h; ) {
                switch (h.tag) {
                  case 5:
                    V = h.stateNode;
                    Ug = false;
                    break a;
                  case 3:
                    V = h.stateNode.containerInfo;
                    Ug = true;
                    break a;
                  case 4:
                    V = h.stateNode.containerInfo;
                    Ug = true;
                    break a;
                }
                h = h.return;
              }
              if (null === V) throw Error(n(160));
              Wg(f, g, e);
              V = null;
              Ug = false;
            } else Wg(f, g, e);
            var k = e.alternate;
            null !== k && (k.return = null);
            e.return = null;
          } catch (l) {
            U(e, b, l);
          }
        }
        if (b.subtreeFlags & 12854) for (b = b.child; null !== b; ) $g(b, a), b = b.sibling;
      }
      function $g(a, b) {
        var c = a.alternate, d = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            Zg(b, a);
            ah(a);
            if (d & 4) {
              try {
                Mg(3, a, a.return), Ng(3, a);
              } catch (p) {
                U(a, a.return, p);
              }
              try {
                Mg(5, a, a.return);
              } catch (p) {
                U(a, a.return, p);
              }
            }
            break;
          case 1:
            Zg(b, a);
            ah(a);
            d & 512 && null !== c && Ig(c, c.return);
            break;
          case 5:
            Zg(b, a);
            ah(a);
            d & 512 && null !== c && Ig(c, c.return);
            if (Ta) {
              if (a.flags & 32) {
                var e = a.stateNode;
                try {
                  sb(e);
                } catch (p) {
                  U(a, a.return, p);
                }
              }
              if (d & 4 && (e = a.stateNode, null != e)) {
                var f = a.memoizedProps;
                c = null !== c ? c.memoizedProps : f;
                d = a.type;
                b = a.updateQueue;
                a.updateQueue = null;
                if (null !== b) try {
                  nb(e, b, d, c, f, a);
                } catch (p) {
                  U(a, a.return, p);
                }
              }
            }
            break;
          case 6:
            Zg(b, a);
            ah(a);
            if (d & 4 && Ta) {
              if (null === a.stateNode) throw Error(n(162));
              e = a.stateNode;
              f = a.memoizedProps;
              c = null !== c ? c.memoizedProps : f;
              try {
                lb(e, c, f);
              } catch (p) {
                U(a, a.return, p);
              }
            }
            break;
          case 3:
            Zg(b, a);
            ah(a);
            if (d & 4) {
              if (Ta && Va && null !== c && c.memoizedState.isDehydrated) try {
                Vb(b.containerInfo);
              } catch (p) {
                U(a, a.return, p);
              }
              if (Ua) {
                e = b.containerInfo;
                f = b.pendingChildren;
                try {
                  Cb(e, f);
                } catch (p) {
                  U(a, a.return, p);
                }
              }
            }
            break;
          case 4:
            Zg(
              b,
              a
            );
            ah(a);
            if (d & 4 && Ua) {
              f = a.stateNode;
              e = f.containerInfo;
              f = f.pendingChildren;
              try {
                Cb(e, f);
              } catch (p) {
                U(a, a.return, p);
              }
            }
            break;
          case 13:
            Zg(b, a);
            ah(a);
            e = a.child;
            e.flags & 8192 && (f = null !== e.memoizedState, e.stateNode.isHidden = f, !f || null !== e.alternate && null !== e.alternate.memoizedState || (bh = D()));
            d & 4 && Xg(a);
            break;
          case 22:
            var g = null !== c && null !== c.memoizedState;
            a.mode & 1 ? (S = (c = S) || g, Zg(b, a), S = c) : Zg(b, a);
            ah(a);
            if (d & 8192) {
              c = null !== a.memoizedState;
              if ((a.stateNode.isHidden = c) && !g && 0 !== (a.mode & 1)) for (T = a, d = a.child; null !== d; ) {
                for (b = T = d; null !== T; ) {
                  g = T;
                  var h = g.child;
                  switch (g.tag) {
                    case 0:
                    case 11:
                    case 14:
                    case 15:
                      Mg(4, g, g.return);
                      break;
                    case 1:
                      Ig(g, g.return);
                      var k = g.stateNode;
                      if ("function" === typeof k.componentWillUnmount) {
                        var l = g, m = g.return;
                        try {
                          var r = l;
                          k.props = r.memoizedProps;
                          k.state = r.memoizedState;
                          k.componentWillUnmount();
                        } catch (p) {
                          U(l, m, p);
                        }
                      }
                      break;
                    case 5:
                      Ig(g, g.return);
                      break;
                    case 22:
                      if (null !== g.memoizedState) {
                        ch(b);
                        continue;
                      }
                  }
                  null !== h ? (h.return = g, T = h) : ch(b);
                }
                d = d.sibling;
              }
              if (Ta) {
                a: if (d = null, Ta) for (b = a; ; ) {
                  if (5 === b.tag) {
                    if (null === d) {
                      d = b;
                      try {
                        e = b.stateNode, c ? tb(e) : vb(b.stateNode, b.memoizedProps);
                      } catch (p) {
                        U(a, a.return, p);
                      }
                    }
                  } else if (6 === b.tag) {
                    if (null === d) try {
                      f = b.stateNode, c ? ub(f) : wb(f, b.memoizedProps);
                    } catch (p) {
                      U(a, a.return, p);
                    }
                  } else if ((22 !== b.tag && 23 !== b.tag || null === b.memoizedState || b === a) && null !== b.child) {
                    b.child.return = b;
                    b = b.child;
                    continue;
                  }
                  if (b === a) break a;
                  for (; null === b.sibling; ) {
                    if (null === b.return || b.return === a) break a;
                    d === b && (d = null);
                    b = b.return;
                  }
                  d === b && (d = null);
                  b.sibling.return = b.return;
                  b = b.sibling;
                }
              }
            }
            break;
          case 19:
            Zg(b, a);
            ah(a);
            d & 4 && Xg(a);
            break;
          case 21:
            break;
          default:
            Zg(b, a), ah(a);
        }
      }
      function ah(a) {
        var b = a.flags;
        if (b & 2) {
          try {
            if (Ta) {
              b: {
                for (var c = a.return; null !== c; ) {
                  if (Qg(c)) {
                    var d = c;
                    break b;
                  }
                  c = c.return;
                }
                throw Error(n(160));
              }
              switch (d.tag) {
                case 5:
                  var e = d.stateNode;
                  d.flags & 32 && (sb(e), d.flags &= -33);
                  var f = Rg(a);
                  Tg(a, f, e);
                  break;
                case 3:
                case 4:
                  var g = d.stateNode.containerInfo, h = Rg(a);
                  Sg(a, h, g);
                  break;
                default:
                  throw Error(n(161));
              }
            }
          } catch (k) {
            U(a, a.return, k);
          }
          a.flags &= -3;
        }
        b & 4096 && (a.flags &= -4097);
      }
      function dh(a, b, c) {
        T = a;
        eh(a, b, c);
      }
      function eh(a, b, c) {
        for (var d = 0 !== (a.mode & 1); null !== T; ) {
          var e = T, f = e.child;
          if (22 === e.tag && d) {
            var g = null !== e.memoizedState || Gg;
            if (!g) {
              var h = e.alternate, k = null !== h && null !== h.memoizedState || S;
              h = Gg;
              var l = S;
              Gg = g;
              if ((S = k) && !l) for (T = e; null !== T; ) g = T, k = g.child, 22 === g.tag && null !== g.memoizedState ? fh(e) : null !== k ? (k.return = g, T = k) : fh(e);
              for (; null !== f; ) T = f, eh(f, b, c), f = f.sibling;
              T = e;
              Gg = h;
              S = l;
            }
            gh(a, b, c);
          } else 0 !== (e.subtreeFlags & 8772) && null !== f ? (f.return = e, T = f) : gh(a, b, c);
        }
      }
      function gh(a) {
        for (; null !== T; ) {
          var b = T;
          if (0 !== (b.flags & 8772)) {
            var c = b.alternate;
            try {
              if (0 !== (b.flags & 8772)) switch (b.tag) {
                case 0:
                case 11:
                case 15:
                  S || Ng(5, b);
                  break;
                case 1:
                  var d = b.stateNode;
                  if (b.flags & 4 && !S) if (null === c) d.componentDidMount();
                  else {
                    var e = b.elementType === b.type ? c.memoizedProps : xf(b.type, c.memoizedProps);
                    d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
                  }
                  var f = b.updateQueue;
                  null !== f && me(b, f, d);
                  break;
                case 3:
                  var g = b.updateQueue;
                  if (null !== g) {
                    c = null;
                    if (null !== b.child) switch (b.child.tag) {
                      case 5:
                        c = Ea(b.child.stateNode);
                        break;
                      case 1:
                        c = b.child.stateNode;
                    }
                    me(b, g, c);
                  }
                  break;
                case 5:
                  var h = b.stateNode;
                  null === c && b.flags & 4 && mb(h, b.type, b.memoizedProps, b);
                  break;
                case 6:
                  break;
                case 4:
                  break;
                case 12:
                  break;
                case 13:
                  if (Va && null === b.memoizedState) {
                    var k = b.alternate;
                    if (null !== k) {
                      var l = k.memoizedState;
                      if (null !== l) {
                        var m = l.dehydrated;
                        null !== m && Wb(m);
                      }
                    }
                  }
                  break;
                case 19:
                case 17:
                case 21:
                case 22:
                case 23:
                case 25:
                  break;
                default:
                  throw Error(n(163));
              }
              S || b.flags & 512 && Og(b);
            } catch (r) {
              U(b, b.return, r);
            }
          }
          if (b === a) {
            T = null;
            break;
          }
          c = b.sibling;
          if (null !== c) {
            c.return = b.return;
            T = c;
            break;
          }
          T = b.return;
        }
      }
      function ch(a) {
        for (; null !== T; ) {
          var b = T;
          if (b === a) {
            T = null;
            break;
          }
          var c = b.sibling;
          if (null !== c) {
            c.return = b.return;
            T = c;
            break;
          }
          T = b.return;
        }
      }
      function fh(a) {
        for (; null !== T; ) {
          var b = T;
          try {
            switch (b.tag) {
              case 0:
              case 11:
              case 15:
                var c = b.return;
                try {
                  Ng(4, b);
                } catch (k) {
                  U(b, c, k);
                }
                break;
              case 1:
                var d = b.stateNode;
                if ("function" === typeof d.componentDidMount) {
                  var e = b.return;
                  try {
                    d.componentDidMount();
                  } catch (k) {
                    U(b, e, k);
                  }
                }
                var f = b.return;
                try {
                  Og(b);
                } catch (k) {
                  U(b, f, k);
                }
                break;
              case 5:
                var g = b.return;
                try {
                  Og(b);
                } catch (k) {
                  U(b, g, k);
                }
            }
          } catch (k) {
            U(b, b.return, k);
          }
          if (b === a) {
            T = null;
            break;
          }
          var h = b.sibling;
          if (null !== h) {
            h.return = b.return;
            T = h;
            break;
          }
          T = b.return;
        }
      }
      var hh = 0, ih = 1, jh = 2, kh = 3, lh = 4;
      if ("function" === typeof Symbol && Symbol.for) {
        var mh = Symbol.for;
        hh = mh("selector.component");
        ih = mh("selector.has_pseudo_class");
        jh = mh("selector.role");
        kh = mh("selector.test_id");
        lh = mh("selector.text");
      }
      function nh(a) {
        var b = Wa(a);
        if (null != b) {
          if ("string" !== typeof b.memoizedProps["data-testname"]) throw Error(n(364));
          return b;
        }
        a = cb(a);
        if (null === a) throw Error(n(362));
        return a.stateNode.current;
      }
      function oh(a, b) {
        switch (b.$$typeof) {
          case hh:
            if (a.type === b.value) return true;
            break;
          case ih:
            a: {
              b = b.value;
              a = [a, 0];
              for (var c = 0; c < a.length; ) {
                var d = a[c++], e = a[c++], f = b[e];
                if (5 !== d.tag || !fb(d)) {
                  for (; null != f && oh(d, f); ) e++, f = b[e];
                  if (e === b.length) {
                    b = true;
                    break a;
                  } else for (d = d.child; null !== d; ) a.push(d, e), d = d.sibling;
                }
              }
              b = false;
            }
            return b;
          case jh:
            if (5 === a.tag && gb(a.stateNode, b.value)) return true;
            break;
          case lh:
            if (5 === a.tag || 6 === a.tag) {
              if (a = eb(a), null !== a && 0 <= a.indexOf(b.value)) return true;
            }
            break;
          case kh:
            if (5 === a.tag && (a = a.memoizedProps["data-testname"], "string" === typeof a && a.toLowerCase() === b.value.toLowerCase())) return true;
            break;
          default:
            throw Error(n(365));
        }
        return false;
      }
      function ph(a) {
        switch (a.$$typeof) {
          case hh:
            return "<" + (ua(a.value) || "Unknown") + ">";
          case ih:
            return ":has(" + (ph(a) || "") + ")";
          case jh:
            return '[role="' + a.value + '"]';
          case lh:
            return '"' + a.value + '"';
          case kh:
            return '[data-testname="' + a.value + '"]';
          default:
            throw Error(n(365));
        }
      }
      function qh(a, b) {
        var c = [];
        a = [a, 0];
        for (var d = 0; d < a.length; ) {
          var e = a[d++], f = a[d++], g = b[f];
          if (5 !== e.tag || !fb(e)) {
            for (; null != g && oh(e, g); ) f++, g = b[f];
            if (f === b.length) c.push(e);
            else for (e = e.child; null !== e; ) a.push(e, f), e = e.sibling;
          }
        }
        return c;
      }
      function rh(a, b) {
        if (!bb) throw Error(n(363));
        a = nh(a);
        a = qh(a, b);
        b = [];
        a = Array.from(a);
        for (var c = 0; c < a.length; ) {
          var d = a[c++];
          if (5 === d.tag) fb(d) || b.push(d.stateNode);
          else for (d = d.child; null !== d; ) a.push(d), d = d.sibling;
        }
        return b;
      }
      var sh = Math.ceil, th = da.ReactCurrentDispatcher, uh = da.ReactCurrentOwner, W = da.ReactCurrentBatchConfig, H = 0, N = null, X = null, Z = 0, $f = 0, Zf = ic(0), R = 0, vh = null, le = 0, wh = 0, xh = 0, yh = null, zh = null, bh = 0, Dg = Infinity, Ah = null;
      function Bh() {
        Dg = D() + 500;
      }
      var Jf = false, Kf = null, Mf = null, Ch = false, Dh = null, Eh = 0, Fh = 0, Gh = null, Hh = -1, Ih = 0;
      function O() {
        return 0 !== (H & 6) ? D() : -1 !== Hh ? Hh : Hh = D();
      }
      function tf(a) {
        if (0 === (a.mode & 1)) return 1;
        if (0 !== (H & 2) && 0 !== Z) return Z & -Z;
        if (null !== Cd.transition) return 0 === Ih && (Ih = Dc()), Ih;
        a = C;
        return 0 !== a ? a : Ya();
      }
      function af(a, b, c, d) {
        if (50 < Fh) throw Fh = 0, Gh = null, Error(n(185));
        Fc(a, c, d);
        if (0 === (H & 2) || a !== N) a === N && (0 === (H & 2) && (wh |= c), 4 === R && Jh(a, Z)), Kh(a, d), 1 === c && 0 === H && 0 === (b.mode & 1) && (Bh(), Xc && ad());
      }
      function Kh(a, b) {
        var c = a.callbackNode;
        Bc(a, b);
        var d = zc(a, a === N ? Z : 0);
        if (0 === d) null !== c && Kc(c), a.callbackNode = null, a.callbackPriority = 0;
        else if (b = d & -d, a.callbackPriority !== b) {
          null != c && Kc(c);
          if (1 === b) 0 === a.tag ? $c(Lh.bind(null, a)) : Zc(Lh.bind(null, a)), $a ? ab(function() {
            0 === (H & 6) && ad();
          }) : Jc(Nc, ad), c = null;
          else {
            switch (Ic(d)) {
              case 1:
                c = Nc;
                break;
              case 4:
                c = Oc;
                break;
              case 16:
                c = Pc;
                break;
              case 536870912:
                c = Qc;
                break;
              default:
                c = Pc;
            }
            c = Mh(c, Nh.bind(null, a));
          }
          a.callbackPriority = b;
          a.callbackNode = c;
        }
      }
      function Nh(a, b) {
        Hh = -1;
        Ih = 0;
        if (0 !== (H & 6)) throw Error(n(327));
        var c = a.callbackNode;
        if (Oh() && a.callbackNode !== c) return null;
        var d = zc(a, a === N ? Z : 0);
        if (0 === d) return null;
        if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b) b = Ph(a, d);
        else {
          b = d;
          var e = H;
          H |= 2;
          var f = Qh();
          if (N !== a || Z !== b) Ah = null, Bh(), Rh(a, b);
          do
            try {
              Sh();
              break;
            } catch (h) {
              Th(a, h);
            }
          while (1);
          Ud();
          th.current = f;
          H = e;
          null !== X ? b = 0 : (N = null, Z = 0, b = R);
        }
        if (0 !== b) {
          2 === b && (e = Cc(a), 0 !== e && (d = e, b = Uh(a, e)));
          if (1 === b) throw c = vh, Rh(a, 0), Jh(a, d), Kh(a, D()), c;
          if (6 === b) Jh(a, d);
          else {
            e = a.current.alternate;
            if (0 === (d & 30) && !Vh(e) && (b = Ph(a, d), 2 === b && (f = Cc(a), 0 !== f && (d = f, b = Uh(a, f))), 1 === b)) throw c = vh, Rh(a, 0), Jh(a, d), Kh(a, D()), c;
            a.finishedWork = e;
            a.finishedLanes = d;
            switch (b) {
              case 0:
              case 1:
                throw Error(n(345));
              case 2:
                Wh(a, zh, Ah);
                break;
              case 3:
                Jh(a, d);
                if ((d & 130023424) === d && (b = bh + 500 - D(), 10 < b)) {
                  if (0 !== zc(a, 0)) break;
                  e = a.suspendedLanes;
                  if ((e & d) !== d) {
                    O();
                    a.pingedLanes |= a.suspendedLanes & e;
                    break;
                  }
                  a.timeoutHandle = Pa(Wh.bind(null, a, zh, Ah), b);
                  break;
                }
                Wh(a, zh, Ah);
                break;
              case 4:
                Jh(a, d);
                if ((d & 4194240) === d) break;
                b = a.eventTimes;
                for (e = -1; 0 < d; ) {
                  var g = 31 - tc(d);
                  f = 1 << g;
                  g = b[g];
                  g > e && (e = g);
                  d &= ~f;
                }
                d = e;
                d = D() - d;
                d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * sh(d / 1960)) - d;
                if (10 < d) {
                  a.timeoutHandle = Pa(Wh.bind(null, a, zh, Ah), d);
                  break;
                }
                Wh(a, zh, Ah);
                break;
              case 5:
                Wh(a, zh, Ah);
                break;
              default:
                throw Error(n(329));
            }
          }
        }
        Kh(a, D());
        return a.callbackNode === c ? Nh.bind(null, a) : null;
      }
      function Uh(a, b) {
        var c = yh;
        a.current.memoizedState.isDehydrated && (Rh(a, b).flags |= 256);
        a = Ph(a, b);
        2 !== a && (b = zh, zh = c, null !== b && Cg(b));
        return a;
      }
      function Cg(a) {
        null === zh ? zh = a : zh.push.apply(zh, a);
      }
      function Vh(a) {
        for (var b = a; ; ) {
          if (b.flags & 16384) {
            var c = b.updateQueue;
            if (null !== c && (c = c.stores, null !== c)) for (var d = 0; d < c.length; d++) {
              var e = c[d], f = e.getSnapshot;
              e = e.value;
              try {
                if (!Vc(f(), e)) return false;
              } catch (g) {
                return false;
              }
            }
          }
          c = b.child;
          if (b.subtreeFlags & 16384 && null !== c) c.return = b, b = c;
          else {
            if (b === a) break;
            for (; null === b.sibling; ) {
              if (null === b.return || b.return === a) return true;
              b = b.return;
            }
            b.sibling.return = b.return;
            b = b.sibling;
          }
        }
        return true;
      }
      function Jh(a, b) {
        b &= ~xh;
        b &= ~wh;
        a.suspendedLanes |= b;
        a.pingedLanes &= ~b;
        for (a = a.expirationTimes; 0 < b; ) {
          var c = 31 - tc(b), d = 1 << c;
          a[c] = -1;
          b &= ~d;
        }
      }
      function Lh(a) {
        if (0 !== (H & 6)) throw Error(n(327));
        Oh();
        var b = zc(a, 0);
        if (0 === (b & 1)) return Kh(a, D()), null;
        var c = Ph(a, b);
        if (0 !== a.tag && 2 === c) {
          var d = Cc(a);
          0 !== d && (b = d, c = Uh(a, d));
        }
        if (1 === c) throw c = vh, Rh(a, 0), Jh(a, b), Kh(a, D()), c;
        if (6 === c) throw Error(n(345));
        a.finishedWork = a.current.alternate;
        a.finishedLanes = b;
        Wh(a, zh, Ah);
        Kh(a, D());
        return null;
      }
      function Xh(a) {
        null !== Dh && 0 === Dh.tag && 0 === (H & 6) && Oh();
        var b = H;
        H |= 1;
        var c = W.transition, d = C;
        try {
          if (W.transition = null, C = 1, a) return a();
        } finally {
          C = d, W.transition = c, H = b, 0 === (H & 6) && ad();
        }
      }
      function Eg() {
        $f = Zf.current;
        q(Zf);
      }
      function Rh(a, b) {
        a.finishedWork = null;
        a.finishedLanes = 0;
        var c = a.timeoutHandle;
        c !== Ra && (a.timeoutHandle = Ra, Qa(c));
        if (null !== X) for (c = X.return; null !== c; ) {
          var d = c;
          nd(d);
          switch (d.tag) {
            case 1:
              d = d.type.childContextTypes;
              null !== d && void 0 !== d && nc();
              break;
            case 3:
              te();
              q(z);
              q(x);
              ye();
              break;
            case 5:
              ve(d);
              break;
            case 4:
              te();
              break;
            case 13:
              q(I);
              break;
            case 19:
              q(I);
              break;
            case 10:
              Wd(d.type._context);
              break;
            case 22:
            case 23:
              Eg();
          }
          c = c.return;
        }
        N = a;
        X = a = Jd(a.current, null);
        Z = $f = b;
        R = 0;
        vh = null;
        xh = wh = le = 0;
        zh = yh = null;
        if (null !== $d) {
          for (b = 0; b < $d.length; b++) if (c = $d[b], d = c.interleaved, null !== d) {
            c.interleaved = null;
            var e = d.next, f = c.pending;
            if (null !== f) {
              var g = f.next;
              f.next = e;
              d.next = g;
            }
            c.pending = d;
          }
          $d = null;
        }
        return a;
      }
      function Th(a, b) {
        do {
          var c = X;
          try {
            Ud();
            ze.current = Le;
            if (Ce) {
              for (var d = J.memoizedState; null !== d; ) {
                var e = d.queue;
                null !== e && (e.pending = null);
                d = d.next;
              }
              Ce = false;
            }
            Be = 0;
            L = K = J = null;
            De = false;
            Ee = 0;
            uh.current = null;
            if (null === c || null === c.return) {
              R = 1;
              vh = b;
              X = null;
              break;
            }
            a: {
              var f = a, g = c.return, h = c, k = b;
              b = Z;
              h.flags |= 32768;
              if (null !== k && "object" === typeof k && "function" === typeof k.then) {
                var l = k, m = h, r = m.tag;
                if (0 === (m.mode & 1) && (0 === r || 11 === r || 15 === r)) {
                  var p = m.alternate;
                  p ? (m.updateQueue = p.updateQueue, m.memoizedState = p.memoizedState, m.lanes = p.lanes) : (m.updateQueue = null, m.memoizedState = null);
                }
                var B = Pf(g);
                if (null !== B) {
                  B.flags &= -257;
                  Qf(B, g, h, f, b);
                  B.mode & 1 && Nf(f, l, b);
                  b = B;
                  k = l;
                  var w = b.updateQueue;
                  if (null === w) {
                    var Y = /* @__PURE__ */ new Set();
                    Y.add(k);
                    b.updateQueue = Y;
                  } else w.add(k);
                  break a;
                } else {
                  if (0 === (b & 1)) {
                    Nf(f, l, b);
                    ng();
                    break a;
                  }
                  k = Error(n(426));
                }
              } else if (F && h.mode & 1) {
                var ya = Pf(g);
                if (null !== ya) {
                  0 === (ya.flags & 65536) && (ya.flags |= 256);
                  Qf(ya, g, h, f, b);
                  Bd(Ef(k, h));
                  break a;
                }
              }
              f = k = Ef(k, h);
              4 !== R && (R = 2);
              null === yh ? yh = [f] : yh.push(f);
              f = g;
              do {
                switch (f.tag) {
                  case 3:
                    f.flags |= 65536;
                    b &= -b;
                    f.lanes |= b;
                    var E = If(f, k, b);
                    je(f, E);
                    break a;
                  case 1:
                    h = k;
                    var u = f.type, t = f.stateNode;
                    if (0 === (f.flags & 128) && ("function" === typeof u.getDerivedStateFromError || null !== t && "function" === typeof t.componentDidCatch && (null === Mf || !Mf.has(t)))) {
                      f.flags |= 65536;
                      b &= -b;
                      f.lanes |= b;
                      var Db = Lf(f, h, b);
                      je(f, Db);
                      break a;
                    }
                }
                f = f.return;
              } while (null !== f);
            }
            Yh(c);
          } catch (lc) {
            b = lc;
            X === c && null !== c && (X = c = c.return);
            continue;
          }
          break;
        } while (1);
      }
      function Qh() {
        var a = th.current;
        th.current = Le;
        return null === a ? Le : a;
      }
      function ng() {
        if (0 === R || 3 === R || 2 === R) R = 4;
        null === N || 0 === (le & 268435455) && 0 === (wh & 268435455) || Jh(N, Z);
      }
      function Ph(a, b) {
        var c = H;
        H |= 2;
        var d = Qh();
        if (N !== a || Z !== b) Ah = null, Rh(a, b);
        do
          try {
            Zh();
            break;
          } catch (e) {
            Th(a, e);
          }
        while (1);
        Ud();
        H = c;
        th.current = d;
        if (null !== X) throw Error(n(261));
        N = null;
        Z = 0;
        return R;
      }
      function Zh() {
        for (; null !== X; ) $h(X);
      }
      function Sh() {
        for (; null !== X && !Lc(); ) $h(X);
      }
      function $h(a) {
        var b = ai(a.alternate, a, $f);
        a.memoizedProps = a.pendingProps;
        null === b ? Yh(a) : X = b;
        uh.current = null;
      }
      function Yh(a) {
        var b = a;
        do {
          var c = b.alternate;
          a = b.return;
          if (0 === (b.flags & 32768)) {
            if (c = Bg(c, b, $f), null !== c) {
              X = c;
              return;
            }
          } else {
            c = Fg(c, b);
            if (null !== c) {
              c.flags &= 32767;
              X = c;
              return;
            }
            if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
            else {
              R = 6;
              X = null;
              return;
            }
          }
          b = b.sibling;
          if (null !== b) {
            X = b;
            return;
          }
          X = b = a;
        } while (null !== b);
        0 === R && (R = 5);
      }
      function Wh(a, b, c) {
        var d = C, e = W.transition;
        try {
          W.transition = null, C = 1, bi(a, b, c, d);
        } finally {
          W.transition = e, C = d;
        }
        return null;
      }
      function bi(a, b, c, d) {
        do
          Oh();
        while (null !== Dh);
        if (0 !== (H & 6)) throw Error(n(327));
        c = a.finishedWork;
        var e = a.finishedLanes;
        if (null === c) return null;
        a.finishedWork = null;
        a.finishedLanes = 0;
        if (c === a.current) throw Error(n(177));
        a.callbackNode = null;
        a.callbackPriority = 0;
        var f = c.lanes | c.childLanes;
        Gc(a, f);
        a === N && (X = N = null, Z = 0);
        0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || Ch || (Ch = true, Mh(Pc, function() {
          Oh();
          return null;
        }));
        f = 0 !== (c.flags & 15990);
        if (0 !== (c.subtreeFlags & 15990) || f) {
          f = W.transition;
          W.transition = null;
          var g = C;
          C = 1;
          var h = H;
          H |= 4;
          uh.current = null;
          Lg(a, c);
          $g(c, a);
          Ia(a.containerInfo);
          a.current = c;
          dh(c, a, e);
          Mc();
          H = h;
          C = g;
          W.transition = f;
        } else a.current = c;
        Ch && (Ch = false, Dh = a, Eh = e);
        f = a.pendingLanes;
        0 === f && (Mf = null);
        Tc(c.stateNode, d);
        Kh(a, D());
        if (null !== b) for (d = a.onRecoverableError, c = 0; c < b.length; c++) e = b[c], d(e.value, { componentStack: e.stack, digest: e.digest });
        if (Jf) throw Jf = false, a = Kf, Kf = null, a;
        0 !== (Eh & 1) && 0 !== a.tag && Oh();
        f = a.pendingLanes;
        0 !== (f & 1) ? a === Gh ? Fh++ : (Fh = 0, Gh = a) : Fh = 0;
        ad();
        return null;
      }
      function Oh() {
        if (null !== Dh) {
          var a = Ic(Eh), b = W.transition, c = C;
          try {
            W.transition = null;
            C = 16 > a ? 16 : a;
            if (null === Dh) var d = false;
            else {
              a = Dh;
              Dh = null;
              Eh = 0;
              if (0 !== (H & 6)) throw Error(n(331));
              var e = H;
              H |= 4;
              for (T = a.current; null !== T; ) {
                var f = T, g = f.child;
                if (0 !== (T.flags & 16)) {
                  var h = f.deletions;
                  if (null !== h) {
                    for (var k = 0; k < h.length; k++) {
                      var l = h[k];
                      for (T = l; null !== T; ) {
                        var m = T;
                        switch (m.tag) {
                          case 0:
                          case 11:
                          case 15:
                            Mg(8, m, f);
                        }
                        var r = m.child;
                        if (null !== r) r.return = m, T = r;
                        else for (; null !== T; ) {
                          m = T;
                          var p = m.sibling, B = m.return;
                          Pg(m);
                          if (m === l) {
                            T = null;
                            break;
                          }
                          if (null !== p) {
                            p.return = B;
                            T = p;
                            break;
                          }
                          T = B;
                        }
                      }
                    }
                    var w = f.alternate;
                    if (null !== w) {
                      var Y = w.child;
                      if (null !== Y) {
                        w.child = null;
                        do {
                          var ya = Y.sibling;
                          Y.sibling = null;
                          Y = ya;
                        } while (null !== Y);
                      }
                    }
                    T = f;
                  }
                }
                if (0 !== (f.subtreeFlags & 2064) && null !== g) g.return = f, T = g;
                else b: for (; null !== T; ) {
                  f = T;
                  if (0 !== (f.flags & 2048)) switch (f.tag) {
                    case 0:
                    case 11:
                    case 15:
                      Mg(9, f, f.return);
                  }
                  var E = f.sibling;
                  if (null !== E) {
                    E.return = f.return;
                    T = E;
                    break b;
                  }
                  T = f.return;
                }
              }
              var u = a.current;
              for (T = u; null !== T; ) {
                g = T;
                var t = g.child;
                if (0 !== (g.subtreeFlags & 2064) && null !== t) t.return = g, T = t;
                else b: for (g = u; null !== T; ) {
                  h = T;
                  if (0 !== (h.flags & 2048)) try {
                    switch (h.tag) {
                      case 0:
                      case 11:
                      case 15:
                        Ng(9, h);
                    }
                  } catch (lc) {
                    U(h, h.return, lc);
                  }
                  if (h === g) {
                    T = null;
                    break b;
                  }
                  var Db = h.sibling;
                  if (null !== Db) {
                    Db.return = h.return;
                    T = Db;
                    break b;
                  }
                  T = h.return;
                }
              }
              H = e;
              ad();
              if (Sc && "function" === typeof Sc.onPostCommitFiberRoot) try {
                Sc.onPostCommitFiberRoot(Rc, a);
              } catch (lc) {
              }
              d = true;
            }
            return d;
          } finally {
            C = c, W.transition = b;
          }
        }
        return false;
      }
      function ci(a, b, c) {
        b = Ef(c, b);
        b = If(a, b, 1);
        a = he(a, b, 1);
        b = O();
        null !== a && (Fc(a, 1, b), Kh(a, b));
      }
      function U(a, b, c) {
        if (3 === a.tag) ci(a, a, c);
        else for (; null !== b; ) {
          if (3 === b.tag) {
            ci(b, a, c);
            break;
          } else if (1 === b.tag) {
            var d = b.stateNode;
            if ("function" === typeof b.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Mf || !Mf.has(d))) {
              a = Ef(c, a);
              a = Lf(b, a, 1);
              b = he(b, a, 1);
              a = O();
              null !== b && (Fc(b, 1, a), Kh(b, a));
              break;
            }
          }
          b = b.return;
        }
      }
      function Of(a, b, c) {
        var d = a.pingCache;
        null !== d && d.delete(b);
        b = O();
        a.pingedLanes |= a.suspendedLanes & c;
        N === a && (Z & c) === c && (4 === R || 3 === R && (Z & 130023424) === Z && 500 > D() - bh ? Rh(a, 0) : xh |= c);
        Kh(a, b);
      }
      function di(a, b) {
        0 === b && (0 === (a.mode & 1) ? b = 1 : (b = xc, xc <<= 1, 0 === (xc & 130023424) && (xc = 4194304)));
        var c = O();
        a = ce(a, b);
        null !== a && (Fc(a, b, c), Kh(a, c));
      }
      function og(a) {
        var b = a.memoizedState, c = 0;
        null !== b && (c = b.retryLane);
        di(a, c);
      }
      function Yg(a, b) {
        var c = 0;
        switch (a.tag) {
          case 13:
            var d = a.stateNode;
            var e = a.memoizedState;
            null !== e && (c = e.retryLane);
            break;
          case 19:
            d = a.stateNode;
            break;
          default:
            throw Error(n(314));
        }
        null !== d && d.delete(b);
        di(a, c);
      }
      var ai;
      ai = function(a, b, c) {
        if (null !== a) if (a.memoizedProps !== b.pendingProps || z.current) G = true;
        else {
          if (0 === (a.lanes & c) && 0 === (b.flags & 128)) return G = false, sg(a, b, c);
          G = 0 !== (a.flags & 131072) ? true : false;
        }
        else G = false, F && 0 !== (b.flags & 1048576) && ld(b, ed, b.index);
        b.lanes = 0;
        switch (b.tag) {
          case 2:
            var d = b.type;
            cg(a, b);
            a = b.pendingProps;
            var e = mc(b, x.current);
            Yd(b, c);
            e = He(null, b, d, a, e, c);
            var f = Me();
            b.flags |= 1;
            "object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, A(d) ? (f = true, qc(b)) : f = false, b.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, ee(b), e.updater = zf, b.stateNode = e, e._reactInternals = b, Df(b, d, a, c), b = dg(null, b, d, true, f, c)) : (b.tag = 0, F && f && md(b), P(null, b, e, c), b = b.child);
            return b;
          case 16:
            d = b.elementType;
            a: {
              cg(a, b);
              a = b.pendingProps;
              e = d._init;
              d = e(d._payload);
              b.type = d;
              e = b.tag = ei(d);
              a = xf(d, a);
              switch (e) {
                case 0:
                  b = Xf(null, b, d, a, c);
                  break a;
                case 1:
                  b = bg(null, b, d, a, c);
                  break a;
                case 11:
                  b = Sf(null, b, d, a, c);
                  break a;
                case 14:
                  b = Uf(null, b, d, xf(d.type, a), c);
                  break a;
              }
              throw Error(n(
                306,
                d,
                ""
              ));
            }
            return b;
          case 0:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), Xf(a, b, d, e, c);
          case 1:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), bg(a, b, d, e, c);
          case 3:
            a: {
              eg(b);
              if (null === a) throw Error(n(387));
              d = b.pendingProps;
              f = b.memoizedState;
              e = f.element;
              fe(a, b);
              ke(b, d, null, c);
              var g = b.memoizedState;
              d = g.element;
              if (Va && f.isDehydrated) if (f = { element: d, isDehydrated: false, cache: g.cache, pendingSuspenseBoundaries: g.pendingSuspenseBoundaries, transitions: g.transitions }, b.updateQueue.baseState = f, b.memoizedState = f, b.flags & 256) {
                e = Ef(Error(n(423)), b);
                b = fg(a, b, d, c, e);
                break a;
              } else if (d !== e) {
                e = Ef(Error(n(424)), b);
                b = fg(a, b, d, c, e);
                break a;
              } else for (Va && (pd = Pb(b.stateNode.containerInfo), od = b, F = true, rd = null, qd = false), c = Pd(b, null, d, c), b.child = c; c; ) c.flags = c.flags & -3 | 4096, c = c.sibling;
              else {
                Ad();
                if (d === e) {
                  b = Tf(a, b, c);
                  break a;
                }
                P(a, b, d, c);
              }
              b = b.child;
            }
            return b;
          case 5:
            return ue(b), null === a && wd(b), d = b.type, e = b.pendingProps, f = null !== a ? a.memoizedProps : null, g = e.children, Na(d, e) ? g = null : null !== f && Na(d, f) && (b.flags |= 32), ag(a, b), P(a, b, g, c), b.child;
          case 6:
            return null === a && wd(b), null;
          case 13:
            return ig(a, b, c);
          case 4:
            return se(b, b.stateNode.containerInfo), d = b.pendingProps, null === a ? b.child = Od(b, null, d, c) : P(a, b, d, c), b.child;
          case 11:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), Sf(a, b, d, e, c);
          case 7:
            return P(a, b, b.pendingProps, c), b.child;
          case 8:
            return P(a, b, b.pendingProps.children, c), b.child;
          case 12:
            return P(a, b, b.pendingProps.children, c), b.child;
          case 10:
            a: {
              d = b.type._context;
              e = b.pendingProps;
              f = b.memoizedProps;
              g = e.value;
              Vd(b, d, g);
              if (null !== f) if (Vc(f.value, g)) {
                if (f.children === e.children && !z.current) {
                  b = Tf(a, b, c);
                  break a;
                }
              } else for (f = b.child, null !== f && (f.return = b); null !== f; ) {
                var h = f.dependencies;
                if (null !== h) {
                  g = f.child;
                  for (var k = h.firstContext; null !== k; ) {
                    if (k.context === d) {
                      if (1 === f.tag) {
                        k = ge(-1, c & -c);
                        k.tag = 2;
                        var l = f.updateQueue;
                        if (null !== l) {
                          l = l.shared;
                          var m = l.pending;
                          null === m ? k.next = k : (k.next = m.next, m.next = k);
                          l.pending = k;
                        }
                      }
                      f.lanes |= c;
                      k = f.alternate;
                      null !== k && (k.lanes |= c);
                      Xd(f.return, c, b);
                      h.lanes |= c;
                      break;
                    }
                    k = k.next;
                  }
                } else if (10 === f.tag) g = f.type === b.type ? null : f.child;
                else if (18 === f.tag) {
                  g = f.return;
                  if (null === g) throw Error(n(341));
                  g.lanes |= c;
                  h = g.alternate;
                  null !== h && (h.lanes |= c);
                  Xd(g, c, b);
                  g = f.sibling;
                } else g = f.child;
                if (null !== g) g.return = f;
                else for (g = f; null !== g; ) {
                  if (g === b) {
                    g = null;
                    break;
                  }
                  f = g.sibling;
                  if (null !== f) {
                    f.return = g.return;
                    g = f;
                    break;
                  }
                  g = g.return;
                }
                f = g;
              }
              P(a, b, e.children, c);
              b = b.child;
            }
            return b;
          case 9:
            return e = b.type, d = b.pendingProps.children, Yd(b, c), e = Zd(e), d = d(e), b.flags |= 1, P(a, b, d, c), b.child;
          case 14:
            return d = b.type, e = xf(d, b.pendingProps), e = xf(d.type, e), Uf(a, b, d, e, c);
          case 15:
            return Wf(a, b, b.type, b.pendingProps, c);
          case 17:
            return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : xf(d, e), cg(a, b), b.tag = 1, A(d) ? (a = true, qc(b)) : a = false, Yd(b, c), Bf(b, d, e), Df(b, d, e, c), dg(null, b, d, true, a, c);
          case 19:
            return rg(a, b, c);
          case 22:
            return Yf(a, b, c);
        }
        throw Error(n(156, b.tag));
      };
      function Mh(a, b) {
        return Jc(a, b);
      }
      function fi(a, b, c, d) {
        this.tag = a;
        this.key = c;
        this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
        this.index = 0;
        this.ref = null;
        this.pendingProps = b;
        this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
        this.mode = d;
        this.subtreeFlags = this.flags = 0;
        this.deletions = null;
        this.childLanes = this.lanes = 0;
        this.alternate = null;
      }
      function td(a, b, c, d) {
        return new fi(a, b, c, d);
      }
      function Vf(a) {
        a = a.prototype;
        return !(!a || !a.isReactComponent);
      }
      function ei(a) {
        if ("function" === typeof a) return Vf(a) ? 1 : 0;
        if (void 0 !== a && null !== a) {
          a = a.$$typeof;
          if (a === ma) return 11;
          if (a === pa) return 14;
        }
        return 2;
      }
      function Jd(a, b) {
        var c = a.alternate;
        null === c ? (c = td(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
        c.flags = a.flags & 14680064;
        c.childLanes = a.childLanes;
        c.lanes = a.lanes;
        c.child = a.child;
        c.memoizedProps = a.memoizedProps;
        c.memoizedState = a.memoizedState;
        c.updateQueue = a.updateQueue;
        b = a.dependencies;
        c.dependencies = null === b ? null : { lanes: b.lanes, firstContext: b.firstContext };
        c.sibling = a.sibling;
        c.index = a.index;
        c.ref = a.ref;
        return c;
      }
      function Ld(a, b, c, d, e, f) {
        var g = 2;
        d = a;
        if ("function" === typeof a) Vf(a) && (g = 1);
        else if ("string" === typeof a) g = 5;
        else a: switch (a) {
          case ha:
            return Nd(c.children, e, f, b);
          case ia:
            g = 8;
            e |= 8;
            break;
          case ja:
            return a = td(12, c, b, e | 2), a.elementType = ja, a.lanes = f, a;
          case na:
            return a = td(13, c, b, e), a.elementType = na, a.lanes = f, a;
          case oa:
            return a = td(19, c, b, e), a.elementType = oa, a.lanes = f, a;
          case ra:
            return jg(c, e, f, b);
          default:
            if ("object" === typeof a && null !== a) switch (a.$$typeof) {
              case ka:
                g = 10;
                break a;
              case la:
                g = 9;
                break a;
              case ma:
                g = 11;
                break a;
              case pa:
                g = 14;
                break a;
              case qa:
                g = 16;
                d = null;
                break a;
            }
            throw Error(n(130, null == a ? a : typeof a, ""));
        }
        b = td(g, c, b, e);
        b.elementType = a;
        b.type = d;
        b.lanes = f;
        return b;
      }
      function Nd(a, b, c, d) {
        a = td(7, a, d, b);
        a.lanes = c;
        return a;
      }
      function jg(a, b, c, d) {
        a = td(22, a, d, b);
        a.elementType = ra;
        a.lanes = c;
        a.stateNode = { isHidden: false };
        return a;
      }
      function Kd(a, b, c) {
        a = td(6, a, null, b);
        a.lanes = c;
        return a;
      }
      function Md(a, b, c) {
        b = td(4, null !== a.children ? a.children : [], a.key, b);
        b.lanes = c;
        b.stateNode = { containerInfo: a.containerInfo, pendingChildren: null, implementation: a.implementation };
        return b;
      }
      function gi(a, b, c, d, e) {
        this.tag = b;
        this.containerInfo = a;
        this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
        this.timeoutHandle = Ra;
        this.callbackNode = this.pendingContext = this.context = null;
        this.callbackPriority = 0;
        this.eventTimes = Ec(0);
        this.expirationTimes = Ec(-1);
        this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
        this.entanglements = Ec(0);
        this.identifierPrefix = d;
        this.onRecoverableError = e;
        Va && (this.mutableSourceEagerHydrationData = null);
      }
      function hi(a, b, c, d, e, f, g, h, k) {
        a = new gi(a, b, c, h, k);
        1 === b ? (b = 1, true === f && (b |= 8)) : b = 0;
        f = td(3, null, null, b);
        a.current = f;
        f.stateNode = a;
        f.memoizedState = { element: d, isDehydrated: c, cache: null, transitions: null, pendingSuspenseBoundaries: null };
        ee(f);
        return a;
      }
      function ii(a) {
        if (!a) return jc;
        a = a._reactInternals;
        a: {
          if (wa(a) !== a || 1 !== a.tag) throw Error(n(170));
          var b = a;
          do {
            switch (b.tag) {
              case 3:
                b = b.stateNode.context;
                break a;
              case 1:
                if (A(b.type)) {
                  b = b.stateNode.__reactInternalMemoizedMergedChildContext;
                  break a;
                }
            }
            b = b.return;
          } while (null !== b);
          throw Error(n(171));
        }
        if (1 === a.tag) {
          var c = a.type;
          if (A(c)) return pc(a, c, b);
        }
        return b;
      }
      function ji(a) {
        var b = a._reactInternals;
        if (void 0 === b) {
          if ("function" === typeof a.render) throw Error(n(188));
          a = Object.keys(a).join(",");
          throw Error(n(268, a));
        }
        a = Aa(b);
        return null === a ? null : a.stateNode;
      }
      function ki(a, b) {
        a = a.memoizedState;
        if (null !== a && null !== a.dehydrated) {
          var c = a.retryLane;
          a.retryLane = 0 !== c && c < b ? c : b;
        }
      }
      function li(a, b) {
        ki(a, b);
        (a = a.alternate) && ki(a, b);
      }
      function mi(a) {
        a = Aa(a);
        return null === a ? null : a.stateNode;
      }
      function ni() {
        return null;
      }
      exports2.attemptContinuousHydration = function(a) {
        if (13 === a.tag) {
          var b = ce(a, 134217728);
          if (null !== b) {
            var c = O();
            af(b, a, 134217728, c);
          }
          li(a, 134217728);
        }
      };
      exports2.attemptDiscreteHydration = function(a) {
        if (13 === a.tag) {
          var b = ce(a, 1);
          if (null !== b) {
            var c = O();
            af(b, a, 1, c);
          }
          li(a, 1);
        }
      };
      exports2.attemptHydrationAtCurrentPriority = function(a) {
        if (13 === a.tag) {
          var b = tf(a), c = ce(a, b);
          if (null !== c) {
            var d = O();
            af(c, a, b, d);
          }
          li(a, b);
        }
      };
      exports2.attemptSynchronousHydration = function(a) {
        switch (a.tag) {
          case 3:
            var b = a.stateNode;
            if (b.current.memoizedState.isDehydrated) {
              var c = yc(b.pendingLanes);
              0 !== c && (Hc(b, c | 1), Kh(b, D()), 0 === (H & 6) && (Bh(), ad()));
            }
            break;
          case 13:
            Xh(function() {
              var b2 = ce(a, 1);
              if (null !== b2) {
                var c2 = O();
                af(b2, a, 1, c2);
              }
            }), li(a, 1);
        }
      };
      exports2.batchedUpdates = function(a, b) {
        var c = H;
        H |= 1;
        try {
          return a(b);
        } finally {
          H = c, 0 === H && (Bh(), Xc && ad());
        }
      };
      exports2.createComponentSelector = function(a) {
        return { $$typeof: hh, value: a };
      };
      exports2.createContainer = function(a, b, c, d, e, f, g) {
        return hi(a, b, false, null, c, d, e, f, g);
      };
      exports2.createHasPseudoClassSelector = function(a) {
        return { $$typeof: ih, value: a };
      };
      exports2.createHydrationContainer = function(a, b, c, d, e, f, g, h, k) {
        a = hi(c, d, true, a, e, f, g, h, k);
        a.context = ii(null);
        c = a.current;
        d = O();
        e = tf(c);
        f = ge(d, e);
        f.callback = void 0 !== b && null !== b ? b : null;
        he(c, f, e);
        a.current.lanes = e;
        Fc(a, e, d);
        Kh(a, d);
        return a;
      };
      exports2.createPortal = function(a, b, c) {
        var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
        return { $$typeof: fa, key: null == d ? null : "" + d, children: a, containerInfo: b, implementation: c };
      };
      exports2.createRoleSelector = function(a) {
        return { $$typeof: jh, value: a };
      };
      exports2.createTestNameSelector = function(a) {
        return { $$typeof: kh, value: a };
      };
      exports2.createTextSelector = function(a) {
        return { $$typeof: lh, value: a };
      };
      exports2.deferredUpdates = function(a) {
        var b = C, c = W.transition;
        try {
          return W.transition = null, C = 16, a();
        } finally {
          C = b, W.transition = c;
        }
      };
      exports2.discreteUpdates = function(a, b, c, d, e) {
        var f = C, g = W.transition;
        try {
          return W.transition = null, C = 1, a(b, c, d, e);
        } finally {
          C = f, W.transition = g, 0 === H && Bh();
        }
      };
      exports2.findAllNodes = rh;
      exports2.findBoundingRects = function(a, b) {
        if (!bb) throw Error(n(363));
        b = rh(a, b);
        a = [];
        for (var c = 0; c < b.length; c++) a.push(db(b[c]));
        for (b = a.length - 1; 0 < b; b--) {
          c = a[b];
          for (var d = c.x, e = d + c.width, f = c.y, g = f + c.height, h = b - 1; 0 <= h; h--) if (b !== h) {
            var k = a[h], l = k.x, m = l + k.width, r = k.y, p = r + k.height;
            if (d >= l && f >= r && e <= m && g <= p) {
              a.splice(b, 1);
              break;
            } else if (!(d !== l || c.width !== k.width || p < f || r > g)) {
              r > f && (k.height += r - f, k.y = f);
              p < g && (k.height = g - r);
              a.splice(b, 1);
              break;
            } else if (!(f !== r || c.height !== k.height || m < d || l > e)) {
              l > d && (k.width += l - d, k.x = d);
              m < e && (k.width = e - l);
              a.splice(b, 1);
              break;
            }
          }
        }
        return a;
      };
      exports2.findHostInstance = ji;
      exports2.findHostInstanceWithNoPortals = function(a) {
        a = za(a);
        a = null !== a ? Ca(a) : null;
        return null === a ? null : a.stateNode;
      };
      exports2.findHostInstanceWithWarning = function(a) {
        return ji(a);
      };
      exports2.flushControlled = function(a) {
        var b = H;
        H |= 1;
        var c = W.transition, d = C;
        try {
          W.transition = null, C = 1, a();
        } finally {
          C = d, W.transition = c, H = b, 0 === H && (Bh(), ad());
        }
      };
      exports2.flushPassiveEffects = Oh;
      exports2.flushSync = Xh;
      exports2.focusWithin = function(a, b) {
        if (!bb) throw Error(n(363));
        a = nh(a);
        b = qh(a, b);
        b = Array.from(b);
        for (a = 0; a < b.length; ) {
          var c = b[a++];
          if (!fb(c)) {
            if (5 === c.tag && hb(c.stateNode)) return true;
            for (c = c.child; null !== c; ) b.push(c), c = c.sibling;
          }
        }
        return false;
      };
      exports2.getCurrentUpdatePriority = function() {
        return C;
      };
      exports2.getFindAllNodesFailureDescription = function(a, b) {
        if (!bb) throw Error(n(363));
        var c = 0, d = [];
        a = [nh(a), 0];
        for (var e = 0; e < a.length; ) {
          var f = a[e++], g = a[e++], h = b[g];
          if (5 !== f.tag || !fb(f)) {
            if (oh(f, h) && (d.push(ph(h)), g++, g > c && (c = g)), g < b.length) for (f = f.child; null !== f; ) a.push(f, g), f = f.sibling;
          }
        }
        if (c < b.length) {
          for (a = []; c < b.length; c++) a.push(ph(b[c]));
          return "findAllNodes was able to match part of the selector:\n  " + (d.join(" > ") + "\n\nNo matching component was found for:\n  ") + a.join(" > ");
        }
        return null;
      };
      exports2.getPublicRootInstance = function(a) {
        a = a.current;
        if (!a.child) return null;
        switch (a.child.tag) {
          case 5:
            return Ea(a.child.stateNode);
          default:
            return a.child.stateNode;
        }
      };
      exports2.injectIntoDevTools = function(a) {
        a = { bundleType: a.bundleType, version: a.version, rendererPackageName: a.rendererPackageName, rendererConfig: a.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: da.ReactCurrentDispatcher, findHostInstanceByFiber: mi, findFiberByHostInstance: a.findFiberByHostInstance || ni, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1" };
        if ("undefined" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) a = false;
        else {
          var b = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (b.isDisabled || !b.supportsFiber) a = true;
          else {
            try {
              Rc = b.inject(a), Sc = b;
            } catch (c) {
            }
            a = b.checkDCE ? true : false;
          }
        }
        return a;
      };
      exports2.isAlreadyRendering = function() {
        return false;
      };
      exports2.observeVisibleRects = function(a, b, c, d) {
        if (!bb) throw Error(n(363));
        a = rh(a, b);
        var e = ib(a, c, d).disconnect;
        return { disconnect: function() {
          e();
        } };
      };
      exports2.registerMutableSourceForHydration = function(a, b) {
        var c = b._getVersion;
        c = c(b._source);
        null == a.mutableSourceEagerHydrationData ? a.mutableSourceEagerHydrationData = [b, c] : a.mutableSourceEagerHydrationData.push(b, c);
      };
      exports2.runWithPriority = function(a, b) {
        var c = C;
        try {
          return C = a, b();
        } finally {
          C = c;
        }
      };
      exports2.shouldError = function() {
        return null;
      };
      exports2.shouldSuspend = function() {
        return false;
      };
      exports2.updateContainer = function(a, b, c, d) {
        var e = b.current, f = O(), g = tf(e);
        c = ii(c);
        null === b.context ? b.context = c : b.pendingContext = c;
        b = ge(f, g);
        b.payload = { element: a };
        d = void 0 === d ? null : d;
        null !== d && (b.callback = d);
        a = he(e, b, g);
        null !== a && (af(a, e, g, f), ie(a, e, g));
        return g;
      };
      return exports2;
    };
  }
});

// node_modules/react-reconciler/index.js
var require_react_reconciler = __commonJS({
  "node_modules/react-reconciler/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_react_reconciler_production_min();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/react-reconciler/cjs/react-reconciler-constants.production.min.js
var require_react_reconciler_constants_production_min = __commonJS({
  "node_modules/react-reconciler/cjs/react-reconciler-constants.production.min.js"(exports) {
    "use strict";
    exports.ConcurrentRoot = 1;
    exports.ContinuousEventPriority = 4;
    exports.DefaultEventPriority = 16;
    exports.DiscreteEventPriority = 1;
    exports.IdleEventPriority = 536870912;
    exports.LegacyRoot = 0;
  }
});

// node_modules/react-reconciler/constants.js
var require_constants2 = __commonJS({
  "node_modules/react-reconciler/constants.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_react_reconciler_constants_production_min();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/rng.js
var require_rng = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/rng.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = rng;
    var getRandomValues;
    var rnds8 = new Uint8Array(16);
    function rng() {
      if (!getRandomValues) {
        getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
        if (!getRandomValues) {
          throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
        }
      }
      return getRandomValues(rnds8);
    }
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/regex.js
var require_regex = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/regex.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/validate.js
var require_validate = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/validate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _regex = _interopRequireDefault(require_regex());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function validate(uuid) {
      return typeof uuid === "string" && _regex.default.test(uuid);
    }
    var _default = validate;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/stringify.js
var require_stringify = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/stringify.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    exports.unsafeStringify = unsafeStringify;
    var _validate = _interopRequireDefault(require_validate());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var byteToHex = [];
    for (let i = 0; i < 256; ++i) {
      byteToHex.push((i + 256).toString(16).slice(1));
    }
    function unsafeStringify(arr, offset = 0) {
      return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
    }
    function stringify(arr, offset = 0) {
      const uuid = unsafeStringify(arr, offset);
      if (!(0, _validate.default)(uuid)) {
        throw TypeError("Stringified UUID is invalid");
      }
      return uuid;
    }
    var _default = stringify;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v1.js
var require_v1 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v1.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _rng = _interopRequireDefault(require_rng());
    var _stringify = require_stringify();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var _nodeId;
    var _clockseq;
    var _lastMSecs = 0;
    var _lastNSecs = 0;
    function v1(options, buf, offset) {
      let i = buf && offset || 0;
      const b = buf || new Array(16);
      options = options || {};
      let node = options.node || _nodeId;
      let clockseq = options.clockseq !== void 0 ? options.clockseq : _clockseq;
      if (node == null || clockseq == null) {
        const seedBytes = options.random || (options.rng || _rng.default)();
        if (node == null) {
          node = _nodeId = [seedBytes[0] | 1, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
        }
        if (clockseq == null) {
          clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
        }
      }
      let msecs = options.msecs !== void 0 ? options.msecs : Date.now();
      let nsecs = options.nsecs !== void 0 ? options.nsecs : _lastNSecs + 1;
      const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 1e4;
      if (dt < 0 && options.clockseq === void 0) {
        clockseq = clockseq + 1 & 16383;
      }
      if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === void 0) {
        nsecs = 0;
      }
      if (nsecs >= 1e4) {
        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
      }
      _lastMSecs = msecs;
      _lastNSecs = nsecs;
      _clockseq = clockseq;
      msecs += 122192928e5;
      const tl = ((msecs & 268435455) * 1e4 + nsecs) % 4294967296;
      b[i++] = tl >>> 24 & 255;
      b[i++] = tl >>> 16 & 255;
      b[i++] = tl >>> 8 & 255;
      b[i++] = tl & 255;
      const tmh = msecs / 4294967296 * 1e4 & 268435455;
      b[i++] = tmh >>> 8 & 255;
      b[i++] = tmh & 255;
      b[i++] = tmh >>> 24 & 15 | 16;
      b[i++] = tmh >>> 16 & 255;
      b[i++] = clockseq >>> 8 | 128;
      b[i++] = clockseq & 255;
      for (let n = 0; n < 6; ++n) {
        b[i + n] = node[n];
      }
      return buf || (0, _stringify.unsafeStringify)(b);
    }
    var _default = v1;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/parse.js
var require_parse = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/parse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _validate = _interopRequireDefault(require_validate());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function parse(uuid) {
      if (!(0, _validate.default)(uuid)) {
        throw TypeError("Invalid UUID");
      }
      let v;
      const arr = new Uint8Array(16);
      arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
      arr[1] = v >>> 16 & 255;
      arr[2] = v >>> 8 & 255;
      arr[3] = v & 255;
      arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
      arr[5] = v & 255;
      arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
      arr[7] = v & 255;
      arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
      arr[9] = v & 255;
      arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255;
      arr[11] = v / 4294967296 & 255;
      arr[12] = v >>> 24 & 255;
      arr[13] = v >>> 16 & 255;
      arr[14] = v >>> 8 & 255;
      arr[15] = v & 255;
      return arr;
    }
    var _default = parse;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v35.js
var require_v35 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v35.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.URL = exports.DNS = void 0;
    exports.default = v35;
    var _stringify = require_stringify();
    var _parse = _interopRequireDefault(require_parse());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function stringToBytes(str) {
      str = unescape(encodeURIComponent(str));
      const bytes = [];
      for (let i = 0; i < str.length; ++i) {
        bytes.push(str.charCodeAt(i));
      }
      return bytes;
    }
    var DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    exports.DNS = DNS;
    var URL2 = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
    exports.URL = URL2;
    function v35(name, version, hashfunc) {
      function generateUUID(value, namespace, buf, offset) {
        var _namespace;
        if (typeof value === "string") {
          value = stringToBytes(value);
        }
        if (typeof namespace === "string") {
          namespace = (0, _parse.default)(namespace);
        }
        if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
          throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
        }
        let bytes = new Uint8Array(16 + value.length);
        bytes.set(namespace);
        bytes.set(value, namespace.length);
        bytes = hashfunc(bytes);
        bytes[6] = bytes[6] & 15 | version;
        bytes[8] = bytes[8] & 63 | 128;
        if (buf) {
          offset = offset || 0;
          for (let i = 0; i < 16; ++i) {
            buf[offset + i] = bytes[i];
          }
          return buf;
        }
        return (0, _stringify.unsafeStringify)(bytes);
      }
      try {
        generateUUID.name = name;
      } catch (err) {
      }
      generateUUID.DNS = DNS;
      generateUUID.URL = URL2;
      return generateUUID;
    }
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/md5.js
var require_md5 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/md5.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    function md5(bytes) {
      if (typeof bytes === "string") {
        const msg = unescape(encodeURIComponent(bytes));
        bytes = new Uint8Array(msg.length);
        for (let i = 0; i < msg.length; ++i) {
          bytes[i] = msg.charCodeAt(i);
        }
      }
      return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
    }
    function md5ToHexEncodedArray(input) {
      const output = [];
      const length32 = input.length * 32;
      const hexTab = "0123456789abcdef";
      for (let i = 0; i < length32; i += 8) {
        const x = input[i >> 5] >>> i % 32 & 255;
        const hex = parseInt(hexTab.charAt(x >>> 4 & 15) + hexTab.charAt(x & 15), 16);
        output.push(hex);
      }
      return output;
    }
    function getOutputLength(inputLength8) {
      return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
    }
    function wordsToMd5(x, len) {
      x[len >> 5] |= 128 << len % 32;
      x[getOutputLength(len) - 1] = len;
      let a = 1732584193;
      let b = -271733879;
      let c = -1732584194;
      let d = 271733878;
      for (let i = 0; i < x.length; i += 16) {
        const olda = a;
        const oldb = b;
        const oldc = c;
        const oldd = d;
        a = md5ff(a, b, c, d, x[i], 7, -680876936);
        d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5gg(b, c, d, a, x[i], 20, -373897302);
        a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5hh(d, a, b, c, x[i], 11, -358537222);
        c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = md5ii(a, b, c, d, x[i], 6, -198630844);
        d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = safeAdd(a, olda);
        b = safeAdd(b, oldb);
        c = safeAdd(c, oldc);
        d = safeAdd(d, oldd);
      }
      return [a, b, c, d];
    }
    function bytesToWords(input) {
      if (input.length === 0) {
        return [];
      }
      const length8 = input.length * 8;
      const output = new Uint32Array(getOutputLength(length8));
      for (let i = 0; i < length8; i += 8) {
        output[i >> 5] |= (input[i / 8] & 255) << i % 32;
      }
      return output;
    }
    function safeAdd(x, y) {
      const lsw = (x & 65535) + (y & 65535);
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return msw << 16 | lsw & 65535;
    }
    function bitRotateLeft(num, cnt) {
      return num << cnt | num >>> 32 - cnt;
    }
    function md5cmn(q, a, b, x, s, t) {
      return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    }
    function md5ff(a, b, c, d, x, s, t) {
      return md5cmn(b & c | ~b & d, a, b, x, s, t);
    }
    function md5gg(a, b, c, d, x, s, t) {
      return md5cmn(b & d | c & ~d, a, b, x, s, t);
    }
    function md5hh(a, b, c, d, x, s, t) {
      return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5ii(a, b, c, d, x, s, t) {
      return md5cmn(c ^ (b | ~d), a, b, x, s, t);
    }
    var _default = md5;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v3.js
var require_v3 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v3.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _v = _interopRequireDefault(require_v35());
    var _md = _interopRequireDefault(require_md5());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var v3 = (0, _v.default)("v3", 48, _md.default);
    var _default = v3;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/native.js
var require_native = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/native.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
    var _default = {
      randomUUID
    };
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v4.js
var require_v4 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v4.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _native = _interopRequireDefault(require_native());
    var _rng = _interopRequireDefault(require_rng());
    var _stringify = require_stringify();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function v4(options, buf, offset) {
      if (_native.default.randomUUID && !buf && !options) {
        return _native.default.randomUUID();
      }
      options = options || {};
      const rnds = options.random || (options.rng || _rng.default)();
      rnds[6] = rnds[6] & 15 | 64;
      rnds[8] = rnds[8] & 63 | 128;
      if (buf) {
        offset = offset || 0;
        for (let i = 0; i < 16; ++i) {
          buf[offset + i] = rnds[i];
        }
        return buf;
      }
      return (0, _stringify.unsafeStringify)(rnds);
    }
    var _default = v4;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/sha1.js
var require_sha1 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/sha1.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    function f(s, x, y, z) {
      switch (s) {
        case 0:
          return x & y ^ ~x & z;
        case 1:
          return x ^ y ^ z;
        case 2:
          return x & y ^ x & z ^ y & z;
        case 3:
          return x ^ y ^ z;
      }
    }
    function ROTL(x, n) {
      return x << n | x >>> 32 - n;
    }
    function sha1(bytes) {
      const K = [1518500249, 1859775393, 2400959708, 3395469782];
      const H = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
      if (typeof bytes === "string") {
        const msg = unescape(encodeURIComponent(bytes));
        bytes = [];
        for (let i = 0; i < msg.length; ++i) {
          bytes.push(msg.charCodeAt(i));
        }
      } else if (!Array.isArray(bytes)) {
        bytes = Array.prototype.slice.call(bytes);
      }
      bytes.push(128);
      const l = bytes.length / 4 + 2;
      const N = Math.ceil(l / 16);
      const M = new Array(N);
      for (let i = 0; i < N; ++i) {
        const arr = new Uint32Array(16);
        for (let j = 0; j < 16; ++j) {
          arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
        }
        M[i] = arr;
      }
      M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
      M[N - 1][14] = Math.floor(M[N - 1][14]);
      M[N - 1][15] = (bytes.length - 1) * 8 & 4294967295;
      for (let i = 0; i < N; ++i) {
        const W = new Uint32Array(80);
        for (let t = 0; t < 16; ++t) {
          W[t] = M[i][t];
        }
        for (let t = 16; t < 80; ++t) {
          W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
        }
        let a = H[0];
        let b = H[1];
        let c = H[2];
        let d = H[3];
        let e = H[4];
        for (let t = 0; t < 80; ++t) {
          const s = Math.floor(t / 20);
          const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
          e = d;
          d = c;
          c = ROTL(b, 30) >>> 0;
          b = a;
          a = T;
        }
        H[0] = H[0] + a >>> 0;
        H[1] = H[1] + b >>> 0;
        H[2] = H[2] + c >>> 0;
        H[3] = H[3] + d >>> 0;
        H[4] = H[4] + e >>> 0;
      }
      return [H[0] >> 24 & 255, H[0] >> 16 & 255, H[0] >> 8 & 255, H[0] & 255, H[1] >> 24 & 255, H[1] >> 16 & 255, H[1] >> 8 & 255, H[1] & 255, H[2] >> 24 & 255, H[2] >> 16 & 255, H[2] >> 8 & 255, H[2] & 255, H[3] >> 24 & 255, H[3] >> 16 & 255, H[3] >> 8 & 255, H[3] & 255, H[4] >> 24 & 255, H[4] >> 16 & 255, H[4] >> 8 & 255, H[4] & 255];
    }
    var _default = sha1;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v5.js
var require_v5 = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/v5.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _v = _interopRequireDefault(require_v35());
    var _sha = _interopRequireDefault(require_sha1());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var v5 = (0, _v.default)("v5", 80, _sha.default);
    var _default = v5;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/nil.js
var require_nil = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/nil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _default = "00000000-0000-0000-0000-000000000000";
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/version.js
var require_version = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/version.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _validate = _interopRequireDefault(require_validate());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function version(uuid) {
      if (!(0, _validate.default)(uuid)) {
        throw TypeError("Invalid UUID");
      }
      return parseInt(uuid.slice(14, 15), 16);
    }
    var _default = version;
    exports.default = _default;
  }
});

// node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/index.js
var require_commonjs_browser = __commonJS({
  "node_modules/@forge/react/node_modules/uuid/dist/commonjs-browser/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "NIL", {
      enumerable: true,
      get: function get() {
        return _nil.default;
      }
    });
    Object.defineProperty(exports, "parse", {
      enumerable: true,
      get: function get() {
        return _parse.default;
      }
    });
    Object.defineProperty(exports, "stringify", {
      enumerable: true,
      get: function get() {
        return _stringify.default;
      }
    });
    Object.defineProperty(exports, "v1", {
      enumerable: true,
      get: function get() {
        return _v.default;
      }
    });
    Object.defineProperty(exports, "v3", {
      enumerable: true,
      get: function get() {
        return _v2.default;
      }
    });
    Object.defineProperty(exports, "v4", {
      enumerable: true,
      get: function get() {
        return _v3.default;
      }
    });
    Object.defineProperty(exports, "v5", {
      enumerable: true,
      get: function get() {
        return _v4.default;
      }
    });
    Object.defineProperty(exports, "validate", {
      enumerable: true,
      get: function get() {
        return _validate.default;
      }
    });
    Object.defineProperty(exports, "version", {
      enumerable: true,
      get: function get() {
        return _version.default;
      }
    });
    var _v = _interopRequireDefault(require_v1());
    var _v2 = _interopRequireDefault(require_v3());
    var _v3 = _interopRequireDefault(require_v4());
    var _v4 = _interopRequireDefault(require_v5());
    var _nil = _interopRequireDefault(require_nil());
    var _version = _interopRequireDefault(require_version());
    var _validate = _interopRequireDefault(require_validate());
    var _stringify = _interopRequireDefault(require_stringify());
    var _parse = _interopRequireDefault(require_parse());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
  }
});

// node_modules/@forge/react/out/reconciler.js
var require_reconciler = __commonJS({
  "node_modules/@forge/react/out/reconciler.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ForgeReconciler = exports.hostConfig = exports.nonChildPropsAreEqual = exports.insertBefore = exports.appendChild = exports.createElement = exports.callBridge = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var react_reconciler_1 = tslib_1.__importDefault(require_react_reconciler());
    var constants_1 = require_constants2();
    var uuid_1 = require_commonjs_browser();
    var idPropsPrefixAppUUID = (0, uuid_1.v4)().slice(0, 5);
    var idPropsPrefix = `forge-app-${idPropsPrefixAppUUID}`;
    var newPropsWithIdPrefix = (props) => {
      const idProps = ["id", "labelFor", "inputId"];
      const newProps = idProps.reduce((acc, idProp) => {
        if (props[idProp]) {
          return {
            ...acc,
            [idProp]: `${idPropsPrefix}-${props[idProp]}`
          };
        }
        return acc;
      }, props);
      return newProps;
    };
    var attachFunctionPropId = (props) => {
      for (const key in props) {
        const propValue = props[key];
        if (typeof propValue === "function" && !propValue.__id__) {
          propValue.__id__ = (0, uuid_1.v4)();
        }
      }
      return props;
    };
    var handleReconcilerError = async (error) => {
      try {
        await self?.__bridge?.callBridge("onError", { error });
      } catch (e) {
        console.log("error calling bridge onError", e);
      }
    };
    var callBridge = function(cmd, data) {
      self?.__bridge?.callBridge(cmd, data);
    };
    exports.callBridge = callBridge;
    var createElement = ({ type, props = {}, forgeReactMajorVersion }) => {
      const { children, ...restProps } = props;
      const newProps = newPropsWithIdPrefix(attachFunctionPropId(restProps));
      const element = {
        type,
        children: [],
        props: newProps,
        key: (0, uuid_1.v4)()
      };
      if (forgeReactMajorVersion) {
        element.forgeReactMajorVersion = forgeReactMajorVersion;
      }
      return element;
    };
    exports.createElement = createElement;
    var appendChild = (parent, child) => {
      if (parent.children.includes(child)) {
        const removeIndex = parent.children.indexOf(child);
        parent.children.splice(removeIndex, 1);
      }
      parent.children.push(child);
    };
    exports.appendChild = appendChild;
    var insertBefore = (parent, child, beforeChild) => {
      const insertIndex = parent.children.indexOf(beforeChild);
      if (parent.children.includes(child)) {
        const removeIndex = parent.children.indexOf(child);
        parent.children.splice(removeIndex, 1);
      }
      parent.children.splice(insertIndex, 0, child);
    };
    exports.insertBefore = insertBefore;
    var nonChildPropsAreEqual = (oldProps, newProps) => {
      const newPropsKey = Object.keys(newProps).filter((key) => key !== "children");
      const oldPropsKey = Object.keys(oldProps).filter((key) => key !== "children");
      if (newPropsKey.length !== oldPropsKey.length) {
        return false;
      }
      for (const key of newPropsKey) {
        if (newProps[key] !== oldProps[key]) {
          return false;
        }
      }
      return true;
    };
    exports.nonChildPropsAreEqual = nonChildPropsAreEqual;
    exports.hostConfig = {
      supportsMutation: true,
      supportsPersistence: false,
      noTimeout: -1,
      isPrimaryRenderer: false,
      supportsHydration: false,
      resetAfterCommit(containerInfo) {
        (0, exports.callBridge)("reconcile", { forgeDoc: containerInfo });
      },
      createInstance(type, instanceProps) {
        const element = (0, exports.createElement)({ type, props: instanceProps });
        return element;
      },
      createTextInstance(text) {
        const element = (0, exports.createElement)({ type: "String", props: { text } });
        return element;
      },
      appendInitialChild(parentInstance, child) {
        (0, exports.appendChild)(parentInstance, child);
      },
      appendChild(parent, child) {
        (0, exports.appendChild)(parent, child);
      },
      appendChildToContainer(container, child) {
        (0, exports.appendChild)(container, child);
      },
      finalizeInitialChildren() {
        return false;
      },
      prepareUpdate(instance, type, oldProps, newProps) {
        instance.props = newProps;
        return newProps;
      },
      shouldSetTextContent() {
        return false;
      },
      getRootHostContext() {
        return {};
      },
      getChildHostContext() {
        return null;
      },
      getPublicInstance(instance) {
        return instance;
      },
      prepareForCommit() {
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      preparePortalMount() {
      },
      scheduleTimeout(fn, delay) {
        return setTimeout(fn, delay);
      },
      cancelTimeout(id) {
        clearTimeout(id);
      },
      insertBefore(parentInstance, child, beforeChild) {
        (0, exports.insertBefore)(parentInstance, child, beforeChild);
      },
      insertInContainerBefore(container, child, beforeChild) {
        (0, exports.insertBefore)(container, child, beforeChild);
      },
      removeChild(parent, child) {
        const removeIndex = parent.children.indexOf(child);
        parent.children.splice(removeIndex, 1);
      },
      removeChildFromContainer(container, child) {
        const removeIndex = container.children.indexOf(child);
        container.children.splice(removeIndex, 1);
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      resetTextContent() {
      },
      commitTextUpdate(textInstance, oldText, newText) {
        textInstance.props.text = newText;
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      commitMount() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      commitUpdate() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      hideInstance() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      hideTextInstance() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      unhideInstance() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      unhideTextInstance() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      clearContainer() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      detachDeletedInstance() {
      },
      getCurrentEventPriority() {
        return constants_1.DefaultEventPriority;
      },
      getInstanceFromNode() {
        return null;
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      beforeActiveInstanceBlur() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      afterActiveInstanceBlur() {
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      prepareScopeUpdate() {
      },
      getInstanceFromScope() {
        return null;
      }
    };
    var reconciler = (0, react_reconciler_1.default)(exports.hostConfig);
    exports.ForgeReconciler = {
      render: (element) => {
        const rootElement = (0, exports.createElement)({ type: "Root", props: {}, forgeReactMajorVersion: 11 });
        const container = reconciler.createContainer(rootElement, 0, null, false, null, "root", (err) => {
          console.log(err);
        }, null);
        try {
          reconciler.updateContainer(element, container, null, null);
        } catch (e) {
          void handleReconcilerError(e);
          throw e;
        }
      },
      addConfig: (element) => {
        const macroConfigElement = (0, exports.createElement)({ type: "MacroConfig", props: {}, forgeReactMajorVersion: 11 });
        const container = reconciler.createContainer(macroConfigElement, 0, null, false, null, "macroConfig", (err) => {
          console.log(err);
        }, null);
        reconciler.updateContainer(element, container, null, null);
      }
    };
    exports.default = exports.ForgeReconciler;
  }
});

// node_modules/react/cjs/react-jsx-runtime.production.min.js
var require_react_jsx_runtime_production_min = __commonJS({
  "node_modules/react/cjs/react-jsx-runtime.production.min.js"(exports) {
    "use strict";
    var f = require_react();
    var k = Symbol.for("react.element");
    var l = Symbol.for("react.fragment");
    var m = Object.prototype.hasOwnProperty;
    var n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner;
    var p = { key: true, ref: true, __self: true, __source: true };
    function q(c, a, g) {
      var b, d = {}, e = null, h = null;
      void 0 !== g && (e = "" + g);
      void 0 !== a.key && (e = "" + a.key);
      void 0 !== a.ref && (h = a.ref);
      for (b in a) m.call(a, b) && !p.hasOwnProperty(b) && (d[b] = a[b]);
      if (c && c.defaultProps) for (b in a = c.defaultProps, a) void 0 === d[b] && (d[b] = a[b]);
      return { $$typeof: k, type: c, key: e, ref: h, props: d, _owner: n.current };
    }
    exports.Fragment = l;
    exports.jsx = q;
    exports.jsxs = q;
  }
});

// node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_react_jsx_runtime_production_min();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/@forge/react/out/components/utils/content-wrapper.js
var require_content_wrapper = __commonJS({
  "node_modules/@forge/react/out/components/utils/content-wrapper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ContentWrapper = void 0;
    exports.ContentWrapper = "ContentWrapper";
  }
});

// node_modules/@forge/react/out/components/dynamic-table.js
var require_dynamic_table = __commonJS({
  "node_modules/@forge/react/out/components/dynamic-table.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DynamicTable = void 0;
    var jsx_runtime_1 = require_jsx_runtime();
    var react_1 = require_react();
    var content_wrapper_1 = require_content_wrapper();
    var DynamicTablePrimitive = "DynamicTable";
    var Cell = "Cell";
    var Row = "Row";
    var DynamicTable = ({ head, rows, ...tableProps }) => {
      const transformedHead = head?.cells.map((cell) => {
        const { content, key: cellKey, ...cellProps } = cell;
        const reconciledContent = (
          // @ts-ignore Not all constituents of type JSXElementConstructor are callable.
          (0, react_1.isValidElement)(content) && typeof content.type === "function" ? content.type(content.props) : content
        );
        return (
          // The 'key' prop needs to be renamed as it is a reserved keyword in React, and won't
          // get included in the props object otherwise.
          (0, jsx_runtime_1.jsx)(Cell, { cellKey, ...cellProps, children: reconciledContent }, cellKey)
        );
      });
      const transformedRows = rows?.map((row) => {
        const { cells, key: rowKey, ...rowProps } = row;
        const transformedCells = cells.map((cell) => {
          const { content, key: cellKey, ...cellProps } = cell;
          const reconciledContent = (
            // @ts-ignore Not all constituents of type JSXElementConstructor are callable.
            (0, react_1.isValidElement)(content) && typeof content.type === "function" ? content.type(content.props) : content
          );
          return (0, jsx_runtime_1.jsx)(Cell, { cellKey, ...cellProps, children: reconciledContent }, cellKey);
        });
        return (0, jsx_runtime_1.jsx)(Row, { rowKey, ...rowProps, children: transformedCells }, rowKey);
      });
      return (0, jsx_runtime_1.jsxs)(DynamicTablePrimitive, { ...tableProps, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "head", children: transformedHead }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "rows", children: transformedRows })] });
    };
    exports.DynamicTable = DynamicTable;
  }
});

// node_modules/@forge/react/out/components/inline-edit.js
var require_inline_edit = __commonJS({
  "node_modules/@forge/react/out/components/inline-edit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlineEdit = void 0;
    var jsx_runtime_1 = require_jsx_runtime();
    var react_1 = require_react();
    var content_wrapper_1 = require_content_wrapper();
    var InlineEditPrimitive = "InlineEdit";
    var InlineEdit = ({ label, readView, editView, validate, startWithEditViewOpen, keepEditViewOpenOnBlur, hideActionButtons, isRequired, readViewFitContainerWidth, editButtonLabel, confirmButtonLabel, cancelButtonLabel, defaultValue, isEditing, onConfirm, onCancel, onEdit }) => {
      const [prevValue, setPrevValue] = (0, react_1.useState)();
      const [value, setValue] = (0, react_1.useState)(defaultValue);
      const [_isEditing, _setIsEditing] = (0, react_1.useState)(startWithEditViewOpen ? startWithEditViewOpen : false);
      const [errorMessage, setErrorMessage] = (0, react_1.useState)(void 0);
      const internalValidate = (newValue, setEdit, onConfirm2) => {
        if (validate !== void 0) {
          const errorMessageFromValidation = validate(newValue, {}, {});
          const handleValidationResult = (error) => {
            setErrorMessage(error || void 0);
            if (error === void 0 && onConfirm2) {
              onConfirm2(newValue);
            }
            if (setEdit) {
              setEdit(error !== void 0);
            }
          };
          if (errorMessageFromValidation instanceof Promise) {
            void errorMessageFromValidation.then(handleValidationResult);
          } else {
            handleValidationResult(errorMessageFromValidation);
          }
        } else {
          if (setEdit) {
            setEdit(false);
          }
          if (onConfirm2) {
            onConfirm2(newValue);
          }
        }
      };
      const internalOnConfirm = () => {
        if (value === prevValue) {
          _setIsEditing(false);
          return;
        }
        internalValidate(value, _setIsEditing, onConfirm);
      };
      const internalOnChange = (e) => {
        const newValue = e.target ? e.target.value : e;
        setValue(newValue);
        internalValidate(newValue);
      };
      const internalOnEdit = () => {
        setErrorMessage(void 0);
        _setIsEditing(true);
        setPrevValue(value);
        onEdit?.();
      };
      const internalOnCancel = () => {
        _setIsEditing(false);
        setValue(prevValue);
        onCancel?.();
      };
      return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: (0, jsx_runtime_1.jsxs)(InlineEditPrimitive, { label, onConfirm: () => internalOnConfirm(), onEdit: () => internalOnEdit(), onCancel: () => internalOnCancel(), isEditing: isEditing !== void 0 ? isEditing : _isEditing, startWithEditViewOpen, keepEditViewOpenOnBlur, hideActionButtons, isRequired, readViewFitContainerWidth, editButtonLabel, confirmButtonLabel, cancelButtonLabel, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "editView", children: editView({
        onChange: internalOnChange,
        value,
        errorMessage,
        isInvalid: errorMessage !== void 0,
        "aria-invalid": errorMessage !== void 0 ? "true" : "false",
        isRequired: isRequired || false
      }) }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "readView", children: readView() })] }) });
    };
    exports.InlineEdit = InlineEdit;
  }
});

// node_modules/@forge/react/out/components/popup.js
var require_popup = __commonJS({
  "node_modules/@forge/react/out/components/popup.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Popup = void 0;
    var jsx_runtime_1 = require_jsx_runtime();
    var content_wrapper_1 = require_content_wrapper();
    var PopupPrimitive = "Popup";
    var Popup = ({ content, trigger, isOpen, id, testId, onClose, boundary, rootBoundary, shouldFlip, placement, fallbackPlacements, autoFocus, shouldUseCaptureOnOutsideClick, shouldFitContainer, shouldDisableFocusLock, strategy, role, label, titleId, shouldRenderToParent }) => {
      return (0, jsx_runtime_1.jsxs)(PopupPrimitive, { isOpen, id, testId, onClose, boundary, rootBoundary, shouldFlip, placement, fallbackPlacements, autoFocus, shouldUseCaptureOnOutsideClick, shouldFitContainer, shouldDisableFocusLock, shouldRenderToParent, strategy, role, label, titleId, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "content", children: content() }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "trigger", children: trigger() })] });
    };
    exports.Popup = Popup;
  }
});

// node_modules/@forge/react/out/components/comment.js
var require_comment = __commonJS({
  "node_modules/@forge/react/out/components/comment.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Comment = void 0;
    var jsx_runtime_1 = require_jsx_runtime();
    var content_wrapper_1 = require_content_wrapper();
    var CommentPrimitive = "Comment";
    var Comment = ({ avatar, content, ...rest }) => {
      return (0, jsx_runtime_1.jsxs)(CommentPrimitive, { ...rest, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "avatar", children: avatar }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "content", children: content })] });
    };
    exports.Comment = Comment;
  }
});

// node_modules/@babel/runtime/helpers/interopRequireDefault.js
var require_interopRequireDefault = __commonJS({
  "node_modules/@babel/runtime/helpers/interopRequireDefault.js"(exports, module) {
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : {
        "default": e
      };
    }
    module.exports = _interopRequireDefault, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
});

// node_modules/@babel/runtime/helpers/typeof.js
var require_typeof = __commonJS({
  "node_modules/@babel/runtime/helpers/typeof.js"(exports, module) {
    function _typeof(o) {
      "@babel/helpers - typeof";
      return module.exports = _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
        return typeof o2;
      } : function(o2) {
        return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
      }, module.exports.__esModule = true, module.exports["default"] = module.exports, _typeof(o);
    }
    module.exports = _typeof, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
});

// node_modules/@babel/runtime/helpers/toPrimitive.js
var require_toPrimitive = __commonJS({
  "node_modules/@babel/runtime/helpers/toPrimitive.js"(exports, module) {
    var _typeof = require_typeof()["default"];
    function toPrimitive(t, e) {
      if ("object" != _typeof(t) || !t) return t;
      var r;
      if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) {
        var i = r.call(t, e || "default");
        if ("object" != _typeof(i)) return i;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === e ? String : Number)(t);
    }
    module.exports = toPrimitive, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
});

// node_modules/@babel/runtime/helpers/toPropertyKey.js
var require_toPropertyKey = __commonJS({
  "node_modules/@babel/runtime/helpers/toPropertyKey.js"(exports, module) {
    var _typeof = require_typeof()["default"];
    var toPrimitive = require_toPrimitive();
    function toPropertyKey(t) {
      var i = toPrimitive(t, "string");
      return "symbol" == _typeof(i) ? i : i + "";
    }
    module.exports = toPropertyKey, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
});

// node_modules/@babel/runtime/helpers/defineProperty.js
var require_defineProperty = __commonJS({
  "node_modules/@babel/runtime/helpers/defineProperty.js"(exports, module) {
    var toPropertyKey = require_toPropertyKey();
    function _defineProperty(e, r, t) {
      return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
        value: t,
        enumerable: true,
        configurable: true,
        writable: true
      }) : e[r] = t, e;
    }
    module.exports = _defineProperty, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
});

// node_modules/@atlaskit/adf-utils/dist/cjs/traverse/traverse.js
var require_traverse = __commonJS({
  "node_modules/@atlaskit/adf-utils/dist/cjs/traverse/traverse.js"(exports) {
    "use strict";
    var _interopRequireDefault = require_interopRequireDefault();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.traverse = traverse;
    exports.validateVisitors = validateVisitors;
    var _defineProperty2 = _interopRequireDefault(require_defineProperty());
    function ownKeys2(e, r) {
      var t = Object.keys(e);
      if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        r && (o = o.filter(function(r2) {
          return Object.getOwnPropertyDescriptor(e, r2).enumerable;
        })), t.push.apply(t, o);
      }
      return t;
    }
    function _objectSpread(e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = null != arguments[r] ? arguments[r] : {};
        r % 2 ? ownKeys2(Object(t), true).forEach(function(r2) {
          (0, _defineProperty2.default)(e, r2, t[r2]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys2(Object(t)).forEach(function(r2) {
          Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
        });
      }
      return e;
    }
    function validateVisitors(_visitors) {
      return true;
    }
    function traverse(adf, visitors) {
      if (!validateVisitors(visitors)) {
        throw new Error('Visitors are not valid: "'.concat(Object.keys(visitors).join(", "), '"'));
      }
      return traverseNode(adf, {
        node: void 0
      }, visitors, 0, 0);
    }
    function traverseNode(adfNode, parent, visitors, index, depth) {
      var visitor = visitors[adfNode.type] || visitors["any"];
      var newNode = _objectSpread({}, adfNode);
      if (visitor) {
        var processedNode = visitor(_objectSpread({}, newNode), parent, index, depth);
        if (processedNode === false) {
          return false;
        }
        newNode = processedNode || adfNode;
      }
      if (newNode.content) {
        newNode.content = newNode.content.reduce(function(acc, node, idx) {
          if (!node) {
            return acc;
          }
          var processedNode2 = traverseNode(node, {
            node: newNode,
            parent
          }, visitors, idx, depth + 1);
          if (processedNode2 !== false) {
            acc.push(processedNode2);
          }
          return acc;
        }, []);
      }
      return newNode;
    }
  }
});

// node_modules/@atlaskit/adf-utils/dist/cjs/traverse/map.js
var require_map = __commonJS({
  "node_modules/@atlaskit/adf-utils/dist/cjs/traverse/map.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.map = map;
    var _traverse = require_traverse();
    function map(adf, callback) {
      var result = [];
      (0, _traverse.traverse)(adf, {
        any: function any(node) {
          result.push(callback(node));
        }
      });
      return result;
    }
  }
});

// node_modules/@atlaskit/adf-utils/dist/cjs/traverse/reduce.js
var require_reduce = __commonJS({
  "node_modules/@atlaskit/adf-utils/dist/cjs/traverse/reduce.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.reduce = reduce;
    var _traverse = require_traverse();
    function reduce(adf, callback, initial) {
      var result = initial;
      (0, _traverse.traverse)(adf, {
        any: function any(node) {
          result = callback(result, node);
        }
      });
      return result;
    }
  }
});

// node_modules/@atlaskit/adf-utils/dist/cjs/traverse/filter.js
var require_filter = __commonJS({
  "node_modules/@atlaskit/adf-utils/dist/cjs/traverse/filter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.filter = filter;
    var _traverse = require_traverse();
    function filter(adf, callback) {
      var result = [];
      (0, _traverse.traverse)(adf, {
        any: function any(node) {
          if (callback(node)) {
            result.push(node);
          }
        }
      });
      return result;
    }
  }
});

// node_modules/@atlaskit/adf-utils/dist/cjs/traverse.js
var require_traverse2 = __commonJS({
  "node_modules/@atlaskit/adf-utils/dist/cjs/traverse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "filter", {
      enumerable: true,
      get: function get() {
        return _filter.filter;
      }
    });
    Object.defineProperty(exports, "map", {
      enumerable: true,
      get: function get() {
        return _map.map;
      }
    });
    Object.defineProperty(exports, "reduce", {
      enumerable: true,
      get: function get() {
        return _reduce.reduce;
      }
    });
    Object.defineProperty(exports, "traverse", {
      enumerable: true,
      get: function get() {
        return _traverse.traverse;
      }
    });
    var _traverse = require_traverse();
    var _map = require_map();
    var _reduce = require_reduce();
    var _filter = require_filter();
  }
});

// node_modules/@forge/react/out/components/utils/replaceUnsupportedDocumentNodes.js
var require_replaceUnsupportedDocumentNodes = __commonJS({
  "node_modules/@forge/react/out/components/utils/replaceUnsupportedDocumentNodes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.replaceUnsupportedMediaNodes = exports.replaceUnsupportedDocumentNodes = void 0;
    var uuid_1 = require_commonjs_browser();
    var traverse_1 = require_traverse2();
    var replaceUnsupportedDocumentNodes = (document2, replaceUnsupportedNode) => {
      const visitors = {
        // Partially supported nodes
        emoji: (node, parent, index, depth) => {
          if (node?.attrs?.id) {
            if (node.attrs.id.includes("atlassian")) {
              return replaceUnsupportedNode(node, parent, index, depth);
            }
            const isIdGuid = (0, uuid_1.validate)(node.attrs.id);
            if (isIdGuid) {
              return replaceUnsupportedNode(node, parent, index, depth);
            }
          }
        },
        // Fully unsupported nodes
        extension: replaceUnsupportedNode,
        bodiedExtension: replaceUnsupportedNode,
        inlineExtension: replaceUnsupportedNode,
        // Nodes shown when a bad node is passed
        confluenceUnsupportedBlock: replaceUnsupportedNode,
        confluenceUnsupportedInline: replaceUnsupportedNode,
        confluenceJiraIssue: replaceUnsupportedNode,
        unsupportedBlock: replaceUnsupportedNode,
        unsupportedInline: replaceUnsupportedNode,
        unknownBlock: replaceUnsupportedNode
      };
      return replaceDocumentWithVisitor(document2, visitors);
    };
    exports.replaceUnsupportedDocumentNodes = replaceUnsupportedDocumentNodes;
    var replaceUnsupportedMediaNodes = (document2, replaceUnsupportedNode) => {
      const mediaVisitor = (node, parent, index, depth) => {
        if (!node?.attrs?.url) {
          return replaceUnsupportedNode(node, parent, index, depth);
        }
      };
      const visitors = {
        media: mediaVisitor,
        mediaInline: mediaVisitor
      };
      return replaceDocumentWithVisitor(document2, visitors);
    };
    exports.replaceUnsupportedMediaNodes = replaceUnsupportedMediaNodes;
    var replaceDocumentWithVisitor = (document2, visitors) => {
      const updatedDoc = (0, traverse_1.traverse)(document2, visitors);
      return updatedDoc ? { ...updatedDoc, version: document2.version } : document2;
    };
  }
});

// node_modules/@forge/react/out/components/adf-renderer.js
var require_adf_renderer2 = __commonJS({
  "node_modules/@forge/react/out/components/adf-renderer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AdfRenderer = void 0;
    var jsx_runtime_1 = require_jsx_runtime();
    var replaceUnsupportedDocumentNodes_1 = require_replaceUnsupportedDocumentNodes();
    var PlatformAdfRenderer = "AdfRenderer";
    var AdfRenderer = (props) => {
      const { replaceUnsupportedNode, document: document2, ...adfRendererProps } = props;
      const documentWithMedia = replaceUnsupportedNode ? (0, replaceUnsupportedDocumentNodes_1.replaceUnsupportedDocumentNodes)(document2, replaceUnsupportedNode) : document2;
      const documentWithoutMedia = replaceUnsupportedNode ? (0, replaceUnsupportedDocumentNodes_1.replaceUnsupportedMediaNodes)(documentWithMedia, replaceUnsupportedNode) : documentWithMedia;
      return (0, jsx_runtime_1.jsx)(PlatformAdfRenderer, { ...adfRendererProps, document: documentWithMedia, documentWithoutMedia });
    };
    exports.AdfRenderer = AdfRenderer;
  }
});

// node_modules/@forge/react/out/components/ui-kit-components.js
var require_ui_kit_components = __commonJS({
  "node_modules/@forge/react/out/components/ui-kit-components.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Stack = exports.Spinner = exports.SectionMessageAction = exports.SectionMessage = exports.Select = exports.Range = exports.RadioGroup = exports.Radio = exports.ProgressTracker = exports.ProgressBar = exports.PieChart = exports.ModalTransition = exports.ModalTitle = exports.ModalHeader = exports.ModalFooter = exports.ModalBody = exports.Modal = exports.Lozenge = exports.LoadingButton = exports.ListItem = exports.List = exports.LinkButton = exports.LineChart = exports.Label = exports.Inline = exports.Image = exports.Icon = exports.HorizontalStackBarChart = exports.HorizontalBarChart = exports.HelperMessage = exports.Heading = exports.FormSection = exports.FormHeader = exports.FormFooter = exports.Form = exports.FilePicker = exports.FileCard = exports.ErrorMessage = exports.EmptyState = exports.DonutChart = exports.DatePicker = exports.CodeBlock = exports.Code = exports.Checkbox = exports.Calendar = exports.ButtonGroup = exports.Button = exports.Box = exports.BarChart = exports.Badge = void 0;
    exports.Pagination = exports.BreadcrumbsItem = exports.Breadcrumbs = exports.Bleed = exports.UserGroup = exports.Frame = exports.UserPicker = exports.Link = exports.AtlassianIcon = exports.AtlassianTile = exports.User = exports.Tile = exports.ChromelessEditor = exports.CommentEditor = exports.Pressable = exports.RequiredAsterisk = exports.ValidMessage = exports.Text = exports.Tooltip = exports.Toggle = exports.TimePicker = exports.Textfield = exports.TextArea = exports.TagGroup = exports.Tag = exports.Tabs = exports.TabPanel = exports.TabList = exports.Tab = exports.StackBarChart = void 0;
    exports.Badge = "Badge";
    exports.BarChart = "BarChart";
    exports.Box = "Box";
    exports.Button = "Button";
    exports.ButtonGroup = "ButtonGroup";
    exports.Calendar = "Calendar";
    exports.Checkbox = "Checkbox";
    exports.Code = "Code";
    exports.CodeBlock = "CodeBlock";
    exports.DatePicker = "DatePicker";
    exports.DonutChart = "DonutChart";
    exports.EmptyState = "EmptyState";
    exports.ErrorMessage = "ErrorMessage";
    exports.FileCard = "FileCard";
    exports.FilePicker = "FilePicker";
    exports.Form = "Form";
    exports.FormFooter = "FormFooter";
    exports.FormHeader = "FormHeader";
    exports.FormSection = "FormSection";
    exports.Heading = "Heading";
    exports.HelperMessage = "HelperMessage";
    exports.HorizontalBarChart = "HorizontalBarChart";
    exports.HorizontalStackBarChart = "HorizontalStackBarChart";
    exports.Icon = "Icon";
    exports.Image = "Image";
    exports.Inline = "Inline";
    exports.Label = "Label";
    exports.LineChart = "LineChart";
    exports.LinkButton = "LinkButton";
    exports.List = "List";
    exports.ListItem = "ListItem";
    exports.LoadingButton = "LoadingButton";
    exports.Lozenge = "Lozenge";
    exports.Modal = "Modal";
    exports.ModalBody = "ModalBody";
    exports.ModalFooter = "ModalFooter";
    exports.ModalHeader = "ModalHeader";
    exports.ModalTitle = "ModalTitle";
    exports.ModalTransition = "ModalTransition";
    exports.PieChart = "PieChart";
    exports.ProgressBar = "ProgressBar";
    exports.ProgressTracker = "ProgressTracker";
    exports.Radio = "Radio";
    exports.RadioGroup = "RadioGroup";
    exports.Range = "Range";
    exports.Select = "Select";
    exports.SectionMessage = "SectionMessage";
    exports.SectionMessageAction = "SectionMessageAction";
    exports.Spinner = "Spinner";
    exports.Stack = "Stack";
    exports.StackBarChart = "StackBarChart";
    exports.Tab = "Tab";
    exports.TabList = "TabList";
    exports.TabPanel = "TabPanel";
    exports.Tabs = "Tabs";
    exports.Tag = "Tag";
    exports.TagGroup = "TagGroup";
    exports.TextArea = "TextArea";
    exports.Textfield = "Textfield";
    exports.TimePicker = "TimePicker";
    exports.Toggle = "Toggle";
    exports.Tooltip = "Tooltip";
    exports.Text = "Text";
    exports.ValidMessage = "ValidMessage";
    exports.RequiredAsterisk = "RequiredAsterisk";
    exports.Pressable = "Pressable";
    exports.CommentEditor = "CommentEditor";
    exports.ChromelessEditor = "ChromelessEditor";
    exports.Tile = "Tile";
    exports.User = "User";
    exports.AtlassianTile = "AtlassianTile";
    exports.AtlassianIcon = "AtlassianIcon";
    exports.Link = "Link";
    exports.UserPicker = "UserPicker";
    exports.Frame = "Frame";
    exports.UserGroup = "UserGroup";
    exports.Bleed = "Bleed";
    exports.Breadcrumbs = "Breadcrumbs";
    exports.BreadcrumbsItem = "BreadcrumbsItem";
    exports.Pagination = "Pagination";
  }
});

// node_modules/@forge/react/out/components/index.js
var require_components = __commonJS({
  "node_modules/@forge/react/out/components/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CheckboxGroup = exports.Strong = exports.Strike = exports.Em = exports.AdfRenderer = exports.Comment = exports.Popup = exports.InlineEdit = exports.DynamicTable = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var dynamic_table_1 = require_dynamic_table();
    Object.defineProperty(exports, "DynamicTable", { enumerable: true, get: function() {
      return dynamic_table_1.DynamicTable;
    } });
    var inline_edit_1 = require_inline_edit();
    Object.defineProperty(exports, "InlineEdit", { enumerable: true, get: function() {
      return inline_edit_1.InlineEdit;
    } });
    var popup_1 = require_popup();
    Object.defineProperty(exports, "Popup", { enumerable: true, get: function() {
      return popup_1.Popup;
    } });
    var comment_1 = require_comment();
    Object.defineProperty(exports, "Comment", { enumerable: true, get: function() {
      return comment_1.Comment;
    } });
    var adf_renderer_1 = require_adf_renderer2();
    Object.defineProperty(exports, "AdfRenderer", { enumerable: true, get: function() {
      return adf_renderer_1.AdfRenderer;
    } });
    exports.Em = "Em";
    exports.Strike = "Strike";
    exports.Strong = "Strong";
    tslib_1.__exportStar(require_ui_kit_components(), exports);
    exports.CheckboxGroup = "CheckboxGroup";
  }
});

// node_modules/@forge/react/out/hooks/types/entityProps.js
var require_entityProps = __commonJS({
  "node_modules/@forge/react/out/hooks/types/entityProps.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EntityPropertyRequestFailedError = void 0;
    var EntityPropertyRequestFailedError = class extends Error {
      constructor({ entityType, propertyKey, operation, status }) {
        super(`The request to ${operation} the ${entityType.toLowerCase()} property (${propertyKey}) failed with status (${status}).`);
      }
    };
    exports.EntityPropertyRequestFailedError = EntityPropertyRequestFailedError;
  }
});

// node_modules/@forge/react/out/hooks/types/confEntityProps.js
var require_confEntityProps = __commonJS({
  "node_modules/@forge/react/out/hooks/types/confEntityProps.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@forge/react/out/hooks/types/jiraEntityProps.js
var require_jiraEntityProps = __commonJS({
  "node_modules/@forge/react/out/hooks/types/jiraEntityProps.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@forge/react/out/hooks/types/index.js
var require_types3 = __commonJS({
  "node_modules/@forge/react/out/hooks/types/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_entityProps(), exports);
    tslib_1.__exportStar(require_confEntityProps(), exports);
    tslib_1.__exportStar(require_jiraEntityProps(), exports);
  }
});

// node_modules/@forge/react/out/hooks/utils/apiRequestUtils.js
var require_apiRequestUtils = __commonJS({
  "node_modules/@forge/react/out/hooks/utils/apiRequestUtils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assertSuccessfulResponse = exports.getJSONData = exports.makeRequest = exports.withContext = exports.FETCH_HEADERS = void 0;
    var bridge_1 = require_out3();
    var types_1 = require_types3();
    exports.FETCH_HEADERS = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    var withContext = ({ originalOperation, apiEndpoints, entityType, origPropertyKey }) => async (...args) => {
      const context = await bridge_1.view.getContext();
      const propertyKey = entityType === "Content" ? `forge-${context.localId}-${origPropertyKey}` : `forge-${origPropertyKey}`;
      if (entityType === "Space" || entityType === "Content") {
        const endpointFactory = apiEndpoints({ entityType, context });
        return originalOperation({ endpointFactory, propertyKey }, ...args);
      } else if (entityType === "Issue") {
        const endpointFactory = apiEndpoints(context);
        return originalOperation({ endpointFactory, propertyKey, context }, ...args);
      } else {
        throw new Error("Invalid entity type.");
      }
    };
    exports.withContext = withContext;
    var makeRequest = async ({ url, apiMethod, body, method }) => {
      const fetchOptions = { headers: exports.FETCH_HEADERS, method, body };
      try {
        return await apiMethod(url, fetchOptions);
      } catch (error) {
        throw new Error("An unknown network error occurred.");
      }
    };
    exports.makeRequest = makeRequest;
    var getJSONData = async (response) => {
      try {
        const data = await response.json();
        return data;
      } catch (err) {
        throw new Error("An invalid response is received from the server");
      }
    };
    exports.getJSONData = getJSONData;
    var assertSuccessfulResponse = ({ entityType, propertyKey, operation, response }) => {
      if (!response.ok) {
        throw new types_1.EntityPropertyRequestFailedError({ entityType, propertyKey, operation, status: response.status });
      }
    };
    exports.assertSuccessfulResponse = assertSuccessfulResponse;
  }
});

// node_modules/@forge/react/out/hooks/utils/valueUtils.js
var require_valueUtils = __commonJS({
  "node_modules/@forge/react/out/hooks/utils/valueUtils.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveValue = void 0;
    var resolveValue = async (defaultValue) => {
      const value = defaultValue instanceof Function ? defaultValue() : defaultValue;
      return await value;
    };
    exports.resolveValue = resolveValue;
  }
});

// node_modules/@forge/react/out/hooks/confluenceEntity.js
var require_confluenceEntity = __commonJS({
  "node_modules/@forge/react/out/hooks/confluenceEntity.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.confluenceEntity = exports.confAPIEndpoints = void 0;
    var bridge_1 = require_out3();
    var apiRequestUtils_1 = require_apiRequestUtils();
    var valueUtils_1 = require_valueUtils();
    var types_1 = require_types3();
    var confAPIEndpoints = ({ entityType, context }) => {
      let entityId, urlEntity;
      switch (entityType) {
        case "Space":
          entityId = context.extension.space?.id;
          urlEntity = "spaces";
          break;
        case "Content":
          entityId = context.extension.content?.id;
          urlEntity = "pages";
          break;
        default:
          throw new Error("Invalid entity type.");
      }
      if (!entityId) {
        throw new Error(`${entityType} properties not available for this app.`);
      }
      return {
        create: () => `/wiki/api/v2/${urlEntity}/${entityId}/properties`,
        fetch: (propertyKey) => `/wiki/api/v2/${urlEntity}/${entityId}/properties?key=${propertyKey}`,
        update: (propertyId) => `/wiki/api/v2/${urlEntity}/${entityId}/properties/${propertyId}`,
        delete: (propertyId) => `/wiki/api/v2/${urlEntity}/${entityId}/properties/${propertyId}`
      };
    };
    exports.confAPIEndpoints = confAPIEndpoints;
    var confluenceEntity = ({ entityType, origPropertyKey, initValue }) => {
      const apiMethod = bridge_1.requestConfluence;
      const withConfluenceContext = (originalOperation) => {
        return (0, apiRequestUtils_1.withContext)({
          originalOperation,
          apiEndpoints: exports.confAPIEndpoints,
          entityType,
          origPropertyKey
        });
      };
      const fetchOriginal = async ({ endpointFactory, propertyKey }) => {
        const url = endpointFactory.fetch(propertyKey);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "GET" });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "fetch", response });
        const existingData = await (0, apiRequestUtils_1.getJSONData)(response);
        return existingData.results[0];
      };
      const deleteProp = async ({ endpointFactory, propertyKey }) => {
        const originalProp = await fetchOriginal({ endpointFactory, propertyKey });
        if (!originalProp) {
          throw new types_1.EntityPropertyRequestFailedError({
            entityType,
            propertyKey,
            operation: "delete",
            status: 404
          });
        }
        const propertyId = originalProp.id;
        const url = endpointFactory.delete(propertyId);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "DELETE" });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "delete", response });
      };
      const getProp = async ({ endpointFactory, propertyKey }) => {
        const existingProp = await fetchOriginal({ endpointFactory, propertyKey });
        if (existingProp) {
          return existingProp;
        }
        const resolvedInitVal = await (0, valueUtils_1.resolveValue)(initValue);
        const url = endpointFactory.create();
        const body = JSON.stringify({ key: propertyKey, value: resolvedInitVal });
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "POST", body });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "create", response });
        return await (0, apiRequestUtils_1.getJSONData)(response);
      };
      const get = async ({ endpointFactory, propertyKey }) => {
        const propData = await getProp({ endpointFactory, propertyKey });
        return propData.value;
      };
      const update = async ({ endpointFactory, propertyKey }, valueUpdate) => {
        const originalProp = await getProp({ endpointFactory, propertyKey });
        const newValue = valueUpdate instanceof Function ? valueUpdate(originalProp.value) : valueUpdate;
        const propertyId = originalProp.id;
        const origVersion = originalProp?.version?.number;
        const url = endpointFactory.update(propertyId);
        const body = JSON.stringify({
          key: propertyKey,
          value: newValue,
          version: {
            number: origVersion + 1,
            message: `Update through UI Kit 2 use${entityType}Properties hook.`
          }
        });
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "PUT", body });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "update", response });
        return (await (0, apiRequestUtils_1.getJSONData)(response)).value;
      };
      return {
        get: withConfluenceContext(get),
        update: withConfluenceContext(update),
        delete: withConfluenceContext(deleteProp)
      };
    };
    exports.confluenceEntity = confluenceEntity;
  }
});

// node_modules/@forge/react/out/hooks/useEntityProperty.js
var require_useEntityProperty = __commonJS({
  "node_modules/@forge/react/out/hooks/useEntityProperty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useEntityProperty = void 0;
    var react_1 = require_react();
    var useEntityProperty = ({ entityManager, defaultRetryCount = 2 }) => {
      const [propValue, setPropValue] = (0, react_1.useState)();
      (0, react_1.useEffect)(() => {
        const getProp = async () => {
          const currentVal = await entityManager.get();
          setPropValue(currentVal);
        };
        getProp().catch(() => {
          getProp().catch((secondErr) => {
            throw secondErr;
          });
        });
      }, []);
      const updateProp = (0, react_1.useCallback)(async (valueUpdate, retryCount = defaultRetryCount) => {
        let success = false;
        let tryCounts = 0;
        const attempt = async () => setPropValue(await entityManager.update(valueUpdate));
        while (!success && tryCounts <= retryCount) {
          try {
            tryCounts++;
            await attempt();
            success = true;
          } catch (err) {
            if (tryCounts > retryCount) {
              console.error(err);
            }
          }
        }
        return success;
      }, [entityManager]);
      const deleteProp = (0, react_1.useCallback)(async () => {
        await entityManager.delete();
        setPropValue(void 0);
      }, [entityManager]);
      return [propValue, updateProp, deleteProp];
    };
    exports.useEntityProperty = useEntityProperty;
  }
});

// node_modules/@forge/react/out/hooks/useContentProperty.js
var require_useContentProperty = __commonJS({
  "node_modules/@forge/react/out/hooks/useContentProperty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useContentProperty = void 0;
    var react_1 = require_react();
    var bridge_1 = require_out3();
    var confluenceEntity_1 = require_confluenceEntity();
    var useEntityProperty_1 = require_useEntityProperty();
    var useContentProperty = (propertyKey, initValue) => {
      const entityManager = (0, react_1.useMemo)(() => (0, confluenceEntity_1.confluenceEntity)({
        entityType: "Content",
        origPropertyKey: propertyKey,
        initValue
      }), [propertyKey, initValue]);
      const [propValue, updateProp, deleteProp] = (0, useEntityProperty_1.useEntityProperty)({ entityManager });
      const updatePropWithEvent = (0, react_1.useCallback)(async (valueUpdate, retryCount) => {
        const success = await updateProp(valueUpdate, retryCount);
        if (success) {
          void bridge_1.events.emit("FORGE_CONTENT_PROPERTY_UPDATED", { propertyKey, valueUpdate });
        }
      }, [updateProp, propertyKey]);
      return [propValue, updatePropWithEvent, deleteProp];
    };
    exports.useContentProperty = useContentProperty;
  }
});

// node_modules/@forge/react/out/hooks/useSpaceProperty.js
var require_useSpaceProperty = __commonJS({
  "node_modules/@forge/react/out/hooks/useSpaceProperty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useSpaceProperty = void 0;
    var react_1 = require_react();
    var confluenceEntity_1 = require_confluenceEntity();
    var useEntityProperty_1 = require_useEntityProperty();
    var useSpaceProperty = (propertyKey, initValue) => {
      const entityManager = (0, react_1.useMemo)(() => (0, confluenceEntity_1.confluenceEntity)({
        entityType: "Space",
        origPropertyKey: propertyKey,
        initValue
      }), []);
      return (0, useEntityProperty_1.useEntityProperty)({ entityManager });
    };
    exports.useSpaceProperty = useSpaceProperty;
  }
});

// node_modules/@forge/react/out/hooks/jiraEntity.js
var require_jiraEntity = __commonJS({
  "node_modules/@forge/react/out/hooks/jiraEntity.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.jiraIssuePropsManager = exports.issueAPIEndpoints = void 0;
    var bridge_1 = require_out3();
    var apiRequestUtils_1 = require_apiRequestUtils();
    var valueUtils_1 = require_valueUtils();
    var types_1 = require_types3();
    var issueAPIEndpoints = (context) => {
      const issueId = context.extension.issue?.id;
      if (!issueId)
        throw new Error("Issue properties not available for this app.");
      return {
        create: () => `/rest/api/2/issue/properties`,
        fetch: (propertyKey) => `/rest/api/2/issue/${issueId}/properties/${propertyKey}`,
        update: (propertyKey) => `/rest/api/2/issue/${issueId}/properties/${propertyKey}`,
        delete: (propertyKey) => `/rest/api/2/issue/${issueId}/properties/${propertyKey}`
      };
    };
    exports.issueAPIEndpoints = issueAPIEndpoints;
    var jiraIssuePropsManager = ({ origPropertyKey, initValue }) => {
      const entityType = "Issue";
      const apiMethod = bridge_1.requestJira;
      const withIssueContext = (originalOperation) => {
        return (0, apiRequestUtils_1.withContext)({
          originalOperation,
          apiEndpoints: exports.issueAPIEndpoints,
          entityType: "Issue",
          origPropertyKey
        });
      };
      const fetchOriginal = async ({ endpointFactory, propertyKey }) => {
        const url = endpointFactory.fetch(propertyKey);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "GET" });
        try {
          (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "fetch", response });
        } catch (err) {
          if (response.status === 404) {
            return null;
          } else {
            throw err;
          }
        }
        const existingData = await (0, apiRequestUtils_1.getJSONData)(response);
        return existingData;
      };
      const deleteProp = async ({ endpointFactory, propertyKey }) => {
        const url = endpointFactory.delete(propertyKey);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "DELETE" });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "delete", response });
      };
      const get = async ({ endpointFactory, propertyKey, context }) => {
        const existingProp = await fetchOriginal({ endpointFactory, propertyKey, context });
        if (existingProp) {
          return existingProp.value;
        }
        const resolvedInitVal = await (0, valueUtils_1.resolveValue)(initValue);
        const url = endpointFactory.create();
        const entityId = context.extension.issue?.id;
        const bodyData = {
          entitiesIds: [entityId],
          properties: {
            [propertyKey]: resolvedInitVal
          }
        };
        const response = await (0, apiRequestUtils_1.makeRequest)({
          url,
          apiMethod,
          method: "POST",
          body: JSON.stringify(bodyData)
        });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "create", response });
        return resolvedInitVal;
      };
      const update = async ({ endpointFactory, propertyKey, context }, valueUpdate) => {
        const newValueOrRunUpdaterOnOriginal = async (valueUpdate2) => {
          if (!(valueUpdate2 instanceof Function)) {
            return valueUpdate2;
          }
          const originalProp = await fetchOriginal({ endpointFactory, propertyKey, context });
          if (!originalProp) {
            throw new types_1.EntityPropertyRequestFailedError({
              entityType,
              propertyKey,
              operation: "update",
              status: 404
            });
          }
          return valueUpdate2(originalProp.value);
        };
        const newValue = await newValueOrRunUpdaterOnOriginal(valueUpdate);
        const url = endpointFactory.update(propertyKey);
        const body = JSON.stringify(newValue);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: "PUT", body });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: "update", response });
        return newValue;
      };
      return {
        get: withIssueContext(get),
        update: withIssueContext(update),
        delete: withIssueContext(deleteProp)
      };
    };
    exports.jiraIssuePropsManager = jiraIssuePropsManager;
  }
});

// node_modules/@forge/react/out/hooks/useIssueProperty.js
var require_useIssueProperty = __commonJS({
  "node_modules/@forge/react/out/hooks/useIssueProperty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useIssueProperty = void 0;
    var react_1 = require_react();
    var jiraEntity_1 = require_jiraEntity();
    var useEntityProperty_1 = require_useEntityProperty();
    var useIssueProperty = (propertyKey, initValue) => {
      const entityManager = (0, react_1.useMemo)(() => (0, jiraEntity_1.jiraIssuePropsManager)({
        entityType: "Issue",
        origPropertyKey: propertyKey,
        initValue
      }), []);
      return (0, useEntityProperty_1.useEntityProperty)({ entityManager, defaultRetryCount: 0 });
    };
    exports.useIssueProperty = useIssueProperty;
  }
});

// node_modules/@forge/react/out/hooks/useTranslation.js
var require_useTranslation = __commonJS({
  "node_modules/@forge/react/out/hooks/useTranslation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.I18nProvider = exports.useTranslation = void 0;
    var jsx_runtime_1 = require_jsx_runtime();
    var react_1 = require_react();
    var bridge_1 = require_out3();
    var EMPTY_I18N_CONTEXT_VALUE = {
      ready: false,
      t: (key, defaultValue) => defaultValue ?? key
    };
    var I18nContext = (0, react_1.createContext)(EMPTY_I18N_CONTEXT_VALUE);
    var useTranslation = () => {
      return (0, react_1.useContext)(I18nContext);
    };
    exports.useTranslation = useTranslation;
    var I18nProvider = ({ children, locale }) => {
      const [i18nContextValue, setI18nContextValue] = (0, react_1.useState)(EMPTY_I18N_CONTEXT_VALUE);
      (0, react_1.useEffect)(() => {
        const loadI18nContext = async () => {
          let targetLocale = locale;
          if (!targetLocale) {
            const context = await bridge_1.view.getContext();
            targetLocale = context.locale;
          }
          const t = await bridge_1.i18n.createTranslationFunction(targetLocale);
          setI18nContextValue({
            ready: true,
            t,
            locale: targetLocale
          });
        };
        void loadI18nContext();
      }, [setI18nContextValue, locale]);
      return (0, jsx_runtime_1.jsx)(I18nContext.Provider, { value: i18nContextValue, children });
    };
    exports.I18nProvider = I18nProvider;
  }
});

// node_modules/react-hook-form/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "node_modules/react-hook-form/dist/index.cjs.js"(exports) {
    "use strict";
    var e = require_react();
    var t = (e2) => "checkbox" === e2.type;
    var r = (e2) => e2 instanceof Date;
    var s = (e2) => null == e2;
    var a = (e2) => "object" == typeof e2;
    var i = (e2) => !s(e2) && !Array.isArray(e2) && a(e2) && !r(e2);
    var n = (e2) => i(e2) && e2.target ? t(e2.target) ? e2.target.checked : e2.target.value : e2;
    var o = (e2, t2) => e2.has(((e3) => e3.substring(0, e3.search(/\.\d+(\.|$)/)) || e3)(t2));
    var l = "undefined" != typeof window && void 0 !== window.HTMLElement && "undefined" != typeof document;
    function u(e2) {
      let t2;
      const r2 = Array.isArray(e2), s2 = "undefined" != typeof FileList && e2 instanceof FileList;
      if (e2 instanceof Date) t2 = new Date(e2);
      else {
        if (l && (e2 instanceof Blob || s2) || !r2 && !i(e2)) return e2;
        if (t2 = r2 ? [] : Object.create(Object.getPrototypeOf(e2)), r2 || ((e3) => {
          const t3 = e3.constructor && e3.constructor.prototype;
          return i(t3) && t3.hasOwnProperty("isPrototypeOf");
        })(e2)) for (const r3 in e2) e2.hasOwnProperty(r3) && (t2[r3] = u(e2[r3]));
        else t2 = e2;
      }
      return t2;
    }
    var d = (e2) => /^\w*$/.test(e2);
    var c = (e2) => void 0 === e2;
    var f = (e2) => Array.isArray(e2) ? e2.filter(Boolean) : [];
    var m = (e2) => f(e2.replace(/["|']|\]/g, "").split(/\.|\[/));
    var y = (e2, t2, r2) => {
      if (!t2 || !i(e2)) return r2;
      const a2 = (d(t2) ? [t2] : m(t2)).reduce((e3, t3) => s(e3) ? e3 : e3[t3], e2);
      return c(a2) || a2 === e2 ? c(e2[t2]) ? r2 : e2[t2] : a2;
    };
    var g = (e2) => "boolean" == typeof e2;
    var p = (e2, t2, r2) => {
      let s2 = -1;
      const a2 = d(t2) ? [t2] : m(t2), n2 = a2.length, o2 = n2 - 1;
      for (; ++s2 < n2; ) {
        const t3 = a2[s2];
        let n3 = r2;
        if (s2 !== o2) {
          const r3 = e2[t3];
          n3 = i(r3) || Array.isArray(r3) ? r3 : isNaN(+a2[s2 + 1]) ? {} : [];
        }
        if ("__proto__" === t3 || "constructor" === t3 || "prototype" === t3) return;
        e2[t3] = n3, e2 = e2[t3];
      }
    };
    var _ = "blur";
    var b = "focusout";
    var h = "change";
    var v = "onBlur";
    var V = "onChange";
    var F = "onSubmit";
    var x = "onTouched";
    var A = "all";
    var S = "max";
    var w = "min";
    var k = "maxLength";
    var D = "minLength";
    var C = "pattern";
    var E = "required";
    var O = "validate";
    var M = e.createContext(null);
    M.displayName = "HookFormContext";
    var j = () => e.useContext(M);
    var U = (e2, t2, r2, s2 = true) => {
      const a2 = { defaultValues: t2._defaultValues };
      for (const i2 in e2) Object.defineProperty(a2, i2, { get: () => {
        const a3 = i2;
        return t2._proxyFormState[a3] !== A && (t2._proxyFormState[a3] = !s2 || A), r2 && (r2[a3] = true), e2[a3];
      } });
      return a2;
    };
    var T = "undefined" != typeof window ? e.useLayoutEffect : e.useEffect;
    function N(t2) {
      const r2 = j(), { control: s2 = r2.control, disabled: a2, name: i2, exact: n2 } = t2 || {}, [o2, l2] = e.useState(s2._formState), u2 = e.useRef({ isDirty: false, isLoading: false, dirtyFields: false, touchedFields: false, validatingFields: false, isValidating: false, isValid: false, errors: false });
      return T(() => s2._subscribe({ name: i2, formState: u2.current, exact: n2, callback: (e2) => {
        !a2 && l2({ ...s2._formState, ...e2 });
      } }), [i2, a2, n2]), e.useEffect(() => {
        u2.current.isValid && s2._setValid(true);
      }, [s2]), e.useMemo(() => U(o2, s2, u2.current, false), [o2, s2]);
    }
    var R = (e2) => "string" == typeof e2;
    var B = (e2, t2, r2, s2, a2) => R(e2) ? (s2 && t2.watch.add(e2), y(r2, e2, a2)) : Array.isArray(e2) ? e2.map((e3) => (s2 && t2.watch.add(e3), y(r2, e3))) : (s2 && (t2.watchAll = true), r2);
    var L = (e2) => s(e2) || !a(e2);
    function P(e2, t2, s2 = /* @__PURE__ */ new WeakSet()) {
      if (L(e2) || L(t2)) return e2 === t2;
      if (r(e2) && r(t2)) return e2.getTime() === t2.getTime();
      const a2 = Object.keys(e2), n2 = Object.keys(t2);
      if (a2.length !== n2.length) return false;
      if (s2.has(e2) || s2.has(t2)) return true;
      s2.add(e2), s2.add(t2);
      for (const o2 of a2) {
        const a3 = e2[o2];
        if (!n2.includes(o2)) return false;
        if ("ref" !== o2) {
          const e3 = t2[o2];
          if (r(a3) && r(e3) || i(a3) && i(e3) || Array.isArray(a3) && Array.isArray(e3) ? !P(a3, e3, s2) : a3 !== e3) return false;
        }
      }
      return true;
    }
    function W(t2) {
      const r2 = j(), { control: s2 = r2.control, name: a2, defaultValue: i2, disabled: n2, exact: o2, compute: l2 } = t2 || {}, u2 = e.useRef(i2), d2 = e.useRef(l2), c2 = e.useRef(void 0);
      d2.current = l2;
      const f2 = e.useMemo(() => s2._getWatch(a2, u2.current), [s2, a2]), [m2, y2] = e.useState(d2.current ? d2.current(f2) : f2);
      return T(() => s2._subscribe({ name: a2, formState: { values: true }, exact: o2, callback: (e2) => {
        if (!n2) {
          const t3 = B(a2, s2._names, e2.values || s2._formValues, false, u2.current);
          if (d2.current) {
            const e3 = d2.current(t3);
            P(e3, c2.current) || (y2(e3), c2.current = e3);
          } else y2(t3);
        }
      } }), [s2, n2, a2, o2]), e.useEffect(() => s2._removeUnmounted()), m2;
    }
    function I(t2) {
      const r2 = j(), { name: s2, disabled: a2, control: i2 = r2.control, shouldUnregister: l2, defaultValue: d2 } = t2, f2 = o(i2._names.array, s2), m2 = e.useMemo(() => y(i2._formValues, s2, y(i2._defaultValues, s2, d2)), [i2, s2, d2]), b2 = W({ control: i2, name: s2, defaultValue: m2, exact: true }), v2 = N({ control: i2, name: s2, exact: true }), V2 = e.useRef(t2), F2 = e.useRef(void 0), x2 = e.useRef(i2.register(s2, { ...t2.rules, value: b2, ...g(t2.disabled) ? { disabled: t2.disabled } : {} }));
      V2.current = t2;
      const A2 = e.useMemo(() => Object.defineProperties({}, { invalid: { enumerable: true, get: () => !!y(v2.errors, s2) }, isDirty: { enumerable: true, get: () => !!y(v2.dirtyFields, s2) }, isTouched: { enumerable: true, get: () => !!y(v2.touchedFields, s2) }, isValidating: { enumerable: true, get: () => !!y(v2.validatingFields, s2) }, error: { enumerable: true, get: () => y(v2.errors, s2) } }), [v2, s2]), S2 = e.useCallback((e2) => x2.current.onChange({ target: { value: n(e2), name: s2 }, type: h }), [s2]), w2 = e.useCallback(() => x2.current.onBlur({ target: { value: y(i2._formValues, s2), name: s2 }, type: _ }), [s2, i2._formValues]), k2 = e.useCallback((e2) => {
        const t3 = y(i2._fields, s2);
        t3 && e2 && (t3._f.ref = { focus: () => e2.focus && e2.focus(), select: () => e2.select && e2.select(), setCustomValidity: (t4) => e2.setCustomValidity(t4), reportValidity: () => e2.reportValidity() });
      }, [i2._fields, s2]), D2 = e.useMemo(() => ({ name: s2, value: b2, ...g(a2) || v2.disabled ? { disabled: v2.disabled || a2 } : {}, onChange: S2, onBlur: w2, ref: k2 }), [s2, a2, v2.disabled, S2, w2, k2, b2]);
      return e.useEffect(() => {
        const e2 = i2._options.shouldUnregister || l2, t3 = F2.current;
        t3 && t3 !== s2 && !f2 && i2.unregister(t3), i2.register(s2, { ...V2.current.rules, ...g(V2.current.disabled) ? { disabled: V2.current.disabled } : {} });
        const r3 = (e3, t4) => {
          const r4 = y(i2._fields, e3);
          r4 && r4._f && (r4._f.mount = t4);
        };
        if (r3(s2, true), e2) {
          const e3 = u(y(i2._options.defaultValues, s2, V2.current.defaultValue));
          p(i2._defaultValues, s2, e3), c(y(i2._formValues, s2)) && p(i2._formValues, s2, e3);
        }
        return !f2 && i2.register(s2), F2.current = s2, () => {
          (f2 ? e2 && !i2._state.action : e2) ? i2.unregister(s2) : r3(s2, false);
        };
      }, [s2, i2, f2, l2]), e.useEffect(() => {
        i2._setDisabledField({ disabled: a2, name: s2 });
      }, [a2, s2, i2]), e.useMemo(() => ({ field: D2, formState: v2, fieldState: A2 }), [D2, v2, A2]);
    }
    var q = (e2) => {
      const t2 = {};
      for (const r2 of Object.keys(e2)) if (a(e2[r2]) && null !== e2[r2]) {
        const s2 = q(e2[r2]);
        for (const e3 of Object.keys(s2)) t2[`${r2}.${e3}`] = s2[e3];
      } else t2[r2] = e2[r2];
      return t2;
    };
    var $ = "post";
    var H = (e2, t2, r2, s2, a2) => t2 ? { ...r2[e2], types: { ...r2[e2] && r2[e2].types ? r2[e2].types : {}, [s2]: a2 || true } } : {};
    var J = (e2) => Array.isArray(e2) ? e2 : [e2];
    var z = () => {
      let e2 = [];
      return { get observers() {
        return e2;
      }, next: (t2) => {
        for (const r2 of e2) r2.next && r2.next(t2);
      }, subscribe: (t2) => (e2.push(t2), { unsubscribe: () => {
        e2 = e2.filter((e3) => e3 !== t2);
      } }), unsubscribe: () => {
        e2 = [];
      } };
    };
    function G(e2, t2) {
      const r2 = {};
      for (const s2 in e2) if (e2.hasOwnProperty(s2)) {
        const a2 = e2[s2], n2 = t2[s2];
        if (a2 && i(a2) && n2) {
          const e3 = G(a2, n2);
          i(e3) && (r2[s2] = e3);
        } else e2[s2] && (r2[s2] = n2);
      }
      return r2;
    }
    var K = (e2) => i(e2) && !Object.keys(e2).length;
    var Q = (e2) => "file" === e2.type;
    var X = (e2) => "function" == typeof e2;
    var Y = (e2) => {
      if (!l) return false;
      const t2 = e2 ? e2.ownerDocument : 0;
      return e2 instanceof (t2 && t2.defaultView ? t2.defaultView.HTMLElement : HTMLElement);
    };
    var Z = (e2) => "select-multiple" === e2.type;
    var ee = (e2) => "radio" === e2.type;
    var te = (e2) => Y(e2) && e2.isConnected;
    function re(e2, t2) {
      const r2 = Array.isArray(t2) ? t2 : d(t2) ? [t2] : m(t2), s2 = 1 === r2.length ? e2 : (function(e3, t3) {
        const r3 = t3.slice(0, -1).length;
        let s3 = 0;
        for (; s3 < r3; ) e3 = c(e3) ? s3++ : e3[t3[s3++]];
        return e3;
      })(e2, r2), a2 = r2.length - 1, n2 = r2[a2];
      return s2 && delete s2[n2], 0 !== a2 && (i(s2) && K(s2) || Array.isArray(s2) && (function(e3) {
        for (const t3 in e3) if (e3.hasOwnProperty(t3) && !c(e3[t3])) return false;
        return true;
      })(s2)) && re(e2, r2.slice(0, -1)), e2;
    }
    function se(e2) {
      return Array.isArray(e2) || i(e2) && !((e3) => {
        for (const t2 in e3) if (X(e3[t2])) return true;
        return false;
      })(e2);
    }
    function ae(e2, t2 = {}) {
      for (const r2 in e2) se(e2[r2]) ? (t2[r2] = Array.isArray(e2[r2]) ? [] : {}, ae(e2[r2], t2[r2])) : c(e2[r2]) || (t2[r2] = true);
      return t2;
    }
    function ie(e2, t2, r2) {
      r2 || (r2 = ae(t2));
      for (const a2 in e2) se(e2[a2]) ? c(t2) || L(r2[a2]) ? r2[a2] = ae(e2[a2], Array.isArray(e2[a2]) ? [] : {}) : ie(e2[a2], s(t2) ? {} : t2[a2], r2[a2]) : r2[a2] = !P(e2[a2], t2[a2]);
      return r2;
    }
    var ne = { value: false, isValid: false };
    var oe = { value: true, isValid: true };
    var le = (e2) => {
      if (Array.isArray(e2)) {
        if (e2.length > 1) {
          const t2 = e2.filter((e3) => e3 && e3.checked && !e3.disabled).map((e3) => e3.value);
          return { value: t2, isValid: !!t2.length };
        }
        return e2[0].checked && !e2[0].disabled ? e2[0].attributes && !c(e2[0].attributes.value) ? c(e2[0].value) || "" === e2[0].value ? oe : { value: e2[0].value, isValid: true } : oe : ne;
      }
      return ne;
    };
    var ue = (e2, { valueAsNumber: t2, valueAsDate: r2, setValueAs: s2 }) => c(e2) ? e2 : t2 ? "" === e2 ? NaN : e2 ? +e2 : e2 : r2 && R(e2) ? new Date(e2) : s2 ? s2(e2) : e2;
    var de = { isValid: false, value: null };
    var ce = (e2) => Array.isArray(e2) ? e2.reduce((e3, t2) => t2 && t2.checked && !t2.disabled ? { isValid: true, value: t2.value } : e3, de) : de;
    function fe(e2) {
      const r2 = e2.ref;
      return Q(r2) ? r2.files : ee(r2) ? ce(e2.refs).value : Z(r2) ? [...r2.selectedOptions].map(({ value: e3 }) => e3) : t(r2) ? le(e2.refs).value : ue(c(r2.value) ? e2.ref.value : r2.value, e2);
    }
    var me = (e2) => e2 instanceof RegExp;
    var ye = (e2) => c(e2) ? e2 : me(e2) ? e2.source : i(e2) ? me(e2.value) ? e2.value.source : e2.value : e2;
    var ge = (e2) => ({ isOnSubmit: !e2 || e2 === F, isOnBlur: e2 === v, isOnChange: e2 === V, isOnAll: e2 === A, isOnTouch: e2 === x });
    var pe = "AsyncFunction";
    var _e = (e2) => !!e2 && !!e2.validate && !!(X(e2.validate) && e2.validate.constructor.name === pe || i(e2.validate) && Object.values(e2.validate).find((e3) => e3.constructor.name === pe));
    var be = (e2, t2, r2) => !r2 && (t2.watchAll || t2.watch.has(e2) || [...t2.watch].some((t3) => e2.startsWith(t3) && /^\.\w+/.test(e2.slice(t3.length))));
    var he = (e2, t2, r2, s2) => {
      for (const a2 of r2 || Object.keys(e2)) {
        const r3 = y(e2, a2);
        if (r3) {
          const { _f: e3, ...n2 } = r3;
          if (e3) {
            if (e3.refs && e3.refs[0] && t2(e3.refs[0], a2) && !s2) return true;
            if (e3.ref && t2(e3.ref, e3.name) && !s2) return true;
            if (he(n2, t2)) break;
          } else if (i(n2) && he(n2, t2)) break;
        }
      }
    };
    function ve(e2, t2, r2) {
      const s2 = y(e2, r2);
      if (s2 || d(r2)) return { error: s2, name: r2 };
      const a2 = r2.split(".");
      for (; a2.length; ) {
        const s3 = a2.join("."), i2 = y(t2, s3), n2 = y(e2, s3);
        if (i2 && !Array.isArray(i2) && r2 !== s3) return { name: r2 };
        if (n2 && n2.type) return { name: s3, error: n2 };
        if (n2 && n2.root && n2.root.type) return { name: `${s3}.root`, error: n2.root };
        a2.pop();
      }
      return { name: r2 };
    }
    var Ve = (e2, t2, r2) => {
      const s2 = J(y(e2, r2));
      return p(s2, "root", t2[r2]), p(e2, r2, s2), e2;
    };
    function Fe(e2, t2, r2 = "validate") {
      if (R(e2) || Array.isArray(e2) && e2.every(R) || g(e2) && !e2) return { type: r2, message: R(e2) ? e2 : "", ref: t2 };
    }
    var xe = (e2) => i(e2) && !me(e2) ? e2 : { value: e2, message: "" };
    var Ae = async (e2, r2, a2, n2, o2, l2) => {
      const { ref: u2, refs: d2, required: f2, maxLength: m2, minLength: p2, min: _2, max: b2, pattern: h2, validate: v2, name: V2, valueAsNumber: F2, mount: x2 } = e2._f, A2 = y(a2, V2);
      if (!x2 || r2.has(V2)) return {};
      const M2 = d2 ? d2[0] : u2, j2 = (e3) => {
        o2 && M2.reportValidity && (M2.setCustomValidity(g(e3) ? "" : e3 || ""), M2.reportValidity());
      }, U2 = {}, T2 = ee(u2), N2 = t(u2), B2 = T2 || N2, L2 = (F2 || Q(u2)) && c(u2.value) && c(A2) || Y(u2) && "" === u2.value || "" === A2 || Array.isArray(A2) && !A2.length, P2 = H.bind(null, V2, n2, U2), W2 = (e3, t2, r3, s2 = k, a3 = D) => {
        const i2 = e3 ? t2 : r3;
        U2[V2] = { type: e3 ? s2 : a3, message: i2, ref: u2, ...P2(e3 ? s2 : a3, i2) };
      };
      if (l2 ? !Array.isArray(A2) || !A2.length : f2 && (!B2 && (L2 || s(A2)) || g(A2) && !A2 || N2 && !le(d2).isValid || T2 && !ce(d2).isValid)) {
        const { value: e3, message: t2 } = R(f2) ? { value: !!f2, message: f2 } : xe(f2);
        if (e3 && (U2[V2] = { type: E, message: t2, ref: M2, ...P2(E, t2) }, !n2)) return j2(t2), U2;
      }
      if (!(L2 || s(_2) && s(b2))) {
        let e3, t2;
        const r3 = xe(b2), a3 = xe(_2);
        if (s(A2) || isNaN(A2)) {
          const s2 = u2.valueAsDate || new Date(A2), i2 = (e4) => /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toDateString() + " " + e4), n3 = "time" == u2.type, o3 = "week" == u2.type;
          R(r3.value) && A2 && (e3 = n3 ? i2(A2) > i2(r3.value) : o3 ? A2 > r3.value : s2 > new Date(r3.value)), R(a3.value) && A2 && (t2 = n3 ? i2(A2) < i2(a3.value) : o3 ? A2 < a3.value : s2 < new Date(a3.value));
        } else {
          const i2 = u2.valueAsNumber || (A2 ? +A2 : A2);
          s(r3.value) || (e3 = i2 > r3.value), s(a3.value) || (t2 = i2 < a3.value);
        }
        if ((e3 || t2) && (W2(!!e3, r3.message, a3.message, S, w), !n2)) return j2(U2[V2].message), U2;
      }
      if ((m2 || p2) && !L2 && (R(A2) || l2 && Array.isArray(A2))) {
        const e3 = xe(m2), t2 = xe(p2), r3 = !s(e3.value) && A2.length > +e3.value, a3 = !s(t2.value) && A2.length < +t2.value;
        if ((r3 || a3) && (W2(r3, e3.message, t2.message), !n2)) return j2(U2[V2].message), U2;
      }
      if (h2 && !L2 && R(A2)) {
        const { value: e3, message: t2 } = xe(h2);
        if (me(e3) && !A2.match(e3) && (U2[V2] = { type: C, message: t2, ref: u2, ...P2(C, t2) }, !n2)) return j2(t2), U2;
      }
      if (v2) {
        if (X(v2)) {
          const e3 = Fe(await v2(A2, a2), M2);
          if (e3 && (U2[V2] = { ...e3, ...P2(O, e3.message) }, !n2)) return j2(e3.message), U2;
        } else if (i(v2)) {
          let e3 = {};
          for (const t2 in v2) {
            if (!K(e3) && !n2) break;
            const r3 = Fe(await v2[t2](A2, a2), M2, t2);
            r3 && (e3 = { ...r3, ...P2(t2, r3.message) }, j2(r3.message), n2 && (U2[V2] = e3));
          }
          if (!K(e3) && (U2[V2] = { ref: M2, ...e3 }, !n2)) return U2;
        }
      }
      return j2(true), U2;
    };
    var Se = { mode: F, reValidateMode: V, shouldFocusError: true };
    function we(e2 = {}) {
      let a2, d2 = { ...Se, ...e2 }, m2 = { submitCount: 0, isDirty: false, isReady: false, isLoading: X(d2.defaultValues), isValidating: false, isSubmitted: false, isSubmitting: false, isSubmitSuccessful: false, isValid: false, touchedFields: {}, dirtyFields: {}, validatingFields: {}, errors: d2.errors || {}, disabled: d2.disabled || false }, h2 = {}, v2 = (i(d2.defaultValues) || i(d2.values)) && u(d2.defaultValues || d2.values) || {}, V2 = d2.shouldUnregister ? {} : u(v2), F2 = { action: false, mount: false, watch: false }, x2 = { mount: /* @__PURE__ */ new Set(), disabled: /* @__PURE__ */ new Set(), unMount: /* @__PURE__ */ new Set(), array: /* @__PURE__ */ new Set(), watch: /* @__PURE__ */ new Set() }, S2 = 0;
      const w2 = { isDirty: false, dirtyFields: false, validatingFields: false, touchedFields: false, isValidating: false, isValid: false, errors: false };
      let k2 = { ...w2 };
      const D2 = { array: z(), state: z() }, C2 = d2.criteriaMode === A, E2 = async (e3) => {
        if (!d2.disabled && (w2.isValid || k2.isValid || e3)) {
          const e4 = d2.resolver ? K((await T2()).errors) : await N2(h2, true);
          e4 !== m2.isValid && D2.state.next({ isValid: e4 });
        }
      }, O2 = (e3, t2) => {
        !d2.disabled && (w2.isValidating || w2.validatingFields || k2.isValidating || k2.validatingFields) && ((e3 || Array.from(x2.mount)).forEach((e4) => {
          e4 && (t2 ? p(m2.validatingFields, e4, t2) : re(m2.validatingFields, e4));
        }), D2.state.next({ validatingFields: m2.validatingFields, isValidating: !K(m2.validatingFields) }));
      }, M2 = (e3, t2, r2, s2) => {
        const a3 = y(h2, e3);
        if (a3) {
          const i2 = y(V2, e3, c(r2) ? y(v2, e3) : r2);
          c(i2) || s2 && s2.defaultChecked || t2 ? p(V2, e3, t2 ? i2 : fe(a3._f)) : I2(e3, i2), F2.mount && E2();
        }
      }, j2 = (e3, t2, r2, s2, a3) => {
        let i2 = false, n2 = false;
        const o2 = { name: e3 };
        if (!d2.disabled) {
          if (!r2 || s2) {
            (w2.isDirty || k2.isDirty) && (n2 = m2.isDirty, m2.isDirty = o2.isDirty = L2(), i2 = n2 !== o2.isDirty);
            const r3 = P(y(v2, e3), t2);
            n2 = !!y(m2.dirtyFields, e3), r3 ? re(m2.dirtyFields, e3) : p(m2.dirtyFields, e3, true), o2.dirtyFields = m2.dirtyFields, i2 = i2 || (w2.dirtyFields || k2.dirtyFields) && n2 !== !r3;
          }
          if (r2) {
            const t3 = y(m2.touchedFields, e3);
            t3 || (p(m2.touchedFields, e3, r2), o2.touchedFields = m2.touchedFields, i2 = i2 || (w2.touchedFields || k2.touchedFields) && t3 !== r2);
          }
          i2 && a3 && D2.state.next(o2);
        }
        return i2 ? o2 : {};
      }, U2 = (e3, t2, r2, s2) => {
        const i2 = y(m2.errors, e3), n2 = (w2.isValid || k2.isValid) && g(t2) && m2.isValid !== t2;
        var o2;
        if (d2.delayError && r2 ? (o2 = () => ((e4, t3) => {
          p(m2.errors, e4, t3), D2.state.next({ errors: m2.errors });
        })(e3, r2), a2 = (e4) => {
          clearTimeout(S2), S2 = setTimeout(o2, e4);
        }, a2(d2.delayError)) : (clearTimeout(S2), a2 = null, r2 ? p(m2.errors, e3, r2) : re(m2.errors, e3)), (r2 ? !P(i2, r2) : i2) || !K(s2) || n2) {
          const r3 = { ...s2, ...n2 && g(t2) ? { isValid: t2 } : {}, errors: m2.errors, name: e3 };
          m2 = { ...m2, ...r3 }, D2.state.next(r3);
        }
      }, T2 = async (e3) => {
        O2(e3, true);
        const t2 = await d2.resolver(V2, d2.context, ((e4, t3, r2, s2) => {
          const a3 = {};
          for (const r3 of e4) {
            const e5 = y(t3, r3);
            e5 && p(a3, r3, e5._f);
          }
          return { criteriaMode: r2, names: [...e4], fields: a3, shouldUseNativeValidation: s2 };
        })(e3 || x2.mount, h2, d2.criteriaMode, d2.shouldUseNativeValidation));
        return O2(e3), t2;
      }, N2 = async (e3, t2, r2 = { valid: true }) => {
        for (const s2 in e3) {
          const a3 = e3[s2];
          if (a3) {
            const { _f: e4, ...s3 } = a3;
            if (e4) {
              const s4 = x2.array.has(e4.name), i2 = a3._f && _e(a3._f);
              i2 && w2.validatingFields && O2([e4.name], true);
              const n2 = await Ae(a3, x2.disabled, V2, C2, d2.shouldUseNativeValidation && !t2, s4);
              if (i2 && w2.validatingFields && O2([e4.name]), n2[e4.name] && (r2.valid = false, t2)) break;
              !t2 && (y(n2, e4.name) ? s4 ? Ve(m2.errors, n2, e4.name) : p(m2.errors, e4.name, n2[e4.name]) : re(m2.errors, e4.name));
            }
            !K(s3) && await N2(s3, t2, r2);
          }
        }
        return r2.valid;
      }, L2 = (e3, t2) => !d2.disabled && (e3 && t2 && p(V2, e3, t2), !P(ne2(), v2)), W2 = (e3, t2, r2) => B(e3, x2, { ...F2.mount ? V2 : c(t2) ? v2 : R(e3) ? { [e3]: t2 } : t2 }, r2, t2), I2 = (e3, r2, a3 = {}) => {
        const i2 = y(h2, e3);
        let n2 = r2;
        if (i2) {
          const a4 = i2._f;
          a4 && (!a4.disabled && p(V2, e3, ue(r2, a4)), n2 = Y(a4.ref) && s(r2) ? "" : r2, Z(a4.ref) ? [...a4.ref.options].forEach((e4) => e4.selected = n2.includes(e4.value)) : a4.refs ? t(a4.ref) ? a4.refs.forEach((e4) => {
            e4.defaultChecked && e4.disabled || (Array.isArray(n2) ? e4.checked = !!n2.find((t2) => t2 === e4.value) : e4.checked = n2 === e4.value || !!n2);
          }) : a4.refs.forEach((e4) => e4.checked = e4.value === n2) : Q(a4.ref) ? a4.ref.value = "" : (a4.ref.value = n2, a4.ref.type || D2.state.next({ name: e3, values: u(V2) })));
        }
        (a3.shouldDirty || a3.shouldTouch) && j2(e3, n2, a3.shouldTouch, a3.shouldDirty, true), a3.shouldValidate && ae2(e3);
      }, q2 = (e3, t2, s2) => {
        for (const a3 in t2) {
          if (!t2.hasOwnProperty(a3)) return;
          const n2 = t2[a3], o2 = e3 + "." + a3, l2 = y(h2, o2);
          (x2.array.has(e3) || i(n2) || l2 && !l2._f) && !r(n2) ? q2(o2, n2, s2) : I2(o2, n2, s2);
        }
      }, $2 = (e3, t2, r2 = {}) => {
        const a3 = y(h2, e3), i2 = x2.array.has(e3), n2 = u(t2);
        p(V2, e3, n2), i2 ? (D2.array.next({ name: e3, values: u(V2) }), (w2.isDirty || w2.dirtyFields || k2.isDirty || k2.dirtyFields) && r2.shouldDirty && D2.state.next({ name: e3, dirtyFields: ie(v2, V2), isDirty: L2(e3, n2) })) : !a3 || a3._f || s(n2) ? I2(e3, n2, r2) : q2(e3, n2, r2), be(e3, x2) && D2.state.next({ ...m2, name: e3 }), D2.state.next({ name: F2.mount ? e3 : void 0, values: u(V2) });
      }, H2 = async (e3) => {
        F2.mount = true;
        const t2 = e3.target;
        let s2 = t2.name, i2 = true;
        const o2 = y(h2, s2), l2 = (e4) => {
          i2 = Number.isNaN(e4) || r(e4) && isNaN(e4.getTime()) || P(e4, y(V2, s2, e4));
        }, c2 = ge(d2.mode), f2 = ge(d2.reValidateMode);
        if (o2) {
          let r2, v3;
          const F3 = t2.type ? fe(o2._f) : n(e3), A2 = e3.type === _ || e3.type === b, S3 = !((g2 = o2._f).mount && (g2.required || g2.min || g2.max || g2.maxLength || g2.minLength || g2.pattern || g2.validate) || d2.resolver || y(m2.errors, s2) || o2._f.deps) || ((e4, t3, r3, s3, a3) => !a3.isOnAll && (!r3 && a3.isOnTouch ? !(t3 || e4) : (r3 ? s3.isOnBlur : a3.isOnBlur) ? !e4 : !(r3 ? s3.isOnChange : a3.isOnChange) || e4))(A2, y(m2.touchedFields, s2), m2.isSubmitted, f2, c2), M3 = be(s2, x2, A2);
          p(V2, s2, F3), A2 ? t2 && t2.readOnly || (o2._f.onBlur && o2._f.onBlur(e3), a2 && a2(0)) : o2._f.onChange && o2._f.onChange(e3);
          const R2 = j2(s2, F3, A2), B2 = !K(R2) || M3;
          if (!A2 && D2.state.next({ name: s2, type: e3.type, values: u(V2) }), S3) return (w2.isValid || k2.isValid) && ("onBlur" === d2.mode ? A2 && E2() : A2 || E2()), B2 && D2.state.next({ name: s2, ...M3 ? {} : R2 });
          if (!A2 && M3 && D2.state.next({ ...m2 }), d2.resolver) {
            const { errors: e4 } = await T2([s2]);
            if (l2(F3), i2) {
              const t3 = ve(m2.errors, h2, s2), a3 = ve(e4, h2, t3.name || s2);
              r2 = a3.error, s2 = a3.name, v3 = K(e4);
            }
          } else O2([s2], true), r2 = (await Ae(o2, x2.disabled, V2, C2, d2.shouldUseNativeValidation))[s2], O2([s2]), l2(F3), i2 && (r2 ? v3 = false : (w2.isValid || k2.isValid) && (v3 = await N2(h2, true)));
          i2 && (o2._f.deps && (!Array.isArray(o2._f.deps) || o2._f.deps.length > 0) && ae2(o2._f.deps), U2(s2, v3, r2, R2));
        }
        var g2;
      }, se2 = (e3, t2) => {
        if (y(m2.errors, t2) && e3.focus) return e3.focus(), 1;
      }, ae2 = async (e3, t2 = {}) => {
        let r2, s2;
        const a3 = J(e3);
        if (d2.resolver) {
          const t3 = await (async (e4) => {
            const { errors: t4 } = await T2(e4);
            if (e4) for (const r3 of e4) {
              const e5 = y(t4, r3);
              e5 ? p(m2.errors, r3, e5) : re(m2.errors, r3);
            }
            else m2.errors = t4;
            return t4;
          })(c(e3) ? e3 : a3);
          r2 = K(t3), s2 = e3 ? !a3.some((e4) => y(t3, e4)) : r2;
        } else e3 ? (s2 = (await Promise.all(a3.map(async (e4) => {
          const t3 = y(h2, e4);
          return await N2(t3 && t3._f ? { [e4]: t3 } : t3);
        }))).every(Boolean), (s2 || m2.isValid) && E2()) : s2 = r2 = await N2(h2);
        return D2.state.next({ ...!R(e3) || (w2.isValid || k2.isValid) && r2 !== m2.isValid ? {} : { name: e3 }, ...d2.resolver || !e3 ? { isValid: r2 } : {}, errors: m2.errors }), t2.shouldFocus && !s2 && he(h2, se2, e3 ? a3 : x2.mount), s2;
      }, ne2 = (e3, t2) => {
        let r2 = { ...F2.mount ? V2 : v2 };
        return t2 && (r2 = G(t2.dirtyFields ? m2.dirtyFields : m2.touchedFields, r2)), c(e3) ? r2 : R(e3) ? y(r2, e3) : e3.map((e4) => y(r2, e4));
      }, oe2 = (e3, t2) => ({ invalid: !!y((t2 || m2).errors, e3), isDirty: !!y((t2 || m2).dirtyFields, e3), error: y((t2 || m2).errors, e3), isValidating: !!y(m2.validatingFields, e3), isTouched: !!y((t2 || m2).touchedFields, e3) }), le2 = (e3, t2, r2) => {
        const s2 = (y(h2, e3, { _f: {} })._f || {}).ref, a3 = y(m2.errors, e3) || {}, { ref: i2, message: n2, type: o2, ...l2 } = a3;
        p(m2.errors, e3, { ...l2, ...t2, ref: s2 }), D2.state.next({ name: e3, errors: m2.errors, isValid: false }), r2 && r2.shouldFocus && s2 && s2.focus && s2.focus();
      }, de2 = (e3) => D2.state.subscribe({ next: (t2) => {
        var r2, s2, a3;
        r2 = e3.name, s2 = t2.name, a3 = e3.exact, r2 && s2 && r2 !== s2 && !J(r2).some((e4) => e4 && (a3 ? e4 === s2 : e4.startsWith(s2) || s2.startsWith(e4))) || !((e4, t3, r3, s3) => {
          r3(e4);
          const { name: a4, ...i2 } = e4;
          return K(i2) || Object.keys(i2).length >= Object.keys(t3).length || Object.keys(i2).find((e5) => t3[e5] === (!s3 || A));
        })(t2, e3.formState || w2, De2, e3.reRenderRoot) || e3.callback({ values: { ...V2 }, ...m2, ...t2, defaultValues: v2 });
      } }).unsubscribe, ce2 = (e3, t2 = {}) => {
        for (const r2 of e3 ? J(e3) : x2.mount) x2.mount.delete(r2), x2.array.delete(r2), t2.keepValue || (re(h2, r2), re(V2, r2)), !t2.keepError && re(m2.errors, r2), !t2.keepDirty && re(m2.dirtyFields, r2), !t2.keepTouched && re(m2.touchedFields, r2), !t2.keepIsValidating && re(m2.validatingFields, r2), !d2.shouldUnregister && !t2.keepDefaultValue && re(v2, r2);
        D2.state.next({ values: u(V2) }), D2.state.next({ ...m2, ...t2.keepDirty ? { isDirty: L2() } : {} }), !t2.keepIsValid && E2();
      }, me2 = ({ disabled: e3, name: t2 }) => {
        (g(e3) && F2.mount || e3 || x2.disabled.has(t2)) && (e3 ? x2.disabled.add(t2) : x2.disabled.delete(t2));
      }, pe2 = (e3, r2 = {}) => {
        let s2 = y(h2, e3);
        const a3 = g(r2.disabled) || g(d2.disabled);
        return p(h2, e3, { ...s2 || {}, _f: { ...s2 && s2._f ? s2._f : { ref: { name: e3 } }, name: e3, mount: true, ...r2 } }), x2.mount.add(e3), s2 ? me2({ disabled: g(r2.disabled) ? r2.disabled : d2.disabled, name: e3 }) : M2(e3, true, r2.value), { ...a3 ? { disabled: r2.disabled || d2.disabled } : {}, ...d2.progressive ? { required: !!r2.required, min: ye(r2.min), max: ye(r2.max), minLength: ye(r2.minLength), maxLength: ye(r2.maxLength), pattern: ye(r2.pattern) } : {}, name: e3, onChange: H2, onBlur: H2, ref: (a4) => {
          if (a4) {
            pe2(e3, r2), s2 = y(h2, e3);
            const i2 = c(a4.value) && a4.querySelectorAll && a4.querySelectorAll("input,select,textarea")[0] || a4, n2 = ((e4) => ee(e4) || t(e4))(i2), o2 = s2._f.refs || [];
            if (n2 ? o2.find((e4) => e4 === i2) : i2 === s2._f.ref) return;
            p(h2, e3, { _f: { ...s2._f, ...n2 ? { refs: [...o2.filter(te), i2, ...Array.isArray(y(v2, e3)) ? [{}] : []], ref: { type: i2.type, name: e3 } } : { ref: i2 } } }), M2(e3, false, void 0, i2);
          } else s2 = y(h2, e3, {}), s2._f && (s2._f.mount = false), (d2.shouldUnregister || r2.shouldUnregister) && (!o(x2.array, e3) || !F2.action) && x2.unMount.add(e3);
        } };
      }, Fe2 = () => d2.shouldFocusError && he(h2, se2, x2.mount), xe2 = (e3, t2) => async (r2) => {
        let s2;
        r2 && (r2.preventDefault && r2.preventDefault(), r2.persist && r2.persist());
        let a3 = u(V2);
        if (D2.state.next({ isSubmitting: true }), d2.resolver) {
          const { errors: e4, values: t3 } = await T2();
          m2.errors = e4, a3 = u(t3);
        } else await N2(h2);
        if (x2.disabled.size) for (const e4 of x2.disabled) re(a3, e4);
        if (re(m2.errors, "root"), K(m2.errors)) {
          D2.state.next({ errors: {} });
          try {
            await e3(a3, r2);
          } catch (e4) {
            s2 = e4;
          }
        } else t2 && await t2({ ...m2.errors }, r2), Fe2(), setTimeout(Fe2);
        if (D2.state.next({ isSubmitted: true, isSubmitting: false, isSubmitSuccessful: K(m2.errors) && !s2, submitCount: m2.submitCount + 1, errors: m2.errors }), s2) throw s2;
      }, we2 = (e3, t2 = {}) => {
        const r2 = e3 ? u(e3) : v2, s2 = u(r2), a3 = K(e3), i2 = a3 ? v2 : s2;
        if (t2.keepDefaultValues || (v2 = r2), !t2.keepValues) {
          if (t2.keepDirtyValues) {
            const e4 = /* @__PURE__ */ new Set([...x2.mount, ...Object.keys(ie(v2, V2))]);
            for (const t3 of Array.from(e4)) y(m2.dirtyFields, t3) ? p(i2, t3, y(V2, t3)) : $2(t3, y(i2, t3));
          } else {
            if (l && c(e3)) for (const e4 of x2.mount) {
              const t3 = y(h2, e4);
              if (t3 && t3._f) {
                const e5 = Array.isArray(t3._f.refs) ? t3._f.refs[0] : t3._f.ref;
                if (Y(e5)) {
                  const t4 = e5.closest("form");
                  if (t4) {
                    t4.reset();
                    break;
                  }
                }
              }
            }
            if (t2.keepFieldsRef) for (const e4 of x2.mount) $2(e4, y(i2, e4));
            else h2 = {};
          }
          V2 = d2.shouldUnregister ? t2.keepDefaultValues ? u(v2) : {} : u(i2), D2.array.next({ values: { ...i2 } }), D2.state.next({ values: { ...i2 } });
        }
        x2 = { mount: t2.keepDirtyValues ? x2.mount : /* @__PURE__ */ new Set(), unMount: /* @__PURE__ */ new Set(), array: /* @__PURE__ */ new Set(), disabled: /* @__PURE__ */ new Set(), watch: /* @__PURE__ */ new Set(), watchAll: false, focus: "" }, F2.mount = !w2.isValid || !!t2.keepIsValid || !!t2.keepDirtyValues, F2.watch = !!d2.shouldUnregister, D2.state.next({ submitCount: t2.keepSubmitCount ? m2.submitCount : 0, isDirty: !a3 && (t2.keepDirty ? m2.isDirty : !(!t2.keepDefaultValues || P(e3, v2))), isSubmitted: !!t2.keepIsSubmitted && m2.isSubmitted, dirtyFields: a3 ? {} : t2.keepDirtyValues ? t2.keepDefaultValues && V2 ? ie(v2, V2) : m2.dirtyFields : t2.keepDefaultValues && e3 ? ie(v2, e3) : t2.keepDirty ? m2.dirtyFields : {}, touchedFields: t2.keepTouched ? m2.touchedFields : {}, errors: t2.keepErrors ? m2.errors : {}, isSubmitSuccessful: !!t2.keepIsSubmitSuccessful && m2.isSubmitSuccessful, isSubmitting: false, defaultValues: v2 });
      }, ke2 = (e3, t2) => we2(X(e3) ? e3(V2) : e3, t2), De2 = (e3) => {
        m2 = { ...m2, ...e3 };
      }, Ce2 = { control: { register: pe2, unregister: ce2, getFieldState: oe2, handleSubmit: xe2, setError: le2, _subscribe: de2, _runSchema: T2, _focusError: Fe2, _getWatch: W2, _getDirty: L2, _setValid: E2, _setFieldArray: (e3, t2 = [], r2, s2, a3 = true, i2 = true) => {
        if (s2 && r2 && !d2.disabled) {
          if (F2.action = true, i2 && Array.isArray(y(h2, e3))) {
            const t3 = r2(y(h2, e3), s2.argA, s2.argB);
            a3 && p(h2, e3, t3);
          }
          if (i2 && Array.isArray(y(m2.errors, e3))) {
            const t3 = r2(y(m2.errors, e3), s2.argA, s2.argB);
            a3 && p(m2.errors, e3, t3), ((e4, t4) => {
              !f(y(e4, t4)).length && re(e4, t4);
            })(m2.errors, e3);
          }
          if ((w2.touchedFields || k2.touchedFields) && i2 && Array.isArray(y(m2.touchedFields, e3))) {
            const t3 = r2(y(m2.touchedFields, e3), s2.argA, s2.argB);
            a3 && p(m2.touchedFields, e3, t3);
          }
          (w2.dirtyFields || k2.dirtyFields) && (m2.dirtyFields = ie(v2, V2)), D2.state.next({ name: e3, isDirty: L2(e3, t2), dirtyFields: m2.dirtyFields, errors: m2.errors, isValid: m2.isValid });
        } else p(V2, e3, t2);
      }, _setDisabledField: me2, _setErrors: (e3) => {
        m2.errors = e3, D2.state.next({ errors: m2.errors, isValid: false });
      }, _getFieldArray: (e3) => f(y(F2.mount ? V2 : v2, e3, d2.shouldUnregister ? y(v2, e3, []) : [])), _reset: we2, _resetDefaultValues: () => X(d2.defaultValues) && d2.defaultValues().then((e3) => {
        ke2(e3, d2.resetOptions), D2.state.next({ isLoading: false });
      }), _removeUnmounted: () => {
        for (const e3 of x2.unMount) {
          const t2 = y(h2, e3);
          t2 && (t2._f.refs ? t2._f.refs.every((e4) => !te(e4)) : !te(t2._f.ref)) && ce2(e3);
        }
        x2.unMount = /* @__PURE__ */ new Set();
      }, _disableForm: (e3) => {
        g(e3) && (D2.state.next({ disabled: e3 }), he(h2, (t2, r2) => {
          const s2 = y(h2, r2);
          s2 && (t2.disabled = s2._f.disabled || e3, Array.isArray(s2._f.refs) && s2._f.refs.forEach((t3) => {
            t3.disabled = s2._f.disabled || e3;
          }));
        }, 0, false));
      }, _subjects: D2, _proxyFormState: w2, get _fields() {
        return h2;
      }, get _formValues() {
        return V2;
      }, get _state() {
        return F2;
      }, set _state(e3) {
        F2 = e3;
      }, get _defaultValues() {
        return v2;
      }, get _names() {
        return x2;
      }, set _names(e3) {
        x2 = e3;
      }, get _formState() {
        return m2;
      }, get _options() {
        return d2;
      }, set _options(e3) {
        d2 = { ...d2, ...e3 };
      } }, subscribe: (e3) => (F2.mount = true, k2 = { ...k2, ...e3.formState }, de2({ ...e3, formState: k2 })), trigger: ae2, register: pe2, handleSubmit: xe2, watch: (e3, t2) => X(e3) ? D2.state.subscribe({ next: (r2) => "values" in r2 && e3(W2(void 0, t2), r2) }) : W2(e3, t2, true), setValue: $2, getValues: ne2, reset: ke2, resetField: (e3, t2 = {}) => {
        y(h2, e3) && (c(t2.defaultValue) ? $2(e3, u(y(v2, e3))) : ($2(e3, t2.defaultValue), p(v2, e3, u(t2.defaultValue))), t2.keepTouched || re(m2.touchedFields, e3), t2.keepDirty || (re(m2.dirtyFields, e3), m2.isDirty = t2.defaultValue ? L2(e3, u(y(v2, e3))) : L2()), t2.keepError || (re(m2.errors, e3), w2.isValid && E2()), D2.state.next({ ...m2 }));
      }, clearErrors: (e3) => {
        e3 && J(e3).forEach((e4) => re(m2.errors, e4)), D2.state.next({ errors: e3 ? m2.errors : {} });
      }, unregister: ce2, setError: le2, setFocus: (e3, t2 = {}) => {
        const r2 = y(h2, e3), s2 = r2 && r2._f;
        if (s2) {
          const e4 = s2.refs ? s2.refs[0] : s2.ref;
          e4.focus && (e4.focus(), t2.shouldSelect && X(e4.select) && e4.select());
        }
      }, getFieldState: oe2 };
      return { ...Ce2, formControl: Ce2 };
    }
    var ke = () => {
      if ("undefined" != typeof crypto && crypto.randomUUID) return crypto.randomUUID();
      const e2 = "undefined" == typeof performance ? Date.now() : 1e3 * performance.now();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (t2) => {
        const r2 = (16 * Math.random() + e2) % 16 | 0;
        return ("x" == t2 ? r2 : 3 & r2 | 8).toString(16);
      });
    };
    var De = (e2, t2, r2 = {}) => r2.shouldFocus || c(r2.shouldFocus) ? r2.focusName || `${e2}.${c(r2.focusIndex) ? t2 : r2.focusIndex}.` : "";
    var Ce = (e2, t2) => [...e2, ...J(t2)];
    var Ee = (e2) => Array.isArray(e2) ? e2.map(() => {
    }) : void 0;
    function Oe(e2, t2, r2) {
      return [...e2.slice(0, t2), ...J(r2), ...e2.slice(t2)];
    }
    var Me = (e2, t2, r2) => Array.isArray(e2) ? (c(e2[r2]) && (e2[r2] = void 0), e2.splice(r2, 0, e2.splice(t2, 1)[0]), e2) : [];
    var je = (e2, t2) => [...J(t2), ...J(e2)];
    var Ue = (e2, t2) => c(t2) ? [] : (function(e3, t3) {
      let r2 = 0;
      const s2 = [...e3];
      for (const e4 of t3) s2.splice(e4 - r2, 1), r2++;
      return f(s2).length ? s2 : [];
    })(e2, J(t2).sort((e3, t3) => e3 - t3));
    var Te = (e2, t2, r2) => {
      [e2[t2], e2[r2]] = [e2[r2], e2[t2]];
    };
    var Ne = (e2, t2, r2) => (e2[t2] = r2, e2);
    exports.Controller = (e2) => e2.render(I(e2)), exports.Form = function(t2) {
      const r2 = j(), [s2, a2] = e.useState(false), { control: i2 = r2.control, onSubmit: n2, children: o2, action: l2, method: u2 = $, headers: d2, encType: c2, onError: f2, render: m2, onSuccess: y2, validateStatus: g2, ...p2 } = t2, _2 = async (e2) => {
        let r3 = false, s3 = "";
        await i2.handleSubmit(async (t3) => {
          const a3 = new FormData();
          let o3 = "";
          try {
            o3 = JSON.stringify(t3);
          } catch (e3) {
          }
          const m3 = q(i2._formValues);
          for (const e3 in m3) a3.append(e3, m3[e3]);
          if (n2 && await n2({ data: t3, event: e2, method: u2, formData: a3, formDataJson: o3 }), l2) try {
            const e3 = [d2 && d2["Content-Type"], c2].some((e4) => e4 && e4.includes("json")), t4 = await fetch(String(l2), { method: u2, headers: { ...d2, ...c2 && "multipart/form-data" !== c2 ? { "Content-Type": c2 } : {} }, body: e3 ? o3 : a3 });
            t4 && (g2 ? !g2(t4.status) : t4.status < 200 || t4.status >= 300) ? (r3 = true, f2 && f2({ response: t4 }), s3 = String(t4.status)) : y2 && y2({ response: t4 });
          } catch (e3) {
            r3 = true, f2 && f2({ error: e3 });
          }
        })(e2), r3 && t2.control && (t2.control._subjects.state.next({ isSubmitSuccessful: false }), t2.control.setError("root.server", { type: s3 }));
      };
      return e.useEffect(() => {
        a2(true);
      }, []), m2 ? e.createElement(e.Fragment, null, m2({ submit: _2 })) : e.createElement("form", { noValidate: s2, action: l2, method: u2, encType: c2, onSubmit: _2, ...p2 }, o2);
    }, exports.FormProvider = (t2) => {
      const { children: r2, ...s2 } = t2;
      return e.createElement(M.Provider, { value: s2 }, r2);
    }, exports.Watch = ({ control: e2, names: t2, render: r2 }) => r2(W({ control: e2, name: t2 })), exports.appendErrors = H, exports.createFormControl = we, exports.get = y, exports.set = p, exports.useController = I, exports.useFieldArray = function(t2) {
      const r2 = j(), { control: s2 = r2.control, name: a2, keyName: i2 = "id", shouldUnregister: n2, rules: o2 } = t2, [l2, d2] = e.useState(s2._getFieldArray(a2)), c2 = e.useRef(s2._getFieldArray(a2).map(ke)), f2 = e.useRef(false);
      s2._names.array.add(a2), e.useMemo(() => o2 && l2.length >= 0 && s2.register(a2, o2), [s2, a2, l2.length, o2]), T(() => s2._subjects.array.subscribe({ next: ({ values: e2, name: t3 }) => {
        if (t3 === a2 || !t3) {
          const t4 = y(e2, a2);
          Array.isArray(t4) && (d2(t4), c2.current = t4.map(ke));
        }
      } }).unsubscribe, [s2, a2]);
      const m2 = e.useCallback((e2) => {
        f2.current = true, s2._setFieldArray(a2, e2);
      }, [s2, a2]);
      return e.useEffect(() => {
        if (s2._state.action = false, be(a2, s2._names) && s2._subjects.state.next({ ...s2._formState }), f2.current && (!ge(s2._options.mode).isOnSubmit || s2._formState.isSubmitted) && !ge(s2._options.reValidateMode).isOnSubmit) if (s2._options.resolver) s2._runSchema([a2]).then((e2) => {
          const t3 = y(e2.errors, a2), r3 = y(s2._formState.errors, a2);
          (r3 ? !t3 && r3.type || t3 && (r3.type !== t3.type || r3.message !== t3.message) : t3 && t3.type) && (t3 ? p(s2._formState.errors, a2, t3) : re(s2._formState.errors, a2), s2._subjects.state.next({ errors: s2._formState.errors }));
        });
        else {
          const e2 = y(s2._fields, a2);
          !e2 || !e2._f || ge(s2._options.reValidateMode).isOnSubmit && ge(s2._options.mode).isOnSubmit || Ae(e2, s2._names.disabled, s2._formValues, s2._options.criteriaMode === A, s2._options.shouldUseNativeValidation, true).then((e3) => !K(e3) && s2._subjects.state.next({ errors: Ve(s2._formState.errors, e3, a2) }));
        }
        s2._subjects.state.next({ name: a2, values: u(s2._formValues) }), s2._names.focus && he(s2._fields, (e2, t3) => {
          if (s2._names.focus && t3.startsWith(s2._names.focus) && e2.focus) return e2.focus(), 1;
        }), s2._names.focus = "", s2._setValid(), f2.current = false;
      }, [l2, a2, s2]), e.useEffect(() => (!y(s2._formValues, a2) && s2._setFieldArray(a2), () => {
        s2._options.shouldUnregister || n2 ? s2.unregister(a2) : ((e2, t3) => {
          const r3 = y(s2._fields, e2);
          r3 && r3._f && (r3._f.mount = t3);
        })(a2, false);
      }), [a2, s2, i2, n2]), { swap: e.useCallback((e2, t3) => {
        const r3 = s2._getFieldArray(a2);
        Te(r3, e2, t3), Te(c2.current, e2, t3), m2(r3), d2(r3), s2._setFieldArray(a2, r3, Te, { argA: e2, argB: t3 }, false);
      }, [m2, a2, s2]), move: e.useCallback((e2, t3) => {
        const r3 = s2._getFieldArray(a2);
        Me(r3, e2, t3), Me(c2.current, e2, t3), m2(r3), d2(r3), s2._setFieldArray(a2, r3, Me, { argA: e2, argB: t3 }, false);
      }, [m2, a2, s2]), prepend: e.useCallback((e2, t3) => {
        const r3 = J(u(e2)), i3 = je(s2._getFieldArray(a2), r3);
        s2._names.focus = De(a2, 0, t3), c2.current = je(c2.current, r3.map(ke)), m2(i3), d2(i3), s2._setFieldArray(a2, i3, je, { argA: Ee(e2) });
      }, [m2, a2, s2]), append: e.useCallback((e2, t3) => {
        const r3 = J(u(e2)), i3 = Ce(s2._getFieldArray(a2), r3);
        s2._names.focus = De(a2, i3.length - 1, t3), c2.current = Ce(c2.current, r3.map(ke)), m2(i3), d2(i3), s2._setFieldArray(a2, i3, Ce, { argA: Ee(e2) });
      }, [m2, a2, s2]), remove: e.useCallback((e2) => {
        const t3 = Ue(s2._getFieldArray(a2), e2);
        c2.current = Ue(c2.current, e2), m2(t3), d2(t3), !Array.isArray(y(s2._fields, a2)) && p(s2._fields, a2, void 0), s2._setFieldArray(a2, t3, Ue, { argA: e2 });
      }, [m2, a2, s2]), insert: e.useCallback((e2, t3, r3) => {
        const i3 = J(u(t3)), n3 = Oe(s2._getFieldArray(a2), e2, i3);
        s2._names.focus = De(a2, e2, r3), c2.current = Oe(c2.current, e2, i3.map(ke)), m2(n3), d2(n3), s2._setFieldArray(a2, n3, Oe, { argA: e2, argB: Ee(t3) });
      }, [m2, a2, s2]), update: e.useCallback((e2, t3) => {
        const r3 = u(t3), i3 = Ne(s2._getFieldArray(a2), e2, r3);
        c2.current = [...i3].map((t4, r4) => t4 && r4 !== e2 ? c2.current[r4] : ke()), m2(i3), d2([...i3]), s2._setFieldArray(a2, i3, Ne, { argA: e2, argB: r3 }, true, false);
      }, [m2, a2, s2]), replace: e.useCallback((e2) => {
        const t3 = J(u(e2));
        c2.current = t3.map(ke), m2([...t3]), d2([...t3]), s2._setFieldArray(a2, [...t3], (e3) => e3, {}, true, false);
      }, [m2, a2, s2]), fields: e.useMemo(() => l2.map((e2, t3) => ({ ...e2, [i2]: c2.current[t3] || ke() })), [l2, i2]) };
    }, exports.useForm = function(t2 = {}) {
      const r2 = e.useRef(void 0), s2 = e.useRef(void 0), [a2, i2] = e.useState({ isDirty: false, isValidating: false, isLoading: X(t2.defaultValues), isSubmitted: false, isSubmitting: false, isSubmitSuccessful: false, isValid: false, submitCount: 0, dirtyFields: {}, touchedFields: {}, validatingFields: {}, errors: t2.errors || {}, disabled: t2.disabled || false, isReady: false, defaultValues: X(t2.defaultValues) ? void 0 : t2.defaultValues });
      if (!r2.current) if (t2.formControl) r2.current = { ...t2.formControl, formState: a2 }, t2.defaultValues && !X(t2.defaultValues) && t2.formControl.reset(t2.defaultValues, t2.resetOptions);
      else {
        const { formControl: e2, ...s3 } = we(t2);
        r2.current = { ...s3, formState: a2 };
      }
      const n2 = r2.current.control;
      return n2._options = t2, T(() => {
        const e2 = n2._subscribe({ formState: n2._proxyFormState, callback: () => i2({ ...n2._formState }), reRenderRoot: true });
        return i2((e3) => ({ ...e3, isReady: true })), n2._formState.isReady = true, e2;
      }, [n2]), e.useEffect(() => n2._disableForm(t2.disabled), [n2, t2.disabled]), e.useEffect(() => {
        t2.mode && (n2._options.mode = t2.mode), t2.reValidateMode && (n2._options.reValidateMode = t2.reValidateMode);
      }, [n2, t2.mode, t2.reValidateMode]), e.useEffect(() => {
        t2.errors && (n2._setErrors(t2.errors), n2._focusError());
      }, [n2, t2.errors]), e.useEffect(() => {
        t2.shouldUnregister && n2._subjects.state.next({ values: n2._getWatch() });
      }, [n2, t2.shouldUnregister]), e.useEffect(() => {
        if (n2._proxyFormState.isDirty) {
          const e2 = n2._getDirty();
          e2 !== a2.isDirty && n2._subjects.state.next({ isDirty: e2 });
        }
      }, [n2, a2.isDirty]), e.useEffect(() => {
        t2.values && !P(t2.values, s2.current) ? (n2._reset(t2.values, { keepFieldsRef: true, ...n2._options.resetOptions }), s2.current = t2.values, i2((e2) => ({ ...e2 }))) : n2._resetDefaultValues();
      }, [n2, t2.values]), e.useEffect(() => {
        n2._state.mount || (n2._setValid(), n2._state.mount = true), n2._state.watch && (n2._state.watch = false, n2._subjects.state.next({ ...n2._formState })), n2._removeUnmounted();
      }), r2.current.formState = U(a2, n2), r2.current;
    }, exports.useFormContext = j, exports.useFormState = N, exports.useWatch = W;
  }
});

// node_modules/@forge/react/out/hooks/useForm.js
var require_useForm = __commonJS({
  "node_modules/@forge/react/out/hooks/useForm.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useForm = useForm;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var react_1 = require_react();
    var react_hook_form_1 = require_index_cjs();
    var get_1 = tslib_1.__importDefault(require_get());
    function useForm(props = {}) {
      const id = (0, react_1.useId)();
      const getFieldId = (fieldName) => {
        return `form-${id}-${fieldName}`;
      };
      const {
        register,
        formState,
        // watch, disabling for the time being as can be expensive for performance
        handleSubmit,
        setValue,
        getValues,
        trigger,
        clearErrors
        // Only allow for defaultValues in props for the timebeing
      } = (0, react_hook_form_1.useForm)({
        defaultValues: props.defaultValues,
        mode: "onBlur",
        // defaulting to validating onBlur to follow ADS behaviour
        reValidateMode: "onChange"
      });
      const defaultValues = props?.defaultValues;
      const forgeFormRegister = (fieldName, options) => {
        const { onChange, ref, required, disabled, onBlur, ...rest } = register(fieldName, {
          // Only permitting the below as they've been tested and confirmed working
          required: options?.required,
          disabled: options?.disabled,
          maxLength: options?.maxLength,
          minLength: options?.minLength,
          max: options?.max,
          min: options?.min,
          pattern: options?.pattern,
          validate: options?.validate
        });
        const additionalProps = {};
        if (defaultValues) {
          if (typeof (0, get_1.default)(defaultValues, fieldName) === "boolean") {
            additionalProps.defaultChecked = (0, get_1.default)(defaultValues, fieldName);
          } else {
            additionalProps.defaultValue = (0, get_1.default)(defaultValues, fieldName);
          }
        }
        const isError = !!(0, get_1.default)(formState, `errors["${fieldName}"]`);
        const getOnChangeOptions = () => ({
          shouldDirty: true,
          shouldTouch: true,
          // revalidate on change if the field has been touched(blurred) or if the form has been submitted previously
          shouldValidate: formState.submitCount > 0 || !!(0, get_1.default)(formState, `touchedFields["${fieldName}"]`)
        });
        return {
          ...rest,
          onChange: (event) => {
            if (event?.target?.type === "checkbox") {
              return Promise.resolve(setValue(fieldName, event.target.checked, getOnChangeOptions()));
            }
            if (["number", "text", "textarea", "radio", "password"].includes(event?.target?.type)) {
              return Promise.resolve(setValue(fieldName, event.target.value, getOnChangeOptions()));
            } else {
              return Promise.resolve(setValue(fieldName, event, getOnChangeOptions()));
            }
          },
          // The onBlur event from `register` is unintentionally setting the value to `undefined` when the field is blurred.
          // Replacing the onBlur event here to prevent this behaviour.
          onBlur: () => {
            return Promise.resolve(trigger(fieldName));
          },
          isInvalid: isError,
          "aria-invalid": isError,
          id: getFieldId(fieldName),
          isDisabled: disabled,
          ...additionalProps
        };
      };
      return {
        getFieldId,
        register: forgeFormRegister,
        formState: {
          errors: formState.errors,
          isSubmitted: formState.isSubmitted,
          isSubmitSuccessful: formState.isSubmitSuccessful,
          isSubmitting: formState.isSubmitting,
          submitCount: formState.submitCount,
          isValid: formState.isValid,
          dirtyFields: formState.dirtyFields,
          touchedFields: formState.touchedFields
        },
        handleSubmit,
        getValues,
        trigger,
        clearErrors
      };
    }
  }
});

// node_modules/@forge/react/out/hooks/useObjectStore.js
var require_useObjectStore = __commonJS({
  "node_modules/@forge/react/out/hooks/useObjectStore.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useObjectStore = useObjectStore;
    var react_1 = require_react();
    var bridge_1 = require_out3();
    var updateObjectByKey = (objects, key, updates) => objects.map((obj) => obj.key === key ? { ...obj, ...updates } : obj);
    function objectStoreReducer(state, action) {
      switch (action.type) {
        case "ADD_OBJECTS":
          return { objects: [...state.objects, ...action.payload] };
        case "UPDATE_OBJECT":
          return { objects: updateObjectByKey(state.objects, action.payload.key, action.payload.updates) };
        case "UPLOAD_OBJECT_START":
          return {
            objects: [...state.objects, { key: action.payload.tempKey, isUploading: true }]
          };
        case "UPLOAD_OBJECT_SUCCESS":
          return {
            objects: state.objects.map((obj) => obj.key === action.payload.tempKey ? action.payload.object : obj)
          };
        case "UPLOAD_OBJECT_ERROR":
          return {
            objects: state.objects.map((obj) => obj.key === action.payload.tempKey ? { ...obj, isUploading: false, error: action.payload.error, success: false } : obj)
          };
        case "DELETE_START":
          return {
            objects: state.objects.map((obj) => action.payload.includes(obj.key) ? { ...obj, isDeleting: true, error: void 0 } : obj)
          };
        case "DELETE_SUCCESS":
          return { objects: state.objects.filter((obj) => !action.payload.includes(obj.key)) };
        case "DELETE_ERROR":
          return {
            objects: state.objects.map((obj) => action.payload.keys.includes(obj.key) ? { ...obj, isDeleting: false, error: action.payload.error } : obj)
          };
        case "DOWNLOAD_START":
          return {
            objects: state.objects.map((obj) => action.payload.includes(obj.key) ? { ...obj, isDownloading: true, error: void 0 } : obj)
          };
        case "DOWNLOAD_COMPLETE":
          return {
            objects: state.objects.map((obj) => {
              if (action.payload.successfulKeys.includes(obj.key)) {
                return { ...obj, isDownloading: false };
              }
              if (action.payload.failedKeys.includes(obj.key)) {
                return { ...obj, isDownloading: false, error: "Download failed" };
              }
              return obj;
            })
          };
        default:
          return state;
      }
    }
    function useObjectStore(props = {}) {
      const [state, dispatch] = (0, react_1.useReducer)(objectStoreReducer, {
        objects: props.defaultValues || []
      });
      const getObjectMetadata = (key) => {
        const object = state.objects.find((obj) => obj.key === key);
        if (!object) {
          console.warn(`No metadata found for object with key: ${key}`);
          return null;
        }
        return object;
      };
      const uploadObjects = (0, react_1.useCallback)(async (params) => {
        const timestamp = Date.now();
        try {
          const uploadPromises = await (0, bridge_1.createUploadPromises)(params);
          const trackedUploadPromises = uploadPromises.map(async ({ promise, index, objectType, objectSize }) => {
            const tempKey = `temp-upload-${timestamp}-${index}`;
            dispatch({ type: "UPLOAD_OBJECT_START", payload: { tempKey } });
            try {
              const result = await promise;
              const objectState = {
                key: result.key,
                success: result.success,
                status: result.status,
                error: result.error,
                objectType,
                objectSize
              };
              dispatch({ type: "UPLOAD_OBJECT_SUCCESS", payload: { tempKey, object: objectState } });
              return result;
            } catch (error) {
              dispatch({
                type: "UPLOAD_OBJECT_ERROR",
                payload: { tempKey, error: error instanceof Error ? error.message : "Upload failed" }
              });
              throw error;
            }
          });
          await Promise.all(trackedUploadPromises);
        } catch (error) {
          throw error;
        }
      }, []);
      const deleteObjects = (0, react_1.useCallback)(async (params) => {
        dispatch({ type: "DELETE_START", payload: params.keys });
        try {
          await bridge_1.objectStore.delete(params);
          dispatch({ type: "DELETE_SUCCESS", payload: params.keys });
        } catch (error) {
          dispatch({
            type: "DELETE_ERROR",
            payload: { keys: params.keys, error: error instanceof Error ? error.message : "Delete failed" }
          });
          throw error;
        }
      }, []);
      const downloadObjects = (0, react_1.useCallback)(async (params) => {
        dispatch({ type: "DOWNLOAD_START", payload: params.keys });
        try {
          const results = await bridge_1.objectStore.download(params);
          const successfulKeys = results.filter((r) => r.success).map((r) => r.key);
          const failedKeys = results.filter((r) => !r.success).map((r) => r.key);
          dispatch({
            type: "DOWNLOAD_COMPLETE",
            payload: { successfulKeys, failedKeys }
          });
          return results;
        } catch (error) {
          dispatch({
            type: "DOWNLOAD_COMPLETE",
            payload: { successfulKeys: [], failedKeys: params.keys }
          });
          throw error;
        }
      }, []);
      return {
        objectStates: state.objects,
        getObjectMetadata,
        uploadObjects,
        deleteObjects,
        downloadObjects
      };
    }
  }
});

// node_modules/@forge/react/out/index.js
var require_out4 = __commonJS({
  "node_modules/@forge/react/out/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useObjectStore = exports.useForm = exports.replaceUnsupportedDocumentNodes = exports.I18nProvider = exports.useTranslation = exports.useIssueProperty = exports.useSpaceProperty = exports.useContentProperty = exports.default = exports.usePermissions = exports.useTheme = exports.useConfig = exports.useProductContext = exports.xcss = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var xcss = (style) => style;
    exports.xcss = xcss;
    var useProductContext_1 = require_useProductContext();
    Object.defineProperty(exports, "useProductContext", { enumerable: true, get: function() {
      return useProductContext_1.useProductContext;
    } });
    var useConfig_1 = require_useConfig();
    Object.defineProperty(exports, "useConfig", { enumerable: true, get: function() {
      return useConfig_1.useConfig;
    } });
    var useTheme_1 = require_useTheme();
    Object.defineProperty(exports, "useTheme", { enumerable: true, get: function() {
      return useTheme_1.useTheme;
    } });
    var usePermissions_1 = require_usePermissions();
    Object.defineProperty(exports, "usePermissions", { enumerable: true, get: function() {
      return usePermissions_1.usePermissions;
    } });
    var reconciler_1 = require_reconciler();
    Object.defineProperty(exports, "default", { enumerable: true, get: function() {
      return reconciler_1.ForgeReconciler;
    } });
    tslib_1.__exportStar(require_components(), exports);
    var useContentProperty_1 = require_useContentProperty();
    Object.defineProperty(exports, "useContentProperty", { enumerable: true, get: function() {
      return useContentProperty_1.useContentProperty;
    } });
    var useSpaceProperty_1 = require_useSpaceProperty();
    Object.defineProperty(exports, "useSpaceProperty", { enumerable: true, get: function() {
      return useSpaceProperty_1.useSpaceProperty;
    } });
    var useIssueProperty_1 = require_useIssueProperty();
    Object.defineProperty(exports, "useIssueProperty", { enumerable: true, get: function() {
      return useIssueProperty_1.useIssueProperty;
    } });
    var useTranslation_1 = require_useTranslation();
    Object.defineProperty(exports, "useTranslation", { enumerable: true, get: function() {
      return useTranslation_1.useTranslation;
    } });
    Object.defineProperty(exports, "I18nProvider", { enumerable: true, get: function() {
      return useTranslation_1.I18nProvider;
    } });
    var replaceUnsupportedDocumentNodes_1 = require_replaceUnsupportedDocumentNodes();
    Object.defineProperty(exports, "replaceUnsupportedDocumentNodes", { enumerable: true, get: function() {
      return replaceUnsupportedDocumentNodes_1.replaceUnsupportedDocumentNodes;
    } });
    var useForm_1 = require_useForm();
    Object.defineProperty(exports, "useForm", { enumerable: true, get: function() {
      return useForm_1.useForm;
    } });
    var useObjectStore_1 = require_useObjectStore();
    Object.defineProperty(exports, "useObjectStore", { enumerable: true, get: function() {
      return useObjectStore_1.useObjectStore;
    } });
  }
});

// node_modules/@forge/bridge/out/router/targets.js
var require_targets2 = __commonJS({
  "node_modules/@forge/bridge/out/router/targets.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NavigationTarget = void 0;
    exports.NavigationTarget = {
      /**
       * The view page for pages, blogs and custom content. Takes a contentId to identify the content.
       */
      ContentView: "contentView",
      /**
       * The edit page for pages, blogs and custom content. Takes a contentId to identify the content.
       */
      ContentEdit: "contentEdit",
      /**
       * The list/collector page for pages, blogs and custom content contained in a space. Takes a spaceKey and a contentType to identify the content type for pages and blogs. Takes a moduleKey for custom content.
       */
      ContentList: "contentList",
      /**
       * The space view page. Takes a spaceKey to identify the space.
       */
      SpaceView: "spaceView",
      /**
       * The page within a specific module. Takes a moduleKey to identify the correct module.
       */
      Module: "module",
      /**
       * The profile page for a specific user. Takes an accountId to identify the user.
       */
      UserProfile: "userProfile",
      /**
       * A dashboard in Jira. Takes a dashboardId to identify the dashboard.
       */
      Dashboard: "dashboard",
      /**
       * An issue in Jira. Takes an issueKey to identify the issue.
       */
      Issue: "issue",
      /**
       * The project settings details of a Jira project. Takes a projectKey to identify the project. Only accessible to administrators.
       */
      ProjectSettingsDetails: "projectSettingsDetails"
    };
  }
});

// node_modules/@forge/bridge/out/errors.js
var require_errors2 = __commonJS({
  "node_modules/@forge/bridge/out/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BridgeAPIError = void 0;
    var BridgeAPIError = class extends Error {
    };
    exports.BridgeAPIError = BridgeAPIError;
  }
});

// node_modules/@forge/bridge/out/bridge.js
var require_bridge2 = __commonJS({
  "node_modules/@forge/bridge/out/bridge.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getCallBridge = void 0;
    var errors_1 = require_errors2();
    function isBridgeAvailable(bridge) {
      return !!(bridge === null || bridge === void 0 ? void 0 : bridge.callBridge);
    }
    var getCallBridge = () => {
      if (!isBridgeAvailable(globalThis.__bridge)) {
        throw new errors_1.BridgeAPIError(`
      Unable to establish a connection with the Custom UI bridge.
      If you are trying to run your app locally, Forge apps only work in the context of Atlassian products. Refer to https://go.atlassian.com/forge-tunneling-with-custom-ui for how to tunnel when using a local development server.
    `);
      }
      return globalThis.__bridge.callBridge;
    };
    exports.getCallBridge = getCallBridge;
  }
});

// node_modules/@forge/bridge/out/utils/index.js
var require_utils3 = __commonJS({
  "node_modules/@forge/bridge/out/utils/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.withRateLimiter = void 0;
    var errors_1 = require_errors2();
    var withRateLimiter = (wrappedFn, maxOps, intervalInMs, exceededErrorMessage) => {
      let start = Date.now();
      let numOps = 0;
      return async (...args) => {
        const now = Date.now();
        const elapsed = now - start;
        if (elapsed > intervalInMs) {
          start = now;
          numOps = 0;
        }
        if (numOps >= maxOps) {
          throw new errors_1.BridgeAPIError(exceededErrorMessage || "Too many invocations.");
        }
        numOps = numOps + 1;
        return wrappedFn(...args);
      };
    };
    exports.withRateLimiter = withRateLimiter;
  }
});

// node_modules/@forge/bridge/out/invoke/invoke.js
var require_invoke3 = __commonJS({
  "node_modules/@forge/bridge/out/invoke/invoke.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.invoke = invoke2;
    exports.makeInvoke = makeInvoke;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var utils_1 = require_utils3();
    var callBridge = (0, bridge_1.getCallBridge)();
    var validatePayload = (payload) => {
      if (!payload)
        return;
      if (Object.values(payload).some((val) => typeof val === "function")) {
        throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
      }
    };
    var _invoke = async (functionKey, payload, metadata) => {
      if (typeof functionKey !== "string") {
        throw new errors_1.BridgeAPIError("functionKey must be a string!");
      }
      validatePayload(payload);
      return await callBridge("invoke", { functionKey, payload, metadata });
    };
    var limitedInvoke = (0, utils_1.withRateLimiter)(_invoke, 500, 1e3 * 25, "Resolver calls are rate limited at 500req/25s");
    function invoke2(functionKey, payload, metadata) {
      return limitedInvoke(functionKey, payload, metadata);
    }
    function makeInvoke() {
      return invoke2;
    }
  }
});

// node_modules/@forge/bridge/out/invoke/index.js
var require_invoke4 = __commonJS({
  "node_modules/@forge/bridge/out/invoke/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_invoke3(), exports);
  }
});

// node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js
var require_invoke_endpoint3 = __commonJS({
  "node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InvokeType = void 0;
    exports._invokeEndpointFn = _invokeEndpointFn;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var utils_1 = require_utils3();
    var MAX_NUM_OPERATIONS = 500;
    var OPERATION_INTERVAL_SEC = 25;
    var OPERATION_INTERVAL_MS = 1e3 * OPERATION_INTERVAL_SEC;
    var InvokeType;
    (function(InvokeType2) {
      InvokeType2["REMOTE"] = "Remote";
      InvokeType2["SERVICE"] = "Container";
    })(InvokeType || (exports.InvokeType = InvokeType = {}));
    var callBridge = (0, bridge_1.getCallBridge)();
    var validatePayload = (payload) => {
      if (!payload)
        return;
      if (Object.values(payload).some((val) => typeof val === "function")) {
        throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
      }
    };
    var _setupInvokeEndpointFn = (invokeType) => async (input) => {
      validatePayload(input);
      const callBridgePayload = {
        ...input,
        invokeType: `ui-${invokeType.toLowerCase()}-fetch`
      };
      const bridgeResponse = await callBridge("invoke", callBridgePayload);
      const { success, payload, error } = bridgeResponse !== null && bridgeResponse !== void 0 ? bridgeResponse : {};
      const response = { ...success ? payload : error };
      if (response && response.headers) {
        for (const header in response.headers) {
          if (Array.isArray(response.headers[header])) {
            response.headers[header] = response.headers[header].join(",");
          }
        }
      }
      return response;
    };
    function _invokeEndpointFn(invokeType) {
      const invokeEndpointFn = _setupInvokeEndpointFn(invokeType);
      return (0, utils_1.withRateLimiter)(invokeEndpointFn, MAX_NUM_OPERATIONS, OPERATION_INTERVAL_MS, `${invokeType} invocation calls are rate limited at ${MAX_NUM_OPERATIONS}/${OPERATION_INTERVAL_SEC}s`);
    }
  }
});

// node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js
var require_invoke_remote2 = __commonJS({
  "node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.invokeRemote = void 0;
    var invoke_endpoint_1 = require_invoke_endpoint3();
    var invokeRemote = (input) => {
      const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.REMOTE);
      return invokeEndpoint(input);
    };
    exports.invokeRemote = invokeRemote;
  }
});

// node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js
var require_invoke_service2 = __commonJS({
  "node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.invokeService = void 0;
    var invoke_endpoint_1 = require_invoke_endpoint3();
    var invokeService = (input) => {
      const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.SERVICE);
      return invokeEndpoint(input);
    };
    exports.invokeService = invokeService;
  }
});

// node_modules/@forge/bridge/out/invoke-endpoint/index.js
var require_invoke_endpoint4 = __commonJS({
  "node_modules/@forge/bridge/out/invoke-endpoint/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_invoke_remote2(), exports);
    tslib_1.__exportStar(require_invoke_service2(), exports);
  }
});

// node_modules/@forge/bridge/out/view/submit.js
var require_submit2 = __commonJS({
  "node_modules/@forge/bridge/out/view/submit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.submit = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var submit = async (payload) => {
      const success = await callBridge("submit", payload);
      if (success === false) {
        throw new errors_1.BridgeAPIError("this resource's view is not submittable.");
      }
    };
    exports.submit = submit;
  }
});

// node_modules/@forge/bridge/out/view/close.js
var require_close2 = __commonJS({
  "node_modules/@forge/bridge/out/view/close.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.close = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var close = async (payload) => {
      try {
        const success = await callBridge("close", payload);
        if (success === false) {
          throw new errors_1.BridgeAPIError("this resource's view is not closable.");
        }
      } catch (e) {
        throw new errors_1.BridgeAPIError("this resource's view is not closable.");
      }
    };
    exports.close = close;
  }
});

// node_modules/@forge/bridge/out/view/open.js
var require_open3 = __commonJS({
  "node_modules/@forge/bridge/out/view/open.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.open = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var open = async () => {
      try {
        const success = await callBridge("open");
        if (success === false) {
          throw new errors_1.BridgeAPIError("this resource's view is not openable.");
        }
      } catch (e) {
        throw new errors_1.BridgeAPIError("this resource's view is not openable.");
      }
    };
    exports.open = open;
  }
});

// node_modules/@forge/bridge/out/view/refresh.js
var require_refresh2 = __commonJS({
  "node_modules/@forge/bridge/out/view/refresh.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.refresh = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var refresh = async (payload) => {
      const success = await callBridge("refresh", payload);
      if (success === false) {
        throw new errors_1.BridgeAPIError("this resource's view is not refreshable.");
      }
    };
    exports.refresh = refresh;
  }
});

// node_modules/@forge/bridge/out/view/createHistory.js
var require_createHistory2 = __commonJS({
  "node_modules/@forge/bridge/out/view/createHistory.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createHistory = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var createHistory = async () => {
      const history = await callBridge("createHistory");
      history.listen((location) => {
        history.location = location;
      });
      return history;
    };
    exports.createHistory = createHistory;
  }
});

// node_modules/@forge/bridge/out/view/getContext.js
var require_getContext2 = __commonJS({
  "node_modules/@forge/bridge/out/view/getContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getContext = void 0;
    var bridge_1 = require_bridge2();
    var i18n_1 = require_out();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getContext = async () => {
      var _a;
      const context = await callBridge("getContext");
      const locale = context === null || context === void 0 ? void 0 : context.locale;
      if (locale) {
        context.locale = (_a = (0, i18n_1.ensureLocale)(locale)) !== null && _a !== void 0 ? _a : locale;
      }
      return context;
    };
    exports.getContext = getContext;
  }
});

// node_modules/@forge/bridge/out/view/changeWindowTitle.js
var require_changeWindowTitle2 = __commonJS({
  "node_modules/@forge/bridge/out/view/changeWindowTitle.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.changeWindowTitle = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var changeWindowTitle = async (title) => {
      try {
        await callBridge("changeWindowTitle", title);
      } catch (e) {
        throw new errors_1.BridgeAPIError("the window title wasn't changed due to error.");
      }
    };
    exports.changeWindowTitle = changeWindowTitle;
  }
});

// node_modules/@forge/bridge/out/view/theme.js
var require_theme2 = __commonJS({
  "node_modules/@forge/bridge/out/view/theme.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.theme = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    exports.theme = {
      enable: () => callBridge("enableTheming")
    };
  }
});

// node_modules/@forge/bridge/out/utils/blobParser.js
var require_blobParser2 = __commonJS({
  "node_modules/@forge/bridge/out/utils/blobParser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.blobToBase64 = exports.base64ToBlob = void 0;
    var base64ToBlob = (b64string, mimeType) => {
      if (!b64string) {
        return null;
      }
      const base64Data = b64string.includes(";base64") ? b64string.split(",")[1] : b64string;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    };
    exports.base64ToBlob = base64ToBlob;
    var blobToBase64 = (blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };
    exports.blobToBase64 = blobToBase64;
  }
});

// node_modules/@forge/bridge/out/events/serialiseBlob.js
var require_serialiseBlob2 = __commonJS({
  "node_modules/@forge/bridge/out/events/serialiseBlob.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.containsSerialisedBlobs = exports.containsBlobs = exports.deserialiseBlobsInPayload = exports.serialiseBlobsInPayload = void 0;
    var blobParser_1 = require_blobParser2();
    var isPlainObject = (value) => {
      if (typeof value !== "object" || value === null)
        return false;
      if (Object.prototype.toString.call(value) !== "[object Object]")
        return false;
      const proto = Object.getPrototypeOf(value);
      if (proto === null)
        return true;
      const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
      return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
    };
    var blobToBase64WithMetadata = async (blob) => {
      const base64Data = await (0, blobParser_1.blobToBase64)(blob);
      return {
        data: base64Data,
        type: blob.type
      };
    };
    var base64WithMetadataToBlob = (metadata) => {
      return (0, blobParser_1.base64ToBlob)(metadata.data, metadata.type);
    };
    var serialiseBlobsInPayload = async (payload) => {
      if (payload instanceof Blob) {
        const blobData = await blobToBase64WithMetadata(payload);
        return {
          ...blobData,
          // Custom property used to identify serialized blob data for deserialization
          __isBlobData: true
        };
      }
      if (Array.isArray(payload)) {
        return Promise.all(payload.map((item) => (0, exports.serialiseBlobsInPayload)(item)));
      }
      if (payload && isPlainObject(payload)) {
        const entries = await Promise.all(Object.entries(payload).map(async ([key, value]) => [key, await (0, exports.serialiseBlobsInPayload)(value)]));
        return Object.fromEntries(entries);
      }
      return payload;
    };
    exports.serialiseBlobsInPayload = serialiseBlobsInPayload;
    var deserialiseBlobsInPayload = (payload) => {
      if (payload && isPlainObject(payload) && "__isBlobData" in payload) {
        const typedData = payload;
        return base64WithMetadataToBlob({
          data: typedData.data,
          type: typedData.type
        });
      }
      if (Array.isArray(payload)) {
        return payload.map((item) => (0, exports.deserialiseBlobsInPayload)(item));
      }
      if (payload && isPlainObject(payload)) {
        const result = {};
        for (const [key, value] of Object.entries(payload)) {
          result[key] = (0, exports.deserialiseBlobsInPayload)(value);
        }
        return result;
      }
      return payload;
    };
    exports.deserialiseBlobsInPayload = deserialiseBlobsInPayload;
    var containsBlobs = (payload) => {
      if (payload instanceof Blob) {
        return true;
      }
      if (Array.isArray(payload)) {
        return payload.some((item) => (0, exports.containsBlobs)(item));
      }
      if (payload && isPlainObject(payload)) {
        return Object.values(payload).some((value) => (0, exports.containsBlobs)(value));
      }
      return false;
    };
    exports.containsBlobs = containsBlobs;
    var containsSerialisedBlobs = (payload) => {
      if (payload && isPlainObject(payload) && "__isBlobData" in payload) {
        return true;
      }
      if (Array.isArray(payload)) {
        return payload.some((item) => (0, exports.containsSerialisedBlobs)(item));
      }
      if (payload && isPlainObject(payload)) {
        return Object.values(payload).some((value) => (0, exports.containsSerialisedBlobs)(value));
      }
      return false;
    };
    exports.containsSerialisedBlobs = containsSerialisedBlobs;
  }
});

// node_modules/@forge/bridge/out/events/events.js
var require_events3 = __commonJS({
  "node_modules/@forge/bridge/out/events/events.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.events = void 0;
    var bridge_1 = require_bridge2();
    var serialiseBlob_1 = require_serialiseBlob2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var wrapCallback = (callback) => {
      return (payload) => {
        let newPayload = payload;
        if ((0, serialiseBlob_1.containsSerialisedBlobs)(payload)) {
          newPayload = (0, serialiseBlob_1.deserialiseBlobsInPayload)(payload);
        }
        return callback(newPayload);
      };
    };
    var emit = async (event, payload) => {
      let newPayload = payload;
      if ((0, serialiseBlob_1.containsBlobs)(payload)) {
        newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
      }
      return callBridge("emit", { event, payload: newPayload });
    };
    var on = (event, callback) => {
      return callBridge("on", { event, callback: wrapCallback(callback) });
    };
    var emitPublic = async (event, payload) => {
      let newPayload = payload;
      if ((0, serialiseBlob_1.containsBlobs)(payload)) {
        newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
      }
      return callBridge("emitPublic", { event, payload: newPayload });
    };
    var onPublic = (event, callback) => {
      return callBridge("onPublic", { event, callback: wrapCallback(callback) });
    };
    exports.events = {
      emit,
      on,
      emitPublic,
      onPublic
    };
  }
});

// node_modules/@forge/bridge/out/view/emitReadyEvent.js
var require_emitReadyEvent2 = __commonJS({
  "node_modules/@forge/bridge/out/view/emitReadyEvent.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.emitReadyEvent = void 0;
    var events_1 = require_events3();
    var view_1 = require_view3();
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var EXTENSION_READY = "EXTENSION_READY";
    var emitReadyEvent = async () => {
      const context = await view_1.view.getContext();
      await events_1.events.emit(EXTENSION_READY, {
        localId: context.localId
      });
      try {
        await callBridge("emitReadyEvent");
      } catch {
      }
    };
    exports.emitReadyEvent = emitReadyEvent;
  }
});

// node_modules/@forge/bridge/out/view/adf-renderer.js
var require_adf_renderer3 = __commonJS({
  "node_modules/@forge/bridge/out/view/adf-renderer.js"(exports) {
    "use strict";
    var __createBinding2 = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
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
    }));
    var __setModuleDefault2 = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar2 = exports && exports.__importStar || /* @__PURE__ */ (function() {
      var ownKeys2 = function(o) {
        ownKeys2 = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys2(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys2(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding2(result, mod, k[i]);
        }
        __setModuleDefault2(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createAdfRendererIframeProps = exports.sendMessageWhenReady = void 0;
    var READY_SIGNAL_FALLBACK_DELAY_MS = 1e4;
    var sendMessageWhenReady = (iframe, message, origin) => {
      const sendMessage = () => {
        var _a;
        return (_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) === null || _a === void 0 ? void 0 : _a.postMessage(message, origin);
      };
      const timeoutId = setTimeout(() => {
        window.removeEventListener("message", handleReady);
        sendMessage();
      }, READY_SIGNAL_FALLBACK_DELAY_MS);
      const handleReady = (event) => {
        var _a;
        if (event.source === (iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) && ((_a = event.data) === null || _a === void 0 ? void 0 : _a.source) === "forge-adf-renderer-ready") {
          clearTimeout(timeoutId);
          window.removeEventListener("message", handleReady);
          sendMessage();
        }
      };
      window.addEventListener("message", handleReady);
    };
    exports.sendMessageWhenReady = sendMessageWhenReady;
    var createAdfRendererIframeProps = async (context, iframeId) => {
      const IframeResizer = await Promise.resolve().then(() => __importStar2(require_iframe_resizer()));
      const IframeResizerModule = IframeResizer.default || IframeResizer;
      const origin = new URL(document.referrer).origin;
      const src = `${origin}/forge-apps/adf-renderer`;
      const id = iframeId || `forge-adf-renderer-iframe-${crypto.randomUUID()}`;
      const onLoad = () => {
        var _a, _b, _c, _d, _e;
        const iframe = document.getElementById(id);
        const message = {
          type: "adf-document",
          document: (_a = context.extension.macro) === null || _a === void 0 ? void 0 : _a.body,
          timestamp: Date.now(),
          source: "forge-adf-renderer",
          localId: context.localId,
          isEditing: (_c = (_b = context.extension) === null || _b === void 0 ? void 0 : _b.isEditing) !== null && _c !== void 0 ? _c : false,
          contentId: (_e = (_d = context.extension) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.id
        };
        IframeResizerModule.iframeResizer({
          heightCalculationMethod: "taggedElement",
          widthCalculationMethod: "bodyScroll",
          initCallback: (iframe2) => {
            var _a2;
            (_a2 = iframe2 === null || iframe2 === void 0 ? void 0 : iframe2.iFrameResizer) === null || _a2 === void 0 ? void 0 : _a2.resize();
          }
        }, iframe || "");
        (0, exports.sendMessageWhenReady)(iframe, message, origin);
      };
      setTimeout(() => {
        document.documentElement.style.height = "auto";
        document.body.style.height = "auto";
      }, 200);
      return {
        id,
        src,
        onLoad
      };
    };
    exports.createAdfRendererIframeProps = createAdfRendererIframeProps;
  }
});

// node_modules/@forge/bridge/out/view/onClose.js
var require_onClose2 = __commonJS({
  "node_modules/@forge/bridge/out/view/onClose.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.onClose = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var onClose = async (payload) => {
      try {
        const success = await callBridge("onClose", payload);
        if (success === false) {
          throw new errors_1.BridgeAPIError("`onClose` call has failed.");
        }
      } catch (e) {
        throw new errors_1.BridgeAPIError("`onClose` failed because this resource's view is not closable.");
      }
    };
    exports.onClose = onClose;
  }
});

// node_modules/@forge/bridge/out/view/getFrameDispatch.js
var require_getFrameDispatch2 = __commonJS({
  "node_modules/@forge/bridge/out/view/getFrameDispatch.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getFrameDispatch = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getFrameDispatch = async () => {
      return await callBridge("getFrameDispatch");
    };
    exports.getFrameDispatch = getFrameDispatch;
  }
});

// node_modules/@forge/bridge/out/view/view.js
var require_view3 = __commonJS({
  "node_modules/@forge/bridge/out/view/view.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.view = void 0;
    var submit_1 = require_submit2();
    var close_1 = require_close2();
    var open_1 = require_open3();
    var refresh_1 = require_refresh2();
    var createHistory_1 = require_createHistory2();
    var getContext_1 = require_getContext2();
    var changeWindowTitle_1 = require_changeWindowTitle2();
    var theme_1 = require_theme2();
    var emitReadyEvent_1 = require_emitReadyEvent2();
    var adf_renderer_1 = require_adf_renderer3();
    var onClose_1 = require_onClose2();
    var getFrameDispatch_1 = require_getFrameDispatch2();
    exports.view = {
      submit: submit_1.submit,
      close: close_1.close,
      onClose: onClose_1.onClose,
      open: open_1.open,
      refresh: refresh_1.refresh,
      createHistory: createHistory_1.createHistory,
      getContext: getContext_1.getContext,
      getFrameDispatch: getFrameDispatch_1.getFrameDispatch,
      theme: theme_1.theme,
      changeWindowTitle: changeWindowTitle_1.changeWindowTitle,
      emitReadyEvent: emitReadyEvent_1.emitReadyEvent,
      createAdfRendererIframeProps: adf_renderer_1.createAdfRendererIframeProps
    };
  }
});

// node_modules/@forge/bridge/out/view/index.js
var require_view4 = __commonJS({
  "node_modules/@forge/bridge/out/view/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_view3(), exports);
  }
});

// node_modules/@forge/bridge/out/router/router.js
var require_router3 = __commonJS({
  "node_modules/@forge/bridge/out/router/router.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.router = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getUrl = async (location) => {
      if (!(location === null || location === void 0 ? void 0 : location.target)) {
        throw new Error("target is required for getUrl");
      }
      const url = await callBridge("getUrl", location);
      if (!url) {
        throw new Error("Failed to get URL");
      }
      try {
        return new URL(url);
      } catch (error) {
        throw new Error(`Failed to parse URL: ${url} (${error})`);
      }
    };
    var navigate = (location) => {
      if (typeof location === "string") {
        return callBridge("navigate", { url: location, type: "same-tab" });
      } else {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
          throw new Error("target is required for navigation");
        }
        return callBridge("navigate", { ...location, type: "same-tab" });
      }
    };
    var open = (location) => {
      if (typeof location === "string") {
        return callBridge("navigate", { url: location, type: "new-tab" });
      } else {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
          throw new Error("target is required for navigation");
        }
        return callBridge("navigate", { ...location, type: "new-tab" });
      }
    };
    var reload = async () => callBridge("reload");
    exports.router = {
      getUrl,
      navigate,
      open,
      reload
    };
  }
});

// node_modules/@forge/bridge/out/router/index.js
var require_router4 = __commonJS({
  "node_modules/@forge/bridge/out/router/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_router3(), exports);
  }
});

// node_modules/@forge/bridge/out/modal/modal.js
var require_modal3 = __commonJS({
  "node_modules/@forge/bridge/out/modal/modal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Modal = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var NAMED_MODAL_SIZES = ["small", "medium", "large", "xlarge", "max", "fullscreen", "resizable"];
    var noop = () => {
    };
    function isNamedModalSize(size) {
      return typeof size === "string" && NAMED_MODAL_SIZES.includes(size);
    }
    function isCustomModalSize(size) {
      if (typeof size !== "object" || size === null)
        return false;
      const s = size;
      return typeof s.width === "string" && (s.height === void 0 || typeof s.height === "string");
    }
    function isValidModalSize(size) {
      return isNamedModalSize(size) || isCustomModalSize(size);
    }
    var Modal = class {
      constructor(opts) {
        var _a, _b;
        this.resource = (opts === null || opts === void 0 ? void 0 : opts.resource) || null;
        this.onClose = (opts === null || opts === void 0 ? void 0 : opts.onClose) || noop;
        this.size = (opts === null || opts === void 0 ? void 0 : opts.size) || "medium";
        this.context = (opts === null || opts === void 0 ? void 0 : opts.context) || {};
        this.closeOnEscape = (_a = opts === null || opts === void 0 ? void 0 : opts.closeOnEscape) !== null && _a !== void 0 ? _a : true;
        this.closeOnOverlayClick = (_b = opts === null || opts === void 0 ? void 0 : opts.closeOnOverlayClick) !== null && _b !== void 0 ? _b : true;
        this.title = (opts === null || opts === void 0 ? void 0 : opts.title) || "";
        this.icon = (opts === null || opts === void 0 ? void 0 : opts.icon) || "";
      }
      async open() {
        if (!isValidModalSize(this.size)) {
          throw new errors_1.BridgeAPIError(`Invalid modal size: ${JSON.stringify(this.size)}. Must be one of the named sizes (${NAMED_MODAL_SIZES.join(", ")}) or a custom dimensions object with a "width" string property and an optional "height" string property.`);
        }
        try {
          const success = await callBridge("openModal", {
            resource: this.resource,
            onClose: this.onClose,
            size: this.size,
            context: this.context,
            closeOnEscape: this.closeOnEscape,
            closeOnOverlayClick: this.closeOnOverlayClick,
            title: this.title,
            icon: this.icon
          });
          if (success === false) {
            throw new errors_1.BridgeAPIError("Unable to open modal.");
          }
        } catch (err) {
          throw new errors_1.BridgeAPIError("Unable to open modal.");
        }
      }
    };
    exports.Modal = Modal;
  }
});

// node_modules/@forge/bridge/out/modal/index.js
var require_modal4 = __commonJS({
  "node_modules/@forge/bridge/out/modal/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_modal3(), exports);
  }
});

// node_modules/@forge/bridge/out/fetch/fetch.js
var require_fetch3 = __commonJS({
  "node_modules/@forge/bridge/out/fetch/fetch.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.productFetchApi = exports.remoteFetchApi = void 0;
    var blobParser_1 = require_blobParser2();
    var parseFormData = async (form, matchFilePrefix = false) => {
      const parsed = {};
      for (const [key, value] of form.entries()) {
        const isFileKey = matchFilePrefix ? key.startsWith("file") : key === "file";
        if (isFileKey) {
          const fileName = value.name;
          const fileType = value.type;
          parsed[key] = await (0, blobParser_1.blobToBase64)(value);
          parsed[`__${key}Name`] = fileName;
          parsed[`__${key}Type`] = fileType;
        } else {
          parsed[key] = value;
        }
      }
      return JSON.stringify(parsed);
    };
    var validateFetchOptions = (init) => {
      if (!init) {
        return init;
      }
      if ("signal" in init) {
        const { signal: _signal, ...rest } = init;
        console.error("Signal is not supported in @forge/bridge and was removed from fetch options. Please use the fetch method from @forge/api for signal support.");
        return rest;
      }
      return init;
    };
    var parseRequest = async (fetchType, init) => {
      const isFormData = (init === null || init === void 0 ? void 0 : init.body) instanceof FormData ? true : false;
      const requestBody = isFormData ? await parseFormData(init === null || init === void 0 ? void 0 : init.body, fetchType === "remote") : init === null || init === void 0 ? void 0 : init.body;
      const req = new Request("", { body: requestBody, method: init === null || init === void 0 ? void 0 : init.method, headers: init === null || init === void 0 ? void 0 : init.headers });
      const headers = Object.fromEntries(req.headers.entries());
      const body = req.method !== "GET" ? await req.text() : null;
      return {
        body,
        headers: new Headers(headers),
        isMultipartFormData: isFormData
      };
    };
    var remoteFetchApi = (callBridge) => {
      const fetch2 = async (remoteKey, init) => {
        const validatedInit = validateFetchOptions(init);
        const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest("remote", validatedInit);
        const fetchPayload = {
          remoteKey,
          fetchRequestInit: { ...validatedInit, body: requestBody, headers: [...requestHeaders.entries()] },
          isMultipartFormData
        };
        const { body, headers, statusText, status, isAttachment } = await callBridge("fetchRemote", fetchPayload);
        const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
        return new Response(responseBody || null, { headers, status, statusText });
      };
      return {
        requestRemote: (remoteKey, fetchOptions) => fetch2(remoteKey, fetchOptions)
      };
    };
    exports.remoteFetchApi = remoteFetchApi;
    var productFetchApi = (callBridge) => {
      const fetch2 = async (product, restPath, init) => {
        const validatedInit = validateFetchOptions(init);
        const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest("product", validatedInit);
        if (!requestHeaders.has("X-Atlassian-Token")) {
          requestHeaders.set("X-Atlassian-Token", "no-check");
        }
        const fetchPayload = {
          product,
          restPath,
          fetchRequestInit: {
            ...validatedInit,
            body: requestBody,
            headers: [...requestHeaders.entries()]
          },
          isMultipartFormData
        };
        const { body, headers, statusText, status, isAttachment } = await callBridge("fetchProduct", fetchPayload);
        const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
        return new Response(responseBody || null, { headers, status, statusText });
      };
      return {
        requestConfluence: (restPath, fetchOptions) => fetch2("confluence", restPath, fetchOptions),
        requestJira: (restPath, fetchOptions) => fetch2("jira", restPath, fetchOptions),
        requestBitbucket: (restPath, fetchOptions) => fetch2("bitbucket", restPath, fetchOptions)
      };
    };
    exports.productFetchApi = productFetchApi;
  }
});

// node_modules/@forge/bridge/out/fetch/index.js
var require_fetch4 = __commonJS({
  "node_modules/@forge/bridge/out/fetch/index.js"(exports) {
    "use strict";
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fetchUserRecommendations = exports.requestRemote = exports.requestBitbucket = exports.requestJira = exports.requestConfluence = void 0;
    var bridge_1 = require_bridge2();
    var fetch_1 = require_fetch3();
    _a = (0, fetch_1.productFetchApi)((0, bridge_1.getCallBridge)()), exports.requestConfluence = _a.requestConfluence, exports.requestJira = _a.requestJira, exports.requestBitbucket = _a.requestBitbucket;
    exports.requestRemote = (0, fetch_1.remoteFetchApi)((0, bridge_1.getCallBridge)()).requestRemote;
    var fetchUserRecommendations = async (input) => {
      const callBridge = (0, bridge_1.getCallBridge)();
      return await callBridge("fetchUserRecommendations", input);
    };
    exports.fetchUserRecommendations = fetchUserRecommendations;
  }
});

// node_modules/@forge/bridge/out/requestTeamworkGraph/index.js
var require_requestTeamworkGraph2 = __commonJS({
  "node_modules/@forge/bridge/out/requestTeamworkGraph/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.requestTeamworkGraph = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var requestTeamworkGraph = async (query, variables) => {
      const response = await callBridge("requestTeamworkGraph", { query, variables });
      return response;
    };
    exports.requestTeamworkGraph = requestTeamworkGraph;
  }
});

// node_modules/@forge/bridge/out/flag/flag.js
var require_flag3 = __commonJS({
  "node_modules/@forge/bridge/out/flag/flag.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.showFlag = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var showFlag = (options) => {
      var _a;
      if (!options.id) {
        throw new errors_1.BridgeAPIError('"id" must be defined in flag options');
      }
      const result = callBridge("showFlag", {
        ...options,
        type: (_a = options.type) !== null && _a !== void 0 ? _a : "info"
      });
      return {
        close: async () => {
          await result;
          return callBridge("closeFlag", { id: options.id });
        }
      };
    };
    exports.showFlag = showFlag;
  }
});

// node_modules/@forge/bridge/out/flag/index.js
var require_flag4 = __commonJS({
  "node_modules/@forge/bridge/out/flag/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.showFlag = void 0;
    var flag_1 = require_flag3();
    Object.defineProperty(exports, "showFlag", { enumerable: true, get: function() {
      return flag_1.showFlag;
    } });
  }
});

// node_modules/@forge/bridge/out/events/index.js
var require_events4 = __commonJS({
  "node_modules/@forge/bridge/out/events/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_events3(), exports);
  }
});

// node_modules/@forge/bridge/out/realtime/realtime.js
var require_realtime3 = __commonJS({
  "node_modules/@forge/bridge/out/realtime/realtime.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.realtime = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var publish = (channel, payload, options) => {
      return callBridge("publishRealtimeChannel", { channelName: channel, eventPayload: payload, options });
    };
    var subscribe = (channel, callback, options) => {
      return callBridge("subscribeRealtimeChannel", {
        channelName: channel,
        onEvent: callback,
        options
      });
    };
    var publishGlobal = (channel, payload, options) => {
      return callBridge("publishRealtimeChannel", { channelName: channel, eventPayload: payload, options, isGlobal: true });
    };
    var subscribeGlobal = (channel, callback, options) => {
      return callBridge("subscribeRealtimeChannel", {
        channelName: channel,
        onEvent: callback,
        options,
        isGlobal: true
      });
    };
    exports.realtime = {
      publish,
      subscribe,
      publishGlobal,
      subscribeGlobal
    };
  }
});

// node_modules/@forge/bridge/out/realtime/productContext.js
var require_productContext2 = __commonJS({
  "node_modules/@forge/bridge/out/realtime/productContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bitbucket = exports.Confluence = exports.Jira = void 0;
    var Jira;
    (function(Jira2) {
      Jira2["Board"] = "board";
      Jira2["Issue"] = "issue";
      Jira2["Project"] = "project";
    })(Jira || (exports.Jira = Jira = {}));
    var Confluence;
    (function(Confluence2) {
      Confluence2["Content"] = "content";
      Confluence2["Space"] = "space";
    })(Confluence || (exports.Confluence = Confluence = {}));
    var Bitbucket;
    (function(Bitbucket2) {
      Bitbucket2["Repository"] = "repository";
      Bitbucket2["PullRequest"] = "pullRequest";
    })(Bitbucket || (exports.Bitbucket = Bitbucket = {}));
  }
});

// node_modules/@forge/bridge/out/realtime/index.js
var require_realtime4 = __commonJS({
  "node_modules/@forge/bridge/out/realtime/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bitbucket = exports.Confluence = exports.Jira = exports.realtime = void 0;
    var realtime_1 = require_realtime3();
    Object.defineProperty(exports, "realtime", { enumerable: true, get: function() {
      return realtime_1.realtime;
    } });
    var productContext_1 = require_productContext2();
    Object.defineProperty(exports, "Jira", { enumerable: true, get: function() {
      return productContext_1.Jira;
    } });
    Object.defineProperty(exports, "Confluence", { enumerable: true, get: function() {
      return productContext_1.Confluence;
    } });
    Object.defineProperty(exports, "Bitbucket", { enumerable: true, get: function() {
      return productContext_1.Bitbucket;
    } });
  }
});

// node_modules/@forge/bridge/out/rovo/open.js
var require_open4 = __commonJS({
  "node_modules/@forge/bridge/out/rovo/open.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.open = exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var MAX_AGENT_LENGTH = 30;
    var callBridge = (0, bridge_1.getCallBridge)();
    exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE = "Unable to open Rovo Chat due to usage in an unsupported product. Only Confluence, Jira and some Jira Service Management modules are supported at this point. See https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/";
    var transformRovoPayload = (openRovoPayload) => {
      switch (openRovoPayload.type) {
        case "forge":
          return {
            agentName: openRovoPayload.agentName,
            agentKey: openRovoPayload.agentKey,
            prompt: openRovoPayload.prompt
          };
        case "atlassian":
          return {
            agentName: openRovoPayload.agentName,
            prompt: openRovoPayload.prompt
          };
        default:
          return { prompt: openRovoPayload.prompt };
      }
    };
    var open = async (openRovoPayload) => {
      if (openRovoPayload.type === "forge") {
        if (openRovoPayload.agentName.length > MAX_AGENT_LENGTH) {
          throw new Error("rovo agent name too long");
        }
        if (openRovoPayload.agentKey.length > MAX_AGENT_LENGTH) {
          throw new Error("rovo agent key too long");
        }
      }
      const rovoArgs = transformRovoPayload(openRovoPayload);
      const success = await callBridge("openRovo", rovoArgs);
      if (success === false) {
        throw new errors_1.BridgeAPIError(exports.OPEN_ROVO_BRIDGE_ERROR_MESSAGE);
      }
    };
    exports.open = open;
  }
});

// node_modules/@forge/bridge/out/rovo/isEnabled.js
var require_isEnabled2 = __commonJS({
  "node_modules/@forge/bridge/out/rovo/isEnabled.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isEnabled = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var isEnabled = () => {
      return callBridge("isRovoEnabled");
    };
    exports.isEnabled = isEnabled;
  }
});

// node_modules/@forge/bridge/out/rovo/rovo.js
var require_rovo3 = __commonJS({
  "node_modules/@forge/bridge/out/rovo/rovo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.rovo = void 0;
    var open_1 = require_open4();
    var isEnabled_1 = require_isEnabled2();
    exports.rovo = {
      open: open_1.open,
      isEnabled: isEnabled_1.isEnabled
    };
  }
});

// node_modules/@forge/bridge/out/rovo/index.js
var require_rovo4 = __commonJS({
  "node_modules/@forge/bridge/out/rovo/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_rovo3(), exports);
  }
});

// node_modules/@forge/bridge/out/i18n/index.js
var require_i18n2 = __commonJS({
  "node_modules/@forge/bridge/out/i18n/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createTranslationFunction = exports.getTranslations = exports.resetTranslationsCache = void 0;
    var i18n_1 = require_out();
    var view_1 = require_view4();
    var frontendResourcesAccessor = {
      getI18nInfoConfig: async () => {
        const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${i18n_1.I18N_INFO_FILE_NAME}`);
        if (!resp.ok) {
          throw new Error("Failed to get i18n info config: " + resp.statusText);
        }
        const info = await resp.json();
        return info.config;
      },
      getTranslationResource: async (locale) => {
        const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${locale}.json`);
        if (!resp.ok) {
          throw new Error(`Failed to get translation resource for locale: ${locale}`);
        }
        return resp.json();
      }
    };
    var translationsGetter = new i18n_1.TranslationsGetter(frontendResourcesAccessor);
    var resetTranslationsCache = () => {
      translationsGetter.reset();
    };
    exports.resetTranslationsCache = resetTranslationsCache;
    var getTranslations = async (locale = null, options = {
      fallback: true
    }) => {
      let targetLocale = locale;
      if (!targetLocale) {
        const context = await view_1.view.getContext();
        targetLocale = context.locale;
      }
      return await translationsGetter.getTranslations(targetLocale, options);
    };
    exports.getTranslations = getTranslations;
    var createTranslationFunction = async (locale = null) => {
      let targetLocale = locale;
      if (!targetLocale) {
        const context = await view_1.view.getContext();
        targetLocale = context.locale;
      }
      const translator = new i18n_1.Translator(targetLocale, translationsGetter);
      await translator.init();
      return (i18nKey, defaultValue) => {
        var _a, _b;
        return (_b = (_a = translator.translate(i18nKey)) !== null && _a !== void 0 ? _a : defaultValue) !== null && _b !== void 0 ? _b : i18nKey;
      };
    };
    exports.createTranslationFunction = createTranslationFunction;
  }
});

// node_modules/@forge/bridge/out/permissions/permissions.js
var require_permissions3 = __commonJS({
  "node_modules/@forge/bridge/out/permissions/permissions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.permissions = void 0;
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var egressGet = async (payload) => {
      return callBridge("__permission__egressGet", payload);
    };
    var egressSet = async (payload) => {
      return callBridge("__permission__egressSet", payload);
    };
    var egressDeleteDomain = async (payload) => {
      return callBridge("__permission__egressDeleteDomain", payload);
    };
    var egressDeleteGroup = async (payload) => {
      return callBridge("__permission__egressDeleteGroup", payload);
    };
    var remoteGet = async (payload) => {
      return callBridge("__permission__remoteGet", payload);
    };
    var remoteSet = async (payload) => {
      return callBridge("__permission__remoteSet", payload);
    };
    exports.permissions = {
      egress: {
        get: egressGet,
        set: egressSet,
        deleteDomain: egressDeleteDomain,
        deleteGroup: egressDeleteGroup
      },
      remote: {
        get: remoteGet,
        set: remoteSet
      }
    };
  }
});

// node_modules/@forge/bridge/out/permissions/permissionsUtil.js
var require_permissionsUtil2 = __commonJS({
  "node_modules/@forge/bridge/out/permissions/permissionsUtil.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createPermissionUtils = createPermissionUtils;
    exports.checkPermissions = checkPermissions;
    var egress_1 = require_out2();
    var view_1 = require_view4();
    function extractUrlString(url) {
      if (typeof url === "string") {
        return url;
      }
      if ("address" in url && url.address) {
        return url.address;
      }
      return url.remote || "";
    }
    var RESOURCE_TYPES = ["fonts", "styles", "frames", "images", "media", "scripts"];
    var FETCH_TYPES = ["backend", "client"];
    function createPermissionUtils(runtimePermissions) {
      if (!runtimePermissions) {
        return null;
      }
      const { scopes, external = {} } = runtimePermissions;
      const scopeArray = Array.isArray(scopes) ? scopes : Object.keys(scopes || {});
      return {
        hasScope: (scope) => scopeArray.includes(scope),
        canFetchFrom: (type, url) => {
          var _a;
          const fetchUrls = (_a = external.fetch) === null || _a === void 0 ? void 0 : _a[type];
          if (!(fetchUrls === null || fetchUrls === void 0 ? void 0 : fetchUrls.length))
            return false;
          const allowList = fetchUrls.map(extractUrlString).filter((u) => u.length > 0);
          if (allowList.length === 0)
            return false;
          const egressFilter = new egress_1.EgressFilteringService(allowList);
          const egressFilterWithCSP = egressFilter;
          return type === "client" ? egressFilterWithCSP.isValidUrlCSP(url) : egressFilter.isValidUrl(url);
        },
        canLoadResource: (type, url) => {
          const resourceUrls = external[type];
          if (!(resourceUrls === null || resourceUrls === void 0 ? void 0 : resourceUrls.length))
            return false;
          const allowList = resourceUrls.map(extractUrlString).filter((u) => u.length > 0);
          if (allowList.length === 0)
            return false;
          const egressFilter = new egress_1.EgressFilteringService(allowList);
          const egressFilterWithCSP = egressFilter;
          return egressFilterWithCSP.isValidUrlCSP(url);
        },
        getScopes: () => scopeArray,
        getExternalPermissions: () => external,
        hasAnyPermissions: () => scopeArray.length > 0 || Object.keys(external).length > 0
      };
    }
    function checkScopes(requiredScopes, permissionUtils) {
      if (!(requiredScopes === null || requiredScopes === void 0 ? void 0 : requiredScopes.length)) {
        return void 0;
      }
      const missingScopes = requiredScopes.filter((scope) => !permissionUtils.hasScope(scope));
      return missingScopes.length > 0 ? missingScopes : void 0;
    }
    function checkFetchPermissions(requiredFetch, permissionUtils) {
      if (!(requiredFetch === null || requiredFetch === void 0 ? void 0 : requiredFetch.fetch)) {
        return void 0;
      }
      const missingFetch = {};
      FETCH_TYPES.forEach((type) => {
        var _a;
        const requiredUrls = (_a = requiredFetch.fetch) === null || _a === void 0 ? void 0 : _a[type];
        if (requiredUrls === null || requiredUrls === void 0 ? void 0 : requiredUrls.length) {
          const missingUrls = requiredUrls.filter((url) => !permissionUtils.canFetchFrom(type, url));
          if (missingUrls.length > 0) {
            missingFetch[type] = missingUrls;
          }
        }
      });
      return Object.keys(missingFetch).length > 0 ? missingFetch : void 0;
    }
    function checkResourcePermissions(requiredExternal, permissionUtils) {
      const missingResources = {};
      RESOURCE_TYPES.forEach((type) => {
        const requiredUrls = requiredExternal === null || requiredExternal === void 0 ? void 0 : requiredExternal[type];
        if (requiredUrls === null || requiredUrls === void 0 ? void 0 : requiredUrls.length) {
          const missingUrls = requiredUrls.filter((url) => !permissionUtils.canLoadResource(type, url));
          if (missingUrls.length > 0) {
            missingResources[type] = missingUrls;
          }
        }
      });
      return Object.keys(missingResources).length > 0 ? missingResources : void 0;
    }
    function checkExternalPermissions(requiredExternal, permissionUtils) {
      if (!requiredExternal) {
        return void 0;
      }
      const missingFetch = checkFetchPermissions(requiredExternal, permissionUtils);
      const missingResources = checkResourcePermissions(requiredExternal, permissionUtils);
      if (!missingFetch && !missingResources) {
        return void 0;
      }
      const missingExternal = {};
      if (missingFetch) {
        missingExternal.fetch = missingFetch;
      }
      if (missingResources) {
        Object.assign(missingExternal, missingResources);
      }
      return missingExternal;
    }
    function validateObjectField(value, fieldPath) {
      if (value !== void 0) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError(`${fieldPath} should be an object, not ${Array.isArray(value) ? "an array" : `a ${typeof value}`}`);
        }
      }
    }
    function validateArrayField(value, fieldPath) {
      if (value !== void 0 && !Array.isArray(value)) {
        throw new TypeError(`${fieldPath} should be an array, not a ${typeof value}`);
      }
    }
    function validatePermissionShape(requiredPermissions) {
      validateArrayField(requiredPermissions.scopes, "scopes");
      const external = requiredPermissions.external;
      if (external === void 0)
        return;
      validateObjectField(external, "external");
      if (external.fetch !== void 0) {
        validateObjectField(external.fetch, "external.fetch");
        for (const type of FETCH_TYPES) {
          validateArrayField(external.fetch[type], `external.fetch.${type}`);
        }
      }
      for (const type of RESOURCE_TYPES) {
        validateArrayField(external[type], `external.${type}`);
      }
    }
    async function checkPermissions(requiredPermissions, runtimePermissions) {
      var _a;
      if (!requiredPermissions) {
        return { granted: false, missing: null };
      }
      validatePermissionShape(requiredPermissions);
      if (!((_a = requiredPermissions.scopes) === null || _a === void 0 ? void 0 : _a.length) && !requiredPermissions.external) {
        return { granted: true, missing: null };
      }
      let permissionsToCheck = runtimePermissions;
      if (!permissionsToCheck) {
        const context = await view_1.view.getContext();
        permissionsToCheck = context.permissions;
      }
      const permissionUtils = createPermissionUtils(permissionsToCheck);
      if (!permissionUtils) {
        return { granted: false, missing: null };
      }
      const missing = {};
      let hasAllRequiredPermissions = true;
      const missingScopes = checkScopes(requiredPermissions.scopes, permissionUtils);
      if (missingScopes) {
        missing.scopes = missingScopes;
        hasAllRequiredPermissions = false;
      }
      const missingExternal = checkExternalPermissions(requiredPermissions.external, permissionUtils);
      if (missingExternal) {
        missing.external = missingExternal;
        hasAllRequiredPermissions = false;
      }
      return {
        granted: hasAllRequiredPermissions,
        missing: hasAllRequiredPermissions ? null : missing
      };
    }
  }
});

// node_modules/@forge/bridge/out/permissions/index.js
var require_permissions4 = __commonJS({
  "node_modules/@forge/bridge/out/permissions/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_permissions3(), exports);
    tslib_1.__exportStar(require_permissionsUtil2(), exports);
  }
});

// node_modules/@forge/bridge/out/object-store/upload.js
var require_upload2 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/upload.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.upload = exports.createUploadPromises = void 0;
    var invoke_1 = require_invoke4();
    var errors_1 = require_errors2();
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var base64ToBlob = (base64, mimeType) => {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType || "application/octet-stream" });
    };
    var getObjectMetadata = async (blob) => {
      const length = blob.size;
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      const checksum = btoa(String.fromCharCode(...hashArray));
      const checksumType = "SHA256";
      return {
        length,
        checksum,
        checksumType
      };
    };
    var createUploadPromises = async ({ functionKey, objects }) => {
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to filter and generate presigned URLs");
      }
      if (!Array.isArray(objects) || objects.length === 0) {
        throw new errors_1.BridgeAPIError("objects array is required and must not be empty");
      }
      const blobs = objects.map((obj, index) => {
        if (obj instanceof Blob) {
          return obj;
        }
        const isBase64Object = obj && typeof obj === "object" && "data" in obj && typeof obj.data === "string";
        if (!isBase64Object) {
          throw new errors_1.BridgeAPIError(`Invalid object type at index ${index}. Only Blob or Base64Object (with data string and optional mimeType) are accepted.`);
        }
        try {
          return base64ToBlob(obj.data, obj.mimeType);
        } catch (e) {
          throw new errors_1.BridgeAPIError(`Invalid base64 data at index ${index}. The data string must be valid base64 encoded.`);
        }
      });
      const allObjectMetadata = await Promise.all(blobs.map((blob) => getObjectMetadata(blob)));
      const presignedURLsToObjectMetadata = await (0, invoke_1.invoke)(functionKey, {
        allObjectMetadata
      });
      if (!presignedURLsToObjectMetadata || typeof presignedURLsToObjectMetadata !== "object") {
        throw new errors_1.BridgeAPIError("Invalid response from functionKey");
      }
      const checksumToBlobMap = /* @__PURE__ */ new Map();
      const checksumToIndexMap = /* @__PURE__ */ new Map();
      blobs.forEach((blob, index) => {
        const metadata = allObjectMetadata[index];
        checksumToBlobMap.set(metadata.checksum, blob);
        checksumToIndexMap.set(metadata.checksum, index);
      });
      const uploadPromises = Object.entries(presignedURLsToObjectMetadata).map(([presignedUrl, metadata]) => {
        const { key, checksum } = metadata;
        const object = checksumToBlobMap.get(checksum);
        const index = checksumToIndexMap.get(checksum);
        if (index === void 0) {
          return {
            promise: Promise.resolve({
              success: false,
              key,
              error: `Index not found for checksum ${checksum}`
            }),
            index: -1
          };
        }
        if (!object) {
          return {
            promise: Promise.resolve({
              success: false,
              key,
              error: `Blob not found for checksum ${checksum}`
            }),
            index
          };
        }
        const uploadPromise = (async () => {
          try {
            const response = await fetch(presignedUrl, {
              method: "PUT",
              body: object,
              headers: {
                "Content-Type": object.type || "application/octet-stream",
                "Content-Length": object.size.toString()
              }
            });
            return {
              success: response.ok,
              key,
              status: response.status,
              error: response.ok ? void 0 : `Upload failed with status ${response.status}`
            };
          } catch (error) {
            return {
              success: false,
              key,
              status: 503,
              error: error instanceof Error ? error.message : "Upload failed"
            };
          }
        })();
        return { promise: uploadPromise, index, objectType: object.type, objectSize: object.size };
      });
      return uploadPromises;
    };
    exports.createUploadPromises = createUploadPromises;
    var upload = async ({ functionKey, objects }) => {
      void callBridge("trackObjectStoreAction", { action: "upload" });
      const uploadPromises = await (0, exports.createUploadPromises)({ functionKey, objects });
      const results = await Promise.all(uploadPromises.map((item) => item.promise));
      return results;
    };
    exports.upload = upload;
  }
});

// node_modules/@forge/bridge/out/object-store/deleteObjects.js
var require_deleteObjects2 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/deleteObjects.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.deleteObjects = void 0;
    var invoke_1 = require_invoke4();
    var errors_1 = require_errors2();
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var deleteObjects = async ({ functionKey, keys }) => {
      void callBridge("trackObjectStoreAction", { action: "delete" });
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to delete objects");
      }
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
      }
      await Promise.all(keys.map(async (key) => {
        await (0, invoke_1.invoke)(functionKey, { key });
      }));
    };
    exports.deleteObjects = deleteObjects;
  }
});

// node_modules/@forge/bridge/out/object-store/download.js
var require_download2 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/download.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.download = void 0;
    var invoke_1 = require_invoke4();
    var errors_1 = require_errors2();
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var download = async ({ functionKey, keys }) => {
      void callBridge("trackObjectStoreAction", { action: "download" });
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to filter and generate download URLs");
      }
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
      }
      const downloadUrlsTokeys = await (0, invoke_1.invoke)(functionKey, {
        keys
      });
      if (!downloadUrlsTokeys || typeof downloadUrlsTokeys !== "object") {
        throw new errors_1.BridgeAPIError("Invalid response from functionKey");
      }
      const downloadPromises = Object.entries(downloadUrlsTokeys).map(async ([downloadUrl, key]) => {
        try {
          const response = await fetch(downloadUrl, {
            method: "GET"
          });
          if (!response.ok) {
            return {
              success: false,
              key,
              status: response.status,
              error: `Download failed with status ${response.status}`
            };
          }
          const blob = await response.blob();
          return {
            success: true,
            key,
            blob,
            status: response.status
          };
        } catch (error) {
          return {
            success: false,
            key,
            status: 503,
            error: error instanceof Error ? error.message : "Download failed"
          };
        }
      });
      const results = await Promise.all(downloadPromises);
      return results;
    };
    exports.download = download;
  }
});

// node_modules/@forge/bridge/out/object-store/getMetadata.js
var require_getMetadata2 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/getMetadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getMetadata = void 0;
    var index_1 = require_invoke4();
    var errors_1 = require_errors2();
    var bridge_1 = require_bridge2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var getMetadata = async ({ functionKey, keys }) => {
      void callBridge("trackObjectStoreAction", { action: "getMetadata" });
      if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError("functionKey is required to filter and generate object metadata");
      }
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError("keys array is required and must not be empty");
      }
      const results = await Promise.all(keys.map(async (key) => {
        const result = await (0, index_1.invoke)(functionKey, { key });
        if (!result || typeof result !== "object") {
          return {
            key,
            error: "Invalid response from functionKey"
          };
        }
        return result;
      }));
      return results;
    };
    exports.getMetadata = getMetadata;
  }
});

// node_modules/@forge/bridge/out/object-store/objectStore.js
var require_objectStore2 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/objectStore.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createUploadPromises = exports.objectStore = void 0;
    var upload_1 = require_upload2();
    Object.defineProperty(exports, "createUploadPromises", { enumerable: true, get: function() {
      return upload_1.createUploadPromises;
    } });
    var deleteObjects_1 = require_deleteObjects2();
    var download_1 = require_download2();
    var getMetadata_1 = require_getMetadata2();
    exports.objectStore = {
      upload: upload_1.upload,
      download: download_1.download,
      getMetadata: getMetadata_1.getMetadata,
      delete: deleteObjects_1.deleteObjects
    };
  }
});

// node_modules/@forge/bridge/out/object-store/types.js
var require_types4 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@forge/bridge/out/object-store/index.js
var require_object_store2 = __commonJS({
  "node_modules/@forge/bridge/out/object-store/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_objectStore2(), exports);
    tslib_1.__exportStar(require_types4(), exports);
  }
});

// node_modules/@forge/bridge/out/featureFlags/evaluator.js
var require_evaluator2 = __commonJS({
  "node_modules/@forge/bridge/out/featureFlags/evaluator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Evaluator = void 0;
    var Evaluator = class {
      constructor(results) {
        this.results = results;
      }
      checkFlag(flagName, defaultValue) {
        if (!this.results || !this.results.feature_flags) {
          return defaultValue;
        }
        const featureFlags = this.results.feature_flags;
        let hashedValue = "";
        try {
          hashedValue = this.getHashedValue(flagName);
        } catch (err) {
          console.error("Unexpected error occurred while evaluating flag ", err);
          return defaultValue;
        }
        if (!hashedValue) {
          return defaultValue;
        }
        const evaluatedFlag = featureFlags[hashedValue];
        if (evaluatedFlag) {
          if (evaluatedFlag.disabled) {
            return false;
          }
          return evaluatedFlag.value;
        }
        return defaultValue;
      }
      shutDown() {
        this.results = void 0;
      }
      // To be Updated with proper hashing function
      getHashedValue(flagName) {
        if (typeof flagName !== "string") {
          return "";
        }
        const input = flagName.trim();
        if (input.length === 0) {
          return "";
        }
        let hash = 5381;
        for (let i = 0; i < input.length; i += 1) {
          const charCode = input.charCodeAt(i);
          hash = (hash << 5) + hash + charCode;
          hash |= 0;
        }
        return (hash >>> 0).toString();
      }
    };
    exports.Evaluator = Evaluator;
  }
});

// node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js
var require_initFeatureFlags2 = __commonJS({
  "node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.initFeatureFlags = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var utils_1 = require_utils3();
    var maxOps = 500;
    var intervalInMs = 1e3 * 25;
    var callBridge = (0, bridge_1.getCallBridge)();
    var validatePayload = (payload) => {
      if (!payload || !payload.user || !payload.config) {
        throw new errors_1.BridgeAPIError("Missing required parameters. Parameter user is required in the payload.");
      }
      if (!payload.config.environment || !["development", "staging", "production"].includes(payload.config.environment)) {
        throw new errors_1.BridgeAPIError("Invalid environment. Valid environments are: development, staging, production");
      }
      if (Object.values(payload).some((val) => typeof val === "function")) {
        throw new errors_1.BridgeAPIError("Passing functions as part of the payload is not supported!");
      }
    };
    var _initFeatureFlags = (payload) => {
      validatePayload(payload);
      return callBridge("initFeatureFlags", { user: payload.user, config: payload.config });
    };
    exports.initFeatureFlags = (0, utils_1.withRateLimiter)(_initFeatureFlags, maxOps, intervalInMs, `Feature flags initialisation calls are rate limited at ${maxOps}req/${intervalInMs / 1e3}s`);
  }
});

// node_modules/@forge/bridge/out/featureFlags/featureFlags.js
var require_featureFlags3 = __commonJS({
  "node_modules/@forge/bridge/out/featureFlags/featureFlags.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FeatureFlags = void 0;
    var evaluator_1 = require_evaluator2();
    var initFeatureFlags_1 = require_initFeatureFlags2();
    var FeatureFlags = class {
      constructor() {
        this.initialized = false;
      }
      /**
       * Initialize the feature flags client
       */
      async initialize(user, config = { environment: "development" }) {
        if (this.isInitialized()) {
          return;
        }
        if (!(config === null || config === void 0 ? void 0 : config.environment)) {
          config.environment = "development";
        }
        const result = await (0, initFeatureFlags_1.initFeatureFlags)({ user, config });
        this.initialized = true;
        this.evaluator = new evaluator_1.Evaluator(result);
      }
      /**
       * Check if a feature flag is enabled for the user
       */
      checkFlag(flagName, defaultValue = false) {
        if (!this.isInitialized() || !this.evaluator) {
          throw new Error("FeatureFlags not initialized. Call initialize() first.");
        }
        return this.evaluator.checkFlag(flagName, defaultValue);
      }
      /**
       * Shutdown the feature flags client
       */
      shutdown() {
        if (!this.isInitialized()) {
          return;
        }
        this.initialized = false;
        this.evaluator.shutDown();
      }
      isInitialized() {
        return this.initialized;
      }
    };
    exports.FeatureFlags = FeatureFlags;
  }
});

// node_modules/@forge/bridge/out/featureFlags/index.js
var require_featureFlags4 = __commonJS({
  "node_modules/@forge/bridge/out/featureFlags/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FeatureFlags = void 0;
    var featureFlags_1 = require_featureFlags3();
    Object.defineProperty(exports, "FeatureFlags", { enumerable: true, get: function() {
      return featureFlags_1.FeatureFlags;
    } });
  }
});

// node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js
var require_frontendCustomMetrics3 = __commonJS({
  "node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.frontendCustomMetrics = void 0;
    var bridge_1 = require_bridge2();
    var errors_1 = require_errors2();
    var callBridge = (0, bridge_1.getCallBridge)();
    var emit = async (customMetricName, value) => {
      await callBridge("emitFrontendCustomMetric", {
        customMetricName,
        value
      });
    };
    var MAX_METRIC_NAME_LENGTH = 50;
    var METRIC_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
    var validateMetricName = (name) => {
      if (name.trim().length === 0) {
        throw new errors_1.BridgeAPIError("Custom metric name cannot be empty");
      }
      if (name.length > MAX_METRIC_NAME_LENGTH) {
        throw new errors_1.BridgeAPIError(`Custom metric name cannot exceed ${MAX_METRIC_NAME_LENGTH} characters`);
      }
      if (!METRIC_NAME_REGEX.test(name)) {
        throw new errors_1.BridgeAPIError("Custom metric name must start and end with alphanumeric characters and can only contain letters, numbers, dots (.), and hyphens (-)");
      }
      if (name.includes("..") || name.includes("--")) {
        throw new errors_1.BridgeAPIError("Custom metric name cannot contain consecutive dots or hyphens");
      }
    };
    var counter = (name) => {
      validateMetricName(name);
      return {
        incr: () => emit(name, 1),
        incrBy: (value) => {
          if (value <= 0) {
            throw new errors_1.BridgeAPIError("Counter value must be a positive number");
          }
          return emit(name, value);
        }
      };
    };
    exports.frontendCustomMetrics = { counter };
  }
});

// node_modules/@forge/bridge/out/frontendCustomMetrics/index.js
var require_frontendCustomMetrics4 = __commonJS({
  "node_modules/@forge/bridge/out/frontendCustomMetrics/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    tslib_1.__exportStar(require_frontendCustomMetrics3(), exports);
  }
});

// node_modules/@forge/bridge/out/index.js
var require_out5 = __commonJS({
  "node_modules/@forge/bridge/out/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.i18n = exports.NavigationTarget = void 0;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var targets_1 = require_targets2();
    Object.defineProperty(exports, "NavigationTarget", { enumerable: true, get: function() {
      return targets_1.NavigationTarget;
    } });
    tslib_1.__exportStar(require_invoke4(), exports);
    tslib_1.__exportStar(require_invoke_endpoint4(), exports);
    tslib_1.__exportStar(require_view4(), exports);
    tslib_1.__exportStar(require_router4(), exports);
    tslib_1.__exportStar(require_modal4(), exports);
    tslib_1.__exportStar(require_fetch4(), exports);
    tslib_1.__exportStar(require_requestTeamworkGraph2(), exports);
    tslib_1.__exportStar(require_flag4(), exports);
    tslib_1.__exportStar(require_events4(), exports);
    tslib_1.__exportStar(require_realtime4(), exports);
    tslib_1.__exportStar(require_rovo4(), exports);
    exports.i18n = tslib_1.__importStar(require_i18n2());
    tslib_1.__exportStar(require_permissions4(), exports);
    tslib_1.__exportStar(require_object_store2(), exports);
    tslib_1.__exportStar(require_featureFlags4(), exports);
    tslib_1.__exportStar(require_frontendCustomMetrics4(), exports);
  }
});

// app/src/frontend.jsx
var import_react = __toESM(require_react());
var import_react2 = __toESM(require_out4());
var import_bridge = __toESM(require_out5());
var import_jsx_runtime = __toESM(require_jsx_runtime());
var App = () => {
  const [text, setText] = (0, import_react.useState)("Loading...");
  (0, import_react.useEffect)(() => {
    (0, import_bridge.invoke)("save", { id: "ui" }).then(() => (0, import_bridge.invoke)("summary")).then(setText);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react2.Text, { children: text });
};
import_react2.default.render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {}));
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

scheduler/cjs/scheduler.production.min.js:
  (**
   * @license React
   * scheduler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-reconciler/cjs/react-reconciler.production.min.js:
  (**
   * @license React
   * react-reconciler.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react-reconciler/cjs/react-reconciler-constants.production.min.js:
  (**
   * @license React
   * react-reconciler-constants.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.production.min.js:
  (**
   * @license React
   * react-jsx-runtime.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
