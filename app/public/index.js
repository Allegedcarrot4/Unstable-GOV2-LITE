"use strict";
const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const proxyType = document.getElementById("sj-proxy-type");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");
const nav = document.getElementById("sj-nav");
const btnHome = document.getElementById("sj-home");
const btnBack = document.getElementById("sj-back");
const btnReload = document.getElementById("sj-reload");
const btnForward = document.getElementById("sj-forward");
const btnFullscreen = document.getElementById("sj-fullscreen");
const tabsBar = document.getElementById("sj-tabs-bar");
const tabsContainer = document.getElementById("sj-tabs-container");
const tabsContent = document.getElementById("sj-tabs-content");
const newTabBtn = document.getElementById("sj-new-tab");
const homeView = document.getElementById("sj-home-view");

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

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

function createTab() {
    const tabId = tabCounter++;
    const tab = { id: tabId, title: "New Tab", frame: null };
    tabs.push(tab);
    activeTabId = tabId;

    const tabDiv = document.createElement("div");
    tabDiv.className = "sj-frame active";
    tabDiv.id = `tab-${tabId}`;
    tabsContent.appendChild(tabDiv);
    tab.frame = tabDiv;

    renderTabs();
    homeView.style.display = "none";
    tabsBar.style.display = "flex";
    return tab;
}

function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx !== -1) {
        if (tabs[idx].frame) tabs[idx].frame.remove();
        tabs.splice(idx, 1);

        if (tabs.length === 0) {
            homeView.style.display = "flex";
            tabsBar.style.display = "none";
            activeTabId = null;
            nav.style.display = "none";
        } else {
            activeTabId = tabs[0].id;
            switchTab(activeTabId);
        }
        renderTabs();
    }
}

function switchTab(tabId) {
    activeTabId = tabId;
    document.querySelectorAll(".sj-frame").forEach(f => f.classList.remove("active"));
    const frame = document.getElementById(`tab-${tabId}`);
    if (frame) frame.classList.add("active");
    renderTabs();
}

function renderTabs() {
    tabsContainer.innerHTML = "";
    tabs.forEach(tab => {
        const el = document.createElement("div");
        el.className = `sj-tab ${tab.id === activeTabId ? "active" : ""}`;
        el.innerHTML = `<span class="sj-tab-title">${tab.title}</span><button class="sj-tab-close" data-tab-id="${tab.id}">×</button>`;
        el.addEventListener("click", () => switchTab(tab.id));
        el.querySelector(".sj-tab-close").addEventListener("click", (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        tabsContainer.appendChild(el);
    });
}

newTabBtn.addEventListener("click", createTab);

async function startProxy(url, tabFrame) {
    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        throw err;
    }

    let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
    if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
        await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }

    const frame = scramjet.createFrame();
    frame.frame.style.cssText = "position:relative;width:100%;height:100%;";
    tabFrame.innerHTML = "";
    tabFrame.appendChild(frame.frame);
    frame.go(url);

    nav.style.display = "flex";
    btnHome.onclick = () => closeTab(activeTabId);
    btnBack.onclick = () => frame.frame.contentWindow.history.back();
    btnReload.onclick = () => frame.frame.contentWindow.location.reload();
    btnForward.onclick = () => frame.frame.contentWindow.history.forward();
    btnFullscreen.onclick = () => {
        if (!document.fullscreenElement) {
            tabFrame.requestFullscreen().catch(() => {});
            nav.classList.add("hidden");
        } else {
            document.exitFullscreen();
            nav.classList.remove("hidden");
        }
    };
}

window.addEventListener("load", async () => {
    const path = window.location.pathname;
    if (path.startsWith("/scramjet/")) {
        const url = decodeURIComponent(path.substring("/scramjet/".length));
        if (url) {
            setTimeout(async () => {
                const tab = createTab();
                tab.title = url.substring(0, 30);
                renderTabs();
                await startProxy(url, tab.frame);
            }, 500);
        }
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = search(address.value, searchEngine.value);
    const tab = tabs.length === 0 ? createTab() : tabs.find(t => t.id === activeTabId);

    tab.title = address.value.substring(0, 30);
    renderTabs();

    if (proxyType.value === "rammerhead") {
        const iframe = document.createElement("iframe");
        iframe.src = "/rammerhead/session/new?url=" + encodeURIComponent(url);
        iframe.style.cssText = "width:100%;height:100%;border:none;";
        tab.frame.innerHTML = "";
        tab.frame.appendChild(iframe);
        nav.style.display = "flex";
        btnHome.onclick = () => closeTab(activeTabId);
        return;
    }

    await startProxy(url, tab.frame);
});
