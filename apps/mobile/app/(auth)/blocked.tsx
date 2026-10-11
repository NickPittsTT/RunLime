import { AgeBlocked } from '@/components/AgeBlocked';
import { Screen } from '@/components/ui';

/** M5: shown to under-18s. Nothing was sent to RunLime. */
export default function BlockedScreen() {
  return (
    <Screen>
      <AgeBlocked />
    </Screen>
  );
}
