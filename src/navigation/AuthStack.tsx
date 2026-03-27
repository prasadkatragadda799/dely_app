import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import LoginScreen from '../features/auth/screens/LoginScreen';
import OtpScreen from '../features/auth/screens/OtpScreen';
import RegisterScreen from '../features/auth/screens/RegisterScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
