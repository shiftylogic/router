/*

The MIT License (MIT)

Copyright (c) 2015 Robert Anderson.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

'use strict';

var guard = require('sl-guard'),
    http = require('http'),
    https = require('https'),
    express = require('express'),
    bodyParser = require('body-parser');

var compressionEnabled = false,
    corsConfig,
    jwtConfig,
    loggingMode,
    errorHandler,
    routers = [],
    secured = [];


module.exports = Object.freeze({
    setCompression: setCompression,
    setCors: setCors,
    setJwt: setJwt,
    setLogging: setLogging,
    setErrorHandler: setErrorHandler,

    create: createRouter,
    secure: secureMountPoint,
    start: start
});


function setCompression(enabled) {
    guard(enabled).isBoolean().check();

    compressionEnabled = enabled;
}

function setCors(config) {
    corsConfig = config;
}

function setJwt(config) {
    jwtConfig = config;
}

function setLogging(mode) {
    loggingMode = mode;
}

function setErrorHandler(handler) {
    guard(handler).isFunction().check();

    errorHandler = handler;
}

function createRouter() {
    var router = express.Router(); // eslint-disable-line new-cap

    routers.push(router);

    return router;
}

function secureMountPoint(mountRoot, authorize) {
    guard(mountRoot).isString().isNotEmpty().check();
    guard(authorize).isFunction().check();

    secured.push({ path: mountRoot, authorize: authorize });
}

function start(options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    var app = express(),
        port = options.port,
        ssl = options.ssl,
        server;

    if (loggingMode) {
        app.use(require('morgan')(loggingMode));
    }

    if (compressionEnabled) {
        app.use(require('compression'));
    }

    if (corsConfig) {
        app.use(require('express-cors')(corsConfig));
    }

    // Initialize body parsers
    app.use(function (req, res, next) {
        req.rawBody = req.body;
        next();
    });
    app.use(bodyParser.json());

    // Initialize JWT handlers for secured mount points.
    if (jwtConfig) {
        var jwtHandler = require('express-jwt')(jwtConfig);
        secured.forEach(function (ep) {
            app.all(ep.path, jwtHandler, ep.authorize);
        });
    }

    // Install mount point routers
    routers.forEach(function (handler) {
        app.use(handler);
    });

    // Install the error handler
    if (errorHandler) {
        app.use(errorHandler);
    } else if (process.env.NODE_ENV === 'production') {
        app.use(defaultError);
    } else {
        app.use(require('errorhandler')());
    }

    if (ssl) {
        server = https.createServer(ssl, app);
        port = port || 443;
    } else {
        server = http.createServer(app);
        port = port || 80;
    }

    server.listen(port, callback);
    return server;
}

function defaultError(err, req, res) {
    console.error(err.stack);
    res.status(500);
    res.send({ error: 'Server error' });
}
