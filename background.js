chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings
  chrome.storage.sync.get(["apiKey", "baseId", "shortcut", "errorLogging", "debugMode"], (result) => {
    if (!result.apiKey) {
      chrome.storage.sync.set({ apiKey: "" })
    }
    if (!result.baseId) {
      chrome.storage.sync.set({ baseId: "" })
    }
    if (!result.shortcut) {
      chrome.storage.sync.set({ shortcut: "Ctrl+Shift+Space" })
    }
    if (result.errorLogging === undefined) {
      chrome.storage.sync.set({ errorLogging: true }) // Enable error logging by default
    }
    if (result.debugMode === undefined) {
      chrome.storage.sync.set({ debugMode: false }) // Disable debug mode by default
    }
  })

  // Create context menu for debug mode
  chrome.contextMenus.create({
    id: "toggleDebugMode",
    title: "Toggle Debug Mode",
    contexts: ["action"],
  })

  // Create context menu for "Ask Humble" feature
  chrome.contextMenus.create({
    id: "askHumble",
    title: 'Ask Humble about "%s"',
    contexts: ["selection"],
  })
})

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    chrome.action.openPopup()
  }
})

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggleDebugMode") {
    chrome.storage.sync.get(["debugMode"], (result) => {
      const newDebugMode = !result.debugMode
      chrome.storage.sync.set({ debugMode: newDebugMode }, () => {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Debug Mode",
          message: newDebugMode ? "Debug mode enabled" : "Debug mode disabled",
        })
      })
    })
  } else if (info.menuItemId === "askHumble") {
    // Store the selected text
    chrome.storage.local.set({ selectedText: info.selectionText }, () => {
      // Open the popup
      chrome.action.openPopup()
    })
  }
})

// Listen for error logging from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "logError") {
    console.error("Error logged from extension:", message.error)

    // You could implement additional error reporting here
    // For example, sending to a server or analytics service

    sendResponse({ success: true })
  }
  return true
})
