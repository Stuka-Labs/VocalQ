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
const dateRangeSelect = document.getElementById('dateRange');
const platformSelect = document.getElementById('platform');
const scoreSelect = document.getElementById('score');
const avgScoreElement = document.getElementById('avgScore');
const totalCallsElement = document.getElementById('totalCalls');
const totalDurationElement = document.getElementById('totalDuration');
const scriptAdherenceElement = document.getElementById('scriptAdherence');
const callsTableBody = document.getElementById('callsTableBody');
const prevPageButton = document.getElementById('prevPage');
const nextPageButton = document.getElementById('nextPage');

// State
let currentPage = 1;
const pageSize = 10;
let lastVisible = null;
let firstVisible = null;
let totalCalls = 0;
let totalDuration = 0;
let totalScore = 0;
let totalScriptAdherence = 0;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const user = await auth.currentUser;
  if (!user) {
    showLoginPrompt();
    return;
  }

  // Load initial data
  loadCalls();
  loadStats();

  // Add event listeners
  dateRangeSelect.addEventListener('change', handleFilterChange);
  platformSelect.addEventListener('change', handleFilterChange);
  scoreSelect.addEventListener('change', handleFilterChange);
  prevPageButton.addEventListener('click', () => loadPreviousPage());
  nextPageButton.addEventListener('click', () => loadNextPage());
});

// Functions
async function loadCalls() {
  try {
    showLoading();
    
    let query = db.collection('calls')
      .where('userId', '==', auth.currentUser.uid)
      .where('status', '==', 'completed')
      .orderBy('endTime', 'desc')
      .limit(pageSize);

    // Apply filters
    query = applyFilters(query);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      showNoResults();
      return;
    }

    // Update pagination state
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    firstVisible = snapshot.docs[0];
    
    // Render calls
    renderCalls(snapshot.docs);
    
    // Update pagination buttons
    updatePaginationButtons();
    
  } catch (error) {
    console.error('Error loading calls:', error);
    showError('Failed to load calls. Please try again.');
  }
}

async function loadStats() {
  try {
    let query = db.collection('calls')
      .where('userId', '==', auth.currentUser.uid)
      .where('status', '==', 'completed');

    // Apply filters
    query = applyFilters(query);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      resetStats();
      return;
    }

    // Calculate stats
    totalCalls = snapshot.size;
    totalDuration = 0;
    totalScore = 0;
    totalScriptAdherence = 0;

    snapshot.forEach(doc => {
      const call = doc.data();
      totalDuration += call.duration || 0;
      totalScore += call.finalScore || 0;
      totalScriptAdherence += call.metrics?.scriptAdherence || 0;
    });

    // Update UI
    updateStats();

  } catch (error) {
    console.error('Error loading stats:', error);
    showError('Failed to load statistics. Please try again.');
  }
}

function applyFilters(query) {
  // Date range filter
  const dateRange = parseInt(dateRangeSelect.value);
  if (dateRange) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    query = query.where('endTime', '>=', startDate);
  }

  // Platform filter
  const platform = platformSelect.value;
  if (platform !== 'all') {
    query = query.where('platform', '==', platform);
  }

  // Score filter
  const minScore = parseInt(scoreSelect.value);
  if (minScore > 0) {
    query = query.where('finalScore', '>=', minScore);
  }

  return query;
}

function renderCalls(calls) {
  callsTableBody.innerHTML = calls.map(call => {
    const data = call.data();
    return `
      <tr>
        <td>${formatDate(data.endTime)}</td>
        <td>${data.customerName || 'Unknown'}</td>
        <td>${formatPlatform(data.platform)}</td>
        <td>${formatDuration(data.duration)}</td>
        <td>
          <span class="score ${getScoreClass(data.finalScore)}">
            ${data.finalScore?.toFixed(1) || '-'}
          </span>
        </td>
        <td>${data.metrics?.scriptAdherence?.toFixed(1) || '-'}%</td>
        <td>
          <a href="#" class="view-details" data-call-id="${call.id}">
            View Details
          </a>
        </td>
      </tr>
    `;
  }).join('');

  // Add click handlers for details
  document.querySelectorAll('.view-details').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const callId = e.target.dataset.callId;
      showCallDetails(callId);
    });
  });
}

function updateStats() {
  avgScoreElement.textContent = (totalScore / totalCalls).toFixed(1);
  totalCallsElement.textContent = totalCalls;
  totalDurationElement.textContent = formatDuration(totalDuration);
  scriptAdherenceElement.textContent = (totalScriptAdherence / totalCalls).toFixed(1) + '%';
}

