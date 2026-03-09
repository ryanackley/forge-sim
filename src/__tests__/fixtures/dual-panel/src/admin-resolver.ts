import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();

resolver.define('getSettings', async () => {
  const theme = (await kvs.get('settings:theme') as string) ?? 'light';
  const notificationsEnabled = (await kvs.get('settings:notifications') as boolean) ?? true;
  
  return {
    theme,
    notificationsEnabled,
    version: '1.2.0',
  };
});

resolver.define('updateTheme', async (req: any) => {
  const { theme } = req.payload;
  await kvs.set('settings:theme', theme);
  return { success: true, theme };
});

export const handler = resolver.getDefinitions();
