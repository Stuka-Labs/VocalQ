// Initialize Firebase
importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-auth-compat.js');

const firebaseConfig = {
  // Your Firebase config here
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM Elements
const statusElement = document.getElementById('status');
const scriptAdherenceElement = document.getElementById('scriptAdherence');
const objectionHandlingElement = document.getElementById('objectionHandling');
const talkingPointsElement = document.getElementById('talkingPoints');
const feedbackElement = document.getElementById('feedback');
const toggleMonitoringButton = document.getElementById('toggleMonitoring');
const viewHistoryButton = document.getElementById('viewHistory');

// State
let isMonitoring = false;
let currentCallId = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const user = await auth.currentUser;
  if (!user) {
    showLoginPrompt();
    return;
  }

  // Check if we're on a call platform
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isCallPlatform = isOnCallPlatform(tab.url);
  
  toggleMonitoringButton.disabled = !isCallPlatform;
  if (!isCallPlatform) {
    statusElement.textContent = 'Not on a supported call platform';
  }

  // Load current call data if monitoring
  if (isMonitoring) {
    loadCurrentCallData();
  }
});

// Event Listeners
toggleMonitoringButton.addEventListener('click', async () => {
  if (!isMonitoring) {
    startMonitoring();
  } else {
    stopMonitoring();
  }
});

viewHistoryButton.addEventListener('click', () => {
  chrome.tabs.create({ url: 'history.html' });
});

// Functions
function isOnCallPlatform(url) {
  return (
    url.includes('zoom.us') ||
    url.includes('meet.google.com') ||
    url.includes('teams.microsoft.com') ||
    url.includes('webex.com')
  );
}

async function startMonitoring() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Send message to content script
  chrome.tabs.sendMessage(tab.id, { type: 'START_MONITORING' }, (response) => {
    if (response && response.success) {
      isMonitoring = true;
      updateUI(true);
      loadCurrentCallData();
    }
  });
}

async function stopMonitoring() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Send message to content script
  chrome.tabs.sendMessage(tab.id, { type: 'STOP_MONITORING' }, (response) => {
    if (response && response.success) {
      isMonitoring = false;
      updateUI(false);
    }
  });
}

function updateUI(isActive) {
  statusElement.textContent = isActive ? 'Monitoring active' : 'Not monitoring';
  statusElement.className = `status ${isActive ? 'active' : 'inactive'}`;
  toggleMonitoringButton.textContent = isActive ? 'Stop Monitoring' : 'Start Monitoring';
}

async function loadCurrentCallData() {
  if (!currentCallId) return;

  try {
    const callDoc = await db.collection('calls').doc(currentCallId).get();
    if (callDoc.exists) {
      const callData = callDoc.data();
      updateMetrics(callData.metrics);
      updateFeedback(callData.realTimeFeedback);
    }
  } catch (error) {
    console.error('Error loading call data:', error);
  }
}

function updateMetrics(metrics) {
  scriptAdherenceElement.textContent = `${metrics.scriptAdherence}%`;
  objectionHandlingElement.textContent = `${metrics.objectionHandling}%`;
  talkingPointsElement.textContent = `${metrics.talkingPointsCovered}/${metrics.totalTalkingPoints}`;
}

function updateFeedback(feedback) {
  feedbackElement.innerHTML = feedback
    .slice(-5) // Show last 5 feedback items
    .map(item => `
      <div class="feedback-item">
        <div class="feedback-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
        <div class="feedback-content">${item.feedback}</div>
      </div>
    `)
    .join('');
}

function showLoginPrompt() {
  statusElement.textContent = 'Please log in to use VocalQ';
  toggleMonitoringButton.disabled = true;
  viewHistoryButton.disabled = true;
}

// Listen for real-time updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CALL_STARTED') {
    currentCallId = message.data.callId;
    updateUI(true);
  } else if (message.type === 'CALL_ENDED') {
    currentCallId = null;
    updateUI(false);
  } else if (message.type === 'METRICS_UPDATE') {
    updateMetrics(message.data);
  } else if (message.type === 'FEEDBACK_UPDATE') {
    updateFeedback(message.data);
  }
}); 