import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import { LatLng, Map as LeafletMap } from 'leaflet';
import { 
  Pencil, 
  Share2, 
  MapIcon, 
  Satellite, 
  Navigation, 
  Trash2,
  CheckCircle,
  Copy,
  Crosshair,
  Search,
  X,
  AlertTriangle,
  Send,
  Save,
  User,
  LogIn,
  LogOut,
  FolderOpen,
  Mail
} from 'lucide-react';
import { savePath, reportLocationAccuracy, saveUserPath, getUserPaths, shareUserPath } from '../utils/firebase';
import { getCurrentUser, signInWithEmail, verifyOtp, signOut, onAuthStateChange } from '../utils/supabase';

interface MapInterfaceProps {
  onPathShared: (pathId: string) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

interface LocationReport {
  defaultLocation: [number, number];
  correctedLocation: [number, number];
  timestamp: string;
}

interface SavedPath {
  id: string;
  name: string;
  description?: string;
  coordinates: [number, number][];
  createdAt: string;
  userLocation?: [number, number];
}

const MapInterface: React.FC<MapInterfaceProps> = ({ onPathShared }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<LatLng[]>([]);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('satellite');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [correctedLocation, setCorrectedLocation] = useState<LatLng | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showAccuracyReport, setShowAccuracyReport] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  
  // Authentication and user paths
  const [user, setUser] = useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showUserPaths, setShowUserPaths] = useState(false);
  const [pathName, setPathName] = useState('');
  const [pathDescription, setPathDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userPaths, setUserPaths] = useState<SavedPath[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(false);
  
  // Email OTP Authentication
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const mapRef = useRef<LeafletMap | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathMarkersRef = useRef<any[]>([]);
  const userLocationMarkerRef = useRef<any>(null);
  const correctedLocationMarkerRef = useRef<any>(null);

  useEffect(() => {
    // Check authentication state
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Debug geolocation permissions
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
        console.log('Geolocation permission state:', result.state);
      });
    }

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = new LatLng(latitude, longitude);
          setUserLocation(location);
          if (mapRef.current) {
            mapRef.current.setView(location, 19);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert(`Error: ${error.message} (code: ${error.code})`);
          // Default to a location in India if geolocation fails
          const defaultLocation = new LatLng(28.6139, 77.2090); // New Delhi
          setUserLocation(defaultLocation);
          if (mapRef.current) {
            mapRef.current.setView(defaultLocation, 12);
          }
        }
      );
    }
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length > 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchAddress(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const searchAddress = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in&addressdetails=1`
      );
      const results = await response.json();
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const location = new LatLng(lat, lon);
    
    if (mapRef.current) {
      mapRef.current.setView(location, 18);
    }
    
    setSearchQuery(result.display_name);
    setShowSearchResults(false);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = new LatLng(latitude, longitude);
        setUserLocation(location);
        setCorrectedLocation(null); // Reset corrected location
        
        if (mapRef.current) {
          mapRef.current.setView(location, 20); // Maximum zoom level
        }
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Could not get your current location. Please check your location permissions.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleSignIn = () => {
    setShowAuthDialog(true);
    setAuthStep('email');
    setAuthError(null);
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setAuthError('Please enter your email address');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      await signInWithEmail(email.trim());
      setAuthStep('otp');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      setAuthError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setAuthError('Please enter the OTP code');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      await verifyOtp(email.trim(), otp.trim());
      setShowAuthDialog(false);
      setAuthStep('email');
      setEmail('');
      setOtp('');
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setAuthError(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setUserPaths([]);
      setShowUserPaths(false);
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const loadUserPaths = async () => {
    if (!user) return;
    
    setLoadingPaths(true);
    try {
      const paths = await getUserPaths();
      setUserPaths(paths);
    } catch (error) {
      console.error('Error loading user paths:', error);
      alert('Failed to load saved paths.');
    } finally {
      setLoadingPaths(false);
    }
  };

  const handleShowUserPaths = () => {
    setShowUserPaths(true);
    loadUserPaths();
  };

  const handleLoadPath = (path: SavedPath) => {
    const pathCoords = path.coordinates.map(coord => new LatLng(coord[0], coord[1]));
    setCurrentPath(pathCoords);
    setShowUserPaths(false);
    
    // Center map on the path
    if (mapRef.current && pathCoords.length > 0) {
      const bounds = pathCoords.reduce((bounds, coord) => bounds.extend(coord), new (window as any).L.LatLngBounds(pathCoords[0], pathCoords[0]));
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  const handleSaveUserPath = async () => {
    if (!user) {
      alert('Please sign in to save paths.');
      return;
    }

    if (currentPath.length < 2) {
      alert('Please draw a path with at least 2 points before saving.');
      return;
    }

    if (!pathName.trim()) {
      alert('Please enter a name for your path.');
      return;
    }

    setIsSaving(true);
    try {
      const pathData = {
        name: pathName.trim(),
        description: pathDescription.trim(),
        coordinates: currentPath.map(point => [point.lat, point.lng] as [number, number]),
        createdAt: new Date().toISOString(),
        userLocation: userLocation ? [userLocation.lat, userLocation.lng] as [number, number] : undefined
      };

      await saveUserPath(pathData);
      setSaveSuccess(true);
      setPathName('');
      setPathDescription('');
      
      setTimeout(() => {
        setSaveSuccess(false);
        setShowSaveDialog(false);
      }, 2000);
      
      // Reload user paths
      loadUserPaths();
    } catch (error) {
      console.error('Error saving path:', error);
      alert('Failed to save path. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareUserPath = async (userPathId: string) => {
    try {
      const pathId = await shareUserPath(userPathId);
      const shareUrl = `${window.location.origin}${window.location.pathname}?path=${pathId}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
      
      onPathShared(pathId);
    } catch (error) {
      console.error('Error sharing path:', error);
      alert('Failed to create share link. Please try again.');
    }
  };

  const DrawingHandler = () => {
    useMapEvents({
      click: (e) => {
        if (isDrawing) {
          setCurrentPath(prev => [...prev, e.latlng]);
        }
      }
    });
    return null;
  };

  const PathRenderer = () => {
    const map = useMap();
    
    useEffect(() => {
      if (currentPath.length > 0) {
        // Clear existing path markers and lines
        pathMarkersRef.current.forEach(marker => {
          map.removeLayer(marker);
        });
        pathMarkersRef.current = [];

        // Clear existing path lines
        map.eachLayer((layer: any) => {
          if (layer.options && layer.options.className === 'custom-path') {
            map.removeLayer(layer);
          }
        });

        // Draw new path
        if (currentPath.length > 1) {
          const L = (window as any).L;
          const polyline = L.polyline(currentPath, {
            color: '#10B981',
            weight: 4,
            opacity: 0.8,
            className: 'custom-path'
          }).addTo(map);

          // Add markers for start and end
          if (currentPath.length >= 2) {
            const startMarker = L.marker(currentPath[0], {
              icon: L.divIcon({
                html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>',
                className: 'custom-marker',
                iconSize: [16, 16]
              })
            }).addTo(map);

            const endMarker = L.marker(currentPath[currentPath.length - 1], {
              icon: L.divIcon({
                html: '<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>',
                className: 'custom-marker',
                iconSize: [16, 16]
              })
            }).addTo(map);

            pathMarkersRef.current = [startMarker, endMarker];
          }
        }

        // Add intermediate point markers
        if (currentPath.length > 2) {
          const L = (window as any).L;
          for (let i = 1; i < currentPath.length - 1; i++) {
            const intermediateMarker = L.marker(currentPath[i], {
              icon: L.divIcon({
                html: '<div class="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>',
                className: 'custom-marker',
                iconSize: [12, 12]
              })
            }).addTo(map);
            pathMarkersRef.current.push(intermediateMarker);
          }
        }
      }
    }, [currentPath, map]);

    return null;
  };

  const UserLocationMarker = () => {
    const map = useMap();
    
    useEffect(() => {
      if (userLocation) {
        // Remove existing user location marker
        if (userLocationMarkerRef.current) {
          map.removeLayer(userLocationMarkerRef.current);
        }

        // Add user location marker (blue - default GPS location)
        const L = (window as any).L;
        userLocationMarkerRef.current = L.marker(userLocation, {
          icon: L.divIcon({
            html: '<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse"><div class="w-2 h-2 bg-white rounded-full"></div></div>',
            className: 'user-location-marker',
            iconSize: [24, 24]
          })
        }).addTo(map).bindPopup('Your GPS Location (Default)', {
          offset: [0, -15],
          closeButton: true,
          autoClose: false,
          closeOnClick: false
        });
      }
    }, [userLocation, map]);

    return null;
  };

  const CorrectedLocationMarker = () => {
    const map = useMap();
    
    useEffect(() => {
      if (correctedLocation) {
        // Remove existing corrected location marker
        if (correctedLocationMarkerRef.current) {
          map.removeLayer(correctedLocationMarkerRef.current);
        }

        // Add corrected location marker (orange - user corrected)
        const L = (window as any).L;
        correctedLocationMarkerRef.current = L.marker(correctedLocation, {
          icon: L.divIcon({
            html: '<div class="w-7 h-7 bg-orange-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center"><div class="w-3 h-3 bg-white rounded-full"></div></div>',
            className: 'corrected-location-marker',
            iconSize: [28, 28]
          }),
          draggable: true
        }).addTo(map).bindPopup('Your Corrected Location (Drag to adjust)', {
          offset: [0, -20],
          closeButton: true,
          autoClose: false,
          closeOnClick: false
        });

        // Handle dragging
        correctedLocationMarkerRef.current.on('dragend', (e: any) => {
          const newPosition = e.target.getLatLng();
          setCorrectedLocation(newPosition);
        });
      }
    }, [correctedLocation, map]);

    return null;
  };

  const LocationClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (!isDrawing && userLocation && !correctedLocation) {
          // Allow user to set corrected location by clicking on map
          setCorrectedLocation(e.latlng);
          setShowAccuracyReport(true);
        }
      }
    });
    return null;
  };

  const handleStartDrawing = () => {
    setIsDrawing(!isDrawing);
    if (isDrawing) {
      // Stop drawing
      setCurrentPath([]);
    }
  };

  const handleClearPath = () => {
    setCurrentPath([]);
    setIsDrawing(false);
    
    // Clear path markers
    pathMarkersRef.current.forEach(marker => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    });
    pathMarkersRef.current = [];
    
    // Clear path lines from map
    if (mapRef.current) {
      mapRef.current.eachLayer((layer: any) => {
        if (layer.options && layer.options.className === 'custom-path') {
          mapRef.current!.removeLayer(layer);
        }
      });
    }
  };

  const handleReportAccuracy = async () => {
    if (!userLocation || !correctedLocation) {
      alert('Both default and corrected locations are required to report accuracy.');
      return;
    }

    setIsReporting(true);
    try {
      const report: LocationReport = {
        defaultLocation: [userLocation.lat, userLocation.lng],
        correctedLocation: [correctedLocation.lat, correctedLocation.lng],
        timestamp: new Date().toISOString()
      };

      await reportLocationAccuracy(report);
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowAccuracyReport(false);
      }, 3000);
    } catch (error) {
      console.error('Error reporting accuracy:', error);
      alert('Failed to report accuracy. Please try again.');
    } finally {
      setIsReporting(false);
    }
  };

  const handleShare = async () => {
    if (currentPath.length < 2) {
      alert('Please draw a path with at least 2 points before sharing.');
      return;
    }

    setIsSharing(true);
    try {
      const pathData = {
        coordinates: currentPath.map(point => [point.lat, point.lng]),
        createdAt: new Date().toISOString(),
        userLocation: userLocation ? [userLocation.lat, userLocation.lng] : null
      };

      const pathId = await savePath(pathData);
      const shareUrl = `${window.location.origin}${window.location.pathname}?path=${pathId}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
      
      onPathShared(pathId);
    } catch (error) {
      console.error('Error sharing path:', error);
      alert('Failed to share path. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const tileUrl = mapType === 'satellite' 
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Authentication Bar */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-500">Signed in</p>
                  </div>
                </div>
                <button
                  onClick={handleShowUserPaths}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm font-medium">My Paths</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm font-medium">Sign in with Email</span>
              </button>
            )}
          </div>
          
          {user && (
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign out</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for an address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.place_id}
                  onClick={() => handleSearchResultClick(result)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {result.display_name}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {isSearching && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-center">
              <div className="text-sm text-gray-500">Searching...</div>
            </div>
          )}
        </div>
      </div>

      {/* Map Controls */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {mapType === 'standard' ? <Satellite className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {mapType === 'standard' ? 'Satellite' : 'Standard'}
              </span>
            </button>

            <button
              onClick={handleCurrentLocation}
              disabled={isLocating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">
                {isLocating ? 'Locating...' : 'My Location'}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleStartDrawing}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                isDrawing 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <Pencil className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isDrawing ? 'Stop Drawing' : 'Start Drawing'}
              </span>
            </button>

            {currentPath.length > 0 && (
              <button
                onClick={handleClearPath}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Clear</span>
              </button>
            )}

            {currentPath.length >= 2 && user && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span className="text-sm font-medium">Save Path</span>
              </button>
            )}

            {currentPath.length >= 2 && (
              <button
                onClick={handleShare}
                disabled={isSharing}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  shareSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-green-500 text-white hover:bg-green-600'
                } ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {shareSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {isSharing ? 'Sharing...' : 'Share Path'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {isDrawing && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Drawing Mode Active:</strong> Click on the map to add points to your path. 
              Click "Stop Drawing\" when you're done.
            </p>
          </div>
        )}

        {userLocation && !isDrawing && !correctedLocation && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700">
              <strong>Location Accuracy:</strong> Click on the map to mark your exact location if the GPS location (blue pin) is not accurate.
            </p>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="h-96 md:h-[500px] relative">
        <MapContainer
          center={[28.6139, 77.2090]}
          zoom={13}
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
          <DrawingHandler />
          <LocationClickHandler />
          <PathRenderer />
          <UserLocationMarker />
          <CorrectedLocationMarker />
        </MapContainer>

        {/* Instructions Overlay */}
        {currentPath.length === 0 && !isDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg max-w-sm text-center">
              <Navigation className="w-8 h-8 text-blue-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to Create Your Path?
              </h3>
              <p className="text-sm text-gray-600">
                Search for an address or use "My Location", then click "Start Drawing" to create a custom path.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Path Info */}
      {currentPath.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{currentPath.length} points</span> in your path
            </div>
            {currentPath.length >= 2 && (
              <div className="text-sm text-green-600 font-medium">
                ✓ Path ready to share
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Legend */}
      {(userLocation || correctedLocation) && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-center space-x-6 text-xs text-gray-600">
            {userLocation && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>GPS Location</span>
              </div>
            )}
            {correctedLocation && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Corrected Location (Draggable)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authentication Dialog */}
      {showAuthDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {authStep === 'email' ? 'Sign in with Email' : 'Enter Verification Code'}
              </h3>
              <button
                onClick={() => setShowAuthDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {authStep === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendOtp()}
                  />
                </div>
                
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{authError}</p>
                  </div>
                )}
                
                <button
                  onClick={handleSendOtp}
                  disabled={isAuthenticating}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isAuthenticating
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                >
                  <Mail className="w-4 h-4" />
                  <span>{isAuthenticating ? 'Sending...' : 'Send Verification Code'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                    maxLength={6}
                    onKeyPress={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Check your email for the verification code
                  </p>
                </div>
                
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{authError}</p>
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setAuthStep('email');
                      setOtp('');
                      setAuthError(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={isAuthenticating}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                      isAuthenticating
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isAuthenticating ? 'Verifying...' : 'Verify & Sign In'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Path Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Your Path</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Path Name *
                </label>
                <input
                  type="text"
                  value={pathName}
                  onChange={(e) => setPathName(e.target.value)}
                  placeholder="e.g., Home to Office"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={pathDescription}
                  onChange={(e) => setPathDescription(e.target.value)}
                  placeholder="Add any notes about this path..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserPath}
                disabled={isSaving || !pathName.trim()}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } ${(isSaving || !pathName.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Save Path'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Paths Dialog */}
      {showUserPaths && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">My Saved Paths</h3>
                <button
                  onClick={() => setShowUserPaths(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingPaths ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your paths...</p>
                </div>
              ) : userPaths.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Saved Paths</h4>
                  <p className="text-gray-600">Create and save your first path to see it here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userPaths.map((path) => (
                    <div key={path.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{path.name}</h4>
                          {path.description && (
                            <p className="text-sm text-gray-600 mb-2">{path.description}</p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{path.coordinates.length} points</span>
                            <span>{new Date(path.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleLoadPath(path)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleShareUserPath(path.id)}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                          >
                            Share
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location Accuracy Report Modal */}
      {showAccuracyReport && userLocation && correctedLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900">Report Location Accuracy</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-blue-900">GPS Location (Default)</p>
                  <p className="text-xs text-blue-700">
                    {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-orange-900">Corrected Location</p>
                  <p className="text-xs text-orange-700">
                    {correctedLocation.lat.toFixed(6)}, {correctedLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAccuracyReport(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReportAccuracy}
                disabled={isReporting}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  reportSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                } ${isReporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {reportSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Reported!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{isReporting ? 'Reporting...' : 'Report Issue'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapInterface;