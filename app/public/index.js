"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────
const form           = document.getElementById("sj-form");
const address        = document.getElementById("sj-address");
const searchEngine   = document.getElementById("sj-search-engine");
const proxyType      = document.getElementById("sj-proxy-type");
const errorEl        = document.getElementById("sj-error");
const errorCodeEl    = document.getElementById("sj-error-code");
const tabsBar        = document.getElementById("sj-tabs-bar");
const tabsContainer  = document.getElementById("sj-tabs-container");
const tabsContent    = document.getElementById("sj-tabs-content");
const homeView       = document.getElementById("sj-home-view");
const newTabBtn      = document.getElementById("sj-new-tab");
const btnBack        = document.getElementById("sj-back");
const btnForward     = document.getElementById("sj-forward");
const btnReload      = document.getElementById("sj-reload");
const btnNewBlank    = document.getElementById("sj-new-blank");
const btnFullscreen  = document.getElementById("sj-fullscreen");

// ── Scramjet / BareMux init ────────────────────────────────────────────────
const { ScramjetController } = $scramjetLoadController();
const scramjet = new ScramjetController({
    files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all:  "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
    },
});
scramjet.init();
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// ── Tab state ─────────────────────────────────────────────────────────────
let tabs       = [];
let activeTabId = null;
let tabCounter = 0;

// Returns the live iframe / scramjet frame element inside the active tab div
function getActiveFrameEl() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return null;
    return tab.frame.querySelector("iframe") || tab.frame.querySelector(".sj-proxy-frame");
}

// ── Nav buttons ───────────────────────────────────────────────────────────
btnBack.addEventListener("click", () => {
    const f = getActiveFrameEl();
    if (f) {
        try { f.contentWindow.history.back(); } catch {}
    }
});
btnForward.addEventListener("click", () => {
    const f = getActiveFrameEl();
    if (f) {
        try { f.contentWindow.history.forward(); } catch {}
    }
});
btnReload.addEventListener("click", () => {
    const f = getActiveFrameEl();
    if (f) {
        try { f.contentWindow.location.reload(); } catch {}
    }
});
btnNewBlank.addEventListener("click", () => openBlankTab());
btnFullscreen.addEventListener("click", () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    if (!document.fullscreenElement) {
        tab.frame.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
});

// ── Tab management ─────────────────────────────────────────────────────────
function openBlankTab() {
    const tab = allocateTab("New Tab");
    showTabHome(tab);
    return tab;
}

function allocateTab(title) {
    const tabId = tabCounter++;
    const frameDiv = document.createElement("div");
    frameDiv.className = "sj-frame";
    frameDiv.id = `tab-frame-${tabId}`;
    tabsContent.appendChild(frameDiv);

    const tab = { id: tabId, title, frame: frameDiv };
    tabs.push(tab);
    activeTabId = tabId;

    homeView.style.display = "none";
    tabsBar.style.display  = "flex";
    renderTabs();
    return tab;
}

function showTabHome(tab) {
    tab.frame.innerHTML = `
        <div class="sj-tab-home">
            <h2>New Tab</h2>
            <form class="sj-tab-home-form">
                <input type="text" placeholder="Search or enter URL…" autocomplete="off" />
                <button type="submit">Go</button>
            </form>
        </div>`;

    tab.frame.querySelector(".sj-tab-home-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const val = tab.frame.querySelector("input[type=text]").value.trim();
        if (!val) return;
        const url = search(val, searchEngine.value);
        tab.title = val.substring(0, 30);
        renderTabs();
        if (proxyType.value === "rammerhead") {
            await loadRammerhead(url, tab);
        } else {
            await loadScramjet(url, tab);
        }
    });
}

function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    tabs[idx].frame.remove();
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
        activeTabId = null;
        tabsBar.style.display  = "none";
        homeView.style.display = "flex";
    } else {
        const next = tabs[Math.min(idx, tabs.length - 1)];
        switchTab(next.id);
    }
    renderTabs();
}

function switchTab(tabId) {
    activeTabId = tabId;
    document.querySelectorAll(".sj-frame").forEach(f => f.classList.remove("active"));
    const frame = document.getElementById(`tab-frame-${tabId}`);
    if (frame) frame.classList.add("active");
    renderTabs();
}

function renderTabs() {
    tabsContainer.innerHTML = "";
    tabs.forEach(tab => {
        const el = document.createElement("div");
        el.className = `sj-tab${tab.id === activeTabId ? " active" : ""}`;
        el.innerHTML = `
            <span class="sj-tab-title">${escHtml(tab.title)}</span>
            <button class="sj-tab-close" title="Close tab">×</button>`;
        el.addEventListener("click", () => switchTab(tab.id));
        el.querySelector(".sj-tab-close").addEventListener("click", e => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        tabsContainer.appendChild(el);
    });
}

function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

newTabBtn.addEventListener("click", openBlankTab);

// ── Scramjet proxy ─────────────────────────────────────────────────────────
async function loadScramjet(url, tab) {
    try { await registerSW(); }
    catch (err) {
        errorEl.textContent     = "Failed to register service worker.";
        errorCodeEl.textContent = err.toString();
        return;
    }

    const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
    if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
        await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }

    const sjFrame = scramjet.createFrame();
    sjFrame.frame.className = "sj-proxy-frame";
    sjFrame.frame.style.cssText = "width:100%;height:100%;border:none;position:absolute;top:0;left:0;";
    tab.frame.innerHTML = "";
    tab.frame.appendChild(sjFrame.frame);
    sjFrame.go(url);
}

// ── Rammerhead proxy ───────────────────────────────────────────────────────
async function loadRammerhead(url, tab) {
    try {
        const res  = await fetch("/newsession");
        const data = await res.text();
        const sessionId = data.trim();

        const iframe = document.createElement("iframe");
        iframe.style.cssText = "width:100%;height:100%;border:none;position:absolute;top:0;left:0;";

        // Rammerhead session URL format: /{sessionId}/{encodedTargetUrl}
        // The client JS on the session page handles the actual redirect
        iframe.src = `/${sessionId}/${encodeURIComponent(url)}`;

        tab.frame.innerHTML = "";
        tab.frame.appendChild(iframe);
    } catch (err) {
        tab.frame.innerHTML = `<div class="sj-tab-home"><h2 style="color:#ff4444">Rammerhead Error</h2><p style="color:#888">${err.message}</p></div>`;
    }
}

// ── Main form submit (home page) ───────────────────────────────────────────
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = search(address.value, searchEngine.value);

    let tab;
    if (tabs.length === 0 || activeTabId === null) {
        tab = allocateTab(address.value.substring(0, 30));
    } else {
        tab = tabs.find(t => t.id === activeTabId);
        tab.title = address.value.substring(0, 30);
        renderTabs();
    }

    if (proxyType.value === "rammerhead") {
        await loadRammerhead(url, tab);
    } else {
        await loadScramjet(url, tab);
    }
});

// ── URL embed handler (/scramjet/:url) ─────────────────────────────────────
window.addEventListener("load", async () => {
    const path = window.location.pathname;
    if (path.startsWith("/scramjet/")) {
        const url = decodeURIComponent(path.substring("/scramjet/".length));
        if (url) {
            setTimeout(async () => {
                const tab = allocateTab(url.substring(0, 30));
                await loadScramjet(url, tab);
            }, 500);
        }
    }
});
