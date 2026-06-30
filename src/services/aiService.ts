// src/services/aiService.ts
import { AIAnalysisResult, IssueCategory, Precedent, EscalationLetterResult } from '../types';

// Gemini API configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

async function callGemini(prompt: string, imageBase64?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not set. Using mock responses.');
    return '';
  }

  const contents: any[] = [];
  if (imageBase64) {
    contents.push({
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: imageBase64.split(',')[1] } }
      ]
    });
  } else {
    contents.push({ parts: [{ text: prompt }] });
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// 1. Image categorization with vision
export async function analyzeImage(imageBase64: string): Promise<AIAnalysisResult> {
  const prompt = `You are a civic issue classifier. Analyze this image and return ONLY valid JSON with:
  {
    "category": "pothole" | "streetlight" | "waterlogging" | "garbage" | "other",
    "severity": "low" | "medium" | "high",
    "description": "A concise one-sentence description of the issue",
    "confidence": 0.0-1.0
  }
  Be specific and accurate. If uncertain, choose the most likely category.`;

  try {
    const text = await callGemini(prompt, imageBase64);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result as AIAnalysisResult;
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('AI analysis failed:', error);
    // Fallback mock
    return {
      category: 'other',
      severity: 'medium',
      description: 'A civic issue that needs attention.',
      confidence: 0.6
    };
  }
}

// 2. Precedent matching
export async function matchPrecedent(
  category: IssueCategory,
  location: string,
  precedents: Precedent[]
): Promise<{ precedent: Precedent | null; matchReason: string }> {
  const prompt = `You are a civic data analyst. Given an issue of category "${category}" in "${location}", 
  match it with the best precedent from this list. Return ONLY valid JSON:
  {
    "precedentId": "id of the best match or null",
    "reason": "brief explanation of why this matches"
  }
  Precedents: ${JSON.stringify(precedents.map(p => ({ id: p.id, category: p.category, locationType: p.locationType, fixDescription: p.fixDescription })))}`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const precedent = precedents.find(p => p.id === result.precedentId) || null;
      return { precedent, matchReason: result.reason || 'AI-matched precedent' };
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Precedent matching failed:', error);
    // Fallback: pick first matching category or random
    const fallback = precedents.find(p => p.category === category) || precedents[0] || null;
    return { precedent: fallback, matchReason: 'Fallback match' };
  }
}

// 3. Escalation letter drafting
export async function draftEscalationLetter(
  issue: {
    title: string;
    description: string;
    category: string;
    location: string;
    reportedAt: string;
  },
  stage: 'l1' | 'l2' | 'l3',
  previousLetter?: string,
  daysElapsed?: number
): Promise<EscalationLetterResult> {
  const stageConfig = {
    l1: {
      label: 'Ward Office',
      recipient: 'Ward Officer, Municipal Corporation',
      days: 7,
      tone: 'polite, informational complaint'
    },
    l2: {
      label: 'MLA/Councillor Office',
      recipient: 'Honorable MLA / Councillor',
      days: 14,
      tone: 'firmer, references original complaint and lack of response'
    },
    l3: {
      label: 'RTI / Public Pressure',
      recipient: 'Public Information Officer, RTI Cell',
      days: 21,
      tone: 'formal, cites public accountability, references specific dates'
    }
  };

  const config = stageConfig[stage];
  const days = daysElapsed || config.days;

  const prompt = `You are a civic advocacy AI. Draft an escalation letter for a civic issue.

  Issue: ${issue.title}
  Description: ${issue.description}
  Category: ${issue.category}
  Location: ${issue.location}
  Reported on: ${issue.reportedAt}
  Days elapsed: ${days}
  Stage: ${stageConfig[stage].label}
  Tone: ${config.tone}
  ${previousLetter ? `Previous letter: ${previousLetter}` : ''}

  Return ONLY valid JSON:
  {
    "subject": "Subject line of the letter",
    "body": "Full letter body in plain text",
    "recipient": "${config.recipient}"
  }
  The letter should be professional, clear, and actionable.`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        subject: result.subject || `Escalation: ${issue.title} (Stage ${stage.toUpperCase()})`,
        body: result.body || `Dear ${config.recipient}, please address the civic issue at ${issue.location}.`,
        recipient: result.recipient || config.recipient,
        stage
      };
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Escalation letter failed:', error);
    // Fallback
    return {
      subject: `Escalation: ${issue.title} (Day ${days})`,
      body: `Dear ${config.recipient},\n\nThis is regarding the civic issue "${issue.title}" reported on ${issue.reportedAt} at ${issue.location}. Despite previous attempts, the issue remains unresolved after ${days} days. Please take immediate action.\n\nSincerely,\nCivicLoop User`,
      recipient: config.recipient,
      stage
    };
  }
}

// 4. Precedent card synthesis (for display)
export async function synthesizePrecedentCard(
  category: IssueCategory,
  precedent: Precedent | null
): Promise<{ title: string; description: string; department: string; timeline: string }> {
  if (!precedent) {
    return {
      title: 'No precedent found',
      description: 'This is a new type of issue in this area.',
      department: 'To be determined',
      timeline: 'Resolution timeline unknown'
    };
  }

  const prompt = `You are a civic data storyteller. Create a short, human-readable "precedent card" for a civic issue.

  Category: ${category}
  Precedent: ${JSON.stringify(precedent)}

  Return ONLY valid JSON:
  {
    "title": "A short, catchy title for the precedent card",
    "description": "A 1-2 sentence summary of what happened in the past",
    "department": "The department responsible for this type of issue",
    "timeline": "Expected resolution timeline in days"
  }`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Precedent card synthesis failed:', error);
    return {
      title: `${precedent.category} precedent in ${precedent.locationType}`,
      description: precedent.fixDescription,
      department: precedent.department,
      timeline: `${precedent.avgResolutionDays} days average resolution time`
    };
  }
}