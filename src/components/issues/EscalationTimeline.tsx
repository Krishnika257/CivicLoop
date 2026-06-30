// src/components/issues/EscalationTimeline.tsx
import React, { useState } from 'react';
import { EscalationStage } from '../../types';

interface EscalationTimelineProps {
  stages: EscalationStage[];
  currentDay: number;
  onTrigger?: (stage: 'l1' | 'l2' | 'l3') => void;
}

const stageLabels: Record<'l1' | 'l2' | 'l3', { label: string; emoji: string; color: string }> = {
  l1: { label: 'Ward Office', emoji: '🏛️', color: 'blue' },
  l2: { label: 'MLA / Councillor', emoji: '🏢', color: 'indigo' },
  l3: { label: 'RTI / Public', emoji: '📢', color: 'purple' },
};

export const EscalationTimeline: React.FC<EscalationTimelineProps> = ({ stages, currentDay, onTrigger }) => {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
      {stages.map((stage) => {
        const isTriggered = stage.sentAt !== null;
        const isActive = !isTriggered && currentDay >= stage.triggerDay;
        const isPast = isTriggered;
        const config = stageLabels[stage.stage];

        return (
          <div key={stage.stage} className="relative">
            <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 ${
              isPast ? 'bg-green-500 border-green-500' :
              isActive ? 'bg-yellow-500 border-yellow-500 animate-pulse' :
              'bg-gray-200 border-gray-300'
            }`} />
            <div className={`p-4 rounded-xl border transition-all ${
              isPast ? 'bg-green-50 border-green-200' :
              isActive ? 'bg-yellow-50 border-yellow-200 shadow-md' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{config.emoji}</span>
                  <div>
                    <div className="font-medium text-gray-800">{config.label}</div>
                    <div className="text-sm text-gray-500">Day {stage.triggerDay} · {stage.recipient}</div>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                  isPast ? 'bg-green-200 text-green-800' :
                  isActive ? 'bg-yellow-200 text-yellow-800 animate-pulse' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isPast ? '✅ Sent' : isActive ? '⏳ Triggering' : `⏱️ Day ${stage.triggerDay}`}
                </span>
              </div>

              {stage.draftedLetter && (
                <div className="mt-2">
                  <button
                    onClick={() => setExpandedStage(expandedStage === stage.stage ? null : stage.stage)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    {expandedStage === stage.stage ? 'Hide letter ↑' : '📄 Preview letter'}
                  </button>
                  {expandedStage === stage.stage && (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto shadow-inner">
                      {stage.draftedLetter}
                    </div>
                  )}
                </div>
              )}

              {isActive && onTrigger && (
                <button
                  onClick={() => onTrigger(stage.stage)}
                  className="mt-2 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-lg transition-colors"
                >
                  ⚡ Trigger now
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};