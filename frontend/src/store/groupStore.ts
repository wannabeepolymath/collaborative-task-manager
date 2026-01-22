import { create } from 'zustand';
import apiClient from '../api/client';

export type GroupRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface GroupMember {
  user_id: string;
  user_name: string;
  user_email: string;
  role: GroupRole;
  joined_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  members: GroupMember[];
  created_at: string;
}

export interface GroupTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  group_id: string;
  created_by: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  groupTasks: GroupTask[];
  isLoading: boolean;
  error: string | null;
  fetchGroups: () => Promise<void>;
  fetchGroup: (id: string) => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<void>;
  updateGroup: (id: string, updates: { name?: string; description?: string }) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  inviteMember: (groupId: string, email: string, role?: GroupRole) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  fetchGroupTasks: (groupId: string) => Promise<void>;
  createGroupTask: (groupId: string, task: { title: string; description?: string; priority?: TaskPriority; assigned_to?: string }) => Promise<void>;
  updateGroupTask: (groupId: string, taskId: string, updates: Partial<GroupTask>) => Promise<void>;
  deleteGroupTask: (groupId: string, taskId: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  currentGroup: null,
  groupTasks: [],
  isLoading: false,
  error: null,

  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/groups');
      set({ groups: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchGroup: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get(`/groups/${id}`);
      set({ currentGroup: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createGroup: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/groups', { name, description });
      set((state) => ({ groups: [response.data, ...state.groups], isLoading: false }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateGroup: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.patch(`/groups/${id}`, updates);
      set((state) => ({
        groups: state.groups.map((g) => (g.id === id ? response.data : g)),
        currentGroup: state.currentGroup?.id === id ? response.data : state.currentGroup,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteGroup: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/groups/${id}`);
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== id),
        currentGroup: state.currentGroup?.id === id ? null : state.currentGroup,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  inviteMember: async (groupId, email, role = 'member') => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post(`/groups/${groupId}/invite`, { email, role });
      set((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? response.data : g)),
        currentGroup: state.currentGroup?.id === groupId ? response.data : state.currentGroup,
        isLoading: false,
      }));
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to invite member';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  removeMember: async (groupId, memberId) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/groups/${groupId}/members/${memberId}`);
      set((state) => {
        const updatedGroup = state.currentGroup ? {
          ...state.currentGroup,
          members: state.currentGroup.members.filter((m) => m.user_id !== memberId),
        } : null;
        return {
          currentGroup: updatedGroup,
          groups: state.groups.map((g) => g.id === groupId && updatedGroup ? updatedGroup : g),
          isLoading: false,
        };
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchGroupTasks: async (groupId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get(`/groups/${groupId}/tasks`);
      set({ groupTasks: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createGroupTask: async (groupId, task) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post(`/groups/${groupId}/tasks`, task);
      set((state) => ({ groupTasks: [response.data, ...state.groupTasks], isLoading: false }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateGroupTask: async (groupId, taskId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.patch(`/groups/${groupId}/tasks/${taskId}`, updates);
      set((state) => ({
        groupTasks: state.groupTasks.map((t) => (t.id === taskId ? response.data : t)),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteGroupTask: async (groupId, taskId) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/groups/${groupId}/tasks/${taskId}`);
      set((state) => ({
        groupTasks: state.groupTasks.filter((t) => t.id !== taskId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
