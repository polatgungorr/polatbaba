import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  User,
  Mail,
  Phone,
  ChevronLeft,
  LogOut,
  Camera,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function AccountScreen() {
  const { user, logout } = useAuthStore();
  const [editingField, setEditingField] = useState<'name' | 'phone' | 'email' | 'password' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Hata', 'Galeri erişim izni gerekli');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsLoading(true);
        const base64FileData = result.assets[0].base64;
        const filePath = `${user?.id}/${new Date().getTime()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64FileData), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: urlData.publicUrl })
          .eq('id', user?.id);

        if (updateError) throw updateError;

        useAuthStore.setState({
          user: { ...user!, avatar_url: urlData.publicUrl },
        });

        Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi');
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (field: 'name' | 'phone' | 'email') => {
    try {
      setIsLoading(true);

      if (field === 'email') {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email,
        });

        if (authError) throw authError;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          [field]: formData[field],
        })
        .eq('id', user?.id);

      if (error) throw error;

      useAuthStore.setState({
        user: {
          ...user!,
          [field]: formData[field],
        },
      });

      setEditingField(null);
      Alert.alert('Başarılı', 'Profil bilgisi güncellendi');
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!formData.currentPassword) {
        Alert.alert('Hata', 'Mevcut şifrenizi giriniz');
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
        return;
      }

      setIsLoading(true);

      // First verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        Alert.alert('Hata', 'Mevcut şifre yanlış');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) throw error;

      setEditingField(null);
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      Alert.alert('Başarılı', 'Şifreniz güncellendi');
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderEditModal = () => {
    if (!editingField) return null;

    let title = '';
    let content = null;
    let onSave = () => {};

    switch (editingField) {
      case 'name':
        title = 'Ad Soyad Düzenle';
        content = (
          <View style={styles.inputContainer}>
            <User size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              autoFocus
            />
          </View>
        );
        onSave = () => handleUpdateProfile('name');
        break;

      case 'email':
        title = 'E-posta Düzenle';
        content = (
          <View style={styles.inputContainer}>
            <Mail size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
          </View>
        );
        onSave = () => handleUpdateProfile('email');
        break;

      case 'phone':
        title = 'Telefon Düzenle';
        content = (
          <View style={styles.inputContainer}>
            <Phone size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="Telefon"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              autoFocus
            />
          </View>
        );
        onSave = () => handleUpdateProfile('phone');
        break;

      case 'password':
        title = 'Şifre Değiştir';
        content = (
          <>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Mevcut Şifre"
                secureTextEntry
                value={formData.currentPassword}
                onChangeText={(text) =>
                  setFormData({ ...formData, currentPassword: text })
                }
                autoFocus
              />
            </View>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Yeni Şifre"
                secureTextEntry
                value={formData.newPassword}
                onChangeText={(text) =>
                  setFormData({ ...formData, newPassword: text })
                }
              />
            </View>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Yeni Şifre (Tekrar)"
                secureTextEntry
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  setFormData({ ...formData, confirmPassword: text })
                }
              />
            </View>
          </>
        );
        onSave = handleChangePassword;
        break;
    }

    return (
      <Modal
        visible={!!editingField}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingField(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setEditingField(null);
                  setFormData({
                    ...formData,
                    name: user?.name || '',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {content}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setEditingField(null);
                  setFormData({
                    ...formData,
                    name: user?.name || '',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={onSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingField === 'password' ? 'Şifreyi Güncelle' : 'Kaydet'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#0e1d46" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hesabım</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} disabled={isLoading}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={40} color="#666" />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Camera size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.infoItem}
            onPress={() => setEditingField('name')}
          >
            <View style={styles.infoContent}>
              <User size={20} color="#666" />
              <View>
                <Text style={styles.infoLabel}>Ad Soyad</Text>
                <Text style={styles.infoValue}>{user?.name || 'Belirtilmedi'}</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoItem}
            onPress={() => setEditingField('email')}
          >
            <View style={styles.infoContent}>
              <Mail size={20} color="#666" />
              <View>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoItem}
            onPress={() => setEditingField('phone')}
          >
            <View style={styles.infoContent}>
              <Phone size={20} color="#666" />
              <View>
                <Text style={styles.infoLabel}>Telefon</Text>
                <Text style={styles.infoValue}>{user?.phone || 'Belirtilmedi'}</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.changePasswordButton}
          onPress={() => setEditingField('password')}
        >
          <Lock size={20} color="#0e1d46" />
          <Text style={styles.changePasswordText}>Şifre Değiştir</Text>
          <ChevronRight size={20} color="#0e1d46" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      {renderEditModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0e1d46',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  saveButton: {
    backgroundColor: '#0e1d46',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 4,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  changePasswordText: {
    fontSize: 16,
    color: '#0e1d46',
    fontWeight: '600',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
});