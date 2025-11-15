import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { LatLng, Map as LeafletMap } from 'leaflet';
import { 
  ArrowLeft, 
  Navigation, 
  MapIcon, 
  Satellite, 
  MapPin,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { getPath } from '../utils/firebase';

interface PathViewerProps {
  pathId: string | null;
  onBackToCreate: () => void;
}

interface PathData {
  coordinates: [number, number][];
  createdAt: string;
  userLocation?: [number, number];
}

const PathViewer: React.FC<PathViewerProps> = ({ pathId, onBackToCreate }) => {
  const [pathData, setPathData] = useState<PathData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('satellite');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const loadPath = async () => {
      if (!pathId) {
        setError('No path ID provided');
        setLoading(false);
        return;
      }

      try {
        const data = await getPath(pathId);
        if (data) {
          setPathData(data);
        } else {
          setError('Path not found');
        }
      } catch (err) {
        setError('Failed to load path');
        console.error('Error loading path:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPath();
  }, [pathId]);

  useEffect(() => {
    // Start location tracking when component mounts
    startLocationTracking();
    
    return () => {
      // Cleanup location tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    setTrackingLocation(true);
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = new LatLng(latitude, longitude);
        setUserLocation(location);
        setTrackingLocation(false);
      },
      (error) => {
        console.warn('Location tracking error:', error);
        setTrackingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  const PathRenderer = () => {
    const map = useMap();
    
    useEffect(() => {
      if (pathData && pathData.coordinates.length > 0) {
        const L = (window as any).L;
        
        // Clear existing layers
        map.eachLayer((layer: any) => {
          if (layer.options && (layer.options.className === 'custom-path' || layer.options.className === 'user-location')) {
            map.removeLayer(layer);
          }
        });

        // Convert coordinates to LatLng objects
        const pathCoords = pathData.coordinates.map(coord => new LatLng(coord[0], coord[1]));

        // Draw the path
        const polyline = L.polyline(pathCoords, {
          color: '#10B981',
          weight: 5,
          opacity: 0.9,
          className: 'custom-path'
        }).addTo(map);

        // Add start marker (green)
        L.marker(pathCoords[0], {
          icon: L.divIcon({
            html: '<div class="w-6 h-6 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></div>',
            className: 'custom-marker',
            iconSize: [24, 24]
          })
        }).addTo(map).bindPopup('Start Point');

        // Add end marker (red)
        L.marker(pathCoords[pathCoords.length - 1], {
          icon: L.divIcon({
            html: '<div class="w-6 h-6 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></div>',
            className: 'custom-marker',
            iconSize: [24, 24]
          })
        }).addTo(map).bindPopup('Destination');

        // Fit map to show the entire path
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      }
    }, [pathData, map]);

    useEffect(() => {
      if (userLocation) {
        const L = (window as any).L;
        
        // Remove existing user location marker
        map.eachLayer((layer: any) => {
          if (layer.options && layer.options.className === 'user-location') {
            map.removeLayer(layer);
          }
        });

        // Add user location marker (blue)
        L.marker(userLocation, {
          icon: L.divIcon({
            html: '<div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse"><div class="w-3 h-3 bg-white rounded-full"></div></div>',
            className: 'user-location',
            iconSize: [32, 32]
          })
        }).addTo(map).bindPopup('Your Current Location');
      }
    }, [userLocation, map]);

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading path...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Path Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onBackToCreate}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create New Path
          </button>
        </div>
      </div>
    );
  }

  const tileUrl = mapType === 'satellite' 
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBackToCreate}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Create</span>
            </button>
            
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">Delivery Path</h1>
              <p className="text-sm text-gray-500">Follow the green path to reach destination</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs ${
                userLocation 
                  ? 'bg-green-100 text-green-700' 
                  : trackingLocation 
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
              }`}>
                <div className="w-2 h-2 rounded-full bg-current"></div>
                <span>
                  {userLocation ? 'Located' : trackingLocation ? 'Locating...' : 'No GPS'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {mapType === 'standard' ? <Satellite className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {mapType === 'standard' ? 'Satellite' : 'Standard'}
                </span>
              </button>
              
              <button
                onClick={startLocationTracking}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${trackingLocation ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh Location</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Start</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Destination</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Your Location</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="h-[calc(100vh-180px)]">
        <MapContainer
          center={[28.6139, 77.2090]}
          zoom={15}
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            url={tileUrl}
            attribution={mapType === 'satellite' 
              ? '&copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
          />
          <PathRenderer />
        </MapContainer>
      </div>

      {/* Instructions */}
      <div className="bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Navigation className="w-4 h-4 text-green-500" />
              <span>Follow the <strong className="text-green-600">green path</strong> to reach your destination</span>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              <span>Your location updates automatically</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathViewer;