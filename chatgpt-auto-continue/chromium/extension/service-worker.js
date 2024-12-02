// Launch CHATGPT on install
chrome.runtime.onInstalled.addListener(details => {
    if (details.reason == 'install') // to exclude updates
        chrome.tabs.create({ url: 'https://chatgpt.com/' })
})

// Sync SETTINGS to activated tabs
chrome.tabs.onActivated.addListener(activeInfo =>
    chrome.tabs.sendMessage(activeInfo.tabId, { action: 'syncConfigToUI' }));

// Init APP data
(async () => {
    const app = { latestAssetCommitHash: '323b36a', urls: {} }
    app.urls.assetHost = `https://cdn.jsdelivr.net/gh/adamlui/chatgpt-auto-continue@${app.latestAssetCommitHash}`
    const remoteAppData = await (await fetch(`${app.urls.assetHost}/app.json`)).json()
    Object.assign(app, { ...remoteAppData, urls: { ...app.urls, ...remoteAppData.urls }})
    chrome.storage.sync.set({ app }) // save to browser storage
})()
