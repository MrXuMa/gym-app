import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { authStyles } from '@/components/auth/authStyles';

type AuthCardProps = {
  children: ReactNode;
};

export function AuthCard({ children }: AuthCardProps) {
  return (
    <View style={authStyles.card}>
      <View style={authStyles.cardEntablature}>
        <View style={authStyles.cardFrieze} />
        <View style={authStyles.cardArchitrave} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
});
