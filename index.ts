import { google } from "googleapis"
import type { HttpFunction } from "@google-cloud/functions-framework"
import { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import { Firestore } from "@google-cloud/firestore"

// Initialize Firestore for storing workspace configurations
const firestore = new Firestore()

// Initialize Secret Manager for secure API key storage
const secretManager = new SecretManagerServiceClient()

// Define types for Google Chat messages
interface ChatEvent {
  type: string
  message?: {
    name: string
    sender: {
      name: string
      displayName: string
      email: string
    }
    space: {
      name: string
      type: string
    }
    text: string
    thread?: {
      name: string
    }
    annotations?: Array<{
      type: string
      startIndex: number
      length: number
      userMention?: {
        user: {
          name: string
          displayName: string
        }
        type: string
      }
    }>
    slashCommand?: {
      commandId: string
    }
    argumentText?: string
  }
  user: {
    name: string
    displayName: string
    email: string
  }
  space: {
    name: string
    type: string
  }
  configCompleteRedirectUrl?: string
}

// Define types for Humble AI API responses
interface HumbleAIResponse {
  id?: string
  content?: string
  prompt?: string
  [key: string]: any
}

// Define types for workspace configuration
interface WorkspaceConfig {
  apiKey?: string
  baseIds?: Array<{
    name: string
    id: string
    isDefault?: boolean
  }>
  activeBaseId?: string
}

/**
 * Main HTTP function that handles incoming Google Chat messages
 */
export const humbleChatBot: HttpFunction = async (req, res) => {
  try {
    const event = req.body as ChatEvent
    console.log("Received event:", JSON.stringify(event, null, 2))

    // Handle different event types
    if (event.type === "ADDED_TO_SPACE") {
      res.json(handleAddedToSpace(event))
      return
    } else if (event.type === "REMOVED_FROM_SPACE") {
      res.json({ text: "Bot was removed from the space." })
      return
    } else if (event.type === "MESSAGE") {
      const response = await handleMessage(event)
      res.json(response)
      return
    } else if (event.type === "CARD_CLICKED") {
      const response = await handleCardClick(event)
      res.json(response)
      return
    }

    // Default response for unhandled event types
    res.json({ text: "Unhandled event type." })
  } catch (error) {
    console.error("Error handling request:", error)
    res.status(500).json({
      text: `Error processing request: ${error instanceof Error ? error.message : "Unknown error"}`,
    })
  }
}

/**
 * Handle when the bot is added to a space
 */
function handleAddedToSpace(event: ChatEvent) {
  const senderName = event.user.displayName

  if (event.space.type === "DM") {
    return {
      text: `Hi ${senderName}! I'm Humble AI Bot. You can ask me questions or use commands like \`/help\` to learn more.`,
    }
  } else {
    return {
      text: `Hi everyone! I'm Humble AI Bot. Mention me in a message or use commands like \`@Humble AI /help\` to interact with me.`,
    }
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(event: ChatEvent): Promise<any> {
  if (!event.message) {
    return { text: "Invalid message event." }
  }

  const messageText = event.message.text || ""
  const spaceId = event.space.name
  const userId = event.user.email

  // Check if this is a slash command
  if (event.message.slashCommand) {
    return handleSlashCommand(event)
  }

  // Check if this is a direct message or if the bot was mentioned
  const isBotMentioned = event.message.annotations?.some(
    (annotation) => annotation.type === "USER_MENTION" && annotation.userMention?.type === "BOT",
  )

  const isDM = event.space.type === "DM"

  if (!isDM && !isBotMentioned) {
    // In a room but not mentioned, do nothing
    return {}
  }

  // Process the message text (remove bot mention if present)
  let cleanedText = messageText
  if (isBotMentioned && event.message.annotations) {
    for (const annotation of event.message.annotations) {
      if (annotation.type === "USER_MENTION") {
        cleanedText = cleanedText
          .replace(messageText.substring(annotation.startIndex, annotation.startIndex + annotation.length), "")
          .trim()
      }
    }
  }

  // Get workspace configuration
  const config = await getWorkspaceConfig(spaceId)

  if (!config.apiKey || !config.activeBaseId) {
    return createSetupCard(spaceId, userId)
  }

  // Show typing indicator
  await sendTypingIndicator(event)

  try {
    // Send message to Humble AI
    const response = await sendToHumbleAI(cleanedText, config)
    return formatHumbleResponse(response)
  } catch (error) {
    console.error("Error sending message to Humble AI:", error)
    return {
      text: `Error communicating with Humble AI: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(event: ChatEvent): Promise<any> {
  if (!event.message || !event.message.slashCommand) {
    return { text: "Invalid slash command event." }
  }

  const commandId = event.message.slashCommand.commandId
  const argumentText = event.message.argumentText?.trim() || ""
  const spaceId = event.space.name
  const userId = event.user.email

  switch (commandId) {
    case "1": // Help command
      return createHelpCard()

    case "2": // Setup command
      return createSetupCard(spaceId, userId)

    case "3": // Config command
      return await handleConfigCommand(spaceId, userId, argumentText)

    case "4": // Clear command
      return await handleClearCommand(spaceId, userId)

    default:
      return { text: "Unknown command. Try /help to see available commands." }
  }
}

/**
 * Handle card click events
 */
async function handleCardClick(event: any): Promise<any> {
  const action = event.action

  if (!action || !action.actionMethodName) {
    return { text: "Invalid card action." }
  }

  const methodName = action.actionMethodName
  const parameters = action.parameters || []

  switch (methodName) {
    case "saveApiKey":
      return await handleSaveApiKey(getParameterValue(parameters, "spaceId"), getParameterValue(parameters, "apiKey"))

    case "saveBaseId":
      return await handleSaveBaseId(
        getParameterValue(parameters, "spaceId"),
        getParameterValue(parameters, "baseIdName"),
        getParameterValue(parameters, "baseIdValue"),
      )

    case "setDefaultBaseId":
      return await handleSetDefaultBaseId(
        getParameterValue(parameters, "spaceId"),
        getParameterValue(parameters, "baseIdValue"),
      )

    case "deleteBaseId":
      return await handleDeleteBaseId(
        getParameterValue(parameters, "spaceId"),
        getParameterValue(parameters, "baseIdValue"),
      )

    case "newChat":
      return await handleNewChat(getParameterValue(parameters, "spaceId"))

    default:
      return { text: "Unknown action." }
  }
}

/**
 * Helper function to get parameter value from card action
 */
function getParameterValue(parameters: Array<{ key: string; value: string }>, key: string): string {
  const param = parameters.find((p) => p.key === key)
  return param ? param.value : ""
}

/**
 * Send a typing indicator to Google Chat
 */
async function sendTypingIndicator(event: ChatEvent): Promise<void> {
  try {
    const auth = await google.auth.getClient({
      scopes: ["https://www.googleapis.com/auth/chat.bot"],
    })

    const chat = google.chat({
      version: "v1",
      auth,
    })

    await chat.spaces.messages.create({
      parent: event.space.name,
      requestBody: {
        text: "",
        thread: event.message?.thread ? { name: event.message.thread.name } : undefined,
        actionResponse: {
          type: "TYPING",
        },
      },
    })
  } catch (error) {
    console.error("Error sending typing indicator:", error)
    // Continue even if typing indicator fails
  }
}

/**
 * Get workspace configuration from Firestore
 */
async function getWorkspaceConfig(spaceId: string): Promise<WorkspaceConfig> {
  const docRef = firestore.collection("workspaceConfigs").doc(spaceId)
  const doc = await docRef.get()

  if (!doc.exists) {
    return {}
  }

  return doc.data() as WorkspaceConfig
}

/**
 * Save workspace configuration to Firestore
 */
async function saveWorkspaceConfig(spaceId: string, config: WorkspaceConfig): Promise<void> {
  const docRef = firestore.collection("workspaceConfigs").doc(spaceId)
  await docRef.set(config, { merge: true })
}

/**
 * Send message to Humble AI API
 */
async function sendToHumbleAI(message: string, config: WorkspaceConfig): Promise<any> {
  if (!config.apiKey || !config.activeBaseId) {
    throw new Error("API key or BASE ID not configured")
  }

  try {
    // Check if we have an existing chat ID for this space
    const chatId = await getChatId(config.activeBaseId)

    if (!chatId) {
      // Create a new chat
      const newChatId = await createNewChat(config.apiKey, config.activeBaseId)
      await saveChatId(config.activeBaseId, newChatId)

      // Send message to the new chat
      return await postMessage(config.apiKey, newChatId, message)
    } else {
      // Send message to existing chat
      return await postMessage(config.apiKey, chatId, message)
    }
  } catch (error) {
    console.error("Error communicating with Humble AI:", error)
    throw error
  }
}

/**
 * Create a new chat with Humble AI
 */
async function createNewChat(apiKey: string, baseId: string): Promise<string> {
  const url = `https://platform.thehumbleai.com/api/assistant/chats/${baseId}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create chat: ${response.status} ${errorText}`)
  }

  const data = await response.json()

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

  return chatId
}

/**
 * Post a message to an existing Humble AI chat
 */
async function postMessage(apiKey: string, chatId: string, message: string): Promise<any> {
  const url = `https://platform.thehumbleai.com/api/assistant/messages/${chatId}`

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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to post message: ${response.status} ${errorText}`)
  }

  return await response.json()
}

/**
 * Get stored chat ID from Firestore
 */
async function getChatId(baseId: string): Promise<string | null> {
  const docRef = firestore.collection("chatSessions").doc(baseId)
  const doc = await docRef.get()

  if (!doc.exists || !doc.data()?.chatId) {
    return null
  }

  return doc.data()?.chatId
}

/**
 * Save chat ID to Firestore
 */
async function saveChatId(baseId: string, chatId: string): Promise<void> {
  const docRef = firestore.collection("chatSessions").doc(baseId)
  await docRef.set({ chatId, updatedAt: new Date() })
}

/**
 * Format Humble AI response for Google Chat
 */
function formatHumbleResponse(response: any): any {
  try {
    // Extract the assistant's response
    let assistantContent = ""

    if (Array.isArray(response) && response.length >= 2) {
      // The second element should be the assistant's response
      const assistantResponse = response[1]

      if (assistantResponse.content) {
        try {
          // Try to parse the content as JSON
          const parsedContent = JSON.parse(assistantResponse.content)

          // Extract the prompt field which contains the actual response
          if (parsedContent && parsedContent.prompt) {
            assistantContent = parsedContent.prompt
          } else {
            // If no prompt field, use the raw content
            assistantContent = assistantResponse.content
          }
        } catch (parseError) {
          // If parsing fails, use the raw content
          assistantContent = assistantResponse.content
        }
      } else {
        assistantContent = "No response content available"
      }
    } else if (response.content) {
      // Handle single object response
      try {
        const parsedContent = JSON.parse(response.content)
        if (parsedContent && parsedContent.prompt) {
          assistantContent = parsedContent.prompt
        } else {
          assistantContent = response.content
        }
      } catch (parseError) {
        assistantContent = response.content
      }
    } else if (response.prompt) {
      // Direct prompt field
      assistantContent = response.prompt
    } else {
      assistantContent = "Received response in an unexpected format"
    }

    // Format the response for Google Chat
    return {
      text: assistantContent,
    }
  } catch (error) {
    console.error("Error formatting Humble AI response:", error)
    return {
      text: "Error processing the response from Humble AI.",
    }
  }
}

/**
 * Create a help card for Google Chat
 */
function createHelpCard(): any {
  return {
    cards: [
      {
        header: {
          title: "Humble AI Help",
          subtitle: "Available commands and usage",
          imageUrl: "https://storage.googleapis.com/humble-ai-assets/humble-logo.png",
        },
        sections: [
          {
            header: "Commands",
            widgets: [
              {
                textParagraph: {
                  text: "<b>/help</b> - Show this help message",
                },
              },
              {
                textParagraph: {
                  text: "<b>/setup</b> - Configure API key and BASE IDs",
                },
              },
              {
                textParagraph: {
                  text: "<b>/config</b> - View current configuration",
                },
              },
              {
                textParagraph: {
                  text: "<b>/clear</b> - Start a new chat session",
                },
              },
            ],
          },
          {
            header: "Usage",
            widgets: [
              {
                textParagraph: {
                  text: "In direct messages, simply type your question.",
                },
              },
              {
                textParagraph: {
                  text: "In rooms, mention the bot: <b>@Humble AI what is machine learning?</b>",
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Create a setup card for Google Chat
 */
function createSetupCard(spaceId: string, userId: string): any {
  return {
    cards: [
      {
        header: {
          title: "Humble AI Setup",
          subtitle: "Configure your API key and BASE IDs",
          imageUrl: "https://storage.googleapis.com/humble-ai-assets/humble-logo.png",
        },
        sections: [
          {
            widgets: [
              {
                textParagraph: {
                  text: "To use Humble AI, you need to configure your API key and at least one BASE ID.",
                },
              },
            ],
          },
          {
            header: "API Key",
            widgets: [
              {
                textInput: {
                  label: "Enter your Humble AI API Key",
                  type: "PASSWORD",
                  name: "apiKey",
                },
              },
              {
                buttonList: {
                  buttons: [
                    {
                      text: "Save API Key",
                      onClick: {
                        action: {
                          actionMethodName: "saveApiKey",
                          parameters: [
                            {
                              key: "spaceId",
                              value: spaceId,
                            },
                            {
                              key: "apiKey",
                              value: "${apiKey}",
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
          {
            header: "BASE ID",
            widgets: [
              {
                textInput: {
                  label: "BASE ID Name",
                  name: "baseIdName",
                },
              },
              {
                textInput: {
                  label: "BASE ID Value",
                  name: "baseIdValue",
                },
              },
              {
                buttonList: {
                  buttons: [
                    {
                      text: "Add BASE ID",
                      onClick: {
                        action: {
                          actionMethodName: "saveBaseId",
                          parameters: [
                            {
                              key: "spaceId",
                              value: spaceId,
                            },
                            {
                              key: "baseIdName",
                              value: "${baseIdName}",
                            },
                            {
                              key: "baseIdValue",
                              value: "${baseIdValue}",
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Handle saving API key
 */
async function handleSaveApiKey(spaceId: string, apiKey: string): Promise<any> {
  if (!apiKey) {
    return {
      text: "API key cannot be empty.",
    }
  }

  try {
    // Save API key to workspace config
    await saveWorkspaceConfig(spaceId, { apiKey })

    return {
      text: "API key saved successfully! Now add a BASE ID to complete setup.",
    }
  } catch (error) {
    console.error("Error saving API key:", error)
    return {
      text: `Error saving API key: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle saving BASE ID
 */
async function handleSaveBaseId(spaceId: string, baseIdName: string, baseIdValue: string): Promise<any> {
  if (!baseIdName || !baseIdValue) {
    return {
      text: "BASE ID name and value cannot be empty.",
    }
  }

  try {
    // Get current config
    const config = await getWorkspaceConfig(spaceId)

    // Initialize baseIds array if it doesn't exist
    if (!config.baseIds) {
      config.baseIds = []
    }

    // Check if this BASE ID already exists
    const existingIndex = config.baseIds.findIndex((b) => b.id === baseIdValue)
    if (existingIndex >= 0) {
      return {
        text: "A BASE ID with this value already exists.",
      }
    }

    // Add the new BASE ID
    const isFirst = config.baseIds.length === 0
    config.baseIds.push({
      name: baseIdName,
      id: baseIdValue,
      isDefault: isFirst,
    })

    // If this is the first BASE ID, set it as active
    if (isFirst) {
      config.activeBaseId = baseIdValue
    }

    // Save updated config
    await saveWorkspaceConfig(spaceId, config)

    return {
      text: `BASE ID "${baseIdName}" added successfully!${isFirst ? " It has been set as the default." : ""}`,
    }
  } catch (error) {
    console.error("Error saving BASE ID:", error)
    return {
      text: `Error saving BASE ID: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle setting default BASE ID
 */
async function handleSetDefaultBaseId(spaceId: string, baseIdValue: string): Promise<any> {
  try {
    // Get current config
    const config = await getWorkspaceConfig(spaceId)

    if (!config.baseIds || config.baseIds.length === 0) {
      return {
        text: "No BASE IDs configured.",
      }
    }

    // Find the BASE ID
    const baseIdIndex = config.baseIds.findIndex((b) => b.id === baseIdValue)
    if (baseIdIndex < 0) {
      return {
        text: "BASE ID not found.",
      }
    }

    // Update all BASE IDs to not be default
    config.baseIds = config.baseIds.map((baseId) => ({
      ...baseId,
      isDefault: false,
    }))

    // Set the selected one as default
    config.baseIds[baseIdIndex].isDefault = true

    // Set as active BASE ID
    config.activeBaseId = baseIdValue

    // Save updated config
    await saveWorkspaceConfig(spaceId, config)

    return {
      text: `BASE ID "${config.baseIds[baseIdIndex].name}" set as default.`,
    }
  } catch (error) {
    console.error("Error setting default BASE ID:", error)
    return {
      text: `Error setting default BASE ID: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle deleting BASE ID
 */
async function handleDeleteBaseId(spaceId: string, baseIdValue: string): Promise<any> {
  try {
    // Get current config
    const config = await getWorkspaceConfig(spaceId)

    if (!config.baseIds || config.baseIds.length === 0) {
      return {
        text: "No BASE IDs configured.",
      }
    }

    // Find the BASE ID
    const baseIdIndex = config.baseIds.findIndex((b) => b.id === baseIdValue)
    if (baseIdIndex < 0) {
      return {
        text: "BASE ID not found.",
      }
    }

    const deletedBaseId = config.baseIds[baseIdIndex]
    const wasDefault = deletedBaseId.isDefault

    // Remove the BASE ID
    config.baseIds.splice(baseIdIndex, 1)

    // If we're deleting the active BASE ID, reset it
    if (config.activeBaseId === baseIdValue) {
      config.activeBaseId = config.baseIds.length > 0 ? config.baseIds[0].id : undefined
    }

    // If we're deleting the default BASE ID, set a new default if possible
    if (wasDefault && config.baseIds.length > 0) {
      config.baseIds[0].isDefault = true
    }

    // Save updated config
    await saveWorkspaceConfig(spaceId, config)

    return {
      text: `BASE ID "${deletedBaseId.name}" deleted successfully.`,
    }
  } catch (error) {
    console.error("Error deleting BASE ID:", error)
    return {
      text: `Error deleting BASE ID: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle new chat command
 */
async function handleNewChat(spaceId: string): Promise<any> {
  try {
    // Get current config
    const config = await getWorkspaceConfig(spaceId)

    if (!config.apiKey || !config.activeBaseId) {
      return createSetupCard(spaceId, "")
    }

    // Clear the current chat ID
    await saveChatId(config.activeBaseId, "")

    return {
      text: "Started a new chat session. You can now ask me a question!",
    }
  } catch (error) {
    console.error("Error starting new chat:", error)
    return {
      text: `Error starting new chat: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle config command
 */
async function handleConfigCommand(spaceId: string, userId: string, argumentText: string): Promise<any> {
  try {
    // Get current config
    const config = await getWorkspaceConfig(spaceId)

    if (!config.apiKey) {
      return createSetupCard(spaceId, userId)
    }

    // Create a card to display and manage configuration
    return {
      cards: [
        {
          header: {
            title: "Humble AI Configuration",
            subtitle: "Current settings",
            imageUrl: "https://storage.googleapis.com/humble-ai-assets/humble-logo.png",
          },
          sections: [
            {
              header: "API Key",
              widgets: [
                {
                  textParagraph: {
                    text: `API Key: ${config.apiKey ? "••••••••••••••••" : "Not configured"}`,
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "Update API Key",
                        onClick: {
                          action: {
                            actionMethodName: "updateApiKey",
                            parameters: [
                              {
                                key: "spaceId",
                                value: spaceId,
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
            {
              header: "BASE IDs",
              widgets: [
                ...(config.baseIds && config.baseIds.length > 0
                  ? config.baseIds.map((baseId) => ({
                      decoratedText: {
                        text: `${baseId.name} ${baseId.isDefault ? "(Default)" : ""}`,
                        startIcon: {
                          knownIcon: "DESCRIPTION",
                        },
                        bottomLabel: baseId.id,
                      },
                    }))
                  : [
                      {
                        textParagraph: {
                          text: "No BASE IDs configured",
                        },
                      },
                    ]),
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "Add BASE ID",
                        onClick: {
                          action: {
                            actionMethodName: "addBaseId",
                            parameters: [
                              {
                                key: "spaceId",
                                value: spaceId,
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
            {
              header: "Actions",
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "New Chat",
                        onClick: {
                          action: {
                            actionMethodName: "newChat",
                            parameters: [
                              {
                                key: "spaceId",
                                value: spaceId,
                              },
                            ],
                          },
                        },
                      },
                      {
                        text: "Manage BASE IDs",
                        onClick: {
                          action: {
                            actionMethodName: "manageBaseIds",
                            parameters: [
                              {
                                key: "spaceId",
                                value: spaceId,
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }
  } catch (error) {
    console.error("Error handling config command:", error)
    return {
      text: `Error retrieving configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Handle clear command
 */
async function handleClearCommand(spaceId: string, userId: string): Promise<any> {
  try {
    // Get current config
    const config = await getWorkspaceConfig(spaceId)

    if (!config.apiKey || !config.activeBaseId) {
      return createSetupCard(spaceId, userId)
    }

    // Clear the current chat ID
    await saveChatId(config.activeBaseId, "")

    return {
      text: "Chat history cleared. You can now start a new conversation!",
    }
  } catch (error) {
    console.error("Error clearing chat:", error)
    return {
      text: `Error clearing chat: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}
