import { PageHeader as UiPageHeader } from "@/components/ui/page-header";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <UiPageHeader title={title} description={subtitle} action={actions} />
  );
}
