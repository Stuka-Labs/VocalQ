const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();

// Function to analyze transcript using OpenAI
exports.analyzeTranscript = functions.https.onCall(async (data, context) => {
  try {
    // Use the Firebase Functions config for the API key
    const openai = new OpenAI({
      apiKey: functions.config().openai.api_key
    });

    const { transcript } = data;
    
    // Call OpenAI API for analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert sales coach analyzing a sales call transcript. Provide specific, actionable feedback and a score from 0-100."
        },
        {
          role: "user",
          content: `Analyze this sales call transcript and provide feedback:\n\n${transcript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const analysis = completion.choices[0].message.content;

    // Store analysis in Firestore
    const analysisRef = await db.collection('callAnalyses').add({
      transcript,
      analysis,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      analysisId: analysisRef.id,
      analysis
    };
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw new functions.https.HttpsError('internal', 'Error analyzing transcript');
  }
}); 