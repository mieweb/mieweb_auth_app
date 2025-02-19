Package["core-runtime"].queue("ejson",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Base64 = Package.base64.Base64;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var EJSON;

var require = meteorInstall({"node_modules":{"meteor":{"ejson":{"ejson.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/ejson/ejson.js                                                                                         //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      EJSON: () => EJSON
    });
    let isFunction, isObject, keysOf, lengthOf, hasOwn, convertMapToObject, isArguments, isInfOrNaN, handleError;
    module.link("./utils", {
      isFunction(v) {
        isFunction = v;
      },
      isObject(v) {
        isObject = v;
      },
      keysOf(v) {
        keysOf = v;
      },
      lengthOf(v) {
        lengthOf = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      convertMapToObject(v) {
        convertMapToObject = v;
      },
      isArguments(v) {
        isArguments = v;
      },
      isInfOrNaN(v) {
        isInfOrNaN = v;
      },
      handleError(v) {
        handleError = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @namespace
     * @summary Namespace for EJSON functions
     */
    const EJSON = {};

    // Custom type interface definition
    /**
     * @class CustomType
     * @instanceName customType
     * @memberOf EJSON
     * @summary The interface that a class must satisfy to be able to become an
     * EJSON custom type via EJSON.addType.
     */

    /**
     * @function typeName
     * @memberOf EJSON.CustomType
     * @summary Return the tag used to identify this type.  This must match the
     *          tag used to register this type with
     *          [`EJSON.addType`](#ejson_add_type).
     * @locus Anywhere
     * @instance
     */

    /**
     * @function toJSONValue
     * @memberOf EJSON.CustomType
     * @summary Serialize this instance into a JSON-compatible value.
     * @locus Anywhere
     * @instance
     */

    /**
     * @function clone
     * @memberOf EJSON.CustomType
     * @summary Return a value `r` such that `this.equals(r)` is true, and
     *          modifications to `r` do not affect `this` and vice versa.
     * @locus Anywhere
     * @instance
     */

    /**
     * @function equals
     * @memberOf EJSON.CustomType
     * @summary Return `true` if `other` has a value equal to `this`; `false`
     *          otherwise.
     * @locus Anywhere
     * @param {Object} other Another object to compare this to.
     * @instance
     */

    const customTypes = new Map();

    // Add a custom type, using a method of your choice to get to and
    // from a basic JSON-able representation.  The factory argument
    // is a function of JSON-able --> your object
    // The type you add must have:
    // - A toJSONValue() method, so that Meteor can serialize it
    // - a typeName() method, to show how to look it up in our type table.
    // It is okay if these methods are monkey-patched on.
    // EJSON.clone will use toJSONValue and the given factory to produce
    // a clone, but you may specify a method clone() that will be
    // used instead.
    // Similarly, EJSON.equals will use toJSONValue to make comparisons,
    // but you may provide a method equals() instead.
    /**
     * @summary Add a custom datatype to EJSON.
     * @locus Anywhere
     * @param {String} name A tag for your custom type; must be unique among
     *                      custom data types defined in your project, and must
     *                      match the result of your type's `typeName` method.
     * @param {Function} factory A function that deserializes a JSON-compatible
     *                           value into an instance of your type.  This should
     *                           match the serialization performed by your
     *                           type's `toJSONValue` method.
     */
    EJSON.addType = (name, factory) => {
      if (customTypes.has(name)) {
        throw new Error("Type ".concat(name, " already present"));
      }
      customTypes.set(name, factory);
    };
    const builtinConverters = [{
      // Date
      matchJSONValue(obj) {
        return hasOwn(obj, '$date') && lengthOf(obj) === 1;
      },
      matchObject(obj) {
        return obj instanceof Date;
      },
      toJSONValue(obj) {
        return {
          $date: obj.getTime()
        };
      },
      fromJSONValue(obj) {
        return new Date(obj.$date);
      }
    }, {
      // RegExp
      matchJSONValue(obj) {
        return hasOwn(obj, '$regexp') && hasOwn(obj, '$flags') && lengthOf(obj) === 2;
      },
      matchObject(obj) {
        return obj instanceof RegExp;
      },
      toJSONValue(regexp) {
        return {
          $regexp: regexp.source,
          $flags: regexp.flags
        };
      },
      fromJSONValue(obj) {
        // Replaces duplicate / invalid flags.
        return new RegExp(obj.$regexp, obj.$flags
        // Cut off flags at 50 chars to avoid abusing RegExp for DOS.
        .slice(0, 50).replace(/[^gimuy]/g, '').replace(/(.)(?=.*\1)/g, ''));
      }
    }, {
      // NaN, Inf, -Inf. (These are the only objects with typeof !== 'object'
      // which we match.)
      matchJSONValue(obj) {
        return hasOwn(obj, '$InfNaN') && lengthOf(obj) === 1;
      },
      matchObject: isInfOrNaN,
      toJSONValue(obj) {
        let sign;
        if (Number.isNaN(obj)) {
          sign = 0;
        } else if (obj === Infinity) {
          sign = 1;
        } else {
          sign = -1;
        }
        return {
          $InfNaN: sign
        };
      },
      fromJSONValue(obj) {
        return obj.$InfNaN / 0;
      }
    }, {
      // Binary
      matchJSONValue(obj) {
        return hasOwn(obj, '$binary') && lengthOf(obj) === 1;
      },
      matchObject(obj) {
        return typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array || obj && hasOwn(obj, '$Uint8ArrayPolyfill');
      },
      toJSONValue(obj) {
        return {
          $binary: Base64.encode(obj)
        };
      },
      fromJSONValue(obj) {
        return Base64.decode(obj.$binary);
      }
    }, {
      // Escaping one level
      matchJSONValue(obj) {
        return hasOwn(obj, '$escape') && lengthOf(obj) === 1;
      },
      matchObject(obj) {
        let match = false;
        if (obj) {
          const keyCount = lengthOf(obj);
          if (keyCount === 1 || keyCount === 2) {
            match = builtinConverters.some(converter => converter.matchJSONValue(obj));
          }
        }
        return match;
      },
      toJSONValue(obj) {
        const newObj = {};
        keysOf(obj).forEach(key => {
          newObj[key] = EJSON.toJSONValue(obj[key]);
        });
        return {
          $escape: newObj
        };
      },
      fromJSONValue(obj) {
        const newObj = {};
        keysOf(obj.$escape).forEach(key => {
          newObj[key] = EJSON.fromJSONValue(obj.$escape[key]);
        });
        return newObj;
      }
    }, {
      // Custom
      matchJSONValue(obj) {
        return hasOwn(obj, '$type') && hasOwn(obj, '$value') && lengthOf(obj) === 2;
      },
      matchObject(obj) {
        return EJSON._isCustomType(obj);
      },
      toJSONValue(obj) {
        const jsonValue = Meteor._noYieldsAllowed(() => obj.toJSONValue());
        return {
          $type: obj.typeName(),
          $value: jsonValue
        };
      },
      fromJSONValue(obj) {
        const typeName = obj.$type;
        if (!customTypes.has(typeName)) {
          throw new Error("Custom EJSON type ".concat(typeName, " is not defined"));
        }
        const converter = customTypes.get(typeName);
        return Meteor._noYieldsAllowed(() => converter(obj.$value));
      }
    }];
    EJSON._isCustomType = obj => obj && isFunction(obj.toJSONValue) && isFunction(obj.typeName) && customTypes.has(obj.typeName());
    EJSON._getTypes = function () {
      let isOriginal = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      return isOriginal ? customTypes : convertMapToObject(customTypes);
    };
    EJSON._getConverters = () => builtinConverters;

    // Either return the JSON-compatible version of the argument, or undefined (if
    // the item isn't itself replaceable, but maybe some fields in it are)
    const toJSONValueHelper = item => {
      for (let i = 0; i < builtinConverters.length; i++) {
        const converter = builtinConverters[i];
        if (converter.matchObject(item)) {
          return converter.toJSONValue(item);
        }
      }
      return undefined;
    };

    // for both arrays and objects, in-place modification.
    const adjustTypesToJSONValue = obj => {
      // Is it an atom that we need to adjust?
      if (obj === null) {
        return null;
      }
      const maybeChanged = toJSONValueHelper(obj);
      if (maybeChanged !== undefined) {
        return maybeChanged;
      }

      // Other atoms are unchanged.
      if (!isObject(obj)) {
        return obj;
      }

      // Iterate over array or object structure.
      keysOf(obj).forEach(key => {
        const value = obj[key];
        if (!isObject(value) && value !== undefined && !isInfOrNaN(value)) {
          return; // continue
        }
        const changed = toJSONValueHelper(value);
        if (changed) {
          obj[key] = changed;
          return; // on to the next key
        }
        // if we get here, value is an object but not adjustable
        // at this level.  recurse.
        adjustTypesToJSONValue(value);
      });
      return obj;
    };
    EJSON._adjustTypesToJSONValue = adjustTypesToJSONValue;

    /**
     * @summary Serialize an EJSON-compatible value into its plain JSON
     *          representation.
     * @locus Anywhere
     * @param {EJSON} val A value to serialize to plain JSON.
     */
    EJSON.toJSONValue = item => {
      const changed = toJSONValueHelper(item);
      if (changed !== undefined) {
        return changed;
      }
      let newItem = item;
      if (isObject(item)) {
        newItem = EJSON.clone(item);
        adjustTypesToJSONValue(newItem);
      }
      return newItem;
    };

    // Either return the argument changed to have the non-json
    // rep of itself (the Object version) or the argument itself.
    // DOES NOT RECURSE.  For actually getting the fully-changed value, use
    // EJSON.fromJSONValue
    const fromJSONValueHelper = value => {
      if (isObject(value) && value !== null) {
        const keys = keysOf(value);
        if (keys.length <= 2 && keys.every(k => typeof k === 'string' && k.substr(0, 1) === '$')) {
          for (let i = 0; i < builtinConverters.length; i++) {
            const converter = builtinConverters[i];
            if (converter.matchJSONValue(value)) {
              return converter.fromJSONValue(value);
            }
          }
        }
      }
      return value;
    };

    // for both arrays and objects. Tries its best to just
    // use the object you hand it, but may return something
    // different if the object you hand it itself needs changing.
    const adjustTypesFromJSONValue = obj => {
      if (obj === null) {
        return null;
      }
      const maybeChanged = fromJSONValueHelper(obj);
      if (maybeChanged !== obj) {
        return maybeChanged;
      }

      // Other atoms are unchanged.
      if (!isObject(obj)) {
        return obj;
      }
      keysOf(obj).forEach(key => {
        const value = obj[key];
        if (isObject(value)) {
          const changed = fromJSONValueHelper(value);
          if (value !== changed) {
            obj[key] = changed;
            return;
          }
          // if we get here, value is an object but not adjustable
          // at this level.  recurse.
          adjustTypesFromJSONValue(value);
        }
      });
      return obj;
    };
    EJSON._adjustTypesFromJSONValue = adjustTypesFromJSONValue;

    /**
     * @summary Deserialize an EJSON value from its plain JSON representation.
     * @locus Anywhere
     * @param {JSONCompatible} val A value to deserialize into EJSON.
     */
    EJSON.fromJSONValue = item => {
      let changed = fromJSONValueHelper(item);
      if (changed === item && isObject(item)) {
        changed = EJSON.clone(item);
        adjustTypesFromJSONValue(changed);
      }
      return changed;
    };

    /**
     * @summary Serialize a value to a string. For EJSON values, the serialization
     *          fully represents the value. For non-EJSON values, serializes the
     *          same way as `JSON.stringify`.
     * @locus Anywhere
     * @param {EJSON} val A value to stringify.
     * @param {Object} [options]
     * @param {Boolean | Integer | String} [options.indent] Indents objects and
     * arrays for easy readability.  When `true`, indents by 2 spaces; when an
     * integer, indents by that number of spaces; and when a string, uses the
     * string as the indentation pattern.
     * @param {Boolean} [options.canonical] When `true`, stringifies keys in an
     *                                    object in sorted order.
     */
    EJSON.stringify = handleError((item, options) => {
      let serialized;
      const json = EJSON.toJSONValue(item);
      if (options && (options.canonical || options.indent)) {
        let canonicalStringify;
        module.link("./stringify", {
          default(v) {
            canonicalStringify = v;
          }
        }, 1);
        serialized = canonicalStringify(json, options);
      } else {
        serialized = JSON.stringify(json);
      }
      return serialized;
    });

    /**
     * @summary Parse a string into an EJSON value. Throws an error if the string
     *          is not valid EJSON.
     * @locus Anywhere
     * @param {String} str A string to parse into an EJSON value.
     */
    EJSON.parse = item => {
      if (typeof item !== 'string') {
        throw new Error('EJSON.parse argument should be a string');
      }
      return EJSON.fromJSONValue(JSON.parse(item));
    };

    /**
     * @summary Returns true if `x` is a buffer of binary data, as returned from
     *          [`EJSON.newBinary`](#ejson_new_binary).
     * @param {Object} x The variable to check.
     * @locus Anywhere
     */
    EJSON.isBinary = obj => {
      return !!(typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array || obj && obj.$Uint8ArrayPolyfill);
    };

    /**
     * @summary Return true if `a` and `b` are equal to each other.  Return false
     *          otherwise.  Uses the `equals` method on `a` if present, otherwise
     *          performs a deep comparison.
     * @locus Anywhere
     * @param {EJSON} a
     * @param {EJSON} b
     * @param {Object} [options]
     * @param {Boolean} options.keyOrderSensitive Compare in key sensitive order,
     * if supported by the JavaScript implementation.  For example, `{a: 1, b: 2}`
     * is equal to `{b: 2, a: 1}` only when `keyOrderSensitive` is `false`.  The
     * default is `false`.
     */
    EJSON.equals = (a, b, options) => {
      let i;
      const keyOrderSensitive = !!(options && options.keyOrderSensitive);
      if (a === b) {
        return true;
      }

      // This differs from the IEEE spec for NaN equality, b/c we don't want
      // anything ever with a NaN to be poisoned from becoming equal to anything.
      if (Number.isNaN(a) && Number.isNaN(b)) {
        return true;
      }

      // if either one is falsy, they'd have to be === to be equal
      if (!a || !b) {
        return false;
      }
      if (!(isObject(a) && isObject(b))) {
        return false;
      }
      if (a instanceof Date && b instanceof Date) {
        return a.valueOf() === b.valueOf();
      }
      if (EJSON.isBinary(a) && EJSON.isBinary(b)) {
        if (a.length !== b.length) {
          return false;
        }
        for (i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            return false;
          }
        }
        return true;
      }
      if (isFunction(a.equals)) {
        return a.equals(b, options);
      }
      if (isFunction(b.equals)) {
        return b.equals(a, options);
      }

      // Array.isArray works across iframes while instanceof won't
      const aIsArray = Array.isArray(a);
      const bIsArray = Array.isArray(b);

      // if not both or none are array they are not equal
      if (aIsArray !== bIsArray) {
        return false;
      }
      if (aIsArray && bIsArray) {
        if (a.length !== b.length) {
          return false;
        }
        for (i = 0; i < a.length; i++) {
          if (!EJSON.equals(a[i], b[i], options)) {
            return false;
          }
        }
        return true;
      }

      // fallback for custom types that don't implement their own equals
      switch (EJSON._isCustomType(a) + EJSON._isCustomType(b)) {
        case 1:
          return false;
        case 2:
          return EJSON.equals(EJSON.toJSONValue(a), EJSON.toJSONValue(b));
        default: // Do nothing
      }

      // fall back to structural equality of objects
      let ret;
      const aKeys = keysOf(a);
      const bKeys = keysOf(b);
      if (keyOrderSensitive) {
        i = 0;
        ret = aKeys.every(key => {
          if (i >= bKeys.length) {
            return false;
          }
          if (key !== bKeys[i]) {
            return false;
          }
          if (!EJSON.equals(a[key], b[bKeys[i]], options)) {
            return false;
          }
          i++;
          return true;
        });
      } else {
        i = 0;
        ret = aKeys.every(key => {
          if (!hasOwn(b, key)) {
            return false;
          }
          if (!EJSON.equals(a[key], b[key], options)) {
            return false;
          }
          i++;
          return true;
        });
      }
      return ret && i === bKeys.length;
    };

    /**
     * @summary Return a deep copy of `val`.
     * @locus Anywhere
     * @param {EJSON} val A value to copy.
     */
    EJSON.clone = v => {
      let ret;
      if (!isObject(v)) {
        return v;
      }
      if (v === null) {
        return null; // null has typeof "object"
      }
      if (v instanceof Date) {
        return new Date(v.getTime());
      }

      // RegExps are not really EJSON elements (eg we don't define a serialization
      // for them), but they're immutable anyway, so we can support them in clone.
      if (v instanceof RegExp) {
        return v;
      }
      if (EJSON.isBinary(v)) {
        ret = EJSON.newBinary(v.length);
        for (let i = 0; i < v.length; i++) {
          ret[i] = v[i];
        }
        return ret;
      }
      if (Array.isArray(v)) {
        return v.map(EJSON.clone);
      }
      if (isArguments(v)) {
        return Array.from(v).map(EJSON.clone);
      }

      // handle general user-defined typed Objects if they have a clone method
      if (isFunction(v.clone)) {
        return v.clone();
      }

      // handle other custom types
      if (EJSON._isCustomType(v)) {
        return EJSON.fromJSONValue(EJSON.clone(EJSON.toJSONValue(v)), true);
      }

      // handle other objects
      ret = {};
      keysOf(v).forEach(key => {
        ret[key] = EJSON.clone(v[key]);
      });
      return ret;
    };

    /**
     * @summary Allocate a new buffer of binary data that EJSON can serialize.
     * @locus Anywhere
     * @param {Number} size The number of bytes of binary data to allocate.
     */
    // EJSON.newBinary is the public documented API for this functionality,
    // but the implementation is in the 'base64' package to avoid
    // introducing a circular dependency. (If the implementation were here,
    // then 'base64' would have to use EJSON.newBinary, and 'ejson' would
    // also have to use 'base64'.)
    EJSON.newBinary = Base64.newBinary;
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stringify.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/ejson/stringify.js                                                                                     //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
// Based on json2.js from https://github.com/douglascrockford/JSON-js
//
//    json2.js
//    2012-10-08
//
//    Public Domain.
//
//    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

function quote(string) {
  return JSON.stringify(string);
}
const str = (key, holder, singleIndent, outerIndent, canonical) => {
  const value = holder[key];

  // What happens next depends on the value's type.
  switch (typeof value) {
    case 'string':
      return quote(value);
    case 'number':
      // JSON numbers must be finite. Encode non-finite numbers as null.
      return isFinite(value) ? String(value) : 'null';
    case 'boolean':
      return String(value);
    // If the type is 'object', we might be dealing with an object or an array or
    // null.
    case 'object':
      {
        // Due to a specification blunder in ECMAScript, typeof null is 'object',
        // so watch out for that case.
        if (!value) {
          return 'null';
        }
        // Make an array to hold the partial results of stringifying this object
        // value.
        const innerIndent = outerIndent + singleIndent;
        const partial = [];
        let v;

        // Is the value an array?
        if (Array.isArray(value) || {}.hasOwnProperty.call(value, 'callee')) {
          // The value is an array. Stringify every element. Use null as a
          // placeholder for non-JSON values.
          const length = value.length;
          for (let i = 0; i < length; i += 1) {
            partial[i] = str(i, value, singleIndent, innerIndent, canonical) || 'null';
          }

          // Join all of the elements together, separated with commas, and wrap
          // them in brackets.
          if (partial.length === 0) {
            v = '[]';
          } else if (innerIndent) {
            v = '[\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + ']';
          } else {
            v = '[' + partial.join(',') + ']';
          }
          return v;
        }

        // Iterate through all of the keys in the object.
        let keys = Object.keys(value);
        if (canonical) {
          keys = keys.sort();
        }
        keys.forEach(k => {
          v = str(k, value, singleIndent, innerIndent, canonical);
          if (v) {
            partial.push(quote(k) + (innerIndent ? ': ' : ':') + v);
          }
        });

        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.
        if (partial.length === 0) {
          v = '{}';
        } else if (innerIndent) {
          v = '{\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + '}';
        } else {
          v = '{' + partial.join(',') + '}';
        }
        return v;
      }
    default: // Do nothing
  }
};

// If the JSON object does not yet have a stringify method, give it one.
const canonicalStringify = (value, options) => {
  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.
  const allOptions = Object.assign({
    indent: '',
    canonical: false
  }, options);
  if (allOptions.indent === true) {
    allOptions.indent = '  ';
  } else if (typeof allOptions.indent === 'number') {
    let newIndent = '';
    for (let i = 0; i < allOptions.indent; i++) {
      newIndent += ' ';
    }
    allOptions.indent = newIndent;
  }
  return str('', {
    '': value
  }, allOptions.indent, '', allOptions.canonical);
};
module.exportDefault(canonicalStringify);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/ejson/utils.js                                                                                         //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.export({
  isFunction: () => isFunction,
  isObject: () => isObject,
  keysOf: () => keysOf,
  lengthOf: () => lengthOf,
  hasOwn: () => hasOwn,
  convertMapToObject: () => convertMapToObject,
  isArguments: () => isArguments,
  isInfOrNaN: () => isInfOrNaN,
  checkError: () => checkError,
  handleError: () => handleError
});
const isFunction = fn => typeof fn === 'function';
const isObject = fn => typeof fn === 'object';
const keysOf = obj => Object.keys(obj);
const lengthOf = obj => Object.keys(obj).length;
const hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
const convertMapToObject = map => Array.from(map).reduce((acc, _ref) => {
  let [key, value] = _ref;
  // reassign to not create new object
  acc[key] = value;
  return acc;
}, {});
const isArguments = obj => obj != null && hasOwn(obj, 'callee');
const isInfOrNaN = obj => Number.isNaN(obj) || obj === Infinity || obj === -Infinity;
const checkError = {
  maxStack: msgError => new RegExp('Maximum call stack size exceeded', 'g').test(msgError)
};
const handleError = fn => function () {
  try {
    return fn.apply(this, arguments);
  } catch (error) {
    const isMaxStack = checkError.maxStack(error.message);
    if (isMaxStack) {
      throw new Error('Converting circular structure to JSON');
    }
    throw error;
  }
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      EJSON: EJSON
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ejson/ejson.js"
  ],
  mainModulePath: "/node_modules/meteor/ejson/ejson.js"
}});

