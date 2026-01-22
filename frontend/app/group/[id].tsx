import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore, GroupTask, TaskStatus, TaskPriority, GroupMember, GroupRole } from '../../src/store/groupStore';
import { useAuthStore } from '../../src/store/authStore';
import GroupTaskItem from '../../src/components/GroupTaskItem';
import InviteMemberModal from '../../src/components/InviteMemberModal';

// Confirmation Modal Component
function ConfirmModal({ 
  visible, 
  title, 
  message, 
  confirmText, 
  onConfirm, 
  onCancel,
  isLoading 
}: { 
  visible: boolean; 
  title: string; 
  message: string; 
  confirmText: string;
  onConfirm: () => void; 
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.container}>
          <Text style={confirmStyles.title}>{title}</Text>
          <Text style={confirmStyles.message}>{message}</Text>
          <View style={confirmStyles.buttons}>
            <TouchableOpacity style={confirmStyles.cancelButton} onPress={onCancel} disabled={isLoading}>
              <Text style={confirmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={confirmStyles.confirmButton} onPress={onConfirm} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={confirmStyles.confirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cancelText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

// Edit Group Modal Component
function EditGroupModal({
  visible,
  onClose,
  onSubmit,
  initialName,
  initialDescription,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
  initialName: string;
  initialDescription: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [visible, initialName, initialDescription]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onSubmit(name.trim(), description.trim());
      onClose();
    } catch (error) {
      console.error('Failed to update group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={editStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={editStyles.container}>
          <View style={editStyles.header}>
            <Text style={editStyles.headerTitle}>Edit Group</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={editStyles.content}>
            <Text style={editStyles.label}>Group Name</Text>
            <TextInput
              style={editStyles.input}
              placeholder="Enter group name"
              placeholderTextColor="#6B7280"
              value={name}
              onChangeText={setName}
            />

            <Text style={editStyles.label}>Description</Text>
            <TextInput
              style={[editStyles.input, editStyles.textArea]}
              placeholder="Group description (optional)"
              placeholderTextColor="#6B7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[editStyles.submitButton, !name.trim() && editStyles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={editStyles.submitButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#F9FAFB',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const {
    currentGroup,
    groupTasks,
    fetchGroup,
    fetchGroupTasks,
    createGroupTask,
    updateGroupTask,
    deleteGroupTask,
    deleteGroup,
    updateGroup,
    inviteMember,
    removeMember,
    isLoading,
  } = useGroupStore();

  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState<GroupTask | null>(null);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState<GroupMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchGroup(id);
      fetchGroupTasks(id);
    }
  }, [id]);

  const onRefresh = useCallback(() => {
    if (id) {
      fetchGroup(id);
      fetchGroupTasks(id);
    }
  }, [id]);

  const currentMember = currentGroup?.members.find((m) => m.user_id === user?.id);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const canCreateTask = currentMember?.role !== 'viewer';
  const isOwner = currentMember?.role === 'owner';

  const handleStatusChange = async (task: GroupTask, status: TaskStatus) => {
    if (!id || !canCreateTask) return;
    try {
      await updateGroupTask(id, task.id, { status });
    } catch (error) {
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const handleDeleteTask = async () => {
    if (!showDeleteTaskConfirm || !id) return;
    setIsDeleting(true);
    try {
      await deleteGroupTask(id, showDeleteTaskConfirm.id);
      setShowDeleteTaskConfirm(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!showRemoveMemberConfirm || !id) return;
    const isSelf = showRemoveMemberConfirm.user_id === user?.id;
    setIsDeleting(true);
    try {
      await removeMember(id, showRemoveMemberConfirm.user_id);
      setShowRemoveMemberConfirm(null);
      if (isSelf) {
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to remove member');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteGroup(id);
      setShowDeleteConfirm(false);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete group');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateGroup = async (name: string, description: string) => {
    if (!id) return;
    await updateGroup(id, { name, description });
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !id) return;
    try {
      await createGroupTask(id, {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        priority: newTaskPriority,
        assigned_to: newTaskAssignee || undefined,
      });
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
      setNewTaskAssignee(null);
      setShowAddTaskModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create task');
    }
  };

  const getRoleBadgeColor = (role: GroupRole) => {
    switch (role) {
      case 'owner': return '#F59E0B';
      case 'admin': return '#8B5CF6';
      case 'member': return '#3B82F6';
      case 'viewer': return '#6B7280';
    }
  };

  if (!currentGroup) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  const priorities: TaskPriority[] = ['low', 'medium', 'high'];
  const priorityColors: Record<TaskPriority, string> = {
    low: '#6B7280',
    medium: '#F59E0B',
    high: '#EF4444',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerInfo} 
          onPress={() => canManage && setShowEditGroupModal(true)}
          disabled={!canManage}
        >
          <Text style={styles.title} numberOfLines={1}>{currentGroup.name}</Text>
          {currentGroup.description ? (
            <Text style={styles.subtitle} numberOfLines={1}>{currentGroup.description}</Text>
          ) : null}
          {canManage && (
            <View style={styles.editHint}>
              <Ionicons name="pencil" size={12} color="#6B7280" />
              <Text style={styles.editHintText}>Tap to edit</Text>
            </View>
          )}
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => setActiveTab('tasks')}
        >
          <Ionicons
            name="checkbox-outline"
            size={18}
            color={activeTab === 'tasks' ? '#8B5CF6' : '#6B7280'}
          />
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
            Tasks ({groupTasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === 'members' ? '#8B5CF6' : '#6B7280'}
          />
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members ({currentGroup.members.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tasks' ? (
        <>
          <FlatList
            data={groupTasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GroupTaskItem
                task={item}
                onStatusChange={(status) => handleStatusChange(item, status)}
                onEdit={() => {}}
                onDelete={() => setShowDeleteTaskConfirm(item)}
                canDelete={canManage}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#8B5CF6" />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkbox-outline" size={64} color="#374151" />
                <Text style={styles.emptyTitle}>No tasks yet</Text>
                <Text style={styles.emptySubtitle}>Add a task to get started</Text>
              </View>
            }
          />
          {canCreateTask && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowAddTaskModal(true)}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#8B5CF6" />
            }
          >
            {currentGroup.members.map((member) => (
              <View key={member.user_id} style={styles.memberItem}>
                <View style={styles.memberAvatar}>
                  <Ionicons name="person" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.user_name}
                    {member.user_id === user?.id && ' (You)'}
                  </Text>
                  <Text style={styles.memberEmail}>{member.user_email}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(member.role) + '20' }]}>
                  <Text style={[styles.roleText, { color: getRoleBadgeColor(member.role) }]}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Text>
                </View>
                {(canManage || member.user_id === user?.id) && member.role !== 'owner' && (
                  <TouchableOpacity
                    style={styles.removeMemberButton}
                    onPress={() => setShowRemoveMemberConfirm(member)}
                  >
                    <Ionicons name="close" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          {canManage && (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: '#8B5CF6' }]}
              onPress={() => setShowInviteModal(true)}
            >
              <Ionicons name="person-add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Modals */}
      <InviteMemberModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={(email, role) => inviteMember(id!, email, role)}
      />

      <EditGroupModal
        visible={showEditGroupModal}
        onClose={() => setShowEditGroupModal(false)}
        onSubmit={handleUpdateGroup}
        initialName={currentGroup.name}
        initialDescription={currentGroup.description}
      />

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Group"
        message="Are you sure you want to delete this group? This will delete all tasks as well. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteGroup}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isDeleting}
      />

      <ConfirmModal
        visible={!!showDeleteTaskConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete "${showDeleteTaskConfirm?.title}"?`}
        confirmText="Delete"
        onConfirm={handleDeleteTask}
        onCancel={() => setShowDeleteTaskConfirm(null)}
        isLoading={isDeleting}
      />

      <ConfirmModal
        visible={!!showRemoveMemberConfirm}
        title={showRemoveMemberConfirm?.user_id === user?.id ? "Leave Group" : "Remove Member"}
        message={
          showRemoveMemberConfirm?.user_id === user?.id
            ? "Are you sure you want to leave this group?"
            : `Are you sure you want to remove ${showRemoveMemberConfirm?.user_name}?`
        }
        confirmText={showRemoveMemberConfirm?.user_id === user?.id ? "Leave" : "Remove"}
        onConfirm={handleRemoveMember}
        onCancel={() => setShowRemoveMemberConfirm(null)}
        isLoading={isDeleting}
      />

      {/* Add Task Modal */}
      <Modal visible={showAddTaskModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Task</Text>
              <TouchableOpacity onPress={() => setShowAddTaskModal(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Task title"
                placeholderTextColor="#6B7280"
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="#6B7280"
                value={newTaskDescription}
                onChangeText={setNewTaskDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityContainer}>
                {priorities.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityButton,
                      newTaskPriority === p && { backgroundColor: priorityColors[p] + '30', borderColor: priorityColors[p] },
                    ]}
                    onPress={() => setNewTaskPriority(p)}
                  >
                    <Text style={[styles.priorityText, newTaskPriority === p && { color: priorityColors[p] }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Assign To</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assigneeScroll}>
                <TouchableOpacity
                  style={[
                    styles.assigneeButton,
                    !newTaskAssignee && styles.assigneeButtonActive,
                  ]}
                  onPress={() => setNewTaskAssignee(null)}
                >
                  <Text style={[styles.assigneeText, !newTaskAssignee && styles.assigneeTextActive]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {currentGroup.members.filter(m => m.role !== 'viewer').map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.assigneeButton,
                      newTaskAssignee === member.user_id && styles.assigneeButtonActive,
                    ]}
                    onPress={() => setNewTaskAssignee(member.user_id)}
                  >
                    <Text style={[
                      styles.assigneeText,
                      newTaskAssignee === member.user_id && styles.assigneeTextActive,
                    ]}>
                      {member.user_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, !newTaskTitle.trim() && styles.submitButtonDisabled]}
              onPress={handleCreateTask}
              disabled={!newTaskTitle.trim()}
            >
              <Text style={styles.submitButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  editHintText: {
    fontSize: 11,
    color: '#6B7280',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1F2937',
  },
  tabActive: {
    backgroundColor: '#8B5CF620',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#8B5CF6',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F9FAFB',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#8B5CF620',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  memberEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeMemberButton: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#EF444420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  modalContent: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#F9FAFB',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  assigneeScroll: {
    marginBottom: 16,
  },
  assigneeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginRight: 10,
  },
  assigneeButtonActive: {
    backgroundColor: '#8B5CF630',
    borderColor: '#8B5CF6',
  },
  assigneeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  assigneeTextActive: {
    color: '#8B5CF6',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
