// This file contains migration notes and steps for switching from react-leaflet to Mapbox GL JS (react-map-gl) for 3D and high-zoom map support.

# Migration Plan: Leaflet to Mapbox GL JS (react-map-gl)

## Why Mapbox GL JS?
- Supports 3D terrain and buildings
- Allows higher zoom levels (up to 24)
- Modern, performant, and customizable

## Steps
1. Install dependencies:
   npm install react-map-gl mapbox-gl

2. Get a free Mapbox access token from https://account.mapbox.com/

3. Replace MapInterface.tsx map code with react-map-gl components:
   - Use <Map> from react-map-gl
   - Set `maxZoom` prop (e.g., maxZoom={24})
   - Enable 3D terrain and buildings with mapbox-gl style options

4. Update path drawing and saving logic to work with new map events/APIs.

5. Remove react-leaflet and leaflet dependencies if no longer needed.

6. Test all map features, including zoom, 3D, and path saving.

---

See Mapbox GL JS docs: https://docs.mapbox.com/mapbox-gl-js/guides/
See react-map-gl docs: https://visgl.github.io/react-map-gl/