//# sourceURL=meteor://💻app/packages/ejson.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vZWpzb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2Vqc29uL3N0cmluZ2lmeS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZWpzb24vdXRpbHMuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiRUpTT04iLCJpc0Z1bmN0aW9uIiwiaXNPYmplY3QiLCJrZXlzT2YiLCJsZW5ndGhPZiIsImhhc093biIsImNvbnZlcnRNYXBUb09iamVjdCIsImlzQXJndW1lbnRzIiwiaXNJbmZPck5hTiIsImhhbmRsZUVycm9yIiwibGluayIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsImN1c3RvbVR5cGVzIiwiTWFwIiwiYWRkVHlwZSIsIm5hbWUiLCJmYWN0b3J5IiwiaGFzIiwiRXJyb3IiLCJjb25jYXQiLCJzZXQiLCJidWlsdGluQ29udmVydGVycyIsIm1hdGNoSlNPTlZhbHVlIiwib2JqIiwibWF0Y2hPYmplY3QiLCJEYXRlIiwidG9KU09OVmFsdWUiLCIkZGF0ZSIsImdldFRpbWUiLCJmcm9tSlNPTlZhbHVlIiwiUmVnRXhwIiwicmVnZXhwIiwiJHJlZ2V4cCIsInNvdXJjZSIsIiRmbGFncyIsImZsYWdzIiwic2xpY2UiLCJyZXBsYWNlIiwic2lnbiIsIk51bWJlciIsImlzTmFOIiwiSW5maW5pdHkiLCIkSW5mTmFOIiwiVWludDhBcnJheSIsIiRiaW5hcnkiLCJCYXNlNjQiLCJlbmNvZGUiLCJkZWNvZGUiLCJtYXRjaCIsImtleUNvdW50Iiwic29tZSIsImNvbnZlcnRlciIsIm5ld09iaiIsImZvckVhY2giLCJrZXkiLCIkZXNjYXBlIiwiX2lzQ3VzdG9tVHlwZSIsImpzb25WYWx1ZSIsIk1ldGVvciIsIl9ub1lpZWxkc0FsbG93ZWQiLCIkdHlwZSIsInR5cGVOYW1lIiwiJHZhbHVlIiwiZ2V0IiwiX2dldFR5cGVzIiwiaXNPcmlnaW5hbCIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsIl9nZXRDb252ZXJ0ZXJzIiwidG9KU09OVmFsdWVIZWxwZXIiLCJpdGVtIiwiaSIsImFkanVzdFR5cGVzVG9KU09OVmFsdWUiLCJtYXliZUNoYW5nZWQiLCJ2YWx1ZSIsImNoYW5nZWQiLCJfYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSIsIm5ld0l0ZW0iLCJjbG9uZSIsImZyb21KU09OVmFsdWVIZWxwZXIiLCJrZXlzIiwiZXZlcnkiLCJrIiwic3Vic3RyIiwiYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlIiwiX2FkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSIsInN0cmluZ2lmeSIsIm9wdGlvbnMiLCJzZXJpYWxpemVkIiwianNvbiIsImNhbm9uaWNhbCIsImluZGVudCIsImNhbm9uaWNhbFN0cmluZ2lmeSIsImRlZmF1bHQiLCJKU09OIiwicGFyc2UiLCJpc0JpbmFyeSIsIiRVaW50OEFycmF5UG9seWZpbGwiLCJlcXVhbHMiLCJhIiwiYiIsImtleU9yZGVyU2Vuc2l0aXZlIiwidmFsdWVPZiIsImFJc0FycmF5IiwiQXJyYXkiLCJpc0FycmF5IiwiYklzQXJyYXkiLCJyZXQiLCJhS2V5cyIsImJLZXlzIiwibmV3QmluYXJ5IiwibWFwIiwiZnJvbSIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsInF1b3RlIiwic3RyaW5nIiwic3RyIiwiaG9sZGVyIiwic2luZ2xlSW5kZW50Iiwib3V0ZXJJbmRlbnQiLCJpc0Zpbml0ZSIsIlN0cmluZyIsImlubmVySW5kZW50IiwicGFydGlhbCIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImpvaW4iLCJPYmplY3QiLCJzb3J0IiwicHVzaCIsImFsbE9wdGlvbnMiLCJhc3NpZ24iLCJuZXdJbmRlbnQiLCJleHBvcnREZWZhdWx0IiwiY2hlY2tFcnJvciIsImZuIiwicHJvcCIsInByb3RvdHlwZSIsInJlZHVjZSIsImFjYyIsIl9yZWYiLCJtYXhTdGFjayIsIm1zZ0Vycm9yIiwidGVzdCIs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QUFVLENBQUNPLFFBQVEsQ0FBQ0ksS0FBSyxDQUFDRSxPQUFPLENBQUM7SUFDckQsSUFBSUQsVUFBVSxFQUFFO01BQ2QsTUFBTSxJQUFJcEksS0FBSyxDQUFDLHVDQUF1QyxDQUFDO0lBQzFEO0lBQ0EsTUFBTW1JLEtBQUs7RUFDYjtBQUNGLENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvZWpzb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBpc0Z1bmN0aW9uLFxuICBpc09iamVjdCxcbiAga2V5c09mLFxuICBsZW5ndGhPZixcbiAgaGFzT3duLFxuICBjb252ZXJ0TWFwVG9PYmplY3QsXG4gIGlzQXJndW1lbnRzLFxuICBpc0luZk9yTmFOLFxuICBoYW5kbGVFcnJvcixcbn0gZnJvbSAnLi91dGlscyc7XG5cbi8qKlxuICogQG5hbWVzcGFjZVxuICogQHN1bW1hcnkgTmFtZXNwYWNlIGZvciBFSlNPTiBmdW5jdGlvbnNcbiAqL1xuY29uc3QgRUpTT04gPSB7fTtcblxuLy8gQ3VzdG9tIHR5cGUgaW50ZXJmYWNlIGRlZmluaXRpb25cbi8qKlxuICogQGNsYXNzIEN1c3RvbVR5cGVcbiAqIEBpbnN0YW5jZU5hbWUgY3VzdG9tVHlwZVxuICogQG1lbWJlck9mIEVKU09OXG4gKiBAc3VtbWFyeSBUaGUgaW50ZXJmYWNlIHRoYXQgYSBjbGFzcyBtdXN0IHNhdGlzZnkgdG8gYmUgYWJsZSB0byBiZWNvbWUgYW5cbiAqIEVKU09OIGN1c3RvbSB0eXBlIHZpYSBFSlNPTi5hZGRUeXBlLlxuICovXG5cbi8qKlxuICogQGZ1bmN0aW9uIHR5cGVOYW1lXG4gKiBAbWVtYmVyT2YgRUpTT04uQ3VzdG9tVHlwZVxuICogQHN1bW1hcnkgUmV0dXJuIHRoZSB0YWcgdXNlZCB0byBpZGVudGlmeSB0aGlzIHR5cGUuICBUaGlzIG11c3QgbWF0Y2ggdGhlXG4gKiAgICAgICAgICB0YWcgdXNlZCB0byByZWdpc3RlciB0aGlzIHR5cGUgd2l0aFxuICogICAgICAgICAgW2BFSlNPTi5hZGRUeXBlYF0oI2Vqc29uX2FkZF90eXBlKS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGluc3RhbmNlXG4gKi9cblxuLyoqXG4gKiBAZnVuY3Rpb24gdG9KU09OVmFsdWVcbiAqIEBtZW1iZXJPZiBFSlNPTi5DdXN0b21UeXBlXG4gKiBAc3VtbWFyeSBTZXJpYWxpemUgdGhpcyBpbnN0YW5jZSBpbnRvIGEgSlNPTi1jb21wYXRpYmxlIHZhbHVlLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VcbiAqL1xuXG4vKipcbiAqIEBmdW5jdGlvbiBjbG9uZVxuICogQG1lbWJlck9mIEVKU09OLkN1c3RvbVR5cGVcbiAqIEBzdW1tYXJ5IFJldHVybiBhIHZhbHVlIGByYCBzdWNoIHRoYXQgYHRoaXMuZXF1YWxzKHIpYCBpcyB0cnVlLCBhbmRcbiAqICAgICAgICAgIG1vZGlmaWNhdGlvbnMgdG8gYHJgIGRvIG5vdCBhZmZlY3QgYHRoaXNgIGFuZCB2aWNlIHZlcnNhLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VcbiAqL1xuXG4vKipcbiAqIEBmdW5jdGlvbiBlcXVhbHNcbiAqIEBtZW1iZXJPZiBFSlNPTi5DdXN0b21UeXBlXG4gKiBAc3VtbWFyeSBSZXR1cm4gYHRydWVgIGlmIGBvdGhlcmAgaGFzIGEgdmFsdWUgZXF1YWwgdG8gYHRoaXNgOyBgZmFsc2VgXG4gKiAgICAgICAgICBvdGhlcndpc2UuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvdGhlciBBbm90aGVyIG9iamVjdCB0byBjb21wYXJlIHRoaXMgdG8uXG4gKiBAaW5zdGFuY2VcbiAqL1xuXG5jb25zdCBjdXN0b21UeXBlcyA9IG5ldyBNYXAoKTtcblxuLy8gQWRkIGEgY3VzdG9tIHR5cGUsIHVzaW5nIGEgbWV0aG9kIG9mIHlvdXIgY2hvaWNlIHRvIGdldCB0byBhbmRcbi8vIGZyb20gYSBiYXNpYyBKU09OLWFibGUgcmVwcmVzZW50YXRpb24uICBUaGUgZmFjdG9yeSBhcmd1bWVudFxuLy8gaXMgYSBmdW5jdGlvbiBvZiBKU09OLWFibGUgLS0+IHlvdXIgb2JqZWN0XG4vLyBUaGUgdHlwZSB5b3UgYWRkIG11c3QgaGF2ZTpcbi8vIC0gQSB0b0pTT05WYWx1ZSgpIG1ldGhvZCwgc28gdGhhdCBNZXRlb3IgY2FuIHNlcmlhbGl6ZSBpdFxuLy8gLSBhIHR5cGVOYW1lKCkgbWV0aG9kLCB0byBzaG93IGhvdyB0byBsb29rIGl0IHVwIGluIG91ciB0eXBlIHRhYmxlLlxuLy8gSXQgaXMgb2theSBpZiB0aGVzZSBtZXRob2RzIGFyZSBtb25rZXktcGF0Y2hlZCBvbi5cbi8vIEVKU09OLmNsb25lIHdpbGwgdXNlIHRvSlNPTlZhbHVlIGFuZCB0aGUgZ2l2ZW4gZmFjdG9yeSB0byBwcm9kdWNlXG4vLyBhIGNsb25lLCBidXQgeW91IG1heSBzcGVjaWZ5IGEgbWV0aG9kIGNsb25lKCkgdGhhdCB3aWxsIGJlXG4vLyB1c2VkIGluc3RlYWQuXG4vLyBTaW1pbGFybHksIEVKU09OLmVxdWFscyB3aWxsIHVzZSB0b0pTT05WYWx1ZSB0byBtYWtlIGNvbXBhcmlzb25zLFxuLy8gYnV0IHlvdSBtYXkgcHJvdmlkZSBhIG1ldGhvZCBlcXVhbHMoKSBpbnN0ZWFkLlxuLyoqXG4gKiBAc3VtbWFyeSBBZGQgYSBjdXN0b20gZGF0YXR5cGUgdG8gRUpTT04uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIEEgdGFnIGZvciB5b3VyIGN1c3RvbSB0eXBlOyBtdXN0IGJlIHVuaXF1ZSBhbW9uZ1xuICogICAgICAgICAgICAgICAgICAgICAgY3VzdG9tIGRhdGEgdHlwZXMgZGVmaW5lZCBpbiB5b3VyIHByb2plY3QsIGFuZCBtdXN0XG4gKiAgICAgICAgICAgICAgICAgICAgICBtYXRjaCB0aGUgcmVzdWx0IG9mIHlvdXIgdHlwZSdzIGB0eXBlTmFtZWAgbWV0aG9kLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZmFjdG9yeSBBIGZ1bmN0aW9uIHRoYXQgZGVzZXJpYWxpemVzIGEgSlNPTi1jb21wYXRpYmxlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlIGludG8gYW4gaW5zdGFuY2Ugb2YgeW91ciB0eXBlLiAgVGhpcyBzaG91bGRcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggdGhlIHNlcmlhbGl6YXRpb24gcGVyZm9ybWVkIGJ5IHlvdXJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSdzIGB0b0pTT05WYWx1ZWAgbWV0aG9kLlxuICovXG5FSlNPTi5hZGRUeXBlID0gKG5hbWUsIGZhY3RvcnkpID0+IHtcbiAgaWYgKGN1c3RvbVR5cGVzLmhhcyhuYW1lKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSAke25hbWV9IGFscmVhZHkgcHJlc2VudGApO1xuICB9XG4gIGN1c3RvbVR5cGVzLnNldChuYW1lLCBmYWN0b3J5KTtcbn07XG5cbmNvbnN0IGJ1aWx0aW5Db252ZXJ0ZXJzID0gW1xuICB7IC8vIERhdGVcbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJGRhdGUnKSAmJiBsZW5ndGhPZihvYmopID09PSAxO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Qob2JqKSB7XG4gICAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgRGF0ZTtcbiAgICB9LFxuICAgIHRvSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIHskZGF0ZTogb2JqLmdldFRpbWUoKX07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIG5ldyBEYXRlKG9iai4kZGF0ZSk7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBSZWdFeHBcbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJHJlZ2V4cCcpXG4gICAgICAgICYmIGhhc093bihvYmosICckZmxhZ3MnKVxuICAgICAgICAmJiBsZW5ndGhPZihvYmopID09PSAyO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Qob2JqKSB7XG4gICAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgUmVnRXhwO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUocmVnZXhwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAkcmVnZXhwOiByZWdleHAuc291cmNlLFxuICAgICAgICAkZmxhZ3M6IHJlZ2V4cC5mbGFnc1xuICAgICAgfTtcbiAgICB9LFxuICAgIGZyb21KU09OVmFsdWUob2JqKSB7XG4gICAgICAvLyBSZXBsYWNlcyBkdXBsaWNhdGUgLyBpbnZhbGlkIGZsYWdzLlxuICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXG4gICAgICAgIG9iai4kcmVnZXhwLFxuICAgICAgICBvYmouJGZsYWdzXG4gICAgICAgICAgLy8gQ3V0IG9mZiBmbGFncyBhdCA1MCBjaGFycyB0byBhdm9pZCBhYnVzaW5nIFJlZ0V4cCBmb3IgRE9TLlxuICAgICAgICAgIC5zbGljZSgwLCA1MClcbiAgICAgICAgICAucmVwbGFjZSgvW15naW11eV0vZywnJylcbiAgICAgICAgICAucmVwbGFjZSgvKC4pKD89LipcXDEpL2csICcnKVxuICAgICAgKTtcbiAgICB9LFxuICB9LFxuICB7IC8vIE5hTiwgSW5mLCAtSW5mLiAoVGhlc2UgYXJlIHRoZSBvbmx5IG9iamVjdHMgd2l0aCB0eXBlb2YgIT09ICdvYmplY3QnXG4gICAgLy8gd2hpY2ggd2UgbWF0Y2guKVxuICAgIG1hdGNoSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIGhhc093bihvYmosICckSW5mTmFOJykgJiYgbGVuZ3RoT2Yob2JqKSA9PT0gMTtcbiAgICB9LFxuICAgIG1hdGNoT2JqZWN0OiBpc0luZk9yTmFOLFxuICAgIHRvSlNPTlZhbHVlKG9iaikge1xuICAgICAgbGV0IHNpZ247XG4gICAgICBpZiAoTnVtYmVyLmlzTmFOKG9iaikpIHtcbiAgICAgICAgc2lnbiA9IDA7XG4gICAgICB9IGVsc2UgaWYgKG9iaiA9PT0gSW5maW5pdHkpIHtcbiAgICAgICAgc2lnbiA9IDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzaWduID0gLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4geyRJbmZOYU46IHNpZ259O1xuICAgIH0sXG4gICAgZnJvbUpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBvYmouJEluZk5hTiAvIDA7XG4gICAgfSxcbiAgfSxcbiAgeyAvLyBCaW5hcnlcbiAgICBtYXRjaEpTT05WYWx1ZShvYmopIHtcbiAgICAgIHJldHVybiBoYXNPd24ob2JqLCAnJGJpbmFyeScpICYmIGxlbmd0aE9mKG9iaikgPT09IDE7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiYgb2JqIGluc3RhbmNlb2YgVWludDhBcnJheVxuICAgICAgICB8fCAob2JqICYmIGhhc093bihvYmosICckVWludDhBcnJheVBvbHlmaWxsJykpO1xuICAgIH0sXG4gICAgdG9KU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4geyRiaW5hcnk6IEJhc2U2NC5lbmNvZGUob2JqKX07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgcmV0dXJuIEJhc2U2NC5kZWNvZGUob2JqLiRiaW5hcnkpO1xuICAgIH0sXG4gIH0sXG4gIHsgLy8gRXNjYXBpbmcgb25lIGxldmVsXG4gICAgbWF0Y2hKU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gaGFzT3duKG9iaiwgJyRlc2NhcGUnKSAmJiBsZW5ndGhPZihvYmopID09PSAxO1xuICAgIH0sXG4gICAgbWF0Y2hPYmplY3Qob2JqKSB7XG4gICAgICBsZXQgbWF0Y2ggPSBmYWxzZTtcbiAgICAgIGlmIChvYmopIHtcbiAgICAgICAgY29uc3Qga2V5Q291bnQgPSBsZW5ndGhPZihvYmopO1xuICAgICAgICBpZiAoa2V5Q291bnQgPT09IDEgfHwga2V5Q291bnQgPT09IDIpIHtcbiAgICAgICAgICBtYXRjaCA9XG4gICAgICAgICAgICBidWlsdGluQ29udmVydGVycy5zb21lKGNvbnZlcnRlciA9PiBjb252ZXJ0ZXIubWF0Y2hKU09OVmFsdWUob2JqKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9LFxuICAgIHRvSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QgbmV3T2JqID0ge307XG4gICAgICBrZXlzT2Yob2JqKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIG5ld09ialtrZXldID0gRUpTT04udG9KU09OVmFsdWUob2JqW2tleV0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geyRlc2NhcGU6IG5ld09ian07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QgbmV3T2JqID0ge307XG4gICAgICBrZXlzT2Yob2JqLiRlc2NhcGUpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgbmV3T2JqW2tleV0gPSBFSlNPTi5mcm9tSlNPTlZhbHVlKG9iai4kZXNjYXBlW2tleV0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gbmV3T2JqO1xuICAgIH0sXG4gIH0sXG4gIHsgLy8gQ3VzdG9tXG4gICAgbWF0Y2hKU09OVmFsdWUob2JqKSB7XG4gICAgICByZXR1cm4gaGFzT3duKG9iaiwgJyR0eXBlJylcbiAgICAgICAgJiYgaGFzT3duKG9iaiwgJyR2YWx1ZScpICYmIGxlbmd0aE9mKG9iaikgPT09IDI7XG4gICAgfSxcbiAgICBtYXRjaE9iamVjdChvYmopIHtcbiAgICAgIHJldHVybiBFSlNPTi5faXNDdXN0b21UeXBlKG9iaik7XG4gICAgfSxcbiAgICB0b0pTT05WYWx1ZShvYmopIHtcbiAgICAgIGNvbnN0IGpzb25WYWx1ZSA9IE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IG9iai50b0pTT05WYWx1ZSgpKTtcbiAgICAgIHJldHVybiB7JHR5cGU6IG9iai50eXBlTmFtZSgpLCAkdmFsdWU6IGpzb25WYWx1ZX07XG4gICAgfSxcbiAgICBmcm9tSlNPTlZhbHVlKG9iaikge1xuICAgICAgY29uc3QgdHlwZU5hbWUgPSBvYmouJHR5cGU7XG4gICAgICBpZiAoIWN1c3RvbVR5cGVzLmhhcyh0eXBlTmFtZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDdXN0b20gRUpTT04gdHlwZSAke3R5cGVOYW1lfSBpcyBub3QgZGVmaW5lZGApO1xuICAgICAgfVxuICAgICAgY29uc3QgY29udmVydGVyID0gY3VzdG9tVHlwZXMuZ2V0KHR5cGVOYW1lKTtcbiAgICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZCgoKSA9PiBjb252ZXJ0ZXIob2JqLiR2YWx1ZSkpO1xuICAgIH0sXG4gIH0sXG5dO1xuXG5FSlNPTi5faXNDdXN0b21UeXBlID0gKG9iaikgPT4gKFxuICBvYmogJiZcbiAgaXNGdW5jdGlvbihvYmoudG9KU09OVmFsdWUpICYmXG4gIGlzRnVuY3Rpb24ob2JqLnR5cGVOYW1lKSAmJlxuICBjdXN0b21UeXBlcy5oYXMob2JqLnR5cGVOYW1lKCkpXG4pO1xuXG5FSlNPTi5fZ2V0VHlwZXMgPSAoaXNPcmlnaW5hbCA9IGZhbHNlKSA9PiAoaXNPcmlnaW5hbCA/IGN1c3RvbVR5cGVzIDogY29udmVydE1hcFRvT2JqZWN0KGN1c3RvbVR5cGVzKSk7XG5cbkVKU09OLl9nZXRDb252ZXJ0ZXJzID0gKCkgPT4gYnVpbHRpbkNvbnZlcnRlcnM7XG5cbi8vIEVpdGhlciByZXR1cm4gdGhlIEpTT04tY29tcGF0aWJsZSB2ZXJzaW9uIG9mIHRoZSBhcmd1bWVudCwgb3IgdW5kZWZpbmVkIChpZlxuLy8gdGhlIGl0ZW0gaXNuJ3QgaXRzZWxmIHJlcGxhY2VhYmxlLCBidXQgbWF5YmUgc29tZSBmaWVsZHMgaW4gaXQgYXJlKVxuY29uc3QgdG9KU09OVmFsdWVIZWxwZXIgPSBpdGVtID0+IHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWlsdGluQ29udmVydGVycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNvbnZlcnRlciA9IGJ1aWx0aW5Db252ZXJ0ZXJzW2ldO1xuICAgIGlmIChjb252ZXJ0ZXIubWF0Y2hPYmplY3QoaXRlbSkpIHtcbiAgICAgIHJldHVybiBjb252ZXJ0ZXIudG9KU09OVmFsdWUoaXRlbSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG4vLyBmb3IgYm90aCBhcnJheXMgYW5kIG9iamVjdHMsIGluLXBsYWNlIG1vZGlmaWNhdGlvbi5cbmNvbnN0IGFkanVzdFR5cGVzVG9KU09OVmFsdWUgPSBvYmogPT4ge1xuICAvLyBJcyBpdCBhbiBhdG9tIHRoYXQgd2UgbmVlZCB0byBhZGp1c3Q/XG4gIGlmIChvYmogPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IG1heWJlQ2hhbmdlZCA9IHRvSlNPTlZhbHVlSGVscGVyKG9iaik7XG4gIGlmIChtYXliZUNoYW5nZWQgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBtYXliZUNoYW5nZWQ7XG4gIH1cblxuICAvLyBPdGhlciBhdG9tcyBhcmUgdW5jaGFuZ2VkLlxuICBpZiAoIWlzT2JqZWN0KG9iaikpIHtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgLy8gSXRlcmF0ZSBvdmVyIGFycmF5IG9yIG9iamVjdCBzdHJ1Y3R1cmUuXG4gIGtleXNPZihvYmopLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuICAgIGlmICghaXNPYmplY3QodmFsdWUpICYmIHZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIWlzSW5mT3JOYU4odmFsdWUpKSB7XG4gICAgICByZXR1cm47IC8vIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgY29uc3QgY2hhbmdlZCA9IHRvSlNPTlZhbHVlSGVscGVyKHZhbHVlKTtcbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgb2JqW2tleV0gPSBjaGFuZ2VkO1xuICAgICAgcmV0dXJuOyAvLyBvbiB0byB0aGUgbmV4dCBrZXlcbiAgICB9XG4gICAgLy8gaWYgd2UgZ2V0IGhlcmUsIHZhbHVlIGlzIGFuIG9iamVjdCBidXQgbm90IGFkanVzdGFibGVcbiAgICAvLyBhdCB0aGlzIGxldmVsLiAgcmVjdXJzZS5cbiAgICBhZGp1c3RUeXBlc1RvSlNPTlZhbHVlKHZhbHVlKTtcbiAgfSk7XG4gIHJldHVybiBvYmo7XG59O1xuXG5FSlNPTi5fYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSA9IGFkanVzdFR5cGVzVG9KU09OVmFsdWU7XG5cbi8qKlxuICogQHN1bW1hcnkgU2VyaWFsaXplIGFuIEVKU09OLWNvbXBhdGlibGUgdmFsdWUgaW50byBpdHMgcGxhaW4gSlNPTlxuICogICAgICAgICAgcmVwcmVzZW50YXRpb24uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RUpTT059IHZhbCBBIHZhbHVlIHRvIHNlcmlhbGl6ZSB0byBwbGFpbiBKU09OLlxuICovXG5FSlNPTi50b0pTT05WYWx1ZSA9IGl0ZW0gPT4ge1xuICBjb25zdCBjaGFuZ2VkID0gdG9KU09OVmFsdWVIZWxwZXIoaXRlbSk7XG4gIGlmIChjaGFuZ2VkICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gY2hhbmdlZDtcbiAgfVxuXG4gIGxldCBuZXdJdGVtID0gaXRlbTtcbiAgaWYgKGlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgbmV3SXRlbSA9IEVKU09OLmNsb25lKGl0ZW0pO1xuICAgIGFkanVzdFR5cGVzVG9KU09OVmFsdWUobmV3SXRlbSk7XG4gIH1cbiAgcmV0dXJuIG5ld0l0ZW07XG59O1xuXG4vLyBFaXRoZXIgcmV0dXJuIHRoZSBhcmd1bWVudCBjaGFuZ2VkIHRvIGhhdmUgdGhlIG5vbi1qc29uXG4vLyByZXAgb2YgaXRzZWxmICh0aGUgT2JqZWN0IHZlcnNpb24pIG9yIHRoZSBhcmd1bWVudCBpdHNlbGYuXG4vLyBET0VTIE5PVCBSRUNVUlNFLiAgRm9yIGFjdHVhbGx5IGdldHRpbmcgdGhlIGZ1bGx5LWNoYW5nZWQgdmFsdWUsIHVzZVxuLy8gRUpTT04uZnJvbUpTT05WYWx1ZVxuY29uc3QgZnJvbUpTT05WYWx1ZUhlbHBlciA9IHZhbHVlID0+IHtcbiAgaWYgKGlzT2JqZWN0KHZhbHVlKSAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGtleXMgPSBrZXlzT2YodmFsdWUpO1xuICAgIGlmIChrZXlzLmxlbmd0aCA8PSAyXG4gICAgICAgICYmIGtleXMuZXZlcnkoayA9PiB0eXBlb2YgayA9PT0gJ3N0cmluZycgJiYgay5zdWJzdHIoMCwgMSkgPT09ICckJykpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnVpbHRpbkNvbnZlcnRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY29udmVydGVyID0gYnVpbHRpbkNvbnZlcnRlcnNbaV07XG4gICAgICAgIGlmIChjb252ZXJ0ZXIubWF0Y2hKU09OVmFsdWUodmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnZlcnRlci5mcm9tSlNPTlZhbHVlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuXG4vLyBmb3IgYm90aCBhcnJheXMgYW5kIG9iamVjdHMuIFRyaWVzIGl0cyBiZXN0IHRvIGp1c3Rcbi8vIHVzZSB0aGUgb2JqZWN0IHlvdSBoYW5kIGl0LCBidXQgbWF5IHJldHVybiBzb21ldGhpbmdcbi8vIGRpZmZlcmVudCBpZiB0aGUgb2JqZWN0IHlvdSBoYW5kIGl0IGl0c2VsZiBuZWVkcyBjaGFuZ2luZy5cbmNvbnN0IGFkanVzdFR5cGVzRnJvbUpTT05WYWx1ZSA9IG9iaiA9PiB7XG4gIGlmIChvYmogPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IG1heWJlQ2hhbmdlZCA9IGZyb21KU09OVmFsdWVIZWxwZXIob2JqKTtcbiAgaWYgKG1heWJlQ2hhbmdlZCAhPT0gb2JqKSB7XG4gICAgcmV0dXJuIG1heWJlQ2hhbmdlZDtcbiAgfVxuXG4gIC8vIE90aGVyIGF0b21zIGFyZSB1bmNoYW5nZWQuXG4gIGlmICghaXNPYmplY3Qob2JqKSkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICBrZXlzT2Yob2JqKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBvYmpba2V5XTtcbiAgICBpZiAoaXNPYmplY3QodmFsdWUpKSB7XG4gICAgICBjb25zdCBjaGFuZ2VkID0gZnJvbUpTT05WYWx1ZUhlbHBlcih2YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgIT09IGNoYW5nZWQpIHtcbiAgICAgICAgb2JqW2tleV0gPSBjaGFuZ2VkO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBpZiB3ZSBnZXQgaGVyZSwgdmFsdWUgaXMgYW4gb2JqZWN0IGJ1dCBub3QgYWRqdXN0YWJsZVxuICAgICAgLy8gYXQgdGhpcyBsZXZlbC4gIHJlY3Vyc2UuXG4gICAgICBhZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUodmFsdWUpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvYmo7XG59O1xuXG5FSlNPTi5fYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlID0gYWRqdXN0VHlwZXNGcm9tSlNPTlZhbHVlO1xuXG4vKipcbiAqIEBzdW1tYXJ5IERlc2VyaWFsaXplIGFuIEVKU09OIHZhbHVlIGZyb20gaXRzIHBsYWluIEpTT04gcmVwcmVzZW50YXRpb24uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7SlNPTkNvbXBhdGlibGV9IHZhbCBBIHZhbHVlIHRvIGRlc2VyaWFsaXplIGludG8gRUpTT04uXG4gKi9cbkVKU09OLmZyb21KU09OVmFsdWUgPSBpdGVtID0+IHtcbiAgbGV0IGNoYW5nZWQgPSBmcm9tSlNPTlZhbHVlSGVscGVyKGl0ZW0pO1xuICBpZiAoY2hhbmdlZCA9PT0gaXRlbSAmJiBpc09iamVjdChpdGVtKSkge1xuICAgIGNoYW5nZWQgPSBFSlNPTi5jbG9uZShpdGVtKTtcbiAgICBhZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUoY2hhbmdlZCk7XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNlcmlhbGl6ZSBhIHZhbHVlIHRvIGEgc3RyaW5nLiBGb3IgRUpTT04gdmFsdWVzLCB0aGUgc2VyaWFsaXphdGlvblxuICogICAgICAgICAgZnVsbHkgcmVwcmVzZW50cyB0aGUgdmFsdWUuIEZvciBub24tRUpTT04gdmFsdWVzLCBzZXJpYWxpemVzIHRoZVxuICogICAgICAgICAgc2FtZSB3YXkgYXMgYEpTT04uc3RyaW5naWZ5YC5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtFSlNPTn0gdmFsIEEgdmFsdWUgdG8gc3RyaW5naWZ5LlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtCb29sZWFuIHwgSW50ZWdlciB8IFN0cmluZ30gW29wdGlvbnMuaW5kZW50XSBJbmRlbnRzIG9iamVjdHMgYW5kXG4gKiBhcnJheXMgZm9yIGVhc3kgcmVhZGFiaWxpdHkuICBXaGVuIGB0cnVlYCwgaW5kZW50cyBieSAyIHNwYWNlczsgd2hlbiBhblxuICogaW50ZWdlciwgaW5kZW50cyBieSB0aGF0IG51bWJlciBvZiBzcGFjZXM7IGFuZCB3aGVuIGEgc3RyaW5nLCB1c2VzIHRoZVxuICogc3RyaW5nIGFzIHRoZSBpbmRlbnRhdGlvbiBwYXR0ZXJuLlxuICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5jYW5vbmljYWxdIFdoZW4gYHRydWVgLCBzdHJpbmdpZmllcyBrZXlzIGluIGFuXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdCBpbiBzb3J0ZWQgb3JkZXIuXG4gKi9cbkVKU09OLnN0cmluZ2lmeSA9IGhhbmRsZUVycm9yKChpdGVtLCBvcHRpb25zKSA9PiB7XG4gIGxldCBzZXJpYWxpemVkO1xuICBjb25zdCBqc29uID0gRUpTT04udG9KU09OVmFsdWUoaXRlbSk7XG4gIGlmIChvcHRpb25zICYmIChvcHRpb25zLmNhbm9uaWNhbCB8fCBvcHRpb25zLmluZGVudCkpIHtcbiAgICBpbXBvcnQgY2Fub25pY2FsU3RyaW5naWZ5IGZyb20gJy4vc3RyaW5naWZ5JztcbiAgICBzZXJpYWxpemVkID0gY2Fub25pY2FsU3RyaW5naWZ5KGpzb24sIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIHNlcmlhbGl6ZWQgPSBKU09OLnN0cmluZ2lmeShqc29uKTtcbiAgfVxuICByZXR1cm4gc2VyaWFsaXplZDtcbn0pO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFBhcnNlIGEgc3RyaW5nIGludG8gYW4gRUpTT04gdmFsdWUuIFRocm93cyBhbiBlcnJvciBpZiB0aGUgc3RyaW5nXG4gKiAgICAgICAgICBpcyBub3QgdmFsaWQgRUpTT04uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQSBzdHJpbmcgdG8gcGFyc2UgaW50byBhbiBFSlNPTiB2YWx1ZS5cbiAqL1xuRUpTT04ucGFyc2UgPSBpdGVtID0+IHtcbiAgaWYgKHR5cGVvZiBpdGVtICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcignRUpTT04ucGFyc2UgYXJndW1lbnQgc2hvdWxkIGJlIGEgc3RyaW5nJyk7XG4gIH1cbiAgcmV0dXJuIEVKU09OLmZyb21KU09OVmFsdWUoSlNPTi5wYXJzZShpdGVtKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJldHVybnMgdHJ1ZSBpZiBgeGAgaXMgYSBidWZmZXIgb2YgYmluYXJ5IGRhdGEsIGFzIHJldHVybmVkIGZyb21cbiAqICAgICAgICAgIFtgRUpTT04ubmV3QmluYXJ5YF0oI2Vqc29uX25ld19iaW5hcnkpLlxuICogQHBhcmFtIHtPYmplY3R9IHggVGhlIHZhcmlhYmxlIHRvIGNoZWNrLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKi9cbkVKU09OLmlzQmluYXJ5ID0gb2JqID0+IHtcbiAgcmV0dXJuICEhKCh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiYgb2JqIGluc3RhbmNlb2YgVWludDhBcnJheSkgfHxcbiAgICAob2JqICYmIG9iai4kVWludDhBcnJheVBvbHlmaWxsKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJldHVybiB0cnVlIGlmIGBhYCBhbmQgYGJgIGFyZSBlcXVhbCB0byBlYWNoIG90aGVyLiAgUmV0dXJuIGZhbHNlXG4gKiAgICAgICAgICBvdGhlcndpc2UuICBVc2VzIHRoZSBgZXF1YWxzYCBtZXRob2Qgb24gYGFgIGlmIHByZXNlbnQsIG90aGVyd2lzZVxuICogICAgICAgICAgcGVyZm9ybXMgYSBkZWVwIGNvbXBhcmlzb24uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RUpTT059IGFcbiAqIEBwYXJhbSB7RUpTT059IGJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5rZXlPcmRlclNlbnNpdGl2ZSBDb21wYXJlIGluIGtleSBzZW5zaXRpdmUgb3JkZXIsXG4gKiBpZiBzdXBwb3J0ZWQgYnkgdGhlIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24uICBGb3IgZXhhbXBsZSwgYHthOiAxLCBiOiAyfWBcbiAqIGlzIGVxdWFsIHRvIGB7YjogMiwgYTogMX1gIG9ubHkgd2hlbiBga2V5T3JkZXJTZW5zaXRpdmVgIGlzIGBmYWxzZWAuICBUaGVcbiAqIGRlZmF1bHQgaXMgYGZhbHNlYC5cbiAqL1xuRUpTT04uZXF1YWxzID0gKGEsIGIsIG9wdGlvbnMpID0+IHtcbiAgbGV0IGk7XG4gIGNvbnN0IGtleU9yZGVyU2Vuc2l0aXZlID0gISEob3B0aW9ucyAmJiBvcHRpb25zLmtleU9yZGVyU2Vuc2l0aXZlKTtcbiAgaWYgKGEgPT09IGIpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIFRoaXMgZGlmZmVycyBmcm9tIHRoZSBJRUVFIHNwZWMgZm9yIE5hTiBlcXVhbGl0eSwgYi9jIHdlIGRvbid0IHdhbnRcbiAgLy8gYW55dGhpbmcgZXZlciB3aXRoIGEgTmFOIHRvIGJlIHBvaXNvbmVkIGZyb20gYmVjb21pbmcgZXF1YWwgdG8gYW55dGhpbmcuXG4gIGlmIChOdW1iZXIuaXNOYU4oYSkgJiYgTnVtYmVyLmlzTmFOKGIpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyBpZiBlaXRoZXIgb25lIGlzIGZhbHN5LCB0aGV5J2QgaGF2ZSB0byBiZSA9PT0gdG8gYmUgZXF1YWxcbiAgaWYgKCFhIHx8ICFiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCEoaXNPYmplY3QoYSkgJiYgaXNPYmplY3QoYikpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGEudmFsdWVPZigpID09PSBiLnZhbHVlT2YoKTtcbiAgfVxuXG4gIGlmIChFSlNPTi5pc0JpbmFyeShhKSAmJiBFSlNPTi5pc0JpbmFyeShiKSkge1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAoaXNGdW5jdGlvbihhLmVxdWFscykpIHtcbiAgICByZXR1cm4gYS5lcXVhbHMoYiwgb3B0aW9ucyk7XG4gIH1cblxuICBpZiAoaXNGdW5jdGlvbihiLmVxdWFscykpIHtcbiAgICByZXR1cm4gYi5lcXVhbHMoYSwgb3B0aW9ucyk7XG4gIH1cblxuICAvLyBBcnJheS5pc0FycmF5IHdvcmtzIGFjcm9zcyBpZnJhbWVzIHdoaWxlIGluc3RhbmNlb2Ygd29uJ3RcbiAgY29uc3QgYUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KGEpO1xuICBjb25zdCBiSXNBcnJheSA9IEFycmF5LmlzQXJyYXkoYik7XG5cbiAgLy8gaWYgbm90IGJvdGggb3Igbm9uZSBhcmUgYXJyYXkgdGhleSBhcmUgbm90IGVxdWFsXG4gIGlmIChhSXNBcnJheSAhPT0gYklzQXJyYXkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoYUlzQXJyYXkgJiYgYklzQXJyYXkpIHtcbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIUVKU09OLmVxdWFscyhhW2ldLCBiW2ldLCBvcHRpb25zKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gZmFsbGJhY2sgZm9yIGN1c3RvbSB0eXBlcyB0aGF0IGRvbid0IGltcGxlbWVudCB0aGVpciBvd24gZXF1YWxzXG4gIHN3aXRjaCAoRUpTT04uX2lzQ3VzdG9tVHlwZShhKSArIEVKU09OLl9pc0N1c3RvbVR5cGUoYikpIHtcbiAgICBjYXNlIDE6IHJldHVybiBmYWxzZTtcbiAgICBjYXNlIDI6IHJldHVybiBFSlNPTi5lcXVhbHMoRUpTT04udG9KU09OVmFsdWUoYSksIEVKU09OLnRvSlNPTlZhbHVlKGIpKTtcbiAgICBkZWZhdWx0OiAvLyBEbyBub3RoaW5nXG4gIH1cblxuICAvLyBmYWxsIGJhY2sgdG8gc3RydWN0dXJhbCBlcXVhbGl0eSBvZiBvYmplY3RzXG4gIGxldCByZXQ7XG4gIGNvbnN0IGFLZXlzID0ga2V5c09mKGEpO1xuICBjb25zdCBiS2V5cyA9IGtleXNPZihiKTtcbiAgaWYgKGtleU9yZGVyU2Vuc2l0aXZlKSB7XG4gICAgaSA9IDA7XG4gICAgcmV0ID0gYUtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgIGlmIChpID49IGJLZXlzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoa2V5ICE9PSBiS2V5c1tpXSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoIUVKU09OLmVxdWFscyhhW2tleV0sIGJbYktleXNbaV1dLCBvcHRpb25zKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBpID0gMDtcbiAgICByZXQgPSBhS2V5cy5ldmVyeShrZXkgPT4ge1xuICAgICAgaWYgKCFoYXNPd24oYiwga2V5KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoIUVKU09OLmVxdWFscyhhW2tleV0sIGJba2V5XSwgb3B0aW9ucykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHJldCAmJiBpID09PSBiS2V5cy5sZW5ndGg7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJldHVybiBhIGRlZXAgY29weSBvZiBgdmFsYC5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtFSlNPTn0gdmFsIEEgdmFsdWUgdG8gY29weS5cbiAqL1xuRUpTT04uY2xvbmUgPSB2ID0+IHtcbiAgbGV0IHJldDtcbiAgaWYgKCFpc09iamVjdCh2KSkge1xuICAgIHJldHVybiB2O1xuICB9XG5cbiAgaWYgKHYgPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDsgLy8gbnVsbCBoYXMgdHlwZW9mIFwib2JqZWN0XCJcbiAgfVxuXG4gIGlmICh2IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiBuZXcgRGF0ZSh2LmdldFRpbWUoKSk7XG4gIH1cblxuICAvLyBSZWdFeHBzIGFyZSBub3QgcmVhbGx5IEVKU09OIGVsZW1lbnRzIChlZyB3ZSBkb24ndCBkZWZpbmUgYSBzZXJpYWxpemF0aW9uXG4gIC8vIGZvciB0aGVtKSwgYnV0IHRoZXkncmUgaW1tdXRhYmxlIGFueXdheSwgc28gd2UgY2FuIHN1cHBvcnQgdGhlbSBpbiBjbG9uZS5cbiAgaWYgKHYgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIGlmIChFSlNPTi5pc0JpbmFyeSh2KSkge1xuICAgIHJldCA9IEVKU09OLm5ld0JpbmFyeSh2Lmxlbmd0aCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXRbaV0gPSB2W2ldO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkodikpIHtcbiAgICByZXR1cm4gdi5tYXAoRUpTT04uY2xvbmUpO1xuICB9XG5cbiAgaWYgKGlzQXJndW1lbnRzKHYpKSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odikubWFwKEVKU09OLmNsb25lKTtcbiAgfVxuXG4gIC8vIGhhbmRsZSBnZW5lcmFsIHVzZXItZGVmaW5lZCB0eXBlZCBPYmplY3RzIGlmIHRoZXkgaGF2ZSBhIGNsb25lIG1ldGhvZFxuICBpZiAoaXNGdW5jdGlvbih2LmNsb25lKSkge1xuICAgIHJldHVybiB2LmNsb25lKCk7XG4gIH1cblxuICAvLyBoYW5kbGUgb3RoZXIgY3VzdG9tIHR5cGVzXG4gIGlmIChFSlNPTi5faXNDdXN0b21UeXBlKHYpKSB7XG4gICAgcmV0dXJuIEVKU09OLmZyb21KU09OVmFsdWUoRUpTT04uY2xvbmUoRUpTT04udG9KU09OVmFsdWUodikpLCB0cnVlKTtcbiAgfVxuXG4gIC8vIGhhbmRsZSBvdGhlciBvYmplY3RzXG4gIHJldCA9IHt9O1xuICBrZXlzT2YodikuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgcmV0W2tleV0gPSBFSlNPTi5jbG9uZSh2W2tleV0pO1xuICB9KTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQWxsb2NhdGUgYSBuZXcgYnVmZmVyIG9mIGJpbmFyeSBkYXRhIHRoYXQgRUpTT04gY2FuIHNlcmlhbGl6ZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtOdW1iZXJ9IHNpemUgVGhlIG51bWJlciBvZiBieXRlcyBvZiBiaW5hcnkgZGF0YSB0byBhbGxvY2F0ZS5cbiAqL1xuLy8gRUpTT04ubmV3QmluYXJ5IGlzIHRoZSBwdWJsaWMgZG9jdW1lbnRlZCBBUEkgZm9yIHRoaXMgZnVuY3Rpb25hbGl0eSxcbi8vIGJ1dCB0aGUgaW1wbGVtZW50YXRpb24gaXMgaW4gdGhlICdiYXNlNjQnIHBhY2thZ2UgdG8gYXZvaWRcbi8vIGludHJvZHVjaW5nIGEgY2lyY3VsYXIgZGVwZW5kZW5jeS4gKElmIHRoZSBpbXBsZW1lbnRhdGlvbiB3ZXJlIGhlcmUsXG4vLyB0aGVuICdiYXNlNjQnIHdvdWxkIGhhdmUgdG8gdXNlIEVKU09OLm5ld0JpbmFyeSwgYW5kICdlanNvbicgd291bGRcbi8vIGFsc28gaGF2ZSB0byB1c2UgJ2Jhc2U2NCcuKVxuRUpTT04ubmV3QmluYXJ5ID0gQmFzZTY0Lm5ld0JpbmFyeTtcblxuZXhwb3J0IHsgRUpTT04gfTtcbiIsIi8vIEJhc2VkIG9uIGpzb24yLmpzIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2RvdWdsYXNjcm9ja2ZvcmQvSlNPTi1qc1xuLy9cbi8vICAgIGpzb24yLmpzXG4vLyAgICAyMDEyLTEwLTA4XG4vL1xuLy8gICAgUHVibGljIERvbWFpbi5cbi8vXG4vLyAgICBOTyBXQVJSQU5UWSBFWFBSRVNTRUQgT1IgSU1QTElFRC4gVVNFIEFUIFlPVVIgT1dOIFJJU0suXG5cbmZ1bmN0aW9uIHF1b3RlKHN0cmluZykge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyaW5nKTtcbn1cblxuY29uc3Qgc3RyID0gKGtleSwgaG9sZGVyLCBzaW5nbGVJbmRlbnQsIG91dGVySW5kZW50LCBjYW5vbmljYWwpID0+IHtcbiAgY29uc3QgdmFsdWUgPSBob2xkZXJba2V5XTtcblxuICAvLyBXaGF0IGhhcHBlbnMgbmV4dCBkZXBlbmRzIG9uIHRoZSB2YWx1ZSdzIHR5cGUuXG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gIGNhc2UgJ3N0cmluZyc6XG4gICAgcmV0dXJuIHF1b3RlKHZhbHVlKTtcbiAgY2FzZSAnbnVtYmVyJzpcbiAgICAvLyBKU09OIG51bWJlcnMgbXVzdCBiZSBmaW5pdGUuIEVuY29kZSBub24tZmluaXRlIG51bWJlcnMgYXMgbnVsbC5cbiAgICByZXR1cm4gaXNGaW5pdGUodmFsdWUpID8gU3RyaW5nKHZhbHVlKSA6ICdudWxsJztcbiAgY2FzZSAnYm9vbGVhbic6XG4gICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gIC8vIElmIHRoZSB0eXBlIGlzICdvYmplY3QnLCB3ZSBtaWdodCBiZSBkZWFsaW5nIHdpdGggYW4gb2JqZWN0IG9yIGFuIGFycmF5IG9yXG4gIC8vIG51bGwuXG4gIGNhc2UgJ29iamVjdCc6IHtcbiAgICAvLyBEdWUgdG8gYSBzcGVjaWZpY2F0aW9uIGJsdW5kZXIgaW4gRUNNQVNjcmlwdCwgdHlwZW9mIG51bGwgaXMgJ29iamVjdCcsXG4gICAgLy8gc28gd2F0Y2ggb3V0IGZvciB0aGF0IGNhc2UuXG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgcmV0dXJuICdudWxsJztcbiAgICB9XG4gICAgLy8gTWFrZSBhbiBhcnJheSB0byBob2xkIHRoZSBwYXJ0aWFsIHJlc3VsdHMgb2Ygc3RyaW5naWZ5aW5nIHRoaXMgb2JqZWN0XG4gICAgLy8gdmFsdWUuXG4gICAgY29uc3QgaW5uZXJJbmRlbnQgPSBvdXRlckluZGVudCArIHNpbmdsZUluZGVudDtcbiAgICBjb25zdCBwYXJ0aWFsID0gW107XG4gICAgbGV0IHY7XG5cbiAgICAvLyBJcyB0aGUgdmFsdWUgYW4gYXJyYXk/XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpIHx8ICh7fSkuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpKSB7XG4gICAgICAvLyBUaGUgdmFsdWUgaXMgYW4gYXJyYXkuIFN0cmluZ2lmeSBldmVyeSBlbGVtZW50LiBVc2UgbnVsbCBhcyBhXG4gICAgICAvLyBwbGFjZWhvbGRlciBmb3Igbm9uLUpTT04gdmFsdWVzLlxuICAgICAgY29uc3QgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBwYXJ0aWFsW2ldID1cbiAgICAgICAgICBzdHIoaSwgdmFsdWUsIHNpbmdsZUluZGVudCwgaW5uZXJJbmRlbnQsIGNhbm9uaWNhbCkgfHwgJ251bGwnO1xuICAgICAgfVxuXG4gICAgICAvLyBKb2luIGFsbCBvZiB0aGUgZWxlbWVudHMgdG9nZXRoZXIsIHNlcGFyYXRlZCB3aXRoIGNvbW1hcywgYW5kIHdyYXBcbiAgICAgIC8vIHRoZW0gaW4gYnJhY2tldHMuXG4gICAgICBpZiAocGFydGlhbC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdiA9ICdbXSc7XG4gICAgICB9IGVsc2UgaWYgKGlubmVySW5kZW50KSB7XG4gICAgICAgIHYgPSAnW1xcbicgK1xuICAgICAgICAgIGlubmVySW5kZW50ICtcbiAgICAgICAgICBwYXJ0aWFsLmpvaW4oJyxcXG4nICtcbiAgICAgICAgICBpbm5lckluZGVudCkgK1xuICAgICAgICAgICdcXG4nICtcbiAgICAgICAgICBvdXRlckluZGVudCArXG4gICAgICAgICAgJ10nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdiA9ICdbJyArIHBhcnRpYWwuam9pbignLCcpICsgJ10nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHY7XG4gICAgfVxuXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGFsbCBvZiB0aGUga2V5cyBpbiB0aGUgb2JqZWN0LlxuICAgIGxldCBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICAgIGlmIChjYW5vbmljYWwpIHtcbiAgICAgIGtleXMgPSBrZXlzLnNvcnQoKTtcbiAgICB9XG4gICAga2V5cy5mb3JFYWNoKGsgPT4ge1xuICAgICAgdiA9IHN0cihrLCB2YWx1ZSwgc2luZ2xlSW5kZW50LCBpbm5lckluZGVudCwgY2Fub25pY2FsKTtcbiAgICAgIGlmICh2KSB7XG4gICAgICAgIHBhcnRpYWwucHVzaChxdW90ZShrKSArIChpbm5lckluZGVudCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBKb2luIGFsbCBvZiB0aGUgbWVtYmVyIHRleHRzIHRvZ2V0aGVyLCBzZXBhcmF0ZWQgd2l0aCBjb21tYXMsXG4gICAgLy8gYW5kIHdyYXAgdGhlbSBpbiBicmFjZXMuXG4gICAgaWYgKHBhcnRpYWwubGVuZ3RoID09PSAwKSB7XG4gICAgICB2ID0gJ3t9JztcbiAgICB9IGVsc2UgaWYgKGlubmVySW5kZW50KSB7XG4gICAgICB2ID0gJ3tcXG4nICtcbiAgICAgICAgaW5uZXJJbmRlbnQgK1xuICAgICAgICBwYXJ0aWFsLmpvaW4oJyxcXG4nICtcbiAgICAgICAgaW5uZXJJbmRlbnQpICtcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICBvdXRlckluZGVudCArXG4gICAgICAgICd9JztcbiAgICB9IGVsc2Uge1xuICAgICAgdiA9ICd7JyArIHBhcnRpYWwuam9pbignLCcpICsgJ30nO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfVxuXG4gIGRlZmF1bHQ6IC8vIERvIG5vdGhpbmdcbiAgfVxufTtcblxuLy8gSWYgdGhlIEpTT04gb2JqZWN0IGRvZXMgbm90IHlldCBoYXZlIGEgc3RyaW5naWZ5IG1ldGhvZCwgZ2l2ZSBpdCBvbmUuXG5jb25zdCBjYW5vbmljYWxTdHJpbmdpZnkgPSAodmFsdWUsIG9wdGlvbnMpID0+IHtcbiAgLy8gTWFrZSBhIGZha2Ugcm9vdCBvYmplY3QgY29udGFpbmluZyBvdXIgdmFsdWUgdW5kZXIgdGhlIGtleSBvZiAnJy5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHQgb2Ygc3RyaW5naWZ5aW5nIHRoZSB2YWx1ZS5cbiAgY29uc3QgYWxsT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGluZGVudDogJycsXG4gICAgY2Fub25pY2FsOiBmYWxzZSxcbiAgfSwgb3B0aW9ucyk7XG4gIGlmIChhbGxPcHRpb25zLmluZGVudCA9PT0gdHJ1ZSkge1xuICAgIGFsbE9wdGlvbnMuaW5kZW50ID0gJyAgJztcbiAgfSBlbHNlIGlmICh0eXBlb2YgYWxsT3B0aW9ucy5pbmRlbnQgPT09ICdudW1iZXInKSB7XG4gICAgbGV0IG5ld0luZGVudCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsT3B0aW9ucy5pbmRlbnQ7IGkrKykge1xuICAgICAgbmV3SW5kZW50ICs9ICcgJztcbiAgICB9XG4gICAgYWxsT3B0aW9ucy5pbmRlbnQgPSBuZXdJbmRlbnQ7XG4gIH1cbiAgcmV0dXJuIHN0cignJywgeycnOiB2YWx1ZX0sIGFsbE9wdGlvbnMuaW5kZW50LCAnJywgYWxsT3B0aW9ucy5jYW5vbmljYWwpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY2Fub25pY2FsU3RyaW5naWZ5O1xuIiwiZXhwb3J0IGNvbnN0IGlzRnVuY3Rpb24gPSAoZm4pID0+IHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJztcblxuZXhwb3J0IGNvbnN0IGlzT2JqZWN0ID0gKGZuKSA9PiB0eXBlb2YgZm4gPT09ICdvYmplY3QnO1xuXG5leHBvcnQgY29uc3Qga2V5c09mID0gKG9iaikgPT4gT2JqZWN0LmtleXMob2JqKTtcblxuZXhwb3J0IGNvbnN0IGxlbmd0aE9mID0gKG9iaikgPT4gT2JqZWN0LmtleXMob2JqKS5sZW5ndGg7XG5cbmV4cG9ydCBjb25zdCBoYXNPd24gPSAob2JqLCBwcm9wKSA9PiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcblxuZXhwb3J0IGNvbnN0IGNvbnZlcnRNYXBUb09iamVjdCA9IChtYXApID0+IEFycmF5LmZyb20obWFwKS5yZWR1Y2UoKGFjYywgW2tleSwgdmFsdWVdKSA9PiB7XG4gIC8vIHJlYXNzaWduIHRvIG5vdCBjcmVhdGUgbmV3IG9iamVjdFxuICBhY2Nba2V5XSA9IHZhbHVlO1xuICByZXR1cm4gYWNjO1xufSwge30pO1xuXG5leHBvcnQgY29uc3QgaXNBcmd1bWVudHMgPSBvYmogPT4gb2JqICE9IG51bGwgJiYgaGFzT3duKG9iaiwgJ2NhbGxlZScpO1xuXG5leHBvcnQgY29uc3QgaXNJbmZPck5hTiA9XG4gIG9iaiA9PiBOdW1iZXIuaXNOYU4ob2JqKSB8fCBvYmogPT09IEluZmluaXR5IHx8IG9iaiA9PT0gLUluZmluaXR5O1xuXG5leHBvcnQgY29uc3QgY2hlY2tFcnJvciA9IHtcbiAgbWF4U3RhY2s6IChtc2dFcnJvcikgPT4gbmV3IFJlZ0V4cCgnTWF4aW11bSBjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWQnLCAnZycpLnRlc3QobXNnRXJyb3IpLFxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUVycm9yID0gKGZuKSA9PiBmdW5jdGlvbigpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zdCBpc01heFN0YWNrID0gY2hlY2tFcnJvci5tYXhTdGFjayhlcnJvci5tZXNzYWdlKTtcbiAgICBpZiAoaXNNYXhTdGFjaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb252ZXJ0aW5nIGNpcmN1bGFyIHN0cnVjdHVyZSB0byBKU09OJylcbiAgICB9XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG4iXX0=
