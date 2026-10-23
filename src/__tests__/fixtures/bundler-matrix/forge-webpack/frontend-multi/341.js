(self["webpackChunkforge_sim_bundler_matrix_lab"] = self["webpackChunkforge_sim_bundler_matrix_lab"] || []).push([[341],{

/***/ 1484
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  traverse: () => (/* reexport */ traverse)
});

// UNUSED EXPORTS: filter, map, reduce

;// ./node_modules/@babel/runtime/helpers/esm/typeof.js
function _typeof(o) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
  }, _typeof(o);
}

;// ./node_modules/@babel/runtime/helpers/esm/toPrimitive.js

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

;// ./node_modules/@babel/runtime/helpers/esm/toPropertyKey.js


function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}

;// ./node_modules/@babel/runtime/helpers/esm/defineProperty.js

function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}

;// ./node_modules/@atlaskit/adf-utils/dist/esm/traverse/validateVisitors.js
function validateVisitors(_visitors) {
  return true;
}
;// ./node_modules/@atlaskit/adf-utils/dist/esm/traverse/traverse.js

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
;

/**
 * Provides recursive, depth-first search document traversal. Use visitors collection to define nodes of interest.
 * If no visitor for given node is defined, no-op happens.
 * If visitor returns new node, the old node is replaced.
 * If visitor returns false, node is dropped from the document.
 * If visitor returns null/undefined/void, original node is used.
 * @param adf Document to traverse.
 * @param visitors Collection of visitors.
 */
function traverse(adf, visitors) {
  if (!validateVisitors(visitors)) {
    throw new Error("Visitors are not valid: \"".concat(Object.keys(visitors).join(', '), "\""));
  }
  return traverseNode(adf, {
    node: undefined
  }, visitors, 0, 0);
}
function traverseNode(adfNode, parent, visitors, index, depth) {
  var visitor = visitors[adfNode.type] || visitors['any'];
  var newNode = _objectSpread({}, adfNode);
  if (visitor) {
    var processedNode = visitor(_objectSpread({}, newNode), parent, index, depth);
    if (processedNode === false) {
      return false;
    }
    newNode = processedNode || adfNode;
  }
  if (newNode.content) {
    newNode.content = newNode.content.reduce(function (acc, node, idx) {
      if (!node) {
        return acc;
      }
      var processedNode = traverseNode(node, {
        node: newNode,
        parent: parent
      }, visitors, idx, depth + 1);
      if (processedNode !== false) {
        acc.push(processedNode);
      }
      return acc;
    }, []);
  }
  return newNode;
}

// eslint-disable-next-line @atlaskit/editor/no-re-export

;// ./node_modules/@atlaskit/adf-utils/dist/esm/traverse.js
// Disable no-re-export rule for entry point files
/* eslint-disable @atlaskit/editor/no-re-export */






/***/ },

/***/ 5264
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.getCallBridge = void 0;
const errors_1 = __webpack_require__(7766);
function isBridgeAvailable(bridge) {
    return !!(bridge === null || bridge === void 0 ? void 0 : bridge.callBridge);
}
const getCallBridge = () => {
    if (!isBridgeAvailable(globalThis.__bridge)) {
        throw new errors_1.BridgeAPIError(`
      Unable to establish a connection with the Custom UI bridge.
      If you are trying to run your app locally, Forge apps only work in the context of Atlassian products. Refer to https://go.atlassian.com/forge-tunneling-with-custom-ui for how to tunnel when using a local development server.
    `);
    }
    return globalThis.__bridge.callBridge;
};
exports.getCallBridge = getCallBridge;


/***/ },

/***/ 6868
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCookieConsentPreferences = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Gets the user's current cookie-consent preferences.
 *
 * Resolves to `null` if the host has not published preferences, or if the host doesn't support
 * this API.
 */
const getCookieConsentPreferences = async () => {
    var _a;
    try {
        return (_a = (await callBridge('getCookieConsentPreferences'))) !== null && _a !== void 0 ? _a : null;
    }
    catch {
        return null;
    }
};
exports.getCookieConsentPreferences = getCookieConsentPreferences;


/***/ },

/***/ 8398
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(6868), exports);


/***/ },

/***/ 7766
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.BridgeAPIError = void 0;
class BridgeAPIError extends Error {
}
exports.BridgeAPIError = BridgeAPIError;


/***/ },

/***/ 8482
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.events = void 0;
const bridge_1 = __webpack_require__(5264);
const serialiseBlob_1 = __webpack_require__(4411);
const callBridge = (0, bridge_1.getCallBridge)();
const wrapCallback = (callback) => {
    return (payload) => {
        let newPayload = payload;
        if ((0, serialiseBlob_1.containsSerialisedBlobs)(payload)) {
            newPayload = (0, serialiseBlob_1.deserialiseBlobsInPayload)(payload);
        }
        return callback(newPayload);
    };
};
const emit = async (event, payload) => {
    let newPayload = payload;
    if ((0, serialiseBlob_1.containsBlobs)(payload)) {
        newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
    }
    return callBridge('emit', { event, payload: newPayload });
};
const on = (event, callback) => {
    return callBridge('on', { event, callback: wrapCallback(callback) });
};
const emitPublic = async (event, payload) => {
    let newPayload = payload;
    if ((0, serialiseBlob_1.containsBlobs)(payload)) {
        newPayload = await (0, serialiseBlob_1.serialiseBlobsInPayload)(payload);
    }
    return callBridge('emitPublic', { event, payload: newPayload });
};
const onPublic = (event, callback) => {
    return callBridge('onPublic', { event, callback: wrapCallback(callback) });
};
exports.events = {
    emit,
    on,
    emitPublic,
    onPublic
};


/***/ },

/***/ 2115
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(8482), exports);


/***/ },

/***/ 4411
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.containsSerialisedBlobs = exports.containsBlobs = exports.deserialiseBlobsInPayload = exports.serialiseBlobsInPayload = void 0;
const blobParser_1 = __webpack_require__(6683);
// Copied from https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_isplainobject
const isPlainObject = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    if (Object.prototype.toString.call(value) !== '[object Object]')
        return false;
    const proto = Object.getPrototypeOf(value);
    if (proto === null)
        return true;
    const Ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
    return (typeof Ctor === 'function' &&
        Ctor instanceof Ctor &&
        Function.prototype.call(Ctor) === Function.prototype.call(value));
};
const blobToBase64WithMetadata = async (blob) => {
    const base64Data = await (0, blobParser_1.blobToBase64)(blob);
    return {
        data: base64Data,
        type: blob.type
    };
};
const base64WithMetadataToBlob = (metadata) => {
    // typecasting as Blob since base64ToBlob returns Blob | null but this is only null if data is undefined which it won't be here
    return (0, blobParser_1.base64ToBlob)(metadata.data, metadata.type);
};
// Recursively converts all Blobs in an object or array to base64 with metadata
const serialiseBlobsInPayload = async (payload) => {
    if (payload instanceof Blob) {
        // Convert blob to base64 with metadata and mark it as a serialized blob
        const blobData = await blobToBase64WithMetadata(payload);
        return {
            ...blobData,
            // Custom property used to identify serialized blob data for deserialization
            __isBlobData: true
        };
    }
    if (Array.isArray(payload)) {
        // Recursively process array elements
        return Promise.all(payload.map((item) => (0, exports.serialiseBlobsInPayload)(item)));
    }
    if (payload && isPlainObject(payload)) {
        // Recursively process object properties
        const entries = await Promise.all(Object.entries(payload).map(async ([key, value]) => [key, await (0, exports.serialiseBlobsInPayload)(value)]));
        return Object.fromEntries(entries);
    }
    return payload;
};
exports.serialiseBlobsInPayload = serialiseBlobsInPayload;
// Recursively converts all serialized blob data back to Blobs in an object or array
const deserialiseBlobsInPayload = (payload) => {
    if (payload && isPlainObject(payload) && '__isBlobData' in payload) {
        const typedData = payload;
        // Convert serialized blob data back to Blob
        return base64WithMetadataToBlob({
            data: typedData.data,
            type: typedData.type
        });
    }
    if (Array.isArray(payload)) {
        // Recursively process array elements
        return payload.map((item) => (0, exports.deserialiseBlobsInPayload)(item));
    }
    if (payload && isPlainObject(payload)) {
        // Recursively process object properties
        const result = {};
        for (const [key, value] of Object.entries(payload)) {
            result[key] = (0, exports.deserialiseBlobsInPayload)(value);
        }
        return result;
    }
    return payload;
};
exports.deserialiseBlobsInPayload = deserialiseBlobsInPayload;
const containsBlobs = (payload) => {
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
const containsSerialisedBlobs = (payload) => {
    if (payload && isPlainObject(payload) && '__isBlobData' in payload) {
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


/***/ },

/***/ 8130
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.Evaluator = void 0;
class Evaluator {
    constructor(results) {
        this.results = results;
    }
    checkFlag(flagName, defaultValue) {
        if (!this.results || !this.results.feature_flags) {
            // fallback to default value
            return defaultValue;
        }
        const featureFlags = this.results.feature_flags;
        let hashedValue = '';
        try {
            hashedValue = this.getHashedValue(flagName);
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error('Unexpected error occurred while evaluating flag ', err);
            // If hashing fails for any reason, do not throw; safely return default
            return defaultValue;
        }
        if (!hashedValue) {
            return defaultValue;
        }
        const evaluatedFlag = featureFlags[hashedValue];
        if (evaluatedFlag) {
            // if flag being checked is disabled
            if (evaluatedFlag.disabled) {
                return false;
            }
            return evaluatedFlag.value;
        }
        // fallback to default value
        return defaultValue;
    }
    shutDown() {
        this.results = undefined;
    }
    // To be Updated with proper hashing function
    getHashedValue(flagName) {
        // Defensive: ensure stable, non-throwing behavior for unexpected inputs
        if (typeof flagName !== 'string') {
            return '';
        }
        const input = flagName.trim();
        if (input.length === 0) {
            return '';
        }
        // djb2 hashing (unsigned 32-bit), matches server-side encoding
        let hash = 5381;
        for (let i = 0; i < input.length; i += 1) {
            const charCode = input.charCodeAt(i);
            hash = (hash << 5) + hash + charCode; // hash * 33 + c
            hash |= 0; // force 32-bit signed int
        }
        // Convert to unsigned 32-bit and return as a decimal string
        return (hash >>> 0).toString();
    }
}
exports.Evaluator = Evaluator;


/***/ },

/***/ 2634
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FeatureFlags = void 0;
const evaluator_1 = __webpack_require__(8130);
const initFeatureFlags_1 = __webpack_require__(8636);
class FeatureFlags {
    constructor() {
        this.initialized = false;
    }
    /**
     * Initialize the feature flags client
     */
    async initialize(user, config = { environment: 'development' }) {
        if (this.isInitialized()) {
            return;
        }
        if (!(config === null || config === void 0 ? void 0 : config.environment)) {
            config.environment = 'development';
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
            throw new Error('FeatureFlags not initialized. Call initialize() first.');
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
}
exports.FeatureFlags = FeatureFlags;


/***/ },

/***/ 1403
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FeatureFlags = void 0;
var featureFlags_1 = __webpack_require__(2634);
Object.defineProperty(exports, "FeatureFlags", ({ enumerable: true, get: function () { return featureFlags_1.FeatureFlags; } }));


/***/ },

/***/ 8636
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.initFeatureFlags = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const utils_1 = __webpack_require__(9939);
const maxOps = 500;
const intervalInMs = 1000 * 25;
const callBridge = (0, bridge_1.getCallBridge)();
const validatePayload = (payload) => {
    if (!payload || !payload.user || !payload.config) {
        throw new errors_1.BridgeAPIError('Missing required parameters. Parameter user is required in the payload.');
    }
    if (!payload.config.environment || !['development', 'staging', 'production'].includes(payload.config.environment)) {
        throw new errors_1.BridgeAPIError('Invalid environment. Valid environments are: development, staging, production');
    }
    if (Object.values(payload).some((val) => typeof val === 'function')) {
        throw new errors_1.BridgeAPIError('Passing functions as part of the payload is not supported!');
    }
};
const _initFeatureFlags = (payload) => {
    validatePayload(payload);
    return callBridge('initFeatureFlags', { user: payload.user, config: payload.config });
};
exports.initFeatureFlags = (0, utils_1.withRateLimiter)(_initFeatureFlags, maxOps, intervalInMs, `Feature flags initialisation calls are rate limited at ${maxOps}req/${intervalInMs / 1000}s`);


/***/ },

/***/ 2294
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.productFetchApi = exports.remoteFetchApi = void 0;
const blobParser_1 = __webpack_require__(6683);
const parseFormData = async (form, matchFilePrefix = false) => {
    const parsed = {};
    for (const [key, value] of form.entries()) {
        // Jira and Confluence REST APIs requires that the field containing
        // the file MUST be named exactly 'file'
        const isFileKey = matchFilePrefix ? key.startsWith('file') : key === 'file';
        if (isFileKey) {
            const fileName = value.name;
            const fileType = value.type;
            // we parse the file as a base64 string so it
            // can be properly transfered over the bridge.
            // we'll parse it back to Blob in the host product
            parsed[key] = await (0, blobParser_1.blobToBase64)(value);
            // we also need to pass the file name and type,
            // as those will be lost in the base64 conversion
            parsed[`__${key}Name`] = fileName;
            parsed[`__${key}Type`] = fileType;
        }
        else {
            parsed[key] = value;
        }
    }
    return JSON.stringify(parsed);
};
const validateFetchOptions = (init) => {
    if (!init) {
        return init;
    }
    if ('signal' in init) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { signal: _signal, ...rest } = init;
        // eslint-disable-next-line no-console
        console.error('Signal is not supported in @forge/bridge and was removed from fetch options. Please use the fetch method from @forge/api for signal support.');
        return rest;
    }
    return init;
};
const parseRequest = async (fetchType, init) => {
    const isFormData = (init === null || init === void 0 ? void 0 : init.body) instanceof FormData ? true : false;
    const requestBody = isFormData ? await parseFormData(init === null || init === void 0 ? void 0 : init.body, fetchType === 'remote') : init === null || init === void 0 ? void 0 : init.body;
    const req = new Request('', { body: requestBody, method: init === null || init === void 0 ? void 0 : init.method, headers: init === null || init === void 0 ? void 0 : init.headers });
    // If `init.body` is a `FormData`, a `content-type` header required for the body to be parsed by the
    // API receiving this request will be generated in req.headers.
    const headers = Object.fromEntries(req.headers.entries());
    const body = req.method !== 'GET' ? await req.text() : null;
    return {
        body,
        headers: new Headers(headers),
        isMultipartFormData: isFormData
    };
};
const remoteFetchApi = (callBridge) => {
    const fetch = async (remoteKey, init) => {
        const validatedInit = validateFetchOptions(init);
        const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest('remote', validatedInit);
        const fetchPayload = {
            remoteKey,
            fetchRequestInit: { ...validatedInit, body: requestBody, headers: [...requestHeaders.entries()] },
            isMultipartFormData
        };
        const { body, headers, statusText, status, isAttachment } = await callBridge('fetchRemote', fetchPayload);
        const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers['content-type']) : body;
        return new Response(responseBody || null, { headers, status, statusText });
    };
    return {
        requestRemote: (remoteKey, fetchOptions) => fetch(remoteKey, fetchOptions)
    };
};
exports.remoteFetchApi = remoteFetchApi;
const productFetchApi = (callBridge) => {
    const fetch = async (product, restPath, init) => {
        const validatedInit = validateFetchOptions(init);
        const { body: requestBody, headers: requestHeaders, isMultipartFormData } = await parseRequest('product', validatedInit);
        // https://ecosystem.atlassian.net/browse/BUILD-1118 Skip xsrf check for oauth request
        if (!requestHeaders.has('X-Atlassian-Token')) {
            requestHeaders.set('X-Atlassian-Token', 'no-check');
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
        const { body, headers, statusText, status, isAttachment } = await callBridge('fetchProduct', fetchPayload);
        const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers['content-type']) : body;
        return new Response(responseBody || null, { headers, status, statusText });
    };
    return {
        requestConfluence: (restPath, fetchOptions) => fetch('confluence', restPath, fetchOptions),
        requestJira: (restPath, fetchOptions) => fetch('jira', restPath, fetchOptions),
        requestBitbucket: (restPath, fetchOptions) => fetch('bitbucket', restPath, fetchOptions)
    };
};
exports.productFetchApi = productFetchApi;


/***/ },

/***/ 4490
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fetchUserRecommendations = exports.requestRemote = exports.requestBitbucket = exports.requestJira = exports.requestConfluence = void 0;
const bridge_1 = __webpack_require__(5264);
const fetch_1 = __webpack_require__(2294);
_a = (0, fetch_1.productFetchApi)((0, bridge_1.getCallBridge)()), exports.requestConfluence = _a.requestConfluence, exports.requestJira = _a.requestJira, exports.requestBitbucket = _a.requestBitbucket;
exports.requestRemote = (0, fetch_1.remoteFetchApi)((0, bridge_1.getCallBridge)()).requestRemote;
const fetchUserRecommendations = async (input) => {
    const callBridge = (0, bridge_1.getCallBridge)();
    return await callBridge('fetchUserRecommendations', input);
};
exports.fetchUserRecommendations = fetchUserRecommendations;


/***/ },

/***/ 8392
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.showFlag = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const showFlag = (options) => {
    var _a;
    if (!options.id) {
        throw new errors_1.BridgeAPIError('"id" must be defined in flag options');
    }
    const result = callBridge('showFlag', {
        ...options,
        type: (_a = options.type) !== null && _a !== void 0 ? _a : 'info'
    });
    return {
        close: async () => {
            await result;
            return callBridge('closeFlag', { id: options.id });
        }
    };
};
exports.showFlag = showFlag;


/***/ },

/***/ 8548
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.showFlag = void 0;
var flag_1 = __webpack_require__(8392);
Object.defineProperty(exports, "showFlag", ({ enumerable: true, get: function () { return flag_1.showFlag; } }));


/***/ },

/***/ 1118
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.frontendCustomMetrics = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const emit = async (customMetricName, value) => {
    await callBridge('emitFrontendCustomMetric', {
        customMetricName,
        value
    });
};
const MAX_METRIC_NAME_LENGTH = 50;
// Must start and end with an alphanumeric character and may only contain
// letters, numbers, dots (.) and hyphens (-) in between.
const METRIC_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
/**
 * Validates a custom metric name against the same rules enforced when
 * registering a metric in the developer console. Throws synchronously so
 * developer errors fail fast without a wasted bridge round-trip.
 *
 * Note: this is a best-effort, client-side convenience check. The metric name
 * must still match a custom metric registered in the developer console, which
 * remains the source of truth and is validated by the backend.
 */
const validateMetricName = (name) => {
    if (name.trim().length === 0) {
        throw new errors_1.BridgeAPIError('Custom metric name cannot be empty');
    }
    if (name.length > MAX_METRIC_NAME_LENGTH) {
        throw new errors_1.BridgeAPIError(`Custom metric name cannot exceed ${MAX_METRIC_NAME_LENGTH} characters`);
    }
    if (!METRIC_NAME_REGEX.test(name)) {
        throw new errors_1.BridgeAPIError('Custom metric name must start and end with alphanumeric characters and can only contain letters, numbers, dots (.), and hyphens (-)');
    }
    if (name.includes('..') || name.includes('--')) {
        throw new errors_1.BridgeAPIError('Custom metric name cannot contain consecutive dots or hyphens');
    }
};
const counter = (name) => {
    validateMetricName(name);
    return {
        incr: () => emit(name, 1),
        incrBy: (value) => {
            if (value <= 0) {
                throw new errors_1.BridgeAPIError('Counter value must be a positive number');
            }
            return emit(name, value);
        }
    };
};
/**
 * Public namespace for emitting Forge frontend custom metrics from a Forge UI app.
 *
 * @example
 * import { frontendCustomMetrics } from '@forge/bridge';
 * const c = frontendCustomMetrics.counter('button-click');
 * c.incr();        // increment by 1
 * c.incrBy(5);     // increment by 5 (rejects if value <= 0)
 */
exports.frontendCustomMetrics = { counter };


/***/ },

/***/ 6854
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(1118), exports);


/***/ },

/***/ 1622
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createTranslationFunction = exports.getTranslations = exports.resetTranslationsCache = void 0;
const i18n_1 = __webpack_require__(4280);
const view_1 = __webpack_require__(1855);
const frontendResourcesAccessor = {
    getI18nInfoConfig: async () => {
        const resp = await fetch(`./${i18n_1.I18N_BUNDLE_FOLDER_NAME}/${i18n_1.I18N_INFO_FILE_NAME}`);
        if (!resp.ok) {
            throw new Error('Failed to get i18n info config: ' + resp.statusText);
        }
        const info = (await resp.json());
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
const translationsGetter = new i18n_1.TranslationsGetter(frontendResourcesAccessor);
const resetTranslationsCache = () => {
    translationsGetter.reset();
};
exports.resetTranslationsCache = resetTranslationsCache;
const getTranslations = async (locale = null, options = {
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
/**
 * Creates a translation function (i.e. `t`) for the given locale.
 * If no locale is provided, the locale from the current view context is used.
 *
 * @param locale The locale to create the translation function for.
 * @returns The translation function.
 */
const createTranslationFunction = async (locale = null) => {
    let targetLocale = locale;
    if (!targetLocale) {
        const context = await view_1.view.getContext();
        targetLocale = context.locale;
    }
    const translator = new i18n_1.Translator(targetLocale, translationsGetter);
    await translator.init();
    return (i18nKey, defaultValue) => { var _a, _b; return (_b = (_a = translator.translate(i18nKey)) !== null && _a !== void 0 ? _a : defaultValue) !== null && _b !== void 0 ? _b : i18nKey; };
};
exports.createTranslationFunction = createTranslationFunction;


/***/ },

/***/ 2321
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.i18n = exports.NavigationTarget = void 0;
const tslib_1 = __webpack_require__(1635);
var targets_1 = __webpack_require__(8325);
Object.defineProperty(exports, "NavigationTarget", ({ enumerable: true, get: function () { return targets_1.NavigationTarget; } }));
tslib_1.__exportStar(__webpack_require__(8350), exports);
tslib_1.__exportStar(__webpack_require__(6708), exports);
tslib_1.__exportStar(__webpack_require__(1855), exports);
tslib_1.__exportStar(__webpack_require__(351), exports);
tslib_1.__exportStar(__webpack_require__(4095), exports);
tslib_1.__exportStar(__webpack_require__(4490), exports);
tslib_1.__exportStar(__webpack_require__(7833), exports);
tslib_1.__exportStar(__webpack_require__(8548), exports);
tslib_1.__exportStar(__webpack_require__(2115), exports);
tslib_1.__exportStar(__webpack_require__(4247), exports);
tslib_1.__exportStar(__webpack_require__(5966), exports);
tslib_1.__exportStar(__webpack_require__(8398), exports);
exports.i18n = tslib_1.__importStar(__webpack_require__(1622));
tslib_1.__exportStar(__webpack_require__(358), exports);
tslib_1.__exportStar(__webpack_require__(3221), exports);
tslib_1.__exportStar(__webpack_require__(1403), exports);
tslib_1.__exportStar(__webpack_require__(6854), exports);


/***/ },

/***/ 6708
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(8805), exports);
tslib_1.__exportStar(__webpack_require__(4380), exports);


/***/ },

/***/ 8654
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.InvokeType = void 0;
exports._invokeEndpointFn = _invokeEndpointFn;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const utils_1 = __webpack_require__(9939);
const MAX_NUM_OPERATIONS = 500;
const OPERATION_INTERVAL_SEC = 25;
const OPERATION_INTERVAL_MS = 1000 * OPERATION_INTERVAL_SEC;
var InvokeType;
(function (InvokeType) {
    InvokeType["REMOTE"] = "Remote";
    InvokeType["SERVICE"] = "Container";
})(InvokeType || (exports.InvokeType = InvokeType = {}));
const callBridge = (0, bridge_1.getCallBridge)();
const validatePayload = (payload) => {
    if (!payload)
        return;
    if (Object.values(payload).some((val) => typeof val === 'function')) {
        throw new errors_1.BridgeAPIError('Passing functions as part of the payload is not supported!');
    }
};
const _setupInvokeEndpointFn = (invokeType) => async (input) => {
    validatePayload(input);
    const callBridgePayload = {
        ...input,
        invokeType: `ui-${invokeType.toLowerCase()}-fetch`
    };
    const bridgeResponse = await callBridge('invoke', callBridgePayload);
    const { success, payload, error } = bridgeResponse !== null && bridgeResponse !== void 0 ? bridgeResponse : {};
    const response = { ...(success ? payload : error) };
    if (response && response.headers) {
        for (const header in response.headers) {
            if (Array.isArray(response.headers[header])) {
                response.headers[header] = response.headers[header].join(',');
            }
        }
    }
    return response;
};
function _invokeEndpointFn(invokeType) {
    const invokeEndpointFn = _setupInvokeEndpointFn(invokeType);
    return (0, utils_1.withRateLimiter)(invokeEndpointFn, MAX_NUM_OPERATIONS, OPERATION_INTERVAL_MS, `${invokeType} invocation calls are rate limited at ${MAX_NUM_OPERATIONS}/${OPERATION_INTERVAL_SEC}s`);
}


/***/ },

/***/ 8805
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.invokeRemote = void 0;
const invoke_endpoint_1 = __webpack_require__(8654);
const invokeRemote = (input) => {
    const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.REMOTE);
    return invokeEndpoint(input);
};
exports.invokeRemote = invokeRemote;


/***/ },

/***/ 4380
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.invokeService = void 0;
const invoke_endpoint_1 = __webpack_require__(8654);
const invokeService = (input) => {
    const invokeEndpoint = (0, invoke_endpoint_1._invokeEndpointFn)(invoke_endpoint_1.InvokeType.SERVICE);
    return invokeEndpoint(input);
};
exports.invokeService = invokeService;


/***/ },

/***/ 8350
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(9332), exports);


/***/ },

/***/ 9332
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.invoke = invoke;
exports.makeInvoke = makeInvoke;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const utils_1 = __webpack_require__(9939);
const callBridge = (0, bridge_1.getCallBridge)();
const validatePayload = (payload) => {
    if (!payload)
        return;
    if (Object.values(payload).some((val) => typeof val === 'function')) {
        throw new errors_1.BridgeAPIError('Passing functions as part of the payload is not supported!');
    }
};
const _invoke = async (functionKey, payload, metadata) => {
    if (typeof functionKey !== 'string') {
        throw new errors_1.BridgeAPIError('functionKey must be a string!');
    }
    validatePayload(payload);
    // When metadata is defined, the bridge returns the response wrapped in metadata as { body, metadata }
    // Otherwise, the bridge returns the response directly
    return await callBridge('invoke', { functionKey, payload, metadata });
};
const limitedInvoke = (0, utils_1.withRateLimiter)(_invoke, 500, 1000 * 25, 'Resolver calls are rate limited at 500req/25s');
/**
 * Calls a backend resolver function by key.
 */
function invoke(functionKey, payload, metadata) {
    return limitedInvoke(functionKey, payload, metadata);
}
/**
 * Specialises the invoke function to a given Definitions type.
 *
 * @returns An invoke function that can be used to call backend functions.
 */
function makeInvoke() {
    return invoke;
}


/***/ },

/***/ 4095
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(4526), exports);


/***/ },

/***/ 4526
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Modal = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const NAMED_MODAL_SIZES = ['small', 'medium', 'large', 'xlarge', 'max', 'fullscreen', 'resizable'];
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => { };
function isNamedModalSize(size) {
    return typeof size === 'string' && NAMED_MODAL_SIZES.includes(size);
}
function isCustomModalSize(size) {
    if (typeof size !== 'object' || size === null)
        return false;
    const s = size;
    return typeof s.width === 'string' && (s.height === undefined || typeof s.height === 'string');
}
function isValidModalSize(size) {
    return isNamedModalSize(size) || isCustomModalSize(size);
}
class Modal {
    constructor(opts) {
        var _a, _b;
        this.resource = (opts === null || opts === void 0 ? void 0 : opts.resource) || null;
        this.onClose = (opts === null || opts === void 0 ? void 0 : opts.onClose) || noop;
        this.size = (opts === null || opts === void 0 ? void 0 : opts.size) || 'medium';
        this.context = (opts === null || opts === void 0 ? void 0 : opts.context) || {};
        this.closeOnEscape = (_a = opts === null || opts === void 0 ? void 0 : opts.closeOnEscape) !== null && _a !== void 0 ? _a : true;
        this.closeOnOverlayClick = (_b = opts === null || opts === void 0 ? void 0 : opts.closeOnOverlayClick) !== null && _b !== void 0 ? _b : true;
        this.title = (opts === null || opts === void 0 ? void 0 : opts.title) || '';
        this.icon = (opts === null || opts === void 0 ? void 0 : opts.icon) || '';
    }
    async open() {
        if (!isValidModalSize(this.size)) {
            throw new errors_1.BridgeAPIError(`Invalid modal size: ${JSON.stringify(this.size)}. Must be one of the named sizes (${NAMED_MODAL_SIZES.join(', ')}) or a custom dimensions object with a "width" string property and an optional "height" string property.`);
        }
        try {
            const success = await callBridge('openModal', {
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
                throw new errors_1.BridgeAPIError('Unable to open modal.');
            }
        }
        catch (err) {
            throw new errors_1.BridgeAPIError('Unable to open modal.');
        }
    }
}
exports.Modal = Modal;


/***/ },

/***/ 8204
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.deleteObjects = void 0;
const invoke_1 = __webpack_require__(8350);
const errors_1 = __webpack_require__(7766);
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Delete multiple objects
 *
 * @param functionKey - Configuration object containing the backend function key to delete objects
 * @param keys - Array of object keys to delete
 * @returns Promise<void>
 * @throws {BridgeAPIError} When deleting fails
 */
const deleteObjects = async ({ functionKey, keys }) => {
    void callBridge('trackObjectStoreAction', { action: 'delete' });
    if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError('functionKey is required to delete objects');
    }
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError('keys array is required and must not be empty');
    }
    await Promise.all(keys.map(async (key) => {
        await (0, invoke_1.invoke)(functionKey, { key });
    }));
};
exports.deleteObjects = deleteObjects;


/***/ },

/***/ 8681
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.download = void 0;
const invoke_1 = __webpack_require__(8350);
const errors_1 = __webpack_require__(7766);
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Download multiple objects from pre-signed URLs
 *
 * @param functionKey - Configuration object containing the backend function key to filter and generate download URLs
 * @param keys - Array of object keys to download
 * @returns Promise resolving to DownloadResult[]
 * @throws {BridgeAPIError} When filtering fails or download encounters an error
 */
const download = async ({ functionKey, keys }) => {
    void callBridge('trackObjectStoreAction', { action: 'download' });
    if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError('functionKey is required to filter and generate download URLs');
    }
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError('keys array is required and must not be empty');
    }
    const downloadUrlsTokeys = (await (0, invoke_1.invoke)(functionKey, {
        keys
    }));
    if (!downloadUrlsTokeys || typeof downloadUrlsTokeys !== 'object') {
        throw new errors_1.BridgeAPIError('Invalid response from functionKey');
    }
    const downloadPromises = Object.entries(downloadUrlsTokeys).map(async ([downloadUrl, key]) => {
        try {
            const response = await fetch(downloadUrl, {
                method: 'GET'
            });
            if (!response.ok) {
                return {
                    success: false,
                    key: key,
                    status: response.status,
                    error: `Download failed with status ${response.status}`
                };
            }
            const blob = await response.blob();
            return {
                success: true,
                key: key,
                blob,
                status: response.status
            };
        }
        catch (error) {
            return {
                success: false,
                key: key,
                status: 503,
                error: error instanceof Error ? error.message : 'Download failed'
            };
        }
    });
    const results = await Promise.all(downloadPromises);
    return results;
};
exports.download = download;


/***/ },

/***/ 1364
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.getMetadata = void 0;
const index_1 = __webpack_require__(8350);
const errors_1 = __webpack_require__(7766);
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Get metadata for multiple objectIds
 *
 * @param functionKey - Configuration object containing the backend function key to filter and generate object metadata
 * @param keys - Array of object keys to get metadata for
 * @returns Promise resolving to GetMetadataResult[]
 * @throws {BridgeAPIError} When filtering fails or download encounters an error
 */
const getMetadata = async ({ functionKey, keys }) => {
    void callBridge('trackObjectStoreAction', { action: 'getMetadata' });
    if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError('functionKey is required to filter and generate object metadata');
    }
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new errors_1.BridgeAPIError('keys array is required and must not be empty');
    }
    const results = await Promise.all(keys.map(async (key) => {
        const result = (await (0, index_1.invoke)(functionKey, { key }));
        if (!result || typeof result !== 'object') {
            return {
                key: key,
                error: 'Invalid response from functionKey'
            };
        }
        return result;
    }));
    return results;
};
exports.getMetadata = getMetadata;


/***/ },

/***/ 3221
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(7897), exports);
tslib_1.__exportStar(__webpack_require__(2572), exports);


/***/ },

/***/ 7897
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createUploadPromises = exports.objectStore = void 0;
const upload_1 = __webpack_require__(7928);
Object.defineProperty(exports, "createUploadPromises", { enumerable: true, get: function () { return upload_1.createUploadPromises; } });
const deleteObjects_1 = __webpack_require__(8204);
const download_1 = __webpack_require__(8681);
const getMetadata_1 = __webpack_require__(1364);
exports.objectStore = {
    upload: upload_1.upload,
    download: download_1.download,
    getMetadata: getMetadata_1.getMetadata,
    delete: deleteObjects_1.deleteObjects
};


/***/ },

/***/ 2572
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ },

/***/ 7928
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.upload = exports.createUploadPromises = void 0;
const invoke_1 = __webpack_require__(8350);
const errors_1 = __webpack_require__(7766);
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Convert base64 string to Blob
 */
const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType || 'application/octet-stream' });
};
/**
 * Get metadata for a blob object including size and checksum
 */
const getObjectMetadata = async (blob) => {
    const length = blob.size;
    // Calculate checksum using SubtleCrypto API
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    // Convert to base64 format (required by OS API)
    const checksum = btoa(String.fromCharCode(...hashArray));
    const checksumType = 'SHA256';
    return {
        length,
        checksum,
        checksumType
    };
};
/**
 * Start individual upload operations and return array of promises
 * This allows tracking per-file upload progress
 *
 * @param functionKey - Configuration object containing the backend function key to filter and generate presigned URLs
 * @param objects - Array of Blob objects or Base64Object (with data and optional mimeType) to upload
 * @returns Array of individual upload promises with their associated index
 * @throws {BridgeAPIError} When filtering fails or upload encounters an error
 */
const createUploadPromises = async ({ functionKey, objects }) => {
    if (!functionKey || functionKey.length === 0) {
        throw new errors_1.BridgeAPIError('functionKey is required to filter and generate presigned URLs');
    }
    if (!Array.isArray(objects) || objects.length === 0) {
        throw new errors_1.BridgeAPIError('objects array is required and must not be empty');
    }
    // Validate and convert objects to Blobs in a single pass
    const blobs = objects.map((obj, index) => {
        if (obj instanceof Blob) {
            return obj;
        }
        const isBase64Object = obj && typeof obj === 'object' && 'data' in obj && typeof obj.data === 'string';
        if (!isBase64Object) {
            throw new errors_1.BridgeAPIError(`Invalid object type at index ${index}. Only Blob or Base64Object (with data string and optional mimeType) are accepted.`);
        }
        try {
            return base64ToBlob(obj.data, obj.mimeType);
        }
        catch (e) {
            throw new errors_1.BridgeAPIError(`Invalid base64 data at index ${index}. The data string must be valid base64 encoded.`);
        }
    });
    const allObjectMetadata = await Promise.all(blobs.map((blob) => getObjectMetadata(blob)));
    const presignedURLsToObjectMetadata = (await (0, invoke_1.invoke)(functionKey, {
        allObjectMetadata
    }));
    if (!presignedURLsToObjectMetadata || typeof presignedURLsToObjectMetadata !== 'object') {
        throw new errors_1.BridgeAPIError('Invalid response from functionKey');
    }
    const checksumToBlobMap = new Map();
    const checksumToIndexMap = new Map();
    blobs.forEach((blob, index) => {
        const metadata = allObjectMetadata[index];
        checksumToBlobMap.set(metadata.checksum, blob);
        checksumToIndexMap.set(metadata.checksum, index);
    });
    const uploadPromises = Object.entries(presignedURLsToObjectMetadata).map(([presignedUrl, metadata]) => {
        const { key, checksum } = metadata;
        const object = checksumToBlobMap.get(checksum);
        const index = checksumToIndexMap.get(checksum);
        if (index === undefined) {
            return {
                promise: Promise.resolve({
                    success: false,
                    key: key,
                    error: `Index not found for checksum ${checksum}`
                }),
                index: -1
            };
        }
        if (!object) {
            return {
                promise: Promise.resolve({
                    success: false,
                    key: key,
                    error: `Blob not found for checksum ${checksum}`
                }),
                index
            };
        }
        const uploadPromise = (async () => {
            try {
                const response = await fetch(presignedUrl, {
                    method: 'PUT',
                    body: object,
                    headers: {
                        'Content-Type': object.type || 'application/octet-stream',
                        'Content-Length': object.size.toString()
                    }
                });
                return {
                    success: response.ok,
                    key: key,
                    status: response.status,
                    error: response.ok ? undefined : `Upload failed with status ${response.status}`
                };
            }
            catch (error) {
                return {
                    success: false,
                    key: key,
                    status: 503,
                    error: error instanceof Error ? error.message : 'Upload failed'
                };
            }
        })();
        return { promise: uploadPromise, index, objectType: object.type, objectSize: object.size };
    });
    return uploadPromises;
};
exports.createUploadPromises = createUploadPromises;
/**
 * Upload multiple objects to pre-signed URLs
 *
 * @param functionKey - Configuration object containing the backend function key to filter and generate presigned URLs
 * @param objects - Array of Blob objects or Base64Object (with data and optional mimeType) to upload
 * @returns Promise resolving to UploadResult[]
 * @throws {BridgeAPIError} When filtering fails or upload encounters an error
 */
const upload = async ({ functionKey, objects }) => {
    void callBridge('trackObjectStoreAction', { action: 'upload' });
    const uploadPromises = await (0, exports.createUploadPromises)({ functionKey, objects });
    const results = await Promise.all(uploadPromises.map((item) => item.promise));
    return results;
};
exports.upload = upload;


/***/ },

/***/ 358
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(5626), exports);
tslib_1.__exportStar(__webpack_require__(3206), exports);


/***/ },

/***/ 5626
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.permissions = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
const egressGet = async (payload) => {
    return callBridge('__permission__egressGet', payload);
};
const egressSet = async (payload) => {
    return callBridge('__permission__egressSet', payload);
};
const egressDeleteDomain = async (payload) => {
    return callBridge('__permission__egressDeleteDomain', payload);
};
const egressDeleteGroup = async (payload) => {
    return callBridge('__permission__egressDeleteGroup', payload);
};
const remoteGet = async (payload) => {
    return callBridge('__permission__remoteGet', payload);
};
const remoteSet = async (payload) => {
    return callBridge('__permission__remoteSet', payload);
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


/***/ },

/***/ 3206
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createPermissionUtils = createPermissionUtils;
exports.checkPermissions = checkPermissions;
const egress_1 = __webpack_require__(6079);
const view_1 = __webpack_require__(1855);
/**
 * Helper function to extract URL string from external URL permissions.
 * Matches the implementation in @forge/api for consistency.
 */
function extractUrlString(url) {
    if (typeof url === 'string') {
        return url;
    }
    if ('address' in url && url.address) {
        return url.address;
    }
    return url.remote || '';
}
/**
 * Resource types that can be loaded externally
 */
const RESOURCE_TYPES = ['fonts', 'styles', 'frames', 'images', 'media', 'scripts'];
/**
 * Fetch types for external requests
 */
const FETCH_TYPES = ['backend', 'client'];
/**
 * Create permission utilities from runtime permissions
 * @param runtimePermissions - The runtime permissions from context
 * @returns Permission utilities or null if permissions are not available
 */
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
            // Extract URLs and create egress filter
            const allowList = fetchUrls.map(extractUrlString).filter((u) => u.length > 0);
            if (allowList.length === 0)
                return false;
            const egressFilter = new egress_1.EgressFilteringService(allowList);
            // Backend: hostname-only matching, Client: CSP validation (includes paths)
            // Type assertion needed because node_modules may have outdated types
            const egressFilterWithCSP = egressFilter;
            return type === 'client' ? egressFilterWithCSP.isValidUrlCSP(url) : egressFilter.isValidUrl(url);
        },
        canLoadResource: (type, url) => {
            const resourceUrls = external[type];
            if (!(resourceUrls === null || resourceUrls === void 0 ? void 0 : resourceUrls.length))
                return false;
            // Extract URLs and create egress filter
            const allowList = resourceUrls.map(extractUrlString).filter((u) => u.length > 0);
            if (allowList.length === 0)
                return false;
            const egressFilter = new egress_1.EgressFilteringService(allowList);
            // All resources use CSP validation (checks protocol + hostname + paths)
            // Type assertion needed because node_modules may have outdated types
            const egressFilterWithCSP = egressFilter;
            return egressFilterWithCSP.isValidUrlCSP(url);
        },
        getScopes: () => scopeArray,
        getExternalPermissions: () => external,
        hasAnyPermissions: () => scopeArray.length > 0 || Object.keys(external).length > 0
    };
}
/**
 * Check if required scopes are granted
 */
function checkScopes(requiredScopes, permissionUtils) {
    if (!(requiredScopes === null || requiredScopes === void 0 ? void 0 : requiredScopes.length)) {
        return undefined;
    }
    const missingScopes = requiredScopes.filter((scope) => !permissionUtils.hasScope(scope));
    return missingScopes.length > 0 ? missingScopes : undefined;
}
/**
 * Check if required fetch permissions are granted
 */
function checkFetchPermissions(requiredFetch, permissionUtils) {
    if (!(requiredFetch === null || requiredFetch === void 0 ? void 0 : requiredFetch.fetch)) {
        return undefined;
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
    return Object.keys(missingFetch).length > 0 ? missingFetch : undefined;
}
/**
 * Check if required resource permissions are granted
 */
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
    return Object.keys(missingResources).length > 0 ? missingResources : undefined;
}
/**
 * Check if required external permissions are granted
 */
function checkExternalPermissions(requiredExternal, permissionUtils) {
    if (!requiredExternal) {
        return undefined;
    }
    const missingFetch = checkFetchPermissions(requiredExternal, permissionUtils);
    const missingResources = checkResourcePermissions(requiredExternal, permissionUtils);
    if (!missingFetch && !missingResources) {
        return undefined;
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
// Throws if a field that should be a plain object but is something else.
// Only used for external and external.fetch, which are guarded above.
function validateObjectField(value, fieldPath) {
    if (value !== undefined) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new TypeError(`${fieldPath} should be an object, not ${Array.isArray(value) ? 'an array' : `a ${typeof value}`}`);
        }
    }
}
// Throws if a field that should be an array but is something else.
function validateArrayField(value, fieldPath) {
    if (value !== undefined && !Array.isArray(value)) {
        throw new TypeError(`${fieldPath} should be an array, not a ${typeof value}`);
    }
}
/**
 * Validates that fields in requiredPermissions have the correct types.
 */
function validatePermissionShape(requiredPermissions) {
    validateArrayField(requiredPermissions.scopes, 'scopes');
    const external = requiredPermissions.external;
    if (external === undefined)
        return;
    validateObjectField(external, 'external');
    if (external.fetch !== undefined) {
        validateObjectField(external.fetch, 'external.fetch');
        for (const type of FETCH_TYPES) {
            validateArrayField(external.fetch[type], `external.fetch.${type}`);
        }
    }
    for (const type of RESOURCE_TYPES) {
        validateArrayField(external[type], `external.${type}`);
    }
}
/**
 * Check if required permissions are granted
 * @param requiredPermissions - The permissions required to check
 * @param runtimePermissions - The runtime permissions from context (optional, will be fetched from view.getContext() if not provided)
 * @returns Promise resolving to permission check result with granted status and missing permissions
 */
async function checkPermissions(requiredPermissions, runtimePermissions) {
    var _a;
    // Early return for falsy required permissions
    if (!requiredPermissions) {
        return { granted: false, missing: null };
    }
    validatePermissionShape(requiredPermissions);
    // Early return for empty permissions (no requirements = all granted)
    if (!((_a = requiredPermissions.scopes) === null || _a === void 0 ? void 0 : _a.length) && !requiredPermissions.external) {
        return { granted: true, missing: null };
    }
    // If runtimePermissions is not provided, fetch it from context
    let permissionsToCheck = runtimePermissions;
    if (!permissionsToCheck) {
        const context = await view_1.view.getContext();
        permissionsToCheck = context.permissions;
    }
    const permissionUtils = createPermissionUtils(permissionsToCheck);
    if (!permissionUtils) {
        // If permissions are not available, return not granted
        return { granted: false, missing: null };
    }
    const missing = {};
    let hasAllRequiredPermissions = true;
    // Check scopes
    const missingScopes = checkScopes(requiredPermissions.scopes, permissionUtils);
    if (missingScopes) {
        missing.scopes = missingScopes;
        hasAllRequiredPermissions = false;
    }
    // Check external permissions
    const missingExternal = checkExternalPermissions(requiredPermissions.external, permissionUtils);
    if (missingExternal) {
        missing.external = missingExternal;
        hasAllRequiredPermissions = false;
    }
    // Note: Content permissions are not supported in the current RuntimePermissions type
    return {
        granted: hasAllRequiredPermissions,
        missing: hasAllRequiredPermissions ? null : missing
    };
}


/***/ },

/***/ 4247
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Bitbucket = exports.Confluence = exports.Jira = exports.realtime = void 0;
var realtime_1 = __webpack_require__(9682);
Object.defineProperty(exports, "realtime", ({ enumerable: true, get: function () { return realtime_1.realtime; } }));
var productContext_1 = __webpack_require__(2469);
Object.defineProperty(exports, "Jira", ({ enumerable: true, get: function () { return productContext_1.Jira; } }));
Object.defineProperty(exports, "Confluence", ({ enumerable: true, get: function () { return productContext_1.Confluence; } }));
Object.defineProperty(exports, "Bitbucket", ({ enumerable: true, get: function () { return productContext_1.Bitbucket; } }));


/***/ },

/***/ 2469
(__unused_webpack_module, exports) {

"use strict";

// These enum values directly map to properties in the context.extension object in a product's FCT.
// It allows a subset of properties to be specified for Realtime channel authorization.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Bitbucket = exports.Confluence = exports.Jira = void 0;
var Jira;
(function (Jira) {
    Jira["Board"] = "board";
    Jira["Issue"] = "issue";
    Jira["Project"] = "project";
})(Jira || (exports.Jira = Jira = {}));
var Confluence;
(function (Confluence) {
    Confluence["Content"] = "content";
    Confluence["Space"] = "space";
})(Confluence || (exports.Confluence = Confluence = {}));
var Bitbucket;
(function (Bitbucket) {
    Bitbucket["Repository"] = "repository";
    Bitbucket["PullRequest"] = "pullRequest";
})(Bitbucket || (exports.Bitbucket = Bitbucket = {}));


/***/ },

/***/ 9682
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.realtime = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
const publish = (channel, payload, options) => {
    return callBridge('publishRealtimeChannel', { channelName: channel, eventPayload: payload, options });
};
const subscribe = (channel, callback, options) => {
    return callBridge('subscribeRealtimeChannel', {
        channelName: channel,
        onEvent: callback,
        options
    });
};
const publishGlobal = (channel, payload, options) => {
    return callBridge('publishRealtimeChannel', { channelName: channel, eventPayload: payload, options, isGlobal: true });
};
const subscribeGlobal = (channel, callback, options) => {
    return callBridge('subscribeRealtimeChannel', {
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


/***/ },

/***/ 7833
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.requestTeamworkGraph = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
const requestTeamworkGraph = async (query, variables) => {
    const response = await callBridge('requestTeamworkGraph', { query, variables });
    return response;
};
exports.requestTeamworkGraph = requestTeamworkGraph;


/***/ },

/***/ 351
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(6250), exports);


/***/ },

/***/ 6250
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.router = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Returns a URL object for a given location.
 *
 * @param location - The location to get the URL for
 * @returns A URL object for the given location
 */
const getUrl = async (location) => {
    if (!(location === null || location === void 0 ? void 0 : location.target)) {
        throw new Error('target is required for getUrl');
    }
    const url = await callBridge('getUrl', location);
    if (!url) {
        throw new Error('Failed to get URL');
    }
    try {
        return new URL(url);
    }
    catch (error) {
        throw new Error(`Failed to parse URL: ${url} (${error})`);
    }
};
/**
 * Navigates to a location within the same tab.
 *
 * @param location URL or `NavigationLocation` object
 * @returns a promise that resolves when navigation is complete
 */
const navigate = (location) => {
    if (typeof location === 'string') {
        return callBridge('navigate', { url: location, type: 'same-tab' });
    }
    else {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
            throw new Error('target is required for navigation');
        }
        return callBridge('navigate', { ...location, type: 'same-tab' });
    }
};
/**
 * Opens a new tab in the browser and navigates to the specified location.
 *
 * @param location URL or `NavigationLocation` object
 * @returns a promise that resolves when navigation is complete
 */
const open = (location) => {
    if (typeof location === 'string') {
        return callBridge('navigate', { url: location, type: 'new-tab' });
    }
    else {
        if (!(location === null || location === void 0 ? void 0 : location.target)) {
            throw new Error('target is required for navigation');
        }
        return callBridge('navigate', { ...location, type: 'new-tab' });
    }
};
/**
 * Reloads the page.
 *
 * @returns a promise that resolves to void when the page is reloaded
 */
const reload = async () => callBridge('reload');
exports.router = {
    getUrl,
    navigate,
    open,
    reload
};


/***/ },

/***/ 8325
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NavigationTarget = void 0;
// Constants for developer convenience. The JS Docs below will also be displayed in the IDE when the developer is using this object.
exports.NavigationTarget = {
    /**
     * The view page for pages, blogs and custom content. Takes a contentId to identify the content.
     */
    ContentView: 'contentView',
    /**
     * The edit page for pages, blogs and custom content. Takes a contentId to identify the content.
     */
    ContentEdit: 'contentEdit',
    /**
     * The list/collector page for pages, blogs and custom content contained in a space. Takes a spaceKey and a contentType to identify the content type for pages and blogs. Takes a moduleKey for custom content.
     */
    ContentList: 'contentList',
    /**
     * The space view page. Takes a spaceKey to identify the space.
     */
    SpaceView: 'spaceView',
    /**
     * The page within a specific module. Takes a moduleKey to identify the correct module.
     */
    Module: 'module',
    /**
     * The profile page for a specific user. Takes an accountId to identify the user.
     */
    UserProfile: 'userProfile',
    /**
     * A dashboard in Jira. Takes a dashboardId to identify the dashboard.
     */
    Dashboard: 'dashboard',
    /**
     * An issue in Jira. Takes an issueKey to identify the issue.
     */
    Issue: 'issue',
    /**
     * The project settings details of a Jira project. Takes a projectKey to identify the project. Only accessible to administrators.
     */
    ProjectSettingsDetails: 'projectSettingsDetails'
};


/***/ },

/***/ 5966
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(7932), exports);


/***/ },

/***/ 8319
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.isEnabled = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
/**
 * Checks if Rovo is enabled for the current tenant.
 *
 * @returns boolean
 */
const isEnabled = () => {
    return callBridge('isRovoEnabled');
};
exports.isEnabled = isEnabled;


/***/ },

/***/ 9752
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.open = exports.B = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const MAX_AGENT_LENGTH = 30;
const callBridge = (0, bridge_1.getCallBridge)();
exports.B = 'Unable to open Rovo Chat due to usage in an unsupported product. Only Confluence, Jira and some Jira Service Management modules are supported at this point. See https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/';
const transformRovoPayload = (openRovoPayload) => {
    switch (openRovoPayload.type) {
        case 'forge':
            return {
                agentName: openRovoPayload.agentName,
                agentKey: openRovoPayload.agentKey,
                prompt: openRovoPayload.prompt
            };
        case 'atlassian':
            return {
                agentName: openRovoPayload.agentName,
                prompt: openRovoPayload.prompt
            };
        default:
            return { prompt: openRovoPayload.prompt };
    }
};
/**
 * Opens Rovo chat from the given Rovo agent name.
 *
 * @param {OpenRovoPayload} [openRovoPayload] - Payload to open chat.
 *   Can be one of:
 *     - ForgeAgentPayload: { agentName: string, agentKey: string, prompt?: string }
 *     - AtlassianAgentPayload: { agentName: string, prompt?: string }
 *     - DefaultAgentPayload: { prompt?: string }
 */
const open = async (openRovoPayload) => {
    if (openRovoPayload.type === 'forge') {
        if (openRovoPayload.agentName.length > MAX_AGENT_LENGTH) {
            throw new Error('rovo agent name too long');
        }
        if (openRovoPayload.agentKey.length > MAX_AGENT_LENGTH) {
            throw new Error('rovo agent key too long');
        }
    }
    const rovoArgs = transformRovoPayload(openRovoPayload);
    const success = await callBridge('openRovo', rovoArgs);
    if (success === false) {
        throw new errors_1.BridgeAPIError(exports.B);
    }
};
exports.open = open;


/***/ },

/***/ 7932
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.rovo = void 0;
const open_1 = __webpack_require__(9752);
const isEnabled_1 = __webpack_require__(8319);
exports.rovo = {
    open: open_1.open,
    isEnabled: isEnabled_1.isEnabled
};


/***/ },

/***/ 6683
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.blobToBase64 = exports.base64ToBlob = void 0;
const base64ToBlob = (b64string, mimeType) => {
    if (!b64string) {
        return null;
    }
    const base64Data = b64string.includes(';base64') ? b64string.split(',')[1] : b64string;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};
exports.base64ToBlob = base64ToBlob;
const blobToBase64 = (blob) => {
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


/***/ },

/***/ 9939
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.withRateLimiter = void 0;
const errors_1 = __webpack_require__(7766);
const withRateLimiter = (wrappedFn, maxOps, intervalInMs, exceededErrorMessage) => {
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
            throw new errors_1.BridgeAPIError(exceededErrorMessage || 'Too many invocations.');
        }
        numOps = numOps + 1;
        return wrappedFn(...args);
    };
};
exports.withRateLimiter = withRateLimiter;


/***/ },

/***/ 1004
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.createAdfRendererIframeProps = exports.H = void 0;
/**
 * Sends the ADF document message to the adf-renderer iframe once it signals readiness.
 */
const READY_SIGNAL_FALLBACK_DELAY_MS = 10000;
const sendMessageWhenReady = (iframe, message, origin) => {
    const sendMessage = () => { var _a; return (_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) === null || _a === void 0 ? void 0 : _a.postMessage(message, origin); };
    const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handleReady);
        sendMessage();
    }, READY_SIGNAL_FALLBACK_DELAY_MS);
    const handleReady = (event) => {
        var _a;
        if (event.source === (iframe === null || iframe === void 0 ? void 0 : iframe.contentWindow) && ((_a = event.data) === null || _a === void 0 ? void 0 : _a.source) === 'forge-adf-renderer-ready') {
            clearTimeout(timeoutId);
            window.removeEventListener('message', handleReady);
            sendMessage();
        }
    };
    window.addEventListener('message', handleReady);
};
exports.H = sendMessageWhenReady;
const createAdfRendererIframeProps = async (context, iframeId) => {
    const IframeResizer = await __webpack_require__.e(/* import() */ 126).then(() => (__webpack_require__.t(4126, 19)));
    const IframeResizerModule = IframeResizer.default || IframeResizer;
    const origin = new URL(document.referrer).origin;
    const src = `${origin}/forge-apps/adf-renderer`;
    const id = iframeId || `forge-adf-renderer-iframe-${crypto.randomUUID()}`;
    const onLoad = () => {
        var _a, _b, _c, _d, _e;
        const iframe = document.getElementById(id);
        const message = {
            type: 'adf-document',
            document: (_a = context.extension.macro) === null || _a === void 0 ? void 0 : _a.body,
            timestamp: Date.now(),
            source: 'forge-adf-renderer',
            localId: context.localId,
            isEditing: (_c = (_b = context.extension) === null || _b === void 0 ? void 0 : _b.isEditing) !== null && _c !== void 0 ? _c : false,
            contentId: (_e = (_d = context.extension) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.id
        };
        IframeResizerModule.iframeResizer({
            heightCalculationMethod: 'taggedElement',
            widthCalculationMethod: 'bodyScroll',
            initCallback: (iframe) => {
                var _a;
                (_a = iframe === null || iframe === void 0 ? void 0 : iframe.iFrameResizer) === null || _a === void 0 ? void 0 : _a.resize();
            }
        }, iframe || '');
        (0, exports.H)(iframe, message, origin);
    };
    setTimeout(() => {
        document.documentElement.style.height = 'auto';
        document.body.style.height = 'auto';
    }, 200);
    return {
        id,
        src,
        onLoad
    };
};
exports.createAdfRendererIframeProps = createAdfRendererIframeProps;


/***/ },

/***/ 2513
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.changeWindowTitle = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const changeWindowTitle = async (title) => {
    try {
        await callBridge('changeWindowTitle', title);
    }
    catch (e) {
        throw new errors_1.BridgeAPIError("the window title wasn't changed due to error.");
    }
};
exports.changeWindowTitle = changeWindowTitle;


/***/ },

/***/ 3031
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.close = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const close = async (payload) => {
    try {
        const success = await callBridge('close', payload);
        // TODO: Modify @atlassian/forge-ui to throw if close fails instead of returning boolean DEVO-680
        if (success === false) {
            throw new errors_1.BridgeAPIError("this resource's view is not closable.");
        }
    }
    catch (e) {
        throw new errors_1.BridgeAPIError("this resource's view is not closable.");
    }
};
exports.close = close;


/***/ },

/***/ 5111
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.createHistory = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
const createHistory = async () => {
    const history = await callBridge('createHistory');
    history.listen((location) => {
        history.location = location;
    });
    return history;
};
exports.createHistory = createHistory;


/***/ },

/***/ 2149
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.emitReadyEvent = void 0;
const events_1 = __webpack_require__(8482);
const view_1 = __webpack_require__(1382);
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
const EXTENSION_READY = 'EXTENSION_READY';
const emitReadyEvent = async () => {
    // Confluence export relies on events instead of `callBridge`
    const context = await view_1.view.getContext();
    // dispatches event 'forge.bridge.EXTENSION_READY' on product window
    await events_1.events.emit(EXTENSION_READY, {
        localId: context.localId
    });
    // TODO: Consider using the above event for static macros as well for to avoid two calls
    // `callBridge` is used for static macros in XEP to signal that the forgeDoc is ready to be snapshotted
    try {
        await callBridge('emitReadyEvent');
    }
    catch {
        // Silently ignore the error as this app may be calling this method in Confluence view mode where the method is not supported.
    }
};
exports.emitReadyEvent = emitReadyEvent;


/***/ },

/***/ 1192
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.getContext = void 0;
const bridge_1 = __webpack_require__(5264);
const i18n_1 = __webpack_require__(4280);
const callBridge = (0, bridge_1.getCallBridge)();
const getContext = async () => {
    var _a;
    const context = await callBridge('getContext');
    const locale = context === null || context === void 0 ? void 0 : context.locale;
    if (locale) {
        // still fallback to the locale if it is not supported,
        // this is to avoid breaking changes
        context.locale = (_a = (0, i18n_1.ensureLocale)(locale)) !== null && _a !== void 0 ? _a : locale;
    }
    return context;
};
exports.getContext = getContext;


/***/ },

/***/ 7576
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.getFrameDispatch = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
const getFrameDispatch = async () => {
    return await callBridge('getFrameDispatch');
};
exports.getFrameDispatch = getFrameDispatch;


/***/ },

/***/ 1855
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(1382), exports);


/***/ },

/***/ 6352
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.onClose = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const onClose = async (payload) => {
    try {
        const success = await callBridge('onClose', payload);
        if (success === false) {
            throw new errors_1.BridgeAPIError('`onClose` call has failed.');
        }
    }
    catch (e) {
        throw new errors_1.BridgeAPIError("`onClose` failed because this resource's view is not closable.");
    }
};
exports.onClose = onClose;


/***/ },

/***/ 8995
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.open = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const open = async () => {
    try {
        const success = await callBridge('open');
        // TODO: Modify @atlassian/forge-ui to throw if close fails instead of returning boolean DEVO-680
        if (success === false) {
            throw new errors_1.BridgeAPIError("this resource's view is not openable.");
        }
    }
    catch (e) {
        throw new errors_1.BridgeAPIError("this resource's view is not openable.");
    }
};
exports.open = open;


/***/ },

/***/ 8348
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.refresh = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const refresh = async (payload) => {
    const success = await callBridge('refresh', payload);
    if (success === false) {
        throw new errors_1.BridgeAPIError("this resource's view is not refreshable.");
    }
};
exports.refresh = refresh;


/***/ },

/***/ 1251
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.submit = void 0;
const bridge_1 = __webpack_require__(5264);
const errors_1 = __webpack_require__(7766);
const callBridge = (0, bridge_1.getCallBridge)();
const submit = async (payload) => {
    const success = await callBridge('submit', payload);
    if (success === false) {
        throw new errors_1.BridgeAPIError("this resource's view is not submittable.");
    }
};
exports.submit = submit;


/***/ },

/***/ 6530
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.theme = void 0;
const bridge_1 = __webpack_require__(5264);
const callBridge = (0, bridge_1.getCallBridge)();
exports.theme = {
    enable: () => callBridge('enableTheming')
};


/***/ },

/***/ 1382
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.view = void 0;
const submit_1 = __webpack_require__(1251);
const close_1 = __webpack_require__(3031);
const open_1 = __webpack_require__(8995);
const refresh_1 = __webpack_require__(8348);
const createHistory_1 = __webpack_require__(5111);
const getContext_1 = __webpack_require__(1192);
const changeWindowTitle_1 = __webpack_require__(2513);
const theme_1 = __webpack_require__(6530);
const emitReadyEvent_1 = __webpack_require__(2149);
const adf_renderer_1 = __webpack_require__(1004);
const onClose_1 = __webpack_require__(6352);
const getFrameDispatch_1 = __webpack_require__(7576);
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


/***/ },

/***/ 7953
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EgressFilteringService = void 0;
const url_parser_1 = __webpack_require__(6836);
const utils_1 = __webpack_require__(7194);
class EgressFilteringService {
    constructor(allowList) {
        this.URLs = allowList.filter((domainOrURL) => !domainOrURL.startsWith('*')).map((url) => this.parseUrl(url));
        this.wildcardDomains = allowList
            .filter((domainOrURL) => domainOrURL !== '*')
            .map((url) => this.parseUrl(url))
            .filter((url) => decodeURIComponent(url.hostname).startsWith('*'))
            .map((url) => ({
            ...url,
            regex: (0, utils_1.globToRegex)(decodeURIComponent(url.hostname))
        }));
        this.allowsEverything = allowList.includes('*');
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
        return (this.allowedDomainExactAndPath(parsedUrl, this.URLs) ||
            this.allowedDomainPatternAndPath(parsedUrl, this.wildcardDomains));
    }
    allowedDomainExact(domain, allowList) {
        return allowList
            .filter((allowed) => allowed.protocol === domain.protocol)
            .some((url) => url.hostname === domain.hostname);
    }
    allowedDomainExactAndPath(domain, allowList) {
        return allowList
            .filter((allowed) => this.protocolMatchesCSP(allowed.protocol, domain.protocol))
            .filter((allowed) => allowed.hostname === domain.hostname)
            .some((allowed) => this.pathMatches(allowed.pathname, domain.pathname));
    }
    allowedDomainPattern(domain, allowList) {
        return allowList
            .filter((allowed) => allowed.protocol === domain.protocol)
            .some((pattern) => pattern.regex.test(domain.hostname));
    }
    allowedDomainPatternAndPath(domain, allowList) {
        return allowList
            .filter((pattern) => this.protocolMatchesCSP(pattern.protocol, domain.protocol))
            .filter((pattern) => pattern.regex.test(domain.hostname))
            .some((allowed) => this.pathMatches(allowed.pathname, domain.pathname));
    }
    protocolMatchesCSP(allowedProtocol, requestProtocol) {
        if (allowedProtocol === requestProtocol) {
            return true;
        }
        if (allowedProtocol === 'http:' && requestProtocol === 'https:') {
            return true;
        }
        if (allowedProtocol === 'ws:' && requestProtocol === 'wss:') {
            return true;
        }
        return false;
    }
    pathMatches(allowedPath, requestPath) {
        if (allowedPath === '/') {
            return true;
        }
        if (allowedPath.endsWith('/')) {
            return requestPath.startsWith(allowedPath);
        }
        return requestPath === allowedPath;
    }
}
exports.EgressFilteringService = EgressFilteringService;


/***/ },

/***/ 1839
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(7953), exports);
tslib_1.__exportStar(__webpack_require__(6836), exports);
tslib_1.__exportStar(__webpack_require__(7194), exports);


/***/ },

/***/ 6836
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseUrl = parseUrl;
function parseUrl(url) {
    var _a, _b;
    const protocol = (_b = (_a = url.match(/^(.*?:)/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : 'https:';
    const hostAndPath = url.replace(protocol, '').replace(/^\/*/, '').replace(/^\\*/, '').split('?')[0].split('#')[0];
    const hostname = hostAndPath.split('/')[0];
    const pathname = hostAndPath.slice(hostname.length) || '/';
    return { protocol, hostname, pathname };
}


/***/ },

/***/ 7194
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getEgressesBasedOnToggles = exports.sortAndGroupEgressPermissionsByDomain = exports.EgressCategory = exports.EgressType = void 0;
exports.globToRegex = globToRegex;
const url_parser_1 = __webpack_require__(6836);
function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`);
}
const sortAndGroupEgressPermissionsByDomain = (egressAddresses) => {
    if ((egressAddresses === null || egressAddresses === void 0 ? void 0 : egressAddresses.length) === 0) {
        return [];
    }
    const protocolRegex = /^(.*?:\/\/)/;
    const domains = new Set();
    const wildcardDomains = [];
    egressAddresses.forEach((item) => {
        const itemWithProtocol = protocolRegex.test(item) ? item : `https://${item}`;
        const url = (0, url_parser_1.parseUrl)(itemWithProtocol);
        if (url.hostname.startsWith('*')) {
            domains.add(url.hostname.substring(2));
            wildcardDomains.push(globToRegex(url.hostname));
        }
        else {
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
(function (EgressType) {
    EgressType["FetchBackendSide"] = "FETCH_BACKEND_SIDE";
    EgressType["FetchClientSide"] = "FETCH_CLIENT_SIDE";
    EgressType["Fonts"] = "FONTS";
    EgressType["Frames"] = "FRAMES";
    EgressType["Images"] = "IMAGES";
    EgressType["Media"] = "MEDIA";
    EgressType["Scripts"] = "SCRIPTS";
    EgressType["Styles"] = "STYLES";
})(EgressType || (exports.EgressType = EgressType = {}));
var EgressCategory;
(function (EgressCategory) {
    EgressCategory["ANALYTICS"] = "ANALYTICS";
})(EgressCategory || (exports.EgressCategory = EgressCategory = {}));
const getEgressesBasedOnToggles = (input) => {
    const filteredEgresses = input.egress.filter((egress) => {
        var _a;
        if (((_a = egress.category) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === EgressCategory.ANALYTICS) {
            if (input.installationConfig) {
                const analyticsConfig = input.installationConfig.find((config) => config.key.toUpperCase() === 'ALLOW_EGRESS_ANALYTICS');
                return (analyticsConfig === null || analyticsConfig === void 0 ? void 0 : analyticsConfig.value) !== false;
            }
            else {
                return input.overrides.ALLOW_EGRESS_ANALYTICS !== false;
            }
        }
        return true;
    });
    const egressByType = new Map();
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


/***/ },

/***/ 6079
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(1839), exports);


/***/ },

/***/ 6893
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FORGE_SUPPORTED_LOCALE_CODES = exports.I18N_BUNDLE_FOLDER_NAME = exports.I18N_INFO_FILE_NAME = void 0;
exports.I18N_INFO_FILE_NAME = 'i18n-info.json';
exports.I18N_BUNDLE_FOLDER_NAME = '__LOCALES__';
exports.FORGE_SUPPORTED_LOCALE_CODES = [
    'zh-CN',
    'zh-TW',
    'cs-CZ',
    'da-DK',
    'nl-NL',
    'en-US',
    'en-GB',
    'et-EE',
    'fi-FI',
    'fr-FR',
    'de-DE',
    'hu-HU',
    'is-IS',
    'it-IT',
    'ja-JP',
    'ko-KR',
    'no-NO',
    'pl-PL',
    'pt-BR',
    'pt-PT',
    'ro-RO',
    'ru-RU',
    'sk-SK',
    'tr-TR',
    'es-ES',
    'sv-SE'
];


/***/ },

/***/ 7898
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ensureLocale = void 0;
const constants_1 = __webpack_require__(6893);
const forgeSupportedLocaleCodesSet = new Set(constants_1.FORGE_SUPPORTED_LOCALE_CODES);
const localeFallbacks = {
    'en-UK': 'en-GB',
    'nb-NO': 'no-NO'
};
const languageToLocaleCodeMap = constants_1.FORGE_SUPPORTED_LOCALE_CODES.reduce((agg, code) => {
    const [lng] = code.split('-');
    if (!agg[lng]) {
        agg[lng] = code;
    }
    return agg;
}, {
    nb: 'no-NO',
    pt: 'pt-PT'
});
const ensureLocale = (rawLocale) => {
    const locale = rawLocale.replace('_', '-');
    if (forgeSupportedLocaleCodesSet.has(locale)) {
        return locale;
    }
    return languageToLocaleCodeMap[locale] ?? localeFallbacks[locale] ?? null;
};
exports.ensureLocale = ensureLocale;


/***/ },

/***/ 4280
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getI18nSupportedModuleEntries = exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getTranslationValue = void 0;
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(6893), exports);
tslib_1.__exportStar(__webpack_require__(6829), exports);
tslib_1.__exportStar(__webpack_require__(1100), exports);
tslib_1.__exportStar(__webpack_require__(7898), exports);
var translationValueGetter_1 = __webpack_require__(1813);
Object.defineProperty(exports, "getTranslationValue", ({ enumerable: true, get: function () { return translationValueGetter_1.getTranslationValue; } }));
var moduleI18nHelper_1 = __webpack_require__(9962);
Object.defineProperty(exports, "extractI18nKeysFromModules", ({ enumerable: true, get: function () { return moduleI18nHelper_1.extractI18nKeysFromModules; } }));
Object.defineProperty(exports, "extractI18nPropertiesFromModules", ({ enumerable: true, get: function () { return moduleI18nHelper_1.extractI18nPropertiesFromModules; } }));
Object.defineProperty(exports, "getI18nSupportedModuleEntries", ({ enumerable: true, get: function () { return moduleI18nHelper_1.getI18nSupportedModuleEntries; } }));
tslib_1.__exportStar(__webpack_require__(5181), exports);


/***/ },

/***/ 9962
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.extractI18nPropertiesFromModules = exports.extractI18nKeysFromModules = exports.getI18nSupportedModuleEntries = void 0;
const isObject = (value) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const isI18nValue = (value) => {
    return typeof value?.i18n === 'string';
};
const isConnectModuleKey = (moduleKey) => moduleKey.startsWith('connect-');
const isCoreModuleKey = (moduleKey) => moduleKey.startsWith('core:');
const getI18nKeysFromObject = (obj) => {
    const visited = new Set();
    const visit = (value, i18nPath) => {
        if (!isObject(value) || visited.has(value)) {
            return [];
        }
        visited.add(value);
        return Object.entries(value).flatMap(([propKey, propValue]) => {
            const currentPath = [...i18nPath, propKey];
            if (isI18nValue(propValue)) {
                return [{ propertyPath: currentPath, key: propValue.i18n }];
            }
            else if (Array.isArray(propValue)) {
                return propValue.flatMap((item) => visit(item, currentPath));
            }
            return visit(propValue, currentPath);
        });
    };
    return visit(obj, []);
};
const getI18nSupportedModuleEntries = (modules) => {
    return Object.entries(modules).flatMap(([moduleKey, moduleEntries]) => {
        if (!isConnectModuleKey(moduleKey) &&
            !isCoreModuleKey(moduleKey) &&
            moduleEntries &&
            Array.isArray(moduleEntries) &&
            moduleEntries.length > 0) {
            return moduleEntries.map((moduleEntry) => [moduleEntry, moduleKey]);
        }
        return [];
    });
};
exports.getI18nSupportedModuleEntries = getI18nSupportedModuleEntries;
const extractI18nKeysFromModules = (modules) => {
    const i18nKeys = new Set();
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


/***/ },

/***/ 1813
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getTranslationValueFromContent = exports.getTranslationValue = void 0;
const tslib_1 = __webpack_require__(1635);
const get_1 = tslib_1.__importDefault(__webpack_require__(8156));
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
        const keyTokens = i18nKey.split('.');
        if (keyTokens.length > 1) {
            translationValue = (0, get_1.default)(translationContent, keyTokens, null);
        }
    }
    return typeof translationValue === 'string' ? translationValue : null;
};
exports.getTranslationValueFromContent = getTranslationValueFromContent;


/***/ },

/***/ 6829
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TranslationsGetter = exports.TranslationGetterError = void 0;
const pushIfNotExists = (array, item) => {
    if (!array.includes(item)) {
        array.push(item);
    }
};
class TranslationGetterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TranslationGetterError';
    }
}
exports.TranslationGetterError = TranslationGetterError;
class TranslationsGetter {
    resourcesAccessor;
    i18nInfoConfig = null;
    translationResources = new Map();
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
            }
            catch (error) {
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
            }
            catch (error) {
                if (error instanceof TranslationGetterError) {
                    throw error;
                }
                throw new TranslationGetterError('Failed to get i18n info config');
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
        return lookupOrder.filter((locale) => locales.includes(locale));
    }
}
exports.TranslationsGetter = TranslationsGetter;


/***/ },

/***/ 1100
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Translator = void 0;
const translationValueGetter_1 = __webpack_require__(1813);
class Translator {
    locale;
    translationsGetter;
    localeLookupOrderedTranslations = null;
    cache = new Map();
    constructor(locale, translationsGetter) {
        this.locale = locale;
        this.translationsGetter = translationsGetter;
    }
    async init() {
        this.localeLookupOrderedTranslations = await this.translationsGetter.getTranslationsByLocaleLookupOrder(this.locale);
    }
    translate(i18nKey) {
        if (!this.localeLookupOrderedTranslations) {
            throw new Error('TranslationLookup not initialized');
        }
        let result = this.cache.get(i18nKey);
        if (result === undefined) {
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
exports.Translator = Translator;


/***/ },

/***/ 5181
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ },

/***/ 5451
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AdfRenderer = void 0;
const jsx_runtime_1 = __webpack_require__(4848);
const replaceUnsupportedDocumentNodes_1 = __webpack_require__(7587);
const PlatformAdfRenderer = 'AdfRenderer';
/**
 * The AdfRenderer component provides a way to render a valid ADF document, using the same renderer that Atlassian uses internally to render ADF content in Confluence pages, Jira work items, and so on.
 * It allows you to replace node types that are unsupported in the context of a Forge app with replacement content, or remove them entirely.
 * See [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) for information on valid nodes.
 *
 * This component uses [@atlaskit/renderer](https://www.npmjs.com/package/@atlaskit/renderer) under the hood.
 *
 * Visit [Renderer editor](https://atlaskit.atlassian.com/examples/editor/renderer/basic) for a comprehensive list of different ADF document examples
 *
 * @see [AdfRenderer](https://developer.atlassian.com/platform/forge/ui-kit/components/adfRenderer/) in UI Kit documentation for more information
 */
const AdfRenderer = (props) => {
    const { replaceUnsupportedNode, document, ...adfRendererProps } = props;
    const documentWithMedia = replaceUnsupportedNode
        ? (0, replaceUnsupportedDocumentNodes_1.replaceUnsupportedDocumentNodes)(document, replaceUnsupportedNode)
        : document;
    const documentWithoutMedia = replaceUnsupportedNode
        ? (0, replaceUnsupportedDocumentNodes_1.replaceUnsupportedMediaNodes)(documentWithMedia, replaceUnsupportedNode)
        : documentWithMedia;
    return ((0, jsx_runtime_1.jsx)(PlatformAdfRenderer, { ...adfRendererProps, document: documentWithMedia, documentWithoutMedia: documentWithoutMedia }));
};
exports.AdfRenderer = AdfRenderer;


/***/ },

/***/ 6831
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Comment = void 0;
const jsx_runtime_1 = __webpack_require__(4848);
const content_wrapper_1 = __webpack_require__(9171);
const CommentPrimitive = 'Comment';
/**
 * A comment displays discussions and user feedback.
 *
 * @see [Comment](https://developer.atlassian.com/platform/forge/ui-kit/components/comment/) in UI Kit documentation for more information
 */
const Comment = ({ avatar, content, ...rest }) => {
    return ((0, jsx_runtime_1.jsxs)(CommentPrimitive, { ...rest, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "avatar", children: avatar }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "content", children: content })] }));
};
exports.Comment = Comment;


/***/ },

/***/ 510
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DynamicTable = void 0;
const jsx_runtime_1 = __webpack_require__(4848);
const react_1 = __webpack_require__(6540);
const content_wrapper_1 = __webpack_require__(9171);
/**
 * These are internal components that the table head and rows are converted into.
 * This is to ensure that they are correctly reconciled into ForgeDoc before being sent over
 * the bridge. On the product frontend, the ForgeDoc is transformed back into the props the
 * ADS DynamicTable expects.
 * */
const DynamicTablePrimitive = 'DynamicTable';
const Cell = 'Cell';
const Row = 'Row';
/**
 * A dynamic table displays rows of data with built-in pagination, sorting, and re-ordering functionality.
 *
 * @see [DynamicTable](https://developer.atlassian.com/platform/forge/ui-kit/components/dynamic-table/) in UI Kit documentation for more information
 */
const DynamicTable = ({ head, rows, ...tableProps }) => {
    const transformedHead = head?.cells.map((cell) => {
        const { content, key: cellKey, ...cellProps } = cell;
        const reconciledContent = 
        // @ts-ignore Not all constituents of type JSXElementConstructor are callable.
        (0, react_1.isValidElement)(content) && typeof content.type === 'function' ? content.type(content.props) : content;
        return (
        // The 'key' prop needs to be renamed as it is a reserved keyword in React, and won't
        // get included in the props object otherwise.
        (0, jsx_runtime_1.jsx)(Cell, { cellKey: cellKey, ...cellProps, children: reconciledContent }, cellKey));
    });
    const transformedRows = rows?.map((row) => {
        const { cells, key: rowKey, ...rowProps } = row;
        const transformedCells = cells.map((cell) => {
            const { content, key: cellKey, ...cellProps } = cell;
            const reconciledContent = 
            // @ts-ignore Not all constituents of type JSXElementConstructor are callable.
            (0, react_1.isValidElement)(content) && typeof content.type === 'function' ? content.type(content.props) : content;
            return ((0, jsx_runtime_1.jsx)(Cell, { cellKey: cellKey, ...cellProps, children: reconciledContent }, cellKey));
        });
        return ((0, jsx_runtime_1.jsx)(Row, { rowKey: rowKey, ...rowProps, children: transformedCells }, rowKey));
    });
    return ((0, jsx_runtime_1.jsxs)(DynamicTablePrimitive, { ...tableProps, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "head", children: transformedHead }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "rows", children: transformedRows })] }));
};
exports.DynamicTable = DynamicTable;


/***/ },

/***/ 8326
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CheckboxGroup = exports.Strong = exports.Strike = exports.Em = exports.AdfRenderer = exports.Comment = exports.Popup = exports.InlineEdit = exports.DynamicTable = void 0;
const tslib_1 = __webpack_require__(1635);
var dynamic_table_1 = __webpack_require__(510);
Object.defineProperty(exports, "DynamicTable", ({ enumerable: true, get: function () { return dynamic_table_1.DynamicTable; } }));
var inline_edit_1 = __webpack_require__(6254);
Object.defineProperty(exports, "InlineEdit", ({ enumerable: true, get: function () { return inline_edit_1.InlineEdit; } }));
var popup_1 = __webpack_require__(2260);
Object.defineProperty(exports, "Popup", ({ enumerable: true, get: function () { return popup_1.Popup; } }));
var comment_1 = __webpack_require__(6831);
Object.defineProperty(exports, "Comment", ({ enumerable: true, get: function () { return comment_1.Comment; } }));
var adf_renderer_1 = __webpack_require__(5451);
Object.defineProperty(exports, "AdfRenderer", ({ enumerable: true, get: function () { return adf_renderer_1.AdfRenderer; } }));
/**
 * @deprecated - UIKit 1 specific component
 */
exports.Em = 'Em';
/**
 * @deprecated - UIKit 1 specific component
 */
exports.Strike = 'Strike';
/**
 * @deprecated - UIKit 1 specific component
 */
exports.Strong = 'Strong';
/**
 * Export Code generated UI Kit 2 Components
 */
tslib_1.__exportStar(__webpack_require__(8564), exports);
/**
 * A Checkbox group is a list of options where one or more choices can be selected.
 *
 * @see [CheckboxGroup](https://developer.atlassian.com/platform/forge/ui-kit/components/checkbox-group/) in UI Kit documentation for more information
 */
exports.CheckboxGroup = 'CheckboxGroup';


/***/ },

/***/ 6254
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InlineEdit = void 0;
const jsx_runtime_1 = __webpack_require__(4848);
const react_1 = __webpack_require__(6540);
const content_wrapper_1 = __webpack_require__(9171);
/**
 * The following workaround is required because functions cannot be passed outside of the runtime.
 * The Renderer will invoke the function from within the runtime
 * Instead of passing the function, we are reimplementing validation and confirmation here to provide the same behaviour as the ADS version.
 *
 * The reimplemented functions include:
 * - validate
 * - onConfirm
 * - onCancel
 * - onEdit
 *
 * readView and editView also need to be evaluated here so that into a primitive type(JS object) to be rendered by the Renderer. Otherwise the Renderer will not be able to evaluate them on the product side.
 *
 */
const InlineEditPrimitive = 'InlineEdit';
/**
 * An inline edit displays a custom input component that switches between reading and editing on the same page.
 *
 * @see [InlineEdit](https://developer.atlassian.com/platform/forge/ui-kit/components/inline-edit/) in UI Kit documentation for more information
 */
const InlineEdit = ({ label, readView, editView, validate, startWithEditViewOpen, keepEditViewOpenOnBlur, hideActionButtons, isRequired, readViewFitContainerWidth, editButtonLabel, confirmButtonLabel, cancelButtonLabel, defaultValue, isEditing, onConfirm, onCancel, onEdit }) => {
    const [prevValue, setPrevValue] = (0, react_1.useState)();
    const [value, setValue] = (0, react_1.useState)(defaultValue);
    const [_isEditing, _setIsEditing] = (0, react_1.useState)(startWithEditViewOpen ? startWithEditViewOpen : false);
    const [errorMessage, setErrorMessage] = (0, react_1.useState)(undefined);
    const internalValidate = (newValue, setEdit, onConfirm) => {
        if (validate !== undefined) {
            const errorMessageFromValidation = validate(newValue, {}, {});
            const handleValidationResult = (error) => {
                setErrorMessage(error || undefined);
                // If no error and onConfirm is being called
                if (error === undefined && onConfirm) {
                    onConfirm(newValue);
                }
                if (setEdit) {
                    setEdit(error !== undefined);
                }
            };
            if (errorMessageFromValidation instanceof Promise) {
                void errorMessageFromValidation.then(handleValidationResult);
            }
            else {
                handleValidationResult(errorMessageFromValidation);
            }
        }
        else {
            if (setEdit) {
                setEdit(false);
            }
            if (onConfirm) {
                onConfirm(newValue);
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
        // Reset error state on first open
        setErrorMessage(undefined);
        _setIsEditing(true);
        setPrevValue(value);
        onEdit?.();
    };
    const internalOnCancel = () => {
        _setIsEditing(false);
        setValue(prevValue);
        onCancel?.();
    };
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: (0, jsx_runtime_1.jsxs)(InlineEditPrimitive, { label: label, onConfirm: () => internalOnConfirm(), onEdit: () => internalOnEdit(), onCancel: () => internalOnCancel(), isEditing: isEditing !== undefined ? isEditing : _isEditing, startWithEditViewOpen: startWithEditViewOpen, keepEditViewOpenOnBlur: keepEditViewOpenOnBlur, hideActionButtons: hideActionButtons, isRequired: isRequired, readViewFitContainerWidth: readViewFitContainerWidth, editButtonLabel: editButtonLabel, confirmButtonLabel: confirmButtonLabel, cancelButtonLabel: cancelButtonLabel, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "editView", children: editView({
                        onChange: internalOnChange,
                        value,
                        errorMessage,
                        isInvalid: errorMessage !== undefined,
                        'aria-invalid': errorMessage !== undefined ? 'true' : 'false',
                        isRequired: isRequired || false
                    }) }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "readView", children: readView() })] }) }));
};
exports.InlineEdit = InlineEdit;


/***/ },

/***/ 2260
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Popup = void 0;
const jsx_runtime_1 = __webpack_require__(4848);
const content_wrapper_1 = __webpack_require__(9171);
const PopupPrimitive = 'Popup';
/**
 * A popup displays brief content in an overlay.
 *
 * @see [Popup](https://developer.atlassian.com/platform/forge/ui-kit/components/popup/) in UI Kit documentation for more information
 */
const Popup = ({ content, trigger, isOpen, id, testId, onClose, boundary, rootBoundary, shouldFlip, placement, fallbackPlacements, autoFocus, shouldUseCaptureOnOutsideClick, shouldFitContainer, shouldDisableFocusLock, strategy, role, label, titleId, shouldRenderToParent }) => {
    return ((0, jsx_runtime_1.jsxs)(PopupPrimitive, { isOpen: isOpen, id: id, testId: testId, onClose: onClose, boundary: boundary, rootBoundary: rootBoundary, shouldFlip: shouldFlip, placement: placement, fallbackPlacements: fallbackPlacements, autoFocus: autoFocus, shouldUseCaptureOnOutsideClick: shouldUseCaptureOnOutsideClick, shouldFitContainer: shouldFitContainer, shouldDisableFocusLock: shouldDisableFocusLock, shouldRenderToParent: shouldRenderToParent, strategy: strategy, role: role, label: label, titleId: titleId, children: [(0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "content", children: content() }), (0, jsx_runtime_1.jsx)(content_wrapper_1.ContentWrapper, { name: "trigger", children: trigger() })] }));
};
exports.Popup = Popup;


/***/ },

/***/ 8564
(__unused_webpack_module, exports) {

"use strict";

// This file is partially generated by the `yarn run add-component-jsdoc` command (also the prebuild script in the package.json).
// The manual step involved is to:
//   1. import the new component type from the forge-react-types package, e.g. `TBadge`
//   2. add the export statement for the new component, e.g. `export const Badge = 'Badge' as unknown as TBadge<ForgeElement>;`
//   3. either run the `yarn run add-component-jsdoc` command or manually add the JSDoc comment for the new component
//      or the build process will automatically add the JSDoc comment during `bolt build`
// For more information, please see: https://hello.atlassian.net/wiki/x/SI2n0w?atlOrigin=eyJpIjoiYjJhOTliZmZmYWE1NDE5ZjgzOWU1Y2ViZWI3Yjk3NTMiLCJwIjoiYyJ9
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Stack = exports.Spinner = exports.SectionMessageAction = exports.SectionMessage = exports.Select = exports.Range = exports.RadioGroup = exports.Radio = exports.ProgressTracker = exports.ProgressBar = exports.PieChart = exports.ModalTransition = exports.ModalTitle = exports.ModalHeader = exports.ModalFooter = exports.ModalBody = exports.Modal = exports.Lozenge = exports.LoadingButton = exports.ListItem = exports.List = exports.LinkButton = exports.LineChart = exports.Label = exports.Inline = exports.Image = exports.Icon = exports.HorizontalStackBarChart = exports.HorizontalBarChart = exports.HelperMessage = exports.Heading = exports.FormSection = exports.FormHeader = exports.FormFooter = exports.Form = exports.FilePicker = exports.FileCard = exports.ErrorMessage = exports.EmptyState = exports.DonutChart = exports.DatePicker = exports.CodeBlock = exports.Code = exports.Checkbox = exports.Calendar = exports.ButtonGroup = exports.Button = exports.Box = exports.BarChart = exports.Badge = void 0;
exports.Pagination = exports.BreadcrumbsItem = exports.Breadcrumbs = exports.Bleed = exports.UserGroup = exports.Frame = exports.UserPicker = exports.Link = exports.AtlassianIcon = exports.AtlassianTile = exports.User = exports.Tile = exports.ChromelessEditor = exports.CommentEditor = exports.Pressable = exports.RequiredAsterisk = exports.ValidMessage = exports.Text = exports.Tooltip = exports.Toggle = exports.TimePicker = exports.Textfield = exports.TextArea = exports.TagGroup = exports.Tag = exports.Tabs = exports.TabPanel = exports.TabList = exports.Tab = exports.StackBarChart = void 0;
/**
 * A badge is a visual indicator for numeric values such as tallies and scores.
 *
 * @see [Badge](https://developer.atlassian.com/platform/forge/ui-kit/components/badge/) in UI Kit documentation for more information
 */
exports.Badge = 'Badge';
/**
 * A visual representation of data using rectangular bars of varying heights to compare different categories or values.
 *
 * @see [BarChart](https://developer.atlassian.com/platform/forge/ui-kit/components/bar-chart/) in UI Kit documentation for more information
 */
exports.BarChart = 'BarChart';
/**
 * A box is a generic container that provides managed access to design tokens.
 *
 * @see [Box](https://developer.atlassian.com/platform/forge/ui-kit/components/box/) in UI Kit documentation for more information
 */
exports.Box = 'Box';
/**
 * A button triggers an event or action. They let users know what will happen next.
 *
 * @see [Button](https://developer.atlassian.com/platform/forge/ui-kit/components/button/) in UI Kit documentation for more information
 */
exports.Button = 'Button';
/**
 * A button group gives users access to frequently performed, related actions.
 *
 * @see [ButtonGroup](https://developer.atlassian.com/platform/forge/ui-kit/components/button-group/) in UI Kit documentation for more information
 */
exports.ButtonGroup = 'ButtonGroup';
/**
 * An interactive calendar for date selection experiences.
 *
 * @see [Calendar](https://developer.atlassian.com/platform/forge/ui-kit/components/calendar/) in UI Kit documentation for more information
 */
exports.Calendar = 'Calendar';
/**
 * A checkbox is an input control that allows a user to select one or more options from a number of choices.
 *
 * @see [Checkbox](https://developer.atlassian.com/platform/forge/ui-kit/components/checkbox/) in UI Kit documentation for more information
 */
exports.Checkbox = 'Checkbox';
/**
 * Code highlights short strings of code snippets inline with body text.
 *
 * @see [Code](https://developer.atlassian.com/platform/forge/ui-kit/components/code/) in UI Kit documentation for more information
 */
exports.Code = 'Code';
/**
 * Code highlights short strings of code snippets inline with body text.
 *
 * @see [CodeBlock](https://developer.atlassian.com/platform/forge/ui-kit/components/code-block/) in UI Kit documentation for more information
 */
exports.CodeBlock = 'CodeBlock';
/**
 * A date picker allows the user to select a particular date.
 *
 * @see [DatePicker](https://developer.atlassian.com/platform/forge/ui-kit/components/date-picker/) in UI Kit documentation for more information
 */
exports.DatePicker = 'DatePicker';
/**
 * A visual representation of data proportions in a donut format.
 *
 * @see [DonutChart](https://developer.atlassian.com/platform/forge/ui-kit/components/donut-chart/) in UI Kit documentation for more information
 */
exports.DonutChart = 'DonutChart';
/**
 * An empty state appears when there is no data to display and describes what the user can do next.
 *
 * @see [EmptyState](https://developer.atlassian.com/platform/forge/ui-kit/components/empty-state/) in UI Kit documentation for more information
 */
exports.EmptyState = 'EmptyState';
/**
 * An error message is used to tell a user that the field input is invalid.
 * For example, an error message could be "Invalid username, needs to be more than 4 characters".
 *
 * @see [ErrorMessage](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#error-message) in UI Kit documentation for more information
 */
exports.ErrorMessage = 'ErrorMessage';
/**
 * A file card component that displays file information with actions
 *
 * @see [FileCard](https://developer.atlassian.com/platform/forge/ui-kit/components/file-card/) in UI Kit documentation for more information
 */
exports.FileCard = 'FileCard';
/**
 * A file picker component that allows users to select and upload files
 *
 * @see [FilePicker](https://developer.atlassian.com/platform/forge/ui-kit/components/file-picker/) in UI Kit documentation for more information
 */
exports.FilePicker = 'FilePicker';
/**
 * A form allows users to input information.
 *
 * @see [Form](https://developer.atlassian.com/platform/forge/ui-kit/components/form/) in UI Kit documentation for more information
 */
exports.Form = 'Form';
/**
 * Use a form footer to set the content at the end of the form. This is used for a button that submits the form.
 *
 * This is positioned after the last field in the form.
 *
 * @see [FormFooter](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#form-footer) in UI Kit documentation for more information
 */
exports.FormFooter = 'FormFooter';
/**
 * Use a form header to describe the contents of the form. This is the title and description of the form.
 * If your form contains required fields, the form header is also where you should include a legend
 * for sighted users to know that * indicates a required field.
 *
 * @see [FormHeader](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#form-header) in UI Kit documentation for more information
 */
exports.FormHeader = 'FormHeader';
/**
 * Use a form section to group related information together, so that longer forms are easier to understand.
 * There can be multiple form sections in one form.
 *
 * @see [FormSection](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#form-section) in UI Kit documentation for more information
 */
exports.FormSection = 'FormSection';
/**
 * A heading is a typography component used to display text in different sizes and formats.
 *
 * @see [Heading](https://developer.atlassian.com/platform/forge/ui-kit/components/heading/) in UI Kit documentation for more information
 */
exports.Heading = 'Heading';
/**
 * A helper message tells the user what kind of input the field takes.
 * For example, a helper message could be "Password should be more than 4 characters".
 *
 * @see [HelperMessage](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#helper-message) in UI Kit documentation for more information
 */
exports.HelperMessage = 'HelperMessage';
/**
 * A visual representation of data using horizontal rectangular bars of varying lengths to compare different categories or values.
 *
 * @see [HorizontalBarChart](https://developer.atlassian.com/platform/forge/ui-kit/components/horizontal-bar-chart/) in UI Kit documentation for more information
 */
exports.HorizontalBarChart = 'HorizontalBarChart';
/**
 * A visual representation of data using horizontal rectangular bars of varying lengths to demonstrate comparisons between categories of data.
 *
 * @see [HorizontalStackBarChart](https://developer.atlassian.com/platform/forge/ui-kit/components/horizontal-stack-bar-chart/) in UI Kit documentation for more information
 */
exports.HorizontalStackBarChart = 'HorizontalStackBarChart';
/**
 * An icon is a visual representation of a command, device, directory, or common action.
 *
 * @see [Icon](https://developer.atlassian.com/platform/forge/ui-kit/components/icon/) in UI Kit documentation for more information
 */
exports.Icon = 'Icon';
/**
 * An image component to display images.
 *
 * @see [Image](https://developer.atlassian.com/platform/forge/ui-kit/components/image/) in UI Kit documentation
 */
exports.Image = 'Image';
/**
 * An inline manages the horizontal layout of direct children using flexbox.
 *
 * @see [Inline](https://developer.atlassian.com/platform/forge/ui-kit/components/inline/) in UI Kit documentation for more information
 */
exports.Inline = 'Inline';
/**
 * A label represents a caption for an item in a user interface.
 *
 * @see [Label](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#label) in UI Kit documentation for more information
 */
exports.Label = 'Label';
/**
 * A visual representation of data showing trends.
 *
 * @see [LineChart](https://developer.atlassian.com/platform/forge/ui-kit/components/line-chart/) in UI Kit documentation for more information
 */
exports.LineChart = 'LineChart';
/**
 * Renders a link in the style of a button.
 *
 * @see [LinkButton](https://developer.atlassian.com/platform/forge/ui-kit/components/button/#linkbutton-props) in UI Kit documentation for more information
 */
exports.LinkButton = 'LinkButton';
/**
 * An unordered (bulleted) or ordered (numbered) list.
 *
 * @see [List](https://developer.atlassian.com/platform/forge/ui-kit/components/list/) in UI Kit documentation for more information
 */
exports.List = 'List';
exports.ListItem = 'ListItem';
/**
 * A button that shows an spinner as an overlay on the button when you set an isLoading prop to true.
 *
 * @see [LoadingButton](https://developer.atlassian.com/platform/forge/ui-kit/components/button/#loadingbutton-props) in UI Kit documentation for more information
 */
exports.LoadingButton = 'LoadingButton';
/**
 * A lozenge is a visual indicator used to highlight an item's status for quick recognition.
 *
 * @see [Lozenge](https://developer.atlassian.com/platform/forge/ui-kit/components/lozenge/) in UI Kit documentation for more information
 */
exports.Lozenge = 'Lozenge';
/**
 * A modal dialog displays content that requires user interaction, in a layer above the page.
 *
 * @see [Modal](https://developer.atlassian.com/platform/forge/ui-kit/components/modal/) in UI Kit documentation for more information
 */
exports.Modal = 'Modal';
/**
 * A modal body is used to display the main content of a modal.
 *
 * @see [ModalBody](https://developer.atlassian.com/platform/forge/ui-kit/components/modal/#body) in UI Kit documentation for more information
 */
exports.ModalBody = 'ModalBody';
/**
 * A modal footer often contains a primary action and the ability to cancel and close the dialog,
 * though can contain any React element.
 *
 * @see [ModalFooter](https://developer.atlassian.com/platform/forge/ui-kit/components/modal/#footer) in UI Kit documentation for more information
 */
exports.ModalFooter = 'ModalFooter';
/**
 * A modal header contains the title of the modal and can contain other React elements such as a close button.
 *
 * @see [ModalHeader](https://developer.atlassian.com/platform/forge/ui-kit/components/modal/#header) in UI Kit documentation for more information
 */
exports.ModalHeader = 'ModalHeader';
/**
 * A modal title is used to display a title within a modal.
 *
 * @see [ModalTitle](https://developer.atlassian.com/platform/forge/ui-kit/components/modal/#title) in UI Kit documentation for more information
 */
exports.ModalTitle = 'ModalTitle';
/**
 * A modal transition wraps a modal to provide a fluid transition upon opening and closing.
 *
 * @see [ModalTransition](https://developer.atlassian.com/platform/forge/ui-kit/components/modal/#modal-transition) in UI Kit documentation for more information
 */
exports.ModalTransition = 'ModalTransition';
/**
 * A visual representation of data proportions in a circular format.
 *
 * @see [PieChart](https://developer.atlassian.com/platform/forge/ui-kit/components/pie-chart/) in UI Kit documentation for more information
 */
exports.PieChart = 'PieChart';
/**
 * A progress bar communicates the status of a system process.
 *
 * @see [ProgressBar](https://developer.atlassian.com/platform/forge/ui-kit/components/progress-bar/) in UI Kit documentation for more information
 */
exports.ProgressBar = 'ProgressBar';
/**
 * A progress tracker displays the steps and progress through a journey.
 *
 * @see [ProgressTracker](https://developer.atlassian.com/platform/forge/ui-kit/components/progress-tracker/) in UI Kit documentation for more information
 */
exports.ProgressTracker = 'ProgressTracker';
/**
 * A radio input allows users to select only one option from a number of choices. Radio is generally displayed in a radio group.
 *
 * @see [Radio](https://developer.atlassian.com/platform/forge/ui-kit/components/radio/) in UI Kit documentation for more information
 */
exports.Radio = 'Radio';
/**
 * A radio input allows users to select only one option from a number of choices. Radio is generally displayed in a radio group.
 *
 * @see [RadioGroup](https://developer.atlassian.com/platform/forge/ui-kit/components/radio-group/) in UI Kit documentation for more information
 */
exports.RadioGroup = 'RadioGroup';
/**
 * A range lets users choose an approximate value on a slider.
 *
 * @see [Range](https://developer.atlassian.com/platform/forge/ui-kit/components/range/) in UI Kit documentation for more information
 */
exports.Range = 'Range';
/**
 * Select allows users to make a single selection or multiple selections from a list of options.
 *
 * @see [Select](https://developer.atlassian.com/platform/forge/ui-kit/components/select/) in UI Kit documentation for more information
 */
exports.Select = 'Select';
/**
 * A section message is used to alert users to a particular section of the screen.
 *
 * @see [SectionMessage](https://developer.atlassian.com/platform/forge/ui-kit/components/section-message/) in UI Kit documentation for more information
 */
exports.SectionMessage = 'SectionMessage';
/**
 * A section message is used to alert users to a particular section of the screen.
 *
 * @see [SectionMessageAction](https://developer.atlassian.com/platform/forge/ui-kit/components/section-message/#section-message-action) in UI Kit documentation for more information
 */
exports.SectionMessageAction = 'SectionMessageAction';
/**
 * A spinner is an animated spinning icon that lets users know content is being loaded.
 *
 * @see [Spinner](https://developer.atlassian.com/platform/forge/ui-kit/components/spinner/) in UI Kit documentation for more information
 */
exports.Spinner = 'Spinner';
/**
 * A stack manages the vertical layout of direct children using flexbox.
 *
 * @see [Stack](https://developer.atlassian.com/platform/forge/ui-kit/components/stack/) in UI Kit documentation for more information
 */
exports.Stack = 'Stack';
/**
 * A visual representation of data using rectangular bars of varying heights to demonstrate comparisons between categories of data.
 *
 * @see [StackBarChart](https://developer.atlassian.com/platform/forge/ui-kit/components/stack-bar-chart/) in UI Kit documentation for more information
 */
exports.StackBarChart = 'StackBarChart';
/**
 * `Tab` represents an individual tab displayed in a TabList.
 *
 * @see [Tab](https://developer.atlassian.com/platform/forge/ui-kit/components/tabs/) in UI Kit documentation for more information
 */
exports.Tab = 'Tab';
/**
 * A `TabList` groups `Tab` components together.
 *
 * @see [TabList](https://developer.atlassian.com/platform/forge/ui-kit/components/tab-list/) in UI Kit documentation for more information
 */
exports.TabList = 'TabList';
/**
 * A `TabPanel` houses the contents of a `Tab`.
 *
 * @see [TabPanel](https://developer.atlassian.com/platform/forge/ui-kit/components/tabs/) in UI Kit documentation for more information
 */
exports.TabPanel = 'TabPanel';
/**
 * Tabs are used to organize content by grouping similar information on the same page.
 *
 * @see [Tabs](https://developer.atlassian.com/platform/forge/ui-kit/components/tabs/) in UI Kit documentation for more information
 */
exports.Tabs = 'Tabs';
exports.Tag = 'Tag';
/**
 * A tag group controls the layout and alignment for a collection of tags.
 *
 * @see [TagGroup](https://developer.atlassian.com/platform/forge/ui-kit/components/tag-group/) in UI Kit documentation for more information
 */
exports.TagGroup = 'TagGroup';
/**
 * A text area lets users enter long form text which spans over multiple lines.
 *
 * @see [TextArea](https://developer.atlassian.com/platform/forge/ui-kit/components/text-area/) in UI Kit documentation for more information
 */
exports.TextArea = 'TextArea';
/**
 * A text field is an input that allows a user to write or edit text.
 *
 * @see [Textfield](https://developer.atlassian.com/platform/forge/ui-kit/components/textfield/) in UI Kit documentation for more information
 */
exports.Textfield = 'Textfield';
/**
 * A time picker allows the user to select a specific time.
 *
 * @see [TimePicker](https://developer.atlassian.com/platform/forge/ui-kit/components/time-picker/) in UI Kit documentation for more information
 */
exports.TimePicker = 'TimePicker';
/**
 * A toggle is used to view or switch between enabled or disabled states.
 *
 * @see [Toggle](https://developer.atlassian.com/platform/forge/ui-kit/components/toggle/) in UI Kit documentation for more information
 */
exports.Toggle = 'Toggle';
/**
 * A `Tooltip` is a floating, non-actionable label used to explain a user interface element or feature.
 *
 * @see [Tooltip](https://developer.atlassian.com/platform/forge/ui-kit/components/tooltip/) in UI Kit documentation for more information
 */
exports.Tooltip = 'Tooltip';
/**
 * A typography component used to display body text.
 * It can also include inline components such as
 * [Badge](https://developer.atlassian.com/platform/forge/ui-kit/components/badge/) and
 * [Lozenge](https://developer.atlassian.com/platform/forge/ui-kit/components/lozenge/).
 */
exports.Text = 'Text';
/**
 * A valid message is used to tell a user that the field input is valid.
 * For example, a helper message could be "Nice one, this username is available".
 *
 * @see [ValidMessage](https://developer.atlassian.com/platform/forge/ui-kit/components/form/#validation-message) in UI Kit documentation for more information
 */
exports.ValidMessage = 'ValidMessage';
// Additional components without props
exports.RequiredAsterisk = 'RequiredAsterisk';
/**
 * A pressable is a primitive for building custom buttons.
 *
 * @see [Pressable](https://developer.atlassian.com/platform/forge/ui-kit/components/pressable/) in UI Kit documentation for more information
 */
exports.Pressable = 'Pressable';
/**
 * The comment editor provides a contained editor UI with a simple toolbar.
 *
 * @see [CommentEditor](https://developer.atlassian.com/platform/forge/ui-kit/components/comment-editor/) in UI Kit documentation for more information
 */
exports.CommentEditor = 'CommentEditor';
/**
 * The chromeless editor provides the Editor without any of the standard UI features. It's ideal for cases where the integrator wants complete control and responsibility over the editor UI.
 *
 * @see [ChromelessEditor](https://developer.atlassian.com/platform/forge/ui-kit/components/chromeless-editor/) in UI Kit documentation for more information
 */
exports.ChromelessEditor = 'ChromelessEditor';
/**
 * A tile is a rounded square that takes an asset and represents a noun.
 *
 * @see [Tile](https://developer.atlassian.com/platform/forge/ui-kit/components/tile/) in UI Kit documentation for more information
 */
exports.Tile = 'Tile';
/**
 * A component that represents a user, displaying details such as name and profile picture.
 *
 * @see [User](https://developer.atlassian.com/platform/forge/ui-kit/components/user/) in UI Kit documentation
 */
exports.User = 'User';
/**
 * An AtlassianTile is an icon that represents an Atlassian-specific content type, displayed in a tile.
 * The glyph prop automatically sets the color for the object.
 *
 * @see [AtlassianTile](https://developer.atlassian.com/platform/forge/ui-kit/components/atlassian-tile/) in UI Kit documentation for more information
 */
exports.AtlassianTile = 'AtlassianTile';
/**
 * An AtlassianIcon is an icon that represents an Atlassian-specific content type.
 * The glyph prop automatically sets the color for the object.
 *
 * @see [AtlassianIcon](https://developer.atlassian.com/platform/forge/ui-kit/components/atlassian-icon/) in UI Kit documentation for more information
 */
exports.AtlassianIcon = 'AtlassianIcon';
/**
 * A component that displays a hyperlink. Use this component for inline links,
 * typically inside a `Text` component.
 *
 * @see [Link](https://developer.atlassian.com/platform/forge/ui-kit/components/link/) in UI Kit documentation
 */
exports.Link = 'Link';
/**
 * A dropdown field that allows users to search and select users from a list.
 *
 * @see [UserPicker](https://developer.atlassian.com/platform/forge/ui-kit/components/user-picker/) in UI Kit documentation
 */
exports.UserPicker = 'UserPicker';
/**
 * A container for rendering static frontend applications (HTML, CSS, JavaScript)
 * within a UI Kit app. Supports bidirectional communication with the host app
 * via the Events API.
 *
 * @see [Frame](https://developer.atlassian.com/platform/forge/ui-kit/components/frame/) in UI Kit documentation
 */
exports.Frame = 'Frame';
/**
 * Displays a stack of multiple users (name and profile picture), subject to
 * their privacy settings. Can also be used inside a `Text` component, where
 * users appear as inline lozenges.
 *
 * @see [UserGroup](https://developer.atlassian.com/platform/forge/ui-kit/components/user-group/) in UI Kit documentation
 */
exports.UserGroup = 'UserGroup';
/**
 * Bleed allows child elements to visually extend beyond the bounds of their parent container.
 *
 * @see [Bleed](https://developer.atlassian.com/platform/forge/ui-kit/components/bleed/) in UI Kit documentation for more information
 */
exports.Bleed = 'Bleed';
/**
 * Breadcrumbs are a navigation system used to show a user's location in a site or app.
 *
 * @see [Breadcrumbs](https://developer.atlassian.com/platform/forge/ui-kit/components/breadcrumbs/) in UI Kit documentation for more information
 */
exports.Breadcrumbs = 'Breadcrumbs';
/**
 * A breadcrumb item represents a single step in the navigation hierarchy.
 *
 * @see [BreadcrumbsItem](https://developer.atlassian.com/platform/forge/ui-kit/components/breadcrumbs-item/) in UI Kit documentation for more information
 */
exports.BreadcrumbsItem = 'BreadcrumbsItem';
/**
 * Pagination allows you to divide large amounts of content into chunks across multiple pages.
 *
 * @see [Pagination](https://developer.atlassian.com/platform/forge/ui-kit/components/pagination/) in UI Kit documentation for more information
 */
exports.Pagination = 'Pagination';


/***/ },

/***/ 9171
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.ContentWrapper = void 0;
// ContentWrapper is an internal component that allows us to workaround the limitation of the Forge architecture
// Functions in Forge apps are invoked from within the runtime and it's definition cannot be passed across the bridge.
// For ADS components that accept a call back function that returns a ReactNode as a prop, these must be evaluated within the runtime to return a ForgeDoc before being passed to the Renderer. Otherwise the Renderer would not be able to render the component at all.
// The ContentWrapper component should be used to wrap around any callback function that returns a ReactNode so that it will evaluate the callback within the runtime and pass back the evaluated ForgeDoc
exports.ContentWrapper = 'ContentWrapper';


/***/ },

/***/ 7587
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.replaceUnsupportedMediaNodes = exports.replaceUnsupportedDocumentNodes = void 0;
const uuid_1 = __webpack_require__(182);
const traverse_1 = __webpack_require__(1484);
const replaceUnsupportedDocumentNodes = (document, replaceUnsupportedNode) => {
    const visitors = {
        // Partially supported nodes
        emoji: (node, parent, index, depth) => {
            if (node?.attrs?.id) {
                // Custom Atlassian generated emoji
                if (node.attrs.id.includes('atlassian')) {
                    return replaceUnsupportedNode(node, parent, index, depth);
                }
                // Custom user generated emoji
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
    return replaceDocumentWithVisitor(document, visitors);
};
exports.replaceUnsupportedDocumentNodes = replaceUnsupportedDocumentNodes;
const replaceUnsupportedMediaNodes = (document, replaceUnsupportedNode) => {
    const mediaVisitor = (node, parent, index, depth) => {
        if (!node?.attrs?.url) {
            return replaceUnsupportedNode(node, parent, index, depth);
        }
    };
    const visitors = {
        media: mediaVisitor,
        mediaInline: mediaVisitor
    };
    return replaceDocumentWithVisitor(document, visitors);
};
exports.replaceUnsupportedMediaNodes = replaceUnsupportedMediaNodes;
const replaceDocumentWithVisitor = (document, visitors) => {
    const updatedDoc = (0, traverse_1.traverse)(document, visitors);
    return updatedDoc ? { ...updatedDoc, version: document.version } : document;
};


/***/ },

/***/ 5721
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.confluenceEntity = exports.v = void 0;
const bridge_1 = __webpack_require__(2321);
const apiRequestUtils_1 = __webpack_require__(6210);
const valueUtils_1 = __webpack_require__(5808);
const types_1 = __webpack_require__(8632);
/**
 * given an entityType and a product context, returns functions that uses property data to
 * output URLs to use for property management via Confluence v2 REST API
 */
const confAPIEndpoints = ({ entityType, context }) => {
    let entityId, urlEntity;
    switch (entityType) {
        case 'Space':
            entityId = context.extension.space?.id;
            urlEntity = 'spaces';
            break;
        case 'Content':
            entityId = context.extension.content?.id;
            urlEntity = 'pages';
            break;
        default:
            throw new Error('Invalid entity type.');
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
exports.v = confAPIEndpoints;
const confluenceEntity = ({ entityType, origPropertyKey, initValue }) => {
    const apiMethod = bridge_1.requestConfluence;
    const withConfluenceContext = (originalOperation) => {
        return (0, apiRequestUtils_1.withContext)({
            originalOperation,
            apiEndpoints: exports.v,
            entityType,
            origPropertyKey
        });
    };
    // fetches existing prop value from server. to be reused for GET, UPDATE, DELETE operations
    const fetchOriginal = async ({ endpointFactory, propertyKey }) => {
        const url = endpointFactory.fetch(propertyKey);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'GET' });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'fetch', response });
        const existingData = await (0, apiRequestUtils_1.getJSONData)(response);
        return existingData.results[0];
    };
    // named `deleteProp` since `delete` is reserved word
    const deleteProp = async ({ endpointFactory, propertyKey }) => {
        // fetch original prop first to get its id
        const originalProp = await fetchOriginal({ endpointFactory, propertyKey });
        if (!originalProp) {
            throw new types_1.EntityPropertyRequestFailedError({
                entityType,
                propertyKey,
                operation: 'delete',
                status: 404
            });
        }
        const propertyId = originalProp.id;
        const url = endpointFactory.delete(propertyId);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'DELETE' });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'delete', response });
    };
    const getProp = async ({ endpointFactory, propertyKey }) => {
        const existingProp = await fetchOriginal({ endpointFactory, propertyKey });
        if (existingProp) {
            return existingProp;
        }
        // if property doesn't exist, create it
        const resolvedInitVal = await (0, valueUtils_1.resolveValue)(initValue);
        const url = endpointFactory.create();
        const body = JSON.stringify({ key: propertyKey, value: resolvedInitVal });
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'POST', body });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'create', response });
        return await (0, apiRequestUtils_1.getJSONData)(response);
    };
    const get = async ({ endpointFactory, propertyKey }) => {
        const propData = await getProp({ endpointFactory, propertyKey });
        return propData.value;
    };
    const update = async ({ endpointFactory, propertyKey }, valueUpdate) => {
        // fetch original prop first to update based on its value + version + id
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
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'PUT', body });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'update', response });
        return (await (0, apiRequestUtils_1.getJSONData)(response)).value;
    };
    return {
        get: withConfluenceContext(get),
        update: withConfluenceContext(update),
        delete: withConfluenceContext(deleteProp)
    };
};
exports.confluenceEntity = confluenceEntity;


/***/ },

/***/ 3519
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.jiraIssuePropsManager = exports.G = void 0;
const bridge_1 = __webpack_require__(2321);
const apiRequestUtils_1 = __webpack_require__(6210);
const valueUtils_1 = __webpack_require__(5808);
const types_1 = __webpack_require__(8632);
/**
 * given a context, returns functions that uses property data to
 * output URLs to use for issue property management via Jira v2 REST API
 */
const issueAPIEndpoints = (context) => {
    const issueId = context.extension.issue?.id;
    if (!issueId)
        throw new Error('Issue properties not available for this app.');
    return {
        create: () => `/rest/api/2/issue/properties`,
        fetch: (propertyKey) => `/rest/api/2/issue/${issueId}/properties/${propertyKey}`,
        update: (propertyKey) => `/rest/api/2/issue/${issueId}/properties/${propertyKey}`,
        delete: (propertyKey) => `/rest/api/2/issue/${issueId}/properties/${propertyKey}`
    };
};
exports.G = issueAPIEndpoints;
const jiraIssuePropsManager = ({ origPropertyKey, initValue }) => {
    const entityType = 'Issue';
    const apiMethod = bridge_1.requestJira;
    const withIssueContext = (originalOperation) => {
        return (0, apiRequestUtils_1.withContext)({
            originalOperation,
            apiEndpoints: exports.G,
            entityType: 'Issue',
            origPropertyKey
        });
    };
    // fetches existing prop value from server. to be reused for GET, UPDATE, DELETE operations
    const fetchOriginal = async ({ endpointFactory, propertyKey }) => {
        const url = endpointFactory.fetch(propertyKey);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'GET' });
        try {
            (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'fetch', response });
        }
        catch (err) {
            if (response.status === 404) {
                return null;
            }
            else {
                throw err;
            }
        }
        const existingData = await (0, apiRequestUtils_1.getJSONData)(response);
        return existingData;
    };
    // named `deleteProp` since `delete` is reserved word
    const deleteProp = async ({ endpointFactory, propertyKey }) => {
        const url = endpointFactory.delete(propertyKey);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'DELETE' });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'delete', response });
    };
    const get = async ({ endpointFactory, propertyKey, context }) => {
        const existingProp = await fetchOriginal({ endpointFactory, propertyKey, context });
        if (existingProp) {
            return existingProp.value;
        }
        // if property doesn't exist, create it
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
            method: 'POST',
            body: JSON.stringify(bodyData)
        });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'create', response });
        return resolvedInitVal;
    };
    const update = async ({ endpointFactory, propertyKey, context }, valueUpdate) => {
        const newValueOrRunUpdaterOnOriginal = async (valueUpdate) => {
            // concrete value update, does not require fetching original value
            if (!(valueUpdate instanceof Function)) {
                return valueUpdate;
            }
            // value update via function, fetch original prop first to update based on its value
            const originalProp = await fetchOriginal({ endpointFactory, propertyKey, context });
            if (!originalProp) {
                throw new types_1.EntityPropertyRequestFailedError({
                    entityType,
                    propertyKey,
                    operation: 'update',
                    status: 404
                });
            }
            return valueUpdate(originalProp.value);
        };
        const newValue = await newValueOrRunUpdaterOnOriginal(valueUpdate);
        const url = endpointFactory.update(propertyKey);
        const body = JSON.stringify(newValue);
        const response = await (0, apiRequestUtils_1.makeRequest)({ url, apiMethod, method: 'PUT', body });
        (0, apiRequestUtils_1.assertSuccessfulResponse)({ entityType, propertyKey, operation: 'update', response });
        return newValue;
    };
    return {
        get: withIssueContext(get),
        update: withIssueContext(update),
        delete: withIssueContext(deleteProp)
    };
};
exports.jiraIssuePropsManager = jiraIssuePropsManager;


/***/ },

/***/ 9521
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ },

/***/ 6727
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EntityPropertyRequestFailedError = void 0;
class EntityPropertyRequestFailedError extends Error {
    constructor({ entityType, propertyKey, operation, status }) {
        super(`The request to ${operation} the ${entityType.toLowerCase()} property (${propertyKey}) failed with status (${status}).`);
    }
}
exports.EntityPropertyRequestFailedError = EntityPropertyRequestFailedError;


/***/ },

/***/ 8632
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1635);
tslib_1.__exportStar(__webpack_require__(6727), exports);
tslib_1.__exportStar(__webpack_require__(9521), exports);
tslib_1.__exportStar(__webpack_require__(8027), exports);


/***/ },

/***/ 8027
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));


/***/ },

/***/ 5067
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useConfig = void 0;
const react_1 = __webpack_require__(6540);
const bridge_1 = __webpack_require__(2321);
const updateConfig = (setConfig) => {
    bridge_1.view
        .getContext()
        .then((context) => {
        setConfig(context?.extension.config);
    })
        .catch((err) => {
        throw err;
    });
};
const useConfig = () => {
    const [config, setConfig] = (0, react_1.useState)(undefined);
    (0, react_1.useEffect)(() => {
        updateConfig(setConfig);
    }, []);
    (0, react_1.useEffect)(() => {
        const sub = bridge_1.events.on('FORGE_CORE_MACRO_CONFIG_CHANGED', () => {
            updateConfig(setConfig);
        });
        return () => {
            void sub.then((subscription) => subscription.unsubscribe());
        };
    }, []);
    return config;
};
exports.useConfig = useConfig;


/***/ },

/***/ 8045
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useContentProperty = void 0;
const react_1 = __webpack_require__(6540);
const bridge_1 = __webpack_require__(2321);
const confluenceEntity_1 = __webpack_require__(5721);
const useEntityProperty_1 = __webpack_require__(8435);
/**
 * This function manages the content properties of a Confluence page where the app is installed.
 * @param propertyKey Name (key) of the property
 * @param initValue Default value if it did not exist previously
 * @returns An array with 3 items:
 *  1. Current value of the property.
 *  2. A function to update the property value (with another value or an updater function). If an initial update fails, it automatically tries to update for another <retryCount> times (default 2).
 *  3. A function to delete the property.
 */
const useContentProperty = (propertyKey, initValue) => {
    const entityManager = (0, react_1.useMemo)(() => (0, confluenceEntity_1.confluenceEntity)({
        entityType: 'Content',
        origPropertyKey: propertyKey,
        initValue
    }), [propertyKey, initValue]);
    const [propValue, updateProp, deleteProp] = (0, useEntityProperty_1.useEntityProperty)({ entityManager });
    const updatePropWithEvent = (0, react_1.useCallback)(async (valueUpdate, retryCount) => {
        const success = await updateProp(valueUpdate, retryCount);
        if (success) {
            void bridge_1.events.emit('FORGE_CONTENT_PROPERTY_UPDATED', { propertyKey, valueUpdate });
        }
    }, [updateProp, propertyKey]);
    return [propValue, updatePropWithEvent, deleteProp];
};
exports.useContentProperty = useContentProperty;


/***/ },

/***/ 8435
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.useEntityProperty = void 0;
/**
 * React-based property management hook for Confluence API and entities
 */
const react_1 = __webpack_require__(6540);
// outputs a stateful variable and a function to update it
const useEntityProperty = ({ entityManager, defaultRetryCount = 2 }) => {
    const [propValue, setPropValue] = (0, react_1.useState)();
    (0, react_1.useEffect)(() => {
        const getProp = async () => {
            const currentVal = await entityManager.get();
            setPropValue(currentVal);
        };
        getProp().catch(() => {
            // repeat fetch in case previous creation failed due to variable already concurrently created
            getProp().catch((secondErr) => {
                throw secondErr;
            });
        });
    }, []);
    const updateProp = (0, react_1.useCallback)(async (valueUpdate, retryCount = defaultRetryCount) => {
        let success = false;
        let tryCounts = 0;
        const attempt = async () => setPropValue(await entityManager.update(valueUpdate));
        // initial update attempt + up to <retryCount> retries if update unsuccessful
        while (!success && tryCounts <= retryCount) {
            try {
                tryCounts++;
                await attempt();
                success = true;
            }
            catch (err) {
                if (tryCounts > retryCount) {
                    console.error(err); // eslint-disable-line no-console
                }
            }
        }
        return success;
    }, [entityManager]);
    const deleteProp = (0, react_1.useCallback)(async () => {
        await entityManager.delete();
        setPropValue(undefined);
    }, [entityManager]);
    return [propValue, updateProp, deleteProp];
};
exports.useEntityProperty = useEntityProperty;


/***/ },

/***/ 9019
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useForm = useForm;
const tslib_1 = __webpack_require__(1635);
const react_1 = __webpack_require__(6540);
const react_hook_form_1 = __webpack_require__(330);
const get_1 = tslib_1.__importDefault(__webpack_require__(8156));
function useForm(props = {}) {
    // Generate an id to prevent clashes with other forms on the page
    const id = (0, react_1.useId)();
    const getFieldId = (fieldName) => {
        return `form-${id}-${fieldName}`;
    };
    const { register, formState, 
    // watch, disabling for the time being as can be expensive for performance
    handleSubmit, setValue, getValues, trigger, clearErrors
    // Only allow for defaultValues in props for the timebeing
     } = (0, react_hook_form_1.useForm)({
        defaultValues: props.defaultValues,
        mode: 'onBlur', // defaulting to validating onBlur to follow ADS behaviour
        reValidateMode: 'onChange'
    });
    const defaultValues = props?.defaultValues;
    const forgeFormRegister = (fieldName, options) => {
        /**
         * Removed:
         * - ref cannot be serialised and passed through the run time
         * - removed required to stop the default browser validation pop up
         * - UI Kit 2 components take `isDisabled` instead of `disabled`
         * - `onChange` is modified to handle our controlled components as refs cannot be used
         */
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            // only checkbox and toggle have boolean vals.
            // Typically this is handled by the ref obj but we need to manage the default values ourselves here
            if (typeof (0, get_1.default)(defaultValues, fieldName) === 'boolean') {
                additionalProps.defaultChecked = (0, get_1.default)(defaultValues, fieldName);
            }
            else {
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
                // onChange is modified here to handle our controlled components as refs cannot be used
                // handles Checkbox and Toggle
                if (event?.target?.type === 'checkbox') {
                    return Promise.resolve(setValue(fieldName, event.target.checked, getOnChangeOptions()));
                }
                if (['number', 'text', 'textarea', 'radio', 'password'].includes(event?.target?.type)) {
                    return Promise.resolve(setValue(fieldName, event.target.value, getOnChangeOptions()));
                }
                else {
                    // handles onChange arguments where the value is passed instead of an event object
                    return Promise.resolve(setValue(fieldName, event, getOnChangeOptions()));
                }
            },
            // The onBlur event from `register` is unintentionally setting the value to `undefined` when the field is blurred.
            // Replacing the onBlur event here to prevent this behaviour.
            onBlur: () => {
                return Promise.resolve(trigger(fieldName));
            },
            isInvalid: isError,
            'aria-invalid': isError,
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


/***/ },

/***/ 1595
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useIssueProperty = void 0;
const react_1 = __webpack_require__(6540);
const jiraEntity_1 = __webpack_require__(3519);
const useEntityProperty_1 = __webpack_require__(8435);
/**
 * This function manages the properties of a Jira issue where the app is installed
 * @param propertyKey Name (key) of the property
 * @param initValue Default value if it did not exist previously
 * @returns An array with 3 items:
 *  1. Current value of the property.
 *  2. A function to update the property value (with another value or an updater function). If a <retryCount> is given and an initial update fails, it automatically tries to update for another <retryCount> times (default 0).
 *  3. A function to delete the property.
 */
const useIssueProperty = (propertyKey, initValue) => {
    const entityManager = (0, react_1.useMemo)(() => (0, jiraEntity_1.jiraIssuePropsManager)({
        entityType: 'Issue',
        origPropertyKey: propertyKey,
        initValue
    }), []);
    return (0, useEntityProperty_1.useEntityProperty)({ entityManager, defaultRetryCount: 0 }); // no update retries needed for issue properties
};
exports.useIssueProperty = useIssueProperty;


/***/ },

/***/ 5365
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useObjectStore = useObjectStore;
const react_1 = __webpack_require__(6540);
const bridge_1 = __webpack_require__(2321);
// Helper function to update an object by key
const updateObjectByKey = (objects, key, updates) => objects.map((obj) => (obj.key === key ? { ...obj, ...updates } : obj));
function objectStoreReducer(state, action) {
    switch (action.type) {
        case 'ADD_OBJECTS':
            return { objects: [...state.objects, ...action.payload] };
        case 'UPDATE_OBJECT':
            return { objects: updateObjectByKey(state.objects, action.payload.key, action.payload.updates) };
        case 'UPLOAD_OBJECT_START':
            // Add temp object with isUploading state
            return {
                objects: [...state.objects, { key: action.payload.tempKey, isUploading: true }]
            };
        case 'UPLOAD_OBJECT_SUCCESS':
            // Replace temp object with real object
            return {
                objects: state.objects.map((obj) => (obj.key === action.payload.tempKey ? action.payload.object : obj))
            };
        case 'UPLOAD_OBJECT_ERROR':
            // Replace temp object with error state
            return {
                objects: state.objects.map((obj) => obj.key === action.payload.tempKey
                    ? { ...obj, isUploading: false, error: action.payload.error, success: false }
                    : obj)
            };
        case 'DELETE_START':
            return {
                objects: state.objects.map((obj) => action.payload.includes(obj.key) ? { ...obj, isDeleting: true, error: undefined } : obj)
            };
        case 'DELETE_SUCCESS':
            return { objects: state.objects.filter((obj) => !action.payload.includes(obj.key)) };
        case 'DELETE_ERROR':
            return {
                objects: state.objects.map((obj) => action.payload.keys.includes(obj.key) ? { ...obj, isDeleting: false, error: action.payload.error } : obj)
            };
        case 'DOWNLOAD_START':
            return {
                objects: state.objects.map((obj) => action.payload.includes(obj.key) ? { ...obj, isDownloading: true, error: undefined } : obj)
            };
        case 'DOWNLOAD_COMPLETE':
            return {
                objects: state.objects.map((obj) => {
                    if (action.payload.successfulKeys.includes(obj.key)) {
                        return { ...obj, isDownloading: false };
                    }
                    if (action.payload.failedKeys.includes(obj.key)) {
                        return { ...obj, isDownloading: false, error: 'Download failed' };
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
    /**
     * Get a specific object from objectState by key
     */
    const getObjectMetadata = (key) => {
        const object = state.objects.find((obj) => obj.key === key);
        if (!object) {
            // eslint-disable-next-line no-console
            console.warn(`No metadata found for object with key: ${key}`);
            return null;
        }
        return object;
    };
    /**
     * Upload objects and update objectState with results
     */
    const uploadObjects = (0, react_1.useCallback)(async (params) => {
        const timestamp = Date.now();
        try {
            const uploadPromises = await (0, bridge_1.createUploadPromises)(params);
            const trackedUploadPromises = uploadPromises.map(async ({ promise, index, objectType, objectSize }) => {
                const tempKey = `temp-upload-${timestamp}-${index}`;
                dispatch({ type: 'UPLOAD_OBJECT_START', payload: { tempKey } });
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
                    dispatch({ type: 'UPLOAD_OBJECT_SUCCESS', payload: { tempKey, object: objectState } });
                    return result;
                }
                catch (error) {
                    dispatch({
                        type: 'UPLOAD_OBJECT_ERROR',
                        payload: { tempKey, error: error instanceof Error ? error.message : 'Upload failed' }
                    });
                    throw error;
                }
            });
            await Promise.all(trackedUploadPromises);
        }
        catch (error) {
            throw error;
        }
    }, []);
    /**
     * Delete objects by keys from state and backend
     */
    const deleteObjects = (0, react_1.useCallback)(async (params) => {
        dispatch({ type: 'DELETE_START', payload: params.keys });
        try {
            await bridge_1.objectStore.delete(params);
            dispatch({ type: 'DELETE_SUCCESS', payload: params.keys });
        }
        catch (error) {
            dispatch({
                type: 'DELETE_ERROR',
                payload: { keys: params.keys, error: error instanceof Error ? error.message : 'Delete failed' }
            });
            throw error;
        }
    }, []);
    /**
     * Download objects by keys
     */
    const downloadObjects = (0, react_1.useCallback)(async (params) => {
        dispatch({ type: 'DOWNLOAD_START', payload: params.keys });
        try {
            const results = await bridge_1.objectStore.download(params);
            const successfulKeys = results.filter((r) => r.success).map((r) => r.key);
            const failedKeys = results.filter((r) => !r.success).map((r) => r.key);
            dispatch({
                type: 'DOWNLOAD_COMPLETE',
                payload: { successfulKeys, failedKeys }
            });
            return results;
        }
        catch (error) {
            dispatch({
                type: 'DOWNLOAD_COMPLETE',
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


/***/ },

/***/ 1845
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.usePermissions = void 0;
const react_1 = __webpack_require__(6540);
const bridge_1 = __webpack_require__(2321);
/**
 * Hook for checking permissions in Forge apps
 *
 * @param requiredPermissions - The permissions required for the component
 * @returns Object containing permission state, loading status, and error information
 * @returns hasPermission - Whether all required permissions are granted
 * @returns isLoading - Whether the permission check is still in progress
 * @returns missingPermissions - Details about which permissions are missing (null if all granted)
 * @returns error - Any error that occurred during permission checking (null if no error)
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const { hasPermission, isLoading, missingPermissions, error } = usePermissions({
 *     scopes: ['write:confluence-content'],
 *     external: {
 *       fetch: {
 *         backend: ['https://api.example.com']
 *       }
 *     }
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   if (error) {
 *     return <ErrorMessage error={error} />;
 *   }
 *
 *   if (!hasPermission) {
 *     return <PermissionDenied missingPermissions={missingPermissions} />;
 *   }
 *
 *   return <ProtectedFeature />;
 * };
 * ```
 */
const usePermissions = (requiredPermissions) => {
    const [context, setContext] = (0, react_1.useState)();
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [permissionResult, setPermissionResult] = (0, react_1.useState)({
        granted: false,
        missing: null
    });
    // Load context on mount
    (0, react_1.useEffect)(() => {
        const loadContext = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const contextData = await bridge_1.view.getContext();
                setContext(contextData);
            }
            catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to load context'));
            }
            finally {
                setIsLoading(false);
            }
        };
        void loadContext();
    }, []);
    // Check permissions using shared utility
    (0, react_1.useEffect)(() => {
        // Skip if still loading context
        if (isLoading) {
            return;
        }
        const checkPerms = async () => {
            if (!requiredPermissions) {
                setPermissionResult({ granted: false, missing: null });
                return;
            }
            if (!context?.permissions) {
                // If context loaded but has no permissions, set error
                if (context !== undefined) {
                    setError(new Error('This feature is not available yet'));
                    setPermissionResult({ granted: false, missing: null });
                }
                return;
            }
            try {
                setError(null); // Clear any previous errors
                const result = await (0, bridge_1.checkPermissions)(requiredPermissions, context.permissions);
                setPermissionResult(result);
            }
            catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to check permissions'));
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


/***/ },

/***/ 9415
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useProductContext = void 0;
const bridge_1 = __webpack_require__(2321);
const react_1 = __webpack_require__(6540);
const useProductContext = () => {
    const [productContext, setProductContext] = (0, react_1.useState)();
    (0, react_1.useEffect)(() => {
        bridge_1.view
            .getContext()
            .then(setProductContext)
            .catch((err) => {
            throw err;
        });
    }, []);
    return productContext;
};
exports.useProductContext = useProductContext;


/***/ },

/***/ 4174
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useSpaceProperty = void 0;
const react_1 = __webpack_require__(6540);
const confluenceEntity_1 = __webpack_require__(5721);
const useEntityProperty_1 = __webpack_require__(8435);
/**
 * This function manages the space properties of a Confluence space where the app is installed.
 * @param propertyKey Name (key) of the property
 * @param initValue Default value if it did not exist previously
 * @returns An array with 3 items:
 *  1. Current value of the property.
 *  2. A function to update the property value (with another value or an updater function). If an initial update fails, it automatically tries to update for another <retryCount> times (default 2).
 * 3. A function to delete the property.
 */
const useSpaceProperty = (propertyKey, initValue) => {
    const entityManager = (0, react_1.useMemo)(() => (0, confluenceEntity_1.confluenceEntity)({
        entityType: 'Space',
        origPropertyKey: propertyKey,
        initValue
    }), []);
    return (0, useEntityProperty_1.useEntityProperty)({ entityManager });
};
exports.useSpaceProperty = useSpaceProperty;


/***/ },

/***/ 4024
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useTheme = void 0;
const tslib_1 = __webpack_require__(1635);
const react_1 = __webpack_require__(6540);
const bridge_1 = __webpack_require__(2321);
const isEqual_1 = tslib_1.__importDefault(__webpack_require__(2404));
const useTheme = () => {
    const [theme, setTheme] = (0, react_1.useState)(null);
    const themeRef = (0, react_1.useRef)(null);
    const themeLoadedRef = (0, react_1.useRef)(false);
    const loadingContextRef = (0, react_1.useRef)(false);
    const applyTheme = (0, react_1.useCallback)((nextTheme) => {
        if ((0, isEqual_1.default)(themeRef.current, nextTheme)) {
            return;
        }
        themeRef.current = nextTheme;
        setTheme((current) => ((0, isEqual_1.default)(current, nextTheme) ? current : nextTheme));
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
            }
            finally {
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
        const sub = bridge_1.events.on('FORGE_CORE_THEME_CHANGED', ({ theme: updatedTheme }) => {
            themeLoadedRef.current = true;
            applyTheme(updatedTheme);
        });
        void sub.then((subscription) => {
            if (cancelled) {
                subscription.unsubscribe();
            }
            else {
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


/***/ },

/***/ 4574
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.I18nProvider = exports.useTranslation = void 0;
const jsx_runtime_1 = __webpack_require__(4848);
const react_1 = __webpack_require__(6540);
const bridge_1 = __webpack_require__(2321);
const EMPTY_I18N_CONTEXT_VALUE = {
    ready: false,
    t: (key, defaultValue) => defaultValue ?? key
};
const I18nContext = (0, react_1.createContext)(EMPTY_I18N_CONTEXT_VALUE);
/**
 * Custom hook to access the i18n translation context.
 *
 * This hook provides the current i18n context value, which includes the translation function (`t`)
 * and the readiness state of the i18n context. If the context is not ready, the translation function
 * will return the key itself.
 *
 * @returns The current i18n context value, including the translation function, current locale, and readiness state.
 */
const useTranslation = () => {
    return (0, react_1.useContext)(I18nContext);
};
exports.useTranslation = useTranslation;
/**
 * Provider component for the i18n context.
 *
 * This component initializes the i18n context with the appropriate locale and translation function.
 * It fetches the locale from the provided props or the current view context if no locale is provided.
 * The i18n context value is then made available to all child components.
 *
 * @param children The child components that will have access to the i18n context.
 * @param locale The optional locale to initialize the i18n context with,
 *    if not provided, the current locale from the view context is used.
 *
 * @returns The provider component that wraps the children with the i18n context.
 */
const I18nProvider = ({ children, locale }) => {
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
    return (0, jsx_runtime_1.jsx)(I18nContext.Provider, { value: i18nContextValue, children: children });
};
exports.I18nProvider = I18nProvider;


/***/ },

/***/ 6210
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.assertSuccessfulResponse = exports.getJSONData = exports.makeRequest = exports.withContext = exports.A = void 0;
const bridge_1 = __webpack_require__(2321);
const types_1 = __webpack_require__(8632);
exports.A = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
};
// loads productContext and passes data to support API calls for GET, UPDATE, DELETE operations
const withContext = ({ originalOperation, apiEndpoints, entityType, origPropertyKey }) => async (...args) => {
    const context = await bridge_1.view.getContext();
    const propertyKey = entityType === 'Content' ? `forge-${context.localId}-${origPropertyKey}` : `forge-${origPropertyKey}`;
    if (entityType === 'Space' || entityType === 'Content') {
        const endpointFactory = apiEndpoints({ entityType, context });
        return originalOperation({ endpointFactory, propertyKey }, ...args);
    }
    else if (entityType === 'Issue') {
        const endpointFactory = apiEndpoints(context);
        return originalOperation({ endpointFactory, propertyKey, context }, ...args);
    }
    else {
        throw new Error('Invalid entity type.');
    }
};
exports.withContext = withContext;
const makeRequest = async ({ url, apiMethod, body, method }) => {
    const fetchOptions = { headers: exports.A, method, body };
    try {
        return await apiMethod(url, fetchOptions);
    }
    catch (error) {
        throw new Error('An unknown network error occurred.');
    }
};
exports.makeRequest = makeRequest;
const getJSONData = async (response) => {
    try {
        const data = await response.json();
        return data;
    }
    catch (err) {
        throw new Error('An invalid response is received from the server');
    }
};
exports.getJSONData = getJSONData;
// checks if a response from the API is successful and throw error if not
const assertSuccessfulResponse = ({ entityType, propertyKey, operation, response }) => {
    if (!response.ok) {
        throw new types_1.EntityPropertyRequestFailedError({ entityType, propertyKey, operation, status: response.status });
    }
};
exports.assertSuccessfulResponse = assertSuccessfulResponse;


/***/ },

/***/ 5808
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports.resolveValue = void 0;
// copied over from @forge/ui
// helper function that resolves a value from a promise or returns the original value
const resolveValue = async (defaultValue) => {
    const value = defaultValue instanceof Function ? defaultValue() : defaultValue;
    return await value;
};
exports.resolveValue = resolveValue;


/***/ },

/***/ 9341
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.useObjectStore = exports.useForm = exports.replaceUnsupportedDocumentNodes = exports.I18nProvider = exports.useTranslation = exports.useIssueProperty = exports.useSpaceProperty = exports.useContentProperty = exports["default"] = exports.usePermissions = exports.useTheme = exports.useConfig = exports.useProductContext = exports.xcss = void 0;
const tslib_1 = __webpack_require__(1635);
const xcss = (style) => style;
exports.xcss = xcss;
var useProductContext_1 = __webpack_require__(9415);
Object.defineProperty(exports, "useProductContext", ({ enumerable: true, get: function () { return useProductContext_1.useProductContext; } }));
var useConfig_1 = __webpack_require__(5067);
Object.defineProperty(exports, "useConfig", ({ enumerable: true, get: function () { return useConfig_1.useConfig; } }));
var useTheme_1 = __webpack_require__(4024);
Object.defineProperty(exports, "useTheme", ({ enumerable: true, get: function () { return useTheme_1.useTheme; } }));
var usePermissions_1 = __webpack_require__(1845);
Object.defineProperty(exports, "usePermissions", ({ enumerable: true, get: function () { return usePermissions_1.usePermissions; } }));
var reconciler_1 = __webpack_require__(4695);
Object.defineProperty(exports, "default", ({ enumerable: true, get: function () { return reconciler_1.ForgeReconciler; } }));
// All UI Kit component definitions
tslib_1.__exportStar(__webpack_require__(8326), exports);
var useContentProperty_1 = __webpack_require__(8045);
Object.defineProperty(exports, "useContentProperty", ({ enumerable: true, get: function () { return useContentProperty_1.useContentProperty; } }));
var useSpaceProperty_1 = __webpack_require__(4174);
Object.defineProperty(exports, "useSpaceProperty", ({ enumerable: true, get: function () { return useSpaceProperty_1.useSpaceProperty; } }));
var useIssueProperty_1 = __webpack_require__(1595);
Object.defineProperty(exports, "useIssueProperty", ({ enumerable: true, get: function () { return useIssueProperty_1.useIssueProperty; } }));
var useTranslation_1 = __webpack_require__(4574);
Object.defineProperty(exports, "useTranslation", ({ enumerable: true, get: function () { return useTranslation_1.useTranslation; } }));
Object.defineProperty(exports, "I18nProvider", ({ enumerable: true, get: function () { return useTranslation_1.I18nProvider; } }));
var replaceUnsupportedDocumentNodes_1 = __webpack_require__(7587);
Object.defineProperty(exports, "replaceUnsupportedDocumentNodes", ({ enumerable: true, get: function () { return replaceUnsupportedDocumentNodes_1.replaceUnsupportedDocumentNodes; } }));
var useForm_1 = __webpack_require__(9019);
Object.defineProperty(exports, "useForm", ({ enumerable: true, get: function () { return useForm_1.useForm; } }));
var useObjectStore_1 = __webpack_require__(5365);
Object.defineProperty(exports, "useObjectStore", ({ enumerable: true, get: function () { return useObjectStore_1.useObjectStore; } }));


/***/ },

/***/ 4695
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ForgeReconciler = exports.hostConfig = exports.nonChildPropsAreEqual = exports.insertBefore = exports.appendChild = exports.createElement = exports.callBridge = void 0;
const tslib_1 = __webpack_require__(1635);
const react_reconciler_1 = tslib_1.__importDefault(__webpack_require__(4845));
const constants_1 = __webpack_require__(772);
const uuid_1 = __webpack_require__(182);
// Only taking the first 5 characters of the uuid to keep the id shorter in the DOM to readability.
// The chances of clashing with 5 characters is still 1 in 1 million.
const idPropsPrefixAppUUID = (0, uuid_1.v4)().slice(0, 5);
const idPropsPrefix = `forge-app-${idPropsPrefixAppUUID}`;
// Checks the props of the component to see if it has an id prop. If so prefixes the value with the idPropsPrefix\
// This is done to avoid id conflicts with components in host product and other forge apps in the same page
const newPropsWithIdPrefix = (props) => {
    const idProps = ['id', 'labelFor', 'inputId'];
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
const attachFunctionPropId = (props) => {
    for (const key in props) {
        const propValue = props[key];
        if (typeof propValue === 'function' && !propValue.__id__) {
            propValue.__id__ = (0, uuid_1.v4)();
        }
    }
    return props;
};
// Normalises raw React props into the props stored on a ForgeDoc: the `children`
// prop is dropped (children are tracked separately on the ForgeDoc tree) and the
// id/function-id transforms are applied. Keeping the `children` React element out
// of the serialised props is important: in React's development build a React
// element carries an `_owner` fiber reference, which produces a circular
// structure when the reconcile payload is JSON-serialised over the bridge.
const normaliseProps = (props) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...restProps } = props;
    return newPropsWithIdPrefix(attachFunctionPropId(restProps));
};
const handleReconcilerError = async (error) => {
    try {
        await self?.__bridge?.callBridge('onError', { error });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.log('error calling bridge onError', e);
    }
};
const callBridge = function (cmd, data) {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    self?.__bridge?.callBridge(cmd, data);
};
exports.callBridge = callBridge;
const createElement = ({ type, props = {}, forgeReactMajorVersion }) => {
    const newProps = normaliseProps(props);
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
const appendChild = (parent, child) => {
    if (parent.children.includes(child)) {
        const removeIndex = parent.children.indexOf(child);
        parent.children.splice(removeIndex, 1);
    }
    parent.children.push(child);
};
exports.appendChild = appendChild;
const insertBefore = (parent, child, beforeChild) => {
    const insertIndex = parent.children.indexOf(beforeChild);
    if (parent.children.includes(child)) {
        const removeIndex = parent.children.indexOf(child);
        parent.children.splice(removeIndex, 1);
    }
    parent.children.splice(insertIndex, 0, child);
};
exports.insertBefore = insertBefore;
/**
 * Performs a shallow comparison of the old and new props for a component, but doesn't
 * compare the "children" prop. This works because the custom reconciler extracts the
 * "children" prop from the ForgeDoc and includes it separately.
 *
 * This function is used in prepareUpdate to determine whether or not to increment the
 * reconciliationCount for the component - the reconciliationCount should only be incremented
 * if the props have changed.
 *
 * @param newProps The new props being passed to the component
 * @param oldProps The old props the component previously had
 * @returns True if the props are equal and false otherwise
 */
const nonChildPropsAreEqual = (oldProps, newProps) => {
    const newPropsKey = Object.keys(newProps).filter((key) => key !== 'children');
    const oldPropsKey = Object.keys(oldProps).filter((key) => key !== 'children');
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
        (0, exports.callBridge)('reconcile', { forgeDoc: containerInfo });
    },
    createInstance(type, instanceProps) {
        const element = (0, exports.createElement)({ type, props: instanceProps });
        return element;
    },
    createTextInstance(text) {
        const element = (0, exports.createElement)({ type: 'String', props: { text } });
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
        const normalisedProps = normaliseProps(newProps);
        instance.props = normalisedProps;
        return normalisedProps;
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
    preparePortalMount() { },
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
    resetTextContent() { },
    commitTextUpdate(textInstance, oldText, newText) {
        textInstance.props.text = newText;
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    commitMount() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    commitUpdate() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    hideInstance() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    hideTextInstance() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unhideInstance() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unhideTextInstance() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    clearContainer() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    detachDeletedInstance() { },
    getCurrentEventPriority() {
        return constants_1.DefaultEventPriority;
    },
    getInstanceFromNode() {
        return null;
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    beforeActiveInstanceBlur() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    afterActiveInstanceBlur() { },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    prepareScopeUpdate() { },
    getInstanceFromScope() {
        return null;
    }
};
const reconciler = (0, react_reconciler_1.default)(exports.hostConfig);
exports.ForgeReconciler = {
    render: (element) => {
        const rootElement = (0, exports.createElement)({ type: 'Root', props: {}, forgeReactMajorVersion: 11 });
        const container = reconciler.createContainer(rootElement, 0, null, false, null, 'root', (err) => {
            // eslint-disable-next-line no-console
            console.log(err);
        }, null);
        try {
            reconciler.updateContainer(element, container, null, null);
        }
        catch (e) {
            // only report errors that are not recoverable
            void handleReconcilerError(e);
            throw e;
        }
    },
    addConfig: (element) => {
        const macroConfigElement = (0, exports.createElement)({ type: 'MacroConfig', props: {}, forgeReactMajorVersion: 11 });
        const container = reconciler.createContainer(macroConfigElement, 0, null, false, null, 'macroConfig', (err) => {
            // eslint-disable-next-line no-console
            console.log(err);
        }, null);
        reconciler.updateContainer(element, container, null, null);
    }
};
exports["default"] = exports.ForgeReconciler;


/***/ },

/***/ 5580
(module, __unused_webpack_exports, __webpack_require__) {

var getNative = __webpack_require__(6110),
    root = __webpack_require__(9325);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView');

module.exports = DataView;


/***/ },

/***/ 1549
(module, __unused_webpack_exports, __webpack_require__) {

var hashClear = __webpack_require__(2032),
    hashDelete = __webpack_require__(3862),
    hashGet = __webpack_require__(6721),
    hashHas = __webpack_require__(2749),
    hashSet = __webpack_require__(5749);

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

module.exports = Hash;


/***/ },

/***/ 79
(module, __unused_webpack_exports, __webpack_require__) {

var listCacheClear = __webpack_require__(3702),
    listCacheDelete = __webpack_require__(80),
    listCacheGet = __webpack_require__(4739),
    listCacheHas = __webpack_require__(8655),
    listCacheSet = __webpack_require__(1175);

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

module.exports = ListCache;


/***/ },

/***/ 8223
(module, __unused_webpack_exports, __webpack_require__) {

var getNative = __webpack_require__(6110),
    root = __webpack_require__(9325);

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map');

module.exports = Map;


/***/ },

/***/ 3661
(module, __unused_webpack_exports, __webpack_require__) {

var mapCacheClear = __webpack_require__(3040),
    mapCacheDelete = __webpack_require__(7670),
    mapCacheGet = __webpack_require__(289),
    mapCacheHas = __webpack_require__(4509),
    mapCacheSet = __webpack_require__(2949);

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

module.exports = MapCache;


/***/ },

/***/ 2804
(module, __unused_webpack_exports, __webpack_require__) {

var getNative = __webpack_require__(6110),
    root = __webpack_require__(9325);

/* Built-in method references that are verified to be native. */
var Promise = getNative(root, 'Promise');

module.exports = Promise;


/***/ },

/***/ 6545
(module, __unused_webpack_exports, __webpack_require__) {

var getNative = __webpack_require__(6110),
    root = __webpack_require__(9325);

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

module.exports = Set;


/***/ },

/***/ 8859
(module, __unused_webpack_exports, __webpack_require__) {

var MapCache = __webpack_require__(3661),
    setCacheAdd = __webpack_require__(1380),
    setCacheHas = __webpack_require__(1459);

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

module.exports = SetCache;


/***/ },

/***/ 7217
(module, __unused_webpack_exports, __webpack_require__) {

var ListCache = __webpack_require__(79),
    stackClear = __webpack_require__(1420),
    stackDelete = __webpack_require__(938),
    stackGet = __webpack_require__(3605),
    stackHas = __webpack_require__(9817),
    stackSet = __webpack_require__(945);

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;


/***/ },

/***/ 1873
(module, __unused_webpack_exports, __webpack_require__) {

var root = __webpack_require__(9325);

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;


/***/ },

/***/ 7828
(module, __unused_webpack_exports, __webpack_require__) {

var root = __webpack_require__(9325);

/** Built-in value references. */
var Uint8Array = root.Uint8Array;

module.exports = Uint8Array;


/***/ },

/***/ 8303
(module, __unused_webpack_exports, __webpack_require__) {

var getNative = __webpack_require__(6110),
    root = __webpack_require__(9325);

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root, 'WeakMap');

module.exports = WeakMap;


/***/ },

/***/ 9770
(module) {

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

module.exports = arrayFilter;


/***/ },

/***/ 695
(module, __unused_webpack_exports, __webpack_require__) {

var baseTimes = __webpack_require__(8096),
    isArguments = __webpack_require__(2428),
    isArray = __webpack_require__(6449),
    isBuffer = __webpack_require__(3656),
    isIndex = __webpack_require__(361),
    isTypedArray = __webpack_require__(7167);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = arrayLikeKeys;


/***/ },

/***/ 4932
(module) {

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;


/***/ },

/***/ 4528
(module) {

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;


/***/ },

/***/ 4248
(module) {

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

module.exports = arraySome;


/***/ },

/***/ 6025
(module, __unused_webpack_exports, __webpack_require__) {

var eq = __webpack_require__(5288);

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
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


/***/ },

/***/ 7422
(module, __unused_webpack_exports, __webpack_require__) {

var castPath = __webpack_require__(1769),
    toKey = __webpack_require__(7797);

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = castPath(path, object);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

module.exports = baseGet;


/***/ },

/***/ 2199
(module, __unused_webpack_exports, __webpack_require__) {

var arrayPush = __webpack_require__(4528),
    isArray = __webpack_require__(6449);

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

module.exports = baseGetAllKeys;


/***/ },

/***/ 2552
(module, __unused_webpack_exports, __webpack_require__) {

var Symbol = __webpack_require__(1873),
    getRawTag = __webpack_require__(659),
    objectToString = __webpack_require__(9350);

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;


/***/ },

/***/ 7534
(module, __unused_webpack_exports, __webpack_require__) {

var baseGetTag = __webpack_require__(2552),
    isObjectLike = __webpack_require__(346);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

module.exports = baseIsArguments;


/***/ },

/***/ 270
(module, __unused_webpack_exports, __webpack_require__) {

var baseIsEqualDeep = __webpack_require__(7068),
    isObjectLike = __webpack_require__(346);

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

module.exports = baseIsEqual;


/***/ },

/***/ 7068
(module, __unused_webpack_exports, __webpack_require__) {

var Stack = __webpack_require__(7217),
    equalArrays = __webpack_require__(5911),
    equalByTag = __webpack_require__(1986),
    equalObjects = __webpack_require__(689),
    getTag = __webpack_require__(5861),
    isArray = __webpack_require__(6449),
    isBuffer = __webpack_require__(3656),
    isTypedArray = __webpack_require__(7167);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = objIsArr ? arrayTag : getTag(object),
      othTag = othIsArr ? arrayTag : getTag(other);

  objTag = objTag == argsTag ? objectTag : objTag;
  othTag = othTag == argsTag ? objectTag : othTag;

  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer(object)) {
    if (!isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

module.exports = baseIsEqualDeep;


/***/ },

/***/ 5083
(module, __unused_webpack_exports, __webpack_require__) {

var isFunction = __webpack_require__(1882),
    isMasked = __webpack_require__(7296),
    isObject = __webpack_require__(3805),
    toSource = __webpack_require__(7473);

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

module.exports = baseIsNative;


/***/ },

/***/ 4901
(module, __unused_webpack_exports, __webpack_require__) {

var baseGetTag = __webpack_require__(2552),
    isLength = __webpack_require__(294),
    isObjectLike = __webpack_require__(346);

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

module.exports = baseIsTypedArray;


/***/ },

/***/ 8984
(module, __unused_webpack_exports, __webpack_require__) {

var isPrototype = __webpack_require__(5527),
    nativeKeys = __webpack_require__(3650);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeys;


/***/ },

/***/ 8096
(module) {

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

module.exports = baseTimes;


/***/ },

/***/ 7556
(module, __unused_webpack_exports, __webpack_require__) {

var Symbol = __webpack_require__(1873),
    arrayMap = __webpack_require__(4932),
    isArray = __webpack_require__(6449),
    isSymbol = __webpack_require__(4394);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = baseToString;


/***/ },

/***/ 7301
(module) {

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

module.exports = baseUnary;


/***/ },

/***/ 9219
(module) {

/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

module.exports = cacheHas;


/***/ },

/***/ 1769
(module, __unused_webpack_exports, __webpack_require__) {

var isArray = __webpack_require__(6449),
    isKey = __webpack_require__(8586),
    stringToPath = __webpack_require__(1802),
    toString = __webpack_require__(3222);

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @param {Object} [object] The object to query keys on.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value, object) {
  if (isArray(value)) {
    return value;
  }
  return isKey(value, object) ? [value] : stringToPath(toString(value));
}

module.exports = castPath;


/***/ },

/***/ 5481
(module, __unused_webpack_exports, __webpack_require__) {

var root = __webpack_require__(9325);

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

module.exports = coreJsData;


/***/ },

/***/ 5911
(module, __unused_webpack_exports, __webpack_require__) {

var SetCache = __webpack_require__(8859),
    arraySome = __webpack_require__(4248),
    cacheHas = __webpack_require__(9219);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Check that cyclic values are equal.
  var arrStacked = stack.get(array);
  var othStacked = stack.get(other);
  if (arrStacked && othStacked) {
    return arrStacked == other && othStacked == array;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

module.exports = equalArrays;


/***/ },

/***/ 1986
(module, __unused_webpack_exports, __webpack_require__) {

var Symbol = __webpack_require__(1873),
    Uint8Array = __webpack_require__(7828),
    eq = __webpack_require__(5288),
    equalArrays = __webpack_require__(5911),
    mapToArray = __webpack_require__(317),
    setToArray = __webpack_require__(6628);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

module.exports = equalByTag;


/***/ },

/***/ 689
(module, __unused_webpack_exports, __webpack_require__) {

var getAllKeys = __webpack_require__(2);

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      objProps = getAllKeys(object),
      objLength = objProps.length,
      othProps = getAllKeys(other),
      othLength = othProps.length;

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
  // Check that cyclic values are equal.
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
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

module.exports = equalObjects;


/***/ },

/***/ 4840
(module, __unused_webpack_exports, __webpack_require__) {

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof __webpack_require__.g == 'object' && __webpack_require__.g && __webpack_require__.g.Object === Object && __webpack_require__.g;

module.exports = freeGlobal;


/***/ },

/***/ 2
(module, __unused_webpack_exports, __webpack_require__) {

var baseGetAllKeys = __webpack_require__(2199),
    getSymbols = __webpack_require__(4664),
    keys = __webpack_require__(5950);

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

module.exports = getAllKeys;


/***/ },

/***/ 2651
(module, __unused_webpack_exports, __webpack_require__) {

var isKeyable = __webpack_require__(4218);

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

module.exports = getMapData;


/***/ },

/***/ 6110
(module, __unused_webpack_exports, __webpack_require__) {

var baseIsNative = __webpack_require__(5083),
    getValue = __webpack_require__(392);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

module.exports = getNative;


/***/ },

/***/ 659
(module, __unused_webpack_exports, __webpack_require__) {

var Symbol = __webpack_require__(1873);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

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


/***/ },

/***/ 4664
(module, __unused_webpack_exports, __webpack_require__) {

var arrayFilter = __webpack_require__(9770),
    stubArray = __webpack_require__(3345);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
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


/***/ },

/***/ 5861
(module, __unused_webpack_exports, __webpack_require__) {

var DataView = __webpack_require__(5580),
    Map = __webpack_require__(8223),
    Promise = __webpack_require__(2804),
    Set = __webpack_require__(6545),
    WeakMap = __webpack_require__(8303),
    baseGetTag = __webpack_require__(2552),
    toSource = __webpack_require__(7473);

/** `Object#toString` result references. */
var mapTag = '[object Map]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    setTag = '[object Set]',
    weakMapTag = '[object WeakMap]';

var dataViewTag = '[object DataView]';

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

module.exports = getTag;


/***/ },

/***/ 392
(module) {

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

module.exports = getValue;


/***/ },

/***/ 2032
(module, __unused_webpack_exports, __webpack_require__) {

var nativeCreate = __webpack_require__(1042);

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

module.exports = hashClear;


/***/ },

/***/ 3862
(module) {

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = hashDelete;


/***/ },

/***/ 6721
(module, __unused_webpack_exports, __webpack_require__) {

var nativeCreate = __webpack_require__(1042);

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

module.exports = hashGet;


/***/ },

/***/ 2749
(module, __unused_webpack_exports, __webpack_require__) {

var nativeCreate = __webpack_require__(1042);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

module.exports = hashHas;


/***/ },

/***/ 5749
(module, __unused_webpack_exports, __webpack_require__) {

var nativeCreate = __webpack_require__(1042);

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

module.exports = hashSet;


/***/ },

/***/ 361
(module) {

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;


/***/ },

/***/ 8586
(module, __unused_webpack_exports, __webpack_require__) {

var isArray = __webpack_require__(6449),
    isSymbol = __webpack_require__(4394);

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

module.exports = isKey;


/***/ },

/***/ 4218
(module) {

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

module.exports = isKeyable;


/***/ },

/***/ 7296
(module, __unused_webpack_exports, __webpack_require__) {

var coreJsData = __webpack_require__(5481);

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

module.exports = isMasked;


/***/ },

/***/ 5527
(module) {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

module.exports = isPrototype;


/***/ },

/***/ 3702
(module) {

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

module.exports = listCacheClear;


/***/ },

/***/ 80
(module, __unused_webpack_exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(6025);

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

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


/***/ },

/***/ 4739
(module, __unused_webpack_exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(6025);

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

module.exports = listCacheGet;


/***/ },

/***/ 8655
(module, __unused_webpack_exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(6025);

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

module.exports = listCacheHas;


/***/ },

/***/ 1175
(module, __unused_webpack_exports, __webpack_require__) {

var assocIndexOf = __webpack_require__(6025);

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

module.exports = listCacheSet;


/***/ },

/***/ 3040
(module, __unused_webpack_exports, __webpack_require__) {

var Hash = __webpack_require__(1549),
    ListCache = __webpack_require__(79),
    Map = __webpack_require__(8223);

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

module.exports = mapCacheClear;


/***/ },

/***/ 7670
(module, __unused_webpack_exports, __webpack_require__) {

var getMapData = __webpack_require__(2651);

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = mapCacheDelete;


/***/ },

/***/ 289
(module, __unused_webpack_exports, __webpack_require__) {

var getMapData = __webpack_require__(2651);

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

module.exports = mapCacheGet;


/***/ },

/***/ 4509
(module, __unused_webpack_exports, __webpack_require__) {

var getMapData = __webpack_require__(2651);

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

module.exports = mapCacheHas;


/***/ },

/***/ 2949
(module, __unused_webpack_exports, __webpack_require__) {

var getMapData = __webpack_require__(2651);

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

module.exports = mapCacheSet;


/***/ },

/***/ 317
(module) {

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

module.exports = mapToArray;


/***/ },

/***/ 2224
(module, __unused_webpack_exports, __webpack_require__) {

var memoize = __webpack_require__(104);

/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
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


/***/ },

/***/ 1042
(module, __unused_webpack_exports, __webpack_require__) {

var getNative = __webpack_require__(6110);

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

module.exports = nativeCreate;


/***/ },

/***/ 3650
(module, __unused_webpack_exports, __webpack_require__) {

var overArg = __webpack_require__(4335);

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

module.exports = nativeKeys;


/***/ },

/***/ 6009
(module, exports, __webpack_require__) {

/* module decorator */ module = __webpack_require__.nmd(module);
var freeGlobal = __webpack_require__(4840);

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule && freeModule.require && freeModule.require('util').types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

module.exports = nodeUtil;


/***/ },

/***/ 9350
(module) {

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;


/***/ },

/***/ 4335
(module) {

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;


/***/ },

/***/ 9325
(module, __unused_webpack_exports, __webpack_require__) {

var freeGlobal = __webpack_require__(4840);

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;


/***/ },

/***/ 1380
(module) {

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

module.exports = setCacheAdd;


/***/ },

/***/ 1459
(module) {

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {boolean} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

module.exports = setCacheHas;


/***/ },

/***/ 6628
(module) {

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

module.exports = setToArray;


/***/ },

/***/ 1420
(module, __unused_webpack_exports, __webpack_require__) {

var ListCache = __webpack_require__(79);

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

module.exports = stackClear;


/***/ },

/***/ 938
(module) {

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

module.exports = stackDelete;


/***/ },

/***/ 3605
(module) {

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

module.exports = stackGet;


/***/ },

/***/ 9817
(module) {

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

module.exports = stackHas;


/***/ },

/***/ 945
(module, __unused_webpack_exports, __webpack_require__) {

var ListCache = __webpack_require__(79),
    Map = __webpack_require__(8223),
    MapCache = __webpack_require__(3661);

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
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


/***/ },

/***/ 1802
(module, __unused_webpack_exports, __webpack_require__) {

var memoizeCapped = __webpack_require__(2224);

/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoizeCapped(function(string) {
  var result = [];
  if (string.charCodeAt(0) === 46 /* . */) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, subString) {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

module.exports = stringToPath;


/***/ },

/***/ 7797
(module, __unused_webpack_exports, __webpack_require__) {

var isSymbol = __webpack_require__(4394);

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toKey;


/***/ },

/***/ 7473
(module) {

/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

module.exports = toSource;


/***/ },

/***/ 5288
(module) {

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;


/***/ },

/***/ 8156
(module, __unused_webpack_exports, __webpack_require__) {

var baseGet = __webpack_require__(7422);

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = get;


/***/ },

/***/ 2428
(module, __unused_webpack_exports, __webpack_require__) {

var baseIsArguments = __webpack_require__(7534),
    isObjectLike = __webpack_require__(346);

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

module.exports = isArguments;


/***/ },

/***/ 6449
(module) {

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;


/***/ },

/***/ 4894
(module, __unused_webpack_exports, __webpack_require__) {

var isFunction = __webpack_require__(1882),
    isLength = __webpack_require__(294);

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;


/***/ },

/***/ 3656
(module, exports, __webpack_require__) {

/* module decorator */ module = __webpack_require__.nmd(module);
var root = __webpack_require__(9325),
    stubFalse = __webpack_require__(9935);

/** Detect free variable `exports`. */
var freeExports =  true && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && "object" == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

module.exports = isBuffer;


/***/ },

/***/ 2404
(module, __unused_webpack_exports, __webpack_require__) {

var baseIsEqual = __webpack_require__(270);

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are compared by strict equality, i.e. `===`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

module.exports = isEqual;


/***/ },

/***/ 1882
(module, __unused_webpack_exports, __webpack_require__) {

var baseGetTag = __webpack_require__(2552),
    isObject = __webpack_require__(3805);

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

module.exports = isFunction;


/***/ },

/***/ 294
(module) {

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;


/***/ },

/***/ 3805
(module) {

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;


/***/ },

/***/ 346
(module) {

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;


/***/ },

/***/ 4394
(module, __unused_webpack_exports, __webpack_require__) {

var baseGetTag = __webpack_require__(2552),
    isObjectLike = __webpack_require__(346);

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

module.exports = isSymbol;


/***/ },

/***/ 7167
(module, __unused_webpack_exports, __webpack_require__) {

var baseIsTypedArray = __webpack_require__(4901),
    baseUnary = __webpack_require__(7301),
    nodeUtil = __webpack_require__(6009);

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

module.exports = isTypedArray;


/***/ },

/***/ 5950
(module, __unused_webpack_exports, __webpack_require__) {

var arrayLikeKeys = __webpack_require__(695),
    baseKeys = __webpack_require__(8984),
    isArrayLike = __webpack_require__(4894);

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = keys;


/***/ },

/***/ 104
(module, __unused_webpack_exports, __webpack_require__) {

var MapCache = __webpack_require__(3661);

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = MapCache;

module.exports = memoize;


/***/ },

/***/ 3345
(module) {

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

module.exports = stubArray;


/***/ },

/***/ 9935
(module) {

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = stubFalse;


/***/ },

/***/ 3222
(module, __unused_webpack_exports, __webpack_require__) {

var baseToString = __webpack_require__(7556);

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

module.exports = toString;


/***/ },

/***/ 330
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;
var e=__webpack_require__(6540),t=e=>"checkbox"===e.type,r=e=>e instanceof Date,s=e=>null==e;const a=e=>"object"==typeof e;var i=e=>!s(e)&&!Array.isArray(e)&&a(e)&&!r(e),n=e=>i(e)&&e.target?t(e.target)?e.target.checked:e.target.value:e,o=(e,t)=>e.has((e=>e.substring(0,e.search(/\.\d+(\.|$)/))||e)(t)),l="undefined"!=typeof window&&void 0!==window.HTMLElement&&"undefined"!=typeof document;function u(e){let t;const r=Array.isArray(e),s="undefined"!=typeof FileList&&e instanceof FileList;if(e instanceof Date)t=new Date(e);else{if(l&&(e instanceof Blob||s)||!r&&!i(e))return e;if(t=r?[]:Object.create(Object.getPrototypeOf(e)),r||(e=>{const t=e.constructor&&e.constructor.prototype;return i(t)&&t.hasOwnProperty("isPrototypeOf")})(e))for(const r in e)e.hasOwnProperty(r)&&(t[r]=u(e[r]));else t=e}return t}var d=e=>/^\w*$/.test(e),c=e=>void 0===e,f=e=>Array.isArray(e)?e.filter(Boolean):[],m=e=>f(e.replace(/["|']|\]/g,"").split(/\.|\[/)),y=(e,t,r)=>{if(!t||!i(e))return r;const a=(d(t)?[t]:m(t)).reduce((e,t)=>s(e)?e:e[t],e);return c(a)||a===e?c(e[t])?r:e[t]:a},g=e=>"boolean"==typeof e,p=(e,t,r)=>{let s=-1;const a=d(t)?[t]:m(t),n=a.length,o=n-1;for(;++s<n;){const t=a[s];let n=r;if(s!==o){const r=e[t];n=i(r)||Array.isArray(r)?r:isNaN(+a[s+1])?{}:[]}if("__proto__"===t||"constructor"===t||"prototype"===t)return;e[t]=n,e=e[t]}};const _="blur",b="focusout",h="change",v="onBlur",V="onChange",F="onSubmit",x="onTouched",A="all",S="max",w="min",k="maxLength",D="minLength",C="pattern",E="required",O="validate",M=e.createContext(null);M.displayName="HookFormContext";const j=()=>e.useContext(M);var U=(e,t,r,s=!0)=>{const a={defaultValues:t._defaultValues};for(const i in e)Object.defineProperty(a,i,{get:()=>{const a=i;return t._proxyFormState[a]!==A&&(t._proxyFormState[a]=!s||A),r&&(r[a]=!0),e[a]}});return a};const T="undefined"!=typeof window?e.useLayoutEffect:e.useEffect;function N(t){const r=j(),{control:s=r.control,disabled:a,name:i,exact:n}=t||{},[o,l]=e.useState(s._formState),u=e.useRef({isDirty:!1,isLoading:!1,dirtyFields:!1,touchedFields:!1,validatingFields:!1,isValidating:!1,isValid:!1,errors:!1});return T(()=>s._subscribe({name:i,formState:u.current,exact:n,callback:e=>{!a&&l({...s._formState,...e})}}),[i,a,n]),e.useEffect(()=>{u.current.isValid&&s._setValid(!0)},[s]),e.useMemo(()=>U(o,s,u.current,!1),[o,s])}var R=e=>"string"==typeof e,B=(e,t,r,s,a)=>R(e)?(s&&t.watch.add(e),y(r,e,a)):Array.isArray(e)?e.map(e=>(s&&t.watch.add(e),y(r,e))):(s&&(t.watchAll=!0),r),L=e=>s(e)||!a(e);function P(e,t,s=new WeakSet){if(L(e)||L(t))return e===t;if(r(e)&&r(t))return e.getTime()===t.getTime();const a=Object.keys(e),n=Object.keys(t);if(a.length!==n.length)return!1;if(s.has(e)||s.has(t))return!0;s.add(e),s.add(t);for(const o of a){const a=e[o];if(!n.includes(o))return!1;if("ref"!==o){const e=t[o];if(r(a)&&r(e)||i(a)&&i(e)||Array.isArray(a)&&Array.isArray(e)?!P(a,e,s):a!==e)return!1}}return!0}function W(t){const r=j(),{control:s=r.control,name:a,defaultValue:i,disabled:n,exact:o,compute:l}=t||{},u=e.useRef(i),d=e.useRef(l),c=e.useRef(void 0);d.current=l;const f=e.useMemo(()=>s._getWatch(a,u.current),[s,a]),[m,y]=e.useState(d.current?d.current(f):f);return T(()=>s._subscribe({name:a,formState:{values:!0},exact:o,callback:e=>{if(!n){const t=B(a,s._names,e.values||s._formValues,!1,u.current);if(d.current){const e=d.current(t);P(e,c.current)||(y(e),c.current=e)}else y(t)}}}),[s,n,a,o]),e.useEffect(()=>s._removeUnmounted()),m}function I(t){const r=j(),{name:s,disabled:a,control:i=r.control,shouldUnregister:l,defaultValue:d}=t,f=o(i._names.array,s),m=e.useMemo(()=>y(i._formValues,s,y(i._defaultValues,s,d)),[i,s,d]),b=W({control:i,name:s,defaultValue:m,exact:!0}),v=N({control:i,name:s,exact:!0}),V=e.useRef(t),F=e.useRef(void 0),x=e.useRef(i.register(s,{...t.rules,value:b,...g(t.disabled)?{disabled:t.disabled}:{}}));V.current=t;const A=e.useMemo(()=>Object.defineProperties({},{invalid:{enumerable:!0,get:()=>!!y(v.errors,s)},isDirty:{enumerable:!0,get:()=>!!y(v.dirtyFields,s)},isTouched:{enumerable:!0,get:()=>!!y(v.touchedFields,s)},isValidating:{enumerable:!0,get:()=>!!y(v.validatingFields,s)},error:{enumerable:!0,get:()=>y(v.errors,s)}}),[v,s]),S=e.useCallback(e=>x.current.onChange({target:{value:n(e),name:s},type:h}),[s]),w=e.useCallback(()=>x.current.onBlur({target:{value:y(i._formValues,s),name:s},type:_}),[s,i._formValues]),k=e.useCallback(e=>{const t=y(i._fields,s);t&&e&&(t._f.ref={focus:()=>e.focus&&e.focus(),select:()=>e.select&&e.select(),setCustomValidity:t=>e.setCustomValidity(t),reportValidity:()=>e.reportValidity()})},[i._fields,s]),D=e.useMemo(()=>({name:s,value:b,...g(a)||v.disabled?{disabled:v.disabled||a}:{},onChange:S,onBlur:w,ref:k}),[s,a,v.disabled,S,w,k,b]);return e.useEffect(()=>{const e=i._options.shouldUnregister||l,t=F.current;t&&t!==s&&!f&&i.unregister(t),i.register(s,{...V.current.rules,...g(V.current.disabled)?{disabled:V.current.disabled}:{}});const r=(e,t)=>{const r=y(i._fields,e);r&&r._f&&(r._f.mount=t)};if(r(s,!0),e){const e=u(y(i._options.defaultValues,s,V.current.defaultValue));p(i._defaultValues,s,e),c(y(i._formValues,s))&&p(i._formValues,s,e)}return!f&&i.register(s),F.current=s,()=>{(f?e&&!i._state.action:e)?i.unregister(s):r(s,!1)}},[s,i,f,l]),e.useEffect(()=>{i._setDisabledField({disabled:a,name:s})},[a,s,i]),e.useMemo(()=>({field:D,formState:v,fieldState:A}),[D,v,A])}const q=e=>{const t={};for(const r of Object.keys(e))if(a(e[r])&&null!==e[r]){const s=q(e[r]);for(const e of Object.keys(s))t[`${r}.${e}`]=s[e]}else t[r]=e[r];return t},$="post";var H=(e,t,r,s,a)=>t?{...r[e],types:{...r[e]&&r[e].types?r[e].types:{},[s]:a||!0}}:{},J=e=>Array.isArray(e)?e:[e],z=()=>{let e=[];return{get observers(){return e},next:t=>{for(const r of e)r.next&&r.next(t)},subscribe:t=>(e.push(t),{unsubscribe:()=>{e=e.filter(e=>e!==t)}}),unsubscribe:()=>{e=[]}}};function G(e,t){const r={};for(const s in e)if(e.hasOwnProperty(s)){const a=e[s],n=t[s];if(a&&i(a)&&n){const e=G(a,n);i(e)&&(r[s]=e)}else e[s]&&(r[s]=n)}return r}var K=e=>i(e)&&!Object.keys(e).length,Q=e=>"file"===e.type,X=e=>"function"==typeof e,Y=e=>{if(!l)return!1;const t=e?e.ownerDocument:0;return e instanceof(t&&t.defaultView?t.defaultView.HTMLElement:HTMLElement)},Z=e=>"select-multiple"===e.type,ee=e=>"radio"===e.type,te=e=>Y(e)&&e.isConnected;function re(e,t){const r=Array.isArray(t)?t:d(t)?[t]:m(t),s=1===r.length?e:function(e,t){const r=t.slice(0,-1).length;let s=0;for(;s<r;)e=c(e)?s++:e[t[s++]];return e}(e,r),a=r.length-1,n=r[a];return s&&delete s[n],0!==a&&(i(s)&&K(s)||Array.isArray(s)&&function(e){for(const t in e)if(e.hasOwnProperty(t)&&!c(e[t]))return!1;return!0}(s))&&re(e,r.slice(0,-1)),e}function se(e){return Array.isArray(e)||i(e)&&!(e=>{for(const t in e)if(X(e[t]))return!0;return!1})(e)}function ae(e,t={}){for(const r in e)se(e[r])?(t[r]=Array.isArray(e[r])?[]:{},ae(e[r],t[r])):c(e[r])||(t[r]=!0);return t}function ie(e,t,r){r||(r=ae(t));for(const a in e)se(e[a])?c(t)||L(r[a])?r[a]=ae(e[a],Array.isArray(e[a])?[]:{}):ie(e[a],s(t)?{}:t[a],r[a]):r[a]=!P(e[a],t[a]);return r}const ne={value:!1,isValid:!1},oe={value:!0,isValid:!0};var le=e=>{if(Array.isArray(e)){if(e.length>1){const t=e.filter(e=>e&&e.checked&&!e.disabled).map(e=>e.value);return{value:t,isValid:!!t.length}}return e[0].checked&&!e[0].disabled?e[0].attributes&&!c(e[0].attributes.value)?c(e[0].value)||""===e[0].value?oe:{value:e[0].value,isValid:!0}:oe:ne}return ne},ue=(e,{valueAsNumber:t,valueAsDate:r,setValueAs:s})=>c(e)?e:t?""===e?NaN:e?+e:e:r&&R(e)?new Date(e):s?s(e):e;const de={isValid:!1,value:null};var ce=e=>Array.isArray(e)?e.reduce((e,t)=>t&&t.checked&&!t.disabled?{isValid:!0,value:t.value}:e,de):de;function fe(e){const r=e.ref;return Q(r)?r.files:ee(r)?ce(e.refs).value:Z(r)?[...r.selectedOptions].map(({value:e})=>e):t(r)?le(e.refs).value:ue(c(r.value)?e.ref.value:r.value,e)}var me=e=>e instanceof RegExp,ye=e=>c(e)?e:me(e)?e.source:i(e)?me(e.value)?e.value.source:e.value:e,ge=e=>({isOnSubmit:!e||e===F,isOnBlur:e===v,isOnChange:e===V,isOnAll:e===A,isOnTouch:e===x});const pe="AsyncFunction";var _e=e=>!!e&&!!e.validate&&!!(X(e.validate)&&e.validate.constructor.name===pe||i(e.validate)&&Object.values(e.validate).find(e=>e.constructor.name===pe)),be=(e,t,r)=>!r&&(t.watchAll||t.watch.has(e)||[...t.watch].some(t=>e.startsWith(t)&&/^\.\w+/.test(e.slice(t.length))));const he=(e,t,r,s)=>{for(const a of r||Object.keys(e)){const r=y(e,a);if(r){const{_f:e,...n}=r;if(e){if(e.refs&&e.refs[0]&&t(e.refs[0],a)&&!s)return!0;if(e.ref&&t(e.ref,e.name)&&!s)return!0;if(he(n,t))break}else if(i(n)&&he(n,t))break}}};function ve(e,t,r){const s=y(e,r);if(s||d(r))return{error:s,name:r};const a=r.split(".");for(;a.length;){const s=a.join("."),i=y(t,s),n=y(e,s);if(i&&!Array.isArray(i)&&r!==s)return{name:r};if(n&&n.type)return{name:s,error:n};if(n&&n.root&&n.root.type)return{name:`${s}.root`,error:n.root};a.pop()}return{name:r}}var Ve=(e,t,r)=>{const s=J(y(e,r));return p(s,"root",t[r]),p(e,r,s),e};function Fe(e,t,r="validate"){if(R(e)||Array.isArray(e)&&e.every(R)||g(e)&&!e)return{type:r,message:R(e)?e:"",ref:t}}var xe=e=>i(e)&&!me(e)?e:{value:e,message:""},Ae=async(e,r,a,n,o,l)=>{const{ref:u,refs:d,required:f,maxLength:m,minLength:p,min:_,max:b,pattern:h,validate:v,name:V,valueAsNumber:F,mount:x}=e._f,A=y(a,V);if(!x||r.has(V))return{};const M=d?d[0]:u,j=e=>{o&&M.reportValidity&&(M.setCustomValidity(g(e)?"":e||""),M.reportValidity())},U={},T=ee(u),N=t(u),B=T||N,L=(F||Q(u))&&c(u.value)&&c(A)||Y(u)&&""===u.value||""===A||Array.isArray(A)&&!A.length,P=H.bind(null,V,n,U),W=(e,t,r,s=k,a=D)=>{const i=e?t:r;U[V]={type:e?s:a,message:i,ref:u,...P(e?s:a,i)}};if(l?!Array.isArray(A)||!A.length:f&&(!B&&(L||s(A))||g(A)&&!A||N&&!le(d).isValid||T&&!ce(d).isValid)){const{value:e,message:t}=R(f)?{value:!!f,message:f}:xe(f);if(e&&(U[V]={type:E,message:t,ref:M,...P(E,t)},!n))return j(t),U}if(!(L||s(_)&&s(b))){let e,t;const r=xe(b),a=xe(_);if(s(A)||isNaN(A)){const s=u.valueAsDate||new Date(A),i=e=>new Date((new Date).toDateString()+" "+e),n="time"==u.type,o="week"==u.type;R(r.value)&&A&&(e=n?i(A)>i(r.value):o?A>r.value:s>new Date(r.value)),R(a.value)&&A&&(t=n?i(A)<i(a.value):o?A<a.value:s<new Date(a.value))}else{const i=u.valueAsNumber||(A?+A:A);s(r.value)||(e=i>r.value),s(a.value)||(t=i<a.value)}if((e||t)&&(W(!!e,r.message,a.message,S,w),!n))return j(U[V].message),U}if((m||p)&&!L&&(R(A)||l&&Array.isArray(A))){const e=xe(m),t=xe(p),r=!s(e.value)&&A.length>+e.value,a=!s(t.value)&&A.length<+t.value;if((r||a)&&(W(r,e.message,t.message),!n))return j(U[V].message),U}if(h&&!L&&R(A)){const{value:e,message:t}=xe(h);if(me(e)&&!A.match(e)&&(U[V]={type:C,message:t,ref:u,...P(C,t)},!n))return j(t),U}if(v)if(X(v)){const e=Fe(await v(A,a),M);if(e&&(U[V]={...e,...P(O,e.message)},!n))return j(e.message),U}else if(i(v)){let e={};for(const t in v){if(!K(e)&&!n)break;const r=Fe(await v[t](A,a),M,t);r&&(e={...r,...P(t,r.message)},j(r.message),n&&(U[V]=e))}if(!K(e)&&(U[V]={ref:M,...e},!n))return U}return j(!0),U};const Se={mode:F,reValidateMode:V,shouldFocusError:!0};function we(e={}){let a,d={...Se,...e},m={submitCount:0,isDirty:!1,isReady:!1,isLoading:X(d.defaultValues),isValidating:!1,isSubmitted:!1,isSubmitting:!1,isSubmitSuccessful:!1,isValid:!1,touchedFields:{},dirtyFields:{},validatingFields:{},errors:d.errors||{},disabled:d.disabled||!1},h={},v=(i(d.defaultValues)||i(d.values))&&u(d.defaultValues||d.values)||{},V=d.shouldUnregister?{}:u(v),F={action:!1,mount:!1,watch:!1},x={mount:new Set,disabled:new Set,unMount:new Set,array:new Set,watch:new Set},S=0;const w={isDirty:!1,dirtyFields:!1,validatingFields:!1,touchedFields:!1,isValidating:!1,isValid:!1,errors:!1};let k={...w};const D={array:z(),state:z()},C=d.criteriaMode===A,E=async e=>{if(!d.disabled&&(w.isValid||k.isValid||e)){const e=d.resolver?K((await T()).errors):await N(h,!0);e!==m.isValid&&D.state.next({isValid:e})}},O=(e,t)=>{!d.disabled&&(w.isValidating||w.validatingFields||k.isValidating||k.validatingFields)&&((e||Array.from(x.mount)).forEach(e=>{e&&(t?p(m.validatingFields,e,t):re(m.validatingFields,e))}),D.state.next({validatingFields:m.validatingFields,isValidating:!K(m.validatingFields)}))},M=(e,t,r,s)=>{const a=y(h,e);if(a){const i=y(V,e,c(r)?y(v,e):r);c(i)||s&&s.defaultChecked||t?p(V,e,t?i:fe(a._f)):I(e,i),F.mount&&E()}},j=(e,t,r,s,a)=>{let i=!1,n=!1;const o={name:e};if(!d.disabled){if(!r||s){(w.isDirty||k.isDirty)&&(n=m.isDirty,m.isDirty=o.isDirty=L(),i=n!==o.isDirty);const r=P(y(v,e),t);n=!!y(m.dirtyFields,e),r?re(m.dirtyFields,e):p(m.dirtyFields,e,!0),o.dirtyFields=m.dirtyFields,i=i||(w.dirtyFields||k.dirtyFields)&&n!==!r}if(r){const t=y(m.touchedFields,e);t||(p(m.touchedFields,e,r),o.touchedFields=m.touchedFields,i=i||(w.touchedFields||k.touchedFields)&&t!==r)}i&&a&&D.state.next(o)}return i?o:{}},U=(e,t,r,s)=>{const i=y(m.errors,e),n=(w.isValid||k.isValid)&&g(t)&&m.isValid!==t;var o;if(d.delayError&&r?(o=()=>((e,t)=>{p(m.errors,e,t),D.state.next({errors:m.errors})})(e,r),a=e=>{clearTimeout(S),S=setTimeout(o,e)},a(d.delayError)):(clearTimeout(S),a=null,r?p(m.errors,e,r):re(m.errors,e)),(r?!P(i,r):i)||!K(s)||n){const r={...s,...n&&g(t)?{isValid:t}:{},errors:m.errors,name:e};m={...m,...r},D.state.next(r)}},T=async e=>{O(e,!0);const t=await d.resolver(V,d.context,((e,t,r,s)=>{const a={};for(const r of e){const e=y(t,r);e&&p(a,r,e._f)}return{criteriaMode:r,names:[...e],fields:a,shouldUseNativeValidation:s}})(e||x.mount,h,d.criteriaMode,d.shouldUseNativeValidation));return O(e),t},N=async(e,t,r={valid:!0})=>{for(const s in e){const a=e[s];if(a){const{_f:e,...s}=a;if(e){const s=x.array.has(e.name),i=a._f&&_e(a._f);i&&w.validatingFields&&O([e.name],!0);const n=await Ae(a,x.disabled,V,C,d.shouldUseNativeValidation&&!t,s);if(i&&w.validatingFields&&O([e.name]),n[e.name]&&(r.valid=!1,t))break;!t&&(y(n,e.name)?s?Ve(m.errors,n,e.name):p(m.errors,e.name,n[e.name]):re(m.errors,e.name))}!K(s)&&await N(s,t,r)}}return r.valid},L=(e,t)=>!d.disabled&&(e&&t&&p(V,e,t),!P(ne(),v)),W=(e,t,r)=>B(e,x,{...F.mount?V:c(t)?v:R(e)?{[e]:t}:t},r,t),I=(e,r,a={})=>{const i=y(h,e);let n=r;if(i){const a=i._f;a&&(!a.disabled&&p(V,e,ue(r,a)),n=Y(a.ref)&&s(r)?"":r,Z(a.ref)?[...a.ref.options].forEach(e=>e.selected=n.includes(e.value)):a.refs?t(a.ref)?a.refs.forEach(e=>{e.defaultChecked&&e.disabled||(Array.isArray(n)?e.checked=!!n.find(t=>t===e.value):e.checked=n===e.value||!!n)}):a.refs.forEach(e=>e.checked=e.value===n):Q(a.ref)?a.ref.value="":(a.ref.value=n,a.ref.type||D.state.next({name:e,values:u(V)})))}(a.shouldDirty||a.shouldTouch)&&j(e,n,a.shouldTouch,a.shouldDirty,!0),a.shouldValidate&&ae(e)},q=(e,t,s)=>{for(const a in t){if(!t.hasOwnProperty(a))return;const n=t[a],o=e+"."+a,l=y(h,o);(x.array.has(e)||i(n)||l&&!l._f)&&!r(n)?q(o,n,s):I(o,n,s)}},$=(e,t,r={})=>{const a=y(h,e),i=x.array.has(e),n=u(t);p(V,e,n),i?(D.array.next({name:e,values:u(V)}),(w.isDirty||w.dirtyFields||k.isDirty||k.dirtyFields)&&r.shouldDirty&&D.state.next({name:e,dirtyFields:ie(v,V),isDirty:L(e,n)})):!a||a._f||s(n)?I(e,n,r):q(e,n,r),be(e,x)&&D.state.next({...m,name:e}),D.state.next({name:F.mount?e:void 0,values:u(V)})},H=async e=>{F.mount=!0;const t=e.target;let s=t.name,i=!0;const o=y(h,s),l=e=>{i=Number.isNaN(e)||r(e)&&isNaN(e.getTime())||P(e,y(V,s,e))},c=ge(d.mode),f=ge(d.reValidateMode);if(o){let r,v;const F=t.type?fe(o._f):n(e),A=e.type===_||e.type===b,S=!((g=o._f).mount&&(g.required||g.min||g.max||g.maxLength||g.minLength||g.pattern||g.validate)||d.resolver||y(m.errors,s)||o._f.deps)||((e,t,r,s,a)=>!a.isOnAll&&(!r&&a.isOnTouch?!(t||e):(r?s.isOnBlur:a.isOnBlur)?!e:!(r?s.isOnChange:a.isOnChange)||e))(A,y(m.touchedFields,s),m.isSubmitted,f,c),M=be(s,x,A);p(V,s,F),A?t&&t.readOnly||(o._f.onBlur&&o._f.onBlur(e),a&&a(0)):o._f.onChange&&o._f.onChange(e);const R=j(s,F,A),B=!K(R)||M;if(!A&&D.state.next({name:s,type:e.type,values:u(V)}),S)return(w.isValid||k.isValid)&&("onBlur"===d.mode?A&&E():A||E()),B&&D.state.next({name:s,...M?{}:R});if(!A&&M&&D.state.next({...m}),d.resolver){const{errors:e}=await T([s]);if(l(F),i){const t=ve(m.errors,h,s),a=ve(e,h,t.name||s);r=a.error,s=a.name,v=K(e)}}else O([s],!0),r=(await Ae(o,x.disabled,V,C,d.shouldUseNativeValidation))[s],O([s]),l(F),i&&(r?v=!1:(w.isValid||k.isValid)&&(v=await N(h,!0)));i&&(o._f.deps&&(!Array.isArray(o._f.deps)||o._f.deps.length>0)&&ae(o._f.deps),U(s,v,r,R))}var g},se=(e,t)=>{if(y(m.errors,t)&&e.focus)return e.focus(),1},ae=async(e,t={})=>{let r,s;const a=J(e);if(d.resolver){const t=await(async e=>{const{errors:t}=await T(e);if(e)for(const r of e){const e=y(t,r);e?p(m.errors,r,e):re(m.errors,r)}else m.errors=t;return t})(c(e)?e:a);r=K(t),s=e?!a.some(e=>y(t,e)):r}else e?(s=(await Promise.all(a.map(async e=>{const t=y(h,e);return await N(t&&t._f?{[e]:t}:t)}))).every(Boolean),(s||m.isValid)&&E()):s=r=await N(h);return D.state.next({...!R(e)||(w.isValid||k.isValid)&&r!==m.isValid?{}:{name:e},...d.resolver||!e?{isValid:r}:{},errors:m.errors}),t.shouldFocus&&!s&&he(h,se,e?a:x.mount),s},ne=(e,t)=>{let r={...F.mount?V:v};return t&&(r=G(t.dirtyFields?m.dirtyFields:m.touchedFields,r)),c(e)?r:R(e)?y(r,e):e.map(e=>y(r,e))},oe=(e,t)=>({invalid:!!y((t||m).errors,e),isDirty:!!y((t||m).dirtyFields,e),error:y((t||m).errors,e),isValidating:!!y(m.validatingFields,e),isTouched:!!y((t||m).touchedFields,e)}),le=(e,t,r)=>{const s=(y(h,e,{_f:{}})._f||{}).ref,a=y(m.errors,e)||{},{ref:i,message:n,type:o,...l}=a;p(m.errors,e,{...l,...t,ref:s}),D.state.next({name:e,errors:m.errors,isValid:!1}),r&&r.shouldFocus&&s&&s.focus&&s.focus()},de=e=>D.state.subscribe({next:t=>{var r,s,a;r=e.name,s=t.name,a=e.exact,r&&s&&r!==s&&!J(r).some(e=>e&&(a?e===s:e.startsWith(s)||s.startsWith(e)))||!((e,t,r,s)=>{r(e);const{name:a,...i}=e;return K(i)||Object.keys(i).length>=Object.keys(t).length||Object.keys(i).find(e=>t[e]===(!s||A))})(t,e.formState||w,De,e.reRenderRoot)||e.callback({values:{...V},...m,...t,defaultValues:v})}}).unsubscribe,ce=(e,t={})=>{for(const r of e?J(e):x.mount)x.mount.delete(r),x.array.delete(r),t.keepValue||(re(h,r),re(V,r)),!t.keepError&&re(m.errors,r),!t.keepDirty&&re(m.dirtyFields,r),!t.keepTouched&&re(m.touchedFields,r),!t.keepIsValidating&&re(m.validatingFields,r),!d.shouldUnregister&&!t.keepDefaultValue&&re(v,r);D.state.next({values:u(V)}),D.state.next({...m,...t.keepDirty?{isDirty:L()}:{}}),!t.keepIsValid&&E()},me=({disabled:e,name:t})=>{(g(e)&&F.mount||e||x.disabled.has(t))&&(e?x.disabled.add(t):x.disabled.delete(t))},pe=(e,r={})=>{let s=y(h,e);const a=g(r.disabled)||g(d.disabled);return p(h,e,{...s||{},_f:{...s&&s._f?s._f:{ref:{name:e}},name:e,mount:!0,...r}}),x.mount.add(e),s?me({disabled:g(r.disabled)?r.disabled:d.disabled,name:e}):M(e,!0,r.value),{...a?{disabled:r.disabled||d.disabled}:{},...d.progressive?{required:!!r.required,min:ye(r.min),max:ye(r.max),minLength:ye(r.minLength),maxLength:ye(r.maxLength),pattern:ye(r.pattern)}:{},name:e,onChange:H,onBlur:H,ref:a=>{if(a){pe(e,r),s=y(h,e);const i=c(a.value)&&a.querySelectorAll&&a.querySelectorAll("input,select,textarea")[0]||a,n=(e=>ee(e)||t(e))(i),o=s._f.refs||[];if(n?o.find(e=>e===i):i===s._f.ref)return;p(h,e,{_f:{...s._f,...n?{refs:[...o.filter(te),i,...Array.isArray(y(v,e))?[{}]:[]],ref:{type:i.type,name:e}}:{ref:i}}}),M(e,!1,void 0,i)}else s=y(h,e,{}),s._f&&(s._f.mount=!1),(d.shouldUnregister||r.shouldUnregister)&&(!o(x.array,e)||!F.action)&&x.unMount.add(e)}}},Fe=()=>d.shouldFocusError&&he(h,se,x.mount),xe=(e,t)=>async r=>{let s;r&&(r.preventDefault&&r.preventDefault(),r.persist&&r.persist());let a=u(V);if(D.state.next({isSubmitting:!0}),d.resolver){const{errors:e,values:t}=await T();m.errors=e,a=u(t)}else await N(h);if(x.disabled.size)for(const e of x.disabled)re(a,e);if(re(m.errors,"root"),K(m.errors)){D.state.next({errors:{}});try{await e(a,r)}catch(e){s=e}}else t&&await t({...m.errors},r),Fe(),setTimeout(Fe);if(D.state.next({isSubmitted:!0,isSubmitting:!1,isSubmitSuccessful:K(m.errors)&&!s,submitCount:m.submitCount+1,errors:m.errors}),s)throw s},we=(e,t={})=>{const r=e?u(e):v,s=u(r),a=K(e),i=a?v:s;if(t.keepDefaultValues||(v=r),!t.keepValues){if(t.keepDirtyValues){const e=new Set([...x.mount,...Object.keys(ie(v,V))]);for(const t of Array.from(e))y(m.dirtyFields,t)?p(i,t,y(V,t)):$(t,y(i,t))}else{if(l&&c(e))for(const e of x.mount){const t=y(h,e);if(t&&t._f){const e=Array.isArray(t._f.refs)?t._f.refs[0]:t._f.ref;if(Y(e)){const t=e.closest("form");if(t){t.reset();break}}}}if(t.keepFieldsRef)for(const e of x.mount)$(e,y(i,e));else h={}}V=d.shouldUnregister?t.keepDefaultValues?u(v):{}:u(i),D.array.next({values:{...i}}),D.state.next({values:{...i}})}x={mount:t.keepDirtyValues?x.mount:new Set,unMount:new Set,array:new Set,disabled:new Set,watch:new Set,watchAll:!1,focus:""},F.mount=!w.isValid||!!t.keepIsValid||!!t.keepDirtyValues,F.watch=!!d.shouldUnregister,D.state.next({submitCount:t.keepSubmitCount?m.submitCount:0,isDirty:!a&&(t.keepDirty?m.isDirty:!(!t.keepDefaultValues||P(e,v))),isSubmitted:!!t.keepIsSubmitted&&m.isSubmitted,dirtyFields:a?{}:t.keepDirtyValues?t.keepDefaultValues&&V?ie(v,V):m.dirtyFields:t.keepDefaultValues&&e?ie(v,e):t.keepDirty?m.dirtyFields:{},touchedFields:t.keepTouched?m.touchedFields:{},errors:t.keepErrors?m.errors:{},isSubmitSuccessful:!!t.keepIsSubmitSuccessful&&m.isSubmitSuccessful,isSubmitting:!1,defaultValues:v})},ke=(e,t)=>we(X(e)?e(V):e,t),De=e=>{m={...m,...e}},Ce={control:{register:pe,unregister:ce,getFieldState:oe,handleSubmit:xe,setError:le,_subscribe:de,_runSchema:T,_focusError:Fe,_getWatch:W,_getDirty:L,_setValid:E,_setFieldArray:(e,t=[],r,s,a=!0,i=!0)=>{if(s&&r&&!d.disabled){if(F.action=!0,i&&Array.isArray(y(h,e))){const t=r(y(h,e),s.argA,s.argB);a&&p(h,e,t)}if(i&&Array.isArray(y(m.errors,e))){const t=r(y(m.errors,e),s.argA,s.argB);a&&p(m.errors,e,t),((e,t)=>{!f(y(e,t)).length&&re(e,t)})(m.errors,e)}if((w.touchedFields||k.touchedFields)&&i&&Array.isArray(y(m.touchedFields,e))){const t=r(y(m.touchedFields,e),s.argA,s.argB);a&&p(m.touchedFields,e,t)}(w.dirtyFields||k.dirtyFields)&&(m.dirtyFields=ie(v,V)),D.state.next({name:e,isDirty:L(e,t),dirtyFields:m.dirtyFields,errors:m.errors,isValid:m.isValid})}else p(V,e,t)},_setDisabledField:me,_setErrors:e=>{m.errors=e,D.state.next({errors:m.errors,isValid:!1})},_getFieldArray:e=>f(y(F.mount?V:v,e,d.shouldUnregister?y(v,e,[]):[])),_reset:we,_resetDefaultValues:()=>X(d.defaultValues)&&d.defaultValues().then(e=>{ke(e,d.resetOptions),D.state.next({isLoading:!1})}),_removeUnmounted:()=>{for(const e of x.unMount){const t=y(h,e);t&&(t._f.refs?t._f.refs.every(e=>!te(e)):!te(t._f.ref))&&ce(e)}x.unMount=new Set},_disableForm:e=>{g(e)&&(D.state.next({disabled:e}),he(h,(t,r)=>{const s=y(h,r);s&&(t.disabled=s._f.disabled||e,Array.isArray(s._f.refs)&&s._f.refs.forEach(t=>{t.disabled=s._f.disabled||e}))},0,!1))},_subjects:D,_proxyFormState:w,get _fields(){return h},get _formValues(){return V},get _state(){return F},set _state(e){F=e},get _defaultValues(){return v},get _names(){return x},set _names(e){x=e},get _formState(){return m},get _options(){return d},set _options(e){d={...d,...e}}},subscribe:e=>(F.mount=!0,k={...k,...e.formState},de({...e,formState:k})),trigger:ae,register:pe,handleSubmit:xe,watch:(e,t)=>X(e)?D.state.subscribe({next:r=>"values"in r&&e(W(void 0,t),r)}):W(e,t,!0),setValue:$,getValues:ne,reset:ke,resetField:(e,t={})=>{y(h,e)&&(c(t.defaultValue)?$(e,u(y(v,e))):($(e,t.defaultValue),p(v,e,u(t.defaultValue))),t.keepTouched||re(m.touchedFields,e),t.keepDirty||(re(m.dirtyFields,e),m.isDirty=t.defaultValue?L(e,u(y(v,e))):L()),t.keepError||(re(m.errors,e),w.isValid&&E()),D.state.next({...m}))},clearErrors:e=>{e&&J(e).forEach(e=>re(m.errors,e)),D.state.next({errors:e?m.errors:{}})},unregister:ce,setError:le,setFocus:(e,t={})=>{const r=y(h,e),s=r&&r._f;if(s){const e=s.refs?s.refs[0]:s.ref;e.focus&&(e.focus(),t.shouldSelect&&X(e.select)&&e.select())}},getFieldState:oe};return{...Ce,formControl:Ce}}var ke=()=>{if("undefined"!=typeof crypto&&crypto.randomUUID)return crypto.randomUUID();const e="undefined"==typeof performance?Date.now():1e3*performance.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,t=>{const r=(16*Math.random()+e)%16|0;return("x"==t?r:3&r|8).toString(16)})},De=(e,t,r={})=>r.shouldFocus||c(r.shouldFocus)?r.focusName||`${e}.${c(r.focusIndex)?t:r.focusIndex}.`:"",Ce=(e,t)=>[...e,...J(t)],Ee=e=>Array.isArray(e)?e.map(()=>{}):void 0;function Oe(e,t,r){return[...e.slice(0,t),...J(r),...e.slice(t)]}var Me=(e,t,r)=>Array.isArray(e)?(c(e[r])&&(e[r]=void 0),e.splice(r,0,e.splice(t,1)[0]),e):[],je=(e,t)=>[...J(t),...J(e)];var Ue=(e,t)=>c(t)?[]:function(e,t){let r=0;const s=[...e];for(const e of t)s.splice(e-r,1),r++;return f(s).length?s:[]}(e,J(t).sort((e,t)=>e-t)),Te=(e,t,r)=>{[e[t],e[r]]=[e[r],e[t]]},Ne=(e,t,r)=>(e[t]=r,e);__webpack_unused_export__=e=>e.render(I(e)),__webpack_unused_export__=function(t){const r=j(),[s,a]=e.useState(!1),{control:i=r.control,onSubmit:n,children:o,action:l,method:u=$,headers:d,encType:c,onError:f,render:m,onSuccess:y,validateStatus:g,...p}=t,_=async e=>{let r=!1,s="";await i.handleSubmit(async t=>{const a=new FormData;let o="";try{o=JSON.stringify(t)}catch(e){}const m=q(i._formValues);for(const e in m)a.append(e,m[e]);if(n&&await n({data:t,event:e,method:u,formData:a,formDataJson:o}),l)try{const e=[d&&d["Content-Type"],c].some(e=>e&&e.includes("json")),t=await fetch(String(l),{method:u,headers:{...d,...c&&"multipart/form-data"!==c?{"Content-Type":c}:{}},body:e?o:a});t&&(g?!g(t.status):t.status<200||t.status>=300)?(r=!0,f&&f({response:t}),s=String(t.status)):y&&y({response:t})}catch(e){r=!0,f&&f({error:e})}})(e),r&&t.control&&(t.control._subjects.state.next({isSubmitSuccessful:!1}),t.control.setError("root.server",{type:s}))};return e.useEffect(()=>{a(!0)},[]),m?e.createElement(e.Fragment,null,m({submit:_})):e.createElement("form",{noValidate:s,action:l,method:u,encType:c,onSubmit:_,...p},o)},__webpack_unused_export__=t=>{const{children:r,...s}=t;return e.createElement(M.Provider,{value:s},r)},__webpack_unused_export__=({control:e,names:t,render:r})=>r(W({control:e,name:t})),__webpack_unused_export__=H,__webpack_unused_export__=we,__webpack_unused_export__=y,__webpack_unused_export__=p,__webpack_unused_export__=I,__webpack_unused_export__=function(t){const r=j(),{control:s=r.control,name:a,keyName:i="id",shouldUnregister:n,rules:o}=t,[l,d]=e.useState(s._getFieldArray(a)),c=e.useRef(s._getFieldArray(a).map(ke)),f=e.useRef(!1);s._names.array.add(a),e.useMemo(()=>o&&l.length>=0&&s.register(a,o),[s,a,l.length,o]),T(()=>s._subjects.array.subscribe({next:({values:e,name:t})=>{if(t===a||!t){const t=y(e,a);Array.isArray(t)&&(d(t),c.current=t.map(ke))}}}).unsubscribe,[s,a]);const m=e.useCallback(e=>{f.current=!0,s._setFieldArray(a,e)},[s,a]);return e.useEffect(()=>{if(s._state.action=!1,be(a,s._names)&&s._subjects.state.next({...s._formState}),f.current&&(!ge(s._options.mode).isOnSubmit||s._formState.isSubmitted)&&!ge(s._options.reValidateMode).isOnSubmit)if(s._options.resolver)s._runSchema([a]).then(e=>{const t=y(e.errors,a),r=y(s._formState.errors,a);(r?!t&&r.type||t&&(r.type!==t.type||r.message!==t.message):t&&t.type)&&(t?p(s._formState.errors,a,t):re(s._formState.errors,a),s._subjects.state.next({errors:s._formState.errors}))});else{const e=y(s._fields,a);!e||!e._f||ge(s._options.reValidateMode).isOnSubmit&&ge(s._options.mode).isOnSubmit||Ae(e,s._names.disabled,s._formValues,s._options.criteriaMode===A,s._options.shouldUseNativeValidation,!0).then(e=>!K(e)&&s._subjects.state.next({errors:Ve(s._formState.errors,e,a)}))}s._subjects.state.next({name:a,values:u(s._formValues)}),s._names.focus&&he(s._fields,(e,t)=>{if(s._names.focus&&t.startsWith(s._names.focus)&&e.focus)return e.focus(),1}),s._names.focus="",s._setValid(),f.current=!1},[l,a,s]),e.useEffect(()=>(!y(s._formValues,a)&&s._setFieldArray(a),()=>{s._options.shouldUnregister||n?s.unregister(a):((e,t)=>{const r=y(s._fields,e);r&&r._f&&(r._f.mount=t)})(a,!1)}),[a,s,i,n]),{swap:e.useCallback((e,t)=>{const r=s._getFieldArray(a);Te(r,e,t),Te(c.current,e,t),m(r),d(r),s._setFieldArray(a,r,Te,{argA:e,argB:t},!1)},[m,a,s]),move:e.useCallback((e,t)=>{const r=s._getFieldArray(a);Me(r,e,t),Me(c.current,e,t),m(r),d(r),s._setFieldArray(a,r,Me,{argA:e,argB:t},!1)},[m,a,s]),prepend:e.useCallback((e,t)=>{const r=J(u(e)),i=je(s._getFieldArray(a),r);s._names.focus=De(a,0,t),c.current=je(c.current,r.map(ke)),m(i),d(i),s._setFieldArray(a,i,je,{argA:Ee(e)})},[m,a,s]),append:e.useCallback((e,t)=>{const r=J(u(e)),i=Ce(s._getFieldArray(a),r);s._names.focus=De(a,i.length-1,t),c.current=Ce(c.current,r.map(ke)),m(i),d(i),s._setFieldArray(a,i,Ce,{argA:Ee(e)})},[m,a,s]),remove:e.useCallback(e=>{const t=Ue(s._getFieldArray(a),e);c.current=Ue(c.current,e),m(t),d(t),!Array.isArray(y(s._fields,a))&&p(s._fields,a,void 0),s._setFieldArray(a,t,Ue,{argA:e})},[m,a,s]),insert:e.useCallback((e,t,r)=>{const i=J(u(t)),n=Oe(s._getFieldArray(a),e,i);s._names.focus=De(a,e,r),c.current=Oe(c.current,e,i.map(ke)),m(n),d(n),s._setFieldArray(a,n,Oe,{argA:e,argB:Ee(t)})},[m,a,s]),update:e.useCallback((e,t)=>{const r=u(t),i=Ne(s._getFieldArray(a),e,r);c.current=[...i].map((t,r)=>t&&r!==e?c.current[r]:ke()),m(i),d([...i]),s._setFieldArray(a,i,Ne,{argA:e,argB:r},!0,!1)},[m,a,s]),replace:e.useCallback(e=>{const t=J(u(e));c.current=t.map(ke),m([...t]),d([...t]),s._setFieldArray(a,[...t],e=>e,{},!0,!1)},[m,a,s]),fields:e.useMemo(()=>l.map((e,t)=>({...e,[i]:c.current[t]||ke()})),[l,i])}},exports.useForm=function(t={}){const r=e.useRef(void 0),s=e.useRef(void 0),[a,i]=e.useState({isDirty:!1,isValidating:!1,isLoading:X(t.defaultValues),isSubmitted:!1,isSubmitting:!1,isSubmitSuccessful:!1,isValid:!1,submitCount:0,dirtyFields:{},touchedFields:{},validatingFields:{},errors:t.errors||{},disabled:t.disabled||!1,isReady:!1,defaultValues:X(t.defaultValues)?void 0:t.defaultValues});if(!r.current)if(t.formControl)r.current={...t.formControl,formState:a},t.defaultValues&&!X(t.defaultValues)&&t.formControl.reset(t.defaultValues,t.resetOptions);else{const{formControl:e,...s}=we(t);r.current={...s,formState:a}}const n=r.current.control;return n._options=t,T(()=>{const e=n._subscribe({formState:n._proxyFormState,callback:()=>i({...n._formState}),reRenderRoot:!0});return i(e=>({...e,isReady:!0})),n._formState.isReady=!0,e},[n]),e.useEffect(()=>n._disableForm(t.disabled),[n,t.disabled]),e.useEffect(()=>{t.mode&&(n._options.mode=t.mode),t.reValidateMode&&(n._options.reValidateMode=t.reValidateMode)},[n,t.mode,t.reValidateMode]),e.useEffect(()=>{t.errors&&(n._setErrors(t.errors),n._focusError())},[n,t.errors]),e.useEffect(()=>{t.shouldUnregister&&n._subjects.state.next({values:n._getWatch()})},[n,t.shouldUnregister]),e.useEffect(()=>{if(n._proxyFormState.isDirty){const e=n._getDirty();e!==a.isDirty&&n._subjects.state.next({isDirty:e})}},[n,a.isDirty]),e.useEffect(()=>{t.values&&!P(t.values,s.current)?(n._reset(t.values,{keepFieldsRef:!0,...n._options.resetOptions}),s.current=t.values,i(e=>({...e}))):n._resetDefaultValues()},[n,t.values]),e.useEffect(()=>{n._state.mount||(n._setValid(),n._state.mount=!0),n._state.watch&&(n._state.watch=!1,n._subjects.state.next({...n._formState})),n._removeUnmounted()}),r.current.formState=U(a,n),r.current},__webpack_unused_export__=j,__webpack_unused_export__=N,__webpack_unused_export__=W;


/***/ },

/***/ 735
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;
/**
 * @license React
 * react-reconciler-constants.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
__webpack_unused_export__=1;__webpack_unused_export__=4;exports.DefaultEventPriority=16;__webpack_unused_export__=1;__webpack_unused_export__=536870912;__webpack_unused_export__=0;


/***/ },

/***/ 2935
(module, __unused_webpack_exports, __webpack_require__) {

/**
 * @license React
 * react-reconciler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
module.exports = function $$$reconciler($$$hostConfig) {
    var exports = {};
'use strict';var aa=__webpack_require__(6540),ba=__webpack_require__(9982),ca=Object.assign;function n(a){for(var b="https://reactjs.org/docs/error-decoder.html?invariant="+a,c=1;c<arguments.length;c++)b+="&args[]="+encodeURIComponent(arguments[c]);return"Minified React error #"+a+"; visit "+b+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}
var da=aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,ea=Symbol.for("react.element"),fa=Symbol.for("react.portal"),ha=Symbol.for("react.fragment"),ia=Symbol.for("react.strict_mode"),ja=Symbol.for("react.profiler"),ka=Symbol.for("react.provider"),la=Symbol.for("react.context"),ma=Symbol.for("react.forward_ref"),na=Symbol.for("react.suspense"),oa=Symbol.for("react.suspense_list"),pa=Symbol.for("react.memo"),qa=Symbol.for("react.lazy");Symbol.for("react.scope");Symbol.for("react.debug_trace_mode");
var ra=Symbol.for("react.offscreen");Symbol.for("react.legacy_hidden");Symbol.for("react.cache");Symbol.for("react.tracing_marker");var sa=Symbol.iterator;function ta(a){if(null===a||"object"!==typeof a)return null;a=sa&&a[sa]||a["@@iterator"];return"function"===typeof a?a:null}
function ua(a){if(null==a)return null;if("function"===typeof a)return a.displayName||a.name||null;if("string"===typeof a)return a;switch(a){case ha:return"Fragment";case fa:return"Portal";case ja:return"Profiler";case ia:return"StrictMode";case na:return"Suspense";case oa:return"SuspenseList"}if("object"===typeof a)switch(a.$$typeof){case la:return(a.displayName||"Context")+".Consumer";case ka:return(a._context.displayName||"Context")+".Provider";case ma:var b=a.render;a=a.displayName;a||(a=b.displayName||
b.name||"",a=""!==a?"ForwardRef("+a+")":"ForwardRef");return a;case pa:return b=a.displayName||null,null!==b?b:ua(a.type)||"Memo";case qa:b=a._payload;a=a._init;try{return ua(a(b))}catch(c){}}return null}
function va(a){var b=a.type;switch(a.tag){case 24:return"Cache";case 9:return(b.displayName||"Context")+".Consumer";case 10:return(b._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return a=b.render,a=a.displayName||a.name||"",b.displayName||(""!==a?"ForwardRef("+a+")":"ForwardRef");case 7:return"Fragment";case 5:return b;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return ua(b);case 8:return b===ia?"StrictMode":"Mode";case 22:return"Offscreen";
case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if("function"===typeof b)return b.displayName||b.name||null;if("string"===typeof b)return b}return null}function wa(a){var b=a,c=a;if(a.alternate)for(;b.return;)b=b.return;else{a=b;do b=a,0!==(b.flags&4098)&&(c=b.return),a=b.return;while(a)}return 3===b.tag?c:null}function xa(a){if(wa(a)!==a)throw Error(n(188));}
function za(a){var b=a.alternate;if(!b){b=wa(a);if(null===b)throw Error(n(188));return b!==a?null:a}for(var c=a,d=b;;){var e=c.return;if(null===e)break;var f=e.alternate;if(null===f){d=e.return;if(null!==d){c=d;continue}break}if(e.child===f.child){for(f=e.child;f;){if(f===c)return xa(e),a;if(f===d)return xa(e),b;f=f.sibling}throw Error(n(188));}if(c.return!==d.return)c=e,d=f;else{for(var g=!1,h=e.child;h;){if(h===c){g=!0;c=e;d=f;break}if(h===d){g=!0;d=e;c=f;break}h=h.sibling}if(!g){for(h=f.child;h;){if(h===
c){g=!0;c=f;d=e;break}if(h===d){g=!0;d=f;c=e;break}h=h.sibling}if(!g)throw Error(n(189));}}if(c.alternate!==d)throw Error(n(190));}if(3!==c.tag)throw Error(n(188));return c.stateNode.current===c?a:b}function Aa(a){a=za(a);return null!==a?Ba(a):null}function Ba(a){if(5===a.tag||6===a.tag)return a;for(a=a.child;null!==a;){var b=Ba(a);if(null!==b)return b;a=a.sibling}return null}
function Ca(a){if(5===a.tag||6===a.tag)return a;for(a=a.child;null!==a;){if(4!==a.tag){var b=Ca(a);if(null!==b)return b}a=a.sibling}return null}
var Da=Array.isArray,Ea=$$$hostConfig.getPublicInstance,Fa=$$$hostConfig.getRootHostContext,Ga=$$$hostConfig.getChildHostContext,Ha=$$$hostConfig.prepareForCommit,Ia=$$$hostConfig.resetAfterCommit,Ja=$$$hostConfig.createInstance,Ka=$$$hostConfig.appendInitialChild,La=$$$hostConfig.finalizeInitialChildren,Ma=$$$hostConfig.prepareUpdate,Na=$$$hostConfig.shouldSetTextContent,Oa=$$$hostConfig.createTextInstance,Pa=$$$hostConfig.scheduleTimeout,Qa=$$$hostConfig.cancelTimeout,Ra=$$$hostConfig.noTimeout,
Sa=$$$hostConfig.isPrimaryRenderer,Ta=$$$hostConfig.supportsMutation,Ua=$$$hostConfig.supportsPersistence,Va=$$$hostConfig.supportsHydration,Wa=$$$hostConfig.getInstanceFromNode,Xa=$$$hostConfig.preparePortalMount,Ya=$$$hostConfig.getCurrentEventPriority,Za=$$$hostConfig.detachDeletedInstance,$a=$$$hostConfig.supportsMicrotasks,ab=$$$hostConfig.scheduleMicrotask,bb=$$$hostConfig.supportsTestSelectors,cb=$$$hostConfig.findFiberRoot,db=$$$hostConfig.getBoundingRect,eb=$$$hostConfig.getTextContent,fb=
$$$hostConfig.isHiddenSubtree,gb=$$$hostConfig.matchAccessibilityRole,hb=$$$hostConfig.setFocusIfFocusable,ib=$$$hostConfig.setupIntersectionObserver,jb=$$$hostConfig.appendChild,kb=$$$hostConfig.appendChildToContainer,lb=$$$hostConfig.commitTextUpdate,mb=$$$hostConfig.commitMount,nb=$$$hostConfig.commitUpdate,ob=$$$hostConfig.insertBefore,pb=$$$hostConfig.insertInContainerBefore,qb=$$$hostConfig.removeChild,rb=$$$hostConfig.removeChildFromContainer,sb=$$$hostConfig.resetTextContent,tb=$$$hostConfig.hideInstance,
ub=$$$hostConfig.hideTextInstance,vb=$$$hostConfig.unhideInstance,wb=$$$hostConfig.unhideTextInstance,xb=$$$hostConfig.clearContainer,yb=$$$hostConfig.cloneInstance,zb=$$$hostConfig.createContainerChildSet,Ab=$$$hostConfig.appendChildToContainerChildSet,Bb=$$$hostConfig.finalizeContainerChildren,Cb=$$$hostConfig.replaceContainerChildren,Eb=$$$hostConfig.cloneHiddenInstance,Fb=$$$hostConfig.cloneHiddenTextInstance,Gb=$$$hostConfig.canHydrateInstance,Hb=$$$hostConfig.canHydrateTextInstance,Ib=$$$hostConfig.canHydrateSuspenseInstance,
Jb=$$$hostConfig.isSuspenseInstancePending,Kb=$$$hostConfig.isSuspenseInstanceFallback,Lb=$$$hostConfig.getSuspenseInstanceFallbackErrorDetails,Mb=$$$hostConfig.registerSuspenseInstanceRetry,Nb=$$$hostConfig.getNextHydratableSibling,Ob=$$$hostConfig.getFirstHydratableChild,Pb=$$$hostConfig.getFirstHydratableChildWithinContainer,Qb=$$$hostConfig.getFirstHydratableChildWithinSuspenseInstance,Rb=$$$hostConfig.hydrateInstance,Sb=$$$hostConfig.hydrateTextInstance,Tb=$$$hostConfig.hydrateSuspenseInstance,
Ub=$$$hostConfig.getNextHydratableInstanceAfterSuspenseInstance,Vb=$$$hostConfig.commitHydratedContainer,Wb=$$$hostConfig.commitHydratedSuspenseInstance,Xb=$$$hostConfig.clearSuspenseBoundary,Yb=$$$hostConfig.clearSuspenseBoundaryFromContainer,Zb=$$$hostConfig.shouldDeleteUnhydratedTailInstances,$b=$$$hostConfig.didNotMatchHydratedContainerTextInstance,ac=$$$hostConfig.didNotMatchHydratedTextInstance,bc;
function cc(a){if(void 0===bc)try{throw Error();}catch(c){var b=c.stack.trim().match(/\n( *(at )?)/);bc=b&&b[1]||""}return"\n"+bc+a}var dc=!1;
function ec(a,b){if(!a||dc)return"";dc=!0;var c=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(b)if(b=function(){throw Error();},Object.defineProperty(b.prototype,"props",{set:function(){throw Error();}}),"object"===typeof Reflect&&Reflect.construct){try{Reflect.construct(b,[])}catch(l){var d=l}Reflect.construct(a,[],b)}else{try{b.call()}catch(l){d=l}a.call(b.prototype)}else{try{throw Error();}catch(l){d=l}a()}}catch(l){if(l&&d&&"string"===typeof l.stack){for(var e=l.stack.split("\n"),
f=d.stack.split("\n"),g=e.length-1,h=f.length-1;1<=g&&0<=h&&e[g]!==f[h];)h--;for(;1<=g&&0<=h;g--,h--)if(e[g]!==f[h]){if(1!==g||1!==h){do if(g--,h--,0>h||e[g]!==f[h]){var k="\n"+e[g].replace(" at new "," at ");a.displayName&&k.includes("<anonymous>")&&(k=k.replace("<anonymous>",a.displayName));return k}while(1<=g&&0<=h)}break}}}finally{dc=!1,Error.prepareStackTrace=c}return(a=a?a.displayName||a.name:"")?cc(a):""}var fc=Object.prototype.hasOwnProperty,gc=[],hc=-1;function ic(a){return{current:a}}
function q(a){0>hc||(a.current=gc[hc],gc[hc]=null,hc--)}function v(a,b){hc++;gc[hc]=a.current;a.current=b}var jc={},x=ic(jc),z=ic(!1),kc=jc;function mc(a,b){var c=a.type.contextTypes;if(!c)return jc;var d=a.stateNode;if(d&&d.__reactInternalMemoizedUnmaskedChildContext===b)return d.__reactInternalMemoizedMaskedChildContext;var e={},f;for(f in c)e[f]=b[f];d&&(a=a.stateNode,a.__reactInternalMemoizedUnmaskedChildContext=b,a.__reactInternalMemoizedMaskedChildContext=e);return e}
function A(a){a=a.childContextTypes;return null!==a&&void 0!==a}function nc(){q(z);q(x)}function oc(a,b,c){if(x.current!==jc)throw Error(n(168));v(x,b);v(z,c)}function pc(a,b,c){var d=a.stateNode;b=b.childContextTypes;if("function"!==typeof d.getChildContext)return c;d=d.getChildContext();for(var e in d)if(!(e in b))throw Error(n(108,va(a)||"Unknown",e));return ca({},c,d)}
function qc(a){a=(a=a.stateNode)&&a.__reactInternalMemoizedMergedChildContext||jc;kc=x.current;v(x,a);v(z,z.current);return!0}function rc(a,b,c){var d=a.stateNode;if(!d)throw Error(n(169));c?(a=pc(a,b,kc),d.__reactInternalMemoizedMergedChildContext=a,q(z),q(x),v(x,a)):q(z);v(z,c)}var tc=Math.clz32?Math.clz32:sc,uc=Math.log,vc=Math.LN2;function sc(a){a>>>=0;return 0===a?32:31-(uc(a)/vc|0)|0}var wc=64,xc=4194304;
function yc(a){switch(a&-a){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return a&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return a&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;
default:return a}}function zc(a,b){var c=a.pendingLanes;if(0===c)return 0;var d=0,e=a.suspendedLanes,f=a.pingedLanes,g=c&268435455;if(0!==g){var h=g&~e;0!==h?d=yc(h):(f&=g,0!==f&&(d=yc(f)))}else g=c&~e,0!==g?d=yc(g):0!==f&&(d=yc(f));if(0===d)return 0;if(0!==b&&b!==d&&0===(b&e)&&(e=d&-d,f=b&-b,e>=f||16===e&&0!==(f&4194240)))return b;0!==(d&4)&&(d|=c&16);b=a.entangledLanes;if(0!==b)for(a=a.entanglements,b&=d;0<b;)c=31-tc(b),e=1<<c,d|=a[c],b&=~e;return d}
function Ac(a,b){switch(a){case 1:case 2:case 4:return b+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return b+5E3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}
function Bc(a,b){for(var c=a.suspendedLanes,d=a.pingedLanes,e=a.expirationTimes,f=a.pendingLanes;0<f;){var g=31-tc(f),h=1<<g,k=e[g];if(-1===k){if(0===(h&c)||0!==(h&d))e[g]=Ac(h,b)}else k<=b&&(a.expiredLanes|=h);f&=~h}}function Cc(a){a=a.pendingLanes&-1073741825;return 0!==a?a:a&1073741824?1073741824:0}function Dc(){var a=wc;wc<<=1;0===(wc&4194240)&&(wc=64);return a}function Ec(a){for(var b=[],c=0;31>c;c++)b.push(a);return b}
function Fc(a,b,c){a.pendingLanes|=b;536870912!==b&&(a.suspendedLanes=0,a.pingedLanes=0);a=a.eventTimes;b=31-tc(b);a[b]=c}function Gc(a,b){var c=a.pendingLanes&~b;a.pendingLanes=b;a.suspendedLanes=0;a.pingedLanes=0;a.expiredLanes&=b;a.mutableReadLanes&=b;a.entangledLanes&=b;b=a.entanglements;var d=a.eventTimes;for(a=a.expirationTimes;0<c;){var e=31-tc(c),f=1<<e;b[e]=0;d[e]=-1;a[e]=-1;c&=~f}}
function Hc(a,b){var c=a.entangledLanes|=b;for(a=a.entanglements;c;){var d=31-tc(c),e=1<<d;e&b|a[d]&b&&(a[d]|=b);c&=~e}}var C=0;function Ic(a){a&=-a;return 1<a?4<a?0!==(a&268435455)?16:536870912:4:1}var Jc=ba.unstable_scheduleCallback,Kc=ba.unstable_cancelCallback,Lc=ba.unstable_shouldYield,Mc=ba.unstable_requestPaint,D=ba.unstable_now,Nc=ba.unstable_ImmediatePriority,Oc=ba.unstable_UserBlockingPriority,Pc=ba.unstable_NormalPriority,Qc=ba.unstable_IdlePriority,Rc=null,Sc=null;
function Tc(a){if(Sc&&"function"===typeof Sc.onCommitFiberRoot)try{Sc.onCommitFiberRoot(Rc,a,void 0,128===(a.current.flags&128))}catch(b){}}function Uc(a,b){return a===b&&(0!==a||1/a===1/b)||a!==a&&b!==b}var Vc="function"===typeof Object.is?Object.is:Uc,Wc=null,Xc=!1,Yc=!1;function Zc(a){null===Wc?Wc=[a]:Wc.push(a)}function $c(a){Xc=!0;Zc(a)}
function ad(){if(!Yc&&null!==Wc){Yc=!0;var a=0,b=C;try{var c=Wc;for(C=1;a<c.length;a++){var d=c[a];do d=d(!0);while(null!==d)}Wc=null;Xc=!1}catch(e){throw null!==Wc&&(Wc=Wc.slice(a+1)),Jc(Nc,ad),e;}finally{C=b,Yc=!1}}return null}var bd=[],cd=0,dd=null,ed=0,fd=[],gd=0,hd=null,id=1,jd="";function kd(a,b){bd[cd++]=ed;bd[cd++]=dd;dd=a;ed=b}
function ld(a,b,c){fd[gd++]=id;fd[gd++]=jd;fd[gd++]=hd;hd=a;var d=id;a=jd;var e=32-tc(d)-1;d&=~(1<<e);c+=1;var f=32-tc(b)+e;if(30<f){var g=e-e%5;f=(d&(1<<g)-1).toString(32);d>>=g;e-=g;id=1<<32-tc(b)+e|c<<e|d;jd=f+a}else id=1<<f|c<<e|d,jd=a}function md(a){null!==a.return&&(kd(a,1),ld(a,1,0))}function nd(a){for(;a===dd;)dd=bd[--cd],bd[cd]=null,ed=bd[--cd],bd[cd]=null;for(;a===hd;)hd=fd[--gd],fd[gd]=null,jd=fd[--gd],fd[gd]=null,id=fd[--gd],fd[gd]=null}var od=null,pd=null,F=!1,qd=!1,rd=null;
function sd(a,b){var c=td(5,null,null,0);c.elementType="DELETED";c.stateNode=b;c.return=a;b=a.deletions;null===b?(a.deletions=[c],a.flags|=16):b.push(c)}
function ud(a,b){switch(a.tag){case 5:return b=Gb(b,a.type,a.pendingProps),null!==b?(a.stateNode=b,od=a,pd=Ob(b),!0):!1;case 6:return b=Hb(b,a.pendingProps),null!==b?(a.stateNode=b,od=a,pd=null,!0):!1;case 13:b=Ib(b);if(null!==b){var c=null!==hd?{id:id,overflow:jd}:null;a.memoizedState={dehydrated:b,treeContext:c,retryLane:1073741824};c=td(18,null,null,0);c.stateNode=b;c.return=a;a.child=c;od=a;pd=null;return!0}return!1;default:return!1}}function vd(a){return 0!==(a.mode&1)&&0===(a.flags&128)}
function wd(a){if(F){var b=pd;if(b){var c=b;if(!ud(a,b)){if(vd(a))throw Error(n(418));b=Nb(c);var d=od;b&&ud(a,b)?sd(d,c):(a.flags=a.flags&-4097|2,F=!1,od=a)}}else{if(vd(a))throw Error(n(418));a.flags=a.flags&-4097|2;F=!1;od=a}}}function xd(a){for(a=a.return;null!==a&&5!==a.tag&&3!==a.tag&&13!==a.tag;)a=a.return;od=a}
function yd(a){if(!Va||a!==od)return!1;if(!F)return xd(a),F=!0,!1;if(3!==a.tag&&(5!==a.tag||Zb(a.type)&&!Na(a.type,a.memoizedProps))){var b=pd;if(b){if(vd(a))throw zd(),Error(n(418));for(;b;)sd(a,b),b=Nb(b)}}xd(a);if(13===a.tag){if(!Va)throw Error(n(316));a=a.memoizedState;a=null!==a?a.dehydrated:null;if(!a)throw Error(n(317));pd=Ub(a)}else pd=od?Nb(a.stateNode):null;return!0}function zd(){for(var a=pd;a;)a=Nb(a)}function Ad(){Va&&(pd=od=null,qd=F=!1)}function Bd(a){null===rd?rd=[a]:rd.push(a)}
var Cd=da.ReactCurrentBatchConfig;function Dd(a,b){if(Vc(a,b))return!0;if("object"!==typeof a||null===a||"object"!==typeof b||null===b)return!1;var c=Object.keys(a),d=Object.keys(b);if(c.length!==d.length)return!1;for(d=0;d<c.length;d++){var e=c[d];if(!fc.call(b,e)||!Vc(a[e],b[e]))return!1}return!0}
function Ed(a){switch(a.tag){case 5:return cc(a.type);case 16:return cc("Lazy");case 13:return cc("Suspense");case 19:return cc("SuspenseList");case 0:case 2:case 15:return a=ec(a.type,!1),a;case 11:return a=ec(a.type.render,!1),a;case 1:return a=ec(a.type,!0),a;default:return""}}
function Fd(a,b,c){a=c.ref;if(null!==a&&"function"!==typeof a&&"object"!==typeof a){if(c._owner){c=c._owner;if(c){if(1!==c.tag)throw Error(n(309));var d=c.stateNode}if(!d)throw Error(n(147,a));var e=d,f=""+a;if(null!==b&&null!==b.ref&&"function"===typeof b.ref&&b.ref._stringRef===f)return b.ref;b=function(a){var b=e.refs;null===a?delete b[f]:b[f]=a};b._stringRef=f;return b}if("string"!==typeof a)throw Error(n(284));if(!c._owner)throw Error(n(290,a));}return a}
function Gd(a,b){a=Object.prototype.toString.call(b);throw Error(n(31,"[object Object]"===a?"object with keys {"+Object.keys(b).join(", ")+"}":a));}function Hd(a){var b=a._init;return b(a._payload)}
function Id(a){function b(b,c){if(a){var d=b.deletions;null===d?(b.deletions=[c],b.flags|=16):d.push(c)}}function c(c,d){if(!a)return null;for(;null!==d;)b(c,d),d=d.sibling;return null}function d(a,b){for(a=new Map;null!==b;)null!==b.key?a.set(b.key,b):a.set(b.index,b),b=b.sibling;return a}function e(a,b){a=Jd(a,b);a.index=0;a.sibling=null;return a}function f(b,c,d){b.index=d;if(!a)return b.flags|=1048576,c;d=b.alternate;if(null!==d)return d=d.index,d<c?(b.flags|=2,c):d;b.flags|=2;return c}function g(b){a&&
null===b.alternate&&(b.flags|=2);return b}function h(a,b,c,d){if(null===b||6!==b.tag)return b=Kd(c,a.mode,d),b.return=a,b;b=e(b,c);b.return=a;return b}function k(a,b,c,d){var f=c.type;if(f===ha)return m(a,b,c.props.children,d,c.key);if(null!==b&&(b.elementType===f||"object"===typeof f&&null!==f&&f.$$typeof===qa&&Hd(f)===b.type))return d=e(b,c.props),d.ref=Fd(a,b,c),d.return=a,d;d=Ld(c.type,c.key,c.props,null,a.mode,d);d.ref=Fd(a,b,c);d.return=a;return d}function l(a,b,c,d){if(null===b||4!==b.tag||
b.stateNode.containerInfo!==c.containerInfo||b.stateNode.implementation!==c.implementation)return b=Md(c,a.mode,d),b.return=a,b;b=e(b,c.children||[]);b.return=a;return b}function m(a,b,c,d,f){if(null===b||7!==b.tag)return b=Nd(c,a.mode,d,f),b.return=a,b;b=e(b,c);b.return=a;return b}function r(a,b,c){if("string"===typeof b&&""!==b||"number"===typeof b)return b=Kd(""+b,a.mode,c),b.return=a,b;if("object"===typeof b&&null!==b){switch(b.$$typeof){case ea:return c=Ld(b.type,b.key,b.props,null,a.mode,c),
c.ref=Fd(a,null,b),c.return=a,c;case fa:return b=Md(b,a.mode,c),b.return=a,b;case qa:var d=b._init;return r(a,d(b._payload),c)}if(Da(b)||ta(b))return b=Nd(b,a.mode,c,null),b.return=a,b;Gd(a,b)}return null}function p(a,b,c,d){var e=null!==b?b.key:null;if("string"===typeof c&&""!==c||"number"===typeof c)return null!==e?null:h(a,b,""+c,d);if("object"===typeof c&&null!==c){switch(c.$$typeof){case ea:return c.key===e?k(a,b,c,d):null;case fa:return c.key===e?l(a,b,c,d):null;case qa:return e=c._init,p(a,
b,e(c._payload),d)}if(Da(c)||ta(c))return null!==e?null:m(a,b,c,d,null);Gd(a,c)}return null}function B(a,b,c,d,e){if("string"===typeof d&&""!==d||"number"===typeof d)return a=a.get(c)||null,h(b,a,""+d,e);if("object"===typeof d&&null!==d){switch(d.$$typeof){case ea:return a=a.get(null===d.key?c:d.key)||null,k(b,a,d,e);case fa:return a=a.get(null===d.key?c:d.key)||null,l(b,a,d,e);case qa:var f=d._init;return B(a,b,c,f(d._payload),e)}if(Da(d)||ta(d))return a=a.get(c)||null,m(b,a,d,e,null);Gd(b,d)}return null}
function w(e,g,h,k){for(var l=null,m=null,u=g,t=g=0,E=null;null!==u&&t<h.length;t++){u.index>t?(E=u,u=null):E=u.sibling;var y=p(e,u,h[t],k);if(null===y){null===u&&(u=E);break}a&&u&&null===y.alternate&&b(e,u);g=f(y,g,t);null===m?l=y:m.sibling=y;m=y;u=E}if(t===h.length)return c(e,u),F&&kd(e,t),l;if(null===u){for(;t<h.length;t++)u=r(e,h[t],k),null!==u&&(g=f(u,g,t),null===m?l=u:m.sibling=u,m=u);F&&kd(e,t);return l}for(u=d(e,u);t<h.length;t++)E=B(u,e,t,h[t],k),null!==E&&(a&&null!==E.alternate&&u.delete(null===
E.key?t:E.key),g=f(E,g,t),null===m?l=E:m.sibling=E,m=E);a&&u.forEach(function(a){return b(e,a)});F&&kd(e,t);return l}function Y(e,g,h,k){var l=ta(h);if("function"!==typeof l)throw Error(n(150));h=l.call(h);if(null==h)throw Error(n(151));for(var u=l=null,m=g,t=g=0,E=null,y=h.next();null!==m&&!y.done;t++,y=h.next()){m.index>t?(E=m,m=null):E=m.sibling;var w=p(e,m,y.value,k);if(null===w){null===m&&(m=E);break}a&&m&&null===w.alternate&&b(e,m);g=f(w,g,t);null===u?l=w:u.sibling=w;u=w;m=E}if(y.done)return c(e,
m),F&&kd(e,t),l;if(null===m){for(;!y.done;t++,y=h.next())y=r(e,y.value,k),null!==y&&(g=f(y,g,t),null===u?l=y:u.sibling=y,u=y);F&&kd(e,t);return l}for(m=d(e,m);!y.done;t++,y=h.next())y=B(m,e,t,y.value,k),null!==y&&(a&&null!==y.alternate&&m.delete(null===y.key?t:y.key),g=f(y,g,t),null===u?l=y:u.sibling=y,u=y);a&&m.forEach(function(a){return b(e,a)});F&&kd(e,t);return l}function ya(a,d,f,h){"object"===typeof f&&null!==f&&f.type===ha&&null===f.key&&(f=f.props.children);if("object"===typeof f&&null!==
f){switch(f.$$typeof){case ea:a:{for(var k=f.key,l=d;null!==l;){if(l.key===k){k=f.type;if(k===ha){if(7===l.tag){c(a,l.sibling);d=e(l,f.props.children);d.return=a;a=d;break a}}else if(l.elementType===k||"object"===typeof k&&null!==k&&k.$$typeof===qa&&Hd(k)===l.type){c(a,l.sibling);d=e(l,f.props);d.ref=Fd(a,l,f);d.return=a;a=d;break a}c(a,l);break}else b(a,l);l=l.sibling}f.type===ha?(d=Nd(f.props.children,a.mode,h,f.key),d.return=a,a=d):(h=Ld(f.type,f.key,f.props,null,a.mode,h),h.ref=Fd(a,d,f),h.return=
a,a=h)}return g(a);case fa:a:{for(l=f.key;null!==d;){if(d.key===l)if(4===d.tag&&d.stateNode.containerInfo===f.containerInfo&&d.stateNode.implementation===f.implementation){c(a,d.sibling);d=e(d,f.children||[]);d.return=a;a=d;break a}else{c(a,d);break}else b(a,d);d=d.sibling}d=Md(f,a.mode,h);d.return=a;a=d}return g(a);case qa:return l=f._init,ya(a,d,l(f._payload),h)}if(Da(f))return w(a,d,f,h);if(ta(f))return Y(a,d,f,h);Gd(a,f)}return"string"===typeof f&&""!==f||"number"===typeof f?(f=""+f,null!==d&&
6===d.tag?(c(a,d.sibling),d=e(d,f),d.return=a,a=d):(c(a,d),d=Kd(f,a.mode,h),d.return=a,a=d),g(a)):c(a,d)}return ya}var Od=Id(!0),Pd=Id(!1),Qd=ic(null),Rd=null,Sd=null,Td=null;function Ud(){Td=Sd=Rd=null}function Vd(a,b,c){Sa?(v(Qd,b._currentValue),b._currentValue=c):(v(Qd,b._currentValue2),b._currentValue2=c)}function Wd(a){var b=Qd.current;q(Qd);Sa?a._currentValue=b:a._currentValue2=b}
function Xd(a,b,c){for(;null!==a;){var d=a.alternate;(a.childLanes&b)!==b?(a.childLanes|=b,null!==d&&(d.childLanes|=b)):null!==d&&(d.childLanes&b)!==b&&(d.childLanes|=b);if(a===c)break;a=a.return}}function Yd(a,b){Rd=a;Td=Sd=null;a=a.dependencies;null!==a&&null!==a.firstContext&&(0!==(a.lanes&b)&&(G=!0),a.firstContext=null)}
function Zd(a){var b=Sa?a._currentValue:a._currentValue2;if(Td!==a)if(a={context:a,memoizedValue:b,next:null},null===Sd){if(null===Rd)throw Error(n(308));Sd=a;Rd.dependencies={lanes:0,firstContext:a}}else Sd=Sd.next=a;return b}var $d=null;function ae(a){null===$d?$d=[a]:$d.push(a)}function be(a,b,c,d){var e=b.interleaved;null===e?(c.next=c,ae(b)):(c.next=e.next,e.next=c);b.interleaved=c;return ce(a,d)}
function ce(a,b){a.lanes|=b;var c=a.alternate;null!==c&&(c.lanes|=b);c=a;for(a=a.return;null!==a;)a.childLanes|=b,c=a.alternate,null!==c&&(c.childLanes|=b),c=a,a=a.return;return 3===c.tag?c.stateNode:null}var de=!1;function ee(a){a.updateQueue={baseState:a.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}
function fe(a,b){a=a.updateQueue;b.updateQueue===a&&(b.updateQueue={baseState:a.baseState,firstBaseUpdate:a.firstBaseUpdate,lastBaseUpdate:a.lastBaseUpdate,shared:a.shared,effects:a.effects})}function ge(a,b){return{eventTime:a,lane:b,tag:0,payload:null,callback:null,next:null}}
function he(a,b,c){var d=a.updateQueue;if(null===d)return null;d=d.shared;if(0!==(H&2)){var e=d.pending;null===e?b.next=b:(b.next=e.next,e.next=b);d.pending=b;return ce(a,c)}e=d.interleaved;null===e?(b.next=b,ae(d)):(b.next=e.next,e.next=b);d.interleaved=b;return ce(a,c)}function ie(a,b,c){b=b.updateQueue;if(null!==b&&(b=b.shared,0!==(c&4194240))){var d=b.lanes;d&=a.pendingLanes;c|=d;b.lanes=c;Hc(a,c)}}
function je(a,b){var c=a.updateQueue,d=a.alternate;if(null!==d&&(d=d.updateQueue,c===d)){var e=null,f=null;c=c.firstBaseUpdate;if(null!==c){do{var g={eventTime:c.eventTime,lane:c.lane,tag:c.tag,payload:c.payload,callback:c.callback,next:null};null===f?e=f=g:f=f.next=g;c=c.next}while(null!==c);null===f?e=f=b:f=f.next=b}else e=f=b;c={baseState:d.baseState,firstBaseUpdate:e,lastBaseUpdate:f,shared:d.shared,effects:d.effects};a.updateQueue=c;return}a=c.lastBaseUpdate;null===a?c.firstBaseUpdate=b:a.next=
b;c.lastBaseUpdate=b}
function ke(a,b,c,d){var e=a.updateQueue;de=!1;var f=e.firstBaseUpdate,g=e.lastBaseUpdate,h=e.shared.pending;if(null!==h){e.shared.pending=null;var k=h,l=k.next;k.next=null;null===g?f=l:g.next=l;g=k;var m=a.alternate;null!==m&&(m=m.updateQueue,h=m.lastBaseUpdate,h!==g&&(null===h?m.firstBaseUpdate=l:h.next=l,m.lastBaseUpdate=k))}if(null!==f){var r=e.baseState;g=0;m=l=k=null;h=f;do{var p=h.lane,B=h.eventTime;if((d&p)===p){null!==m&&(m=m.next={eventTime:B,lane:0,tag:h.tag,payload:h.payload,callback:h.callback,
next:null});a:{var w=a,Y=h;p=b;B=c;switch(Y.tag){case 1:w=Y.payload;if("function"===typeof w){r=w.call(B,r,p);break a}r=w;break a;case 3:w.flags=w.flags&-65537|128;case 0:w=Y.payload;p="function"===typeof w?w.call(B,r,p):w;if(null===p||void 0===p)break a;r=ca({},r,p);break a;case 2:de=!0}}null!==h.callback&&0!==h.lane&&(a.flags|=64,p=e.effects,null===p?e.effects=[h]:p.push(h))}else B={eventTime:B,lane:p,tag:h.tag,payload:h.payload,callback:h.callback,next:null},null===m?(l=m=B,k=r):m=m.next=B,g|=
p;h=h.next;if(null===h)if(h=e.shared.pending,null===h)break;else p=h,h=p.next,p.next=null,e.lastBaseUpdate=p,e.shared.pending=null}while(1);null===m&&(k=r);e.baseState=k;e.firstBaseUpdate=l;e.lastBaseUpdate=m;b=e.shared.interleaved;if(null!==b){e=b;do g|=e.lane,e=e.next;while(e!==b)}else null===f&&(e.shared.lanes=0);le|=g;a.lanes=g;a.memoizedState=r}}
function me(a,b,c){a=b.effects;b.effects=null;if(null!==a)for(b=0;b<a.length;b++){var d=a[b],e=d.callback;if(null!==e){d.callback=null;d=c;if("function"!==typeof e)throw Error(n(191,e));e.call(d)}}}var ne={},oe=ic(ne),pe=ic(ne),qe=ic(ne);function re(a){if(a===ne)throw Error(n(174));return a}function se(a,b){v(qe,b);v(pe,a);v(oe,ne);a=Fa(b);q(oe);v(oe,a)}function te(){q(oe);q(pe);q(qe)}function ue(a){var b=re(qe.current),c=re(oe.current);b=Ga(c,a.type,b);c!==b&&(v(pe,a),v(oe,b))}
function ve(a){pe.current===a&&(q(oe),q(pe))}var I=ic(0);function we(a){for(var b=a;null!==b;){if(13===b.tag){var c=b.memoizedState;if(null!==c&&(c=c.dehydrated,null===c||Jb(c)||Kb(c)))return b}else if(19===b.tag&&void 0!==b.memoizedProps.revealOrder){if(0!==(b.flags&128))return b}else if(null!==b.child){b.child.return=b;b=b.child;continue}if(b===a)break;for(;null===b.sibling;){if(null===b.return||b.return===a)return null;b=b.return}b.sibling.return=b.return;b=b.sibling}return null}var xe=[];
function ye(){for(var a=0;a<xe.length;a++){var b=xe[a];Sa?b._workInProgressVersionPrimary=null:b._workInProgressVersionSecondary=null}xe.length=0}var ze=da.ReactCurrentDispatcher,Ae=da.ReactCurrentBatchConfig,Be=0,J=null,K=null,L=null,Ce=!1,De=!1,Ee=0,Fe=0;function M(){throw Error(n(321));}function Ge(a,b){if(null===b)return!1;for(var c=0;c<b.length&&c<a.length;c++)if(!Vc(a[c],b[c]))return!1;return!0}
function He(a,b,c,d,e,f){Be=f;J=b;b.memoizedState=null;b.updateQueue=null;b.lanes=0;ze.current=null===a||null===a.memoizedState?Ie:Je;a=c(d,e);if(De){f=0;do{De=!1;Ee=0;if(25<=f)throw Error(n(301));f+=1;L=K=null;b.updateQueue=null;ze.current=Ke;a=c(d,e)}while(De)}ze.current=Le;b=null!==K&&null!==K.next;Be=0;L=K=J=null;Ce=!1;if(b)throw Error(n(300));return a}function Me(){var a=0!==Ee;Ee=0;return a}
function Ne(){var a={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};null===L?J.memoizedState=L=a:L=L.next=a;return L}function Oe(){if(null===K){var a=J.alternate;a=null!==a?a.memoizedState:null}else a=K.next;var b=null===L?J.memoizedState:L.next;if(null!==b)L=b,K=a;else{if(null===a)throw Error(n(310));K=a;a={memoizedState:K.memoizedState,baseState:K.baseState,baseQueue:K.baseQueue,queue:K.queue,next:null};null===L?J.memoizedState=L=a:L=L.next=a}return L}
function Pe(a,b){return"function"===typeof b?b(a):b}
function Qe(a){var b=Oe(),c=b.queue;if(null===c)throw Error(n(311));c.lastRenderedReducer=a;var d=K,e=d.baseQueue,f=c.pending;if(null!==f){if(null!==e){var g=e.next;e.next=f.next;f.next=g}d.baseQueue=e=f;c.pending=null}if(null!==e){f=e.next;d=d.baseState;var h=g=null,k=null,l=f;do{var m=l.lane;if((Be&m)===m)null!==k&&(k=k.next={lane:0,action:l.action,hasEagerState:l.hasEagerState,eagerState:l.eagerState,next:null}),d=l.hasEagerState?l.eagerState:a(d,l.action);else{var r={lane:m,action:l.action,hasEagerState:l.hasEagerState,
eagerState:l.eagerState,next:null};null===k?(h=k=r,g=d):k=k.next=r;J.lanes|=m;le|=m}l=l.next}while(null!==l&&l!==f);null===k?g=d:k.next=h;Vc(d,b.memoizedState)||(G=!0);b.memoizedState=d;b.baseState=g;b.baseQueue=k;c.lastRenderedState=d}a=c.interleaved;if(null!==a){e=a;do f=e.lane,J.lanes|=f,le|=f,e=e.next;while(e!==a)}else null===e&&(c.lanes=0);return[b.memoizedState,c.dispatch]}
function Re(a){var b=Oe(),c=b.queue;if(null===c)throw Error(n(311));c.lastRenderedReducer=a;var d=c.dispatch,e=c.pending,f=b.memoizedState;if(null!==e){c.pending=null;var g=e=e.next;do f=a(f,g.action),g=g.next;while(g!==e);Vc(f,b.memoizedState)||(G=!0);b.memoizedState=f;null===b.baseQueue&&(b.baseState=f);c.lastRenderedState=f}return[f,d]}function Se(){}
function Te(a,b){var c=J,d=Oe(),e=b(),f=!Vc(d.memoizedState,e);f&&(d.memoizedState=e,G=!0);d=d.queue;Ue(Ve.bind(null,c,d,a),[a]);if(d.getSnapshot!==b||f||null!==L&&L.memoizedState.tag&1){c.flags|=2048;We(9,Xe.bind(null,c,d,e,b),void 0,null);if(null===N)throw Error(n(349));0!==(Be&30)||Ye(c,b,e)}return e}function Ye(a,b,c){a.flags|=16384;a={getSnapshot:b,value:c};b=J.updateQueue;null===b?(b={lastEffect:null,stores:null},J.updateQueue=b,b.stores=[a]):(c=b.stores,null===c?b.stores=[a]:c.push(a))}
function Xe(a,b,c,d){b.value=c;b.getSnapshot=d;Ze(b)&&$e(a)}function Ve(a,b,c){return c(function(){Ze(b)&&$e(a)})}function Ze(a){var b=a.getSnapshot;a=a.value;try{var c=b();return!Vc(a,c)}catch(d){return!0}}function $e(a){var b=ce(a,1);null!==b&&af(b,a,1,-1)}
function bf(a){var b=Ne();"function"===typeof a&&(a=a());b.memoizedState=b.baseState=a;a={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Pe,lastRenderedState:a};b.queue=a;a=a.dispatch=cf.bind(null,J,a);return[b.memoizedState,a]}
function We(a,b,c,d){a={tag:a,create:b,destroy:c,deps:d,next:null};b=J.updateQueue;null===b?(b={lastEffect:null,stores:null},J.updateQueue=b,b.lastEffect=a.next=a):(c=b.lastEffect,null===c?b.lastEffect=a.next=a:(d=c.next,c.next=a,a.next=d,b.lastEffect=a));return a}function df(){return Oe().memoizedState}function ef(a,b,c,d){var e=Ne();J.flags|=a;e.memoizedState=We(1|b,c,void 0,void 0===d?null:d)}
function ff(a,b,c,d){var e=Oe();d=void 0===d?null:d;var f=void 0;if(null!==K){var g=K.memoizedState;f=g.destroy;if(null!==d&&Ge(d,g.deps)){e.memoizedState=We(b,c,f,d);return}}J.flags|=a;e.memoizedState=We(1|b,c,f,d)}function gf(a,b){return ef(8390656,8,a,b)}function Ue(a,b){return ff(2048,8,a,b)}function hf(a,b){return ff(4,2,a,b)}function jf(a,b){return ff(4,4,a,b)}
function kf(a,b){if("function"===typeof b)return a=a(),b(a),function(){b(null)};if(null!==b&&void 0!==b)return a=a(),b.current=a,function(){b.current=null}}function lf(a,b,c){c=null!==c&&void 0!==c?c.concat([a]):null;return ff(4,4,kf.bind(null,b,a),c)}function mf(){}function nf(a,b){var c=Oe();b=void 0===b?null:b;var d=c.memoizedState;if(null!==d&&null!==b&&Ge(b,d[1]))return d[0];c.memoizedState=[a,b];return a}
function of(a,b){var c=Oe();b=void 0===b?null:b;var d=c.memoizedState;if(null!==d&&null!==b&&Ge(b,d[1]))return d[0];a=a();c.memoizedState=[a,b];return a}function pf(a,b,c){if(0===(Be&21))return a.baseState&&(a.baseState=!1,G=!0),a.memoizedState=c;Vc(c,b)||(c=Dc(),J.lanes|=c,le|=c,a.baseState=!0);return b}function qf(a,b){var c=C;C=0!==c&&4>c?c:4;a(!0);var d=Ae.transition;Ae.transition={};try{a(!1),b()}finally{C=c,Ae.transition=d}}function rf(){return Oe().memoizedState}
function sf(a,b,c){var d=tf(a);c={lane:d,action:c,hasEagerState:!1,eagerState:null,next:null};if(uf(a))vf(b,c);else if(c=be(a,b,c,d),null!==c){var e=O();af(c,a,d,e);wf(c,b,d)}}
function cf(a,b,c){var d=tf(a),e={lane:d,action:c,hasEagerState:!1,eagerState:null,next:null};if(uf(a))vf(b,e);else{var f=a.alternate;if(0===a.lanes&&(null===f||0===f.lanes)&&(f=b.lastRenderedReducer,null!==f))try{var g=b.lastRenderedState,h=f(g,c);e.hasEagerState=!0;e.eagerState=h;if(Vc(h,g)){var k=b.interleaved;null===k?(e.next=e,ae(b)):(e.next=k.next,k.next=e);b.interleaved=e;return}}catch(l){}finally{}c=be(a,b,e,d);null!==c&&(e=O(),af(c,a,d,e),wf(c,b,d))}}
function uf(a){var b=a.alternate;return a===J||null!==b&&b===J}function vf(a,b){De=Ce=!0;var c=a.pending;null===c?b.next=b:(b.next=c.next,c.next=b);a.pending=b}function wf(a,b,c){if(0!==(c&4194240)){var d=b.lanes;d&=a.pendingLanes;c|=d;b.lanes=c;Hc(a,c)}}
var Le={readContext:Zd,useCallback:M,useContext:M,useEffect:M,useImperativeHandle:M,useInsertionEffect:M,useLayoutEffect:M,useMemo:M,useReducer:M,useRef:M,useState:M,useDebugValue:M,useDeferredValue:M,useTransition:M,useMutableSource:M,useSyncExternalStore:M,useId:M,unstable_isNewReconciler:!1},Ie={readContext:Zd,useCallback:function(a,b){Ne().memoizedState=[a,void 0===b?null:b];return a},useContext:Zd,useEffect:gf,useImperativeHandle:function(a,b,c){c=null!==c&&void 0!==c?c.concat([a]):null;return ef(4194308,
4,kf.bind(null,b,a),c)},useLayoutEffect:function(a,b){return ef(4194308,4,a,b)},useInsertionEffect:function(a,b){return ef(4,2,a,b)},useMemo:function(a,b){var c=Ne();b=void 0===b?null:b;a=a();c.memoizedState=[a,b];return a},useReducer:function(a,b,c){var d=Ne();b=void 0!==c?c(b):b;d.memoizedState=d.baseState=b;a={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:a,lastRenderedState:b};d.queue=a;a=a.dispatch=sf.bind(null,J,a);return[d.memoizedState,a]},useRef:function(a){var b=
Ne();a={current:a};return b.memoizedState=a},useState:bf,useDebugValue:mf,useDeferredValue:function(a){return Ne().memoizedState=a},useTransition:function(){var a=bf(!1),b=a[0];a=qf.bind(null,a[1]);Ne().memoizedState=a;return[b,a]},useMutableSource:function(){},useSyncExternalStore:function(a,b,c){var d=J,e=Ne();if(F){if(void 0===c)throw Error(n(407));c=c()}else{c=b();if(null===N)throw Error(n(349));0!==(Be&30)||Ye(d,b,c)}e.memoizedState=c;var f={value:c,getSnapshot:b};e.queue=f;gf(Ve.bind(null,d,
f,a),[a]);d.flags|=2048;We(9,Xe.bind(null,d,f,c,b),void 0,null);return c},useId:function(){var a=Ne(),b=N.identifierPrefix;if(F){var c=jd;var d=id;c=(d&~(1<<32-tc(d)-1)).toString(32)+c;b=":"+b+"R"+c;c=Ee++;0<c&&(b+="H"+c.toString(32));b+=":"}else c=Fe++,b=":"+b+"r"+c.toString(32)+":";return a.memoizedState=b},unstable_isNewReconciler:!1},Je={readContext:Zd,useCallback:nf,useContext:Zd,useEffect:Ue,useImperativeHandle:lf,useInsertionEffect:hf,useLayoutEffect:jf,useMemo:of,useReducer:Qe,useRef:df,useState:function(){return Qe(Pe)},
useDebugValue:mf,useDeferredValue:function(a){var b=Oe();return pf(b,K.memoizedState,a)},useTransition:function(){var a=Qe(Pe)[0],b=Oe().memoizedState;return[a,b]},useMutableSource:Se,useSyncExternalStore:Te,useId:rf,unstable_isNewReconciler:!1},Ke={readContext:Zd,useCallback:nf,useContext:Zd,useEffect:Ue,useImperativeHandle:lf,useInsertionEffect:hf,useLayoutEffect:jf,useMemo:of,useReducer:Re,useRef:df,useState:function(){return Re(Pe)},useDebugValue:mf,useDeferredValue:function(a){var b=Oe();return null===
K?b.memoizedState=a:pf(b,K.memoizedState,a)},useTransition:function(){var a=Re(Pe)[0],b=Oe().memoizedState;return[a,b]},useMutableSource:Se,useSyncExternalStore:Te,useId:rf,unstable_isNewReconciler:!1};function xf(a,b){if(a&&a.defaultProps){b=ca({},b);a=a.defaultProps;for(var c in a)void 0===b[c]&&(b[c]=a[c]);return b}return b}function yf(a,b,c,d){b=a.memoizedState;c=c(d,b);c=null===c||void 0===c?b:ca({},b,c);a.memoizedState=c;0===a.lanes&&(a.updateQueue.baseState=c)}
var zf={isMounted:function(a){return(a=a._reactInternals)?wa(a)===a:!1},enqueueSetState:function(a,b,c){a=a._reactInternals;var d=O(),e=tf(a),f=ge(d,e);f.payload=b;void 0!==c&&null!==c&&(f.callback=c);b=he(a,f,e);null!==b&&(af(b,a,e,d),ie(b,a,e))},enqueueReplaceState:function(a,b,c){a=a._reactInternals;var d=O(),e=tf(a),f=ge(d,e);f.tag=1;f.payload=b;void 0!==c&&null!==c&&(f.callback=c);b=he(a,f,e);null!==b&&(af(b,a,e,d),ie(b,a,e))},enqueueForceUpdate:function(a,b){a=a._reactInternals;var c=O(),d=
tf(a),e=ge(c,d);e.tag=2;void 0!==b&&null!==b&&(e.callback=b);b=he(a,e,d);null!==b&&(af(b,a,d,c),ie(b,a,d))}};function Af(a,b,c,d,e,f,g){a=a.stateNode;return"function"===typeof a.shouldComponentUpdate?a.shouldComponentUpdate(d,f,g):b.prototype&&b.prototype.isPureReactComponent?!Dd(c,d)||!Dd(e,f):!0}
function Bf(a,b,c){var d=!1,e=jc;var f=b.contextType;"object"===typeof f&&null!==f?f=Zd(f):(e=A(b)?kc:x.current,d=b.contextTypes,f=(d=null!==d&&void 0!==d)?mc(a,e):jc);b=new b(c,f);a.memoizedState=null!==b.state&&void 0!==b.state?b.state:null;b.updater=zf;a.stateNode=b;b._reactInternals=a;d&&(a=a.stateNode,a.__reactInternalMemoizedUnmaskedChildContext=e,a.__reactInternalMemoizedMaskedChildContext=f);return b}
function Cf(a,b,c,d){a=b.state;"function"===typeof b.componentWillReceiveProps&&b.componentWillReceiveProps(c,d);"function"===typeof b.UNSAFE_componentWillReceiveProps&&b.UNSAFE_componentWillReceiveProps(c,d);b.state!==a&&zf.enqueueReplaceState(b,b.state,null)}
function Df(a,b,c,d){var e=a.stateNode;e.props=c;e.state=a.memoizedState;e.refs={};ee(a);var f=b.contextType;"object"===typeof f&&null!==f?e.context=Zd(f):(f=A(b)?kc:x.current,e.context=mc(a,f));e.state=a.memoizedState;f=b.getDerivedStateFromProps;"function"===typeof f&&(yf(a,b,f,c),e.state=a.memoizedState);"function"===typeof b.getDerivedStateFromProps||"function"===typeof e.getSnapshotBeforeUpdate||"function"!==typeof e.UNSAFE_componentWillMount&&"function"!==typeof e.componentWillMount||(b=e.state,
"function"===typeof e.componentWillMount&&e.componentWillMount(),"function"===typeof e.UNSAFE_componentWillMount&&e.UNSAFE_componentWillMount(),b!==e.state&&zf.enqueueReplaceState(e,e.state,null),ke(a,c,e,d),e.state=a.memoizedState);"function"===typeof e.componentDidMount&&(a.flags|=4194308)}function Ef(a,b){try{var c="",d=b;do c+=Ed(d),d=d.return;while(d);var e=c}catch(f){e="\nError generating stack: "+f.message+"\n"+f.stack}return{value:a,source:b,stack:e,digest:null}}
function Ff(a,b,c){return{value:a,source:null,stack:null!=c?c:null,digest:null!=b?b:null}}function Gf(a,b){try{console.error(b.value)}catch(c){setTimeout(function(){throw c;})}}var Hf="function"===typeof WeakMap?WeakMap:Map;function If(a,b,c){c=ge(-1,c);c.tag=3;c.payload={element:null};var d=b.value;c.callback=function(){Jf||(Jf=!0,Kf=d);Gf(a,b)};return c}
function Lf(a,b,c){c=ge(-1,c);c.tag=3;var d=a.type.getDerivedStateFromError;if("function"===typeof d){var e=b.value;c.payload=function(){return d(e)};c.callback=function(){Gf(a,b)}}var f=a.stateNode;null!==f&&"function"===typeof f.componentDidCatch&&(c.callback=function(){Gf(a,b);"function"!==typeof d&&(null===Mf?Mf=new Set([this]):Mf.add(this));var c=b.stack;this.componentDidCatch(b.value,{componentStack:null!==c?c:""})});return c}
function Nf(a,b,c){var d=a.pingCache;if(null===d){d=a.pingCache=new Hf;var e=new Set;d.set(b,e)}else e=d.get(b),void 0===e&&(e=new Set,d.set(b,e));e.has(c)||(e.add(c),a=Of.bind(null,a,b,c),b.then(a,a))}function Pf(a){do{var b;if(b=13===a.tag)b=a.memoizedState,b=null!==b?null!==b.dehydrated?!0:!1:!0;if(b)return a;a=a.return}while(null!==a);return null}
function Qf(a,b,c,d,e){if(0===(a.mode&1))return a===b?a.flags|=65536:(a.flags|=128,c.flags|=131072,c.flags&=-52805,1===c.tag&&(null===c.alternate?c.tag=17:(b=ge(-1,1),b.tag=2,he(c,b,1))),c.lanes|=1),a;a.flags|=65536;a.lanes=e;return a}var Rf=da.ReactCurrentOwner,G=!1;function P(a,b,c,d){b.child=null===a?Pd(b,null,c,d):Od(b,a.child,c,d)}
function Sf(a,b,c,d,e){c=c.render;var f=b.ref;Yd(b,e);d=He(a,b,c,d,f,e);c=Me();if(null!==a&&!G)return b.updateQueue=a.updateQueue,b.flags&=-2053,a.lanes&=~e,Tf(a,b,e);F&&c&&md(b);b.flags|=1;P(a,b,d,e);return b.child}
function Uf(a,b,c,d,e){if(null===a){var f=c.type;if("function"===typeof f&&!Vf(f)&&void 0===f.defaultProps&&null===c.compare&&void 0===c.defaultProps)return b.tag=15,b.type=f,Wf(a,b,f,d,e);a=Ld(c.type,null,d,b,b.mode,e);a.ref=b.ref;a.return=b;return b.child=a}f=a.child;if(0===(a.lanes&e)){var g=f.memoizedProps;c=c.compare;c=null!==c?c:Dd;if(c(g,d)&&a.ref===b.ref)return Tf(a,b,e)}b.flags|=1;a=Jd(f,d);a.ref=b.ref;a.return=b;return b.child=a}
function Wf(a,b,c,d,e){if(null!==a){var f=a.memoizedProps;if(Dd(f,d)&&a.ref===b.ref)if(G=!1,b.pendingProps=d=f,0!==(a.lanes&e))0!==(a.flags&131072)&&(G=!0);else return b.lanes=a.lanes,Tf(a,b,e)}return Xf(a,b,c,d,e)}
function Yf(a,b,c){var d=b.pendingProps,e=d.children,f=null!==a?a.memoizedState:null;if("hidden"===d.mode)if(0===(b.mode&1))b.memoizedState={baseLanes:0,cachePool:null,transitions:null},v(Zf,$f),$f|=c;else{if(0===(c&1073741824))return a=null!==f?f.baseLanes|c:c,b.lanes=b.childLanes=1073741824,b.memoizedState={baseLanes:a,cachePool:null,transitions:null},b.updateQueue=null,v(Zf,$f),$f|=a,null;b.memoizedState={baseLanes:0,cachePool:null,transitions:null};d=null!==f?f.baseLanes:c;v(Zf,$f);$f|=d}else null!==
f?(d=f.baseLanes|c,b.memoizedState=null):d=c,v(Zf,$f),$f|=d;P(a,b,e,c);return b.child}function ag(a,b){var c=b.ref;if(null===a&&null!==c||null!==a&&a.ref!==c)b.flags|=512,b.flags|=2097152}function Xf(a,b,c,d,e){var f=A(c)?kc:x.current;f=mc(b,f);Yd(b,e);c=He(a,b,c,d,f,e);d=Me();if(null!==a&&!G)return b.updateQueue=a.updateQueue,b.flags&=-2053,a.lanes&=~e,Tf(a,b,e);F&&d&&md(b);b.flags|=1;P(a,b,c,e);return b.child}
function bg(a,b,c,d,e){if(A(c)){var f=!0;qc(b)}else f=!1;Yd(b,e);if(null===b.stateNode)cg(a,b),Bf(b,c,d),Df(b,c,d,e),d=!0;else if(null===a){var g=b.stateNode,h=b.memoizedProps;g.props=h;var k=g.context,l=c.contextType;"object"===typeof l&&null!==l?l=Zd(l):(l=A(c)?kc:x.current,l=mc(b,l));var m=c.getDerivedStateFromProps,r="function"===typeof m||"function"===typeof g.getSnapshotBeforeUpdate;r||"function"!==typeof g.UNSAFE_componentWillReceiveProps&&"function"!==typeof g.componentWillReceiveProps||(h!==
d||k!==l)&&Cf(b,g,d,l);de=!1;var p=b.memoizedState;g.state=p;ke(b,d,g,e);k=b.memoizedState;h!==d||p!==k||z.current||de?("function"===typeof m&&(yf(b,c,m,d),k=b.memoizedState),(h=de||Af(b,c,h,d,p,k,l))?(r||"function"!==typeof g.UNSAFE_componentWillMount&&"function"!==typeof g.componentWillMount||("function"===typeof g.componentWillMount&&g.componentWillMount(),"function"===typeof g.UNSAFE_componentWillMount&&g.UNSAFE_componentWillMount()),"function"===typeof g.componentDidMount&&(b.flags|=4194308)):
("function"===typeof g.componentDidMount&&(b.flags|=4194308),b.memoizedProps=d,b.memoizedState=k),g.props=d,g.state=k,g.context=l,d=h):("function"===typeof g.componentDidMount&&(b.flags|=4194308),d=!1)}else{g=b.stateNode;fe(a,b);h=b.memoizedProps;l=b.type===b.elementType?h:xf(b.type,h);g.props=l;r=b.pendingProps;p=g.context;k=c.contextType;"object"===typeof k&&null!==k?k=Zd(k):(k=A(c)?kc:x.current,k=mc(b,k));var B=c.getDerivedStateFromProps;(m="function"===typeof B||"function"===typeof g.getSnapshotBeforeUpdate)||
"function"!==typeof g.UNSAFE_componentWillReceiveProps&&"function"!==typeof g.componentWillReceiveProps||(h!==r||p!==k)&&Cf(b,g,d,k);de=!1;p=b.memoizedState;g.state=p;ke(b,d,g,e);var w=b.memoizedState;h!==r||p!==w||z.current||de?("function"===typeof B&&(yf(b,c,B,d),w=b.memoizedState),(l=de||Af(b,c,l,d,p,w,k)||!1)?(m||"function"!==typeof g.UNSAFE_componentWillUpdate&&"function"!==typeof g.componentWillUpdate||("function"===typeof g.componentWillUpdate&&g.componentWillUpdate(d,w,k),"function"===typeof g.UNSAFE_componentWillUpdate&&
g.UNSAFE_componentWillUpdate(d,w,k)),"function"===typeof g.componentDidUpdate&&(b.flags|=4),"function"===typeof g.getSnapshotBeforeUpdate&&(b.flags|=1024)):("function"!==typeof g.componentDidUpdate||h===a.memoizedProps&&p===a.memoizedState||(b.flags|=4),"function"!==typeof g.getSnapshotBeforeUpdate||h===a.memoizedProps&&p===a.memoizedState||(b.flags|=1024),b.memoizedProps=d,b.memoizedState=w),g.props=d,g.state=w,g.context=k,d=l):("function"!==typeof g.componentDidUpdate||h===a.memoizedProps&&p===
a.memoizedState||(b.flags|=4),"function"!==typeof g.getSnapshotBeforeUpdate||h===a.memoizedProps&&p===a.memoizedState||(b.flags|=1024),d=!1)}return dg(a,b,c,d,f,e)}
function dg(a,b,c,d,e,f){ag(a,b);var g=0!==(b.flags&128);if(!d&&!g)return e&&rc(b,c,!1),Tf(a,b,f);d=b.stateNode;Rf.current=b;var h=g&&"function"!==typeof c.getDerivedStateFromError?null:d.render();b.flags|=1;null!==a&&g?(b.child=Od(b,a.child,null,f),b.child=Od(b,null,h,f)):P(a,b,h,f);b.memoizedState=d.state;e&&rc(b,c,!0);return b.child}function eg(a){var b=a.stateNode;b.pendingContext?oc(a,b.pendingContext,b.pendingContext!==b.context):b.context&&oc(a,b.context,!1);se(a,b.containerInfo)}
function fg(a,b,c,d,e){Ad();Bd(e);b.flags|=256;P(a,b,c,d);return b.child}var gg={dehydrated:null,treeContext:null,retryLane:0};function hg(a){return{baseLanes:a,cachePool:null,transitions:null}}
function ig(a,b,c){var d=b.pendingProps,e=I.current,f=!1,g=0!==(b.flags&128),h;(h=g)||(h=null!==a&&null===a.memoizedState?!1:0!==(e&2));if(h)f=!0,b.flags&=-129;else if(null===a||null!==a.memoizedState)e|=1;v(I,e&1);if(null===a){wd(b);a=b.memoizedState;if(null!==a&&(a=a.dehydrated,null!==a))return 0===(b.mode&1)?b.lanes=1:Kb(a)?b.lanes=8:b.lanes=1073741824,null;g=d.children;a=d.fallback;return f?(d=b.mode,f=b.child,g={mode:"hidden",children:g},0===(d&1)&&null!==f?(f.childLanes=0,f.pendingProps=g):
f=jg(g,d,0,null),a=Nd(a,d,c,null),f.return=b,a.return=b,f.sibling=a,b.child=f,b.child.memoizedState=hg(c),b.memoizedState=gg,a):kg(b,g)}e=a.memoizedState;if(null!==e&&(h=e.dehydrated,null!==h))return lg(a,b,g,d,h,e,c);if(f){f=d.fallback;g=b.mode;e=a.child;h=e.sibling;var k={mode:"hidden",children:d.children};0===(g&1)&&b.child!==e?(d=b.child,d.childLanes=0,d.pendingProps=k,b.deletions=null):(d=Jd(e,k),d.subtreeFlags=e.subtreeFlags&14680064);null!==h?f=Jd(h,f):(f=Nd(f,g,c,null),f.flags|=2);f.return=
b;d.return=b;d.sibling=f;b.child=d;d=f;f=b.child;g=a.child.memoizedState;g=null===g?hg(c):{baseLanes:g.baseLanes|c,cachePool:null,transitions:g.transitions};f.memoizedState=g;f.childLanes=a.childLanes&~c;b.memoizedState=gg;return d}f=a.child;a=f.sibling;d=Jd(f,{mode:"visible",children:d.children});0===(b.mode&1)&&(d.lanes=c);d.return=b;d.sibling=null;null!==a&&(c=b.deletions,null===c?(b.deletions=[a],b.flags|=16):c.push(a));b.child=d;b.memoizedState=null;return d}
function kg(a,b){b=jg({mode:"visible",children:b},a.mode,0,null);b.return=a;return a.child=b}function mg(a,b,c,d){null!==d&&Bd(d);Od(b,a.child,null,c);a=kg(b,b.pendingProps.children);a.flags|=2;b.memoizedState=null;return a}
function lg(a,b,c,d,e,f,g){if(c){if(b.flags&256)return b.flags&=-257,d=Ff(Error(n(422))),mg(a,b,g,d);if(null!==b.memoizedState)return b.child=a.child,b.flags|=128,null;f=d.fallback;e=b.mode;d=jg({mode:"visible",children:d.children},e,0,null);f=Nd(f,e,g,null);f.flags|=2;d.return=b;f.return=b;d.sibling=f;b.child=d;0!==(b.mode&1)&&Od(b,a.child,null,g);b.child.memoizedState=hg(g);b.memoizedState=gg;return f}if(0===(b.mode&1))return mg(a,b,g,null);if(Kb(e))return d=Lb(e).digest,f=Error(n(419)),d=Ff(f,
d,void 0),mg(a,b,g,d);c=0!==(g&a.childLanes);if(G||c){d=N;if(null!==d){switch(g&-g){case 4:e=2;break;case 16:e=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:e=32;break;case 536870912:e=268435456;break;default:e=0}e=0!==(e&(d.suspendedLanes|g))?0:e;0!==e&&e!==f.retryLane&&(f.retryLane=e,ce(a,e),af(d,a,
e,-1))}ng();d=Ff(Error(n(421)));return mg(a,b,g,d)}if(Jb(e))return b.flags|=128,b.child=a.child,b=og.bind(null,a),Mb(e,b),null;a=f.treeContext;Va&&(pd=Qb(e),od=b,F=!0,rd=null,qd=!1,null!==a&&(fd[gd++]=id,fd[gd++]=jd,fd[gd++]=hd,id=a.id,jd=a.overflow,hd=b));b=kg(b,d.children);b.flags|=4096;return b}function pg(a,b,c){a.lanes|=b;var d=a.alternate;null!==d&&(d.lanes|=b);Xd(a.return,b,c)}
function qg(a,b,c,d,e){var f=a.memoizedState;null===f?a.memoizedState={isBackwards:b,rendering:null,renderingStartTime:0,last:d,tail:c,tailMode:e}:(f.isBackwards=b,f.rendering=null,f.renderingStartTime=0,f.last=d,f.tail=c,f.tailMode=e)}
function rg(a,b,c){var d=b.pendingProps,e=d.revealOrder,f=d.tail;P(a,b,d.children,c);d=I.current;if(0!==(d&2))d=d&1|2,b.flags|=128;else{if(null!==a&&0!==(a.flags&128))a:for(a=b.child;null!==a;){if(13===a.tag)null!==a.memoizedState&&pg(a,c,b);else if(19===a.tag)pg(a,c,b);else if(null!==a.child){a.child.return=a;a=a.child;continue}if(a===b)break a;for(;null===a.sibling;){if(null===a.return||a.return===b)break a;a=a.return}a.sibling.return=a.return;a=a.sibling}d&=1}v(I,d);if(0===(b.mode&1))b.memoizedState=
null;else switch(e){case "forwards":c=b.child;for(e=null;null!==c;)a=c.alternate,null!==a&&null===we(a)&&(e=c),c=c.sibling;c=e;null===c?(e=b.child,b.child=null):(e=c.sibling,c.sibling=null);qg(b,!1,e,c,f);break;case "backwards":c=null;e=b.child;for(b.child=null;null!==e;){a=e.alternate;if(null!==a&&null===we(a)){b.child=e;break}a=e.sibling;e.sibling=c;c=e;e=a}qg(b,!0,c,null,f);break;case "together":qg(b,!1,null,null,void 0);break;default:b.memoizedState=null}return b.child}
function cg(a,b){0===(b.mode&1)&&null!==a&&(a.alternate=null,b.alternate=null,b.flags|=2)}function Tf(a,b,c){null!==a&&(b.dependencies=a.dependencies);le|=b.lanes;if(0===(c&b.childLanes))return null;if(null!==a&&b.child!==a.child)throw Error(n(153));if(null!==b.child){a=b.child;c=Jd(a,a.pendingProps);b.child=c;for(c.return=b;null!==a.sibling;)a=a.sibling,c=c.sibling=Jd(a,a.pendingProps),c.return=b;c.sibling=null}return b.child}
function sg(a,b,c){switch(b.tag){case 3:eg(b);Ad();break;case 5:ue(b);break;case 1:A(b.type)&&qc(b);break;case 4:se(b,b.stateNode.containerInfo);break;case 10:Vd(b,b.type._context,b.memoizedProps.value);break;case 13:var d=b.memoizedState;if(null!==d){if(null!==d.dehydrated)return v(I,I.current&1),b.flags|=128,null;if(0!==(c&b.child.childLanes))return ig(a,b,c);v(I,I.current&1);a=Tf(a,b,c);return null!==a?a.sibling:null}v(I,I.current&1);break;case 19:d=0!==(c&b.childLanes);if(0!==(a.flags&128)){if(d)return rg(a,
b,c);b.flags|=128}var e=b.memoizedState;null!==e&&(e.rendering=null,e.tail=null,e.lastEffect=null);v(I,I.current);if(d)break;else return null;case 22:case 23:return b.lanes=0,Yf(a,b,c)}return Tf(a,b,c)}function tg(a){a.flags|=4}function ug(a,b){if(null!==a&&a.child===b.child)return!0;if(0!==(b.flags&16))return!1;for(a=b.child;null!==a;){if(0!==(a.flags&12854)||0!==(a.subtreeFlags&12854))return!1;a=a.sibling}return!0}var vg,wg,xg,yg;
if(Ta)vg=function(a,b){for(var c=b.child;null!==c;){if(5===c.tag||6===c.tag)Ka(a,c.stateNode);else if(4!==c.tag&&null!==c.child){c.child.return=c;c=c.child;continue}if(c===b)break;for(;null===c.sibling;){if(null===c.return||c.return===b)return;c=c.return}c.sibling.return=c.return;c=c.sibling}},wg=function(){},xg=function(a,b,c,d,e){a=a.memoizedProps;if(a!==d){var f=b.stateNode,g=re(oe.current);c=Ma(f,c,a,d,e,g);(b.updateQueue=c)&&tg(b)}},yg=function(a,b,c,d){c!==d&&tg(b)};else if(Ua){vg=function(a,
b,c,d){for(var e=b.child;null!==e;){if(5===e.tag){var f=e.stateNode;c&&d&&(f=Eb(f,e.type,e.memoizedProps,e));Ka(a,f)}else if(6===e.tag)f=e.stateNode,c&&d&&(f=Fb(f,e.memoizedProps,e)),Ka(a,f);else if(4!==e.tag)if(22===e.tag&&null!==e.memoizedState)f=e.child,null!==f&&(f.return=e),vg(a,e,!0,!0);else if(null!==e.child){e.child.return=e;e=e.child;continue}if(e===b)break;for(;null===e.sibling;){if(null===e.return||e.return===b)return;e=e.return}e.sibling.return=e.return;e=e.sibling}};var zg=function(a,
b,c,d){for(var e=b.child;null!==e;){if(5===e.tag){var f=e.stateNode;c&&d&&(f=Eb(f,e.type,e.memoizedProps,e));Ab(a,f)}else if(6===e.tag)f=e.stateNode,c&&d&&(f=Fb(f,e.memoizedProps,e)),Ab(a,f);else if(4!==e.tag)if(22===e.tag&&null!==e.memoizedState)f=e.child,null!==f&&(f.return=e),zg(a,e,!0,!0);else if(null!==e.child){e.child.return=e;e=e.child;continue}if(e===b)break;for(;null===e.sibling;){if(null===e.return||e.return===b)return;e=e.return}e.sibling.return=e.return;e=e.sibling}};wg=function(a,b){var c=
b.stateNode;if(!ug(a,b)){a=c.containerInfo;var d=zb(a);zg(d,b,!1,!1);c.pendingChildren=d;tg(b);Bb(a,d)}};xg=function(a,b,c,d,e){var f=a.stateNode,g=a.memoizedProps;if((a=ug(a,b))&&g===d)b.stateNode=f;else{var h=b.stateNode,k=re(oe.current),l=null;g!==d&&(l=Ma(h,c,g,d,e,k));a&&null===l?b.stateNode=f:(f=yb(f,l,c,g,d,b,a,h),La(f,c,d,e,k)&&tg(b),b.stateNode=f,a?tg(b):vg(f,b,!1,!1))}};yg=function(a,b,c,d){c!==d?(a=re(qe.current),c=re(oe.current),b.stateNode=Oa(d,a,c,b),tg(b)):b.stateNode=a.stateNode}}else wg=
function(){},xg=function(){},yg=function(){};function Ag(a,b){if(!F)switch(a.tailMode){case "hidden":b=a.tail;for(var c=null;null!==b;)null!==b.alternate&&(c=b),b=b.sibling;null===c?a.tail=null:c.sibling=null;break;case "collapsed":c=a.tail;for(var d=null;null!==c;)null!==c.alternate&&(d=c),c=c.sibling;null===d?b||null===a.tail?a.tail=null:a.tail.sibling=null:d.sibling=null}}
function Q(a){var b=null!==a.alternate&&a.alternate.child===a.child,c=0,d=0;if(b)for(var e=a.child;null!==e;)c|=e.lanes|e.childLanes,d|=e.subtreeFlags&14680064,d|=e.flags&14680064,e.return=a,e=e.sibling;else for(e=a.child;null!==e;)c|=e.lanes|e.childLanes,d|=e.subtreeFlags,d|=e.flags,e.return=a,e=e.sibling;a.subtreeFlags|=d;a.childLanes=c;return b}
function Bg(a,b,c){var d=b.pendingProps;nd(b);switch(b.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Q(b),null;case 1:return A(b.type)&&nc(),Q(b),null;case 3:c=b.stateNode;te();q(z);q(x);ye();c.pendingContext&&(c.context=c.pendingContext,c.pendingContext=null);if(null===a||null===a.child)yd(b)?tg(b):null===a||a.memoizedState.isDehydrated&&0===(b.flags&256)||(b.flags|=1024,null!==rd&&(Cg(rd),rd=null));wg(a,b);Q(b);return null;case 5:ve(b);c=re(qe.current);var e=
b.type;if(null!==a&&null!=b.stateNode)xg(a,b,e,d,c),a.ref!==b.ref&&(b.flags|=512,b.flags|=2097152);else{if(!d){if(null===b.stateNode)throw Error(n(166));Q(b);return null}a=re(oe.current);if(yd(b)){if(!Va)throw Error(n(175));a=Rb(b.stateNode,b.type,b.memoizedProps,c,a,b,!qd);b.updateQueue=a;null!==a&&tg(b)}else{var f=Ja(e,d,c,a,b);vg(f,b,!1,!1);b.stateNode=f;La(f,e,d,c,a)&&tg(b)}null!==b.ref&&(b.flags|=512,b.flags|=2097152)}Q(b);return null;case 6:if(a&&null!=b.stateNode)yg(a,b,a.memoizedProps,d);
else{if("string"!==typeof d&&null===b.stateNode)throw Error(n(166));a=re(qe.current);c=re(oe.current);if(yd(b)){if(!Va)throw Error(n(176));a=b.stateNode;c=b.memoizedProps;if(d=Sb(a,c,b,!qd))if(e=od,null!==e)switch(e.tag){case 3:$b(e.stateNode.containerInfo,a,c,0!==(e.mode&1));break;case 5:ac(e.type,e.memoizedProps,e.stateNode,a,c,0!==(e.mode&1))}d&&tg(b)}else b.stateNode=Oa(d,a,c,b)}Q(b);return null;case 13:q(I);d=b.memoizedState;if(null===a||null!==a.memoizedState&&null!==a.memoizedState.dehydrated){if(F&&
null!==pd&&0!==(b.mode&1)&&0===(b.flags&128))zd(),Ad(),b.flags|=98560,e=!1;else if(e=yd(b),null!==d&&null!==d.dehydrated){if(null===a){if(!e)throw Error(n(318));if(!Va)throw Error(n(344));e=b.memoizedState;e=null!==e?e.dehydrated:null;if(!e)throw Error(n(317));Tb(e,b)}else Ad(),0===(b.flags&128)&&(b.memoizedState=null),b.flags|=4;Q(b);e=!1}else null!==rd&&(Cg(rd),rd=null),e=!0;if(!e)return b.flags&65536?b:null}if(0!==(b.flags&128))return b.lanes=c,b;c=null!==d;c!==(null!==a&&null!==a.memoizedState)&&
c&&(b.child.flags|=8192,0!==(b.mode&1)&&(null===a||0!==(I.current&1)?0===R&&(R=3):ng()));null!==b.updateQueue&&(b.flags|=4);Q(b);return null;case 4:return te(),wg(a,b),null===a&&Xa(b.stateNode.containerInfo),Q(b),null;case 10:return Wd(b.type._context),Q(b),null;case 17:return A(b.type)&&nc(),Q(b),null;case 19:q(I);e=b.memoizedState;if(null===e)return Q(b),null;d=0!==(b.flags&128);f=e.rendering;if(null===f)if(d)Ag(e,!1);else{if(0!==R||null!==a&&0!==(a.flags&128))for(a=b.child;null!==a;){f=we(a);if(null!==
f){b.flags|=128;Ag(e,!1);a=f.updateQueue;null!==a&&(b.updateQueue=a,b.flags|=4);b.subtreeFlags=0;a=c;for(c=b.child;null!==c;)d=c,e=a,d.flags&=14680066,f=d.alternate,null===f?(d.childLanes=0,d.lanes=e,d.child=null,d.subtreeFlags=0,d.memoizedProps=null,d.memoizedState=null,d.updateQueue=null,d.dependencies=null,d.stateNode=null):(d.childLanes=f.childLanes,d.lanes=f.lanes,d.child=f.child,d.subtreeFlags=0,d.deletions=null,d.memoizedProps=f.memoizedProps,d.memoizedState=f.memoizedState,d.updateQueue=f.updateQueue,
d.type=f.type,e=f.dependencies,d.dependencies=null===e?null:{lanes:e.lanes,firstContext:e.firstContext}),c=c.sibling;v(I,I.current&1|2);return b.child}a=a.sibling}null!==e.tail&&D()>Dg&&(b.flags|=128,d=!0,Ag(e,!1),b.lanes=4194304)}else{if(!d)if(a=we(f),null!==a){if(b.flags|=128,d=!0,a=a.updateQueue,null!==a&&(b.updateQueue=a,b.flags|=4),Ag(e,!0),null===e.tail&&"hidden"===e.tailMode&&!f.alternate&&!F)return Q(b),null}else 2*D()-e.renderingStartTime>Dg&&1073741824!==c&&(b.flags|=128,d=!0,Ag(e,!1),b.lanes=
4194304);e.isBackwards?(f.sibling=b.child,b.child=f):(a=e.last,null!==a?a.sibling=f:b.child=f,e.last=f)}if(null!==e.tail)return b=e.tail,e.rendering=b,e.tail=b.sibling,e.renderingStartTime=D(),b.sibling=null,a=I.current,v(I,d?a&1|2:a&1),b;Q(b);return null;case 22:case 23:return Eg(),c=null!==b.memoizedState,null!==a&&null!==a.memoizedState!==c&&(b.flags|=8192),c&&0!==(b.mode&1)?0!==($f&1073741824)&&(Q(b),Ta&&b.subtreeFlags&6&&(b.flags|=8192)):Q(b),null;case 24:return null;case 25:return null}throw Error(n(156,
b.tag));}
function Fg(a,b){nd(b);switch(b.tag){case 1:return A(b.type)&&nc(),a=b.flags,a&65536?(b.flags=a&-65537|128,b):null;case 3:return te(),q(z),q(x),ye(),a=b.flags,0!==(a&65536)&&0===(a&128)?(b.flags=a&-65537|128,b):null;case 5:return ve(b),null;case 13:q(I);a=b.memoizedState;if(null!==a&&null!==a.dehydrated){if(null===b.alternate)throw Error(n(340));Ad()}a=b.flags;return a&65536?(b.flags=a&-65537|128,b):null;case 19:return q(I),null;case 4:return te(),null;case 10:return Wd(b.type._context),null;case 22:case 23:return Eg(),
null;case 24:return null;default:return null}}var Gg=!1,S=!1,Hg="function"===typeof WeakSet?WeakSet:Set,T=null;function Ig(a,b){var c=a.ref;if(null!==c)if("function"===typeof c)try{c(null)}catch(d){U(a,b,d)}else c.current=null}function Jg(a,b,c){try{c()}catch(d){U(a,b,d)}}var Kg=!1;
function Lg(a,b){Ha(a.containerInfo);for(T=b;null!==T;)if(a=T,b=a.child,0!==(a.subtreeFlags&1028)&&null!==b)b.return=a,T=b;else for(;null!==T;){a=T;try{var c=a.alternate;if(0!==(a.flags&1024))switch(a.tag){case 0:case 11:case 15:break;case 1:if(null!==c){var d=c.memoizedProps,e=c.memoizedState,f=a.stateNode,g=f.getSnapshotBeforeUpdate(a.elementType===a.type?d:xf(a.type,d),e);f.__reactInternalSnapshotBeforeUpdate=g}break;case 3:Ta&&xb(a.stateNode.containerInfo);break;case 5:case 6:case 4:case 17:break;
default:throw Error(n(163));}}catch(h){U(a,a.return,h)}b=a.sibling;if(null!==b){b.return=a.return;T=b;break}T=a.return}c=Kg;Kg=!1;return c}function Mg(a,b,c){var d=b.updateQueue;d=null!==d?d.lastEffect:null;if(null!==d){var e=d=d.next;do{if((e.tag&a)===a){var f=e.destroy;e.destroy=void 0;void 0!==f&&Jg(b,c,f)}e=e.next}while(e!==d)}}function Ng(a,b){b=b.updateQueue;b=null!==b?b.lastEffect:null;if(null!==b){var c=b=b.next;do{if((c.tag&a)===a){var d=c.create;c.destroy=d()}c=c.next}while(c!==b)}}
function Og(a){var b=a.ref;if(null!==b){var c=a.stateNode;switch(a.tag){case 5:a=Ea(c);break;default:a=c}"function"===typeof b?b(a):b.current=a}}function Pg(a){var b=a.alternate;null!==b&&(a.alternate=null,Pg(b));a.child=null;a.deletions=null;a.sibling=null;5===a.tag&&(b=a.stateNode,null!==b&&Za(b));a.stateNode=null;a.return=null;a.dependencies=null;a.memoizedProps=null;a.memoizedState=null;a.pendingProps=null;a.stateNode=null;a.updateQueue=null}
function Qg(a){return 5===a.tag||3===a.tag||4===a.tag}function Rg(a){a:for(;;){for(;null===a.sibling;){if(null===a.return||Qg(a.return))return null;a=a.return}a.sibling.return=a.return;for(a=a.sibling;5!==a.tag&&6!==a.tag&&18!==a.tag;){if(a.flags&2)continue a;if(null===a.child||4===a.tag)continue a;else a.child.return=a,a=a.child}if(!(a.flags&2))return a.stateNode}}
function Sg(a,b,c){var d=a.tag;if(5===d||6===d)a=a.stateNode,b?pb(c,a,b):kb(c,a);else if(4!==d&&(a=a.child,null!==a))for(Sg(a,b,c),a=a.sibling;null!==a;)Sg(a,b,c),a=a.sibling}function Tg(a,b,c){var d=a.tag;if(5===d||6===d)a=a.stateNode,b?ob(c,a,b):jb(c,a);else if(4!==d&&(a=a.child,null!==a))for(Tg(a,b,c),a=a.sibling;null!==a;)Tg(a,b,c),a=a.sibling}var V=null,Ug=!1;function Vg(a,b,c){for(c=c.child;null!==c;)Wg(a,b,c),c=c.sibling}
function Wg(a,b,c){if(Sc&&"function"===typeof Sc.onCommitFiberUnmount)try{Sc.onCommitFiberUnmount(Rc,c)}catch(h){}switch(c.tag){case 5:S||Ig(c,b);case 6:if(Ta){var d=V,e=Ug;V=null;Vg(a,b,c);V=d;Ug=e;null!==V&&(Ug?rb(V,c.stateNode):qb(V,c.stateNode))}else Vg(a,b,c);break;case 18:Ta&&null!==V&&(Ug?Yb(V,c.stateNode):Xb(V,c.stateNode));break;case 4:Ta?(d=V,e=Ug,V=c.stateNode.containerInfo,Ug=!0,Vg(a,b,c),V=d,Ug=e):(Ua&&(d=c.stateNode.containerInfo,e=zb(d),Cb(d,e)),Vg(a,b,c));break;case 0:case 11:case 14:case 15:if(!S&&
(d=c.updateQueue,null!==d&&(d=d.lastEffect,null!==d))){e=d=d.next;do{var f=e,g=f.destroy;f=f.tag;void 0!==g&&(0!==(f&2)?Jg(c,b,g):0!==(f&4)&&Jg(c,b,g));e=e.next}while(e!==d)}Vg(a,b,c);break;case 1:if(!S&&(Ig(c,b),d=c.stateNode,"function"===typeof d.componentWillUnmount))try{d.props=c.memoizedProps,d.state=c.memoizedState,d.componentWillUnmount()}catch(h){U(c,b,h)}Vg(a,b,c);break;case 21:Vg(a,b,c);break;case 22:c.mode&1?(S=(d=S)||null!==c.memoizedState,Vg(a,b,c),S=d):Vg(a,b,c);break;default:Vg(a,b,
c)}}function Xg(a){var b=a.updateQueue;if(null!==b){a.updateQueue=null;var c=a.stateNode;null===c&&(c=a.stateNode=new Hg);b.forEach(function(b){var d=Yg.bind(null,a,b);c.has(b)||(c.add(b),b.then(d,d))})}}
function Zg(a,b){var c=b.deletions;if(null!==c)for(var d=0;d<c.length;d++){var e=c[d];try{var f=a,g=b;if(Ta){var h=g;a:for(;null!==h;){switch(h.tag){case 5:V=h.stateNode;Ug=!1;break a;case 3:V=h.stateNode.containerInfo;Ug=!0;break a;case 4:V=h.stateNode.containerInfo;Ug=!0;break a}h=h.return}if(null===V)throw Error(n(160));Wg(f,g,e);V=null;Ug=!1}else Wg(f,g,e);var k=e.alternate;null!==k&&(k.return=null);e.return=null}catch(l){U(e,b,l)}}if(b.subtreeFlags&12854)for(b=b.child;null!==b;)$g(b,a),b=b.sibling}
function $g(a,b){var c=a.alternate,d=a.flags;switch(a.tag){case 0:case 11:case 14:case 15:Zg(b,a);ah(a);if(d&4){try{Mg(3,a,a.return),Ng(3,a)}catch(p){U(a,a.return,p)}try{Mg(5,a,a.return)}catch(p){U(a,a.return,p)}}break;case 1:Zg(b,a);ah(a);d&512&&null!==c&&Ig(c,c.return);break;case 5:Zg(b,a);ah(a);d&512&&null!==c&&Ig(c,c.return);if(Ta){if(a.flags&32){var e=a.stateNode;try{sb(e)}catch(p){U(a,a.return,p)}}if(d&4&&(e=a.stateNode,null!=e)){var f=a.memoizedProps;c=null!==c?c.memoizedProps:f;d=a.type;b=
a.updateQueue;a.updateQueue=null;if(null!==b)try{nb(e,b,d,c,f,a)}catch(p){U(a,a.return,p)}}}break;case 6:Zg(b,a);ah(a);if(d&4&&Ta){if(null===a.stateNode)throw Error(n(162));e=a.stateNode;f=a.memoizedProps;c=null!==c?c.memoizedProps:f;try{lb(e,c,f)}catch(p){U(a,a.return,p)}}break;case 3:Zg(b,a);ah(a);if(d&4){if(Ta&&Va&&null!==c&&c.memoizedState.isDehydrated)try{Vb(b.containerInfo)}catch(p){U(a,a.return,p)}if(Ua){e=b.containerInfo;f=b.pendingChildren;try{Cb(e,f)}catch(p){U(a,a.return,p)}}}break;case 4:Zg(b,
a);ah(a);if(d&4&&Ua){f=a.stateNode;e=f.containerInfo;f=f.pendingChildren;try{Cb(e,f)}catch(p){U(a,a.return,p)}}break;case 13:Zg(b,a);ah(a);e=a.child;e.flags&8192&&(f=null!==e.memoizedState,e.stateNode.isHidden=f,!f||null!==e.alternate&&null!==e.alternate.memoizedState||(bh=D()));d&4&&Xg(a);break;case 22:var g=null!==c&&null!==c.memoizedState;a.mode&1?(S=(c=S)||g,Zg(b,a),S=c):Zg(b,a);ah(a);if(d&8192){c=null!==a.memoizedState;if((a.stateNode.isHidden=c)&&!g&&0!==(a.mode&1))for(T=a,d=a.child;null!==
d;){for(b=T=d;null!==T;){g=T;var h=g.child;switch(g.tag){case 0:case 11:case 14:case 15:Mg(4,g,g.return);break;case 1:Ig(g,g.return);var k=g.stateNode;if("function"===typeof k.componentWillUnmount){var l=g,m=g.return;try{var r=l;k.props=r.memoizedProps;k.state=r.memoizedState;k.componentWillUnmount()}catch(p){U(l,m,p)}}break;case 5:Ig(g,g.return);break;case 22:if(null!==g.memoizedState){ch(b);continue}}null!==h?(h.return=g,T=h):ch(b)}d=d.sibling}if(Ta)a:if(d=null,Ta)for(b=a;;){if(5===b.tag){if(null===
d){d=b;try{e=b.stateNode,c?tb(e):vb(b.stateNode,b.memoizedProps)}catch(p){U(a,a.return,p)}}}else if(6===b.tag){if(null===d)try{f=b.stateNode,c?ub(f):wb(f,b.memoizedProps)}catch(p){U(a,a.return,p)}}else if((22!==b.tag&&23!==b.tag||null===b.memoizedState||b===a)&&null!==b.child){b.child.return=b;b=b.child;continue}if(b===a)break a;for(;null===b.sibling;){if(null===b.return||b.return===a)break a;d===b&&(d=null);b=b.return}d===b&&(d=null);b.sibling.return=b.return;b=b.sibling}}break;case 19:Zg(b,a);ah(a);
d&4&&Xg(a);break;case 21:break;default:Zg(b,a),ah(a)}}function ah(a){var b=a.flags;if(b&2){try{if(Ta){b:{for(var c=a.return;null!==c;){if(Qg(c)){var d=c;break b}c=c.return}throw Error(n(160));}switch(d.tag){case 5:var e=d.stateNode;d.flags&32&&(sb(e),d.flags&=-33);var f=Rg(a);Tg(a,f,e);break;case 3:case 4:var g=d.stateNode.containerInfo,h=Rg(a);Sg(a,h,g);break;default:throw Error(n(161));}}}catch(k){U(a,a.return,k)}a.flags&=-3}b&4096&&(a.flags&=-4097)}function dh(a,b,c){T=a;eh(a,b,c)}
function eh(a,b,c){for(var d=0!==(a.mode&1);null!==T;){var e=T,f=e.child;if(22===e.tag&&d){var g=null!==e.memoizedState||Gg;if(!g){var h=e.alternate,k=null!==h&&null!==h.memoizedState||S;h=Gg;var l=S;Gg=g;if((S=k)&&!l)for(T=e;null!==T;)g=T,k=g.child,22===g.tag&&null!==g.memoizedState?fh(e):null!==k?(k.return=g,T=k):fh(e);for(;null!==f;)T=f,eh(f,b,c),f=f.sibling;T=e;Gg=h;S=l}gh(a,b,c)}else 0!==(e.subtreeFlags&8772)&&null!==f?(f.return=e,T=f):gh(a,b,c)}}
function gh(a){for(;null!==T;){var b=T;if(0!==(b.flags&8772)){var c=b.alternate;try{if(0!==(b.flags&8772))switch(b.tag){case 0:case 11:case 15:S||Ng(5,b);break;case 1:var d=b.stateNode;if(b.flags&4&&!S)if(null===c)d.componentDidMount();else{var e=b.elementType===b.type?c.memoizedProps:xf(b.type,c.memoizedProps);d.componentDidUpdate(e,c.memoizedState,d.__reactInternalSnapshotBeforeUpdate)}var f=b.updateQueue;null!==f&&me(b,f,d);break;case 3:var g=b.updateQueue;if(null!==g){c=null;if(null!==b.child)switch(b.child.tag){case 5:c=
Ea(b.child.stateNode);break;case 1:c=b.child.stateNode}me(b,g,c)}break;case 5:var h=b.stateNode;null===c&&b.flags&4&&mb(h,b.type,b.memoizedProps,b);break;case 6:break;case 4:break;case 12:break;case 13:if(Va&&null===b.memoizedState){var k=b.alternate;if(null!==k){var l=k.memoizedState;if(null!==l){var m=l.dehydrated;null!==m&&Wb(m)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(n(163));}S||b.flags&512&&Og(b)}catch(r){U(b,b.return,r)}}if(b===a){T=null;break}c=b.sibling;
if(null!==c){c.return=b.return;T=c;break}T=b.return}}function ch(a){for(;null!==T;){var b=T;if(b===a){T=null;break}var c=b.sibling;if(null!==c){c.return=b.return;T=c;break}T=b.return}}
function fh(a){for(;null!==T;){var b=T;try{switch(b.tag){case 0:case 11:case 15:var c=b.return;try{Ng(4,b)}catch(k){U(b,c,k)}break;case 1:var d=b.stateNode;if("function"===typeof d.componentDidMount){var e=b.return;try{d.componentDidMount()}catch(k){U(b,e,k)}}var f=b.return;try{Og(b)}catch(k){U(b,f,k)}break;case 5:var g=b.return;try{Og(b)}catch(k){U(b,g,k)}}}catch(k){U(b,b.return,k)}if(b===a){T=null;break}var h=b.sibling;if(null!==h){h.return=b.return;T=h;break}T=b.return}}
var hh=0,ih=1,jh=2,kh=3,lh=4;if("function"===typeof Symbol&&Symbol.for){var mh=Symbol.for;hh=mh("selector.component");ih=mh("selector.has_pseudo_class");jh=mh("selector.role");kh=mh("selector.test_id");lh=mh("selector.text")}function nh(a){var b=Wa(a);if(null!=b){if("string"!==typeof b.memoizedProps["data-testname"])throw Error(n(364));return b}a=cb(a);if(null===a)throw Error(n(362));return a.stateNode.current}
function oh(a,b){switch(b.$$typeof){case hh:if(a.type===b.value)return!0;break;case ih:a:{b=b.value;a=[a,0];for(var c=0;c<a.length;){var d=a[c++],e=a[c++],f=b[e];if(5!==d.tag||!fb(d)){for(;null!=f&&oh(d,f);)e++,f=b[e];if(e===b.length){b=!0;break a}else for(d=d.child;null!==d;)a.push(d,e),d=d.sibling}}b=!1}return b;case jh:if(5===a.tag&&gb(a.stateNode,b.value))return!0;break;case lh:if(5===a.tag||6===a.tag)if(a=eb(a),null!==a&&0<=a.indexOf(b.value))return!0;break;case kh:if(5===a.tag&&(a=a.memoizedProps["data-testname"],
"string"===typeof a&&a.toLowerCase()===b.value.toLowerCase()))return!0;break;default:throw Error(n(365));}return!1}function ph(a){switch(a.$$typeof){case hh:return"<"+(ua(a.value)||"Unknown")+">";case ih:return":has("+(ph(a)||"")+")";case jh:return'[role="'+a.value+'"]';case lh:return'"'+a.value+'"';case kh:return'[data-testname="'+a.value+'"]';default:throw Error(n(365));}}
function qh(a,b){var c=[];a=[a,0];for(var d=0;d<a.length;){var e=a[d++],f=a[d++],g=b[f];if(5!==e.tag||!fb(e)){for(;null!=g&&oh(e,g);)f++,g=b[f];if(f===b.length)c.push(e);else for(e=e.child;null!==e;)a.push(e,f),e=e.sibling}}return c}function rh(a,b){if(!bb)throw Error(n(363));a=nh(a);a=qh(a,b);b=[];a=Array.from(a);for(var c=0;c<a.length;){var d=a[c++];if(5===d.tag)fb(d)||b.push(d.stateNode);else for(d=d.child;null!==d;)a.push(d),d=d.sibling}return b}
var sh=Math.ceil,th=da.ReactCurrentDispatcher,uh=da.ReactCurrentOwner,W=da.ReactCurrentBatchConfig,H=0,N=null,X=null,Z=0,$f=0,Zf=ic(0),R=0,vh=null,le=0,wh=0,xh=0,yh=null,zh=null,bh=0,Dg=Infinity,Ah=null;function Bh(){Dg=D()+500}var Jf=!1,Kf=null,Mf=null,Ch=!1,Dh=null,Eh=0,Fh=0,Gh=null,Hh=-1,Ih=0;function O(){return 0!==(H&6)?D():-1!==Hh?Hh:Hh=D()}function tf(a){if(0===(a.mode&1))return 1;if(0!==(H&2)&&0!==Z)return Z&-Z;if(null!==Cd.transition)return 0===Ih&&(Ih=Dc()),Ih;a=C;return 0!==a?a:Ya()}
function af(a,b,c,d){if(50<Fh)throw Fh=0,Gh=null,Error(n(185));Fc(a,c,d);if(0===(H&2)||a!==N)a===N&&(0===(H&2)&&(wh|=c),4===R&&Jh(a,Z)),Kh(a,d),1===c&&0===H&&0===(b.mode&1)&&(Bh(),Xc&&ad())}
function Kh(a,b){var c=a.callbackNode;Bc(a,b);var d=zc(a,a===N?Z:0);if(0===d)null!==c&&Kc(c),a.callbackNode=null,a.callbackPriority=0;else if(b=d&-d,a.callbackPriority!==b){null!=c&&Kc(c);if(1===b)0===a.tag?$c(Lh.bind(null,a)):Zc(Lh.bind(null,a)),$a?ab(function(){0===(H&6)&&ad()}):Jc(Nc,ad),c=null;else{switch(Ic(d)){case 1:c=Nc;break;case 4:c=Oc;break;case 16:c=Pc;break;case 536870912:c=Qc;break;default:c=Pc}c=Mh(c,Nh.bind(null,a))}a.callbackPriority=b;a.callbackNode=c}}
function Nh(a,b){Hh=-1;Ih=0;if(0!==(H&6))throw Error(n(327));var c=a.callbackNode;if(Oh()&&a.callbackNode!==c)return null;var d=zc(a,a===N?Z:0);if(0===d)return null;if(0!==(d&30)||0!==(d&a.expiredLanes)||b)b=Ph(a,d);else{b=d;var e=H;H|=2;var f=Qh();if(N!==a||Z!==b)Ah=null,Bh(),Rh(a,b);do try{Sh();break}catch(h){Th(a,h)}while(1);Ud();th.current=f;H=e;null!==X?b=0:(N=null,Z=0,b=R)}if(0!==b){2===b&&(e=Cc(a),0!==e&&(d=e,b=Uh(a,e)));if(1===b)throw c=vh,Rh(a,0),Jh(a,d),Kh(a,D()),c;if(6===b)Jh(a,d);else{e=
a.current.alternate;if(0===(d&30)&&!Vh(e)&&(b=Ph(a,d),2===b&&(f=Cc(a),0!==f&&(d=f,b=Uh(a,f))),1===b))throw c=vh,Rh(a,0),Jh(a,d),Kh(a,D()),c;a.finishedWork=e;a.finishedLanes=d;switch(b){case 0:case 1:throw Error(n(345));case 2:Wh(a,zh,Ah);break;case 3:Jh(a,d);if((d&130023424)===d&&(b=bh+500-D(),10<b)){if(0!==zc(a,0))break;e=a.suspendedLanes;if((e&d)!==d){O();a.pingedLanes|=a.suspendedLanes&e;break}a.timeoutHandle=Pa(Wh.bind(null,a,zh,Ah),b);break}Wh(a,zh,Ah);break;case 4:Jh(a,d);if((d&4194240)===d)break;
b=a.eventTimes;for(e=-1;0<d;){var g=31-tc(d);f=1<<g;g=b[g];g>e&&(e=g);d&=~f}d=e;d=D()-d;d=(120>d?120:480>d?480:1080>d?1080:1920>d?1920:3E3>d?3E3:4320>d?4320:1960*sh(d/1960))-d;if(10<d){a.timeoutHandle=Pa(Wh.bind(null,a,zh,Ah),d);break}Wh(a,zh,Ah);break;case 5:Wh(a,zh,Ah);break;default:throw Error(n(329));}}}Kh(a,D());return a.callbackNode===c?Nh.bind(null,a):null}
function Uh(a,b){var c=yh;a.current.memoizedState.isDehydrated&&(Rh(a,b).flags|=256);a=Ph(a,b);2!==a&&(b=zh,zh=c,null!==b&&Cg(b));return a}function Cg(a){null===zh?zh=a:zh.push.apply(zh,a)}
function Vh(a){for(var b=a;;){if(b.flags&16384){var c=b.updateQueue;if(null!==c&&(c=c.stores,null!==c))for(var d=0;d<c.length;d++){var e=c[d],f=e.getSnapshot;e=e.value;try{if(!Vc(f(),e))return!1}catch(g){return!1}}}c=b.child;if(b.subtreeFlags&16384&&null!==c)c.return=b,b=c;else{if(b===a)break;for(;null===b.sibling;){if(null===b.return||b.return===a)return!0;b=b.return}b.sibling.return=b.return;b=b.sibling}}return!0}
function Jh(a,b){b&=~xh;b&=~wh;a.suspendedLanes|=b;a.pingedLanes&=~b;for(a=a.expirationTimes;0<b;){var c=31-tc(b),d=1<<c;a[c]=-1;b&=~d}}function Lh(a){if(0!==(H&6))throw Error(n(327));Oh();var b=zc(a,0);if(0===(b&1))return Kh(a,D()),null;var c=Ph(a,b);if(0!==a.tag&&2===c){var d=Cc(a);0!==d&&(b=d,c=Uh(a,d))}if(1===c)throw c=vh,Rh(a,0),Jh(a,b),Kh(a,D()),c;if(6===c)throw Error(n(345));a.finishedWork=a.current.alternate;a.finishedLanes=b;Wh(a,zh,Ah);Kh(a,D());return null}
function Xh(a){null!==Dh&&0===Dh.tag&&0===(H&6)&&Oh();var b=H;H|=1;var c=W.transition,d=C;try{if(W.transition=null,C=1,a)return a()}finally{C=d,W.transition=c,H=b,0===(H&6)&&ad()}}function Eg(){$f=Zf.current;q(Zf)}
function Rh(a,b){a.finishedWork=null;a.finishedLanes=0;var c=a.timeoutHandle;c!==Ra&&(a.timeoutHandle=Ra,Qa(c));if(null!==X)for(c=X.return;null!==c;){var d=c;nd(d);switch(d.tag){case 1:d=d.type.childContextTypes;null!==d&&void 0!==d&&nc();break;case 3:te();q(z);q(x);ye();break;case 5:ve(d);break;case 4:te();break;case 13:q(I);break;case 19:q(I);break;case 10:Wd(d.type._context);break;case 22:case 23:Eg()}c=c.return}N=a;X=a=Jd(a.current,null);Z=$f=b;R=0;vh=null;xh=wh=le=0;zh=yh=null;if(null!==$d){for(b=
0;b<$d.length;b++)if(c=$d[b],d=c.interleaved,null!==d){c.interleaved=null;var e=d.next,f=c.pending;if(null!==f){var g=f.next;f.next=e;d.next=g}c.pending=d}$d=null}return a}
function Th(a,b){do{var c=X;try{Ud();ze.current=Le;if(Ce){for(var d=J.memoizedState;null!==d;){var e=d.queue;null!==e&&(e.pending=null);d=d.next}Ce=!1}Be=0;L=K=J=null;De=!1;Ee=0;uh.current=null;if(null===c||null===c.return){R=1;vh=b;X=null;break}a:{var f=a,g=c.return,h=c,k=b;b=Z;h.flags|=32768;if(null!==k&&"object"===typeof k&&"function"===typeof k.then){var l=k,m=h,r=m.tag;if(0===(m.mode&1)&&(0===r||11===r||15===r)){var p=m.alternate;p?(m.updateQueue=p.updateQueue,m.memoizedState=p.memoizedState,
m.lanes=p.lanes):(m.updateQueue=null,m.memoizedState=null)}var B=Pf(g);if(null!==B){B.flags&=-257;Qf(B,g,h,f,b);B.mode&1&&Nf(f,l,b);b=B;k=l;var w=b.updateQueue;if(null===w){var Y=new Set;Y.add(k);b.updateQueue=Y}else w.add(k);break a}else{if(0===(b&1)){Nf(f,l,b);ng();break a}k=Error(n(426))}}else if(F&&h.mode&1){var ya=Pf(g);if(null!==ya){0===(ya.flags&65536)&&(ya.flags|=256);Qf(ya,g,h,f,b);Bd(Ef(k,h));break a}}f=k=Ef(k,h);4!==R&&(R=2);null===yh?yh=[f]:yh.push(f);f=g;do{switch(f.tag){case 3:f.flags|=
65536;b&=-b;f.lanes|=b;var E=If(f,k,b);je(f,E);break a;case 1:h=k;var u=f.type,t=f.stateNode;if(0===(f.flags&128)&&("function"===typeof u.getDerivedStateFromError||null!==t&&"function"===typeof t.componentDidCatch&&(null===Mf||!Mf.has(t)))){f.flags|=65536;b&=-b;f.lanes|=b;var Db=Lf(f,h,b);je(f,Db);break a}}f=f.return}while(null!==f)}Yh(c)}catch(lc){b=lc;X===c&&null!==c&&(X=c=c.return);continue}break}while(1)}function Qh(){var a=th.current;th.current=Le;return null===a?Le:a}
function ng(){if(0===R||3===R||2===R)R=4;null===N||0===(le&268435455)&&0===(wh&268435455)||Jh(N,Z)}function Ph(a,b){var c=H;H|=2;var d=Qh();if(N!==a||Z!==b)Ah=null,Rh(a,b);do try{Zh();break}catch(e){Th(a,e)}while(1);Ud();H=c;th.current=d;if(null!==X)throw Error(n(261));N=null;Z=0;return R}function Zh(){for(;null!==X;)$h(X)}function Sh(){for(;null!==X&&!Lc();)$h(X)}function $h(a){var b=ai(a.alternate,a,$f);a.memoizedProps=a.pendingProps;null===b?Yh(a):X=b;uh.current=null}
function Yh(a){var b=a;do{var c=b.alternate;a=b.return;if(0===(b.flags&32768)){if(c=Bg(c,b,$f),null!==c){X=c;return}}else{c=Fg(c,b);if(null!==c){c.flags&=32767;X=c;return}if(null!==a)a.flags|=32768,a.subtreeFlags=0,a.deletions=null;else{R=6;X=null;return}}b=b.sibling;if(null!==b){X=b;return}X=b=a}while(null!==b);0===R&&(R=5)}function Wh(a,b,c){var d=C,e=W.transition;try{W.transition=null,C=1,bi(a,b,c,d)}finally{W.transition=e,C=d}return null}
function bi(a,b,c,d){do Oh();while(null!==Dh);if(0!==(H&6))throw Error(n(327));c=a.finishedWork;var e=a.finishedLanes;if(null===c)return null;a.finishedWork=null;a.finishedLanes=0;if(c===a.current)throw Error(n(177));a.callbackNode=null;a.callbackPriority=0;var f=c.lanes|c.childLanes;Gc(a,f);a===N&&(X=N=null,Z=0);0===(c.subtreeFlags&2064)&&0===(c.flags&2064)||Ch||(Ch=!0,Mh(Pc,function(){Oh();return null}));f=0!==(c.flags&15990);if(0!==(c.subtreeFlags&15990)||f){f=W.transition;W.transition=null;var g=
C;C=1;var h=H;H|=4;uh.current=null;Lg(a,c);$g(c,a);Ia(a.containerInfo);a.current=c;dh(c,a,e);Mc();H=h;C=g;W.transition=f}else a.current=c;Ch&&(Ch=!1,Dh=a,Eh=e);f=a.pendingLanes;0===f&&(Mf=null);Tc(c.stateNode,d);Kh(a,D());if(null!==b)for(d=a.onRecoverableError,c=0;c<b.length;c++)e=b[c],d(e.value,{componentStack:e.stack,digest:e.digest});if(Jf)throw Jf=!1,a=Kf,Kf=null,a;0!==(Eh&1)&&0!==a.tag&&Oh();f=a.pendingLanes;0!==(f&1)?a===Gh?Fh++:(Fh=0,Gh=a):Fh=0;ad();return null}
function Oh(){if(null!==Dh){var a=Ic(Eh),b=W.transition,c=C;try{W.transition=null;C=16>a?16:a;if(null===Dh)var d=!1;else{a=Dh;Dh=null;Eh=0;if(0!==(H&6))throw Error(n(331));var e=H;H|=4;for(T=a.current;null!==T;){var f=T,g=f.child;if(0!==(T.flags&16)){var h=f.deletions;if(null!==h){for(var k=0;k<h.length;k++){var l=h[k];for(T=l;null!==T;){var m=T;switch(m.tag){case 0:case 11:case 15:Mg(8,m,f)}var r=m.child;if(null!==r)r.return=m,T=r;else for(;null!==T;){m=T;var p=m.sibling,B=m.return;Pg(m);if(m===
l){T=null;break}if(null!==p){p.return=B;T=p;break}T=B}}}var w=f.alternate;if(null!==w){var Y=w.child;if(null!==Y){w.child=null;do{var ya=Y.sibling;Y.sibling=null;Y=ya}while(null!==Y)}}T=f}}if(0!==(f.subtreeFlags&2064)&&null!==g)g.return=f,T=g;else b:for(;null!==T;){f=T;if(0!==(f.flags&2048))switch(f.tag){case 0:case 11:case 15:Mg(9,f,f.return)}var E=f.sibling;if(null!==E){E.return=f.return;T=E;break b}T=f.return}}var u=a.current;for(T=u;null!==T;){g=T;var t=g.child;if(0!==(g.subtreeFlags&2064)&&null!==
t)t.return=g,T=t;else b:for(g=u;null!==T;){h=T;if(0!==(h.flags&2048))try{switch(h.tag){case 0:case 11:case 15:Ng(9,h)}}catch(lc){U(h,h.return,lc)}if(h===g){T=null;break b}var Db=h.sibling;if(null!==Db){Db.return=h.return;T=Db;break b}T=h.return}}H=e;ad();if(Sc&&"function"===typeof Sc.onPostCommitFiberRoot)try{Sc.onPostCommitFiberRoot(Rc,a)}catch(lc){}d=!0}return d}finally{C=c,W.transition=b}}return!1}function ci(a,b,c){b=Ef(c,b);b=If(a,b,1);a=he(a,b,1);b=O();null!==a&&(Fc(a,1,b),Kh(a,b))}
function U(a,b,c){if(3===a.tag)ci(a,a,c);else for(;null!==b;){if(3===b.tag){ci(b,a,c);break}else if(1===b.tag){var d=b.stateNode;if("function"===typeof b.type.getDerivedStateFromError||"function"===typeof d.componentDidCatch&&(null===Mf||!Mf.has(d))){a=Ef(c,a);a=Lf(b,a,1);b=he(b,a,1);a=O();null!==b&&(Fc(b,1,a),Kh(b,a));break}}b=b.return}}
function Of(a,b,c){var d=a.pingCache;null!==d&&d.delete(b);b=O();a.pingedLanes|=a.suspendedLanes&c;N===a&&(Z&c)===c&&(4===R||3===R&&(Z&130023424)===Z&&500>D()-bh?Rh(a,0):xh|=c);Kh(a,b)}function di(a,b){0===b&&(0===(a.mode&1)?b=1:(b=xc,xc<<=1,0===(xc&130023424)&&(xc=4194304)));var c=O();a=ce(a,b);null!==a&&(Fc(a,b,c),Kh(a,c))}function og(a){var b=a.memoizedState,c=0;null!==b&&(c=b.retryLane);di(a,c)}
function Yg(a,b){var c=0;switch(a.tag){case 13:var d=a.stateNode;var e=a.memoizedState;null!==e&&(c=e.retryLane);break;case 19:d=a.stateNode;break;default:throw Error(n(314));}null!==d&&d.delete(b);di(a,c)}var ai;
ai=function(a,b,c){if(null!==a)if(a.memoizedProps!==b.pendingProps||z.current)G=!0;else{if(0===(a.lanes&c)&&0===(b.flags&128))return G=!1,sg(a,b,c);G=0!==(a.flags&131072)?!0:!1}else G=!1,F&&0!==(b.flags&1048576)&&ld(b,ed,b.index);b.lanes=0;switch(b.tag){case 2:var d=b.type;cg(a,b);a=b.pendingProps;var e=mc(b,x.current);Yd(b,c);e=He(null,b,d,a,e,c);var f=Me();b.flags|=1;"object"===typeof e&&null!==e&&"function"===typeof e.render&&void 0===e.$$typeof?(b.tag=1,b.memoizedState=null,b.updateQueue=null,
A(d)?(f=!0,qc(b)):f=!1,b.memoizedState=null!==e.state&&void 0!==e.state?e.state:null,ee(b),e.updater=zf,b.stateNode=e,e._reactInternals=b,Df(b,d,a,c),b=dg(null,b,d,!0,f,c)):(b.tag=0,F&&f&&md(b),P(null,b,e,c),b=b.child);return b;case 16:d=b.elementType;a:{cg(a,b);a=b.pendingProps;e=d._init;d=e(d._payload);b.type=d;e=b.tag=ei(d);a=xf(d,a);switch(e){case 0:b=Xf(null,b,d,a,c);break a;case 1:b=bg(null,b,d,a,c);break a;case 11:b=Sf(null,b,d,a,c);break a;case 14:b=Uf(null,b,d,xf(d.type,a),c);break a}throw Error(n(306,
d,""));}return b;case 0:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:xf(d,e),Xf(a,b,d,e,c);case 1:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:xf(d,e),bg(a,b,d,e,c);case 3:a:{eg(b);if(null===a)throw Error(n(387));d=b.pendingProps;f=b.memoizedState;e=f.element;fe(a,b);ke(b,d,null,c);var g=b.memoizedState;d=g.element;if(Va&&f.isDehydrated)if(f={element:d,isDehydrated:!1,cache:g.cache,pendingSuspenseBoundaries:g.pendingSuspenseBoundaries,transitions:g.transitions},b.updateQueue.baseState=
f,b.memoizedState=f,b.flags&256){e=Ef(Error(n(423)),b);b=fg(a,b,d,c,e);break a}else if(d!==e){e=Ef(Error(n(424)),b);b=fg(a,b,d,c,e);break a}else for(Va&&(pd=Pb(b.stateNode.containerInfo),od=b,F=!0,rd=null,qd=!1),c=Pd(b,null,d,c),b.child=c;c;)c.flags=c.flags&-3|4096,c=c.sibling;else{Ad();if(d===e){b=Tf(a,b,c);break a}P(a,b,d,c)}b=b.child}return b;case 5:return ue(b),null===a&&wd(b),d=b.type,e=b.pendingProps,f=null!==a?a.memoizedProps:null,g=e.children,Na(d,e)?g=null:null!==f&&Na(d,f)&&(b.flags|=32),
ag(a,b),P(a,b,g,c),b.child;case 6:return null===a&&wd(b),null;case 13:return ig(a,b,c);case 4:return se(b,b.stateNode.containerInfo),d=b.pendingProps,null===a?b.child=Od(b,null,d,c):P(a,b,d,c),b.child;case 11:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:xf(d,e),Sf(a,b,d,e,c);case 7:return P(a,b,b.pendingProps,c),b.child;case 8:return P(a,b,b.pendingProps.children,c),b.child;case 12:return P(a,b,b.pendingProps.children,c),b.child;case 10:a:{d=b.type._context;e=b.pendingProps;f=b.memoizedProps;
g=e.value;Vd(b,d,g);if(null!==f)if(Vc(f.value,g)){if(f.children===e.children&&!z.current){b=Tf(a,b,c);break a}}else for(f=b.child,null!==f&&(f.return=b);null!==f;){var h=f.dependencies;if(null!==h){g=f.child;for(var k=h.firstContext;null!==k;){if(k.context===d){if(1===f.tag){k=ge(-1,c&-c);k.tag=2;var l=f.updateQueue;if(null!==l){l=l.shared;var m=l.pending;null===m?k.next=k:(k.next=m.next,m.next=k);l.pending=k}}f.lanes|=c;k=f.alternate;null!==k&&(k.lanes|=c);Xd(f.return,c,b);h.lanes|=c;break}k=k.next}}else if(10===
f.tag)g=f.type===b.type?null:f.child;else if(18===f.tag){g=f.return;if(null===g)throw Error(n(341));g.lanes|=c;h=g.alternate;null!==h&&(h.lanes|=c);Xd(g,c,b);g=f.sibling}else g=f.child;if(null!==g)g.return=f;else for(g=f;null!==g;){if(g===b){g=null;break}f=g.sibling;if(null!==f){f.return=g.return;g=f;break}g=g.return}f=g}P(a,b,e.children,c);b=b.child}return b;case 9:return e=b.type,d=b.pendingProps.children,Yd(b,c),e=Zd(e),d=d(e),b.flags|=1,P(a,b,d,c),b.child;case 14:return d=b.type,e=xf(d,b.pendingProps),
e=xf(d.type,e),Uf(a,b,d,e,c);case 15:return Wf(a,b,b.type,b.pendingProps,c);case 17:return d=b.type,e=b.pendingProps,e=b.elementType===d?e:xf(d,e),cg(a,b),b.tag=1,A(d)?(a=!0,qc(b)):a=!1,Yd(b,c),Bf(b,d,e),Df(b,d,e,c),dg(null,b,d,!0,a,c);case 19:return rg(a,b,c);case 22:return Yf(a,b,c)}throw Error(n(156,b.tag));};function Mh(a,b){return Jc(a,b)}
function fi(a,b,c,d){this.tag=a;this.key=c;this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null;this.index=0;this.ref=null;this.pendingProps=b;this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null;this.mode=d;this.subtreeFlags=this.flags=0;this.deletions=null;this.childLanes=this.lanes=0;this.alternate=null}function td(a,b,c,d){return new fi(a,b,c,d)}function Vf(a){a=a.prototype;return!(!a||!a.isReactComponent)}
function ei(a){if("function"===typeof a)return Vf(a)?1:0;if(void 0!==a&&null!==a){a=a.$$typeof;if(a===ma)return 11;if(a===pa)return 14}return 2}
function Jd(a,b){var c=a.alternate;null===c?(c=td(a.tag,b,a.key,a.mode),c.elementType=a.elementType,c.type=a.type,c.stateNode=a.stateNode,c.alternate=a,a.alternate=c):(c.pendingProps=b,c.type=a.type,c.flags=0,c.subtreeFlags=0,c.deletions=null);c.flags=a.flags&14680064;c.childLanes=a.childLanes;c.lanes=a.lanes;c.child=a.child;c.memoizedProps=a.memoizedProps;c.memoizedState=a.memoizedState;c.updateQueue=a.updateQueue;b=a.dependencies;c.dependencies=null===b?null:{lanes:b.lanes,firstContext:b.firstContext};
c.sibling=a.sibling;c.index=a.index;c.ref=a.ref;return c}
function Ld(a,b,c,d,e,f){var g=2;d=a;if("function"===typeof a)Vf(a)&&(g=1);else if("string"===typeof a)g=5;else a:switch(a){case ha:return Nd(c.children,e,f,b);case ia:g=8;e|=8;break;case ja:return a=td(12,c,b,e|2),a.elementType=ja,a.lanes=f,a;case na:return a=td(13,c,b,e),a.elementType=na,a.lanes=f,a;case oa:return a=td(19,c,b,e),a.elementType=oa,a.lanes=f,a;case ra:return jg(c,e,f,b);default:if("object"===typeof a&&null!==a)switch(a.$$typeof){case ka:g=10;break a;case la:g=9;break a;case ma:g=11;
break a;case pa:g=14;break a;case qa:g=16;d=null;break a}throw Error(n(130,null==a?a:typeof a,""));}b=td(g,c,b,e);b.elementType=a;b.type=d;b.lanes=f;return b}function Nd(a,b,c,d){a=td(7,a,d,b);a.lanes=c;return a}function jg(a,b,c,d){a=td(22,a,d,b);a.elementType=ra;a.lanes=c;a.stateNode={isHidden:!1};return a}function Kd(a,b,c){a=td(6,a,null,b);a.lanes=c;return a}
function Md(a,b,c){b=td(4,null!==a.children?a.children:[],a.key,b);b.lanes=c;b.stateNode={containerInfo:a.containerInfo,pendingChildren:null,implementation:a.implementation};return b}
function gi(a,b,c,d,e){this.tag=b;this.containerInfo=a;this.finishedWork=this.pingCache=this.current=this.pendingChildren=null;this.timeoutHandle=Ra;this.callbackNode=this.pendingContext=this.context=null;this.callbackPriority=0;this.eventTimes=Ec(0);this.expirationTimes=Ec(-1);this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0;this.entanglements=Ec(0);this.identifierPrefix=d;this.onRecoverableError=e;Va&&(this.mutableSourceEagerHydrationData=
null)}function hi(a,b,c,d,e,f,g,h,k){a=new gi(a,b,c,h,k);1===b?(b=1,!0===f&&(b|=8)):b=0;f=td(3,null,null,b);a.current=f;f.stateNode=a;f.memoizedState={element:d,isDehydrated:c,cache:null,transitions:null,pendingSuspenseBoundaries:null};ee(f);return a}
function ii(a){if(!a)return jc;a=a._reactInternals;a:{if(wa(a)!==a||1!==a.tag)throw Error(n(170));var b=a;do{switch(b.tag){case 3:b=b.stateNode.context;break a;case 1:if(A(b.type)){b=b.stateNode.__reactInternalMemoizedMergedChildContext;break a}}b=b.return}while(null!==b);throw Error(n(171));}if(1===a.tag){var c=a.type;if(A(c))return pc(a,c,b)}return b}
function ji(a){var b=a._reactInternals;if(void 0===b){if("function"===typeof a.render)throw Error(n(188));a=Object.keys(a).join(",");throw Error(n(268,a));}a=Aa(b);return null===a?null:a.stateNode}function ki(a,b){a=a.memoizedState;if(null!==a&&null!==a.dehydrated){var c=a.retryLane;a.retryLane=0!==c&&c<b?c:b}}function li(a,b){ki(a,b);(a=a.alternate)&&ki(a,b)}function mi(a){a=Aa(a);return null===a?null:a.stateNode}function ni(){return null}
exports.attemptContinuousHydration=function(a){if(13===a.tag){var b=ce(a,134217728);if(null!==b){var c=O();af(b,a,134217728,c)}li(a,134217728)}};exports.attemptDiscreteHydration=function(a){if(13===a.tag){var b=ce(a,1);if(null!==b){var c=O();af(b,a,1,c)}li(a,1)}};exports.attemptHydrationAtCurrentPriority=function(a){if(13===a.tag){var b=tf(a),c=ce(a,b);if(null!==c){var d=O();af(c,a,b,d)}li(a,b)}};
exports.attemptSynchronousHydration=function(a){switch(a.tag){case 3:var b=a.stateNode;if(b.current.memoizedState.isDehydrated){var c=yc(b.pendingLanes);0!==c&&(Hc(b,c|1),Kh(b,D()),0===(H&6)&&(Bh(),ad()))}break;case 13:Xh(function(){var b=ce(a,1);if(null!==b){var c=O();af(b,a,1,c)}}),li(a,1)}};exports.batchedUpdates=function(a,b){var c=H;H|=1;try{return a(b)}finally{H=c,0===H&&(Bh(),Xc&&ad())}};exports.createComponentSelector=function(a){return{$$typeof:hh,value:a}};
exports.createContainer=function(a,b,c,d,e,f,g){return hi(a,b,!1,null,c,d,e,f,g)};exports.createHasPseudoClassSelector=function(a){return{$$typeof:ih,value:a}};exports.createHydrationContainer=function(a,b,c,d,e,f,g,h,k){a=hi(c,d,!0,a,e,f,g,h,k);a.context=ii(null);c=a.current;d=O();e=tf(c);f=ge(d,e);f.callback=void 0!==b&&null!==b?b:null;he(c,f,e);a.current.lanes=e;Fc(a,e,d);Kh(a,d);return a};
exports.createPortal=function(a,b,c){var d=3<arguments.length&&void 0!==arguments[3]?arguments[3]:null;return{$$typeof:fa,key:null==d?null:""+d,children:a,containerInfo:b,implementation:c}};exports.createRoleSelector=function(a){return{$$typeof:jh,value:a}};exports.createTestNameSelector=function(a){return{$$typeof:kh,value:a}};exports.createTextSelector=function(a){return{$$typeof:lh,value:a}};
exports.deferredUpdates=function(a){var b=C,c=W.transition;try{return W.transition=null,C=16,a()}finally{C=b,W.transition=c}};exports.discreteUpdates=function(a,b,c,d,e){var f=C,g=W.transition;try{return W.transition=null,C=1,a(b,c,d,e)}finally{C=f,W.transition=g,0===H&&Bh()}};exports.findAllNodes=rh;
exports.findBoundingRects=function(a,b){if(!bb)throw Error(n(363));b=rh(a,b);a=[];for(var c=0;c<b.length;c++)a.push(db(b[c]));for(b=a.length-1;0<b;b--){c=a[b];for(var d=c.x,e=d+c.width,f=c.y,g=f+c.height,h=b-1;0<=h;h--)if(b!==h){var k=a[h],l=k.x,m=l+k.width,r=k.y,p=r+k.height;if(d>=l&&f>=r&&e<=m&&g<=p){a.splice(b,1);break}else if(!(d!==l||c.width!==k.width||p<f||r>g)){r>f&&(k.height+=r-f,k.y=f);p<g&&(k.height=g-r);a.splice(b,1);break}else if(!(f!==r||c.height!==k.height||m<d||l>e)){l>d&&(k.width+=
l-d,k.x=d);m<e&&(k.width=e-l);a.splice(b,1);break}}}return a};exports.findHostInstance=ji;exports.findHostInstanceWithNoPortals=function(a){a=za(a);a=null!==a?Ca(a):null;return null===a?null:a.stateNode};exports.findHostInstanceWithWarning=function(a){return ji(a)};exports.flushControlled=function(a){var b=H;H|=1;var c=W.transition,d=C;try{W.transition=null,C=1,a()}finally{C=d,W.transition=c,H=b,0===H&&(Bh(),ad())}};exports.flushPassiveEffects=Oh;exports.flushSync=Xh;
exports.focusWithin=function(a,b){if(!bb)throw Error(n(363));a=nh(a);b=qh(a,b);b=Array.from(b);for(a=0;a<b.length;){var c=b[a++];if(!fb(c)){if(5===c.tag&&hb(c.stateNode))return!0;for(c=c.child;null!==c;)b.push(c),c=c.sibling}}return!1};exports.getCurrentUpdatePriority=function(){return C};
exports.getFindAllNodesFailureDescription=function(a,b){if(!bb)throw Error(n(363));var c=0,d=[];a=[nh(a),0];for(var e=0;e<a.length;){var f=a[e++],g=a[e++],h=b[g];if(5!==f.tag||!fb(f))if(oh(f,h)&&(d.push(ph(h)),g++,g>c&&(c=g)),g<b.length)for(f=f.child;null!==f;)a.push(f,g),f=f.sibling}if(c<b.length){for(a=[];c<b.length;c++)a.push(ph(b[c]));return"findAllNodes was able to match part of the selector:\n  "+(d.join(" > ")+"\n\nNo matching component was found for:\n  ")+a.join(" > ")}return null};
exports.getPublicRootInstance=function(a){a=a.current;if(!a.child)return null;switch(a.child.tag){case 5:return Ea(a.child.stateNode);default:return a.child.stateNode}};
exports.injectIntoDevTools=function(a){a={bundleType:a.bundleType,version:a.version,rendererPackageName:a.rendererPackageName,rendererConfig:a.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:da.ReactCurrentDispatcher,findHostInstanceByFiber:mi,findFiberByHostInstance:a.findFiberByHostInstance||
ni,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1"};if("undefined"===typeof __REACT_DEVTOOLS_GLOBAL_HOOK__)a=!1;else{var b=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(b.isDisabled||!b.supportsFiber)a=!0;else{try{Rc=b.inject(a),Sc=b}catch(c){}a=b.checkDCE?!0:!1}}return a};exports.isAlreadyRendering=function(){return!1};
exports.observeVisibleRects=function(a,b,c,d){if(!bb)throw Error(n(363));a=rh(a,b);var e=ib(a,c,d).disconnect;return{disconnect:function(){e()}}};exports.registerMutableSourceForHydration=function(a,b){var c=b._getVersion;c=c(b._source);null==a.mutableSourceEagerHydrationData?a.mutableSourceEagerHydrationData=[b,c]:a.mutableSourceEagerHydrationData.push(b,c)};exports.runWithPriority=function(a,b){var c=C;try{return C=a,b()}finally{C=c}};exports.shouldError=function(){return null};
exports.shouldSuspend=function(){return!1};exports.updateContainer=function(a,b,c,d){var e=b.current,f=O(),g=tf(e);c=ii(c);null===b.context?b.context=c:b.pendingContext=c;b=ge(f,g);b.payload={element:a};d=void 0===d?null:d;null!==d&&(b.callback=d);a=he(e,b,g);null!==a&&(af(a,e,g,f),ie(a,e,g));return g};

    return exports;
};


/***/ },

/***/ 772
(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(735);
} else // removed by dead control flow
{}


/***/ },

/***/ 4845
(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(2935);
} else // removed by dead control flow
{}


/***/ },

/***/ 1020
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var f=__webpack_require__(6540),k=Symbol.for("react.element"),l=Symbol.for("react.fragment"),m=Object.prototype.hasOwnProperty,n=f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,p={key:!0,ref:!0,__self:!0,__source:!0};
function q(c,a,g){var b,d={},e=null,h=null;void 0!==g&&(e=""+g);void 0!==a.key&&(e=""+a.key);void 0!==a.ref&&(h=a.ref);for(b in a)m.call(a,b)&&!p.hasOwnProperty(b)&&(d[b]=a[b]);if(c&&c.defaultProps)for(b in a=c.defaultProps,a)void 0===d[b]&&(d[b]=a[b]);return{$$typeof:k,type:c,key:e,ref:h,props:d,_owner:n.current}}exports.Fragment=l;exports.jsx=q;exports.jsxs=q;


/***/ },

/***/ 5287
(__unused_webpack_module, exports) {

"use strict";
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var l=Symbol.for("react.element"),n=Symbol.for("react.portal"),p=Symbol.for("react.fragment"),q=Symbol.for("react.strict_mode"),r=Symbol.for("react.profiler"),t=Symbol.for("react.provider"),u=Symbol.for("react.context"),v=Symbol.for("react.forward_ref"),w=Symbol.for("react.suspense"),x=Symbol.for("react.memo"),y=Symbol.for("react.lazy"),z=Symbol.iterator;function A(a){if(null===a||"object"!==typeof a)return null;a=z&&a[z]||a["@@iterator"];return"function"===typeof a?a:null}
var B={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},C=Object.assign,D={};function E(a,b,e){this.props=a;this.context=b;this.refs=D;this.updater=e||B}E.prototype.isReactComponent={};
E.prototype.setState=function(a,b){if("object"!==typeof a&&"function"!==typeof a&&null!=a)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,a,b,"setState")};E.prototype.forceUpdate=function(a){this.updater.enqueueForceUpdate(this,a,"forceUpdate")};function F(){}F.prototype=E.prototype;function G(a,b,e){this.props=a;this.context=b;this.refs=D;this.updater=e||B}var H=G.prototype=new F;
H.constructor=G;C(H,E.prototype);H.isPureReactComponent=!0;var I=Array.isArray,J=Object.prototype.hasOwnProperty,K={current:null},L={key:!0,ref:!0,__self:!0,__source:!0};
function M(a,b,e){var d,c={},k=null,h=null;if(null!=b)for(d in void 0!==b.ref&&(h=b.ref),void 0!==b.key&&(k=""+b.key),b)J.call(b,d)&&!L.hasOwnProperty(d)&&(c[d]=b[d]);var g=arguments.length-2;if(1===g)c.children=e;else if(1<g){for(var f=Array(g),m=0;m<g;m++)f[m]=arguments[m+2];c.children=f}if(a&&a.defaultProps)for(d in g=a.defaultProps,g)void 0===c[d]&&(c[d]=g[d]);return{$$typeof:l,type:a,key:k,ref:h,props:c,_owner:K.current}}
function N(a,b){return{$$typeof:l,type:a.type,key:b,ref:a.ref,props:a.props,_owner:a._owner}}function O(a){return"object"===typeof a&&null!==a&&a.$$typeof===l}function escape(a){var b={"=":"=0",":":"=2"};return"$"+a.replace(/[=:]/g,function(a){return b[a]})}var P=/\/+/g;function Q(a,b){return"object"===typeof a&&null!==a&&null!=a.key?escape(""+a.key):b.toString(36)}
function R(a,b,e,d,c){var k=typeof a;if("undefined"===k||"boolean"===k)a=null;var h=!1;if(null===a)h=!0;else switch(k){case "string":case "number":h=!0;break;case "object":switch(a.$$typeof){case l:case n:h=!0}}if(h)return h=a,c=c(h),a=""===d?"."+Q(h,0):d,I(c)?(e="",null!=a&&(e=a.replace(P,"$&/")+"/"),R(c,b,e,"",function(a){return a})):null!=c&&(O(c)&&(c=N(c,e+(!c.key||h&&h.key===c.key?"":(""+c.key).replace(P,"$&/")+"/")+a)),b.push(c)),1;h=0;d=""===d?".":d+":";if(I(a))for(var g=0;g<a.length;g++){k=
a[g];var f=d+Q(k,g);h+=R(k,b,e,f,c)}else if(f=A(a),"function"===typeof f)for(a=f.call(a),g=0;!(k=a.next()).done;)k=k.value,f=d+Q(k,g++),h+=R(k,b,e,f,c);else if("object"===k)throw b=String(a),Error("Objects are not valid as a React child (found: "+("[object Object]"===b?"object with keys {"+Object.keys(a).join(", ")+"}":b)+"). If you meant to render a collection of children, use an array instead.");return h}
function S(a,b,e){if(null==a)return a;var d=[],c=0;R(a,d,"","",function(a){return b.call(e,a,c++)});return d}function T(a){if(-1===a._status){var b=a._result;b=b();b.then(function(b){if(0===a._status||-1===a._status)a._status=1,a._result=b},function(b){if(0===a._status||-1===a._status)a._status=2,a._result=b});-1===a._status&&(a._status=0,a._result=b)}if(1===a._status)return a._result.default;throw a._result;}
var U={current:null},V={transition:null},W={ReactCurrentDispatcher:U,ReactCurrentBatchConfig:V,ReactCurrentOwner:K};function X(){throw Error("act(...) is not supported in production builds of React.");}
exports.Children={map:S,forEach:function(a,b,e){S(a,function(){b.apply(this,arguments)},e)},count:function(a){var b=0;S(a,function(){b++});return b},toArray:function(a){return S(a,function(a){return a})||[]},only:function(a){if(!O(a))throw Error("React.Children.only expected to receive a single React element child.");return a}};exports.Component=E;exports.Fragment=p;exports.Profiler=r;exports.PureComponent=G;exports.StrictMode=q;exports.Suspense=w;
exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=W;exports.act=X;
exports.cloneElement=function(a,b,e){if(null===a||void 0===a)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+a+".");var d=C({},a.props),c=a.key,k=a.ref,h=a._owner;if(null!=b){void 0!==b.ref&&(k=b.ref,h=K.current);void 0!==b.key&&(c=""+b.key);if(a.type&&a.type.defaultProps)var g=a.type.defaultProps;for(f in b)J.call(b,f)&&!L.hasOwnProperty(f)&&(d[f]=void 0===b[f]&&void 0!==g?g[f]:b[f])}var f=arguments.length-2;if(1===f)d.children=e;else if(1<f){g=Array(f);
for(var m=0;m<f;m++)g[m]=arguments[m+2];d.children=g}return{$$typeof:l,type:a.type,key:c,ref:k,props:d,_owner:h}};exports.createContext=function(a){a={$$typeof:u,_currentValue:a,_currentValue2:a,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null};a.Provider={$$typeof:t,_context:a};return a.Consumer=a};exports.createElement=M;exports.createFactory=function(a){var b=M.bind(null,a);b.type=a;return b};exports.createRef=function(){return{current:null}};
exports.forwardRef=function(a){return{$$typeof:v,render:a}};exports.isValidElement=O;exports.lazy=function(a){return{$$typeof:y,_payload:{_status:-1,_result:a},_init:T}};exports.memo=function(a,b){return{$$typeof:x,type:a,compare:void 0===b?null:b}};exports.startTransition=function(a){var b=V.transition;V.transition={};try{a()}finally{V.transition=b}};exports.unstable_act=X;exports.useCallback=function(a,b){return U.current.useCallback(a,b)};exports.useContext=function(a){return U.current.useContext(a)};
exports.useDebugValue=function(){};exports.useDeferredValue=function(a){return U.current.useDeferredValue(a)};exports.useEffect=function(a,b){return U.current.useEffect(a,b)};exports.useId=function(){return U.current.useId()};exports.useImperativeHandle=function(a,b,e){return U.current.useImperativeHandle(a,b,e)};exports.useInsertionEffect=function(a,b){return U.current.useInsertionEffect(a,b)};exports.useLayoutEffect=function(a,b){return U.current.useLayoutEffect(a,b)};
exports.useMemo=function(a,b){return U.current.useMemo(a,b)};exports.useReducer=function(a,b,e){return U.current.useReducer(a,b,e)};exports.useRef=function(a){return U.current.useRef(a)};exports.useState=function(a){return U.current.useState(a)};exports.useSyncExternalStore=function(a,b,e){return U.current.useSyncExternalStore(a,b,e)};exports.useTransition=function(){return U.current.useTransition()};exports.version="18.3.1";


/***/ },

/***/ 6540
(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(5287);
} else // removed by dead control flow
{}


/***/ },

/***/ 4848
(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(1020);
} else // removed by dead control flow
{}


/***/ },

/***/ 7463
(__unused_webpack_module, exports) {

"use strict";
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
function f(a,b){var c=a.length;a.push(b);a:for(;0<c;){var d=c-1>>>1,e=a[d];if(0<g(e,b))a[d]=b,a[c]=e,c=d;else break a}}function h(a){return 0===a.length?null:a[0]}function k(a){if(0===a.length)return null;var b=a[0],c=a.pop();if(c!==b){a[0]=c;a:for(var d=0,e=a.length,w=e>>>1;d<w;){var m=2*(d+1)-1,C=a[m],n=m+1,x=a[n];if(0>g(C,c))n<e&&0>g(x,C)?(a[d]=x,a[n]=c,d=n):(a[d]=C,a[m]=c,d=m);else if(n<e&&0>g(x,c))a[d]=x,a[n]=c,d=n;else break a}}return b}
function g(a,b){var c=a.sortIndex-b.sortIndex;return 0!==c?c:a.id-b.id}if("object"===typeof performance&&"function"===typeof performance.now){var l=performance;exports.unstable_now=function(){return l.now()}}else{var p=Date,q=p.now();exports.unstable_now=function(){return p.now()-q}}var r=[],t=[],u=1,v=null,y=3,z=!1,A=!1,B=!1,D="function"===typeof setTimeout?setTimeout:null,E="function"===typeof clearTimeout?clearTimeout:null,F="undefined"!==typeof setImmediate?setImmediate:null;
"undefined"!==typeof navigator&&void 0!==navigator.scheduling&&void 0!==navigator.scheduling.isInputPending&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function G(a){for(var b=h(t);null!==b;){if(null===b.callback)k(t);else if(b.startTime<=a)k(t),b.sortIndex=b.expirationTime,f(r,b);else break;b=h(t)}}function H(a){B=!1;G(a);if(!A)if(null!==h(r))A=!0,I(J);else{var b=h(t);null!==b&&K(H,b.startTime-a)}}
function J(a,b){A=!1;B&&(B=!1,E(L),L=-1);z=!0;var c=y;try{G(b);for(v=h(r);null!==v&&(!(v.expirationTime>b)||a&&!M());){var d=v.callback;if("function"===typeof d){v.callback=null;y=v.priorityLevel;var e=d(v.expirationTime<=b);b=exports.unstable_now();"function"===typeof e?v.callback=e:v===h(r)&&k(r);G(b)}else k(r);v=h(r)}if(null!==v)var w=!0;else{var m=h(t);null!==m&&K(H,m.startTime-b);w=!1}return w}finally{v=null,y=c,z=!1}}var N=!1,O=null,L=-1,P=5,Q=-1;
function M(){return exports.unstable_now()-Q<P?!1:!0}function R(){if(null!==O){var a=exports.unstable_now();Q=a;var b=!0;try{b=O(!0,a)}finally{b?S():(N=!1,O=null)}}else N=!1}var S;if("function"===typeof F)S=function(){F(R)};else if("undefined"!==typeof MessageChannel){var T=new MessageChannel,U=T.port2;T.port1.onmessage=R;S=function(){U.postMessage(null)}}else S=function(){D(R,0)};function I(a){O=a;N||(N=!0,S())}function K(a,b){L=D(function(){a(exports.unstable_now())},b)}
exports.unstable_IdlePriority=5;exports.unstable_ImmediatePriority=1;exports.unstable_LowPriority=4;exports.unstable_NormalPriority=3;exports.unstable_Profiling=null;exports.unstable_UserBlockingPriority=2;exports.unstable_cancelCallback=function(a){a.callback=null};exports.unstable_continueExecution=function(){A||z||(A=!0,I(J))};
exports.unstable_forceFrameRate=function(a){0>a||125<a?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):P=0<a?Math.floor(1E3/a):5};exports.unstable_getCurrentPriorityLevel=function(){return y};exports.unstable_getFirstCallbackNode=function(){return h(r)};exports.unstable_next=function(a){switch(y){case 1:case 2:case 3:var b=3;break;default:b=y}var c=y;y=b;try{return a()}finally{y=c}};exports.unstable_pauseExecution=function(){};
exports.unstable_requestPaint=function(){};exports.unstable_runWithPriority=function(a,b){switch(a){case 1:case 2:case 3:case 4:case 5:break;default:a=3}var c=y;y=a;try{return b()}finally{y=c}};
exports.unstable_scheduleCallback=function(a,b,c){var d=exports.unstable_now();"object"===typeof c&&null!==c?(c=c.delay,c="number"===typeof c&&0<c?d+c:d):c=d;switch(a){case 1:var e=-1;break;case 2:e=250;break;case 5:e=1073741823;break;case 4:e=1E4;break;default:e=5E3}e=c+e;a={id:u++,callback:b,priorityLevel:a,startTime:c,expirationTime:e,sortIndex:-1};c>d?(a.sortIndex=c,f(t,a),null===h(r)&&a===h(t)&&(B?(E(L),L=-1):B=!0,K(H,c-d))):(a.sortIndex=e,f(r,a),A||z||(A=!0,I(J)));return a};
exports.unstable_shouldYield=M;exports.unstable_wrapCallback=function(a){var b=y;return function(){var c=y;y=b;try{return a.apply(this,arguments)}finally{y=c}}};


/***/ },

/***/ 9982
(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


if (true) {
  module.exports = __webpack_require__(7463);
} else // removed by dead control flow
{}


/***/ },

/***/ 182
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
__webpack_unused_export__ = exports.validate = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = exports.v4 = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = __webpack_unused_export__ = void 0;
var max_js_1 = __webpack_require__(2196);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return max_js_1.default; } });
var nil_js_1 = __webpack_require__(3465);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return nil_js_1.default; } });
var parse_js_1 = __webpack_require__(1797);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return parse_js_1.default; } });
var stringify_js_1 = __webpack_require__(6011);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return stringify_js_1.default; } });
var v1_js_1 = __webpack_require__(1425);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v1_js_1.default; } });
var v1ToV6_js_1 = __webpack_require__(6568);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v1ToV6_js_1.default; } });
var v3_js_1 = __webpack_require__(591);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v3_js_1.default; } });
var v4_js_1 = __webpack_require__(8286);
Object.defineProperty(exports, "v4", ({ enumerable: true, get: function () { return v4_js_1.default; } }));
var v5_js_1 = __webpack_require__(4557);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v5_js_1.default; } });
var v6_js_1 = __webpack_require__(6356);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v6_js_1.default; } });
var v6ToV1_js_1 = __webpack_require__(268);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v6ToV1_js_1.default; } });
var v7_js_1 = __webpack_require__(4299);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return v7_js_1.default; } });
var validate_js_1 = __webpack_require__(9746);
Object.defineProperty(exports, "validate", ({ enumerable: true, get: function () { return validate_js_1.default; } }));
var version_js_1 = __webpack_require__(2770);
__webpack_unused_export__ = ({ enumerable: true, get: function () { return version_js_1.default; } });


/***/ },

/***/ 2196
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports["default"] = 'ffffffff-ffff-ffff-ffff-ffffffffffff';


/***/ },

/***/ 338
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
function md5(bytes) {
    const words = uint8ToUint32(bytes);
    const md5Bytes = wordsToMd5(words, bytes.length * 8);
    return uint32ToUint8(md5Bytes);
}
function uint32ToUint8(input) {
    const bytes = new Uint8Array(input.length * 4);
    for (let i = 0; i < input.length * 4; i++) {
        bytes[i] = (input[i >> 2] >>> ((i % 4) * 8)) & 0xff;
    }
    return bytes;
}
function getOutputLength(inputLength8) {
    return (((inputLength8 + 64) >>> 9) << 4) + 14 + 1;
}
function wordsToMd5(x, len) {
    const xpad = new Uint32Array(getOutputLength(len)).fill(0);
    xpad.set(x);
    xpad[len >> 5] |= 0x80 << len % 32;
    xpad[xpad.length - 1] = len;
    x = xpad;
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
    return Uint32Array.of(a, b, c, d);
}
function uint8ToUint32(input) {
    if (input.length === 0) {
        return new Uint32Array();
    }
    const output = new Uint32Array(getOutputLength(input.length * 8)).fill(0);
    for (let i = 0; i < input.length; i++) {
        output[i >> 2] |= (input[i] & 0xff) << ((i % 4) * 8);
    }
    return output;
}
function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
}
function bitRotateLeft(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
}
function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}
function md5ff(a, b, c, d, x, s, t) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
}
function md5gg(a, b, c, d, x, s, t) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}
exports["default"] = md5;


/***/ },

/***/ 3779
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
exports["default"] = { randomUUID };


/***/ },

/***/ 3465
(__unused_webpack_module, exports) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports["default"] = '00000000-0000-0000-0000-000000000000';


/***/ },

/***/ 1797
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const validate_js_1 = __webpack_require__(9746);
function parse(uuid) {
    if (!(0, validate_js_1.default)(uuid)) {
        throw TypeError('Invalid UUID');
    }
    let v;
    return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 0xff, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 0xff, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 0xff, ((v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000) & 0xff, (v / 0x100000000) & 0xff, (v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}
exports["default"] = parse;


/***/ },

/***/ 6697
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
exports["default"] = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;


/***/ },

/***/ 2291
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
let getRandomValues;
const rnds8 = new Uint8Array(16);
function rng() {
    if (!getRandomValues) {
        if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
            throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
        }
        getRandomValues = crypto.getRandomValues.bind(crypto);
    }
    return getRandomValues(rnds8);
}
exports["default"] = rng;


/***/ },

/***/ 2829
(__unused_webpack_module, exports) {

"use strict";
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
function f(s, x, y, z) {
    switch (s) {
        case 0:
            return (x & y) ^ (~x & z);
        case 1:
            return x ^ y ^ z;
        case 2:
            return (x & y) ^ (x & z) ^ (y & z);
        case 3:
            return x ^ y ^ z;
    }
}
function ROTL(x, n) {
    return (x << n) | (x >>> (32 - n));
}
function sha1(bytes) {
    const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
    const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    const newBytes = new Uint8Array(bytes.length + 1);
    newBytes.set(bytes);
    newBytes[bytes.length] = 0x80;
    bytes = newBytes;
    const l = bytes.length / 4 + 2;
    const N = Math.ceil(l / 16);
    const M = new Array(N);
    for (let i = 0; i < N; ++i) {
        const arr = new Uint32Array(16);
        for (let j = 0; j < 16; ++j) {
            arr[j] =
                (bytes[i * 64 + j * 4] << 24) |
                    (bytes[i * 64 + j * 4 + 1] << 16) |
                    (bytes[i * 64 + j * 4 + 2] << 8) |
                    bytes[i * 64 + j * 4 + 3];
        }
        M[i] = arr;
    }
    M[N - 1][14] = ((bytes.length - 1) * 8) / Math.pow(2, 32);
    M[N - 1][14] = Math.floor(M[N - 1][14]);
    M[N - 1][15] = ((bytes.length - 1) * 8) & 0xffffffff;
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
            const T = (ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t]) >>> 0;
            e = d;
            d = c;
            c = ROTL(b, 30) >>> 0;
            b = a;
            a = T;
        }
        H[0] = (H[0] + a) >>> 0;
        H[1] = (H[1] + b) >>> 0;
        H[2] = (H[2] + c) >>> 0;
        H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0;
    }
    return Uint8Array.of(H[0] >> 24, H[0] >> 16, H[0] >> 8, H[0], H[1] >> 24, H[1] >> 16, H[1] >> 8, H[1], H[2] >> 24, H[2] >> 16, H[2] >> 8, H[2], H[3] >> 24, H[3] >> 16, H[3] >> 8, H[3], H[4] >> 24, H[4] >> 16, H[4] >> 8, H[4]);
}
exports["default"] = sha1;


/***/ },

/***/ 6011
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.unsafeStringify = void 0;
const validate_js_1 = __webpack_require__(9746);
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] +
        byteToHex[arr[offset + 1]] +
        byteToHex[arr[offset + 2]] +
        byteToHex[arr[offset + 3]] +
        '-' +
        byteToHex[arr[offset + 4]] +
        byteToHex[arr[offset + 5]] +
        '-' +
        byteToHex[arr[offset + 6]] +
        byteToHex[arr[offset + 7]] +
        '-' +
        byteToHex[arr[offset + 8]] +
        byteToHex[arr[offset + 9]] +
        '-' +
        byteToHex[arr[offset + 10]] +
        byteToHex[arr[offset + 11]] +
        byteToHex[arr[offset + 12]] +
        byteToHex[arr[offset + 13]] +
        byteToHex[arr[offset + 14]] +
        byteToHex[arr[offset + 15]]).toLowerCase();
}
exports.unsafeStringify = unsafeStringify;
function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    if (!(0, validate_js_1.default)(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
}
exports["default"] = stringify;


/***/ },

/***/ 1425
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.updateV1State = void 0;
const rng_js_1 = __webpack_require__(2291);
const stringify_js_1 = __webpack_require__(6011);
const _state = {};
function v1(options, buf, offset) {
    let bytes;
    const isV6 = options?._v6 ?? false;
    if (options) {
        const optionsKeys = Object.keys(options);
        if (optionsKeys.length === 1 && optionsKeys[0] === '_v6') {
            options = undefined;
        }
    }
    if (options) {
        bytes = v1Bytes(options.random ?? options.rng?.() ?? (0, rng_js_1.default)(), options.msecs, options.nsecs, options.clockseq, options.node, buf, offset);
    }
    else {
        const now = Date.now();
        const rnds = (0, rng_js_1.default)();
        updateV1State(_state, now, rnds);
        bytes = v1Bytes(rnds, _state.msecs, _state.nsecs, isV6 ? undefined : _state.clockseq, isV6 ? undefined : _state.node, buf, offset);
    }
    return buf ?? (0, stringify_js_1.unsafeStringify)(bytes);
}
function updateV1State(state, now, rnds) {
    state.msecs ??= -Infinity;
    state.nsecs ??= 0;
    if (now === state.msecs) {
        state.nsecs++;
        if (state.nsecs >= 10000) {
            state.node = undefined;
            state.nsecs = 0;
        }
    }
    else if (now > state.msecs) {
        state.nsecs = 0;
    }
    else if (now < state.msecs) {
        state.node = undefined;
    }
    if (!state.node) {
        state.node = rnds.slice(10, 16);
        state.node[0] |= 0x01;
        state.clockseq = ((rnds[8] << 8) | rnds[9]) & 0x3fff;
    }
    state.msecs = now;
    return state;
}
exports.updateV1State = updateV1State;
function v1Bytes(rnds, msecs, nsecs, clockseq, node, buf, offset = 0) {
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    if (!buf) {
        buf = new Uint8Array(16);
        offset = 0;
    }
    else {
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
    }
    msecs ??= Date.now();
    nsecs ??= 0;
    clockseq ??= ((rnds[8] << 8) | rnds[9]) & 0x3fff;
    node ??= rnds.slice(10, 16);
    msecs += 12219292800000;
    const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    buf[offset++] = (tl >>> 24) & 0xff;
    buf[offset++] = (tl >>> 16) & 0xff;
    buf[offset++] = (tl >>> 8) & 0xff;
    buf[offset++] = tl & 0xff;
    const tmh = ((msecs / 0x100000000) * 10000) & 0xfffffff;
    buf[offset++] = (tmh >>> 8) & 0xff;
    buf[offset++] = tmh & 0xff;
    buf[offset++] = ((tmh >>> 24) & 0xf) | 0x10;
    buf[offset++] = (tmh >>> 16) & 0xff;
    buf[offset++] = (clockseq >>> 8) | 0x80;
    buf[offset++] = clockseq & 0xff;
    for (let n = 0; n < 6; ++n) {
        buf[offset++] = node[n];
    }
    return buf;
}
exports["default"] = v1;


/***/ },

/***/ 6568
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const parse_js_1 = __webpack_require__(1797);
const stringify_js_1 = __webpack_require__(6011);
function v1ToV6(uuid) {
    const v1Bytes = typeof uuid === 'string' ? (0, parse_js_1.default)(uuid) : uuid;
    const v6Bytes = _v1ToV6(v1Bytes);
    return typeof uuid === 'string' ? (0, stringify_js_1.unsafeStringify)(v6Bytes) : v6Bytes;
}
exports["default"] = v1ToV6;
function _v1ToV6(v1Bytes) {
    return Uint8Array.of(((v1Bytes[6] & 0x0f) << 4) | ((v1Bytes[7] >> 4) & 0x0f), ((v1Bytes[7] & 0x0f) << 4) | ((v1Bytes[4] & 0xf0) >> 4), ((v1Bytes[4] & 0x0f) << 4) | ((v1Bytes[5] & 0xf0) >> 4), ((v1Bytes[5] & 0x0f) << 4) | ((v1Bytes[0] & 0xf0) >> 4), ((v1Bytes[0] & 0x0f) << 4) | ((v1Bytes[1] & 0xf0) >> 4), ((v1Bytes[1] & 0x0f) << 4) | ((v1Bytes[2] & 0xf0) >> 4), 0x60 | (v1Bytes[2] & 0x0f), v1Bytes[3], v1Bytes[8], v1Bytes[9], v1Bytes[10], v1Bytes[11], v1Bytes[12], v1Bytes[13], v1Bytes[14], v1Bytes[15]);
}


/***/ },

/***/ 591
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.URL = exports.DNS = void 0;
const md5_js_1 = __webpack_require__(338);
const v35_js_1 = __webpack_require__(2988);
var v35_js_2 = __webpack_require__(2988);
Object.defineProperty(exports, "DNS", ({ enumerable: true, get: function () { return v35_js_2.DNS; } }));
Object.defineProperty(exports, "URL", ({ enumerable: true, get: function () { return v35_js_2.URL; } }));
function v3(value, namespace, buf, offset) {
    return (0, v35_js_1.default)(0x30, md5_js_1.default, value, namespace, buf, offset);
}
v3.DNS = v35_js_1.DNS;
v3.URL = v35_js_1.URL;
exports["default"] = v3;


/***/ },

/***/ 2988
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.URL = exports.DNS = exports.stringToBytes = void 0;
const parse_js_1 = __webpack_require__(1797);
const stringify_js_1 = __webpack_require__(6011);
function stringToBytes(str) {
    str = unescape(encodeURIComponent(str));
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; ++i) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}
exports.stringToBytes = stringToBytes;
exports.DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35(version, hash, value, namespace, buf, offset) {
    const valueBytes = typeof value === 'string' ? stringToBytes(value) : value;
    const namespaceBytes = typeof namespace === 'string' ? (0, parse_js_1.default)(namespace) : namespace;
    if (typeof namespace === 'string') {
        namespace = (0, parse_js_1.default)(namespace);
    }
    if (namespace?.length !== 16) {
        throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    }
    let bytes = new Uint8Array(16 + valueBytes.length);
    bytes.set(namespaceBytes);
    bytes.set(valueBytes, namespaceBytes.length);
    bytes = hash(bytes);
    bytes[6] = (bytes[6] & 0x0f) | version;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    if (buf) {
        offset = offset || 0;
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = bytes[i];
        }
        return buf;
    }
    return (0, stringify_js_1.unsafeStringify)(bytes);
}
exports["default"] = v35;


/***/ },

/***/ 8286
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const native_js_1 = __webpack_require__(3779);
const rng_js_1 = __webpack_require__(2291);
const stringify_js_1 = __webpack_require__(6011);
function v4(options, buf, offset) {
    if (native_js_1.default.randomUUID && !buf && !options) {
        return native_js_1.default.randomUUID();
    }
    options = options || {};
    const rnds = options.random ?? options.rng?.() ?? (0, rng_js_1.default)();
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;
    if (buf) {
        offset = offset || 0;
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = rnds[i];
        }
        return buf;
    }
    return (0, stringify_js_1.unsafeStringify)(rnds);
}
exports["default"] = v4;


/***/ },

/***/ 4557
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.URL = exports.DNS = void 0;
const sha1_js_1 = __webpack_require__(2829);
const v35_js_1 = __webpack_require__(2988);
var v35_js_2 = __webpack_require__(2988);
Object.defineProperty(exports, "DNS", ({ enumerable: true, get: function () { return v35_js_2.DNS; } }));
Object.defineProperty(exports, "URL", ({ enumerable: true, get: function () { return v35_js_2.URL; } }));
function v5(value, namespace, buf, offset) {
    return (0, v35_js_1.default)(0x50, sha1_js_1.default, value, namespace, buf, offset);
}
v5.DNS = v35_js_1.DNS;
v5.URL = v35_js_1.URL;
exports["default"] = v5;


/***/ },

/***/ 6356
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const stringify_js_1 = __webpack_require__(6011);
const v1_js_1 = __webpack_require__(1425);
const v1ToV6_js_1 = __webpack_require__(6568);
function v6(options, buf, offset) {
    options ??= {};
    offset ??= 0;
    let bytes = (0, v1_js_1.default)({ ...options, _v6: true }, new Uint8Array(16));
    bytes = (0, v1ToV6_js_1.default)(bytes);
    if (buf) {
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; i++) {
            buf[offset + i] = bytes[i];
        }
        return buf;
    }
    return (0, stringify_js_1.unsafeStringify)(bytes);
}
exports["default"] = v6;


/***/ },

/***/ 268
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const parse_js_1 = __webpack_require__(1797);
const stringify_js_1 = __webpack_require__(6011);
function v6ToV1(uuid) {
    const v6Bytes = typeof uuid === 'string' ? (0, parse_js_1.default)(uuid) : uuid;
    const v1Bytes = _v6ToV1(v6Bytes);
    return typeof uuid === 'string' ? (0, stringify_js_1.unsafeStringify)(v1Bytes) : v1Bytes;
}
exports["default"] = v6ToV1;
function _v6ToV1(v6Bytes) {
    return Uint8Array.of(((v6Bytes[3] & 0x0f) << 4) | ((v6Bytes[4] >> 4) & 0x0f), ((v6Bytes[4] & 0x0f) << 4) | ((v6Bytes[5] & 0xf0) >> 4), ((v6Bytes[5] & 0x0f) << 4) | (v6Bytes[6] & 0x0f), v6Bytes[7], ((v6Bytes[1] & 0x0f) << 4) | ((v6Bytes[2] & 0xf0) >> 4), ((v6Bytes[2] & 0x0f) << 4) | ((v6Bytes[3] & 0xf0) >> 4), 0x10 | ((v6Bytes[0] & 0xf0) >> 4), ((v6Bytes[0] & 0x0f) << 4) | ((v6Bytes[1] & 0xf0) >> 4), v6Bytes[8], v6Bytes[9], v6Bytes[10], v6Bytes[11], v6Bytes[12], v6Bytes[13], v6Bytes[14], v6Bytes[15]);
}


/***/ },

/***/ 4299
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.updateV7State = void 0;
const rng_js_1 = __webpack_require__(2291);
const stringify_js_1 = __webpack_require__(6011);
const _state = {};
function v7(options, buf, offset) {
    let bytes;
    if (options) {
        bytes = v7Bytes(options.random ?? options.rng?.() ?? (0, rng_js_1.default)(), options.msecs, options.seq, buf, offset);
    }
    else {
        const now = Date.now();
        const rnds = (0, rng_js_1.default)();
        updateV7State(_state, now, rnds);
        bytes = v7Bytes(rnds, _state.msecs, _state.seq, buf, offset);
    }
    return buf ?? (0, stringify_js_1.unsafeStringify)(bytes);
}
function updateV7State(state, now, rnds) {
    state.msecs ??= -Infinity;
    state.seq ??= 0;
    if (now > state.msecs) {
        state.seq = (rnds[6] << 23) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];
        state.msecs = now;
    }
    else {
        state.seq = (state.seq + 1) | 0;
        if (state.seq === 0) {
            state.msecs++;
        }
    }
    return state;
}
exports.updateV7State = updateV7State;
function v7Bytes(rnds, msecs, seq, buf, offset = 0) {
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    if (!buf) {
        buf = new Uint8Array(16);
        offset = 0;
    }
    else {
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
    }
    msecs ??= Date.now();
    seq ??= ((rnds[6] * 0x7f) << 24) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];
    buf[offset++] = (msecs / 0x10000000000) & 0xff;
    buf[offset++] = (msecs / 0x100000000) & 0xff;
    buf[offset++] = (msecs / 0x1000000) & 0xff;
    buf[offset++] = (msecs / 0x10000) & 0xff;
    buf[offset++] = (msecs / 0x100) & 0xff;
    buf[offset++] = msecs & 0xff;
    buf[offset++] = 0x70 | ((seq >>> 28) & 0x0f);
    buf[offset++] = (seq >>> 20) & 0xff;
    buf[offset++] = 0x80 | ((seq >>> 14) & 0x3f);
    buf[offset++] = (seq >>> 6) & 0xff;
    buf[offset++] = ((seq << 2) & 0xff) | (rnds[10] & 0x03);
    buf[offset++] = rnds[11];
    buf[offset++] = rnds[12];
    buf[offset++] = rnds[13];
    buf[offset++] = rnds[14];
    buf[offset++] = rnds[15];
    return buf;
}
exports["default"] = v7;


/***/ },

/***/ 9746
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const regex_js_1 = __webpack_require__(6697);
function validate(uuid) {
    return typeof uuid === 'string' && regex_js_1.default.test(uuid);
}
exports["default"] = validate;


/***/ },

/***/ 2770
(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const validate_js_1 = __webpack_require__(9746);
function version(uuid) {
    if (!(0, validate_js_1.default)(uuid)) {
        throw TypeError('Invalid UUID');
    }
    return parseInt(uuid.slice(14, 15), 16);
}
exports["default"] = version;


/***/ },

/***/ 1635
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __exportStar: () => (/* binding */ __exportStar),
/* harmony export */   __importDefault: () => (/* binding */ __importDefault),
/* harmony export */   __importStar: () => (/* binding */ __importStar)
/* harmony export */ });
/* unused harmony exports __extends, __assign, __rest, __decorate, __param, __esDecorate, __runInitializers, __propKey, __setFunctionName, __metadata, __awaiter, __generator, __createBinding, __values, __read, __spread, __spreadArrays, __spreadArray, __await, __asyncGenerator, __asyncDelegator, __asyncValues, __makeTemplateObject, __classPrivateFieldGet, __classPrivateFieldSet, __classPrivateFieldIn, __addDisposableResource, __disposeResources, __rewriteRelativeImportExtension */
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */

var extendStatics = function(d, b) {
  extendStatics = Object.setPrototypeOf ||
      ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
      function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
  return extendStatics(d, b);
};

function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() { this.constructor = d; }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = function() {
  __assign = Object.assign || function __assign(t) {
      for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
      }
      return t;
  }
  return __assign.apply(this, arguments);
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
  return function (target, key) { decorator(target, key, paramIndex); }
}

function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
      var context = {};
      for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
      for (var p in contextIn.access) context.access[p] = contextIn.access[p];
      context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
      var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
      if (kind === "accessor") {
          if (result === void 0) continue;
          if (result === null || typeof result !== "object") throw new TypeError("Object expected");
          if (_ = accept(result.get)) descriptor.get = _;
          if (_ = accept(result.set)) descriptor.set = _;
          if (_ = accept(result.init)) initializers.unshift(_);
      }
      else if (_ = accept(result)) {
          if (kind === "field") initializers.unshift(_);
          else descriptor[key] = _;
      }
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
};

function __runInitializers(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) {
      value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  }
  return useValue ? value : void 0;
};

function __propKey(x) {
  return typeof x === "symbol" ? x : "".concat(x);
};

function __setFunctionName(f, name, prefix) {
  if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};

function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}

function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
  function verb(n) { return function (v) { return step([n, v]); }; }
  function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
              case 0: case 1: t = op; break;
              case 4: _.label++; return { value: op[1], done: false };
              case 5: _.label++; y = op[1]; op = [0]; continue;
              case 7: op = _.ops.pop(); _.trys.pop(); continue;
              default:
                  if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                  if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                  if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                  if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                  if (t[2]) _.ops.pop();
                  _.trys.pop(); continue;
          }
          op = body.call(thisArg, _);
      } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
      if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
  }
}

var __createBinding = Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  var desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
});

function __exportStar(m, o) {
  for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}

function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
      next: function () {
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
  }
  catch (error) { e = { error: error }; }
  finally {
      try {
          if (r && !r.done && (m = i["return"])) m.call(i);
      }
      finally { if (e) throw e.error; }
  }
  return ar;
}

/** @deprecated */
function __spread() {
  for (var ar = [], i = 0; i < arguments.length; i++)
      ar = ar.concat(__read(arguments[i]));
  return ar;
}

/** @deprecated */
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
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
  function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
  function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
  function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
  function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
  function fulfill(value) { resume("next", value); }
  function reject(value) { resume("throw", value); }
  function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
  function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
}

function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
  function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
  function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

function __makeTemplateObject(cooked, raw) {
  if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
  return cooked;
};

var __setModuleDefault = Object.create ? (function(o, v) {
  Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
  o["default"] = v;
};

var ownKeys = function(o) {
  ownKeys = Object.getOwnPropertyNames || function (o) {
    var ar = [];
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
    return ar;
  };
  return ownKeys(o);
};

function __importStar(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
  __setModuleDefault(result, mod);
  return result;
}

function __importDefault(mod) {
  return (mod && mod.__esModule) ? mod : { default: mod };
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
  return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

function __classPrivateFieldIn(state, receiver) {
  if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function")) throw new TypeError("Cannot use 'in' operator on non-object");
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
    if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
    env.stack.push({ value: value, dispose: dispose, async: async });
  }
  else if (async) {
    env.stack.push({ async: true });
  }
  return value;
}

var _SuppressedError = (/* unused pure expression or super */ null && (typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
}));

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
          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
        }
        else s |= 1;
      }
      catch (e) {
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
      return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
          return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
      });
  }
  return path;
}

/* unused harmony default export */ var __WEBPACK_DEFAULT_EXPORT__ = ((/* unused pure expression or super */ null && ({
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
  __rewriteRelativeImportExtension,
})));


/***/ }

}]);
