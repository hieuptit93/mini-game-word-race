/**
 * Development wrapper for standalone mini-game testing.
 *
 * This wraps your App component with a mock host bridge
 * so you can develop and test without the main Pika app.
 *
 * Run with: yarn dev
 */

import React from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from '../src/App';
import mockHost from './MockHost';

export default function DevApp() {
  const handleExit = () => {
    Alert.alert(
      'Exit Pressed',
      'In the real app, this would close the mini-game and return to the main app.',
      [{ text: 'OK' }]
    );
  };

  const handleGameOver = (result: { score: number }) => {
    console.log('[DevApp] Game over with score:', result.score);
    Alert.alert(
      'Game Over!',
      `Your score: ${result.score}\n\nIn the real app, this score would be saved.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <App
          host={mockHost}
          onExit={handleExit}
          onGameOver={handleGameOver}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
