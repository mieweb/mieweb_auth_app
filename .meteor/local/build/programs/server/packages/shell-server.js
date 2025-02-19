Package["core-runtime"].queue("shell-server",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Babel = Package['babel-compiler'].Babel;
var BabelCompiler = Package['babel-compiler'].BabelCompiler;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var socket;

var require = meteorInstall({"node_modules":{"meteor":{"shell-server":{"main.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                             //
// packages/shell-server/main.js                                                               //
//                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                               //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("./shell-server.js", {
      "*": "*"
    }, 0);
    let listen;
    module.link("./shell-server.js", {
      listen(v) {
        listen = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const shellDir = process.env.METEOR_SHELL_DIR;
    if (shellDir) {
      listen(shellDir);
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
/////////////////////////////////////////////////////////////////////////////////////////////////

},"shell-server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                             //
// packages/shell-server/shell-server.js                                                       //
//                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                               //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module1.export({
      listen: () => listen,
      disable: () => disable
    });
    let assert;
    module1.link("assert", {
      default(v) {
        assert = v;
      }
    }, 0);
    let pathJoin;
    module1.link("path", {
      join(v) {
        pathJoin = v;
      }
    }, 1);
    let PassThrough;
    module1.link("stream", {
      PassThrough(v) {
        PassThrough = v;
      }
    }, 2);
    let closeSync, openSync, readFileSync, unlink, writeFileSync, writeSync;
    module1.link("fs", {
      closeSync(v) {
        closeSync = v;
      },
      openSync(v) {
        openSync = v;
      },
      readFileSync(v) {
        readFileSync = v;
      },
      unlink(v) {
        unlink = v;
      },
      writeFileSync(v) {
        writeFileSync = v;
      },
      writeSync(v) {
        writeSync = v;
      }
    }, 3);
    let createServer;
    module1.link("net", {
      createServer(v) {
        createServer = v;
      }
    }, 4);
    let replStart;
    module1.link("repl", {
      start(v) {
        replStart = v;
      }
    }, 5);
    module1.link("meteor/inter-process-messaging");
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const INFO_FILE_MODE = parseInt("600", 8); // Only the owner can read or write.
    const EXITING_MESSAGE = "Shell exiting...";

    // Invoked by the server process to listen for incoming connections from
    // shell clients. Each connection gets its own REPL instance.
    function listen(shellDir) {
      function callback() {
        new Server(shellDir).listen();
      }

      // If the server is still in the very early stages of starting up,
      // Meteor.startup may not available yet.
      if (typeof Meteor === "object") {
        Meteor.startup(callback);
      } else if (typeof __meteor_bootstrap__ === "object") {
        const hooks = __meteor_bootstrap__.startupHooks;
        if (hooks) {
          hooks.push(callback);
        } else {
          // As a fallback, just call the callback asynchronously.
          setImmediate(callback);
        }
      }
    }
    function disable(shellDir) {
      try {
        // Replace info.json with a file that says the shell server is
        // disabled, so that any connected shell clients will fail to
        // reconnect after the server process closes their sockets.
        writeFileSync(getInfoFile(shellDir), JSON.stringify({
          status: "disabled",
          reason: "Shell server has shut down."
        }) + "\n", {
          mode: INFO_FILE_MODE
        });
      } catch (ignored) {}
    }
    // Shell commands need to be executed in a Fiber in case they call into
    // code that yields. Using a Promise is an even better idea, since it runs
    // its callbacks in Fibers drawn from a pool, so the Fibers are recycled.
    const evalCommandPromise = Promise.resolve();
    class Server {
      constructor(shellDir) {
        assert.ok(this instanceof Server);
        this.shellDir = shellDir;
        this.key = Math.random().toString(36).slice(2);
        this.server = createServer(socket => {
          this.onConnection(socket);
        }).on("error", err => {
          console.error(err.stack);
        });
      }
      listen() {
        const infoFile = getInfoFile(this.shellDir);
        unlink(infoFile, () => {
          this.server.listen(0, "127.0.0.1", () => {
            writeFileSync(infoFile, JSON.stringify({
              status: "enabled",
              port: this.server.address().port,
              key: this.key
            }) + "\n", {
              mode: INFO_FILE_MODE
            });
          });
        });
      }
      onConnection(socket) {
        // Make sure this function doesn't try to write anything to the socket
        // after it has been closed.
        socket.on("close", function () {
          socket = null;
        });

        // If communication is not established within 1000ms of the first
        // connection, forcibly close the socket.
        const timeout = setTimeout(function () {
          if (socket) {
            socket.removeAllListeners("data");
            socket.end(EXITING_MESSAGE + "\n");
          }
        }, 1000);

        // Let connecting clients configure certain REPL options by sending a
        // JSON object over the socket. For example, only the client knows
        // whether it's running a TTY or an Emacs subshell or some other kind of
        // terminal, so the client must decide the value of options.terminal.
        readJSONFromStream(socket, (error, options, replInputSocket) => {
          clearTimeout(timeout);
          if (error) {
            socket = null;
            console.error(error.stack);
            return;
          }
          if (options.key !== this.key) {
            if (socket) {
              socket.end(EXITING_MESSAGE + "\n");
            }
            return;
          }
          delete options.key;

          // Set the columns to what is being requested by the client.
          if (options.columns && socket) {
            socket.columns = options.columns;
          }
          delete options.columns;
          options = Object.assign(Object.create(null),
          // Defaults for configurable options.
          {
            prompt: "> ",
            terminal: true,
            useColors: true,
            ignoreUndefined: true
          },
          // Configurable options
          options,
          // Immutable options.
          {
            input: replInputSocket,
            useGlobal: false,
            output: socket
          });

          // The prompt during an evaluateAndExit must be blank to ensure
          // that the prompt doesn't inadvertently get parsed as part of
          // the JSON communication channel.
          if (options.evaluateAndExit) {
            options.prompt = "";
          }

          // Start the REPL.
          this.startREPL(options);
          if (options.evaluateAndExit) {
            this._wrappedDefaultEval.call(Object.create(null), options.evaluateAndExit.command, global, options.evaluateAndExit.filename || "<meteor shell>", function (error, result) {
              if (socket) {
                function sendResultToSocket(message) {
                  // Sending back a JSON payload allows the client to
                  // distinguish between errors and successful results.
                  socket.end(JSON.stringify(message) + "\n");
                }
                if (error) {
                  sendResultToSocket({
                    error: error.toString(),
                    code: 1
                  });
                } else {
                  sendResultToSocket({
                    result
                  });
                }
              }
            });
            return;
          }
          delete options.evaluateAndExit;
          this.enableInteractiveMode(options);
        });
      }
      startREPL(options) {
        // Make sure this function doesn't try to write anything to the output
        // stream after it has been closed.
        options.output.on("close", function () {
          options.output = null;
        });
        const repl = this.repl = replStart(options);
        const {
          shellDir
        } = this;

        // This is technique of setting `repl.context` is similar to how the
        // `useGlobal` option would work during a normal `repl.start()` and
        // allows shell access (and tab completion!) to Meteor globals (i.e.
        // Underscore _, Meteor, etc.). By using this technique, which changes
        // the context after startup, we avoid stomping on the special `_`
        // variable (in `repl` this equals the value of the last command) from
        // being overridden in the client/server socket-handshaking.  Furthermore,
        // by setting `useGlobal` back to true, we allow the default eval function
        // to use the desired `runInThisContext` method (https://git.io/vbvAB).
        repl.context = global;
        repl.useGlobal = true;
        setRequireAndModule(repl.context);

        // In order to avoid duplicating code here, specifically the complexities
        // of catching so-called "Recoverable Errors" (https://git.io/vbvbl),
        // we will wrap the default eval, run it in a Fiber (via a Promise), and
        // give it the opportunity to decide if the user is mid-code-block.
        const defaultEval = repl.eval;
        function wrappedDefaultEval(code, context, file, callback) {
          if (Package['babel-compiler']) {
            try {
              code = Package['babel-compiler'].Babel.compileForShell(code, {
                cacheDirectory: getCacheDirectory(shellDir)
              });
            } catch (err) {
              // Any Babel error here might be just fine since it's
              // possible the code was incomplete (multi-line code on the REPL).
              // The defaultEval below will use its own functionality to determine
              // if this error is "recoverable".
            }
          }
          evalCommandPromise.then(() => defaultEval(code, context, file, (error, result) => {
            if (error) {
              callback(error);
            } else {
              // Check if the result is a Promise
              if (result && typeof result.then === 'function') {
                // Handle the Promise resolution and rejection
                result.then(resolvedResult => {
                  callback(null, resolvedResult);
                }).catch(rejectedError => {
                  callback(rejectedError);
                });
              } else {
                callback(null, result);
              }
            }
          })).catch(callback);
        }

        // Have the REPL use the newly wrapped function instead and store the
        // _wrappedDefaultEval so that evalulateAndExit calls can use it directly.
        repl.eval = this._wrappedDefaultEval = wrappedDefaultEval;
      }
      enableInteractiveMode(options) {
        // History persists across shell sessions!
        this.initializeHistory();
        const repl = this.repl;

        // Implement an alternate means of fetching the return value,
        // via `__` (double underscore) as originally implemented in:
        // https://github.com/meteor/meteor/commit/2443d832265c7d1c
        Object.defineProperty(repl.context, "__", {
          get: () => repl.last,
          set: val => {
            repl.last = val;
          },
          // Allow this property to be (re)defined more than once (e.g. each
          // time the server restarts).
          configurable: true
        });

        // Some improvements to the existing help messages.
        function addHelp(cmd, helpText) {
          const info = repl.commands[cmd] || repl.commands["." + cmd];
          if (info) {
            info.help = helpText;
          }
        }
        addHelp("break", "Terminate current command input and display new prompt");
        addHelp("exit", "Disconnect from server and leave shell");
        addHelp("help", "Show this help information");

        // When the REPL exits, signal the attached client to exit by sending it
        // the special EXITING_MESSAGE.
        repl.on("exit", function () {
          if (options.output) {
            options.output.write(EXITING_MESSAGE + "\n");
            options.output.end();
          }
        });

        // When the server process exits, end the output stream but do not
        // signal the attached client to exit.
        process.on("exit", function () {
          if (options.output) {
            options.output.end();
          }
        });

        // This Meteor-specific shell command rebuilds the application as if a
        // change was made to server code.
        repl.defineCommand("reload", {
          help: "Restart the server and the shell",
          action: function () {
            if (process.sendMessage) {
              process.sendMessage("shell-server", {
                command: "reload"
              });
            } else {
              process.exit(0);
            }
          }
        });
      }

      // This function allows a persistent history of shell commands to be saved
      // to and loaded from .meteor/local/shell/history.
      initializeHistory() {
        const repl = this.repl;
        const historyFile = getHistoryFile(this.shellDir);
        let historyFd = openSync(historyFile, "a+");
        const historyLines = readFileSync(historyFile, "utf8").split("\n");
        const seenLines = Object.create(null);
        if (!repl.history) {
          repl.history = [];
          repl.historyIndex = -1;
        }
        while (repl.history && historyLines.length > 0) {
          const line = historyLines.pop();
          if (line && /\S/.test(line) && !seenLines[line]) {
            repl.history.push(line);
            seenLines[line] = true;
          }
        }
        repl.addListener("line", function (line) {
          if (historyFd >= 0 && /\S/.test(line)) {
            writeSync(historyFd, line + "\n");
          }
        });
        this.repl.on("exit", function () {
          closeSync(historyFd);
          historyFd = -1;
        });
      }
    }
    function readJSONFromStream(inputStream, callback) {
      const outputStream = new PassThrough();
      let dataSoFar = "";
      function onData(buffer) {
        const lines = buffer.toString("utf8").split("\n");
        while (lines.length > 0) {
          dataSoFar += lines.shift();
          let json;
          try {
            json = JSON.parse(dataSoFar);
          } catch (error) {
            if (error instanceof SyntaxError) {
              continue;
            }
            return finish(error);
          }
          if (lines.length > 0) {
            outputStream.write(lines.join("\n"));
          }
          inputStream.pipe(outputStream);
          return finish(null, json);
        }
      }
      function onClose() {
        finish(new Error("stream unexpectedly closed"));
      }
      let finished = false;
      function finish(error, json) {
        if (!finished) {
          finished = true;
          inputStream.removeListener("data", onData);
          inputStream.removeListener("error", finish);
          inputStream.removeListener("close", onClose);
          callback(error, json, outputStream);
        }
      }
      inputStream.on("data", onData);
      inputStream.on("error", finish);
      inputStream.on("close", onClose);
    }
    function getInfoFile(shellDir) {
      return pathJoin(shellDir, "info.json");
    }
    function getHistoryFile(shellDir) {
      return pathJoin(shellDir, "history");
    }
    function getCacheDirectory(shellDir) {
      return pathJoin(shellDir, "cache");
    }
    function setRequireAndModule(context) {
      if (Package.modules) {
        // Use the same `require` function and `module` object visible to the
        // application.
        const toBeInstalled = {};
        const shellModuleName = "meteor-shell-" + Math.random().toString(36).slice(2) + ".js";
        toBeInstalled[shellModuleName] = function (require, exports, module) {
          context.module = module;
          context.require = require;

          // Tab completion sometimes uses require.extensions, but only for
          // the keys.
          require.extensions = {
            ".js": true,
            ".json": true,
            ".node": true
          };
        };

        // This populates repl.context.{module,require} by evaluating the
        // module defined above.
        Package.modules.meteorInstall(toBeInstalled)("./" + shellModuleName);
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
/////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/shell-server/main.js"
  ],
  mainModulePath: "/node_modules/meteor/shell-server/main.js"
}});

//# sourceURL=meteor://💻app/packages/shell-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc2hlbGwtc2VydmVyL21haW4uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3NoZWxsLXNlcnZlci9zaGVsbC1zZXJ2ZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsImxpc3RlbiIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsInNoZWxsRGlyIiwicHJvY2VzcyIsImVudiIsIk1FVEVPUl9TSEVMTF9ESVIiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJtb2R1bGUxIiwiZXhwb3J0IiwiZGlzYWJsZSIsImFzc2VydCIsImRlZmF1bHQiLCJwYXRoSm9pbiIsImpvaW4iLCJQYXNzVGhyb3VnaCIsImNsb3NlU3luYyIsIm9wZW5TeW5jIiwicmVhZEZpbGVTeW5jIiwidW5saW5rIiwid3JpdGVGaWxlU3luYyIsIndyaXRlU3luYyIsImNyZWF0ZVNlcnZlciIsInJlcGxTdGFydCIsInN0YXJ0IiwiSU5GT19GSUxFX01PREUiLCJwYXJzZUludCIsIkVYSVRJTkdfTUVTU0FHRSIsImNhbGxiYWNrIiwiU2VydmVyIiwiTWV0ZW9yIiwic3RhcnR1cCIsIl9fbWV0ZW9yX2Jvb3RzdHJhcF9fIiwiaG9va3MiLCJzdGFydHVwSG9va3MiLCJwdXNoIiwic2V0SW1tZWRpYXRlIiwiZ2V0SW5mb0ZpbGUiLCJKU09OIiwic3RyaW5naWZ5Iiwic3RhdHVzIiwicmVhc29uIiwibW9kZSIsImlnbm9yZWQiLCJldmFsQ29tbWFuZFByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsImNvbnN0cnVjdG9yIiwib2siLCJrZXkiLCJNYXRoIiwicmFuZG9tIiwidG9TdHJpbmciLCJzbGljZSIsInNlcnZlciIsInNvY2tldCIsIm9uQ29ubmVjdGlvbiIsIm9uIiwiZXJyIiwiY29uc29sZSIsImVycm9yIiwic3RhY2siLCJpbmZvRmlsZSIsInBvcnQiLCJhZGRyZXNzIiwidGltZW91dCIsInNldFRpbWVvdXQiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJlbmQiLCJyZWFkSlNPTkZyb21TdHJlYW0iLCJvcHRpb25zIiwicmVwbElucHV0U29ja2V0IiwiY2xlYXJUaW1lb3V0IiwiY29sdW1ucyIsIk9iamVjdCIsImFzc2lnbiIsImNyZWF0ZSIsInByb21wdCIsInRlcm1pbmFsIiwidXNlQ29sb3JzIiwiaWdub3JlVW5kZWZpbmVkIiwiaW5wdXQiLCJ1c2VHbG9iYWwiLCJvdXRwdXQiLCJldmFsdWF0ZUFuZEV4aXQiLCJzdGFydFJFUEwiLCJfd3JhcHBlZERlZmF1bHRFdmFsIiwiY2FsbCIsImNvbW1hbmQiLCJnbG9iYWwiLCJmaWxlbmFtZSIsInJlc3VsdCIsInNlbmRSZXN1bHRUb1NvY2tldCIsIm1lc3NhZ2UiLCJjb2RlIiwiZW5hYmxlSW50ZXJhY3RpdmVNb2RlIiwicmVwbCIsImNvbnRleHQiLCJzZXRSZXF1aXJlQW5kTW9kdWxlIiwiZGVmYXVsdEV2YWwiLCJldmFsIiwid3JhcHBlZERlZmF1bHRFdmFsIiwiZmlsZSIsIlBhY2thZ2UiLCJCYWJlbCIsImNvbXBpbGVGb3JTaGVsbCIsImNhY2hlRGlyZWN0b3J5IiwiZ2V0Q2FjaGVEaXJlY3RvcnkiLCJ0aGVuIiwicmVzb2x2ZWRSZXN1bHQiLCJjYXRjaCIsInJlamVjdGVkRXJyb3IiLCJpbml0aWFsaXplSGlzdG9yeSIsImRlZmluZVByb3BlcnR5IiwiZ2V0IiwibGFzdCIsInNldCIsInZhbCIsImNvbmZpZ3VyYWJsZSIsImFkZEhlbHAiLCJjbWQiLCJoZWxwVGV4dCIsImluZm8iLCJjb21tYW5kcyIsImhlbHAiLCJ3cml0ZSIsImRlZmluZUNvbW1hbmQiLCJhY3Rpb24iLCJzZW5kTWVzc2FnZSIsImV4aXQiLCJoaXN0b3J5RmlsZSIsImdldEhpc3RvcnlGaWxlIiwiaGlzdG9yeUZkIiwiaGlzdG9yeUxpbmVzIiwic3BsaXQiLCJzZWVuTGluZXMiLCJoaXN0b3J5IiwiaGlzdG9yeUluZGV4IiwibGVuZ3RoIiwibGluZSIsInBvcCIsInRlc3QiLCJhZGRMaXN0ZW5lciIsImlucHV0U3RyZWFtIiwib3V0cHV0U3RyZWFtIiwiZGF0YVNvRmFyIiwib25EYXRhIiwiYnVmZmVyIiwibGluZXMiLCJzaGlmdCIsImpzb24iLCJwYXJzZSIsIlN5bnRheEVycm9yIiwiZmluaXNoIiwicGlwZSIsIm9uQ2xvc2UiLCJFcnJvciIsImZpbmlzaGVkIiwicmVtb3ZlTGlzdGVuZXIiLCJtb2R1bGVzIiwidG9CZUluc3RhbGxlZCIsInNoZWxsTW9kdWxlTmFtZSIsInJlcXVpcmUiLCJleHBvcnRzIiwiZXh0ZW5zaW9ucyIsIm1ldGVvckluc3RhbGwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxJQUFJLENBQUMsbUJBQW1CLEVBQUM7TUFBQyxHQUFHLEVBQUM7SUFBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsTUFBTTtJQUFDRixNQUFNLENBQUNDLElBQUksQ0FBQyxtQkFBbUIsRUFBQztNQUFDQyxNQUFNQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0QsTUFBTSxHQUFDQyxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFHN0ssTUFBTUMsUUFBUSxHQUFHQyxPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsZ0JBQWdCO0lBQzdDLElBQUlILFFBQVEsRUFBRTtNQUNaSCxNQUFNLENBQUNHLFFBQVEsQ0FBQztJQUNsQjtJQUFDSSxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHOzs7Ozs7Ozs7Ozs7OztJQ05EQyxPQUFPLENBQUNDLE1BQU0sQ0FBQztNQUFDWixNQUFNLEVBQUNBLENBQUEsS0FBSUEsTUFBTTtN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LE1BQU07VUFDdkJzRyxPQUFPLENBQUNpRSxPQUFPLEdBQUdBLE9BQU87O1VBRXpCO1VBQ0E7VUFDQUEsT0FBTyxDQUFDRSxVQUFVLEdBQUc7WUFDbkIsS0FBSyxFQUFFLElBQUk7WUFDWCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRTtVQUNYLENBQUM7UUFDSCxDQUFDOztRQUVEO1FBQ0E7UUFDQTdELE9BQU8sQ0FBQ3dELE9BQU8sQ0FBQ00sYUFBYSxDQUFDTCxhQUFhLENBQUMsQ0FBQyxJQUFJLEdBQUdDLGVBQWUsQ0FBQztNQUN0RTtJQUNGO0lBQUM3SixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9zaGVsbC1zZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgKiBmcm9tIFwiLi9zaGVsbC1zZXJ2ZXIuanNcIjtcbmltcG9ydCB7IGxpc3RlbiB9IGZyb20gXCIuL3NoZWxsLXNlcnZlci5qc1wiO1xuXG5jb25zdCBzaGVsbERpciA9IHByb2Nlc3MuZW52Lk1FVEVPUl9TSEVMTF9ESVI7XG5pZiAoc2hlbGxEaXIpIHtcbiAgbGlzdGVuKHNoZWxsRGlyKTtcbn1cbiIsImltcG9ydCBhc3NlcnQgZnJvbSBcImFzc2VydFwiO1xuaW1wb3J0IHsgam9pbiBhcyBwYXRoSm9pbiB9IGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBQYXNzVGhyb3VnaCB9IGZyb20gXCJzdHJlYW1cIjtcbmltcG9ydCB7XG4gIGNsb3NlU3luYyxcbiAgb3BlblN5bmMsXG4gIHJlYWRGaWxlU3luYyxcbiAgdW5saW5rLFxuICB3cml0ZUZpbGVTeW5jLFxuICB3cml0ZVN5bmMsXG59IGZyb20gXCJmc1wiO1xuaW1wb3J0IHsgY3JlYXRlU2VydmVyIH0gZnJvbSBcIm5ldFwiO1xuaW1wb3J0IHsgc3RhcnQgYXMgcmVwbFN0YXJ0IH0gZnJvbSBcInJlcGxcIjtcblxuLy8gRW5hYmxlIHByb2Nlc3Muc2VuZE1lc3NhZ2UgZm9yIGNvbW11bmljYXRpb24gd2l0aCBidWlsZCBwcm9jZXNzLlxuaW1wb3J0IFwibWV0ZW9yL2ludGVyLXByb2Nlc3MtbWVzc2FnaW5nXCI7XG5cbmNvbnN0IElORk9fRklMRV9NT0RFID0gcGFyc2VJbnQoXCI2MDBcIiwgOCk7IC8vIE9ubHkgdGhlIG93bmVyIGNhbiByZWFkIG9yIHdyaXRlLlxuY29uc3QgRVhJVElOR19NRVNTQUdFID0gXCJTaGVsbCBleGl0aW5nLi4uXCI7XG5cbi8vIEludm9rZWQgYnkgdGhlIHNlcnZlciBwcm9jZXNzIHRvIGxpc3RlbiBmb3IgaW5jb21pbmcgY29ubmVjdGlvbnMgZnJvbVxuLy8gc2hlbGwgY2xpZW50cy4gRWFjaCBjb25uZWN0aW9uIGdldHMgaXRzIG93biBSRVBMIGluc3RhbmNlLlxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbihzaGVsbERpcikge1xuICBmdW5jdGlvbiBjYWxsYmFjaygpIHtcbiAgICBuZXcgU2VydmVyKHNoZWxsRGlyKS5saXN0ZW4oKTtcbiAgfVxuXG4gIC8vIElmIHRoZSBzZXJ2ZXIgaXMgc3RpbGwgaW4gdGhlIHZlcnkgZWFybHkgc3RhZ2VzIG9mIHN0YXJ0aW5nIHVwLFxuICAvLyBNZXRlb3Iuc3RhcnR1cCBtYXkgbm90IGF2YWlsYWJsZSB5ZXQuXG4gIGlmICh0eXBlb2YgTWV0ZW9yID09PSBcIm9iamVjdFwiKSB7XG4gICAgTWV0ZW9yLnN0YXJ0dXAoY2FsbGJhY2spO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBfX21ldGVvcl9ib290c3RyYXBfXyA9PT0gXCJvYmplY3RcIikge1xuICAgIGNvbnN0IGhvb2tzID0gX19tZXRlb3JfYm9vdHN0cmFwX18uc3RhcnR1cEhvb2tzO1xuICAgIGlmIChob29rcykge1xuICAgICAgaG9va3MucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFzIGEgZmFsbGJhY2ssIGp1c3QgY2FsbCB0aGUgY2FsbGJhY2sgYXN5bmNocm9ub3VzbHkuXG4gICAgICBzZXRJbW1lZGlhdGUoY2FsbGJhY2spO1xuICAgIH1cbiAgfVxufVxuXG4vLyBEaXNhYmxpbmcgdGhlIHNoZWxsIGNhdXNlcyBhbGwgYXR0YWNoZWQgY2xpZW50cyB0byBkaXNjb25uZWN0IGFuZCBleGl0LlxuZXhwb3J0IGZ1bmN0aW9uIGRpc2FibGUoc2hlbGxEaXIpIHtcbiAgdHJ5IHtcbiAgICAvLyBSZXBsYWNlIGluZm8uanNvbiB3aXRoIGEgZmlsZSB0aGF0IHNheXMgdGhlIHNoZWxsIHNlcnZlciBpc1xuICAgIC8vIGRpc2FibGVkLCBzbyB0aGF0IGFueSBjb25uZWN0ZWQgc2hlbGwgY2xpZW50cyB3aWxsIGZhaWwgdG9cbiAgICAvLyByZWNvbm5lY3QgYWZ0ZXIgdGhlIHNlcnZlciBwcm9jZXNzIGNsb3NlcyB0aGVpciBzb2NrZXRzLlxuICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICBnZXRJbmZvRmlsZShzaGVsbERpciksXG4gICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN0YXR1czogXCJkaXNhYmxlZFwiLFxuICAgICAgICByZWFzb246IFwiU2hlbGwgc2VydmVyIGhhcyBzaHV0IGRvd24uXCJcbiAgICAgIH0pICsgXCJcXG5cIixcbiAgICAgIHsgbW9kZTogSU5GT19GSUxFX01PREUgfVxuICAgICk7XG4gIH0gY2F0Y2ggKGlnbm9yZWQpIHt9XG59XG5cbi8vIFNoZWxsIGNvbW1hbmRzIG5lZWQgdG8gYmUgZXhlY3V0ZWQgaW4gYSBGaWJlciBpbiBjYXNlIHRoZXkgY2FsbCBpbnRvXG4vLyBjb2RlIHRoYXQgeWllbGRzLiBVc2luZyBhIFByb21pc2UgaXMgYW4gZXZlbiBiZXR0ZXIgaWRlYSwgc2luY2UgaXQgcnVuc1xuLy8gaXRzIGNhbGxiYWNrcyBpbiBGaWJlcnMgZHJhd24gZnJvbSBhIHBvb2wsIHNvIHRoZSBGaWJlcnMgYXJlIHJlY3ljbGVkLlxuY29uc3QgZXZhbENvbW1hbmRQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cbmNsYXNzIFNlcnZlciB7XG4gIGNvbnN0cnVjdG9yKHNoZWxsRGlyKSB7XG4gICAgYXNzZXJ0Lm9rKHRoaXMgaW5zdGFuY2VvZiBTZXJ2ZXIpO1xuXG4gICAgdGhpcy5zaGVsbERpciA9IHNoZWxsRGlyO1xuICAgIHRoaXMua2V5ID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMik7XG5cbiAgICB0aGlzLnNlcnZlciA9XG4gICAgICBjcmVhdGVTZXJ2ZXIoKHNvY2tldCkgPT4ge1xuICAgICAgICB0aGlzLm9uQ29ubmVjdGlvbihzb2NrZXQpO1xuICAgICAgfSlcbiAgICAgIC5vbihcImVycm9yXCIsIChlcnIpID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIuc3RhY2spO1xuICAgICAgfSk7XG4gIH1cblxuICBsaXN0ZW4oKSB7XG4gICAgY29uc3QgaW5mb0ZpbGUgPSBnZXRJbmZvRmlsZSh0aGlzLnNoZWxsRGlyKTtcblxuICAgIHVubGluayhpbmZvRmlsZSwgKCkgPT4ge1xuICAgICAgdGhpcy5zZXJ2ZXIubGlzdGVuKDAsIFwiMTI3LjAuMC4xXCIsICgpID0+IHtcbiAgICAgICAgd3JpdGVGaWxlU3luYyhpbmZvRmlsZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHN0YXR1czogXCJlbmFibGVkXCIsXG4gICAgICAgICAgcG9ydDogdGhpcy5zZXJ2ZXIuYWRkcmVzcygpLnBvcnQsXG4gICAgICAgICAga2V5OiB0aGlzLmtleVxuICAgICAgICB9KSArIFwiXFxuXCIsIHtcbiAgICAgICAgICBtb2RlOiBJTkZPX0ZJTEVfTU9ERVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgb25Db25uZWN0aW9uKHNvY2tldCkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGlzIGZ1bmN0aW9uIGRvZXNuJ3QgdHJ5IHRvIHdyaXRlIGFueXRoaW5nIHRvIHRoZSBzb2NrZXRcbiAgICAvLyBhZnRlciBpdCBoYXMgYmVlbiBjbG9zZWQuXG4gICAgc29ja2V0Lm9uKFwiY2xvc2VcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBzb2NrZXQgPSBudWxsO1xuICAgIH0pO1xuXG4gICAgLy8gSWYgY29tbXVuaWNhdGlvbiBpcyBub3QgZXN0YWJsaXNoZWQgd2l0aGluIDEwMDBtcyBvZiB0aGUgZmlyc3RcbiAgICAvLyBjb25uZWN0aW9uLCBmb3JjaWJseSBjbG9zZSB0aGUgc29ja2V0LlxuICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHNvY2tldCkge1xuICAgICAgICBzb2NrZXQucmVtb3ZlQWxsTGlzdGVuZXJzKFwiZGF0YVwiKTtcbiAgICAgICAgc29ja2V0LmVuZChFWElUSU5HX01FU1NBR0UgKyBcIlxcblwiKTtcbiAgICAgIH1cbiAgICB9LCAxMDAwKTtcblxuICAgIC8vIExldCBjb25uZWN0aW5nIGNsaWVudHMgY29uZmlndXJlIGNlcnRhaW4gUkVQTCBvcHRpb25zIGJ5IHNlbmRpbmcgYVxuICAgIC8vIEpTT04gb2JqZWN0IG92ZXIgdGhlIHNvY2tldC4gRm9yIGV4YW1wbGUsIG9ubHkgdGhlIGNsaWVudCBrbm93c1xuICAgIC8vIHdoZXRoZXIgaXQncyBydW5uaW5nIGEgVFRZIG9yIGFuIEVtYWNzIHN1YnNoZWxsIG9yIHNvbWUgb3RoZXIga2luZCBvZlxuICAgIC8vIHRlcm1pbmFsLCBzbyB0aGUgY2xpZW50IG11c3QgZGVjaWRlIHRoZSB2YWx1ZSBvZiBvcHRpb25zLnRlcm1pbmFsLlxuICAgIHJlYWRKU09ORnJvbVN0cmVhbShzb2NrZXQsIChlcnJvciwgb3B0aW9ucywgcmVwbElucHV0U29ja2V0KSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG5cbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBzb2NrZXQgPSBudWxsO1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yLnN0YWNrKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5rZXkgIT09IHRoaXMua2V5KSB7XG4gICAgICAgIGlmIChzb2NrZXQpIHtcbiAgICAgICAgICBzb2NrZXQuZW5kKEVYSVRJTkdfTUVTU0FHRSArIFwiXFxuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBvcHRpb25zLmtleTtcblxuICAgICAgLy8gU2V0IHRoZSBjb2x1bW5zIHRvIHdoYXQgaXMgYmVpbmcgcmVxdWVzdGVkIGJ5IHRoZSBjbGllbnQuXG4gICAgICBpZiAob3B0aW9ucy5jb2x1bW5zICYmIHNvY2tldCkge1xuICAgICAgICBzb2NrZXQuY29sdW1ucyA9IG9wdGlvbnMuY29sdW1ucztcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBvcHRpb25zLmNvbHVtbnM7XG5cbiAgICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpLFxuXG4gICAgICAgIC8vIERlZmF1bHRzIGZvciBjb25maWd1cmFibGUgb3B0aW9ucy5cbiAgICAgICAge1xuICAgICAgICAgIHByb21wdDogXCI+IFwiLFxuICAgICAgICAgIHRlcm1pbmFsOiB0cnVlLFxuICAgICAgICAgIHVzZUNvbG9yczogdHJ1ZSxcbiAgICAgICAgICBpZ25vcmVVbmRlZmluZWQ6IHRydWUsXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gQ29uZmlndXJhYmxlIG9wdGlvbnNcbiAgICAgICAgb3B0aW9ucyxcblxuICAgICAgICAvLyBJbW11dGFibGUgb3B0aW9ucy5cbiAgICAgICAge1xuICAgICAgICAgIGlucHV0OiByZXBsSW5wdXRTb2NrZXQsXG4gICAgICAgICAgdXNlR2xvYmFsOiBmYWxzZSxcbiAgICAgICAgICBvdXRwdXQ6IHNvY2tldFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBUaGUgcHJvbXB0IGR1cmluZyBhbiBldmFsdWF0ZUFuZEV4aXQgbXVzdCBiZSBibGFuayB0byBlbnN1cmVcbiAgICAgIC8vIHRoYXQgdGhlIHByb21wdCBkb2Vzbid0IGluYWR2ZXJ0ZW50bHkgZ2V0IHBhcnNlZCBhcyBwYXJ0IG9mXG4gICAgICAvLyB0aGUgSlNPTiBjb21tdW5pY2F0aW9uIGNoYW5uZWwuXG4gICAgICBpZiAob3B0aW9ucy5ldmFsdWF0ZUFuZEV4aXQpIHtcbiAgICAgICAgb3B0aW9ucy5wcm9tcHQgPSBcIlwiO1xuICAgICAgfVxuXG4gICAgICAvLyBTdGFydCB0aGUgUkVQTC5cbiAgICAgIHRoaXMuc3RhcnRSRVBMKG9wdGlvbnMpO1xuXG4gICAgICBpZiAob3B0aW9ucy5ldmFsdWF0ZUFuZEV4aXQpIHtcbiAgICAgICAgdGhpcy5fd3JhcHBlZERlZmF1bHRFdmFsLmNhbGwoXG4gICAgICAgICAgT2JqZWN0LmNyZWF0ZShudWxsKSxcbiAgICAgICAgICBvcHRpb25zLmV2YWx1YXRlQW5kRXhpdC5jb21tYW5kLFxuICAgICAgICAgIGdsb2JhbCxcbiAgICAgICAgICBvcHRpb25zLmV2YWx1YXRlQW5kRXhpdC5maWxlbmFtZSB8fCBcIjxtZXRlb3Igc2hlbGw+XCIsXG4gICAgICAgICAgZnVuY3Rpb24gKGVycm9yLCByZXN1bHQpIHtcbiAgICAgICAgICAgIGlmIChzb2NrZXQpIHtcbiAgICAgICAgICAgICAgZnVuY3Rpb24gc2VuZFJlc3VsdFRvU29ja2V0KG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAvLyBTZW5kaW5nIGJhY2sgYSBKU09OIHBheWxvYWQgYWxsb3dzIHRoZSBjbGllbnQgdG9cbiAgICAgICAgICAgICAgICAvLyBkaXN0aW5ndWlzaCBiZXR3ZWVuIGVycm9ycyBhbmQgc3VjY2Vzc2Z1bCByZXN1bHRzLlxuICAgICAgICAgICAgICAgIHNvY2tldC5lbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkgKyBcIlxcblwiKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHNlbmRSZXN1bHRUb1NvY2tldCh7XG4gICAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3IudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgIGNvZGU6IDFcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzdWx0VG9Tb2NrZXQoe1xuICAgICAgICAgICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBkZWxldGUgb3B0aW9ucy5ldmFsdWF0ZUFuZEV4aXQ7XG5cbiAgICAgIHRoaXMuZW5hYmxlSW50ZXJhY3RpdmVNb2RlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG5cbiAgc3RhcnRSRVBMKG9wdGlvbnMpIHtcbiAgICAvLyBNYWtlIHN1cmUgdGhpcyBmdW5jdGlvbiBkb2Vzbid0IHRyeSB0byB3cml0ZSBhbnl0aGluZyB0byB0aGUgb3V0cHV0XG4gICAgLy8gc3RyZWFtIGFmdGVyIGl0IGhhcyBiZWVuIGNsb3NlZC5cbiAgICBvcHRpb25zLm91dHB1dC5vbihcImNsb3NlXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgb3B0aW9ucy5vdXRwdXQgPSBudWxsO1xuICAgIH0pO1xuXG4gICAgY29uc3QgcmVwbCA9IHRoaXMucmVwbCA9IHJlcGxTdGFydChvcHRpb25zKTtcbiAgICBjb25zdCB7IHNoZWxsRGlyIH0gPSB0aGlzO1xuXG4gICAgLy8gVGhpcyBpcyB0ZWNobmlxdWUgb2Ygc2V0dGluZyBgcmVwbC5jb250ZXh0YCBpcyBzaW1pbGFyIHRvIGhvdyB0aGVcbiAgICAvLyBgdXNlR2xvYmFsYCBvcHRpb24gd291bGQgd29yayBkdXJpbmcgYSBub3JtYWwgYHJlcGwuc3RhcnQoKWAgYW5kXG4gICAgLy8gYWxsb3dzIHNoZWxsIGFjY2VzcyAoYW5kIHRhYiBjb21wbGV0aW9uISkgdG8gTWV0ZW9yIGdsb2JhbHMgKGkuZS5cbiAgICAvLyBVbmRlcnNjb3JlIF8sIE1ldGVvciwgZXRjLikuIEJ5IHVzaW5nIHRoaXMgdGVjaG5pcXVlLCB3aGljaCBjaGFuZ2VzXG4gICAgLy8gdGhlIGNvbnRleHQgYWZ0ZXIgc3RhcnR1cCwgd2UgYXZvaWQgc3RvbXBpbmcgb24gdGhlIHNwZWNpYWwgYF9gXG4gICAgLy8gdmFyaWFibGUgKGluIGByZXBsYCB0aGlzIGVxdWFscyB0aGUgdmFsdWUgb2YgdGhlIGxhc3QgY29tbWFuZCkgZnJvbVxuICAgIC8vIGJlaW5nIG92ZXJyaWRkZW4gaW4gdGhlIGNsaWVudC9zZXJ2ZXIgc29ja2V0LWhhbmRzaGFraW5nLiAgRnVydGhlcm1vcmUsXG4gICAgLy8gYnkgc2V0dGluZyBgdXNlR2xvYmFsYCBiYWNrIHRvIHRydWUsIHdlIGFsbG93IHRoZSBkZWZhdWx0IGV2YWwgZnVuY3Rpb25cbiAgICAvLyB0byB1c2UgdGhlIGRlc2lyZWQgYHJ1bkluVGhpc0NvbnRleHRgIG1ldGhvZCAoaHR0cHM6Ly9naXQuaW8vdmJ2QUIpLlxuICAgIHJlcGwuY29udGV4dCA9IGdsb2JhbDtcbiAgICByZXBsLnVzZUdsb2JhbCA9IHRydWU7XG5cbiAgICBzZXRSZXF1aXJlQW5kTW9kdWxlKHJlcGwuY29udGV4dCk7XG5cbiAgICAvLyBJbiBvcmRlciB0byBhdm9pZCBkdXBsaWNhdGluZyBjb2RlIGhlcmUsIHNwZWNpZmljYWxseSB0aGUgY29tcGxleGl0aWVzXG4gICAgLy8gb2YgY2F0Y2hpbmcgc28tY2FsbGVkIFwiUmVjb3ZlcmFibGUgRXJyb3JzXCIgKGh0dHBzOi8vZ2l0LmlvL3ZidmJsKSxcbiAgICAvLyB3ZSB3aWxsIHdyYXAgdGhlIGRlZmF1bHQgZXZhbCwgcnVuIGl0IGluIGEgRmliZXIgKHZpYSBhIFByb21pc2UpLCBhbmRcbiAgICAvLyBnaXZlIGl0IHRoZSBvcHBvcnR1bml0eSB0byBkZWNpZGUgaWYgdGhlIHVzZXIgaXMgbWlkLWNvZGUtYmxvY2suXG4gICAgY29uc3QgZGVmYXVsdEV2YWwgPSByZXBsLmV2YWw7XG5cbiAgICBmdW5jdGlvbiB3cmFwcGVkRGVmYXVsdEV2YWwoY29kZSwgY29udGV4dCwgZmlsZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmIChQYWNrYWdlWydiYWJlbC1jb21waWxlciddKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29kZSA9IFBhY2thZ2VbJ2JhYmVsLWNvbXBpbGVyJ10uQmFiZWwuY29tcGlsZUZvclNoZWxsKGNvZGUsIHtcbiAgICAgICAgICAgIGNhY2hlRGlyZWN0b3J5OiBnZXRDYWNoZURpcmVjdG9yeShzaGVsbERpcilcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgLy8gQW55IEJhYmVsIGVycm9yIGhlcmUgbWlnaHQgYmUganVzdCBmaW5lIHNpbmNlIGl0J3NcbiAgICAgICAgICAvLyBwb3NzaWJsZSB0aGUgY29kZSB3YXMgaW5jb21wbGV0ZSAobXVsdGktbGluZSBjb2RlIG9uIHRoZSBSRVBMKS5cbiAgICAgICAgICAvLyBUaGUgZGVmYXVsdEV2YWwgYmVsb3cgd2lsbCB1c2UgaXRzIG93biBmdW5jdGlvbmFsaXR5IHRvIGRldGVybWluZVxuICAgICAgICAgIC8vIGlmIHRoaXMgZXJyb3IgaXMgXCJyZWNvdmVyYWJsZVwiLlxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGV2YWxDb21tYW5kUHJvbWlzZVxuICAgICAgICAudGhlbigoKSA9PiBkZWZhdWx0RXZhbChjb2RlLCBjb250ZXh0LCBmaWxlLCAoZXJyb3IsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgcmVzdWx0IGlzIGEgUHJvbWlzZVxuICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0LnRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBQcm9taXNlIHJlc29sdXRpb24gYW5kIHJlamVjdGlvblxuICAgICAgICAgICAgICByZXN1bHRcbiAgICAgICAgICAgICAgICAudGhlbihyZXNvbHZlZFJlc3VsdCA9PiB7XG4gICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXNvbHZlZFJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2gocmVqZWN0ZWRFcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICBjYWxsYmFjayhyZWplY3RlZEVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSlcbiAgICAgICAgLmNhdGNoKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvLyBIYXZlIHRoZSBSRVBMIHVzZSB0aGUgbmV3bHkgd3JhcHBlZCBmdW5jdGlvbiBpbnN0ZWFkIGFuZCBzdG9yZSB0aGVcbiAgICAvLyBfd3JhcHBlZERlZmF1bHRFdmFsIHNvIHRoYXQgZXZhbHVsYXRlQW5kRXhpdCBjYWxscyBjYW4gdXNlIGl0IGRpcmVjdGx5LlxuICAgIHJlcGwuZXZhbCA9IHRoaXMuX3dyYXBwZWREZWZhdWx0RXZhbCA9IHdyYXBwZWREZWZhdWx0RXZhbDtcbiAgfVxuXG4gIGVuYWJsZUludGVyYWN0aXZlTW9kZShvcHRpb25zKSB7XG4gICAgLy8gSGlzdG9yeSBwZXJzaXN0cyBhY3Jvc3Mgc2hlbGwgc2Vzc2lvbnMhXG4gICAgdGhpcy5pbml0aWFsaXplSGlzdG9yeSgpO1xuXG4gICAgY29uc3QgcmVwbCA9IHRoaXMucmVwbDtcblxuICAgIC8vIEltcGxlbWVudCBhbiBhbHRlcm5hdGUgbWVhbnMgb2YgZmV0Y2hpbmcgdGhlIHJldHVybiB2YWx1ZSxcbiAgICAvLyB2aWEgYF9fYCAoZG91YmxlIHVuZGVyc2NvcmUpIGFzIG9yaWdpbmFsbHkgaW1wbGVtZW50ZWQgaW46XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvY29tbWl0LzI0NDNkODMyMjY1YzdkMWNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVwbC5jb250ZXh0LCBcIl9fXCIsIHtcbiAgICAgIGdldDogKCkgPT4gcmVwbC5sYXN0LFxuICAgICAgc2V0OiAodmFsKSA9PiB7XG4gICAgICAgIHJlcGwubGFzdCA9IHZhbDtcbiAgICAgIH0sXG5cbiAgICAgIC8vIEFsbG93IHRoaXMgcHJvcGVydHkgdG8gYmUgKHJlKWRlZmluZWQgbW9yZSB0aGFuIG9uY2UgKGUuZy4gZWFjaFxuICAgICAgLy8gdGltZSB0aGUgc2VydmVyIHJlc3RhcnRzKS5cbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgLy8gU29tZSBpbXByb3ZlbWVudHMgdG8gdGhlIGV4aXN0aW5nIGhlbHAgbWVzc2FnZXMuXG4gICAgZnVuY3Rpb24gYWRkSGVscChjbWQsIGhlbHBUZXh0KSB7XG4gICAgICBjb25zdCBpbmZvID0gcmVwbC5jb21tYW5kc1tjbWRdIHx8IHJlcGwuY29tbWFuZHNbXCIuXCIgKyBjbWRdO1xuICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgaW5mby5oZWxwID0gaGVscFRleHQ7XG4gICAgICB9XG4gICAgfVxuICAgIGFkZEhlbHAoXCJicmVha1wiLCBcIlRlcm1pbmF0ZSBjdXJyZW50IGNvbW1hbmQgaW5wdXQgYW5kIGRpc3BsYXkgbmV3IHByb21wdFwiKTtcbiAgICBhZGRIZWxwKFwiZXhpdFwiLCBcIkRpc2Nvbm5lY3QgZnJvbSBzZXJ2ZXIgYW5kIGxlYXZlIHNoZWxsXCIpO1xuICAgIGFkZEhlbHAoXCJoZWxwXCIsIFwiU2hvdyB0aGlzIGhlbHAgaW5mb3JtYXRpb25cIik7XG5cbiAgICAvLyBXaGVuIHRoZSBSRVBMIGV4aXRzLCBzaWduYWwgdGhlIGF0dGFjaGVkIGNsaWVudCB0byBleGl0IGJ5IHNlbmRpbmcgaXRcbiAgICAvLyB0aGUgc3BlY2lhbCBFWElUSU5HX01FU1NBR0UuXG4gICAgcmVwbC5vbihcImV4aXRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAob3B0aW9ucy5vdXRwdXQpIHtcbiAgICAgICAgb3B0aW9ucy5vdXRwdXQud3JpdGUoRVhJVElOR19NRVNTQUdFICsgXCJcXG5cIik7XG4gICAgICAgIG9wdGlvbnMub3V0cHV0LmVuZCgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gV2hlbiB0aGUgc2VydmVyIHByb2Nlc3MgZXhpdHMsIGVuZCB0aGUgb3V0cHV0IHN0cmVhbSBidXQgZG8gbm90XG4gICAgLy8gc2lnbmFsIHRoZSBhdHRhY2hlZCBjbGllbnQgdG8gZXhpdC5cbiAgICBwcm9jZXNzLm9uKFwiZXhpdFwiLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChvcHRpb25zLm91dHB1dCkge1xuICAgICAgICBvcHRpb25zLm91dHB1dC5lbmQoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRoaXMgTWV0ZW9yLXNwZWNpZmljIHNoZWxsIGNvbW1hbmQgcmVidWlsZHMgdGhlIGFwcGxpY2F0aW9uIGFzIGlmIGFcbiAgICAvLyBjaGFuZ2Ugd2FzIG1hZGUgdG8gc2VydmVyIGNvZGUuXG4gICAgcmVwbC5kZWZpbmVDb21tYW5kKFwicmVsb2FkXCIsIHtcbiAgICAgIGhlbHA6IFwiUmVzdGFydCB0aGUgc2VydmVyIGFuZCB0aGUgc2hlbGxcIixcbiAgICAgIGFjdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChwcm9jZXNzLnNlbmRNZXNzYWdlKSB7XG4gICAgICAgICAgcHJvY2Vzcy5zZW5kTWVzc2FnZShcInNoZWxsLXNlcnZlclwiLCB7IGNvbW1hbmQ6IFwicmVsb2FkXCIgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBUaGlzIGZ1bmN0aW9uIGFsbG93cyBhIHBlcnNpc3RlbnQgaGlzdG9yeSBvZiBzaGVsbCBjb21tYW5kcyB0byBiZSBzYXZlZFxuICAvLyB0byBhbmQgbG9hZGVkIGZyb20gLm1ldGVvci9sb2NhbC9zaGVsbC9oaXN0b3J5LlxuICBpbml0aWFsaXplSGlzdG9yeSgpIHtcbiAgICBjb25zdCByZXBsID0gdGhpcy5yZXBsO1xuICAgIGNvbnN0IGhpc3RvcnlGaWxlID0gZ2V0SGlzdG9yeUZpbGUodGhpcy5zaGVsbERpcik7XG4gICAgbGV0IGhpc3RvcnlGZCA9IG9wZW5TeW5jKGhpc3RvcnlGaWxlLCBcImErXCIpO1xuICAgIGNvbnN0IGhpc3RvcnlMaW5lcyA9IHJlYWRGaWxlU3luYyhoaXN0b3J5RmlsZSwgXCJ1dGY4XCIpLnNwbGl0KFwiXFxuXCIpO1xuICAgIGNvbnN0IHNlZW5MaW5lcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoISByZXBsLmhpc3RvcnkpIHtcbiAgICAgIHJlcGwuaGlzdG9yeSA9IFtdO1xuICAgICAgcmVwbC5oaXN0b3J5SW5kZXggPSAtMTtcbiAgICB9XG5cbiAgICB3aGlsZSAocmVwbC5oaXN0b3J5ICYmIGhpc3RvcnlMaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBsaW5lID0gaGlzdG9yeUxpbmVzLnBvcCgpO1xuICAgICAgaWYgKGxpbmUgJiYgL1xcUy8udGVzdChsaW5lKSAmJiAhIHNlZW5MaW5lc1tsaW5lXSkge1xuICAgICAgICByZXBsLmhpc3RvcnkucHVzaChsaW5lKTtcbiAgICAgICAgc2VlbkxpbmVzW2xpbmVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXBsLmFkZExpc3RlbmVyKFwibGluZVwiLCBmdW5jdGlvbihsaW5lKSB7XG4gICAgICBpZiAoaGlzdG9yeUZkID49IDAgJiYgL1xcUy8udGVzdChsaW5lKSkge1xuICAgICAgICB3cml0ZVN5bmMoaGlzdG9yeUZkLCBsaW5lICsgXCJcXG5cIik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlcGwub24oXCJleGl0XCIsIGZ1bmN0aW9uKCkge1xuICAgICAgY2xvc2VTeW5jKGhpc3RvcnlGZCk7XG4gICAgICBoaXN0b3J5RmQgPSAtMTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkSlNPTkZyb21TdHJlYW0oaW5wdXRTdHJlYW0sIGNhbGxiYWNrKSB7XG4gIGNvbnN0IG91dHB1dFN0cmVhbSA9IG5ldyBQYXNzVGhyb3VnaCgpO1xuICBsZXQgZGF0YVNvRmFyID0gXCJcIjtcblxuICBmdW5jdGlvbiBvbkRhdGEoYnVmZmVyKSB7XG4gICAgY29uc3QgbGluZXMgPSBidWZmZXIudG9TdHJpbmcoXCJ1dGY4XCIpLnNwbGl0KFwiXFxuXCIpO1xuXG4gICAgd2hpbGUgKGxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGRhdGFTb0ZhciArPSBsaW5lcy5zaGlmdCgpO1xuXG4gICAgICBsZXQganNvbjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGpzb24gPSBKU09OLnBhcnNlKGRhdGFTb0Zhcik7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbmlzaChlcnJvcik7XG4gICAgICB9XG5cbiAgICAgIGlmIChsaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIG91dHB1dFN0cmVhbS53cml0ZShsaW5lcy5qb2luKFwiXFxuXCIpKTtcbiAgICAgIH1cblxuICAgICAgaW5wdXRTdHJlYW0ucGlwZShvdXRwdXRTdHJlYW0pO1xuXG4gICAgICByZXR1cm4gZmluaXNoKG51bGwsIGpzb24pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uQ2xvc2UoKSB7XG4gICAgZmluaXNoKG5ldyBFcnJvcihcInN0cmVhbSB1bmV4cGVjdGVkbHkgY2xvc2VkXCIpKTtcbiAgfVxuXG4gIGxldCBmaW5pc2hlZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBmaW5pc2goZXJyb3IsIGpzb24pIHtcbiAgICBpZiAoISBmaW5pc2hlZCkge1xuICAgICAgZmluaXNoZWQgPSB0cnVlO1xuICAgICAgaW5wdXRTdHJlYW0ucmVtb3ZlTGlzdGVuZXIoXCJkYXRhXCIsIG9uRGF0YSk7XG4gICAgICBpbnB1dFN0cmVhbS5yZW1vdmVMaXN0ZW5lcihcImVycm9yXCIsIGZpbmlzaCk7XG4gICAgICBpbnB1dFN0cmVhbS5yZW1vdmVMaXN0ZW5lcihcImNsb3NlXCIsIG9uQ2xvc2UpO1xuICAgICAgY2FsbGJhY2soZXJyb3IsIGpzb24sIG91dHB1dFN0cmVhbSk7XG4gICAgfVxuICB9XG5cbiAgaW5wdXRTdHJlYW0ub24oXCJkYXRhXCIsIG9uRGF0YSk7XG4gIGlucHV0U3RyZWFtLm9uKFwiZXJyb3JcIiwgZmluaXNoKTtcbiAgaW5wdXRTdHJlYW0ub24oXCJjbG9zZVwiLCBvbkNsb3NlKTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5mb0ZpbGUoc2hlbGxEaXIpIHtcbiAgcmV0dXJuIHBhdGhKb2luKHNoZWxsRGlyLCBcImluZm8uanNvblwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0SGlzdG9yeUZpbGUoc2hlbGxEaXIpIHtcbiAgcmV0dXJuIHBhdGhKb2luKHNoZWxsRGlyLCBcImhpc3RvcnlcIik7XG59XG5cbmZ1bmN0aW9uIGdldENhY2hlRGlyZWN0b3J5KHNoZWxsRGlyKSB7XG4gIHJldHVybiBwYXRoSm9pbihzaGVsbERpciwgXCJjYWNoZVwiKTtcbn1cblxuZnVuY3Rpb24gc2V0UmVxdWlyZUFuZE1vZHVsZShjb250ZXh0KSB7XG4gIGlmIChQYWNrYWdlLm1vZHVsZXMpIHtcbiAgICAvLyBVc2UgdGhlIHNhbWUgYHJlcXVpcmVgIGZ1bmN0aW9uIGFuZCBgbW9kdWxlYCBvYmplY3QgdmlzaWJsZSB0byB0aGVcbiAgICAvLyBhcHBsaWNhdGlvbi5cbiAgICBjb25zdCB0b0JlSW5zdGFsbGVkID0ge307XG4gICAgY29uc3Qgc2hlbGxNb2R1bGVOYW1lID0gXCJtZXRlb3Itc2hlbGwtXCIgK1xuICAgICAgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMikgKyBcIi5qc1wiO1xuXG4gICAgdG9CZUluc3RhbGxlZFtzaGVsbE1vZHVsZU5hbWVdID0gZnVuY3Rpb24gKHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSkge1xuICAgICAgY29udGV4dC5tb2R1bGUgPSBtb2R1bGU7XG4gICAgICBjb250ZXh0LnJlcXVpcmUgPSByZXF1aXJlO1xuXG4gICAgICAvLyBUYWIgY29tcGxldGlvbiBzb21ldGltZXMgdXNlcyByZXF1aXJlLmV4dGVuc2lvbnMsIGJ1dCBvbmx5IGZvclxuICAgICAgLy8gdGhlIGtleXMuXG4gICAgICByZXF1aXJlLmV4dGVuc2lvbnMgPSB7XG4gICAgICAgIFwiLmpzXCI6IHRydWUsXG4gICAgICAgIFwiLmpzb25cIjogdHJ1ZSxcbiAgICAgICAgXCIubm9kZVwiOiB0cnVlLFxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gVGhpcyBwb3B1bGF0ZXMgcmVwbC5jb250ZXh0Lnttb2R1bGUscmVxdWlyZX0gYnkgZXZhbHVhdGluZyB0aGVcbiAgICAvLyBtb2R1bGUgZGVmaW5lZCBhYm92ZS5cbiAgICBQYWNrYWdlLm1vZHVsZXMubWV0ZW9ySW5zdGFsbCh0b0JlSW5zdGFsbGVkKShcIi4vXCIgKyBzaGVsbE1vZHVsZU5hbWUpO1xuICB9XG59XG4iXX0=
