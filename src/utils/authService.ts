import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'user_session';

export interface AuthService {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
  getSession: () => Promise<string | null>;
}

export const authService: AuthService = {
  async login(username: string, password: string): Promise<boolean> {
    // Validar credenciales
    if (username.toLowerCase() === 'admin' && password === '1234') {
      // Guardar sesión
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({
        username: username.toLowerCase(),
        loginTime: new Date().toISOString(),
        isLoggedIn: true
      }));
      return true;
    }
    return false;
  },

  async logout(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_KEY);
  },

  async isLoggedIn(): Promise<boolean> {
    try {
      const session = await AsyncStorage.getItem(AUTH_KEY);
      if (session) {
        const sessionData = JSON.parse(session);
        return sessionData.isLoggedIn === true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  async getSession(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_KEY);
    } catch (error) {
      return null;
    }
  }
}; 