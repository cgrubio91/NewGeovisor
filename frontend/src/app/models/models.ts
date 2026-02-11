export interface User {
    id: number;
    username: string;
    email: string;
    full_name?: string;
    is_active: boolean;
    is_superuser: boolean;
    role?: string;
    created_at: string;
}

export interface Folder {
    id: number;
    name: string;
    project_id: number;
    parent_id?: number | null;
    created_at: string;
    layers: Layer[];
}

export interface Project {
    id: number;
    name: string;
    description?: string;
    contract_number?: string;
    start_date?: string;
    end_date?: string;
    photo_url?: string;
    owner_id: number;
    created_at: string;
    layers: Layer[];
    folders: Folder[];
    assigned_users?: User[];
    assigned_user_ids?: number[];
}

export interface Layer {
    id?: number;
    name: string;
    layer_type: 'raster' | 'vector' | '3d_model' | 'kml';
    file_path: string;
    crs?: string;
    project_id: number;
    folder_id?: number | null;
    settings?: any;
    metadata?: any;
    visible?: boolean; // Frontend state
    opacity?: number; // Frontend state
    z_index?: number; // Frontend and Backend state
    processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
    processing_progress?: number;
}

