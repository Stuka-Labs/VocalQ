const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const path = require('path');

// Load env locally only
if (!process.env.K_SERVICE && !process.env.FUNCTION_NAME) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
}

admin.initializeApp();

exports.analyzeTranscript = functions.https.onCall(async (data, context) => {
  const apiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('Missing OpenAI API Key');
    throw new functions.https.HttpsError('internal', 'Missing OpenAI API Key');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const { transcriptChunks } = data;
    const fullTranscript = transcriptChunks.join(' ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales coach analyzing a sales call transcript. Provide specific, actionable feedback and a score from 0–100.'
        },
        {
          role: 'user',
          content: `Analyze this sales call transcript and provide feedback:\n\n${fullTranscript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const analysis = completion.choices[0].message.content;
    const scoreMatch = analysis.match(/score:?\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    await admin.firestore().collection('call-analyses').add({
      transcript: fullTranscript,
      analysis,
      score,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { analysis, score };
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw new functions.https.HttpsError('internal', 'Failed to analyze transcript');
  }
}); 