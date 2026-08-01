import { OAuthType } from '@prisma/client';

export { OAuthType };

export interface UserProvider {
  id: string;
  type: OAuthType;
  providerUid: string;
  createdAt: Date;
  userId: string;
}
