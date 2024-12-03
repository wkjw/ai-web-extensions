// Launch CHATGPT on install
chrome.runtime.onInstalled.addListener(details => {
    if (details.reason == 'install') // to exclude updates
        chrome.tabs.create({ url: 'https://chatgpt.com/' })
})

// Sync SETTINGS to activated tabs
chrome.tabs.onActivated.addListener(activeInfo =>
    chrome.tabs.sendMessage(activeInfo.tabId, { action: 'syncConfigToUI' }))

// Show ABOUT modal on ChatGPT when toolbar button clicked
chrome.runtime.onMessage.addListener(async req => {
    if (req.action == 'showAbout') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const chatgptTab = new URL(activeTab.url).hostname == 'chatgpt.com' ? activeTab
            : await chrome.tabs.create({ url: 'https://chatgpt.com/' })
        if (activeTab != chatgptTab) await new Promise(resolve => // after new tab loads
            chrome.tabs.onUpdated.addListener(async function statusListener(tabId, info) {
                if (tabId == chatgptTab.id && info.status == 'complete') {
                    chrome.tabs.onUpdated.removeListener(statusListener)
                    await new Promise(resolve => setTimeout(resolve, 2500))
                    resolve()
        }}))
        chrome.tabs.sendMessage(chatgptTab.id, { action: 'showAbout' })
    }
});

// Init APP data
(async () => {
    const app = {
        version: chrome.runtime.getManifest().version, latestAssetCommitHash: '323b36a', urls: {},
        chatgptJSver: (await (await fetch(chrome.runtime.getURL('lib/chatgpt.js'))).text()).match(/v(\d+\.\d+\.\d+)/)[1]
    }
    app.urls.assetHost = `https://cdn.jsdelivr.net/gh/adamlui/chatgpt-auto-continue@${app.latestAssetCommitHash}`
    const remoteAppData = await (await fetch(`${app.urls.assetHost}/app.json`)).json()
    Object.assign(app, { ...remoteAppData, urls: { ...app.urls, ...remoteAppData.urls }})
    chrome.storage.sync.set({ app }) // save to browser storage
})()
