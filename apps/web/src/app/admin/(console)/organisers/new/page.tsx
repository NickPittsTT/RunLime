import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { CreateOrganisationForm } from './CreateOrganisationForm';

export default async function NewOrganisation() {
  await requireAdmin('/admin/organisers/new');
  return (
    <>
      <PageTitle lead="For organisers you sign up yourself. The organisation is created as verified, and the action is recorded in the audit log.">
        Add organisation
      </PageTitle>
      <CreateOrganisationForm />
    </>
  );
}
