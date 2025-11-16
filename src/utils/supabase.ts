import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are properly configured
if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'https://your-project.supabase.co' || 
    supabaseAnonKey === 'your-anon-key') {
  console.warn('Supabase environment variables are not properly configured. Please set up your .env file with valid Supabase credentials.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Get current authenticated user
export const getCurrentUser = async () => {
  try {
    // Check if Supabase is properly configured before making requests
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl === 'https://your-project.supabase.co' || 
        supabaseAnonKey === 'your-anon-key') {
      console.warn('Supabase not configured - skipping authentication check');
      return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
};

// Sign in with Email

// Redirect URL used by Supabase email links and OAuth
// Set VITE_SUPABASE_REDIRECT_URL in your environment (Vercel) to your production URL
const SUPABASE_EMAIL_REDIRECT_URL = import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location?.origin || 'https://dotanddot.vercel.app';

export const signInWithEmail = async (email: string) => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl === 'https://your-project.supabase.co' || 
        supabaseAnonKey === 'your-anon-key') {
      throw new Error('Supabase not configured. Please set up your environment variables.');
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: SUPABASE_EMAIL_REDIRECT_URL
      }
    });
    
    if (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in signInWithEmail:', error);
    throw error;
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl === 'https://your-project.supabase.co' || 
        supabaseAnonKey === 'your-anon-key') {
      throw new Error('Supabase not configured. Please set up your environment variables.');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: SUPABASE_EMAIL_REDIRECT_URL
      }
    });
    
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in signInWithGoogle:', error);
    throw error;
  }
};

// Verify OTP
export const verifyOtp = async (email: string, token: string) => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl === 'https://your-project.supabase.co' || 
        supabaseAnonKey === 'your-anon-key') {
      throw new Error('Supabase not configured. Please set up your environment variables.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email'
    });
    
    if (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    throw error;
  }
};

// Sign out
export const signOut = async () => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl === 'https://your-project.supabase.co' || 
        supabaseAnonKey === 'your-anon-key') {
      console.warn('Supabase not configured - skipping sign out');
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in signOut:', error);
    throw error;
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: any) => void) => {
  // Check if Supabase is properly configured
  if (!supabaseUrl || !supabaseAnonKey || 
      supabaseUrl === 'https://your-project.supabase.co' || 
      supabaseAnonKey === 'your-anon-key') {
    console.warn('Supabase not configured - skipping auth state listener');
    callback(null);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
};

/**
 * Save a drawn path for the current authenticated user.
 *
 * Usage:
 *   Call this function after the user finishes drawing a path on the map and clicks 'Save Path'.
 *   - name: A descriptive name for the path (e.g., 'Home to Office').
 *   - pathData: An array of coordinates or GeoJSON representing the drawn path.
 *
 * Example pathData:
 *   [ { lat: 22.5726, lng: 88.3639 }, { lat: 22.5730, lng: 88.3645 }, ... ]
 *
 * The path is stored in the Supabase 'paths' table with columns:
 *   - id (UUID, primary key)
 *   - user_id (UUID, references auth.users.id)
 *   - name (text)
 *   - path_data (jsonb)
 *   - created_at (timestamp)
 *
 * Row Level Security (RLS) should be enabled so users can only access their own paths.
 */
export const saveUserPath = async (name: string, pathData: any) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No authenticated user found.');
    const { error } = await supabase
      .from('paths')
      .insert([{ user_id: user.id, name, path_data: pathData }]);
    if (error) {
      console.error('Error saving path:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Error in saveUserPath:', error);
    throw error;
  }
};

/**
 * Fetch all saved paths for the current authenticated user.
 *
 * Usage:
 *   Call this function in the account/profile section after user login.
 *   Display the returned paths in a list, table, or render them on the map.
 *
 * Returns:
 *   Array of path objects, each containing:
 *     - id: Path ID
 *     - name: Path name
 *     - path_data: Array of coordinates or GeoJSON
 *     - created_at: Timestamp
 *
 * Example integration in React:
 *   useEffect(() => {
 *     fetchUserPaths().then(setPaths);
 *   }, []);
 */
export const fetchUserPaths = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No authenticated user found.');
    const { data, error } = await supabase
      .from('paths')
      .select('*')
      .eq('user_id', user.id);
    if (error) {
      console.error('Error fetching paths:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error in fetchUserPaths:', error);
    throw error;
  }
};

/**
 * UI Integration Notes:
 *
 * 1. In your map component, add a 'Save Path' button that calls saveUserPath with the drawn path data.
 * 2. In your account/profile section, call fetchUserPaths after login and display the paths.
 * 3. You can render the saved paths visually on the map by iterating over the path_data array.
 * 4. Ensure your Supabase table 'paths' is set up as described above, with RLS enabled for security.
 */