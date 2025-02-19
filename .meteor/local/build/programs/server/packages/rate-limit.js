Package["core-runtime"].queue("rate-limit",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var Random = Package.random.Random;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var RateLimiter;

var require = meteorInstall({"node_modules":{"meteor":{"rate-limit":{"rate-limit.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/rate-limit/rate-limit.js                                                                            //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      RateLimiter: () => RateLimiter
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Default time interval (in milliseconds) to reset rate limit counters
    const DEFAULT_INTERVAL_TIME_IN_MILLISECONDS = 1000;
    // Default number of events allowed per time interval
    const DEFAULT_REQUESTS_PER_INTERVAL = 10;
    const hasOwn = Object.prototype.hasOwnProperty;

    // A rule is defined by an options object that contains two fields,
    // `numRequestsAllowed` which is the number of events allowed per interval, and
    // an `intervalTime` which is the amount of time in milliseconds before the
    // rate limit restarts its internal counters, and by a matchers object. A
    // matchers object is a POJO that contains a set of keys with values that
    // define the entire set of inputs that match for each key. The values can
    // either be null (optional), a primitive or a function that returns a boolean
    // of whether the provided input's value matches for this key.
    //
    // Rules are uniquely assigned an `id` and they store a dictionary of counters,
    // which are records used to keep track of inputs that match the rule. If a
    // counter reaches the `numRequestsAllowed` within a given `intervalTime`, a
    // rate limit is reached and future inputs that map to that counter will
    // result in errors being returned to the client.
    class Rule {
      constructor(options, matchers) {
        this.id = Random.id();
        this.options = options;
        this._matchers = matchers;
        this._lastResetTime = new Date().getTime();

        // Dictionary of input keys to counters
        this.counters = {};
      }
      // Determine if this rule applies to the given input by comparing all
      // rule.matchers. If the match fails, search short circuits instead of
      // iterating through all matchers.
      match(input) {
        return Object.entries(this._matchers).every(_ref => {
          let [key, matcher] = _ref;
          if (matcher !== null) {
            if (!hasOwn.call(input, key)) {
              return false;
            } else if (typeof matcher === 'function') {
              if (!matcher(input[key])) {
                return false;
              }
            } else if (matcher !== input[key]) {
              return false;
            }
          }
          return true;
        });
      }

      // Generates unique key string for provided input by concatenating all the
      // keys in the matcher with the corresponding values in the input.
      // Only called if rule matches input.
      _generateKeyString(input) {
        return Object.entries(this._matchers).filter(_ref2 => {
          let [key] = _ref2;
          return this._matchers[key] !== null;
        }).reduce((returnString, _ref3) => {
          let [key, matcher] = _ref3;
          if (typeof matcher === 'function') {
            if (matcher(input[key])) {
              returnString += key + input[key];
            }
          } else {
            returnString += key + input[key];
          }
          return returnString;
        }, '');
      }

      // Applies the provided input and returns the key string, time since counters
      // were last reset and time to next reset.
      apply(input) {
        const key = this._generateKeyString(input);
        const timeSinceLastReset = new Date().getTime() - this._lastResetTime;
        const timeToNextReset = this.options.intervalTime - timeSinceLastReset;
        return {
          key,
          timeSinceLastReset,
          timeToNextReset
        };
      }

      // Reset counter dictionary for this specific rule. Called once the
      // timeSinceLastReset has exceeded the intervalTime. _lastResetTime is
      // set to be the current time in milliseconds.
      resetCounter() {
        // Delete the old counters dictionary to allow for garbage collection
        this.counters = {};
        this._lastResetTime = new Date().getTime();
      }
      _executeCallback(reply, ruleInput) {
        try {
          if (this.options.callback) {
            this.options.callback(reply, ruleInput);
          }
        } catch (e) {
          // Do not throw error here
          console.error(e);
        }
      }
    }
    class RateLimiter {
      // Initialize rules to be an empty dictionary.
      constructor() {
        // Dictionary of all rules associated with this RateLimiter, keyed by their
        // id. Each rule object stores the rule pattern, number of events allowed,
        // last reset time and the rule reset interval in milliseconds.

        this.rules = {};
      }

      /**
      * Checks if this input has exceeded any rate limits.
      * @param  {object} input dictionary containing key-value pairs of attributes
      * that match to rules
      * @return {object} Returns object of following structure
      * { 'allowed': boolean - is this input allowed
      *   'timeToReset': integer | Infinity - returns time until counters are reset
      *                   in milliseconds
      *   'numInvocationsLeft': integer | Infinity - returns number of calls left
      *   before limit is reached
      * }
      * If multiple rules match, the least number of invocations left is returned.
      * If the rate limit has been reached, the longest timeToReset is returned.
      */
      check(input) {
        const reply = {
          allowed: true,
          timeToReset: 0,
          numInvocationsLeft: Infinity
        };
        const matchedRules = this._findAllMatchingRules(input);
        matchedRules.forEach(rule => {
          const ruleResult = rule.apply(input);
          let numInvocations = rule.counters[ruleResult.key];
          if (ruleResult.timeToNextReset < 0) {
            // Reset all the counters since the rule has reset
            rule.resetCounter();
            ruleResult.timeSinceLastReset = new Date().getTime() - rule._lastResetTime;
            ruleResult.timeToNextReset = rule.options.intervalTime;
            numInvocations = 0;
          }
          if (numInvocations > rule.options.numRequestsAllowed) {
            // Only update timeToReset if the new time would be longer than the
            // previously set time. This is to ensure that if this input triggers
            // multiple rules, we return the longest period of time until they can
            // successfully make another call
            if (reply.timeToReset < ruleResult.timeToNextReset) {
              reply.timeToReset = ruleResult.timeToNextReset;
            }
            reply.allowed = false;
            reply.numInvocationsLeft = 0;
            reply.ruleId = rule.id;
            rule._executeCallback(reply, input);
          } else {
            // If this is an allowed attempt and we haven't failed on any of the
            // other rules that match, update the reply field.
            if (rule.options.numRequestsAllowed - numInvocations < reply.numInvocationsLeft && reply.allowed) {
              reply.timeToReset = ruleResult.timeToNextReset;
              reply.numInvocationsLeft = rule.options.numRequestsAllowed - numInvocations;
            }
            reply.ruleId = rule.id;
            rule._executeCallback(reply, input);
          }
        });
        return reply;
      }

      /**
      * Adds a rule to dictionary of rules that are checked against on every call.
      * Only inputs that pass all of the rules will be allowed. Returns unique rule
      * id that can be passed to `removeRule`.
      * @param {object} rule    Input dictionary defining certain attributes and
      * rules associated with them.
      * Each attribute's value can either be a value, a function or null. All
      * functions must return a boolean of whether the input is matched by that
      * attribute's rule or not
      * @param {integer} numRequestsAllowed Optional. Number of events allowed per
      * interval. Default = 10.
      * @param {integer} intervalTime Optional. Number of milliseconds before
      * rule's counters are reset. Default = 1000.
      * @param {function} callback Optional. Function to be called after a
      * rule is executed. Two objects will be passed to this function.
      * The first one is the result of RateLimiter.prototype.check
      * The second is the input object of the rule, it has the following structure:
      * {
      *   'type': string - either 'method' or 'subscription'
      *   'name': string - the name of the method or subscription being called
      *   'userId': string - the user ID attempting the method or subscription
      *   'connectionId': string - a string representing the user's DDP connection
      *   'clientAddress': string - the IP address of the user
      * }
      * @return {string} Returns unique rule id
      */
      addRule(rule, numRequestsAllowed, intervalTime, callback) {
        const options = {
          numRequestsAllowed: numRequestsAllowed || DEFAULT_REQUESTS_PER_INTERVAL,
          intervalTime: intervalTime || DEFAULT_INTERVAL_TIME_IN_MILLISECONDS,
          callback: callback && Meteor.bindEnvironment(callback)
        };
        const newRule = new Rule(options, rule);
        this.rules[newRule.id] = newRule;
        return newRule.id;
      }

      /**
      * Increment counters in every rule that match to this input
      * @param  {object} input Dictionary object containing attributes that may
      * match to rules
      */
      increment(input) {
        // Only increment rule counters that match this input
        const matchedRules = this._findAllMatchingRules(input);
        matchedRules.forEach(rule => {
          const ruleResult = rule.apply(input);
          if (ruleResult.timeSinceLastReset > rule.options.intervalTime) {
            // Reset all the counters since the rule has reset
            rule.resetCounter();
          }

          // Check whether the key exists, incrementing it if so or otherwise
          // adding the key and setting its value to 1
          if (hasOwn.call(rule.counters, ruleResult.key)) {
            rule.counters[ruleResult.key]++;
          } else {
            rule.counters[ruleResult.key] = 1;
          }
        });
      }

      // Returns an array of all rules that apply to provided input
      _findAllMatchingRules(input) {
        return Object.values(this.rules).filter(rule => rule.match(input));
      }

      /**
       * Provides a mechanism to remove rules from the rate limiter. Returns boolean
       * about success.
       * @param  {string} id Rule id returned from #addRule
       * @return {boolean} Returns true if rule was found and deleted, else false.
       */
      removeRule(id) {
        if (this.rules[id]) {
          delete this.rules[id];
          return true;
        }
        return false;
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      RateLimiter: RateLimiter
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/rate-limit/rate-limit.js"
  ],
  mainModulePath: "/node_modules/meteor/rate-limit/rate-limit.js"
}});

//# sourceURL=meteor://💻app/packages/rate-limit.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcmF0ZS1saW1pdC9yYXRlLWxpbWl0LmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIlJhdGVMaW1pdGVyIiwiTWV0ZW9yIiwibGluayIsInYiLCJSYW5kb20iLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIkRFRkFVTFRfSU5URVJWQUxfVElNRV9JTl9NSUxMSVNFQ09ORFMiLCJERUZBVUxUX1JFUVVFU1RTX1BFUl9JTlRFUlZBTCIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiUnVsZSIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsIm1hdGNoZXJzIiwiaWQiLCJfbWF0Y2hlcnMiLCJfbGFzdFJlc2V0VGltZSIsIkRhdGUiLCJnZXRUaW1lIiwiY291bnRlcnMiLCJtYXRjaCIsImlucHV0IiwiZW50cmllcyIsImV2ZXJ5IiwiX3JlZiIsImtleSIsIm1hdGNoZXIiLCJjYWxsIiwiX2dlbmVyYXRlS2V5U3RyaW5nIiwiZmlsdGVyIiwiX3JlZjIiLCJyZWR1Y2UiLCJyZXR1cm5TdHJpbmciLCJfcmVmMyIsImFwcGx5IiwidGltZVNpbmNlTGFzdFJlc2V0IiwidGltZVRvTmV4dFJlc2V0IiwiaW50ZXJ2YWxUaW1lIiwicmVzZXRDb3VudGVyIiwiX2V4ZWN1dGVDYWxsYmFjayIsInJlcGx5IiwicnVsZUlucHV0IiwiY2FsbGJhY2siLCJlIiwiY29uc29sZSIsImVycm9yIiwicnVsZXMiLCJjaGVjayIsImFsbG93ZWQiLCJ0aW1lVG9SZXNldCIsIm51bUludm9jYXRpb25zTGVmdCIsIkluZmluaXR5IiwibWF0Y2hlZFJ1bGVzIiwiX2ZpbmRBbGxNYXRjaGluZ1J1bGVzIiwiZm9yRWFjaCIsInJ1bGUiLCJydWxlUmVzdWx0IiwibnVtSW52b2NhdGlvbnMiLCJudW1SZXF1ZXN0c0FsbG93ZWQiLCJydWxlSWQiLCJhZGRSdWxlIiwiYmluZEVudmlyb25tZW50IiwibmV3UnVsZSIsImluY3JlbWVudCIsInZhbHVlcyIsInJlbW92ZVJ1bGUiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLE1BQU0sQ0FBQztNQUFDQyxXQUFXLEVBQUNBLENBQUEsS0FBSUE7SUFBVyxDQUFDLENBQUM7SUFBQyxJQUFJQyxNQUFNO0lBQUNILE1BQU0sQ0FBQ0ksSUFBSSxDQUFDLGVBQWUsRUFBQztNQUFDRCxNQUFNQSxDQUFDRSxDQUFDLEVBQUM7UUFBQ0YsTUFBTSxHQUFDRSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsTUFBTTtJQUFDTixNQUFNLENBQUNJLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQ0UsTUFBTUEsQ0FBQ0QsQ0FBQyxFQUFDO1FBQUNDLE1BQU0sR0FBQ0QsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlFLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBR3pPO0lBQ0EsTUFBTUMscUNBQXFDLEdBQUcsSUFBSTtJQUNsRDtJQUNBLE1BQU1DLDZCQUE2QixHQUFHLEVBQUU7SUFFeEMsTUFBTUMsTUFBTSxHQUFHQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYzs7SUFFOUM7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLE1BQU1DLElBQUksQ0FBQztNQUNUQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUVDLFFBQVEsRUFBRTtRQUM3QixJQUFJLENBQUNDLEVBQUUsR0FBR1osTUFBTSxDQUFDWSxFQUFFLENBQUMsQ0FBQztRQUVyQixJQUFJLENBQUNGLE9BQU8sR0FBR0EsT0FBTztRQUV0QixJQUFJLENBQUNHLFNBQVMsR0FBR0Ys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Q3FDLFVBQVUsQ0FBQy9CLEdBQUcsQ0FBQyxFQUFFO1VBQ2pDLENBQUMsTUFBTTtZQUNMOEIsSUFBSSxDQUFDcEMsUUFBUSxDQUFDcUMsVUFBVSxDQUFDL0IsR0FBRyxDQUFDLEdBQUcsQ0FBQztVQUNuQztRQUNGLENBQUMsQ0FBQztNQUNKOztNQUVBO01BQ0E0QixxQkFBcUJBLENBQUNoQyxLQUFLLEVBQUU7UUFDM0IsT0FBT2QsTUFBTSxDQUFDeUQsTUFBTSxDQUFDLElBQUksQ0FBQ2xCLEtBQUssQ0FBQyxDQUFDakIsTUFBTSxDQUFDMEIsSUFBSSxJQUFJQSxJQUFJLENBQUNuQyxLQUFLLENBQUNDLEtBQUssQ0FBQyxDQUFDO01BQ3BFOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNFNEMsVUFBVUEsQ0FBQ25ELEVBQUUsRUFBRTtRQUNiLElBQUksSUFBSSxDQUFDZ0MsS0FBSyxDQUFDaEMsRUFBRSxDQUFDLEVBQUU7VUFDbEIsT0FBTyxJQUFJLENBQUNnQyxLQUFLLENBQUNoQyxFQUFFLENBQUM7VUFDckIsT0FBTyxJQUFJO1FBQ2I7UUFDQSxPQUFPLEtBQUs7TUFDZDtJQUNGO0lBQUNvRCxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9yYXRlLWxpbWl0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBSYW5kb20gfSBmcm9tICdtZXRlb3IvcmFuZG9tJztcblxuLy8gRGVmYXVsdCB0aW1lIGludGVydmFsIChpbiBtaWxsaXNlY29uZHMpIHRvIHJlc2V0IHJhdGUgbGltaXQgY291bnRlcnNcbmNvbnN0IERFRkFVTFRfSU5URVJWQUxfVElNRV9JTl9NSUxMSVNFQ09ORFMgPSAxMDAwO1xuLy8gRGVmYXVsdCBudW1iZXIgb2YgZXZlbnRzIGFsbG93ZWQgcGVyIHRpbWUgaW50ZXJ2YWxcbmNvbnN0IERFRkFVTFRfUkVRVUVTVFNfUEVSX0lOVEVSVkFMID0gMTA7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIEEgcnVsZSBpcyBkZWZpbmVkIGJ5IGFuIG9wdGlvbnMgb2JqZWN0IHRoYXQgY29udGFpbnMgdHdvIGZpZWxkcyxcbi8vIGBudW1SZXF1ZXN0c0FsbG93ZWRgIHdoaWNoIGlzIHRoZSBudW1iZXIgb2YgZXZlbnRzIGFsbG93ZWQgcGVyIGludGVydmFsLCBhbmRcbi8vIGFuIGBpbnRlcnZhbFRpbWVgIHdoaWNoIGlzIHRoZSBhbW91bnQgb2YgdGltZSBpbiBtaWxsaXNlY29uZHMgYmVmb3JlIHRoZVxuLy8gcmF0ZSBsaW1pdCByZXN0YXJ0cyBpdHMgaW50ZXJuYWwgY291bnRlcnMsIGFuZCBieSBhIG1hdGNoZXJzIG9iamVjdC4gQVxuLy8gbWF0Y2hlcnMgb2JqZWN0IGlzIGEgUE9KTyB0aGF0IGNvbnRhaW5zIGEgc2V0IG9mIGtleXMgd2l0aCB2YWx1ZXMgdGhhdFxuLy8gZGVmaW5lIHRoZSBlbnRpcmUgc2V0IG9mIGlucHV0cyB0aGF0IG1hdGNoIGZvciBlYWNoIGtleS4gVGhlIHZhbHVlcyBjYW5cbi8vIGVpdGhlciBiZSBudWxsIChvcHRpb25hbCksIGEgcHJpbWl0aXZlIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYm9vbGVhblxuLy8gb2Ygd2hldGhlciB0aGUgcHJvdmlkZWQgaW5wdXQncyB2YWx1ZSBtYXRjaGVzIGZvciB0aGlzIGtleS5cbi8vXG4vLyBSdWxlcyBhcmUgdW5pcXVlbHkgYXNzaWduZWQgYW4gYGlkYCBhbmQgdGhleSBzdG9yZSBhIGRpY3Rpb25hcnkgb2YgY291bnRlcnMsXG4vLyB3aGljaCBhcmUgcmVjb3JkcyB1c2VkIHRvIGtlZXAgdHJhY2sgb2YgaW5wdXRzIHRoYXQgbWF0Y2ggdGhlIHJ1bGUuIElmIGFcbi8vIGNvdW50ZXIgcmVhY2hlcyB0aGUgYG51bVJlcXVlc3RzQWxsb3dlZGAgd2l0aGluIGEgZ2l2ZW4gYGludGVydmFsVGltZWAsIGFcbi8vIHJhdGUgbGltaXQgaXMgcmVhY2hlZCBhbmQgZnV0dXJlIGlucHV0cyB0aGF0IG1hcCB0byB0aGF0IGNvdW50ZXIgd2lsbFxuLy8gcmVzdWx0IGluIGVycm9ycyBiZWluZyByZXR1cm5lZCB0byB0aGUgY2xpZW50LlxuY2xhc3MgUnVsZSB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMsIG1hdGNoZXJzKSB7XG4gICAgdGhpcy5pZCA9IFJhbmRvbS5pZCgpO1xuXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgIHRoaXMuX21hdGNoZXJzID0gbWF0Y2hlcnM7XG5cbiAgICB0aGlzLl9sYXN0UmVzZXRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cbiAgICAvLyBEaWN0aW9uYXJ5IG9mIGlucHV0IGtleXMgdG8gY291bnRlcnNcbiAgICB0aGlzLmNvdW50ZXJzID0ge307XG4gIH1cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoaXMgcnVsZSBhcHBsaWVzIHRvIHRoZSBnaXZlbiBpbnB1dCBieSBjb21wYXJpbmcgYWxsXG4gIC8vIHJ1bGUubWF0Y2hlcnMuIElmIHRoZSBtYXRjaCBmYWlscywgc2VhcmNoIHNob3J0IGNpcmN1aXRzIGluc3RlYWQgb2ZcbiAgLy8gaXRlcmF0aW5nIHRocm91Z2ggYWxsIG1hdGNoZXJzLlxuICBtYXRjaChpbnB1dCkge1xuICAgIHJldHVybiBPYmplY3RcbiAgICAgIC5lbnRyaWVzKHRoaXMuX21hdGNoZXJzKVxuICAgICAgLmV2ZXJ5KChba2V5LCBtYXRjaGVyXSkgPT4ge1xuICAgICAgICBpZiAobWF0Y2hlciAhPT0gbnVsbCkge1xuICAgICAgICAgIGlmICghaGFzT3duLmNhbGwoaW5wdXQsIGtleSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBtYXRjaGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBpZiAoIShtYXRjaGVyKGlucHV0W2tleV0pKSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChtYXRjaGVyICE9PSBpbnB1dFtrZXldKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBHZW5lcmF0ZXMgdW5pcXVlIGtleSBzdHJpbmcgZm9yIHByb3ZpZGVkIGlucHV0IGJ5IGNvbmNhdGVuYXRpbmcgYWxsIHRoZVxuICAvLyBrZXlzIGluIHRoZSBtYXRjaGVyIHdpdGggdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVzIGluIHRoZSBpbnB1dC5cbiAgLy8gT25seSBjYWxsZWQgaWYgcnVsZSBtYXRjaGVzIGlucHV0LlxuICBfZ2VuZXJhdGVLZXlTdHJpbmcoaW5wdXQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmVudHJpZXModGhpcy5fbWF0Y2hlcnMpXG4gICAgICAuZmlsdGVyKChba2V5XSkgPT4gdGhpcy5fbWF0Y2hlcnNba2V5XSAhPT0gbnVsbClcbiAgICAgIC5yZWR1Y2UoKHJldHVyblN0cmluZywgW2tleSwgbWF0Y2hlcl0pID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBtYXRjaGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgaWYgKG1hdGNoZXIoaW5wdXRba2V5XSkpIHtcbiAgICAgICAgICAgIHJldHVyblN0cmluZyArPSBrZXkgKyBpbnB1dFtrZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm5TdHJpbmcgKz0ga2V5ICsgaW5wdXRba2V5XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmV0dXJuU3RyaW5nO1xuICAgICAgfSwgJycpO1xuICB9XG5cbiAgLy8gQXBwbGllcyB0aGUgcHJvdmlkZWQgaW5wdXQgYW5kIHJldHVybnMgdGhlIGtleSBzdHJpbmcsIHRpbWUgc2luY2UgY291bnRlcnNcbiAgLy8gd2VyZSBsYXN0IHJlc2V0IGFuZCB0aW1lIHRvIG5leHQgcmVzZXQuXG4gIGFwcGx5KGlucHV0KSB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5fZ2VuZXJhdGVLZXlTdHJpbmcoaW5wdXQpO1xuICAgIGNvbnN0IHRpbWVTaW5jZUxhc3RSZXNldCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdGhpcy5fbGFzdFJlc2V0VGltZTtcbiAgICBjb25zdCB0aW1lVG9OZXh0UmVzZXQgPSB0aGlzLm9wdGlvbnMuaW50ZXJ2YWxUaW1lIC0gdGltZVNpbmNlTGFzdFJlc2V0O1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB0aW1lU2luY2VMYXN0UmVzZXQsXG4gICAgICB0aW1lVG9OZXh0UmVzZXQsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFJlc2V0IGNvdW50ZXIgZGljdGlvbmFyeSBmb3IgdGhpcyBzcGVjaWZpYyBydWxlLiBDYWxsZWQgb25jZSB0aGVcbiAgLy8gdGltZVNpbmNlTGFzdFJlc2V0IGhhcyBleGNlZWRlZCB0aGUgaW50ZXJ2YWxUaW1lLiBfbGFzdFJlc2V0VGltZSBpc1xuICAvLyBzZXQgdG8gYmUgdGhlIGN1cnJlbnQgdGltZSBpbiBtaWxsaXNlY29uZHMuXG4gIHJlc2V0Q291bnRlcigpIHtcbiAgICAvLyBEZWxldGUgdGhlIG9sZCBjb3VudGVycyBkaWN0aW9uYXJ5IHRvIGFsbG93IGZvciBnYXJiYWdlIGNvbGxlY3Rpb25cbiAgICB0aGlzLmNvdW50ZXJzID0ge307XG4gICAgdGhpcy5fbGFzdFJlc2V0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICB9XG5cbiAgX2V4ZWN1dGVDYWxsYmFjayhyZXBseSwgcnVsZUlucHV0KSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLmNhbGxiYWNrKHJlcGx5LCBydWxlSW5wdXQpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIERvIG5vdCB0aHJvdyBlcnJvciBoZXJlXG4gICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBSYXRlTGltaXRlciB7XG4gIC8vIEluaXRpYWxpemUgcnVsZXMgdG8gYmUgYW4gZW1wdHkgZGljdGlvbmFyeS5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gRGljdGlvbmFyeSBvZiBhbGwgcnVsZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgUmF0ZUxpbWl0ZXIsIGtleWVkIGJ5IHRoZWlyXG4gICAgLy8gaWQuIEVhY2ggcnVsZSBvYmplY3Qgc3RvcmVzIHRoZSBydWxlIHBhdHRlcm4sIG51bWJlciBvZiBldmVudHMgYWxsb3dlZCxcbiAgICAvLyBsYXN0IHJlc2V0IHRpbWUgYW5kIHRoZSBydWxlIHJlc2V0IGludGVydmFsIGluIG1pbGxpc2Vjb25kcy5cblxuICAgIHRoaXMucnVsZXMgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAqIENoZWNrcyBpZiB0aGlzIGlucHV0IGhhcyBleGNlZWRlZCBhbnkgcmF0ZSBsaW1pdHMuXG4gICogQHBhcmFtICB7b2JqZWN0fSBpbnB1dCBkaWN0aW9uYXJ5IGNvbnRhaW5pbmcga2V5LXZhbHVlIHBhaXJzIG9mIGF0dHJpYnV0ZXNcbiAgKiB0aGF0IG1hdGNoIHRvIHJ1bGVzXG4gICogQHJldHVybiB7b2JqZWN0fSBSZXR1cm5zIG9iamVjdCBvZiBmb2xsb3dpbmcgc3RydWN0dXJlXG4gICogeyAnYWxsb3dlZCc6IGJvb2xlYW4gLSBpcyB0aGlzIGlucHV0IGFsbG93ZWRcbiAgKiAgICd0aW1lVG9SZXNldCc6IGludGVnZXIgfCBJbmZpbml0eSAtIHJldHVybnMgdGltZSB1bnRpbCBjb3VudGVycyBhcmUgcmVzZXRcbiAgKiAgICAgICAgICAgICAgICAgICBpbiBtaWxsaXNlY29uZHNcbiAgKiAgICdudW1JbnZvY2F0aW9uc0xlZnQnOiBpbnRlZ2VyIHwgSW5maW5pdHkgLSByZXR1cm5zIG51bWJlciBvZiBjYWxscyBsZWZ0XG4gICogICBiZWZvcmUgbGltaXQgaXMgcmVhY2hlZFxuICAqIH1cbiAgKiBJZiBtdWx0aXBsZSBydWxlcyBtYXRjaCwgdGhlIGxlYXN0IG51bWJlciBvZiBpbnZvY2F0aW9ucyBsZWZ0IGlzIHJldHVybmVkLlxuICAqIElmIHRoZSByYXRlIGxpbWl0IGhhcyBiZWVuIHJlYWNoZWQsIHRoZSBsb25nZXN0IHRpbWVUb1Jlc2V0IGlzIHJldHVybmVkLlxuICAqL1xuICBjaGVjayhpbnB1dCkge1xuICAgIGNvbnN0IHJlcGx5ID0ge1xuICAgICAgYWxsb3dlZDogdHJ1ZSxcbiAgICAgIHRpbWVUb1Jlc2V0OiAwLFxuICAgICAgbnVtSW52b2NhdGlvbnNMZWZ0OiBJbmZpbml0eSxcbiAgICB9O1xuXG4gICAgY29uc3QgbWF0Y2hlZFJ1bGVzID0gdGhpcy5fZmluZEFsbE1hdGNoaW5nUnVsZXMoaW5wdXQpO1xuICAgIG1hdGNoZWRSdWxlcy5mb3JFYWNoKChydWxlKSA9PiB7XG4gICAgICBjb25zdCBydWxlUmVzdWx0ID0gcnVsZS5hcHBseShpbnB1dCk7XG4gICAgICBsZXQgbnVtSW52b2NhdGlvbnMgPSBydWxlLmNvdW50ZXJzW3J1bGVSZXN1bHQua2V5XTtcblxuICAgICAgaWYgKHJ1bGVSZXN1bHQudGltZVRvTmV4dFJlc2V0IDwgMCkge1xuICAgICAgICAvLyBSZXNldCBhbGwgdGhlIGNvdW50ZXJzIHNpbmNlIHRoZSBydWxlIGhhcyByZXNldFxuICAgICAgICBydWxlLnJlc2V0Q291bnRlcigpO1xuICAgICAgICBydWxlUmVzdWx0LnRpbWVTaW5jZUxhc3RSZXNldCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC1cbiAgICAgICAgICBydWxlLl9sYXN0UmVzZXRUaW1lO1xuICAgICAgICBydWxlUmVzdWx0LnRpbWVUb05leHRSZXNldCA9IHJ1bGUub3B0aW9ucy5pbnRlcnZhbFRpbWU7XG4gICAgICAgIG51bUludm9jYXRpb25zID0gMDtcbiAgICAgIH1cblxuICAgICAgaWYgKG51bUludm9jYXRpb25zID4gcnVsZS5vcHRpb25zLm51bVJlcXVlc3RzQWxsb3dlZCkge1xuICAgICAgICAvLyBPbmx5IHVwZGF0ZSB0aW1lVG9SZXNldCBpZiB0aGUgbmV3IHRpbWUgd291bGQgYmUgbG9uZ2VyIHRoYW4gdGhlXG4gICAgICAgIC8vIHByZXZpb3VzbHkgc2V0IHRpbWUuIFRoaXMgaXMgdG8gZW5zdXJlIHRoYXQgaWYgdGhpcyBpbnB1dCB0cmlnZ2Vyc1xuICAgICAgICAvLyBtdWx0aXBsZSBydWxlcywgd2UgcmV0dXJuIHRoZSBsb25nZXN0IHBlcmlvZCBvZiB0aW1lIHVudGlsIHRoZXkgY2FuXG4gICAgICAgIC8vIHN1Y2Nlc3NmdWxseSBtYWtlIGFub3RoZXIgY2FsbFxuICAgICAgICBpZiAocmVwbHkudGltZVRvUmVzZXQgPCBydWxlUmVzdWx0LnRpbWVUb05leHRSZXNldCkge1xuICAgICAgICAgIHJlcGx5LnRpbWVUb1Jlc2V0ID0gcnVsZVJlc3VsdC50aW1lVG9OZXh0UmVzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgcmVwbHkuYWxsb3dlZCA9IGZhbHNlO1xuICAgICAgICByZXBseS5udW1JbnZvY2F0aW9uc0xlZnQgPSAwO1xuICAgICAgICByZXBseS5ydWxlSWQgPSBydWxlLmlkO1xuICAgICAgICBydWxlLl9leGVjdXRlQ2FsbGJhY2socmVwbHksIGlucHV0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIHRoaXMgaXMgYW4gYWxsb3dlZCBhdHRlbXB0IGFuZCB3ZSBoYXZlbid0IGZhaWxlZCBvbiBhbnkgb2YgdGhlXG4gICAgICAgIC8vIG90aGVyIHJ1bGVzIHRoYXQgbWF0Y2gsIHVwZGF0ZSB0aGUgcmVwbHkgZmllbGQuXG4gICAgICAgIGlmIChydWxlLm9wdGlvbnMubnVtUmVxdWVzdHNBbGxvd2VkIC0gbnVtSW52b2NhdGlvbnMgPFxuICAgICAgICAgIHJlcGx5Lm51bUludm9jYXRpb25zTGVmdCAmJiByZXBseS5hbGxvd2VkKSB7XG4gICAgICAgICAgcmVwbHkudGltZVRvUmVzZXQgPSBydWxlUmVzdWx0LnRpbWVUb05leHRSZXNldDtcbiAgICAgICAgICByZXBseS5udW1JbnZvY2F0aW9uc0xlZnQgPSBydWxlLm9wdGlvbnMubnVtUmVxdWVzdHNBbGxvd2VkIC1cbiAgICAgICAgICAgIG51bUludm9jYXRpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJlcGx5LnJ1bGVJZCA9IHJ1bGUuaWQ7XG4gICAgICAgIHJ1bGUuX2V4ZWN1dGVDYWxsYmFjayhyZXBseSwgaW5wdXQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXBseTtcbiAgfVxuXG4gIC8qKlxuICAqIEFkZHMgYSBydWxlIHRvIGRpY3Rpb25hcnkgb2YgcnVsZXMgdGhhdCBhcmUgY2hlY2tlZCBhZ2FpbnN0IG9uIGV2ZXJ5IGNhbGwuXG4gICogT25seSBpbnB1dHMgdGhhdCBwYXNzIGFsbCBvZiB0aGUgcnVsZXMgd2lsbCBiZSBhbGxvd2VkLiBSZXR1cm5zIHVuaXF1ZSBydWxlXG4gICogaWQgdGhhdCBjYW4gYmUgcGFzc2VkIHRvIGByZW1vdmVSdWxlYC5cbiAgKiBAcGFyYW0ge29iamVjdH0gcnVsZSAgICBJbnB1dCBkaWN0aW9uYXJ5IGRlZmluaW5nIGNlcnRhaW4gYXR0cmlidXRlcyBhbmRcbiAgKiBydWxlcyBhc3NvY2lhdGVkIHdpdGggdGhlbS5cbiAgKiBFYWNoIGF0dHJpYnV0ZSdzIHZhbHVlIGNhbiBlaXRoZXIgYmUgYSB2YWx1ZSwgYSBmdW5jdGlvbiBvciBudWxsLiBBbGxcbiAgKiBmdW5jdGlvbnMgbXVzdCByZXR1cm4gYSBib29sZWFuIG9mIHdoZXRoZXIgdGhlIGlucHV0IGlzIG1hdGNoZWQgYnkgdGhhdFxuICAqIGF0dHJpYnV0ZSdzIHJ1bGUgb3Igbm90XG4gICogQHBhcmFtIHtpbnRlZ2VyfSBudW1SZXF1ZXN0c0FsbG93ZWQgT3B0aW9uYWwuIE51bWJlciBvZiBldmVudHMgYWxsb3dlZCBwZXJcbiAgKiBpbnRlcnZhbC4gRGVmYXVsdCA9IDEwLlxuICAqIEBwYXJhbSB7aW50ZWdlcn0gaW50ZXJ2YWxUaW1lIE9wdGlvbmFsLiBOdW1iZXIgb2YgbWlsbGlzZWNvbmRzIGJlZm9yZVxuICAqIHJ1bGUncyBjb3VudGVycyBhcmUgcmVzZXQuIERlZmF1bHQgPSAxMDAwLlxuICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrIE9wdGlvbmFsLiBGdW5jdGlvbiB0byBiZSBjYWxsZWQgYWZ0ZXIgYVxuICAqIHJ1bGUgaXMgZXhlY3V0ZWQuIFR3byBvYmplY3RzIHdpbGwgYmUgcGFzc2VkIHRvIHRoaXMgZnVuY3Rpb24uXG4gICogVGhlIGZpcnN0IG9uZSBpcyB0aGUgcmVzdWx0IG9mIFJhdGVMaW1pdGVyLnByb3RvdHlwZS5jaGVja1xuICAqIFRoZSBzZWNvbmQgaXMgdGhlIGlucHV0IG9iamVjdCBvZiB0aGUgcnVsZSwgaXQgaGFzIHRoZSBmb2xsb3dpbmcgc3RydWN0dXJlOlxuICAqIHtcbiAgKiAgICd0eXBlJzogc3RyaW5nIC0gZWl0aGVyICdtZXRob2QnIG9yICdzdWJzY3JpcHRpb24nXG4gICogICAnbmFtZSc6IHN0cmluZyAtIHRoZSBuYW1lIG9mIHRoZSBtZXRob2Qgb3Igc3Vic2NyaXB0aW9uIGJlaW5nIGNhbGxlZFxuICAqICAgJ3VzZXJJZCc6IHN0cmluZyAtIHRoZSB1c2VyIElEIGF0dGVtcHRpbmcgdGhlIG1ldGhvZCBvciBzdWJzY3JpcHRpb25cbiAgKiAgICdjb25uZWN0aW9uSWQnOiBzdHJpbmcgLSBhIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIHVzZXIncyBERFAgY29ubmVjdGlvblxuICAqICAgJ2NsaWVudEFkZHJlc3MnOiBzdHJpbmcgLSB0aGUgSVAgYWRkcmVzcyBvZiB0aGUgdXNlclxuICAqIH1cbiAgKiBAcmV0dXJuIHtzdHJpbmd9IFJldHVybnMgdW5pcXVlIHJ1bGUgaWRcbiAgKi9cbiAgYWRkUnVsZShydWxlLCBudW1SZXF1ZXN0c0FsbG93ZWQsIGludGVydmFsVGltZSwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgbnVtUmVxdWVzdHNBbGxvd2VkOiBudW1SZXF1ZXN0c0FsbG93ZWQgfHwgREVGQVVMVF9SRVFVRVNUU19QRVJfSU5URVJWQUwsXG4gICAgICBpbnRlcnZhbFRpbWU6IGludGVydmFsVGltZSB8fCBERUZBVUxUX0lOVEVSVkFMX1RJTUVfSU5fTUlMTElTRUNPTkRTLFxuICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrICYmIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2spLFxuICAgIH07XG5cbiAgICBjb25zdCBuZXdSdWxlID0gbmV3IFJ1bGUob3B0aW9ucywgcnVsZSk7XG4gICAgdGhpcy5ydWxlc1tuZXdSdWxlLmlkXSA9IG5ld1J1bGU7XG4gICAgcmV0dXJuIG5ld1J1bGUuaWQ7XG4gIH1cblxuICAvKipcbiAgKiBJbmNyZW1lbnQgY291bnRlcnMgaW4gZXZlcnkgcnVsZSB0aGF0IG1hdGNoIHRvIHRoaXMgaW5wdXRcbiAgKiBAcGFyYW0gIHtvYmplY3R9IGlucHV0IERpY3Rpb25hcnkgb2JqZWN0IGNvbnRhaW5pbmcgYXR0cmlidXRlcyB0aGF0IG1heVxuICAqIG1hdGNoIHRvIHJ1bGVzXG4gICovXG4gIGluY3JlbWVudChpbnB1dCkge1xuICAgIC8vIE9ubHkgaW5jcmVtZW50IHJ1bGUgY291bnRlcnMgdGhhdCBtYXRjaCB0aGlzIGlucHV0XG4gICAgY29uc3QgbWF0Y2hlZFJ1bGVzID0gdGhpcy5fZmluZEFsbE1hdGNoaW5nUnVsZXMoaW5wdXQpO1xuICAgIG1hdGNoZWRSdWxlcy5mb3JFYWNoKChydWxlKSA9PiB7XG4gICAgICBjb25zdCBydWxlUmVzdWx0ID0gcnVsZS5hcHBseShpbnB1dCk7XG5cbiAgICAgIGlmIChydWxlUmVzdWx0LnRpbWVTaW5jZUxhc3RSZXNldCA+IHJ1bGUub3B0aW9ucy5pbnRlcnZhbFRpbWUpIHtcbiAgICAgICAgLy8gUmVzZXQgYWxsIHRoZSBjb3VudGVycyBzaW5jZSB0aGUgcnVsZSBoYXMgcmVzZXRcbiAgICAgICAgcnVsZS5yZXNldENvdW50ZXIoKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgd2hldGhlciB0aGUga2V5IGV4aXN0cywgaW5jcmVtZW50aW5nIGl0IGlmIHNvIG9yIG90aGVyd2lzZVxuICAgICAgLy8gYWRkaW5nIHRoZSBrZXkgYW5kIHNldHRpbmcgaXRzIHZhbHVlIHRvIDFcbiAgICAgIGlmIChoYXNPd24uY2FsbChydWxlLmNvdW50ZXJzLCBydWxlUmVzdWx0LmtleSkpIHtcbiAgICAgICAgcnVsZS5jb3VudGVyc1tydWxlUmVzdWx0LmtleV0rKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJ1bGUuY291bnRlcnNbcnVsZVJlc3VsdC5rZXldID0gMTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYW4gYXJyYXkgb2YgYWxsIHJ1bGVzIHRoYXQgYXBwbHkgdG8gcHJvdmlkZWQgaW5wdXRcbiAgX2ZpbmRBbGxNYXRjaGluZ1J1bGVzKGlucHV0KSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5ydWxlcykuZmlsdGVyKHJ1bGUgPT4gcnVsZS5tYXRjaChpbnB1dCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3ZpZGVzIGEgbWVjaGFuaXNtIHRvIHJlbW92ZSBydWxlcyBmcm9tIHRoZSByYXRlIGxpbWl0ZXIuIFJldHVybnMgYm9vbGVhblxuICAgKiBhYm91dCBzdWNjZXNzLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIFJ1bGUgaWQgcmV0dXJuZWQgZnJvbSAjYWRkUnVsZVxuICAgKiBAcmV0dXJuIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgcnVsZSB3YXMgZm91bmQgYW5kIGRlbGV0ZWQsIGVsc2UgZmFsc2UuXG4gICAqL1xuICByZW1vdmVSdWxlKGlkKSB7XG4gICAgaWYgKHRoaXMucnVsZXNbaWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5ydWxlc1tpZF07XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydCB7IFJhdGVMaW1pdGVyIH07XG4iXX0=
