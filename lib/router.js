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

var path = require('path'),
    guard = require('sl-guard'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cors = require('express-cors'),
    jwt = require('express-jwt'),
    morgan = require('morgan');

module.exports = function () {
    var routeMap = {};

    return Object.freeze({
        add: add.bind(null, '/'),
        create: createRooted.bind(null, '/'),
        start: start
    });

    function add(root, segment, routes, opts) {
        guard(root).isString().isNotEmpty().check();
        guard(segment).isString().isNotEmpty().check();
        guard(routes).check();
        guard(opts).isOptional().check();

        opts = opts || {};

        var routePath = path.join(root, segment);

        if (routeMap[routePath]) {
            throw new Error('A route already exists at the specified path -- ' + routePath);
        }

        routeMap[routePath] = { routes: routes };

        if (opts.security && opts.security.mode === 'jwt') {
            routeMap[routePath].secured = true;

            if (typeof opts.security.authorize === 'function') {
                routeMap[routePath].authorize = opts.security.authorize;
            }
        }
    }

    function createRooted(root, segment) {
        var newRoot = path.join(root, segment);

        return {
            add: add.bind(null, newRoot),
            create: createRooted.bind(null, newRoot)
        };
    }

    function mapRoutes(app, routes, basePath, authorize) {
        basePath = basePath || '';

        Object.keys(routes).forEach(function (key) {
            switch (typeof routes[key]) {
                // { '/path': { ... }}
                case 'object':
                    if (typeof key !== 'string') {
                        throw new Error(key + ' -- Nested route objects cannot contain regular expression paths');
                    }
                    mapRoutes(app, routes[key], basePath + key, authorize);
                    break;

                // get: function(){ ... }
                case 'function':
                    if (authorize) {
                        app[key](basePath, authorize, routes[key]);
                    } else {
                        app[key](basePath, routes[key]);
                    }
                    break;
            }
        });
    }

    function errorHandler(err, req, res, next) {
        if (err.name === 'UnauthorizedError') {
            res.send(401, 'Invalid token');
        } else {
            console.log('Unexpected error -- ', err);
            res.send(500);
        }
    }

    function saveRawBody(req, res, body, encoding) {
        req.rawBody = body.toString(encoding);
    }

    function start(config, callback) {
        config = config || {};
        callback = typeof callback === 'function' ? callback : function () {};

        var port = config.port || process.env.PORT || 8080,
            nodeEnv = config.env || process.env.NODE_ENV || 'development',
            corsConfig = config.cors,
            jwtConfig = config.jwt,
            app = express();

        // Install express middleware
        if (corsConfig) {
            app.use(cors(corsConfig));
        }
        app.use(bodyParser.json({verify: saveRawBody}));

        if (nodeEnv === 'production') {
            app.use(require('compression'));

            if (!config.noLogging) {
                app.use(morgan('common'));
            }
        } else {
            if (!config.noLogging) {
                app.use(morgan('dev'));
            }
        }

        // Install security hooks
        if (jwtConfig) {
            var jwtHandler = jwt(jwtConfig);

            Object.keys(routeMap).forEach(function (root) {
                if (routeMap[root].secured) {
                    app.use(root, jwtHandler);
                }
            });
        }

        // Install routes
        Object.keys(routeMap).forEach(function (root) {
            var entry = routeMap[root];
            mapRoutes(app, entry.routes, root, entry.authorize);
        });

        // Install error handler
        if (nodeEnv === 'production') {
            app.use(errorHandler);
        } else {
            app.use(require('errorhandler'));
        }

        return app.listen(port, callback);
    }
};
