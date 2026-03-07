"use strict";

const tabsBar = document.getElementById("sj-tabs-bar");
const tabsContainer = document.getElementById("sj-tabs-container");
const tabsContent = document.getElementById("sj-tabs-content");
const newTabBtn = document.getElementById("sj-new-tab");
const homeView = document.getElementById("sj-home-view");
const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const proxyType = document.getElementById("sj-proxy-type");

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

function createTab(url = null) {
    const tabId = tabCounter++;
    const tab = {
        id: tabId,
        title: "New Tab",
        url: url,
        frame: null,
        connection: null,
        proxy: null
    };

    tabs.push(tab);
    activeTabId = tabId;

    renderTabs();
    createTabFrame(tab);
    homeView.style.display = "none";
    tabsBar.style.display = "flex";

    return tab;
}

function createTabFrame(tab) {
    const frame = document.createElement("div");
    frame.className = "sj-frame active";
    frame.id = `tab-${tab.id}`;
    tabsContent.appendChild(frame);

    tab.frame = frame;
}

function closeTab(tabId) {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index !== -1) {
        const tab = tabs[index];
        if (tab.frame) tab.frame.remove();
        tabs.splice(index, 1);

        if (tabs.length === 0) {
            homeView.style.display = "flex";
            tabsBar.style.display = "none";
            activeTabId = null;
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
    const activeFrame = document.getElementById(`tab-${tabId}`);
    if (activeFrame) activeFrame.classList.add("active");

    renderTabs();
}

function renderTabs() {
    tabsContainer.innerHTML = "";
    tabs.forEach(tab => {
        const tabEl = document.createElement("div");
        tabEl.className = `sj-tab ${tab.id === activeTabId ? "active" : ""}`;
        tabEl.innerHTML = `
            <span class="sj-tab-title">${tab.title}</span>
            <button class="sj-tab-close" data-tab-id="${tab.id}">×</button>
        `;
        tabEl.addEventListener("click", () => switchTab(tab.id));
        tabEl.querySelector(".sj-tab-close").addEventListener("click", (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        tabsContainer.appendChild(tabEl);
    });
}

newTabBtn.addEventListener("click", createTab);

// Integrate with existing form
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (tabs.length === 0) {
        createTab();
    }

    const url = search(address.value, searchEngine.value);
    const activeTab = tabs.find(t => t.id === activeTabId);

    if (!activeTab) return;

    // Update tab title
    activeTab.title = address.value.substring(0, 30);
    renderTabs();

    if (proxyType.value === "rammerhead") {
        const proxyFrame = document.createElement("iframe");
        proxyFrame.src = "/rammerhead/session/new?url=" + encodeURIComponent(url);
        proxyFrame.style.cssText = "width:100%;height:100%;border:none;";
        activeTab.frame.innerHTML = "";
        activeTab.frame.appendChild(proxyFrame);
        return;
    }

    // Scramjet loading
    await registerSW();

    let wispUrl =
        (location.protocol === "https:" ? "wss" : "ws") +
        "://" +
        location.host +
        "/wisp/";

    if (!activeTab.connection) {
        activeTab.connection = new BareMux.BareMuxConnection("/baremux/worker.js");
    }

    if ((await activeTab.connection.getTransport()) !== "/libcurl/index.mjs") {
        await activeTab.connection.setTransport("/libcurl/index.mjs", [
            { websocket: wispUrl },
        ]);
    }

    const frame = scramjet.createFrame();
    frame.frame.style.cssText = "position:relative;width:100%;height:100%;";
    activeTab.frame.innerHTML = "";
    activeTab.frame.appendChild(frame.frame);
    frame.go(url);

    // Tab controls
    nav.style.display = "flex";

    btnHome.onclick = () => {
        closeTab(activeTabId);
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
            activeTab.frame.requestFullscreen();
            nav.classList.add("hidden");
        } else {
            document.exitFullscreen();
            nav.classList.remove("hidden");
        }
    };
});
