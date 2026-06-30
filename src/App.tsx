// src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { MapView } from './components/map/MapView';
import { ReportFlow } from './components/issues/ReportFlow';
import { IssueDetail } from './components/issues/IssueDetail';
import { Profile } from './components/profile/Profile';
import { getIssues, seedPrecedents, db } from './services/firebase';
import { Issue } from './types';
import { IssueCategory, Precedent } from './types';
import { collection, getDocs } from 'firebase/firestore';

// Seed data for precedents
const SEED_PRECEDENTS: Omit<Precedent, 'id'>[] = [
  { category: 'pothole' as IssueCategory, locationType: 'residential street', avgResolutionDays: 7, fixDescription: 'Repaired with asphalt and compacted', department: 'Roads Department' },
  { category: 'pothole' as IssueCategory, locationType: 'main road', avgResolutionDays: 5, fixDescription: 'Patched with hot mix asphalt', department: 'Roads Department' },
  { category: 'streetlight' as IssueCategory, locationType: 'residential area', avgResolutionDays: 10, fixDescription: 'Replaced faulty bulb and wiring', department: 'Electricity Board' },
  { category: 'streetlight' as IssueCategory, locationType: 'commercial area', avgResolutionDays: 8, fixDescription: 'Fixed wiring and installed LED', department: 'Electricity Board' },
  { category: 'waterlogging' as IssueCategory, locationType: 'low-lying area', avgResolutionDays: 12, fixDescription: 'Cleared storm drains and improved outflow', department: 'Water Board' },
  { category: 'waterlogging' as IssueCategory, locationType: 'road underpass', avgResolutionDays: 9, fixDescription: 'Pumped out water and cleared debris', department: 'Water Board' },
  { category: 'garbage' as IssueCategory, locationType: 'residential colony', avgResolutionDays: 6, fixDescription: 'Collected and disposed of waste', department: 'Sanitation Department' },
  { category: 'garbage' as IssueCategory, locationType: 'commercial street', avgResolutionDays: 4, fixDescription: 'Cleared overflowing bins and cleaned area', department: 'Sanitation Department' },
  { category: 'other' as IssueCategory, locationType: 'public space', avgResolutionDays: 14, fixDescription: 'Assessed and routed to appropriate department', department: 'General Administration' },
];

// App content component (uses hooks)
const AppContent: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showReport, setShowReport] = useState(false);

  const loadIssues = async () => {
    try {
      const data = await getIssues();
      setIssues(data);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoading(false);
    }
  };

  // Seed precedents on first load
  const seedData = async () => {
    try {
      const snap = await getDocs(collection(db, 'precedents'));
      if (snap.empty) {
        await seedPrecedents(SEED_PRECEDENTS);
        console.log('✅ Precedents seeded');
      }
    } catch (error) {
      console.error('Failed to seed precedents:', error);
    }
  };
  

  useEffect(() => {
    seedData();
    loadIssues();
  }, []);

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
    // Navigate to detail view
    window.location.href = `/issue/${issue.id}`;
  };

  return (
    <Routes>
      <Route path="/" element={
        <Layout>
          <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)] min-h-[500px]">
            <div className="flex-1 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden relative" style={{ minHeight: '400px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                </div>
              ) : (
                <MapView issues={issues} onIssueClick={handleIssueClick} />
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-xs text-gray-500 border border-gray-200">
                {issues.length} issues reported · Click marker for details
              </div>
            </div>
            <div className="lg:w-80 bg-white rounded-xl shadow-md border border-gray-100 p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">Recent Reports</h3>
                <button
                  onClick={() => setShowReport(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  + Report
                </button>
              </div>
              {issues.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No issues reported yet.<br />Be the first!</p>
              ) : (
                <div className="space-y-2">
                  {issues.slice(0, 15).map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => handleIssueClick(issue)}
                      className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-800 truncate">{issue.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          issue.status === 'reported' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {issue.status === 'resolved' ? '✅' : issue.status === 'reported' ? '📋' : '📧'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {issue.category} · {new Date(issue.reportedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {showReport && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <ReportFlow
                  onSuccess={() => {
                    setShowReport(false);
                    loadIssues();
                  }}
                  onCancel={() => setShowReport(false)}
                />
              </div>
            </div>
          )}
        </Layout>
      } />
      <Route path="/issue/:id" element={
        <Layout>
          <IssueDetail />
        </Layout>
      } />
      <Route path="/report" element={
        <Layout>
          <div className="max-w-2xl mx-auto">
            <ReportFlow
              onSuccess={() => {
                // Navigate to home after success
                window.location.href = '/';
              }}
              onCancel={() => window.location.href = '/'}
            />
          </div>
        </Layout>
      } />
      <Route path="/profile" element={
        <Layout>
          <Profile />
        </Layout>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

// Main App
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;