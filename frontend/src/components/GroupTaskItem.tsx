import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GroupTask, TaskStatus } from '../store/groupStore';

interface GroupTaskItemProps {
  task: GroupTask;
  onStatusChange: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const statusColors: Record<TaskStatus, string> = {
  todo: '#6B7280',
  in_progress: '#3B82F6',
  done: '#10B981',
};

const priorityColors: Record<string, string> = {
  low: '#6B7280',
  medium: '#F59E0B',
  high: '#EF4444',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const nextStatus: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export default function GroupTaskItem({ task, onStatusChange, onEdit, onDelete, canDelete }: GroupTaskItemProps) {
  const isDone = task.status === 'done';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onStatusChange(nextStatus[task.status])}
      >
        <View style={[styles.checkboxInner, { borderColor: statusColors[task.status] }]}>
          {isDone && <Ionicons name="checkmark" size={16} color={statusColors.done} />}
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.content} onPress={onEdit}>
        <Text style={[styles.title, isDone && styles.titleDone]}>{task.title}</Text>
        {task.description ? (
          <Text style={styles.description} numberOfLines={1}>{task.description}</Text>
        ) : null}
        {task.assigned_to_name && (
          <View style={styles.assigneeContainer}>
            <Ionicons name="person-outline" size={12} color="#8B5CF6" />
            <Text style={styles.assigneeName}>{task.assigned_to_name}</Text>
          </View>
        )}
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: statusColors[task.status] + '20' }]}>
            <Text style={[styles.badgeText, { color: statusColors[task.status] }]}>
              {statusLabels[task.status]}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: priorityColors[task.priority] + '20' }]}>
            <Text style={[styles.badgeText, { color: priorityColors[task.priority] }]}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Text>
          </View>
          {task.due_date && (
            <View style={styles.dueDateContainer}>
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text style={styles.dueDate}>
                {new Date(task.due_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {canDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  checkbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  assigneeName: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
});
