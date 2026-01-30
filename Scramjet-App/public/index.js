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
                nav.classList.toggle("hidden");
                if (nav.classList.contains("hidden")) {
                        // Show a small indicator or hint to come back?
                        // For now, let's just make it toggle. 
                        // To allow the user to exit fullscreen, we could add a listener for a key or just a hover area.
                        // But let's keep it simple: clicking fullscreen hides it, and we might need a way to show it again.
                        // Actually, let's make it so moving mouse to top shows it again if hidden.
                }
        };

        window.addEventListener("mousemove", (e) => {
                if (nav.classList.contains("hidden") && e.clientY < 50) {
                        nav.classList.remove("hidden");
                }
        });
});
