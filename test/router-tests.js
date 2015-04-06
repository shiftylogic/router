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

describe('API Routing tests', function () {
    'use strict';

    var request = require('request'),
        util = require('util'),
        expect = require('chai').expect,
        routerLib = require('../lib/router.js'),

        someData = { astring: 'dude', anumber: 42, aboolean: true },
        successObj = { success: true };

    function getHandler(endpoint, data, req, res) {
        var ep = req.url + '!!' + req.method;
        expect(ep).to.be.equal(endpoint);

        res.send(data);
        res.end();
    }

    function postHandler(endpoint, data, req, res) {
        var ep = req.url + '!!' + req.method;
        expect(ep).to.be.equal(endpoint);

        expect(req.body).to.deep.equal(data);

        res.send(successObj);
        res.end();
    }

    describe('> basic routing', function () {
        var router = routerLib(),
            server,
            routes = {
                get: getHandler.bind(null, '/foo!!GET', someData),
                post: postHandler.bind(null, '/foo!!POST', someData),
                '/nested': {
                    get: getHandler.bind(null, '/foo/nested!!GET', someData),
                    put: postHandler.bind(null, '/foo/nested!!PUT', someData)
                }
            },
            reqs = [
                { method: 'GET',  ep: '/foo',           result: someData },
                { method: 'POST', ep: '/foo',           result: successObj, data: someData },
                { method: 'GET',  ep: '/foo/nested',    result: someData },
                { method: 'PUT',  ep: '/foo/nested',    result: successObj, data: someData },
            ];

        before(function (done) {
            router.add('/foo', routes);
            server = router.start({ port: 7777, noLogging: true }, done);
        });

        after(function () {
            server.close();
        });

        reqs.forEach(function (rt) {
            it('[ ' + rt.method + ' -- ' + rt.ep + ' ]', function (done) {
                var req = request({
                    baseUrl: 'http://127.0.0.1:7777/',
                    uri: rt.ep,
                    method: rt.method,
                    body: rt.data,
                    json: true
                }, function (error, response, body) {
                    if (error) {
                        throw new Error(error);
                    }

                    expect(body).to.deep.equal(rt.result);
                    done();
                });
            });
        });
    });

});
