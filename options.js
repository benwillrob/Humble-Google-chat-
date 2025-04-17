document.addEventListener("DOMContentLoaded", () => {
  // DOM element references
  const apiKeyInput = document.getElementById("apiKey")
  const toggleApiKeyBtn = document.getElementById("toggleApiKey")
  const baseIdTableBody = document.getElementById("baseIdTableBody")
  const baseIdName = document.getElementById("baseIdName")
  const baseIdValue = document.getElementById("baseIdValue")
  const addBaseIdBtn = document.getElementById("addBaseIdBtn")
  const currentShortcut = document.getElementById("currentShortcut")
  const errorLoggingCheckbox = document.getElementById("errorLogging")
  const debugModeCheckbox = document.getElementById("debugMode")
  const saveBtn = document.getElementById("saveBtn")
  const testConnectionBtn = document.getElementById("testConnectionBtn")
  const resetChatBtn = document.getElementById("resetChatBtn")
  const clearStorageBtn = document.getElementById("clearStorageBtn")
  const exportLogsBtn = document.getElementById("exportLogsBtn")
  const themeToggleBtn = document.getElementById("themeToggleBtn")
  const lightModeIcon = document.getElementById("lightModeIcon")
  const darkModeIcon = document.getElementById("darkModeIcon")
  const notification = document.getElementById("notification")
  const notificationMessage = document.getElementById("notificationMessage")
  const dismissNotification = document.getElementById("dismissNotification")
  const editBaseIdModal = document.getElementById("editBaseIdModal")
  const editBaseIdName = document.getElementById("editBaseIdName")
  const editBaseIdValue = document.getElementById("editBaseIdValue")
  const saveEditBaseId = document.getElementById("saveEditBaseId")
  const cancelEditBaseId = document.getElementById("cancelEditBaseId")
  const closeEditModalBtn = document.getElementById("closeEditModal")

  let currentEditIndex = -1

  // Debug logging
  const logDebug = (message, data = null) => {
    const timestamp = new Date().toISOString()
    let logMessage = `[${timestamp}] ${message}`

    if (data) {
      try {
        if (typeof data === "object") {
          logMessage += `\n${JSON.stringify(data, null, 2)}`
        } else {
          logMessage += `\n${data}`
        }
      } catch (e) {
        logMessage += `\n[Error stringifying data: ${e.message}]`
      }
    }

    console.log(logMessage)
  }

  // Show notification
  const showNotification = (message, type = "info", duration = 5000) => {
    notificationMessage.textContent = message
    notification.classList.remove("hidden", "success", "error", "warning", "info")
    notification.classList.add(type)

    // Reset animation
    notification.style.animation = "none"
    notification.offsetHeight // Trigger reflow
    notification.style.animation = null

    // Auto-dismiss after duration
    setTimeout(() => {
      notification.classList.add("hidden")
    }, duration)
  }

  // Toggle API key visibility
  if (toggleApiKeyBtn) {
    toggleApiKeyBtn.addEventListener("click", () => {
      if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text"
        toggleApiKeyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle><path d="m3 3 18 18"></path></svg>`
      } else {
        apiKeyInput.type = "password"
        toggleApiKeyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
      }
    })
  }

  // Function to render the base ID table
  const renderBaseIdTable = (baseIds) => {
    if (!baseIdTableBody) return

    baseIdTableBody.innerHTML = ""

    if (!baseIds || baseIds.length === 0) {
      const emptyRow = document.createElement("tr")
      emptyRow.className = "empty-row"
      emptyRow.innerHTML = `<td colspan="3">No BASE IDs configured</td>`
      baseIdTableBody.appendChild(emptyRow)
      return
    }

    baseIds.forEach((baseId, index) => {
      const row = document.createElement("tr")
      row.className = index % 2 === 0 ? "even-row" : "odd-row"
      row.setAttribute("data-index", index)
      row.setAttribute("data-id", baseId.id)

      row.innerHTML = `
        <td>${baseId.name}</td>
        <td>${baseId.id}</td>
        <td class="table-actions">
          <button class="edit-base-id" data-index="${index}">Edit</button>
          <button class="delete-base-id" data-index="${index}">Delete</button>
          <button class="set-default-base-id ${baseId.isDefault ? "active" : ""}" data-index="${index}">
            ${baseId.isDefault ? "Default" : "Set Default"}
          </button>
        </td>
      `

      baseIdTableBody.appendChild(row)
    })

    // Add event listeners for edit, delete, and set default buttons
    document.querySelectorAll(".edit-base-id").forEach((button) => {
      button.addEventListener("click", (e) => {
        const index = Number.parseInt(e.target.getAttribute("data-index"))
        openEditModal(index)
      })
    })

    document.querySelectorAll(".delete-base-id").forEach((button) => {
      button.addEventListener("click", (e) => {
        const index = Number.parseInt(e.target.getAttribute("data-index"))
        deleteBaseId(index)
      })
    })

    document.querySelectorAll(".set-default-base-id").forEach((button) => {
      button.addEventListener("click", (e) => {
        const index = Number.parseInt(e.target.getAttribute("data-index"))
        setDefaultBaseId(index)
      })
    })
  }

  // Function to open edit modal
  const openEditModal = (index) => {
    chrome.storage.sync.get(["baseIds"], (result) => {
      const baseIds = result.baseIds || []

      if (index >= 0 && index < baseIds.length) {
        const baseId = baseIds[index]
        currentEditIndex = index

        editBaseIdName.value = baseId.name
        editBaseIdValue.value = baseId.id

        editBaseIdModal.classList.remove("hidden")

        // Focus on the name input
        setTimeout(() => {
          editBaseIdName.focus()
        }, 100)
      }
    })
  }

  // Function to close edit modal
  const closeEditModal = () => {
    editBaseIdModal.classList.add("hidden")
    currentEditIndex = -1
  }

  // Function to save edited base ID
  const saveEditedBaseId = () => {
    const newName = editBaseIdName.value.trim()
    const newId = editBaseIdValue.value.trim()

    if (!newName || !newId) {
      showNotification("Both name and BASE ID are required", "error")
      return
    }

    chrome.storage.sync.get(["baseIds"], (result) => {
      const baseIds = result.baseIds || []

      if (currentEditIndex >= 0 && currentEditIndex < baseIds.length) {
        baseIds[currentEditIndex] = {
          ...baseIds[currentEditIndex],
          name: newName,
          id: newId,
        }

        chrome.storage.sync.set({ baseIds }, () => {
          renderBaseIdTable(baseIds)
          closeEditModal()
          showNotification("BASE ID updated successfully!", "success")
        })
      }
    })
  }

  // Function to delete a base ID
  const deleteBaseId = (index) => {
    if (!confirm("Are you sure you want to delete this BASE ID?")) {
      return
    }

    chrome.storage.sync.get(["baseIds", "activeBaseId"], (result) => {
      const baseIds = result.baseIds || []
      let activeBaseId = result.activeBaseId

      if (index >= 0 && index < baseIds.length) {
        const deletedBaseId = baseIds[index]

        // If we're deleting the active base ID, reset it
        if (activeBaseId === deletedBaseId.id) {
          activeBaseId = baseIds.length > 1 ? baseIds.find((b) => b.id !== deletedBaseId.id)?.id || null : null
        }

        // If we're deleting the default base ID, set a new default if possible
        if (deletedBaseId.isDefault && baseIds.length > 1) {
          const newDefaultIndex = index === 0 ? 1 : 0
          baseIds[newDefaultIndex].isDefault = true
        }

        // Remove the base ID
        baseIds.splice(index, 1)

        // Update storage
        chrome.storage.sync.set(
          {
            baseIds,
            activeBaseId,
            // For backward compatibility, also update the old baseId field
            baseId: activeBaseId,
          },
          () => {
            renderBaseIdTable(baseIds)
            showNotification("BASE ID deleted successfully!", "success")
          },
        )
      }
    })
  }

  // Function to set a base ID as default
  const setDefaultBaseId = (index) => {
    chrome.storage.sync.get(["baseIds"], (result) => {
      let baseIds = result.baseIds || []

      if (index >= 0 && index < baseIds.length) {
        // Update all base IDs to not be default
        baseIds = baseIds.map((baseId) => ({
          ...baseId,
          isDefault: false,
        }))

        // Set the selected one as default
        baseIds[index].isDefault = true

        // Update storage
        chrome.storage.sync.set(
          {
            baseIds,
            activeBaseId: baseIds[index].id,
            // For backward compatibility, also update the old baseId field
            baseId: baseIds[index].id,
          },
          () => {
            renderBaseIdTable(baseIds)
            showNotification("Default BASE ID updated!", "success")
          },
        )
      }
    })
  }

  // Load saved settings
  chrome.storage.sync.get(
    ["apiKey", "baseIds", "activeBaseId", "baseId", "shortcut", "errorLogging", "debugMode", "theme"],
    (result) => {
      logDebug("Loading settings", {
        apiKeyExists: !!result.apiKey,
        baseIdsCount: result.baseIds ? result.baseIds.length : 0,
        activeBaseId: result.activeBaseId,
        legacyBaseId: result.baseId,
        errorLogging: result.errorLogging,
        debugMode: result.debugMode,
        theme: result.theme,
      })

      if (result.apiKey) {
        apiKeyInput.value = result.apiKey
      }

      // Handle base IDs - migrate from old format if needed
      let baseIds = result.baseIds || []

      // If we have a legacy baseId but no baseIds array, migrate it
      if (result.baseId && (!baseIds || baseIds.length === 0)) {
        baseIds = [
          {
            name: "Default",
            id: result.baseId,
            isDefault: true,
          },
        ]

        chrome.storage.sync.set({
          baseIds,
          activeBaseId: result.baseId,
        })
      }

      // If we have baseIds but no activeBaseId, set it to the default or first one
      if (baseIds.length > 0 && !result.activeBaseId) {
        const defaultBaseId = baseIds.find((b) => b.isDefault)
        const activeBaseId = defaultBaseId ? defaultBaseId.id : baseIds[0].id

        chrome.storage.sync.set({ activeBaseId })
      }

      // Render the base ID table
      renderBaseIdTable(baseIds)

      if (result.shortcut) {
        currentShortcut.textContent = result.shortcut
      }

      if (result.errorLogging !== undefined) {
        errorLoggingCheckbox.checked = result.errorLogging
      } else {
        errorLoggingCheckbox.checked = true // Default to true
      }

      if (result.debugMode !== undefined) {
        debugModeCheckbox.checked = result.debugMode
      } else {
        debugModeCheckbox.checked = false // Default to false
      }

      // Set theme
      if (result.theme) {
        setTheme(result.theme)
      } else {
        // Check system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        setTheme(prefersDark ? "dark" : "light")
      }
    },
  )

  // Test connection to Humble API
  testConnectionBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim()

    // Get the default BASE ID
    chrome.storage.sync.get(["baseIds"], async (result) => {
      const baseIds = result.baseIds || []
      const defaultBaseId = baseIds.find((b) => b.isDefault)
      const baseId = defaultBaseId ? defaultBaseId.id : baseIds.length > 0 ? baseIds[0].id : ""

      if (!apiKey || !baseId) {
        showNotification("Please enter both API Key and add at least one BASE ID", "error")
        return
      }

      showNotification("Testing connection...", "info")
      logDebug("Testing API connection", { baseId })

      try {
        const url = `https://platform.thehumbleai.com/api/assistant/chats/${baseId}`
        logDebug(`POST request to: ${url}`)

        const headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }
        logDebug("Request headers:", { ...headers, Authorization: "Bearer [REDACTED]" })

        const body = JSON.stringify({})
        logDebug("Request body:", body)

        const response = await fetch(url, {
          method: "POST",
          headers: headers,
          body: body,
        })

        logDebug(`Response status: ${response.status} ${response.statusText}`)

        const responseText = await response.text()
        logDebug("Raw response:", responseText)

        let data
        try {
          data = JSON.parse(responseText)
          logDebug("Parsed response data:", data)
        } catch (parseError) {
          logDebug(`Error parsing JSON: ${parseError.message}  data)
        } catch (parseError) {
          logDebug(\`Error parsing JSON: ${parseError.message}`)
          showNotification(
            `Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 100)}...`,
            "error",
          )
          return
        }

        if (response.status === 401) {
          showNotification("Authentication failed: Invalid API key", "error")
        } else if (response.status === 403) {
          showNotification("Authorization failed: Insufficient permissions", "error")
        } else if (response.status === 404) {
          showNotification("BASE ID not found: Please check your BASE ID", "error")
        } else if (!response.ok) {
          showNotification(`API error (${response.status}): ${data.message || response.statusText}`, "error")
        } else {
          // Clean up by deleting the test chat
          if (data && data.id) {
            try {
              logDebug(`Cleaning up test chat with ID: ${data.id}`)
              await fetch(`https://platform.thehumbleai.com/api/assistant/chats/${data.id}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                },
              })
              logDebug("Test chat deleted successfully")
            } catch (deleteError) {
              console.error("Error deleting test chat:", deleteError)
              logDebug(`Error deleting test chat: ${deleteError.message}`)
            }
          }

          showNotification("Connection successful! Your API key and BASE ID are working correctly.", "success")
        }
      } catch (error) {
        console.error("Connection test error:", error)
        logDebug(`Connection test error: ${error.message}`, { stack: error.stack })
        showNotification(`Connection error: ${error.message}. Check your network connection.`, "error")
      }
    })
  })

  // Save settings
  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim()
    const errorLogging = errorLoggingCheckbox.checked
    const debugMode = debugModeCheckbox.checked

    logDebug("Saving settings", {
      apiKeyExists: !!apiKey,
      errorLogging,
      debugMode,
    })

    chrome.storage.sync.set({ apiKey, errorLogging, debugMode }, () => {
      // Reset chat ID when settings change
      chrome.storage.local.set({ currentChatId: null })
      logDebug("Settings saved, chat ID reset")

      showNotification("Settings saved successfully!", "success")
    })
  })

  // Reset chat session
  resetChatBtn.addEventListener("click", () => {
    chrome.storage.local.set({ currentChatId: null }, () => {
      logDebug("Chat session reset")
      showNotification("Chat session reset successfully!", "warning")
    })
  })

  // Clear all storage
  clearStorageBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all extension data? This cannot be undone.")) {
      chrome.storage.local.clear(() => {
        chrome.storage.sync.clear(() => {
          logDebug("All storage cleared")

          // Reinitialize default settings
          chrome.storage.sync.set(
            {
              apiKey: "",
              baseId: "",
              shortcut: "Ctrl+Shift+Space",
              errorLogging: true,
              debugMode: false,
            },
            () => {
              showNotification("All data cleared. Reloading page...", "warning")

              // Reload the page to reflect changes
              setTimeout(() => {
                window.location.reload()
              }, 1500)
            },
          )
        })
      })
    }
  })

  // Export debug logs
  exportLogsBtn.addEventListener("click", () => {
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "")

    // Create debug info object
    const debugInfo = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      settings: {},
    }

    // Get current settings
    chrome.storage.sync.get(null, (syncData) => {
      // Remove sensitive data
      const sanitizedData = { ...syncData }
      if (sanitizedData.apiKey) sanitizedData.apiKey = "REDACTED"

      debugInfo.settings.sync = sanitizedData

      chrome.storage.local.get(null, (localData) => {
        debugInfo.settings.local = localData

        // Create blob and download
        const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)

        const a = document.createElement("a")
        a.href = url
        a.download = `humble-ai-debug-${timestamp}.json`
        document.body.appendChild(a)
        a.click()

        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 0)

        showNotification("Debug logs exported successfully!", "success")
      })
    })
  })

  // Add event listener for adding a new base ID
  addBaseIdBtn.addEventListener("click", () => {
    const name = baseIdName.value.trim()
    const id = baseIdValue.value.trim()

    if (!name || !id) {
      showNotification("Both name and BASE ID are required", "error")
      return
    }

    chrome.storage.sync.get(["baseIds"], (result) => {
      const baseIds = result.baseIds || []

      // Check if this ID already exists
      if (baseIds.some((baseId) => baseId.id === id)) {
        showNotification("A BASE ID with this value already exists", "error")
        return
      }

      // Add the new base ID
      const isFirst = baseIds.length === 0
      baseIds.push({
        name,
        id,
        isDefault: isFirst, // Make it default if it's the first one
      })

      // If this is the first base ID, also set it as active
      const updates = { baseIds }
      if (isFirst) {
        updates.activeBaseId = id
        updates.baseId = id // For backward compatibility
      }

      chrome.storage.sync.set(updates, () => {
        // Clear the input fields
        baseIdName.value = ""
        baseIdValue.value = ""

        // Render the updated table
        renderBaseIdTable(baseIds)
        showNotification("BASE ID added successfully!", "success")
      })
    })
  })

  // Set theme function
  const setTheme = (theme) => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark")
      lightModeIcon.classList.add("hidden")
      darkModeIcon.classList.remove("hidden")
    } else {
      document.documentElement.removeAttribute("data-theme")
      lightModeIcon.classList.remove("hidden")
      darkModeIcon.classList.add("hidden")
    }
  }

  // Toggle theme
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    // Save the theme preference
    chrome.storage.sync.set(
      {
        theme: newTheme,
        themeUserSet: true,
      },
      () => {
        setTheme(newTheme)
      },
    )
  })

  // Dismiss notification
  dismissNotification.addEventListener("click", () => {
    notification.classList.add("hidden")
  })

  // Edit modal event listeners
  saveEditBaseId.addEventListener("click", saveEditedBaseId)
  cancelEditBaseId.addEventListener("click", closeEditModal)
  closeEditModalBtn.addEventListener("click", closeEditModal)

  // Close modal when clicking outside
  editBaseIdModal.addEventListener("click", (e) => {
    if (e.target === editBaseIdModal) {
      closeEditModal()
    }
  })

  // Add keyboard support for modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !editBaseIdModal.classList.contains("hidden")) {
      closeEditModal()
    }

    if (e.key === "Enter" && !editBaseIdModal.classList.contains("hidden")) {
      saveEditedBaseId()
    }
  })
})
