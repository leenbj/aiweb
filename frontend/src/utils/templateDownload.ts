import { templateSDK } from '@/services/templateSDK';

export async function downloadTemplateZip(templateId: string, slug: string) {
  const blob = await templateSDK.export(templateId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug || 'template'}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
