const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const path = require('path');

// Load env locally only
if (!process.env.K_SERVICE && !process.env.FUNCTION_NAME) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
}

admin.initializeApp();

// Analyze transcript in real-time
exports.analyzeTranscript = functions.https.onCall(async (data, context) => {
  // Get OpenAI API key from Firebase config
  const openaiApiKey = functions.config().openai?.api_key;
  if (!openaiApiKey) {
    throw new functions.https.HttpsError('internal', 'OpenAI API key not found in Firebase config');
  }
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to analyze transcripts'
    );
  }

  const { transcript, context: callContext } = data;

  try {
    // Get the sales script
    const scriptDoc = await admin.firestore()
      .collection('scripts')
      .doc(callContext.scriptVersion)
      .get();

    if (!scriptDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Sales script not found'
      );
    }

    const script = scriptDoc.data();

    // Grading criteria
    const gradingCriteria = `
1. Did the salesperson confirm information to start the quote?
2. Did salesperson confirm drivers?
3. Did the salesperson ask, "Do you pay your auto insurance every six months or do you pay every month? Great! About how much do you pay every month?"
4. Is home insurance escrowed?
5. Who is your mortgage company?
6. Did the salesperson assume the close at least two times?
7. Lead with Liability questions:
   a. Did salesperson confirm your liability limits?
   b. Do you know what those coverages mean and how they protect you?
   c. How long has it been since you reviewed the coverages with your agent?
   d. Did the salesperson explain any gaps in the prospects coverage compared to what they should have covered?
8. Did the salesperson specifically ask for the sale to be done on this call?
9. Was there a meaningful follow up date and action discussed?
10. Did the salesperson specifically ask if they wanted to engage via Hearsay Texting?
11. Did the Salesperson ask the specific statement of "What do you do?"
12. Did the Salesperson specifically ask where the prospect is currently insured and what was the response? Also, if the customer stated how long they were there? Other questions about their current insurance?
13. Did the salesperson automatically quote 2 lines?
14. Did salesperson answer questions:
    A. Do you have any questions?
    B. Do you know how the cancellation process works?
    C. Do you know how the refund process works?
For each, answer Yes/No and provide a brief explanation.`;

    // Analyze transcript with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI sales coach. Grade the following transcript using these criteria:\n${gradingCriteria}`
        },
        {
          role: "user",
          content: `Transcript:\n${transcript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const analysis = completion.choices[0].message.content;

    // Parse the analysis to extract metrics
    const metrics = parseAnalysis(analysis, script);

    return {
      feedback: analysis,
      metrics,
      type: 'real-time'
    };

  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to analyze transcript'
    );
  }
});

// Analyze final call
exports.analyzeFinalCall = functions.https.onCall(async (data, context) => {
  // Get OpenAI API key from Firebase config
  const openaiApiKey = functions.config().openai?.api_key;
  if (!openaiApiKey) {
    throw new functions.https.HttpsError('internal', 'OpenAI API key not found in Firebase config');
  }
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to analyze calls'
    );
  }

  const { transcript, metrics, realTimeFeedback } = data;

  try {
    // Get the sales script
    const scriptDoc = await admin.firestore()
      .collection('scripts')
      .doc('1.0') // Use latest script version
      .get();

    if (!scriptDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Sales script not found'
      );
    }

    const script = scriptDoc.data();

    // Grading criteria (reuse for final analysis)
    const gradingCriteria = `
1. Did the salesperson confirm information to start the quote?
2. Did salesperson confirm drivers?
3. Did the salesperson ask, "Do you pay your auto insurance every six months or do you pay every month? Great! About how much do you pay every month?"
4. Is home insurance escrowed?
5. Who is your mortgage company?
6. Did the salesperson assume the close at least two times?
7. Lead with Liability questions:
   a. Did salesperson confirm your liability limits?
   b. Do you know what those coverages mean and how they protect you?
   c. How long has it been since you reviewed the coverages with your agent?
   d. Did the salesperson explain any gaps in the prospects coverage compared to what they should have covered?
8. Did the salesperson specifically ask for the sale to be done on this call?
9. Was there a meaningful follow up date and action discussed?
10. Did the salesperson specifically ask if they wanted to engage via Hearsay Texting?
11. Did the Salesperson ask the specific statement of "What do you do?"
12. Did the Salesperson specifically ask where the prospect is currently insured and what was the response? Also, if the customer stated how long they were there? Other questions about their current insurance?
13. Did the salesperson automatically quote 2 lines?
14. Did salesperson answer questions:
    A. Do you have any questions?
    B. Do you know how the cancellation process works?
    C. Do you know how the refund process works?
For each, answer Yes/No and provide a brief explanation.`;

    // Analyze final call with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI sales coach. Grade the following transcript using these criteria:\n${gradingCriteria}`
        },
        {
          role: "user",
          content: `Transcript:\n${transcript}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const analysis = completion.choices[0].message.content;

    // Parse the analysis to extract final metrics
    const finalMetrics = parseFinalAnalysis(analysis, script);

    return {
      score: finalMetrics.score,
      improvements: finalMetrics.improvements,
      metrics: finalMetrics.metrics,
      gradingCriteriaResults: analysis
    };

  } catch (error) {
    console.error('Error analyzing final call:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to analyze final call'
    );
  }
});

// Helper functions
function parseAnalysis(analysis, script) {
  // Extract metrics from the analysis text
  const metrics = {
    scriptAdherence: 100,
    objectionHandling: 100,
    talkingPointsCovered: 0,
    timeOffScript: 0
  };

  // Count covered talking points
  script.talkingPoints.forEach(point => {
    if (analysis.toLowerCase().includes(point.toLowerCase())) {
      metrics.talkingPointsCovered++;
    }
  });

  // Calculate script adherence
  const offScriptMentions = (analysis.match(/off-script|deviated|strayed/gi) || []).length;
  metrics.timeOffScript = offScriptMentions * 10; // 10% penalty per off-script mention
  metrics.scriptAdherence = Math.max(0, 100 - metrics.timeOffScript);

  // Calculate objection handling
  const objectionMentions = (analysis.match(/objection|concern|issue/gi) || []).length;
  const handledObjections = (analysis.match(/handled|addressed|resolved/gi) || []).length;
  metrics.objectionHandling = handledObjections / objectionMentions * 100 || 100;

  return metrics;
}

function parseFinalAnalysis(analysis, script) {
  // Extract final metrics from the analysis text
  const metrics = {
    score: 0,
    improvements: [],
    metrics: {
      scriptAdherence: 0,
      objectionHandling: 0,
      talkingPointsCovered: 0,
      totalTalkingPoints: script.talkingPoints.length
    }
  };

  // Extract score
  const scoreMatch = analysis.match(/score:?\s*(\d+(?:\.\d+)?)/i);
  if (scoreMatch) {
    metrics.score = parseFloat(scoreMatch[1]);
  }

  // Extract improvements
  const improvementsMatch = analysis.match(/improvements?:?\s*([^.]*)/i);
  if (improvementsMatch) {
    metrics.improvements = improvementsMatch[1]
      .split(',')
      .map(imp => imp.trim())
      .filter(imp => imp);
  }

  // Extract metrics
  const adherenceMatch = analysis.match(/script adherence:?\s*(\d+(?:\.\d+)?)/i);
  if (adherenceMatch) {
    metrics.metrics.scriptAdherence = parseFloat(adherenceMatch[1]);
  }

  const objectionMatch = analysis.match(/objection handling:?\s*(\d+(?:\.\d+)?)/i);
  if (objectionMatch) {
    metrics.metrics.objectionHandling = parseFloat(objectionMatch[1]);
  }

  const pointsMatch = analysis.match(/talking points:?\s*(\d+)\s*\/\s*(\d+)/i);
  if (pointsMatch) {
    metrics.metrics.talkingPointsCovered = parseInt(pointsMatch[1]);
    metrics.metrics.totalTalkingPoints = parseInt(pointsMatch[2]);
  }

  return metrics;
} 