# VocalQ AI Call Coach

A Chrome extension that provides AI-powered coaching for PBX system calls. The extension listens to live calls, transcribes them in real-time, and provides actionable feedback to sales representatives.

## Features

- Real-time call transcription monitoring
- AI-powered analysis of sales conversations
- Instant feedback and coaching suggestions
- Call duration tracking
- Performance scoring
- Historical analysis storage

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   cd firebase/functions
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the `firebase/functions` directory with:
     ```
     OPENAI_API_KEY=your_openai_api_key
     ```

4. Deploy Firebase Functions:
   ```bash
   firebase deploy --only functions
   ```

5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `vocalq-extension` directory

## Usage

1. Navigate to your PBX system website
2. Click the VocalQ extension icon in your browser toolbar
3. Toggle "Enable AI Coaching" to start monitoring calls
4. Receive real-time feedback and coaching suggestions during calls
5. View call duration and performance score in the popup

## Development

- `manifest.json`: Extension configuration
- `content.js`: Handles transcript monitoring
- `background.js`: Manages transcript processing and Firebase communication
- `popup.html/js/css`: Extension popup interface
- `firebase/functions/index.js`: Cloud Functions for transcript analysis

## Security

- All API keys are stored securely in Firebase environment variables
- Transcripts are processed securely through Firebase Cloud Functions
- No sensitive data is stored locally

## License

MIT License 