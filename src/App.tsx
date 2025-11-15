import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Share2, Eye, BarChart3 } from 'lucide-react';
import MapInterface from './components/MapInterface';
import PathViewer from './components/PathViewer';
import LocationReports from './components/LocationReports';
import Header from './components/Header';

function App() {
  const [mode, setMode] = useState<'create' | 'view' | 'reports'>('create');
  const [pathId, setPathId] = useState<string | null>(null);

  useEffect(() => {
    // Check if viewing a shared path
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPathId = urlParams.get('path');
    if (sharedPathId) {
      setPathId(sharedPathId);
      setMode('view');
    }
  }, []);

  const handlePathShared = (id: string) => {
    setPathId(id);
    // Update URL without page reload
    const newUrl = `${window.location.origin}${window.location.pathname}?path=${id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleBackToCreate = () => {
    setMode('create');
    setPathId(null);
    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleViewReports = () => {
    setMode('reports');
  };

  const handleBackFromReports = () => {
    setMode('create');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <Header />
      
      <main className="relative">
        {mode === 'create' ? (
          <div className="container mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Create Your Custom Path
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Draw a precise path to your doorstep and share it with delivery agents. 
                No more missed deliveries in areas with outdated maps.
              </p>
              
              {/* Quick Actions */}
              <div className="flex items-center justify-center space-x-4 mt-6">
                <button
                  onClick={handleViewReports}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">View Location Reports</span>
                </button>
              </div>
            </div>
            
            <MapInterface onPathShared={handlePathShared} />
          </div>
        ) : mode === 'view' ? (
          <PathViewer pathId={pathId} onBackToCreate={handleBackToCreate} />
        ) : (
          <LocationReports onBack={handleBackFromReports} />
        )}
      </main>
    </div>
  );
}

export default App;