// Supabase configuration and utilities
// This file maintains the same interface as the original firebase.ts for backward compatibility
// while using Supabase as the backend

import { supabase, getCurrentUser } from './supabase';

interface PathData {
  coordinates: [number, number][];
  createdAt: string;
  userLocation?: [number, number];
  vertexData?: Record<string, any>;
  name?: string;
  description?: string;
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

interface LocationReport {
  id?: string;
  defaultLocation: [number, number];
  correctedLocation: [number, number];
  timestamp: string;
}

// Generate a random ID for paths (for backward compatibility)
const generatePathId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// Save path data (now uses Supabase shared_paths table)
export const savePath = async (pathData: PathData): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const pathId = generatePathId();
      
      // Simulate network delay for consistency with original implementation
      setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from('shared_paths')
            .insert({
              path_id: pathId,
              coordinates: pathData.coordinates,
              vertex_data: pathData.vertexData || {},
              user_location: pathData.userLocation
            })
            .select()
            .single();

          if (error) {
            console.error('Error saving to Supabase:', error);
            reject(new Error('Failed to save path'));
            return;
          }

          console.log('Path saved with ID:', pathId);
          resolve(pathId);
        } catch (error) {
          console.error('Error saving path:', error);
          reject(new Error('Failed to save path'));
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
};

// Get path data (now uses Supabase shared_paths table)
export const getPath = async (pathId: string): Promise<PathData | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Looking for path with ID:', pathId);
      
      // Simulate network delay for consistency with original implementation
      setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from('shared_paths')
            .select('*')
            .eq('path_id', pathId)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              // No rows returned
              console.log('No path found for ID:', pathId);
              resolve(null);
              return;
            }
            console.error('Error retrieving from Supabase:', error);
            reject(new Error('Failed to retrieve path'));
            return;
          }

          if (data) {
            const pathData: PathData = {
              coordinates: data.coordinates,
              createdAt: data.created_at,
              userLocation: data.user_location,
              vertexData: data.vertex_data
            };
            console.log('Retrieved path data:', pathData);
            resolve(pathData);
          } else {
            console.log('No path found for ID:', pathId);
            resolve(null);
          }
        } catch (error) {
          console.error('Error retrieving path:', error);
          reject(new Error('Failed to retrieve path'));
        }
      }, 300);
    } catch (error) {
      reject(error);
    }
  });
};

// Save a named path for the current user (new feature)
export const saveUserPath = async (pathData: PathData & { name: string; description?: string }): Promise<string> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to save paths');
    }

    const { data, error } = await supabase
      .from('user_paths')
      .insert({
        user_id: user.id,
        name: pathData.name,
        description: pathData.description || '',
        coordinates: pathData.coordinates,
        vertex_data: pathData.vertexData || {},
        user_location: pathData.userLocation
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving user path to Supabase:', error);
      throw new Error('Failed to save path');
    }

    console.log('User path saved with ID:', data.id);
    return data.id;
  } catch (error) {
    console.error('Error saving user path:', error);
    throw error;
  }
};

// Get all saved paths for the current user (new feature)
export const getUserPaths = async (): Promise<SavedPath[]> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_paths')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error retrieving user paths from Supabase:', error);
      throw new Error('Failed to retrieve user paths');
    }

    if (data) {
      const paths: SavedPath[] = data.map(path => ({
        id: path.id,
        name: path.name,
        description: path.description,
        coordinates: path.coordinates,
        createdAt: path.created_at,
        userLocation: path.user_location,
        vertexData: path.vertex_data
      }));
      console.log('Retrieved user paths:', paths);
      return paths;
    }

    return [];
  } catch (error) {
    console.error('Error retrieving user paths:', error);
    throw error;
  }
};

// Delete a user's saved path (new feature)
export const deleteUserPath = async (pathId: string): Promise<void> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to delete paths');
    }

    const { error } = await supabase
      .from('user_paths')
      .delete()
      .eq('id', pathId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting user path from Supabase:', error);
      throw new Error('Failed to delete path');
    }

    console.log('User path deleted with ID:', pathId);
  } catch (error) {
    console.error('Error deleting user path:', error);
    throw error;
  }
};

// Update a user's saved path (new feature)
export const updateUserPath = async (pathId: string, updates: Partial<PathData & { name: string; description?: string }>): Promise<void> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to update paths');
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.coordinates) updateData.coordinates = updates.coordinates;
    if (updates.vertexData) updateData.vertex_data = updates.vertexData;
    if (updates.userLocation) updateData.user_location = updates.userLocation;

    const { error } = await supabase
      .from('user_paths')
      .update(updateData)
      .eq('id', pathId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating user path in Supabase:', error);
      throw new Error('Failed to update path');
    }

    console.log('User path updated with ID:', pathId);
  } catch (error) {
    console.error('Error updating user path:', error);
    throw error;
  }
};

// Create a shareable link from a saved user path (new feature)
export const shareUserPath = async (userPathId: string): Promise<string> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to share paths');
    }

    // Get the user path
    const { data: userPath, error: fetchError } = await supabase
      .from('user_paths')
      .select('*')
      .eq('id', userPathId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !userPath) {
      throw new Error('Path not found or access denied');
    }

    // Create a shared path
    const pathId = generatePathId();
    const { data, error } = await supabase
      .from('shared_paths')
      .insert({
        path_id: pathId,
        coordinates: userPath.coordinates,
        vertex_data: userPath.vertex_data || {},
        user_location: userPath.user_location,
        source_user_path_id: userPathId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shared path:', error);
      throw new Error('Failed to create shareable link');
    }

    console.log('Shared path created with ID:', pathId);
    return pathId;
  } catch (error) {
    console.error('Error sharing user path:', error);
    throw error;
  }
};

