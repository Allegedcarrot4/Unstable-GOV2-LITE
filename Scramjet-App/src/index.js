import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const rammerhead = require("../../rammerhead/src/index.js");
const require = createRequire(import.meta.url);
const rammerhead = require("../../rammerhead/src/index.js");
const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
        allow_udp_streams: false,
        hostname_blacklist: [/example\.com/],
        dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
        serverFactory: (handler) => {
                return createServer()
                        .on("request", (req, res) => {
                                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                                handler(req, res);
                        })
                        .on("upgrade", (req, socket, head) => {
                                if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
                                else socket.end();
                        });
        },
});

fastify.register(fastifyStatic, {
        root: publicPath,
        decorateReply: true,
});

fastify.register(fastifyStatic, {
        root: scramjetPath,
        prefix: "/scram/",
        decorateReply: false,
});

fastify.register(fastifyStatic, {
        root: libcurlPath,
        prefix: "/libcurl/",
        decorateReply: false,
});

fastify.register(fastifyStatic, {
        root: baremuxPath,
        prefix: "/baremux/",
        decorateReply: false,
});

// Rammerhead Integration
const rhProxy = new rammerhead.RammerheadProxy({
    logger: new rammerhead.RammerheadLogging(rammerhead.RammerheadLogging.NONE),
    sessionStore: new rammerhead.RammerheadSessionMemoryStore(),
    jsCache: new rammerhead.RammerheadJSMemCache(500) // Pass a default size to fix LRUCache error
});

fastify.addHook('onRequest', (req, reply, done) => {
    if (req.url.startsWith('/rammerhead/')) {
        // Handle Rammerhead requests
        // Note: This is a complex manual integration because Rammerhead is built for express/http
        // For a quick fix, we'll let it handle the underlying raw request if possible
        const rawReq = req.raw;
        const rawRes = reply.raw;
        rhProxy.handleRequest(rawReq, rawRes);
        return; // Fastify will wait for the rawRes to be finished
    }
    done();
});

fastify.setNotFoundHandler((res, reply) => {
        return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
        const address = fastify.server.address();

        // by default we are listening on 0.0.0.0 (every interface)
        // we just need to list a few
        console.log("Listening on:");
        console.log(`\thttp://localhost:${address.port}`);
        console.log(`\thttp://${hostname()}:${address.port}`);
        console.log(
                `\thttp://${
                        address.family === "IPv6" ? `[${address.address}]` : address.address
                }:${address.port}`
        );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
        console.log("SIGTERM signal received: closing HTTP server");
        fastify.close();
        process.exit(0);
}

let port = parseInt(process.env.PORT || "5000");

fastify.listen({
        port: port,
        host: "0.0.0.0",
});
