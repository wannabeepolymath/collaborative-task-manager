import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GroupRole } from '../store/groupStore';

interface InviteMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: GroupRole) => Promise<void>;
}

export default function InviteMemberModal({ visible, onClose, onSubmit }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GroupRole>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles: { value: GroupRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'member', label: 'Member' },
    { value: 'viewer', label: 'Viewer' },
  ];

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(email.trim(), role);
      setEmail('');
      setRole('member');
      onClose();
    } catch (error: any) {
      const message = error.message || 'Failed to invite member';
      // Provide user-friendly error messages
      if (message.includes('not found') || message.includes('User not found')) {
        setError('No user found with this email. They need to register first before they can be invited.');
      } else if (message.includes('already a member')) {
        setError('This user is already a member of the group.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Invite Member</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Enter email address"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleContainer}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.roleButton,
                    role === r.value && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={[styles.roleText, role === r.value && styles.roleTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.roleDescription}>
              <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
              <Text style={styles.roleDescriptionText}>
                {role === 'admin' && 'Admins can manage members and tasks'}
                {role === 'member' && 'Members can create and edit tasks'}
                {role === 'viewer' && 'Viewers can only see tasks'}
              </Text>
            </View>

            <View style={styles.noteContainer}>
              <Ionicons name="information-circle" size={16} color="#3B82F6" />
              <Text style={styles.noteText}>
                Note: The user must have an account to be invited. Share the app with them first if they haven't registered.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !email.trim() && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!email.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Send Invite</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#EF444420',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
    lineHeight: 18,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#8B5CF630',
    borderColor: '#8B5CF6',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  roleTextActive: {
    color: '#8B5CF6',
  },
  roleDescription: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  roleDescriptionText: {
    fontSize: 13,
    color: '#9CA3AF',
    flex: 1,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#3B82F620',
    padding: 12,
    borderRadius: 8,
  },
  noteText: {
    fontSize: 12,
    color: '#93C5FD',
    flex: 1,
    lineHeight: 18,
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