// Report location accuracy (now uses Supabase location_reports table)
export const reportLocationAccuracy = async (report: LocationReport): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Simulate network delay for consistency with original implementation
      setTimeout(async () => {
        try {
          const user = await getCurrentUser();
          
          const { data, error } = await supabase
            .from('location_reports')
            .insert({
              user_id: user?.id || null,
              default_location: report.defaultLocation,
              corrected_location: report.correctedLocation,
              timestamp: report.timestamp
            })
            .select()
            .single();

          if (error) {
            console.error('Error saving report to Supabase:', error);
            reject(new Error('Failed to save location accuracy report'));
            return;
          }

          console.log('Location accuracy report saved with ID:', data.id);
          resolve(data.id);
        } catch (error) {
          console.error('Error saving report:', error);
          reject(new Error('Failed to save location accuracy report'));
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
};

// Get all location accuracy reports (now uses Supabase location_reports table)
export const getAllLocationReports = async (): Promise<LocationReport[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Simulate network delay for consistency with original implementation
      setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from('location_reports')
            .select('*')
            .order('timestamp', { ascending: false });

          if (error) {
            console.error('Error retrieving reports from Supabase:', error);
            reject(new Error('Failed to retrieve location reports'));
            return;
          }

          if (data) {
            const reports: LocationReport[] = data.map(report => ({
              id: report.id,
              defaultLocation: report.default_location,
              correctedLocation: report.corrected_location,
              timestamp: report.timestamp
            }));
            console.log('Retrieved all reports:', reports);
            resolve(reports);
          } else {
            console.log('No reports found');
            resolve([]);
          }
        } catch (error) {
          console.error('Error retrieving reports:', error);
          reject(new Error('Failed to retrieve location reports'));
        }
      }, 300);
    } catch (error) {
      reject(error);
    }
  });
};

// Backward compatibility exports
export { savePath as saveSharedPath };
export { getPath as getSharedPath };

// Additional utility functions for localStorage fallback (if needed)
export const savePathLocally = async (pathData: PathData): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const pathId = generatePathId();
      const pathKey = `correctit_path_${pathId}`;
      
      setTimeout(() => {
        try {
          localStorage.setItem(pathKey, JSON.stringify(pathData));
          console.log('Path saved locally with ID:', pathId);
          resolve(pathId);
        } catch (error) {
          console.error('Error saving to localStorage:', error);
          reject(new Error('Failed to save path locally'));
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
};

export const getPathLocally = async (pathId: string): Promise<PathData | null> => {
  return new Promise((resolve, reject) => {
    try {
      const pathKey = `correctit_path_${pathId}`;
      console.log('Looking for local path with key:', pathKey);
      
      setTimeout(() => {
        try {
          const pathDataString = localStorage.getItem(pathKey);
          console.log('Retrieved local path data:', pathDataString);
          
          if (pathDataString) {
            const pathData = JSON.parse(pathDataString);
            resolve(pathData);
          } else {
            console.log('No local path found for ID:', pathId);
            resolve(null);
          }
        } catch (error) {
          console.error('Error retrieving from localStorage:', error);
          reject(new Error('Failed to retrieve local path'));
        }
      }, 300);
    } catch (error) {
      reject(error);
    }
  });
};

// Migration utility to move localStorage data to Supabase (optional)
export const migrateLocalDataToSupabase = async (): Promise<void> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('User not authenticated, skipping migration');
      return;
    }

    // Migrate paths
    const pathKeys = Object.keys(localStorage).filter(key => key.startsWith('correctit_path_'));
    for (const key of pathKeys) {
      try {
        const pathData = JSON.parse(localStorage.getItem(key) || '{}');
        const pathId = key.replace('correctit_path_', '');
        
        // Check if already exists in Supabase
        const { data: existing } = await supabase
          .from('shared_paths')
          .select('id')
          .eq('path_id', pathId)
          .single();

        if (!existing) {
          await supabase
            .from('shared_paths')
            .insert({
              path_id: pathId,
              coordinates: pathData.coordinates || [],
              vertex_data: pathData.vertexData || {},
              user_location: pathData.userLocation
            });
          
          console.log(`Migrated path ${pathId} to Supabase`);
        }
      } catch (error) {
        console.error(`Error migrating path ${key}:`, error);
      }
    }

    // Migrate location reports
    const reportsData = localStorage.getItem('correctit_all_reports');
    if (reportsData) {
      try {
        const reports = JSON.parse(reportsData);
        for (const report of reports) {
          // Check if already exists
          const { data: existing } = await supabase
            .from('location_reports')
            .select('id')
            .eq('timestamp', report.timestamp)
            .single();

          if (!existing) {
            await supabase
              .from('location_reports')
              .insert({
                user_id: user.id,
                default_location: report.defaultLocation,
                corrected_location: report.correctedLocation,
                timestamp: report.timestamp
              });
          }
        }
        console.log('Migrated location reports to Supabase');
      } catch (error) {
        console.error('Error migrating location reports:', error);
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};