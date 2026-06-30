// src/components/issues/IssueDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIssue, updateIssue, getPrecedent, db } from '../../services/firebase';
import { Issue, EscalationStage, IssueStatus } from '../../types';
import { draftEscalationLetter } from '../../services/aiService';
import { doc, updateDoc } from 'firebase/firestore';

export const IssueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simDay, setSimDay] = useState(0);
  const [showLetter, setShowLetter] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadIssue(id);
    }
  }, [id]);

  const loadIssue = async (issueId: string) => {
    setLoading(true);
    try {
      const data = await getIssue(issueId);
      if (data) {
        setIssue(data);
        // Calculate simulated days
        const reported = new Date(data.reportedAt);
        const now = new Date();
        const days = Math.floor((now.getTime() - reported.getTime()) / (1000 * 60 * 60 * 24));
        setSimDay(Math.min(days, 30));
      } else {
        setError('Issue not found');
      }
    } catch (err) {
      setError('Failed to load issue');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: IssueStatus): string => {
    const labels: Record<IssueStatus, string> = {
      reported: '📋 Reported',
      verified: '✅ Verified',
      escalated_l1: '📧 Escalated L1',
      escalated_l2: '📧 Escalated L2',
      escalated_l3: '📢 Escalated L3',
      resolved: '🎉 Resolved',
    };
    return labels[status] || status;
    };

    const getStatusColor = (status: IssueStatus): string => {
      const colors: Record<IssueStatus, string> = {
        reported: 'bg-red-100 text-red-800 border-red-200',
        verified: 'bg-orange-100 text-orange-800 border-orange-200',
        escalated_l1: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        escalated_l2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        escalated_l3: 'bg-amber-100 text-amber-800 border-amber-200',
        resolved: 'bg-green-100 text-green-800 border-green-200',
      };
      return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getStageLabel = (stage: 'l1' | 'l2' | 'l3'): string => {
      const labels = {
        l1: '🏛️ Ward Office',
        l2: '🏢 MLA / Councillor',
        l3: '📢 RTI / Public',
      };
      return labels[stage] || stage;
    };

    // Simulate time passing and trigger escalations
    const simulateTime = async () => {
      if (!issue || simulating) return;
      setSimulating(true);

      let currentDay = simDay;
      const interval = setInterval(async () => {
        currentDay += 1;
        setSimDay(currentDay);

        // Check if any escalation should trigger
        if (issue && issue.escalationHistory) {
          const stages = issue.escalationHistory;
          let updated = false;

          for (const stage of stages) {
            if (currentDay >= stage.triggerDay && !stage.sentAt) {
              // Trigger this stage
              const letter = await draftEscalationLetter(
                {
                  title: issue.title,
                  description: issue.description,
                  category: issue.category,
                  location: issue.location.address || `${issue.location.lat}, ${issue.location.lng}`,
                  reportedAt: issue.reportedAt,
                },
                stage.stage,
                stages.find(s => s.stage === stage.stage && s.sentAt)?.draftedLetter,
                currentDay
              );

              stage.sentAt = new Date().toISOString();
              stage.draftedLetter = letter.body;
              stage.recipient = letter.recipient;
              updated = true;

              // Update issue status
              const statusMap: Record<'l1' | 'l2' | 'l3', IssueStatus> = {
                l1: 'escalated_l1',
                l2: 'escalated_l2',
                l3: 'escalated_l3',
              };
              const newStatus = statusMap[stage.stage];
              if (newStatus && issue.status !== 'resolved') {
                issue.status = newStatus;
              }

              // Save to Firestore
              await updateIssue(issue.id, {
                escalationHistory: issue.escalationHistory,
                status: issue.status,
              });

              // Show a notification
              setShowLetter(`📨 ${getStageLabel(stage.stage)} — Letter drafted!`);

              break; // Only trigger one stage at a time
            }
          }

          if (updated) {
            // Reload issue
            await loadIssue(issue.id);
          }

          if (currentDay >= 30 || issue?.status === 'resolved') {
            clearInterval(interval);
            setSimulating(false);
          }
        }
      }, 1500);

      // Cleanup after 30 seconds max
      setTimeout(() => {
        clearInterval(interval);
        setSimulating(false);
      }, 30000);
    };

    const markResolved = async () => {
      if (!issue) return;
      try {
        await updateIssue(issue.id, {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
        await loadIssue(issue.id);
      } catch (err) {
        console.error('Failed to mark resolved:', err);
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }

    if (error || !issue) {
      return (
        <div className="max-w-2xl mx-auto p-6 text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-700">{error || 'Issue not found'}</h2>
          <button onClick={() => navigate('/')} className="mt-4 text-blue-500 hover:underline">
            Back to map
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{issue.title}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusColor(issue.status)}`}>
                    {getStatusLabel(issue.status)}
                  </span>
                  <span className="text-xs text-gray-500">{issue.category}</span>
                  <span className="text-xs text-gray-400">
                    Reported {new Date(issue.reportedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">⭐ {issue.verificationCount || 0} verifications</span>
                {issue.status !== 'resolved' && (
                  <button
                    onClick={markResolved}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Photo */}
            {issue.photoUrl && (
              <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video max-h-80">
                <img src={issue.photoUrl} alt={issue.title} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-gray-600">{issue.description}</p>
            </div>

            {/* Location */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">📍 Location</h3>
              <p className="text-gray-600 text-sm">
                {issue.location.address || `${issue.location.lat}, ${issue.location.lng}`}
              </p>
            </div>

            {/* Simulation control */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="font-medium text-gray-700">⏱️ Simulation</span>
                  <span className="ml-2 text-sm text-gray-500">Day {simDay}</span>
                </div>
                <div className="flex gap-2">
                  {simDay < 30 && issue.status !== 'resolved' && (
                    <button
                      onClick={simulateTime}
                      disabled={simulating}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {simulating ? '⏳ Simulating...' : '⚡ Fast-forward time'}
                    </button>
                  )}
                  <button
                    onClick={() => setSimDay(Math.min(simDay + 7, 30))}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    +7 days
                  </button>
                </div>
              </div>
              {showLetter && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 animate-fade-in">
                  {showLetter}
                </div>
              )}
            </div>

            {/* Escalation Timeline */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">📋 Escalation Timeline</h3>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {issue.escalationHistory.map((stage, idx) => {
                  const isTriggered = stage.sentAt !== null;
                  const isActive = !isTriggered && simDay >= stage.triggerDay;
                  const isPast = isTriggered;
                  const isFuture = !isTriggered && simDay < stage.triggerDay;

                  return (
                    <div key={stage.stage} className="relative">
                      <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 ${
                        isPast ? 'bg-green-500 border-green-500' :
                        isActive ? 'bg-yellow-500 border-yellow-500 animate-pulse' :
                        'bg-gray-200 border-gray-300'
                      }`} />
                      <div className={`p-4 rounded-xl border ${
                        isPast ? 'bg-green-50 border-green-200' :
                        isActive ? 'bg-yellow-50 border-yellow-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <div className="font-medium text-gray-800">{getStageLabel(stage.stage)}</div>
                            <div className="text-sm text-gray-500">Day {stage.triggerDay} · {stage.recipient}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isPast ? 'bg-green-200 text-green-800' :
                            isActive ? 'bg-yellow-200 text-yellow-800' :
                            'bg-gray-200 text-gray-500'
                          }`}>
                            {isPast ? '✅ Sent' : isActive ? '⏳ Pending' : `⏱️ Day ${stage.triggerDay}`}
                          </span>
                        </div>

                        {/* Letter preview */}
                        {stage.draftedLetter && (
                          <div className="mt-2">
                            <button
                              onClick={() => setShowLetter(showLetter === stage.stage ? null : stage.stage)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {showLetter === stage.stage ? 'Hide letter' : '📄 Preview letter'}
                            </button>
                            {showLetter === stage.stage && (
                              <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {stage.draftedLetter}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back to Map
              </button>
              {issue.status !== 'resolved' && (
                <button
                  onClick={markResolved}
                  className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  ✅ Mark as Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };