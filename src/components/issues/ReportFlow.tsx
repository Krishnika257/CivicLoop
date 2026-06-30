import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createIssue, getPrecedents, db } from '../../services/firebase';
import { analyzeImage, matchPrecedent, synthesizePrecedentCard, draftEscalationLetter } from '../../services/aiService';
import { collection, getDocs } from 'firebase/firestore';
import { Issue, IssueCategory, Precedent, EscalationStage } from '../../types';

interface ReportFlowProps {
  onSuccess?: (issueId: string) => void;
  onCancel?: () => void;
}

const CATEGORIES: { value: IssueCategory; label: string; emoji: string }[] = [
  { value: 'pothole', label: 'Pothole', emoji: '🕳️' },
  { value: 'streetlight', label: 'Streetlight', emoji: '💡' },
  { value: 'waterlogging', label: 'Waterlogging', emoji: '🌊' },
  { value: 'garbage', label: 'Garbage', emoji: '🗑️' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

export const ReportFlow: React.FC<ReportFlowProps> = ({ onSuccess, onCancel }) => {
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState<'upload' | 'preview' | 'submitting' | 'success'>('upload');

  // Form state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('other');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string }>({
    lat: 12.9716,
    lng: 77.5946,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI results
  const [aiAnalysis, setAiAnalysis] = useState<{
    category: IssueCategory;
    severity: 'low' | 'medium' | 'high';
    description: string;
  } | null>(null);
  const [precedentMatch, setPrecedentMatch] = useState<{
    precedent: Precedent | null;
    matchReason: string;
    card: { title: string; description: string; department: string; timeline: string } | null;
  }>({ precedent: null, matchReason: '', card: null });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle photo upload
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);

    // Auto-analyze with AI
    setIsAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Step 1: Analyze image
      const analysis = await analyzeImage(base64);
      setCategory(analysis.category);
      setSeverity(analysis.severity);
      setDescription(analysis.description);
      setAiAnalysis({
        category: analysis.category,
        severity: analysis.severity,
        description: analysis.description,
      });

      // Step 2: Match precedent
      const precedentsSnap = await getDocs(collection(db, 'precedents'));
      const precedents = precedentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Precedent));

      const match = await matchPrecedent(analysis.category, 'Bengaluru', precedents);
      setPrecedentMatch({
        precedent: match.precedent,
        matchReason: match.matchReason,
        card: null,
      });

      // Step 3: Generate precedent card
      if (match.precedent) {
        const card = await synthesizePrecedentCard(analysis.category, match.precedent);
        setPrecedentMatch(prev => ({ ...prev, card }));
      }

      // Auto-generate title
      const categoryLabel = CATEGORIES.find(c => c.value === analysis.category)?.label || 'Issue';
      setTitle(`${categoryLabel} reported at ${new Date().toLocaleDateString()}`);

    } catch (err) {
      console.error('AI analysis error:', err);
      setError('AI analysis failed. Please fill in the details manually.');
    } finally {
      setIsAnalyzing(false);
    }

    setStep('preview');
  };

  // Get current location
  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          // Reverse geocode (simplified)
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
            .then(res => res.json())
            .then(data => {
              if (data?.display_name) {
                setLocation(prev => ({ ...prev, address: data.display_name }));
              }
            })
            .catch(() => {});
        },
        () => {
          setError('Unable to get location. Please enter manually.');
        }
      );
    }
  };

  // Submit issue
  const handleSubmit = async () => {
    if (!user) {
      setError('Please sign in first.');
      return;
    }

    if (!photoFile) {
      setError('Please upload a photo.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 🔥 Use a placeholder image – skip Firebase Storage
      const photoUrl = 'https://via.placeholder.com/400x300/ff6b6b/ffffff?text=Civic+Issue';

      // Generate escalation stages
      const escalationStages: EscalationStage[] = [
        {
          stage: 'l1',
          label: 'Ward Office',
          recipient: 'Ward Officer, Municipal Corporation',
          draftedLetter: '',
          sentAt: null,
          triggerDay: 7,
        },
        {
          stage: 'l2',
          label: 'MLA/Councillor Office',
          recipient: 'Honorable MLA / Councillor',
          draftedLetter: '',
          sentAt: null,
          triggerDay: 14,
        },
        {
          stage: 'l3',
          label: 'RTI / Public Pressure',
          recipient: 'Public Information Officer, RTI Cell',
          draftedLetter: '',
          sentAt: null,
          triggerDay: 21,
        },
      ];

      // Draft initial letters (for demo, draft all upfront)
      for (let i = 0; i < escalationStages.length; i++) {
        const stage = escalationStages[i];
        const letter = await draftEscalationLetter(
          {
            title: title.trim(),
            description: description.trim(),
            category,
            location: location.address || `${location.lat}, ${location.lng}`,
            reportedAt: new Date().toISOString(),
          },
          stage.stage,
          i > 0 ? escalationStages[i-1].draftedLetter : undefined,
          stage.triggerDay
        );
        escalationStages[i].draftedLetter = letter.body;
        escalationStages[i].recipient = letter.recipient;
      }

      const issueData: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'> ={
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        photoUrl, // ✅ placeholder
        location,
        reportedBy: user.uid,
        reportedAt: new Date().toISOString(),
        status: 'reported' as const,
        verificationCount: 0,
        precedentId: precedentMatch.precedent?.id ,
        escalationHistory: escalationStages,
        resolvedAt: undefined,
        resolutionPhotoUrl: undefined,
      };

      const issueId = await createIssue(issueData);
      setStep('success');

      if (onSuccess) {
        setTimeout(() => onSuccess(issueId), 1500);
      }

    } catch (err) {
      console.error('Submission error:', err);
      setError('Failed to submit issue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload step
  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Report a Civic Issue</h2>
            <p className="text-sm text-gray-500 mt-1">Upload a photo and our AI will help categorize it</p>
          </div>

          <div className="p-6">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-3">📸</div>
              <p className="text-gray-600 font-medium">Click to upload a photo</p>
              <p className="text-sm text-gray-400 mt-1">PNG, JPG up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview / edit step
  if (step === 'preview') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Review & Confirm</h2>
            <p className="text-sm text-gray-500 mt-1">AI has analyzed your report. Review the details below.</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Photo preview */}
            {photoPreview && (
              <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video max-h-64">
                <img src={photoPreview} alt="Issue" className="w-full h-full object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-sm font-medium text-gray-700">AI analyzing...</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Analysis badge */}
            {aiAnalysis && !isAnalyzing && (
              <div className="flex flex-wrap gap-2 items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-sm font-medium text-blue-700">🧠 AI Analysis</span>
                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                  {CATEGORIES.find(c => c.value === aiAnalysis.category)?.label || aiAnalysis.category}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  aiAnalysis.severity === 'high' ? 'bg-red-200 text-red-800' :
                  aiAnalysis.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-green-200 text-green-800'
                }`}>
                  {aiAnalysis.severity} severity
                </span>
                <span className="text-xs text-blue-600">conf: {(0.85).toFixed(2)}</span>
              </div>
            )}

            {/* Form fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Brief title for the issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        category === c.value
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Describe the issue in detail..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
                    onChange={() => {}}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    placeholder="Search or enter address"
                  />
                  <button
                    onClick={getCurrentLocation}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-600"
                  >
                    📍
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}</p>
              </div>
            </div>

            {/* Precedent card */}
            {precedentMatch.card && (
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📋</span>
                  <span className="font-semibold text-gray-800">Precedent Card</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">AI-matched</span>
                </div>
                <h4 className="font-medium text-gray-800">{precedentMatch.card.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{precedentMatch.card.description}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  <span className="bg-white/70 px-2 py-0.5 rounded-full text-gray-600">🏛️ {precedentMatch.card.department}</span>
                  <span className="bg-white/70 px-2 py-0.5 rounded-full text-gray-600">⏱️ {precedentMatch.card.timeline}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Submitting...
                  </span>
                ) : (
                  'Submit Report →'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success step
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800">Report Submitted!</h2>
        <p className="text-gray-500 mt-2">Your civic issue has been reported and is now being tracked.</p>
        <p className="text-sm text-gray-400 mt-1">AI has drafted escalation letters that will trigger automatically.</p>
        <button
          onClick={() => onSuccess?.('')}
          className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          View on Map
        </button>
      </div>
    </div>
  );
};