function resetStats() {
  avgScoreElement.textContent = '-';
  totalCallsElement.textContent = '0';
  totalDurationElement.textContent = '0:00';
  scriptAdherenceElement.textContent = '-';
}

async function loadPreviousPage() {
  if (!firstVisible) return;

  try {
    showLoading();
    
    let query = db.collection('calls')
      .where('userId', '==', auth.currentUser.uid)
      .where('status', '==', 'completed')
      .orderBy('endTime', 'desc')
      .startAfter(firstVisible)
      .limit(pageSize);

    // Apply filters
    query = applyFilters(query);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      showNoResults();
      return;
    }

    // Update pagination state
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    firstVisible = snapshot.docs[0];
    
    // Render calls
    renderCalls(snapshot.docs);
    
    // Update pagination buttons
    updatePaginationButtons();
    
  } catch (error) {
    console.error('Error loading previous page:', error);
    showError('Failed to load calls. Please try again.');
  }
}

async function loadNextPage() {
  if (!lastVisible) return;

  try {
    showLoading();
    
    let query = db.collection('calls')
      .where('userId', '==', auth.currentUser.uid)
      .where('status', '==', 'completed')
      .orderBy('endTime', 'desc')
      .endBefore(lastVisible)
      .limit(pageSize);

    // Apply filters
    query = applyFilters(query);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      showNoResults();
      return;
    }

    // Update pagination state
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    firstVisible = snapshot.docs[0];
    
    // Render calls
    renderCalls(snapshot.docs);
    
    // Update pagination buttons
    updatePaginationButtons();
    
  } catch (error) {
    console.error('Error loading next page:', error);
    showError('Failed to load calls. Please try again.');
  }
}

function updatePaginationButtons() {
  prevPageButton.disabled = !firstVisible;
  nextPageButton.disabled = !lastVisible;
}

async function showCallDetails(callId) {
  try {
    const callDoc = await db.collection('calls').doc(callId).get();
    if (!callDoc.exists) {
      showError('Call not found');
      return;
    }

    const call = callDoc.data();
    
    // Create and show modal with call details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Call Details</h2>
        <div class="call-info">
          <p><strong>Date:</strong> ${formatDate(call.endTime)}</p>
          <p><strong>Customer:</strong> ${call.customerName || 'Unknown'}</p>
          <p><strong>Platform:</strong> ${formatPlatform(call.platform)}</p>
          <p><strong>Duration:</strong> ${formatDuration(call.duration)}</p>
          <p><strong>Final Score:</strong> ${call.finalScore?.toFixed(1) || '-'}</p>
        </div>
        <div class="metrics">
          <h3>Metrics</h3>
          <p><strong>Script Adherence:</strong> ${call.metrics?.scriptAdherence?.toFixed(1) || '-'}%</p>
          <p><strong>Objection Handling:</strong> ${call.metrics?.objectionHandling?.toFixed(1) || '-'}%</p>
          <p><strong>Talking Points:</strong> ${call.metrics?.talkingPointsCovered || 0}/${call.metrics?.totalTalkingPoints || 0}</p>
        </div>
        <div class="feedback">
          <h3>Feedback</h3>
          ${call.realTimeFeedback?.map(feedback => `
            <div class="feedback-item">
              <p class="feedback-time">${formatTime(feedback.timestamp)}</p>
              <p class="feedback-content">${feedback.feedback}</p>
            </div>
          `).join('') || 'No feedback available'}
        </div>
        <button class="close-modal">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Add close handler
    modal.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
    });

  } catch (error) {
    console.error('Error loading call details:', error);
    showError('Failed to load call details. Please try again.');
  }
}

// Helper functions
function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate();
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate();
  return date.toLocaleTimeString();
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatPlatform(platform) {
  const platforms = {
    zoom: 'Zoom',
    google_meet: 'Google Meet',
    teams: 'Microsoft Teams',
    webex: 'Webex'
  };
  return platforms[platform] || platform;
}

function getScoreClass(score) {
  if (!score) return '';
  if (score >= 8) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

function showLoading() {
  callsTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="loading">Loading...</td>
    </tr>
  `;
}

function showNoResults() {
  callsTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="loading">No calls found</td>
    </tr>
  `;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.filters'));
}

function showLoginPrompt() {
  document.body.innerHTML = `
    <div class="container">
      <div class="error">
        Please log in to view your call history.
      </div>
    </div>
  `;
}

// Event handlers
function handleFilterChange() {
  currentPage = 1;
  lastVisible = null;
  firstVisible = null;
  loadCalls();
  loadStats();
} 