# WhatsApp Search Tool

WhatsApp Search Tool is a comprehensive solution for extracting, storing, and searching through WhatsApp Web conversations. It consists of a browser extension for data collection and a desktop application for analyzing and searching through your WhatsApp messages.

![WhatsApp Search Tool](https://github.com/mariusel9911/Whatsapp-search-tool/raw/main/docs/screenshot.png)

## Features

- **Message Extraction**: Captures messages, reactions, and metadata directly from WhatsApp Web
- **Reaction Support**: Tracks and searches for emoji reactions on messages
- **Advanced Search**: Filter messages by:
  - Date range
  - Keywords
  - Chat name
  - Specific reactions
  - Person who reacted
- **Privacy-Focused**: All data is stored locally on your machine
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Components

The project consists of two main components:

1. **Browser Extension**: A Chrome/Firefox extension that extracts messages from WhatsApp Web
2. **Desktop Application**: An Electron-based application for importing and searching through extracted messages

## Installation

### Browser Extension

1. Clone this repository
2. Navigate to the browser-extension directory
3. Load the extension in your browser:
   - Chrome: Open `chrome://extensions/`, enable Developer mode, and click "Load unpacked"
   - Firefox: Open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select the manifest.json file

### Desktop Application

#### Option 1: Install from Source

1. Clone this repository
2. Navigate to the desktop-app directory
3. Install dependencies:
   ```
   npm install
   ```
4. Run the application:
   ```
   npm start
   ```

#### Option 2: Download Installer

Download the latest installer for your platform from the [Releases page](https://github.com/mariusel9911/Whatsapp-search-tool/releases).

## Usage

### Step 1: Extract Data from WhatsApp Web

1. Open WhatsApp Web in your browser (https://web.whatsapp.com/)
2. Activate the WhatsApp Search Tool extension
3. Navigate through conversations you want to extract
4. The extension will automatically collect visible messages and reactions
5. Export the data using the extension popup

### Step 2: Search Through Messages

1. Open the WhatsApp Search Tool desktop application
2. Import the JSON file exported from the browser extension
3. Use the search form to find specific messages based on:
   - Date range
   - Keywords
   - Chat name
   - Presence of reactions
   - Specific reaction emojis
   - Person who reacted
4. View detailed results including the full message context and reactions

## Privacy and Security

- All data is stored locally on your device
- No data is sent to any external servers
- Messages are only captured from conversations you manually navigate to
- Option to automatically delete the database when closing the application

## Development

### Prerequisites

- Node.js 14+ and npm
- Chrome or Firefox for extension development
- Basic knowledge of JavaScript, HTML, and CSS

### Technology Stack

- **Browser Extension**: JavaScript, Chrome Extension API
- **Desktop Application**: Electron, Node.js, Sequelize, SQLite
- **UI**: HTML, CSS, JavaScript

### Building from Source

```bash
# Clone the repository
git clone https://github.com/mariusel9911/Whatsapp-search-tool.git
cd Whatsapp-search-tool

# Install dependencies
npm install

# Run the desktop application
npm start

# Build installers
npm run make
```

## Troubleshooting

- **Message extraction not working**: Make sure you have the latest version of WhatsApp Web open
- **Search results not showing reactions**: Ensure you've imported the latest data from the browser extension
- **Database errors**: Try using the "Reset Database" button in the desktop application

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is not affiliated with, authorized, maintained, sponsored or endorsed by WhatsApp Inc. or any of its affiliates or subsidiaries. This is an independent project that uses WhatsApp's web interface to extract data that is visible to the user. Use at your own discretion.

This tool is meant for personal use only. Please respect privacy and comply with WhatsApp's terms of service when using this tool.

## Acknowledgements

- [Electron](https://www.electronjs.org/)
- [Sequelize](https://sequelize.org/)
- [SQLite](https://www.sqlite.org/)

---

Made by [mariusel9911](https://github.com/mariusel9911)
