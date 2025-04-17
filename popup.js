document.addEventListener("DOMContentLoaded", () => {
  // DOM element references
  const baseIdDropdown = document.getElementById("baseIdDropdown")
  const refreshBaseIdsBtn = document.getElementById("refreshBaseIdsBtn")
  const newChatBtn = document.getElementById("newChatBtn")
  const themeToggleBtn = document.getElementById("themeToggleBtn")
  const lightModeIcon = document.getElementById("lightModeIcon")
  const darkModeIcon = document.getElementById("darkModeIcon")
  const chatMessages = document.getElementById("chatMessages")
  const userInput = document.getElementById("userInput")
  const sendBtn = document.getElementById("sendBtn")
  const clearChatBtn = document.getElementById("clearChatBtn")
  const settingsBtn = document.getElementById("settingsBtn")
  const apiStatus = document.getElementById("apiStatus")
  const errorBanner = document.getElementById("errorBanner")
  const errorMessage = document.getElementById("errorMessage")
  const dismissError = document.getElementById("dismissError")
  const debugBtn = document.getElementById("debugBtn")
  const debugPanel = document.getElementById("debugOutput")
  const debugOutput = document.getElementById("debugOutput")
  const closeDebugBtn = document.getElementById("closeDebugBtn")
  const chatContainer = document.getElementById("chatContainer")
  const scrollToBottomBtn = document.getElementById("scrollToBottomBtn")
  const clearDebugBtn = document.getElementById("clearDebugBtn")
  const debugChatIdDisplay = document.getElementById("debugChatIdDisplay")
  const currentChatIdText = document.getElementById("currentChatIdText")
  const copyChatIdBtn = document.getElementById("copyChatIdBtn")

  let chatHistory = []
  let currentChatId = null
  let retryCount = 0
  const MAX_RETRIES = 3
  let debugMode = false
  let userHasScrolled = false
  let autoScrollDebug = true

  // Initialize debug mode from storage
  chrome.storage.sync.get(["debugMode"], (result) => {
    debugMode = result.debugMode === true
    if (debugMode) {
      debugBtn.classList.remove("hidden")
      // Only show chat ID display in debug mode
      debugChatIdDisplay.classList.remove("hidden")
    } else {
      // Always hide chat ID display when not in debug mode
      debugChatIdDisplay.classList.add("hidden")
    }
  })

  // Load chat history and check for existing chat
  chrome.storage.local.get(["chatHistory", "currentChatId"], (result) => {
    if (result.chatHistory) {
      chatHistory = result.chatHistory
      renderChatHistory()
      scrollToBottom(chatContainer)
    } else {
      // Show empty state if no chat history
      showEmptyState()
    }

    // Set currentChatId
    if (result.currentChatId) {
      currentChatId = result.currentChatId
      logDebug(`Loaded existing chat ID: ${currentChatId}`)
      // Add this line to update the display
      updateChatIdDisplay(currentChatId)
    } else {
      // If no chat ID exists, check if we have API credentials to create one
      chrome.storage.sync.get(["apiKey", "baseId"], async (credentials) => {
        if (credentials.apiKey && credentials.baseId) {
          try {
            logDebug("No existing chat ID found. Attempting to create a new chat...")
            // Show typing indicator instead of loading spinner
            addTypingIndicator()
            showError("Initializing chat session...", "info")

            currentChatId = await createNewChat(credentials.apiKey, credentials.baseId)
            chrome.storage.local.set({ currentChatId })
            // Add this line to update the display
            updateChatIdDisplay(currentChatId)

            logDebug(`New chat created with ID: ${currentChatId}`)
            showError("Chat session initialized successfully!", "info")
            // Remove typing indicator when done
            removeTypingIndicator()
          } catch (error) {
            logDebug(`Failed to create initial chat: ${error.message}`)
            showError(`Failed to initialize chat: ${error.message}`, "error")
            // Remove typing indicator on error
            removeTypingIndicator()
          }
        }
      })
    }
  })

  // Check API key and BASE ID status
  chrome.storage.sync.get(
    ["apiKey", "baseIds", "activeBaseId", "baseId", "shortcut", "errorLogging", "debugMode", "theme"],
    (result) => {
      updateApiStatus(result.apiKey, result.baseId)
    },
  )

  // Show empty state when no messages
  const showEmptyState = () => {
    if (chatMessages.children.length === 0) {
      const emptyState = document.createElement("div")
      emptyState.className = "empty-state"
      emptyState.innerHTML = `
        <div class="empty-state-icon">💬</div>
        <h3 class="empty-state-title">Start a conversation</h3>
        <p class="empty-state-description">Send a message to begin chatting with Humble AI</p>
      `
      chatMessages.appendChild(emptyState)
    }
  }

  // Update API status indicator
  const updateApiStatus = (apiKey, baseId) => {
    if (apiKey && baseId) {
      apiStatus.textContent = "API: ✓ | BASE ID: ✓"
      apiStatus.classList.remove("text-yellow-600", "text-red-600")
      apiStatus.classList.add("text-green-600")
    } else if (apiKey) {
      apiStatus.textContent = "API: ✓ | BASE ID: ✗"
      apiStatus.classList.remove("text-green-600", "text-red-600")
      apiStatus.classList.add("text-yellow-600")
    } else if (baseId) {
      apiStatus.textContent = "API: ✗ | BASE ID: ✓"
      apiStatus.classList.remove("text-green-600", "text-red-600")
      apiStatus.classList.add("text-yellow-600")
    } else {
      apiStatus.textContent = "API: ✗ | BASE ID: ✗"
      apiStatus.classList.remove("text-green-600", "text-yellow-600")
      apiStatus.classList.add("text-red-600")
    }
  }

  // Function to populate the BASE ID dropdown
  const populateBaseIdDropdown = () => {
    if (!baseIdDropdown) return

    chrome.storage.sync.get(["baseIds", "activeBaseId"], (result) => {
      const baseIds = result.baseIds || []
      const activeBaseId = result.activeBaseId

      // Clear existing options except the placeholder
      while (baseIdDropdown.options.length > 1) {
        baseIdDropdown.remove(1)
      }

      if (baseIds.length === 0) {
        // If no base IDs, show a message and disable the dropdown
        const option = document.createElement("option")
        option.value = ""
        option.textContent = "No BASE IDs configured"
        baseIdDropdown.appendChild(option)
        baseIdDropdown.disabled = true
        return
      }

      // Enable the dropdown
      baseIdDropdown.disabled = false

      // Add options for each base ID
      baseIds.forEach((baseId) => {
        const option = document.createElement("option")
        option.value = baseId.id
        option.textContent = baseId.name

        // Mark as default if applicable
        if (baseId.isDefault) {
          option.textContent += " (Default)"
        }

        baseIdDropdown.appendChild(option)

        // Select the active base ID
        if (baseId.id === activeBaseId) {
          baseIdDropdown.value = baseId.id
        }
      })

      // If no active base ID is selected, select the first one
      if (!activeBaseId && baseIds.length > 0) {
        baseIdDropdown.value = baseIds[0].id
        // Update the active base ID in storage
        chrome.storage.sync.set({
          activeBaseId: baseIds[0].id,
          baseId: baseIds[0].id, // For backward compatibility
        })
      }

      // ADDED: After populating, immediately fetch the context information
      fetchContextInformation(baseIdDropdown.value)
    })
  }

  // ADDED: New function to fetch available contexts for a BASE ID
  const fetchContextInformation = async (baseId) => {
    if (!baseId) return

    logDebug(`Fetching context information for BASE ID: ${baseId}`)

    try {
      chrome.storage.sync.get(["apiKey"], async (result) => {
        const apiKey = result.apiKey

        if (!apiKey) {
          logDebug("No API key available for context fetch")
          return
        }

        const url = `https://platform.thehumbleai.com/api/assistant/bases/${baseId}/contexts`

        const headers = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }

        const response = await fetch(url, {
          method: "GET",
          headers: headers,
        })

        if (!response.ok) {
          logDebug(`Error fetching contexts: ${response.status} ${response.statusText}`)
          return
        }

        const contextData = await response.json()
        logDebug("Available contexts:", contextData)

        // Store the context information
        chrome.storage.local.set({
          availableContexts: contextData,
          lastBaseId: baseId,
        })

        // Update the context selector if it exists
        updateContextSelector(contextData)
      })
    } catch (error) {
      logDebug(`Error fetching context information: ${error.message}`)
    }
  }

  // ADDED: Function to update the context selector dropdown
  const updateContextSelector = (contexts) => {
    // Check if we need to create the context selector
    let contextSelector = document.getElementById("contextSelector")
    const controlsContainer = document.querySelector(".controls-container")

    if (!contextSelector && controlsContainer) {
      // Create the context selector
      const selectorWrapper = document.createElement("div")
      selectorWrapper.className = "select-wrapper context-wrapper"

      contextSelector = document.createElement("select")
      contextSelector.id = "contextSelector"
      contextSelector.className = "dropdown"

      selectorWrapper.appendChild(contextSelector)

      // Insert before the new chat button
      const newChatBtn = document.getElementById("newChatBtn")
      if (newChatBtn && newChatBtn.parentNode === controlsContainer) {
        controlsContainer.insertBefore(selectorWrapper, newChatBtn)
      } else {
        controlsContainer.appendChild(selectorWrapper)
      }

      // Add event listener
      contextSelector.addEventListener("change", () => {
        logDebug(`Context changed to: ${contextSelector.value}`)
        chrome.storage.local.set({ activeContext: contextSelector.value })
      })
    }

    if (contextSelector) {
      // Clear existing options
      contextSelector.innerHTML = ""

      // Default option
      const defaultOption = document.createElement("option")
      defaultOption.value = ""
      defaultOption.textContent = "Default Context"
      contextSelector.appendChild(defaultOption)

      // Add context options
      if (contexts && contexts.length > 0) {
        contexts.forEach((context) => {
          const option = document.createElement("option")
          option.value = context.name || context.id
          option.textContent = context.name || context.id
          contextSelector.appendChild(option)
        })

        // Set the previously selected context if available
        chrome.storage.local.get(["activeContext"], (result) => {
          if (result.activeContext) {
            // Check if the active context is in the new list
            const exists = Array.from(contextSelector.options).some((option) => option.value === result.activeContext)

            if (exists) {
              contextSelector.value = result.activeContext
            }
          }
        })
      }
    }
  }

  // Update chat ID display
  const updateChatIdDisplay = (chatId) => {
    if (!debugChatIdDisplay || !currentChatIdText) return

    if (chatId) {
      currentChatIdText.textContent = chatId
      if (debugMode) {
        debugChatIdDisplay.classList.remove("hidden")
      }
    } else {
      currentChatIdText.textContent = "None"
      if (!debugMode) {
        debugChatIdDisplay.classList.add("hidden")
      }
    }
  }

  // Scroll to bottom function
  const scrollToBottom = (element) => {
    if (!element) return

    // Use smooth scrolling behavior
    setTimeout(() => {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: "smooth",
      })
    }, 100) // Small delay to ensure animations have started
  }

  // Check if user is at bottom of scroll
  const isAtBottom = (element) => {
    if (!element) return true
    const tolerance = 50 // pixels from bottom to consider "at bottom"
    return element.scrollHeight - element.scrollTop - element.clientHeight <= tolerance
  }

  // Update scroll to bottom button visibility
  const updateScrollButtonVisibility = () => {
    if (!scrollToBottomBtn) return

    if (!isAtBottom(chatContainer)) {
      scrollToBottomBtn.classList.remove("hidden")
    } else {
      scrollToBottomBtn.classList.add("hidden")
    }
  }

  // Debug logging
  const logDebug = (message, data = null) => {
    if (!debugMode) return

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

    if (debugOutput) {
      const logEntry = document.createElement("div")
      logEntry.className = "debug-entry"

      const timestampSpan = document.createElement("span")
      timestampSpan.className = "debug-timestamp"
      timestampSpan.textContent = `[${timestamp.split("T")[1].split(".")[0]}] `

      const messageSpan = document.createElement("span")
      messageSpan.textContent = message

      logEntry.appendChild(timestampSpan)
      logEntry.appendChild(messageSpan)

      if (data) {
        const dataDiv = document.createElement("pre")
        dataDiv.className = "debug-data"
        try {
          if (typeof data === "object") {
            dataDiv.textContent = JSON.stringify(data, null, 2)
          } else {
            dataDiv.textContent = data
          }
        } catch (e) {
          dataDiv.textContent = `[Error stringifying data: ${e.message}]`
        }
        logEntry.appendChild(dataDiv)
      }

      debugOutput.appendChild(logEntry)

      // Auto-scroll debug panel if enabled
      if (autoScrollDebug) {
        scrollToBottom(debugOutput)
      }
    }
  }

  // Handle base ID change
  const handleBaseIdChange = () => {
    const selectedBaseId = baseIdDropdown.value

    if (selectedBaseId) {
      // Update the active base ID in storage
      chrome.storage.sync.set(
        {
          activeBaseId: selectedBaseId,
          baseId: selectedBaseId, // For backward compatibility
        },
        () => {
          logDebug(`Active BASE ID changed to: ${selectedBaseId}`)
          // ADDED: Fetch contexts when BASE ID changes
          fetchContextInformation(selectedBaseId)
        },
      )
    }
  }

  // Create a new chat with the selected BASE ID
  const handleNewChat = () => {
    const selectedBaseId = baseIdDropdown.value

    if (!selectedBaseId) {
      showError("Please select a BASE ID first", "warning")
      return
    }

    // Reset the current chat ID
    currentChatId = null
    chrome.storage.local.set({ currentChatId: null })

    // Clear chat history
    chatHistory = []
    chrome.storage.local.set({ chatHistory })
    renderChatHistory()

    // Show a notification
    showError(`Starting a new chat...`, "info")

    // Try to create a new chat with the selected base ID
    chrome.storage.sync.get(["apiKey"], async (result) => {
      if (result.apiKey) {
        try {
          // Show typing indicator
          addTypingIndicator()

          currentChatId = await createNewChat(result.apiKey, selectedBaseId)
          chrome.storage.local.set({ currentChatId })
          updateChatIdDisplay(currentChatId)

          logDebug(`New chat created with ID: ${currentChatId}`)
          showError("New chat created successfully!", "info")

          // Remove typing indicator when done
          removeTypingIndicator()

          // Show empty state
          showEmptyState()
        } catch (error) {
          logDebug(`Failed to create new chat: ${error.message}`)
          showError(`Failed to create new chat: ${error.message}`, "error")

          // Remove typing indicator on error
          removeTypingIndicator()
        }
      } else {
        showError("API key required to create a new chat", "warning")
      }
    })
  }

  // Show error banner with message
  const showError = (message, type = "error") => {
    errorMessage.textContent = message
    errorBanner.classList.remove("hidden")

    // Remove existing color classes
    errorBanner.className =
      errorBanner.className
        .replace(/bg-\w+-\d+/g, "")
        .replace(/hidden/g, "")
        .trim() + " notification-banner"

    if (type === "error") {
      errorBanner.classList.add("bg-red-500")
    } else if (type === "warning") {
      errorBanner.classList.add("bg-yellow-500")
    } else if (type === "info") {
      errorBanner.classList.add("bg-blue-500")
    }

    // Reset animation by removing and re-adding the class
    errorBanner.style.animation = "none"
    errorBanner.offsetHeight // Trigger reflow
    errorBanner.style.animation = null

    // Log error to console with timestamp
    console.error(`[${new Date().toISOString()}] ${message}`)
    logDebug(`ERROR: ${message}`, { type })

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      errorBanner.classList.add("hidden")
    }, 5000)
  }

  // Create a new chat
  const createNewChat = async (apiKey, baseId = null) => {
    // If no baseId is provided, use the active one from storage
    if (!baseId) {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["activeBaseId", "baseId"], resolve)
      })

      baseId = result.activeBaseId || result.baseId

      if (!baseId) {
        throw new Error("No BASE ID available. Please configure a BASE ID in settings.")
      }
    }

    logDebug(`Creating new chat with BASE ID: ${baseId}`)

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

        logDebug("Create Chat Response Structure:", {
          hasId: !!data.id,
          hasChatId: !!data.chatId,
          topLevelKeys: Object.keys(data),
        })
      } catch (parseError) {
        logDebug(`Error parsing JSON: ${parseError.message}`)
        throw new Error(
          `Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 100)}...`,
        )
      }

      // Handle different HTTP status codes
      if (response.status === 401) {
        throw new Error("Authentication failed: Invalid API key")
      } else if (response.status === 403) {
        throw new Error("Authorization failed: Insufficient permissions")
      } else if (response.status === 404) {
        throw new Error("BASE ID not found: Please check your BASE ID")
      } else if (!response.ok) {
        throw new Error(`API error (${response.status}): ${data.message || response.statusText}`)
      }

      // Check for chat ID in different possible locations
      let chatId = null
      if (data.id) {
        chatId = data.id
      } else if (data.chatId) {
        chatId = data.chatId
      } else if (data.data && data.data.id) {
        chatId = data.data.id
      }

      if (!chatId) {
        throw new Error("Invalid response: Missing chat ID in API response")
      }

      // Reset retry count on success
      retryCount = 0
      logDebug(`Successfully created chat with ID: ${chatId}`)
      return chatId // Return the chat ID
    } catch (error) {
      logDebug(`Error creating chat: ${error.message}`, { stack: error.stack })

      // Log detailed error information
      logErrorDetails("createNewChat", error, { baseId })
      throw error
    }
  }

  // Function to create a direct query
  const createQueryResponse = async (apiKey, baseId, message) => {
    logDebug(`Creating query response with BASE ID: ${baseId}`)

    try {
      const url = `https://platform.thehumbleai.com/api/assistant/bases/${baseId}/queries`
      logDebug(`POST request to: ${url}`)

      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      }
      logDebug("Request headers:", { ...headers, Authorization: "Bearer [REDACTED]" })

      // MODIFY: Get the selected context from the dropdown
      const baseIdDropdown = document.getElementById("baseIdDropdown")
      const contextSelector = document.getElementById("contextSelector")
      const contextName = contextSelector && contextSelector.value ? contextSelector.value : "Default"
      logDebug(`Using context: ${contextName}`)

      const requestBody = {
        content: message,
        // MODIFY: Include context information in the request
        contextName: contextName,
        includeContext: true,
        jsonSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            setOfInstructions: { type: "array", items: { type: "string" } },
            prompt: { type: "string" },
          },
          required: ["prompt"],
        },
      }

      const body = JSON.stringify(requestBody)
      logDebug("Request body:", requestBody)

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
        logDebug(`Error parsing JSON: ${parseError.message}`)
        throw new Error(
          `Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 100)}...`,
        )
      }

      // Handle different HTTP status codes
      if (!response.ok) {
        throw new Error(`API error (${response.status}): ${data.message || response.statusText}`)
      }

      // Reset retry count on success
      retryCount = 0
      logDebug("Query successful")

      // Ensure the response has a prompt field
      if (!data.prompt) {
        data.prompt = message
      }

      return data
    } catch (error) {
      logDebug(`Error creating query response: ${error.message}`, { stack: error.stack })

      // Log detailed error information
      logErrorDetails("createQueryResponse", error, { baseId, message })
      throw error
    }
  }

  // Post a message to an existing chat
  const postMessage = async (apiKey, chatId, message, context = "") => {
    logDebug(`Posting message to chat ID: ${chatId}`)

    try {
      const url = `https://platform.thehumbleai.com/api/assistant/messages/${chatId}`
      logDebug(`POST request to: ${url}`)

      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      }
      logDebug("Request headers:", { ...headers, Authorization: "Bearer [REDACTED]" })

      const requestBody = {
        content: `User query: ${message}`,
        jsonSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
          required: ["prompt"],
        },
      }

      // Add context if provided
      if (context) {
        requestBody.contextName = context
        requestBody.includeContext = true
      }

      const body = JSON.stringify(requestBody)
      logDebug("Request body:", requestBody)

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
        logDebug(`Error parsing JSON: ${parseError.message}`)
        throw new Error(
          `Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 100)}...`,
        )
      }

      // Handle different HTTP status codes
      if (!response.ok) {
        throw new Error(`API error (${response.status}): ${data.message || response.statusText}`)
      }

      // Reset retry count on success
      retryCount = 0
      logDebug("Message posted successfully")

      // Ensure the response has a prompt field
      if (!data.prompt) {
        data.prompt = message
      }

      return data
    } catch (error) {
      logDebug(`Error posting message: ${error.message}`, { stack: error.stack })

      // Log detailed error information
      logErrorDetails("postMessage", error, { chatId, message, context })
      throw error
    }
  }

  // Log detailed error information
  const logErrorDetails = (operation, error, context = {}) => {
    const errorLog = {
      timestamp: new Date().toISOString(),
      operation,
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      context,
    }

    console.error("Detailed error log:", errorLog)
    logDebug(`Error in ${operation}:`, errorLog)

    // Send error to background script for potential reporting
    chrome.runtime.sendMessage({
      type: "logError",
      error: errorLog,
    })
  }

  // Update the renderChatHistory function to handle JSON display better
  const renderChatHistory = () => {
    chatMessages.innerHTML = ""

    if (chatHistory.length === 0) {
      showEmptyState()
      return
    }

    chatHistory.forEach((message, index) => {
      const messageDiv = document.createElement("div")
      messageDiv.className = "message-container"
      // Add a slight delay to each message for a staggered effect
      messageDiv.style.animationDelay = `${index * 0.05}s`

      const headerDiv = document.createElement("div")
      headerDiv.className = `message-header ${message.role}-header`
      headerDiv.textContent = message.role === "user" ? "You" : "Assistant"

      const contentDiv = document.createElement("div")
      contentDiv.className = `${message.role}-message`

      // Add a slight delay to each message for a staggered effect
      contentDiv.style.animationDelay = `${index * 0.05}s`

      // Display the content (which should be the prompt for assistant messages)
      contentDiv.textContent = message.content

      messageDiv.appendChild(headerDiv)
      messageDiv.appendChild(contentDiv)
      chatMessages.appendChild(messageDiv)
    })
  }

  // Toggle debug panel
  const toggleDebugPanel = () => {
    if (debugPanel.classList.contains("hidden")) {
      debugPanel.classList.remove("hidden")
      logDebug("Debug panel opened")
      scrollToBottom(debugOutput)
    } else {
      debugPanel.classList.add("hidden")
      logDebug("Debug panel closed")
    }
  }

  // Clear debug log
  const clearDebugLog = () => {
    if (debugOutput) {
      debugOutput.innerHTML = ""
      logDebug("Debug log cleared")
    }
  }

  // Toggle auto-scroll for debug panel
  const toggleDebugAutoScroll = () => {
    autoScrollDebug = !autoScrollDebug
    logDebug(`Debug auto-scroll ${autoScrollDebug ? "enabled" : "disabled"}`)

    // Update button text if it exists
    const autoScrollDebugBtn = document.getElementById("autoScrollDebugBtn")
    if (autoScrollDebugBtn) {
      autoScrollDebugBtn.textContent = autoScrollDebug ? "Disable Auto-Scroll" : "Enable Auto-Scroll"
    }
  }

  // Function to add a message to the chat history
  const addMessageToChat = (role, content, isJson = false, jsonData = null) => {
    // Remove empty state if it exists
    const emptyState = chatMessages.querySelector(".empty-state")
    if (emptyState) {
      emptyState.remove()
    }

    // Use the raw content directly without parsing
    const message = {
      role,
      content: content, // Use raw content directly
      originalContent: content, // Keep the original content for reference
      isJson,
      jsonData,
    }

    chatHistory.push(message)
    chrome.storage.local.set({ chatHistory })
    renderChatHistory()
    scrollToBottom(chatContainer)
  }

  // Add typing indicator
  const addTypingIndicator = () => {
    // Remove any existing typing indicator first
    removeTypingIndicator()

    // Remove empty state if it exists
    const emptyState = chatMessages.querySelector(".empty-state")
    if (emptyState) {
      emptyState.remove()
    }

    const typingIndicator = document.createElement("div")
    typingIndicator.className = "typing-indicator"
    typingIndicator.id = "typingIndicator"

    // Add the three animated dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span")
      typingIndicator.appendChild(dot)
    }

    chatMessages.appendChild(typingIndicator)
    scrollToBottom(chatContainer)
  }

  // Remove typing indicator
  const removeTypingIndicator = () => {
    const typingIndicator = document.getElementById("typingIndicator")
    if (typingIndicator) {
      typingIndicator.remove()
    }
  }

  // Process messages from the API
  const processApiMessages = (messages) => {
    if (!Array.isArray(messages) || messages.length < 2) {
      logDebug("Invalid message format: not an array or fewer than 2 messages", messages)
      return []
    }

    logDebug("Processing messages array", messages)

    // Create a new array with processed messages
    const processedMessages = []

    // First, let's log all messages to understand their structure
    messages.forEach((msg, index) => {
      logDebug(`Message at index ${index}:`, msg)
    })

    // Process the user message (first message)
    if (messages[0] && messages[0].userId) {
      processedMessages.push({
        role: "user",
        content: messages[0].content || "",
        originalContent: messages[0].content,
        id: messages[0].id,
        chatId: messages[0].chatId,
        createdAt: messages[0].createdAt,
      })
      logDebug("Processed user message", processedMessages[0])
    }

    // Process the assistant message (second message)
    if (messages[1] && !messages[1].userId) {
      try {
        // Extract the assistant's response from the second message's content
        const assistantMsgContent = messages[1].content
        logDebug("Raw assistant message content", assistantMsgContent)

        let assistantContent = ""

        if (typeof assistantMsgContent === "string") {
          try {
            // Parse the JSON content to extract the prompt
            const parsedContent = JSON.parse(assistantMsgContent)
            logDebug("Parsed assistant content", parsedContent)

            if (parsedContent && parsedContent.prompt) {
              assistantContent = parsedContent.prompt
              logDebug("Successfully extracted prompt from assistant message", { prompt: assistantContent })
            } else {
              assistantContent = assistantMsgContent // Use raw content if no prompt field
              logDebug("No prompt field found in parsed content, using raw content", parsedContent)
            }
          } catch (parseError) {
            logDebug("Error parsing assistant content as JSON", {
              error: parseError.message,
              content: assistantMsgContent,
            })
            assistantContent = assistantMsgContent // Fallback to raw content if not JSON
          }
        } else {
          assistantContent = JSON.stringify(assistantMsgContent) // Convert non-string content to string
          logDebug("Assistant message content is not a string, stringified", messages[1])
        }

        processedMessages.push({
          role: "assistant",
          content: assistantContent, // This is the extracted prompt or raw content
          originalContent: assistantMsgContent,
          id: messages[1].id,
          chatId: messages[1].chatId,
          createdAt: messages[1].createdAt,
        })
        logDebug("Processed assistant message", processedMessages[1])
      } catch (e) {
        // If parsing fails, log the error
        console.error("Error extracting prompt from assistant message:", e)
        logDebug(`Error extracting prompt: ${e.message}`, { message: messages[1] })

        // Add a fallback message
        processedMessages.push({
          role: "assistant",
          content: "Error processing assistant response",
          originalContent: messages[1].content,
          id: messages[1].id,
          chatId: messages[1].chatId,
          createdAt: messages[1].createdAt,
        })
      }
    }

    return processedMessages
  }

  // Send message function
  const sendMessage = async () => {
    const message = userInput.value.trim()
    if (!message) return

    // Add user message to chat
    addMessageToChat("user", message, false, { prompt: message })
    userInput.value = ""

    // Show typing indicator after user message
    addTypingIndicator()

    chrome.storage.sync.get(["apiKey", "baseId"], async (result) => {
      const apiKey = result.apiKey
      const baseId = result.baseId

      if (!apiKey || !baseId) {
        removeTypingIndicator() // Remove typing indicator if there's an error
        showError("API key and BASE ID required", "warning")
        return
      }

      try {
        let responseData

        // ADDED: Get the selected context
        const contextSelector = document.getElementById("contextSelector")
        const selectedContext = contextSelector ? contextSelector.value : ""
        logDebug(`Using selected context: ${selectedContext || "Default"}`)

        if (currentChatId) {
          // Post message to existing chat
          // MODIFIED: Pass the selected context to the function
          responseData = await sendChatMessage(apiKey, currentChatId, message, selectedContext)
          logDebug("Direct response from sendChatMessage:", responseData)

          // Remove typing indicator before showing the response
          removeTypingIndicator()

          // Process the response directly without making another API call
          if (responseData) {
            // Check if responseData is an array (which it appears to be from your logs)
            if (Array.isArray(responseData) && responseData.length >= 2) {
              // The second element (index 1) should be the assistant's response
              const assistantResponse = responseData[1]
              logDebug("Assistant response object:", assistantResponse)

              let assistantContent = ""

              // Check if the assistant response has content
              if (assistantResponse.content) {
                logDebug("Raw assistant content:", assistantResponse.content)

                try {
                  // Try to parse the content as JSON
                  const parsedContent = JSON.parse(assistantResponse.content)
                  logDebug("Parsed content:", parsedContent)

                  // Extract the prompt field which contains the actual response
                  if (parsedContent && parsedContent.prompt) {
                    assistantContent = parsedContent.prompt
                    logDebug("Extracted assistant content:", assistantContent)
                  } else {
                    // If no prompt field, use the raw content
                    assistantContent = assistantResponse.content
                    logDebug("No prompt field found in parsed content, using raw content")
                  }
                } catch (parseError) {
                  logDebug("Error parsing content as JSON:", parseError)
                  // If parsing fails, use the raw content
                  assistantContent = assistantResponse.content
                }
              } else {
                logDebug("No content field in assistant response")
                assistantContent = "No response content available"
              }

              // Add the assistant's response to chat
              addMessageToChat("assistant", assistantContent, false, assistantResponse)
            } else {
              // If responseData is not an array or doesn't have enough elements
              logDebug("Unexpected response format:", responseData)

              // Try to handle it as a single object
              if (responseData.content) {
                let assistantContent = ""

                try {
                  const parsedContent = JSON.parse(responseData.content)
                  if (parsedContent && parsedContent.prompt) {
                    assistantContent = parsedContent.prompt
                  } else {
                    assistantContent = responseData.content
                  }
                } catch (parseError) {
                  logDebug("Error parsing content as JSON:", parseError)
                  assistantContent = responseData.content
                }

                addMessageToChat("assistant", assistantContent, false, responseData)
              } else {
                showError("Unexpected response format", "warning")
                addMessageToChat("assistant", "No response content available", false, responseData)
              }
            }
          } else {
            removeTypingIndicator() // Remove typing indicator if there's no response
            showError("No response received from the API", "warning")
          }
        } else {
          // Create a new chat and post the message
          currentChatId = await createNewChat(apiKey, baseId)
          chrome.storage.local.set({ currentChatId })
          updateChatIdDisplay(currentChatId)

          // Post the message
          // MODIFIED: Pass the selected context to the function
          responseData = await sendChatMessage(apiKey, currentChatId, message, selectedContext)
          logDebug("Direct response from sendChatMessage (new chat):", responseData)

          // Remove typing indicator before showing the response
          removeTypingIndicator()

          // Process the response similarly to above
          if (Array.isArray(responseData) && responseData.length >= 2) {
            const assistantResponse = responseData[1]
            let assistantContent = ""

            if (assistantResponse.content) {
              try {
                const parsedContent = JSON.parse(assistantResponse.content)
                if (parsedContent && parsedContent.prompt) {
                  assistantContent = parsedContent.prompt
                } else {
                  assistantContent = assistantResponse.content
                }
              } catch (parseError) {
                logDebug("Error parsing content as JSON (new chat):", parseError)
                assistantContent = assistantResponse.content
              }
            } else {
              assistantContent = "No response content available"
            }

            // Add the assistant's response to chat
            addMessageToChat("assistant", assistantContent, false, assistantResponse)
          } else {
            showError("Unexpected response format from new chat", "warning")
            addMessageToChat("assistant", "No response content available", false, responseData)
          }
        }
      } catch (error) {
        console.error("Error sending message:", error)
        removeTypingIndicator() // Remove typing indicator if there's an error
        showError(`Error sending message: ${error.message}`, "error")
      }
    })
  }

  // MODIFIED: Create a renamed function to avoid duplicate declaration
  const sendChatMessage = async (apiKey, chatId, message, context = "") => {
    logDebug(`Posting message to chat ID: ${chatId}`)

    try {
      const url = `https://platform.thehumbleai.com/api/assistant/messages/${chatId}`
      logDebug(`POST request to: ${url}`)

      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      }
      logDebug("Request headers:", { ...headers, Authorization: "Bearer [REDACTED]" })

      const requestBody = {
        content: `User query: ${message}`,
        jsonSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
          required: ["prompt"],
        },
      }

      // Add context if provided
      if (context) {
        requestBody.contextName = context
        requestBody.includeContext = true
      }

      const body = JSON.stringify(requestBody)
      logDebug("Request body:", requestBody)

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
        logDebug(`Error parsing JSON: ${parseError.message}`)
        throw new Error(
          `Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 100)}...`,
        )
      }

      // Handle different HTTP status codes
      if (!response.ok) {
        throw new Error(`API error (${response.status}): ${data.message || response.statusText}`)
      }

      // Reset retry count on success
      retryCount = 0
      logDebug("Message posted successfully")

      // Ensure the response has a prompt field
      if (!data.prompt) {
        data.prompt = message
      }

      return data
    } catch (error) {
      logDebug(`Error posting message: ${error.message}`, { stack: error.stack })

      // Log detailed error information
      logErrorDetails("sendChatMessage", error, { chatId, message, context })
      throw error
    }
  }

  // Check for reduced motion preference
  const prefersReducedMotion = () => {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }

  // Initialize theme
  const initializeTheme = () => {
    // Check for saved theme preference or use system preference
    chrome.storage.sync.get(["theme"], (result) => {
      const savedTheme = result.theme

      if (savedTheme) {
        // Use saved preference
        setTheme(savedTheme)
      } else {
        // Check system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        setTheme(prefersDark ? "dark" : "light")
      }
    })

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      const newTheme = e.matches ? "dark" : "light"
      // Only auto-switch if user hasn't explicitly set a preference
      chrome.storage.sync.get(["themeUserSet"], (result) => {
        if (!result.themeUserSet) {
          setTheme(newTheme)
        }
      })
    })

    // Check for reduced motion preference
    if (prefersReducedMotion()) {
      logDebug("Reduced motion preference detected")
      document.body.classList.add("reduce-motion")
    }

    // Listen for reduced motion preference changes
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
      if (e.matches) {
        document.body.classList.add("reduce-motion")
        logDebug("Reduced motion preference enabled")
      } else {
        document.body.classList.remove("reduce-motion")
        logDebug("Reduced motion preference disabled")
      }
    })
  }

  // Set theme
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

    // Log theme change if in debug mode
    logDebug(`Theme set to: ${theme}`)
  }

  // Toggle theme
  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    // Save the user's preference
    chrome.storage.sync.set({
      theme: newTheme,
      themeUserSet: true, // Flag that user has explicitly set a preference
    })

    setTheme(newTheme)
  }

  // Initialize base ID dropdown
  populateBaseIdDropdown()

  // ADDED: Check if we need to fetch context information
  chrome.storage.local.get(["lastBaseId", "availableContexts"], (result) => {
    const activeBaseId = baseIdDropdown ? baseIdDropdown.value : null

    if (activeBaseId && (!result.lastBaseId || result.lastBaseId !== activeBaseId)) {
      // Need to fetch contexts for the current BASE ID
      fetchContextInformation(activeBaseId)
    } else if (result.availableContexts) {
      // Use cached contexts
      updateContextSelector(result.availableContexts)
    }
  })

  // Initialize theme
  initializeTheme()

  // Check for selected text from context menu
  chrome.storage.local.get(["selectedText"], (result) => {
    if (result.selectedText) {
      // Set the input value to the selected text
      if (userInput) {
        userInput.value = result.selectedText
        userInput.focus()

        // Position cursor at the end of the text
        userInput.selectionStart = userInput.selectionEnd = userInput.value.length

        // Adjust the height of the textarea if needed
        if (userInput.scrollHeight > userInput.clientHeight) {
          userInput.style.height = userInput.scrollHeight + "px"
        }
      }

      // Clear the stored text to avoid showing it again on next popup open
      chrome.storage.local.remove("selectedText")
    }
  })

  // Event listeners
  if (newChatBtn) {
    newChatBtn.addEventListener("click", handleNewChat)
  }

  if (baseIdDropdown) {
    baseIdDropdown.addEventListener("change", () => {
      // Store current input value before changing BASE ID
      const currentInputValue = userInput ? userInput.value : ""

      handleBaseIdChange()

      // Restore input value after BASE ID change is complete
      setTimeout(() => {
        if (userInput && currentInputValue) {
          userInput.value = currentInputValue
        }
      }, 100)
    })
  }

  if (refreshBaseIdsBtn) {
    refreshBaseIdsBtn.addEventListener("click", () => {
      populateBaseIdDropdown()
      showError("BASE ID list refreshed", "info")
    })
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme)
  }

  sendBtn.addEventListener("click", sendMessage)

  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage()
    }
  })

  clearChatBtn.addEventListener("click", () => {
    chatHistory.length = 0 // Clear the array without reassigning
    chrome.storage.local.set({ chatHistory: [] })
    renderChatHistory()
    logDebug("Chat history cleared")
  })

  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage()
  })

  // Dismiss error banner
  if (dismissError) {
    dismissError.addEventListener("click", () => {
      errorBanner.classList.add("hidden")
    })
  }

  // Debug button
  if (debugBtn) {
    debugBtn.addEventListener("click", toggleDebugPanel)
  }

  // Close debug panel
  if (closeDebugBtn) {
    closeDebugBtn.addEventListener("click", () => {
      debugPanel.classList.add("hidden")
    })
  }

  // Clear debug log button
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener("click", clearDebugLog)
  }

  // Auto-scroll debug toggle button
  const autoScrollDebugBtn = document.getElementById("autoScrollDebugBtn")
  if (autoScrollDebugBtn) {
    autoScrollDebugBtn.addEventListener("click", toggleDebugAutoScroll)
  }

  // Scroll to bottom button
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener("click", () => {
      scrollToBottom(chatContainer)
      scrollToBottomBtn.classList.add("hidden")
      userHasScrolled = false
    })
  }

  // Chat container scroll event
  if (chatContainer) {
    chatContainer.addEventListener("scroll", () => {
      userHasScrolled = !isAtBottom(chatContainer)
      updateScrollButtonVisibility()
    })
  }

  // Copy chat ID button
  if (copyChatIdBtn) {
    copyChatIdBtn.addEventListener("click", () => {
      if (currentChatId) {
        navigator.clipboard
          .writeText(currentChatId)
          .then(() => {
            // Visual feedback that the ID was copied
            debugChatIdDisplay.classList.add("flash")
            setTimeout(() => {
              debugChatIdDisplay.classList.remove("flash")
            }, 300)
            logDebug("Chat ID copied to clipboard")
          })
          .catch((err) => {
            logDebug(`Error copying chat ID: ${err.message}`)
          })
      }
    })
  }
})
