// screens/WelcomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import strings from '@locales/es';
import styles from '@styles/WelcomeStyles';
import { useAuth } from '../../App';

export default function WelcomeScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    setIsLoading(true);
    setShowError(false);

    try {
      const loginSuccess = await login(username, password);
      
      if (!loginSuccess) {
        // Login incorrecto - mostrar error
        setShowError(true);
        Alert.alert('Error', strings.welcomeScreen.errorMessage);
      }
      // Si loginSuccess es true, el contexto ya actualizó el estado y la app cambiará automáticamente
    } catch (error) {
      setShowError(true);
      Alert.alert(strings.common.error, strings.welcomeScreen.loginError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.welcomeScreen.title}</Text>
      
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{strings.welcomeScreen.username}</Text>
          <TextInput
            style={[styles.input, showError && styles.inputError]}
            placeholder={strings.welcomeScreen.usernamePlaceholder}
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setShowError(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{strings.welcomeScreen.password}</Text>
          <TextInput
            style={[styles.input, showError && styles.inputError]}
            placeholder={strings.welcomeScreen.passwordPlaceholder}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setShowError(false);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        {showError && (
          <Text style={styles.errorMessage}>
            {strings.welcomeScreen.errorMessage}
          </Text>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? strings.welcomeScreen.loading : strings.welcomeScreen.loginButton}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}
