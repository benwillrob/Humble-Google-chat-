# Humble AI for Google Chat

This application integrates Humble AI with Google Chat, allowing users to interact with Humble AI directly within their Google Chat workspace.

## Features

- Chat with Humble AI directly in Google Chat
- Configure API keys and BASE IDs through chat commands
- Manage multiple BASE IDs
- Start new chat sessions
- View configuration and help information

## Setup Instructions

### Prerequisites

1. A Google Cloud Platform account
2. A Google Workspace account with admin privileges
3. A Humble AI account with API key and BASE ID

### Deployment Steps

1. **Create a Google Cloud Project**

   \`\`\`bash
   gcloud projects create humble-chat-bot --name="Humble AI Chat Bot"
   gcloud config set project humble-chat-bot
   \`\`\`

2. **Enable Required APIs**

   \`\`\`bash
   gcloud services enable chat.googleapis.com
   gcloud services enable cloudfunctions.googleapis.com
   gcloud services enable firestore.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   \`\`\`

3. **Initialize Firestore**

   \`\`\`bash
   gcloud app create --region=us-central
   gcloud firestore databases create --region=us-central
   \`\`\`

4. **Deploy the Cloud Function**

   \`\`\`bash
   npm install
   npm run build
   npm run deploy
   \`\`\`

5. **Configure Google Chat API**

   - Go to the [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to "APIs & Services" > "Credentials"
   - Create an OAuth 2.0 Client ID for a Web Application
   - Add the necessary scopes for Google Chat API
   - Download the credentials JSON file

6. **Register the Chat Bot**

   - Go to the [Google Chat API Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat)
   - Click "Configure"
   - Fill in the bot details:
     - Name: Humble AI
     - Avatar URL: (Upload a logo for Humble AI)
     - Description: Chat with Humble AI directly in Google Chat
     - Functionality: Bot works in direct messages and rooms
     - Connection settings: Select "Cloud Function" and enter the URL of your deployed function
     - Permissions: Select appropriate permissions (typically "Specific people and groups in your domain")
   - Add slash commands:
     - `/help` - Show help information
     - `/setup` - Configure API key and BASE IDs
     - `/config` - View current configuration
     - `/clear` - Start a new chat session
   - Click "Save"

7. **Install the Bot in Google Workspace**

   - Go to the [Google Workspace Admin Console](https://admin.google.com)
   - Navigate to "Apps" > "Google Workspace Marketplace apps"
   - Click "Add app" > "Add custom app"
   - Enter the app name and select the appropriate users who should have access
   - Click "Add"

## Usage

### Basic Commands

- `/help` - Show help information
- `/setup` - Configure API key and BASE IDs
- `/config` - View current configuration
- `/clear` - Start a new chat session

### Chatting with Humble AI

- In direct messages, simply type your question
- In rooms, mention the bot: `@Humble AI what is machine learning?`

### Configuration

Before using the bot, you need to configure your API key and at least one BASE ID:

1. Type `/setup` to start the configuration process
2. Enter your Humble AI API key
3. Add at least one BASE ID with a name and value
4. The first BASE ID you add will be set as the default

## Security Considerations

- API keys are stored in Firestore and are specific to each Google Chat space
- For enhanced security, consider using Google Cloud Secret Manager to store API keys
- The application uses Google's authentication mechanisms to ensure only authorized users can access the bot

## Troubleshooting

- If the bot doesn't respond, check the Cloud Function logs for errors
- Ensure the API key and BASE ID are correctly configured
- Verify that the bot has been properly installed in your Google Workspace

## Support

For issues or questions, please contact your system administrator or the developer of this integration.
# Humble-Google-Chat-
