import React from 'react';
import { StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { persistor, store } from './src/core/store';
import RootNavigator from './src/navigation/RootNavigator';

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <RootNavigator />
          <Toast />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;
