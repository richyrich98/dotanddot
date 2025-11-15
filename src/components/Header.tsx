import React from 'react';
import { Navigation, MapPin } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Correctit
              </h1>
              <p className="text-sm text-gray-500">Smart Delivery Navigation</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>Accurate Paths</span>
            </div>
            <div className="flex items-center space-x-2">
              <Navigation className="w-4 h-4" />
              <span>Real-time Location</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;