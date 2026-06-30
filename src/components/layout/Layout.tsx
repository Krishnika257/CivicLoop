// src/components/layout/Layout.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Auth } from '../auth/Auth';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                CL
              </div>
              <span className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                Civic<span className="text-blue-600">Loop</span>
              </span>
              <span className="hidden md:inline text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Beta
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  to="/"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Map
                </Link>
                <Link
                  to="/report"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/report' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Report
                </Link>
                <Link
                  to="/profile"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Profile
                </Link>
              </nav>

              <Auth />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <span>CivicLoop — Hyperlocal Problem Solver</span>
            <span>Built for Hackathon · AI-powered civic engagement</span>
          </div>
        </div>
      </footer>
    </div>
  );
};