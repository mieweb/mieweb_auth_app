Package["core-runtime"].queue("minimongo",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var GeoJSON = Package['geojson-utils'].GeoJSON;
var IdMap = Package['id-map'].IdMap;
var MongoID = Package['mongo-id'].MongoID;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var Random = Package.random.Random;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Decimal = Package['mongo-decimal'].Decimal;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var operand, selectorValue, MinimongoTest, MinimongoError, selector, doc, callback, options, oldResults, a, b, LocalCollection, Minimongo;

var require = meteorInstall({"node_modules":{"meteor":{"minimongo":{"minimongo_server.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/minimongo_server.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("./minimongo_common.js");
    let hasOwn, isNumericKey, isOperatorObject, pathsToTree, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      pathsToTree(v) {
        pathsToTree = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Minimongo._pathsElidingNumericKeys = paths => paths.map(path => path.split('.').filter(part => !isNumericKey(part)).join('.'));

    // Returns true if the modifier applied to some document may change the result
    // of matching the document by selector
    // The modifier is always in a form of Object:
    //  - $set
    //    - 'a.b.22.z': value
    //    - 'foo.bar': 42
    //  - $unset
    //    - 'abc.d': 1
    Minimongo.Matcher.prototype.affectedByModifier = function (modifier) {
      // safe check for $set/$unset being objects
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const meaningfulPaths = this._getPaths();
      const modifiedPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      return modifiedPaths.some(path => {
        const mod = path.split('.');
        return meaningfulPaths.some(meaningfulPath => {
          const sel = meaningfulPath.split('.');
          let i = 0,
            j = 0;
          while (i < sel.length && j < mod.length) {
            if (isNumericKey(sel[i]) && isNumericKey(mod[j])) {
              // foo.4.bar selector affected by foo.4 modifier
              // foo.3.bar selector unaffected by foo.4 modifier
              if (sel[i] === mod[j]) {
                i++;
                j++;
              } else {
                return false;
              }
            } else if (isNumericKey(sel[i])) {
              // foo.4.bar selector unaffected by foo.bar modifier
              return false;
            } else if (isNumericKey(mod[j])) {
              j++;
            } else if (sel[i] === mod[j]) {
              i++;
              j++;
            } else {
              return false;
            }
          }

          // One is a prefix of another, taking numeric fields into account
          return true;
        });
      });
    };

    // @param modifier - Object: MongoDB-styled modifier with `$set`s and `$unsets`
    //                           only. (assumed to come from oplog)
    // @returns - Boolean: if after applying the modifier, selector can start
    //                     accepting the modified value.
    // NOTE: assumes that document affected by modifier didn't match this Matcher
    // before, so if modifier can't convince selector in a positive change it would
    // stay 'false'.
    // Currently doesn't support $-operators and numeric indices precisely.
    Minimongo.Matcher.prototype.canBecomeTrueByModifier = function (modifier) {
      if (!this.affectedByModifier(modifier)) {
        return false;
      }
      if (!this.isSimple()) {
        return true;
      }
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const modifierPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      if (this._getPaths().some(pathHasNumericKeys) || modifierPaths.some(pathHasNumericKeys)) {
        return true;
      }

      // check if there is a $set or $unset that indicates something is an
      // object rather than a scalar in the actual object where we saw $-operator
      // NOTE: it is correct since we allow only scalars in $-operators
      // Example: for selector {'a.b': {$gt: 5}} the modifier {'a.b.c':7} would
      // definitely set the result to false as 'a.b' appears to be an object.
      const expectedScalarIsObject = Object.keys(this._selector).some(path => {
        if (!isOperatorObject(this._selector[path])) {
          return false;
        }
        return modifierPaths.some(modifierPath => modifierPath.startsWith("".concat(path, ".")));
      });
      if (expectedScalarIsObject) {
        return false;
      }

      // See if we can apply the modifier on the ideally matching object. If it
      // still matches the selector, then the modifier could have turned the real
      // object in the database into something matching.
      const matchingDocument = EJSON.clone(this.matchingDocument());

      // The selector is too complex, anything can happen.
      if (matchingDocument === null) {
        return true;
      }
      try {
        LocalCollection._modify(matchingDocument, modifier);
      } catch (error) {
        // Couldn't set a property on a field which is a scalar or null in the
        // selector.
        // Example:
        // real document: { 'a.b': 3 }
        // selector: { 'a': 12 }
        // converted selector (ideal document): { 'a': 12 }
        // modifier: { $set: { 'a.b': 4 } }
        // We don't know what real document was like but from the error raised by
        // $set on a scalar field we can reason that the structure of real document
        // is completely different.
        if (error.name === 'MinimongoError' && error.setPropertyError) {
          return false;
        }
        throw error;
      }
      return this.documentMatches(matchingDocument).result;
    };

    // Knows how to combine a mongo selector and a fields projection to a new fields
    // projection taking into account active fields from the passed selector.
    // @returns Object - projection object (same as fields option of mongo cursor)
    Minimongo.Matcher.prototype.combineIntoProjection = function (projection) {
      const selectorPaths = Minimongo._pathsElidingNumericKeys(this._getPaths());

      // Special case for $where operator in the selector - projection should depend
      // on all fields of the document. getSelectorPaths returns a list of paths
      // selector depends on. If one of the paths is '' (empty string) representing
      // the root or the whole document, complete projection should be returned.
      if (selectorPaths.includes('')) {
        return {};
      }
      return combineImportantPathsIntoProjection(selectorPaths, projection);
    };

    // Returns an object that would match the selector if possible or null if the
    // selector is too complex for us to analyze
    // { 'a.b': { ans: 42 }, 'foo.bar': null, 'foo.baz': "something" }
    // => { a: { b: { ans: 42 } }, foo: { bar: null, baz: "something" } }
    Minimongo.Matcher.prototype.matchingDocument = function () {
      // check if it was computed before
      if (this._matchingDocument !== undefined) {
        return this._matchingDocument;
      }

      // If the analysis of this selector is too hard for our implementation
      // fallback to "YES"
      let fallback = false;
      this._matchingDocument = pathsToTree(this._getPaths(), path => {
        const valueSelector = this._selector[path];
        if (isOperatorObject(valueSelector)) {
          // if there is a strict equality, there is a good
          // chance we can use one of those as "matching"
          // dummy value
          if (valueSelector.$eq) {
            return valueSelector.$eq;
          }
          if (valueSelector.$in) {
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });

            // Return anything from $in that matches the whole selector for this
            // path. If nothing matches, returns `undefined` as nothing can make
            // this selector into `true`.
            return valueSelector.$in.find(placeholder => matcher.documentMatches({
              placeholder
            }).result);
          }
          if (onlyContainsKeys(valueSelector, ['$gt', '$gte', '$lt', '$lte'])) {
            let lowerBound = -Infinity;
            let upperBound = Infinity;
            ['$lte', '$lt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] < upperBound) {
                upperBound = valueSelector[op];
              }
            });
            ['$gte', '$gt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] > lowerBound) {
                lowerBound = valueSelector[op];
              }
            });
            const middle = (lowerBound + upperBound) / 2;
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });
            if (!matcher.documentMatches({
              placeholder: middle
            }).result && (middle === lowerBound || middle === upperBound)) {
              fallback = true;
            }
            return middle;
          }
          if (onlyContainsKeys(valueSelector, ['$nin', '$ne'])) {
            // Since this._isSimple makes sure $nin and $ne are not combined with
            // objects or arrays, we can confidently return an empty object as it
            // never matches any scalar.
            return {};
          }
          fallback = true;
        }
        return this._selector[path];
      }, x => x);
      if (fallback) {
        this._matchingDocument = null;
      }
      return this._matchingDocument;
    };

    // Minimongo.Sorter gets a similar method, which delegates to a Matcher it made
    // for this exact purpose.
    Minimongo.Sorter.prototype.affectedByModifier = function (modifier) {
      return this._selectorForAffectedByModifier.affectedByModifier(modifier);
    };
    Minimongo.Sorter.prototype.combineIntoProjection = function (projection) {
      return combineImportantPathsIntoProjection(Minimongo._pathsElidingNumericKeys(this._getPaths()), projection);
    };
    function combineImportantPathsIntoProjection(paths, projection) {
      const details = projectionDetails(projection);

      // merge the paths to include
      const tree = pathsToTree(paths, path => true, (node, path, fullPath) => true, details.tree);
      const mergedProjection = treeToPaths(tree);
      if (details.including) {
        // both selector and projection are pointing on fields to include
        // so we can just return the merged tree
        return mergedProjection;
      }

      // selector is pointing at fields to include
      // projection is pointing at fields to exclude
      // make sure we don't exclude important paths
      const mergedExclProjection = {};
      Object.keys(mergedProjection).forEach(path => {
        if (!mergedProjection[path]) {
          mergedExclProjection[path] = false;
        }
      });
      return mergedExclProjection;
    }
    function getPaths(selector) {
      return Object.keys(new Minimongo.Matcher(selector)._paths);

      // XXX remove it?
      // return Object.keys(selector).map(k => {
      //   // we don't know how to handle $where because it can be anything
      //   if (k === '$where') {
      //     return ''; // matches everything
      //   }

      //   // we branch from $or/$and/$nor operator
      //   if (['$or', '$and', '$nor'].includes(k)) {
      //     return selector[k].map(getPaths);
      //   }

      //   // the value is a literal or some comparison operator
      //   return k;
      // })
      //   .reduce((a, b) => a.concat(b), [])
      //   .filter((a, b, c) => c.indexOf(a) === b);
    }

    // A helper to ensure object has only certain keys
    function onlyContainsKeys(obj, keys) {
      return Object.keys(obj).every(k => keys.includes(k));
    }
    function pathHasNumericKeys(path) {
      return path.split('.').some(isNumericKey);
    }

    // Returns a set of key paths similar to
    // { 'foo.bar': 1, 'a.b.c': 1 }
    function treeToPaths(tree) {
      let prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      const result = {};
      Object.keys(tree).forEach(key => {
        const value = tree[key];
        if (value === Object(value)) {
          Object.assign(result, treeToPaths(value, "".concat(prefix + key, ".")));
        } else {
          result[prefix + key] = value;
        }
      });
      return result;
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"common.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/common.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      hasOwn: () => hasOwn,
      ELEMENT_OPERATORS: () => ELEMENT_OPERATORS,
      compileDocumentSelector: () => compileDocumentSelector,
      equalityElementMatcher: () => equalityElementMatcher,
      expandArraysInBranches: () => expandArraysInBranches,
      isIndexable: () => isIndexable,
      isNumericKey: () => isNumericKey,
      isOperatorObject: () => isOperatorObject,
      makeLookupFunction: () => makeLookupFunction,
      nothingMatcher: () => nothingMatcher,
      pathsToTree: () => pathsToTree,
      populateDocumentWithQueryFields: () => populateDocumentWithQueryFields,
      projectionDetails: () => projectionDetails,
      regexpElementMatcher: () => regexpElementMatcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;
    const ELEMENT_OPERATORS = {
      $lt: makeInequality(cmpValue => cmpValue < 0),
      $gt: makeInequality(cmpValue => cmpValue > 0),
      $lte: makeInequality(cmpValue => cmpValue <= 0),
      $gte: makeInequality(cmpValue => cmpValue >= 0),
      $mod: {
        compileElementSelector(operand) {
          if (!(Array.isArray(operand) && operand.length === 2 && typeof operand[0] === 'number' && typeof operand[1] === 'number')) {
            throw Error('argument to $mod must be an array of two numbers');
          }

          // XXX could require to be ints or round or something
          const divisor = operand[0];
          const remainder = operand[1];
          return value => typeof value === 'number' && value % divisor === remainder;
        }
      },
      $in: {
        compileElementSelector(operand) {
          if (!Array.isArray(operand)) {
            throw Error('$in needs an array');
          }
          const elementMatchers = operand.map(option => {
            if (option instanceof RegExp) {
              return regexpElementMatcher(option);
            }
            if (isOperatorObject(option)) {
              throw Error('cannot nest $ under $in');
            }
            return equalityElementMatcher(option);
          });
          return value => {
            // Allow {a: {$in: [null]}} to match when 'a' does not exist.
            if (value === undefined) {
              value = null;
            }
            return elementMatchers.some(matcher => matcher(value));
          };
        }
      },
      $size: {
        // {a: [[5, 5]]} must match {a: {$size: 1}} but not {a: {$size: 2}}, so we
        // don't want to consider the element [5,5] in the leaf array [[5,5]] as a
        // possible value.
        dontExpandLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            // Don't ask me why, but by experimentation, this seems to be what Mongo
            // does.
            operand = 0;
          } else if (typeof operand !== 'number') {
            throw Error('$size needs a number');
          }
          return value => Array.isArray(value) && value.length === operand;
        }
      },
      $type: {
        // {a: [5]} must not match {a: {$type: 4}} (4 means array), but it should
        // match {a: {$type: 1}} (1 means number), and {a: [[5]]} must match {$a:
        // {$type: 4}}. Thus, when we see a leaf array, we *should* expand it but
        // should *not* include it itself.
        dontIncludeLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            const operandAliasMap = {
              'double': 1,
              'string': 2,
              'object': 3,
              'array': 4,
              'binData': 5,
              'undefined': 6,
              'objectId': 7,
              'bool': 8,
              'date': 9,
              'null': 10,
              'regex': 11,
              'dbPointer': 12,
              'javascript': 13,
              'symbol': 14,
              'javascriptWithScope': 15,
              'int': 16,
              'timestamp': 17,
              'long': 18,
              'decimal': 19,
              'minKey': -1,
              'maxKey': 127
            };
            if (!hasOwn.call(operandAliasMap, operand)) {
              throw Error("unknown string alias for $type: ".concat(operand));
            }
            operand = operandAliasMap[operand];
          } else if (typeof operand === 'number') {
            if (operand === 0 || operand < -1 || operand > 19 && operand !== 127) {
              throw Error("Invalid numerical $type code: ".concat(operand));
            }
          } else {
            throw Error('argument to $type is not a number or a string');
          }
          return value => value !== undefined && LocalCollection._f._type(value) === operand;
        }
      },
      $bitsAllSet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllSet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => (bitmask[i] & byte) === byte);
          };
        }
      },
      $bitsAnySet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnySet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (~bitmask[i] & byte) !== byte);
          };
        }
      },
      $bitsAllClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => !(bitmask[i] & byte));
          };
        }
      },
      $bitsAnyClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnyClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (bitmask[i] & byte) !== byte);
          };
        }
      },
      $regex: {
        compileElementSelector(operand, valueSelector) {
          if (!(typeof operand === 'string' || operand instanceof RegExp)) {
            throw Error('$regex has to be a string or RegExp');
          }
          let regexp;
          if (valueSelector.$options !== undefined) {
            // Options passed in $options (even the empty string) always overrides
            // options in the RegExp object itself.

            // Be clear that we only support the JS-supported options, not extended
            // ones (eg, Mongo supports x and s). Ideally we would implement x and s
            // by transforming the regexp, but not today...
            if (/[^gim]/.test(valueSelector.$options)) {
              throw new Error('Only the i, m, and g regexp options are supported');
            }
            const source = operand instanceof RegExp ? operand.source : operand;
            regexp = new RegExp(source, valueSelector.$options);
          } else if (operand instanceof RegExp) {
            regexp = operand;
          } else {
            regexp = new RegExp(operand);
          }
          return regexpElementMatcher(regexp);
        }
      },
      $elemMatch: {
        dontExpandLeafArrays: true,
        compileElementSelector(operand, valueSelector, matcher) {
          if (!LocalCollection._isPlainObject(operand)) {
            throw Error('$elemMatch need an object');
          }
          const isDocMatcher = !isOperatorObject(Object.keys(operand).filter(key => !hasOwn.call(LOGICAL_OPERATORS, key)).reduce((a, b) => Object.assign(a, {
            [b]: operand[b]
          }), {}), true);
          let subMatcher;
          if (isDocMatcher) {
            // This is NOT the same as compileValueSelector(operand), and not just
            // because of the slightly different calling convention.
            // {$elemMatch: {x: 3}} means "an element has a field x:3", not
            // "consists only of a field x:3". Also, regexps and sub-$ are allowed.
            subMatcher = compileDocumentSelector(operand, matcher, {
              inElemMatch: true
            });
          } else {
            subMatcher = compileValueSelector(operand, matcher);
          }
          return value => {
            if (!Array.isArray(value)) {
              return false;
            }
            for (let i = 0; i < value.length; ++i) {
              const arrayElement = value[i];
              let arg;
              if (isDocMatcher) {
                // We can only match {$elemMatch: {b: 3}} against objects.
                // (We can also match against arrays, if there's numeric indices,
                // eg {$elemMatch: {'0.b': 3}} or {$elemMatch: {0: 3}}.)
                if (!isIndexable(arrayElement)) {
                  return false;
                }
                arg = arrayElement;
              } else {
                // dontIterate ensures that {a: {$elemMatch: {$gt: 5}}} matches
                // {a: [8]} but not {a: [[8]]}
                arg = [{
                  value: arrayElement,
                  dontIterate: true
                }];
              }
              // XXX support $near in $elemMatch by propagating $distance?
              if (subMatcher(arg).result) {
                return i; // specially understood to mean "use as arrayIndices"
              }
            }
            return false;
          };
        }
      }
    };
    // Operators that appear at the top level of a document selector.
    const LOGICAL_OPERATORS = {
      $and(subSelector, matcher, inElemMatch) {
        return andDocumentMatchers(compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch));
      },
      $or(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);

        // Special case: if there is only one matcher, use it directly, *preserving*
        // any arrayIndices it returns.
        if (matchers.length === 1) {
          return matchers[0];
        }
        return doc => {
          const result = matchers.some(fn => fn(doc).result);
          // $or does NOT set arrayIndices when it has multiple
          // sub-expressions. (Tested against MongoDB.)
          return {
            result
          };
        };
      },
      $nor(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);
        return doc => {
          const result = matchers.every(fn => !fn(doc).result);
          // Never set arrayIndices, because we only match if nothing in particular
          // 'matched' (and because this is consistent with MongoDB).
          return {
            result
          };
        };
      },
      $where(selectorValue, matcher) {
        // Record that *any* path may be used.
        matcher._recordPathUsed('');
        matcher._hasWhere = true;
        if (!(selectorValue instanceof Function)) {
          // XXX MongoDB seems to have more complex logic to decide where or or not
          // to add 'return'; not sure exactly what it is.
          selectorValue = Function('obj', "return ".concat(selectorValue));
        }

        // We make the document available as both `this` and `obj`.
        // // XXX not sure what we should do if this throws
        return doc => ({
          result: selectorValue.call(doc, doc)
        });
      },
      // This is just used as a comment in the query (in MongoDB, it also ends up in
      // query logs); it has no effect on the actual selection.
      $comment() {
        return () => ({
          result: true
        });
      }
    };

    // Operators that (unlike LOGICAL_OPERATORS) pertain to individual paths in a
    // document, but (unlike ELEMENT_OPERATORS) do not have a simple definition as
    // "match each branched value independently and combine with
    // convertElementMatcherToBranchedMatcher".
    const VALUE_OPERATORS = {
      $eq(operand) {
        return convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand));
      },
      $not(operand, valueSelector, matcher) {
        return invertBranchedMatcher(compileValueSelector(operand, matcher));
      },
      $ne(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand)));
      },
      $nin(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(ELEMENT_OPERATORS.$in.compileElementSelector(operand)));
      },
      $exists(operand) {
        const exists = convertElementMatcherToBranchedMatcher(value => value !== undefined);
        return operand ? exists : invertBranchedMatcher(exists);
      },
      // $options just provides options for $regex; its logic is inside $regex
      $options(operand, valueSelector) {
        if (!hasOwn.call(valueSelector, '$regex')) {
          throw Error('$options needs a $regex');
        }
        return everythingMatcher;
      },
      // $maxDistance is basically an argument to $near
      $maxDistance(operand, valueSelector) {
        if (!valueSelector.$near) {
          throw Error('$maxDistance needs a $near');
        }
        return everythingMatcher;
      },
      $all(operand, valueSelector, matcher) {
        if (!Array.isArray(operand)) {
          throw Error('$all requires array');
        }

        // Not sure why, but this seems to be what MongoDB does.
        if (operand.length === 0) {
          return nothingMatcher;
        }
        const branchedMatchers = operand.map(criterion => {
          // XXX handle $all/$elemMatch combination
          if (isOperatorObject(criterion)) {
            throw Error('no $ expressions in $all');
          }

          // This is always a regexp or equality selector.
          return compileValueSelector(criterion, matcher);
        });

        // andBranchedMatchers does NOT require all selectors to return true on the
        // SAME branch.
        return andBranchedMatchers(branchedMatchers);
      },
      $near(operand, valueSelector, matcher, isRoot) {
        if (!isRoot) {
          throw Error('$near can\'t be inside another $ operator');
        }
        matcher._hasGeoQuery = true;

        // There are two kinds of geodata in MongoDB: legacy coordinate pairs and
        // GeoJSON. They use different distance metrics, too. GeoJSON queries are
        // marked with a $geometry property, though legacy coordinates can be
        // matched using $geometry.
        let maxDistance, point, distance;
        if (LocalCollection._isPlainObject(operand) && hasOwn.call(operand, '$geometry')) {
          // GeoJSON "2dsphere" mode.
          maxDistance = operand.$maxDistance;
          point = operand.$geometry;
          distance = value => {
            // XXX: for now, we don't calculate the actual distance between, say,
            // polygon and circle. If people care about this use-case it will get
            // a priority.
            if (!value) {
              return null;
            }
            if (!value.type) {
              return GeoJSON.pointDistance(point, {
                type: 'Point',
                coordinates: pointToArray(value)
              });
            }
            if (value.type === 'Point') {
              return GeoJSON.pointDistance(point, value);
            }
            return GeoJSON.geometryWithinRadius(value, point, maxDistance) ? 0 : maxDistance + 1;
          };
        } else {
          maxDistance = valueSelector.$maxDistance;
          if (!isIndexable(operand)) {
            throw Error('$near argument must be coordinate pair or GeoJSON');
          }
          point = pointToArray(operand);
          distance = value => {
            if (!isIndexable(value)) {
              return null;
            }
            return distanceCoordinatePairs(point, value);
          };
        }
        return branchedValues => {
          // There might be multiple points in the document that match the given
          // field. Only one of them needs to be within $maxDistance, but we need to
          // evaluate all of them and use the nearest one for the implicit sort
          // specifier. (That's why we can't just use ELEMENT_OPERATORS here.)
          //
          // Note: This differs from MongoDB's implementation, where a document will
          // actually show up *multiple times* in the result set, with one entry for
          // each within-$maxDistance branching point.
          const result = {
            result: false
          };
          expandArraysInBranches(branchedValues).every(branch => {
            // if operation is an update, don't skip branches, just return the first
            // one (#3599)
            let curDistance;
            if (!matcher._isUpdate) {
              if (!(typeof branch.value === 'object')) {
                return true;
              }
              curDistance = distance(branch.value);

              // Skip branches that aren't real points or are too far away.
              if (curDistance === null || curDistance > maxDistance) {
                return true;
              }

              // Skip anything that's a tie.
              if (result.distance !== undefined && result.distance <= curDistance) {
                return true;
              }
            }
            result.result = true;
            result.distance = curDistance;
            if (branch.arrayIndices) {
              result.arrayIndices = branch.arrayIndices;
            } else {
              delete result.arrayIndices;
            }
            return !matcher._isUpdate;
          });
          return result;
        };
      }
    };

    // NB: We are cheating and using this function to implement 'AND' for both
    // 'document matchers' and 'branched matchers'. They both return result objects
    // but the argument is different: for the former it's a whole doc, whereas for
    // the latter it's an array of 'branched values'.
    function andSomeMatchers(subMatchers) {
      if (subMatchers.length === 0) {
        return everythingMatcher;
      }
      if (subMatchers.length === 1) {
        return subMatchers[0];
      }
      return docOrBranches => {
        const match = {};
        match.result = subMatchers.every(fn => {
          const subResult = fn(docOrBranches);

          // Copy a 'distance' number out of the first sub-matcher that has
          // one. Yes, this means that if there are multiple $near fields in a
          // query, something arbitrary happens; this appears to be consistent with
          // Mongo.
          if (subResult.result && subResult.distance !== undefined && match.distance === undefined) {
            match.distance = subResult.distance;
          }

          // Similarly, propagate arrayIndices from sub-matchers... but to match
          // MongoDB behavior, this time the *last* sub-matcher with arrayIndices
          // wins.
          if (subResult.result && subResult.arrayIndices) {
            match.arrayIndices = subResult.arrayIndices;
          }
          return subResult.result;
        });

        // If we didn't actually match, forget any extra metadata we came up with.
        if (!match.result) {
          delete match.distance;
          delete match.arrayIndices;
        }
        return match;
      };
    }
    const andDocumentMatchers = andSomeMatchers;
    const andBranchedMatchers = andSomeMatchers;
    function compileArrayOfDocumentSelectors(selectors, matcher, inElemMatch) {
      if (!Array.isArray(selectors) || selectors.length === 0) {
        throw Error('$and/$or/$nor must be nonempty array');
      }
      return selectors.map(subSelector => {
        if (!LocalCollection._isPlainObject(subSelector)) {
          throw Error('$or/$and/$nor entries need to be full objects');
        }
        return compileDocumentSelector(subSelector, matcher, {
          inElemMatch
        });
      });
    }

    // Takes in a selector that could match a full document (eg, the original
    // selector). Returns a function mapping document->result object.
    //
    // matcher is the Matcher object we are compiling.
    //
    // If this is the root document selector (ie, not wrapped in $and or the like),
    // then isRoot is true. (This is used by $near.)
    function compileDocumentSelector(docSelector, matcher) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      const docMatchers = Object.keys(docSelector).map(key => {
        const subSelector = docSelector[key];
        if (key.substr(0, 1) === '$') {
          // Outer operators are either logical operators (they recurse back into
          // this function), or $where.
          if (!hasOwn.call(LOGICAL_OPERATORS, key)) {
            throw new Error("Unrecognized logical operator: ".concat(key));
          }
          matcher._isSimple = false;
          return LOGICAL_OPERATORS[key](subSelector, matcher, options.inElemMatch);
        }

        // Record this path, but only if we aren't in an elemMatcher, since in an
        // elemMatch this is a path inside an object in an array, not in the doc
        // root.
        if (!options.inElemMatch) {
          matcher._recordPathUsed(key);
        }

        // Don't add a matcher if subSelector is a function -- this is to match
        // the behavior of Meteor on the server (inherited from the node mongodb
        // driver), which is to ignore any part of a selector which is a function.
        if (typeof subSelector === 'function') {
          return undefined;
        }
        const lookUpByIndex = makeLookupFunction(key);
        const valueMatcher = compileValueSelector(subSelector, matcher, options.isRoot);
        return doc => valueMatcher(lookUpByIndex(doc));
      }).filter(Boolean);
      return andDocumentMatchers(docMatchers);
    }
    // Takes in a selector that could match a key-indexed value in a document; eg,
    // {$gt: 5, $lt: 9}, or a regular expression, or any non-expression object (to
    // indicate equality).  Returns a branched matcher: a function mapping
    // [branched value]->result object.
    function compileValueSelector(valueSelector, matcher, isRoot) {
      if (valueSelector instanceof RegExp) {
        matcher._isSimple = false;
        return convertElementMatcherToBranchedMatcher(regexpElementMatcher(valueSelector));
      }
      if (isOperatorObject(valueSelector)) {
        return operatorBranchedMatcher(valueSelector, matcher, isRoot);
      }
      return convertElementMatcherToBranchedMatcher(equalityElementMatcher(valueSelector));
    }

    // Given an element matcher (which evaluates a single value), returns a branched
    // value (which evaluates the element matcher on all the branches and returns a
    // more structured return value possibly including arrayIndices).
    function convertElementMatcherToBranchedMatcher(elementMatcher) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      return branches => {
        const expanded = options.dontExpandLeafArrays ? branches : expandArraysInBranches(branches, options.dontIncludeLeafArrays);
        const match = {};
        match.result = expanded.some(element => {
          let matched = elementMatcher(element.value);

          // Special case for $elemMatch: it means "true, and use this as an array
          // index if I didn't already have one".
          if (typeof matched === 'number') {
            // XXX This code dates from when we only stored a single array index
            // (for the outermost array). Should we be also including deeper array
            // indices from the $elemMatch match?
            if (!element.arrayIndices) {
              element.arrayIndices = [matched];
            }
            matched = true;
          }

          // If some element matched, and it's tagged with array indices, include
          // those indices in our result object.
          if (matched && element.arrayIndices) {
            match.arrayIndices = element.arrayIndices;
          }
          return matched;
        });
        return match;
      };
    }

    // Helpers for $near.
    function distanceCoordinatePairs(a, b) {
      const pointA = pointToArray(a);
      const pointB = pointToArray(b);
      return Math.hypot(pointA[0] - pointB[0], pointA[1] - pointB[1]);
    }

    // Takes something that is not an operator object and returns an element matcher
    // for equality with that thing.
    function equalityElementMatcher(elementSelector) {
      if (isOperatorObject(elementSelector)) {
        throw Error('Can\'t create equalityValueSelector for operator object');
      }

      // Special-case: null and undefined are equal (if you got undefined in there
      // somewhere, or if you got it due to some branch being non-existent in the
      // weird special case), even though they aren't with EJSON.equals.
      // undefined or null
      if (elementSelector == null) {
        return value => value == null;
      }
      return value => LocalCollection._f._equal(elementSelector, value);
    }
    function everythingMatcher(docOrBranchedValues) {
      return {
        result: true
      };
    }
    function expandArraysInBranches(branches, skipTheArrays) {
      const branchesOut = [];
      branches.forEach(branch => {
        const thisIsArray = Array.isArray(branch.value);

        // We include the branch itself, *UNLESS* we it's an array that we're going
        // to iterate and we're told to skip arrays.  (That's right, we include some
        // arrays even skipTheArrays is true: these are arrays that were found via
        // explicit numerical indices.)
        if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {
          branchesOut.push({
            arrayIndices: branch.arrayIndices,
            value: branch.value
          });
        }
        if (thisIsArray && !branch.dontIterate) {
          branch.value.forEach((value, i) => {
            branchesOut.push({
              arrayIndices: (branch.arrayIndices || []).concat(i),
              value
            });
          });
        }
      });
      return branchesOut;
    }
    // Helpers for $bitsAllSet/$bitsAnySet/$bitsAllClear/$bitsAnyClear.
    function getOperandBitmask(operand, selector) {
      // numeric bitmask
      // You can provide a numeric bitmask to be matched against the operand field.
      // It must be representable as a non-negative 32-bit signed integer.
      // Otherwise, $bitsAllSet will return an error.
      if (Number.isInteger(operand) && operand >= 0) {
        return new Uint8Array(new Int32Array([operand]).buffer);
      }

      // bindata bitmask
      // You can also use an arbitrarily large BinData instance as a bitmask.
      if (EJSON.isBinary(operand)) {
        return new Uint8Array(operand.buffer);
      }

      // position list
      // If querying a list of bit positions, each <position> must be a non-negative
      // integer. Bit positions start at 0 from the least significant bit.
      if (Array.isArray(operand) && operand.every(x => Number.isInteger(x) && x >= 0)) {
        const buffer = new ArrayBuffer((Math.max(...operand) >> 3) + 1);
        const view = new Uint8Array(buffer);
        operand.forEach(x => {
          view[x >> 3] |= 1 << (x & 0x7);
        });
        return view;
      }

      // bad operand
      throw Error("operand to ".concat(selector, " must be a numeric bitmask (representable as a ") + 'non-negative 32-bit signed integer), a bindata bitmask or an array with ' + 'bit positions (non-negative integers)');
    }
    function getValueBitmask(value, length) {
      // The field value must be either numerical or a BinData instance. Otherwise,
      // $bits... will not match the current document.

      // numerical
      if (Number.isSafeInteger(value)) {
        // $bits... will not match numerical values that cannot be represented as a
        // signed 64-bit integer. This can be the case if a value is either too
        // large or small to fit in a signed 64-bit integer, or if it has a
        // fractional component.
        const buffer = new ArrayBuffer(Math.max(length, 2 * Uint32Array.BYTES_PER_ELEMENT));
        let view = new Uint32Array(buffer, 0, 2);
        view[0] = value % ((1 << 16) * (1 << 16)) | 0;
        view[1] = value / ((1 << 16) * (1 << 16)) | 0;

        // sign extension
        if (value < 0) {
          view = new Uint8Array(buffer, 2);
          view.forEach((byte, i) => {
            view[i] = 0xff;
          });
        }
        return new Uint8Array(buffer);
      }

      // bindata
      if (EJSON.isBinary(value)) {
        return new Uint8Array(value.buffer);
      }

      // no match
      return false;
    }

    // Actually inserts a key value into the selector document
    // However, this checks there is no ambiguity in setting
    // the value for the given key, throws otherwise
    function insertIntoDocument(document, key, value) {
      Object.keys(document).forEach(existingKey => {
        if (existingKey.length > key.length && existingKey.indexOf("".concat(key, ".")) === 0 || key.length > existingKey.length && key.indexOf("".concat(existingKey, ".")) === 0) {
          throw new Error("cannot infer query fields to set, both paths '".concat(existingKey, "' and ") + "'".concat(key, "' are matched"));
        } else if (existingKey === key) {
          throw new Error("cannot infer query fields to set, path '".concat(key, "' is matched twice"));
        }
      });
      document[key] = value;
    }

    // Returns a branched matcher that matches iff the given matcher does not.
    // Note that this implicitly "deMorganizes" the wrapped function.  ie, it
    // means that ALL branch values need to fail to match innerBranchedMatcher.
    function invertBranchedMatcher(branchedMatcher) {
      return branchValues => {
        // We explicitly choose to strip arrayIndices here: it doesn't make sense to
        // say "update the array element that does not match something", at least
        // in mongo-land.
        return {
          result: !branchedMatcher(branchValues).result
        };
      };
    }
    function isIndexable(obj) {
      return Array.isArray(obj) || LocalCollection._isPlainObject(obj);
    }
    function isNumericKey(s) {
      return /^[0-9]+$/.test(s);
    }
    function isOperatorObject(valueSelector, inconsistentOK) {
      if (!LocalCollection._isPlainObject(valueSelector)) {
        return false;
      }
      let theseAreOperators = undefined;
      Object.keys(valueSelector).forEach(selKey => {
        const thisIsOperator = selKey.substr(0, 1) === '$' || selKey === 'diff';
        if (theseAreOperators === undefined) {
          theseAreOperators = thisIsOperator;
        } else if (theseAreOperators !== thisIsOperator) {
          if (!inconsistentOK) {
            throw new Error("Inconsistent operator: ".concat(JSON.stringify(valueSelector)));
          }
          theseAreOperators = false;
        }
      });
      return !!theseAreOperators; // {} has no operators
    }
    // Helper for $lt/$gt/$lte/$gte.
    function makeInequality(cmpValueComparator) {
      return {
        compileElementSelector(operand) {
          // Arrays never compare false with non-arrays for any inequality.
          // XXX This was behavior we observed in pre-release MongoDB 2.5, but
          //     it seems to have been reverted.
          //     See https://jira.mongodb.org/browse/SERVER-11444
          if (Array.isArray(operand)) {
            return () => false;
          }

          // Special case: consider undefined and null the same (so true with
          // $gte/$lte).
          if (operand === undefined) {
            operand = null;
          }
          const operandType = LocalCollection._f._type(operand);
          return value => {
            if (value === undefined) {
              value = null;
            }

            // Comparisons are never true among things of different type (except
            // null vs undefined).
            if (LocalCollection._f._type(value) !== operandType) {
              return false;
            }
            return cmpValueComparator(LocalCollection._f._cmp(value, operand));
          };
        }
      };
    }

    // makeLookupFunction(key) returns a lookup function.
    //
    // A lookup function takes in a document and returns an array of matching
    // branches.  If no arrays are found while looking up the key, this array will
    // have exactly one branches (possibly 'undefined', if some segment of the key
    // was not found).
    //
    // If arrays are found in the middle, this can have more than one element, since
    // we 'branch'. When we 'branch', if there are more key segments to look up,
    // then we only pursue branches that are plain objects (not arrays or scalars).
    // This means we can actually end up with no branches!
    //
    // We do *NOT* branch on arrays that are found at the end (ie, at the last
    // dotted member of the key). We just return that array; if you want to
    // effectively 'branch' over the array's values, post-process the lookup
    // function with expandArraysInBranches.
    //
    // Each branch is an object with keys:
    //  - value: the value at the branch
    //  - dontIterate: an optional bool; if true, it means that 'value' is an array
    //    that expandArraysInBranches should NOT expand. This specifically happens
    //    when there is a numeric index in the key, and ensures the
    //    perhaps-surprising MongoDB behavior where {'a.0': 5} does NOT
    //    match {a: [[5]]}.
    //  - arrayIndices: if any array indexing was done during lookup (either due to
    //    explicit numeric indices or implicit branching), this will be an array of
    //    the array indices used, from outermost to innermost; it is falsey or
    //    absent if no array index is used. If an explicit numeric index is used,
    //    the index will be followed in arrayIndices by the string 'x'.
    //
    //    Note: arrayIndices is used for two purposes. First, it is used to
    //    implement the '$' modifier feature, which only ever looks at its first
    //    element.
    //
    //    Second, it is used for sort key generation, which needs to be able to tell
    //    the difference between different paths. Moreover, it needs to
    //    differentiate between explicit and implicit branching, which is why
    //    there's the somewhat hacky 'x' entry: this means that explicit and
    //    implicit array lookups will have different full arrayIndices paths. (That
    //    code only requires that different paths have different arrayIndices; it
    //    doesn't actually 'parse' arrayIndices. As an alternative, arrayIndices
    //    could contain objects with flags like 'implicit', but I think that only
    //    makes the code surrounding them more complex.)
    //
    //    (By the way, this field ends up getting passed around a lot without
    //    cloning, so never mutate any arrayIndices field/var in this package!)
    //
    //
    // At the top level, you may only pass in a plain object or array.
    //
    // See the test 'minimongo - lookup' for some examples of what lookup functions
    // return.
    function makeLookupFunction(key) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const parts = key.split('.');
      const firstPart = parts.length ? parts[0] : '';
      const lookupRest = parts.length > 1 && makeLookupFunction(parts.slice(1).join('.'), options);
      function buildResult(arrayIndices, dontIterate, value) {
        return arrayIndices && arrayIndices.length ? dontIterate ? [{
          arrayIndices,
          dontIterate,
          value
        }] : [{
          arrayIndices,
          value
        }] : dontIterate ? [{
          dontIterate,
          value
        }] : [{
          value
        }];
      }

      // Doc will always be a plain object or an array.
      // apply an explicit numeric index, an array.
      return (doc, arrayIndices) => {
        if (Array.isArray(doc)) {
          // If we're being asked to do an invalid lookup into an array (non-integer
          // or out-of-bounds), return no results (which is different from returning
          // a single undefined result, in that `null` equality checks won't match).
          if (!(isNumericKey(firstPart) && firstPart < doc.length)) {
            return [];
          }

          // Remember that we used this array index. Include an 'x' to indicate that
          // the previous index came from being considered as an explicit array
          // index (not branching).
          arrayIndices = arrayIndices ? arrayIndices.concat(+firstPart, 'x') : [+firstPart, 'x'];
        }

        // Do our first lookup.
        const firstLevel = doc[firstPart];

        // If there is no deeper to dig, return what we found.
        //
        // If what we found is an array, most value selectors will choose to treat
        // the elements of the array as matchable values in their own right, but
        // that's done outside of the lookup function. (Exceptions to this are $size
        // and stuff relating to $elemMatch.  eg, {a: {$size: 2}} does not match {a:
        // [[1, 2]]}.)
        //
        // That said, if we just did an *explicit* array lookup (on doc) to find
        // firstLevel, and firstLevel is an array too, we do NOT want value
        // selectors to iterate over it.  eg, {'a.0': 5} does not match {a: [[5]]}.
        // So in that case, we mark the return value as 'don't iterate'.
        if (!lookupRest) {
          return buildResult(arrayIndices, Array.isArray(doc) && Array.isArray(firstLevel), firstLevel);
        }

        // We need to dig deeper.  But if we can't, because what we've found is not
        // an array or plain object, we're done. If we just did a numeric index into
        // an array, we return nothing here (this is a change in Mongo 2.5 from
        // Mongo 2.4, where {'a.0.b': null} stopped matching {a: [5]}). Otherwise,
        // return a single `undefined` (which can, for example, match via equality
        // with `null`).
        if (!isIndexable(firstLevel)) {
          if (Array.isArray(doc)) {
            return [];
          }
          return buildResult(arrayIndices, false, undefined);
        }
        const result = [];
        const appendToResult = more => {
          result.push(...more);
        };

        // Dig deeper: look up the rest of the parts on whatever we've found.
        // (lookupRest is smart enough to not try to do invalid lookups into
        // firstLevel if it's an array.)
        appendToResult(lookupRest(firstLevel, arrayIndices));

        // If we found an array, then in *addition* to potentially treating the next
        // part as a literal integer lookup, we should also 'branch': try to look up
        // the rest of the parts on each array element in parallel.
        //
        // In this case, we *only* dig deeper into array elements that are plain
        // objects. (Recall that we only got this far if we have further to dig.)
        // This makes sense: we certainly don't dig deeper into non-indexable
        // objects. And it would be weird to dig into an array: it's simpler to have
        // a rule that explicit integer indexes only apply to an outer array, not to
        // an array you find after a branching search.
        //
        // In the special case of a numeric part in a *sort selector* (not a query
        // selector), we skip the branching: we ONLY allow the numeric part to mean
        // 'look up this index' in that case, not 'also look up this index in all
        // the elements of the array'.
        if (Array.isArray(firstLevel) && !(isNumericKey(parts[1]) && options.forSort)) {
          firstLevel.forEach((branch, arrayIndex) => {
            if (LocalCollection._isPlainObject(branch)) {
              appendToResult(lookupRest(branch, arrayIndices ? arrayIndices.concat(arrayIndex) : [arrayIndex]));
            }
          });
        }
        return result;
      };
    }
    // Object exported only for unit testing.
    // Use it to export private functions to test in Tinytest.
    MinimongoTest = {
      makeLookupFunction
    };
    MinimongoError = function (message) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (typeof message === 'string' && options.field) {
        message += " for field '".concat(options.field, "'");
      }
      const error = new Error(message);
      error.name = 'MinimongoError';
      return error;
    };
    function nothingMatcher(docOrBranchedValues) {
      return {
        result: false
      };
    }
    // Takes an operator object (an object with $ keys) and returns a branched
    // matcher for it.
    function operatorBranchedMatcher(valueSelector, matcher, isRoot) {
      // Each valueSelector works separately on the various branches.  So one
      // operator can match one branch and another can match another branch.  This
      // is OK.
      const operatorMatchers = Object.keys(valueSelector).map(operator => {
        const operand = valueSelector[operator];
        const simpleRange = ['$lt', '$lte', '$gt', '$gte'].includes(operator) && typeof operand === 'number';
        const simpleEquality = ['$ne', '$eq'].includes(operator) && operand !== Object(operand);
        const simpleInclusion = ['$in', '$nin'].includes(operator) && Array.isArray(operand) && !operand.some(x => x === Object(x));
        if (!(simpleRange || simpleInclusion || simpleEquality)) {
          matcher._isSimple = false;
        }
        if (hasOwn.call(VALUE_OPERATORS, operator)) {
          return VALUE_OPERATORS[operator](operand, valueSelector, matcher, isRoot);
        }
        if (hasOwn.call(ELEMENT_OPERATORS, operator)) {
          const options = ELEMENT_OPERATORS[operator];
          return convertElementMatcherToBranchedMatcher(options.compileElementSelector(operand, valueSelector, matcher), options);
        }
        throw new Error("Unrecognized operator: ".concat(operator));
      });
      return andBranchedMatchers(operatorMatchers);
    }

    // paths - Array: list of mongo style paths
    // newLeafFn - Function: of form function(path) should return a scalar value to
    //                       put into list created for that path
    // conflictFn - Function: of form function(node, path, fullPath) is called
    //                        when building a tree path for 'fullPath' node on
    //                        'path' was already a leaf with a value. Must return a
    //                        conflict resolution.
    // initial tree - Optional Object: starting tree.
    // @returns - Object: tree represented as a set of nested objects
    function pathsToTree(paths, newLeafFn, conflictFn) {
      let root = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      paths.forEach(path => {
        const pathArray = path.split('.');
        let tree = root;

        // use .every just for iteration with break
        const success = pathArray.slice(0, -1).every((key, i) => {
          if (!hasOwn.call(tree, key)) {
            tree[key] = {};
          } else if (tree[key] !== Object(tree[key])) {
            tree[key] = conflictFn(tree[key], pathArray.slice(0, i + 1).join('.'), path);

            // break out of loop if we are failing for this path
            if (tree[key] !== Object(tree[key])) {
              return false;
            }
          }
          tree = tree[key];
          return true;
        });
        if (success) {
          const lastKey = pathArray[pathArray.length - 1];
          if (hasOwn.call(tree, lastKey)) {
            tree[lastKey] = conflictFn(tree[lastKey], path, path);
          } else {
            tree[lastKey] = newLeafFn(path);
          }
        }
      });
      return root;
    }
    // Makes sure we get 2 elements array and assume the first one to be x and
    // the second one to y no matter what user passes.
    // In case user passes { lon: x, lat: y } returns [x, y]
    function pointToArray(point) {
      return Array.isArray(point) ? point.slice() : [point.x, point.y];
    }

    // Creating a document from an upsert is quite tricky.
    // E.g. this selector: {"$or": [{"b.foo": {"$all": ["bar"]}}]}, should result
    // in: {"b.foo": "bar"}
    // But this selector: {"$or": [{"b": {"foo": {"$all": ["bar"]}}}]} should throw
    // an error

    // Some rules (found mainly with trial & error, so there might be more):
    // - handle all childs of $and (or implicit $and)
    // - handle $or nodes with exactly 1 child
    // - ignore $or nodes with more than 1 child
    // - ignore $nor and $not nodes
    // - throw when a value can not be set unambiguously
    // - every value for $all should be dealt with as separate $eq-s
    // - threat all children of $all as $eq setters (=> set if $all.length === 1,
    //   otherwise throw error)
    // - you can not mix '$'-prefixed keys and non-'$'-prefixed keys
    // - you can only have dotted keys on a root-level
    // - you can not have '$'-prefixed keys more than one-level deep in an object

    // Handles one key/value pair to put in the selector document
    function populateDocumentWithKeyValue(document, key, value) {
      if (value && Object.getPrototypeOf(value) === Object.prototype) {
        populateDocumentWithObject(document, key, value);
      } else if (!(value instanceof RegExp)) {
        insertIntoDocument(document, key, value);
      }
    }

    // Handles a key, value pair to put in the selector document
    // if the value is an object
    function populateDocumentWithObject(document, key, value) {
      const keys = Object.keys(value);
      const unprefixedKeys = keys.filter(op => op[0] !== '$');
      if (unprefixedKeys.length > 0 || !keys.length) {
        // Literal (possibly empty) object ( or empty object )
        // Don't allow mixing '$'-prefixed with non-'$'-prefixed fields
        if (keys.length !== unprefixedKeys.length) {
          throw new Error("unknown operator: ".concat(unprefixedKeys[0]));
        }
        validateObject(value, key);
        insertIntoDocument(document, key, value);
      } else {
        Object.keys(value).forEach(op => {
          const object = value[op];
          if (op === '$eq') {
            populateDocumentWithKeyValue(document, key, object);
          } else if (op === '$all') {
            // every value for $all should be dealt with as separate $eq-s
            object.forEach(element => populateDocumentWithKeyValue(document, key, element));
          }
        });
      }
    }

    // Fills a document with certain fields from an upsert selector
    function populateDocumentWithQueryFields(query) {
      let document = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (Object.getPrototypeOf(query) === Object.prototype) {
        // handle implicit $and
        Object.keys(query).forEach(key => {
          const value = query[key];
          if (key === '$and') {
            // handle explicit $and
            value.forEach(element => populateDocumentWithQueryFields(element, document));
          } else if (key === '$or') {
            // handle $or nodes with exactly 1 child
            if (value.length === 1) {
              populateDocumentWithQueryFields(value[0], document);
            }
          } else if (key[0] !== '$') {
            // Ignore other '$'-prefixed logical selectors
            populateDocumentWithKeyValue(document, key, value);
          }
        });
      } else {
        // Handle meteor-specific shortcut for selecting _id
        if (LocalCollection._selectorIsId(query)) {
          insertIntoDocument(document, '_id', query);
        }
      }
      return document;
    }
    function projectionDetails(fields) {
      // Find the non-_id keys (_id is handled specially because it is included
      // unless explicitly excluded). Sort the keys, so that our code to detect
      // overlaps like 'foo' and 'foo.bar' can assume that 'foo' comes first.
      let fieldsKeys = Object.keys(fields).sort();

      // If _id is the only field in the projection, do not remove it, since it is
      // required to determine if this is an exclusion or exclusion. Also keep an
      // inclusive _id, since inclusive _id follows the normal rules about mixing
      // inclusive and exclusive fields. If _id is not the only field in the
      // projection and is exclusive, remove it so it can be handled later by a
      // special case, since exclusive _id is always allowed.
      if (!(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') && !(fieldsKeys.includes('_id') && fields._id)) {
        fieldsKeys = fieldsKeys.filter(key => key !== '_id');
      }
      let including = null; // Unknown

      fieldsKeys.forEach(keyPath => {
        const rule = !!fields[keyPath];
        if (including === null) {
          including = rule;
        }

        // This error message is copied from MongoDB shell
        if (including !== rule) {
          throw MinimongoError('You cannot currently mix including and excluding fields.');
        }
      });
      const projectionRulesTree = pathsToTree(fieldsKeys, path => including, (node, path, fullPath) => {
        // Check passed projection fields' keys: If you have two rules such as
        // 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If
        // that happens, there is a probability you are doing something wrong,
        // framework should notify you about such mistake earlier on cursor
        // compilation step than later during runtime.  Note, that real mongo
        // doesn't do anything about it and the later rule appears in projection
        // project, more priority it takes.
        //
        // Example, assume following in mongo shell:
        // > db.coll.insert({ a: { b: 23, c: 44 } })
        // > db.coll.find({}, { 'a': 1, 'a.b': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23}}
        // > db.coll.find({}, { 'a.b': 1, 'a': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23, "c": 44}}
        //
        // Note, how second time the return set of keys is different.
        const currentPath = fullPath;
        const anotherPath = path;
        throw MinimongoError("both ".concat(currentPath, " and ").concat(anotherPath, " found in fields option, ") + 'using both of them may trigger unexpected behavior. Did you mean to ' + 'use only one of them?');
      });
      return {
        including,
        tree: projectionRulesTree
      };
    }
    function regexpElementMatcher(regexp) {
      return value => {
        if (value instanceof RegExp) {
          return value.toString() === regexp.toString();
        }

        // Regexps only work against strings.
        if (typeof value !== 'string') {
          return false;
        }

        // Reset regexp's state to avoid inconsistent matching for objects with the
        // same value on consecutive calls of regexp.test. This happens only if the
        // regexp has the 'g' flag. Also note that ES6 introduces a new flag 'y' for
        // which we should *not* change the lastIndex but MongoDB doesn't support
        // either of these flags.
        regexp.lastIndex = 0;
        return regexp.test(value);
      };
    }
    // Validates the key in a path.
    // Objects that are nested more then 1 level cannot have dotted fields
    // or fields starting with '$'
    function validateKeyInPath(key, path) {
      if (key.includes('.')) {
        throw new Error("The dotted field '".concat(key, "' in '").concat(path, ".").concat(key, " is not valid for storage."));
      }
      if (key[0] === '$') {
        throw new Error("The dollar ($) prefixed field  '".concat(path, ".").concat(key, " is not valid for storage."));
      }
    }

    // Recursively validates an object that is nested more than one level deep
    function validateObject(object, path) {
      if (object && Object.getPrototypeOf(object) === Object.prototype) {
        Object.keys(object).forEach(key => {
          validateKeyInPath(key, path);
          validateObject(object[key], path + '.' + key);
        });
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"constants.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/constants.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  getAsyncMethodName: () => getAsyncMethodName,
  ASYNC_COLLECTION_METHODS: () => ASYNC_COLLECTION_METHODS,
  ASYNC_CURSOR_METHODS: () => ASYNC_CURSOR_METHODS,
  CLIENT_ONLY_METHODS: () => CLIENT_ONLY_METHODS
});
function getAsyncMethodName(method) {
  return "".concat(method.replace('_', ''), "Async");
}
const ASYNC_COLLECTION_METHODS = ['_createCappedCollection', 'dropCollection', 'dropIndex',
/**
 * @summary Creates the specified index on the collection.
 * @locus server
 * @method createIndexAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
 * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
 * @param {String} options.name Name of the index
 * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
 * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
 * @returns {Promise}
 */
'createIndex',
/**
 * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
 * @locus Anywhere
 * @method findOneAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} [selector] A query describing the documents to find
 * @param {Object} [options]
 * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
 * @param {Number} options.skip Number of results to skip at the beginning
 * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
 * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
 * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
 * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
 * @returns {Promise}
 */
'findOne',
/**
 * @summary Insert a document in the collection.  Returns its unique _id.
 * @locus Anywhere
 * @method  insertAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
 * @return {Promise}
 */
'insert',
/**
 * @summary Remove documents from the collection
 * @locus Anywhere
 * @method removeAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to remove
 * @return {Promise}
 */
'remove',
/**
 * @summary Modify one or more documents in the collection. Returns the number of matched documents.
 * @locus Anywhere
 * @method updateAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to modify
 * @param {MongoModifier} modifier Specifies how to modify the documents
 * @param {Object} [options]
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
 * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
 * @return {Promise}
 */
'update',
/**
 * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
 * @locus Anywhere
 * @method upsertAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to modify
 * @param {MongoModifier} modifier Specifies how to modify the documents
 * @param {Object} [options]
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @return {Promise}
 */
'upsert'];
const ASYNC_CURSOR_METHODS = [
/**
 * @deprecated in 2.9
 * @summary Returns the number of documents that match a query. This method is
 *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
 *          see `Collection.countDocuments` and
 *          `Collection.estimatedDocumentCount` for a replacement.
 * @memberOf Mongo.Cursor
 * @method  countAsync
 * @instance
 * @locus Anywhere
 * @returns {Promise}
 */
'count',
/**
 * @summary Return all matching documents as an Array.
 * @memberOf Mongo.Cursor
 * @method  fetchAsync
 * @instance
 * @locus Anywhere
 * @returns {Promise}
 */
'fetch',
/**
 * @summary Call `callback` once for each matching document, sequentially and
 *          synchronously.
 * @locus Anywhere
 * @method  forEachAsync
 * @instance
 * @memberOf Mongo.Cursor
 * @param {IterationCallback} callback Function to call. It will be called
 *                                     with three arguments: the document, a
 *                                     0-based index, and <em>cursor</em>
 *                                     itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside
 *                        `callback`.
 * @returns {Promise}
 */
'forEach',
/**
 * @summary Map callback over all matching documents.  Returns an Array.
 * @locus Anywhere
 * @method mapAsync
 * @instance
 * @memberOf Mongo.Cursor
 * @param {IterationCallback} callback Function to call. It will be called
 *                                     with three arguments: the document, a
 *                                     0-based index, and <em>cursor</em>
 *                                     itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside
 *                        `callback`.
 * @returns {Promise}
 */
'map'];
const CLIENT_ONLY_METHODS = ["findOne", "insert", "remove", "update", "upsert"];
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"cursor.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/cursor.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Cursor
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let hasOwn;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      }
    }, 1);
    let ASYNC_CURSOR_METHODS, getAsyncMethodName;
    module.link("./constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Cursor {
      // don't call this ctor directly.  use LocalCollection.find().
      constructor(collection, selector) {
        let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        this.collection = collection;
        this.sorter = null;
        this.matcher = new Minimongo.Matcher(selector);
        if (LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
          // stash for fast _id and { _id }
          this._selectorId = hasOwn.call(selector, '_id') ? selector._id : selector;
        } else {
          this._selectorId = undefined;
          if (this.matcher.hasGeoQuery() || options.sort) {
            this.sorter = new Minimongo.Sorter(options.sort || []);
          }
        }
        this.skip = options.skip || 0;
        this.limit = options.limit;
        this.fields = options.projection || options.fields;
        this._projectionFn = LocalCollection._compileProjection(this.fields || {});
        this._transform = LocalCollection.wrapTransform(options.transform);

        // by default, queries register w/ Tracker when it is available.
        if (typeof Tracker !== 'undefined') {
          this.reactive = options.reactive === undefined ? true : options.reactive;
        }
      }

      /**
       * @deprecated in 2.9
       * @summary Returns the number of documents that match a query. This method is
       *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
       *          see `Collection.countDocuments` and
       *          `Collection.estimatedDocumentCount` for a replacement.
       * @memberOf Mongo.Cursor
       * @method  count
       * @instance
       * @locus Anywhere
       * @returns {Number}
       */
      count() {
        if (this.reactive) {
          // allow the observe to be unordered
          this._depend({
            added: true,
            removed: true
          }, true);
        }
        return this._getRawObjects({
          ordered: true
        }).length;
      }

      /**
       * @summary Return all matching documents as an Array.
       * @memberOf Mongo.Cursor
       * @method  fetch
       * @instance
       * @locus Anywhere
       * @returns {Object[]}
       */
      fetch() {
        const result = [];
        this.forEach(doc => {
          result.push(doc);
        });
        return result;
      }
      [Symbol.iterator]() {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        let index = 0;
        const objects = this._getRawObjects({
          ordered: true
        });
        return {
          next: () => {
            if (index < objects.length) {
              // This doubles as a clone operation.
              let element = this._projectionFn(objects[index++]);
              if (this._transform) element = this._transform(element);
              return {
                value: element
              };
            }
            return {
              done: true
            };
          }
        };
      }
      [Symbol.asyncIterator]() {
        const syncResult = this[Symbol.iterator]();
        return {
          async next() {
            return Promise.resolve(syncResult.next());
          }
        };
      }

      /**
       * @callback IterationCallback
       * @param {Object} doc
       * @param {Number} index
       */
      /**
       * @summary Call `callback` once for each matching document, sequentially and
       *          synchronously.
       * @locus Anywhere
       * @method  forEach
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      forEach(callback, thisArg) {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        this._getRawObjects({
          ordered: true
        }).forEach((element, i) => {
          // This doubles as a clone operation.
          element = this._projectionFn(element);
          if (this._transform) {
            element = this._transform(element);
          }
          callback.call(thisArg, element, i, this);
        });
      }
      getTransform() {
        return this._transform;
      }

      /**
       * @summary Map callback over all matching documents.  Returns an Array.
       * @locus Anywhere
       * @method map
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      map(callback, thisArg) {
        const result = [];
        this.forEach((doc, i) => {
          result.push(callback.call(thisArg, doc, i, this));
        });
        return result;
      }

      // options to contain:
      //  * callbacks for observe():
      //    - addedAt (document, atIndex)
      //    - added (document)
      //    - changedAt (newDocument, oldDocument, atIndex)
      //    - changed (newDocument, oldDocument)
      //    - removedAt (document, atIndex)
      //    - removed (document)
      //    - movedTo (document, oldIndex, newIndex)
      //
      // attributes available on returned query handle:
      //  * stop(): end updates
      //  * collection: the collection this query is querying
      //
      // iff x is a returned query handle, (x instanceof
      // LocalCollection.ObserveHandle) is true
      //
      // initial results delivered through added callback
      // XXX maybe callbacks should take a list of objects, to expose transactions?
      // XXX maybe support field limiting (to limit what you're notified on)

      /**
       * @summary Watch a query.  Receive callbacks as the result set changes.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observe(options) {
        return LocalCollection._observeFromObserveChanges(this, options);
      }

      /**
       * @summary Watch a query.  Receive callbacks as the result set changes.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       */
      observeAsync(options) {
        return new Promise(resolve => resolve(this.observe(options)));
      }

      /**
       * @summary Watch a query. Receive callbacks as the result set changes. Only
       *          the differences between the old and new documents are passed to
       *          the callbacks.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observeChanges(options) {
        const ordered = LocalCollection._observeChangesCallbacksAreOrdered(options);

        // there are several places that assume you aren't combining skip/limit with
        // unordered observe.  eg, update's EJSON.clone, and the "there are several"
        // comment in _modifyAndNotify
        // XXX allow skip/limit with unordered observe
        if (!options._allow_unordered && !ordered && (this.skip || this.limit)) {
          throw new Error("Must use an ordered observe with skip or limit (i.e. 'addedBefore' " + "for observeChanges or 'addedAt' for observe, instead of 'added').");
        }
        if (this.fields && (this.fields._id === 0 || this.fields._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        const distances = this.matcher.hasGeoQuery() && ordered && new LocalCollection._IdMap();
        const query = {
          cursor: this,
          dirty: false,
          distances,
          matcher: this.matcher,
          // not fast pathed
          ordered,
          projectionFn: this._projectionFn,
          resultsSnapshot: null,
          sorter: ordered && this.sorter
        };
        let qid;

        // Non-reactive queries call added[Before] and then never call anything
        // else.
        if (this.reactive) {
          qid = this.collection.next_qid++;
          this.collection.queries[qid] = query;
        }
        query.results = this._getRawObjects({
          ordered,
          distances: query.distances
        });
        if (this.collection.paused) {
          query.resultsSnapshot = ordered ? [] : new LocalCollection._IdMap();
        }

        // wrap callbacks we were passed. callbacks only fire when not paused and
        // are never undefined
        // Filters out blacklisted fields according to cursor's projection.
        // XXX wrong place for this?

        // furthermore, callbacks enqueue until the operation we're working on is
        // done.
        const wrapCallback = fn => {
          if (!fn) {
            return () => {};
          }
          const self = this;
          return function /* args*/
          () {
            if (self.collection.paused) {
              return;
            }
            const args = arguments;
            self.collection._observeQueue.queueTask(() => {
              fn.apply(this, args);
            });
          };
        };
        query.added = wrapCallback(options.added);
        query.changed = wrapCallback(options.changed);
        query.removed = wrapCallback(options.removed);
        if (ordered) {
          query.addedBefore = wrapCallback(options.addedBefore);
          query.movedBefore = wrapCallback(options.movedBefore);
        }
        if (!options._suppress_initial && !this.collection.paused) {
          var _query$results, _query$results$size;
          const handler = doc => {
            const fields = EJSON.clone(doc);
            delete fields._id;
            if (ordered) {
              query.addedBefore(doc._id, this._projectionFn(fields), null);
            }
            query.added(doc._id, this._projectionFn(fields));
          };
          // it means it's just an array
          if (query.results.length) {
            for (const doc of query.results) {
              handler(doc);
            }
          }
          // it means it's an id map
          if ((_query$results = query.results) !== null && _query$results !== void 0 && (_query$results$size = _query$results.size) !== null && _query$results$size !== void 0 && _query$results$size.call(_query$results)) {
            query.results.forEach(handler);
          }
        }
        const handle = Object.assign(new LocalCollection.ObserveHandle(), {
          collection: this.collection,
          stop: () => {
            if (this.reactive) {
              delete this.collection.queries[qid];
            }
          },
          isReady: false,
          isReadyPromise: null
        });
        if (this.reactive && Tracker.active) {
          // XXX in many cases, the same observe will be recreated when
          // the current autorun is rerun.  we could save work by
          // letting it linger across rerun and potentially get
          // repurposed if the same observe is performed, using logic
          // similar to that of Meteor.subscribe.
          Tracker.onInvalidate(() => {
            handle.stop();
          });
        }

        // run the observe callbacks resulting from the initial contents
        // before we leave the observe.
        const drainResult = this.collection._observeQueue.drain();
        if (drainResult instanceof Promise) {
          handle.isReadyPromise = drainResult;
          drainResult.then(() => handle.isReady = true);
        } else {
          handle.isReady = true;
          handle.isReadyPromise = Promise.resolve();
        }
        return handle;
      }

      /**
       * @summary Watch a query. Receive callbacks as the result set changes. Only
       *          the differences between the old and new documents are passed to
       *          the callbacks.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observeChangesAsync(options) {
        return new Promise(resolve => {
          const handle = this.observeChanges(options);
          handle.isReadyPromise.then(() => resolve(handle));
        });
      }

      // XXX Maybe we need a version of observe that just calls a callback if
      // anything changed.
      _depend(changers, _allow_unordered) {
        if (Tracker.active) {
          const dependency = new Tracker.Dependency();
          const notify = dependency.changed.bind(dependency);
          dependency.depend();
          const options = {
            _allow_unordered,
            _suppress_initial: true
          };
          ['added', 'addedBefore', 'changed', 'movedBefore', 'removed'].forEach(fn => {
            if (changers[fn]) {
              options[fn] = notify;
            }
          });

          // observeChanges will stop() when this computation is invalidated
          this.observeChanges(options);
        }
      }
      _getCollectionName() {
        return this.collection.name;
      }

      // Returns a collection of matching objects, but doesn't deep copy them.
      //
      // If ordered is set, returns a sorted array, respecting sorter, skip, and
      // limit properties of the query provided that options.applySkipLimit is
      // not set to false (#1201). If sorter is falsey, no sort -- you get the
      // natural order.
      //
      // If ordered is not set, returns an object mapping from ID to doc (sorter,
      // skip and limit should not be set).
      //
      // If ordered is set and this cursor is a $near geoquery, then this function
      // will use an _IdMap to track each distance from the $near argument point in
      // order to use it as a sort key. If an _IdMap is passed in the 'distances'
      // argument, this function will clear it and use it for this purpose
      // (otherwise it will just create its own _IdMap). The observeChanges
      // implementation uses this to remember the distances after this function
      // returns.
      _getRawObjects() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // By default this method will respect skip and limit because .fetch(),
        // .forEach() etc... expect this behaviour. It can be forced to ignore
        // skip and limit by setting applySkipLimit to false (.count() does this,
        // for example)
        const applySkipLimit = options.applySkipLimit !== false;

        // XXX use OrderedDict instead of array, and make IdMap and OrderedDict
        // compatible
        const results = options.ordered ? [] : new LocalCollection._IdMap();

        // fast path for single ID value
        if (this._selectorId !== undefined) {
          // If you have non-zero skip and ask for a single id, you get nothing.
          // This is so it matches the behavior of the '{_id: foo}' path.
          if (applySkipLimit && this.skip) {
            return results;
          }
          const selectedDoc = this.collection._docs.get(this._selectorId);
          if (selectedDoc) {
            if (options.ordered) {
              results.push(selectedDoc);
            } else {
              results.set(this._selectorId, selectedDoc);
            }
          }
          return results;
        }

        // slow path for arbitrary selector, sort, skip, limit

        // in the observeChanges case, distances is actually part of the "query"
        // (ie, live results set) object.  in other cases, distances is only used
        // inside this function.
        let distances;
        if (this.matcher.hasGeoQuery() && options.ordered) {
          if (options.distances) {
            distances = options.distances;
            distances.clear();
          } else {
            distances = new LocalCollection._IdMap();
          }
        }
        this.collection._docs.forEach((doc, id) => {
          const matchResult = this.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (options.ordered) {
              results.push(doc);
              if (distances && matchResult.distance !== undefined) {
                distances.set(id, matchResult.distance);
              }
            } else {
              results.set(id, doc);
            }
          }

          // Override to ensure all docs are matched if ignoring skip & limit
          if (!applySkipLimit) {
            return true;
          }

          // Fast path for limited unsorted queries.
          // XXX 'length' check here seems wrong for ordered
          return !this.limit || this.skip || this.sorter || results.length !== this.limit;
        });
        if (!options.ordered) {
          return results;
        }
        if (this.sorter) {
          results.sort(this.sorter.getComparator({
            distances
          }));
        }

        // Return the full set of results if there is no skip or limit or if we're
        // ignoring them
        if (!applySkipLimit || !this.limit && !this.skip) {
          return results;
        }
        return results.slice(this.skip, this.limit ? this.limit + this.skip : results.length);
      }
      _publishCursor(subscription) {
        // XXX minimongo should not depend on mongo-livedata!
        if (!Package.mongo) {
          throw new Error("Can't publish from Minimongo without the `mongo` package.");
        }
        if (!this.collection.name) {
          throw new Error("Can't publish a cursor from a collection without a name.");
        }
        return Package.mongo.Mongo.Collection._publishCursor(this, subscription, this.collection.name);
      }
    }
    // Implements async version of cursor methods to keep collections isomorphic
    ASYNC_CURSOR_METHODS.forEach(method => {
      const asyncName = getAsyncMethodName(method);
      Cursor.prototype[asyncName] = function () {
        try {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          return Promise.resolve(this[method].apply(this, args));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/local_collection.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module.export({
      default: () => LocalCollection
    });
    let Cursor;
    module.link("./cursor.js", {
      default(v) {
        Cursor = v;
      }
    }, 0);
    let ObserveHandle;
    module.link("./observe_handle.js", {
      default(v) {
        ObserveHandle = v;
      }
    }, 1);
    let hasOwn, isIndexable, isNumericKey, isOperatorObject, populateDocumentWithQueryFields, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isIndexable(v) {
        isIndexable = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      populateDocumentWithQueryFields(v) {
        populateDocumentWithQueryFields = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 2);
    let getAsyncMethodName;
    module.link("./constants", {
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class LocalCollection {
      constructor(name) {
        this.name = name;
        // _id -> document (also containing id)
        this._docs = new LocalCollection._IdMap();
        this._observeQueue = Meteor.isClient ? new Meteor._SynchronousQueue() : new Meteor._AsynchronousQueue();
        this.next_qid = 1; // live query id generator

        // qid -> live query object. keys:
        //  ordered: bool. ordered queries have addedBefore/movedBefore callbacks.
        //  results: array (ordered) or object (unordered) of current results
        //    (aliased with this._docs!)
        //  resultsSnapshot: snapshot of results. null if not paused.
        //  cursor: Cursor object for the query.
        //  selector, sorter, (callbacks): functions
        this.queries = Object.create(null);

        // null if not saving originals; an IdMap from id to original document value
        // if saving originals. See comments before saveOriginals().
        this._savedOriginals = null;

        // True when observers are paused and we should not send callbacks.
        this.paused = false;
      }
      countDocuments(selector, options) {
        return this.find(selector !== null && selector !== void 0 ? selector : {}, options).countAsync();
      }
      estimatedDocumentCount(options) {
        return this.find({}, options).countAsync();
      }

      // options may include sort, skip, limit, reactive
      // sort may be any of these forms:
      //     {a: 1, b: -1}
      //     [["a", "asc"], ["b", "desc"]]
      //     ["a", ["b", "desc"]]
      //   (in the first form you're beholden to key enumeration order in
      //   your javascript VM)
      //
      // reactive: if given, and false, don't register with Tracker (default
      // is true)
      //
      // XXX possibly should support retrieving a subset of fields? and
      // have it be a hint (ignored on the client, when not copying the
      // doc?)
      //
      // XXX sort does not yet support subkeys ('a.b') .. fix that!
      // XXX add one more sort form: "key"
      // XXX tests
      find(selector, options) {
        // default syntax for everything is to omit the selector argument.
        // but if selector is explicitly passed in as false or undefined, we
        // want a selector that matches nothing.
        if (arguments.length === 0) {
          selector = {};
        }
        return new LocalCollection.Cursor(this, selector, options);
      }
      findOne(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }

        // NOTE: by setting limit 1 here, we end up using very inefficient
        // code that recomputes the whole query on each update. The upside is
        // that when you reactively depend on a findOne you only get
        // invalidated when the found object changes, not any object in the
        // collection. Most findOne will be by id, which has a fast path, so
        // this might not be a big deal. In most cases, invalidation causes
        // the called to re-query anyway, so this should be a net performance
        // improvement.
        options.limit = 1;
        return this.find(selector, options).fetch()[0];
      }
      async findOneAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }
        options.limit = 1;
        return (await this.find(selector, options).fetchAsync())[0];
      }
      prepareInsert(doc) {
        assertHasValidFieldNames(doc);

        // if you really want to use ObjectIDs, set this global.
        // Mongo.Collection specifies its own ids and does not use this code.
        if (!hasOwn.call(doc, '_id')) {
          doc._id = LocalCollection._useOID ? new MongoID.ObjectID() : Random.id();
        }
        const id = doc._id;
        if (this._docs.has(id)) {
          throw MinimongoError("Duplicate _id '".concat(id, "'"));
        }
        this._saveOriginal(id, undefined);
        this._docs.set(id, doc);
        return id;
      }

      // XXX possibly enforce that 'undefined' does not appear (we assume
      // this in our handling of null and $exists)
      insert(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              LocalCollection._insertInResultsSync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }
      async insertAsync(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              await LocalCollection._insertInResultsAsync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        await this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }

      // Pause the observers. No callbacks from observers will fire until
      // 'resumeObservers' is called.
      pauseObservers() {
        // No-op if already paused.
        if (this.paused) {
          return;
        }

        // Set the 'paused' flag such that new observer messages don't fire.
        this.paused = true;

        // Take a snapshot of the query results for each query.
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          query.resultsSnapshot = EJSON.clone(query.results);
        });
      }
      clearResultQueries(callback) {
        const result = this._docs.size();
        this._docs.clear();
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.ordered) {
            query.results = [];
          } else {
            query.results.clear();
          }
        });
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      prepareRemove(selector) {
        const matcher = new Minimongo.Matcher(selector);
        const remove = [];
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          if (matcher.documentMatches(doc).result) {
            remove.push(id);
          }
        });
        const queriesToRecompute = [];
        const queryRemove = [];
        for (let i = 0; i < remove.length; i++) {
          const removeId = remove[i];
          const removeDoc = this._docs.get(removeId);
          Object.keys(this.queries).forEach(qid => {
            const query = this.queries[qid];
            if (query.dirty) {
              return;
            }
            if (query.matcher.documentMatches(removeDoc).result) {
              if (query.cursor.skip || query.cursor.limit) {
                queriesToRecompute.push(qid);
              } else {
                queryRemove.push({
                  qid,
                  doc: removeDoc
                });
              }
            }
          });
          this._saveOriginal(removeId, removeDoc);
          this._docs.remove(removeId);
        }
        return {
          queriesToRecompute,
          queryRemove,
          remove
        };
      }
      remove(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        queryRemove.forEach(remove => {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            LocalCollection._removeFromResultsSync(query, remove.doc);
          }
        });
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      async removeAsync(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        for (const remove of queryRemove) {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            await LocalCollection._removeFromResultsAsync(query, remove.doc);
          }
        }
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        await this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // Resume the observers. Observers immediately receive change
      // notifications to bring them to the current state of the
      // database. Note that this is not just replaying all the changes that
      // happened during the pause, it is a smarter 'coalesced' diff.
      _resumeObservers() {
        // No-op if not paused.
        if (!this.paused) {
          return;
        }

        // Unset the 'paused' flag. Make sure to do this first, otherwise
        // observer methods won't actually fire when we trigger them.
        this.paused = false;
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            query.dirty = false;

            // re-compute results will perform `LocalCollection._diffQueryChanges`
            // automatically.
            this._recomputeResults(query, query.resultsSnapshot);
          } else {
            // Diff the current results against the snapshot and send to observers.
            // pass the query object for its observer callbacks.
            LocalCollection._diffQueryChanges(query.ordered, query.resultsSnapshot, query.results, query, {
              projectionFn: query.projectionFn
            });
          }
          query.resultsSnapshot = null;
        });
      }
      async resumeObserversServer() {
        this._resumeObservers();
        await this._observeQueue.drain();
      }
      resumeObserversClient() {
        this._resumeObservers();
        this._observeQueue.drain();
      }
      retrieveOriginals() {
        if (!this._savedOriginals) {
          throw new Error('Called retrieveOriginals without saveOriginals');
        }
        const originals = this._savedOriginals;
        this._savedOriginals = null;
        return originals;
      }

      // To track what documents are affected by a piece of code, call
      // saveOriginals() before it and retrieveOriginals() after it.
      // retrieveOriginals returns an object whose keys are the ids of the documents
      // that were affected since the call to saveOriginals(), and the values are
      // equal to the document's contents at the time of saveOriginals. (In the case
      // of an inserted document, undefined is the value.) You must alternate
      // between calls to saveOriginals() and retrieveOriginals().
      saveOriginals() {
        if (this._savedOriginals) {
          throw new Error('Called saveOriginals twice without retrieveOriginals');
        }
        this._savedOriginals = new LocalCollection._IdMap();
      }
      prepareUpdate(selector) {
        // Save the original results of any query that we might need to
        // _recomputeResults on, because _modifyAndNotify will mutate the objects in
        // it. (We don't need to save the original results of paused queries because
        // they already have a resultsSnapshot and we won't be diffing in
        // _recomputeResults.)
        const qidToOriginalResults = {};

        // We should only clone each document once, even if it appears in multiple
        // queries
        const docMap = new LocalCollection._IdMap();
        const idsMatched = LocalCollection._idsMatchedBySelector(selector);
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if ((query.cursor.skip || query.cursor.limit) && !this.paused) {
            // Catch the case of a reactive `count()` on a cursor with skip
            // or limit, which registers an unordered observe. This is a
            // pretty rare case, so we just clone the entire result set with
            // no optimizations for documents that appear in these result
            // sets and other queries.
            if (query.results instanceof LocalCollection._IdMap) {
              qidToOriginalResults[qid] = query.results.clone();
              return;
            }
            if (!(query.results instanceof Array)) {
              throw new Error('Assertion failed: query.results not an array');
            }

            // Clones a document to be stored in `qidToOriginalResults`
            // because it may be modified before the new and old result sets
            // are diffed. But if we know exactly which document IDs we're
            // going to modify, then we only need to clone those.
            const memoizedCloneIfNeeded = doc => {
              if (docMap.has(doc._id)) {
                return docMap.get(doc._id);
              }
              const docToMemoize = idsMatched && !idsMatched.some(id => EJSON.equals(id, doc._id)) ? doc : EJSON.clone(doc);
              docMap.set(doc._id, docToMemoize);
              return docToMemoize;
            };
            qidToOriginalResults[qid] = query.results.map(memoizedCloneIfNeeded);
          }
        });
        return qidToOriginalResults;
      }
      finishUpdate(_ref) {
        let {
          options,
          updateCount,
          callback,
          insertedId
        } = _ref;
        // Return the number of affected documents, or in the upsert case, an object
        // containing the number of affected docs and the id of the doc that was
        // inserted, if any.
        let result;
        if (options._returnObject) {
          result = {
            numberAffected: updateCount
          };
          if (insertedId !== undefined) {
            result.insertedId = insertedId;
          }
        } else {
          result = updateCount;
        }
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      async updateAsync(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        await this._eachPossiblyMatchingDocAsync(selector, async (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = await this._modifyAndNotifyAsync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }
          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        await this._observeQueue.drain();

        // If we are doing an upsert, and we didn't modify any documents yet, then
        // it's time to do an insert. Figure out what document we are inserting, and
        // generate an id for it.
        let insertedId;
        if (updateCount === 0 && options.upsert) {
          const doc = LocalCollection._createUpsertDocument(selector, mod);
          if (!doc._id && options.insertedId) {
            doc._id = options.insertedId;
          }
          insertedId = await this.insertAsync(doc);
          updateCount = 1;
        }
        return this.finishUpdate({
          options,
          insertedId,
          updateCount,
          callback
        });
      }
      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      update(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = this._modifyAndNotifySync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }
          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        this._observeQueue.drain();

        // If we are doing an upsert, and we didn't modify any documents yet, then
        // it's time to do an insert. Figure out what document we are inserting, and
        // generate an id for it.
        let insertedId;
        if (updateCount === 0 && options.upsert) {
          const doc = LocalCollection._createUpsertDocument(selector, mod);
          if (!doc._id && options.insertedId) {
            doc._id = options.insertedId;
          }
          insertedId = this.insert(doc);
          updateCount = 1;
        }
        return this.finishUpdate({
          options,
          updateCount,
          callback,
          selector,
          mod
        });
      }

      // A convenience wrapper on update. LocalCollection.upsert(sel, mod) is
      // equivalent to LocalCollection.update(sel, mod, {upsert: true,
      // _returnObject: true}).
      upsert(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }
      upsertAsync(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.updateAsync(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }

      // Iterates over a subset of documents that could match selector; calls
      // fn(doc, id) on each of them.  Specifically, if selector specifies
      // specific _id's, it only looks at those.  doc is *not* cloned: it is the
      // same object that is in _docs.
      async _eachPossiblyMatchingDocAsync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !(await fn(doc, id))) {
              break;
            }
          }
        } else {
          await this._docs.forEachAsync(fn);
        }
      }
      _eachPossiblyMatchingDocSync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !fn(doc, id)) {
              break;
            }
          }
        } else {
          this._docs.forEach(fn);
        }
      }
      _getMatchedDocAndModify(doc, mod, arrayIndices) {
        const matched_before = {};
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            return;
          }
          if (query.ordered) {
            matched_before[qid] = query.matcher.documentMatches(doc).result;
          } else {
            // Because we don't support skip or limit (yet) in unordered queries, we
            // can just do a direct lookup.
            matched_before[qid] = query.results.has(doc._id);
          }
        });
        return matched_before;
      }
      _modifyAndNotifySync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            LocalCollection._removeFromResultsSync(query, doc);
          } else if (!before && after) {
            LocalCollection._insertInResultsSync(query, doc);
          } else if (before && after) {
            LocalCollection._updateInResultsSync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }
      async _modifyAndNotifyAsync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            await LocalCollection._removeFromResultsAsync(query, doc);
          } else if (!before && after) {
            await LocalCollection._insertInResultsAsync(query, doc);
          } else if (before && after) {
            await LocalCollection._updateInResultsAsync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }

      // Recomputes the results of a query and runs observe callbacks for the
      // difference between the previous results and the current results (unless
      // paused). Used for skip/limit queries.
      //
      // When this is used by insert or remove, it can just use query.results for
      // the old results (and there's no need to pass in oldResults), because these
      // operations don't mutate the documents in the collection. Update needs to
      // pass in an oldResults which was deep-copied before the modifier was
      // applied.
      //
      // oldResults is guaranteed to be ignored if the query is not paused.
      _recomputeResults(query, oldResults) {
        if (this.paused) {
          // There's no reason to recompute the results now as we're still paused.
          // By flagging the query as "dirty", the recompute will be performed
          // when resumeObservers is called.
          query.dirty = true;
          return;
        }
        if (!this.paused && !oldResults) {
          oldResults = query.results;
        }
        if (query.distances) {
          query.distances.clear();
        }
        query.results = query.cursor._getRawObjects({
          distances: query.distances,
          ordered: query.ordered
        });
        if (!this.paused) {
          LocalCollection._diffQueryChanges(query.ordered, oldResults, query.results, query, {
            projectionFn: query.projectionFn
          });
        }
      }
      _saveOriginal(id, doc) {
        // Are we even trying to save originals?
        if (!this._savedOriginals) {
          return;
        }

        // Have we previously mutated the original (and so 'doc' is not actually
        // original)?  (Note the 'has' check rather than truth: we store undefined
        // here for inserted docs!)
        if (this._savedOriginals.has(id)) {
          return;
        }
        this._savedOriginals.set(id, EJSON.clone(doc));
      }
    }
    LocalCollection.Cursor = Cursor;
    LocalCollection.ObserveHandle = ObserveHandle;

    // XXX maybe move these into another ObserveHelpers package or something

    // _CachingChangeObserver is an object which receives observeChanges callbacks
    // and keeps a cache of the current cursor state up to date in this.docs. Users
    // of this class should read the docs field but not modify it. You should pass
    // the "applyChange" field as the callbacks to the underlying observeChanges
    // call. Optionally, you can specify your own observeChanges callbacks which are
    // invoked immediately before the docs field is updated; this object is made
    // available as `this` to those callbacks.
    LocalCollection._CachingChangeObserver = class _CachingChangeObserver {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        const orderedFromCallbacks = options.callbacks && LocalCollection._observeChangesCallbacksAreOrdered(options.callbacks);
        if (hasOwn.call(options, 'ordered')) {
          this.ordered = options.ordered;
          if (options.callbacks && options.ordered !== orderedFromCallbacks) {
            throw Error('ordered option doesn\'t match callbacks');
          }
        } else if (options.callbacks) {
          this.ordered = orderedFromCallbacks;
        } else {
          throw Error('must provide ordered or callbacks');
        }
        const callbacks = options.callbacks || {};
        if (this.ordered) {
          this.docs = new OrderedDict(MongoID.idStringify);
          this.applyChange = {
            addedBefore: (id, fields, before) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              doc._id = id;
              if (callbacks.addedBefore) {
                callbacks.addedBefore.call(this, id, EJSON.clone(fields), before);
              }

              // This line triggers if we provide added with movedBefore.
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }

              // XXX could `before` be a falsy ID?  Technically
              // idStringify seems to allow for them -- though
              // OrderedDict won't call stringify on a falsy arg.
              this.docs.putBefore(id, doc, before || null);
            },
            movedBefore: (id, before) => {
              if (callbacks.movedBefore) {
                callbacks.movedBefore.call(this, id, before);
              }
              this.docs.moveBefore(id, before || null);
            }
          };
        } else {
          this.docs = new LocalCollection._IdMap();
          this.applyChange = {
            added: (id, fields) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }
              doc._id = id;
              this.docs.set(id, doc);
            }
          };
        }

        // The methods in _IdMap and OrderedDict used by these callbacks are
        // identical.
        this.applyChange.changed = (id, fields) => {
          const doc = this.docs.get(id);
          if (!doc) {
            throw new Error("Unknown id for changed: ".concat(id));
          }
          if (callbacks.changed) {
            callbacks.changed.call(this, id, EJSON.clone(fields));
          }
          DiffSequence.applyChanges(doc, fields);
        };
        this.applyChange.removed = id => {
          if (callbacks.removed) {
            callbacks.removed.call(this, id);
          }
          this.docs.remove(id);
        };
      }
    };
    LocalCollection._IdMap = class _IdMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    };

    // Wrap a transform function to return objects that have the _id field
    // of the untransformed document. This ensures that subsystems such as
    // the observe-sequence package that call `observe` can keep track of
    // the documents identities.
    //
    // - Require that it returns objects
    // - If the return value has an _id field, verify that it matches the
    //   original _id field
    // - If the return value doesn't have an _id field, add it back.
    LocalCollection.wrapTransform = transform => {
      if (!transform) {
        return null;
      }

      // No need to doubly-wrap transforms.
      if (transform.__wrappedTransform__) {
        return transform;
      }
      const wrapped = doc => {
        if (!hasOwn.call(doc, '_id')) {
          // XXX do we ever have a transform on the oplog's collection? because that
          // collection has no _id.
          throw new Error('can only transform documents with _id');
        }
        const id = doc._id;

        // XXX consider making tracker a weak dependency and checking
        // Package.tracker here
        const transformed = Tracker.nonreactive(() => transform(doc));
        if (!LocalCollection._isPlainObject(transformed)) {
          throw new Error('transform must return object');
        }
        if (hasOwn.call(transformed, '_id')) {
          if (!EJSON.equals(transformed._id, id)) {
            throw new Error('transformed document can\'t have different _id');
          }
        } else {
          transformed._id = id;
        }
        return transformed;
      };
      wrapped.__wrappedTransform__ = true;
      return wrapped;
    };

    // XXX the sorted-query logic below is laughably inefficient. we'll
    // need to come up with a better datastructure for this.
    //
    // XXX the logic for observing with a skip or a limit is even more
    // laughably inefficient. we recompute the whole results every time!

    // This binary search puts a value between any equal values, and the first
    // lesser value.
    LocalCollection._binarySearch = (cmp, array, value) => {
      let first = 0;
      let range = array.length;
      while (range > 0) {
        const halfRange = Math.floor(range / 2);
        if (cmp(value, array[first + halfRange]) >= 0) {
          first += halfRange + 1;
          range -= halfRange + 1;
        } else {
          range = halfRange;
        }
      }
      return first;
    };
    LocalCollection._checkSupportedProjection = fields => {
      if (fields !== Object(fields) || Array.isArray(fields)) {
        throw MinimongoError('fields option must be an object');
      }
      Object.keys(fields).forEach(keyPath => {
        if (keyPath.split('.').includes('$')) {
          throw MinimongoError('Minimongo doesn\'t support $ operator in projections yet.');
        }
        const value = fields[keyPath];
        if (typeof value === 'object' && ['$elemMatch', '$meta', '$slice'].some(key => hasOwn.call(value, key))) {
          throw MinimongoError('Minimongo doesn\'t support operators in projections yet.');
        }
        if (![1, 0, true, false].includes(value)) {
          throw MinimongoError('Projection values should be one of 1, 0, true, or false');
        }
      });
    };

    // Knows how to compile a fields projection to a predicate function.
    // @returns - Function: a closure that filters out an object according to the
    //            fields projection rules:
    //            @param obj - Object: MongoDB-styled document
    //            @returns - Object: a document with the fields filtered out
    //                       according to projection rules. Doesn't retain subfields
    //                       of passed argument.
    LocalCollection._compileProjection = fields => {
      LocalCollection._checkSupportedProjection(fields);
      const _idProjection = fields._id === undefined ? true : fields._id;
      const details = projectionDetails(fields);

      // returns transformed doc according to ruleTree
      const transform = (doc, ruleTree) => {
        // Special case for "sets"
        if (Array.isArray(doc)) {
          return doc.map(subdoc => transform(subdoc, ruleTree));
        }
        const result = details.including ? {} : EJSON.clone(doc);
        Object.keys(ruleTree).forEach(key => {
          if (doc == null || !hasOwn.call(doc, key)) {
            return;
          }
          const rule = ruleTree[key];
          if (rule === Object(rule)) {
            // For sub-objects/subsets we branch
            if (doc[key] === Object(doc[key])) {
              result[key] = transform(doc[key], rule);
            }
          } else if (details.including) {
            // Otherwise we don't even touch this subfield
            result[key] = EJSON.clone(doc[key]);
          } else {
            delete result[key];
          }
        });
        return doc != null ? result : doc;
      };
      return doc => {
        const result = transform(doc, details.tree);
        if (_idProjection && hasOwn.call(doc, '_id')) {
          result._id = doc._id;
        }
        if (!_idProjection && hasOwn.call(result, '_id')) {
          delete result._id;
        }
        return result;
      };
    };

    // Calculates the document to insert in case we're doing an upsert and the
    // selector does not match any elements
    LocalCollection._createUpsertDocument = (selector, modifier) => {
      const selectorDocument = populateDocumentWithQueryFields(selector);
      const isModify = LocalCollection._isModificationMod(modifier);
      const newDoc = {};
      if (selectorDocument._id) {
        newDoc._id = selectorDocument._id;
        delete selectorDocument._id;
      }

      // This double _modify call is made to help with nested properties (see issue
      // #8631). We do this even if it's a replacement for validation purposes (e.g.
      // ambiguous id's)
      LocalCollection._modify(newDoc, {
        $set: selectorDocument
      });
      LocalCollection._modify(newDoc, modifier, {
        isInsert: true
      });
      if (isModify) {
        return newDoc;
      }

      // Replacement can take _id from query document
      const replacement = Object.assign({}, modifier);
      if (newDoc._id) {
        replacement._id = newDoc._id;
      }
      return replacement;
    };
    LocalCollection._diffObjects = (left, right, callbacks) => {
      return DiffSequence.diffObjects(left, right, callbacks);
    };

    // ordered: bool.
    // old_results and new_results: collections of documents.
    //    if ordered, they are arrays.
    //    if unordered, they are IdMaps
    LocalCollection._diffQueryChanges = (ordered, oldResults, newResults, observer, options) => DiffSequence.diffQueryChanges(ordered, oldResults, newResults, observer, options);
    LocalCollection._diffQueryOrderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryOrderedChanges(oldResults, newResults, observer, options);
    LocalCollection._diffQueryUnorderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryUnorderedChanges(oldResults, newResults, observer, options);
    LocalCollection._findInOrderedResults = (query, doc) => {
      if (!query.ordered) {
        throw new Error('Can\'t call _findInOrderedResults on unordered query');
      }
      for (let i = 0; i < query.results.length; i++) {
        if (query.results[i] === doc) {
          return i;
        }
      }
      throw Error('object missing from query');
    };

    // If this is a selector which explicitly constrains the match by ID to a finite
    // number of documents, returns a list of their IDs.  Otherwise returns
    // null. Note that the selector may have other restrictions so it may not even
    // match those document!  We care about $in and $and since those are generated
    // access-controlled update and remove.
    LocalCollection._idsMatchedBySelector = selector => {
      // Is the selector just an ID?
      if (LocalCollection._selectorIsId(selector)) {
        return [selector];
      }
      if (!selector) {
        return null;
      }

      // Do we have an _id clause?
      if (hasOwn.call(selector, '_id')) {
        // Is the _id clause just an ID?
        if (LocalCollection._selectorIsId(selector._id)) {
          return [selector._id];
        }

        // Is the _id clause {_id: {$in: ["x", "y", "z"]}}?
        if (selector._id && Array.isArray(selector._id.$in) && selector._id.$in.length && selector._id.$in.every(LocalCollection._selectorIsId)) {
          return selector._id.$in;
        }
        return null;
      }

      // If this is a top-level $and, and any of the clauses constrain their
      // documents, then the whole selector is constrained by any one clause's
      // constraint. (Well, by their intersection, but that seems unlikely.)
      if (Array.isArray(selector.$and)) {
        for (let i = 0; i < selector.$and.length; ++i) {
          const subIds = LocalCollection._idsMatchedBySelector(selector.$and[i]);
          if (subIds) {
            return subIds;
          }
        }
      }
      return null;
    };
    LocalCollection._insertInResultsSync = (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        query.added(doc._id, query.projectionFn(fields));
      } else {
        query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInResultsAsync = async (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          await query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          await query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        await query.added(doc._id, query.projectionFn(fields));
      } else {
        await query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInSortedList = (cmp, array, value) => {
      if (array.length === 0) {
        array.push(value);
        return 0;
      }
      const i = LocalCollection._binarySearch(cmp, array, value);
      array.splice(i, 0, value);
      return i;
    };
    LocalCollection._isModificationMod = mod => {
      let isModify = false;
      let isReplace = false;
      Object.keys(mod).forEach(key => {
        if (key.substr(0, 1) === '$') {
          isModify = true;
        } else {
          isReplace = true;
        }
      });
      if (isModify && isReplace) {
        throw new Error('Update parameter cannot have both modifier and non-modifier fields.');
      }
      return isModify;
    };

    // XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
    // RegExp
    // XXX note that _type(undefined) === 3!!!!
    LocalCollection._isPlainObject = x => {
      return x && LocalCollection._f._type(x) === 3;
    };

    // XXX need a strategy for passing the binding of $ into this
    // function, from the compiled selector
    //
    // maybe just {key.up.to.just.before.dollarsign: array_index}
    //
    // XXX atomicity: if one modification fails, do we roll back the whole
    // change?
    //
    // options:
    //   - isInsert is set when _modify is being called to compute the document to
    //     insert as part of an upsert operation. We use this primarily to figure
    //     out when to set the fields in $setOnInsert, if present.
    LocalCollection._modify = function (doc, modifier) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      if (!LocalCollection._isPlainObject(modifier)) {
        throw MinimongoError('Modifier must be an object');
      }

      // Make sure the caller can't mutate our data structures.
      modifier = EJSON.clone(modifier);
      const isModifier = isOperatorObject(modifier);
      const newDoc = isModifier ? EJSON.clone(doc) : modifier;
      if (isModifier) {
        // apply modifiers to the doc.
        Object.keys(modifier).forEach(operator => {
          // Treat $setOnInsert as $set if this is an insert.
          const setOnInsert = options.isInsert && operator === '$setOnInsert';
          const modFunc = MODIFIERS[setOnInsert ? '$set' : operator];
          const operand = modifier[operator];
          if (!modFunc) {
            throw MinimongoError("Invalid modifier specified ".concat(operator));
          }
          Object.keys(operand).forEach(keypath => {
            const arg = operand[keypath];
            if (keypath === '') {
              throw MinimongoError('An empty update path is not valid.');
            }
            const keyparts = keypath.split('.');
            if (!keyparts.every(Boolean)) {
              throw MinimongoError("The update path '".concat(keypath, "' contains an empty field name, ") + 'which is not allowed.');
            }
            const target = findModTarget(newDoc, keyparts, {
              arrayIndices: options.arrayIndices,
              forbidArray: operator === '$rename',
              noCreate: NO_CREATE_MODIFIERS[operator]
            });
            modFunc(target, keyparts.pop(), arg, keypath, newDoc);
          });
        });
        if (doc._id && !EJSON.equals(doc._id, newDoc._id)) {
          throw MinimongoError("After applying the update to the document {_id: \"".concat(doc._id, "\", ...},") + ' the (immutable) field \'_id\' was found to have been altered to ' + "_id: \"".concat(newDoc._id, "\""));
        }
      } else {
        if (doc._id && modifier._id && !EJSON.equals(doc._id, modifier._id)) {
          throw MinimongoError("The _id field cannot be changed from {_id: \"".concat(doc._id, "\"} to ") + "{_id: \"".concat(modifier._id, "\"}"));
        }

        // replace the whole document
        assertHasValidFieldNames(modifier);
      }

      // move new document into place.
      Object.keys(doc).forEach(key => {
        // Note: this used to be for (var key in doc) however, this does not
        // work right in Opera. Deleting from a doc while iterating over it
        // would sometimes cause opera to skip some keys.
        if (key !== '_id') {
          delete doc[key];
        }
      });
      Object.keys(newDoc).forEach(key => {
        doc[key] = newDoc[key];
      });
    };
    LocalCollection._observeFromObserveChanges = (cursor, observeCallbacks) => {
      const transform = cursor.getTransform() || (doc => doc);
      let suppressed = !!observeCallbacks._suppress_initial;
      let observeChangesCallbacks;
      if (LocalCollection._observeCallbacksAreOrdered(observeCallbacks)) {
        // The "_no_indices" option sets all index arguments to -1 and skips the
        // linear scans required to generate them.  This lets observers that don't
        // need absolute indices benefit from the other features of this API --
        // relative order, transforms, and applyChanges -- without the speed hit.
        const indices = !observeCallbacks._no_indices;
        observeChangesCallbacks = {
          addedBefore(id, fields, before) {
            const check = suppressed || !(observeCallbacks.addedAt || observeCallbacks.added);
            if (check) {
              return;
            }
            const doc = transform(Object.assign(fields, {
              _id: id
            }));
            if (observeCallbacks.addedAt) {
              observeCallbacks.addedAt(doc, indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1, before);
            } else {
              observeCallbacks.added(doc);
            }
          },
          changed(id, fields) {
            if (!(observeCallbacks.changedAt || observeCallbacks.changed)) {
              return;
            }
            let doc = EJSON.clone(this.docs.get(id));
            if (!doc) {
              throw new Error("Unknown id for changed: ".concat(id));
            }
            const oldDoc = transform(EJSON.clone(doc));
            DiffSequence.applyChanges(doc, fields);
            if (observeCallbacks.changedAt) {
              observeCallbacks.changedAt(transform(doc), oldDoc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.changed(transform(doc), oldDoc);
            }
          },
          movedBefore(id, before) {
            if (!observeCallbacks.movedTo) {
              return;
            }
            const from = indices ? this.docs.indexOf(id) : -1;
            let to = indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1;

            // When not moving backwards, adjust for the fact that removing the
            // document slides everything back one slot.
            if (to > from) {
              --to;
            }
            observeCallbacks.movedTo(transform(EJSON.clone(this.docs.get(id))), from, to, before || null);
          },
          removed(id) {
            if (!(observeCallbacks.removedAt || observeCallbacks.removed)) {
              return;
            }

            // technically maybe there should be an EJSON.clone here, but it's about
            // to be removed from this.docs!
            const doc = transform(this.docs.get(id));
            if (observeCallbacks.removedAt) {
              observeCallbacks.removedAt(doc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.removed(doc);
            }
          }
        };
      } else {
        observeChangesCallbacks = {
          added(id, fields) {
            if (!suppressed && observeCallbacks.added) {
              observeCallbacks.added(transform(Object.assign(fields, {
                _id: id
              })));
            }
          },
          changed(id, fields) {
            if (observeCallbacks.changed) {
              const oldDoc = this.docs.get(id);
              const doc = EJSON.clone(oldDoc);
              DiffSequence.applyChanges(doc, fields);
              observeCallbacks.changed(transform(doc), transform(EJSON.clone(oldDoc)));
            }
          },
          removed(id) {
            if (observeCallbacks.removed) {
              observeCallbacks.removed(transform(this.docs.get(id)));
            }
          }
        };
      }
      const changeObserver = new LocalCollection._CachingChangeObserver({
        callbacks: observeChangesCallbacks
      });

      // CachingChangeObserver clones all received input on its callbacks
      // So we can mark it as safe to reduce the ejson clones.
      // This is tested by the `mongo-livedata - (extended) scribbling` tests
      changeObserver.applyChange._fromObserve = true;
      const handle = cursor.observeChanges(changeObserver.applyChange, {
        nonMutatingCallbacks: true
      });

      // If needed, re-enable callbacks as soon as the initial batch is ready.
      const setSuppressed = h => {
        var _h$isReadyPromise;
        if (h.isReady) suppressed = false;else (_h$isReadyPromise = h.isReadyPromise) === null || _h$isReadyPromise === void 0 ? void 0 : _h$isReadyPromise.then(() => suppressed = false);
      };
      // When we call cursor.observeChanges() it can be the on from
      // the mongo package (instead of the minimongo one) and it doesn't have isReady and isReadyPromise
      if (Meteor._isPromise(handle)) {
        handle.then(setSuppressed);
      } else {
        setSuppressed(handle);
      }
      return handle;
    };
    LocalCollection._observeCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedAt) {
        throw new Error('Please specify only one of added() and addedAt()');
      }
      if (callbacks.changed && callbacks.changedAt) {
        throw new Error('Please specify only one of changed() and changedAt()');
      }
      if (callbacks.removed && callbacks.removedAt) {
        throw new Error('Please specify only one of removed() and removedAt()');
      }
      return !!(callbacks.addedAt || callbacks.changedAt || callbacks.movedTo || callbacks.removedAt);
    };
    LocalCollection._observeChangesCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedBefore) {
        throw new Error('Please specify only one of added() and addedBefore()');
      }
      return !!(callbacks.addedBefore || callbacks.movedBefore);
    };
    LocalCollection._removeFromResultsSync = (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        query.removed(doc._id);
        query.results.remove(id);
      }
    };
    LocalCollection._removeFromResultsAsync = async (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        await query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        await query.removed(doc._id);
        query.results.remove(id);
      }
    };

    // Is this selector just shorthand for lookup by _id?
    LocalCollection._selectorIsId = selector => typeof selector === 'number' || typeof selector === 'string' || selector instanceof MongoID.ObjectID;

    // Is the selector just lookup by _id (shorthand or not)?
    LocalCollection._selectorIsIdPerhapsAsObject = selector => LocalCollection._selectorIsId(selector) || LocalCollection._selectorIsId(selector && selector._id) && Object.keys(selector).length === 1;
    LocalCollection._updateInResultsSync = (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && query.movedBefore(doc._id, next);
      }
    };
    LocalCollection._updateInResultsAsync = async (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          await query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        await query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && (await query.movedBefore(doc._id, next));
      }
    };
    const MODIFIERS = {
      $currentDate(target, field, arg) {
        if (typeof arg === 'object' && hasOwn.call(arg, '$type')) {
          if (arg.$type !== 'date') {
            throw MinimongoError('Minimongo does currently only support the date type in ' + '$currentDate modifiers', {
              field
            });
          }
        } else if (arg !== true) {
          throw MinimongoError('Invalid $currentDate modifier', {
            field
          });
        }
        target[field] = new Date();
      },
      $inc(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $inc allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $inc modifier to non-number', {
              field
            });
          }
          target[field] += arg;
        } else {
          target[field] = arg;
        }
      },
      $min(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $min allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $min modifier to non-number', {
              field
            });
          }
          if (target[field] > arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $max(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $max allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $max modifier to non-number', {
              field
            });
          }
          if (target[field] < arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $mul(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $mul allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $mul modifier to non-number', {
              field
            });
          }
          target[field] *= arg;
        } else {
          target[field] = 0;
        }
      },
      $rename(target, field, arg, keypath, doc) {
        // no idea why mongo has this restriction..
        if (keypath === arg) {
          throw MinimongoError('$rename source must differ from target', {
            field
          });
        }
        if (target === null) {
          throw MinimongoError('$rename source field invalid', {
            field
          });
        }
        if (typeof arg !== 'string') {
          throw MinimongoError('$rename target must be a string', {
            field
          });
        }
        if (arg.includes('\0')) {
          // Null bytes are not allowed in Mongo field names
          // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
          throw MinimongoError('The \'to\' field for $rename cannot contain an embedded null byte', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const object = target[field];
        delete target[field];
        const keyparts = arg.split('.');
        const target2 = findModTarget(doc, keyparts, {
          forbidArray: true
        });
        if (target2 === null) {
          throw MinimongoError('$rename target field invalid', {
            field
          });
        }
        target2[keyparts.pop()] = object;
      },
      $set(target, field, arg) {
        if (target !== Object(target)) {
          // not an array or an object
          const error = MinimongoError('Cannot set property on non-object field', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        if (target === null) {
          const error = MinimongoError('Cannot set property on null', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        assertHasValidFieldNames(arg);
        target[field] = arg;
      },
      $setOnInsert(target, field, arg) {
        // converted to `$set` in `_modify`
      },
      $unset(target, field, arg) {
        if (target !== undefined) {
          if (target instanceof Array) {
            if (field in target) {
              target[field] = null;
            }
          } else {
            delete target[field];
          }
        }
      },
      $push(target, field, arg) {
        if (target[field] === undefined) {
          target[field] = [];
        }
        if (!(target[field] instanceof Array)) {
          throw MinimongoError('Cannot apply $push modifier to non-array', {
            field
          });
        }
        if (!(arg && arg.$each)) {
          // Simple mode: not $each
          assertHasValidFieldNames(arg);
          target[field].push(arg);
          return;
        }

        // Fancy mode: $each (and maybe $slice and $sort and $position)
        const toPush = arg.$each;
        if (!(toPush instanceof Array)) {
          throw MinimongoError('$each must be an array', {
            field
          });
        }
        assertHasValidFieldNames(toPush);

        // Parse $position
        let position = undefined;
        if ('$position' in arg) {
          if (typeof arg.$position !== 'number') {
            throw MinimongoError('$position must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          if (arg.$position < 0) {
            throw MinimongoError('$position in $push must be zero or positive', {
              field
            });
          }
          position = arg.$position;
        }

        // Parse $slice.
        let slice = undefined;
        if ('$slice' in arg) {
          if (typeof arg.$slice !== 'number') {
            throw MinimongoError('$slice must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          slice = arg.$slice;
        }

        // Parse $sort.
        let sortFunction = undefined;
        if (arg.$sort) {
          if (slice === undefined) {
            throw MinimongoError('$sort requires $slice to be present', {
              field
            });
          }

          // XXX this allows us to use a $sort whose value is an array, but that's
          // actually an extension of the Node driver, so it won't work
          // server-side. Could be confusing!
          // XXX is it correct that we don't do geo-stuff here?
          sortFunction = new Minimongo.Sorter(arg.$sort).getComparator();
          toPush.forEach(element => {
            if (LocalCollection._f._type(element) !== 3) {
              throw MinimongoError('$push like modifiers using $sort require all elements to be ' + 'objects', {
                field
              });
            }
          });
        }

        // Actually push.
        if (position === undefined) {
          toPush.forEach(element => {
            target[field].push(element);
          });
        } else {
          const spliceArguments = [position, 0];
          toPush.forEach(element => {
            spliceArguments.push(element);
          });
          target[field].splice(...spliceArguments);
        }

        // Actually sort.
        if (sortFunction) {
          target[field].sort(sortFunction);
        }

        // Actually slice.
        if (slice !== undefined) {
          if (slice === 0) {
            target[field] = []; // differs from Array.slice!
          } else if (slice < 0) {
            target[field] = target[field].slice(slice);
          } else {
            target[field] = target[field].slice(0, slice);
          }
        }
      },
      $pushAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only');
        }
        assertHasValidFieldNames(arg);
        const toPush = target[field];
        if (toPush === undefined) {
          target[field] = arg;
        } else if (!(toPush instanceof Array)) {
          throw MinimongoError('Cannot apply $pushAll modifier to non-array', {
            field
          });
        } else {
          toPush.push(...arg);
        }
      },
      $addToSet(target, field, arg) {
        let isEach = false;
        if (typeof arg === 'object') {
          // check if first key is '$each'
          const keys = Object.keys(arg);
          if (keys[0] === '$each') {
            isEach = true;
          }
        }
        const values = isEach ? arg.$each : [arg];
        assertHasValidFieldNames(values);
        const toAdd = target[field];
        if (toAdd === undefined) {
          target[field] = values;
        } else if (!(toAdd instanceof Array)) {
          throw MinimongoError('Cannot apply $addToSet modifier to non-array', {
            field
          });
        } else {
          values.forEach(value => {
            if (toAdd.some(element => LocalCollection._f._equal(value, element))) {
              return;
            }
            toAdd.push(value);
          });
        }
      },
      $pop(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPop = target[field];
        if (toPop === undefined) {
          return;
        }
        if (!(toPop instanceof Array)) {
          throw MinimongoError('Cannot apply $pop modifier to non-array', {
            field
          });
        }
        if (typeof arg === 'number' && arg < 0) {
          toPop.splice(0, 1);
        } else {
          toPop.pop();
        }
      },
      $pull(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        let out;
        if (arg != null && typeof arg === 'object' && !(arg instanceof Array)) {
          // XXX would be much nicer to compile this once, rather than
          // for each document we modify.. but usually we're not
          // modifying that many documents, so we'll let it slide for
          // now

          // XXX Minimongo.Matcher isn't up for the job, because we need
          // to permit stuff like {$pull: {a: {$gt: 4}}}.. something
          // like {$gt: 4} is not normally a complete selector.
          // same issue as $elemMatch possibly?
          const matcher = new Minimongo.Matcher(arg);
          out = toPull.filter(element => !matcher.documentMatches(element).result);
        } else {
          out = toPull.filter(element => !LocalCollection._f._equal(element, arg));
        }
        target[field] = out;
      },
      $pullAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        target[field] = toPull.filter(object => !arg.some(element => LocalCollection._f._equal(object, element)));
      },
      $bit(target, field, arg) {
        // XXX mongo only supports $bit on integers, and we only support
        // native javascript numbers (doubles) so far, so we can't support $bit
        throw MinimongoError('$bit is not supported', {
          field
        });
      },
      $v() {
        // As discussed in https://github.com/meteor/meteor/issues/9623,
        // the `$v` operator is not needed by Meteor, but problems can occur if
        // it's not at least callable (as of Mongo >= 3.6). It's defined here as
        // a no-op to work around these problems.
      }
    };
    const NO_CREATE_MODIFIERS = {
      $pop: true,
      $pull: true,
      $pullAll: true,
      $rename: true,
      $unset: true
    };

    // Make sure field names do not contain Mongo restricted
    // characters ('.', '$', '\0').
    // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
    const invalidCharMsg = {
      $: 'start with \'$\'',
      '.': 'contain \'.\'',
      '\0': 'contain null bytes'
    };

    // checks if all field names in an object are valid
    function assertHasValidFieldNames(doc) {
      if (doc && typeof doc === 'object') {
        JSON.stringify(doc, (key, value) => {
          assertIsValidFieldName(key);
          return value;
        });
      }
    }
    function assertIsValidFieldName(key) {
      let match;
      if (typeof key === 'string' && (match = key.match(/^\$|\.|\0/))) {
        throw MinimongoError("Key ".concat(key, " must not ").concat(invalidCharMsg[match[0]]));
      }
    }

    // for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
    // and then you would operate on the 'e' property of the returned
    // object.
    //
    // if options.noCreate is falsey, creates intermediate levels of
    // structure as necessary, like mkdir -p (and raises an exception if
    // that would mean giving a non-numeric property to an array.) if
    // options.noCreate is true, return undefined instead.
    //
    // may modify the last element of keyparts to signal to the caller that it needs
    // to use a different value to index into the returned object (for example,
    // ['a', '01'] -> ['a', 1]).
    //
    // if forbidArray is true, return null if the keypath goes through an array.
    //
    // if options.arrayIndices is set, use its first element for the (first) '$' in
    // the path.
    function findModTarget(doc, keyparts) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      let usedArrayIndex = false;
      for (let i = 0; i < keyparts.length; i++) {
        const last = i === keyparts.length - 1;
        let keypart = keyparts[i];
        if (!isIndexable(doc)) {
          if (options.noCreate) {
            return undefined;
          }
          const error = MinimongoError("cannot use the part '".concat(keypart, "' to traverse ").concat(doc));
          error.setPropertyError = true;
          throw error;
        }
        if (doc instanceof Array) {
          if (options.forbidArray) {
            return null;
          }
          if (keypart === '$') {
            if (usedArrayIndex) {
              throw MinimongoError('Too many positional (i.e. \'$\') elements');
            }
            if (!options.arrayIndices || !options.arrayIndices.length) {
              throw MinimongoError('The positional operator did not find the match needed from the ' + 'query');
            }
            keypart = options.arrayIndices[0];
            usedArrayIndex = true;
          } else if (isNumericKey(keypart)) {
            keypart = parseInt(keypart);
          } else {
            if (options.noCreate) {
              return undefined;
            }
            throw MinimongoError("can't append to array using string field name [".concat(keypart, "]"));
          }
          if (last) {
            keyparts[i] = keypart; // handle 'a.01'
          }
          if (options.noCreate && keypart >= doc.length) {
            return undefined;
          }
          while (doc.length < keypart) {
            doc.push(null);
          }
          if (!last) {
            if (doc.length === keypart) {
              doc.push({});
            } else if (typeof doc[keypart] !== 'object') {
              throw MinimongoError("can't modify field '".concat(keyparts[i + 1], "' of list value ") + JSON.stringify(doc[keypart]));
            }
          }
        } else {
          assertIsValidFieldName(keypart);
          if (!(keypart in doc)) {
            if (options.noCreate) {
              return undefined;
            }
            if (!last) {
              doc[keypart] = {};
            }
          }
        }
        if (last) {
          return doc;
        }
        doc = doc[keypart];
      }

      // notreached
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"matcher.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/matcher.js                                                                                     //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    var _Package$mongoDecima;
    module.export({
      default: () => Matcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let compileDocumentSelector, hasOwn, nothingMatcher;
    module.link("./common.js", {
      compileDocumentSelector(v) {
        compileDocumentSelector = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      nothingMatcher(v) {
        nothingMatcher = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const Decimal = ((_Package$mongoDecima = Package['mongo-decimal']) === null || _Package$mongoDecima === void 0 ? void 0 : _Package$mongoDecima.Decimal) || class DecimalStub {};

    // The minimongo selector compiler!

    // Terminology:
    //  - a 'selector' is the EJSON object representing a selector
    //  - a 'matcher' is its compiled form (whether a full Minimongo.Matcher
    //    object or one of the component lambdas that matches parts of it)
    //  - a 'result object' is an object with a 'result' field and maybe
    //    distance and arrayIndices.
    //  - a 'branched value' is an object with a 'value' field and maybe
    //    'dontIterate' and 'arrayIndices'.
    //  - a 'document' is a top-level object that can be stored in a collection.
    //  - a 'lookup function' is a function that takes in a document and returns
    //    an array of 'branched values'.
    //  - a 'branched matcher' maps from an array of branched values to a result
    //    object.
    //  - an 'element matcher' maps from a single value to a bool.

    // Main entry point.
    //   var matcher = new Minimongo.Matcher({a: {$gt: 5}});
    //   if (matcher.documentMatches({a: 7})) ...
    class Matcher {
      constructor(selector, isUpdate) {
        // A set (object mapping string -> *) of all of the document paths looked
        // at by the selector. Also includes the empty string if it may look at any
        // path (eg, $where).
        this._paths = {};
        // Set to true if compilation finds a $near.
        this._hasGeoQuery = false;
        // Set to true if compilation finds a $where.
        this._hasWhere = false;
        // Set to false if compilation finds anything other than a simple equality
        // or one or more of '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin' used
        // with scalars as operands.
        this._isSimple = true;
        // Set to a dummy document which always matches this Matcher. Or set to null
        // if such document is too hard to find.
        this._matchingDocument = undefined;
        // A clone of the original selector. It may just be a function if the user
        // passed in a function; otherwise is definitely an object (eg, IDs are
        // translated into {_id: ID} first. Used by canBecomeTrueByModifier and
        // Sorter._useWithMatcher.
        this._selector = null;
        this._docMatcher = this._compileSelector(selector);
        // Set to true if selection is done for an update operation
        // Default is false
        // Used for $near array update (issue #3599)
        this._isUpdate = isUpdate;
      }
      documentMatches(doc) {
        if (doc !== Object(doc)) {
          throw Error('documentMatches needs a document');
        }
        return this._docMatcher(doc);
      }
      hasGeoQuery() {
        return this._hasGeoQuery;
      }
      hasWhere() {
        return this._hasWhere;
      }
      isSimple() {
        return this._isSimple;
      }

      // Given a selector, return a function that takes one argument, a
      // document. It returns a result object.
      _compileSelector(selector) {
        // you can pass a literal function instead of a selector
        if (selector instanceof Function) {
          this._isSimple = false;
          this._selector = selector;
          this._recordPathUsed('');
          return doc => ({
            result: !!selector.call(doc)
          });
        }

        // shorthand -- scalar _id
        if (LocalCollection._selectorIsId(selector)) {
          this._selector = {
            _id: selector
          };
          this._recordPathUsed('_id');
          return doc => ({
            result: EJSON.equals(doc._id, selector)
          });
        }

        // protect against dangerous selectors.  falsey and {_id: falsey} are both
        // likely programmer error, and not what you want, particularly for
        // destructive operations.
        if (!selector || hasOwn.call(selector, '_id') && !selector._id) {
          this._isSimple = false;
          return nothingMatcher;
        }

        // Top level can't be an array or true or binary.
        if (Array.isArray(selector) || EJSON.isBinary(selector) || typeof selector === 'boolean') {
          throw new Error("Invalid selector: ".concat(selector));
        }
        this._selector = EJSON.clone(selector);
        return compileDocumentSelector(selector, this, {
          isRoot: true
        });
      }

      // Returns a list of key paths the given selector is looking for. It includes
      // the empty string if there is a $where.
      _getPaths() {
        return Object.keys(this._paths);
      }
      _recordPathUsed(path) {
        this._paths[path] = true;
      }
    }
    // helpers used by compiled selector code
    LocalCollection._f = {
      // XXX for _all and _in, consider building 'inquery' at compile time..
      _type(v) {
        if (typeof v === 'number') {
          return 1;
        }
        if (typeof v === 'string') {
          return 2;
        }
        if (typeof v === 'boolean') {
          return 8;
        }
        if (Array.isArray(v)) {
          return 4;
        }
        if (v === null) {
          return 10;
        }

        // note that typeof(/x/) === "object"
        if (v instanceof RegExp) {
          return 11;
        }
        if (typeof v === 'function') {
          return 13;
        }
        if (v instanceof Date) {
          return 9;
        }
        if (EJSON.isBinary(v)) {
          return 5;
        }
        if (v instanceof MongoID.ObjectID) {
          return 7;
        }
        if (v instanceof Decimal) {
          return 1;
        }

        // object
        return 3;

        // XXX support some/all of these:
        // 14, symbol
        // 15, javascript code with scope
        // 16, 18: 32-bit/64-bit integer
        // 17, timestamp
        // 255, minkey
        // 127, maxkey
      },
      // deep equality test: use for literal document and array matches
      _equal(a, b) {
        return EJSON.equals(a, b, {
          keyOrderSensitive: true
        });
      },
      // maps a type code to a value that can be used to sort values of different
      // types
      _typeorder(t) {
        // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
        // XXX what is the correct sort position for Javascript code?
        // ('100' in the matrix below)
        // XXX minkey/maxkey
        return [-1,
        // (not a type)
        1,
        // number
        2,
        // string
        3,
        // object
        4,
        // array
        5,
        // binary
        -1,
        // deprecated
        6,
        // ObjectID
        7,
        // bool
        8,
        // Date
        0,
        // null
        9,
        // RegExp
        -1,
        // deprecated
        100,
        // JS code
        2,
        // deprecated (symbol)
        100,
        // JS code
        1,
        // 32-bit int
        8,
        // Mongo timestamp
        1 // 64-bit int
        ][t];
      },
      // compare two values of unknown type according to BSON ordering
      // semantics. (as an extension, consider 'undefined' to be less than
      // any other value.) return negative if a is less, positive if b is
      // less, or 0 if equal
      _cmp(a, b) {
        if (a === undefined) {
          return b === undefined ? 0 : -1;
        }
        if (b === undefined) {
          return 1;
        }
        let ta = LocalCollection._f._type(a);
        let tb = LocalCollection._f._type(b);
        const oa = LocalCollection._f._typeorder(ta);
        const ob = LocalCollection._f._typeorder(tb);
        if (oa !== ob) {
          return oa < ob ? -1 : 1;
        }

        // XXX need to implement this if we implement Symbol or integers, or
        // Timestamp
        if (ta !== tb) {
          throw Error('Missing type coercion logic in _cmp');
        }
        if (ta === 7) {
          // ObjectID
          // Convert to string.
          ta = tb = 2;
          a = a.toHexString();
          b = b.toHexString();
        }
        if (ta === 9) {
          // Date
          // Convert to millis.
          ta = tb = 1;
          a = isNaN(a) ? 0 : a.getTime();
          b = isNaN(b) ? 0 : b.getTime();
        }
        if (ta === 1) {
          // double
          if (a instanceof Decimal) {
            return a.minus(b).toNumber();
          } else {
            return a - b;
          }
        }
        if (tb === 2)
          // string
          return a < b ? -1 : a === b ? 0 : 1;
        if (ta === 3) {
          // Object
          // this could be much more efficient in the expected case ...
          const toArray = object => {
            const result = [];
            Object.keys(object).forEach(key => {
              result.push(key, object[key]);
            });
            return result;
          };
          return LocalCollection._f._cmp(toArray(a), toArray(b));
        }
        if (ta === 4) {
          // Array
          for (let i = 0;; i++) {
            if (i === a.length) {
              return i === b.length ? 0 : -1;
            }
            if (i === b.length) {
              return 1;
            }
            const s = LocalCollection._f._cmp(a[i], b[i]);
            if (s !== 0) {
              return s;
            }
          }
        }
        if (ta === 5) {
          // binary
          // Surprisingly, a small binary blob is always less than a large one in
          // Mongo.
          if (a.length !== b.length) {
            return a.length - b.length;
          }
          for (let i = 0; i < a.length; i++) {
            if (a[i] < b[i]) {
              return -1;
            }
            if (a[i] > b[i]) {
              return 1;
            }
          }
          return 0;
        }
        if (ta === 8) {
          // boolean
          if (a) {
            return b ? 0 : 1;
          }
          return b ? -1 : 0;
        }
        if (ta === 10)
          // null
          return 0;
        if (ta === 11)
          // regexp
          throw Error('Sorting not supported on regular expression'); // XXX

        // 13: javascript code
        // 14: symbol
        // 15: javascript code with scope
        // 16: 32-bit integer
        // 17: timestamp
        // 18: 64-bit integer
        // 255: minkey
        // 127: maxkey
        if (ta === 13)
          // javascript code
          throw Error('Sorting not supported on Javascript code'); // XXX

        throw Error('Unknown type to sort');
      }
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"minimongo_common.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/minimongo_common.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let LocalCollection_;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection_ = v;
      }
    }, 0);
    let Matcher;
    module.link("./matcher.js", {
      default(v) {
        Matcher = v;
      }
    }, 1);
    let Sorter;
    module.link("./sorter.js", {
      default(v) {
        Sorter = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    LocalCollection = LocalCollection_;
    Minimongo = {
      LocalCollection: LocalCollection_,
      Matcher,
      Sorter
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_handle.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/observe_handle.js                                                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  default: () => ObserveHandle
});
class ObserveHandle {}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sorter.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/sorter.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Sorter
    });
    let ELEMENT_OPERATORS, equalityElementMatcher, expandArraysInBranches, hasOwn, isOperatorObject, makeLookupFunction, regexpElementMatcher;
    module.link("./common.js", {
      ELEMENT_OPERATORS(v) {
        ELEMENT_OPERATORS = v;
      },
      equalityElementMatcher(v) {
        equalityElementMatcher = v;
      },
      expandArraysInBranches(v) {
        expandArraysInBranches = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      makeLookupFunction(v) {
        makeLookupFunction = v;
      },
      regexpElementMatcher(v) {
        regexpElementMatcher = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Sorter {
      constructor(spec) {
        this._sortSpecParts = [];
        this._sortFunction = null;
        const addSpecPart = (path, ascending) => {
          if (!path) {
            throw Error('sort keys must be non-empty');
          }
          if (path.charAt(0) === '$') {
            throw Error("unsupported sort key: ".concat(path));
          }
          this._sortSpecParts.push({
            ascending,
            lookup: makeLookupFunction(path, {
              forSort: true
            }),
            path
          });
        };
        if (spec instanceof Array) {
          spec.forEach(element => {
            if (typeof element === 'string') {
              addSpecPart(element, true);
            } else {
              addSpecPart(element[0], element[1] !== 'desc');
            }
          });
        } else if (typeof spec === 'object') {
          Object.keys(spec).forEach(key => {
            addSpecPart(key, spec[key] >= 0);
          });
        } else if (typeof spec === 'function') {
          this._sortFunction = spec;
        } else {
          throw Error("Bad sort specification: ".concat(JSON.stringify(spec)));
        }

        // If a function is specified for sorting, we skip the rest.
        if (this._sortFunction) {
          return;
        }

        // To implement affectedByModifier, we piggy-back on top of Matcher's
        // affectedByModifier code; we create a selector that is affected by the
        // same modifiers as this sort order. This is only implemented on the
        // server.
        if (this.affectedByModifier) {
          const selector = {};
          this._sortSpecParts.forEach(spec => {
            selector[spec.path] = 1;
          });
          this._selectorForAffectedByModifier = new Minimongo.Matcher(selector);
        }
        this._keyComparator = composeComparators(this._sortSpecParts.map((spec, i) => this._keyFieldComparator(i)));
      }
      getComparator(options) {
        // If sort is specified or have no distances, just use the comparator from
        // the source specification (which defaults to "everything is equal".
        // issue #3599
        // https://docs.mongodb.com/manual/reference/operator/query/near/#sort-operation
        // sort effectively overrides $near
        if (this._sortSpecParts.length || !options || !options.distances) {
          return this._getBaseComparator();
        }
        const distances = options.distances;

        // Return a comparator which compares using $near distances.
        return (a, b) => {
          if (!distances.has(a._id)) {
            throw Error("Missing distance for ".concat(a._id));
          }
          if (!distances.has(b._id)) {
            throw Error("Missing distance for ".concat(b._id));
          }
          return distances.get(a._id) - distances.get(b._id);
        };
      }

      // Takes in two keys: arrays whose lengths match the number of spec
      // parts. Returns negative, 0, or positive based on using the sort spec to
      // compare fields.
      _compareKeys(key1, key2) {
        if (key1.length !== this._sortSpecParts.length || key2.length !== this._sortSpecParts.length) {
          throw Error('Key has wrong length');
        }
        return this._keyComparator(key1, key2);
      }

      // Iterates over each possible "key" from doc (ie, over each branch), calling
      // 'cb' with the key.
      _generateKeysFromDoc(doc, cb) {
        if (this._sortSpecParts.length === 0) {
          throw new Error('can\'t generate keys without a spec');
        }
        const pathFromIndices = indices => "".concat(indices.join(','), ",");
        let knownPaths = null;

        // maps index -> ({'' -> value} or {path -> value})
        const valuesByIndexAndPath = this._sortSpecParts.map(spec => {
          // Expand any leaf arrays that we find, and ignore those arrays
          // themselves.  (We never sort based on an array itself.)
          let branches = expandArraysInBranches(spec.lookup(doc), true);

          // If there are no values for a key (eg, key goes to an empty array),
          // pretend we found one undefined value.
          if (!branches.length) {
            branches = [{
              value: void 0
            }];
          }
          const element = Object.create(null);
          let usedPaths = false;
          branches.forEach(branch => {
            if (!branch.arrayIndices) {
              // If there are no array indices for a branch, then it must be the
              // only branch, because the only thing that produces multiple branches
              // is the use of arrays.
              if (branches.length > 1) {
                throw Error('multiple branches but no array used?');
              }
              element[''] = branch.value;
              return;
            }
            usedPaths = true;
            const path = pathFromIndices(branch.arrayIndices);
            if (hasOwn.call(element, path)) {
              throw Error("duplicate path: ".concat(path));
            }
            element[path] = branch.value;

            // If two sort fields both go into arrays, they have to go into the
            // exact same arrays and we have to find the same paths.  This is
            // roughly the same condition that makes MongoDB throw this strange
            // error message.  eg, the main thing is that if sort spec is {a: 1,
            // b:1} then a and b cannot both be arrays.
            //
            // (In MongoDB it seems to be OK to have {a: 1, 'a.x.y': 1} where 'a'
            // and 'a.x.y' are both arrays, but we don't allow this for now.
            // #NestedArraySort
            // XXX achieve full compatibility here
            if (knownPaths && !hasOwn.call(knownPaths, path)) {
              throw Error('cannot index parallel arrays');
            }
          });
          if (knownPaths) {
            // Similarly to above, paths must match everywhere, unless this is a
            // non-array field.
            if (!hasOwn.call(element, '') && Object.keys(knownPaths).length !== Object.keys(element).length) {
              throw Error('cannot index parallel arrays!');
            }
          } else if (usedPaths) {
            knownPaths = {};
            Object.keys(element).forEach(path => {
              knownPaths[path] = true;
            });
          }
          return element;
        });
        if (!knownPaths) {
          // Easy case: no use of arrays.
          const soleKey = valuesByIndexAndPath.map(values => {
            if (!hasOwn.call(values, '')) {
              throw Error('no value in sole key case?');
            }
            return values[''];
          });
          cb(soleKey);
          return;
        }
        Object.keys(knownPaths).forEach(path => {
          const key = valuesByIndexAndPath.map(values => {
            if (hasOwn.call(values, '')) {
              return values[''];
            }
            if (!hasOwn.call(values, path)) {
              throw Error('missing path?');
            }
            return values[path];
          });
          cb(key);
        });
      }

      // Returns a comparator that represents the sort specification (but not
      // including a possible geoquery distance tie-breaker).
      _getBaseComparator() {
        if (this._sortFunction) {
          return this._sortFunction;
        }

        // If we're only sorting on geoquery distance and no specs, just say
        // everything is equal.
        if (!this._sortSpecParts.length) {
          return (doc1, doc2) => 0;
        }
        return (doc1, doc2) => {
          const key1 = this._getMinKeyFromDoc(doc1);
          const key2 = this._getMinKeyFromDoc(doc2);
          return this._compareKeys(key1, key2);
        };
      }

      // Finds the minimum key from the doc, according to the sort specs.  (We say
      // "minimum" here but this is with respect to the sort spec, so "descending"
      // sort fields mean we're finding the max for that field.)
      //
      // Note that this is NOT "find the minimum value of the first field, the
      // minimum value of the second field, etc"... it's "choose the
      // lexicographically minimum value of the key vector, allowing only keys which
      // you can find along the same paths".  ie, for a doc {a: [{x: 0, y: 5}, {x:
      // 1, y: 3}]} with sort spec {'a.x': 1, 'a.y': 1}, the only keys are [0,5] and
      // [1,3], and the minimum key is [0,5]; notably, [0,3] is NOT a key.
      _getMinKeyFromDoc(doc) {
        let minKey = null;
        this._generateKeysFromDoc(doc, key => {
          if (minKey === null) {
            minKey = key;
            return;
          }
          if (this._compareKeys(key, minKey) < 0) {
            minKey = key;
          }
        });
        return minKey;
      }
      _getPaths() {
        return this._sortSpecParts.map(part => part.path);
      }

      // Given an index 'i', returns a comparator that compares two key arrays based
      // on field 'i'.
      _keyFieldComparator(i) {
        const invert = !this._sortSpecParts[i].ascending;
        return (key1, key2) => {
          const compare = LocalCollection._f._cmp(key1[i], key2[i]);
          return invert ? -compare : compare;
        };
      }
    }
    // Given an array of comparators
    // (functions (a,b)->(negative or positive or zero)), returns a single
    // comparator which uses each comparator in order and returns the first
    // non-zero value.
    function composeComparators(comparatorArray) {
      return (a, b) => {
        for (let i = 0; i < comparatorArray.length; ++i) {
          const compare = comparatorArray[i](a, b);
          if (compare !== 0) {
            return compare;
          }
        }
        return 0;
      };
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      LocalCollection: LocalCollection,
      Minimongo: Minimongo,
      MinimongoTest: MinimongoTest,
      MinimongoError: MinimongoError
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/minimongo/minimongo_server.js"
  ],
  mainModulePath: "/node_modules/meteor/minimongo/minimongo_server.js"
}});

//# sourceURL=meteor://💻app/packages/minimongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb25zdGFudHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jdXJzb3IuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9sb2NhbF9jb2xsZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9taW5pbW9uZ28vbWF0Y2hlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9vYnNlcnZlX2hhbmRsZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL3NvcnRlci5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJsaW5rIiwiaGFzT3duIiwiaXNOdW1lcmljS2V5IiwiaXNPcGVyYXRvck9iamVjdCIsInBhdGhzVG9UcmVlIiwicHJvamVjdGlvbkRldGFpbHMiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJNaW5pbW9uZ28iLCJfcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMiLCJwYXRocyIsIm1hcCIsInBhdGgiLCJzcGxpdCIsImZpbHRlciIsInBhcnQiLCJqb2luIiwiTWF0Y2hlciIsInByb3RvdHlwZSIsImFmZmVjdGVkQnlNb2RpZmllciIsIm1vZGlmaWVyIiwiT2JqZWN0IiwiYXNzaWduIiwiJHNldCIsIiR1bnNldCIsIm1lYW5pbmdmdWxQYXRocyIsIl9nZXRQYXRocyIsIm1vZGlmaWVkUGF0aHMiLCJjb25jYXQiLCJrZXlzIiwic29tZSIsIm1vZCIsIm1lYW5pbmdmdWxQYXRoIiwic2VsIiwiaSIsImoiLCJsZW5ndGgiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImlzU2ltcGxlIiwibW9kaWZpZXJQYXRocyIsInBhdGhIYXNOdW1lcmljS2V5cyIsImV4cGVjdGVkU2NhbGFySXNPYmplY3QiLCJfc2VsZWN0b3IiLCJtb2RpZmllclBhdGgiLCJzdGFydHNXaXRoIiwibWF0Y2hpbmdEb2N1bWVudCIsIkVKU09OIiwiY2xvbmUiLCJMb2NhbENvbGxlY3Rpb24iLCJfbW9kaWZ5IiwiZXJyb3IiLCJuYW1lIiwic2V0UHJvcGVydHlFcnJvciIsImRvY3VtZW50TWF0Y2hlcyIsInJlc3VsdCIsImNvbWJpbmVJbnRvUHJvamVjdGlvbiIsInByb2plY3Rpb24iLCJzZWxlY3RvclBhdGhzIiwiaW5jbHVkZXMiLCJjb21iaW5lSW1wb3J0YW50UGF0aHNJbnRvUHJvamVjdGlvbiIsIl9tYXRjaGluZ0RvY3VtZW50IiwidW5kZWZpbmVkIiwiZmFsbGJhY2siLCJ2YWx1ZVNlbGVjdG9yIiwiJGVxIiwiJGluIiwibWF0Y2hlciIsInBsYWNlaG9sZGVyIiwiZmluZCIsIm9ubHlDb250YWluc0tleXMiLCJsb3dlckJvdW5kIiwiSW5maW5pdHkiLCJ1cHBlckJvdW5kIiwiZm9yRWFjaCIsIm9wIiwiY2FsbCIsIm1pZGRsZSIsIngiLCJTb3J0ZXIiLCJfc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIiLCJkZXRhaWxzIiwidHJlZSIsIm5vZGUiLCJmdWxsUGF0aCIsIm1lcmdlZFByb2plY3Rpb24iLCJ0cmVlVG9QYXRocyIsImluY2x1ZGluZyIsIm1lcmdlZEV4Y2xQcm9qZWN0aW9uIiwiZ2V0UGF0aHMiLCJzZWxlY3RvciIsIl9wYXRocyIsIm9iaiIsImV2ZXJ5IiwiayIsInByZWZpeCIsImFyZ3VtZW50cyIsImtleSIsInZhbHVlIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiRUxFTUVOVF9PUEVSQVRPUlMiLCJjb21waWxlRG9jdW1lbnRTZWxlY3RvciIsImVxdWFsaXR5RWxlbWVudE1hdGNoZXIiLCJleHBhbmRBcnJheXNJbkJyYW5jaGVzIiwiaXNJbmRleGFibGUiLCJtYWtlTG9va3VwRnVuY3Rpb24iLCJub3RoaW5nTWF0Y2hlciIsInBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMiLCJyZWdleHBFbGVtZW50TWF0Y2hlciIsImRlZmF1bHQiLCJoYXNPd25Qcm9wZXJ0eSIsIiRsdCIsIm1ha2VJbmVxdWFsaXR5IiwiY21wVmFsdWUiLCIkZ3QiLCIkbHRlIiwiJGd0ZSIsIiRtb2QiLCJjb21waWxlRWxlbWVudFNlbGVjdG9yIiwib3BlcmFuZCIsIkFycmF5IiwiaXNBcnJheSIsIkVycm9yIiwiZGl2aXNvciIsInJlbWFpbmRlciIsImVsZW1lbnRNYXRjaGVycyIsIm9wdGlvbiIsIlJlZ0V4cCIsIiRzaXplIiwiZG9udEV4cGFuZExlYWZBcnJheXMiLCIkdHlwZSIsImRvbnRJbmNsdWRlTGVhZkFycmF5cyIsIm9wZXJhbmRBbGlhc01hcCIsIl9mIiwiX3R5cGUiLCIkYml0c0FsbFNldCIsIm1hc2siLCJnZXRPcGVyYW5kQml0bWFzayIsImJpdG1hc2siLCJnZXRWYWx1ZUJpdG1hc2siLCJieXRlIiwiJGJpdHNBbnlTZXQiLCIkYml0c0FsbENsZWFyIiwiJGJpdHNBbnlDbGVhciIsIiRyZWdleCIsInJlZ2V4cCIsIiRvcHRpb25zIiwidGVzdCIsInNvdXJjZSIsIiRlbGVtTWF0Y2giLCJfaXNQbGFpbk9iamVjdCIsImlzRG9jTWF0Y2hlciIsIkxPR0lDQUxfT1BFUkFUT1JTIiwicmVkdWNlIiwiYSIsImIiLCJzdWJNYXRjaGVyIiwiaW5FbGVtTWF0Y2giLCJjb21waWxlVmFsdWVTZWxlY3RvciIsImFycmF5RWxlbWVudCIsImFyZyIsImRvbnRJdGVyYXRlIiwiJGFuZCIsInN1YlNlbGVjdG9yIiwiYW5kRG9jdW1lbnRNYXRjaGVycyIsImNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMiLCIkb3IiLCJtYXRjaGVycyIsImRvYyIsImZuIiwiJG5vciIsIiR3aGVyZSIsInNlbGVjdG9yVmFsdWUiLCJfcmVjb3JkUGF0aFVzZWQiLCJfaGFzV2hlcmUiLCJGdW5jdGlvbiIsIiRjb21tZW50IiwiVkFMVUVfT1BFUkFUT1JTIiwiY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIiLCIkbm90IiwiaW52ZXJ0QnJhbmNoZWRNYXRjaGVyIiwiJG5lIiwiJG5pbiIsIiRleGlzdHMiLCJleGlzdHMiLCJldmVyeXRoaW5nTWF0Y2hlciIsIiRtYXhEaXN0YW5jZSIsIiRuZWFyIiwiJGFsbCIsImJyYW5jaGVkTWF0Y2hlcnMiLCJjcml0ZXJpb24iLCJhbmRCcmFuY2hlZE1hdGNoZXJzIiwiaXNSb290IiwiX2hhc0dlb1F1ZXJ5IiwibWF4RGlzdGFuY2UiLCJwb2ludCIsImRpc3RhbmNlIiwiJGdlb21ldHJ5IiwidHlwZSIsIkdlb0pTT04iLCJwb2ludERpc3RhbmNlIiwiY29vcmRpbmF0ZXMiLCJwb2ludFRvQXJyYXkiLCJnZW9tZXRyeVdpdGhpblJhZGl1cyIsImRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzIiwiYnJhbmNoZWRWYWx1ZXMiLCJicmFuY2giLCJjdXJEaXN0YW5jZSIsIl9pc1VwZGF0ZSIsImFycmF5SW5kaWNlcyIsImFuZFNvbWVNYXRjaGVycyIsInN1Yk1hdGNoZXJzIiwiZG9jT3JCcmFuY2hlcyIsIm1hdGNoIiwic3ViUmVzdWx0Iiwic2VsZWN0b3JzIiwiZG9jU2VsZWN0b3IiLCJvcHRpb25zIiwiZG9jTWF0Y2hlcnMiLCJzdWJzdHIiLCJfaXNTaW1wbGUiLCJsb29rVXBCeUluZGV4IiwidmFsdWVNYXRjaGVyIiwiQm9vbGVhbiIsIm9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyIiwiZWxlbWVudE1hdGNoZXIiLCJicmFuY2hlcyIsImV4cGFuZGVkIiwiZWxlbWVudCIsIm1hdGNoZWQiLCJwb2ludEEiLCJwb2ludEIiLCJNYXRoIiwiaHlwb3QiLCJlbGVtZW50U2VsZWN0b3IiLCJfZXF1YWwiLCJkb2NPckJyYW5jaGVkVmFsdWVzIiwic2tpcFRoZUFycmF5cyIsImJyYW5jaGVzT3V0IiwidGhpc0lzQXJyYXkiLCJwdXNoIiwiTnVtYmVyIiwiaXNJbnRlZ2VyIiwiVWludDhBcnJheSIsIkludDMyQXJyYXkiLCJidWZmZXIiLCJpc0JpbmFyeSIsIkFycmF5QnVmZmVyIiwibWF4IiwidmlldyIsImlzU2FmZUludGVnZXIiLCJVaW50MzJBcnJheSIsIkJZVEVTX1BFUl9FTEVNRU5UIiwiaW5zZXJ0SW50b0RvY3VtZW50IiwiZG9jdW1lbnQiLCJleGlzdGluZ0tleSIsImluZGV4T2YiLCJicmFuY2hlZE1hdGNoZXIiLCJicmFuY2hWYWx1ZXMiLCJzIiwiaW5jb25zaXN0ZW50T0siLCJ0aGVzZUFyZU9wZXJhdG9ycyIsInNlbEtleSIsInRoaXNJc09wZXJhdG9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNtcFZhbHVlQ29tcGFyYXRvciIsIm9wZXJhbmRUeXBlIiwiX2NtcCIsInBhcnRzIiwiZmlyc3RQYXJ0IiwibG9va3VwUmVzdCIsInNsaWNlIiwiYnVpbGRSZXN1bHQiLCJmaXJzdExldmVsIiwiYXBwZW5kVG9SZXN1bHQiLCJtb3JlIiwiZm9yU29ydCIsImFycmF5SW5kZXgiLCJNaW5pbW9uZ29UZXN0IiwiTWluaW1vbmdvRXJyb3IiLCJtZXNzYWdlIiwiZmllbGQiLCJvcGVyYXRvck1hdGNoZXJzIiwib3BlcmF0b3IiLCJzaW1wbGVSYW5nZSIsInNpbXBsZUVxdWFsaXR5Iiwic2ltcGxlSW5jbHVzaW9uIiwibmV3TGVhZkZuIiwiY29uZmxpY3RGbiIsInJvb3QiLCJwYXRoQXJyYXkiLCJzdWNjZXNzIiwibGFzdEtleSIsInkiLCJwb3B1bGF0ZURvY3VtZW50V2l0aEtleVZhbHVlIiwiZ2V0UHJvdG90eXBlT2YiLCJwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdCIsInVucHJlZml4ZWRLZXlzIiwidmFsaWRhdGVPYmplY3QiLCJvYmplY3QiLCJxdWVyeSIsIl9zZWxlY3RvcklzSWQiLCJmaWVsZHMiLCJmaWVsZHNLZXlzIiwic29ydCIsIl9pZCIsImtleVBhdGgiLCJydWxlIiwicHJvamVjdGlvblJ1bGVzVHJlZSIsImN1cnJlbnRQYXRoIiwiYW5vdGhlclBhdGgiLCJ0b1N0cmluZyIsImxhc3RJbmRleCIsInZhbGlkYXRlS2V5SW5QYXRoIiwiZ2V0QXN5bmNNZXRob2ROYW1lIiwiQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTIiwiQVNZTkNfQ1VSU09SX01FVEhPRFMiLCJDTElFTlRfT05MWV9NRVRIT0RTIiwibWV0aG9kIiwicmVwbGFjZSIsIkN1cnNvciIsImNvbnN0cnVjdG9yIiwiY29sbGVjdGlvbiIsInNvcnRlciIsIl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3QiLCJfc2VsZWN0b3JJZCIsImhhc0dlb1F1ZXJ5Iiwic2tpcCIsImxpbWl0IiwiX3Byb2plY3Rpb25GbiIsIl9jb21waWxlUHJvamVjdGlvbiIsIl90cmFuc2Zvcm0iLCJ3cmFwVHJhbnNmb3JtIiwidHJhbnNmb3JtIiwiVHJhY2tlciIsInJlYWN0aXZlIiwiY291bnQiLCJfZGVwZW5kIiwiYWRkZWQiLCJyZW1vdmVkIiwiX2dldFJhd09iamVjdHMiLCJvcmRlcmVkIiwiZmV0Y2giLCJTeW1ib2wiLCJpdGVyYXRvciIsImFkZGVkQmVmb3JlIiwiY2hhbmdlZCIsIm1vdmVkQmVmb3JlIiwiaW5kZXgiLCJvYmplY3RzIiwibmV4dCIsImRvbmUiLCJhc3luY0l0ZXJhdG9yIiwic3luY1Jlc3VsdCIsIlByb21pc2UiLCJyZXNvbHZlIiwiY2FsbGJhY2siLCJ0aGlzQXJnIiwiZ2V0VHJhbnNmb3JtIiwib2JzZXJ2ZSIsIl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzIiwib2JzZXJ2ZUFzeW5jIiwib2JzZXJ2ZUNoYW5nZXMiLCJfb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkIiwiX2FsbG93X3Vub3JkZXJlZCIsImRpc3RhbmNlcyIsIl9JZE1hcCIsImN1cnNvciIsImRpcnR5IiwicHJvamVjdGlvbkZuIiwicmVzdWx0c1NuYXBzaG90IiwicWlkIiwibmV4dF9xaWQiLCJxdWVyaWVzIiwicmVzdWx0cyIsInBhdXNlZCIsIndyYXBDYWxsYmFjayIsImFyZ3MiLCJfb2JzZXJ2ZVF1ZXVlIiwicXVldWVUYXNrIiwiYXBwbHkiLCJfc3VwcHJlc3NfaW5pdGlhbCIsIl9xdWVyeSRyZXN1bHRzIiwiX3F1ZXJ5JHJlc3VsdHMkc2l6ZSIsImhhbmRsZXIiLCJzaXplIiwiaGFuZGxlIiwiT2JzZXJ2ZUhhbmRsZSIsInN0b3AiLCJpc1JlYWR5IiwiaXNSZWFkeVByb21pc2UiLCJhY3RpdmUiLCJvbkludmFsaWRhdGUiLCJkcmFpblJlc3VsdCIsImRyYWluIiwidGhlbiIsIm9ic2VydmVDaGFuZ2VzQXN5bmMiLCJjaGFuZ2VycyIsImRlcGVuZGVuY3kiLCJEZXBlbmRlbmN5Iiwibm90aWZ5IiwiYmluZCIsImRlcGVuZCIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsImFwcGx5U2tpcExpbWl0Iiwic2VsZWN0ZWREb2MiLCJfZG9jcyIsImdldCIsInNldCIsImNsZWFyIiwiaWQiLCJtYXRjaFJlc3VsdCIsImdldENvbXBhcmF0b3IiLCJfcHVibGlzaEN1cnNvciIsInN1YnNjcmlwdGlvbiIsIlBhY2thZ2UiLCJtb25nbyIsIk1vbmdvIiwiQ29sbGVjdGlvbiIsImFzeW5jTmFtZSIsIl9sZW4iLCJfa2V5IiwicmVqZWN0IiwiX29iamVjdFNwcmVhZCIsIk1ldGVvciIsImlzQ2xpZW50IiwiX1N5bmNocm9ub3VzUXVldWUiLCJfQXN5bmNocm9ub3VzUXVldWUiLCJjcmVhdGUiLCJfc2F2ZWRPcmlnaW5hbHMiLCJjb3VudERvY3VtZW50cyIsImNvdW50QXN5bmMiLCJlc3RpbWF0ZWREb2N1bWVudENvdW50IiwiZmluZE9uZSIsImZpbmRPbmVBc3luYyIsImZldGNoQXN5bmMiLCJwcmVwYXJlSW5zZXJ0IiwiYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzIiwiX3VzZU9JRCIsIk1vbmdvSUQiLCJPYmplY3RJRCIsIlJhbmRvbSIsImhhcyIsIl9zYXZlT3JpZ2luYWwiLCJpbnNlcnQiLCJxdWVyaWVzVG9SZWNvbXB1dGUiLCJfaW5zZXJ0SW5SZXN1bHRzU3luYyIsIl9yZWNvbXB1dGVSZXN1bHRzIiwiZGVmZXIiLCJpbnNlcnRBc3luYyIsIl9pbnNlcnRJblJlc3VsdHNBc3luYyIsInBhdXNlT2JzZXJ2ZXJzIiwiY2xlYXJSZXN1bHRRdWVyaWVzIiwicHJlcGFyZVJlbW92ZSIsInJlbW92ZSIsIl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMiLCJxdWVyeVJlbW92ZSIsInJlbW92ZUlkIiwicmVtb3ZlRG9jIiwiZXF1YWxzIiwiX3JlbW92ZUZyb21SZXN1bHRzU3luYyIsInJlbW92ZUFzeW5jIiwiX3JlbW92ZUZyb21SZXN1bHRzQXN5bmMiLCJfcmVzdW1lT2JzZXJ2ZXJzIiwiX2RpZmZRdWVyeUNoYW5nZXMiLCJyZXN1bWVPYnNlcnZlcnNTZXJ2ZXIiLCJyZXN1bWVPYnNlcnZlcnNDbGllbnQiLCJyZXRyaWV2ZU9yaWdpbmFscyIsIm9yaWdpbmFscyIsInNhdmVPcmlnaW5hbHMiLCJwcmVwYXJlVXBkYXRlIiwicWlkVG9PcmlnaW5hbFJlc3VsdHMiLCJkb2NNYXAiLCJpZHNNYXRjaGVkIiwiX2lkc01hdGNoZWRCeVNlbGVjdG9yIiwibWVtb2l6ZWRDbG9uZUlmTmVlZGVkIiwiZG9jVG9NZW1vaXplIiwiZmluaXNoVXBkYXRlIiwiX3JlZiIsInVwZGF0ZUNvdW50IiwiaW5zZXJ0ZWRJZCIsIl9yZXR1cm5PYmplY3QiLCJudW1iZXJBZmZlY3RlZCIsInVwZGF0ZUFzeW5jIiwicmVjb21wdXRlUWlkcyIsIl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY0FzeW5jIiwicXVlcnlSZXN1bHQiLCJfbW9kaWZ5QW5kTm90aWZ5QXN5bmMiLCJtdWx0aSIsInVwc2VydCIsIl9jcmVhdGVVcHNlcnREb2N1bWVudCIsInVwZGF0ZSIsIl9tb2RpZnlBbmROb3RpZnlTeW5jIiwidXBzZXJ0QXN5bmMiLCJzcGVjaWZpY0lkcyIsImZvckVhY2hBc3luYyIsIl9nZXRNYXRjaGVkRG9jQW5kTW9kaWZ5IiwibWF0Y2hlZF9iZWZvcmUiLCJvbGRfZG9jIiwiYWZ0ZXJNYXRjaCIsImFmdGVyIiwiYmVmb3JlIiwiX3VwZGF0ZUluUmVzdWx0c1N5bmMiLCJfdXBkYXRlSW5SZXN1bHRzQXN5bmMiLCJvbGRSZXN1bHRzIiwiX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciIsIm9yZGVyZWRGcm9tQ2FsbGJhY2tzIiwiY2FsbGJhY2tzIiwiZG9jcyIsIk9yZGVyZWREaWN0IiwiaWRTdHJpbmdpZnkiLCJhcHBseUNoYW5nZSIsInB1dEJlZm9yZSIsIm1vdmVCZWZvcmUiLCJEaWZmU2VxdWVuY2UiLCJhcHBseUNoYW5nZXMiLCJJZE1hcCIsImlkUGFyc2UiLCJfX3dyYXBwZWRUcmFuc2Zvcm1fXyIsIndyYXBwZWQiLCJ0cmFuc2Zvcm1lZCIsIm5vbnJlYWN0aXZlIiwiX2JpbmFyeVNlYXJjaCIsImNtcCIsImFycmF5IiwiZmlyc3QiLCJyYW5nZSIsImhhbGZSYW5nZSIsImZsb29yIiwiX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbiIsIl9pZFByb2plY3Rpb24iLCJydWxlVHJlZSIsInN1YmRvYyIsInNlbGVjdG9yRG9jdW1lbnQiLCJpc01vZGlmeSIsIl9pc01vZGlmaWNhdGlvbk1vZCIsIm5ld0RvYyIsImlzSW5zZXJ0IiwicmVwbGFjZW1lbnQiLCJfZGlmZk9iamVjdHMiLCJsZWZ0IiwicmlnaHQiLCJkaWZmT2JqZWN0cyIsIm5ld1Jlc3VsdHMiLCJvYnNlcnZlciIsImRpZmZRdWVyeUNoYW5nZXMiLCJfZGlmZlF1ZXJ5T3JkZXJlZENoYW5nZXMiLCJkaWZmUXVlcnlPcmRlcmVkQ2hhbmdlcyIsIl9kaWZmUXVlcnlVbm9yZGVyZWRDaGFuZ2VzIiwiZGlmZlF1ZXJ5VW5vcmRlcmVkQ2hhbmdlcyIsIl9maW5kSW5PcmRlcmVkUmVzdWx0cyIsInN1YklkcyIsIl9pbnNlcnRJblNvcnRlZExpc3QiLCJzcGxpY2UiLCJpc1JlcGxhY2UiLCJpc01vZGlmaWVyIiwic2V0T25JbnNlcnQiLCJtb2RGdW5jIiwiTU9ESUZJRVJTIiwia2V5cGF0aCIsImtleXBhcnRzIiwidGFyZ2V0IiwiZmluZE1vZFRhcmdldCIsImZvcmJpZEFycmF5Iiwibm9DcmVhdGUiLCJOT19DUkVBVEVfTU9ESUZJRVJTIiwicG9wIiwib2JzZXJ2ZUNhbGxiYWNrcyIsInN1cHByZXNzZWQiLCJvYnNlcnZlQ2hhbmdlc0NhbGxiYWNrcyIsIl9vYnNlcnZlQ2FsbGJhY2tzQXJlT3JkZXJlZCIsImluZGljZXMiLCJfbm9faW5kaWNlcyIsImNoZWNrIiwiYWRkZWRBdCIsImNoYW5nZWRBdCIsIm9sZERvYyIsIm1vdmVkVG8iLCJmcm9tIiwidG8iLCJyZW1vdmVkQXQiLCJjaGFuZ2VPYnNlcnZlciIsIl9mcm9tT2JzZXJ2ZSIsIm5vbk11dGF0aW5nQ2FsbGJhY2tzIiwic2V0U3VwcHJlc3NlZCIsImgiLCJfaCRpc1JlYWR5UHJvbWlzZSIsIl9pc1Byb21pc2UiLCJjaGFuZ2VkRmllbGRzIiwibWFrZUNoYW5nZWRGaWVsZHMiLCJvbGRfaWR4IiwibmV3X2lkeCIsIiRjdXJyZW50RGF0ZSIsIkRhdGUiLCIkaW5jIiwiJG1pbiIsIiRtYXgiLCIkbXVsIiwiJHJlbmFtZSIsInRhcmdldDIiLCIkc2V0T25JbnNlcnQiLCIkcHVzaCIsIiRlYWNoIiwidG9QdXNoIiwicG9zaXRpb24iLCIkcG9zaXRpb24iLCIkc2xpY2UiLCJzb3J0RnVuY3Rpb24iLCIkc29ydCIsInNwbGljZUFyZ3VtZW50cyIsIiRwdXNoQWxsIiwiJGFkZFRvU2V0IiwiaXNFYWNoIiwidmFsdWVzIiwidG9BZGQiLCIkcG9wIiwidG9Qb3AiLCIkcHVsbCIsInRvUHVsbCIsIm91dCIsIiRwdWxsQWxsIiwiJGJpdCIsIiR2IiwiaW52YWxpZENoYXJNc2ciLCIkIiwiYXNzZXJ0SXNWYWxpZEZpZWxkTmFtZSIsInVzZWRBcnJheUluZGV4IiwibGFzdCIsImtleXBhcnQiLCJwYXJzZUludCIsIkRlY2ltYWwiLCJfUGFja2FnZSRtb25nb0RlY2ltYSIsIkRlY2ltYWxTdHViIiwiaXNVcGRhdGUiLCJfZG9jTWF0Y2hlciIsIl9jb21waWxlU2VsZWN0b3IiLCJoYXNXaGVyZSIsImtleU9yZGVyU2Vuc2l0aXZlIiwiX3R5cGVvcmRlciIsInQiLCJ0YSIsInRiIiwib2EiLCJvYiIsInRvSGV4U3RyaW5nIiwiaXNOYU4iLCJnZXRUaW1lIiwibWludXMiLCJ0b051bWJlciIsInRvQXJyYXkiLCJMb2NhbENvbGxlY3Rpb25fIiwic3BlYyIsIl9zb3J0U3BlY1BhcnRzIiwiX3NvcnRGdW5jdGlvbiIsImFkZFNwZWNQYXJ0IiwiYXNjZW5kaW5nIiwiY2hhckF0IiwibG9va3VwIiwiX2tleUNvbXBhcmF0b3IiLCJjb21wb3NlQ29tcGFyYXRvcnMiLCJfa2V5RmllbGRDb21wYXJhdG9yIiwiX2dldEJhc2VDb21wYXJhdG9yIiwiX2NvbXBhcmVLZXlzIiwia2V5MSIsImtleTIiLCJfZ2VuZXJhdGVLZXlzRnJvbURvYyIsImNiIiwicGF0aEZyb21JbmRpY2VzIiwia25vd25QYXRocyIsInZhbHVlc0J5SW5kZXhBbmRQYXRoIiwidXNlZFBhdGhzIiwic29sZUtleSIsImRvYzEiLCJkb2MyIiwiX2dldE1pbktleUZyb21Eb2MiLCJtaW5LZXkiLCJpbnZlcnQiLCJjb21wYXJlIiwiY29tcGFyYXRvckFycmF5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxJQUFJLENBQUMsdUJBQXVCLENBQUM7SUFBQyxJQUFJQyxNQUFNLEVBQUNDLFlBQVksRUFBQ0MsZ0JBQWdCLEVBQUNDLFdBQVcsRUFBQ0MsaUJBQWlCO0lBQUNOLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGFBQWEsRUFBQztNQUFDQyxNQUFNQSxDQUFDSyxDQUFDLEVBQUM7UUFBQ0wsTUFBTSxHQUFDSyxDQUFDO01BQUEsQ0FBQztNQUFDSixZQUFZQSxDQUFDSSxDQUFDLEVBQUM7UUFBQ0osWUFBWSxHQUFDSSxDQUFDO01BQUEsQ0FBQztNQUFDSCxnQkFBZ0JBLENBQUNHLENBQUMsRUFBQztRQUFD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O01BQ0g7SUFDRjtJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsU0FBU2xCLGtCQUFrQkEsQ0FBQ21CLGVBQWUsRUFBRTtNQUMzQyxPQUFPLENBQUM3Z0IsQ0FBQyxFQUFFQyxDQUFDLEtBQUs7UUFDZixLQUFLLElBQUk1SCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd3b0IsZUFBZSxDQUFDdG9CLE1BQU0sRUFBRSxFQUFFRixDQUFDLEVBQUU7VUFDL0MsTUFBTXVvQixPQUFPLEdBQUdDLGVBQWUsQ0FBQ3hvQixDQUFDLENBQUMsQ0FBQzJILENBQUMsRUFBRUMsQ0FBQyxDQUFDO1VBQ3hDLElBQUkyZ0IsT0FBTyxLQUFLLENBQUMsRUFBRTtZQUNqQixPQUFPQSxPQUFPO1VBQ2hCO1FBQ0Y7UUFFQSxPQUFPLENBQUM7TUFDVixDQUFDO0lBQ0g7SUFBQ3ZrQixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9taW5pbW9uZ28uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgJy4vbWluaW1vbmdvX2NvbW1vbi5qcyc7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIGlzTnVtZXJpY0tleSxcbiAgaXNPcGVyYXRvck9iamVjdCxcbiAgcGF0aHNUb1RyZWUsXG4gIHByb2plY3Rpb25EZXRhaWxzLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbk1pbmltb25nby5fcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMgPSBwYXRocyA9PiBwYXRocy5tYXAocGF0aCA9PlxuICBwYXRoLnNwbGl0KCcuJykuZmlsdGVyKHBhcnQgPT4gIWlzTnVtZXJpY0tleShwYXJ0KSkuam9pbignLicpXG4pO1xuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIG1vZGlmaWVyIGFwcGxpZWQgdG8gc29tZSBkb2N1bWVudCBtYXkgY2hhbmdlIHRoZSByZXN1bHRcbi8vIG9mIG1hdGNoaW5nIHRoZSBkb2N1bWVudCBieSBzZWxlY3RvclxuLy8gVGhlIG1vZGlmaWVyIGlzIGFsd2F5cyBpbiBhIGZvcm0gb2YgT2JqZWN0OlxuLy8gIC0gJHNldFxuLy8gICAgLSAnYS5iLjIyLnonOiB2YWx1ZVxuLy8gICAgLSAnZm9vLmJhcic6IDQyXG4vLyAgLSAkdW5zZXRcbi8vICAgIC0gJ2FiYy5kJzogMVxuTWluaW1vbmdvLk1hdGNoZXIucHJvdG90eXBlLmFmZmVjdGVkQnlNb2RpZmllciA9IGZ1bmN0aW9uKG1vZGlmaWVyKSB7XG4gIC8vIHNhZmUgY2hlY2sgZm9yICRzZXQvJHVuc2V0IGJlaW5nIG9iamVjdHNcbiAgbW9kaWZpZXIgPSBPYmplY3QuYXNzaWduKHskc2V0OiB7fSwgJHVuc2V0OiB7fX0sIG1vZGlmaWVyKTtcblxuICBjb25zdCBtZWFuaW5nZnVsUGF0aHMgPSB0aGlzLl9nZXRQYXRocygpO1xuICBjb25zdCBtb2RpZmllZFBhdGhzID0gW10uY29uY2F0KFxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyLiRzZXQpLFxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyLiR1bnNldClcbiAgKTtcblxuICByZXR1cm4gbW9kaWZpZWRQYXRocy5zb21lKHBhdGggPT4ge1xuICAgIGNvbnN0IG1vZCA9IHBhdGguc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBtZWFuaW5nZnVsUGF0aHMuc29tZShtZWFuaW5nZnVsUGF0aCA9PiB7XG4gICAgICBjb25zdCBzZWwgPSBtZWFuaW5nZnVsUGF0aC5zcGxpdCgnLicpO1xuXG4gICAgICBsZXQgaSA9IDAsIGogPSAwO1xuXG4gICAgICB3aGlsZSAoaSA8IHNlbC5sZW5ndGggJiYgaiA8IG1vZC5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGlzTnVtZXJpY0tleShzZWxbaV0pICYmIGlzTnVtZXJpY0tleShtb2Rbal0pKSB7XG4gICAgICAgICAgLy8gZm9vLjQuYmFyIHNlbGVjdG9yIGFmZmVjdGVkIGJ5IGZvby40IG1vZGlmaWVyXG4gICAgICAgICAgLy8gZm9vLjMuYmFyIHNlbGVjdG9yIHVuYWZmZWN0ZWQgYnkgZm9vLjQgbW9kaWZpZXJcbiAgICAgICAgICBpZiAoc2VsW2ldID09PSBtb2Rbal0pIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChpc051bWVyaWNLZXkoc2VsW2ldKSkge1xuICAgICAgICAgIC8vIGZvby40LmJhciBzZWxlY3RvciB1bmFmZmVjdGVkIGJ5IGZvby5iYXIgbW9kaWZpZXJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNOdW1lcmljS2V5KG1vZFtqXSkpIHtcbiAgICAgICAgICBqKys7XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsW2ldID09PSBtb2Rbal0pIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgaisrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPbmUgaXMgYSBwcmVmaXggb2YgYW5vdGhlciwgdGFraW5nIG51bWVyaWMgZmllbGRzIGludG8gYWNjb3VudFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuLy8gQHBhcmFtIG1vZGlmaWVyIC0gT2JqZWN0OiBNb25nb0RCLXN0eWxlZCBtb2RpZmllciB3aXRoIGAkc2V0YHMgYW5kIGAkdW5zZXRzYFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICBvbmx5LiAoYXNzdW1lZCB0byBjb21lIGZyb20gb3Bsb2cpXG4vLyBAcmV0dXJucyAtIEJvb2xlYW46IGlmIGFmdGVyIGFwcGx5aW5nIHRoZSBtb2RpZmllciwgc2VsZWN0b3IgY2FuIHN0YXJ0XG4vLyAgICAgICAgICAgICAgICAgICAgIGFjY2VwdGluZyB0aGUgbW9kaWZpZWQgdmFsdWUuXG4vLyBOT1RFOiBhc3N1bWVzIHRoYXQgZG9jdW1lbnQgYWZmZWN0ZWQgYnkgbW9kaWZpZXIgZGlkbid0IG1hdGNoIHRoaXMgTWF0Y2hlclxuLy8gYmVmb3JlLCBzbyBpZiBtb2RpZmllciBjYW4ndCBjb252aW5jZSBzZWxlY3RvciBpbiBhIHBvc2l0aXZlIGNoYW5nZSBpdCB3b3VsZFxuLy8gc3RheSAnZmFsc2UnLlxuLy8gQ3VycmVudGx5IGRvZXNuJ3Qgc3VwcG9ydCAkLW9wZXJhdG9ycyBhbmQgbnVtZXJpYyBpbmRpY2VzIHByZWNpc2VseS5cbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5jYW5CZWNvbWVUcnVlQnlNb2RpZmllciA9IGZ1bmN0aW9uKG1vZGlmaWVyKSB7XG4gIGlmICghdGhpcy5hZmZlY3RlZEJ5TW9kaWZpZXIobW9kaWZpZXIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCF0aGlzLmlzU2ltcGxlKCkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG1vZGlmaWVyID0gT2JqZWN0LmFzc2lnbih7JHNldDoge30sICR1bnNldDoge319LCBtb2RpZmllcik7XG5cbiAgY29uc3QgbW9kaWZpZXJQYXRocyA9IFtdLmNvbmNhdChcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kc2V0KSxcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kdW5zZXQpXG4gICk7XG5cbiAgaWYgKHRoaXMuX2dldFBhdGhzKCkuc29tZShwYXRoSGFzTnVtZXJpY0tleXMpIHx8XG4gICAgICBtb2RpZmllclBhdGhzLnNvbWUocGF0aEhhc051bWVyaWNLZXlzKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSAkc2V0IG9yICR1bnNldCB0aGF0IGluZGljYXRlcyBzb21ldGhpbmcgaXMgYW5cbiAgLy8gb2JqZWN0IHJhdGhlciB0aGFuIGEgc2NhbGFyIGluIHRoZSBhY3R1YWwgb2JqZWN0IHdoZXJlIHdlIHNhdyAkLW9wZXJhdG9yXG4gIC8vIE5PVEU6IGl0IGlzIGNvcnJlY3Qgc2luY2Ugd2UgYWxsb3cgb25seSBzY2FsYXJzIGluICQtb3BlcmF0b3JzXG4gIC8vIEV4YW1wbGU6IGZvciBzZWxlY3RvciB7J2EuYic6IHskZ3Q6IDV9fSB0aGUgbW9kaWZpZXIgeydhLmIuYyc6N30gd291bGRcbiAgLy8gZGVmaW5pdGVseSBzZXQgdGhlIHJlc3VsdCB0byBmYWxzZSBhcyAnYS5iJyBhcHBlYXJzIHRvIGJlIGFuIG9iamVjdC5cbiAgY29uc3QgZXhwZWN0ZWRTY2FsYXJJc09iamVjdCA9IE9iamVjdC5rZXlzKHRoaXMuX3NlbGVjdG9yKS5zb21lKHBhdGggPT4ge1xuICAgIGlmICghaXNPcGVyYXRvck9iamVjdCh0aGlzLl9zZWxlY3RvcltwYXRoXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZXJQYXRocy5zb21lKG1vZGlmaWVyUGF0aCA9PlxuICAgICAgbW9kaWZpZXJQYXRoLnN0YXJ0c1dpdGgoYCR7cGF0aH0uYClcbiAgICApO1xuICB9KTtcblxuICBpZiAoZXhwZWN0ZWRTY2FsYXJJc09iamVjdCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFNlZSBpZiB3ZSBjYW4gYXBwbHkgdGhlIG1vZGlmaWVyIG9uIHRoZSBpZGVhbGx5IG1hdGNoaW5nIG9iamVjdC4gSWYgaXRcbiAgLy8gc3RpbGwgbWF0Y2hlcyB0aGUgc2VsZWN0b3IsIHRoZW4gdGhlIG1vZGlmaWVyIGNvdWxkIGhhdmUgdHVybmVkIHRoZSByZWFsXG4gIC8vIG9iamVjdCBpbiB0aGUgZGF0YWJhc2UgaW50byBzb21ldGhpbmcgbWF0Y2hpbmcuXG4gIGNvbnN0IG1hdGNoaW5nRG9jdW1lbnQgPSBFSlNPTi5jbG9uZSh0aGlzLm1hdGNoaW5nRG9jdW1lbnQoKSk7XG5cbiAgLy8gVGhlIHNlbGVjdG9yIGlzIHRvbyBjb21wbGV4LCBhbnl0aGluZyBjYW4gaGFwcGVuLlxuICBpZiAobWF0Y2hpbmdEb2N1bWVudCA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShtYXRjaGluZ0RvY3VtZW50LCBtb2RpZmllcik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8gQ291bGRuJ3Qgc2V0IGEgcHJvcGVydHkgb24gYSBmaWVsZCB3aGljaCBpcyBhIHNjYWxhciBvciBudWxsIGluIHRoZVxuICAgIC8vIHNlbGVjdG9yLlxuICAgIC8vIEV4YW1wbGU6XG4gICAgLy8gcmVhbCBkb2N1bWVudDogeyAnYS5iJzogMyB9XG4gICAgLy8gc2VsZWN0b3I6IHsgJ2EnOiAxMiB9XG4gICAgLy8gY29udmVydGVkIHNlbGVjdG9yIChpZGVhbCBkb2N1bWVudCk6IHsgJ2EnOiAxMiB9XG4gICAgLy8gbW9kaWZpZXI6IHsgJHNldDogeyAnYS5iJzogNCB9IH1cbiAgICAvLyBXZSBkb24ndCBrbm93IHdoYXQgcmVhbCBkb2N1bWVudCB3YXMgbGlrZSBidXQgZnJvbSB0aGUgZXJyb3IgcmFpc2VkIGJ5XG4gICAgLy8gJHNldCBvbiBhIHNjYWxhciBmaWVsZCB3ZSBjYW4gcmVhc29uIHRoYXQgdGhlIHN0cnVjdHVyZSBvZiByZWFsIGRvY3VtZW50XG4gICAgLy8gaXMgY29tcGxldGVseSBkaWZmZXJlbnQuXG4gICAgaWYgKGVycm9yLm5hbWUgPT09ICdNaW5pbW9uZ29FcnJvcicgJiYgZXJyb3Iuc2V0UHJvcGVydHlFcnJvcikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuZG9jdW1lbnRNYXRjaGVzKG1hdGNoaW5nRG9jdW1lbnQpLnJlc3VsdDtcbn07XG5cbi8vIEtub3dzIGhvdyB0byBjb21iaW5lIGEgbW9uZ28gc2VsZWN0b3IgYW5kIGEgZmllbGRzIHByb2plY3Rpb24gdG8gYSBuZXcgZmllbGRzXG4vLyBwcm9qZWN0aW9uIHRha2luZyBpbnRvIGFjY291bnQgYWN0aXZlIGZpZWxkcyBmcm9tIHRoZSBwYXNzZWQgc2VsZWN0b3IuXG4vLyBAcmV0dXJucyBPYmplY3QgLSBwcm9qZWN0aW9uIG9iamVjdCAoc2FtZSBhcyBmaWVsZHMgb3B0aW9uIG9mIG1vbmdvIGN1cnNvcilcbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5jb21iaW5lSW50b1Byb2plY3Rpb24gPSBmdW5jdGlvbihwcm9qZWN0aW9uKSB7XG4gIGNvbnN0IHNlbGVjdG9yUGF0aHMgPSBNaW5pbW9uZ28uX3BhdGhzRWxpZGluZ051bWVyaWNLZXlzKHRoaXMuX2dldFBhdGhzKCkpO1xuXG4gIC8vIFNwZWNpYWwgY2FzZSBmb3IgJHdoZXJlIG9wZXJhdG9yIGluIHRoZSBzZWxlY3RvciAtIHByb2plY3Rpb24gc2hvdWxkIGRlcGVuZFxuICAvLyBvbiBhbGwgZmllbGRzIG9mIHRoZSBkb2N1bWVudC4gZ2V0U2VsZWN0b3JQYXRocyByZXR1cm5zIGEgbGlzdCBvZiBwYXRoc1xuICAvLyBzZWxlY3RvciBkZXBlbmRzIG9uLiBJZiBvbmUgb2YgdGhlIHBhdGhzIGlzICcnIChlbXB0eSBzdHJpbmcpIHJlcHJlc2VudGluZ1xuICAvLyB0aGUgcm9vdCBvciB0aGUgd2hvbGUgZG9jdW1lbnQsIGNvbXBsZXRlIHByb2plY3Rpb24gc2hvdWxkIGJlIHJldHVybmVkLlxuICBpZiAoc2VsZWN0b3JQYXRocy5pbmNsdWRlcygnJykpIHtcbiAgICByZXR1cm4ge307XG4gIH1cblxuICByZXR1cm4gY29tYmluZUltcG9ydGFudFBhdGhzSW50b1Byb2plY3Rpb24oc2VsZWN0b3JQYXRocywgcHJvamVjdGlvbik7XG59O1xuXG4vLyBSZXR1cm5zIGFuIG9iamVjdCB0aGF0IHdvdWxkIG1hdGNoIHRoZSBzZWxlY3RvciBpZiBwb3NzaWJsZSBvciBudWxsIGlmIHRoZVxuLy8gc2VsZWN0b3IgaXMgdG9vIGNvbXBsZXggZm9yIHVzIHRvIGFuYWx5emVcbi8vIHsgJ2EuYic6IHsgYW5zOiA0MiB9LCAnZm9vLmJhcic6IG51bGwsICdmb28uYmF6JzogXCJzb21ldGhpbmdcIiB9XG4vLyA9PiB7IGE6IHsgYjogeyBhbnM6IDQyIH0gfSwgZm9vOiB7IGJhcjogbnVsbCwgYmF6OiBcInNvbWV0aGluZ1wiIH0gfVxuTWluaW1vbmdvLk1hdGNoZXIucHJvdG90eXBlLm1hdGNoaW5nRG9jdW1lbnQgPSBmdW5jdGlvbigpIHtcbiAgLy8gY2hlY2sgaWYgaXQgd2FzIGNvbXB1dGVkIGJlZm9yZVxuICBpZiAodGhpcy5fbWF0Y2hpbmdEb2N1bWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQ7XG4gIH1cblxuICAvLyBJZiB0aGUgYW5hbHlzaXMgb2YgdGhpcyBzZWxlY3RvciBpcyB0b28gaGFyZCBmb3Igb3VyIGltcGxlbWVudGF0aW9uXG4gIC8vIGZhbGxiYWNrIHRvIFwiWUVTXCJcbiAgbGV0IGZhbGxiYWNrID0gZmFsc2U7XG5cbiAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IHBhdGhzVG9UcmVlKFxuICAgIHRoaXMuX2dldFBhdGhzKCksXG4gICAgcGF0aCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZVNlbGVjdG9yID0gdGhpcy5fc2VsZWN0b3JbcGF0aF07XG5cbiAgICAgIGlmIChpc09wZXJhdG9yT2JqZWN0KHZhbHVlU2VsZWN0b3IpKSB7XG4gICAgICAgIC8vIGlmIHRoZXJlIGlzIGEgc3RyaWN0IGVxdWFsaXR5LCB0aGVyZSBpcyBhIGdvb2RcbiAgICAgICAgLy8gY2hhbmNlIHdlIGNhbiB1c2Ugb25lIG9mIHRob3NlIGFzIFwibWF0Y2hpbmdcIlxuICAgICAgICAvLyBkdW1teSB2YWx1ZVxuICAgICAgICBpZiAodmFsdWVTZWxlY3Rvci4kZXEpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWVTZWxlY3Rvci4kZXE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWVTZWxlY3Rvci4kaW4pIHtcbiAgICAgICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHtwbGFjZWhvbGRlcjogdmFsdWVTZWxlY3Rvcn0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuIGFueXRoaW5nIGZyb20gJGluIHRoYXQgbWF0Y2hlcyB0aGUgd2hvbGUgc2VsZWN0b3IgZm9yIHRoaXNcbiAgICAgICAgICAvLyBwYXRoLiBJZiBub3RoaW5nIG1hdGNoZXMsIHJldHVybnMgYHVuZGVmaW5lZGAgYXMgbm90aGluZyBjYW4gbWFrZVxuICAgICAgICAgIC8vIHRoaXMgc2VsZWN0b3IgaW50byBgdHJ1ZWAuXG4gICAgICAgICAgcmV0dXJuIHZhbHVlU2VsZWN0b3IuJGluLmZpbmQocGxhY2Vob2xkZXIgPT5cbiAgICAgICAgICAgIG1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKHtwbGFjZWhvbGRlcn0pLnJlc3VsdFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob25seUNvbnRhaW5zS2V5cyh2YWx1ZVNlbGVjdG9yLCBbJyRndCcsICckZ3RlJywgJyRsdCcsICckbHRlJ10pKSB7XG4gICAgICAgICAgbGV0IGxvd2VyQm91bmQgPSAtSW5maW5pdHk7XG4gICAgICAgICAgbGV0IHVwcGVyQm91bmQgPSBJbmZpbml0eTtcblxuICAgICAgICAgIFsnJGx0ZScsICckbHQnXS5mb3JFYWNoKG9wID0+IHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh2YWx1ZVNlbGVjdG9yLCBvcCkgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZVNlbGVjdG9yW29wXSA8IHVwcGVyQm91bmQpIHtcbiAgICAgICAgICAgICAgdXBwZXJCb3VuZCA9IHZhbHVlU2VsZWN0b3Jbb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgWyckZ3RlJywgJyRndCddLmZvckVhY2gob3AgPT4ge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHZhbHVlU2VsZWN0b3IsIG9wKSAmJlxuICAgICAgICAgICAgICAgIHZhbHVlU2VsZWN0b3Jbb3BdID4gbG93ZXJCb3VuZCkge1xuICAgICAgICAgICAgICBsb3dlckJvdW5kID0gdmFsdWVTZWxlY3RvcltvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zdCBtaWRkbGUgPSAobG93ZXJCb3VuZCArIHVwcGVyQm91bmQpIC8gMjtcbiAgICAgICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHtwbGFjZWhvbGRlcjogdmFsdWVTZWxlY3Rvcn0pO1xuXG4gICAgICAgICAgaWYgKCFtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7cGxhY2Vob2xkZXI6IG1pZGRsZX0pLnJlc3VsdCAmJlxuICAgICAgICAgICAgICAobWlkZGxlID09PSBsb3dlckJvdW5kIHx8IG1pZGRsZSA9PT0gdXBwZXJCb3VuZCkpIHtcbiAgICAgICAgICAgIGZhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbWlkZGxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9ubHlDb250YWluc0tleXModmFsdWVTZWxlY3RvciwgWyckbmluJywgJyRuZSddKSkge1xuICAgICAgICAgIC8vIFNpbmNlIHRoaXMuX2lzU2ltcGxlIG1ha2VzIHN1cmUgJG5pbiBhbmQgJG5lIGFyZSBub3QgY29tYmluZWQgd2l0aFxuICAgICAgICAgIC8vIG9iamVjdHMgb3IgYXJyYXlzLCB3ZSBjYW4gY29uZmlkZW50bHkgcmV0dXJuIGFuIGVtcHR5IG9iamVjdCBhcyBpdFxuICAgICAgICAgIC8vIG5ldmVyIG1hdGNoZXMgYW55IHNjYWxhci5cbiAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cblxuICAgICAgICBmYWxsYmFjayA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcltwYXRoXTtcbiAgICB9LFxuICAgIHggPT4geCk7XG5cbiAgaWYgKGZhbGxiYWNrKSB7XG4gICAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IG51bGw7XG4gIH1cblxuICByZXR1cm4gdGhpcy5fbWF0Y2hpbmdEb2N1bWVudDtcbn07XG5cbi8vIE1pbmltb25nby5Tb3J0ZXIgZ2V0cyBhIHNpbWlsYXIgbWV0aG9kLCB3aGljaCBkZWxlZ2F0ZXMgdG8gYSBNYXRjaGVyIGl0IG1hZGVcbi8vIGZvciB0aGlzIGV4YWN0IHB1cnBvc2UuXG5NaW5pbW9uZ28uU29ydGVyLnByb3RvdHlwZS5hZmZlY3RlZEJ5TW9kaWZpZXIgPSBmdW5jdGlvbihtb2RpZmllcikge1xuICByZXR1cm4gdGhpcy5fc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIuYWZmZWN0ZWRCeU1vZGlmaWVyKG1vZGlmaWVyKTtcbn07XG5cbk1pbmltb25nby5Tb3J0ZXIucHJvdG90eXBlLmNvbWJpbmVJbnRvUHJvamVjdGlvbiA9IGZ1bmN0aW9uKHByb2plY3Rpb24pIHtcbiAgcmV0dXJuIGNvbWJpbmVJbXBvcnRhbnRQYXRoc0ludG9Qcm9qZWN0aW9uKFxuICAgIE1pbmltb25nby5fcGF0aHNFbGlkaW5nTnVtZXJpY0tleXModGhpcy5fZ2V0UGF0aHMoKSksXG4gICAgcHJvamVjdGlvblxuICApO1xufTtcblxuZnVuY3Rpb24gY29tYmluZUltcG9ydGFudFBhdGhzSW50b1Byb2plY3Rpb24ocGF0aHMsIHByb2plY3Rpb24pIHtcbiAgY29uc3QgZGV0YWlscyA9IHByb2plY3Rpb25EZXRhaWxzKHByb2plY3Rpb24pO1xuXG4gIC8vIG1lcmdlIHRoZSBwYXRocyB0byBpbmNsdWRlXG4gIGNvbnN0IHRyZWUgPSBwYXRoc1RvVHJlZShcbiAgICBwYXRocyxcbiAgICBwYXRoID0+IHRydWUsXG4gICAgKG5vZGUsIHBhdGgsIGZ1bGxQYXRoKSA9PiB0cnVlLFxuICAgIGRldGFpbHMudHJlZVxuICApO1xuICBjb25zdCBtZXJnZWRQcm9qZWN0aW9uID0gdHJlZVRvUGF0aHModHJlZSk7XG5cbiAgaWYgKGRldGFpbHMuaW5jbHVkaW5nKSB7XG4gICAgLy8gYm90aCBzZWxlY3RvciBhbmQgcHJvamVjdGlvbiBhcmUgcG9pbnRpbmcgb24gZmllbGRzIHRvIGluY2x1ZGVcbiAgICAvLyBzbyB3ZSBjYW4ganVzdCByZXR1cm4gdGhlIG1lcmdlZCB0cmVlXG4gICAgcmV0dXJuIG1lcmdlZFByb2plY3Rpb247XG4gIH1cblxuICAvLyBzZWxlY3RvciBpcyBwb2ludGluZyBhdCBmaWVsZHMgdG8gaW5jbHVkZVxuICAvLyBwcm9qZWN0aW9uIGlzIHBvaW50aW5nIGF0IGZpZWxkcyB0byBleGNsdWRlXG4gIC8vIG1ha2Ugc3VyZSB3ZSBkb24ndCBleGNsdWRlIGltcG9ydGFudCBwYXRoc1xuICBjb25zdCBtZXJnZWRFeGNsUHJvamVjdGlvbiA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKG1lcmdlZFByb2plY3Rpb24pLmZvckVhY2gocGF0aCA9PiB7XG4gICAgaWYgKCFtZXJnZWRQcm9qZWN0aW9uW3BhdGhdKSB7XG4gICAgICBtZXJnZWRFeGNsUHJvamVjdGlvbltwYXRoXSA9IGZhbHNlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG1lcmdlZEV4Y2xQcm9qZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBnZXRQYXRocyhzZWxlY3Rvcikge1xuICByZXR1cm4gT2JqZWN0LmtleXMobmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yKS5fcGF0aHMpO1xuXG4gIC8vIFhYWCByZW1vdmUgaXQ/XG4gIC8vIHJldHVybiBPYmplY3Qua2V5cyhzZWxlY3RvcikubWFwKGsgPT4ge1xuICAvLyAgIC8vIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZSAkd2hlcmUgYmVjYXVzZSBpdCBjYW4gYmUgYW55dGhpbmdcbiAgLy8gICBpZiAoayA9PT0gJyR3aGVyZScpIHtcbiAgLy8gICAgIHJldHVybiAnJzsgLy8gbWF0Y2hlcyBldmVyeXRoaW5nXG4gIC8vICAgfVxuXG4gIC8vICAgLy8gd2UgYnJhbmNoIGZyb20gJG9yLyRhbmQvJG5vciBvcGVyYXRvclxuICAvLyAgIGlmIChbJyRvcicsICckYW5kJywgJyRub3InXS5pbmNsdWRlcyhrKSkge1xuICAvLyAgICAgcmV0dXJuIHNlbGVjdG9yW2tdLm1hcChnZXRQYXRocyk7XG4gIC8vICAgfVxuXG4gIC8vICAgLy8gdGhlIHZhbHVlIGlzIGEgbGl0ZXJhbCBvciBzb21lIGNvbXBhcmlzb24gb3BlcmF0b3JcbiAgLy8gICByZXR1cm4gaztcbiAgLy8gfSlcbiAgLy8gICAucmVkdWNlKChhLCBiKSA9PiBhLmNvbmNhdChiKSwgW10pXG4gIC8vICAgLmZpbHRlcigoYSwgYiwgYykgPT4gYy5pbmRleE9mKGEpID09PSBiKTtcbn1cblxuLy8gQSBoZWxwZXIgdG8gZW5zdXJlIG9iamVjdCBoYXMgb25seSBjZXJ0YWluIGtleXNcbmZ1bmN0aW9uIG9ubHlDb250YWluc0tleXMob2JqLCBrZXlzKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLmV2ZXJ5KGsgPT4ga2V5cy5pbmNsdWRlcyhrKSk7XG59XG5cbmZ1bmN0aW9uIHBhdGhIYXNOdW1lcmljS2V5cyhwYXRoKSB7XG4gIHJldHVybiBwYXRoLnNwbGl0KCcuJykuc29tZShpc051bWVyaWNLZXkpO1xufVxuXG4vLyBSZXR1cm5zIGEgc2V0IG9mIGtleSBwYXRocyBzaW1pbGFyIHRvXG4vLyB7ICdmb28uYmFyJzogMSwgJ2EuYi5jJzogMSB9XG5mdW5jdGlvbiB0cmVlVG9QYXRocyh0cmVlLCBwcmVmaXggPSAnJykge1xuICBjb25zdCByZXN1bHQgPSB7fTtcblxuICBPYmplY3Qua2V5cyh0cmVlKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSB0cmVlW2tleV07XG4gICAgaWYgKHZhbHVlID09PSBPYmplY3QodmFsdWUpKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgdHJlZVRvUGF0aHModmFsdWUsIGAke3ByZWZpeCArIGtleX0uYCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRbcHJlZml4ICsga2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb24gZnJvbSAnLi9sb2NhbF9jb2xsZWN0aW9uLmpzJztcblxuZXhwb3J0IGNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIEVhY2ggZWxlbWVudCBzZWxlY3RvciBjb250YWluczpcbi8vICAtIGNvbXBpbGVFbGVtZW50U2VsZWN0b3IsIGEgZnVuY3Rpb24gd2l0aCBhcmdzOlxuLy8gICAgLSBvcGVyYW5kIC0gdGhlIFwicmlnaHQgaGFuZCBzaWRlXCIgb2YgdGhlIG9wZXJhdG9yXG4vLyAgICAtIHZhbHVlU2VsZWN0b3IgLSB0aGUgXCJjb250ZXh0XCIgZm9yIHRoZSBvcGVyYXRvciAoc28gdGhhdCAkcmVnZXggY2FuIGZpbmRcbi8vICAgICAgJG9wdGlvbnMpXG4vLyAgICAtIG1hdGNoZXIgLSB0aGUgTWF0Y2hlciB0aGlzIGlzIGdvaW5nIGludG8gKHNvIHRoYXQgJGVsZW1NYXRjaCBjYW4gY29tcGlsZVxuLy8gICAgICBtb3JlIHRoaW5ncylcbi8vICAgIHJldHVybmluZyBhIGZ1bmN0aW9uIG1hcHBpbmcgYSBzaW5nbGUgdmFsdWUgdG8gYm9vbC5cbi8vICAtIGRvbnRFeHBhbmRMZWFmQXJyYXlzLCBhIGJvb2wgd2hpY2ggcHJldmVudHMgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyBmcm9tXG4vLyAgICBiZWluZyBjYWxsZWRcbi8vICAtIGRvbnRJbmNsdWRlTGVhZkFycmF5cywgYSBib29sIHdoaWNoIGNhdXNlcyBhbiBhcmd1bWVudCB0byBiZSBwYXNzZWQgdG9cbi8vICAgIGV4cGFuZEFycmF5c0luQnJhbmNoZXMgaWYgaXQgaXMgY2FsbGVkXG5leHBvcnQgY29uc3QgRUxFTUVOVF9PUEVSQVRPUlMgPSB7XG4gICRsdDogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPCAwKSxcbiAgJGd0OiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZSA9PiBjbXBWYWx1ZSA+IDApLFxuICAkbHRlOiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZSA9PiBjbXBWYWx1ZSA8PSAwKSxcbiAgJGd0ZTogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPj0gMCksXG4gICRtb2Q6IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICghKEFycmF5LmlzQXJyYXkob3BlcmFuZCkgJiYgb3BlcmFuZC5sZW5ndGggPT09IDJcbiAgICAgICAgICAgICYmIHR5cGVvZiBvcGVyYW5kWzBdID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgJiYgdHlwZW9mIG9wZXJhbmRbMV0gPT09ICdudW1iZXInKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignYXJndW1lbnQgdG8gJG1vZCBtdXN0IGJlIGFuIGFycmF5IG9mIHR3byBudW1iZXJzJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBjb3VsZCByZXF1aXJlIHRvIGJlIGludHMgb3Igcm91bmQgb3Igc29tZXRoaW5nXG4gICAgICBjb25zdCBkaXZpc29yID0gb3BlcmFuZFswXTtcbiAgICAgIGNvbnN0IHJlbWFpbmRlciA9IG9wZXJhbmRbMV07XG4gICAgICByZXR1cm4gdmFsdWUgPT4gKFxuICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICUgZGl2aXNvciA9PT0gcmVtYWluZGVyXG4gICAgICApO1xuICAgIH0sXG4gIH0sXG4gICRpbjoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckaW4gbmVlZHMgYW4gYXJyYXknKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudE1hdGNoZXJzID0gb3BlcmFuZC5tYXAob3B0aW9uID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiByZWdleHBFbGVtZW50TWF0Y2hlcihvcHRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzT3BlcmF0b3JPYmplY3Qob3B0aW9uKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgbmVzdCAkIHVuZGVyICRpbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIob3B0aW9uKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICAvLyBBbGxvdyB7YTogeyRpbjogW251bGxdfX0gdG8gbWF0Y2ggd2hlbiAnYScgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVsZW1lbnRNYXRjaGVycy5zb21lKG1hdGNoZXIgPT4gbWF0Y2hlcih2YWx1ZSkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkc2l6ZToge1xuICAgIC8vIHthOiBbWzUsIDVdXX0gbXVzdCBtYXRjaCB7YTogeyRzaXplOiAxfX0gYnV0IG5vdCB7YTogeyRzaXplOiAyfX0sIHNvIHdlXG4gICAgLy8gZG9uJ3Qgd2FudCB0byBjb25zaWRlciB0aGUgZWxlbWVudCBbNSw1XSBpbiB0aGUgbGVhZiBhcnJheSBbWzUsNV1dIGFzIGFcbiAgICAvLyBwb3NzaWJsZSB2YWx1ZS5cbiAgICBkb250RXhwYW5kTGVhZkFycmF5czogdHJ1ZSxcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gRG9uJ3QgYXNrIG1lIHdoeSwgYnV0IGJ5IGV4cGVyaW1lbnRhdGlvbiwgdGhpcyBzZWVtcyB0byBiZSB3aGF0IE1vbmdvXG4gICAgICAgIC8vIGRvZXMuXG4gICAgICAgIG9wZXJhbmQgPSAwO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BlcmFuZCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJyRzaXplIG5lZWRzIGEgbnVtYmVyJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB2YWx1ZSA9PiBBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IG9wZXJhbmQ7XG4gICAgfSxcbiAgfSxcbiAgJHR5cGU6IHtcbiAgICAvLyB7YTogWzVdfSBtdXN0IG5vdCBtYXRjaCB7YTogeyR0eXBlOiA0fX0gKDQgbWVhbnMgYXJyYXkpLCBidXQgaXQgc2hvdWxkXG4gICAgLy8gbWF0Y2gge2E6IHskdHlwZTogMX19ICgxIG1lYW5zIG51bWJlciksIGFuZCB7YTogW1s1XV19IG11c3QgbWF0Y2ggeyRhOlxuICAgIC8vIHskdHlwZTogNH19LiBUaHVzLCB3aGVuIHdlIHNlZSBhIGxlYWYgYXJyYXksIHdlICpzaG91bGQqIGV4cGFuZCBpdCBidXRcbiAgICAvLyBzaG91bGQgKm5vdCogaW5jbHVkZSBpdCBpdHNlbGYuXG4gICAgZG9udEluY2x1ZGVMZWFmQXJyYXlzOiB0cnVlLFxuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgaWYgKHR5cGVvZiBvcGVyYW5kID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBvcGVyYW5kQWxpYXNNYXAgPSB7XG4gICAgICAgICAgJ2RvdWJsZSc6IDEsXG4gICAgICAgICAgJ3N0cmluZyc6IDIsXG4gICAgICAgICAgJ29iamVjdCc6IDMsXG4gICAgICAgICAgJ2FycmF5JzogNCxcbiAgICAgICAgICAnYmluRGF0YSc6IDUsXG4gICAgICAgICAgJ3VuZGVmaW5lZCc6IDYsXG4gICAgICAgICAgJ29iamVjdElkJzogNyxcbiAgICAgICAgICAnYm9vbCc6IDgsXG4gICAgICAgICAgJ2RhdGUnOiA5LFxuICAgICAgICAgICdudWxsJzogMTAsXG4gICAgICAgICAgJ3JlZ2V4JzogMTEsXG4gICAgICAgICAgJ2RiUG9pbnRlcic6IDEyLFxuICAgICAgICAgICdqYXZhc2NyaXB0JzogMTMsXG4gICAgICAgICAgJ3N5bWJvbCc6IDE0LFxuICAgICAgICAgICdqYXZhc2NyaXB0V2l0aFNjb3BlJzogMTUsXG4gICAgICAgICAgJ2ludCc6IDE2LFxuICAgICAgICAgICd0aW1lc3RhbXAnOiAxNyxcbiAgICAgICAgICAnbG9uZyc6IDE4LFxuICAgICAgICAgICdkZWNpbWFsJzogMTksXG4gICAgICAgICAgJ21pbktleSc6IC0xLFxuICAgICAgICAgICdtYXhLZXknOiAxMjcsXG4gICAgICAgIH07XG4gICAgICAgIGlmICghaGFzT3duLmNhbGwob3BlcmFuZEFsaWFzTWFwLCBvcGVyYW5kKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGB1bmtub3duIHN0cmluZyBhbGlhcyBmb3IgJHR5cGU6ICR7b3BlcmFuZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBvcGVyYW5kID0gb3BlcmFuZEFsaWFzTWFwW29wZXJhbmRdO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgaWYgKG9wZXJhbmQgPT09IDAgfHwgb3BlcmFuZCA8IC0xXG4gICAgICAgICAgfHwgKG9wZXJhbmQgPiAxOSAmJiBvcGVyYW5kICE9PSAxMjcpKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoYEludmFsaWQgbnVtZXJpY2FsICR0eXBlIGNvZGU6ICR7b3BlcmFuZH1gKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ2FyZ3VtZW50IHRvICR0eXBlIGlzIG5vdCBhIG51bWJlciBvciBhIHN0cmluZycpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsdWUgPT4gKFxuICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZSh2YWx1ZSkgPT09IG9wZXJhbmRcbiAgICAgICk7XG4gICAgfSxcbiAgfSxcbiAgJGJpdHNBbGxTZXQ6IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGNvbnN0IG1hc2sgPSBnZXRPcGVyYW5kQml0bWFzayhvcGVyYW5kLCAnJGJpdHNBbGxTZXQnKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5ldmVyeSgoYnl0ZSwgaSkgPT4gKGJpdG1hc2tbaV0gJiBieXRlKSA9PT0gYnl0ZSk7XG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG4gICRiaXRzQW55U2V0OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQW55U2V0Jyk7XG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBjb25zdCBiaXRtYXNrID0gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBtYXNrLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBiaXRtYXNrICYmIG1hc2suc29tZSgoYnl0ZSwgaSkgPT4gKH5iaXRtYXNrW2ldICYgYnl0ZSkgIT09IGJ5dGUpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FsbENsZWFyOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQWxsQ2xlYXInKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5ldmVyeSgoYnl0ZSwgaSkgPT4gIShiaXRtYXNrW2ldICYgYnl0ZSkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FueUNsZWFyOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQW55Q2xlYXInKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5zb21lKChieXRlLCBpKSA9PiAoYml0bWFza1tpXSAmIGJ5dGUpICE9PSBieXRlKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbiAgJHJlZ2V4OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yKSB7XG4gICAgICBpZiAoISh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycgfHwgb3BlcmFuZCBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJyRyZWdleCBoYXMgdG8gYmUgYSBzdHJpbmcgb3IgUmVnRXhwJyk7XG4gICAgICB9XG5cbiAgICAgIGxldCByZWdleHA7XG4gICAgICBpZiAodmFsdWVTZWxlY3Rvci4kb3B0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIE9wdGlvbnMgcGFzc2VkIGluICRvcHRpb25zIChldmVuIHRoZSBlbXB0eSBzdHJpbmcpIGFsd2F5cyBvdmVycmlkZXNcbiAgICAgICAgLy8gb3B0aW9ucyBpbiB0aGUgUmVnRXhwIG9iamVjdCBpdHNlbGYuXG5cbiAgICAgICAgLy8gQmUgY2xlYXIgdGhhdCB3ZSBvbmx5IHN1cHBvcnQgdGhlIEpTLXN1cHBvcnRlZCBvcHRpb25zLCBub3QgZXh0ZW5kZWRcbiAgICAgICAgLy8gb25lcyAoZWcsIE1vbmdvIHN1cHBvcnRzIHggYW5kIHMpLiBJZGVhbGx5IHdlIHdvdWxkIGltcGxlbWVudCB4IGFuZCBzXG4gICAgICAgIC8vIGJ5IHRyYW5zZm9ybWluZyB0aGUgcmVnZXhwLCBidXQgbm90IHRvZGF5Li4uXG4gICAgICAgIGlmICgvW15naW1dLy50ZXN0KHZhbHVlU2VsZWN0b3IuJG9wdGlvbnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IHRoZSBpLCBtLCBhbmQgZyByZWdleHAgb3B0aW9ucyBhcmUgc3VwcG9ydGVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzb3VyY2UgPSBvcGVyYW5kIGluc3RhbmNlb2YgUmVnRXhwID8gb3BlcmFuZC5zb3VyY2UgOiBvcGVyYW5kO1xuICAgICAgICByZWdleHAgPSBuZXcgUmVnRXhwKHNvdXJjZSwgdmFsdWVTZWxlY3Rvci4kb3B0aW9ucyk7XG4gICAgICB9IGVsc2UgaWYgKG9wZXJhbmQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgcmVnZXhwID0gb3BlcmFuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlZ2V4cCA9IG5ldyBSZWdFeHAob3BlcmFuZCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWdleHBFbGVtZW50TWF0Y2hlcihyZWdleHApO1xuICAgIH0sXG4gIH0sXG4gICRlbGVtTWF0Y2g6IHtcbiAgICBkb250RXhwYW5kTGVhZkFycmF5czogdHJ1ZSxcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIpIHtcbiAgICAgIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KG9wZXJhbmQpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckZWxlbU1hdGNoIG5lZWQgYW4gb2JqZWN0Jyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRG9jTWF0Y2hlciA9ICFpc09wZXJhdG9yT2JqZWN0KFxuICAgICAgICBPYmplY3Qua2V5cyhvcGVyYW5kKVxuICAgICAgICAgIC5maWx0ZXIoa2V5ID0+ICFoYXNPd24uY2FsbChMT0dJQ0FMX09QRVJBVE9SUywga2V5KSlcbiAgICAgICAgICAucmVkdWNlKChhLCBiKSA9PiBPYmplY3QuYXNzaWduKGEsIHtbYl06IG9wZXJhbmRbYl19KSwge30pLFxuICAgICAgICB0cnVlKTtcblxuICAgICAgbGV0IHN1Yk1hdGNoZXI7XG4gICAgICBpZiAoaXNEb2NNYXRjaGVyKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgTk9UIHRoZSBzYW1lIGFzIGNvbXBpbGVWYWx1ZVNlbGVjdG9yKG9wZXJhbmQpLCBhbmQgbm90IGp1c3RcbiAgICAgICAgLy8gYmVjYXVzZSBvZiB0aGUgc2xpZ2h0bHkgZGlmZmVyZW50IGNhbGxpbmcgY29udmVudGlvbi5cbiAgICAgICAgLy8geyRlbGVtTWF0Y2g6IHt4OiAzfX0gbWVhbnMgXCJhbiBlbGVtZW50IGhhcyBhIGZpZWxkIHg6M1wiLCBub3RcbiAgICAgICAgLy8gXCJjb25zaXN0cyBvbmx5IG9mIGEgZmllbGQgeDozXCIuIEFsc28sIHJlZ2V4cHMgYW5kIHN1Yi0kIGFyZSBhbGxvd2VkLlxuICAgICAgICBzdWJNYXRjaGVyID1cbiAgICAgICAgICBjb21waWxlRG9jdW1lbnRTZWxlY3RvcihvcGVyYW5kLCBtYXRjaGVyLCB7aW5FbGVtTWF0Y2g6IHRydWV9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1Yk1hdGNoZXIgPSBjb21waWxlVmFsdWVTZWxlY3RvcihvcGVyYW5kLCBtYXRjaGVyKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjb25zdCBhcnJheUVsZW1lbnQgPSB2YWx1ZVtpXTtcbiAgICAgICAgICBsZXQgYXJnO1xuICAgICAgICAgIGlmIChpc0RvY01hdGNoZXIpIHtcbiAgICAgICAgICAgIC8vIFdlIGNhbiBvbmx5IG1hdGNoIHskZWxlbU1hdGNoOiB7YjogM319IGFnYWluc3Qgb2JqZWN0cy5cbiAgICAgICAgICAgIC8vIChXZSBjYW4gYWxzbyBtYXRjaCBhZ2FpbnN0IGFycmF5cywgaWYgdGhlcmUncyBudW1lcmljIGluZGljZXMsXG4gICAgICAgICAgICAvLyBlZyB7JGVsZW1NYXRjaDogeycwLmInOiAzfX0gb3IgeyRlbGVtTWF0Y2g6IHswOiAzfX0uKVxuICAgICAgICAgICAgaWYgKCFpc0luZGV4YWJsZShhcnJheUVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXJnID0gYXJyYXlFbGVtZW50O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb250SXRlcmF0ZSBlbnN1cmVzIHRoYXQge2E6IHskZWxlbU1hdGNoOiB7JGd0OiA1fX19IG1hdGNoZXNcbiAgICAgICAgICAgIC8vIHthOiBbOF19IGJ1dCBub3Qge2E6IFtbOF1dfVxuICAgICAgICAgICAgYXJnID0gW3t2YWx1ZTogYXJyYXlFbGVtZW50LCBkb250SXRlcmF0ZTogdHJ1ZX1dO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBYWFggc3VwcG9ydCAkbmVhciBpbiAkZWxlbU1hdGNoIGJ5IHByb3BhZ2F0aW5nICRkaXN0YW5jZT9cbiAgICAgICAgICBpZiAoc3ViTWF0Y2hlcihhcmcpLnJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7IC8vIHNwZWNpYWxseSB1bmRlcnN0b29kIHRvIG1lYW4gXCJ1c2UgYXMgYXJyYXlJbmRpY2VzXCJcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG59O1xuXG4vLyBPcGVyYXRvcnMgdGhhdCBhcHBlYXIgYXQgdGhlIHRvcCBsZXZlbCBvZiBhIGRvY3VtZW50IHNlbGVjdG9yLlxuY29uc3QgTE9HSUNBTF9PUEVSQVRPUlMgPSB7XG4gICRhbmQoc3ViU2VsZWN0b3IsIG1hdGNoZXIsIGluRWxlbU1hdGNoKSB7XG4gICAgcmV0dXJuIGFuZERvY3VtZW50TWF0Y2hlcnMoXG4gICAgICBjb21waWxlQXJyYXlPZkRvY3VtZW50U2VsZWN0b3JzKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBpbkVsZW1NYXRjaClcbiAgICApO1xuICB9LFxuXG4gICRvcihzdWJTZWxlY3RvciwgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpIHtcbiAgICBjb25zdCBtYXRjaGVycyA9IGNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMoXG4gICAgICBzdWJTZWxlY3RvcixcbiAgICAgIG1hdGNoZXIsXG4gICAgICBpbkVsZW1NYXRjaFxuICAgICk7XG5cbiAgICAvLyBTcGVjaWFsIGNhc2U6IGlmIHRoZXJlIGlzIG9ubHkgb25lIG1hdGNoZXIsIHVzZSBpdCBkaXJlY3RseSwgKnByZXNlcnZpbmcqXG4gICAgLy8gYW55IGFycmF5SW5kaWNlcyBpdCByZXR1cm5zLlxuICAgIGlmIChtYXRjaGVycy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBtYXRjaGVyc1swXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZG9jID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoZXJzLnNvbWUoZm4gPT4gZm4oZG9jKS5yZXN1bHQpO1xuICAgICAgLy8gJG9yIGRvZXMgTk9UIHNldCBhcnJheUluZGljZXMgd2hlbiBpdCBoYXMgbXVsdGlwbGVcbiAgICAgIC8vIHN1Yi1leHByZXNzaW9ucy4gKFRlc3RlZCBhZ2FpbnN0IE1vbmdvREIuKVxuICAgICAgcmV0dXJuIHtyZXN1bHR9O1xuICAgIH07XG4gIH0sXG5cbiAgJG5vcihzdWJTZWxlY3RvciwgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpIHtcbiAgICBjb25zdCBtYXRjaGVycyA9IGNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMoXG4gICAgICBzdWJTZWxlY3RvcixcbiAgICAgIG1hdGNoZXIsXG4gICAgICBpbkVsZW1NYXRjaFxuICAgICk7XG4gICAgcmV0dXJuIGRvYyA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaGVycy5ldmVyeShmbiA9PiAhZm4oZG9jKS5yZXN1bHQpO1xuICAgICAgLy8gTmV2ZXIgc2V0IGFycmF5SW5kaWNlcywgYmVjYXVzZSB3ZSBvbmx5IG1hdGNoIGlmIG5vdGhpbmcgaW4gcGFydGljdWxhclxuICAgICAgLy8gJ21hdGNoZWQnIChhbmQgYmVjYXVzZSB0aGlzIGlzIGNvbnNpc3RlbnQgd2l0aCBNb25nb0RCKS5cbiAgICAgIHJldHVybiB7cmVzdWx0fTtcbiAgICB9O1xuICB9LFxuXG4gICR3aGVyZShzZWxlY3RvclZhbHVlLCBtYXRjaGVyKSB7XG4gICAgLy8gUmVjb3JkIHRoYXQgKmFueSogcGF0aCBtYXkgYmUgdXNlZC5cbiAgICBtYXRjaGVyLl9yZWNvcmRQYXRoVXNlZCgnJyk7XG4gICAgbWF0Y2hlci5faGFzV2hlcmUgPSB0cnVlO1xuXG4gICAgaWYgKCEoc2VsZWN0b3JWYWx1ZSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSkge1xuICAgICAgLy8gWFhYIE1vbmdvREIgc2VlbXMgdG8gaGF2ZSBtb3JlIGNvbXBsZXggbG9naWMgdG8gZGVjaWRlIHdoZXJlIG9yIG9yIG5vdFxuICAgICAgLy8gdG8gYWRkICdyZXR1cm4nOyBub3Qgc3VyZSBleGFjdGx5IHdoYXQgaXQgaXMuXG4gICAgICBzZWxlY3RvclZhbHVlID0gRnVuY3Rpb24oJ29iaicsIGByZXR1cm4gJHtzZWxlY3RvclZhbHVlfWApO1xuICAgIH1cblxuICAgIC8vIFdlIG1ha2UgdGhlIGRvY3VtZW50IGF2YWlsYWJsZSBhcyBib3RoIGB0aGlzYCBhbmQgYG9iamAuXG4gICAgLy8gLy8gWFhYIG5vdCBzdXJlIHdoYXQgd2Ugc2hvdWxkIGRvIGlmIHRoaXMgdGhyb3dzXG4gICAgcmV0dXJuIGRvYyA9PiAoe3Jlc3VsdDogc2VsZWN0b3JWYWx1ZS5jYWxsKGRvYywgZG9jKX0pO1xuICB9LFxuXG4gIC8vIFRoaXMgaXMganVzdCB1c2VkIGFzIGEgY29tbWVudCBpbiB0aGUgcXVlcnkgKGluIE1vbmdvREIsIGl0IGFsc28gZW5kcyB1cCBpblxuICAvLyBxdWVyeSBsb2dzKTsgaXQgaGFzIG5vIGVmZmVjdCBvbiB0aGUgYWN0dWFsIHNlbGVjdGlvbi5cbiAgJGNvbW1lbnQoKSB7XG4gICAgcmV0dXJuICgpID0+ICh7cmVzdWx0OiB0cnVlfSk7XG4gIH0sXG59O1xuXG4vLyBPcGVyYXRvcnMgdGhhdCAodW5saWtlIExPR0lDQUxfT1BFUkFUT1JTKSBwZXJ0YWluIHRvIGluZGl2aWR1YWwgcGF0aHMgaW4gYVxuLy8gZG9jdW1lbnQsIGJ1dCAodW5saWtlIEVMRU1FTlRfT1BFUkFUT1JTKSBkbyBub3QgaGF2ZSBhIHNpbXBsZSBkZWZpbml0aW9uIGFzXG4vLyBcIm1hdGNoIGVhY2ggYnJhbmNoZWQgdmFsdWUgaW5kZXBlbmRlbnRseSBhbmQgY29tYmluZSB3aXRoXG4vLyBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlclwiLlxuY29uc3QgVkFMVUVfT1BFUkFUT1JTID0ge1xuICAkZXEob3BlcmFuZCkge1xuICAgIHJldHVybiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIob3BlcmFuZClcbiAgICApO1xuICB9LFxuICAkbm90KG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIpIHtcbiAgICByZXR1cm4gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKGNvbXBpbGVWYWx1ZVNlbGVjdG9yKG9wZXJhbmQsIG1hdGNoZXIpKTtcbiAgfSxcbiAgJG5lKG9wZXJhbmQpIHtcbiAgICByZXR1cm4gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKFxuICAgICAgY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoZXF1YWxpdHlFbGVtZW50TWF0Y2hlcihvcGVyYW5kKSlcbiAgICApO1xuICB9LFxuICAkbmluKG9wZXJhbmQpIHtcbiAgICByZXR1cm4gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKFxuICAgICAgY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICAgIEVMRU1FTlRfT1BFUkFUT1JTLiRpbi5jb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpXG4gICAgICApXG4gICAgKTtcbiAgfSxcbiAgJGV4aXN0cyhvcGVyYW5kKSB7XG4gICAgY29uc3QgZXhpc3RzID0gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICB2YWx1ZSA9PiB2YWx1ZSAhPT0gdW5kZWZpbmVkXG4gICAgKTtcbiAgICByZXR1cm4gb3BlcmFuZCA/IGV4aXN0cyA6IGludmVydEJyYW5jaGVkTWF0Y2hlcihleGlzdHMpO1xuICB9LFxuICAvLyAkb3B0aW9ucyBqdXN0IHByb3ZpZGVzIG9wdGlvbnMgZm9yICRyZWdleDsgaXRzIGxvZ2ljIGlzIGluc2lkZSAkcmVnZXhcbiAgJG9wdGlvbnMob3BlcmFuZCwgdmFsdWVTZWxlY3Rvcikge1xuICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVTZWxlY3RvciwgJyRyZWdleCcpKSB7XG4gICAgICB0aHJvdyBFcnJvcignJG9wdGlvbnMgbmVlZHMgYSAkcmVnZXgnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXZlcnl0aGluZ01hdGNoZXI7XG4gIH0sXG4gIC8vICRtYXhEaXN0YW5jZSBpcyBiYXNpY2FsbHkgYW4gYXJndW1lbnQgdG8gJG5lYXJcbiAgJG1heERpc3RhbmNlKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IpIHtcbiAgICBpZiAoIXZhbHVlU2VsZWN0b3IuJG5lYXIpIHtcbiAgICAgIHRocm93IEVycm9yKCckbWF4RGlzdGFuY2UgbmVlZHMgYSAkbmVhcicpO1xuICAgIH1cblxuICAgIHJldHVybiBldmVyeXRoaW5nTWF0Y2hlcjtcbiAgfSxcbiAgJGFsbChvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICB0aHJvdyBFcnJvcignJGFsbCByZXF1aXJlcyBhcnJheScpO1xuICAgIH1cblxuICAgIC8vIE5vdCBzdXJlIHdoeSwgYnV0IHRoaXMgc2VlbXMgdG8gYmUgd2hhdCBNb25nb0RCIGRvZXMuXG4gICAgaWYgKG9wZXJhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbm90aGluZ01hdGNoZXI7XG4gICAgfVxuXG4gICAgY29uc3QgYnJhbmNoZWRNYXRjaGVycyA9IG9wZXJhbmQubWFwKGNyaXRlcmlvbiA9PiB7XG4gICAgICAvLyBYWFggaGFuZGxlICRhbGwvJGVsZW1NYXRjaCBjb21iaW5hdGlvblxuICAgICAgaWYgKGlzT3BlcmF0b3JPYmplY3QoY3JpdGVyaW9uKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignbm8gJCBleHByZXNzaW9ucyBpbiAkYWxsJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoaXMgaXMgYWx3YXlzIGEgcmVnZXhwIG9yIGVxdWFsaXR5IHNlbGVjdG9yLlxuICAgICAgcmV0dXJuIGNvbXBpbGVWYWx1ZVNlbGVjdG9yKGNyaXRlcmlvbiwgbWF0Y2hlcik7XG4gICAgfSk7XG5cbiAgICAvLyBhbmRCcmFuY2hlZE1hdGNoZXJzIGRvZXMgTk9UIHJlcXVpcmUgYWxsIHNlbGVjdG9ycyB0byByZXR1cm4gdHJ1ZSBvbiB0aGVcbiAgICAvLyBTQU1FIGJyYW5jaC5cbiAgICByZXR1cm4gYW5kQnJhbmNoZWRNYXRjaGVycyhicmFuY2hlZE1hdGNoZXJzKTtcbiAgfSxcbiAgJG5lYXIob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlciwgaXNSb290KSB7XG4gICAgaWYgKCFpc1Jvb3QpIHtcbiAgICAgIHRocm93IEVycm9yKCckbmVhciBjYW5cXCd0IGJlIGluc2lkZSBhbm90aGVyICQgb3BlcmF0b3InKTtcbiAgICB9XG5cbiAgICBtYXRjaGVyLl9oYXNHZW9RdWVyeSA9IHRydWU7XG5cbiAgICAvLyBUaGVyZSBhcmUgdHdvIGtpbmRzIG9mIGdlb2RhdGEgaW4gTW9uZ29EQjogbGVnYWN5IGNvb3JkaW5hdGUgcGFpcnMgYW5kXG4gICAgLy8gR2VvSlNPTi4gVGhleSB1c2UgZGlmZmVyZW50IGRpc3RhbmNlIG1ldHJpY3MsIHRvby4gR2VvSlNPTiBxdWVyaWVzIGFyZVxuICAgIC8vIG1hcmtlZCB3aXRoIGEgJGdlb21ldHJ5IHByb3BlcnR5LCB0aG91Z2ggbGVnYWN5IGNvb3JkaW5hdGVzIGNhbiBiZVxuICAgIC8vIG1hdGNoZWQgdXNpbmcgJGdlb21ldHJ5LlxuICAgIGxldCBtYXhEaXN0YW5jZSwgcG9pbnQsIGRpc3RhbmNlO1xuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3Qob3BlcmFuZCkgJiYgaGFzT3duLmNhbGwob3BlcmFuZCwgJyRnZW9tZXRyeScpKSB7XG4gICAgICAvLyBHZW9KU09OIFwiMmRzcGhlcmVcIiBtb2RlLlxuICAgICAgbWF4RGlzdGFuY2UgPSBvcGVyYW5kLiRtYXhEaXN0YW5jZTtcbiAgICAgIHBvaW50ID0gb3BlcmFuZC4kZ2VvbWV0cnk7XG4gICAgICBkaXN0YW5jZSA9IHZhbHVlID0+IHtcbiAgICAgICAgLy8gWFhYOiBmb3Igbm93LCB3ZSBkb24ndCBjYWxjdWxhdGUgdGhlIGFjdHVhbCBkaXN0YW5jZSBiZXR3ZWVuLCBzYXksXG4gICAgICAgIC8vIHBvbHlnb24gYW5kIGNpcmNsZS4gSWYgcGVvcGxlIGNhcmUgYWJvdXQgdGhpcyB1c2UtY2FzZSBpdCB3aWxsIGdldFxuICAgICAgICAvLyBhIHByaW9yaXR5LlxuICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXZhbHVlLnR5cGUpIHtcbiAgICAgICAgICByZXR1cm4gR2VvSlNPTi5wb2ludERpc3RhbmNlKFxuICAgICAgICAgICAgcG9pbnQsXG4gICAgICAgICAgICB7dHlwZTogJ1BvaW50JywgY29vcmRpbmF0ZXM6IHBvaW50VG9BcnJheSh2YWx1ZSl9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS50eXBlID09PSAnUG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIEdlb0pTT04ucG9pbnREaXN0YW5jZShwb2ludCwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIEdlb0pTT04uZ2VvbWV0cnlXaXRoaW5SYWRpdXModmFsdWUsIHBvaW50LCBtYXhEaXN0YW5jZSlcbiAgICAgICAgICA/IDBcbiAgICAgICAgICA6IG1heERpc3RhbmNlICsgMTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heERpc3RhbmNlID0gdmFsdWVTZWxlY3Rvci4kbWF4RGlzdGFuY2U7XG5cbiAgICAgIGlmICghaXNJbmRleGFibGUob3BlcmFuZCkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJyRuZWFyIGFyZ3VtZW50IG11c3QgYmUgY29vcmRpbmF0ZSBwYWlyIG9yIEdlb0pTT04nKTtcbiAgICAgIH1cblxuICAgICAgcG9pbnQgPSBwb2ludFRvQXJyYXkob3BlcmFuZCk7XG5cbiAgICAgIGRpc3RhbmNlID0gdmFsdWUgPT4ge1xuICAgICAgICBpZiAoIWlzSW5kZXhhYmxlKHZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzKHBvaW50LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBicmFuY2hlZFZhbHVlcyA9PiB7XG4gICAgICAvLyBUaGVyZSBtaWdodCBiZSBtdWx0aXBsZSBwb2ludHMgaW4gdGhlIGRvY3VtZW50IHRoYXQgbWF0Y2ggdGhlIGdpdmVuXG4gICAgICAvLyBmaWVsZC4gT25seSBvbmUgb2YgdGhlbSBuZWVkcyB0byBiZSB3aXRoaW4gJG1heERpc3RhbmNlLCBidXQgd2UgbmVlZCB0b1xuICAgICAgLy8gZXZhbHVhdGUgYWxsIG9mIHRoZW0gYW5kIHVzZSB0aGUgbmVhcmVzdCBvbmUgZm9yIHRoZSBpbXBsaWNpdCBzb3J0XG4gICAgICAvLyBzcGVjaWZpZXIuIChUaGF0J3Mgd2h5IHdlIGNhbid0IGp1c3QgdXNlIEVMRU1FTlRfT1BFUkFUT1JTIGhlcmUuKVxuICAgICAgLy9cbiAgICAgIC8vIE5vdGU6IFRoaXMgZGlmZmVycyBmcm9tIE1vbmdvREIncyBpbXBsZW1lbnRhdGlvbiwgd2hlcmUgYSBkb2N1bWVudCB3aWxsXG4gICAgICAvLyBhY3R1YWxseSBzaG93IHVwICptdWx0aXBsZSB0aW1lcyogaW4gdGhlIHJlc3VsdCBzZXQsIHdpdGggb25lIGVudHJ5IGZvclxuICAgICAgLy8gZWFjaCB3aXRoaW4tJG1heERpc3RhbmNlIGJyYW5jaGluZyBwb2ludC5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IHtyZXN1bHQ6IGZhbHNlfTtcbiAgICAgIGV4cGFuZEFycmF5c0luQnJhbmNoZXMoYnJhbmNoZWRWYWx1ZXMpLmV2ZXJ5KGJyYW5jaCA9PiB7XG4gICAgICAgIC8vIGlmIG9wZXJhdGlvbiBpcyBhbiB1cGRhdGUsIGRvbid0IHNraXAgYnJhbmNoZXMsIGp1c3QgcmV0dXJuIHRoZSBmaXJzdFxuICAgICAgICAvLyBvbmUgKCMzNTk5KVxuICAgICAgICBsZXQgY3VyRGlzdGFuY2U7XG4gICAgICAgIGlmICghbWF0Y2hlci5faXNVcGRhdGUpIHtcbiAgICAgICAgICBpZiAoISh0eXBlb2YgYnJhbmNoLnZhbHVlID09PSAnb2JqZWN0JykpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGN1ckRpc3RhbmNlID0gZGlzdGFuY2UoYnJhbmNoLnZhbHVlKTtcblxuICAgICAgICAgIC8vIFNraXAgYnJhbmNoZXMgdGhhdCBhcmVuJ3QgcmVhbCBwb2ludHMgb3IgYXJlIHRvbyBmYXIgYXdheS5cbiAgICAgICAgICBpZiAoY3VyRGlzdGFuY2UgPT09IG51bGwgfHwgY3VyRGlzdGFuY2UgPiBtYXhEaXN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gU2tpcCBhbnl0aGluZyB0aGF0J3MgYSB0aWUuXG4gICAgICAgICAgaWYgKHJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkICYmIHJlc3VsdC5kaXN0YW5jZSA8PSBjdXJEaXN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0LnJlc3VsdCA9IHRydWU7XG4gICAgICAgIHJlc3VsdC5kaXN0YW5jZSA9IGN1ckRpc3RhbmNlO1xuXG4gICAgICAgIGlmIChicmFuY2guYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgICAgcmVzdWx0LmFycmF5SW5kaWNlcyA9IGJyYW5jaC5hcnJheUluZGljZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHJlc3VsdC5hcnJheUluZGljZXM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gIW1hdGNoZXIuX2lzVXBkYXRlO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfSxcbn07XG5cbi8vIE5COiBXZSBhcmUgY2hlYXRpbmcgYW5kIHVzaW5nIHRoaXMgZnVuY3Rpb24gdG8gaW1wbGVtZW50ICdBTkQnIGZvciBib3RoXG4vLyAnZG9jdW1lbnQgbWF0Y2hlcnMnIGFuZCAnYnJhbmNoZWQgbWF0Y2hlcnMnLiBUaGV5IGJvdGggcmV0dXJuIHJlc3VsdCBvYmplY3RzXG4vLyBidXQgdGhlIGFyZ3VtZW50IGlzIGRpZmZlcmVudDogZm9yIHRoZSBmb3JtZXIgaXQncyBhIHdob2xlIGRvYywgd2hlcmVhcyBmb3Jcbi8vIHRoZSBsYXR0ZXIgaXQncyBhbiBhcnJheSBvZiAnYnJhbmNoZWQgdmFsdWVzJy5cbmZ1bmN0aW9uIGFuZFNvbWVNYXRjaGVycyhzdWJNYXRjaGVycykge1xuICBpZiAoc3ViTWF0Y2hlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGV2ZXJ5dGhpbmdNYXRjaGVyO1xuICB9XG5cbiAgaWYgKHN1Yk1hdGNoZXJzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBzdWJNYXRjaGVyc1swXTtcbiAgfVxuXG4gIHJldHVybiBkb2NPckJyYW5jaGVzID0+IHtcbiAgICBjb25zdCBtYXRjaCA9IHt9O1xuICAgIG1hdGNoLnJlc3VsdCA9IHN1Yk1hdGNoZXJzLmV2ZXJ5KGZuID0+IHtcbiAgICAgIGNvbnN0IHN1YlJlc3VsdCA9IGZuKGRvY09yQnJhbmNoZXMpO1xuXG4gICAgICAvLyBDb3B5IGEgJ2Rpc3RhbmNlJyBudW1iZXIgb3V0IG9mIHRoZSBmaXJzdCBzdWItbWF0Y2hlciB0aGF0IGhhc1xuICAgICAgLy8gb25lLiBZZXMsIHRoaXMgbWVhbnMgdGhhdCBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgJG5lYXIgZmllbGRzIGluIGFcbiAgICAgIC8vIHF1ZXJ5LCBzb21ldGhpbmcgYXJiaXRyYXJ5IGhhcHBlbnM7IHRoaXMgYXBwZWFycyB0byBiZSBjb25zaXN0ZW50IHdpdGhcbiAgICAgIC8vIE1vbmdvLlxuICAgICAgaWYgKHN1YlJlc3VsdC5yZXN1bHQgJiZcbiAgICAgICAgICBzdWJSZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgIG1hdGNoLmRpc3RhbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbWF0Y2guZGlzdGFuY2UgPSBzdWJSZXN1bHQuZGlzdGFuY2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFNpbWlsYXJseSwgcHJvcGFnYXRlIGFycmF5SW5kaWNlcyBmcm9tIHN1Yi1tYXRjaGVycy4uLiBidXQgdG8gbWF0Y2hcbiAgICAgIC8vIE1vbmdvREIgYmVoYXZpb3IsIHRoaXMgdGltZSB0aGUgKmxhc3QqIHN1Yi1tYXRjaGVyIHdpdGggYXJyYXlJbmRpY2VzXG4gICAgICAvLyB3aW5zLlxuICAgICAgaWYgKHN1YlJlc3VsdC5yZXN1bHQgJiYgc3ViUmVzdWx0LmFycmF5SW5kaWNlcykge1xuICAgICAgICBtYXRjaC5hcnJheUluZGljZXMgPSBzdWJSZXN1bHQuYXJyYXlJbmRpY2VzO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc3ViUmVzdWx0LnJlc3VsdDtcbiAgICB9KTtcblxuICAgIC8vIElmIHdlIGRpZG4ndCBhY3R1YWxseSBtYXRjaCwgZm9yZ2V0IGFueSBleHRyYSBtZXRhZGF0YSB3ZSBjYW1lIHVwIHdpdGguXG4gICAgaWYgKCFtYXRjaC5yZXN1bHQpIHtcbiAgICAgIGRlbGV0ZSBtYXRjaC5kaXN0YW5jZTtcbiAgICAgIGRlbGV0ZSBtYXRjaC5hcnJheUluZGljZXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoO1xuICB9O1xufVxuXG5jb25zdCBhbmREb2N1bWVudE1hdGNoZXJzID0gYW5kU29tZU1hdGNoZXJzO1xuY29uc3QgYW5kQnJhbmNoZWRNYXRjaGVycyA9IGFuZFNvbWVNYXRjaGVycztcblxuZnVuY3Rpb24gY29tcGlsZUFycmF5T2ZEb2N1bWVudFNlbGVjdG9ycyhzZWxlY3RvcnMsIG1hdGNoZXIsIGluRWxlbU1hdGNoKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShzZWxlY3RvcnMpIHx8IHNlbGVjdG9ycy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBFcnJvcignJGFuZC8kb3IvJG5vciBtdXN0IGJlIG5vbmVtcHR5IGFycmF5Jyk7XG4gIH1cblxuICByZXR1cm4gc2VsZWN0b3JzLm1hcChzdWJTZWxlY3RvciA9PiB7XG4gICAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3Qoc3ViU2VsZWN0b3IpKSB7XG4gICAgICB0aHJvdyBFcnJvcignJG9yLyRhbmQvJG5vciBlbnRyaWVzIG5lZWQgdG8gYmUgZnVsbCBvYmplY3RzJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCB7aW5FbGVtTWF0Y2h9KTtcbiAgfSk7XG59XG5cbi8vIFRha2VzIGluIGEgc2VsZWN0b3IgdGhhdCBjb3VsZCBtYXRjaCBhIGZ1bGwgZG9jdW1lbnQgKGVnLCB0aGUgb3JpZ2luYWxcbi8vIHNlbGVjdG9yKS4gUmV0dXJucyBhIGZ1bmN0aW9uIG1hcHBpbmcgZG9jdW1lbnQtPnJlc3VsdCBvYmplY3QuXG4vL1xuLy8gbWF0Y2hlciBpcyB0aGUgTWF0Y2hlciBvYmplY3Qgd2UgYXJlIGNvbXBpbGluZy5cbi8vXG4vLyBJZiB0aGlzIGlzIHRoZSByb290IGRvY3VtZW50IHNlbGVjdG9yIChpZSwgbm90IHdyYXBwZWQgaW4gJGFuZCBvciB0aGUgbGlrZSksXG4vLyB0aGVuIGlzUm9vdCBpcyB0cnVlLiAoVGhpcyBpcyB1c2VkIGJ5ICRuZWFyLilcbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRG9jdW1lbnRTZWxlY3Rvcihkb2NTZWxlY3RvciwgbWF0Y2hlciwgb3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IGRvY01hdGNoZXJzID0gT2JqZWN0LmtleXMoZG9jU2VsZWN0b3IpLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHN1YlNlbGVjdG9yID0gZG9jU2VsZWN0b3Jba2V5XTtcblxuICAgIGlmIChrZXkuc3Vic3RyKDAsIDEpID09PSAnJCcpIHtcbiAgICAgIC8vIE91dGVyIG9wZXJhdG9ycyBhcmUgZWl0aGVyIGxvZ2ljYWwgb3BlcmF0b3JzICh0aGV5IHJlY3Vyc2UgYmFjayBpbnRvXG4gICAgICAvLyB0aGlzIGZ1bmN0aW9uKSwgb3IgJHdoZXJlLlxuICAgICAgaWYgKCFoYXNPd24uY2FsbChMT0dJQ0FMX09QRVJBVE9SUywga2V5KSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBsb2dpY2FsIG9wZXJhdG9yOiAke2tleX1gKTtcbiAgICAgIH1cblxuICAgICAgbWF0Y2hlci5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBMT0dJQ0FMX09QRVJBVE9SU1trZXldKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBvcHRpb25zLmluRWxlbU1hdGNoKTtcbiAgICB9XG5cbiAgICAvLyBSZWNvcmQgdGhpcyBwYXRoLCBidXQgb25seSBpZiB3ZSBhcmVuJ3QgaW4gYW4gZWxlbU1hdGNoZXIsIHNpbmNlIGluIGFuXG4gICAgLy8gZWxlbU1hdGNoIHRoaXMgaXMgYSBwYXRoIGluc2lkZSBhbiBvYmplY3QgaW4gYW4gYXJyYXksIG5vdCBpbiB0aGUgZG9jXG4gICAgLy8gcm9vdC5cbiAgICBpZiAoIW9wdGlvbnMuaW5FbGVtTWF0Y2gpIHtcbiAgICAgIG1hdGNoZXIuX3JlY29yZFBhdGhVc2VkKGtleSk7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgYWRkIGEgbWF0Y2hlciBpZiBzdWJTZWxlY3RvciBpcyBhIGZ1bmN0aW9uIC0tIHRoaXMgaXMgdG8gbWF0Y2hcbiAgICAvLyB0aGUgYmVoYXZpb3Igb2YgTWV0ZW9yIG9uIHRoZSBzZXJ2ZXIgKGluaGVyaXRlZCBmcm9tIHRoZSBub2RlIG1vbmdvZGJcbiAgICAvLyBkcml2ZXIpLCB3aGljaCBpcyB0byBpZ25vcmUgYW55IHBhcnQgb2YgYSBzZWxlY3RvciB3aGljaCBpcyBhIGZ1bmN0aW9uLlxuICAgIGlmICh0eXBlb2Ygc3ViU2VsZWN0b3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbG9va1VwQnlJbmRleCA9IG1ha2VMb29rdXBGdW5jdGlvbihrZXkpO1xuICAgIGNvbnN0IHZhbHVlTWF0Y2hlciA9IGNvbXBpbGVWYWx1ZVNlbGVjdG9yKFxuICAgICAgc3ViU2VsZWN0b3IsXG4gICAgICBtYXRjaGVyLFxuICAgICAgb3B0aW9ucy5pc1Jvb3RcbiAgICApO1xuXG4gICAgcmV0dXJuIGRvYyA9PiB2YWx1ZU1hdGNoZXIobG9va1VwQnlJbmRleChkb2MpKTtcbiAgfSkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIHJldHVybiBhbmREb2N1bWVudE1hdGNoZXJzKGRvY01hdGNoZXJzKTtcbn1cblxuLy8gVGFrZXMgaW4gYSBzZWxlY3RvciB0aGF0IGNvdWxkIG1hdGNoIGEga2V5LWluZGV4ZWQgdmFsdWUgaW4gYSBkb2N1bWVudDsgZWcsXG4vLyB7JGd0OiA1LCAkbHQ6IDl9LCBvciBhIHJlZ3VsYXIgZXhwcmVzc2lvbiwgb3IgYW55IG5vbi1leHByZXNzaW9uIG9iamVjdCAodG9cbi8vIGluZGljYXRlIGVxdWFsaXR5KS4gIFJldHVybnMgYSBicmFuY2hlZCBtYXRjaGVyOiBhIGZ1bmN0aW9uIG1hcHBpbmdcbi8vIFticmFuY2hlZCB2YWx1ZV0tPnJlc3VsdCBvYmplY3QuXG5mdW5jdGlvbiBjb21waWxlVmFsdWVTZWxlY3Rvcih2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpIHtcbiAgaWYgKHZhbHVlU2VsZWN0b3IgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICBtYXRjaGVyLl9pc1NpbXBsZSA9IGZhbHNlO1xuICAgIHJldHVybiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgIHJlZ2V4cEVsZW1lbnRNYXRjaGVyKHZhbHVlU2VsZWN0b3IpXG4gICAgKTtcbiAgfVxuXG4gIGlmIChpc09wZXJhdG9yT2JqZWN0KHZhbHVlU2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIG9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyKHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIsIGlzUm9vdCk7XG4gIH1cblxuICByZXR1cm4gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgZXF1YWxpdHlFbGVtZW50TWF0Y2hlcih2YWx1ZVNlbGVjdG9yKVxuICApO1xufVxuXG4vLyBHaXZlbiBhbiBlbGVtZW50IG1hdGNoZXIgKHdoaWNoIGV2YWx1YXRlcyBhIHNpbmdsZSB2YWx1ZSksIHJldHVybnMgYSBicmFuY2hlZFxuLy8gdmFsdWUgKHdoaWNoIGV2YWx1YXRlcyB0aGUgZWxlbWVudCBtYXRjaGVyIG9uIGFsbCB0aGUgYnJhbmNoZXMgYW5kIHJldHVybnMgYVxuLy8gbW9yZSBzdHJ1Y3R1cmVkIHJldHVybiB2YWx1ZSBwb3NzaWJseSBpbmNsdWRpbmcgYXJyYXlJbmRpY2VzKS5cbmZ1bmN0aW9uIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKGVsZW1lbnRNYXRjaGVyLCBvcHRpb25zID0ge30pIHtcbiAgcmV0dXJuIGJyYW5jaGVzID0+IHtcbiAgICBjb25zdCBleHBhbmRlZCA9IG9wdGlvbnMuZG9udEV4cGFuZExlYWZBcnJheXNcbiAgICAgID8gYnJhbmNoZXNcbiAgICAgIDogZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyhicmFuY2hlcywgb3B0aW9ucy5kb250SW5jbHVkZUxlYWZBcnJheXMpO1xuXG4gICAgY29uc3QgbWF0Y2ggPSB7fTtcbiAgICBtYXRjaC5yZXN1bHQgPSBleHBhbmRlZC5zb21lKGVsZW1lbnQgPT4ge1xuICAgICAgbGV0IG1hdGNoZWQgPSBlbGVtZW50TWF0Y2hlcihlbGVtZW50LnZhbHVlKTtcblxuICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciAkZWxlbU1hdGNoOiBpdCBtZWFucyBcInRydWUsIGFuZCB1c2UgdGhpcyBhcyBhbiBhcnJheVxuICAgICAgLy8gaW5kZXggaWYgSSBkaWRuJ3QgYWxyZWFkeSBoYXZlIG9uZVwiLlxuICAgICAgaWYgKHR5cGVvZiBtYXRjaGVkID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBYWFggVGhpcyBjb2RlIGRhdGVzIGZyb20gd2hlbiB3ZSBvbmx5IHN0b3JlZCBhIHNpbmdsZSBhcnJheSBpbmRleFxuICAgICAgICAvLyAoZm9yIHRoZSBvdXRlcm1vc3QgYXJyYXkpLiBTaG91bGQgd2UgYmUgYWxzbyBpbmNsdWRpbmcgZGVlcGVyIGFycmF5XG4gICAgICAgIC8vIGluZGljZXMgZnJvbSB0aGUgJGVsZW1NYXRjaCBtYXRjaD9cbiAgICAgICAgaWYgKCFlbGVtZW50LmFycmF5SW5kaWNlcykge1xuICAgICAgICAgIGVsZW1lbnQuYXJyYXlJbmRpY2VzID0gW21hdGNoZWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0Y2hlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHNvbWUgZWxlbWVudCBtYXRjaGVkLCBhbmQgaXQncyB0YWdnZWQgd2l0aCBhcnJheSBpbmRpY2VzLCBpbmNsdWRlXG4gICAgICAvLyB0aG9zZSBpbmRpY2VzIGluIG91ciByZXN1bHQgb2JqZWN0LlxuICAgICAgaWYgKG1hdGNoZWQgJiYgZWxlbWVudC5hcnJheUluZGljZXMpIHtcbiAgICAgICAgbWF0Y2guYXJyYXlJbmRpY2VzID0gZWxlbWVudC5hcnJheUluZGljZXM7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtYXRjaGVkO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1hdGNoO1xuICB9O1xufVxuXG4vLyBIZWxwZXJzIGZvciAkbmVhci5cbmZ1bmN0aW9uIGRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzKGEsIGIpIHtcbiAgY29uc3QgcG9pbnRBID0gcG9pbnRUb0FycmF5KGEpO1xuICBjb25zdCBwb2ludEIgPSBwb2ludFRvQXJyYXkoYik7XG5cbiAgcmV0dXJuIE1hdGguaHlwb3QocG9pbnRBWzBdIC0gcG9pbnRCWzBdLCBwb2ludEFbMV0gLSBwb2ludEJbMV0pO1xufVxuXG4vLyBUYWtlcyBzb21ldGhpbmcgdGhhdCBpcyBub3QgYW4gb3BlcmF0b3Igb2JqZWN0IGFuZCByZXR1cm5zIGFuIGVsZW1lbnQgbWF0Y2hlclxuLy8gZm9yIGVxdWFsaXR5IHdpdGggdGhhdCB0aGluZy5cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbGl0eUVsZW1lbnRNYXRjaGVyKGVsZW1lbnRTZWxlY3Rvcikge1xuICBpZiAoaXNPcGVyYXRvck9iamVjdChlbGVtZW50U2VsZWN0b3IpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0NhblxcJ3QgY3JlYXRlIGVxdWFsaXR5VmFsdWVTZWxlY3RvciBmb3Igb3BlcmF0b3Igb2JqZWN0Jyk7XG4gIH1cblxuICAvLyBTcGVjaWFsLWNhc2U6IG51bGwgYW5kIHVuZGVmaW5lZCBhcmUgZXF1YWwgKGlmIHlvdSBnb3QgdW5kZWZpbmVkIGluIHRoZXJlXG4gIC8vIHNvbWV3aGVyZSwgb3IgaWYgeW91IGdvdCBpdCBkdWUgdG8gc29tZSBicmFuY2ggYmVpbmcgbm9uLWV4aXN0ZW50IGluIHRoZVxuICAvLyB3ZWlyZCBzcGVjaWFsIGNhc2UpLCBldmVuIHRob3VnaCB0aGV5IGFyZW4ndCB3aXRoIEVKU09OLmVxdWFscy5cbiAgLy8gdW5kZWZpbmVkIG9yIG51bGxcbiAgaWYgKGVsZW1lbnRTZWxlY3RvciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHZhbHVlID0+IHZhbHVlID09IG51bGw7XG4gIH1cblxuICByZXR1cm4gdmFsdWUgPT4gTG9jYWxDb2xsZWN0aW9uLl9mLl9lcXVhbChlbGVtZW50U2VsZWN0b3IsIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZXZlcnl0aGluZ01hdGNoZXIoZG9jT3JCcmFuY2hlZFZhbHVlcykge1xuICByZXR1cm4ge3Jlc3VsdDogdHJ1ZX07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHBhbmRBcnJheXNJbkJyYW5jaGVzKGJyYW5jaGVzLCBza2lwVGhlQXJyYXlzKSB7XG4gIGNvbnN0IGJyYW5jaGVzT3V0ID0gW107XG5cbiAgYnJhbmNoZXMuZm9yRWFjaChicmFuY2ggPT4ge1xuICAgIGNvbnN0IHRoaXNJc0FycmF5ID0gQXJyYXkuaXNBcnJheShicmFuY2gudmFsdWUpO1xuXG4gICAgLy8gV2UgaW5jbHVkZSB0aGUgYnJhbmNoIGl0c2VsZiwgKlVOTEVTUyogd2UgaXQncyBhbiBhcnJheSB0aGF0IHdlJ3JlIGdvaW5nXG4gICAgLy8gdG8gaXRlcmF0ZSBhbmQgd2UncmUgdG9sZCB0byBza2lwIGFycmF5cy4gIChUaGF0J3MgcmlnaHQsIHdlIGluY2x1ZGUgc29tZVxuICAgIC8vIGFycmF5cyBldmVuIHNraXBUaGVBcnJheXMgaXMgdHJ1ZTogdGhlc2UgYXJlIGFycmF5cyB0aGF0IHdlcmUgZm91bmQgdmlhXG4gICAgLy8gZXhwbGljaXQgbnVtZXJpY2FsIGluZGljZXMuKVxuICAgIGlmICghKHNraXBUaGVBcnJheXMgJiYgdGhpc0lzQXJyYXkgJiYgIWJyYW5jaC5kb250SXRlcmF0ZSkpIHtcbiAgICAgIGJyYW5jaGVzT3V0LnB1c2goe2FycmF5SW5kaWNlczogYnJhbmNoLmFycmF5SW5kaWNlcywgdmFsdWU6IGJyYW5jaC52YWx1ZX0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzSXNBcnJheSAmJiAhYnJhbmNoLmRvbnRJdGVyYXRlKSB7XG4gICAgICBicmFuY2gudmFsdWUuZm9yRWFjaCgodmFsdWUsIGkpID0+IHtcbiAgICAgICAgYnJhbmNoZXNPdXQucHVzaCh7XG4gICAgICAgICAgYXJyYXlJbmRpY2VzOiAoYnJhbmNoLmFycmF5SW5kaWNlcyB8fCBbXSkuY29uY2F0KGkpLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gYnJhbmNoZXNPdXQ7XG59XG5cbi8vIEhlbHBlcnMgZm9yICRiaXRzQWxsU2V0LyRiaXRzQW55U2V0LyRiaXRzQWxsQ2xlYXIvJGJpdHNBbnlDbGVhci5cbmZ1bmN0aW9uIGdldE9wZXJhbmRCaXRtYXNrKG9wZXJhbmQsIHNlbGVjdG9yKSB7XG4gIC8vIG51bWVyaWMgYml0bWFza1xuICAvLyBZb3UgY2FuIHByb3ZpZGUgYSBudW1lcmljIGJpdG1hc2sgdG8gYmUgbWF0Y2hlZCBhZ2FpbnN0IHRoZSBvcGVyYW5kIGZpZWxkLlxuICAvLyBJdCBtdXN0IGJlIHJlcHJlc2VudGFibGUgYXMgYSBub24tbmVnYXRpdmUgMzItYml0IHNpZ25lZCBpbnRlZ2VyLlxuICAvLyBPdGhlcndpc2UsICRiaXRzQWxsU2V0IHdpbGwgcmV0dXJuIGFuIGVycm9yLlxuICBpZiAoTnVtYmVyLmlzSW50ZWdlcihvcGVyYW5kKSAmJiBvcGVyYW5kID49IDApIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkobmV3IEludDMyQXJyYXkoW29wZXJhbmRdKS5idWZmZXIpO1xuICB9XG5cbiAgLy8gYmluZGF0YSBiaXRtYXNrXG4gIC8vIFlvdSBjYW4gYWxzbyB1c2UgYW4gYXJiaXRyYXJpbHkgbGFyZ2UgQmluRGF0YSBpbnN0YW5jZSBhcyBhIGJpdG1hc2suXG4gIGlmIChFSlNPTi5pc0JpbmFyeShvcGVyYW5kKSkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShvcGVyYW5kLmJ1ZmZlcik7XG4gIH1cblxuICAvLyBwb3NpdGlvbiBsaXN0XG4gIC8vIElmIHF1ZXJ5aW5nIGEgbGlzdCBvZiBiaXQgcG9zaXRpb25zLCBlYWNoIDxwb3NpdGlvbj4gbXVzdCBiZSBhIG5vbi1uZWdhdGl2ZVxuICAvLyBpbnRlZ2VyLiBCaXQgcG9zaXRpb25zIHN0YXJ0IGF0IDAgZnJvbSB0aGUgbGVhc3Qgc2lnbmlmaWNhbnQgYml0LlxuICBpZiAoQXJyYXkuaXNBcnJheShvcGVyYW5kKSAmJlxuICAgICAgb3BlcmFuZC5ldmVyeSh4ID0+IE51bWJlci5pc0ludGVnZXIoeCkgJiYgeCA+PSAwKSkge1xuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcigoTWF0aC5tYXgoLi4ub3BlcmFuZCkgPj4gMykgKyAxKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcblxuICAgIG9wZXJhbmQuZm9yRWFjaCh4ID0+IHtcbiAgICAgIHZpZXdbeCA+PiAzXSB8PSAxIDw8ICh4ICYgMHg3KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB2aWV3O1xuICB9XG5cbiAgLy8gYmFkIG9wZXJhbmRcbiAgdGhyb3cgRXJyb3IoXG4gICAgYG9wZXJhbmQgdG8gJHtzZWxlY3Rvcn0gbXVzdCBiZSBhIG51bWVyaWMgYml0bWFzayAocmVwcmVzZW50YWJsZSBhcyBhIGAgK1xuICAgICdub24tbmVnYXRpdmUgMzItYml0IHNpZ25lZCBpbnRlZ2VyKSwgYSBiaW5kYXRhIGJpdG1hc2sgb3IgYW4gYXJyYXkgd2l0aCAnICtcbiAgICAnYml0IHBvc2l0aW9ucyAobm9uLW5lZ2F0aXZlIGludGVnZXJzKSdcbiAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBsZW5ndGgpIHtcbiAgLy8gVGhlIGZpZWxkIHZhbHVlIG11c3QgYmUgZWl0aGVyIG51bWVyaWNhbCBvciBhIEJpbkRhdGEgaW5zdGFuY2UuIE90aGVyd2lzZSxcbiAgLy8gJGJpdHMuLi4gd2lsbCBub3QgbWF0Y2ggdGhlIGN1cnJlbnQgZG9jdW1lbnQuXG5cbiAgLy8gbnVtZXJpY2FsXG4gIGlmIChOdW1iZXIuaXNTYWZlSW50ZWdlcih2YWx1ZSkpIHtcbiAgICAvLyAkYml0cy4uLiB3aWxsIG5vdCBtYXRjaCBudW1lcmljYWwgdmFsdWVzIHRoYXQgY2Fubm90IGJlIHJlcHJlc2VudGVkIGFzIGFcbiAgICAvLyBzaWduZWQgNjQtYml0IGludGVnZXIuIFRoaXMgY2FuIGJlIHRoZSBjYXNlIGlmIGEgdmFsdWUgaXMgZWl0aGVyIHRvb1xuICAgIC8vIGxhcmdlIG9yIHNtYWxsIHRvIGZpdCBpbiBhIHNpZ25lZCA2NC1iaXQgaW50ZWdlciwgb3IgaWYgaXQgaGFzIGFcbiAgICAvLyBmcmFjdGlvbmFsIGNvbXBvbmVudC5cbiAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoXG4gICAgICBNYXRoLm1heChsZW5ndGgsIDIgKiBVaW50MzJBcnJheS5CWVRFU19QRVJfRUxFTUVOVClcbiAgICApO1xuXG4gICAgbGV0IHZpZXcgPSBuZXcgVWludDMyQXJyYXkoYnVmZmVyLCAwLCAyKTtcbiAgICB2aWV3WzBdID0gdmFsdWUgJSAoKDEgPDwgMTYpICogKDEgPDwgMTYpKSB8IDA7XG4gICAgdmlld1sxXSA9IHZhbHVlIC8gKCgxIDw8IDE2KSAqICgxIDw8IDE2KSkgfCAwO1xuXG4gICAgLy8gc2lnbiBleHRlbnNpb25cbiAgICBpZiAodmFsdWUgPCAwKSB7XG4gICAgICB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLCAyKTtcbiAgICAgIHZpZXcuZm9yRWFjaCgoYnl0ZSwgaSkgPT4ge1xuICAgICAgICB2aWV3W2ldID0gMHhmZjtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICB9XG5cbiAgLy8gYmluZGF0YVxuICBpZiAoRUpTT04uaXNCaW5hcnkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHZhbHVlLmJ1ZmZlcik7XG4gIH1cblxuICAvLyBubyBtYXRjaFxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIEFjdHVhbGx5IGluc2VydHMgYSBrZXkgdmFsdWUgaW50byB0aGUgc2VsZWN0b3IgZG9jdW1lbnRcbi8vIEhvd2V2ZXIsIHRoaXMgY2hlY2tzIHRoZXJlIGlzIG5vIGFtYmlndWl0eSBpbiBzZXR0aW5nXG4vLyB0aGUgdmFsdWUgZm9yIHRoZSBnaXZlbiBrZXksIHRocm93cyBvdGhlcndpc2VcbmZ1bmN0aW9uIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwga2V5LCB2YWx1ZSkge1xuICBPYmplY3Qua2V5cyhkb2N1bWVudCkuZm9yRWFjaChleGlzdGluZ0tleSA9PiB7XG4gICAgaWYgKFxuICAgICAgKGV4aXN0aW5nS2V5Lmxlbmd0aCA+IGtleS5sZW5ndGggJiYgZXhpc3RpbmdLZXkuaW5kZXhPZihgJHtrZXl9LmApID09PSAwKSB8fFxuICAgICAgKGtleS5sZW5ndGggPiBleGlzdGluZ0tleS5sZW5ndGggJiYga2V5LmluZGV4T2YoYCR7ZXhpc3RpbmdLZXl9LmApID09PSAwKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgY2Fubm90IGluZmVyIHF1ZXJ5IGZpZWxkcyB0byBzZXQsIGJvdGggcGF0aHMgJyR7ZXhpc3RpbmdLZXl9JyBhbmQgYCArXG4gICAgICAgIGAnJHtrZXl9JyBhcmUgbWF0Y2hlZGBcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmIChleGlzdGluZ0tleSA9PT0ga2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBjYW5ub3QgaW5mZXIgcXVlcnkgZmllbGRzIHRvIHNldCwgcGF0aCAnJHtrZXl9JyBpcyBtYXRjaGVkIHR3aWNlYFxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIGRvY3VtZW50W2tleV0gPSB2YWx1ZTtcbn1cblxuLy8gUmV0dXJucyBhIGJyYW5jaGVkIG1hdGNoZXIgdGhhdCBtYXRjaGVzIGlmZiB0aGUgZ2l2ZW4gbWF0Y2hlciBkb2VzIG5vdC5cbi8vIE5vdGUgdGhhdCB0aGlzIGltcGxpY2l0bHkgXCJkZU1vcmdhbml6ZXNcIiB0aGUgd3JhcHBlZCBmdW5jdGlvbi4gIGllLCBpdFxuLy8gbWVhbnMgdGhhdCBBTEwgYnJhbmNoIHZhbHVlcyBuZWVkIHRvIGZhaWwgdG8gbWF0Y2ggaW5uZXJCcmFuY2hlZE1hdGNoZXIuXG5mdW5jdGlvbiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoYnJhbmNoZWRNYXRjaGVyKSB7XG4gIHJldHVybiBicmFuY2hWYWx1ZXMgPT4ge1xuICAgIC8vIFdlIGV4cGxpY2l0bHkgY2hvb3NlIHRvIHN0cmlwIGFycmF5SW5kaWNlcyBoZXJlOiBpdCBkb2Vzbid0IG1ha2Ugc2Vuc2UgdG9cbiAgICAvLyBzYXkgXCJ1cGRhdGUgdGhlIGFycmF5IGVsZW1lbnQgdGhhdCBkb2VzIG5vdCBtYXRjaCBzb21ldGhpbmdcIiwgYXQgbGVhc3RcbiAgICAvLyBpbiBtb25nby1sYW5kLlxuICAgIHJldHVybiB7cmVzdWx0OiAhYnJhbmNoZWRNYXRjaGVyKGJyYW5jaFZhbHVlcykucmVzdWx0fTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5kZXhhYmxlKG9iaikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShvYmopIHx8IExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChvYmopO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdW1lcmljS2V5KHMpIHtcbiAgcmV0dXJuIC9eWzAtOV0rJC8udGVzdChzKTtcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoaXMgaXMgYW4gb2JqZWN0IHdpdGggYXQgbGVhc3Qgb25lIGtleSBhbmQgYWxsIGtleXMgYmVnaW5cbi8vIHdpdGggJC4gIFVubGVzcyBpbmNvbnNpc3RlbnRPSyBpcyBzZXQsIHRocm93cyBpZiBzb21lIGtleXMgYmVnaW4gd2l0aCAkIGFuZFxuLy8gb3RoZXJzIGRvbid0LlxuZXhwb3J0IGZ1bmN0aW9uIGlzT3BlcmF0b3JPYmplY3QodmFsdWVTZWxlY3RvciwgaW5jb25zaXN0ZW50T0spIHtcbiAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QodmFsdWVTZWxlY3RvcikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBsZXQgdGhlc2VBcmVPcGVyYXRvcnMgPSB1bmRlZmluZWQ7XG4gIE9iamVjdC5rZXlzKHZhbHVlU2VsZWN0b3IpLmZvckVhY2goc2VsS2V5ID0+IHtcbiAgICBjb25zdCB0aGlzSXNPcGVyYXRvciA9IHNlbEtleS5zdWJzdHIoMCwgMSkgPT09ICckJyB8fCBzZWxLZXkgPT09ICdkaWZmJztcblxuICAgIGlmICh0aGVzZUFyZU9wZXJhdG9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGVzZUFyZU9wZXJhdG9ycyA9IHRoaXNJc09wZXJhdG9yO1xuICAgIH0gZWxzZSBpZiAodGhlc2VBcmVPcGVyYXRvcnMgIT09IHRoaXNJc09wZXJhdG9yKSB7XG4gICAgICBpZiAoIWluY29uc2lzdGVudE9LKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgSW5jb25zaXN0ZW50IG9wZXJhdG9yOiAke0pTT04uc3RyaW5naWZ5KHZhbHVlU2VsZWN0b3IpfWBcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgdGhlc2VBcmVPcGVyYXRvcnMgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiAhIXRoZXNlQXJlT3BlcmF0b3JzOyAvLyB7fSBoYXMgbm8gb3BlcmF0b3JzXG59XG5cbi8vIEhlbHBlciBmb3IgJGx0LyRndC8kbHRlLyRndGUuXG5mdW5jdGlvbiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZUNvbXBhcmF0b3IpIHtcbiAgcmV0dXJuIHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIC8vIEFycmF5cyBuZXZlciBjb21wYXJlIGZhbHNlIHdpdGggbm9uLWFycmF5cyBmb3IgYW55IGluZXF1YWxpdHkuXG4gICAgICAvLyBYWFggVGhpcyB3YXMgYmVoYXZpb3Igd2Ugb2JzZXJ2ZWQgaW4gcHJlLXJlbGVhc2UgTW9uZ29EQiAyLjUsIGJ1dFxuICAgICAgLy8gICAgIGl0IHNlZW1zIHRvIGhhdmUgYmVlbiByZXZlcnRlZC5cbiAgICAgIC8vICAgICBTZWUgaHR0cHM6Ly9qaXJhLm1vbmdvZGIub3JnL2Jyb3dzZS9TRVJWRVItMTE0NDRcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gU3BlY2lhbCBjYXNlOiBjb25zaWRlciB1bmRlZmluZWQgYW5kIG51bGwgdGhlIHNhbWUgKHNvIHRydWUgd2l0aFxuICAgICAgLy8gJGd0ZS8kbHRlKS5cbiAgICAgIGlmIChvcGVyYW5kID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb3BlcmFuZCA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9wZXJhbmRUeXBlID0gTG9jYWxDb2xsZWN0aW9uLl9mLl90eXBlKG9wZXJhbmQpO1xuXG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbXBhcmlzb25zIGFyZSBuZXZlciB0cnVlIGFtb25nIHRoaW5ncyBvZiBkaWZmZXJlbnQgdHlwZSAoZXhjZXB0XG4gICAgICAgIC8vIG51bGwgdnMgdW5kZWZpbmVkKS5cbiAgICAgICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZSh2YWx1ZSkgIT09IG9wZXJhbmRUeXBlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNtcFZhbHVlQ29tcGFyYXRvcihMb2NhbENvbGxlY3Rpb24uX2YuX2NtcCh2YWx1ZSwgb3BlcmFuZCkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9O1xufVxuXG4vLyBtYWtlTG9va3VwRnVuY3Rpb24oa2V5KSByZXR1cm5zIGEgbG9va3VwIGZ1bmN0aW9uLlxuLy9cbi8vIEEgbG9va3VwIGZ1bmN0aW9uIHRha2VzIGluIGEgZG9jdW1lbnQgYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgbWF0Y2hpbmdcbi8vIGJyYW5jaGVzLiAgSWYgbm8gYXJyYXlzIGFyZSBmb3VuZCB3aGlsZSBsb29raW5nIHVwIHRoZSBrZXksIHRoaXMgYXJyYXkgd2lsbFxuLy8gaGF2ZSBleGFjdGx5IG9uZSBicmFuY2hlcyAocG9zc2libHkgJ3VuZGVmaW5lZCcsIGlmIHNvbWUgc2VnbWVudCBvZiB0aGUga2V5XG4vLyB3YXMgbm90IGZvdW5kKS5cbi8vXG4vLyBJZiBhcnJheXMgYXJlIGZvdW5kIGluIHRoZSBtaWRkbGUsIHRoaXMgY2FuIGhhdmUgbW9yZSB0aGFuIG9uZSBlbGVtZW50LCBzaW5jZVxuLy8gd2UgJ2JyYW5jaCcuIFdoZW4gd2UgJ2JyYW5jaCcsIGlmIHRoZXJlIGFyZSBtb3JlIGtleSBzZWdtZW50cyB0byBsb29rIHVwLFxuLy8gdGhlbiB3ZSBvbmx5IHB1cnN1ZSBicmFuY2hlcyB0aGF0IGFyZSBwbGFpbiBvYmplY3RzIChub3QgYXJyYXlzIG9yIHNjYWxhcnMpLlxuLy8gVGhpcyBtZWFucyB3ZSBjYW4gYWN0dWFsbHkgZW5kIHVwIHdpdGggbm8gYnJhbmNoZXMhXG4vL1xuLy8gV2UgZG8gKk5PVCogYnJhbmNoIG9uIGFycmF5cyB0aGF0IGFyZSBmb3VuZCBhdCB0aGUgZW5kIChpZSwgYXQgdGhlIGxhc3Rcbi8vIGRvdHRlZCBtZW1iZXIgb2YgdGhlIGtleSkuIFdlIGp1c3QgcmV0dXJuIHRoYXQgYXJyYXk7IGlmIHlvdSB3YW50IHRvXG4vLyBlZmZlY3RpdmVseSAnYnJhbmNoJyBvdmVyIHRoZSBhcnJheSdzIHZhbHVlcywgcG9zdC1wcm9jZXNzIHRoZSBsb29rdXBcbi8vIGZ1bmN0aW9uIHdpdGggZXhwYW5kQXJyYXlzSW5CcmFuY2hlcy5cbi8vXG4vLyBFYWNoIGJyYW5jaCBpcyBhbiBvYmplY3Qgd2l0aCBrZXlzOlxuLy8gIC0gdmFsdWU6IHRoZSB2YWx1ZSBhdCB0aGUgYnJhbmNoXG4vLyAgLSBkb250SXRlcmF0ZTogYW4gb3B0aW9uYWwgYm9vbDsgaWYgdHJ1ZSwgaXQgbWVhbnMgdGhhdCAndmFsdWUnIGlzIGFuIGFycmF5XG4vLyAgICB0aGF0IGV4cGFuZEFycmF5c0luQnJhbmNoZXMgc2hvdWxkIE5PVCBleHBhbmQuIFRoaXMgc3BlY2lmaWNhbGx5IGhhcHBlbnNcbi8vICAgIHdoZW4gdGhlcmUgaXMgYSBudW1lcmljIGluZGV4IGluIHRoZSBrZXksIGFuZCBlbnN1cmVzIHRoZVxuLy8gICAgcGVyaGFwcy1zdXJwcmlzaW5nIE1vbmdvREIgYmVoYXZpb3Igd2hlcmUgeydhLjAnOiA1fSBkb2VzIE5PVFxuLy8gICAgbWF0Y2gge2E6IFtbNV1dfS5cbi8vICAtIGFycmF5SW5kaWNlczogaWYgYW55IGFycmF5IGluZGV4aW5nIHdhcyBkb25lIGR1cmluZyBsb29rdXAgKGVpdGhlciBkdWUgdG9cbi8vICAgIGV4cGxpY2l0IG51bWVyaWMgaW5kaWNlcyBvciBpbXBsaWNpdCBicmFuY2hpbmcpLCB0aGlzIHdpbGwgYmUgYW4gYXJyYXkgb2Zcbi8vICAgIHRoZSBhcnJheSBpbmRpY2VzIHVzZWQsIGZyb20gb3V0ZXJtb3N0IHRvIGlubmVybW9zdDsgaXQgaXMgZmFsc2V5IG9yXG4vLyAgICBhYnNlbnQgaWYgbm8gYXJyYXkgaW5kZXggaXMgdXNlZC4gSWYgYW4gZXhwbGljaXQgbnVtZXJpYyBpbmRleCBpcyB1c2VkLFxuLy8gICAgdGhlIGluZGV4IHdpbGwgYmUgZm9sbG93ZWQgaW4gYXJyYXlJbmRpY2VzIGJ5IHRoZSBzdHJpbmcgJ3gnLlxuLy9cbi8vICAgIE5vdGU6IGFycmF5SW5kaWNlcyBpcyB1c2VkIGZvciB0d28gcHVycG9zZXMuIEZpcnN0LCBpdCBpcyB1c2VkIHRvXG4vLyAgICBpbXBsZW1lbnQgdGhlICckJyBtb2RpZmllciBmZWF0dXJlLCB3aGljaCBvbmx5IGV2ZXIgbG9va3MgYXQgaXRzIGZpcnN0XG4vLyAgICBlbGVtZW50LlxuLy9cbi8vICAgIFNlY29uZCwgaXQgaXMgdXNlZCBmb3Igc29ydCBrZXkgZ2VuZXJhdGlvbiwgd2hpY2ggbmVlZHMgdG8gYmUgYWJsZSB0byB0ZWxsXG4vLyAgICB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIGRpZmZlcmVudCBwYXRocy4gTW9yZW92ZXIsIGl0IG5lZWRzIHRvXG4vLyAgICBkaWZmZXJlbnRpYXRlIGJldHdlZW4gZXhwbGljaXQgYW5kIGltcGxpY2l0IGJyYW5jaGluZywgd2hpY2ggaXMgd2h5XG4vLyAgICB0aGVyZSdzIHRoZSBzb21ld2hhdCBoYWNreSAneCcgZW50cnk6IHRoaXMgbWVhbnMgdGhhdCBleHBsaWNpdCBhbmRcbi8vICAgIGltcGxpY2l0IGFycmF5IGxvb2t1cHMgd2lsbCBoYXZlIGRpZmZlcmVudCBmdWxsIGFycmF5SW5kaWNlcyBwYXRocy4gKFRoYXRcbi8vICAgIGNvZGUgb25seSByZXF1aXJlcyB0aGF0IGRpZmZlcmVudCBwYXRocyBoYXZlIGRpZmZlcmVudCBhcnJheUluZGljZXM7IGl0XG4vLyAgICBkb2Vzbid0IGFjdHVhbGx5ICdwYXJzZScgYXJyYXlJbmRpY2VzLiBBcyBhbiBhbHRlcm5hdGl2ZSwgYXJyYXlJbmRpY2VzXG4vLyAgICBjb3VsZCBjb250YWluIG9iamVjdHMgd2l0aCBmbGFncyBsaWtlICdpbXBsaWNpdCcsIGJ1dCBJIHRoaW5rIHRoYXQgb25seVxuLy8gICAgbWFrZXMgdGhlIGNvZGUgc3Vycm91bmRpbmcgdGhlbSBtb3JlIGNvbXBsZXguKVxuLy9cbi8vICAgIChCeSB0aGUgd2F5LCB0aGlzIGZpZWxkIGVuZHMgdXAgZ2V0dGluZyBwYXNzZWQgYXJvdW5kIGEgbG90IHdpdGhvdXRcbi8vICAgIGNsb25pbmcsIHNvIG5ldmVyIG11dGF0ZSBhbnkgYXJyYXlJbmRpY2VzIGZpZWxkL3ZhciBpbiB0aGlzIHBhY2thZ2UhKVxuLy9cbi8vXG4vLyBBdCB0aGUgdG9wIGxldmVsLCB5b3UgbWF5IG9ubHkgcGFzcyBpbiBhIHBsYWluIG9iamVjdCBvciBhcnJheS5cbi8vXG4vLyBTZWUgdGhlIHRlc3QgJ21pbmltb25nbyAtIGxvb2t1cCcgZm9yIHNvbWUgZXhhbXBsZXMgb2Ygd2hhdCBsb29rdXAgZnVuY3Rpb25zXG4vLyByZXR1cm4uXG5leHBvcnQgZnVuY3Rpb24gbWFrZUxvb2t1cEZ1bmN0aW9uKGtleSwgb3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IHBhcnRzID0ga2V5LnNwbGl0KCcuJyk7XG4gIGNvbnN0IGZpcnN0UGFydCA9IHBhcnRzLmxlbmd0aCA/IHBhcnRzWzBdIDogJyc7XG4gIGNvbnN0IGxvb2t1cFJlc3QgPSAoXG4gICAgcGFydHMubGVuZ3RoID4gMSAmJlxuICAgIG1ha2VMb29rdXBGdW5jdGlvbihwYXJ0cy5zbGljZSgxKS5qb2luKCcuJyksIG9wdGlvbnMpXG4gICk7XG5cbiAgZnVuY3Rpb24gYnVpbGRSZXN1bHQoYXJyYXlJbmRpY2VzLCBkb250SXRlcmF0ZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXlJbmRpY2VzICYmIGFycmF5SW5kaWNlcy5sZW5ndGhcbiAgICAgID8gZG9udEl0ZXJhdGVcbiAgICAgICAgPyBbeyBhcnJheUluZGljZXMsIGRvbnRJdGVyYXRlLCB2YWx1ZSB9XVxuICAgICAgICA6IFt7IGFycmF5SW5kaWNlcywgdmFsdWUgfV1cbiAgICAgIDogZG9udEl0ZXJhdGVcbiAgICAgICAgPyBbeyBkb250SXRlcmF0ZSwgdmFsdWUgfV1cbiAgICAgICAgOiBbeyB2YWx1ZSB9XTtcbiAgfVxuXG4gIC8vIERvYyB3aWxsIGFsd2F5cyBiZSBhIHBsYWluIG9iamVjdCBvciBhbiBhcnJheS5cbiAgLy8gYXBwbHkgYW4gZXhwbGljaXQgbnVtZXJpYyBpbmRleCwgYW4gYXJyYXkuXG4gIHJldHVybiAoZG9jLCBhcnJheUluZGljZXMpID0+IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICAvLyBJZiB3ZSdyZSBiZWluZyBhc2tlZCB0byBkbyBhbiBpbnZhbGlkIGxvb2t1cCBpbnRvIGFuIGFycmF5IChub24taW50ZWdlclxuICAgICAgLy8gb3Igb3V0LW9mLWJvdW5kcyksIHJldHVybiBubyByZXN1bHRzICh3aGljaCBpcyBkaWZmZXJlbnQgZnJvbSByZXR1cm5pbmdcbiAgICAgIC8vIGEgc2luZ2xlIHVuZGVmaW5lZCByZXN1bHQsIGluIHRoYXQgYG51bGxgIGVxdWFsaXR5IGNoZWNrcyB3b24ndCBtYXRjaCkuXG4gICAgICBpZiAoIShpc051bWVyaWNLZXkoZmlyc3RQYXJ0KSAmJiBmaXJzdFBhcnQgPCBkb2MubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbWVtYmVyIHRoYXQgd2UgdXNlZCB0aGlzIGFycmF5IGluZGV4LiBJbmNsdWRlIGFuICd4JyB0byBpbmRpY2F0ZSB0aGF0XG4gICAgICAvLyB0aGUgcHJldmlvdXMgaW5kZXggY2FtZSBmcm9tIGJlaW5nIGNvbnNpZGVyZWQgYXMgYW4gZXhwbGljaXQgYXJyYXlcbiAgICAgIC8vIGluZGV4IChub3QgYnJhbmNoaW5nKS5cbiAgICAgIGFycmF5SW5kaWNlcyA9IGFycmF5SW5kaWNlcyA/IGFycmF5SW5kaWNlcy5jb25jYXQoK2ZpcnN0UGFydCwgJ3gnKSA6IFsrZmlyc3RQYXJ0LCAneCddO1xuICAgIH1cblxuICAgIC8vIERvIG91ciBmaXJzdCBsb29rdXAuXG4gICAgY29uc3QgZmlyc3RMZXZlbCA9IGRvY1tmaXJzdFBhcnRdO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gZGVlcGVyIHRvIGRpZywgcmV0dXJuIHdoYXQgd2UgZm91bmQuXG4gICAgLy9cbiAgICAvLyBJZiB3aGF0IHdlIGZvdW5kIGlzIGFuIGFycmF5LCBtb3N0IHZhbHVlIHNlbGVjdG9ycyB3aWxsIGNob29zZSB0byB0cmVhdFxuICAgIC8vIHRoZSBlbGVtZW50cyBvZiB0aGUgYXJyYXkgYXMgbWF0Y2hhYmxlIHZhbHVlcyBpbiB0aGVpciBvd24gcmlnaHQsIGJ1dFxuICAgIC8vIHRoYXQncyBkb25lIG91dHNpZGUgb2YgdGhlIGxvb2t1cCBmdW5jdGlvbi4gKEV4Y2VwdGlvbnMgdG8gdGhpcyBhcmUgJHNpemVcbiAgICAvLyBhbmQgc3R1ZmYgcmVsYXRpbmcgdG8gJGVsZW1NYXRjaC4gIGVnLCB7YTogeyRzaXplOiAyfX0gZG9lcyBub3QgbWF0Y2gge2E6XG4gICAgLy8gW1sxLCAyXV19LilcbiAgICAvL1xuICAgIC8vIFRoYXQgc2FpZCwgaWYgd2UganVzdCBkaWQgYW4gKmV4cGxpY2l0KiBhcnJheSBsb29rdXAgKG9uIGRvYykgdG8gZmluZFxuICAgIC8vIGZpcnN0TGV2ZWwsIGFuZCBmaXJzdExldmVsIGlzIGFuIGFycmF5IHRvbywgd2UgZG8gTk9UIHdhbnQgdmFsdWVcbiAgICAvLyBzZWxlY3RvcnMgdG8gaXRlcmF0ZSBvdmVyIGl0LiAgZWcsIHsnYS4wJzogNX0gZG9lcyBub3QgbWF0Y2gge2E6IFtbNV1dfS5cbiAgICAvLyBTbyBpbiB0aGF0IGNhc2UsIHdlIG1hcmsgdGhlIHJldHVybiB2YWx1ZSBhcyAnZG9uJ3QgaXRlcmF0ZScuXG4gICAgaWYgKCFsb29rdXBSZXN0KSB7XG4gICAgICByZXR1cm4gYnVpbGRSZXN1bHQoXG4gICAgICAgIGFycmF5SW5kaWNlcyxcbiAgICAgICAgQXJyYXkuaXNBcnJheShkb2MpICYmIEFycmF5LmlzQXJyYXkoZmlyc3RMZXZlbCksXG4gICAgICAgIGZpcnN0TGV2ZWwsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFdlIG5lZWQgdG8gZGlnIGRlZXBlci4gIEJ1dCBpZiB3ZSBjYW4ndCwgYmVjYXVzZSB3aGF0IHdlJ3ZlIGZvdW5kIGlzIG5vdFxuICAgIC8vIGFuIGFycmF5IG9yIHBsYWluIG9iamVjdCwgd2UncmUgZG9uZS4gSWYgd2UganVzdCBkaWQgYSBudW1lcmljIGluZGV4IGludG9cbiAgICAvLyBhbiBhcnJheSwgd2UgcmV0dXJuIG5vdGhpbmcgaGVyZSAodGhpcyBpcyBhIGNoYW5nZSBpbiBNb25nbyAyLjUgZnJvbVxuICAgIC8vIE1vbmdvIDIuNCwgd2hlcmUgeydhLjAuYic6IG51bGx9IHN0b3BwZWQgbWF0Y2hpbmcge2E6IFs1XX0pLiBPdGhlcndpc2UsXG4gICAgLy8gcmV0dXJuIGEgc2luZ2xlIGB1bmRlZmluZWRgICh3aGljaCBjYW4sIGZvciBleGFtcGxlLCBtYXRjaCB2aWEgZXF1YWxpdHlcbiAgICAvLyB3aXRoIGBudWxsYCkuXG4gICAgaWYgKCFpc0luZGV4YWJsZShmaXJzdExldmVsKSkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZG9jKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBidWlsZFJlc3VsdChhcnJheUluZGljZXMsIGZhbHNlLCB1bmRlZmluZWQpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IGFwcGVuZFRvUmVzdWx0ID0gbW9yZSA9PiB7XG4gICAgICByZXN1bHQucHVzaCguLi5tb3JlKTtcbiAgICB9O1xuXG4gICAgLy8gRGlnIGRlZXBlcjogbG9vayB1cCB0aGUgcmVzdCBvZiB0aGUgcGFydHMgb24gd2hhdGV2ZXIgd2UndmUgZm91bmQuXG4gICAgLy8gKGxvb2t1cFJlc3QgaXMgc21hcnQgZW5vdWdoIHRvIG5vdCB0cnkgdG8gZG8gaW52YWxpZCBsb29rdXBzIGludG9cbiAgICAvLyBmaXJzdExldmVsIGlmIGl0J3MgYW4gYXJyYXkuKVxuICAgIGFwcGVuZFRvUmVzdWx0KGxvb2t1cFJlc3QoZmlyc3RMZXZlbCwgYXJyYXlJbmRpY2VzKSk7XG5cbiAgICAvLyBJZiB3ZSBmb3VuZCBhbiBhcnJheSwgdGhlbiBpbiAqYWRkaXRpb24qIHRvIHBvdGVudGlhbGx5IHRyZWF0aW5nIHRoZSBuZXh0XG4gICAgLy8gcGFydCBhcyBhIGxpdGVyYWwgaW50ZWdlciBsb29rdXAsIHdlIHNob3VsZCBhbHNvICdicmFuY2gnOiB0cnkgdG8gbG9vayB1cFxuICAgIC8vIHRoZSByZXN0IG9mIHRoZSBwYXJ0cyBvbiBlYWNoIGFycmF5IGVsZW1lbnQgaW4gcGFyYWxsZWwuXG4gICAgLy9cbiAgICAvLyBJbiB0aGlzIGNhc2UsIHdlICpvbmx5KiBkaWcgZGVlcGVyIGludG8gYXJyYXkgZWxlbWVudHMgdGhhdCBhcmUgcGxhaW5cbiAgICAvLyBvYmplY3RzLiAoUmVjYWxsIHRoYXQgd2Ugb25seSBnb3QgdGhpcyBmYXIgaWYgd2UgaGF2ZSBmdXJ0aGVyIHRvIGRpZy4pXG4gICAgLy8gVGhpcyBtYWtlcyBzZW5zZTogd2UgY2VydGFpbmx5IGRvbid0IGRpZyBkZWVwZXIgaW50byBub24taW5kZXhhYmxlXG4gICAgLy8gb2JqZWN0cy4gQW5kIGl0IHdvdWxkIGJlIHdlaXJkIHRvIGRpZyBpbnRvIGFuIGFycmF5OiBpdCdzIHNpbXBsZXIgdG8gaGF2ZVxuICAgIC8vIGEgcnVsZSB0aGF0IGV4cGxpY2l0IGludGVnZXIgaW5kZXhlcyBvbmx5IGFwcGx5IHRvIGFuIG91dGVyIGFycmF5LCBub3QgdG9cbiAgICAvLyBhbiBhcnJheSB5b3UgZmluZCBhZnRlciBhIGJyYW5jaGluZyBzZWFyY2guXG4gICAgLy9cbiAgICAvLyBJbiB0aGUgc3BlY2lhbCBjYXNlIG9mIGEgbnVtZXJpYyBwYXJ0IGluIGEgKnNvcnQgc2VsZWN0b3IqIChub3QgYSBxdWVyeVxuICAgIC8vIHNlbGVjdG9yKSwgd2Ugc2tpcCB0aGUgYnJhbmNoaW5nOiB3ZSBPTkxZIGFsbG93IHRoZSBudW1lcmljIHBhcnQgdG8gbWVhblxuICAgIC8vICdsb29rIHVwIHRoaXMgaW5kZXgnIGluIHRoYXQgY2FzZSwgbm90ICdhbHNvIGxvb2sgdXAgdGhpcyBpbmRleCBpbiBhbGxcbiAgICAvLyB0aGUgZWxlbWVudHMgb2YgdGhlIGFycmF5Jy5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaXJzdExldmVsKSAmJlxuICAgICAgICAhKGlzTnVtZXJpY0tleShwYXJ0c1sxXSkgJiYgb3B0aW9ucy5mb3JTb3J0KSkge1xuICAgICAgZmlyc3RMZXZlbC5mb3JFYWNoKChicmFuY2gsIGFycmF5SW5kZXgpID0+IHtcbiAgICAgICAgaWYgKExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChicmFuY2gpKSB7XG4gICAgICAgICAgYXBwZW5kVG9SZXN1bHQobG9va3VwUmVzdChicmFuY2gsIGFycmF5SW5kaWNlcyA/IGFycmF5SW5kaWNlcy5jb25jYXQoYXJyYXlJbmRleCkgOiBbYXJyYXlJbmRleF0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cblxuLy8gT2JqZWN0IGV4cG9ydGVkIG9ubHkgZm9yIHVuaXQgdGVzdGluZy5cbi8vIFVzZSBpdCB0byBleHBvcnQgcHJpdmF0ZSBmdW5jdGlvbnMgdG8gdGVzdCBpbiBUaW55dGVzdC5cbk1pbmltb25nb1Rlc3QgPSB7bWFrZUxvb2t1cEZ1bmN0aW9ufTtcbk1pbmltb25nb0Vycm9yID0gKG1lc3NhZ2UsIG9wdGlvbnMgPSB7fSkgPT4ge1xuICBpZiAodHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnICYmIG9wdGlvbnMuZmllbGQpIHtcbiAgICBtZXNzYWdlICs9IGAgZm9yIGZpZWxkICcke29wdGlvbnMuZmllbGR9J2A7XG4gIH1cblxuICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyb3IubmFtZSA9ICdNaW5pbW9uZ29FcnJvcic7XG4gIHJldHVybiBlcnJvcjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBub3RoaW5nTWF0Y2hlcihkb2NPckJyYW5jaGVkVmFsdWVzKSB7XG4gIHJldHVybiB7cmVzdWx0OiBmYWxzZX07XG59XG5cbi8vIFRha2VzIGFuIG9wZXJhdG9yIG9iamVjdCAoYW4gb2JqZWN0IHdpdGggJCBrZXlzKSBhbmQgcmV0dXJucyBhIGJyYW5jaGVkXG4vLyBtYXRjaGVyIGZvciBpdC5cbmZ1bmN0aW9uIG9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyKHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIsIGlzUm9vdCkge1xuICAvLyBFYWNoIHZhbHVlU2VsZWN0b3Igd29ya3Mgc2VwYXJhdGVseSBvbiB0aGUgdmFyaW91cyBicmFuY2hlcy4gIFNvIG9uZVxuICAvLyBvcGVyYXRvciBjYW4gbWF0Y2ggb25lIGJyYW5jaCBhbmQgYW5vdGhlciBjYW4gbWF0Y2ggYW5vdGhlciBicmFuY2guICBUaGlzXG4gIC8vIGlzIE9LLlxuICBjb25zdCBvcGVyYXRvck1hdGNoZXJzID0gT2JqZWN0LmtleXModmFsdWVTZWxlY3RvcikubWFwKG9wZXJhdG9yID0+IHtcbiAgICBjb25zdCBvcGVyYW5kID0gdmFsdWVTZWxlY3RvcltvcGVyYXRvcl07XG5cbiAgICBjb25zdCBzaW1wbGVSYW5nZSA9IChcbiAgICAgIFsnJGx0JywgJyRsdGUnLCAnJGd0JywgJyRndGUnXS5pbmNsdWRlcyhvcGVyYXRvcikgJiZcbiAgICAgIHR5cGVvZiBvcGVyYW5kID09PSAnbnVtYmVyJ1xuICAgICk7XG5cbiAgICBjb25zdCBzaW1wbGVFcXVhbGl0eSA9IChcbiAgICAgIFsnJG5lJywgJyRlcSddLmluY2x1ZGVzKG9wZXJhdG9yKSAmJlxuICAgICAgb3BlcmFuZCAhPT0gT2JqZWN0KG9wZXJhbmQpXG4gICAgKTtcblxuICAgIGNvbnN0IHNpbXBsZUluY2x1c2lvbiA9IChcbiAgICAgIFsnJGluJywgJyRuaW4nXS5pbmNsdWRlcyhvcGVyYXRvcilcbiAgICAgICYmIEFycmF5LmlzQXJyYXkob3BlcmFuZClcbiAgICAgICYmICFvcGVyYW5kLnNvbWUoeCA9PiB4ID09PSBPYmplY3QoeCkpXG4gICAgKTtcblxuICAgIGlmICghKHNpbXBsZVJhbmdlIHx8IHNpbXBsZUluY2x1c2lvbiB8fCBzaW1wbGVFcXVhbGl0eSkpIHtcbiAgICAgIG1hdGNoZXIuX2lzU2ltcGxlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGhhc093bi5jYWxsKFZBTFVFX09QRVJBVE9SUywgb3BlcmF0b3IpKSB7XG4gICAgICByZXR1cm4gVkFMVUVfT1BFUkFUT1JTW29wZXJhdG9yXShvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpO1xuICAgIH1cblxuICAgIGlmIChoYXNPd24uY2FsbChFTEVNRU5UX09QRVJBVE9SUywgb3BlcmF0b3IpKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0gRUxFTUVOVF9PUEVSQVRPUlNbb3BlcmF0b3JdO1xuICAgICAgcmV0dXJuIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgICAgICBvcHRpb25zLmNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlciksXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgb3BlcmF0b3I6ICR7b3BlcmF0b3J9YCk7XG4gIH0pO1xuXG4gIHJldHVybiBhbmRCcmFuY2hlZE1hdGNoZXJzKG9wZXJhdG9yTWF0Y2hlcnMpO1xufVxuXG4vLyBwYXRocyAtIEFycmF5OiBsaXN0IG9mIG1vbmdvIHN0eWxlIHBhdGhzXG4vLyBuZXdMZWFmRm4gLSBGdW5jdGlvbjogb2YgZm9ybSBmdW5jdGlvbihwYXRoKSBzaG91bGQgcmV0dXJuIGEgc2NhbGFyIHZhbHVlIHRvXG4vLyAgICAgICAgICAgICAgICAgICAgICAgcHV0IGludG8gbGlzdCBjcmVhdGVkIGZvciB0aGF0IHBhdGhcbi8vIGNvbmZsaWN0Rm4gLSBGdW5jdGlvbjogb2YgZm9ybSBmdW5jdGlvbihub2RlLCBwYXRoLCBmdWxsUGF0aCkgaXMgY2FsbGVkXG4vLyAgICAgICAgICAgICAgICAgICAgICAgIHdoZW4gYnVpbGRpbmcgYSB0cmVlIHBhdGggZm9yICdmdWxsUGF0aCcgbm9kZSBvblxuLy8gICAgICAgICAgICAgICAgICAgICAgICAncGF0aCcgd2FzIGFscmVhZHkgYSBsZWFmIHdpdGggYSB2YWx1ZS4gTXVzdCByZXR1cm4gYVxuLy8gICAgICAgICAgICAgICAgICAgICAgICBjb25mbGljdCByZXNvbHV0aW9uLlxuLy8gaW5pdGlhbCB0cmVlIC0gT3B0aW9uYWwgT2JqZWN0OiBzdGFydGluZyB0cmVlLlxuLy8gQHJldHVybnMgLSBPYmplY3Q6IHRyZWUgcmVwcmVzZW50ZWQgYXMgYSBzZXQgb2YgbmVzdGVkIG9iamVjdHNcbmV4cG9ydCBmdW5jdGlvbiBwYXRoc1RvVHJlZShwYXRocywgbmV3TGVhZkZuLCBjb25mbGljdEZuLCByb290ID0ge30pIHtcbiAgcGF0aHMuZm9yRWFjaChwYXRoID0+IHtcbiAgICBjb25zdCBwYXRoQXJyYXkgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgbGV0IHRyZWUgPSByb290O1xuXG4gICAgLy8gdXNlIC5ldmVyeSBqdXN0IGZvciBpdGVyYXRpb24gd2l0aCBicmVha1xuICAgIGNvbnN0IHN1Y2Nlc3MgPSBwYXRoQXJyYXkuc2xpY2UoMCwgLTEpLmV2ZXJ5KChrZXksIGkpID0+IHtcbiAgICAgIGlmICghaGFzT3duLmNhbGwodHJlZSwga2V5KSkge1xuICAgICAgICB0cmVlW2tleV0gPSB7fTtcbiAgICAgIH0gZWxzZSBpZiAodHJlZVtrZXldICE9PSBPYmplY3QodHJlZVtrZXldKSkge1xuICAgICAgICB0cmVlW2tleV0gPSBjb25mbGljdEZuKFxuICAgICAgICAgIHRyZWVba2V5XSxcbiAgICAgICAgICBwYXRoQXJyYXkuc2xpY2UoMCwgaSArIDEpLmpvaW4oJy4nKSxcbiAgICAgICAgICBwYXRoXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gYnJlYWsgb3V0IG9mIGxvb3AgaWYgd2UgYXJlIGZhaWxpbmcgZm9yIHRoaXMgcGF0aFxuICAgICAgICBpZiAodHJlZVtrZXldICE9PSBPYmplY3QodHJlZVtrZXldKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0cmVlID0gdHJlZVtrZXldO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICBjb25zdCBsYXN0S2V5ID0gcGF0aEFycmF5W3BhdGhBcnJheS5sZW5ndGggLSAxXTtcbiAgICAgIGlmIChoYXNPd24uY2FsbCh0cmVlLCBsYXN0S2V5KSkge1xuICAgICAgICB0cmVlW2xhc3RLZXldID0gY29uZmxpY3RGbih0cmVlW2xhc3RLZXldLCBwYXRoLCBwYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyZWVbbGFzdEtleV0gPSBuZXdMZWFmRm4ocGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcm9vdDtcbn1cblxuLy8gTWFrZXMgc3VyZSB3ZSBnZXQgMiBlbGVtZW50cyBhcnJheSBhbmQgYXNzdW1lIHRoZSBmaXJzdCBvbmUgdG8gYmUgeCBhbmRcbi8vIHRoZSBzZWNvbmQgb25lIHRvIHkgbm8gbWF0dGVyIHdoYXQgdXNlciBwYXNzZXMuXG4vLyBJbiBjYXNlIHVzZXIgcGFzc2VzIHsgbG9uOiB4LCBsYXQ6IHkgfSByZXR1cm5zIFt4LCB5XVxuZnVuY3Rpb24gcG9pbnRUb0FycmF5KHBvaW50KSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHBvaW50KSA/IHBvaW50LnNsaWNlKCkgOiBbcG9pbnQueCwgcG9pbnQueV07XG59XG5cbi8vIENyZWF0aW5nIGEgZG9jdW1lbnQgZnJvbSBhbiB1cHNlcnQgaXMgcXVpdGUgdHJpY2t5LlxuLy8gRS5nLiB0aGlzIHNlbGVjdG9yOiB7XCIkb3JcIjogW3tcImIuZm9vXCI6IHtcIiRhbGxcIjogW1wiYmFyXCJdfX1dfSwgc2hvdWxkIHJlc3VsdFxuLy8gaW46IHtcImIuZm9vXCI6IFwiYmFyXCJ9XG4vLyBCdXQgdGhpcyBzZWxlY3Rvcjoge1wiJG9yXCI6IFt7XCJiXCI6IHtcImZvb1wiOiB7XCIkYWxsXCI6IFtcImJhclwiXX19fV19IHNob3VsZCB0aHJvd1xuLy8gYW4gZXJyb3JcblxuLy8gU29tZSBydWxlcyAoZm91bmQgbWFpbmx5IHdpdGggdHJpYWwgJiBlcnJvciwgc28gdGhlcmUgbWlnaHQgYmUgbW9yZSk6XG4vLyAtIGhhbmRsZSBhbGwgY2hpbGRzIG9mICRhbmQgKG9yIGltcGxpY2l0ICRhbmQpXG4vLyAtIGhhbmRsZSAkb3Igbm9kZXMgd2l0aCBleGFjdGx5IDEgY2hpbGRcbi8vIC0gaWdub3JlICRvciBub2RlcyB3aXRoIG1vcmUgdGhhbiAxIGNoaWxkXG4vLyAtIGlnbm9yZSAkbm9yIGFuZCAkbm90IG5vZGVzXG4vLyAtIHRocm93IHdoZW4gYSB2YWx1ZSBjYW4gbm90IGJlIHNldCB1bmFtYmlndW91c2x5XG4vLyAtIGV2ZXJ5IHZhbHVlIGZvciAkYWxsIHNob3VsZCBiZSBkZWFsdCB3aXRoIGFzIHNlcGFyYXRlICRlcS1zXG4vLyAtIHRocmVhdCBhbGwgY2hpbGRyZW4gb2YgJGFsbCBhcyAkZXEgc2V0dGVycyAoPT4gc2V0IGlmICRhbGwubGVuZ3RoID09PSAxLFxuLy8gICBvdGhlcndpc2UgdGhyb3cgZXJyb3IpXG4vLyAtIHlvdSBjYW4gbm90IG1peCAnJCctcHJlZml4ZWQga2V5cyBhbmQgbm9uLSckJy1wcmVmaXhlZCBrZXlzXG4vLyAtIHlvdSBjYW4gb25seSBoYXZlIGRvdHRlZCBrZXlzIG9uIGEgcm9vdC1sZXZlbFxuLy8gLSB5b3UgY2FuIG5vdCBoYXZlICckJy1wcmVmaXhlZCBrZXlzIG1vcmUgdGhhbiBvbmUtbGV2ZWwgZGVlcCBpbiBhbiBvYmplY3RcblxuLy8gSGFuZGxlcyBvbmUga2V5L3ZhbHVlIHBhaXIgdG8gcHV0IGluIHRoZSBzZWxlY3RvciBkb2N1bWVudFxuZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCB2YWx1ZSkge1xuICBpZiAodmFsdWUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoT2JqZWN0KGRvY3VtZW50LCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICghKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSkge1xuICAgIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gIH1cbn1cblxuLy8gSGFuZGxlcyBhIGtleSwgdmFsdWUgcGFpciB0byBwdXQgaW4gdGhlIHNlbGVjdG9yIGRvY3VtZW50XG4vLyBpZiB0aGUgdmFsdWUgaXMgYW4gb2JqZWN0XG5mdW5jdGlvbiBwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdChkb2N1bWVudCwga2V5LCB2YWx1ZSkge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICBjb25zdCB1bnByZWZpeGVkS2V5cyA9IGtleXMuZmlsdGVyKG9wID0+IG9wWzBdICE9PSAnJCcpO1xuXG4gIGlmICh1bnByZWZpeGVkS2V5cy5sZW5ndGggPiAwIHx8ICFrZXlzLmxlbmd0aCkge1xuICAgIC8vIExpdGVyYWwgKHBvc3NpYmx5IGVtcHR5KSBvYmplY3QgKCBvciBlbXB0eSBvYmplY3QgKVxuICAgIC8vIERvbid0IGFsbG93IG1peGluZyAnJCctcHJlZml4ZWQgd2l0aCBub24tJyQnLXByZWZpeGVkIGZpZWxkc1xuICAgIGlmIChrZXlzLmxlbmd0aCAhPT0gdW5wcmVmaXhlZEtleXMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gb3BlcmF0b3I6ICR7dW5wcmVmaXhlZEtleXNbMF19YCk7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVPYmplY3QodmFsdWUsIGtleSk7XG4gICAgaW5zZXJ0SW50b0RvY3VtZW50KGRvY3VtZW50LCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChvcCA9PiB7XG4gICAgICBjb25zdCBvYmplY3QgPSB2YWx1ZVtvcF07XG5cbiAgICAgIGlmIChvcCA9PT0gJyRlcScpIHtcbiAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCBvYmplY3QpO1xuICAgICAgfSBlbHNlIGlmIChvcCA9PT0gJyRhbGwnKSB7XG4gICAgICAgIC8vIGV2ZXJ5IHZhbHVlIGZvciAkYWxsIHNob3VsZCBiZSBkZWFsdCB3aXRoIGFzIHNlcGFyYXRlICRlcS1zXG4gICAgICAgIG9iamVjdC5mb3JFYWNoKGVsZW1lbnQgPT5cbiAgICAgICAgICBwb3B1bGF0ZURvY3VtZW50V2l0aEtleVZhbHVlKGRvY3VtZW50LCBrZXksIGVsZW1lbnQpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gRmlsbHMgYSBkb2N1bWVudCB3aXRoIGNlcnRhaW4gZmllbGRzIGZyb20gYW4gdXBzZXJ0IHNlbGVjdG9yXG5leHBvcnQgZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyhxdWVyeSwgZG9jdW1lbnQgPSB7fSkge1xuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKHF1ZXJ5KSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuICAgIC8vIGhhbmRsZSBpbXBsaWNpdCAkYW5kXG4gICAgT2JqZWN0LmtleXMocXVlcnkpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gcXVlcnlba2V5XTtcblxuICAgICAgaWYgKGtleSA9PT0gJyRhbmQnKSB7XG4gICAgICAgIC8vIGhhbmRsZSBleHBsaWNpdCAkYW5kXG4gICAgICAgIHZhbHVlLmZvckVhY2goZWxlbWVudCA9PlxuICAgICAgICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMoZWxlbWVudCwgZG9jdW1lbnQpXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJyRvcicpIHtcbiAgICAgICAgLy8gaGFuZGxlICRvciBub2RlcyB3aXRoIGV4YWN0bHkgMSBjaGlsZFxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyh2YWx1ZVswXSwgZG9jdW1lbnQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGtleVswXSAhPT0gJyQnKSB7XG4gICAgICAgIC8vIElnbm9yZSBvdGhlciAnJCctcHJlZml4ZWQgbG9naWNhbCBzZWxlY3RvcnNcbiAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gSGFuZGxlIG1ldGVvci1zcGVjaWZpYyBzaG9ydGN1dCBmb3Igc2VsZWN0aW5nIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChxdWVyeSkpIHtcbiAgICAgIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwgJ19pZCcsIHF1ZXJ5KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZG9jdW1lbnQ7XG59XG5cbi8vIFRyYXZlcnNlcyB0aGUga2V5cyBvZiBwYXNzZWQgcHJvamVjdGlvbiBhbmQgY29uc3RydWN0cyBhIHRyZWUgd2hlcmUgYWxsXG4vLyBsZWF2ZXMgYXJlIGVpdGhlciBhbGwgVHJ1ZSBvciBhbGwgRmFsc2Vcbi8vIEByZXR1cm5zIE9iamVjdDpcbi8vICAtIHRyZWUgLSBPYmplY3QgLSB0cmVlIHJlcHJlc2VudGF0aW9uIG9mIGtleXMgaW52b2x2ZWQgaW4gcHJvamVjdGlvblxuLy8gIChleGNlcHRpb24gZm9yICdfaWQnIGFzIGl0IGlzIGEgc3BlY2lhbCBjYXNlIGhhbmRsZWQgc2VwYXJhdGVseSlcbi8vICAtIGluY2x1ZGluZyAtIEJvb2xlYW4gLSBcInRha2Ugb25seSBjZXJ0YWluIGZpZWxkc1wiIHR5cGUgb2YgcHJvamVjdGlvblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb25EZXRhaWxzKGZpZWxkcykge1xuICAvLyBGaW5kIHRoZSBub24tX2lkIGtleXMgKF9pZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBiZWNhdXNlIGl0IGlzIGluY2x1ZGVkXG4gIC8vIHVubGVzcyBleHBsaWNpdGx5IGV4Y2x1ZGVkKS4gU29ydCB0aGUga2V5cywgc28gdGhhdCBvdXIgY29kZSB0byBkZXRlY3RcbiAgLy8gb3ZlcmxhcHMgbGlrZSAnZm9vJyBhbmQgJ2Zvby5iYXInIGNhbiBhc3N1bWUgdGhhdCAnZm9vJyBjb21lcyBmaXJzdC5cbiAgbGV0IGZpZWxkc0tleXMgPSBPYmplY3Qua2V5cyhmaWVsZHMpLnNvcnQoKTtcblxuICAvLyBJZiBfaWQgaXMgdGhlIG9ubHkgZmllbGQgaW4gdGhlIHByb2plY3Rpb24sIGRvIG5vdCByZW1vdmUgaXQsIHNpbmNlIGl0IGlzXG4gIC8vIHJlcXVpcmVkIHRvIGRldGVybWluZSBpZiB0aGlzIGlzIGFuIGV4Y2x1c2lvbiBvciBleGNsdXNpb24uIEFsc28ga2VlcCBhblxuICAvLyBpbmNsdXNpdmUgX2lkLCBzaW5jZSBpbmNsdXNpdmUgX2lkIGZvbGxvd3MgdGhlIG5vcm1hbCBydWxlcyBhYm91dCBtaXhpbmdcbiAgLy8gaW5jbHVzaXZlIGFuZCBleGNsdXNpdmUgZmllbGRzLiBJZiBfaWQgaXMgbm90IHRoZSBvbmx5IGZpZWxkIGluIHRoZVxuICAvLyBwcm9qZWN0aW9uIGFuZCBpcyBleGNsdXNpdmUsIHJlbW92ZSBpdCBzbyBpdCBjYW4gYmUgaGFuZGxlZCBsYXRlciBieSBhXG4gIC8vIHNwZWNpYWwgY2FzZSwgc2luY2UgZXhjbHVzaXZlIF9pZCBpcyBhbHdheXMgYWxsb3dlZC5cbiAgaWYgKCEoZmllbGRzS2V5cy5sZW5ndGggPT09IDEgJiYgZmllbGRzS2V5c1swXSA9PT0gJ19pZCcpICYmXG4gICAgICAhKGZpZWxkc0tleXMuaW5jbHVkZXMoJ19pZCcpICYmIGZpZWxkcy5faWQpKSB7XG4gICAgZmllbGRzS2V5cyA9IGZpZWxkc0tleXMuZmlsdGVyKGtleSA9PiBrZXkgIT09ICdfaWQnKTtcbiAgfVxuXG4gIGxldCBpbmNsdWRpbmcgPSBudWxsOyAvLyBVbmtub3duXG5cbiAgZmllbGRzS2V5cy5mb3JFYWNoKGtleVBhdGggPT4ge1xuICAgIGNvbnN0IHJ1bGUgPSAhIWZpZWxkc1trZXlQYXRoXTtcblxuICAgIGlmIChpbmNsdWRpbmcgPT09IG51bGwpIHtcbiAgICAgIGluY2x1ZGluZyA9IHJ1bGU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBlcnJvciBtZXNzYWdlIGlzIGNvcGllZCBmcm9tIE1vbmdvREIgc2hlbGxcbiAgICBpZiAoaW5jbHVkaW5nICE9PSBydWxlKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ1lvdSBjYW5ub3QgY3VycmVudGx5IG1peCBpbmNsdWRpbmcgYW5kIGV4Y2x1ZGluZyBmaWVsZHMuJ1xuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IHByb2plY3Rpb25SdWxlc1RyZWUgPSBwYXRoc1RvVHJlZShcbiAgICBmaWVsZHNLZXlzLFxuICAgIHBhdGggPT4gaW5jbHVkaW5nLFxuICAgIChub2RlLCBwYXRoLCBmdWxsUGF0aCkgPT4ge1xuICAgICAgLy8gQ2hlY2sgcGFzc2VkIHByb2plY3Rpb24gZmllbGRzJyBrZXlzOiBJZiB5b3UgaGF2ZSB0d28gcnVsZXMgc3VjaCBhc1xuICAgICAgLy8gJ2Zvby5iYXInIGFuZCAnZm9vLmJhci5iYXonLCB0aGVuIHRoZSByZXN1bHQgYmVjb21lcyBhbWJpZ3VvdXMuIElmXG4gICAgICAvLyB0aGF0IGhhcHBlbnMsIHRoZXJlIGlzIGEgcHJvYmFiaWxpdHkgeW91IGFyZSBkb2luZyBzb21ldGhpbmcgd3JvbmcsXG4gICAgICAvLyBmcmFtZXdvcmsgc2hvdWxkIG5vdGlmeSB5b3UgYWJvdXQgc3VjaCBtaXN0YWtlIGVhcmxpZXIgb24gY3Vyc29yXG4gICAgICAvLyBjb21waWxhdGlvbiBzdGVwIHRoYW4gbGF0ZXIgZHVyaW5nIHJ1bnRpbWUuICBOb3RlLCB0aGF0IHJlYWwgbW9uZ29cbiAgICAgIC8vIGRvZXNuJ3QgZG8gYW55dGhpbmcgYWJvdXQgaXQgYW5kIHRoZSBsYXRlciBydWxlIGFwcGVhcnMgaW4gcHJvamVjdGlvblxuICAgICAgLy8gcHJvamVjdCwgbW9yZSBwcmlvcml0eSBpdCB0YWtlcy5cbiAgICAgIC8vXG4gICAgICAvLyBFeGFtcGxlLCBhc3N1bWUgZm9sbG93aW5nIGluIG1vbmdvIHNoZWxsOlxuICAgICAgLy8gPiBkYi5jb2xsLmluc2VydCh7IGE6IHsgYjogMjMsIGM6IDQ0IH0gfSlcbiAgICAgIC8vID4gZGIuY29sbC5maW5kKHt9LCB7ICdhJzogMSwgJ2EuYic6IDEgfSlcbiAgICAgIC8vIHtcIl9pZFwiOiBPYmplY3RJZChcIjUyMGJmZTQ1NjAyNDYwOGU4ZWYyNGFmM1wiKSwgXCJhXCI6IHtcImJcIjogMjN9fVxuICAgICAgLy8gPiBkYi5jb2xsLmZpbmQoe30sIHsgJ2EuYic6IDEsICdhJzogMSB9KVxuICAgICAgLy8ge1wiX2lkXCI6IE9iamVjdElkKFwiNTIwYmZlNDU2MDI0NjA4ZThlZjI0YWYzXCIpLCBcImFcIjoge1wiYlwiOiAyMywgXCJjXCI6IDQ0fX1cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlLCBob3cgc2Vjb25kIHRpbWUgdGhlIHJldHVybiBzZXQgb2Yga2V5cyBpcyBkaWZmZXJlbnQuXG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IGZ1bGxQYXRoO1xuICAgICAgY29uc3QgYW5vdGhlclBhdGggPSBwYXRoO1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBib3RoICR7Y3VycmVudFBhdGh9IGFuZCAke2Fub3RoZXJQYXRofSBmb3VuZCBpbiBmaWVsZHMgb3B0aW9uLCBgICtcbiAgICAgICAgJ3VzaW5nIGJvdGggb2YgdGhlbSBtYXkgdHJpZ2dlciB1bmV4cGVjdGVkIGJlaGF2aW9yLiBEaWQgeW91IG1lYW4gdG8gJyArXG4gICAgICAgICd1c2Ugb25seSBvbmUgb2YgdGhlbT8nXG4gICAgICApO1xuICAgIH0pO1xuXG4gIHJldHVybiB7aW5jbHVkaW5nLCB0cmVlOiBwcm9qZWN0aW9uUnVsZXNUcmVlfTtcbn1cblxuLy8gVGFrZXMgYSBSZWdFeHAgb2JqZWN0IGFuZCByZXR1cm5zIGFuIGVsZW1lbnQgbWF0Y2hlci5cbmV4cG9ydCBmdW5jdGlvbiByZWdleHBFbGVtZW50TWF0Y2hlcihyZWdleHApIHtcbiAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpID09PSByZWdleHAudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICAvLyBSZWdleHBzIG9ubHkgd29yayBhZ2FpbnN0IHN0cmluZ3MuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBSZXNldCByZWdleHAncyBzdGF0ZSB0byBhdm9pZCBpbmNvbnNpc3RlbnQgbWF0Y2hpbmcgZm9yIG9iamVjdHMgd2l0aCB0aGVcbiAgICAvLyBzYW1lIHZhbHVlIG9uIGNvbnNlY3V0aXZlIGNhbGxzIG9mIHJlZ2V4cC50ZXN0LiBUaGlzIGhhcHBlbnMgb25seSBpZiB0aGVcbiAgICAvLyByZWdleHAgaGFzIHRoZSAnZycgZmxhZy4gQWxzbyBub3RlIHRoYXQgRVM2IGludHJvZHVjZXMgYSBuZXcgZmxhZyAneScgZm9yXG4gICAgLy8gd2hpY2ggd2Ugc2hvdWxkICpub3QqIGNoYW5nZSB0aGUgbGFzdEluZGV4IGJ1dCBNb25nb0RCIGRvZXNuJ3Qgc3VwcG9ydFxuICAgIC8vIGVpdGhlciBvZiB0aGVzZSBmbGFncy5cbiAgICByZWdleHAubGFzdEluZGV4ID0gMDtcblxuICAgIHJldHVybiByZWdleHAudGVzdCh2YWx1ZSk7XG4gIH07XG59XG5cbi8vIFZhbGlkYXRlcyB0aGUga2V5IGluIGEgcGF0aC5cbi8vIE9iamVjdHMgdGhhdCBhcmUgbmVzdGVkIG1vcmUgdGhlbiAxIGxldmVsIGNhbm5vdCBoYXZlIGRvdHRlZCBmaWVsZHNcbi8vIG9yIGZpZWxkcyBzdGFydGluZyB3aXRoICckJ1xuZnVuY3Rpb24gdmFsaWRhdGVLZXlJblBhdGgoa2V5LCBwYXRoKSB7XG4gIGlmIChrZXkuaW5jbHVkZXMoJy4nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBUaGUgZG90dGVkIGZpZWxkICcke2tleX0nIGluICcke3BhdGh9LiR7a2V5fSBpcyBub3QgdmFsaWQgZm9yIHN0b3JhZ2UuYFxuICAgICk7XG4gIH1cblxuICBpZiAoa2V5WzBdID09PSAnJCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVGhlIGRvbGxhciAoJCkgcHJlZml4ZWQgZmllbGQgICcke3BhdGh9LiR7a2V5fSBpcyBub3QgdmFsaWQgZm9yIHN0b3JhZ2UuYFxuICAgICk7XG4gIH1cbn1cblxuLy8gUmVjdXJzaXZlbHkgdmFsaWRhdGVzIGFuIG9iamVjdCB0aGF0IGlzIG5lc3RlZCBtb3JlIHRoYW4gb25lIGxldmVsIGRlZXBcbmZ1bmN0aW9uIHZhbGlkYXRlT2JqZWN0KG9iamVjdCwgcGF0aCkge1xuICBpZiAob2JqZWN0ICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmplY3QpID09PSBPYmplY3QucHJvdG90eXBlKSB7XG4gICAgT2JqZWN0LmtleXMob2JqZWN0KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICB2YWxpZGF0ZUtleUluUGF0aChrZXksIHBhdGgpO1xuICAgICAgdmFsaWRhdGVPYmplY3Qob2JqZWN0W2tleV0sIHBhdGggKyAnLicgKyBrZXkpO1xuICAgIH0pO1xuICB9XG59XG4iLCIvKiogRXhwb3J0ZWQgdmFsdWVzIGFyZSBhbHNvIHVzZWQgaW4gdGhlIG1vbmdvIHBhY2thZ2UuICovXG5cbi8qKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZCkge1xuICByZXR1cm4gYCR7bWV0aG9kLnJlcGxhY2UoJ18nLCAnJyl9QXN5bmNgO1xufVxuXG5leHBvcnQgY29uc3QgQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTID0gW1xuICAnX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24nLFxuICAnZHJvcENvbGxlY3Rpb24nLFxuICAnZHJvcEluZGV4JyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdjcmVhdGVJbmRleCcsXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVBc3luY1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGZpbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvU29ydFNwZWNpZmllcn0gb3B0aW9ucy5zb3J0IFNvcnQgb3JkZXIgKGRlZmF1bHQ6IG5hdHVyYWwgb3JkZXIpXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnNraXAgTnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWFjdGl2ZSAoQ2xpZW50IG9ubHkpIERlZmF1bHQgdHJ1ZTsgcGFzcyBmYWxzZSB0byBkaXNhYmxlIHJlYWN0aXZpdHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciBmZXRjaGluZyB0aGUgZG9jdW1lbnQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHByaW1hcnlgLCBgcHJpbWFyeVByZWZlcnJlZGAsIGBzZWNvbmRhcnlgLCBgc2Vjb25kYXJ5UHJlZmVycmVkYCBhbmQgYG5lYXJlc3RgLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdmaW5kT25lJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEluc2VydCBhIGRvY3VtZW50IGluIHRoZSBjb2xsZWN0aW9uLiAgUmV0dXJucyBpdHMgdW5pcXVlIF9pZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgIGluc2VydEFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZG9jIFRoZSBkb2N1bWVudCB0byBpbnNlcnQuIE1heSBub3QgeWV0IGhhdmUgYW4gX2lkIGF0dHJpYnV0ZSwgaW4gd2hpY2ggY2FzZSBNZXRlb3Igd2lsbCBnZW5lcmF0ZSBvbmUgZm9yIHlvdS5cbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gICdpbnNlcnQnLFxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZUFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gcmVtb3ZlXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAncmVtb3ZlJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFJldHVybnMgdGhlIG51bWJlciBvZiBtYXRjaGVkIGRvY3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBkYXRlQXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51cHNlcnQgVHJ1ZSB0byBpbnNlcnQgYSBkb2N1bWVudCBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgYXJlIGZvdW5kLlxuICAgKiBAcGFyYW0ge0FycmF5fSBvcHRpb25zLmFycmF5RmlsdGVycyBPcHRpb25hbC4gVXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIE1vbmdvREIgW2ZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3VwZGF0ZS9wb3NpdGlvbmFsLWZpbHRlcmVkLykgdG8gc3BlY2lmeSB3aGljaCBlbGVtZW50cyB0byBtb2RpZnkgaW4gYW4gYXJyYXkgZmllbGQuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAndXBkYXRlJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAndXBzZXJ0Jyxcbl07XG5cbmV4cG9ydCBjb25zdCBBU1lOQ19DVVJTT1JfTUVUSE9EUyA9IFtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIDIuOVxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggYSBxdWVyeS4gVGhpcyBtZXRob2QgaXNcbiAgICogICAgICAgICAgW2RlcHJlY2F0ZWQgc2luY2UgTW9uZ29EQiA0LjBdKGh0dHBzOi8vd3d3Lm1vbmdvZGIuY29tL2RvY3MvdjQuNC9yZWZlcmVuY2UvY29tbWFuZC9jb3VudC8pO1xuICAgKiAgICAgICAgICBzZWUgYENvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGFuZFxuICAgKiAgICAgICAgICBgQ29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBmb3IgYSByZXBsYWNlbWVudC5cbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAbWV0aG9kICBjb3VudEFzeW5jXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICAnY291bnQnLFxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJuIGFsbCBtYXRjaGluZyBkb2N1bWVudHMgYXMgYW4gQXJyYXkuXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQG1ldGhvZCAgZmV0Y2hBc3luY1xuICAgKiBAaW5zdGFuY2VcbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgJ2ZldGNoJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgYGNhbGxiYWNrYCBvbmNlIGZvciBlYWNoIG1hdGNoaW5nIGRvY3VtZW50LCBzZXF1ZW50aWFsbHkgYW5kXG4gICAqICAgICAgICAgIHN5bmNocm9ub3VzbHkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBmb3JFYWNoQXN5bmNcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQHBhcmFtIHtJdGVyYXRpb25DYWxsYmFja30gY2FsbGJhY2sgRnVuY3Rpb24gdG8gY2FsbC4gSXQgd2lsbCBiZSBjYWxsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2l0aCB0aHJlZSBhcmd1bWVudHM6IHRoZSBkb2N1bWVudCwgYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLWJhc2VkIGluZGV4LCBhbmQgPGVtPmN1cnNvcjwvZW0+XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0c2VsZi5cbiAgICogQHBhcmFtIHtBbnl9IFt0aGlzQXJnXSBBbiBvYmplY3Qgd2hpY2ggd2lsbCBiZSB0aGUgdmFsdWUgb2YgYHRoaXNgIGluc2lkZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgJ2ZvckVhY2gnLFxuICAvKipcbiAgICogQHN1bW1hcnkgTWFwIGNhbGxiYWNrIG92ZXIgYWxsIG1hdGNoaW5nIGRvY3VtZW50cy4gIFJldHVybnMgYW4gQXJyYXkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIG1hcEFzeW5jXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBwYXJhbSB7SXRlcmF0aW9uQ2FsbGJhY2t9IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpdGggdGhyZWUgYXJndW1lbnRzOiB0aGUgZG9jdW1lbnQsIGFcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMC1iYXNlZCBpbmRleCwgYW5kIDxlbT5jdXJzb3I8L2VtPlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdHNlbGYuXG4gICAqIEBwYXJhbSB7QW55fSBbdGhpc0FyZ10gQW4gb2JqZWN0IHdoaWNoIHdpbGwgYmUgdGhlIHZhbHVlIG9mIGB0aGlzYCBpbnNpZGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdtYXAnLFxuXTtcblxuZXhwb3J0IGNvbnN0IENMSUVOVF9PTkxZX01FVEhPRFMgPSBbXCJmaW5kT25lXCIsIFwiaW5zZXJ0XCIsIFwicmVtb3ZlXCIsIFwidXBkYXRlXCIsIFwidXBzZXJ0XCJdO1xuIiwiaW1wb3J0IExvY2FsQ29sbGVjdGlvbiBmcm9tICcuL2xvY2FsX2NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgaGFzT3duIH0gZnJvbSAnLi9jb21tb24uanMnO1xuaW1wb3J0IHsgQVNZTkNfQ1VSU09SX01FVEhPRFMsIGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuLy8gQ3Vyc29yOiBhIHNwZWNpZmljYXRpb24gZm9yIGEgcGFydGljdWxhciBzdWJzZXQgb2YgZG9jdW1lbnRzLCB3LyBhIGRlZmluZWRcbi8vIG9yZGVyLCBsaW1pdCwgYW5kIG9mZnNldC4gIGNyZWF0aW5nIGEgQ3Vyc29yIHdpdGggTG9jYWxDb2xsZWN0aW9uLmZpbmQoKSxcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEN1cnNvciB7XG4gIC8vIGRvbid0IGNhbGwgdGhpcyBjdG9yIGRpcmVjdGx5LiAgdXNlIExvY2FsQ29sbGVjdGlvbi5maW5kKCkuXG4gIGNvbnN0cnVjdG9yKGNvbGxlY3Rpb24sIHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICAgIHRoaXMuc29ydGVyID0gbnVsbDtcbiAgICB0aGlzLm1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IpO1xuXG4gICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0KHNlbGVjdG9yKSkge1xuICAgICAgLy8gc3Rhc2ggZm9yIGZhc3QgX2lkIGFuZCB7IF9pZCB9XG4gICAgICB0aGlzLl9zZWxlY3RvcklkID0gaGFzT3duLmNhbGwoc2VsZWN0b3IsICdfaWQnKSA/IHNlbGVjdG9yLl9pZCA6IHNlbGVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zZWxlY3RvcklkID0gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAodGhpcy5tYXRjaGVyLmhhc0dlb1F1ZXJ5KCkgfHwgb3B0aW9ucy5zb3J0KSB7XG4gICAgICAgIHRoaXMuc29ydGVyID0gbmV3IE1pbmltb25nby5Tb3J0ZXIob3B0aW9ucy5zb3J0IHx8IFtdKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXAgPSBvcHRpb25zLnNraXAgfHwgMDtcbiAgICB0aGlzLmxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICB0aGlzLmZpZWxkcyA9IG9wdGlvbnMucHJvamVjdGlvbiB8fCBvcHRpb25zLmZpZWxkcztcblxuICAgIHRoaXMuX3Byb2plY3Rpb25GbiA9IExvY2FsQ29sbGVjdGlvbi5fY29tcGlsZVByb2plY3Rpb24odGhpcy5maWVsZHMgfHwge30pO1xuXG4gICAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0ob3B0aW9ucy50cmFuc2Zvcm0pO1xuXG4gICAgLy8gYnkgZGVmYXVsdCwgcXVlcmllcyByZWdpc3RlciB3LyBUcmFja2VyIHdoZW4gaXQgaXMgYXZhaWxhYmxlLlxuICAgIGlmICh0eXBlb2YgVHJhY2tlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMucmVhY3RpdmUgPSBvcHRpb25zLnJlYWN0aXZlID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy5yZWFjdGl2ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gMi45XG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdGhlIG51bWJlciBvZiBkb2N1bWVudHMgdGhhdCBtYXRjaCBhIHF1ZXJ5LiBUaGlzIG1ldGhvZCBpc1xuICAgKiAgICAgICAgICBbZGVwcmVjYXRlZCBzaW5jZSBNb25nb0RCIDQuMF0oaHR0cHM6Ly93d3cubW9uZ29kYi5jb20vZG9jcy92NC40L3JlZmVyZW5jZS9jb21tYW5kL2NvdW50Lyk7XG4gICAqICAgICAgICAgIHNlZSBgQ29sbGVjdGlvbi5jb3VudERvY3VtZW50c2AgYW5kXG4gICAqICAgICAgICAgIGBDb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnRgIGZvciBhIHJlcGxhY2VtZW50LlxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBtZXRob2QgIGNvdW50XG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge051bWJlcn1cbiAgICovXG4gIGNvdW50KCkge1xuICAgIGlmICh0aGlzLnJlYWN0aXZlKSB7XG4gICAgICAvLyBhbGxvdyB0aGUgb2JzZXJ2ZSB0byBiZSB1bm9yZGVyZWRcbiAgICAgIHRoaXMuX2RlcGVuZCh7IGFkZGVkOiB0cnVlLCByZW1vdmVkOiB0cnVlIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9nZXRSYXdPYmplY3RzKHtcbiAgICAgIG9yZGVyZWQ6IHRydWUsXG4gICAgfSkubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybiBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzIGFzIGFuIEFycmF5LlxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBtZXRob2QgIGZldGNoXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge09iamVjdFtdfVxuICAgKi9cbiAgZmV0Y2goKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICB0aGlzLmZvckVhY2goZG9jID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKGRvYyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgaWYgKHRoaXMucmVhY3RpdmUpIHtcbiAgICAgIHRoaXMuX2RlcGVuZCh7XG4gICAgICAgIGFkZGVkQmVmb3JlOiB0cnVlLFxuICAgICAgICByZW1vdmVkOiB0cnVlLFxuICAgICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgICAgICBtb3ZlZEJlZm9yZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3Qgb2JqZWN0cyA9IHRoaXMuX2dldFJhd09iamVjdHMoeyBvcmRlcmVkOiB0cnVlIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBUaGlzIGRvdWJsZXMgYXMgYSBjbG9uZSBvcGVyYXRpb24uXG4gICAgICAgICAgbGV0IGVsZW1lbnQgPSB0aGlzLl9wcm9qZWN0aW9uRm4ob2JqZWN0c1tpbmRleCsrXSk7XG5cbiAgICAgICAgICBpZiAodGhpcy5fdHJhbnNmb3JtKSBlbGVtZW50ID0gdGhpcy5fdHJhbnNmb3JtKGVsZW1lbnQpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IGVsZW1lbnQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGRvbmU6IHRydWUgfTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgY29uc3Qgc3luY1Jlc3VsdCA9IHRoaXNbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICAgIHJldHVybiB7XG4gICAgICBhc3luYyBuZXh0KCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN5bmNSZXN1bHQubmV4dCgpKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAY2FsbGJhY2sgSXRlcmF0aW9uQ2FsbGJhY2tcbiAgICogQHBhcmFtIHtPYmplY3R9IGRvY1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICovXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGBjYWxsYmFja2Agb25jZSBmb3IgZWFjaCBtYXRjaGluZyBkb2N1bWVudCwgc2VxdWVudGlhbGx5IGFuZFxuICAgKiAgICAgICAgICBzeW5jaHJvbm91c2x5LlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCAgZm9yRWFjaFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAcGFyYW0ge0l0ZXJhdGlvbkNhbGxiYWNrfSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIHRocmVlIGFyZ3VtZW50czogdGhlIGRvY3VtZW50LCBhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAtYmFzZWQgaW5kZXgsIGFuZCA8ZW0+Y3Vyc29yPC9lbT5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRzZWxmLlxuICAgKiBAcGFyYW0ge0FueX0gW3RoaXNBcmddIEFuIG9iamVjdCB3aGljaCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaW5zaWRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYGNhbGxiYWNrYC5cbiAgICovXG4gIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgdGhpcy5fZGVwZW5kKHtcbiAgICAgICAgYWRkZWRCZWZvcmU6IHRydWUsXG4gICAgICAgIHJlbW92ZWQ6IHRydWUsXG4gICAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgICAgIG1vdmVkQmVmb3JlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ2V0UmF3T2JqZWN0cyh7IG9yZGVyZWQ6IHRydWUgfSkuZm9yRWFjaCgoZWxlbWVudCwgaSkgPT4ge1xuICAgICAgLy8gVGhpcyBkb3VibGVzIGFzIGEgY2xvbmUgb3BlcmF0aW9uLlxuICAgICAgZWxlbWVudCA9IHRoaXMuX3Byb2plY3Rpb25GbihlbGVtZW50KTtcblxuICAgICAgaWYgKHRoaXMuX3RyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50ID0gdGhpcy5fdHJhbnNmb3JtKGVsZW1lbnQpO1xuICAgICAgfVxuXG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGVsZW1lbnQsIGksIHRoaXMpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0VHJhbnNmb3JtKCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm07XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgTWFwIGNhbGxiYWNrIG92ZXIgYWxsIG1hdGNoaW5nIGRvY3VtZW50cy4gIFJldHVybnMgYW4gQXJyYXkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIG1hcFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAcGFyYW0ge0l0ZXJhdGlvbkNhbGxiYWNrfSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIHRocmVlIGFyZ3VtZW50czogdGhlIGRvY3VtZW50LCBhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAtYmFzZWQgaW5kZXgsIGFuZCA8ZW0+Y3Vyc29yPC9lbT5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRzZWxmLlxuICAgKiBAcGFyYW0ge0FueX0gW3RoaXNBcmddIEFuIG9iamVjdCB3aGljaCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaW5zaWRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYGNhbGxiYWNrYC5cbiAgICovXG4gIG1hcChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgdGhpcy5mb3JFYWNoKChkb2MsIGkpID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKGNhbGxiYWNrLmNhbGwodGhpc0FyZywgZG9jLCBpLCB0aGlzKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gb3B0aW9ucyB0byBjb250YWluOlxuICAvLyAgKiBjYWxsYmFja3MgZm9yIG9ic2VydmUoKTpcbiAgLy8gICAgLSBhZGRlZEF0IChkb2N1bWVudCwgYXRJbmRleClcbiAgLy8gICAgLSBhZGRlZCAoZG9jdW1lbnQpXG4gIC8vICAgIC0gY2hhbmdlZEF0IChuZXdEb2N1bWVudCwgb2xkRG9jdW1lbnQsIGF0SW5kZXgpXG4gIC8vICAgIC0gY2hhbmdlZCAobmV3RG9jdW1lbnQsIG9sZERvY3VtZW50KVxuICAvLyAgICAtIHJlbW92ZWRBdCAoZG9jdW1lbnQsIGF0SW5kZXgpXG4gIC8vICAgIC0gcmVtb3ZlZCAoZG9jdW1lbnQpXG4gIC8vICAgIC0gbW92ZWRUbyAoZG9jdW1lbnQsIG9sZEluZGV4LCBuZXdJbmRleClcbiAgLy9cbiAgLy8gYXR0cmlidXRlcyBhdmFpbGFibGUgb24gcmV0dXJuZWQgcXVlcnkgaGFuZGxlOlxuICAvLyAgKiBzdG9wKCk6IGVuZCB1cGRhdGVzXG4gIC8vICAqIGNvbGxlY3Rpb246IHRoZSBjb2xsZWN0aW9uIHRoaXMgcXVlcnkgaXMgcXVlcnlpbmdcbiAgLy9cbiAgLy8gaWZmIHggaXMgYSByZXR1cm5lZCBxdWVyeSBoYW5kbGUsICh4IGluc3RhbmNlb2ZcbiAgLy8gTG9jYWxDb2xsZWN0aW9uLk9ic2VydmVIYW5kbGUpIGlzIHRydWVcbiAgLy9cbiAgLy8gaW5pdGlhbCByZXN1bHRzIGRlbGl2ZXJlZCB0aHJvdWdoIGFkZGVkIGNhbGxiYWNrXG4gIC8vIFhYWCBtYXliZSBjYWxsYmFja3Mgc2hvdWxkIHRha2UgYSBsaXN0IG9mIG9iamVjdHMsIHRvIGV4cG9zZSB0cmFuc2FjdGlvbnM/XG4gIC8vIFhYWCBtYXliZSBzdXBwb3J0IGZpZWxkIGxpbWl0aW5nICh0byBsaW1pdCB3aGF0IHlvdSdyZSBub3RpZmllZCBvbilcblxuICAvKipcbiAgICogQHN1bW1hcnkgV2F0Y2ggYSBxdWVyeS4gIFJlY2VpdmUgY2FsbGJhY2tzIGFzIHRoZSByZXN1bHQgc2V0IGNoYW5nZXMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2tzIEZ1bmN0aW9ucyB0byBjYWxsIHRvIGRlbGl2ZXIgdGhlIHJlc3VsdCBzZXQgYXMgaXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzXG4gICAqL1xuICBvYnNlcnZlKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzKHRoaXMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFdhdGNoIGEgcXVlcnkuICBSZWNlaXZlIGNhbGxiYWNrcyBhcyB0aGUgcmVzdWx0IHNldCBjaGFuZ2VzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIG9ic2VydmVBc3luYyhvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gcmVzb2x2ZSh0aGlzLm9ic2VydmUob3B0aW9ucykpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBXYXRjaCBhIHF1ZXJ5LiBSZWNlaXZlIGNhbGxiYWNrcyBhcyB0aGUgcmVzdWx0IHNldCBjaGFuZ2VzLiBPbmx5XG4gICAqICAgICAgICAgIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSBvbGQgYW5kIG5ldyBkb2N1bWVudHMgYXJlIHBhc3NlZCB0b1xuICAgKiAgICAgICAgICB0aGUgY2FsbGJhY2tzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGNhbGxiYWNrcyBGdW5jdGlvbnMgdG8gY2FsbCB0byBkZWxpdmVyIHRoZSByZXN1bHQgc2V0IGFzIGl0XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlc1xuICAgKi9cbiAgb2JzZXJ2ZUNoYW5nZXMob3B0aW9ucykge1xuICAgIGNvbnN0IG9yZGVyZWQgPSBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZChvcHRpb25zKTtcblxuICAgIC8vIHRoZXJlIGFyZSBzZXZlcmFsIHBsYWNlcyB0aGF0IGFzc3VtZSB5b3UgYXJlbid0IGNvbWJpbmluZyBza2lwL2xpbWl0IHdpdGhcbiAgICAvLyB1bm9yZGVyZWQgb2JzZXJ2ZS4gIGVnLCB1cGRhdGUncyBFSlNPTi5jbG9uZSwgYW5kIHRoZSBcInRoZXJlIGFyZSBzZXZlcmFsXCJcbiAgICAvLyBjb21tZW50IGluIF9tb2RpZnlBbmROb3RpZnlcbiAgICAvLyBYWFggYWxsb3cgc2tpcC9saW1pdCB3aXRoIHVub3JkZXJlZCBvYnNlcnZlXG4gICAgaWYgKCFvcHRpb25zLl9hbGxvd191bm9yZGVyZWQgJiYgIW9yZGVyZWQgJiYgKHRoaXMuc2tpcCB8fCB0aGlzLmxpbWl0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIk11c3QgdXNlIGFuIG9yZGVyZWQgb2JzZXJ2ZSB3aXRoIHNraXAgb3IgbGltaXQgKGkuZS4gJ2FkZGVkQmVmb3JlJyBcIiArXG4gICAgICAgICAgXCJmb3Igb2JzZXJ2ZUNoYW5nZXMgb3IgJ2FkZGVkQXQnIGZvciBvYnNlcnZlLCBpbnN0ZWFkIG9mICdhZGRlZCcpLlwiXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmZpZWxkcyAmJiAodGhpcy5maWVsZHMuX2lkID09PSAwIHx8IHRoaXMuZmllbGRzLl9pZCA9PT0gZmFsc2UpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIllvdSBtYXkgbm90IG9ic2VydmUgYSBjdXJzb3Igd2l0aCB7ZmllbGRzOiB7X2lkOiAwfX1cIik7XG4gICAgfVxuXG4gICAgY29uc3QgZGlzdGFuY2VzID1cbiAgICAgIHRoaXMubWF0Y2hlci5oYXNHZW9RdWVyeSgpICYmIG9yZGVyZWQgJiYgbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAoKTtcblxuICAgIGNvbnN0IHF1ZXJ5ID0ge1xuICAgICAgY3Vyc29yOiB0aGlzLFxuICAgICAgZGlydHk6IGZhbHNlLFxuICAgICAgZGlzdGFuY2VzLFxuICAgICAgbWF0Y2hlcjogdGhpcy5tYXRjaGVyLCAvLyBub3QgZmFzdCBwYXRoZWRcbiAgICAgIG9yZGVyZWQsXG4gICAgICBwcm9qZWN0aW9uRm46IHRoaXMuX3Byb2plY3Rpb25GbixcbiAgICAgIHJlc3VsdHNTbmFwc2hvdDogbnVsbCxcbiAgICAgIHNvcnRlcjogb3JkZXJlZCAmJiB0aGlzLnNvcnRlcixcbiAgICB9O1xuXG4gICAgbGV0IHFpZDtcblxuICAgIC8vIE5vbi1yZWFjdGl2ZSBxdWVyaWVzIGNhbGwgYWRkZWRbQmVmb3JlXSBhbmQgdGhlbiBuZXZlciBjYWxsIGFueXRoaW5nXG4gICAgLy8gZWxzZS5cbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgcWlkID0gdGhpcy5jb2xsZWN0aW9uLm5leHRfcWlkKys7XG4gICAgICB0aGlzLmNvbGxlY3Rpb24ucXVlcmllc1txaWRdID0gcXVlcnk7XG4gICAgfVxuXG4gICAgcXVlcnkucmVzdWx0cyA9IHRoaXMuX2dldFJhd09iamVjdHMoe1xuICAgICAgb3JkZXJlZCxcbiAgICAgIGRpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuY29sbGVjdGlvbi5wYXVzZWQpIHtcbiAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCA9IG9yZGVyZWQgPyBbXSA6IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwKCk7XG4gICAgfVxuXG4gICAgLy8gd3JhcCBjYWxsYmFja3Mgd2Ugd2VyZSBwYXNzZWQuIGNhbGxiYWNrcyBvbmx5IGZpcmUgd2hlbiBub3QgcGF1c2VkIGFuZFxuICAgIC8vIGFyZSBuZXZlciB1bmRlZmluZWRcbiAgICAvLyBGaWx0ZXJzIG91dCBibGFja2xpc3RlZCBmaWVsZHMgYWNjb3JkaW5nIHRvIGN1cnNvcidzIHByb2plY3Rpb24uXG4gICAgLy8gWFhYIHdyb25nIHBsYWNlIGZvciB0aGlzP1xuXG4gICAgLy8gZnVydGhlcm1vcmUsIGNhbGxiYWNrcyBlbnF1ZXVlIHVudGlsIHRoZSBvcGVyYXRpb24gd2UncmUgd29ya2luZyBvbiBpc1xuICAgIC8vIGRvbmUuXG4gICAgY29uc3Qgd3JhcENhbGxiYWNrID0gKGZuKSA9PiB7XG4gICAgICBpZiAoIWZuKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbiAoLyogYXJncyovKSB7XG4gICAgICAgIGlmIChzZWxmLmNvbGxlY3Rpb24ucGF1c2VkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICBzZWxmLmNvbGxlY3Rpb24uX29ic2VydmVRdWV1ZS5xdWV1ZVRhc2soKCkgPT4ge1xuICAgICAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgfTtcblxuICAgIHF1ZXJ5LmFkZGVkID0gd3JhcENhbGxiYWNrKG9wdGlvbnMuYWRkZWQpO1xuICAgIHF1ZXJ5LmNoYW5nZWQgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5jaGFuZ2VkKTtcbiAgICBxdWVyeS5yZW1vdmVkID0gd3JhcENhbGxiYWNrKG9wdGlvbnMucmVtb3ZlZCk7XG5cbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgcXVlcnkuYWRkZWRCZWZvcmUgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5hZGRlZEJlZm9yZSk7XG4gICAgICBxdWVyeS5tb3ZlZEJlZm9yZSA9IHdyYXBDYWxsYmFjayhvcHRpb25zLm1vdmVkQmVmb3JlKTtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuX3N1cHByZXNzX2luaXRpYWwgJiYgIXRoaXMuY29sbGVjdGlvbi5wYXVzZWQpIHtcbiAgICAgIGNvbnN0IGhhbmRsZXIgPSAoZG9jKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpZWxkcyA9IEVKU09OLmNsb25lKGRvYyk7XG5cbiAgICAgICAgZGVsZXRlIGZpZWxkcy5faWQ7XG5cbiAgICAgICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgICAgICBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCB0aGlzLl9wcm9qZWN0aW9uRm4oZmllbGRzKSwgbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBxdWVyeS5hZGRlZChkb2MuX2lkLCB0aGlzLl9wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gICAgICB9O1xuICAgICAgLy8gaXQgbWVhbnMgaXQncyBqdXN0IGFuIGFycmF5XG4gICAgICBpZiAocXVlcnkucmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBkb2Mgb2YgcXVlcnkucmVzdWx0cykge1xuICAgICAgICAgIGhhbmRsZXIoZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gaXQgbWVhbnMgaXQncyBhbiBpZCBtYXBcbiAgICAgIGlmIChxdWVyeS5yZXN1bHRzPy5zaXplPy4oKSkge1xuICAgICAgICBxdWVyeS5yZXN1bHRzLmZvckVhY2goaGFuZGxlcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaGFuZGxlID0gT2JqZWN0LmFzc2lnbihuZXcgTG9jYWxDb2xsZWN0aW9uLk9ic2VydmVIYW5kbGUoKSwge1xuICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uLFxuICAgICAgc3RvcDogKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxlY3Rpb24ucXVlcmllc1txaWRdO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaXNSZWFkeTogZmFsc2UsXG4gICAgICBpc1JlYWR5UHJvbWlzZTogbnVsbCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLnJlYWN0aXZlICYmIFRyYWNrZXIuYWN0aXZlKSB7XG4gICAgICAvLyBYWFggaW4gbWFueSBjYXNlcywgdGhlIHNhbWUgb2JzZXJ2ZSB3aWxsIGJlIHJlY3JlYXRlZCB3aGVuXG4gICAgICAvLyB0aGUgY3VycmVudCBhdXRvcnVuIGlzIHJlcnVuLiAgd2UgY291bGQgc2F2ZSB3b3JrIGJ5XG4gICAgICAvLyBsZXR0aW5nIGl0IGxpbmdlciBhY3Jvc3MgcmVydW4gYW5kIHBvdGVudGlhbGx5IGdldFxuICAgICAgLy8gcmVwdXJwb3NlZCBpZiB0aGUgc2FtZSBvYnNlcnZlIGlzIHBlcmZvcm1lZCwgdXNpbmcgbG9naWNcbiAgICAgIC8vIHNpbWlsYXIgdG8gdGhhdCBvZiBNZXRlb3Iuc3Vic2NyaWJlLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoKCkgPT4ge1xuICAgICAgICBoYW5kbGUuc3RvcCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gcnVuIHRoZSBvYnNlcnZlIGNhbGxiYWNrcyByZXN1bHRpbmcgZnJvbSB0aGUgaW5pdGlhbCBjb250ZW50c1xuICAgIC8vIGJlZm9yZSB3ZSBsZWF2ZSB0aGUgb2JzZXJ2ZS5cbiAgICBjb25zdCBkcmFpblJlc3VsdCA9IHRoaXMuY29sbGVjdGlvbi5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG5cbiAgICBpZiAoZHJhaW5SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICBoYW5kbGUuaXNSZWFkeVByb21pc2UgPSBkcmFpblJlc3VsdDtcbiAgICAgIGRyYWluUmVzdWx0LnRoZW4oKCkgPT4gKGhhbmRsZS5pc1JlYWR5ID0gdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGUuaXNSZWFkeSA9IHRydWU7XG4gICAgICBoYW5kbGUuaXNSZWFkeVByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFdhdGNoIGEgcXVlcnkuIFJlY2VpdmUgY2FsbGJhY2tzIGFzIHRoZSByZXN1bHQgc2V0IGNoYW5nZXMuIE9ubHlcbiAgICogICAgICAgICAgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIG9sZCBhbmQgbmV3IGRvY3VtZW50cyBhcmUgcGFzc2VkIHRvXG4gICAqICAgICAgICAgIHRoZSBjYWxsYmFja3MuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2tzIEZ1bmN0aW9ucyB0byBjYWxsIHRvIGRlbGl2ZXIgdGhlIHJlc3VsdCBzZXQgYXMgaXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzXG4gICAqL1xuICBvYnNlcnZlQ2hhbmdlc0FzeW5jKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGNvbnN0IGhhbmRsZSA9IHRoaXMub2JzZXJ2ZUNoYW5nZXMob3B0aW9ucyk7XG4gICAgICBoYW5kbGUuaXNSZWFkeVByb21pc2UudGhlbigoKSA9PiByZXNvbHZlKGhhbmRsZSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gWFhYIE1heWJlIHdlIG5lZWQgYSB2ZXJzaW9uIG9mIG9ic2VydmUgdGhhdCBqdXN0IGNhbGxzIGEgY2FsbGJhY2sgaWZcbiAgLy8gYW55dGhpbmcgY2hhbmdlZC5cbiAgX2RlcGVuZChjaGFuZ2VycywgX2FsbG93X3Vub3JkZXJlZCkge1xuICAgIGlmIChUcmFja2VyLmFjdGl2ZSkge1xuICAgICAgY29uc3QgZGVwZW5kZW5jeSA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcbiAgICAgIGNvbnN0IG5vdGlmeSA9IGRlcGVuZGVuY3kuY2hhbmdlZC5iaW5kKGRlcGVuZGVuY3kpO1xuXG4gICAgICBkZXBlbmRlbmN5LmRlcGVuZCgpO1xuXG4gICAgICBjb25zdCBvcHRpb25zID0geyBfYWxsb3dfdW5vcmRlcmVkLCBfc3VwcHJlc3NfaW5pdGlhbDogdHJ1ZSB9O1xuXG4gICAgICBbJ2FkZGVkJywgJ2FkZGVkQmVmb3JlJywgJ2NoYW5nZWQnLCAnbW92ZWRCZWZvcmUnLCAncmVtb3ZlZCddLmZvckVhY2goXG4gICAgICAgIGZuID0+IHtcbiAgICAgICAgICBpZiAoY2hhbmdlcnNbZm5dKSB7XG4gICAgICAgICAgICBvcHRpb25zW2ZuXSA9IG5vdGlmeTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIG9ic2VydmVDaGFuZ2VzIHdpbGwgc3RvcCgpIHdoZW4gdGhpcyBjb21wdXRhdGlvbiBpcyBpbnZhbGlkYXRlZFxuICAgICAgdGhpcy5vYnNlcnZlQ2hhbmdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0Q29sbGVjdGlvbk5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGNvbGxlY3Rpb24gb2YgbWF0Y2hpbmcgb2JqZWN0cywgYnV0IGRvZXNuJ3QgZGVlcCBjb3B5IHRoZW0uXG4gIC8vXG4gIC8vIElmIG9yZGVyZWQgaXMgc2V0LCByZXR1cm5zIGEgc29ydGVkIGFycmF5LCByZXNwZWN0aW5nIHNvcnRlciwgc2tpcCwgYW5kXG4gIC8vIGxpbWl0IHByb3BlcnRpZXMgb2YgdGhlIHF1ZXJ5IHByb3ZpZGVkIHRoYXQgb3B0aW9ucy5hcHBseVNraXBMaW1pdCBpc1xuICAvLyBub3Qgc2V0IHRvIGZhbHNlICgjMTIwMSkuIElmIHNvcnRlciBpcyBmYWxzZXksIG5vIHNvcnQgLS0geW91IGdldCB0aGVcbiAgLy8gbmF0dXJhbCBvcmRlci5cbiAgLy9cbiAgLy8gSWYgb3JkZXJlZCBpcyBub3Qgc2V0LCByZXR1cm5zIGFuIG9iamVjdCBtYXBwaW5nIGZyb20gSUQgdG8gZG9jIChzb3J0ZXIsXG4gIC8vIHNraXAgYW5kIGxpbWl0IHNob3VsZCBub3QgYmUgc2V0KS5cbiAgLy9cbiAgLy8gSWYgb3JkZXJlZCBpcyBzZXQgYW5kIHRoaXMgY3Vyc29yIGlzIGEgJG5lYXIgZ2VvcXVlcnksIHRoZW4gdGhpcyBmdW5jdGlvblxuICAvLyB3aWxsIHVzZSBhbiBfSWRNYXAgdG8gdHJhY2sgZWFjaCBkaXN0YW5jZSBmcm9tIHRoZSAkbmVhciBhcmd1bWVudCBwb2ludCBpblxuICAvLyBvcmRlciB0byB1c2UgaXQgYXMgYSBzb3J0IGtleS4gSWYgYW4gX0lkTWFwIGlzIHBhc3NlZCBpbiB0aGUgJ2Rpc3RhbmNlcydcbiAgLy8gYXJndW1lbnQsIHRoaXMgZnVuY3Rpb24gd2lsbCBjbGVhciBpdCBhbmQgdXNlIGl0IGZvciB0aGlzIHB1cnBvc2VcbiAgLy8gKG90aGVyd2lzZSBpdCB3aWxsIGp1c3QgY3JlYXRlIGl0cyBvd24gX0lkTWFwKS4gVGhlIG9ic2VydmVDaGFuZ2VzXG4gIC8vIGltcGxlbWVudGF0aW9uIHVzZXMgdGhpcyB0byByZW1lbWJlciB0aGUgZGlzdGFuY2VzIGFmdGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gcmV0dXJucy5cbiAgX2dldFJhd09iamVjdHMob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gQnkgZGVmYXVsdCB0aGlzIG1ldGhvZCB3aWxsIHJlc3BlY3Qgc2tpcCBhbmQgbGltaXQgYmVjYXVzZSAuZmV0Y2goKSxcbiAgICAvLyAuZm9yRWFjaCgpIGV0Yy4uLiBleHBlY3QgdGhpcyBiZWhhdmlvdXIuIEl0IGNhbiBiZSBmb3JjZWQgdG8gaWdub3JlXG4gICAgLy8gc2tpcCBhbmQgbGltaXQgYnkgc2V0dGluZyBhcHBseVNraXBMaW1pdCB0byBmYWxzZSAoLmNvdW50KCkgZG9lcyB0aGlzLFxuICAgIC8vIGZvciBleGFtcGxlKVxuICAgIGNvbnN0IGFwcGx5U2tpcExpbWl0ID0gb3B0aW9ucy5hcHBseVNraXBMaW1pdCAhPT0gZmFsc2U7XG5cbiAgICAvLyBYWFggdXNlIE9yZGVyZWREaWN0IGluc3RlYWQgb2YgYXJyYXksIGFuZCBtYWtlIElkTWFwIGFuZCBPcmRlcmVkRGljdFxuICAgIC8vIGNvbXBhdGlibGVcbiAgICBjb25zdCByZXN1bHRzID0gb3B0aW9ucy5vcmRlcmVkID8gW10gOiBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCgpO1xuXG4gICAgLy8gZmFzdCBwYXRoIGZvciBzaW5nbGUgSUQgdmFsdWVcbiAgICBpZiAodGhpcy5fc2VsZWN0b3JJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBJZiB5b3UgaGF2ZSBub24temVybyBza2lwIGFuZCBhc2sgZm9yIGEgc2luZ2xlIGlkLCB5b3UgZ2V0IG5vdGhpbmcuXG4gICAgICAvLyBUaGlzIGlzIHNvIGl0IG1hdGNoZXMgdGhlIGJlaGF2aW9yIG9mIHRoZSAne19pZDogZm9vfScgcGF0aC5cbiAgICAgIGlmIChhcHBseVNraXBMaW1pdCAmJiB0aGlzLnNraXApIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNlbGVjdGVkRG9jID0gdGhpcy5jb2xsZWN0aW9uLl9kb2NzLmdldCh0aGlzLl9zZWxlY3RvcklkKTtcbiAgICAgIGlmIChzZWxlY3RlZERvYykge1xuICAgICAgICBpZiAob3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKHNlbGVjdGVkRG9jKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRzLnNldCh0aGlzLl9zZWxlY3RvcklkLCBzZWxlY3RlZERvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8vIHNsb3cgcGF0aCBmb3IgYXJiaXRyYXJ5IHNlbGVjdG9yLCBzb3J0LCBza2lwLCBsaW1pdFxuXG4gICAgLy8gaW4gdGhlIG9ic2VydmVDaGFuZ2VzIGNhc2UsIGRpc3RhbmNlcyBpcyBhY3R1YWxseSBwYXJ0IG9mIHRoZSBcInF1ZXJ5XCJcbiAgICAvLyAoaWUsIGxpdmUgcmVzdWx0cyBzZXQpIG9iamVjdC4gIGluIG90aGVyIGNhc2VzLCBkaXN0YW5jZXMgaXMgb25seSB1c2VkXG4gICAgLy8gaW5zaWRlIHRoaXMgZnVuY3Rpb24uXG4gICAgbGV0IGRpc3RhbmNlcztcbiAgICBpZiAodGhpcy5tYXRjaGVyLmhhc0dlb1F1ZXJ5KCkgJiYgb3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgICBpZiAob3B0aW9ucy5kaXN0YW5jZXMpIHtcbiAgICAgICAgZGlzdGFuY2VzID0gb3B0aW9ucy5kaXN0YW5jZXM7XG4gICAgICAgIGRpc3RhbmNlcy5jbGVhcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlzdGFuY2VzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb2xsZWN0aW9uLl9kb2NzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgIGNvbnN0IG1hdGNoUmVzdWx0ID0gdGhpcy5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuICAgICAgaWYgKG1hdGNoUmVzdWx0LnJlc3VsdCkge1xuICAgICAgICBpZiAob3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKGRvYyk7XG5cbiAgICAgICAgICBpZiAoZGlzdGFuY2VzICYmIG1hdGNoUmVzdWx0LmRpc3RhbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGRpc3RhbmNlcy5zZXQoaWQsIG1hdGNoUmVzdWx0LmRpc3RhbmNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0cy5zZXQoaWQsIGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gT3ZlcnJpZGUgdG8gZW5zdXJlIGFsbCBkb2NzIGFyZSBtYXRjaGVkIGlmIGlnbm9yaW5nIHNraXAgJiBsaW1pdFxuICAgICAgaWYgKCFhcHBseVNraXBMaW1pdCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gRmFzdCBwYXRoIGZvciBsaW1pdGVkIHVuc29ydGVkIHF1ZXJpZXMuXG4gICAgICAvLyBYWFggJ2xlbmd0aCcgY2hlY2sgaGVyZSBzZWVtcyB3cm9uZyBmb3Igb3JkZXJlZFxuICAgICAgcmV0dXJuIChcbiAgICAgICAgIXRoaXMubGltaXQgfHwgdGhpcy5za2lwIHx8IHRoaXMuc29ydGVyIHx8IHJlc3VsdHMubGVuZ3RoICE9PSB0aGlzLmxpbWl0XG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgaWYgKCFvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNvcnRlcikge1xuICAgICAgcmVzdWx0cy5zb3J0KHRoaXMuc29ydGVyLmdldENvbXBhcmF0b3IoeyBkaXN0YW5jZXMgfSkpO1xuICAgIH1cblxuICAgIC8vIFJldHVybiB0aGUgZnVsbCBzZXQgb2YgcmVzdWx0cyBpZiB0aGVyZSBpcyBubyBza2lwIG9yIGxpbWl0IG9yIGlmIHdlJ3JlXG4gICAgLy8gaWdub3JpbmcgdGhlbVxuICAgIGlmICghYXBwbHlTa2lwTGltaXQgfHwgKCF0aGlzLmxpbWl0ICYmICF0aGlzLnNraXApKSB7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cy5zbGljZShcbiAgICAgIHRoaXMuc2tpcCxcbiAgICAgIHRoaXMubGltaXQgPyB0aGlzLmxpbWl0ICsgdGhpcy5za2lwIDogcmVzdWx0cy5sZW5ndGhcbiAgICApO1xuICB9XG5cbiAgX3B1Ymxpc2hDdXJzb3Ioc3Vic2NyaXB0aW9uKSB7XG4gICAgLy8gWFhYIG1pbmltb25nbyBzaG91bGQgbm90IGRlcGVuZCBvbiBtb25nby1saXZlZGF0YSFcbiAgICBpZiAoIVBhY2thZ2UubW9uZ28pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJDYW4ndCBwdWJsaXNoIGZyb20gTWluaW1vbmdvIHdpdGhvdXQgdGhlIGBtb25nb2AgcGFja2FnZS5cIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuY29sbGVjdGlvbi5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiQ2FuJ3QgcHVibGlzaCBhIGN1cnNvciBmcm9tIGEgY29sbGVjdGlvbiB3aXRob3V0IGEgbmFtZS5cIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gUGFja2FnZS5tb25nby5Nb25nby5Db2xsZWN0aW9uLl9wdWJsaXNoQ3Vyc29yKFxuICAgICAgdGhpcyxcbiAgICAgIHN1YnNjcmlwdGlvbixcbiAgICAgIHRoaXMuY29sbGVjdGlvbi5uYW1lXG4gICAgKTtcbiAgfVxufVxuXG4vLyBJbXBsZW1lbnRzIGFzeW5jIHZlcnNpb24gb2YgY3Vyc29yIG1ldGhvZHMgdG8ga2VlcCBjb2xsZWN0aW9ucyBpc29tb3JwaGljXG5BU1lOQ19DVVJTT1JfTUVUSE9EUy5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gIGNvbnN0IGFzeW5jTmFtZSA9IGdldEFzeW5jTWV0aG9kTmFtZShtZXRob2QpO1xuICBDdXJzb3IucHJvdG90eXBlW2FzeW5jTmFtZV0gPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpc1ttZXRob2RdLmFwcGx5KHRoaXMsIGFyZ3MpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICB9XG4gIH07XG59KTtcbiIsImltcG9ydCBDdXJzb3IgZnJvbSAnLi9jdXJzb3IuanMnO1xuaW1wb3J0IE9ic2VydmVIYW5kbGUgZnJvbSAnLi9vYnNlcnZlX2hhbmRsZS5qcyc7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIGlzSW5kZXhhYmxlLFxuICBpc051bWVyaWNLZXksXG4gIGlzT3BlcmF0b3JPYmplY3QsXG4gIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMsXG4gIHByb2plY3Rpb25EZXRhaWxzLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbmltcG9ydCB7IGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuLy8gWFhYIHR5cGUgY2hlY2tpbmcgb24gc2VsZWN0b3JzIChncmFjZWZ1bCBlcnJvciBpZiBtYWxmb3JtZWQpXG5cbi8vIExvY2FsQ29sbGVjdGlvbjogYSBzZXQgb2YgZG9jdW1lbnRzIHRoYXQgc3VwcG9ydHMgcXVlcmllcyBhbmQgbW9kaWZpZXJzLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTG9jYWxDb2xsZWN0aW9uIHtcbiAgY29uc3RydWN0b3IobmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgLy8gX2lkIC0+IGRvY3VtZW50IChhbHNvIGNvbnRhaW5pbmcgaWQpXG4gICAgdGhpcy5fZG9jcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuXG4gICAgdGhpcy5fb2JzZXJ2ZVF1ZXVlID0gTWV0ZW9yLmlzQ2xpZW50XG4gICAgICA/IG5ldyBNZXRlb3IuX1N5bmNocm9ub3VzUXVldWUoKVxuICAgICAgOiBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuXG4gICAgdGhpcy5uZXh0X3FpZCA9IDE7IC8vIGxpdmUgcXVlcnkgaWQgZ2VuZXJhdG9yXG5cbiAgICAvLyBxaWQgLT4gbGl2ZSBxdWVyeSBvYmplY3QuIGtleXM6XG4gICAgLy8gIG9yZGVyZWQ6IGJvb2wuIG9yZGVyZWQgcXVlcmllcyBoYXZlIGFkZGVkQmVmb3JlL21vdmVkQmVmb3JlIGNhbGxiYWNrcy5cbiAgICAvLyAgcmVzdWx0czogYXJyYXkgKG9yZGVyZWQpIG9yIG9iamVjdCAodW5vcmRlcmVkKSBvZiBjdXJyZW50IHJlc3VsdHNcbiAgICAvLyAgICAoYWxpYXNlZCB3aXRoIHRoaXMuX2RvY3MhKVxuICAgIC8vICByZXN1bHRzU25hcHNob3Q6IHNuYXBzaG90IG9mIHJlc3VsdHMuIG51bGwgaWYgbm90IHBhdXNlZC5cbiAgICAvLyAgY3Vyc29yOiBDdXJzb3Igb2JqZWN0IGZvciB0aGUgcXVlcnkuXG4gICAgLy8gIHNlbGVjdG9yLCBzb3J0ZXIsIChjYWxsYmFja3MpOiBmdW5jdGlvbnNcbiAgICB0aGlzLnF1ZXJpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgLy8gbnVsbCBpZiBub3Qgc2F2aW5nIG9yaWdpbmFsczsgYW4gSWRNYXAgZnJvbSBpZCB0byBvcmlnaW5hbCBkb2N1bWVudCB2YWx1ZVxuICAgIC8vIGlmIHNhdmluZyBvcmlnaW5hbHMuIFNlZSBjb21tZW50cyBiZWZvcmUgc2F2ZU9yaWdpbmFscygpLlxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzID0gbnVsbDtcblxuICAgIC8vIFRydWUgd2hlbiBvYnNlcnZlcnMgYXJlIHBhdXNlZCBhbmQgd2Ugc2hvdWxkIG5vdCBzZW5kIGNhbGxiYWNrcy5cbiAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuICB9XG5cbiAgY291bnREb2N1bWVudHMoc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5maW5kKHNlbGVjdG9yID8/IHt9LCBvcHRpb25zKS5jb3VudEFzeW5jKCk7XG4gIH1cblxuICBlc3RpbWF0ZWREb2N1bWVudENvdW50KG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5maW5kKHt9LCBvcHRpb25zKS5jb3VudEFzeW5jKCk7XG4gIH1cblxuICAvLyBvcHRpb25zIG1heSBpbmNsdWRlIHNvcnQsIHNraXAsIGxpbWl0LCByZWFjdGl2ZVxuICAvLyBzb3J0IG1heSBiZSBhbnkgb2YgdGhlc2UgZm9ybXM6XG4gIC8vICAgICB7YTogMSwgYjogLTF9XG4gIC8vICAgICBbW1wiYVwiLCBcImFzY1wiXSwgW1wiYlwiLCBcImRlc2NcIl1dXG4gIC8vICAgICBbXCJhXCIsIFtcImJcIiwgXCJkZXNjXCJdXVxuICAvLyAgIChpbiB0aGUgZmlyc3QgZm9ybSB5b3UncmUgYmVob2xkZW4gdG8ga2V5IGVudW1lcmF0aW9uIG9yZGVyIGluXG4gIC8vICAgeW91ciBqYXZhc2NyaXB0IFZNKVxuICAvL1xuICAvLyByZWFjdGl2ZTogaWYgZ2l2ZW4sIGFuZCBmYWxzZSwgZG9uJ3QgcmVnaXN0ZXIgd2l0aCBUcmFja2VyIChkZWZhdWx0XG4gIC8vIGlzIHRydWUpXG4gIC8vXG4gIC8vIFhYWCBwb3NzaWJseSBzaG91bGQgc3VwcG9ydCByZXRyaWV2aW5nIGEgc3Vic2V0IG9mIGZpZWxkcz8gYW5kXG4gIC8vIGhhdmUgaXQgYmUgYSBoaW50IChpZ25vcmVkIG9uIHRoZSBjbGllbnQsIHdoZW4gbm90IGNvcHlpbmcgdGhlXG4gIC8vIGRvYz8pXG4gIC8vXG4gIC8vIFhYWCBzb3J0IGRvZXMgbm90IHlldCBzdXBwb3J0IHN1YmtleXMgKCdhLmInKSAuLiBmaXggdGhhdCFcbiAgLy8gWFhYIGFkZCBvbmUgbW9yZSBzb3J0IGZvcm06IFwia2V5XCJcbiAgLy8gWFhYIHRlc3RzXG4gIGZpbmQoc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgICAvLyBkZWZhdWx0IHN5bnRheCBmb3IgZXZlcnl0aGluZyBpcyB0byBvbWl0IHRoZSBzZWxlY3RvciBhcmd1bWVudC5cbiAgICAvLyBidXQgaWYgc2VsZWN0b3IgaXMgZXhwbGljaXRseSBwYXNzZWQgaW4gYXMgZmFsc2Ugb3IgdW5kZWZpbmVkLCB3ZVxuICAgIC8vIHdhbnQgYSBzZWxlY3RvciB0aGF0IG1hdGNoZXMgbm90aGluZy5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc2VsZWN0b3IgPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IExvY2FsQ29sbGVjdGlvbi5DdXJzb3IodGhpcywgc2VsZWN0b3IsIG9wdGlvbnMpO1xuICB9XG5cbiAgZmluZE9uZShzZWxlY3Rvciwgb3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHNlbGVjdG9yID0ge307XG4gICAgfVxuXG4gICAgLy8gTk9URTogYnkgc2V0dGluZyBsaW1pdCAxIGhlcmUsIHdlIGVuZCB1cCB1c2luZyB2ZXJ5IGluZWZmaWNpZW50XG4gICAgLy8gY29kZSB0aGF0IHJlY29tcHV0ZXMgdGhlIHdob2xlIHF1ZXJ5IG9uIGVhY2ggdXBkYXRlLiBUaGUgdXBzaWRlIGlzXG4gICAgLy8gdGhhdCB3aGVuIHlvdSByZWFjdGl2ZWx5IGRlcGVuZCBvbiBhIGZpbmRPbmUgeW91IG9ubHkgZ2V0XG4gICAgLy8gaW52YWxpZGF0ZWQgd2hlbiB0aGUgZm91bmQgb2JqZWN0IGNoYW5nZXMsIG5vdCBhbnkgb2JqZWN0IGluIHRoZVxuICAgIC8vIGNvbGxlY3Rpb24uIE1vc3QgZmluZE9uZSB3aWxsIGJlIGJ5IGlkLCB3aGljaCBoYXMgYSBmYXN0IHBhdGgsIHNvXG4gICAgLy8gdGhpcyBtaWdodCBub3QgYmUgYSBiaWcgZGVhbC4gSW4gbW9zdCBjYXNlcywgaW52YWxpZGF0aW9uIGNhdXNlc1xuICAgIC8vIHRoZSBjYWxsZWQgdG8gcmUtcXVlcnkgYW55d2F5LCBzbyB0aGlzIHNob3VsZCBiZSBhIG5ldCBwZXJmb3JtYW5jZVxuICAgIC8vIGltcHJvdmVtZW50LlxuICAgIG9wdGlvbnMubGltaXQgPSAxO1xuXG4gICAgcmV0dXJuIHRoaXMuZmluZChzZWxlY3Rvciwgb3B0aW9ucykuZmV0Y2goKVswXTtcbiAgfVxuICBhc3luYyBmaW5kT25lQXN5bmMoc2VsZWN0b3IsIG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxlY3RvciA9IHt9O1xuICAgIH1cbiAgICBvcHRpb25zLmxpbWl0ID0gMTtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuZmluZChzZWxlY3Rvciwgb3B0aW9ucykuZmV0Y2hBc3luYygpKVswXTtcbiAgfVxuICBwcmVwYXJlSW5zZXJ0KGRvYykge1xuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhkb2MpO1xuXG4gICAgLy8gaWYgeW91IHJlYWxseSB3YW50IHRvIHVzZSBPYmplY3RJRHMsIHNldCB0aGlzIGdsb2JhbC5cbiAgICAvLyBNb25nby5Db2xsZWN0aW9uIHNwZWNpZmllcyBpdHMgb3duIGlkcyBhbmQgZG9lcyBub3QgdXNlIHRoaXMgY29kZS5cbiAgICBpZiAoIWhhc093bi5jYWxsKGRvYywgJ19pZCcpKSB7XG4gICAgICBkb2MuX2lkID0gTG9jYWxDb2xsZWN0aW9uLl91c2VPSUQgPyBuZXcgTW9uZ29JRC5PYmplY3RJRCgpIDogUmFuZG9tLmlkKCk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBkb2MuX2lkO1xuXG4gICAgaWYgKHRoaXMuX2RvY3MuaGFzKGlkKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoYER1cGxpY2F0ZSBfaWQgJyR7aWR9J2ApO1xuICAgIH1cblxuICAgIHRoaXMuX3NhdmVPcmlnaW5hbChpZCwgdW5kZWZpbmVkKTtcbiAgICB0aGlzLl9kb2NzLnNldChpZCwgZG9jKTtcblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIC8vIFhYWCBwb3NzaWJseSBlbmZvcmNlIHRoYXQgJ3VuZGVmaW5lZCcgZG9lcyBub3QgYXBwZWFyICh3ZSBhc3N1bWVcbiAgLy8gdGhpcyBpbiBvdXIgaGFuZGxpbmcgb2YgbnVsbCBhbmQgJGV4aXN0cylcbiAgaW5zZXJ0KGRvYywgY2FsbGJhY2spIHtcbiAgICBkb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIGNvbnN0IGlkID0gdGhpcy5wcmVwYXJlSW5zZXJ0KGRvYyk7XG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG5cbiAgICAvLyB0cmlnZ2VyIGxpdmUgcXVlcmllcyB0aGF0IG1hdGNoXG4gICAgZm9yIChjb25zdCBxaWQgb2YgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaFJlc3VsdCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChtYXRjaFJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcyAmJiBtYXRjaFJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5wdXNoKHFpZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNTeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGlmICh0aGlzLnF1ZXJpZXNbcWlkXSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHRoaXMucXVlcmllc1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgaWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFzeW5jIGluc2VydEFzeW5jKGRvYywgY2FsbGJhY2spIHtcbiAgICBkb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIGNvbnN0IGlkID0gdGhpcy5wcmVwYXJlSW5zZXJ0KGRvYyk7XG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG5cbiAgICAvLyB0cmlnZ2VyIGxpdmUgcXVlcmllcyB0aGF0IG1hdGNoXG4gICAgZm9yIChjb25zdCBxaWQgb2YgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaFJlc3VsdCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChtYXRjaFJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcyAmJiBtYXRjaFJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5wdXNoKHFpZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNBc3luYyhxdWVyeSwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBpZiAodGhpcy5xdWVyaWVzW3FpZF0pIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyh0aGlzLnF1ZXJpZXNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGlkKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIC8vIFBhdXNlIHRoZSBvYnNlcnZlcnMuIE5vIGNhbGxiYWNrcyBmcm9tIG9ic2VydmVycyB3aWxsIGZpcmUgdW50aWxcbiAgLy8gJ3Jlc3VtZU9ic2VydmVycycgaXMgY2FsbGVkLlxuICBwYXVzZU9ic2VydmVycygpIHtcbiAgICAvLyBOby1vcCBpZiBhbHJlYWR5IHBhdXNlZC5cbiAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlICdwYXVzZWQnIGZsYWcgc3VjaCB0aGF0IG5ldyBvYnNlcnZlciBtZXNzYWdlcyBkb24ndCBmaXJlLlxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcblxuICAgIC8vIFRha2UgYSBzbmFwc2hvdCBvZiB0aGUgcXVlcnkgcmVzdWx0cyBmb3IgZWFjaCBxdWVyeS5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG4gICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QgPSBFSlNPTi5jbG9uZShxdWVyeS5yZXN1bHRzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyUmVzdWx0UXVlcmllcyhjYWxsYmFjaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2RvY3Muc2l6ZSgpO1xuXG4gICAgdGhpcy5fZG9jcy5jbGVhcigpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgICAgICBxdWVyeS5yZXN1bHRzID0gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBxdWVyeS5yZXN1bHRzLmNsZWFyKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cblxuICBwcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3Rvcik7XG4gICAgY29uc3QgcmVtb3ZlID0gW107XG5cbiAgICB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIChkb2MsIGlkKSA9PiB7XG4gICAgICBpZiAobWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKS5yZXN1bHQpIHtcbiAgICAgICAgcmVtb3ZlLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG4gICAgY29uc3QgcXVlcnlSZW1vdmUgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZW1vdmVJZCA9IHJlbW92ZVtpXTtcbiAgICAgIGNvbnN0IHJlbW92ZURvYyA9IHRoaXMuX2RvY3MuZ2V0KHJlbW92ZUlkKTtcblxuICAgICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKHJlbW92ZURvYykucmVzdWx0KSB7XG4gICAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgICAgcXVlcmllc1RvUmVjb21wdXRlLnB1c2gocWlkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcXVlcnlSZW1vdmUucHVzaCh7cWlkLCBkb2M6IHJlbW92ZURvY30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbChyZW1vdmVJZCwgcmVtb3ZlRG9jKTtcbiAgICAgIHRoaXMuX2RvY3MucmVtb3ZlKHJlbW92ZUlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBxdWVyaWVzVG9SZWNvbXB1dGUsIHF1ZXJ5UmVtb3ZlLCByZW1vdmUgfTtcbiAgfVxuXG4gIHJlbW92ZShzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAvLyBFYXN5IHNwZWNpYWwgY2FzZTogaWYgd2UncmUgbm90IGNhbGxpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIGFuZFxuICAgIC8vIHdlJ3JlIG5vdCBzYXZpbmcgb3JpZ2luYWxzIGFuZCB3ZSBnb3QgYXNrZWQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcsIHRoZW5cbiAgICAvLyBqdXN0IGVtcHR5IGV2ZXJ5dGhpbmcgZGlyZWN0bHkuXG4gICAgaWYgKHRoaXMucGF1c2VkICYmICF0aGlzLl9zYXZlZE9yaWdpbmFscyAmJiBFSlNPTi5lcXVhbHMoc2VsZWN0b3IsIHt9KSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9ID0gdGhpcy5wcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKTtcblxuICAgIC8vIHJ1biBsaXZlIHF1ZXJ5IGNhbGxiYWNrcyBfYWZ0ZXJfIHdlJ3ZlIHJlbW92ZWQgdGhlIGRvY3VtZW50cy5cbiAgICBxdWVyeVJlbW92ZS5mb3JFYWNoKHJlbW92ZSA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1tyZW1vdmUucWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcyAmJiBxdWVyeS5kaXN0YW5jZXMucmVtb3ZlKHJlbW92ZS5kb2MuX2lkKTtcbiAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMocXVlcnksIHJlbW92ZS5kb2MpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gcmVtb3ZlLmxlbmd0aDtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBhc3luYyByZW1vdmVBc3luYyhzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAvLyBFYXN5IHNwZWNpYWwgY2FzZTogaWYgd2UncmUgbm90IGNhbGxpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIGFuZFxuICAgIC8vIHdlJ3JlIG5vdCBzYXZpbmcgb3JpZ2luYWxzIGFuZCB3ZSBnb3QgYXNrZWQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcsIHRoZW5cbiAgICAvLyBqdXN0IGVtcHR5IGV2ZXJ5dGhpbmcgZGlyZWN0bHkuXG4gICAgaWYgKHRoaXMucGF1c2VkICYmICF0aGlzLl9zYXZlZE9yaWdpbmFscyAmJiBFSlNPTi5lcXVhbHMoc2VsZWN0b3IsIHt9KSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9ID0gdGhpcy5wcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKTtcblxuICAgIC8vIHJ1biBsaXZlIHF1ZXJ5IGNhbGxiYWNrcyBfYWZ0ZXJfIHdlJ3ZlIHJlbW92ZWQgdGhlIGRvY3VtZW50cy5cbiAgICBmb3IgKGNvbnN0IHJlbW92ZSBvZiBxdWVyeVJlbW92ZSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcmVtb3ZlLnFpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICBxdWVyeS5kaXN0YW5jZXMgJiYgcXVlcnkuZGlzdGFuY2VzLnJlbW92ZShyZW1vdmUuZG9jLl9pZCk7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNBc3luYyhxdWVyeSwgcmVtb3ZlLmRvYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyhxdWVyeSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbW92ZS5sZW5ndGg7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gUmVzdW1lIHRoZSBvYnNlcnZlcnMuIE9ic2VydmVycyBpbW1lZGlhdGVseSByZWNlaXZlIGNoYW5nZVxuICAvLyBub3RpZmljYXRpb25zIHRvIGJyaW5nIHRoZW0gdG8gdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlXG4gIC8vIGRhdGFiYXNlLiBOb3RlIHRoYXQgdGhpcyBpcyBub3QganVzdCByZXBsYXlpbmcgYWxsIHRoZSBjaGFuZ2VzIHRoYXRcbiAgLy8gaGFwcGVuZWQgZHVyaW5nIHRoZSBwYXVzZSwgaXQgaXMgYSBzbWFydGVyICdjb2FsZXNjZWQnIGRpZmYuXG4gIF9yZXN1bWVPYnNlcnZlcnMoKSB7XG4gICAgLy8gTm8tb3AgaWYgbm90IHBhdXNlZC5cbiAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVW5zZXQgdGhlICdwYXVzZWQnIGZsYWcuIE1ha2Ugc3VyZSB0byBkbyB0aGlzIGZpcnN0LCBvdGhlcndpc2VcbiAgICAvLyBvYnNlcnZlciBtZXRob2RzIHdvbid0IGFjdHVhbGx5IGZpcmUgd2hlbiB3ZSB0cmlnZ2VyIHRoZW0uXG4gICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIHF1ZXJ5LmRpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgLy8gcmUtY29tcHV0ZSByZXN1bHRzIHdpbGwgcGVyZm9ybSBgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzYFxuICAgICAgICAvLyBhdXRvbWF0aWNhbGx5LlxuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxdWVyeS5yZXN1bHRzU25hcHNob3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGlmZiB0aGUgY3VycmVudCByZXN1bHRzIGFnYWluc3QgdGhlIHNuYXBzaG90IGFuZCBzZW5kIHRvIG9ic2VydmVycy5cbiAgICAgICAgLy8gcGFzcyB0aGUgcXVlcnkgb2JqZWN0IGZvciBpdHMgb2JzZXJ2ZXIgY2FsbGJhY2tzLlxuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXMoXG4gICAgICAgICAgcXVlcnkub3JkZXJlZCxcbiAgICAgICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QsXG4gICAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICB7cHJvamVjdGlvbkZuOiBxdWVyeS5wcm9qZWN0aW9uRm59XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyByZXN1bWVPYnNlcnZlcnNTZXJ2ZXIoKSB7XG4gICAgdGhpcy5fcmVzdW1lT2JzZXJ2ZXJzKCk7XG4gICAgYXdhaXQgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG4gIH1cbiAgcmVzdW1lT2JzZXJ2ZXJzQ2xpZW50KCkge1xuICAgIHRoaXMuX3Jlc3VtZU9ic2VydmVycygpO1xuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuICB9XG5cbiAgcmV0cmlldmVPcmlnaW5hbHMoKSB7XG4gICAgaWYgKCF0aGlzLl9zYXZlZE9yaWdpbmFscykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWxsZWQgcmV0cmlldmVPcmlnaW5hbHMgd2l0aG91dCBzYXZlT3JpZ2luYWxzJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JpZ2luYWxzID0gdGhpcy5fc2F2ZWRPcmlnaW5hbHM7XG5cbiAgICB0aGlzLl9zYXZlZE9yaWdpbmFscyA9IG51bGw7XG5cbiAgICByZXR1cm4gb3JpZ2luYWxzO1xuICB9XG5cbiAgLy8gVG8gdHJhY2sgd2hhdCBkb2N1bWVudHMgYXJlIGFmZmVjdGVkIGJ5IGEgcGllY2Ugb2YgY29kZSwgY2FsbFxuICAvLyBzYXZlT3JpZ2luYWxzKCkgYmVmb3JlIGl0IGFuZCByZXRyaWV2ZU9yaWdpbmFscygpIGFmdGVyIGl0LlxuICAvLyByZXRyaWV2ZU9yaWdpbmFscyByZXR1cm5zIGFuIG9iamVjdCB3aG9zZSBrZXlzIGFyZSB0aGUgaWRzIG9mIHRoZSBkb2N1bWVudHNcbiAgLy8gdGhhdCB3ZXJlIGFmZmVjdGVkIHNpbmNlIHRoZSBjYWxsIHRvIHNhdmVPcmlnaW5hbHMoKSwgYW5kIHRoZSB2YWx1ZXMgYXJlXG4gIC8vIGVxdWFsIHRvIHRoZSBkb2N1bWVudCdzIGNvbnRlbnRzIGF0IHRoZSB0aW1lIG9mIHNhdmVPcmlnaW5hbHMuIChJbiB0aGUgY2FzZVxuICAvLyBvZiBhbiBpbnNlcnRlZCBkb2N1bWVudCwgdW5kZWZpbmVkIGlzIHRoZSB2YWx1ZS4pIFlvdSBtdXN0IGFsdGVybmF0ZVxuICAvLyBiZXR3ZWVuIGNhbGxzIHRvIHNhdmVPcmlnaW5hbHMoKSBhbmQgcmV0cmlldmVPcmlnaW5hbHMoKS5cbiAgc2F2ZU9yaWdpbmFscygpIHtcbiAgICBpZiAodGhpcy5fc2F2ZWRPcmlnaW5hbHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FsbGVkIHNhdmVPcmlnaW5hbHMgdHdpY2Ugd2l0aG91dCByZXRyaWV2ZU9yaWdpbmFscycpO1xuICAgIH1cblxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH1cblxuICBwcmVwYXJlVXBkYXRlKHNlbGVjdG9yKSB7XG4gICAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgcmVzdWx0cyBvZiBhbnkgcXVlcnkgdGhhdCB3ZSBtaWdodCBuZWVkIHRvXG4gICAgLy8gX3JlY29tcHV0ZVJlc3VsdHMgb24sIGJlY2F1c2UgX21vZGlmeUFuZE5vdGlmeSB3aWxsIG11dGF0ZSB0aGUgb2JqZWN0cyBpblxuICAgIC8vIGl0LiAoV2UgZG9uJ3QgbmVlZCB0byBzYXZlIHRoZSBvcmlnaW5hbCByZXN1bHRzIG9mIHBhdXNlZCBxdWVyaWVzIGJlY2F1c2VcbiAgICAvLyB0aGV5IGFscmVhZHkgaGF2ZSBhIHJlc3VsdHNTbmFwc2hvdCBhbmQgd2Ugd29uJ3QgYmUgZGlmZmluZyBpblxuICAgIC8vIF9yZWNvbXB1dGVSZXN1bHRzLilcbiAgICBjb25zdCBxaWRUb09yaWdpbmFsUmVzdWx0cyA9IHt9O1xuXG4gICAgLy8gV2Ugc2hvdWxkIG9ubHkgY2xvbmUgZWFjaCBkb2N1bWVudCBvbmNlLCBldmVuIGlmIGl0IGFwcGVhcnMgaW4gbXVsdGlwbGVcbiAgICAvLyBxdWVyaWVzXG4gICAgY29uc3QgZG9jTWFwID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgY29uc3QgaWRzTWF0Y2hlZCA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAoKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkgJiYgISB0aGlzLnBhdXNlZCkge1xuICAgICAgICAvLyBDYXRjaCB0aGUgY2FzZSBvZiBhIHJlYWN0aXZlIGBjb3VudCgpYCBvbiBhIGN1cnNvciB3aXRoIHNraXBcbiAgICAgICAgLy8gb3IgbGltaXQsIHdoaWNoIHJlZ2lzdGVycyBhbiB1bm9yZGVyZWQgb2JzZXJ2ZS4gVGhpcyBpcyBhXG4gICAgICAgIC8vIHByZXR0eSByYXJlIGNhc2UsIHNvIHdlIGp1c3QgY2xvbmUgdGhlIGVudGlyZSByZXN1bHQgc2V0IHdpdGhcbiAgICAgICAgLy8gbm8gb3B0aW1pemF0aW9ucyBmb3IgZG9jdW1lbnRzIHRoYXQgYXBwZWFyIGluIHRoZXNlIHJlc3VsdFxuICAgICAgICAvLyBzZXRzIGFuZCBvdGhlciBxdWVyaWVzLlxuICAgICAgICBpZiAocXVlcnkucmVzdWx0cyBpbnN0YW5jZW9mIExvY2FsQ29sbGVjdGlvbi5fSWRNYXApIHtcbiAgICAgICAgICBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdID0gcXVlcnkucmVzdWx0cy5jbG9uZSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKHF1ZXJ5LnJlc3VsdHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fzc2VydGlvbiBmYWlsZWQ6IHF1ZXJ5LnJlc3VsdHMgbm90IGFuIGFycmF5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDbG9uZXMgYSBkb2N1bWVudCB0byBiZSBzdG9yZWQgaW4gYHFpZFRvT3JpZ2luYWxSZXN1bHRzYFxuICAgICAgICAvLyBiZWNhdXNlIGl0IG1heSBiZSBtb2RpZmllZCBiZWZvcmUgdGhlIG5ldyBhbmQgb2xkIHJlc3VsdCBzZXRzXG4gICAgICAgIC8vIGFyZSBkaWZmZWQuIEJ1dCBpZiB3ZSBrbm93IGV4YWN0bHkgd2hpY2ggZG9jdW1lbnQgSURzIHdlJ3JlXG4gICAgICAgIC8vIGdvaW5nIHRvIG1vZGlmeSwgdGhlbiB3ZSBvbmx5IG5lZWQgdG8gY2xvbmUgdGhvc2UuXG4gICAgICAgIGNvbnN0IG1lbW9pemVkQ2xvbmVJZk5lZWRlZCA9IGRvYyA9PiB7XG4gICAgICAgICAgaWYgKGRvY01hcC5oYXMoZG9jLl9pZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBkb2NNYXAuZ2V0KGRvYy5faWQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRvY1RvTWVtb2l6ZSA9IChcbiAgICAgICAgICAgIGlkc01hdGNoZWQgJiZcbiAgICAgICAgICAgICFpZHNNYXRjaGVkLnNvbWUoaWQgPT4gRUpTT04uZXF1YWxzKGlkLCBkb2MuX2lkKSlcbiAgICAgICAgICApID8gZG9jIDogRUpTT04uY2xvbmUoZG9jKTtcblxuICAgICAgICAgIGRvY01hcC5zZXQoZG9jLl9pZCwgZG9jVG9NZW1vaXplKTtcblxuICAgICAgICAgIHJldHVybiBkb2NUb01lbW9pemU7XG4gICAgICAgIH07XG5cbiAgICAgICAgcWlkVG9PcmlnaW5hbFJlc3VsdHNbcWlkXSA9IHF1ZXJ5LnJlc3VsdHMubWFwKG1lbW9pemVkQ2xvbmVJZk5lZWRlZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcWlkVG9PcmlnaW5hbFJlc3VsdHM7XG4gIH1cblxuICBmaW5pc2hVcGRhdGUoeyBvcHRpb25zLCB1cGRhdGVDb3VudCwgY2FsbGJhY2ssIGluc2VydGVkSWQgfSkge1xuXG5cbiAgICAvLyBSZXR1cm4gdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMsIG9yIGluIHRoZSB1cHNlcnQgY2FzZSwgYW4gb2JqZWN0XG4gICAgLy8gY29udGFpbmluZyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3MgYW5kIHRoZSBpZCBvZiB0aGUgZG9jIHRoYXQgd2FzXG4gICAgLy8gaW5zZXJ0ZWQsIGlmIGFueS5cbiAgICBsZXQgcmVzdWx0O1xuICAgIGlmIChvcHRpb25zLl9yZXR1cm5PYmplY3QpIHtcbiAgICAgIHJlc3VsdCA9IHsgbnVtYmVyQWZmZWN0ZWQ6IHVwZGF0ZUNvdW50IH07XG5cbiAgICAgIGlmIChpbnNlcnRlZElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzdWx0Lmluc2VydGVkSWQgPSBpbnNlcnRlZElkO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSB1cGRhdGVDb3VudDtcbiAgICB9XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gWFhYIGF0b21pY2l0eTogaWYgbXVsdGkgaXMgdHJ1ZSwgYW5kIG9uZSBtb2RpZmljYXRpb24gZmFpbHMsIGRvXG4gIC8vIHdlIHJvbGxiYWNrIHRoZSB3aG9sZSBvcGVyYXRpb24sIG9yIHdoYXQ/XG4gIGFzeW5jIHVwZGF0ZUFzeW5jKHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgb3B0aW9ucyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yLCB0cnVlKTtcblxuICAgIGNvbnN0IHFpZFRvT3JpZ2luYWxSZXN1bHRzID0gdGhpcy5wcmVwYXJlVXBkYXRlKHNlbGVjdG9yKTtcblxuICAgIGxldCByZWNvbXB1dGVRaWRzID0ge307XG5cbiAgICBsZXQgdXBkYXRlQ291bnQgPSAwO1xuXG4gICAgYXdhaXQgdGhpcy5fZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NBc3luYyhzZWxlY3RvciwgYXN5bmMgKGRvYywgaWQpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5UmVzdWx0ID0gbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcblxuICAgICAgaWYgKHF1ZXJ5UmVzdWx0LnJlc3VsdCkge1xuICAgICAgICAvLyBYWFggU2hvdWxkIHdlIHNhdmUgdGhlIG9yaWdpbmFsIGV2ZW4gaWYgbW9kIGVuZHMgdXAgYmVpbmcgYSBuby1vcD9cbiAgICAgICAgdGhpcy5fc2F2ZU9yaWdpbmFsKGlkLCBkb2MpO1xuICAgICAgICByZWNvbXB1dGVRaWRzID0gYXdhaXQgdGhpcy5fbW9kaWZ5QW5kTm90aWZ5QXN5bmMoXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIG1vZCxcbiAgICAgICAgICBxdWVyeVJlc3VsdC5hcnJheUluZGljZXNcbiAgICAgICAgKTtcblxuICAgICAgICArK3VwZGF0ZUNvdW50O1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5tdWx0aSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHJlY29tcHV0ZVFpZHMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgLy8gSWYgd2UgYXJlIGRvaW5nIGFuIHVwc2VydCwgYW5kIHdlIGRpZG4ndCBtb2RpZnkgYW55IGRvY3VtZW50cyB5ZXQsIHRoZW5cbiAgICAvLyBpdCdzIHRpbWUgdG8gZG8gYW4gaW5zZXJ0LiBGaWd1cmUgb3V0IHdoYXQgZG9jdW1lbnQgd2UgYXJlIGluc2VydGluZywgYW5kXG4gICAgLy8gZ2VuZXJhdGUgYW4gaWQgZm9yIGl0LlxuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmICh1cGRhdGVDb3VudCA9PT0gMCAmJiBvcHRpb25zLnVwc2VydCkge1xuICAgICAgY29uc3QgZG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgIGlmICghZG9jLl9pZCAmJiBvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH1cblxuICAgICAgaW5zZXJ0ZWRJZCA9IGF3YWl0IHRoaXMuaW5zZXJ0QXN5bmMoZG9jKTtcbiAgICAgIHVwZGF0ZUNvdW50ID0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hVcGRhdGUoe1xuICAgICAgb3B0aW9ucyxcbiAgICAgIGluc2VydGVkSWQsXG4gICAgICB1cGRhdGVDb3VudCxcbiAgICAgIGNhbGxiYWNrLFxuICAgIH0pO1xuICB9XG4gIC8vIFhYWCBhdG9taWNpdHk6IGlmIG11bHRpIGlzIHRydWUsIGFuZCBvbmUgbW9kaWZpY2F0aW9uIGZhaWxzLCBkb1xuICAvLyB3ZSByb2xsYmFjayB0aGUgd2hvbGUgb3BlcmF0aW9uLCBvciB3aGF0P1xuICB1cGRhdGUoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoISBjYWxsYmFjayAmJiBvcHRpb25zIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IsIHRydWUpO1xuXG4gICAgY29uc3QgcWlkVG9PcmlnaW5hbFJlc3VsdHMgPSB0aGlzLnByZXBhcmVVcGRhdGUoc2VsZWN0b3IpO1xuXG4gICAgbGV0IHJlY29tcHV0ZVFpZHMgPSB7fTtcblxuICAgIGxldCB1cGRhdGVDb3VudCA9IDA7XG5cbiAgICB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIChkb2MsIGlkKSA9PiB7XG4gICAgICBjb25zdCBxdWVyeVJlc3VsdCA9IG1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChxdWVyeVJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgLy8gWFhYIFNob3VsZCB3ZSBzYXZlIHRoZSBvcmlnaW5hbCBldmVuIGlmIG1vZCBlbmRzIHVwIGJlaW5nIGEgbm8tb3A/XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbChpZCwgZG9jKTtcbiAgICAgICAgcmVjb21wdXRlUWlkcyA9IHRoaXMuX21vZGlmeUFuZE5vdGlmeVN5bmMoXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIG1vZCxcbiAgICAgICAgICBxdWVyeVJlc3VsdC5hcnJheUluZGljZXNcbiAgICAgICAgKTtcblxuICAgICAgICArK3VwZGF0ZUNvdW50O1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5tdWx0aSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHJlY29tcHV0ZVFpZHMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyhxdWVyeSwgcWlkVG9PcmlnaW5hbFJlc3VsdHNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuXG4gICAgLy8gSWYgd2UgYXJlIGRvaW5nIGFuIHVwc2VydCwgYW5kIHdlIGRpZG4ndCBtb2RpZnkgYW55IGRvY3VtZW50cyB5ZXQsIHRoZW5cbiAgICAvLyBpdCdzIHRpbWUgdG8gZG8gYW4gaW5zZXJ0LiBGaWd1cmUgb3V0IHdoYXQgZG9jdW1lbnQgd2UgYXJlIGluc2VydGluZywgYW5kXG4gICAgLy8gZ2VuZXJhdGUgYW4gaWQgZm9yIGl0LlxuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmICh1cGRhdGVDb3VudCA9PT0gMCAmJiBvcHRpb25zLnVwc2VydCkge1xuICAgICAgY29uc3QgZG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgIGlmICghZG9jLl9pZCAmJiBvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH1cblxuICAgICAgaW5zZXJ0ZWRJZCA9IHRoaXMuaW5zZXJ0KGRvYyk7XG4gICAgICB1cGRhdGVDb3VudCA9IDE7XG4gICAgfVxuXG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hVcGRhdGUoe1xuICAgICAgb3B0aW9ucyxcbiAgICAgIHVwZGF0ZUNvdW50LFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZCxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEEgY29udmVuaWVuY2Ugd3JhcHBlciBvbiB1cGRhdGUuIExvY2FsQ29sbGVjdGlvbi51cHNlcnQoc2VsLCBtb2QpIGlzXG4gIC8vIGVxdWl2YWxlbnQgdG8gTG9jYWxDb2xsZWN0aW9uLnVwZGF0ZShzZWwsIG1vZCwge3Vwc2VydDogdHJ1ZSxcbiAgLy8gX3JldHVybk9iamVjdDogdHJ1ZX0pLlxuICB1cHNlcnQoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2QsXG4gICAgICBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLCB7dXBzZXJ0OiB0cnVlLCBfcmV0dXJuT2JqZWN0OiB0cnVlfSksXG4gICAgICBjYWxsYmFja1xuICAgICk7XG4gIH1cblxuICB1cHNlcnRBc3luYyhzZWxlY3RvciwgbW9kLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy51cGRhdGVBc3luYyhcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kLFxuICAgICAgT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge3Vwc2VydDogdHJ1ZSwgX3JldHVybk9iamVjdDogdHJ1ZX0pLFxuICAgICAgY2FsbGJhY2tcbiAgICApO1xuICB9XG5cbiAgLy8gSXRlcmF0ZXMgb3ZlciBhIHN1YnNldCBvZiBkb2N1bWVudHMgdGhhdCBjb3VsZCBtYXRjaCBzZWxlY3RvcjsgY2FsbHNcbiAgLy8gZm4oZG9jLCBpZCkgb24gZWFjaCBvZiB0aGVtLiAgU3BlY2lmaWNhbGx5LCBpZiBzZWxlY3RvciBzcGVjaWZpZXNcbiAgLy8gc3BlY2lmaWMgX2lkJ3MsIGl0IG9ubHkgbG9va3MgYXQgdGhvc2UuICBkb2MgaXMgKm5vdCogY2xvbmVkOiBpdCBpcyB0aGVcbiAgLy8gc2FtZSBvYmplY3QgdGhhdCBpcyBpbiBfZG9jcy5cbiAgYXN5bmMgX2VhY2hQb3NzaWJseU1hdGNoaW5nRG9jQXN5bmMoc2VsZWN0b3IsIGZuKSB7XG4gICAgY29uc3Qgc3BlY2lmaWNJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIGlmIChzcGVjaWZpY0lkcykge1xuICAgICAgZm9yIChjb25zdCBpZCBvZiBzcGVjaWZpY0lkcykge1xuICAgICAgICBjb25zdCBkb2MgPSB0aGlzLl9kb2NzLmdldChpZCk7XG5cbiAgICAgICAgaWYgKGRvYyAmJiAhIChhd2FpdCBmbihkb2MsIGlkKSkpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuX2RvY3MuZm9yRWFjaEFzeW5jKGZuKTtcbiAgICB9XG4gIH1cbiAgX2VhY2hQb3NzaWJseU1hdGNoaW5nRG9jU3luYyhzZWxlY3RvciwgZm4pIHtcbiAgICBjb25zdCBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgaWYgKHNwZWNpZmljSWRzKSB7XG4gICAgICBmb3IgKGNvbnN0IGlkIG9mIHNwZWNpZmljSWRzKSB7XG4gICAgICAgIGNvbnN0IGRvYyA9IHRoaXMuX2RvY3MuZ2V0KGlkKTtcblxuICAgICAgICBpZiAoZG9jICYmICFmbihkb2MsIGlkKSkge1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZG9jcy5mb3JFYWNoKGZuKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0TWF0Y2hlZERvY0FuZE1vZGlmeShkb2MsIG1vZCwgYXJyYXlJbmRpY2VzKSB7XG4gICAgY29uc3QgbWF0Y2hlZF9iZWZvcmUgPSB7fTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICAgICAgbWF0Y2hlZF9iZWZvcmVbcWlkXSA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYykucmVzdWx0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IHNraXAgb3IgbGltaXQgKHlldCkgaW4gdW5vcmRlcmVkIHF1ZXJpZXMsIHdlXG4gICAgICAgIC8vIGNhbiBqdXN0IGRvIGEgZGlyZWN0IGxvb2t1cC5cbiAgICAgICAgbWF0Y2hlZF9iZWZvcmVbcWlkXSA9IHF1ZXJ5LnJlc3VsdHMuaGFzKGRvYy5faWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1hdGNoZWRfYmVmb3JlO1xuICB9XG5cbiAgX21vZGlmeUFuZE5vdGlmeVN5bmMoZG9jLCBtb2QsIGFycmF5SW5kaWNlcykge1xuXG4gICAgY29uc3QgbWF0Y2hlZF9iZWZvcmUgPSB0aGlzLl9nZXRNYXRjaGVkRG9jQW5kTW9kaWZ5KGRvYywgbW9kLCBhcnJheUluZGljZXMpO1xuXG4gICAgY29uc3Qgb2xkX2RvYyA9IEVKU09OLmNsb25lKGRvYyk7XG4gICAgTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkoZG9jLCBtb2QsIHthcnJheUluZGljZXN9KTtcblxuICAgIGNvbnN0IHJlY29tcHV0ZVFpZHMgPSB7fTtcblxuICAgIGZvciAoY29uc3QgcWlkIG9mIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5kaXJ0eSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWZ0ZXJNYXRjaCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG4gICAgICBjb25zdCBhZnRlciA9IGFmdGVyTWF0Y2gucmVzdWx0O1xuICAgICAgY29uc3QgYmVmb3JlID0gbWF0Y2hlZF9iZWZvcmVbcWlkXTtcblxuICAgICAgaWYgKGFmdGVyICYmIHF1ZXJ5LmRpc3RhbmNlcyAmJiBhZnRlck1hdGNoLmRpc3RhbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChkb2MuX2lkLCBhZnRlck1hdGNoLmRpc3RhbmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAvLyBXZSBuZWVkIHRvIHJlY29tcHV0ZSBhbnkgcXVlcnkgd2hlcmUgdGhlIGRvYyBtYXkgaGF2ZSBiZWVuIGluIHRoZVxuICAgICAgICAvLyBjdXJzb3IncyB3aW5kb3cgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgdXBkYXRlLiAoTm90ZSB0aGF0IGlmIHNraXBcbiAgICAgICAgLy8gb3IgbGltaXQgaXMgc2V0LCBcImJlZm9yZVwiIGFuZCBcImFmdGVyXCIgYmVpbmcgdHJ1ZSBkbyBub3QgbmVjZXNzYXJpbHlcbiAgICAgICAgLy8gbWVhbiB0aGF0IHRoZSBkb2N1bWVudCBpcyBpbiB0aGUgY3Vyc29yJ3Mgb3V0cHV0IGFmdGVyIHNraXAvbGltaXQgaXNcbiAgICAgICAgLy8gYXBwbGllZC4uLiBidXQgaWYgdGhleSBhcmUgZmFsc2UsIHRoZW4gdGhlIGRvY3VtZW50IGRlZmluaXRlbHkgaXMgTk9UXG4gICAgICAgIC8vIGluIHRoZSBvdXRwdXQuIFNvIGl0J3Mgc2FmZSB0byBza2lwIHJlY29tcHV0ZSBpZiBuZWl0aGVyIGJlZm9yZSBvclxuICAgICAgICAvLyBhZnRlciBhcmUgdHJ1ZS4pXG4gICAgICAgIGlmIChiZWZvcmUgfHwgYWZ0ZXIpIHtcbiAgICAgICAgICByZWNvbXB1dGVRaWRzW3FpZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGJlZm9yZSAmJiAhYWZ0ZXIpIHtcbiAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMocXVlcnksIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKCFiZWZvcmUgJiYgYWZ0ZXIpIHtcbiAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNTeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgfSBlbHNlIGlmIChiZWZvcmUgJiYgYWZ0ZXIpIHtcbiAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl91cGRhdGVJblJlc3VsdHNTeW5jKHF1ZXJ5LCBkb2MsIG9sZF9kb2MpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVjb21wdXRlUWlkcztcbiAgfVxuXG4gIGFzeW5jIF9tb2RpZnlBbmROb3RpZnlBc3luYyhkb2MsIG1vZCwgYXJyYXlJbmRpY2VzKSB7XG5cbiAgICBjb25zdCBtYXRjaGVkX2JlZm9yZSA9IHRoaXMuX2dldE1hdGNoZWREb2NBbmRNb2RpZnkoZG9jLCBtb2QsIGFycmF5SW5kaWNlcyk7XG5cbiAgICBjb25zdCBvbGRfZG9jID0gRUpTT04uY2xvbmUoZG9jKTtcbiAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShkb2MsIG1vZCwge2FycmF5SW5kaWNlc30pO1xuXG4gICAgY29uc3QgcmVjb21wdXRlUWlkcyA9IHt9O1xuICAgIGZvciAoY29uc3QgcWlkIG9mIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5kaXJ0eSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWZ0ZXJNYXRjaCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG4gICAgICBjb25zdCBhZnRlciA9IGFmdGVyTWF0Y2gucmVzdWx0O1xuICAgICAgY29uc3QgYmVmb3JlID0gbWF0Y2hlZF9iZWZvcmVbcWlkXTtcblxuICAgICAgaWYgKGFmdGVyICYmIHF1ZXJ5LmRpc3RhbmNlcyAmJiBhZnRlck1hdGNoLmRpc3RhbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChkb2MuX2lkLCBhZnRlck1hdGNoLmRpc3RhbmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAvLyBXZSBuZWVkIHRvIHJlY29tcHV0ZSBhbnkgcXVlcnkgd2hlcmUgdGhlIGRvYyBtYXkgaGF2ZSBiZWVuIGluIHRoZVxuICAgICAgICAvLyBjdXJzb3IncyB3aW5kb3cgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgdXBkYXRlLiAoTm90ZSB0aGF0IGlmIHNraXBcbiAgICAgICAgLy8gb3IgbGltaXQgaXMgc2V0LCBcImJlZm9yZVwiIGFuZCBcImFmdGVyXCIgYmVpbmcgdHJ1ZSBkbyBub3QgbmVjZXNzYXJpbHlcbiAgICAgICAgLy8gbWVhbiB0aGF0IHRoZSBkb2N1bWVudCBpcyBpbiB0aGUgY3Vyc29yJ3Mgb3V0cHV0IGFmdGVyIHNraXAvbGltaXQgaXNcbiAgICAgICAgLy8gYXBwbGllZC4uLiBidXQgaWYgdGhleSBhcmUgZmFsc2UsIHRoZW4gdGhlIGRvY3VtZW50IGRlZmluaXRlbHkgaXMgTk9UXG4gICAgICAgIC8vIGluIHRoZSBvdXRwdXQuIFNvIGl0J3Mgc2FmZSB0byBza2lwIHJlY29tcHV0ZSBpZiBuZWl0aGVyIGJlZm9yZSBvclxuICAgICAgICAvLyBhZnRlciBhcmUgdHJ1ZS4pXG4gICAgICAgIGlmIChiZWZvcmUgfHwgYWZ0ZXIpIHtcbiAgICAgICAgICByZWNvbXB1dGVRaWRzW3FpZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGJlZm9yZSAmJiAhYWZ0ZXIpIHtcbiAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c0FzeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgfSBlbHNlIGlmICghYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzQXN5bmMocXVlcnksIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKGJlZm9yZSAmJiBhZnRlcikge1xuICAgICAgICBhd2FpdCBMb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c0FzeW5jKHF1ZXJ5LCBkb2MsIG9sZF9kb2MpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVjb21wdXRlUWlkcztcbiAgfVxuXG4gIC8vIFJlY29tcHV0ZXMgdGhlIHJlc3VsdHMgb2YgYSBxdWVyeSBhbmQgcnVucyBvYnNlcnZlIGNhbGxiYWNrcyBmb3IgdGhlXG4gIC8vIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgcHJldmlvdXMgcmVzdWx0cyBhbmQgdGhlIGN1cnJlbnQgcmVzdWx0cyAodW5sZXNzXG4gIC8vIHBhdXNlZCkuIFVzZWQgZm9yIHNraXAvbGltaXQgcXVlcmllcy5cbiAgLy9cbiAgLy8gV2hlbiB0aGlzIGlzIHVzZWQgYnkgaW5zZXJ0IG9yIHJlbW92ZSwgaXQgY2FuIGp1c3QgdXNlIHF1ZXJ5LnJlc3VsdHMgZm9yXG4gIC8vIHRoZSBvbGQgcmVzdWx0cyAoYW5kIHRoZXJlJ3Mgbm8gbmVlZCB0byBwYXNzIGluIG9sZFJlc3VsdHMpLCBiZWNhdXNlIHRoZXNlXG4gIC8vIG9wZXJhdGlvbnMgZG9uJ3QgbXV0YXRlIHRoZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFVwZGF0ZSBuZWVkcyB0b1xuICAvLyBwYXNzIGluIGFuIG9sZFJlc3VsdHMgd2hpY2ggd2FzIGRlZXAtY29waWVkIGJlZm9yZSB0aGUgbW9kaWZpZXIgd2FzXG4gIC8vIGFwcGxpZWQuXG4gIC8vXG4gIC8vIG9sZFJlc3VsdHMgaXMgZ3VhcmFudGVlZCB0byBiZSBpZ25vcmVkIGlmIHRoZSBxdWVyeSBpcyBub3QgcGF1c2VkLlxuICBfcmVjb21wdXRlUmVzdWx0cyhxdWVyeSwgb2xkUmVzdWx0cykge1xuICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgLy8gVGhlcmUncyBubyByZWFzb24gdG8gcmVjb21wdXRlIHRoZSByZXN1bHRzIG5vdyBhcyB3ZSdyZSBzdGlsbCBwYXVzZWQuXG4gICAgICAvLyBCeSBmbGFnZ2luZyB0aGUgcXVlcnkgYXMgXCJkaXJ0eVwiLCB0aGUgcmVjb21wdXRlIHdpbGwgYmUgcGVyZm9ybWVkXG4gICAgICAvLyB3aGVuIHJlc3VtZU9ic2VydmVycyBpcyBjYWxsZWQuXG4gICAgICBxdWVyeS5kaXJ0eSA9IHRydWU7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhdXNlZCAmJiAhb2xkUmVzdWx0cykge1xuICAgICAgb2xkUmVzdWx0cyA9IHF1ZXJ5LnJlc3VsdHM7XG4gICAgfVxuXG4gICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcykge1xuICAgICAgcXVlcnkuZGlzdGFuY2VzLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcXVlcnkucmVzdWx0cyA9IHF1ZXJ5LmN1cnNvci5fZ2V0UmF3T2JqZWN0cyh7XG4gICAgICBkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlcyxcbiAgICAgIG9yZGVyZWQ6IHF1ZXJ5Lm9yZGVyZWRcbiAgICB9KTtcblxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgIExvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5Q2hhbmdlcyhcbiAgICAgICAgcXVlcnkub3JkZXJlZCxcbiAgICAgICAgb2xkUmVzdWx0cyxcbiAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgcXVlcnksXG4gICAgICAgIHtwcm9qZWN0aW9uRm46IHF1ZXJ5LnByb2plY3Rpb25Gbn1cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgX3NhdmVPcmlnaW5hbChpZCwgZG9jKSB7XG4gICAgLy8gQXJlIHdlIGV2ZW4gdHJ5aW5nIHRvIHNhdmUgb3JpZ2luYWxzP1xuICAgIGlmICghdGhpcy5fc2F2ZWRPcmlnaW5hbHMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBIYXZlIHdlIHByZXZpb3VzbHkgbXV0YXRlZCB0aGUgb3JpZ2luYWwgKGFuZCBzbyAnZG9jJyBpcyBub3QgYWN0dWFsbHlcbiAgICAvLyBvcmlnaW5hbCk/ICAoTm90ZSB0aGUgJ2hhcycgY2hlY2sgcmF0aGVyIHRoYW4gdHJ1dGg6IHdlIHN0b3JlIHVuZGVmaW5lZFxuICAgIC8vIGhlcmUgZm9yIGluc2VydGVkIGRvY3MhKVxuICAgIGlmICh0aGlzLl9zYXZlZE9yaWdpbmFscy5oYXMoaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fc2F2ZWRPcmlnaW5hbHMuc2V0KGlkLCBFSlNPTi5jbG9uZShkb2MpKTtcbiAgfVxufVxuXG5Mb2NhbENvbGxlY3Rpb24uQ3Vyc29yID0gQ3Vyc29yO1xuXG5Mb2NhbENvbGxlY3Rpb24uT2JzZXJ2ZUhhbmRsZSA9IE9ic2VydmVIYW5kbGU7XG5cbi8vIFhYWCBtYXliZSBtb3ZlIHRoZXNlIGludG8gYW5vdGhlciBPYnNlcnZlSGVscGVycyBwYWNrYWdlIG9yIHNvbWV0aGluZ1xuXG4vLyBfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIGlzIGFuIG9iamVjdCB3aGljaCByZWNlaXZlcyBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFja3Ncbi8vIGFuZCBrZWVwcyBhIGNhY2hlIG9mIHRoZSBjdXJyZW50IGN1cnNvciBzdGF0ZSB1cCB0byBkYXRlIGluIHRoaXMuZG9jcy4gVXNlcnNcbi8vIG9mIHRoaXMgY2xhc3Mgc2hvdWxkIHJlYWQgdGhlIGRvY3MgZmllbGQgYnV0IG5vdCBtb2RpZnkgaXQuIFlvdSBzaG91bGQgcGFzc1xuLy8gdGhlIFwiYXBwbHlDaGFuZ2VcIiBmaWVsZCBhcyB0aGUgY2FsbGJhY2tzIHRvIHRoZSB1bmRlcmx5aW5nIG9ic2VydmVDaGFuZ2VzXG4vLyBjYWxsLiBPcHRpb25hbGx5LCB5b3UgY2FuIHNwZWNpZnkgeW91ciBvd24gb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIHdoaWNoIGFyZVxuLy8gaW52b2tlZCBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvY3MgZmllbGQgaXMgdXBkYXRlZDsgdGhpcyBvYmplY3QgaXMgbWFkZVxuLy8gYXZhaWxhYmxlIGFzIGB0aGlzYCB0byB0aG9zZSBjYWxsYmFja3MuXG5Mb2NhbENvbGxlY3Rpb24uX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciA9IGNsYXNzIF9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBvcmRlcmVkRnJvbUNhbGxiYWNrcyA9IChcbiAgICAgIG9wdGlvbnMuY2FsbGJhY2tzICYmXG4gICAgICBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZChvcHRpb25zLmNhbGxiYWNrcylcbiAgICApO1xuXG4gICAgaWYgKGhhc093bi5jYWxsKG9wdGlvbnMsICdvcmRlcmVkJykpIHtcbiAgICAgIHRoaXMub3JkZXJlZCA9IG9wdGlvbnMub3JkZXJlZDtcblxuICAgICAgaWYgKG9wdGlvbnMuY2FsbGJhY2tzICYmIG9wdGlvbnMub3JkZXJlZCAhPT0gb3JkZXJlZEZyb21DYWxsYmFja3MpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ29yZGVyZWQgb3B0aW9uIGRvZXNuXFwndCBtYXRjaCBjYWxsYmFja3MnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuY2FsbGJhY2tzKSB7XG4gICAgICB0aGlzLm9yZGVyZWQgPSBvcmRlcmVkRnJvbUNhbGxiYWNrcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoJ211c3QgcHJvdmlkZSBvcmRlcmVkIG9yIGNhbGxiYWNrcycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IG9wdGlvbnMuY2FsbGJhY2tzIHx8IHt9O1xuXG4gICAgaWYgKHRoaXMub3JkZXJlZCkge1xuICAgICAgdGhpcy5kb2NzID0gbmV3IE9yZGVyZWREaWN0KE1vbmdvSUQuaWRTdHJpbmdpZnkpO1xuICAgICAgdGhpcy5hcHBseUNoYW5nZSA9IHtcbiAgICAgICAgYWRkZWRCZWZvcmU6IChpZCwgZmllbGRzLCBiZWZvcmUpID0+IHtcbiAgICAgICAgICAvLyBUYWtlIGEgc2hhbGxvdyBjb3B5IHNpbmNlIHRoZSB0b3AtbGV2ZWwgcHJvcGVydGllcyBjYW4gYmUgY2hhbmdlZFxuICAgICAgICAgIGNvbnN0IGRvYyA9IHsgLi4uZmllbGRzIH07XG5cbiAgICAgICAgICBkb2MuX2lkID0gaWQ7XG5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLmFkZGVkQmVmb3JlKSB7XG4gICAgICAgICAgICBjYWxsYmFja3MuYWRkZWRCZWZvcmUuY2FsbCh0aGlzLCBpZCwgRUpTT04uY2xvbmUoZmllbGRzKSwgYmVmb3JlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGlzIGxpbmUgdHJpZ2dlcnMgaWYgd2UgcHJvdmlkZSBhZGRlZCB3aXRoIG1vdmVkQmVmb3JlLlxuICAgICAgICAgIGlmIChjYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5hZGRlZC5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBYWFggY291bGQgYGJlZm9yZWAgYmUgYSBmYWxzeSBJRD8gIFRlY2huaWNhbGx5XG4gICAgICAgICAgLy8gaWRTdHJpbmdpZnkgc2VlbXMgdG8gYWxsb3cgZm9yIHRoZW0gLS0gdGhvdWdoXG4gICAgICAgICAgLy8gT3JkZXJlZERpY3Qgd29uJ3QgY2FsbCBzdHJpbmdpZnkgb24gYSBmYWxzeSBhcmcuXG4gICAgICAgICAgdGhpcy5kb2NzLnB1dEJlZm9yZShpZCwgZG9jLCBiZWZvcmUgfHwgbnVsbCk7XG4gICAgICAgIH0sXG4gICAgICAgIG1vdmVkQmVmb3JlOiAoaWQsIGJlZm9yZSkgPT4ge1xuICAgICAgICAgIGlmIChjYWxsYmFja3MubW92ZWRCZWZvcmUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5tb3ZlZEJlZm9yZS5jYWxsKHRoaXMsIGlkLCBiZWZvcmUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuZG9jcy5tb3ZlQmVmb3JlKGlkLCBiZWZvcmUgfHwgbnVsbCk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRvY3MgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHRoaXMuYXBwbHlDaGFuZ2UgPSB7XG4gICAgICAgIGFkZGVkOiAoaWQsIGZpZWxkcykgPT4ge1xuICAgICAgICAgIC8vIFRha2UgYSBzaGFsbG93IGNvcHkgc2luY2UgdGhlIHRvcC1sZXZlbCBwcm9wZXJ0aWVzIGNhbiBiZSBjaGFuZ2VkXG4gICAgICAgICAgY29uc3QgZG9jID0geyAuLi5maWVsZHMgfTtcblxuICAgICAgICAgIGlmIChjYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5hZGRlZC5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBkb2MuX2lkID0gaWQ7XG5cbiAgICAgICAgICB0aGlzLmRvY3Muc2V0KGlkLCAgZG9jKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVGhlIG1ldGhvZHMgaW4gX0lkTWFwIGFuZCBPcmRlcmVkRGljdCB1c2VkIGJ5IHRoZXNlIGNhbGxiYWNrcyBhcmVcbiAgICAvLyBpZGVudGljYWwuXG4gICAgdGhpcy5hcHBseUNoYW5nZS5jaGFuZ2VkID0gKGlkLCBmaWVsZHMpID0+IHtcbiAgICAgIGNvbnN0IGRvYyA9IHRoaXMuZG9jcy5nZXQoaWQpO1xuXG4gICAgICBpZiAoIWRvYykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaWQgZm9yIGNoYW5nZWQ6ICR7aWR9YCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFja3MuY2hhbmdlZCkge1xuICAgICAgICBjYWxsYmFja3MuY2hhbmdlZC5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpKTtcbiAgICAgIH1cblxuICAgICAgRGlmZlNlcXVlbmNlLmFwcGx5Q2hhbmdlcyhkb2MsIGZpZWxkcyk7XG4gICAgfTtcblxuICAgIHRoaXMuYXBwbHlDaGFuZ2UucmVtb3ZlZCA9IGlkID0+IHtcbiAgICAgIGlmIChjYWxsYmFja3MucmVtb3ZlZCkge1xuICAgICAgICBjYWxsYmFja3MucmVtb3ZlZC5jYWxsKHRoaXMsIGlkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kb2NzLnJlbW92ZShpZCk7XG4gICAgfTtcbiAgfVxufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCA9IGNsYXNzIF9JZE1hcCBleHRlbmRzIElkTWFwIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoTW9uZ29JRC5pZFN0cmluZ2lmeSwgTW9uZ29JRC5pZFBhcnNlKTtcbiAgfVxufTtcblxuLy8gV3JhcCBhIHRyYW5zZm9ybSBmdW5jdGlvbiB0byByZXR1cm4gb2JqZWN0cyB0aGF0IGhhdmUgdGhlIF9pZCBmaWVsZFxuLy8gb2YgdGhlIHVudHJhbnNmb3JtZWQgZG9jdW1lbnQuIFRoaXMgZW5zdXJlcyB0aGF0IHN1YnN5c3RlbXMgc3VjaCBhc1xuLy8gdGhlIG9ic2VydmUtc2VxdWVuY2UgcGFja2FnZSB0aGF0IGNhbGwgYG9ic2VydmVgIGNhbiBrZWVwIHRyYWNrIG9mXG4vLyB0aGUgZG9jdW1lbnRzIGlkZW50aXRpZXMuXG4vL1xuLy8gLSBSZXF1aXJlIHRoYXQgaXQgcmV0dXJucyBvYmplY3RzXG4vLyAtIElmIHRoZSByZXR1cm4gdmFsdWUgaGFzIGFuIF9pZCBmaWVsZCwgdmVyaWZ5IHRoYXQgaXQgbWF0Y2hlcyB0aGVcbi8vICAgb3JpZ2luYWwgX2lkIGZpZWxkXG4vLyAtIElmIHRoZSByZXR1cm4gdmFsdWUgZG9lc24ndCBoYXZlIGFuIF9pZCBmaWVsZCwgYWRkIGl0IGJhY2suXG5Mb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybSA9IHRyYW5zZm9ybSA9PiB7XG4gIGlmICghdHJhbnNmb3JtKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBObyBuZWVkIHRvIGRvdWJseS13cmFwIHRyYW5zZm9ybXMuXG4gIGlmICh0cmFuc2Zvcm0uX193cmFwcGVkVHJhbnNmb3JtX18pIHtcbiAgICByZXR1cm4gdHJhbnNmb3JtO1xuICB9XG5cbiAgY29uc3Qgd3JhcHBlZCA9IGRvYyA9PiB7XG4gICAgaWYgKCFoYXNPd24uY2FsbChkb2MsICdfaWQnKSkge1xuICAgICAgLy8gWFhYIGRvIHdlIGV2ZXIgaGF2ZSBhIHRyYW5zZm9ybSBvbiB0aGUgb3Bsb2cncyBjb2xsZWN0aW9uPyBiZWNhdXNlIHRoYXRcbiAgICAgIC8vIGNvbGxlY3Rpb24gaGFzIG5vIF9pZC5cbiAgICAgIHRocm93IG5ldyBFcnJvcignY2FuIG9ubHkgdHJhbnNmb3JtIGRvY3VtZW50cyB3aXRoIF9pZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZG9jLl9pZDtcblxuICAgIC8vIFhYWCBjb25zaWRlciBtYWtpbmcgdHJhY2tlciBhIHdlYWsgZGVwZW5kZW5jeSBhbmQgY2hlY2tpbmdcbiAgICAvLyBQYWNrYWdlLnRyYWNrZXIgaGVyZVxuICAgIGNvbnN0IHRyYW5zZm9ybWVkID0gVHJhY2tlci5ub25yZWFjdGl2ZSgoKSA9PiB0cmFuc2Zvcm0oZG9jKSk7XG5cbiAgICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdCh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndHJhbnNmb3JtIG11c3QgcmV0dXJuIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGlmIChoYXNPd24uY2FsbCh0cmFuc2Zvcm1lZCwgJ19pZCcpKSB7XG4gICAgICBpZiAoIUVKU09OLmVxdWFscyh0cmFuc2Zvcm1lZC5faWQsIGlkKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RyYW5zZm9ybWVkIGRvY3VtZW50IGNhblxcJ3QgaGF2ZSBkaWZmZXJlbnQgX2lkJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyYW5zZm9ybWVkLl9pZCA9IGlkO1xuICAgIH1cblxuICAgIHJldHVybiB0cmFuc2Zvcm1lZDtcbiAgfTtcblxuICB3cmFwcGVkLl9fd3JhcHBlZFRyYW5zZm9ybV9fID0gdHJ1ZTtcblxuICByZXR1cm4gd3JhcHBlZDtcbn07XG5cbi8vIFhYWCB0aGUgc29ydGVkLXF1ZXJ5IGxvZ2ljIGJlbG93IGlzIGxhdWdoYWJseSBpbmVmZmljaWVudC4gd2UnbGxcbi8vIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIGRhdGFzdHJ1Y3R1cmUgZm9yIHRoaXMuXG4vL1xuLy8gWFhYIHRoZSBsb2dpYyBmb3Igb2JzZXJ2aW5nIHdpdGggYSBza2lwIG9yIGEgbGltaXQgaXMgZXZlbiBtb3JlXG4vLyBsYXVnaGFibHkgaW5lZmZpY2llbnQuIHdlIHJlY29tcHV0ZSB0aGUgd2hvbGUgcmVzdWx0cyBldmVyeSB0aW1lIVxuXG4vLyBUaGlzIGJpbmFyeSBzZWFyY2ggcHV0cyBhIHZhbHVlIGJldHdlZW4gYW55IGVxdWFsIHZhbHVlcywgYW5kIHRoZSBmaXJzdFxuLy8gbGVzc2VyIHZhbHVlLlxuTG9jYWxDb2xsZWN0aW9uLl9iaW5hcnlTZWFyY2ggPSAoY21wLCBhcnJheSwgdmFsdWUpID0+IHtcbiAgbGV0IGZpcnN0ID0gMDtcbiAgbGV0IHJhbmdlID0gYXJyYXkubGVuZ3RoO1xuXG4gIHdoaWxlIChyYW5nZSA+IDApIHtcbiAgICBjb25zdCBoYWxmUmFuZ2UgPSBNYXRoLmZsb29yKHJhbmdlIC8gMik7XG5cbiAgICBpZiAoY21wKHZhbHVlLCBhcnJheVtmaXJzdCArIGhhbGZSYW5nZV0pID49IDApIHtcbiAgICAgIGZpcnN0ICs9IGhhbGZSYW5nZSArIDE7XG4gICAgICByYW5nZSAtPSBoYWxmUmFuZ2UgKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICByYW5nZSA9IGhhbGZSYW5nZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmlyc3Q7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbiA9IGZpZWxkcyA9PiB7XG4gIGlmIChmaWVsZHMgIT09IE9iamVjdChmaWVsZHMpIHx8IEFycmF5LmlzQXJyYXkoZmllbGRzKSkge1xuICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdmaWVsZHMgb3B0aW9uIG11c3QgYmUgYW4gb2JqZWN0Jyk7XG4gIH1cblxuICBPYmplY3Qua2V5cyhmaWVsZHMpLmZvckVhY2goa2V5UGF0aCA9PiB7XG4gICAgaWYgKGtleVBhdGguc3BsaXQoJy4nKS5pbmNsdWRlcygnJCcpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ01pbmltb25nbyBkb2VzblxcJ3Qgc3VwcG9ydCAkIG9wZXJhdG9yIGluIHByb2plY3Rpb25zIHlldC4nXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlID0gZmllbGRzW2tleVBhdGhdO1xuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgWyckZWxlbU1hdGNoJywgJyRtZXRhJywgJyRzbGljZSddLnNvbWUoa2V5ID0+XG4gICAgICAgICAgaGFzT3duLmNhbGwodmFsdWUsIGtleSlcbiAgICAgICAgKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdNaW5pbW9uZ28gZG9lc25cXCd0IHN1cHBvcnQgb3BlcmF0b3JzIGluIHByb2plY3Rpb25zIHlldC4nXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghWzEsIDAsIHRydWUsIGZhbHNlXS5pbmNsdWRlcyh2YWx1ZSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnUHJvamVjdGlvbiB2YWx1ZXMgc2hvdWxkIGJlIG9uZSBvZiAxLCAwLCB0cnVlLCBvciBmYWxzZSdcbiAgICAgICk7XG4gICAgfVxuICB9KTtcbn07XG5cbi8vIEtub3dzIGhvdyB0byBjb21waWxlIGEgZmllbGRzIHByb2plY3Rpb24gdG8gYSBwcmVkaWNhdGUgZnVuY3Rpb24uXG4vLyBAcmV0dXJucyAtIEZ1bmN0aW9uOiBhIGNsb3N1cmUgdGhhdCBmaWx0ZXJzIG91dCBhbiBvYmplY3QgYWNjb3JkaW5nIHRvIHRoZVxuLy8gICAgICAgICAgICBmaWVsZHMgcHJvamVjdGlvbiBydWxlczpcbi8vICAgICAgICAgICAgQHBhcmFtIG9iaiAtIE9iamVjdDogTW9uZ29EQi1zdHlsZWQgZG9jdW1lbnRcbi8vICAgICAgICAgICAgQHJldHVybnMgLSBPYmplY3Q6IGEgZG9jdW1lbnQgd2l0aCB0aGUgZmllbGRzIGZpbHRlcmVkIG91dFxuLy8gICAgICAgICAgICAgICAgICAgICAgIGFjY29yZGluZyB0byBwcm9qZWN0aW9uIHJ1bGVzLiBEb2Vzbid0IHJldGFpbiBzdWJmaWVsZHNcbi8vICAgICAgICAgICAgICAgICAgICAgICBvZiBwYXNzZWQgYXJndW1lbnQuXG5Mb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uID0gZmllbGRzID0+IHtcbiAgTG9jYWxDb2xsZWN0aW9uLl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24oZmllbGRzKTtcblxuICBjb25zdCBfaWRQcm9qZWN0aW9uID0gZmllbGRzLl9pZCA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGZpZWxkcy5faWQ7XG4gIGNvbnN0IGRldGFpbHMgPSBwcm9qZWN0aW9uRGV0YWlscyhmaWVsZHMpO1xuXG4gIC8vIHJldHVybnMgdHJhbnNmb3JtZWQgZG9jIGFjY29yZGluZyB0byBydWxlVHJlZVxuICBjb25zdCB0cmFuc2Zvcm0gPSAoZG9jLCBydWxlVHJlZSkgPT4ge1xuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgXCJzZXRzXCJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICByZXR1cm4gZG9jLm1hcChzdWJkb2MgPT4gdHJhbnNmb3JtKHN1YmRvYywgcnVsZVRyZWUpKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBkZXRhaWxzLmluY2x1ZGluZyA/IHt9IDogRUpTT04uY2xvbmUoZG9jKTtcblxuICAgIE9iamVjdC5rZXlzKHJ1bGVUcmVlKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBpZiAoZG9jID09IG51bGwgfHwgIWhhc093bi5jYWxsKGRvYywga2V5KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJ1bGUgPSBydWxlVHJlZVtrZXldO1xuXG4gICAgICBpZiAocnVsZSA9PT0gT2JqZWN0KHJ1bGUpKSB7XG4gICAgICAgIC8vIEZvciBzdWItb2JqZWN0cy9zdWJzZXRzIHdlIGJyYW5jaFxuICAgICAgICBpZiAoZG9jW2tleV0gPT09IE9iamVjdChkb2Nba2V5XSkpIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IHRyYW5zZm9ybShkb2Nba2V5XSwgcnVsZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZGV0YWlscy5pbmNsdWRpbmcpIHtcbiAgICAgICAgLy8gT3RoZXJ3aXNlIHdlIGRvbid0IGV2ZW4gdG91Y2ggdGhpcyBzdWJmaWVsZFxuICAgICAgICByZXN1bHRba2V5XSA9IEVKU09OLmNsb25lKGRvY1trZXldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSByZXN1bHRba2V5XTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBkb2MgIT0gbnVsbCA/IHJlc3VsdCA6IGRvYztcbiAgfTtcblxuICByZXR1cm4gZG9jID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSB0cmFuc2Zvcm0oZG9jLCBkZXRhaWxzLnRyZWUpO1xuXG4gICAgaWYgKF9pZFByb2plY3Rpb24gJiYgaGFzT3duLmNhbGwoZG9jLCAnX2lkJykpIHtcbiAgICAgIHJlc3VsdC5faWQgPSBkb2MuX2lkO1xuICAgIH1cblxuICAgIGlmICghX2lkUHJvamVjdGlvbiAmJiBoYXNPd24uY2FsbChyZXN1bHQsICdfaWQnKSkge1xuICAgICAgZGVsZXRlIHJlc3VsdC5faWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn07XG5cbi8vIENhbGN1bGF0ZXMgdGhlIGRvY3VtZW50IHRvIGluc2VydCBpbiBjYXNlIHdlJ3JlIGRvaW5nIGFuIHVwc2VydCBhbmQgdGhlXG4vLyBzZWxlY3RvciBkb2VzIG5vdCBtYXRjaCBhbnkgZWxlbWVudHNcbkxvY2FsQ29sbGVjdGlvbi5fY3JlYXRlVXBzZXJ0RG9jdW1lbnQgPSAoc2VsZWN0b3IsIG1vZGlmaWVyKSA9PiB7XG4gIGNvbnN0IHNlbGVjdG9yRG9jdW1lbnQgPSBwb3B1bGF0ZURvY3VtZW50V2l0aFF1ZXJ5RmllbGRzKHNlbGVjdG9yKTtcbiAgY29uc3QgaXNNb2RpZnkgPSBMb2NhbENvbGxlY3Rpb24uX2lzTW9kaWZpY2F0aW9uTW9kKG1vZGlmaWVyKTtcblxuICBjb25zdCBuZXdEb2MgPSB7fTtcblxuICBpZiAoc2VsZWN0b3JEb2N1bWVudC5faWQpIHtcbiAgICBuZXdEb2MuX2lkID0gc2VsZWN0b3JEb2N1bWVudC5faWQ7XG4gICAgZGVsZXRlIHNlbGVjdG9yRG9jdW1lbnQuX2lkO1xuICB9XG5cbiAgLy8gVGhpcyBkb3VibGUgX21vZGlmeSBjYWxsIGlzIG1hZGUgdG8gaGVscCB3aXRoIG5lc3RlZCBwcm9wZXJ0aWVzIChzZWUgaXNzdWVcbiAgLy8gIzg2MzEpLiBXZSBkbyB0aGlzIGV2ZW4gaWYgaXQncyBhIHJlcGxhY2VtZW50IGZvciB2YWxpZGF0aW9uIHB1cnBvc2VzIChlLmcuXG4gIC8vIGFtYmlndW91cyBpZCdzKVxuICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShuZXdEb2MsIHskc2V0OiBzZWxlY3RvckRvY3VtZW50fSk7XG4gIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KG5ld0RvYywgbW9kaWZpZXIsIHtpc0luc2VydDogdHJ1ZX0pO1xuXG4gIGlmIChpc01vZGlmeSkge1xuICAgIHJldHVybiBuZXdEb2M7XG4gIH1cblxuICAvLyBSZXBsYWNlbWVudCBjYW4gdGFrZSBfaWQgZnJvbSBxdWVyeSBkb2N1bWVudFxuICBjb25zdCByZXBsYWNlbWVudCA9IE9iamVjdC5hc3NpZ24oe30sIG1vZGlmaWVyKTtcbiAgaWYgKG5ld0RvYy5faWQpIHtcbiAgICByZXBsYWNlbWVudC5faWQgPSBuZXdEb2MuX2lkO1xuICB9XG5cbiAgcmV0dXJuIHJlcGxhY2VtZW50O1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9kaWZmT2JqZWN0cyA9IChsZWZ0LCByaWdodCwgY2FsbGJhY2tzKSA9PiB7XG4gIHJldHVybiBEaWZmU2VxdWVuY2UuZGlmZk9iamVjdHMobGVmdCwgcmlnaHQsIGNhbGxiYWNrcyk7XG59O1xuXG4vLyBvcmRlcmVkOiBib29sLlxuLy8gb2xkX3Jlc3VsdHMgYW5kIG5ld19yZXN1bHRzOiBjb2xsZWN0aW9ucyBvZiBkb2N1bWVudHMuXG4vLyAgICBpZiBvcmRlcmVkLCB0aGV5IGFyZSBhcnJheXMuXG4vLyAgICBpZiB1bm9yZGVyZWQsIHRoZXkgYXJlIElkTWFwc1xuTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzID0gKG9yZGVyZWQsIG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKSA9PlxuICBEaWZmU2VxdWVuY2UuZGlmZlF1ZXJ5Q2hhbmdlcyhvcmRlcmVkLCBvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucylcbjtcblxuTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlPcmRlcmVkQ2hhbmdlcyA9IChvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucykgPT5cbiAgRGlmZlNlcXVlbmNlLmRpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzKG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMgPSAob2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpID0+XG4gIERpZmZTZXF1ZW5jZS5kaWZmUXVlcnlVbm9yZGVyZWRDaGFuZ2VzKG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzID0gKHF1ZXJ5LCBkb2MpID0+IHtcbiAgaWYgKCFxdWVyeS5vcmRlcmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGNhbGwgX2ZpbmRJbk9yZGVyZWRSZXN1bHRzIG9uIHVub3JkZXJlZCBxdWVyeScpO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyeS5yZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHF1ZXJ5LnJlc3VsdHNbaV0gPT09IGRvYykge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgRXJyb3IoJ29iamVjdCBtaXNzaW5nIGZyb20gcXVlcnknKTtcbn07XG5cbi8vIElmIHRoaXMgaXMgYSBzZWxlY3RvciB3aGljaCBleHBsaWNpdGx5IGNvbnN0cmFpbnMgdGhlIG1hdGNoIGJ5IElEIHRvIGEgZmluaXRlXG4vLyBudW1iZXIgb2YgZG9jdW1lbnRzLCByZXR1cm5zIGEgbGlzdCBvZiB0aGVpciBJRHMuICBPdGhlcndpc2UgcmV0dXJuc1xuLy8gbnVsbC4gTm90ZSB0aGF0IHRoZSBzZWxlY3RvciBtYXkgaGF2ZSBvdGhlciByZXN0cmljdGlvbnMgc28gaXQgbWF5IG5vdCBldmVuXG4vLyBtYXRjaCB0aG9zZSBkb2N1bWVudCEgIFdlIGNhcmUgYWJvdXQgJGluIGFuZCAkYW5kIHNpbmNlIHRob3NlIGFyZSBnZW5lcmF0ZWRcbi8vIGFjY2Vzcy1jb250cm9sbGVkIHVwZGF0ZSBhbmQgcmVtb3ZlLlxuTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvciA9IHNlbGVjdG9yID0+IHtcbiAgLy8gSXMgdGhlIHNlbGVjdG9yIGp1c3QgYW4gSUQ/XG4gIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHtcbiAgICByZXR1cm4gW3NlbGVjdG9yXTtcbiAgfVxuXG4gIGlmICghc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIERvIHdlIGhhdmUgYW4gX2lkIGNsYXVzZT9cbiAgaWYgKGhhc093bi5jYWxsKHNlbGVjdG9yLCAnX2lkJykpIHtcbiAgICAvLyBJcyB0aGUgX2lkIGNsYXVzZSBqdXN0IGFuIElEP1xuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3Rvci5faWQpKSB7XG4gICAgICByZXR1cm4gW3NlbGVjdG9yLl9pZF07XG4gICAgfVxuXG4gICAgLy8gSXMgdGhlIF9pZCBjbGF1c2Uge19pZDogeyRpbjogW1wieFwiLCBcInlcIiwgXCJ6XCJdfX0/XG4gICAgaWYgKHNlbGVjdG9yLl9pZFxuICAgICAgICAmJiBBcnJheS5pc0FycmF5KHNlbGVjdG9yLl9pZC4kaW4pXG4gICAgICAgICYmIHNlbGVjdG9yLl9pZC4kaW4ubGVuZ3RoXG4gICAgICAgICYmIHNlbGVjdG9yLl9pZC4kaW4uZXZlcnkoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQpKSB7XG4gICAgICByZXR1cm4gc2VsZWN0b3IuX2lkLiRpbjtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIElmIHRoaXMgaXMgYSB0b3AtbGV2ZWwgJGFuZCwgYW5kIGFueSBvZiB0aGUgY2xhdXNlcyBjb25zdHJhaW4gdGhlaXJcbiAgLy8gZG9jdW1lbnRzLCB0aGVuIHRoZSB3aG9sZSBzZWxlY3RvciBpcyBjb25zdHJhaW5lZCBieSBhbnkgb25lIGNsYXVzZSdzXG4gIC8vIGNvbnN0cmFpbnQuIChXZWxsLCBieSB0aGVpciBpbnRlcnNlY3Rpb24sIGJ1dCB0aGF0IHNlZW1zIHVubGlrZWx5LilcbiAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IuJGFuZCkpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdG9yLiRhbmQubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IHN1YklkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IuJGFuZFtpXSk7XG5cbiAgICAgIGlmIChzdWJJZHMpIHtcbiAgICAgICAgcmV0dXJuIHN1YklkcztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzU3luYyA9IChxdWVyeSwgZG9jKSA9PiB7XG4gIGNvbnN0IGZpZWxkcyA9IEVKU09OLmNsb25lKGRvYyk7XG5cbiAgZGVsZXRlIGZpZWxkcy5faWQ7XG5cbiAgaWYgKHF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBpZiAoIXF1ZXJ5LnNvcnRlcikge1xuICAgICAgcXVlcnkuYWRkZWRCZWZvcmUoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcyksIG51bGwpO1xuICAgICAgcXVlcnkucmVzdWx0cy5wdXNoKGRvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdChcbiAgICAgICAgcXVlcnkuc29ydGVyLmdldENvbXBhcmF0b3Ioe2Rpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzfSksXG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgICAgIGRvY1xuICAgICAgKTtcblxuICAgICAgbGV0IG5leHQgPSBxdWVyeS5yZXN1bHRzW2kgKyAxXTtcbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIG5leHQgPSBuZXh0Ll9pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5leHQgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSwgbmV4dCk7XG4gICAgfVxuXG4gICAgcXVlcnkuYWRkZWQoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICB9IGVsc2Uge1xuICAgIHF1ZXJ5LmFkZGVkKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpKTtcbiAgICBxdWVyeS5yZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c0FzeW5jID0gYXN5bmMgKHF1ZXJ5LCBkb2MpID0+IHtcbiAgY29uc3QgZmllbGRzID0gRUpTT04uY2xvbmUoZG9jKTtcblxuICBkZWxldGUgZmllbGRzLl9pZDtcblxuICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgIGlmICghcXVlcnkuc29ydGVyKSB7XG4gICAgICBhd2FpdCBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSwgbnVsbCk7XG4gICAgICBxdWVyeS5yZXN1bHRzLnB1c2goZG9jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0KFxuICAgICAgICBxdWVyeS5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXN9KSxcbiAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgZG9jXG4gICAgICApO1xuXG4gICAgICBsZXQgbmV4dCA9IHF1ZXJ5LnJlc3VsdHNbaSArIDFdO1xuICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgbmV4dCA9IG5leHQuX2lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV4dCA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHF1ZXJ5LmFkZGVkQmVmb3JlKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpLCBuZXh0KTtcbiAgICB9XG5cbiAgICBhd2FpdCBxdWVyeS5hZGRlZChkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgcXVlcnkuYWRkZWQoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICAgIHF1ZXJ5LnJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gIH1cbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0ID0gKGNtcCwgYXJyYXksIHZhbHVlKSA9PiB7XG4gIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICBhcnJheS5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2JpbmFyeVNlYXJjaChjbXAsIGFycmF5LCB2YWx1ZSk7XG5cbiAgYXJyYXkuc3BsaWNlKGksIDAsIHZhbHVlKTtcblxuICByZXR1cm4gaTtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faXNNb2RpZmljYXRpb25Nb2QgPSBtb2QgPT4ge1xuICBsZXQgaXNNb2RpZnkgPSBmYWxzZTtcbiAgbGV0IGlzUmVwbGFjZSA9IGZhbHNlO1xuXG4gIE9iamVjdC5rZXlzKG1vZCkuZm9yRWFjaChrZXkgPT4ge1xuICAgIGlmIChrZXkuc3Vic3RyKDAsIDEpID09PSAnJCcpIHtcbiAgICAgIGlzTW9kaWZ5ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXNSZXBsYWNlID0gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChpc01vZGlmeSAmJiBpc1JlcGxhY2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnVXBkYXRlIHBhcmFtZXRlciBjYW5ub3QgaGF2ZSBib3RoIG1vZGlmaWVyIGFuZCBub24tbW9kaWZpZXIgZmllbGRzLidcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGlzTW9kaWZ5O1xufTtcblxuLy8gWFhYIG1heWJlIHRoaXMgc2hvdWxkIGJlIEVKU09OLmlzT2JqZWN0LCB0aG91Z2ggRUpTT04gZG9lc24ndCBrbm93IGFib3V0XG4vLyBSZWdFeHBcbi8vIFhYWCBub3RlIHRoYXQgX3R5cGUodW5kZWZpbmVkKSA9PT0gMyEhISFcbkxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdCA9IHggPT4ge1xuICByZXR1cm4geCAmJiBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoeCkgPT09IDM7XG59O1xuXG4vLyBYWFggbmVlZCBhIHN0cmF0ZWd5IGZvciBwYXNzaW5nIHRoZSBiaW5kaW5nIG9mICQgaW50byB0aGlzXG4vLyBmdW5jdGlvbiwgZnJvbSB0aGUgY29tcGlsZWQgc2VsZWN0b3Jcbi8vXG4vLyBtYXliZSBqdXN0IHtrZXkudXAudG8uanVzdC5iZWZvcmUuZG9sbGFyc2lnbjogYXJyYXlfaW5kZXh9XG4vL1xuLy8gWFhYIGF0b21pY2l0eTogaWYgb25lIG1vZGlmaWNhdGlvbiBmYWlscywgZG8gd2Ugcm9sbCBiYWNrIHRoZSB3aG9sZVxuLy8gY2hhbmdlP1xuLy9cbi8vIG9wdGlvbnM6XG4vLyAgIC0gaXNJbnNlcnQgaXMgc2V0IHdoZW4gX21vZGlmeSBpcyBiZWluZyBjYWxsZWQgdG8gY29tcHV0ZSB0aGUgZG9jdW1lbnQgdG9cbi8vICAgICBpbnNlcnQgYXMgcGFydCBvZiBhbiB1cHNlcnQgb3BlcmF0aW9uLiBXZSB1c2UgdGhpcyBwcmltYXJpbHkgdG8gZmlndXJlXG4vLyAgICAgb3V0IHdoZW4gdG8gc2V0IHRoZSBmaWVsZHMgaW4gJHNldE9uSW5zZXJ0LCBpZiBwcmVzZW50LlxuTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkgPSAoZG9jLCBtb2RpZmllciwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KG1vZGlmaWVyKSkge1xuICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciBtdXN0IGJlIGFuIG9iamVjdCcpO1xuICB9XG5cbiAgLy8gTWFrZSBzdXJlIHRoZSBjYWxsZXIgY2FuJ3QgbXV0YXRlIG91ciBkYXRhIHN0cnVjdHVyZXMuXG4gIG1vZGlmaWVyID0gRUpTT04uY2xvbmUobW9kaWZpZXIpO1xuXG4gIGNvbnN0IGlzTW9kaWZpZXIgPSBpc09wZXJhdG9yT2JqZWN0KG1vZGlmaWVyKTtcbiAgY29uc3QgbmV3RG9jID0gaXNNb2RpZmllciA/IEVKU09OLmNsb25lKGRvYykgOiBtb2RpZmllcjtcblxuICBpZiAoaXNNb2RpZmllcikge1xuICAgIC8vIGFwcGx5IG1vZGlmaWVycyB0byB0aGUgZG9jLlxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyKS5mb3JFYWNoKG9wZXJhdG9yID0+IHtcbiAgICAgIC8vIFRyZWF0ICRzZXRPbkluc2VydCBhcyAkc2V0IGlmIHRoaXMgaXMgYW4gaW5zZXJ0LlxuICAgICAgY29uc3Qgc2V0T25JbnNlcnQgPSBvcHRpb25zLmlzSW5zZXJ0ICYmIG9wZXJhdG9yID09PSAnJHNldE9uSW5zZXJ0JztcbiAgICAgIGNvbnN0IG1vZEZ1bmMgPSBNT0RJRklFUlNbc2V0T25JbnNlcnQgPyAnJHNldCcgOiBvcGVyYXRvcl07XG4gICAgICBjb25zdCBvcGVyYW5kID0gbW9kaWZpZXJbb3BlcmF0b3JdO1xuXG4gICAgICBpZiAoIW1vZEZ1bmMpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoYEludmFsaWQgbW9kaWZpZXIgc3BlY2lmaWVkICR7b3BlcmF0b3J9YCk7XG4gICAgICB9XG5cbiAgICAgIE9iamVjdC5rZXlzKG9wZXJhbmQpLmZvckVhY2goa2V5cGF0aCA9PiB7XG4gICAgICAgIGNvbnN0IGFyZyA9IG9wZXJhbmRba2V5cGF0aF07XG5cbiAgICAgICAgaWYgKGtleXBhdGggPT09ICcnKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ0FuIGVtcHR5IHVwZGF0ZSBwYXRoIGlzIG5vdCB2YWxpZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGtleXBhcnRzID0ga2V5cGF0aC5zcGxpdCgnLicpO1xuXG4gICAgICAgIGlmICgha2V5cGFydHMuZXZlcnkoQm9vbGVhbikpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgIGBUaGUgdXBkYXRlIHBhdGggJyR7a2V5cGF0aH0nIGNvbnRhaW5zIGFuIGVtcHR5IGZpZWxkIG5hbWUsIGAgK1xuICAgICAgICAgICAgJ3doaWNoIGlzIG5vdCBhbGxvd2VkLidcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gZmluZE1vZFRhcmdldChuZXdEb2MsIGtleXBhcnRzLCB7XG4gICAgICAgICAgYXJyYXlJbmRpY2VzOiBvcHRpb25zLmFycmF5SW5kaWNlcyxcbiAgICAgICAgICBmb3JiaWRBcnJheTogb3BlcmF0b3IgPT09ICckcmVuYW1lJyxcbiAgICAgICAgICBub0NyZWF0ZTogTk9fQ1JFQVRFX01PRElGSUVSU1tvcGVyYXRvcl1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbW9kRnVuYyh0YXJnZXQsIGtleXBhcnRzLnBvcCgpLCBhcmcsIGtleXBhdGgsIG5ld0RvYyk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGlmIChkb2MuX2lkICYmICFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgbmV3RG9jLl9pZCkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICBgQWZ0ZXIgYXBwbHlpbmcgdGhlIHVwZGF0ZSB0byB0aGUgZG9jdW1lbnQge19pZDogXCIke2RvYy5faWR9XCIsIC4uLn0sYCArXG4gICAgICAgICcgdGhlIChpbW11dGFibGUpIGZpZWxkIFxcJ19pZFxcJyB3YXMgZm91bmQgdG8gaGF2ZSBiZWVuIGFsdGVyZWQgdG8gJyArXG4gICAgICAgIGBfaWQ6IFwiJHtuZXdEb2MuX2lkfVwiYFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRvYy5faWQgJiYgbW9kaWZpZXIuX2lkICYmICFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgbW9kaWZpZXIuX2lkKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBUaGUgX2lkIGZpZWxkIGNhbm5vdCBiZSBjaGFuZ2VkIGZyb20ge19pZDogXCIke2RvYy5faWR9XCJ9IHRvIGAgK1xuICAgICAgICBge19pZDogXCIke21vZGlmaWVyLl9pZH1cIn1gXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIHJlcGxhY2UgdGhlIHdob2xlIGRvY3VtZW50XG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKG1vZGlmaWVyKTtcbiAgfVxuXG4gIC8vIG1vdmUgbmV3IGRvY3VtZW50IGludG8gcGxhY2UuXG4gIE9iamVjdC5rZXlzKGRvYykuZm9yRWFjaChrZXkgPT4ge1xuICAgIC8vIE5vdGU6IHRoaXMgdXNlZCB0byBiZSBmb3IgKHZhciBrZXkgaW4gZG9jKSBob3dldmVyLCB0aGlzIGRvZXMgbm90XG4gICAgLy8gd29yayByaWdodCBpbiBPcGVyYS4gRGVsZXRpbmcgZnJvbSBhIGRvYyB3aGlsZSBpdGVyYXRpbmcgb3ZlciBpdFxuICAgIC8vIHdvdWxkIHNvbWV0aW1lcyBjYXVzZSBvcGVyYSB0byBza2lwIHNvbWUga2V5cy5cbiAgICBpZiAoa2V5ICE9PSAnX2lkJykge1xuICAgICAgZGVsZXRlIGRvY1trZXldO1xuICAgIH1cbiAgfSk7XG5cbiAgT2JqZWN0LmtleXMobmV3RG9jKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgZG9jW2tleV0gPSBuZXdEb2Nba2V5XTtcbiAgfSk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMgPSAoY3Vyc29yLCBvYnNlcnZlQ2FsbGJhY2tzKSA9PiB7XG4gIGNvbnN0IHRyYW5zZm9ybSA9IGN1cnNvci5nZXRUcmFuc2Zvcm0oKSB8fCAoZG9jID0+IGRvYyk7XG4gIGxldCBzdXBwcmVzc2VkID0gISFvYnNlcnZlQ2FsbGJhY2tzLl9zdXBwcmVzc19pbml0aWFsO1xuXG4gIGxldCBvYnNlcnZlQ2hhbmdlc0NhbGxiYWNrcztcbiAgaWYgKExvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNhbGxiYWNrc0FyZU9yZGVyZWQob2JzZXJ2ZUNhbGxiYWNrcykpIHtcbiAgICAvLyBUaGUgXCJfbm9faW5kaWNlc1wiIG9wdGlvbiBzZXRzIGFsbCBpbmRleCBhcmd1bWVudHMgdG8gLTEgYW5kIHNraXBzIHRoZVxuICAgIC8vIGxpbmVhciBzY2FucyByZXF1aXJlZCB0byBnZW5lcmF0ZSB0aGVtLiAgVGhpcyBsZXRzIG9ic2VydmVycyB0aGF0IGRvbid0XG4gICAgLy8gbmVlZCBhYnNvbHV0ZSBpbmRpY2VzIGJlbmVmaXQgZnJvbSB0aGUgb3RoZXIgZmVhdHVyZXMgb2YgdGhpcyBBUEkgLS1cbiAgICAvLyByZWxhdGl2ZSBvcmRlciwgdHJhbnNmb3JtcywgYW5kIGFwcGx5Q2hhbmdlcyAtLSB3aXRob3V0IHRoZSBzcGVlZCBoaXQuXG4gICAgY29uc3QgaW5kaWNlcyA9ICFvYnNlcnZlQ2FsbGJhY2tzLl9ub19pbmRpY2VzO1xuXG4gICAgb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3MgPSB7XG4gICAgICBhZGRlZEJlZm9yZShpZCwgZmllbGRzLCBiZWZvcmUpIHtcbiAgICAgICAgY29uc3QgY2hlY2sgPSBzdXBwcmVzc2VkIHx8ICEob2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZEF0IHx8IG9ic2VydmVDYWxsYmFja3MuYWRkZWQpXG4gICAgICAgIGlmIChjaGVjaykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRvYyA9IHRyYW5zZm9ybShPYmplY3QuYXNzaWduKGZpZWxkcywge19pZDogaWR9KSk7XG5cbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MuYWRkZWRBdCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuYWRkZWRBdChcbiAgICAgICAgICAgICAgZG9jLFxuICAgICAgICAgICAgICBpbmRpY2VzXG4gICAgICAgICAgICAgICAgICA/IGJlZm9yZVxuICAgICAgICAgICAgICAgICAgICAgID8gdGhpcy5kb2NzLmluZGV4T2YoYmVmb3JlKVxuICAgICAgICAgICAgICAgICAgICAgIDogdGhpcy5kb2NzLnNpemUoKVxuICAgICAgICAgICAgICAgICAgOiAtMSxcbiAgICAgICAgICAgICAgYmVmb3JlXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkKGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcblxuICAgICAgICBpZiAoIShvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWRBdCB8fCBvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGRvYyA9IEVKU09OLmNsb25lKHRoaXMuZG9jcy5nZXQoaWQpKTtcbiAgICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaWQgZm9yIGNoYW5nZWQ6ICR7aWR9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvbGREb2MgPSB0cmFuc2Zvcm0oRUpTT04uY2xvbmUoZG9jKSk7XG5cbiAgICAgICAgRGlmZlNlcXVlbmNlLmFwcGx5Q2hhbmdlcyhkb2MsIGZpZWxkcyk7XG5cbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZEF0KSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkQXQoXG4gICAgICAgICAgICAgIHRyYW5zZm9ybShkb2MpLFxuICAgICAgICAgICAgICBvbGREb2MsXG4gICAgICAgICAgICAgIGluZGljZXMgPyB0aGlzLmRvY3MuaW5kZXhPZihpZCkgOiAtMVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKHRyYW5zZm9ybShkb2MpLCBvbGREb2MpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgbW92ZWRCZWZvcmUoaWQsIGJlZm9yZSkge1xuICAgICAgICBpZiAoIW9ic2VydmVDYWxsYmFja3MubW92ZWRUbykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZyb20gPSBpbmRpY2VzID8gdGhpcy5kb2NzLmluZGV4T2YoaWQpIDogLTE7XG4gICAgICAgIGxldCB0byA9IGluZGljZXNcbiAgICAgICAgICAgID8gYmVmb3JlXG4gICAgICAgICAgICAgICAgPyB0aGlzLmRvY3MuaW5kZXhPZihiZWZvcmUpXG4gICAgICAgICAgICAgICAgOiB0aGlzLmRvY3Muc2l6ZSgpXG4gICAgICAgICAgICA6IC0xO1xuXG4gICAgICAgIC8vIFdoZW4gbm90IG1vdmluZyBiYWNrd2FyZHMsIGFkanVzdCBmb3IgdGhlIGZhY3QgdGhhdCByZW1vdmluZyB0aGVcbiAgICAgICAgLy8gZG9jdW1lbnQgc2xpZGVzIGV2ZXJ5dGhpbmcgYmFjayBvbmUgc2xvdC5cbiAgICAgICAgaWYgKHRvID4gZnJvbSkge1xuICAgICAgICAgIC0tdG87XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLm1vdmVkVG8oXG4gICAgICAgICAgICB0cmFuc2Zvcm0oRUpTT04uY2xvbmUodGhpcy5kb2NzLmdldChpZCkpKSxcbiAgICAgICAgICAgIGZyb20sXG4gICAgICAgICAgICB0byxcbiAgICAgICAgICAgIGJlZm9yZSB8fCBudWxsXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgcmVtb3ZlZChpZCkge1xuICAgICAgICBpZiAoIShvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWRBdCB8fCBvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVjaG5pY2FsbHkgbWF5YmUgdGhlcmUgc2hvdWxkIGJlIGFuIEVKU09OLmNsb25lIGhlcmUsIGJ1dCBpdCdzIGFib3V0XG4gICAgICAgIC8vIHRvIGJlIHJlbW92ZWQgZnJvbSB0aGlzLmRvY3MhXG4gICAgICAgIGNvbnN0IGRvYyA9IHRyYW5zZm9ybSh0aGlzLmRvY3MuZ2V0KGlkKSk7XG5cbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZEF0KSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkQXQoZG9jLCBpbmRpY2VzID8gdGhpcy5kb2NzLmluZGV4T2YoaWQpIDogLTEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZChkb2MpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3MgPSB7XG4gICAgICBhZGRlZChpZCwgZmllbGRzKSB7XG4gICAgICAgIGlmICghc3VwcHJlc3NlZCAmJiBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZCh0cmFuc2Zvcm0oT2JqZWN0LmFzc2lnbihmaWVsZHMsIHtfaWQ6IGlkfSkpKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGNoYW5nZWQoaWQsIGZpZWxkcykge1xuICAgICAgICBpZiAob2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKSB7XG4gICAgICAgICAgY29uc3Qgb2xkRG9jID0gdGhpcy5kb2NzLmdldChpZCk7XG4gICAgICAgICAgY29uc3QgZG9jID0gRUpTT04uY2xvbmUob2xkRG9jKTtcblxuICAgICAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoZG9jLCBmaWVsZHMpO1xuXG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKFxuICAgICAgICAgICAgICB0cmFuc2Zvcm0oZG9jKSxcbiAgICAgICAgICAgICAgdHJhbnNmb3JtKEVKU09OLmNsb25lKG9sZERvYykpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHJlbW92ZWQoaWQpIHtcbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZCh0cmFuc2Zvcm0odGhpcy5kb2NzLmdldChpZCkpKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgY2hhbmdlT2JzZXJ2ZXIgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIoe1xuICAgIGNhbGxiYWNrczogb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NcbiAgfSk7XG5cbiAgLy8gQ2FjaGluZ0NoYW5nZU9ic2VydmVyIGNsb25lcyBhbGwgcmVjZWl2ZWQgaW5wdXQgb24gaXRzIGNhbGxiYWNrc1xuICAvLyBTbyB3ZSBjYW4gbWFyayBpdCBhcyBzYWZlIHRvIHJlZHVjZSB0aGUgZWpzb24gY2xvbmVzLlxuICAvLyBUaGlzIGlzIHRlc3RlZCBieSB0aGUgYG1vbmdvLWxpdmVkYXRhIC0gKGV4dGVuZGVkKSBzY3JpYmJsaW5nYCB0ZXN0c1xuICBjaGFuZ2VPYnNlcnZlci5hcHBseUNoYW5nZS5fZnJvbU9ic2VydmUgPSB0cnVlO1xuICBjb25zdCBoYW5kbGUgPSBjdXJzb3Iub2JzZXJ2ZUNoYW5nZXMoY2hhbmdlT2JzZXJ2ZXIuYXBwbHlDaGFuZ2UsXG4gICAgICB7IG5vbk11dGF0aW5nQ2FsbGJhY2tzOiB0cnVlIH0pO1xuXG4gIC8vIElmIG5lZWRlZCwgcmUtZW5hYmxlIGNhbGxiYWNrcyBhcyBzb29uIGFzIHRoZSBpbml0aWFsIGJhdGNoIGlzIHJlYWR5LlxuICBjb25zdCBzZXRTdXBwcmVzc2VkID0gKGgpID0+IHtcbiAgICBpZiAoaC5pc1JlYWR5KSBzdXBwcmVzc2VkID0gZmFsc2U7XG4gICAgZWxzZSBoLmlzUmVhZHlQcm9taXNlPy50aGVuKCgpID0+IChzdXBwcmVzc2VkID0gZmFsc2UpKTtcbiAgfTtcbiAgLy8gV2hlbiB3ZSBjYWxsIGN1cnNvci5vYnNlcnZlQ2hhbmdlcygpIGl0IGNhbiBiZSB0aGUgb24gZnJvbVxuICAvLyB0aGUgbW9uZ28gcGFja2FnZSAoaW5zdGVhZCBvZiB0aGUgbWluaW1vbmdvIG9uZSkgYW5kIGl0IGRvZXNuJ3QgaGF2ZSBpc1JlYWR5IGFuZCBpc1JlYWR5UHJvbWlzZVxuICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UoaGFuZGxlKSkge1xuICAgIGhhbmRsZS50aGVuKHNldFN1cHByZXNzZWQpO1xuICB9IGVsc2Uge1xuICAgIHNldFN1cHByZXNzZWQoaGFuZGxlKTtcbiAgfVxuICByZXR1cm4gaGFuZGxlO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2FsbGJhY2tzQXJlT3JkZXJlZCA9IGNhbGxiYWNrcyA9PiB7XG4gIGlmIChjYWxsYmFja3MuYWRkZWQgJiYgY2FsbGJhY2tzLmFkZGVkQXQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IG9ubHkgb25lIG9mIGFkZGVkKCkgYW5kIGFkZGVkQXQoKScpO1xuICB9XG5cbiAgaWYgKGNhbGxiYWNrcy5jaGFuZ2VkICYmIGNhbGxiYWNrcy5jaGFuZ2VkQXQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IG9ubHkgb25lIG9mIGNoYW5nZWQoKSBhbmQgY2hhbmdlZEF0KCknKTtcbiAgfVxuXG4gIGlmIChjYWxsYmFja3MucmVtb3ZlZCAmJiBjYWxsYmFja3MucmVtb3ZlZEF0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBvbmx5IG9uZSBvZiByZW1vdmVkKCkgYW5kIHJlbW92ZWRBdCgpJyk7XG4gIH1cblxuICByZXR1cm4gISEoXG4gICAgY2FsbGJhY2tzLmFkZGVkQXQgfHxcbiAgICBjYWxsYmFja3MuY2hhbmdlZEF0IHx8XG4gICAgY2FsbGJhY2tzLm1vdmVkVG8gfHxcbiAgICBjYWxsYmFja3MucmVtb3ZlZEF0XG4gICk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZCA9IGNhbGxiYWNrcyA9PiB7XG4gIGlmIChjYWxsYmFja3MuYWRkZWQgJiYgY2FsbGJhY2tzLmFkZGVkQmVmb3JlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBvbmx5IG9uZSBvZiBhZGRlZCgpIGFuZCBhZGRlZEJlZm9yZSgpJyk7XG4gIH1cblxuICByZXR1cm4gISEoY2FsbGJhY2tzLmFkZGVkQmVmb3JlIHx8IGNhbGxiYWNrcy5tb3ZlZEJlZm9yZSk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzU3luYyA9IChxdWVyeSwgZG9jKSA9PiB7XG4gIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMocXVlcnksIGRvYyk7XG5cbiAgICBxdWVyeS5yZW1vdmVkKGRvYy5faWQpO1xuICAgIHF1ZXJ5LnJlc3VsdHMuc3BsaWNlKGksIDEpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGlkID0gZG9jLl9pZDsgIC8vIGluIGNhc2UgY2FsbGJhY2sgbXV0YXRlcyBkb2NcblxuICAgIHF1ZXJ5LnJlbW92ZWQoZG9jLl9pZCk7XG4gICAgcXVlcnkucmVzdWx0cy5yZW1vdmUoaWQpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzQXN5bmMgPSBhc3luYyAocXVlcnksIGRvYykgPT4ge1xuICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzKHF1ZXJ5LCBkb2MpO1xuXG4gICAgYXdhaXQgcXVlcnkucmVtb3ZlZChkb2MuX2lkKTtcbiAgICBxdWVyeS5yZXN1bHRzLnNwbGljZShpLCAxKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpZCA9IGRvYy5faWQ7ICAvLyBpbiBjYXNlIGNhbGxiYWNrIG11dGF0ZXMgZG9jXG5cbiAgICBhd2FpdCBxdWVyeS5yZW1vdmVkKGRvYy5faWQpO1xuICAgIHF1ZXJ5LnJlc3VsdHMucmVtb3ZlKGlkKTtcbiAgfVxufTtcblxuLy8gSXMgdGhpcyBzZWxlY3RvciBqdXN0IHNob3J0aGFuZCBmb3IgbG9va3VwIGJ5IF9pZD9cbkxvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkID0gc2VsZWN0b3IgPT5cbiAgdHlwZW9mIHNlbGVjdG9yID09PSAnbnVtYmVyJyB8fFxuICB0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnIHx8XG4gIHNlbGVjdG9yIGluc3RhbmNlb2YgTW9uZ29JRC5PYmplY3RJRFxuO1xuXG4vLyBJcyB0aGUgc2VsZWN0b3IganVzdCBsb29rdXAgYnkgX2lkIChzaG9ydGhhbmQgb3Igbm90KT9cbkxvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0ID0gc2VsZWN0b3IgPT5cbiAgTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IpIHx8XG4gIExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKHNlbGVjdG9yICYmIHNlbGVjdG9yLl9pZCkgJiZcbiAgT2JqZWN0LmtleXMoc2VsZWN0b3IpLmxlbmd0aCA9PT0gMVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c1N5bmMgPSAocXVlcnksIGRvYywgb2xkX2RvYykgPT4ge1xuICBpZiAoIUVKU09OLmVxdWFscyhkb2MuX2lkLCBvbGRfZG9jLl9pZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgY2hhbmdlIGEgZG9jXFwncyBfaWQgd2hpbGUgdXBkYXRpbmcnKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3Rpb25GbiA9IHF1ZXJ5LnByb2plY3Rpb25GbjtcbiAgY29uc3QgY2hhbmdlZEZpZWxkcyA9IERpZmZTZXF1ZW5jZS5tYWtlQ2hhbmdlZEZpZWxkcyhcbiAgICBwcm9qZWN0aW9uRm4oZG9jKSxcbiAgICBwcm9qZWN0aW9uRm4ob2xkX2RvYylcbiAgKTtcblxuICBpZiAoIXF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlZEZpZWxkcykubGVuZ3RoKSB7XG4gICAgICBxdWVyeS5jaGFuZ2VkKGRvYy5faWQsIGNoYW5nZWRGaWVsZHMpO1xuICAgICAgcXVlcnkucmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBvbGRfaWR4ID0gTG9jYWxDb2xsZWN0aW9uLl9maW5kSW5PcmRlcmVkUmVzdWx0cyhxdWVyeSwgZG9jKTtcblxuICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlZEZpZWxkcykubGVuZ3RoKSB7XG4gICAgcXVlcnkuY2hhbmdlZChkb2MuX2lkLCBjaGFuZ2VkRmllbGRzKTtcbiAgfVxuXG4gIGlmICghcXVlcnkuc29ydGVyKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8ganVzdCB0YWtlIGl0IG91dCBhbmQgcHV0IGl0IGJhY2sgaW4gYWdhaW4sIGFuZCBzZWUgaWYgdGhlIGluZGV4IGNoYW5nZXNcbiAgcXVlcnkucmVzdWx0cy5zcGxpY2Uob2xkX2lkeCwgMSk7XG5cbiAgY29uc3QgbmV3X2lkeCA9IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0KFxuICAgIHF1ZXJ5LnNvcnRlci5nZXRDb21wYXJhdG9yKHtkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlc30pLFxuICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgZG9jXG4gICk7XG5cbiAgaWYgKG9sZF9pZHggIT09IG5ld19pZHgpIHtcbiAgICBsZXQgbmV4dCA9IHF1ZXJ5LnJlc3VsdHNbbmV3X2lkeCArIDFdO1xuICAgIGlmIChuZXh0KSB7XG4gICAgICBuZXh0ID0gbmV4dC5faWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQgPSBudWxsO1xuICAgIH1cblxuICAgIHF1ZXJ5Lm1vdmVkQmVmb3JlICYmIHF1ZXJ5Lm1vdmVkQmVmb3JlKGRvYy5faWQsIG5leHQpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c0FzeW5jID0gYXN5bmMgKHF1ZXJ5LCBkb2MsIG9sZF9kb2MpID0+IHtcbiAgaWYgKCFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgb2xkX2RvYy5faWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGNoYW5nZSBhIGRvY1xcJ3MgX2lkIHdoaWxlIHVwZGF0aW5nJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0aW9uRm4gPSBxdWVyeS5wcm9qZWN0aW9uRm47XG4gIGNvbnN0IGNoYW5nZWRGaWVsZHMgPSBEaWZmU2VxdWVuY2UubWFrZUNoYW5nZWRGaWVsZHMoXG4gICAgcHJvamVjdGlvbkZuKGRvYyksXG4gICAgcHJvamVjdGlvbkZuKG9sZF9kb2MpXG4gICk7XG5cbiAgaWYgKCFxdWVyeS5vcmRlcmVkKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKGNoYW5nZWRGaWVsZHMpLmxlbmd0aCkge1xuICAgICAgYXdhaXQgcXVlcnkuY2hhbmdlZChkb2MuX2lkLCBjaGFuZ2VkRmllbGRzKTtcbiAgICAgIHF1ZXJ5LnJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgb2xkX2lkeCA9IExvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMocXVlcnksIGRvYyk7XG5cbiAgaWYgKE9iamVjdC5rZXlzKGNoYW5nZWRGaWVsZHMpLmxlbmd0aCkge1xuICAgIGF3YWl0IHF1ZXJ5LmNoYW5nZWQoZG9jLl9pZCwgY2hhbmdlZEZpZWxkcyk7XG4gIH1cblxuICBpZiAoIXF1ZXJ5LnNvcnRlcikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIGp1c3QgdGFrZSBpdCBvdXQgYW5kIHB1dCBpdCBiYWNrIGluIGFnYWluLCBhbmQgc2VlIGlmIHRoZSBpbmRleCBjaGFuZ2VzXG4gIHF1ZXJ5LnJlc3VsdHMuc3BsaWNlKG9sZF9pZHgsIDEpO1xuXG4gIGNvbnN0IG5ld19pZHggPSBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdChcbiAgICBxdWVyeS5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXN9KSxcbiAgICBxdWVyeS5yZXN1bHRzLFxuICAgIGRvY1xuICApO1xuXG4gIGlmIChvbGRfaWR4ICE9PSBuZXdfaWR4KSB7XG4gICAgbGV0IG5leHQgPSBxdWVyeS5yZXN1bHRzW25ld19pZHggKyAxXTtcbiAgICBpZiAobmV4dCkge1xuICAgICAgbmV4dCA9IG5leHQuX2lkO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBxdWVyeS5tb3ZlZEJlZm9yZSAmJiBhd2FpdCBxdWVyeS5tb3ZlZEJlZm9yZShkb2MuX2lkLCBuZXh0KTtcbiAgfVxufTtcblxuY29uc3QgTU9ESUZJRVJTID0ge1xuICAkY3VycmVudERhdGUodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGhhc093bi5jYWxsKGFyZywgJyR0eXBlJykpIHtcbiAgICAgIGlmIChhcmcuJHR5cGUgIT09ICdkYXRlJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnTWluaW1vbmdvIGRvZXMgY3VycmVudGx5IG9ubHkgc3VwcG9ydCB0aGUgZGF0ZSB0eXBlIGluICcgK1xuICAgICAgICAgICckY3VycmVudERhdGUgbW9kaWZpZXJzJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhcmcgIT09IHRydWUpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdJbnZhbGlkICRjdXJyZW50RGF0ZSBtb2RpZmllcicsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIHRhcmdldFtmaWVsZF0gPSBuZXcgRGF0ZSgpO1xuICB9LFxuICAkaW5jKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRpbmMgYWxsb3dlZCBmb3IgbnVtYmVycyBvbmx5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbZmllbGRdICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnQ2Fubm90IGFwcGx5ICRpbmMgbW9kaWZpZXIgdG8gbm9uLW51bWJlcicsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB0YXJnZXRbZmllbGRdICs9IGFyZztcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICB9XG4gIH0sXG4gICRtaW4odGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgJG1pbiBhbGxvd2VkIGZvciBudW1iZXJzIG9ubHknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICBpZiAodHlwZW9mIHRhcmdldFtmaWVsZF0gIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICdDYW5ub3QgYXBwbHkgJG1pbiBtb2RpZmllciB0byBub24tbnVtYmVyJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0YXJnZXRbZmllbGRdID4gYXJnKSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgfVxuICB9LFxuICAkbWF4KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRtYXggYWxsb3dlZCBmb3IgbnVtYmVycyBvbmx5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbZmllbGRdICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnQ2Fubm90IGFwcGx5ICRtYXggbW9kaWZpZXIgdG8gbm9uLW51bWJlcicsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodGFyZ2V0W2ZpZWxkXSA8IGFyZykge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgIH1cbiAgfSxcbiAgJG11bCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciAkbXVsIGFsbG93ZWQgZm9yIG51bWJlcnMgb25seScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmIChmaWVsZCBpbiB0YXJnZXQpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2ZpZWxkXSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJ0Nhbm5vdCBhcHBseSAkbXVsIG1vZGlmaWVyIHRvIG5vbi1udW1iZXInLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgdGFyZ2V0W2ZpZWxkXSAqPSBhcmc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSAwO1xuICAgIH1cbiAgfSxcbiAgJHJlbmFtZSh0YXJnZXQsIGZpZWxkLCBhcmcsIGtleXBhdGgsIGRvYykge1xuICAgIC8vIG5vIGlkZWEgd2h5IG1vbmdvIGhhcyB0aGlzIHJlc3RyaWN0aW9uLi5cbiAgICBpZiAoa2V5cGF0aCA9PT0gYXJnKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHJlbmFtZSBzb3VyY2UgbXVzdCBkaWZmZXIgZnJvbSB0YXJnZXQnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHJlbmFtZSBzb3VyY2UgZmllbGQgaW52YWxpZCcsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRyZW5hbWUgdGFyZ2V0IG11c3QgYmUgYSBzdHJpbmcnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoYXJnLmluY2x1ZGVzKCdcXDAnKSkge1xuICAgICAgLy8gTnVsbCBieXRlcyBhcmUgbm90IGFsbG93ZWQgaW4gTW9uZ28gZmllbGQgbmFtZXNcbiAgICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2xpbWl0cy8jUmVzdHJpY3Rpb25zLW9uLUZpZWxkLU5hbWVzXG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ1RoZSBcXCd0b1xcJyBmaWVsZCBmb3IgJHJlbmFtZSBjYW5ub3QgY29udGFpbiBhbiBlbWJlZGRlZCBudWxsIGJ5dGUnLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG9iamVjdCA9IHRhcmdldFtmaWVsZF07XG5cbiAgICBkZWxldGUgdGFyZ2V0W2ZpZWxkXTtcblxuICAgIGNvbnN0IGtleXBhcnRzID0gYXJnLnNwbGl0KCcuJyk7XG4gICAgY29uc3QgdGFyZ2V0MiA9IGZpbmRNb2RUYXJnZXQoZG9jLCBrZXlwYXJ0cywge2ZvcmJpZEFycmF5OiB0cnVlfSk7XG5cbiAgICBpZiAodGFyZ2V0MiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRyZW5hbWUgdGFyZ2V0IGZpZWxkIGludmFsaWQnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICB0YXJnZXQyW2tleXBhcnRzLnBvcCgpXSA9IG9iamVjdDtcbiAgfSxcbiAgJHNldCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0ICE9PSBPYmplY3QodGFyZ2V0KSkgeyAvLyBub3QgYW4gYXJyYXkgb3IgYW4gb2JqZWN0XG4gICAgICBjb25zdCBlcnJvciA9IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IHNldCBwcm9wZXJ0eSBvbiBub24tb2JqZWN0IGZpZWxkJyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICAgIGVycm9yLnNldFByb3BlcnR5RXJyb3IgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgY29uc3QgZXJyb3IgPSBNaW5pbW9uZ29FcnJvcignQ2Fubm90IHNldCBwcm9wZXJ0eSBvbiBudWxsJywge2ZpZWxkfSk7XG4gICAgICBlcnJvci5zZXRQcm9wZXJ0eUVycm9yID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cblxuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhhcmcpO1xuXG4gICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgfSxcbiAgJHNldE9uSW5zZXJ0KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIC8vIGNvbnZlcnRlZCB0byBgJHNldGAgaW4gYF9tb2RpZnlgXG4gIH0sXG4gICR1bnNldCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB0YXJnZXRbZmllbGRdO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJHB1c2godGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldFtmaWVsZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IFtdO1xuICAgIH1cblxuICAgIGlmICghKHRhcmdldFtmaWVsZF0gaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdDYW5ub3QgYXBwbHkgJHB1c2ggbW9kaWZpZXIgdG8gbm9uLWFycmF5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKCEoYXJnICYmIGFyZy4kZWFjaCkpIHtcbiAgICAgIC8vIFNpbXBsZSBtb2RlOiBub3QgJGVhY2hcbiAgICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhhcmcpO1xuXG4gICAgICB0YXJnZXRbZmllbGRdLnB1c2goYXJnKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEZhbmN5IG1vZGU6ICRlYWNoIChhbmQgbWF5YmUgJHNsaWNlIGFuZCAkc29ydCBhbmQgJHBvc2l0aW9uKVxuICAgIGNvbnN0IHRvUHVzaCA9IGFyZy4kZWFjaDtcbiAgICBpZiAoISh0b1B1c2ggaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckZWFjaCBtdXN0IGJlIGFuIGFycmF5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKHRvUHVzaCk7XG5cbiAgICAvLyBQYXJzZSAkcG9zaXRpb25cbiAgICBsZXQgcG9zaXRpb24gPSB1bmRlZmluZWQ7XG4gICAgaWYgKCckcG9zaXRpb24nIGluIGFyZykge1xuICAgICAgaWYgKHR5cGVvZiBhcmcuJHBvc2l0aW9uICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHBvc2l0aW9uIG11c3QgYmUgYSBudW1lcmljIHZhbHVlJywge2ZpZWxkfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBzaG91bGQgY2hlY2sgdG8gbWFrZSBzdXJlIGludGVnZXJcbiAgICAgIGlmIChhcmcuJHBvc2l0aW9uIDwgMCkge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnJHBvc2l0aW9uIGluICRwdXNoIG11c3QgYmUgemVybyBvciBwb3NpdGl2ZScsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBwb3NpdGlvbiA9IGFyZy4kcG9zaXRpb247XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgJHNsaWNlLlxuICAgIGxldCBzbGljZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoJyRzbGljZScgaW4gYXJnKSB7XG4gICAgICBpZiAodHlwZW9mIGFyZy4kc2xpY2UgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckc2xpY2UgbXVzdCBiZSBhIG51bWVyaWMgdmFsdWUnLCB7ZmllbGR9KTtcbiAgICAgIH1cblxuICAgICAgLy8gWFhYIHNob3VsZCBjaGVjayB0byBtYWtlIHN1cmUgaW50ZWdlclxuICAgICAgc2xpY2UgPSBhcmcuJHNsaWNlO1xuICAgIH1cblxuICAgIC8vIFBhcnNlICRzb3J0LlxuICAgIGxldCBzb3J0RnVuY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgaWYgKGFyZy4kc29ydCkge1xuICAgICAgaWYgKHNsaWNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRzb3J0IHJlcXVpcmVzICRzbGljZSB0byBiZSBwcmVzZW50Jywge2ZpZWxkfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCB0aGlzIGFsbG93cyB1cyB0byB1c2UgYSAkc29ydCB3aG9zZSB2YWx1ZSBpcyBhbiBhcnJheSwgYnV0IHRoYXQnc1xuICAgICAgLy8gYWN0dWFsbHkgYW4gZXh0ZW5zaW9uIG9mIHRoZSBOb2RlIGRyaXZlciwgc28gaXQgd29uJ3Qgd29ya1xuICAgICAgLy8gc2VydmVyLXNpZGUuIENvdWxkIGJlIGNvbmZ1c2luZyFcbiAgICAgIC8vIFhYWCBpcyBpdCBjb3JyZWN0IHRoYXQgd2UgZG9uJ3QgZG8gZ2VvLXN0dWZmIGhlcmU/XG4gICAgICBzb3J0RnVuY3Rpb24gPSBuZXcgTWluaW1vbmdvLlNvcnRlcihhcmcuJHNvcnQpLmdldENvbXBhcmF0b3IoKTtcblxuICAgICAgdG9QdXNoLmZvckVhY2goZWxlbWVudCA9PiB7XG4gICAgICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoZWxlbWVudCkgIT09IDMpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgICckcHVzaCBsaWtlIG1vZGlmaWVycyB1c2luZyAkc29ydCByZXF1aXJlIGFsbCBlbGVtZW50cyB0byBiZSAnICtcbiAgICAgICAgICAgICdvYmplY3RzJyxcbiAgICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBY3R1YWxseSBwdXNoLlxuICAgIGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0b1B1c2guZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXS5wdXNoKGVsZW1lbnQpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHNwbGljZUFyZ3VtZW50cyA9IFtwb3NpdGlvbiwgMF07XG5cbiAgICAgIHRvUHVzaC5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBzcGxpY2VBcmd1bWVudHMucHVzaChlbGVtZW50KTtcbiAgICAgIH0pO1xuXG4gICAgICB0YXJnZXRbZmllbGRdLnNwbGljZSguLi5zcGxpY2VBcmd1bWVudHMpO1xuICAgIH1cblxuICAgIC8vIEFjdHVhbGx5IHNvcnQuXG4gICAgaWYgKHNvcnRGdW5jdGlvbikge1xuICAgICAgdGFyZ2V0W2ZpZWxkXS5zb3J0KHNvcnRGdW5jdGlvbik7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgc2xpY2UuXG4gICAgaWYgKHNsaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChzbGljZSA9PT0gMCkge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gW107IC8vIGRpZmZlcnMgZnJvbSBBcnJheS5zbGljZSFcbiAgICAgIH0gZWxzZSBpZiAoc2xpY2UgPCAwKSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSB0YXJnZXRbZmllbGRdLnNsaWNlKHNsaWNlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSB0YXJnZXRbZmllbGRdLnNsaWNlKDAsIHNsaWNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICRwdXNoQWxsKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICghKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRwdXNoQWxsL3B1bGxBbGwgYWxsb3dlZCBmb3IgYXJyYXlzIG9ubHknKTtcbiAgICB9XG5cbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMoYXJnKTtcblxuICAgIGNvbnN0IHRvUHVzaCA9IHRhcmdldFtmaWVsZF07XG5cbiAgICBpZiAodG9QdXNoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgfSBlbHNlIGlmICghKHRvUHVzaCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdDYW5ub3QgYXBwbHkgJHB1c2hBbGwgbW9kaWZpZXIgdG8gbm9uLWFycmF5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9QdXNoLnB1c2goLi4uYXJnKTtcbiAgICB9XG4gIH0sXG4gICRhZGRUb1NldCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBsZXQgaXNFYWNoID0gZmFsc2U7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGZpcnN0IGtleSBpcyAnJGVhY2gnXG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoYXJnKTtcbiAgICAgIGlmIChrZXlzWzBdID09PSAnJGVhY2gnKSB7XG4gICAgICAgIGlzRWFjaCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdmFsdWVzID0gaXNFYWNoID8gYXJnLiRlYWNoIDogW2FyZ107XG5cbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXModmFsdWVzKTtcblxuICAgIGNvbnN0IHRvQWRkID0gdGFyZ2V0W2ZpZWxkXTtcbiAgICBpZiAodG9BZGQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IHZhbHVlcztcbiAgICB9IGVsc2UgaWYgKCEodG9BZGQgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IGFwcGx5ICRhZGRUb1NldCBtb2RpZmllciB0byBub24tYXJyYXknLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZXMuZm9yRWFjaCh2YWx1ZSA9PiB7XG4gICAgICAgIGlmICh0b0FkZC5zb21lKGVsZW1lbnQgPT4gTG9jYWxDb2xsZWN0aW9uLl9mLl9lcXVhbCh2YWx1ZSwgZWxlbWVudCkpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9BZGQucHVzaCh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICRwb3AodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdG9Qb3AgPSB0YXJnZXRbZmllbGRdO1xuXG4gICAgaWYgKHRvUG9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoISh0b1BvcCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ0Nhbm5vdCBhcHBseSAkcG9wIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJyAmJiBhcmcgPCAwKSB7XG4gICAgICB0b1BvcC5zcGxpY2UoMCwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvUG9wLnBvcCgpO1xuICAgIH1cbiAgfSxcbiAgJHB1bGwodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdG9QdWxsID0gdGFyZ2V0W2ZpZWxkXTtcbiAgICBpZiAodG9QdWxsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoISh0b1B1bGwgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IGFwcGx5ICRwdWxsL3B1bGxBbGwgbW9kaWZpZXIgdG8gbm9uLWFycmF5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgb3V0O1xuICAgIGlmIChhcmcgIT0gbnVsbCAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiAhKGFyZyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgLy8gWFhYIHdvdWxkIGJlIG11Y2ggbmljZXIgdG8gY29tcGlsZSB0aGlzIG9uY2UsIHJhdGhlciB0aGFuXG4gICAgICAvLyBmb3IgZWFjaCBkb2N1bWVudCB3ZSBtb2RpZnkuLiBidXQgdXN1YWxseSB3ZSdyZSBub3RcbiAgICAgIC8vIG1vZGlmeWluZyB0aGF0IG1hbnkgZG9jdW1lbnRzLCBzbyB3ZSdsbCBsZXQgaXQgc2xpZGUgZm9yXG4gICAgICAvLyBub3dcblxuICAgICAgLy8gWFhYIE1pbmltb25nby5NYXRjaGVyIGlzbid0IHVwIGZvciB0aGUgam9iLCBiZWNhdXNlIHdlIG5lZWRcbiAgICAgIC8vIHRvIHBlcm1pdCBzdHVmZiBsaWtlIHskcHVsbDoge2E6IHskZ3Q6IDR9fX0uLiBzb21ldGhpbmdcbiAgICAgIC8vIGxpa2UgeyRndDogNH0gaXMgbm90IG5vcm1hbGx5IGEgY29tcGxldGUgc2VsZWN0b3IuXG4gICAgICAvLyBzYW1lIGlzc3VlIGFzICRlbGVtTWF0Y2ggcG9zc2libHk/XG4gICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKGFyZyk7XG5cbiAgICAgIG91dCA9IHRvUHVsbC5maWx0ZXIoZWxlbWVudCA9PiAhbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZWxlbWVudCkucmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0ID0gdG9QdWxsLmZpbHRlcihlbGVtZW50ID0+ICFMb2NhbENvbGxlY3Rpb24uX2YuX2VxdWFsKGVsZW1lbnQsIGFyZykpO1xuICAgIH1cblxuICAgIHRhcmdldFtmaWVsZF0gPSBvdXQ7XG4gIH0sXG4gICRwdWxsQWxsKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICghKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdNb2RpZmllciAkcHVzaEFsbC9wdWxsQWxsIGFsbG93ZWQgZm9yIGFycmF5cyBvbmx5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0b1B1bGwgPSB0YXJnZXRbZmllbGRdO1xuXG4gICAgaWYgKHRvUHVsbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCEodG9QdWxsIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBhcHBseSAkcHVsbC9wdWxsQWxsIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGFyZ2V0W2ZpZWxkXSA9IHRvUHVsbC5maWx0ZXIob2JqZWN0ID0+XG4gICAgICAhYXJnLnNvbWUoZWxlbWVudCA9PiBMb2NhbENvbGxlY3Rpb24uX2YuX2VxdWFsKG9iamVjdCwgZWxlbWVudCkpXG4gICAgKTtcbiAgfSxcbiAgJGJpdCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICAvLyBYWFggbW9uZ28gb25seSBzdXBwb3J0cyAkYml0IG9uIGludGVnZXJzLCBhbmQgd2Ugb25seSBzdXBwb3J0XG4gICAgLy8gbmF0aXZlIGphdmFzY3JpcHQgbnVtYmVycyAoZG91Ymxlcykgc28gZmFyLCBzbyB3ZSBjYW4ndCBzdXBwb3J0ICRiaXRcbiAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJGJpdCBpcyBub3Qgc3VwcG9ydGVkJywge2ZpZWxkfSk7XG4gIH0sXG4gICR2KCkge1xuICAgIC8vIEFzIGRpc2N1c3NlZCBpbiBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvOTYyMyxcbiAgICAvLyB0aGUgYCR2YCBvcGVyYXRvciBpcyBub3QgbmVlZGVkIGJ5IE1ldGVvciwgYnV0IHByb2JsZW1zIGNhbiBvY2N1ciBpZlxuICAgIC8vIGl0J3Mgbm90IGF0IGxlYXN0IGNhbGxhYmxlIChhcyBvZiBNb25nbyA+PSAzLjYpLiBJdCdzIGRlZmluZWQgaGVyZSBhc1xuICAgIC8vIGEgbm8tb3AgdG8gd29yayBhcm91bmQgdGhlc2UgcHJvYmxlbXMuXG4gIH1cbn07XG5cbmNvbnN0IE5PX0NSRUFURV9NT0RJRklFUlMgPSB7XG4gICRwb3A6IHRydWUsXG4gICRwdWxsOiB0cnVlLFxuICAkcHVsbEFsbDogdHJ1ZSxcbiAgJHJlbmFtZTogdHJ1ZSxcbiAgJHVuc2V0OiB0cnVlXG59O1xuXG4vLyBNYWtlIHN1cmUgZmllbGQgbmFtZXMgZG8gbm90IGNvbnRhaW4gTW9uZ28gcmVzdHJpY3RlZFxuLy8gY2hhcmFjdGVycyAoJy4nLCAnJCcsICdcXDAnKS5cbi8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2xpbWl0cy8jUmVzdHJpY3Rpb25zLW9uLUZpZWxkLU5hbWVzXG5jb25zdCBpbnZhbGlkQ2hhck1zZyA9IHtcbiAgJDogJ3N0YXJ0IHdpdGggXFwnJFxcJycsXG4gICcuJzogJ2NvbnRhaW4gXFwnLlxcJycsXG4gICdcXDAnOiAnY29udGFpbiBudWxsIGJ5dGVzJ1xufTtcblxuLy8gY2hlY2tzIGlmIGFsbCBmaWVsZCBuYW1lcyBpbiBhbiBvYmplY3QgYXJlIHZhbGlkXG5mdW5jdGlvbiBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMoZG9jKSB7XG4gIGlmIChkb2MgJiYgdHlwZW9mIGRvYyA9PT0gJ29iamVjdCcpIHtcbiAgICBKU09OLnN0cmluZ2lmeShkb2MsIChrZXksIHZhbHVlKSA9PiB7XG4gICAgICBhc3NlcnRJc1ZhbGlkRmllbGROYW1lKGtleSk7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0SXNWYWxpZEZpZWxkTmFtZShrZXkpIHtcbiAgbGV0IG1hdGNoO1xuICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycgJiYgKG1hdGNoID0ga2V5Lm1hdGNoKC9eXFwkfFxcLnxcXDAvKSkpIHtcbiAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihgS2V5ICR7a2V5fSBtdXN0IG5vdCAke2ludmFsaWRDaGFyTXNnW21hdGNoWzBdXX1gKTtcbiAgfVxufVxuXG4vLyBmb3IgYS5iLmMuMi5kLmUsIGtleXBhcnRzIHNob3VsZCBiZSBbJ2EnLCAnYicsICdjJywgJzInLCAnZCcsICdlJ10sXG4vLyBhbmQgdGhlbiB5b3Ugd291bGQgb3BlcmF0ZSBvbiB0aGUgJ2UnIHByb3BlcnR5IG9mIHRoZSByZXR1cm5lZFxuLy8gb2JqZWN0LlxuLy9cbi8vIGlmIG9wdGlvbnMubm9DcmVhdGUgaXMgZmFsc2V5LCBjcmVhdGVzIGludGVybWVkaWF0ZSBsZXZlbHMgb2Zcbi8vIHN0cnVjdHVyZSBhcyBuZWNlc3NhcnksIGxpa2UgbWtkaXIgLXAgKGFuZCByYWlzZXMgYW4gZXhjZXB0aW9uIGlmXG4vLyB0aGF0IHdvdWxkIG1lYW4gZ2l2aW5nIGEgbm9uLW51bWVyaWMgcHJvcGVydHkgdG8gYW4gYXJyYXkuKSBpZlxuLy8gb3B0aW9ucy5ub0NyZWF0ZSBpcyB0cnVlLCByZXR1cm4gdW5kZWZpbmVkIGluc3RlYWQuXG4vL1xuLy8gbWF5IG1vZGlmeSB0aGUgbGFzdCBlbGVtZW50IG9mIGtleXBhcnRzIHRvIHNpZ25hbCB0byB0aGUgY2FsbGVyIHRoYXQgaXQgbmVlZHNcbi8vIHRvIHVzZSBhIGRpZmZlcmVudCB2YWx1ZSB0byBpbmRleCBpbnRvIHRoZSByZXR1cm5lZCBvYmplY3QgKGZvciBleGFtcGxlLFxuLy8gWydhJywgJzAxJ10gLT4gWydhJywgMV0pLlxuLy9cbi8vIGlmIGZvcmJpZEFycmF5IGlzIHRydWUsIHJldHVybiBudWxsIGlmIHRoZSBrZXlwYXRoIGdvZXMgdGhyb3VnaCBhbiBhcnJheS5cbi8vXG4vLyBpZiBvcHRpb25zLmFycmF5SW5kaWNlcyBpcyBzZXQsIHVzZSBpdHMgZmlyc3QgZWxlbWVudCBmb3IgdGhlIChmaXJzdCkgJyQnIGluXG4vLyB0aGUgcGF0aC5cbmZ1bmN0aW9uIGZpbmRNb2RUYXJnZXQoZG9jLCBrZXlwYXJ0cywgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCB1c2VkQXJyYXlJbmRleCA9IGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBsYXN0ID0gaSA9PT0ga2V5cGFydHMubGVuZ3RoIC0gMTtcbiAgICBsZXQga2V5cGFydCA9IGtleXBhcnRzW2ldO1xuXG4gICAgaWYgKCFpc0luZGV4YWJsZShkb2MpKSB7XG4gICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlcnJvciA9IE1pbmltb25nb0Vycm9yKFxuICAgICAgICBgY2Fubm90IHVzZSB0aGUgcGFydCAnJHtrZXlwYXJ0fScgdG8gdHJhdmVyc2UgJHtkb2N9YFxuICAgICAgKTtcbiAgICAgIGVycm9yLnNldFByb3BlcnR5RXJyb3IgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKGRvYyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICBpZiAob3B0aW9ucy5mb3JiaWRBcnJheSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKGtleXBhcnQgPT09ICckJykge1xuICAgICAgICBpZiAodXNlZEFycmF5SW5kZXgpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignVG9vIG1hbnkgcG9zaXRpb25hbCAoaS5lLiBcXCckXFwnKSBlbGVtZW50cycpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLmFycmF5SW5kaWNlcyB8fCAhb3B0aW9ucy5hcnJheUluZGljZXMubGVuZ3RoKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgICAnVGhlIHBvc2l0aW9uYWwgb3BlcmF0b3IgZGlkIG5vdCBmaW5kIHRoZSBtYXRjaCBuZWVkZWQgZnJvbSB0aGUgJyArXG4gICAgICAgICAgICAncXVlcnknXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleXBhcnQgPSBvcHRpb25zLmFycmF5SW5kaWNlc1swXTtcbiAgICAgICAgdXNlZEFycmF5SW5kZXggPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChpc051bWVyaWNLZXkoa2V5cGFydCkpIHtcbiAgICAgICAga2V5cGFydCA9IHBhcnNlSW50KGtleXBhcnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9wdGlvbnMubm9DcmVhdGUpIHtcbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgYGNhbid0IGFwcGVuZCB0byBhcnJheSB1c2luZyBzdHJpbmcgZmllbGQgbmFtZSBbJHtrZXlwYXJ0fV1gXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChsYXN0KSB7XG4gICAgICAgIGtleXBhcnRzW2ldID0ga2V5cGFydDsgLy8gaGFuZGxlICdhLjAxJ1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSAmJiBrZXlwYXJ0ID49IGRvYy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKGRvYy5sZW5ndGggPCBrZXlwYXJ0KSB7XG4gICAgICAgIGRvYy5wdXNoKG51bGwpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWxhc3QpIHtcbiAgICAgICAgaWYgKGRvYy5sZW5ndGggPT09IGtleXBhcnQpIHtcbiAgICAgICAgICBkb2MucHVzaCh7fSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRvY1trZXlwYXJ0XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgIGBjYW4ndCBtb2RpZnkgZmllbGQgJyR7a2V5cGFydHNbaSArIDFdfScgb2YgbGlzdCB2YWx1ZSBgICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGRvY1trZXlwYXJ0XSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGFzc2VydElzVmFsaWRGaWVsZE5hbWUoa2V5cGFydCk7XG5cbiAgICAgIGlmICghKGtleXBhcnQgaW4gZG9jKSkge1xuICAgICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSkge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3QpIHtcbiAgICAgICAgICBkb2Nba2V5cGFydF0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsYXN0KSB7XG4gICAgICByZXR1cm4gZG9jO1xuICAgIH1cblxuICAgIGRvYyA9IGRvY1trZXlwYXJ0XTtcbiAgfVxuXG4gIC8vIG5vdHJlYWNoZWRcbn1cbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb24gZnJvbSAnLi9sb2NhbF9jb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7XG4gIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yLFxuICBoYXNPd24sXG4gIG5vdGhpbmdNYXRjaGVyLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbmNvbnN0IERlY2ltYWwgPSBQYWNrYWdlWydtb25nby1kZWNpbWFsJ10/LkRlY2ltYWwgfHwgY2xhc3MgRGVjaW1hbFN0dWIge31cblxuLy8gVGhlIG1pbmltb25nbyBzZWxlY3RvciBjb21waWxlciFcblxuLy8gVGVybWlub2xvZ3k6XG4vLyAgLSBhICdzZWxlY3RvcicgaXMgdGhlIEVKU09OIG9iamVjdCByZXByZXNlbnRpbmcgYSBzZWxlY3RvclxuLy8gIC0gYSAnbWF0Y2hlcicgaXMgaXRzIGNvbXBpbGVkIGZvcm0gKHdoZXRoZXIgYSBmdWxsIE1pbmltb25nby5NYXRjaGVyXG4vLyAgICBvYmplY3Qgb3Igb25lIG9mIHRoZSBjb21wb25lbnQgbGFtYmRhcyB0aGF0IG1hdGNoZXMgcGFydHMgb2YgaXQpXG4vLyAgLSBhICdyZXN1bHQgb2JqZWN0JyBpcyBhbiBvYmplY3Qgd2l0aCBhICdyZXN1bHQnIGZpZWxkIGFuZCBtYXliZVxuLy8gICAgZGlzdGFuY2UgYW5kIGFycmF5SW5kaWNlcy5cbi8vICAtIGEgJ2JyYW5jaGVkIHZhbHVlJyBpcyBhbiBvYmplY3Qgd2l0aCBhICd2YWx1ZScgZmllbGQgYW5kIG1heWJlXG4vLyAgICAnZG9udEl0ZXJhdGUnIGFuZCAnYXJyYXlJbmRpY2VzJy5cbi8vICAtIGEgJ2RvY3VtZW50JyBpcyBhIHRvcC1sZXZlbCBvYmplY3QgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgY29sbGVjdGlvbi5cbi8vICAtIGEgJ2xvb2t1cCBmdW5jdGlvbicgaXMgYSBmdW5jdGlvbiB0aGF0IHRha2VzIGluIGEgZG9jdW1lbnQgYW5kIHJldHVybnNcbi8vICAgIGFuIGFycmF5IG9mICdicmFuY2hlZCB2YWx1ZXMnLlxuLy8gIC0gYSAnYnJhbmNoZWQgbWF0Y2hlcicgbWFwcyBmcm9tIGFuIGFycmF5IG9mIGJyYW5jaGVkIHZhbHVlcyB0byBhIHJlc3VsdFxuLy8gICAgb2JqZWN0LlxuLy8gIC0gYW4gJ2VsZW1lbnQgbWF0Y2hlcicgbWFwcyBmcm9tIGEgc2luZ2xlIHZhbHVlIHRvIGEgYm9vbC5cblxuLy8gTWFpbiBlbnRyeSBwb2ludC5cbi8vICAgdmFyIG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoe2E6IHskZ3Q6IDV9fSk7XG4vLyAgIGlmIChtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7YTogN30pKSAuLi5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hdGNoZXIge1xuICBjb25zdHJ1Y3RvcihzZWxlY3RvciwgaXNVcGRhdGUpIHtcbiAgICAvLyBBIHNldCAob2JqZWN0IG1hcHBpbmcgc3RyaW5nIC0+ICopIG9mIGFsbCBvZiB0aGUgZG9jdW1lbnQgcGF0aHMgbG9va2VkXG4gICAgLy8gYXQgYnkgdGhlIHNlbGVjdG9yLiBBbHNvIGluY2x1ZGVzIHRoZSBlbXB0eSBzdHJpbmcgaWYgaXQgbWF5IGxvb2sgYXQgYW55XG4gICAgLy8gcGF0aCAoZWcsICR3aGVyZSkuXG4gICAgdGhpcy5fcGF0aHMgPSB7fTtcbiAgICAvLyBTZXQgdG8gdHJ1ZSBpZiBjb21waWxhdGlvbiBmaW5kcyBhICRuZWFyLlxuICAgIHRoaXMuX2hhc0dlb1F1ZXJ5ID0gZmFsc2U7XG4gICAgLy8gU2V0IHRvIHRydWUgaWYgY29tcGlsYXRpb24gZmluZHMgYSAkd2hlcmUuXG4gICAgdGhpcy5faGFzV2hlcmUgPSBmYWxzZTtcbiAgICAvLyBTZXQgdG8gZmFsc2UgaWYgY29tcGlsYXRpb24gZmluZHMgYW55dGhpbmcgb3RoZXIgdGhhbiBhIHNpbXBsZSBlcXVhbGl0eVxuICAgIC8vIG9yIG9uZSBvciBtb3JlIG9mICckZ3QnLCAnJGd0ZScsICckbHQnLCAnJGx0ZScsICckbmUnLCAnJGluJywgJyRuaW4nIHVzZWRcbiAgICAvLyB3aXRoIHNjYWxhcnMgYXMgb3BlcmFuZHMuXG4gICAgdGhpcy5faXNTaW1wbGUgPSB0cnVlO1xuICAgIC8vIFNldCB0byBhIGR1bW15IGRvY3VtZW50IHdoaWNoIGFsd2F5cyBtYXRjaGVzIHRoaXMgTWF0Y2hlci4gT3Igc2V0IHRvIG51bGxcbiAgICAvLyBpZiBzdWNoIGRvY3VtZW50IGlzIHRvbyBoYXJkIHRvIGZpbmQuXG4gICAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IHVuZGVmaW5lZDtcbiAgICAvLyBBIGNsb25lIG9mIHRoZSBvcmlnaW5hbCBzZWxlY3Rvci4gSXQgbWF5IGp1c3QgYmUgYSBmdW5jdGlvbiBpZiB0aGUgdXNlclxuICAgIC8vIHBhc3NlZCBpbiBhIGZ1bmN0aW9uOyBvdGhlcndpc2UgaXMgZGVmaW5pdGVseSBhbiBvYmplY3QgKGVnLCBJRHMgYXJlXG4gICAgLy8gdHJhbnNsYXRlZCBpbnRvIHtfaWQ6IElEfSBmaXJzdC4gVXNlZCBieSBjYW5CZWNvbWVUcnVlQnlNb2RpZmllciBhbmRcbiAgICAvLyBTb3J0ZXIuX3VzZVdpdGhNYXRjaGVyLlxuICAgIHRoaXMuX3NlbGVjdG9yID0gbnVsbDtcbiAgICB0aGlzLl9kb2NNYXRjaGVyID0gdGhpcy5fY29tcGlsZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAvLyBTZXQgdG8gdHJ1ZSBpZiBzZWxlY3Rpb24gaXMgZG9uZSBmb3IgYW4gdXBkYXRlIG9wZXJhdGlvblxuICAgIC8vIERlZmF1bHQgaXMgZmFsc2VcbiAgICAvLyBVc2VkIGZvciAkbmVhciBhcnJheSB1cGRhdGUgKGlzc3VlICMzNTk5KVxuICAgIHRoaXMuX2lzVXBkYXRlID0gaXNVcGRhdGU7XG4gIH1cblxuICBkb2N1bWVudE1hdGNoZXMoZG9jKSB7XG4gICAgaWYgKGRvYyAhPT0gT2JqZWN0KGRvYykpIHtcbiAgICAgIHRocm93IEVycm9yKCdkb2N1bWVudE1hdGNoZXMgbmVlZHMgYSBkb2N1bWVudCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9kb2NNYXRjaGVyKGRvYyk7XG4gIH1cblxuICBoYXNHZW9RdWVyeSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzR2VvUXVlcnk7XG4gIH1cblxuICBoYXNXaGVyZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzV2hlcmU7XG4gIH1cblxuICBpc1NpbXBsZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faXNTaW1wbGU7XG4gIH1cblxuICAvLyBHaXZlbiBhIHNlbGVjdG9yLCByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIG9uZSBhcmd1bWVudCwgYVxuICAvLyBkb2N1bWVudC4gSXQgcmV0dXJucyBhIHJlc3VsdCBvYmplY3QuXG4gIF9jb21waWxlU2VsZWN0b3Ioc2VsZWN0b3IpIHtcbiAgICAvLyB5b3UgY2FuIHBhc3MgYSBsaXRlcmFsIGZ1bmN0aW9uIGluc3RlYWQgb2YgYSBzZWxlY3RvclxuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICB0aGlzLl9pc1NpbXBsZSA9IGZhbHNlO1xuICAgICAgdGhpcy5fc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICAgIHRoaXMuX3JlY29yZFBhdGhVc2VkKCcnKTtcblxuICAgICAgcmV0dXJuIGRvYyA9PiAoe3Jlc3VsdDogISFzZWxlY3Rvci5jYWxsKGRvYyl9KTtcbiAgICB9XG5cbiAgICAvLyBzaG9ydGhhbmQgLS0gc2NhbGFyIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHtcbiAgICAgIHRoaXMuX3NlbGVjdG9yID0ge19pZDogc2VsZWN0b3J9O1xuICAgICAgdGhpcy5fcmVjb3JkUGF0aFVzZWQoJ19pZCcpO1xuXG4gICAgICByZXR1cm4gZG9jID0+ICh7cmVzdWx0OiBFSlNPTi5lcXVhbHMoZG9jLl9pZCwgc2VsZWN0b3IpfSk7XG4gICAgfVxuXG4gICAgLy8gcHJvdGVjdCBhZ2FpbnN0IGRhbmdlcm91cyBzZWxlY3RvcnMuICBmYWxzZXkgYW5kIHtfaWQ6IGZhbHNleX0gYXJlIGJvdGhcbiAgICAvLyBsaWtlbHkgcHJvZ3JhbW1lciBlcnJvciwgYW5kIG5vdCB3aGF0IHlvdSB3YW50LCBwYXJ0aWN1bGFybHkgZm9yXG4gICAgLy8gZGVzdHJ1Y3RpdmUgb3BlcmF0aW9ucy5cbiAgICBpZiAoIXNlbGVjdG9yIHx8IGhhc093bi5jYWxsKHNlbGVjdG9yLCAnX2lkJykgJiYgIXNlbGVjdG9yLl9pZCkge1xuICAgICAgdGhpcy5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBub3RoaW5nTWF0Y2hlcjtcbiAgICB9XG5cbiAgICAvLyBUb3AgbGV2ZWwgY2FuJ3QgYmUgYW4gYXJyYXkgb3IgdHJ1ZSBvciBiaW5hcnkuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpIHx8XG4gICAgICAgIEVKU09OLmlzQmluYXJ5KHNlbGVjdG9yKSB8fFxuICAgICAgICB0eXBlb2Ygc2VsZWN0b3IgPT09ICdib29sZWFuJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yOiAke3NlbGVjdG9yfWApO1xuICAgIH1cblxuICAgIHRoaXMuX3NlbGVjdG9yID0gRUpTT04uY2xvbmUoc2VsZWN0b3IpO1xuXG4gICAgcmV0dXJuIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCB0aGlzLCB7aXNSb290OiB0cnVlfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgbGlzdCBvZiBrZXkgcGF0aHMgdGhlIGdpdmVuIHNlbGVjdG9yIGlzIGxvb2tpbmcgZm9yLiBJdCBpbmNsdWRlc1xuICAvLyB0aGUgZW1wdHkgc3RyaW5nIGlmIHRoZXJlIGlzIGEgJHdoZXJlLlxuICBfZ2V0UGF0aHMoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BhdGhzKTtcbiAgfVxuXG4gIF9yZWNvcmRQYXRoVXNlZChwYXRoKSB7XG4gICAgdGhpcy5fcGF0aHNbcGF0aF0gPSB0cnVlO1xuICB9XG59XG5cbi8vIGhlbHBlcnMgdXNlZCBieSBjb21waWxlZCBzZWxlY3RvciBjb2RlXG5Mb2NhbENvbGxlY3Rpb24uX2YgPSB7XG4gIC8vIFhYWCBmb3IgX2FsbCBhbmQgX2luLCBjb25zaWRlciBidWlsZGluZyAnaW5xdWVyeScgYXQgY29tcGlsZSB0aW1lLi5cbiAgX3R5cGUodikge1xuICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiAyO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICByZXR1cm4gODtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2KSkge1xuICAgICAgcmV0dXJuIDQ7XG4gICAgfVxuXG4gICAgaWYgKHYgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAxMDtcbiAgICB9XG5cbiAgICAvLyBub3RlIHRoYXQgdHlwZW9mKC94LykgPT09IFwib2JqZWN0XCJcbiAgICBpZiAodiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuIDExO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIDEzO1xuICAgIH1cblxuICAgIGlmICh2IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgcmV0dXJuIDk7XG4gICAgfVxuXG4gICAgaWYgKEVKU09OLmlzQmluYXJ5KHYpKSB7XG4gICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBpZiAodiBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQpIHtcbiAgICAgIHJldHVybiA3O1xuICAgIH1cblxuICAgIGlmICh2IGluc3RhbmNlb2YgRGVjaW1hbCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgLy8gb2JqZWN0XG4gICAgcmV0dXJuIDM7XG5cbiAgICAvLyBYWFggc3VwcG9ydCBzb21lL2FsbCBvZiB0aGVzZTpcbiAgICAvLyAxNCwgc3ltYm9sXG4gICAgLy8gMTUsIGphdmFzY3JpcHQgY29kZSB3aXRoIHNjb3BlXG4gICAgLy8gMTYsIDE4OiAzMi1iaXQvNjQtYml0IGludGVnZXJcbiAgICAvLyAxNywgdGltZXN0YW1wXG4gICAgLy8gMjU1LCBtaW5rZXlcbiAgICAvLyAxMjcsIG1heGtleVxuICB9LFxuXG4gIC8vIGRlZXAgZXF1YWxpdHkgdGVzdDogdXNlIGZvciBsaXRlcmFsIGRvY3VtZW50IGFuZCBhcnJheSBtYXRjaGVzXG4gIF9lcXVhbChhLCBiKSB7XG4gICAgcmV0dXJuIEVKU09OLmVxdWFscyhhLCBiLCB7a2V5T3JkZXJTZW5zaXRpdmU6IHRydWV9KTtcbiAgfSxcblxuICAvLyBtYXBzIGEgdHlwZSBjb2RlIHRvIGEgdmFsdWUgdGhhdCBjYW4gYmUgdXNlZCB0byBzb3J0IHZhbHVlcyBvZiBkaWZmZXJlbnRcbiAgLy8gdHlwZXNcbiAgX3R5cGVvcmRlcih0KSB7XG4gICAgLy8gaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvV2hhdCtpcyt0aGUrQ29tcGFyZStPcmRlcitmb3IrQlNPTitUeXBlc1xuICAgIC8vIFhYWCB3aGF0IGlzIHRoZSBjb3JyZWN0IHNvcnQgcG9zaXRpb24gZm9yIEphdmFzY3JpcHQgY29kZT9cbiAgICAvLyAoJzEwMCcgaW4gdGhlIG1hdHJpeCBiZWxvdylcbiAgICAvLyBYWFggbWlua2V5L21heGtleVxuICAgIHJldHVybiBbXG4gICAgICAtMSwgIC8vIChub3QgYSB0eXBlKVxuICAgICAgMSwgICAvLyBudW1iZXJcbiAgICAgIDIsICAgLy8gc3RyaW5nXG4gICAgICAzLCAgIC8vIG9iamVjdFxuICAgICAgNCwgICAvLyBhcnJheVxuICAgICAgNSwgICAvLyBiaW5hcnlcbiAgICAgIC0xLCAgLy8gZGVwcmVjYXRlZFxuICAgICAgNiwgICAvLyBPYmplY3RJRFxuICAgICAgNywgICAvLyBib29sXG4gICAgICA4LCAgIC8vIERhdGVcbiAgICAgIDAsICAgLy8gbnVsbFxuICAgICAgOSwgICAvLyBSZWdFeHBcbiAgICAgIC0xLCAgLy8gZGVwcmVjYXRlZFxuICAgICAgMTAwLCAvLyBKUyBjb2RlXG4gICAgICAyLCAgIC8vIGRlcHJlY2F0ZWQgKHN5bWJvbClcbiAgICAgIDEwMCwgLy8gSlMgY29kZVxuICAgICAgMSwgICAvLyAzMi1iaXQgaW50XG4gICAgICA4LCAgIC8vIE1vbmdvIHRpbWVzdGFtcFxuICAgICAgMSAgICAvLyA2NC1iaXQgaW50XG4gICAgXVt0XTtcbiAgfSxcblxuICAvLyBjb21wYXJlIHR3byB2YWx1ZXMgb2YgdW5rbm93biB0eXBlIGFjY29yZGluZyB0byBCU09OIG9yZGVyaW5nXG4gIC8vIHNlbWFudGljcy4gKGFzIGFuIGV4dGVuc2lvbiwgY29uc2lkZXIgJ3VuZGVmaW5lZCcgdG8gYmUgbGVzcyB0aGFuXG4gIC8vIGFueSBvdGhlciB2YWx1ZS4pIHJldHVybiBuZWdhdGl2ZSBpZiBhIGlzIGxlc3MsIHBvc2l0aXZlIGlmIGIgaXNcbiAgLy8gbGVzcywgb3IgMCBpZiBlcXVhbFxuICBfY21wKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYiA9PT0gdW5kZWZpbmVkID8gMCA6IC0xO1xuICAgIH1cblxuICAgIGlmIChiID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIGxldCB0YSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZShhKTtcbiAgICBsZXQgdGIgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoYik7XG5cbiAgICBjb25zdCBvYSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZW9yZGVyKHRhKTtcbiAgICBjb25zdCBvYiA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZW9yZGVyKHRiKTtcblxuICAgIGlmIChvYSAhPT0gb2IpIHtcbiAgICAgIHJldHVybiBvYSA8IG9iID8gLTEgOiAxO1xuICAgIH1cblxuICAgIC8vIFhYWCBuZWVkIHRvIGltcGxlbWVudCB0aGlzIGlmIHdlIGltcGxlbWVudCBTeW1ib2wgb3IgaW50ZWdlcnMsIG9yXG4gICAgLy8gVGltZXN0YW1wXG4gICAgaWYgKHRhICE9PSB0Yikge1xuICAgICAgdGhyb3cgRXJyb3IoJ01pc3NpbmcgdHlwZSBjb2VyY2lvbiBsb2dpYyBpbiBfY21wJyk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA3KSB7IC8vIE9iamVjdElEXG4gICAgICAvLyBDb252ZXJ0IHRvIHN0cmluZy5cbiAgICAgIHRhID0gdGIgPSAyO1xuICAgICAgYSA9IGEudG9IZXhTdHJpbmcoKTtcbiAgICAgIGIgPSBiLnRvSGV4U3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA5KSB7IC8vIERhdGVcbiAgICAgIC8vIENvbnZlcnQgdG8gbWlsbGlzLlxuICAgICAgdGEgPSB0YiA9IDE7XG4gICAgICBhID0gaXNOYU4oYSkgPyAwIDogYS5nZXRUaW1lKCk7XG4gICAgICBiID0gaXNOYU4oYikgPyAwIDogYi5nZXRUaW1lKCk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSAxKSB7IC8vIGRvdWJsZVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBEZWNpbWFsKSB7XG4gICAgICAgIHJldHVybiBhLm1pbnVzKGIpLnRvTnVtYmVyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYSAtIGI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRiID09PSAyKSAvLyBzdHJpbmdcbiAgICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA9PT0gYiA/IDAgOiAxO1xuXG4gICAgaWYgKHRhID09PSAzKSB7IC8vIE9iamVjdFxuICAgICAgLy8gdGhpcyBjb3VsZCBiZSBtdWNoIG1vcmUgZWZmaWNpZW50IGluIHRoZSBleHBlY3RlZCBjYXNlIC4uLlxuICAgICAgY29uc3QgdG9BcnJheSA9IG9iamVjdCA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgICAgIE9iamVjdC5rZXlzKG9iamVjdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGtleSwgb2JqZWN0W2tleV0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKHRvQXJyYXkoYSksIHRvQXJyYXkoYikpO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gNCkgeyAvLyBBcnJheVxuICAgICAgZm9yIChsZXQgaSA9IDA7IDsgaSsrKSB7XG4gICAgICAgIGlmIChpID09PSBhLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBpID09PSBiLmxlbmd0aCA/IDAgOiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpID09PSBiLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcyA9IExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKGFbaV0sIGJbaV0pO1xuICAgICAgICBpZiAocyAhPT0gMCkge1xuICAgICAgICAgIHJldHVybiBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA1KSB7IC8vIGJpbmFyeVxuICAgICAgLy8gU3VycHJpc2luZ2x5LCBhIHNtYWxsIGJpbmFyeSBibG9iIGlzIGFsd2F5cyBsZXNzIHRoYW4gYSBsYXJnZSBvbmUgaW5cbiAgICAgIC8vIE1vbmdvLlxuICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gYS5sZW5ndGggLSBiLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChhW2ldIDwgYltpXSkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhW2ldID4gYltpXSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gOCkgeyAvLyBib29sZWFuXG4gICAgICBpZiAoYSkge1xuICAgICAgICByZXR1cm4gYiA/IDAgOiAxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYiA/IC0xIDogMDtcbiAgICB9XG5cbiAgICBpZiAodGEgPT09IDEwKSAvLyBudWxsXG4gICAgICByZXR1cm4gMDtcblxuICAgIGlmICh0YSA9PT0gMTEpIC8vIHJlZ2V4cFxuICAgICAgdGhyb3cgRXJyb3IoJ1NvcnRpbmcgbm90IHN1cHBvcnRlZCBvbiByZWd1bGFyIGV4cHJlc3Npb24nKTsgLy8gWFhYXG5cbiAgICAvLyAxMzogamF2YXNjcmlwdCBjb2RlXG4gICAgLy8gMTQ6IHN5bWJvbFxuICAgIC8vIDE1OiBqYXZhc2NyaXB0IGNvZGUgd2l0aCBzY29wZVxuICAgIC8vIDE2OiAzMi1iaXQgaW50ZWdlclxuICAgIC8vIDE3OiB0aW1lc3RhbXBcbiAgICAvLyAxODogNjQtYml0IGludGVnZXJcbiAgICAvLyAyNTU6IG1pbmtleVxuICAgIC8vIDEyNzogbWF4a2V5XG4gICAgaWYgKHRhID09PSAxMykgLy8gamF2YXNjcmlwdCBjb2RlXG4gICAgICB0aHJvdyBFcnJvcignU29ydGluZyBub3Qgc3VwcG9ydGVkIG9uIEphdmFzY3JpcHQgY29kZScpOyAvLyBYWFhcblxuICAgIHRocm93IEVycm9yKCdVbmtub3duIHR5cGUgdG8gc29ydCcpO1xuICB9LFxufTtcbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb25fIGZyb20gJy4vbG9jYWxfY29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgTWF0Y2hlciBmcm9tICcuL21hdGNoZXIuanMnO1xuaW1wb3J0IFNvcnRlciBmcm9tICcuL3NvcnRlci5qcyc7XG5cbkxvY2FsQ29sbGVjdGlvbiA9IExvY2FsQ29sbGVjdGlvbl87XG5NaW5pbW9uZ28gPSB7XG4gICAgTG9jYWxDb2xsZWN0aW9uOiBMb2NhbENvbGxlY3Rpb25fLFxuICAgIE1hdGNoZXIsXG4gICAgU29ydGVyXG59O1xuIiwiLy8gT2JzZXJ2ZUhhbmRsZTogdGhlIHJldHVybiB2YWx1ZSBvZiBhIGxpdmUgcXVlcnkuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYnNlcnZlSGFuZGxlIHt9XG4iLCJpbXBvcnQge1xuICBFTEVNRU5UX09QRVJBVE9SUyxcbiAgZXF1YWxpdHlFbGVtZW50TWF0Y2hlcixcbiAgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyxcbiAgaGFzT3duLFxuICBpc09wZXJhdG9yT2JqZWN0LFxuICBtYWtlTG9va3VwRnVuY3Rpb24sXG4gIHJlZ2V4cEVsZW1lbnRNYXRjaGVyLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbi8vIEdpdmUgYSBzb3J0IHNwZWMsIHdoaWNoIGNhbiBiZSBpbiBhbnkgb2YgdGhlc2UgZm9ybXM6XG4vLyAgIHtcImtleTFcIjogMSwgXCJrZXkyXCI6IC0xfVxuLy8gICBbW1wia2V5MVwiLCBcImFzY1wiXSwgW1wia2V5MlwiLCBcImRlc2NcIl1dXG4vLyAgIFtcImtleTFcIiwgW1wia2V5MlwiLCBcImRlc2NcIl1dXG4vL1xuLy8gKC4uIHdpdGggdGhlIGZpcnN0IGZvcm0gYmVpbmcgZGVwZW5kZW50IG9uIHRoZSBrZXkgZW51bWVyYXRpb25cbi8vIGJlaGF2aW9yIG9mIHlvdXIgamF2YXNjcmlwdCBWTSwgd2hpY2ggdXN1YWxseSBkb2VzIHdoYXQgeW91IG1lYW4gaW5cbi8vIHRoaXMgY2FzZSBpZiB0aGUga2V5IG5hbWVzIGRvbid0IGxvb2sgbGlrZSBpbnRlZ2VycyAuLilcbi8vXG4vLyByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIHR3byBvYmplY3RzLCBhbmQgcmV0dXJucyAtMSBpZiB0aGVcbi8vIGZpcnN0IG9iamVjdCBjb21lcyBmaXJzdCBpbiBvcmRlciwgMSBpZiB0aGUgc2Vjb25kIG9iamVjdCBjb21lc1xuLy8gZmlyc3QsIG9yIDAgaWYgbmVpdGhlciBvYmplY3QgY29tZXMgYmVmb3JlIHRoZSBvdGhlci5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU29ydGVyIHtcbiAgY29uc3RydWN0b3Ioc3BlYykge1xuICAgIHRoaXMuX3NvcnRTcGVjUGFydHMgPSBbXTtcbiAgICB0aGlzLl9zb3J0RnVuY3Rpb24gPSBudWxsO1xuXG4gICAgY29uc3QgYWRkU3BlY1BhcnQgPSAocGF0aCwgYXNjZW5kaW5nKSA9PiB7XG4gICAgICBpZiAoIXBhdGgpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ3NvcnQga2V5cyBtdXN0IGJlIG5vbi1lbXB0eScpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGF0aC5jaGFyQXQoMCkgPT09ICckJykge1xuICAgICAgICB0aHJvdyBFcnJvcihgdW5zdXBwb3J0ZWQgc29ydCBrZXk6ICR7cGF0aH1gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fc29ydFNwZWNQYXJ0cy5wdXNoKHtcbiAgICAgICAgYXNjZW5kaW5nLFxuICAgICAgICBsb29rdXA6IG1ha2VMb29rdXBGdW5jdGlvbihwYXRoLCB7Zm9yU29ydDogdHJ1ZX0pLFxuICAgICAgICBwYXRoXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgaWYgKHNwZWMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgc3BlYy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgYWRkU3BlY1BhcnQoZWxlbWVudCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkU3BlY1BhcnQoZWxlbWVudFswXSwgZWxlbWVudFsxXSAhPT0gJ2Rlc2MnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIE9iamVjdC5rZXlzKHNwZWMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgYWRkU3BlY1BhcnQoa2V5LCBzcGVjW2tleV0gPj0gMCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzcGVjID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLl9zb3J0RnVuY3Rpb24gPSBzcGVjO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihgQmFkIHNvcnQgc3BlY2lmaWNhdGlvbjogJHtKU09OLnN0cmluZ2lmeShzcGVjKX1gKTtcbiAgICB9XG5cbiAgICAvLyBJZiBhIGZ1bmN0aW9uIGlzIHNwZWNpZmllZCBmb3Igc29ydGluZywgd2Ugc2tpcCB0aGUgcmVzdC5cbiAgICBpZiAodGhpcy5fc29ydEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVG8gaW1wbGVtZW50IGFmZmVjdGVkQnlNb2RpZmllciwgd2UgcGlnZ3ktYmFjayBvbiB0b3Agb2YgTWF0Y2hlcidzXG4gICAgLy8gYWZmZWN0ZWRCeU1vZGlmaWVyIGNvZGU7IHdlIGNyZWF0ZSBhIHNlbGVjdG9yIHRoYXQgaXMgYWZmZWN0ZWQgYnkgdGhlXG4gICAgLy8gc2FtZSBtb2RpZmllcnMgYXMgdGhpcyBzb3J0IG9yZGVyLiBUaGlzIGlzIG9ubHkgaW1wbGVtZW50ZWQgb24gdGhlXG4gICAgLy8gc2VydmVyLlxuICAgIGlmICh0aGlzLmFmZmVjdGVkQnlNb2RpZmllcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSB7fTtcblxuICAgICAgdGhpcy5fc29ydFNwZWNQYXJ0cy5mb3JFYWNoKHNwZWMgPT4ge1xuICAgICAgICBzZWxlY3RvcltzcGVjLnBhdGhdID0gMTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9zZWxlY3RvckZvckFmZmVjdGVkQnlNb2RpZmllciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3Rvcik7XG4gICAgfVxuXG4gICAgdGhpcy5fa2V5Q29tcGFyYXRvciA9IGNvbXBvc2VDb21wYXJhdG9ycyhcbiAgICAgIHRoaXMuX3NvcnRTcGVjUGFydHMubWFwKChzcGVjLCBpKSA9PiB0aGlzLl9rZXlGaWVsZENvbXBhcmF0b3IoaSkpXG4gICAgKTtcbiAgfVxuXG4gIGdldENvbXBhcmF0b3Iob3B0aW9ucykge1xuICAgIC8vIElmIHNvcnQgaXMgc3BlY2lmaWVkIG9yIGhhdmUgbm8gZGlzdGFuY2VzLCBqdXN0IHVzZSB0aGUgY29tcGFyYXRvciBmcm9tXG4gICAgLy8gdGhlIHNvdXJjZSBzcGVjaWZpY2F0aW9uICh3aGljaCBkZWZhdWx0cyB0byBcImV2ZXJ5dGhpbmcgaXMgZXF1YWxcIi5cbiAgICAvLyBpc3N1ZSAjMzU5OVxuICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3F1ZXJ5L25lYXIvI3NvcnQtb3BlcmF0aW9uXG4gICAgLy8gc29ydCBlZmZlY3RpdmVseSBvdmVycmlkZXMgJG5lYXJcbiAgICBpZiAodGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGggfHwgIW9wdGlvbnMgfHwgIW9wdGlvbnMuZGlzdGFuY2VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0QmFzZUNvbXBhcmF0b3IoKTtcbiAgICB9XG5cbiAgICBjb25zdCBkaXN0YW5jZXMgPSBvcHRpb25zLmRpc3RhbmNlcztcblxuICAgIC8vIFJldHVybiBhIGNvbXBhcmF0b3Igd2hpY2ggY29tcGFyZXMgdXNpbmcgJG5lYXIgZGlzdGFuY2VzLlxuICAgIHJldHVybiAoYSwgYikgPT4ge1xuICAgICAgaWYgKCFkaXN0YW5jZXMuaGFzKGEuX2lkKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgTWlzc2luZyBkaXN0YW5jZSBmb3IgJHthLl9pZH1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkaXN0YW5jZXMuaGFzKGIuX2lkKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgTWlzc2luZyBkaXN0YW5jZSBmb3IgJHtiLl9pZH1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcy5nZXQoYS5faWQpIC0gZGlzdGFuY2VzLmdldChiLl9pZCk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFRha2VzIGluIHR3byBrZXlzOiBhcnJheXMgd2hvc2UgbGVuZ3RocyBtYXRjaCB0aGUgbnVtYmVyIG9mIHNwZWNcbiAgLy8gcGFydHMuIFJldHVybnMgbmVnYXRpdmUsIDAsIG9yIHBvc2l0aXZlIGJhc2VkIG9uIHVzaW5nIHRoZSBzb3J0IHNwZWMgdG9cbiAgLy8gY29tcGFyZSBmaWVsZHMuXG4gIF9jb21wYXJlS2V5cyhrZXkxLCBrZXkyKSB7XG4gICAgaWYgKGtleTEubGVuZ3RoICE9PSB0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCB8fFxuICAgICAgICBrZXkyLmxlbmd0aCAhPT0gdGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGgpIHtcbiAgICAgIHRocm93IEVycm9yKCdLZXkgaGFzIHdyb25nIGxlbmd0aCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9rZXlDb21wYXJhdG9yKGtleTEsIGtleTIpO1xuICB9XG5cbiAgLy8gSXRlcmF0ZXMgb3ZlciBlYWNoIHBvc3NpYmxlIFwia2V5XCIgZnJvbSBkb2MgKGllLCBvdmVyIGVhY2ggYnJhbmNoKSwgY2FsbGluZ1xuICAvLyAnY2InIHdpdGggdGhlIGtleS5cbiAgX2dlbmVyYXRlS2V5c0Zyb21Eb2MoZG9jLCBjYikge1xuICAgIGlmICh0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5cXCd0IGdlbmVyYXRlIGtleXMgd2l0aG91dCBhIHNwZWMnKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXRoRnJvbUluZGljZXMgPSBpbmRpY2VzID0+IGAke2luZGljZXMuam9pbignLCcpfSxgO1xuXG4gICAgbGV0IGtub3duUGF0aHMgPSBudWxsO1xuXG4gICAgLy8gbWFwcyBpbmRleCAtPiAoeycnIC0+IHZhbHVlfSBvciB7cGF0aCAtPiB2YWx1ZX0pXG4gICAgY29uc3QgdmFsdWVzQnlJbmRleEFuZFBhdGggPSB0aGlzLl9zb3J0U3BlY1BhcnRzLm1hcChzcGVjID0+IHtcbiAgICAgIC8vIEV4cGFuZCBhbnkgbGVhZiBhcnJheXMgdGhhdCB3ZSBmaW5kLCBhbmQgaWdub3JlIHRob3NlIGFycmF5c1xuICAgICAgLy8gdGhlbXNlbHZlcy4gIChXZSBuZXZlciBzb3J0IGJhc2VkIG9uIGFuIGFycmF5IGl0c2VsZi4pXG4gICAgICBsZXQgYnJhbmNoZXMgPSBleHBhbmRBcnJheXNJbkJyYW5jaGVzKHNwZWMubG9va3VwKGRvYyksIHRydWUpO1xuXG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gdmFsdWVzIGZvciBhIGtleSAoZWcsIGtleSBnb2VzIHRvIGFuIGVtcHR5IGFycmF5KSxcbiAgICAgIC8vIHByZXRlbmQgd2UgZm91bmQgb25lIHVuZGVmaW5lZCB2YWx1ZS5cbiAgICAgIGlmICghYnJhbmNoZXMubGVuZ3RoKSB7XG4gICAgICAgIGJyYW5jaGVzID0gW3sgdmFsdWU6IHZvaWQgMCB9XTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBsZXQgdXNlZFBhdGhzID0gZmFsc2U7XG5cbiAgICAgIGJyYW5jaGVzLmZvckVhY2goYnJhbmNoID0+IHtcbiAgICAgICAgaWYgKCFicmFuY2guYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIGFycmF5IGluZGljZXMgZm9yIGEgYnJhbmNoLCB0aGVuIGl0IG11c3QgYmUgdGhlXG4gICAgICAgICAgLy8gb25seSBicmFuY2gsIGJlY2F1c2UgdGhlIG9ubHkgdGhpbmcgdGhhdCBwcm9kdWNlcyBtdWx0aXBsZSBicmFuY2hlc1xuICAgICAgICAgIC8vIGlzIHRoZSB1c2Ugb2YgYXJyYXlzLlxuICAgICAgICAgIGlmIChicmFuY2hlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignbXVsdGlwbGUgYnJhbmNoZXMgYnV0IG5vIGFycmF5IHVzZWQ/Jyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZWxlbWVudFsnJ10gPSBicmFuY2gudmFsdWU7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdXNlZFBhdGhzID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYXRoID0gcGF0aEZyb21JbmRpY2VzKGJyYW5jaC5hcnJheUluZGljZXMpO1xuXG4gICAgICAgIGlmIChoYXNPd24uY2FsbChlbGVtZW50LCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGBkdXBsaWNhdGUgcGF0aDogJHtwYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgZWxlbWVudFtwYXRoXSA9IGJyYW5jaC52YWx1ZTtcblxuICAgICAgICAvLyBJZiB0d28gc29ydCBmaWVsZHMgYm90aCBnbyBpbnRvIGFycmF5cywgdGhleSBoYXZlIHRvIGdvIGludG8gdGhlXG4gICAgICAgIC8vIGV4YWN0IHNhbWUgYXJyYXlzIGFuZCB3ZSBoYXZlIHRvIGZpbmQgdGhlIHNhbWUgcGF0aHMuICBUaGlzIGlzXG4gICAgICAgIC8vIHJvdWdobHkgdGhlIHNhbWUgY29uZGl0aW9uIHRoYXQgbWFrZXMgTW9uZ29EQiB0aHJvdyB0aGlzIHN0cmFuZ2VcbiAgICAgICAgLy8gZXJyb3IgbWVzc2FnZS4gIGVnLCB0aGUgbWFpbiB0aGluZyBpcyB0aGF0IGlmIHNvcnQgc3BlYyBpcyB7YTogMSxcbiAgICAgICAgLy8gYjoxfSB0aGVuIGEgYW5kIGIgY2Fubm90IGJvdGggYmUgYXJyYXlzLlxuICAgICAgICAvL1xuICAgICAgICAvLyAoSW4gTW9uZ29EQiBpdCBzZWVtcyB0byBiZSBPSyB0byBoYXZlIHthOiAxLCAnYS54LnknOiAxfSB3aGVyZSAnYSdcbiAgICAgICAgLy8gYW5kICdhLngueScgYXJlIGJvdGggYXJyYXlzLCBidXQgd2UgZG9uJ3QgYWxsb3cgdGhpcyBmb3Igbm93LlxuICAgICAgICAvLyAjTmVzdGVkQXJyYXlTb3J0XG4gICAgICAgIC8vIFhYWCBhY2hpZXZlIGZ1bGwgY29tcGF0aWJpbGl0eSBoZXJlXG4gICAgICAgIGlmIChrbm93blBhdGhzICYmICFoYXNPd24uY2FsbChrbm93blBhdGhzLCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgaW5kZXggcGFyYWxsZWwgYXJyYXlzJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoa25vd25QYXRocykge1xuICAgICAgICAvLyBTaW1pbGFybHkgdG8gYWJvdmUsIHBhdGhzIG11c3QgbWF0Y2ggZXZlcnl3aGVyZSwgdW5sZXNzIHRoaXMgaXMgYVxuICAgICAgICAvLyBub24tYXJyYXkgZmllbGQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoZWxlbWVudCwgJycpICYmXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhrbm93blBhdGhzKS5sZW5ndGggIT09IE9iamVjdC5rZXlzKGVsZW1lbnQpLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgaW5kZXggcGFyYWxsZWwgYXJyYXlzIScpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHVzZWRQYXRocykge1xuICAgICAgICBrbm93blBhdGhzID0ge307XG5cbiAgICAgICAgT2JqZWN0LmtleXMoZWxlbWVudCkuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgICBrbm93blBhdGhzW3BhdGhdID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH0pO1xuXG4gICAgaWYgKCFrbm93blBhdGhzKSB7XG4gICAgICAvLyBFYXN5IGNhc2U6IG5vIHVzZSBvZiBhcnJheXMuXG4gICAgICBjb25zdCBzb2xlS2V5ID0gdmFsdWVzQnlJbmRleEFuZFBhdGgubWFwKHZhbHVlcyA9PiB7XG4gICAgICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVzLCAnJykpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignbm8gdmFsdWUgaW4gc29sZSBrZXkgY2FzZT8nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWx1ZXNbJyddO1xuICAgICAgfSk7XG5cbiAgICAgIGNiKHNvbGVLZXkpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoa25vd25QYXRocykuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IHZhbHVlc0J5SW5kZXhBbmRQYXRoLm1hcCh2YWx1ZXMgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwodmFsdWVzLCAnJykpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWVzWycnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVzLCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdtaXNzaW5nIHBhdGg/Jyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWVzW3BhdGhdO1xuICAgICAgfSk7XG5cbiAgICAgIGNiKGtleSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgY29tcGFyYXRvciB0aGF0IHJlcHJlc2VudHMgdGhlIHNvcnQgc3BlY2lmaWNhdGlvbiAoYnV0IG5vdFxuICAvLyBpbmNsdWRpbmcgYSBwb3NzaWJsZSBnZW9xdWVyeSBkaXN0YW5jZSB0aWUtYnJlYWtlcikuXG4gIF9nZXRCYXNlQ29tcGFyYXRvcigpIHtcbiAgICBpZiAodGhpcy5fc29ydEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc29ydEZ1bmN0aW9uO1xuICAgIH1cblxuICAgIC8vIElmIHdlJ3JlIG9ubHkgc29ydGluZyBvbiBnZW9xdWVyeSBkaXN0YW5jZSBhbmQgbm8gc3BlY3MsIGp1c3Qgc2F5XG4gICAgLy8gZXZlcnl0aGluZyBpcyBlcXVhbC5cbiAgICBpZiAoIXRoaXMuX3NvcnRTcGVjUGFydHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gKGRvYzEsIGRvYzIpID0+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIChkb2MxLCBkb2MyKSA9PiB7XG4gICAgICBjb25zdCBrZXkxID0gdGhpcy5fZ2V0TWluS2V5RnJvbURvYyhkb2MxKTtcbiAgICAgIGNvbnN0IGtleTIgPSB0aGlzLl9nZXRNaW5LZXlGcm9tRG9jKGRvYzIpO1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVLZXlzKGtleTEsIGtleTIpO1xuICAgIH07XG4gIH1cblxuICAvLyBGaW5kcyB0aGUgbWluaW11bSBrZXkgZnJvbSB0aGUgZG9jLCBhY2NvcmRpbmcgdG8gdGhlIHNvcnQgc3BlY3MuICAoV2Ugc2F5XG4gIC8vIFwibWluaW11bVwiIGhlcmUgYnV0IHRoaXMgaXMgd2l0aCByZXNwZWN0IHRvIHRoZSBzb3J0IHNwZWMsIHNvIFwiZGVzY2VuZGluZ1wiXG4gIC8vIHNvcnQgZmllbGRzIG1lYW4gd2UncmUgZmluZGluZyB0aGUgbWF4IGZvciB0aGF0IGZpZWxkLilcbiAgLy9cbiAgLy8gTm90ZSB0aGF0IHRoaXMgaXMgTk9UIFwiZmluZCB0aGUgbWluaW11bSB2YWx1ZSBvZiB0aGUgZmlyc3QgZmllbGQsIHRoZVxuICAvLyBtaW5pbXVtIHZhbHVlIG9mIHRoZSBzZWNvbmQgZmllbGQsIGV0Y1wiLi4uIGl0J3MgXCJjaG9vc2UgdGhlXG4gIC8vIGxleGljb2dyYXBoaWNhbGx5IG1pbmltdW0gdmFsdWUgb2YgdGhlIGtleSB2ZWN0b3IsIGFsbG93aW5nIG9ubHkga2V5cyB3aGljaFxuICAvLyB5b3UgY2FuIGZpbmQgYWxvbmcgdGhlIHNhbWUgcGF0aHNcIi4gIGllLCBmb3IgYSBkb2Mge2E6IFt7eDogMCwgeTogNX0sIHt4OlxuICAvLyAxLCB5OiAzfV19IHdpdGggc29ydCBzcGVjIHsnYS54JzogMSwgJ2EueSc6IDF9LCB0aGUgb25seSBrZXlzIGFyZSBbMCw1XSBhbmRcbiAgLy8gWzEsM10sIGFuZCB0aGUgbWluaW11bSBrZXkgaXMgWzAsNV07IG5vdGFibHksIFswLDNdIGlzIE5PVCBhIGtleS5cbiAgX2dldE1pbktleUZyb21Eb2MoZG9jKSB7XG4gICAgbGV0IG1pbktleSA9IG51bGw7XG5cbiAgICB0aGlzLl9nZW5lcmF0ZUtleXNGcm9tRG9jKGRvYywga2V5ID0+IHtcbiAgICAgIGlmIChtaW5LZXkgPT09IG51bGwpIHtcbiAgICAgICAgbWluS2V5ID0ga2V5O1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9jb21wYXJlS2V5cyhrZXksIG1pbktleSkgPCAwKSB7XG4gICAgICAgIG1pbktleSA9IGtleTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtaW5LZXk7XG4gIH1cblxuICBfZ2V0UGF0aHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NvcnRTcGVjUGFydHMubWFwKHBhcnQgPT4gcGFydC5wYXRoKTtcbiAgfVxuXG4gIC8vIEdpdmVuIGFuIGluZGV4ICdpJywgcmV0dXJucyBhIGNvbXBhcmF0b3IgdGhhdCBjb21wYXJlcyB0d28ga2V5IGFycmF5cyBiYXNlZFxuICAvLyBvbiBmaWVsZCAnaScuXG4gIF9rZXlGaWVsZENvbXBhcmF0b3IoaSkge1xuICAgIGNvbnN0IGludmVydCA9ICF0aGlzLl9zb3J0U3BlY1BhcnRzW2ldLmFzY2VuZGluZztcblxuICAgIHJldHVybiAoa2V5MSwga2V5MikgPT4ge1xuICAgICAgY29uc3QgY29tcGFyZSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKGtleTFbaV0sIGtleTJbaV0pO1xuICAgICAgcmV0dXJuIGludmVydCA/IC1jb21wYXJlIDogY29tcGFyZTtcbiAgICB9O1xuICB9XG59XG5cbi8vIEdpdmVuIGFuIGFycmF5IG9mIGNvbXBhcmF0b3JzXG4vLyAoZnVuY3Rpb25zIChhLGIpLT4obmVnYXRpdmUgb3IgcG9zaXRpdmUgb3IgemVybykpLCByZXR1cm5zIGEgc2luZ2xlXG4vLyBjb21wYXJhdG9yIHdoaWNoIHVzZXMgZWFjaCBjb21wYXJhdG9yIGluIG9yZGVyIGFuZCByZXR1cm5zIHRoZSBmaXJzdFxuLy8gbm9uLXplcm8gdmFsdWUuXG5mdW5jdGlvbiBjb21wb3NlQ29tcGFyYXRvcnMoY29tcGFyYXRvckFycmF5KSB7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcGFyYXRvckFycmF5Lmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBjb21wYXJlID0gY29tcGFyYXRvckFycmF5W2ldKGEsIGIpO1xuICAgICAgaWYgKGNvbXBhcmUgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIDA7XG4gIH07XG59XG4iXX0=
