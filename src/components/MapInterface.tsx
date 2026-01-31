import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map, { Marker, NavigationControl, Source, Layer, Popup } from 'react-map-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import mapboxgl from 'mapbox-gl';
import { 
  Pencil, 
  Share2, 
  MapIcon, 
  Satellite, 
  Navigation, 
  Trash2,
  CheckCircle,
  Crosshair,
  Search,
  X,
  AlertTriangle,
  Send,
  Save,
  User,
  LogOut,
  FolderOpen,
  Mail
} from 'lucide-react';
import { savePath, reportLocationAccuracy, saveUserPath, getUserPaths, shareUserPath } from '../utils/firebase';
import { getCurrentUser, signInWithEmail, signOut, onAuthStateChange } from '../utils/supabase';

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
  vertexData?: Record<string, any>;
}

const MapInterface: React.FC<MapInterfaceProps> = ({ onPathShared }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<[number, number][]>([]);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('satellite');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [correctedLocation, setCorrectedLocation] = useState<[number, number] | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  // For dragging corrected location

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
  const [email, setEmail] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const mapRef = useRef<any>(null);
  const didCenterRef = useRef<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 3D toggle state
  const [enable3D, setEnable3D] = useState<boolean>(true);
  // Vertex notes and finish state for drawn path
  const [vertexNotes, setVertexNotes] = useState<Record<number, string>>({});
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  // hover state no longer needed with circle layer picking
  const [pathFinished, setPathFinished] = useState<boolean>(false);

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
      // If this window was opened by a magic link in a new tab, close it and focus the original
      try {
        if (user && window.opener) {
          // Focus original tab
          window.opener.focus();
          // Replace current URL to avoid leaving a hash or query, then close
          window.history.replaceState({}, document.title, window.opener.location?.href || '/');
          window.close();
        }
      } catch (e) {
        // Ignore errors, continue normal flow
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // When userLocation becomes available the first time, center the map
  useEffect(() => {
    const map = (mapRef.current?.getMap?.() || mapRef.current);
    if (!map || !userLocation) return;
    if (!didCenterRef.current) {
      try {
        map.flyTo?.({ center: userLocation, zoom: 16 });
        didCenterRef.current = true;
      } catch (_) {}
    }
  }, [userLocation]);

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
          setUserLocation([longitude, latitude]);
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert(`Error: ${error.message} (code: ${error.code})`);
          setUserLocation([77.2090, 28.6139]); // New Delhi
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
    setUserLocation([lon, lat]);
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
        setUserLocation([longitude, latitude]);
        setCorrectedLocation(null); // Reset corrected location
        setIsLocating(false);
        // Center the map on the new location
        const map = (mapRef.current?.getMap?.() || mapRef.current);
        if (map?.flyTo) {
          map.flyTo({ center: [longitude, latitude], zoom: 16 });
        }
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
    setAuthError(null);
  };

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      setAuthError('Please enter your email address');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await signInWithEmail(email.trim());
      alert('Check your email for the login link.');
      setShowAuthDialog(false);
      setEmail('');
    } catch (error: any) {
      console.error('Error sending magic link:', error);
      setAuthError(error.message || 'Failed to send magic link. Please try again.');
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
    setCurrentPath(path.coordinates);
    setShowUserPaths(false);
    // Load vertex notes if present
    const loadedNotes: Record<number, string> = {};
    if (path.vertexData) {
      Object.keys(path.vertexData).forEach((k) => {
        const idx = Number(k);
        const v = (path.vertexData as any)[k];
        if (!Number.isNaN(idx) && v && typeof v.note === 'string') {
          loadedNotes[idx] = v.note;
        }
      });
    }
    setVertexNotes(loadedNotes);
    setPathFinished(true);
    // Center map on the path
    try {
      const map = (mapRef.current?.getMap?.() || mapRef.current);
      if (!map || !path.coordinates || path.coordinates.length === 0) return;
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [lng, lat] of path.coordinates) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
      if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
        if (Math.abs(maxLng - minLng) < 1e-6 && Math.abs(maxLat - minLat) < 1e-6) {
          map.flyTo?.({ center: [minLng, minLat], zoom: 17 });
        } else if (map.fitBounds) {
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, maxZoom: 18, duration: 800 });
        }
      }
    } catch (_) {}
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
      // Convert notes to vertexData payload
      const vertexData: Record<string, any> = {};
      Object.keys(vertexNotes).forEach((k) => {
        vertexData[String(k)] = { note: vertexNotes[Number(k)] };
      });
      const pathData = {
        name: pathName.trim(),
        description: pathDescription.trim(),
        coordinates: currentPath,
        createdAt: new Date().toISOString(),
        userLocation: userLocation ? userLocation : undefined,
        vertexData,
      };
  console.log('[handleSaveUserPath] Payload', pathData);
  await saveUserPath(pathData);
      setSaveSuccess(true);
      setPathName('');
      setPathDescription('');
      setTimeout(() => {
        setSaveSuccess(false);
        setShowSaveDialog(false);
      }, 2000);
      loadUserPaths();
    } catch (error: any) {
      console.error('Error saving path:', error);
      const msg = error?.message || error?.error || 'Failed to save path. Please try again.';
      alert(msg);
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

  // All Leaflet/React-Leaflet drawing and marker logic removed for Mapbox migration.

  const handleStartDrawing = () => {
    const next = !isDrawing;
    setIsDrawing(next);
    if (next) {
      // Begin new drawing session
      setCurrentPath([]);
      setVertexNotes({});
      setActiveNoteIndex(null);
      setNoteDraft('');
      setPathFinished(false);
    } else {
      // Cancel drawing, clear sketch
      setCurrentPath([]);
      setVertexNotes({});
      setActiveNoteIndex(null);
      setNoteDraft('');
      setPathFinished(false);
    }
  };

  const handleClearPath = () => {
    setCurrentPath([]);
    setIsDrawing(false);
    
    // Clear path markers
  // No marker cleanup needed for Mapbox version
  };

  const handleReportAccuracy = async () => {
    if (!userLocation || !correctedLocation) {
      alert('Both default and corrected locations are required to report accuracy.');
      return;
    }

    setIsReporting(true);
    try {
      const report: LocationReport = {
  defaultLocation: userLocation,
  correctedLocation: correctedLocation,
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
      const vertexData: Record<string, any> = {};
      Object.keys(vertexNotes).forEach((k) => {
        vertexData[String(k)] = { note: vertexNotes[Number(k)] };
      });
      const pathData = {
        coordinates: currentPath,
        createdAt: new Date().toISOString(),
        userLocation: userLocation ? userLocation : undefined,
        vertexData,
      };

  console.log('[handleShare] Payload', pathData);
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

  // helper to disable terrain/buildings safely
  const disable3D = (map: any) => {
    try { map.setTerrain(null); } catch (_) {}
    try { if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings'); } catch (_) {}
    try { if (map.getLayer('3d-buildings-fallback')) map.removeLayer('3d-buildings-fallback'); } catch (_) {}
    try { map.setPitch?.(0); } catch (_) {}
    // keep sky; it’s harmless, but remove if desired
  };

  // GeoJSON for vertex points
  const verticesGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: currentPath.map((coord, idx) => ({
        type: 'Feature',
        properties: {
          idx,
          isStart: idx === 0,
          isEnd: pathFinished && idx === currentPath.length - 1,
          note: vertexNotes[idx] || ''
        },
        geometry: { type: 'Point', coordinates: coord }
      }))
    } as any;
  }, [currentPath, pathFinished, vertexNotes]);

  // enhance existing onLoad handler to respect enable3D
  const onLoad = (evt: any) => {
    const map = evt.target;
    // Re-apply when style changes (e.g., switching standard/satellite)
    try {
      map.on?.('style.load', () => {
        if (enable3D) handleMapLoad({ target: map }); else disable3D(map);
      });
      // Bind vertex layer click for note editing (Mapbox GL only)
      map.on?.('click', 'vertex-circles', (e: any) => {
        const f = e?.features?.[0];
        const idx = f?.properties?.idx;
        if (idx !== undefined && idx !== null) {
          setActiveNoteIndex(Number(idx));
          setNoteDraft(vertexNotes[Number(idx)] || '');
        }
      });
    } catch (_) {}

    if (!enable3D) { disable3D(map); return; }
    handleMapLoad(evt); // previously added safe loader
  };

  // onLoad handler for Map component
  const handleMapLoad = (evt: any) => {
    try {
      const map = evt.target;
      const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);

      // Only attempt 3D features when using Mapbox GL with a Mapbox style
      if (!hasToken) return;

      const style = map.getStyle?.();
      if (!style || !style.sources) return;

      // Ensure a DEM source exists, else add one
      const demSourceId = 'mapbox-dem';
      if (!map.getSource(demSourceId)) {
        // Add DEM source only if style is Mapbox and supports it
        map.addSource(demSourceId, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }

      // Set terrain safely
      try {
        map.setTerrain({ source: demSourceId, exaggeration: 1.0 });
  // If 3D is enabled, ensure a pleasant tilt
  map.setPitch?.(60);
      } catch (e) {
        // ignore if terrain not supported
      }

      // Add sky layer if missing
      if (!map.getLayer('sky')) {
        try {
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15,
            },
          });
        } catch (e) {
          // ignore if sky not supported
        }
      }

      // Add 3D buildings using extrusion if not present
      // Use Mapbox composite source if available
      const hasComposite = Boolean(style.sources['composite']);
      if (hasComposite && !map.getLayer('3d-buildings')) {
        try {
          map.addLayer(
            {
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              filter: ['==', ['get', 'extrude'], 'true'],
              type: 'fill-extrusion',
              minzoom: 15,
              paint: {
                'fill-extrusion-color': '#aaa',
                // Use height and base height properties for realistic extrusion
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.6,
              },
            },
            // Place 3D buildings beneath labels if available
            style.layers?.find((l: any) => l.type && String(l.type).includes('symbol'))?.id || undefined
          );
        } catch (e) {
          // If the specific filter fails, try a more generic 3D building layer
          if (!map.getLayer('3d-buildings-fallback')) {
            try {
              map.addLayer({
                id: '3d-buildings-fallback',
                source: 'composite',
                'source-layer': 'building',
                type: 'fill-extrusion',
                minzoom: 15,
                paint: {
                  'fill-extrusion-color': '#bbb',
                  'fill-extrusion-height': ['coalesce', ['get', 'height'], 20],
                  'fill-extrusion-opacity': 0.5,
                },
              });
            } catch (_) {
              // give up quietly
            }
          }
        }
      }
    } catch (err) {
      // Swallow errors to avoid breaking map interaction
      // console.debug('Map onLoad 3D setup skipped:', err);
    }
  };

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

            {/* 3D toggle */}
            <button
              onClick={() => {
                const next = !enable3D;
                setEnable3D(next);
                const map = (mapRef.current?.getMap?.() || mapRef.current);
                try { map?.setPitch?.(next ? 60 : 0); } catch (_) {}
              }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${enable3D ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
              title="Toggle 3D terrain and buildings"
            >
              <MapIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{enable3D ? '3D: On' : '3D: Off'}</span>
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
              <strong>Drawing Mode Active:</strong> Click to add vertices. Double-tap to finish. Click a vertex to add a note.
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

      {/* Mapbox GL JS Map Section */}
      <div className="h-96 md:h-[500px] relative">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: userLocation ? userLocation[0] : 77.2090,
            latitude: userLocation ? userLocation[1] : 28.6139,
            zoom: 16,
            pitch: enable3D ? 60 : 0,
            bearing: 0,
          }}
          dragPan
          dragRotate
          scrollZoom
          touchPitch
          keyboard
          mapStyle={
            import.meta.env.VITE_MAPBOX_TOKEN
              ? (mapType === 'satellite'
                  ? 'mapbox://styles/mapbox/satellite-streets-v12'
                  : 'mapbox://styles/mapbox/streets-v12')
              : (mapType === 'satellite'
                  ? 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
                  : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')
          }
          maxZoom={24}
          minZoom={3}
          style={{ width: '100%', height: '100%' }}
          mapLib={(import.meta.env.VITE_MAPBOX_TOKEN ? (mapboxgl as any) : (maplibregl as any))}
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          interactiveLayerIds={['vertex-circles']}
          onLoad={onLoad}
          onClick={e => {
            // If clicked on a vertex, open note editor
            try {
              const map = (mapRef.current?.getMap?.() || mapRef.current);
              const features = map?.queryRenderedFeatures?.(e.point, { layers: ['vertex-circles'] }) || [];
              if (features.length) {
                const f = features[0];
                const idx = f?.properties?.idx;
                if (idx !== undefined && idx !== null) {
                  setActiveNoteIndex(Number(idx));
                  setNoteDraft(vertexNotes[Number(idx)] || '');
                  return;
                }
              }
            } catch (_) {}
            if (isDrawing) {
              const { lng, lat } = e.lngLat;
              // Detect double-tap to finish: if previous vertex exists and time delta small
              const now = Date.now();
              const last = (window as any).__lastTapTime || 0;
              (window as any).__lastTapTime = now;
              const isDouble = now - last < 350; // 350ms threshold
              if (isDouble && currentPath.length >= 1) {
                setPathFinished(true);
                setIsDrawing(false);
                // Highlight last vertex in red by re-render conditionally
                return;
              }
              setCurrentPath(prev => [...prev, [lng, lat]]);
            } else if (!isDrawing && userLocation && !correctedLocation) {
              // Allow user to set corrected location by clicking on map
              setCorrectedLocation([e.lngLat.lng, e.lngLat.lat]);
              setShowAccuracyReport(true);
            }
          }}
        >
          <NavigationControl />
          {/* User location marker */}
          {userLocation && (
            <Marker longitude={userLocation[0]} latitude={userLocation[1]}>
              <div style={{background:'#0074D9',borderRadius:'50%',width:16,height:16,border:'2px solid #fff'}} />
            </Marker>
          )}
          {/* Corrected location marker (draggable) */}
          {correctedLocation && (
            <Marker
              longitude={correctedLocation[0]}
              latitude={correctedLocation[1]}
              draggable
              onDragEnd={e => setCorrectedLocation([e.lngLat.lng, e.lngLat.lat])}
            >
              <div style={{background:'#FFA500',borderRadius:'50%',width:20,height:20,border:'2px solid #fff'}} />
            </Marker>
          )}
          {/* Drawn path as a line */}
          {currentPath.length > 1 && (
            <Source id="drawn-path" type="geojson" data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: currentPath }
            }}>
              <Layer id="drawn-path" type="line" paint={{ 'line-color': '#0074D9', 'line-width': 4 }} />
            </Source>
          )}

          {/* Vertex points as a circle layer for crisp rendering */}
          {currentPath.length > 0 && (
            <Source id="vertices" type="geojson" data={verticesGeoJson}>
              <Layer
                id="vertex-circles"
                type="circle"
                paint={{
                  'circle-radius': 7,
                  'circle-color': ['case', ['get', 'isStart'], '#22c55e', ['case', ['get', 'isEnd'], '#ef4444', '#1f2937']],
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                }}
              />
            </Source>
          )}

          {/* Note editor popup */}
          {activeNoteIndex !== null && currentPath[activeNoteIndex] && (
            <Popup
              longitude={currentPath[activeNoteIndex][0]}
              latitude={currentPath[activeNoteIndex][1]}
              closeOnClick={false}
              onClose={() => setActiveNoteIndex(null)}
              anchor="top"
            >
              <div style={{ minWidth: 220 }}>
                <div className="text-sm font-medium mb-2">Vertex Note</div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="Add a message for this point"
                />
                <div className="flex justify-end space-x-2 mt-2">
                  <button className="px-2 py-1 text-sm border rounded" onClick={() => setActiveNoteIndex(null)}>Cancel</button>
                  <button
                    className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
                    onClick={() => {
                      if (activeNoteIndex === null) return;
                      setVertexNotes((prev) => ({ ...prev, [activeNoteIndex]: noteDraft }));
                      setActiveNoteIndex(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </Popup>
          )}
        </Map>
        {/* Instructions Overlay */}
  {currentPath.length === 0 && !isDrawing && !userLocation && (
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
                Sign in with Email
              </h3>
              <button
                onClick={() => setShowAuthDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

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
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMagicLink()}
                />
              </div>
              
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{authError}</p>
                </div>
              )}
              
              <button
                onClick={handleSendMagicLink}
                disabled={isAuthenticating}
                className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  isAuthenticating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white`}
              >
                <Mail className="w-4 h-4" />
                <span>{isAuthenticating ? 'Sending...' : 'Send Magic Link'}</span>
              </button>
            </div>
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
                    {userLocation[1].toFixed(6)}, {userLocation[0].toFixed(6)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-orange-900">Corrected Location</p>
                  <p className="text-xs text-orange-700">
                    {correctedLocation[1].toFixed(6)}, {correctedLocation[0].toFixed(6)}
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