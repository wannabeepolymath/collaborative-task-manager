import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Group } from '../store/groupStore';

interface GroupItemProps {
  group: Group;
  onPress: () => void;
}

export default function GroupItem({ group, onPress }: GroupItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Ionicons name="people" size={24} color="#8B5CF6" />
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{group.name}</Text>
        {group.description ? (
          <Text style={styles.description} numberOfLines={1}>{group.description}</Text>
        ) : null}
        <View style={styles.meta}>
          <Ionicons name="people-outline" size={14} color="#9CA3AF" />
          <Text style={styles.memberCount}>
            {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#8B5CF620',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
