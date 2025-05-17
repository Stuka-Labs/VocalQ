// Configuration
const CONFIG = {
  transcriptSelector: '.transcript-container', // Update this with actual selector
  updateInterval: 1000, // Check for updates every second
};

// State
let isCallActive = false;
let lastTranscript = '';
let screenContent = '';

// Initialize speech recognition
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

// Start monitoring when the page loads
window.addEventListener('load', () => {
  // Check if we're on a call platform
  if (isCallPlatform()) {
    startMonitoring();
  }
});

function isCallPlatform() {
  // Add detection logic for various call platforms
  const url = window.location.href;
  return (
    url.includes('zoom.us') ||
    url.includes('meet.google.com') ||
    url.includes('teams.microsoft.com') ||
    url.includes('webex.com')
  );
}

function startMonitoring() {
  // Start speech recognition
  recognition.start();
  
  // Monitor screen content
  observeScreenContent();
  
  // Monitor call status
  observeCallStatus();
}

// Speech recognition handlers
recognition.onresult = (event) => {
  const transcript = Array.from(event.results)
    .map(result => result[0].transcript)
    .join(' ');
  
  if (transcript !== lastTranscript) {
    lastTranscript = transcript;
    sendTranscriptUpdate(transcript);
  }
};

recognition.onerror = (event) => {
  console.error('Speech recognition error:', event.error);
  // Attempt to restart recognition
  setTimeout(() => recognition.start(), 1000);
};

// Screen content monitoring
function observeScreenContent() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        updateScreenContent();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function updateScreenContent() {
  const content = document.body.innerText;
  if (content !== screenContent) {
    screenContent = content;
    sendScreenContent(content);
  }
}

// Call status monitoring
function observeCallStatus() {
  // Platform-specific call status detection
  const checkInterval = setInterval(() => {
    const isInCall = detectCallStatus();
    
    if (isInCall && !isCallActive) {
      handleCallStarted();
    } else if (!isInCall && isCallActive) {
      handleCallEnded();
    }
  }, 1000);
}

function detectCallStatus() {
  // Add platform-specific detection logic
  const url = window.location.href;
  
  if (url.includes('zoom.us')) {
    return document.querySelector('.participants-avatar') !== null;
  } else if (url.includes('meet.google.com')) {
    return document.querySelector('[data-is-call-started="true"]') !== null;
  } else if (url.includes('teams.microsoft.com')) {
    return document.querySelector('.ts-calling-screen') !== null;
  } else if (url.includes('webex.com')) {
    return document.querySelector('.in-call') !== null;
  }
  
  return false;
}

// Event handlers
function handleCallStarted() {
  isCallActive = true;
  
  // Extract call metadata
  const callData = {
    customerName: extractCustomerName(),
    customerPhone: extractCustomerPhone(),
    platform: detectCallPlatform()
  };
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'CALL_STARTED',
    data: callData
  });
}

function handleCallEnded() {
  isCallActive = false;
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'CALL_ENDED'
  });
}

function sendTranscriptUpdate(transcript) {
  chrome.runtime.sendMessage({
    type: 'TRANSCRIPT_UPDATE',
    data: transcript
  });
}

function sendScreenContent(content) {
  chrome.runtime.sendMessage({
    type: 'SCREEN_CONTENT',
    data: content
  });
}

// Helper functions
function extractCustomerName() {
  // Add platform-specific logic to extract customer name
  const url = window.location.href;
  
  if (url.includes('zoom.us')) {
    return document.querySelector('.participants-name')?.textContent || 'Unknown';
  } else if (url.includes('meet.google.com')) {
    return document.querySelector('.zWfAib')?.textContent || 'Unknown';
  }
  
  return 'Unknown';
}

function extractCustomerPhone() {
  // Add platform-specific logic to extract customer phone
  const url = window.location.href;
  
  if (url.includes('zoom.us')) {
    return document.querySelector('.participants-phone')?.textContent || 'Unknown';
  }
  
  return 'Unknown';
}

function detectCallPlatform() {
  const url = window.location.href;
  
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('teams.microsoft.com')) return 'teams';
  if (url.includes('webex.com')) return 'webex';
  
  return 'unknown';
}

// Listen for real-time feedback
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REAL_TIME_FEEDBACK') {
    displayFeedback(message.data);
  }
});

function displayFeedback(feedback) {
  // Create or update feedback element
  let feedbackElement = document.getElementById('vocalq-feedback');
  
  if (!feedbackElement) {
    feedbackElement = document.createElement('div');
    feedbackElement.id = 'vocalq-feedback';
    feedbackElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9999;
      max-width: 300px;
      font-family: Arial, sans-serif;
    `;
    document.body.appendChild(feedbackElement);
  }
  
  feedbackElement.innerHTML = `
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">AI Coaching Feedback</h3>
    <p style="margin: 0; font-size: 14px;">${feedback}</p>
  `;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    feedbackElement.style.opacity = '0';
    feedbackElement.style.transition = 'opacity 0.5s';
    setTimeout(() => feedbackElement.remove(), 500);
  }, 5000);
}

// Initialize
console.log('VocalQ AI Call Coach: Content script loaded'); 