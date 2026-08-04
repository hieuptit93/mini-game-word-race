import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GameProps, Screen } from './types';
import { useHostBridge } from './hooks/useHostBridge';
import { WordRacerGame } from './game';

const App: React.FC<GameProps> = ({ onExit, onGameOver, host }) => {
  // HOOKS PHẢI GIỐNG Y HỆT TEMPLATE GỐC - không thêm, không bớt
  const [screen, setScreen] = useState<Screen>('home');
  const [score, setScore] = useState(0);

  const {
    accessToken,
    userId,
    apiUrl,
    sfx,
    pronunciation,
    continuousSpeech,
    analytics,
    fetchWithAuth,
    isDev,
  } = useHostBridge(host);

  useEffect(() => {
    if (isDev) {
      console.log('[Game] API URL:', apiUrl);
      console.log('[Game] Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'none');
      console.log('[Game] User ID:', userId);
    }
  }, [apiUrl, accessToken, userId, isDev]);

  useEffect(() => {
    // Preload placeholder
  }, [sfx]);

  // Analytics smoke test — fires once on mount so we can confirm the
  // bridge is wired correctly (check host/MockHost logs for these).
  useEffect(() => {
    analytics.logScreenView('HomeScreen');
    analytics.setUserProperty('skill_level', 'intermediate');
  }, [analytics]);

  const handleStartGame = useCallback(() => {
    setScreen('game');
    setScore(0);
  }, []);

  const handleGameComplete = useCallback((finalScore: number) => {
    setScore(finalScore);
    setScreen('result');
    onGameOver?.({ score: finalScore });
  }, [onGameOver]);

  const handlePlayAgain = useCallback(() => {
    setScreen('home');
    setScore(0);
  }, []);

  const handleCorrect = useCallback(() => {
    sfx.play('https://cdn.example.com/correct.mp3');
  }, [sfx]);

  const handlePronunciation = useCallback(async () => {
    try {
      await pronunciation.startRecording();
    } catch (error) {
      console.log('Mic error:', error);
    }
  }, [pronunciation]);

  const handleFetchLeaderboard = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/games/leaderboard');
      console.log('Leaderboard:', data);
    } catch (error) {
      console.log('Fetch error:', error);
    }
  }, [fetchWithAuth]);

  // RENDER - không thêm hooks nào sau đây
  return (
    <View style={styles.container}>
      <WordRacerGame
        host={host}
        onExit={onExit}
        onGameOver={(gameScore: number) => {
          handleGameComplete(gameScore);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default App;
