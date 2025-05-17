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

let currentCall = null;
let callStartTime = null;
let transcript = '';
let realTimeFeedback = [];

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CALL_STARTED':
      handleCallStarted(message.data);
      break;
    case 'CALL_ENDED':
      handleCallEnded();
      break;
    case 'TRANSCRIPT_UPDATE':
      handleTranscriptUpdate(message.data);
      break;
    case 'SCREEN_CONTENT':
      handleScreenContent(message.data);
      break;
  }
});

async function handleCallStarted(callData) {
  currentCall = {
    userId: auth.currentUser.uid,
    startTime: new Date(),
    customerName: callData.customerName,
    customerPhone: callData.customerPhone,
    status: 'in_progress',
    transcript: '',
    realTimeFeedback: [],
    metrics: {
      scriptAdherence: 100,
      objectionHandling: 100,
      talkingPointsCovered: 0,
      timeOffScript: 0
    }
  };

  // Create call document in Firestore
  const callRef = await db.collection('calls').add(currentCall);
  currentCall.id = callRef.id;
}

async function handleTranscriptUpdate(newTranscript) {
  if (!currentCall) return;

  transcript += newTranscript;
  
  // Analyze transcript with AI
  const analysis = await analyzeTranscript(newTranscript);
  
  // Update real-time feedback
  if (analysis.feedback) {
    realTimeFeedback.push({
      timestamp: new Date(),
      feedback: analysis.feedback,
      type: analysis.type
    });

    // Update metrics
    currentCall.metrics = {
      ...currentCall.metrics,
      ...analysis.metrics
    };

    // Send feedback to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'REAL_TIME_FEEDBACK',
        data: analysis.feedback
      });
    });

    // Update Firestore
    await db.collection('calls').doc(currentCall.id).update({
      transcript,
      realTimeFeedback,
      metrics: currentCall.metrics
    });
  }
}

async function handleCallEnded() {
  if (!currentCall) return;

  // Calculate final score and improvements
  const finalAnalysis = await analyzeFinalCall(transcript);
  
  // Update call document
  await db.collection('calls').doc(currentCall.id).update({
    endTime: new Date(),
    duration: (new Date() - currentCall.startTime) / 1000,
    status: 'completed',
    finalScore: finalAnalysis.score,
    improvements: finalAnalysis.improvements
  });

  // Update team analytics
  await updateTeamAnalytics(currentCall.userId, finalAnalysis);

  // Reset state
  currentCall = null;
  transcript = '';
  realTimeFeedback = [];
}

async function analyzeTranscript(transcript) {
  // Call Firebase Function for AI analysis
  const functions = firebase.functions();
  const analyzeTranscript = functions.httpsCallable('analyzeTranscript');
  
  try {
    const result = await analyzeTranscript({
      transcript,
      context: {
        scriptVersion: '1.0',
        talkingPoints: currentCall.talkingPoints,
        previousFeedback: realTimeFeedback
      }
    });
    
    return result.data;
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    return null;
  }
}

async function analyzeFinalCall(transcript) {
  const functions = firebase.functions();
  const analyzeFinalCall = functions.httpsCallable('analyzeFinalCall');
  
  try {
    const result = await analyzeFinalCall({
      transcript,
      metrics: currentCall.metrics,
      realTimeFeedback
    });
    
    return result.data;
  } catch (error) {
    console.error('Error analyzing final call:', error);
    return null;
  }
}

async function updateTeamAnalytics(userId, finalAnalysis) {
  const userDoc = await db.collection('users').doc(userId).get();
  const teamId = userDoc.data().team;

  const teamRef = db.collection('team_analytics').doc(teamId);
  
  await db.runTransaction(async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    const teamData = teamDoc.data();

    // Update team metrics
    const newTotalCalls = teamData.totalCalls + 1;
    const newAverageScore = (
      (teamData.averageScore * teamData.totalCalls + finalAnalysis.score) /
      newTotalCalls
    );

    transaction.update(teamRef, {
      totalCalls: newTotalCalls,
      averageScore: newAverageScore,
      lastUpdated: new Date()
    });
  });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('VocalQ AI Call Coach: Extension installed');
}); 