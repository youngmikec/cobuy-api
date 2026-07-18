export const generateMonnifyBase64AuthKey = (apiKey: string, secretKey: string): string => {
  const credentials: string = `${apiKey}:${secretKey}`;
  const base64String: string = Buffer.from(credentials).toString('base64');
  return base64String;
}
