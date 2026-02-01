"use strict";
/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");

const nav = document.getElementById("sj-nav");
const btnHome = document.getElementById("sj-home");
const btnBack = document.getElementById("sj-back");
const btnReload = document.getElementById("sj-reload");
const btnForward = document.getElementById("sj-forward");
const btnFullscreen = document.getElementById("sj-fullscreen");

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
        files: {
                wasm: "/scram/scramjet.wasm.wasm",
                all: "/scram/scramjet.all.js",
                sync: "/scram/scramjet.sync.js",
        },
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
                await registerSW();
        } catch (err) {
                error.textContent = "Failed to register service worker.";
                errorCode.textContent = err.toString();
                throw err;
        }

        const url = search(address.value, searchEngine.value);

        let wispUrl =
                (location.protocol === "https:" ? "wss" : "ws") +
                "://" +
                location.host +
                "/wisp/";
        if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
                await connection.setTransport("/libcurl/index.mjs", [
                        { websocket: wispUrl },
                ]);
        }
        const frame = scramjet.createFrame();
        frame.frame.id = "sj-frame";
        document.body.appendChild(frame.frame);
        frame.go(url);

        nav.style.display = "flex";

        btnHome.onclick = () => {
                frame.frame.remove();
                nav.style.display = "none";
        };
        btnBack.onclick = () => {
                frame.frame.contentWindow.history.back();
        };
        btnReload.onclick = () => {
                frame.frame.contentWindow.location.reload();
        };
        btnForward.onclick = () => {
                frame.frame.contentWindow.history.forward();
        };
        btnFullscreen.onclick = () => {
                if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch((err) => {
                                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                        });
                        nav.classList.add("hidden");
                } else {
                        document.exitFullscreen();
                        nav.classList.remove("hidden");
                }
        };

        document.addEventListener("fullscreenchange", () => {
                if (!document.fullscreenElement) {
                        nav.classList.remove("hidden");
                } else {
                        nav.classList.add("hidden");
                }
        });

        window.addEventListener("mousemove", (e) => {
                if (document.fullscreenElement && e.clientY < 50) {
                        nav.classList.remove("hidden");
                } else if (document.fullscreenElement && e.clientY > 60) {
                        nav.classList.add("hidden");
                }
        });
});
