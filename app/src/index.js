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
const rammerhead = require("../rammerhead/src/index.js");
const setupRoutes = require("../rammerhead/src/server/setupRoutes");
const setupPipeline = require("../rammerhead/src/server/setupPipeline");
const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
        allow_udp_streams: false,
        hostname_blacklist: [/example\.com/],
        dns_servers: ["1.1.1.3", "1.0.0.3"],
});

// Rammerhead proxy — dontListen so we handle requests manually
const rhLogger = new rammerhead.RammerheadLogging({ logLevel: "disabled" });
const rhSessionStore = new rammerhead.RammerheadSessionMemoryStore();
const rhProxy = new rammerhead.RammerheadProxy({
    logger: rhLogger,
    loggerGetIP: (req) => req.socket?.remoteAddress || "unknown",
    dontListen: true,
    jsCache: new rammerhead.RammerheadJSMemCache(500),
});
rhSessionStore.attachToProxy(rhProxy);
setupPipeline(rhProxy, rhSessionStore);
setupRoutes(rhProxy, rhSessionStore, rhLogger);

// Regex to detect proxied session URLs (UUID path prefix)
const rhSessionRegex = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/;

const fastify = Fastify({
        serverFactory: (handler) => {
                return createServer()
                        .on("request", (req, res) => {
                                res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
                                res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
                                res.setHeader("Content-Security-Policy", "frame-ancestors *");
                                res.setHeader("X-Frame-Options", "ALLOWALL");
                                handler(req, res);
                        })
                        .on("upgrade", (req, socket, head) => {
                                if (req.url.endsWith("/wisp/")) {
                                        wisp.routeRequest(req, socket, head);
                                } else if (rhSessionRegex.test(req.url)) {
                                        rhProxy._onUpgradeRequest(req, socket, head);
                                } else {
                                        socket.end();
                                }
                        });
        },
});

// Intercept Rammerhead routes before Fastify handles them
fastify.addHook("onRequest", (req, reply, done) => {
    const raw = req.raw;
    if (rhProxy.checkIsRoute(raw) || rhSessionRegex.test(raw.url)) {
        rhProxy._onRequest(raw, reply.raw);
        return; // response handled by Rammerhead, don't call done()
    }
    done();
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

// Dynamic routing for Scramjet embedding
fastify.get("/scramjet/:url", (req, reply) => {
    return reply.type("text/html").sendFile("index.html");
});

fastify.setNotFoundHandler((req, reply) => {
        return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
        const address = fastify.server.address();
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
