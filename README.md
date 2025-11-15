# Correctit - Smart Delivery Navigation Platform

A modern web application that helps delivery agents navigate to exact locations by allowing users to create custom delivery paths, report GPS accuracy issues, and save/share paths for future use.

## Features

### 🗺️ Custom Path Creation
- Interactive map interface with satellite and standard views
- Draw precise paths from main roads to doorsteps
- Real-time location tracking with high accuracy
- Save and share paths via unique URLs

### 📍 Location Accuracy Reporting
- Report GPS inaccuracies by marking correct locations
- Visual comparison between GPS and actual locations
- Data collection for improving location services
- Analytics dashboard for location accuracy insights

### 🚚 Delivery Navigation
- Follow custom paths created by recipients
- Real-time location updates for delivery agents
- Clear visual indicators for start, destination, and current location
- Optimized for mobile devices

### 👤 User Accounts & Path Management
- Email and Google authentication via Supabase
- Save drawn paths to your account
- View and manage all your saved paths in the account section
- Secure, private data storage with Row Level Security

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet with React-Leaflet
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Database & Auth**: Supabase (PostgreSQL, RLS, Auth)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
git clone https://github.com/richyrich98/dotanddot.git
cd dotanddot
```

2. Install dependencies:
   ```bash
npm install
```
3. Set up your `.env` file:
   ```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
4. Start the development server:
   ```bash
npm run dev
```
5. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Usage

### Creating and Saving a Custom Path
1. **Sign in**: Use email or Google authentication.
2. **Draw Path**: Click "Start Drawing" and add points on the map.
3. **Save Path**: Click "Save Path" to store your path in your account.
4. **Share Path**: Click "Share Path" to generate a unique URL.

### Viewing Saved Paths
- Go to your account section to view all saved paths.
- Click on a path to view or share it.

### Reporting Location Accuracy
1. **Enable Location**: Allow the app to access your current location.
2. **Mark Correct Position**: If GPS is inaccurate, click on the map where your actual location is.
3. **Submit Report**: Help improve location services.

## Project Structure

```
src/
├── components/
│   ├── Header.tsx              # App header
│   ├── MapInterface.tsx        # Main map component for path creation
│   ├── PathViewer.tsx          # Component for viewing shared paths
│   └── LocationReports.tsx     # Analytics dashboard
├── utils/
│   ├── firebase.ts             # (Legacy/demo) Firebase utilities
│   └── supabase.ts             # Supabase client and helpers
├── App.tsx                     # Main app component
├── main.tsx                    # App entry point
└── index.css                   # Global styles
```

## Supabase Integration
- **Authentication**: Email and Google sign-in via Supabase Auth
- **Database**: Paths saved in `paths` table with RLS enabled
- **Security**: Only authenticated users can access their own paths
- **Environment**: Keys stored in `.env` (never committed)

## Accessibility & Compliance
- Follows WCAG guidelines for color contrast and keyboard navigation
- Privacy Policy: See `PRIVACY_POLICY.md`
- Terms of Service: See `TERMS_OF_SERVICE.md`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap
- [ ] Real Firebase integration (optional)
- [x] Supabase authentication and path storage
- [ ] Push notifications for delivery updates
- [ ] Offline map support
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Integration with delivery service APIs

## Support
If you encounter any issues or have questions, please [open an issue](https://github.com/richyrich98/dotanddot/issues) on GitHub.

---

Built with ❤️ for better delivery experiences
# dotanddot
correctit updated verison with supabase db
