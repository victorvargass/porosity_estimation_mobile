import React from 'react';
import { View, Text, Button } from 'react-native';
import styles from '@styles/FinishRecordingStyles';
import strings from '@locales/es';

type FinishRecordingScreenProps = {
  navigation: any;
};

export default function FinishRecordingScreen({ navigation }: FinishRecordingScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.finishRecordingScreen.title}</Text>
      <Text style={styles.message}>{strings.finishRecordingScreen.message}</Text>
      
      <Button
        title={strings.finishRecordingScreen.newMeasurement}
        onPress={() => navigation.navigate('Recording')}
      />      
      <Button
        title={strings.finishRecordingScreen.finish}
        onPress={() => navigation.navigate('Results')}
      />
    </View>
  );
}
