# Firestore Database Schema

## Collections

### users
- userId (document ID)
  - email: string
  - name: string
  - role: string (e.g., "sales_rep")
  - team: string
  - createdAt: timestamp
  - lastActive: timestamp

### calls
- callId (document ID)
  - userId: string (reference to users)
  - startTime: timestamp
  - endTime: timestamp
  - duration: number (in seconds)
  - customerName: string
  - customerPhone: string
  - status: string (e.g., "completed", "missed", "failed")
  - transcript: string
  - realTimeFeedback: array
    - timestamp: timestamp
    - feedback: string
    - type: string (e.g., "script_deviation", "talking_point", "objection_handling")
  - finalScore: number (0-100)
  - metrics: map
    - scriptAdherence: number (0-100)
    - objectionHandling: number (0-100)
    - talkingPointsCovered: number
    - timeOffScript: number (in seconds)
  - improvements: array
    - category: string
    - suggestion: string
    - priority: number

### scripts
- scriptId (document ID)
  - name: string
  - version: string
  - content: string
  - talkingPoints: array
    - point: string
    - importance: number (1-5)
  - objections: array
    - objection: string
    - response: string
  - createdAt: timestamp
  - updatedAt: timestamp

### team_analytics
- teamId (document ID)
  - name: string
  - members: array (user IDs)
  - averageScore: number
  - totalCalls: number
  - successRate: number
  - commonIssues: array
    - issue: string
    - frequency: number
  - lastUpdated: timestamp 

## Example: scripts/1.0 (AllState Sales Script)

```
{
  "name": "AllState Sales Script",
  "version": "1.0",
  "content": "Full script text from your file...",
  "talkingPoints": [
    "Introduce yourself and AllState",
    "Explain the purpose of the call and set expectations",
    "Ask applicant questions: address, vehicle, drivers, deductibles, tickets/accidents, roof age",
    "Discuss payment frequency and insurance provider",
    "Build out the quote and set an upfront contract",
    "Ask closing questions: cancellation, refund, payment method",
    "Handle objections and use push phrases",
    "Close the deal or provide follow-up instructions"
  ],
  "objections": [
    {
      "objection": "Too expensive",
      "response": "You're going to be concerned with price only once, but quality the entire time."
    },
    {
      "objection": "More expensive",
      "response": "Wouldn't you agree it's better to invest a little more than you planned, instead of a little less than you should?"
    },
    {
      "objection": "Price",
      "response": "What is the biggest mistake people make when buying insurance? Price."
    },
    {
      "objection": "General hesitation",
      "response": "How can I earn your business?"
    }
  ],
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
``` 