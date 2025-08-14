import React, { useState, useEffect, createContext, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import WelcomeScreen from '@screens/WelcomeScreen';
import FormScreen from '@screens/FormScreen';
import FinishRecordingScreen from '@screens/FinishRecordingScreen';
import ResultsScreen from '@screens/ResultsScreen';
import DualChannelRecordingScreen from '@screens/DualChannelRecordingScreen';
import { authService } from '@utils/authService';

const Stack = createNativeStackNavigator();

// Contexto de autenticación
export const AuthContext = createContext({
  isLoggedIn: false,
  setIsLoggedIn: (value: boolean) => {},
  login: async (username: string, password: string) => false,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const loggedIn = await authService.isLoggedIn();
      setIsLoggedIn(loggedIn);
    } catch (error) {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const success = await authService.login(username, password);
      if (success) {
        setIsLoggedIn(true);
      }
      return success;
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setIsLoggedIn(false);
    } catch (error) {
    }
  };

  const authContextValue = {
    isLoggedIn,
    setIsLoggedIn,
    login,
    logout,
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <NavigationContainer>
        {isLoggedIn ? (
          // Stack para usuario loggeado - SIN Login screen
          <Stack.Navigator 
            initialRouteName="Form" 
            screenOptions={{headerShown: false}}
          >
            <Stack.Screen name="Form" component={FormScreen} />
            <Stack.Screen name="DualChannelRecording" component={DualChannelRecordingScreen} />
            <Stack.Screen name="FinishRecording" component={FinishRecordingScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
          </Stack.Navigator>
        ) : (
          // Stack para usuario NO loggeado - Solo Login
          <Stack.Navigator 
            initialRouteName="Welcome" 
            screenOptions={{headerShown: false}}
          >
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
