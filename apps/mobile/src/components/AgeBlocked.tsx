import { View } from 'react-native';
import { T } from './ui';

export function AgeBlocked() {
  return (
    <View style={{ gap: 12 }} accessible>
      <T variant="headline">Sorry, you can&apos;t create a RunLime account</T>
      <T>
        RunLime accounts are for adults aged 18 and over. Young runners are very welcome at races with a parent or guardian, who can add them to
        their group.
      </T>
    </View>
  );
}
