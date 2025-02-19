//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
// Source maps are supported by all recent versions of Chrome, Safari,  //
// and Firefox, and by Internet Explorer 11.                            //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


Package["core-runtime"].queue("ordered-dict",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package.modules.meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-client'].Symbol;
var Map = Package['ecmascript-runtime-client'].Map;
var Set = Package['ecmascript-runtime-client'].Set;

/* Package-scope variables */
var OrderedDict;

var require = meteorInstall({"node_modules":{"meteor":{"ordered-dict":{"ordered_dict.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/ordered-dict/ordered_dict.js                                                                  //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
var _regeneratorRuntime;
module.link("@babel/runtime/regenerator", {
  default: function (v) {
    _regeneratorRuntime = v;
  }
}, 0);
module.export({
  OrderedDict: function () {
    return OrderedDict;
  }
});
// This file defines an ordered dictionary abstraction that is useful for
// maintaining a dataset backed by observeChanges.  It supports ordering items
// by specifying the item they now come before.

// The implementation is a dictionary that contains nodes of a doubly-linked
// list as its values.

// constructs a new element struct
// next and prev are whole elements, not keys.
function element(key, value, next, prev) {
  return {
    key: key,
    value: value,
    next: next,
    prev: prev
  };
}
var OrderedDict = /*#__PURE__*/function () {
  function OrderedDict() {
    var _this = this;
    this._dict = Object.create(null);
    this._first = null;
    this._last = null;
    this._size = 0;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    if (typeof args[0] === 'function') {
      this._stringify = args.shift();
    } else {
      this._stringify = function (x) {
        return x;
      };
    }
    args.forEach(function (kv) {
      return _this.putBefore(kv[0], kv[1], null);
    });
  }

  // the "prefix keys with a space" thing comes from here
  // https://github.com/documentcloud/underscore/issues/376#issuecomment-2815649
  var _proto = OrderedDict.prototype;
  _proto._k = function () {
    function _k(key) {
      return " " + this._stringify(key);
    }
    return _k;
  }();
  _proto.empty = function () {
    function empty() {
      return !this._first;
    }
    return empty;
  }();
  _proto.size = function () {
    function size() {
      return this._size;
    }
    return size;
  }();
  _proto._linkEltIn = function () {
    function _linkEltIn(elt) {
      if (!elt.next) {
        elt.prev = this._last;
        if (this._last) this._last.next = elt;
        this._last = elt;
      } else {
        elt.prev = elt.next.prev;
        elt.next.prev = elt;
        if (elt.prev) elt.prev.next = elt;
      }
      if (this._first === null || this._first === elt.next) this._first = elt;
    }
    return _linkEltIn;
  }();
  _proto._linkEltOut = function () {
    function _linkEltOut(elt) {
      if (elt.next) elt.next.prev = elt.prev;
      if (elt.prev) elt.prev.next = elt.next;
      if (elt === this._last) this._last = elt.prev;
      if (elt === this._first) this._first = elt.next;
    }
    return _linkEltOut;
  }();
  _proto.putBefore = function () {
    function putBefore(key, item, before) {
      if (this._dict[this._k(key)]) throw new Error("Item " + key + " already present in OrderedDict");
      var elt = before ? element(key, item, this._dict[this._k(before)]) : element(key, item, null);
      if (typeof elt.next === "undefined") throw new Error("could not find item to put this one before");
      this._linkEltIn(elt);
      this._dict[this._k(key)] = elt;
      this._size++;
    }
    return putBefore;
  }();
  _proto.append = function () {
    function append(key, item) {
      this.putBefore(key, item, null);
    }
    return append;
  }();
  _proto.remove = function () {
    function remove(key) {
      var elt = this._dict[this._k(key)];
      if (typeof elt === "undefined") throw new Error("Item " + key + " not present in OrderedDict");
      this._linkEltOut(elt);
      this._size--;
      delete this._dict[this._k(key)];
      return elt.value;
    }
    return remove;
  }();
  _proto.get = function () {
    function get(key) {
      if (this.has(key)) {
        return this._dict[this._k(key)].value;
      }
    }
    return get;
  }();
  _proto.has = function () {
    function has(key) {
      return Object.prototype.hasOwnProperty.call(this._dict, this._k(key));
    }
    return has;
  }() // Iterate through the items in this dictionary in order, calling
  // iter(value, key, index) on each one.
  // Stops whenever iter returns OrderedDict.BREAK, or after the last element.
  ;
  _proto.forEach = function () {
    function forEach(iter) {
      var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var i = 0;
      var elt = this._first;
      while (elt !== null) {
        var b = iter.call(context, elt.value, elt.key, i);
        if (b === OrderedDict.BREAK) return;
        elt = elt.next;
        i++;
      }
    }
    return forEach;
  }();
  _proto.forEachAsync = function () {
    function forEachAsync(asyncIter) {
      var context,
        i,
        elt,
        b,
        _args = arguments;
      return _regeneratorRuntime.async(function () {
        function forEachAsync$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              context = _args.length > 1 && _args[1] !== undefined ? _args[1] : null;
              i = 0;
              elt = this._first;
            case 3:
              if (!(elt !== null)) {
                _context.next = 13;
                break;
              }
              _context.next = 6;
              return _regeneratorRuntime.awrap(asyncIter.call(context, elt.value, elt.key, i));
            case 6:
              b = _context.sent;
              if (!(b === OrderedDict.BREAK)) {
                _context.next = 9;
                break;
              }
              return _context.abrupt("return");
            case 9:
              elt = elt.next;
              i++;
              _context.next = 3;
              break;
            case 13:
            case "end":
              return _context.stop();
          }
        }
        return forEachAsync$;
      }(), null, this, null, Promise);
    }
    return forEachAsync;
  }();
  _proto.first = function () {
    function first() {
      if (this.empty()) {
        return;
      }
      return this._first.key;
    }
    return first;
  }();
  _proto.firstValue = function () {
    function firstValue() {
      if (this.empty()) {
        return;
      }
      return this._first.value;
    }
    return firstValue;
  }();
  _proto.last = function () {
    function last() {
      if (this.empty()) {
        return;
      }
      return this._last.key;
    }
    return last;
  }();
  _proto.lastValue = function () {
    function lastValue() {
      if (this.empty()) {
        return;
      }
      return this._last.value;
    }
    return lastValue;
  }();
  _proto.prev = function () {
    function prev(key) {
      if (this.has(key)) {
        var elt = this._dict[this._k(key)];
        if (elt.prev) return elt.prev.key;
      }
      return null;
    }
    return prev;
  }();
  _proto.next = function () {
    function next(key) {
      if (this.has(key)) {
        var elt = this._dict[this._k(key)];
        if (elt.next) return elt.next.key;
      }
      return null;
    }
    return next;
  }();
  _proto.moveBefore = function () {
    function moveBefore(key, before) {
      var elt = this._dict[this._k(key)];
      var eltBefore = before ? this._dict[this._k(before)] : null;
      if (typeof elt === "undefined") {
        throw new Error("Item to move is not present");
      }
      if (typeof eltBefore === "undefined") {
        throw new Error("Could not find element to move this one before");
      }
      if (eltBefore === elt.next)
        // no moving necessary
        return;
      // remove from its old place
      this._linkEltOut(elt);
      // patch into its new place
      elt.next = eltBefore;
      this._linkEltIn(elt);
    }
    return moveBefore;
  }() // Linear, sadly.
  ;
  _proto.indexOf = function () {
    function indexOf(key) {
      var _this2 = this;
      var ret = null;
      this.forEach(function (v, k, i) {
        if (_this2._k(k) === _this2._k(key)) {
          ret = i;
          return OrderedDict.BREAK;
        }
        return;
      });
      return ret;
    }
    return indexOf;
  }();
  _proto._checkRep = function () {
    function _checkRep() {
      var _this3 = this;
      Object.keys(this._dict).forEach(function (k) {
        var v = _this3._dict[k];
        if (v.next === v) {
          throw new Error("Next is a loop");
        }
        if (v.prev === v) {
          throw new Error("Prev is a loop");
        }
      });
    }
    return _checkRep;
  }();
  return OrderedDict;
}();
OrderedDict.BREAK = {
  "break": true
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      OrderedDict: OrderedDict
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ordered-dict/ordered_dict.js"
  ],
  mainModulePath: "/node_modules/meteor/ordered-dict/ordered_dict.js"
}});
