// src/components/profile/Profile.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { user, userProfile } = useAuth();

  if (!user || !userProfile) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <h2 className="text-xl font-semibold text-gray-700">Please sign in</h2>
        <p className="text-gray-500 mt-1">Sign in to view your profile and karma points.</p>
      </div>
    );
  }

  const stats = [
    { label: 'Karma Points', value: userProfile.karmaPoints || 0, icon: '⭐' },
    { label: 'Reports Filed', value: userProfile.reportsCount || 0, icon: '📋' },
    { label: 'Verifications', value: userProfile.verifiedCount || 0, icon: '✅' },
  ];

  const rewards = [
    { name: 'Coffee at Local Brew', points: 100, emoji: '☕' },
    { name: 'Discount at Corner Store', points: 50, emoji: '🏪' },
    { name: 'Free Chai at Street Stall', points: 25, emoji: '🍵' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center gap-4">
            {userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt={userProfile.name} className="w-16 h-16 rounded-full border-2 border-white/50" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {userProfile.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{userProfile.name}</h2>
              <p className="text-blue-100 text-sm">{userProfile.email}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-100">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl">{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Rewards */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-700 mb-3">🎁 Available Rewards</h3>
          <div className="space-y-2">
            {rewards.map((reward) => (
              <div key={reward.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{reward.emoji}</span>
                  <span className="text-sm font-medium text-gray-700">{reward.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{reward.points} pts</span>
                  <button
                    disabled={(userProfile.karmaPoints || 0) < reward.points}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Redeem
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <Link to="/" className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
            ← Back to Map
          </Link>
          <Link
            to="/report"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Report
          </Link>
        </div>
      </div>
    </div>
  );
};