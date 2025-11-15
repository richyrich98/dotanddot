import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { getAllLocationReports } from '../utils/firebase';

interface LocationReport {
  id?: string;
  defaultLocation: [number, number];
  correctedLocation: [number, number];
  timestamp: string;
}

interface LocationReportsProps {
  onBack: () => void;
}

const LocationReports: React.FC<LocationReportsProps> = ({ onBack }) => {
  const [reports, setReports] = useState<LocationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDefaultLocations, setShowDefaultLocations] = useState(true);
  const [showCorrectedLocations, setShowCorrectedLocations] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllLocationReports();
      setReports(data);
    } catch (err) {
      setError('Failed to load location reports');
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const ReportsRenderer = () => {
    const map = useMap();
    
    useEffect(() => {
      if (reports.length > 0) {
        const L = (window as any).L;
        
        // Clear existing markers
        map.eachLayer((layer: any) => {
          if (layer.options && (layer.options.className === 'report-marker-default' || layer.options.className === 'report-marker-corrected')) {
            map.removeLayer(layer);
          }
        });

        const allLocations: LatLng[] = [];

        reports.forEach((report, index) => {
          const defaultLatLng = new LatLng(report.defaultLocation[0], report.defaultLocation[1]);
          const correctedLatLng = new LatLng(report.correctedLocation[0], report.correctedLocation[1]);
          
          allLocations.push(defaultLatLng, correctedLatLng);

          // Add default location marker (blue)
          if (showDefaultLocations) {
            L.marker(defaultLatLng, {
              icon: L.divIcon({
                html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">${index + 1}</div>`,
                className: 'report-marker-default',
                iconSize: [24, 24]
              })
            }).addTo(map).bindPopup(`
              <div class="p-2">
                <h4 class="font-semibold text-blue-700 mb-1">GPS Location #${index + 1}</h4>
                <p class="text-xs text-gray-600">Default GPS reading</p>
                <p class="text-xs text-gray-500 mt-1">${new Date(report.timestamp).toLocaleString()}</p>
              </div>
            `);
          }

          // Add corrected location marker (orange)
          if (showCorrectedLocations) {
            L.marker(correctedLatLng, {
              icon: L.divIcon({
                html: `<div class="w-6 h-6 bg-orange-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">${index + 1}</div>`,
                className: 'report-marker-corrected',
                iconSize: [24, 24]
              })
            }).addTo(map).bindPopup(`
              <div class="p-2">
                <h4 class="font-semibold text-orange-700 mb-1">Corrected Location #${index + 1}</h4>
                <p class="text-xs text-gray-600">User-corrected position</p>
                <p class="text-xs text-gray-500 mt-1">${new Date(report.timestamp).toLocaleString()}</p>
              </div>
            `);
          }

          // Draw line between default and corrected locations
          if (showDefaultLocations && showCorrectedLocations) {
            L.polyline([defaultLatLng, correctedLatLng], {
              color: '#EF4444',
              weight: 2,
              opacity: 0.7,
              dashArray: '5, 5',
              className: 'accuracy-line'
            }).addTo(map);
          }
        });

        // Fit map to show all markers
        if (allLocations.length > 0) {
          const group = L.featureGroup(allLocations.map(loc => L.marker(loc)));
          map.fitBounds(group.getBounds().pad(0.1));
        }
      }
    }, [reports, map, showDefaultLocations, showCorrectedLocations]);

    return null;
  };

  const calculateDistance = (loc1: [number, number], loc2: [number, number]) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = loc1[0] * Math.PI/180;
    const φ2 = loc2[0] * Math.PI/180;
    const Δφ = (loc2[0]-loc1[0]) * Math.PI/180;
    const Δλ = (loc2[1]-loc1[1]) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading location reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Map</span>
            </button>
            
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">Location Accuracy Reports</h1>
              <p className="text-sm text-gray-500">{reports.length} reports collected</p>
            </div>
            
            <button
              onClick={loadReports}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowDefaultLocations(!showDefaultLocations)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  showDefaultLocations 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {showDefaultLocations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm font-medium">GPS Locations</span>
              </button>
              
              <button
                onClick={() => setShowCorrectedLocations(!showCorrectedLocations)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  showCorrectedLocations 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {showCorrectedLocations ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm font-medium">Corrected Locations</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>GPS Location</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Corrected Location</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #EF4444' }}></div>
                <span>Accuracy Error</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="h-[calc(100vh-200px)]">
        {reports.length > 0 ? (
          <MapContainer
            center={[28.6139, 77.2090]}
            zoom={13}
            className="h-full w-full"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community"
            />
            <ReportsRenderer />
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Yet</h3>
              <p className="text-gray-600">Location accuracy reports will appear here when users report GPS inaccuracies.</p>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      {reports.length > 0 && (
        <div className="bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{reports.length}</div>
                <div className="text-sm text-blue-700">Total Reports</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {reports.length > 0 ? 
                    Math.round(reports.reduce((acc, report) => 
                      acc + calculateDistance(report.defaultLocation, report.correctedLocation), 0
                    ) / reports.length) : 0}m
                </div>
                <div className="text-sm text-orange-700">Avg. Error Distance</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {reports.length > 0 ? 
                    Math.round(Math.max(...reports.map(report => 
                      calculateDistance(report.defaultLocation, report.correctedLocation)
                    ))) : 0}m
                </div>
                <div className="text-sm text-green-700">Max Error Distance</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationReports;