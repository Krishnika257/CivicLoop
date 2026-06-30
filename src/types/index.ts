
export type IssueStatus = 'reported' | 'verified' | 'escalated_l1' | 'escalated_l2' | 'escalated_l3' | 'resolved';

export type IssueCategory = 'pothole' | 'streetlight' | 'waterlogging' | 'garbage' | 'other';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface EscalationStage {
  stage: 'l1' | 'l2' | 'l3';
  label: string;
  recipient: string;
  draftedLetter: string;
  sentAt: string | null;
  triggerDay: number; // day when this stage triggers
}

export interface Precedent {
  id: string;
  category: IssueCategory;
  locationType: string;
  avgResolutionDays: number;
  fixDescription: string;
  department: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: 'low' | 'medium' | 'high';
  photoUrl: string;
  location: Location;
  reportedBy: string;
  reportedAt: string;
  status: IssueStatus;
  verificationCount: number;
  precedentId?: string;
  escalationHistory: EscalationStage[];
  resolvedAt?: string;
  resolutionPhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  karmaPoints: number;
  reportsCount: number;
  verifiedCount: number;
  createdAt: string;
}

export interface AIAnalysisResult {
  category: IssueCategory;
  severity: 'low' | 'medium' | 'high';
  description: string;
  confidence: number;
}

export interface PrecedentMatchResult {
  precedent: Precedent;
  matchReason: string;
}

export interface EscalationLetterResult {
  subject: string;
  body: string;
  recipient: string;
  stage: 'l1' | 'l2' | 'l3';
}