import { ReactNode } from 'react';
import { View } from 'react-native';
import { authStyles } from '@/components/auth/authStyles';

type AuthCardProps = {
  children: ReactNode;
};

export function AuthCard({ children }: AuthCardProps) {
  return <View style={authStyles.card}>{children}</View>;
}
